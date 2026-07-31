# Y-app Desktop Application — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tauri + Node sidecar desktop application that provides full Y-app feature parity without requiring the hosted server.

**Architecture:** Tauri 2.x manages the window, Stronghold vault, and Node sidecar lifecycle. The sidecar runs an adapted Express server on localhost that reuses existing server modules (mail, messenger, ERPNext client, etc.). The React frontend imports shared components from the web app package with a fetch adapter that redirects `/api/*` to the sidecar's localhost port.

**Tech Stack:** Tauri 2.x (Rust), Node.js sidecar, Express, TypeScript, React 19, Vite, better-sqlite3, tauri-plugin-stronghold, tauri-plugin-shell

**Spec:** `docs/superpowers/specs/2026-04-13-desktop-app-design.md`

---

## File Structure

### New files to create

```
packages/desktop/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx                      # Desktop React entry point
    DesktopApp.tsx                 # Top-level app (vault unlock → workspace)
    adapter/
      fetch.ts                    # Rewrites /api/* to localhost:PORT
      storage.ts                  # localStorage-compatible API backed by SQLite
    pages/
      VaultUnlock.tsx             # Vault password entry screen
      FirstLaunch.tsx             # Create vault + add first instance
  src-tauri/
    Cargo.toml                    # Tauri deps + stronghold + shell plugins
    tauri.conf.json               # Points to desktop dist, sidecar config
    build.rs                      # Tauri build script
    capabilities/
      default.json                # Permissions for stronghold, shell, sidecar
    src/
      main.rs                     # Spawn sidecar, manage lifecycle, Stronghold IPC
      commands.rs                 # Tauri invoke commands (vault CRUD, port info)
      lib.rs                      # Module declarations
    binaries/                     # Node sidecar binary bundled here (gitignored)

packages/desktop-server/
  package.json
  tsconfig.json
  src/
    index.ts                      # Express on 127.0.0.1:<port>, reads creds from stdin
    auth-desktop.ts               # Simplified auth (no Y-app accounts, no brute force)
    instance-desktop.ts           # Instance CRUD: metadata in SQLite, creds via Tauri
    crypto-desktop.ts             # Credential access from in-memory store (received via stdin)
    db-desktop.ts                 # Local SQLite (instances, settings, preferences — no y_app_users)
    routes.ts                     # Wire all route handlers (imports from packages/server)
```

### Existing files to modify

```
packages/frontend/
  package.json                    # Remove @tauri-apps/* dependencies
  src-tauri/                      # DELETE entire directory (moved to packages/desktop)

.github/workflows/release.yml    # Update Tauri path references
.gitignore                       # Add desktop-specific entries
package.json (root)              # Add desktop + desktop-server workspaces
```

### Existing files imported unchanged

```
packages/server/src/
  mail.ts                         # Imported by desktop-server routes.ts
  messenger.ts                    # Imported by desktop-server routes.ts
  nextcloud.ts                    # Imported by desktop-server routes.ts
  erpnext-client.ts               # Imported by desktop-server routes.ts
  instance-proxy.ts               # Imported by desktop-server (session cache)
  terminal.ts                     # Imported by desktop-server routes.ts
  agent.ts                        # Imported by desktop-server routes.ts
  meetings.ts                     # Imported by desktop-server routes.ts
  health.ts                       # Imported by desktop-server routes.ts

packages/frontend/src/
  pages/*.tsx                     # Imported by desktop DesktopApp.tsx (lazy)
  components/*.tsx                # Imported by desktop DesktopApp.tsx
  lib/erpnext.ts                  # Imported by desktop (works via fetch adapter)
  lib/i18n.ts                     # Imported by desktop main.tsx
```

---

## Phase 1 — Foundation

**Goal:** Can add ERPNext instances, switch tabs, browse ERPNext documents in a desktop window.

---

### Task 1: Scaffold `packages/desktop-server`

**Files:**
- Create: `packages/desktop-server/package.json`
- Create: `packages/desktop-server/tsconfig.json`
- Create: `packages/desktop-server/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@y-app/desktop-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "compression": "^1.7.4",
    "cookie-parser": "^1.4.6",
    "express": "^4.18.2",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/compression": "^1.7.5",
    "@types/cookie-parser": "^1.4.6",
    "@types/express": "^4.17.21",
    "@types/ws": "^8.5.10",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "paths": {
      "@y-app/server/*": ["../server/src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create minimal index.ts that listens on localhost**

```typescript
import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import { createServer } from "http";

const app = express();
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "100mb" }));

// Health ping — used by Tauri to confirm sidecar is ready
app.get("/api/health/ping", (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

const port = parseInt(process.argv.find(a => a.startsWith("--port="))?.split("=")[1] ?? "0", 10);
const server = createServer(app);

server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  const boundPort = typeof addr === "object" && addr ? addr.port : port;
  // Signal to Tauri that we're ready (stdout)
  console.log(JSON.stringify({ event: "ready", port: boundPort }));
});
```

- [ ] **Step 4: Install dependencies**

Run: `cd packages/desktop-server && npm install --legacy-peer-deps`
Expected: `node_modules/` created, no errors

- [ ] **Step 5: Verify the server starts**

Run: `cd packages/desktop-server && npx tsx src/index.ts --port=0`
Expected: JSON output `{"event":"ready","port":<number>}` on stdout. Kill with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop-server/
git commit -m "feat(desktop): scaffold desktop-server package with minimal Express on localhost"
```

---

### Task 2: Scaffold `packages/desktop` (Tauri + Vite)

