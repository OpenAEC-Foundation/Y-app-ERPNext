# Vergunningen & archief — module in Y-next

## Doel

Per project bijhouden welke vergunningsaanvragen en archiefonderzoeken er
lopen, wie het aanspreekpunt is bij gemeente of archief, wanneer er nagebeld
moet worden en welk contact er al is geweest. De module vervangt de twee
registers in `Z:/10_PR_logo_bureaustandaard_databases/Archiefonderzoek.odt`
("Archiefonderzoeken" en "Vergunningsaanvragen/vooroverleggen").

Doelinstance: `https://3bm.prilk.cloud`. De module is 3BM-specifiek; op een
instance zonder de doctypes verdwijnt het menu-item vanzelf via
`MODULE_DOCTYPE` in `lib/module-access.ts`.

Een dossier is "een soort link" aan een project: licht, snel aan te maken, met
één herinnering die goed zichtbaar is en een logboek van contactmomenten.

## Uitgangssituatie

- De twee registers zijn handmatig en half ingevuld: 93 regels archief (kolom
  Archief nooit gevuld, datum aanvraag 41×, status 35×) en 116 regels
  vergunningen (status 71× leeg). Termijnen worden niet bewaakt.
- In het register van vergunningen zit tussen indienen en besluit mediaan
  100–110 dagen; de wettelijke 8 weken wordt in 17 van de 20 gevallen met een
  besluitdatum overschreden.
- ERPNext heeft een ongebruikt doctype `Permit Request` (1 record) met
  `Permit Request Status`. Dat blijft staan; de module gebruikt eigen
  Y-doctypes. Het ene record wordt bij de import overgenomen.
- Contactpersonen bij gemeenten staan nergens in ERPNext; in het register
  staan ze als vrije tekst (naam, telefoon, e-mail door elkaar).

## 1. Datamodel

Drie eigen doctypes, aangemaakt door `scripts/provision-y-next.mjs` (builders
met tests, zoals `buildOnkostenDoctype`). Module `Custom`, `track_changes`
aan. Rechten: System Manager, Projects User en Employee lezen, schrijven en
aanmaken, **zonder** `if_owner` — dossiers zijn voor het hele team zichtbaar.
Verwijderen alleen System Manager en Projects User.

`ensureDoctype` werkt de velden van een bestaand doctype niet bij; het
veldontwerp hieronder moet dus in één keer kloppen, of het script krijgt een
bijwerk-stap (zie het plan).

### `Y Vergunningsaanvraag` (naam `YVA-.YYYY.-.#####`)

| Veld | Type | Toelichting |
|---|---|---|
| `project` | Link Project, verplicht | |
| `soort` | Select, verplicht | Vooroverleg · Omgevingsplanactiviteit · Technische aanvraag · Omgevingsplan + technisch |
| `omschrijving` | Data | Kort: "Dakopbouw", "Doorbraak" |
| `status` | Select, verplicht | In voorbereiding · Wacht op machtiging · Ingediend · Aanvulling gevraagd · Verleend · Geweigerd · Ingetrokken · Afgerond |
| `ingangsdatum` | Date | Datum van indienen (bij vooroverleg: van het verzoek) |
| `ingediend_door` | Data | Wie indiende (medewerker, architect, opdrachtgever) |
| `gemeente` | Data | Bevoegd gezag |
| `behandelende_instantie` | Data | Als die afwijkt, bijvoorbeeld OZHZ |
| `zaaknummer` | Data | Nummer van gemeente of omgevingsdienst |
| `verzoeknummer` | Data | Nummer uit het Omgevingsloket (of oud OLO-nummer) |
| `contactpersoon` | Link Contact | Aanspreekpunt bij gemeente/omgevingsdienst |
| `verlengd` | Check | Beslistermijn met 6 weken verlengd |
| `aanvulling_gevraagd_op` | Date | Begin opschorting |
| `aanvulling_geleverd_op` | Date | Einde opschorting |
| `besluitdatum` | Date | Datum van het besluit (verzending) |
| `herinnering_op` | Date | Wanneer nabellen/-mailen |
| `herinnering_actie` | Select | Bellen · Mailen · Anders |
| `herinnering_voor` | Link User | Wie de herinnering krijgt; standaard de maker |
| `notitie` | Small Text | |

### `Y Archiefonderzoek` (naam `YAO-.YYYY.-.#####`)

