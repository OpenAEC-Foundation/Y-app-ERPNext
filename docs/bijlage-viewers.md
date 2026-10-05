# Bijlagen bekijken naast de mail — architectuur en beheer

> Hoe Y-next een bijlage (pdf, IFC-model, Word/Excel, tekening) naast de mail
> toont, hoe Open CAD Studio daarvoor op ERPNext zelf draait, en hoe je dit
> bijhoudt of uitbreidt zonder de opzet te breken. Doelpubliek: de
> ontwikkelaar die Y-next onderhoudt.

Zie ook: [deployment.md](./deployment.md) (hoe Y-next zelf op ERPNext komt).

---

## De opzet in één oogopslag

```
mail met bijlage "plattegrond.dwg"
 │
 ├─ lib/bijlage-soort.ts         welke soort is dit?  pdf | ifc | office | cad
 │
 ├─ ErpAttachmentList.tsx        bijlage krijgt een knop "openen" i.p.v. alleen downloaden
 │
 ├─ Webmail.tsx                  paneel naast de mail; per soort een eigen component
 │   └─ CadVoorbeeld.tsx         <iframe src="/ocs-viewer?src=<bestand>&naam=<naam>">
 │
 └─ ERPNext (zelfde server)
     ├─ Web Page "open-cad-studio" (route /ocs-viewer)   de laadpagina
     └─ /files/ocs_v1_*                                  het programma zelf (WebAssembly)
```

Hetzelfde paneel kan ook schermvullend in een eigen tabblad
(`VoorbeeldVenster.tsx`, hash-route `#/voorbeeld?soort=…&url=…&naam=…`).

---

## Vijf regels die de opzet dragen

1. **Alles blijft op de eigen ERPNext.** De viewer draait als pagina op
   dezelfde server als Y-next, en de tekening wordt opgehaald met de sessie
   van de ingelogde gebruiker. Er gaat geen tekening naar een website elders,
   er is geen CDN en geen publieke link. Tekeningen zijn vertrouwelijk, en een
   privé-bijlage is alleen met die sessie op te halen.
2. **Eén plek bepaalt de soort.** `lib/bijlage-soort.ts` is puur en getest.
   Nergens anders in de code wordt op extensies gecontroleerd.
3. **Zwaar spul laadt pas bij gebruik.** Elk voorbeeldcomponent komt via
   `lazy()` binnen, en het `iframe` bestaat pas als je een tekening
   openklikt. Het programma (18 MB) wordt dus alleen opgehaald bij de eerste
   tekening; daarna staat het in de cache van de browser.
4. **De viewer zelf wordt niet aangepast.** Alles wat nodig is om hem binnen
   ERPNext te laten werken, zit in de laadpagina: omleidingen, de brug naar de
   bestandskiezer, schermvullend maken en automatisch openen. Alleen de
   importpaden in twee bestanden worden herschreven (zie *Beheer*). Zo kun je
   een nieuwe versie plaatsen zonder patches opnieuw te maken.
5. **Er is altijd een uitweg.** Onder elk voorbeeld staan *Downloaden* en
   *Viewer in nieuw tabblad*. Lukt het automatisch openen niet, dan blijft
   onderin de tip staan: "Kies in de viewer Bestand openen (of Ctrl+O)". De
   tekening staat dan al klaar.

---

## Waar staat wat

### In deze repo (frontend)

| Bestand | Rol |
|---|---|
| `packages/frontend/src/lib/bijlage-soort.ts` (+ `.test.ts`) | Soort van een bijlage bepalen (`voorbeeldSoort`, `isCadNaam`, …). |
| `packages/frontend/src/components/mail/ErpAttachmentList.tsx` | Bijlagelijst bij een mail; een bekende soort krijgt een openknop. |
| `packages/frontend/src/pages/Webmail.tsx` | State `voorbeeld` (`{ url, naam, soort }`) en het paneel (`aside`) dat per `voorbeeld.soort` het juiste component toont. |
| `packages/frontend/src/components/mail/CadVoorbeeld.tsx` | Het `iframe` naar `/ocs-viewer`, met de knoppen Downloaden en Nieuw tabblad. |
| `packages/frontend/src/pages/VoorbeeldVenster.tsx` | Hetzelfde voorbeeld schermvullend in een eigen tabblad. |
| `i18n/{nl,en,de}.json`, sleutels `y_next.cad_preview_*` | Teksten onder de viewer. |
| `docs/bijlage-viewers/` | Kopie van de laadpagina (html, css, javascript), zie hieronder. |

