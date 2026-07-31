# Desktop Direct Rust — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Node sidecar with in-process Rust Tauri commands. Frontend calls `invoke()` → Rust `reqwest` → ERPNext directly.

**Architecture:** The fetch interceptor routes `/api/*` calls through Tauri `invoke("erpnext_request")` instead of HTTP to a localhost sidecar. Rust manages ERPNext sessions, SQLite, and credentials. No Node.js runtime, no second process.

**Tech Stack:** Rust (reqwest, rusqlite, dashmap, serde), TypeScript (Tauri invoke API), existing React frontend unchanged.

**Spec:** `docs/superpowers/specs/2026-04-13-desktop-direct-rust-design.md`

---

## File Structure

### New files to create

```
packages/desktop/src-tauri/src/
  erpnext.rs          # ERPNext HTTP proxy command + session cache
  database.rs         # rusqlite init, schema, CRUD helpers
```

### Files to rewrite

```
packages/desktop/src-tauri/src/
  lib.rs              # Remove sidecar spawn, register new commands
  commands.rs         # Replace VaultState with AppState, add instance/settings/meetings commands
  Cargo.toml          # Add reqwest, rusqlite, dashmap; remove portpicker

packages/desktop/src/
  adapter/fetch.ts    # Route /api/* through invoke() instead of localhost HTTP
  DesktopApp.tsx      # Remove sidecar port/sync, simplify init
```

### Files to delete

```
packages/desktop-server/          # Entire package (14 files)
```

### Files to modify

```
packages/desktop/src-tauri/src/main.rs    # No changes needed (already just calls lib::run)
packages/desktop/package.json             # Remove sidecar-related scripts if any
.github/workflows/release.yml            # Remove desktop-server install/build steps
package.json (root)                       # Remove desktop-server scripts
```

---

### Task 1: Add Rust dependencies

**Files:**
- Modify: `packages/desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Update Cargo.toml**

Replace the `[dependencies]` section:

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tauri-plugin-stronghold = "2"
tauri-plugin-deep-link = "2"
tauri-plugin-notification = "2"
reqwest = { version = "0.12", features = ["cookies", "json", "rustls-tls"], default-features = false }
rusqlite = { version = "0.32", features = ["bundled"] }
dashmap = "6"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["sync"] }
```

