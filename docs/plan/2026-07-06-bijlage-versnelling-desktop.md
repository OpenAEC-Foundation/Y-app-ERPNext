# Plan: bijlage-versnelling — desktop cachet standaard mee, web 10-minuten-cache

> **Implementatie-handoff.** Feiten geverifieerd in de code op 2026-07-06 (branch `fix/desktop-popout-uid`); zoek bij drift op symboolnaam. Lees eerst CLAUDE.md-secties "Lokale mail body-cache", "Lazy bijlage-cache" en "TS↔Rust drift-safety".
>
> **Beslissing Piet (2026-07-06):** géén instelvinkje. Desktop cachet bijlages **standaard mee** binnen het bestaande 30-dagen-venster (Outlook/Thunderbird-model); web houdt lazy loading maar onthoudt een eenmaal opgehaalde bijlage **10 minuten** i.p.v. het hele venster.

## Symptoom & meting

Piet: een PDF van 4 MB openen op desktop kost ± 4 seconden. De **tweede** open van dezelfde bijlage is al instant (IndexedDB-bijlagecache) — het probleem is de **eerste** open.

## Kostenketen (geverifieerd) — en de sleutel-observatie

Bij elke eerste bijlage-open op desktop, in serie:

| # | Stap | Kosten bij 4 MB |
|---|------|-----------------|
| 1 | **Volledige mail opnieuw downloaden** — `op_get_attachment` fetcht `BODY.PEEK[]` = de héle MIME-mail (± 5,5 MB op de draad) | ~1–2,5 s (netwerk) |
| 2 | MIME-parse van de hele mail (2e keer) | ~50–150 ms |
| 3 | base64-encode 4 MB → 5,3 MB JSON-string (Rust) | ~30–80 ms |
| 4 | Tauri-IPC JSON-marshal van 5,3 MB door de webview-bridge | ~100–400 ms |
| 5 | JS: `atob()` + `charCodeAt`-loop over 4M+ posities ([fetch.ts](../../packages/desktop/src/adapter/fetch.ts) r. ~1493) | ~200–600 ms |

**Sleutel-observatie:** de **30-dagen-body-prefill downloadt de bijlage-bytes al volledig** — `fetchBodiesBatch` (server) en `mail_get_bodies` (desktop-Rust) fetchen `BODY.PEEK[]` per mail, dus inclusief alle bijlages, en gooien vervolgens alleen de bijlage-bytes weg. De netwerkkosten zijn al betaald; alleen het bewaren ontbreekt. Andere desktop-clients (Outlook OST, Thunderbird, Apple Mail "Alle") bewaren bijlages binnen hun offline-venster standaard wél.

## Deel A — bijlages mee-cachen (hoofdmoot)

### Desktop: standaard aan, geen instelling

1. **Rust** ([mail.rs](../../packages/desktop/src-tauri/src/mail.rs), `op_get_bodies`/`mail_get_bodies`): de al-geparste `mail_parser`-message bevat de attachment-parts. Voeg per bericht een `attachments`-array toe aan de bestaande bodies-respons: `{ index, filename, contentType, contentBase64 }`. Gate 'm achter een nieuw command-argument `withAttachments: bool` zodat het gedrag expliciet is (de web-route verandert NIET — dit is een adapter/Rust-interne uitbreiding; geen server-wijziging, geen parity-testwijziging).
   - *Bewuste afweging:* dit duwt bijlage-bytes als base64 door de IPC-bridge — normaal te vermijden, maar de prefill is een **achtergrondproces** (geen interactieve latency) en de bytes zijn er tóch al. CPU-kosten accepteren; niet optimaliseren vóór het meetbaar knelt.
   - *Grootte-guard:* sla bijlages > 50 MB per stuk over (logbaar) — bescherming tegen extreme uitschieters; Outlook kent vergelijkbare limieten.
2. **Adapter** ([fetch.ts](../../packages/desktop/src/adapter/fetch.ts), `/api/mail/bodies`-route): geef `withAttachments: true` mee aan de invoke **alleen op desktop** en zet de attachments door in de respons-JSON.
3. **Frontend** ([mail-body-prefill.ts](../../packages/frontend/src/lib/mail-body-prefill.ts) + `syncNewBodies`): wanneer de bodies-respons attachments bevat (dus: desktop), persist ze via de bestaande `persistAttachment` naar de bestaande `message_attachments`-store. Zelfde key-schema (`instance⌀acct⌀folder⌀uid⌀index`).
4. **Opruimen: bestaat al.** `evictAttachmentsOlderThan` draait al mee met het rollende venster; `clearAllMailCache` (privacy-wipe bij uitloggen) wist de store al; quota-reclaim (`reclaimOldestAttachments` + 1× retry) bestaat al. De "Nu opgeslagen: X MB"-weergave in ImapSetup telt de bijlage-bytes al mee (`sizeOfCachedAttachments`). **Geen nieuwe infrastructuur nodig.**
5. **Koppeling met de bestaande cache-instelling:** staat de mail-cache uit (venster = 0 dagen), dan ook geen bijlage-prefill — zelfde schakelaar, geen aparte.

### Web: lazy + 10-minuten-retentie

