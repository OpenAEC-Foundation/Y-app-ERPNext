# Ontwerp: projectmappen op NAS aanmaken (desktop-native)

**Datum:** 2026-06-27
**Status:** Goedgekeurd ontwerp — wacht op implementatieplan
**Herkomst:** OPMERKINGEN-punt 3 — "projectmappen op nas aanmaken door instellingen in de y-app: stel originele mappenstructuur in + waar het moet komen"

## Context

3BM werkt met een vaste projectmappenstructuur op de NAS (zie workspace-CLAUDE.md:
`P:/Projecten/[YYYY-NNNN] [Naam]/00 Projectinfo … 99 Archief`). Vandaag maakt
niemand die structuur vanuit Y-app aan; het gebeurt handmatig in de verkenner.
De wens: vanuit Y-app, met één actie, voor een ERPNext-project de complete
mappenstructuur op de NAS aanmaken door een **master-map te kopiëren en te
hernoemen** naar de projectnaam.

**Bewust besloten (deze sessie):**
- **Werkt in de Windows desktop-app, zonder Nextcloud.** Niet via de browser-FSA
  (geen "kopieer map"-primitief → handgerolde byte-copy, Chrome/Edge-only) en niet
  via de eerder geopperde Nextcloud-WebDAV-richting. De desktop-app heeft native
  filesystem/SMB-toegang en kan een map in één bewerking recursief kopiëren.
- Dit wijkt bewust af van de NAS-strategie-afspraak van 2026-05-25 (Nextcloud
  WebDAV / `NasClient`-laag). Reden: Piet wil het in de desktop-app, zonder
  Nextcloud-afhankelijkheid; native OS-kopie is exact "kopieer + hernoem".

## Scope

**In scope:**
- Recursieve kopie van een **master-map** (inclusief alle submappen én bestanden)
  naar een nieuwe projectmap op de NAS, hernoemd volgens een template.
- Handmatige trigger: een knop op een project.
- Instelbaar in Settings: master-map-pad, doel-root-pad, projectmapnaam-template.

**Out of scope (expliciet):**
- Web-app: deze feature is **desktop-only**. De knop is verborgen in de web-build.
- Nextcloud / WebDAV / de bredere `NasClient`-laag.
- Automatisch aanmaken bij projectcreatie (alleen handmatig, deze iteratie).
- Bestaande mappen samenvoegen of overschrijven.
- Android (geen SMB/NAS-pad in die context).

**Afhankelijkheid:** deze feature rijdt mee op de desktop-app-rebuild (die eerst
voor mail-versturen wordt gedaan). De desktop-release draait sinds 2026-04-21 niet
meer succesvol — die build moet eerst weer werken voordat dit getest/uitgeleverd
kan worden.

## Architectuur

Zelfde patroon als mail in de desktop-app: de gedeelde frontend doet een gewone
`fetch("/api/…")`; in de desktop-build routeert de fetch→invoke-adapter dat naar
een Rust-commando, in de web-build bestaat de route niet.

```
ProjectDetail (gedeelde frontend, knop alleen in desktop-build)
   │  fetch POST /api/nas/create-folders { masterPath, targetPath }
   ▼
packages/desktop/src/adapter/fetch.ts   → invoke("create_project_folders", …)
   ▼
packages/desktop/src-tauri/src/commands.rs  create_project_folders()
   │  std::fs recursieve kopie  (masterPath → targetPath)
   ▼
NAS via Windows/SMB-pad (mapped drive of UNC)
```

## Componenten

### 1. Rust-commando (`packages/desktop/src-tauri/src/commands.rs`)
`create_project_folders(master_path: String, target_path: String) -> Result<…>`,
geregistreerd in `lib.rs` `generate_handler!`.
- Recursieve `std::fs`-kopie van `master_path` naar `target_path` (mappen + bestanden).
- **Conflict:** als `target_path` al bestaat → fout `target_exists` (geen overschrijven/merge).
- Validatie: `master_path` bestaat en is een map; nette fouten voor
  `master_not_found`, `permission_denied`, `io_error`.
- Bij een fout halverwege: best-effort opruimen van de half-gekopieerde doelmap
  zodat er geen halve structuur achterblijft.

### 2. Bridge (`packages/desktop/src/adapter/fetch.ts`)
Nieuwe route `POST /api/nas/create-folders` → leest `{ masterPath, targetPath }` uit
de body, roept `invoke("create_project_folders", …)`, mapt het resultaat naar een
JSON-respons `{ ok }` of `{ error }`. Web-Express heeft deze route niet.

### 3. Instellingen (frontend, Settings → "Project instellingen")
Bij het bestaande NAS-blok (`NasSettingsSection`), opgeslagen als gedeelde
`instance_settings` (UNC-paden zijn machine-onafhankelijk → veilig te delen):
- `nas-project-master-path` — pad naar de master-map (bv. `\\DRIEBM-NAS\3bm\_TEMPLATES\Projectmap`).
- `nas-project-target-root` — root waar projectmappen komen (bv. `\\DRIEBM-NAS\3bm\Projecten`).
- `nas-project-folder-template` — mapnaam-template, default `{nr} {project_name}`.

Hergebruik `resolveTemplate` + `sanitizeForFilesystem` uit
`packages/frontend/src/lib/nasConfig.ts` voor de mapnaam.

### 4. UI (frontend, ProjectDetail)
Knop **"Maak NAS-mappen aan"**, alleen zichtbaar in de desktop-build
(desktop-mode-detectie). Flow:
1. Bereken `targetPath` = `targetRoot` + `/` + resolved template (mapnaam uit het
   project: `{nr}` = ERPNext `project.name`, bv. `2024-0142`; `{project_name}` = titel).
2. Bevestigingsdialoog met het volledige doelpad.
3. `fetch POST /api/nas/create-folders`.
4. Toast: gelukt / "map bestaat al" / foutmelding. Geen overschrijven.

## Data flow (happy path)
Klik → frontend bouwt `targetPath` uit instellingen + project → bevestiging →
`fetch` → adapter → Rust `create_project_folders` → recursieve kopie → `{ ok }` →
toast "Projectmappen aangemaakt".

## Foutafhandeling
| Situatie | Gedrag |
|---|---|
| Master-map niet gevonden | Toast: "Master-map niet gevonden — controleer de instelling." |
| Doelmap bestaat al | Toast: "Map bestaat al — niet overschreven." Geen actie. |
| Geen toegang / NAS onbereikbaar | Toast met de OS-fout. |
| Kopie halverwege mislukt | Half-gekopieerde doelmap opruimen, fout tonen. |
| Web-build (geen desktop) | Knop niet zichtbaar. |

## Testen
- **Rust-unittest** voor `create_project_folders`: kopieert een tijdelijke
  master-map (met geneste submappen + bestanden) naar een doel; assert dat de
  structuur + bestandsinhoud klopt; assert `target_exists`-fout als doel bestaat;
  assert `master_not_found`.
- **Handmatig (desktop-build):** master-map met de 3BM-structuur op een
  test-NAS-pad; knop op een project; controleer dat de complete boom verschijnt
  onder de juiste projectmapnaam; herhaal → "map bestaat al".
- Frontend: knop verborgen in de web-build (desktop-detectie).

## Open punten / aannames
- Mapnaam-default `{nr} {project_name}`; aanpasbaar in de instelling.
- Paden bij voorkeur als UNC (`\\server\share\…`) i.p.v. drive-letters, zodat ze
  cross-device kloppen (drive-mappings verschillen per machine).
