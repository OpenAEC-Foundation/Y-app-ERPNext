# Y-app

**Multi-tenant ERPNext workspace** for business owners and employees — built by the [OpenAEC Foundation](https://github.com/OpenAEC-Foundation).

Y-app is a hosted web application that combines ERPNext, email, chat, files, calendar, AI and more into a single workspace. One Y-app account, multiple ERPNext instances — separated into tabs, no browser tabs or context switching.

> **Production:** [https://y-app.impertio.app](https://y-app.impertio.app)

---

## How it works

1. **Create a Y-app account** with email + password (self-signup at `/signup`)
2. **Add ERPNext instances** — per instance: URL, name, color, username, password
3. **Switch between instances via in-app tabs** — each tab is fully isolated, with its own routing state, its own ERPNext session, its own cache
4. **Employer or Employee mode** per instance, via a dropdown in the top-left

Credentials are stored encrypted in a server-side SQLite vault. Nobody — not even the host — can reach the ERPNext credentials without the user's Y-app password.

---

## Features

### Communication & Collaboration

| Module | Description |
|--------|-------------|
| **Webmail** | Full IMAP/SMTP email client with caching, folder management, attachments, rich text editor, email templates and signatures. Supports password auth and Office 365 OAuth2 |
| **Messenger** | Multi-platform messaging via **NextCloud Talk**, **MS Teams** (Graph API), **Telegram** (Bot API). Unified conversation overview, reactions, unread counters |
| **Contacts** | Merged contact database from ERPNext and email history; company linking and alphabetical filtering |
| **Letters** | Document generation with templates (standard, quote, order confirmation, payment reminder, blank). Automatic company letterhead |
| **Meeting notes** | Local storage for minutes with agenda, reporting, action points, participants and deadlines. Linking to projects, quotes and leads |

### Projects & Task Management

| Module | Description |
|--------|-------------|
| **Projects** | Map view (Leaflet) with project locations; status tracking; task counts; shortcut to NAS project folder |
| **Tasks** | Full CRUD with status, priority, sorting and filtering; assignment per employee |
| **Subtasks** | Nested task structure |
| **Planning** | Gantt-style week / multi-week view with drag-and-drop; employee filter; priority colors; holiday integration |
| **Quotations** | Quote overview with filters and detail view |
| **Sales orders** | Order confirmations and order status |
| **Delivery notes** | Delivery status and customer linking |
| **Leads** | Lead management and qualification |
| **Todo** | Personal task list |

### HR & Personnel

| Module | Description |
|--------|-------------|
| **Employees** | Full personnel overview with photo, contact details, contract dates, department, leave allocation |
| **Holiday planning** | Leave requests and allocations in calendar view; overtime registration |
| **Expenses** | Submit and track expense claims |
| **Time tracking** | Time registration with project and activity linking; billable / non-billable; "Now" button; approval workflow |
| **Payroll** | Payroll tax and salary reports |

### Finance & Accounting

| Module | Description |
|--------|-------------|
| **Financial Dashboard** | Revenue charts per project / employee; billable %; delivery note statistics; top customers; monthly trends |
| **Revenue** | Monthly revenue trends with year-over-year comparison |
| **Sales Invoices** | Outstanding invoices with aging analysis (0-30, 31-60, 61-90, 90+ days); payment reminders by email |
| **Purchase Invoices** | Supplier invoices |
| **Outstanding** | Receivables analysis with payment terms |
| **Cost insight** | Cost analysis and trending |
| **General ledgers** | Chart of accounts and journal entries |
| **Bank transactions** | Bank statements and reconciliation |
| **Booking program** | Journal entry management |
| **VAT return** | Quarterly VAT calculation; tax accounts; journal entry linking |
| **Annual accounts** | Year-end closing |
| **Profitability** | Profitability per project and customer |
| **Liquidity planning** | Cash flow forecast |

### Files & Knowledge

| Module | Description |
|--------|-------------|
| **NextCloud Files** | WebDAV file browser; folder navigation; file preview; upload/download; share links |
| **Wiki** | Markdown knowledge base; search; publish/unpublish; rich rendering (code, lists, links) |

### Calendar & Planning

| Module | Description |
|--------|-------------|
| **Calendar** | Multi-source calendar: ERPNext events / tasks / leave / timesheets, iCalendar (ICS) feeds, Office 365 OAuth2. Month / week / day view. Jitsi video meeting generation |

### System & DevOps

| Module | Description |
|--------|-------------|
| **AI Agent** | Claude AI assistant with context about your ERPNext data; SSE streaming |
| **Terminal** | WebSocket shell access (PowerShell / bash) per active instance |
| **Health check** | Status monitoring per instance; IMAP / OAuth2 token validation; module configuration |
| **Global search** | Ctrl+K search across all ERPNext records of the active instance |
| **Instance management** | Self-service add / edit / delete instances via `/instances` |
| **Internationalization** | Full NL/EN support via react-i18next (1190+ keys) |

---

## Employer vs Employee mode

Per instance, the user can switch between two views via a dropdown in the top-left:

| Mode | Audience | Sidebar sections |
|------|----------|------------------|
| **Employer** | Owner / management | All modules: Projects, Finance, HR, Communication, System |
| **Employee** | Worker | Limited set: Projects/Tasks/Planning, Communication, HR (own leave/hours/expenses) |

The choice is persisted per instance (`localStorage`).

---

## Integrations

| System | Protocol | Used for |
|--------|----------|----------|
| **ERPNext** | REST API + Session bridge | All business data (projects, invoices, tasks, HR, etc.) |
| **Office 365** | OAuth2 + Graph API | Email (IMAP), Teams chat, Calendar |
| **NextCloud** | WebDAV + OCS API | Files, Talk (chat/video) |
| **Telegram** | Bot API | Chat messages |
| **Jitsi Meet** | URL generation | Video meetings from calendar |
| **Claude AI** | CLI spawning + SSE | AI assistant |
| **iCalendar** | ICS feeds | External calendars |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7, TailwindCSS 4, react-router-dom 7, react-i18next |
| Backend | Node.js 20+, Express 4, WebSocket (`ws`), better-sqlite3 |
| Auth | bcryptjs (12 rounds), HttpOnly cookies, AsyncLocalStorage per-request scoping |
| Encryption | AES-256-GCM, PBKDF2-SHA256 (210k iter), server-side master key (file mode 600) |
| Database | SQLite (WAL mode) — accounts, sessions, instances, encrypted credentials |
| Maps | Leaflet + react-leaflet |
| Terminal | xterm.js + WebSocket bridge per instance |
| Process | PM2 (production), tsx --watch (development) |
| Reverse proxy | nginx (TLS termination, WebSocket upgrade, static dist) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  React SPA · in-app tab bar · per-tab BrowserRouter remount  │
│  fetch interceptor → injects X-Y-App-Instance header         │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS
                ┌────────▼────────┐
                │      nginx      │  TLS, WebSocket upgrade
                └────────┬────────┘
                         │
        ┌────────────────▼───────────────────┐
        │       Express server (PM2)          │
        │                                     │
        │  /api/yapp/*    ← Y-app account     │
        │  /api/instances ← vault CRUD        │
        │  /api/* (legacy)← bridged auth ─┐   │
        │                                  │   │
        │  bridged authMiddleware          │   │
        │  ├─ reads y_app_session cookie   │   │
        │  ├─ reads X-Y-App-Instance hdr   │   │
        │  ├─ unwraps user key (master)    │   │
        │  ├─ decrypts vault credentials   │   │
        │  ├─ gets/creates ERPNext session │   │
        │  └─ AsyncLocalStorage scope ───────┐ │
        │                                    │ │
        │  WebSocket /ws/terminal?instance=  │ │
        └────────────────┬───────────────────┘ │
                         │                     │
                ┌────────▼────────┐            │
                │   SQLite (WAL)   │            │
                │  · y_app_users   │            │
                │  · y_app_sessions│            │
                │  · instances     │            │
                │  · instance_creds│ (AES-GCM)  │
                └─────────────────┘             │
                         ▲                      │
                         │ master.key (mode 600)│
                                                ▼
                                      ┌──────────────────┐
                                      │  ERPNext sites   │
                                      │  (per instance)  │
                                      └──────────────────┘
```

### Auth flow

1. **Signup**: `POST /api/yapp/signup` with email/password → bcrypt hash + PBKDF2 user key + session
2. **Login**: same, validates bcrypt hash, regenerates user key from password, stores wrapped user key in session row (wrapped with master key)
3. **Per request**: cookie → session → unwrap user key with master key → decrypt instance credentials → get or refresh ERPNext session
4. **Auto-retry on 401**: `erpFetch` and `proxyRequest` automatically refresh when ERPNext sessions expire

### Encryption

```
password ──bcrypt(12)──> hash (stored)
password ──PBKDF2(210k, salt)──> userKey (32 bytes, never stored)
userKey  ──AES-GCM──> wrapped(userKey)  (in session row)
masterKey ──AES-GCM──> wraps userKey (master.key, file mode 600)
userKey  ──AES-GCM──> encrypts ERPNext password per instance
```

Without **both** the user's Y-app password (session wrap) **and** the server-side master key (session unwrap), nobody can reach the ERPNext credentials.

---

## Quick Start (development)

```bash
# Install all workspaces
npm install

# Backend + frontend together
npm run dev:all

# Frontend only
npm run dev

# Backend only
npm run dev:server
```

Open [http://localhost:3500](http://localhost:3500) and sign up via the UI. Then add an ERPNext instance via **Instances** in the sidebar.

> The master key file is created automatically on first run if it doesn't exist — path: `~/.erpnext-level/master.key` (override via `YAPP_MASTER_KEY_PATH`).

---

## Project Structure

```
packages/
  frontend/                 React + Vite SPA
    src/
      App.tsx               Y-app auth flow, tab state, BrowserRouter remount
      pages/                40+ page components
      components/
        SignupPage.tsx      Y-app account signup
        LoginPage.tsx       Y-app login
        InstancesPage.tsx   Vault CRUD (add / edit / delete)
        InstanceTabBar.tsx  In-app tab bar + global controls
        InstanceBar.tsx     Per-instance company / employee filters
        Sidebar.tsx         View mode dropdown + module navigation
        TerminalPanel.tsx   xterm.js + WebSocket
        AgentPanel.tsx      Claude AI assistant
      lib/
        instances.ts        Active instance state + fetch interceptor
        DataContext.tsx     Per-tab data provider (cache, refresh)
        erpnext.ts          API client wrappers
        i18n/               nl + en translation bundles
    src-tauri/              Tauri configuration (legacy desktop builds)

  server/                   Express backend
    src/
      index.ts              API routes, WebSocket, static dist
      yapp-auth.ts          Y-app account signup / login / sessions
      auth.ts               Bridged authMiddleware (Y-app session → ERPNext)
      crypto.ts             AES-256-GCM, PBKDF2, master key wrapping
      db.ts                 SQLite schema + idempotent migrations
      instances.ts          Instance CRUD with credential encryption
      instance-proxy.ts     Per-instance ERPNext session cache (23h TTL)
      erpnext-client.ts     ERPNext HTTP client with AsyncLocalStorage scope
      mail.ts               IMAP/SMTP with OAuth2 + caching
      messenger.ts          NextCloud Talk, MS Teams, Telegram
      nextcloud.ts          WebDAV file operations
      agent.ts              Claude AI CLI spawning
      terminal.ts           WebSocket shell bridge
      meetings.ts           Meeting notes storage
      health.ts             System health monitoring

scripts/
  vps-setup.sh              One-time VPS provisioning (master key, ecosystem)

.github/workflows/
  ci.yml                    Lint + typecheck + build
  deploy-server.yml         SSH deploy to VPS via PM2
```

---

## Configuration

### Server environment

| Variable | Default | Description |
|---------|---------|-------------|
| `PORT` | `3500` | Backend server port |
| `ERPNEXT_LEVEL_CONFIG_DIR` | `~/.erpnext-level` | Data directory (sessions.db, master.key) |
| `ERPNEXT_LEVEL_DIST` | `../frontend/dist` | Frontend build directory |
| `YAPP_MASTER_KEY_PATH` | `<config_dir>/master.key` | Path to 32-byte master key file (mode 600) |
| `NODE_ENV` | — | `production` sets `Secure` flag on session cookie |

### Optional integrations

| Variable | Description |
|---------|-------------|
| `MAIL_HOST` / `MAIL_USER` / `MAIL_PASS` | Global IMAP fallback |
| `NEXTCLOUD_URL` / `NEXTCLOUD_USER` / `NEXTCLOUD_PASS` | NextCloud Files + Talk |
| `TELEGRAM_BOT_TOKEN` | Telegram messenger |
| `TEAMS_CLIENT_ID` / `TEAMS_CLIENT_SECRET` / `TEAMS_TENANT_ID` | MS Teams via Graph API |

---

## Production deployment

Y-app runs on a VPS behind nginx, managed by PM2. Deploys happen via GitHub Actions (`.github/workflows/deploy-server.yml`) on every push to `main`.

### One-time VPS setup

```bash
# On the VPS
sudo ./scripts/vps-setup.sh
```

This:
- Creates the `/opt/y-app/` directory structure
- Generates `/opt/y-app/secrets/master.key` (32 bytes, mode 600)
- Writes `/opt/y-app/ecosystem.config.cjs` for PM2
- Configures the nginx site (TLS via Certbot)

### Deploy flow

1. Push to `main` triggers `deploy-server.yml`
2. The workflow SSHes into the VPS, runs `git pull`, `npm install`, `npm run build`, `npm run build:server`
3. `pm2 reload y-app` restarts the server with zero downtime

### What to back up

- `/opt/y-app/data/sessions.db` — accounts, sessions, instances, encrypted credentials
- `/opt/y-app/secrets/master.key` — **critical**, without this all credentials are unreadable

---

## CI/CD

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push, PR | Lint + typecheck + build (frontend and server) |
| `deploy-server.yml` | push to `main` | SSH deploy to VPS via PM2 |
| `release.yml` | `v*` tag | (Legacy) Tauri desktop builds |

---

## License

Copyright [OpenAEC Foundation](https://github.com/OpenAEC-Foundation).
