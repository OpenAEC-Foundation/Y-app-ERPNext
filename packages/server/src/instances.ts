/**
 * Y-app instance management.
 *
 * An "instance" is one ERPNext deployment that a Y-app user has enrolled.
 * Each instance carries its own URL, friendly name, theme color, and a set
 * of credentials (ERPNext username + password) that we encrypt at rest.
 *
 * Encryption flow:
 *   - User logs in to Y-app → server derives `userKey` from password
 *   - Server creates a Y-app session with `userKey` envelope-wrapped
 *     using the master key (see crypto.ts)
 *   - When the user enrolls a new instance, server:
 *       1. Looks up the session to recover `userKey`
 *       2. Tests the ERPNext credentials by calling loginToErpNext(url)
 *       3. Encrypts the ERPNext password with `userKey` (AES-256-GCM)
 *       4. Stores the encrypted blob + IV in `instance_credentials`
 *   - When the user opens an instance, server:
 *       1. Recovers `userKey` from session
 *       2. Decrypts the stored ERPNext password
 *       3. Calls loginToErpNext(url) with the decrypted password
 *       4. Stores the resulting ERPNext sid in the legacy `sessions` table
 *          for the per-instance proxy to use (Phase 3)
 */

import { db } from "./db.ts";
import { encryptWithKey, decryptToString } from "./crypto.ts";
import { loginToErpNext } from "./auth.ts";
import { detectFrappeVersion, saveDetectedVersion, setVersionOverride } from "./erpnext-version.ts";

export interface Instance {
  id: number;
  name: string;
  url: string;
  themeColor: string | null;
  createdAt: number;
  /** 'password' (default) → login → sid; 'apikey' → Authorization: token key:secret. */
  authMode?: "password" | "apikey";
}

export interface InstanceWithCredsStatus extends Instance {
  hasCredentials: boolean;
  lastUsedAt: number | null;
}

interface InstanceRow {
  id: number;
  y_app_user_id: number;
  name: string;
  url: string;
  theme_color: string | null;
  created_at: number;
  auth_mode: string | null;
  openaec_managed: number;
}

interface CredentialsRow {
  instance_id: number;
  erpnext_username: string;
  erpnext_password_encrypted: Buffer;
  encryption_iv: Buffer;
  last_used_at: number | null;
}

/* ─── Prepared statements ─── */

const stmtListInstances = db.prepare(
  `SELECT i.*, c.last_used_at, (c.instance_id IS NOT NULL) AS has_creds
   FROM instances i
   LEFT JOIN instance_credentials c ON c.instance_id = i.id
   WHERE i.y_app_user_id = ?
   ORDER BY i.created_at ASC`
);
const stmtGetInstance = db.prepare("SELECT * FROM instances WHERE id = ? AND y_app_user_id = ?");
const stmtInsertInstance = db.prepare(
  "INSERT INTO instances (y_app_user_id, name, url, theme_color, created_at) VALUES (?, ?, ?, ?, ?)"
);
const stmtUpdateInstance = db.prepare(
  "UPDATE instances SET name = ?, url = ?, theme_color = ? WHERE id = ? AND y_app_user_id = ?"
);
const stmtDeleteInstance = db.prepare("DELETE FROM instances WHERE id = ? AND y_app_user_id = ?");

const stmtUpsertCreds = db.prepare(
  `INSERT INTO instance_credentials (instance_id, erpnext_username, erpnext_password_encrypted, encryption_iv, last_used_at)
   VALUES (?, ?, ?, ?, ?)
   ON CONFLICT(instance_id) DO UPDATE SET
     erpnext_username = excluded.erpnext_username,
     erpnext_password_encrypted = excluded.erpnext_password_encrypted,
     encryption_iv = excluded.encryption_iv,
     last_used_at = excluded.last_used_at`
);
const stmtGetCreds = db.prepare("SELECT * FROM instance_credentials WHERE instance_id = ?");
const stmtTouchCreds = db.prepare("UPDATE instance_credentials SET last_used_at = ? WHERE instance_id = ?");

