# Y-app v0.4.0 Bug Fix Design Spec

**Datum:** 2026-04-13
**Branch:** `fix/build-issues-v040`
**Scope:** 11 bugs (alle 🟢 items uit `docs/y-bugs.md`)

---

## Context

Y-app v0.4.0 heeft 11 bekende bugs die vier gebieden raken: shift/uren data, sidebar/UI, email/IMAP, en messaging. Dit document beschrijft het ontwerp na brainstorming met de product owner.

---

## Groep 1: Shift/uren data (B09, B10, B11)

### B09 — Consolidatie shift hours & activity types

**Probleem:** Shift hours worden op twee manieren bepaald (name-parsing vs Shift Type docs). Activity types komen uit meerdere bronnen zonder duidelijke prioriteit.

**Design:**

#### Shift hours — `lib/shiftHours.ts` (nieuw)

- `calcHoursFromTimes(start: string, end: string): number` — berekent uren uit HH:MM:SS tijden
- `fetchShiftHoursMap(): Promise<ShiftHoursResult>`
  - Haalt `Shift Assignment` (status=Active) op per employee
  - Haalt unieke `Shift Type` docs op
  - Berekent weekelijkse uren uit `start_time`/`end_time`
  - **Geen name-parsing. Geen fallback. Geen `|| 40`.**
  - Return: `{ hoursMap: Record<string, number>, missingEmployees: Set<string> }`
  - `missingEmployees` = employees zonder Shift Assignment of zonder resolvable Shift Type

Werkt met zowel Shift Assignment als Shift Plan Assignment pad — forward-compatible met toekomstig plan om alleen Shift Assignment te gebruiken.

**Consumers:**
- `Vakantieplanning.tsx` — vervangt name-parsing (regel 189-204)
- `Employees.tsx` — vervangt dubbele logica (regel 188-201, 610-680, 790-798)
- Dashboard widgets — missing hours check

**Te verwijderen:**
- `parseHoursFromName()` in Employees.tsx
- `calcHoursFromTimes()` in Employees.tsx (verplaatst naar shared module)
- Shift Plan Assignment name-parsing in Vakantieplanning.tsx
- Alle `|| 40` en `?? 8` fallbacks

#### Activity types — `lib/activityTypes.ts` (nieuw)

- `fetchActivityTypes(viewMode: "employer" | "employee"): Promise<string[]>`
  - **Employer:** alle Activity Types uit ERPNext (voor configuratie in Settings)
  - **Employee:** subset uit `instance_settings` via URL-match bridge; default: `["Execution"]`

**URL-match bridge (server-side):**
- Nieuw endpoint of uitbreiding van `/api/user-settings/:key`
- SQL: zoek `instance_settings` voor instances met dezelfde `erpnext_url`
- Tijdelijke oplossing — later vervangen door organisatie-concept
- Als employer niets heeft ingesteld: employee krijgt alleen `["Execution"]`

**UrenBoekenWidget wijzigingen:**
- Employee: activity type dropdown volledig verborgen
- Activity type wordt automatisch ingesteld (default Execution, of eerste uit employer config)
- Employer: ziet alle types uit ERPNext

### B10 — Warning bij ontbrekende shift hours

**Probleem:** Stille fallback naar 40u/week zonder melding.

**Design:**

#### Warning banner — `components/ShiftHoursWarning.tsx` (nieuw)
- Amber banner (`bg-amber-50`, `border-amber-200`) met AlertTriangle icon
- Toont namen van employees zonder shift toewijzing
- i18n keys: `warnings.shift_hours_missing_title`, `warnings.shift_hours_missing_desc`

#### Tabelmarkering
- Hele rij amber achtergrond voor employees in `missingEmployees`
- Urenkolom: `⚠ —` (waarschuwingsicoon + streepje)
- Alle afgeleide berekeningen geblokkeerd: overuren, verlofsaldo, missing hours tonen ook `—`

#### Scope
- Vakantieplanning.tsx — banner boven tabel + rij markering
- Employees.tsx — banner boven grid + card markering
- Dashboard missing hours widget — skip employees zonder shift data

### B11 — Contract hours op basis van Shift Type data

Opgelost door B09. Vakantieplanning.tsx gebruikt nu `fetchShiftHoursMap()` die echte Shift Type docs ophaalt. Geen name-parsing meer. Shift Plan Assignment fetch voor werkdagen (welke dagen werkt iemand) blijft ongewijzigd — ander doel.

---

## Groep 2: Widget/UI (B02, B08)

### B02 — Sidebar module zichtbaarheid

