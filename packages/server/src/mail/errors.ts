/**
 * Mail error classification — pure helpers extracted from mail.ts so they can
 * be unit-tested in isolation.
 *
 *  - `sanitizeMailError`: map a raw IMAP/network error to a user-safe
 *    { status, message }. The raw error (with user@host:port) is logged
 *    server-side by the caller; only the category label reaches the client.
 *  - `isSmtpConnectionError`: decide whether a send failure is a connection-class
 *    error (→ ERPNext-relay fallback) vs a real auth/recipient error (→ surface).
 */

// Map IMAP / network errors to a small set of user-safe messages. The raw
// error (with user@host:port) is logged server-side; only the category
// label reaches the client, so credentials and infra detail don't leak
// into browser dev-tools, Sentry, or downstream logs the customer runs.
export function sanitizeMailError(err: unknown): { status: number; message: string } {
  const raw = (err as Error)?.message || String(err);
  const m = raw.toLowerCase();
  // Checked in priority order: specific categories → generic. TLS is
  // matched BEFORE auth because cert-chain errors often contain the
  // substring "authority" ("self signed certificate in certificate
  // authority chain"), which would otherwise be misclassified as an
  // auth failure and lead the user to change their password when the
  // real fix is port/secure/cert.
  if (m.includes("timeout") || m.includes("etimedout")) return { status: 504, message: "Connection timed out. Check host, port, and firewall." };
  if (m.includes("enotfound") || m.includes("getaddrinfo")) return { status: 502, message: "Hostname not found." };
  if (m.includes("econnrefused")) return { status: 502, message: "Connection refused — check the port." };
  if (m.includes("tls") || m.includes("ssl") || m.includes("certificate") || m.includes("cert ") || m.includes("self signed") || m.includes("altnames")) return { status: 502, message: "TLS handshake failed — check the secure setting and port." };
  if (m.includes("econnreset") || m.includes("socket disconnected")) return { status: 502, message: "Connection dropped by the mail server." };
  // Wave 0b shared-mailbox diagnostics: O365 XOAUTH2-rejectie bij shared
  // mailbox zonder FullAccess valt OOK in deze categorie. Specifieker
  // message zodat de gebruiker meteen weet of het permissie i.p.v.
  // wachtwoord is.
  if (m.includes("invalid_grant") || m.includes("xoauth2")) return { status: 401, message: "OAuth2 token rejected. Voor gedeelde mailboxen: heeft de primaire account FullAccess gekregen via Add-MailboxPermission?" };
  if (m.includes("authenticationfailed") || m.includes("invalid credentials") || m.includes("login failed") || m.includes("authentication")) return { status: 401, message: "Authentication failed. Check username and password." };
  // Wave 0b: O365 stuurt soms "Mailbox does not exist" als de delegated-
  // access niet correct geconfigureerd is voor de shared mailbox.
  if (m.includes("mailbox does not exist") || m.includes("user not found")) return { status: 404, message: "Gedeelde mailbox niet bereikbaar. Check Exchange-permissies." };
  return { status: 500, message: "Mail server error." };
}

/**
 * Connection-class SMTP failures that mean "this server can't reach the mail
 * host" (network/IP block, DNS, timeout) — NOT auth (EAUTH) or recipient
 * (EENVELOPE) errors, which are real and must surface to the user. When a send
 * fails with one of these and an ERPNext session is available, mailSend falls
 * back to relaying through ERPNext (which sends from its own, accepted IP).
 */
const SMTP_CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ESOCKET", "ECONNECTION",
  "EHOSTUNREACH", "EHOSTDOWN", "ENETUNREACH", "EDNS", "EAI_AGAIN", "EPIPE",
]);

export function isSmtpConnectionError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return typeof code === "string" && SMTP_CONNECTION_ERROR_CODES.has(code);
}
