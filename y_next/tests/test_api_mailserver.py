"""De serverfuncties die met de mailserver praten, getoetst tegen een nagespeelde server."""

import frappe
from frappe.tests import IntegrationTestCase

from y_next.tests.hulp import maak_gebruiker, maak_mail, maak_medewerker, maak_postbus, roep
from y_next.tests.nep_mailserver import BASIS, nep_mailserver

ANNA = "anna@voorbeeld.test"
BRAM = "bram@voorbeeld.test"
CARLA = "carla@voorbeeld.test"
PORTAAL = "portaal@voorbeeld.test"
BEHEER = "beheer@voorbeeld.test"
EXTERN = "klant@buiten.test"

JAAR = {"van": "2026-01-01T00:00:00Z", "tot": "2027-01-01T00:00:00Z"}


def deelnemer(adres: str, status: str = "needs-action", organisator: bool = False) -> dict:
	rij = {"email": adres, "name": adres.split("@")[0].title(), "participationStatus": status}
	if organisator:
		rij["roles"] = {"owner": True}
	return rij


def afspraak(uid: str, titel: str, start: str = "2026-10-05T09:00:00", **extra) -> dict:
	return {"uid": uid, "title": titel, "start": start, "duration": "PT1H", "timeZone": "Europe/Amsterdam", **extra}


def ics(uid: str, organisator: str, genodigden: tuple = ()) -> str:
	regels = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", f"UID:{uid}"]
	regels.append(f"ORGANIZER;CN=Organisator:mailto:{organisator}")
	regels += [f"ATTENDEE;PARTSTAT=NEEDS-ACTION:mailto:{adres}" for adres in genodigden]
	regels += ["END:VEVENT", "END:VCALENDAR"]
	return "\r\n".join(regels) + "\r\n"


class MailserverTestCase(IntegrationTestCase):
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


class TestAgendaOphalen(MailserverTestCase):
	def test_geeft_afspraken_plat_terug(self):
		with nep_mailserver(ANNA, BRAM) as server:
			server.afspraken[ANNA]["a1"] = afspraak(
				"uid-overleg",
				"Overleg",
				description="Deelnamelink",
				locations={"x9": {"name": ""}, "x1": {"name": "Kantoor"}},
				participants={
					"p1": deelnemer(ANNA, "accepted", organisator=True),
					"p2": {"calendarAddress": "mailto:" + EXTERN.upper(), "participationStatus": "tentative"},
				},
				recurrenceRule={"frequency": "weekly"},
				recurrenceOverrides={
					"2026-10-12T09:00:00": {"excluded": True},
					"2026-10-19T09:00:00": {"start": "2026-10-19T10:00:00", "duration": "PT30M"},
				},
				freeBusyStatus="busy",
				privacy="public",
			)
			server.afspraken[ANNA]["a2"] = afspraak(
				"uid-prive", "Tandarts", description="Niet voor collega's", privacy="private", showWithoutTime=True
			)
			frappe.set_user(BRAM)
			antwoord = roep("agenda_ophalen", gebruikers=ANNA, **JAAR)

		self.assertEqual((antwoord["aantal"], antwoord["gelezen"], antwoord["mislukt"]), (2, 1, []))
		overleg, prive = antwoord["afspraken"]
		self.assertEqual(
			{sleutel: overleg[sleutel] for sleutel in ("gebruiker", "id", "uid", "titel", "locatie", "omschrijving")},
			{
				"gebruiker": ANNA,
				"id": "a1",
				"uid": "uid-overleg",
				"titel": "Overleg",
				"locatie": "Kantoor",
				"omschrijving": "Deelnamelink",
			},
		)
		self.assertEqual(
			overleg["genodigden"],
			[
				{"email": ANNA, "naam": "Anna", "status": "accepted", "organisator": True},
				{"email": EXTERN, "naam": None, "status": "tentative", "organisator": False},
			],
		)
		self.assertTrue(overleg["herhaalt"])
		self.assertEqual(overleg["herhaling"], {"frequency": "weekly"})
		self.assertEqual(
			overleg["uitzonderingen"],
			{
				"2026-10-12T09:00:00": {"weg": True, "start": None, "duur": None},
				"2026-10-19T09:00:00": {"weg": False, "start": "2026-10-19T10:00:00", "duur": "PT30M"},
			},
		)
		# Wat er in een privé-afspraak staat, hoort niet bij collega's terecht te komen.
		self.assertEqual((prive["omschrijving"], prive["privacy"], prive["hele_dag"]), ("", "private", True))
		self.assertFalse(prive["herhaalt"])

	def test_wie_geen_postbus_heeft_komt_in_mislukt(self):
		with nep_mailserver(ANNA) as server:
			server.afspraken[ANNA]["a1"] = afspraak("uid-1", "Overleg")
			frappe.set_user(ANNA)
			antwoord = roep("agenda_ophalen", gebruikers=f"{BRAM}, {ANNA}", **JAAR)
		self.assertEqual((antwoord["aantal"], antwoord["gelezen"]), (1, 1))
		self.assertEqual(antwoord["mislukt"][0]["gebruiker"], BRAM)
		self.assertTrue(antwoord["mislukt"][0]["reden"].startswith("inloggen: "))

	def test_zonder_lijst_alle_actieve_medewerkers(self):
		with nep_mailserver(ANNA, BRAM, CARLA) as server:
			frappe.set_user(ANNA)
			roep("agenda_ophalen", **JAAR)
			gelezen = {namens for _, _, namens in server.verzoeken}
		self.assertIn(ANNA, gelezen)
		self.assertIn(BRAM, gelezen)
		self.assertNotIn(CARLA, gelezen)

	def test_alleen_voor_medewerkers_en_alleen_als_de_koppeling_aanstaat(self):
		with nep_mailserver(ANNA):
			frappe.set_user(PORTAAL)
			self.assertRaises(frappe.PermissionError, roep, "agenda_ophalen", **JAAR)
		with nep_mailserver(ANNA, ingeschakeld=False):
			frappe.set_user(ANNA)
			self.assertRaisesRegex(frappe.ValidationError, "staat uit", roep, "agenda_ophalen", **JAAR)