**Probleem:** `SIDEBAR_MODULES` in `modules.ts` heeft verkeerde section names (8 mismatches) en 18 ontbrekende items. Hierdoor worden pagina's als timesheets en vakantieplanning onzichtbaar.

**Design:**

#### Stap 1: SIDEBAR_MODULES synchroniseren
- Section names in `modules.ts` matchen met Sidebar.tsx definitie
- Alle 18 ontbrekende items toevoegen met juiste section
- `EMPLOYEE_MANAGEABLE_MODULES` in Settings.tsx controleren op consistentie

#### Stap 2: ERPNext allowed_modules als extra filter
- Bij instance switch: naast roles ook `allowed_modules` ophalen uit ERPNext User doc
- Nieuwe stap in de sidebar filterchain (na role-based, voor module-config)
- Niet alle modules mappen 1:1 — mapping tabel nodig
- `ROLE_PAGE_MAP` blijft behouden (optie A)

**Bestanden:** `modules.ts`, `Sidebar.tsx`, `Settings.tsx`, `auth.ts` (server: allowed_modules ophalen)

### B08 — Task dropdown buiten scherm

**Probleem:** WorkflowChanger dropdown in Tasks.tsx staat altijd `bottom-full`, valt buiten beeld bij bovenkant viewport.

**Design:**

#### `lib/useDropdownPosition.ts` (nieuw)
- Input: `triggerRef`, `isOpen`, `preferAbove` (default true)
- Gebruikt `getBoundingClientRect()` om beschikbare ruimte te meten
- Output: `position` ("above" | "below"), `dropdownRef`
- Herbruikbaar voor andere dropdowns

#### Toepassing
- WorkflowChanger in Tasks.tsx: `position === "above" ? "bottom-full mb-1" : "top-full mt-1"`
- Later optioneel toepasbaar op AgentPanel.tsx, Webmail.tsx

---

## Groep 3: Email/IMAP (B06, B07, B04)

### B06 — Mailbox lock timeout & connection errors

**Probleem:** Single IMAP connection per account, geen request queue. Parallelle requests vechten om lock → 15s timeout → connection dood verklaard → cascade failure.

**Design:**

#### AsyncQueue class in `mail.ts`
```
class AsyncQueue {
  private queue: Array<{ fn, resolve, reject }>
  private running = false

  enqueue<T>(fn: () => Promise<T>): Promise<T>
  private drain(): serialiseert operaties
}
```

#### Integratie
- `opQueue` als private field in `MailAccountCache`
- Alle lock-acquiring methods wrappen: `fetchMessages`, `fetchFullMessage`, `preloadBodies`, `deleteMessage`, `moveMessage`, `fetchAttachment`, `markRead`, `markUnread`
- Lock timeout: 15s → 30s (met queue is contention minimaal)
- Retry: max 2 pogingen i.p.v. direct connection dood verklaren
- Health check via IMAP NOOP

### B07 — Collapse-staat e-mail niet onthouden

**Probleem:** `collapsedGroups` in Webmail.tsx is `useState<Set>(new Set())`, nooit gepersist.

**Design:**
- localStorage key: `webmail_collapsed_${instanceId}_${folderName}` (per-folder)
- Init uit localStorage bij mount
- Persist bij toggle in de setter
- `useEffect` op `activeFolder` change: herlaad collapse state
- Zelfde pattern als bestaande folderWidth/listWidth persist

### B04 — Email en Talk re-fetch elke sessie

**Probleem:** Alle caches in-memory, verloren bij page reload.

**Design:**

| Data | Storage | Key | TTL | Strategie |
|------|---------|-----|-----|-----------|
| INBOX message list (headers) | localStorage | `webmail_inbox_cache_${instanceId}` | 5 min | Stale-while-revalidate |
| Folder list + unseen counts | localStorage | `webmail_folders_${instanceId}` | 10 min | Stale-while-revalidate |
| Talk conversation list | localStorage | `messenger_convos_${instanceId}` | 5 min | Stale-while-revalidate |
| Full message bodies | in-memory | (bestaand) | — | Geen wijziging |

Stale-while-revalidate: direct tonen uit cache, background refresh start parallel.
Geen IndexedDB — data is klein genoeg voor localStorage.

---

## Groep 4: Messaging/Talk (B03, B05)

### B03 — "Alle berichten" tab toont Talk niet

**Root cause:** Parameter name mismatch tussen frontend en server.

Frontend `Messenger.tsx` (regel 298-305) stuurt `nc_url`, `nc_user`, `nc_pass`.
Server `messenger.ts` `resolveNcTalkCreds` (regel 53-57) verwacht `url`, `user`, `pass`.

Single-platform `buildQuery` (regel 101-103) stuurt correct `url`, `user`, `pass`.

