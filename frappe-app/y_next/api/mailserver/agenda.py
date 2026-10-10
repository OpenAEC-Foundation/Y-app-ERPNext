"""Agenda's op de mailserver: lezen en schrijven.

Lezen en schrijven zijn bewust twee functies. `agenda_ophalen` leest alleen.
`agenda_schrijven` handelt altijd namens de ingelogde gebruiker; wie er
handelt komt uit de sessie en niet uit het verzoek.
"""

import frappe
from frappe import _
from frappe.utils import add_days, today

from y_next.api import vereis_medewerker
from y_next.api.mailserver.client import AGENDA, Mailserver, adres_van_deelnemer, fout_in, is_reeks

ACTIES = ("opslaan", "antwoorden", "lezen", "bijwerken", "deelname", "inplannen", "verwijderen")
ANTWOORDEN = ("accepted", "declined", "tentative", "needs-action")

# De velden die `bijwerken` kent, met hun naam in JMAP. Wat er verder in de
# afspraak staat blijft staan; dat is het hele punt van een patch.
PATCHVELDEN = {"titel": "title", "start": "start", "duur": "duration", "omschrijving": "description"}

BESTANDSTEKENS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_")


def _actieve_adressen() -> list[str]:
	return [
		medewerker["user_id"]
		for medewerker in frappe.get_all(
			"Employee", filters={"status": "Active"}, fields=["user_id"], limit_page_length=0
		)
		if medewerker.get("user_id")
	]


def _plat(gebruiker: str, afspraak: dict) -> dict:
	"""Een afspraak in de vorm die de app nodig heeft."""
	# Genodigden platslaan: JMAP zet ze in een map met willekeurige sleutels,
	# en de app heeft alleen adres, naam en stand nodig. Zo blijft de sleutel
	# van de map — die per server anders is — buiten de app.
	genodigden = []
	for deelnemer in (afspraak.get("participants") or {}).values():
		rollen = deelnemer.get("roles") or {}
		genodigden.append(
			{
				"email": adres_van_deelnemer(deelnemer),
				"naam": deelnemer.get("name"),
				"status": deelnemer.get("participationStatus") or "needs-action",
				"organisator": bool(rollen.get("owner") or rollen.get("chair")),
			}
		)

	# Locaties staan in een map met sleutels die de server verzint. De agenda
	# toont er één: de eerste met een naam.
	locatie = ""
	for plaats in (afspraak.get("locations") or {}).values():
		naam = (plaats or {}).get("name") or ""
		if naam and not locatie:
			locatie = naam

	# De reeks zelf: de regel en wat eruit gehaald of verzet is. De app rekent
	# daarmee uit op welke dagen de afspraak valt; de mailserver geeft een
	# reeks maar één keer terug, op zijn eerste datum.
	uitzonderingen = {}
	for sleutel, afwijking in (afspraak.get("recurrenceOverrides") or {}).items():
		afwijking = afwijking or {}
		uitzonderingen[sleutel] = {
			"weg": bool(afwijking.get("excluded")),
			"start": afwijking.get("start"),
			"duur": afwijking.get("duration"),
		}

	# De omschrijving: daarin staat bijvoorbeeld de deelnamelink van een
	# videovergadering. Niet bij privé-afspraken — wat daar in staat, hoort
	# niet bij collega's terecht te komen.
	omschrijving = ""
	if (afspraak.get("privacy") or "public") == "public":
		omschrijving = afspraak.get("description") or ""

	herhaling = afspraak.get("recurrenceRules") or afspraak.get("recurrenceRule")
	return {
		"gebruiker": gebruiker,
		"id": afspraak.get("id"),
		"uid": afspraak.get("uid"),
		"titel": afspraak.get("title"),
		"locatie": locatie,
		"omschrijving": omschrijving,
		"start": afspraak.get("start"),
		"duur": afspraak.get("duration"),
		"tijdzone": afspraak.get("timeZone"),
		# De ene server markeert een hele dag met `showWithoutTime`, de andere
		# met `isAllDay` uit een oudere versie van de norm.
		"hele_dag": afspraak.get("showWithoutTime") or afspraak.get("isAllDay"),
		# Een herhalende afspraak is één document met een regel erin. Wie er
		# één blok van versleept, verzet ongemerkt de hele reeks — daarom weet
		# de app dit liever vooraf dan achteraf.
		"herhaalt": is_reeks(afspraak),
		"herhaling": herhaling,
		"uitzonderingen": uitzonderingen,
		"status": afspraak.get("freeBusyStatus"),
		"privacy": afspraak.get("privacy"),
		"genodigden": genodigden,
	}


