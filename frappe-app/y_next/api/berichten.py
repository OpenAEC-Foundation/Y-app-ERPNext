"""Berichten: wie er meedoet, hun foto, en berichten verwijderen.

Een bericht is een `Notification Log`. Het bestaat uit twee kopieën — één per
postvak — met een gedeelde sleutel `k=` in de link. Oudere berichten van vóór
die sleutel worden herkend aan afzender, ontvanger, tekst en tijdstip.
"""

import json

import frappe
from frappe import _
from frappe.utils import add_to_date, now_datetime

from y_next.api import vereis_medewerker

BERICHT_LINK = "/y-next#/messenger"
MAX_PER_KEER = 500

# Alleen rasterafbeeldingen: een SVG is een document dat script kan bevatten.
FOTOSOORTEN = {
	".jpg": ("image/jpeg", "jpg"),
	".jpeg": ("image/jpeg", "jpg"),
	".png": ("image/png", "png"),
	".webp": ("image/webp", "webp"),
	".gif": ("image/gif", "gif"),
}


@frappe.whitelist()
def berichten_collegas():
	"""Wie er in Berichten staat: naam, of er een foto is, en wanneer iemand laatst actief was.

	Waarom dit geen lijstquery vanuit de app is: een gewone medewerker mag
	`User` niet lezen, en op een medewerker staat meestal een User Permission
	op het eigen Employee-record. Een lijstquery levert dan hooguit jezelf op.
	`frappe.get_all` leest buiten die rechten om; dat mag hier omdat er alleen
	deze drie dingen uit komen. Het fotobestand zelf blijft afgeschermd — dat
	geeft `berichten_foto` door.

	"Laatst actief" is `User.last_active`, dat Frappe zelf bijwerkt. De
	servertijd gaat mee (`nu`), zodat de app "vijf minuten geleden" rekent
	tegen dezelfde klok en niet tegen die van het apparaat.
	"""
	vereis_medewerker(_("Geen toegang tot de collegalijst."))

	medewerkers = frappe.get_all(
		"Employee",
		filters={"status": "Active"},
		fields=["employee_name", "user_id", "image"],
		order_by="employee_name asc",
		limit_page_length=0,
	)
	adressen = list({(medewerker.get("user_id") or "").strip() for medewerker in medewerkers} - {""})

	gebruikers = {}
	if adressen:
		for gebruiker in frappe.get_all(
			"User",
			filters={"name": ["in", adressen], "enabled": 1},
			fields=["name", "full_name", "user_image", "last_active"],
			limit_page_length=0,
		):
			gebruikers[gebruiker["name"]] = gebruiker

	collegas = []
	gezien = set()
	for medewerker in medewerkers:
		adres = (medewerker.get("user_id") or "").strip()
		gebruiker = gebruikers.get(adres)
		if not adres or not gebruiker or adres in gezien:
			continue
		gezien.add(adres)
		laatst = gebruiker.get("last_active")
		collegas.append(
			{
				"user": adres,
				"naam": (gebruiker.get("full_name") or medewerker.get("employee_name") or adres).strip(),
				"foto": bool(gebruiker.get("user_image") or medewerker.get("image")),
				"laatst_actief": str(laatst) if laatst else None,
			}
		)

	return {"collegas": collegas, "nu": str(now_datetime())}


@frappe.whitelist()
def berichten_foto(gebruiker: str | None = None):
	"""De foto van een collega.

	De foto's staan afgeschermd, en dat blijft zo. Een collega mag het
	Employee- of User-record van een ander niet lezen, dus de browser krijgt
	het bestand niet rechtstreeks. Deze functie geeft alleen de foto door:
	alleen aan wie ingelogd is met een medewerkersrol, en alleen van actieve
	medewerkers.

	Het bestand gaat als gewone afbeelding terug, zodat de app hem met een
	`<img>` kan tonen; de sessiecookie reist dan vanzelf mee.
	"""
	vereis_medewerker(_("Geen toegang tot foto's van collega's."))

	gebruiker = (gebruiker or "").strip()
	if not gebruiker:
		frappe.throw(_("Geen collega opgegeven."))

	medewerker = frappe.get_all(
		"Employee",
		filters={"status": "Active", "user_id": gebruiker},
		fields=["image"],
		limit_page_length=1,
	)
	if not medewerker:
		frappe.throw(_("Onbekende collega."))

	pad = frappe.db.get_value("User", gebruiker, "user_image") or medewerker[0].get("image") or ""
	if not pad.startswith(("/private/files/", "/files/")):
		frappe.throw(_("Geen foto."))
	soort = next((waarde for extensie, waarde in FOTOSOORTEN.items() if pad.lower().endswith(extensie)), None)
	if not soort:
		frappe.throw(_("Geen foto."))
	bestandsnaam = frappe.db.get_value("File", {"file_url": pad}, "name")
	if not bestandsnaam:
		frappe.throw(_("Geen foto."))

	frappe.response["type"] = "download"
	frappe.response["filename"] = "foto." + soort[1]
	frappe.response["content_type"] = soort[0]
	frappe.response["display_content_as"] = "inline"
	frappe.response["filecontent"] = frappe.get_doc("File", bestandsnaam).get_content()


