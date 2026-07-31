# Changelog

All user-visible changes, per release. Append-only, newest first.

This file is **not** loaded into Claude Code sessions automatically — it is historical reference. For the live architectural picture, see [`CLAUDE.md`](./CLAUDE.md); for current WIP, see [`STATUS.md`](./STATUS.md).

Older entries (v0.3.x and below) are in Dutch; newer entries are in English — no rewrite attempted.

---

## v0.32.0 — 2026-07-11

### Toegevoegd
- **agenda**: sleep in week-/dagweergave om een nieuw item aan te maken

### Opgelost
- **desktop**: popout-vensters falen nooit meer stil — tauri://error zichtbaar + focus


## v0.31.2 — 2026-07-10

_Onderhoud / interne wijzigingen._

## v0.31.1 — 2026-07-09

### Opgelost
- **desktop**: IMAP-loginstorm bij mailbox-wissel — AUTHENTICATIONFAILED-cirkel doorbroken
- **mail**: relay alleen bij bewezen From-behoud — lookup-fout is nu ook weigeren
- buglist-ronde juli — 9 gebruikersbugs + GitHub issues #100-#104


## v0.31.0 — 2026-07-06

### Toegevoegd
- **notify**: geluidssignaal + app-icoon-teller bij nieuwe mail én chat
- **desktop**: ongelezen-teller voor ALLE mappen (achtergrond-STATUS-sweep)
- **webmail**: nieuwe mail/beantwoorden inline in het leespaneel i.p.v. zwevend popup
- **mail**: bijlages mee-cachen op desktop (instant openen) — Deel A van het versnellingsplan

### Opgelost
- **desktop**: ongelezen-teller achter de Junk/Spam-map in de mappenlijst
- **desktop**: verzonden mail bewaren in Verzonden + verwijderen → prullenbak (geen permanent verlies)
- **mail**: Verzonden-/Verwijderde-map-instelling keyt nu op account (werd niet gehonoreerd)
- **nas**: volgnummer-scan toont nu "scant…" i.p.v. een misleidende "1" tijdens laden
- **desktop**: PDF-bijlage werd stil gedownload i.p.v. geopend als preview
- **nas**: medewerkers kregen nooit de door de werkgever ingestelde NAS-template
- **mail**: popout-mailbody liep niet door — iframe kreeg nooit zijn eigen hoogte
- **desktop**: mail-popout gaf "Missing uid in URL" — window.location i.p.v. MemoryRouter

### Verbeterd
- **desktop**: popout boot seconden sneller — creds-handoff i.p.v. kluis heropenen


## v0.30.0 — 2026-07-04

### Toegevoegd
- **desktop**: meerdere vensters — mail/chat-popouts via echte Tauri-windows (OPMERKINGEN punt 2)
- **desktop**: agenda-afspraak aanmaken + factuur-preview — simpeler dan gedacht
- **desktop**: 10 resterende gaps gedicht — NC-bestanden, messenger-compleet, counts/prefs/settings
- **desktop**: Talk-upload (plaatje versturen!) + reactie/bewerk/verwijder — 4 messenger-gaps gedicht
- **leave**: overuren op niet-roosterdagen rood tonen in OverurenView (per-dag-detail)

