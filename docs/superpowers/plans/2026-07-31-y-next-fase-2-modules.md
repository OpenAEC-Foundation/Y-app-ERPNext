# Y-next fase 2 — modules op ERPNext-only: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Webmail op ERPNext `Communication`, vergadernotities en extensie-opslag op custom DocTypes, en release notes — alles zonder eigen server.

**Architecture:** Eén data-adapter (`lib/mail-erpnext.ts`) vertaalt Communication-semantiek naar de berichtvormen die de bestaande Webmail-UI kent; virtuele mappen vervangen IMAP-mappen. Custom DocTypes (`Y Meeting Note`, `Y Next Setting`) worden idempotent via de REST-API geprovisioned. Capabilities-blocklist krimpt; IMAP-gebonden UI blijft achter de bestaande featuregates.

**Tech Stack:** React 19, TypeScript, Vite (rolldown), Frappe/ERPNext v16 REST, node:test, playwright-core headless-verificatie.

**Spec:** `docs/superpowers/specs/2026-07-31-y-next-fase-2-modules-design.md` — lees die eerst; de acceptatiecriteria daar zijn bindend.

## Global Constraints

- Repo `C:\Users\rickd\Documents\GitHub\Y-app-ERPNext`, branch `codex/y-next-architecture`.
- Geen Express-only endpoints op actieve schermen; nieuwe feature-key `erpnext-mail` (true) naast `webmail` (blijft false, IMAP-brug).
- Geen secrets in code/Git/bundel; token alleen via `YNEXT_API_TOKEN`-env (scratchpad-bestand van de controller).
- i18n: nieuwe keys altijd in nl/en/de in dezelfde commit (locale-parity-test).
- Sandbox/postMessage-model van extensies NIET wijzigen (CLAUDE.md threat model).
- Verboden in repo-content: chatgeschiedenis, namen van externe rekensoftware.
- Verificatie per taak: `npx tsc -b packages/frontend`, `npm run test -w @y-app/frontend`, `npm run build`.
- Alleen de controller deployt en draait provisioning tegen de live site.

---

### Task M1: Provisioning-script voor custom DocTypes

**Files:**
- Create: `scripts/provision-y-next.mjs`
- Create: `scripts/provision-y-next.test.mjs`

**Interfaces:**
- Produces: `requiredEnv(env)` (hergebruik patroon uit deploy-y-next.mjs), `buildMeetingNoteDoctype(): object`, `buildSettingDoctype(): object`, `provision({baseUrl, token}): Promise<{created: string[], existing: string[]}>`
- DocType-definities (velden exact):
  - `Y Meeting Note`: module "Custom", custom 1, naming autoname `format:YMN-{YYYY}-{#####}`, fields: `title` Data reqd, `meeting_date` Date, `project` Link→Project, `participants` Long Text, `action_points` Long Text, `notes` Text Editor, `linked_doctype` Data, `linked_name` Data; permissions: System Manager + All (read/write/create/delete via role "All" rw op eigen records is niet nodig — geef "Projects User" read/write/create/delete).
  - `Y Next Setting`: module "Custom", custom 1, autoname `field:setting_key`, fields: `setting_key` Data reqd unique, `setting_value` Long Text; permissions: role "All" read + "Projects User" write/create.

- [ ] Schrijf failing tests: `requiredEnv` weigert lege env; `buildMeetingNoteDoctype()` bevat de veldenlijst hierboven; `provision` slaat bestaande DocTypes over (mock fetch: GET DocType 200 → geen POST).
- [ ] `node --test scripts/provision-y-next.test.mjs` → FAIL (module ontbreekt).
- [ ] Implementeer: GET `/api/resource/DocType/<naam>` → 200 = existing; 404 → POST `/api/resource/DocType` met de definitie. Log alleen namen/statussen, nooit de token.
- [ ] Tests groen; commit `feat: provisioning voor Y-next custom doctypes`.

---

### Task M2: Mail-adapter op Communication

