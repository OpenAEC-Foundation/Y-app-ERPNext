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
- Het maakt twee custom DocTypes aan: **`Y Meeting Note`** (vergadernotities)
  en **`Y Next Setting`** (generieke sleutel/waarde-opslag, o.a. voor de
  extensies-configuratie).
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
