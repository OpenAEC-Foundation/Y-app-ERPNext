# Real-time push & mail cache — latency-analyse

**Datum:** 2026-05-20
**Branch:** `fix/webmail-perf-and-bugs-v021`
**Aanleiding:** Piet meldt dat (a) nieuwe Talk-berichten "een eeuwigheid" duren voor er notificatie verschijnt, (b) nieuwe mail evenmin snel binnenkomt, (c) "60s of zo werkt ook niet".

Analyse gedaan met Playwright tegen `https://y-app.impertio.app` + lezing van de relevante server- en frontend-modules. Sniffer op `window.fetch` en `WebSocket` constructor; 47s observatie-window op de dashboard- en messenger-pagina.

---

## TL;DR

| Scenario | Werkelijke max-latency vandaag | Wat Piet verwacht |
|---|---|---|
| Talk-bericht in geopende conversatie (Messenger.tsx actief) | ~1-2s (long-poll werkt) | OK |
| Talk-bericht in andere conversatie, gebruiker op `/messenger` | tot **15s** (Messenger.tsx eigen poller) | Vrijwel instant |
| Talk-bericht, gebruiker op andere pagina (Dashboard etc.) | tot **60s** (BackgroundSyncProvider) | Vrijwel instant |
| Nieuwe mail, IMAP IDLE actief (vandaag geopende Webmail of `subscribe-mail` succesvol) | ~1-2s (IDLE EXISTS event) | OK |
| Nieuwe mail, IDLE inactief (subscribe-mail mislukt door no_email of resolve_failed) | tot **5 min** (BackgroundSyncProvider sanity-poll) | Vrijwel instant |
| Webmail openen (eerste keer in sessie) | folders + envelopes uit server-cache, tot tientallen seconden bij cold cache | "Microsoft Outlook-snelheid" |

Het 60s mail-fallback klopt met de code in `BackgroundSyncProvider.tsx:84` (`if (pushActive) return 60_000;` voor messenger; mail is zelfs 5 min). Dit is **bewust** gekozen onder de aanname dat de WS-push de primaire signaling is. **Die aanname klopt voor mail soms niet en voor messenger systematisch niet.**

---

## Bevindingen — Messenger

### 1. Drie verschillende poll-loops naast elkaar

Vandaag draaien er drie pollers die elk de conversatie-lijst ophalen, op verschillende intervallen en endpoints:

