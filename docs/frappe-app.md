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

## Testen

    node --test scripts/dev-bench-sync.test.mjs scripts/build-frappe-app.test.mjs
    bench --site <site> run-tests --app y_next        (in de bench)

De site heeft `allow_tests` nodig: `bench --site <site> set-config allow_tests true`.

## Hoe het in elkaar zit

- `www/y-next.html` is een volledig HTML-document; Frappe zet er daarom geen
  websitesjabloon omheen. `www/y_next.py` levert het CSRF-token en zet de
  pagina op niet-cachen.
- De bundel is dezelfde Vite-build als voor de publicatieroute, met `base`
  `/assets/y_next/app/`. De pagina leest `.vite/manifest.json` om het
  startbestand te vinden.
- `frappe-app/y_next/public/app/` staat in `.gitignore`: de bundel hoort niet
  in deze repository, wel in de distributierepository.
