/**
 * Herkent of een IMAP-connect/login-fout een AUTHENTICATIE-fout is (foute creds)
 * versus een tijdelijke connectie-/netwerkfout.
 *
 * Waarom load-bearing: een auth-fout mag NIET in een retry-lus belanden. Het
 * lost niets op (de creds blijven fout) en herhaalde mislukte LOGINs vanaf één
 * IP triggeren de fail2ban van de mailserver (bv. Stalwart) → IP-ban die álle
 * accounts blokkeert. Connectie-fouten (ECONNRESET/timeout) mogen wél met
 * exponentiële backoff opnieuw; auth-fouten krijgen een lange, vaste backoff.
 */
export function isImapAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { authenticationFailed?: unknown; code?: unknown; message?: unknown; responseText?: unknown; response?: unknown };

  if (e.authenticationFailed === true) return true;

  const code = String(e.code ?? "").toUpperCase();
  if (code === "EAUTH" || code === "AUTHENTICATIONFAILED") return true;

  const text = `${e.message ?? ""} ${e.responseText ?? ""} ${e.response ?? ""}`.toLowerCase();
  return /authenticationfailed|authentication failed|invalid credentials|invalid login|login failed|incorrect (?:username|password)|\bauthentication error\b/.test(text);
}
