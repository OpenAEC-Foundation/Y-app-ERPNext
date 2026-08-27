/**
 * Y-app account authentication.
 *
 * Self-signup. Email + password. Sessions stored in `y_app_sessions`,
 * cookie name `y_app_session`. This is independent of the ERPNext
 * session flow in `auth.ts` — both run in parallel during the migration
 * to multi-instance.
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db.ts";
import {
  generateSalt,
  deriveUserKey,
  wrapUserKey,
  unwrapUserKey,
  initCrypto,
  encryptWithKey,
  decryptWithKey,
  PBKDF2_ITERATIONS_CURRENT,
} from "./crypto.ts";

/** 32-byte AES key length — matches crypto.ts KEY_LEN. */
const USER_KEY_LEN = 32;

// Initialize the crypto subsystem (creates master key file if missing)
initCrypto();

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const COOKIE_NAME = "y_app_session";
const BCRYPT_ROUNDS = 12;

// Per-account brute-force protection: lock for LOCKOUT_DURATION_MS after
// MAX_FAILED_LOGINS consecutive failures. Counter resets on successful login.
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/** Thrown by verifyYAppLogin when an account is currently locked. */
export class AccountLockedError extends Error {
  constructor(public until: number) {
    super(`Account locked until ${new Date(until).toISOString()}`);
    this.name = "AccountLockedError";
  }
}

export interface YAppUser {
  id: number;
  email: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  pbkdf2_salt: Buffer;
  pbkdf2_iterations: number;
  created_at: number;
  failed_login_count: number;
  locked_until: number | null;
  sso_provider: string | null;
  sso_subject: string | null;
  wrapped_user_key: Buffer | null;
  wrapped_user_key_iv: Buffer | null;
}

interface SessionRow {
  id: string;
  y_app_user_id: number;
  created_at: number;
  expires_at: number;
  wrapped_user_key: Buffer;
  wrapped_user_key_iv: Buffer;
}

/* ─── Prepared statements ─── */

const stmtInsertUser = db.prepare("INSERT INTO y_app_users (email, password_hash, pbkdf2_salt, pbkdf2_iterations, created_at) VALUES (?, ?, ?, ?, ?)");
const stmtFindUserByEmail = db.prepare("SELECT * FROM y_app_users WHERE email = ?");
const stmtFindUserById = db.prepare("SELECT * FROM y_app_users WHERE id = ?");

/* ─── SSO (OpenAEC / Zitadel) prepared statements ─── */
const stmtFindUserBySsoSubject = db.prepare("SELECT * FROM y_app_users WHERE sso_subject = ?");
const stmtInsertSsoUser = db.prepare(
  "INSERT INTO y_app_users (email, password_hash, sso_provider, sso_subject, wrapped_user_key, wrapped_user_key_iv, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
);
const stmtSetSsoOnExisting = db.prepare(
  "UPDATE y_app_users SET sso_provider = ?, sso_subject = ?, wrapped_user_key = ?, wrapped_user_key_iv = ? WHERE id = ?"
);
const stmtStoreSessionTokens = db.prepare(
  "UPDATE y_app_sessions SET oidc_access_token_enc = ?, oidc_refresh_token_enc = ?, oidc_token_iv = ?, oidc_expires_at = ? WHERE id = ?"
);

/* ─── PBKDF2 lazy migration ─── */

const stmtListUserCreds = db.prepare(`
  SELECT c.instance_id, c.erpnext_password_encrypted, c.encryption_iv
  FROM instance_credentials c
  JOIN instances i ON i.id = c.instance_id
  WHERE i.y_app_user_id = ?
`);
const stmtUpdateCredEncryption = db.prepare(`
  UPDATE instance_credentials
  SET erpnext_password_encrypted = ?, encryption_iv = ?
  WHERE instance_id = ?
`);
const stmtUpdateUserIterations = db.prepare(`
  UPDATE y_app_users SET pbkdf2_iterations = ? WHERE id = ?
`);
const stmtDeleteUserSessions = db.prepare(`
  DELETE FROM y_app_sessions WHERE y_app_user_id = ?
`);

interface UserCredRow {
  instance_id: number;
  erpnext_password_encrypted: Buffer;
  encryption_iv: Buffer;
}

