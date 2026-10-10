"""Testgegevens: gebruikers, medewerkers en berichten."""

import frappe


def maak_gebruiker(email: str, voornaam: str, rollen: tuple = ()):
	"""Een gebruiker met precies de opgegeven rollen (plus wat Frappe iedereen geeft)."""
	if frappe.db.exists("User", email):
		return frappe.get_doc("User", email)
	gebruiker = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": voornaam,
			"send_welcome_email": 0,
			"enabled": 1,
			"roles": [{"role": rol} for rol in rollen],
		}
	)
	gebruiker.insert(ignore_permissions=True)
	return gebruiker


def maak_medewerker(email: str, voornaam: str, rollen: tuple = ("Employee",), status: str = "Active") -> str:
	"""Een gebruiker met een medewerkerskaart. Geeft de naam van het Employee-document."""
	maak_gebruiker(email, voornaam, rollen)
	bestaand = frappe.db.get_value("Employee", {"user_id": email})
	if bestaand:
		return bestaand
	medewerker = frappe.get_doc(
		{
			"doctype": "Employee",
			"first_name": voornaam,
			"company": frappe.db.get_value("Company", {}, "name"),
			"gender": frappe.db.get_value("Gender", {}, "name"),
			"date_of_birth": "1990-01-01",
			"date_of_joining": "2020-01-01",
			"status": status,
			"user_id": email,
		}
	)
	medewerker.insert(ignore_permissions=True)
	return medewerker.name


def maak_bericht(eigenaar: str, voor: str, tegenpartij: str, tekst: str, link: str) -> str:
	"""Eén kopie van een bericht, zoals de frontend die opslaat. Geeft de documentnaam."""
	vorige = frappe.session.user
	frappe.set_user(eigenaar)
	try:
		bericht = frappe.get_doc(
			{
				"doctype": "Notification Log",
				"for_user": voor,
				"type": "Alert",
				"subject": tekst,
				"email_content": tekst,
				"document_type": "User",
				"document_name": tegenpartij,
				"link": link,
			}
		)
		bericht.insert(ignore_permissions=True)
	finally:
		frappe.set_user(vorige)
	return bericht.name