class TestAgendaSchrijven(MailserverTestCase):
	def test_opslaan_schrijft_bij_jezelf_en_bij_genodigde_collegas(self):
		with nep_mailserver(ANNA, BRAM, CARLA) as server:
			frappe.set_user(ANNA)
			antwoord = roep(
				"agenda_schrijven",
				uid="uid met/tekens",
				ics=ics("uid met/tekens", ANNA, (BRAM, EXTERN)),
				agendas=f"{ANNA}, {BRAM.upper()}, {EXTERN}, {CARLA}",
			)
			self.assertEqual(antwoord["actie"], "opslaan")
			self.assertEqual(antwoord["bestand"], "uid-met-tekens.ics")
			self.assertEqual(antwoord["geschreven"], [ANNA, BRAM])
			# Een genodigde van buiten krijgt de uitnodiging per e-mail; Carla is niet genodigd.
			self.assertEqual(antwoord["extern"], [EXTERN])
			self.assertEqual(antwoord["mislukt"], [])
			for agenda in (ANNA, BRAM):
				self.assertIn("UID:uid met/tekens", server.bestanden[server.agendabestand(agenda, "uid-met-tekens.ics")])
			self.assertNotIn(server.agendabestand(CARLA, "uid-met-tekens.ics"), server.bestanden)

	def test_opslaan_alleen_namens_jezelf(self):
		with nep_mailserver(ANNA, BRAM) as server:
			frappe.set_user(ANNA)
			self.assertRaisesRegex(
				frappe.ValidationError,
				"namens jezelf",
				roep,
				"agenda_schrijven",
				uid="uid-1",
				ics=ics("uid-1", BRAM, (ANNA,)),
				agendas=BRAM,
			)
			self.assertEqual(server.bestanden, {})

	def test_antwoorden_raakt_je_eigen_agenda_en_die_van_de_organisator(self):
		with nep_mailserver(ANNA, BRAM) as server:
			frappe.set_user(BRAM)
			antwoord = roep(
				"agenda_schrijven", actie="antwoorden", uid="uid-2", ics=ics("uid-2", ANNA, (BRAM,)), agendas=f"{BRAM},{ANNA}"
			)
			self.assertEqual(antwoord["geschreven"], [BRAM, ANNA])
			self.assertEqual(len(server.bestanden), 2)

			self.assertRaisesRegex(
				frappe.ValidationError,
				"niet als genodigde",
				roep,
				"agenda_schrijven",
				actie="antwoorden",
				uid="uid-3",
				ics=ics("uid-3", ANNA, (CARLA,)),
				agendas=ANNA,
			)

	def test_inplannen_en_lezen_alleen_in_de_eigen_agenda(self):
		with nep_mailserver(ANNA, BRAM) as server:
			frappe.set_user(BRAM)
			inhoud = ics("uid-4", EXTERN, (BRAM,))
			antwoord = roep("agenda_schrijven", actie="inplannen", uid="uid-4", ics=inhoud, agendas=ANNA)
			self.assertEqual(antwoord["geschreven"], [BRAM])
			self.assertEqual(list(server.bestanden), [server.agendabestand(BRAM, "uid-4.ics")])

			gelezen = roep("agenda_schrijven", actie="lezen", uid="uid-4", agendas=ANNA)
			self.assertEqual(gelezen["ics"], inhoud)
			self.assertEqual(gelezen["geschreven"], [BRAM])

	def test_deelname_zet_alleen_je_eigen_antwoord(self):
		with nep_mailserver(ANNA, BRAM) as server:
			server.afspraken[BRAM]["b1"] = afspraak(
				"uid-5",
				"Overleg",
				participants={"p1": deelnemer(ANNA, "accepted", organisator=True), "p2": deelnemer(BRAM)},
			)
			frappe.set_user(BRAM)
			antwoord = roep("agenda_schrijven", actie="deelname", uid="uid-5", stand="accepted")
			self.assertEqual(
				antwoord,
				{"actie": "deelname", "uid": "uid-5", "stand": "accepted", "gelukt": True, "reden": None, "titel": "Overleg"},
			)
			deelnemers = server.afspraken[BRAM]["b1"]["participants"]
			self.assertEqual(deelnemers["p2"]["participationStatus"], "accepted")
			self.assertIs(deelnemers["p2"]["expectReply"], False)
			self.assertEqual(deelnemers["p1"], deelnemer(ANNA, "accepted", organisator=True))

			self.assertRaisesRegex(
				frappe.ValidationError, "Onbekend antwoord", roep, "agenda_schrijven", actie="deelname", uid="uid-5", stand="misschien"
			)
			server.afspraken[BRAM]["b2"] = afspraak("uid-6", "Zonder mij", participants={"p1": deelnemer(ANNA)})
			self.assertRaisesRegex(
				frappe.ValidationError, "niet als genodigde", roep, "agenda_schrijven", actie="deelname", uid="uid-6", stand="declined"
			)
			self.assertRaisesRegex(
				frappe.ValidationError, "niet in je agenda", roep, "agenda_schrijven", actie="deelname", uid="uid-onbekend", stand="declined"
			)

	def gedeelde_afspraak(self, server, uid: str, **extra):
		deelnemers = {"p1": deelnemer(ANNA, "accepted", organisator=True), "p2": deelnemer(BRAM, "accepted")}
		server.afspraken[ANNA]["a-" + uid] = afspraak(uid, "Overleg", participants=dict(deelnemers), **extra)
		server.afspraken[BRAM]["b-" + uid] = afspraak(uid, "Overleg", participants=dict(deelnemers), **extra)

	def test_bijwerken_als_organisator_ook_bij_genodigden(self):
		with nep_mailserver(ANNA, BRAM) as server:
			self.gedeelde_afspraak(server, "uid-7")
			frappe.set_user(ANNA)
			antwoord = roep(
				"agenda_schrijven",
				actie="bijwerken",
				uid="uid-7",
				titel="Verzet overleg",
				start="2026-10-06T14:00:00",
				locatie="Zaal 2",
				agendas=f"{ANNA},{BRAM},{EXTERN}",
			)
			self.assertEqual(
				antwoord,
				{
					"actie": "bijwerken",
					"uid": "uid-7",
					"geschreven": [ANNA, BRAM],
					"mislukt": [],
					"extern": [EXTERN],
					"organisator": True,
				},
			)
			for agenda, sleutel in ((ANNA, "a-uid-7"), (BRAM, "b-uid-7")):
				bijgewerkt = server.afspraken[agenda][sleutel]
				self.assertEqual((bijgewerkt["title"], bijgewerkt["start"]), ("Verzet overleg", "2026-10-06T14:00:00"))
				self.assertEqual(bijgewerkt["locations"], {"l1": {"@type": "Location", "name": "Zaal 2"}})
				# Wat niet is meegegeven, blijft staan.
				self.assertEqual(bijgewerkt["duration"], "PT1H")

	def test_bijwerken_als_genodigde_alleen_in_de_eigen_agenda(self):
		with nep_mailserver(ANNA, BRAM) as server:
			self.gedeelde_afspraak(server, "uid-8")
			frappe.set_user(BRAM)
			antwoord = roep("agenda_schrijven", actie="bijwerken", uid="uid-8", titel="Mijn titel", agendas=f"{BRAM},{ANNA}")
			self.assertEqual((antwoord["geschreven"], antwoord["organisator"]), ([BRAM], False))
			self.assertEqual(server.afspraken[ANNA]["a-uid-8"]["title"], "Overleg")
			self.assertEqual(server.afspraken[BRAM]["b-uid-8"]["title"], "Mijn titel")

			self.assertRaisesRegex(
				frappe.ValidationError, "niets om bij te werken", roep, "agenda_schrijven", actie="bijwerken", uid="uid-8"
			)

	def test_een_reeks_verzet_je_niet_vanuit_de_app(self):
		with nep_mailserver(ANNA, BRAM) as server:
			self.gedeelde_afspraak(server, "uid-9", recurrenceRule={"frequency": "weekly"})
			frappe.set_user(ANNA)
			self.assertRaisesRegex(
				frappe.ValidationError,
				"herhalende afspraak",
				roep,
				"agenda_schrijven",
				actie="bijwerken",
				uid="uid-9",
				start="2026-10-06T14:00:00",
			)
			self.assertEqual(server.afspraken[ANNA]["a-uid-9"]["start"], "2026-10-05T09:00:00")

	def test_verwijderen_als_organisator_ook_bij_genodigden(self):
		with nep_mailserver(ANNA, BRAM) as server:
			self.gedeelde_afspraak(server, "uid-10")
			frappe.set_user(ANNA)
			antwoord = roep("agenda_schrijven", actie="verwijderen", uid="uid-10", agendas=f"{ANNA},{BRAM},{EXTERN}")
			self.assertEqual(
				antwoord,
				{
					"actie": "verwijderen",
					"uid": "uid-10",
					"geschreven": [ANNA, BRAM],
					"mislukt": [],
					"extern": [EXTERN],
					"organisator": True,
					"herhaalt": False,
				},
			)
			self.assertEqual((server.afspraken[ANNA], server.afspraken[BRAM]), ({}, {}))

	def test_verwijderen_als_genodigde_alleen_bij_jezelf(self):
		with nep_mailserver(ANNA, BRAM) as server:
			self.gedeelde_afspraak(server, "uid-11")
			frappe.set_user(BRAM)
			antwoord = roep("agenda_schrijven", actie="verwijderen", uid="uid-11", agendas=f"{BRAM},{ANNA}")
			self.assertEqual((antwoord["geschreven"], antwoord["organisator"]), ([BRAM], False))
			self.assertIn("a-uid-11", server.afspraken[ANNA])
			self.assertEqual(server.afspraken[BRAM], {})

	def test_grenzen_aan_het_verzoek(self):
		with nep_mailserver(ANNA):
			frappe.set_user(ANNA)
			self.assertRaisesRegex(frappe.ValidationError, "Onbekende actie", roep, "agenda_schrijven", actie="wissen", uid="x")
			self.assertRaisesRegex(frappe.ValidationError, "Geen afspraak opgegeven", roep, "agenda_schrijven", actie="lezen")
			self.assertRaisesRegex(frappe.ValidationError, "Geen afspraakgegevens", roep, "agenda_schrijven", uid="x")
			frappe.set_user(PORTAAL)
			self.assertRaises(frappe.PermissionError, roep, "agenda_schrijven", actie="lezen", uid="x")


