"""Office openen en als nieuwe private bijlage opslaan, met een duurzame ontvangstbevestiging."""

import hashlib
import re
from pathlib import Path
from uuid import UUID

import frappe
from frappe.core.api.file import get_max_file_size

from y_next.api.office_validation import APP_MAX_SIZE, InvalidOfficeFile, copy_filename, extension, safe_filename, validate_package

RECEIPT = "Y Office Save"
EDITABLE_PARENTS = {"Project", "Communication"}
MIME_TYPES = {
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
}


class OfficeError(frappe.ValidationError):
	http_status_code = 400


class OfficeConflictError(OfficeError):
	http_status_code = 409


def _error(code, conflict=False):
	frappe.response["office_error"] = code
	raise (OfficeConflictError if conflict else OfficeError)(code)


def _require_user():
	if not frappe.session.user or frappe.session.user == "Guest":
		raise frappe.PermissionError("office_permission_denied")


def _max_size():
	limits = [APP_MAX_SIZE, get_max_file_size()]
	try:
		site_limit = int(frappe.conf.get("max_file_size") or 0)
		if site_limit > 0:
			limits.append(site_limit)
	except (TypeError, ValueError):
		pass
	return min(value for value in limits if value > 0)


def _file(value, for_update=False):
	if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,140}", value):
		_error("office_invalid_file_id")
	if not frappe.db.exists("File", value):
		raise frappe.DoesNotExistError("office_file_not_found")
	doc = frappe.get_doc("File", value, for_update=for_update)
	doc.check_permission("read")
	parent = None
	if doc.attached_to_doctype or doc.attached_to_name:
		if not doc.attached_to_doctype or not doc.attached_to_name:
			_error("office_invalid_attachment")
		parent = frappe.get_doc(doc.attached_to_doctype, doc.attached_to_name)
		parent.check_permission("read")
	if doc.is_folder:
		_error("office_unsupported_type")
	return doc, parent


def _can_save(doc, parent):
	if not frappe.has_permission("File", "create"):
		return False
	if parent:
		return parent.doctype in EDITABLE_PARENTS and bool(parent.has_permission("write"))
	return doc.owner == frappe.session.user


def _read_local(doc):
	url = doc.file_url or ""
	prefix = "/private/files/" if doc.is_private else "/files/"
	if not url.startswith(prefix):
		_error("office_unsafe_file_path")
	filename = url[len(prefix):]
	if not filename or any(char in filename for char in "/\\%?#") or filename in (".", "..") or any(ord(char) < 32 for char in filename):
		_error("office_unsafe_file_path")
	try:
		kind = extension(safe_filename(doc.file_name, max_length=140))
		root = Path(frappe.get_site_path("private" if doc.is_private else "public", "files")).resolve()
		path = (root / filename).resolve(strict=True)
		path.relative_to(root)
		if not path.is_file():
			_error("office_unsafe_file_path")
		limit = _max_size()
		if path.stat().st_size > limit:
			_error("office_file_too_large")
		with path.open("rb") as stream:
			content = stream.read(limit + 1)
		if len(content) > limit:
			_error("office_file_too_large")
		validate_package(content, kind, limit)
		return content
	except InvalidOfficeFile as error:
		_error(str(error))
	except (OSError, ValueError):
		_error("office_unsafe_file_path")


def _metadata(doc, parent, content=None):
	if content is None:
		content = _read_local(doc)
	return {
		"name": doc.name, "file_name": doc.file_name, "file_url": doc.file_url,
		"content_hash": doc.content_hash, "sha256": hashlib.sha256(content).hexdigest(),
		"attached_to_doctype": doc.attached_to_doctype, "attached_to_name": doc.attached_to_name,
		"can_save": _can_save(doc, parent), "max_size": _max_size(),
	}


def _operation_id(value):
	try:
		if not isinstance(value, str) or str(UUID(value)) != value.lower():
			raise ValueError
		return str(UUID(value))
	except (ValueError, AttributeError):
		_error("office_invalid_operation_id")


def _result(receipt):
	# A receipt grants no access: both current File/parent permissions apply.
	_file(receipt.source_file)
	if not receipt.result_file:
		_error("office_save_pending", conflict=True)
	doc, parent = _file(receipt.result_file)
	result = _metadata(doc, parent)
	if result["sha256"] != receipt.result_sha256:
		_error("office_saved_file_changed", conflict=True)
	return {**result, "operation_id": receipt.operation_id, "source_file": receipt.source_file}


