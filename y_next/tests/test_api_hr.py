"""Kilometers boeken in de reisaanvraag van de maand (koppeling met HRMS)."""

import unittest

import frappe
from frappe.tests import IntegrationTestCase

from y_next.tests.hulp import maak_gebruiker, maak_medewerker, roep

ANNA = "anna@voorbeeld.test"
BRAM = "bram@voorbeeld.test"
HR = "hr@voorbeeld.test"

INSTELLING = "km-via-reisaanvraag"


def zet_instelling(waarde: str | None):
	"""Zet of verwijdert de keuze van de beheerder om kilometers via reisaanvragen te boeken."""
	if frappe.db.exists("Y Next Setting", INSTELLING):
		frappe.delete_doc("Y Next Setting", INSTELLING, ignore_permissions=True, force=True)
	if waarde is not None:
		frappe.get_doc({"doctype": "Y Next Setting", "setting_key": INSTELLING, "setting_value": waarde}).insert(
			ignore_permissions=True
		)


class TestZonderKoppeling(IntegrationTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def test_meldt_dat_de_site_geen_reisaanvragen_gebruikt(self):
		# Zonder bewuste keuze van de beheerder blijven kilometers op het eigen
		# doctype van Y-next staan, ook als HRMS is geïnstalleerd.
		maak_medewerker(ANNA, "Anna")
		zet_instelling(None)
		frappe.set_user(ANNA)
		self.assertEqual(roep("km_rit_boeken", actie="info"), {"reisaanvraag": False})
		self.assertRaisesRegex(
			frappe.ValidationError,
			"niet via reisaanvragen",
			roep,
			"km_rit_boeken",
			employee="X",
			datum="2026-10-05",
			van="A",
			naar="B",
			kilometers="10",
		)

	def test_de_instelling_alleen_is_niet_genoeg_zonder_hrms(self):
		if "hrms" in frappe.get_installed_apps():
			self.skipTest("HRMS is op deze site geïnstalleerd")
		maak_medewerker(ANNA, "Anna")
		zet_instelling("1")
		frappe.set_user(ANNA)
		self.assertEqual(roep("km_rit_boeken", actie="info"), {"reisaanvraag": False})


class TestMetHrms(IntegrationTestCase):
	"""Draait alleen op een site waar HRMS is geïnstalleerd."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		if "hrms" not in frappe.get_installed_apps():
			raise unittest.SkipTest("HRMS is op deze site niet geïnstalleerd")
		cls.anna = maak_medewerker(ANNA, "Anna")
		cls.bram = maak_medewerker(BRAM, "Bram")
		maak_gebruiker(HR, "Hr", rollen=("HR User",))
		zet_instelling("1")
		frappe.db.set_value("Y Next Setting", "km-tarief", "setting_value", "0.25")

	def tearDown(self):
		frappe.set_user("Administrator")

	def boek(self, **extra):
		argumenten = {"employee": self.anna, "datum": "2031-03-10", "van": "Kantoor", "naar": "Bouwplaats", "kilometers": "20"}
		argumenten.update(extra)
		return roep("km_rit_boeken", **argumenten)

	def test_info_meldt_de_koppeling(self):
		frappe.set_user(ANNA)
		self.assertEqual(roep("km_rit_boeken", actie="info"), {"reisaanvraag": True})

	def test_boeken_maakt_de_reisaanvraag_van_de_maand_en_houdt_de_totalen_bij(self):
		frappe.set_user(ANNA)
		eerste = self.boek(retour="1")
		self.assertEqual(
			{sleutel: eerste[sleutel] for sleutel in ("dubbel", "proef", "nieuwe_reisaanvraag", "afstand", "tarief", "bedrag", "ritten")},
			{"dubbel": False, "proef": False, "nieuwe_reisaanvraag": True, "afstand": 40.0, "tarief": 0.25, "bedrag": 10.0, "ritten": 1},
		)
		aanvraag = frappe.get_doc("Travel Request", eerste["reisaanvraag"])
		self.assertEqual((str(aanvraag.custom_from_date), str(aanvraag.custom_to_date)), ("2031-03-01", "2031-03-31"))
		self.assertEqual(aanvraag.employee, self.anna)
		rit = aanvraag.itinerary[0]
		self.assertEqual((rit.name, rit.travel_from, rit.travel_to), (eerste["rij"], "Kantoor", "Bouwplaats"))
		self.assertEqual((rit.custom_distance, rit.custom_journey_type, rit.custom_travel_cost), (40.0, "Return", 10.0))

		# Een tweede rit in dezelfde maand komt in dezelfde reisaanvraag.
		tweede = self.boek(datum="2031-03-12", kilometers="10")
		self.assertEqual((tweede["reisaanvraag"], tweede["nieuwe_reisaanvraag"]), (eerste["reisaanvraag"], False))
		self.assertEqual((tweede["totaal_afstand"], tweede["totaal_kosten"], tweede["ritten"]), (50.0, 12.5, 2))
		aanvraag.reload()
		self.assertEqual(aanvraag.custom_total_distance, 50.0)
		reiskosten = [regel for regel in aanvraag.costings if regel.expense_type == "Travel"]
		self.assertEqual([regel.total_amount for regel in reiskosten], [12.5])

	def test_dezelfde_rit_op_dezelfde_dag_wordt_gemeld_niet_geblokkeerd(self):
		frappe.set_user(ANNA)
		eerste = self.boek(datum="2031-04-07")
		dubbel = self.boek(datum="2031-04-07")
		self.assertEqual(dubbel, {"dubbel": True, "reisaanvraag": eerste["reisaanvraag"], "datum": "2031-04-07"})
		self.assertEqual(len(frappe.get_doc("Travel Request", eerste["reisaanvraag"]).itinerary), 1)
		toch = self.boek(datum="2031-04-07", toch="1")
		self.assertEqual((toch["dubbel"], toch["ritten"]), (False, 2))

	def test_proef_rekent_uit_zonder_op_te_slaan(self):
		frappe.set_user(ANNA)
		voor = frappe.db.count("Travel Request", {"employee": self.anna})
		proef = self.boek(datum="2031-05-05", proef="1")
		self.assertEqual((proef["proef"], proef["reisaanvraag"], proef["rij"], proef["bedrag"]), (True, "", "", 5.0))
		self.assertEqual(frappe.db.count("Travel Request", {"employee": self.anna}), voor)

	def test_alleen_voor_jezelf_tenzij_je_hr_bent(self):
		frappe.set_user(BRAM)
		self.assertRaisesRegex(frappe.ValidationError, "alleen je eigen ritten", self.boek, datum="2031-06-02")
		frappe.set_user(HR)
		self.assertFalse(self.boek(datum="2031-06-02")["dubbel"])

	def test_wijzigen_en_verwijderen_zolang_de_maand_open_staat(self):
		frappe.set_user(ANNA)
		eerste = self.boek(datum="2031-07-07")
		tweede = self.boek(datum="2031-07-08", kilometers="30")

		gewijzigd = roep(
			"km_rit_boeken", actie="wijzigen", rij=eerste["rij"], datum="2031-07-09", van="Thuis", naar="Kantoor", kilometers="50"
		)
		self.assertEqual((gewijzigd["tarief"], gewijzigd["bedrag"], gewijzigd["totaal_afstand"]), (0.25, 12.5, 80.0))
		rit = frappe.get_doc("Travel Request", eerste["reisaanvraag"]).itinerary[0]
		self.assertEqual((rit.travel_from, str(rit.departure_date)[:10], rit.custom_distance), ("Thuis", "2031-07-09", 50.0))

		self.assertRaisesRegex(
			frappe.ValidationError,
			"buiten deze reisaanvraag",
			roep,
			"km_rit_boeken",
			actie="wijzigen",
			rij=eerste["rij"],
			datum="2031-08-01",
			van="Thuis",
			naar="Kantoor",
			kilometers="50",
		)

		weg = roep("km_rit_boeken", actie="verwijderen", rij=tweede["rij"])
		self.assertEqual((weg["ritten"], weg["totaal_afstand"]), (1, 50.0))
		self.assertRaisesRegex(
			frappe.ValidationError, "niet \\(meer\\) in een reisaanvraag", roep, "km_rit_boeken", actie="verwijderen", rij=tweede["rij"]
		)

		frappe.set_user(BRAM)
		self.assertRaisesRegex(
			frappe.ValidationError, "alleen je eigen ritten", roep, "km_rit_boeken", actie="verwijderen", rij=eerste["rij"]
		)

	def test_een_ingediende_maand_is_dicht(self):
		frappe.set_user(ANNA)
		eerste = self.boek(datum="2031-09-01")
		frappe.set_user("Administrator")
		frappe.db.set_value("Travel Request", eerste["reisaanvraag"], "docstatus", 1)
		frappe.set_user(ANNA)
		self.assertRaisesRegex(frappe.ValidationError, "al ingediend", self.boek, datum="2031-09-02")
		self.assertRaisesRegex(
			frappe.ValidationError, "al ingediend", roep, "km_rit_boeken", actie="verwijderen", rij=eerste["rij"]
		)

	def test_grenzen_aan_het_verzoek(self):
		frappe.set_user(ANNA)
		self.assertRaisesRegex(frappe.ValidationError, "Onbekende actie", roep, "km_rit_boeken", actie="wissen")
		self.assertRaisesRegex(frappe.ValidationError, "Kies een medewerker", roep, "km_rit_boeken")
		self.assertRaisesRegex(frappe.ValidationError, "Vul datum", self.boek, kilometers="0")
		self.assertRaisesRegex(frappe.ValidationError, "Onbekende medewerker", self.boek, employee="bestaat-niet")
