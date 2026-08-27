/**
 * IMAP mail backend with aggressive caching.
 *
 * - MailAccountCache keeps a persistent IMAP connection per account
 * - ALL message bodies (text + html, excl. attachments) are pre-loaded into memory
 * - Folders and message lists refresh every 30s
 * - New messages get their bodies fetched automatically in background
 * - API requests served from cache instantly (< 5ms)
 * - SMTP sending via nodemailer
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createTransport } from "nodemailer";
import type { Request, Response } from "express";
import { ERPNEXT_URL } from "./auth.ts";
import { proxyRequest, erpRequestContext, erpnextSendEmail, uploadPrivateFile, hasMatchingOutgoingAccount } from "./erpnext-client.ts";
import { getDecryptedMailCredentials } from "./mail-accounts.ts";
import { createConnectGate } from "./imap-connect-gate.ts";
import { resolveSentFolder } from "./sent-folder.ts";
import { isImapAuthError } from "./imap-auth-error.ts";
import { createConnectionLimiter } from "./imap-conn-registry.ts";
import { sanitizeMailError, isSmtpConnectionError } from "./mail/errors.ts";
import { extractEmailAddress, extractDisplayName } from "./mail/address.ts";
// Gedeeld wire-contract met de desktop fetch-adapter (Fase 5 drift-safety).
// Type-only — esbuild/tsx strippen dit weg; nul runtime-effect.
import type { MailFoldersResponse } from "../../frontend/src/lib/api-shapes.ts";

/* ─── IMAP connect-gate ─── */
// Serialiseert + spreidt álle IMAP-connects per host (zie imap-connect-gate.ts).
// Voorkomt dat een reconnect-burst (laptop wake / socket-drop, ook over
// meerdere accounts op dezelfde host) de per-account/IP-rate-limit van de
// mailserver tikt. Alle drie de connect-sites (ensureConnected, startIdleLoop,
// withClient) routen hier doorheen.
// Bewaker: serialiseer + spreid (1s) álle IMAP-connects per host, én een harde
// bovengrens van max 10 connect-pogingen per 60s per host. Zo kan een storm,
// retry-flood of veel accounts de mailserver nooit overspoelen (fail2ban-veilig).
const imapConnectGate = createConnectGate({ spacingMs: 1000, maxPerWindow: 10, windowMs: 60_000 });

// Harde bovengrens op het AANTAL gelijktijdig open IMAP-verbindingen per host:
// per account houden we een fetch- + een IDLE-verbinding open, dus ~2 per
// account. Met wat overlap bij reconnect is 8 ruim voor een paar accounts en
// kapt het structureel als er door een lek/churn meer ontstaan (sluit de
// oudste). Voorkomt dat het aantal verbindingen op de mailserver oploopt tot
// die (of de firewall) het VPS-IP blokkeert.
const imapConnLimiter = createConnectionLimiter(8);

/* ─── Error sanitization ─── */

function sendMailError(res: Response, err: unknown, context: string, opts: { authStatus?: number; req?: Request } = {}): void {
  const { status, message } = sanitizeMailError(err);
  const raw = (err as Error)?.message || String(err);
  // Wave 0b diagnostics: log enough context to distinguish primary vs
  // shared-mailbox failure paths from server logs alone (productie blijft
  // op afstand debugbaar als de browser alleen 500 ziet). We loggen geen
  // wachtwoorden — alleen welke account/acct/primary triplet is geraakt.
  const q = opts.req?.query || {};
  const ctxBits: string[] = [];
  if (q.email) ctxBits.push(`email=${q.email}`);
  if (q.acct) ctxBits.push(`acct=${q.acct}`);
  if (q.primaryEmail) ctxBits.push(`primary=${q.primaryEmail}`);
  if (q.folder) ctxBits.push(`folder=${q.folder}`);
  const ctxStr = ctxBits.length ? ` (${ctxBits.join(" ")})` : "";
  const stack = (err as Error)?.stack;
  const stackTop = stack ? stack.split("\n").slice(0, 3).join(" | ") : "";
  console.error(`[mail] ${context} → ${status}${ctxStr}: ${raw}${stackTop ? "\n  " + stackTop : ""}`);

  // Wave 0b shared-mailbox fix: bij auth-failures (401) of TLS/connectie-
  // resets (502) is de gecachte token-set rot. resolvedCredsCache houdt 4
  // min vast — zonder invalidate-pad zou élke klik 4 min lang dezelfde
  // rotte token herbruiken. Flush het cache-slot zodat de volgende call
  // verse creds resolved.
  if ((status === 401 || status === 502) && opts.req) {
    const erpnextSid = (opts.req as any).erpnextSid as string | undefined;
    const email = q.email as string | undefined;
    const primaryEmail = q.primaryEmail as string | undefined;
    if (erpnextSid && email) {
      invalidateResolvedCreds(erpnextSid, email);
      if (primaryEmail && primaryEmail !== email) {
        invalidateResolvedCreds(erpnextSid, primaryEmail);
      }
      console.log(`[mail] invalidated resolved-creds cache for ${email}${primaryEmail && primaryEmail !== email ? ` and ${primaryEmail}` : ""} (status ${status})`);
    }
  }

  res.status(opts.authStatus && status === 401 ? opts.authStatus : status).json({ ok: false, error: message, detail: raw });
}

/* ─── Upstream IMAP health stats ─── */
// Track per-host success/failure so /api/health/mail/upstream can answer
// "is my mail server fail2ban-ing us right now?" without triggering yet
// another IMAP attempt to find out.
interface HostStats {
  lastSuccessAt: number;
  lastFailureAt: number;
  recentFailures: number[]; // unix-ms timestamps inside the last hour
}
const hostStats = new Map<string, HostStats>();
// Hard cap so a user cycling through many hosts (or a pathological attack)
// can't grow the map without bound. LRU-ish eviction: on overflow, drop the
// entry with the oldest lastFailureAt/lastSuccessAt.
const HOST_STATS_MAX = 500;
const HOST_STATS_STALE_MS = 24 * 60 * 60 * 1000;

function evictStaleHostStats(now: number): void {
  // Drop entries that have had no activity in 24h. Cheap enough to run
  // on every write because the map is capped at 500.
  for (const [host, s] of hostStats) {
    const last = Math.max(s.lastSuccessAt, s.lastFailureAt);
    if (last && now - last > HOST_STATS_STALE_MS) hostStats.delete(host);
  }
}

function evictOldestHostStat(): void {
  let oldestHost: string | null = null;
  let oldestTs = Infinity;
  for (const [host, s] of hostStats) {
    const last = Math.max(s.lastSuccessAt, s.lastFailureAt);
    if (last < oldestTs) { oldestTs = last; oldestHost = host; }
  }
  if (oldestHost) hostStats.delete(oldestHost);
}

function recordMailAttempt(host: string, ok: boolean): void {
  if (!host) return;
  const s = hostStats.get(host) || { lastSuccessAt: 0, lastFailureAt: 0, recentFailures: [] };
  const now = Date.now();
  if (ok) {
    s.lastSuccessAt = now;
  } else {
    s.lastFailureAt = now;
    s.recentFailures.push(now);
  }
  // Drop entries older than one hour so the count reflects "recent".
  const cutoff = now - 60 * 60 * 1000;
  s.recentFailures = s.recentFailures.filter(ts => ts > cutoff);
  hostStats.set(host, s);
  // Opportunistic maintenance: sweep stale entries, then enforce cap.
  evictStaleHostStats(now);
  while (hostStats.size > HOST_STATS_MAX) evictOldestHostStat();
}

export function mailUpstreamStats(): Array<{ host: string; lastSuccessAt: number | null; lastFailureAt: number | null; failuresLastHour: number; suspectedBan: boolean }> {
  const now = Date.now();
  return Array.from(hostStats.entries()).map(([host, s]) => ({
    host,
    lastSuccessAt: s.lastSuccessAt || null,
    lastFailureAt: s.lastFailureAt || null,
    failuresLastHour: s.recentFailures.filter(ts => ts > now - 60 * 60 * 1000).length,
    // Heuristic: 5+ failures in the last hour and no success since the most
    // recent failure → upstream is probably ban'd / unreachable for us.
    suspectedBan: s.recentFailures.length >= 5 && s.lastFailureAt > s.lastSuccessAt,
  }));
}

/* ─── Async operation queue ─── */

class AsyncQueue {
  private queue: Array<{ fn: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void; priority: number; seq: number }> = [];
  private running = false;
  private seqCounter = 0;

  /**
   * Enqueue an IMAP operation. `priority` higher = runs sooner; within the same
   * priority the queue is strict FIFO. Background work (folder warmup,
   * conversation-threading header scans) enqueues at priority < 0 so an
   * interactive op (open this mail, switch to that folder) that arrives while
   * the queue is backed up with warmup fetches jumps ahead instead of waiting
   * behind ~130 project-folder loads.
   */
  enqueue<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject, priority, seq: this.seqCounter++ });
      if (!this.running) this.drain();
    });
  }

  private async drain() {
    this.running = true;
    while (this.queue.length > 0) {
      // Pick highest-priority item, oldest-first within a priority tier.
      let bestIdx = 0;
      for (let i = 1; i < this.queue.length; i++) {
        const a = this.queue[i];
        const b = this.queue[bestIdx];
        if (a.priority > b.priority || (a.priority === b.priority && a.seq < b.seq)) bestIdx = i;
      }
      const { fn, resolve, reject } = this.queue.splice(bestIdx, 1)[0];
      try {
        resolve(await fn());
      } catch (err) {
        reject(err);
      }
    }
    this.running = false;
  }
}

/* ─── Types ─── */

export interface MailCredentials {
  host: string;
  port: number;
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
  smtpPort?: number;
  smtpSecure?: boolean;
}

/* ─── Mail credential session cache ─── */
// Per-(y_app_session, instance) cache so the frontend can push creds once
// via POST /api/mail/config and every subsequent mail request reads them
// from memory instead of forwarding `pass`/`accessToken` in every URL.
// The threat this closes: `pass=…` and OAuth tokens landing in nginx
// access logs, browser history, CDN caches, and any downstream log
// shipper that consumes request URLs. Sliding 4h TTL, capped at 1000
// entries so the map can't grow unbounded.
interface MailSessionEntry { creds: MailCredentials; expiresAt: number }
const mailSessions = new Map<string, MailSessionEntry>();
const MAIL_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const MAIL_SESSION_MAX = 1000;

function mailSessionKey(yAppSid: string, instanceId: string | number | undefined | null, acct?: string): string {
  const base = `${yAppSid}:${instanceId ?? "default"}`;
  return acct ? `${base}:${acct}` : base;
}

export function setMailSession(yAppSid: string, instanceId: string | number | undefined | null, creds: MailCredentials, acct?: string): void {
  if (!yAppSid) return;
  mailSessions.set(mailSessionKey(yAppSid, instanceId, acct), { creds, expiresAt: Date.now() + MAIL_SESSION_TTL_MS });
  // Opportunistic sweep of expired entries + LRU-ish eviction on overflow.
  const now = Date.now();
  for (const [k, v] of mailSessions) if (v.expiresAt < now) mailSessions.delete(k);
  while (mailSessions.size > MAIL_SESSION_MAX) {
    const first = mailSessions.keys().next().value;
    if (first === undefined) break;
    mailSessions.delete(first);
  }
}

export function getMailSession(yAppSid: string, instanceId: string | number | undefined | null, acct?: string): MailCredentials | null {
  if (!yAppSid) return null;
  const k = mailSessionKey(yAppSid, instanceId, acct);
  const v = mailSessions.get(k);
  if (!v) return null;
  if (v.expiresAt < Date.now()) { mailSessions.delete(k); return null; }
  v.expiresAt = Date.now() + MAIL_SESSION_TTL_MS; // sliding
  return v.creds;
}

export function clearMailSession(yAppSid: string, instanceId: string | number | undefined | null, acct?: string): void {
  if (!yAppSid) return;
  mailSessions.delete(mailSessionKey(yAppSid, instanceId, acct));
}

/**
 * Start IMAP IDLE voor een (sessie, instance, acct) als er ge-cachte creds zijn.
 *
 * Synchrone fast-path: kijkt alleen naar de in-memory mailSession-cache.
 * Voor de ERPNext-fallback (resolve via erpnext-sid + email) zie
 * `ensureIdleForSession` hieronder.
 */
export function startIdleForCachedSession(
  yAppSid: string,
  instanceId: number,
  acct?: string,
): boolean {
  const creds = getMailSession(yAppSid, instanceId, acct);
  if (!creds) return false;
  const cache = getAccountCache(creds);
  cache.registerIdleListener(yAppSid, instanceId);
  return true;
}

/**
 * Plan A: zorg dat IMAP IDLE actief is voor (sessie, instance), ook als de
 * gebruiker nog niet op Webmail heeft geklikt.
 *
 * - Cache-hit: directe register, zonder ERPNext-call.
 * - Cache-miss + email+erpnextSid bekend: resolve creds via ERPNext, cache,
 *   register IDLE. Volgende WS-connects op dezelfde sessie raken de cache.
 *
 * Gebruikt door de /ws/events subscribe-mail handler.
 */
export async function ensureIdleForSession(opts: {
  yAppSid: string;
  instanceId: number;
  email?: string;
  acct?: string;
  erpnextSid?: string;
}): Promise<{ ok: boolean; reason: "cached" | "resolved" | "no_creds" | "no_email" | "resolve_failed" }> {
  const { yAppSid, instanceId, email, acct, erpnextSid } = opts;
  const cached = getMailSession(yAppSid, instanceId, acct);
  if (cached) {
    const cache = getAccountCache(cached);
    cache.registerIdleListener(yAppSid, instanceId);
    // Warmup hier BEWUST niet starten: dat blokkeerde het IMAP-lock 22 s
    // voor de eerste /api/mail/folders + /messages user-call. Warmup wordt
    // pas getriggerd door mailListFolders nadat de eerste user-fetch is
    // geretourneerd (zie scheduleWarmupAfterFirstFetch).
    return { ok: true, reason: "cached" };
  }
  if (!email || !erpnextSid) return { ok: false, reason: "no_email" };
  const resolved = await resolveCredentials(erpnextSid, email);
  if (!resolved) return { ok: false, reason: "resolve_failed" };
  // Shared-mailbox edge case: caller may have asked for an acct different
  // from the primary email. We respect that by overriding `user`.
  const effective: MailCredentials = acct && acct !== email ? { ...resolved, user: acct } : resolved;
  setMailSession(yAppSid, instanceId, effective, acct);
  const cache = getAccountCache(effective);
  cache.registerIdleListener(yAppSid, instanceId);
  return { ok: true, reason: "resolved" };
}

// Warmup wordt deferred getriggerd door mailListFolders. Reden: subscribe-mail
// over WS arriveert ~500 ms voor de eerste /api/mail/folders user-fetch, dus
// een warmup-start vanuit subscribe-mail grabt het IMAP-lock vóór de user en
// blokkeert /folders + /messages tientallen seconden (cold gemeten: 22 s).
// Door warmup pas te starten 5 s NÁ de eerste mailListFolders-response zijn
// /folders én /messages al klaar (cold ~3 s elk), en kan warmup ongestoord
// op achtergrond Sent/Drafts/Archive + INBOX-bodies vullen voor folder-switch.
function scheduleWarmupAfterFirstFetch(cache: MailAccountCache): void {
  if (warmupInFlight.has(cache)) return;
  setTimeout(() => warmupCacheAsync(cache), 5000);
}

/**
 * Fire-and-forget warmup: laadt INBOX + alle subfolders (`INBOX/...` of
 * `INBOX....` namespace-delimiter) met de laatste 30 dagen aan berichten,
 * en preload bodies. Resultaat: na ~10-30s achter de schermen zit alles
 * wat een gebruiker normaal binnen Webmail opent al in cache, en zijn
 * folder-switches + message-open instant.
 *
 * Idempotent — `fetchMessages` doet niets als cache nog vers is. Eén
 * in-flight warmup per account tegelijk via WeakSet-guard zodat
 * gelijktijdige WS-reconnects niet dubbel IMAP-traffic veroorzaken.
 *
 * Sequentieel per folder: IMAP-protocol verlangt één lock per folder
 * per connection. Parallelisme zou meerdere connecties per account
 * vereisen — bewust niet gedaan in deze pass (NC/Exchange-limieten).
 */
const warmupInFlight = new WeakSet<MailAccountCache>();
// Warmup-config: cache-key MOET matchen met Webmail's first-paint fetch,
// anders is de hele preload weggegooid werk. Webmail vraagt nu pageSize=50
// zonder sinceDays — dus dat doen wij ook. Voor de meeste subfolders dekken
// 50 berichten ruim 30 dagen geschiedenis; voor zeer drukke folders (zoals
// INBOX) is het less-than-30-days maar wel de meest recent geopende mails,
// wat is wat de user als eerste te zien krijgt.
const WARMUP_PAGE_SIZE = 50;

function isInboxScope(folderPath: string): boolean {
  // Match INBOX zelf + subfolders. Twee delimiters voorkomen: "/" (Dovecot,
  // Gmail) en "." (Cyrus, sommige Exchange-mappings). We zijn ruim:
  // `INBOX`, `INBOX/Foo`, `INBOX/Foo/Bar`, `INBOX.Foo`.
  if (folderPath === "INBOX") return true;
  if (folderPath.toUpperCase() === "INBOX") return true;
  return folderPath.startsWith("INBOX/") || folderPath.startsWith("INBOX.");
}

/**
 * Top-level "special-use" folders die de gebruiker regelmatig opent buiten
 * INBOX om: Sent / Drafts / Archive. We matchen op naam (case-insensitive)
 * en op IMAP RFC 6154 specialUse flags ("\Sent", "\Drafts", "\Archive").
 * Trash/Junk/Spam bewust NIET — die zijn meestal groot, zelden geopend, en
 * groeien snel; preloaden zou meer IMAP-lock-tijd kosten dan ze waard zijn.
 */
function isTopLevelFolder(folder: { path: string; specialUse: string | null }): boolean {
  if (folder.specialUse === "\\Sent" || folder.specialUse === "\\Drafts" || folder.specialUse === "\\Archive") return true;
  const leaf = (folder.path.split(/[/.]/).pop() || folder.path).toLowerCase().trim();
  // Engelse + Nederlandse benamingen
  return [
    "sent", "verzonden", "verzonden items", "verzon items",
    "drafts", "draft", "concepten", "concept",
    "archive", "archief",
  ].includes(leaf);
}

