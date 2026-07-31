# Mail-list IndexedDB cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verplaats maillijst-cache van localStorage (50 folders LRU) naar IndexedDB (alle folders, geen LRU), met achtergrond-warmup en migratie. Daarnaast: server `CACHE_LIFETIME` 24u → 7 dagen.

**Architecture:** Nieuwe IndexedDB wrapper `lib/mail-cache-db.ts` met async API (zelfde shape als huidige sync helpers). Webmail.tsx call-sites worden `await`-ed. Migratie dual-write voor 1 release; lees-pad valt terug op localStorage als IDB leeg is. Achtergrond-warmup bij Webmail-mount, 5 parallel, niet-blocking.

**Tech Stack:** TypeScript, React 19 (Webmail.tsx), Browser IndexedDB API (native, geen deps), Express server (mail.ts). Geen test-framework in project — verificatie via Playwright MCP en handmatig via browser DevTools.

**Project conventies (uit CLAUDE.md):**
- Werk in branch (huidig: `feature/email-attachments-to-nas` of nieuwe branch `feature/mail-indexeddb-cache`)
- Nooit pushen zonder vragen
- npm install op Z: drive faalt vanuit root — per-package install met `--legacy-peer-deps` indien nodig (NIET nodig voor deze taak, geen nieuwe deps)
- Dev-modus: lokale server (`cd packages/server && npm run dev`) + Vite tegen productie (`$env:VITE_API_TARGET="https://y-app.impertio.app"; npx vite --port 5173 --strictPort`) — server-changes vereisen lokale server

---

## File Structure

| Bestand | Status | Verantwoordelijkheid |
|---|---|---|
| `packages/frontend/src/lib/mail-cache-db.ts` | NIEUW | IndexedDB open/transactie wrapper + public API (read/persist/list/clear/migrate) |
| `packages/frontend/src/pages/Webmail.tsx` | MODIFY | Vervang sync localStorage-helpers door async IDB-calls; voeg warmup-effect toe |
| `packages/server/src/mail.ts` | MODIFY | `CACHE_LIFETIME` 24u → 7d |
| `packages/frontend/src/pages/MailView.tsx` | CHECK | Standalone popout-view; gebruikt mogelijk dezelfde cache — checken in Task 6 |

---

## Task 1: Server-side CACHE_LIFETIME → 7 dagen

**Files:**
- Modify: `packages/server/src/mail.ts:558`

- [ ] **Step 1: Lokaliseer en wijzig de constante**

Open `packages/server/src/mail.ts` en wijzig regel 558:

```typescript
// Van:
  private static readonly CACHE_LIFETIME = 24 * 60 * 60_000;      // 24 u
// Naar:
  private static readonly CACHE_LIFETIME = 7 * 24 * 60 * 60_000;  // 7 dagen
```

Voeg ook een korte comment-update toe direct daarboven (regel 553-556 commentblok) om de motivatie vast te leggen:

```typescript
  //  - CACHE_LIFETIME: pas na X uur stilte gooi we ook de in-memory caches
  //    weg. Voorkomt unbounded growth bij users die jaren van shared
  //    mailboxes openen en weer weggooien. 7 dagen zodat een werkweek
  //    vakantie geen warmup-trigger geeft (browser-IDB blijft sowieso staan).
```

- [ ] **Step 2: Server herstart + verifieer log**

Als de lokale dev-server draait, tsx --watch herstart automatisch bij file-save. Verifieer in server-log:

```
[server] Backend running on http://localhost:3500
```

Geen errors, geen TS-compile warnings.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/mail.ts
git commit -m "feat(mail): CACHE_LIFETIME 24u -> 7 dagen

