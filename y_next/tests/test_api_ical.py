"""De agenda als iCal-abonnement, via een deellink."""

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase
from frappe.utils import add_days, today

from y_next.tests.hulp import maak_medewerker, roep
from y_next.tests.nep_mailserver import nep_mailserver

ANNA = "anna@voorbeeld.test"
BRAM = "bram@voorbeeld.test"


def dag(verschuiving: int, tijd: str = "09:00:00") -> str:
	return f"{add_days(today(), verschuiving)}T{tijd}"


def afspraak(uid: str, titel: str, start: str, **extra) -> dict:
	return {"uid": uid, "title": titel, "start": start, "duration": "PT1H", "timeZone": "Europe/Amsterdam", **extra}


def deellink(gebruiker: str, **extra) -> "frappe.model.document.Document":
	link = frappe.get_doc({"doctype": "Y Agenda Deellink", "gebruiker": gebruiker, **extra})
	link.insert(ignore_permissions=True)
	return link


class TestDeellink(IntegrationTestCase):
	def test_krijgt_bij_aanmaken_een_lange_onvoorspelbare_code(self):
		maak_medewerker(ANNA, "Anna")
		eerste = deellink(ANNA)
		tweede = deellink(ANNA)
		self.assertRegex(eerste.code, r"^[A-Za-z0-9_-]{40,}$")
		self.assertNotEqual(eerste.code, tweede.code)

	def test_code_is_niet_van_buitenaf_te_kiezen_of_te_wijzigen(self):
		maak_medewerker(ANNA, "Anna")
		link = deellink(ANNA, code="zelfgekozen")
		self.assertNotEqual(link.code, "zelfgekozen")
		oorspronkelijk = link.code
		link.code = "aangepast"
		link.save(ignore_permissions=True)
		self.assertEqual(frappe.db.get_value("Y Agenda Deellink", link.name, "code"), oorspronkelijk)


