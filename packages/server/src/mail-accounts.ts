/**
 * Y-app mail account management.
 *
 * A "mail account" is one email identity (IMAP + SMTP) that a Y-app user
 * has enrolled against an ERPNext instance. Each account carries its own
 * server settings and a set of credentials (username + password/tokens)
 * that we encrypt at rest using the same user-derived key that protects
 * ERPNext instance credentials.
 *
 * Encryption flow:
 *   - User logs in to Y-app -> server recovers `userKey` from session
 *   - When the user adds a mail account, server:
 *       1. Validates input (email, auth type, host settings)
 *       2. Encrypts the credential payload with `userKey` (AES-256-GCM)
 *       3. Stores the encrypted blob + IV in `mail_accounts`
 *   - When the server needs to connect (IMAP/SMTP), it:
 *       1. Recovers `userKey` from session
 *       2. Decrypts the stored credentials
 *       3. Connects to the mail server with the decrypted credentials
 *
 * Every query is scoped by `y_app_user_id` (Chinese wall).
 * Public functions NEVER expose `credentials_encrypted` or `credentials_iv`.
 */

import { db } from "./db.ts";
import { encryptWithKey, decryptToJson } from "./crypto.ts";
import { randomUUID } from "crypto";

/* ─── Types ─── */

interface MailAccountRow {
  id: string;
  y_app_user_id: number;
  instance_id: number;
  email: string;
  label: string;
  auth_type: string;
  imap_host: string;
  imap_port: number;
  imap_secure: number;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: number;
  credentials_encrypted: Buffer;
  credentials_iv: Buffer;
  last_tested_at: number | null;
  last_test_ok: number | null;
  created_at: number;
}

export interface MailAccountPublic {
  id: string;
  email: string;
  label: string;
  authType: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  lastTestedAt: number | null;
  lastTestOk: boolean | null;
  createdAt: number;
}

export interface MailAccountCredentials {
  username: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUri?: string;
  /** Server-issued IMAP/SMTP app-password for PLAIN auth. Used as a fallback
   *  when XOAUTH2 is unavailable or its token refresh fails. Encrypted at rest
   *  inside this same credentials blob (AES-256-GCM with the user key). */
  appPassword?: string;
}

export interface DecryptedMailAccount {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUri?: string;
  /** PLAIN-auth app-password fallback (decrypted from the vault blob). */
  appPassword?: string;
}

export interface AddMailAccountInput {
  email: string;
  label: string;
  authType: "erpnext" | "office365" | "manual" | "oauth2";
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  credentials: MailAccountCredentials;
}

/* ─── Prepared statements ─── */

const stmtList = db.prepare(
  `SELECT id, email, label, auth_type, imap_host, imap_port, imap_secure,
          smtp_host, smtp_port, smtp_secure, last_tested_at, last_test_ok, created_at
   FROM mail_accounts
   WHERE y_app_user_id = ? AND instance_id = ?
   ORDER BY created_at ASC`
);

const stmtGet = db.prepare(
  "SELECT * FROM mail_accounts WHERE id = ? AND y_app_user_id = ?"
);

