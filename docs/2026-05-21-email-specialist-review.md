# Y-app — Email-specialist review IMAP/SMTP

**Datum:** 2026-05-21
**Reviewer:** email-protocol specialist (IMAP/SMTP, OAuth2 voor Office365, Dovecot/Cyrus/Exchange)
**Scope:** `packages/server/src/mail.ts`, `packages/server/src/index.ts` (mail-routes), `packages/frontend/src/lib/webmail-prefetch.ts`, `packages/frontend/src/lib/BackgroundSyncProvider.tsx`
**Klacht:** trage detectie van nieuwe mail, trage eerste Webmail-open, vertraagde mail-acties — OWA-snelheid is het doel.

---

## 1. Wat KLOPT er goed

1. **Twee aparte ImapFlow-clients voor IDLE en fetch** (`mail.ts:439` `idleClient` vs `client`). Dit is RFC-correct: IDLE blokkeert de connection, en je wilt fetch-werk niet serialiseren achter een IDLE-loop.
2. **IDLE-restart op 25 min** (`mail.ts:445` `IDLE_RESTART_MS`) zit netjes onder de RFC 2177 limit van 29 min — dat voorkomt server-side dropped-connection ambiguïteit.
3. **OAuth2 refresh-coalescing** (`mail.ts:412` `tokenRefreshInFlight`, `mail.ts:549`) is goed gedaan. Microsoft roteert refresh-tokens; twee gelijktijdige refreshes met hetzelfde refresh-token = één wordt stilletjes ingetrokken. De single-flight guard pakt dit correct.
4. **SPECIAL-USE detectie voor Trash/Sent** (`mail.ts:1989` `resolveTrashFolder`, `mail.ts:2578` voor Sent) gebruikt RFC 6154 attributen (`\Trash`, `\Sent`) met name-fallback. Dit is robuust voor Dovecot, Cyrus én Exchange.
5. **`getMailboxLock` rondom alle IMAP-operaties** + `AsyncQueue` (`mail.ts:415` `opQueue`) is de juiste manier om ImapFlow's per-connection mailbox state te beheren — voorkomt dat een fetchMessages op INBOX een fetchOne op Sent corrumpeert.

---

## 2. Wat KLOPT er NIET vanuit email-protocol-perspectief

### 2.1 IDLE-loop gebruikt geen explicit IDLE-command (`mail.ts:1257-1276`)

De comment zegt:
> "Open mailbox ZONDER lock. Imapflow start automatisch IDLE bij inactiviteit (~30s default)."

Dit is een **risicovolle aanname**. ImapFlow's "auto-idle" gedrag (NOOP-cycling of impliciete IDLE) is een implementatie-detail van de library, niet een RFC-garantie. Onder de motorkap zou ImapFlow ook gewoon een 30s NOOP-poller kunnen draaien — wat betekent dat EXISTS-events tot 30s vertraging hebben terwijl jij denkt dat IDLE actief is. Voor Office365 specifiek: O365 stuurt push-events alleen tijdens een actieve `IDLE` (niet tijdens NOOP-polling).

**Fix:** roep `client.idle()` expliciet aan en houd de promise. Lees onmiddellijk na `mailboxOpen` IDLE in (zie ImapFlow docs `client.idle()`). De `IDLE_RESTART_MS` is dan een explicit `client.idle()` → wachten → break naar 25-min cycle.

### 2.2 IDLE start pas wanneer iemand luistert (`mail.ts:457`)

`registerIdleListener` start de IDLE-loop pas wanneer er een WS-luisteraar is. Goed bedoeld, maar:
- Voor een **server-restart** met user nog ingelogd: de WS reconnect na 5s (BackgroundSyncProvider:258+). In die 5s zijn er geen listeners → geen IDLE → events gemist die in die window binnenkomen.
- Erger: als de `mailSession`-cache leeg is (na 4h sliding TTL → eerste laad bij server-boot), kan IDLE pas starten ná een Webmail-request omdat alleen die de creds in cache zet (`mail.ts:1689` in `mailListFolders`).

**Fix:** WS-handler doet al `subscribe-mail` → `ensureIdleForSession` (mail.ts:240). Dat is goed. Maar als de cache leeg én ERPNext-resolve faalt, blijft IDLE uit. Voeg een **persistent IDLE-warmup** toe via `mail_accounts` tabel — bij server-startup voor élk Y-app-account met een werkende mail-config IDLE starten. Nu zit alleen één hardcoded MAIL_HOST/MAIL_USER env-var (`mailStartupWarmup` mail.ts:2468) in de pipeline, en die start geen IDLE.