function warmupCacheAsync(cache: MailAccountCache): void {
  if (warmupInFlight.has(cache)) return;
  warmupInFlight.add(cache);
  void (async () => {
    const t0 = Date.now();
    let foldersDone = 0;
    try {
      const folders = await cache.fetchFolders();
      // Wave 1+: warmup-scope uitgebreid van alleen INBOX-tree naar
      // INBOX + Sent + Drafts + Archive. Reden: Piet meldt "Email
      // traag", gemeten root-cause = eerste klik op Sent koste 3.7 s
      // (koude IMAP SELECT + FETCH 50 envelopes). Door deze folders
      // OOK in warmup mee te nemen voelt elke folder-switch instant.
      const warmupTargets = folders.filter(f => isInboxScope(f.path) || isTopLevelFolder(f));
      console.log(`[mail-cache] warmup start: ${warmupTargets.length} folders (INBOX+Sent/Drafts/Archive scope), pageSize=${WARMUP_PAGE_SIZE}`);
      // INBOX eerst zodat first-paint Webmail meteen kan; daarna Sent
      // (vaak getoond na een send), dan rest.
      warmupTargets.sort((a, b) => {
        if (a.path === "INBOX") return -1;
        if (b.path === "INBOX") return 1;
        const aSent = a.specialUse === "\\Sent" || /^(sent|verzonden)/i.test((a.path.split(/[/.]/).pop() || ""));
        const bSent = b.specialUse === "\\Sent" || /^(sent|verzonden)/i.test((b.path.split(/[/.]/).pop() || ""));
        if (aSent && !bSent) return -1;
        if (!aSent && bSent) return 1;
        return 0;
      });
      // Envelopes-only voor non-INBOX. Body-preload doen we apart voor
      // INBOX top-10 (zie hieronder). Tussen elke folder een korte 100ms
      // yield zodat user-actions die ondertussen binnenkomen (klik op
      // mailbox/folder/mail) NIET helemaal achter de warmup-queue staan.
      // 100ms gap × 4-6 folders = ~600ms extra warmup-tijd; voor de user
      // wachttijd is dat de drempel waarop "klik werkt direct" voelt.
      for (let i = 0; i < warmupTargets.length; i++) {
        const folder = warmupTargets[i];
        try {
          // sinceDays bewust undefined zodat de cache-key matched met
          // Webmail's first-paint fetch (zie WARMUP_PAGE_SIZE comment).
          // background=true → interactieve klik gaat altijd vóór de warmup.
          const result = await cache.fetchMessages(folder.path, false, 1, WARMUP_PAGE_SIZE, undefined, true);
          foldersDone++;
          // INBOX-specifiek: preload de top-30 message bodies zodat de
          // eerste klikken op recente mails INSTANT openen (geen IMAP
          // FETCH BODY[] roundtrip). Top-10 dekte alleen 4 zichtbare
          // mails — 30 dekt typisch de hele eerste scroll-view + nog
          // wat. Alleen voor INBOX zodat we de opQueue niet × N folders
          // blokkeren. ~10-15s achter de schermen.
          if (folder.path === "INBOX" && result.messages.length > 0) {
            const top = result.messages.slice(0, 30);
            // Fire-and-forget; preloadBodies heeft eigen `preloadingBodies`
            // guard tegen overlap. User-acties komen via dezelfde opQueue
            // tussendoor — preload is serieel per UID, kan onderbroken
            // voelen maar blokkeert geen meervoudige user-clicks.
            cache.preloadBodies("INBOX", top).catch(() => { /* opQueue handles errors */ });
          }
        } catch (err) {
          // Eén kapotte subfolder mag de hele warmup niet stoppen.
          console.warn(`[mail-cache] warmup: folder ${folder.path} failed: ${(err as Error).message}`);
        }
        // Yield aan het einde van elke folder behalve de laatste.
        if (i < warmupTargets.length - 1) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[mail-cache] warmup done: ${foldersDone}/${warmupTargets.length} folders (envelopes) in ${elapsed}s (+INBOX top-10 body preload async)`);
    } catch (err) {
      console.warn(`[mail-cache] warmup failed: ${(err as Error).message}`);
    } finally {
      warmupInFlight.delete(cache);
    }
  })();
}

interface CachedFolder {
  path: string;
  name: string;
  delimiter: string;
  flags: string[];
  specialUse: string | null;
  listed: boolean;
  messages: number | null;
  unseen: number | null;
}

interface CachedMessage {
  uid: number;
  seq: number;
  flags: string[];
  date: string | null;
  subject: string;
  from: { name: string; address: string }[];
  to: { name: string; address: string }[];
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
}

interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
  cid?: string; // content-id for inline images
  contentDisposition?: string; // "inline" or "attachment"
}

interface CachedFullMessage extends CachedMessage {
  cc: { name: string; address: string }[];
  textBody: string;
  htmlBody: string;
  attachments: AttachmentMeta[];
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

interface FolderCache {
  messages: CachedMessage[];
  total: number;
  ts: number;
}

interface HeaderInfo {
  uid: number;
  folder: string;
  subject: string;
  date: string | null;
  from: { name: string; address: string }[];
  to: { name: string; address: string }[];
  cc: { name: string; address: string }[];
  seen: boolean;
  flagged: boolean;
  flags: string[];
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

type ThreadRelation = "current" | "ancestor" | "descendant";

interface ConversationResult extends HeaderInfo {
  hasAttachments: boolean;
  relation: ThreadRelation;
  /** Frontend-compat: envelope-only — keep legacy MailMessageFull-shape happy. */
  textBody: string;
  htmlBody: string;
  attachments: AttachmentMeta[];
  seq?: number;
}

/* ─── Per-account cache ─── */

class MailAccountCache {
  private creds: MailCredentials;
  private client: ImapFlow | null = null;
  private connected = false;
  private connecting = false;
  // Connectie-backoff: na herhaalde connect-fouten (mailserver reset/throttlet
  // de IMAP-verbinding, bv. `read ECONNRESET` bij een per-account rate-limit)
  // wachten we exponentieel vóór we opnieuw verbinden. Zonder dit blijft Y-app
  // de throttle zélf warm houden (elke fetch/warmup/poll = nieuwe poke) en
  // herstelt de mailserver nooit. Reset bij een geslaagde verbinding.
  private connFailures = 0;
  private backoffUntil = 0;
  private authFailed = false;
  private static readonly CONN_BACKOFF_BASE_MS = 15_000;     // 15s
  private static readonly CONN_BACKOFF_MAX_MS = 5 * 60_000;  // 5 min cap
  // Auth-fouten NIET in een retry-lus: foute creds lossen niet op door te
  // herproberen, en herhaalde mislukte LOGINs triggeren de fail2ban van de
  // mailserver → IP-ban die álle accounts blokkeert. Daarom een lange vaste
  // backoff zodat een mis-geconfigureerd account hooguit ~2×/uur probeert.
  private static readonly AUTH_BACKOFF_MS = 30 * 60_000;     // 30 min
  // IDLE churn-rem: als de mailserver de idle-verbinding kort afkapt, niet elke
  // minuut een nieuwe maken maar escalerend wachten vóór reconnect.
  private idleQuickCloses = 0;
  private static readonly IDLE_MIN_HEALTHY_MS = 90_000;       // < dit = "te snel gesloten"
  private static readonly IDLE_RECONNECT_MAX_MS = 5 * 60_000; // cap op de reconnect-wachttijd
  private folders: CachedFolder[] = [];
  private foldersTs = 0;
  private folderMessages = new Map<string, FolderCache>();
  private fullMessages = new Map<string, CachedFullMessage>(); // key: folder:uid
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private lastActivity = Date.now();
  private preloadingBodies = false;
  /**
   * Coalesces concurrent OAuth2 token refreshes. Without this, two
   * concurrent IMAP operations would both POST to the token endpoint
   * with the same refresh_token, and Microsoft (which rotates refresh
   * tokens on use) would silently invalidate one of the rotated tokens
   * — causing the next refresh to fail with `invalid_grant`. The first
   * caller creates the in-flight promise; concurrent callers `await`
   * the same one. Cleared in `finally` so a failed refresh doesn't
   * leave a permanently-stuck slot.
   */
  private tokenRefreshInFlight: Promise<void> | null = null;
  /** B06: serializes IMAP operations through a queue so concurrent callers
   * do not interleave commands on the same connection. */
  private opQueue = new AsyncQueue();
  /** §2: aparte cache voor attachment-buffers. fetchAttachment re-parste
   * voorheen het volledige bericht via simpleParser bij élke download —
   * voor een 1 MB PDF in een 20 MB mail betekende dat 20 MB parsing per
   * klik. Deze cache slaat de ge-extraheerde Buffer op, met een
   * conservatieve LRU-cap (per account) zodat een groot postvak niet de
   * hele server-RAM opslokt. */
  private attachmentCache = new Map<string, { content: Buffer; filename: string; contentType: string; ts: number }>();
  private static readonly ATT_CACHE_MAX_BYTES = 100 * 1024 * 1024; // 100 MB per account
  private static readonly ATT_CACHE_TTL = 10 * 60 * 1000;          // 10 min
  // Folders waarvan een fetch faalde (b.v. niet-selecteerbare Outlook-systeem-
  // mappen of mappen die "Command failed" geven). De achtergrond-warmup slaat
  // deze tijdelijk over zodat hij de seriële IMAP-verbinding niet telkens
  // seconden-lang bezet houdt met dezelfde falende mappen — dat blokkeerde
  // interactieve mail-opens. Interactieve (non-background) fetches proberen het
  // altijd opnieuw, dus er wordt nooit echte mail verborgen.
  private failedFolders = new Map<string, number>();
  private static readonly FAILED_FOLDER_TTL = 15 * 60 * 1000;      // 15 min
  // fullMessages-cache LRU-cap: voorkom memory-leak bij grote postvakken
  // (warmup + user-opens kunnen 1000+ bodies in cache zetten, à ~50 KB per
  // mail = 50+ MB per account zonder eviction). 500 covers de meest recent
  // geopende mails ruim; oudere entries vallen er uit op insertion-order.
  // Map-iteratie is insertion-order, dus delete+set bij hit shoves entries
  // naar het einde (zelfde patroon als attachmentCache).
  private static readonly FULL_MSG_CACHE_MAX_COUNT = 500;
  private static readonly FOLDER_TTL = 120_000;    // 2 min
  // Bumped van 30s → 5 min: bij actief gebruik via IDLE wordt INBOX altijd
  // proactief geïnvalideerd, dus de TTL is alleen relevant voor andere
  // folders. 5 min staleness voor subfolder-views is acceptabel — de
  // alternatieve "elke 30s opnieuw IMAP SEARCH bij ieder bezoek" gaf cold-
  // start 3-5s op pagina-switch terug. Webmail-acties zoals mark-read /
  // delete invalideren de cache lokaal sowieso.
  private static readonly MSG_LIST_TTL = 5 * 60_000; // 5 min
  // Twee aparte timeouts voor inactiviteit:
  //  - CONNECTION_TIMEOUT: na X stilte sluiten we het IMAP-socket. Reden:
  //    NAT-routers / firewalls / Cloudflare killen idle TCP na 5-30 min;
  //    Office 365 heeft een max op concurrent IMAP-connections per account;
  //    en OAuth access_tokens hebben 1 u TTL, dus open laten boven 1 u kost
  //    bij volgende gebruik toch een refresh. `destroy()` sluit de socket
  //    maar laat de in-memory caches (folders / folderMessages / fullMessages /
  //    attachmentCache) STAAN — die zijn cheap te bewaren en maken de eerste
  //    klik na re-connect instant (alleen reconnect-roundtrip ~1-2 s i.p.v.
  //    volledige cold load van 3-7 s).
  //  - CACHE_LIFETIME: pas na X uur stilte gooi we ook de in-memory caches
  //    weg en verwijderen we de MailAccountCache uit `accountCaches`. Zonder
  //    deze timer zou de Map oneindig groeien bij gebruikers die shared
  //    mailboxen toevoegen / verwijderen of meerdere instances roteren.
  //    7 dagen zodat een werkweek vakantie geen warmup-trigger geeft
  //    (browser-IDB blijft sowieso staan, dus user merkt sowieso niets).
  private static readonly CONNECTION_TIMEOUT = 30 * 60_000;       // 30 min
  private static readonly CACHE_LIFETIME = 7 * 24 * 60 * 60_000;  // 7 dagen
  /** Eenmalige timer die na destroy() de in-memory caches opruimt als de
   * account daarna nog steeds CACHE_LIFETIME niet gebruikt is. Wordt
   * gecanceld door `ensureConnected()` zodra de gebruiker terugkomt. */
  private cacheCleanupTimer: ReturnType<typeof setTimeout> | null = null;

  /** Tweede ImapFlow-client die in IDLE-modus luistert op INBOX. Wordt los
   * gehouden van de gewone fetch-client omdat IDLE de connection blokkeert.
   * Bij EXISTS / EXPUNGE / FLAGS-events wordt een `mail-changed` event naar
   * alle browser-clients in deze sessie gepushed via ws-events. */
  private idleClient: ImapFlow | null = null;
  private idleStopRequested = false;
  /** True zolang de startIdleLoop-while draait. NIET af te leiden uit
   *  `idleClient`: tijdens de 25-min-restart (en de churn-reconnect-wacht) is
   *  `idleClient` even `null` terwijl de loop nog draait. Een browser-refresh
   *  die in dat gat `registerIdleListener` → `startIdleLoop` aanroept zou
   *  anders een TWEEDE parallelle IDLE-loop starten (dubbele connect-churn op
   *  dezelfde host). Deze vlag dekt het gat dat `idleClient` openlaat. */
  private idleLoopRunning = false;
  /** Set van (yAppSid, instanceId) tuples die op IMAP-events willen luisteren.
   *  Tuple-string: `${yAppSid}::${instanceId}`. Gevuld door registerIdleListener
   *  vanuit de mail-handlers (mailGetMessage / mailListMessages / etc.). */
  private idleListeners = new Set<string>();
  private static readonly IDLE_RESTART_MS = 25 * 60_000; // 25 min — < IMAP RFC 29 min limit

  constructor(creds: MailCredentials) {
    this.creds = creds;
  }

  /** Voeg een (sessie, instance)-paar toe aan de lijst van listeners zodat
   * een IMAP IDLE event naar deze browser-clients gepushed wordt. */
  registerIdleListener(yAppSid: string, instanceId: number | undefined): void {
    const key = `${yAppSid}::${instanceId ?? "default"}`;
    this.idleListeners.add(key);
    // Start IDLE-loop on demand wanneer er voor het eerst luisteraars zijn.
    // Gate op `idleLoopRunning` (niet `idleClient`): die is `null` in het
    // restart-gat terwijl de loop nog draait — anders start hier een tweede.
    if (!this.idleLoopRunning && !this.idleStopRequested) {
      void this.startIdleLoop();
    }
  }

  private get key() { return `${this.creds.host}:${this.creds.user}`; }

  /** Update credentials (e.g. new OAuth2 tokens from frontend) */
  updateCredentials(creds: MailCredentials) {
    // Fast path: identical creds require no work. Eliminates the
    // common-case write-write window where two concurrent IMAP requests
    // both push the same already-refreshed token. The remaining
    // overwrite path only fires when creds genuinely differ.
    if (
      this.creds.authMode === creds.authMode &&
      this.creds.accessToken === creds.accessToken &&
      this.creds.refreshToken === creds.refreshToken &&
      this.creds.pass === creds.pass
    ) {
      return;
    }

    const authModeChanged = this.creds.authMode !== creds.authMode;

    // Always update OAuth fields if provided
    if (creds.authMode === "oauth2") {
      if (creds.accessToken) this.creds.accessToken = creds.accessToken;
      if (creds.refreshToken) this.creds.refreshToken = creds.refreshToken;
      if (creds.clientId) this.creds.clientId = creds.clientId;
      if (creds.clientSecret) this.creds.clientSecret = creds.clientSecret;
      if (creds.tokenUri) this.creds.tokenUri = creds.tokenUri;
    }

    // If auth mode changed, destroy existing connection so it reconnects
    if (authModeChanged) {
      this.creds.authMode = creds.authMode;
      this.creds.pass = creds.pass;
      if (this.client) {
        this.client.logout().catch(() => {});
        this.client = null;
        this.connected = false;
      }
    }
  }

  /** Ensure OAuth2 access token is fresh (refresh if expired or expiring within 5 min) */
  private async ensureTokenFresh(): Promise<void> {
    if (this.creds.authMode !== "oauth2" || !this.creds.accessToken) return;

    // Step 1 — synchronously decide whether a refresh is needed at all.
    // Fast path: token still valid for >5 min, return immediately. This
    // avoids coalescing on the common no-op case.
    let needsRefresh = false;
    try {
      const parts = this.creds.accessToken.split(".");
      if (parts.length < 2) {
        needsRefresh = true; // not a JWT — refresh defensively
      } else {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
        const exp = payload.exp as number;
        if (!exp) {
          needsRefresh = true; // no exp claim — refresh defensively
        } else {
          const nowSec = Math.floor(Date.now() / 1000);
          if (exp - nowSec > 300) return; // still valid for >5 min
          needsRefresh = true;
        }
      }
    } catch {
      needsRefresh = true; // couldn't decode — refresh defensively
    }

    if (!needsRefresh) return;

    // Capture the credentials we need into const locals BEFORE the
    // possibly-awaited section, so TS narrowing survives and so we use
    // the same refresh_token we validated below — even if `this.creds`
    // is mutated underneath us via updateCredentials().
    const tokenUri = this.creds.tokenUri;
    const clientId = this.creds.clientId;
    const clientSecret = this.creds.clientSecret;
    const refreshToken = this.creds.refreshToken;
    if (!tokenUri || !clientId || !clientSecret || !refreshToken) {
      console.warn(`[mail-cache] Missing refresh credentials for ${this.key}`);
      return;
    }

    // Step 2 — coalesce concurrent refresh attempts. Synchronous check
    // and assignment within the same JS turn means the second concurrent
    // caller can never both miss the slot AND set its own promise — JS
    // is single-threaded, so by the time control transfers to the second
    // caller, this.tokenRefreshInFlight is already populated.
    if (this.tokenRefreshInFlight) {
      return this.tokenRefreshInFlight;
    }

    this.tokenRefreshInFlight = (async () => {
      try {
        console.log(`[mail-cache] OAuth2 token expired or expiring soon for ${this.key}, refreshing...`);
        const resp = await fetch(tokenUri, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            scope: "https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send offline_access",
          }),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          console.error(`[mail-cache] Token refresh failed (${resp.status}):`, text.slice(0, 200));
          return;
        }

        const data = await resp.json();
        if (data.access_token) {
          this.creds.accessToken = data.access_token;
          console.log(`[mail-cache] OAuth2 token refreshed for ${this.key}`);
        }
        if (data.refresh_token) {
          this.creds.refreshToken = data.refresh_token;
        }
      } catch (err) {
        console.error(`[mail-cache] Token refresh error for ${this.key}:`, (err as Error).message);
      } finally {
        // Always clear the slot — even on failure — so the next call
        // can attempt a fresh refresh instead of awaiting a settled promise.
        this.tokenRefreshInFlight = null;
      }
    })();

    return this.tokenRefreshInFlight;
  }

  /** Escaleer de gedeelde connect-backoff na een mislukte IMAP-connect.
   * Gedeeld tussen het fetch-pad (ensureConnected) en de IDLE-loop
   * (startIdleLoop): beide raken hetzelfde account/host, dus één van beide
   * die faalt betekent dat de ander ook even niet moet poken. Geeft het
   * nieuwe `backoffUntil`-tijdstip terug. */
  private noteConnectFailure(err?: unknown): number {
    this.connFailures++;
    if (err !== undefined && isImapAuthError(err)) {
      // Auth-fout (foute creds): lange vaste backoff i.p.v. de exponentiële
      // retry-lus. Herproberen lost niets op en herhaalde mislukte LOGINs
      // laten de mailserver-fail2ban het IP bannen (→ álle accounts eruit).
      this.authFailed = true;
      this.backoffUntil = Date.now() + MailAccountCache.AUTH_BACKOFF_MS;
      return this.backoffUntil;
    }
    this.authFailed = false;
    this.backoffUntil = Date.now() + Math.min(
      MailAccountCache.CONN_BACKOFF_BASE_MS * 2 ** (this.connFailures - 1),
      MailAccountCache.CONN_BACKOFF_MAX_MS,
    );
    return this.backoffUntil;
  }

  /** Reset de gedeelde connect-backoff na een geslaagde IMAP-connect (fetch
   * óf IDLE) — bewijst dat de mailserver weer verbindingen accepteert. */
  private noteConnectSuccess(): void {
    this.connFailures = 0;
    this.backoffUntil = 0;
    this.authFailed = false;
  }

  /** Ensure we have a live IMAP connection */
  private async ensureConnected(): Promise<ImapFlow> {
    this.lastActivity = Date.now();

    // Reuse na destroy(): cancel de geplande full-cache-cleanup omdat de
    // gebruiker (of warmup / IDLE) terug is binnen het CACHE_LIFETIME-venster.
    if (this.cacheCleanupTimer) {
      clearTimeout(this.cacheCleanupTimer);
      this.cacheCleanupTimer = null;
    }

    // Refresh OAuth2 token if needed (even if already connected, token might have expired)
    if (this.creds.authMode === "oauth2") {
      await this.ensureTokenFresh();
    }

    if (this.client && this.connected) return this.client;
    if (this.connecting) {
      // Wait max 15s for ongoing connection attempt
      const deadline = Date.now() + 15_000;
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (!this.connecting || Date.now() > deadline) { clearInterval(check); resolve(); }
        }, 50);
      });
      if (this.client && this.connected) return this.client;
    }

    // Backoff: zolang het venster loopt niet opnieuw verbinden — gooi snel een
    // fout i.p.v. de (recent resettende/throttlende) mailserver opnieuw te poken.
    if (Date.now() < this.backoffUntil) {
      const waitS = Math.ceil((this.backoffUntil - Date.now()) / 1000);
      throw new Error(`Mailserver weigerde recent de IMAP-verbinding (throttle); backoff nog ${waitS}s.`);
    }

    // Kill stale client before reconnecting
    if (this.client) {
      try { this.client.close(); } catch { /* ignore */ }
      this.client = null;
      this.connected = false;
    }

    this.connecting = true;
    try {
      const authConfig = this.creds.authMode === "oauth2"
        ? { user: this.creds.user, accessToken: this.creds.accessToken! }
        : { user: this.creds.user, pass: this.creds.pass };

      // Wave 0b shared-mailbox diagnostic: log de token-subject (upn) en
      // scopes (scp) zodat we in productie-logs kunnen onderscheiden of
      // de SASL-LOGIN-AS user (this.creds.user, bv. info@3bm.co.nl) wel/
      // niet matched met het token-subject (bv. piet@3bm.co.nl) — bij
      // delegated shared-mailbox is dit BEDOELING dat ze afwijken, mits
      // de primary FullAccess heeft via Exchange `Add-MailboxPermission`.
      // Zonder die permissie weigert O365 met AUTHENTICATIONFAILED.
      if (this.creds.authMode === "oauth2" && this.creds.accessToken) {
        try {
          const parts = this.creds.accessToken.split(".");
          if (parts.length >= 2) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
            const tokenUpn = payload.upn || payload.preferred_username || payload.unique_name || "?";
            const tokenScp = (payload.scp || "").split(" ").filter((s: string) => s.includes("IMAP") || s.includes("Mail")).join(",") || "none";
            const tokenExp = payload.exp ? new Date(payload.exp * 1000).toISOString() : "?";
            console.log(`[mail-cache] XOAUTH2 connect: login-as=${this.creds.user} token-upn=${tokenUpn} token-scp=${tokenScp} token-exp=${tokenExp}`);
          }
        } catch { /* ignore — token may not be a JWT */ }
      }

      this.client = new ImapFlow({
        host: this.creds.host,
        port: this.creds.port,
        secure: this.creds.secure,
        auth: authConfig,
        logger: false,
        emitLogs: false,
        // Set SNI explicitly so virtual-hosted mail servers (Stalwart and
        // similar) route to the right cert. Pin TLS 1.2 minimum so we don't
        // silently negotiate ancient ciphers on misconfigured servers.
        tls: this.creds.secure ? { servername: this.creds.host, minVersion: "TLSv1.2" } : undefined,
      });

      this.client.on("close", () => {
        this.connected = false;
        console.log(`[mail-cache] Connection closed for ${this.key}`);
      });
      this.client.on("error", (err) => {
        this.connected = false;
        console.warn(`[mail-cache] Connection error for ${this.key}:`, err?.message || err);
      });

      // Connect with 30s timeout. Office 365 / Exchange-hosted accounts kunnen
      // 10-20s nodig hebben voor de eerste TLS+LOGIN handshake (basic auth
      // wordt server-side traag gevalideerd, OAuth2-flows nog langer).
      // Verlaag dit niet zonder host-specifieke alternatieve drempel.
      let connectTimer: ReturnType<typeof setTimeout> | undefined;
      const client = this.client;
      try {
        // Connect via de per-host gate: serialiseert + spreidt reconnects zodat
        // een burst (na socket-drop / wake) de mailserver-rate-limit niet tikt.
        // De 30s-timeout zit binnen het slot — een hangende connect blokkeert
        // bewust verdere reconnects naar diezelfde host.
        await imapConnectGate.run(this.creds.host, () => Promise.race([
          client.connect(),
          new Promise<never>((_, reject) => {
            connectTimer = setTimeout(
              () => reject(new Error(
                `IMAP verbinding timeout na 30s voor ${this.creds.user}@${this.creds.host}. ` +
                `Mogelijke oorzaken: firewall blokkeert poort ${this.creds.port}, ` +
                `mailserver afgesloten, of voor Office 365: basic-auth IMAP staat uit (gebruik OAuth2).`,
              )),
              30_000,
            );
          }),
        ]));
      } finally {
        if (connectTimer) clearTimeout(connectTimer);
      }
      this.connected = true;
      this.noteConnectSuccess();
      imapConnLimiter.track(this.creds.host, this.client);
      recordMailAttempt(this.creds.host, true);
      console.log(`[mail-cache] Connected to ${this.key} (${this.creds.authMode || "password"})`);

      // Start background refresh
      if (!this.refreshTimer) {
        this.refreshTimer = setInterval(() => this.backgroundRefresh(), 30_000);
      }

      return this.client;
    } catch (err) {
      recordMailAttempt(this.creds.host, false);
      // Exponentiële backoff: 15s, 30s, 60s, … tot 5 min cap. Zo stopt Y-app met
      // de mailserver te poken zolang die de verbinding reset/throttlet, zodat
      // de server-side rate-limit kan uitdoven i.p.v. warm te blijven.
      const until = this.noteConnectFailure(err);
      console.warn(`[mail-cache] ${this.authFailed ? "AUTH-fout (lange backoff, geen retry-lus)" : "connect-fout"} #${this.connFailures} voor ${this.key}; backoff ${Math.ceil((until - Date.now()) / 1000)}s: ${(err as Error)?.message || err}`);
      if (this.client) {
        try { this.client.close(); } catch { /* ignore */ }
      }
      this.client = null;
      this.connected = false;
      throw err;
    } finally {
      this.connecting = false;
    }
  }

  /** Background refresh: re-fetch top INBOX envelopes + preload new bodies.
   *
   * Wave 1 changes:
   *   - pageSize 5000 → 100. The opQueue is single-stream per connection:
   *     a 5000-envelope FETCH blocks every user-action (open a mail, mark
   *     read, switch folder) until it finishes — often 10-30 s. 100 covers
   *     the realistic "new mail since last refresh" delta (an inbox sees
   *     dozens-of-arrivals-per-hour worst case, not thousands).
   *   - Skip entirely when IMAP IDLE is registered. IDLE pushes EXISTS /
   *     EXPUNGE / FLAGS events in real time and invalidates the cache;
   *     a periodic forced refetch on top of that is duplicate work and
   *     just steals opQueue slots from real user actions. The branch only
   *     fires for accounts where no listener subscribed (rare in practice;
   *     subscribe-mail covers most active sessions).
   */
  private async backgroundRefresh() {
    if (Date.now() - this.lastActivity > MailAccountCache.CONNECTION_TIMEOUT) {
      this.destroy();
      return;
    }

    // Tijdens de connect-backoff niet poken: ensureConnected ververst
    // `lastActivity` óók bij een backoff-geweigerde call, waardoor de
    // CONNECTION_TIMEOUT-opschoning hierboven nooit zou afgaan. Gewoon
    // overslaan zodat de throttle kan uitdoven.
    if (Date.now() < this.backoffUntil) return;

    // IDLE-mode invalidates the cache on every EXISTS / EXPUNGE event, so
    // a periodic refresh on top of that is duplicate work. Skip.
    if (this.idleListeners.size > 0 && this.idleClient) return;

    try {
      await this.fetchFolders(true);
      // Wave 1: pageSize 5000 → 100 (see header comment). Covers realistic
      // new-arrivals-since-last-tick; full-list refetches happen on user
      // pageSize=0 requests, not in this background loop.
      const result = await this.fetchMessages("INBOX", true, 1, 100);
      // Preload bodies for any new messages not yet cached
      this.preloadBodies("INBOX", result.messages).catch(() => {});
    } catch {
      this.connected = false;
    }
  }

  /**
   * Fetch and cache folder list.
   *
   * Wave 1 (snelheidsfix): de eerste call doet `client.list()` ZONDER
   * statusQuery. ImapFlow's statusQuery-variant doet een STATUS-roundtrip
   * per folder (25+ folders × ~150 ms O365 = 3-5 s) en houdt het
   * connection-level lock vast — daardoor wachtte /api/mail/messages
   * onnodig op /folders. Counts (`messages`, `unseen`) worden direct na
   * de response asynchroon opgehaald en in `this.folders` gemerged; bij
   * de eerstvolgende `fetchFolders`-call (cache-hit) ziet de gebruiker de
   * juiste badges. Frontend rendert badges defensief (`f.unseen ?`) dus
   * `null`-counts vlak na cold-load zijn veilig.
   */
  async fetchFolders(force = false): Promise<CachedFolder[]> {
    if (!force && this.folders.length > 0 && Date.now() - this.foldersTs < MailAccountCache.FOLDER_TTL) {
      return this.folders;
    }

    const client = await this.ensureConnected();
    const list = await client.list();
    this.folders = list.map((f) => ({
      path: f.path,
      name: f.name,
      delimiter: f.delimiter,
      flags: Array.from(f.flags || []),
      specialUse: f.specialUse || null,
      listed: f.listed,
      messages: null,
      unseen: null,
    }));
    this.foldersTs = Date.now();
    // Doe een snelle STATUS voor de INBOX SYNCHROON zodat de sidebar-badge
    // direct gevuld is. Eén roundtrip (~50-150 ms). Alle andere folders
    // krijgen hun counts asynchroon via `refreshFolderCountsAsync` zodat
    // /api/mail/messages er niet door blokkeert. Zonder dit kreeg de
    // gebruiker bij elke first-paint een lege Email-badge (sidebar) en
    // geen "ongelezen"-cijfer naast INBOX tot ~8 s later.
    const inboxIdx = this.folders.findIndex((f) => f.path === "INBOX");
    if (inboxIdx >= 0) {
      try {
        const status = await client.status("INBOX", { messages: true, unseen: true });
        this.folders[inboxIdx] = {
          ...this.folders[inboxIdx],
          messages: status.messages ?? null,
          unseen: status.unseen ?? null,
        };
      } catch {
        // STATUS-failure niet kritiek; refreshFolderCountsAsync vult later
      }
    }
    this.refreshFolderCountsAsync();
    return this.folders;
  }

  /**
   * Achter-de-schermen STATUS-per-folder-update. Houdt het IMAP-lock kort
   * vast (per folder ~50-150 ms), gespreid over folders. WeakSet-equivalent
   * voor in-flight protection zit op instance-niveau via `folderCountsInFlight`.
   * Mutateert `this.folders` in-place zodat een volgende `fetchFolders`-
   * cache-hit de juiste counts oplevert.
   */
  private folderCountsInFlight = false;
  private refreshFolderCountsAsync(): void {
    if (this.folderCountsInFlight) return;
    this.folderCountsInFlight = true;
    // 8 s defer: parallel-binnenkomende /api/mail/messages?folder=INBOX moet
    // EERST zijn SELECT+FETCH kunnen doen (cold ~3-5 s). Anders pakken de
    // 25+ STATUS-roundtrips het connection-level lock en wacht /messages
    // 5-10 s extra. Bewust 3 s NÁ de warmup-defer (T=5s) zodat we niet
    // tegelijk om dezelfde IMAP-lock vechten met warmupCacheAsync.
    setTimeout(() => {
      void (async () => {
        try {
          const client = await this.ensureConnected();
          const snapshot = this.folders.slice();
          for (const f of snapshot) {
            try {
              const status = await client.status(f.path, { messages: true, unseen: true });
              const existing = this.folders.find((g) => g.path === f.path);
              if (existing) {
                existing.messages = status.messages ?? null;
                existing.unseen = status.unseen ?? null;
              }
            } catch {
              // Eén folder zonder STATUS-rechten (bv. /[Gmail] root) mag de hele update niet stoppen
            }
          }
        } catch {
          // verbinding weg — laat staan tot volgende call
        } finally {
          this.folderCountsInFlight = false;
        }
      })();
    }, 8000);
  }

  /** Fetch and cache messages for a folder */
  async fetchMessages(folder: string, force = false, page = 1, pageSize = 50, sinceDays?: number, background = false): Promise<{ messages: CachedMessage[]; total: number }> {
    // pageSize=0 means "all" — use large number
    if (pageSize === 0) pageSize = 5000;
    const cacheKey = `${folder}:${page}:${pageSize}:${sinceDays || "all"}`;

    if (!force) {
      const cached = this.folderMessages.get(cacheKey);
      if (cached && Date.now() - cached.ts < MailAccountCache.MSG_LIST_TTL) {
        return { messages: cached.messages, total: cached.total };
      }
    }

    // Achtergrond-warmup: sla mappen over die recent faalden (niet-selecteerbaar
    // / "Command failed"). Voorkomt dat de warmup de IMAP-verbinding telkens
    // opnieuw seconden bezet houdt met dezelfde falende map. Interactieve fetches
    // (background=false) negeren deze lijst en proberen altijd opnieuw.
    if (background) {
      const failedTs = this.failedFolders.get(folder);
      if (failedTs && Date.now() - failedTs < MailAccountCache.FAILED_FOLDER_TTL) {
        return { messages: [], total: 0 };
      }
    }

    return this.opQueue.enqueue(async () => {
     try {
      // Auto-retry once on connection errors (stale connection after idle)
      const attempt = async (): Promise<{ client: ImapFlow; lock: any }> => {
        const c = await this.ensureConnected();
        let lock;
        let retries = 0;
        while (retries < 2) {
          try {
            lock = await Promise.race([
              c.getMailboxLock(folder),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Mailbox lock timeout voor ${folder} (${this.key})`)), 30_000)
              ),
            ]);
            return { client: c, lock };
          } catch (lockErr) {
            retries++;
            if (retries >= 2) {
              this.connected = false;
              throw lockErr;
            }
            await new Promise(r => setTimeout(r, 500));
          }
        }
        throw new Error("Unreachable");
      };

      let client: ImapFlow;
      let lock: any;
      try {
        ({ client, lock } = await attempt());
      } catch (firstErr) {
        // Connection was stale — force reconnect and retry once
        const msg = ((firstErr as Error)?.message || "").toLowerCase();
        if (msg.includes("socket") || msg.includes("closed") || msg.includes("disconnect") || msg.includes("reset") || msg.includes("timeout") || !this.connected) {
          console.log(`[mail-cache] fetchMessages retry after connection error: ${(firstErr as Error)?.message}`);
          this.connected = false;
          if (this.client) { try { this.client.close(); } catch { /* ignore */ } this.client = null; }
          ({ client, lock } = await attempt());
        } else {
          throw firstErr;
        }
      }
      try {
        const status = client.mailbox;
        let total = (status ? (status as { exists?: number }).exists : 0) || 0;

        // Use IMAP SEARCH with SINCE date filter when sinceDays is specified
        let fetchRange: string | number[];
        if (sinceDays && sinceDays > 0) {
          const sinceDate = new Date();
          sinceDate.setDate(sinceDate.getDate() - sinceDays);
          const uids = await client.search({ since: sinceDate }, { uid: true });
          if (!uids || uids.length === 0) {
            const result = { messages: [] as CachedMessage[], total: 0 };
            this.folderMessages.set(cacheKey, { ...result, ts: Date.now() });
            return result;
          }
          const sortedUids = [...uids].sort((a, b) => b - a);
          const startIdx = (page - 1) * pageSize;
          const pageUids = sortedUids.slice(startIdx, startIdx + pageSize);
          if (pageUids.length === 0) {
            return { messages: [], total: sortedUids.length };
          }
          fetchRange = pageUids;
        } else if (total === 0) {
          // SELECT reported an empty mailbox. A sequence-number FETCH such as
          // "1:1" on a TRULY empty mailbox makes Office365 answer NO → ImapFlow
          // throws "Command failed" (this is why empty folders like Archive /
          // Conversation History used to 500). Office365 also occasionally
          // under-reports EXISTS right after SELECT, so we don't blindly trust
          // total===0: confirm with a UID SEARCH. Empty → return empty without
          // any FETCH; non-empty → Office365 lied, fetch the page by UID.
          const allUids = await client.search({ all: true }, { uid: true });
          if (!allUids || allUids.length === 0) {
            const result = { messages: [] as CachedMessage[], total: 0 };
            this.folderMessages.set(cacheKey, { ...result, ts: Date.now() });
            this.failedFolders.delete(folder);
            return result;
          }
          const sortedUids = [...allUids].sort((a, b) => b - a);
          total = sortedUids.length;
          const startIdx = (page - 1) * pageSize;
          const pageUids = sortedUids.slice(startIdx, startIdx + pageSize);
          if (pageUids.length === 0) {
            return { messages: [], total };
          }
          fetchRange = pageUids;
        } else {
          const end = total;
          const start = Math.max(1, end - (page * pageSize) + 1);
          const fetchEnd = Math.max(1, end - ((page - 1) * pageSize));
          fetchRange = `${start}:${fetchEnd}`;
        }

        const messages: CachedMessage[] = [];
        const fetchOptions = { envelope: true, flags: true, bodyStructure: true, uid: true };
        const useUidFetch = Array.isArray(fetchRange);
        const fetchSource = useUidFetch
          ? client.fetch(fetchRange as number[], fetchOptions, { uid: true })
          : client.fetch(fetchRange as string, fetchOptions);
        for await (const msg of fetchSource) {
          let hasAttachments = false;
          if (msg.bodyStructure) {
            // Strict: tel ALLEEN parts met disposition="attachment". Inline-
            // images (signature-logo's, embedded plaatjes via CID) hebben
            // disposition="inline" en moeten NIET als "echte bijlage"
            // gelden — anders krijgt elke mail met een handtekening de
            // paperclip-indicator + telling. Voor preview-paneel filtert de
            // frontend al inline-CIDs uit; de paperclip in de maillijst
            // gebruikt deze flag direct.
            const checkParts = (part: typeof msg.bodyStructure): boolean => {
              if (part.disposition === "attachment") return true;
              if (part.childNodes) return part.childNodes.some(checkParts);
              return false;
            };
            hasAttachments = checkParts(msg.bodyStructure);
          }

          messages.push({
            uid: msg.uid,
            seq: msg.seq,
            flags: Array.from(msg.flags || []),
            date: msg.envelope?.date?.toISOString() || null,
            subject: msg.envelope?.subject || "(geen onderwerp)",
            from: msg.envelope?.from?.map((a: any) => ({ name: a.name || "", address: a.address || (a.mailbox && a.host ? `${a.mailbox}@${a.host}` : "") })) || [],
            to: msg.envelope?.to?.map((a: any) => ({ name: a.name || "", address: a.address || (a.mailbox && a.host ? `${a.mailbox}@${a.host}` : "") })) || [],
            seen: msg.flags?.has("\\Seen") || false,
            flagged: msg.flags?.has("\\Flagged") || false,
            hasAttachments,
          });
        }

        messages.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        this.folderMessages.set(cacheKey, { messages, total, ts: Date.now() });
        this.failedFolders.delete(folder); // geslaagd → uit de skip-lijst
        return { messages, total };
      } finally {
        lock!.release();
      }
     } catch (err) {
       // Onthoud de falende map zodat de warmup hem 15 min overslaat.
       this.failedFolders.set(folder, Date.now());
       throw err;
     }
    }, background ? -1 : 0);
  }

  /**
   * Parse a message source into a CachedFullMessage.
   * Extracts text/html body and attachment metadata, then discards binary content.
   */
  private static async parseMessage(
    envelope: any, flags: any, source: Buffer | null
  ): Promise<{ textBody: string; htmlBody: string; attachments: AttachmentMeta[]; messageId?: string; inReplyTo?: string; references?: string }> {
    let textBody = "";
    let htmlBody = "";
    const attachments: AttachmentMeta[] = [];
    let messageId: string | undefined;
    let inReplyTo: string | undefined;
    let references: string | undefined;

    if (source) {
      const parsed = await simpleParser(source);
      textBody = parsed.text || "";
      htmlBody = parsed.html || "";
      messageId = parsed.messageId || undefined;
      inReplyTo = (parsed.inReplyTo as string) || undefined;
      references = parsed.references ? (Array.isArray(parsed.references) ? parsed.references.join(" ") : String(parsed.references)) : undefined;
      // Extract attachment metadata only — discard binary content immediately
      if (parsed.attachments?.length) {
        for (const a of parsed.attachments) {
          attachments.push({
            filename: a.filename || "bijlage",
            contentType: a.contentType || "application/octet-stream",
            size: a.size || 0,
            cid: a.cid || undefined,
            contentDisposition: (a as any).contentDisposition || undefined,
          });
        }
      }
      // parsed object (with binary content) goes out of scope and gets GC'd
    }

    return { textBody, htmlBody, attachments, messageId, inReplyTo, references };
  }

  private static buildFullMessage(
    uid: number, envelope: any, flags: any,
    body: { textBody: string; htmlBody: string; attachments: AttachmentMeta[]; messageId?: string; inReplyTo?: string; references?: string },
    markSeen = false
  ): CachedFullMessage {
    return {
      uid,
      seq: 0,
      flags: Array.from(flags || []),
      date: envelope?.date?.toISOString() || null,
      subject: envelope?.subject || "(geen onderwerp)",
      from: envelope?.from?.map((a: any) => ({ name: a.name || "", address: a.address || (a.mailbox && a.host ? `${a.mailbox}@${a.host}` : "") })) || [],
      to: envelope?.to?.map((a: any) => ({ name: a.name || "", address: a.address || (a.mailbox && a.host ? `${a.mailbox}@${a.host}` : "") })) || [],
      cc: envelope?.cc?.map((a: any) => ({ name: a.name || "", address: a.address || (a.mailbox && a.host ? `${a.mailbox}@${a.host}` : "") })) || [],
      seen: markSeen || flags?.has?.("\\Seen") || false,
      flagged: flags?.has?.("\\Flagged") || false,
      hasAttachments: body.attachments.length > 0,
      textBody: body.textBody,
      htmlBody: body.htmlBody,
      attachments: body.attachments,
      messageId: body.messageId,
      inReplyTo: body.inReplyTo,
      references: body.references,
    };
  }

  /**
   * Preload message bodies for a folder.
   * Downloads source but discards attachment binary content immediately.
   * Only metadata (filename, size, type) is kept.
   */
  async preloadBodies(folder: string, messages: CachedMessage[]): Promise<void> {
    if (this.preloadingBodies) return;
    this.preloadingBodies = true;

    const uncachedUids = messages
      .filter(m => !this.fullMessages.has(`${folder}:${m.uid}`))
      .map(m => m.uid);

    if (uncachedUids.length === 0) {
      this.preloadingBodies = false;
      return;
    }

    console.log(`[mail-cache] Preloading ${uncachedUids.length} message bodies for ${folder} (${this.key})`);
    const startTime = Date.now();

    // Wave 1++: chunked bulk-fetch ipv N × fetchOne.
    //
    // VROEGER: `for (uid of uncachedUids) await client.fetchOne(uid, ...)` —
    // 30 sequentiële IMAP-roundtrips binnen één opQueue-lock. Bij O365
    // latency 300-500ms per fetch = 9-15s waarin álle user-actions
    // (folder switch, mail open, mark-read) volledig vast stonden achter
    // de preload. E2E-meting Playwright vond een 160-seconde wachttijd
    // op een eerste `/api/mail/conversation`-call die direct na warmup
    // arriveerde.
    //
    // NU: `client.fetch(uidSet, {...}, {uid: true})` is een PIPELINED IMAP
    // FETCH-batch. Eén command, server stream't N message-records terug.
    // ImapFlow's async iterator yields ze één voor één terwijl het netwerk
    // ze ontvangt. Effectief: factor 5-10x sneller dan losse fetchOne.
    //
    // We splitsen extra in chunks van 10 zodat we tussen chunks de lock
    // kort vrijgeven via `setImmediate` → user-acties die intussen
    // binnenkomen krijgen toegang tussen chunks i.p.v. helemaal achteraan
    // de queue.
    const CHUNK_SIZE = 10;
    try {
      for (let i = 0; i < uncachedUids.length; i += CHUNK_SIZE) {
        const chunk = uncachedUids.slice(i, i + CHUNK_SIZE);
        await this.opQueue.enqueue(async () => {
          const client = await this.ensureConnected();
          const lock = await client.getMailboxLock(folder);
          try {
            // ImapFlow accepteert array van UIDs voor multi-fetch.
            for await (const msg of client.fetch(chunk, {
              envelope: true, flags: true, source: true, uid: true,
            }, { uid: true })) {
              const cacheKey = `${folder}:${msg.uid}`;
              if (this.fullMessages.has(cacheKey)) continue;
              try {
                const body = await MailAccountCache.parseMessage(msg.envelope, msg.flags, msg.source ?? null);
                const fullMsg = MailAccountCache.buildFullMessage(msg.uid, msg.envelope, msg.flags, body);
                this.fullMessages.set(cacheKey, fullMsg);
                this.evictFullMessagesIfTooBig();
              } catch (err) {
                console.warn(`[mail-cache] Failed to parse preload uid ${msg.uid}:`, (err as Error).message);
              }
            }
          } finally {
            lock.release();
          }
        });
        // Geef event-loop een tick zodat user-acties tussen chunks
        // hun beurt krijgen in opQueue. setImmediate yieldt naar I/O.
        await new Promise<void>((r) => setImmediate(r));
      }
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[mail-cache] Preloaded ${uncachedUids.length} bodies for ${folder} in ${elapsed}s (chunked bulk-fetch). Total cached: ${this.fullMessages.size}`);
    } catch (err) {
      console.error(`[mail-cache] Preload error for ${folder}:`, (err as Error).message);
    } finally {
      this.preloadingBodies = false;
    }
  }

  /**
   * Bulk-fetch bodies voor de lokale body-cache pre-fill. Gebruikt PEEK
   * (`source: true` → BODY.PEEK[]) dus markeert NIETS als gelezen. Cachet de
   * gebouwde messages ook in fullMessages (LRU-capped → geen onbounded RAM) en
   * geeft ze terug zodat de frontend ze in IndexedDB kan zetten. Chunked +
   * setImmediate-yield zodat interactieve acties tussendoor hun beurt krijgen;
   * background=true → lage queue-prioriteit.
   */
  async fetchBodiesBatch(folder: string, uids: number[], background = false): Promise<CachedFullMessage[]> {
    if (uids.length === 0) return [];
    const out: CachedFullMessage[] = [];
    const CHUNK_SIZE = 10;
    for (let i = 0; i < uids.length; i += CHUNK_SIZE) {
      const chunk = uids.slice(i, i + CHUNK_SIZE);
      const built = await this.opQueue.enqueue(async () => {
        const client = await this.ensureConnected();
        const lock = await client.getMailboxLock(folder);
        const res: CachedFullMessage[] = [];
        try {
          for await (const msg of client.fetch(chunk, {
            envelope: true, flags: true, source: true, uid: true,
          }, { uid: true })) {
            try {
              const body = await MailAccountCache.parseMessage(msg.envelope, msg.flags, msg.source ?? null);
              const full = MailAccountCache.buildFullMessage(msg.uid, msg.envelope, msg.flags, body);
              this.fullMessages.set(`${folder}:${msg.uid}`, full);
              this.evictFullMessagesIfTooBig();
              res.push(full);
            } catch { /* skip parse error op één bericht */ }
          }
        } finally {
          lock.release();
        }
        return res;
      }, background ? -1 : 0);
      out.push(...built);
      await new Promise<void>((r) => setImmediate(r));
    }
    return out;
  }

  /** Fetch a full message with body (served from cache if available) */
  async fetchFullMessage(folder: string, uid: number): Promise<CachedFullMessage> {
    const cacheKey = `${folder}:${uid}`;
    const cached = this.fullMessages.get(cacheKey);
    if (cached) return cached;

    const result = await this.opQueue.enqueue(async () => {
      const client = await this.ensureConnected();
      const lock = await client.getMailboxLock(folder);
      try {
        // Await \Seen STORE zodat IMAP server het flag heeft VOORDAT we
        // fetchOne doen — anders kan fetch terug-rapporteren met seen=false
        // (race binnen ImapFlow's command-queue). Daarvoor was dit fire-
        // and-forget met silent swallow; resultaat: mark-read kwam niet
        // door op de server, lijst flickerte BOLD na elke F5, "1 ongelezen"-
        // discrepantie. Logged ook explicit zodat we kunnen zien wanneer
        // O365 NEE zegt (scope, lock-race, NAT-drop). Kosten: +50-150 ms
        // per cold mail-open. Acceptabel tegenover de UX-jank.
        try {
          await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
        } catch (err) {
          console.warn(`[mail-cache] \\Seen STORE failed uid=${uid} folder=${folder}: ${(err as Error).message}`);
        }

        const msg = await client.fetchOne(`${uid}`, {
          envelope: true, flags: true, source: true, uid: true,
        }, { uid: true });
        if (!msg) throw new Error(`Message uid=${uid} not found in ${folder}`);

        const body = await MailAccountCache.parseMessage(msg.envelope, msg.flags, msg.source ?? null);
        const fullMsg = MailAccountCache.buildFullMessage(msg.uid, msg.envelope, msg.flags, body, true);

        this.fullMessages.set(cacheKey, fullMsg);
        this.evictFullMessagesIfTooBig();
        return fullMsg;
      } finally {
        lock.release();
      }
    });
    // Open-message auto-zet \Seen; folder-status cache (foldersTs) moet
    // bijgewerkt zodat de sidebar-badge na reload het echte unseen-count
    // ziet, niet de stale waarde van voor het openen.
    this.foldersTs = 0;
    this.invalidateFolder(folder);
    return result;
  }

  /** Read fullMessages cache without triggering any IMAP work. */
  getCachedFullMessage(folder: string, uid: number): CachedFullMessage | undefined {
    return this.fullMessages.get(`${folder}:${uid}`);
  }

  /**
   * Fetch header-only info (envelope + References) for a set of UIDs in a
   * folder. No body, no \Seen side-effect. Used by conversation threading
   * to extract Message-ID / In-Reply-To / References without paying the
   * cost of a full body fetch + simpleParser.
   */
  /**
   * True if this folder's first page (default size 50) is already in the
   * in-memory list cache and still fresh. Used by conversation-threading to
   * decide which project-folders are cheap to scan (cache hit, no IMAP) vs.
   * which would force a cold cross-mailbox fetch and must be skipped.
   */
  hasFreshFolderCache(folder: string, page = 1, pageSize = 50): boolean {
    const cached = this.folderMessages.get(`${folder}:${page}:${pageSize}:all`);
    return !!cached && Date.now() - cached.ts < MailAccountCache.MSG_LIST_TTL;
  }

  async fetchHeadersBatch(folder: string, uids: number[], background = false): Promise<HeaderInfo[]> {
    if (uids.length === 0) return [];
    return this.opQueue.enqueue(async () => {
      const client = await this.ensureConnected();
      const lock = await client.getMailboxLock(folder);
      const results: HeaderInfo[] = [];
      try {
        for await (const msg of client.fetch(uids, {
          envelope: true,
          flags: true,
          // ImapFlow's `headers`-optie genereert het correcte IMAP-commando
          // `BODY.PEEK[HEADER.FIELDS (REFERENCES)]` (ongequote sectie). De
          // eerdere `bodyParts: ["HEADER.FIELDS (REFERENCES)"]` produceerde
          // `BODY.PEEK["HEADER.FIELDS (REFERENCES)"]` (gequote) → O365 weigert
          // dat met `BAD Command Argument Error` → conversation-fetch 500'de en
          // viel terug op alleen subject-matching (miste verzonden mails).
          headers: ["references"],
          uid: true,
        }, { uid: true })) {
          const env = msg.envelope;
          if (!env) continue;
          let references: string | undefined;
          const headerBuf = msg.headers;
          if (headerBuf) {
            const headerStr = headerBuf.toString("utf-8");
            const m = /^References:\s*(.+(?:\r?\n[ \t].+)*)/im.exec(headerStr);
            if (m) references = m[1].replace(/\r?\n[ \t]/g, " ").trim();
          }
          const flags = msg.flags ?? new Set<string>();
          results.push({
            uid: msg.uid!,
            folder,
            subject: env.subject || "",
            date: env.date ? new Date(env.date).toISOString() : null,
            from: (env.from || []).map(a => ({ name: a.name || "", address: a.address || "" })),
            to: (env.to || []).map(a => ({ name: a.name || "", address: a.address || "" })),
            cc: (env.cc || []).map(a => ({ name: a.name || "", address: a.address || "" })),
            seen: flags.has("\\Seen"),
            flagged: flags.has("\\Flagged"),
            flags: Array.from(flags),
            messageId: env.messageId || undefined,
            inReplyTo: env.inReplyTo || undefined,
            references,
          });
        }
      } finally {
        lock.release();
      }
      return results;
    }, background ? -1 : 0);
  }

  /** Get list of all folder paths (for conversation search-space expansion). */
  async getAllFolderPaths(): Promise<CachedFolder[]> {
    return this.fetchFolders();
  }

  /** Conversation cache: messageId → result, TTL 5 min. */
  private conversationCache = new Map<string, { ts: number; data: ConversationResult[] }>();
  private static readonly CONVERSATION_TTL = 5 * 60_000;

  getCachedConversation(key: string): ConversationResult[] | null {
    const entry = this.conversationCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > MailAccountCache.CONVERSATION_TTL) {
      this.conversationCache.delete(key);
      return null;
    }
    return entry.data;
  }

  setCachedConversation(key: string, data: ConversationResult[]): void {
    this.conversationCache.set(key, { ts: Date.now(), data });
    // Simple cap: trim oldest if > 100 entries.
    if (this.conversationCache.size > 100) {
      const oldest = this.conversationCache.keys().next().value;
      if (oldest) this.conversationCache.delete(oldest);
    }
  }

  /** Remove a message from local caches only (for optimistic delete) */
  removeCachedMessage(folder: string, uid: number) {
    this.fullMessages.delete(`${folder}:${uid}`);
    // Remove from all folder message list caches
    for (const [key, cache] of this.folderMessages) {
      if (key.startsWith(`${folder}:`)) {
        cache.messages = cache.messages.filter(m => m.uid !== uid);
        cache.total = Math.max(0, cache.total - 1);
      }
    }
  }

  /** Delete a message via IMAP */
  async deleteMessage(folder: string, uid: number): Promise<void> {
    await this.opQueue.enqueue(async () => {
      const client = await this.ensureConnected();
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageDelete({ uid }, { uid: true });
      } finally {
        lock.release();
      }
    });
    // Clean up any remaining cached data
    this.fullMessages.delete(`${folder}:${uid}`);
    for (const [key, cache] of this.folderMessages) {
      if (key.startsWith(`${folder}:`)) {
        cache.messages = cache.messages.filter(m => m.uid !== uid);
      }
    }
  }

  /** Move a message to another folder */
  async moveMessage(fromFolder: string, uid: number, toFolder: string): Promise<void> {
    await this.opQueue.enqueue(async () => {
      const client = await this.ensureConnected();
      const lock = await client.getMailboxLock(fromFolder);
      try {
        await client.messageMove({ uid }, toFolder, { uid: true });
      } finally {
        lock.release();
      }
    });
    // Move cached body to new folder key
    const oldKey = `${fromFolder}:${uid}`;
    const cached = this.fullMessages.get(oldKey);
    if (cached) {
      this.fullMessages.delete(oldKey);
      // Don't set new key since UID changes after move
    }
    // Invalidate both folder caches
    this.invalidateFolder(fromFolder);
    this.invalidateFolder(toFolder);
  }

  /** Fetch a specific attachment's binary content. §2: gebruikt eerst een
   * dedicated attachment-buffer cache; alleen bij miss wordt het bericht
   * opnieuw uit IMAP gehaald + ge-parsed. Eerder werd élke download het
   * volledige RFC822-bericht via simpleParser geparset, ook al was de body
   * al gecached door fetchFullMessage. */
  async fetchAttachment(folder: string, uid: number, index: number): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
    const cacheKey = `${folder}:${uid}:${index}`;
    const cached = this.attachmentCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < MailAccountCache.ATT_CACHE_TTL) {
      // LRU touch: re-insert om de entry naar het einde van de Map te bewegen.
      this.attachmentCache.delete(cacheKey);
      this.attachmentCache.set(cacheKey, { ...cached, ts: Date.now() });
      return { filename: cached.filename, contentType: cached.contentType, content: cached.content };
    }
    const result = await this.opQueue.enqueue(async () => {
      const client = await this.ensureConnected();
      const lock = await client.getMailboxLock(folder);
      try {
        const msg = await client.fetchOne(`${uid}`, { source: true, uid: true }, { uid: true });
        if (!msg || !msg.source) return null;

        const parsed = await simpleParser(msg.source);
        const att = parsed.attachments?.[index];
        if (!att) return null;

        return {
          filename: att.filename || "bijlage",
          contentType: att.contentType || "application/octet-stream",
          content: att.content,
        };
      } finally {
        lock.release();
      }
    });
    if (result) {
      this.attachmentCache.set(cacheKey, { ...result, ts: Date.now() });
      this.evictAttachmentCacheIfTooBig();
    }
    return result;
  }

  /** LRU-eviction: verwijder de oudste entries totdat de totale grootte
   * onder ATT_CACHE_MAX_BYTES is. Map-iteratie volgt insertion-order, dus
   * `delete + set` op een hit verplaatst de entry naar het einde. */
  private evictAttachmentCacheIfTooBig(): void {
    let total = 0;
    for (const entry of this.attachmentCache.values()) total += entry.content.length;
    while (total > MailAccountCache.ATT_CACHE_MAX_BYTES) {
      const first = this.attachmentCache.keys().next();
      if (first.done) break;
      const entry = this.attachmentCache.get(first.value);
      if (entry) total -= entry.content.length;
      this.attachmentCache.delete(first.value);
    }
  }

  /** Insertion-order LRU-cap voor fullMessages. Wordt aangeroepen direct na
   * elke `.set()`. Bij oversize: verwijder oudste entries (Map preserves
   * insertion order). Bij een cache-hit-refresh moet de caller eerst
   * `delete` doen vóór `set` om de entry naar het einde te shoven. */
  private evictFullMessagesIfTooBig(): void {
    while (this.fullMessages.size > MailAccountCache.FULL_MSG_CACHE_MAX_COUNT) {
      const first = this.fullMessages.keys().next();
      if (first.done) break;
      this.fullMessages.delete(first.value);
    }
  }

  /** Create a new mailbox folder */
  async createFolder(name: string): Promise<void> {
    const client = await this.ensureConnected();
    await client.mailboxCreate(name);
    // Refresh folder list
    this.foldersTs = 0;
    await this.fetchFolders(true);
  }

  /** Delete a mailbox folder (onomkeerbaar — caller bevestigt vooraf). */
  async deleteFolder(path: string): Promise<void> {
    const client = await this.ensureConnected();
    await client.mailboxDelete(path);
    // Wis de message-list-cache van deze map en ververs de folder-lijst.
    this.invalidateFolder(path);
    this.foldersTs = 0;
    await this.fetchFolders(true);
  }

  /** Invalidate message list cache for a folder */
  invalidateFolder(folder: string) {
    for (const [key] of this.folderMessages) {
      if (key.startsWith(`${folder}:`)) this.folderMessages.delete(key);
    }
  }

  /** Append a raw message to a folder (for saving sent mail) */
  async appendMessage(folder: string, rawMessage: Buffer, flags: string[] = ["\\Seen"]): Promise<void> {
    const client = await this.ensureConnected();
    await client.append(folder, rawMessage, flags);
    this.invalidateFolder(folder);
  }

  /** Fetch a message's raw RFC822 source and its IMAP flags. Used for
   * cross-account move where we cannot use IMAP MOVE/COPY (different
   * servers) and have to read on one connection, append on another. */
  async fetchRawSource(folder: string, uid: number): Promise<{ source: Buffer; flags: string[] } | null> {
    return this.opQueue.enqueue(async () => {
      const client = await this.ensureConnected();
      const lock = await client.getMailboxLock(folder);
      try {
        const msg = await client.fetchOne(`${uid}`, { source: true, flags: true, uid: true }, { uid: true });
        if (!msg || !msg.source) return null;
        // imapflow returns flags as a Set<string>. Strip Recent (server-only)
        // and Deleted; the new message in the destination shouldn't carry
        // either. Keep \Seen, \Flagged, \Answered, \Draft, and custom labels.
        const flags = Array.from(msg.flags || []).filter(
          (f) => f !== "\\Recent" && f !== "\\Deleted",
        );
        return { source: Buffer.from(msg.source), flags };
      } finally {
        lock.release();
      }
    });
  }

  /** Mark a message as unread */
  async markUnread(folder: string, uid: number): Promise<void> {
    await this.opQueue.enqueue(async () => {
      const client = await this.ensureConnected();
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsRemove({ uid }, ["\\Seen"], { uid: true });
      } finally {
        lock.release();
      }
    });
    const cacheKey = `${folder}:${uid}`;
    const cached = this.fullMessages.get(cacheKey);
    if (cached) cached.seen = false;
    this.invalidateFolder(folder);
    // Folder-status cache bevat unseen-counts; zonder bumping hier blijft
    // de sidebar-badge "vastzitten" op de oude waarde tot foldersTs verloopt.
    this.foldersTs = 0;
  }

  /** Mark a message as read */
  async markRead(folder: string, uid: number): Promise<void> {
    await this.opQueue.enqueue(async () => {
      const client = await this.ensureConnected();
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
      } finally {
        lock.release();
      }
    });
    const cacheKey = `${folder}:${uid}`;
    const cached = this.fullMessages.get(cacheKey);
    if (cached) cached.seen = true;
    this.invalidateFolder(folder);
    this.foldersTs = 0;
  }

  /** Rename a mailbox folder */
  async renameFolder(oldPath: string, newPath: string): Promise<void> {
    const client = await this.ensureConnected();
    await client.mailboxRename(oldPath, newPath);
    this.foldersTs = 0;
    await this.fetchFolders(true);
  }

  /** Get cache stats */
  getStats() {
    return {
      folders: this.folders.length,
      folderCaches: this.folderMessages.size,
      cachedBodies: this.fullMessages.size,
      connected: this.connected,
      preloading: this.preloadingBodies,
    };
  }

  /** IDLE-loop op INBOX. Eén dedicated ImapFlow-client per account (IDLE
   * blokkeert de connection dus kan niet op de hoofd-client). Bij EXISTS
   * (nieuwe mail) of FLAGS (read/unread change) wordt naar alle geregistreerde
   * (yAppSid, instanceId) entries een mail-changed event gepushed via ws-events.
   * Restart elke 25 min — RFC 2177 zegt IDLE moet binnen 29 min opnieuw worden
   * uitgegeven. */
  private async startIdleLoop(): Promise<void> {
    // Run-guard: niet uit `idleClient` af te leiden — die is `null` tijdens de
    // restart-/reconnect-wacht terwijl de loop nog draait. Een refresh die in
    // dat gat opnieuw `startIdleLoop` triggert zou een tweede parallelle loop
    // starten (dubbele connect-churn). De vlag in try/finally voorkomt dat én
    // herstelt netjes als de while onverwacht zou ontsnappen.
    if (this.idleLoopRunning || this.idleStopRequested) return;
    this.idleLoopRunning = true;
    try {
    while (!this.idleStopRequested && this.idleListeners.size > 0) {
      // Respecteer de GEDEELDE connect-backoff. Zolang het fetch-pad (of een
      // eerdere IDLE-poging) de mailserver-throttle heeft geraakt, niet
      // opnieuw connecten — anders houdt de IDLE-loop (eigen socket, elke ~10s)
      // de rate-limit warm en dooft de throttle nooit uit (→ mailbox hangt vast
      // tot een prod-restart). Pollt het venster in stappen van max 30s zodat
      // een stop-request snel wordt opgepikt.
      if (Date.now() < this.backoffUntil) {
        const wait = Math.min(this.backoffUntil - Date.now(), 30_000);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      try {
        const authConfig = this.creds.authMode === "oauth2"
          ? { user: this.creds.user, accessToken: this.creds.accessToken! }
          : { user: this.creds.user, pass: this.creds.pass };
        const idle = new ImapFlow({
          host: this.creds.host,
          port: this.creds.port,
          secure: this.creds.secure,
          auth: authConfig,
          logger: false,
          emitLogs: false,
          tls: this.creds.secure ? { servername: this.creds.host, minVersion: "TLSv1.2" } : undefined,
        });
        this.idleClient = idle;
        // Listeners VÓÓR connect zodat geen events gemist worden.
        idle.on("exists", (data: any) => {
          console.log(`[mail-idle] EXISTS event count=${data?.count} prev=${data?.prevCount} for ${this.key}`);
          this.broadcastMailEvent("INBOX");
        });
        idle.on("expunge", () => {
          console.log(`[mail-idle] EXPUNGE event for ${this.key}`);
          this.broadcastMailEvent("INBOX");
        });
        idle.on("flags", () => {
          console.log(`[mail-idle] FLAGS event for ${this.key}`);
          this.broadcastMailEvent("INBOX");
        });
        idle.on("error", (err: any) => {
          console.warn(`[mail-idle] client error for ${this.key}: ${err?.message || err}`);
        });
        idle.on("close", () => {
          console.log(`[mail-idle] connection closed for ${this.key}`);
        });
        // Via de per-host connect-gate (burst-preventie): de IDLE-reconnect mag
        // niet samen met fetch-reconnects een piek naar de mailserver vormen.
        await imapConnectGate.run(this.creds.host, () => idle.connect());
        // Geslaagde IDLE-connect ⇒ de mailserver accepteert weer verbindingen ⇒
        // reset de gedeelde backoff zodat ook het fetch-pad meteen weer mag.
        this.noteConnectSuccess();
        imapConnLimiter.track(this.creds.host, idle);
        const idleConnectedAt = Date.now();
        // Open mailbox ZONDER lock. Imapflow start automatisch IDLE bij
        // inactiviteit (~30s default). EXISTS-events worden via de listeners
        // gevangen ongeacht of we expliciet idle() aanroepen.
        await idle.mailboxOpen("INBOX");
        console.log(`[mail-idle] mailbox INBOX open for ${this.key}, awaiting auto-IDLE events`);
        // Wacht tot timeout of stop-request / connection-close. Geen
        // explicit idle() call — imapflow's auto-idle in de achtergrond doet
        // het werk.
        await new Promise<void>((resolve) => {
          const tid = setTimeout(resolve, MailAccountCache.IDLE_RESTART_MS);
          const interval = setInterval(() => {
            if (this.idleStopRequested) {
              clearTimeout(tid);
              clearInterval(interval);
              resolve();
            }
          }, 2000);
          idle.once("close", () => {
            clearTimeout(tid);
            clearInterval(interval);
            resolve();
          });
        });
        try { await idle.logout(); } catch { try { idle.close(); } catch { /* ignore */ } }
        this.idleClient = null;
        // Churn-rem: sloot de verbinding snel (server kapt idle-verbindingen kort
        // af)? Dan escalerend wachten vóór reconnect i.p.v. elke ~minuut een
        // nieuwe te maken. Bleef 'ie lang open → reset naar de normale 1s.
        const uptime = Date.now() - idleConnectedAt;
        if (!this.idleStopRequested && uptime < MailAccountCache.IDLE_MIN_HEALTHY_MS) {
          this.idleQuickCloses++;
          const delay = Math.min(5_000 * 2 ** (this.idleQuickCloses - 1), MailAccountCache.IDLE_RECONNECT_MAX_MS);
          console.warn(`[mail-idle] verbinding sloot na ${Math.round(uptime / 1000)}s (#${this.idleQuickCloses}) voor ${this.key}; reconnect na ${Math.round(delay / 1000)}s`);
          await new Promise((r) => setTimeout(r, delay));
        } else {
          this.idleQuickCloses = 0;
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (err) {
        // Lek dichten: sluit de mislukte/half-open verbinding vóór we de
        // referentie weggooien — anders blijft de socket op de server hangen
        // en loopt het aantal verbindingen op.
        if (this.idleClient) { try { this.idleClient.close(); } catch { /* ignore */ } }
        this.idleClient = null;
        // Voed de GEDEELDE connect-backoff i.p.v. een vaste 10s: een falende
        // IDLE-connect betekent dat de mailserver het account weigert/throttlet.
        // De backoff-guard bovenaan de loop wacht het (exponentiële) venster uit,
        // zodat de IDLE-loop de rate-limit niet elke 10s warm poket.
        const until = this.noteConnectFailure(err);
        console.warn(`[mail-idle] ${this.authFailed ? "AUTH-fout (lange backoff, geen retry-lus)" : "IDLE-fout"} #${this.connFailures} voor ${this.key}; backoff ${Math.ceil((until - Date.now()) / 1000)}s: ${(err as Error).message}`);
      }
    }
    } finally {
      this.idleLoopRunning = false;
      this.idleClient = null;
    }
  }

  private broadcastMailEvent(folder: string): void {
    console.log(`[mail-idle] EVENT received for ${this.key} folder=${folder}, listeners=${this.idleListeners.size}`);
    void (async () => {
      try {
        const { broadcast } = await import("./ws-events.ts");
        for (const key of this.idleListeners) {
          const [yAppSid, instStr] = key.split("::");
          const instanceId = parseInt(instStr, 10);
          if (Number.isNaN(instanceId)) continue;
          console.log(`[mail-idle] Broadcasting to yAppSid=${yAppSid.slice(0, 8)}... instance=${instanceId}`);
          broadcast(yAppSid, instanceId, { type: "mail-changed", folder, instance: instanceId });
        }
        // Bij flag-change moet de folder-status cache vers (badge-recount).
        this.foldersTs = 0;
        this.invalidateFolder(folder);
      } catch (err) { console.error(`[mail-idle] broadcast error: ${(err as Error).message}`); }
    })();
  }

  /** Disconnect and clean up */
  /**
   * Sluit de IMAP-socket en stop achtergrond-timers, MAAR behoud de
   * in-memory caches. Bij volgende gebruik via `ensureConnected()` bouwt
   * de connection zich opnieuw op terwijl `folders`/`folderMessages`/
   * `fullMessages` direct cache-hits geven. Pas na `CACHE_LIFETIME` stilte
   * (zie `cacheCleanupTimer`) gooien we ook de in-memory caches weg.
   */
  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.client) {
      this.client.logout().catch(() => {});
      this.client = null;
    }
    this.idleStopRequested = true;
    if (this.idleClient) {
      this.idleClient.logout().catch(() => {});
      this.idleClient = null;
    }
    this.connected = false;
    console.log(`[mail-cache] Disconnected ${this.key} (in-memory caches blijven, ${Math.round(MailAccountCache.CACHE_LIFETIME / 3600000)} u tot full cleanup)`);
    // Schedule eenmalige cache-cleanup. Wordt gecanceld door ensureConnected
    // zodra de gebruiker terugkomt binnen het venster.
    if (!this.cacheCleanupTimer) {
      this.cacheCleanupTimer = setTimeout(() => this.fullCleanup(), MailAccountCache.CACHE_LIFETIME);
    }
  }

  /** Wist alle in-memory caches en verwijdert deze MailAccountCache uit
   * de globale `accountCaches` Map. Alleen aangeroepen vanuit de
   * `cacheCleanupTimer`. Re-check lastActivity zodat reuse die tussendoor
   * gebeurde (bv. terug binnen 23 u) niet alsnog gewist wordt. */
  private fullCleanup() {
    this.cacheCleanupTimer = null;
    if (Date.now() - this.lastActivity < MailAccountCache.CACHE_LIFETIME) return;
    this.folders = [];
    this.foldersTs = 0;
    this.folderMessages.clear();
    this.fullMessages.clear();
    this.attachmentCache.clear();
    accountCaches.delete(this.key);
    console.log(`[mail-cache] Full cleanup ${this.key} na ${Math.round(MailAccountCache.CACHE_LIFETIME / 3600000)} u inactief`);
  }
}

/* ─── Global cache registry ─── */

const accountCaches = new Map<string, MailAccountCache>();

/**
 * Cache key intent — don't "fix" this without reading the rationale.
 *
 * The key is `host:port:user` — the IMAP login identity, NOT the Y-app
 * user identity. Same IMAP login = same mailbox = correctly shared
 * connection. Two Y-app users who access the same shared inbox (e.g.
 * info@company.nl) get the same MailAccountCache, which is what we want:
 * one persistent IMAP connection, one body cache, both Y-app users
 * benefit from each other's prefetches.
 *
 * Edge case (not a leak, just an operational hazard): if two Y-app
 * users somehow have DIFFERENT OAuth2 grants for the same email
 * account, updateCredentials() below will overwrite each other's
 * tokens. In standard ERPNext that doesn't happen because tokens are
 * stored per-Email-Account (global), not per-user — both Y-app users
 * resolve to the same token. If a custom Frappe app stores per-user
 * tokens, the symptom is intermittent re-auth, NOT data leakage. The
 * fix path if that ever becomes real: include the JWT `oid` claim in
 * the key, parsed from creds.accessToken. Don't include erpnextSid —
 * it rotates on every ERPNext re-login and would leak cache entries.
 */
function getAccountCache(creds: MailCredentials): MailAccountCache {
  const key = `${creds.host}:${creds.port}:${creds.user}`;
  let cache = accountCaches.get(key);
  if (!cache) {
    cache = new MailAccountCache(creds);
    accountCaches.set(key, cache);
    console.log(`[mail-cache] Created cache for ${creds.user}@${creds.host} (${creds.authMode || "password"})`);
  } else {
    // Update credentials (e.g. refreshed OAuth2 tokens). The fast-path
    // inside updateCredentials skips the no-op case (same creds in,
    // same creds already there) so the overwrite race only fires when
    // creds genuinely differ.
    cache.updateCredentials(creds);
  }
  return cache;
}

/* ─── Cached resolved credentials per erpnextSid+email ─── */
const resolvedCredsCache = new Map<string, { creds: MailCredentials; ts: number }>();
// In-flight Promises per cacheKey zodat concurrent callers (typisch
// /api/mail/folders en /api/mail/messages die parallel mounten bij Webmail-
// open) dezelfde mailAutoConfigInternal-roundtrip delen i.p.v. allebei
// 4-6 ERPNext-calls + 1 OAuth-refresh sequentieel te doen (~1-1.5 s waste
// per duplicate request).
const resolvedCredsInFlight = new Map<string, Promise<MailCredentials | null>>();
const CREDS_CACHE_TTL = 4 * 60 * 1000; // 4 min (OAuth2 tokens last 5 min)

/** Resolve credentials server-side from erpnextSid+email, with caching */
async function resolveCredentials(erpnextSid: string, email: string): Promise<MailCredentials | null> {
  const cacheKey = `${erpnextSid}:${email}`;
  const cached = resolvedCredsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CREDS_CACHE_TTL) return cached.creds;

  // Coalesce concurrent cache-miss-callers op dezelfde key.
  const inFlight = resolvedCredsInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<MailCredentials | null> => {
    // KRITIEKE FIX (5-agent panel, shared-mailbox bug 2026-05-21):
    // `mailAutoConfigInternal` gooit `Error("Email Account not found in ERPNext")`
    // wanneer ERPNext geen record heeft voor `email_id=info@3bm.co.nl` (typisch
    // bij delegated shared mailboxes — die hebben geen eigen Email Account, alleen
    // FullAccess via Exchange `Add-MailboxPermission`). De throw propageerde tot
    // de route-handler → 500-response, en het hele shared-mailbox-fallback-pad
    // in `getCredentials` werd NOOIT bereikt. Try/catch om de throw vast te
    // pakken zodat de fallback echt kan kicken.
    let data: any;
    try {
      data = await mailAutoConfigInternal(erpnextSid, email);
    } catch (err) {
      console.log(`[resolveCredentials] ${email}: mailAutoConfigInternal threw — ${(err as Error).message}. Returning null so getCredentials kan primaryEmail-fallback proberen.`);
      return null;
    }
    if (!data?.host) {
      console.log(`[resolveCredentials] ${email}: data missing host (data.host=${data?.host}, data.authMode=${data?.authMode}). Returning null.`);
      return null;
    }

    const creds: MailCredentials = {
      host: data.host,
      port: data.port || 993,
      user: data.user || email,
      pass: data.pass || "",
      secure: data.secure !== false,
      authMode: data.authMode || "password",
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      tokenUri: data.tokenUri,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
    };
    console.log(`[resolveCredentials] ${email}: resolved (authMode=${creds.authMode}, hasToken=${!!creds.accessToken}, host=${creds.host}, user=${creds.user})`);
    resolvedCredsCache.set(cacheKey, { creds, ts: Date.now() });
    return creds;
  })();

  resolvedCredsInFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    resolvedCredsInFlight.delete(cacheKey);
  }
}

