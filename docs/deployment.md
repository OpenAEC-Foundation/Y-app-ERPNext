# Y-next deployment

Y-next draait single-tenant direct op ERPNext v16
(`https://open-aec-studio-erp.prilk.cloud`). Er is geen aparte backend meer:
de gebouwde SPA wordt gepubliceerd als ERPNext **Web Page** (route `y-next`),
en de statische assets (JS/CSS) als publieke **File**-documenten onder
`/files/<naam>`.

## Vereisten

- Een ERPNext **API key + secret** (User → API Access) met voldoende rechten
  om Files en de Web Page met route `y-next` te lezen/schrijven. Het
  deployscript UPSERT (PUT als het document al bestaat, nooit blind POST) —
  de Web Page met route `y-next` moet dus al bestaan op de site.
- Node 24 (voor `fetch`, `FormData`, `Blob` als globals — geen extra
  dependencies).

## Deployen

```powershell
$env:YNEXT_BASE_URL = "https://open-aec-studio-erp.prilk.cloud"
$env:YNEXT_API_TOKEN = "<API key>:<API secret>"
npm run deploy
npm run smoke
Remove-Item Env:\YNEXT_API_TOKEN
```

- `YNEXT_BASE_URL` is optioneel; de default is de site hierboven.
- `YNEXT_API_TOKEN` is **verplicht** en heeft het formaat `key:secret`
  (zoals ERPNext het toont bij het aanmaken van een API-key). Zet 'm alleen
  in je eigen shell-sessie — nooit in `.env` in de repo, nooit in commits,
  logs of buildoutput.
- `npm run deploy` bouwt eerst de frontend (`npm run build`) en draait dan
  `scripts/deploy-y-next.mjs`: het uploadt elk bestand uit
  `packages/frontend/dist/` als publieke File en werkt daarna de Web Page
  bij met de loader die deze bestanden inclusief.
- `npm run smoke` controleert na deploy dat de site publiek bereikbaar is
  en (met `YNEXT_API_TOKEN` gezet) dat alle door de Web Page gerefereerde
  `/files/...`-assets ook echt 200 teruggeven.
- Verwijder de token-variabele na afloop uit je sessie
  (`Remove-Item Env:\YNEXT_API_TOKEN`).
- `YNEXT_BUILD_TAG` is optioneel (zie `vite.config.ts`) en mag uitsluitend
  kleine letters en cijfers bevatten (`a-z0-9`); een tag die daar niet aan
  voldoet, wordt door `extractBuildTag` niet herkend, waardoor het
  deployscript de per-build content-marker overslaat.

## Browsercache van `/y-next` (waarom `dynamic_template: 1`)

Frappe cachet Web Pages standaard agressief. `frappe/website/utils.py` zet via
de decorator `cache_html` op elke Web Page:

```
Cache-Control: private,max-age=300,stale-while-revalidate=10800
```

Vijf minuten vers, daarna tot **drie uur** "stale" uit de browsercache terwijl
er op de achtergrond ververst wordt. Dat gaf twee concrete storingen:

1. Een browser die `/y-next` ooit **uitgelogd** opende, cachete de HTML met
   `frappe.csrf_token = "None"` erin. Na de login serveerde diezelfde cache die
   gast-HTML opnieuw, en elke POST/PUT/DELETE faalde met `Invalid Request` —
   zichtbaar als "uren boeken doet niets".
2. Na een deploy draaiden gebruikers tot drie uur lang nog de vórige bundel.

Het `Web Page`-DocType heeft **geen** `no_cache`-veld (geverifieerd tegen
`frappe/website/doctype/web_page/web_page.json`, v16). De hefboom die er wél is,
en die het deployscript nu meestuurt, is **`dynamic_template: 1`**:
`WebPage.render_dynamic()` zet dan `context["no_cache"] = 1` (zolang de
main_section geen `<!-- static -->` bevat), waarna `cache_html` zowel de
server-side pagina-cache als de Cache-Control-header overslaat en Frappe's
default blijft staan:

```
Cache-Control: no-store,no-cache,must-revalidate,max-age=0
```

Bijwerking: `main_section` gaat door Jinja. Onze main_section is een statische
`<div id="root">` zonder `{{`/`{%`, dus `render_template` geeft hem letterlijk
terug — er is een test die dat bewaakt.

**Verifiëren na een deploy** (geen auth nodig):