/* ─── OpenAEC api_key instances ─── */
const stmtFindInstanceByUrl = db.prepare(
  "SELECT * FROM instances WHERE y_app_user_id = ? AND url = ?"
);
const stmtInsertApiKeyInstance = db.prepare(
  "INSERT INTO instances (y_app_user_id, name, url, theme_color, created_at, auth_mode, openaec_managed) VALUES (?, ?, ?, ?, ?, 'apikey', 1)"
);
const stmtSetInstanceAuthMode = db.prepare(
  "UPDATE instances SET auth_mode = ?, openaec_managed = ?, name = ?, theme_color = ? WHERE id = ?"
);

/* ─── OpenAEC standalone "mail-only" instance ─── */
// A sentinel `instances` row used to anchor the auto-provisioned mailbox when
// the user has NO ERPNext instance (the Accounts API /me/credentials returned
// a mail block but no erpnext block — e.g. ERPNext provisioning is slow, the
// user's plan has no ERPNext, or the api-key mint failed). The mail_accounts
// table requires a non-null instance_id with a FK to instances, so the mailbox
// needs *some* instance to hang off. This row gives it one without pretending
// to be an ERPNext deployment:
//   - url is a fixed, non-routable sentinel (never proxied — the per-instance
//     ERPNext proxy only acts on apikey/password instances).
//   - auth_mode = 'mailonly' so getDecryptedApiCredentials() (which keys on
//     'apikey') and getDecryptedCredentials() never resolve ERPNext creds for
//     it, and no instance_credentials row is ever created.
//   - openaec_managed = 1 so it is treated like the other SSO-provisioned rows.
// Idempotent per user: looked up by the sentinel url.
const OPENAEC_MAIL_INSTANCE_URL = "https://mail.openaec.local";
const OPENAEC_MAIL_INSTANCE_NAME = "OpenAEC Mail";
const stmtInsertMailOnlyInstance = db.prepare(
  "INSERT INTO instances (y_app_user_id, name, url, theme_color, created_at, auth_mode, openaec_managed) VALUES (?, ?, ?, ?, ?, 'mailonly', 1)"
);

/* ─── Validation ─── */

function isValidUrl(url: string): boolean {
  if (typeof url !== "string" || url.length > 2048) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidName(name: string): boolean {
  return typeof name === "string" && name.trim().length >= 1 && name.length <= 100;
}

function isValidColor(color: string | null | undefined): boolean {
  if (color == null || color === "") return true;
  return typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color);
}

function rowToInstance(row: InstanceRow): Instance {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    themeColor: row.theme_color,
    createdAt: row.created_at,
    authMode: row.auth_mode === "apikey" ? "apikey" : "password",
  };
}

/* ─── CRUD operations ─── */

/** List all instances belonging to a Y-app user. */
export function listInstancesForUser(yAppUserId: number): InstanceWithCredsStatus[] {
  const rows = stmtListInstances.all(yAppUserId) as (InstanceRow & { has_creds: number; last_used_at: number | null })[];
  return rows.map((r) => ({
    ...rowToInstance(r),
    hasCredentials: !!r.has_creds,
    lastUsedAt: r.last_used_at,
  }));
}

/** Get one instance by id (scoped to user). */
export function getInstanceForUser(instanceId: number, yAppUserId: number): Instance | null {
  const row = stmtGetInstance.get(instanceId, yAppUserId) as InstanceRow | undefined;
  return row ? rowToInstance(row) : null;
}

export interface AddInstanceInput {
  name: string;
  url: string;
  themeColor?: string | null;
  erpnextUsername: string;
  erpnextPassword: string;
}

export interface AddInstanceResult {
  instance: Instance;
  fullName?: string;
  roles?: string[];
}

/**
 * Enroll a new ERPNext instance for a Y-app user.
 * Tests the ERPNext credentials before persisting anything.
 * Encrypts and stores the credentials with the user-derived key.
 */
