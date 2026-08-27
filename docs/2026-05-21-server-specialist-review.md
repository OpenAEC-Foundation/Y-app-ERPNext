# Y-app — Server/Backend Data-Flow Review
**Datum:** 2026-05-21
**Scope:** server/data-flow, niet code-style. Focus: snelheid van mail-/Talk-detectie + eerste Webmail-/Messenger-open.

---

## 1. Architectuur-flowchart: typische "Webmail openen" request

Wat er gebeurt vanaf het moment dat de user op de sidebar-knop "Webmail" klikt (cold, geen WS, geen warme cache):

```
Browser                              Server (Express)                          Externe systemen
-------                              ---------------                            ----------------
[Webmail.tsx mount]
  │
  ├── GET /api/mail/folders ─────────► authMiddleware (skip — niet /api/mail*)
  │                                    parseInstanceHeader  (light)
  │                                    mailListFolders:
  │                                      getCredentials(req):
  │                                        - mailSession cache miss
  │                                        - query.email !== set                 (or:  buildQuery sets email)
  │                                        - resolveCredentials(erpSid, email)  ────► ERPNext /Email Account
  │                                                                              ────► ERPNext /Connected App  (2× /resource)
  │                                                                              ────► ERPNext /Token Cache    (2× get_password)
  │                                                                              ────► Microsoft token endpoint  (refresh)
  │                                                                              =  4-6 ERPNext calls + 1 MS-token call
  │                                      getAccountCache(creds) — creates new
  │                                      registerIdleListener → start IDLE loop
  │                                      fetchFolders():
  │                                        ensureConnected() ─────────► IMAP CONNECT + TLS + LOGIN  (~1-3s)
  │                                        client.list({statusQuery})  ─► IMAP STATUS per folder   (~ N × 50-200ms)
  │
  ├── GET /api/mail/messages?folder=INBOX (PARALLEL met folders)
  │                                    mailListMessages:
  │                                      getCredentials(req) → cache hit? (race!)
  │                                      OR opnieuw resolveCredentials → ZELFDE 4-6 calls
  │                                      opQueue.enqueue → fetchMessages():
  │                                        mailboxLock(INBOX)
  │                                        fetch envelopes 50 berichten ─► IMAP FETCH (envelope+flags+bodyStructure)
  │
  ├── GET /api/mail/signature?email=…
  │                                    mailGetSignature:
  │                                      4 ERPNext proxyRequest calls (Email Account, User, Employee→User, Default)
  │
  ├── GET /api/mail/contacts (soms)
  │                                    scan alle folder-caches → 5+ IMAP fetches
  │
  └── GET /api/mail/auto-config (alleen op ImapSetup) ── nog eens 4-6 ERPNext calls
```

**Kritiek pad totaal cold:** ~3-5s ERPNext-credential-resolve + 1-3s IMAP-LOGIN + STATUS-querys + envelope-fetch.

**Parallellisatie-status:**
- `/folders` en `/messages` lopen parallel **vanuit de browser**, maar **serialiseren op de server** door `opQueue` (één lock per IMAP-connectie). De parallelle browser-fetch oogt dus parallel maar wacht alsnog ~600-1500ms extra in queue.
- `resolveCredentials` race: beide requests kunnen tegelijk de cache missen en allebei `mailAutoConfigInternal` triggeren. Geen coalescing — vergelijk `loginInFlight` in instance-proxy.ts.

---

## 2. Top 5 bottlenecks

### B1. ERPNext mail-credential resolve = 4-6 sequentiële ERPNext-calls per cache-miss
**File:** `packages/server/src/mail.ts:2199-2323` (`mailAutoConfigInternal`)
**Pad:** Email Account search → Connected App list → 2× `get_password` (client_secret + access_token) → `get_password` (refresh_token) → Microsoft token refresh.
**Huidig:** elke call is sequentieel `await proxyRequest(...)`. 4-6 calls × 200-400ms = **1-2.5s** per cold mail-request.
**Race:** geen coalescing — `/folders` en `/messages` triggeren BEIDE een fresh resolve als ze tegelijk binnenkomen vóór cache-population.
**Target:** **<200ms** door (a) parallelle `Promise.all` voor de drie `get_password`-calls, (b) `resolvedCredsCache` coalescing-promise (zelfde patroon als `loginInFlight`), (c) langere TTL door access_token via JWT-exp te valideren in plaats van blind 4 min.

### B2. `authMiddleware` doet 4 dynamic imports + 1 SQLite + 1 decrypt per request
**File:** `packages/server/src/auth.ts:172-251`
**Huidig:** per HTTP-request:
- 4× `await import(...)` (ESM eval cache; goedkoop na warm, maar tikt op cold path)
- `getYAppSessionWithKey` = 1 SQLite SELECT + 1 AES-GCM decrypt om userKey te recoveren
- `getInstanceForUser` = 1 SQLite SELECT
- `getOrCreateInstanceSession` (cache-hit) = 1 Map lookup
- AsyncLocalStorage `.run()` wrap

