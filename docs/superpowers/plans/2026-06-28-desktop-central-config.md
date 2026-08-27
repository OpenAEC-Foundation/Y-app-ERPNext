# Desktop centrale-config-sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development of superpowers:executing-plans. Steps gebruiken checkbox (`- [ ]`).

**Goal:** De desktop-app haalt de niet-geheime werkgever-config van de Y-app-server (online), cachet die lokaal en leest altijd lokaal (offline), + resolvet mailconfig uit ERPNext (password-accounts).

**Architecture:** Optie A — Y-app-server blijft bron. Nieuw read-endpoint `GET /api/desktop-config` (ERPNext-sid-geverifieerd, URL-match). Desktop Rust-commando synct → lokale `instance_settings`-store; bestaande lees-paden ongewijzigd. Mailconfig via ERPNext Email Account.

**Tech Stack:** Express/TS (server), Tauri 2 / Rust + reqwest (desktop), React/TS (desktop-adapter). Spec: `docs/superpowers/specs/2026-06-28-desktop-central-config-design.md`.

## Global Constraints
- **Carve-out:** geen ERPNext-customization; config blijft op de Y-app-server.
- **Niet-geheim only:** gesynct worden alleen: `activity-types`, `employee-activity-types`, `employee-visible-modules`, `project-template-mapping`, `nas-attachment-template`, `nas-project-folders`, `enabled-extensions`. Géén credentials.
- **Offline:** fetch-fout/geen sessie → stil terugvallen op lokale cache. Nooit een harde UI-fout.
- **Rust lokaal niet compileerbaar** (geen MSVC build-tools op de dev-machine) → Rust-taken worden via een CI-release-build geverifieerd; TS-taken lokaal (`tsc -b` / `vite build` / server-build).
- **Y-app-server-URL** in de desktop: `https://y-app.impertio.app` (hardcoded, zoals `UpdateBanner`/`VERSION_URL`).
- Rust-commando's registreren in `packages/desktop/src-tauri/src/lib.rs` `generate_handler!`.

---

## Fase 1 — Config-sync (server + desktop)

### Task 1: Server-endpoint `GET /api/desktop-config`

**Files:**
- Modify: `packages/server/src/index.ts` (endpoint bij de andere settings-routes ~regel 505; whitelist ~regel 800)

**Interfaces:**
- Produces: `GET /api/desktop-config?erpnextUrl=<url>` met header `X-Erpnext-Sid: <sid>` → `200 { ok:true, config: { <key>: <value>, … } }` | `400` (params) | `401` (sid ongeldig) | `502` (ERPNext onbereikbaar).

- [ ] **Step 1: Endpoint toevoegen** (na het `/api/shared-settings/:key`-blok):

```ts
const DESKTOP_CONFIG_KEYS = [
  "activity-types", "employee-activity-types", "employee-visible-modules",
  "project-template-mapping", "nas-attachment-template", "nas-project-folders",
  "enabled-extensions",
];

// Desktop-config: niet-geheime werkgever-config per ERPNext-URL. Auth via de
// ERPNext-sessie van de desktop (geen Y-app-account). Whitelisted; eigen auth.
app.get("/api/desktop-config", async (req, res) => {
  const erpnextUrl = String(req.query.erpnextUrl || "").replace(/\/+$/, "");
  const sid = req.headers["x-erpnext-sid"] as string | undefined;
  if (!erpnextUrl || !sid) return res.status(400).json({ error: "missing_params" });
  try {
    const verify = await fetch(`${erpnextUrl}/api/method/frappe.auth.get_logged_user`, {
      headers: { Cookie: `sid=${sid}` }, signal: AbortSignal.timeout(10000),
    });
    const vd = await verify.json().catch(() => ({} as any));
    const loggedUser = (vd as { message?: string }).message;
    if (!verify.ok || !loggedUser || loggedUser === "Guest") {
      return res.status(401).json({ error: "invalid_erpnext_session" });
    }
  } catch {
    return res.status(502).json({ error: "erpnext_unreachable" });
  }
  const config: Record<string, unknown> = {};
  for (const key of DESKTOP_CONFIG_KEYS) {
    const row = db.prepare(`
      SELECT s.setting_value FROM instance_settings s
      JOIN instances i ON s.instance_id = i.id
      WHERE (i.url = ? OR i.url = ?) AND s.setting_key = ?
      ORDER BY s.updated_at DESC LIMIT 1
    `).get(erpnextUrl, erpnextUrl + "/", key) as { setting_value: string } | undefined;
    if (row) {
      try { config[key] = JSON.parse(row.setting_value); } catch { config[key] = row.setting_value; }
    }
  }
  res.json({ ok: true, config });
});
```

- [ ] **Step 2: Whitelisten** in de `app.use("/api", …)` auth-middleware (bij `req.path === "/health/ping"` / `"/app-version"`):

```ts
    req.path === "/desktop-config" ||
```

- [ ] **Step 3: Server bouwen**

