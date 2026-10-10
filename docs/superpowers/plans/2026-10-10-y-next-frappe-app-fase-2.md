# Y-next Frappe-app — fase 2 (definities uit één bron) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na installatie van `y_next` op een kale site bestaan de eigen doctypes, de eigen velden op standaarddoctypes, de rechten en de stamgegevens — en het provisioneringsscript van de publicatieroute leest dezelfde definities.

**Architecture:** De doctypes zijn gewone app-doctypes (JSON per doctype, module *Y Next*). Velden, rechten en stamgegevens staan als JSON in `frappe-app/y_next/setup/`; `setup/install.py` past ze toe in `after_install` en `after_migrate`. Het provisioneringsscript leest diezelfde JSON-bestanden en zet een app-doctype om naar een maatwerk-doctype voor de REST-route.

**Tech Stack:** Frappe 16 (`create_custom_fields`, `add_permission`, `update_permission_property`), Node 24 (`node --test`).

**Ontwerp:** [`docs/superpowers/specs/2026-10-10-y-next-frappe-app-design.md`](../specs/2026-10-10-y-next-frappe-app-design.md), onderdeel 2.

## Global Constraints

- De doctypes houden exact de namen, velden, naamgeving en rechten die `scripts/provision-y-next.mjs` tot nu toe aanmaakte; de bestaande tests van dat script blijven de norm.
- Alles is idempotent: een tweede `bench migrate` of provisioning-run verandert niets.
- Een definitie voor een doctype of rol die op de site niet bestaat (HRMS) wordt overgeslagen, zonder fout.
- Velden die ERPNext 16 zelf al heeft (`Email Account.company`, `Communication.company`) maakt de app niet aan.
- Geen organisatienamen in `frappe-app/`. Labels van nieuwe velden in het Engels (Frappe vertaalt ze).
- Het provisioneringsscript blijft zich op een bestaande site gedragen als voorheen: bestaande doctypes en velden worden overgeslagen, nooit bijgewerkt.
- Vastleggen gebeurt per taak; pushen alleen op verzoek.

## File Structure

| Bestand | Verantwoordelijkheid |
|---|---|
| `frappe-app/y_next/y_next/doctype/<naam>/` | de zes app-doctypes (JSON, controller, test) |
| `frappe-app/y_next/setup/custom_fields.json` | eigen velden op standaarddoctypes |
| `frappe-app/y_next/setup/permissions.json` | rechten op bestaande doctypes |
| `frappe-app/y_next/setup/master_records.json` | stamgegevens |
| `frappe-app/y_next/setup/install.py` | de drie bestanden toepassen |
| `frappe-app/y_next/tests/test_installatie.py` | bewaakt wat een geïnstalleerde site heeft |
| `scripts/lib/app-definities.mjs` (+ test) | de JSON-bestanden lezen en een app-doctype omzetten voor de REST-route |
| `scripts/provision-y-next.mjs` | gebruikt de gedeelde definities; nieuwe fase voor velden |

---

### Task 1: De zes doctypes als app-doctypes

**Files:**
- Create: `frappe-app/y_next/y_next/doctype/{y_meeting_note,y_next_setting,y_onkostensoort,y_km_registratie,y_onkosten,agenda_koppeling}/`
- Create: `frappe-app/.gitattributes`
- Modify: `scripts/dev-bench-sync.mjs`, `scripts/dev-bench-sync.test.mjs` (vlag `--pull`)
- Test: `frappe-app/y_next/tests/test_installatie.py`

**Interfaces:**
- Produces: de doctypes `Y Meeting Note`, `Y Next Setting`, `Y Onkostensoort`, `Y Km Registratie`, `Y Onkosten` en de enkelvoudige `Agenda Koppeling` (velden `enabled`, `server_url`, `service_account`, `service_password`); `node scripts/dev-bench-sync.mjs --pull` haalt de doctypemap van de bench terug naar de repository.

- [x] **Step 1:** Schrijf in `test_installatie.py` de falende test `test_eigen_doctypes_horen_bij_de_app`: elk van de zes doctypes bestaat met `module == "Y Next"` en `custom == 0`; `Y Next Setting` geeft *Projects User* alleen leesrecht; `Y Km Registratie` geeft *Employee* een rij met `if_owner == 1`; `Agenda Koppeling` is enkelvoudig.
- [x] **Step 2:** Draai `node scripts/dev-bench-sync.mjs` en de Python-tests; verwacht: FAIL (doctypes bestaan niet).
- [x] **Step 3:** Voeg `--pull` toe aan `dev-bench-sync.mjs` (eerst test: `pullSource(config)` geeft `frappe:/workspace/frappe-bench/apps/y_next/y_next/y_next/doctype/.`).
- [x] **Step 4:** Maak de doctypes eenmalig aan op de ontwikkelsite, in ontwikkelmodus, uit de definities van de bouwfuncties in `scripts/provision-y-next.mjs` (met `module: "Y Next"`, `custom: 0`) plus `Agenda Koppeling`. Frappe schrijft de bestanden in de app op de bench.
- [x] **Step 5:** `node scripts/dev-bench-sync.mjs --pull`, verwijder `__pycache__`, controleer de zes mappen.
- [x] **Step 6:** `node scripts/dev-bench-sync.mjs --migrate` en de Python-tests; verwacht: PASS.
- [x] **Step 7:** Vastleggen: `feat: eigen doctypes als app-doctypes`.

