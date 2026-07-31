# Y App — Volledig verbeteroverzicht

Elk item is gemarkeerd met ✅ (gedaan), 🟢 (nu uitvoeren) of 🔵 (later).

---

## 🐛 BUGS

### B02 ✅ — "Uren boeken" widget navigeert niet
De "Uren boeken →" knop in de widget op het hoofdscherm navigeert niet naar de
urenregistratiepagina. Knop is zichtbaar maar doet niets of navigeert verkeerd.

### B08 ✅ — Taak dropdown positioneert buiten scherm
Geldt overal waar taken te editen zijn. Bij het openen van een dropdown voor workflow of
taakstatus verschijnen de opties boven het element buiten het zichtbare scherm.
Oplossing: smart positionering via getBoundingClientRect — naar beneden als er
onvoldoende ruimte boven is.

### B03 ✅ — Berichten hoofdtab toont Talk-berichten niet
Talk is werkend maar verschijnt niet op het hoofdscherm van berichten.

### B04 ✅ — E-mail en Talk fetchen steeds opnieuw
Geen persistente state of caching — bij elke sessie of schermwissel wordt opnieuw gefetcht.

### B05 ✅ — Bestanden en afbeeldingen in Talk niet zichtbaar
Bijlagen die via Talk worden doorgestuurd worden niet gerenderd bij de ontvanger.

### B06 ✅ — Mailbox lock timeout & connection errors
Bij meerdere snelle e-mailacties: `Mailbox lock timeout` en `connection not available`.
Oorzaak: te veel gelijktijdige IMAP-verbindingen, ontbrekende connection pooling / queueing.

### B07 ✅ — Collapse-staat e-mailgroepering wordt niet onthouden
Ingeklapte datum/maand-groepen klappen na navigeren of herladen weer uit.
Staat moet worden opgeslagen (localStorage of state management).

### B09 ✅ — Shift hours & activity type op twee plekken (duplicatie)
Shift hours en activity type zijn beiden op twee plekken opgeslagen.
Consolideren naar één centrale bron.

### B10 ✅ — Geen warning bij ontbrekende shift hours
Berekeningen vallen stilletjes terug op standaardwaarde (bijv. 40u).
Bij ontbrekende shift hours een expliciete warning tonen, geen automatische aanname.

### B11 ✅ — Contracturen gebaseerd op naam shift assignment
Contracturen worden bepaald op naam van de shift hour assignment.
Moet worden: werkelijk aantal uren dat in de shift zit per week.

### B12 ✅ — Timesheet "Goedkeuren" submit kwam niet door (facturatie-prep)
Bij Timesheets → Goedkeuren als werkgever drukt op "Goedkeuren" werd de
Timesheet niet daadwerkelijk gesubmit. Root cause: Frappe v15 wijzigde de
signature van `frappe.client.submit` — verwacht nu `{doc: JSON.stringify(doc)}`
i.p.v. `{doctype, name}`. Bestand: [Timesheets.tsx](packages/frontend/src/pages/Timesheets.tsx)
(`handleConfirmApprove`).
Plus: `callMethod` parst nu `_server_messages` / `exc` zodat ERPNext-fouten
zichtbaar worden in plaats van een generieke "API error: 500".

---

## ✉️ E-MAIL & COMMUNICATIE

### F05 ✅ — Multiple select van e-mails
Meerdere e-mails tegelijk selecteren via checkboxes voor bulkacties:
verplaatsen, archiveren, koppelen aan taak, verwijderen.

### F06 ✅ — Nieuwe e-mailmap aanmaken op basis van project (vanuit e-mail)
Vanuit e-mail → nieuwe map: een project selecteren als basis voor de mapnaam.
Mapnaam automatisch opgebouwd uit projectnummer + naam met prefix:
- `[IN]` voor inbox-map
- `[OUT]` voor verzonden-map
Voorbeeld: `[IN] 0001 — 3BM Engineering`
(Aanmaken vanuit het project zelf: later)

### F07 ✅ — Zoeken in e-mail inclusief submappen
Bij zoeken een vinkje toevoegen "ook zoeken in submappen".
Standaard zoekt alleen in de huidige map.

