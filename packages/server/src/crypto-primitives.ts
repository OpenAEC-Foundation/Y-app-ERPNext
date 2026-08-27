/**
 * Pure, dependency-free crypto primitives for Y-app.
 *
 * This module deliberately imports NOTHING but Node's `crypto`. It holds the
 * stateless building blocks — PBKDF2 key derivation and AES-256-GCM
 * encrypt/decrypt — so they can be unit-tested in isolation without dragging
 * in the DB (whose module has import-time side effects) or the master-key
 * file. The master-key / envelope logic lives in `crypto.ts`, which imports
 * and re-exports everything here so existing `import … from "./crypto.ts"`
 * call sites keep working unchanged.
 *
 * See `crypto.ts` for the full two-layer threat model.
 */

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from "crypto";

/**
 * Current PBKDF2 iteration count for newly-created users.
 *
 * OWASP recommends 600_000+ for PBKDF2-HMAC-SHA256 as of 2023. Bumping
 * this constant only affects new signups; existing users keep the value
 * stored in `y_app_users.pbkdf2_iterations` until they log in, at which
 * point yapp-auth.ts lazily upgrades them by re-encrypting their stored
 * instance credentials with a fresh key derived at the new count.
 */
export const PBKDF2_ITERATIONS_CURRENT = 600_000;

const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";
const SALT_LEN = 16;
const IV_LEN = 12; // GCM standard
export const KEY_LEN = 32;
const AUTH_TAG_LEN = 16;

/** Generate a random per-user salt for PBKDF2. */
export function generateSalt(): Buffer {
  return randomBytes(SALT_LEN);
}

/**
 * Derive a 32-byte encryption key from a password and salt using PBKDF2-SHA256.
 *
 * The `iterations` parameter is required and must match what was used the
 * last time this user's data was encrypted — passing the wrong count
 * produces a different key and breaks decryption silently. Callers should
 * read the value from `y_app_users.pbkdf2_iterations` for existing users
 * and use `PBKDF2_ITERATIONS_CURRENT` for new ones.
 */
export function deriveUserKey(password: string, salt: Buffer, iterations: number): Buffer {
  return pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST);
}

export interface EncryptedBlob {
  iv: Buffer;
  ciphertext: Buffer; // includes auth tag at the end
}

/** AES-256-GCM encrypt with a 32-byte key. Auth tag is appended to ciphertext. */
export function encryptWithKey(plaintext: Buffer | string, key: Buffer): EncryptedBlob {
  if (key.length !== KEY_LEN) throw new Error(`Key must be ${KEY_LEN} bytes`);
  const pt = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(pt), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { iv, ciphertext: Buffer.concat([encrypted, authTag]) };
}

/** AES-256-GCM decrypt. Expects auth tag at the end of the ciphertext. */
export function decryptWithKey(ciphertext: Buffer, iv: Buffer, key: Buffer): Buffer {
  if (key.length !== KEY_LEN) throw new Error(`Key must be ${KEY_LEN} bytes`);
  if (ciphertext.length < AUTH_TAG_LEN) throw new Error("Ciphertext too short");
  const authTag = ciphertext.subarray(ciphertext.length - AUTH_TAG_LEN);
  const ct = ciphertext.subarray(0, ciphertext.length - AUTH_TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Decrypt an AES-256-GCM blob and return the UTF-8 plaintext.
 *
 * Convenience over `decryptWithKey(...).toString("utf8")`, which was
 * repeated verbatim at every stored-credential read site (instances,
 * mail accounts, synced prefs). Callers still own their own try/catch.
 */
export function decryptToString(ciphertext: Buffer, iv: Buffer, key: Buffer): string {
  return decryptWithKey(ciphertext, iv, key).toString("utf8");
}

/**
 * Decrypt an AES-256-GCM blob and `JSON.parse` the UTF-8 plaintext.
 * Used for the credential/prefs blobs that are stored as JSON.
 */
export function decryptToJson<T = unknown>(ciphertext: Buffer, iv: Buffer, key: Buffer): T {
  return JSON.parse(decryptToString(ciphertext, iv, key)) as T;
}
