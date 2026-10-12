"""Welke postbussen zijn aan de ingelogde gebruiker toegewezen?"""

import frappe

from y_next.api import is_beheerder


def eigen_postbussen(gebruiker: str) -> list[dict]:
	"""De rijen uit `User.user_emails` van deze gebruiker: naam van het Email Account en adres."""
	postbussen = []
	for rij in frappe.get_all(
		"User Email",
		filters={"parent": gebruiker, "parenttype": "User"},
		fields=["email_account", "email_id"],
		limit_page_length=0,
	):
		naam = (rij.get("email_account") or "").strip()
		adres = (rij.get("email_id") or "").strip()
		if naam and adres:
			postbussen.append({"name": naam, "email_id": adres})
	return postbussen


@frappe.whitelist()
def mijn_postbussen():
	"""De postbussen van de ingelogde gebruiker.

	Waarom dit geen gewone leesactie op het eigen User-document is: het veld
	`user_emails` staat op permissieniveau 1, en dat niveau mag alleen een
	System Manager lezen. Een gewone medewerker krijgt zijn eigen gebruiker
	dus wél terug, maar zonder die tabel en zonder foutmelding. De mailmodule
	ziet dan geen enkele postbus, ook niet zijn eigen.

	Het leesrecht op dat niveau openzetten zou meteen ook `roles`, `user_type`
	en `block_modules` leesbaar maken. Wat hier weggegeven wordt is smal:
	alleen de eigen rijen, alleen naam en adres. Wie de post in die bussen mag
	lezen bepaalt ERPNext zelf.
	"""
	gebruiker = frappe.session.user
	return {
		"gebruiker": gebruiker,
		"postbussen": eigen_postbussen(gebruiker),
		# Een System Manager valt buiten de beperking op Communication en leest
		# elke postbus. De app gebruikt dat om hem de gedeelde bussen te tonen.
		"alles": is_beheerder(gebruiker),
	}