**Files:**
- Create: `packages/frontend/src/lib/mail-erpnext.ts`
- Create: `packages/frontend/src/lib/mail-erpnext.test.ts`
- Modify: `packages/frontend/src/lib/capabilities.ts` (+ feature-key `erpnext-mail` → true; `webmail` blijft false)
- Modify: `packages/frontend/src/lib/capabilities.test.ts`

**Interfaces (Produces — exact, Task M3 bouwt hierop):**
```ts
export interface ErpMailMessage {
  name: string;            // Communication docname (vervangt uid)
  subject: string;
  sender: string;          // e-mailadres
  senderName: string;      // sender_full_name
  recipients: string;
  cc?: string;
  date: string;            // communication_date
  seen: boolean;
  folder: string;          // virtuele map-id waarin opgehaald
  hasAttachments: boolean;
  inReplyTo?: string;
  reference?: { doctype: string; name: string };
}
export interface ErpMailFolder { id: string; label: string; unseen: number; kind: "inbox"|"sent"|"unread"|"project"; project?: string }
export function listVirtualFolders(): Promise<ErpMailFolder[]>;
export function listMailboxMessages(folderId: string, opts?: { limit?: number; start?: number; search?: string }): Promise<ErpMailMessage[]>;
export function getMessageBody(name: string): Promise<{ html: string; attachments: { file_url: string; file_name: string }[] }>;
export function markRead(name: string): Promise<void>;
export function markUnread(name: string): Promise<void>;
export function sendMail(input: { to: string; cc?: string; bcc?: string; subject: string; html: string; attachments?: File[]; inReplyTo?: string; reference?: { doctype: string; name: string } }): Promise<{ name: string }>;
export function linkToDocument(name: string, doctype: string, docname: string): Promise<void>;
export function unseenCount(): Promise<number>;
export function hasEnabledEmailAccount(): Promise<boolean>; // Email Account met enable_incoming=1
```
- Datasemantiek: zie spec §1. `sendMail` uploadt bijlagen eerst via `uploadFile(..., isPrivate=true)` en geeft File-docnames door aan `frappe.core.doctype.communication.email.make` (`attachments`), met `doctype/name` als reference en `send_email: 1`.
- Projectmappen: één query `fetchList("Communication", { fields:["reference_name","count(name) ..."] })` is NIET toegestaan (aggregates 417) — haal per uniek `reference_name` (doctype=Project, max 50 recentste) de count via `fetchCount`.

- [ ] Failing tests met gemockte fetch voor: foldermapping Inbox/Sent-filters, `markRead` PUT `seen:1`, `sendMail` POST naar `communication.email.make` met attachments-namen, `hasEnabledEmailAccount` false bij `enable_incoming=0`.
- [ ] Tests → FAIL; implementeer; tests groen; `tsc`; commit `feat: mail-adapter op ERPNext Communication`.

---

### Task M3: Webmail-UI op de adapter

**Files:**
- Modify: `packages/frontend/src/pages/Webmail.tsx` (datalaag), `packages/frontend/src/pages/MailView.tsx` (popout)
- Modify: `packages/frontend/src/components/Sidebar.tsx` (badge via `unseenCount`, Email-item actief bij `erpnext-mail`)
- Modify: `packages/frontend/src/App.tsx` (route-gate `/webmail` op `erpnext-mail`)
- Modify: i18n nl/en/de: `y_next.mail_setup_required` (nl: "E-mail is nog niet geactiveerd op deze ERPNext-site. Zet bij Instellingen → Email Account 'Enable Incoming' en 'Enable Outgoing' aan met de inloggegevens van de mailbox."), `y_next.mail_direct_note`
- Capabilities: `/webmail` uit de blocklist.

**Interfaces:** Consumes alles uit M2 exact zoals gedeclareerd.