| Veld | Type | Toelichting |
|---|---|---|
| `project` | Link Project, verplicht | |
| `adres` | Data | Het bouwwerk (register: kolom Bouwwerk) |
| `gemeente` | Data | |
| `bouwjaar` | Int | Bepaalt samen met gemeente het archief |
| `archief` | Data | Instelling; voorgesteld, met de hand te overschrijven |
| `status` | Select, verplicht | Nog aanvragen · Aangevraagd · Afspraak gemaakt · Stukken binnen · Niets gevonden · Niet nodig · Via derden |
| `aangevraagd_op` | Date | |
| `kenmerk` | Data | Dossier- of verzoeknummer bij het archief |
| `contactpersoon` | Link Contact | |
| `gevonden` | Small Text | Wat er is gevonden (tekeningen, berekening, paalplan) |
| `herinnering_op` / `herinnering_actie` / `herinnering_voor` | | Als bij de vergunningsaanvraag |
| `notitie` | Small Text | |

### `Y Contactmoment` (naam `YCM-.YYYY.-.#####`)

Een eigen doctype en geen child-tabel, zodat contact over alle dossiers heen te
bevragen is ("alle contact met deze ambtenaar") en het gewone
`fetchList`-patroon werkt.

| Veld | Type | Toelichting |
|---|---|---|
| `dossier_type` | Link DocType | `Y Vergunningsaanvraag` of `Y Archiefonderzoek` |
| `dossier` | Dynamic Link (`dossier_type`) | |
| `project` | Link Project | Afgeleid van het dossier; voor het projectblok |
| `datum` | Datetime, verplicht | Standaard nu |
| `contactpersoon` | Link Contact | Standaard die van het dossier |
| `kanaal` | Select | Telefoon · E-mail · Bezoek · Anders |
| `uitkomst` | Select | Gesproken · Niet opgenomen · Voicemail ingesproken · Teruggebeld · Mail gestuurd · Mail ontvangen |
| `notitie` | Small Text | |

Wie het contact had, is de `owner` van het record.

### Contactpersonen

