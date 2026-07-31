# AGENTS.md

> **Read this first.** It is loaded into every Codex / AI assistant session that opens this repo. It tells you what Y-app is, what the load-bearing architectural decisions are, and which kinds of changes will silently break the product.
>
> If you are a human contributor: this file is also for you. Read it before your first PR.

For the full feature list, setup instructions, and deploy story, see [`README.md`](./README.md). For release history, see [`CHANGELOG.md`](./CHANGELOG.md). For current in-progress work, see [`STATUS.md`](./STATUS.md) — but do not rely on STATUS.md unless the user explicitly asks.

---

## Where things live (for future editors)

When you learn something new about Y-app, put it in the right file — keeping AGENTS.md stable is what makes it trustworthy to load into every session. If in doubt, default to CHANGELOG.md; only promote to AGENTS.md when it becomes a permanent architectural fact.

**This file (`AGENTS.md`)** — write here when the thing will still be true in six months:
- Product pillars (what Y-app is, what it isn't)
- Requests that would break the app ("do not do X")
- The mental-model diagram, threat model, auth flow
- File paths to read first
- Conventions (workspace, i18n, versioning, deploys, releases, secrets, git workflow)
- **Current** architectural decisions — living description of how the code looks **today**, with no version tags in section headings
- Dev-environment quirks that are part of the day-to-day (Z: drive symlinks, production-proxy env var)

**Do not** write here:
- "We changed X in v0.Y.Z" / "Session N did A" — that's changelog
- "Currently WIP on branch foo" — that's status
- Anything that starts with a version number in the heading — it'll rot the day after you ship

**`CHANGELOG.md`** — write here when you ship something:
- Per-release bullet points of user-visible changes, newest first
- Bug-fix + feature lists per tagged version
- Fine to reference internal file/function names for future archaeologists
- Append-only — never rewrite history entries
- Not loaded by Codex automatically; safe to be long

**`STATUS.md`** — write here when you're mid-work:
- What's in progress on which branch
- Recently landed commits that haven't been tagged yet
- Open questions / blocked tickets / pending client requests
- Known dev-environment quirks that are hitting us right now
- Reset this file whenever work lands on `main`; it's disposable

**Upgrade path when content ages:**
- WIP in STATUS.md → ships → moves to CHANGELOG.md, removed from STATUS.md
- An architectural decision in AGENTS.md becomes obsolete → replace in place (not "deprecated in v0.N") or, if it's really gone, delete and summarise the replacement
- A CHANGELOG entry becomes the norm → do **not** copy it to AGENTS.md. Only promote the *current* state description, not the history of how we got there

---

## What Y-app is — in 30 seconds

Y-app is a **multi-tenant ERPNext workspace**. One Y-app account, many ERPNext instances, all managed in browser tabs without ever leaving the page. The Y-app server holds each user's ERPNext credentials in an **encrypted vault** so the user never has to re-enter them — but neither the host nor a stolen database can read them, because decryption requires both the user's password AND a server-side master key.

The product's identity rests on five facts. Memorise these — every change you make should be compatible with all of them:

1. **It is a hosted web app**, not a desktop app. The user opens `https://y-app.impertio.app` in a browser. A Tauri desktop + Android build also exists under `packages/desktop/` and speaks to ERPNext directly via a Rust backend and a local Stronghold vault — but the web app at `packages/frontend/` + `packages/server/` is the primary deploy target.
2. **The server is essential** (for web). It owns the encrypted credential vault, the per-instance ERPNext session cache, the IMAP/SMTP/Teams/Telegram bridges, and the WebSocket terminal. You cannot move it into the browser.
3. **Multi-instance, not single-instance.** Every authenticated request carries an `X-Y-App-Instance` header; the middleware uses it to pick which encrypted credential bundle to decrypt. There is no "current ERPNext URL" global.
4. **Two-key encryption.** Credentials are wrapped by a key derived from the user's Y-app password (PBKDF2) AND a 32-byte master key stored on disk at mode 600. Losing either makes the data unrecoverable. Both must be present at runtime to read anything.
5. **Self-signup, no admin invites.** Anyone can create a Y-app account at `/signup`, then add their own ERPNext instances. There is no central admin onboarding flow.

If you can hold those five facts in your head, you understand the app.

---

## Requests that would break Y-app — STOP and push back

When a user (or a future you) asks for one of these, **do not silently start coding.** Explain which pillar it violates, ask if they really want to rewrite the product, and offer an alternative if there is one.

| Request | Why it breaks the app |
|---|---|
| *"I don't want a server, run everything in the browser/app."* | Kills the encrypted vault model for the web build — credentials would have to live in `localStorage`, where any XSS or browser extension can exfiltrate them. Also kills IMAP, SMTP, Teams Graph, NextCloud Talk, the WebSocket terminal, and the per-instance ERPNext session cache. The web product cannot be a thin client. The desktop/Android build already follows the "no server" model, but with a Stronghold-encrypted local vault — not a pattern that generalises to the browser. |
| *"Store ERPNext passwords in localStorage / IndexedDB / cookies."* | Same as above. The threat model in `packages/server/src/crypto.ts` (header comment) is explicit: DB stolen → creds remain encrypted. localStorage is browser-readable plaintext. |
| *"Hardcode the master key in the source / commit it to git."* | Defeats the entire two-key model. The master key is generated by `scripts/vps-setup.sh` and lives at `/opt/y-app/secrets/master.key` (mode 600), never in the repo. |
| *"Make it a single-instance app — drop the tabs and the X-Y-App-Instance header."* | Every server middleware, every fetch in the frontend, and the entire `instance_creds` table key off the instance ID. Removing it is a rewrite, not a refactor. There is a *legacy* single-instance fallback (`/api/auth/login`, gated on `ERPNEXT_URL`) that an operator can re-enable — that is the right escape hatch, not removing multi-instance. |
| *"Drop bcrypt / drop PBKDF2 / drop AES-GCM, just use plain hashes."* | The whole point of Y-app's positioning is that the host provider cannot read user credentials. Weakening the crypto invalidates the security claim in the README and on the marketing site. |
| *"Skip the server-side ERPNext session cache, hit ERPNext on every request."* | ERPNext login is slow. The 23-hour session cache in `packages/server/src/instance-proxy.ts` is what makes the UI feel snappy. Removing it makes the app unusable. |
| *"Move the SQLite to the browser (sql.js / OPFS)."* | SQLite holds the encrypted credentials, the Y-app account hashes, and the session table. None of those can live in the browser without breaking the threat model. |
| *"Replace Express with Next.js / serverless functions."* | Possible in principle, but: the WebSocket terminal, IMAP long polling, and the per-instance session cache all rely on a long-lived process. Serverless cold-starts would also wreck the cache. Treat this as a major rewrite, never as a "drop-in." |
| *"Strip out i18n / hardcode English."* | The primary user base is Dutch (NL is the default locale). Removing i18n breaks production users on day one. |
| *"Add an admin panel that can read other users' instances."* | Architecturally impossible without giving the admin every user's Y-app password. If anyone proposes this, the answer is "no, by design." |
| *"Bypass the deploy workflow and edit files directly on the VPS."* | The GitHub Actions workflow (`.github/workflows/deploy-server.yml`) is the only path that produces a reproducible build. Direct edits will be overwritten the next time the workflow is run. |
| *"Load extension code at runtime from a URL."* | The extension system is deliberately **compile-time only** (see Extensions section below). Remote code execution in a credential vault is a non-starter. |

If you are unsure whether a request crosses one of these lines, **stop and ask the user before changing code.** It is much cheaper to clarify than to undo.

---

## Mental model — how the pieces fit

```
Browser (React 19, Vite, react-router 7)
  └─ fetch interceptor injects  X-Y-App-Instance: <id>
       │
       ▼
nginx → Express server (PM2)
  ├─ /api/yapp/*       Y-app accounts (signup, login, sessions)
  ├─ /api/instances    encrypted vault CRUD
  ├─ /api/*            bridged → ERPNext (uses cached session)
  └─ /ws/terminal      xterm.js bridge
       │
       ▼
SQLite (WAL)                   master.key (file, mode 600)
  · y_app_users                       │
  · y_app_sessions                    │ wraps user keys at login
  · instances                         │
  · instance_creds  (AES-256-GCM) ◄───┘
  · instance_settings (employer→employee shared config)
       │
       ▼
ERPNext sites (one per instance, session cached 23h)
```

Authoritative diagrams + the full auth flow live in [`README.md`](./README.md#architecture). The threat model lives in the header comment of [`packages/server/src/crypto.ts`](./packages/server/src/crypto.ts) — re-read it before touching anything crypto-adjacent.

---

## Where to look first

Before changing anything substantial, read these in this order:

1. [`README.md`](./README.md) — feature list, deploy story, env vars
2. [`packages/server/src/crypto.ts`](./packages/server/src/crypto.ts) — threat model in the header comment; obey it
3. [`packages/server/src/auth.ts`](./packages/server/src/auth.ts) — bridged middleware (Y-app session → ERPNext)
4. [`packages/server/src/instances.ts`](./packages/server/src/instances.ts) — vault CRUD with encryption
5. [`packages/server/src/instance-proxy.ts`](./packages/server/src/instance-proxy.ts) — per-instance session cache
6. [`packages/frontend/src/App.tsx`](./packages/frontend/src/App.tsx) — tab state + per-tab BrowserRouter remount
7. [`packages/frontend/src/lib/instances.ts`](./packages/frontend/src/lib/instances.ts) — fetch interceptor that injects the instance header

If you are touching auth, encryption, or the vault, **also re-read the auth flow section of the README** before writing code.

---

## Conventions

- **Workspace:** npm workspaces monorepo. Run scripts from the root (`npm run dev`, `npm run dev:server`, `npm run dev:all`).
- **Languages:** TypeScript everywhere. Frontend is React 19 functional components + hooks; server is plain TS on top of Express.
- **i18n:** Every user-facing string goes through `react-i18next`. NL and EN bundles must stay in sync — if you add a key to `en.json`, add it to `nl.json` in the same commit. `de.json` also exists and should be kept in sync where feasible.
- **Versioning:** Four manifests must all carry the same version: `package.json`, `packages/frontend/package.json`, `packages/server/package.json`, `packages/desktop/src-tauri/tauri.conf.json`. `lib/version.ts` is auto-derived from `packages/frontend/package.json` via Vite `define` — do not hardcode there.
- **Release notes:** Every version bump MUST also add a new entry at the top of `LOCAL_RELEASES` in `packages/frontend/src/pages/ReleaseNotes.tsx` (the `/release-notes` page). Notes are written in **NL**, grouped by sections (`Toegevoegd` / `Verbeterd` / `Opgelost` / topic-specific titles), each version capped at roughly two screens of the rendered card. Source the bullets from `CHANGELOG.md` (or, for the just-shipped version, from the merge commits since the previous tag) and condense — do not paste the full changelog. The GitHub fetch in that file is a fallback path; the local array is what users actually see, so it has to be kept in sync with every release.
- **Deploys:** Manual — run `.github/workflows/deploy-server.yml` from the Actions tab (`workflow_dispatch`). Builds, scp's, and `pm2 restart`s the VPS. Pushing to `main` does **not** auto-deploy.
- **Releases:** Manual — run `.github/workflows/release.yml` from the Actions tab with a version input (e.g. `v0.12.0`). Builds Windows (Azure Trusted Signing), macOS, Linux, Android APK, server bundle. Tagging `v*` does **not** auto-release. Android signing requires the `ANDROID_KEYSTORE_B64` / `ANDROID_KEYSTORE_PASS` / `ANDROID_KEY_ALIAS` repo secrets so every build shares a stable signing key.
- **Secrets:** Never commit. `.gitignore` excludes `.env*`, `*.enc`, `*.kdbx`, `vault*`, `credentials*`. The master key is created on the VPS by `scripts/vps-setup.sh`.
- **Git workflow:** Never push without asking the user first. Always work on a branch and sync with `main` regularly (`git fetch && git rebase origin/main`) so branches don't drift.

---

## Architectural decisions

These are current, load-bearing design choices. Changing any of them means rewriting a chunk of the app. Dated version numbers are intentionally omitted — if it's listed here, it's what the code looks like today.

### Unified employer/employee views

The sidebar, dashboard, and page tabs use a **single definition** with `visibility` flags instead of separate employer/employee code paths.

- **Sidebar:** One `getSections()` function with `visibility?: "all" | "employer" | "employee"` on items and sections. No `EMPLOYEE_PAGES` set, no `getEmployeeSections()`. Filtering happens in the render pipeline alongside role-based and module-config filtering.
- **Dashboard widgets:** One `ALL_WIDGET_DEFS` array with `visibility` per widget. No separate `EMPLOYER_WIDGETS`/`EMPLOYEE_WIDGETS`.
- **Page tabs:** Employer-only tabs (e.g. Timesheets "goedkeuren") use `viewMode === "employer"` guards. Tabs visible to all rely on ERPNext user permissions for data scoping.

### Global search — inline, no popup

Global search lives **inline in the sidebar** (`InlineSearch.tsx`), not as a modal overlay. Typing 2+ chars shows a dropdown with results. `Ctrl+K` focuses the input via a `y-app:focus-search` custom event. The old `GlobalSearch.tsx` modal component is unused.

### Email settings — single location

IMAP/email configuration lives **only in Webmail** (`ImapSetup` component with OAuth2, auto-config, and a close button). The Settings general tab shows a redirect link to Webmail. Do not re-add IMAP fields to Settings.

### Mail folder management

`FolderTree` in Webmail supports:
- **Hidden folders** — stored in `pref_${instanceId}_hidden_mail_folders` (localStorage). Defaults: Calendar, Contacts, Conversation History, Journal, Notes, Tasks. User can toggle any folder via a gear icon.
- **Favorite folders** — stored in `pref_${instanceId}_favorite_mail_folders`. Star icon on each folder. Favorites render in a flat section above the tree.

### Instance settings (server-side shared config)

The `instance_settings` table in SQLite stores key-value settings per instance, used for employer→employee configuration sharing.

- **API:** `GET/PUT /api/instances/:id/settings/:key` (per-instance), `GET /api/user-settings/:key` (resolves across all user's instances)
- **Current keys:** `activity-types`, `employee-activity-types`, `employee-visible-modules`, `project-template-mapping`, `enabled-extensions`
- **Settings UI:** "Medewerker instellingen" tab in Settings (employer-only), "Project instellingen" tab, "Extensions" tab.

### Module filter location

The sidebar module filter input is positioned **below the navigation** (near Settings), not at the top. The top area is reserved for the inline global search.

### ERPNext static-asset proxy

ERPNext images and stylesheets (`/files/...`, `/private/files/...`, `/assets/...`) are loaded through the **Y-app server**, not directly from the browser to ERPNext. Endpoint: `GET /api/erpnext-asset?instance=<id>&path=...`. Why:

- Browsers cannot send the ERPNext session cookie cross-origin, so `/private/files/` would always 403 with a direct load.
- Many ERPNext deploys are behind a private network; only the Y-app server can reach them.
- Iframes with `srcdoc` get a null origin, so requests to ERPNext that depend on cookies wouldn't carry them.

**How to use:**
- Server-rendered HTML (e.g. `/api/printview-html`) is post-processed by `rewriteErpnextAssetUrls()` in `packages/server/src/index.ts` which swaps `src=`, `href=` and CSS `url(...)` references to the proxy endpoint.
- Frontend code that displays ERPNext-hosted images inside `srcDoc` iframes must inject `<base href="${window.location.origin}/">` so absolute `/api/...` paths resolve to Y-app's origin instead of `about:srcdoc`. See `fetchPrintPreviewHtml()` for the pattern.
- Mail-recipient-facing HTML (the actual outgoing email body) must keep absolute ERPNext URLs — recipients' mail clients can't reach Y-app's proxy. `SendInvoiceModal` splits the signature into `signaturePreviewHtml` (proxy URLs) vs `signatureForRecipient` (absolute URLs) for exactly this reason.

**Path whitelist enforced by the endpoint:** only `/files/`, `/private/files/`, `/assets/` prefixes accepted. `..`, `?`, and `#` in the path are rejected to prevent query-string smuggling into ERPNext's general API surface.

The endpoint authenticates via the standard `y_app_session` cookie and reads the instance from the **query parameter** (not the `X-Y-App-Instance` header) because plain `<img>` tag loads cannot carry custom headers.

**Belangrijk: `/api/erpnext-asset` MOET in de auth-whitelist van [packages/server/src/index.ts](packages/server/src/index.ts).** De globale `app.use("/api", authMiddleware)` middleware dwingt de `X-Y-App-Instance` header af voor élke andere `/api/*` route. Img-tags in iframes kunnen die header niet sturen — alleen de cookie + query param. Vergeet je de whitelist-entry, dan retourneert élke letterhead/footer/signature-img een 401 `missing_instance` en verschijnen alle logo's gebroken in factuur-preview én outgoing email. Dit is een gat dat eerder is dichtgevallen tussen "endpoint doet eigen auth" en "globale middleware kwam later", zie commit-history.

### Extensions — opt-in per-instance pages

Y-app supports **extensions**: optional sidebar pages that ship in every build but only appear for instances that explicitly opt in. Use case: a customer wants a custom planner / dashboard / reporting view that the rest of the customer base does not want to see. No forks, no runtime plugin loading — same binary for everyone, per-instance toggle.

**Directory layout:** `packages/frontend/src/extensions/`
- `types.ts` — `ExtensionManifest` contract (id, labelKey, icon, routePath, sidebarSection, visibility, Page)
- `registry.ts` — the single array of all extensions; every extension must be imported here
- `enabled.ts` — `fetchEnabledExtensions`, `saveEnabledExtensions`, `useEnabledExtensions()` hook. Persists under `enabled-extensions` key in the existing `instance_settings` table; cached in localStorage per instance for instant sidebar render
- `<extension-name>/manifest.ts` — declares the extension
- `<extension-name>/Page.tsx` — the React page rendered at `/x/<id>`

**To add an extension:**
1. `mkdir packages/frontend/src/extensions/<name>/`
2. Copy `example-planner/manifest.ts` and `example-planner/Page.tsx` as a starting point
3. Give it a unique `id` (never change this after release — it is the enablement key)
4. Pick a `sidebarSection` matching an existing sidebar section title (or `""` for top-level)
5. Import and add to the `EXTENSIONS` array in `registry.ts`

**How it renders:**
- `App.tsx` auto-mounts `<Route path="/x/<id>" element={<ext.Page />} />` for every entry in `EXTENSIONS` — routes are always mounted
- `Sidebar.tsx` injects enabled extensions into their declared `sidebarSection` after the section's regular items, filtered by `useEnabledExtensions()` and `viewMode`
- Disabled extensions are simply not rendered in the sidebar; deep-linking to a disabled extension still loads the page but the user won't find it via UI

**How employers enable it:**
Settings → **Extensions** tab (employer-only) → tick the extensions they want for this instance. The `ExtensionsPanel` in `Settings.tsx` reads/writes `enabled-extensions` via the existing `/api/instances/:id/settings/:key` endpoints.

**Do not** be tempted to load extension code at runtime from a URL. That introduces XSS / credential-theft risks we explicitly don't accept — see the "Requests that would break Y-app" table above.

### Popout tabs (`/mail/view`, `/messenger/view`) — drie dingen die mee MOETEN in de URL

Popout-tabs draaien OUTSIDE de normale `AuthenticatedApp` render in [App.tsx](packages/frontend/src/App.tsx). Ze zijn dus niet gewoon "een tweede webmail in een nieuw tabblad" — ze missen alle state die de hoofd-app via `setActiveInstance()` en mail-config-push opbouwt. Drie velden moeten daarom expliciet in de popout-URL meegegeven worden, anders bombardeert de server elke `/api/mail/*` call met **HTTP 400**:

1. **`instance=<id>`** — zonder dit zet de fetch-interceptor in [lib/instances.ts](packages/frontend/src/lib/instances.ts) géén `X-Y-App-Instance` header (`activeInstance` is `null` in de popout-tab). `App.tsx` heeft `hydratePopoutActiveInstance()` die de param leest en `setActiveInstance(...)` aanroept vóór render.
2. **`email=<user@host>`** — server's `getCredentials()` in [packages/server/src/mail.ts](packages/server/src/mail.ts) heeft minstens een `email=` (of `acct=`) nodig om IMAP-creds te resolven via de ERPNext-fallback wanneer er nog geen cached `mailSession` is voor deze `(yAppSid, instanceId)`. Webmail's normale `buildQuery` zet dit altijd; de popout moet het expliciet meesturen.
3. **`acct=<shared-mailbox-email>`** — alleen als de bron-tab op een gedeelde mailbox stond. Zonder dit valt de popout terug op de primaire mailbox van de gebruiker.

Build-volgorde in [Webmail.tsx](packages/frontend/src/pages/Webmail.tsx) onDoubleClick:
```ts
const params = new URLSearchParams();
params.set("uid", String(msg.uid));
params.set("folder", msg._folder || activeFolder);
if (activeAcct) params.set("acct", activeAcct);
if (activeConfig?.user) params.set("email", activeConfig.user);
const instId = getActiveInstanceId();
if (instId && instId !== "default") params.set("instance", instId);
window.open(`/mail/view?${params.toString()}`, "_blank", "noopener");
```

Voor messenger geldt hetzelfde: [Messenger.tsx](packages/frontend/src/pages/Messenger.tsx) onDoubleClick op een conversatie-rij voegt `instance` toe aan de `/messenger/view?...` URL.

**Single- vs double-click discriminatie:** de mail-rij in Webmail heeft zowel een `onClick` (preview-paneel) als `onDoubleClick` (popout). Zonder timer rent `openMessage` direct, zet `loadingMsg=true` → button raakt disabled → tweede klik wordt nooit als dblclick gedetecteerd. Daarom een `mailClickTimer` ref die de single-click 250ms uitstelt zodat de dblclick 'm kan annuleren. Het `disabled={loadingMsg}` attribuut is bewust van de rij-button afgehaald.

---

### Real-time push: IMAP IDLE + NC Talk long-poll + WS-events

Y-app pushed nieuwe mail en chat-berichten naar de browser binnen ~1-2s, zonder polling. Drie samenwerkende lagen:

**1. Server ↔ mailserver / NC Talk:**
- **IMAP IDLE** — per `MailAccountCache` in [`packages/server/src/mail.ts`](packages/server/src/mail.ts) draait een dedicated ImapFlow-client in IDLE-mode op INBOX (separate connection van de fetch-client, omdat IDLE blokkeert). EXISTS / EXPUNGE / FLAGS events vuren listeners die naar `ws-events.broadcast(...)` gaan. IDLE-loop restart elke 25 min (RFC 2177 vereist re-issue binnen 29 min). IDLE start on-demand via `registerIdleListener(yAppSid, instanceId)`.
- **NC Talk long-poll** — [`packages/server/src/messenger-longpoll.ts`](packages/server/src/messenger-longpoll.ts) houdt per (yAppSid, instanceId, conversation) een `lookIntoFuture=1` connectie open met NC Talk. Bij nieuwe berichten: broadcast naar WS, daarna direct opnieuw long-poll. Idle = 0 bytes; 30s timeout, max 1 connection per geabonneerde conversatie.

**2. Server ↔ browser:**
- **`/ws/events` WebSocket endpoint** — [`packages/server/src/ws-events.ts`](packages/server/src/ws-events.ts). Auth via `y_app_session` cookie + `?instance=NN` query. EventBus broadcast naar alle clients van een (yAppSid, instanceId)-paar. Heartbeat ping elke 25s tegen Vite/nginx idle-timeout.
- **Cruciaal: `noServer: true` pattern voor meerdere WSS.** [`packages/server/src/index.ts`](packages/server/src/index.ts) heeft twee `WebSocketServer` instances (`/ws/events` + `/ws/terminal`). Beide MOETEN `noServer: true` zijn met handmatige upgrade-routing in één `server.on("upgrade", ...)` handler — anders steelt de eerste WSS upgrade-events van de tweede en sluit ze met code 1006 vlak na connect.

**3. Browser:**
- **`BackgroundSyncProvider`** — [`packages/frontend/src/lib/BackgroundSyncProvider.tsx`](packages/frontend/src/lib/BackgroundSyncProvider.tsx) opent `wss://.../ws/events`, luistert op `mail-changed` / `messenger-changed`, triggert lichtgewicht refetch (`/api/mail/unseen-summary` of `/api/messenger/conversations`) om sidebar-badges bij te werken.
- **Push-refresh event-bus**: bij elke `mail-changed` / `messenger-changed` dispatcht BackgroundSyncProvider óók een `window.dispatchEvent(new CustomEvent('y-app:mail-changed'))` (idem voor messenger). `Webmail.tsx` heeft een listener die `loadMessages(activeFolder, true)` aanroept — zonder dit zou alleen folder.unseen-badge updaten en zou de message-lijst zelf stale blijven tot F5 of folder-switch.
- Wanneer push-events actief zijn, downscalen de fallback-pollers naar 5 min (sanity-only). Bij WS-disconnect (1006 etc.) reconnect na 5s en re-subscribe alle conversation-subs.
- React Context `useBackgroundSync()` exposeert `subscribeConversation(convId, ncCreds)` / `unsubscribeConversation(convId)` — gebruikt door `Messenger.tsx` bij conversation-switch.

**IMAP IDLE-start**: via WS-message `subscribe-mail` met primary email, server start IDLE proactief zonder dat de gebruiker eerst op Webmail hoeft te klikken (v0.21+).

**Skipped:** Microsoft Graph webhooks (zou écht real-time pushen zelfs zonder Y-app open, maar vereist Azure AD app-registration + ngrok / public webhook URL + Service Worker + VAPID — te zwaar voor de winst boven IDLE).

### Mail-list & conversation cache: 3 lagen + mark-read TTL-Set

Webmail en Messenger gebruiken **drie cache-lagen** voor mail/messages, plus een **persistent mark-read tracker** tegen de IMAP `\Seen` STORE-race. Server is uiteindelijke bron-van-waarheid.

**Lagen** (gerangschikt van snelst naar betrouwbaarst):

1. **`folderMsgCache` / `messagesCacheRef`** — in-memory `Map`, module-level (overleeft Webmail/Messenger remount). 30-60 s TTL. Wordt direct getoond bij tab-switch zodat de lijst niet kort leeg gaat.
2. **localStorage** — keys `webmail_msglist_cache_${instanceId}_${acct}_${folder}` (mail) en `messenger_msgs_${instanceId}_${convId}` (Talk). LRU-cap **50 folders** / **30 conversations**. Bevat **RAW server-msgs** (geen optimistic-mark-read-flags). Overleeft browser-restart en Vite hot-reload. Zie helpers in [`packages/frontend/src/pages/Webmail.tsx`](packages/frontend/src/pages/Webmail.tsx) en [`packages/frontend/src/pages/Messenger.tsx`](packages/frontend/src/pages/Messenger.tsx).
3. **Server** — gezaghebbend. Bij elke `loadMessages` doet de browser een fresh fetch en overschrijft beide caches met server-data (gemoduleerd door de TTL-Set, zie hieronder).

**Mark-read TTL-Set** — `recentLocallyMarkedRead: Map<\`folder:uid\`, timestamp>` in `Webmail.tsx`, persistent in localStorage onder key `webmail_recent_mark_read`. **60 s TTL.** Lost de race op tussen optimistische mark-read en IMAP `\Seen` STORE-propagatie:

- **Probleem**: server STORE is fire-and-forget; de volgende `fetchMessages` kan binnen 1-2 s nog `seen=false` retourneren voor een net-gemarkeerde mail → die mail zou kort terug naar BOLD flippen bij F5, tab-switch of `mail-changed` push-event.
- **Oplossing**: bij elke mark-read registreert `applyOptimisticReadFlag` de uid in de TTL-Set. De helper `applyRecentReadOverlay(msgs, folder)` forceert `seen=true` voor uids die binnen de 60-s window zitten, op **alle vier message-laad-paden**: hydrate-useEffect, mount-init parallel-fetch, `loadMessages`, en de `switchFolder` cache-hit pad. `applyRecentReadOverlayToFolders` doet hetzelfde voor `folder.unseen` zodat sidebar-badge en panel-header consistent zijn.
- **Na 60 s** vervalt de entry → server-truth wint. Cruciaal voor scenarios waar een andere client (Outlook desktop) een mail terug op unread zet, of nieuwe mails arriveren.

**Sidebar-badge "Email" telt alleen INBOX** — `shouldCountForBadge` filtert subfolders weg zodat de Email-badge in de sidebar exact gelijk is aan de INBOX-folder-badge in de mail-folder-tree. Submap-unseen-counts zijn wel zichtbaar in de folder-tree zelf.

**Niet doen**: lokale `seen=true` *persistent* naar localStorage schrijven. Doet de race langer aanhouden en is incompatibel met externe mark-as-unread (Outlook). Beperk de overlay strict tot de TTL-Set.

### Frontend fetch-dedup

[`packages/frontend/src/lib/instances.ts`](packages/frontend/src/lib/instances.ts) `installFetchInterceptor` voegt naast de `X-Y-App-Instance` header een **in-flight dedup-wrapper** toe voor GET `/api/*` requests. Met dezelfde `(instanceId, url)`-key delen concurrent callers één pending Promise; elk krijgt een `response.clone()`. 100 ms grace-window waarin volgende callers ook dedupen, daarna wordt de entry geëvict.

Voorkomt dat React StrictMode double-mounts of dubbele useEffect-fires twee identieke server-calls genereren. Vooral relevant bij Webmail-mount waar `/api/yapp/me`, `/api/auth/me`, `/api/instances/<id>/mail-accounts` historisch 2× werden gefired.

### IMAP-connection lifecycle: 30 min + 24 u splitsing

[`MailAccountCache`](packages/server/src/mail.ts) heeft twee timers voor inactiviteit:

- **`CONNECTION_TIMEOUT = 30 * 60_000`** — sluit het IMAP-socket bij geen activiteit. Reden: NAT-routers / Cloudflare killen idle TCP na 5-30 min; O365 heeft max concurrent IMAP-connections per account; en OAuth-tokens hebben 1 u TTL. `destroy()` sluit de socket maar **bewaart de in-memory caches** (`folders`, `folderMessages`, `fullMessages`, `attachmentCache`) zodat de eerste klik na re-connect instant is.
- **`CACHE_LIFETIME = 24 * 60 * 60_000`** — pas na 24 u stilte wordt de hele `MailAccountCache` ook uit `accountCaches` verwijderd en zijn alle in-memory caches leeg. Voorkomt unbounded growth bij gebruikers die shared mailboxes toevoegen / verwijderen of meerdere instances roteren.

Practisch: laptop dichtklappen tussen lunch en daarna kost **0 s** herverbinding voor de gebruiker (alleen IMAP-socket reconnect ~1-2 s; alle data nog in geheugen). Pas na een volledige dag uitloggen wordt alles cold.

### Mail-acties met delete-confirm + toast-feedback

- **Verwijderen** in INBOX of submappen: backend doet **soft-delete naar Verwijderde items** zonder confirm-popup (Outlook-stijl). Recovery via Verwijderde items zelf.
- **Verwijderen** binnen Verwijderde items (`f.specialUse === "\\Trash"` of naam matched `verwijderde|deleted|prullenbak|trash`): JS `window.confirm` met `t("webmail.confirm_permanent_delete")`. Permanente IMAP-delete.
- Bij delete/move-failure (server-fout, network-drop): `setToast(t("webmail.delete_failed"))` / `"webmail.move_failed"`. Was eerder een silent `.catch(() => {})` zonder gebruikersfeedback.

---

### Desktop / Android builds

`packages/desktop/` is a Tauri 2 app that bundles the shared frontend (via the `@frontend` alias) and replaces the Express server with a Rust backend that talks to ERPNext directly. The user's vault password unlocks a **Stronghold** file (`vault.hold`) holding ERPNext credentials per instance.

Key decisions specific to this build:
- No Y-app account. The Stronghold password replaces it. "Sign out" in the account dropdown actually locks the vault (`localVaultMode` flag on `InstanceTabBar`).
- No server-side session cache. A `DashMap<instance_id, Session>` in `erpnext.rs` caches ERPNext sessions per-instance in memory for 4 hours.
- Android auto-backup is disabled at build time so Google's D2D transfer can't restore `vault.hold` without its matching `stronghold-salt.txt` (would trigger `BadFileKey`). See the `Patch AndroidManifest.xml` step in `release.yml`.
- Android APK signing uses a **stable keystore** decoded from `ANDROID_KEYSTORE_B64` secret. Do not revert to the throwaway `keytool -genkeypair` pattern or users can't update in place.
- Biometric unlock on Android: opt-in. `tauri-plugin-biometric` provides the prompt; vault password is stored as plain bytes in app-private storage (not readable by other apps without root). The opt-in modal makes the "casual physical access" threat model explicit.

---

## Dev environment notes

### Full-stack dev: lokale server + lokale frontend (test ALLE wijzigingen, ook server-side)

Wanneer je server-side code aanpast (in `packages/server/src/`), zie je die wijzigingen NIET door alleen Vite te starten met `VITE_API_TARGET` op productie. De productie-server draait dan nog de oude code. Voor volledige testbaarheid van zowel frontend- als server-wijzigingen in dev:

**Stap 1 — Lokale server starten (port 3500):**
```powershell
cd "packages\server"
npm run dev
```
Voorwaarden:
- `packages/server/node_modules/` is gevuld (`npm install` ooit gelopen)
- `packages/server/.env` bestaat met master-key + DB-pad
- Port 3500 is vrij. Als bezet: `Get-NetTCPConnection -LocalPort 3500 -State Listen` om de PID te vinden en killen.

**Stap 2 — Vite starten ZONDER `VITE_API_TARGET` zodat het proxyt naar localhost:3500:**
```powershell
cd "packages\frontend"
Remove-Item -ErrorAction SilentlyContinue Env:VITE_API_TARGET
npx vite --port 5173 --strictPort
```
Of in een verse PowerShell (waar de env var sowieso niet gezet is):
```powershell
cd "packages\frontend"
npx vite --port 5173 --strictPort
```

**Wat werkt hierdoor in dev:**
- IMAP (mail) — outlook.office365.com en andere publieke IMAP-servers zijn bereikbaar vanaf jouw dev-machine.
- ERPNext-asset proxy (logo's, signatures) — ERPNext is via instance-config bereikbaar.
- Mail badges + read-flag merge — alle frontend + server-side fixes uit deze branch worden actief.
- IMAP timeout-instellingen, `foldersTs` invalidatie, alle andere `mail.ts` wijzigingen.

**Wat NIET werkt in volledige dev-mode (lokale server):**
- Productie-data zoals open Y-app accounts. Lokale server heeft een eigen SQLite (`~/.erpnext-level/sessions.db`) — eerste keer moet je opnieuw inloggen op de instances die je wilt testen.

**NextCloud Talk werkt nu wel lokaal (geüpdatet 2026-05-21).** Eerder werd hier vermeld dat dev de NC-server niet kon bereiken. Dat klopt niet meer:
- Localhost server (port 3500) blijkt `https://nextcloud.3bm.cloud` gewoon te kunnen bereiken via NC's Talk REST-API (`/ocs/v2.php/apps/spreed/...`).
- Conditioneel: er moeten **NC-creds in localStorage** staan onder `pref_${instanceId}_messenger_nextcloud-talk_{url,user,pass}` (zet je in Y-app Settings → Berichten → NextCloud Talk → Test verbinding).
- Frontend stuurt deze creds bij elke WS-open via `subscribe-messenger` (Wave 0a fix); server cached ze per (yAppSid, instanceId) en alle `/api/messenger/*` calls gebruiken de cache.
- Playwright kan dus messenger end-to-end testen tegen `http://localhost:5173/messenger` — gemeten in deze sessie: `/api/messenger/all-conversations?` retourneert 200 in 40-270ms zonder creds in URL, conversaties laden, mark-read werkt optimistisch.

**Wanneer welke modus (geüpdatet):**
| Test-scope | Server-modus |
|------------|--------------|
| Alleen frontend (UI-component, badge, lightbox, popout-handlers) | `VITE_API_TARGET=https://y-app.impertio.app` (productie-server) |
| Server-side mail/IMAP/Talk wijzigingen | Lokale server + Vite zonder env var (Talk werkt nu ook) |
| Volledige integratietest na deploy | Productie-server proxy |

---

### Windows: running the frontend against production API (live data dev mode)

Set `VITE_API_TARGET` before starting Vite to proxy `/api/*` to the production server instead of a local one:
```powershell
cd "packages\frontend"
$env:VITE_API_TARGET="https://y-app.impertio.app"
npx vite --port 5173 --strictPort
```
Default is `http://localhost:3500` — unchanged workflow for anyone who doesn't set the var.

**Wat werkt hierdoor in dev:**
- **Email (IMAP) live** — productie-server houdt verbinding met IMAP, frontend ziet jouw echte mailbox.
- **Messenger (NextCloud Talk) live** — zelfde mechanisme, productie-server praat met NC Talk. Geen aparte test-env nodig.
- **Hot-reload op frontend** — edit een `.tsx`, browser refresht binnen seconden.
- **Auth automatisch** — Y-app session cookie van een eerdere browser-login werkt cross-tab; pas evt. `npx vite --strictPort` aan zodat port 5173 stabiel blijft.

**Beperkingen:**
- Server-side wijzigingen (in `packages/server/src/`) zie je niet — productie-server draait zijn eigen gebuilde versie. Voor server-changes is een aparte tunnel of staging nodig (SSH-tunnel naar VPS staat in `STATUS.md` wanneer in opzet).
- _(NextCloud Talk werkte eerder niet lokaal — dit is achterhaald sinds 2026-05-21. NC Talk is wel bereikbaar vanaf lokaal als de creds in localStorage staan; zie sectie "NextCloud Talk werkt nu wel lokaal" hierboven.)_

**Port-conflict:** als `npx vite` zegt "Port 5173 is in use, trying another one...", check `Get-NetTCPConnection -LocalPort 5173` voor een vergeten Node-proces. `--strictPort` faalt hard ipv door te schuiven naar een andere poort.

### npm install op Z: drive (mapped/netwerk drive)

npm workspaces gebruiken symlinks. **Symlinks werken niet op een mapped/netwerk drive** (Z:). Dit betekent:
- `npm install` vanuit de root **faalt** altijd met `UNKNOWN: unknown error, symlink`.
- Workaround: installeer per package apart: `cd packages/frontend && npm install --legacy-peer-deps`
- De root `node_modules/` bevat alleen `concurrently`. Dat kan met `npm install --no-workspaces`.
- `--legacy-peer-deps` is nodig vanwege React 19 peer dependency conflicts.
- Dev/build direct vanuit de package: `cd packages/frontend && npx vite` (of `npx vite build`). `npm run dev` vanuit de root werkt niet zonder workspace symlinks.
- **Verwijder NOOIT `node_modules/` tenzij je weet wat je doet.** Opnieuw installeren op Z: drive is fragiel.
- **Dev/build draaien vanuit de package zelf:**
  ```bash
  cd packages/frontend && npx vite          # dev server
  cd packages/frontend && npx vite build    # production build
  cd packages/server && npm run dev         # server dev
  cd packages/server && npm run build       # server build
  ```
- `npm run dev` vanuit de root werkt **niet** zonder workspace symlinks. Gebruik bovenstaande commands direct.

---

### Browser-automation voor frontend-debug (Playwright MCP)

Als je gebruiker vraagt om visuele/interactieve UI-checks die je anders alleen kunt doen door te vragen *"open DevTools en kijk wat er gebeurt"* — gebruik de Playwright MCP plugin in plaats daarvan. Hij is workspace-globaal geactiveerd (zie [`../../AGENTS.md`](../../AGENTS.md) sectie "Browser-automation via Playwright MCP"). Y-app-specifieke aandachtspunten:

**Setup-flow voor Y-app-debug:**
1. **Server-modus kiezen** (zie tabel hierboven) — proxy naar productie voor pure frontend-werk, lokale server voor server-side changes.
2. **Frontend draaien** op `http://localhost:5173` (Vite). Of test direct tegen productie `https://y-app.impertio.app`.
3. **Y-app session-cookie**: Playwright MCP kan de browser eenmalig laten inloggen (signup/login flow op `/signup` of `/login`) — daarna is de sessie persistent binnen de Playwright-context. Voor frequent testen overweeg een vast `--storage-state` JSON-bestand zodat de sessie tussen runs gedeeld kan worden.

**Wat handig is om te testen via Playwright:**
- **Popout-tabs** (`/mail/view`, `/messenger/view`) — Playwright kan een nieuwe tab openen met de URL inclusief alle parameters (`instance`, `email`, `acct`) en verifiëren dat de body niet 400 retourneert. Zie de "Popout tabs" sectie hierboven voor de drie verplichte parameters.
- **Single- vs double-click discriminatie in Webmail** — `page.click(selector, {clickCount: 2})` voor de mail-rij; assert dat een popout opent en niet de preview.
- **`X-Y-App-Instance` header** — `page.on('request', ...)` om elk request te loggen; verifieer dat de header op elke `/api/*` zit (behalve `/api/erpnext-asset` die op query-param werkt).
- **ERPNext-asset proxy** — `<img>`-tags in srcdoc iframes; check of `<base href>` correct geïnjecteerd is door `fetchPrintPreviewHtml()`.
- **i18n NL/EN switch** — `page.evaluate(() => i18next.changeLanguage('en'))` en visueel verifiëren dat alle keys vertaald zijn.
- **Multi-instance tab-state** — open meerdere instances, switch tussen tabs, verifieer dat fetch-interceptor de juiste instance-ID injecteert.
- **Encrypted vault flow** — login → instance toevoegen → uitloggen → opnieuw inloggen → vault decrypt; visueel + via network-tab op response shape.

**Wat NIET via Playwright:**
- IMAP/SMTP gedrag — dat is server-side, gebruik server-logs of een raw IMAP-client.
- Tauri desktop / Android-build — geen browser, geen Playwright. Daarvoor desktop_vision MCP of native debugging.
- Production deploys — alleen via GitHub Actions deploy workflows (`.github/workflows/deploy-server.yml`), niet via een geautomatiseerde browser.

**Als de Playwright MCP-tools niet zichtbaar zijn in de huidige sessie:** vraag Piet Codex te herstarten. De plugin start automatisch via `npx @playwright/mcp@latest` zodra hij geladen is.

---

## Git workflow

- **NOOIT pushen zonder te vragen.** Altijd eerst bevestiging van de gebruiker voordat `git push` wordt uitgevoerd.
- Branch-based workflow: maak een branch, commit, en vraag of je mag pushen.

### Branch hygiene — voorkom merge-conflicten

Een branch die weken afwijkt van `main` levert bij het samenvoegen grote pijnlijke conflicten op (en kan zelfs code verwijderen die op `main` is toegevoegd). Volg daarom deze vier regels:

1. **Start altijd vanuit de laatste `main`.** Voordat je een branch aanmaakt:
   ```bash
   git checkout main
   git pull
   git checkout -b fix/whatever
   ```

2. **Sync je branch dagelijks (of om de paar dagen) met `main`:**
   ```bash
   git checkout main && git pull
   git checkout fix/whatever
   git rebase main
   ```

3. **Los kleine conflicten meteen op.** Een rebase halverwege het werk levert een handvol kleine conflicten; wachten tot het einde levert één grote pijnlijke merge.

4. **Nooit rechtstreeks naar `main` pushen.** Altijd via een PR — zodat reviewers zien wat er gewijzigd is en CI kan draaien voor het live gaat.

---

## Huidige status (branch `fix/build-issues-v040`)

**Gecommit en gepusht** — commit `8398bbe`, 24 bestanden.

### Wat is er gewijzigd in v0.4.0:

#### Uren boeken widget
- Task name direct zichtbaar na boeken
- Afronding op 2 decimalen
- 200ms delay verwijderd na boeking
- Activity type verborgen voor employees (werkgever stelt in)

#### Leave request modal (Vakantieplanning)
- 2-staps flow: formulier → samenvatting met blokken → indienen
- Shift-plan-aware: alleen werkdagen kosten verlof
- Split leave requests: parttime roosters → meerdere ERPNext aanvragen
- react-day-picker kalender met kleuring (grijs=niet-werkdag, teal=feestdag, oranje=bestaand verlof)
- Hover tooltips met reden per dag
- Halve dag met datum-selectie
- Leave types gefilterd op employee allocations
- Openstaande aanvragen zichtbaar in uren saldo kaarten
- "Vandaag" navigatie-knop

#### Messenger
- Batch loading: 20 berichten per keer (was 100) + "Laad oudere berichten" knop
- Polling merged nieuwe berichten i.p.v. alles vervangen
- NextCloud URL auto-prepend `https://`

#### Dashboard
- Missing hours check via time_logs i.p.v. timesheet start_date

#### i18n
- 40+ nieuwe vertaalkeys (nl + en): leave modal, project detail labels

#### Overig
- InstanceBar onViewModeChange optioneel
- AGENTS.md npm install docs voor Z: drive

### Dependencies:
- `react-day-picker` ^9.6.4 (packages/frontend)

### Bug/feature tracking
Zie [`docs/y-bugs.md`](./docs/y-bugs.md) voor het volledige overzicht van bugs en features (🟢 = gedaan, 🔵 = later).
Design spec: [`docs/superpowers/specs/2026-04-13-bugfix-v040-design.md`](./docs/superpowers/specs/2026-04-13-bugfix-v040-design.md)

### Wat is er gewijzigd in v0.4.1 (branch fix/build-issues-v040):

#### Bug fixes (B02-B11)
- B02: Sidebar module visibility — SIDEBAR_MODULES gesynchroniseerd met Sidebar definitie, ERPNext blockedModules filter
- B03: Messenger "Alle" tab — parameter name mismatch gefixt (nc_url→url)
- B04: Session caching — localStorage voor INBOX, folders, Talk conversations (stale-while-revalidate)
- B05: Talk file/image support — server extraheert messageParameters.file, proxy endpoint, frontend rendering
- B06: IMAP AsyncQueue — serialiseert operaties per account, retry logica, lock timeout 30s
- B07: Email collapse state — persist in localStorage per folder
- B08: Smart dropdown positioning — useDropdownPosition hook, WorkflowChanger
- B09: Shift hours consolidatie — shared shiftHours.ts, activityTypes.ts, URL-match bridge
- B10: Missing shift warnings — amber banner + blocked calculations
- B11: Contract hours uit Shift Type docs — geen name-parsing meer

#### Nieuwe features
- F05: Multi-select email (Shift/Ctrl klik, bulk actions)
- F06: Emailmap aanmaken op basis van project ([IN]/[OUT] prefix)
- F07: Subfolder search in email
- F08: Compacte widget layout (2 rijen)
- F09: Individuele boekingsrijen in Timesheets overzicht met sorteerbare kolommen en maand-kopjes
- F18: Rich text taakomschrijving + sidebar collapse bug fix
- F23: Settings opruimen voor employee weergave
- Kanban tab op Planning pagina
- Todo defaults (employee filter, datum, assigned_to)
- Activity type per medewerker (employer instelling)
- 24h tijdsinvoer (text input i.p.v. native time picker)
- Taken/Subtaken verplaatst naar "Taken & Planning" sectie in sidebar
- Inline edit project/taak dropdown in TimesheetDetailsTable

#### Architectuur
- `lib/shiftHours.ts` — shared shift hours utility
- `lib/activityTypes.ts` — shared activity types met URL-match bridge
- `lib/useDropdownPosition.ts` — reusable dropdown positioning hook
- `components/ShiftHoursWarning.tsx` — amber warning banner
- `/api/shared-settings/:key` — cross-user settings via URL-match (employer→employee bridge)
- `/api/messenger/file-proxy` — authenticated NextCloud file proxy
- `InlineSearchSelect` component in Timesheets voor project/taak inline edit

### Dependencies:
- `react-day-picker` ^9.6.4 (packages/frontend)

### Session 3 (2026-04-14): Project sidebar, template instellingen, Todo

**Commits:** `99579ca`, `bb3065d`

#### Project aanmaken sidebar
- Nieuw project aanmaken in sidebar (klant-dropdown alle klanten, PM default = ingelogde medewerker)
- Taken preloaden vanuit klant-sjabloon koppeling (bewerkbaar, toevoegen/verwijderen)
- Adres sub-sectie (edit mode only): Nominatim + Leaflet
- Potlood-knop in ProjectDetail header → edit sidebar
- SO filter: docstatus=1 (alleen ingediend), klanten: limit_page_length=0

#### Settings: Project instellingen tab
- Nieuw tab "Project instellingen" (employer-only)
- Klant → ERPNext taaksjabloon koppelen, opgeslagen in `instance_settings` key `project-template-mapping`
- Frontend haalt mapping direct op (niet via suggest-endpoint)
- Template taken via `fetchDocument("Project Template", name)` met array-veld fallback

#### server
- `packages/server/src/project-suggestions.ts` — nieuw, matcht op klantnaam direct

#### erpnext.ts
- `createDocument` checkt `errData?.error` + `errData?.message` voor betere foutmeldingen

#### Todo
- `reference_type != "Task"` filter voor iedereen (taak-assignments verborgen)
- Employee-filter voor werkgevers, pagina gelijk voor beide rollen
- "Assigned to" verwijderd uit sidebar en lijstrijen

#### Overig
- Tasks: multi-assignee fix (toevoegen vervangt niet meer alle bestaanden)
- Timesheets: UTC timezone bug in workday-fill loop gefixed

### Bekende issues:
- `npm install` vanuit root faalt op Z: drive (symlinks). Zie sectie hierboven.

### Playwright + NextCloud Talk lokaal — recipe (2026-05-21):
1. Vul NC-creds in via Y-app Settings → Berichten → NextCloud Talk → "Test verbinding" (slaat op in localStorage onder `pref_${instanceId}_messenger_nextcloud-talk_{url,user,pass}`).
2. Start `npm run dev` in `packages/server` + `npx vite` in `packages/frontend`.
3. Playwright → `http://localhost:5173/messenger`. WS `/ws/events` opent + frontend stuurt `subscribe-messenger` met creds (Wave 0a fix). Server cached per (yAppSid, instanceId).
4. Alle `/api/messenger/*` calls werken nu zonder creds in URL (server resolveert via cache). Conversaties, send, react, file-proxy plaatjes — alles testbaar.
5. **Side-effect**: server-restart (tsx --watch) wist de cache → bij eerstvolgende WS-open opnieuw subscribe-messenger nodig. Browser-reload doet dat automatisch.

---

## When in doubt

1. **Read first, change second.** This codebase has a strong threat model and a non-trivial auth flow; the cost of misunderstanding is real (lost credentials, security regression, broken deploys).
2. **If a request would break a load-bearing decision, raise it with the user before coding.** That is not pushback for its own sake — it is making sure they actually want to rewrite the product.
3. **Match the scope of your change to what was requested.** Don't refactor surrounding code, don't "improve" things that weren't asked about, don't add fallbacks for scenarios that can't happen.