export async function addInstance(
  yAppUserId: number,
  userKey: Buffer,
  input: AddInstanceInput,
): Promise<AddInstanceResult> {
  const name = input.name?.trim();
  const url = input.url?.trim().replace(/\/+$/, ""); // strip trailing slashes

  if (!isValidName(name)) {
    throw new Error("Name must be between 1 and 100 characters");
  }
  if (!isValidUrl(url)) {
    throw new Error("URL must be a valid http(s) URL");
  }
  if (!isValidColor(input.themeColor)) {
    throw new Error("Theme color must be a hex color like #14b8a6");
  }
  if (!input.erpnextUsername || !input.erpnextPassword) {
    throw new Error("ERPNext username and password are required");
  }

  // Test the credentials BEFORE persisting anything
  const loginResult = await loginToErpNext(input.erpnextUsername, input.erpnextPassword, url);
  if (!loginResult.ok) {
    throw new Error(loginResult.error || "ERPNext login failed");
  }
  if (!loginResult.sid) {
    throw new Error("ERPNext login succeeded but returned no session id");
  }

  // Detect Frappe major version BEFORE persisting. If detection fails,
  // refuse to add the instance — downstream features need this version.
  let frappeMajorVersion: number;
  try {
    frappeMajorVersion = await detectFrappeVersion(url, loginResult.sid);
  } catch {
    throw new Error("Could not detect Frappe version — instance not added");
  }

  // Persist instance + encrypted credentials in a single transaction
  const tx = db.transaction(() => {
    const insertResult = stmtInsertInstance.run(
      yAppUserId,
      name,
      url,
      input.themeColor || null,
      Date.now(),
    );
    const instanceId = Number(insertResult.lastInsertRowid);

    const encrypted = encryptWithKey(input.erpnextPassword, userKey);
    stmtUpsertCreds.run(instanceId, input.erpnextUsername, encrypted.ciphertext, encrypted.iv, Date.now());

    return instanceId;
  });

  const instanceId = tx();
  saveDetectedVersion(instanceId, frappeMajorVersion);

  const instance = getInstanceForUser(instanceId, yAppUserId);
  if (!instance) {
    throw new Error("Failed to read back inserted instance");
  }

  return {
    instance,
    fullName: loginResult.fullName,
    roles: loginResult.roles,
  };
}

/**
 * Upsert an OpenAEC-managed ERPNext instance that authenticates with an
 * api_key:api_secret token (no username/password, no sid login). Idempotent
 * per (user, url): on first SSO login it inserts; on later logins it refreshes
 * the encrypted api_secret (Frappe regenerates it every time /me/credentials
 * is called). Returns the instance id.
 */
export function upsertOpenAecErpInstance(
  yAppUserId: number,
  userKey: Buffer,
  input: { url: string; name: string; apiKey: string; apiSecret: string; themeColor?: string | null },
): number {
  const url = input.url.trim().replace(/\/+$/, "");
  if (!isValidUrl(url)) throw new Error("OpenAEC ERPNext URL is invalid");
  if (!input.apiKey || !input.apiSecret) throw new Error("OpenAEC ERPNext api_key/api_secret missing");
  const name = isValidName(input.name) ? input.name.trim() : "OpenAEC";
  const color = isValidColor(input.themeColor) ? (input.themeColor || null) : null;

  const tx = db.transaction(() => {
    const existing = stmtFindInstanceByUrl.get(yAppUserId, url) as InstanceRow | undefined;
    let instanceId: number;
    if (existing) {
      instanceId = existing.id;
      // Promote to apikey/managed and refresh display metadata.
      stmtSetInstanceAuthMode.run("apikey", 1, name, color, instanceId);
    } else {
      const ins = stmtInsertApiKeyInstance.run(yAppUserId, name, url, color, Date.now());
      instanceId = Number(ins.lastInsertRowid);
    }
    // api_key is not secret → stored in the username column; api_secret is
    // encrypted with the user key like any other credential.
    const encrypted = encryptWithKey(input.apiSecret, userKey);
    stmtUpsertCreds.run(instanceId, input.apiKey, encrypted.ciphertext, encrypted.iv, Date.now());
    return instanceId;
  });

  const id = tx();
  // ERPNext on the SuperCloud is Frappe v15; detection needs a sid we don't
  // have here. Default to 15 (the column default already does this for new
  // rows); a later refreshInstanceVersion can correct it if needed.
  return id;
}