### F01 🔵 — Meerdere e-mailadressen per organisatie
Ondersteuning voor een algemeen info-adres én een gedeeld postvak (shared mailbox)
dat door meerdere medewerkers beheerd kan worden.

### F02 🔵 — E-mail flaggen & bidirectioneel koppelen aan taak
E-mails flaggen en koppelen aan een taak. Naam aanpasbaar, link blijft behouden.
Afvinken werkt bidirectioneel: taak afvinken → mail gemarkeerd en vice versa.

### F03 🔵 — Smart e-mail acties vanuit Thunderbird
Slimme acties op inkomende e-mails: taak aanmaken, toewijzen, archiveren.
Bouwt voort op F01 en F02.

### F04 🔵 — E-mail versturen vanuit de app
Templates voor facturen, orderbevestigingen, offertes en betalingsherinneringen.
Gekoppeld aan het betreffende document of project.

---

## 🕐 TIJDREGISTRATIE

### F08 ✅ — Compactere invoervelden km & uren (ERP-stijl)
Zie screenshot voor huidige opzet (uren boeken + km boeken widgets).
- Alle velden op één rij waar mogelijk
- Smallere inputvelden, minder verticale ruimte
- VAN / TOT / DUUR inline naast elkaar
- KM / TYPE / OMSCHRIJVING op één rij
- Labels klein boven het veld
- Knop "Boeken" rechts uitgelijnd
Doel: beide widgets nemen significant minder schermruimte in.

### F09 ✅ — Urenregistratie overzicht: individuele boekingsrijen voor medewerker
Huidige situatie: timesheet-documentnamen als rijen.
Gewenst: individuele boekingsregels zonder groepering per timesheet.
- Filterbaar op periode
- User restrictions: medewerker ziet alleen eigen uren
- Medewerker kan dit overzicht bereiken vanuit zijn eigen scherm

### F10 ✅ — Default activiteitstype per medewerker
In de medewerkersinstelling een standaard activiteitstype instellen dat automatisch
wordt voorgeselecteerd bij tijdregistratie.

### F27 ✅ — Filter-preset "Vorige maand" op Timesheets Overzicht & Goedkeuren (facturatie-prep)
Naast bestaande presets ("Vorige week", "Vorige 4 weken", "Dit jaar") ook
"Vorige maand" toegevoegd. Beide tabs: Overzicht én Goedkeuren.

### F28 ✅ — Goedkeuren-tab: +/- delta t.o.v. contract-uren naast totaaluren (facturatie-prep)
In de Timesheets → Goedkeuren-lijst staat per timesheet en per medewerker-groep
de delta in uren (groen=plus, rood=min). Verwachte uren worden berekend met
dezelfde exclusie-logica als "Missende werkdagen" widget: shift-plan workdays,
holiday list, leaves, date_of_joining. Bestand: `Timesheets.tsx` `getExpectedHours`.

### F32 ✅ — Goedkeuren-tab: validatie op verwacht activity_type per medewerker (facturatie-prep)
Per time_log in een Timesheet wordt gecontroleerd of `activity_type` overeenkomt
met de per-medewerker setting (`employee-activity-types`). Mismatch → amber-
highlight in de Activity Type kolom + warning "Verkeerd type" in de
ValidationModal bij approve. Niet hardcoded — vanuit Settings → Medewerker
instellingen.

---

## 📁 PROJECT & TAKEN

### F18 ✅ — Volledige tekstopmaak in taakomschrijving (kopieer van ERP)
Alle opmaakopties overnemen die beschikbaar zijn in het ERP:
vet, cursief, onderstreept, bullets, genummerde lijst, koppen, links, tabellen.

**Bijbehorende bug:** Als de cursor in een opsomming staat en tekst wordt bewerkt,
klapt de sidebar in. Sidebar moet open blijven tijdens bewerken van omschrijvingsveld.

### F11 🔵 — Projectinzicht & planning 🔴 HOGE PRIORITEIT
Volledig projectoverzicht met planning:
- Hoofd- en subtaken, voortgang, deadlines
- Koppeling naar todo/taakoverzicht
- Alle projectcommunicatie (e-mail, taken, notities) gegroepeerd per project
- Projectlay-out opnieuw doordacht

### F12 ✅ — Taaktemplate per project/opdrachtgever
Bij aanmaken van een project automatisch standaardtaken laden op basis van
projecttype of opdrachtgever. Templates configureerbaar.

