"""De afwezigheidsmelding van je eigen postbus op de mailserver."""

import frappe
from frappe import _

from y_next.api.mailserver.client import AFWEZIGHEID, Mailserver, fout_in


def _leeg_of(waarde: str | None) -> str | None:
	waarde = (waarde or "").strip()
	return waarde or None


def _stand(sessie, account: str) -> dict:
	for regel in sessie.roep(AFWEZIGHEID, [["VacationResponse/get", {"accountId": account, "ids": ["singleton"]}, "v"]]):
		if regel[0] == "VacationResponse/get":
			lijst = (regel[1] or {}).get("list") or []
			if lijst:
				melding = lijst[0]
				return {
					"aan": bool(melding.get("isEnabled")),
					"van": melding.get("fromDate"),
					"tot": melding.get("toDate"),
					"onderwerp": melding.get("subject") or "",
					"tekst": melding.get("textBody") or "",
					"html": melding.get("htmlBody") or "",
				}
		if regel[0] == "error":
			frappe.throw(_("De mailserver weigerde: {0}").format(str(regel[1])[:200]))
	frappe.throw(_("Geen afwezigheidsmelding gevonden."))


@frappe.whitelist()
def mail_afwezigheid(
	actie: str | None = None,
	aan: str | int | None = None,
	van: str | None = None,
	tot: str | None = None,
	onderwerp: str | None = None,
	tekst: str | None = None,
	html: str | None = None,
):
	"""Leest (`lezen`) of zet (`opslaan`) de afwezigheidsmelding van de ingelogde gebruiker.

	De mailserver antwoordt zelf, ook als ERPNext geen mail ophaalt, en kent
	een van- en tot-datum (in UTC, of leeg). Het automatische antwoord van een
	Email Account in ERPNext is daarvoor geen vervanging: dat geldt voor de
	hele postbus en voor iedereen, zonder datums.

	Alleen de postbus van de ingelogde gebruiker. Er is bewust geen parameter
	om een ander adres op te geven: dan kon iedereen namens een collega een
	afwezigheidsmelding aan- of uitzetten.
	"""
	ik = (frappe.session.user or "").strip().lower()
	if not ik or ik == "guest" or "@" not in ik:
		frappe.throw(_("Niet ingelogd."))
	actie = actie or "lezen"
	if actie not in ("lezen", "opslaan"):
		frappe.throw(_("Onbekende actie."))

	sessie = Mailserver().namens(ik)
	try:
		account = sessie.account(AFWEZIGHEID)
	except Exception as fout:
		frappe.throw(_("De mailserver kent geen postbus voor {0} ({1})").format(ik, str(fout)[:120]))
	if not account:
		frappe.throw(_("Deze mailserver kent geen afwezigheidsmelding."))

	if actie == "opslaan":
		van = _leeg_of(van)
		tot = _leeg_of(tot)
		# Tijden in UTC en in dezelfde notatie zijn als tekst te vergelijken.
		if van and tot and tot <= van:
			frappe.throw(_("De einddatum ligt voor de begindatum."))
		wijziging = {
			"isEnabled": str(aan or "").strip().lower() in ("1", "true", "ja"),
			"fromDate": van,
			"toDate": tot,
			"subject": _leeg_of(onderwerp),
			"textBody": _leeg_of(tekst),
			"htmlBody": _leeg_of(html),
		}
		fout = fout_in(
			sessie.roep(AFWEZIGHEID, [["VacationResponse/set", {"accountId": account, "update": {"singleton": wijziging}}, "s"]]),
			"VacationResponse/set",
			"notUpdated",
		)
		if fout:
			frappe.throw(_("De mailserver weigerde de afwezigheidsmelding: {0}").format(fout))

	return _stand(sessie, account)
