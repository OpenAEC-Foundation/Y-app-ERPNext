import { test } from "node:test";
import assert from "node:assert/strict";

import { isImapAuthError } from "./imap-auth-error.ts";

test("detects ImapFlow's authenticationFailed flag", () => {
  assert.equal(isImapAuthError({ authenticationFailed: true }), true);
});

test("detects auth-related error codes", () => {
  assert.equal(isImapAuthError({ code: "EAUTH" }), true);
  assert.equal(isImapAuthError({ code: "AUTHENTICATIONFAILED" }), true);
});

test("detects auth failures from the message/response text", () => {
  assert.equal(isImapAuthError(new Error("[AUTHENTICATIONFAILED] Authentication failed")), true);
  assert.equal(isImapAuthError(new Error("Authentication failed")), true);
  assert.equal(isImapAuthError(new Error("Invalid credentials")), true);
  assert.equal(isImapAuthError({ responseText: "NO [AUTHENTICATIONFAILED] Invalid login" }), true);
  assert.equal(isImapAuthError(new Error("LOGIN failed")), true);
});

test("does NOT flag connection/network errors as auth", () => {
  assert.equal(isImapAuthError(new Error("read ECONNRESET")), false);
  assert.equal(isImapAuthError({ code: "ECONNRESET" }), false);
  assert.equal(isImapAuthError(new Error("IMAP verbinding timeout na 30s")), false);
  assert.equal(isImapAuthError(new Error("Mailserver weigerde recent de IMAP-verbinding (throttle); backoff nog 200s.")), false);
  assert.equal(isImapAuthError(new Error("Connection closed unexpectedly")), false);
});

test("handles non-error inputs safely", () => {
  assert.equal(isImapAuthError(null), false);
  assert.equal(isImapAuthError(undefined), false);
  assert.equal(isImapAuthError("authentication failed"), false);
});
