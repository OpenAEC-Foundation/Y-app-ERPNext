# Implementatieplan — punten uit OPMERKINGEN.md

> **Update 2026-07-03:** punten **1, 2, 3 en 4** zijn na verduidelijking van Piet (punt 1+2 betreffen de **Windows/Tauri-app**, niet de browser) volledig uitgewerkt tot een implementatie-handoff: **[`2026-07-03-desktop-vier-punten-handoff.md`](./2026-07-03-desktop-vier-punten-handoff.md)** — met oorzaakanalyse (o.a. Tauri `dragDropEnabled`-default die HTML5-DnD op Windows blokkeert), concrete stappen, capability-wijzigingen en verificatierecepten. De secties hieronder voor 1–4 zijn de eerdere, globalere versie.

> Per punt: wat er vandaag al is (geverifieerd in de code), wat er ontbreekt, de voorgestelde aanpak, omvang en open vragen. Regelverwijzingen gelden bij commit `8667e23`. Bron: `OPMERKINGEN.md` (repo-root, Piet's inbox — daar laten staan tot een punt af is).
>
> Omvang-schaal: **S** = < 1 dagdeel · **M** = 1–2 dagdelen · **L** = meerdere dagen · **XL** = project/meerdere sessies.

## Prioriteits-advies (samengevat)

| # | Punt | Omvang | Advies |
|---|------|--------|--------|
| 4 | Notificaties nieuwe mail/berichten | **M** | **Eerst** — grootste dagelijkse waarde, infra ligt er al half |
| 3 | NAS-instellingen zichtbaar voor medewerkers | **S** | **Quick win** — vrijwel alleen een visibility-wijziging |
| 8 | Mail archiveren | **S–M** | Quick win: Archiveer-knop werkt nu niet (disabled placeholder) |
| 1 | Mails verslepen (cross-account) | **M** | Na vraag: wat mist er precies? (zie open vraag) |
| 5 | Km- + urenlijsten in één keer aanmaken | **M–L** | Beslissing over cron nodig vóór bouw (zie risico) |
| 9 | Verkenner in Documenten-tab (lokaal + NextCloud) | **L** | Goede tweede golf; NextCloud-kant bestaat al grotendeels |
| 6 | Mappingtable custom parameters | **L** | Samen met #7; randvoorwaarde voor ERPNext carve-out |
| 7 | Alle custom-fields-aanpassingen | **L** | = de invulling van #6; één traject |
| 10 | Uitleg per module | **M–L** | Kan incrementeel; Wiki-infra bestaat al |
| 2 | Meerdere tabs en vensters (desktop) | **XL** | Grootste brok; hangt op Tauri multi-window + vault-handoff |

---

## 1. Mails verslepen

**Is er al:** mail-rijen zijn `draggable` (uid + multi-select uids in `dataTransfer`, [Webmail.tsx](../../packages/frontend/src/pages/Webmail.tsx) ~r.3096); droppen kan op elke map in de boom, favorieten én map-zoekresultaten ([FolderTree.tsx](../../packages/frontend/src/components/mail/FolderTree.tsx)); drop op projectmap koppelt automatisch aan het project.

**Mist:** (a) droppen op een **ander account-tabblad** (tab-drag is nu alleen account-herordening); (b) cross-account verplaatsen kan alleen via het Verplaatsen-menu, expliciet **niet bulk**; (c) droppen op een project(kaart) buiten de mappenboom.

**Aanpak (aanname: a+b bedoeld):**
1. Drop-target op de account-tabs in Webmail: `onDragOver/onDrop` die `text/x-mail-uids` accepteert → `handleMoveMsgCrossAccount` per uid (met één voortgangs-toast).
2. Bulk-ondersteuning in `handleMoveMsgCrossAccount` (server-endpoint `/api/mail/move-cross-account` accepteert nu één uid; uitbreiden naar `uids[]` of client-side serieel met nette fout-afhandeling).
3. Doel-mapkeuze bij tab-drop: default INBOX van het doelaccount; optioneel dropdown-vraag.

**Omvang:** M. **Open vraag → Piet:** klopt de interpretatie (verslepen tussen mailboxen/accounts)? Of gaat het om iets anders (bv. verslepen naar de NAS/een project)?

## 2. Meerdere tabs en vensters

**Is er al (web):** popout-routes `/mail/view` en `/messenger/view` + `?standalone=1`-modus; werkt met `window.open`.

**Mist (desktop/Tauri):** één webview — `window.open` navigeert het enige venster wég; dubbelklik opent daarom bewust in het leespaneel. STATUS-backlog: "Popouts op desktop (Tauri multi-window), hangt af van de auto-unlock".

**Aanpak:**
1. Tauri `WebviewWindow`-API: nieuw venster met url `/mail/view?...` (zelfde bundel).
2. **Vault-handoff**: het tweede venster moet de ontgrendelde Stronghold-sessie van het hoofdvenster kunnen gebruiken zonder opnieuw wachtwoord te vragen — state deling via het Rust-backend (de `DashMap`-sessies zijn proces-breed, dus in principe al gedeeld; de frontend-`unlocked`-state moet via een `invoke` bij venster-start gecheckt worden i.p.v. het unlock-scherm te tonen).
3. Dubbelklik-handler op desktop: `new WebviewWindow(...)` i.p.v. in-pane openen.
4. Zelfde voor messenger-conversaties.

**Omvang:** XL (nieuw venster-lifecyclebeheer, per-OS testen, release-build). **Afhankelijkheid:** desktop-release-flow moet draaien. **Advies:** apart project, niet combineren met andere punten.

## 3. NAS-instellingen voor medewerkers

**Is er al:** alle NAS-config (bijlage-template + projectmappen) zit in `ProjectSettingsPanel` → Settings-tab "project-settings", en die tab is **employer-only** (`viewMode === "employer"`-guards in [Settings.tsx](../../packages/frontend/src/pages/Settings.tsx) ~r.330/502). Medewerkers hebben wél een workaround: "NAS-map kiezen" in de SaveToNasDialog zelf.

**Mist:** een plek waar een medewerker de **device-lokale** NAS-koppeling beheert (FSA-handles per bedrijf; die zijn per apparaat en kunnen dus niet door de werkgever "gepusht" worden).

**Aanpak:** splits het scherm naar visibility i.p.v. per rol:
1. Nieuwe sectie op een medewerker-zichtbare Settings-tab (bv. "Algemeen"): alleen het **device-gebonden** deel van `NasSettingsSection` (map-handles kiezen/vernieuwen per bedrijf, status-indicator). De **shared** velden (template, submap-naam, doelroot) blijven employer-only — dat is bewust cross-device config.
2. Zelfde on desktop (native paden i.p.v. FSA-handles).
3. i18n nl/en/de.

**Omvang:** S. Geen serverwerk (config-keys bestaan al).

## 4. Notificaties bij nieuwe berichten/mail

**Is er al:** realtime events komen al binnen (IMAP IDLE → `/ws/events` → `BackgroundSyncProvider` → sidebar-badges); browser-`Notification` wordt al gebruikt — maar **alleen in Messenger**. Desktop: `tauri-plugin-notification` is geregistreerd + permission staat aan, maar wordt **nergens aangeroepen**.

**Mist:** OS-notificatie (en evt. geluid) bij **nieuwe mail**; op desktop überhaupt elke notificatie.

**Aanpak:**
1. In `BackgroundSyncProvider` bij `mail-changed`-event met nieuwe unseen-mail (de `unseen-summary`-refetch weet de delta): `new Notification(afzender, {body: onderwerp})` — zelfde patroon als Messenger al doet, incl. `requestPermission`-flow en "alleen als tab niet focused".
2. Desktop: kleine adapter — `sendNotification` uit `@tauri-apps/plugin-notification` (dependency toevoegen aan de frontend/desktop-bundle) wanneer `isDesktopApp()`; de Rust-kant staat al klaar.
3. Instelling per gebruiker (aan/uit + alleen-INBOX) in Settings; opslag in localStorage (`pref_…`), device-gebonden is hier juist gewenst.
4. Klik op notificatie → focus tab + open mail (web: `notification.onclick` + `window.focus()`; desktop: window show/focus via Tauri).

**Omvang:** M. **Let op:** niet bouwen op Graph-webhooks (bewust geskipt, zie CLAUDE.md) — IDLE-events zijn de bron.

## 5. Km- en urenlijsten in één keer aanmaken (+ filtering)

**Is er al:** per-medewerker find-or-create: maand-Travel-Request in `QuickKmBooking.tsx`, week-Timesheet in `UrenBoekenWidget.tsx` — beide client-side via generieke `createDocument`. Geen bulk/multi-medewerker-UI.

**Mist:** een werkgever-actie "maak voor alle (gefilterde) medewerkers de km-/urenlijst(en) van periode X aan".

**⚠️ Randvoorwaarde (beslissing Piet, staat ook in het geheugen):** de ERPNext week-cron `create_weekly_timesheet` (ma 01:00) **leeft nog** — een batch ernaast = dubbele weekstaten. De maand-TR-cron is juist kapot (maakt niets meer aan). Dus: cron uitzetten en alles via Y-app, óf batch alleen voor TR's. Eerst kiezen, dan bouwen.

**Aanpak (na die keuze):**
1. Werkgever-paneel (bv. tab in Timesheets of Management dashboard): periode-keuze + medewerker-filter (bedrijf/actief) + preview "bestaat al / wordt aangemaakt".
2. Hergebruik de bestaande find-or-create-logica: extraheer uit `QuickKmBooking`/`UrenBoekenWidget` naar `lib/` (zelfde patroon als de webmail-split) en loop over de medewerkerslijst; idempotent (bestaat = overslaan), rapportage per medewerker.
3. "in y-app filtering": filters op de bestaande lijstweergaven (medewerker/periode/status) waar die nu ontbreken.

**Omvang:** M–L. **Open vraag → Piet:** cron laten of uitzetten; batch per-bedrijf of alle; knop per-medewerker ook?

## 6 + 7. Mappingtable custom parameters / alle custom fields

**Is er al:** Y-app gebruikt ~15 hardcoded `custom_*`-velden (o.a. `custom_customer_reference`, `custom_billing_type`, `custom_distance`, `custom_is_billed`, `custom_subject`, …) verspreid over DataContext/Projects/Expenses/InvoiceModal/SalesInvoices/QuickKmBooking. Er is al een per-instance key-value-mechanisme (`instance_settings`, met precedent `project-template-mapping`) — maar géén veld-mapping.

**Mist:** een **per-instance mappingtabel** die "Y-app-veldrol → daadwerkelijke fieldname op deze ERPNext-instance" vertaalt, zodat Y-app ook werkt op instances zónder de 3BM-customizations (essentieel voor de ERPNext-carve-out en voor nieuwe klanten).

**Aanpak:**
1. Inventarisatie afronden: de lijst hierboven + per veld: verplicht/optioneel, fallback-gedrag als het veld ontbreekt (bv. `custom_billing_type` ontbreekt → verberg facturatie-type-kolom).
2. `lib/field-map.ts`: `field("project.customer_reference")` → resolvet via per-instance mapping (instance_settings-key `field-mapping`, employer-beheerbaar) met de huidige namen als default. Één plek, geen verspreide constanten meer.
3. Settings-tab (employer): mappingtabel-editor — per veldrol een dropdown met de doctype-velden van de instance (op te halen via `/api/resource/DocField` of meta-API) + "test"-knop.
4. Incrementeel migreren per module (Projects eerst, dan Invoicing, dan Km/Uren) — elk z'n eigen PR, zodat het live-testbaar blijft.
5. Desktop: key opnemen in `DESKTOP_CONFIG_KEYS` (beide kanten, zie CLAUDE.md-waarschuwing).

**Omvang:** L (gefaseerd). **Waarom de moeite waard:** ontkoppelt Y-app van de 3BM-instance — directe randvoorwaarde voor de carve-out én voor uitrol bij derden.

## 8. Plug-in: mail archiveren

**Is er al:** de **Archiveren-knop in de webmail-balk is een disabled placeholder zonder onClick** ([Webmail.tsx](../../packages/frontend/src/pages/Webmail.tsx) ~r.2645). Move-to-folder-infra herkent `\Archive`-mappen al; SaveToNasDialog bewaart alleen bijlagen (niet de hele mail).

**Aanpak (twee niveaus, apart opleverbaar):**
1. **Niveau 1 (S):** Archiveren-knop activeren = verplaats naar de `\Archive`-map (of naam-fallback "Archief/Archive"), zelfde pad als `handleMoveMsg`; bulk-variant in de selectie-balk; ster-knop (ernaast, ook placeholder) meteen meenemen via IMAP `\Flagged`.
2. **Niveau 2 (M):** "Archiveer naar NAS/project": hele mail als `.eml` (server heeft de raw source al via `BODY.PEEK[]`; endpoint `GET /api/mail/raw?folder&uid` toevoegen) + bijlagen naar de projectmap — hergebruik SaveToNasDialog-flow en de projectmap-voorspeller. Aansluiten op de bestaande "Sorteer in projectmap"-bouwstenen.

**Open vraag → Piet:** bedoel je niveau 1 (knop werkend), niveau 2 (naar NAS/project), of ERPNext-Communication-archivering?

## 9. Verkenner in de Documenten-tab (lokaal + NextCloud)

**Is er al:** `NextCloudFiles.tsx` = werkende NextCloud-browser (boom, breadcrumbs, upload, download) + "Local Links" (lokale paden als `file:///`-links). Web-NAS via FSA-handles (`nasStorage.ts`, Chrome/Edge); desktop heeft alleen `shell:open` (geen fs/dialog-plugin).

**Mist:** échte lokale bestandsnavigatie (mappen browsen, niet alleen links), preview, en één gecombineerde verkenner-UX.

**Aanpak:**
1. **Web:** FSA-gebaseerde local-browser als tweede bron naast NextCloud in dezelfde tab: mapkiezer (`showDirectoryPicker`, handle persist in IDB — infra bestaat in `nasStorage.ts`), lijst/boom-weergave, download/open. Beperking accepteren: Chrome/Edge-only (zelfde als NAS-feature).
2. **Desktop:** `tauri-plugin-fs` + `dialog` toevoegen → native browsen zonder FSA-limieten; "Open in Verkenner" bestaat al als escape-hatch.
3. **Preview (optioneel, later):** pdf/img inline via bestaande blob-viewer-patronen uit webmail.
4. UI: bron-switcher (NextCloud | Lokaal | per-bedrijf NAS) boven de bestaande boom — hergebruik de NextCloudFiles-lijstcomponent.

**Omvang:** L. **Let op (desktop):** fs-plugin = capability-uitbreiding → security-review van de scope (geen `**`-allow op hele schijf).

## 10. Uitleg per module

**Is er al:** `Wiki.tsx` (ERPNext "Wiki Page"-doctype, markdown, routes) en per-extensie beschrijvingen in de catalog. Geen help/tour/tooltip-infra.

**Aanpak (incrementeel, licht beginnen):**
1. **Per-module helppagina in de Wiki** met vaste route-conventie `wiki/help-<module>` (uren, km, facturatie, mail, projecten, …): wat doet de module, welke ERPNext-configuratie is nodig (incl. welke custom fields — koppelt aan #6/#7!), veelvoorkomende fouten.
2. **"?"-knop per pagina** (klein icoon in de paginakop) → opent de bijbehorende wiki-route in een zijpaneel of nieuw tabblad. Eén generiek `HelpLink`-componentje.
3. Content schrijven kan gefaseerd; begin met de modules waar medewerkers nu vastlopen (uren/km/mail).

**Omvang:** M (infra S; content is het echte werk — deels door Piet/3BM zelf te schrijven).

---

## Voorgestelde uitvoeringsvolgorde

1. **Golf 1 (quick wins, 1 sessie):** #3 NAS-instellingen medewerkers · #8 niveau 1 (Archiveer/ster-knop werkend) · #4 notificaties (web eerst, desktop erachteraan).
2. **Golf 2:** #1 mails verslepen cross-account (na antwoord op de open vraag) · #5 batch km/uren (na cron-beslissing) · #10 help-infra + eerste 3 module-pagina's.
3. **Golf 3 (projecten):** #6+#7 field-mapping (gefaseerd per module) · #9 verkenner · #8 niveau 2 (mail→NAS-archief).
4. **Apart traject:** #2 desktop multi-window (samen met de geplande in-app updater in één desktop-release-cyclus).

## Open vragen voor Piet (blokkeren alleen hun eigen punt)

1. **#1:** wat bedoel je precies met "mails verslepen" — tussen accounts/mailboxen? (verslepen naar mappen/favorieten/projectmappen werkt al)
2. **#5:** ERPNext week-cron `create_weekly_timesheet` laten draaien of uitzetten? Batch voor alle medewerkers of per bedrijf?
3. **#8:** archiveren = knop werkend (IMAP-archiefmap), of hele mail naar NAS/project, of beide?
4. **#4:** notificaties ook voor gedeelde mailboxen, of alleen de primaire?
