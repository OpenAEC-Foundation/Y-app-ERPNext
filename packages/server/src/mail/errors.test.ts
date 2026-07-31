import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeMailError, isSmtpConnectionError } from "./errors.ts";

test("sanitizeMailError: network categories map to safe status+message", () => {
  assert.deepEqual(sanitizeMailError(new Error("ETIMEDOUT connecting")), { status: 504, message: "Connection timed out. Check host, port, and firewall." });
  assert.equal(sanitizeMailError(new Error("getaddrinfo ENOTFOUND mail.x")).status, 502);
  assert.equal(sanitizeMailError(new Error("connect ECONNREFUSED 1.2.3.4:993")).status, 502);
  assert.equal(sanitizeMailError(new Error("read ECONNRESET")).status, 502);
});

test("sanitizeMailError: TLS is matched BEFORE auth (cert 'authority' must not read as auth)", () => {
  const r = sanitizeMailError(new Error("self signed certificate in certificate authority chain"));
  assert.equal(r.status, 502);
  assert.match(r.message, /TLS handshake/);
});

test("sanitizeMailError: auth and OAuth categories", () => {
  assert.equal(sanitizeMailError(new Error("AUTHENTICATIONFAILED")).status, 401);
  assert.equal(sanitizeMailError(new Error("invalid_grant")).status, 401);
  assert.match(sanitizeMailError(new Error("XOAUTH2 rejected")).message, /FullAccess/);
});

test("sanitizeMailError: shared-mailbox 'mailbox does not exist' -> 404, unknown -> 500", () => {
  assert.equal(sanitizeMailError(new Error("Mailbox does not exist")).status, 404);
  assert.deepEqual(sanitizeMailError(new Error("something weird")), { status: 500, message: "Mail server error." });
  assert.equal(sanitizeMailError("plain string").status, 500);
});

test("isSmtpConnectionError: true only for connection-class codes", () => {
  for (const code of ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ESOCKET", "EHOSTUNREACH", "EPIPE"]) {
    assert.equal(isSmtpConnectionError({ code }), true, code);
  }
});

test("isSmtpConnectionError: false for auth/recipient/real errors (must surface, not relay)", () => {
  assert.equal(isSmtpConnectionError({ code: "EAUTH" }), false);
  assert.equal(isSmtpConnectionError({ code: "EENVELOPE" }), false);
  assert.equal(isSmtpConnectionError({}), false);
  assert.equal(isSmtpConnectionError(null), false);
  assert.equal(isSmtpConnectionError(new Error("no code")), false);
});