Run: `cd packages/server && npm run build`
Expected: `[build-server] Done → dist/server.cjs`, exit 0.

- [ ] **Step 4: Endpoint-shape verifiëren (lokaal, zonder ERPNext)**

Run: `cd packages/server && node -e "const e=require('express')();" ` — n.v.t.; in plaats daarvan met de draaiende server: `curl -s "http://localhost:3500/api/desktop-config" -i | head -1`
Expected: `HTTP/1.1 400` (missing_params) — bewijst dat de route bestaat + whitelisted is (geen 401 missing_instance van de auth-middleware).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(server): GET /api/desktop-config (ERPNext-sid-geverifieerde URL-match config voor desktop)"
```

### Task 2: Desktop Rust — `sync_instance_config`

**Files:**
- Modify: `packages/desktop/src-tauri/src/commands.rs` (nieuw commando)
- Modify: `packages/desktop/src-tauri/src/lib.rs` (`generate_handler!`)

**Interfaces:**
- Consumes: `state.erpnext.get_session(instance_id, &base, &username, &password)` (erpnext.rs ~regel 136 → `Result<String,(…)>` = sid); `state.db.put_instance_setting(instance_id, &key, &value)` (commands.rs:285).
- Produces: `#[tauri::command] async fn sync_instance_config(state, instance_id: i64, instance_url: String, username: String, password: String) -> Result<u32, String>` (aantal weggeschreven keys).

- [ ] **Step 1: Commando toevoegen** (`commands.rs`):

```rust
const DESKTOP_CONFIG_KEYS: &[&str] = &[
    "activity-types", "employee-activity-types", "employee-visible-modules",
    "project-template-mapping", "nas-attachment-template", "nas-project-folders",
    "enabled-extensions",
];

/// Haalt de niet-geheime werkgever-config van de Y-app-server (geverifieerd via
/// de ERPNext-sessie) en schrijft 'm naar de lokale instance_settings-store.
/// Offline/fout → Err; de aanroeper negeert dat stil en gebruikt de lokale cache.
#[tauri::command]
pub async fn sync_instance_config(
    state: State<'_, AppState>,
    instance_id: i64,
    instance_url: String,
    username: String,
    password: String,
) -> Result<u32, String> {
    let base = instance_url.trim_end_matches('/').to_string();
    let sid = state
        .erpnext
        .get_session(instance_id, &base, &username, &password)
        .await
        .map_err(|(code, _)| code.to_string())?;
    let resp = reqwest::Client::new()
        .get("https://y-app.impertio.app/api/desktop-config")
        .query(&[("erpnextUrl", base.as_str())])
        .header("X-Erpnext-Sid", &sid)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("desktop-config HTTP {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut n = 0u32;
    if let Some(cfg) = body.get("config").and_then(|c| c.as_object()) {
        for (key, val) in cfg {
            if DESKTOP_CONFIG_KEYS.contains(&key.as_str()) {
                state.db.put_instance_setting(instance_id, key, &val.to_string());
                n += 1;
            }
        }
    }
    Ok(n)
}
```

> **Implementatie-noot:** bevestig de exacte signatuur/zichtbaarheid van `get_session` in `erpnext.rs` (regel ~136). Als die `pub(crate)` of een andere foutvorm heeft, pas het aanroep-/`map_err`-patroon aan. `reqwest` + `serde_json` zijn al deps (gebruikt in `erpnext.rs`/`mail.rs`).

- [ ] **Step 2: Registreren** in `lib.rs` `generate_handler![ … ]` (bij de andere `commands::`):

```rust
            commands::sync_instance_config,
```

- [ ] **Step 3: Compileren — via CI** (lokaal geen MSVC). Markeer; de feitelijke `cargo`-compile gebeurt in de release-build (Task 5 van de uitlevering). Lokaal wel: `cd packages/desktop/src-tauri && cargo check 2>&1 | head` *als* er een Rust-toolchain met linker beschikbaar is; anders overslaan en op CI vertrouwen.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/commands.rs packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): sync_instance_config — pull niet-geheime config van Y-app-server"
```

### Task 3: Desktop frontend — sync triggeren

**Files:**
- Modify: `packages/desktop/src/DesktopApp.tsx` (instance-load-effect, ~regel 438 waar `/api/auth/me` wordt gefetcht)

**Interfaces:**
- Consumes: `invoke("sync_instance_config", { instanceId, instanceUrl, username, password })` (Task 2). Creds: de actieve tab/instance + vault-creds (zoals elders in DesktopApp gebruikt voor instance-context).

- [ ] **Step 1: Sync aanroepen bij instance-load** (in hetzelfde effect dat `/api/auth/me` doet, ná het ophalen van de instance + creds — online best-effort):

```tsx
// Niet-geheime werkgever-config van de server pullen naar de lokale cache.
// Best-effort: faalt 'ie (offline / geen sessie) → stil; de lokale cache blijft leidend.
import { invoke } from "@tauri-apps/api/core"; // (indien nog niet geïmporteerd)
// …binnen het instance-effect:
invoke("sync_instance_config", {
  instanceId: activeTab.id,
  instanceUrl: activeTab.url,
  username: creds.erpnext_username,
  password: creds.erpnext_password,
}).then(() => {
  // settings veranderden mogelijk → laat afhankelijke views herladen
  window.dispatchEvent(new Event("y-app:settings-synced"));
}).catch(() => { /* offline / geen sessie → lokale cache gebruiken */ });
```

> **Implementatie-noot:** gebruik dezelfde bron voor `activeTab.url` + vault-`creds` als het bestaande `/api/auth/me`/instance-context-effect (bevestig de variabelennamen ter plaatse). Als de Settings/Sidebar al op mount uit de lokale store lezen, is het `y-app:settings-synced`-event optioneel; voeg een listener toe waar een live-refresh gewenst is (anders zichtbaar na volgende navigatie).

- [ ] **Step 2: Desktop frontend bouwen**

Run: `cd packages/desktop && npx vite build`
Expected: `✓ built`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src/DesktopApp.tsx
git commit -m "feat(desktop): trigger config-sync bij instance-load (best-effort, offline-safe)"
```

