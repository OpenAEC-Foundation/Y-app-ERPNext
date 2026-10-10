"""Post op de mailserver: het agendadeel van een uitnodiging ophalen, en verwijderen laten doorwerken.

Beide functies moeten een bericht uit ERPNext terugvinden op de mailserver.
Dat gaat op onderwerp én afzender, waarna van elke kandidaat de echte
Message-ID letterlijk wordt vergeleken. Niet met een filter op de
Message-ID-header zelf: dat levert niet op elke mailserver iets op. De
letterlijke vergelijking is niet optioneel — een algemeen onderwerp als
"Factuur" levert tientallen kandidaten op. Geen exacte treffer betekent dus:
niets doen en dat melden.

Wie wat mag: de gebruiker komt uit de sessie. Een bericht moet in een postbus
staan die in zijn eigen `user_emails` staat — dezelfde tabel waarop ERPNext het
lezen van post beperkt. Je kunt hiermee dus niets bereiken wat je niet sowieso
al mocht lezen.
"""

import frappe
from frappe import _

from y_next.api.mailserver.client import MAIL, Mailserver
from y_next.api.postbussen import eigen_postbussen


def _gewone_gebruiker() -> str:
	gebruiker = frappe.session.user
	if gebruiker in ("Guest", "", "Administrator"):
		frappe.throw(_("Log eerst in met een gewoon gebruikersaccount."))
	return gebruiker


def _eigen_accounts(gebruiker: str) -> list[str]:
	return [rij["name"] for rij in eigen_postbussen(gebruiker)]


def _kaal(message_id) -> str:
	return str(message_id or "").strip().lstrip("<").rstrip(">")


def _zoekfilter(onderwerp: str | None, afzender: str | None) -> dict | None:
	voorwaarden = []
	if onderwerp:
		voorwaarden.append({"subject": onderwerp})
	if afzender:
		voorwaarden.append({"from": afzender})
	if not voorwaarden:
		return None
	return voorwaarden[0] if len(voorwaarden) == 1 else {"operator": "AND", "conditions": voorwaarden}


def _kandidaten(sessie, account: str, filter_: dict, eigenschappen: dict) -> list[dict]:
	"""De berichten op de mailserver die aan het filter voldoen, met de gevraagde eigenschappen."""
	antwoorden = sessie.roep(
		MAIL,
		[
			["Email/query", {"accountId": account, "filter": filter_, "limit": 100}, "q"],
			[
				"Email/get",
				{"accountId": account, "#ids": {"resultOf": "q", "name": "Email/query", "path": "/ids"}, **eigenschappen},
				"g",
			],
		],
	)
	berichten = []
	for antwoord in antwoorden:
		if antwoord[0] == "Email/get":
			berichten += (antwoord[1] or {}).get("list") or []
	return berichten


def _is_dit_bericht(bericht: dict, message_id: str) -> bool:
	return any(_kaal(waarde) == message_id for waarde in bericht.get("messageId") or [])


@frappe.whitelist()
def mail_uitnodiging(communication: str | None = None):
	"""Haalt het agendadeel van een uitnodiging op van de mailserver.

	Frappe laat bij het binnenhalen van post het `text/calendar`-deel vallen.
	Een uitnodiging komt daardoor in ERPNext aan als gewone tekst met een
	deelnamelink; het machineleesbare deel — begintijd, organisator,
	genodigden — is weg. Op de mailserver staat het origineel nog compleet.
	Met het agendadeel kan de app een uitnodiging tonen, op conflicten toetsen
	en laten accepteren.
	"""
	server = Mailserver()
	gebruiker = _gewone_gebruiker()

	naam = (communication or "").strip()
	if not naam:
		frappe.throw(_("Geen bericht opgegeven."))
	rij = frappe.db.get_value("Communication", naam, ["subject", "sender", "message_id", "email_account"], as_dict=True)
	if not rij:
		frappe.throw(_("Dat bericht bestaat niet."))
	if rij.get("email_account") not in _eigen_accounts(gebruiker):
		frappe.throw(_("Dit bericht staat niet in een postbus van jou."))

	sessie = server.namens(gebruiker)
	account = sessie.account(MAIL)
	download = sessie.sessie.get("downloadUrl") or ""
	if not account or not download:
		frappe.throw(_("De mailserver geeft geen postbus terug voor {0}.").format(gebruiker))

	filter_ = _zoekfilter(rij.get("subject"), rij.get("sender"))
	if not filter_:
		frappe.throw(_("Te weinig gegevens om het bericht terug te vinden."))

	# Het agendadeel van precies dít bericht. De berichtstructuur is een boom;
	# het agendadeel kan overal zitten.
	blob = None
	message_id = _kaal(rij.get("message_id"))
	eigenschappen = {
		"properties": ["id", "messageId", "bodyStructure"],
		"bodyProperties": ["partId", "blobId", "type", "name"],
	}
	for bericht in _kandidaten(sessie, account, filter_, eigenschappen):
		if not _is_dit_bericht(bericht, message_id):
			continue
		stapel = [bericht.get("bodyStructure") or {}]
		while stapel:
			deel = stapel.pop()
			if not deel:
				continue
			if (deel.get("type") or "").lower() == "text/calendar" and deel.get("blobId"):
				blob = deel.get("blobId")
			stapel += deel.get("subParts") or []

	ics = None
	fout = None
	if blob:
		adres = (
			download.replace("{accountId}", account)
			.replace("{blobId}", blob)
			.replace("{name}", "uitnodiging.ics")
			.replace("{type}", "text/calendar")
		)
		try:
			ics = sessie.lees(adres)
		except Exception as uitzondering:
			fout = str(uitzondering)[:200]

	return {
		"communication": naam,
		"gevonden": bool(blob),
		"ics": ics if (ics and "BEGIN:VCALENDAR" in str(ics)) else None,
		"reden": fout,
	}


