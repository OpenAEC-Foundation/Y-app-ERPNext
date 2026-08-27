# Overdracht: 4 punten — desktop DnD, meerdere vensters, NAS-instellingen medewerkers, notificaties

> **Voor de uitvoerende sessie (ander model).** Zelfstandig leesbaar: feiten zijn geverifieerd in de code (file:line geldt bij commit `7d7925c`, branch `refactor/webmail-split` — zoek bij drift op symboolnaam). Lees eerst `CLAUDE.md` (secties "Desktop / Android builds", "Module-indeling") en `docs/plan/2026-07-03-opmerkingen-implementatieplan.md` (context van alle 10 punten).
>
> **Werkwijze (bewezen in dit repo):** kleine slices, elke slice apart geverifieerd en gecommit; gedrag buiten de scope niet aanraken; nooit pushen zonder Piet; PR per punt (of per samenhangend paar). Zie "Gedeelde verificatie" onderaan.

---

## Punt 1 — Mails verslepen werkt niet in de Windows-app

### Feiten
- De drag & drop-code is web/desktop-identiek, géén `isDesktopApp()`-branch: mail-rij is `draggable` met `dataTransfer.setData("text/x-mail-uid", …)` + `"text/x-mail-uids"` (multi-select) in [Webmail.tsx](../../packages/frontend/src/pages/Webmail.tsx) ~r.3096–3105; drop-targets in [FolderTree.tsx](../../packages/frontend/src/components/mail/FolderTree.tsx) (`handleDragOver`/`handleDrop` → `onDropMessage` → `handleMoveMsg`).
- `POST /api/mail/move` is op desktop gespiegeld (adapter [fetch.ts](../../packages/desktop/src/adapter/fetch.ts) r.911–922 → Rust `mail_move`, [mail.rs](../../packages/desktop/src-tauri/src/mail.rs) `op_move` r.770). De move-backend wérkt dus.
- **`dragDropEnabled` is nergens gezet** ([tauri.conf.json](../../packages/desktop/src-tauri/tauri.conf.json): `app.windows` heeft alleen title/size). Tauri's default = **aan**.

### Oorzaak (bekend Tauri/WebView2-gedrag)
Met `dragDropEnabled: true` (default) registreert Tauri een OS-level drag-drop-handler op het venster. Op **Windows/WebView2 blokkeert die handler de HTML5 drag-events ín de webview** — `dragstart` vuurt nog wel, maar `dragover`/`drop` op HTML-elementen komen nooit aan. Precies het symptoom: verslepen werkt in de browser, niet in de app. (Tauri-docs bij `dragDropEnabled`: "Disable this if you want to use HTML5 drag and drop on Windows".)

### Implementatie
1. **`tauri.conf.json` → `app.windows[0]`: voeg `"dragDropEnabled": false` toe.** Eén regel; dit is de kern-fix.
2. **Trade-off gecheckt — veilig:** er is géén Rust-code die op Tauri's file-drop-events leunt (geen `on_window_event`/drag-handler in `src-tauri`, geverifieerd). OS-bestanden die het venster in gedropt worden gaan met deze setting juist naar de HTML5-events — dat is winst (bestanden uit Verkenner in compose slepen kán daarmee later werken), geen verlies.
3. **Web-pariteit voor de ontbrekende mail-routes meenemen (zelfde PR of direct erna):** de adapter geeft nu 501 voor `POST /api/mail/delete-folder` en `POST /api/mail/move-cross-account` (fetch.ts r.1238–1241 catch-all; Webmail roept ze aan op ~r.1989 en ~r.1639). Dus:
   - Rust: `op_delete_folder` (async-imap `mb_delete`; server-guard uit [server mail.ts] spiegelen: weiger INBOX + special-use) en registreren in `lib.rs` `invoke_handler` (r.63–77).
   - `move-cross-account` desktop: de creds voor béide accounts zitten in de vault → Rust-command `mail_move_cross_account(srcAccount, srcFolder, uid, dstAccount, dstFolder)` die fetch-source + append-dest + delete-source doet (zelfde semantiek als server `mailMoveMessageCrossAccount`). Als dit te groot blijkt: adapter laat 'm 501 en de knop op desktop verbergen (`isDesktopApp()`), maar meld dat expliciet.
4. Geen frontend-wijzigingen nodig voor de basis-DnD.

