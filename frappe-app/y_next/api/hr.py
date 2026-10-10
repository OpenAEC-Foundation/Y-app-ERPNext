"""Koppeling met HRMS: kilometers boeken in de reisaanvraag van de maand.

Y-next houdt kilometers standaard bij op het eigen doctype `Y Km Registratie`;
dat werkt op elke site. Een organisatie die HRMS gebruikt kan ervoor kiezen de
kilometervergoeding via reisaanvragen te laten lopen: één `Travel Request` per
medewerker per maand, met een regel per rit. Die keuze maakt de beheerder met
de instelling `km-via-reisaanvraag` in `Y Next Setting`.

De frontend vraagt één keer (`actie: "info"`) welke van de twee deze site
gebruikt en kiest daarop waar het ritten leest en schrijft.
"""

import frappe
from frappe import _
from frappe.utils import cint, flt, get_first_day, get_last_day, getdate

# Wie ritten voor een ander mag boeken.
MAG_VOOR_ANDEREN = ("HR User", "HR Manager", "System Manager")

INSTELLING = "km-via-reisaanvraag"
TARIEF_INSTELLING = "km-tarief"
STANDAARD_TARIEF = 0.23

# De reisaanvraag van de maand heeft in HRMS een reisdoel en een kostensoort
# nodig. Ontbreken die, dan maakt de app ze aan.
REISDOEL = "Woon-werk"
KOSTENSOORT = "Travel"


def km_via_reisaanvraag() -> bool:
	"""Of deze site kilometers via reisaanvragen boekt: HRMS én de keuze van de beheerder."""
	if "hrms" not in frappe.get_installed_apps():
		return False
	waarde = frappe.db.get_value("Y Next Setting", INSTELLING, "setting_value")
	return str(waarde or "").strip().lower() in ("1", "true", "ja")


def _medewerker_voor_mij(employee: str):
	"""De medewerker, als de ingelogde gebruiker voor hem mag boeken."""
	medewerker = frappe.db.get_value("Employee", employee, ["user_id", "company"], as_dict=True)
	if not medewerker:
		frappe.throw(_("Onbekende medewerker."))
	mag_anderen = bool(set(MAG_VOOR_ANDEREN) & set(frappe.get_roles()))
	if (medewerker.user_id or "") != frappe.session.user and not mag_anderen:
		frappe.throw(_("Je kunt alleen je eigen ritten boeken."))
	return medewerker


def _rit_tarief(rit) -> float:
	afstand = flt(rit.custom_distance)
	kosten = flt(rit.custom_travel_cost)
	return kosten / afstand if afstand > 0 and kosten > 0 else 0


def _maand_tarief(aanvraag) -> float:
	"""Het tarief voor een rit in deze reisaanvraag.

	Dat van de ritten die er al in staan; anders dat van een collega in
	dezelfde maand, zodat één maand nooit twee tarieven heeft; pas daarna de
	instelling `km-tarief`.
	"""
	tarief = 0
	for rit in aanvraag.get("itinerary") or []:
		tarief = _rit_tarief(rit) or tarief
	if not tarief and aanvraag.custom_from_date:
		collegas = [
			rij["name"]
			for rij in frappe.get_all(
				"Travel Request",
				filters={"custom_from_date": aanvraag.custom_from_date, "docstatus": ["!=", 2]},
				fields=["name"],
				limit_page_length=0,
			)
			if rij["name"] != aanvraag.name
		]
		if collegas:
			for rit in frappe.get_all(
				"Travel Itinerary",
				filters={
					"parenttype": "Travel Request",
					"parent": ["in", collegas],
					"custom_distance": [">", 0],
					"custom_travel_cost": [">", 0],
				},
				fields=["custom_distance", "custom_travel_cost"],
				order_by="creation desc",
				limit_page_length=1,
			):
				tarief = flt(rit["custom_travel_cost"]) / flt(rit["custom_distance"])
	if not tarief:
		tarief = flt(frappe.db.get_value("Y Next Setting", TARIEF_INSTELLING, "setting_value")) or STANDAARD_TARIEF
	return flt(tarief, 4)


def _herreken(aanvraag) -> dict:
	"""Zet de totale afstand en de kostenregel voor reiskosten gelijk aan de ritten."""
	totaal_afstand = 0
	totaal_kosten = 0
	for rit in aanvraag.get("itinerary") or []:
		totaal_afstand += flt(rit.custom_distance)
		totaal_kosten += flt(rit.custom_travel_cost)
	totaal_kosten = flt(totaal_kosten, 2)
	aanvraag.custom_total_distance = totaal_afstand

	reiskosten = None
	for regel in aanvraag.get("costings") or []:
		if (regel.expense_type or "") == KOSTENSOORT:
			reiskosten = regel
	if reiskosten:
		reiskosten.total_amount = totaal_kosten
	else:
		aanvraag.append("costings", {"expense_type": KOSTENSOORT, "total_amount": totaal_kosten})
	return {
		"totaal_afstand": totaal_afstand,
		"totaal_kosten": totaal_kosten,
		"ritten": len(aanvraag.get("itinerary") or []),
	}