**Fix:** 3 regels in Messenger.tsx:
```
params.set("nc_url", ncUrl)  →  params.set("url", ncUrl)
params.set("nc_user", ncUser)  →  params.set("user", ncUser)
params.set("nc_pass", ncPass)  →  params.set("pass", ncPass)
```

### B05 — Bestanden en afbeeldingen in Talk niet zichtbaar

**Probleem:** `ncGetMessages()` in messenger.ts extraheert alleen `m.message` (tekst). NextCloud Talk API levert ook `messageParameters.file` met naam, mimetype, size, link.

**Design:**

#### Server — messenger.ts
- `MessageAttachment` interface: `{ id, name, mimetype, size, link, previewUrl? }`
- Parse `m.messageParameters` entries waar `type === "file"`
- Replace `{file}` placeholders in message text met bestandsnaam
- Image preview URL via NextCloud `core/preview?fileId=X&x=400&y=400`

#### Server — proxy endpoint
- Nieuw: `GET /api/messenger/file-proxy?url=X` (registered in index.ts)
- Authenticated file download proxy (Basic Auth met NC credentials)
- Nodig omdat NextCloud preview URLs authenticatie vereisen

#### Frontend — Messenger.tsx
- Extend `Message` interface met `messageType?: string`, `attachments?: MessageAttachment[]`
- Render attachments na message text:
  - Images: `<img>` met preview via proxy, klikbaar voor full-size
  - Andere bestanden: download link met Paperclip icon + bestandsnaam + grootte
- Helper: `formatFileSize(bytes): string`

---

## Implementatievolgorde

1. **B09** → B11 → B10 (shift consolidatie, dan echte data, dan warnings)
2. **B02**, **B08** (onafhankelijk, parallel mogelijk)
3. **B06** → B07 → B04 (IMAP stability eerst, dan UX verbeteringen)
4. **B03**, **B05** (B03 is 3-regel fix, B05 is groter)

---

## Nieuwe bestanden

| Bestand | Doel |
|---------|------|
| `packages/frontend/src/lib/shiftHours.ts` | Shared shift hours utility |
| `packages/frontend/src/lib/activityTypes.ts` | Shared activity types utility |
| `packages/frontend/src/lib/useDropdownPosition.ts` | Reusable dropdown positioning hook |
| `packages/frontend/src/components/ShiftHoursWarning.tsx` | Amber warning banner component |

## Gewijzigde bestanden

| Bestand | Bugs |
|---------|------|
| `packages/frontend/src/pages/Vakantieplanning.tsx` | B09, B10, B11 |
| `packages/frontend/src/pages/Employees.tsx` | B09, B10, B11 |
| `packages/frontend/src/components/UrenBoekenWidget.tsx` | B09 |
| `packages/frontend/src/lib/modules.ts` | B02 |
| `packages/frontend/src/components/Sidebar.tsx` | B02 |
| `packages/frontend/src/pages/Settings.tsx` | B02 |
| `packages/server/src/auth.ts` | B02 (allowed_modules) |
| `packages/frontend/src/pages/Tasks.tsx` | B08 |
| `packages/server/src/mail.ts` | B06 |
| `packages/frontend/src/pages/Webmail.tsx` | B04, B07 |
| `packages/frontend/src/pages/Messenger.tsx` | B03, B04, B05 |
| `packages/server/src/messenger.ts` | B05 |
| `packages/server/src/index.ts` | B02 (endpoint), B05 (proxy route) |
| `packages/frontend/src/i18n/nl.json` | B10 |
| `packages/frontend/src/i18n/en.json` | B10 |

## Verificatie

| Bug | Test |
|-----|------|
| B02 | Timesheets, vakantieplanning en andere items zichtbaar in sidebar |
| B03 | Messenger "Alle" tab toont Talk berichten op productie |
| B04 | Page reload → data verschijnt direct uit cache, background refresh |
| B05 | Talk berichten met afbeeldingen/bestanden tonen preview/download |
| B06 | Snelle opeenvolgende mail-acties geven geen lock timeout |
| B07 | Email groepen inklappen → navigeren → terug → staat bewaard |
| B08 | Workflow dropdown bij top van scherm opent naar beneden |
| B09 | Activity types in widget komen uit employer config (employee: verborgen) |
| B10 | Amber warning als shift data ontbreekt, berekeningen geblokkeerd |
| B11 | Contracturen komen uit Shift Type start_time/end_time |

**Build check:** `cd packages/frontend && npx tsc --noEmit && npx vite build`
**Dev test:** `cd packages/frontend && npx vite` + `cd packages/server && npm run dev`