### Verificatie
- `npm run tauri:dev` (root) of release-build; log in, open Webmail: sleep één mail naar een map in de boom → verplaatst + toast; multi-select slepen → bulk; slepen naar favoriet-rij en map-zoekresultaat (die rijen hebben eigen drop-handlers — beide testen).
- Regressie: venster verslepen aan de titelbalk en de compose-window-drag (eigen mousemove-listeners, geen HTML5-DnD — moet onaangetast zijn).
- `cargo check` in `src-tauri` (lokale toolchain aanwezig) + frontend `tsc -b`.

**Omvang:** S voor de kern-fix; +M voor stap 3 (Rust-commands). **Risico:** laag.

---

## Punt 2 — Meerdere tabbladen/vensters werkt niet in de Windows-app

### Feiten
- Devenster-situatie: **één** window `main` (config), geen `WebviewWindow`-creatiecode in Rust of JS, en de capability `default.json` dekt alleen `windows:["main"]` met `core:default` — **window-creatie-permissies ontbreken**.
- `window.open` naar een interne route navigeert de enige webview wég; daarom is dubbelklik-popout op desktop bewust onderdrukt: Webmail.tsx ~r.3146 (`if (isDesktopApp()) { openMessage(msg); return; }`) en Messenger.tsx ~r.1504.
- Desktop heeft een **eigen root**: [DesktopApp.tsx](../../packages/desktop/src/DesktopApp.tsx) met vault-state-machine (`loading|first-launch|locked|unlocking|ready`, r.138–293). **Unlock-state leeft in JS-module-geheugen** (`unlockedPassword` in [vault.ts](../../packages/desktop/src/adapter/vault.ts) r.20/94) — een tweede venster heeft een eigen JS-context en zou dus het unlock-scherm tonen.
- Instance-**tabs** binnen het ene venster bestaan al en werken (InstanceTabBar, `y_app_open_tabs`, Alt+1..9 — DesktopApp.tsx r.418–678).
- "Onthoud op dit apparaat" (auto-unlock via `vault_remember.dat`, commands.rs `remember_*`) bestaat al.

### Ontwerp: popout-vensters (Track A) — niet browser-achtige pagina-tabs
Doel is web-pariteit: mail/messenger in een **eigen venster** kunnen openen (en generiek "open in nieuw venster"). In-window pagina-tabs (Track B) is een veel groter UI-project en lost het eigenlijke gemis niet op; alleen doen als Piet dat expliciet wil.

### Implementatie
1. **Capability**: in `capabilities/default.json` de permissie voor venster-creatie toevoegen (`core:webview:allow-create-webview-window` — exacte identifier tegen de Tauri 2-versie in Cargo.lock checken) én de capability laten gelden voor de popout-vensters: `"windows": ["main", "popout-*"]`. Let op: álle benodigde permissies (stronghold, shell, notification, …) gelden per window-label — de popouts hebben dezelfde lijst nodig.
2. **Popout-helper** in `packages/desktop/src/adapter/window.ts` (nieuw):
   ```ts
   import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
   export function openDesktopPopout(route: string, title: string) {
     const label = `popout-${Date.now()}`;
     new WebviewWindow(label, {
       url: `index.html?popout=${encodeURIComponent(route)}`,
       title, width: 1000, height: 750, dragDropEnabled: false,
     });
   }
   ```
   URL via **query-param, niet een deep path** — Tauri serveert de dist statisch; onbekende paden geven 404. DesktopApp leest `?popout=` en rendert de route.
