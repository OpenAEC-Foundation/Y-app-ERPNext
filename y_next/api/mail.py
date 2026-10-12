"""Mail: statusvelden bijwerken en nieuwe post ophalen."""

import frappe
from frappe import _

from y_next.api import is_beheerder
from y_next.api.postbussen import eigen_postbussen

STATUSSEN = ("Open", "Replied", "Closed", "Linked")
EMAILSTATUSSEN = ("Open", "Spam", "Trash")


@frappe.whitelist()
def mail_bijwerken(
	naam: str | None = None,
	status: str | None = None,
	email_status: str | None = None,
	seen: str | int | None = None,
	reference_doctype: str | None = None,
	reference_name: str | None = None,
):
	"""Zet statusvelden op een e-mail, zonder het hele document te valideren.

	Waarom dit nodig is: Frappe controleert bij elke keer opslaan de
	adresvelden van een Communication. Het splitst recipients, cc en bcc op
	komma's en eist dat elk stuk een geldig adres is. Een geadresseerde die
	zijn naam als "Achternaam, V." schrijft valt daardoor uiteen, en het
	eerste stuk is geen adres. Gevolg: een mail afvinken of aan een project
	koppelen mislukt op een veld dat je niet eens aanraakt.

	Deze functie schrijft alleen de velden die je bedoelt. De begrenzing zit in
	de parameters: statusvelden en de koppeling. Inhoud, adressen en afzender
	staan er niet tussen en zijn hier dus niet te wijzigen.
	"""
	if not naam:
		frappe.throw(_("Geen bericht opgegeven."))
	if not frappe.db.exists("Communication", naam):
		frappe.throw(_("Bericht niet gevonden."), frappe.DoesNotExistError)
	if not frappe.has_permission("Communication", "write", doc=naam):
		frappe.throw(_("Geen recht om dit bericht te wijzigen."), frappe.PermissionError)

	patch = {}
	if status:
		if status not in STATUSSEN:
			frappe.throw(_("Onbekende status."))
		patch["status"] = status
	if email_status:
		if email_status not in EMAILSTATUSSEN:
			frappe.throw(_("Onbekende e-mailstatus."))
		patch["email_status"] = email_status
	if seen is not None and seen != "":
		patch["seen"] = 1 if str(seen) in ("1", "true", "True") else 0
	# Koppeling: leegmaken mag ook, dus hier telt "is meegegeven" en niet "is
	# gevuld". Een lege tekst haalt de koppeling weg.
	if reference_doctype is not None:
		patch["reference_doctype"] = reference_doctype
	if reference_name is not None:
		patch["reference_name"] = reference_name

	if not patch:
		frappe.throw(_("Geen te wijzigen velden opgegeven."))

	# Een kopie: set_value zet er zelf `modified` en `modified_by` bij.
	frappe.db.set_value("Communication", naam, dict(patch), update_modified=True)
	return {"bericht": naam, "gewijzigd": patch}


def _ontvang(postbus: str) -> int | None:
	"""Haalt de post van één Email Account op. Geeft het aantal nieuwe berichten,
	of None voor een postbus zonder inkomende post."""
	account = frappe.get_doc("Email Account", postbus)
	if not account.enable_incoming:
		return None
	voor = frappe.db.count("Communication", {"email_account": postbus})
	account.receive()
	frappe.db.commit()
	return max(0, frappe.db.count("Communication", {"email_account": postbus}) - voor)


@frappe.whitelist()
def mail_ophalen(postbus: str | None = None):
	"""Nu meteen nieuwe post ophalen bij de mailserver.

	Binnenkomende post komt binnen via de planner van Frappe, die elke paar
	minuten langs de Email Accounts gaat. Wie op vernieuwen drukt omdat hij een
	mail verwacht, keek zonder deze functie naar dezelfde lijst als een seconde
	eerder. Frappe heeft daar zelf geen open eindpunt voor.

	Alleen de postbussen van de ingelogde gebruiker; de lijst komt uit zijn
	eigen `user_emails`. Een beheerder mag ook een gedeelde bus ophalen, want
	die leest hij in de app toch al.
	"""
	gevraagd = (postbus or "").strip()
	eigen = [rij["name"] for rij in eigen_postbussen(frappe.session.user)]
	if gevraagd:
		accounts = [gevraagd] if (gevraagd in eigen or is_beheerder()) else []
	else:
		accounts = eigen

	opgehaald = []
	mislukt = []
	for naam in accounts:
		try:
			nieuw = _ontvang(naam)
		except Exception as fout:
			mislukt.append({"postbus": naam, "reden": str(fout)[:200]})
			continue
		if nieuw is not None:
			opgehaald.append({"postbus": naam, "nieuw": nieuw})

	return {
		"opgehaald": opgehaald,
		"mislukt": mislukt,
		"nieuw": sum(rij["nieuw"] for rij in opgehaald),
	}