Voorkomt warmup-trigger bij vakanties/lange weekends. Server-RAM
blijft langer bezet maar bij huidige user-counts verwaarloosbaar."
```

---

## Task 2: IndexedDB wrapper — open + interne helpers

**Files:**
- Create: `packages/frontend/src/lib/mail-cache-db.ts`

- [ ] **Step 1: Maak nieuw bestand met DB-open helper**

Schrijf de hele basis-file. Dit is een internal helper module — public API komt in Task 3.

```typescript
/**
 * Mail-list IndexedDB cache.
 *
 * Vervangt de localStorage-cache uit Webmail.tsx (50 folder LRU,
 * webmail_msglist_cache_*) voor mail-lijst metadata. IndexedDB heeft
 * praktisch geen quota issue (~50% vrije schijfruimte), dus alle
 * folders kunnen lokaal staan zonder LRU-eviction.
 *
 * Schema: database "y-app-mail" v1, object store "folder_messages".
 * Key: composite string `${instanceId}::${acct}::${folder}`.
 * Value: { messages: MailMessage[], total: number, ts: number }.
 *
 * Public API mirrort de oude sync helpers maar is async.
 */
import type { MailMessage } from "./mail-types";

const DB_NAME = "y-app-mail";
const DB_VERSION = 1;
const STORE = "folder_messages";