@frappe.whitelist()
def agenda_ophalen(van: str | None = None, tot: str | None = None, gebruikers: str | None = None):
	"""Haalt de agenda's van medewerkers op uit de mailserver.

	Zonder `gebruikers` (adressen, gescheiden door komma's) zijn dat alle
	actieve medewerkers. Wie geen agenda op de mailserver heeft, komt in
	`mislukt`; de rest gaat gewoon door.
	"""
	vereis_medewerker(_("Geen toegang tot de agenda's."))
	server = Mailserver()

	van = van or today() + "T00:00:00Z"
	tot = tot or add_days(today(), 14) + "T00:00:00Z"
	if gebruikers:
		adressen = [adres.strip() for adres in gebruikers.split(",") if adres.strip()]
	else:
		adressen = _actieve_adressen()

	afspraken = []
	mislukt = []
	for adres in adressen:
		sessie = server.namens(adres)
		try:
			account = sessie.account(AGENDA)
		except Exception as fout:
			mislukt.append({"gebruiker": adres, "reden": "inloggen: " + str(fout)[:180]})
			continue
		if not account:
			mislukt.append({"gebruiker": adres, "reden": "geen agenda"})
			continue

		calls = [
			["CalendarEvent/query", {"accountId": account, "filter": {"after": van, "before": tot}, "limit": 200}, "q"],
			[
				"CalendarEvent/get",
				{
					"accountId": account,
					"#ids": {"resultOf": "q", "name": "CalendarEvent/query", "path": "/ids"},
					# De herhaling in beide spellingen vragen, anders lijkt bij
					# sommige servers elke reeks een losse afspraak.
					"properties": [
						"id", "uid", "title", "start", "duration", "timeZone", "isAllDay", "showWithoutTime",
						"locations", "description", "freeBusyStatus", "privacy", "participants",
						"recurrenceRules", "recurrenceRule", "recurrenceOverrides",
					],
				},
				"g",
			],
		]
		try:
			antwoorden = sessie.roep(AGENDA, calls)
		except Exception as fout:
			mislukt.append({"gebruiker": adres, "reden": "opvragen: " + str(fout)[:180]})
			continue

		for antwoord in antwoorden:
			if antwoord[0] != "CalendarEvent/get":
				continue
			for afspraak in (antwoord[1] or {}).get("list") or []:
				afspraken.append(_plat(adres, afspraak))

	return {
		"afspraken": afspraken,
		"aantal": len(afspraken),
		"gelezen": len(adressen) - len(mislukt),
		"mislukt": mislukt,
	}


# ── Schrijven ──────────────────────────────────────────────────────────────


def _adressen(tekst: str | None) -> list[str]:
	"""Een lijst adressen uit een door komma's gescheiden tekst: kleine letters, geen dubbelen."""
	adressen = []
	for adres in (tekst or "").split(","):
		schoon = adres.strip().lower()
		if schoon and schoon not in adressen:
			adressen.append(schoon)
	return adressen


def _domein(adres: str | None) -> str:
	stukken = (adres or "").split("@")
	return stukken[-1].lower() if len(stukken) > 1 else ""


def _eigen_domeinen(ik: str) -> set[str]:
	"""De maildomeinen van deze organisatie.

	Een genodigde van buiten heeft op de mailserver geen postbus, dus in zijn
	agenda valt niets te schrijven; die krijgt de uitnodiging per e-mail. Dat
	is geen fout, en het als fout melden maakt een geslaagde uitnodiging
	verdacht. De domeinen komen uit de medewerkers zelf, plus dat van de
	ingelogde gebruiker: geen lijst om te onderhouden die stilletjes veroudert.
	"""
	return {_domein(adres) for adres in [ik, *_actieve_adressen()]} - {""}