/**
 * Find-or-create the standalone "mail-only" OpenAEC instance for a user, so the
 * auto-provisioned mailbox can be attached even when there is no ERPNext
 * instance. Idempotent per user (keyed on the sentinel url): inserts on first
 * call, returns the existing id afterwards. The row carries no credentials and
 * is never used for ERPNext proxying (auth_mode='mailonly'). Returns the id.
 */
export function getOrCreateOpenAecMailInstance(yAppUserId: number): number {
  const tx = db.transaction(() => {
    const existing = stmtFindInstanceByUrl.get(yAppUserId, OPENAEC_MAIL_INSTANCE_URL) as InstanceRow | undefined;
    if (existing) {
      // Heal older rows: ensure it stays managed + flagged mail-only (an
      // earlier run, or a manual edit, may have left it on a different mode).
      if (existing.auth_mode !== "mailonly" || existing.openaec_managed !== 1) {
        stmtSetInstanceAuthMode.run("mailonly", 1, OPENAEC_MAIL_INSTANCE_NAME, "#0d9488", existing.id);
      }
      return existing.id;
    }
    const ins = stmtInsertMailOnlyInstance.run(
      yAppUserId,
      OPENAEC_MAIL_INSTANCE_NAME,
      OPENAEC_MAIL_INSTANCE_URL,
      "#0d9488",
      Date.now(),
    );
    return Number(ins.lastInsertRowid);
  });
  return tx();
}

/**
 * Decrypt the api_key:api_secret for an apikey-mode instance. Returns the pair
 * for building the `Authorization: token api_key:api_secret` header. Null for
 * password-mode instances or on decryption failure.
 */
export function getDecryptedApiCredentials(
  instanceId: number,
  yAppUserId: number,
  userKey: Buffer,
): { apiKey: string; apiSecret: string } | null {
  const inst = stmtGetInstance.get(instanceId, yAppUserId) as InstanceRow | undefined;
  if (!inst || inst.auth_mode !== "apikey") return null;
  const creds = stmtGetCreds.get(instanceId) as CredentialsRow | undefined;
  if (!creds) return null;
  try {
    const apiSecret = decryptWithKey(creds.erpnext_password_encrypted, creds.encryption_iv, userKey).toString("utf8");
    stmtTouchCreds.run(Date.now(), instanceId);
    return { apiKey: creds.erpnext_username, apiSecret };
  } catch {
    return null;
  }
}

/** Update an instance's display metadata (name, color, URL). Does NOT touch credentials. */
export function updateInstance(
  instanceId: number,
  yAppUserId: number,
  patch: { name?: string; url?: string; themeColor?: string | null },
): Instance {
  const existing = getInstanceForUser(instanceId, yAppUserId);
  if (!existing) throw new Error("Instance not found");

  const name = patch.name?.trim() ?? existing.name;
  const url = (patch.url?.trim().replace(/\/+$/, "")) ?? existing.url;
  const themeColor = patch.themeColor !== undefined ? patch.themeColor : existing.themeColor;

  if (!isValidName(name)) throw new Error("Name must be between 1 and 100 characters");
  if (!isValidUrl(url)) throw new Error("URL must be a valid http(s) URL");
  if (!isValidColor(themeColor)) throw new Error("Theme color must be a hex color like #14b8a6");

  stmtUpdateInstance.run(name, url, themeColor || null, instanceId, yAppUserId);

  const updated = getInstanceForUser(instanceId, yAppUserId);
  if (!updated) throw new Error("Failed to read back updated instance");
  return updated;
}

