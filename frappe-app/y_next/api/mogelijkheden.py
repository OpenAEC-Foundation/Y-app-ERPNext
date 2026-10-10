"""Wat er op deze site beschikbaar is.

Y-next draait op kale ERPNext. Alles daarbuiten is een koppeling die aangaat
als het aanwezig is. De frontend vraagt hier bij het starten op wat er is en
stemt menu, veldlijsten en knoppen daarop af, in plaats van een verzoek te
doen dat op een fout uitloopt.
"""

import frappe

import y_next

OPTIONELE_APPS = ("hrms", "wiki")

# Doctypes die de frontend gebruikt maar die niet in kale ERPNext 16 zitten.
OPTIONELE_DOCTYPES = (
	"Expense Claim",
	"Lead Source",
	"Leave Allocation",
	"Leave Application",
	"Leave Type",
	"Salary Slip",
	"Shift Assignment",
	"Shift Plan",
	"Shift Plan Assignment",
	"Shift Type",
	"Travel Itinerary",
	"Travel Request",
	"Wiki Page",
)

# Velden die de frontend opvraagt maar die niet op elke site bestaan.
# `workflow_state` is er alleen als de site een workflow op dat doctype heeft.
OPTIONELE_VELDEN = {
	"Task": ("workflow_state",),
	"Timesheet": ("workflow_state",),
	"Sales Invoice": ("workflow_state",),
	"Purchase Invoice": ("workflow_state",),
}

# De pagina waar de CAD-viewer op een site staat, als hij er is.
CAD_VIEWER_ROUTE = "ocs-viewer"


def _heeft_taak_workflow() -> bool:
	return bool(frappe.db.exists("Workflow", {"document_type": "Task", "is_active": 1}))


def _mailserver_ingesteld() -> bool:
	instelling = frappe.get_cached_doc("Agenda Koppeling")
	return bool(instelling.enabled and instelling.server_url and instelling.service_account)


def mogelijkheden() -> dict:
	"""Welke koppelingen er op deze site beschikbaar zijn.

	Er gaan alleen ja/nee-antwoorden terug; geen adressen, accounts of andere
	instellingen. De pagina `/y-next` geeft dit bij het laden mee, zodat de
	frontend het weet vóór het eerste verzoek.
	"""
	geinstalleerd = frappe.get_installed_apps()
	return {
		"app_versie": y_next.__version__,
		"apps": {app: app in geinstalleerd for app in OPTIONELE_APPS},
		"doctypes": {doctype: bool(frappe.db.exists("DocType", doctype)) for doctype in OPTIONELE_DOCTYPES},
		"velden": {
			doctype: {veld: bool(frappe.get_meta(doctype).has_field(veld)) for veld in velden}
			for doctype, velden in OPTIONELE_VELDEN.items()
			if frappe.db.exists("DocType", doctype)
		},
		"taak_workflow": _heeft_taak_workflow(),
		"mailserver_ingesteld": _mailserver_ingesteld(),
		"cad_viewer": bool(frappe.db.exists("Web Page", {"route": CAD_VIEWER_ROUTE, "published": 1})),
	}


@frappe.whitelist()
def y_next_mogelijkheden():
	"""Hetzelfde als wat de pagina meegeeft, om tussentijds te verversen."""
	return mogelijkheden()
