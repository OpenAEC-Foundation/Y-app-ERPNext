# Ontwerp: desktop-app haalt centrale config van de server (offline-capabel)

**Datum:** 2026-06-28
**Status:** Goedgekeurd ontwerp — wacht op implementatieplan
**Herkomst:** Piet's bevinding bij het testen van de desktop-build: medewerker-/project-instellingen en module-zichtbaarheid komen niet uit de centrale config; mailaccounts ook niet. Beslissing: desktop moet een **volledige web-equivalent** worden én **offline** kunnen draaien.

## Context

De desktop/Tauri-app is standalone gebouwd: eigen Stronghold-kluis + eigen lokale SQLite-config-store, praat direct met ERPNext, gebruikt **niet** de Y-app-server. De werkgever configureert echter alles op de Y-app-server (`instance_settings`). Daardoor zijn op een verse desktop-installatie de medewerker-/project-instellingen leeg en klopt de module-zichtbaarheid niet.

**Model (Piet, 2026-06-28):** de desktop **probeert** bij gebruik de config van de server te halen → **gelukt**: lokaal cachen + gebruiken → **geen verbinding**: de lokale cache gebruiken (offline-capabel). Zie [[project_desktop_central_config]].

**Gekozen richting (Optie A):** de Y-app-server blijft de bron van de gedeelde config (geen migratie, web ongemoeid, **respecteert de ERPNext-carve-out** — geen custom doctype). De desktop synct naar z'n bestaande lokale store en leest altijd lokaal.

## Scope

**In scope:**
1. **Sync van de niet-geheime, werkgever-gedeelde config** (Y-app-server → desktop lokale cache).
2. **Mailconfig resolven uit ERPNext** (Email Account-doctype) voor **password-accounts**, zodat de desktop mailaccounts auto-configureert i.p.v. handmatig.
3. **Offline-gedrag**: geen verbinding → lokale cache; lokaal instelbaar blijft mogelijk.