/** Delete an instance and its credentials. */
export function deleteInstance(instanceId: number, yAppUserId: number): boolean {
  const result = stmtDeleteInstance.run(instanceId, yAppUserId);
  return result.changes > 0;
}

/**
 * Test connecting to an ERPNext URL with the given credentials, without
 * persisting anything. Used by the "Test connection" button in the
 * add-instance form.
 */
export async function testInstanceConnection(
  url: string,
  erpnextUsername: string,
  erpnextPassword: string,
): Promise<{ ok: boolean; fullName?: string; roles?: string[]; frappeMajorVersion?: number | null; error?: string }> {
  const cleanUrl = url?.trim().replace(/\/+$/, "");
  if (!isValidUrl(cleanUrl)) {
    return { ok: false, error: "URL must be a valid http(s) URL" };
  }
  if (!erpnextUsername || !erpnextPassword) {
    return { ok: false, error: "Username and password required" };
  }
  const loginResult = await loginToErpNext(erpnextUsername, erpnextPassword, cleanUrl);
  if (!loginResult.ok) {
    return { ok: false, error: loginResult.error };
  }

  let frappeMajorVersion: number | null = null;
  if (loginResult.sid) {
    try {
      frappeMajorVersion = await detectFrappeVersion(cleanUrl, loginResult.sid);
    } catch {
      // detection failed — caller decides whether to proceed
    }
  }

  return {
    ok: true,
    fullName: loginResult.fullName,
    roles: loginResult.roles,
    frappeMajorVersion,
  };
}

/**
 * Decrypt and return stored ERPNext credentials for an instance. Used by
 * the per-instance proxy when it needs to (re-)login to ERPNext.
 * Phase 3 will use this.
 */
export function getDecryptedCredentials(
  instanceId: number,
  yAppUserId: number,
  userKey: Buffer,
): { username: string; password: string } | null {
  const inst = stmtGetInstance.get(instanceId, yAppUserId) as InstanceRow | undefined;
  if (!inst) return null;
  const creds = stmtGetCreds.get(instanceId) as CredentialsRow | undefined;
  if (!creds) return null;
  try {
    const password = decryptToString(creds.erpnext_password_encrypted, creds.encryption_iv, userKey);
    stmtTouchCreds.run(Date.now(), instanceId);
    return { username: creds.erpnext_username, password };
  } catch {
    return null;
  }
}

/**
 * Re-detect the Frappe major version for an existing instance and persist it.
 * Uses the cached/active ERPNext session (logging in if needed).
 * Returns the freshly-detected major version.
 */
export async function refreshInstanceVersion(
  instanceId: number,
  yAppUserId: number,
  userKey: Buffer,
): Promise<number> {
  const instance = getInstanceForUser(instanceId, yAppUserId);
  if (!instance) {
    throw new Error("Instance not found");
  }

  // Dynamic import to avoid a static import cycle with instance-proxy.ts
  const { getOrCreateInstanceSession } = await import("./instance-proxy.ts");
  const session = await getOrCreateInstanceSession(yAppUserId, instance, userKey);
  if (!session?.sid) {
    throw new Error("Could not obtain ERPNext session for version detection");
  }

  const major = await detectFrappeVersion(instance.url, session.sid);
  saveDetectedVersion(instanceId, major);
  return major;
}

/**
 * Set or clear the manual Frappe version override for an instance.
 * Pass `null` to clear the override (so the detected version is used).
 * Returns true if the instance exists and the override was applied.
 */
export function setInstanceVersionOverride(
  instanceId: number,
  yAppUserId: number,
  override: number | null,
): boolean {
  const instance = getInstanceForUser(instanceId, yAppUserId);
  if (!instance) return false;

  if (override !== null && override !== 15 && override !== 16) {
    throw new Error("Version override must be 15, 16, or null");
  }

  setVersionOverride(instanceId, override);
  return true;
}