def _zoek(server: Mailserver, adres: str, uid: str):
	"""Zoekt een afspraak op UID in de agenda van `adres`.

	Op UID en niet op een bestandspad: zo is ook een afspraak te vinden die met
	een ander agendaprogramma is gemaakt.
	"""
	sessie = server.namens(adres)
	account = sessie.account(AGENDA)
	if not account:
		frappe.throw(_("Geen agenda voor {0}").format(adres))
	antwoorden = sessie.roep(
		AGENDA,
		[
			["CalendarEvent/query", {"accountId": account, "filter": {"uid": uid}, "limit": 5}, "q"],
			[
				"CalendarEvent/get",
				{
					"accountId": account,
					"#ids": {"resultOf": "q", "name": "CalendarEvent/query", "path": "/ids"},
					"properties": [
						"id", "uid", "title", "start", "duration", "isAllDay",
						"recurrenceRules", "recurrenceRule", "recurrenceOverrides", "participants",
					],
				},
				"g",
			],
		],
	)
	gevonden = None
	for antwoord in antwoorden:
		if antwoord[0] == "CalendarEvent/get":
			for afspraak in (antwoord[1] or {}).get("list") or []:
				if (afspraak.get("uid") or "") == uid:
					gevonden = afspraak
	return frappe._dict(sessie=sessie, account=account, afspraak=gevonden)


def _zoek_eigen(server: Mailserver, ik: str, uid: str):
	try:
		return _zoek(server, ik, uid)
	except Exception as fout:
		# Vrijwel altijd een geweigerde aanmelding: dit account heeft geen
		# postbus op de mailserver. Dat is iets anders dan een kapotte
		# koppeling, en het scheelt zoeken als dat er gewoon staat.
		frappe.throw(_("De mailserver kent geen agenda voor {0} ({1})").format(ik, str(fout)[:120]))


def _is_organisator(afspraak: dict, adres: str) -> bool:
	for deelnemer in (afspraak.get("participants") or {}).values():
		rollen = deelnemer.get("roles") or {}
		if adres_van_deelnemer(deelnemer) == adres and (rollen.get("owner") or rollen.get("chair")):
			return True
	return False


def _doelen(ik: str, gevraagd: list[str], ik_organiseer: bool) -> tuple[list[str], list[str]]:
	"""In welke agenda's geschreven wordt, en welke adressen van buiten zijn.

	Je eigen agenda altijd; die van een collega alleen als jij de organisator
	van de afspraak bent.
	"""
	domeinen = _eigen_domeinen(ik)
	doelen = [ik]
	extern = []
	for adres in gevraagd:
		if adres == ik or not ik_organiseer:
			continue
		if _domein(adres) not in domeinen:
			if adres not in extern:
				extern.append(adres)
		elif adres not in doelen:
			doelen.append(adres)
	return doelen, extern