/** Invalidate the resolved-creds cache for a specific email when an
 * IMAP auth-failure makes the cached token-set worthless. Without this
 * the 4-min TTL would keep replaying the rejected token on every klick. */
export function invalidateResolvedCreds(erpnextSid: string, email: string): void {
  resolvedCredsCache.delete(`${erpnextSid}:${email}`);
}

/* ─── Helpers ─── */

async function getCredentials(req: Request): Promise<MailCredentials | null> {
  const acct = req.query.acct as string | undefined;
  // Highest priority: an explicit Y-app mail-account from the encrypted vault
  // (mail_accounts table). The frontend sends ?account=<id> on every /api/mail/*
  // call whenever the active instance has vault accounts. These are Y-app's OWN
  // credentials (IMAP/SMTP host + password/OAuth, encrypted at rest with the
  // user key) and must win over the ERPNext-derived fallback below — that is the
  // whole point of "manual IMAP" accounts: their creds live in Y-app, not in the
  // ERPNext Email Account doctype. yAppUserId + yAppUserKey are attached by
  // authMiddleware (auth.ts).
  const account = req.query.account as string | undefined;
  const yAppUserId = (req as any).yAppUserId as number | undefined;
  const userKey = (req as any).yAppUserKey as Buffer | undefined;
  if (account && yAppUserId && userKey) {
    const dec = await getDecryptedMailCredentials(account, yAppUserId, userKey);
    if (dec) {
      return {
        host: dec.imapHost,
        port: dec.imapPort,
        user: acct || dec.username,
        pass: dec.password || "",
        secure: dec.imapSecure,
        authMode: dec.accessToken ? "oauth2" : "password",
        accessToken: dec.accessToken,
        refreshToken: dec.refreshToken,
        clientId: dec.clientId,
        clientSecret: dec.clientSecret,
        tokenUri: dec.tokenUri,
        smtpHost: dec.smtpHost,
        smtpPort: dec.smtpPort,
        smtpSecure: dec.smtpSecure,
      };
    }
  }

  // Preferred path: creds were pushed once via POST /api/mail/config and
  // now live in the server-side mail-session cache keyed on the Y-app
  // session cookie + instance id. Reading from memory means `pass=…` and
  // OAuth tokens never appear in `/api/mail/*` URLs again.
  const yAppSid = (req as any).cookies?.y_app_session;
  const instanceId = (req as any).instanceId as number | undefined;
  if (yAppSid) {
    const cached = getMailSession(String(yAppSid), instanceId, acct);
    if (cached) return cached;
  }

  // Backward-compat path: older frontend builds (and any remaining GET
  // endpoints that haven't migrated yet) still forward creds in the
  // query string. Accept them, but the new frontend should no longer
  // hit this branch in steady state.
  const host = req.query.host as string;
  const port = parseInt(req.query.port as string || "993", 10);
  const user = req.query.user as string;
  const pass = req.query.pass as string || "";
  const secure = req.query.secure !== "false";
  const authMode = (req.query.authMode as string) || "password";

  if (authMode === "oauth2" && host && user) {
    return {
      host, port, user, pass, secure,
      authMode: "oauth2",
      accessToken: req.query.accessToken as string,
      refreshToken: req.query.refreshToken as string,
      clientId: req.query.clientId as string,
      clientSecret: req.query.clientSecret as string,
      tokenUri: req.query.tokenUri as string,
    };
  }

  if (host && user && pass) return { host, port, user, pass, secure };

  // Fallback: look up the user's Email Account in ERPNext by email_id.
  const erpnextSid = (req as any).erpnextSid as string;
  const email = req.query.email as string;
  if (erpnextSid && email) {
    // Shared mailbox: de frontend stuurt `primaryEmail` (≠ email) mee. Verbind
    // dan via het PRIMARY-account z'n gedelegeerde token met user=shared. Reden:
    // een gedeelde O365-mailbox kan een eigen ERPNext Email Account hebben met
    // een token dat géén IMAP-sessie kan openen (unlicensed shared mailbox →
    // O365 sluit de verbinding direct, "Unexpected close"). Delegatie via de
    // primary (die FullAccess heeft, bewezen door de test-connectie) werkt wél.
    // Daarom delegatie VÓÓR de directe resolve van het (mogelijk kapotte) eigen
    // account proberen. Voor niet-shared requests (geen primaryEmail) blijft het
    // pad ongewijzigd: directe resolve.
    const primaryEmail = req.query.primaryEmail as string | undefined;
    if (primaryEmail && primaryEmail !== email) {
      const primary = await resolveCredentials(erpnextSid, primaryEmail);
      if (primary) {
        console.log(`[getCredentials] shared delegation: primary=${primaryEmail} → user=${email} (authMode=${primary.authMode}, hasToken=${!!primary.accessToken})`);
        return { ...primary, user: email };
      }
      console.log(`[getCredentials] shared: primaryEmail ${primaryEmail} resolve failed, val terug op directe ${email}`);
    }
    const direct = await resolveCredentials(erpnextSid, email);
    if (direct) {
      console.log(`[getCredentials] resolved direct for ${email} (authMode=${direct.authMode}, hasToken=${!!direct.accessToken})`);
      return direct;
    }
    console.log(`[getCredentials] direct resolve failed for ${email} (primaryEmail=${req.query.primaryEmail})`);
  }

  return null;
}