Remove `portpicker = "0.1"` (no longer needed).

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: Compiles (new deps downloaded, existing code still works).

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/Cargo.toml
git commit -m "feat(desktop): add reqwest, rusqlite, dashmap for direct Rust architecture"
```

---

### Task 2: Create database.rs — SQLite with rusqlite

**Files:**
- Create: `packages/desktop/src-tauri/src/database.rs`

- [ ] **Step 1: Create database.rs**

```rust
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Instance {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub theme_color: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Meeting {
    pub id: String,
    pub data: String,
    pub created_at: String,
    pub updated_at: String,
}

impl Database {
    pub fn new(data_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&data_dir).ok();
        let db_path = data_dir.join("desktop.db");
        let conn = Connection::open(db_path).expect("failed to open SQLite database");

        conn.execute_batch("
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS instances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                theme_color TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS instance_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
                setting_key TEXT NOT NULL,
                setting_value TEXT,
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(instance_id, setting_key)
            );

            CREATE TABLE IF NOT EXISTS preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS meetings (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
        ").expect("failed to initialize database schema");

        Self { conn: Mutex::new(conn) }
    }

    // ── Instances ──

    pub fn list_instances(&self) -> Vec<Instance> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, url, theme_color, created_at FROM instances ORDER BY created_at"
        ).unwrap();
        stmt.query_map([], |row| {
            Ok(Instance {
                id: row.get(0)?,
                name: row.get(1)?,
                url: row.get(2)?,
                theme_color: row.get(3)?,
                created_at: row.get(4)?,
            })
        }).unwrap().filter_map(|r| r.ok()).collect()
    }

    pub fn add_instance(&self, name: &str, url: &str, theme_color: Option<&str>) -> Instance {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO instances (name, url, theme_color) VALUES (?1, ?2, ?3)",
            params![name, url, theme_color],
        ).unwrap();
        let id = conn.last_insert_rowid();
        let created_at: String = conn.query_row(
            "SELECT created_at FROM instances WHERE id = ?1", params![id], |row| row.get(0)
        ).unwrap();
        Instance { id, name: name.to_string(), url: url.to_string(), theme_color: theme_color.map(String::from), created_at }
    }

    pub fn update_instance(&self, id: i64, name: Option<&str>, url: Option<&str>, theme_color: Option<&str>) -> Option<Instance> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE instances SET name = COALESCE(?1, name), url = COALESCE(?2, url), theme_color = COALESCE(?3, theme_color) WHERE id = ?4",
            params![name, url, theme_color, id],
        ).unwrap();
        conn.query_row(
            "SELECT id, name, url, theme_color, created_at FROM instances WHERE id = ?1",
            params![id],
            |row| Ok(Instance { id: row.get(0)?, name: row.get(1)?, url: row.get(2)?, theme_color: row.get(3)?, created_at: row.get(4)? }),
        ).ok()
    }

    pub fn delete_instance(&self, id: i64) {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM instances WHERE id = ?1", params![id]).unwrap();
    }

    pub fn get_instance_url(&self, id: i64) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT url FROM instances WHERE id = ?1", params![id], |row| row.get(0)).ok()
    }

    // ── Settings ──

    pub fn get_instance_settings(&self, instance_id: i64) -> std::collections::HashMap<String, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT setting_key, setting_value FROM instance_settings WHERE instance_id = ?1"
        ).unwrap();
        let mut map = std::collections::HashMap::new();
        for row in stmt.query_map(params![instance_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).unwrap().filter_map(|r| r.ok()) {
            map.insert(row.0, row.1);
        }
        map
    }

    pub fn put_instance_setting(&self, instance_id: i64, key: &str, value: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO instance_settings (instance_id, setting_key, setting_value, updated_at) VALUES (?1, ?2, ?3, datetime('now')) ON CONFLICT(instance_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at",
            params![instance_id, key, value],
        ).unwrap();
    }

    pub fn get_user_setting(&self, key: &str) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT setting_value FROM instance_settings WHERE setting_key = ?1 LIMIT 1",
            params![key], |row| row.get(0)
        ).ok()
    }

    // ── Preferences ──

    pub fn get_preference(&self, key: &str) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT value FROM preferences WHERE key = ?1", params![key], |row| row.get(0)).ok()
    }

    pub fn set_preference(&self, key: &str, value: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute("INSERT OR REPLACE INTO preferences (key, value) VALUES (?1, ?2)", params![key, value]).unwrap();
    }

    pub fn delete_preference(&self, key: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM preferences WHERE key = ?1", params![key]).unwrap();
    }

    pub fn all_preferences(&self) -> std::collections::HashMap<String, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM preferences").unwrap();
        let mut map = std::collections::HashMap::new();
        for row in stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).unwrap().filter_map(|r| r.ok()) {
            map.insert(row.0, row.1);
        }
        map
    }

    // ── Meetings ──

    pub fn list_meetings(&self) -> Vec<Meeting> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, data, created_at, updated_at FROM meetings ORDER BY updated_at DESC").unwrap();
        stmt.query_map([], |row| Ok(Meeting {
            id: row.get(0)?, data: row.get(1)?, created_at: row.get(2)?, updated_at: row.get(3)?,
        })).unwrap().filter_map(|r| r.ok()).collect()
    }

    pub fn save_meeting(&self, id: &str, data: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO meetings (id, data) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')",
            params![id, data],
        ).unwrap();
    }

    pub fn delete_meeting(&self, id: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM meetings WHERE id = ?1", params![id]).unwrap();
    }
}
```

- [ ] **Step 2: Verify it compiles**

Add `pub mod database;` temporarily to lib.rs and run `cargo check`.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/database.rs
git commit -m "feat(desktop): rusqlite database module — instances, settings, preferences, meetings"
```

