# E2E Webmail timing-meting — 2026-05-21

**Methode:** Playwright MCP tegen `localhost:5173` (Vite + Express :3500). Fetch-sniffer op `window.fetch` capteert TTFB / total / status / body-size. DOM-observer detecteert wanneer mail-body `<iframe srcdoc>` verschijnt.

## Gemeten resultaten

| Actie | Beschrijving | Klik → DOM (ms) | Eerste fetch TTFB | Totaal-payload | Vervolg-fetches |
|---|---|---|---|---|---|
| **A** | Eerste klik mail #1 in INBOX (cold) | **332 ms** | 102 ms (`/mail/message`, 55 KB) | 1× message + 1× `/mail/conversation` (**17 816 ms!**) + 4× ERPNext `Communication`/`Contact` lookups (allen `len=11` = leeg) |
| **B** | Klik mail #15 in INBOX | **397 ms** | 67 ms (`/mail/message`, 26 KB) | 1× `/mail/conversation` (**4 105 ms**) + 2× ERPNext lookups (leeg) |
| **C** | Switch folder INBOX → Verzonden items | **432 ms** | 125 ms (`/mail/messages?pageSize=50`, 15 KB) | geen |
| **D** | Klik "Nieuw" (compose-dialog) | **137 ms** | n.v.t. (0 fetches) | n.v.t. — pure React-mount |
| **E** | 5 mails snel achter elkaar (idx 1-5) | klik 1-3: **502 (server geblokkeerd)**; klik 4: **2242 ms**; klik 5: **452 ms** | klik 4: 1925 ms (server pas vrij); klik 5: 185 ms | bij idx 5 was message 140 KB |

**Initiële page-load** (uit console): `[18 566 ms] Loaded 133 folders` + `Loaded 40 messages from INBOX`. De allereerste mail-list-render duurt dus al bijna **19 sec** na de Webmail-route mount. Vermoedelijk omdat de allereerste folder-list cold draait + zelfde event-loop blokkeert.

## Welke fase is traag — bewijs uit meting

1. **Server-fetch tijd voor `/api/mail/message` is OK** — 67-185 ms TTFB, payloads 26-140 KB. Dat komt overeen met Piet's 42-99 ms cache-HIT meting op de server zelf. **De server-cache werkt prima.**
2. **Mandatory 250 ms single-vs-doubleclick-timer** in `Webmail.tsx` (regel 5121-5126) is een vaste latency bij élke klik. Cold-fast actie A (332 ms) = 250 ms timer + 82 ms React-render + fetch (vrijwel 0 omdat parallel).
3. **`/api/mail/conversation` blokkeert de Express event-loop tot tientallen seconden.** Bewijs: actie A → 17 816 ms TTFB; actie B → 4 105 ms; actie E klik 1-3 → 502 Bad Gateway omdat Vite-proxy de upstream-timeout raakt terwijl `/api/mail/conversation` van A nog liep.
4. **Background-poll storm**: `/api/messenger/all-conversations` werd 8 keer in ~5 sec gevuurd (gemiddeld 660-786 ms TTFB elk) tussen kliks door — dat eet event-loop-tijd én database-locks weg.
5. **DOM-render zelf is snel** (50-150 ms tussen response binnen en `<iframe srcdoc>` getekend), niet de bottleneck.

## Top-3 concrete bottlenecks (gemeten, geen aannames)

### #1 — `/api/mail/conversation` is een serieele 3-folder IMAP-scan van 200 berichten

[`mail.ts:2701-2804`](../packages/server/src/mail.ts) doet voor élk geopend bericht met "Re:/Fwd:" in het onderwerp (of überhaupt threading-headers):

```
for (folder of [currentFolder, Sent, INBOX])
  await cache.fetchMessages(folder, false, 1, 200)  // 200 envelopes per folder
```

Bij cold Sent-cache duurde dit **17.8 sec** in mijn meting; bij warm Sent **4.1 sec**. Tijdens deze tijd blokkeert de account-`opQueue` (zie comment regel 2731-2733 "thread-storm gefixed"). Volgende mail-klikken stallen → 502 via Vite. Dit is **dé reden** dat een snel-cachehit op `/api/mail/message` (50 ms server-side) zich **toch traag voelt** op de client: de cascade-fetch ná de message-fetch blokkeert het volgende klik-event.

De v0.22.0 fix (envelope-only ipv full message) maakte het beter dan v0.21, maar het is nog steeds 200×3 = 600 envelope-lookups per thread-open.

### #2 — Verplichte 250 ms click-discriminatie-timer

[`Webmail.tsx:5121-5126`](../packages/frontend/src/pages/Webmail.tsx) wacht 250 ms voordat `openMessage` start, om dubbelklik (popout) te detecteren. Bij élke klik is dit pure dode tijd. Voor een gebruiker die in serie 5 mails wil scannen = 5×250 ms = **1.25 sec puur wachten** op de client zonder dat er iets in het netwerk gebeurt.

### #3 — Background-poll storm voor messenger

`/api/messenger/all-conversations` (8 KB elk) wordt elke ~600 ms herhaald terwijl WebSocket-events naar `/ws/events` falen (console: "WebSocket connection failed, Connection closed before receiving a handshake response, instance=3"). De WS-fallback poll is dan permanent actief en houdt de event-loop bezig terwijl mail-acties willen draaien. Bovendien zag ik 4× ERPNext `Communication`/`Contact` lookups (per mail-open, voor sender-enrichment), allen `len=11` = leeg → wasted server-roundtrips.

## Suggesties voor de echte fix (geen code geschreven)

1. **`/api/mail/conversation` async-en + niet meer blokken op opQueue**. Of: limiteer naar één folder (huidige) tenzij threading-headers expliciet naar Sent wijzen. Of: skip de call volledig als `messageId/inReplyTo/references` ontbreken — nu wordt-ie ook getriggerd op alléén een Re:-prefix in subject. Een aparte queue/connectie voor conversation-scans zou subsequent klikken niet meer laten stallen.
2. **WS-events fixen** (zie console: WS sluit met "Connection closed before receiving a handshake response"). Zolang WS niet werkt blijft de fallback-poll-storm doorgaan. Check de `noServer:true` + upgrade-routing in `index.ts` (CLAUDE.md noemt dit als verkeer-kritisch).
3. **250 ms click-timer verkleinen of optimistisch starten**. Toon de body al uit cache na 0 ms (cache-hit-pad bestaat al), trigger pas `\Seen` na 250 ms. Of: detecteer dubbelklik via een tweede `mousedown` binnen 250 ms i.p.v. wachten.
4. **De sender-enrichment ERPNext-lookups debouncen of bundelen**. Vier sequentiële calls per mail-open (Communication+Contact, 2× = vermoedelijk 2 verschillende effects die hetzelfde doen) met telkens lege response zijn pure ruis.
5. **Vite-proxy timeout verhogen** (nu rond ~10 s) — eigenlijk niet de fix maar voorkomt 502 tijdens het analyseren van het echte probleem.

## Notitie over de 502's

Tijdens actie C+E zag ik 502 Bad Gateway op meerdere endpoints. Curl tegen `localhost:3500` werkt direct (geen crash) — het is dus de Vite-proxy die afkapt terwijl de Express-server **per-account-opQueue** een conversation-scan aan het uitvoeren is. De server zelf is gezond; de queue is dicht.
