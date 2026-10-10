# Y-next als Frappe-app: werkwijze

De app staat in `frappe-app/`. Het ontwerp staat in
`docs/superpowers/specs/2026-10-10-y-next-frappe-app-design.md`.

## Wat je nodig hebt

- Een lokale bench met Frappe 16 en ERPNext 16 in Docker Compose, met een site
  waar alleen die twee apps op staan.
- Node 24 en de afhankelijkheden van de frontend (`npm install`).

Zet twee omgevingsvariabelen:

    YNEXT_BENCH_DIR   map met het docker-compose.yml van de bench
    YNEXT_BENCH_SITE  de site waarop de app komt

## Bouwen en installeren

    node scripts/build-frappe-app.mjs     bundel bouwen in frappe-app/y_next/public/app/
    node scripts/dev-bench-sync.mjs       app naar de bench kopiëren; de eerste keer ook installeren

Open daarna `/y-next` op de site.

Na een wijziging in Python of in de bundel is `node scripts/dev-bench-sync.mjs`
genoeg. Verandert er iets aan doctypes, velden of rechten, gebruik dan
`node scripts/dev-bench-sync.mjs --migrate`.

## Meer sites op één bench

De ontwikkelserver van Frappe stuurt elk verzoek naar de standaardsite zolang
`default_site` in `sites/common_site_config.json` gevuld is, wat de hostnaam
ook is. Staan er meer sites op de bench, maak die instelling dan leeg:

    bench set-config -g default_site ""

Daarna bepaalt de hostnaam de site (`http://<site>:8000`) en moet elke
`bench`-opdracht een `--site` meekrijgen.

Het provisioneringsscript van de publicatieroute kan zo'n site ook aanwijzen
als de hostnaam vanaf de ontwikkelmachine niet te bereiken is:

    YNEXT_BASE_URL=http://localhost:8000 YNEXT_SITE_NAME=<site> node scripts/provision-y-next.mjs

## Wat de app op een site inricht

- **Eigen doctypes** staan in `frappe-app/y_next/y_next/doctype/`. Een nieuw
  doctype of een wijziging maak je in de Desk op de ontwikkelsite; Frappe
  schrijft de bestanden dan in de app op de bench. Haal ze terug met
  `node scripts/dev-bench-sync.mjs --pull`, anders gooit de volgende run ze weg.
- **Velden op standaarddoctypes, rechten en stamgegevens** staan als JSON in
  `frappe-app/y_next/setup/`. `setup/install.py` past ze toe bij de installatie
  en na elke migratie. Een definitie voor een doctype of rol die niet bestaat
  wordt overgeslagen.

`scripts/provision-y-next.mjs` leest dezelfde bestanden en zet ze via de
REST-API op een site zonder de app. Een wijziging in de definities werkt dus
op beide routes door; de tests van dat script leggen de exacte velden en
rechten vast.

## Testen

    node --test scripts/dev-bench-sync.test.mjs scripts/build-frappe-app.test.mjs
    bench --site <site> run-tests --app y_next        (in de bench)

De site heeft `allow_tests` nodig: `bench --site <site> set-config allow_tests true`.

## Generiek blijven

De app noemt geen organisatie. Wat per organisatie verschilt staat op de site:
de huisstijl van de ondertekening op `Company`, de afdrukformaten als Print
Format, de rest als rij in `Y Next Setting`.

`scripts/lib/generiek-check.mjs` bewaakt dat. `npm test` draait de controle op
de frontendbron en op `frappe-app/`; het releasescript draait haar op het
samengestelde resultaat. De termen staan als vingerafdruk in het script. Een
term toevoegen:

    node scripts/lib/generiek-check.mjs --vingerafdruk <term>

## Uitbrengen

`scripts/release-frappe-app.mjs` stelt een release samen in een checkout van de
distributierepository (`OpenAEC-Foundation/y_next`, branch `version-16`):

    node scripts/release-frappe-app.mjs --doel ../y_next

Het script eist een schone werkmap, draait typecontrole en tests, bouwt de
bundel, kopieert `frappe-app/` naar het doel met de versie uit `package.json`
erin, draait de generiek-controle en legt vast als `Release <versie>` met tag
`v<versie>`. Pushen en de GitHub-release maken gebeurt alleen met
`--publiceer`. Draai vooraf de Python-tests op de bench; die kan het script
niet zelf draaien.

## Hoe het in elkaar zit

- `www/y-next.html` is een volledig HTML-document; Frappe zet er daarom geen
  websitesjabloon omheen. `www/y_next.py` levert het CSRF-token en zet de
  pagina op niet-cachen.
- De bundel is dezelfde Vite-build als voor de publicatieroute, met `base`
  `/assets/y_next/app/`. De pagina leest `.vite/manifest.json` om het
  startbestand te vinden.
- `frappe-app/y_next/public/app/` staat in `.gitignore`: de bundel hoort niet
  in deze repository, wel in de distributierepository.
