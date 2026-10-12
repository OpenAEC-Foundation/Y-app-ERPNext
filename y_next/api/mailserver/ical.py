"""De agenda als iCal-abonnement, voor wie zelf geen account op de mailserver heeft.

Een agenda-app haalt de link periodiek op. Er is geen inlog: wie de link
heeft, ziet de agenda. Daarom werkt hij alleen met de lange geheime code van
een `Y Agenda Deellink`. Een link intrekken is dat document uitzetten of
verwijderen.

Wat erin staat: titel, tijd en locatie. Geen omschrijving (daar staan
deelnamelinks en interne notities in) en geen genodigden. Een privé-afspraak
heet alleen "Bezet". Afgezegde afspraken en afspraken die de eigenaar heeft
afgewezen, komen er niet in.
"""

import calendar
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import add_days, get_system_timezone, now_datetime, today

from y_next.api.mailserver.client import AGENDA, Mailserver

WEEKDAGEN = ("MO", "TU", "WE", "TH", "FR", "SA", "SU")
UTC_ZONES = ("Etc/UTC", "UTC", "Etc/GMT", "GMT")


def _tekst(waarde) -> str:
	"""Een tekstwaarde zoals iCalendar hem wil: met de bijzondere tekens ontweken."""
	waarde = str(waarde or "")
	waarde = waarde.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
	return waarde.replace("\r", "").replace("\n", "\\n")


def _stempel(lokaal) -> str:
	"""Van "2026-10-05T09:00:00" naar "20261005T090000"."""
	return str(lokaal or "")[:19].replace("-", "").replace(":", "")


def _tijdregel(naam: str, lokaal, zone: str, hele_dag: bool) -> str:
	if hele_dag:
		return f"{naam};VALUE=DATE:{_stempel(lokaal)[:8]}"
	if zone in UTC_ZONES:
		return f"{naam}:{_stempel(lokaal)}Z"
	if zone:
		return f"{naam};TZID={zone}:{_stempel(lokaal)}"
	return f"{naam}:{_stempel(lokaal)}"


def duur(waarde, standaard: str) -> str:
	"""De duur van een afspraak. iCalendar staat weken niet samen met dagen of uren toe: "P2W1DT15H" wordt "P15DT15H"."""
	waarde = str(waarde or standaard)
	if "W" not in waarde or waarde.endswith("W"):
		return waarde
	weken, rest = waarde[1:].split("W", 1)
	dagen = int(weken) * 7
	if "D" in rest.split("T")[0]:
		extra, rest = rest.split("D", 1)
		dagen += int(extra)
	return f"P{dagen}D{rest}"


def _herhaling(regel: dict | None, hele_dag: bool) -> str | None:
	if not regel:
		return None
	delen = ["FREQ=" + str(regel.get("frequency") or "weekly").upper()]
	if regel.get("interval") and int(regel.get("interval")) > 1:
		delen.append(f"INTERVAL={regel.get('interval')}")
	dagen = []
	for dag in regel.get("byDay") or []:
		nummer = dag.get("nthOfPeriod")
		dagen.append((str(nummer) if nummer else "") + str(dag.get("day") or "").upper())
	if dagen:
		delen.append("BYDAY=" + ",".join(dagen))
	for sleutel, naam in (("byMonthDay", "BYMONTHDAY"), ("byMonth", "BYMONTH"), ("bySetPosition", "BYSETPOS")):
		if regel.get(sleutel):
			delen.append(naam + "=" + ",".join(str(waarde) for waarde in regel.get(sleutel)))
	if regel.get("count"):
		delen.append(f"COUNT={regel.get('count')}")
	elif regel.get("until"):
		grens = _stempel(regel.get("until"))
		delen.append("UNTIL=" + (grens[:8] if hele_dag else grens + "Z"))
	return "RRULE:" + ";".join(delen)


def _afgewezen(afspraak: dict, eigenaar: str) -> bool:
	for deelnemer in (afspraak.get("participants") or {}).values():
		adres = (deelnemer.get("email") or deelnemer.get("calendarAddress") or "").lower().replace("mailto:", "")
		if adres == eigenaar and deelnemer.get("participationStatus") == "declined":
			return True
	return False


def _locatie(afspraak: dict) -> str:
	for plaats in (afspraak.get("locations") or {}).values():
		if (plaats or {}).get("name"):
			return plaats.get("name")
	return ""