### Opgelost
- **webmail**: toast-severity regexes dekken nu álle echte bundle-strings (review-fix op #1)
- **webmail**: bugfix #5 (deep-link cache-key account-bewust) + #1 (toast-severity locale-robust)
- **webmail**: 5 geverifieerde bugfixes uit de audit (races, folder, modal, bulk-confirm)

### Verbeterd
- **frontend**: move 9 inline mail components to components/mail/*
- **frontend**: extract Webmail helpers to lib/ (9 modules, tests-eerst)
- **frontend**: extract shared mail types to lib/mail-types.ts

### Overig
- **drift**: gedeelde response-envelope-types server↔desktop (api-shapes.ts)
- **de**: backfill 351 ontbrekende keys + locale-parity nu strikt voor DE


## v0.29.0 — 2026-07-03

### Toegevoegd
- **desktop**: native mail-notificaties via poll-loop (punt 4b)
- **notify**: browser-notificaties bij nieuwe e-mail (web) + Messenger klik-pariteit
- **settings**: NAS-mapkeuze zichtbaar voor medewerkers (device vs shared split)

### Opgelost
- **desktop**: mail verslepen in Windows-app + map-verwijderen (web-pariteit)
- **desktop**: rfd niet op Android compileren → Android-build gefixt

### Verbeterd
- **frontend**: extract pure mail formatters to lib/mail-format.ts + tests
- **server**: mail.ts tests-first safety net — extract errors + address utils
- **server**: extract stats/uren handlers from index.ts to routes/stats.ts
- **server**: extract calendar/CalDAV stack from index.ts to routes/calendar.ts
- **server**: split messenger.ts providers into messenger/{types,nextcloud,telegram,teams}.ts
- **server**: extract NC Talk noise-filter to messenger/noise-filter.ts + tests
- **server**: split pure crypto primitives + dedup decrypt-to-string/json


## v0.28.10 — 2026-07-01 — desktop mail/Talk/NAS, e-mailinstellingen per account, "Sorteer in projectmap"

### Opgelost
- **Desktop mail: berichtenlijst faalde op BODYSTRUCTURE-parse** ([mail.rs](packages/desktop/src-tauri/src/mail.rs)): de list-FETCH vroeg BODYSTRUCTURE op; async-imap's imap-proto parser crasht (nom `TakeWhile1`) op complexe geneste structuren (doorgestuurde `message/rfc822` met inline-afbeeldingen) → de HELE folder-FETCH faalde met "E-mail kon niet worden geladen", terwijl de mappenlijst wél laadde. BODYSTRUCTURE uit de list-FETCH gehaald; `has_attachments` nu heuristisch uit de Content-Type-header (`multipart/mixed`). Bericht openen (`BODY.PEEK[]` + mail_parser) was al robuust.
- **Desktop mail: leeg bewerk-formulier** ([adapter/vault.ts](packages/desktop/src/adapter/vault.ts) / MailAccountSettings): de veldblokken hangen aan `addAuthType`, maar de kluis sloeg `authType` niet op → `undefined` → geen veld-render. `handleEdit` valt nu terug op `"manual"` als `authType` ontbreekt (repareert bestaande accounts).
- **Desktop mail: trage mappenlijst** ([mail.rs](packages/desktop/src-tauri/src/mail.rs)): `op_list_folders` deed een EXAMINE per (sub)map (100+ round-trips bij veel projectmappen) die de ene IMAP-verbinding bezet hield en mail-openen + body-prefill erachter blokkeerde. Nu alleen EXAMINE voor INBOX + special-use mappen; gewone submappen zonder telling.
- **Desktop mail: dubbelklik navigeerde de app weg** ([Webmail.tsx](packages/frontend/src/pages/Webmail.tsx)): dubbelklik deed `window.open("/mail/view")` voor een popout-tab, wat in de Tauri-webview de ene window wég-navigeert. Op desktop (`isDesktopApp`) opent dubbelklik nu in het leespaneel. Offline-cache-instelling verplaatst van de Webmail-mappenvoettekst naar Instellingen → Email accounts.
- **Desktop mail: inline-afbeeldingen werden niet getoond** ([mail.rs](packages/desktop/src-tauri/src/mail.rs)): de webview kan `<img src="cid:...">` / `"/api/..."` niet resolven (geen server; fetch-adapter onderschept alleen `fetch()`, geen element-loads). `op_get_message` + `op_get_bodies` herschrijven `cid:`-referenties in de HTML nu naar base64-`data:`-URL's uit de inline-bijlage-bytes.
- **Desktop mail: SMTP-versturen gefixt via poort 465** ([mail.rs](packages/desktop/src-tauri/src/mail.rs)).
- **Messenger: betrouwbaar scrollen naar het laatste bericht (web + desktop)** ([Messenger.tsx](packages/frontend/src/pages/Messenger.tsx)): de scroll-to-bottom gebruikte `behavior:"smooth"`; async inladende afbeeldingen groeiden de content-hoogte ná het starten van de animatie → landde te hoog. Nu instant (`behavior:"auto"`) + herhalingen (80/250/600ms) terwijl de hoogte settelt.
- **Projecten: "Open in Verkenner" en de map-knop openen dezelfde projectmap** ([Projects.tsx](packages/frontend/src/pages/Projects.tsx), ProjectDetail): de map-knop in de projectenlijst riep `/api/open-folder` aan (bestaat niet in de desktop-app → viel terug op "pad naar klembord"). `openFolder()` is nu desktop-bewust en opent de projectmap echt in Windows Verkenner via de native Rust-command (`/api/nas/open-folder` → `open_in_explorer`); ProjectDetail gebruikt dezelfde `getProjectFolderPath(...)` als de lijst. Web ongewijzigd.

### Verbeterd
- **Desktop mail: lichtere conversatie-load** ([mail.rs](packages/desktop/src-tauri/src/mail.rs)): `op_get_conversation` (~1118ms bij elke mail-open, gemeten met de nieuwe profiler) deed een volledige `op_list_folders` (144 mappen, ~440ms) alleen om Sent te vinden + een full-body fetch per thread-lid (~180ms elk, markeerde ook `\Seen`) + pageSize 200. Nu: vaste zoekmappen (huidige + INBOX + gangbare Sent-namen), alleen headers voor de thread-lijst (geen full-body, geen `\Seen`), pageSize 50. Plus een eenmalige `clearAllMailCache()` na de afbeelding-inbed-fix zodat gecachte bodies zonder ingebedde `cid:`-afbeeldingen opnieuw worden opgehaald.
- **Desktop mail: folderlijst-cache bij tab-switch** ([mail.rs](packages/desktop/src-tauri/src/mail.rs)): de `MailPool` cachet de folderlijst per account (30s TTL) — tab-switchen re-fetchte anders elke keer de volledige LIST en bezette de IMAP-verbinding. Geïnvalideerd op connectie-fouten + na map aanmaken/hernoemen.
- **Messenger/Talk: snellere gesprek-opening** ([Messenger.tsx](packages/frontend/src/pages/Messenger.tsx), [messenger.rs](packages/desktop/src-tauri/src/messenger.rs), [BackgroundSyncProvider.tsx](packages/frontend/src/lib/BackgroundSyncProvider.tsx)): de vaste 250ms-`setTimeout` bij aanklikken (dubbelklik-detectie) is weg → direct openen (op desktop opent dubbelklik in het paneel i.p.v. een dode `window.open`); `nc_resolve_uid` wordt gecached per `(base,user)` met 1u TTL (DashMap) i.p.v. een HTTP-round-trip vóór elke berichten-fetch; `pollMessengerOnce` racete met het openen van /messenger om dezelfde NC-verbinding → `/messenger`-guard toegevoegd (mirror van /webmail).
- **Talk-afbeeldingsvoorbeelden parallel + compacter** ([messenger.rs](packages/desktop/src-tauri/src/messenger.rs)): image-previews werden 1 sequentiële HTTP-fetch per plaatje binnen de berichten-loop → traag bij veel afbeeldingen. Nu parallel (`buffer_unordered`, bounded op 8) én 300×300 i.p.v. 600×600 (~4× minder data per plaatje).
- **Desktop mail: grote bijlages downloadden dubbel** ([mail.rs](packages/desktop/src-tauri/src/mail.rs)): `op_get_attachment` haalde eerst `op_get_message` op voor metadata en dan nog eens voor de bytes. Nu één fetch; metadata uit de geparste part. Fors sneller bij grote bijlagen.

### Toegevoegd
- **Webmail: "Sorteer in projectmap" (bulk)** — meerdere mails selecteren en per mail een bestaande projectmap laten voorstellen + verplaatsen via een reviewscherm ([Webmail.tsx](packages/frontend/src/pages/Webmail.tsx), [SortToProjectDialog.tsx](packages/frontend/src/components/SortToProjectDialog.tsx)). Inbox-mail → INBOX-submap, verzonden-mail → Sent-submap; matcht een project zonder bestaande map → "Map aanmaken: `[IN]/[OUT] {nr} {naam}`" + direct erin verplaatsen. De voorspeller combineert zes signalen (bestaande koppeling, e-mailthread, geleerd folder-profiel, projectnummer/klantreferentie, projectnaam-tokens, bijlagenamen), IDF-gewogen; afzender/opdrachtgever bewust géén los signaal. Alles client-side uit de warme mail-caches. Nieuw: `lib/project-mail-match.ts`, `lib/folder-profile-match.ts`, `lib/project-folder-resolve.ts`. _Live UI nog niet uitgebreid getest._
- **E-mailinstellingen per account** ([MailAccountSettings.tsx](packages/frontend/src/pages/MailAccountSettings.tsx)): alle e-mailinstellingen staan nu genest onder Instellingen → Email accounts, per account uitklapbaar — eigen **HTML-handtekening** (met base64-afbeeldingen, overschrijft de ERPNext-handtekening), **offline-cache-venster**, **Verzonden-map** en **Verwijderde-items-map**.
- **NAS-projectmappen: "Bladeren"-knop** (desktop) achter master- en doelmap → native mapkiezer ([NasSettingsSection.tsx](packages/frontend/src/components/NasSettingsSection.tsx), `pick_folder` via de rfd-crate).
- **Headless mail-profiler (dev-tool)** ([examples/mailprofile.rs](packages/desktop/src-tauri/examples/mailprofile.rs)): perf/diagnose-harness die `op_list_folders` / `op_list_messages` / `op_get_bodies` / `op_get_conversation` tegen een echte mailbox timet. Leest `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASS` / `MAIL_SECURE` / `MAIL_FOLDER` uit de omgeving. Maakte de bovenstaande conversatie-metingen mogelijk.


## v0.28.9 — 2026-07-01

### Opgelost
- **mail**: desktop mailaccount-wachtwoord werd leeg opgeslagen (creds-nesting)
- **desktop**: pinned-veld ontbrak in telegram Conversation-constructor (E0063)


## v0.28.8 — 2026-06-30 — desktop: kluis-onthoud + Talk-sortering + mailaccount zichtbaar

### Toegevoegd
- **Desktop: projectmappen op de NAS aanmaken** ([nas.rs](packages/desktop/src-tauri/src/nas.rs), [adapter/fetch.ts](packages/desktop/src/adapter/fetch.ts), [NasSettingsSection.tsx](packages/frontend/src/components/NasSettingsSection.tsx), [Projects.tsx](packages/frontend/src/pages/Projects.tsx)): knop **"Maak NAS-mappen aan"** op een project (alleen in de desktop-app) kopieert een **master-map** recursief (mappen + bestanden) naar een nieuwe projectmap op de NAS, hernoemd volgens een template. Instelbaar in Settings → Project-instellingen: master-pad, doel-root, mapnaam-template (`{nr} {project_name}`). Native `std::fs`-kopie via de Rust-backend (geen Nextcloud/browser-FSA). Bestaat de doelmap al → "map bestaat al", geen overschrijven. Plus een knop **"Open in Verkenner"** (`open_in_explorer`) die de projectmap op de doel-locatie direct in de Windows-bestandsbeheerder opent. Beide knoppen verborgen in de web-build.
- **Desktop: "onthoud op dit apparaat" (auto-unlock)** ([commands.rs](packages/desktop/src-tauri/src/commands.rs), [adapter/remember.ts](packages/desktop/src/adapter/remember.ts), [DesktopApp.tsx](packages/desktop/src/DesktopApp.tsx), [VaultUnlock.tsx](packages/desktop/src/pages/VaultUnlock.tsx)): opt-in vinkje op het ontgrendel-scherm → de app onthoudt je master-wachtwoord en opent bij elke start vanzelf, geen getyp meer. Bewust **app-eigen opslag** (een bestand in de app-datamap), **géén** Windows Credential Manager / Hello — geen Windows-account-afhankelijkheid (op verzoek). Afweging: een proces dat als dezelfde gebruiker draait kan het bestand lezen (in de opt-in-tekst vermeld). Wachtwoord wordt pas opgeslagen ná een succesvolle ontgrendeling; gewist bij wachtwoord-wijziging, kluis-reset en uitvinken. Op Android blijft de prompt-gated biometrie de weg. Plus `autocomplete="off"` op het kluisveld om de Edge-"wachtwoord opslaan"-prompt te onderdrukken.

### Opgelost
- **Desktop Talk: gesprekkenlijst-sortering** ([messenger.rs](packages/desktop/src-tauri/src/messenger.rs), [adapter/fetch.ts](packages/desktop/src/adapter/fetch.ts)): de lijst werd niet gesorteerd (NC-volgorde) en `Conversation` miste `pinned`. Nu `pinned` uit `r.isFavorite` + sortering vastgepind-eerst-dan-nieuwste, zoals het web. (Vastzetten zelf doe je in NextCloud Talk; Y-app spiegelt het — net als de webversie, die ook geen pin-knop heeft.)
- **Desktop: auto-geladen mailaccount nu zichtbaar in Settings → Email accounts** ([adapter/fetch.ts](packages/desktop/src/adapter/fetch.ts)): de uit-ERPNext-geladen mailbox (opgeslagen in de enkele `imap_*`-kluisvelden) werd niet getoond omdat de lijst alleen de `mail_accounts`-array las. De GET-route toont het account nu ook (label "automatisch uit ERPNext").

## v0.28.7 — 2026-06-30 — desktop Talk: datum in lijst + afbeelding-previews

### Opgelost
- **Desktop Talk: "Invalid Date" in de gesprekkenlijst** ([messenger.rs](packages/desktop/src-tauri/src/messenger.rs)): `nc_list_conversations` gaf `lastMessageTime` als unix-seconden-string terug; nu ISO-8601 uit `lastMessage.timestamp` (zoals het web). Berichten-binnenkant was al gefixt in v0.28.6; nu ook de lijst.
- **Desktop Talk: afbeeldingen werden niet getoond** ([messenger.rs](packages/desktop/src-tauri/src/messenger.rs)): op de desktop bereiken `<img src="/api/...">`-loads de fetch-adapter niet (die onderschept alleen `fetch()`), en er is geen img-proxy. Daardoor laadde de file-proxy-URL niet. Oplossing: `nc_get_messages` haalt de NC-preview nu server-side op (Basic-auth) en embedt 'm als **`data:`-URL** in het bericht — de frontend rendert `data:`-srcs rechtstreeks. Preview op ~600px, gebruikt voor inline + lightbox. (Niet-afbeeldingen houden de NC-link.)

## v0.28.6 — 2026-06-29 — desktop: NextCloud Talk gelijkgetrokken met web

### Opgelost
- **Desktop Talk: berichten renderden verkeerd** ([messenger.rs](packages/desktop/src-tauri/src/messenger.rs)): de Rust gaf een minimaal bericht terug (alleen id/text/sender/timestamp-als-string/naïeve isOwn) → "Invalid Date", geen afbeelding-previews, alle bubbels als "van iemand anders". `nc_get_messages` is nu gelijkgetrokken met de web-`ncGetMessages`:
  - **Tijdstempel** als ISO-8601 (was unix-seconden-als-string → "Invalid Date").
  - **Afbeelding/bestand-bijlages** uit `messageParameters` (file + rich-object/file), met `previewUrl` (NC `/core/preview`) voor afbeeldingen.
  - **`isOwn`** via een echte NC-uid-lookup (`/ocs/v1.php/cloud/user`) i.p.v. `actorId == email` (die altijd false was → verkeerde bubbels).
  - **Reacties** (incl. `userReacted`), **replies** (`parent`), **bewerkt** (`lastEditTimestamp`) en **verwijderd** (`comment_deleted`).
  - **Noise-filter**: reactie-events, "X bewerkte/verwijderde"-systeemrijen en emoji-only quoted-replies worden weggefilterd (zoals op web).

## v0.28.5 — 2026-06-29 — desktop: e-mailaccounts beheren + factuur-instellingen syncen

### Toegevoegd
- **Desktop: e-mailaccounts beheren zoals op web** ([adapter/fetch.ts](packages/desktop/src/adapter/fetch.ts), [adapter/vault.ts](packages/desktop/src/adapter/vault.ts)): Settings → Email accounts werkt nu op de desktop — toevoegen / lijst / bewerken / verwijderen (`GET/POST/PUT/DELETE /api/instances/:id/mail-accounts`), opgeslagen in de **Stronghold-kluis** i.p.v. de server-`mail_accounts`-tabel (die een Y-app-account vereist die de desktop niet heeft). De mail-routes zijn account-aware (`?account=<id>`); zónder vault-account valt mail terug op de bestaande ERPNext-auto-resolve. Lost de "Opslaan mislukt"-fout op. Wachtwoorden staan versleuteld in de kluis en worden nooit door de GET-lijst teruggegeven.

### Opgelost
- **Factuur-verzendinstellingen syncen niet naar de desktop** ([index.ts](packages/server/src/index.ts), [commands.rs](packages/desktop/src-tauri/src/commands.rs)): de key `invoice-email-defaults` (sjabloon / To-CC-BCC-defaults, in `instance_settings`) zat niet in `DESKTOP_CONFIG_KEYS`, dus de centrale config-sync sloeg 'm over. Toegevoegd aan beide lijsten (server + Rust) → wordt nu meegesynct.

## v0.28.4 — 2026-06-29 — desktop: instellingen-sync + messenger gefixt

### Opgelost
- **Desktop: server-instellingen kwamen niet binnen (shape-mismatch)** ([adapter/fetch.ts](packages/desktop/src/adapter/fetch.ts)): de adapter gaf voor `/api/instances/:id/settings/:key`, `/api/instances/:id/settings` en `/api/user-settings/:key` de **kale** waarde terug, terwijl de web-server `{ ok: true, value }` / `{ ok: true, settings }` teruggeeft en de frontend op `data.ok && data.value` checkt ([activityTypes.ts](packages/frontend/src/lib/activityTypes.ts)). Daardoor werden de gesynchroniseerde medewerker-/project-/activity-instellingen stil genegeerd. Nu in de juiste envelope gewikkeld. (NB: de config-sync moet ook gedraaid hebben tegen de — sinds v0.28.3 live — `/api/desktop-config`, en de instance-URL moet matchen; desktop herstarten triggert de sync opnieuw.)
- **Desktop: NextCloud Talk werkte niet** ([adapter/fetch.ts](packages/desktop/src/adapter/fetch.ts)): de messenger-routes waren tegen een oudere frontend-API gebouwd. Drie fouten: (1) NC-creds werden uit de (lege) Stronghold-kluis gelezen i.p.v. localStorage waar Settings → Berichten ze schrijft; (2) `/api/messenger/conversations` gaf een **kale array** terug terwijl de frontend `json.data` leest; (3) `/api/messenger/all-conversations` en `/api/messenger/messages?conversation=` ontbraken (de frontend gebruikt die, niet `/conversations/:id/messages`). Nieuw: `getNcCreds` (kluis → localStorage) + de routes `all-conversations` / `conversations` / `messages` / `send` / `mark-read` herbedraad naar het huidige contract met de `{ data }`-envelope. Conversaties laden, openen en versturen werken nu. **Nog niet op desktop**: reacties/bewerken/verwijderen/upload (geen Rust-commando's) — die acties geven een fout tot ze later toegevoegd worden.

## v0.28.3 — 2026-06-29 — desktop: mail werkt (config uit ERPNext) + offline body-cache

### Toegevoegd
- **Desktop: mailconfig uit ERPNext + lokale kluis** ([adapter/fetch.ts](packages/desktop/src/adapter/fetch.ts)): de desktop had geen pad om IMAP/SMTP-creds bij de mail-routes te krijgen — de Stronghold-kluis had de velden, maar niets vulde ze, en de mail-routes lazen een in-memory map die nergens werd gevuld → elke `/api/mail/*` gaf 400. Nieuw: vóór elke mail-route resolvet `ensureMailCredsPopulated` de creds in volgorde lokale kluis → ERPNext "Email Account" (alleen password-accounts; OAuth overgeslagen) en **persist** het resultaat in de kluis. Mail werkt nu automatisch — kluis ontgrendelen → Webmail open → creds uit ERPNext, daarna offline + na herstart uit de kluis, zonder handmatige IMAP-setup. Creds verlaten het apparaat nooit (geen Y-app-server betrokken).
- **Desktop: offline body-cache pre-fill + mailbadge** ([mail.rs](packages/desktop/src-tauri/src/mail.rs), [lib.rs](packages/desktop/src-tauri/src/lib.rs), [adapter/fetch.ts](packages/desktop/src/adapter/fetch.ts)): nieuwe `mail_get_bodies`-command + `GET /api/mail/bodies` (één gebatchte `BODY.PEEK[]` over read-only EXAMINE → markeert niets gelezen) zodat de "30 dagen cachen"-pre-fill nu óók op de desktop draait. Plus `GET /api/mail/unseen-summary` voor de sidebar-mailbadge. De body-, lijst- en bijlage-caches (IndexedDB) zijn daarmee op de desktop functioneel gelijk aan het web: recente mail opent direct en offline.

### Opgelost
- **Desktop: auto-config koos verkeerde auth voor password-accounts** ([adapter/fetch.ts](packages/desktop/src/adapter/fetch.ts)): `/api/mail/auto-config` ging de OAuth-tak in zodra de tenant één Microsoft Connected App had, óók voor een account met leeg `connected_app` (bv. `piet@3bm.co.nl` op plain IMAP) → `authMode:"password"` zónder bruikbaar wachtwoord → IMAP-login faalde. Nu gelijk aan de webserver (`mailAutoConfigInternal`): leeg `connected_app` = password-account; `smtpSecure` afgeleid uit `use_ssl_for_outgoing`/poort 465 i.p.v. hardcoded `false`.
- **Web: NextCloud Talk werkt niet in een geïnstalleerde app (Edge "app"/PWA)** ([messenger.ts](packages/server/src/messenger.ts), [BackgroundSyncProvider.tsx](packages/frontend/src/lib/BackgroundSyncProvider.tsx), server [index.ts](packages/server/src/index.ts)): post-Wave-0a bereikten de NC-creds de server-cache uitsluitend via de `subscribe-messenger`-push over de `/ws/events`-WebSocket. Die WS komt in een geïnstalleerde PWA niet betrouwbaar op → de cache bleef leeg → elke `/api/messenger/*` gaf "Missende NextCloud Talk credentials", terwijl de creds wél geconfigureerd waren (in een gewone tab werkte het wél). Nieuw `POST /api/messenger/subscribe` (`messengerSubscribe` → `setNcSession`) waarmee de frontend de creds óók via geauthenticeerde HTTP in de cache zet — zelfde sessiecookie + instance-header als de datacalls, dus de cache landt onder de juiste sleutel, ongeacht of de WS opkomt. Creds in de POST-body (niet de URL) → access-logs blijven schoon (Wave 0a-intentie intact).

## v0.28.2 — 2026-06-28 — desktop: werkgever-modules + centrale config van de server

### Opgelost
- **Desktop: missende werkgever-modules** ([adapter/fetch.ts](packages/desktop/src/adapter/fetch.ts)): de desktop haalde rollen op via `/api/auth/me`, maar die route bestond niet in de adapter → lege rollen → `getAccessiblePages([])` gaf alleen universele pagina's → alle werkgever-modules werden weggefilterd. Nieuwe `/api/auth/me`-handler levert de echte ERPNext-rollen (`get_logged_user` → `get_roles`), zoals het web.

### Toegevoegd
- **Desktop: centrale config van de server (offline-capabel)** ([commands.rs](packages/desktop/src-tauri/src/commands.rs), [erpnext.rs](packages/desktop/src-tauri/src/erpnext.rs), [DesktopApp.tsx](packages/desktop/src/DesktopApp.tsx), server [index.ts](packages/server/src/index.ts)): de desktop trekt nu de niet-geheime werkgever-config (medewerker-/project-instellingen + module-config) van de Y-app-server (`GET /api/desktop-config`, geverifieerd via de ERPNext-sessie) en cachet die lokaal → leest altijd lokaal, dus offline blijft werken. Synced keys: activity-types, employee-activity-types, employee-visible-modules, project-template-mapping, nas-attachment-template, nas-project-folders, enabled-extensions. (Mailaccounts blijven lokaal; mailconfig-uit-ERPNext volgt.)

## v0.28.1 — 2026-06-27 — desktop: settings-tabbladen + update-melding

### Opgelost
- **Desktop: instellingen-tabbladen werken weer** ([DesktopApp.tsx](packages/desktop/src/DesktopApp.tsx)): de desktop-shell miste de routes `/settings/:tab` (+ `/management-dashboard` en de extensions-routes `/x/:extId`). Daardoor sprong elke niet-"Algemeen"-tab terug naar het beginscherm en leek er geen werkgever/werknemer-onderscheid. Routes toegevoegd → alle tabbladen werken; werknemers zien hun 3 tabbladen (Algemeen, Integraties, Email accounts), werkgevers alles.

### Toegevoegd
- **Desktop: "nieuwe versie beschikbaar"-melding** ([UpdateBanner.tsx](packages/desktop/src/UpdateBanner.tsx)): bij het starten vergelijkt de app zijn versie met de laatst-uitgebrachte (publiek `GET /api/app-version`) en toont zo nodig een banner met een knop naar de Releases-pagina (waar ook oudere versies staan → rollback). Lichtgewicht: geen auto-install/signing.
- **Server: `GET /api/app-version`** ([index.ts](packages/server/src/index.ts), [build-server.mjs](packages/server/scripts/build-server.mjs)): publiek endpoint dat de gedeployde versie teruggeeft (in de bundel gebakken via esbuild-define). Whitelisted (geen auth/instance nodig).

## v0.28.0 — 2026-06-27 — bijlage-fixes, NAS-map per medewerker, Verzonden/Verwijderd instelbaar, agenda-uitnodigingen (iMIP), desktop-build-fix

OPMERKINGEN-batch, bovenop v0.26.0 (branch `feature/mail-body-cache-offline`). (v0.27.0 was een tussentijdse deploy-release; de inhoud daarvan staat in de GitHub Release.)

### Opgelost
- **Bijlage verzenden — "Maximum call stack size exceeded"** ([Webmail.tsx](packages/frontend/src/pages/Webmail.tsx), [MailView.tsx](packages/frontend/src/pages/MailView.tsx), [attachment-utils.ts](packages/frontend/src/lib/attachment-utils.ts)): zelf-bijgevoegde bestanden >~60 KB werden met `btoa(String.fromCharCode(...))` gecodeerd en crashten. Nieuwe gedeelde `arrayBufferToBase64()` codeert in chunks van 8192 bytes; alle vier base64-conversies lopen er nu doorheen.
- **Bijlage openen in losgekoppeld mailtabblad** ([MailView.tsx](packages/frontend/src/pages/MailView.tsx)): de popout opende bijlages via `window.open()` zonder de `X-Y-App-Instance` header → 401 "permissions weg". Nu via `fetch`→blob, zoals de hoofd-Webmail.
- **Desktop/Android-build hersteld** ([DesktopApp.tsx](packages/desktop/src/DesktopApp.tsx)): de build faalde sinds eind mei op een verwijderde `InstanceBar`-component (stale import na rename naar `InstanceTabBar` + Sidebar-viewMode). Verwijderd; de frontend-bundel bouwt weer.

### Toegevoegd
- **NAS-map instellen vanuit het opslaan-dialoog** ([SaveToNasDialog.tsx](packages/frontend/src/components/SaveToNasDialog.tsx)): medewerkers konden hun NAS-hoofdmap nergens instellen (zat in een werkgever-only tab). Nu een inline "NAS-map kiezen"-knop in het dialoog → iedereen kiest zelf + slaat op.
- **Speciale mappen instelbaar** ([Webmail.tsx](packages/frontend/src/pages/Webmail.tsx), [mail.ts](packages/server/src/mail.ts)): in de e-mailinstellingen kies je nu expliciet welke map "Verzonden" en welke "Verwijderd" is (dropdowns), cross-device gesynct. Lost dubbele mappen na een mailserver-migratie op; server honoreert de Verwijderd-override (`resolveTrashFolder`).
- **Agenda — echte uitnodigingen (iMIP)** ([ical-build.ts](packages/server/src/ical-build.ts), [mail.ts](packages/server/src/mail.ts), [index.ts](packages/server/src/index.ts), [Agenda.tsx](packages/frontend/src/pages/Agenda.tsx)): een afspraak met deelnemers verstuurt nu een echte `.ics`-uitnodiging (`METHOD:REQUEST`) die in de agenda van de ontvanger landt (accepteren/weigeren). Bewerken stuurt een update (`SEQUENCE+1`) → werkt bij in beide agenda's. Voor CalDAV-agenda's. iCal-builder uitgebreid met ORGANIZER/ATTENDEE/SEQUENCE/METHOD (13 unit-tests).
- **Contact-suggesties in het agenda-uitnodig-veld** ([RecipientInput.tsx](packages/frontend/src/components/RecipientInput.tsx), [contact-suggestions.ts](packages/frontend/src/lib/contact-suggestions.ts)): dezelfde suggesties + ranking als bij e-mail; logica gedeeld uit Webmail.

### Bekende beperkingen
- De iMIP-uitnodiging rijdt op het directe-SMTP-pad; accounts die via de ERPNext-relay versturen (bv. piet@3bm.co.nl) sturen de `.ics` nog niet mee — vervolgstap.
- NAS-projectmappen aanmaken (OPMERKINGEN-punt 3) is ontworpen + gepland (desktop-native), nog niet geïmplementeerd. Zie `docs/superpowers/specs|plans/2026-06-27-nas-project-folders*`.

## v0.27.0 — 2026-06-19

### Opgelost
- **mail**: run-guard tegen dubbele IMAP IDLE-loop (extra connect-churn)
- **mail**: begrens + lek-fix op IMAP-verbindingen (stopt oplopend aantal → fail2ban)
- **mail**: auth-fouten niet in retry-lus → stopt fail2ban-ban van mailserver

### Toegevoegd
- **mail**: harde rate-cap op IMAP-connects per host (bewaker tegen fail2ban)

## v0.26.0 — 2026-06-18 — reconnect-burst/IDLE-backoff, Verzonden-fix, project-in-onderwerp, messenger-403, CalDAV-schrijven

Alles bovenop v0.25.0 (branch `feature/mail-body-cache-offline`). De 2026-06-15/16/17-blokken + body-cache draaiden al op `y-app.impertio.app`; het 2026-06-18-blok hieronder is de inhoud van deze versie-bump (v0.26.0).

### 2026-06-18 — Reconnect-burst-preventie, Verzonden-map-fix, project-in-onderwerp, messenger-403, CalDAV-schrijven

**IMAP reconnect-burst-preventie + IDLE-backoff** ([mail.ts](packages/server/src/mail.ts), [imap-connect-gate.ts](packages/server/src/imap-connect-gate.ts)): een **per-host connect-gate** serialiseert + spreidt (≈1s) álle IMAP-connects (fetch, IDLE, test-verbinding) zodat een reconnect-storm (laptop wake / socket-drop, ook over meerdere accounts op dezelfde host) de per-account/IP-rate-limit van de mailserver niet meer tikt. Daarnaast respecteren de **IDLE-loop** én `backgroundRefresh` nu de gedeelde connect-backoff — voorheen bleef de IDLE-loop elke ~10s reconnecten tijdens de backoff, waardoor de throttle warm bleef en de mailbox vastliep tot een prod-restart. Bovenop de bestaande ECONNRESET-backoff (v0.25.0). Unit-tests: connect-gate (5), sent-folder (6), ICS-builder (7), vrije-naam-zoeker (7).

**Verzonden items — juiste map + zichtbare feedback** ([sent-folder.ts](packages/server/src/sent-folder.ts), [mail.ts](packages/server/src/mail.ts), [Webmail.tsx](packages/frontend/src/pages/Webmail.tsx)): naast de NL/EN-naam-match nu een expliciete **"Als Verzonden-map instellen"** (rechtermuis op een map) voor servers (bv. Stalwart) met zowel een `\Sent`-"Sent" als een gelokaliseerde "Verzonden items". `mailSend` await't de Sent-APPEND en geeft `sentSaved` + de gebruikte map terug → de UI toont een waarschuwing als de kopie niet kon worden opgeslagen i.p.v. stil te falen; bij "geen Sent-map gevonden" logt de server de volledige mappenlijst.

**Messenger — dubbel-plaatje 403 opgelost** ([messenger.ts](packages/server/src/messenger.ts), [nc-talk-upload-name.ts](packages/server/src/nc-talk-upload-name.ts)): dezelfde bestandsnaam nogmaals naar een gesprek sturen gaf `403 "Pad is al gedeeld met dit gesprek"` en overschreef bovendien het eerdere bestand. Nu wordt NC-stijl een vrije naam gezocht (PROPFIND-check → `naam (2).ext`) vóór de WebDAV-PUT.

**Project in mailonderwerp** ([Webmail.tsx](packages/frontend/src/pages/Webmail.tsx), [MailView.tsx](packages/frontend/src/pages/MailView.tsx)): bij het opstellen (en in de popout) een **"Project"-knop** naast het onderwerp die `"<id> projectnaam"` vóór het onderwerp plakt.

**Agenda — CalDAV-schrijven (default-agenda kiezen)** ([index.ts](packages/server/src/index.ts), [ical-build.ts](packages/server/src/ical-build.ts), [Agenda.tsx](packages/frontend/src/pages/Agenda.tsx)): nieuwe afspraken kunnen nu in een geauthenticeerde **CalDAV-agenda** landen i.p.v. alleen ERPNext. De aanmaak-modal heeft een **"Agenda"-dropdown** (ERPNext / schrijfbare CalDAV-agenda's) met een onthouden default (per device). Server `POST /api/calendar/event` bouwt een VEVENT (`.ics`) en PUT't naar de gediscoverde kalender-collectie (creds uit de vault, hergebruikt de discovery van het lees-pad). Bovenop de CalDAV-**lees**-ondersteuning (v0.25.0).

### 2026-06-16/17 — Featurebatch + ERPNext-mail-relay + request-storm/IMAP-throttle fix

**Uitgaande mail via ERPNext-relay (versturen werkt weer):** directe SMTP vanaf de Y-app-VPS is door de mailhost geblokkeerd (zie 2026-06-15). `mailSend` ([mail.ts](packages/server/src/mail.ts)) probeert nu eerst directe SMTP en valt bij een **connectie-fout** (`ECONNREFUSED`/`ETIMEDOUT`/`ESOCKET`/…) terug op ERPNext `frappe.core.doctype.communication.email.make` ([erpnext-client.ts](packages/server/src/erpnext-client.ts) `erpnextSendEmail` + `uploadPrivateFile` voor bijlages). ERPNext verstuurt vanaf z'n eigen (toegestane) IP. Alleen connectie-fouten vallen terug — `EAUTH`/recipient-fouten blijven echte fouten. De Sent-folder-APPEND blijft draaien. Bekende beperking: ERPNext-relay neemt threading-headers niet over (recipient ziet nieuwe thread-root). Live geverifieerd op prod (verzendtest → Verzonden-map).

**Taken:**
- **Completed-projecten selecteerbaar** bij taak-aanmaken (was `status === "Open"` → nu `status !== "Cancelled"`).
- **Billing type kiesbaar** bij taak-aanmaken (`custom_billing_type`, default "Timesheet based"; opties Fixed Price / Timesheet based / Milestone based / Progress based) in de hoofd-taakmodal én de project-zijbalk inline-add.
- **Taken uit een Project Template** nemen nu `description` + `custom_billing_type` over van de gelinkte Task-template (de template-rij linkt naar een Task-doc waar de echte config op staat).

**Webmail:**
- **Verzonden mail belandt nu in de Verzonden-map**: de Sent-folder-APPEND zocht alleen `\Sent`/Engelse namen; nieuwe helper `resolveSentFolder` matcht ook NL-namen ("Verzonden items"/"Verzonden"). Warnt in de log als geen Sent-map gevonden wordt.
- **Dode "Instellingen"-knop verborgen bij vault-accounts**: de footer-knop (+ mobiele varianten) opende `ImapSetup`, dat bij vault-accounts toch niet rendert → dode knop. Nu verborgen wanneer er vault-accounts zijn.

**Agenda — CalDAV-ondersteuning:** "Agenda toevoegen" ondersteunt nu geauthenticeerde CalDAV-collecties (bv. `mail.3bm.co.nl/dav/cal/`), niet alleen publieke iCal-feeds. Server (`/api/calendar/ical`) accepteert `?account=<vault-id>`, resolvet de mailaccount-creds uit de server-vault (geen wachtwoord in localStorage) en doet Basic-Auth CalDAV: current-user-principal/calendar-home-set probe → PROPFIND Depth:1 → calendar-query REPORT per kalender. Frontend: `CustomCalendar` krijgt optioneel `accountId`; de add-modal toont een mailaccount-keuze. Live geverifieerd tegen Stalwart (2119 events).

**ERPNext Print Format (live, niet via Y-app revertable):** `3BM Factuur+Smart Urenstaat` — de urenoverzicht-tabel toont nu de **taaknaam** (`Task.subject`) i.p.v. de task-id (`TASK-…`).

**Request-storm fix:** loops gemeten (45-min dev-sessie) op `/api/messenger/all-conversations` (2566×) en `/api/resource/Project` (1571×).
- NC Talk long-poll ([messenger-longpoll.ts](packages/server/src/messenger-longpoll.ts)): **min-interval van 2s** tussen iteraties + alleen broadcasten bij een écht nieuwer bericht-id. Voorheen spinde de loop bij een instant/fout NC-antwoord (structurele 502 via reverse-proxy, of echo) op volle snelheid → broadcast-storm → browser pollde `all-conversations` per broadcast.
- `BackgroundSyncProvider`: `pollMessengerOnce`/`pollMailOnce` max 1×/8s (module-niveau, dekt scheduled tick + WS-event-burst + focus + meerdere provider-instances). Raakt alleen de badge-tellingen, niet de berichten zelf (open conversatie/mail update direct via het ongethrottelde `y-app:*-changed`-event).
- `DataContext.refreshData` max 1×/60s na de eerste load (de `visibilitychange`/`focus`-listener refetchte alle org-data bij elke tab-focus → 143×) + context-value gememo'iseerd. Na fix geverifieerd: 2566→11, 1571→11, 119→0.

**IMAP-connectie-backoff + warmup-spacing:** de request-storm triggerde Stalwart's per-account IMAP-rate-limit op piet → `502 read ECONNRESET` op alle `/api/mail/*`. Klaarde niet vanzelf want prod's 30s-background-refresh bleef poken.
- `MailAccountCache.ensureConnected` ([mail.ts](packages/server/src/mail.ts)): exponentiële connectie-backoff (15s→30s→…→5min cap, reset bij een geslaagde verbinding). Binnen het venster gooit het snel een fout i.p.v. opnieuw te verbinden → de server-side rate-limit kan uitdoven i.p.v. warm te blijven.
- `warmupAllFolders` ([Webmail.tsx](packages/frontend/src/pages/Webmail.tsx)): 750ms spacing tussen batches (concurrency 2) zodat een grote mappenboom (156 mappen) geen IMAP-command-burst geeft. Herstel na deploy geverifieerd: mail terug + stabiel onder warmup (144/145 200, geen ECONNRESET).

### 2026-06-15 — Eigen IMAP-hosting i.p.v. ERPNext-OAuth (plain IMAP creds uit Y-app)

Aanleiding: een gebruiker stapte over van Office 365 (OAuth via ERPNext Connected App) naar plain IMAP (`mail.3bm.co.nl`, user+wachtwoord). Daarbij bleek de live mail-fetch de IMAP-config uit het Webmail-formulier (alleen localStorage) volledig te negeren en uitsluitend server-side te resolven — eerst uit de ERPNext "Email Account" doctype.

- **Plain-IMAP resolve op tenants mét een Connected App** ([mail.ts](packages/server/src/mail.ts) `mailAutoConfigInternal`): de password-tak was onbereikbaar zodra de ERPNext-site één Microsoft Connected App had (`connApps.length > 0`) → elk account viel in de OAuth-tak en kreeg `authMode:"password"` **zonder** wachtwoord → IMAP-login faalde. Nu valt een Email Account met léég `connected_app` altijd in de password-tak (`get_password`), ongeacht site-brede Connected Apps. Een account zonder connected_app is per definitie wachtwoord-geauthenticeerd.
- **Live mail-fetch leest IMAP-creds uit de Y-app vault** ([auth.ts](packages/server/src/auth.ts) + [mail.ts](packages/server/src/mail.ts) `getCredentials`): de frontend stuurde al `?account=<id>` op elke `/api/mail/*` call zodra een instance vault-accounts (`mail_accounts`) heeft, maar `getCredentials` negeerde dat. Nu exposeert `authMiddleware` `yAppUserId`+`yAppUserKey` op de request en leest `getCredentials` `?account=<id>` als hoogste prioriteit (decrypt het vault-account → host/poort/user/pass/secure + smtp). Plain-IMAP creds komen zo uit Y-app's eigen versleutelde opslag i.p.v. de ERPNext Email Account. ERPNext-resolve blijft de fallback voor accounts zonder vault-entry (OAuth/O365).
- **SMTP `smtpSecure` afgeleid uit `use_ssl_for_outgoing`** ([mail.ts](packages/server/src/mail.ts)): de ERPNext-resolve gaf `smtpSecure:false` hardcoded → versturen via een implicit-SSL host (poort 465) faalde. Nu `smtpSecure = use_ssl_for_outgoing || smtp_port===465`; O365 (587 STARTTLS) blijft `false`. De vault-tak gebruikt al de per-account `smtp_secure`-vlag.

**Bekend (geen Y-app-bug)**: versturen vanaf de Y-app-server naar `mail.3bm.co.nl` is geblokkeerd op infra-niveau — de mailhost weigert SMTP-submission vanaf het VPS-IP (465 → time-out, 587 → `ECONNREFUSED`), terwijl IMAP (993, ontvangen) wél mag. Fix is mailhost-/VPS-provider-kant: SMTP-submission vrijgeven voor het Y-app-server-IP, of een SMTP-relay configureren. Zie STATUS.md.

### Webmail — meerdere mailaccounts (vault-gebaseerde account-switcher)

Mailaccounts worden nu beheerd in de Y-app server-vault (Settings → **Email accounts**) i.p.v. losse localStorage-config; de oude **e-mail(IMAP)-sectie in de Settings "Algemeen"-tab is verwijderd** ([0018042]).
- **Multi-account switcher** ([Webmail.tsx](packages/frontend/src/pages/Webmail.tsx)): meerdere mailaccounts (incl. gedeelde postvakken) naast elkaar — **lezen, versturen én popout** per account, elk met de eigen creds uit de vault.
- **Één account-balk** met de primary altijd zichtbaar + dedup; **account-tabs sleepbaar** (Chrome-stijl) om de volgorde te wijzigen; het **standaard-geopende account volgt** die gesleepte volgorde.
- Bij account-wissel wordt de lopende folder-**warmup geannuleerd** en volgt de profiel-header het actieve account (geen warmup-contentie / verkeerde header meer).

### Opgelost — mail/messenger performance
- **Lege-map 500 ("Command failed") die de warmup blokkeerde**: `fetchMessages` deed een sequence-FETCH `1:1` ook wanneer de map leeg was (`exists=0`), omdat `Math.max(1, …)` altijd op 1 afrondt. Office365 antwoordt `NO` op een FETCH naar een niet-bestaand bericht in een lege mailbox → ImapFlow gooit "Command failed" → 500. Bij deze mailbox waren **14 mappen leeg** (Archive, Conversation History/Gesprekgeschiedenis + 12 projectsubmappen) die elk élke warmup-ronde 500'den, in `failedFolders` belandden en de body-cache-pre-fill incompleet lieten. Nu: bij `total===0` géén seq-FETCH maar een **UID SEARCH ALL** als check — leeg → meteen lege lijst (0 IMAP-FETCH); niet-leeg (O365 onderrapporteerde EXISTS) → pagina per UID ophalen. Nul perf-kosten op het normale pad. Geverifieerd: 134/134 mappen 200, body-cache vult door (223 bodies/26 mappen), lege map opent leeg in de UI zonder error-toast.
- **Mail conversation-storm**: `/api/mail/conversation` gebruikte pageSize=100 terwijl warmup/normale loads op pageSize=50 cachen → cache-key-mismatch → élke mail-open deed ~134 koude IMAP-folderfetches, serieel op de per-account `AsyncQueue` → opvolgende klikken bleven hangen. Nu pageSize=50 (cache-hit) + alleen al-gecachte INBOX-submappen scannen (`hasFreshFolderCache`).
- **Prioriteit-queue**: `AsyncQueue` is nu priority-aware; achtergrondwerk (folder-warmup, conversation-header-scans, body-prefill) draait op lagere prioriteit (`background`-flag → `?bg=1`) zodat een interactieve mail-open/folder-wissel altijd vóór gaat.
- **Warmup**: slaat mappen die IMAP "Command failed" geven 15 min over (`failedFolders`), herstart niet meer bij elke folder-badge-update (bqRef + warmedKeyRef), en pauzeert terwijl de gebruiker klikt (activity-aware, concurrency 5→2).
- **Messenger long-poll storm** ("berichten blijft laden"): NC Talk emit reactie-/system-events met id > laatste zichtbare bericht; de noise-filter stript ze → lege 200 → client-cursor kon niet vooruit → tight re-poll. Server geeft nu `lastGivenId` (max raw id incl. gefilterde rijen) terug zodat de cursor doorschuift; + min 1s spacing client-side.
- **Race-guard mail openen**: snel achter elkaar mails aanklikken liet soms een eerder-aangeklikte mail zien (laat-binnenkomend resultaat overschreef de selectie). `selectedUidRef` verwerpt verouderde resultaten. + leespaneel toont nu direct een laad-spinner i.p.v. de oude mail.
- **Gedeelde mailbox laadt niet (500/502 op folders/messages)**: een shared mailbox toevoegen slaagde (`mailTestShared` verbindt via het primary-account z'n gedelegeerde token), maar daarna gaven `/api/mail/folders` en `/api/mail/messages` 500/502 (`Unexpected close` / `Failed to receive greeting`). Oorzaak: wanneer de gedeelde mailbox een **eigen** ERPNext Email Account heeft met een O365-token dat géén IMAP-sessie kan openen (typisch een *unlicensed* shared mailbox), resolveerde `getCredentials` dat eigen account "direct" en gebruikte het kapotte token — vóórdat het delegatie-pad bereikt werd. Nu: bij een shared-mailbox-request (`primaryEmail` ≠ `email`) wordt **eerst** de primary-delegatie geprobeerd (`{...primary, user: shared}`), met fallback naar de directe resolve als de primary niet resolvet. Niet-shared requests blijven ongewijzigd. Geverifieerd met lokale full-stack + Playwright: folders/messages/bodies + submappen nu allemaal 200, IDLE op de shared mailbox werkt.
- **Postvak-switch laadt niet meer blanco (instant uit cache)**: wisselen tussen postvakken (primary ↔ gedeelde mailbox) deed `setMessages([])` + `setFolders([])` en herlaadde met een spinner, ook als alles al gecached was. Nu toont `switchAccount` optimistisch de gecachte folder-lijst (`webmail_folders_${instId}_${acct}`) én de gecachte INBOX (in-memory acct-prefixed → IndexedDB → localStorage) van het doel-account meteen; de reload ververst op de achtergrond. De lijst-spinner toont sowieso alleen bij een lege lijst, dus gecachte content onderdrukt 'm. Race-guard via `activeAcctRef` voor snel wisselen. Geverifieerd: switch naar gedeelde mailbox toont direct de eigen mappen + INBOX, geen blank/spinner.
- **PDF-bijlage opent fullscreen in een nieuw tabblad**: een PDF-bijlage openen gaat niet meer via de smalle inline-modal maar opent direct in een nieuw browser-tabblad → volledige native viewer over het hele scherm met alle tools (roteren, zoom, zoeken, print, download). Het tabblad wordt synchroon binnen de klik geopend (anders blokkeert de popup-blocker na de async fetch) en daarna naar de gecachte blob-URL genavigeerd (instant, want gecached; blob pas na 60 s vrijgegeven zodat het tabblad niet breekt). Afbeeldingen en tekst blijven wél inline. Gemeten: heropenen uit cache ~135 ms vs ~2,3 s koud via de server.
- **Lazy bijlage-cache (offline / instant heropenen)**: een bijlage wordt lokaal gecached zodra je 'm opent of downloadt — niet proactief. Tweede keer openen = instant en offline (geserveerd uit IndexedDB, 0 server-fetch). Valt uit het cache via hetzelfde rollende venster als de bodies (na X dagen gewist), en wordt bij uitloggen volledig gewist (`clearAllMailCache`). IndexedDB `y-app-mail` v4, store `message_attachments` (Blobs, key `instance⌀acct⌀folder⌀uid⌀index`), helpers `readAttachment`/`persistAttachment`/`evictAttachmentsOlderThan`/`sizeOfCachedAttachments` in [mail-cache-db.ts](packages/frontend/src/lib/mail-cache-db.ts). Read-path via `fetchAttachmentBlob` (cache → server → persist) in `openAttachment`/`downloadAttachment`. Vraagt eenmalig `navigator.storage.persist()` aan zodat de browser de cache niet onder schijfdruk wist (Outlook-OST-achtig). De opslag-indicator in de instellingen telt de bijlages mee ("incl. X aan N bijlages"). Geverifieerd: 1e open = 1 fetch + opslag, na reload = 0 fetches (cache-hit, preview uit blob).
- **Mail-cache-instellingen tonen huidige opslaggrootte**: het cache-blok in de Webmail e-mailinstellingen (ImapSetup) toont nu "Nu opgeslagen: X MB · N berichten" voor de lokale body-cache (primary mailbox). Nieuwe helper `sizeOfCachedBodies` in [mail-cache-db.ts](packages/frontend/src/lib/mail-cache-db.ts) sommeert de byte-grootte van de gecachte bodies; ververst bij wijziging van het cache-venster.
- **Mail-mappen: slepen naar favoriete/gezochte mappen werkt nu** + rechtermuis-menu uitgebreid. (1) Een mail naar een map bovenaan onder "Favorieten" slepen — of naar een map in de folder-zoekresultaten — deed niets: `renderFavoriteRow` miste de drag-handlers die alleen op de boom-rijen (`renderNode`) zaten. Nu hebben favoriet- én zoekrijen dezelfde `onDragOver`/`onDrop` + drop-highlight. (2) Het folder-context-menu (rechtermuis) heeft nu naast Nieuwe map / Hernoemen ook **favoriet toggelen** en **Map verwijderen** (rood, met bevestiging; nieuw endpoint `POST /api/mail/delete-folder` → `client.mailboxDelete`, server-side guard tegen INBOX en system-mappen op `specialUse`). Favorieten worden cross-device op de server bewaard (`instance_settings` key `mail-favorite-folders`).
- **Conversatie: één gecombineerde lijst** i.p.v. twee. De aparte amber "Vervolgacties"-zone (latere replies/forwards) is verwijderd; die mails staan toch al in de chronologische "Alle berichten in deze conversatie"-lijst eronder. Minder visuele ruis.
- **Conversatie-rij toont nu tijd + richting + tegenpartij**: elke thread-rij toont datum **én tijdstip** (bv. "29 mei 09:41"), een **richting-icoon** (Inkomend = Inbox / Uitgaand = Send), en bij uitgaande mail de **ontvanger** i.p.v. de afzender (je zag eerst "Piet Mol" = jezelf bij eigen verzonden mail; nu bv. "Maryam Hosseini"). Richting = afzender is het actieve mailbox-adres óf de mail staat in een Verzonden/Sent-map.
- **Conversatie-weergave 500 + miste verzonden mails**: `/api/mail/conversation` gaf op O365 een 500 (`Command failed`) en toonde geen eerder verzonden/cross-folder mails. Oorzaak: `fetchHeadersBatch` vroeg de References-header op via `bodyParts: ["HEADER.FIELDS (REFERENCES)"]`, wat ImapFlow serialiseert als `BODY.PEEK["HEADER.FIELDS (REFERENCES)"]` (sectie tússen quotes) — O365 weigert dat met `BAD Command Argument Error`. De bron-header-fetch is niet per-folder afgevangen → 500; de per-folder header-fetches faalden óók → geen References-based threading → terugval op subject-only (verzonden mails in andere mappen werden gemist). Nu: ImapFlow's `headers: ["references"]`-optie, die het correcte ongequote `BODY.PEEK[HEADER.FIELDS (REFERENCES)]` genereert. Geverifieerd: conversation geeft 200 met de volledige thread inclusief de mail uit "Verzonden items".

### Toegevoegd — lokale mail body-cache (offline / instant openen)
- Volledige mailinhoud van de laatste N dagen (instelbaar, default 30) van alle echte mappen wordt lokaal in **IndexedDB** opgeslagen (`y-app-mail` v2, store `message_bodies`). Recente mails — ook in subfolders — openen daarna **instant en offline**, zonder server/IMAP-roundtrip.
- Server: `GET /api/mail/bodies` + `MailAccountCache.fetchBodiesBatch` (gepipelinede BODY.PEEK[], markeert niets als gelezen, stream-through).
- Frontend: read-path in `openMessage` (IDB-hit → instant; ongelezen mail krijgt alsnog fire-and-forget mark-read), achtergrond pre-fill (`lib/mail-body-prefill.ts`) die lijsten uit IndexedDB leest, drukke mappen dieper ophaalt (tot 1000/map) voor volledige venster-dekking, en na de lijst-warmup draait (geen IMAP-contentie). Rollende eviction van bodies ouder dan het venster.
- Instelling **per apparaat** (niet gesynct) in het Webmail e-mailinstellingen-blok (ImapSetup): Uit / 30 / 90 / Alles + schuif 7–365 dagen.
- Eén gecombineerde indicator in de webmail-balk: "30d cachen… X%" → "30d gecached" (✓), aantal in de tooltip. Quota-vol → waarschuwing.
- **Blijft staan bij reload**: F5 binnen 12u na een volledige vulling slaat de pre-fill over (0 fetches) — de cache blijft gewoon staan. Tussendoor houdt een **delta-sync** (op het `mail-changed` push-event) alleen nieuwe mail bij, met een eigen "bijwerken…"-melding.

### Hardening (cache/data/webmail expert-review — 15 punten)
- **Correctheid**: staleness-guard (gecachte body alleen serveren als onderwerp+datum matchen → geen verkeerde mail/bijlage bij UID-hergebruik); body-cache wordt nu gewist bij verwijderen/verplaatsen (`deleteMailBody`/`deleteFolderBodies`); delta-sync reconcilieert ook verwijderingen.
- **Opslag**: NUL-separator i.p.v. "::" in body-keys (IndexedDB v3); eviction pakt ook entries met ongeldige datum; reclaim-on-quota (oudste 300 wissen + retry) i.p.v. permanent vol; IndexedDB `onblocked`/`onversionchange` tegen multi-tab-hang.
- **Privacy**: `clearAllMailCache()` bij uitloggen/sessie-einde wist de lokale mail-cache.
- **UX**: gecombineerde 30d-chip toont nu ook "bijwerken…" (delta) en "opslag vol" (quota); mark-read POSTs gecoalesceerd; pre-fill skipt Trash/Junk/Drafts op `specialUse`; MailView-popout gebruikt nu ook de body-cache (instant/offline); in-memory cache genamespaced per instance+acct.

## v0.25.0 — 2026-05-28 — Mail-list IndexedDB-cache, threading, messenger edit/delete, NAS-template sync, InvoiceModal overhaul

Feature-branch `feature/email-attachments-to-nas`, 19 commits boven `v0.24.0` + uncommitted threading-, messenger- en InvoiceModal-werkblokken. Manifest-bump op 2026-05-28; nog niet gepusht / niet gedeployed. Wacht op Piet's deploy-go.

**Bekend issue**: edit & save van bestaande credit-nota drafts faalt met `frappe.exceptions.ValidationError: Invoice Total Incl VAT must be >= 0.0` uit ERPNext's `accounts_controller.py:263`. Standaard ERPNext skipt deze check bij `is_return=1`, maar deze 3BM-tenant doet dat niet. Fix vereist patch in `apps/threebm/threebm/overrides/sales_invoice_override.py` — out of scope voor Y-app. Aanmaken (POST) van credit-nota's werkt wél. Zie [memory `erpnext-credit-nota-validate`].

### Toegevoegd

- **Messenger: bewerken & verwijderen van eigen berichten** (lokaal, niet gecommit). Nieuwe NC Talk helpers `ncEditMessage` (PUT `/ocs/v2.php/apps/spreed/api/v1/chat/{token}/{messageId}`) + `ncDeleteMessage` (DELETE idem) in [packages/server/src/messenger.ts](packages/server/src/messenger.ts). Express handlers `messengerEditMessage` + `messengerDeleteMessage` gemodelleerd naar `messengerReact` met dezelfde creds-resolution + platform-switch (alleen `nextcloud-talk` ondersteund). Nieuwe routes `POST /api/messenger/edit` + `POST /api/messenger/delete` in [packages/server/src/index.ts](packages/server/src/index.ts). Frontend Messenger.tsx + MessengerView.tsx (identieke wijzigingen — bewust parallel, geen extractie): hover-strip per eigen bericht uitgebreid met 3-dot menu (⋮) naast 👍 + reply, opent dropdown met "Bewerken" / "Verwijderen". `editingMessage` state activeert edit-banner (amber) onder reply-banner, vult textarea, send-knop wordt update i.p.v. nieuwe message. `handleDelete` met `window.confirm` + optimistic markering naar `messageType: "comment_deleted"`. Verwijderde berichten renderen als grijs-cursief "Bericht verwijderd" placeholder op de bestaande positie (behoud message-id zodat replies-naar-verwijderd-bericht blijven werken). Bewerkte berichten krijgen "(bewerkt)" naast tijdstempel via NC Talk's `lastEditTimestamp` veld. Server geeft `lastEditTimestamp` + `deleted` nu door in message output. NL+EN i18n: 10 nieuwe `messenger.*` keys (edit, delete, editing, cancel_edit, edited, deleted_placeholder, confirm_delete, edit_failed, delete_failed, more_actions).
- **Messenger: 👍-regressie fix + system-noise filter** (lokaal, niet gecommit). De filter in `ncGetMessages` vangt nu ook (1) **emoji-only quoted replies**: iemand stuurt letterlijk "👍" met `replyTo` vanuit een NC Talk client → `messageType="comment"` met `parent`-veld, geen reaction-event, dus het bestaande filter (`messageType !== "reaction"`) miste het volledig. Nieuwe helper `isEmojiOnly(text)` met regex `/^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Emoji_Component}‍️\s]{1,8}$/u` — combinatie met `m.parent` aanwezig is de "fake reactie" die we onderdrukken. (2) **system-message "X verwijderde een bericht"**: `messageType="system" && systemMessage="message_deleted"` toegevoegd aan dezelfde filter-clausule die al `message_edited` had — anders ruis-rijen onder élk verwijderd bericht. Defense-in-depth: identieke client-side `isEmojiOnlyReply` filter in Messenger.tsx + MessengerView.tsx voor oude browser-cache-entries die de server-filter al passeerden. Git-archeologie: filter onvolledig sinds commit `3ee2e0c` (20 mei) — geheugen "we hebben het ooit werkend gehad" was strikt fout, de fix was nooit compleet.
- **Messenger: NC-uid resolver voor robuuste isOwn-check** (lokaal, niet gecommit). NC Talk's `actorId` op chat-messages is de echte NC-uid (b.v. `"piet.mol"`) maar de geconfigureerde `user` is vaak een email (`"piet@3bm.co.nl"`) — directe vergelijking faalde altijd. Nieuwe helper `ncResolveUid(ncUrl, user, pass)` haalt de echte uid op via `GET /ocs/v1.php/cloud/user` en cached die per `(ncUrl, user)` met 1u TTL in `ncUidCache`. `ncGetMessages` resolved `myUid` eenmalig per call en vergelijkt actorId daartegen. Zonder deze fix: geen 3-dot menu zichtbaar omdat alle berichten als !isOwn werden gerenderd (witte bubble, sender-naam getoond bij eigen messages).
- **Conversation threading: header-based + 2-zone view boven mail-body** (lokaal, niet gecommit). Server `mailGetConversation` ([packages/server/src/mail.ts](packages/server/src/mail.ts)) volledig herschreven: subject-string-match → RFC 5322 References-graph met transitive closure. Endpoint accepteert nu `folder`+`uid` (subject als fallback voor backward-compat). Zoekruimte: current + Sent + INBOX + álle INBOX-subfolders (skip Trash/Spam), pageSize 100 per folder. Per candidate een **header-only IMAP FETCH** (`envelope + bodyParts['HEADER.FIELDS (REFERENCES)']`) — geen body, geen MIME-parse, geen `\Seen`-STORE-side-effect. Closure-loop: bij elke hit zijn `messageId` aan `threadKeys` toevoegen tot er geen nieuwe matches meer komen. Resultaat per item krijgt een `relation` (`current` | `ancestor` | `descendant`). 5-min in-memory cache op `mid:<messageId>` (cap 100 entries). Fallback naar pure subject-match wanneer de server geen betrouwbare Message-IDs levert. Nieuwe publieke methoden op `MailAccountCache`: `getCachedFullMessage`, `fetchHeadersBatch`, `getAllFolderPaths`, `getCachedConversation`, `setCachedConversation`. Nieuwe types: `HeaderInfo`, `ConversationResult`, `ThreadRelation`. Frontend ([packages/frontend/src/pages/Webmail.tsx](packages/frontend/src/pages/Webmail.tsx)): de oude `ConversationThread`-component (rendert ónder iframe — bij langere mails buiten beeld) is vervangen door **`ThreadAboveMail`** dat **boven** de iframe rendert in twee zones — Zone A is een amber blokje "Vervolgacties" met alleen latere replies/forwards (`relation==="descendant"`), Zone B toont alle thread-mails chronologisch als klikbare blokjes met de huidige gehighlight (violet ring + label "HUIDIG"). Click op een ander blokje switcht waar nodig de folder en opent die mail. `loadConversation` stuurt nu `folder`+`uid` (i.p.v. `subject`+`messageId`). `MailMessageFull` kreeg `relation?` en `folder?` velden. Nieuwe i18n keys: `webmail.thread_all_messages`, `webmail.thread_follow_ups`, `webmail.thread_current_label`, `webmail.thread_forwarded`, `webmail.thread_replied` (NL + EN + DE).
- **Mail-list IndexedDB-cache** (Wave 1, `12b5ef2`+6 commits) — maillijst-headers verhuisd van localStorage (LRU 50) naar IndexedDB (alle ~70 folders, geen LRU). Achtergrond-warmup bij Webmail-mount fetcht alle folders 5-parallel (~30 s). Dual-write (IDB + localStorage) voor rollback-window. Geen flicker meer bij eerste klik op folder, ongeacht of die eerder geopend was. Server `CACHE_LIFETIME` verhoogd van 24u → 7 dagen zodat werkweek-vakantie geen warmup-trigger geeft.
- **Email-project-link server-sync** (`991b793`) — koppeling van mail aan ERPNext-project verhuisd van pure localStorage naar `instance_settings` (SQLite) via write-through cache. Cross-device, cross-browser zichtbaar binnen Y-app. `hydrateEmailProjectLinks()` bij mount. Plus folder-auto-link runtime: mail in een `[IN] 3001 …` folder krijgt automatisch de project-chip (niet persisted; folder-naam blijft bron van waarheid).
- **NAS-template server-sync** — `correspondenceSubdir` + `folderTemplate` verhuisd van pure localStorage naar `instance_settings` key `nas-attachment-template` via write-through cache. Patroon kopie van email-project-links: `saveSharedNasConfig` + `hydrateNasConfig` in `lib/nasConfig.ts`. Companies-map (per-device FSA-handles) blijft localStorage / IndexedDB. NasSettingsSection en SaveToNasDialog hydrateren bij open zodat een template-wijziging op device A direct zichtbaar is op device B.
- **`MessageAttachments` shared component** (`436ceac`) — één component voor Webmail's ReadingPane én MailView popout. Beide views hebben identiek gedrag: NAS-knop, NextCloud per-item, NextCloud-Alles, Alles-downloaden, verborgen-bijlages-toggle. Lokale `isInlineAttachment`-duplicaten samengevoegd in `lib/attachment-utils.ts`.
- **Folder-search** (`a49f797`) — `<input type="search">` bovenaan FolderTree. Bij actieve zoekterm: platte lijst i.p.v. tree-recursie (beter scanbaar bij 70+ folders).
- **Favorieten + hidden folders cross-device** (`a49f797`) — `setFavoriteFolders` / `setHiddenFolders` pushen naar `/api/instances/:id/settings/mail-{favorite,hidden}-folders`. Hydrate bij Webmail-mount.
- **Bulk-move dropdown met search** (`a49f797`) — multi-select Verplaatsen toont nu een zoek-input + folder-lijst. Click-outside via ref-pattern (was eerder window-click → toggle bubblede meteen weer dicht).
- **Race-guard bij snel folder-switchen** (`932be79`) — `activeFolderRef` voorkomt dat een laat-aankomend fetch-result van folder A de UI overschrijft nadat de user al naar B is.
- **"Shared (ERP)" stub-icoontje** (`895dd6b`) — naast folder-naam in mail-lijst-header, alleen bij folders die matchen aan een ERPNext-project. Klik → toast met uitleg over toekomstige Communication-integratie. Houdt het idee zichtbaar zonder implementatie.
- **MailView popout: NAS-dialog + paperclip-palliatief** (`356dee4`) — popout krijgt feature-pariteit met inline preview voor bijlages.
- **InvoiceModal: complete overhaul van Nieuwe-factuur + draft-edit flow** (lokaal, niet gecommit, 2026-05-28). Negen iteraties op het modaal. Volledig verslag in [SESSION_LOG.md § 2026-05-28](SESSION_LOG.md#2026-05-28). Highlights:
  - **Inline `ProjectPicker`** als nieuwe inline-component in [InvoiceModal.tsx](packages/frontend/src/components/InvoiceModal.tsx). Filter op `customer = doc.customer` met "Toon alle"-toggle, amber warning bij mismatch, toont `{name} · {project_name}` (projectnummer + titel). `fetchList("Project", { filters: [["customer","=",customer]], or_filters: [["project_name","like",%q%], ["name","like",%q%]] })`.
  - **Factuurregel layout omgedraaid**: op-factuur omschrijving (`item_name`) als prominent input met zichtbare border bovenaan; artikel-code (`item_code`) klein-grijs eronder met `↻ wissel`-affordance die inline `ItemSearchSelect` popover opent. Behoudt user-typed item_name als die afwijkt van origineel. Per-input `key={\`qty-${it.qty}-${it.item_code}\`}` zorgt dat uncontrolled inputs remounten bij swap met de juiste defaultValue.
  - **Live `effectiveItem()` helper**: leest qty/rate uit `editBuf`, berekent `amount = qty × rate` per render. Bedrag-cel + subtotaal + totaal updaten per key-stroke. Fix voor "tarief 85, aantal 2, maar bedrag €0,00".
  - **Item Price fallback voor tarief** in [ItemSearchSelect.tsx](packages/frontend/src/components/ItemSearchSelect.tsx): na items-search batch-fetch op `Item Price` (selling=1) voor alle item_codes. Per item kies match op `uom = stock_uom`, anders eerste. `standard_rate` winnt als die >0. Lost 3BM Items zonder standard_rate op (prijs leeft in Item Price + Standard Selling).
  - **Creditnota-toggle** (Factuur/Creditnota tabs, amber active state voor credit). Werkt in new mode én draft mode via `stageHeader({ is_return: 0|1 })`. Bij creditnota: `is_return: 1` in `createDocument`-payload + Print Format swap't automatisch naar credit-tekst.
  - **Sales Taxes and Charges Template** dropdown gefilterd op `company`, auto-default zoekt regex `/21%|VAT 21|btw.*21/i` (matched "Netherlands VAT 21%").
  - **Payment Terms Template** dropdown, auto-default `/21\s*(d|dagen)/i`. ERPNext berekent server-side de `due_date` uit `posting_date + credit_days` van de template. Vervaldatum-label hernoemd naar **Betaaldatum** (editable date-input in draft, bypassed default als gebruiker handmatig overschrijft).
  - **Bedrijf select dropdown** via `useCompanies()` uit DataContext. Confirm-warning bij wisselen op draft ("ERPNext gebruikt andere naming-series → factuurnummer wordt opnieuw uitgegeven").
  - **Contact** email input editable in draft (was alleen read-only div als contact_email aanwezig).
  - **Stage-and-save flow**: `stageHeader(patch)` schrijft naar `pendingHeaderUpdates: Partial<SalesInvoiceDoc>` + lokaal in `doc` (niet meer direct naar ERPNext). `editBuf` houdt rij-edits bij. Globale **"Opslaan"** knop verschijnt bij `anyDirty`; verbergt Akkoord/Inboeken-knoppen tot saved. `saveDraft()` persist alles in één `updateDocument(currentName, { ...pendingHeaderUpdates, items: localItems.map(apply editBuf) })`. Per-rij save-button verwijderd; trash-button blijft (verwijderingen worden bij Opslaan server-side weggeschreven). `ItemSearchSelect` nu ook in draft mode (rijen toevoegen aan bestaande draft).
  - **PDF-preview als herbruikbare module**: [InvoicePreview.tsx](packages/frontend/src/components/InvoicePreview.tsx) (nieuw, ~240 regels). Format-discovery + HTML-fetch + PDF-blob-fetch geconsolideerd uit InvoiceModal. Placeholder voor unsaved docs. Props: `doctype`, `name`, `iframeHeight`, `onFormatChange`, `refreshToken`.
  - **`fetchPrintPreviewHtml` doctype-generic** in [lib/invoiceEmail.ts](packages/frontend/src/lib/invoiceEmail.ts): eerste arg = doctype (was hardcoded "Sales Invoice"). [SendInvoiceModal.tsx](packages/frontend/src/components/SendInvoiceModal.tsx) call-site update. Eén bron-van-waarheid voor preview-HTML generation (incl. asset-rewriting voor logo's/letterhead via `/api/erpnext-asset` proxy).
  - **3-laags cache-busting voor PDF refresh na save**: `refreshToken={\`${doc.modified}#${saveCounter}\`}` prop op InvoicePreview triggert React re-fetch. `cacheBuster` param in `fetchPrintPreviewHtml` zet `_t=` query op alle endpoints. `cache: "no-store"` op de fetch calls. Combinatie nodig — `doc.modified` alleen is unreliable (ERPNext kan dezelfde timestamp teruggeven binnen 1s; response-cache kan stale value retourneren).
  - **Friendly error-banner**: `summarizeErpnextError(raw)` parsed JSON-array Python traceback, vindt laatste `Error:` / `Exception:` regel, stript module-pad. Toont "Opslaan mislukt — ValidationError: ..." + `<details>` toggle voor volledige stack. Body-render gefixt zodat error niet meer de hele form verbergt (banner verschijnt erboven).
  - **i18n**: 7 nieuwe `invoice_modal.project_*` keys in nl.json + en.json (placeholder, other_customer warning, show_all, filter_by_customer, showing_all, filtered_by_customer, none_found).
- **ERPNext Print Format `3BM Factuur+Smart Urenstaat` — credit-conditionals** (live, niet revertable via Y-app). Via `mcp__erpnext__erpnext_update_doc` gepatched met 5+1 conditional Jinja-blokken op `doc.is_return`. Credit-bewoording 1-op-1 uit bestaande `3BM Credit Nieuw` template overgenomen. Patches:
  - Hoofdtitel pagina 1: `FACTUUR` ↔ `CREDIT-FACTUUR`
  - Titel urenoverzicht-pagina(s): idem + `-URENOVERZICHT`
  - Label info-blok: `Factuurnummer:` ↔ `Credit-factuurnummer:`
  - Label urenoverzicht: `Factuur :` ↔ `Credit-factuur :`
  - Intro-zin pagina 1: "Hierbij brengen wij de kosten in rekening..." ↔ "Bijgaand sturen we u een credit-nota..."
  - Betaal-noot: "Gelieve het bedrag binnen 21 dagen over te maken..." ↔ "We zullen dit bedrag overmaken op uw rekening ofwel verrekenen met een openstaande post."

### Verbeterd

- **Forward 413**: route-specifieke Express body-parser 50MB voor `/api/mail/send` + `vps-setup.sh` nginx-template `client_max_body_size 50m` + deploy-workflow idempotente nginx-fix-step + frontend pre-send size-check (commit `0882e01`).
- **NAS-dialog UX-pass** (`991b793`): geen status-filter meer (Completed/Cancelled projecten ook selecteerbaar), projectnummer prominent in dropdown, preview-time scan voor next-folder-number (toont 014 i.p.v. hardcoded 001), auto-pre-select via folder-match of linked-project, NAS-knop verplaatst van toolbar naar attachment-rij tussen "Alles opslaan" en "NextCloud".
- **Cache-invalidatie bij move/delete** (`a49f797`): `invalidateFolderCache(folder)` wist nu alle 3 lagen (in-memory + localStorage + IndexedDB). Voorkomt dat verwijderde mail "terugkomt" bij refresh.
- **Popout MailView project-link** (`a49f797` + `895dd6b`): `hydrateEmailProjectLinks` bij mount + folder-auto-detect runtime — popout toont nu altijd de groene chip voor mails in project-folders.
- **Attachment-balk verbergen bij sig-only mails** (`895dd6b`): `if (visibleAtts.length === 0) return null` — geen misleidende "0 bijlagen / 7 verborgen bijlagen"-balk meer wanneer alle attachments inline-handtekening-images zijn.
- **Settings NC-URL** (`1b04e2f`): auto-prepend `https://` als gebruiker `nextcloud.3bm.cloud` invoert zonder protocol (anders timeout server-side).
- **Server `hasAttachments` strict** (`fcc5380`): alleen `disposition === "attachment"` telt nu — sig-images krijgen geen paperclip in mail-lijst meer. Werkt voor productie pas na deploy.
- **Mail-lijst paperclip-palliatief** (`356dee4`): voor mails die al in `fullMsgCache` zitten checken we client-side of visible attachments == 0 → paperclip wegfilteren. Werkt direct, zonder server-deploy.

### Opgelost

- **Todo Urgent** (`0882e01`): "Urgent" optie weggehaald uit TodoDetail dropdown — ERPNext ToDo-doctype accepteert alleen High/Medium/Low (Task-doctype heeft wel Urgent, blijft beschikbaar).

### Gemerged

- `ba2b029` — `origin/main` (cross-mailbox-move PR #63 + inline-project PR #70) in onze branch. Auto-merge schoon.

### Documentatie

- `f3df525` — spec + plan voor IndexedDB mail-list cache in `docs/superpowers/`.
- IDEE.md uitgebreid met "Shared postvak per project via ERPNext Communication" als toekomstig spec-idee.

---

## v0.24.0 — Mail-bijlages opslaan op NAS

**Nieuwe knop "NAS" in webmail toolbar** — schrijft alle bijlages van een geopende mail in één klik naar de juiste projectfolder op de NAS, via de browser File System Access API. Geen server-wijzigingen; alle filesystem-toegang gebeurt direct vanuit de browser.

- **Knop in mail-detail toolbar** tussen Forward en de Follow-up dropdown. Disabled wanneer mail geen bijlages heeft of de browser geen FSA ondersteunt (Firefox/Safari).
- **Dialog** met project-picker (zoekbaar, gefilterd op `status in [Open, Working, Pending Review]`), live preview van het resolved pad en read-only lijst van bijlages.
- **Pad-opbouw**: `<companyHandle>/<project_number> <project_name>/<correspondenceSubdir>/<resolvedFolderName>/`. Subfolder-naam komt uit een template; default `{nr:03d} {dd-mm-yyyy} {subject}`. Volgnummer is auto, op basis van bestaande sub-folders in de correspondentie-map.
- **Per-device, per-company configuratie** in Settings → Project instellingen → "NAS opslag". FileSystemDirectoryHandle per company in IndexedDB, templates in localStorage. Geen sync via server — verschillende werkstations gebruiken bewust eigen drive-letters / share-paden.
- **Sanitization**: subject wordt van `RE:` / `FW:` / `FWD:` / `[EXT]` ontdaan, Windows-illegale chars vervangen, max 60 tekens.
- **Naam-conflict op bestandsniveau**: auto-suffix ` (1)`, ` (2)`. Origineel wordt nooit overschreven.

**Nieuwe bestanden:**
- `packages/frontend/src/lib/nasStorage.ts` — FSA wrappers + IndexedDB handle-store.
- `packages/frontend/src/lib/nasConfig.ts` — localStorage config + template-resolver met `{name:NNd}` padding-syntax.
- `packages/frontend/src/components/SaveToNasDialog.tsx` — dialog.
- `packages/frontend/src/components/NasSettingsSection.tsx` — settings-paneel binnen Project-instellingen tab.

**Out of scope** (apart project, later): auto-detectie van project uit IMAP-folder of subject; mail-body als .eml of PDF naast bijlages; bidirectionele koppeling mail ↔ ERPNext taak; multi-select save vanuit message-list.

---

## v0.23.0 — Mail-perf Wave 1, persistent mark-read TTL, frontend cache rework

**Webmail server-side performance (Wave 1)** — `packages/server/src/mail.ts`
- Cold `/api/mail/folders` from 22 s to ~2 s (−90%). Warmup deferred 5 s after first user response; was grabbing the IMAP lock before the user even clicked.
- Cold `/api/mail/messages` from 12 s to ~5 s (−62%). `fetchFolders()` no longer does per-folder STATUS via `client.list({statusQuery})`; INBOX gets a synchronous STATUS, other folders fill async via `refreshFolderCountsAsync` (8 s defer, staggered behind warmup).
- In-flight coalescing in `resolveCredentials` so parallel `/folders` and `/messages` cache-misses share one ERPNext roundtrip instead of doing 4-6 sequential calls each.
- `\Seen` STORE is now `await`ed and logged on failure instead of fire-and-forget swallow. Race window between STORE and FETCH is closed.
- `fullMessages` cache LRU-capped at 500 entries against memory leak on large mailboxes.
- `IDLE_TIMEOUT` (10 min) split into `CONNECTION_TIMEOUT` (30 min) + `CACHE_LIFETIME` (24 h). Laptop dichtklappen tussen lunch en daarna kost geen herverbinding.

**Frontend fetch dedup** — `packages/frontend/src/lib/instances.ts`
- Global GET `/api/*` dedup wrapper with 100 ms grace window. Parallel identical URLs share one pending Promise; each caller gets a `response.clone()`.
- Eliminates 5 duplicate-call pairs on warm Webmail reload (e.g. `/api/yapp/me`, `/api/auth/me`, `/api/instances/.../mail-accounts` were each fired twice).

**LocalStorage cache voor alle folders + alle conversations**
- `readMailFolderCache` / `persistMailFolderCache` (LRU 50 folders) in `Webmail.tsx`. Tab-switch en page-refresh tonen mail-list instant uit cache; server-refetch overschrijft achteraf.
- `readConversationMessageCache` / `persistConversationMessageCache` (LRU 30 convs) in `Messenger.tsx`. Talk-gesprek opent instant met laatste 50 berichten zichtbaar; scroll-naar-onderen-positie klopt direct.

**Persistent mark-read TTL-Set tegen IMAP race**
- `webmail_recent_mark_read` localStorage key tracked uid-per-folder met 60-s timestamp. Overleeft tab-switch, page-navigation, F5 en Vite hot-reload.
- `applyRecentReadOverlay` forceer seen=true voor recent lokaal gemarkeerde mails op alle vier de message-laad-paden (hydrate-useEffect, mount-init, loadMessages, switchFolder).
- `applyRecentReadOverlayToFolders` corrigeert ook folder.unseen zodat sidebar-badge en panel-header consistent zijn (was 7 vs 5 mismatch).
- Server wint na 60 s zodat externe mark-as-unread (Outlook desktop) en nieuwe arrivals correct getoond worden.

**Push-refresh van mail-list bij IMAP IDLE**
- `BackgroundSyncProvider` dispatcht `y-app:mail-changed` custom event bij WS push. Webmail-listener triggert `loadMessages(activeFolder, true)` zodat nieuwe mails direct in de lijst verschijnen (niet alleen de badge).

**Email-sidebar-badge consistent met INBOX-folder-badge**
- `shouldCountForBadge` telt alleen INBOX zelf (geen subfolders). Sidebar-badge en folder-badge tonen exact hetzelfde getal.

**Delete-confirmatie bij permanent delete**
- Klik "Verwijderen" in Verwijderde items → confirm-popup "Permanent verwijderen?". Andere folders: soft-delete naar Verwijderde items zonder popup (Outlook-stijl).
- Toast-feedback bij delete/move-failure ipv silent catch.

**Messenger memoization en error-handling**
- `useMemo` voor filtered conversations, grouped messages, en filteredEmployees in "Nieuw gesprek"-panel → −20-50 ms per keystroke.
- `createConversation` toont nu error bij failure (was silent ignore).

**Uren-boeken op afgesloten projecten** — `UrenBoekenWidget.tsx`
- Filter status !== "Cancelled" (was status === "Open"). Joran kon niet boeken op project 2642 Porthos Rotterdam (Completed). Open projecten eerst, Completed/Hold onderaan in grijs met (afgesloten) / (on hold) label.

**TypeScript fixes**
- Webmail compose: `(err as any).exc` vervangen door typed `{ exc?, message? }` cast.
- Messenger AudioContext: `(window as any).webkitAudioContext` vervangen door typed `WebkitAudioWindow`.

**i18n**: nieuwe keys in NL/EN/DE — `webmail.confirm_permanent_delete`, `webmail.delete_failed`, `webmail.move_failed`, `messenger.create_conversation_failed`.

**Research-rapporten gepublicized** — 5 markdown-docs in `docs/2026-05-*.md` met de analyse-grond achter Wave 1: IMAP-protocol review, end-to-end timings, Playwright-walk-bevindingen, server data-flow review.

---

## v0.20.0 — Invoice-send polish, facturatie-prep dashboard, messenger captions

**Invoice send-flow — server-side image proxy + clearer modal layout**
- New `/api/erpnext-asset?instance=<id>&path=...` endpoint streams ERPNext `/files/`, `/private/files/` and `/assets/` through the existing authenticated session. Letterhead and print-format images now load reliably even when ERPNext isn't directly browser-reachable, and private files work without exposing session cookies cross-origin. Path is whitelisted to asset prefixes — not a general API bypass.
- `/api/printview-html` rewrites `src=`, `href=` and CSS `url(...)` references to route through the asset proxy, and injects CSS that hides ERPNext's own Print / Get-PDF toolbar inside the embedded preview.
- `fetchPrintPreviewHtml()` injects `<base href="${origin}/">` into srcDoc iframes (without it, absolute paths resolve against `about:srcdoc`, leaving broken images).
- Signature rewriting split into two paths: `signaturePreviewHtml` (proxy URLs for the in-app preview) and `signatureForRecipient` (absolute ERPNext URLs the recipient's mail client will fetch). Recipients no longer see broken images when their mail client can reach ERPNext directly.
- `SendInvoiceModal` UI: clear section banners — **E-mail** (teal) and **Bijlage (PDF)** (amber) — make it obvious which part of the screen the recipient sees in their inbox and which is the attached file. PDF preview gets a grey frame around all four sides via a zoom-aware wrapper.

**Invoice send-flow — earlier iterations on top of v0.19.0 base**
- Print-format dropdown defaults to the urenbasis-only format; toggle remembers selection. "Open in ERPNext" goes through the full HTML print page (correct logo + letterhead). Multiple PDF endpoints attempted with Print fallback so blank previews are caught.
- Editable preview: rich-text description editor on the Sales Invoice Item, expandable timesheet rows showing exactly which uren-rows will print on the PDF, inline edit of item and customer. Sales Invoice Item description field hidden where not needed.
- Per-account signature lookup: when multiple outgoing accounts exist, modal pulls the right `email_signature` for the selected sender (not just user-default).
- `From` address resolution rewritten: looks at Email Account whitelisting, default-outgoing flag, and user-account links — handles the multi-account-per-instance case correctly.
- Layout: zoom controls + fit-to-width on the PDF iframe; compact form spacing; "Bekijken & Versturen" on draft rows in te-factureren-tab.
- Backend fixes: drop bogus `letterhead=No+Letterhead` query param; correct print-format names; `printview` proxy sends `Accept: text/html`; render print preview from HTML not PDF binary; 500-on-save edge cases resolved.

**Facturatie-prep dashboard — new tab + UX**
- New dashboard widgets surface facturatie-prep state at a glance: bookable hours pending, drafts awaiting submit, klanten zonder activiteit, etc.
- Te-factureren-tab gets deep-links into project and task panels in-page (no full-page navigation). Project + task panels open inline for quick context.
- Goedkeuren-style overzicht across the related views — consistent expand/collapse pattern.

**Onkosten — km-anomaly highlighting + goedkeuren tab**
- New `km-goedkeuren` tab on `/expenses` flags rides where claimed km deviate from expected (route + factor). Anomaly highlighting also applied to the existing Overzicht tab so the warnings travel with the data, not the tab.
- `?tab=` URL routing on `/expenses` enables deep-links from dashboard cards directly into the right tab.
- Goedkeuren-style per-employee overview with uitklap → individual ritten.

**Messenger + Webmail**
- Caption + plaatje land in **one** Talk message bubble via NC Talk 19+ `talkMetaData.caption`. Previously: separate text and image bubbles. Two-image case: caption attaches to the last image's bubble (NC Talk protocol allows one file per message).
- Webmail + Messenger: grouping, long-poll for low-latency updates, mobile mailbox dropdown for narrow viewports.
- Webmail: shared mailbox tabs now visible in vault mode (was hidden by accident). Primary credentials pulled from the vault as fallback when the session cache is empty.

**Employee view fixes**
- Sidebar (zijbalk) modules properly filtered for employees on instances using restricted modules.
- Tasks: company-filter applied correctly so employees see only their own company's tasks.
- Project create-mode: checklist preloaded from customer→template mapping is editable from the start (was read-only until first save).

---

## v0.19.0 — Send Sales Invoices via ERPNext from Y-app (F40)

**New feature: invoice send-flow with PDF preview**
- `SendInvoiceModal` opens from two places: (a) "Versturen" button on submitted invoices in SalesInvoices → Alle tab, (b) "Bekijken & Versturen" button next to each freshly created draft in ToInvoice's results-lijst. DRAFT-mode submits the invoice first (docstatus 0 → 1) and then sends; SUBMITTED-mode just sends.
- Layout: PDF preview iframe on the left (using existing `/api/printview-html` proxy, print format + letterhead are switchable on the fly), email form on the right (To/CC/BCC/Subject/Body, prefilled by rendering an ERPNext Email Template server-side with the invoice as Jinja context).
- ERPNext is sole source of truth — Y-app only stores two defaults per instance in `instance_settings.invoice-email-defaults`: the Email Template name and the Print Format name. Subject/body/letterhead/signature/From-address all come from ERPNext on every open, no caching, no drift.
- User edits in the modal (subject, body, recipients) are sent 1:1 as `subject`/`content`/`recipients` to `frappe.core.doctype.communication.email.make` (no `email_template` param, so the user's tweaks aren't overwritten by re-rendering on the server). Resulting Communication record appears in the invoice timeline, same as when sent from ERPNext directly.
- Signature handling: ERPNext appends `User.email_signature` automatically. The modal shows it as a read-only preview block under the body, so users see what will be appended — and a hint tells them to end their body on the greeting, not on a name/contact block (would cause duplicate signatures).
- Preflight: opens `Email Account` filtered on `default_outgoing=1`. If empty, blocking error state with link to ERPNext setup — without an outgoing account the mail would queue forever.

**Bulk send**
- New `BulkSendDrawer` triggered by checkbox-selection on the Alle tab + "Verstuur geselecteerde (N)" bar. Sequentially sends each selected invoice using the configured defaults (own subject, own PDF, own Communication-record per invoice). Status per row (pending → sending → sent / error) with retry per failed row.

**Settings**
- New "Factuur versturen" section in Settings → Project instellingen (employer-only). Two dropdowns populated from ERPNext (`Email Template` and `Print Format` filtered to `Sales Invoice`). Hint text directs admins to manage content in ERPNext at `/app/email-template` and `/app/print-format`.

**New files**
- `packages/frontend/src/lib/invoiceEmail.ts` — thin wrappers around `frappe.core.doctype.communication.email.make`, `frappe.email.doctype.email_template.email_template.get_email_template`, `frappe.client.submit`, and the existing `/api/printview-html` proxy.
- `packages/frontend/src/components/SendInvoiceModal.tsx` — preview + edit + send.
- `packages/frontend/src/components/BulkSendDrawer.tsx` — sequential bulk send with per-row retry.

**i18n**
- `invoice_email.*` and `settings.invoice_email_*` keys added to `nl.json` and `en.json` (45 new keys).

---

## v0.18.0 — tenant isolation + Financieel dashboard tabs + Revenue period + NC Talk test

**Chinese-walls tenant isolation (security/correctness)**
- New per-instance helpers `getActiveCompany/Employee/ActivityType/ContractHours` in `lib/instances.ts` that exclusively read `pref_${instanceId}_*` localStorage keys. 35+ pages migrated from the legacy global `erpnext_default_*` keys to the helpers, so a user who switches from 3BM to Domera no longer sees 3BM's company name as the default filter on Domera's pages.
- One-shot startup migration removes legacy global `erpnext_default_*` keys from localStorage so they cannot be read again by accident.
- Settings.tsx writes per-instance keys only; the App.tsx mirror-hack was removed (helpers obviate it).

**Messenger tenant leak fix**
- `convoCache` changed from a singleton `{ data, ts }` to a per-instance `Map<instanceId, …>` with `getConvoCache()` / `setConvoCache()` helpers. Race-check in prefetch discards results when the active instance changed mid-fetch.
- Server-side `resolveNcTalkCreds` (messenger.ts) and `resolveNextcloudCreds` (nextcloud.ts) now prefer per-request credentials over env-var fallback — was reversed, which made any server with `NEXTCLOUD_URL` set route every tab to the same NextCloud installation.
- New `getNextcloudCreds()` / `getTelegramToken()` helpers on the frontend so the priority chain can't be silently inverted by future edits.

**Timesheets fixes**
- Billable indicator now reads `log.is_billable` (ERPNext's actual field name) in all three loaders. Previously it read `log.billable` which doesn't exist on `Timesheet Detail`, so the checkbox was always unchecked regardless of the actual ERPNext state.
- `handleConfirmApprove` now uses the correct Frappe v15+ `frappe.client.submit(doc)` signature — fetches the document first, then submits it. The old `{ doctype, name }` call returned `TypeError: submit() missing 1 required positional argument: 'doc'`.
- `callMethod` in `lib/erpnext.ts` now surfaces real ERPNext error messages from `_server_messages` / `exception` / `exc` instead of the opaque "ERPNext API error: 500".

**Financieel dashboard — two new tabs**
- **Klanten**: customer × year matrix with project counts. Year derived from `actual_start_date` → `expected_start_date` → `creation` (best available). Configurable year range + customer search. Sticky left column, total row + column.
- **Omzet/klant**: customer × period matrix with revenue excl. VAT. Granularity picker (week / month / quarter / year — week follows ISO 8601). From/to date pickers default to last 12 months. Sticky left column, total row + column, sorted by total descending.

**Revenue page**
- Period selector dropdown: Full year / Year-to-date / Last 3-6-12 months / Custom (from/to date pickers). Year selector only shown for "full year" mode.
- Chart bars and cumulative lines scale to whatever month count the period spans (1 to 24+). Month labels include year (`Dec '25`, `Jan '26`) when the period crosses a calendar year.
- Comparison period is always the same window shifted -1 year so YoY remains meaningful for rolling/custom ranges.
- Added a horizontal monthly-average reference line (orange dashed) so months above/below the year's average jump out at a glance.

**NextCloud Talk diagnostics**
- New `POST /api/messenger/test` endpoint: unauthenticated capabilities probe (DNS / cert / "is this a NextCloud") followed by an authenticated Talk room probe (auth / Talk-installed / room count).
- "Test verbinding" button in Settings → NextCloud Talk with structured feedback per failure mode (Hostnaam niet gevonden, Authenticatie mislukt, Spreed app niet geïnstalleerd, …) and the conversation/unread count on success.

**Per-instance Frappe version detection**
- Server detects the Frappe major version (v15/v16) at instance add-time via `/api/method/frappe.utils.change_log.get_versions` — hard-fails the add if it can't determine the version. Settings has an override + "Re-detect" button.
- New `/api/i/:id/count` endpoint abstracts the v15-vs-v16 difference (`frappe.client.get_count` vs REST aggregate `{"COUNT":"*"}` dict) so the frontend stays version-agnostic.
- `erpnext-client.ts` logs 5xx proxy responses (first 600 bytes) so ERPNext-side errors are debuggable from the server log.

**i18n**
- New keys for the period selector, granularity, customer/total/from/to commons, and the new dashboard tab labels — synced NL + EN.

---

## v0.17.0 — messenger threading + standalone mail view + forward fixes

**Messenger**
- Combined image + text send: typing a caption while a screenshot is pasted now sends both in one action (previously the typed text was dropped).
- File picker for any format: the paperclip button now opens a file picker and accepts PDF, DOCX, ZIP, etc. (not just images).
- Threaded replies (NC Talk `replyTo`): reply button on each message → banner above textarea → reply renders with parent-preview citation block in the receiver's UI.
- Notifications: short audio chime + browser Notification when the tab is unfocused + `(N) Y-app` unread count in the document title (in addition to the existing sidebar badge).
- Fixed: clicking "Laad oudere berichten" now keeps the scroll position instead of jumping back to the latest message (race condition between `requestAnimationFrame` and the scroll-to-bottom `useEffect`).

**Mail**
- Forward now preserves the original message's attachments. They appear as blue "forwarded" chips in the compose attachments list; user can remove individual ones with the × button. Inline images from signatures are filtered out automatically.
- Reply / Forward / Reply-all now preserve HTML formatting in the quoted body — bold/italic/links/colors from the original mail render correctly inside a citation `<blockquote>` instead of being flattened to plain text with `<br>` line breaks.
- Signature refresh button added to the compose toolbar (↻ icon). Clears the v5 localStorage cache for the current `from` address and re-fetches from ERPNext, with a `console.warn` when the response is still empty (so it's clear whether the missing signature lives in ERPNext or in the cache).
- Standalone mail view (`window.open` from message list) now has the full action set instead of just Reply/ReplyAll/Forward: project picker (link mail to ERPNext project), CRM contact search + add-from-sender, follow-up dropdown (Task / Quotation / Project / Purchase Invoice), delete, download-all-attachments.
- Reply / Forward in the standalone view now opens an inline compose dialog *inside the standalone tab* (with rich-text editor + signature + attachment list + send), instead of redirecting back to the full Y-app shell.

**Tasks**
- Dashboard "Mijn taken" widget: bumped the ToDo fetch limit from 100 to 500.
- Tasks page (sidebar → Taken): switched from the 300-row `fetchList` to paginated `fetchAll` so instances with many tasks see them all (50k safety limit).

**Internals**
- `lib/email-project-links.ts` — extracted the per-email `getEmailProjectLinks`/`setEmailProjectLink` helpers from Webmail.tsx so MailView can share the same storage without duplicating logic.
- `ComposeState` gained `quoteHtml?` and `forwardedAttachments?` fields. Additive change — no rename, no removal — so future merges that touch reply/forward stay clean.

---

## v0.15.0 — dependency modernization + accumulated fixes

**Dependency refresh (frontend + desktop + Rust)**
- Frontend: `i18next` → 26.0.6, `react-i18next` → 17.0.4, `@tailwindcss/vite` + `tailwindcss` → 4.2.3, `eslint` → 10.2.1, `eslint-plugin-react-hooks` → 7.1.1, `typescript` → 6.0.3, `typescript-eslint` → 8.59.0, `vite` → 8.0.9.
- Desktop (JS): aligned with frontend — `i18next` 24 → 26, `react-i18next` 15 → 17, `vite` 6 → 8, `@vitejs/plugin-react` 4 → 6, `typescript` 5.9 → 6.0, `react-router-dom` → 7.14.1, tailwind → 4.2.3.
- Desktop (Rust): `reqwest` 0.12 → 0.13, `rusqlite` 0.37 → 0.39, `async-imap` 0.10 → 0.11, `mail-parser` 0.10 → 0.11.
- `reqwest` 0.13 dropped its bundled rustls feature; switched to `rustls-no-provider` and installed the `ring` CryptoProvider as the process default in `lib.rs` so `mail.rs` (which already uses `builder_with_provider` with ring) stays consistent.
- `async-imap` 0.11 flipped `read_response` to `io::Result<Option<ResponseData>>`; adjusted combinator order in `mail.rs`.
- `tsconfig.json` (desktop): added `"ignoreDeprecations": "6.0"` so TypeScript 6 tolerates the `baseUrl` deprecation that still drives our `@frontend/*` path alias.

**Accumulated since v0.14.0**
- feat(extensions): `fetchPrivateFile` RPC for iframe extensions, sidebar dedup + unread badge support.
- fix(messenger): NextCloud Talk file/image attachments now render in the chat view.
- feat(frontend): timezone-safe date handling across leave/timesheet flows, recipient autocomplete in compose, misc quality-of-life polish.
- fix(tasks, todo): resilience when per-instance ERPNext config is missing fields the UI expects.
- fix(todo): stop the flash-and-disappear caused by the `allocated_to` refetch racing the initial list.

**Build verification**
- `cargo check --release`: clean, zero warnings.
- `cargo build --release` (LTO + single codegen unit + strip + panic=abort): produces a working `y-app-desktop.exe`.
- `vite build` (frontend + desktop): clean.

---

## v0.14.0 — runtime extensions (iframe + postMessage RPC, curated catalog)

Extensions are now **iframe-hosted** from third-party origins (e.g. GitHub Pages) instead of compile-time modules. The iframe has no Y-app cookies, so every ERPNext call is brokered back to the parent tab through a postMessage RPC bridge — credentials never leave Y-app. Extension authors ship their own repos without touching the Y-app release cycle; Y-app ships a curated catalog that acts as the allowlist.

**Host-side**
- `components/ExtensionHost.tsx` — sandboxed iframe (`allow-scripts allow-same-origin allow-forms allow-popups`) with origin check + `e.source === contentWindow` check on every message. Loading spinner overlay dismisses on iframe `load`; 10 s timeout → error state with extension URL, Retry, and Open-in-new-tab.
- Wire protocol v1: `{id, type:"yapp-ext.rpc", method, args}` → `{id, type:"yapp-ext.rpc.reply", ok, result|error}`. Allowlisted methods: `fetchList`, `fetchDocument`, `updateDocument`, `callMethod`, `getActiveInstanceId`, `getErpNextAppUrl`. Anything else is rejected.
- Routes `/x/:extId` and `/x/:extId/*` mount `<ExtensionHost />`.

**Data / settings**
- `extensions/catalog.ts` — curated `CatalogEntry[]`. The catalog IS the allowlist; adding an extension means shipping a Y-app release.
- `extensions/remote.ts` — `RemoteExtension` type, `fetchRemoteExtensions` / `saveRemoteExtensions` / `useRemoteExtensions` hook, `buildExtensionSrc`, `extensionOrigin`, `isValidRemote`. Persists under `remote-extensions` key in the existing `instance_settings` table — no DB migration.
- Settings → Extensions: catalog cards with one-click Install / Uninstall. "Advanced / Developer" panel (collapsed by default) still supports arbitrary URL paste for power users.

**Seed catalog entry**
- `kg-planning` → `https://impertio-studio.github.io/Y_App-extension-kg-planning/` (standalone repo at `Impertio-Studio/Y_App-extension-kg-planning`, deploys via `actions/deploy-pages@v4`).

**Cleanup**
- Deleted compile-time extension infrastructure: `extensions/registry.ts`, `extensions/types.ts`, `extensions/enabled.ts`, `extensions/example-planner/`, and the in-tree `extensions/kg-planning/` port.
- Stripped `EXTENSIONS` / `extensionUrl` / `useEnabledExtensions` from `App.tsx` and `Sidebar.tsx`; `Sidebar.tsx` `extensionsForSection` now handles only remotes.
- Stripped all `extensions.kg_planning.*` keys from `en.json` / `nl.json` / `de.json`.

**i18n**
- New keys `extensions.loading`, `extensions.load_failed_title`, `extensions.load_failed_body`, `extensions.retry`, `extensions.open_in_new_tab`, `extensions.not_found_title`, `extensions.not_found_body` (en + nl). Catalog UI keys `settings.extensions.catalog_*`, `install`, `uninstall`, `advanced_*`.

---

## v0.11.6 — manual webmail creds + browser-autofill fixes + manual-only CI

**Webmail**
- Setup form is no longer dead data. IMAP host/port/user/password typed into the form are now forwarded on every `/api/mail/*` call via `buildQuery`. Server `getCredentials` prefers those query-param creds over the ERPNext `Email Account` lookup, and only falls back to ERPNext when the query doesn't carry a full set. Previously users without a matching Email Account record got "Email Account not found in ERPNext" regardless of what they typed.
- `mailListFolders` / `mailListMessages` wrap `getCredentials` in the try/catch so auth-resolution errors produce JSON instead of Express's default HTML 500.

**Browser autofill**
- `autoComplete="new-password"` / `"off"` on IMAP setup, NextCloud credential form, ERPNext vault API-key/secret edit dialog. Browsers stop offering the Y-app login there.

**CI**
- Deploy + Build & Release workflows are now `workflow_dispatch` only. `git push` and `v*` tags no longer trigger anything automatically; runs are kicked off from the Actions UI.

---

## v0.11.5 — i18n sweep + scrollable settings tabs on mobile

**i18n**
- Routed remaining hardcoded Dutch strings in the UI through `t()` with NL/EN/DE entries: Settings project-template mapping panel (customer/task-template labels, search placeholder, select/add/save buttons), Expenses (Totaal km, Totaal declaraties, no-requests state, retour/enkel options, edit/delete tooltips), Timesheets row edit tooltip, Projects folder-open toast + prompt fallback + no-tasks-yet line, Dashboard project-search (title, placeholder, no-results) and QuickKmBooking header.
- New keys: `common.customer`, `settings.task_template`, `settings.search_customer_placeholder`, `settings.select_template`, `settings.save_settings`, `onkosten.total_km`, `onkosten.total_claims`, `onkosten.no_requests_found`, `projects.path_copied`, `projects.copy_path_prompt`, `projects.no_tasks_yet`, `dashboard.project_search_title`, `dashboard.project_search_placeholder`, `dashboard.project_search_no_results`.

**Settings tabs mobile fix**
- Settings tab row no longer overflows / wraps awkwardly on phones. `flex overflow-x-auto flex-nowrap` with edge-bleed padding; each tab gets `shrink-0 whitespace-nowrap`.

---

## v0.11.3 — mobile-responsive overhaul + dev proxy env var

Broad mobile-responsiveness pass across the web frontend. Pages and widgets that previously overflowed on ~360 px-wide phones now lay out correctly. Desktop behaviour is unchanged.

**Dashboard**
- Root container `p-6` → `p-3 sm:p-6`; header wraps; grid gap shrinks on mobile; Add-widget button shows icon-only below `sm`.
- Every widget card `p-5` → `p-3 sm:p-5` (Birthday, Leave, MyTodoList, ProjectSearch, QuickKmBooking, TaskList, Email).
- `SortableWidget` gets `min-w-0` so children cannot push it wider than its column.

**UrenBoekenWidget** (used by Dashboard + Timesheets)
- Row 1 grid: `grid-cols-[130px_1fr_1fr]` → `grid-cols-1 sm:…`.
- Row 2 grid: `grid-cols-[144px_76px_44px_76px_48px_1fr_auto]` → stacks on mobile, original 7-col dense layout from `md:`.
- Every grid cell + form + header row gets `min-w-0`; mobile browsers rendered `<input type="date">` / `<input type="number">` with intrinsic minimum widths that were forcing the grid wider than `w-full`.
- Side-by-side layout in Timesheets: `flex` → `flex-col lg:flex-row`; hardcoded 750 px column no longer overflows phones.

**Timesheets, Planning, Contacts, Wiki, NextCloudFiles, Outstanding, SalesInvoices** — all received equivalent mobile fixes (headers wrap, large grids collapse on small screens, hardcoded widths replaced with responsive variants, hidden sidebars / swap behaviour where appropriate). Hardcoded `toLocaleDateString("nl-NL", …)` calls in Planning now derive the `Intl` locale from `i18n.language`.

Plus: 25 pages got root `<div className="p-6">` → `p-3 sm:p-6`.

**Dev tooling**
- New optional `VITE_API_TARGET` env var lets a local frontend proxy to a remote backend for UI work. Default unchanged (`http://localhost:3500`). Example: `VITE_API_TARGET=https://y-app.impertio.app npm run dev`.
- `main.tsx`: in dev mode, actively unregister any previously-installed service worker + clear its caches. A stale SW from an earlier production-like session was causing endless loading on localhost. Dead-code-eliminated from production bundles via `import.meta.env.DEV`.

---

## v0.11.2 — biometric UX polish

- **Auto-trigger biometric prompt on mount**: when biometric is enrolled, `unlockWithBiometric()` fires ~150 ms after the screen renders. Cancel/fail leaves the user on the screen with the password input + retry-fingerprint button. One screen, zero extra taps for the common case.
- Title strings drop the "Desktop" suffix — same code runs on Android so "Y-app Desktop" was misleading on phones. Now just "Y-app" across en/nl/de.

---

## v0.11.1 — biometric debug aids

Tester reported the fingerprint button stuck on "Authenticating…" on a real Android phone — the system biometric prompt never appeared.

- `unlockWithBiometric()` now races `authenticate()` against a 30 s timeout.
- `VaultUnlock` surfaces any biometric error message inline for debugging. User-cancelled prompts are silenced.
- Removed the speculative `subtitle: undefined` from the authenticate options.
- Reverted the speculative `BiometricActivity` manifest injection.

---

## v0.11.0 — biometric unlock for Android

Opt-in fingerprint unlock for the Stronghold vault. The vault password is stored as plain bytes in the app's private data directory (not readable by other apps without root). The biometric prompt (via `tauri-plugin-biometric`) gates the JS-layer call to the Rust read command. Protects against casual physical access; a rooted attacker can still extract the file. The opt-in modal makes that limitation explicit.

- 4 new Rust commands: `biometric_write_password`, `biometric_read_password`, `biometric_clear_password`, `biometric_has_password`.
- `reset_vault` + `changeVaultPassword` now also wipe `biometric.bin`.
- `adapter/biometric.ts` — no-op on non-Android so desktop builds compile unchanged.
- `EnableBiometricModal` shown after the first successful password unlock with caveat copy.
- Password held in a ref (not state) so React DevTools can't see it.
- `capabilities/android.json` — new, scoped to `["android"]`, grants `biometric:default`.
- `release.yml` patches `AndroidManifest.xml` with `USE_BIOMETRIC` after `tauri android init`.

---

## v0.10.0 — merged v0.4.1 + signing fixes

Merged v0.4.1 from the long-running `fix/build-issues-v040` branch via rebase-only-the-new-commits (skipped two duplicate-but-not-identical earlier commits that predated the divergence). 13 files / +1,932 / −248 applied, plus 4 TS cleanups.

- **Windows Authenticode re-upload fix**: `tauri-action` uploads the `.exe` **before** the separate Authenticode step runs, so the release asset was the unsigned version. New step overwrites it with the now-signed file from disk.
- **Android stable keystore**: replaced per-run `keytool -genkeypair` (new signing key every release → users can't update in place) with a step that decodes `ANDROID_KEYSTORE_B64` from a repo secret. Requires `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASS`, `ANDROID_KEY_ALIAS`.
- `Leave.tsx` kept main's English `Leave()` name over branch's `Vakantieplanning()`.
- `ProjectSettingsPanel` `instanceId` type widened `number → string`.
- Removed unused `ProjectTemplateRecord` interface; prefixed unused destructured names in `TodoDetail` with `_`.

---

## v0.9.0 — deploy build fixes

- `modules.ts` Page IDs: the v0.4.1 merge re-introduced legacy Dutch page IDs. Translated to English equivalents (`brieven` → `letters`, `grootboeken` → `ledgers`, `banktransacties` → `bank-transactions`, `boekingsprogramma` → `booking-program`, `omzet` → `revenue`, `openstaand` → `outstanding`, `kosteninzicht` → `cost-insight`, `rendabiliteit` → `profitability`, `liquiditeitsplanning` → `liquidity-planning`).
- `APP_VERSION` was hardcoded in `lib/version.ts` and drifted out of sync with the four `package.json` manifests on every release. Now Vite's `define` injects the version from `packages/frontend/package.json` at build time — only the manifests need bumping.

---

## v0.8.0 — desktop vault UX, friendly errors, auto-lock, change-password

**Vault UX**
- Forgot-password / reset-vault flow on the unlock screen (confirmation dialog requires typing `RESET`; Rust command deletes `vault.hold` + `stronghold-salt.txt`).
- Friendly Stronghold error mapping: `BadFileKey` / age-content errors now show "Wrong password" / "existing-vault mismatch" instead of the raw age-encryption blob.
- Lock-vault from the account dropdown (was a no-op stub): closes the Stronghold vault, drains the credential cache, returns to the unlock screen.
- Account dropdown shows "Vault: Local — no Y-app account" instead of the synthetic `desktop@local` email when `localVaultMode` is set.
- Refresh in-memory credential cache after add/delete instance — fixes "Test connection works but going inside the instance fails until app restart".

**ERPNext test-connection**
- `normalize_base_url()` trims trailing slashes (was producing `https://host//api/method/login`).
- `classify_send_error()` returns stable error codes (`network_unreachable`, `tls_error`, `timeout`, `invalid_credentials`, `server_error`, `no_session`) so the frontend can show translated messages.
- `TestResult` serialised as camelCase — also fixes a latent bug where `data.fullName` was always undefined.

**Auto-lock + change-password**
- `useAutoLock(onLock)` hook: `visibilitychange` + activity tracking; fires after N min idle or in background. Default 5 min, configurable via `localStorage.vault_auto_lock_minutes` (0 = disabled).
- Change-password flow: Stronghold has no native rekey — JS orchestrates verify → snapshot → close → backup → wipe → reopen with new password → write back → delete backup. Rolls back on any failure.
- 4 new Rust commands: `backup_vault`, `restore_vault_backup`, `delete_vault_backup` (plus existing `reset_vault`).
- New `ChangeVaultPasswordModal` from the account dropdown.

**Android hardening**
- Stronghold vault backup disabled (`android:allowBackup=false`) so Google's D2D transfer can't restore `vault.hold` without its salt.
- Stable keystore support via secrets so users can update APKs in place.

**Misc**
- Disable browser right-click context menu (native-app feel).
- Copy `y-logo.svg` into `desktop/public` so the sidebar logo renders in desktop dev.
- Drive-by fix for `\api\yapp\logout` typo (JS collapses backslashes to letters — `apiyapplogout` was 404'ing in web sign-out).

---

## v0.4.1 — 11 bug fixes + 13 features

Originally on branch `fix/build-issues-v040`, merged into `main` in v0.10.0 after rebasing onto current architecture. Listed here under its original version for historical clarity.

### Bug fixes (B02–B11)
- **B02** Sidebar module visibility — `SIDEBAR_MODULES` sync with Sidebar definition, ERPNext `blockedModules` filter.
- **B03** Messenger "Alle" tab — parameter name mismatch fixed (`nc_url` → `url`).
- **B04** Session caching — `localStorage` stale-while-revalidate for INBOX, folders, Talk conversations.
- **B05** Talk file/image support — server extracts `messageParameters.file`, proxy endpoint, frontend rendering.
- **B06** IMAP AsyncQueue — serialises operations per account; retry logic; lock timeout 30 s.
- **B07** Email collapse state — persist in localStorage per folder.
- **B08** Smart dropdown positioning — `useDropdownPosition` hook, WorkflowChanger.
- **B09** Shift hours consolidation — shared `shiftHours.ts`, `activityTypes.ts`, URL-match bridge.
- **B10** Missing shift warnings — amber banner + blocked calculations.
- **B11** Contract hours from Shift Type docs — no more name-parsing.

### New features
- **F05** Multi-select email (Shift/Ctrl click, bulk actions).
- **F06** Create email folder based on project (`[IN]` / `[OUT]` prefix).
- **F07** Subfolder search in email.
- **F08** Compact widget layout (2 rows).
- **F09** Individual booking rows in Timesheets overview with sortable columns and month headers.
- **F18** Rich-text task description + sidebar-collapse bug fix.
- **F23** Settings cleanup for employee view.
- Kanban tab on Planning page.
- Todo defaults (employee filter, date, `assigned_to`).
- Per-employee activity type (employer setting).
- 24 h time input (text input instead of native time picker).
- Tasks/Subtasks moved to "Taken & Planning" sidebar section.
- Inline edit project/task dropdown in `TimesheetDetailsTable`.

### Project sidebar + template settings
- Create new project in sidebar (customer dropdown, PM default = logged-in employee).
- Pre-load tasks from customer ↔ template mapping (editable, add/remove).
- Address sub-section (edit mode only): Nominatim + Leaflet.
- Pencil button in `ProjectDetail` header → edit sidebar.
- SO filter: `docstatus=1` only; customers: `limit_page_length=0`.
- New "Project instellingen" Settings tab (employer-only) — customer ↔ ERPNext task template mapping, stored in `instance_settings` key `project-template-mapping`.
- `packages/server/src/project-suggestions.ts` — matches on customer name directly.
- Todo: `reference_type != "Task"` filter for everyone; employee filter for employers.
- Tasks: multi-assignee fix (adding no longer replaces all existing).
- Timesheets: UTC timezone bug in workday-fill loop fixed.

### Architecture
- `lib/shiftHours.ts`, `lib/activityTypes.ts`, `lib/useDropdownPosition.ts`.
- `components/ShiftHoursWarning.tsx`.
- `/api/shared-settings/:key` — cross-user settings via URL-match (employer → employee bridge).
- `/api/messenger/file-proxy` — authenticated NextCloud file proxy.
- `InlineSearchSelect` component in Timesheets for inline project/task edit.

### Dependencies
- `react-day-picker` ^9.6.4 (packages/frontend).

---

## v0.4.0

### Uren boeken widget
- Task name visible immediately after booking.
- Rounding to 2 decimals.
- 200 ms delay removed after booking.
- Activity type hidden for employees (employer sets it).

### Leave-request modal (Vakantieplanning)
- 2-step flow: form → summary with blocks → submit.
- Shift-plan aware: only workdays consume leave.
- Split leave requests: part-time schedules → multiple ERPNext applications.
- `react-day-picker` calendar with colouring (grey = non-workday, teal = holiday, orange = existing leave).
- Hover tooltips with reason per day.
- Half-day with date-selection.
- Leave types filtered on employee allocations.
- Pending requests visible in hours-balance cards.
- "Today" navigation button.

### Messenger
- Batch loading: 20 messages per batch (was 100) + "Load older messages" button.
- Polling merges new messages instead of replacing everything.
- NextCloud URL auto-prepends `https://`.

### Dashboard
- Missing-hours check via `time_logs` instead of timesheet `start_date`.

### i18n
- 40+ new translation keys (nl + en): leave modal, project detail labels.

### Other
- `InstanceBar` `onViewModeChange` made optional.
- CLAUDE.md documents npm install on Z: drive.

---

## [0.3.3] - 2026-03-21

### Toegevoegd
- **Uitgebreide README** — compleet overzicht van alle 40+ modules, integraties en tech stack
- **Office 365 Calendar + Teams** — OAuth2 Graph API integratie (vereist Azure admin consent)
- **Multi-platform release** — Electron (Windows installer + portable) + Tauri builds

### Verbeterd
- **OAuth2 token refresh** — betere foutmeldingen bij ontbrekende Azure consent voor Graph API scopes
- **Dev workflow** — `dev:all` en `dev:mini` scripts voor parallelle server + frontend development

## [0.3.2] - 2026-03-21

### Toegevoegd
- **Moderne scrollbars** — dunne, afgeronde scrollbars in Electron (WebKit + Firefox)
- **Verbeterd Y-mini inlogscherm** — professioneler design met animaties en glasmorfisme

### Opgelost
- **Y-mini credentials isolatie** — module-level initialisatie verplaatst naar `startServer()`, Y-mini laadt nu correct 0 instances
- **isMiniMode referentiefout** — `isMiniMode is not defined` crash in save-session endpoint opgelost
- **OAuth2 Graph API scopes** — expliciete scopes voor Teams (Chat.Read) en Calendar (Calendars.Read)

### Verbeterd
- **Y-mini portable** output nu naar `release/` i.p.v. `release-mini/`
- **OAuth2 token refresh** — betere foutmeldingen bij ontbrekende Azure consent

## [0.3.0] - 2026-03-21

### Toegevoegd
- **Y-mini Android** voorbereiding via Tauri Mobile
- **Session-based authenticatie** — inloggen met gebruikersnaam/wachtwoord (naast API tokens)
- **Y-mini isolatie** — volledig gescheiden config, vault en credentials van Y-app
- **MiniLogin** inlogscherm voor werknemers
- **Mijn taken filter** — standaard gefilterd op eigen taken in Y-mini
- **GitHub Actions CI/CD** — automatische builds voor Electron + Tauri + Android
- **Tauri v2 desktop builds** voor Windows, macOS en Linux

### Verbeterd
- **Beveiliging** — hardcoded credentials verwijderd uit broncode
- **Generieke theming** — geen bedrijfsspecifieke kleuren of namen meer in code
- **Facturabel (billable)** — correct veld (`is_billable`) bij urenregistratie
- **Email breedte** — dynamische berekening i.p.v. hardcoded offset
- **Instance management** — geen hardcoded fallbacks, alles via backend configuratie

### Verwijderd
- Hardcoded bedrijfsnamen, URLs en credentials uit alle bronbestanden
- Hardcoded KNOWN_DEFAULTS en BUILTIN_THEMES

## [0.2.0] - 2026-03-18

### Toegevoegd
- **Vergadernotities (Meeting Notes)** module
- **Leads** module voor CRM
- **Liquiditeitsplanning** module voor cashflow-prognoses
- **Brieven** module voor zakelijke correspondentie
- **Record Locking** component
- **Optionele modules** — in/uitschakelen via Instellingen
- **Delivery Notes statistieken** in Financieel Dashboard
- **Medewerker onboarding**, functiebeschrijvingen en visitekaartjes
- **E-mail: Rich text editor** met opmaak
- **E-mail: Handtekening uit ERPNext**
- **E-mail: Vervolgacties** — Taak, Offerte, Project, Inkoopfactuur aanmaken
- **E-mail: Project koppeling** met slimme matching
- **E-mail: CRM zoeken en Contact status**
- **E-mail: ERPNext indicator** per email
- **E-mail: Bijlage preview** (PDF, afbeeldingen)
- **E-mail: gelezen/ongelezen** met badges
- **E-mail: NextCloud File Picker**
- **Sidebar badge counts** voor Email en Berichten
- **Module zoekfilter** in navigatiebalk
- **Release notes pagina** met GitHub releases integratie

### Verbeterd
- Vakantieplanning fixes (DST-correctie, contracturen, kalender)
- Cache progressive fallback voor ERPNext compatibiliteit
- Sidebar layout verbeterd

## [0.1.0] - 2025-01-01

### Toegevoegd
- Eerste release
- Dashboard met Quick Start overzicht
- Projecten, Taken en Planning
- Boekhouding (Grootboeken, Banktransacties, Facturen)
- Financieel overzicht (Omzet, Openstaand, Kosteninzicht)
- HR & Personeel (Medewerkers, Vakantie, Onkosten)
- ERPNext API-integratie met encrypted vault
- NextCloud bestanden-integratie
- Agenda, Wachtwoorden, Webmail
