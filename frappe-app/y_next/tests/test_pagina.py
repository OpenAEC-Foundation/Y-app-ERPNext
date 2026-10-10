from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import set_request
from frappe.website.serve import get_response

BUNDEL = {"js": "yapp-index-abc.js", "css": ["yapp-index-def.css"]}


class TestPagina(IntegrationTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def haal(self, bundel=BUNDEL):
		with patch("y_next.www.y_next.get_entry", return_value=bundel):
			set_request(method="GET", path="y-next")
			response = get_response()
		return response, frappe.safe_decode(response.get_data())

	def test_laadt_de_bundel_uit_de_app(self):
		response, html = self.haal()
		self.assertEqual(response.status_code, 200)
		self.assertIn('<div id="root" data-y-next-router="hash"></div>', html)
		self.assertIn('<script type="module" src="/assets/y_next/app/yapp-index-abc.js"></script>', html)
		self.assertIn('<link rel="stylesheet" href="/assets/y_next/app/yapp-index-def.css" />', html)

	def test_staat_los_van_het_websitesjabloon(self):
		_, html = self.haal()
		self.assertTrue(html.lstrip().lower().startswith("<!doctype html>"))
		self.assertNotIn("navbar", html)
		self.assertNotIn("/assets/frappe/", html)

	def test_ingelogde_gebruiker_krijgt_een_csrf_token(self):
		frappe.set_user("Administrator")
		_, html = self.haal()
		self.assertRegex(html, r'window\.csrf_token = "[0-9a-f]{16,}";')

	def test_gast_krijgt_een_leeg_token(self):
		frappe.set_user("Guest")
		response, html = self.haal()
		self.assertEqual(response.status_code, 200)
		self.assertIn('window.csrf_token = "";', html)

	def test_meldt_een_ontbrekende_bundel(self):
		_, html = self.haal(bundel=None)
		self.assertIn("De bundel van Y-next ontbreekt", html)
		self.assertNotIn('id="root"', html)