function getCredentialsFromBody(body: Record<string, unknown>): MailCredentials | null {
  const host = body.host as string;
  const port = parseInt(String(body.port || "993"), 10);
  const user = body.user as string;
  const pass = (body.pass as string) || "";
  const secure = body.secure !== false;
  const authMode = (body.authMode as string) || "password";

  if (authMode === "oauth2") {
    if (!host || !user) return null;
    return {
      host, port, user, pass, secure,
      authMode: "oauth2",
      accessToken: body.accessToken as string,
      refreshToken: body.refreshToken as string,
      clientId: body.clientId as string,
      clientSecret: body.clientSecret as string,
      tokenUri: body.tokenUri as string,
      smtpHost: body.smtpHost as string,
      smtpPort: body.smtpPort ? parseInt(String(body.smtpPort), 10) : undefined,
      smtpSecure: body.smtpSecure as boolean | undefined,
    };
  }

  if (!host || !user || !pass) return null;
  return { host, port, user, pass, secure };
}

/** One-off connection for test only */
async function withClient<T>(
  creds: MailCredentials,
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  const authConfig = creds.authMode === "oauth2"
    ? { user: creds.user, accessToken: creds.accessToken! }
    : { user: creds.user, pass: creds.pass };

  const client = new ImapFlow({
    host: creds.host, port: creds.port, secure: creds.secure,
    auth: authConfig, logger: false,
    tls: creds.secure ? { servername: creds.host, minVersion: "TLSv1.2" } : undefined,
  });
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Via de per-host connect-gate (zelfde burst-preventie als ensureConnected):
    // de "Test verbinding"-knop / auto-config mag niet samen met live reconnects
    // een piek naar dezelfde host vormen.
    await imapConnectGate.run(creds.host, () => Promise.race([
      client.connect(),
      new Promise<never>((_, reject) => {
        connectTimer = setTimeout(
          () => reject(new Error(
            `IMAP verbinding timeout na 30s voor ${creds.user}@${creds.host}:${creds.port}. ` +
            `Mogelijke oorzaken: firewall blokkeert poort ${creds.port}, ` +
            `mailserver afgesloten, of voor Office 365: basic-auth IMAP staat uit (gebruik OAuth2).`,
          )),
          30_000,
        );
      }),
    ]));
    imapConnLimiter.track(creds.host, client);
    recordMailAttempt(creds.host, true);
  } catch (err) {
    recordMailAttempt(creds.host, false);
    throw err;
  } finally {
    // Clear the timer whether connect resolved or rejected — otherwise
    // every successful connect leaks a 15s pending timer with a closure
    // over `creds` and the reject fn. Under load that adds up fast.
    if (connectTimer) clearTimeout(connectTimer);
  }
  try { return await fn(client); }
  finally { await client.logout().catch(() => {}); }
}

