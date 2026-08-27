/**
 * Webmail pre-fetch state.
 *
 * Lives in `lib/` (not `pages/Webmail.tsx`) so App.tsx can call
 * prefetchInbox() at startup WITHOUT statically importing the Webmail
 * page module. A static import from App.tsx into Webmail.tsx would
 * defeat the lazy-loading and pull the entire Webmail module
 * (~3100 lines, the biggest page in the codebase) into the main bundle.
 *
 * `folderMsgCache` is module-level state shared between this file and
 * Webmail.tsx by import. Both read from and write to the same Map
 * instance, so a prefetch warms the cache that the Webmail page later
 * consumes on mount.
 */

import { getActiveInstanceId } from "./instances";
import { setBadgeCount } from "./badges";

/* ─── Shared types ─── */

export interface MailAddress {
  name: string;
  address: string;
}

export interface MailMessage {
  uid: number;
  subject: string;
  from: MailAddress[];
  to: MailAddress[];
  date: string | null;
  seen: boolean;
  flagged: boolean;
  hasAttachments?: boolean;
  /** Set when message comes from a subfolder search — holds the source folder path */
  _folder?: string;
}

export interface ImapConfig {
  host: string;
  port: string;
  user: string;
  pass: string;
  secure: boolean;
  // OAuth2 fields (Office 365)
  authMode?: "password" | "oauth2";
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUri?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpSecure?: boolean;
}

/* ─── Shared cache ─── */

export const folderMsgCache = new Map<string, { messages: MailMessage[]; total: number; ts: number }>();

/* ─── Shared helpers ─── */

export function getImapConfig(): ImapConfig {
  const id = getActiveInstanceId();
  const authMode = (localStorage.getItem(`pref_${id}_imap_authMode`) || "password") as "password" | "oauth2";
  return {
    host: localStorage.getItem(`pref_${id}_imap_host`) || "",
    port: localStorage.getItem(`pref_${id}_imap_port`) || "993",
    user: localStorage.getItem(`pref_${id}_imap_user`) || "",
    pass: localStorage.getItem(`pref_${id}_imap_pass`) || "",
    secure: localStorage.getItem(`pref_${id}_imap_secure`) !== "false",
    authMode,
    accessToken: localStorage.getItem(`pref_${id}_imap_accessToken`) || undefined,
    refreshToken: localStorage.getItem(`pref_${id}_imap_refreshToken`) || undefined,
    clientId: localStorage.getItem(`pref_${id}_imap_clientId`) || undefined,
    clientSecret: localStorage.getItem(`pref_${id}_imap_clientSecret`) || undefined,
    tokenUri: localStorage.getItem(`pref_${id}_imap_tokenUri`) || undefined,
    smtpHost: localStorage.getItem(`pref_${id}_smtp_host`) || undefined,
    smtpPort: localStorage.getItem(`pref_${id}_smtp_port`) || undefined,
    smtpSecure: localStorage.getItem(`pref_${id}_smtp_secure`) === "true",
  };
}

export function buildQuery(
  config: ImapConfig,
  extra?: Record<string, string>,
  acct?: string | null,
  primaryEmail?: string | null,
): string {
  // Credentials come from the server-side vault (mail_accounts table).
  // Only the account email is passed so the server's ERPNext-fallback
  // resolver can identify the account when no vault account is configured.
  //
  // Voor gedeelde mailboxen: `config.user` is de effectiveUser (shared@... of
  // primary\shared@...). ERPNext heeft geen Email Account voor de shared
  // mailbox; de server moet primary's creds resolven en daarna user
  // vervangen door config.user. Daarvoor sturen we `primaryEmail` apart mee.
  const params = new URLSearchParams();
  if (config.user) params.set("email", config.user);
  if (acct) params.set("acct", acct);
  if (primaryEmail && primaryEmail !== config.user) {
    params.set("primaryEmail", primaryEmail);
  }
  if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return params.toString();
}

/* ─── Shared mailbox support ─── */

export interface SharedMailbox {
  email: string;
  label?: string;
  /** The IMAP user string that actually worked during the test connection.
   * Can be "shared@domain" (direct) or "primary@domain\shared@domain" (backslash).
   * Used as the IMAP user field when connecting to this shared mailbox. */
  effectiveUser?: string;
}

export function getSharedMailboxes(instanceId: string): SharedMailbox[] {
  try {
    const raw = localStorage.getItem(`pref_${instanceId}_shared_mailboxes`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveSharedMailboxes(instanceId: string, mailboxes: SharedMailbox[]): void {
  localStorage.setItem(`pref_${instanceId}_shared_mailboxes`, JSON.stringify(mailboxes));
}

/** Build an ImapConfig for a shared mailbox — copies primary config but
 * replaces `user` with the effective IMAP user for this shared mailbox.
 * The effectiveUser may be "shared@domain" (direct) or
 * "primary@domain\shared@domain" (backslash syntax), depending on what
 * Exchange accepted during the test connection. */
export function getImapConfigForShared(sharedEmail: string, effectiveUser?: string): ImapConfig {
  const primary = getImapConfig();
  return { ...primary, user: effectiveUser || sharedEmail };
}

/* ─── Server-side config push (DEPRECATED) ─── */
// The server-side mail session cache has been removed. Credentials now
// come from the vault (mail_accounts table). These functions are kept as
// no-ops so existing call sites in Webmail.tsx / EmailWidget.tsx don't
// need to be updated in the same change. They will be removed entirely
// once the legacy (non-vault) code path is cleaned up.

/** @deprecated No-op — vault handles credential storage now. */
export async function ensureMailConfigPushed(_acct?: string | null): Promise<void> {}

/** @deprecated No-op — vault handles credential storage now. */
export function invalidateMailConfigPush(_acct?: string | null): void {}

/* ─── Pre-fetch ─── */

/**
 * Restore INBOX badge from localStorage cache so the sidebar shows an
 * unread count immediately on app start — without hitting the IMAP
 * server. The real fetch happens when the user navigates to Webmail.
 */
export function prefetchInbox(): void {
  try {
    const cacheKey = `webmail_inbox_cache_${getActiveInstanceId()}`;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return;
    const cached = JSON.parse(raw) as { messages: MailMessage[]; total: number; ts: number };
    if (!cached?.messages) return;

    // Populate the in-memory cache so Webmail can render instantly
    if (!folderMsgCache.has("INBOX")) {
      folderMsgCache.set("INBOX", { messages: cached.messages, total: cached.total, ts: cached.ts });
    }

    // Set sidebar badge from cached data
    const unread = cached.messages.filter((m) => !m.seen).length;
    setBadgeCount("webmail", unread);
  } catch { /* corrupt cache, ignore */ }
}