```powershell
curl.exe -sI https://open-aec-studio-erp.prilk.cloud/y-next | Select-String -Pattern "cache-control|x-from-cache"
```

Verwacht: `cache-control: no-store,no-cache,must-revalidate,max-age=0` en
`x-from-cache: False`. Zie je nog `private,max-age=300,...`, dan is
`dynamic_template` niet aangekomen — controleer het Web Page-document.

## Rollback

Vóór elke PUT op de Web Page schrijft het deployscript automatisch een
backup van het bestaande document weg naar
`temp/webpage-y-next-backup-<ISO-timestamp>.json` (de map `temp/` staat in
`.gitignore` — er komt niets van in git terecht).

Om terug te rollen naar een eerdere versie:

1. Kies de gewenste backup-JSON uit `temp/`.
2. PUT de inhoud ervan terug naar
   `{YNEXT_BASE_URL}/api/resource/Web Page/y-next` met dezelfde
   `Authorization: token <key>:<secret>`-header.
3. De oude asset-Files blijven gewoon bestaan (er wordt nooit iets
   verwijderd door het deployscript) — een rollback van de Web Page-velden
   is dus voldoende, zolang de erin gerefereerde `/files/...`-bestanden nog
   bestaan.

## Dev-workflow

Voor lokale ontwikkeling proxyt Vite rechtstreeks naar de ERPNext-site, zodat
cookies/CSRF zich hetzelfde gedragen als in productie:

```powershell
$env:VITE_ERPNEXT_URL = "https://open-aec-studio-erp.prilk.cloud"   # optioneel, dit is de default
$env:YNEXT_DEV_TOKEN = "<API key>:<API secret>"                      # optioneel
npm run dev
```

- `YNEXT_DEV_TOKEN` wordt uitsluitend server-side door de Vite dev-proxy
  toegevoegd als `Authorization`-header op requests naar `/api`, `/files`,
  `/private/files`, `/login` en `/assets`. De waarde komt nooit in
  client-code of de bundel terecht.
- Zonder `YNEXT_DEV_TOKEN` werkt normale cookie-gebaseerde login (via
  `/login`) ook prima — geen CSRF-gedoe nodig in dev omdat de dev-server
  hetzelfde origin-gedrag simuleert als productie.

## Secrets

- Nooit een echte API-key/secret in code, tests, docs, commit-messages of
  buildoutput.
- `YNEXT_API_TOKEN` en `YNEXT_DEV_TOKEN` leven alleen als omgevingsvariabele
  in je eigen shell — niet in `.env` in de repo (`.env` en varianten staan
  in `.gitignore`, maar zet de token toch nooit in een bestand).
- Het deployscript logt uitsluitend HTTP-statussen, bestandsnamen,
  byte-aantallen en de route — nooit headers of de token. Fetch-fouten
  worden geredigeerd voordat ze gelogd worden, voor het geval een
  onderliggende foutmelding een Authorization-header zou bevatten.

## Eerste geverifieerde deployment

- **Datum:** 2026-07-31
- **Route:** `/y-next` op `https://open-aec-studio-erp.prilk.cloud`
- **Site-versie:** Frappe 16.19.0 / ERPNext 16.16.0
- **Assets:** 146 bestanden geüpload als publieke Files, met een gedeeld
  build-tag-prefix zodat elke deploy zijn eigen assetset heeft en oudere
  builds niet overschrijft.
- **Smoke-test:** geslaagd — de route geeft HTTP 200, de root van de pagina
  is aanwezig, en alle door de Web Page gerefereerde entry-assets
  (`/files/...`) zijn bereikbaar.
- **Gast-weergave:** een niet-ingelogde bezoeker krijgt een loginkaart te
  zien; de standaard ERPNext-navbar en -footer zijn op de `/y-next`-route
  verborgen.

## Fase 2

### Provisioning van custom DocTypes

```powershell
$env:YNEXT_API_TOKEN = "<API key>:<API secret>"
node scripts/provision-y-next.mjs
Remove-Item Env:\YNEXT_API_TOKEN
```

- Het script is **idempotent**: opnieuw draaien op een site waar de DocTypes
  al bestaan doet niets kapot en overschrijft geen bestaande data.
- Het maakt de custom DocTypes aan: **`Y Meeting Note`** (vergadernotities),
  **`Y Next Setting`** (generieke sleutel/waarde-opslag, o.a. voor de
  extensies-configuratie en het kilometertarief), en de drie doctypes voor
  kilometers en onkosten — zie de sectie "Kilometers & onkosten" hieronder.