### Task 2: Velden, rechten en stamgegevens bij installatie

**Files:**
- Create: `frappe-app/y_next/setup/__init__.py`, `custom_fields.json`, `permissions.json`, `master_records.json`, `install.py`
- Modify: `frappe-app/y_next/hooks.py` (`after_install`, `after_migrate`)
- Test: `frappe-app/y_next/tests/test_installatie.py`

**Interfaces:**
- Produces: `y_next.setup.install.sync_all()`, `sync_custom_fields(definities=None)`, `sync_permissions(regels=None)`, `sync_master_records(records=None)`, `load(naam)`.
- `custom_fields.json`: `{ "<DocType>": [ { "fieldname", "label", "fieldtype", "insert_after", … } ] }`.
- `permissions.json`: `[ { "doctype", "role", "permlevel", "ptype", "value" } ]` — de inhoud van `buildPermissionRules()`.
- `master_records.json`: `[ { "doctype", "name", "payload" } ]` — de inhoud van `DEFAULT_MASTER_RECORDS`.

Velden (15): Project `custom_customer_reference`, `custom_project_manager`, `custom_project_manager_company`, `custom_address`; Task `custom_billing_type`, `custom_project_manager`; Timesheet Detail `custom_is_billed`, `custom_subject`, `custom_project_manager`, `custom_project_manager_company`; Sales Invoice `custom_customer_reference`, `custom_date_paid`; Quotation `custom_description`; Sales Order `custom_description`; Company `disabled`.

- [x] **Step 1:** Schrijf de falende tests: elk veld uit `custom_fields.json` bestaat; elke `insert_after` verwijst naar een bestaand veld; elke rechtenregel waarvan doctype en rol bestaan staat in `Custom DocPerm`; elk stamrecord waarvan het doctype bestaat is aanwezig; `sync_all()` twee keer draaien verandert de aantallen niet; een definitie voor een onbekend doctype wordt overgeslagen.
- [x] **Step 2:** Sync en test; verwacht: FAIL (`y_next.setup.install` bestaat niet).
- [x] **Step 3:** Schrijf de drie JSON-bestanden en `install.py`; registreer de hooks.
- [x] **Step 4:** `node scripts/dev-bench-sync.mjs --migrate` en de Python-tests; verwacht: PASS.
- [x] **Step 5:** Controleer in de browser op de kale site dat de verzoeken voor `Company`, `Project` en de `Y …`-doctypes niet meer falen.
- [x] **Step 6:** Vastleggen: `feat: velden, rechten en stamgegevens bij installatie`.

### Task 3: Het provisioneringsscript leest dezelfde definities

**Files:**
- Create: `scripts/lib/app-definities.mjs`, `scripts/lib/app-definities.test.mjs`
- Modify: `scripts/provision-y-next.mjs`, `scripts/provision-y-next.test.mjs`, `package.json` (script `test`)

**Interfaces:**
- Produces: `readSetup(naam)`, `readAppDoctype(map)`, `toCustomDoctype(appDoctype)` in `scripts/lib/app-definities.mjs`; in het provisioneringsscript `ensureCustomFields({ baseUrl, token, definitions })` → `{ created, existing, skipped }` en de optionele omgevingsvariabele `YNEXT_SITE_NAME` (stuurt `X-Frappe-Site-Name` mee, voor een bench met meer sites).
- `toCustomDoctype` zet `module: "Custom"`, `custom: 1` en vult in elke rechtenrij ontbrekende vlaggen (`read`, `write`, `create`, `delete`, `submit`, `cancel`, `amend`, `if_owner`, `permlevel`) met `0`: de REST-route vult ontbrekende vlaggen anders met de standaardwaarde `1`.

- [x] **Step 1:** Schrijf de falende tests voor `toCustomDoctype` (module/custom, expliciete nullen, velden ongewijzigd) en voor `ensureCustomFields` (bestaand veld → geen POST; ontbrekend veld → POST met `dt`; onbekend doctype → overgeslagen).
- [x] **Step 2:** Draai ze; verwacht: FAIL.
- [x] **Step 3:** Schrijf `app-definities.mjs`; laat de bouwfuncties, `buildPermissionRules` en `DEFAULT_MASTER_RECORDS` uit de gedeelde bestanden lezen; voeg de veldenfase toe na de doctypes.
- [x] **Step 4:** Draai alle scripttests; verwacht: PASS, inclusief de bestaande tests die de exacte velden en rechten vastleggen.
- [x] **Step 5:** Draai het script tegen de lokale site van de publicatieroute (`YNEXT_BASE_URL=http://localhost:8000`, `YNEXT_SITE_NAME=ynext.localhost`); verwacht: de vijf doctypes "bestaat al", 15 velden aangemaakt, en een tweede run maakt niets aan.
- [x] **Step 6:** Vastleggen: `refactor: provisioning leest de definities van de app`.