/* ─── API Handlers ─── */

/** Read-only snapshot of recent IMAP attempts per upstream host. Does NOT
 * trigger any new IMAP traffic, so it's safe to poll while debugging a
 * suspected fail2ban / outage. */
export function mailUpstreamHealth(_req: Request, res: Response) {
  res.json({ ok: true, hosts: mailUpstreamStats() });
}

/** Test a mail connection using already-decrypted credentials from the
 * server-side vault (mail-accounts.ts). Used by
 * POST /api/instances/:id/mail-accounts/:accountId/test so the password
 * never has to leave the server process. Returns the same shape as the
 * frontend-facing mailTestConnection. */
export async function testMailConnectionFromCreds(
  creds: MailCredentials,
): Promise<{ ok: boolean; message: string }> {
  try {
    await withClient(creds, async (client) => {
      await client.list();
    });
    return { ok: true, message: `Connected as ${creds.user}` };
  } catch (err) {
    const { message } = sanitizeMailError(err);
    return { ok: false, message };
  }
}

/** Cache the IMAP credentials for the current Y-app session so every
 * subsequent /api/mail/* call can read them from memory instead of
 * receiving `pass` / `accessToken` in its URL. Idempotent — frontend
 * calls this on mount and whenever the user changes the config. */
export function mailSetConfig(req: Request, res: Response) {
  const yAppSid = (req as any).cookies?.y_app_session;
  if (!yAppSid) return res.status(401).json({ ok: false, error: "No session" });
  const creds = getCredentialsFromBody(req.body || {});
  if (!creds) return res.status(400).json({ ok: false, error: "Incomplete credentials" });
  const instanceId = (req as any).instanceId as number | undefined;
  const acct = (req.body?.acct as string) || undefined;
  setMailSession(String(yAppSid), instanceId, creds, acct);
  res.json({ ok: true });
}

/** Drop the cached creds for the current Y-app session. Called on logout
 * or when the user opens the setup form to re-enter credentials. */
export function mailClearConfig(req: Request, res: Response) {
  const yAppSid = (req as any).cookies?.y_app_session;
  if (!yAppSid) return res.status(401).json({ ok: false, error: "No session" });
  const instanceId = (req as any).instanceId as number | undefined;
  const acct = req.query.acct as string || (req.body?.acct as string) || undefined;
  clearMailSession(String(yAppSid), instanceId, acct);
  res.json({ ok: true });
}

/** Test connection — credentials come from the POST body so the IMAP
 * password never lands in nginx access logs or browser history. */
export async function mailTestConnection(req: Request, res: Response) {
  const creds = getCredentialsFromBody(req.body || {});
  if (!creds) return res.status(400).json({ error: "Missing host, user, or pass" });

  try {
    await withClient(creds, async () => {});
    getAccountCache(creds);
    res.json({ ok: true, message: `Verbonden als ${creds.user}` });
  } catch (err) {
    sendMailError(res, err, `Test connection failed for ${creds.user}@${creds.host}:${creds.port}`, { authStatus: 401 });
  }
}

/** Test connection to a shared/delegate mailbox. Uses the primary account's
 * OAuth2 tokens but connects with the shared mailbox email as IMAP user.
 *
 * Exchange/O365 shared mailbox access via IMAP + OAuth2 has two patterns:
 * 1. Direct: user=shared@domain, token=primary's token (works if token has
 *    scope for the shared mailbox — e.g. service principal or full-access grant)
 * 2. Backslash: user=primary@domain\shared@domain, token=primary's token
 *    (the traditional Exchange "open other user's mailbox" IMAP syntax)
 *
 * We try both in order and report which succeeded, so the frontend can store
 * the effective user string for subsequent API calls. */
