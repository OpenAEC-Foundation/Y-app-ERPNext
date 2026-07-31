# Playwright-walk + bevindingen — full app audit

**Datum:** 2026-05-21
**Methodiek:** Playwright tegen `https://y-app.impertio.app` (productie) + sniffer op `window.fetch`, `WebSocket`, `console.error/warn`, `window.error`, `unhandledrejection`. Walk van 22 hoofdpagina's via sidebar-clicks (SPA-routing) + deep-dive Webmail en Messenger met click-acties. Console-historie uitgelezen via Playwright's eigen `browser_console_messages` (vangt ook errors van vóór sniffer-install).

**Bron-rapporten in dezelfde commit:**
- [`2026-05-21-email-specialist-review.md`](./2026-05-21-email-specialist-review.md) — IMAP/SMTP protocol-review
- [`2026-05-21-server-specialist-review.md`](./2026-05-21-server-specialist-review.md) — server data-flow review

---

## 🔴 KRITIEK — Direct te fixen (security + broken features)

### 1. NextCloud-wachtwoord lekt in elke Messenger-URL (production)

Elke `/api/messenger/*` request bevat het NC-wachtwoord als **plaintext query-string**:
```
/api/messenger/all-conversations?url=https%3A%2F%2Fnextcloud.3bm.cloud&user=piet%403bm.co.nl&pass=82x0sb0uYAsG
/api/messenger/conversations?platform=nextcloud-talk&url=...&user=...&pass=82x0sb0uYAsG
/api/messenger/messages?...&pass=82x0sb0uYAsG&lookIntoFuture=1&lastKnownMessageId=7766
```