- **`YNEXT_API_TOKEN`** is verplicht, zelfde formaat en zelfde
  geheimhoudingsregels als bij `npm run deploy` hierboven — nooit in `.env`,
  commits, logs of buildoutput.
- **Let op:** de DocPerm-rijen (read/write/create/delete/submit/cancel/amend
  per rol) worden door het script altijd **expliciet** meegestuurd. Frappe
  vult een DocPerm-rij waarvan vlaggen ontbreken zelf aan met defaults, wat
  op een lege of onvolledige payload tot rechten kan leiden die niet
  overeenkomen met de bedoeling. Vermijd dus een gedeeltelijke payload bij
  handmatige aanpassingen aan deze DocTypes.

### E-mailactivatie (handmatige stap)

Webmail in Y-next leest en verstuurt via het ERPNext **Email Account**-
document (Communication-koppeling), niet via een eigen mailserver. Voordat
webmail werkt, moet in de ERPNext-UI op het betreffende Email Account:

- **`enable_incoming`** en **`enable_outgoing`** aangevinkt staan, en
- een wachtwoord ingevuld zijn (of de bijbehorende OAuth-koppeling actief
  zijn).

Dit is bewust een **handmatige stap in de ERPNext-UI** — het
provisioningscript raakt het Email Account niet aan. Zolang deze stap niet
gezet is, toont Y-next in de webmail-sectie een instructiekaart in plaats
van een foutmelding.

### Eerste fase-2-deployment

- **Datum:** 2026-07-31
- **Geverifieerde onderdelen:**
  - Webmail op basis van ERPNext **Communication**-documenten.
  - Vergadernotities (`Y Meeting Note`).
  - Extensies-opslag (`Y Next Setting`), beheer beperkt tot System Manager.
  - Release notes, lokaal in de frontend bijgehouden.

## Fase 3

### Naamreeks-tellers herstellen (`ensureNamingSeries`)

**Waarom dit bestaat.** Frappe's naamreeks-tellers (`Document Naming
Settings` → `Series`) lopen soms achter op de werkelijk bestaande
documenten — meestal na een bulk-import die direct namen in de database zet
zonder de teller mee op te hogen. Frappe telt een reeks bovendien **niet**
op bij een mislukte insert (de tellerverhoging zit in dezelfde transactie
als de insert en rolt mee terug), dus zo'n desync is een **permanente
deadlock**: elke volgende poging kiest exact dezelfde, al bezette naam. Dit
is al twee keer live geraakt op deze instance — eerst `TS-2026-`
(Timesheet), later `ACC-PINV-2026-` (Purchase Invoice, teller stond op ~9
terwijl de hoogste bestaande factuur `ACC-PINV-2026-00042` was, wat élke
nieuwe inkoopfactuur blokkeerde, ook handmatig in de ERPNext-UI).

`ensureNamingSeries` (derde fase in `provision-y-next.mjs`, ná de
DocType- en rechtenfase) maakt dit herstel **structureel en herhaalbaar**
in plaats van een eenmalige handmatige `update_series_start`-call per
incident:

- Voor een declaratieve doctype-lijst (`DEFAULT_NAMING_SERIES_DOCTYPES`:
  Timesheet, Purchase Invoice, Sales Invoice, Quotation, Sales Order,
  Delivery Note, Task, Project, Lead, Opportunity, plus de HRMS-doctypes
  Travel Request, Leave Application, Leave Allocation en Expense Claim) leest
  het script per doctype de `naming_series`-veldopties uit de DocType-meta,
  vult de datumtokens (`.YYYY.` e.d.) in tot de concrete prefix van vandaag
  (bv. `TS-.YYYY.-` → `TS-2026-`), en bepaalt per prefix de hoogste bestaande
  documentnaam via een gefilterde, aflopend gesorteerde query
  (`name like "<prefix>%"`, `order_by=name desc`, `limit 1`).
- Heeft een doctype géén `naming_series`-veld maar wél een expressie-autoname
  met teller (`HR-TRQ-.YYYY.-.#####` op Travel Request), dan wordt die
  gebruikt: zo'n reeks loopt via dezelfde `tabSeries`-teller en kan dus net zo
  goed vastlopen. De `#`-placeholder hoort niet bij de prefix — die stopt bij
  het eerste `#`-teken.
