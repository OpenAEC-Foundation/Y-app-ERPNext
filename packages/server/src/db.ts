/**
 * Y-app central SQLite database.
 *
 * Holds:
 *   - sessions          → legacy ERPNext sessions (used by auth.ts; will be
 *                         migrated/removed in a later phase)
 *   - y_app_users       → Y-app user accounts (email + password hash)
 *   - y_app_sessions    → Y-app login sessions (separate from ERPNext sessions)
 *   - instances         → ERPNext instances enrolled by a Y-app user
 *   - instance_credentials → encrypted ERPNext credentials per instance
 *
 * The same DB file is used by `auth.ts` for the legacy `sessions` table.
 * This module owns the schema for the new tables and exposes the shared
 * Database handle so other modules can run prepared statements.
 */

import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";
import { homedir } from "os";

const dbDir = process.env.ERPNEXT_LEVEL_CONFIG_DIR || join(homedir(), ".erpnext-level");
mkdirSync(dbDir, { recursive: true });

export const db = new Database(join(dbDir, "sessions.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* ─── Schema (idempotent — runs on every server start) ─── */

db.exec(`
  CREATE TABLE IF NOT EXISTS y_app_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_y_app_users_email ON y_app_users(email);

  CREATE TABLE IF NOT EXISTS y_app_sessions (
    id            TEXT PRIMARY KEY,
    y_app_user_id INTEGER NOT NULL,
    created_at    INTEGER NOT NULL,
    expires_at    INTEGER NOT NULL,
    FOREIGN KEY (y_app_user_id) REFERENCES y_app_users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_y_app_sessions_user ON y_app_sessions(y_app_user_id);

  CREATE TABLE IF NOT EXISTS instances (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    y_app_user_id INTEGER NOT NULL,
    name          TEXT NOT NULL,
    url           TEXT NOT NULL,
    theme_color   TEXT,
    created_at    INTEGER NOT NULL,
    FOREIGN KEY (y_app_user_id) REFERENCES y_app_users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_instances_user ON instances(y_app_user_id);

  CREATE TABLE IF NOT EXISTS instance_credentials (
    instance_id                INTEGER PRIMARY KEY,
    erpnext_username           TEXT NOT NULL,
    erpnext_password_encrypted BLOB NOT NULL,
    encryption_iv              BLOB NOT NULL,
    last_used_at               INTEGER,
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
  );
`);

/* ─── Migrations (idempotent column additions) ─── */

function hasColumn(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function addColumnIfMissing(table: string, column: string, definition: string): void {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[db] Migration: added ${table}.${column}`);
  }
}

// Phase 2: per-user PBKDF2 salt + envelope-encrypted user key in sessions
addColumnIfMissing("y_app_users", "pbkdf2_salt", "BLOB");
addColumnIfMissing("y_app_sessions", "wrapped_user_key", "BLOB");
addColumnIfMissing("y_app_sessions", "wrapped_user_key_iv", "BLOB");

// Phase 4: per-account brute-force protection
addColumnIfMissing("y_app_users", "failed_login_count", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("y_app_users", "locked_until", "INTEGER");

// Per-user PBKDF2 iteration count. Existing rows backfill to 100_000 (the
// historic constant); new signups use the current value from crypto.ts.
// Login-time lazy migration upgrades stale users to the current value.
// Storing per-user (instead of a single global) lets us bump the constant
// in the future without breaking older accounts.
addColumnIfMissing("y_app_users", "pbkdf2_iterations", "INTEGER NOT NULL DEFAULT 100000");

// Per-instance Frappe major version detection + manual override.
// `frappe_major_version` is the auto-detected major (defaults to 15 for legacy rows).
// `version_detected_at` is a timestamp (ms) of last successful detection.
// `version_override` is an optional user-set override (null = use detected).
addColumnIfMissing("instances", "frappe_major_version", "INTEGER NOT NULL DEFAULT 15");
addColumnIfMissing("instances", "version_detected_at", "INTEGER");
addColumnIfMissing("instances", "version_override", "INTEGER");

// Phase 2: drop legacy `encryption_salt` column from instance_credentials.
// In Phase 1 we created this table with a per-credential salt; in Phase 2 the
// salt moved to the user level (y_app_users.pbkdf2_salt). The CREATE TABLE
// statement above no longer mentions encryption_salt, but if an older table
// already exists on disk, the NOT NULL column remains and INSERTs fail.
if (hasColumn("instance_credentials", "encryption_salt")) {
  // Safe because no instance has ever been saved (the constraint was blocking
  // every INSERT). If somehow there were rows, this would lose them.
  db.exec(`
    DROP TABLE instance_credentials;
    CREATE TABLE instance_credentials (
      instance_id                INTEGER PRIMARY KEY,
      erpnext_username           TEXT NOT NULL,
      erpnext_password_encrypted BLOB NOT NULL,
      encryption_iv              BLOB NOT NULL,
      last_used_at               INTEGER,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );
  `);
  console.log("[db] Migration: rebuilt instance_credentials without legacy encryption_salt column");
}

// OpenAEC SSO (Y-app-OpenAEC branch): federated login via Zitadel.
// SSO users have no Y-app password, so:
//  - sso_provider / sso_subject identify the federated identity (Zitadel `sub`)
//  - wrapped_user_key(+ _iv) persist a random userKey on the USER row (wrapped
//    with the master key) since there's no password to re-derive it from each
//    login. Password users keep deriving via PBKDF2; these columns stay null.
// Added BEFORE the salt-wipe below, because that wipe now references sso_subject.
addColumnIfMissing("y_app_users", "sso_provider", "TEXT");
addColumnIfMissing("y_app_users", "sso_subject", "TEXT");
addColumnIfMissing("y_app_users", "wrapped_user_key", "BLOB");
addColumnIfMissing("y_app_users", "wrapped_user_key_iv", "BLOB");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_y_app_users_sso_subject ON y_app_users(sso_subject) WHERE sso_subject IS NOT NULL");

// Wipe any Phase 1 test users that don't have a salt — they predate encryption
// and can never be used for instance credential storage. Dev convenience.
// NB: SSO users (sso_subject set) legitimately have no PBKDF2 salt — their
// userKey lives wrapped on the user row instead — so they must be spared.
const wiped = db.prepare("DELETE FROM y_app_users WHERE pbkdf2_salt IS NULL AND sso_subject IS NULL").run();
if (wiped.changes > 0) {
  console.log(`[db] Migration: removed ${wiped.changes} legacy Y-app user(s) without PBKDF2 salt (Phase 1 leftovers)`);
}

// OpenAEC auto-provisioning: an instance can authenticate to ERPNext either
// with username/password (→ sid, the default/legacy path) or with an ERPNext
// api_key:api_secret token (the OpenAEC SuperCloud path — ERPNext rejects
// Zitadel tokens, so the Accounts API mints a per-user api_key+secret).
// auth_mode = 'password' (default/null) | 'apikey'. For apikey instances
// `erpnext_username` holds the api_key and the encrypted blob holds the
// api_secret. `openaec_managed` marks instances auto-provisioned from SSO so
// we can refresh/replace them on each login without clobbering manual ones.
addColumnIfMissing("instances", "auth_mode", "TEXT");
addColumnIfMissing("instances", "openaec_managed", "INTEGER NOT NULL DEFAULT 0");

// Per-session Zitadel tokens (encrypted with master key) — needed for phase-2
// credential-bridge: calling the Accounts API + NextCloud Bearer on behalf of
// the user. Null for password sessions.
addColumnIfMissing("y_app_sessions", "oidc_access_token_enc", "BLOB");
addColumnIfMissing("y_app_sessions", "oidc_refresh_token_enc", "BLOB");
addColumnIfMissing("y_app_sessions", "oidc_token_iv", "BLOB");
addColumnIfMissing("y_app_sessions", "oidc_expires_at", "INTEGER");

// v0.17.x: per-instance synced prefs blob (encrypted with same userKey).
// Stores JSON dictionary van localStorage keys die we cross-device willen syncen
// (IMAP/SMTP creds, NextCloud Talk creds, folder hidden/favorite lists, etc.).
// Idempotente migratie: nieuwe kolommen op bestaande tabel.
addColumnIfMissing("instance_credentials", "synced_prefs_encrypted", "BLOB");
addColumnIfMissing("instance_credentials", "synced_prefs_iv", "BLOB");
addColumnIfMissing("instance_credentials", "synced_prefs_updated_at", "INTEGER");

/* ─── Instance settings table (shared employer → employee settings) ─── */

db.exec(`
  CREATE TABLE IF NOT EXISTS instance_settings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id   INTEGER NOT NULL,
    setting_key   TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at    INTEGER NOT NULL,
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
    UNIQUE(instance_id, setting_key)
  );

  CREATE INDEX IF NOT EXISTS idx_instance_settings_instance ON instance_settings(instance_id);

  /* Migration: older DBs were created before the inline UNIQUE constraint
     existed on instance_settings, so CREATE TABLE IF NOT EXISTS above left
     them without it. The PUT route's INSERT…ON CONFLICT(instance_id,
     setting_key) DO UPDATE then crashes with "ON CONFLICT clause does not
     match any PRIMARY KEY or UNIQUE constraint". A unique index works on
     already-existing tables, so add one here. Idempotent. */
  CREATE UNIQUE INDEX IF NOT EXISTS idx_instance_settings_unique
    ON instance_settings(instance_id, setting_key);
`);

/* ─── Mail accounts table (encrypted email credential vault) ─── */

db.exec(`
  CREATE TABLE IF NOT EXISTS mail_accounts (
    id            TEXT PRIMARY KEY,
    y_app_user_id INTEGER NOT NULL,
    instance_id   INTEGER NOT NULL,
    email         TEXT NOT NULL,
    label         TEXT NOT NULL,
    auth_type     TEXT NOT NULL CHECK(auth_type IN ('erpnext', 'office365', 'manual')),
    imap_host     TEXT NOT NULL,
    imap_port     INTEGER NOT NULL DEFAULT 993,
    imap_secure   INTEGER NOT NULL DEFAULT 1,
    smtp_host     TEXT NOT NULL,
    smtp_port     INTEGER NOT NULL DEFAULT 587,
    smtp_secure   INTEGER NOT NULL DEFAULT 0,
    credentials_encrypted BLOB NOT NULL,
    credentials_iv        BLOB NOT NULL,
    last_tested_at INTEGER,
    last_test_ok   INTEGER,
    created_at     INTEGER NOT NULL,
    FOREIGN KEY (y_app_user_id) REFERENCES y_app_users(id) ON DELETE CASCADE,
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_mail_accounts_user_instance ON mail_accounts(y_app_user_id, instance_id);
`);

/* Migration: widen the mail_accounts.auth_type CHECK to allow 'oauth2'.
   The OpenAEC SuperCloud mailbox (Stalwart) authenticates with XOAUTH2 using
   the user's Zitadel token — a generic OAuth2 path that is neither ERPNext-
   resolved nor Microsoft 365. The original CHECK only allowed
   ('erpnext','office365','manual'); on already-created DBs that inline CHECK
   can't be relaxed with ALTER, so rebuild the table when 'oauth2' is missing.
   auth_type is only a label (no server logic branches on it — the OAuth2
   behaviour comes from the encrypted credential fields), so the rebuild just
   copies every row verbatim. Idempotent: skipped once the new CHECK is in. */
{
  const checkSql = (db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='mail_accounts'"
  ).get() as { sql?: string } | undefined)?.sql || "";
  if (checkSql && !checkSql.includes("'oauth2'")) {
    const rebuild = db.transaction(() => {
      db.exec("ALTER TABLE mail_accounts RENAME TO mail_accounts_old");
      db.exec(`
        CREATE TABLE mail_accounts (
          id            TEXT PRIMARY KEY,
          y_app_user_id INTEGER NOT NULL,
          instance_id   INTEGER NOT NULL,
          email         TEXT NOT NULL,
          label         TEXT NOT NULL,
          auth_type     TEXT NOT NULL CHECK(auth_type IN ('erpnext', 'office365', 'manual', 'oauth2')),
          imap_host     TEXT NOT NULL,
          imap_port     INTEGER NOT NULL DEFAULT 993,
          imap_secure   INTEGER NOT NULL DEFAULT 1,
          smtp_host     TEXT NOT NULL,
          smtp_port     INTEGER NOT NULL DEFAULT 587,
          smtp_secure   INTEGER NOT NULL DEFAULT 0,
          credentials_encrypted BLOB NOT NULL,
          credentials_iv        BLOB NOT NULL,
          last_tested_at INTEGER,
          last_test_ok   INTEGER,
          created_at     INTEGER NOT NULL,
          FOREIGN KEY (y_app_user_id) REFERENCES y_app_users(id) ON DELETE CASCADE,
          FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
        );
      `);
      db.exec(`
        INSERT INTO mail_accounts
          (id, y_app_user_id, instance_id, email, label, auth_type,
           imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure,
           credentials_encrypted, credentials_iv, last_tested_at, last_test_ok, created_at)
        SELECT
           id, y_app_user_id, instance_id, email, label, auth_type,
           imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure,
           credentials_encrypted, credentials_iv, last_tested_at, last_test_ok, created_at
        FROM mail_accounts_old;
      `);
      db.exec("DROP TABLE mail_accounts_old");
      db.exec("CREATE INDEX IF NOT EXISTS idx_mail_accounts_user_instance ON mail_accounts(y_app_user_id, instance_id)");
    });
    rebuild();
    console.log("[db] Migration: widened mail_accounts.auth_type CHECK to include 'oauth2'");
  }
}

console.log("[db] Schema initialized:", join(dbDir, "sessions.db"));