class TestAgendaIcal(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		maak_medewerker(ANNA, "Anna")
		maak_medewerker(BRAM, "Bram")

	def tearDown(self):
		frappe.set_user("Administrator")

	def haal(self, code: str) -> str:
		frappe.set_user("Guest")
		roep("agenda_ical", t=code)
		self.assertEqual(frappe.response["type"], "download")
		self.assertEqual(frappe.response["filename"], "agenda.ics")
		return frappe.response["filecontent"]

	def test_geeft_de_agenda_van_de_eigenaar_van_de_link(self):
		link = deellink(ANNA)
		with nep_mailserver(ANNA, BRAM) as server:
			server.afspraken[ANNA]["a1"] = afspraak(
				"uid-overleg", "Overleg; met, tekens", dag(3), locations={"l": {"name": "Kantoor"}}, description="Deelnamelink"
			)
			server.afspraken[BRAM]["b1"] = afspraak("uid-bram", "Van Bram", dag(3))
			ics = self.haal(link.code)
			namens = {wie for _, _, wie in server.verzoeken}

		self.assertEqual(namens, {ANNA})
		self.assertTrue(ics.startswith("BEGIN:VCALENDAR\r\n"))
		self.assertTrue(ics.endswith("END:VCALENDAR\r\n"))
		self.assertIn("X-WR-CALNAME:Agenda Anna\r\n", ics)
		self.assertIn("UID:uid-overleg\r\n", ics)
		self.assertIn("SUMMARY:Overleg\\; met\\, tekens\r\n", ics)
		self.assertIn("LOCATION:Kantoor\r\n", ics)
		self.assertIn(f"DTSTART;TZID=Europe/Amsterdam:{dag(3).replace('-', '').replace(':', '')}\r\n", ics)
		self.assertIn("DURATION:PT1H\r\n", ics)
		self.assertNotIn("uid-bram", ics)
		# Geen omschrijving: daar staan deelnamelinks en interne notities in.
		self.assertNotIn("Deelnamelink", ics)
		self.assertNotIn("DESCRIPTION", ics)

	def test_prive_wordt_bezet_en_afgezegd_of_afgewezen_komt_er_niet_in(self):
		link = deellink(ANNA)
		with nep_mailserver(ANNA) as server:
			server.afspraken[ANNA]["a1"] = afspraak(
				"uid-prive", "Tandarts", dag(1), privacy="private", locations={"l": {"name": "Praktijk"}}
			)
			server.afspraken[ANNA]["a2"] = afspraak("uid-afgezegd", "Afgezegd", dag(2), status="cancelled")
			server.afspraken[ANNA]["a3"] = afspraak(
				"uid-afgewezen",
				"Afgewezen",
				dag(2),
				participants={"p": {"calendarAddress": "mailto:" + ANNA, "participationStatus": "declined"}},
			)
			ics = self.haal(link.code)

		self.assertIn("UID:uid-prive\r\n", ics)
		self.assertIn("SUMMARY:Bezet\r\n", ics)
		self.assertIn("CLASS:PRIVATE\r\n", ics)
		self.assertNotIn("Tandarts", ics)
		self.assertNotIn("Praktijk", ics)
		self.assertNotIn("uid-afgezegd", ics)
		self.assertNotIn("uid-afgewezen", ics)

	def test_reeks_met_uitzonderingen_en_hele_dag(self):
		link = deellink(ANNA)
		weg = dag(10)
		verzet = dag(17)
		with nep_mailserver(ANNA) as server:
			server.afspraken[ANNA]["a1"] = afspraak(
				"uid-reeks",
				"Weekstart",
				dag(3),
				recurrenceRule={"frequency": "weekly", "interval": 2, "byDay": [{"day": "mo"}, {"day": "fr", "nthOfPeriod": -1}], "count": 10},
				recurrenceOverrides={weg: {"excluded": True}, verzet: {"start": dag(17, "11:00:00"), "title": "Later"}},
			)
			server.afspraken[ANNA]["a2"] = afspraak("uid-dag", "Vrij", dag(5, "00:00:00"), isAllDay=True, duration="P2W1D", timeZone=None)
			ics = self.haal(link.code)

		kaal = lambda stempel: stempel.replace("-", "").replace(":", "")
		self.assertIn("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,-1FR;COUNT=10\r\n", ics)
		self.assertIn(f"EXDATE;TZID=Europe/Amsterdam:{kaal(weg)}\r\n", ics)
		self.assertIn(f"RECURRENCE-ID;TZID=Europe/Amsterdam:{kaal(verzet)}\r\n", ics)
		self.assertIn(f"DTSTART;TZID=Europe/Amsterdam:{kaal(dag(17, '11:00:00'))}\r\n", ics)
		self.assertIn("SUMMARY:Later\r\n", ics)
		self.assertEqual(ics.count("UID:uid-reeks\r\n"), 2)
		# Een hele dag heeft alleen een datum; weken en dagen samen mag in iCalendar niet.
		self.assertIn(f"DTSTART;VALUE=DATE:{kaal(dag(5, ''))[:8]}\r\n", ics)
		self.assertIn("DURATION:P15D\r\n", ics)

	def test_beschrijft_de_gebruikte_tijdzone_en_vouwt_lange_regels(self):
		link = deellink(ANNA)
		with nep_mailserver(ANNA) as server:
			server.afspraken[ANNA]["a1"] = afspraak("uid-lang", "Een hele lange titel " * 6, dag(3))
			ics = self.haal(link.code)

		self.assertIn("BEGIN:VTIMEZONE\r\nTZID:Europe/Amsterdam\r\n", ics)
		self.assertIn("RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\n", ics)
		self.assertIn("RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\n", ics)
		self.assertIn("TZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\n", ics)
		for regel in ics.split("\r\n"):
			self.assertLessEqual(len(regel), 75)
		self.assertIn("\r\n ", ics)

	def test_zonder_geldige_link_geen_agenda(self):
		link = deellink(ANNA)
		uit = deellink(ANNA, actief=0)
		with nep_mailserver(ANNA) as server:
			frappe.set_user("Guest")
			for code in ("", "bestaat-niet", uit.code, link.code[:-1]):
				with self.subTest(code=code[:6]):
					self.assertRaises(frappe.PermissionError, roep, "agenda_ical", t=code)
			self.assertEqual(server.verzoeken, [])

	def test_alleen_als_de_koppeling_aanstaat(self):
		link = deellink(ANNA)
		with nep_mailserver(ANNA, ingeschakeld=False):
			frappe.set_user("Guest")
			self.assertRaisesRegex(frappe.ValidationError, "staat uit", roep, "agenda_ical", t=link.code)


class TestTijdzoneblok(UnitTestCase):
	def test_zone_zonder_zomertijd_heeft_een_enkele_standaardtijd(self):
		from y_next.api.mailserver.ical import tijdzoneblok

		blok = tijdzoneblok("Asia/Tokyo", 2026)
		self.assertEqual(blok[0:2], ["BEGIN:VTIMEZONE", "TZID:Asia/Tokyo"])
		self.assertIn("TZOFFSETTO:+0900", blok)
		self.assertNotIn("BEGIN:DAYLIGHT", blok)

	def test_onbekende_zone_levert_niets_op(self):
		from y_next.api.mailserver.ical import tijdzoneblok

		self.assertEqual(tijdzoneblok("Nergens/Bestaat", 2026), [])
		self.assertEqual(tijdzoneblok("", 2026), [])

	def test_zone_op_het_zuidelijk_halfrond(self):
		from y_next.api.mailserver.ical import tijdzoneblok

		blok = "\r\n".join(tijdzoneblok("Australia/Sydney", 2026))
		self.assertIn("RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU", blok)
		self.assertIn("RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU", blok)


class TestDuur(UnitTestCase):
	def test_weken_worden_dagen_als_er_meer_bij_staat(self):
		from y_next.api.mailserver.ical import duur

		self.assertEqual(duur("P2W1DT15H", "PT1H"), "P15DT15H")
		self.assertEqual(duur("P1WT2H", "PT1H"), "P7DT2H")
		self.assertEqual(duur("P2W", "PT1H"), "P2W")
		self.assertEqual(duur("PT30M", "PT1H"), "PT30M")
		self.assertEqual(duur(None, "PT1H"), "PT1H")