### Op ERPNext (3bm.prilk.cloud)

**Web Page `open-cad-studio`** (route `ocs-viewer`, gepubliceerd, volle
breedte, zonder titel), met drie velden:

- *HTML*: het laadscherm (titel, voortgangsbalk, tipregel);
- *CSS*: laadscherm, en verbergt de navigatiebalk en voettekst van ERPNext;
- *JavaScript*: het laadscript. Dit is het hart van de integratie.

Een kopie van alle drie staat in `docs/bijlage-viewers/`. **Pas je de pagina
in ERPNext aan, zet de nieuwe versie dan ook daar neer**; anders weet de
volgende niet meer wat er live staat.

**Bestanden** (publieke `File`-documenten onder `/files/`). Dit is
programmacode, geen gegevens; daarom mogen ze publiek zijn.

| Bestand | Grootte | Rol |
|---|---|---|
| `ocs_v1_wasm_gz.bin` | 18 MB | Het programma: `OpenCADStudio_bg.wasm` (54 MB), gecomprimeerd met gzip. |
| `ocs_v1_glue.js` | 170 kB | De JavaScript-lijm van het programma (wasm-bindgen). Importpad aangepast, zie *Beheer*. |
| `ocs_v1_clipboard.js` | 1 kB | Klein hulpscript van de viewer (kopiëren naar het klembord). |
| `ocs_v1_worker.js` | 1 kB | Ingang van de parse-worker, die dwg/dxf inleest. Importpaden aangepast. |
| `ocs_v1_worker_glue.js` | 12 kB | Lijm van de parse-worker. |
| `ocs_v1_worker_bg.wasm` | 4,6 MB | De parser zelf. |
| `ocs_v1_latin.ttf` | 106 kB | Lettertype voor tekst in tekeningen. |
| `ocs_v1_viewer.html` | 4 kB | Oudere, losse versie van de laadpagina. Niet meer in gebruik; kan weg. |

---

## Hoe de laadpagina werkt

`CadVoorbeeld` opent `/ocs-viewer?src=<bestandsadres>&naam=<bestandsnaam>`.
Het laadscript doet dan, in deze volgorde:

1. **Omleidingen.** De viewer gaat ervan uit dat hij in de hoofdmap van een
   website staat: hij start zijn worker als `ocs-parse-worker.js` en haalt
   lettertypen uit `/fonts/…`. Op ERPNext is alleen `/files` beschrijfbaar.
   Daarom leidt het script `window.Worker` en `window.fetch` om via de tabel
   `BESTANDEN` (`ocs-parse-worker.js` → `/files/ocs_v1_worker.js`,
   `/fonts/latin.ttf` → `/files/ocs_v1_latin.ttf`). Zonder die omleiding
   blijft openen op 10% hangen.
2. **Tekening ophalen**, tegelijk met het programma:
   `fetch(src, { credentials: "include" })`, dus met de sessie van de
   gebruiker. De tekening wordt twee keer klaargezet: als `File`, en als echt
   bestand in de privé-opslag van de browser (OPFS). Dat laatste is nodig
   omdat de viewer controleert of hij een échte `FileSystemFileHandle`
   terugkrijgt; een nagemaakt object valt door de mand.
3. **Brug naar de bestandskiezer.** `window.showOpenFilePicker` geeft de
   klaargezette handle terug, en een klik op een `<input type="file">` vult
   dat veld met de tekening. Zo krijgt de viewer bij *Openen* deze tekening in
   plaats van een bestandsvenster.
4. **Programma starten.** `/files/ocs_v1_wasm_gz.bin` ophalen (met
   voortgangsbalk), uitpakken met `DecompressionStream("gzip")` en starten
   via `init({ module_or_path: bytes })` uit `ocs_v1_glue.js`.
5. **Schermvullend.** De viewer hangt zijn tekenvlak onder de opmaak van de
   ERPNext-pagina, waardoor de bovenkant zwart bleef. Het script zet het
   `canvas` vast over het hele venster en meet opnieuw bij elke
   maatwijziging (`ResizeObserver`); anders blijft het beeld in een hoek
   hangen als je het paneel naast de mail groter of kleiner maakt.