def _deelname(server: Mailserver, ik: str, uid: str, stand: str | None):
	"""Je eigen antwoord op een uitnodiging: alleen je eigen regel, alleen in je eigen agenda."""
	stand = (stand or "").strip().lower()
	if stand not in ANTWOORDEN:
		frappe.throw(_("Onbekend antwoord."))

	eigen = _zoek_eigen(server, ik, uid)
	afspraak = eigen.afspraak
	if not afspraak:
		frappe.throw(_("Deze uitnodiging staat niet in je agenda."))

	# De deelnemers komen als map terug met sleutels die de server zelf
	# verzint. Wij zoeken de regel die over ons gaat; de rest blijft staan.
	deelnemers = afspraak.get("participants") or {}
	mijn_sleutel = None
	for sleutel, rij in deelnemers.items():
		if adres_van_deelnemer(rij or {}) == ik:
			mijn_sleutel = sleutel
	if not mijn_sleutel:
		frappe.throw(_("Je staat niet als genodigde bij deze afspraak."))

	# De hele deelnemersmap terugschrijven met één gewijzigde regel. Een
	# patchpad zou korter zijn, maar het terugschrijven van de hele eigenschap
	# is de vorm waarvan is vastgesteld dat de mailserver hem aanneemt.
	nieuwe_deelnemers = {}
	for sleutel, rij in deelnemers.items():
		rij = dict(rij or {})
		if sleutel == mijn_sleutel:
			rij["participationStatus"] = stand
			# Een antwoord is gegeven; de vraag erom kan weg.
			rij["expectReply"] = False
		nieuwe_deelnemers[sleutel] = rij

	try:
		fout = fout_in(
			eigen.sessie.roep(
				AGENDA,
				[
					[
						"CalendarEvent/set",
						{"accountId": eigen.account, "update": {afspraak["id"]: {"participants": nieuwe_deelnemers}}},
						"s",
					]
				],
			),
			"CalendarEvent/set",
			"notUpdated",
		)
	except Exception as uitzondering:
		fout = str(uitzondering)[:200]

	return {
		"actie": "deelname",
		"uid": uid,
		"stand": stand,
		"gelukt": not fout,
		"reden": fout,
		"titel": afspraak.get("title"),
	}


def _verwijderen(server: Mailserver, ik: str, uid: str, gevraagd: list[str]):
	"""Haalt een afspraak weg.

	Organiseer jij hem, dan gaat hij ook uit de agenda van collega's die
	genodigd waren. Anders alleen uit die van jezelf: een uitnodiging van een
	ander weghalen raakt de organisator niet.

	Een afspraak intrekken hoort volgens de norm een afzegbericht te zijn en
	geen stille verwijdering; voor genodigden van buiten — wier agenda hier
	niet te bereiken is — verstuurt de app dat bericht zelf.
	"""
	eigen = _zoek_eigen(server, ik, uid)
	if not eigen.afspraak:
		frappe.throw(_("Deze afspraak staat niet in je eigen agenda."))

	ik_organiseer = _is_organisator(eigen.afspraak, ik)
	doelen, extern = _doelen(ik, gevraagd, ik_organiseer)

	gelukt = []
	mislukt = []
	for adres in doelen:
		try:
			gevonden = eigen if adres == ik else _zoek(server, adres, uid)
			if not gevonden.afspraak:
				# Bij een collega al weg is geen fout: het doel is bereikt.
				gelukt.append(adres)
				continue
			fout = fout_in(
				gevonden.sessie.roep(
					AGENDA,
					[["CalendarEvent/set", {"accountId": gevonden.account, "destroy": [gevonden.afspraak["id"]]}, "s"]],
				),
				"CalendarEvent/set",
				"notDestroyed",
			)
			if fout:
				mislukt.append({"agenda": adres, "reden": fout})
			else:
				gelukt.append(adres)
		except Exception as uitzondering:
			mislukt.append({"agenda": adres, "reden": str(uitzondering)[:200]})

	return {
		"actie": "verwijderen",
		"uid": uid,
		"geschreven": gelukt,
		"mislukt": mislukt,
		"extern": extern,
		"organisator": ik_organiseer,
		"herhaalt": is_reeks(eigen.afspraak),
	}


