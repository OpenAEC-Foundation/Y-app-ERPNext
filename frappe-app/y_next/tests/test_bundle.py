from frappe.tests import UnitTestCase

from y_next.bundle import parse_manifest


class TestParseManifest(UnitTestCase):
	def test_vindt_startbestand_en_stylesheets(self):
		manifest = {
			"index.html": {"file": "yapp-index-abc.js", "isEntry": True, "css": ["yapp-index-def.css"]},
			"src/x.ts": {"file": "yapp-x-123.js"},
		}
		self.assertEqual(
			parse_manifest(manifest),
			{"js": "yapp-index-abc.js", "css": ["yapp-index-def.css"]},
		)

	def test_startbestand_zonder_stylesheets(self):
		self.assertEqual(
			parse_manifest({"index.html": {"file": "a.js", "isEntry": True}}),
			{"js": "a.js", "css": []},
		)

	def test_geen_startbestand(self):
		self.assertIsNone(parse_manifest({"src/x.ts": {"file": "yapp-x-123.js"}}))
		self.assertIsNone(parse_manifest({}))
