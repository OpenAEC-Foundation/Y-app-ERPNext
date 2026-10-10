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


def roep(methode: str, /, **parameters):
	"""Roept een serverfunctie aan langs dezelfde weg als `/api/method/<methode>`."""
	from frappe.utils import set_request

	set_request(method="POST", path=f"/api/method/{methode}")
	frappe.local.form_dict = frappe._dict(parameters)
	return frappe.handler.execute_cmd(methode)


def maak_postbus(naam: str, adres: str, gebruiker: str) -> str:
	"""Een Email Account dat aan één gebruiker is toegewezen. Geeft de naam van het account."""
	if not frappe.db.exists("Email Account", naam):
		frappe.get_doc(
			{
				"doctype": "Email Account",
				"email_account_name": naam,
				"email_id": adres,
				"enable_incoming": 0,
				"enable_outgoing": 0,
			}
		).insert(ignore_permissions=True)
	if not frappe.db.exists("User Email", {"parent": gebruiker, "email_account": naam}):
		doc = frappe.get_doc("User", gebruiker)
		doc.append("user_emails", {"email_account": naam, "email_id": adres})
		doc.save(ignore_permissions=True)
	return naam


def maak_mail(postbus: str | None = None, **velden) -> str:
	"""Een ontvangen e-mail, rechtstreeks in de database gezet. Geeft de documentnaam.

	Rechtstreeks, omdat Frappe bij gewoon opslaan de adresvelden controleert en
	een test juist ook adressen wil kunnen gebruiken die daar niet doorheen komen.
	"""
	mail = frappe.get_doc(
		{
			"doctype": "Communication",
			"communication_type": "Communication",
			"communication_medium": "Email",
			"sent_or_received": "Received",
			"subject": "Testbericht",
			"content": "Inhoud",
			"sender": "afzender@voorbeeld.test",
			"recipients": "ontvanger@voorbeeld.test",
			"status": "Open",
			"seen": 0,
			"email_account": postbus,
			**velden,
		}
	)
	mail.db_insert()
	return mail.name
