# Ingebouwde CAD en Planner

De starttegels openen interne routes `/cad-studio` en `/planner-studio`.
De daadwerkelijke tools staan onder `/assets/y_next/app/studios/` en worden
uitsluitend bij gebruik geladen in een same-origin iframe. Er is geen CDN,
geen eigen login en geen aparte toolserver. Een iframe houdt de CSS en
sneltoetsen van de tools gescheiden van de Y-Next-werkplek.

## Runtimes en bronnen

- CAD: Open CAD Studio 0.8.2, bronbasis
  `1490fe4ea91dd83498bc7c280e124a07f194c37f`, met de byte-brug naar de host.
  De complete bijgebehorende bronkopie bevat ook de brugwijzigingen en de
  gepinde parserbron. Rust 1.94.0, Trunk 0.21.14, wasm-bindgen 0.2.126 en
  wasm-opt 123 produceren de gecontroleerde WASM-build. Dit is de 2D-build;
  de native solid-modelleerfuncties zitten niet in deze browserbuild.
- Planner: Open Planner Studio 2026.9.0, bron
  `1f1271770894440d6f5b908f37c79cdb51fcd009`. De platformbouw schakelt externe
  runtime-extensies, AI-tokenopslag en het demoproject uit. De planningengine
  gebruikt JavaScript/Canvas 2D; de PDF-export heeft een WASM-fontsubsetter.

Beide bronarchieven, oorspronkelijke licenties en fontvermeldingen zitten
in de distributie naast de runtime. De verpakkingswrapper bevat alleen lokale
assetpaden, netwerkbeperkingen en de aansluiting op Y-Next. De Planner-kopie
past drie Noorse handleidingen semantisch aan om onbedoelde naamfragmenten
te vermijden; de originele bronkopie blijft intact.

## Bestanden en rechten

Standalone tools openen lokale bestanden en schrijven lokale kopieën. Er is
geen automatische upload of koppeling met ERPNext-projecttaken. CAD-bijlagen
naast mail worden door Y-Next opgehaald met dezelfde ERPNext-sessie; alleen
`/files/` en `/private/files/` op dezelfde origin worden geaccepteerd.
Redirects, externe adressen en bestanden boven 100 MiB worden geweigerd.
Sluiten of wisselen breekt de aanvraag af. De editor krijgt alleen bytes;
het originele ERPNext-bestand wordt niet overschreven.

De CAD-brug controleert het bronvenster, de origin, het berichttype en het
aanvraag-id. Een statusbericht meldt dat de engine klaar is. Niet alleen
`iframe.onload`: dat betekent nog niet dat de WASM-editor is geïnitialiseerd.

Planner-browseropslag krijgt een eigen namespace per ERPNext-gebruiker,
afgeleid uit een SHA-256-scope. Oude ongescheiden herstelbestanden worden
niet automatisch geïmporteerd. Dit voorkomt onbedoeld herstel na een
accountwissel, maar is geen beveiligingsgrens tegen andere vertrouwde
same-origin scripts. De tool-CSP blokkeert externe netwerkverzoeken.

## Bouwen

Bouw eerst de afzonderlijke, gepinde tools. Planner:

```bash
npm ci
npm run build:platform -- --base /assets/y_next/app/studios/planner/
```

Op Windows kan de upstream starter de extensionless npm-binaries niet starten.
De gelijkwaardige opdrachten gebruiken de Node-entrypoints:

```bash
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build --mode platform --base /assets/y_next/app/studios/planner/
```

Verwijder geërfde `VITE_*` en `OPS_DEV_INSTANCE` uit de buildomgeving, net als
de upstream starter. Alleen `.env.platform` levert de platformvlag.

CAD wordt gebouwd met `trunk build --release --offline=true`, met de complete
bronkopie en aanwezige gepinde buildafhankelijkheden. Gebruik de gegenereerde
JS en WASM altijd als één set, met alle fonts en de oorspronkelijke licentie.

Geef daarna in de Y-Next-bronwerkmap de lokale inputs aan:

```powershell
$env:YNEXT_CAD_DIST = 'C:\pad\naar\cad-dist'
$env:YNEXT_PLANNER_DIST = 'C:\pad\naar\planner\dist-platform'
$env:YNEXT_CAD_SOURCE_ARCHIVE = 'C:\pad\naar\cad-source.zip'
$env:YNEXT_PLANNER_SOURCE_ARCHIVE = 'C:\pad\naar\planner-source.zip'
npx tsc -b packages/frontend
node scripts/build-frappe-app.mjs
```

Zonder variabelen verwacht de builder `studio-runtime/cad/` en
`studio-runtime/planner/`, elk met `index.html` en `source.zip`. Ontbrekende
inputs stoppen de build vóór de bestaande output wordt vervangen.
`prepareStudioAssets` controleert manifest/imports/WASM en kopieert de
gecontroleerde runtimes na de hoofdbuild. Het installatiepakket heeft
daarna geen Node- of Rust-build op de ERPNext-host nodig.

## Controlepunten

Test tegels en interne routes, een lokaal CAD-document, een private bijlage,
verboden bestandsadressen, paneelresize, Planner-taakinvoer en accountwissel.
Controleer de volledige testreeks en TypeScript, en kijk in de browser naar
asset-404's en CSP-fouten. Een cache-hit is geen garantie dat een koude
herlaad offline werkt: daar is geen serviceworkercontract voor.