- Lazy fetch blijft exact zoals nu (`fetchAttachmentBlob`: cache → server → persist).
- **Eviction wijzigt op web**: opgehaalde bijlages worden na **10 minuten** (op `ts` = fetch-moment, niet maildatum) opgeruimd i.p.v. het 30-dagen-venster. Implementatie: platform-splitsing (`isDesktopApp()`) op de eviction-aanroep in het pre-fill-effect van [Webmail.tsx](../../packages/frontend/src/pages/Webmail.tsx) — desktop houdt `evictBodiesOlderThan`-venster-gedrag, web krijgt `evictAttachmentsOlderThan(now − 10 min)` (op fetch-ts; check of de bestaande helper op `ts` of `mailDate` filtert en voeg zo nodig een ts-variant toe in [mail-cache-db.ts](../../packages/frontend/src/lib/mail-cache-db.ts)).
- ⚠️ **Let op (bewust gemeld):** dit VERKORT de huidige web-retentie — nu blijven eenmaal geopende bijlages het hele venster staan. Piet's keuze; houdt de browser-opslag klein. Terugdraaien is één regel.

### Verwacht resultaat Deel A

- **Desktop, mail binnen het venster** (de dagelijkse praktijk): bijlage openen = IndexedDB-hit = **instant én offline**, ook de eerste keer. De 4-secondenklacht is hiermee weg voor vrijwel alle normale mail.
- **Web**: gedrag praktisch gelijk aan nu (snelle her-open binnen 10 min), kleinere opslag-voetafdruk.

## Deel B — binaire IPC voor de koude paden (klein, blijft zinvol)

Voor bijlages **buiten** het venster (oude mail), tijdens een nog-lopende eerste prefill, en voor NextCloud-downloads blijft het base64/IPC/atob-pad bestaan. Tauri 2.10 ondersteunt raw-binary responses:

1. Rust: `mail_get_attachment_raw(...) -> tauri::ipc::Response` (`Response::new(bytes)`); registreren; het base64-command `mail_get_attachment` daarna verwijderen (één caller, geverifieerd).
2. Metadata (contentType/filename) reist niet mee in een raw-response → frontend geeft ze als queryparams mee (`ct=`, `fn=`) aan de adapter-route; die zet ze in de Response-headers (fallback `application/octet-stream`). Web-route verandert niet (extra queryparams worden daar genegeerd).
3. Adapter: `const buf = await invoke<ArrayBuffer>(...)` → `new Response(buf, …)`; atob-loop weg.
4. Zelfde fix voor de tweede atob-site: `nextcloud_download` (fetch.ts r. ~976) → `nextcloud_download_raw`.

Winst koud pad: −0,5 à −1 s (stappen 3–5 uit de tabel vervallen).

## Deel C — GEPARKEERD: Rust raw-message-LRU

Het eerdere idee (raw-mail 10 min in Rust-geheugen zodat bijlage-open van een open mail geen her-download doet) zakt naar lage prioriteit: Deel A dekt vrijwel alle gevallen via de duurzame cache. Alleen heroverwegen als metingen tonen dat het koude pad (mail buiten venster) nog te vaak voorkomt.

## Wat bewust NIET doen

- Geen instelvinkje (beslissing Piet) — desktop standaard aan, gekoppeld aan de bestaande venster-instelling.
- Geen custom-URI-scheme-protocol; geen streaming/chunking.
- Geen wijziging aan de web-server (`/api/mail/bodies` en `/api/mail/attachment` blijven zoals ze zijn — alles is adapter/Rust/frontend-werk).
- Geen aparte Rust-schijfcache voor bijlages (zou de web/desktop-cachelaag splitsen); IndexedDB blijft de ene laag.

## Verificatie

1. Gates: `cargo check` + `cargo test`; desktop `vite build`; frontend `tsc -b` + build + tests; parity-test (geen route-wijzigingen — moet groen blijven).
2. **Headless meting**: `examples/mailprofile.rs` uitbreiden met een timing voor `op_get_bodies` mét vs. zónder `withAttachments` (bewijst dat de prefill-verzwaring acceptabel is) en voor `mail_get_attachment_raw` koud (bewijst Deel B).
3. **Runtime** (release of `tauri dev` door Piet): (a) prefill laten draaien → mail met 4 MB-PDF openen → bijlage klikken → moet instant zijn; (b) "Nu opgeslagen"-teller in ImapSetup moet zichtbaar groeien met bijlage-bytes; (c) uitloggen → cache leeg (privacy-wipe).
4. Web-regressie: bijlage openen → binnen 10 min her-openen = instant; na > 10 min opnieuw lazy geladen.

## Omvang & risico

- Deel A: Rust ~50 regels, adapter ~15, frontend ~40 (prefill-persist + web-evictie-splitsing). **Omvang: M.** Risico: laag — alle gevoelige infrastructuur (persist, evictie, quota, wipe, weergave) bestaat en is in productie beproefd; nieuw is alleen het *aanroepen* ervan vanuit de prefill.
- Deel B: Rust ~40, adapter ~30, frontend ~10. **Omvang: S.** Risico: laag.
- Volgorde: **A eerst** (lost de klacht op), dan B. C parkeren. Elk als eigen commit met eigen gates.
- Grootste open risico van A: **schijfgebruik** bij tekeningen-zware mailboxen (30 dagen kan meerdere GB zijn). Mitigaties zitten erin (50 MB-per-bestand-guard, quota-reclaim, zichtbare teller); als het in de praktijk knelt is de volgende stap een aparte bijlage-vensterinstelling — pas bouwen als het zich aandient.