---

### Task 3: Create erpnext.rs — HTTP proxy with session cache

**Files:**
- Create: `packages/desktop/src-tauri/src/erpnext.rs`

- [ ] **Step 1: Create erpnext.rs**

```rust
use dashmap::DashMap;
use reqwest::{Client, Method, header};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};

const SESSION_TTL: Duration = Duration::from_secs(4 * 60 * 60); // 4 hours

#[derive(Clone)]
struct CachedSession {
    sid: String,
    created: Instant,
}

pub struct ErpNextClient {
    http: Client,
    sessions: DashMap<u32, CachedSession>,
}

#[derive(Serialize, Deserialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub body: String,
    pub headers: std::collections::HashMap<String, String>,
}

#[derive(Serialize, Deserialize)]
pub struct TestResult {
    pub ok: bool,
    pub full_name: Option<String>,
    pub roles: Option<Vec<String>>,
    pub error: Option<String>,
}

impl ErpNextClient {
    pub fn new() -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("failed to create HTTP client");
        Self { http, sessions: DashMap::new() }
    }

    async fn login(&self, url: &str, username: &str, password: &str) -> Result<String, String> {
        let res = self.http
            .post(format!("{}/api/method/login", url))
            .json(&serde_json::json!({ "usr": username, "pwd": password }))
            .send()
            .await
            .map_err(|e| format!("Login request failed: {}", e))?;

        if !res.status().is_success() {
            return Err("Login failed".to_string());
        }

        // Extract sid from Set-Cookie header
        let cookies = res.headers().get_all(header::SET_COOKIE);
        for cookie in cookies {
            if let Ok(val) = cookie.to_str() {
                if let Some(sid_start) = val.find("sid=") {
                    let sid = &val[sid_start + 4..];
                    let sid = sid.split(';').next().unwrap_or(sid);
                    if sid != "Guest" {
                        return Ok(sid.to_string());
                    }
                }
            }
        }
        Err("No session cookie received".to_string())
    }

    async fn get_session(
        &self,
        instance_id: u32,
        url: &str,
        username: &str,
        password: &str,
    ) -> Result<String, String> {
        // Check cache
        if let Some(cached) = self.sessions.get(&instance_id) {
            if cached.created.elapsed() < SESSION_TTL {
                return Ok(cached.sid.clone());
            }
        }
        // Login and cache
        let sid = self.login(url, username, password).await?;
        self.sessions.insert(instance_id, CachedSession {
            sid: sid.clone(),
            created: Instant::now(),
        });
        Ok(sid)
    }

    pub fn invalidate_session(&self, instance_id: u32) {
        self.sessions.remove(&instance_id);
    }

    pub async fn proxy_request(
        &self,
        instance_id: u32,
        base_url: &str,
        username: &str,
        password: &str,
        method: &str,
        path: &str,
        body: Option<&str>,
    ) -> Result<ProxyResponse, String> {
        let sid = self.get_session(instance_id, base_url, username, password).await?;

        let full_url = format!("{}{}", base_url, path);
        let http_method = method.parse::<Method>().unwrap_or(Method::GET);

        let mut req = self.http.request(http_method.clone(), &full_url)
            .header(header::COOKIE, format!("sid={}", sid));

        if let Some(b) = body {
            req = req
                .header(header::CONTENT_TYPE, "application/json")
                .body(b.to_string());
        }

        let res = req.send().await.map_err(|e| format!("Request failed: {}", e))?;

        // On 401/403, retry once with fresh session
        if res.status().as_u16() == 401 || res.status().as_u16() == 403 {
            self.sessions.remove(&instance_id);
            let new_sid = self.get_session(instance_id, base_url, username, password).await?;

            let mut retry = self.http.request(http_method, &full_url)
                .header(header::COOKIE, format!("sid={}", new_sid));
            if let Some(b) = body {
                retry = retry
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(b.to_string());
            }
            let retry_res = retry.send().await.map_err(|e| format!("Retry failed: {}", e))?;
            let status = retry_res.status().as_u16();
            let resp_headers = extract_headers(&retry_res);
            let resp_body = retry_res.text().await.unwrap_or_default();
            return Ok(ProxyResponse { status, body: resp_body, headers: resp_headers });
        }

        let status = res.status().as_u16();
        let resp_headers = extract_headers(&res);
        let resp_body = res.text().await.unwrap_or_default();
        Ok(ProxyResponse { status, body: resp_body, headers: resp_headers })
    }

    pub async fn test_connection(
        &self,
        url: &str,
        username: &str,
        password: &str,
    ) -> TestResult {
        match self.login(url, username, password).await {
            Err(e) => TestResult { ok: false, full_name: None, roles: None, error: Some(e) },
            Ok(sid) => {
                // Fetch user info
                let user_url = format!("{}/api/resource/User/{}?fields=[\"full_name\",\"roles\"]", url, urlencoding::encode(username));
                let res = self.http.get(&user_url)
                    .header(header::COOKIE, format!("sid={}", sid))
                    .send().await;
                match res {
                    Err(e) => TestResult { ok: true, full_name: Some(username.to_string()), roles: Some(vec![]), error: None },
                    Ok(r) => {
                        let data: serde_json::Value = r.json().await.unwrap_or_default();
                        let full_name = data["data"]["full_name"].as_str().map(String::from).unwrap_or_else(|| username.to_string());
                        let roles: Vec<String> = data["data"]["roles"].as_array()
                            .map(|arr| arr.iter().filter_map(|r| r["role"].as_str().map(String::from)).collect())
                            .unwrap_or_default();
                        TestResult { ok: true, full_name: Some(full_name), roles: Some(roles), error: None }
                    }
                }
            }
        }
    }
}

fn extract_headers(res: &reqwest::Response) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    if let Some(ct) = res.headers().get(header::CONTENT_TYPE) {
        if let Ok(v) = ct.to_str() {
            map.insert("content-type".to_string(), v.to_string());
        }
    }
    map
}
```