def _ritgegevens(datum, van, naar, kilometers, retour) -> dict:
	datum = (datum or "").strip()[:10]
	van = (van or "").strip()
	naar = (naar or "").strip()
	afstand = flt(kilometers)
	retour = cint(retour)
	if not datum or not van or not naar or afstand <= 0:
		frappe.throw(_("Vul datum, vertrek, bestemming en kilometers in."))
	getdate(datum)
	return {"datum": datum, "van": van, "naar": naar, "afstand": afstand * (2 if retour else 1), "retour": retour}


def _zorg_voor_stamgegevens():
	"""Het reisdoel en de kostensoort die een reisaanvraag nodig heeft."""
	if not frappe.db.exists("Purpose of Travel", REISDOEL):
		frappe.get_doc({"doctype": "Purpose of Travel", "purpose_of_travel": REISDOEL}).insert(ignore_permissions=True)
	if not frappe.db.exists("Expense Claim Type", KOSTENSOORT):
		frappe.get_doc({"doctype": "Expense Claim Type", "expense_type": KOSTENSOORT}).insert(ignore_permissions=True)


def _boeken(employee, rit: dict, toch: int, proef: int) -> dict:
	"""Voegt een rit toe aan de open reisaanvraag van de maand; maakt die aan als hij er nog niet is."""
	medewerker = _medewerker_voor_mij(employee)
	datum = rit["datum"]

	open_naam = ""
	ingediend = ""
	for aanvraag in frappe.get_all(
		"Travel Request",
		filters={
			"employee": employee,
			"custom_from_date": ["<=", datum],
			"custom_to_date": [">=", datum],
			"docstatus": ["!=", 2],
		},
		fields=["name", "docstatus"],
		order_by="creation desc",
		limit_page_length=10,
	):
		if aanvraag["docstatus"] == 0 and not open_naam:
			open_naam = aanvraag["name"]
		if aanvraag["docstatus"] == 1 and not ingediend:
			ingediend = aanvraag["name"]
	if not open_naam and ingediend:
		frappe.throw(
			_("De reisaanvraag van deze maand ({0}) is al ingediend. Vraag HR om de rit toe te voegen.").format(ingediend)
		)

	nieuw = not open_naam
	if nieuw:
		_zorg_voor_stamgegevens()
		doc = frappe.get_doc(
			{
				"doctype": "Travel Request",
				"travel_type": "Domestic",
				"purpose_of_travel": REISDOEL,
				"employee": employee,
				"company": medewerker.company,
				"custom_from_date": get_first_day(datum),
				"custom_to_date": get_last_day(datum),
			}
		)
	else:
		doc = frappe.get_doc("Travel Request", open_naam)

	# Dezelfde rit op dezelfde dag: melden, niet blokkeren.
	if not toch:
		for bestaand in doc.get("itinerary") or []:
			if str(bestaand.departure_date or "")[:10] == datum and flt(bestaand.custom_distance) == rit["afstand"]:
				return {"dubbel": True, "reisaanvraag": "" if nieuw else doc.name, "datum": datum}

	tarief = _maand_tarief(doc)
	bedrag = flt(rit["afstand"] * tarief, 2)
	regel = doc.append(
		"itinerary",
		{
			"travel_from": rit["van"],
			"travel_to": rit["naar"],
			"departure_date": datum + " 08:00:00",
			"custom_distance": rit["afstand"],
			"custom_journey_type": "Return" if rit["retour"] else "One way",
			"custom_travel_type": "Business",
			"custom_travel_cost": bedrag,
		},
	)
	totalen = _herreken(doc)
	if not proef:
		# De medewerker mag zelf geen reisaanvraag aanmaken; deze functie doet
		# dat voor hem, na de controle hierboven.
		if nieuw:
			doc.insert(ignore_permissions=True)
		else:
			doc.save(ignore_permissions=True)
	return {
		"dubbel": False,
		"proef": bool(proef),
		"reisaanvraag": "" if (proef and nieuw) else doc.name,
		"rij": "" if proef else regel.name,
		"nieuwe_reisaanvraag": nieuw,
		"afstand": rit["afstand"],
		"tarief": tarief,
		"bedrag": bedrag,
		**totalen,
	}