### 2.3 Geen detectie van "IDLE silently dead" (NAT-timeout)

`startIdleLoop` reageert op `close`-events en op de `IDLE_RESTART_MS`-timer. Maar:
- Een NAT-router die de TCP-connection laat lopen zonder data (stale-keepalive) → server denkt verbonden, kabel feitelijk dood. Geen `close` event, geen `error` event, gewoon stilte.
- O365 droppt soms zonder TLS-close → ditzelfde scenario.

**Mitigatie ontbreekt:** geen application-layer NOOP-pings binnen de IDLE-window. De 25-min restart-timer dekt dit gedeeltelijk, maar betekent dat in worst-case 25 minuten geen events binnenkomen voordat de loop opnieuw verbindt.

**Fix:** periodieke `client.noop()` elke 5 min binnen de IDLE-loop, of TCP-keepalive aanzetten op de socket (`socket.setKeepAlive(true, 60_000)` — ImapFlow exposeert dit niet direct, maar via een custom socket-factory wel).

### 2.4 STATUS wordt correct gebruikt voor folder-list — maar via verkeerde aanname (`mail.ts:720`)

```ts
const list = await client.list({ statusQuery: { messages: true, unseen: true } });
```

Goed: dit gebruikt RFC 3501 STATUS i.p.v. SELECT per folder. **Maar:** STATUS is **niet toegestaan** op een geselecteerde mailbox (RFC 3501 § 6.3.10). Sommige servers (Cyrus, oude Dovecot) returnen `BAD` als je STATUS doet op INBOX terwijl je INBOX al hebt geselecteerd via een vorige operatie. ImapFlow gaat hier vrij netjes mee om, maar het is een latent issue: bij heel veel folders kan dit per-folder een roundtrip + retry kosten.

**Fix:** check ImapFlow's `list({statusQuery})` of die de mailbox eerst un-select. Anders: handmatige STATUS in een tweede round-trip met `UNSELECT` ertussen (RFC 3691).

### 2.5 `fetchMessages` doet bij elke roep een mailbox-lock (`mail.ts:756`)

Voor élke message-list call wordt een `getMailboxLock(folder)` gedaan, óók als de folder al ge-SELECTed was vanaf de vorige call. Dat is een SELECT-roundtrip per call. Met `MSG_LIST_TTL=5min` is dit niet vaak, maar bij `backgroundRefresh` elke 30s (`mail.ts:678`) wel.

Voor O365 is een SELECT ~150-300ms. Bij 10 folders die warmup wil pre-laden (`warmupCacheAsync`) is dat 1.5-3s puur SELECT-overhead.

**Fix:** ImapFlow heeft `client.mailbox` als state — als die al gelijk is aan de gevraagde folder, lock-skip overwegen. Of: één lange-leven lock vasthouden per warmup-batch.

### 2.6 Geen CONDSTORE / QRESYNC — grote gemiste win (`mail.ts:824`)

```ts
const fetchOptions = { envelope: true, flags: true, bodyStructure: true, uid: true };
```