- De huidige tellerstand wordt gelezen en gezet via het whitelisted
  `Document Naming Settings`-pad (`run_doc_method` met `get_current` /
  `update_series_start`, System Manager-only voor de schrijfkant) —
  hetzelfde pad dat eerder handmatig is gebruikt om `TS-2026-` te herstellen.
  **Let op de responsvorm:** `get_current` geeft zijn resultaat terug als
  een kaal getal in `message` (bv. `{"message": 303}`), niet als
  `{"message": {"current_value": 303}}` — dit is live tegen de
  productie-instance geverifieerd en staat ook als regressietest vast.
- Staat de teller lager dan de hoogste bestaande naam, dan wordt hij
  bijgewerkt; staat hij al gelijk aan of hoger, dan gebeurt er niets
  (idempotent). Bestaat een doctype niet op de instance, heeft hij geen
  `naming_series`-veld (Task/Project gebruiken op deze instance geen
  naming-series-autoname), of faalt een individuele reeks — dan wordt dat
  gewaarschuwd en gaat de rest van de lijst gewoon door; één kapotte reeks
  blokkeert de andere reeksen niet.
- Draait automatisch mee in `node scripts/provision-y-next.mjs` — geen
  aparte stap nodig.

**Live geverifieerd (2026-08-27):** eerste run herstelde vijf reeksen
(`TS-2026-`, `ACC-PINV-2026-`, `ACC-SINV-2026-`, `SAL-QTN-2026-`,
`SAL-ORD-2026-`); een tweede run direct erna rapporteerde alle vijf als
"ongewijzigd" (idempotentie bevestigd). Nadien is via de API een concept-
`Purchase Invoice` aangemaakt (`ACC-PINV-2026-00043`, > `-00042`) om te
bevestigen dat het inkoopfactuur-pad weer werkt, en meteen weer verwijderd.

### Kilometers & onkosten — eigen doctypes, géén HRMS

Kilometerregistratie en onkosten draaien op **eigen** custom DocTypes die het
provisioningscript via de REST-API aanmaakt. De app **HRMS** (Frappe HR) wordt
op deze installatie bewust niet geïnstalleerd, dus `Travel Request` en
`Expense Claim` bestaan hier niet — en HRMS' Travel Request is sowieso een
dienstreis-aanvraag (vlucht, hotel, visum) zonder datum-, afstands- of
bedragveld.

| DocType | Wat erin staat | Naming |
|---|---|---|
| `Y Km Registratie` | één document per rit: medewerker, datum, van/naar, kilometers, retour, project, tarief, bedrag, status | `format:YKM-{YYYY}-{#####}` |
| `Y Onkosten` | één document per bon: medewerker, datum, soort, bedrag, btw, project, leverancier, status | `format:YON-{YYYY}-{#####}` |
| `Y Onkostensoort` | de soortenlijst (stamtabel) | `field:soort_naam` |

**Eén document per rit/bon** in plaats van een maandstaat met child-rijen. Dat
maakt goedkeuren per stuk mogelijk en laat Frappe's `if_owner`-rechten het werk
doen — die werken op documentniveau, niet op child-rijen.

**Het bonnetje is een gewone ERPNext-bijlage** (`File` met
`attached_to_doctype: "Y Onkosten"`), geen eigen veld: zo komen meerdere
bijlagen, de bestaande uploadroute en de ERPNext-bestandsrechten vanzelf mee.

#### Rechten (waarom `if_owner`)

`buildKmRegistratieDoctype` / `buildOnkostenDoctype` zetten de DocPerms bij het
aanmaken van het DocType:

- **`Employee` en `Projects User`** krijgen op permlevel 0
  `read/write/create/delete` **met `if_owner: 1`**. Frappe past die vlag op alle
  vlaggen van die rij toe, dus een medewerker ziet en wijzigt uitsluitend
  documenten waarvan hij zelf de `owner` is. Geen User Permission, geen
  server-side query-condition, geen filter in de frontend nodig. `delete` staat
  erbij omdat een rit in Y-next een heel document is: zonder delete kan een
  verkeerd ingevoerde boeking niet meer weg.
- **`System Manager`** (de werkgever) heeft dezelfde rechten **zonder**
  `if_owner`, plus als enige `write` op **permlevel 1**.