**Out of scope (expliciet):**
- **OAuth-mailaccounts** (O365 `connected_app`) — worden niet gebruikt.
- **Versleutelde mailcreds uit de Y-app-kluis** synchroniseren (cross-vault) — niet doen; mailaccounts blijven lokaal in de desktop-kluis, behalve de ERPNext-resolve hierboven.
- **Pure Y-app-vault-mailaccounts** (alleen in Y-app's kluis, niet in ERPNext) — geen veilige pull; lokaal instellen.
- Per-device/per-user prefs (favoriete/verborgen mappen, email-project-links) — blijven lokaal, niet syncen.
- Volledige offline-replicatie van álle ERPNext-data — dit gaat alleen over config/settings + mailconfig.
- De NAS-projectmappen-feature zelf (apart spec/plan, 2026-06-27).

**Gerelateerd (al gedaan, v0.28.2-kandidaat):** de `/api/auth/me`-rollen-fix in de desktop-adapter — die herstelt de werkgever-rollen → `accessiblePages`. De module-config-kant (`employee-visible-modules`) wordt door component 1 hieronder gedekt.

## Synced keys (component 1)

Alleen werkgever-gedeelde, niet-geheime keys uit `instance_settings`:
`activity-types`, `employee-activity-types`, `employee-visible-modules`, `project-template-mapping`, `nas-attachment-template`, `nas-project-folders`, `enabled-extensions`.

Niet syncen (blijven lokaal/per-device): `mail-favorite-folders`, `mail-hidden-folders`, `email-project-links`, mailaccounts.

## Architectuur & componenten

### Component 1 — Y-app-server: nieuw read-endpoint
`GET /api/desktop-config?erpnextUrl=<url>` (in de auth-whitelist; doet eigen auth):
- **Auth**: de desktop bewijst ERPNext-toegang door een **ERPNext-sessie-id (sid)** mee te sturen (header). De server verifieert dat tegen díe ERPNext (`<erpnextUrl>/api/method/frappe.auth.get_logged_user`) → bewijst dat de aanvrager legitiem bij die ERPNext-instance kan. Geen Y-app-account, geen wachtwoord. Lage lat want de data is niet-geheim. **NB:** als de desktop normaal met API-key/secret werkt (geen sessie-sid), logt 'ie hiervoor kort in op ERPNext om een sid te verkrijgen — in het plan te bevestigen.
- **Resolutie**: server geeft de bundel van de synced keys terug voor de instance(s) die matchen op `erpnextUrl`, via het **bestaande URL-match-mechanisme** (`shared-settings`, werkgever→werknemer). Hergebruik; geen nieuwe resolutie-logica.
- **Respons**: `{ "activity-types": <value>, "project-template-mapping": <value>, ... }` (alleen aanwezige keys).

### Component 2 — Desktop: sync-laag
- Nieuw Rust-commando (bv. `sync_instance_config(instanceId)`): haalt de ERPNext-sessie voor de instance (bestaat al in `erpnext.rs`), roept `https://y-app.impertio.app/api/desktop-config?erpnextUrl=<url>` met de sid, en schrijft elke teruggegeven key naar de lokale `instance_settings`-store (`put_instance_setting`).
- **Trigger** vanuit de frontend (desktop-adapter / DesktopApp): bij app-start en bij instance-switch, **alleen online**.
- **Leespad ongewijzigd**: de bestaande `get_instance_settings` (lokaal) blijft de bron voor Sidebar/Settings → automatisch offline-capabel.
- **Offline**: fetch faalt (geen verbinding / geen ERPNext-sessie) → sync overslaan, lokale cache blijft staan. Stil, geen UI-fout.

### Component 3 — Desktop: mailconfig uit ERPNext (password-accounts)
- Bij het resolven van mailcreds (wanneer er geen lokale config is) leest de desktop de **ERPNext "Email Account"-doctype** voor het adres — host/poort/SSL + wachtwoord via `get_password` — net als de web-fallback (`mailAutoConfigInternal`). De desktop heeft al ERPNext-toegang.
- **Alleen password-accounts**: als `connected_app` gezet is (OAuth) → overslaan (out of scope).
- **Veiligheid**: het wachtwoord uit ERPNext lezen valt binnen de **bestaande ERPNext-vertrouwensgrens** van de desktop-gebruiker (die heeft die toegang al); de versleutelde Y-app-kluis wordt niet aangeraakt.

## Data flow
```
desktop start / instance-switch
   → online?  ── nee ──→ lokale instance_settings-cache (offline)
       │ ja
       ▼
   sync_instance_config: ERPNext-sid → GET /api/desktop-config (Y-app-server)
       → server verifieert sid bij ERPNext + URL-match → bundel keys
       → put_instance_setting (lokaal)
   Sidebar/Settings lezen lokaal (zelfde als nu)

mail openen → lokale mailconfig? ── nee ──→ resolve uit ERPNext Email Account (password) → gebruik + (optioneel) lokaal cachen
```

## Foutafhandeling / offline
- Geen verbinding, server onbereikbaar, of geen geldige ERPNext-sessie → sync stil overslaan; lokale cache (laatste sync of handmatig ingesteld) blijft leidend.
- Server: ongeldige/ontbrekende ERPNext-sid → 401, geen config teruggeven.
- Mail: geen ERPNext Email Account of OAuth-account → val terug op lokale mailconfig (handmatig).

## Testen
- **Server-endpoint (unit)**: ongeldige sid → 401; geldige sid + URL-match → juiste keys-bundel; ontbrekende keys → niet in respons.
- **Desktop-sync**: online → lokale store gevuld met server-keys; daarna netwerk uit → waarden blijven (offline); server-key gewijzigd → na volgende sync overschreven.
- **Mailconfig**: password-account in ERPNext → desktop resolvet host/poort/wachtwoord en kan IMAP openen; OAuth-account → overgeslagen (lokale fallback); account niet in ERPNext → lokale fallback.
- **End-to-end (desktop-build)**: werkgever ziet medewerker-/project-instellingen + alle modules; netwerk uit → blijft werken; password-mailaccount uit ERPNext werkt zonder handmatige invoer.

## Security-noot
De gesynchroniseerde config is **niet-geheim** (activity types, sjablonen, module-zichtbaarheid). De ERPNext-sid-verificatie voorkomt dat willekeurige clients de config van een instance trekken. Mailwachtwoorden komen uit ERPNext binnen de bestaande gebruikers-toegang, niet uit de Y-app-kluis (die het twee-sleutel-threat-model in [crypto.ts](packages/server/src/crypto.ts) bewaart). Geen credentials in de gesynchroniseerde bundel.
