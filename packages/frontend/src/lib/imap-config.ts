/**
 * IMAP-config localStorage helpers + vault-account ordering, extracted verbatim
 * from pages/Webmail.tsx.
 */
import { getActiveInstanceId } from "./instances";
import type { ImapConfig } from "./webmail-prefetch";

/** Fase 3: ruim de localStorage-primary (oude Webmail "e-mailinstellingen")
 * op. Gebruikt zodra dezelfde mailbox als vault-account bestaat, zodat er één
 * bron is (de server-vault) en geen schaduw-primary in platte browseropslag. */
export function clearPrimaryImapConfig(instanceId: string) {
  const keys = [
    "imap_host", "imap_port", "imap_user", "imap_pass", "imap_secure", "imap_authMode",
    "imap_accessToken", "imap_refreshToken", "imap_clientId", "imap_clientSecret", "imap_tokenUri",
    "smtp_host", "smtp_port", "smtp_secure",
  ];
  for (const k of keys) {
    try { localStorage.removeItem(`pref_${instanceId}_${k}`); } catch { /* ignore */ }
  }
}

/** Opgeslagen volgorde van vault-account-tabs (array van account-IDs), per
 * instance. Zo kun je de tabs slepen-en-neerzetten (Chrome-stijl) en blijft de
 * volgorde bewaard. Per apparaat (localStorage). */
export function loadAccountOrder(instanceId: string): string[] {
  try { const raw = localStorage.getItem(`pref_${instanceId}_mail_account_order`); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
export function saveAccountOrder(instanceId: string, order: string[]): void {
  try { localStorage.setItem(`pref_${instanceId}_mail_account_order`, JSON.stringify(order)); } catch { /* ignore */ }
}
/** Sorteer vault-accounts volgens de opgeslagen volgorde; onbekende/nieuwe
 * accounts achteraan in hun oorspronkelijke volgorde. */
export function orderVaultAccounts<T extends { id: string }>(accounts: T[], order: string[]): T[] {
  if (!order.length) return accounts;
  const idx = new Map(order.map((id, i) => [id, i] as const));
  return [...accounts].sort((a, b) =>
    (idx.has(a.id) ? idx.get(a.id)! : Infinity) - (idx.has(b.id) ? idx.get(b.id)! : Infinity));
}

// Strip scheme, path, ports, surrounding whitespace so pasted URLs
// like "https://mail.example.com/" normalize to "mail.example.com".
// Port lives in its own field; keep this function narrow to the hostname.
export function sanitizeHost(raw: string): string {
  return raw
    .trim()
    .replace(/^\w+:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

export function saveImapConfig(config: ImapConfig) {
  const id = getActiveInstanceId();
  localStorage.setItem(`pref_${id}_imap_host`, config.host);
  localStorage.setItem(`pref_${id}_imap_port`, config.port);
  localStorage.setItem(`pref_${id}_imap_user`, config.user);
  localStorage.setItem(`pref_${id}_imap_pass`, config.pass);
  localStorage.setItem(`pref_${id}_imap_secure`, String(config.secure));
  localStorage.setItem(`pref_${id}_imap_authMode`, config.authMode || "password");
  // OAuth2 fields
  if (config.accessToken) localStorage.setItem(`pref_${id}_imap_accessToken`, config.accessToken);
  if (config.refreshToken) localStorage.setItem(`pref_${id}_imap_refreshToken`, config.refreshToken);
  if (config.clientId) localStorage.setItem(`pref_${id}_imap_clientId`, config.clientId);
  if (config.clientSecret) localStorage.setItem(`pref_${id}_imap_clientSecret`, config.clientSecret);
  if (config.tokenUri) localStorage.setItem(`pref_${id}_imap_tokenUri`, config.tokenUri);
  // SMTP fields from auto-config
  if (config.smtpHost) localStorage.setItem(`pref_${id}_smtp_host`, config.smtpHost);
  if (config.smtpPort) localStorage.setItem(`pref_${id}_smtp_port`, config.smtpPort);
  if (config.smtpSecure !== undefined) localStorage.setItem(`pref_${id}_smtp_secure`, String(config.smtpSecure));
  // For OAuth2, SMTP user = IMAP user
  if (config.authMode === "oauth2") {
    localStorage.setItem(`pref_${id}_smtp_user`, config.user);
  }
}
