/**
 * Messenger — Multi-platform messaging proxy
 * Supports: NextCloud Talk, MS Teams (Graph API), Telegram, WhatsApp (placeholder), Signal (placeholder)
 * Credentials from env vars or per-request query/body params.
 */

import type { Request, Response } from "express";
import { nextFreeUploadName } from "./nc-talk-upload-name.ts";
import type { Conversation } from "./messenger/types.ts";
// Gedeeld wire-contract met de desktop fetch-adapter (Fase 5 drift-safety).
// Type-only — esbuild/tsx strippen dit weg; nul runtime-effect.
import type { MessengerConversationsResponse, MessengerMessagesResponse } from "../../frontend/src/lib/api-shapes.ts";
import {
  ncTalkRequest,
  ncConversationTypeLabel,
  ncListConversations,
  ncGetMessages,
  ncSendMessage,
  ncMarkRead,
  ncReactToMessage,
  ncRemoveReaction,
  ncEditMessage,
  ncDeleteMessage,
} from "./messenger/nextcloud.ts";
import { resolveTelegramToken, tgListConversations, tgGetMessages, tgSendMessage } from "./messenger/telegram.ts";
import { teamsListConversations, teamsGetMessages, teamsSendMessage } from "./messenger/teams.ts";

/* ─── NextCloud Talk credential session cache ─── */
// Per-(y_app_session, instance) cache so the frontend can push creds once
// over the /ws/events WebSocket (subscribe-messenger) and every subsequent
// HTTP request reads them from memory instead of receiving `pass=…` in the
// URL. The threat this closes: NC Talk passwords landing in nginx access
// logs, browser history, CDN caches, and any downstream log shipper that
// consumes request URLs. Sliding 4h TTL matches mailSessions; capped at
// 1000 entries so the map can't grow unbounded.
interface NcCreds { ncUrl: string; user: string; pass: string }
interface NcSessionEntry { creds: NcCreds; expiresAt: number }
const ncSessions = new Map<string, NcSessionEntry>();
const NC_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const NC_SESSION_MAX = 1000;

function ncSessionKey(yAppSid: string, instanceId: string | number | undefined | null): string {
  return `${yAppSid}:${instanceId ?? "default"}`;
}

