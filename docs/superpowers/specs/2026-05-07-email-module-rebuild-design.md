# Email Module Rebuild — Design Spec

## Context

De email module in Y-app heeft een fundamenteel isolatieprobleem: credentials lekken tussen ERPNext instances. De huidige architectuur gebruikt localStorage voor credentials, module-level state die niet reset bij instance-wissel, en een server-side cache die niet altijd de juiste instance ID meekrijgt. Dit moet van de grond af opnieuw.

## Kernprincipes

1. **Thunderbird-model**: expliciet, handmatig, volledige controle — geen automatische magie
2. **Chinese walls**: strikte scheiding per instance — geen gedeelde state, geen lekken
3. **Server vault als single source of truth**: geen credentials in localStorage
4. **Drie authenticatie-opties**: Via ERPNext, Office365 direct, Handmatig IMAP/SMTP

---

## Data Model

Nieuwe tabel `mail_accounts` in de SQLite database:

```sql
CREATE TABLE mail_accounts (
  id            TEXT PRIMARY KEY,          -- UUID
  y_app_user_id INTEGER NOT NULL,
  instance_id   INTEGER NOT NULL,
  email         TEXT NOT NULL,
  label         TEXT NOT NULL,             -- display naam
  auth_type     TEXT NOT NULL,             -- "erpnext" | "office365" | "manual"
  
  -- IMAP (encrypted)
  imap_host     TEXT NOT NULL,
  imap_port     INTEGER NOT NULL DEFAULT 993,
  imap_secure   INTEGER NOT NULL DEFAULT 1,
  
  -- SMTP (encrypted)
  smtp_host     TEXT NOT NULL,
  smtp_port     INTEGER NOT NULL DEFAULT 587,
  smtp_secure   INTEGER NOT NULL DEFAULT 0,
  
  -- Auth credentials (encrypted blob — JSON met username/password/tokens)
  credentials_encrypted BLOB NOT NULL,
  credentials_iv        BLOB NOT NULL,
  
  -- Status
  last_tested_at INTEGER,
  last_test_ok   INTEGER,
  created_at     INTEGER NOT NULL,
  
  FOREIGN KEY (y_app_user_id) REFERENCES y_app_users(id) ON DELETE CASCADE,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE INDEX idx_mail_accounts_user_instance ON mail_accounts(y_app_user_id, instance_id);
```

Credentials blob bevat (AES-256-GCM encrypted met user key):
```json
{
  "username": "maarten@3bm.co.nl",
  "password": "...",
  "accessToken": "...",
  "refreshToken": "...",
  "clientId": "...",
  "clientSecret": "...",
  "tokenUri": "..."
}
```

---

## Server API

### Mail Account CRUD

Alle endpoints vereisen Y-app session + user key (voor encrypt/decrypt).

```
GET    /api/instances/:id/mail-accounts
       → [{ id, email, label, authType, imapHost, imapPort, smtpHost, smtpPort, lastTestOk }]
       (geen credentials in response)

POST   /api/instances/:id/mail-accounts
       Body: { email, label, authType, imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure, credentials }
       → { id, email, label }

PUT    /api/instances/:id/mail-accounts/:accountId
       Body: { label?, imapHost?, imapPort?, smtpHost?, smtpPort?, credentials? }
       → { ok: true }

DELETE /api/instances/:id/mail-accounts/:accountId
       → { ok: true }

POST   /api/instances/:id/mail-accounts/:accountId/test
       → { ok: true, message: "Connected" } of { ok: false, message: "..." }

POST   /api/instances/:id/mail-accounts/resolve-erpnext
       Body: { email }
       → { imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure, authType, credentials }
       (haalt config op uit ERPNext Email Account + Connected App)

POST   /api/instances/:id/mail-accounts/resolve-office365
       Body: { email }
       → { redirectUrl } of { imapHost, ..., credentials } (OAuth2 flow)
```

### Mail Operations

Bestaande `/api/mail/*` endpoints krijgen verplichte `?account=<accountId>` parameter:

```
GET  /api/mail/folders?account=<aid>
GET  /api/mail/messages?account=<aid>&folder=INBOX&pageSize=50
GET  /api/mail/message?account=<aid>&folder=INBOX&uid=123
POST /api/mail/send?account=<aid>
...
```

Server haalt credentials op uit `mail_accounts` tabel (decrypt met user key), niet uit de mail-session cache. De mail-session cache wordt een pure performance cache, keyed op `accountId`.

### Instance Isolatie (server)

Elke mail-account query bevat `WHERE y_app_user_id = ? AND instance_id = ?`. Geen uitzonderingen. De server stuurt nooit credentials van instance A naar een request voor instance B.

---

## Frontend: Instellingen

### Nieuw tabblad "Email accounts" in Settings pagina

**Lijst view:**
```
┌─────────────────────────────────────────────────────┐
│ Email accounts                    [+ Account toevoegen] │
├─────────────────────────────────────────────────────┤
│ ● maarten@3bm.co.nl         ERPNext (Office365)  ✓  │
│   outlook.office365.com:993                    [✎] [✕]│
│                                                       │
│ ● info@3bm.co.nl            Handmatig IMAP      ✓  │
│   mail.3bm.co.nl:993                          [✎] [✕]│
└─────────────────────────────────────────────────────┘
```