3. **Popout-modus in DesktopApp.tsx**: bij mount `const popoutRoute = new URLSearchParams(location.search).get("popout")`. Zo ja: na unlock (zie 4) géén InstanceTabBar/workspace maar direct een `<BrowserRouter>` met de route uit de param (de bestaande `/mail/view` en `/messenger/view` popout-componenten van web hergebruiken — die verwachten `instance`/`email`/`acct`/`uid`/`folder` params in de route, zelfde eisen als de web-popouts in CLAUDE.md "Popout tabs"; de aanroeper zet ze in `route`).
4. **Vault-handoff (kern):** het tweede venster mag niet om het wachtwoord vragen.
   - Nieuw Rust-commands (commands.rs): `session_put_unlock(secret: String)` en `session_take_unlock() -> Option<String>` op een `tauri::State<Mutex<Option<String>>>` — **alleen in-memory**, nooit op schijf (het bestaande `remember_*`-pad met bestand is een aparte, opt-in feature; dit niet daarmee mengen).
   - Hoofdvenster: na succesvolle unlock `session_put_unlock(password)` aanroepen (in de bestaande unlock-flow, DesktopApp.tsx r.252–293).
   - Popout-venster: in de state-machine vóór "locked": `session_take_unlock()`... **let op: niet "take"** (één popout zou de state leegtrekken) → maak het `session_get_unlock()` (clone) en wis 'm alleen bij expliciete lock/afsluiten (`closeVault` → `session_clear_unlock`). Popout unlockt daarmee stil via het bestaande `openVault(password)`-pad.
   - Threat-model-notitie voor de PR-tekst: het wachtwoord staat al in JS-module-geheugen van het hoofdvenster (vault.ts r.20); een kopie in Rust-proces-geheugen verbreedt dat niet wezenlijk. NIET naar schijf, NIET in logs.
5. **Dubbelklik-handlers activeren op desktop**: in Webmail.tsx en Messenger.tsx de `isDesktopApp()`-vroege-return vervangen door `openDesktopPopout(route, title)` met dezelfde route-parameters als de web-popout (zie de bestaande `window.open`-blokken er direct onder — parameters hergebruiken). Web-gedrag ongewijzigd.
6. **Sidecar/set-active-instance**: popouts moeten NIET `POST /api/desktop/set-active-instance` sturen (dat is hoofdvenster-state); check in de adapter dat de popout-modus die call overslaat. De fetch-adapter zelf werkt per-venster (module-init) en resolvet creds uit de vault — dat pad is venster-onafhankelijk.
7. **Vensterbeheer-minimum**: sluiten mag gewoon; geen tab-sync tussen vensters bouwen (out of scope). Alt+1..9 blijft hoofdvenster-only.

### Verificatie
- Dev-run: dubbelklik mail → nieuw venster met alleen de mail (geen sidebar/tabbar), body + bijlagen laden; dubbelklik conversatie in Messenger → idem.
- Popout openen terwijl kluis vergrendeld is in hoofdvenster → popout toont lock (correct); na unlock in hoofdvenster → nieuwe popout unlockt stil.
- Hoofdvenster sluiten met popout open: app-gedrag bepalen (Tauri sluit het proces pas als álle vensters dicht zijn; tray-behaviour r.138–177 checken — "verberg naar tray" mag popouts niet wezen).
- `cargo check` + `tsc -b` + release-build op Windows (dit is niet in dev-mode alleen te bewijzen: WebView2-vensters in productie meetesten).

**Omvang:** L–XL. **Afhankelijkheid:** desktop-release-cyclus. **Open beslissing → Piet:** alleen mail/messenger-popouts (advies), of ook generiek "open pagina in nieuw venster" in het menu?

---

## Punt 3 — Medewerkers zien geen NAS-instellingen (bijlages + projectmappen)

### Feiten
- Een medewerker ziet in Settings alleen **general / modules (Integraties) / email-accounts** ([Settings.tsx](../../packages/frontend/src/pages/Settings.tsx) r.326–337); alle NAS-config zit in `ProjectSettingsPanel` (r.1564 → `NasSettingsSection`) op de **employer-only** tab `project-settings` (guards r.330–336/502).
- `NasSettingsSection` heeft drie delen ([NasSettingsSection.tsx](../../packages/frontend/src/components/NasSettingsSection.tsx)): (1) **per-bedrijf mappen** — device-lokale FSA-handles (web, r.213–281); (2) **gedeelde template-velden** (`nas-attachment-template`, server-synced); (3) **projectmappen-config** (`nas-project-folders`, server-synced; desktop-only "Bladeren"-knoppen r.345/382).
- Werkende workaround voor medewerkers: "NAS-map kiezen" inline in [SaveToNasDialog.tsx](../../packages/frontend/src/components/SaveToNasDialog.tsx) r.87–88/243–270.
- Desktop gebruikt **gedeelde string-paden** (UNC) uit `nas-project-folders` — géén FSA-handles; de ProjectDetail-knoppen zijn `isDesktopApp()`-gated maar niet rol-gated ([Projects.tsx](../../packages/frontend/src/pages/Projects.tsx) r.638/648) en hydrateren hun config via de server, dus die werken voor medewerkers al — mits de paden op hún machine kloppen.