- [ ] Vervang in Webmail.tsx de `/api/mail/*`-datalaag door adapter-calls. FolderTree rendert `listVirtualFolders()` (projectmappen onder een "Projecten"-sectie). Lijst → `listMailboxMessages`; openen → `getMessageBody` + optimistic `markRead`; compose/reply/forward → `sendMail` (reply prefixt Re:, zet `inReplyTo` op het Communication-name en quote de body zoals de bestaande composer deed); koppelchip → `linkToDocument`. IMAP-only UI (map-CRUD, drag-move, shared mailboxen, cache-chip, warmup) achter `isFeatureEnabled("webmail")` — geen dode knoppen zichtbaar.
- [ ] Instructiekaart: als `hasEnabledEmailAccount()` false → amber kaart met `y_next.mail_setup_required` boven de (lege) lijst; UI blijft bruikbaar.
- [ ] Threading: bij openen, client-side conversatie uit het al opgehaalde lijstvenster via `inReplyTo`-ketting (geen extra endpoints).
- [ ] MailView-popout: zelfde adapter; querystring `?msg=<name>` volstaat (instance/email-params vervallen).
- [ ] Sidebar-badge: poll `unseenCount()` 1×/60s alleen wanneer `erpnext-mail` aan.
- [ ] `tsc` + tests + build groen; commit `feat: webmail draait op ERPNext Communication`.

---

### Task M4: Vergadernotities, extensies-opslag, release notes

**Files:**
- Modify: `packages/frontend/src/pages/MeetingNotes.tsx`
- Modify: `packages/frontend/src/extensions/remote.ts`
- Modify: `packages/frontend/src/lib/capabilities.ts` + test (blocklist: `/meeting-notes`, `/release-notes`, `/x` eruit; feature `extensions` → true)
- Modify: `packages/frontend/src/pages/Settings.tsx` (Extensions-tab weer enabled via `isSettingsTabEnabled`)

**Interfaces:**
- MeetingNotes CRUD: `fetchList/createDocument/updateDocument/deleteDocument("Y Meeting Note", ...)`; participants/action_points JSON-stringified in Long Text.
- remote.ts: `fetchRemoteExtensions()` → `fetchDocument("Y Next Setting", "remote-extensions")` (404 → `[]`); `saveRemoteExtensions(list)` → upsert (`createDocument` bij 404, anders `updateDocument`) met `setting_value: JSON.stringify(list)`. localStorage-cache blijft.

- [ ] MeetingNotes: vervang alle `/api/meetings*` door de resource-CRUD; UI ongewijzigd; lege-staat werkt zonder provisioning (404 doctype → module-onbeschikbaar-melding via `isDoctypeMissing` + `y_next.module_unavailable`).
- [ ] remote.ts omzetten; ExtensionHost/bridge NIET aanraken.
- [ ] Capabilities + Settings-tab + tests bijwerken.
- [ ] `tsc` + tests + build groen; commit `feat: vergadernotities en extensies zonder server`.

---

### Task M5: Integratie — provisioning, deploy, live verificatie (controller)

**Files:** geen nieuwe code; runtime-mutaties op de live site + `docs/deployment.md`-aanvulling.

- [ ] `node scripts/provision-y-next.mjs` (env gezet) → DocTypes aangemaakt/bestaand.
- [ ] Volledige gates; deploy; smoke.
- [ ] Live schrijfproef via API: (a) maak test-Communication (Received, subject `Y-next test <timestamp>`); (b) maak `Y Meeting Note`-testrecord; headless sweep `/webmail`, `/meeting-notes`, `/release-notes` + screenshots — testdata zichtbaar; (c) verwijder beide testrecords.
- [ ] Verstuurproef alleen als een Email Account outgoing enabled is — anders documenteren dat de verstuurproef wacht op activatie.
- [ ] `docs/deployment.md`: sectie "Fase 2" met provisioning-stap + Email-Account-activatie-instructie.
- [ ] Ledger + commit `docs: registreer fase 2 oplevering`.

## Definition of Done

Acceptatiecriteria uit de spec, aantoonbaar via de headless sweep en de
schrijfproeven; alle suites groen; geen Express-calls op actieve schermen;
sandbox-model ongewijzigd.