- [ ] **Step 2: Add `urlencoding` crate to Cargo.toml**

```toml
urlencoding = "2"
```

- [ ] **Step 3: Verify it compiles**

Add `pub mod erpnext;` temporarily to lib.rs and run `cargo check`.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/erpnext.rs packages/desktop/src-tauri/Cargo.toml
git commit -m "feat(desktop): reqwest ERPNext proxy with session cache"
```

---

### Task 4: Rewrite commands.rs — all Tauri commands

**Files:**
- Modify: `packages/desktop/src-tauri/src/commands.rs`

- [ ] **Step 1: Rewrite commands.rs**

```rust
use crate::database::Database;
use crate::erpnext::{ErpNextClient, ProxyResponse, TestResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Manager, State};

pub struct AppState {
    pub db: Database,
    pub erpnext: ErpNextClient,
}

// ── Vault ──

#[tauri::command]
pub fn vault_exists(app: tauri::AppHandle) -> bool {
    let dir = app.path().app_data_dir().expect("app data dir");
    dir.join("vault.hold").exists()
}

// ── ERPNext Proxy ──

#[tauri::command]
pub async fn erpnext_request(
    state: State<'_, AppState>,
    instance_id: u32,
    method: String,
    path: String,
    body: Option<String>,
) -> Result<ProxyResponse, String> {
    // Get instance URL from database
    let url = state.db.get_instance_url(instance_id as i64)
        .ok_or_else(|| "Instance not found".to_string())?;

    // Get credentials from Stronghold — passed from frontend via invoke args
    // For now, credentials come from the frontend (vault.ts getAllCredentials)
    // The frontend passes them with each request via the fetch adapter
    Err("Credentials must be provided by frontend — see erpnext_request_with_creds".to_string())
}

