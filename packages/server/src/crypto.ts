/**
 * Y-app credential encryption — master-key / envelope layer.
 *
 * The pure crypto primitives (PBKDF2 derivation, AES-256-GCM encrypt/decrypt)
 * live in `crypto-primitives.ts` and are re-exported from here, so existing
 * `import … from "./crypto.ts"` call sites are unchanged. This module adds the
 * server-side master key: a random 32-byte key stored in a file outside the DB
 * that wraps each user key when it's persisted in the session row, so DB
 * compromise alone doesn't reveal active session keys.
 *
 * Two layers:
 *   1. PBKDF2 derives a per-user key from the user's Y-app password + per-user salt.
 *   2. AES-256-GCM encrypts ERPNext credentials with that user key.
 *
 * Threat model:
 *   - DB stolen, master key file safe   → encrypted creds remain encrypted
 *   - DB + master key both stolen       → active sessions can be decrypted
 *   - User Y-app password stolen        → that user's creds can be decrypted
 *   - User forgets Y-app password       → their stored creds are unrecoverable
 */

import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { db } from "./db.ts";
import {
  encryptWithKey,
  decryptWithKey,
  KEY_LEN,
  type EncryptedBlob,
} from "./crypto-primitives.ts";

// Re-export the pure primitives so `import … from "./crypto.ts"` keeps working
// for every existing call site (encryptWithKey, decryptWithKey, deriveUserKey,
// generateSalt, decryptToString, decryptToJson, EncryptedBlob, PBKDF2_ITERATIONS_CURRENT, …).
export * from "./crypto-primitives.ts";

const MASTER_KEY_PATH = process.env.YAPP_MASTER_KEY_PATH
  || join(process.env.ERPNEXT_LEVEL_CONFIG_DIR || join(homedir(), ".erpnext-level"), "master.key");

let masterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (masterKey) return masterKey;
  if (existsSync(MASTER_KEY_PATH)) {
    masterKey = readFileSync(MASTER_KEY_PATH);
    if (masterKey.length !== KEY_LEN) {
      throw new Error(`[crypto] Master key at ${MASTER_KEY_PATH} is not ${KEY_LEN} bytes (got ${masterKey.length})`);
    }
    return masterKey;
  }

  // Master key file is missing. This is either:
  //   (a) a brand-new install — operator must opt in with YAPP_BOOTSTRAP=1
  //   (b) a misconfigured deploy — wrong volume mounted, file deleted by
  //       accident, YAPP_MASTER_KEY_PATH pointing at the wrong location,
  //       fresh container without the secrets volume attached, etc.
  //
  // (b) is catastrophic: silently generating a fresh key would orphan
  // every encrypted credential already in the DB, permanently. We refuse
  // to start the server unless an explicit gesture says "yes, generate
  // a new vault from scratch."
  if (process.env.YAPP_BOOTSTRAP !== "1") {
    throw new Error(
      `[crypto] Master key file not found at ${MASTER_KEY_PATH}.\n\n` +
      `Refusing to start. If this is the first-ever install, set\n` +
      `  YAPP_BOOTSTRAP=1\n` +
      `in the environment and restart to generate a new master key.\n\n` +
      `If this is an existing install, the master key has gone missing.\n` +
      `INVESTIGATE before bootstrapping:\n` +
      `  • Is the secrets volume mounted?\n` +
      `  • Is YAPP_MASTER_KEY_PATH pointing at the right location?\n` +
      `  • Was the file deleted? Restore from backup.\n\n` +
      `Generating a new key now would PERMANENTLY ORPHAN every encrypted\n` +
      `ERPNext credential in the database. There is no recovery.`
    );
  }

  // Bootstrap was explicitly requested. Final safety check: if the DB
  // already holds encrypted credentials, refuse — those are unrecoverable
  // without the original master key, and a bootstrap on top of them
  // silently destroys data even though the operator opted in.
  try {
    const row = db.prepare("SELECT COUNT(*) as n FROM instance_credentials").get() as { n: number } | undefined;
    if (row && row.n > 0) {
      throw new Error(
        `[crypto] YAPP_BOOTSTRAP=1 was set, but ${row.n} encrypted credential(s)\n` +
        `already exist in the database. Bootstrapping a new master key now\n` +
        `would permanently orphan them.\n\n` +
        `Restore the original master key at ${MASTER_KEY_PATH} before starting,\n` +
        `or wipe the instance_credentials table if you really mean to start over.`
      );
    }
  } catch (err) {
    // If the table doesn't exist yet (truly fresh database), the query
    // throws "no such table". That's the expected first-install path —
    // re-throw anything else.
    if (err instanceof Error && !/no such table/i.test(err.message)) throw err;
  }

  masterKey = randomBytes(KEY_LEN);
  writeFileSync(MASTER_KEY_PATH, masterKey, { mode: 0o600 });
  console.warn(`[crypto] YAPP_BOOTSTRAP=1 — generated new master key at ${MASTER_KEY_PATH}`);
  console.warn(`[crypto] BACK THIS FILE UP NOW. If you lose it, every stored ERPNext credential becomes unrecoverable.`);
  return masterKey;
}

/** Initialize the crypto subsystem (creates master key file if missing). */
export function initCrypto(): void {
  getMasterKey();
}

/** Wrap a user-derived key with the master key for storage in the session row. */
export function wrapUserKey(userKey: Buffer): EncryptedBlob {
  return encryptWithKey(userKey, getMasterKey());
}

/** Unwrap a user key that was wrapped with the master key. */
export function unwrapUserKey(wrapped: Buffer, iv: Buffer): Buffer {
  return decryptWithKey(wrapped, iv, getMasterKey());
}
