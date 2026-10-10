"""De serverfuncties die alleen ERPNext nodig hebben."""

import base64
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from y_next.tests.hulp import maak_bericht, maak_gebruiker, maak_mail, maak_medewerker, maak_postbus, roep

ANNA = "anna@voorbeeld.test"
BRAM = "bram@voorbeeld.test"
CARLA = "carla@voorbeeld.test"
PORTAAL = "portaal@voorbeeld.test"
BEHEER = "beheer@voorbeeld.test"

BERICHT = "/y-next#/messenger"

KORTE_NAMEN = [
	"mijn_postbussen",
	"mail_bijwerken",
	"mail_ophalen",
	"agenda_collegas",
	"berichten_collegas",
	"berichten_foto",
	"berichten_verwijderen",
	"y_next_mogelijkheden",
	"agenda_ophalen",
	"agenda_schrijven",
	"mail_afwezigheid",
	"mail_uitnodiging",
	"mail_verwijderen",
]

# Een afbeelding van 1 bij 1 pixel.
PNG = base64.b64decode(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


class ApiTestCase(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		maak_medewerker(ANNA, "Anna")
		maak_medewerker(BRAM, "Bram")
		maak_medewerker(CARLA, "Carla", status="Inactive")
		maak_gebruiker(PORTAAL, "Portaal")
		maak_gebruiker(BEHEER, "Beheer", rollen=("System Manager",))

	def tearDown(self):
		frappe.set_user("Administrator")


class TestRoutes(ApiTestCase):
	def test_korte_namen_wijzen_naar_app_code(self):
		routes = frappe.get_hooks("override_whitelisted_methods")
		for naam in KORTE_NAMEN:
			with self.subTest(naam=naam):
				doel = routes[naam][-1]
				self.assertTrue(doel.startswith("y_next.api."))
				self.assertIn(frappe.get_attr(doel), frappe.whitelisted)

	def test_gast_komt_er_niet_in(self):
		frappe.set_user("Guest")
		for naam in KORTE_NAMEN:
			with self.subTest(naam=naam):
				self.assertRaises(frappe.PermissionError, roep, naam)


class TestPostbussen(ApiTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.postbus = maak_postbus("Y Testpostbus", "postbus@voorbeeld.test", ANNA)

	def test_alleen_de_eigen_postbussen(self):
		frappe.set_user(ANNA)
		antwoord = roep("mijn_postbussen")
		self.assertEqual(antwoord["gebruiker"], ANNA)
		self.assertEqual(antwoord["postbussen"], [{"name": self.postbus, "email_id": "postbus@voorbeeld.test"}])
		self.assertFalse(antwoord["alles"])

		frappe.set_user(BRAM)
		self.assertEqual(roep("mijn_postbussen")["postbussen"], [])

	def test_beheerder_leest_alle_postbussen(self):
		frappe.set_user(BEHEER)
		self.assertTrue(roep("mijn_postbussen")["alles"])

	def test_ophalen_alleen_uit_eigen_postbussen(self):
		with patch("y_next.api.mail._ontvang", return_value=2) as ontvang:
			frappe.set_user(BRAM)
			self.assertEqual(
				roep("mail_ophalen", postbus=self.postbus), {"opgehaald": [], "mislukt": [], "nieuw": 0}
			)
			ontvang.assert_not_called()

			frappe.set_user(ANNA)
			antwoord = roep("mail_ophalen")
			ontvang.assert_called_once_with(self.postbus)
			self.assertEqual(antwoord["opgehaald"], [{"postbus": self.postbus, "nieuw": 2}])
			self.assertEqual(antwoord["nieuw"], 2)

			frappe.set_user(BEHEER)
			self.assertEqual(roep("mail_ophalen", postbus=self.postbus)["nieuw"], 2)

	def test_mislukt_ophalen_wordt_gemeld_en_stopt_de_rest_niet(self):
		frappe.set_user(ANNA)
		with patch("y_next.api.mail._ontvang", side_effect=Exception("verbinding geweigerd")):
			antwoord = roep("mail_ophalen")
		self.assertEqual(antwoord["opgehaald"], [])
		self.assertEqual(antwoord["mislukt"], [{"postbus": self.postbus, "reden": "verbinding geweigerd"}])


class TestMailBijwerken(ApiTestCase):
	def maak_mail(self) -> str:
		# Een geadresseerde met een komma in de naam: Frappe keurt zo'n adres af
		# bij gewoon opslaan.
		return maak_mail(recipients='"Achternaam, V. (Voornaam)" <ontvanger@voorbeeld.test>')

	def test_zet_alleen_de_gevraagde_velden(self):
		naam = self.maak_mail()
		frappe.set_user(BEHEER)
		antwoord = roep("mail_bijwerken", naam=naam, seen="1", status="Closed")
		self.assertEqual(antwoord, {"bericht": naam, "gewijzigd": {"seen": 1, "status": "Closed"}})
		self.assertEqual(
			frappe.db.get_value("Communication", naam, ["seen", "status", "subject"]),
			(1, "Closed", "Testbericht"),
		)

	def test_koppeling_zetten_en_weer_leegmaken(self):
		naam = self.maak_mail()
		frappe.set_user(BEHEER)
		roep("mail_bijwerken", naam=naam, reference_doctype="User", reference_name=ANNA)
		self.assertEqual(
			frappe.db.get_value("Communication", naam, ["reference_doctype", "reference_name"]),
			("User", ANNA),
		)
		roep("mail_bijwerken", naam=naam, reference_doctype="", reference_name="")
		self.assertEqual(
			frappe.db.get_value("Communication", naam, ["reference_doctype", "reference_name"]),
			("", ""),
		)

	def test_weigert_onbekende_waarden_en_lege_verzoeken(self):
		naam = self.maak_mail()
		frappe.set_user(BEHEER)
		self.assertRaises(frappe.ValidationError, roep, "mail_bijwerken", naam=naam, status="Verwijderd")
		self.assertRaises(frappe.ValidationError, roep, "mail_bijwerken", naam=naam, email_status="Weg")
		self.assertRaises(frappe.ValidationError, roep, "mail_bijwerken", naam=naam)
		self.assertRaises(frappe.ValidationError, roep, "mail_bijwerken", status="Closed")

	def test_zonder_schrijfrecht_op_het_bericht_gebeurt_er_niets(self):
		naam = self.maak_mail()
		for gebruiker in (PORTAAL, ANNA):
			with self.subTest(gebruiker=gebruiker):
				frappe.set_user(gebruiker)
				self.assertRaises(frappe.PermissionError, roep, "mail_bijwerken", naam=naam, seen="1")
		self.assertEqual(frappe.db.get_value("Communication", naam, "seen"), 0)


class TestCollegas(ApiTestCase):
	def test_agenda_geeft_actieve_medewerkers_met_naam_en_adres(self):
		frappe.set_user(ANNA)
		antwoord = roep("agenda_collegas")
		adressen = {collega["email"]: collega["naam"] for collega in antwoord["collegas"]}
		self.assertEqual(adressen[ANNA], "Anna")
		self.assertEqual(adressen[BRAM], "Bram")
		self.assertNotIn(CARLA, adressen)
		self.assertEqual(antwoord["aantal"], len(antwoord["collegas"]))
		self.assertEqual(set(antwoord["collegas"][0]), {"email", "naam"})

	def test_berichten_geeft_naam_foto_en_laatst_actief(self):
		frappe.set_user(BRAM)
		antwoord = roep("berichten_collegas")
		collegas = {collega["user"]: collega for collega in antwoord["collegas"]}
		self.assertIn(ANNA, collegas)
		self.assertNotIn(CARLA, collegas)
		self.assertEqual(set(collegas[ANNA]), {"user", "naam", "foto", "laatst_actief"})
		self.assertIsInstance(collegas[ANNA]["foto"], bool)
		self.assertRegex(antwoord["nu"], r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}")

	def test_zonder_medewerkersrol_geen_collegalijst(self):
		frappe.set_user(PORTAAL)
		self.assertRaises(frappe.PermissionError, roep, "agenda_collegas")
		self.assertRaises(frappe.PermissionError, roep, "berichten_collegas")
		self.assertRaises(frappe.PermissionError, roep, "berichten_foto", gebruiker=ANNA)


class TestFoto(ApiTestCase):
	def zet_foto(self, gebruiker: str, bestandsnaam: str) -> str:
		bestand = frappe.get_doc(
			{"doctype": "File", "file_name": bestandsnaam, "is_private": 1, "content": PNG}
		)
		bestand.insert(ignore_permissions=True)
		frappe.db.set_value("User", gebruiker, "user_image", bestand.file_url)
		return bestand.file_url

	def test_geeft_de_afgeschermde_foto_van_een_actieve_collega(self):
		self.zet_foto(ANNA, "y-test-foto.png")
		frappe.set_user(BRAM)
		roep("berichten_foto", gebruiker=ANNA)
		self.assertEqual(frappe.response["type"], "download")
		self.assertEqual(frappe.response["content_type"], "image/png")
		self.assertEqual(frappe.response["display_content_as"], "inline")
		self.assertEqual(frappe.response["filecontent"], PNG)

	def test_geen_foto_van_wie_geen_actieve_medewerker_is(self):
		frappe.set_user(BRAM)
		self.assertRaisesRegex(frappe.ValidationError, "Onbekende collega", roep, "berichten_foto", gebruiker=CARLA)
		self.assertRaisesRegex(frappe.ValidationError, "Onbekende collega", roep, "berichten_foto", gebruiker=PORTAAL)
		self.assertRaisesRegex(frappe.ValidationError, "Geen collega opgegeven", roep, "berichten_foto", gebruiker="")

	def test_alleen_rasterafbeeldingen(self):
		# Een SVG is een document dat script kan bevatten.
		frappe.db.set_value("User", ANNA, "user_image", "/private/files/y-test-foto.svg")
		frappe.set_user(BRAM)
		self.assertRaisesRegex(frappe.ValidationError, "Geen foto", roep, "berichten_foto", gebruiker=ANNA)

	def test_alleen_bestanden_van_deze_site(self):
		frappe.db.set_value("User", ANNA, "user_image", "https://elders.voorbeeld.test/foto.png")
		frappe.set_user(BRAM)
		self.assertRaisesRegex(frappe.ValidationError, "Geen foto", roep, "berichten_foto", gebruiker=ANNA)


class TestBerichtenVerwijderen(ApiTestCase):
	def gesprek(self, sleutel: str, tekst: str = "Hallo") -> tuple[str, str]:
		"""Anna stuurt Bram een bericht. Geeft (verzonden kopie, ontvangen kopie)."""
		link = f"{BERICHT}?k={sleutel}"
		ontvangen = maak_bericht(ANNA, BRAM, ANNA, tekst, link)
		verzonden = maak_bericht(ANNA, ANNA, BRAM, tekst, link)
		return verzonden, ontvangen

	def bestaat(self, naam: str) -> bool:
		return bool(frappe.db.exists("Notification Log", naam))

	def test_voor_mij_haalt_alleen_de_eigen_kopie_weg(self):
		verzonden, ontvangen = self.gesprek("sleutel-mij")
		frappe.set_user(BRAM)
		self.assertEqual(roep("berichten_verwijderen", naam=ontvangen), {"verwijderd": 1, "voor": "mij"})
		self.assertFalse(self.bestaat(ontvangen))
		self.assertTrue(self.bestaat(verzonden))

	def test_voor_iedereen_haalt_beide_kopieen_en_de_likes_weg(self):
		verzonden, ontvangen = self.gesprek("sleutel-allen")
		like = maak_bericht(BRAM, ANNA, BRAM, "like", f"{BERICHT}?reactie=sleutel-allen")
		ander = maak_bericht(ANNA, BRAM, ANNA, "Iets anders", f"{BERICHT}?k=andere-sleutel")
		frappe.set_user(ANNA)
		antwoord = roep("berichten_verwijderen", naam=verzonden, voor="iedereen")
		self.assertEqual(antwoord, {"verwijderd": 3, "voor": "iedereen"})
		for naam in (verzonden, ontvangen, like):
			self.assertFalse(self.bestaat(naam))
		self.assertTrue(self.bestaat(ander))

	def test_voor_iedereen_alleen_bij_eigen_berichten(self):
		verzonden, ontvangen = self.gesprek("sleutel-vreemd")
		frappe.set_user(BRAM)
		self.assertRaisesRegex(
			frappe.ValidationError,
			"Alleen je eigen berichten",
			roep,
			"berichten_verwijderen",
			naam=ontvangen,
			voor="iedereen",
		)
		self.assertTrue(self.bestaat(ontvangen))
		self.assertTrue(self.bestaat(verzonden))

	def test_alleen_wat_in_je_eigen_berichten_staat(self):
		verzonden, _ = self.gesprek("sleutel-eigen")
		frappe.set_user(BRAM)
		self.assertRaisesRegex(
			frappe.ValidationError, "niet in jouw berichten", roep, "berichten_verwijderen", naam=verzonden
		)
		self.assertTrue(self.bestaat(verzonden))

	def test_alleen_berichten_geen_andere_meldingen(self):
		melding = maak_bericht(ANNA, BRAM, ANNA, "Taak toegewezen", "/app/task/TASK-0001")
		frappe.set_user(BRAM)
		self.assertRaisesRegex(
			frappe.ValidationError, "Dit is geen bericht", roep, "berichten_verwijderen", naam=melding
		)
		self.assertTrue(self.bestaat(melding))

	def test_een_lijst_gaat_helemaal_of_niet(self):
		_, eerste = self.gesprek("sleutel-lijst-1")
		_, tweede = self.gesprek("sleutel-lijst-2")
		vreemd, _ = self.gesprek("sleutel-lijst-3")
		frappe.set_user(BRAM)
		self.assertRaises(
			frappe.ValidationError, roep, "berichten_verwijderen", namen=frappe.as_json([eerste, vreemd])
		)
		self.assertTrue(self.bestaat(eerste))
		self.assertEqual(roep("berichten_verwijderen", namen=frappe.as_json([eerste, tweede]))["verwijderd"], 2)
		self.assertFalse(self.bestaat(eerste))
		self.assertFalse(self.bestaat(tweede))

	def test_groepsbericht_verdwijnt_bij_alle_leden(self):
		link = f"{BERICHT}?k=sleutel-groep&g=team"
		eigen = maak_bericht(ANNA, ANNA, "groep:team", "Voor de groep", link)
		bij_bram = maak_bericht(ANNA, BRAM, "groep:team", "Voor de groep", link)
		frappe.set_user(ANNA)
		roep("berichten_verwijderen", naam=eigen, voor="iedereen")
		self.assertFalse(self.bestaat(eigen))
		self.assertFalse(self.bestaat(bij_bram))

	def test_grenzen_aan_het_verzoek(self):
		frappe.set_user(BRAM)
		self.assertRaises(frappe.ValidationError, roep, "berichten_verwijderen")
		self.assertRaises(frappe.ValidationError, roep, "berichten_verwijderen", naam="x", voor="alles")
		te_veel = frappe.as_json([f"n{i}" for i in range(501)])
		self.assertRaises(frappe.ValidationError, roep, "berichten_verwijderen", namen=te_veel)


class TestMogelijkheden(ApiTestCase):
	def test_meldt_wat_er_op_de_site_is(self):
		import y_next

		frappe.set_user(ANNA)
		antwoord = roep("y_next_mogelijkheden")
		geinstalleerd = frappe.get_installed_apps()
		self.assertEqual(antwoord["app_versie"], y_next.__version__)
		self.assertEqual(antwoord["apps"], {"hrms": "hrms" in geinstalleerd, "wiki": "wiki" in geinstalleerd})
		for doctype, aanwezig in antwoord["doctypes"].items():
			with self.subTest(doctype=doctype):
				self.assertEqual(aanwezig, bool(frappe.db.exists("DocType", doctype)))
		for doctype in ("Shift Plan", "Shift Plan Assignment", "Leave Application", "Wiki Page", "Lead Source"):
			self.assertIn(doctype, antwoord["doctypes"])
		self.assertEqual(
			set(antwoord),
			{"app_versie", "apps", "doctypes", "velden", "taak_workflow", "mailserver_ingesteld", "cad_viewer"},
		)

	def test_meldt_velden_die_niet_overal_bestaan(self):
		frappe.set_user(ANNA)
		velden = roep("y_next_mogelijkheden")["velden"]
		# Het veld workflow_state bestaat alleen als de site een workflow op dat doctype heeft.
		for doctype in ("Task", "Timesheet", "Sales Invoice", "Purchase Invoice"):
			with self.subTest(doctype=doctype):
				self.assertEqual(
					velden[doctype], {"workflow_state": bool(frappe.get_meta(doctype).has_field("workflow_state"))}
				)

	def test_taak_workflow_volgt_de_site(self):
		frappe.set_user(ANNA)
		self.assertEqual(
			roep("y_next_mogelijkheden")["taak_workflow"],
			bool(frappe.db.exists("Workflow", {"document_type": "Task", "is_active": 1})),
		)
		with patch("y_next.api.mogelijkheden._heeft_taak_workflow", return_value=True):
			self.assertTrue(roep("y_next_mogelijkheden")["taak_workflow"])

	def test_mailserver_telt_pas_als_hij_is_ingevuld_en_aanstaat(self):
		instelling = frappe.get_doc("Agenda Koppeling")
		instelling.update({"enabled": 0, "server_url": "", "service_account": ""})
		instelling.save(ignore_permissions=True)
		frappe.set_user(ANNA)
		self.assertFalse(roep("y_next_mogelijkheden")["mailserver_ingesteld"])

		frappe.set_user("Administrator")
		instelling.update(
			{"enabled": 1, "server_url": "https://mail.voorbeeld.test", "service_account": "agenda@voorbeeld.test"}
		)
		instelling.save(ignore_permissions=True)
		frappe.set_user(ANNA)
		antwoord = roep("y_next_mogelijkheden")
		self.assertTrue(antwoord["mailserver_ingesteld"])
		# Het adres en het account zelf gaan niet mee.
		self.assertNotIn("mail.voorbeeld.test", frappe.as_json(antwoord))

		frappe.set_user("Administrator")
		instelling.update({"enabled": 0})
		instelling.save(ignore_permissions=True)
		frappe.set_user(ANNA)
		self.assertFalse(roep("y_next_mogelijkheden")["mailserver_ingesteld"])