### Ontwerp: splits op **device-lokaal vs gedeeld**, niet op rol
De werkgever blijft eigenaar van het gedeelde beleid (template, submap, doelroot). De medewerker krijgt een eigen sectie voor wat per apparaat is.

### Implementatie
1. **`NasSettingsSection` opsplitsen** in twee componenten (verbatim-move van de bestaande JSX, patroon zoals `components/mail/*`):
   - `components/nas/NasDeviceSection.tsx` — deel (1): per-bedrijf map koppelen/status/vernieuwen (web = FSA-handles via `nasStorage.ts`; alleen tonen bij `isFsaSupported`). Plus — nieuw, klein — **desktop-variant**: per-device pad-override voor `masterPath`/`targetRoot` (localStorage `y-app-nas-override-{instanceId}`, géén `pref_`-prefix zodat het niet synct), voor machines waar de UNC/schijfletter afwijkt. `loadProjectFoldersConfig` resolvet: override ?? shared.
   - `components/nas/NasSharedSection.tsx` — delen (2)+(3): de gedeelde velden, ongewijzigd.
2. **Zichtbaarheid**: `NasSharedSection` blijft op de employer-only `project-settings`-tab; `NasDeviceSection` komt óók op de **general-tab** (die iedereen ziet), onder een kop "NAS-koppeling (dit apparaat)". Employer ziet 'm dus op twee plekken — dat is oké (zelfde component, zelfde state).
3. **SaveToNasDialog** blijft zoals hij is (inline kiezen als vangnet); voeg een regel "Beheer in Instellingen → NAS-koppeling" toe als de handle ontbreekt.
4. i18n: nieuwe keys in nl/en/de (zelfde commit).
5. Geen serverwerk: alle shared keys bestaan; device-deel is bewust lokaal (threat-model-comment in nasStorage.ts r.7–9 respecteren — handles/paden nooit naar de server).

### Verificatie
- Als medewerker (viewMode employee, of test-account): Settings → general → NAS-koppeling zichtbaar; map koppelen per bedrijf; daarna bijlage opslaan via SaveToNasDialog zonder inline picker.
- Als werkgever: project-settings-tab ongewijzigd volledig.
- Desktop: override-pad zetten → "Maak NAS-mappen aan" gebruikt het override-pad; override leeg → shared pad.
- `tsc -b`, `vite build`, bestaande tests groen.

**Omvang:** S–M. **Risico:** laag (visibility + verbatim component-splits).

---

## Punt 4 — Geen notificaties bij nieuwe berichten/e-mail

