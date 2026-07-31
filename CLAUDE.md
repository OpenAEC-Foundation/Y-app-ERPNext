# CLAUDE.md

> **Read this first.** It is loaded into every Claude Code / AI assistant session that opens this repo. It tells you what Y-app is, what the load-bearing architectural decisions are, and which kinds of changes will silently break the product.
>
> If you are a human contributor: this file is also for you. Read it before your first PR.

For the full feature list, setup instructions, and deploy story, see [`README.md`](./README.md). For release history, see [`CHANGELOG.md`](./CHANGELOG.md). For current in-progress work, see [`STATUS.md`](./STATUS.md) — but do not rely on STATUS.md unless the user explicitly asks.

---

## Where things live (for future editors)

When you learn something new about Y-app, put it in the right file — keeping CLAUDE.md stable is what makes it trustworthy to load into every session. If in doubt, default to CHANGELOG.md; only promote to CLAUDE.md when it becomes a permanent architectural fact.

**This file (`CLAUDE.md`)** — write here when the thing will still be true in six months:
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
- Not loaded by Claude automatically; safe to be long

**`STATUS.md`** — write here when you're mid-work:
- What's in progress on which branch
- Recently landed commits that haven't been tagged yet
- Open questions / blocked tickets / pending client requests
- Known dev-environment quirks that are hitting us right now
- Reset this file whenever work lands on `main`; it's disposable

**Upgrade path when content ages:**
- WIP in STATUS.md → ships → moves to CHANGELOG.md, removed from STATUS.md
- An architectural decision in CLAUDE.md becomes obsolete → replace in place (not "deprecated in v0.N") or, if it's really gone, delete and summarise the replacement
- A CHANGELOG entry becomes the norm → do **not** copy it to CLAUDE.md. Only promote the *current* state description, not the history of how we got there

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
| *"Weaken the extension sandbox — expose credentials to the iframe, drop the origin/source checks, or broaden the RPC whitelist to arbitrary `/api/*`."* | Extensions ARE loaded from a URL at runtime (curated `CATALOG` + advanced URL-paste), but only survive as third-party code inside a **cross-origin sandboxed iframe** that reaches ERPNext solely through a fixed method-whitelist postMessage bridge and **never sees credentials** (see Extensions section). Weakening any of that turns third-party-hosted code into a credential-theft / RCE vector in a credential vault. Loading from a URL is fine *within* the model; breaking the model is the non-starter. |

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

### Module-indeling (lopende, gedrag-behoudende decompositie van de god-files)

De grote bestanden worden stap-voor-stap opgesplitst in cohesieve modules. **De gedragingen die verderop in dit document beschreven staan blijven gelijk** — alleen de bestandsindeling is fijnmaziger. Waar je de code vindt vandaag:

- **crypto** — pure primitives (PBKDF2/AES-GCM, `decryptToString`/`decryptToJson`) in [`crypto-primitives.ts`](packages/server/src/crypto-primitives.ts); [`crypto.ts`](packages/server/src/crypto.ts) houdt de master-key/envelope-laag en **re-export** de primitives (bestaande imports uit `./crypto.ts` blijven werken).
- **messenger** — providers in `packages/server/src/messenger/{nextcloud,telegram,teams}.ts`, types in `messenger/types.ts`, noise-filter in `messenger/noise-filter.ts`; [`messenger.ts`](packages/server/src/messenger.ts) houdt de Express-handlers + credential-cache + file-proxy en importeert de providers. Publieke API (14 handlers + `setNcSession`/…) ongewijzigd.
- **routes/** — CalDAV/O365-calendar → [`routes/calendar.ts`](packages/server/src/routes/calendar.ts); uren-stats → [`routes/stats.ts`](packages/server/src/routes/stats.ts). De `app.<verb>(...)`-registraties + de globale `/api`-auth-guard-volgorde blijven in [`index.ts`](packages/server/src/index.ts) (load-bearing).
- **mail** — `mail/errors.ts` (`sanitizeMailError` + `isSmtpConnectionError`, de relay-fallback-beslissing), `mail/address.ts` (From/To-parser), `mail/parse.ts` (`parseMessage`/`buildFullMessage`). [`mail.ts`](packages/server/src/mail.ts) houdt de `MailAccountCache`-klasse (stateful IMAP-connectie/cache) + de handlers.
- **frontend** — pure mail-formatters in [`lib/mail-format.ts`](packages/frontend/src/lib/mail-format.ts) (uit `Webmail.tsx`). Verdere `Webmail.tsx`-decompositie (inline-componenten → `components/mail/*`) loopt.

**Tests.** Server: `npm test` in `packages/server` (`node:test` via tsx). Frontend: `npm test` in `packages/frontend` = `node --test` (Node 24 native TS-strip — **geen vitest/jsdom nodig**; `src/**/*.test.ts` staat in de tsconfig-`exclude` zodat testfiles niet in de app-typecheck/bundle komen). Component-**render**-tests (vitest+jsdom) zijn nog niet opgezet (Z:-install + vite-8-compat). De server heeft géén schone `tsc`-gate (esbuild is de build); meet regressie met `tsc --noEmit | grep -v TS5097` op de echte-fout-telling.

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
- **Current keys:** `activity-types`, `employee-activity-types`, `employee-visible-modules`, `project-template-mapping`, `enabled-extensions`, `email-project-links`, `mail-favorite-folders`, `mail-hidden-folders`, `nas-attachment-template`
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

### Extensions — curated runtime remote pages (per-instance opt-in)

Y-app supports **extensions**: sidebar pages an employer installs per-instance. An extension is a self-contained web app hosted at its **own HTTPS origin** (e.g. GitHub Pages), rendered inside a **sandboxed cross-origin iframe** and mounted at `/x/<id>`. Use case: a customer wants a custom planner / dashboard the rest of the customer base should not see.

This is a **runtime** system — the extension's code is loaded from its URL at run time. It replaced the older compile-time in-tree registry (`registry.ts` / `types.ts` / `enabled.ts` / `example-planner`, now removed). It is safe *because of the sandbox + RPC bridge below* — not because the code ships in the binary. So the guardrail is **"never weaken the sandbox model"**, not "never load from a URL".

**Files:** `packages/frontend/src/extensions/`
- `catalog.ts` — the curated **`CATALOG`** = the allowlist. Each `CatalogEntry` pins `{ id, name, description, url, sidebarSection, visibility?, author? }`. `id` is stable — never change it after release (it is the key under the per-instance `remote-extensions` setting). Adding an extension = append an entry + ship a Y-app release. Current entries: `kg-planning` (Impertio), `projectplanning` (3BM Engineering).
- `remote.ts` — `RemoteExtension` type, `fetchRemoteExtensions`/`saveRemoteExtensions`, `useRemoteExtensions()` hook, `buildExtensionSrc()`, `extensionOrigin()`. Installed extensions persist under the **`remote-extensions`** key in `instance_settings` (per-instance, server-side); cached in localStorage per instance for instant sidebar render.
- `components/ExtensionHost.tsx` — renders the iframe and brokers the postMessage RPC.

**Install / render:**
- Settings → **Extensions** (`ExtensionsPanel`, employer-only): catalog cards with one-click install/uninstall (`installCatalogEntry`). A collapsed **Advanced/Developer** panel (`addCustomRemote`) lets a power user paste an arbitrary HTTPS URL — a conscious opt-in *outside* the curated allowlist.
- `App.tsx` mounts `/x/:extId` → `<ExtensionHost />` (routes always mounted). `Sidebar.tsx` injects installed extensions into their declared `sidebarSection`, filtered by `useRemoteExtensions()` + `viewMode`.

**Threat model (load-bearing — do NOT weaken):**
- The iframe is served from a **third-party origin**, so `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` does **not** hand it Y-app's origin/cookies/DOM (it keeps its own origin). It has no `y-app.impertio.app` cookies, so it cannot hit `/api/*` directly.
- Everything the extension does against ERPNext flows through the **postMessage RPC bridge** in `ExtensionHost.tsx`, which runs in the parent Y-app tab (with the user's session). The iframe **never sees credentials**.
- The bridge validates `event.origin === extensionOrigin(ext)` **and** `event.source === iframe.contentWindow`, and dispatches only a fixed method whitelist (`DISPATCH`): `fetchList`, `fetchDocument`, `updateDocument`, `createDocument`, `callMethod`, `getActiveInstanceId`, `getErpNextAppUrl`, `fetchPrivateFile`. Anything else is rejected.
- **Residual risk:** those whitelisted methods take arbitrary arguments, so an installed extension has full read/write ERPNext access *with the user's privileges* (credentials still never exposed). The curated `CATALOG` is the allowlist that keeps the primary flow to Y-app-released, trusted extensions; the Advanced URL-paste bypasses that allowlist and is trusted-developer-only. **Do not** broaden the whitelist to expose credentials / the vault / arbitrary `/api/*`, and do not drop the origin+source checks or the cross-origin sandbox. Loading from a URL is fine *within* this model; breaking the model is the non-starter.

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

### Messenger: edit/delete + noise-filter + NC-uid resolver

Messenger ondersteunt **bewerken** en **verwijderen** van eigen NC Talk berichten via `POST /api/messenger/edit` en `POST /api/messenger/delete` ([packages/server/src/messenger.ts](packages/server/src/messenger.ts)), die door-mappen naar NC Talk's `PUT/DELETE /ocs/v2.php/apps/spreed/api/v1/chat/{token}/{messageId}`. Frontend toont een 3-dot menu (⋮) naast 👍 + reply op de hover-strip per eigen bericht; bewerkte berichten krijgen `(bewerkt)` naast het tijdstempel via NC Talk's `lastEditTimestamp`; verwijderde berichten renderen als grijs-cursief "Bericht verwijderd" placeholder op hun plek (bubble-id blijft staan zodat replies-naar-verwijderd-bericht blijven werken). NC Talk's standaard edit-tijdsvenster (6u) bepaalt acceptatie — server geeft fout terug, frontend toont toast.

**Noise-filter in `ncGetMessages`** filtert vier soorten ruis voordat berichten naar de frontend gaan:
1. `messageType === "reaction"` / `"reaction_deleted"` — NC Talk emit elke 👍/❤️ ook als losse ChatMessage-rij; reactie-tellingen zitten al op het bovenliggende bericht via `reactions: {emoji: count}`.
2. `messageType === "system"` met `systemMessage === "message_edited"` of `"message_deleted"` — de "X bewerkte/verwijderde een bericht" rijen die NC Talk los inschiet naast het feitelijke bericht. Het bovenliggende bericht heeft zelf al `lastEditTimestamp` of `messageType === "comment_deleted"`, dus een aparte rij eronder is dubbel.
3. **Emoji-only quoted replies** (`m.parent && isEmojiOnly(m.message)`) — iemand stuurt letterlijk "👍" als reply-met-quote vanuit een NC Talk client. Dat is `messageType === "comment"` (geen reaction-event), dus de hoofdfilter mist het. Combinatie van een aanwezig `parent`-veld + tekst die volledig uit emoji bestaat (regex `/^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Emoji_Component}‍️\s]{1,8}$/u`) onderdrukt de "verkapte reactie" zonder gewone emoji-berichten te verbergen. Defense-in-depth: identieke client-side filter in Messenger.tsx + MessengerView.tsx voor oude IndexedDB/localStorage cache-entries die de server-filter al passeerden vóór de fix.

**NC-uid resolver** (`ncResolveUid`): NC Talk's `actorId` op chat-messages is de echte NC user-id (b.v. `"piet.mol"`), terwijl de geconfigureerde Talk-credential `user` vaak een email is (`"piet@3bm.co.nl"`). Directe vergelijking faalt altijd → álle eigen berichten worden als `isOwn=false` gerenderd (witte bubble, sender-naam getoond, géén 3-dot menu, géén edit/delete optie). Oplossing: eenmalig per `(ncUrl, user)` een `GET /ocs/v1.php/cloud/user` om de echte uid op te halen en cachen met 1u TTL in `ncUidCache`. `ncGetMessages` resolved `myUid` aan het begin van elke call en vergelijkt `m.actorId` daartegen voor de `isOwn`-bepaling. **Niet doen**: heuristisch raden (b.v. local-part van email) — NC laat de admin elke uid kiezen, "piet@..." → "piet.mol" is niet algoritmisch afleidbaar.

### Conversation-threading: header-based + 2-zone view boven mail-body

`/api/mail/conversation` (server `mailGetConversation` in [`packages/server/src/mail.ts`](packages/server/src/mail.ts)) reconstrueert per geopende mail de hele e-mail-conversatie volgens **RFC 5322 References-graph met transitive closure**. Frontend toont het overzicht bóven de mail-body in twee zones (zichtbaarheid eerst, body daarna).

**Server-algoritme:**

1. **Bron-headers**: client stuurt `folder` + `uid`. Server leest `messageId` / `inReplyTo` / `references` uit `MailAccountCache.fullMessages` (cache-hit, geen IMAP-roundtrip) of doet een header-only fetch via `fetchHeadersBatch` als de mail niet in cache zit. Géén body, géén `\Seen` STORE.
2. **threadKeys** = `{messageId, inReplyTo, ...references.split(/\s+/)}`.
3. **Subject-prefilter**: Re:/Fwd:/AW:/Antw:/Doorgestuurd: prefix-strip → `baseSubject`. Pre-selecteert candidates per folder via de bestaande `fetchMessages` (CachedMessage's hebben subject maar geen Message-ID).
4. **Zoekruimte**: current folder + Sent + INBOX + álle INBOX-subfolders (project-archief). Trash + Junk/Spam worden geskipt op naam en `specialUse`. PageSize 100 per folder.
5. **Header-fetch per folder parallel** (`Promise.all`): voor de subject-match candidates haalt `fetchHeadersBatch` één IMAP-FETCH met `{envelope: true, flags: true, headers: ['references']}`. `envelope` levert `messageId` + `inReplyTo`; de `headers`-optie levert de `References:`-header (uitgelezen via `msg.headers`). ~10x lichter dan een body-fetch. **Niet doen**: de References-header opvragen via `bodyParts: ['HEADER.FIELDS (REFERENCES)']` — ImapFlow serialiseert dat als `BODY.PEEK["HEADER.FIELDS (REFERENCES)"]` (sectie tússen quotes) en O365 weigert dat met `BAD Command Argument Error` → de bron-header-fetch gooit 500 en de per-folder-fetches falen stil → terugval op subject-only (mist verzonden/cross-folder mails). Gebruik altijd ImapFlow's `headers`-optie.
6. **Transitive closure-loop**: een candidate hoort bij de thread als zijn `messageId`, `inReplyTo`, of één van zijn `references` in `threadKeys` zit. Bij hit wordt `candidate.messageId` toegevoegd aan `threadKeys` en loopt de loop opnieuw — dit pakt indirecte vertakkingen op die alleen via een tussenmail aan de bron gelinkt zijn.
7. **Fallback**: als header-matching nul oplevert (server zonder betrouwbare Message-IDs), gebruikt het resultaat de pure subject-match — beter te veel dan niets.
8. **`relation`** per result: `current` (zelfde folder+uid als bron) | `descendant` (datum > bron-datum) | `ancestor` (datum < bron-datum).
9. **Cache**: 5-min in-memory Map op `mid:<srcMessageId>` (cap 100 entries) binnen `MailAccountCache`. Tweede klik op zelfde mail = `retagRelation` op cached snapshot, geen IMAP-werk. Cache-hit ≤ 5 ms; cold call ≤ 200 ms voor thread van 10 mails over 4 folders.

**Frontend-render** ([`packages/frontend/src/pages/Webmail.tsx`](packages/frontend/src/pages/Webmail.tsx)): `ThreadAboveMail` rendert bóven het body-iframe in twee zones:

- **Zone A — "Vervolgacties"** (amber): alleen `relation === "descendant"`. Per item: datum + ↩ Beantwoord / ↪ Doorgestuurd + afzender. Toont alleen als ≥ 1 descendant.
- **Zone B — "Alle berichten in deze conversatie"**: alle thread-mails chronologisch. Huidige mail heeft violet ring + label "HUIDIG" en is niet klikbaar. Andere blokjes openen de mail — switcht folder eerst indien de mail in een andere folder zit (`m.folder !== activeFolder`).

`loadConversation` triggert alleen op messages met threading-markers (Re:/Fwd:-prefix, of `messageId`/`inReplyTo`/`references`, of `isReplied`-vlag). De render-conditie blijft `length > 1` zodat solo-mails geen lege ruimte krijgen.

**Waarom géén pure subject-match (oude implementatie):** false positives bij hergebruikt subject ("Vraag"), false negatives wanneer een klant mid-thread het subject wijzigt. References-headers zijn cross-mailbox-stabiel en survival-of-the-fittest-getest in RFC-compliance van 30+ jaar IMAP.

**Waarom géén IMAP `THREAD REFERENCES`-command:** Niet alle servers ondersteunen het, en ImapFlow's API ervoor is dun. Eigen header-fetch is voorspelbaar en werkt op elke IMAP4rev1-server. Geparkeerd als optimalisatie als 200 ms-budget wordt overschreden bij grote threads.

### Mail-list & conversation cache: 3 lagen + mark-read TTL-Set

Webmail en Messenger gebruiken **drie cache-lagen** voor mail/messages, plus een **persistent mark-read tracker** tegen de IMAP `\Seen` STORE-race. Server is uiteindelijke bron-van-waarheid.

**Lagen** (gerangschikt van snelst naar betrouwbaarst):

1. **`folderMsgCache` / `messagesCacheRef`** — in-memory `Map`, module-level (overleeft Webmail/Messenger remount). 30-60 s TTL. Wordt direct getoond bij tab-switch zodat de lijst niet kort leeg gaat.
2. **IndexedDB** — database `y-app-mail`, store `folder_messages`, key `${instanceId}::${acct}::${folder}` (mail). Bevat alle folders, geen LRU-cap. Helpers in [`packages/frontend/src/lib/mail-cache-db.ts`](packages/frontend/src/lib/mail-cache-db.ts) (`readMailFolderCache`, `persistMailFolderCache`, `deleteMailFolderCache`, `getCachedFolderPaths`, `clearMailCache`, `migrateLocalStorageMailCache`). Achtergrond-warmup bij Webmail-mount vult alle folders 5-parallel binnen ~30s. Trim per folder op 500 nieuwste msgs (sort op uid desc).
3. **localStorage** (fallback / dual-write) — keys `webmail_msglist_cache_${instanceId}_${acct}_${folder}` (mail) en `messenger_msgs_${instanceId}_${convId}` (Talk). Voor mail: dual-write tijdens migratie-window; lees-pad valt hier op terug als IDB leeg is. Voor Talk: nog primary cache, LRU **30 conversations**. Overleeft browser-restart en Vite hot-reload. Zie helpers in [`packages/frontend/src/pages/Webmail.tsx`](packages/frontend/src/pages/Webmail.tsx) (`readMailFolderCache` / `persistMailFolderCache` lokaal) en [`packages/frontend/src/pages/Messenger.tsx`](packages/frontend/src/pages/Messenger.tsx).
4. **Server** — gezaghebbend. Bij elke `loadMessages` doet de browser een fresh fetch en overschrijft alle caches met server-data (gemoduleerd door de TTL-Set, zie hieronder).

**Cache-invalidatie bij move/delete:** `invalidateFolderCache(folder)` in Webmail.tsx wist alle 3 client-side lagen (in-memory + localStorage + IDB) zodat verwijderde mails niet "terugkomen" bij refresh. Server is daarna bron-van-waarheid bij volgende fetch.

**Race-guard bij snel folder-switchen:** `activeFolderRef` mirror van `activeFolder`-state. In `loadMessages` na fetch + in `switchFolder`'s async IDB-lookup: als de aangevraagde folder niet meer `ref.current` is → discard `setMessages`/`setTotal`. Voorkomt dat laat-aankomende fetch-result voor folder A de UI overschrijft nadat user al naar B is geklikt.

**Mark-read TTL-Set** — `recentLocallyMarkedRead: Map<\`folder:uid\`, timestamp>` in `Webmail.tsx`, persistent in localStorage onder key `webmail_recent_mark_read`. **60 s TTL.** Lost de race op tussen optimistische mark-read en IMAP `\Seen` STORE-propagatie:

- **Probleem**: server STORE is fire-and-forget; de volgende `fetchMessages` kan binnen 1-2 s nog `seen=false` retourneren voor een net-gemarkeerde mail → die mail zou kort terug naar BOLD flippen bij F5, tab-switch of `mail-changed` push-event.
- **Oplossing**: bij elke mark-read registreert `applyOptimisticReadFlag` de uid in de TTL-Set. De helper `applyRecentReadOverlay(msgs, folder)` forceert `seen=true` voor uids die binnen de 60-s window zitten, op **alle vier message-laad-paden**: hydrate-useEffect, mount-init parallel-fetch, `loadMessages`, en de `switchFolder` cache-hit pad. `applyRecentReadOverlayToFolders` doet hetzelfde voor `folder.unseen` zodat sidebar-badge en panel-header consistent zijn.
- **Na 60 s** vervalt de entry → server-truth wint. Cruciaal voor scenarios waar een andere client (Outlook desktop) een mail terug op unread zet, of nieuwe mails arriveren.

**Sidebar-badge "Email" telt alleen INBOX** — `shouldCountForBadge` filtert subfolders weg zodat de Email-badge in de sidebar exact gelijk is aan de INBOX-folder-badge in de mail-folder-tree. Submap-unseen-counts zijn wel zichtbaar in de folder-tree zelf.

**Niet doen**: lokale `seen=true` *persistent* naar localStorage schrijven. Doet de race langer aanhouden en is incompatibel met externe mark-as-unread (Outlook). Beperk de overlay strict tot de TTL-Set.

### IMAP opQueue: priority + background-flag

De per-account `AsyncQueue` (`opQueue` in [`packages/server/src/mail.ts`](packages/server/src/mail.ts)) serialiseert álle IMAP-ops op de ene fetch-connectie. Hij is **priority-aware**: `enqueue(fn, priority)` — hoger = eerder, FIFO binnen een tier. Achtergrondwerk (folder-warmup, conversation-header-scans, body-prefill) enqueuet op priority `<0`; interactieve ops (mail openen, map wisselen) op `0` en springen vóór gewachte background-ops. De `background`-flag loopt door `fetchMessages` / `fetchHeadersBatch` / `fetchBodiesBatch`; frontend markeert achtergrond-calls met `?bg=1` (de `/api/mail/messages`- en `/api/mail/bodies`-endpoints lezen dat). **Let op**: de queue kan een lopende op niet onderbreken — daarom moet zwaar achtergrondwerk óók kort/gerangschikt zijn (zie body-prefill: lijst-warmup eerst, dán bodies).

`failedFolders` (15-min TTL): mappen waarvan een fetch écht faalt worden door **background**-fetches overgeslagen zodat de warmup de connectie niet telkens seconden bezet houdt. Interactieve fetches proberen altijd opnieuw → nooit echte mail verborgen.

**Lege mappen NOOIT met een sequence-FETCH benaderen.** `fetchMessages` mag bij een lege mailbox (`mailbox.exists === 0`) géén sequence-FETCH als `"1:1"` doen — Office365 antwoordt `NO` op een FETCH naar een niet-bestaand bericht en ImapFlow gooit dan **"Command failed"** (→ 500). De oude code rondde `Math.max(1, end - …)` altijd naar 1 af en liep daar tegenaan; bij een typische O365-mailbox zijn 10+ mappen leeg (Archive, Conversation History, lege projectsubmappen) die zo élke warmup-ronde 500'den en de body-cache-pre-fill incompleet lieten. Huidig gedrag: bij `total === 0` doet `fetchMessages` een **UID SEARCH ALL** als check — leeg → meteen lege lijst (0 IMAP-FETCH); niet-leeg (O365 onderrapporteert EXISTS soms) → pagina per UID ophalen. Het normale `total > 0`-pad is ongewijzigd (geen extra round-trip). De `sinceDays`- en `fetchBodiesBatch`/`fetchHeadersBatch`-paden zijn al UID-gebaseerd en dus immuun.

`mailGetConversation` scant alleen de huidige map + INBOX + Sent + INBOX-submappen **die al vers in de list-cache zitten** (`hasFreshFolderCache`), met pageSize **50** (zelfde cache-key als de warmup) — niet langer een koude pageSize=100-fetch over alle ~130 mappen per mail-open.

### Lokale mail body-cache (offline / instant openen)

De volledige mailinhoud van de laatste N dagen (instelbaar, default 30; **per apparaat**, key `mail_cache_window_${instanceId}` in localStorage, bewust géén `pref_`-prefix zodat synced-prefs het NIET synct) staat lokaal in **IndexedDB** — `y-app-mail` v4, store `message_bodies`, key `instance⌀acct⌀folder⌀uid` (NUL-separator, zie correctheids-bullet), waarde `{ body, mailDate, ts }`. Helpers in [`packages/frontend/src/lib/mail-cache-db.ts`](packages/frontend/src/lib/mail-cache-db.ts) (`readMailBody`, `persistMailBody`, `getCachedBodyUids`, `countCachedBodies`, `sizeOfCachedBodies`, `evictBodiesOlderThan`, `clearMailBodies`). DB-versies: v2 = `message_bodies`, v3 = NUL-separator-keys, v4 = `message_attachments` (zie bijlage-cache hieronder).

- **Bron-van-waarheid blijft de server**; IndexedDB is de *duurzame* cache (per browser). De server is een **tijdelijk doorgeefluik**: hij houdt bodies niet duurzaam vast (alleen de LRU-500 `fullMessages` in RAM). Bewust — privacy + geheugen.
- **Server**: `GET /api/mail/bodies?folder=&uids=&bg=1` → `MailAccountCache.fetchBodiesBatch` doet een gepipelinede **`BODY.PEEK[]`**-fetch (markeert niets als gelezen), gechunkt, op background-prioriteit.
- **Read-path** (`openMessage` in [`packages/frontend/src/pages/Webmail.tsx`](packages/frontend/src/pages/Webmail.tsx)): in-memory cache → **IndexedDB** → server. IDB-hit = instant, geen IMAP-roundtrip, werkt offline. Omdat de body via PEEK gecached is, krijgt een ongelezen mail bij een IDB-hit alsnog een fire-and-forget `/api/mail/mark-read`. Cold server-fetches schrijven de body óók naar IDB (organisch vullen).
- **Pre-fill** ([`packages/frontend/src/lib/mail-body-prefill.ts`](packages/frontend/src/lib/mail-body-prefill.ts)): draait **ná** de lijst-warmup (`warmupDoneRef`, 3-min cap) zodat ze niet om de ene IMAP-verbinding vechten. Per echte map (Trash/Junk/systeem overgeslagen): leest de lijst **uit IndexedDB** (instant, geen IMAP); als de nieuwste ~50 volledig binnen het venster vallen → diepere fetch tot 1000/map voor volledige dekking. Activity-aware: pauzeert tijdens klikken.
- **Blijft staan bij reload**: de volledige pre-fill wordt overgeslagen als de cache < 12u geleden volledig gevuld is (timestamp `mail_cache_lastfill_${instId}_${acct}_${windowDays}` in localStorage). Een F5 binnen dat venster doet dus 0 body-fetches en 0 lijst-fetches — de cache blijft gewoon staan i.p.v. opnieuw te lijken downloaden.
- **Delta-sync (alleen wijzigingen)**: tussen de zeldzame volledige pre-fills houdt `syncNewBodies()` ([`lib/mail-body-prefill.ts`](packages/frontend/src/lib/mail-body-prefill.ts)) alleen de nét-binnengekomen mail bij — getriggerd door het `y-app:mail-changed` push-event (IMAP IDLE), voor INBOX + de actieve map. Lichtgewicht (geen warmup-wait/pauze/voortgangs-chip) met een eigen subtiele **"bijwerken…"**-melding (los van de "30d cachen… X%"-pre-fill).
- **Eviction**: bij open verwijdert `evictBodiesOlderThan(now - venster)` bodies buiten het venster (rollend) — én entries met een onbruikbare datum (anders nooit-evict).
- **Correctheid/coherentie** (expert-review): body-keys gebruiken een **NUL-separator** (mapnamen mogen "::" bevatten) — IndexedDB v3 wist de oude entries. Bij verwijderen/verplaatsen wist `openMessage`/`invalidateFolderCache` óók de IDB-body (`deleteMailBody`/`deleteFolderBodies`). De read-path serveert een gecachte body **alleen** als onderwerp+datum matchen met de lijst-rij (vangt UID-hergebruik na expunge/move → anders verkeerde mail/bijlage). De delta-sync reconcilieert verwijderingen (gecachte uid binnen het opgehaalde bereik maar weg uit de lijst → lokaal wissen). De in-memory `fullMsgCache` is genamespaced per instance+acct.
- **Quota**: bij `QuotaExceededError` maakt `persistMailBody` ruimte vrij (oudste 300 op `ts`) en probeert één keer opnieuw i.p.v. de cache permanent te blokkeren; lukt het niet → "opslag vol"-chip + toast.
- **Privacy**: volledige platte-tekst bodies staan lokaal in IndexedDB. Bij **uitloggen / sessie-einde** wist `clearAllMailCache()` beide stores (App.tsx), zodat een volgende gebruiker op het apparaat de mail niet kan lezen. IndexedDB heeft `onblocked`/`onversionchange` zodat een oude tab de upgrade niet laat hangen. Dit verbreedt wel de lokale-data-footprint t.o.v. het credential-only threat-model in [crypto.ts](packages/server/src/crypto.ts) — bewuste afweging voor offline/instant.
- **Instelling**: in het Webmail e-mailinstellingen-blok (`ImapSetup`), niet in de Settings "Email accounts"-tab.
- **Indicator**: één gecombineerde chip in de webmail-balk — lijst-warmup = eerste 50% van het %, body-pre-fill = tweede 50%: "30d cachen… X%" → "30d gecached" (✓, aantal in tooltip). Bij volle browser-quota: waarschuwing, stoppen (geen stille eviction-op-grootte). In het `ImapSetup`-instelblok staat bovendien de **huidige opslaggrootte** ("Nu opgeslagen: X MB · N berichten", incl. de bijlage-bytes — zie `sizeOfCachedBodies` + `sizeOfCachedAttachments`).

### Lazy bijlage-cache + PDF-preview in nieuw tabblad

**Bijlage-cache** (IndexedDB `y-app-mail` v4, store `message_attachments`, key `instance⌀acct⌀folder⌀uid⌀index`, waarde `{ blob, filename, contentType, mailDate, ts }`). Bewust **lazy**, niet proactief: een bijlage wordt pas gecached zodra de gebruiker 'm opent of downloadt. Tweede keer openen = instant + offline (geserveerd uit IndexedDB, 0 server-fetch). Helpers in [`mail-cache-db.ts`](packages/frontend/src/lib/mail-cache-db.ts): `readAttachment`, `persistAttachment` (reclaim-on-quota: oudste 50 wissen + 1× retry), `evictAttachmentsOlderThan`, `sizeOfCachedAttachments`, `reclaimOldestAttachments`.

- **Read-path**: `fetchAttachmentBlob(uid, index, folder)` in [`Webmail.tsx`](packages/frontend/src/pages/Webmail.tsx) = cache → server (`/api/mail/attachment`) → persist. `openAttachment` + `downloadAttachment` gaan via deze helper. Persist gebeurt **alleen als de mail-cache aanstaat** (`getMailCacheWindowDays > 0`) en eviction volgt **hetzelfde rollende venster** als de bodies (naast `evictBodiesOlderThan` in de pre-fill-effect). `clearAllMailCache()` wist de store mee (privacy bij uitloggen). Eenmalig `navigator.storage.persist()` aangevraagd zodat de browser de cache niet onder schijfdruk wist (Outlook-OST-achtig).
- **PDF opent fullscreen in een nieuw browser-tabblad** (niet de inline-modal): native viewer over het hele scherm met alle tools (roteren/zoom/print/download). Het tabblad wordt **synchroon binnen de klik** geopend (`window.open("", "_blank")`) — anders blokkeert de popup-blocker na de async blob-fetch — en daarna naar de (gecachte → instant) blob-URL genavigeerd. Blob pas na 60 s vrijgegeven, anders breekt het net-geopende tabblad. Popup geblokkeerd → fallback naar download. Afbeeldingen/tekst blijven wél inline (`attachPreview`-modal, met `#view=FitH` op de — nu ongebruikte — PDF-tak als fallback).
- **Performance-bevinding**: heropenen uit cache ≈ 135 ms vs ≈ 2,3 s koud (IMAP-fetch). De resterende tijd is de native PDF-render zelf (vector-zware bouwtekeningen zijn inherent traag, in élke viewer) — niet app-fixbaar; netwerk is met de cache al weggehaald.

### Mappen-beheer: context-menu + slepen naar favoriet/zoekresultaat

`FolderTree` in Webmail heeft een rechtermuis-context-menu (`onContextMenu` → `handleContextMenu`) met: Nieuwe map, Hernoemen, **favoriet toggelen**, en **Map verwijderen** (rood, met `window.confirm`; verborgen voor INBOX en system-mappen op `specialUse`). Verwijderen gaat via `POST /api/mail/delete-folder` → `MailAccountCache.deleteFolder` (`client.mailboxDelete`); server-side guard weigert INBOX + `\Sent/\Trash/\Drafts/\Junk/\Archive`. **Belangrijk**: `renderFavoriteRow` (gebruikt voor zowel de favorieten-sectie als de folder-zoekresultaten) MOET dezelfde drag-handlers (`onDragOver`/`onDragLeave`/`onDrop`) + `onContextMenu` hebben als `renderNode` — anders kun je geen mail naar een favoriete/gezochte map slepen (die rijen misten de drop-target volledig).

### Mail credential-resolutie: waar de IMAP/SMTP-creds vandaan komen

**Load-bearing en niet-intuïtief.** De live webmail stuurt bij elke `/api/mail/*` call **geen** host/poort/wachtwoord mee — `buildQuery` ([webmail-prefetch.ts](packages/frontend/src/lib/webmail-prefetch.ts)) stuurt alleen `email=<adres>` (+ `acct`/`primaryEmail` voor shared, + `account=<id>` als er vault-accounts zijn). De server resolvet de échte creds in `getCredentials` ([mail.ts](packages/server/src/mail.ts)), in deze volgorde:

1. **Y-app vault** (`?account=<id>` → `mail_accounts` SQLite, AES-GCM): hoogste prioriteit. `authMiddleware` ([auth.ts](packages/server/src/auth.ts)) zet `yAppUserId`+`yAppUserKey` op de request; `getDecryptedMailCredentials` ontsleutelt host/poort/user/pass/secure + smtp. Dit is "creds in Y-app", de juiste plek voor plain-IMAP accounts.
2. **mailSession-cache** (in-memory, per (yAppSid, instanceId, acct), 4u sliding) — gevuld door IMAP-IDLE (`ensureIdleForSession`). `/api/mail/config` (`mailSetConfig`) is NIET gemount; de frontend pusht niet.
3. **Query-creds** (host/user/pass in URL) — backward-compat, stuurt de huidige frontend niet meer.
4. **ERPNext "Email Account" doctype** (`resolveCredentials` → `mailAutoConfigInternal`) — fallback op `email`. Leest `email_server`/`incoming_port`/`use_ssl`/`connected_app` etc.

**Het Webmail "e-mailinstellingen"-formulier (`ImapSetup` → `saveImapConfig`) schrijft alleen `pref_<id>_imap_*` localStorage en wordt door de live fetch GENEGEERD.** Vault-accounts toevoegen gaat via **Settings → Email accounts** (`MailAccountSettings` → `POST /api/instances/:id/mail-accounts`). Een instance met vault-accounts toont `MailAccountTabs` in Webmail en `bq()` injecteert dan `account=<id>`.

**ERPNext-resolve valkuilen (alleen relevant als er géén vault-account is):**
- **`connected_app` leeg ⇒ password-auth.** `mailAutoConfigInternal` ging vroeger de OAuth-tak in zodra de site één Microsoft Connected App had (`connApps.length > 0`), óók voor een account zonder `connected_app` → `authMode:"password"` zónder pass → IMAP-login faalt. Nu: leeg `connected_app` → altijd de `get_password`-tak.
- **Email Domain overschrijft Email Account.** Het `domain`-veld linkt naar de **"Email Domain"** doctype; ERPNext kopieert bij elke save `email_server`/`smtp_server`/poorten van de Email Domain naar het account. Wil je één account naar een andere host wijzen zonder de rest van het domein te raken → maak `domain` op dát account leeg (anders breken alle accounts die de Email Domain delen).
- **`smtpSecure`** wordt afgeleid uit `use_ssl_for_outgoing` (of poort 465), niet hardcoded — implicit-SSL (465) → `secure:true`, STARTTLS (587/O365) → `false`.

**`mailSend` heeft een EIGEN SMTP-resolutie** (body `smtp` → mailSession → `resolveCredentials`) die `getCredentials` NIET aanroept en `?account=` (vault) dus NIET leest. Voor een volledige vault-migratie moet ook `mailSend` de vault gebruiken — nu nog niet het geval.

### Uitgaande mail: ERPNext-relay als SMTP-fallback (IP-block omzeilen)

`mailSend` ([mail.ts](packages/server/src/mail.ts)) probeert eerst **directe SMTP** zoals altijd. Faalt die met een **connectie-fout** (`ECONNREFUSED`/`ETIMEDOUT`/`ESOCKET`/`ECONNRESET`/`EHOSTUNREACH`/… — zie `SMTP_CONNECTION_ERROR_CODES`/`isSmtpConnectionError`) én is er een ERPNext-sessie (`req.erpnextSid`), dan **relayet** hij de mail via ERPNext: `frappe.core.doctype.communication.email.make` (zie `erpnextSendEmail` + `uploadPrivateFile` in [erpnext-client.ts](packages/server/src/erpnext-client.ts)). ERPNext (op Frappe Cloud, een ander IP) levert af via zijn eigen Email Queue + Email Account.

**Waarom (load-bearing):** sommige plain-IMAP-mailhosts (bv. `mail.3bm.co.nl` voor `piet@3bm.co.nl`) accepteren IMAP wél, maar **weigeren SMTP-submission vanaf het Y-app-VPS-IP**. Vanaf een toegestaan IP (kantoor, of ERPNext/Frappe Cloud) werkt dezelfde account prima. De fallback is bewust **alleen op connectie-fouten** — `EAUTH` (fout wachtwoord) en `EENVELOPE` (recipient geweigerd) zijn échte fouten en moeten naar de gebruiker. Accounts die direct kúnnen versturen (O365 via OAuth) raken het relay-pad nooit; geen per-account config nodig.

- **`sender`** = het bare From-adres (uit `from`/`acct`/`smtp.user`, via `extractEmailAddress`); ERPNext matcht het outgoing Email Account op `email_id` (anders default outgoing). Het account moet `enable_outgoing=1` hebben.
- **Bijlages** kunnen bij `communication.email.make` niet als losse binary mee — ze worden eerst als **private File** geüpload (`/api/method/upload_file`, multipart) en hun File-doc-`name`s gaan in het `attachments`-veld. Een mislukte upload gooit (geen stil-gedropte bijlage) → terugval op `sendMailError`.
- **Sent-folder blijft kloppen:** de IMAP-APPEND-naar-Sent draait ná zowel het directe als het relay-pad (IMAP wérkt wél vanaf de VPS). De lokaal opgebouwde MIME houdt correcte `In-Reply-To`/`References`-headers, ook al neemt de ERPNext-relay die voor de recipient-kant niet over (recipient ziet een nieuwe thread-root — bekende, geaccepteerde regressie).
- **Niet lokaal reproduceerbaar:** de fallback vuurt alleen als directe SMTP faalt; vanaf een toegestaan dev-IP slaagt die juist. Test op de VPS (test-mail → controleer ERPNext **Email Queue** op `status:"Sent"` voor de sender + de Sent-folder in Webmail).

### CalDAV-agenda (privé-agenda's via mail-vault creds)

"Agenda toevoegen" ([Agenda.tsx](packages/frontend/src/pages/Agenda.tsx)) ondersteunt naast publieke iCal-feeds ook **geauthenticeerde CalDAV-collecties** (bv. `https://mail.3bm.co.nl/dav/cal/`, een Stalwart-server). Server-endpoint `GET /api/calendar/ical` ([index.ts](packages/server/src/index.ts)):

- **Creds zonder nieuw secret**: de subscription (`CustomCalendar`) krijgt een optionele `accountId` (een Y-app vault-mailaccount). De server resolvet de Basic-Auth-creds server-side uit de vault (`getDecryptedMailCredentials`, zelfde `yAppUserKey`-pad als mailSend) — géén wachtwoord in localStorage. Sluit aan op het credential-only threat-model.
- **Discovery (hand-rolled, geen extra dep)**: PROPFIND Depth:0 voor `current-user-principal` + `calendar-home-set` → PROPFIND Depth:1 op de home om calendar-collecties te vinden (resourcetype bevat `<calendar>`) → per kalender een `calendar-query` REPORT met `<calendar-data>`. De VCALENDAR/VEVENT-blokken gaan door dezelfde `parseICalEvents` als het publieke pad. XML wordt namespace-prefix-agnostisch geparsed (regex op local element names) + XML-unescaped.
- **`&debug=1`** (auth vereist) geeft de discovery-diagnostiek terug (authUser, homeUrl, calendarHrefs, REPORT-statussen) — handig bij CalDAV-servervarianten.
- **Niet doen**: een per-event GET-loop; gebruik de `calendar-query` REPORT (alle events in één respons per kalender). Géén tijd-venster-filter nu (haalt álle events op) — optimalisatie als de payload te groot wordt.

### Request-storm & IMAP-rate-limit preventie (load-bearing operationeel)

Een achtergrond-poll-/long-poll-loop zonder rem kan NC Talk/ERPNext platleggen — en een IMAP-server (Stalwart) reageert op een connectie-storm met een **per-account rate-limit** (`read ECONNRESET` / TLS-drop op álle `/api/mail/*`). Vier samenwerkende remmen:

1. **NC Talk long-poll min-spacing** ([messenger-longpoll.ts](packages/server/src/messenger-longpoll.ts)): min 2s tussen iteratie-starts + alleen `messenger-changed` broadcasten bij een écht nieuwer bericht-id. Zonder dit spint de loop bij een instant/fout NC-antwoord (structurele 502 via reverse-proxy, of een echo) op volle snelheid → broadcast-storm → browser pollt `all-conversations` per broadcast.
2. **BackgroundSync poll-throttle** ([BackgroundSyncProvider.tsx](packages/frontend/src/lib/BackgroundSyncProvider.tsx)): `pollMessengerOnce`/`pollMailOnce` max 1×/8s (module-niveau → dekt scheduled tick + WS-event-burst + focus + meerdere provider-instances). Raakt alleen de **badge-tellingen**; de open conversatie/mail update direct via het ongethrottelde `y-app:*-changed`-window-event → geen latency-regressie op berichten.
3. **DataContext refreshData-throttle** ([DataContext.tsx](packages/frontend/src/lib/DataContext.tsx)): max 1×/60s na de eerste load (de `visibilitychange`/`focus`-listener refetchte anders álle org-data bij elke tab-focus → gemeten 143×). Context-value gememo'iseerd. NB: `fetchAll("Project")` pagineert — bij ~5000 projecten ~11 requests/load; de throttle houdt dat op 1 load/min.
4. **IMAP-connectie-backoff** ([mail.ts](packages/server/src/mail.ts) `MailAccountCache.ensureConnected`): exponentiële backoff (15s→30s→…→5min cap, reset bij succes). Binnen het venster gooit `ensureConnected` snel een fout i.p.v. opnieuw te verbinden — anders houdt Y-app de server-side rate-limit zélf warm (de 30s-background-refresh + warmup + pollers blijven poken, en elke poke ververst `lastActivity` zodat de connectie-timeout nooit afgaat → de throttle dooft nooit uit). **Herstel uit zo'n throttle vereist een prod-restart** (verbreekt de pokende timers/connecties); de backoff voorkomt terugkeer.

Plus **warmup-spacing** ([Webmail.tsx](packages/frontend/src/pages/Webmail.tsx) `warmupAllFolders`): 750ms tussen batches (concurrency 2) zodat een grote mappenboom (100+ mappen) geen IMAP-command-burst geeft die de rate-limit triggert.

### Gedeelde mailbox: credential-resolutie via primary-delegatie

`mailTestShared` (toevoegen) verbindt met de shared mailbox via het **primary-account z'n gedelegeerde OAuth-token** (`{...primary, user: shared}`, het "direct"-patroon) — dat werkt mits de primary FullAccess heeft. De normale mail-flow moet dat ook doen. In `getCredentials` ([mail.ts](packages/server/src/mail.ts)) geldt daarom: wanneer de request `primaryEmail` meestuurt én die ≠ `email` (= shared-mailbox-marker uit `buildQuery`), wordt **eerst** de primary-delegatie geprobeerd, vóór een directe `resolveCredentials(email)`.

**Waarom (load-bearing):** een gedeelde O365-mailbox kan een **eigen** ERPNext Email Account hebben met een eigen OAuth-token dat **géén IMAP-sessie kan openen** (typisch een *unlicensed* shared mailbox → O365 sluit de verbinding direct: "Unexpected close" / "Failed to receive greeting" → `/api/mail/folders` 500, `/api/mail/messages` 502). Als `getCredentials` dat eigen account "direct" resolvet en gebruikt, wordt de werkende delegatie overgeslagen en is de mailbox onbruikbaar. **Niet doen**: de directe resolve vóór de delegatie zetten voor shared-requests. (Dit was de oorzaak van "shared mailbox stopte ineens" — zodra administratie@… een eigen Email Account kreeg, ging de directe resolve slagen met het kapotte token.)

### Messenger long-poll cursor: lastGivenId

NC Talk emit elke reactie (👍) en edit/delete als eigen ChatMessage met een id ná het laatste zichtbare bericht; de noise-filter in `ncGetMessages` stript die. Daardoor kon een `lookIntoFuture=1` long-poll een lege `data:[]` (200) instant teruggeven, terwijl de client zijn cursor (afgeleid van het laatste *zichtbare* bericht) niet vooruit kon zetten → tight re-poll-storm ("berichten blijft laden"). Fix: `ncGetMessages` retourneert `lastGivenId` (max raw NC-id incl. gefilterde rijen); de client-long-poll pollt vanaf `max(laatst-zichtbaar, lastGivenId)` → cursor schuift voorbij de gefilterde events. + min 1s spacing als vangnet.

### TS↔Rust drift-safety: parity-tests + gedeelde wire-shapes

Web (TS-server) en desktop (Rust + fetch-adapter) zijn twee losse engines; drie lagen bewaken dat ze niet stil uit elkaar lopen. **CI (`ci.yml`) draait beide testsuites** — zonder die stap bewaakt niets hieronder iets.

- **[`packages/server/src/desktop-parity.test.ts`](packages/server/src/desktop-parity.test.ts)** — (1) `DESKTOP_CONFIG_KEYS` moet synchroon zijn tussen `index.ts` (TS) en `commands.rs` (Rust); (2) élke `/api/*`-server-route moet op desktop mechanisch gedekt zijn door de adapter-if-chain, gedekt door de ERPNext-proxy-fallback (`/api/resource/*`), of expliciet geclassificeerd in `WEB_ONLY` / `KNOWN_GAPS` / `DESKTOP_ONLY` (met motivering). Een nieuwe route zonder classificatie faalt `npm test` — dat dwingt de keuze "spiegelen of documenteren" af (de 501/4xx-klasse die "map verwijderen" ooit trof). Onbekende route **niet** blind allowlisten: eerst uitzoeken.
- **[`packages/frontend/src/i18n/locale-parity.test.ts`](packages/frontend/src/i18n/locale-parity.test.ts)** — nl/en/de hebben strikt identieke keys (de is sinds 2026-07 volledig bijgetrokken). Nieuwe vertaalkey → in alle drie de bundles in dezelfde commit.
- **[`packages/frontend/src/lib/api-shapes.ts`](packages/frontend/src/lib/api-shapes.ts)** — gedeelde response-envelope-types (mail + messenger; overige domeinen gefaseerd). Server bindt met `res.json(payload satisfies …Response)` (type-only import; esbuild/tsx strippen het weg — hiervoor staat server-tsconfig op `noEmit` zonder `rootDir`); de desktop-adapter gebruikt `jsonResponse<T>` + getypte `invoke<…>`. Nieuwe gespiegelde endpoints horen hun envelope hier te declareren en aan beide kanten te binden.

### Frontend fetch-dedup

[`packages/frontend/src/lib/instances.ts`](packages/frontend/src/lib/instances.ts) `installFetchInterceptor` voegt naast de `X-Y-App-Instance` header een **in-flight dedup-wrapper** toe voor GET `/api/*` requests. Met dezelfde `(instanceId, url)`-key delen concurrent callers één pending Promise; elk krijgt een `response.clone()`. 100 ms grace-window waarin volgende callers ook dedupen, daarna wordt de entry geëvict.

Voorkomt dat React StrictMode double-mounts of dubbele useEffect-fires twee identieke server-calls genereren. Vooral relevant bij Webmail-mount waar `/api/yapp/me`, `/api/auth/me`, `/api/instances/<id>/mail-accounts` historisch 2× werden gefired.

### IMAP-connection lifecycle: 30 min + 24 u splitsing

[`MailAccountCache`](packages/server/src/mail.ts) heeft twee timers voor inactiviteit:

- **`CONNECTION_TIMEOUT = 30 * 60_000`** — sluit het IMAP-socket bij geen activiteit. Reden: NAT-routers / Cloudflare killen idle TCP na 5-30 min; O365 heeft max concurrent IMAP-connections per account; en OAuth-tokens hebben 1 u TTL. `destroy()` sluit de socket maar **bewaart de in-memory caches** (`folders`, `folderMessages`, `fullMessages`, `attachmentCache`) zodat de eerste klik na re-connect instant is.
- **`CACHE_LIFETIME = 7 * 24 * 60 * 60_000`** — pas na **7 dagen** stilte wordt de hele `MailAccountCache` ook uit `accountCaches` verwijderd en zijn alle in-memory caches leeg. Voorkomt unbounded growth bij gebruikers die shared mailboxes toevoegen / verwijderen of meerdere instances roteren. 7 dagen i.p.v. eerdere 24u zodat een werkweek vakantie geen warmup-trigger geeft (browser-IDB-cache blijft sowieso staan, dus user merkt sowieso niets).

Practisch: laptop dichtklappen tussen lunch en daarna kost **0 s** herverbinding voor de gebruiker (alleen IMAP-socket reconnect ~1-2 s; alle data nog in geheugen). Pas na een hele week uitloggen wordt alles cold.

### Mail-acties met delete-confirm + toast-feedback

- **Verwijderen** in INBOX of submappen: backend doet **soft-delete naar Verwijderde items** zonder confirm-popup (Outlook-stijl). Recovery via Verwijderde items zelf.
- **Verwijderen** binnen Verwijderde items (`f.specialUse === "\\Trash"` of naam matched `verwijderde|deleted|prullenbak|trash`): JS `window.confirm` met `t("webmail.confirm_permanent_delete")`. Permanente IMAP-delete.
- Bij delete/move-failure (server-fout, network-drop): `setToast(t("webmail.delete_failed"))` / `"webmail.move_failed"`. Was eerder een silent `.catch(() => {})` zonder gebruikersfeedback.

### Email project-koppeling: drie triggers, twee gedragingen

Een mail kan gekoppeld worden aan een ERPNext-project (groene chip rechtsboven). Drie manieren waarop dat kan ontstaan, met expliciet verschillend persistentie-gedrag:

| Trigger | Opslag | Persistent? |
|---|---|---|
| Handmatige "Koppel aan project"-klik | [`setEmailProjectLink`](packages/frontend/src/lib/email-project-links.ts): in-memory cache + localStorage (sync) + server `PUT /api/instances/:id/settings/email-project-links` (fire-and-forget) | ✅ Cross-device binnen Y-app instance |
| Drag-into-folder (`handleMoveMsg` matched een project) | Idem — roept `setEmailProjectLink` aan | ✅ Persistent |
| Folder-auto-detect bij open (mail zit al in `[IN] 3001 …` folder) | Alleen runtime in React state, via [`matchProjectFromFolder`](packages/frontend/src/lib/project-folder-match.ts) | ❌ Runtime-only — folder-naam blijft bron van waarheid |

**Waarom auto-detect runtime is, niet persistent:** sleutel in server-store is `${uid}:${subject}`. UID is per IMAP-folder; bij move naar andere folder verandert de UID → opgeslagen link zou stale worden. Folder-detect leest live de huidige folder-naam, dus altijd actueel bij rename/move. Voor uitwerking en motivatie: zie sessie-archeologie 28-mei in [`Projects OWN/Management/IDEE.md`](../../Projects%20OWN/Management/IDEE.md) ("Shared postvak per project via ERPNext Communication" — toekomstige spec).

**Hydratie bij Webmail-mount + MailView-mount:** `hydrateEmailProjectLinks()` fetcht eerst server-state en overschrijft de in-memory cache. Daarna re-resolved de msg-effect linkedProject voor de huidige mail (race-vrij — anders zou setLinkedProject de fetch verliezen).

### "Sorteer in projectmap": per-mail folder-voorspeller (bulk)

De bulk-actiebalk in [Webmail.tsx](packages/frontend/src/pages/Webmail.tsx) heeft naast "Verplaatsen" (alles naar één map) en "Verwijderen" een knop **"Sorteer in projectmap"** (`openSortModal`). Die stelt **per geselecteerde mail** een bestaande projectmap voor en verplaatst op bevestiging via een reviewscherm ([SortToProjectDialog.tsx](packages/frontend/src/components/SortToProjectDialog.tsx)). Kant-regel: een mail in INBOX(-submap) krijgt een **INBOX-submap** voorgesteld, een verzonden mail een **Sent-submap** (`isSentContext(msg._folder || activeFolder, folders)` per rij — gemengde selecties werken).

**Onderscheid met de bestaande voorspeller:** `matchProjectFromFolder` gaat **map → project** (auto-koppelen bij openen / NAS-dialog). Deze feature is het omgekeerde, **mail → map**, en combineert zes signalen (`buildProposal` in Webmail.tsx). Kernprincipe: dezelfde *personen* én *klanten* komen op meerdere projecten voor, dus geen enkel signaal beslist alléén — de kracht zit in de **combinatie** plus **IDF-zeldzaamheid** van een kenmerk.

| # | Signaal | Bron | Kosten |
|---|---------|------|--------|
| A | Bestaande koppeling (`uid:subject`) | [email-project-links.ts](packages/frontend/src/lib/email-project-links.ts) | gratis |
| B | Thread — origineel al in een projectmap | `GET /api/mail/conversation` (lui, alleen twijfelrijen, 4 parallel) | begrensd |
| C | Geleerd folder-profiel: correspondenten + onderwerp-tokens + bijlagenaam-tokens, **IDF-gewogen** | [folder-profile-match.ts](packages/frontend/src/lib/folder-profile-match.ts) uit lijst- + body-cache | gratis |
| D | Projectnummer / klantreferentie (`custom_customer_reference`, bv. `JM24-026`) in onderwerp | [project-mail-match.ts](packages/frontend/src/lib/project-mail-match.ts) | gratis |
| E | Projectnaam-tokens | project-mail-match.ts | gratis |
| F | Bijlagenamen (tekeningcodes) | body-cache (`MailMessageFull.attachments[].filename`) | gratis voor gecachte mails |

- **Opdrachtgever/afzendernaam wordt bewust NIET als los signaal gebruikt** (te veel projecten delen dezelfde klant → vals-zeker). Het bedrijf komt alleen indirect terug via C (IDF-gewogen correspondentadres).
- **Gedeelde bouwstenen**: `tokenizeForMatch` (uit [project-folder-match.ts](packages/frontend/src/lib/project-folder-match.ts)) tokeniseert overal identiek; `resolveProjectFolder` ([project-folder-resolve.ts](packages/frontend/src/lib/project-folder-resolve.ts)) mapt een gematcht project + kant naar een bestaande map (of `null` → aanmaak-optie). `DataContext` fetcht nu ook `custom_customer_reference`.
- **Ontbreekt een map voor een gematcht project** → de rij biedt "Map aanmaken: `[IN]/[OUT] {nr} {naam}`" aan; `handleSortConfirm` maakt de map (`POST /api/mail/folder`, patroon van `submitCreateFolder`) en verplaatst er direct in. Verplaatsen loopt via de bestaande `handleMoveMsg` (die de projectkoppeling meteen persist't → voedt signaal A/C voor de toekomst).
- **Alles client-side**: profielen + bijlagenamen komen uit de al warme lijst-/body-caches (geen servercalls); alleen de thread-verrijking (B) doet servercalls, lui en begrensd. Degradatie: koude cache → C/F leveren niets, D/E/B blijven werken.

### NAS-bijlage config: shared template + device-only handles

NAS-instellingen zijn bewust gesplitst tussen device-only en shared:

| Veld | Opslag | Reden |
|---|---|---|
| `correspondenceSubdir` (bv. "01 Correspondentie") | localStorage + `instance_settings` key `nas-attachment-template` | Machine-onafhankelijk — submap-naam is per-instance / per-organisatie. Sync over devices. |
| `folderTemplate` (bv. `{nr:03d} {dd-mm-yyyy} {subject}`) | Idem | Idem — template hoort cross-device gelijk te zijn. |
| `companies` map (`hasHandle` flags) | localStorage only | Per device — andere browser/device heeft geen FSA-handle. |
| FileSystemDirectoryHandles | IndexedDB only | Browser-API restrictie; handles zijn niet serialiseerbaar. |

[`lib/nasConfig.ts`](packages/frontend/src/lib/nasConfig.ts) volgt exact het email-project-links patroon: write-through (`saveSharedNasConfig` — memory + localStorage + fire-and-forget PUT) en `hydrateNasConfig()` op mount in [`NasSettingsSection.tsx`](packages/frontend/src/components/NasSettingsSection.tsx) en [`SaveToNasDialog.tsx`](packages/frontend/src/components/SaveToNasDialog.tsx). Wijziging van template op device A is direct zichtbaar op device B na page-refresh of dialog-open.

### Shared mail-component: MessageAttachments

[`packages/frontend/src/components/MessageAttachments.tsx`](packages/frontend/src/components/MessageAttachments.tsx) is **één component** voor zowel Webmail's ReadingPane als de standalone MailView popout (`/mail/view`). Vóór dit component (sessie 28-mei) waren twee eigen JSX-blokken met subtiel verschillende features — MailView miste bv. NextCloud-knoppen.

Bevat: visible/hidden attachment-filter (inline-CIDs gefilterd via [`isInlineAttachment`](packages/frontend/src/lib/attachment-utils.ts)), paperclip-counter, "Alles opslaan" / NAS / NextCloud-Alles-knoppen, per-item hover-acties (download + NextCloud single-upload), toggle voor verborgen bijlages, en strict-render: `if (visibleAtts.length === 0) return null` zodat mails met alleen sig-images geen misleidende paperclip-balk tonen.

Beide views passeren handlers (`onSaveToNas`, `onSaveToNextCloud`, etc.) en de component beheert lokaal de `showHiddenAttachments`-state. Eén bron van waarheid voor attachment-render.

---

### Desktop / Android builds

`packages/desktop/` is a Tauri 2 app that bundles the shared frontend (via the `@frontend` alias) and replaces the Express server with a Rust backend that talks to ERPNext directly. The user's vault password unlocks a **Stronghold** file (`vault.hold`) holding ERPNext credentials per instance.

Key decisions specific to this build:
- No Y-app account. The Stronghold password replaces it. "Sign out" in the account dropdown actually locks the vault (`localVaultMode` flag on `InstanceTabBar`).
- No server-side session cache. A `DashMap<instance_id, Session>` in `erpnext.rs` caches ERPNext sessions per-instance in memory for 4 hours.
- Android auto-backup is disabled at build time so Google's D2D transfer can't restore `vault.hold` without its matching `stronghold-salt.txt` (would trigger `BadFileKey`). See the `Patch AndroidManifest.xml` step in `release.yml`.
- Android APK signing uses a **stable keystore** decoded from `ANDROID_KEYSTORE_B64` secret. Do not revert to the throwaway `keytool -genkeypair` pattern or users can't update in place.
- Biometric unlock on Android: opt-in. `tauri-plugin-biometric` provides the prompt; vault password is stored as plain bytes in app-private storage (not readable by other apps without root). The opt-in modal makes the "casual physical access" threat model explicit.

#### The fetch-adapter (and the one place it does NOT apply)

The shared frontend never talks to a server on desktop: [`packages/desktop/src/adapter/fetch.ts`](packages/desktop/src/adapter/fetch.ts) installs a global `fetch` shim that routes every `/api/*` call to a Rust command via Tauri `invoke`. Most web endpoints are mirrored here (auth, instances, settings, mail, messenger, calendar, NAS), each returning the **same response envelope shape** the web frontend expects (e.g. `{ ok: true, value }` for settings) — diverge from that shape and the frontend silently ignores the data.

**The one exception that bites: `<img src="/api/...">` loads do NOT go through this adapter.** The shim only intercepts `fetch()`; native `<img>` element loads bypass it, and there is no Rust img-proxy. So any image the web build pulls via `/api/erpnext-asset` or `/api/messenger/file-proxy` would simply fail on desktop. The rule for desktop: **image bytes must be embedded as `data:` URLs**, fetched server-side in Rust (with the right auth) and inlined into the payload — never proxied via a URL the browser resolves itself.

#### Mail on desktop

There is no Y-app server to resolve IMAP/SMTP credentials, so before every mail route the adapter runs **`ensureMailCredsPopulated`**: it resolves creds in the order local Stronghold vault → ERPNext "Email Account" (password accounts only; OAuth accounts are skipped), then **persists** the result back into the vault. After that, mail works automatically (unlock → open Webmail → creds come from ERPNext, then offline/after-restart from the vault) with no manual IMAP setup. Creds never leave the device.

- **Multi-account mail** lives in the vault too (`mail_accounts[]` inside `InstanceCredentials`), because the server-side `mail_accounts` SQLite table needs a Y-app account the desktop doesn't have. The mail routes are account-aware via `?account=<id>`; with no vault account they fall back to the ERPNext auto-resolve. Settings → Email accounts manages them (add/list/edit/delete), and also **surfaces the auto-resolved single account** (the one stored in the plain `imap_*` vault fields, labelled "automatisch uit ERPNext") so it isn't invisible.
- **Offline body-cache** runs on desktop via the Rust **`mail_get_bodies`** command (`GET /api/mail/bodies`): one batched `BODY.PEEK[]` over a read-only `EXAMINE`, so it marks nothing `\Seen`. The IndexedDB body/list/attachment caches are functionally identical to the web build; recent mail opens instantly and offline.
- **Folder-list is cheap and cached.** `op_list_folders` examines only INBOX + special-use folders for unseen counts (plain subfolders are listed without a per-folder `EXAMINE`, which used to cost 100+ round-trips and block message-open / body-prefill behind the single IMAP connection). The `MailPool` additionally caches the folder list per account for ~30s (invalidated on connection errors and after create/rename), so a tab-switch doesn't re-run the full LIST.
- **BODYSTRUCTURE is never requested in the list-FETCH.** async-imap's imap-proto parser crashes on complex nested structures (forwarded `message/rfc822` with inline images); `has_attachments` is derived heuristically from the Content-Type header instead. Opening a message (`BODY.PEEK[]` + mail_parser) is robust and unaffected.
- **Inline images are embedded as `data:` URLs.** `op_get_message` / `op_get_bodies` rewrite `cid:` references in the HTML body to base64 `data:` URLs from the inline-attachment bytes (the webview can't resolve `cid:` / `/api/...` — see the fetch-adapter exception).
- **`op_get_attachment` does a single fetch** (metadata read from the parsed part) — it used to download the whole message twice.
- **Conversation-load is lightweight.** `op_get_conversation` uses fixed search folders (current + INBOX + common Sent names) instead of a full `op_list_folders`, fetches only headers for the thread list (no per-member full-body, no `\Seen`), and pageSize 50 — down from ~1118ms with a full folder-list scan + a full-body fetch per thread member.

#### Messenger on desktop

`nc_get_messages` in [`messenger.rs`](packages/desktop/src-tauri/src/messenger.rs) mirrors the web's `ncGetMessages`: ISO-8601 timestamps, attachments parsed from `messageParameters`, `isOwn` resolved via a real NC-uid lookup (`/ocs/v1.php/cloud/user`, not `actorId == email`), reactions/`parent`/edit (`lastEditTimestamp`)/delete, and the same noise-filter (reaction events, edit/delete system rows, emoji-only quoted replies). **Image previews are fetched server-side in Rust (NC Basic auth) and embedded as `data:` URLs** — see the fetch-adapter exception above; there is no `/api` img-proxy on desktop. The conversation list is sorted **pinned-first then newest** (pinned = NC `isFavorite`), matching the web (pinning itself is done in NextCloud Talk; Y-app only mirrors it).

Performance-relevant facts on desktop: the **NC-uid lookup is cached** per `(base, user)` with a ~1h TTL (DashMap) instead of an HTTP round-trip before every message-fetch; **Talk image previews are fetched in parallel** (`buffer_unordered`, bounded at 8) at **300×300** (was one sequential fetch per image at 600×600). A `/messenger`-open guard in `BackgroundSyncProvider` stops `pollMessengerOnce` from racing an open conversation over the same NC connection (mirror of the `/webmail` guard). On desktop a double-click on a conversation opens in-pane, not via `window.open` (which dead-navigates the single Tauri window).

#### Kluis-onthoud (remember-me / auto-unlock)

Opt-in "onthoud op dit apparaat" on the unlock screen stores the vault password in an **app-local file** (`vault_remember.dat` in `app_data_dir`) so the app auto-unlocks at launch. This is deliberately **not** the Windows Credential Manager / Hello — the user wanted no dependency on the Windows account. The trade-off (a process running as the same user can read the file) is stated in the opt-in text. The password is written only after a successful unlock, and cleared on password change, vault reset, and un-ticking. An `isRememberSupported` guard keeps this Windows/desktop-only; Android keeps its prompt-gated biometric path.

#### NAS project-folders (desktop-only)

The Rust **`create_project_folders`** command does a recursive `std::fs` copy of a master folder into a new, renamed project folder on the NAS (no overwrite — existing target → "map bestaat al"), and **`open_in_explorer`** opens that folder in the Windows file manager. Settings → Project-instellingen holds master path / target root / name template (`{nr} {project_name}`). ProjectDetail shows **"Maak NAS-mappen aan"** + **"Open in Verkenner"** buttons, both gated on `isDesktopApp()` so they never render in the web build. (Distinct from the web's browser-FSA / Nextcloud NAS path — this is native filesystem only.)

#### Central config sync (offline-capable employer config)

The server exposes **`GET /api/desktop-config`** (verified by the ERPNext session via URL-match), returning the non-secret `instance_settings` keys listed in `DESKTOP_CONFIG_KEYS` (activity-types, employee-activity-types, employee-visible-modules, project-template-mapping, nas-attachment-template, nas-project-folders, enabled-extensions, **and `invoice-email-defaults`**). The desktop's Rust **`sync_instance_config`** pulls these on launch and caches them locally, so it always reads from the local cache and keeps working offline. Mail accounts stay local (in the vault). Both the server `DESKTOP_CONFIG_KEYS` and the Rust list must stay in sync, or a key silently never reaches the desktop.

#### Update notification (web — not desktop — fix for an installed PWA)

`POST /api/messenger/subscribe` (`messengerSubscribe` → `setNcSession`) lets the **web** frontend push NC Talk creds into the server cache over authenticated HTTP, with the creds in the POST body (not the URL, to keep access-logs clean). This exists because in an installed PWA (Edge "app") the `/ws/events` WebSocket — the post-Wave-0a channel that normally carries the creds via `subscribe-messenger` — does not reliably establish, leaving the cache empty and every `/api/messenger/*` failing with "missing NextCloud Talk credentials" even though they were configured.

#### Desktop update notification & the deploy-pairing requirement

The desktop `UpdateBanner` compares its own version against the publicly **deployed web version** via `GET /api/app-version` (baked into the server bundle by esbuild-define). Consequence: a **desktop-only release does not bump that endpoint**, so the "new version available" banner will not fire unless a web deploy is paired with the release. **Always pair a web deploy with each desktop release** for the notification to surface. (A real in-app updater — `tauri-plugin-updater` with an updater signing keypair + a VPS-hosted signed manifest/installer — is planned but not built; the banner today only links to the Releases page for a manual reinstall.)

---

## Dev environment notes

### Desktop Rust-toolchain lokaal beschikbaar

De dev-machine heeft nu een volledige desktop-toolchain: **Rust** (via rustup) + **Visual Studio Build Tools** met de workload "Desktop development with C++" / de Windows SDK (MSVC linker). Daardoor werken `cargo build` en `cargo check` voor `packages/desktop/src-tauri` lokaal — Rust-wijzigingen (`mail.rs`, `messenger.rs`, `nas.rs`, `commands.rs`, `erpnext.rs`) kunnen nu lokaal gevalideerd worden i.p.v. blind via CI (`release.yml` / `test-build.yml`).

Er is ook een headless mail-profiler: [`packages/desktop/src-tauri/examples/mailprofile.rs`](packages/desktop/src-tauri/examples/mailprofile.rs). Hij leest `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASS` / `MAIL_SECURE` / `MAIL_FOLDER` uit de omgeving en timet `op_list_folders` / `op_list_messages` / `op_get_bodies` / `op_get_conversation` tegen een echte mailbox — handig om mail-perf-regressies te meten zonder een volledige Tauri-build (`cargo run --example mailprofile`).

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
- Conditioneel: er moeten **NC-creds in localStorage** staan onder `pref_${instanceId}_messenger_nextcloud-talk_{url,user,pass}` (zet je in Y-app Settings → Berichten → NextCloud Talk → Test verbinding). De URL **moet beginnen met `https://`** of `http://` — sinds 2026-05-28 prepend Settings die zelf als gebruiker alleen `nextcloud.3bm.cloud` invult.
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

Als je gebruiker vraagt om visuele/interactieve UI-checks die je anders alleen kunt doen door te vragen *"open DevTools en kijk wat er gebeurt"* — gebruik de Playwright MCP plugin in plaats daarvan. Hij is workspace-globaal geactiveerd (zie [`../../CLAUDE.md`](../../CLAUDE.md) sectie "Browser-automation via Playwright MCP"). Y-app-specifieke aandachtspunten:

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

**Als de Playwright MCP-tools niet zichtbaar zijn in de huidige sessie:** vraag Piet Claude Code te herstarten. De plugin start automatisch via `npx @playwright/mcp@latest` zodra hij geladen is.

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
- CLAUDE.md npm install docs voor Z: drive

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