export async function mailTestShared(req: Request, res: Response) {
  const email = req.body?.email as string;
  if (!email) return res.status(400).json({ ok: false, error: "Missing email" });

  const yAppSid = (req as any).cookies?.y_app_session;
  const instanceId = (req as any).instanceId as number | undefined;
  if (!yAppSid) return res.status(401).json({ ok: false, error: "No session" });

  // Get primary account credentials. Probeer eerst de cached session, daarna
  // de ERPNext-fallback met de primary email die de frontend meestuurt (de
  // gebruiker is op zijn eigen Webmail-pagina dus weet welk primary account
  // actief is). Zonder primaryEmail in body slaagt de fallback nooit voor
  // een POST request, want req.query.email is dan leeg.
  let primary = await getCredentials(req);
  if (!primary) {
    const primaryEmail = req.body?.primaryEmail as string | undefined;
    const erpnextSid = (req as any).erpnextSid as string | undefined;
    if (erpnextSid && primaryEmail) {
      primary = await resolveCredentials(erpnextSid, primaryEmail);
    }
  }
  if (!primary) return res.status(400).json({ ok: false, error: "Primary mail account not configured (send `primaryEmail` in body)" });

  // Try multiple access patterns in order
  const attempts: Array<{ label: string; user: string }> = [
    // Pattern 1: direct user substitution
    { label: "direct", user: email },
    // Pattern 2: backslash syntax (Exchange-specific)
    { label: "backslash", user: `${primary.user}\\${email}` },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    const sharedCreds: MailCredentials = { ...primary, user: attempt.user };
    try {
      await withClient(sharedCreds, async () => {});
      console.log(`[mail] Shared mailbox ${email} accessible via ${attempt.label} (user=${attempt.user})`);
      res.json({ ok: true, message: `Verbonden met ${email}`, method: attempt.label, effectiveUser: attempt.user });
      return;
    } catch (err) {
      const msg = (err as Error)?.message || String(err);
      console.log(`[mail] Shared mailbox ${email} via ${attempt.label} failed: ${msg}`);
      errors.push(`${attempt.label}: ${msg}`);
    }
  }

  // All attempts failed
  res.status(401).json({
    ok: false,
    error: "Geen toegang tot dit postvak. Controleer je delegate-rechten in Exchange.",
    detail: errors.join("; "),
  });
}

/** List mailbox folders — served from cache */
export async function mailListFolders(req: Request, res: Response) {
  try {
    const creds = await getCredentials(req);
    if (!creds) return res.status(400).json({ error: "Missing credentials" });

    const cache = getAccountCache(creds);
    // Registreer deze sessie zodat IDLE-events richting de browser-WS gepushed
    // worden. Idempotent; eerste registratie start de IDLE-loop.
    const yAppSid = (req as any).cookies?.y_app_session;
    const instanceId = (req as any).instanceId as number | undefined;
    if (yAppSid) cache.registerIdleListener(String(yAppSid), instanceId);
    const folders = await cache.fetchFolders();
    // `satisfies` bindt deze respons aan het gedeelde wire-contract dat de
    // desktop-adapter (fetch.ts) en Rust FolderInfo ook volgen — drift faalt
    // hier compile-time i.p.v. stil op desktop.
    res.json({ data: folders } satisfies MailFoldersResponse);
    // Pas NA response: trigger warmup op achtergrond zodat folder-switches +
    // mail-opens daarna instant zijn. Defer 5 s zodat parallel-binnenkomende
    // /messages-call ook al klaar is voordat warmup IMAP-lock pakt.
    scheduleWarmupAfterFirstFetch(cache);
  } catch (err) {
    sendMailError(res, err, "listFolders", { req });
  }
}

/** List messages — served from cache */
export async function mailListMessages(req: Request, res: Response) {
  try {
    const creds = await getCredentials(req);
    if (!creds) return res.status(400).json({ error: "Missing credentials" });

    const folder = (req.query.folder as string) || "INBOX";
    const page = parseInt(req.query.page as string || "1", 10);
    const pageSize = parseInt(req.query.pageSize as string || "50", 10);
    const sinceDays = req.query.sinceDays ? parseInt(req.query.sinceDays as string, 10) : undefined;
    // bg=1 marks the all-folders background warmup: it enqueues at lower IMAP
    // priority so an interactive folder-switch or mail-open jumps ahead of it.
    const background = req.query.bg === "1";

    const cache = getAccountCache(creds);
    const yAppSid = (req as any).cookies?.y_app_session;
    const instanceId = (req as any).instanceId as number | undefined;
    if (yAppSid) cache.registerIdleListener(String(yAppSid), instanceId);
    const result = await cache.fetchMessages(folder, false, page, pageSize, sinceDays, background);
    res.json({ data: { ...result, page, pageSize } });
  } catch (err) {
    sendMailError(res, err, "listMessages", { req });
  }
}

/** Get single message with body — served from cache */
export async function mailGetMessage(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  const folder = (req.query.folder as string) || "INBOX";
  const uid = parseInt(req.query.uid as string || "0", 10);
  if (!uid) return res.status(400).json({ error: "Missing uid" });

  try {
    const cache = getAccountCache(creds);
    const result = await cache.fetchFullMessage(folder, uid);
    res.json({ data: result });
  } catch (err) {
    sendMailError(res, err, "getMessage", { req });
  }
}

/**
 * Bulk-bodies voor de lokale body-cache pre-fill. PEEK (markeert NIETS als
 * gelezen). `uids` is een komma-lijst; max 200 per call. bg=1 → lage prio.
 */
export async function mailGetBodies(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  const folder = (req.query.folder as string) || "INBOX";
  const uids = ((req.query.uids as string) || "")
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n))
    .slice(0, 200);
  if (uids.length === 0) return res.json({ data: [] });
  const background = req.query.bg === "1";

  try {
    const cache = getAccountCache(creds);
    const bodies = await cache.fetchBodiesBatch(folder, uids, background);
    res.json({ data: bodies });
  } catch (err) {
    sendMailError(res, err, "getBodies", { req });
  }
}

/** Refresh OAuth2 access token for SMTP if expired or expiring within 5 min.
 *  Mirrors MailAccountCache.ensureTokenFresh but works on a plain creds object
 *  because the send-flow doesn't always go through the IMAP cache. */
async function refreshSmtpTokenIfNeeded(smtp: {
  authMode?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUri?: string;
}): Promise<void> {
  if (smtp.authMode !== "oauth2" || !smtp.accessToken) return;

  let needsRefresh = false;
  try {
    const parts = smtp.accessToken.split(".");
    if (parts.length < 2) {
      needsRefresh = true;
    } else {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      const exp = payload.exp as number;
      if (!exp) {
        needsRefresh = true;
      } else {
        const nowSec = Math.floor(Date.now() / 1000);
        if (exp - nowSec > 300) return;
        needsRefresh = true;
      }
    }
  } catch {
    needsRefresh = true;
  }

  if (!needsRefresh) return;

  const { tokenUri, clientId, clientSecret, refreshToken } = smtp;
  if (!tokenUri || !clientId || !clientSecret || !refreshToken) {
    console.warn("[mail-send] Cannot refresh SMTP OAuth2 token — missing refresh credentials");
    return;
  }

  try {
    const resp = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        scope: "https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send offline_access",
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.error(`[mail-send] SMTP token refresh failed (${resp.status}):`, txt.slice(0, 200));
      return;
    }
    const data = await resp.json();
    if (data.access_token) {
      smtp.accessToken = data.access_token;
      console.log("[mail-send] SMTP OAuth2 token refreshed");
    }
    if (data.refresh_token) {
      smtp.refreshToken = data.refresh_token;
    }
  } catch (err) {
    console.error("[mail-send] SMTP token refresh error:", (err as Error).message);
  }
}



/** Send an email via SMTP */
export async function mailSend(req: Request, res: Response) {
  const erpnextSid = (req as any).erpnextSid as string;
  const { smtp: smtpInput, imap: imapInput, email,
    from, to, cc, bcc, subject, html, text, inReplyTo, references, attachments: rawAttachments,
    sentFolder: sentFolderOverride, icalEvent: icalEventInput } = req.body as {
    smtp?: { host: string; port: number; user: string; pass: string; secure: boolean; authMode?: string; accessToken?: string; refreshToken?: string; clientId?: string; clientSecret?: string; tokenUri?: string };
    imap?: { host: string; port: number; user: string; pass: string; secure: boolean; authMode?: string; accessToken?: string; refreshToken?: string; clientId?: string; clientSecret?: string; tokenUri?: string };
    email?: string;
    from: string; to: string[]; cc?: string[]; bcc?: string[];
    subject: string; html?: string; text?: string;
    inReplyTo?: string; references?: string;
    attachments?: { filename: string; content: string; contentType: string }[];
    sentFolder?: string; // optionele expliciete Verzonden-map (override van auto-detectie)
    // iMIP-uitnodiging (text/calendar; method=REQUEST/CANCEL). De .ics wordt
    // server-side gebouwd (ical-build) en hier als calendar-alternative meegestuurd
    // zodat Outlook/Gmail/Apple Mail accepteren/weigeren tonen.
    icalEvent?: { method: string; content: string; filename?: string };
  };

  if (!to || to.length === 0) return res.status(400).json({ error: "Missing recipients" });

  // Resolve credentials: try session cache first (supports shared mailboxes),
  // then fall back to ERPNext Email Account lookup.
  let smtp = smtpInput;
  let imap = imapInput;
  const acct = req.body?.acct as string | undefined;
  // Vault-account (eigen IMAP-login): de frontend stuurt `account=<id>` in de
  // body zodra er vault-accounts zijn. Decrypt en gebruik dié creds voor SMTP
  // én IMAP-append, vóór de mailSession/ERPNext-fallback — zo verstuurt dit
  // account met z'n eigen wachtwoord (juiste From + auth). yAppUserId/userKey
  // staan op de request via authMiddleware.
  const accountId = (req.body?.account as string) || (req.query.account as string) || undefined;
  const yAppUserId = (req as any).yAppUserId as number | undefined;
  const userKey = (req as any).yAppUserKey as Buffer | undefined;
  if (!smtp && accountId && yAppUserId && userKey) {
    const dec = await getDecryptedMailCredentials(accountId, yAppUserId, userKey);
    if (dec) {
      smtp = {
        host: dec.smtpHost || dec.imapHost,
        port: dec.smtpPort || 587,
        user: acct || dec.username,
        pass: dec.password || "",
        secure: dec.smtpSecure ?? false,
        authMode: dec.accessToken ? "oauth2" : "password",
        accessToken: dec.accessToken,
        refreshToken: dec.refreshToken,
        clientId: dec.clientId,
        clientSecret: dec.clientSecret,
        tokenUri: dec.tokenUri,
      };
      if (!imap) {
        imap = {
          host: dec.imapHost, port: dec.imapPort,
          user: acct || dec.username, pass: dec.password || "", secure: dec.imapSecure,
          authMode: dec.accessToken ? "oauth2" : "password",
          accessToken: dec.accessToken, refreshToken: dec.refreshToken,
          clientId: dec.clientId, clientSecret: dec.clientSecret, tokenUri: dec.tokenUri,
        };
      }
    }
  }
  if (!smtp) {
    const yAppSid = (req as any).cookies?.y_app_session;
    const instanceId = (req as any).instanceId as number | undefined;
    if (yAppSid) {
      const cached = getMailSession(String(yAppSid), instanceId, acct);
      if (cached) {
        // For shared mailboxes on OAuth2 (Exchange), SMTP AUTH must use the
        // delegate's identity — the OAuth token is scoped to that user, not
        // the shared mailbox. Pull primary session creds for AUTH; shared
        // mailbox address goes only in the From header below.
        const primary = acct ? getMailSession(String(yAppSid), instanceId, undefined) : null;
        const smtpAuthSrc = (acct && primary && primary.authMode === "oauth2") ? primary : cached;
        smtp = {
          host: cached.smtpHost || cached.host,
          port: cached.smtpPort || 587,
          user: smtpAuthSrc.user, pass: smtpAuthSrc.pass,
          secure: cached.smtpSecure ?? false,
          authMode: smtpAuthSrc.authMode,
          accessToken: smtpAuthSrc.accessToken,
          refreshToken: smtpAuthSrc.refreshToken,
          clientId: smtpAuthSrc.clientId,
          clientSecret: smtpAuthSrc.clientSecret,
          tokenUri: smtpAuthSrc.tokenUri,
        };
        if (!imap) {
          imap = {
            host: cached.host, port: cached.port,
            user: cached.user, pass: cached.pass, secure: cached.secure,
            authMode: cached.authMode, accessToken: cached.accessToken,
            refreshToken: cached.refreshToken, clientId: cached.clientId,
            clientSecret: cached.clientSecret, tokenUri: cached.tokenUri,
          };
        }
      }
    }
  }
  if (!smtp && erpnextSid && email) {
    try {
      const resolved = await resolveCredentials(erpnextSid, email);
      if (resolved) {
        smtp = {
          host: resolved.smtpHost || resolved.host,
          port: resolved.smtpPort || 587,
          user: resolved.user, pass: resolved.pass,
          secure: resolved.smtpSecure ?? false,
          authMode: resolved.authMode,
          accessToken: resolved.accessToken,
          refreshToken: resolved.refreshToken,
          clientId: resolved.clientId,
          clientSecret: resolved.clientSecret,
          tokenUri: resolved.tokenUri,
        };
        imap = {
          host: resolved.host, port: resolved.port,
          user: resolved.user, pass: resolved.pass, secure: resolved.secure,
          authMode: resolved.authMode, accessToken: resolved.accessToken,
          refreshToken: resolved.refreshToken, clientId: resolved.clientId,
          clientSecret: resolved.clientSecret, tokenUri: resolved.tokenUri,
        };
      }
    } catch { /* fallthrough */ }
  }

  if (!smtp?.host || !smtp?.user) return res.status(400).json({ error: "Missing SMTP credentials" });
  if (smtp.authMode !== "oauth2" && !smtp.pass) return res.status(400).json({ error: "Missing SMTP password" });

  try {
    if (smtp.authMode === "oauth2") {
      await refreshSmtpTokenIfNeeded(smtp);
    }

    const smtpAuth = smtp.authMode === "oauth2"
      ? { type: "OAuth2" as const, user: smtp.user, accessToken: smtp.accessToken! }
      : { user: smtp.user, pass: smtp.pass };

    const transport = createTransport({
      host: smtp.host, port: smtp.port || 587,
      secure: smtp.authMode === "oauth2" ? false : (smtp.secure ?? (smtp.port === 465)),
      auth: smtpAuth,
    } as any);

    const mailAttachments = rawAttachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, "base64"),
      contentType: a.contentType,
    }));

    const mailOptions = {
      // When sending from a shared mailbox, the From header MUST be the shared
      // mailbox address, not the delegate used for SMTP AUTH. Prefer explicit
      // from, then acct (shared), then fall back to the auth user.
      from: from || acct || smtp.user, to: to.join(", "),
      cc: cc?.join(", "), bcc: bcc?.join(", "),
      subject, html, text, inReplyTo, references,
      attachments: mailAttachments,
      // iMIP: nodemailer bouwt hiervan een multipart/alternative met
      // text/calendar; method=… zodat het een echte agenda-uitnodiging is.
      ...(icalEventInput?.content
        ? { icalEvent: { method: icalEventInput.method, filename: icalEventInput.filename || "invite.ics", content: icalEventInput.content } }
        : {}),
    };

    let messageId: string | undefined;
    let viaRelay = false;
    try {
      const info = await transport.sendMail(mailOptions);
      messageId = info.messageId;
    } catch (sendErr) {
      // Direct SMTP submission can be blocked at the network layer when the
      // mail host refuses this server's IP (e.g. a plain-IMAP host that only
      // whitelists office IPs). IMAP from the same host still works, so we
      // relay the send through ERPNext — it delivers from its own, accepted
      // IP — and keep the local Sent-folder APPEND below. Only connection-class
      // failures fall back; auth/recipient errors are real and are re-thrown.
      if (erpnextSid && isSmtpConnectionError(sendErr)) {
        // IDENTITEIT-GUARD (bug: reply verstuurd vanaf verkeerd From-adres).
        // De relay via `communication.email.make` resolvet het outgoing Email
        // Account op `email_id`. Heeft ERPNext GEEN enable_outgoing-account voor
        // deze afzender, dan valt Frappe stil terug op het DEFAULT outgoing
        // account en herschrijft het From naar dát adres (bv. cooperatie@…).
        // Zo werd een reply vanaf piet@… als cooperatie@… verstuurd. Daarom:
        // alleen relayen als het From BEWEZEN behouden blijft — een positief
        // bevestigd matchend outgoing account. Geen match óf lookup-fout
        // (null) → NIET relayen; gooi de originele connectie-fout door zodat
        // de gebruiker het ziet. Een mail onder de verkeerde identiteit is
        // erger dan een mail die (tijdelijk) niet verstuurd kan worden.
        const fromAddr = from || acct || smtp.user;
        const senderEmail = extractEmailAddress(fromAddr);
        const outgoingMatch = await hasMatchingOutgoingAccount(erpnextSid, senderEmail);
        if (outgoingMatch !== true) {
          console.warn(
            `[mail-send] direct SMTP failed (${(sendErr as { code?: string }).code}) — ` +
            (outgoingMatch === false
              ? `GEEN outgoing Email Account voor ${senderEmail}; relay zou het From herschrijven naar het default account. `
              : `outgoing-account check voor ${senderEmail} niet uitvoerbaar; From-behoud niet te garanderen. `) +
            `Verzenden geweigerd.`,
          );
          throw sendErr;
        }
        console.warn(
          `[mail-send] direct SMTP failed (${(sendErr as { code?: string }).code}) — ` +
          `relaying via ERPNext as ${senderEmail}`,
        );
        // Attachments must be uploaded to ERPNext as File docs first; their
        // names are passed to communication.email.make. A failed upload throws
        // and surfaces as a normal send error (no silently-dropped attachment).
        const fileNames: string[] = [];
        for (const a of rawAttachments ?? []) {
          fileNames.push(
            await uploadPrivateFile(erpnextSid, a.filename, Buffer.from(a.content, "base64"), a.contentType),
          );
        }
        await erpnextSendEmail(erpnextSid, {
          sender: senderEmail,
          senderFullName: extractDisplayName(fromAddr),
          recipients: to.join(", "),
          cc: cc?.join(", "),
          bcc: bcc?.join(", "),
          subject,
          content: html || text || "",
          attachments: fileNames,
        });
        viaRelay = true;
      } else {
        throw sendErr;
      }
    }

    // Save to Sent folder via IMAP APPEND. Runs for both the direct-SMTP and
    // ERPNext-relay paths so de gebruiker zijn verzonden mail in Webmail ziet,
    // en de lokaal gebouwde MIME houdt correcte threading-headers
    // (In-Reply-To/References) ook als de ERPNext-relay die dropt.
    //
    // We AWAITEN de append (niet meer fire-and-forget) zodat de respons
    // `sentSaved` + de gebruikte `sentFolder` kan terugmelden: bij een fout
    // toont de UI een waarschuwing i.p.v. stil te falen, en `sentFolder`
    // onthult een verkeerd-gekozen map (bv. een \Sent-"Sent" naast de
    // "Verzonden items" die de gebruiker bekijkt → te corrigeren met de
    // Verzonden-map-instelling die als `sentFolderOverride` meekomt).
    let sentSaved: boolean | null = null; // null = niet geprobeerd (geen IMAP-creds)
    let sentFolderPath: string | null = null;
    if (imap?.host && imap?.user && (imap?.pass || imap?.authMode === "oauth2")) {
      try {
        const imapCreds: MailCredentials = {
          host: imap.host, port: imap.port || 993,
          user: imap.user, pass: imap.pass || "", secure: imap.secure ?? true,
          ...(imap.authMode === "oauth2" ? {
            authMode: "oauth2" as const,
            accessToken: imap.accessToken,
            refreshToken: imap.refreshToken,
            clientId: imap.clientId,
            clientSecret: imap.clientSecret,
            tokenUri: imap.tokenUri,
          } : {}),
        };
        const cache = getAccountCache(imapCreds);

        // Build raw MIME message using streamTransport
        const rawTransport = createTransport({ streamTransport: true } as any);
        const rawResult = await rawTransport.sendMail(mailOptions);
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          (rawResult as any).message.on("data", (chunk: Buffer) => chunks.push(chunk));
          (rawResult as any).message.on("end", () => resolve());
          (rawResult as any).message.on("error", reject);
        });
        const rawMessage = Buffer.concat(chunks);

        const folders = await cache.fetchFolders();
        const sentFolder = resolveSentFolder(folders, sentFolderOverride);

        if (sentFolder) {
          sentFolderPath = sentFolder.path;
          await cache.appendMessage(sentFolder.path, rawMessage, ["\\Seen"]);
          sentSaved = true;
          console.log(`[mail] Saved sent message to ${sentFolder.path}`);
        } else {
          sentSaved = false;
          console.warn(`[mail] No Sent folder found among ${folders.length} folders (override=${sentFolderOverride || "-"}): ${folders.map(f => `${f.path}${f.specialUse ? `[${f.specialUse}]` : ""}`).join(", ")}`);
        }
      } catch (err) {
        sentSaved = false;
        console.warn("[mail] Failed to save to Sent:", (err as Error).message);
      }
    }

    res.json({ ok: true, messageId, viaRelay, sentSaved, sentFolder: sentFolderPath });
  } catch (err) {
    sendMailError(res, err, "send");
  }
}

const TRASH_FOLDER_NAMES = new Set(["trash", "deleted items", "prullenbak", "verwijderde items"]);

/**
 * Resolve the account's Trash folder.
 *   1. expliciete override (gebruiker koos zijn Verwijderde-map) als die bestaat;
 *   2. RFC 6154 SPECIAL-USE `\Trash`;
 *   3. naam-match op de leaf.
 * Spiegelt resolveSentFolder — load-bearing voor servers met meerdere Trash-achtige
 * mappen (bv. "Deleted Items" + "Verwijderde items" na een mailserver-migratie).
 */
function resolveTrashFolder(folders: CachedFolder[], override?: string): CachedFolder | null {
  if (override) {
    const exact = folders.find(f => f.path === override);
    if (exact) return exact;
    // Stale/onbekende override → val terug op auto-detectie.
  }
  const byFlag = folders.find(f => f.specialUse === "\\Trash");
  if (byFlag) return byFlag;
  return folders.find(f => {
    const leaf = f.path.split(f.delimiter || "/").pop() || f.path;
    return TRASH_FOLDER_NAMES.has(leaf.toLowerCase());
  }) ?? null;
}

