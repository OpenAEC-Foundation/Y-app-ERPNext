# Facturatie-workflow — Y-app + ERPNext

> Hoe Y-app een Sales Invoice opbouwt uit Timesheets en Tasks, welke
> ERPNext-velden waar vandaan komen, en welke handmatige stappen er
> overblijven. Doelpubliek: gebruikers (boekhouder / werkgever) die wil
> begrijpen wat er gebeurt als ze in de Te-factureren-tab een paar
> regels selecteren en op "Factureer geselecteerd" klikken.

Cross-references:
- [SESSION_LOG.md](../SESSION_LOG.md) — chronologie van de implementatie
- [docs/y-bugs.md](./y-bugs.md) — open punten (F36 ✅, F37 ✅, F38, F39, F40, F41, F42)

---

## Het mentaal model (30 seconden)

Een **Sales Invoice** in ERPNext is een lijst regels (**Sales Invoice Item**).
Elke regel heeft:

| Veld           | Wat het is                                                    |
|----------------|---------------------------------------------------------------|
| `item_code`    | Verwijzing naar een **Item** doctype (verplicht, sleutel)     |
| `item_name`    | Tekst die op de PDF staat (vrij in te vullen)                 |
| `qty`          | Aantal (uren of stuks)                                        |
| `rate`         | Bedrag per stuk (€/uur of vaste prijs)                        |
| `amount`       | qty × rate (door ERPNext berekend)                            |

Daarnaast heeft een Sales Invoice een **child table `timesheets`** waarin
losse Timesheet Detail-rijen worden gelinkt (datum, medewerker, uren).
Dit is wat in de PDF onder "Specificatie" / "Urenstaat" verschijnt.

**Twee soorten regels** komen voor:

1. **Timesheet-based** — uren × tarief. Eén regel per Activity Type,
   `qty = som van uren`, `rate = billing_rate van Activity Type`.
2. **Fixed price / Aangenomen werk** — vaste prijs per taak. Eén regel,
   `qty = 1`, `rate = afgesproken bedrag`.

Welke kant een taak op gaat wordt bepaald door **`Task.custom_billing_type`**:
- `"Timesheet based"` → uren-regel
- `"Fixed"` / anders → vaste-prijs-regel

---

## De drie sleutelvelden

### 1. Item (de factuurregel-soort)

Een **Item** in ERPNext is een product- of dienstcategorie. Voor 3BM zijn
er een handvol service-items:

- `Senior Constructeur`
- `Senior Bouwkundige`
- `Senior BIM-modelleur`
- `Medior Bouwkundige`
- `Junior` …
- `Aangenomen werk` (catch-all voor fixed-price)

Het `item_code` op een Sales Invoice Item verwijst naar deze Item. ERPNext
gebruikt het Item om defaults op te halen (income_account, cost_center,
btw-tarief, eenheid). De **`item_name`** is wat daadwerkelijk op de PDF
verschijnt — vrij overschrijfbaar per regel.

### 2. Activity Type (het uurtarief)

Een **Activity Type** in ERPNext koppelt een type werk aan een tarief:

| Activity Type        | billing_rate (€/uur) | costing_rate (€/uur) |
|----------------------|----------------------|----------------------|
| Senior Constructeur  | 110                  | 85                   |
| Senior Bouwkundige   | 110                  | 85                   |
| Medior Bouwkundige   | 95                   | 70                   |
| …                    | …                    | …                    |

Elke regel in een **Timesheet** krijgt een `activity_type`. Bij het maken
van de Sales Invoice (Y-app's flow in [packages/frontend/src/pages/ToInvoice.tsx](../packages/frontend/src/pages/ToInvoice.tsx))
worden de timesheet-rijen per `activity_type` gegroepeerd, totaal-uren
opgeteld, en als één Sales Invoice Item ingevoegd:

```ts
const items = [];
for (const [activity, rows] of byActivity) {
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  items.push({
    item_code: activity,        // "Senior Bouwkundige"
    qty: totalHours,            // bv. 23.5
    project: projId,
  });
}
```

ERPNext vult dan `rate` op uit de **Activity Type's `billing_rate`** (of
uit het Price List als `item_code` daar een entry heeft — afhankelijk van
configuratie). Dat is de plek waar het uurtarief vandaan komt.

> ⚠️ **Mismatch-risico:** een Item-naam (bv. `Senior Bouwkundige`) hoeft
> niet 1-op-1 te matchen met een Activity Type-naam. In 3BM's setup zijn
> ze met opzet identiek genaamd zodat het Item-record per Activity Type
> bestaat. Als een nieuwe Activity Type wordt toegevoegd zonder bijbehorend
> Item, geeft ERPNext een fout bij het submitten.