### Feiten
- **Web:** realtime events bestaan (IMAP IDLE → `/ws/events` → [BackgroundSyncProvider.tsx](../../packages/frontend/src/lib/BackgroundSyncProvider.tsx)); browser-`Notification` wordt al gebruikt, maar **alleen in Messenger** (Messenger.tsx r.523–527 permission; r.713–722/905–913 fire met `document.visibilityState !== "visible"`-guard en `tag`-dedup; **geen onclick-handler**). Voor mail: alleen sidebar-badges.
- **Desktop:** `BackgroundSyncProvider` wordt **niet gemount** (alleen in web `App.tsx`); er is géén `/ws/events`, géén Rust IMAP IDLE, géén polling. `tauri-plugin-notification` is geregistreerd (Cargo.toml r.18, lib.rs r.27, capability `notification:default`) en `@tauri-apps/plugin-notification@^2.2.0` staat in package.json — **maar wordt nergens aangeroepen**.
- `GET /api/mail/unseen-summary` levert per-folder `{path, unseen}` + totaal (server index.ts r.1172–1190; desktop-adapter spiegelt 'm) — **snapshot, geen delta**; delta = client-side diffen van opeenvolgende snapshots.

### Implementatie — web eerst (M), dan desktop (M)

**4a. Web: mail-notificaties in BackgroundSyncProvider**
1. Nieuw `lib/notify.ts`: `notifyNewMail({from, subject, count})` — permission-flow (`Notification.requestPermission` bij eerste gebruik, zelfde patroon als Messenger), guard `document.visibilityState !== "visible"`, `tag: "y-app-mail"` (vervangt vorige), en **wél een `onclick`**: `window.focus()` + navigate `/webmail` (via een CustomEvent die App/router oppakt, of `location.assign`).
2. In `pollMailOnce` en de `mail-changed`-push-handler: hou het vorige INBOX-unseen-snapshot per account in een module-Map; als nieuw > oud → haal de nieuwste INBOX-message (page 1, bestaat al als lichte call) voor afzender/onderwerp → `notifyNewMail`. Diff op de per-folder-shape van `unseen-summary`, gefilterd met `shouldCountForBadge` (nu in `lib/mail-badge.ts`).
3. Messenger-notificaties: bestaande code laten, alleen de ontbrekende `onclick` toevoegen (focus + navigate naar de conversatie) — kleine pariteits-fix.
4. **Instelling** (aan/uit, en "ook gedeelde mailboxen?" — open vraag Piet): localStorage `pref_…_mail_notifications` per device, toggle op Settings → general naast de NAS-sectie van punt 3.

**4b. Desktop: polling + native notificaties**
1. Mount een **desktop-variant achtergrondloop** in `DesktopApp.tsx` (state `ready`): elke 90–120 s (focused; 5 min blurred — `document.hasFocus()`), `fetch("/api/mail/unseen-summary")` via de bestaande adapter → zelfde delta-logica als 4a (deel de delta-helper via `lib/`).
2. Notificatie via **`sendNotification` uit `@tauri-apps/plugin-notification`** wanneer `isDesktopApp()` — anders web-`Notification`. Abstractie in hetzelfde `lib/notify.ts` (één callsite, twee backends). Rust-kant staat al klaar; niets aan capabilities te doen (`notification:default` dekt het).
3. Klik-gedrag desktop: het plugin-API heeft beperkte click-events; minimum = venster tonen/focussen bij klik als de plugin-versie het ondersteunt, anders alleen de melding (accepteren, noteren).
4. Badge-updates desktop: dezelfde loop mag `setBadgeCount` voeden zodat de sidebar-badge ook zonder open Webmail bijloopt.
5. **Niet doen:** Rust IMAP IDLE bouwen in deze slice (echte push op desktop) — dat is een eigen project; polling is de 80%-oplossing. Noteer als vervolg.

### Verificatie
- Web: tweede account/telefoon stuurt mail → binnen seconden (push) notificatie met afzender/onderwerp als de tab niet focused is; klik → tab focust + webmail opent. Toggle uit → geen notificatie.
- Desktop: zelfde test → native Windows-toast binnen het poll-interval; badge loopt bij zonder Webmail open.
- Regressie: poll-throttles respecteren (CLAUDE.md "Request-storm & IMAP-rate-limit preventie") — de desktop-loop is nieuw verkeer richting IMAP: interval ≥ 90 s en alleen `unseen-summary` (folders-only, geen bodies).

**Omvang:** 4a = M, 4b = M. **Open vragen → Piet:** ook voor gedeelde mailboxen? Geluid erbij (er is al een send-sound-patroon)?

---

## Gedeelde verificatie & spelregels (alle vier de punten)

```powershell
# frontend
cd packages\frontend
node .\node_modules\typescript\bin\tsc -b          # exit 0
node .\node_modules\vite\bin\vite.js build          # exit 0
npm test                                            # node --test, 20+ groen
# desktop (Rust)
cd ..\desktop\src-tauri
cargo check                                         # lokale toolchain aanwezig
# desktop (app-run)
cd ..\..\.. ; npm run tauri:dev                     # of test-build workflow voor een echte .exe
```
- **Z:-schijf:** geen `npm install` (workspace-symlink faalt); nooit naast draaiende vite. Nieuwe npm-deps zijn voor deze punten niet nodig (plugin-notification zit er al in).
- **Capability-wijzigingen** (punt 2) zijn security-oppervlak: minimaal houden, per window-label, en in de PR-tekst benoemen.
- **`DESKTOP_CONFIG_KEYS`**: als er nieuwe shared instance-settings bijkomen (punt 3 heeft ze niet nodig), beide lijsten (server `index.ts` + Rust `commands.rs`) bijwerken.
- i18n nl/en/de in dezelfde commit als de UI-strings.
- Volgorde-advies: **1 → 3 → 4a → 4b → 2** (oplopend risico; punt 2 als laatste, eigen PR + release-test).
