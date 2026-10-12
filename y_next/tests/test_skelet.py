import os
import tomllib

import frappe
from frappe.tests import UnitTestCase


class TestSkelet(UnitTestCase):
	"""Bewaakt het uitgangspunt: kale ERPNext, geen afhankelijkheden."""

	def test_alleen_erpnext_is_vereist(self):
		self.assertEqual(frappe.get_hooks("required_apps", app_name="y_next"), ["erpnext"])

	def test_geen_python_afhankelijkheden(self):
		pad = os.path.join(os.path.dirname(frappe.get_app_path("y_next")), "pyproject.toml")
		with open(pad, "rb") as bestand:
			project = tomllib.load(bestand)
		self.assertEqual(project["project"]["dependencies"], [])
		self.assertEqual(
			project["tool"]["bench"]["frappe-dependencies"],
			{"frappe": ">=16.0.0,<17.0.0", "erpnext": ">=16.0.0,<17.0.0"},
		)

	def test_versie_is_een_versienummer(self):
		import y_next

		self.assertRegex(y_next.__version__, r"^\d+\.\d+\.\d+$")
