"""Een mailserver in het klein, voor de tests.

Speelt net genoeg van JMAP en CalDAV na om de koppeling te toetsen zonder een
echte mailserver: aanmelden namens een gebruiker, afspraken, afwezigheid en
post. Houdt bij welke verzoeken er namens wie zijn gedaan.
"""

from contextlib import contextmanager
from unittest.mock import patch

import frappe

BASIS = "https://mail.voorbeeld.test"
DIENST = "agenda@voorbeeld.test"
WACHTWOORD = "alleen-voor-de-test"

AGENDA = "urn:ietf:params:jmap:calendars"
MAIL = "urn:ietf:params:jmap:mail"
AFWEZIGHEID = "urn:ietf:params:jmap:vacationresponse"


class Geweigerd(Exception):
	pass


class NepMailserver:
	def __init__(self, postbussen):
		self.postbussen = set(postbussen)
		self.afspraken = {postbus: {} for postbus in postbussen}  # id -> afspraak
		self.mails = {postbus: {} for postbus in postbussen}  # id -> bericht
		self.afwezig = {
			postbus: {
				"id": "singleton",
				"isEnabled": False,
				"fromDate": None,
				"toDate": None,
				"subject": None,
				"textBody": None,
				"htmlBody": None,
			}
			for postbus in postbussen
		}
		self.bestanden = {}  # CalDAV-adres -> inhoud
		self.blobs = {}  # blobId -> inhoud
		self.verzoeken = []  # (methode, adres, namens wie)

	# ── Aanmelden ──────────────────────────────────────────────────────────
	def _wie(self, auth) -> str:
		naam, wachtwoord = auth
		gebruiker, _, dienst = naam.partition("%")
		if dienst != DIENST or wachtwoord != WACHTWOORD or gebruiker not in self.postbussen:
			raise Geweigerd("401 Client Error: Unauthorized")
		return gebruiker

	def agendabestand(self, gebruiker: str, bestandsnaam: str) -> str:
		return f"{BASIS}/dav/cal/{gebruiker.replace('@', '%40')}/default/{bestandsnaam}"

	# ── HTTP ───────────────────────────────────────────────────────────────
	def get(self, adres, auth=None, **_):
		gebruiker = self._wie(auth)
		self.verzoeken.append(("GET", adres, gebruiker))
		if adres == BASIS + "/jmap/session":
			return {
				"primaryAccounts": {AGENDA: gebruiker, MAIL: gebruiker, AFWEZIGHEID: gebruiker},
				"downloadUrl": BASIS + "/jmap/download/{accountId}/{blobId}/{name}?accept={type}",
			}
		if adres.startswith(BASIS + "/jmap/download/"):
			return self.blobs[adres.split("/")[6]]
		if adres in self.bestanden:
			return self.bestanden[adres]
		raise Geweigerd("404 Client Error: Not Found")

	def put(self, adres, auth=None, headers=None, data=None, **_):
		gebruiker = self._wie(auth)
		self.verzoeken.append(("PUT", adres, gebruiker))
		if not adres.startswith(f"{BASIS}/dav/cal/{gebruiker.replace('@', '%40')}/"):
			raise Geweigerd("403 Client Error: Forbidden")
		self.bestanden[adres] = data.decode("utf-8")

	def post(self, adres, auth=None, json=None, **_):
		gebruiker = self._wie(auth)
		self.verzoeken.append(("POST", adres, gebruiker))
		if adres != BASIS + "/jmap/":
			raise Geweigerd("404 Client Error: Not Found")
		antwoorden = []
		eerdere = {}
		for methode, argumenten, label in json["methodCalls"]:
			if argumenten.get("accountId") != gebruiker:
				antwoorden.append(["error", {"type": "accountNotFound"}, label])
				continue
			uit = getattr(self, "_" + methode.replace("/", "_"))(gebruiker, argumenten, eerdere)
			eerdere[label] = uit
			antwoorden.append([methode, uit, label])
		return {"methodResponses": antwoorden}

	# ── JMAP ───────────────────────────────────────────────────────────────
	@staticmethod
	def _ids(argumenten, eerdere):
		if "#ids" in argumenten:
			return eerdere[argumenten["#ids"]["resultOf"]]["ids"]
		return argumenten.get("ids") or []

	@staticmethod
	def _set(verzameling, argumenten):
		bijgewerkt, niet_bijgewerkt, verwijderd, niet_verwijderd = {}, {}, [], {}
		for sleutel, wijziging in (argumenten.get("update") or {}).items():
			if sleutel in verzameling:
				verzameling[sleutel].update(wijziging)
				bijgewerkt[sleutel] = None
			else:
				niet_bijgewerkt[sleutel] = {"type": "notFound"}
		for sleutel in argumenten.get("destroy") or []:
			if sleutel in verzameling:
				del verzameling[sleutel]
				verwijderd.append(sleutel)
			else:
				niet_verwijderd[sleutel] = {"type": "notFound"}
		return {
			"updated": bijgewerkt,
			"notUpdated": niet_bijgewerkt,
			"destroyed": verwijderd,
			"notDestroyed": niet_verwijderd,
		}

	def _CalendarEvent_query(self, gebruiker, argumenten, _eerdere):
		filter_ = argumenten.get("filter") or {}
		ids = []
		for sleutel, afspraak in self.afspraken[gebruiker].items():
			if "uid" in filter_ and afspraak.get("uid") != filter_["uid"]:
				continue
			start = (afspraak.get("start") or "")[:19]
			if "after" in filter_ and start < filter_["after"][:19]:
				continue
			if "before" in filter_ and start >= filter_["before"][:19]:
				continue
			ids.append(sleutel)
		return {"ids": ids[: argumenten.get("limit") or 1000]}

	def _CalendarEvent_get(self, gebruiker, argumenten, eerdere):
		afspraken = self.afspraken[gebruiker]
		return {
			"list": [
				dict(afspraken[sleutel], id=sleutel)
				for sleutel in self._ids(argumenten, eerdere)
				if sleutel in afspraken
			]
		}

	def _CalendarEvent_set(self, gebruiker, argumenten, _eerdere):
		return self._set(self.afspraken[gebruiker], argumenten)

	def _VacationResponse_get(self, gebruiker, _argumenten, _eerdere):
		return {"list": [dict(self.afwezig[gebruiker])]}

	def _VacationResponse_set(self, gebruiker, argumenten, _eerdere):
		return self._set({"singleton": self.afwezig[gebruiker]}, argumenten)

	def _Mailbox_get(self, _gebruiker, _argumenten, _eerdere):
		return {
			"list": [
				{"id": "postvak-in", "name": "Inbox", "role": "inbox"},
				{"id": "prullenbak", "name": "Deleted Items", "role": "trash"},
			]
		}

	def _Email_query(self, gebruiker, argumenten, _eerdere):
		filter_ = argumenten.get("filter") or {}
		voorwaarden = filter_["conditions"] if "conditions" in filter_ else [filter_]

		def past(bericht):
			for voorwaarde in voorwaarden:
				if "subject" in voorwaarde and voorwaarde["subject"].lower() not in bericht["subject"].lower():
					return False
				if "from" in voorwaarde and voorwaarde["from"].lower() not in bericht["from"].lower():
					return False
			return True

		return {"ids": [sleutel for sleutel, bericht in self.mails[gebruiker].items() if past(bericht)]}

	def _Email_get(self, gebruiker, argumenten, eerdere):
		berichten = self.mails[gebruiker]
		return {
			"list": [
				{
					"id": sleutel,
					"messageId": berichten[sleutel]["messageId"],
					"bodyStructure": berichten[sleutel].get("bodyStructure"),
				}
				for sleutel in self._ids(argumenten, eerdere)
				if sleutel in berichten
			]
		}

	def _Email_set(self, gebruiker, argumenten, _eerdere):
		return self._set(self.mails[gebruiker], argumenten)


@contextmanager
def nep_mailserver(*postbussen, ingeschakeld: bool = True):
	"""Zet de koppeling aan en vervangt de mailserver door de nepserver."""
	server = NepMailserver(postbussen)
	instelling = frappe.get_doc("Agenda Koppeling")
	instelling.update(
		{
			"enabled": 1 if ingeschakeld else 0,
			"server_url": BASIS + "/jmap/",
			"service_account": DIENST,
			"service_password": WACHTWOORD,
		}
	)
	instelling.save(ignore_permissions=True)
	doel = "y_next.api.mailserver.client."
	with (
		patch(doel + "make_get_request", server.get),
		patch(doel + "make_post_request", server.post),
		patch(doel + "make_put_request", server.put),
	):
		yield server
