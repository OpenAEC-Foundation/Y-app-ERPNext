# Y-next Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw uit de bestaande Y-app-frontend een single-instance Y-next SPA die zonder Bench-installatie op `/y-next` draait en rechtstreeks met ERPNext v16 leest en schrijft.

**Architecture:** Importeer één reproduceerbare Git-snapshot van Y-app in de nieuwe repository, verwijder de afzonderlijke server- en desktopruntimes en vervang Y-app-authenticatie en instancecontext door de bestaande ERPNext-sessie. Publiceer de statische Vite-build via standaard ERPNext `File`- en `Web Page`-API's; de deploymentsecret blijft uitsluitend in een lokale environmentvariabele.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Frappe Framework 16.19.0, ERPNext 16.16.0, Node.js test runner, standaard Frappe REST API.

## Global Constraints

- Werk uitsluitend in `C:\Users\rickd\Documents\GitHub\Y-app-ERPNext`.
- Bronrepository: `C:\Users\rickd\Documents\GitHub\erpnext-level-dashboard`.
- Importeer uitsluitend tracked content uit broncommit `46e6efa`; neem de bron-`.git` en niet-gecommitteerde bronwijzigingen niet mee.
- Behoud de bestaande `.git`, remote, `LICENSE` en `docs/superpowers/` van `Y-app-ERPNext`.
- Y-next ondersteunt precies één ERPNext-site per deployment.
- Doelroute: `/y-next` op `https://open-aec-studio-erp.prilk.cloud`.
- Gebruik de bestaande ERPNext-login, sessie, rollen en permissies.
- Geen Express-server, credential vault, ERPNext-sessioncache, instancekiezer of `X-Y-App-Instance`.
- Geen API-key, password of andere secret in broncode, Git, browseropslag of buildoutput.
- De deploymenttoken komt alleen uit `YNEXT_API_TOKEN`; de basis-URL komt uit `YNEXT_BASE_URL`.
- Fase 1 levert minimaal Projecten lezen en Taken aanmaken als representatieve lees- en schrijfflow.
- Webmail, IMAP, SMTP, messenger-push, desktop en Android zijn buiten scope van fase 1.
- Alle zichtbare teksten blijven via i18n lopen; NL en EN blijven synchroon.
- Push nooit zonder expliciete toestemming.

---

## Bestandsstructuur na fase 1

```text
Y-app-ERPNext/
├─ package.json                         # single-workspace scripts en Y-next metadata
├─ packages/frontend/
│  ├─ package.json                      # frontend build/test/lint
│  ├─ vite.config.ts                    # base=/y-next/, dev proxy rechtstreeks naar ERPNext
│  └─ src/
│     ├─ App.tsx                        # single-instance shell en ondersteunde routes
│     ├─ lib/
│     │  ├─ erpnext.ts                  # same-origin REST-client
│     │  ├─ erpnext.test.ts             # fetch-contracttests
│     │  ├─ session.ts                  # huidige ERPNext-gebruiker en loginredirect
│     │  ├─ session.test.ts
│     │  ├─ capabilities.ts             # fase-1 route- en moduleselectie
│     │  └─ capabilities.test.ts
│     └─ pages/
│        ├─ Projects.tsx                # directe Project-flow
│        └─ Tasks.tsx                   # directe Task-flow
├─ scripts/
│  ├─ deploy-y-next.mjs                 # build publiceren via ERPNext API
│  ├─ deploy-y-next.test.mjs
│  └─ smoke-y-next.mjs                  # productie-smoketest
└─ docs/
   ├─ superpowers/
   └─ deployment.md                     # lokale configuratie en rollback
```

`packages/server/`, `packages/desktop/`, Tauri-configuratie en servergerichte
workflows worden verwijderd zodra de single-instance frontend lokaal bouwt.

---

### Task 1: Reproduceerbare bronimport en Y-next manifest

**Files:**
- Import: tracked files uit broncommit `46e6efa`
- Preserve: `.git/`, `LICENSE`, `docs/superpowers/`
- Modify: `package.json`
- Modify: `packages/frontend/package.json`
- Delete: `packages/server/`
- Delete: `packages/desktop/`

**Interfaces:**
- Consumes: broncommit `46e6efa`
- Produces: een installeerbare single-workspace repository met `npm run build`, `npm test` en `npm run deploy`

- [ ] **Step 1: Verifieer bron en doel vóór de import**

Run:

```powershell
git -C C:\Users\rickd\Documents\GitHub\erpnext-level-dashboard rev-parse --verify 46e6efa^{commit}
git status --short --branch
git remote -v
```

Expected: de broncommit bestaat; het doel staat op `codex/y-next-architecture`
en heeft geen ongecommitteerde wijzigingen.

- [ ] **Step 2: Importeer alleen tracked bronbestanden**

Run:

```powershell
$archive = Join-Path $env:TEMP 'y-next-source-46e6efa.zip'
git -C C:\Users\rickd\Documents\GitHub\erpnext-level-dashboard archive --format=zip --output=$archive 46e6efa
Expand-Archive -LiteralPath $archive -DestinationPath C:\Users\rickd\Documents\GitHub\Y-app-ERPNext -Force
```

Expected: bronbestanden staan in de doelrepository; `.git` wijst nog naar
`OpenAEC-Foundation/Y-app-ERPNext.git`; het bestaande architectuurdocument
bestaat nog.

- [ ] **Step 3: Verwijder runtimes buiten fase 1**

Verwijder met native PowerShell-cmdlets, na controle van de absolute paden:

```powershell
Remove-Item -LiteralPath C:\Users\rickd\Documents\GitHub\Y-app-ERPNext\packages\server -Recurse
Remove-Item -LiteralPath C:\Users\rickd\Documents\GitHub\Y-app-ERPNext\packages\desktop -Recurse
```

Verwijder daarnaast uitsluitend workflows en scripts die alleen server-, Tauri-,
Android- of desktopartefacten bouwen.

- [ ] **Step 4: Maak het rootmanifest single-workspace**

Vervang de relevante velden en scripts in `package.json` door:

```json
{
  "name": "y-next",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "workspaces": ["packages/frontend"],
  "description": "Y-next — directe ERPNext v16 webinterface",
  "scripts": {
    "dev": "npm run dev -w @y-next/frontend",
    "build": "npm run build -w @y-next/frontend",
    "lint": "npm run lint -w @y-next/frontend",
    "test": "npm run test -w @y-next/frontend && node --test scripts/*.test.mjs",
    "deploy": "npm run build && node scripts/deploy-y-next.mjs",
    "smoke": "node scripts/smoke-y-next.mjs"
  }
}
```

Wijzig in `packages/frontend/package.json`:

```json
{
  "name": "@y-next/frontend",
  "version": "0.1.0"
}
```

Behoud de bestaande frontend dependencies en devDependencies.

- [ ] **Step 5: Installeer en controleer de verwachte eerste buildfout**

Run:

```powershell
npm install
npm run build
```

Expected: installatie slaagt; de build mag nog falen op verwijzingen naar
verwijderde server-/desktopfunctionaliteit. Noteer de eerste concrete fout voor
Task 4; herstel geen functionaliteit buiten de fase-1 scope.

- [ ] **Step 6: Commit de reproduceerbare import**

```powershell
git add -A
git commit -m "chore: importeer Y-app als basis voor Y-next"
```

---

### Task 2: Same-origin ERPNext API-client

**Files:**
- Modify: `packages/frontend/src/lib/erpnext.ts`
- Create: `packages/frontend/src/lib/erpnext.test.ts`
- Delete: `packages/frontend/src/lib/instances.ts`
- Modify: alle imports die uitsluitend `getActiveInstance*` uit `instances.ts` gebruiken

**Interfaces:**
- Produces: `ApiError`, `fetchList<T>()`, `fetchDocument<T>()`,
  `createDocument<T>()`, `updateDocument<T>()`, `deleteDocument()`,
  `callMethod<T>()`, `uploadFile()`, `fetchCount()`, `getFileUrl()`
- All requests: relatieve `/api/...` URL, `credentials: "same-origin"`, geen instanceheader

- [ ] **Step 1: Schrijf falende clienttests**

Maak `erpnext.test.ts` met minimaal:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, fetchList, getFileUrl } from "./erpnext.ts";