@frappe.whitelist()
def mail_verwijderen(actie: str | None = None, namen: str | None = None):
	"""Laat verwijderen in ERPNext doorwerken op de mailserver.

	De IMAP-koppeling van Frappe is eenrichtingsverkeer. Een Communication
	verwijderen laat het origineel op de server staan, en omdat Frappe per map
	bijhoudt hoe ver het is, komt het bericht ook niet terug. Zonder deze
	functie lopen de twee uit elkaar.

	- `prullenbak`  verplaatst het bericht naar de prullenbak van de
	                mailserver, zoals elk mailprogramma doet. Omkeerbaar.
	- `definitief`  gooit het echt weg.

	`namen` zijn de namen van de Communication-documenten, gescheiden door
	komma's.
	"""
	server = Mailserver()
	gebruiker = _gewone_gebruiker()

	actie = actie or "definitief"
	if actie not in ("prullenbak", "definitief"):
		frappe.throw(_("Onbekende actie."))
	lijst = [naam.strip() for naam in (namen or "").split(",") if naam.strip()]
	if not lijst:
		frappe.throw(_("Geen berichten opgegeven."))

	# ── Wat er weg moet ────────────────────────────────────────────────────
	eigen_accounts = _eigen_accounts(gebruiker)
	doelen = []
	overgeslagen = []
	for naam in lijst:
		rij = frappe.db.get_value("Communication", naam, ["message_id", "email_account", "subject", "sender"], as_dict=True)
		if not rij:
			overgeslagen.append({"bericht": naam, "reden": "bestaat niet"})
		elif rij.get("email_account") not in eigen_accounts:
			overgeslagen.append({"bericht": naam, "reden": "niet jouw postbus"})
		elif not rij.get("message_id"):
			overgeslagen.append({"bericht": naam, "reden": "geen message-id"})
		else:
			doelen.append(
				{
					"bericht": naam,
					"mid": _kaal(rij["message_id"]),
					"onderwerp": rij.get("subject") or "",
					"afzender": rij.get("sender") or "",
				}
			)

	verwijderd = 0
	nietgevonden = []
	fouten = []

	account = None
	prullenbak = None
	sessie = server.namens(gebruiker) if doelen else None
	if sessie:
		try:
			account = sessie.account(MAIL)
		except Exception as uitzondering:
			fouten.append("inloggen: " + str(uitzondering)[:150])

	# De prullenbak van de mailserver opzoeken; zonder die map kan alleen
	# definitief verwijderen.
	if account and actie == "prullenbak":
		try:
			for antwoord in sessie.roep(MAIL, [["Mailbox/get", {"accountId": account, "properties": ["id", "name", "role"]}, "m"]]):
				if antwoord[0] == "Mailbox/get":
					for map_ in (antwoord[1] or {}).get("list") or []:
						if (map_.get("role") or "") == "trash":
							prullenbak = map_.get("id")
		except Exception as uitzondering:
			fouten.append("mappen: " + str(uitzondering)[:150])
		if not prullenbak:
			fouten.append("geen prullenbak op de mailserver gevonden")

	for doel in doelen if account else []:
		filter_ = _zoekfilter(doel["onderwerp"], doel["afzender"])
		if not filter_:
			nietgevonden.append(doel["bericht"])
			continue
		try:
			kandidaten = _kandidaten(sessie, account, filter_, {"properties": ["id", "messageId"]})
		except Exception as uitzondering:
			fouten.append(doel["bericht"] + ": " + str(uitzondering)[:120])
			continue

		treffers = [bericht.get("id") for bericht in kandidaten if _is_dit_bericht(bericht, doel["mid"])]
		if not treffers:
			# Geen exacte treffer: niets weggooien. Een bericht dat er al niet
			# meer staat is geen fout, maar raden is dat wel.
			nietgevonden.append(doel["bericht"])
			continue

		if actie == "prullenbak" and prullenbak:
			opdracht = {"update": {treffer: {"mailboxIds": {prullenbak: True}} for treffer in treffers}}
		else:
			opdracht = {"destroy": treffers}
		try:
			antwoorden = sessie.roep(MAIL, [["Email/set", {"accountId": account, **opdracht}, "s"]])
		except Exception as uitzondering:
			fouten.append(doel["bericht"] + ": " + str(uitzondering)[:120])
			continue

		for antwoord in antwoorden:
			if antwoord[0] == "Email/set":
				blok = antwoord[1] or {}
				verwijderd += len(blok.get("destroyed") or [])
				verwijderd += len(blok.get("updated") or {})
				for reden in [*(blok.get("notDestroyed") or {}).values(), *(blok.get("notUpdated") or {}).values()]:
					fouten.append(str(reden)[:120])

	return {
		"actie": actie,
		"verwerkt": verwijderd,
		"aangeboden": len(doelen),
		"nietgevonden": nietgevonden,
		"overgeslagen": overgeslagen,
		"fouten": fouten,
	}