| Plaats | Endpoint | Interval | Doel |
|---|---|---|---|
| [Messenger.tsx:551](packages/frontend/src/pages/Messenger.tsx#L551) | `/api/messenger/all-conversations` of `/api/messenger/conversations` | 15s | Live-refresh van de zichtbare lijst op `/messenger` |
| [BackgroundSyncProvider.tsx:316-323](packages/frontend/src/lib/BackgroundSyncProvider.tsx#L316-L323) | `/api/messenger/conversations` | 60s (pushActive=true), 20s/90s/5min (focused/blurred/hidden, geen push) | Sidebar-badge "Berichten" |
| [messenger-longpoll.ts:60-107](packages/server/src/messenger-longpoll.ts#L60-L107) | NC Talk `lookIntoFuture=1` | ~30s server-side per **subscribed** conversatie | Push voor de geopende chat |

**Playwright meting** (45s window, op `/messenger`):
```
/api/messenger/all-conversations  → 3 polls, intervals 15.004s, 15.002s  (Messenger.tsx)
/api/mail/unseen-summary          → 1 poll                                (BackgroundSyncProvider pushActive-path)
0 WS-frames (push) waargenomen
```

### 2. Long-poll werkt alleen voor de actief geopende conversatie

`messenger-longpoll.ts` start een loop pas wanneer de frontend `subscribe-conversation` over de WS stuurt. Dat doet `Messenger.tsx` alleen voor de **geselecteerde** chat. Voor alle andere conversaties van de gebruiker is er **geen** push-mechanisme aan de NC Talk-zijde.

Gevolg: de sidebar-badge "Berichten" en de conversatie-lijst-aanduiding ("3 nieuwe") moeten op polling vertrouwen. Op `/messenger` is dat 15s. Op elke andere pagina (`/dashboard`, `/projects`, ...) is dat 60s.

### 3. `pushActiveRef` is een globale vlag

In [BackgroundSyncProvider.tsx:219](packages/frontend/src/lib/BackgroundSyncProvider.tsx#L219) wordt `pushActiveRef.current = true` gezet zodra de WS opent — voor zowel mail als messenger. Maar:

- Voor **mail** is dat correct alleen wanneer `subscribe-mail` aan de server-zijde tot een actieve IMAP IDLE leidt.
- Voor **messenger** is dat **nooit** correct buiten de geopende conversatie: er is namelijk geen "subscribe alle conversaties"-flow.

`pushActive=true` schakelt de fallback-poll voor messenger naar 60s (zie [`getMessengerInterval`](packages/frontend/src/lib/BackgroundSyncProvider.tsx#L77-L89)). Dat is precies wat Piet ervaart als "een eeuwigheid".

---

## Bevindingen — Mail

### 4. IMAP IDLE start "on demand" en faalt stil bij no_email

Bij WS-open stuurt de frontend `subscribe-mail` met de primary email uit `localStorage`. Server-side handler in [`index.ts:2012-2038`](packages/server/src/index.ts#L2012-L2038) roept `ensureIdleForSession`:

- **Cache-hit**: directe `registerIdleListener` → IDLE start direct. OK.
- **Cache-miss + email + erpnextSid**: `resolveCredentials` via ERPNext, dan IDLE. OK (~1-3s).
- **Cache-miss + geen email** (`localStorage` leeg, bv. eerste login): `{ ok: false, reason: "no_email" }`. **IDLE start niet.** Geen herhaal-poging.
- **Cache-miss + email maar resolve_failed**: idem. IDLE start niet, geen retry.

In beide faal-paden valt het systeem terug op de 5 min sanity-poll van `BackgroundSyncProvider`. Geen notification, geen badge-update.

### 5. `registerIdleListener` koppelt aan een listener-set, IDLE-loop draait op account-niveau

[mail.ts:453-460](packages/server/src/mail.ts#L453-L460): `registerIdleListener` voegt `(yAppSid, instanceId)` toe aan een `Set` en start `startIdleLoop` als die nog niet draait. De IDLE-loop bestaat dus zolang er ten minste één browser-client interesse heeft. Bij WS-close → loops worden niet expliciet gestopt; alleen de listener-entry verdwijnt na expirie van de mailsession (default `MAIL_SESSION_TTL`).

Dit is robuust gegeven dat IDLE eenmaal werkt. Het probleem zit dus volledig bij het **starten** ervan in scenario's waar `subscribe-mail` niet de juiste email kan resolven.

### 6. Frontend mail-cache: bestaat niet

Server-side: er IS een mail-cache (`MailAccountCache` in `mail.ts`) met:
- Folders TTL 2 min
- Message list TTL 5 min
- Body cache (persistent zolang account-cache leeft)
- Attachment-buffer LRU 100MB/account, 10min TTL
- Envelope warmup van INBOX + subfolders (~30s na subscribe-mail)

Frontend-side: `messenger-prefetch.ts` heeft een client-cache voor de **messenger** conversatie-lijst (`localStorage` met TTL). Voor **mail** is er **geen** client-cache. Elke Webmail-open doet een verse `mailListFolders` + `mailListMessages` fetch. Bij koude server-cache is dat 1-3s; bij warme cache ~200ms. Bij IMAP cold-connect kan dit oplopen tot tientallen seconden (TLS-handshake + LIST + STATUS per folder).

---

## Wat klopt aan Piet's intuïtie

| Piet | Klopt? |
|---|---|
| "Een eeuwigheid voor ik melding van nieuw Talk-bericht krijg" | Ja — tot 60s buiten /messenger, tot 15s op /messenger maar buiten de geopende chat. |
| "60s werkt niet" | Ja — voor notification-perceptie is 60s onaanvaardbaar. Outlook/Teams pushen <2s. |
| "Mail cachen is een drama" | Gedeeltelijk: server cached, frontend niet. Bij sessie-start of after-restart vol koude latentie. |
| "Of het moet net zo snel werken als de webmail van Microsoft" | Outlook OWA gebruikt **WebSocket push** + service worker push. Voor Y-app is push-via-WS al de architectuur — alleen het 'subscribe alle conversaties' ontbreekt en `subscribe-mail` faalt stil bij no_email. |
| "Of we hebben een cache/database nodig" | Ja, voor mail mailbox-list (frontend IndexedDB) zou first-paint van Webmail instant maken. |

---

## Voorgestelde fixes (in volgorde van impact / kosten)

### F1 — Splits `pushActive` per kanaal (laag, ~1 uur)

Maak in `BackgroundSyncProvider.tsx` twee aparte vlaggen `mailPushActiveRef` en `messengerPushActiveRef`. Zet ze pas op `true` als de server **bevestigt** dat de push-kanaal echt actief is, niet zomaar bij WS-open.

- Server stuurt nu al een log over `subscribe-mail → reason`. Laat het ook een WS-bericht terugsturen: `{ type: "subscribe-mail-ack", ok: boolean, reason: "..." }`. Frontend zet `mailPushActiveRef = ok`.
- Voor messenger: er is geen "subscribe-all". Tot dat er is, blijft `messengerPushActiveRef = false` → fallback gebruikt 20s focused interval (i.p.v. 60s).

**Effect:** badge-latency van max 60s → max 20s buiten /messenger. Geen architectuur-change.

### F2 — Subscribe-all-conversations long-poll (middel, ~3-4 uur)

NC Talk biedt het rooms-endpoint met `modifiedSince`:
```
GET /ocs/v2.php/apps/spreed/api/v4/room?modifiedSince=<ts>
```
Dit retourneert *zodra een willekeurige room activiteit heeft* (met timeout). Implementeer een variant van `ensureLongPoll` die per `(yAppSid, instanceId)` 1 long-poll op het rooms-endpoint draait zolang de WS open is. Bij respons: broadcast een `messenger-changed`-event (zonder specifieke `conversation`).

- Frontend BackgroundSyncProvider verstuurt eenmalig `subscribe-rooms` bij WS-open.
- Server start `ensureRoomsLongPoll` met de NC-credentials van de mailbox-flow (dezelfde resolve-pad als subscribe-mail).
- Bij elk event → `pollMessengerOnce()` direct → badge update binnen 1-2s.

**Effect:** messenger-push wordt symmetrisch aan mail-push. Geen polling-fallback meer voor de badge.

### F3 — `subscribe-mail` faalt niet stil (laag, ~1 uur)

In `index.ts` ws-events handler: bij `reason === "no_email"` of `"resolve_failed"`:
- Stuur ack-bericht naar de browser zodat die de fallback-poll-interval correct kan kiezen.
- Plan een retry over 30s (NCAB-style backoff): misschien is de cache later wel gevuld (bv. nadat de gebruiker Webmail opent).
- Log met aanmoediging om de email te configureren in plaats van een silent warn.

### F4 — Frontend mail-cache (groot, 1-2 dagen, **maar grootste UX-winst**)

IndexedDB-cache voor mail folder-list + INBOX-envelopes (laatste ~100 berichten):
- Cache-key: `(yAppSid, instanceId, acct, folder)`
- TTL: oneindig zolang de revision-cursor van de folder klopt (IMAP `UIDVALIDITY` + `UIDNEXT`)
- Webmail's first-paint: render direct uit IndexedDB, kick-off background-revalidate.
- Bij IMAP IDLE EXISTS-event: invalidate de relevante folder + push event naar Webmail om incrementeel te updaten.

Patroon dat goed werkt: SWR / stale-while-revalidate. Outlook OWA doet dit ook (cachen lokaal + sync diff).

**Effect:** Webmail-open <100ms first-paint, ook bij cold server-cache. Maakt het "Microsoft-snel".

### F5 — Service Worker + push voor offline / niet-actieve-tab (zeer groot, 3-5 dagen)

Hier zou de push ook bij gesloten tab werken (echte browser-notification). Vereist VAPID-keys, push-server-side store, service worker registrant. Overwogen in CLAUDE.md sectie "Skipped: Microsoft Graph webhooks" — daar is gekozen voor "te zwaar". Geldt nog steeds. **Niet doen tenzij F1-F4 onvoldoende blijken.**

---

## Aanbeveling

**Korte termijn (deze of volgende sessie):** F1 + F3. Klein, mechanisch, brengt fallback-latency van 60s naar 20s en maakt mail-IDLE-status correct zichtbaar.

**Middellange termijn (volgende sprint):** F2. Symmetrische push voor alle Talk-conversaties — dit lost Piet's klacht over "lang wachten op Talk-bericht" structureel op.

**Lange termijn (afzonderlijk traject):** F4. Frontend mail-cache. Maakt Webmail-open instant, ook tussen sessies/tab-reloads.

F5 (service worker push) blijft buiten scope tot bovenstaande gemeten te kort schiet.

---

## Test-recept om resultaat te verifiëren

Na implementatie F1+F2:
1. Open `/dashboard` in een tab.
2. Laat iemand een nieuw bericht sturen in een Talk-conversatie waar je niet actief in zit.
3. Stop-watch tussen verzonden-ts en het verschijnen van de badge in de sidebar.
4. Verwachting: <2s (i.p.v. 60s).

Na F3:
1. Verwijder `pref_<instance>_imap_user` uit `localStorage`.
2. Open de app. Server zou na ack subscribe-mail = `no_email` de fallback naar 60s (focused) moeten zetten, en na 30s opnieuw proberen (na een Webmail-open zou de email beschikbaar zijn).

Na F4:
1. Hard-reload Webmail in een koude state (server-cache restart).
2. First-paint van folder-tree + INBOX-lijst moet uit IndexedDB komen, <100ms.

---

## Addendum — uitkomsten parallelle review (2026-05-20)

Vier reviewing-agents hebben de F1-F4 voorstellen elk afzonderlijk tegen de code en de threat-model gehouden. Belangrijkste correcties:

### F1 — DOEN MAAR ANDERS

De voorgestelde one-shot `subscribe-mail-ack` dekt drie scherven niet:

- **Stille IDLE-dood na ack-OK:** ImapFlow IDLE kan na minuten zwijgen sterven (NAT-keepalive, Office365-restart, TLS-fatal). `mail.ts` heeft 25-min restart maar geen error→listener-notify pad. Ack zegt "ok=true", IDLE is 10 min later dood, frontend weet niets, mailpoll blijft op 5 min.
- **Ack verloren bij race tussen `onmessage`-attach en eerste server-bericht.**
- **WS-reconnect waarbij localStorage intussen geleegd is** → `no_email` → push stil dood, geen correctie-pad.

**Revised aanpak:** vervang one-shot ack door **periodieke `push-status`-tick** van server (elke 60s, payload `{ type: "push-status", channels: { mail: bool, messenger: bool } }`) op basis van werkelijke `idleLoopActive`-state per account. Dezelfde effort (~1u), maar:
- Detecteert IDLE-dood automatisch (volgende tick stuurt `mail: false`).
- Geen ack-race (volgende tick komt vanzelf).
- Eén bron van waarheid: server weet welke loops draaien, client is dom.
- Symmetrisch klaar voor de messenger-tick zodra die ooit echt push doet.

`reason`-string is veilig om mee te sturen (alleen enum-waarden, geen creds/email).

### F2 — NIET DOEN

**Fundamenteel verkeerde aanname.** `GET /ocs/v2.php/apps/spreed/api/v4/room?modifiedSince=<ts>` is **geen** long-poll: het is een **filter** dat onmiddellijk retourneert met alleen rooms wier `lastActivity > modifiedSince`. NC Talk docs adviseren expliciet *"full refreshes every 5 minutes or when receiving specific signaling messages"*. Echte push vereist een **External Signaling Server** (Janus/HPB) die 3BM's NC-instance niet draait — anders had de bestaande `messenger-longpoll.ts` daar al gebruik van gemaakt.

Bovendien: een eigen 5s server-poll-loop met `modifiedSince` levert bij 50 users × 1.3 instances ≈ **47k NC-calls/uur**, een factor ~5 hoger dan de huidige situatie. Netto verslechtering voor de NC-server, zonder latency-winst.

**Beter alternatief (5 regels, ~15 min effort):** verlaag in `BackgroundSyncProvider.tsx` de messenger-poll-interval in push-mode van **60s → 20s**. Dat is dezelfde cadans als focused-no-push en lost 80% van Piet's klacht op zonder architectuur-change. Code-locatie: [`getMessengerInterval`](packages/frontend/src/lib/BackgroundSyncProvider.tsx#L77-L89), pas regel 84 aan: `if (pushActive) return 20_000;` (of laat `pushActive` voor messenger compleet weg en gebruik altijd de focus-tier-cadans).

### F3 — DOEN MAAR ANDERS

Drie correcties op het oorspronkelijke voorstel:

- **`no_email`-retry op de server is zinloos.** Verandert pas wanneer de gebruiker Webmail opent en IMAP configureert. Server-timer tikt 30s lang in het luchtledige. Juiste pattern: server stuurt one-shot `{ type: "subscribe-mail-ack", ok: false, reason: "no_email" }`, frontend luistert op een custom event `y-app:imap-configured` (te firen door Webmail's IMAP-setup) en stuurt dan opnieuw `subscribe-mail`.
- **`resolve_failed` is wél retry-waardig**, maar één keer na ~60s met backoff+jitter. Niet eindeloos.
- **Stop-conditie ontbrak.** Timers MOETEN aan de `ws.on("close")` hangen (bestaat al op regel 2043), anders geheugen-leak + ongewenste ERPNext-load na disconnect.

Threat-model OK (`reason`-enum lekt niets). Wel: rate-limit op aantal `subscribe-mail`-berichten per WS (max 1/5s) tegen DOS-spam.

Realistische effort 2-3u (niet 1u): ack-message-type + frontend re-subscribe-event + backoff/jitter + ws-close cleanup + handmatige Playwright-verificatie.

### F4 — DOEN MAAR ANDERS

Twee dingen waren mis met het oorspronkelijke voorstel:

1. **UIDVALIDITY/UIDNEXT zit nu nergens in server-API.** Grep op `mail.ts` levert nul matches. ImapFlow exposeert het wel, maar plumbing ontbreekt: server-schemas (`CachedFolder`, `mailListMessages` response) moeten uitgebreid worden, en bij UV-bump moet zowel client- ÁLS server-cache flushen. Niet "gratis", schat 3-4u alleen voor server-side.

2. **Effort 1-2 dagen is te optimistisch.** Realistisch 3-5 dagen voor server-plumbing + IDB-laag + Webmail.tsx SWR-integratie + WS-event payload + multi-tab sync (`BroadcastChannel`) + edge cases (UV-bump, rename, shared-mailbox switching) + Playwright-tests.

**Revised aanpak — server-side persistente envelope-cache (SQLite):**
- Tabel: `mail_envelopes(yAppSid, instanceId, acct, folder, uid, subject, from, date, flags, uidvalidity, ts)`.
- Bevolking: bestaande `warmupCacheAsync` + IDLE EXISTS/EXPUNGE events.
- Invalidatie: UV-bump → folder-flush.
- Voordelen tegenover client-IDB:
  - Shared across browsers/devices (geen multi-tab sync nodig).
  - Threat-model schoon (encrypted-at-rest sowieso via DB-bestand).
  - Eén layer (geen IDB-migraties).
  - Lost het echte probleem op: koude server-cache na PM2-restart blijft warm.
- Inschatting 1-2 dagen.

**Behoud:** bestaande `webmail_inbox_cache_${id}` localStorage-snapshot voor sub-100ms first-paint van **alleen INBOX**. Dat lost de UX-perceptie op zonder de complexe sync. Subfolders renderen na de eerste server-response uit de SQLite-cache.

**Body-cachen:** niet doen in deze laag — alleen envelopes + flags. Body's blijven in de in-memory `MailAccountCache` op de server. (Reden: body's bevatten PII; SQLite-DB op de VPS heeft beperkte at-rest encryptie zonder extra setup.)

---

## Revised volgorde (na review)

1. **Quick win (~15 min, hoogste hefboom):** messenger-poll-interval in push-mode 60s → 20s in [`BackgroundSyncProvider.tsx:84`](packages/frontend/src/lib/BackgroundSyncProvider.tsx#L84). Lost 80% van Piet's "eeuwigheid"-klacht.
2. **F1-revised + F3-revised samen (~3u):** periodieke `push-status`-tick + correcte `no_email`/`resolve_failed` ack-flow met frontend re-subscribe + ws-close cleanup. Brengt mail-IDLE-status correct in beeld; dekt stille IDLE-dood.
3. **F2 schrappen.**
4. **F4-revised (1-2 dagen, apart traject):** server-side SQLite envelope-cache + UIDVALIDITY/UIDNEXT plumbing. Lost koude server-cache latency op.

Stap 1 + 2 brengen de waargenomen latency van max 60s (messenger) en max 5 min (mail) naar respectievelijk ~20s en ~2s. Stap 4 maakt Webmail-open na server-restart instant.

---

## Addendum 2 — Waarom OWA sneller is, en hoever Y-app realistisch kan komen

Piet vraagt: "Hoe komt het dat Microsoft's webmail wel zo snel is en wij niet?" Korte versie: Microsoft bezit beide kanten van de wire en heeft een protocol ontworpen voor browsers; Y-app moet praten met IMAP, een protocol uit 1986. Dat asymmetrie-feit zet de bovenliggende fixes in context — F1-F4 zijn niet "Y-app perfect maken", ze zijn "80% van OWA-gevoel halen waar dat nog rationeel is".

### Drie fundamentele verschillen

| Verschil | OWA | Y-app |
|---|---|---|
| **Wire-protocol** | MAPI/EWS/Graph: batch-fetch + delta-sync (`@odata.deltaLink`) | IMAP: chatty, LOGIN→CAPABILITY→LIST→STATUS×N→SELECT→FETCH, geen native diff-sync |
| **Server-architectuur** | Per-user denormalized index op Exchange-frontend, mail-store ms-afstand in zelfde datacenter | Y-app VPS in NL, ERPNext elders, IMAP-server (Office365/NC) weer elders — drie netwerk-hops |
| **Browser-laag** | Service Worker + IndexedDB persistent cache, optimistic UI, push-subscriptions | Geen frontend mail-cache, geen optimistic UI, push alleen via WS bij open tab |

### Verschilmatrix in milliseconds

| Gebied | OWA | Y-app vandaag | Met F1+F3+F4 |
|---|---|---|---|
| First-paint warm | ~50ms | 200-500ms | ~100ms (localStorage INBOX-snapshot) |
| First-paint cold (na server-restart) | ~50ms | 10-30s | ~200ms (SQLite envelope-cache) |
| New-mail-detectie | ~1-2s | 1-2s OF tot 5 min | ~2s consistent |
| Read-mark UI-respons | ~0ms (optimistic) | 200-500ms | ~0ms (optimistic UI toevoegen aan F4-scope) |
| Folder-switch warm | ~50ms | 200-500ms | ~100ms |

### Wat Y-app principieel NIET kan inhalen

- **IMAP-roundtrip-latency:** fetch naar Office365 vanaf NL is 30-80ms × 5-10 calls per pageview. Microsoft's mail-store staat in hetzelfde datacenter als hun frontend — wij niet, kunnen wij niet zonder een eigen Exchange-equivalent te bouwen.
- **Multi-region CDN:** OWA's assets liggen op een edge-node dichtbij de gebruiker. Y-app draait op één VPS.
- **Push naar gesloten tab:** OWA gebruikt push-subscriptions + service worker met VAPID. CLAUDE.md noemt dit "Skipped — te zwaar voor de winst boven IDLE". Die afweging blijft staan.

### Wat Y-app wel als voordeel houdt

- Multi-instance tabs (OWA werkt per tenant)
- ERPNext-context naast de inbox (Y-app's hele waardepropositie)
- Eigen hosting, geen Microsoft-lock-in

### Diminishing-returns-grens

Met F1+F3+F4 + frontend IndexedDB-cache + optimistic UI (~2 weken werk samen) kom je op **80-90% van het OWA-gevoel**. De resterende 10-20% (sub-100ms folder-switch onder elke conditie, push naar gesloten tab, offline support) vereist:

- Eigen wire-protocol of een service-worker-traject van weken-maanden
- VAPID push-server + Graph webhooks setup
- Per-region datacenters of een CDN-strategie

**Aanbeveling:** stop bij 80%. De resterende investering levert geen verhouding meer met andere features waar Y-app uniek in is.

### Concrete uitbreiding op F4

Het oorspronkelijke F4-voorstel (server-side SQLite envelope-cache) wordt nu uitgebreid met:

1. **Frontend localStorage INBOX-snapshot** — 24-48u TTL, alleen subjects+from+date van laatste ~100 INBOX-mails. Levert sub-100ms first-paint voor de meest-bezochte folder.
2. **Optimistic UI voor read-mark + delete + move** — UI toont actie direct, server-sync async met undo bij failure. Brengt read-mark-respons van 200-500ms naar ~0ms.
3. **Diff-sync via UIDNEXT** — bij folder-revisit alleen `SEARCH UID > last_seen_uidnext` ophalen i.p.v. volledige envelope-lijst. Maakt warme folder-switch sub-100ms.

Effort-impact op F4: van 1-2 dagen naar **3-4 dagen** (~ +1 dag voor optimistic UI + UIDNEXT diff-sync + localStorage-snapshot). Dat is de werkelijke prijs voor "OWA-gevoel".

### Revised einddoel (de complete picture)

Na stap 1 (quick win) + 2 (F1+F3 revised) + 4 (F4 revised met IDB/optimistic/diff-sync):

| Scenario | Vandaag | Na alles |
|---|---|---|
| Talk-bericht buiten /messenger | tot 60s | tot 20s |
| Nieuwe mail, IDLE faalt stil | tot 5 min | ~2s |
| Nieuwe mail, IDLE sterft mid-sessie | tot 5 min | ~60s |
| Webmail koud na restart | tientallen seconden | ~200ms |
| Webmail warm first-paint | 200-500ms | ~100ms |
| Read-mark UI respons | 200-500ms | ~0ms |
| Folder-switch warm | 200-500ms | ~100ms |

Dat is OWA-gevoel binnen handbereik voor ~2 weken werk, exclusief de architecturale dingen die buiten ons macht liggen.

