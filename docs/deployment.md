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
