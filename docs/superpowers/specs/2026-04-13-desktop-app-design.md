# Y-app Desktop Application — Design Spec

> Tauri + Node sidecar desktop app that talks directly to ERPNext without the Y-app server.

**Date:** 2026-04-13
**Status:** Approved design, pending implementation plan

---

## 1. Product Identity

Y-app Desktop is a **separate product** alongside the existing web app. It provides the same multi-instance ERPNext workspace experience but runs entirely on the user's machine — no hosted server required.

### Key differences from the web app

| Concern | Web app | Desktop app |
|---|---|---|
| Hosting | VPS (nginx + PM2 + Express) | User's machine (Tauri + Node sidecar) |
| Auth | Y-app account (email/password + bcrypt + PBKDF2 + master key) | Vault password → Tauri Stronghold |
| Credential storage | SQLite AES-256-GCM + server master key | Stronghold encrypted vault file |
| Access | Any browser, any device | Installed app, single machine |
| Shared settings | Server-side `instance_settings` table | Local per-installation (ERPNext-native features for cross-user config) |

### What does NOT change

- `packages/frontend/` — web app untouched
- `packages/server/` — web server untouched
- `.github/workflows/deploy-server.yml` — web deploy pipeline unchanged
- i18n bundles — shared `nl.json` and `en.json`, no duplication
- ERPNext interaction model — same REST API, same doctypes, same method calls
- The threat model in `crypto.ts` — stays valid for the web app

---

## 2. Package Structure

```
packages/
  frontend/              <- existing web app (unchanged)
    src/                 <- web React app (components importable by desktop)
    package.json         <- @tauri-apps/* dependencies REMOVED
  server/                <- existing Express server (unchanged)
    src/                 <- server modules (importable by desktop-server)
  desktop/               <- NEW
    src-tauri/           <- MOVED from packages/frontend/src-tauri/
      src/
        main.rs          <- Tauri entry: spawn Node sidecar, manage lifecycle
        commands.rs      <- Tauri IPC commands (Stronghold read/write)
      tauri.conf.json    <- updated: points to desktop dist
      tauri.mini.conf.json
      Cargo.toml         <- updated: add stronghold + sidecar plugins
      capabilities/
      binaries/          <- Node sidecar binary bundled here
    src/
      main.tsx           <- Desktop React entry point (vault unlock flow)
      adapter/
        fetch.ts         <- Rewrites /api/* to localhost:PORT
        storage.ts       <- localStorage-compatible API backed by SQLite
      pages/
        VaultUnlock.tsx   <- Replaces LoginPage
        FirstLaunch.tsx   <- Replaces SignupPage (create vault + add first instance)
    package.json         <- @tauri-apps/* deps live here
  desktop-server/        <- NEW
    src/
      index.ts           <- Express on 127.0.0.1:<random-port>
      crypto-desktop.ts  <- Stronghold credential access (replaces crypto.ts)
      auth-desktop.ts    <- Simplified auth (no Y-app accounts, no brute-force)
      instance-desktop.ts <- Instance CRUD with Stronghold-backed credentials
    package.json         <- depends on packages/server for shared modules
```

### Shared code strategy

`desktop-server` imports existing modules from `packages/server`:
- `mail.ts` — IMAP/SMTP (as-is)
- `messenger.ts` — NextCloud Talk, Telegram (as-is)
- `nextcloud.ts` — WebDAV file proxy (as-is)
- `erpnext-client.ts` — ERPNext HTTP client (as-is)
- `instance-proxy.ts` — ERPNext session caching (as-is)
- `meetings.ts` — meeting notes (as-is)
- `terminal.ts` — WebSocket terminal (as-is)
- `agent.ts` — Claude CLI chat (as-is)

