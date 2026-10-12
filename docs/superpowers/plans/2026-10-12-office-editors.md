# Office-editors: uitvoeringsplan

**Doel:** Word en Excel openen, bewerken en als nieuwe versie opslaan op de
lokale ERPNext 16-site, met installatie-instructies voor gebruikers.

**Architectuur:** lazy React-editoradapters delen een Office-werkplek.
Permission-checked Frappe-methods lezen File en schrijven private kopieën;
een receipt koppelt elke save aan één UUID en de bestaande sessiegebruiker.

**Stack:** React, TypeScript, Folio, BetterOffice/WASM, Frappe 16, Python.
**Spec:** [editorontwerp](../specs/2026-10-12-office-editors-design.md).
**Uitvoering:** frontend en backend hebben eigen bestanden; integratie,
README, build en lokale verificatie worden centraal uitgevoerd.

## Grenzen

- Eén Frappe-site en de bestaande sessie.
- Maximaal 20 MiB of de lagere sitelimiet; geen externe documentverzoeken.
- Origineel blijft intact; private kopie erft dezelfde documentkoppeling.
- Geen geheimen, organisatiegegevens of conversatie-inhoud in bron of fixtures.
- Geen push of productiedeploy.

## Reviewfocus

- Onbekende save-uitkomst mag geen dubbel File opleveren.
- Bronwijziging tijdens bewerken geeft een conflict.
- Verder typen tijdens opslaan mag nooit als opgeslagen worden gemarkeerd.
- Private bytes vereisen actuele File- en ouderrechten.
- Onbekende OOXML-delen blijven behouden; corrupt of te groot pakket faalt zichtbaar.

## Taken

### 1. Installatie en documentatie

- [x] Werk `README.md` en `frappe-app/README.md` bij met release, Bench en Claude-import.
- [x] Controleer private toegang, bestaande releasebundel en relatieve links.
- [x] Toon de gepubliceerde en lokale editorstatus afzonderlijk.

### 2. Frappe Office-opslag

Bestanden: `frappe-app/y_next/api/office.py`, pakketvalidatiehelper,
`frappe-app/y_next/y_next/doctype/y_office_save/`, Frappe-testmodule.

- [x] Test exact File/parent-read en write-eligibility van `open_file`.
- [x] Implementeer metadata en binaire read uit gecontroleerde File-docs.
- [x] Test privéversie, oorspronkelijke bytes en UUID-retry/status.
- [x] Implementeer POST `save_file` en GET `save_status` conform spec.
- [x] Test guest, denied parent, stale SHA, andere actor/input en pakketgrenzen.

### 3. React Office-werkplek

Bestanden: `packages/frontend/src/components/office/`, Office-pagina, App/sidebar,
mailbijlagen, projectbijlagen en drie taalbundels.

- [x] Pin editorversies en onderzoek hun save/locale/asset-API.
- [x] Test Office-service requestvelden, CSRF, conflict en statusreconciliatie.
- [x] Implementeer dynamische editoradapters en de gedeelde werkplek.
- [x] Test openen, dirty-state, save-capture, source race en onzekere uitkomst.
- [x] Voeg open-acties toe aan mail en projecten en start lokale documenten.

### 4. Lokale build en acceptatie

- [x] Draai frontendtypecontrole en de relevante Node-tests.
- [x] Bouw met `node scripts/build-frappe-app.mjs`.
- [x] Controleer appkopie op de testbench; sync met `--migrate` naar `kaal.localhost`.
- [x] Draai Frappe Office-tests plus bestaande appregressies.
- [ ] Open `/y-next` ingelogd en controleer DOCX/XLSX edit/save/heropen.
- [ ] Controleer opgeslagen bytes onafhankelijk en registreer formatbeperkingen.
- [ ] Controleer diff, secret/generiekregels en werkstatus; laat lokale resultaat-tab open.

### 5. Startscherm

- [x] Voeg de acht app-iconen toe boven de bestaande dashboardwidgets.
- [x] Open Email, Berichten, Agenda en de twee editors via interne routes.
- [x] Open CAD lokaal indien beschikbaar; CAD/Planner anders in een veilig nieuw tabblad.
- [x] Voeg de lokale IFC-opener toe, met type-, inhoud- en omvangcontrole.
- [ ] Controleer de startpagina en routes ingelogd in de lokale browser.

## Acceptatiestatus

De lokale build toont het vernieuwde dashboard en de acht app-iconen.
Word en Excel renderen synthetische ERPNext-bestanden; de host-opslagacties
worden beschikbaar nadat de editor gereed is. De urenkaart blijft binnen
zijn kaartbreedte op de gecontroleerde desktopweergave.

De code- en API-tests controleren private kopieën, retries, bronbehoud en
pakketonderdelen. De volledige handmatige browsercyclus bewerken, opslaan,
downloaden en heropenen blijft apart te bevestigen. Er is geen claim van
volledige Office-formatcompatibiliteit. De README vermeldt de puntnotatie
voor Excel-invoer en de overige beperkingen.