**Wat dit raakt:**
- Browser history (`history.pushState` capture'd het via geen route, maar fetch zit in network log van DevTools)
- nginx access logs (`access.log` op de VPS, met `$request_uri`)
- Y-app server logs (Express logt URL standaard)
- Cloudflare/proxy logs
- Browser referrer-header bij navigatie naar 3rd party

In de threat-model-tabel uit CLAUDE.md is dit precies wat verboden is. Het zit waarschijnlijk in [`packages/frontend/src/pages/Messenger.tsx`](../packages/frontend/src/pages/Messenger.tsx) `buildQuery()` — moet via POST-body of via server-side cached creds (zoals subscribe-mail al doet voor IMAP).

**Effort:** 2-3 uur. POST i.p.v. GET, OF server-side mail-cache-pattern toepassen voor NC creds.
**Risico:** Hoog. Dit moet eerst.

---

### 2. `/api/messenger/conversations` retourneert constant **HTTP 400 Bad Request**

In de console-historie: 100+ keer `400 Bad Request` op dit endpoint binnen ~10 min sessie. Met regelmatige cadans (matched 60s BackgroundSyncProvider-interval). Dit betekent dat de **sidebar-badge "Berichten" nooit update via deze fallback** — alles wat de gebruiker ziet komt uit Messenger.tsx zelf wanneer hij op /messenger staat.

Waarschijnlijke oorzaak: BackgroundSyncProvider stuurt geen `?url=&user=&pass=` mee (zie probleem 1), server geeft 400.

**Effort:** 1 uur. Aanpassen samen met fix #1.

---

### 3. NC Talk long-poll faalt structureel met **HTTP 502 Bad Gateway**

Voor de open conversatie (Maryam Hosseini, id `uh4w6da7`) loopt elke ~30s een long-poll:
```
GET /api/messenger/messages?platform=nextcloud-talk&conversation=uh4w6da7&...&pass=82x0sb0uYAsG&lookIntoFuture=1&lastKnownMessageId=7766
→ 502 Bad Gateway
```

100+ keer 502 in deze sessie. Dat betekent: **de "real-time push" voor de geopende Talk-chat werkt op productie niet**. Server side krijgt geen response van de NC server (timeout/auth/proxy-fout), en de gebruiker ziet pas updates via de 15s polling-fallback.

**Effort:** Onderzoek nodig — kan een NC Talk-config-probleem zijn (long-poll timeout >60s wordt door nginx of NC zelf afgekapt), of een server-side bug in `messenger-longpoll.ts`.
**Risico:** Verklaart een groot deel van de "Talk-bericht komt te laat"-klacht.

---

### 4. Shared mailbox **Info** geeft HTTP 500, **administratie** geeft 502/504

```
/api/mail/folders?email=info@3bm.co.nl&acct=info@3bm.co.nl&primaryEmail=piet@3bm.co.nl     → 500 Internal Server Error
/api/mail/messages?email=info@3bm.co.nl&...                                                  → 500
/api/mail/folders?email=administratie@3bm.co.nl&...                                          → 504 Gateway Timeout
/api/mail/messages?email=administratie@3bm.co.nl&...                                         → 502 Bad Gateway
```

Beide shared mailboxes zijn dus **niet bruikbaar via Webmail**. Bij switch naar Info-tab krijg je 500's; bij administratie krijg je timeouts. UI lijkt door te draaien (geen error-toast zichtbaar), maar er staat 0 mail.

**Effort:** Onderzoek nodig in [`packages/server/src/mail.ts`](../packages/server/src/mail.ts) shared-mailbox flow. Mogelijk credential-resolve faalt voor delegate-mailboxen.

---

### 5. ERPNext-permissie-errors (403) op Holiday + Timesheet Detail

```
/api/resource/Holiday?...filters=...["parent","=","Vakantiedagen 2026"]...      → 403 Forbidden
/api/resource/Timesheet Detail?fields=["project","hours","parent"]...           → 403 Forbidden
/api/resource/Shift Plan Assignment?...                                          → 417 Expectation Failed
```

Deze fouten worden in de UI niet getoond maar verstoren waarschijnlijk Vakantieplanning-modal + Dashboard-widgets stil. **403 Forbidden** suggereert dat de ingelogde ERPNext-user geen leesrechten heeft op die doctypes — config-issue op ERPNext-zijde, of frontend gebruikt te brede filter-queries.

**Effort:** Onderzoek + ERPNext-permissions check.

---

## 🟡 Performance-bevindingen uit de walk

### Page-load cadans (22 pagina's gemeten, alles via SPA-click)

| Pagina | Click→idle | Aantal requests | Slowest call |
|---|---|---|---|
| Dashboard | 768ms | 0 | — (cached) |
| **Management dashboard** | **1827ms** | **60** | 364ms |
| Contacten | 767ms | 2 | 127ms |
| Agenda | 870ms | 4 | 69ms |
| Documenten | 760ms | 1 | **935ms** (calendar/o365 — verkeerde pagina!) |
| Statistieken | 869ms | 8 | 84ms |
| Projecten | 766ms | 1 | 48ms (1 failed) |
| Offertes | 766ms | 1 | 56ms |
| Opdrachtbevestigingen | 763ms | 1 | 46ms |
| Leads | 764ms | 1 | 64ms |
| Vergadernotities | 747ms | 1 | 37ms |
| Delivery Notes | 749ms | 1 | 72ms |
| Taken | 761ms | 3 | 98ms |
| Subtaken | 829ms | 1 | 88ms |
| Planning | 758ms | 1 | 63ms |
| Urenregistratie | 763ms | 3 | 64ms |
| Todo | 760ms | 2 | 67ms |
| Kennisbank | 776ms | 1 | 172ms |
| Omzet | 769ms | 2 | 68ms |
| Openstaand | 867ms | 1 | 88ms |
| Medewerkers | 967ms | 12 | 104ms |
| Instellingen | 869ms | 2 | 68ms |
| **Webmail** | **1083ms** | 3 | 41ms |
| **Berichten** | **1089ms** | 3 | **552ms** (NC Talk) |

**Observaties:**
- 750-900ms is de **idle-detect floor** (idle-windowing waiting 700-1000ms), niet de feitelijke render-tijd. De meeste pagina's renderen onder de 200ms.
- **Management dashboard = 60 requests** voor één page-load. Geen enkele >364ms maar het volume is een rode vlag. Dit betekent N+1 op widgets.
- **Documenten triggert een /api/calendar/o365 call** terwijl die pagina niets met calendar doet — cross-page state-leak of een widget die overal mount.

### Webmail-acties

| Actie | Duur | Requests | Bijzonderheden |
|---|---|---|---|
| Switch to "Info" shared mailbox | 874ms | 2 | Beide **HTTP 500** — folders + messages broken |
| Switch to "administratie" mailbox | 878ms | 0 | Geen netwerk-call (al actief? of geblokkeerd door eerdere 500?) |
| Open compose dialog ("Nieuw") | 651ms | 1 | `/api/mail/signature` (83ms) — OK |

### Messenger-acties

| Actie | Duur | Requests | Bijzonderheden |
|---|---|---|---|
| Open Berichten | 1089ms | 3 | **Dubbele identieke `all-conversations` call** (552ms+551ms) |
| Switch tab → Talk | 864ms | 2 | `all-conversations` (582ms) + `conversations` (604ms) — twee endpoints voor "filter" |
| Open Maryam-conversatie | 1854ms | 1 | `/api/messenger/messages` (552ms) |

**Dubbele all-conversations call bij Messenger-open** = ~550ms verspilde tijd. Twee `useEffect`-hooks die beide laden bij mount.

---

## Cross-cutting bevindingen

### Polling-loops zichtbaar in netwerk

- `/api/messenger/conversations` elke ~60s (BackgroundSyncProvider) — momenteel **400 Bad Request** (zie kritiek #2)
- `/api/messenger/all-conversations` elke 15s wanneer op `/messenger` (Messenger.tsx)
- `/api/mail/unseen-summary` op 5min interval (pushActive=true)
- `/api/messenger/messages?lookIntoFuture=1` long-poll ~elke 30s — momenteel **502 Bad Gateway** (zie kritiek #3)

### Document-pagina-leak

`/api/calendar/o365?email=piet@3bm.co.nl&start=2026-05-18&end=2026-05-24` werd opgehaald bij Documenten-click. Documenten heeft niets met calendar. Waarschijnlijk een widget of context-component die op alle pagina's mount.

### Geen failed requests in nieuwe-pagina-clicks behalve Projecten (1×)

Projecten gaf 1 failed request bij eerste load. Te onderzoeken.

---

## Specialist-bevindingen (samengevat)

### Email-specialist ([report](./2026-05-21-email-specialist-review.md))

- **`backgroundRefresh` doet elke 30s een full envelope-fetch van max 5000 INBOX-berichten** (`mail.ts:705`). Met IDLE actief is dit volkomen onnodig. Blokkeert bovendien `opQueue` zodat user-acties wachten.
- **IDLE-strategy via ImapFlow auto-idle i.p.v. expliciete `client.idle()`** — Office365 vereist explicit IDLE voor push-events.
- **Geen NOOP-keepalive** → silent NAT-deaths blijven 25 min onopgemerkt.
- **SMTP zonder connection-pooling** → TLS+AUTH per send (~500-800ms overhead/mail).
- **CONDSTORE/QRESYNC (RFC 4551/5162) niet gebruikt** — dit is het IMAP-equivalent van Graph's `@odata.deltaLink`. Factor 100 minder delta-traffic mogelijk.

**Quick wins (<2u):** `backgroundRefresh` pageSize 5000 → 100, `FOLDER_TTL` 2min → 10min, `backgroundRefresh` disablen wanneer IDLE actief is.

### Server-specialist ([report](./2026-05-21-server-specialist-review.md))

- **Mail-creds-resolve via ERPNext doet 4-6 sequentiële calls + 1 token-refresh** (1-2.5s cold), zonder coalescing. Parallelle `/folders`+`/messages` triggert beide dezelfde resolve.
- **`/api/mail/unseen-summary` doet IMAP STATUS over álle folders** (20+ × 50-200ms = 1-3s per poll, elke 60s). Dedicated per-folder unseen-store met IDLE-invalidation → <50ms.
- **IDLE start pas on-demand**. Bij dichte browser geen real-time push. Proactief IDLE starten bij elke actieve sessie.
- **`mailGetSignature` doet 4× ERPNext-calls per request** — cacheable.
- **Static imports in `authMiddleware`** missen — kleine winst per request.

**Quick wins (<2u):** parallelize get_password met `Promise.all`, in-flight coalescing voor creds-resolve, `CONVO_CACHE_TTL` 30→90s, signature-cache.

---

## Aanbevolen volgorde — gecombineerd plan

### Wave 0 (DIT EERST, ~3-4u, kritiek)

1. **NC Talk creds uit URL halen** — POST i.p.v. GET, of server-side resolve via subscribe-conversation (zoals subscribe-mail). Lost #1, #2 en parallel #3 op.
2. **Shared mailbox Webmail-bug onderzoeken** — waarom 500/502/504. Mogelijk credential-resolve voor delegate accounts.
3. **502 Bad Gateway op NC long-poll onderzoeken** — wat is de timeout-keten browser → nginx → server → NC Talk?

### Wave 1 (~4u, server-side quick wins zonder risico)

4. `backgroundRefresh` pageSize 5000 → 100 in `mail.ts`
5. `backgroundRefresh` disablen wanneer IDLE actief
6. `FOLDER_TTL` 2min → 10min
7. Parallel ERPNext get_password-calls in mail-creds-resolve (`Promise.all`)
8. In-flight coalescing voor mail-creds-resolve
9. Dubbele `all-conversations` call dedupen in `Messenger.tsx`

### Wave 2 (~3u, frontend-side fixes)

10. ERPNext-permissie-errors: 403 op Holiday/Timesheet/Shift Plan — config-fix of frontend-query bijwerken
11. `/api/calendar/o365` cross-page leak op Documenten — widget-mount-scope corrigeren
12. Management dashboard N+1 — 60 requests bekijken en batchen waar mogelijk

### Wave 3 (~1-2 dagen, push-latency revised)

13. F1+F3 revised uit eerder rapport — `push-status`-tick + `no_email`-handling
14. Messenger-poll-interval 60s → 20s (quick win uit eerder rapport)

### Wave 4 (~1 week, OWA-tier)

15. CONDSTORE/QRESYNC implementatie in mail.ts
16. Server-side SQLite envelope-cache (F4 revised)
17. Per-folder unseen-count store met IDLE-invalidation
18. Optimistic UI voor read-mark/delete/move

---

## Wat nog niet gemeten is

- **Koude cache na server-restart** (zou ik nog kunnen meten door PM2-restart-trigger of door reload met `Cache-Control: no-cache`)
- **Compose + send mail** flow (alleen open getest)
- **Talk send-message + react** flow
- **Drag-and-drop file upload**
- **Mobile-viewport gedrag** (Playwright is desktop)
- **Verschillende ERPNext-instances** (Y-app multi-instance — alleen 3BM gemeten)

Deze kunnen in een vervolg-sessie.
