import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import {
  deriveUserKey,
  generateSalt,
  encryptWithKey,
  decryptWithKey,
  decryptToString,
  decryptToJson,
  KEY_LEN,
} from "./crypto-primitives.ts";

const key = randomBytes(KEY_LEN);

test("encrypt/decrypt round-trips a string", () => {
  const { iv, ciphertext } = encryptWithKey("hello wörld", key);
  assert.equal(decryptWithKey(ciphertext, iv, key).toString("utf8"), "hello wörld");
});

test("encrypt/decrypt round-trips a Buffer", () => {
  const data = randomBytes(64);
  const { iv, ciphertext } = encryptWithKey(data, key);
  assert.deepEqual(decryptWithKey(ciphertext, iv, key), data);
});

test("decryptToString returns the UTF-8 plaintext", () => {
  const { iv, ciphertext } = encryptWithKey("pässwörd", key);
  assert.equal(decryptToString(ciphertext, iv, key), "pässwörd");
});

test("decryptToJson round-trips an object", () => {
  const obj = { user: "piet@3bm.co.nl", port: 993, secure: true, tokens: ["a", "b"] };
  const { iv, ciphertext } = encryptWithKey(JSON.stringify(obj), key);
  assert.deepEqual(decryptToJson<typeof obj>(ciphertext, iv, key), obj);
});

test("decryptWithKey throws with the wrong key (auth tag mismatch)", () => {
  const { iv, ciphertext } = encryptWithKey("secret", key);
  const wrongKey = randomBytes(KEY_LEN);
  assert.throws(() => decryptWithKey(ciphertext, iv, wrongKey));
});

test("decryptWithKey throws on ciphertext shorter than the auth tag", () => {
  assert.throws(() => decryptWithKey(randomBytes(4), randomBytes(12), key), /Ciphertext too short/);
});

test("encryptWithKey rejects a key of the wrong length", () => {
  assert.throws(() => encryptWithKey("x", randomBytes(16)), /Key must be 32 bytes/);
});

test("deriveUserKey is deterministic for the same password/salt/iterations", () => {
  const salt = generateSalt();
  const a = deriveUserKey("hunter2", salt, 1000);
  const b = deriveUserKey("hunter2", salt, 1000);
  assert.deepEqual(a, b);
  assert.equal(a.length, KEY_LEN);
});

test("deriveUserKey diverges when the iteration count differs", () => {
  const salt = generateSalt();
  assert.notDeepEqual(deriveUserKey("hunter2", salt, 1000), deriveUserKey("hunter2", salt, 2000));
});

test("generateSalt returns 16 random bytes", () => {
  assert.equal(generateSalt().length, 16);
  assert.notDeepEqual(generateSalt(), generateSalt());
});