---

## Fase 2 — Mailconfig uit ERPNext (password-accounts)

### Task 4: Desktop — mailconfig resolven uit ERPNext Email Account

**Files:**
- Modify: `packages/desktop/src-tauri/src/mail.rs` (creds-resolutie) of `packages/desktop/src/adapter/fetch.ts` (`/api/mail/config`-pad), afhankelijk van waar de desktop mailcreds nu bepaalt.

**Interfaces:**
- Consumes: ERPNext via `state.erpnext` (request met sid). Email Account-doctype: `GET /api/resource/Email Account?filters=[["email_id","=","<email>"]]&fields=["email_server","incoming_port","use_ssl","connected_app"]` + wachtwoord via `frappe.client.get_password` (zoals web `mailAutoConfigInternal`).

- [ ] **Step 1: Exploreer eerst** hoe de desktop nu mailcreds bepaalt (adapter `/api/mail/config` POST + `desktopMailCreds`-map, en `mail.rs`). Bepaal het inhaakpunt: wanneer er geen lokale config is voor een adres → resolve uit ERPNext.

- [ ] **Step 2: ERPNext-resolve toevoegen** (alleen `connected_app` leeg = password-account; anders overslaan): lees `email_server`/`incoming_port`/`use_ssl` uit de Email Account + wachtwoord via `frappe.client.get_password` (doctype `Email Account`, fieldname `password`, name = de Email Account-naam). Map naar de bestaande mailcreds-structuur. Bevestig de exacte web-aanroep in `server/src/mail.ts` `mailAutoConfigInternal` en spiegel die.

- [ ] **Step 3: Compileren via CI** (geen lokale MSVC), zoals Task 2.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/mail.rs packages/desktop/src/adapter/fetch.ts
git commit -m "feat(desktop): mailconfig resolven uit ERPNext Email Account (password-accounts)"
```

---

## Uitlevering (CI-verificatie van de Rust-delen)
- [ ] Versie bumpen (4 manifests) → v0.28.2, CHANGELOG + ReleaseNotes, commit, push, `release.yml` draaien. **Dit is de eerste echte compile/verificatie van Task 2 + 4** (Rust op de CI-runners).
- [ ] End-to-end op de desktop-build: werkgever ziet medewerker-/project-instellingen + alle modules; netwerk uit → blijft werken (offline cache); password-mailaccount uit ERPNext werkt zonder handmatige invoer.

## Self-Review
- **Spec-dekking:** component 1 (server-endpoint) → Task 1; component 2 (desktop-sync + lokale cache) → Task 2+3; component 3 (mailconfig ERPNext) → Task 4. Synced-keys-lijst = identiek aan de spec. Offline-gedrag (best-effort + lokale cache) → Task 3 Step 1 + Task 2 Err-pad. ✅
- **Placeholders:** Task 1 + 3 hebben volledige code; Task 2 volledige Rust; Task 4 is bewust explorerend (de huidige desktop-mailcreds-flow is nog niet uitgediept) → eerste step is exploratie, daarna spiegelen van `mailAutoConfigInternal`. Dit is het enige niet-volledig-uitgeschreven deel; reden expliciet vermeld.
- **Type-consistentie:** `DESKTOP_CONFIG_KEYS` identiek in Task 1 (TS) en Task 2 (Rust); commandonaam `sync_instance_config` + params (`instance_id`/`instance_url`/`username`/`password`) consistent tussen Task 2 (Rust) en Task 3 (invoke camelCase `instanceId`/`instanceUrl`/… → Tauri mapt naar snake_case).
- **Constraint:** Rust niet lokaal compileerbaar → expliciet in Global Constraints + per Rust-taak; CI is de verificatie.
