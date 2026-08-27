# Y-app Desktop — Direct Rust Architecture

> Replace the Node sidecar with Rust Tauri commands. Frontend → invoke() → Rust reqwest → ERPNext.

**Date:** 2026-04-13
**Status:** Approved, pending implementation
**Replaces:** `2026-04-13-desktop-app-design.md` (sidecar architecture)

---

## 1. Architecture

```
Frontend (React, same components)
  └─ invoke("erpnext_request", { instanceId, method, path, body })
       │
       ▼
Tauri Rust commands (in-process, same binary)
  ├─ erpnext_request  → reqwest HTTP to ERPNext (session cached)
  ├─ vault_*          → Stronghold encrypted vault
  ├─ instance_*       → SQLite via rusqlite
  ├─ preferences_*    → SQLite
  └─ meetings_*       → SQLite
       │
       ▼
ERPNext sites (direct HTTPS, no intermediary)
```

No Node.js runtime. No sidecar process. No localhost HTTP. One binary, one process.

---

## 2. What Gets Removed

- `packages/desktop-server/` — entire package
- Node sidecar spawn logic in `lib.rs` (both debug and release blocks)
- Fetch interceptor URL rewriting to `localhost:PORT`
- CORS middleware
- esbuild config, CJS output, `nodePaths` workarounds
- `readStdin`, `/api/desktop/*` routes
- CI steps that install/build desktop-server

---

## 3. Frontend Adapter

The fetch interceptor is rewritten to route `/api/*` calls through Rust `invoke()` instead of HTTP:

```typescript
window.fetch = function(input, init) {
  if (url.startsWith("/api/")) {
    return invoke("erpnext_request", {
      instanceId: getActiveInstance()?.id,
      method: init?.method || "GET",
      path: url,
      body: init?.body,
      headers: extractHeaders(init),
    }).then(r => new Response(r.body, { status: r.status, headers: r.headers }));
  }
  return originalFetch(input, init);
};
```

This means zero changes to `packages/frontend/` components, `lib/erpnext.ts`, or any page. The adapter is the single integration point.

---

## 4. Rust Commands

### 4.1 ERPNext Proxy

One command replaces all Express proxy routes:

```rust
#[tauri::command]
async fn erpnext_request(
    state: State<'_, AppState>,
    instance_id: u32,
    method: String,
    path: String,
    body: Option<String>,
    headers: Option<HashMap<String, String>>,
) -> Result<ProxyResponse, String>
```

`AppState` holds:
- `sessions: DashMap<u32, CachedSession>` — ERPNext session cookies, 4h TTL
- `db: Mutex<Connection>` — rusqlite

Session management:
1. Check `sessions` cache for valid session
2. If missing/expired: read credentials from Stronghold, login to ERPNext, cache the sid
3. Forward request with `Cookie: sid=<cached>` header
4. If 401: invalidate cache, re-login, retry once
5. Return response body + status + headers

### 4.2 Instance Management

```rust
#[tauri::command] fn list_instances(state) -> Vec<Instance>
#[tauri::command] fn add_instance(state, name, url, theme_color) -> Instance
#[tauri::command] fn update_instance(state, id, name, url, theme_color) -> Instance
#[tauri::command] fn delete_instance(state, id) -> bool
#[tauri::command] fn test_instance(url, username, password) -> TestResult
```

Instance metadata in SQLite. Credentials in Stronghold (via frontend vault.ts, already implemented).

### 4.3 Settings & Preferences

```rust
#[tauri::command] fn get_instance_settings(state, id) -> HashMap<String, String>
#[tauri::command] fn put_instance_setting(state, id, key, value) -> bool
#[tauri::command] fn get_preference(state, key) -> Option<String>
#[tauri::command] fn set_preference(state, key, value) -> bool
```

### 4.4 Meetings

```rust
#[tauri::command] fn list_meetings(state) -> Vec<Meeting>
#[tauri::command] fn save_meeting(state, meeting) -> Meeting
#[tauri::command] fn delete_meeting(state, id) -> bool
```

Stored in SQLite instead of a JSON file.

### 4.5 Existing Commands (keep)

- `vault_exists` — check Stronghold file
- `get_credentials`, `is_vault_unlocked` — Stronghold state

### 4.6 Removed (sidecar-only)

- `get_sidecar_port` — no sidecar
- All mail routes — deferred to Phase 2
- Terminal WebSocket — deferred
- Agent chat SSE — can be re-added as Rust `Command::new("claude")` later

---

## 5. Rust Dependencies

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tauri-plugin-stronghold = "2"
tauri-plugin-deep-link = "2"
tauri-plugin-notification = "2"
reqwest = { version = "0.12", features = ["cookies", "json"] }
rusqlite = { version = "0.32", features = ["bundled"] }
dashmap = "6"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
portpicker = "0.1"  # remove — no longer needed
```

---

## 6. SQLite Schema

Same tables as before, now managed by rusqlite:

```sql
CREATE TABLE instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    theme_color TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE instance_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(instance_id, setting_key)
);

CREATE TABLE preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE meetings (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## 7. Deferred Features

| Feature | Reason | Alternative |
|---|---|---|
| IMAP/SMTP mail | 2-3 week Rust rewrite | Use web app for email |
| Messenger (NextCloud Talk, Telegram) | HTTP-only, low priority | Add as Rust HTTP commands later |
| Terminal | Desktop-only, niche | Not needed for core workflow |
| Agent chat (Claude CLI) | Desktop-only | Re-add as Rust Command::new later |
| Stats aggregation (/api/stats/uren) | Complex, can move to frontend | Frontend fetches raw data + aggregates client-side |
| Health diagnostics | Was server-centric | Rust can ping ERPNext directly |
| Password vault | Was local JSON file | Move to Stronghold or SQLite |

---

## 8. What Stays Unchanged

- `packages/frontend/` — untouched
- `packages/server/` — untouched (web app continues working)
- All React components imported via `@frontend` alias
- Stronghold vault integration (`adapter/vault.ts`)
- DesktopApp.tsx vault unlock flow
- Tauri window, tray, notifications, deep-link
- i18n, Tailwind, all UI
- `.github/workflows/deploy-server.yml` — web app deploy unchanged

---

## 9. Implementation Phases

**Phase 1 (this spec):**
1. Add Rust crates (reqwest, rusqlite, dashmap)
2. Create `src/erpnext.rs` — proxy command with session cache
3. Create `src/database.rs` — SQLite init + CRUD
4. Update `src/commands.rs` — instance, settings, meetings, preferences commands
5. Rewrite `adapter/fetch.ts` — invoke() instead of HTTP
6. Remove sidecar spawn from `lib.rs`
7. Delete `packages/desktop-server/`
8. Update release.yml — remove desktop-server steps
9. Verify: tauri dev works, ERPNext CRUD works, vault works

**Phase 2 (future):**
- Rust-native IMAP/SMTP
- Messenger commands
- Android safe area insets
- Stats aggregation in frontend