/**
 * Lazily upgrade a user from a stale PBKDF2 iteration count to the current
 * one. Re-encrypts every instance credential blob the user owns with a
 * fresh key derived at the new count, updates the iteration column, and
 * deletes any other active sessions for this user (because their wrapped
 * user keys can no longer decrypt the re-encrypted blobs — they'll need
 * to re-login on every device, one-time per migration).
 *
 * Runs inside a single SQLite transaction so a failure mid-migration
 * leaves no partially-re-encrypted state.
 *
 * Returns the new (current-iteration) user key. Caller wraps it into the
 * fresh session that's about to be created.
 */
function migratePbkdf2Iterations(user: UserRow, password: string, oldKey: Buffer): Buffer {
  const newKey = deriveUserKey(password, user.pbkdf2_salt, PBKDF2_ITERATIONS_CURRENT);
  const allCreds = stmtListUserCreds.all(user.id) as UserCredRow[];

  const tx = db.transaction(() => {
    for (const cred of allCreds) {
      const plaintext = decryptWithKey(cred.erpnext_password_encrypted, cred.encryption_iv, oldKey);
      const reEncrypted = encryptWithKey(plaintext, newKey);
      stmtUpdateCredEncryption.run(reEncrypted.ciphertext, reEncrypted.iv, cred.instance_id);
    }
    stmtUpdateUserIterations.run(PBKDF2_ITERATIONS_CURRENT, user.id);
    stmtDeleteUserSessions.run(user.id);
  });
  tx();

  console.log(
    `[crypto] Migrated user ${user.id} (${user.email}) PBKDF2 iterations ` +
    `${user.pbkdf2_iterations} → ${PBKDF2_ITERATIONS_CURRENT}, re-encrypted ${allCreds.length} credential(s), ` +
    `cleared other sessions`
  );
  return newKey;
}

// Brute-force tracking. The CASE references the OLD column value, so
// `failed_login_count + 1` correctly evaluates to the new count.
const stmtIncrementFailedLogin = db.prepare(`
  UPDATE y_app_users
  SET failed_login_count = failed_login_count + 1,
      locked_until = CASE
        WHEN failed_login_count + 1 >= ? THEN ?
        ELSE locked_until
      END
  WHERE id = ?
`);
const stmtResetFailedLogin = db.prepare(
  "UPDATE y_app_users SET failed_login_count = 0, locked_until = NULL WHERE id = ?"
);

const stmtInsertSession = db.prepare("INSERT INTO y_app_sessions (id, y_app_user_id, created_at, expires_at, wrapped_user_key, wrapped_user_key_iv) VALUES (?, ?, ?, ?, ?, ?)");
const stmtFindSession = db.prepare("SELECT * FROM y_app_sessions WHERE id = ? AND expires_at > ?");
const stmtDeleteSession = db.prepare("DELETE FROM y_app_sessions WHERE id = ?");
const stmtCleanupSessions = db.prepare("DELETE FROM y_app_sessions WHERE expires_at <= ?");

// Periodic cleanup of expired Y-app sessions
setInterval(() => {
  stmtCleanupSessions.run(Date.now());
}, 60 * 60 * 1000); // hourly

/* ─── Validation ─── */

function isValidEmail(email: string): boolean {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

/* ─── Core operations ─── */

/**
 * Result of a successful signup or login. The userKey is the AES-256-GCM key
 * derived from the user's password — needed by the caller to create a session
 * (which envelope-encrypts and stores it for later credential decryption).
 */
export interface YAppAuthResult {
  user: YAppUser;
  userKey: Buffer;
}

/** Create a new Y-app user. Returns user + derived key, or throws on validation errors. */
export async function signupYAppUser(email: string, password: string): Promise<YAppAuthResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    throw new Error("Invalid email address");
  }
  if (!isValidPassword(password)) {
    throw new Error("Password must be between 8 and 128 characters");
  }

  const existing = stmtFindUserByEmail.get(normalizedEmail) as UserRow | undefined;
  if (existing) {
    throw new Error("An account with that email already exists");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const salt = generateSalt();
  const result = stmtInsertUser.run(normalizedEmail, passwordHash, salt, PBKDF2_ITERATIONS_CURRENT, Date.now());

  const userKey = deriveUserKey(password, salt, PBKDF2_ITERATIONS_CURRENT);

  return {
    user: { id: Number(result.lastInsertRowid), email: normalizedEmail },
    userKey,
  };
}

/**
 * Verify Y-app credentials. Returns user + derived key on success, null on
 * invalid credentials, or throws AccountLockedError if the account is locked.
 *
 * Failed attempts increment a per-account counter; after MAX_FAILED_LOGINS
 * the account is locked for LOCKOUT_DURATION_MS. Successful login resets it.
 */