6. **Vanzelf openen.** De viewer kan van buitenaf geen bestand krijgen, maar
   heeft wel een opdrachtregel. Het script typt `OPEN` + Enter op het canvas,
   zet de tekening in het invoerveld dat dan verschijnt, en typt daarna
   `PROPERTIES` (eigenschappenpaneel dicht) en `ZE` (zoom extents, de hele
   tekening in beeld). Lukt dit niet binnen enkele seconden, dan blijft de tip
   staan en opent de gebruiker hem met Ctrl+O.

**Voorwaarde: dezelfde server.** Het `iframe`, de viewer en de privé-bijlage
moeten van hetzelfde domein komen, anders stuurt de browser de sessie niet
mee. Dat klopt zolang Y-next als Web Page op ERPNext draait
(`/y-next` en `/ocs-viewer` op dezelfde host). Voor een opzet op een ander
domein (bijvoorbeeld de desktop-app) werkt dit niet zonder aanpassing.

---

## Beheer: een nieuwe versie van Open CAD Studio plaatsen

Open CAD Studio is open-source (GPL-3.0), broncode op
`github.com/HakanSeven12/OpenCADStudio`. De webversie wordt gebouwd met Trunk.

1. **Bouwen.** In de repo van Open CAD Studio:
   ```bash
   rustup target add wasm32-unknown-unknown
   cargo install trunk wasm-bindgen-cli
   trunk build --release
   ```
   De uitvoer in `dist/` bevat het hoofdprogramma (`.js` + `_bg.wasm`), de
   parse-worker (ingang, lijm en eigen `.wasm`), `snippets/…/clipboard.js`
   en `fonts/`. Namen met een hash verschillen per build; herken ze aan hun
   rol.
2. **Nieuw voorvoegsel.** Gebruik `ocs_v2_` (enzovoort). Overschrijf nooit de
   bestanden van de werkende versie: browsers bewaren `/files` lang in hun
   cache, en een half geplaatste set breekt de viewer die nu live staat.
3. **Comprimeren.** ERPNext neemt geen 54 MB aan (zie *Max File Size* in de
   systeeminstellingen):
   ```bash
   gzip -9 -c OpenCADStudio-<hash>_bg.wasm > ocs_v2_wasm_gz.bin
   ```
   De extensie `.bin` zorgt dat het bestand als ruwe bytes wordt geleverd; het
   uitpakken doet de laadpagina.
4. **Importpaden herschrijven.** Dit zijn de enige wijzigingen in de
   bestanden van de viewer zelf:
   - in de lijm van het hoofdprogramma: de import van
     `./snippets/…/clipboard.js` wordt `/files/ocs_v2_clipboard.js`. Zoek op
     `snippets/`; elk snippet dat je vindt, moet als eigen bestand mee;
   - in de ingang van de worker: de import van de worker-lijm wordt
     `/files/ocs_v2_worker_glue.js`, en `init(…)` krijgt
     `"/files/ocs_v2_worker_bg.wasm"`.
5. **Uploaden** als *publieke* bestanden in ERPNext.
6. **Laadpagina bijwerken** (Web Page `open-cad-studio` → JavaScript): de
   paden in de tabel `BESTANDEN` en de twee paden onder "Het programma"
   (`ocs_v…_wasm_gz.bin` en `ocs_v…_glue.js`) naar `v2`. Laadt de nieuwe
   versie meer lettertypen uit `/fonts/` (de viewer heeft losse subsets per
   schrift), neem die dan ook op in `BESTANDEN`. Zet de nieuwe versie daarna
   ook in `docs/bijlage-viewers/`.
7. **Testen** (zie hieronder). Vooral het vanzelf openen: als een nieuwe
   versie zijn opdrachten anders noemt (`OPEN`, `PROPERTIES`, `ZE`), past
   `openVanzelf` in het laadscript zich niet vanzelf aan.
8. **Opruimen.** Haal de bestanden van de vorige versie na een week weg,
   zodat tabbladen die nog openstonden niet halverwege breken.

---

## Uitbreiden: een nieuw bestandstype laten zien

Voorbeeld: je wilt ook `.step`-bestanden naast de mail kunnen bekijken.

1. **`lib/bijlage-soort.ts`**: voeg de soort toe aan `BijlageSoort`, schrijf
   een `isStepNaam()` en neem hem op in `voorbeeldSoort()`. Schrijf de test
   in `bijlage-soort.test.ts` eerst.