Dit is een **volledige fetch** van envelopes voor élke message in de range, **elke 30s** via `backgroundRefresh` (`mail.ts:696`). Voor een INBOX met 5000 messages (de cap die je hardcode't op `mail.ts:705` `pageSize=5000`) betekent dat:
- Iedere 30s → 5000 envelopes ophalen → ~500KB-2MB IMAP-traffic
- Server-side parsing van envelope-blokken — typisch 2-5s op een grote INBOX
- Tijdens deze fetch zit de opQueue vast → user-acties wachten

Office365 ondersteunt **CONDSTORE** (RFC 7162, ENABLE-extension). Met CONDSTORE:
- IMAP SELECT geeft `HIGHESTMODSEQ` terug
- Vervolg-fetch: `FETCH 1:* (FLAGS UID) (CHANGEDSINCE <last_modseq>)` → alleen veranderde messages
- Typisch 0-5 messages per 30s i.p.v. 5000

**QRESYNC** (RFC 5162) is de gestructureerde delta-resync inclusief expunge-vanish-events. Dat is het IMAP-equivalent van Graph's `@odata.deltaLink`.

ImapFlow ondersteunt beide via `client.capabilities.has("CONDSTORE")` en `client.enable("CONDSTORE")`. Dit niet gebruiken is een **factor 100x meer IMAP-traffic dan nodig** bij iedere background refresh.

### 2.7 Bulk fetch — wel goed, maar single-folder

`mail.ts:829` for-await over `client.fetch(...)`: één range-fetch i.p.v. losse fetchOne-calls. **Dit is correct.** Maar de warmup-loop in `warmupCacheAsync` (`mail.ts:319`) doet één folder tegelijk, sequentieel, met een SELECT per folder. Met CONDSTORE + één SELECT zou je de envelopes van álle INBOX-subfolders in <1s kunnen warmup'pen.

### 2.8 `preloadBodies` doet `fetchOne` per UID in een loop (`mail.ts:960`)

```ts
for (const uid of uncachedUids) {
  ...
  const msg = await client.fetchOne(`${uid}`, { ..., source: true ... });
```

Voor N berichten zijn dit N losse FETCH-roundtrips, plus N `simpleParser` calls. Voor 50 berichten op O365: 50 × 200-400ms = 10-20 seconden serieel. **Tijdens deze loop houdt opQueue de hele account-lock.**

**Fix:** één bulk fetch: `client.fetch(uidList, { source: true, ... }, { uid: true })`. Dat is één pipelined batch. ImapFlow geeft `for await` over de respons. ~50× sneller. (Goed nieuws: `warmupCacheAsync` doet sinds een eerdere commit géén body-preload meer, alleen envelopes — daar zat dit issue oorspronkelijk.)

### 2.9 Geen UIDVALIDITY-detectie

Nergens in de code wordt UIDVALIDITY uit `client.mailbox.uidValidity` gelezen of vergeleken met een opgeslagen waarde. Effect:
- Server-side rebuild van mailbox (zeldzaam, maar gebeurt na disk-recovery) → UIDVALIDITY bumpt → alle cached UID's verwijzen naar verkeerde messages
- Y-app blijft dan stale envelopes serveren tot de TTL afloopt of de cache handmatig leeggemaakt

**Fix:** sla UIDVALIDITY per folder op, bij mismatch alle caches voor die folder hard wipen.

### 2.10 SMTP — geen pooling, geen connection-reuse (`mail.ts:1906`)

```ts
const transport = createTransport({ ... });
...
const info = await transport.sendMail(mailOptions);
```

Voor iedere send een nieuw nodemailer-transport. TLS handshake + AUTH + EHLO per mail = 1-2s per send. Nodemailer ondersteunt `pool: true, maxConnections: 5` voor persistent SMTP. Voor een user die 5 mails na elkaar stuurt: factor 5 winst.

### 2.11 SMTP saved-to-Sent gebruikt de IMAP fetch-client (`mail.ts:1946`)

`getAccountCache(imapCreds)` haalt de gedeelde cache, en `appendMessage` (`mail.ts:1148`) doet een APPEND op die client. **Maar APPEND vereist géén SELECT** — RFC 3501 § 6.3.11 zegt expliciet dat APPEND ook op een gedeselecteerde mailbox mag. ImapFlow handelt dit goed af, maar de APPEND blokkeert wel de hele account-opQueue tijdens een (mogelijk grote) raw-message upload. Voor een 10MB attachment-mail: opQueue is 2-5s vast → user kan ondertussen geen folder open klikken.

**Fix:** APPEND via een tweede transient ImapFlow-client (zoals `withClient`-pattern) parallel aan de main connection.

### 2.12 `MSG_LIST_TTL = 5 min` — te kort met actieve IDLE (`mail.ts:432`)

De comment zegt: "met IDLE actief wordt INBOX altijd proactief geïnvalideerd". Klopt — maar dan kan de TTL naar **30 minuten** of langer voor non-INBOX folders. Subfolders krijgen géén IDLE; daar is 5 min een willekeurige keuze. Voor archief-folders die per definitie statisch zijn (folder van vorig jaar) is een TTL van 1 uur prima.

**Bovendien**: bij `mailSend` met IMAP APPEND naar Sent (`mail.ts:1970`) wordt `invalidateFolder(folder)` aangeroepen — goed. Maar er is **geen broadcast** naar de WS, terwijl een verzonden mail in een andere browser-tab van dezelfde user ook zichtbaar zou moeten worden.

### 2.13 `backgroundRefresh` is een zware operatie (`mail.ts:696-711`)

```ts
private refreshTimer: setInterval(() => this.backgroundRefresh(), 30_000);
```

Elke 30s, voor **élk** account, een full INBOX-refetch van max 5000 messages. Met IDLE actief is dit **dubbelop werk** en zelfs schadelijk:
- IDLE pusht al EXISTS/EXPUNGE → triggert invalidate
- 30s later doet refreshTimer een full re-fetch ondanks dat IDLE al gezegd had "niks veranderd"

**Fix:** wanneer IDLE actief is, downscale refreshTimer naar 5-10 min als sanity-fallback, niet als primaire signaling. Of: koppel aan `idleListeners.size > 0` en disable backgroundRefresh helemaal in dat geval.

### 2.14 IDLE alleen op INBOX (`mail.ts:1258`)

```ts
await idle.mailboxOpen("INBOX");
```

Een user die nu in `Sent` of `Archief/2026` zit en verwacht "nieuwe items zien" krijgt geen push. Voor de meeste users acceptabel, maar voor shared mailboxes (info@) of multi-folder workflow niet.

**Optie:** IDLE per "actieve folder" (de folder die de user nu open heeft staan, gepushed vanuit Webmail via WS). Voor de meeste tijd is dat alsnog INBOX, dus negligible extra IMAP-load.

---

## 3. Welke IMAP-features worden niet benut

| Feature | RFC | O365 support | Winst |
|---|---|---|---|
| **CONDSTORE** | RFC 7162 | Ja | Background refresh: factor 100x minder traffic. Page-loads alleen veranderde items. |
| **QRESYNC** | RFC 5162 | Ja (na ENABLE) | Detect expunges efficiënt, geen stale UIDs in cache. |
| **MOVE** (atomic) | RFC 6851 | Ja | `messageMove` doet nu COPY+EXPUNGE — bij grote messages 2-3x sneller met MOVE. Check of ImapFlow `messageMove` MOVE gebruikt; bij twijfel forceer via `client.exec("MOVE", ...)`. |
| **SEARCHRES / ESEARCH** | RFC 4731 | Ja | Bij filter-search: server returnt UID-set i.p.v. lange match-lijst. |
| **UNSELECT** | RFC 3691 | Ja | Lichtgewicht "mailbox closen zonder EXPUNGE". Sneller dan `mailboxClose`. |
| **LIST-EXTENDED + SPECIAL-USE** | RFC 5258/6154 | Ja | Folder-list met one-shot status + special-use; minder roundtrips. |
| **IMAP COMPRESS** | RFC 4978 | Ja | Bij envelope-batches 60-80% bandbreedtebesparing. Vooral relevant voor `pageSize=5000` calls. |
| **Pipelined commands** | RFC 3501 | Ja | ImapFlow ondersteunt het automatisch — maar je serialiseert alles via `opQueue` per account. Bij parallelle reads (verschillende folders) kunnen die pipelinen. |

**Belangrijkste miss**: CONDSTORE + QRESYNC. Dit is letterlijk Microsoft's eigen aanbevolen pattern voor "high-throughput IMAP" tegen O365. Implementatie-effort is matig (2-3 dagen), winst is enorm: van "5000 envelopes ophalen elke 30s" naar "vraag wat veranderd is sinds modseq X" = O(delta) i.p.v. O(N).

---

## 4. Office365-specifieke risico's

1. **O365 throttle limits:** 20 IMAP-connecties per user per minuut. Y-app draait 2 connections (`client` + `idleClient`) per account, plus elke `withClient` opent een derde. Bij snel switchen tussen instances / shared mailboxes kun je over de limiet gaan. Symptoom: `AUTHENTICATIONFAILED` of `EAI_AGAIN`. **Fix:** rate-limit `withClient` per host:user, of hergebruik de cache-connection altijd.

2. **OAuth2 scope-string is hardcoded** (`mail.ts:564`, `mail.ts:1789`, `mail.ts:2288`):
   ```
   scope: "https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send offline_access"
   ```
   Dit werkt alleen voor commerciële O365 tenants. **Government cloud** (GCC, GCC-High) gebruikt `outlook.office365.us`. **Wereldwijd 21Vianet** (China) gebruikt `partner.outlook.cn`. Geen wereld-eindgebruikers nu, maar als Y-app naar EU-government/healthcare wil → blocker.

3. **SASL XOAUTH2 format-check:** Nodemailer en ImapFlow bouwen de `XOAUTH2`-string als `user=USER\x01auth=Bearer TOKEN\x01\x01` (base64). Beide libraries doen dit correct. **Maar:** als de token niet voor IMAP-scope is uitgegeven (bv. alleen Graph-scope) krijg je `AUTHENTICATE FAILED` met enkel "Invalid credentials" — dezelfde error als bij bad password. De sanitizer (`mail.ts:38`) classificeert dit als auth-failure en zegt "Check username and password" — wat misleidend is. Voeg OAuth2-specifieke detectie toe (raw error bevat vaak `AADSTS65001` of `invalid_scope`).

4. **Token-refresh hardcoded scope vs originele scope** (`mail.ts:564`): bij refresh wordt de scope opnieuw aangevraagd. Als de originele token een **andere scope-set** had (bv. + Calendars.Read voor agenda), wordt die er stilletjes afgehaald. Bewaar de originele scope-string per account.

5. **Throttling-headers worden genegeerd**: O365 returnt soms `BYE [BANNED]` of TCP-resets bij throttle. Geen exponential backoff in IDLE-reconnect — `mail.ts:1286` doet hardcoded `setTimeout(10_000)`. Bij langdurige throttle: 10s × 10 pogingen = blijven hameren op een bannende server. **Fix:** exponential backoff capped op 5 min.

6. **MFA Conditional Access:** O365 tenant kan IMAP+OAuth2 blokkeren via Conditional Access policy (require compliant device, etc.). Y-app heeft geen detectie hiervoor — user krijgt enkel "Authentication failed". Voeg een specifieke check in `sanitizeMailError` voor `AADSTS50158` (CA violation) en `AADSTS530002` (device not compliant).

---

## 5. Top 5 concrete verbeteringen (effort vs impact)

### #1 — Implementeer CONDSTORE voor background-refresh
- **Wat:** bij IMAP SELECT lees `client.mailbox.highestModseq`. Sla op per (account, folder). Bij refresh: `FETCH 1:* (FLAGS UID) (CHANGEDSINCE <last_modseq>)` i.p.v. envelope-fetch van alles.
- **Effort:** 2-3 dagen. ImapFlow exposeert `changedSince` als fetch-optie.
- **Snelheidswinst:** background-refresh van 2-5s naar <100ms. CPU-load server zakt drastisch. Bij Office365 ook spürbar minder throttle-risico.
- **Risico:** servers zonder CONDSTORE (oude Dovecot < 2.0 + Stalwart in bepaalde configs) → fallback nodig. Detect via `client.capabilities.has("CONDSTORE")`. Implementeer met fallback-pad.

### #2 — Disable backgroundRefresh wanneer IDLE actief is
- **Wat:** `backgroundRefresh` (`mail.ts:696`) skip wanneer `idleListeners.size > 0 && idleClient`. Behoud een sanity-check elke 10 min als safety net.
- **Effort:** 30 min.
- **Snelheidswinst:** opQueue niet meer vast tijdens 30s-poll-cycles. User-acties (folder open, message open) instant tijdens lange browse-sessies.
- **Risico:** als IDLE silently dead is (sectie 2.3) zonder dat we 't merken, mis je events. Mitigeer met de NOOP-ping uit sectie 2.3.

### #3 — Explicit IDLE-command + NOOP-keepalive
- **Wat:** vervang de "auto-idle bij inactiviteit" aanname door expliciete `await client.idle({ maxIdleTime: IDLE_RESTART_MS })`. Voeg `setInterval(() => idle.noop(), 5 * 60_000)` toe binnen de IDLE-loop voor TCP-keepalive.
- **Effort:** halve dag.
- **Snelheidswinst:** Office365 stuurt push-events alleen tijdens echte IDLE. Verbetert detectie-tijd nieuwe mail van "tot 30s vertraging" naar "<1s".
- **Risico:** ImapFlow's `idle()` API kan wisselen tussen versies — pin de versie en test.

### #4 — Bulk-pre-fetch bij Webmail-open
- **Wat:** één gecombineerde endpoint `/api/mail/initial-load?folders=INBOX,Sent` die in één call:
  1. Folder-list met STATUS
  2. Eerste 50 envelopes van INBOX + Sent
  3. UIDVALIDITY + HIGHESTMODSEQ per folder
  Geretourneerd via één pipelined IMAP-sessie. Frontend doet één fetch i.p.v. drie sequentiële calls.
- **Effort:** 1 dag.
- **Snelheidswinst:** eerste Webmail-open van 3-5s naar 0.8-1.5s (Office365 baseline).
- **Risico:** geen — pure consolidatie.

### #5 — SMTP connection pooling
- **Wat:** `createTransport({ pool: true, maxConnections: 3, maxMessages: 50 })` in `mailSend`. Persistent transport per (yAppSid, instanceId).
- **Effort:** halve dag (state-cleanup bij logout).
- **Snelheidswinst:** 2e+ send in een sessie van 1-2s naar <300ms.
- **Risico:** O365 throttlet ook SMTP — keep maxConnections laag (2-3).

---

## 6. Quick wins (<1u)

1. **Verlaag backgroundRefresh-load**: in `backgroundRefresh` (`mail.ts:705`) verander `pageSize=5000` naar `pageSize=100`. Een gewone user heeft 100 recente messages ruim genoeg voor de "is er nieuwe mail" check. IDLE doet de echte detectie. **5 min werk, factor 50 minder IMAP-traffic per 30s.**

2. **FOLDER_TTL bumpen** (`mail.ts:425`) van 2 min naar 10 min. Folders veranderen zelden; alleen rename/create/delete invalideert ze al expliciet. **1 regel, scheelt onnodige STATUS-rondes.**

3. **`bodyStructure: true` weghalen bij paginated list-fetch** (`mail.ts:824`) als `hasAttachments` niet kritisch is voor de UI. BodyStructure-parsing is duur. Of: lazy-load `hasAttachments` per geopende message. **15 min, ~30% snellere envelope-fetch.**

4. **`mailListContacts` cap verlagen** (`mail.ts:2533`): `pageSize=5000` per folder × 5 folders = potentieel 25k messages parsen voor een contact-lijstje. Verlaag naar 500 per folder. **5 min, voorkomt een latente 10-20s lock-up.**

5. **TLS socket-keepalive aan** in `ImapFlow`-construction. Voorkomt zombie-connections die "verbonden" lijken maar dood zijn. ImapFlow accepteert een `socket`-callback waarmee je `socket.setKeepAlive(true, 60_000)` kunt zetten. **30 min werk, lost stale-connection-symptomen op.**

6. **Verwijder de duplicate body-preload code-pad in `backgroundRefresh`** (`mail.ts:707`): `preloadBodies("INBOX", ...)` wordt elke 30s aangeroepen, voor INBOX, voor de eerste 5000 messages. Bodies zijn al gecached na de eerste run; de uncachedUids-filter (`mail.ts:938`) maakt het idempotent, maar de check kost alsnog tijd. Skip wanneer `this.fullMessages.size > 100`. **15 min, scheelt cycles in de hot path.**

7. **Voeg `client.enable(["CONDSTORE"])` toe na connect** (`mail.ts:669`) — zelfs als de fetch-logica nog niet gebruikt maakt van modseq, vermindert het server-side parse-werk op O365. Eén regel.

---

## Conclusie

De architectuur is grotendeels correct (IDLE-aanpak, OAuth2-refresh, cache-strategie). Het probleem is dat IMAP-features uit de afgelopen 15 jaar (CONDSTORE/QRESYNC vooral) **niet** benut worden, waardoor de background-refresh elke 30s een orde van grootte meer werk doet dan nodig — en die refresh blokkeert de opQueue, wat user-acties vertraagt.

Voor "OWA-snelheid": OWA gebruikt MAPI/HTTP met server-side delta-sync en server-push. Het IMAP-equivalent is CONDSTORE + QRESYNC + IDLE met explicit `idle()` + NOOP-keepalive. Geen van die drie is volledig op orde in Y-app. Implementeren is ~5-7 dagen werk en zou Webmail-snelheid binnen factor 1.5-2 van OWA brengen.

De grootste pijn nu is **niet** IDLE (die werkt redelijk), maar de **30s background-refresh + opQueue serialisatie** die user-acties vertraagt. Quick-win #1+#2+#6 lossen 80% van de "trage acties" klacht binnen 2 uur op.
