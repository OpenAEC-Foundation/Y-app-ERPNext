"""Wat de app op een site inricht naast de eigen doctypes.

Drie soorten definities, elk in een JSON-bestand in deze map:

- `custom_fields.json`   velden die de app aan standaarddoctypes toevoegt;
- `permissions.json`     rechten op bestaande doctypes die Y-next nodig heeft
                         maar die Frappe standaard niet geeft;
- `master_records.json`  stamgegevens die Y-next verwacht.

Het provisioneringsscript van de publicatieroute leest dezelfde bestanden.
Zo is er één plek waar staat wat een site nodig heeft.

Alles hier is idempotent en draait bij de installatie en na elke migratie.
Een definitie voor een doctype of rol die op de site niet bestaat, wordt
overgeslagen: dat is een optionele koppeling (bijvoorbeeld HRMS) die niet is
geïnstalleerd. Wordt die app later toegevoegd, dan pakt de eerstvolgende
migratie de definitie alsnog op.
"""

import json
import os

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.permissions import add_permission, update_permission_property


def load(naam: str):
	"""Leest een definitiebestand uit deze map."""
	with open(os.path.join(os.path.dirname(__file__), naam), encoding="utf-8") as bestand:
		return json.load(bestand)


def after_install():
	sync_all()


def after_migrate():
	sync_all()


def sync_all():
	sync_custom_fields()
	sync_permissions()
	sync_master_records()


def sync_custom_fields(definities: dict | None = None):
	definities = load("custom_fields.json") if definities is None else definities
	aanwezig = {
		doctype: velden for doctype, velden in definities.items() if frappe.db.exists("DocType", doctype)
	}
	if aanwezig:
		create_custom_fields(aanwezig, update=True)


def sync_permissions(regels: list | None = None):
	regels = load("permissions.json") if regels is None else regels
	for regel in regels:
		doctype, rol, permlevel = regel["doctype"], regel["role"], regel["permlevel"]
		if not frappe.db.exists("DocType", doctype) or not frappe.db.exists("Role", rol):
			continue
		# add_permission maakt de rij aan met alleen leesrecht en doet niets
		# als hij er al is; de gevraagde vlag wordt daarna gezet.
		add_permission(doctype, rol, permlevel)
		update_permission_property(doctype, rol, permlevel, regel["ptype"], regel["value"])


def sync_master_records(records: list | None = None):
	"""Maakt ontbrekende stamrecords aan. Een bestaand record blijft onaangeroerd,
	zodat een waarde die de beheerder heeft aangepast een migratie overleeft."""
	records = load("master_records.json") if records is None else records
	for record in records:
		doctype = record["doctype"]
		if not frappe.db.exists("DocType", doctype) or frappe.db.exists(doctype, record["name"]):
			continue
		frappe.get_doc({"doctype": doctype, **record["payload"]}).insert(ignore_permissions=True)