const stmtInsert = db.prepare(
  `INSERT INTO mail_accounts
     (id, y_app_user_id, instance_id, email, label, auth_type,
      imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure,
      credentials_encrypted, credentials_iv, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const stmtUpdate = db.prepare(
  `UPDATE mail_accounts
   SET label = ?, imap_host = ?, imap_port = ?, imap_secure = ?,
       smtp_host = ?, smtp_port = ?, smtp_secure = ?,
       credentials_encrypted = ?, credentials_iv = ?
   WHERE id = ? AND y_app_user_id = ?`
);

const stmtDelete = db.prepare(
  "DELETE FROM mail_accounts WHERE id = ? AND y_app_user_id = ?"
);

const stmtUpdateTest = db.prepare(
  "UPDATE mail_accounts SET last_tested_at = ?, last_test_ok = ? WHERE id = ?"
);

/* ─── Helpers ─── */

const VALID_AUTH_TYPES = new Set(["erpnext", "office365", "manual", "oauth2"]);

function rowToPublic(row: MailAccountRow): MailAccountPublic {
  return {
    id: row.id,
    email: row.email,
    label: row.label,
    authType: row.auth_type,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    imapSecure: !!row.imap_secure,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecure: !!row.smtp_secure,
    lastTestedAt: row.last_tested_at,
    lastTestOk: row.last_test_ok != null ? !!row.last_test_ok : null,
    createdAt: row.created_at,
  };
}

/* ─── CRUD operations ─── */

/** List all mail accounts for a user+instance pair (no credentials). */
export function listMailAccounts(yAppUserId: number, instanceId: number): MailAccountPublic[] {
  const rows = stmtList.all(yAppUserId, instanceId) as MailAccountRow[];
  return rows.map(rowToPublic);
}

/** Get one mail account by id (scoped to user, no credentials). */
export function getMailAccount(accountId: string, yAppUserId: number): MailAccountPublic | null {
  const row = stmtGet.get(accountId, yAppUserId) as MailAccountRow | undefined;
  return row ? rowToPublic(row) : null;
}

/**
 * Add a new mail account. Validates input, encrypts credentials,
 * and inserts in a transaction. Returns the public view.
 */
export function addMailAccount(
  yAppUserId: number,
  instanceId: number,
  userKey: Buffer,
  input: AddMailAccountInput,
): MailAccountPublic {
  // Validate
  if (!input.email || typeof input.email !== "string" || !input.email.trim()) {
    throw new Error("Email is required");
  }
  if (!VALID_AUTH_TYPES.has(input.authType)) {
    throw new Error("authType must be one of: erpnext, office365, manual, oauth2");
  }
  if (!input.imapHost || typeof input.imapHost !== "string" || !input.imapHost.trim()) {
    throw new Error("IMAP host is required");
  }
  if (!input.smtpHost || typeof input.smtpHost !== "string" || !input.smtpHost.trim()) {
    throw new Error("SMTP host is required");
  }
  if (!input.credentials || !input.credentials.username) {
    throw new Error("Credentials with username are required");
  }

  const id = randomUUID();
  const encrypted = encryptWithKey(JSON.stringify(input.credentials), userKey);

  const tx = db.transaction(() => {
    stmtInsert.run(
      id,
      yAppUserId,
      instanceId,
      input.email.trim(),
      input.label || input.email.trim(),
      input.authType,
      input.imapHost.trim(),
      input.imapPort,
      input.imapSecure ? 1 : 0,
      input.smtpHost.trim(),
      input.smtpPort,
      input.smtpSecure ? 1 : 0,
      encrypted.ciphertext,
      encrypted.iv,
      Date.now(),
    );
  });

  tx();

  const account = getMailAccount(id, yAppUserId);
  if (!account) {
    throw new Error("Failed to read back inserted mail account");
  }
  return account;
}

/**
 * Update an existing mail account. Re-encrypts credentials if provided.
 * Returns the updated public view, or null if the account was not found.
 */
export function updateMailAccount(
  accountId: string,
  yAppUserId: number,
  userKey: Buffer,
  input: Partial<AddMailAccountInput>,
): MailAccountPublic | null {
  const existing = stmtGet.get(accountId, yAppUserId) as MailAccountRow | undefined;
  if (!existing) return null;

  // Merge fields: use new values if provided, otherwise keep existing
  const label = input.label ?? existing.label;
  const imapHost = input.imapHost?.trim() ?? existing.imap_host;
  const imapPort = input.imapPort ?? existing.imap_port;
  const imapSecure = input.imapSecure !== undefined ? (input.imapSecure ? 1 : 0) : existing.imap_secure;
  const smtpHost = input.smtpHost?.trim() ?? existing.smtp_host;
  const smtpPort = input.smtpPort ?? existing.smtp_port;
  const smtpSecure = input.smtpSecure !== undefined ? (input.smtpSecure ? 1 : 0) : existing.smtp_secure;

  // Re-encrypt credentials if new ones are provided, otherwise keep existing blob
  let credsCiphertext: Buffer;
  let credsIv: Buffer;

  if (input.credentials) {
    if (!input.credentials.username) {
      throw new Error("Credentials must include a username");
    }
    const encrypted = encryptWithKey(JSON.stringify(input.credentials), userKey);
    credsCiphertext = encrypted.ciphertext;
    credsIv = encrypted.iv;
  } else {
    credsCiphertext = existing.credentials_encrypted;
    credsIv = existing.credentials_iv;
  }

  stmtUpdate.run(
    label,
    imapHost,
    imapPort,
    imapSecure,
    smtpHost,
    smtpPort,
    smtpSecure,
    credsCiphertext,
    credsIv,
    accountId,
    yAppUserId,
  );

  return getMailAccount(accountId, yAppUserId);
}

/** Delete a mail account. Returns true if a row was removed. */
export function deleteMailAccount(accountId: string, yAppUserId: number): boolean {
  const result = stmtDelete.run(accountId, yAppUserId);
  return result.changes > 0;
}

/**
 * Decrypt and return stored mail credentials + server settings.
 * Used when the server needs to connect to IMAP/SMTP.
 */
export async function getDecryptedMailCredentials(
  accountId: string,
  yAppUserId: number,
  userKey: Buffer,
): Promise<DecryptedMailAccount | null> {
  const row = stmtGet.get(accountId, yAppUserId) as MailAccountRow | undefined;
  if (!row) return null;

  try {
    const creds = decryptToJson<MailAccountCredentials>(row.credentials_encrypted, row.credentials_iv, userKey);

    // OAuth2: refresh the access token if we have a refresh token
    if (creds.refreshToken && creds.clientId && creds.clientSecret && creds.tokenUri) {
      try {
        const body = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: creds.refreshToken,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
        });
        const resp = await fetch(creds.tokenUri, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
          signal: AbortSignal.timeout(10_000),
        });
        if (resp.ok) {
          const tokens = await resp.json();
          if (tokens.access_token) {
            creds.accessToken = tokens.access_token;
            // Persist the refreshed token back to the vault
            const updatedBlob = encryptWithKey(JSON.stringify(creds), userKey);
            db.prepare("UPDATE mail_accounts SET credentials_encrypted = ?, credentials_iv = ? WHERE id = ? AND y_app_user_id = ?")
              .run(updatedBlob.ciphertext, updatedBlob.iv, accountId, yAppUserId);
          }
        }
      } catch {
        // Token refresh failed — use existing token, it might still work
      }
    }

    return {
      imapHost: row.imap_host,
      imapPort: row.imap_port,
      imapSecure: !!row.imap_secure,
      smtpHost: row.smtp_host,
      smtpPort: row.smtp_port,
      smtpSecure: !!row.smtp_secure,
      username: creds.username,
      password: creds.password,
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      tokenUri: creds.tokenUri,
      appPassword: creds.appPassword,
    };
  } catch {
    return null;
  }
}

/** Update the test result for a mail account (not scoped by user — internal use). */
export function updateTestResult(accountId: string, ok: boolean): void {
  stmtUpdateTest.run(Date.now(), ok ? 1 : 0, accountId);
}

/* ─── OpenAEC SuperCloud mailbox (auto-provisioned, XOAUTH2) ─── */

const stmtFindByEmail = db.prepare(
  "SELECT * FROM mail_accounts WHERE y_app_user_id = ? AND instance_id = ? AND email = ?"
);

export interface UpsertOpenAecMailInput {
  /** Mailbox address (also the XOAUTH2/IMAP user). */
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  /** Zitadel access token used as the XOAUTH2 Bearer. */
  accessToken: string;
  /** Zitadel refresh token + token endpoint so the vault can self-refresh the
   *  short-lived access token without a fresh interactive login. Optional. */
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUri?: string;
  /** Server-issued app-password for PLAIN IMAP/SMTP auth. Stored encrypted and
   *  used as a fallback when XOAUTH2 is unavailable or its refresh fails. */
  appPassword?: string;
}

/**
 * Idempotent upsert of the OpenAEC SuperCloud mailbox as a vault `mail_accounts`
 * row, so the Webmail UI configures itself automatically after SSO login
 * (the frontend lists /mail-accounts, sees this row, and skips manual setup).
 *
 * Reuses the exact encrypted-credential pattern (AES-256-GCM with the user
 * key) that protects the ERPNext api_secret. The Zitadel access token rotates
 * on every login, so we refresh the stored credentials on each call (matching
 * the ERPNext instance upsert that re-stores the api_secret each login).
 *
 * Returns the account id.
 */
export function upsertOpenAecMailAccount(
  yAppUserId: number,
  instanceId: number,
  userKey: Buffer,
  input: UpsertOpenAecMailInput,
): string {
  const credentials: MailAccountCredentials = {
    username: input.email,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    tokenUri: input.tokenUri,
    // PLAIN fallback secret — encrypted alongside the OAuth2 fields.
    appPassword: input.appPassword,
  };
  const existing = stmtFindByEmail.get(yAppUserId, instanceId, input.email) as MailAccountRow | undefined;
  if (existing) {
    updateMailAccount(existing.id, yAppUserId, userKey, {
      label: "OpenAEC mail",
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      imapSecure: input.imapSecure,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpSecure: input.smtpSecure,
      credentials,
    });
    return existing.id;
  }
  const acct = addMailAccount(yAppUserId, instanceId, userKey, {
    email: input.email,
    label: "OpenAEC mail",
    authType: "oauth2",
    imapHost: input.imapHost,
    imapPort: input.imapPort,
    imapSecure: input.imapSecure,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    credentials,
  });
  return acct.id;
}