def _bijwerken(server: Mailserver, ik: str, uid: str, gevraagd: list[str], patch: dict):
	"""Werkt een bestaande afspraak bij: alleen de meegegeven velden, de rest blijft ongemoeid.

	Dat is precies wat je wilt bij het verslepen van een afspraak die niet in
	de app is gemaakt: herhalingen, herinneringen en velden van andere
	agendaprogramma's hoeft de app zo niet te kennen.
	"""
	if not patch:
		frappe.throw(_("Er is niets om bij te werken."))

	# Eerst de eigen agenda: daar staat of jij de organisator bent, en dat
	# bepaalt of je ook in die van een ander mag schrijven.
	eigen = _zoek_eigen(server, ik, uid)
	if not eigen.afspraak:
		frappe.throw(_("Deze afspraak staat niet in je eigen agenda."))
	if is_reeks(eigen.afspraak):
		# Eén blok verslepen zou hier de hele reeks verzetten. Dat is bijna
		# nooit wat je bedoelt, en het is niet terug te draaien.
		frappe.throw(_("Dit is een herhalende afspraak; die verzet je in je agendaprogramma."))

	ik_organiseer = _is_organisator(eigen.afspraak, ik)
	doelen, extern = _doelen(ik, gevraagd, ik_organiseer)

	gelukt = []
	mislukt = []
	for adres in doelen:
		try:
			gevonden = eigen if adres == ik else _zoek(server, adres, uid)
			if not gevonden.afspraak:
				mislukt.append({"agenda": adres, "reden": "afspraak niet gevonden"})
				continue
			if is_reeks(gevonden.afspraak):
				mislukt.append({"agenda": adres, "reden": "herhalende afspraak"})
				continue
			fout = fout_in(
				gevonden.sessie.roep(
					AGENDA,
					[["CalendarEvent/set", {"accountId": gevonden.account, "update": {gevonden.afspraak["id"]: patch}}, "s"]],
				),
				"CalendarEvent/set",
				"notUpdated",
			)
			if fout:
				mislukt.append({"agenda": adres, "reden": fout})
			else:
				gelukt.append(adres)
		except Exception as uitzondering:
			mislukt.append({"agenda": adres, "reden": str(uitzondering)[:200]})

	return {
		"actie": "bijwerken",
		"uid": uid,
		"geschreven": gelukt,
		"mislukt": mislukt,
		"extern": extern,
		"organisator": ik_organiseer,
	}


def _personen(ics: str) -> tuple[str, list[str]]:
	"""De organisator en de genodigden uit een .ics-bestand."""

	def adres_van(regel: str) -> str:
		stuk = regel.rsplit(":", 1)[-1].strip().lower()
		return stuk[len("mailto:") :] if stuk.startswith("mailto:") else stuk

	organisator = ""
	genodigden = []
	for regel in ics.replace("\r\n", "\n").split("\n"):
		boven = regel.upper()
		if boven.startswith("ORGANIZER"):
			organisator = adres_van(regel)
		elif boven.startswith("ATTENDEE"):
			genodigden.append(adres_van(regel))
	return organisator, genodigden


def _bestand(server: Mailserver, ik: str, actie: str, uid: str, ics: str, gevraagd: list[str]):
	"""Legt een compleet .ics-bestand neer in een agenda, of leest het terug.

	Neerleggen gaat via CalDAV: dan blijft alles staan, inclusief organisator,
	genodigden en hun antwoord. De inhoud van het bestand bouwt de app op; hier
	staat alleen het vervoer en de afweging wie wat mag.
	"""
	organisator, genodigden = _personen(ics)

	if actie in ("lezen", "inplannen"):
		# Lezen doe je uit je eigen agenda. Inplannen net zo: een ontvangen
		# uitnodiging leg je bij jezelf neer. De organisator is iemand anders;
		# daar gaat hier niets naartoe, dus die controle hoort hier niet.
		toegestaan = [ik]
		gevraagd = [ik]
	elif actie == "opslaan":
		# De organisator staat in het bestand, maar het bestand komt van de
		# gebruiker. Alleen jezelf mag daar staan — anders zou je een afspraak
		# namens een collega kunnen rondsturen.
		if organisator and organisator != ik:
			frappe.throw(_("Je kunt alleen afspraken versturen namens jezelf."))
		toegestaan = [ik, *genodigden]
	else:
		if ik not in genodigden:
			frappe.throw(_("Je staat niet als genodigde bij deze afspraak."))
		# Antwoorden raakt je eigen agenda en die van de organisator; die
		# laatste moet weten of je komt.
		toegestaan = [ik, organisator] if organisator else [ik]

	# Wat niet mag, valt weg — dat is duidelijker dan de hele actie afkeuren
	# om één adres dat er niet in hoort. Genodigden van buiten vallen er ook
	# uit, maar dan als "extern": voor hen maakt de mailserver een uitnodiging
	# per e-mail.
	domeinen = _eigen_domeinen(ik)
	doelen = []
	extern = []
	for adres in gevraagd:
		if adres not in toegestaan:
			continue
		if _domein(adres) not in domeinen:
			if adres not in extern:
				extern.append(adres)
		elif adres not in doelen:
			doelen.append(adres)
	if not doelen:
		frappe.throw(_("Geen agenda's waar je in mag schrijven."))

	# De UID staat in het pad, dus alles wat geen gewone letter, cijfer, punt,
	# streepje of liggend streepje is gaat eruit. Dezelfde omzetting gebeurt in
	# de app, zodat beide kanten hetzelfde bestand aanwijzen.
	veilig = "".join(teken if teken in BESTANDSTEKENS else "-" for teken in uid)[:120]
	if not veilig:
		frappe.throw(_("Onbruikbare afspraak-id."))

	gelukt = []
	mislukt = []
	gelezen = None
	for adres in doelen:
		sessie = server.namens(adres)
		pad = sessie.agendabestand(veilig + ".ics")
		try:
			if actie == "lezen":
				gelezen = sessie.lees(pad)
			else:
				sessie.schrijf(pad, ics.encode("utf-8"), "text/calendar; charset=utf-8")
			gelukt.append(adres)
		except Exception as uitzondering:
			mislukt.append({"agenda": adres, "reden": str(uitzondering)[:200]})

	return {
		"actie": actie,
		"uid": uid,
		"bestand": veilig + ".ics",
		"geschreven": gelukt,
		"mislukt": mislukt,
		"extern": extern,
		"ics": gelezen,
	}