- **`goedgekeurd_door` en `goedgekeurd_op` staan op permlevel 1.** Alleen de
  werkgever kan die vullen; medewerkers mogen ze wél lezen (zien wie hun
  declaratie heeft goedgekeurd). `status` staat bewust op permlevel 0, want de
  medewerker moet zelf van Concept naar Ingediend kunnen. **Gevolg:** wie de
  API rechtstreeks aanroept kan zijn eigen record op "Goedgekeurd" zetten, maar
  kan de goedkeurstempel niet vullen — een goedgekeurd record zonder
  `goedgekeurd_door` is dus zichtbaar onecht, en het overzicht markeert dat met
  een waarschuwingsteken. Dat is **tamper-evidence, geen tamper-proofing**:
  echte afdwinging vereist een server-side hook, en die is zonder Bench niet
  beschikbaar.

Let op: de DocPerms worden **bij het aanmaken** van het DocType meegestuurd.
Bestaat het DocType al, dan raakt het script ze niet meer aan (zelfde gedrag
als bij `Y Meeting Note` / `Y Next Setting`). Wil je ze wijzigen, pas dan de
rechten in de ERPNext-UI aan of verwijder het DocType eerst.

#### Kilometertarief

Het tarief staat als rij in `Y Next Setting` onder de sleutel **`km-tarief`**,
met **€ 0,23** als startwaarde (de gangbare onbelaste kilometervergoeding).
Schrijven op dat doctype is System-Manager-only — precies de bedoeling: een
medewerker mag zijn eigen vergoeding niet ophogen. De werkgever wijzigt het in
Y-next op het tabblad **Goedkeuren** van de onkostenpagina.

`ensureMasterRecords` doet eerst een GET, dus **een door de werkgever aangepast
tarief overleeft elke volgende provisioning-run.**

De boeking neemt het tarief over in `tarief_per_km` op het document zelf en
berekent `bedrag` = `kilometers × (retour ? 2 : 1) × tarief`. Een latere
tariefwijziging herrekent dus niets van wat al geboekt is.

#### Naamreeksen: de gedeelde `format:`-teller

`Y Km Registratie` en `Y Onkosten` staan in `DEFAULT_NAMING_SERIES_DOCTYPES`,
maar de naamreeksen-fase meldt ze als **`no-naming-series`** — en dat is
correct. Frappe's `_format_autoname` parseert elk `{…}`-blok van een
`format:`-autoname apart, waardoor de teller-placeholder in `tabSeries` onder
de **lege** sleutel terechtkomt. Dat is één gedeelde, altijd oplopende teller
(die `Y Meeting Note` al gebruikt). Zo'n teller kan niet achterlopen op
bestaande documenten en dus ook niet vastlopen; er valt niets te herstellen.

Zichtbaar gevolg: de nummers zijn **niet aaneengesloten** — de eerste rit kan
`YKM-2026-00005` heten omdat vergadernotities en onkosten uit dezelfde teller
tellen. Dat is cosmetisch en verandert niets aan de uniciteit. De entries staan
in de lijst zodat de fase ze automatisch meepakt als het naamschema ooit naar
een `naming_series`-veld verhuist.

#### Wat een run aanmaakt

```powershell
$env:YNEXT_API_TOKEN = "<API key>:<API secret>"
node scripts/provision-y-next.mjs
Remove-Item Env:\YNEXT_API_TOKEN
```

- DocTypes: `Y Onkostensoort`, `Y Km Registratie`, `Y Onkosten` (plus de al
  bestaande `Y Meeting Note` en `Y Next Setting`).
- Stamgegevens: onkostensoorten **Reiskosten, Parkeren, Materiaal, Verblijf,
  Overig** en de instelling `km-tarief` = `0.23`.
- De HRMS-rechten- en naamreeksregels die nog in het script staan worden
  overgeslagen zolang die app niet geïnstalleerd is; ze doen dan niets.

**Verifiëren na de run** (read-only): open `/expenses` in Y-next. De
zijbalkkop "Onkosten" verschijnt zodra `Y Km Registratie` bestaat (de
doctype-probe in `lib/module-access.ts`); staat er nog "De kilometer- en
onkostenmodule is nog niet ingericht", dan is het script niet gedraaid of mist
de gebruiker leesrecht.

#### Verlof

Verlof (`/leave`) draait nog wél op HRMS' `Leave Application` /
`Leave Allocation` en blijft daarom de melding "module niet beschikbaar" tonen
zolang HRMS ontbreekt. Dat is een aparte beslissing.