test("fetchList uses the same-origin resource API without instance headers", async () => {
  let seen: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = (async (input, init) => {
    seen = { url: String(input), init };
    return new Response(JSON.stringify({ data: [{ name: "PRJ-1" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const rows = await fetchList<{ name: string }>("Project", {
    fields: ["name"],
    limit_page_length: 20,
  });

  assert.deepEqual(rows, [{ name: "PRJ-1" }]);
  assert.match(seen!.url, /^\/api\/resource\/Project\?/);
  assert.equal(new Headers(seen!.init!.headers).has("X-Y-App-Instance"), false);
  assert.equal(seen!.init!.credentials, "same-origin");
});

test("createDocument posts JSON directly to ERPNext", async () => {
  let seenMethod = "";
  globalThis.fetch = (async (_input, init) => {
    seenMethod = init?.method || "";
    return new Response(JSON.stringify({ data: { name: "TASK-1" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const task = await createDocument<{ name: string }>("Task", {
    subject: "Y-next schrijft direct",
  });
  assert.equal(seenMethod, "POST");
  assert.equal(task.name, "TASK-1");
});

test("getFileUrl keeps same-origin file paths", () => {
  assert.equal(getFileUrl("/files/test.pdf"), "/files/test.pdf");
});
```

- [ ] **Step 2: Draai de tests en bevestig dat instanceafhankelijkheid faalt**

Run:

```powershell
npm run test -w @y-next/frontend
```

Expected: FAIL omdat `erpnext.ts` nog `instances.ts` importeert en bestands- en
cache-URL's aan een instance koppelt.

- [ ] **Step 3: Maak de client single-instance**

Pas `erpnext.ts` als volgt aan:

```ts
function cacheKey(url: string): string {
  return url;
}

export function getErpNextAppUrl(): string {
  return window.location.origin;
}

export function getErpNextLinkUrl(): string {
  return `${window.location.origin}/app`;
}

export function getFileUrl(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
}
```

Verwijder alle `getActiveInstance*`-imports, instancegescope cacheprefixen,
`/api/i/:instanceId/*`-routes en de legacy count-splitsing. Implementeer count via:

```ts
export async function fetchCount(doctype: string, filters: unknown[][] = []): Promise<number> {
  const result = await callMethod<number>("frappe.client.get_count", { doctype, filters });
  return Number(result || 0);
}
```

Houd bestaande timeouts, foutnormalisatie, caching en requestdeduplicatie in
stand, voor zover ze niet van instances afhangen.

- [ ] **Step 4: Draai clienttests en TypeScript**

Run:

```powershell
npm run test -w @y-next/frontend
npx tsc -b packages/frontend
```

Expected: alle clienttests PASS; TypeScript meldt alleen nog imports vanuit de
app-shell die in Task 4 worden verwijderd, niet vanuit `erpnext.ts`.

- [ ] **Step 5: Commit de directe client**

```powershell
git add packages/frontend/src/lib/erpnext.ts packages/frontend/src/lib/erpnext.test.ts packages/frontend/src
git commit -m "refactor: verbind frontend direct met ERPNext"
```

---

### Task 3: ERPNext-sessie zonder Y-app-account

**Files:**
- Create: `packages/frontend/src/lib/session.ts`
- Create: `packages/frontend/src/lib/session.test.ts`
- Modify: `packages/frontend/src/main.tsx`
- Delete later in Task 4: `packages/frontend/src/components/LoginPage.tsx`
- Delete later in Task 4: signup- en Y-app-accountcomponenten

**Interfaces:**
- Produces:
  `loadSession(): Promise<ERPNextSession>`
  `loginUrl(returnTo?: string): string`
  `ERPNextSession = { user: string; fullName: string; roles: string[] }`

- [ ] **Step 1: Schrijf falende sessietests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { loadSession, loginUrl } from "./session.ts";

test("loadSession reads the current ERPNext user and roles", async () => {
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("get_logged_user")) {
      return new Response(JSON.stringify({ message: "maarten@example.test" }), { status: 200 });
    }
    return new Response(JSON.stringify({
      message: { full_name: "Maarten", roles: ["Projects User", "Employee"] },
    }), { status: 200 });
  }) as typeof fetch;

  assert.deepEqual(await loadSession(), {
    user: "maarten@example.test",
    fullName: "Maarten",
    roles: ["Projects User", "Employee"],
  });
});

test("loginUrl returns to y-next", () => {
  assert.equal(loginUrl("/y-next/projects"), "/login?redirect-to=%2Fy-next%2Fprojects");
});
```

- [ ] **Step 2: Draai de tests en bevestig dat de module ontbreekt**

Run:

```powershell
node --test packages/frontend/src/lib/session.test.ts
```

Expected: FAIL met module-not-found voor `session.ts`.

- [ ] **Step 3: Implementeer de sessiemodule**

Gebruik uitsluitend publieke/sessiegebonden Frappe-methoden:

```ts
export interface ERPNextSession {
  user: string;
  fullName: string;
  roles: string[];
}

async function method<T>(name: string): Promise<T> {
  const response = await fetch(`/api/method/${name}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw Object.assign(new Error("ERPNext session unavailable"), {
    status: response.status,
  });
  return (await response.json()).message as T;
}

export async function loadSession(): Promise<ERPNextSession> {
  const user = await method<string>("frappe.auth.get_logged_user");
  const info = await method<{ full_name?: string; roles?: string[] }>(
    "frappe.desk.form.load.get_user_info",
  );
  return { user, fullName: info.full_name || user, roles: info.roles || [] };
}

export function loginUrl(returnTo = window.location.pathname + window.location.search): string {
  return `/login?redirect-to=${encodeURIComponent(returnTo)}`;
}
```

Als `get_user_info` op ERPNext v16 een andere responsevorm teruggeeft, leg de
daadwerkelijke response vast in de testfixture en pas alleen de parser aan.

- [ ] **Step 4: Draai tests**

Run:

```powershell
node --test packages/frontend/src/lib/session.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/frontend/src/lib/session.ts packages/frontend/src/lib/session.test.ts
git commit -m "feat: gebruik de bestaande ERPNext sessie"
```

---

### Task 4: Single-instance app-shell en fase-1 routes

**Files:**
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/main.tsx`
- Modify: `packages/frontend/src/components/Sidebar.tsx`
- Create: `packages/frontend/src/lib/capabilities.ts`
- Create: `packages/frontend/src/lib/capabilities.test.ts`
- Delete: `packages/frontend/src/components/InstanceTabBar.tsx`
- Delete: Y-app login/signup/instance-onboardingcomponenten
- Disable/delete from shell: webmail, messenger, terminal, Nextcloud en server-only instellingen

**Interfaces:**
- Consumes: `loadSession()`, `loginUrl()`
- Produces: `SUPPORTED_ROUTES`, `isSupportedRoute(path: string): boolean`
- Phase-1 routes: `/y-next`, `/y-next/projects`, `/y-next/tasks`

- [ ] **Step 1: Schrijf de capabilitytest**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedRoute, SUPPORTED_ROUTES } from "./capabilities.ts";

test("phase 1 exposes only direct ERPNext routes", () => {
  assert.deepEqual(SUPPORTED_ROUTES.map((route) => route.path), [
    "/",
    "/projects",
    "/tasks",
  ]);
  assert.equal(isSupportedRoute("/projects"), true);
  assert.equal(isSupportedRoute("/webmail"), false);
  assert.equal(isSupportedRoute("/settings/extensions"), false);
});
```

- [ ] **Step 2: Draai de test en bevestig dat de module ontbreekt**

Run:

```powershell
node --test packages/frontend/src/lib/capabilities.test.ts
```

Expected: FAIL met module-not-found.

- [ ] **Step 3: Implementeer de fase-1 capabilitylijst**

```ts
export const SUPPORTED_ROUTES = [
  { path: "/", labelKey: "nav.dashboard" },
  { path: "/projects", labelKey: "nav.projects" },
  { path: "/tasks", labelKey: "nav.tasks" },
] as const;

export function isSupportedRoute(path: string): boolean {
  return SUPPORTED_ROUTES.some((route) => route.path === path);
}
```

- [ ] **Step 4: Vervang de app-root door ERPNext-sessiebootstrap**

De app-root heeft drie toestanden:

```tsx
type SessionState =
  | { status: "loading" }
  | { status: "ready"; session: ERPNextSession }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };
```

Gedrag:

```tsx
useEffect(() => {
  loadSession()
    .then((session) => setSessionState({ status: "ready", session }))
    .catch((error: { status?: number; message?: string }) => {
      setSessionState(error.status === 401 || error.status === 403
        ? { status: "unauthenticated" }
        : { status: "error", message: error.message || "ERPNext is niet bereikbaar" });
    });
}, []);
```

Bij `unauthenticated` toont de app één knop die naar `loginUrl()` navigeert.
Verwijder Y-app login, signup, instancehydrate, `InstanceTabBar`,
`BackgroundSyncProvider` en de per-instance routerkey.

- [ ] **Step 5: Beperk router en sidebar tot fase 1**

Mount:

```tsx
<BrowserRouter basename="/y-next">
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/projects" element={<Projects />} />
    <Route path="/tasks" element={<Tasks />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
</BrowserRouter>
```

Laat de Sidebar dezelfde drie items uit `SUPPORTED_ROUTES` renderen. Verwijder
geen pagebestanden die later bruikbaar kunnen zijn; verwijder wel imports uit de
actieve bundel die server-only modules meetrekken.

- [ ] **Step 6: Draai test, TypeScript en build**

Run:

```powershell
npm run test -w @y-next/frontend
npx tsc -b packages/frontend
npm run build
```

Expected: alle tests PASS; TypeScript en Vite-build slagen zonder imports uit
`packages/server`, desktopcode, `instances.ts` of `X-Y-App-Instance`.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "refactor: maak Y-next single-instance"
```

---

### Task 5: Directe Project- en Task-flow

**Files:**
- Modify: `packages/frontend/src/pages/Projects.tsx`
- Modify: `packages/frontend/src/pages/Tasks.tsx`
- Create: `packages/frontend/src/lib/task-create.ts`
- Create: `packages/frontend/src/lib/task-create.test.ts`
- Modify: `packages/frontend/src/i18n/nl.json`
- Modify: `packages/frontend/src/i18n/en.json`

**Interfaces:**
- Consumes: `fetchList`, `fetchDocument`, `createDocument`, `updateDocument`
- Produces:
  `buildTaskPayload(input: TaskDraft): Record<string, unknown>`
  `TaskDraft = { subject: string; project?: string; description?: string }`

- [ ] **Step 1: Schrijf de payloadtest**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildTaskPayload } from "./task-create.ts";

test("buildTaskPayload produces a minimal ERPNext v16 Task", () => {
  assert.deepEqual(buildTaskPayload({
    subject: "Controleer Y-next",
    project: "PRJ-1",
    description: "Direct via ERPNext",
  }), {
    subject: "Controleer Y-next",
    project: "PRJ-1",
    description: "Direct via ERPNext",
    status: "Open",
  });
});

test("buildTaskPayload rejects an empty subject", () => {
  assert.throws(() => buildTaskPayload({ subject: " " }), /subject/i);
});
```

- [ ] **Step 2: Draai de test en bevestig dat de module ontbreekt**

Run:

```powershell
node --test packages/frontend/src/lib/task-create.test.ts
```

Expected: FAIL met module-not-found.

- [ ] **Step 3: Implementeer de pure payloadbuilder**

```ts
export interface TaskDraft {
  subject: string;
  project?: string;
  description?: string;
}

export function buildTaskPayload(input: TaskDraft): Record<string, unknown> {
  const subject = input.subject.trim();
  if (!subject) throw new Error("Task subject is required");
  return {
    subject,
    ...(input.project ? { project: input.project } : {}),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    status: "Open",
  };
}
```

- [ ] **Step 4: Sluit Projecten en Taken uitsluitend op standaard APIs aan**

Projectlijst:

```ts
fetchList("Project", {
  fields: ["name", "project_name", "status", "percent_complete", "customer"],
  order_by: "modified desc",
  limit_page_length: 100,
});
```

Taakschrijven:

```ts
const created = await createDocument("Task", buildTaskPayload(draft));
```

Verwijder uit deze twee pagina's alle calls naar `/api/i/`, `/api/yapp/`,
`/api/instances/` en custom Express-methoden. Functionaliteit die zo'n endpoint
vereist wordt in fase 1 verborgen met een i18n-melding, niet gesimuleerd.

- [ ] **Step 5: Houd NL en EN synchroon**

Voeg in beide bundels exact dezelfde keys toe:

```json
{
  "y_next.direct_mode": "Rechtstreeks verbonden met ERPNext",
  "y_next.unsupported_phase_1": "Deze functie volgt in een volgende Y-next fase"
}
```

Gebruik uiteraard een Nederlandse waarde in `nl.json`.

- [ ] **Step 6: Draai tests en build**

Run:

```powershell
npm run test -w @y-next/frontend
npm run build
```

Expected: PASS; de locale-paritytest slaagt.

- [ ] **Step 7: Read-only contracttest tegen ERPNext**

Run met lokaal ingestelde variabelen:

```powershell
$headers = @{ Authorization = "token $env:YNEXT_API_TOKEN"; Accept = "application/json" }
Invoke-RestMethod "$env:YNEXT_BASE_URL/api/resource/Project?fields=[`"name`",`"project_name`"]&limit_page_length=1" -Headers $headers
```

Expected: HTTP 200 met `data`; log nooit de token.

- [ ] **Step 8: Commit**

```powershell
git add packages/frontend/src
git commit -m "feat: voeg directe project- en taakflow toe"
```

---

### Task 6: Vite-configuratie voor `/y-next`

**Files:**
- Modify: `packages/frontend/vite.config.ts`
- Modify: `packages/frontend/index.html`
- Create: `packages/frontend/src/lib/base-path.test.ts`

**Interfaces:**
- Produces: assets met `/y-next/` als buildbasis
- Dev proxy: `/api`, `/files`, `/private/files` rechtstreeks naar `VITE_ERPNEXT_URL`

- [ ] **Step 1: Schrijf een configcontracttest**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import config from "../../vite.config.ts";

test("vite builds Y-next below /y-next/", () => {
  const resolved = typeof config === "function"
    ? config({ command: "build", mode: "production", isSsrBuild: false, isPreview: false })
    : config;
  assert.equal(resolved.base, "/y-next/");
});
```

- [ ] **Step 2: Draai test en bevestig de huidige verkeerde base**

Run:

```powershell
node --test packages/frontend/src/lib/base-path.test.ts
```

Expected: FAIL omdat `base` nog niet `/y-next/` is.

- [ ] **Step 3: Configureer Vite**

De kern van `vite.config.ts` wordt:

```ts
const erpnextTarget = process.env.VITE_ERPNEXT_URL || "https://open-aec-studio-erp.prilk.cloud";

export default defineConfig({
  base: "/y-next/",
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: "dist", emptyOutDir: true, manifest: true },
  server: {
    proxy: {
      "/api": { target: erpnextTarget, changeOrigin: true, secure: true },
      "/files": { target: erpnextTarget, changeOrigin: true, secure: true },
      "/private/files": { target: erpnextTarget, changeOrigin: true, secure: true },
    },
  },
});
```

Verwijder de Express- en WebSocket-proxies en het servergerichte
`vite-plugin-dashboard` als dit plugin buildoutput van de verwijderde server
verwacht.

- [ ] **Step 4: Draai test en inspecteer buildoutput**

Run:

```powershell
node --test packages/frontend/src/lib/base-path.test.ts
npm run build
rg -n "X-Y-App-Instance|y-app.impertio.app" packages/frontend/dist
$distText = Get-ChildItem packages/frontend/dist -Recurse -File | Get-Content -Raw
if ($env:YNEXT_API_TOKEN -and $distText.Contains($env:YNEXT_API_TOKEN)) { throw "Deployment token found in build output" }
```

Expected: test en build PASS; `rg` retourneert geen matches.

- [ ] **Step 5: Commit**

```powershell
git add packages/frontend
git commit -m "build: configureer Y-next voor ERPNext hosting"
```

---

### Task 7: API-deploy zonder Bench

**Files:**
- Create: `scripts/deploy-y-next.mjs`
- Create: `scripts/deploy-y-next.test.mjs`
- Create: `scripts/smoke-y-next.mjs`
- Create: `docs/deployment.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  `requiredEnv(env): { baseUrl: string; token: string }`
  `buildWebPageHtml(assets): string`
  `deploy({ baseUrl, token, distDir }): Promise<DeployResult>`
- `DeployResult = { route: "y-next"; files: string[]; webPageName: string }`

- [ ] **Step 1: Schrijf falende deploytests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildWebPageHtml, requiredEnv } from "./deploy-y-next.mjs";

test("requiredEnv refuses missing deployment secrets", () => {
  assert.throws(() => requiredEnv({}), /YNEXT_BASE_URL/);
});

test("page HTML loads only uploaded Y-next assets", () => {
  const html = buildWebPageHtml({
    scripts: ["/files/y-next/index-abc.js"],
    styles: ["/files/y-next/index-def.css"],
  });
  assert.match(html, /id="root"/);
  assert.match(html, /src="\/files\/y-next\/index-abc\.js"/);
  assert.match(html, /href="\/files\/y-next\/index-def\.css"/);
  assert.doesNotMatch(html, /token|api[_-]?key|secret/i);
});
```

- [ ] **Step 2: Draai tests en bevestig dat het deployscript ontbreekt**

Run:

```powershell
node --test scripts/deploy-y-next.test.mjs
```

Expected: FAIL met module-not-found.

- [ ] **Step 3: Implementeer environmentvalidatie en HTML-builder**

```js
export function requiredEnv(env) {
  if (!env.YNEXT_BASE_URL) throw new Error("YNEXT_BASE_URL is required");
  if (!env.YNEXT_API_TOKEN) throw new Error("YNEXT_API_TOKEN is required");
  return {
    baseUrl: env.YNEXT_BASE_URL.replace(/\/+$/, ""),
    token: env.YNEXT_API_TOKEN,
  };
}

export function buildWebPageHtml({ scripts, styles }) {
  const links = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("");
  const tags = scripts.map((src) => `<script type="module" src="${src}"></script>`).join("");
  return `<div id="root"></div>${links}${tags}`;
}
```

- [ ] **Step 4: Implementeer upload en Web Page-upsert**

Het script:

1. leest `packages/frontend/dist/.vite/manifest.json`;
2. uploadt elk benodigd asset via `POST /api/method/upload_file` als publieke
   `File`;
3. zoekt `Web Page` met route `y-next`;
4. maakt of wijzigt het document met:

```js
{
  title: "Y-next",
  route: "y-next",
  published: 1,
  content_type: "HTML",
  main_section: buildWebPageHtml(uploadedAssets),
}
```

Gebruik voor elke API-call:

```js
const headers = {
  Authorization: `token ${token}`,
  Accept: "application/json",
};
```

Log uitsluitend HTTP-status, route en bestandsnamen; log nooit headers of token.
Bij een mislukte assetupload wordt de `Web Page` niet bijgewerkt.

- [ ] **Step 5: Implementeer productie-smoketest**

`smoke-y-next.mjs` controleert zonder secrets te printen:

```js
const response = await fetch(`${baseUrl}/y-next`);
if (!response.ok) throw new Error(`Y-next route returned ${response.status}`);
const html = await response.text();
if (!html.includes('id="root"')) throw new Error("Y-next root is missing");
```

Voeg daarna een geauthenticeerde read-only controle toe voor
`/api/method/frappe.auth.get_logged_user`.

- [ ] **Step 6: Documenteer lokaal deployment**

`docs/deployment.md` bevat:

```powershell
$env:YNEXT_BASE_URL = "https://open-aec-studio-erp.prilk.cloud"
$env:YNEXT_API_TOKEN = "<API key>:<API secret>"
npm run deploy
npm run smoke
Remove-Item Env:\YNEXT_API_TOKEN
```

Leg uit dat de token lokaal blijft, niet in `.env` hoeft te staan en na gebruik
uit de shell kan worden verwijderd. Voeg `.env*` en deployment-responsbestanden
toe aan `.gitignore`.

- [ ] **Step 7: Draai deployunittests**

Run:

```powershell
node --test scripts/deploy-y-next.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add scripts docs/deployment.md .gitignore package.json
git commit -m "feat: publiceer Y-next via de ERPNext API"
```

---

### Task 8: Publiceer en verifieer de eerste Y-next build

**Files:**
- Runtime mutation: ERPNext `File`- en `Web Page`-documenten
- Modify only on failure: files implicated by test evidence

**Interfaces:**
- Consumes: `npm run deploy`, `npm run smoke`
- Produces: werkende `/y-next` route met directe Project-read en Task-create

- [ ] **Step 1: Voer alle lokale kwaliteitspoorten uit**

Run:

```powershell
npm test
npm run lint
npm run build
rg -n "X-Y-App-Instance|y_app_session|/api/yapp|/api/instances" packages/frontend/dist
$distText = Get-ChildItem packages/frontend/dist -Recurse -File | Get-Content -Raw
if ($env:YNEXT_API_TOKEN -and $distText.Contains($env:YNEXT_API_TOKEN)) { throw "Deployment token found in build output" }
git diff --check
git status --short
```

Expected: tests, lint en build PASS; secrets en verwijderde architectuurtermen
komen niet voor in buildoutput; worktree is schoon.

- [ ] **Step 2: Controleer API-identiteit en versie read-only**

Run:

```powershell
$headers = @{ Authorization = "token $env:YNEXT_API_TOKEN"; Accept = "application/json" }
Invoke-RestMethod "$env:YNEXT_BASE_URL/api/method/frappe.auth.get_logged_user" -Headers $headers
Invoke-RestMethod "$env:YNEXT_BASE_URL/api/method/frappe.utils.change_log.get_versions" -Headers $headers
```

Expected: gebruiker `maarten@3bm.co.nl`, Frappe `16.19.0`, ERPNext `16.16.0`.

- [ ] **Step 3: Deploy**

Run:

```powershell
npm run deploy
```

Expected: alle assets uploaden; `Web Page` route `y-next` wordt aangemaakt of
bijgewerkt; output bevat geen token.

- [ ] **Step 4: Draai automatische smoke**

Run:

```powershell
npm run smoke
```

Expected: route HTTP 200, root aanwezig, geauthenticeerde API-check slaagt.

- [ ] **Step 5: Browsercontrole**

Controleer in een ingelogde ERPNext-sessie:

1. `/y-next` opent zonder tweede login;
2. Projecten toont toegestane ERPNext-projecten;
3. maak een taak met onderwerp `Y-next smoke <datum-tijd>`;
4. controleer dat de taak in ERPNext bestaat;
5. verwijder uitsluitend dit herkenbare testrecord via de standaard API.

Expected: alle stappen werken binnen de ERPNext-permissies van de ingelogde
gebruiker.

- [ ] **Step 6: Registreer het resultaat**

Voeg aan `docs/deployment.md` een sectie “Eerste geverifieerde deployment” toe
met datum, route, Frappe-/ERPNext-versies en alleen niet-gevoelige buildmetadata.

- [ ] **Step 7: Commit de verificatiedocumentatie**

```powershell
git add docs/deployment.md
git commit -m "docs: registreer eerste Y-next deployment"
```

---

### Task 9: Eindcontrole en fase-2-grens

**Files:**
- Modify: `README.md`
- Create: `docs/email-phase-2.md`

**Interfaces:**
- Produces: duidelijke ontwikkelstart, huidige scope en aparte ingang voor het e-mailontwerp

- [ ] **Step 1: Herschrijf README voor Y-next**

De README bevat minimaal:

```markdown
# Y-next

Y-next is een single-instance webinterface voor ERPNext v16. De SPA draait op
dezelfde ERPNext-site, gebruikt de bestaande ERPNext-sessie en leest en schrijft
via de standaard Frappe/ERPNext API.

## Ontwikkelen

1. `npm install`
2. Stel `VITE_ERPNEXT_URL` lokaal in.
3. `npm run dev`

## Publiceren

Zie `docs/deployment.md`.
```

Verwijder claims over multi-instance, Express, de vault en desktop uit de
actuele productbeschrijving; historische changelogcontent hoeft niet als
productdocumentatie te worden meegenomen.

- [ ] **Step 2: Leg alleen de e-mailonderzoeksvragen vast**

`docs/email-phase-2.md` bevat exact deze beslispunten:

```markdown
# E-mail — fase 2

1. Welke ontvangen berichten zijn beschikbaar als `Communication`?
2. Welke verzendstatus en foutdetails zijn beschikbaar via `Email Queue`?
3. Welke velden van `Email Account` mag de huidige gebruiker lezen?
4. Kan de gewenste mailboxervaring zonder directe IMAP-map- en berichttoegang?
5. Welke bestaande Y-app-mailfuncties vervallen wanneer ERPNext de bron van
   waarheid wordt?
```

Voeg nog geen IMAP-, SMTP- of mailbridgecode toe.

- [ ] **Step 3: Volledige eindverificatie**

Run:

```powershell
npm test
npm run lint
npm run build
git diff --check
git status --short --branch
```

Expected: alles PASS; alleen bewust nog niet gecommitteerde wijzigingen worden
getoond.

- [ ] **Step 4: Commit**

```powershell
git add README.md docs/email-phase-2.md
git commit -m "docs: beschrijf Y-next en grens met e-mail fase 2"
```

## Definition of Done

- De nieuwe repository bevat een reproduceerbare Y-app-snapshot en behoudt haar
  eigen Git-historie.
- `packages/server` en `packages/desktop` zijn niet langer onderdeel van fase 1.
- De frontend bevat geen multi-instance- of Y-app-accountbootstrap.
- `/y-next` gebruikt de bestaande ERPNext-sessie.
- Projecten worden rechtstreeks gelezen en een taak wordt rechtstreeks
  aangemaakt via standaard ERPNext APIs.
- De build wordt zonder Bench via de ERPNext API gepubliceerd.
- Tests, lint, TypeScript, build, secret-scan en browser-smoke slagen.
- E-mail is expliciet afgescheiden als fase 2.
