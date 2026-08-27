# Mail-list IndexedDB cache — Design Spec

**Datum:** 2026-05-26
**Status:** Draft (review)
**Branch:** `feature/email-attachments-to-nas` (gemerged of nieuwe branch t.t.v. implementatie)

## Aanleiding

Piet meldt: "lijkt nog steeds bepaalde mappen maar te zijn". Bij ~133 mailfolders (top-level + project-archief-submappen) voelt elke folder die niet in de top-50-meest-recent zit "leeg" bij eerste klik na een browser-refresh.

Oorzaak: huidige cache (`packages/frontend/src/pages/Webmail.tsx:2797-2871`) gebruikt `localStorage` met LRU-cap **50 folders** (max ~1.6 MB). 83+ folders vallen altijd buiten de cache.

## Doel

- Alle folders + maillijst-metadata (headers) lokaal cachen zodat folder-open altijd instant render geeft.
- Mail-bodies blijven server-fetch on-demand (geen offline-first ambitie).
- Bestaande IMAP IDLE / 3-laag cache strategie van CLAUDE.md blijft staan; deze wijziging vervangt alleen het localStorage-laag.

## Niet-doel

- Volledig offline werken (Service Worker, sync queue). Buiten scope.
- Mail-bodies / attachments lokaal cachen.
- Cross-device mail-cache (browser-cache is per-browser; voor cross-device is server-IDLE de bron).

## Scope-uitbreiding: server-side TTL 24u → 7 dagen

Naast de browser-cache wordt ook de **server-side MailAccountCache TTL** verlengd. Dit voorkomt dat een gebruiker die 1-6 dagen niet inlogt (vakantie, ziekte, weekend) bij terugkomst alsnog een 30 sec warmup ervaart, zelfs als hun IndexedDB nog gevuld is.

**Wijziging in `packages/server/src/mail.ts`:**

```ts
// Van:
const CACHE_LIFETIME = 24 * 60 * 60_000;
// Naar:
const CACHE_LIFETIME = 7 * 24 * 60 * 60_000; // 7 dagen
```

**Trade-off:** server-RAM blijft langer bezet voor inactieve accounts. Bij 1 user (huidige situatie) verwaarloosbaar; bij 50 users ~50 × ~10 MB cache = ~500 MB RAM worst-case, nog steeds binnen 4 GB VPS budget.

**CONNECTION_TIMEOUT blijft 30 min** — IMAP-socket sluiten bij inactiviteit blijft nodig vanwege NAT/Cloudflare idle-kill + O365 max concurrent connections. Re-connect na inactiviteit pakt nog steeds de in-memory cache.

## Architectuur

### Nieuwe library: `packages/frontend/src/lib/mail-cache-db.ts`

IndexedDB wrapper. Eén database `y-app-mail`, één object store `folder_messages`.

**Schema:**
- Database naam: `y-app-mail`, versie 1
- Object store: `folder_messages`
- Key path: composite `${instanceId}::${acct}::${folder}` (string)
- Value: `{ messages: MailMessage[], total: number, ts: number }`
- Geen indexes nodig (lookup is altijd via primary key).

**Public API** (mirror van huidige sync helpers maar async):

```ts
export async function readMailFolderCache(
  instanceId: string, acct: string, folder: string
): Promise<{ messages: MailMessage[]; total: number; ts: number } | null>;

export async function persistMailFolderCache(
  instanceId: string, acct: string, folder: string,
  messages: MailMessage[], total: number,
): Promise<void>;

export async function getCachedFolderPaths(
  instanceId: string, acct: string,
): Promise<string[]>;

export async function clearMailCache(
  instanceId: string, acct: string,
): Promise<void>;

/** Migreer bestaande localStorage entries naar IndexedDB. Idempotent. */
export async function migrateLocalStorageMailCache(
  instanceId: string, acct: string,
): Promise<{ migrated: number }>;
```

### Caps & limieten

- Geen LRU-eviction (IndexedDB heeft praktisch geen quota issue).
- Per folder: max **500 messages** (was 100). Voldoende voor ~3 jaar mail in actieve folders.
- Bij overflow per folder: trim tot 500 nieuwste (sort op `internalDate` descending).
- Totale storage worst case: 133 folders × 500 msgs × ~300 bytes = ~20 MB. IndexedDB-quota Chrome = ~50% van vrije schijfruimte, dus ruim binnen.

## Migratie strategie

**Stap 1 (in deze spec):** dual-write voor 1 release.

- Nieuwe code schrijft IndexedDB **en** behoudt localStorage-write (kleinere `slice(0, 100)`).
- Lees-pad: IndexedDB first, fallback naar localStorage als IndexedDB leeg is.
- `migrateLocalStorageMailCache` wordt aangeroepen bij Webmail-mount, kopieert alle bestaande localStorage entries naar IndexedDB (idempotent, kost ~50 ms).

**Stap 2 (volgende release):** localStorage-write uitschakelen.

