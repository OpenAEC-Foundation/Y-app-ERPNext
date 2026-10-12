"""Waar de e-mailondertekening uit wordt opgebouwd."""

import frappe
from frappe.tests import IntegrationTestCase

from y_next.tests.hulp import maak_gebruiker, maak_medewerker, maak_postbus, roep

DIRK = "dirk@voorbeeld.test"
ELS = "els@voorbeeld.test"
FLEUR = "fleur@voorbeeld.test"
GAST = "bezoeker@voorbeeld.test"
BAAS = "baas@voorbeeld.test"

HUISSTIJL = {
	"custom_trade_name": "Voorbeeld Bouw",
	"custom_brand_color_dark": "#350E35",
	"custom_brand_color_accent": "#44B6A8",
	"custom_linkedin_url": "https://www.linkedin.com/company/voorbeeld",
	"custom_signature_greeting": "Kind regards,",
	"website": "www.voorbeeld.test",
}


def maak_adres(titel: str, straat: str, bedrijf: str | None, eigen: int) -> str:
	adres = frappe.get_doc(
		{
			"doctype": "Address",
			"address_title": titel,
			"address_type": "Office",
			"address_line1": straat,
			"pincode": "1234 AB",
			"city": "Ons Dorp",
			"country": frappe.db.get_value("Country", {}, "name"),
			"is_your_company_address": eigen,
			"links": [{"link_doctype": "Company", "link_name": bedrijf}] if bedrijf else [],
		}
	)
	adres.insert(ignore_permissions=True)
	return adres.name


class TestOndertekeningGegevens(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.bedrijf = frappe.db.get_value("Company", {}, "name")
		# Dirk heeft een medewerkerskaart; Els en Fleur werken zonder kaart.
		maak_medewerker(DIRK, "Dirk")
		maak_gebruiker(ELS, "Els", rollen=("Projects User",))
		maak_gebruiker(FLEUR, "Fleur", rollen=("Projects User",))
		maak_gebruiker(GAST, "Bezoeker")
		maak_gebruiker(BAAS, "Baas", rollen=("System Manager",))
		# Een kopie: set_value zet er zelf velden bij.
		frappe.db.set_value("Company", cls.bedrijf, dict(HUISSTIJL))
		# Een eerder aangemaakt vestigingsadres zou de uitkomst bepalen.
		frappe.db.set_value("Address", {"is_your_company_address": 1}, "is_your_company_address", 0)
		maak_adres("Een klant", "Klantlaan 9", None, 0)
		maak_adres("Vestiging", "Dorpsstraat 1", cls.bedrijf, 1)
		cls.postbus = maak_postbus("Y Verkooppostbus", "verkoop@voorbeeld.test", ELS)
		frappe.db.set_value(
			"Email Account",
			cls.postbus,
			{"custom_company": cls.bedrijf, "signature": "<p>Team Verkoop</p>"},
		)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_korte_naam_wijst_naar_app_code(self):
		doel = frappe.get_hooks("override_whitelisted_methods")["ondertekening_gegevens"][-1]
		self.assertTrue(doel.startswith("y_next.api."))
		self.assertIn(frappe.get_attr(doel), frappe.whitelisted)

	def test_wie_geen_medewerker_is_krijgt_niets(self):
		for gebruiker in ("Guest", GAST):
			with self.subTest(gebruiker=gebruiker):
				frappe.set_user(gebruiker)
				self.assertRaises(frappe.PermissionError, roep, "ondertekening_gegevens")

	def test_medewerker_krijgt_huisstijl_en_adres_van_zijn_bedrijf(self):
		# Een gewone medewerker mag in ERPNext alleen adressen lezen die hij
		# zelf heeft aangemaakt; het adres van zijn eigen bedrijf hoort er wel
		# onder zijn mail te staan.
		frappe.set_user(DIRK)
		self.assertEqual(frappe.get_list("Address", filters={"is_your_company_address": 1}), [])
		antwoord = roep("ondertekening_gegevens")
		self.assertEqual(antwoord["bedrijf"]["name"], self.bedrijf)
		for veld, waarde in HUISSTIJL.items():
			with self.subTest(veld=veld):
				self.assertEqual(antwoord["bedrijf"][veld], waarde)
		self.assertEqual(
			antwoord["adres"],
			{"address_line1": "Dorpsstraat 1", "pincode": "1234 AB", "city": "Ons Dorp", "phone": None},
		)
		self.assertIsNone(antwoord["postbus"])

	def test_alleen_wat_de_ondertekening_nodig_heeft(self):
		frappe.set_user(DIRK)
		antwoord = roep("ondertekening_gegevens")
		self.assertEqual(set(antwoord), {"bedrijf", "adres", "postbus"})
		self.assertEqual(
			set(antwoord["bedrijf"]),
			{
				"name",
				"company_name",
				"company_logo",
				"website",
				"custom_trade_name",
				"custom_brand_color_dark",
				"custom_brand_color_accent",
				"custom_linkedin_url",
				"custom_signature_greeting",
			},
		)

	def test_zonder_kaart_en_zonder_postbus_is_er_geen_bedrijf(self):
		frappe.set_user(FLEUR)
		self.assertEqual(roep("ondertekening_gegevens"), {"bedrijf": None, "adres": None, "postbus": None})

	def test_eigen_postbus_bepaalt_het_bedrijf_en_geeft_haar_handtekening(self):
		frappe.set_user(ELS)
		antwoord = roep("ondertekening_gegevens", postbus=self.postbus)
		self.assertEqual(antwoord["bedrijf"]["name"], self.bedrijf)
		self.assertEqual(antwoord["adres"]["address_line1"], "Dorpsstraat 1")
		self.assertEqual(antwoord["postbus"], {"signature": "<p>Team Verkoop</p>"})

	def test_andermans_postbus_telt_niet(self):
		# Fleur is niet aan de postbus toegewezen: geen handtekening, en het
		# bedrijf van die postbus is niet het hare.
		frappe.set_user(FLEUR)
		self.assertEqual(
			roep("ondertekening_gegevens", postbus=self.postbus),
			{"bedrijf": None, "adres": None, "postbus": None},
		)

	def test_onbekende_postbus_is_geen_fout(self):
		frappe.set_user(DIRK)
		antwoord = roep("ondertekening_gegevens", postbus="Bestaat niet")
		self.assertEqual(antwoord["bedrijf"]["name"], self.bedrijf)
		self.assertIsNone(antwoord["postbus"])

	def test_beheerder_ondertekent_vanuit_elke_postbus(self):
		frappe.set_user(BAAS)
		antwoord = roep("ondertekening_gegevens", postbus=self.postbus)
		self.assertEqual(antwoord["bedrijf"]["name"], self.bedrijf)
		self.assertEqual(antwoord["postbus"], {"signature": "<p>Team Verkoop</p>"})

	def test_zonder_vestigingsadres_blijft_de_rest_staan(self):
		self.addCleanup(frappe.db.rollback)
		frappe.db.set_value("Address", {"is_your_company_address": 1}, "is_your_company_address", 0)
		frappe.set_user(DIRK)
		antwoord = roep("ondertekening_gegevens")
		self.assertEqual(antwoord["bedrijf"]["name"], self.bedrijf)
		self.assertIsNone(antwoord["adres"])