### F13 🔵 — Project aanmaken vanuit sales order
Project aanmaken of koppelen vanuit een bestaande sales order.
Projectgegevens overnemen, orderregels omzetten naar taken.

### F14 🔵 — Logica urenbasis vs. vaste prijs per taak
Bij aanmaken van taken vanuit template of order automatisch bepalen:
urenbasis (timesheet) of vaste prijs (fixed price).
Doorwerking naar facturatie en tijdregistratie.

### F15 🔵 — Archiveren van projecten (app + e-mail + NAS)
Archivering consistent over drie plekken: projectstatus, e-mailmap, NAS-map.
Archiveren op één plek triggert de andere twee.

### F16 ✅ — Nieuwe taak inline aanmaken
Taak aanmaken vanuit taakoverzicht, inline of via compact formulier.
Koppeling naar project mogelijk.

### F17 🔵 — Taken & subtaken in sidebar onder "Taken & Planning"
Taken en subtaken verplaatsen naar vaste plek in sidebar onder kopje "Taken & Planning".

---

## 👥 MEDEWERKERS & HR

### F20 🔵 — Workflow automatisering medewerkers — EERST VOLGENDE
Taken en workflow automatiseren. Aparte scope, staat los van projectaanmaken.

### F22 🔵 — Dashboard wetgevers-overzicht — onderdeel van F20
- Km / uren: wie heeft ingevuld, wie niet?
- Submitstatus urenstaten
- Facturen verstuurd / nog te versturen
- Betalingen ontvangen / openstaand / te doen
- Urgente mails & taken
- Jaardoelen (uren, omzet, KPI's)

### F19 🔵 — Medewerker aanmaken: volledig onboardingformulier
Contract, shiftassignment, adres, vakantierechten.
Validatie: geen vakantie aanvragen zonder actieve shiftassignment.
Shiftassignment-module herschrijven in frontend.

### F21 🔵 — Jaarlijkse herinneringen: shift, vakantie, overuren
Automatische herinneringen per jaar voor: shiftassignment verlengen,
vakantiedagen toewijzen, overuren afhandelen.

### F30 ✅ — Management Dashboard: per-dag missende werkdagen kaart (facturatie-prep)
Op Management Dashboard kaart "Missende werkdagen" die per actieve medewerker
toont op welke werkdagen er nog géén uren zijn geboekt. Shift-plan-aware
(alleen verwachte werkdagen tellen mee), exclusief feestdagen (per-employee
Holiday List + NL fallback), exclusief goedgekeurd verlof, exclusief dagen
vóór `date_of_joining`. Default laatste 5 weken, "Toon hele jaar"-knop in
uitklap. Items gegroepeerd per datum (nieuw→oud), platte regel per medewerker.

### F31 ✅ — Management Dashboard: kaart "Kilometers goedkeuren" (facturatie-prep)
Net als de bestaande "Timesheets goedkeuren"-kaart, een identieke kaart voor
Travel Requests met `docstatus=0`. Plus tweede kaart "Missende kilometers"
analoog aan "Missende werkdagen" maar checkt Travel Request itinerary i.p.v.
Timesheet time_logs.

### F33 ✅ — Management Dashboard: facturen verstuurd deze maand (facturatie-prep)
Nieuwe kaart in Financieel-sectie: telt Sales Invoices (docstatus=1) met
posting_date in de huidige kalendermaand. 0 verzonden → attention, ≥1 → ok
met "{n} facturen — totaal {bedrag}".

### F34 ✅ — Sidebar: Employee-rol toegevoegd aan ROLE_PAGE_MAP (bug-fix)
Medewerkers met alleen de "Employee" rol zagen geen timesheets/leave/expenses/
projects/tasks. ROLE_PAGE_MAP miste de "Employee" en "Employee Self Service"
rollen. Nu krijgen ze toegang tot timesheets, leave, expenses, projects, tasks,
subtasks, planning.

### F44 🟢 — Management Dashboard: te beoordelen verlofaanvragen + sidebar-badge
Employer-only widget op het Management Dashboard met het aantal openstaande
verlofaanvragen (`Leave Application` met `status === "Open"`) plus korte lijst
(max 5: medewerker, type, periode, dagen). Klik op header navigeert naar
`/leave`. Parallel: numerieke badge op het sidebar-item "Verlof" voor
employers, ge-update via `setBadgeCount("leave", N)` zodra `useLeaves()`
verandert. Employee-modus toont noch widget noch badge. Hergebruikt de
bestaande DataContext-prefetch (geen server-werk). Plan:
`C:\Users\Piet\.claude\plans\voeg-aan-het-plan-quirky-twilight.md`.
Overuren expliciet niet — geen aanvraag-flow.

---

## 💰 ONKOSTEN & FACTURATIE

### F29 ✅ — Onkostendeclaratie Overzicht: per-maand groepering (facturatie-prep)
Op de "Overzicht" tab van Onkostendeclaratie: zowel Travel Requests als
Expense Claims per maand groeperen, huidige maand standaard uitgevouwen.
Travel Requests: chevron per regel om itinerary (ritten) van die declaratie
uit te klappen.

### F35 ✅ — Te factureren: jaaroverzicht-default, groep-per-klant, zoek + kolomfilters (facturatie-prep)
- Aparte date-state op te-factureren tab; default = 1 jan → laatste dag
  vorige maand (i.p.v. quartaal-start van "alle facturen" tab)
- Toggle "Groepeer per klant" met klant-header tussen projecten;
  projecten binnen klant gesorteerd op project-key DESC
- Zoekbalk filtert op klant / projectnummer / projectnaam
- Excel-stijl kolomfilter (checkbox-dropdown) op Medewerker, Activiteit,
  Taak, Billable, Invoice kolommen

### F36 ✅ — Invoice modal: editable preview + uitklap timesheets + PDF onder
- Boven: bewerkbare factuurregels (omschrijving / aantal / tarief),
  inline opslaan via floppy-icoon
- Per regel chevron → gekoppelde uren-rijen (datum, activiteit, omschrijving, uren)
- Onder: live PDF in iframe via `frappe.utils.print_format.download_pdf`
- Toggle tussen "Factuur nieuw" en "Factuur nieuw met urenstaat"
- Modal breder gemaakt (max-w-5xl) zodat A4-preview past

### F40 🟢 — Verstuur factuur als e-mail vanuit Y-app (WIP, blokker)
**Status:** geïmplementeerd via ERPNext's eigen `frappe.core.doctype.communication.email.make` (niet de Y-app SMTP-flow). Architectuur: ERPNext = single source of truth, Y-app slaat alleen 2 defaults op per instance (`default_email_template` + `default_print_format`). Communication-record verschijnt in invoice-timeline, mail komt vanaf de juiste outgoing Email Account.

**Werkend in deze sessie gebouwd:** `SendInvoiceModal` (preview links, edit-baar form rechts), `BulkSendDrawer` (sequentieel meerdere facturen), `lib/invoiceEmail.ts` (wrappers), Settings-sectie "Factuur versturen", wiring in SalesInvoices + ToInvoice + InvoiceModal.

**Iteratie na user-testing (4 bugs):**
1. Body als HTML → contentEditable
2. Verkeerde print template → strict default (geen fallback)
3. Verkeerde From-address → Employee-based resolution (User → Employee.user_id → Employee.company_email → Email Account.email_id) met `{preferred, options}` voor dropdown-override
4. Jinja-placeholders niet ingevuld → doc als object meegeven aan `get_email_template`, niet als string

**Code-review (2 critical + 4 important + 2 nice-to-have) doorgevoerd:** BulkSendDrawer fallback-template weg, body-editor mount-sync, submit-then-send atomicity (effectiveMode), bulk cancel flag, missing i18n key.

**⚠️ Open voor volgende sessie:**
- HTTP 500 op Settings save (`PUT /api/instances/:id/settings/invoice-email-defaults`) — backend gerestart voor live log, stacktrace nog niet ingezien
- From-address dropdown UI-wiring nog niet af (data layer + type wel)
- End-to-end test met echte factuur

Zie [SESSION_LOG.md 2026-05-17](../SESSION_LOG.md) voor volledige context.

### F39 🔵 — Echte 3BM-briefpapier (G20) in invoice preview integreren
Het officiële briefpapier van 3BM (G20-template) moet netjes inkomen in de
in-app invoice preview en in de uiteindelijke download. Nu gebruikt de
Print Format het ge-hardcodede logo + footer per bedrijf, maar het echte
briefpapier (achtergrond, kop/voet) van G20 zit nog niet in de print
pipeline. Uitzoeken: waar bewaart G20 het briefpapier (Letter Head doctype
in ERPNext? CSS background-image? File-attachment?) en hoe we het in onze
Print Format kunnen inhaken zonder dat we voor elk bedrijf opnieuw het
template moeten dupliceren.

### F38 🔵 — Invoice modal preview: logo + layout tweaks + PDF export-knop (later)
Open punten nadat de basis-preview via `/api/printview-html` werkt:
- Letterhead/logo komt nog niet altijd correct in de iframe-preview
  (de PDF zelf wel via desk). Mogelijk komt het door ontbrekende
  CSS/assets die normaal via ERPNext desk's bundle worden geladen —
  oplossing: ofwel een `<base href>` of de assets via de proxy ook
  doorsturen.
- Visuele finetuning: padding, schaling, A4-verhouding in de modal.
- Aparte "Download PDF" knop (naast de format-toggle) die de PDF blob
  forceert te downloaden i.p.v. inline openen.

### F37 ✅ — Variant: alleen taken op urenbasis printen op factuur
Opgelost door nieuwe Print Format `3BM Factuur+Smart Urenstaat`
(zie SESSION_LOG 2026-05-15/16). Jinja namespace-filter selecteert
alleen `doc.timesheets`-rijen waarvan `Task.custom_billing_type ==
"Timesheet based"`. Default Print Format in de Y-app invoice modal.

### F41 🔵 — Fix-price flow afronden (vaste-prijs taken, bv. KLH Landman)
Huidige flow legt vaste-prijs-taken neer als één Sales Invoice Item met
`item_code = "Aangenomen werk"`, `qty = 1`, `rate = 0`, en de gebruiker
moet het bedrag handmatig invullen via het floppy-icoon in de invoice
modal. Wenselijk:
- Veld `Task.custom_fixed_amount` (Currency) — afgesproken vaste prijs
- Veld `Task.custom_invoice_name` (Data) — tekst die op de factuur komt
  i.p.v. de raw `subject`
- Y-app vult `rate` en `item_name` automatisch uit deze velden in de
  Sales Invoice Item bij `createDocument("Sales Invoice", ...)`
- Optioneel: ondersteun deel-facturen (eerste 50% bij start, rest bij
  oplevering) — een `Task.custom_milestone_pct` of soortgelijk
- Voorbeeld-case: project KLH Landman heeft Schetsontwerp €4.500, VO
  €6.000, DO €8.000. Per fase moet er een factuur uit met de juiste
  omschrijving + bedrag, terwijl medewerkers normaal hun uren op die
  taken blijven boeken (kostprijs / interne registratie).

### F43 🟢 — Invoice-rate komt uit Item-prijs i.p.v. Delivery Note rate
Bij het aanmaken van een factuur herkent de Te-factureren-flow correct of er
een Delivery Note voor het project bestaat en matcht hij de taak op
omschrijving. **Maar** de `rate` op de Sales Invoice Item-regel wordt nu
hardcoded op `0` gezet, waarna ERPNext via Item Price / standard_rate
terugvalt op een generieke prijs. De op de Delivery Note Item-regel
**afgesproken** rate (veld `rate` op Delivery Note Item) wordt genegeerd.

**Gevolg:** een projectprijs die met de klant is overeengekomen en in de DN
is vastgelegd, wordt op de factuur stilletjes overschreven door de generieke
Item-prijs uit de prijslijst.

**Locatie:** [ToInvoice.tsx:902-911](../packages/frontend/src/pages/ToInvoice.tsx#L902-L911)
(de `items.push(...)` met `rate: 0, price_list_rate: 0`).

**Gewenste flow:**
1. Vóór het bouwen van het invoice-item: haal Delivery Note(s) op voor
   `projId` via `fetchList("Delivery Note", { filters: [["project","=",projId]], ... })`.
2. Per DN-item op `item_code` (of naam) matchen met de huidige taak.
3. Bij match: `rate = dnItem.rate` (en `price_list_rate = dnItem.rate`)
   gebruiken i.p.v. `0`.
4. Geen match → huidige fallback (laat ERPNext de Item-prijs invullen).

**Gerelateerd:** F41 (Fix-price flow) — beide raken rate-bepaling voor
vaste-prijs taken. Commit `9c66840` introduceerde de Item-matching maar
sloeg de DN-laag over.

### F42 🔵 — In-app info-scherm: hoe werkt factureren in Y-app?
Klein "?" icoontje in de invoice modal (en/of in de Te-factureren-tab)
dat een uitleg-overlay opent met de kerngedachte:
- **Item** = de factuurregel-soort (Senior Bouwkundige, Aangenomen werk, …)
- **Activity Type** = het uurtarief per soort werk
  (`billing_rate`)
- **Item price** = optionele rate-override per klant of project
- **Task.custom_billing_type** = "Timesheet based" of "Fixed" — bepaalt
  of de uren als specificatie op de factuur verschijnen
- Volgorde waarin ERPNext `rate` bepaalt (handmatig > Price List >
  Activity Type > Item standard_rate)
- Bron-document: [docs/invoicing-workflow.md](./invoicing-workflow.md)
  (link in het scherm)
- Doel: voorkomen dat de boekhouder/werkgever moet onthouden welk veld
  waar vandaan komt. Eén klik, korte uitleg, link naar volledig MD-bestand.

---

## ⚙️ INSTELLINGEN & PLATFORM

### F23 ✅ — Instellingen opruimen (medewerkerweergave)
- Sectie "Bedrijven" verwijderen
- Sectie "Backend status" verwijderen
- Sectie "Modules" hernoemen (bijv. "Koppelingen" of "Integraties")

### F24 🔵 — Aparte secties persoonlijke & ontwikkelmodules
Persoonlijke instanties van externe tools (GitHub, Montyviewer) en eigen
ontwikkelmodules, gescheiden van bedrijfsomgeving maar geïntegreerd beschikbaar.

### F25 🔵 — Mobiele én desktop versie
Volwaardige mobiele versie én desktopversie met eigen geoptimeerde layouts.

### F26 🔵 — Stabiele build & auto-update
- Versioned settings schema met forward-compatibiliteit
- Fallback bij corrupte of ontbrekende instellingen
- Testpipeline die build-brekers vroegtijdig pakt
- Auto-update op de achtergrond zonder dataverlies

---

## 🗂️ OVERIG

### O01 🔵 — Knowhow migreren van Joplin naar NAS
Kennisbank migreren naar NAS, toegankelijk vanuit de app of via vaste mapstructuur.

### O02 🔵 — Mastaba: aparte instance met afwijkende logica
Overleg mastaba: instance van hele andere dingen (extension manager, 1 extra pagina met afwijkende logica + totaal andere dingen). Lokaal draaiend: natuursteen calculatie, Speckle omgeving, etc.

### O03 ✅ — Hoe omgaan met 0-uren contract?
Logica bepalen voor medewerkers met een 0-uren contract: geen vaste contracturen,
geen overurenberekening, maar wel urenregistratie en verlof.

### O04 🔵 — Combinatie van kanban + planning
Kanban en planning (Gantt) samenvoegen tot één geïntegreerde weergave.

---

## 🔵 Wachtend op externe instructies

Deze items worden geïmplementeerd zodra de gedetailleerde instructies van de externe partij
binnen zijn. NIET nu zelf bedenken / implementeren — eerst specificaties afwachten.

- [ ] **Projecten sorteren per project** — gewenste kolom-volgorde / groeperingscriteria onbekend
- [ ] **Archiveren** — voor welke entiteiten (projecten / taken / mails) en wat is "gearchiveerd" precies
- [ ] **Doorzoeken** — global search uitbreiden, naar welke entities en met welke ranking
- [ ] **Facturen inboeken** — koppeling tussen ERPNext Sales Invoice / Purchase Invoice en eboekhouden mutatie
- [ ] **Offertes aanmaken** — Quotation-workflow met PDF-template (welke template? rules?)
- [ ] **Project aanmaken** — verbeterde flow (klant-template, adres-pickup, betere defaults?)
- [ ] **Taak aanmaken** — uitbreiden van bestaande task-creator (extra velden? wizard?)