class TestAfwezigheid(MailserverTestCase):
	def test_lezen_en_opslaan_van_de_eigen_melding(self):
		with nep_mailserver(ANNA, BRAM) as server:
			frappe.set_user(ANNA)
			self.assertEqual(
				roep("mail_afwezigheid"),
				{"aan": False, "van": None, "tot": None, "onderwerp": "", "tekst": "", "html": ""},
			)
			antwoord = roep(
				"mail_afwezigheid",
				actie="opslaan",
				aan="1",
				van="2026-10-12T00:00:00Z",
				tot="2026-10-19T00:00:00Z",
				onderwerp="Afwezig",
				tekst=" Ik ben er even niet. ",
			)
			self.assertEqual(
				antwoord,
				{
					"aan": True,
					"van": "2026-10-12T00:00:00Z",
					"tot": "2026-10-19T00:00:00Z",
					"onderwerp": "Afwezig",
					"tekst": "Ik ben er even niet.",
					"html": "",
				},
			)
			self.assertTrue(server.afwezig[ANNA]["isEnabled"])
			# Er is geen manier om de melding van een collega te zetten.
			self.assertFalse(server.afwezig[BRAM]["isEnabled"])

			uit = roep("mail_afwezigheid", actie="opslaan", aan="0")
			self.assertEqual((uit["aan"], uit["van"], uit["onderwerp"]), (False, None, ""))

	def test_weigert_een_einde_voor_het_begin_en_onbekende_acties(self):
		with nep_mailserver(ANNA) as server:
			frappe.set_user(ANNA)
			self.assertRaisesRegex(
				frappe.ValidationError,
				"einddatum",
				roep,
				"mail_afwezigheid",
				actie="opslaan",
				aan="1",
				van="2026-10-19T00:00:00Z",
				tot="2026-10-12T00:00:00Z",
			)
			self.assertFalse(server.afwezig[ANNA]["isEnabled"])
			self.assertRaisesRegex(frappe.ValidationError, "Onbekende actie", roep, "mail_afwezigheid", actie="wissen")

	def test_zonder_postbus_op_de_mailserver(self):
		with nep_mailserver(ANNA):
			frappe.set_user(BRAM)
			self.assertRaisesRegex(frappe.ValidationError, "kent geen postbus", roep, "mail_afwezigheid")


