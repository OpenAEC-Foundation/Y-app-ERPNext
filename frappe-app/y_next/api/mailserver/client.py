"""De verbinding met de mailserver.

Waarom via een serviceaccount en niet met ieders eigen wachtwoord: de
mailserver kent impersonatie. Aanmelden als "<gebruiker>%<serviceaccount>"
geeft een sessie namens die gebruiker. Eén sleutel op één plek dus, in plaats
van een wachtwoord per medewerker dat stuk voor stuk veroudert.

Het adres van de mailserver staat nergens in code; het komt uit de instelling
`Agenda Koppeling`.
"""

from urllib.parse import urlsplit

import frappe
from frappe import _
from frappe.integrations.utils import make_get_request, make_post_request, make_put_request

CORE = "urn:ietf:params:jmap:core"
AGENDA = "urn:ietf:params:jmap:calendars"
MAIL = "urn:ietf:params:jmap:mail"
AFWEZIGHEID = "urn:ietf:params:jmap:vacationresponse"


class Mailserver:
	"""De instelling uit `Agenda Koppeling`, gecontroleerd en één keer gelezen."""

	def __init__(self):
		instelling = frappe.get_doc("Agenda Koppeling")
		if not instelling.enabled:
			frappe.throw(_("De koppeling met de mailserver staat uit. Zet hem aan bij Agenda Koppeling."))
		adres = (instelling.server_url or "").strip()
		if not adres:
			frappe.throw(_("Er staat geen adres van de mailserver bij Agenda Koppeling."))
		self.dienst = (instelling.service_account or "").strip()
		if not self.dienst:
			frappe.throw(_("Er staat geen serviceaccount bij Agenda Koppeling."))
		self.wachtwoord = instelling.get_password("service_password", raise_exception=False)
		if not self.wachtwoord:
			frappe.throw(_("Er staat geen wachtwoord bij Agenda Koppeling."))

		# Het adres mag de server zelf zijn of zijn JMAP-eindpunt; JMAP en
		# CalDAV hangen naast elkaar op dezelfde server.
		delen = urlsplit(adres if "://" in adres else "https://" + adres)
		self.basis = f"{delen.scheme}://{delen.netloc}"
		self.jmap = self.basis + "/jmap/"

	def namens(self, gebruiker: str) -> "Sessie":
		return Sessie(self, gebruiker)


class Sessie:
	"""Een aanmelding op de mailserver namens één gebruiker."""

	def __init__(self, server: Mailserver, gebruiker: str):
		self.server = server
		self.gebruiker = gebruiker
		self.inlog = (f"{gebruiker}%{server.dienst}", server.wachtwoord)
		self._sessie = None

	@property
	def sessie(self) -> dict:
		if self._sessie is None:
			self._sessie = make_get_request(self.server.jmap + "session", auth=self.inlog)
		return self._sessie

	def account(self, soort: str) -> str | None:
		"""Het account van deze gebruiker voor één onderdeel (agenda, mail, afwezigheid)."""
		return (self.sessie.get("primaryAccounts") or {}).get(soort)

	def roep(self, soort: str, calls: list) -> list:
		"""Stuurt JMAP-aanroepen en geeft de antwoorden terug."""
		uit = make_post_request(
			self.server.jmap, auth=self.inlog, json={"using": [CORE, soort], "methodCalls": calls}
		)
		return uit.get("methodResponses") or []

	def agendabestand(self, bestandsnaam: str) -> str:
		"""Het CalDAV-adres van een afspraak in de standaardagenda van deze gebruiker."""
		return f"{self.server.basis}/dav/cal/{self.gebruiker.replace('@', '%40')}/default/{bestandsnaam}"

	def lees(self, adres: str):
		return make_get_request(adres, auth=self.inlog)

	def schrijf(self, adres: str, inhoud: bytes, soort: str):
		make_put_request(adres, auth=self.inlog, headers={"Content-Type": soort}, data=inhoud)


def fout_in(antwoorden: list, methode: str, sleutel: str) -> str | None:
	"""De reden waarom een `…/set` niet lukte, of None als het goed ging.

	`sleutel` is het blok waarin de server de mislukte onderdelen meldt
	(`notUpdated`, `notDestroyed`).
	"""
	fout = None
	for regel in antwoorden:
		if regel[0] == "error":
			fout = str(regel[1])[:200]
		elif regel[0] == methode:
			for reden in ((regel[1] or {}).get(sleutel) or {}).values():
				fout = str(reden)[:200]
	return fout


def adres_van_deelnemer(deelnemer: dict) -> str:
	"""Het e-mailadres van een deelnemer. De ene server zet het in `email`, de andere in `calendarAddress`."""
	adres = deelnemer.get("email") or ""
	if not adres:
		kaart = deelnemer.get("calendarAddress") or ""
		if kaart.startswith("mailto:"):
			adres = kaart[len("mailto:") :]
	return adres.lower()


def is_reeks(afspraak: dict) -> bool:
	"""Of een afspraak herhaalt.

	Sommige servers schrijven `recurrenceRule` (enkelvoud, een oudere versie
	van de norm), de huidige norm zegt `recurrenceRules`. Alleen op het
	meervoud letten maakt van elke reeks een losse afspraak.
	"""
	return bool(
		afspraak.get("recurrenceRules") or afspraak.get("recurrenceRule") or afspraak.get("recurrenceOverrides")
	)
