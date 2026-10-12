"""Agenda: de collega's die je in de agenda kunt aanzetten."""

import frappe
from frappe import _

from y_next.api import vereis_medewerker


@frappe.whitelist()
def agenda_collegas():
	"""Naam en werkadres van de actieve medewerkers, meer niet.

	Waarom dit geen lijstquery vanuit de app is: op een medewerker staat
	meestal een User Permission op zijn eigen Employee-record. Die beperking is
	terecht — hij houdt mensen uit elkaars personeelsgegevens — maar maakt ook
	dat een gewone medewerker in een lijstquery alleen zichzelf terugkrijgt.

	`frappe.get_all` leest buiten die rechten om. Dat mag hier omdat er precies
	twee velden uit komen die binnen een organisatie sowieso bekend zijn: hoe
	iemand heet en op welk adres hij mailt. De rest van het Employee-record
	blijft onaangeroerd.
	"""
	vereis_medewerker(_("Geen toegang tot de collegalijst."))

	collegas = []
	gezien = set()
	for medewerker in frappe.get_all(
		"Employee",
		filters={"status": "Active"},
		fields=["employee_name", "user_id"],
		order_by="employee_name asc",
		limit_page_length=0,
	):
		adres = (medewerker.get("user_id") or "").strip().lower()
		if not adres or adres in gezien:
			continue
		gezien.add(adres)
		collegas.append({"email": adres, "naam": (medewerker.get("employee_name") or adres).strip()})

	return {"collegas": collegas, "aantal": len(collegas)}