export interface CachedFolder {
  messages: MailMessage[];
  total: number;
  ts: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function compositeKey(instanceId: string, acct: string, folder: string): string {
  return `${instanceId}::${acct || ""}::${folder}`;
}
```

- [ ] **Step 2: Check MailMessage import-pad**

Controleer of `MailMessage` daadwerkelijk in `packages/frontend/src/lib/mail-types.ts` staat (of waar dan ook). Grep:

```bash
grep -n "export.*MailMessage" packages/frontend/src/lib/*.ts
```

Pas import-pad aan als nodig. Als type elders staat, gebruik dat exacte pad. Geen wijziging als `mail-types.ts` bestaat met `MailMessage`.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/lib/mail-cache-db.ts
git commit -m "feat(mail-cache): IndexedDB wrapper - openDb skeleton"
```

---

## Task 3: IndexedDB wrapper — read + persist API

**Files:**
- Modify: `packages/frontend/src/lib/mail-cache-db.ts`

- [ ] **Step 1: Voeg readMailFolderCache + persistMailFolderCache toe**

Append onderaan `mail-cache-db.ts`:

```typescript
/** Lees folder-cache. Returns null als folder niet gecached is. */
export async function readMailFolderCache(
  instanceId: string,
  acct: string,
  folder: string,
): Promise<CachedFolder | null> {
  try {
    const db = await openDb();
    return new Promise<CachedFolder | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(compositeKey(instanceId, acct, folder));
      req.onsuccess = () => resolve((req.result as CachedFolder) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Persist folder-cache. Trimt tot 500 nieuwste messages (sort op uid desc
 * als proxy voor internalDate, want IMAP-uids zijn monotoon increasing per
 * folder en kosten geen Date-parse).
 */
export async function persistMailFolderCache(
  instanceId: string,
  acct: string,
  folder: string,
  messages: MailMessage[],
  total: number,
): Promise<void> {
  const trimmed = messages.length > 500
    ? [...messages].sort((a, b) => b.uid - a.uid).slice(0, 500)
    : messages;
  const value: CachedFolder = { messages: trimmed, total, ts: Date.now() };
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, compositeKey(instanceId, acct, folder));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Stil falen — IDB onbeschikbaar (Safari privé, quota). Caller heeft
    // localStorage-fallback via dual-write in Task 6.
  }
}
```

- [ ] **Step 2: Manuele check via DevTools**

Open browser DevTools → Application → IndexedDB. Database `y-app-mail` bestaat nog niet (geen caller). Skip verificatie tot Task 6.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/lib/mail-cache-db.ts
git commit -m "feat(mail-cache): read + persist API met 500-msg trim"
```

---

## Task 4: IndexedDB wrapper — list + clear + migrate

**Files:**
- Modify: `packages/frontend/src/lib/mail-cache-db.ts`

- [ ] **Step 1: Voeg list, clear, migrate toe**

Append onderaan `mail-cache-db.ts`:

```typescript
/** Geef alle folder-paden terug die gecached zijn voor deze (instance, acct). */
export async function getCachedFolderPaths(
  instanceId: string,
  acct: string,
): Promise<string[]> {
  const prefix = `${instanceId}::${acct || ""}::`;
  try {
    const db = await openDb();
    return new Promise<string[]>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result as string[]) || [];
        resolve(
          keys
            .filter((k) => k.startsWith(prefix))
            .map((k) => k.slice(prefix.length)),
        );
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Wis alle cache-entries voor deze (instance, acct). */
export async function clearMailCache(
  instanceId: string,
  acct: string,
): Promise<void> {
  const prefix = `${instanceId}::${acct || ""}::`;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result as string[]) || [];
        for (const k of keys) {
          if (k.startsWith(prefix)) store.delete(k);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/**
 * Migreer bestaande localStorage-entries (webmail_msglist_cache_*) naar
 * IndexedDB. Idempotent — slaat entries over die al in IDB zitten.
 * Returns aantal gemigreerde folders.
 */
export async function migrateLocalStorageMailCache(
  instanceId: string,
  acct: string,
): Promise<{ migrated: number }> {
  const prefix = `webmail_msglist_cache_${instanceId}_${acct || ""}_`;
  let migrated = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const folder = key.slice(prefix.length);
    const existing = await readMailFolderCache(instanceId, acct, folder);
    if (existing) continue; // al in IDB, skip
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as CachedFolder;
      if (!parsed?.messages || !Array.isArray(parsed.messages)) continue;
      await persistMailFolderCache(
        instanceId,
        acct,
        folder,
        parsed.messages,
        parsed.total ?? parsed.messages.length,
      );
      migrated++;
    } catch {
      // skip corrupte entry
    }
  }
  return { migrated };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/lib/mail-cache-db.ts
git commit -m "feat(mail-cache): list, clear, migrate API"
```

---

## Task 5: Webmail.tsx — vervang readMailFolderCache (lees-pad)

**Files:**
- Modify: `packages/frontend/src/pages/Webmail.tsx`

- [ ] **Step 1: Importeer IDB-functies + verwijder oude lokale read-helper**

Voeg bovenaan Webmail.tsx (bij andere lib-imports rondom regel 19-30) toe:

```typescript
import {
  readMailFolderCache as readMailFolderCacheIdb,
  persistMailFolderCache as persistMailFolderCacheIdb,
  getCachedFolderPaths,
  migrateLocalStorageMailCache,
} from "../lib/mail-cache-db";
```

Aliasing voorkomt naam-botsing met de bestaande lokale helpers die we in Task 6 verwijderen.

- [ ] **Step 2: Vervang 3 lees-call-sites met async + localStorage fallback**

Webmail.tsx heeft 3 lees-calls. Voor elke: vervang sync call met async lookup met fallback.

**Locatie 1 (regel ~3794, in een useEffect of init):**

Zoek:
```typescript
const cached = readMailFolderCache(getActiveInstanceId(), "", "INBOX");
```

Vervang door:
```typescript
const cached = (await readMailFolderCacheIdb(getActiveInstanceId(), "", "INBOX"))
  || readMailFolderCache(getActiveInstanceId(), "", "INBOX"); // fallback localStorage
```

De omhullende functie moet `async` zijn. Als de useEffect direct een sync handler heeft, wrap in een inline `(async () => { ... })()`.

**Locatie 2 (regel ~4426):**

Zoek:
```typescript
const persisted = readMailFolderCache(getActiveInstanceId(), activeAcct || "", folder);
```

Vervang door:
```typescript
const persisted = (await readMailFolderCacheIdb(getActiveInstanceId(), activeAcct || "", folder))
  || readMailFolderCache(getActiveInstanceId(), activeAcct || "", folder);
```

Maak omhullende functie `async`. Check dat de caller `await` of `.then()` gebruikt.

**Andere lees-call-sites:** grep om compleet te zijn:
```bash
grep -n "readMailFolderCache(" packages/frontend/src/pages/Webmail.tsx
```

Pas elke remaining call op identieke manier aan.

- [ ] **Step 3: Test in browser**

Vite hot-reload pakt de wijziging op. Refresh Webmail in browser. Open een folder die je eerder hebt geopend (zat in localStorage). Mail-lijst moet nog steeds renderen (komt nu via localStorage-fallback want IDB is leeg).

DevTools console: geen errors over "await is only valid in async function" etc.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages/Webmail.tsx
git commit -m "feat(mail-cache): lees-pad via IndexedDB met localStorage fallback"
```

---

## Task 6: Webmail.tsx — dual-write (persist naar IDB én localStorage) + migratie + verwijder lokale helpers

**Files:**
- Modify: `packages/frontend/src/pages/Webmail.tsx:2797-2871`
- Modify: `packages/frontend/src/pages/MailView.tsx` (alleen check)

- [ ] **Step 1: Dual-write op alle persist-call-sites**

Webmail.tsx heeft 2 persist-calls (regel ~4090, ~4249).

Zoek:
```typescript
persistMailFolderCache(getActiveInstanceId(), activeAcct || "", f, msgs, tot);
```

Vervang door (dual-write):
```typescript
persistMailFolderCacheIdb(getActiveInstanceId(), activeAcct || "", f, msgs, tot);
persistMailFolderCache(getActiveInstanceId(), activeAcct || "", f, msgs, tot); // dual-write voor rollback
```

Idem voor regel ~4249:
```typescript
persistMailFolderCacheIdb(instanceId, "", "INBOX", msgs, tot);
persistMailFolderCache(instanceId, "", "INBOX", msgs, tot);
```

`persistMailFolderCacheIdb` returnt een Promise — fire-and-forget is OK (geen `await` nodig), eventuele write-fail is silent.

- [ ] **Step 2: Migratie + warmup useEffect toevoegen**

In Webmail.tsx root component, na de bestaande `hydrateEmailProjectLinks` useEffect (rond regel 3770), voeg toe:

```typescript
// Migreer bestaande localStorage mail-cache naar IndexedDB (idempotent).
// Daarna achtergrond-warmup van alle folders.
useEffect(() => {
  const instanceId = getActiveInstanceId();
  if (!instanceId || instanceId === "default") return;
  (async () => {
    try {
      const { migrated } = await migrateLocalStorageMailCache(instanceId, activeAcct || "");
      if (migrated > 0) console.log(`[mail-cache] migrated ${migrated} folders from localStorage`);
    } catch {
      // ignore
    }
  })();
}, [activeAcct]);
```

- [ ] **Step 3: Verifieer in DevTools**

Refresh browser. DevTools → Application → IndexedDB → `y-app-mail` → `folder_messages` moet entries hebben (gemigreerd uit localStorage). Console toont `[mail-cache] migrated N folders from localStorage`.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages/Webmail.tsx
git commit -m "feat(mail-cache): dual-write IDB+localStorage + localStorage migratie"
```

---

## Task 7: Achtergrond-warmup van alle folders

**Files:**
- Modify: `packages/frontend/src/pages/Webmail.tsx`

- [ ] **Step 1: Vind bestaande folder-loader-functie**

Grep voor de functie die mails voor een folder fetcht:

```bash
grep -n "loadMessages\|fetchFolderMessages\|api/mail/messages" packages/frontend/src/pages/Webmail.tsx | head -10
```

Identificeer de fetch-functie die headers ophaalt voor een folder. Meest waarschijnlijk `loadMessages(folder, isInitial)` of vergelijkbaar rond regel 4050-4250. Noteer de exacte naam + signature voor Step 2.

- [ ] **Step 2: Schrijf warmup-helper boven het root component (of als helper-functie binnenin)**

Op een logische plek binnen Webmail.tsx (na de andere helpers, voor de root component), voeg toe:

```typescript
/**
 * Achtergrond-warmup: fetch headers voor alle folders die nog niet
 * recent in cache zitten. Concurrency-cap 5, niet-blocking. TTL 1u.
 */
async function warmupAllFolders(
  instanceId: string,
  acct: string,
  folderPaths: string[],
  fetchOne: (folder: string) => Promise<void>,
): Promise<void> {
  const STALE_TTL_MS = 60 * 60 * 1000;
  const now = Date.now();
  const queue: string[] = [];
  for (const f of folderPaths) {
    const cached = await readMailFolderCacheIdb(instanceId, acct, f);
    if (!cached || now - cached.ts > STALE_TTL_MS) {
      queue.push(f);
    }
  }
  const concurrency = 5;
  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency);
    await Promise.all(
      batch.map((f) =>
        fetchOne(f).catch(() => {
          // single-folder fail mag warmup niet stoppen
        }),
      ),
    );
  }
}
```

- [ ] **Step 3: Trigger warmup wanneer folder-list bekend is**

Zoek naar de useEffect die `folders` set (rond `setFolders(`). Voeg een vervolg-useEffect toe die warmup triggert zodra folders bekend zijn:

```typescript
// Achtergrond-warmup van alle folders nadat folder-list geladen is.
useEffect(() => {
  if (folders.length === 0) return;
  const instanceId = getActiveInstanceId();
  if (!instanceId || instanceId === "default") return;
  // Volgorde: INBOX + favorites eerst (zit al voor in folders-array door
  // bestaande sort), de rest erna. Niet-blocking — geen await.
  const folderPaths = folders.map((f) => f.path);
  warmupAllFolders(
    instanceId,
    activeAcct || "",
    folderPaths,
    async (folder) => {
      // Hergebruik bestaande fetch-logica voor één folder. Inline
      // implementatie hieronder; pas aan naar exacte API in jouw
      // codebase als loadMessages een specifieke signature heeft.
      const res = await fetch(
        `/api/mail/messages?${new URLSearchParams({ folder, page: "1", pageSize: "100" })}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) return;
      const data = await res.json();
      const msgs = data?.data?.messages || [];
      const total = data?.data?.total || msgs.length;
      await persistMailFolderCacheIdb(instanceId, activeAcct || "", folder, msgs, total);
    },
  ).catch(() => {
    // warmup-fail = stille degradatie, geen UI-impact
  });
}, [folders, activeAcct]);
```

**LET OP:** de fetch-URL en query-params hierboven zijn een aanname. Controleer met grep welk endpoint Webmail nu daadwerkelijk aanroept:
```bash
grep -n "/api/mail/messages\|/api/mail/list" packages/frontend/src/pages/Webmail.tsx | head -5
```
Pas URL + query-params aan zodat ze 1-op-1 matchen met de bestaande fetch in `loadMessages`. Mismatch → server retourneert 400 of empty data.

- [ ] **Step 4: Verifieer warmup-load in browser**

Refresh Webmail. DevTools Network tab: je ziet ~133 `/api/mail/messages` requests (5 tegelijk over ~30 sec). Geen UI-blocking; mail-lijst zichtbaar binnen 1 sec.

DevTools IndexedDB: na ~30 sec staan alle folders erin.

Open een folder die je nooit eerder hebt geopend (niet in localStorage-LRU-50). Mail-lijst moet **instant** renderen (cache-hit uit IDB), géén "laden..." flicker.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/pages/Webmail.tsx
git commit -m "feat(mail-cache): achtergrond-warmup van alle folders, 5 parallel"
```

