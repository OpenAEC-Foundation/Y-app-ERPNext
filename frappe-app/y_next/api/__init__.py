"""De serverfuncties van Y-next.

De frontend roept ze aan onder een korte naam (`/api/method/mijn_postbussen`).
`override_whitelisted_methods` in `hooks.py` laat die namen naar de functies
hier wijzen.

Twee regels gelden voor alles in dit pakket:

- wie er handelt komt uit de sessie, nooit uit het verzoek;
- een functie geeft niet meer terug dan het scherm nodig heeft. Waar een
  functie buiten de rechten van de gebruiker om leest (`frappe.get_all`), staat
  erbij waarom dat mag en wat er precies uit komt.
"""

import frappe

# De rollen waarmee iemand als medewerker in Y-next werkt. Een rol die op de
# site niet bestaat, heeft niemand; die telt dan vanzelf niet mee.
MEDEWERKERSROLLEN = ("Employee", "Employee Self Service", "Projects User", "System Manager")


def is_beheerder(gebruiker: str | None = None) -> bool:
	return "System Manager" in frappe.get_roles(gebruiker or frappe.session.user)


def vereis_medewerker(melding: str):
	"""Stopt als de ingelogde gebruiker geen medewerkersrol heeft."""
	if not set(MEDEWERKERSROLLEN) & set(frappe.get_roles()):
		frappe.throw(melding, frappe.PermissionError)