`desktop-server` replaces:
- `crypto.ts` → `crypto-desktop.ts` (Stronghold instead of PBKDF2 + master key)
- `yapp-auth.ts` → `auth-desktop.ts` (no Y-app accounts)
- `instances.ts` → `instance-desktop.ts` (credentials from Stronghold, metadata in local SQLite)

`packages/desktop` imports shared components from `packages/frontend/src/`:
- All page components (Dashboard, Webmail, Messenger, Calendar, etc.)
- Sidebar, InstanceTabBar, widgets
- `lib/erpnext.ts` (ERPNext API helpers — use fetch, which the adapter rewrites)
- `lib/i18n.ts` (translations)

`packages/desktop` does NOT import (replaced by desktop equivalents):
- `lib/instances.ts` — fetch interceptor with `X-Y-App-Instance` header
- `App.tsx` — desktop has its own entry point with vault unlock flow
- `LoginPage.tsx`, `SignupPage.tsx` — replaced by VaultUnlock and FirstLaunch

---

## 3. Credential Storage — Tauri Stronghold

### Current state (web app) — credentials scattered across 4+ locations

| Credential | Where | Encrypted? |
|---|---|---|
| ERPNext passwords | SQLite `instance_credentials` | AES-256-GCM + PBKDF2 + master key |
| IMAP/SMTP passwords | Passed per-request, not persisted | N/A |
| NextCloud creds | Server env vars | No |
| NextCloud Talk creds | Browser `localStorage` | No (plaintext) |
| Telegram tokens | Browser `localStorage` | No (plaintext) |
| MS Teams email | Browser `localStorage` | No |
| OAuth2 refresh tokens | ERPNext `Email Account` doctype | ERPNext's responsibility |
| Password vault | Not implemented | N/A |

### Desktop app — all credentials consolidated into Stronghold

```
Desktop app launch
  +-- User enters vault password (or OS keychain auto-fills it)
       +-- Stronghold unlocks
            +-- ERPNext credentials (per instance)
            +-- IMAP/SMTP credentials (per instance)
            +-- NextCloud credentials (per instance)
            +-- NextCloud Talk credentials (per instance)
            +-- Telegram tokens (per instance)
            +-- OAuth2 refresh tokens (per instance)
            +-- Password vault entries
```

**Vault password convenience:**
- First launch: user creates a vault password
- Subsequent launches: user enters vault password to unlock
- Opt-in: store vault password in OS keychain (Windows Credential Manager / macOS Keychain / Linux Secret Service) for auto-unlock

**What stays in local SQLite (non-secret data):**
- Instance metadata (name, URL, theme color)
- Instance settings (activity types, module visibility)
- Meeting notes
- Cached stats data
- App preferences (migrated from `localStorage`)

### Employer/employee shared settings

Without a shared server, `instance_settings` cannot bridge users. Since both employer and employee connect to the same ERPNext instance:
- Module visibility: use ERPNext's built-in `Module Profile` feature
- Activity types: filter from ERPNext's `Activity Type` doctype directly
- Custom shared config (if needed later): store in ERPNext `Note` or `Custom DocType`
- v1: each desktop installation manages its own settings locally

### Security comparison

| Threat | Web app | Desktop app (Stronghold) |
|---|---|---|
| Database/vault file stolen | Encrypted (needs master key + user password) | Encrypted (needs vault password) |
| Machine accessed while app closed | Safe (server is remote) | Safe (Stronghold locked) |
| Machine accessed while app open | N/A (browser session) | Credentials in memory (same as any desktop app) |
| User forgets password | ERPNext creds unrecoverable | Vault unrecoverable (re-add instances manually) |
| Backup/migration | Not supported | Copy vault file + SQLite |

---

## 4. Node Sidecar Architecture

### Lifecycle

```
User launches Y-app.exe
  +-- Tauri main.rs starts
       +-- Pick random available port (49152-65535)
       +-- Read Stronghold vault (prompted or auto-unlocked via OS keychain)
       +-- Spawn Node sidecar: node desktop-server/dist/index.js --port=PORT
       +-- Pass credentials to sidecar via stdin (JSON blob)
       +-- Wait for health check: GET http://localhost:PORT/api/health/ping
       +-- Open webview: http://localhost:PORT
       +-- On app close: kill sidecar, cleanup
```