---

## Task 8: Verificatie end-to-end via Playwright + handmatig

**Files:**
- Geen — alleen verificatie

- [ ] **Step 1: Server-side TTL check**

Lokale server-log moet bij verbinding tonen:
```
[mail-cache] Created cache for piet@3bm.co.nl@outlook.office365.com (oauth2)
```

Check dat `CACHE_LIFETIME` 7 dagen is via een korte log-toevoeging (optioneel, niet committen):
```typescript
console.log(`[mail-cache] config: CONNECTION_TIMEOUT=${MailAccountCache.CONNECTION_TIMEOUT}ms CACHE_LIFETIME=${MailAccountCache.CACHE_LIFETIME}ms`);
```
Of gewoon TS-source controleren — regel 558 toont `7 * 24 * 60 * 60_000`.

- [ ] **Step 2: Browser-cache vol-warmen**

Open `http://localhost:5173/webmail` (Vite tegen productie-proxy of lokale server).

Verifieer:
1. DevTools → Application → IndexedDB → `y-app-mail` → `folder_messages` → bevat alle folders (count ≥ aantal folders in linker tree)
2. Quota usage: `chrome://settings/cookies/detail?site=localhost%3A5173` toont MB-grootte van IndexedDB
3. Network tab gefilterd op `/api/mail/messages`: tijdens initial warmup zie je een burst, daarna geen meer

