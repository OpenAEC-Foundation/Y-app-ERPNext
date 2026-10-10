"""E-mailondertekening: de gegevens waar de app haar uit opbouwt."""

import frappe
from frappe import _

from y_next.api import is_beheerder, vereis_medewerker
from y_next.api.postbussen import eigen_postbussen

# Wat er van een bedrijf onder een mail komt: naam, logo, website en de
# huisstijlvelden die de app aan Company toevoegt.
BEDRIJFSVELDEN = [
	"name",
	"company_name",
	"company_logo",
	"website",
	"custom_trade_name",
	"custom_brand_color_dark",
	"custom_brand_color_accent",
	"custom_linkedin_url",
	"custom_signature_greeting",
]
ADRESVELDEN = ["address_line1", "pincode", "city", "phone"]


@frappe.whitelist()
def ondertekening_gegevens(postbus: str | None = None):
	"""Het bedrijf, het vestigingsadres en de handtekening van de postbus.

	Waarom dit geen gewone leesacties vanuit de app zijn: een medewerker mag in
	ERPNext alleen adressen lezen die hij zelf heeft aangemaakt, en een Email
	Account alleen met de rol Inbox User. Zijn ondertekening zou dan zonder
	adres blijven, en de postbus waaruit hij schrijft zou niet meetellen.

	Wat hier buiten die rechten om gelezen wordt is wat op elke brief van het
	bedrijf staat: naam, logo, website, huisstijl en het adres van de
	vestiging. Een postbus telt alleen mee als zij aan de gebruiker is
	toegewezen; een beheerder leest elke postbus toch al.

	Het bedrijf is dat van de postbus, anders dat van de medewerkerskaart.
	"""
	vereis_medewerker(_("Geen toegang tot de gegevens voor de ondertekening."))
	gebruiker = frappe.session.user

	bus = _postbus(gebruiker, postbus)
	bedrijf = (bus or {}).get("custom_company") or frappe.db.get_value(
		"Employee", {"user_id": gebruiker, "status": "Active"}, "company"
	)
	return {
		"bedrijf": _bedrijf(bedrijf),
		"adres": _vestigingsadres(bedrijf),
		"postbus": {"signature": bus.get("signature") or ""} if bus else None,
	}


def _postbus(gebruiker: str, naam: str | None) -> dict | None:
	"""De postbus, als de gebruiker eruit mag schrijven."""
	if not naam:
		return None
	if not is_beheerder(gebruiker) and naam not in {bus["name"] for bus in eigen_postbussen(gebruiker)}:
		return None
	return frappe.db.get_value("Email Account", naam, ["signature", "custom_company"], as_dict=True)


def _bedrijf(naam: str | None) -> dict | None:
	if not naam:
		return None
	return frappe.db.get_value("Company", naam, BEDRIJFSVELDEN, as_dict=True)


def _vestigingsadres(bedrijf: str | None) -> dict | None:
	"""Het eigen adres van het bedrijf; het hoofdadres gaat voor."""
	if not bedrijf:
		return None
	gekoppeld = frappe.get_all(
		"Dynamic Link",
		filters={"parenttype": "Address", "link_doctype": "Company", "link_name": bedrijf},
		pluck="parent",
		limit_page_length=0,
	)
	if not gekoppeld:
		return None
	adressen = frappe.get_all(
		"Address",
		filters={"name": ["in", gekoppeld], "is_your_company_address": 1, "disabled": 0},
		fields=ADRESVELDEN,
		order_by="is_primary_address desc, creation asc",
		limit_page_length=1,
	)
	return adressen[0] if adressen else None