Een contactpersoon is een gewoon ERPNext-`Contact` (iedereen mag er een
aanmaken). In het dossier kies je een bestaande contactpersoon of maak je er
ter plekke een aan met naam, organisatie (`company_name`: "Gemeente
Dordrecht", "OZHZ"), telefoon en e-mail. Bij de contactpersoon zie je alle
contactmomenten, over alle dossiers.

## 2. Termijnen (pure logica, `lib/vergunningen.ts`)

Alleen voor soorten met een wettelijke termijn (niet bij Vooroverleg), en
alleen de reguliere procedure:

- **Uiterste beslisdatum** = `ingangsdatum` + 56 dagen, + 42 dagen als
  `verlengd`, + de opgeschorte dagen (`aanvulling_geleverd_op` −
  `aanvulling_gevraagd_op`). Is er wel een verzoek om aanvulling maar nog geen
  levering, dan staat de termijn stil: de module toont "staat stil sinds …".
- **Einde bezwaartermijn** = `besluitdatum` + 42 dagen.
- De termijnen worden niet opgeslagen, maar bij het tonen berekend.
- Een verlopen beslistermijn bij status Ingediend of Aanvulling gevraagd wordt
  rood gemarkeerd. Onder de Omgevingswet is de vergunning dan niet van
  rechtswege verleend; het signaal is "nabellen".

De uitgebreide procedure (6 maanden) valt buiten deze versie.

## 3. Herinneringen

- Een nieuw dossier krijgt een voorstel voor `herinnering_op`: ingangsdatum +
  3 weken (vergunning), aanvraagdatum + 2 weken (archief). Het aantal weken
  staat als constante in `lib/vergunningen.ts`.
- Na het vastleggen van een contactmoment stelt de module direct een nieuwe
  herinnering voor. Bij Niet opgenomen/Voicemail: over 2 werkdagen, anders
  over 2 weken. De gebruiker kan dat voorstel aanpassen of leeg laten.
- Een dossier met status Verleend, Geweigerd, Ingetrokken, Afgerond (of bij
  archief Stukken binnen, Niets gevonden, Niet nodig) telt niet meer mee.

**Zichtbaar op twee plekken:**

1. **Dashboardwidget "Nabellen"**: jouw herinneringen van vandaag en eerder
   (rood), en die van de komende 7 dagen; per regel project, soort, gemeente,
   contactpersoon met telefoonnummer, en een knop om het dossier te openen.
2. **Teller bij het menu-item** "Vergunningen & archief": het aantal van
   jouw herinneringen die vandaag of eerder zijn (via `lib/badges.ts`).

## 4. Schermen

### Pagina `/vergunningen` (menu Projecten)

- Tabs: **Vergunningen**, **Archief**, **Nabellen** (alle open herinneringen
  van iedereen, gegroepeerd per persoon).
- Lijst met filters (open/afgerond, alleen van mij, zoeken op project,
  gemeente, zaaknummer); kolommen o.a. project, soort/archief, status,
  ingangsdatum, beslist uiterlijk, herinnering.
- Detailpaneel: alle velden, de berekende termijnen, de contactpersoon met
  klikbaar telefoonnummer en e-mail, en het logboek van contactmomenten met
  een formulier "Contact vastleggen".
- Bij een archiefonderzoek stelt de module het archief voor op basis van
  gemeente en bouwjaar (zie 5).
- Een link naar het kennisbankartikel: vergunning → "Vergunningsaanvraag",
  archief → "Archiefonderzoek".
- Deep-link `?d=<naam>` opent een dossier.

### Blok in het project (`ProjectDetail`)

Sectie "Vergunningen & archief" met de dossiers van het project, hun status
en herinnering, en knoppen "Vergunningsaanvraag toevoegen" / "Archiefonderzoek
toevoegen".

## 5. Archief voorstellen

Een vaste opzoektabel in `lib/vergunningen.ts` (gemeente + bouwjaar →
instelling), gevuld met de werkregels die 3BM al hanteert, bijvoorbeeld:
Ridderkerk vóór 1942 → Stadsarchief Rotterdam; Zwijndrecht en Sliedrecht
1899–1990 → Regionaal Archief Dordrecht, daarna de gemeente zelf; Dordrecht
vóór 1991 → Regionaal Archief Dordrecht, daarna OZHZ. Onbekende combinaties
geven geen voorstel. De menselijke versie van deze regels staat in het
kennisbankartikel "Archiefonderzoek".

## 6. Import van de registers

Eenmalig script (`scripts/import-vergunningsregisters.mjs`, met tests voor het
omzetten van regels) dat beide tabellen uit de .odt leest en alle regels als
dossiers aanmaakt:

- Projectnummer → `project` (regels waarvan het project niet bestaat worden
  gemeld en overgeslagen).
- Datums `dd-mm-jjjj` → ISO; vrije tekst in status/opmerking/stukken/actie
  gaat letterlijk naar `notitie`, zodat niets verloren gaat.
- Soort en status worden naar de keuzelijsten vertaald waar dat eenduidig is
  (bijvoorbeeld "Bouwactiviteit omgevingsplan/technisch" → Omgevingsplan +
  technisch; "In behandeling" → Ingediend; een datum in "Verleend?" →
  Verleend met `besluitdatum`); anders blijft de oorspronkelijke tekst in de
  notitie en krijgt het dossier een neutrale status.
- Contactpersoon-tekst gaat naar de notitie; er worden bij de import geen
  Contacts aangemaakt.
- "Ingediend door" (voornaam) wordt bewaard in `ingediend_door`.
- De import zet **geen** herinneringen: anders staat het dashboard op dag één
  vol met regels uit 2023. Open dossiers zijn te vinden met het filter "open"
  en tonen hun termijn; wie ermee verder gaat, zet zelf een herinnering.
- Het script draait eerst droog (overzicht van wat het zou aanmaken) en pas
  daarna echt; het is idempotent op project + ingangsdatum + soort.
- Het ene `Permit Request`-record wordt op dezelfde manier overgenomen.

Na de import blijft de .odt als archief staan; nieuwe dossiers gaan alleen via
de Y-app.

## 7. Bestanden en mail

- Bijlagen: gewone ERPNext-bijlagen aan het dossier (`uploadFile`, privé) voor
  de sleutelstukken (ontvangstbevestiging, verzoek om aanvulling, besluit).
  Archieffoto's blijven in de projectmap (`50_bestaande_toestand`).
- Mail: een mail is aan een dossier te koppelen met de bestaande
  koppeldialoog (die werkt voor elk doctype).

## 8. Niet in deze versie

Opzoeken via BAG/PDOK (gemeente, bouwjaar), berekende termijnen voor de
uitgebreide procedure, Wkb-meldingen, automatisch mail koppelen op zaaknummer,
knoppen naar de NAS-submappen, meldingen per mail of push.

## 9. Testen

- `lib/vergunningen.ts` puur, met `vergunningen.test.ts` (node --test):
  termijnberekening (met en zonder verlenging en opschorting, termijn die
  stilstaat), einde bezwaartermijn, herinneringsvoorstellen (werkdagen over
  het weekend), archiefvoorstel, welke dossiers "open" zijn en welke
  herinneringen vandaag of eerder vallen.
- Provisioning: builders getest in `scripts/provision-y-next.test.mjs`.
- Import: het omzetten van registerregels getest met regels uit de echte
  registers (zonder persoonsgegevens in de tests).
- In de browser: dossier aanmaken, contactmoment vastleggen met
  herinneringsvoorstel, widget en teller, projectblok, deep-link.
- i18n: nl, en en de met dezelfde sleutels (`locale-parity.test.ts`).