- [ ] **Step 3: Instant-render test**

Met cache vol: refresh browser (F5).
- Direct klikken op een folder die voorheen "niet in cache" zat → moet instant tonen (geen loader-flicker)
- Network tab: bij die klik géén `/api/mail/messages` request — pure cache-hit
- Daarna in achtergrond: nieuwe warmup pas na TTL (1 uur)

- [ ] **Step 4: Migratie-pad test**

Wis IDB maar laat localStorage staan:
- DevTools → Application → IndexedDB → `y-app-mail` → rechts-klik → Delete database
- Refresh Webmail
- Console moet tonen: `[mail-cache] migrated N folders from localStorage`
- IDB heeft nu N entries, dezelfde data

- [ ] **Step 5: Rollback-pad test (localStorage-only fallback)**

Verifieer dat als IDB faalt (geblokkeerd in browser-privacy-modus), localStorage nog werkt:
- Open Webmail in privé-venster (Chrome incognito heeft IDB op disabled bij sommige policies)
- Mail-lijst moet renderen uit server (geen lokale cache beschikbaar), géén crash

- [ ] **Step 6: Geen commits — verificatie alleen**

Als alle stappen slagen: merge-ready. Bij issues: rollback per Task via `git revert <commit-sha>`.

---

## Task 9: Branch-merge + deploy-handvatten