#[tauri::command]
pub async fn erpnext_request_with_creds(
    state: State<'_, AppState>,
    instance_id: u32,
    instance_url: String,
    username: String,
    password: String,
    method: String,
    path: String,
    body: Option<String>,
) -> Result<ProxyResponse, String> {
    state.erpnext.proxy_request(
        instance_id,
        &instance_url,
        &username,
        &password,
        &method,
        &path,
        body.as_deref(),
    ).await
}

// ── Instances ──

#[derive(Serialize)]
pub struct InstancesResponse {
    pub instances: Vec<crate::database::Instance>,
}

#[tauri::command]
pub fn list_instances(state: State<'_, AppState>) -> InstancesResponse {
    InstancesResponse { instances: state.db.list_instances() }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddInstanceInput {
    pub name: String,
    pub url: String,
    pub theme_color: Option<String>,
    pub erpnext_username: Option<String>,
    pub erpnext_password: Option<String>,
}

#[derive(Serialize)]
pub struct AddInstanceResponse {
    pub ok: bool,
    pub instance: crate::database::Instance,
}

#[tauri::command]
pub fn add_instance(state: State<'_, AppState>, input: AddInstanceInput) -> AddInstanceResponse {
    let inst = state.db.add_instance(&input.name, &input.url, input.theme_color.as_deref());
    AddInstanceResponse { ok: true, instance: inst }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInstanceInput {
    pub name: Option<String>,
    pub url: Option<String>,
    pub theme_color: Option<String>,
}

#[tauri::command]
pub fn update_instance(state: State<'_, AppState>, id: i64, input: UpdateInstanceInput) -> serde_json::Value {
    match state.db.update_instance(id, input.name.as_deref(), input.url.as_deref(), input.theme_color.as_deref()) {
        Some(inst) => serde_json::json!({ "ok": true, "instance": inst }),
        None => serde_json::json!({ "ok": true }),
    }
}

#[tauri::command]
pub fn delete_instance(state: State<'_, AppState>, id: i64) {
    state.erpnext.invalidate_session(id as u32);
    state.db.delete_instance(id);
}

#[tauri::command]
pub async fn test_instance(
    state: State<'_, AppState>,
    url: String,
    username: String,
    password: String,
) -> Result<TestResult, String> {
    Ok(state.erpnext.test_connection(&url, &username, &password).await)
}

// ── Settings ──

#[tauri::command]
pub fn get_instance_settings(state: State<'_, AppState>, id: i64) -> HashMap<String, String> {
    state.db.get_instance_settings(id)
}

#[tauri::command]
pub fn put_instance_setting(state: State<'_, AppState>, id: i64, key: String, value: String) {
    state.db.put_instance_setting(id, &key, &value);
}

#[tauri::command]
pub fn get_user_setting(state: State<'_, AppState>, key: String) -> Option<String> {
    state.db.get_user_setting(&key)
}

// ── Preferences ──

#[tauri::command]
pub fn get_all_preferences(state: State<'_, AppState>) -> HashMap<String, String> {
    state.db.all_preferences()
}

#[tauri::command]
pub fn set_preference(state: State<'_, AppState>, key: String, value: String) {
    state.db.set_preference(&key, &value);
}

#[tauri::command]
pub fn delete_preference(state: State<'_, AppState>, key: String) {
    state.db.delete_preference(&key);
}

// ── Meetings ──

#[tauri::command]
pub fn list_meetings(state: State<'_, AppState>) -> Vec<crate::database::Meeting> {
    state.db.list_meetings()
}

#[tauri::command]
pub fn save_meeting(state: State<'_, AppState>, id: String, data: String) {
    state.db.save_meeting(&id, &data);
}

#[tauri::command]
pub fn delete_meeting(state: State<'_, AppState>, id: String) {
    state.db.delete_meeting(&id);
}

// ── Y-app session stubs (desktop = always logged in) ──

#[tauri::command]
pub fn yapp_me() -> serde_json::Value {
    serde_json::json!({ "id": 1, "email": "desktop-user@local" })
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/desktop/src-tauri/src/commands.rs
git commit -m "feat(desktop): all Tauri commands — erpnext proxy, instances, settings, meetings"
```

---

### Task 5: Rewrite lib.rs — remove sidecar, register commands

**Files:**
- Modify: `packages/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Rewrite lib.rs**

Remove all sidecar spawn logic. Register the new commands. Initialize AppState with Database and ErpNextClient.

```rust
pub mod commands;
pub mod database;
pub mod erpnext;

use commands::AppState;
use tauri::Manager;

#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
#[cfg(desktop)]
use tauri::menu::{MenuBuilder, MenuEvent, MenuItemBuilder};
#[cfg(all(desktop, not(target_os = "linux")))]
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::vault_exists,
            commands::erpnext_request_with_creds,
            commands::list_instances,
            commands::add_instance,
            commands::update_instance,
            commands::delete_instance,
            commands::test_instance,
            commands::get_instance_settings,
            commands::put_instance_setting,
            commands::get_user_setting,
            commands::get_all_preferences,
            commands::set_preference,
            commands::delete_preference,
            commands::list_meetings,
            commands::save_meeting,
            commands::delete_meeting,
            commands::yapp_me,
        ]);

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_deep_link::init());
    }

    builder
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize Stronghold
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("stronghold-salt.txt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())
                .expect("failed to initialize stronghold plugin");

            // Initialize AppState with database and HTTP client
            let data_dir = app.path().app_data_dir().expect("app data dir");
            let state = AppState {
                db: database::Database::new(data_dir),
                erpnext: erpnext::ErpNextClient::new(),
            };
            app.manage(state);

            // OAuth deep links (desktop only)
            #[cfg(all(desktop, not(target_os = "linux")))]
            {
                use tauri::Emitter;
                let handle_for_deeplink = handle.clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        let url_str = url.to_string();
                        if url_str.starts_with("y-app://oauth/callback") {
                            let _ = handle_for_deeplink.emit("oauth-callback", url_str);
                        }
                    }
                });
            }

            // System tray (desktop only)
            #[cfg(desktop)]
            {
                let quit = MenuItemBuilder::with_id("quit", "Quit Y-app").build(app)?;
                let show = MenuItemBuilder::with_id("show", "Open Y-app").build(app)?;
                let tray_menu = MenuBuilder::new(app)
                    .item(&show)
                    .separator()
                    .item(&quit)
                    .build()?;

                let _tray = TrayIconBuilder::new()
                    .menu(&tray_menu)
                    .tooltip("Y-app Desktop")
                    .on_menu_event(move |app: &tauri::AppHandle, event: MenuEvent| {
                        match event.id().as_ref() {
                            "quit" => app.exit(0),
                            "show" => {
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray: &TrayIcon, event: TrayIconEvent| {
                        if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                            if let Some(w) = tray.app_handle().get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Y-app Desktop");
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/desktop/src-tauri && cargo check`

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): remove sidecar, register direct Rust commands"
```

---

### Task 6: Rewrite adapter/fetch.ts — invoke instead of HTTP

**Files:**
- Modify: `packages/desktop/src/adapter/fetch.ts`

- [ ] **Step 1: Rewrite fetch.ts**

```typescript
import { invoke } from "@tauri-apps/api/core";
import { getActiveInstance } from "@frontend/lib/instances";
import { getAllCredentials, type InstanceCredentials } from "./vault";

let interceptorInstalled = false;
let credentialCache: InstanceCredentials[] = [];

/** Call after vault unlock to load credentials into memory */
export async function loadCredentialCache() {
  credentialCache = await getAllCredentials();
}

function getCredsForInstance(id: number): InstanceCredentials | undefined {
  return credentialCache.find((c) => c.instance_id === id);
}

/**
 * Installs a fetch interceptor that routes /api/* through Tauri invoke()
 * instead of HTTP. The Rust backend handles ERPNext requests directly.
 */
export function installDesktopFetchInterceptor() {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  const originalFetch = window.fetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.toString();
    else url = input.url;

    // Only intercept /api/* requests
    if (!url.startsWith("/api/")) {
      return originalFetch.call(window, input, init);
    }

    const method = init?.method || "GET";
    const body = init?.body ? String(init.body) : null;

    // Get active instance
    const activeInst = getActiveInstance();
    const instanceId = activeInst ? parseInt(activeInst.id, 10) : 0;

    // ── Routes handled locally by Rust commands ──

    // Y-app session (always logged in on desktop)
    if (url === "/api/yapp/me") {
      const data = await invoke("yapp_me");
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    // Instance CRUD
    if (url === "/api/instances" && method === "GET") {
      const data = await invoke("list_instances");
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "/api/instances" && method === "POST") {
      const data = await invoke("add_instance", { input: body ? JSON.parse(body) : {} });
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.match(/^\/api\/instances\/(\d+)$/) && method === "PUT") {
      const id = parseInt(url.split("/")[3], 10);
      const data = await invoke("update_instance", { id, input: body ? JSON.parse(body) : {} });
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.match(/^\/api\/instances\/(\d+)$/) && method === "DELETE") {
      const id = parseInt(url.split("/")[3], 10);
      await invoke("delete_instance", { id });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "/api/instances/test" && method === "POST") {
      const parsed = body ? JSON.parse(body) : {};
      const data = await invoke("test_instance", {
        url: parsed.url,
        username: parsed.erpnextUsername || parsed.username,
        password: parsed.erpnextPassword || parsed.password,
      });
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    }

    // Instance settings
    const settingsMatch = url.match(/^\/api\/instances\/(\d+)\/settings(?:\/(.+))?$/);
    if (settingsMatch) {
      const id = parseInt(settingsMatch[1], 10);
      const key = settingsMatch[2];
      if (method === "GET" && !key) {
        const data = await invoke("get_instance_settings", { id });
        return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "GET" && key) {
        const all = await invoke<Record<string, string>>("get_instance_settings", { id });
        const val = all[key];
        return new Response(JSON.stringify(val ? JSON.parse(val) : null), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "PUT" && key) {
        const parsed = body ? JSON.parse(body) : {};
        await invoke("put_instance_setting", { id, key, value: JSON.stringify(parsed.value ?? parsed) });
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
    }

    // User settings
    const userSettingsMatch = url.match(/^\/api\/user-settings\/(.+)$/);
    if (userSettingsMatch) {
      const data = await invoke<string | null>("get_user_setting", { key: userSettingsMatch[1] });
      return new Response(JSON.stringify(data ? JSON.parse(data) : null), { status: 200, headers: { "content-type": "application/json" } });
    }

    // Preferences
    if (url === "/api/desktop/preferences" && method === "GET") {
      const data = await invoke("get_all_preferences");
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "/api/desktop/preferences" && method === "POST") {
      const parsed = body ? JSON.parse(body) : {};
      await invoke("set_preference", { key: parsed.key, value: parsed.value });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // Meetings
    if (url === "/api/meetings" && method === "GET") {
      const data = await invoke<any[]>("list_meetings");
      return new Response(JSON.stringify(data.map((m: any) => JSON.parse(m.data))), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "/api/meetings" && method === "POST") {
      const parsed = body ? JSON.parse(body) : {};
      const id = parsed.id || crypto.randomUUID();
      await invoke("save_meeting", { id, data: body });
      return new Response(JSON.stringify({ ...parsed, id }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.match(/^\/api\/meetings\//) && method === "PUT") {
      const id = url.split("/")[3];
      await invoke("save_meeting", { id, data: body });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.match(/^\/api\/meetings\//) && method === "DELETE") {
      const id = url.split("/")[3];
      await invoke("delete_meeting", { id });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // Services stub (no external services in desktop mode)
    if (url === "/api/services") {
      return new Response(JSON.stringify({ nextcloud: null, telegram: null, mailHost: null }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // Status
    if (url === "/api/status") {
      return new Response(JSON.stringify({ mode: "desktop-rust", version: "0.6.0" }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // Health ping
    if (url === "/api/health/ping") {
      return new Response(JSON.stringify({ ok: true, timestamp: Date.now() }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // ── ERPNext proxy (everything else) ──

    if (!instanceId) {
      return new Response(JSON.stringify({ error: "No active instance" }), { status: 400, headers: { "content-type": "application/json" } });
    }

    const creds = getCredsForInstance(instanceId);
    if (!creds) {
      return new Response(JSON.stringify({ error: "No credentials for instance" }), { status: 401, headers: { "content-type": "application/json" } });
    }

    // Get instance URL from the credential or fetch from DB
    const instanceUrl = (await invoke<{ instances: any[] }>("list_instances"))
      .instances.find((i: any) => i.id === instanceId)?.url;

    if (!instanceUrl) {
      return new Response(JSON.stringify({ error: "Instance URL not found" }), { status: 404, headers: { "content-type": "application/json" } });
    }

    try {
      const result = await invoke<{ status: number; body: string; headers: Record<string, string> }>(
        "erpnext_request_with_creds",
        {
          instanceId,
          instanceUrl,
          username: creds.erpnext_username,
          password: creds.erpnext_password,
          method,
          path: url,
          body,
        },
      );
      return new Response(result.body, {
        status: result.status,
        headers: result.headers,
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: { "content-type": "application/json" } });
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/desktop/src/adapter/fetch.ts
git commit -m "feat(desktop): fetch interceptor routes through Tauri invoke instead of HTTP"
```

---

### Task 7: Simplify DesktopApp.tsx — remove sidecar references

**Files:**
- Modify: `packages/desktop/src/DesktopApp.tsx`

- [ ] **Step 1: Remove sidecar-related code**

In `DesktopApp.tsx`, make these changes:

1. Remove import of `setSidecarPort` from `adapter/fetch`
2. Remove `invoke("get_sidecar_port")` call
3. Remove `waitForSidecar()` function and its call
4. Remove `syncCredentialsToSidecar()` call
5. Replace with `loadCredentialCache()` from `adapter/fetch`
6. The init flow becomes:
   - Install fetch interceptor
   - Check vault exists
   - On unlock: `openVault(password)` → `loadCredentialCache()` → setState("ready")

- [ ] **Step 2: Commit**

```bash
git add packages/desktop/src/DesktopApp.tsx
git commit -m "feat(desktop): simplify init — no sidecar port, no credential sync"
```

---

### Task 8: Delete packages/desktop-server + update CI

**Files:**
- Delete: `packages/desktop-server/` (entire directory)
- Modify: `.github/workflows/release.yml`
- Modify: `package.json` (root)

- [ ] **Step 1: Delete desktop-server**

```bash
rm -rf packages/desktop-server
```

- [ ] **Step 2: Remove desktop-server from release.yml**

In each build job, remove:
```yaml
- name: Install and build desktop-server
  run: |
    cd packages/desktop-server
    npm install --legacy-peer-deps
    node scripts/build.mjs
```

- [ ] **Step 3: Remove desktop-server scripts from root package.json**

Remove `dev:desktop-server` and `build:desktop-server` scripts.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(desktop): delete desktop-server package — replaced by Rust commands"
```

---

### Task 9: Verify end-to-end

**Files:** No new files — verification only.

- [ ] **Step 1: Compile Rust**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: No errors.

- [ ] **Step 2: Build frontend**

Run: `cd packages/desktop && npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Run tauri dev**

Run: `cd packages/desktop && npx tauri dev`
Expected: App opens, vault unlock works, ERPNext requests go through Rust.

- [ ] **Step 4: Test instance CRUD**

- Create vault
- Add an ERPNext instance (test connection first)
- Switch to instance tab
- Verify dashboard/projects load data from ERPNext

- [ ] **Step 5: Commit verification**

```bash
git commit --allow-empty -m "test(desktop): direct Rust architecture verified"
```