class TestPost(MailserverTestCase):
	"""Uitnodigingen ophalen en verwijderen laten doorwerken op de mailserver."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.postbus = maak_postbus("Y Testpostbus Anna", "anna-post@voorbeeld.test", ANNA)

	def uitnodiging(self, server) -> str:
		"""Een uitnodiging in de postbus van Anna, met een naamgenoot die er niet op lijkt."""
		server.mails[ANNA]["m1"] = {
			"subject": "Overleg",
			"from": EXTERN,
			"messageId": ["uitnodiging@buiten.test"],
			"mailboxIds": {"postvak-in": True},
			"bodyStructure": {
				"type": "multipart/mixed",
				"subParts": [
					{"type": "text/plain", "blobId": "tekst"},
					{"type": "multipart/alternative", "subParts": [{"type": "text/calendar", "blobId": "agenda"}]},
				],
			},
		}
		server.mails[ANNA]["m2"] = {
			"subject": "Overleg",
			"from": EXTERN,
			"messageId": ["ander-bericht@buiten.test"],
			"mailboxIds": {"postvak-in": True},
			"bodyStructure": {"type": "text/plain", "blobId": "tekst"},
		}
		server.blobs["agenda"] = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"
		return maak_mail(self.postbus, subject="Overleg", sender=EXTERN, message_id="<uitnodiging@buiten.test>")

	def test_uitnodiging_geeft_het_agendadeel_van_precies_dit_bericht(self):
		with nep_mailserver(ANNA, BRAM) as server:
			naam = self.uitnodiging(server)
			frappe.set_user(ANNA)
			self.assertEqual(
				roep("mail_uitnodiging", communication=naam),
				{"communication": naam, "gevonden": True, "ics": "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", "reden": None},
			)

			zonder = maak_mail(self.postbus, subject="Overleg", sender=EXTERN, message_id="<ander-bericht@buiten.test>")
			self.assertEqual(
				roep("mail_uitnodiging", communication=zonder),
				{"communication": zonder, "gevonden": False, "ics": None, "reden": None},
			)

	def test_uitnodiging_alleen_uit_een_eigen_postbus(self):
		with nep_mailserver(ANNA, BRAM) as server:
			naam = self.uitnodiging(server)
			frappe.set_user(BRAM)
			self.assertRaisesRegex(
				frappe.ValidationError, "niet in een postbus van jou", roep, "mail_uitnodiging", communication=naam
			)
			frappe.set_user("Administrator")
			self.assertRaisesRegex(
				frappe.ValidationError, "gewoon gebruikersaccount", roep, "mail_uitnodiging", communication=naam
			)

	def test_naar_de_prullenbak_en_definitief_weg(self):
		with nep_mailserver(ANNA, BRAM) as server:
			naam = self.uitnodiging(server)
			frappe.set_user(ANNA)
			antwoord = roep("mail_verwijderen", actie="prullenbak", namen=naam)
			self.assertEqual(
				antwoord,
				{"actie": "prullenbak", "verwerkt": 1, "aangeboden": 1, "nietgevonden": [], "overgeslagen": [], "fouten": []},
			)
			self.assertEqual(server.mails[ANNA]["m1"]["mailboxIds"], {"prullenbak": True})
			# De naamgenoot met hetzelfde onderwerp en dezelfde afzender blijft waar hij was.
			self.assertEqual(server.mails[ANNA]["m2"]["mailboxIds"], {"postvak-in": True})

			antwoord = roep("mail_verwijderen", namen=naam)
			self.assertEqual((antwoord["actie"], antwoord["verwerkt"]), ("definitief", 1))
			self.assertNotIn("m1", server.mails[ANNA])
			self.assertIn("m2", server.mails[ANNA])

	def test_verwijderen_raadt_niet_en_blijft_van_andermans_post_af(self):
		with nep_mailserver(ANNA, BRAM) as server:
			naam = self.uitnodiging(server)
			onbekend = maak_mail(self.postbus, subject="Overleg", sender=EXTERN, message_id="<staat-er-niet@buiten.test>")
			zonder_id = maak_mail(self.postbus, subject="Overleg", sender=EXTERN)

			frappe.set_user(ANNA)
			antwoord = roep("mail_verwijderen", namen=f"{onbekend}, {zonder_id}, bestaat-niet")
			self.assertEqual(antwoord["verwerkt"], 0)
			self.assertEqual(antwoord["nietgevonden"], [onbekend])
			self.assertEqual(
				antwoord["overgeslagen"],
				[
					{"bericht": zonder_id, "reden": "geen message-id"},
					{"bericht": "bestaat-niet", "reden": "bestaat niet"},
				],
			)
			self.assertEqual(len(server.mails[ANNA]), 2)

			frappe.set_user(BRAM)
			antwoord = roep("mail_verwijderen", namen=naam)
			self.assertEqual(antwoord["overgeslagen"], [{"bericht": naam, "reden": "niet jouw postbus"}])
			self.assertEqual((antwoord["verwerkt"], antwoord["aangeboden"]), (0, 0))
			self.assertEqual(len(server.mails[ANNA]), 2)

	def test_grenzen_aan_het_verzoek(self):
		with nep_mailserver(ANNA):
			frappe.set_user(ANNA)
			self.assertRaisesRegex(frappe.ValidationError, "Geen berichten opgegeven", roep, "mail_verwijderen")
			self.assertRaisesRegex(frappe.ValidationError, "Onbekende actie", roep, "mail_verwijderen", actie="weg", namen="x")
			self.assertRaisesRegex(frappe.ValidationError, "Geen bericht opgegeven", roep, "mail_uitnodiging")
			self.assertRaisesRegex(frappe.ValidationError, "bestaat niet", roep, "mail_uitnodiging", communication="bestaat-niet")