### What changes from web server to desktop server

| Concern | Web server | Desktop server |
|---|---|---|
| Listen address | `0.0.0.0:3000` (public) | `127.0.0.1:<random>` (loopback only) |
| Auth middleware | Y-app session cookie + master key unwrap | Vault unlocked at startup, credentials from Stronghold |
| Credential decryption | `crypto.ts` (PBKDF2 + master key) | `crypto-desktop.ts` (credentials received from Tauri via stdin) |
| Static files | Served by nginx | Express serves `packages/desktop/dist/` directly |
| CORS | Configured for production domain | Not needed (same-origin localhost) |
| Rate limiting | Per-IP brute force protection | Removed (local user, no attack surface) |
| Y-app account routes | `/api/yapp/*` | Removed |
| Instance routes | Full CRUD with encrypted storage | Adapted — credentials from Stronghold, metadata in SQLite |
| Everything else | As-is | As-is |

### Sidecar <-> Tauri communication

**Decrypt-and-pass model:**
1. At startup: Tauri reads Stronghold, extracts all credentials, passes to Node sidecar via stdin as JSON
2. Sidecar holds credentials in memory for the session lifetime
3. When user adds/edits/deletes an instance: sidecar calls a Tauri localhost endpoint to update Stronghold, Tauri responds with updated credential set
4. No ongoing IPC complexity — credentials loaded once, updated on mutation

---

## 5. Frontend Adapter Layer

### Fetch adapter

```
Web:     fetch("/api/resource/Project") -> https://y-app.impertio.app/api/resource/Project
Desktop: fetch("/api/resource/Project") -> http://localhost:PORT/api/resource/Project
```

The adapter intercepts `window.fetch` at startup and rewrites relative `/api/*` URLs to the sidecar's localhost address. The port is injected by Tauri into the webview as `window.__TAURI_PORT__`.

### Screen replacements

| Web app screen | Desktop equivalent |
|---|---|
| Login page (`/login`) | Vault unlock screen (enter vault password) |
| Signup page (`/signup`) | First-launch setup (create vault password, add first instance) |
| Instance manager (Settings) | Same UI, credentials go to Stronghold |

### Instance routing

The web app uses `X-Y-App-Instance` HTTP header on every request. The desktop adapter replaces this with a simpler mechanism: a `/api/desktop/set-active-instance` call to the sidecar. The sidecar tracks the active instance in-process — no per-request header needed.

### localStorage migration

The web app stores preferences in `localStorage` (`pref_{instanceId}_*`). The desktop app provides a `localStorage`-compatible API backed by SQLite for durability (webview `localStorage` can be cleared by OS or Tauri updates). Existing components don't need changes.

---

## 6. Phase Breakdown

### Phase 1 — Foundation

**Goal:** Can add ERPNext instances, switch tabs, browse documents.

- Tauri project setup (`packages/desktop` + `packages/desktop-server`)
- Move Tauri files from `packages/frontend/src-tauri/`
- Stronghold vault: create, unlock, lock, store/retrieve credentials
- Node sidecar lifecycle: spawn, health check, port management, shutdown
- Desktop server: localhost Express with Stronghold-backed credential access
- Decrypt-and-pass: Tauri reads Stronghold, passes to sidecar via stdin
- Vault unlock screen (replaces login/signup)
- First-launch setup flow
- Instance management: add/edit/delete ERPNext instances
- Fetch adapter: rewrite `/api/*` to `localhost:PORT`
- Active instance switching (tabs)
- ERPNext proxy: document CRUD + method calls through sidecar
- ERPNext session caching (reuse `instance-proxy.ts`)
- Basic window: titlebar, resize, minimize/close
- Remove `@tauri-apps/*` from `packages/frontend/package.json`
- Update `.github/workflows/release.yml` to reference new Tauri location