@frappe.whitelist()
def agenda_schrijven(
	actie: str | None = None,
	uid: str | None = None,
	ics: str | None = None,
	agendas: str | None = None,
	stand: str | None = None,
	titel: str | None = None,
	start: str | None = None,
	duur: str | None = None,
	omschrijving: str | None = None,
	locatie: str | None = None,
):
	"""Schrijft afspraken naar de agenda's op de mailserver.

	Een uitnodiging schrijft per definitie óók in de agenda van een ander,
	maar altijd namens de ingelogde gebruiker:

	- `opslaan`      de organisator moet de ingelogde gebruiker zijn
	- `antwoorden`   de ingelogde gebruiker moet als genodigde in het bestand staan
	- `deelname`     je zet je eigen antwoord; alleen je eigen regel, alleen in je eigen agenda
	- `inplannen`    een ontvangen uitnodiging in je eigen agenda zetten
	- `bijwerken`    je eigen agenda altijd; die van een ander alleen als organisator
	- `lezen`        alleen uit de eigen agenda
	- `verwijderen`  je eigen agenda altijd; die van een collega alleen als organisator
	"""
	vereis_medewerker(_("Geen recht om afspraken te wijzigen."))

	actie = actie or "opslaan"
	if actie not in ACTIES:
		frappe.throw(_("Onbekende actie."))
	uid = (uid or "").strip()
	if not uid:
		frappe.throw(_("Geen afspraak opgegeven."))
	ics = ics or ""
	if actie in ("opslaan", "antwoorden", "inplannen") and not ics:
		frappe.throw(_("Geen afspraakgegevens opgegeven."))

	server = Mailserver()
	ik = (frappe.session.user or "").strip().lower()
	gevraagd = _adressen(agendas) or [ik]

	if actie == "deelname":
		return _deelname(server, ik, uid, stand)
	if actie == "verwijderen":
		return _verwijderen(server, ik, uid, gevraagd)
	if actie == "bijwerken":
		waarden = {"titel": titel, "start": start, "duur": duur, "omschrijving": omschrijving}
		patch = {PATCHVELDEN[naam]: waarde for naam, waarde in waarden.items() if waarde is not None}
		if locatie is not None:
			# JMAP zet locaties in een map met eigen sleutels. De app kent er
			# maar één, dus die vervangt de map; een tweede locatie op dezelfde
			# afspraak zou anders blijven staan naast de nieuwe.
			patch["locations"] = {"l1": {"@type": "Location", "name": locatie}}
		return _bijwerken(server, ik, uid, gevraagd, patch)
	return _bestand(server, ik, actie, uid, ics, gevraagd)