### 3. Item price (rate-override)

Buiten het Activity Type-tarief om kan een **Item Price** in een
**Price List** een vast tarief per Item zetten. Volgorde van prioriteit
bij het bepalen van `rate` op een Sales Invoice Item:

1. Handmatig ingevuld op de regel (Y-app's editable invoice modal)
2. Item Price uit het actieve Price List (per Customer / Company)
3. Activity Type's `billing_rate` (alleen voor timesheet-gekoppelde items)
4. Item's `standard_rate` (laatste redmiddel)

De Y-app invoice modal toont de `rate` zoals ERPNext hem berekend heeft,
en laat de gebruiker hem inline overschrijven (floppy-icoon = opslaan).

---

## End-to-end: van Timesheet tot betaalde factuur

```
Timesheet (medewerker)
  └─ time_logs[]: { date, hours, activity_type, project, task, description }
       │
       ▼  goedgekeurd door werkgever (Timesheets → Goedkeuren)
       │
Te-factureren-tab (Y-app)
  └─ Toont alle goedgekeurde, nog-niet-gefactureerde time_logs
  └─ Gegroepeerd per klant → project → activity_type
  └─ User selecteert wat hij wil factureren
       │
       ▼  "Factureer geselecteerd"
       │
Y-app stelt Sales Invoice samen:
  · items[]: één regel per activity_type (qty = totaal uren)
  · items[]: één "Aangenomen werk" regel per fixed-price taak
  · timesheets[]: links naar individuele time_logs (voor urenstaat-bijlage)
       │
       ▼  createDocument("Sales Invoice", {...})  → DRAFT
       │
Invoice modal (Y-app)
  └─ Editable preview: omschrijving / aantal / tarief per regel
  └─ Klant editable in header
  └─ Per regel chevron → uren-rijen (datum/medewerker/taak/omschrijving/uren)
  └─ "Op factuur?" badge per uren-rij
       (= true als regel in urenstaat-PDF voorkomt — afh. van Print Format)
  └─ Print Format dropdown: "Smart Urenstaat" (default) / "Factuur Nieuw" / "Factuur+Urenstaat Nieuw"
  └─ HTML preview via /api/printview-html
       │
       ▼  Submit (handmatig in ERPNext desk, óf via Y-app "Goedkeuren"-knop)
       │
ERPNext: Sales Invoice docstatus = 1
  · posting_date, due_date, taxes & charges auto-applied
  · `outstanding_amount` = totaal (open vordering)
       │
       ▼  Verstuur naar klant (F40 ✅ via SendInvoiceModal — sinds v0.19.0)
       │
Betaling → Payment Entry → outstanding_amount = 0
```

---

## Wat ziet de gebruiker waar?

### In de Te-factureren-tab

- Per klant een groep, daaronder per project een rij
- Uitklap → individuele time_logs (selecteerbaar)
- Kolommen: Medewerker | Datum | Activiteit | Taak | Omschrijving | Uren | Billable | Invoice
- **Billable** = `Task.custom_billing_type` (Timesheet based / Fixed / leeg)
- **Invoice** = bestaande Sales Invoice-link (leeg = nog te factureren)
- Filters: zoekbalk (klant/projectnaam/-nummer), Excel-stijl kolomfilters

### In de invoice modal (na "Factureer geselecteerd")

- **Header:** klant (editable), factuurnummer, datum
- **Regels (editable):** item_code, item_name, qty, rate. Floppy = opslaan
- **Per regel chevron → uren-rijen:** datum, medewerker, taak, activiteit,
  omschrijving, uren. Per rij een badge "Op factuur?" die aangeeft of
  deze uren in de urenstaat-PDF voorkomen (afhankelijk van Print Format).
- **Print Format toggle:**
  - `3BM Factuur+Smart Urenstaat` — **default**. Alleen
    timesheet-based taken in urenstaat, vaste-prijs als één regel zonder
    uren-detail
  - `3BM Factuur Nieuw` — geen urenstaat, alleen factuurregels
  - `3BM Factuur+Urenstaat Nieuw` — alle uren in urenstaat
- **HTML preview** + **Open / Print PDF** knop (browser print → Save as PDF)

---

## Stap-voor-stap: Te-factureren → Sales Invoice

> Concrete uitleg van wat Y-app doet als je in de **Te-factureren**-tab
> uren selecteert en op "Factureer geselecteerd" klikt. Geschreven om
> 1-op-1 te kunnen overnemen in een info-scherm (F42).

### Stap 1 — Inputs verzamelen

Y-app start met een lijst geselecteerde **time_logs** (Timesheet Detail rijen).
Elke time_log heeft vier velden die er voor de factuur toe doen:

| Veld op time_log | Wat het is                                                |
|------------------|-----------------------------------------------------------|
| `project`        | Project waaraan deze uren gekoppeld zijn                  |
| `task`           | Specifieke taak binnen het project (mag leeg zijn)        |
| `activity_type`  | Soort werk — bv. "Senior Bouwkundige", "Junior BIM"       |
| `hours`          | Aantal uren                                               |

Y-app fetcht parallel per taak: `Task.custom_billing_type` (= `"Timesheet based"`
of `"Fixed"` / iets anders). Dit is dé schakelaar die bepaalt of de uren
straks **op de PDF** verschijnen of alleen **gelinkt** worden.

### Stap 2 — Splitsen op billing-type per taak

Per project worden de geselecteerde rijen in twee buckets verdeeld:

```
projRows
├─ timesheetRows   = rijen waarvan Task.custom_billing_type == "Timesheet based"
│                    (of: taak heeft helemaal geen custom_billing_type → default = timesheet)
└─ fixedRows       = rijen waarvan Task.custom_billing_type ≠ "Timesheet based"
                     (bv. "Fixed", "Milestone", "Progress")
```

### Stap 3 — Timesheet-based: groeperen op Activity Type

Y-app loopt door `timesheetRows` en groepeert op `activity_type`. Per
groep wordt **één Sales Invoice Item** aangemaakt:

```ts
for (const [activity, rows] of byActivity) {
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  items.push({
    item_code: activity,       // bv. "Senior Bouwkundige"
    qty: totalHours,           // bv. 23.5
    project: projId,
    // rate wordt door ERPNext gevuld — zie Stap 4
  });
}
```

Belangrijke conventie: **`item_code` = de Activity Type-naam**. Dat
betekent dat er voor elke Activity Type een gelijknamig **Item**-record
moet bestaan in ERPNext, anders weigert ERPNext de Sales Invoice met
"Item not found".

In de 3BM-setup is dat zo opgezet:
- Activity Type `Senior Bouwkundige` → bestaat ook als Item `Senior Bouwkundige`
- Activity Type `Medior Bouwkundige` → bestaat ook als Item `Medior Bouwkundige`
- enzovoorts

> ⚠️ Een nieuwe Activity Type moet altijd in **drie plekken** worden
> toegevoegd: (1) Activity Type doctype zelf, (2) Item doctype met
> dezelfde naam, (3) `billing_rate` invullen op de Activity Type. Anders
> komt er een fout of een €0-regel uit.

### Stap 4 — Tarief bepalen (`rate`)

Y-app stuurt geen `rate` mee — ERPNext berekent die zelf bij het opslaan
van de Sales Invoice. Volgorde van prioriteit:

1. **Item Price** in een actief Price List voor deze Customer/Company
   → als die bestaat, wint die
2. **Activity Type → `billing_rate`** → het standaard uurtarief voor
   dit soort werk
3. **Item → `standard_rate`** → fallback als er geen Activity Type
   gekoppeld is

Voor de werkgever betekent dit: het tarief dat op de factuur komt, kan
op **drie plekken** worden ingesteld. Voor klanten met een afwijkend
tarief gebruik je een **klant-specifiek Price List**, niet de
Activity Type, anders verschuif je het tarief voor iedereen.

### Stap 5 — Fixed-price taken: één regel per taak

Voor `fixedRows` (vaste-prijs taken) maakt Y-app per taak één regel:

```ts
items.push({
  item_code: "Aangenomen werk",   // generieke catch-all
  item_name: task.subject,         // "Schetsontwerp fase 1" o.i.d.
  qty: 1,
  rate: 0,                         // ← moet handmatig worden ingevuld
  project: projId,
  print_hide: 1,
});
```

Tot F41 is geïmplementeerd: de gebruiker moet zelf in de invoice modal
het bedrag invullen via het floppy-icoon. F41 koppelt dit aan
`Task.custom_fixed_amount`.

### Stap 6 — Alle uren linken (ook de vaste-prijs ones)

Onafhankelijk van het billing-type wordt **élke** geselecteerde time_log
opgenomen in de Sales Invoice's **`timesheets` child table**:

```ts
for (const r of projRows) {
  timesheetEntries.push({
    time_sheet: r.tsName,            // parent Timesheet doc
    timesheet_detail: r.key,         // specifieke time_log rij
    activity_type: r.activityType,
    billing_hours: r.hours,
    from_time: r.fromTime,
    project_name: ...,
  });
}
```

**Waarom ook de fixed-rows mee-linken?** Zo zie je in ERPNext (en in
Y-app's invoice modal onder "Gekoppelde uren-rijen") **waar elk uur
naartoe is gegaan**. Anders blijven die uren in ERPNext eeuwig
"open / nog niet gefactureerd" — wat een chaos geeft in de
Te-factureren-lijst. Door ze te linken markeert ERPNext ze als
"verwerkt op deze factuur" en verdwijnen ze uit het te-factureren-
overzicht, ook al verschijnen ze niet als regel op de PDF.

### Stap 7 — Print Format filtert de PDF

De Print Format **`3BM Factuur+Smart Urenstaat`** (de default in
Y-app's invoice modal) heeft een Jinja-filter dat **alleen** de
timesheet-based rijen in de urenstaat-bijlage afdrukt:

```jinja
{% set ns = namespace(rows=[]) %}
{% for ts in doc.timesheets %}
  {% set task_doc = frappe.get_doc("Task", ts.task) if ts.task else None %}
  {% if task_doc and task_doc.custom_billing_type == "Timesheet based" %}
    {% set ns.rows = ns.rows + [ts] %}
  {% endif %}
{% endfor %}

{# render alleen ns.rows in de urenstaat-tabel #}
```

Resultaat:

| Type taak                              | Op factuur als regel? | In urenstaat op PDF? | In Sales Invoice gelinkt? |
|----------------------------------------|-----------------------|----------------------|---------------------------|
| Timesheet-based (uurtarief)            | ✅ ja (per Activity Type) | ✅ ja            | ✅ ja                     |
| Fixed price / Aangenomen werk          | ✅ ja (€-bedrag)      | ❌ nee              | ✅ ja (zonder spec)       |

In Y-app's invoice modal zie je per uren-rij een groen "✓ Op factuur" /
grijs "— Niet geprint" badge. Die kleur komt van exact deze filter-
logica, gespiegeld in `isRowPrintedOnInvoice()`.

### Visueel: wat staat waar?

```
Sales Invoice 2609-00547
├─ Customer: KLH Landman
├─ Items[] (= regels op PDF)
│   ├─ "Senior Bouwkundige"  qty 18.5  rate €110  = €2.035   ← from Activity Type groepering
│   ├─ "Medior Bouwkundige"  qty  6.0  rate €95   = €570     ← from Activity Type groepering
│   └─ "Aangenomen werk"     qty 1     rate €4500 = €4.500   ← from Fixed task
│       item_name: "Schetsontwerp fase 1"
└─ Timesheets[] (= alle gelinkte uren, gespecificeerd onder factuur op urenstaat)
    ├─ 12-mei  Joran  Senior Bouwkundige  Detail uitwerking      8.0u   ✓ op urenstaat
    ├─ 13-mei  Joran  Senior Bouwkundige  Detail uitwerking      6.5u   ✓ op urenstaat
    ├─ 14-mei  Sam    Medior Bouwkundige  Schetsontwerp KLH      6.0u   — niet geprint (taak = Fixed)
    └─ 14-mei  Joran  Senior Bouwkundige  Schetsontwerp KLH      4.0u   — niet geprint (taak = Fixed)
```

De vaste-prijs-uren (laatste twee rijen) verschijnen **niet** in de
urenstaat-bijlage van de PDF — de klant ziet alleen de €4.500-regel.
Maar ze zijn wel gekoppeld aan de Sales Invoice, dus:
- Ze verdwijnen uit Y-app's Te-factureren-tab (= "afgehandeld")
- Je kunt ze in ERPNext desk altijd traceren ("waar zijn die 10 uur
  Schetsontwerp KLH heen gegaan? → Sales Invoice 2609-00547")
- Bij interne rapportage / kostprijs-analyse zijn ze gewoon zichtbaar

---

## Vaste-prijs taken (Fixed Price / Aangenomen werk)

> Voorbeeld scenario (KLH Landman): een project waar je per fase een
> vast bedrag afspreekt (bv. "Schetsontwerp: €4.500"). De uren die je
> erop boekt zijn kostprijs (intern), maar de factuur is fixed.

Huidige situatie:
- `Task.custom_billing_type = "Fixed"` (of een andere niet-`"Timesheet based"` waarde)
- Y-app maakt **één Sales Invoice Item** per taak met:
  - `item_code = "Aangenomen werk"` (placeholder)
  - `item_name = taak-onderwerp`
  - `qty = 1`, `rate = 0` ← **moet handmatig ingevuld worden**
  - `print_hide = 1` (verbergt de regel in print? — zie F41)
- De gekoppelde uren zitten wel in de `timesheets`-child table maar
  worden niet opgenomen in de urenstaat-PDF (Print Format "Smart Urenstaat" filtert ze weg)

**Wat ontbreekt nog (F41):**
- Een veld op de Task waar je de afgesproken vaste prijs invult
  (`Task.custom_fixed_amount` o.i.d.) zodat `rate` automatisch wordt
  gevuld in plaats van 0.
- Een tweede veld voor de afgesproken factureer-naam (bv.
  "Schetsontwerp fase 1") zodat `item_name` niet de raw taak-naam is.
- Eventueel: koppeling tussen meerdere taken en één milestone (deelfactuur).

Tot F41 is geïmplementeerd: vul `rate` handmatig in de invoice modal
via het floppy-icoon, en pas eventueel `item_name` aan.

---

## Welke uren komen op de PDF? (urenstaat-filter)

De Print Format `3BM Factuur+Smart Urenstaat` heeft een Jinja-filter:

```jinja
{% set ns = namespace(rows=[]) %}
{% for ts in doc.timesheets %}
  {% set task_doc = frappe.get_doc("Task", ts.task) if ts.task else None %}
  {% if task_doc and task_doc.custom_billing_type == "Timesheet based" %}
    {% set ns.rows = ns.rows + [ts] %}
  {% endif %}
{% endfor %}
```

Resultaat: alleen uren van timesheet-based taken in de urenstaat. Vaste-prijs
taken blijven gelinkt aan de invoice (totalen kloppen) maar verschijnen
niet als specificatie.

De Y-app invoice modal spiegelt deze logica in **`isRowPrintedOnInvoice()`**
zodat de "Op factuur?"-badge per uren-rij klopt met wat de PDF laat zien.

---

## Mail-versturen (F40 ✅ — geïmplementeerd in v0.19.0)

`SendInvoiceModal` opent vanuit drie plekken:

1. **InvoiceModal** — "Mail versturen" (submitted) of "Inboeken & Verstuur" (DRAFT)
2. **SalesInvoices → Alle tab** — Verstuur-knop per submitted rij + bulk-checkboxes
3. **ToInvoice → results-lijst** — "Bekijken & Versturen" naast elke vers aangemaakte draft

Architectuur (ERPNext = single source of truth):
- Versturen via `frappe.core.doctype.communication.email.make` met
  `send_email: 1`, `print_format`, `print_letterhead: 1`,
  `attach_document_print: 1` → ERPNext rendert PDF zelf, hangt aan,
  schrijft Communication-record in timeline, zet in Email Queue,
  verstuurt via geconfigureerd outgoing Email Account.
- Onderwerp + body komen uit een ERPNext **Email Template** (Jinja),
  server-side gerenderd via `email_template.get_email_template` met de
  invoice als doc-context. Y-app slaat alleen 2 defaults op per instance
  in `instance_settings.invoice-email-defaults`: welke Email Template +
  welk Print Format default zijn.
- `User.email_signature` wordt door ERPNext automatisch onder `content`
  geappend. Email Template body eindigt daarom op de groet (geen naam),
  anders dubbele signatures. Modal toont signature read-only onder body
  zodat dit visueel duidelijk is.
- Pre-flight: `Email Account` met `default_outgoing=1` moet bestaan,
  anders blokkerende foutmelding met link naar ERPNext-setup.

Bulk-send (BulkSendDrawer): sequentieel per factuur, elk eigen mail,
retry per fout-rij.

---

## Veel-voorkomende valkuilen

| Symptoom                                              | Oorzaak                                                                                   |
|-------------------------------------------------------|-------------------------------------------------------------------------------------------|
| `rate` = 0 op nieuwe regel                            | Activity Type bestaat wel maar heeft geen `billing_rate`. Vul in ERPNext desk             |
| Submit faalt: "Item not found"                        | Nieuwe Activity Type zonder bijbehorend Item-record. Maak een Item aan met dezelfde naam  |
| Uren verschijnen niet op PDF                          | `Task.custom_billing_type ≠ "Timesheet based"`. Print Format Smart Urenstaat filtert ze weg|
| Vaste-prijs-regel toont €0 op PDF                     | `rate` is niet ingevuld. Vul handmatig in modal (F41 lost dit op)                         |
| Verkeerd briefpapier in preview                       | Letter Head niet expliciet meegegeven aan Sales Invoice. Default = "No Letterhead" (F39)  |
| ERPNext `download_pdf` geeft blanco PDF               | wkhtmltopdf issue op deze instance. Workaround: HTML preview + browser-print              |