def _wijzigen_of_verwijderen(actie: str, rij_naam: str, proef: int, ritgegevens) -> dict:
	"""Past een rit aan of haalt hem weg, zolang de reisaanvraag nog open staat."""
	ouder = None
	if rij_naam:
		ouder = frappe.db.get_value("Travel Itinerary", rij_naam, ["parent", "parenttype"], as_dict=True)
	if not ouder or ouder.parenttype != "Travel Request":
		frappe.throw(_("Deze rit staat niet (meer) in een reisaanvraag."))
	doc = frappe.get_doc("Travel Request", ouder.parent)
	_medewerker_voor_mij(doc.employee)
	if doc.docstatus != 0:
		frappe.throw(_("De reisaanvraag {0} is al ingediend. Vraag HR om de rit aan te passen.").format(doc.name))

	uit = {"reisaanvraag": doc.name, "proef": bool(proef)}
	if actie == "verwijderen":
		overig = [rit for rit in doc.get("itinerary") or [] if rit.name != rij_naam]
		for volgnummer, rit in enumerate(overig, start=1):
			rit.idx = volgnummer
		doc.set("itinerary", overig)
	else:
		rit = ritgegevens()
		# Een rit naar een andere maand verplaatsen kan niet: die hoort in een
		# andere reisaanvraag.
		buiten = _("Die datum valt buiten deze reisaanvraag. Verwijder de rit en boek hem opnieuw.")
		if doc.custom_from_date and rit["datum"] < str(doc.custom_from_date):
			frappe.throw(buiten)
		if doc.custom_to_date and rit["datum"] > str(doc.custom_to_date):
			frappe.throw(buiten)
		for bestaand in doc.get("itinerary") or []:
			if bestaand.name == rij_naam:
				# Een gewijzigde rit houdt zijn eigen tarief.
				tarief = flt(_rit_tarief(bestaand), 4) or _maand_tarief(doc)
				tijd = str(bestaand.departure_date or "")[11:19] or "08:00:00"
				bestaand.travel_from = rit["van"]
				bestaand.travel_to = rit["naar"]
				bestaand.departure_date = rit["datum"] + " " + tijd
				bestaand.custom_distance = rit["afstand"]
				bestaand.custom_journey_type = "Return" if rit["retour"] else "One way"
				bestaand.custom_travel_cost = flt(rit["afstand"] * tarief, 2)
				uit["tarief"] = tarief
				uit["bedrag"] = bestaand.custom_travel_cost
	uit.update(_herreken(doc))
	if not proef:
		doc.save(ignore_permissions=True)
	return uit


@frappe.whitelist()
def km_rit_boeken(
	actie: str | None = None,
	employee: str | None = None,
	datum: str | None = None,
	van: str | None = None,
	naar: str | None = None,
	kilometers: str | float | int | None = None,
	retour: str | int | None = None,
	toch: str | int | None = None,
	proef: str | int | None = None,
	rij: str | None = None,
):
	"""Kilometers in de reisaanvraag van de maand.

	- `info`: of deze site kilometers via reisaanvragen boekt.
	- `boeken` (standaard): een rit toevoegen. Weigert als de reisaanvraag van
	  die maand al is ingediend. Meldt een rit op dezelfde dag met dezelfde
	  afstand (`dubbel`), tenzij `toch=1`. `proef=1` rekent alles uit zonder op
	  te slaan.
	- `wijzigen` / `verwijderen`: een rit (`rij`, de naam van de regel)
	  aanpassen of weghalen, zolang de reisaanvraag nog open staat.

	Na elke wijziging kloppen de totale afstand en de kostenregel voor
	reiskosten weer. Wie er boekt komt uit de sessie: alleen voor jezelf,
	tenzij je HR of beheerder bent.
	"""
	actie = (actie or "boeken").strip()
	if actie == "info":
		return {"reisaanvraag": km_via_reisaanvraag()}
	if actie not in ("boeken", "wijzigen", "verwijderen"):
		frappe.throw(_("Onbekende actie: {0}").format(actie))
	if not km_via_reisaanvraag():
		frappe.throw(_("Deze site boekt kilometers niet via reisaanvragen."))

	def ritgegevens():
		return _ritgegevens(datum, van, naar, kilometers, retour)

	if actie == "boeken":
		employee = (employee or "").strip()
		if not employee:
			frappe.throw(_("Kies een medewerker."))
		return _boeken(employee, ritgegevens(), cint(toch), cint(proef))
	return _wijzigen_of_verwijderen(actie, (rij or "").strip(), cint(proef), ritgegevens)