def _verschuiving(verschil: timedelta) -> str:
	minuten = int(verschil.total_seconds() // 60)
	teken = "-" if minuten < 0 else "+"
	return f"{teken}{abs(minuten) // 60:02d}{abs(minuten) % 60:02d}"


def tijdzoneblok(zone: str, jaar: int) -> list[str]:
	"""De beschrijving van een tijdzone (VTIMEZONE), afgeleid uit de overgangen in `jaar`.

	Een agenda-app heeft die nodig om een tijd met `TZID` te plaatsen. De
	overgangen naar zomer- en wintertijd worden als jaarlijkse regel
	beschreven ("de laatste zondag van maart"), zodat ook een reeks die jaren
	doorloopt goed blijft staan. Een onbekende zone levert niets op.
	"""
	if not zone:
		return []
	try:
		tz = ZoneInfo(zone)
	except Exception:
		return []

	overgangen = []
	moment = datetime(jaar, 1, 1, tzinfo=timezone.utc)
	vorige = moment.astimezone(tz).utcoffset()
	while moment.year == jaar:
		moment += timedelta(hours=1)
		verschuiving = moment.astimezone(tz).utcoffset()
		if verschuiving != vorige:
			overgangen.append((moment, vorige, verschuiving))
			vorige = verschuiving

	regels = ["BEGIN:VTIMEZONE", f"TZID:{zone}"]
	if not overgangen:
		regels += [
			"BEGIN:STANDARD",
			f"TZOFFSETFROM:{_verschuiving(vorige)}",
			f"TZOFFSETTO:{_verschuiving(vorige)}",
			"DTSTART:19700101T000000",
			"END:STANDARD",
		]
	for moment, van, naar in overgangen:
		# De wandkloktijd op het moment van de overgang, in de tijd van ervoor.
		lokaal = (moment + van).replace(tzinfo=None)
		soort = "DAYLIGHT" if moment.astimezone(tz).dst() else "STANDARD"
		laatste_week = lokaal.day + 7 > calendar.monthrange(lokaal.year, lokaal.month)[1]
		nummer = -1 if laatste_week else (lokaal.day - 1) // 7 + 1
		regels += [
			f"BEGIN:{soort}",
			f"TZOFFSETFROM:{_verschuiving(van)}",
			f"TZOFFSETTO:{_verschuiving(naar)}",
			f"TZNAME:{moment.astimezone(tz).tzname()}",
			f"DTSTART:{lokaal:%Y%m%dT%H%M%S}",
			f"RRULE:FREQ=YEARLY;BYMONTH={lokaal.month};BYDAY={nummer}{WEEKDAGEN[lokaal.weekday()]}",
			f"END:{soort}",
		]
	regels.append("END:VTIMEZONE")
	return regels


def _afspraakregels(afspraak: dict, eigenaar: str, nu: str) -> list[str]:
	"""De VEVENT-regels van één afspraak, of niets als hij er niet in hoort."""
	uid = afspraak.get("uid") or afspraak.get("id")
	if not uid or (afspraak.get("status") or "") == "cancelled" or _afgewezen(afspraak, eigenaar):
		return []

	prive = (afspraak.get("privacy") or "public") != "public"
	hele_dag = bool(afspraak.get("isAllDay"))
	zone = afspraak.get("timeZone") or ""
	titel = _("Bezet") if prive else (afspraak.get("title") or _("(geen titel)"))
	plek = "" if prive else _locatie(afspraak)
	afwijkingen = afspraak.get("recurrenceOverrides") or {}

	regels = [
		"BEGIN:VEVENT",
		f"UID:{uid}",
		f"DTSTAMP:{nu}",
		_tijdregel("DTSTART", afspraak.get("start"), zone, hele_dag),
		"DURATION:" + duur(afspraak.get("duration"), "P1D" if hele_dag else "PT1H"),
		"SUMMARY:" + _tekst(titel),
	]
	if plek:
		regels.append("LOCATION:" + _tekst(plek))
	regels.append("CLASS:" + ("PRIVATE" if prive else "PUBLIC"))
	herhalingen = afspraak.get("recurrenceRules") or ([afspraak.get("recurrenceRule")] if afspraak.get("recurrenceRule") else [])
	for regel in herhalingen:
		herhaling = _herhaling(regel, hele_dag)
		if herhaling:
			regels.append(herhaling)
	for sleutel, afwijking in afwijkingen.items():
		if (afwijking or {}).get("excluded"):
			regels.append(_tijdregel("EXDATE", sleutel, zone, hele_dag))
	regels.append("END:VEVENT")

	# Verzette of gewijzigde keren uit een reeks: een eigen VEVENT met RECURRENCE-ID.
	for sleutel, afwijking in afwijkingen.items():
		afwijking = afwijking or {}
		if not afwijking or afwijking.get("excluded"):
			continue
		regels += [
			"BEGIN:VEVENT",
			f"UID:{uid}",
			f"DTSTAMP:{nu}",
			_tijdregel("RECURRENCE-ID", sleutel, zone, hele_dag),
			_tijdregel("DTSTART", afwijking.get("start") or sleutel, zone, hele_dag),
			"DURATION:" + duur(afwijking.get("duration") or afspraak.get("duration"), "PT1H"),
			"SUMMARY:" + _tekst(_("Bezet") if prive else (afwijking.get("title") or titel)),
		]
		if plek:
			regels.append("LOCATION:" + _tekst(plek))
		regels.append("END:VEVENT")
	return regels


def _vouw(regels: list[str]) -> str:
	"""Regels langer dan 75 tekens vouwen, zoals iCalendar voorschrijft."""
	gevouwen = []
	for regel in regels:
		while len(regel) > 74:
			gevouwen.append(regel[:74])
			regel = " " + regel[74:]
		gevouwen.append(regel)
	return "\r\n".join(gevouwen) + "\r\n"


def bouw_agenda(afspraken: list[dict], eigenaar: str, naam: str) -> str:
	"""Het iCalendar-bestand voor een lijst afspraken uit de mailserver."""
	nu_lokaal = now_datetime()
	nu = _stempel(str(nu_lokaal).replace(" ", "T")) + "Z"
	systeemzone = get_system_timezone()

	gebeurtenissen = []
	zones = [systeemzone]
	gezien = set()
	for afspraak in afspraken:
		uid = afspraak.get("uid") or afspraak.get("id")
		if not uid or uid in gezien:
			continue
		gezien.add(uid)
		regels = _afspraakregels(afspraak, eigenaar, nu)
		if not regels:
			continue
		gebeurtenissen += regels
		zone = afspraak.get("timeZone") or ""
		if zone and zone not in UTC_ZONES and zone not in zones and not afspraak.get("isAllDay"):
			zones.append(zone)

	regels = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Y-next//Agenda//NL",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"X-WR-CALNAME:" + _tekst(_("Agenda {0}").format(naam)),
		f"X-WR-TIMEZONE:{systeemzone}",
		"REFRESH-INTERVAL;VALUE=DURATION:PT1H",
		"X-PUBLISHED-TTL:PT1H",
	]
	for zone in zones:
		regels += tijdzoneblok(zone, nu_lokaal.year)
	regels += gebeurtenissen
	regels.append("END:VCALENDAR")
	return _vouw(regels)


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=600, seconds=60 * 60)
def agenda_ical(t: str | None = None):
	"""Geeft de agenda bij een deellink als iCalendar-bestand."""
	code = (t or "").strip()
	link = None
	if code:
		link = frappe.db.get_value("Y Agenda Deellink", {"code": code, "actief": 1}, ["gebruiker", "code"], as_dict=True)
	# De database vergelijkt zonder op hoofdletters te letten; de code niet.
	if not link or not secrets.compare_digest(str(link.code), code):
		frappe.throw(_("Onbekende link."), frappe.PermissionError)
	eigenaar = (link.gebruiker or "").strip().lower()

	sessie = Mailserver().namens(eigenaar)
	account = sessie.account(AGENDA)
	if not account:
		frappe.throw(_("Geen agenda gevonden bij deze link."))

	van = add_days(today(), -90) + "T00:00:00Z"
	tot = add_days(today(), 400) + "T00:00:00Z"
	antwoorden = sessie.roep(
		AGENDA,
		[
			["CalendarEvent/query", {"accountId": account, "filter": {"after": van, "before": tot}, "limit": 1000}, "q"],
			[
				"CalendarEvent/get",
				{
					"accountId": account,
					"#ids": {"resultOf": "q", "name": "CalendarEvent/query", "path": "/ids"},
					"properties": [
						"id", "uid", "title", "start", "duration", "timeZone", "isAllDay", "locations",
						"privacy", "status", "participants", "recurrenceRules", "recurrenceRule", "recurrenceOverrides",
					],
				},
				"g",
			],
		],
	)
	afspraken = []
	for antwoord in antwoorden:
		if antwoord[0] == "CalendarEvent/get":
			afspraken += (antwoord[1] or {}).get("list") or []

	naam = frappe.db.get_value("User", eigenaar, "full_name") or eigenaar
	frappe.response["type"] = "download"
	frappe.response["filename"] = "agenda.ics"
	frappe.response["filecontent"] = bouw_agenda(afspraken, eigenaar, naam)