/** Delete a message — Outlook-style: move to Trash, or permanent delete if already in Trash. */
export async function mailDeleteMessage(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  const folder = (req.query.folder as string) || "INBOX";
  const uid = parseInt(req.query.uid as string || "0", 10);
  if (!uid) return res.status(400).json({ error: "Missing uid" });

  const cache = getAccountCache(creds);
  const folders = await cache.fetchFolders();
  const trashOverride = (req.query.trashFolder as string) || undefined;
  const trash = resolveTrashFolder(folders, trashOverride);
  const inTrash = !!trash && folder.toLowerCase() === trash.path.toLowerCase();
  const action: "moved" | "deleted" = (!trash || inTrash) ? "deleted" : "moved";

  // Optimistic: remove from source cache so frontend sees it gone
  cache.removeCachedMessage(folder, uid);
  res.json({
    ok: true,
    action,
    trashPath: trash?.path ?? null,
    ...(trash ? {} : { warning: "no_trash_folder" }),
  });

  if (action === "deleted") {
    cache.deleteMessage(folder, uid).catch(err => {
      console.error(`[mail] Background delete failed for uid ${uid}:`, (err as Error).message);
    });
  } else {
    cache.moveMessage(folder, uid, trash!.path).catch(err => {
      console.error(`[mail] Background move-to-trash failed for uid ${uid}:`, (err as Error).message);
    });
  }
}

/**
 * Warm up cache — call from frontend on app init.
 * Accepts POST with credentials in body (more secure than query params).
 * Falls back to GET with query params for compatibility.
 *
 * This does:
 * 1. Connect to IMAP (persistent connection)
 * 2. Fetch folder list
 * 3. Fetch INBOX message list
 * 4. Preload ALL INBOX message bodies (excl. attachments) in background
 */
export async function mailWarmup(req: Request, res: Response) {
  const creds = req.method === "POST"
    ? getCredentialsFromBody(req.body)
    : await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  try {
    const cache = getAccountCache(creds);

    // Fire and forget: load folders + INBOX + preload all bodies
    (async () => {
      try {
        await cache.fetchFolders(true);
        const result = await cache.fetchMessages("INBOX", true);
        console.log(`[mail-cache] Warmup: ${result.messages.length} messages in INBOX, starting body preload...`);
        await cache.preloadBodies("INBOX", result.messages);
      } catch (err) {
        console.error(`[mail-cache] Warmup error:`, (err as Error).message);
      }
    })();

    res.json({ ok: true, message: "Cache warming started — all bodies will be preloaded" });
  } catch (err) {
    sendMailError(res, err, "warmup");
  }
}

/** Download a specific attachment from a message */
export async function mailGetAttachment(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  const folder = (req.query.folder as string) || "INBOX";
  const uid = parseInt(req.query.uid as string || "0", 10);
  const attachIdx = parseInt(req.query.index as string || "0", 10);
  if (!uid) return res.status(400).json({ error: "Missing uid" });

  try {
    const cache = getAccountCache(creds);
    const result = await cache.fetchAttachment(folder, uid, attachIdx);
    if (!result) return res.status(404).json({ error: "Attachment not found" });

    res.set("Content-Type", result.contentType);
    // Use 'attachment' disposition to enable browser downloads; 'inline' for preview-friendly types
    const previewable = result.contentType.startsWith("image/") || result.contentType === "application/pdf" || result.contentType.startsWith("text/");
    const disposition = previewable ? "inline" : "attachment";
    res.set("Content-Disposition", `${disposition}; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.content);
  } catch (err) {
    sendMailError(res, err, "getAttachment");
  }
}

/** Create a new mailbox folder */
export async function mailCreateFolder(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  const folderName = req.query.name as string;
  if (!folderName) return res.status(400).json({ error: "Missing folder name" });

  try {
    const cache = getAccountCache(creds);
    await cache.createFolder(folderName);
    res.json({ ok: true });
  } catch (err) {
    sendMailError(res, err, "createFolder");
  }
}

/** Delete a mailbox folder. Beschermt INBOX en system-mappen (specialUse). */
export async function mailDeleteFolder(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  const path = (req.query.path as string) || (req.body?.path as string);
  if (!path) return res.status(400).json({ error: "Missing folder path" });
  if (path === "INBOX") return res.status(400).json({ error: "Cannot delete INBOX" });

  try {
    const cache = getAccountCache(creds);
    // Server-side guard: weiger system-mappen (Sent/Trash/Drafts/Junk/Archive)
    // ook al filtert de UI ze al weg.
    const folders = await cache.getAllFolderPaths();
    const target = folders.find(f => f.path === path);
    if (target?.specialUse && ["\\Sent", "\\Trash", "\\Drafts", "\\Junk", "\\Archive", "\\Inbox"].includes(target.specialUse)) {
      return res.status(400).json({ error: "Cannot delete a system folder" });
    }
    await cache.deleteFolder(path);
    res.json({ ok: true });
  } catch (err) {
    sendMailError(res, err, `deleteFolder "${path}"`);
  }
}

/** Move a message to another folder */
export async function mailMoveMessage(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  const fromFolder = (req.query.folder as string) || "INBOX";
  const uid = parseInt(req.query.uid as string || "0", 10);
  const toFolder = req.query.toFolder as string;
  if (!uid) return res.status(400).json({ error: "Missing uid" });
  if (!toFolder) return res.status(400).json({ error: "Missing toFolder" });

  // Respond immediately — move in background
  const cache = getAccountCache(creds);
  cache.removeCachedMessage(fromFolder, uid);
  res.json({ ok: true });
  cache.moveMessage(fromFolder, uid, toFolder).catch(err => {
    console.error(`[mail] Background move failed for uid ${uid}:`, (err as Error).message);
  });
}

/**
 * Cross-account move — fetch raw source from one account, append to another,
 * then delete the source. Used by the Webmail UI's "Verplaats naar andere
 * mailbox" dropdown to move a message between two shared mailboxes that
 * are both configured in this Y-app session.
 *
 * IMAP MOVE/COPY only work within a single connection (one server), so we
 * implement it as fetch + append + delete. The append happens BEFORE the
 * delete; if the append fails we never delete, so the original survives.
 * If the append succeeds and the delete fails, the message exists in both
 * — preferable to losing it, the user can clean up the source manually.
 *
 * Body: { srcAcct?, srcFolder, srcUid, dstAcct?, dstFolder }
 * Where `srcAcct` / `dstAcct` is the shared-mailbox email (omitted for the
 * primary account). The corresponding `MailCredentials` for each account
 * must already be in the session cache (frontend pushes them via
 * /api/mail/config the first time it activates each shared mailbox tab).
 */
export async function mailMoveMessageCrossAccount(req: Request, res: Response) {
  const yAppSid = (req as any).cookies?.y_app_session;
  if (!yAppSid) return res.status(401).json({ ok: false, error: "No session" });
  const instanceId = (req as any).instanceId as number | undefined;

  const body = (req.body || {}) as {
    srcAcct?: string | null;
    srcFolder?: string;
    srcUid?: number | string;
    dstAcct?: string | null;
    dstFolder?: string;
  };
  const srcAcct = body.srcAcct || undefined;
  const dstAcct = body.dstAcct || undefined;
  const srcFolder = body.srcFolder || "";
  const dstFolder = body.dstFolder || "";
  const srcUid = parseInt(String(body.srcUid || "0"), 10);

  if (!srcFolder || !dstFolder || !srcUid) {
    return res.status(400).json({ ok: false, error: "Missing srcFolder/dstFolder/srcUid" });
  }
  // No-op guard: cross-account move to the same account+folder makes no
  // sense; route to the regular same-account move endpoint.
  if (srcAcct === dstAcct && srcFolder === dstFolder) {
    return res.status(400).json({ ok: false, error: "Source and destination are identical" });
  }

  const srcCreds = getMailSession(String(yAppSid), instanceId, srcAcct);
  if (!srcCreds) {
    return res.status(400).json({
      ok: false,
      error: `No cached credentials for source account ${srcAcct || "(primary)"} — open that mailbox tab first`,
    });
  }
  const dstCreds = getMailSession(String(yAppSid), instanceId, dstAcct);
  if (!dstCreds) {
    return res.status(400).json({
      ok: false,
      error: `No cached credentials for destination account ${dstAcct || "(primary)"} — open that mailbox tab first`,
    });
  }

  const srcCache = getAccountCache(srcCreds);
  const dstCache = getAccountCache(dstCreds);

  try {
    // 1. Read raw message + flags from source.
    const raw = await srcCache.fetchRawSource(srcFolder, srcUid);
    if (!raw) {
      return res.status(404).json({ ok: false, error: "Source message not found" });
    }

    // 2. Append to destination. If this throws, source is still intact.
    await dstCache.appendMessage(dstFolder, raw.source, raw.flags);

    // 3. Delete from source. If this throws, the message now exists in
    //    both places — log the error and report partial success so the
    //    user knows to clean up manually if needed.
    try {
      await srcCache.deleteMessage(srcFolder, srcUid);
    } catch (delErr) {
      console.error(`[mail] cross-account move: append OK but source-delete failed for ${srcAcct}/${srcFolder}#${srcUid}: ${(delErr as Error).message}`);
      return res.json({
        ok: true,
        warning: "Bericht is gekopieerd naar de doel-mailbox, maar verwijderen uit de bron is mislukt. Verwijder hem handmatig.",
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(`[mail] cross-account move failed (${srcAcct}/${srcFolder}#${srcUid} -> ${dstAcct}/${dstFolder}): ${(err as Error).message}`);
    sendMailError(res, err, "moveCrossAccount");
  }
}

/** Mark a message as read */
export async function mailMarkRead(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  const folder = (req.query.folder as string) || "INBOX";
  const uid = parseInt(req.query.uid as string || "0", 10);
  if (!uid) return res.status(400).json({ error: "Missing uid" });

  try {
    const cache = getAccountCache(creds);
    await cache.markRead(folder, uid);
    res.json({ ok: true });
  } catch (err) {
    sendMailError(res, err, "markRead");
  }
}

/** Mark a message as unread */
export async function mailMarkUnread(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  const folder = (req.query.folder as string) || "INBOX";
  const uid = parseInt(req.query.uid as string || "0", 10);
  if (!uid) return res.status(400).json({ error: "Missing uid" });

  try {
    const cache = getAccountCache(creds);
    await cache.markUnread(folder, uid);
    res.json({ ok: true });
  } catch (err) {
    sendMailError(res, err, "markUnread");
  }
}

/** Rename a mailbox folder */
export async function mailRenameFolder(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  // Read from body (preferred) or fall back to query params for backward compat
  const oldPath = (req.body?.oldPath as string) || (req.query.oldPath as string);
  const newPath = (req.body?.newPath as string) || (req.query.newPath as string);
  if (!oldPath || !newPath) return res.status(400).json({ error: "Missing oldPath or newPath" });

  try {
    const cache = getAccountCache(creds);
    await cache.renameFolder(oldPath, newPath);
    res.json({ ok: true });
  } catch (err) {
    sendMailError(res, err, `renameFolder "${oldPath}" -> "${newPath}"`);
  }
}

/** Get cache stats */
export async function mailCacheStats(_req: Request, res: Response) {
  const stats: Record<string, unknown> = {};
  for (const [key, cache] of accountCaches) {
    stats[key] = cache.getStats();
  }
  res.json({ data: stats });
}

/** Auto-configure mail from ERPNext (fetches OAuth tokens for Office 365) */
/** Internal auto-config logic (no Express dependency) — uses erpnextSid to proxy to ERPNext */
export async function mailAutoConfigInternal(erpnextSid: string, email: string): Promise<any> {
  if (!erpnextSid) throw new Error("No ERPNext session available");

  // Fetch Email Account
  const emailAccResult = await proxyRequest(erpnextSid,
    `/api/resource/Email Account?filters=${encodeURIComponent(JSON.stringify([["email_id", "=", email]]))}&fields=${encodeURIComponent(JSON.stringify(["name", "email_id", "email_server", "incoming_port", "use_ssl", "smtp_server", "smtp_port", "use_tls", "use_ssl_for_outgoing", "signature", "connected_app"]))}`,
    "GET"
  );
  const emailAccounts = JSON.parse(emailAccResult.body)?.data || [];
  if (emailAccounts.length === 0) throw new Error("Email Account not found in ERPNext");
  const emailAcc = emailAccounts[0];

  // Fetch Connected App (Microsoft 365)
  const connAppResult = await proxyRequest(erpnextSid,
    `/api/resource/Connected App?fields=${encodeURIComponent(JSON.stringify(["name", "client_id", "provider_name", "token_uri"]))}&limit_page_length=10`,
    "GET"
  );
  const allConnApps = JSON.parse(connAppResult.body)?.data || [];
  const connApps = allConnApps.filter((a: any) => a.provider_name?.toLowerCase().includes("microsoft") || a.client_id);

  // Use password (plain IMAP) auth when EITHER the site has no Connected App
  // at all, OR this specific Email Account is not linked to one. The second
  // condition is essential for tenants that DO have a Microsoft Connected App
  // for OAuth accounts but ALSO host plain-IMAP accounts: without it, every
  // account fell through to the OAuth branch below (connApps[0]) and returned
  // authMode "password" WITHOUT a `pass`, so the IMAP login failed. An account
  // with an empty `connected_app` is, by definition, password-authenticated.
  if (connApps.length === 0 || !emailAcc.connected_app) {
    // Return basic config with password from ERPNext
    let password = "";
    try {
      const pwResult = await proxyRequest(erpnextSid,
        `/api/method/frappe.client.get_password?doctype=Email+Account&name=${encodeURIComponent(emailAcc.name)}&fieldname=password`,
        "GET"
      );
      password = JSON.parse(pwResult.body)?.message || "";
    } catch { /* ignore */ }

    // Fallback to env vars
    if (!password) {
      const envUser = process.env.MAIL_USER;
      const envPass = process.env.MAIL_PASS;
      if (envPass && envUser === email) {
        password = envPass;
      }
    }

    return {
      authMode: "password",
      host: emailAcc.email_server || process.env.MAIL_HOST || "",
      port: parseInt(emailAcc.incoming_port || process.env.MAIL_PORT || "993"),
      user: email,
      pass: password,
      secure: !!emailAcc.use_ssl,
      smtpHost: emailAcc.smtp_server || process.env.SMTP_HOST || "",
      smtpPort: parseInt(emailAcc.smtp_port || process.env.SMTP_PORT || "587"),
      // Implicit-SSL SMTP (port 465) needs secure=true; STARTTLS (587) needs
      // false. Derive from ERPNext's use_ssl_for_outgoing flag, with a port-465
      // fallback. Was hardcoded false, which broke sending on 465 mailhosts.
      smtpSecure: !!emailAcc.use_ssl_for_outgoing || parseInt(emailAcc.smtp_port || "0", 10) === 465,
      signature: emailAcc.signature || "",
    };
  }

  const connApp = emailAcc.connected_app
    ? allConnApps.find((a: any) => a.name === emailAcc.connected_app) ?? connApps[0]
    : connApps[0];

  // Wave 1: parallelize the three independent get_password fetches.
  // Previously this was three sequential ERPNext-roundtrips (~80-150 ms
  // elk) → ~300-450 ms totaal per cold creds-resolve. Promise.all kapt
  // dat naar één roundtrip-window. Per-call try/catch zodat één failure
  // niet de andere twee tegenhoudt.
  const tokenName = `${connApp.name}-${email}`;
  const [secretResult, accessTokenResult, refreshTokenResult] = await Promise.all([
    proxyRequest(erpnextSid,
      `/api/method/frappe.client.get_password?doctype=Connected+App&name=${encodeURIComponent(connApp.name)}&fieldname=client_secret`,
      "GET"
    ).catch((e) => ({ status: 500, body: "{}", _err: e })),
    proxyRequest(erpnextSid,
      `/api/method/frappe.client.get_password?doctype=Token+Cache&name=${encodeURIComponent(tokenName)}&fieldname=access_token`,
      "GET"
    ).catch((e) => ({ status: 500, body: "{}", _err: e })),
    proxyRequest(erpnextSid,
      `/api/method/frappe.client.get_password?doctype=Token+Cache&name=${encodeURIComponent(tokenName)}&fieldname=refresh_token`,
      "GET"
    ).catch((e) => ({ status: 500, body: "{}", _err: e })),
  ]);
  const clientSecret = JSON.parse(secretResult.body)?.message || "";
  const accessToken = JSON.parse(accessTokenResult.body)?.message || "";
  const refreshToken = JSON.parse(refreshTokenResult.body)?.message || "";

  // Always try to refresh the token (it's likely expired)
  let finalAccessToken = accessToken;
  if (refreshToken && clientSecret && connApp.client_id && connApp.token_uri) {
    try {
      console.log("[mail-auto-config] Refreshing OAuth2 token for", email);
      const tokenBody = new URLSearchParams({
        client_id: connApp.client_id,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: "https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send offline_access",
      });
      const tokenResp = await fetch(connApp.token_uri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody,
      });
      const tokenResult = await tokenResp.json() as { access_token?: string; error?: string; error_description?: string };
      if (tokenResult.access_token) {
        finalAccessToken = tokenResult.access_token;
        console.log("[mail-auto-config] Token refreshed successfully for", email);
      } else {
        console.error("[mail-auto-config] Token refresh returned error:", tokenResult.error, tokenResult.error_description);
      }
    } catch (e) {
      console.error("[mail-auto-config] Token refresh fetch failed:", (e as Error).message);
    }
  }

  return {
    authMode: finalAccessToken ? "oauth2" : "password",
    host: emailAcc.email_server || "outlook.office365.com",
    port: parseInt(emailAcc.incoming_port || "993"),
    user: email,
    secure: emailAcc.use_ssl !== 0,
    smtpHost: emailAcc.smtp_server || "smtp.office365.com",
    smtpPort: parseInt(emailAcc.smtp_port || "587"),
    smtpSecure: false, // O365 uses STARTTLS
    accessToken: finalAccessToken,
    refreshToken,
    clientId: connApp.client_id,
    clientSecret,
    tokenUri: connApp.token_uri,
    signature: emailAcc.signature || "",
  };
}

/**
 * Rewrite relative `src="/..."` and `href="/..."` in signature HTML to
 * absolute URLs rooted at the current ERPNext host. ERPNext stores signatures
 * with relative paths like `/files/logo.png`; those resolve correctly in
 * production (same origin via nginx) but break in dev (vite dev server does
 * not proxy `/files`). Absolute URLs work in both environments.
 */
function absolutifySignatureUrls(sig: string): string {
  if (!sig) return sig;
  const erpUrl = (erpRequestContext.getStore()?.url || ERPNEXT_URL || "").replace(/\/+$/, "");
  if (!erpUrl) return sig;
  // Match src="/..." or href="/..." (single or double quoted), but skip
  // protocol-relative (//host/...) and already-absolute URLs.
  return sig.replace(
    /\b(src|href)\s*=\s*(["'])(\/(?!\/)[^"']*)\2/gi,
    (_m, attr, quote, path) => `${attr}=${quote}${erpUrl}${path}${quote}`,
  );
}

/* Wave 1: in-memory cache voor mailGetSignature.
 * Compose-modal vraagt op elke open de signature, doet 4 sequentiële ERPNext
 * calls per request (~400-1500 ms warm, meer cold). Signatures veranderen
 * zelden — een 10-min cache schakelt dat naar ~0 ms voor 99% van de opens.
 * Per (erpnextSid, email) gekeyed zodat instance-isolation intact blijft.
 */
interface SignatureCacheEntry { signature: string; source: string | null; diag: unknown; expiresAt: number }
const signatureCache = new Map<string, SignatureCacheEntry>();
const SIGNATURE_TTL_MS = 10 * 60 * 1000;
const SIGNATURE_CACHE_MAX = 500;

function signatureCacheKey(erpnextSid: string, email: string): string {
  return `${erpnextSid}:${email}`;
}

export function invalidateSignatureCache(erpnextSid?: string, email?: string): void {
  if (!erpnextSid && !email) { signatureCache.clear(); return; }
  if (erpnextSid && email) { signatureCache.delete(signatureCacheKey(erpnextSid, email)); return; }
  // Partial clear — drop alle entries die op één van beide matchen.
  const prefix = erpnextSid ? `${erpnextSid}:` : "";
  const suffix = email ? `:${email}` : "";
  for (const k of signatureCache.keys()) {
    if (prefix && k.startsWith(prefix)) signatureCache.delete(k);
    else if (suffix && k.endsWith(suffix)) signatureCache.delete(k);
  }
}

/** Fetch email signature from ERPNext — tries multiple sources */
/** Detecteer of HTML feitelijk leeg is (alleen whitespace / lege Quill-wrapper / etc).
 * ERPNext slaat soms `<div class="ql-editor"><p><br></p></div>` op als "leeg" signature-veld;
 * dat is een truthy string maar bevat geen daadwerkelijke handtekening. */
function isEffectivelyEmptySignatureHtml(html: string | undefined | null): boolean {
  if (!html) return true;
  // Strip alle HTML tags + entities, kijk of er nog tekst over is
  const stripped = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&[a-z]+;/gi, "").trim();
  if (stripped.length > 0) return false;
  // Geen tekst → kijk of er nog "echte" media-tags in zitten (img, hr, table, svg)
  return !/<(img|hr|table|svg)[\s>]/i.test(html);
}

export async function mailGetSignature(req: Request, res: Response) {
  const erpnextSid = (req as any).erpnextSid as string;
  const email = req.query.email as string;
  if (!erpnextSid || !email) return res.status(400).json({ error: "Missing session or email" });

  // Wave 1: cache-first. Compose-modal opent vaak; 4× ERPNext-calls per open
  // werd het zichtbare "even wachten op ~1s" voor elke nieuwe compose.
  const cacheKey = signatureCacheKey(erpnextSid, email);
  const cached = signatureCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ data: { signature: cached.signature, source: cached.source, diag: cached.diag, cached: true } });
  }

  // W1 diagnose: per-path teller met rij-count + foutreden zodat zowel server-log
  // als browser-console laat zien WAAROM een handtekening leeg terugkomt.
  const diag: { path: string; rows: number; hasSig: boolean; effectivelyEmpty?: boolean; error?: string }[] = [];

  function cacheAndRespond(signature: string, source: string | null, diagSnapshot: unknown) {
    signatureCache.set(cacheKey, { signature, source, diag: diagSnapshot, expiresAt: Date.now() + SIGNATURE_TTL_MS });
    // Bounded eviction (oldest insertion order).
    while (signatureCache.size > SIGNATURE_CACHE_MAX) {
      const first = signatureCache.keys().next().value;
      if (first === undefined) break;
      signatureCache.delete(first);
    }
    return res.json({ data: { signature, source, diag: diagSnapshot, cached: false } });
  }

  /** Helper: behandel een gevonden sig — als hij feitelijk leeg is, return null (val door) */
  function acceptSig(sig: string | undefined | null): string | null {
    if (!sig) return null;
    if (isEffectivelyEmptySignatureHtml(sig)) return null;
    return sig;
  }

  try {
    // 1. Email Account -> signature field
    try {
      const r = await proxyRequest(erpnextSid,
        `/api/resource/Email Account?filters=${encodeURIComponent(JSON.stringify([["email_id", "=", email]]))}&fields=${encodeURIComponent(JSON.stringify(["signature"]))}`,
        "GET"
      );
      const rows = JSON.parse(r.body)?.data || [];
      const rawSig = rows[0]?.signature;
      const accepted = acceptSig(rawSig);
      diag.push({ path: "Email Account (email_id)", rows: rows.length, hasSig: !!rawSig, effectivelyEmpty: !!rawSig && !accepted });
      if (accepted) return cacheAndRespond(absolutifySignatureUrls(accepted), "Email Account", diag);
    } catch (e) { diag.push({ path: "Email Account (email_id)", rows: 0, hasSig: false, error: (e as Error).message }); }

    // 2. User -> email_signature (match by email)
    try {
      const r = await proxyRequest(erpnextSid,
        `/api/resource/User?filters=${encodeURIComponent(JSON.stringify([["email", "=", email]]))}&fields=${encodeURIComponent(JSON.stringify(["email_signature"]))}`,
        "GET"
      );
      const rows = JSON.parse(r.body)?.data || [];
      const rawSig = rows[0]?.email_signature;
      const accepted = acceptSig(rawSig);
      diag.push({ path: "User (email)", rows: rows.length, hasSig: !!rawSig, effectivelyEmpty: !!rawSig && !accepted });
      if (accepted) return cacheAndRespond(absolutifySignatureUrls(accepted), "User", diag);
    } catch (e) { diag.push({ path: "User (email)", rows: 0, hasSig: false, error: (e as Error).message }); }

    // 3. Employee -> find by company_email or user_id, then get User.email_signature
    try {
      const empResult = await proxyRequest(erpnextSid,
        `/api/resource/Employee?filters=${encodeURIComponent(JSON.stringify([["status", "=", "Active"], ["company_email", "=", email]]))}&fields=${encodeURIComponent(JSON.stringify(["user_id", "employee_name"]))}`,
        "GET"
      );
      let employees = JSON.parse(empResult.body)?.data || [];
      if (employees.length === 0) {
        const empResult2 = await proxyRequest(erpnextSid,
          `/api/resource/Employee?filters=${encodeURIComponent(JSON.stringify([["status", "=", "Active"], ["user_id", "=", email]]))}&fields=${encodeURIComponent(JSON.stringify(["user_id", "employee_name"]))}`,
          "GET"
        );
        employees = JSON.parse(empResult2.body)?.data || [];
      }
      if (employees.length > 0 && employees[0].user_id) {
        const userResult = await proxyRequest(erpnextSid,
          `/api/resource/User?filters=${encodeURIComponent(JSON.stringify([["name", "=", employees[0].user_id]]))}&fields=${encodeURIComponent(JSON.stringify(["email_signature"]))}`,
          "GET"
        );
        const userRows = JSON.parse(userResult.body)?.data || [];
        const rawSig = userRows[0]?.email_signature;
        const accepted = acceptSig(rawSig);
        diag.push({ path: `Employee → User (${employees[0].user_id})`, rows: userRows.length, hasSig: !!rawSig, effectivelyEmpty: !!rawSig && !accepted });
        if (accepted) return cacheAndRespond(absolutifySignatureUrls(accepted), "User (via Employee)", diag);
      } else {
        diag.push({ path: "Employee → User", rows: 0, hasSig: false });
      }
    } catch (e) { diag.push({ path: "Employee → User", rows: 0, hasSig: false, error: (e as Error).message }); }

    // 4. Check if there's a default Email Account with a signature
    try {
      const r = await proxyRequest(erpnextSid,
        `/api/resource/Email Account?filters=${encodeURIComponent(JSON.stringify([["default_outgoing", "=", 1]]))}&fields=${encodeURIComponent(JSON.stringify(["signature"]))}`,
        "GET"
      );
      const rows = JSON.parse(r.body)?.data || [];
      const rawSig = rows[0]?.signature;
      const accepted = acceptSig(rawSig);
      diag.push({ path: "Default Email Account (outgoing=1)", rows: rows.length, hasSig: !!rawSig, effectivelyEmpty: !!rawSig && !accepted });
      if (accepted) return cacheAndRespond(absolutifySignatureUrls(accepted), "Default Email Account", diag);
    } catch (e) { diag.push({ path: "Default Email Account (outgoing=1)", rows: 0, hasSig: false, error: (e as Error).message }); }

    console.warn(`[mailGetSignature] No signature found for ${email}. Diag:`, JSON.stringify(diag));
    res.json({ data: { signature: "", source: null, diag } });
  } catch (err) {
    sendMailError(res, err, "getSignature");
  }
}