### Phase 2 — Dashboard & Core Pages

**Goal:** Daily ERP workflow usable.

- Import Dashboard widgets from frontend package
- Uren boeken widget (timesheet booking)
- Leave balance, missing hours widgets
- ERPNext document pages (Projects, Timesheets, Employees, etc.)
- Uren stats aggregation (reuse `/api/stats/uren` server logic)
- Employer/employee role-based view filtering (local settings)
- Sidebar with module filtering
- Global search (inline)

### Phase 3 — Communication

**Goal:** Email and chat functional.

- Webmail (IMAP/SMTP) — reuse `mail.ts`, credentials from Stronghold
- OAuth2 flow for Microsoft Graph (Tauri deep-link plugin for redirect URI)
- Email signature detection
- Email contacts
- Messenger: NextCloud Talk (reuse `messenger.ts`, credentials from Stronghold)
- Messenger: Telegram integration
- Messenger: batch loading + polling

### Phase 4 — Files, Calendar & Utilities

**Goal:** Full feature parity.

- NextCloud Files (WebDAV) — reuse `nextcloud.ts`, credentials from Stronghold
- Calendar: O365 + iCal (reuse existing routes)
- Meeting notes (reuse `meetings.ts`)
- Password vault (new feature — Stronghold as backend)
- Agent chat: Claude CLI (spawn directly)
- Terminal: WebSocket on localhost (reuse `terminal.ts`)
- Health diagnostics page

### Phase 5 — Desktop Polish

**Goal:** Production-ready desktop app.

- System tray with quick actions (book hours, mail count)
- Auto-update (Tauri updater plugin)
- Native notifications (new mail, new messages)
- Offline cache for recently viewed documents
- App icon and branding
- Installer configuration (.msi, .dmg, .AppImage)
- CI/CD: update `release.yml` for desktop builds
- localStorage-to-SQLite preference migration
- First-run onboarding flow polish

---

## 7. Build & Distribution

### Development

```bash
# Terminal 1: desktop server (hot reload)
cd packages/desktop-server && npm run dev

# Terminal 2: desktop frontend (Vite dev) + Tauri
cd packages/desktop && npx tauri dev
```

Tauri dev mode: webview points to Vite dev server (`localhost:5173`), sidecar runs independently.

### Production build

```bash
cd packages/desktop-server && npm run build    # TS -> JS
cd packages/desktop && npx tauri build         # Vite build + Rust compile + bundle sidecar
```

Output: `.msi` (Windows), `.dmg` (macOS), `.AppImage` (Linux)

### Sidecar bundling

Node.js runtime + `desktop-server/dist/` bundled as Tauri sidecar in `packages/desktop/src-tauri/binaries/`. Tauri's sidecar system handles platform-specific binary naming and extraction at install time.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Stronghold Node.js bindings immature | Primary: use Tauri Rust-side Stronghold (stable, official). Node sidecar receives credentials via stdin — never accesses Stronghold directly. If Tauri Stronghold plugin has issues, fall back to encrypted SQLite with vault-password-derived key (AES-256-GCM, same primitives as current `crypto.ts`). |
| Node sidecar adds ~80MB to binary | Acceptable for desktop ERP app; can optimize later with `pkg` or `sea` (Node single executable) |
| Shared component imports break on internal changes | Pin to specific exports; integration tests in desktop CI |
| OAuth2 redirect URI tricky in desktop | Tauri deep-link plugin handles custom protocol URIs (`y-app://oauth/callback`) |
| WebView2 not installed (old Windows 10) | Tauri installer bundles WebView2 bootstrapper; auto-installs on first launch |
| Mail module complexity (9000 LOC) | Reused as-is from `packages/server`; no rewrite needed |
