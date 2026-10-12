"""Begrensde validatie van lokale Office Open XML-bestanden."""

import io
import re
import stat
import unicodedata
import zipfile
from pathlib import PurePosixPath
from urllib.parse import unquote
from xml.etree import ElementTree

APP_MAX_SIZE = 20 * 1024 * 1024
MAX_EXPANDED_SIZE = 80 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 2000
MAX_XML_SIZE = 16 * 1024 * 1024
CONTENT_TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
RELATIONSHIPS_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
OFFICE_RELATIONSHIPS = {
	"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
	"http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument",
}
OFFICE_TYPES = {
	".docx": ("word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "document", {"http://schemas.openxmlformats.org/wordprocessingml/2006/main", "http://purl.oclc.org/ooxml/wordprocessingml/main"}),
	".xlsx": ("xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml", "workbook", {"http://schemas.openxmlformats.org/spreadsheetml/2006/main", "http://purl.oclc.org/ooxml/spreadsheetml/main"}),
	".xlsm": ("xl/workbook.xml", "application/vnd.ms-excel.sheet.macroEnabled.main+xml", "workbook", {"http://schemas.openxmlformats.org/spreadsheetml/2006/main", "http://purl.oclc.org/ooxml/spreadsheetml/main"}),
}


class InvalidOfficeFile(ValueError):
	pass


def safe_filename(value: str, max_length: int = 140) -> str:
	if not isinstance(value, str) or not value or len(value) > max_length:
		raise InvalidOfficeFile("office_invalid_filename")
	if value != value.strip() or value.endswith(".") or value.startswith("."):
		raise InvalidOfficeFile("office_invalid_filename")
	if any(char in '/\\:<>"|?*' or unicodedata.category(char).startswith("C") for char in value):
		raise InvalidOfficeFile("office_invalid_filename")
	if re.fullmatch(r"(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])", value.split(".")[0], re.I):
		raise InvalidOfficeFile("office_invalid_filename")
	return unicodedata.normalize("NFC", value)


def copy_filename(filename: str) -> str:
	"""Laat zes tekens vrij voor Frappe's conflictsuffix binnen het Data-veld."""
	filename = safe_filename(filename)
	suffix = PurePosixPath(filename).suffix
	if len(filename) <= 134:
		return filename
	return filename[:134 - len(suffix)] + suffix


def extension(filename: str) -> str:
	value = PurePosixPath(filename).suffix.lower()
	if value not in OFFICE_TYPES:
		raise InvalidOfficeFile("office_unsupported_type")
	return value


def _parse_xml(content: bytes):
	# ElementTree does not fetch external entities; reject declarations as well.
	# Removing NULs also catches declarations in UTF-16/UTF-32 XML.
	normalized = content.replace(b"\x00", b"").upper()
	if b"<!DOCTYPE" in normalized or b"<!ENTITY" in normalized:
		raise InvalidOfficeFile("office_unsafe_xml")
	return ElementTree.fromstring(content)


def _validate_relationships(root):
	if root.tag != f"{{{RELATIONSHIPS_NS}}}Relationships":
		raise InvalidOfficeFile("office_invalid_archive")
	for relationship in root.findall(f"{{{RELATIONSHIPS_NS}}}Relationship"):
		target = unquote(relationship.get("Target", "")).strip()
		hyperlink = relationship.get("Type", "").endswith("/hyperlink")
		remote = bool(re.match(r"[a-z][\w+.-]*:|//|\\", target, re.I))
		external = relationship.get("TargetMode", "").lower() == "external"
		if (not hyperlink and (remote or external)) or (hyperlink and remote and not re.match(r"(?:https?:|mailto:)", target, re.I)):
			raise InvalidOfficeFile("office_external_resource")


def validate_package(content: bytes, kind: str, max_size: int) -> None:
	if not content or len(content) > max_size:
		raise InvalidOfficeFile("office_file_too_large" if content else "office_invalid_archive")
	if kind not in OFFICE_TYPES or not content.startswith(b"PK\x03\x04"):
		raise InvalidOfficeFile("office_invalid_archive")
	main, main_type, root_name, root_namespaces = OFFICE_TYPES[kind]
	needed = {"[Content_Types].xml", "_rels/.rels", main}
	expanded_limit = min(MAX_EXPANDED_SIZE, max_size * 4)
	try:
		with zipfile.ZipFile(io.BytesIO(content)) as archive:
			members = archive.infolist()
			if not members or len(members) > MAX_ARCHIVE_ENTRIES:
				raise InvalidOfficeFile("office_archive_limit")
			names = set()
			declared_size = 0
			for member in members:
				name = member.filename
				parts = PurePosixPath(name).parts
				if not name or name.startswith("/") or "\\" in name or ":" in name or any(part in ("..", ".") for part in parts) or any(ord(char) < 32 for char in name):
					raise InvalidOfficeFile("office_unsafe_archive")
				if name in names or member.flag_bits & 1 or stat.S_ISLNK(member.external_attr >> 16):
					raise InvalidOfficeFile("office_unsafe_archive")
				if member.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
					raise InvalidOfficeFile("office_unsafe_archive")
				if member.file_size > max(1, member.compress_size) * 200:
					raise InvalidOfficeFile("office_archive_limit")
				if kind != ".xlsm" and name.lower().endswith("vbaproject.bin"):
					raise InvalidOfficeFile("office_type_mismatch")
				names.add(name)
				declared_size += member.file_size
				if declared_size > expanded_limit:
					raise InvalidOfficeFile("office_archive_limit")
			if not needed.issubset(names):
				raise InvalidOfficeFile("office_invalid_archive")
			parts = {}
			expanded_size = 0
			for member in members:
				if member.is_dir():
					continue
				chunks = []
				tail = b""
				part_size = 0
				is_xml = member.filename.lower().endswith((".xml", ".rels"))
				with archive.open(member) as stream:
					while chunk := stream.read(64 * 1024):
						expanded_size += len(chunk)
						part_size += len(chunk)
						if expanded_size > expanded_limit:
							raise InvalidOfficeFile("office_archive_limit")
						if is_xml:
							scan = (tail + chunk).replace(b"\x00", b"").upper()
							if b"<!DOCTYPE" in scan or b"<!ENTITY" in scan:
								raise InvalidOfficeFile("office_unsafe_xml")
							tail = chunk[-64:]
						if member.filename in needed or member.filename.lower().endswith(".rels"):
							if part_size > MAX_XML_SIZE:
								raise InvalidOfficeFile("office_archive_limit")
							chunks.append(chunk)
				if member.filename in needed or member.filename.lower().endswith(".rels"):
					root = _parse_xml(b"".join(chunks))
					if member.filename.lower().endswith(".rels"):
						_validate_relationships(root)
					if member.filename in needed:
						parts[member.filename] = root
			if parts["[Content_Types].xml"].tag != f"{{{CONTENT_TYPES_NS}}}Types":
				raise InvalidOfficeFile("office_invalid_archive")
			types = {part.get("PartName"): part.get("ContentType") for part in parts["[Content_Types].xml"].findall(f"{{{CONTENT_TYPES_NS}}}Override")}
			if types.get("/" + main) != main_type:
				raise InvalidOfficeFile("office_type_mismatch")
			relationships = parts["_rels/.rels"]
			if relationships.tag != f"{{{RELATIONSHIPS_NS}}}Relationships" or not any(part.get("Type") in OFFICE_RELATIONSHIPS and part.get("Target", "").lstrip("/") == main and part.get("TargetMode") != "External" for part in relationships):
				raise InvalidOfficeFile("office_invalid_archive")
			if parts[main].tag not in {f"{{{namespace}}}{root_name}" for namespace in root_namespaces}:
				raise InvalidOfficeFile("office_type_mismatch")
	except (zipfile.BadZipFile, zipfile.LargeZipFile, ElementTree.ParseError, RuntimeError, EOFError, OSError, ValueError) as error:
		if isinstance(error, InvalidOfficeFile):
			raise
		raise InvalidOfficeFile("office_invalid_archive") from error