**Files:**
- Geen — flow-task

- [ ] **Step 1: Push branch (vraag eerst aan Piet)**

Piet's regel uit CLAUDE.md: nooit pushen zonder vragen. Vraag:
> "Implementatie compleet, alle verificaties OK. Mag ik branch <naam> pushen naar GitHub?"

Bij OK:
```bash
git push -u origin <branch-naam>
```

- [ ] **Step 2: Optioneel — PR maken**

Als Piet vraagt om PR:
```bash
gh pr create --title "feat(mail-cache): IndexedDB cache + server TTL 7d" --body "$(cat <<'EOF'
## Summary
- Mail-list cache verhuist van localStorage (LRU 50) naar IndexedDB (alle folders)
- Achtergrond-warmup van alle folders bij Webmail-mount (5 parallel)
- Server CACHE_LIFETIME 24u → 7 dagen
- Dual-write voor 1 release zodat rollback mogelijk blijft

## Test plan
- [x] Server-side TTL: 7 dagen geconfigureerd
- [x] IndexedDB vult zich tijdens warmup
- [x] Instant-render op folders buiten oude LRU-50
- [x] localStorage-migratie idempotent
- [x] Fallback bij IDB-unavailable werkt

Spec: docs/superpowers/specs/2026-05-26-mail-list-indexeddb-cache-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Deploy via GitHub Actions**

Voor productie: trigger Deploy workflow (`.github/workflows/deploy-server.yml`). Deze pakt zowel frontend als server mee. CACHE_LIFETIME-wijziging vereist server-redeploy (gebeurt automatisch in deploy).

---

## Open punten (uit spec, defaults)

- "Wis cache" knop in Settings: **NIET in scope van dit plan.** Kan later in een aparte taak.
- Warmup ook bij tab-switch terug naar Webmail: **NIET in scope.** Mount-only is voldoende voor het gemelde probleem.