@frappe.whitelist(methods=["GET"])
def open_file(file_name: str):
	_require_user()
	doc, parent = _file(file_name)
	return _metadata(doc, parent)


@frappe.whitelist(methods=["GET"])
def file_content(file_name: str):
	_require_user()
	doc, _ = _file(file_name)
	content = _read_local(doc)
	frappe.response.update({
		"type": "download", "filename": doc.file_name, "filecontent": content,
		"content_type": MIME_TYPES[extension(doc.file_name)], "display_content_as": "attachment",
	})
	frappe.local.response_headers.update({"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@frappe.whitelist(methods=["POST"])
def save_file(source_file: str, expected_sha256: str, operation_id: str):
	_require_user()
	operation_id = _operation_id(operation_id)
	if not isinstance(expected_sha256, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", expected_sha256):
		_error("office_invalid_sha256")
	expected_sha256 = expected_sha256.lower()
	source, parent = _file(source_file)
	if not _can_save(source, parent):
		raise frappe.PermissionError("office_permission_denied")
	upload = frappe.request.files.get("file")
	if upload is None:
		_error("office_missing_upload")
	try:
		filename = safe_filename(upload.filename)
		kind = extension(filename)
		if kind != extension(source.file_name):
			_error("office_type_mismatch")
		content = upload.stream.read(_max_size() + 1)
		validate_package(content, kind, _max_size())
	except InvalidOfficeFile as error:
		_error(str(error))
	input_sha256 = hashlib.sha256(content).hexdigest()
	receipt = frappe.get_doc({
		"doctype": RECEIPT, "operation_id": operation_id, "actor": frappe.session.user,
		"source_file": source_file, "expected_sha256": expected_sha256,
		"input_sha256": input_sha256, "upload_filename": filename,
	})
	# This server-owned record has no user CRUD permissions. Its unique key is
	# reserved before writing bytes; concurrent retries wait on the DB insert.
	receipt.flags.office_save_internal = True
	frappe.db.savepoint("office_receipt_claim")
	try:
		receipt.insert(ignore_permissions=True)
	except frappe.DuplicateEntryError:
		frappe.db.rollback(save_point="office_receipt_claim")
		receipt = frappe.get_doc(RECEIPT, operation_id, for_update=True)
		bindings = (receipt.actor, receipt.source_file, receipt.expected_sha256, receipt.input_sha256, receipt.upload_filename)
		if bindings != (frappe.session.user, source_file, expected_sha256, input_sha256, filename):
			_error("office_operation_conflict", conflict=True)
		return _result(receipt)
	locked_source, locked_parent = _file(source_file, for_update=True)
	fields = ("file_url", "file_name", "attached_to_doctype", "attached_to_name", "is_private")
	if any(source.get(field) != locked_source.get(field) for field in fields):
		_error("office_source_changed", conflict=True)
	if not _can_save(locked_source, locked_parent):
		raise frappe.PermissionError("office_permission_denied")
	if hashlib.sha256(_read_local(locked_source)).hexdigest() != expected_sha256:
		_error("office_source_changed", conflict=True)
	copy = frappe.get_doc({
		"doctype": "File", "file_name": copy_filename(filename), "content": content, "is_private": 1,
		"attached_to_doctype": locked_source.attached_to_doctype,
		"attached_to_name": locked_source.attached_to_name,
	}).insert()
	result = _metadata(copy, locked_parent)
	if result["sha256"] != input_sha256:
		_error("office_saved_file_changed", conflict=True)
	receipt.result_file = copy.name
	receipt.result_sha256 = result["sha256"]
	# Only completion of our own reservation is written with elevated privileges.
	receipt.save(ignore_permissions=True)
	return {**result, "operation_id": operation_id, "source_file": source_file}


@frappe.whitelist(methods=["GET"])
def save_status(operation_id: str):
	_require_user()
	operation_id = _operation_id(operation_id)
	# Internal lookup is actor-scoped before any receipt data is returned.
	name = frappe.db.get_value(RECEIPT, {"name": operation_id, "actor": frappe.session.user}, "name")
	if not name:
		return {"found": False, "operation_id": operation_id}
	receipt = frappe.get_doc(RECEIPT, name)
	return {"found": True, "operation_id": operation_id, "file": _result(receipt)}