export function setNcSession(yAppSid: string, instanceId: string | number | undefined | null, creds: NcCreds): void {
  if (!yAppSid) return;
  let normalized = creds.ncUrl.replace(/\/+$/, "");
  if (normalized && !normalized.match(/^https?:\/\//)) normalized = `https://${normalized}`;
  ncSessions.set(ncSessionKey(yAppSid, instanceId), {
    creds: { ncUrl: normalized, user: creds.user, pass: creds.pass },
    expiresAt: Date.now() + NC_SESSION_TTL_MS,
  });
  const now = Date.now();
  for (const [k, v] of ncSessions) if (v.expiresAt < now) ncSessions.delete(k);
  while (ncSessions.size > NC_SESSION_MAX) {
    const first = ncSessions.keys().next().value;
    if (first === undefined) break;
    ncSessions.delete(first);
  }
}

export function getNcSession(yAppSid: string, instanceId: string | number | undefined | null): NcCreds | null {
  if (!yAppSid) return null;
  const k = ncSessionKey(yAppSid, instanceId);
  const v = ncSessions.get(k);
  if (!v) return null;
  if (v.expiresAt < Date.now()) { ncSessions.delete(k); return null; }
  v.expiresAt = Date.now() + NC_SESSION_TTL_MS;
  return v.creds;
}

export function clearNcSession(yAppSid: string, instanceId: string | number | undefined | null): void {
  if (!yAppSid) return;
  ncSessions.delete(ncSessionKey(yAppSid, instanceId));
}

/**
 * POST /api/messenger/subscribe
 * Body: { url|ncUrl, user, pass }
 *
 * HTTP equivalent of the `subscribe-messenger` WS message: caches the NextCloud
 * Talk creds server-side for this (yAppSid, instanceId). The /ws/events
 * WebSocket does NOT reliably establish in installed PWAs (e.g. an Edge "app"),
 * and post-Wave-0a every /api/messenger/* call reads creds ONLY from this cache
 * — so without an HTTP path an installed app gets "Missende credentials" even
 * though it has them configured. This request carries the same session cookie +
 * X-Y-App-Instance header as the data calls, so the creds land under the exact
 * key those calls read. Creds travel in the body (not the URL) → access logs
 * stay clean, preserving the Wave 0a intent.
 */
export async function messengerSubscribe(req: Request, res: Response) {
  const yAppSid = (req as any).cookies?.y_app_session;
  const instanceId = (req as any).instanceId as number | undefined;
  const ncUrl = String(req.body?.ncUrl || req.body?.url || "");
  const user = String(req.body?.ncUser || req.body?.user || "");
  const pass = String(req.body?.ncPass || req.body?.pass || "");
  if (!yAppSid || !ncUrl || !user || !pass) {
    return res.status(400).json({ ok: false, error: "Missing session or credentials" });
  }
  setNcSession(String(yAppSid), instanceId, { ncUrl, user, pass });
  return res.json({ ok: true });
}

/* ─── NextCloud Talk helpers ─── */

function resolveNcTalkCreds(req: Request): { ncUrl: string; user: string; pass: string } | null {
  // Resolution order (each strictly per-instance — no cross-tab leaks):
  //   1. Server-side cache populated via /ws/events subscribe-messenger.
  //      This is the path the frontend uses post-v0.22.0 — creds never
  //      appear in URL query strings, so nginx access logs, browser
  //      history, and CDN caches stay clean.
  //   2. Legacy query/body params (?url=&user=&pass=). Kept as fallback
  //      for stale browser caches that still ship the old frontend.
  //      Remove this branch one release after Wave 0a deploys cleanly.
  //   3. Env-var fallback (NEXTCLOUD_TALK_URL/…) for single-instance /
  //      legacy deploys. Previously these won, which meant a server-wide
  //      NEXTCLOUD_URL silently overrode whatever each tab configured —
  //      Impertio saw 3BM's messages. Now they're last-resort only.
  const yAppSid = (req as any).cookies?.y_app_session;
  // `instanceId` wordt normaal door authMiddleware op req gezet, maar
  // /api/messenger/file-proxy zit in de auth-whitelist (zoals
  // /api/erpnext-asset) omdat <img src=…> tags geen custom header
  // kunnen sturen. Voor die route komt de instance via ?instance=NN.
  const instanceId = ((req as any).instanceId as number | undefined)
    ?? (req.query.instance ? Number(req.query.instance) : undefined);
  if (yAppSid && instanceId !== undefined && !Number.isNaN(instanceId)) {
    const cached = getNcSession(String(yAppSid), instanceId);
    if (cached) return cached;
  }

  let ncUrl = ((req.body?.url || req.query.url) as string || "").replace(/\/+$/, "");
  if (ncUrl && !ncUrl.match(/^https?:\/\//)) ncUrl = `https://${ncUrl}`;
  const user = (req.body?.user || req.query.user) as string;
  const pass = (req.body?.pass || req.query.pass) as string;
  if (ncUrl && user && pass) {
    // Opportunistically promote this request's creds into the cache so
    // follow-up calls in the same session don't need them in URL.
    if (yAppSid && instanceId !== undefined) {
      setNcSession(String(yAppSid), instanceId, { ncUrl, user, pass });
    }
    return { ncUrl, user, pass };
  }

  const envUrl = process.env.NEXTCLOUD_TALK_URL || process.env.NEXTCLOUD_URL;
  const envUser = process.env.NEXTCLOUD_TALK_USER || process.env.NEXTCLOUD_USER;
  const envPass = process.env.NEXTCLOUD_TALK_PASS || process.env.NEXTCLOUD_PASS;
  if (envUrl && envUser && envPass) {
    const url = envUrl.replace(/\/+$/, "");
    return { ncUrl: url.match(/^https?:\/\//) ? url : `https://${url}`, user: envUser, pass: envPass };
  }
  return null;
}

/* ─── Placeholder platforms ─── */

function whatsappPlaceholder() {
  return {
    platform: "whatsapp",
    status: "not_configured",
    message: "WhatsApp Business API vereist een apart account en goedkeuring van Meta. " +
      "Configureer de volgende gegevens om WhatsApp te activeren:",
    setup: [
      "1. Maak een Meta Business Account aan op business.facebook.com",
      "2. Registreer een WhatsApp Business API nummer",
      "3. Verkrijg een permanent access token via de Meta Developer Console",
      "4. Configureer een webhook URL voor inkomende berichten",
      "5. Voer het telefoonnummer-ID en token hieronder in",
    ],
    fields: ["phone_number_id", "access_token", "webhook_verify_token"],
  };
}

function signalPlaceholder() {
  return {
    platform: "signal",
    status: "not_configured",
    message: "Signal vereist signal-cli of signal-cli-rest-api als backend. " +
      "Volg deze stappen om Signal te activeren:",
    setup: [
      "1. Installeer signal-cli: https://github.com/AsamK/signal-cli",
      "2. Of gebruik signal-cli-rest-api via Docker:",
      "   docker run -p 8080:8080 bbernhard/signal-cli-rest-api",
      "3. Registreer je telefoonnummer met signal-cli",
      "4. Configureer de API URL hieronder",
    ],
    fields: ["signal_api_url", "phone_number"],
  };
}

/* ─── Conversations Cache ─── */

interface ConvoCache {
  conversations: Conversation[];
  ts: number;
}

const conversationCache = new Map<string, ConvoCache>();
// Server-side conversation-list cache. Voor "real-time" badge-update
// (Piet's klacht: 51s wachten op melding) moet deze NIET 30s vasthouden,
// anders trekt polling alsnog oude data. Naar 5s: cached binnen één
// poll-tick (10s), vers daarna. Reduceert worst-case latency van
// (poll + cache_ttl) = 40s naar ~15s.
const CONVO_CACHE_TTL = 5_000;

/**
 * Cache key derivation. The second arg MUST identify the credentials being
 * used, not just the human identity — otherwise two callers with different
 * credentials but the same user/key collide on the same cache entry and
 * the second one sees the first's conversations. The Telegram case used to
 * pass the literal string "bot" here, which made every caller share one
 * cache entry regardless of token. Don't go back to that.
 */
function getConvoCacheKey(platform: string, credIdentifier: string): string {
  return `${platform}:${credIdentifier}`;
}

/** Pre-warm the conversations cache for configured platforms. Called at server startup. */
export async function messengerWarmup(services: {
  nextcloud?: { url: string; user: string; pass: string } | null;
  telegram?: { token: string } | null;
}): Promise<void> {
  const tasks: Promise<void>[] = [];

  if (services.nextcloud?.url && services.nextcloud?.user && services.nextcloud?.pass) {
    const { url, user, pass } = services.nextcloud;
    const ncUrl = url.replace(/\/+$/, "");
    tasks.push(
      ncListConversations(ncUrl, user, pass)
        .then(convos => {
          conversationCache.set(getConvoCacheKey("nextcloud-talk", `${ncUrl}|${user}`), { conversations: convos, ts: Date.now() });
          console.log(`[messenger] Cached ${convos.length} NextCloud Talk conversations`);
        })
        .catch(err => console.warn("[messenger] Warmup NextCloud Talk failed:", err.message))
    );
  }

  if (services.telegram?.token) {
    const token = services.telegram.token;
    tasks.push(
      tgListConversations(token)
        .then(convos => {
          conversationCache.set(getConvoCacheKey("telegram", token), { conversations: convos, ts: Date.now() });
          console.log(`[messenger] Cached ${convos.length} Telegram conversations`);
        })
        .catch(err => console.warn("[messenger] Warmup Telegram failed:", err.message))
    );
  }

  await Promise.allSettled(tasks);
}

/* ─── Express Handlers ─── */

/**
 * POST /api/messenger/test
 * Body: { platform: "nextcloud-talk", url, user, pass }
 *      or { platform: "telegram", token }
 * Performs a live connection check using the supplied credentials and
 * returns a structured result so the Settings UI can show why a config is
 * (not) working. Does NOT use env-var fallback — the user wants to know
 * whether the creds THEY entered work.
 */
export async function messengerTestConnection(req: Request, res: Response) {
  const platform = String(req.body?.platform || "nextcloud-talk");

  if (platform === "nextcloud-talk") {
    let url = String(req.body?.url || "").replace(/\/+$/, "");
    if (url && !url.match(/^https?:\/\//)) url = `https://${url}`;
    const user = String(req.body?.user || "");
    const pass = String(req.body?.pass || "");
    if (!url || !user || !pass) {
      return res.status(400).json({ ok: false, error: "URL, gebruikersnaam en wachtwoord zijn verplicht" });
    }

    // Step 1 — capabilities probe (verifies URL reachable + a NextCloud).
    // Unauthenticated endpoint so we can distinguish "wrong host" from
    // "wrong credentials".
    try {
      const capUrl = `${url}/ocs/v2.php/cloud/capabilities`;
      const capResp = await fetch(capUrl, {
        method: "GET",
        headers: { "OCS-APIRequest": "true", Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (capResp.status === 404) {
        return res.json({ ok: false, error: "Geen NextCloud op dit adres (capabilities endpoint niet gevonden)" });
      }
      if (capResp.status >= 500) {
        return res.json({ ok: false, error: `NextCloud server gaf HTTP ${capResp.status}` });
      }
    } catch (err) {
      const msg = (err as Error).message || String(err);
      const friendly = msg.includes("ENOTFOUND") || msg.includes("EAI_AGAIN") ? "Hostnaam niet gevonden (DNS)"
        : msg.includes("ECONNREFUSED") ? "Verbinding geweigerd"
        : msg.includes("certificate") || msg.includes("CERT") ? "TLS-certificaat probleem"
        : msg.includes("abort") ? "Verbinding time-out"
        : msg;
      return res.json({ ok: false, error: `Kan ${url} niet bereiken: ${friendly}` });
    }

    // Step 2 — authenticated Talk endpoint. Distinguishes auth failure from
    // Talk-not-installed.
    try {
      const talkUrl = `${url}/ocs/v2.php/apps/spreed/api/v4/room`;
      const r = await fetch(talkUrl, {
        method: "GET",
        headers: {
          "OCS-APIRequest": "true",
          Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (r.status === 401) {
        return res.json({ ok: false, error: "Authenticatie mislukt — gebruikersnaam of app-wachtwoord onjuist" });
      }
      if (r.status === 404) {
        return res.json({ ok: false, error: "NextCloud Talk (Spreed) app niet geïnstalleerd of niet bereikbaar op deze server" });
      }
      if (r.status >= 500) {
        return res.json({ ok: false, error: `Talk API gaf HTTP ${r.status}` });
      }
      let json: any;
      try { json = await r.json(); } catch { return res.json({ ok: false, error: "Geen geldige JSON-respons van Talk API" }); }
      const conversations = Array.isArray(json?.ocs?.data) ? json.ocs.data : [];
      const unread = conversations.reduce((s: number, c: any) => s + (c.unreadMessages || 0), 0);
      return res.json({
        ok: true,
        message: `Verbonden met ${url} als ${user}`,
        conversations: conversations.length,
        unread,
        url,
        user,
      });
    } catch (err) {
      return res.json({ ok: false, error: `Talk API onbereikbaar: ${(err as Error).message || String(err)}` });
    }
  }

  if (platform === "telegram") {
    const token = String(req.body?.token || "");
    if (!token) return res.status(400).json({ ok: false, error: "Bot token vereist" });
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(8_000) });
      const json: any = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) {
        return res.json({ ok: false, error: json?.description || `HTTP ${r.status}` });
      }
      return res.json({
        ok: true,
        message: `Verbonden als @${json.result.username}`,
        botName: json.result.first_name,
        botUsername: json.result.username,
      });
    } catch (err) {
      return res.json({ ok: false, error: (err as Error).message || String(err) });
    }
  }

  return res.status(400).json({ ok: false, error: `Onbekend platform: ${platform}` });
}

export async function messengerListConversations(req: Request, res: Response) {
  const platform = req.query.platform as string;

  try {
    switch (platform) {
      case "nextcloud-talk": {
        const creds = resolveNcTalkCreds(req);
        if (!creds) {
          return res.status(400).json({ error: "Missende NextCloud Talk credentials. Stel NEXTCLOUD_TALK_URL, NEXTCLOUD_TALK_USER, NEXTCLOUD_TALK_PASS in of geef url, user, pass mee." });
        }
        const { ncUrl, user, pass } = creds;
        // Check cache first — keyed on URL+user so two callers using
        // different NextCloud accounts can never share an entry.
        const cacheKey = getConvoCacheKey("nextcloud-talk", `${ncUrl}|${user}`);
        const cached = conversationCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CONVO_CACHE_TTL) {
          // satisfies = gedeeld wire-contract met de desktop-adapter (api-shapes.ts).
          return res.json({ data: cached.conversations, cached: true } satisfies MessengerConversationsResponse);
        }
        const conversations = await ncListConversations(ncUrl, user, pass);
        conversationCache.set(cacheKey, { conversations, ts: Date.now() });
        return res.json({ data: conversations } satisfies MessengerConversationsResponse);
      }
      case "telegram": {
        const botToken = resolveTelegramToken(req);
        if (!botToken) {
          return res.status(400).json({ error: "Missende Telegram token. Stel TELEGRAM_BOT_TOKEN in of geef token mee." });
        }
        // Key by the full bot token. Was previously the literal string
        // "bot" — every caller shared one cache entry regardless of which
        // token they sent, leaking the first caller's conversations to all
        // subsequent ones. Bot tokens are never logged, full key is safe.
        const cacheKey = getConvoCacheKey("telegram", botToken);
        const cached = conversationCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CONVO_CACHE_TTL) {
          return res.json({ data: cached.conversations, cached: true });
        }
        const conversations = await tgListConversations(botToken);
        conversationCache.set(cacheKey, { conversations, ts: Date.now() });
        return res.json({ data: conversations });
      }
      case "ms-teams": {
        const email = req.query.email as string;
        if (!email) {
          return res.status(400).json({ error: "Missende parameter: email" });
        }
        const conversations = await teamsListConversations(req, email);
        return res.json({ data: conversations });
      }
      case "whatsapp":
        return res.json({ data: [], config: whatsappPlaceholder() });
      case "signal":
        return res.json({ data: [], config: signalPlaceholder() });
      default:
        return res.status(400).json({ error: `Onbekend platform: ${platform}` });
    }
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
}

export async function messengerGetMessages(req: Request, res: Response) {
  const platform = req.query.platform as string;
  const conversationId = req.query.conversation as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;
  const lookIntoFuture = req.query.lookIntoFuture === "1" || req.query.lookIntoFuture === "true";
  const lastKnownMessageId = req.query.lastKnownMessageId
    ? parseInt(req.query.lastKnownMessageId as string, 10)
    : undefined;

  if (!conversationId) {
    return res.status(400).json({ error: "Missende parameter: conversation" });
  }

  // Defensive: long-poll without a baseline causes NextCloud Talk to return
  // the entire chat history as if it just arrived — which fires playSound /
  // Notification / scroll for every batch in the client. Refuse the
  // combination so clients with a stale or unset `latestId` get a 400 they
  // can recover from, instead of flooding the user.
  if (lookIntoFuture && !lastKnownMessageId) {
    return res.status(400).json({
      error: "lookIntoFuture=1 requires lastKnownMessageId — long-poll needs a baseline",
    });
  }

  try {
    switch (platform) {
      case "nextcloud-talk": {
        const creds = resolveNcTalkCreds(req);
        if (!creds) {
          return res.status(400).json({ error: "Missende NextCloud Talk credentials" });
        }
        const { ncUrl, user, pass } = creds;
        const result = await ncGetMessages(ncUrl, user, pass, conversationId, {
          limit,
          // For history loading the frontend sends `before`. For long-poll
          // it sends `lastKnownMessageId` + `lookIntoFuture=1`.
          lastKnownMessageId: lookIntoFuture ? lastKnownMessageId : before,
          lookIntoFuture,
        });
        return res.json({ data: result.messages, hasMore: result.hasMore, lastGivenId: result.lastGivenId } satisfies MessengerMessagesResponse);
      }
      case "telegram": {
        const botToken = resolveTelegramToken(req);
        if (!botToken) {
          return res.status(400).json({ error: "Missende Telegram token" });
        }
        const messages = await tgGetMessages(botToken, conversationId);
        return res.json({ data: messages });
      }
      case "ms-teams": {
        const email = req.query.email as string;
        if (!email) {
          return res.status(400).json({ error: "Missende parameter: email" });
        }
        const messages = await teamsGetMessages(req, email, conversationId);
        return res.json({ data: messages });
      }
      case "whatsapp":
        return res.json({ data: [], config: whatsappPlaceholder() });
      case "signal":
        return res.json({ data: [], config: signalPlaceholder() });
      default:
        return res.status(400).json({ error: `Onbekend platform: ${platform}` });
    }
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
}

export async function messengerSendMessage(req: Request, res: Response) {
  const platform = req.body.platform || req.query.platform;
  const conversationId = req.body.conversation || req.query.conversation;
  const message = req.body.message;
  const replyTo = (req.body.replyTo || req.query.replyTo) as string | undefined; // M2

  if (!conversationId || !message) {
    return res.status(400).json({ error: "Missende parameters: conversation, message" });
  }

  try {
    switch (platform) {
      case "nextcloud-talk": {
        const creds = resolveNcTalkCreds(req);
        if (!creds) {
          return res.status(400).json({ error: "Missende NextCloud Talk credentials" });
        }
        const { ncUrl, user, pass } = creds;
        await ncSendMessage(ncUrl, user, pass, conversationId, message, replyTo);
        return res.json({ ok: true });
      }
      case "telegram": {
        const botToken = resolveTelegramToken(req);
        if (!botToken) {
          return res.status(400).json({ error: "Missende Telegram token" });
        }
        const result = await tgSendMessage(botToken, conversationId, message);
        return res.json({ ok: true, data: result });
      }
      case "ms-teams": {
        const email = (req.body.email || req.query.email) as string;
        if (!email) {
          return res.status(400).json({ error: "Missende parameter: email" });
        }
        await teamsSendMessage(req, email, conversationId, message);
        return res.json({ ok: true });
      }
      case "whatsapp":
        return res.json({ ok: false, config: whatsappPlaceholder() });
      case "signal":
        return res.json({ ok: false, config: signalPlaceholder() });
      default:
        return res.status(400).json({ error: `Onbekend platform: ${platform}` });
    }
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
}

/** Load conversations from ALL configured platforms in parallel */
export async function messengerAllConversations(req: Request, res: Response) {
  const results: Conversation[] = [];
  const errors: string[] = [];
  const tasks: Promise<void>[] = [];

  // NextCloud Talk — try env vars first, then query params
  const ncCreds = resolveNcTalkCreds(req);
  if (ncCreds) {
    const cacheKey = getConvoCacheKey("nextcloud-talk", `${ncCreds.ncUrl}|${ncCreds.user}`);
    const cached = conversationCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CONVO_CACHE_TTL) {
      results.push(...cached.conversations);
    } else {
      tasks.push(
        ncListConversations(ncCreds.ncUrl, ncCreds.user, ncCreds.pass)
          .then(convos => {
            conversationCache.set(cacheKey, { conversations: convos, ts: Date.now() });
            results.push(...convos);
          })
          .catch(err => errors.push(`NextCloud: ${err.message}`))
      );
    }
  }

  // Telegram — try env var first, then query param
  const tgToken = resolveTelegramToken(req);
  if (tgToken) {
    const cacheKey = getConvoCacheKey("telegram", tgToken);
    const cached = conversationCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CONVO_CACHE_TTL) {
      results.push(...cached.conversations);
    } else {
      tasks.push(
        tgListConversations(tgToken)
          .then(convos => {
            conversationCache.set(cacheKey, { conversations: convos, ts: Date.now() });
            results.push(...convos);
          })
          .catch(err => errors.push(`Telegram: ${err.message}`))
      );
    }
  }

  // MS Teams
  const email = req.query.email as string;
  if (email) {
    tasks.push(
      teamsListConversations(req, email)
        .then(convos => results.push(...convos))
        .catch(err => errors.push(`MS Teams: ${err.message}`))
    );
  }

  await Promise.all(tasks);

  // Sort: pinned first, then by last message time (newest first)
  results.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return tb - ta;
  });

  res.json({ data: results, errors: errors.length ? errors : undefined });
}

export async function messengerReact(req: Request, res: Response) {
  const platform = req.body.platform || req.query.platform;
  const conversationId = req.body.conversation || req.query.conversation;
  const messageId = req.body.messageId;
  const reaction = req.body.reaction || "\u{1F44D}"; // default: thumbs up
  const remove = req.body.remove === true;

  if (!conversationId || !messageId) {
    return res.status(400).json({ error: "Missende parameters: conversation, messageId" });
  }

  try {
    switch (platform) {
      case "nextcloud-talk": {
        const creds = resolveNcTalkCreds(req);
        if (!creds) {
          return res.status(400).json({ error: "Missende NextCloud Talk credentials" });
        }
        const { ncUrl, user, pass } = creds;
        if (remove) {
          await ncRemoveReaction(ncUrl, user, pass, conversationId, messageId, reaction);
        } else {
          await ncReactToMessage(ncUrl, user, pass, conversationId, messageId, reaction);
        }
        return res.json({ ok: true });
      }
      default:
        return res.status(400).json({ error: `Reacties niet ondersteund voor ${platform}` });
    }
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
}

export async function messengerEditMessage(req: Request, res: Response) {
  const platform = req.body.platform || req.query.platform;
  const conversationId = req.body.conversation || req.query.conversation;
  const messageId = req.body.messageId;
  const message = req.body.message;

  if (!conversationId || !messageId || typeof message !== "string") {
    return res.status(400).json({ error: "Missende parameters: conversation, messageId, message" });
  }

  try {
    switch (platform) {
      case "nextcloud-talk": {
        const creds = resolveNcTalkCreds(req);
        if (!creds) {
          return res.status(400).json({ error: "Missende NextCloud Talk credentials" });
        }
        const { ncUrl, user, pass } = creds;
        const result = await ncEditMessage(ncUrl, user, pass, conversationId, messageId, message);
        if (result.status >= 400) {
          const ocsMessage = result.data?.ocs?.meta?.message || `HTTP ${result.status}`;
          return res.status(result.status === 405 || result.status === 403 ? 403 : 502).json({ error: ocsMessage });
        }
        return res.json({ ok: true });
      }
      default:
        return res.status(400).json({ error: `Bewerken niet ondersteund voor ${platform}` });
    }
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
}

export async function messengerDeleteMessage(req: Request, res: Response) {
  const platform = req.body.platform || req.query.platform;
  const conversationId = req.body.conversation || req.query.conversation;
  const messageId = req.body.messageId;

  if (!conversationId || !messageId) {
    return res.status(400).json({ error: "Missende parameters: conversation, messageId" });
  }

  try {
    switch (platform) {
      case "nextcloud-talk": {
        const creds = resolveNcTalkCreds(req);
        if (!creds) {
          return res.status(400).json({ error: "Missende NextCloud Talk credentials" });
        }
        const { ncUrl, user, pass } = creds;
        const result = await ncDeleteMessage(ncUrl, user, pass, conversationId, messageId);
        if (result.status >= 400) {
          const ocsMessage = result.data?.ocs?.meta?.message || `HTTP ${result.status}`;
          return res.status(result.status === 405 || result.status === 403 ? 403 : 502).json({ error: ocsMessage });
        }
        return res.json({ ok: true });
      }
      default:
        return res.status(400).json({ error: `Verwijderen niet ondersteund voor ${platform}` });
    }
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
}

export async function messengerMarkRead(req: Request, res: Response) {
  const platform = req.body.platform || req.query.platform;
  const conversationId = req.body.conversation || req.query.conversation;

  if (!conversationId) {
    return res.status(400).json({ error: "Missende parameter: conversation" });
  }

  try {
    switch (platform) {
      case "nextcloud-talk": {
        const creds = resolveNcTalkCreds(req);
        if (!creds) {
          return res.status(400).json({ error: "Missende NextCloud Talk credentials" });
        }
        const { ncUrl, user, pass } = creds;
        const lastReadRaw = req.body?.lastReadMessage ?? req.body?.messageId;
        const lastRead = lastReadRaw !== undefined ? parseInt(String(lastReadRaw), 10) : NaN;
        await ncMarkRead(ncUrl, user, pass, conversationId, Number.isFinite(lastRead) ? lastRead : undefined);
        // The conversation list is cached server-side for CONVO_CACHE_TTL. Right
        // after a mark-read that cache still holds the pre-read unread count, so
        // the very next all-conversations poll (incl. BackgroundSyncProvider's
        // sidebar-badge poll) would re-show the badge we just cleared. Drop the
        // NC entry so the next fetch reflects the fresh read marker.
        conversationCache.delete(getConvoCacheKey("nextcloud-talk", `${ncUrl}|${user}`));
        return res.json({ ok: true });
      }
      case "telegram":
        // Telegram Bot API doesn't have a "mark as read" concept
        return res.json({ ok: true, note: "Telegram bots markeren niet als gelezen" });
      case "ms-teams":
        // Graph API doesn't have a simple mark-read for chats
        return res.json({ ok: true });
      case "whatsapp":
        return res.json({ ok: false, config: whatsappPlaceholder() });
      case "signal":
        return res.json({ ok: false, config: signalPlaceholder() });
      default:
        return res.status(400).json({ error: `Onbekend platform: ${platform}` });
    }
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
}

/**
 * Proxy file downloads from NextCloud Talk.
 * Authenticates with NC credentials so the browser doesn't need them.
 */
/**
 * Upload a file to NextCloud and share it in a Talk conversation.
 * Expects multipart/form-data with fields: platform, conversation, url, user, pass
 * and a file field named "file".
 */
export async function messengerUploadFile(req: Request, res: Response) {
  const platform = req.body?.platform;
  if (platform !== "nextcloud-talk") {
    return res.status(400).json({ error: "File upload only supported for NextCloud Talk" });
  }

  const conversationId = req.body?.conversation;
  if (!conversationId) {
    return res.status(400).json({ error: "Missende parameter: conversation" });
  }

  const creds = resolveNcTalkCreds(req);
  if (!creds) {
    return res.status(400).json({ error: "Missende NextCloud Talk credentials" });
  }

  // Extract raw file from request body (sent as base64 JSON)
  const fileData = req.body?.fileData as string; // base64
  const fileName = req.body?.fileName as string || `paste-${Date.now()}.png`;
  const mimeType = req.body?.mimeType as string || "image/png";
  // Optionele caption — NC Talk 19+ rendert deze als bijschrift onder het plaatje
  // in dezelfde message bubble (via talkMetaData.caption).
  const caption = (req.body?.caption as string | undefined)?.trim() || "";
  const replyTo = (req.body?.replyTo as string | undefined) || "";

  if (!fileData) {
    return res.status(400).json({ error: "Missende parameter: fileData (base64)" });
  }

  const { ncUrl, user, pass } = creds;
  const authHeader = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

  const davTalkBase = `${ncUrl}/remote.php/dav/files/${encodeURIComponent(user)}/Talk`;

  try {
    // 0. Vind een vrije naam (NC-stijl: "naam (2).ext" bij botsing). Voorkomt
    //    twee bugs bij het hergebruiken van een naam in hetzelfde gesprek:
    //    (a) de PUT zou een eerder geüpload bestand overschrijven, en
    //    (b) het opnieuw delen van datzelfde pad geeft 403 "Pad is al gedeeld
    //        met dit gesprek". Bestaanscheck via PROPFIND Depth:0 (404 = vrij).
    const pathExists = async (name: string): Promise<boolean> => {
      const r = await fetch(`${davTalkBase}/${encodeURIComponent(name)}`, {
        method: "PROPFIND",
        headers: { Authorization: authHeader, Depth: "0" },
        signal: AbortSignal.timeout(10_000),
      });
      await r.text().catch(() => {}); // body consumeren (undici)
      if (r.status === 404) return false;
      if (r.status >= 200 && r.status < 300) return true;
      // Onbekende status (bv. 405/5xx): niet kunnen vaststellen → gooi door,
      // zodat we terugvallen op een gegarandeerd-unieke naam i.p.v. te loopen.
      throw new Error(`PROPFIND check faalde (${r.status})`);
    };

    let finalName: string;
    try {
      finalName = await nextFreeUploadName(fileName, pathExists);
    } catch {
      // Kon geen vrije genummerde naam vinden (botsings-storm of check-fout):
      // val terug op een gegarandeerd-unieke naam zodat de upload niet faalt.
      const dot = fileName.lastIndexOf(".");
      const base = dot > 0 ? fileName.slice(0, dot) : fileName;
      const ext = dot > 0 ? fileName.slice(dot) : "";
      finalName = `${base} (${Date.now()})${ext}`;
    }

    // 1. Upload file to NextCloud via WebDAV
    const remotePath = `/remote.php/dav/files/${encodeURIComponent(user)}/Talk/${encodeURIComponent(finalName)}`;
    const uploadResp = await fetch(`${ncUrl}${remotePath}`, {
      method: "PUT",
      headers: {
        Authorization: authHeader,
        "Content-Type": mimeType,
      },
      body: Buffer.from(fileData, "base64"),
      signal: AbortSignal.timeout(30_000),
    });

    if (!uploadResp.ok && uploadResp.status !== 201 && uploadResp.status !== 204) {
      const text = await uploadResp.text().catch(() => "");
      return res.status(502).json({ error: `WebDAV upload failed (${uploadResp.status}): ${text.slice(0, 200)}` });
    }

    // 2. Share the file in the Talk conversation via OCS Share API
    // Met talkMetaData.caption: NC Talk 19+ rendert tekst onder het plaatje in
    // dezelfde message bubble (i.p.v. een separaat tekstbericht eronder).
    // Met talkMetaData.replyTo: hangt de share aan een parent message.
    const shareBody: Record<string, string> = {
      path: `/Talk/${finalName}`,
      shareType: "10", // Share to Talk conversation
      shareWith: conversationId,
    };
    const talkMetaData: Record<string, string> = {};
    if (caption) talkMetaData.caption = caption;
    if (replyTo) talkMetaData.replyTo = replyTo;
    if (Object.keys(talkMetaData).length > 0) {
      shareBody.talkMetaData = JSON.stringify(talkMetaData);
    }
    const ocsShareResp = await fetch(`${ncUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "OCS-APIRequest": "true",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(shareBody).toString(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!ocsShareResp.ok) {
      const text = await ocsShareResp.text().catch(() => "");
      return res.status(502).json({ error: `Share failed (${ocsShareResp.status}): ${text.slice(0, 200)}` });
    }

    return res.json({ ok: true, fileName: finalName });
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
}

/* ─── Server-side LRU cache voor NC file-proxy previews ──────────────────
 * Browser-cache (Cache-Control: max-age=3600) helpt al voor de tweede
 * fetch in dezelfde browser-sessie. Maar:
 *   - Een fresh tab / hard-refresh / private window mist die cache.
 *   - Een nieuwe device (telefoon, andere browser) idem.
 *   - Multi-user shared mailbox: collega's halen identieke previews op.
 * Met server-side cache delen ALLE clients dezelfde warmte. 15 min TTL is
 * meer dan genoeg voor chat-bubble previews (de URL bevat fileId, dus na
 * file-replace komt sowieso een andere URL). Cap op 200 MB per server
 * voorkomt onbeperkte groei. */
interface FileProxyCacheEntry { buffer: Buffer; contentType: string; ts: number; bytes: number }
const fileProxyCache = new Map<string, FileProxyCacheEntry>();
const FILE_PROXY_CACHE_TTL = 15 * 60_000;
const FILE_PROXY_CACHE_MAX_BYTES = 200 * 1024 * 1024; // 200 MB
let fileProxyCacheBytes = 0;

function fileProxyCacheKey(fileUrl: string, user: string): string {
  // Include user-id in de key zodat shared-mailbox-collega's de cache
  // niet over elkaar heen leggen (zelfde fileId, andere auth-scope).
  return `${user}::${fileUrl}`;
}

function fileProxyCacheEvictExpired(): void {
  const now = Date.now();
  for (const [k, v] of fileProxyCache) {
    if (now - v.ts > FILE_PROXY_CACHE_TTL) {
      fileProxyCacheBytes -= v.bytes;
      fileProxyCache.delete(k);
    }
  }
}

function fileProxyCacheEvictLRU(): void {
  while (fileProxyCacheBytes > FILE_PROXY_CACHE_MAX_BYTES) {
    const first = fileProxyCache.keys().next().value;
    if (first === undefined) break;
    const entry = fileProxyCache.get(first);
    if (entry) fileProxyCacheBytes -= entry.bytes;
    fileProxyCache.delete(first);
  }
}

export async function messengerFileProxy(req: Request, res: Response) {
  // Accept fileUrl param (preferred) or url param for backwards compat
  const fileUrl = (req.query.fileUrl || req.query.url) as string;
  if (!fileUrl) return res.status(400).json({ error: "Missing fileUrl parameter" });

  // Wave 0a race-recovery: file-proxy URLs zitten in <img src=> tags die
  // direct vuren bij render. Eerste keer dat Messenger laadt, kan deze
  // fetch arriveren VOORDAT de WS subscribe-messenger handshake klaar is
  // — cache nog leeg, en omdat we creds niet meer in URL meesturen krijg
  // je 400's voor elke preview. Wacht max 300 ms (in stappen van 30 ms)
  // tot subscribe-messenger het cache-slot heeft gevuld voor we opgeven.
  let creds = resolveNcTalkCreds(req);
  if (!creds) {
    const start = Date.now();
    while (Date.now() - start < 300) {
      await new Promise((r) => setTimeout(r, 30));
      creds = resolveNcTalkCreds(req);
      if (creds) break;
    }
  }
  if (!creds) return res.status(400).json({ error: "Missing NextCloud credentials" });

  const cacheKey = fileProxyCacheKey(fileUrl, creds.user);
  const cached = fileProxyCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < FILE_PROXY_CACHE_TTL) {
    // LRU touch: re-insert om Map iteration-order op recent-used te houden.
    fileProxyCache.delete(cacheKey);
    fileProxyCache.set(cacheKey, cached);
    res.setHeader("Content-Type", cached.contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Cache", "HIT");
    return res.send(cached.buffer);
  }

  try {
    const response = await fetch(fileUrl, {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${creds.user}:${creds.pass}`).toString("base64"),
      },
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "Failed to fetch file" });
    }

    const contentType =
      response.headers.get("Content-Type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());

    // Sla op in cache (alleen voor previews/images, niet voor grote
    // bestanden om geheugen te sparen — limit op 5 MB per entry).
    if (buffer.byteLength <= 5 * 1024 * 1024) {
      fileProxyCacheEvictExpired();
      fileProxyCache.set(cacheKey, { buffer, contentType, ts: Date.now(), bytes: buffer.byteLength });
      fileProxyCacheBytes += buffer.byteLength;
      fileProxyCacheEvictLRU();
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Cache", "MISS");
    res.send(buffer);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}

/**
 * Create a new NextCloud Talk conversation.
 * Body: { roomType: 1|2|3, invite: "userId", roomName?: "Group name" }
 * roomType: 1 = one-to-one, 2 = group, 3 = public
 * invite: NextCloud user ID for 1-on-1, or omit for group (add participants after)
 */
export async function messengerCreateConversation(req: Request, res: Response) {
  const creds = resolveNcTalkCreds(req);
  if (!creds) return res.status(400).json({ error: "Missing NextCloud credentials" });

  const { roomType, invite, roomName } = req.body as { roomType?: number; invite?: string; roomName?: string };
  if (!roomType) return res.status(400).json({ error: "Missing roomType (1=one-to-one, 2=group, 3=public)" });

  try {
    const params = new URLSearchParams();
    params.set("roomType", String(roomType));
    if (invite) params.set("invite", invite);
    if (roomName) params.set("roomName", roomName);

    const result = await ncTalkRequest(
      creds.ncUrl, creds.user, creds.pass,
      `/ocs/v2.php/apps/spreed/api/v4/room?format=json`,
      "POST",
      params.toString()
    );

    if (result.status >= 400) {
      return res.status(result.status).json({ error: result.data?.ocs?.meta?.message || "Failed to create conversation" });
    }

    const room = result.data?.ocs?.data;
    res.json({
      ok: true,
      conversation: {
        id: room?.token,
        name: room?.displayName || roomName || invite || "",
        type: ncConversationTypeLabel(room?.type || roomType),
      },
    });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}

/**
 * Add a participant to an existing NextCloud Talk conversation.
 * Body: { conversation: "token", userId: "nextcloud-user-id" }
 */
export async function messengerAddParticipant(req: Request, res: Response) {
  const creds = resolveNcTalkCreds(req);
  if (!creds) return res.status(400).json({ error: "Missing NextCloud credentials" });

  const { conversation, userId } = req.body as { conversation?: string; userId?: string };
  if (!conversation || !userId) return res.status(400).json({ error: "Missing conversation or userId" });

  try {
    const params = new URLSearchParams();
    params.set("newParticipant", userId);
    params.set("source", "users");

    const result = await ncTalkRequest(
      creds.ncUrl, creds.user, creds.pass,
      `/ocs/v2.php/apps/spreed/api/v4/room/${encodeURIComponent(conversation)}/participants?format=json`,
      "POST",
      params.toString()
    );

    if (result.status >= 400) {
      return res.status(result.status).json({ error: result.data?.ocs?.meta?.message || "Failed to add participant" });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}