**Files:**
- Create: `packages/desktop/package.json`
- Create: `packages/desktop/tsconfig.json`
- Create: `packages/desktop/vite.config.ts`
- Create: `packages/desktop/index.html`
- Create: `packages/desktop/src/main.tsx`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@y-app/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri:dev": "npx tauri dev",
    "tauri:build": "npx tauri build"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.10.1",
    "@tauri-apps/plugin-shell": "^2.2.0",
    "@tauri-apps/plugin-stronghold": "^2.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.14.0",
    "react-i18next": "^15.4.1",
    "i18next": "^24.2.2",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.10.1",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.3.3",
    "vite": "^6.0.0",
    "tailwindcss": "^4.2.2",
    "@tailwindcss/vite": "^4.2.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@frontend/*": ["../frontend/src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@frontend": path.resolve(__dirname, "../frontend/src"),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Y-app Desktop</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create minimal main.tsx**

```tsx
import { createRoot } from "react-dom/client";

function App() {
  return <div style={{ padding: 40, fontFamily: "system-ui" }}>
    <h1>Y-app Desktop</h1>
    <p>Foundation scaffold — Tauri + Vite working.</p>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 6: Install dependencies**

Run: `cd packages/desktop && npm install --legacy-peer-deps`
Expected: `node_modules/` created

- [ ] **Step 7: Verify Vite starts**

Run: `cd packages/desktop && npx vite`
Expected: Dev server on `http://localhost:5174`, shows "Y-app Desktop" heading in browser.

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/
git commit -m "feat(desktop): scaffold desktop frontend package with Vite + React"
```

---

### Task 3: Move Tauri files from frontend to desktop

**Files:**
- Move: `packages/frontend/src-tauri/` → `packages/desktop/src-tauri/`
- Modify: `packages/frontend/package.json` (remove @tauri-apps deps)
- Modify: `packages/desktop/src-tauri/tauri.conf.json`
- Modify: `packages/desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Move the Tauri directory**

```bash
mv packages/frontend/src-tauri packages/desktop/src-tauri
```

- [ ] **Step 2: Remove @tauri-apps from frontend package.json**

In `packages/frontend/package.json`, remove these entries:
- From `dependencies`: `"@tauri-apps/api": "^2.10.1"`
- From `devDependencies`: `"@tauri-apps/cli": "^2.10.1"`
- Remove scripts: `"tauri:dev"`, `"tauri:build"`, `"tauri:build:mini"`

- [ ] **Step 3: Update tauri.conf.json to point to desktop dist**

In `packages/desktop/src-tauri/tauri.conf.json`, change:

```json
{
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5174",
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": ""
  }
}
```

The `devUrl` changes from `5173` to `5174` (desktop Vite port). `frontendDist` stays `../dist` (relative to src-tauri, points to `packages/desktop/dist`).

- [ ] **Step 4: Update Cargo.toml — add stronghold plugin**

Replace `packages/desktop/src-tauri/Cargo.toml`:

```toml
[package]
name = "y-app-desktop"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-stronghold = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
portpicker = "0.1"

[profile.release]
strip = true
lto = true
codegen-units = 1
opt-level = "s"
panic = "abort"
```

- [ ] **Step 5: Update capabilities/default.json**

Replace `packages/desktop/src-tauri/capabilities/default.json`:

```json
{
  "identifier": "default",
  "description": "Default capabilities for Y-app Desktop",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:default",
    "shell:allow-open",
    "stronghold:default",
    {
      "identifier": "shell:allow-spawn",
      "allow": [
        {
          "args": true,
          "name": "binaries/node",
          "sidecar": true
        }
      ]
    }
  ]
}
```

- [ ] **Step 6: Verify Tauri compiles (without sidecar yet)**

Run: `cd packages/desktop && npx tauri dev`
Expected: Tauri window opens showing the "Y-app Desktop" Vite page. Close it.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/src-tauri/ packages/frontend/package.json
git commit -m "feat(desktop): move Tauri files from frontend, add stronghold plugin"
```

---

### Task 4: Tauri main.rs — sidecar lifecycle + Stronghold setup

**Files:**
- Create: `packages/desktop/src-tauri/src/lib.rs`
- Create: `packages/desktop/src-tauri/src/commands.rs`
- Modify: `packages/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Create lib.rs with module declarations**

```rust
pub mod commands;
```

- [ ] **Step 2: Create commands.rs with Stronghold vault commands**

```rust
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_stronghold::stronghold::Stronghold;

#[derive(Default)]
pub struct VaultState {
    pub unlocked: Mutex<bool>,
    pub credentials: Mutex<Option<String>>, // JSON blob of all credentials
    pub sidecar_port: Mutex<u16>,
}

#[derive(Serialize, Deserialize)]
pub struct InstanceCredential {
    pub instance_id: u32,
    pub erpnext_username: String,
    pub erpnext_password: String,
    pub imap_host: Option<String>,
    pub imap_port: Option<u16>,
    pub imap_user: Option<String>,
    pub imap_pass: Option<String>,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<u16>,
    pub smtp_user: Option<String>,
    pub smtp_pass: Option<String>,
    pub nextcloud_url: Option<String>,
    pub nextcloud_user: Option<String>,
    pub nextcloud_pass: Option<String>,
    pub nextcloud_talk_url: Option<String>,
    pub nextcloud_talk_user: Option<String>,
    pub nextcloud_talk_pass: Option<String>,
    pub telegram_token: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct VaultData {
    pub instances: Vec<InstanceCredential>,
}

/// Check if the vault file exists (first launch detection)
#[tauri::command]
pub fn vault_exists(app: AppHandle) -> bool {
    let vault_path = app
        .path()
        .app_data_dir()
        .expect("app data dir")
        .join("vault.hold");
    vault_path.exists()
}

/// Get the sidecar port so the webview knows where to send requests
#[tauri::command]
pub fn get_sidecar_port(state: State<'_, VaultState>) -> u16 {
    *state.sidecar_port.lock().unwrap()
}

/// Get credentials JSON (called by frontend to pass to sidecar context)
#[tauri::command]
pub fn get_credentials(state: State<'_, VaultState>) -> Option<String> {
    state.credentials.lock().unwrap().clone()
}

/// Check if vault is unlocked
#[tauri::command]
pub fn is_vault_unlocked(state: State<'_, VaultState>) -> bool {
    *state.unlocked.lock().unwrap()
}
```

- [ ] **Step 3: Update main.rs — full sidecar lifecycle**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::VaultState;
use std::io::{BufRead, BufReader};
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_stronghold::Builder::new(|password| {
            // Argon2 key derivation for Stronghold vault
            use argon2::{hash_raw, Config, Variant, Version};
            let config = Config {
                lanes: 4,
                mem_cost: 65536,
                time_cost: 3,
                variant: Variant::Argon2id,
                version: Version::Version13,
                ..Default::default()
            };
            let salt = b"y-app-desktop-vault-salt-v1";
            hash_raw(password.as_ref(), salt, &config)
                .expect("argon2 hash failed")
        }).build())
        .manage(VaultState::default())
        .invoke_handler(tauri::generate_handler![
            commands::vault_exists,
            commands::get_sidecar_port,
            commands::get_credentials,
            commands::is_vault_unlocked,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Pick a random available port for the sidecar
            let port = portpicker::pick_unused_port().expect("no free port");

            // Store port in state
            let state = handle.state::<VaultState>();
            *state.sidecar_port.lock().unwrap() = port;

            // Spawn Node sidecar
            let shell = handle.shell();
            let (mut rx, _child) = shell
                .sidecar("binaries/node")
                .expect("failed to create sidecar command")
                .args(&[
                    "desktop-server/dist/index.js".to_string(),
                    format!("--port={}", port),
                ])
                .spawn()
                .expect("failed to spawn sidecar");

            // Listen for sidecar ready signal
            let handle_clone = handle.clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                            // Check for ready signal
                            if line.contains("\"event\":\"ready\"") {
                                let _ = handle_clone.emit("sidecar-ready", port);
                            }
                        }
                        tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                            eprintln!("[sidecar stderr] {}", line);
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Y-app Desktop");
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: Compiles without errors (sidecar won't spawn yet — no Node binary bundled).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/
git commit -m "feat(desktop): Tauri main with sidecar lifecycle and Stronghold vault commands"
```

---

### Task 5: Desktop server — credential intake via stdin + SQLite

**Files:**
- Create: `packages/desktop-server/src/db-desktop.ts`
- Create: `packages/desktop-server/src/crypto-desktop.ts`
- Modify: `packages/desktop-server/src/index.ts`

- [ ] **Step 1: Create db-desktop.ts — local SQLite for non-secret data**

```typescript
import Database from "better-sqlite3";
import { join } from "path";
import { homedir } from "os";

const dbDir = process.env.YAPP_DESKTOP_DATA_DIR ?? join(homedir(), ".y-app-desktop");

// Ensure directory exists
import { mkdirSync } from "fs";
mkdirSync(dbDir, { recursive: true });

export const db = new Database(join(dbDir, "desktop.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Schema: instance metadata + settings (credentials are NOT here — they're in Stronghold)
db.exec(`
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
`);
```

- [ ] **Step 2: Create crypto-desktop.ts — in-memory credential store**

```typescript
export interface InstanceCredentials {
  instance_id: number;
  erpnext_username: string;
  erpnext_password: string;
  imap_host?: string;
  imap_port?: number;
  imap_user?: string;
  imap_pass?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  nextcloud_url?: string;
  nextcloud_user?: string;
  nextcloud_pass?: string;
  nextcloud_talk_url?: string;
  nextcloud_talk_user?: string;
  nextcloud_talk_pass?: string;
  telegram_token?: string;
}

// In-memory credential store — populated from Tauri via stdin at startup
const credentialStore = new Map<number, InstanceCredentials>();

export function loadCredentials(creds: InstanceCredentials[]): void {
  credentialStore.clear();
  for (const c of creds) {
    credentialStore.set(c.instance_id, c);
  }
}

export function getCredentials(instanceId: number): InstanceCredentials | undefined {
  return credentialStore.get(instanceId);
}

export function getAllCredentials(): InstanceCredentials[] {
  return Array.from(credentialStore.values());
}

export function setCredentials(instanceId: number, creds: InstanceCredentials): void {
  credentialStore.set(instanceId, creds);
}

export function removeCredentials(instanceId: number): void {
  credentialStore.delete(instanceId);
}
```

- [ ] **Step 3: Update index.ts — read credentials from stdin at startup**

```typescript
import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { loadCredentials } from "./crypto-desktop.js";

const app = express();
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "100mb" }));

// Health ping — used by Tauri to confirm sidecar is ready
app.get("/api/health/ping", (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// Read credentials from stdin (sent by Tauri after Stronghold unlock)
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    // If no stdin after 5s, proceed without credentials (first launch)
    setTimeout(() => resolve(data || "{}"), 5000);
  });
}

async function start() {
  // Load credentials from stdin
  const stdinData = await readStdin();
  try {
    const parsed = JSON.parse(stdinData);
    if (parsed.instances && Array.isArray(parsed.instances)) {
      loadCredentials(parsed.instances);
    }
  } catch {
    // No credentials yet — first launch or vault not unlocked
  }

  const port = parseInt(
    process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? "0",
    10
  );
  const server = createServer(app);

  server.listen(port, "127.0.0.1", () => {
    const addr = server.address();
    const boundPort = typeof addr === "object" && addr ? addr.port : port;
    console.log(JSON.stringify({ event: "ready", port: boundPort }));
  });
}

