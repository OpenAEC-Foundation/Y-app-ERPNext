# NAS projectmappen aanmaken — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In de Y-app desktop-app (Tauri/Windows) met één knop op een project de complete projectmappenstructuur op de NAS aanmaken, door een master-map recursief te kopiëren en te hernoemen.

**Architecture:** Gedeelde frontend doet `fetch("/api/nas/create-folders")`; de desktop fetch→invoke-adapter routeert dat naar een Rust-commando dat `std::fs` recursief kopieert. Web-build heeft de route niet → de knop is daar verborgen. Instellingen (master-pad, doel-root, mapnaam-template) staan als gedeelde `instance_settings`.

**Tech Stack:** Rust (Tauri 2, `std::fs`), TypeScript/React 19 (gedeelde frontend), bestaande `instance_settings` + `nasConfig.ts` helpers.

## Global Constraints

- **Desktop-only feature.** De knop verschijnt alleen in de desktop-build (`isDesktopApp()` → `"__TAURI_INTERNALS__" in window`). De web-build (Express) implementeert de route NIET.
- **Geen Nextcloud, geen browser-FSA.** Uitsluitend native `std::fs` in de Rust-backend.
- **Geen overschrijven/samenvoegen.** Bestaat de doelmap al → fout `target_exists`, geen actie.
- **Paden machine-onafhankelijk.** Voorkeur UNC (`\\server\share\...`); instellingen worden als gedeelde `instance_settings` opgeslagen.
- **i18n:** elke user-facing string in nl.json + en.json in dezelfde commit (de.json waar haalbaar).
- **Rust-commando registreren** in `packages/desktop/src-tauri/src/lib.rs` `generate_handler!`.
- **Afhankelijkheid:** rijdt mee op de desktop-rebuild; pas testbaar als de desktop-build weer draait.

---

### Task 1: Rust-commando `create_project_folders` (recursieve map-kopie)

**Files:**
- Create: `packages/desktop/src-tauri/src/nas.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs` (module + `generate_handler!`)

**Interfaces:**
- Produces: `#[tauri::command] pub fn create_project_folders(master_path: String, target_path: String) -> Result<(), String>` — kopieert `master_path` recursief naar `target_path`; `Err("target_exists")` als `target_path` al bestaat; `Err("master_not_found")` als `master_path` geen bestaande map is; andere fouten als `Err("io: ...")`. Bij fout halverwege wordt de half-gemaakte `target_path` opgeruimd.

- [ ] **Step 1: Schrijf de falende test**

In `packages/desktop/src-tauri/src/nas.rs`:

```rust
use std::fs;
use std::path::Path;

/// Recursief een map kopiëren (mappen + bestanden). Geen overschrijven:
/// als `dst` al bestaat is dat de verantwoordelijkheid van de caller.
fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn create_project_folders(master_path: String, target_path: String) -> Result<(), String> {
    let master = Path::new(&master_path);
    let target = Path::new(&target_path);
    if !master.is_dir() {
        return Err("master_not_found".to_string());
    }
    if target.exists() {
        return Err("target_exists".to_string());
    }
    if let Err(e) = copy_dir_recursive(master, target) {
        // Opruimen van een half-gekopieerde doelmap.
        let _ = fs::remove_dir_all(target);
        return Err(format!("io: {}", e));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn unique_tmp(name: &str) -> std::path::PathBuf {
        // Gebruik de proces-id + naam i.p.v. een random crate.
        env::temp_dir().join(format!("yapp_nas_test_{}_{}", std::process::id(), name))
    }

    #[test]
    fn copies_nested_structure_and_files() {
        let master = unique_tmp("master");
        let target = unique_tmp("target");
        let _ = fs::remove_dir_all(&master);
        let _ = fs::remove_dir_all(&target);
        fs::create_dir_all(master.join("01 Correspondentie")).unwrap();
        fs::create_dir_all(master.join("04 Tekeningen/sub")).unwrap();
        fs::write(master.join("01 Correspondentie/readme.txt"), b"hallo").unwrap();

        create_project_folders(
            master.to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
        )
        .unwrap();

        assert!(target.join("01 Correspondentie").is_dir());
        assert!(target.join("04 Tekeningen/sub").is_dir());
        assert_eq!(
            fs::read_to_string(target.join("01 Correspondentie/readme.txt")).unwrap(),
            "hallo"
        );

        let _ = fs::remove_dir_all(&master);
        let _ = fs::remove_dir_all(&target);
    }

    #[test]
    fn refuses_when_target_exists() {
        let master = unique_tmp("master2");
        let target = unique_tmp("target2");
        fs::create_dir_all(&master).unwrap();
        fs::create_dir_all(&target).unwrap();
        let err = create_project_folders(
            master.to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
        )
        .unwrap_err();
        assert_eq!(err, "target_exists");
        let _ = fs::remove_dir_all(&master);
        let _ = fs::remove_dir_all(&target);
    }

    #[test]
    fn errors_when_master_missing() {
        let target = unique_tmp("target3");
        let err = create_project_folders(
            unique_tmp("does_not_exist").to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
        )
        .unwrap_err();
        assert_eq!(err, "master_not_found");
    }
}
```