- Lees-pad blijft fallback voor users die nog niet zijn gemigreerd.
- Na 1 maand kan localStorage-fallback weg.

**Rollback:** localStorage-data blijft staan voor 1 release. Bij IndexedDB-issue kan Y-app terugvallen.

## Achtergrond warmup

Bij Webmail-mount, na hydratie van folder-list:

```ts
async function warmupAllFolders(instanceId, acct, folders) {
  const concurrencyLimit = 5;
  const STALE_TTL_MS = 60 * 60 * 1000; // 1 uur
  const queue = [];
  for (const f of folders) {
    const cached = await readMailFolderCache(instanceId, acct, f.path);
    if (!cached || Date.now() - cached.ts > STALE_TTL_MS) {
      queue.push(f.path);
    }
  }
  // Run met concurrency-cap
  for (let i = 0; i < queue.length; i += concurrencyLimit) {
    const batch = queue.slice(i, i + concurrencyLimit);
    await Promise.all(batch.map(folder => fetchAndCacheFolder(folder)));
  }
}
```

**Volgorde-heuristiek:**
1. INBOX + favorites + sent + archive (parallel, first batch)
2. Subfolders van INBOX (depth 1)
3. Diepere subfolders
4. Special-use folders (drafts, trash, junk) laatst

**Performance overwegingen:**
- Bij verse browser: 133 folders / 5 parallel = ~27 batches × ~500 ms server-roundtrip = ~13 sec total. Acceptabel voor first-time seed.
- Daarna alleen folders met `ts > 1 uur` opnieuw. Bij dagelijks gebruik betekent dit ~10-20 folders per refresh.

**Background, niet blocking:** warmup loopt parallel met normaal Webmail-render. UI hangt niet.

## API-aanpassingen Webmail.tsx

Bestaande callers van `readMailFolderCache` en `persistMailFolderCache` zijn nu **async**. Locaties:

1. `Webmail.tsx:3882-3894` — initial folder-switch hydration
2. `Webmail.tsx:4053-4088` — `loadMessages` cache check
3. `Webmail.tsx:4248` — initial INBOX cache
4. `Webmail.tsx:4310` — switchFolder cache hit
5. `Webmail.tsx:4420` — folder-tab cache check
6. `Webmail.tsx:4636-4644` — update na message-action
7. `Webmail.tsx:4458, 4480, 4505-4506` — cache invalidation (`folderMsgCache.delete` blijft sync; alleen `persistMailFolderCache` delete-variant aanpassen)

Strategie: `void`-await pattern voor write-operaties (fire-and-forget), `await` voor read.

## Verificatie

**Manual via browser (Playwright MCP / DevTools):**

1. Open `http://localhost:5173/webmail` met productie-proxy
2. DevTools → Application → IndexedDB → `y-app-mail` → `folder_messages`
3. Controleer dat na ~15 seconden alle folders aanwezig zijn als entries
4. Refresh browser, klik op folder die nooit in LRU-50 zat → moet instant render geven (geen "laden..." flicker)
5. Network tab: tweede klik op zelfde folder = géén `/api/mail/messages` call (cache hit)
6. `chrome://settings/cookies/detail?site=localhost%3A5173` → controleer IndexedDB-quota usage in MB

**Edge cases:**
- Lege folder → entry met `messages: []` cachen, niet skippen
- Folder verwijderd op server → cache-entry blijft (volgende warmup vindt 'm niet meer, maar ruimt 'm niet automatisch op; aanvaardbaar, accumuleert niet snel)
- IndexedDB onbeschikbaar (privé-modus / Safari quirks) → fallback naar localStorage, geen UI-impact
- Concurrent writes naar zelfde folder (warmup + user-actie) → IDB-transaction serialiseert, geen corruptie

## Open vragen

- Wil je een "wis cache" knop in Settings? (Niet nodig — IDB beheert zichzelf, maar handig bij debug.) **Default: niet bouwen, kan later.**
- Moet de warmup ook bij tab-switch terug naar Webmail draaien, of alleen bij eerste mount? **Default: alleen mount, anders verspilling.**

## Critical files

| Bestand | Wijziging |
|---|---|
| `packages/frontend/src/lib/mail-cache-db.ts` (NIEUW) | IndexedDB wrapper + migratie |
| `packages/frontend/src/pages/Webmail.tsx` | Vervang lokale helpers, voeg warmup toe, await op alle cache-lees-calls |
| `packages/frontend/src/lib/webmail-prefetch.ts` | Mogelijk integratie met bestaande prefetch logica |
| `packages/server/src/mail.ts` | `CACHE_LIFETIME` constante: 24u → 7 dagen |

## Verwachte werkomvang

- IndexedDB wrapper + migratie: ~2 uur
- Webmail.tsx aanpassingen (~7 call sites async): ~2 uur
- Warmup + tests: ~2 uur
- Verificatie via Playwright: ~1 uur

Totaal: **~7 uur** (één werkdag).