export async function verifyYAppLogin(email: string, password: string): Promise<YAppAuthResult | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const row = stmtFindUserByEmail.get(normalizedEmail) as UserRow | undefined;
  if (!row) {
    // Constant-time-ish: still hash to avoid leaking which emails are registered
    await bcrypt.hash(password, BCRYPT_ROUNDS).catch(() => undefined);
    return null;
  }

  // Lockout check happens before bcrypt to avoid wasting CPU on locked accounts.
  if (row.locked_until && row.locked_until > Date.now()) {
    throw new AccountLockedError(row.locked_until);
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
    stmtIncrementFailedLogin.run(MAX_FAILED_LOGINS, lockUntil, row.id);
    return null;
  }
  if (!row.pbkdf2_salt) return null; // Should never happen post-migration

  // Successful login resets the brute-force counter.
  stmtResetFailedLogin.run(row.id);

  // Derive with the user's stored iteration count — must match whatever
  // was used the last time their credentials were encrypted, otherwise
  // decryption will silently produce garbage.
  const storedIterations = row.pbkdf2_iterations || 100_000;
  let userKey = deriveUserKey(password, row.pbkdf2_salt, storedIterations);

  // Lazy upgrade: if this user is below the current target, re-encrypt
  // their stored credentials with a fresh key derived at the new count.
  // Adds ~600ms one-time latency on the user's next login after a bump.
  if (storedIterations < PBKDF2_ITERATIONS_CURRENT) {
    userKey = migratePbkdf2Iterations(row, password, userKey);
  }

  return {
    user: { id: row.id, email: row.email },
    userKey,
  };
}

/**
 * Find or create a Y-app user from a federated (OpenAEC/Zitadel) identity.
 *
 * SSO users have no Y-app password. Their userKey can't be derived via PBKDF2,
 * so on first login we generate a random 32-byte userKey and persist it
 * wrapped-with-the-master-key on the USER row. On subsequent logins we unwrap
 * it from there. This is the same envelope the session uses, just anchored to
 * the user instead of re-derived from a password each time.
 *
 * Matching priority: by sso_subject (stable Zitadel `sub`), then by email
 * (links an existing password-account to SSO on first federated login).
 */
export function findOrCreateSsoUser(input: { sub: string; email: string; provider: string }): YAppAuthResult {
  const sub = String(input.sub);
  const provider = String(input.provider);
  const email = (input.email || "").trim().toLowerCase();

  // 1. Existing SSO user — unwrap their persisted userKey.
  const bySub = stmtFindUserBySsoSubject.get(sub) as UserRow | undefined;
  if (bySub) {
    if (!bySub.wrapped_user_key || !bySub.wrapped_user_key_iv) {
      // Shouldn't happen, but recover gracefully by minting a fresh key.
      const fresh = randomBytes(USER_KEY_LEN);
      const w = wrapUserKey(fresh);
      stmtSetSsoOnExisting.run(provider, sub, w.ciphertext, w.iv, bySub.id);
      return { user: { id: bySub.id, email: bySub.email }, userKey: fresh };
    }
    const userKey = unwrapUserKey(bySub.wrapped_user_key, bySub.wrapped_user_key_iv);
    return { user: { id: bySub.id, email: bySub.email }, userKey };
  }

  // 2. Existing password account with the same email — attach SSO to it and
  //    mint a wrapped userKey. (Existing PBKDF2-encrypted creds, if any, were
  //    encrypted under the password-derived key, not this one — acceptable:
  //    the email-linked account simply gains an SSO login path with a fresh
  //    vault key for SSO-provisioned instances.)
  if (email) {
    const byEmail = stmtFindUserByEmail.get(email) as UserRow | undefined;
    if (byEmail) {
      const userKey = randomBytes(USER_KEY_LEN);
      const w = wrapUserKey(userKey);
      stmtSetSsoOnExisting.run(provider, sub, w.ciphertext, w.iv, byEmail.id);
      return { user: { id: byEmail.id, email: byEmail.email }, userKey };
    }
  }

  // 3. Brand-new SSO user. password_hash is an empty sentinel — bcrypt.compare
  //    against it never succeeds, so the password-login path stays closed.
  const userKey = randomBytes(USER_KEY_LEN);
  const w = wrapUserKey(userKey);
  const safeEmail = email || `${sub}@openaec.local`;
  const result = stmtInsertSsoUser.run(safeEmail, "", provider, sub, w.ciphertext, w.iv, Date.now());
  return { user: { id: Number(result.lastInsertRowid), email: safeEmail }, userKey };
}