2. **`ErpAttachmentList.tsx`**: neem de nieuwe soort op in de voorwaarde voor
   de openknop.
3. **Component** `components/mail/StepVoorbeeld.tsx` met props
   `{ url, naam }`, zelfde opbouw als `CadVoorbeeld.tsx` (viewer boven,
   knoppen Downloaden en Nieuw tabblad onder).
4. **`Webmail.tsx`**: breid het type van de state `voorbeeld` uit, importeer
   het component met `lazy()`, en voeg een tak toe in het paneel. Doe
   hetzelfde in **`VoorbeeldVenster.tsx`**.
5. **Teksten** in `nl.json`, `en.json` en `de.json`.
6. **Zware viewer nodig?** Host hem zoals Open CAD Studio: een Web Page op
   ERPNext als laadpagina, de programmabestanden onder `/files` met een
   versievoorvoegsel, en een `iframe` ernaartoe. Dezelfde vijf regels gelden.
7. **Release notes** (`pages/ReleaseNotes.tsx`), dan tests, typecheck en
   deploy volgens [deployment.md](./deployment.md).

---

## Testen

**Automatisch:**

```bash
npm test --workspace packages/frontend
npx tsc -p packages/frontend/tsconfig.json --noEmit
```

**In de browser**, met een mail die een `.dwg` als bijlage heeft:

- [ ] De bijlage heeft een openknop; klikken opent het paneel naast de mail.
- [ ] Het laadscherm toont een voortgangsbalk, daarna verschijnt de viewer.
- [ ] De tekening opent vanzelf, helemaal in beeld, zonder eigenschappenpaneel.
- [ ] Het paneel groter of kleiner maken: het beeld schaalt mee.
- [ ] *Downloaden* en *Viewer in nieuw tabblad* werken.
- [ ] Het schermvullende venster (knop in de kop van het paneel) werkt.
- [ ] Een tweede tekening opent snel: het programma komt uit de cache.

De viewerpagina kun je ook los testen, ingelogd in ERPNext:
`https://3bm.prilk.cloud/ocs-viewer?src=/private/files/<bestand>.dwg&naam=<bestand>.dwg`

---

## Symptomen en waar je moet zoeken

| Wat je ziet | Waarschijnlijke oorzaak |
|---|---|
| Openen blijft op 10% hangen | De parse-worker wordt niet gevonden: controleer `BESTANDEN` en de paden in `ocs_v…_worker.js`. |
| "laden mislukt: HTTP 404" op het laadscherm | Pad naar `…_wasm_gz.bin` of `…_glue.js` klopt niet, of het bestand is privé in plaats van publiek. |
| Viewer start, tekening opent niet; tip blijft staan | Het vanzelf openen haalt het niet (andere opdrachtnamen, trage computer). Ctrl+O werkt dan wel; pas eventueel de wachttijden in `openVanzelf` aan. |
| Bovenkant zwart of beeld in een hoek | `schermVullend` of het opnieuw meten doet zijn werk niet meer, bijvoorbeeld door een nieuwe opbouw van de viewerpagina. |
| Tekst in de tekening ontbreekt | Een lettertype wordt niet omgeleid; voeg het toe aan `BESTANDEN`. |
| "HTTP 403" bij de tekening | De gebruiker mag die bijlage in ERPNext niet zien. Dat is juist. |
| Uploaden in ERPNext geweigerd | Bestand te groot: comprimeren, of *Max File Size* nakijken. |

---

## Niet doen

- **Een tekening naar een externe viewer of website sturen**, of er een
  publieke link van maken. Dat breekt regel 1.
- **Bestanden van de werkende versie overschrijven.** Altijd een nieuw
  versievoorvoegsel gebruiken.
- **De viewercode zelf patchen** buiten de importpaden. Oplossingen horen in
  de laadpagina.
- **Het `iframe` naar een ander domein laten wijzen.** Dan gaat de sessie niet
  mee en krijgt de viewer privé-bijlagen niet binnen.
- **De viewer vooraf laden**, bijvoorbeeld bij het openen van E-mail. Dat
  kost iedereen 18 MB, ook wie nooit een tekening opent.

**Licentie.** Open CAD Studio valt onder GPL-3.0. Gebruik op de eigen server
is prima. Geef je de (aangepaste) bestanden aan anderen, lever dan ook de
broncode mee, inclusief de aangepaste importpaden.