- [ ] **Step 2: Registreer de module + het commando**

In `packages/desktop/src-tauri/src/lib.rs`: voeg `mod nas;` toe bij de andere `mod`-declaraties, en voeg `nas::create_project_folders,` toe aan de `tauri::generate_handler![ … ]`-lijst (na de `commands::`-regels).

- [ ] **Step 3: Run de tests — verwacht falen vóór registratie, slagen erna**

Run: `cd packages/desktop/src-tauri && cargo test nas::`
Expected: 3 tests PASS (`copies_nested_structure_and_files`, `refuses_when_target_exists`, `errors_when_master_missing`).

- [ ] **Step 4: Compileer de hele crate**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: geen errors (commando geregistreerd, geen ongebruikte-import-warnings die als error falen).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/nas.rs packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): create_project_folders Rust-commando (recursieve NAS-map-kopie)"
```

---

### Task 2: Adapter-route `/api/nas/create-folders`

**Files:**
- Modify: `packages/desktop/src/adapter/fetch.ts`

**Interfaces:**
- Consumes: `create_project_folders` (Task 1) via `invoke`.
- Produces: HTTP-route `POST /api/nas/create-folders`, body `{ masterPath: string, targetPath: string }` → `200 { ok: true }` of `502 { error: string }`.

- [ ] **Step 1: Voeg de route toe**

In `packages/desktop/src/adapter/fetch.ts`, bij de andere `if (url === "/api/..." && method === "POST")`-blokken (bv. direct ná het `"/api/desktop/preferences"`-blok), voeg toe:

```ts
    if (url === "/api/nas/create-folders" && method === "POST") {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const masterPath = String(body.masterPath || "");
      const targetPath = String(body.targetPath || "");
      if (!masterPath || !targetPath) {
        return jsonResponse({ error: "missing_paths" }, 400);
      }
      try {
        await invoke("create_project_folders", { masterPath, targetPath });
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }
```

- [ ] **Step 2: Typecheck de desktop-package**

Run: `cd packages/desktop && npx tsc --noEmit -p tsconfig.json`
Expected: geen errors. (Als de desktop-package geen los `tsc`-script heeft, valt dit onder de Tauri-build in Task 6 van de uitlevering; noteer dat en ga door.)

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src/adapter/fetch.ts
git commit -m "feat(desktop): /api/nas/create-folders route → create_project_folders"
```

---

### Task 3: Gedeelde config + desktop-detectie (frontend)

**Files:**
- Create: `packages/frontend/src/lib/desktop.ts`
- Modify: `packages/frontend/src/lib/nasConfig.ts`

**Interfaces:**
- Produces:
  - `isDesktopApp(): boolean` — `typeof window !== "undefined" && "__TAURI_INTERNALS__" in window`.
  - `interface NasProjectFoldersConfig { masterPath: string; targetRoot: string; folderTemplate: string }`
  - `loadProjectFoldersConfig(instanceId: string): NasProjectFoldersConfig`
  - `saveProjectFoldersConfig(instanceId: string, cfg: NasProjectFoldersConfig): void` (localStorage + fire-and-forget PUT naar `instance_settings` key `nas-project-folders`)
  - `hydrateProjectFoldersConfig(): Promise<void>` (server → localStorage)
  - Hergebruikt bestaande `resolveTemplate` + `sanitizeForFilesystem` uit ditzelfde bestand.

- [ ] **Step 1: Schrijf de desktop-detector**

In nieuw bestand `packages/frontend/src/lib/desktop.ts`:

```ts
/** True wanneer de gedeelde frontend in de Tauri desktop-app draait.
 *  Tauri 2 injecteert altijd `window.__TAURI_INTERNALS__` in de webview. */
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
```

- [ ] **Step 2: Voeg de project-folders config toe aan nasConfig.ts**

In `packages/frontend/src/lib/nasConfig.ts`, na `hydrateNasConfig()`:

```ts
const PROJECT_FOLDERS_KEY = "nas-project-folders";

export interface NasProjectFoldersConfig {
  masterPath: string;
  targetRoot: string;
  folderTemplate: string;
}

const DEFAULT_PROJECT_FOLDERS: Readonly<NasProjectFoldersConfig> = Object.freeze({
  masterPath: "",
  targetRoot: "",
  folderTemplate: "{nr} {project_name}",
});

function projectFoldersKey(instanceId: string): string {
  return `y-app-nas-project-folders-${instanceId}`;
}

export function loadProjectFoldersConfig(instanceId: string): NasProjectFoldersConfig {
  try {
    const raw = localStorage.getItem(projectFoldersKey(instanceId));
    if (!raw) return { ...DEFAULT_PROJECT_FOLDERS };
    const p = JSON.parse(raw) as Partial<NasProjectFoldersConfig>;
    return {
      masterPath: typeof p.masterPath === "string" ? p.masterPath : "",
      targetRoot: typeof p.targetRoot === "string" ? p.targetRoot : "",
      folderTemplate: typeof p.folderTemplate === "string" ? p.folderTemplate : DEFAULT_PROJECT_FOLDERS.folderTemplate,
    };
  } catch {
    return { ...DEFAULT_PROJECT_FOLDERS };
  }
}

export function saveProjectFoldersConfig(instanceId: string, cfg: NasProjectFoldersConfig): void {
  try { localStorage.setItem(projectFoldersKey(instanceId), JSON.stringify(cfg)); } catch { /* ignore */ }
  const activeId = getActiveInstanceId();
  if (!activeId || activeId === "default") return;
  fetch(`/api/instances/${encodeURIComponent(activeId)}/settings/${PROJECT_FOLDERS_KEY}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: cfg }),
  }).catch(() => { /* stil — localStorage heeft de waarde */ });
}

