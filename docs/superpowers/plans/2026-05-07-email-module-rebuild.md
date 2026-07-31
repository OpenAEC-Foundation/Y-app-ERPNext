# Email Module Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace localStorage-based email credentials with a server-side encrypted vault, supporting multiple accounts per instance with three auth types (ERPNext, Office365, Manual IMAP/SMTP).

**Architecture:** New `mail_accounts` SQLite table with AES-256-GCM encrypted credentials. Server CRUD API under `/api/instances/:id/mail-accounts`. Frontend Settings tab for account management, Webmail tabs for account switching. Strict instance isolation via `y_app_user_id + instance_id` scoping on every query.

**Tech Stack:** SQLite (better-sqlite3), AES-256-GCM (Node crypto), Express, React 19, TypeScript, Tailwind CSS

---

## Task 1: Database Schema

**Files:** Modify `packages/server/src/db.ts`

- [ ] Add `mail_accounts` table after existing `instance_settings` block
- [ ] Add index on `(y_app_user_id, instance_id)`
- [ ] Run: `cd packages/server && npx tsc --noEmit`
- [ ] Commit: `feat(db): add mail_accounts table for encrypted email credential vault`

## Task 2: Server CRUD Module

**Files:** Create `packages/server/src/mail-accounts.ts`

- [ ] Define interfaces: `MailAccountRow`, `MailAccountPublic`, `MailAccountCredentials`, `AddMailAccountInput`
- [ ] Prepared statements: list, get, insert, update, delete, updateTest
- [ ] `listMailAccounts(userId, instanceId)` — no credentials in response
- [ ] `addMailAccount(userId, instanceId, userKey, input)` — encrypt credentials with `encryptWithKey`
- [ ] `updateMailAccount(accountId, userId, userKey, input)` — re-encrypt on update
- [ ] `deleteMailAccount(accountId, userId)` — ownership scoped
- [ ] `getDecryptedMailCredentials(accountId, userId, userKey)` — returns IMAP+SMTP+auth fields
- [ ] `updateTestResult(accountId, ok)` — sets last_tested_at + last_test_ok
- [ ] Run: `cd packages/server && npx tsc --noEmit`
- [ ] Commit: `feat(mail-accounts): add CRUD module with encrypted credential vault`

## Task 3: Server API Routes

**Files:** Modify `packages/server/src/index.ts`

- [ ] Import from `mail-accounts.ts`
- [ ] `GET /api/instances/:id/mail-accounts` — requireYAppSession
- [ ] `POST /api/instances/:id/mail-accounts` — requireYAppSessionWithKey
- [ ] `PUT /api/instances/:id/mail-accounts/:accountId` — requireYAppSessionWithKey
- [ ] `DELETE /api/instances/:id/mail-accounts/:accountId` — requireYAppSession
- [ ] `POST /api/instances/:id/mail-accounts/:accountId/test` — requireYAppSessionWithKey
- [ ] All routes verify instance ownership before CRUD call
- [ ] Export `testMailConnectionFromCreds` from `mail.ts` for test endpoint
- [ ] Run: `cd packages/server && npx tsc --noEmit`
- [ ] Commit: `feat(api): register mail-accounts CRUD routes`

## Task 4: Update mail.ts Credential Retrieval

**Files:** Modify `packages/server/src/mail.ts`

- [ ] Import `getDecryptedMailCredentials` and `getYAppSessionWithKey`
- [ ] Add vault lookup as PRIMARY path in `getCredentials()` when `?account=` parameter present
- [ ] Update `mailSend` handler to use vault credentials for SMTP
- [ ] Export `testMailConnectionFromCreds` wrapper around `withClient`
- [ ] Keep existing fallback paths for backward compatibility during migration
- [ ] Run: `cd packages/server && npx tsc --noEmit`
- [ ] Commit: `feat(mail): add vault-based credential retrieval via ?account= parameter`

