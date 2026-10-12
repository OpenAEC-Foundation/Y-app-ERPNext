"""Office-bestanden: rechten, veilige kopieën en herhaalbare opslag."""

import hashlib
import importlib.util
import io
import uuid
import zipfile
from pathlib import Path

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import set_request

from y_next.tests.hulp import maak_gebruiker, maak_mail

EDITOR = "_test-office-editor@voorbeeld.test"
OTHER = "_test-office-other@voorbeeld.test"
VIEWER = "_test-office-viewer@voorbeeld.test"
DENIED = "_test-office-denied@voorbeeld.test"

TYPES = {
	"docx": ("word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "http://schemas.openxmlformats.org/wordprocessingml/2006/main", "document"),
	"xlsx": ("xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml", "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "workbook"),
	"xlsm": ("xl/workbook.xml", "application/vnd.ms-excel.sheet.macroEnabled.main+xml", "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "workbook"),
}


def package(extension="docx", marker="Original", extras=None):
	main, content_type, namespace, root = TYPES[extension]
	output = io.BytesIO()
	with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
		def write(name, content):
			member = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
			archive.writestr(member, content, compress_type=zipfile.ZIP_DEFLATED)

		write("[Content_Types].xml", f'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/{main}" ContentType="{content_type}"/></Types>')
		write("_rels/.rels", f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="{main}"/></Relationships>')
		write(main, f'<{root} xmlns="{namespace}"><body>{marker}</body></{root}>')
		for name, content in (extras or {}).items():
			write(name, content)
	return output.getvalue()


class TestOffice(IntegrationTestCase):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.addCleanup(frappe.set_user, "Administrator")
		self.addCleanup(frappe.db.rollback)
		for user, roles in ((EDITOR, ("Projects User",)), (OTHER, ("Projects User",)), (VIEWER, ()), (DENIED, ())):
			maak_gebruiker(user, "Test Office", rollen=roles)
		self.project = frappe.get_doc({"doctype": "Project", "project_name": "_Test Office " + uuid.uuid4().hex}).insert()
		frappe.share.add("Project", self.project.name, VIEWER, read=1, write=0, notify=0)
		self.original = package()
		self.source = self.file(self.original)
		frappe.set_user(EDITOR)

	def file(self, content, filename="_Test Office.docx", parent=True, owner=None):
		previous = frappe.session.user
		frappe.set_user(owner or "Administrator")
		try:
			return frappe.get_doc({
				"doctype": "File", "file_name": filename, "is_private": 1, "content": content,
				"attached_to_doctype": "Project" if parent else None,
				"attached_to_name": self.project.name if parent else None,
			}).insert(ignore_permissions=True)
		finally:
			frappe.set_user(previous)

	def api(self, name, method="GET", upload=None, **parameters):
		self.assertIsNotNone(importlib.util.find_spec("y_next.api.office"), "Office API is not implemented")
		data = dict(parameters)
		if upload:
			data["file"] = (io.BytesIO(upload[0]), upload[1])
		path = "y_next.api.office." + name
		set_request(method=method, path="/api/method/" + path, data=data if method == "POST" else None)
		frappe.local.form_dict = frappe._dict(parameters)
		frappe.local.response = frappe._dict()
		frappe.local.request_ip = "127.0.0.1"
		frappe.db.savepoint("office_test_request")
		try:
			return frappe.handler.execute_cmd(path)
		except Exception:
			frappe.db.rollback(save_point="office_test_request")
			raise

	def save(self, content=None, operation_id=None, source=None, expected=None, filename="_Test Edited.docx"):
		return self.api("save_file", method="POST", upload=(content or package(marker="Edited"), filename),
			source_file=source or self.source.name,
			expected_sha256=expected or hashlib.sha256(self.original).hexdigest(),
			operation_id=operation_id or str(uuid.uuid4()))

	def test_open_returns_real_byte_hash_and_permissions(self):
		frappe.db.set_value("File", self.source.name, "content_hash", "not-the-real-content-hash")
		result = self.api("open_file", file_name=self.source.name)
		self.assertEqual(result["name"], self.source.name)
		self.assertEqual(result["sha256"], hashlib.sha256(self.original).hexdigest())
		self.assertEqual(result["attached_to_name"], self.project.name)
		self.assertTrue(result["can_save"])
		self.assertLessEqual(result["max_size"], 20 * 1024 * 1024)
		self.api("file_content", file_name=self.source.name)
		self.assertEqual(frappe.response["filecontent"], self.original)
		self.assertEqual(frappe.response["type"], "download")
		self.assertEqual(frappe.local.response_headers["Cache-Control"], "private, no-store")

	def test_docx_xlsx_and_xlsm_are_saved_without_converting_type(self):
		for extension in ("docx", "xlsx", "xlsm"):
			with self.subTest(extension=extension):
				original = package(extension)
				source = self.file(original, filename="_Test Original." + extension, parent=False, owner=EDITOR)
				result = self.save(content=package(extension, marker="Edited"), source=source.name,
					expected=hashlib.sha256(original).hexdigest(), filename="_Test Edited." + extension)
				self.assertTrue(result["file_name"].endswith("." + extension))

	def test_long_source_filenames_support_repeated_saves_and_retries(self):
		for length in (130, 140):
			with self.subTest(length=length):
				filename = "_Test " + "n" * (length - 11) + ".docx"
				original = package(marker=f"_Test Original {length}")
				source = self.file(original, filename=filename, parent=False, owner=EDITOR)
				current = self.api("open_file", file_name=source.name)
				self.assertEqual(len(current["file_name"]), length)
				for revision in range(1, 4):
					edited = package(marker=f"_Test Revision {length}-{revision}")
					operation_id = str(uuid.uuid4())
					parameters = dict(content=edited, operation_id=operation_id,
						source=current["name"], expected=current["sha256"], filename=current["file_name"])
					result = self.save(**parameters)
					self.assertEqual(result["source_file"], current["name"])
					self.assertNotEqual(result["name"], current["name"])
					self.assertLessEqual(len(result["file_name"]), 140)
					self.assertTrue(result["file_name"].endswith(".docx"))
					self.assertEqual(self.save(**parameters)["name"], result["name"])
					current = self.api("open_file", file_name=result["name"])
					self.assertEqual(current["sha256"], hashlib.sha256(edited).hexdigest())
				self.assertEqual(Path(source.get_full_path()).read_bytes(), original)

	def test_communication_attachment_keeps_its_parent_and_permissions(self):
		frappe.set_user("Administrator")
		communication = maak_mail(owner=EDITOR)
		frappe.db.set_value("File", self.source.name, {"attached_to_doctype": "Communication", "attached_to_name": communication})
		frappe.share.add("Communication", communication, EDITOR, read=1, write=1, notify=0)
		frappe.set_user(EDITOR)
		result = self.save()
		self.assertEqual(result["attached_to_doctype"], "Communication")
		self.assertEqual(result["attached_to_name"], communication)
		frappe.set_user(DENIED)
		self.assertRaises(frappe.PermissionError, self.api, "open_file", file_name=result["name"])

	def test_file_create_permission_is_required_in_addition_to_parent_write(self):
		from frappe.permissions import update_permission_property

		frappe.set_user("Administrator")
		update_permission_property("File", "All", 0, "create", 0, validate=False)
		frappe.clear_cache(doctype="File")
		self.addCleanup(frappe.clear_cache, doctype="File")
		frappe.set_user(EDITOR)
		self.assertTrue(self.project.has_permission("write"))
		self.assertFalse(self.api("open_file", file_name=self.source.name)["can_save"])
		self.assertRaises(frappe.PermissionError, self.save)

	def test_byte_mutation_is_a_conflict_even_when_cached_hash_is_unchanged(self):
		frappe.set_user("Administrator")
		self.source.save_file(content=package(marker="Externally modified"), overwrite=True)
		frappe.set_user(EDITOR)
		self.assertRaisesRegex(frappe.ValidationError, "office_source_changed", self.save)

	def test_symlink_cannot_escape_the_local_file_directory(self):
		link = Path(frappe.get_site_path("private", "files", "_Test-link-" + uuid.uuid4().hex + ".docx"))
		link.symlink_to(Path(frappe.get_site_path("site_config.json")).resolve())
		self.addCleanup(link.unlink, missing_ok=True)
		frappe.db.set_value("File", self.source.name, "file_url", "/private/files/" + link.name)
		self.assertRaisesRegex(frappe.ValidationError, "office_unsafe_file_path", self.api, "open_file", file_name=self.source.name)

	def test_expanded_archive_limit_is_enforced_below_the_upload_limit(self):
		previous = frappe.conf.get("max_file_size")
		frappe.conf.max_file_size = 2048
		self.addCleanup(frappe.conf.update, {"max_file_size": previous})
		content = package(extras={"blob.bin": bytes(range(256)) * 40})
		self.assertLess(len(content), 2048)
		self.assertRaisesRegex(frappe.ValidationError, "office_archive_limit", self.save, content=content)

	def test_save_endpoint_cannot_be_called_with_get(self):
		self.assertRaises(frappe.PermissionError, self.api, "save_file", source_file=self.source.name,
			expected_sha256=hashlib.sha256(self.original).hexdigest(), operation_id=str(uuid.uuid4()))

	def test_status_rechecks_current_source_parent_permission(self):
		operation_id = str(uuid.uuid4())
		self.save(operation_id=operation_id)
		frappe.db.set_value("File", self.source.name, {"attached_to_doctype": None, "attached_to_name": None, "owner": OTHER})
		self.assertRaises(frappe.PermissionError, self.api, "save_status", operation_id=operation_id)

	def test_guest_and_unrelated_user_cannot_read_or_save(self):
		for user in ("Guest", DENIED):
			frappe.set_user(user)
			for endpoint in ("open_file", "file_content"):
				with self.subTest(user=user, endpoint=endpoint):
					self.assertRaises(frappe.PermissionError, self.api, endpoint, file_name=self.source.name)
			self.assertRaises(frappe.PermissionError, self.save)

	def test_owner_of_file_still_needs_parent_read(self):
		frappe.db.set_value("File", self.source.name, "owner", DENIED)
		frappe.set_user(DENIED)
		self.assertRaises(frappe.PermissionError, self.api, "open_file", file_name=self.source.name)

	def test_read_only_parent_has_no_save_permission(self):
		frappe.set_user(VIEWER)
		self.assertFalse(self.api("open_file", file_name=self.source.name)["can_save"])
		self.assertRaises(frappe.PermissionError, self.save)

	def test_standalone_save_is_owner_only_even_when_shared(self):
		file = self.file(self.original, parent=False, owner=EDITOR)
		frappe.set_user("Administrator")
		frappe.share.add("File", file.name, OTHER, read=1, write=1, notify=0)
		frappe.set_user(OTHER)
		self.assertFalse(self.api("open_file", file_name=file.name)["can_save"])
		self.assertRaises(frappe.PermissionError, self.save, source=file.name)
		frappe.set_user(EDITOR)
		result = self.save(source=file.name)
		self.assertFalse(result["attached_to_doctype"])
		self.assertEqual(frappe.db.get_value("File", result["name"], "owner"), EDITOR)

	def test_save_creates_private_attachment_without_changing_original(self):
		edited = package(marker="Changed")
		result = self.save(content=edited)
		self.assertNotEqual(result["name"], self.source.name)
		self.assertEqual(result["source_file"], self.source.name)
		self.assertEqual(result["attached_to_doctype"], "Project")
		self.assertEqual(result["attached_to_name"], self.project.name)
		self.assertTrue(result["file_url"].startswith("/private/files/"))
		self.assertEqual(result["sha256"], hashlib.sha256(edited).hexdigest())
		self.source.reload()
		self.assertEqual(Path(self.source.get_full_path()).read_bytes(), self.original)
		self.assertEqual(Path(frappe.get_doc("File", result["name"]).get_full_path()).read_bytes(), edited)
		frappe.set_user(DENIED)
		self.assertRaises(frappe.PermissionError, self.api, "file_content", file_name=result["name"])

	def test_stale_hash_does_not_create_a_file_or_receipt(self):
		before = frappe.db.count("File")
		operation_id = str(uuid.uuid4())
		with self.assertRaisesRegex(frappe.ValidationError, "office_source_changed") as raised:
			self.save(expected="0" * 64, operation_id=operation_id)
		self.assertEqual(raised.exception.http_status_code, 409)
		self.assertEqual(frappe.db.count("File"), before)
		self.assertFalse(self.api("save_status", operation_id=operation_id)["found"])

	def test_duplicate_save_and_status_return_the_same_file(self):
		operation_id = str(uuid.uuid4())
		first = self.save(operation_id=operation_id)
		before = frappe.db.count("File")
		second = self.save(operation_id=operation_id)
		self.assertEqual(second["name"], first["name"])
		self.assertEqual(frappe.db.count("File"), before)
		status = self.api("save_status", operation_id=operation_id)
		self.assertTrue(status["found"])
		self.assertEqual(status["file"]["name"], first["name"])
		self.assertEqual(status["operation_id"], operation_id)

	def test_operation_id_is_bound_to_actor_source_hash_and_filename(self):
		operation_id = str(uuid.uuid4())
		self.save(operation_id=operation_id)
		for change in ({"content": package(marker="Different")}, {"expected": "0" * 64}, {"filename": "different.docx"}, {"source": self.file(self.original).name}):
			with self.subTest(change=tuple(change)):
				self.assertRaisesRegex(frappe.ValidationError, "office_operation_conflict", self.save, operation_id=operation_id, **change)
		frappe.set_user(OTHER)
		self.assertEqual(self.api("save_status", operation_id=operation_id), {"found": False, "operation_id": operation_id})
		self.assertRaisesRegex(frappe.ValidationError, "office_operation_conflict", self.save, operation_id=operation_id)

	def test_status_rechecks_current_source_and_result_permissions(self):
		operation_id = str(uuid.uuid4())
		result = self.save(operation_id=operation_id)
		frappe.db.set_value("File", result["name"], {"attached_to_doctype": None, "attached_to_name": None, "owner": OTHER})
		self.assertRaises(frappe.PermissionError, self.api, "save_status", operation_id=operation_id)

	def test_only_supported_local_files_and_exact_file_ids(self):
		for url in ("https://example.test/doc.docx", "/private/files/../site_config.json", "/private/files/%2e%2e/doc.docx", "/files/doc.docx?token=x", "/files/doc.docx"):
			with self.subTest(url=url):
				frappe.db.set_value("File", self.source.name, "file_url", url)
				self.assertRaises(frappe.ValidationError, self.api, "open_file", file_name=self.source.name)
		for value in (self.source.file_url, "../doc.docx", "https://example.test/doc.docx"):
			self.assertRaises(frappe.ValidationError, self.api, "open_file", file_name=value)

	def test_rejects_unsafe_upload_names_and_type_switches(self):
		for filename in ("../edited.docx", "C:\\edited.docx", "x\n.docx", ".docx", "CON.docx", "edited.docx ", "x?.docx", "edited.xlsx"):
			with self.subTest(filename=filename):
				self.assertRaises(frappe.ValidationError, self.save, filename=filename)

	def test_rejects_unsafe_source_display_filename(self):
		frappe.db.set_value("File", self.source.name, "file_name", "../unsafe.docx")
		self.assertRaisesRegex(frappe.ValidationError, "office_invalid_filename", self.api, "open_file", file_name=self.source.name)

	def test_external_resources_are_refused_but_safe_hyperlinks_are_preserved(self):
		for relationship_type, target, mode in (
			("image", "https://remote.invalid/image.png", "External"),
			("attachedTemplate", "https://remote.invalid/template.dotx", "External"),
			("image", "https://remote.invalid/image.png", ""),
			("hyperlink", "javascript:alert(1)", "External"),
		):
			with self.subTest(relationship_type=relationship_type, target=target):
				relationships = f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/{relationship_type}" Target="{target}" TargetMode="{mode}"/></Relationships>'
				self.assertRaisesRegex(frappe.ValidationError, "office_external_resource", self.save,
					content=package(extras={"word/_rels/document.xml.rels": relationships}))
		hyperlink = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.test/page" TargetMode="External"/></Relationships>'
		result = self.save(content=package(extras={"word/_rels/document.xml.rels": hyperlink}))
		self.assertTrue(result["name"])

	def test_archives_with_too_many_parts_are_refused(self):
		content = package(extras={f"custom/{index}.bin": b"x" for index in range(2000)})
		self.assertRaisesRegex(frappe.ValidationError, "office_archive_limit", self.save, content=content)

	def test_rejects_invalid_archives_traversal_entities_and_bombs(self):
		for content in (b"not an archive", package("xlsx"), package(extras={"../hidden.xml": "x"}), package(extras={"custom.xml": '<!DOCTYPE x [<!ENTITY e "x">]><x>&e;</x>'}), package(extras={"blob.bin": b"x" * (2 * 1024 * 1024)})):
			with self.subTest(size=len(content)):
				self.assertRaises(frappe.ValidationError, self.save, content=content)

	def test_actual_bytes_are_checked_against_lower_site_size_limit(self):
		previous = frappe.conf.get("max_file_size")
		frappe.conf.max_file_size = 256
		self.addCleanup(frappe.conf.update, {"max_file_size": previous})
		frappe.db.set_value("File", self.source.name, "file_size", 1)
		self.assertRaisesRegex(frappe.ValidationError, "office_file_too_large", self.api, "open_file", file_name=self.source.name)

	def test_receipt_cannot_be_created_through_generic_document_api(self):
		frappe.set_user("Administrator")
		self.assertRaises(frappe.PermissionError, frappe.get_doc({
			"doctype": "Y Office Save", "operation_id": str(uuid.uuid4()), "actor": EDITOR,
			"source_file": self.source.name, "expected_sha256": "0" * 64, "input_sha256": "1" * 64,
			"upload_filename": "_Test Edited.docx",
		}).insert)