/**
 * Create a Y-app session. The user key is wrapped with the master key and
 * stored in the session row, so subsequent requests can recover it from the
 * session cookie alone (without the user re-entering their password).
 */
export function createYAppSession(yAppUserId: number, userKey: Buffer): string {
  const sessionId = randomUUID();
  const now = Date.now();
  const wrapped = wrapUserKey(userKey);
  stmtInsertSession.run(sessionId, yAppUserId, now, now + SESSION_MAX_AGE_MS, wrapped.ciphertext, wrapped.iv);
  return sessionId;
}

/**
 * Persist the OpenAEC/Zitadel tokens on a session, encrypted with the master
 * key. Needed for the phase-2 credential bridge (Accounts API + NextCloud
 * Bearer on behalf of the user). access + refresh share one IV/blob pair via
 * length-prefix join is overkill — we encrypt them separately is also overkill;
 * we store access in its own column and refresh in its own, sharing one IV is
 * NOT safe for GCM, so each gets encrypted independently and we keep one IV
 * column for the access token (refresh re-uses encryptWithKey's own IV).
 */
export function storeSessionOidcTokens(
  sessionId: string,
  tokens: { accessToken: string; refreshToken?: string; expiresInSec?: number }
): void {
  const acc = wrapUserKey(Buffer.from(tokens.accessToken, "utf8"));
  const ref = tokens.refreshToken
    ? wrapUserKey(Buffer.from(tokens.refreshToken, "utf8"))
    : null;
  // Store the access-token IV in oidc_token_iv; prefix the refresh blob with
  // its own 12-byte IV so it's self-describing (refresh decrypt reads it back).
  const refBlob = ref ? Buffer.concat([ref.iv, ref.ciphertext]) : null;
  const expiresAt = tokens.expiresInSec ? Date.now() + tokens.expiresInSec * 1000 : null;
  stmtStoreSessionTokens.run(acc.ciphertext, refBlob, acc.iv, expiresAt, sessionId);
}

/** Look up the Y-app user for a session id. Returns null if missing/expired. */
export function getYAppUserForSession(sessionId: string): YAppUser | null {
  if (!sessionId) return null;
  const session = stmtFindSession.get(sessionId, Date.now()) as SessionRow | undefined;
  if (!session) return null;
  const user = stmtFindUserById.get(session.y_app_user_id) as UserRow | undefined;
  if (!user) return null;
  return { id: user.id, email: user.email };
}

/**
 * Look up a session AND recover the user key by unwrapping it with the
 * master key. Used by instance-credentials code that needs to encrypt or
 * decrypt ERPNext passwords on behalf of the user.
 */
export function getYAppSessionWithKey(sessionId: string): { user: YAppUser; userKey: Buffer } | null {
  if (!sessionId) return null;
  const session = stmtFindSession.get(sessionId, Date.now()) as SessionRow | undefined;
  if (!session) return null;
  const user = stmtFindUserById.get(session.y_app_user_id) as UserRow | undefined;
  if (!user) return null;
  if (!session.wrapped_user_key || !session.wrapped_user_key_iv) return null;
  try {
    const userKey = unwrapUserKey(session.wrapped_user_key, session.wrapped_user_key_iv);
    return { user: { id: user.id, email: user.email }, userKey };
  } catch {
    return null;
  }
}

/** Destroy a Y-app session. */
export function destroyYAppSession(sessionId: string): void {
  if (!sessionId) return;
  stmtDeleteSession.run(sessionId);
}

/* ─── Cookie helpers ─── */

export function setYAppSessionCookie(res: Response, sessionId: string): void {
  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

export function clearYAppSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function getYAppSessionId(req: Request): string {
  return (req.cookies && req.cookies[COOKIE_NAME]) || "";
}

/* ─── Middleware ─── */

/** Express middleware that requires a valid Y-app session and attaches `req.yAppUser`. */
export function requireYAppAuth(req: Request, res: Response, next: NextFunction): void {
  const sid = getYAppSessionId(req);
  const user = getYAppUserForSession(sid);
  if (!user) {
    res.status(401).json({ error: "Y-app authentication required" });
    return;
  }
  (req as Request & { yAppUser?: YAppUser }).yAppUser = user;
  next();
}

export const Y_APP_COOKIE_NAME = COOKIE_NAME;