export async function hydrateProjectFoldersConfig(): Promise<void> {
  const activeId = getActiveInstanceId();
  if (!activeId || activeId === "default") return;
  try {
    const res = await fetch(`/api/instances/${encodeURIComponent(activeId)}/settings/${PROJECT_FOLDERS_KEY}`, { credentials: "same-origin" });
    if (!res.ok) return;
    const data = await res.json();
    const v = data?.value;
    if (!v || typeof v !== "object") return;
    saveLocalOnly(activeId, {
      masterPath: typeof v.masterPath === "string" ? v.masterPath : "",
      targetRoot: typeof v.targetRoot === "string" ? v.targetRoot : "",
      folderTemplate: typeof v.folderTemplate === "string" ? v.folderTemplate : DEFAULT_PROJECT_FOLDERS.folderTemplate,
    });
  } catch { /* server onbereikbaar — behoud localStorage */ }
}

function saveLocalOnly(instanceId: string, cfg: NasProjectFoldersConfig): void {
  try { localStorage.setItem(projectFoldersKey(instanceId), JSON.stringify(cfg)); } catch { /* ignore */ }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/frontend && ./node_modules/.bin/tsc -b`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/lib/desktop.ts packages/frontend/src/lib/nasConfig.ts
git commit -m "feat(nas): gedeelde project-folders config + isDesktopApp() helper"
```

---

### Task 4: Instellingen-UI (master-pad, doel-root, mapnaam-template)

**Files:**
- Modify: `packages/frontend/src/components/NasSettingsSection.tsx`
- Modify: `packages/frontend/src/i18n/nl.json`, `packages/frontend/src/i18n/en.json`, `packages/frontend/src/i18n/de.json`

**Interfaces:**
- Consumes: `loadProjectFoldersConfig`, `saveProjectFoldersConfig`, `hydrateProjectFoldersConfig` (Task 3).

- [ ] **Step 1: i18n-keys toevoegen**

In `nl.json` (en vertaald in `en.json`/`de.json`), bij de bestaande `settings.nas.*`-keys:

```json
"settings.nas.project_folders_title": "Projectmappen aanmaken (NAS)",
"settings.nas.project_master": "Master-map (pad)",
"settings.nas.project_master_help": "Map die als sjabloon gekopieerd wordt. Gebruik een UNC-pad, bv. \\\\DRIEBM-NAS\\3bm\\_TEMPLATES\\Projectmap.",
"settings.nas.project_target_root": "Doel-root (pad)",
"settings.nas.project_target_root_help": "Map waarin de projectmappen komen, bv. \\\\DRIEBM-NAS\\3bm\\Projecten.",
"settings.nas.project_folder_name": "Mapnaam (template)",
"settings.nas.project_folder_name_help": "Placeholders: {nr} (projectnummer) · {project_name} (projecttitel)."
```

EN-waarden: "Create project folders (NAS)", "Master folder (path)", "Folder copied as a template. Use a UNC path, e.g. \\\\DRIEBM-NAS\\3bm\\_TEMPLATES\\Projectmap.", "Target root (path)", "Folder where project folders are created, e.g. \\\\DRIEBM-NAS\\3bm\\Projecten.", "Folder name (template)", "Placeholders: {nr} (project number) · {project_name} (project title)."
DE-waarden: "Projektordner anlegen (NAS)", "Master-Ordner (Pfad)", "Ordner der als Vorlage kopiert wird. UNC-Pfad verwenden, z.B. \\\\DRIEBM-NAS\\3bm\\_TEMPLATES\\Projectmap.", "Ziel-Stammordner (Pfad)", "Ordner in dem die Projektordner angelegt werden, z.B. \\\\DRIEBM-NAS\\3bm\\Projecten.", "Ordnername (Vorlage)", "Platzhalter: {nr} (Projektnummer) · {project_name} (Projekttitel)."

- [ ] **Step 2: Sectie toevoegen aan NasSettingsSection**

In `NasSettingsSection.tsx`: importeer `loadProjectFoldersConfig, saveProjectFoldersConfig, hydrateProjectFoldersConfig, type NasProjectFoldersConfig` uit `../lib/nasConfig`. Voeg state + hydrate toe:

```tsx
const [pf, setPf] = useState<NasProjectFoldersConfig>(() => loadProjectFoldersConfig(instanceId));
useEffect(() => {
  let cancelled = false;
  hydrateProjectFoldersConfig().then(() => { if (!cancelled) setPf(loadProjectFoldersConfig(instanceId)); });
  return () => { cancelled = true; };
}, [instanceId]);
function savePf(next: NasProjectFoldersConfig) { setPf(next); saveProjectFoldersConfig(instanceId, next); }
```

Render-blok (onder de bestaande template-velden, vóór de Opslaan-knop):

```tsx
<div className="pt-3 border-t border-slate-100 space-y-3">
  <h4 className="text-sm font-semibold text-slate-600">
    {t("settings.nas.project_folders_title", { defaultValue: "Projectmappen aanmaken (NAS)" })}
  </h4>
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{t("settings.nas.project_master")}</label>
    <input type="text" value={pf.masterPath} onChange={(e) => savePf({ ...pf, masterPath: e.target.value })}
      placeholder="\\DRIEBM-NAS\3bm\_TEMPLATES\Projectmap"
      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400" />
    <p className="text-xs text-slate-400 mt-1">{t("settings.nas.project_master_help")}</p>
  </div>
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{t("settings.nas.project_target_root")}</label>
    <input type="text" value={pf.targetRoot} onChange={(e) => savePf({ ...pf, targetRoot: e.target.value })}
      placeholder="\\DRIEBM-NAS\3bm\Projecten"
      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400" />
    <p className="text-xs text-slate-400 mt-1">{t("settings.nas.project_target_root_help")}</p>
  </div>
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{t("settings.nas.project_folder_name")}</label>
    <input type="text" value={pf.folderTemplate} onChange={(e) => savePf({ ...pf, folderTemplate: e.target.value })}
      placeholder="{nr} {project_name}"
      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400" />
    <p className="text-xs text-slate-400 mt-1">{t("settings.nas.project_folder_name_help")}</p>
  </div>
</div>
```

- [ ] **Step 3: Typecheck + build**

Run: `cd packages/frontend && ./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build`
Expected: tsc exit 0, vite `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/NasSettingsSection.tsx packages/frontend/src/i18n/nl.json packages/frontend/src/i18n/en.json packages/frontend/src/i18n/de.json
git commit -m "feat(nas): instellingen voor projectmappen (master/doel/mapnaam)"
```

---

### Task 5: "Maak NAS-mappen aan"-knop op ProjectDetail (desktop-only)

**Files:**
- Modify: `packages/frontend/src/pages/Projects.tsx` (ProjectDetail-component, header rond regel 556-563)
- Modify: `packages/frontend/src/i18n/nl.json`, `en.json`, `de.json`

**Interfaces:**
- Consumes: `isDesktopApp` (Task 3), `loadProjectFoldersConfig`, `resolveTemplate`, `sanitizeForFilesystem` (nasConfig), `getActiveInstanceId`. `project` heeft `name`, `project_name`, `company`.

- [ ] **Step 1: i18n-keys toevoegen**

In `nl.json` (+ en/de):

```json
"projects.detail.create_nas_folders": "Maak NAS-mappen aan",
"projects.detail.nas_confirm": "Projectmappen aanmaken op:\n{{path}} ?",
"projects.detail.nas_not_configured": "Stel eerst de master-map en doel-root in (Instellingen → Project instellingen).",
"projects.detail.nas_done": "Projectmappen aangemaakt.",
"projects.detail.nas_exists": "Map bestaat al — niet overschreven.",
"projects.detail.nas_failed": "Aanmaken mislukt: {{error}}"
```

EN: "Create NAS folders", "Create project folders at:\n{{path}} ?", "First set the master folder and target root (Settings → Project settings).", "Project folders created.", "Folder already exists — not overwritten.", "Creation failed: {{error}}".
DE: "NAS-Ordner anlegen", "Projektordner anlegen unter:\n{{path}} ?", "Zuerst Master-Ordner und Ziel-Stammordner festlegen (Einstellungen → Projekteinstellungen).", "Projektordner angelegt.", "Ordner existiert bereits — nicht überschrieben.", "Anlegen fehlgeschlagen: {{error}}".

- [ ] **Step 2: Importeer helpers + voeg de handler toe**

Bovenaan `Projects.tsx` importeren:

```tsx
import { isDesktopApp } from "../lib/desktop";
import { loadProjectFoldersConfig, resolveTemplate, sanitizeForFilesystem } from "../lib/nasConfig";
import { getActiveInstanceId } from "../lib/instances";
```

(Laat bestaande imports staan; voeg alleen ontbrekende toe.) Binnen de `ProjectDetail`-component, een handler + state:

```tsx
const [creatingNas, setCreatingNas] = useState(false);
async function handleCreateNasFolders() {
  const instId = getActiveInstanceId();
  const cfg = loadProjectFoldersConfig(instId || "default");
  if (!cfg.masterPath || !cfg.targetRoot) {
    alert(t("projects.detail.nas_not_configured"));
    return;
  }
  const folderName = sanitizeForFilesystem(
    resolveTemplate(cfg.folderTemplate, { nr: project.name, project_name: project.project_name || "" }),
    120,
  );
  const sep = cfg.targetRoot.includes("/") ? "/" : "\\";
  const targetPath = `${cfg.targetRoot.replace(/[\\/]+$/, "")}${sep}${folderName}`;
  if (!window.confirm(t("projects.detail.nas_confirm", { path: targetPath }))) return;
  setCreatingNas(true);
  try {
    const res = await fetch("/api/nas/create-folders", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ masterPath: cfg.masterPath, targetPath }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      alert(t("projects.detail.nas_done"));
    } else if (String(data.error).includes("target_exists")) {
      alert(t("projects.detail.nas_exists"));
    } else {
      alert(t("projects.detail.nas_failed", { error: String(data.error || res.status) }));
    }
  } catch (e) {
    alert(t("projects.detail.nas_failed", { error: String(e) }));
  } finally {
    setCreatingNas(false);
  }
}
```

- [ ] **Step 3: Voeg de knop toe in de header**

In de ProjectDetail-header (naast de edit-`Pencil` rond regel 556-563), gegate op desktop:

```tsx
{isDesktopApp() && (
  <button
    onClick={handleCreateNasFolders}
    disabled={creatingNas}
    title={t("projects.detail.create_nas_folders")}
    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-100 rounded hover:bg-violet-200 disabled:opacity-40 cursor-pointer"
  >
    <FolderPlus size={14} /> {t("projects.detail.create_nas_folders")}
  </button>
)}
```

Importeer `FolderPlus` uit `lucide-react` bij de bestaande lucide-import (regel 12).

- [ ] **Step 4: Typecheck + build**

Run: `cd packages/frontend && ./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build`
Expected: tsc exit 0, vite `✓ built`. (De knop rendert niet in de web-build want `isDesktopApp()` is daar `false`.)

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/pages/Projects.tsx packages/frontend/src/i18n/nl.json packages/frontend/src/i18n/en.json packages/frontend/src/i18n/de.json
git commit -m "feat(nas): 'Maak NAS-mappen aan'-knop op ProjectDetail (desktop-only)"
```

---

### Task 6: Desktop-build + handmatige end-to-end verificatie

**Files:** geen — dit is verificatie op de werkende desktop-build.

- [ ] **Step 1: Bouw/draai de desktop-app**

Run (lokaal, vereist een werkende desktop-build — zie de losse desktop-rebuild-taak): `cd packages/desktop && npm run tauri dev` (of de projectspecifieke dev-command).
Expected: app start, vault unlock werkt.

- [ ] **Step 2: Configureer instellingen**

In de desktop-app: Settings → Project instellingen → vul Master-map (een bestaande test-map met submappen + bestanden), Doel-root (een test-NAS-pad), en mapnaam-template in. Sla op.

- [ ] **Step 3: Maak mappen aan**

Open een project → klik "Maak NAS-mappen aan" → bevestig → controleer in de verkenner dat onder de doel-root een map `{nr} {project_name}` staat met de volledige master-structuur (mappen + bestanden).

- [ ] **Step 4: Conflict-pad**

Klik nogmaals "Maak NAS-mappen aan" voor hetzelfde project → verwacht melding "Map bestaat al — niet overschreven"; controleer dat de bestaande map onaangeroerd is.

- [ ] **Step 5: Web-build check**

Open dezelfde ProjectDetail in de web-app → verwacht dat de knop NIET zichtbaar is.

---

## Self-Review

- **Spec coverage:** trigger=handmatige knop (Task 5) ✓; structuur=kopie master incl. bestanden (Task 1) ✓; desktop-native/geen Nextcloud/FSA (Task 1+2) ✓; instelbaar master/doel/template (Task 3+4) ✓; conflict=weigeren (Task 1 `target_exists`, Task 5 melding) ✓; mapnaam `{nr} {project_name}` (Task 5) ✓; web-build verbergt knop (Task 5 `isDesktopApp`) ✓; UNC-paden (Task 4 placeholders + Task 5 separator-detectie) ✓.
- **Placeholder scan:** geen TBD/TODO; alle stappen bevatten echte code en commando's.
- **Type consistency:** `create_project_folders(master_path, target_path)` (Rust snake_case) wordt vanuit de adapter aangeroepen met `{ masterPath, targetPath }` — Tauri's invoke mapt camelCase-args automatisch naar snake_case Rust-params; de adapter-body-velden heten `masterPath`/`targetPath` consistent met de frontend-fetch in Task 5. `NasProjectFoldersConfig`-velden (`masterPath`/`targetRoot`/`folderTemplate`) zijn identiek in Task 3, 4, 5.