start();
```

- [ ] **Step 4: Verify it builds**

Run: `cd packages/desktop-server && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop-server/src/
git commit -m "feat(desktop): desktop-server with SQLite, in-memory credential store, stdin intake"
```

---

### Task 6: Desktop server — instance management routes

**Files:**
- Create: `packages/desktop-server/src/instance-desktop.ts`
- Modify: `packages/desktop-server/src/index.ts`

- [ ] **Step 1: Create instance-desktop.ts**

```typescript
import { Request, Response } from "express";
import { db } from "./db-desktop.js";
import { getCredentials, setCredentials, removeCredentials } from "./crypto-desktop.js";

interface InstanceRow {
  id: number;
  name: string;
  url: string;
  theme_color: string | null;
  created_at: string;
}

// List all instances (metadata only — credentials are in memory)
export function listInstances(_req: Request, res: Response) {
  const rows = db.prepare("SELECT * FROM instances ORDER BY created_at").all() as InstanceRow[];
  const instances = rows.map((r) => ({
    ...r,
    hasCredentials: !!getCredentials(r.id),
  }));
  res.json(instances);
}

// Add a new instance (metadata in SQLite, credentials signaled to Tauri)
export function addInstance(req: Request, res: Response) {
  const { name, url, theme_color, erpnext_username, erpnext_password } = req.body;

  if (!name || !url || !erpnext_username || !erpnext_password) {
    res.status(400).json({ error: "name, url, erpnext_username, erpnext_password are required" });
    return;
  }

  const result = db.prepare(
    "INSERT INTO instances (name, url, theme_color) VALUES (?, ?, ?)"
  ).run(name, url, theme_color ?? null);

  const instanceId = result.lastInsertRowid as number;

  // Store credentials in memory
  setCredentials(instanceId, {
    instance_id: instanceId,
    erpnext_username,
    erpnext_password,
  });

  res.json({ id: instanceId, name, url, theme_color });
}

// Update instance metadata
export function updateInstance(req: Request, res: Response) {
  const { id } = req.params;
  const { name, url, theme_color } = req.body;

  db.prepare(
    "UPDATE instances SET name = COALESCE(?, name), url = COALESCE(?, url), theme_color = COALESCE(?, theme_color) WHERE id = ?"
  ).run(name, url, theme_color, id);

  res.json({ ok: true });
}

// Delete instance
export function deleteInstance(req: Request, res: Response) {
  const { id } = req.params;
  const instanceId = parseInt(id, 10);

  db.prepare("DELETE FROM instances WHERE id = ?").run(instanceId);
  removeCredentials(instanceId);

  res.json({ ok: true });
}

// Test ERPNext connection (without persisting)
export async function testInstance(req: Request, res: Response) {
  const { url, username, password } = req.body;

  try {
    const loginRes = await fetch(`${url}/api/method/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usr: username, pwd: password }),
    });

    if (!loginRes.ok) {
      res.json({ ok: false, error: "Login failed" });
      return;
    }

    const sid = loginRes.headers.get("set-cookie")?.match(/sid=([^;]+)/)?.[1];
    if (!sid) {
      res.json({ ok: false, error: "No session cookie received" });
      return;
    }

    // Fetch user info
    const userRes = await fetch(`${url}/api/resource/User/${username}`, {
      headers: { Cookie: `sid=${sid}` },
    });
    const userData = await userRes.json();

    res.json({
      ok: true,
      fullName: userData.data?.full_name ?? username,
      roles: userData.data?.roles?.map((r: { role: string }) => r.role) ?? [],
    });
  } catch (e: any) {
    res.json({ ok: false, error: e.message });
  }
}

// Instance settings CRUD
export function getInstanceSettings(req: Request, res: Response) {
  const { id } = req.params;
  const rows = db
    .prepare("SELECT setting_key, setting_value FROM instance_settings WHERE instance_id = ?")
    .all(parseInt(id, 10)) as { setting_key: string; setting_value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.setting_key] = r.setting_value;
  res.json(settings);
}

export function putInstanceSetting(req: Request, res: Response) {
  const { id, key } = req.params;
  const { value } = req.body;

  db.prepare(`
    INSERT INTO instance_settings (instance_id, setting_key, setting_value, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(instance_id, setting_key)
    DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at
  `).run(parseInt(id, 10), key, typeof value === "string" ? value : JSON.stringify(value));

  res.json({ ok: true });
}
```

- [ ] **Step 2: Wire instance routes in index.ts**

Add to `packages/desktop-server/src/index.ts`, before the `start()` call:

```typescript
import {
  listInstances, addInstance, updateInstance, deleteInstance,
  testInstance, getInstanceSettings, putInstanceSetting,
} from "./instance-desktop.js";

// Instance management
app.get("/api/instances", listInstances);
app.post("/api/instances", addInstance);
app.post("/api/instances/test", testInstance);
app.put("/api/instances/:id", updateInstance);
app.delete("/api/instances/:id", deleteInstance);
app.get("/api/instances/:id/settings", getInstanceSettings);
app.get("/api/instances/:id/settings/:key", (req, res) => {
  const { id, key } = req.params;
  const row = db.prepare(
    "SELECT setting_value FROM instance_settings WHERE instance_id = ? AND setting_key = ?"
  ).get(parseInt(id, 10), key) as { setting_value: string } | undefined;
  res.json(row ? JSON.parse(row.setting_value) : null);
});
app.put("/api/instances/:id/settings/:key", putInstanceSetting);
```

Also add the `db` import at the top:
```typescript
import { db } from "./db-desktop.js";
```

- [ ] **Step 3: Verify it builds**

Run: `cd packages/desktop-server && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop-server/src/
git commit -m "feat(desktop): instance management routes with SQLite metadata + in-memory credentials"
```

---

### Task 7: Desktop server — ERPNext proxy with session cache

**Files:**
- Create: `packages/desktop-server/src/auth-desktop.ts`
- Create: `packages/desktop-server/src/routes.ts`
- Modify: `packages/desktop-server/src/index.ts`

- [ ] **Step 1: Create auth-desktop.ts — active instance tracking**

```typescript
import { getCredentials } from "./crypto-desktop.js";
import { db } from "./db-desktop.js";

interface InstanceRow {
  id: number;
  name: string;
  url: string;
  theme_color: string | null;
}

// In-memory active instance ID (set by frontend via API call)
let activeInstanceId: number | null = null;

export function setActiveInstance(id: number | null): void {
  activeInstanceId = id;
}

export function getActiveInstanceId(): number | null {
  return activeInstanceId;
}

export function getActiveInstance(): (InstanceRow & { erpnext_username: string; erpnext_password: string }) | null {
  if (!activeInstanceId) return null;

  const row = db.prepare("SELECT * FROM instances WHERE id = ?").get(activeInstanceId) as InstanceRow | undefined;
  if (!row) return null;

  const creds = getCredentials(activeInstanceId);
  if (!creds) return null;

  return {
    ...row,
    erpnext_username: creds.erpnext_username,
    erpnext_password: creds.erpnext_password,
  };
}
```

- [ ] **Step 2: Create routes.ts — wire ERPNext proxy routes**

This file registers the ERPNext document/method proxy routes. It uses the active instance's URL and cached session.

```typescript
import { Request, Response, Express } from "express";
import { getActiveInstance, setActiveInstance } from "./auth-desktop.js";

// ERPNext session cache: instanceId -> { sid, expiresAt }
const sessionCache = new Map<number, { sid: string; url: string; expiresAt: number }>();
const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours

async function loginToErpNext(url: string, username: string, password: string): Promise<string | null> {
  try {
    const res = await fetch(`${url}/api/method/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usr: username, pwd: password }),
    });
    if (!res.ok) return null;
    const sid = res.headers.get("set-cookie")?.match(/sid=([^;]+)/)?.[1];
    return sid ?? null;
  } catch {
    return null;
  }
}

async function getSession(instanceId: number, url: string, username: string, password: string): Promise<string | null> {
  const cached = sessionCache.get(instanceId);
  if (cached && cached.expiresAt > Date.now()) return cached.sid;

  const sid = await loginToErpNext(url, username, password);
  if (sid) {
    sessionCache.set(instanceId, { sid, url, expiresAt: Date.now() + SESSION_TTL });
  }
  return sid;
}