def _parameter(link: str, naam: str) -> str:
	"""De waarde van één parameter uit de link van een bericht."""
	_, _, zoekdeel = link.partition("?")
	for deel in zoekdeel.split("&"):
		if deel.startswith(naam + "="):
			return deel[len(naam) + 1 :]
	return ""


def _is_bericht(link: str) -> bool:
	return link == BERICHT_LINK or link.startswith(BERICHT_LINK + "?")


def _namen(filters: dict, limiet: int) -> list[str]:
	return [rij["name"] for rij in frappe.get_all("Notification Log", filters=filters, fields=["name"], limit_page_length=limiet)]


def _te_verwijderen(naam: str, voor: str, ik: str) -> list[str]:
	"""De documenten die bij het verwijderen van dit ene bericht weg moeten."""
	rijen = frappe.get_all(
		"Notification Log",
		filters={"name": naam},
		fields=["name", "owner", "for_user", "document_name", "link", "email_content", "creation"],
		limit_page_length=1,
	)
	if not rijen:
		frappe.throw(_("Bericht niet gevonden."))
	rij = rijen[0]

	if rij["for_user"] != ik:
		frappe.throw(_("Dit bericht staat niet in jouw berichten."))
	link = rij["link"] or ""
	if not _is_bericht(link):
		frappe.throw(_("Dit is geen bericht."))

	weg = [rij["name"]]
	if voor != "iedereen":
		return weg

	if rij["owner"] != ik:
		frappe.throw(_("Alleen je eigen berichten verwijder je voor iedereen."))
	ander = rij["document_name"] or ""
	if not ander:
		frappe.throw(_("Onbekende ontvanger."))

	sleutel = _parameter(link, "k")

	# Een groepsbericht: jouw kopie heeft `groep:<id>` als tegenpartij en er is
	# een kopie per lid. Die hebben allemaal jouw naam als eigenaar en dezelfde
	# sleutel; de sleutel is willekeurig en alleen de leden kennen hem. De
	# likes erop gaan mee, bij wie ze ook staan.
	if ander.startswith("groep:"):
		if not sleutel:
			frappe.throw(_("Dit groepsbericht heeft geen sleutel."))
		weg += _namen({"owner": ik, "link": ["like", f"%k={sleutel}%"]}, 100)
		weg += _namen({"link": ["like", f"%reactie={sleutel}%"]}, 500)
		return weg

	if sleutel:
		weg += _namen({"owner": ik, "for_user": ander, "link": ["like", f"%k={sleutel}%"]}, 5)
		# De likes op dit bericht, bij allebei.
		weg += _namen({"for_user": ["in", [ik, ander]], "link": ["like", f"%reactie={sleutel}%"]}, 100)
		return weg

	# Van vóór de gedeelde sleutel: dezelfde tekst van jou aan de ander, binnen
	# twee minuten van jouw kopie.
	for kandidaat in frappe.get_all(
		"Notification Log",
		filters={
			"owner": ik,
			"for_user": ander,
			"creation": ["between", [add_to_date(rij["creation"], seconds=-120), add_to_date(rij["creation"], seconds=120)]],
		},
		fields=["name", "email_content", "link"],
		limit_page_length=20,
	):
		if (kandidaat["email_content"] or "") == (rij["email_content"] or "") and _is_bericht(kandidaat["link"] or ""):
			weg.append(kandidaat["name"])
	return weg


@frappe.whitelist()
def berichten_verwijderen(naam: str | None = None, namen: str | list | None = None, voor: str = "mij"):
	"""Verwijdert één bericht (`naam`) of een lijst (`namen`, bijvoorbeeld een heel gesprek).

	Twee keuzes, zoals in elke chat-app:

	- `mij`: alleen je eigen kopie verdwijnt; de ander houdt het bericht. Kan
	  bij elk bericht dat in jouw berichten staat.
	- `iedereen`: het bericht verdwijnt bij allebei, met de likes erop. Alleen
	  bij een bericht dat je zelf stuurde.

	Bij een lijst gaat alles of niets: eerst worden alle berichten
	gecontroleerd, pas daarna wordt er verwijderd.

	Waarom dit een serverfunctie is: de rol Employee mag een Notification Log
	niet verwijderen. Deze functie doet dat wel, maar alleen na haar eigen
	controles. Wat een bericht is en van wie, komt uit de database en niet uit
	het verzoek.
	"""
	voor = (voor or "mij").strip()
	if isinstance(namen, str):
		namen = json.loads(namen) if namen.strip() else []
	namen = list(namen or [])
	enkel = (naam or "").strip()
	if enkel:
		namen = [enkel]

	if not namen:
		frappe.throw(_("Geen bericht opgegeven."))
	if len(namen) > MAX_PER_KEER:
		frappe.throw(_("Te veel berichten in één keer."))
	if voor not in ("mij", "iedereen"):
		frappe.throw(_("Onbekende keuze."))

	ik = frappe.session.user
	weg = []
	for bericht in namen:
		weg += _te_verwijderen(str(bericht).strip(), voor, ik)

	verwijderd = set()
	for bericht in weg:
		if bericht in verwijderd:
			continue
		frappe.delete_doc("Notification Log", bericht, ignore_permissions=True)
		verwijderd.add(bericht)

	return {"verwijderd": len(verwijderd), "voor": voor}