export async function mailAutoConfig(req: Request, res: Response) {
  const erpnextSid = (req as any).erpnextSid as string;
  const email = req.query.email as string;
  if (!erpnextSid || !email) return res.status(400).json({ error: "Missing session or email" });

  try {
    const data = await mailAutoConfigInternal(erpnextSid, email);
    res.json({ data });
  } catch (err) {
    sendMailError(res, err, "autoConfig");
  }
}

/* ─── Startup warmup: preload all configured mail accounts ─── */

/**
 * Called once on server startup. If MAIL_HOST and MAIL_USER env vars are set,
 * eagerly connects + preloads INBOX so the frontend loads instantly.
 */
export async function mailStartupWarmup(): Promise<void> {
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  const port = parseInt(process.env.MAIL_PORT || "993", 10);
  const secure = process.env.MAIL_SECURE !== "false";

  if (!host || !user) {
    console.log("[mail-warmup] No MAIL_HOST/MAIL_USER env vars set, skipping startup warmup");
    return;
  }

  console.log(`[mail-warmup] Starting eager warmup for ${user}@${host}...`);

  try {
    const creds: MailCredentials = { host, port, user, pass: pass || "", secure };
    const cache = getAccountCache(creds);

    const folders = await cache.fetchFolders(true);
    console.log(`[mail-warmup] ${user}: ${folders.length} folders`);

    const msgResult = await cache.fetchMessages("INBOX", true, 1, 5000);
    console.log(`[mail-warmup] ${user}: ${msgResult.messages.length} messages in INBOX`);

    // Preload bodies in background (fire-and-forget)
    if (msgResult.messages.length > 0) {
      cache.preloadBodies("INBOX", msgResult.messages).catch(() => {});
    }
  } catch (err) {
    console.error(`[mail-warmup] Failed for ${user}@${host}:`, (err as Error).message);
  }

  console.log(`[mail-warmup] Startup warmup complete`);
}

/** Check if a mail account cache is warm (has messages loaded) */
export function mailIsWarm(req: Request, res: Response) {
  const email = req.query.email as string;
  if (!email) return res.json({ warm: false });

  // Check if we already have a cache for this email
  for (const [key, cache] of accountCaches) {
    if (key.includes(email)) {
      const stats = cache.getStats();
      const warm = stats.folderCaches > 0 || stats.cachedBodies > 0;
      return res.json({ warm, stats });
    }
  }
  res.json({ warm: false });
}

/** Extract unique contacts from all cached messages */
export async function mailListContacts(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  try {
    const cache = getAccountCache(creds);
    const contacts = new Map<string, { email: string; name: string; count: number }>();

    // Scan all folder caches for contacts
    const stats = cache.getStats();
    // Get INBOX messages (most relevant for contacts)
    for (const folder of ["INBOX", "Sent", "INBOX.Sent", "Sent Items", "Verzonden items"]) {
      try {
        const result = await cache.fetchMessages(folder, false, 1, 5000);
        for (const msg of result.messages) {
          for (const addr of [...msg.from, ...msg.to]) {
            if (!addr.address) continue;
            const key = addr.address.toLowerCase();
            const existing = contacts.get(key);
            if (existing) {
              existing.count++;
              if (!existing.name && addr.name) existing.name = addr.name;
            } else {
              contacts.set(key, { email: addr.address, name: addr.name || "", count: 1 });
            }
          }
        }
      } catch { /* folder may not exist */ }
    }

    // Remove own email address
    contacts.delete(creds.user.toLowerCase());

    const sorted = Array.from(contacts.values()).sort((a, b) => b.count - a.count);
    res.json({ data: sorted });
  } catch (err) {
    sendMailError(res, err, "listContacts");
  }
}

/**
 * Get conversation thread for a given source message.
 *
 * Vraagt `folder` + `uid` (de mail die de gebruiker heeft geopend). Server:
 *  1. Leest Message-ID / In-Reply-To / References uit de bron-mail (uit
 *     fullMessages-cache; fallback header-only FETCH zonder \Seen).
 *  2. Bouwt een initiële `threadKeys`-set met die drie headers.
 *  3. Verzamelt candidates door subject-prefilter (Re:/Fwd:-stripped match)
 *     over: huidige folder + Sent + INBOX + alle INBOX-subfolders. Skip
 *     Trash/Spam. pageSize 100 per folder.
 *  4. Header-only FETCH op de candidate-uids per folder → Message-ID /
 *     In-Reply-To / References.
 *  5. Transitive closure: een candidate hoort bij de thread als zijn IDs in
 *     `threadKeys` zitten; bij hit voeg zijn Message-ID toe en herhaal —
 *     dit pakt vertakkingen op die alleen via een tussenliggende mail aan
 *     de bron gelinkt zijn.
 *  6. Per result `relation`: "current" | "ancestor" (vóór bron-datum) |
 *     "descendant" (ná bron-datum).
 *  7. Resultaat 5 min gecached op Message-ID. Tweede klik op dezelfde mail
 *     → instant.
 *
 * Backward-compat: oude clients die nog alleen `subject` sturen krijgen
 * een degraded subject-only result (geen header-matching).
 *
 * Performance: header-only FETCH is grofweg 10x lichter dan body-fetch
 * (geen MIME-parsing, geen attachment-extractie, geen \Seen STORE).
 * Target ≤ 200 ms voor thread van 10 mails over 4 folders. Cache-hit ≤ 5 ms.
 */
export async function mailGetConversation(req: Request, res: Response) {
  const creds = await getCredentials(req);
  if (!creds) return res.status(400).json({ error: "Missing credentials" });

  const folder = (req.query.folder as string) || "INBOX";
  const uidStr = (req.query.uid as string) || "";
  const uid = parseInt(uidStr, 10);
  // Backward-compat for legacy callers (subject-only).
  const fallbackSubject = (req.query.subject as string) || "";

  if (!uid && !fallbackSubject) return res.json({ data: [] });

  try {
    const cache = getAccountCache(creds);

    // ── 1. Bron-mail headers ophalen ─────────────────────────────────
    let srcMessageId: string | undefined;
    let srcInReplyTo: string | undefined;
    let srcReferences: string | undefined;
    let srcSubject = fallbackSubject;
    let srcDate: string | null = null;

    if (uid) {
      const cached = cache.getCachedFullMessage(folder, uid);
      if (cached) {
        srcMessageId = cached.messageId;
        srcInReplyTo = cached.inReplyTo;
        srcReferences = cached.references;
        srcSubject = cached.subject;
        srcDate = cached.date;
      } else {
        // Bron niet in cache — header-only fetch (geen \Seen STORE).
        const [headerInfo] = await cache.fetchHeadersBatch(folder, [uid], true);
        if (headerInfo) {
          srcMessageId = headerInfo.messageId;
          srcInReplyTo = headerInfo.inReplyTo;
          srcReferences = headerInfo.references;
          srcSubject = headerInfo.subject;
          srcDate = headerInfo.date;
        }
      }
    }

    if (!srcSubject) return res.json({ data: [] });

    // ── 2. Cache-hit? ───────────────────────────────────────────────
    const cacheKey = srcMessageId ? `mid:${srcMessageId}` : `subj:${srcSubject.toLowerCase()}`;
    const cachedResult = cache.getCachedConversation(cacheKey);
    if (cachedResult) {
      // Re-tag current/relation since dezelfde thread vanuit andere bron-uid kan komen.
      const tagged = retagRelation(cachedResult, folder, uid, srcDate);
      return res.json({ data: tagged });
    }

    // ── 3. Initiële threadKeys ──────────────────────────────────────
    const threadKeys = new Set<string>();
    if (srcMessageId) threadKeys.add(srcMessageId);
    if (srcInReplyTo) threadKeys.add(srcInReplyTo);
    if (srcReferences) {
      for (const r of srcReferences.split(/\s+/).filter(Boolean)) threadKeys.add(r);
    }

    // ── 4. Subject-prefilter (case-insensitive, prefix-stripped) ────
    const baseSubject = srcSubject.replace(/^(Re|Fwd|FW|AW|Antw|Doorgestuurd):\s*/gi, "").trim().toLowerCase();
    if (!baseSubject) return res.json({ data: [] });

    // ── 5. Search-space samenstellen ────────────────────────────────
    const allFolders = await cache.getAllFolderPaths();
    const sentFolder = allFolders.find(f =>
      f.specialUse === "\\Sent" ||
      /^(sent|sent items|verzonden|verzonden items)$/i.test(f.name),
    );
    const isTrashOrSpam = (path: string, specialUse?: string | null) => {
      if (specialUse === "\\Trash" || specialUse === "\\Junk") return true;
      const leaf = (path.split(/[/.]/).pop() || path).toLowerCase().trim();
      return /^(trash|prullenbak|deleted|verwijderd|junk|spam|ongewenst)/i.test(leaf);
    };

    const searchFolders = new Set<string>([folder, "INBOX"]);
    if (sentFolder) searchFolders.add(sentFolder.path);
    // INBOX-subfolders (project-archief) meenemen, maar ALLEEN als ze al vers
    // in de in-memory list-cache zitten (door de achtergrond-warmup of doordat
    // de gebruiker ze al opende). Anders zou één mail openen een koude IMAP-
    // fetch over alle ~130 projectmappen forceren; de seriële opQueue raakt dan
    // verzadigd en elke volgende klik (mail openen / map wisselen) blijft
    // hangen achter die warmte-loop. Niet-gecachte mappen verschijnen vanzelf
    // in de thread zodra de warmup ze geladen heeft.
    for (const f of allFolders) {
      if (isTrashOrSpam(f.path, f.specialUse)) continue;
      if (f.path === "INBOX") continue;
      if (!/^INBOX[/.]/i.test(f.path)) continue;
      if (cache.hasFreshFolderCache(f.path)) searchFolders.add(f.path);
    }

    // ── 6. Per folder: candidates via subject-prefilter, daarna header-fetch ─
    type Candidate = { folder: string; uid: number; subject: string; date: string | null;
      from: { name: string; address: string }[]; to: { name: string; address: string }[];
      seen: boolean; flagged: boolean; hasAttachments: boolean; flags: string[]; seq?: number };
    const candidatesByFolder = new Map<string, Candidate[]>();

    for (const searchFolder of searchFolders) {
      try {
        // pageSize 50 = exact dezelfde cache-key als de warmup/normale folder-
        // load, zodat dit een cache-hit is i.p.v. een tweede koude IMAP-fetch.
        // background=true → lagere queue-prioriteit dan interactieve acties.
        const { messages } = await cache.fetchMessages(searchFolder, false, 1, 50, undefined, true);
        const matches: Candidate[] = [];
        for (const msg of messages) {
          const msgBase = msg.subject.replace(/^(Re|Fwd|FW|AW|Antw|Doorgestuurd):\s*/gi, "").trim().toLowerCase();
          if (msgBase === baseSubject) {
            matches.push({
              folder: searchFolder, uid: msg.uid, subject: msg.subject, date: msg.date,
              from: msg.from, to: msg.to, seen: msg.seen, flagged: msg.flagged,
              hasAttachments: msg.hasAttachments, flags: msg.flags, seq: msg.seq,
            });
          }
        }
        if (matches.length > 0) candidatesByFolder.set(searchFolder, matches);
      } catch { /* skip folder errors */ }
    }

    // ── 7. Header-fetch per folder (parallel) ───────────────────────
    type EnrichedCandidate = Candidate & { messageId?: string; inReplyTo?: string; references?: string };
    const enriched: EnrichedCandidate[] = [];

    const folderHeaderFetches = Array.from(candidatesByFolder.entries()).map(async ([fld, list]) => {
      try {
        const headers = await cache.fetchHeadersBatch(fld, list.map(c => c.uid), true);
        const headerByUid = new Map(headers.map(h => [h.uid, h]));
        for (const c of list) {
          const h = headerByUid.get(c.uid);
          enriched.push({
            ...c,
            messageId: h?.messageId,
            inReplyTo: h?.inReplyTo,
            references: h?.references,
          });
        }
      } catch {
        // Bij header-fetch fout: fall back zonder threading-info (degraded subject-match).
        for (const c of list) enriched.push({ ...c });
      }
    });
    await Promise.all(folderHeaderFetches);

    // ── 8. Transitive closure ───────────────────────────────────────
    const threadMembers: EnrichedCandidate[] = [];
    const memberKeys = new Set<string>(); // folder:uid voor dedup
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of enriched) {
        const key = `${c.folder}:${c.uid}`;
        if (memberKeys.has(key)) continue;
        const isCurrent = c.folder === folder && c.uid === uid;
        const matchesThread = isCurrent
          || (!!c.messageId && threadKeys.has(c.messageId))
          || (!!c.inReplyTo && threadKeys.has(c.inReplyTo))
          || (!!c.references && c.references.split(/\s+/).some(r => threadKeys.has(r)));
        if (matchesThread) {
          memberKeys.add(key);
          threadMembers.push(c);
          if (c.messageId) threadKeys.add(c.messageId);
          changed = true;
        }
      }
    }

    // Fallback: als header-matching helemaal niets oplevert (servers zonder
    // betrouwbare Message-IDs), keer terug naar pure subject-match resultaat.
    const members = threadMembers.length > 0 ? threadMembers : enriched;

    // ── 9. Dedup + sort + relation-tag ──────────────────────────────
    const seenKeys = new Set<string>();
    const unique = members.filter(m => {
      const k = `${m.folder}:${m.uid}:${m.date}`;
      if (seenKeys.has(k)) return false;
      seenKeys.add(k);
      return true;
    });
    unique.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    const srcDateMs = srcDate ? new Date(srcDate).getTime() : 0;
    const results: ConversationResult[] = unique.map(m => {
      const isCurrent = m.folder === folder && m.uid === uid;
      const mDateMs = new Date(m.date || 0).getTime();
      const relation: ThreadRelation = isCurrent
        ? "current"
        : (mDateMs > srcDateMs ? "descendant" : "ancestor");
      return {
        uid: m.uid, seq: m.seq, folder: m.folder, subject: m.subject, date: m.date,
        from: m.from, to: m.to, cc: [], seen: m.seen, flagged: m.flagged,
        hasAttachments: m.hasAttachments, flags: m.flags,
        messageId: m.messageId, inReplyTo: m.inReplyTo, references: m.references,
        relation, textBody: "", htmlBody: "", attachments: [],
      };
    });

    // Cache only when meaningful (>=2 mails én een Message-ID-bron).
    if (results.length > 1 && srcMessageId) {
      cache.setCachedConversation(cacheKey, results);
    }

    res.json({ data: results });
  } catch (err) {
    sendMailError(res, err, "getConversation");
  }
}

/**
 * Re-tag relation on a cached conversation result wanneer dezelfde thread
 * vanuit een andere bron-uid wordt opgevraagd. De cached array is een
 * snapshot; we mappen alleen de relation-tags opnieuw.
 */
function retagRelation(
  results: ConversationResult[],
  srcFolder: string,
  srcUid: number,
  srcDate: string | null,
): ConversationResult[] {
  const srcDateMs = srcDate ? new Date(srcDate).getTime() : 0;
  return results.map(r => {
    const isCurrent = r.folder === srcFolder && r.uid === srcUid;
    const rDateMs = new Date(r.date || 0).getTime();
    const relation: ThreadRelation = isCurrent
      ? "current"
      : (rDateMs > srcDateMs ? "descendant" : "ancestor");
    return { ...r, relation };
  });
}

/* ─── Internal functions for health checks ─── */

export async function listFoldersInternal(creds: MailCredentials): Promise<CachedFolder[]> {
  const cache = getAccountCache(creds);
  return cache.fetchFolders();
}

export async function listMessagesInternal(opts: MailCredentials & { folder?: string; pageSize?: number }): Promise<{ messages: CachedMessage[]; total: number }> {
  const cache = getAccountCache(opts);
  return cache.fetchMessages(opts.folder || "INBOX", false, 1, opts.pageSize || 50);
}