**"+ Account toevoegen" → keuze uit drie types:**

```
┌────────────────────────────────────────┐
│ Hoe wil je dit account instellen?      │
│                                        │
│ [Via ERPNext]                          │
│  Haalt configuratie op uit ERPNext     │
│  Email Account (incl. Office365)       │
│                                        │
│ [Office365 direct]                     │
│  Verbind rechtstreeks met Microsoft    │
│  OAuth2, geen ERPNext nodig            │
│                                        │
│ [Handmatig IMAP/SMTP]                 │
│  Voer alle servergegevens zelf in      │
└────────────────────────────────────────┘
```

**Via ERPNext flow:**
1. Vul email adres in
2. Klik "Ophalen" → `POST /api/instances/:id/mail-accounts/resolve-erpnext`
3. Toon opgehaalde config (host, port, type) ter bevestiging
4. Klik "Toevoegen" → `POST /api/instances/:id/mail-accounts`

**Office365 direct flow:**
1. Vul email adres in
2. Klik "Verbinden" → OAuth2 redirect naar Microsoft
3. Na redirect: tokens automatisch opgeslagen
4. Account verschijnt in lijst

**Handmatig flow:**
1. Vul in: email, IMAP host/port/tls, SMTP host/port/tls, username, wachtwoord
2. Klik "Test verbinding" → `POST /api/instances/:id/mail-accounts/:aid/test`
3. Klik "Opslaan" → `POST /api/instances/:id/mail-accounts`

---

## Frontend: Webmail

### Account tabs bovenaan

```
┌──────────────────────────────────────────────────────────┐
│ [maarten@3bm.co.nl] [info@3bm.co.nl]                    │
├──────────┬───────────────────────────────────────────────┤
│ INBOX  5 │ Van: Piet Mol                                 │
│ Sent     │ Onderwerp: Offerte 2600 Halter                │
│ Drafts 3 │                                               │
│ Archive  │ Beste Maarten, ...                            │
│ ...      │                                               │
└──────────┴───────────────────────────────────────────────┘
```

- Tabs tonen email adres (of label als die is ingesteld)
- Klik op tab → laadt folders + berichten voor dat account
- Elke tab is volledig geïsoleerd: eigen folder tree, eigen message list, eigen compose
- Geen gedeelde state tussen tabs

### Data flow bij Webmail mount

1. `GET /api/instances/:id/mail-accounts` → lijst accounts (geen credentials)
2. Per actief account tab: `GET /api/mail/folders?account=<aid>` → folder tree
3. Bij folder klik: `GET /api/mail/messages?account=<aid>&folder=INBOX` → berichten
4. Bij bericht klik: `GET /api/mail/message?account=<aid>&folder=INBOX&uid=123`

### Geen localStorage, geen module-level cache

- `folderMsgCache` en `fullMsgCache` in webmail-prefetch.ts worden verwijderd
- In-component state only, scoped aan account tab
- Bij instance-wissel: component remount (via BrowserRouter key) → schone state

---

## Instance Isolatie (Chinese Walls)

| Laag | Maatregel |
|------|-----------|
| **Database** | `WHERE y_app_user_id = ? AND instance_id = ?` op elke query |
| **Server API** | Account ownership check op elk endpoint |
| **Server cache** | Mail session keyed op `accountId` (UUID, uniek per user+instance) |
| **Frontend state** | Geen localStorage, geen module-level vars, component-scoped state |
| **Frontend remount** | BrowserRouter key op instance ID → volledige component reset |
| **Fetch interceptor** | X-Y-App-Instance header op elke /api/ call (bestaand, werkt) |

---

## Bestanden

### Nieuw
- `packages/server/src/mail-accounts.ts` — CRUD + resolve endpoints
- `packages/frontend/src/pages/MailAccountSettings.tsx` — Instellingen tabblad
- `packages/frontend/src/components/MailAccountTabs.tsx` — Webmail account tabs

### Te wijzigen
- `packages/server/src/db.ts` — `mail_accounts` tabel schema
- `packages/server/src/index.ts` — nieuwe routes registreren
- `packages/server/src/mail.ts` — `getCredentials()` leest uit vault ipv session cache
- `packages/frontend/src/pages/Webmail.tsx` — ImapSetup verwijderen, account tabs toevoegen
- `packages/frontend/src/pages/Settings.tsx` — "Email accounts" tab toevoegen
- `packages/frontend/src/lib/webmail-prefetch.ts` — module-level caches verwijderen

### Te verwijderen (functionaliteit)
- `saveImapConfig()` / `getImapConfig()` in webmail-prefetch.ts (localStorage-gebaseerd)
- `mailSetConfig` / `mailClearConfig` endpoints (session cache push)
- `ImapSetup` component in Webmail.tsx (vervangen door Settings flow)