Totaal cache-hit pad: **~1-3ms**. Niet erg per request maar fires op **élke** /api/* call. Met 20-50 calls per Webmail-open is dat 20-150ms aan pure middleware-overhead.
**Target:** geen dynamic imports (statisch), gecombineerde SQLite SELECT (instance JOIN session in 1 query), userKey caching in `yapp-auth`-laag (nu decryptet bij elke `getYAppSessionWithKey`).

### B3. AsyncQueue (`opQueue`) serialiseert mail-operaties op één IMAP-connectie
**File:** `packages/server/src/mail.ts:120-143, 748-861, 951+, 992+`
**Probleem:** elke fetch/markRead/move op één account loopt door één queue → een trage `preloadBodies()` (10s+) blokkeert élke andere mail-request voor dat account. Frontend ziet "/folders" en "/messages" parallel sturen, maar server doet ze achter elkaar.
**Huidig:** acceptable voor data-integrity, maar **te grof**. `fetchFolders()` heeft helemaal geen lock nodig en zit toch in de keten via `ensureConnected()`.
**Target:** twee maatregelen — (a) een tweede ImapFlow-client per account voor read-only operations naast de "write" client (dit doe je al voor IDLE), (b) `fetchFolders` buiten `opQueue` houden (zit nu niet eens in `opQueue`, maar wordt wel serieel uitgevoerd door connection-locking).

### B4. Mail-folder STATUS query loopt sync over alle folders
**File:** `packages/server/src/mail.ts:719-720`
```ts
const list = await client.list({ statusQuery: { messages: true, unseen: true } });
```
**Probleem:** ImapFlow emits dit als één IMAP-call die voor élke mailbox een STATUS-roundtrip doet. Bij 20 folders × 50-100ms = **1-2s per fetchFolders()-call**. Voor `unseen-summary` (gepolt elke 60s in BackgroundSync) is dit verspilling: je hoeft alleen INBOX+geabonneerde subfolders te tellen.
**Target:** **<200ms** door (a) een aparte `mailUnseenSummary`-pad dat IMAP `STATUS` parallel met `Promise.all` voor alleen INBOX+subscribed folders, (b) caching van STATUS-tellingen per folder met invalidate-on-IDLE-event (al gedeeltelijk gedaan in `foldersTs = 0`, maar 2-min TTL is conservatief).

### B5. `/api/mail/unseen-summary` herbruikt volledige folder-list endpoint
**File:** `packages/server/src/index.ts:1390-1408`
```ts
res.json = (data: any) => { ... strip alles behalve path+unseen ... };
return handler(req, res);  // = mailListFolders
```
**Probleem:** wordt aangeroepen elke 60s (focus) / 5min (push-active). Triggert volledige `fetchFolders(false)` met 2-min TTL — bij elke call buiten cache: IMAP STATUS over álle folders. De "lichtgewicht" 200-byte response is alleen de payload — de **kosten zijn op de server gelijk** aan een full folder-list.
**Target:** dedicated endpoint dat IMAP STATUS doet op **alleen INBOX + subscribed** (zie B4). Geeft 5-10× snellere unseen-poll.

---

## 3. Cache-inventaris

| Cache | File:line | TTL | Scope | Gat |
|---|---|---|---|---|
| `sessionCache` (ERPNext sid) | instance-proxy.ts:41 | 4u | (user,instance) | ok |
| `loginInFlight` (coalescing) | instance-proxy.ts:55 | — | (user,instance) | ok |
| `mailSessions` (resolved creds) | mail.ts:174 | 4u sliding | (yAppSid,instance,acct) | ok |
| `resolvedCredsCache` | mail.ts:1374 | 4 min | (erpSid,email) | TTL conservatief; **geen coalescing-Promise** → race bij parallelle requests |
| `MailAccountCache.folders` | mail.ts:395-396 | 2 min | account | ok, maar bij invalidate → volledige list refetch |
| `MailAccountCache.folderMessages` | mail.ts:397 | 5 min | (account, folder, page) | ok |
| `MailAccountCache.fullMessages` | mail.ts:398 | — (geen TTL!) | (account, folder, uid) | **Memory-leak risico** — geen eviction, alleen door `removeCachedMessage` / `deleteMessage`. Grote postvakken raken 100k entries. |
| `attachmentCache` | mail.ts:422 | 10 min, 100MB | account | ok |
| `conversationCache` (Talk/Telegram) | messenger.ts:568 | 30s | (platform, creds) | ok, maar 30s is heel kort — een sidebar-badge die elke 60s pollt blijft veelal cache-miss |
| `fileProxyCache` (NC files) | messenger.ts:1155 | 15 min, 200MB | (user, url) | ok |
| `urenStatsCache` | index.ts:845 | 5 min | (instance, year, company, projEmployee) | ok |
| `hostStats` | mail.ts:60 | 24u | host | diagnostic only |

**Wat ontbreekt:**
1. **Unseen-counts per folder** — apart cached, kort TTL (15s), invalidate-on-IDLE.
2. **`/api/auth/me` response** — wordt door frontend bij elke nieuwe tab-mount opgehaald; nu rechtstreeks `getOrCreateInstanceSession` → cache-hit, maar er is geen response-cache van 30s.
3. **`mailGetSignature`** — doet 4 ERPNext calls per request en wordt herhaaldelijk gepolt; nul caching.
4. **`mailListContacts`** — scant 5 folders sequentieel, nul caching.
5. **`/api/messenger/conversations`** — de **focused-poll van 20s** vs `CONVO_CACHE_TTL=30s` betekent statistisch ~33% cache-miss per poll. Verhoog TTL naar 60s of laat het door WS-events invalideren.
6. **`fullMessages` zonder TTL** — at minimum LRU-cap met soft-budget zoals `attachmentCache` heeft.

---

## 4. Top 5 server-side quick wins (<1u effort)

### QW1. Parallelliseer `mailAutoConfigInternal` ERPNext-calls
**Win:** ~600-1000ms per cold mail-resolve.
**Hoe:** in `mail.ts:2199-2323`, wikkel de 3 `get_password`-calls + 1 Connected-App-fetch in een `Promise.all`. Ze hebben geen onderlinge dependency op data — alleen `tokenName` afhankelijk van `connApp.name` (die uit de eerste call komt, dus splitsen in 2 fasen).

### QW2. Coalescing-Promise in `resolveCredentials`
**Win:** elimineert dubbele resolve bij parallelle `/folders`+`/messages` op cold start (~1-2s).
**Hoe:** `mail.ts:1378` — zelfde patroon als `loginInFlight` in instance-proxy.ts. Per `cacheKey` een in-flight Promise opslaan; concurrent callers awaiten dezelfde.

### QW3. Verhoog `CONVO_CACHE_TTL` van 30s → 90s + invalidate-on-WS-event
**Win:** ~66% minder NC Talk roundtrips voor de sidebar-poll.
**Hoe:** `messenger.ts:569` → 90_000. In `messenger-longpoll.ts:runLoop` bij broadcast óók de relevante `conversationCache`-entry deleten zodat de volgende poll forced miss is.

### QW4. Server-side cache op `mailGetSignature`
**Win:** 4 ERPNext-calls per request → 0 voor 95% van de calls.
**Hoe:** Map `(erpSid, email) → { sig, ts }`, TTL 10 min. Signatures veranderen zelden.

### QW5. Statische imports in `authMiddleware`
**Win:** ~0.3-0.8ms per request. Over 20-50 requests bij een Webmail-open = 6-40ms.
**Hoe:** `auth.ts:194-197` — verplaats `import` naar top of file. De "circular dependency" comment is verouderd; de huidige imports zijn niet meer circulair (cross-check: instance-proxy.ts importeert auth.ts statisch in regel 21 — andersom kan ook).

---

## 5. Top 3 server-side trajecten (1-3 dagen)

### T1. Proactieve IMAP IDLE per account vanaf server-startup
**Probleem nu:** IDLE start pas wanneer (a) de browser een mail-endpoint hit, of (b) WS-events subscribe-mail message stuurt **mits** primary email bekend is. Bij koude server + closed browser ontbreekt IDLE volledig — de eerste browser-open ziet alleen ge-cachte counts van vóór de server-restart.

**Voorstel:** lees bij startup uit `mail_accounts` (de SQLite-vault) ALLE geconfigureerde accounts per user, decrypteer met de master-key + per-user-key (vereist dat we de masterkey kunnen lazy-unlocken… eigenlijk vereist het dat de **gebruiker** ingelogd is, dus alternatief: start IDLE zodra een Y-app sessie aanmaakt + er een mailaccount geconfigureerd is, ongeacht of een mail-endpoint is aangeroepen).

**Win:** "instant mail" voor élke ingelogde Y-app gebruiker, niet alleen die met Webmail open. Brengt Outlook-Web-Access gevoel.

### T2. Per-folder unseen-count store met IDLE-invalidation
**Probleem nu:** `/api/mail/unseen-summary` doet IMAP STATUS over alle folders elke 60s. Mailbox met 30+ folders = 1.5-3s per poll.

**Voorstel:**
1. Nieuwe `MailAccountCache.unseenCounts: Map<folder, { count, ts }>`, TTL 5 min.
2. IDLE handler (`broadcastMailEvent`) invalideert per-folder OR pushed nieuwe count via WS-event `mail-unseen` (al gereserveerd in `ws-events.ts:33`).
3. `/api/mail/unseen-summary` endpoint geeft direct uit cache, met fallback IMAP STATUS parallel op alleen niet-recent-bekende folders.

**Win:** unseen-poll van **1500-3000ms → 5-50ms** in steady state. Bij 100 gebruikers × elke 60s = enorme verlichting.

### T3. Eenduidige "request-scoped cache" laag in `authMiddleware`
**Probleem nu:** Bij één browser-page-mount kunnen 30+ /api/* calls vuren. Sommige raken dezelfde ERPNext-resource (`User`, `Employee`, `Company`) los van elkaar.

**Voorstel:** in `authMiddleware` een `Map` als request-scope memo op `erpRequestContext`. `proxyRequest` (en hogere wrappers zoals `fetchList`) checken een hash `(path, method, body)` binnen 100ms-window. Dezelfde call binnen één request-burst geeft dezelfde response.

**Win:** moeilijk te kwantificeren zonder profielen, maar verwachte 15-30% reductie op cold ERPNext-roundtrips bij first-load van pagina's zoals Webmail/Dashboard/Settings.

---

## 6. Eén grote architectuur-aanbeveling (>3 dagen)

### A1. Server-side mailbox-projectie ("Y-app mail-index") in SQLite

**Probleem:** elke mailbox-actie hangt nu af van IMAP (cold connection: 1-3s; STATUS: 50-200ms/folder; FETCH envelope: 100-500ms). Caches helpen, maar zijn volatiel (RAM, per-server-instance) en hebben geen indexering. Een Outlook-achtige gevoel ("instant typ-to-search", "alle folders met badge in 50ms") is met live IMAP-roundtrips niet haalbaar.

**Voorstel:** voor INBOX+subscribed folders een persistente projectie in SQLite (per yAppUser+account):
- Tabel `mail_envelopes(account_id, folder, uid, seq, subject, from_addr, date, flags, has_attach)`
- Tabel `mail_folder_state(account_id, folder, uidvalidity, uidnext, last_sync_at, unseen_count, total_count)`
- IDLE-loop is de single source of truth — push EXISTS/EXPUNGE/FLAGS → incremental upsert in SQLite.
- Volledige resync alleen wanneer UIDVALIDITY verandert of `last_sync_at > 24u`.
- Body-cache blijft RAM (te groot voor SQLite).

**Win:** `/api/mail/folders` en `/api/mail/messages` worden **<20ms SQLite queries** in 99% van de gevallen, vrijwel onafhankelijk van IMAP-roundtrip-latency. Search-endpoint wordt mogelijk. Multi-server / restart-resilient.

**Cost:** ~3-5 dagen werk + schema migrations + bewuste rollout (env-flag), maar het is wat OWA en Thunderbird al hebben — een lokale mail-store. Voor "instant Webmail" is dit de échte oplossing.

---

# Executive summary (max 200 woorden)

Y-app's server-data-flow heeft drie hoofdoorzaken voor traagheid bij eerste mail-/Talk-opens en bij detectie van nieuwe berichten.

**Eén:** mail-credential-resolve via ERPNext doet 4-6 sequentiële ERPNext-calls + 1 Microsoft-token-refresh (1-2.5s cold), zonder coalescing — bij parallelle `/folders`+`/messages` triggeren beide. Quick wins: parallelliseer de get_password-calls (Promise.all) en voeg in-flight-Promise coalescing toe (~1-2s winst).

**Twee:** `/api/mail/unseen-summary` is "lichtgewicht" qua payload maar doet vol IMAP STATUS over alle folders (20+ × 50-200ms = 1-3s per poll, elke 60s). Een dedicated per-folder unseen-count store met IDLE-invalidation maakt dit <50ms.

**Drie:** IMAP IDLE start pas on-demand. Bij koude server of dichte browser is er geen real-time push. Proactief IDLE starten zodra een Y-app sessie + mailaccount bestaat geeft "instant mail" gevoel.

Andere quick wins: 4× ERPNext calls in `mailGetSignature` cachen, `CONVO_CACHE_TTL` van 30→90s, statische imports in `authMiddleware`, LRU-eviction op `fullMessages`-cache.

De fundamentele OWA-achtige snelheid haal je pas met een SQLite-projectie van envelopes (T1/A1) — 3-5 dagen werk, maar het is wat elke desktop-mailclient doet.