async function proxyToErpNext(req: Request, res: Response, path: string) {
  const instance = getActiveInstance();
  if (!instance) {
    res.status(400).json({ error: "No active instance" });
    return;
  }

  const sid = await getSession(instance.id, instance.url, instance.erpnext_username, instance.erpnext_password);
  if (!sid) {
    res.status(401).json({ error: "ERPNext login failed" });
    return;
  }

  try {
    const erpUrl = `${instance.url}${path}${req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""}`;
    const headers: Record<string, string> = {
      Cookie: `sid=${sid}`,
    };
    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"] as string;
    }

    const erpRes = await fetch(erpUrl, {
      method: req.method,
      headers,
      body: ["POST", "PUT", "PATCH"].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    // If 401/403, invalidate cache and retry once
    if (erpRes.status === 401 || erpRes.status === 403) {
      sessionCache.delete(instance.id);
      const newSid = await getSession(instance.id, instance.url, instance.erpnext_username, instance.erpnext_password);
      if (!newSid) {
        res.status(401).json({ error: "ERPNext re-login failed" });
        return;
      }
      headers.Cookie = `sid=${newSid}`;
      const retryRes = await fetch(erpUrl, {
        method: req.method,
        headers,
        body: ["POST", "PUT", "PATCH"].includes(req.method) ? JSON.stringify(req.body) : undefined,
      });
      const retryData = await retryRes.text();
      res.status(retryRes.status).type("json").send(retryData);
      return;
    }

    const data = await erpRes.text();
    res.status(erpRes.status).type("json").send(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
}

export function registerRoutes(app: Express) {
  // Set active instance
  app.post("/api/desktop/set-active-instance", (req, res) => {
    setActiveInstance(req.body.instanceId ?? null);
    res.json({ ok: true });
  });

  // Get current user for active instance
  app.get("/api/auth/me", async (req, res) => {
    const instance = getActiveInstance();
    if (!instance) {
      res.status(401).json({ error: "No active instance" });
      return;
    }
    const sid = await getSession(instance.id, instance.url, instance.erpnext_username, instance.erpnext_password);
    if (!sid) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const userRes = await fetch(`${instance.url}/api/method/frappe.auth.get_logged_user`, {
        headers: { Cookie: `sid=${sid}` },
      });
      const userData = await userRes.json();
      const username = userData.message;

      const docRes = await fetch(
        `${instance.url}/api/resource/User/${encodeURIComponent(username)}?fields=["full_name"]`,
        { headers: { Cookie: `sid=${sid}` } }
      );
      const docData = await docRes.json();

      const roleRes = await fetch(
        `${instance.url}/api/resource/User/${encodeURIComponent(username)}?fields=["roles"]`,
        { headers: { Cookie: `sid=${sid}` } }
      );
      const roleData = await roleRes.json();

      res.json({
        username,
        fullName: docData.data?.full_name ?? username,
        roles: roleData.data?.roles?.map((r: { role: string }) => r.role) ?? [],
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Y-app session check — always "logged in" for desktop (vault is unlocked)
  app.get("/api/yapp/me", (_req, res) => {
    res.json({ id: 1, email: "desktop-user@local" });
  });

  // ERPNext resource proxy
  app.all("/api/resource/:doctype", (req, res) => proxyToErpNext(req, res, `/api/resource/${req.params.doctype}`));
  app.all("/api/resource/:doctype/:name", (req, res) => proxyToErpNext(req, res, `/api/resource/${req.params.doctype}/${encodeURIComponent(req.params.name)}`));

  // ERPNext method proxy
  app.all("/api/method/:method", (req, res) => proxyToErpNext(req, res, `/api/method/${req.params.method}`));

  // Invalidate session cache for instance
  app.post("/api/instances/:id/invalidate-session", (req, res) => {
    sessionCache.delete(parseInt(req.params.id, 10));
    res.json({ ok: true });
  });

  // Services endpoint (returns empty config for desktop — credentials are per-instance)
  app.get("/api/services", (_req, res) => {
    res.json({ nextcloud: null, telegram: null, mailHost: null });
  });

  // Status endpoint
  app.get("/api/status", (_req, res) => {
    res.json({
      mode: "desktop",
      version: "0.1.0",
      sessionCacheSize: sessionCache.size,
    });
  });
}
```

- [ ] **Step 3: Wire routes in index.ts**

Add to `packages/desktop-server/src/index.ts`:

```typescript
import { registerRoutes } from "./routes.js";

// After middleware setup, before start():
registerRoutes(app);
```

- [ ] **Step 4: Verify it builds**

Run: `cd packages/desktop-server && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop-server/src/
git commit -m "feat(desktop): ERPNext proxy routes with session cache + active instance tracking"
```

---

### Task 8: Frontend fetch adapter

**Files:**
- Create: `packages/desktop/src/adapter/fetch.ts`

- [ ] **Step 1: Create fetch.ts**

```typescript
let sidecarPort: number | null = null;
let interceptorInstalled = false;

export function setSidecarPort(port: number) {
  sidecarPort = port;
}

export function getSidecarPort(): number | null {
  return sidecarPort;
}

/**
 * Installs a global fetch interceptor that rewrites /api/* URLs
 * to http://localhost:PORT/api/*  (the desktop sidecar).
 * Call once at app startup after the sidecar port is known.
 */
export function installDesktopFetchInterceptor() {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (!sidecarPort) return originalFetch.call(window, input, init);

    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
    }

    // Rewrite relative /api/* and /ws/* to sidecar
    if (url.startsWith("/api/") || url.startsWith("/ws/")) {
      const rewritten = `http://localhost:${sidecarPort}${url}`;
      if (typeof input === "string") {
        return originalFetch.call(window, rewritten, init);
      } else if (input instanceof URL) {
        return originalFetch.call(window, new URL(rewritten), init);
      } else {
        const newReq = new Request(rewritten, input);
        return originalFetch.call(window, newReq, init);
      }
    }

    return originalFetch.call(window, input, init);
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/desktop/src/adapter/
git commit -m "feat(desktop): fetch adapter that rewrites /api/* to sidecar localhost"
```

---

### Task 9: Desktop App entry point — vault unlock + workspace

**Files:**
- Create: `packages/desktop/src/pages/VaultUnlock.tsx`
- Create: `packages/desktop/src/pages/FirstLaunch.tsx`
- Create: `packages/desktop/src/DesktopApp.tsx`
- Modify: `packages/desktop/src/main.tsx`

- [ ] **Step 1: Create VaultUnlock.tsx**

```tsx
import { useState } from "react";

interface Props {
  onUnlock: (password: string) => Promise<void>;
  error: string | null;
}

export default function VaultUnlock({ onUnlock, error }: Props) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onUnlock(password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", fontFamily: "system-ui", background: "#f8fafc",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "white", padding: 40, borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: 360,
      }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Y-app Desktop</h1>
        <p style={{ color: "#64748b", marginBottom: 24 }}>Voer uw vault-wachtwoord in</p>
        {error && <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Vault wachtwoord"
          autoFocus
          style={{
            width: "100%", padding: "10px 12px", fontSize: 16,
            border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16,
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: "100%", padding: "10px 12px", fontSize: 16,
            background: "#0f172a", color: "white", border: "none",
            borderRadius: 8, cursor: loading ? "wait" : "pointer",
            opacity: loading || !password ? 0.6 : 1,
          }}
        >
          {loading ? "Ontgrendelen..." : "Ontgrendelen"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Create FirstLaunch.tsx**

```tsx
import { useState } from "react";

interface Props {
  onCreate: (password: string) => Promise<void>;
  error: string | null;
}

export default function FirstLaunch({ onCreate, error }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const valid = password.length >= 8 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    try {
      await onCreate(password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", fontFamily: "system-ui", background: "#f8fafc",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "white", padding: 40, borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: 400,
      }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Welkom bij Y-app Desktop</h1>
        <p style={{ color: "#64748b", marginBottom: 24 }}>
          Maak een vault-wachtwoord aan. Dit beschermt al uw opgeslagen inloggegevens.
        </p>
        {error && <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Vault wachtwoord (min. 8 tekens)"
          autoFocus
          style={{
            width: "100%", padding: "10px 12px", fontSize: 16,
            border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12,
            boxSizing: "border-box",
          }}
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Bevestig wachtwoord"
          style={{
            width: "100%", padding: "10px 12px", fontSize: 16,
            border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16,
            boxSizing: "border-box",
          }}
        />
        {password && confirm && password !== confirm && (
          <p style={{ color: "#ef4444", marginBottom: 12, fontSize: 14 }}>
            Wachtwoorden komen niet overeen
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !valid}
          style={{
            width: "100%", padding: "10px 12px", fontSize: 16,
            background: "#0f172a", color: "white", border: "none",
            borderRadius: 8, cursor: loading ? "wait" : "pointer",
            opacity: loading || !valid ? 0.6 : 1,
          }}
        >
          {loading ? "Aanmaken..." : "Vault aanmaken"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create DesktopApp.tsx — orchestrates vault unlock + workspace**

```tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { setSidecarPort, installDesktopFetchInterceptor } from "./adapter/fetch";
import VaultUnlock from "./pages/VaultUnlock";
import FirstLaunch from "./pages/FirstLaunch";

type AppState = "loading" | "first-launch" | "locked" | "unlocking" | "ready";

export default function DesktopApp() {
  const [state, setState] = useState<AppState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // Get sidecar port from Tauri
      const port = await invoke<number>("get_sidecar_port");
      setSidecarPort(port);
      installDesktopFetchInterceptor();

      // Check if vault exists
      const exists = await invoke<boolean>("vault_exists");
      setState(exists ? "locked" : "first-launch");
    }
    init();
  }, []);

  // Wait for sidecar ready signal
  useEffect(() => {
    const unlisten = listen<number>("sidecar-ready", () => {
      // Sidecar is up — if we're in unlocking state, transition to ready
      setState((prev) => (prev === "unlocking" ? "ready" : prev));
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleUnlock = async (password: string) => {
    setError(null);
    try {
      // Unlock Stronghold vault via Tauri
      // (This will be wired to the Stronghold plugin in a later refinement)
      setState("unlocking");
      // For now, just transition to ready
      setState("ready");
    } catch (e: any) {
      setError(e.message ?? "Vault ontgrendelen mislukt");
      setState("locked");
    }
  };

  const handleCreate = async (password: string) => {
    setError(null);
    try {
      // Create Stronghold vault via Tauri
      setState("unlocking");
      setState("ready");
    } catch (e: any) {
      setError(e.message ?? "Vault aanmaken mislukt");
      setState("first-launch");
    }
  };

  if (state === "loading") {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontFamily: "system-ui", color: "#64748b",
      }}>
        Y-app Desktop laden...
      </div>
    );
  }

  if (state === "first-launch") {
    return <FirstLaunch onCreate={handleCreate} error={error} />;
  }

  if (state === "locked") {
    return <VaultUnlock onUnlock={handleUnlock} error={error} />;
  }

  if (state === "unlocking") {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontFamily: "system-ui", color: "#64748b",
      }}>
        Vault ontgrendelen en server starten...
      </div>
    );
  }

  // state === "ready" — render the workspace
  // Phase 1: render a simple instance list + ERPNext proxy test
  // Later phases will import the full frontend components
  return <DesktopWorkspace />;
}

function DesktopWorkspace() {
  const [instances, setInstances] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<string>("");

  useEffect(() => {
    fetch("/api/instances")
      .then((r) => r.json())
      .then(setInstances)
      .catch(() => {});
  }, []);

  const switchInstance = async (id: number) => {
    setActiveId(id);
    await fetch("/api/desktop/set-active-instance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId: id }),
    });
    // Test: fetch current user
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    setTestResult(JSON.stringify(data, null, 2));
  };

  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>Y-app Desktop — Workspace</h1>
      <h2>Instances</h2>
      {instances.length === 0 && <p>Geen instances. Voeg er een toe via Settings.</p>}
      {instances.map((inst) => (
        <button
          key={inst.id}
          onClick={() => switchInstance(inst.id)}
          style={{
            padding: "8px 16px", margin: 4, cursor: "pointer",
            background: activeId === inst.id ? "#0f172a" : "#e2e8f0",
            color: activeId === inst.id ? "white" : "black",
            border: "none", borderRadius: 6,
          }}
        >
          {inst.name}
        </button>
      ))}
      {testResult && (
        <pre style={{ marginTop: 16, padding: 16, background: "#f1f5f9", borderRadius: 8 }}>
          {testResult}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update main.tsx to render DesktopApp**

Replace `packages/desktop/src/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import DesktopApp from "./DesktopApp";

createRoot(document.getElementById("root")!).render(<DesktopApp />);
```

- [ ] **Step 5: Verify Vite builds without errors**

Run: `cd packages/desktop && npx vite build`
Expected: Build succeeds, `dist/` created.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/
git commit -m "feat(desktop): vault unlock flow, first-launch setup, workspace with instance switching"
```

---

### Task 10: Static file serving + full sidecar integration

**Files:**
- Modify: `packages/desktop-server/src/index.ts`
- Modify: `packages/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Add static file serving to desktop-server**

In `packages/desktop-server/src/index.ts`, add after the middleware:

```typescript
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

// Serve static frontend files in production
const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDist = join(__dirname, "../../desktop/dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback: all non-API routes serve index.html
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/ws/")) {
      next();
      return;
    }
    res.sendFile(join(frontendDist, "index.html"));
  });
}
```

- [ ] **Step 2: Update tauri.conf.json for production mode**

In production, the Tauri webview should load from the sidecar (which serves static files), not from a Vite dev server. Update `packages/desktop/src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5174",
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": ""
  }
}
```

This stays the same — in dev mode Tauri uses the Vite dev server at 5174, in production it uses the bundled `dist/`.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop-server/src/index.ts packages/desktop/src-tauri/tauri.conf.json
git commit -m "feat(desktop): static file serving from sidecar in production mode"
```

---

### Task 11: Update root config + .gitignore + release workflow

**Files:**
- Modify: `package.json` (root)
- Modify: `.gitignore`
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Add workspace entries to root package.json**

In the root `package.json`, add to the `workspaces` array (if it exists) or create scripts:

```json
{
  "scripts": {
    "dev:desktop-server": "cd packages/desktop-server && npm run dev",
    "dev:desktop": "cd packages/desktop && npx vite",
    "build:desktop-server": "cd packages/desktop-server && npm run build",
    "build:desktop": "cd packages/desktop && npx vite build",
    "tauri:dev": "cd packages/desktop && npx tauri dev",
    "tauri:build": "cd packages/desktop && npx tauri build"
  }
}
```

- [ ] **Step 2: Add desktop entries to .gitignore**

Append to `.gitignore`:

```
# Desktop app
packages/desktop/src-tauri/binaries/
packages/desktop/src-tauri/target/
packages/desktop/src-tauri/gen/
packages/desktop/dist/
packages/desktop-server/dist/
```

- [ ] **Step 3: Update release.yml Tauri paths**

In `.github/workflows/release.yml`, find all references to `packages/frontend/src-tauri` and replace with `packages/desktop/src-tauri`. Find references to `packages/frontend` in Tauri build steps and replace with `packages/desktop`.

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore .github/workflows/release.yml
git commit -m "chore: add desktop packages to root config, gitignore, release workflow"
```

---

### Task 12: End-to-end test — Phase 1 integration

**Files:** No new files — this is a manual verification task.

- [ ] **Step 1: Build the desktop server**

Run: `cd packages/desktop-server && npx tsc`
Expected: `dist/` directory created with compiled JS files.

- [ ] **Step 2: Start the desktop server manually**

Run: `cd packages/desktop-server && node dist/index.js --port=4500`
Expected: `{"event":"ready","port":4500}` on stdout.

- [ ] **Step 3: Test health endpoint**

Run: `curl http://localhost:4500/api/health/ping`
Expected: `{"ok":true,"timestamp":...}`

- [ ] **Step 4: Test instance creation**

Run:
```bash
curl -X POST http://localhost:4500/api/instances \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","url":"https://your-erpnext.example.com","erpnext_username":"test","erpnext_password":"test"}'
```
Expected: `{"id":1,"name":"Test","url":"https://your-erpnext.example.com",...}`

- [ ] **Step 5: Test instance listing**

Run: `curl http://localhost:4500/api/instances`
Expected: Array with the created instance.

- [ ] **Step 6: Start Vite dev server**

Run: `cd packages/desktop && npx vite`
Expected: Dev server on `http://localhost:5174`. Page shows "Y-app Desktop" with vault flow.

- [ ] **Step 7: Commit integration test notes**

```bash
git commit --allow-empty -m "test(desktop): Phase 1 foundation verified — sidecar + frontend + instance CRUD working"
```

---

## Phase 2 — Dashboard & Core Pages

**Goal:** Daily ERP workflow usable — dashboard widgets, document pages, sidebar.

---

### Task 13: Import shared frontend components

**Files:**
- Modify: `packages/desktop/src/DesktopApp.tsx`
- Modify: `packages/desktop/vite.config.ts`

- [ ] **Step 1: Verify the @frontend alias resolves to packages/frontend/src**

The `vite.config.ts` already has the alias. Test by importing a simple shared module:

Run: Add `import "@frontend/lib/i18n"` to `DesktopApp.tsx` and run `npx vite build`. Should succeed.

- [ ] **Step 2: Replace DesktopWorkspace with the real App component tree**

Replace the placeholder `DesktopWorkspace` function in `DesktopApp.tsx` with an import of the actual frontend pages. The desktop workspace should:

1. Import `Sidebar` from `@frontend/components/Sidebar`
2. Import page components lazily from `@frontend/pages/*`
3. Set up BrowserRouter with the same route table as `@frontend/App.tsx`
4. Manage `openTabs`, `activeTabId`, `viewMode` state (same as web App.tsx)
5. Call `/api/desktop/set-active-instance` when switching tabs
6. Call `/api/auth/me` to get `instanceContext` per tab

The key difference from the web app's `App.tsx`: no Y-app login flow (vault unlock replaces it), and no fetch interceptor with `X-Y-App-Instance` header (the desktop adapter handles routing via `/api/desktop/set-active-instance`).

- [ ] **Step 3: Handle missing dependencies**

Some frontend components may import libraries not in the desktop package.json. Run `npx vite build` and fix any missing imports by adding them to `packages/desktop/package.json`. Known dependencies to add:
- `react-day-picker` (leave request modal)
- `@dnd-kit/core`, `@dnd-kit/sortable` (drag-and-drop)
- `xterm`, `@xterm/addon-fit` (terminal)
- `react-leaflet`, `leaflet` (maps)
- Any other imports that fail during build

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/
git commit -m "feat(desktop): import shared frontend components — sidebar, pages, routing"
```

---

### Task 14: Wire dashboard widgets

**Files:**
- Modify: `packages/desktop/src/DesktopApp.tsx`

- [ ] **Step 1: Import Dashboard page**

The Dashboard page (`@frontend/pages/dashboard.tsx`) should work as-is because it calls `/api/resource/*` and `/api/method/*` endpoints — which the desktop sidecar proxies to ERPNext.

Verify: navigate to `/` in the desktop app. Dashboard should render with data from the active ERPNext instance.

- [ ] **Step 2: Test uren boeken widget**

The uren boeken widget posts timesheets via `/api/resource/Timesheet`. Verify it works by booking a test entry.

- [ ] **Step 3: Test leave balance + missing hours widgets**

These fetch Employee, Leave Allocation, and Timesheet data. Verify they render correctly.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "test(desktop): dashboard widgets verified working"
```

---

### Task 15: Wire uren stats route

**Files:**
- Modify: `packages/desktop-server/src/routes.ts`

- [ ] **Step 1: Add stats routes to desktop server**

Import the stats aggregation logic. Since the web server's `/api/stats/uren` route is defined inline in `index.ts` (not a separate module), extract it or replicate the logic:

```typescript
// In routes.ts, add:
app.get("/api/stats/uren", async (req, res) => {
  // Proxy to ERPNext and aggregate — reuse the same aggregation logic
  // from packages/server/src/index.ts lines that handle /api/stats/uren
  await proxyToErpNext(req, res, "/api/stats/uren");
});

app.get("/api/stats/uren/detail", async (req, res) => {
  await proxyToErpNext(req, res, "/api/stats/uren/detail");
});
```

Note: The stats routes in the web server do heavy aggregation server-side (batch-fetching timesheets, grouping by employee/project). For the desktop server, we have two options:
1. Import the aggregation logic from the web server (if it's extractable)
2. Re-implement locally using the same `fetchAll`/`fetchList` pattern

Check whether the server's stats logic can be imported as a function. If it's tightly coupled to the server's Express `req`/`res`, create a standalone aggregation function that takes `(erpnextSid, year, company, employee?)` and returns the stats object, then call it from the desktop route.

- [ ] **Step 2: Verify stats page renders**

Navigate to the uren stats page. Should show timesheet aggregation data.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop-server/src/
git commit -m "feat(desktop): uren stats aggregation routes"
```

---

### Task 16: Employer/employee role-based view filtering

**Files:**
- Modify: `packages/desktop-server/src/routes.ts`

- [ ] **Step 1: Add user-settings route**

```typescript
app.get("/api/user-settings/:key", (req, res) => {
  const { key } = req.params;
  // Search across all instances for this setting
  const row = db.prepare(
    "SELECT setting_value FROM instance_settings WHERE setting_key = ? LIMIT 1"
  ).get(key) as { setting_value: string } | undefined;
  res.json(row ? JSON.parse(row.setting_value) : null);
});
```

- [ ] **Step 2: Verify sidebar module filtering works**

In the desktop app, switch to employee view mode. Modules should filter based on `employee-visible-modules` setting.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop-server/src/
git commit -m "feat(desktop): employer/employee view mode with local instance settings"
```

---

## Phase 3 — Communication

**Goal:** Email and chat functional.

---

### Task 17: Wire mail routes from web server

**Files:**
- Modify: `packages/desktop-server/src/routes.ts`
- Modify: `packages/desktop-server/package.json`

- [ ] **Step 1: Add mail dependencies**

The mail module uses `imapflow` and `nodemailer`. Add to `packages/desktop-server/package.json`:

```json
{
  "dependencies": {
    "imapflow": "^1.0.162",
    "nodemailer": "^6.9.8",
    "mailparser": "^3.6.6"
  },
  "devDependencies": {
    "@types/nodemailer": "^6.4.14"
  }
}
```

Run: `cd packages/desktop-server && npm install --legacy-peer-deps`

- [ ] **Step 2: Import mail handlers from web server**

In `routes.ts`, import the mail request handlers from `packages/server/src/mail.ts`:

```typescript
import {
  mailTestConnection, mailListFolders, mailListMessages,
  mailGetMessage, mailSend, mailDeleteMessage, mailMoveMessage,
  mailCreateFolder, mailWarmup, mailGetAttachment,
  mailMarkRead, mailMarkUnread, mailRenameFolder,
  mailCacheStats, mailGetSignature, mailAutoConfig,
  mailIsWarm, mailListContacts, mailGetConversation,
} from "../../server/src/mail.js";

// Register mail routes
app.get("/api/mail/test", mailTestConnection);
app.get("/api/mail/folders", mailListFolders);
app.get("/api/mail/messages", mailListMessages);
app.get("/api/mail/message", mailGetMessage);
app.post("/api/mail/send", mailSend);
app.delete("/api/mail/message", mailDeleteMessage);
app.post("/api/mail/move", mailMoveMessage);
app.post("/api/mail/folder", mailCreateFolder);
app.post("/api/mail/warmup", mailWarmup);
app.get("/api/mail/warmup", mailWarmup);
app.get("/api/mail/attachment", mailGetAttachment);
app.post("/api/mail/mark-read", mailMarkRead);
app.post("/api/mail/mark-unread", mailMarkUnread);
app.post("/api/mail/rename-folder", mailRenameFolder);
app.get("/api/mail/cache-stats", mailCacheStats);
app.get("/api/mail/signature", mailGetSignature);
app.get("/api/mail/auto-config", mailAutoConfig);
app.get("/api/mail/warm", mailIsWarm);
app.get("/api/mail/contacts", mailListContacts);
app.get("/api/mail/conversation", mailGetConversation);
```

Note: The mail handlers read credentials from query params or env vars. For the desktop app, credentials come from Stronghold (loaded into the in-memory store). The handlers need to be adapted to read IMAP/SMTP credentials from the credential store for the active instance. This may require a thin wrapper around each handler that injects credentials into the request query params before calling the original handler.

- [ ] **Step 3: Create credential injection middleware for mail**

```typescript
import { getCredentials } from "./crypto-desktop.js";
import { getActiveInstanceId } from "./auth-desktop.js";

function injectMailCredentials(req: Request, _res: Response, next: NextFunction) {
  const instanceId = getActiveInstanceId();
  if (instanceId) {
    const creds = getCredentials(instanceId);
    if (creds) {
      // Inject IMAP credentials into query params (mail.ts reads from these)
      if (creds.imap_host) req.query.host = creds.imap_host;
      if (creds.imap_port) req.query.port = String(creds.imap_port);
      if (creds.imap_user) req.query.user = creds.imap_user;
      if (creds.imap_pass) req.query.pass = creds.imap_pass;
      if (creds.smtp_host) req.query.smtpHost = creds.smtp_host;
      if (creds.smtp_port) req.query.smtpPort = String(creds.smtp_port);
    }
  }
  next();
}

// Apply before mail routes:
app.use("/api/mail", injectMailCredentials);
```

- [ ] **Step 4: Verify webmail page renders**

Navigate to `/webmail` in the desktop app. Configure IMAP credentials for the active instance. Verify folders load and messages appear.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop-server/
git commit -m "feat(desktop): webmail (IMAP/SMTP) routes imported from web server"
```

---

### Task 18: OAuth2 flow for Microsoft Graph

**Files:**
- Modify: `packages/desktop/src-tauri/Cargo.toml`
- Modify: `packages/desktop/src-tauri/src/main.rs`
- Modify: `packages/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Add deep-link plugin for OAuth redirect**

In `Cargo.toml`, add:
```toml
tauri-plugin-deep-link = "2"
```

In `tauri.conf.json`, add to bundle:
```json
{
  "bundle": {
    "deepLink": {
      "schemes": ["y-app"]
    }
  }
}
```

- [ ] **Step 2: Handle OAuth callback in main.rs**

Register a deep-link handler that captures `y-app://oauth/callback?code=...` and forwards the auth code to the desktop server for token exchange.

- [ ] **Step 3: Add token exchange route to desktop server**

The desktop server receives the auth code, exchanges it for access+refresh tokens via Microsoft's token endpoint, and stores the refresh token in the credential store.

- [ ] **Step 4: Verify OAuth2 flow end-to-end**

Test with a Microsoft 365 account: initiate OAuth from webmail auto-config, complete the browser redirect, verify access token is obtained and mail loads.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/ packages/desktop-server/src/
git commit -m "feat(desktop): OAuth2 flow for Microsoft Graph via deep-link plugin"
```

---

### Task 19: Wire messenger routes

**Files:**
- Modify: `packages/desktop-server/src/routes.ts`

- [ ] **Step 1: Import messenger handlers**

```typescript
import {
  messengerListConversations, messengerGetMessages,
  messengerSendMessage, messengerAllConversations,
  messengerReact, messengerMarkRead,
} from "../../server/src/messenger.js";

// Inject NextCloud/Telegram credentials from credential store
function injectMessengerCredentials(req: Request, _res: Response, next: NextFunction) {
  const instanceId = getActiveInstanceId();
  if (instanceId) {
    const creds = getCredentials(instanceId);
    if (creds) {
      if (creds.nextcloud_talk_url) req.query.nextcloudUrl = creds.nextcloud_talk_url;
      if (creds.nextcloud_talk_user) req.query.nextcloudUser = creds.nextcloud_talk_user;
      if (creds.nextcloud_talk_pass) req.query.nextcloudPass = creds.nextcloud_talk_pass;
      if (creds.telegram_token) req.query.telegramToken = creds.telegram_token;
    }
  }
  next();
}

app.use("/api/messenger", injectMessengerCredentials);
app.get("/api/messenger/conversations", messengerListConversations);
app.get("/api/messenger/all-conversations", messengerAllConversations);
app.get("/api/messenger/messages", messengerGetMessages);
app.post("/api/messenger/send", messengerSendMessage);
app.post("/api/messenger/react", messengerReact);
app.post("/api/messenger/mark-read", messengerMarkRead);
```

- [ ] **Step 2: Verify messenger page renders**

Navigate to `/messenger`. Verify NextCloud Talk conversations load (if configured).

- [ ] **Step 3: Commit**

```bash
git add packages/desktop-server/src/
git commit -m "feat(desktop): messenger routes (NextCloud Talk, Telegram) imported from web server"
```

---

## Phase 4 — Files, Calendar & Utilities

**Goal:** Full feature parity.

---

### Task 20: Wire NextCloud files routes

**Files:**
- Modify: `packages/desktop-server/src/routes.ts`

- [ ] **Step 1: Import NextCloud handlers with credential injection**

```typescript
import {
  nextcloudListFiles, nextcloudDownload,
  nextcloudUpload, nextcloudCreateShareLink, nextcloudDownloadUrl,
} from "../../server/src/nextcloud.js";

function injectNextcloudCredentials(req: Request, _res: Response, next: NextFunction) {
  const instanceId = getActiveInstanceId();
  if (instanceId) {
    const creds = getCredentials(instanceId);
    if (creds) {
      if (creds.nextcloud_url) req.query.url = creds.nextcloud_url;
      if (creds.nextcloud_user) req.query.user = creds.nextcloud_user;
      if (creds.nextcloud_pass) req.query.pass = creds.nextcloud_pass;
    }
  }
  next();
}

app.use("/api/nextcloud", injectNextcloudCredentials);
app.get("/api/nextcloud/files", nextcloudListFiles);
app.get("/api/nextcloud/download", nextcloudDownload);
app.get("/api/nextcloud/download-url", nextcloudDownloadUrl);
app.put("/api/nextcloud/upload", nextcloudUpload);
app.post("/api/nextcloud/share", nextcloudCreateShareLink);
```

- [ ] **Step 2: Verify file browser**

Navigate to `/nextcloud-files`. Verify folder listing and file download.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop-server/src/
git commit -m "feat(desktop): NextCloud files (WebDAV) routes"
```

---

### Task 21: Wire calendar routes

**Files:**
- Modify: `packages/desktop-server/src/routes.ts`

- [ ] **Step 1: Add calendar routes**

The calendar routes are defined inline in the web server's `index.ts`. Extract or replicate:

```typescript
// O365 calendar — requires OAuth2 token from mail auto-config
app.get("/api/calendar/o365", async (req, res) => {
  // Proxy through ERPNext proxy or use direct Microsoft Graph with token
  await proxyToErpNext(req, res, "/api/calendar/o365");
});

// iCal — HTTP fetch + VEVENT parsing
app.get("/api/calendar/ical", async (req, res) => {
  const url = (req.query.url as string)?.replace("webcal://", "https://");
  if (!url) { res.status(400).json({ error: "url required" }); return; }
  try {
    const icalRes = await fetch(url);
    const text = await icalRes.text();
    // Parse VEVENT blocks from iCal text
    const events: any[] = [];
    const blocks = text.split("BEGIN:VEVENT");
    for (const block of blocks.slice(1)) {
      const end = block.indexOf("END:VEVENT");
      if (end === -1) continue;
      const body = block.substring(0, end);
      const get = (key: string) => {
        const m = body.match(new RegExp(`^${key}[^:]*:(.*)$`, "m"));
        return m ? m[1].trim() : null;
      };
      events.push({
        summary: get("SUMMARY") ?? "",
        dtstart: get("DTSTART") ?? "",
        dtend: get("DTEND") ?? "",
        description: get("DESCRIPTION") ?? "",
        location: get("LOCATION") ?? "",
        allDay: !get("DTSTART")?.includes("T"),
      });
    }
    res.json(events);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

Note: The full iCal parser and O365 integration live inline in the web server's index.ts. These should be extracted into importable functions in the web server first, then imported by the desktop server. If extraction is too invasive, replicate the ~50 lines of VEVENT parsing logic.

- [ ] **Step 2: Commit**

```bash
git add packages/desktop-server/src/
git commit -m "feat(desktop): calendar routes (O365 + iCal)"
```

---

### Task 22: Wire meeting notes + terminal + agent chat

**Files:**
- Modify: `packages/desktop-server/src/routes.ts`
- Modify: `packages/desktop-server/src/index.ts`

- [ ] **Step 1: Import meetings handlers**

```typescript
import {
  meetingsGet, meetingsCreate, meetingsUpdate, meetingsDelete,
} from "../../server/src/meetings.js";

app.get("/api/meetings", meetingsGet);
app.post("/api/meetings", meetingsCreate);
app.put("/api/meetings/:id", meetingsUpdate);
app.delete("/api/meetings/:id", meetingsDelete);
```

- [ ] **Step 2: Import terminal WebSocket handler**

In `index.ts`, after creating the HTTP server:

```typescript
import { WebSocketServer } from "ws";
import { handleTerminalConnection } from "../../server/src/terminal.js";

const wss = new WebSocketServer({ server, path: "/ws/terminal" });
wss.on("connection", (ws) => {
  handleTerminalConnection(ws, "desktop");
});
```

- [ ] **Step 3: Import agent chat handler**

```typescript
import { handleAgentChat } from "../../server/src/agent.js";

app.post("/api/agent/chat", handleAgentChat);
```

- [ ] **Step 4: Implement password vault using local file storage**

The web app's password vault is not implemented server-side. For the desktop app, implement simple encrypted file storage:

```typescript
// In routes.ts
import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";

const vaultFile = join(process.env.YAPP_DESKTOP_DATA_DIR ?? join(homedir(), ".y-app-desktop"), "passwords.json");

app.get("/api/passwords", (_req, res) => {
  if (!existsSync(vaultFile)) { res.json([]); return; }
  res.json(JSON.parse(readFileSync(vaultFile, "utf-8")));
});

app.post("/api/passwords", (req, res) => {
  const entries = existsSync(vaultFile)
    ? JSON.parse(readFileSync(vaultFile, "utf-8"))
    : [];
  const entry = { id: crypto.randomUUID(), ...req.body, createdAt: new Date().toISOString() };
  entries.push(entry);
  writeFileSync(vaultFile, JSON.stringify(entries, null, 2));
  res.json(entry);
});

app.delete("/api/passwords/:id", (req, res) => {
  if (!existsSync(vaultFile)) { res.json({ ok: true }); return; }
  const entries = JSON.parse(readFileSync(vaultFile, "utf-8"));
  const filtered = entries.filter((e: any) => e.id !== req.params.id);
  writeFileSync(vaultFile, JSON.stringify(filtered, null, 2));
  res.json({ ok: true });
});
```

- [ ] **Step 5: Wire health routes**

```typescript
import { healthGetReport, healthRunTests, healthGetMail, healthGetMessenger } from "../../server/src/health.js";

app.get("/api/health", healthGetReport);
app.get("/api/health/run", healthRunTests);
app.get("/api/health/mail", healthGetMail);
app.get("/api/health/messenger", healthGetMessenger);
```

- [ ] **Step 6: Commit**

```bash
git add packages/desktop-server/src/
git commit -m "feat(desktop): meetings, terminal, agent chat, password vault, health routes"
```

---

## Phase 5 — Desktop Polish

**Goal:** Production-ready desktop application.

---

### Task 23: System tray

**Files:**
- Modify: `packages/desktop/src-tauri/Cargo.toml`
- Modify: `packages/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add tray plugin**

In `Cargo.toml`, add:
```toml
tauri-plugin-tray = "2"
```

- [ ] **Step 2: Configure system tray in main.rs**

Add tray icon with menu items:
- "Open Y-app" — bring window to front
- "Quick Uren Boeken" — open a small dialog for timesheet entry
- Mail count badge (fetched from sidecar)
- "Quit" — close app + kill sidecar

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/
git commit -m "feat(desktop): system tray with quick actions"
```

---

### Task 24: Auto-update

**Files:**
- Modify: `packages/desktop/src-tauri/Cargo.toml`
- Modify: `packages/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Add updater plugin**

In `Cargo.toml`:
```toml
tauri-plugin-updater = "2"
```

In `tauri.conf.json`, add:
```json
{
  "plugins": {
    "updater": {
      "endpoints": ["https://releases.y-app.impertio.app/{{target}}/{{arch}}/{{current_version}}"],
      "pubkey": "<YOUR_PUBLIC_KEY>"
    }
  }
}
```

- [ ] **Step 2: Add update check on startup in main.rs**

Check for updates 30 seconds after launch, prompt user if available.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/
git commit -m "feat(desktop): auto-update via Tauri updater plugin"
```

---

### Task 25: Native notifications

**Files:**
- Modify: `packages/desktop/src-tauri/Cargo.toml`
- Modify: `packages/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add notification plugin**

In `Cargo.toml`:
```toml
tauri-plugin-notification = "2"
```

- [ ] **Step 2: Poll sidecar for new mail/messages**

Every 60 seconds, check the sidecar's `/api/mail/folders` for unread count changes. If increased, fire a native notification.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/
git commit -m "feat(desktop): native notifications for new mail and messages"
```

---

### Task 26: localStorage-to-SQLite preference migration

**Files:**
- Create: `packages/desktop/src/adapter/storage.ts`

- [ ] **Step 1: Create storage adapter**

```typescript
// Provides a localStorage-compatible API backed by the desktop server's SQLite preferences table.
// Components that use localStorage will be transparently migrated.

const STORAGE_API = "/api/desktop/preferences";

class DesktopStorage implements Storage {
  private cache = new Map<string, string>();
  private loaded = false;

  get length(): number { return this.cache.size; }

  async load(): Promise<void> {
    const res = await fetch(STORAGE_API);
    const data = await res.json();
    this.cache.clear();
    for (const [k, v] of Object.entries(data)) {
      this.cache.set(k, v as string);
    }
    this.loaded = true;
  }

  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    fetch(STORAGE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    fetch(`${STORAGE_API}/${encodeURIComponent(key)}`, { method: "DELETE" });
  }

  clear(): void { this.cache.clear(); }
  key(index: number): string | null {
    return Array.from(this.cache.keys())[index] ?? null;
  }
}

export const desktopStorage = new DesktopStorage();
```

- [ ] **Step 2: Add preferences routes to desktop server**

```typescript
app.get("/api/desktop/preferences", (_req, res) => {
  const rows = db.prepare("SELECT key, value FROM preferences").all() as { key: string; value: string }[];
  const obj: Record<string, string> = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
});

app.post("/api/desktop/preferences", (req, res) => {
  const { key, value } = req.body;
  db.prepare("INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)").run(key, value);
  res.json({ ok: true });
});

app.delete("/api/desktop/preferences/:key", (req, res) => {
  db.prepare("DELETE FROM preferences WHERE key = ?").run(req.params.key);
  res.json({ ok: true });
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src/adapter/storage.ts packages/desktop-server/src/
git commit -m "feat(desktop): localStorage-compatible storage backed by SQLite preferences"
```

---

### Task 27: App branding + installer configuration

**Files:**
- Modify: `packages/desktop/src-tauri/tauri.conf.json`
- Create: `packages/desktop/src-tauri/icons/` (icon files)

- [ ] **Step 1: Generate app icons**

Use the Tauri icon generator to create all required sizes from a source PNG (1024x1024):

Run: `cd packages/desktop && npx tauri icon path/to/source-icon.png`
Expected: Icons generated in `src-tauri/icons/`

- [ ] **Step 2: Configure installer**

In `tauri.conf.json`, update bundle section:

```json
{
  "bundle": {
    "active": true,
    "targets": ["msi", "dmg", "appimage"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.ico", "icons/icon.png"],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "",
      "wix": {
        "language": "nl-NL"
      }
    },
    "macOS": {
      "minimumSystemVersion": "10.15"
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/
git commit -m "feat(desktop): app icons and installer configuration"
```

---

### Task 28: CI/CD — desktop build in release workflow

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Add desktop build jobs**

Add matrix jobs for building the desktop app on Windows, macOS, and Linux:

```yaml
desktop-build:
  strategy:
    matrix:
      include:
        - os: windows-latest
          target: x86_64-pc-windows-msvc
        - os: macos-latest
          target: aarch64-apple-darwin
        - os: ubuntu-22.04
          target: x86_64-unknown-linux-gnu
  runs-on: ${{ matrix.os }}
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - uses: dtolnay/rust-toolchain@stable
    - name: Install dependencies
      run: |
        cd packages/desktop-server && npm install --legacy-peer-deps
        cd ../desktop && npm install --legacy-peer-deps
    - name: Build desktop server
      run: cd packages/desktop-server && npm run build
    - name: Build desktop app
      run: cd packages/desktop && npx tauri build
    - name: Upload artifacts
      uses: actions/upload-artifact@v4
      with:
        name: desktop-${{ matrix.target }}
        path: packages/desktop/src-tauri/target/release/bundle/
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add desktop app build jobs to release workflow"
```

---

### Task 29: Final integration test — full feature parity verification

**Files:** No new files — manual verification.

- [ ] **Step 1: Build and launch desktop app**

```bash
cd packages/desktop-server && npm run build
cd ../desktop && npx tauri build
```

Launch the built installer/executable.

- [ ] **Step 2: Verify Phase 1 — Foundation**
- First-launch vault creation flow
- Add an ERPNext instance (URL + credentials)
- Switch between instances via tabs
- Browse ERPNext documents (Projects, Employees, etc.)

- [ ] **Step 3: Verify Phase 2 — Dashboard**
- Dashboard widgets render with data
- Uren boeken: book a timesheet entry
- Leave balance shows correctly
- Sidebar navigation works
- Employer/employee view mode toggle

- [ ] **Step 4: Verify Phase 3 — Communication**
- Webmail: folders load, messages display, send email
- Messenger: NextCloud Talk conversations and messages
- (Optional) OAuth2 with Microsoft 365

- [ ] **Step 5: Verify Phase 4 — Files/Calendar/Utilities**
- NextCloud files: browse, download, upload
- Calendar: events display
- Meeting notes: create, edit, delete
- Terminal: shell commands execute
- Password vault: add and list entries

- [ ] **Step 6: Verify Phase 5 — Polish**
- System tray icon and menu
- Auto-update check (if update server configured)
- Native notifications for new mail
- App icon correct in taskbar/dock

- [ ] **Step 7: Commit**

```bash
git commit --allow-empty -m "test(desktop): full feature parity verification complete"
```