## Task 5: Frontend MailAccountSettings Component

**Files:** Create `packages/frontend/src/pages/MailAccountSettings.tsx`

- [ ] Account list with status indicators (green/red based on last_test_ok)
- [ ] "+ Account toevoegen" button → 3-option auth type picker
- [ ] **Via ERPNext** flow: email input → call existing auto-config → pre-fill → save
- [ ] **Office365 direct** flow: placeholder for OAuth2 redirect (future)
- [ ] **Handmatig** flow: full IMAP + SMTP form → test → save
- [ ] Edit mode: pre-fill from existing account
- [ ] Delete with confirmation
- [ ] Test connection button per account
- [ ] All API calls use `credentials: "same-origin"`, no localStorage
- [ ] Run: `cd packages/frontend && npx tsc --noEmit`
- [ ] Commit: `feat(frontend): add MailAccountSettings component`

## Task 6: Wire Into Settings Page

**Files:** Modify `packages/frontend/src/pages/Settings.tsx`

- [ ] Add `"email-accounts"` to `SettingsTab` type union
- [ ] Add to `VALID_TABS` array
- [ ] Import `MailAccountSettings`
- [ ] Add tab button in nav bar
- [ ] Render `<MailAccountSettings />` when tab active
- [ ] Run: `cd packages/frontend && npx tsc --noEmit`
- [ ] Commit: `feat(settings): add Email accounts tab`

## Task 7: Webmail Account Tabs

**Files:** Create `packages/frontend/src/components/MailAccountTabs.tsx`, Modify `packages/frontend/src/pages/Webmail.tsx`

- [ ] `MailAccountTabs` component: horizontal tab strip with email/label per account
- [ ] Webmail: fetch vault accounts on mount via `GET /api/instances/:id/mail-accounts`
- [ ] If vault accounts exist → use vault mode (no ImapSetup, no localStorage)
- [ ] All `/api/mail/*` calls include `?account=<accountId>`
- [ ] Tab switch resets folder/message state
- [ ] If no vault accounts → show "Geen accounts. Configureer in Instellingen." with link
- [ ] Run: `cd packages/frontend && npx tsc --noEmit`
- [ ] Commit: `feat(webmail): add vault-backed account tabs`

## Task 8: Remove Old localStorage Email Config

**Files:** Modify `Webmail.tsx`, `webmail-prefetch.ts`, `index.ts`, `mail.ts`

- [ ] Delete `saveImapConfig`, `getImapConfig`, `getImapConfigForShared` from webmail-prefetch.ts
- [ ] Delete `ensureMailConfigPushed`, `invalidateMailConfigPush` from webmail-prefetch.ts
- [ ] Delete `ImapSetup` component from Webmail.tsx
- [ ] Delete shared mailbox state/UI from Webmail.tsx
- [ ] Delete `mailSetConfig`, `mailClearConfig` handlers from mail.ts
- [ ] Delete `mailSessions` map + `setMailSession`/`getMailSession`/`clearMailSession` from mail.ts
- [ ] Remove `POST /api/mail/config` and `DELETE /api/mail/config` routes from index.ts
- [ ] Clean up all unused imports
- [ ] Run: `cd packages/server && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
- [ ] Commit: `refactor(mail): remove localStorage email config and server session cache`

---

## Execution Order

```
Task 1 → Task 2 → Task 3 + Task 4 (parallel) → Task 5 → Task 6 → Task 7 → Task 8
```

## Verification

After all tasks:
1. Open Settings → Email accounts → add account via ERPNext for 3BM (maarten@3bm.co.nl)
2. Open Webmail → 3BM email loads via vault, no setup screen
3. Switch to Impertio instance → Webmail shows "Geen accounts" (clean slate)
4. Add manual IMAP account for Impertio in Settings
5. Switch back to 3BM → still sees 3BM email, NOT Impertio
6. Clear localStorage completely → email still works (vault-based)
