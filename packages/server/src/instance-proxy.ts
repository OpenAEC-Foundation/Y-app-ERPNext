/**
 * Per-instance ERPNext proxy.
 *
 * For each (Y-app user, instance) pair, this module maintains an in-memory
 * cache of the active ERPNext sid. When the cache is empty (server just
 * started, or first request to that instance), it decrypts the stored
 * credentials and logs into ERPNext to get a fresh sid.
 *
 * Routes mounted at `/api/i/:instanceId/*` in `index.ts` use `proxyToInstance`
 * to forward requests transparently. The path after `/api/i/:instanceId/`
 * becomes the path after `/api/` on the target ERPNext instance.
 *
 * Caveats (Phase 3 limits):
 *   - JSON bodies only. Multipart / file uploads are not yet proxied.
 *   - No automatic retry on 401 (sid expired) yet — caller has to invalidate
 *     and retry. Will be added in a follow-up.
 *   - No WebSocket proxying.
 */

import type { Request, Response } from "express";
import { loginToErpNext } from "./auth.ts";
import { getInstanceForUser, getDecryptedCredentials, getDecryptedApiCredentials } from "./instances.ts";
import type { Instance } from "./instances.ts";

interface InstanceSession {
  sid: string;
  /** When set (apikey-mode instances), forward this as the `Authorization`
   * header instead of a session cookie. Format: `token api_key:api_secret`. */
  authHeader?: string;
  fullName?: string;
  roles?: string[];
  blockedModules?: string[];
  loggedInAt: number;
}

// Reduced from 23h to 4h. The TTL bounds the worst-case revocation lag:
// if an ERPNext admin removes a user from a Frappe site, that user can
// keep using Y-app for at most this long before the cached sid drops.
// 4h is "half a workday" — small enough to materially shrink the
// privilege-escalation window, large enough that an active user only
// pays the ERPNext-login latency 1-2 times during a typical workday.
// For instant revocation, call POST /api/instances/:id/invalidate-session.
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const sessionCache = new Map<string, InstanceSession>();

/**
 * Coalesces concurrent ERPNext logins for the same (user, instance).
 * Without this, two simultaneous requests arriving while the cache is
 * empty would each kick off a parallel `loginToErpNext()` call, hammer
 * ERPNext with redundant logins, and race to overwrite each other in
 * `sessionCache` — the second sid evicts the first, and the first
 * request gets served with a sid that's no longer the canonical one.
 *
 * The map holds the in-flight Promise; the first caller creates it,
 * every concurrent caller `await`s the same promise, and a `try/finally`
 * deletes the entry when the login resolves (success or failure).
 */
const loginInFlight = new Map<string, Promise<InstanceSession | null>>();

// Periodic cleanup of stale entries
setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [k, v] of sessionCache.entries()) {
    if (v.loggedInAt < cutoff) sessionCache.delete(k);
  }
}, 60 * 60 * 1000);

function cacheKey(yAppUserId: number, instanceId: number): string {
  return `${yAppUserId}:${instanceId}`;
}

/**
 * Get a working ERPNext sid for the given (Y-app user, instance) pair.
 * Uses the cached sid if fresh; otherwise decrypts the stored credentials
 * and logs into ERPNext to get a new one.
 *
 * Concurrent callers for the same (user, instance) coalesce on a single
 * in-flight login via `loginInFlight` — there is never more than one
 * ERPNext login attempt in flight per pair at any moment.
 */
export async function getOrCreateInstanceSession(
  yAppUserId: number,
  instance: Instance,
  userKey: Buffer,
  forceRelogin = false,
): Promise<InstanceSession | null> {
  const key = cacheKey(yAppUserId, instance.id);

  // Fast path — cached and fresh.
  if (!forceRelogin) {
    const cached = sessionCache.get(key);
    if (cached && Date.now() - cached.loggedInAt < SESSION_TTL_MS) {
      return cached;
    }
  }

  // Slow path — coalesce concurrent login attempts. If another call is
  // already mid-login for this same (user, instance), `await` its promise
  // instead of kicking off a parallel ERPNext login.
  const existing = loginInFlight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<InstanceSession | null> => {
    try {
      // apikey-mode (OpenAEC SuperCloud): no login, no sid — forward an
      // `Authorization: token api_key:api_secret` header on every request.
      if (instance.authMode === "apikey") {
        const api = getDecryptedApiCredentials(instance.id, yAppUserId, userKey);
        if (!api) {
          console.warn(`[instance-proxy] Failed to decrypt api creds for user=${yAppUserId} instance=${instance.id}`);
          return null;
        }
        const session: InstanceSession = {
          sid: "",
          authHeader: `token ${api.apiKey}:${api.apiSecret}`,
          loggedInAt: Date.now(),
        };
        sessionCache.set(key, session);
        return session;
      }

      const creds = getDecryptedCredentials(instance.id, yAppUserId, userKey);
      if (!creds) {
        console.warn(`[instance-proxy] Failed to decrypt credentials for user=${yAppUserId} instance=${instance.id}`);
        return null;
      }

      const result = await loginToErpNext(creds.username, creds.password, instance.url);
      if (!result.ok || !result.sid) {
        console.warn(`[instance-proxy] ERPNext login failed for instance=${instance.id} (${instance.url}): ${result.error}`);
        return null;
      }

      const session: InstanceSession = {
        sid: result.sid,
        fullName: result.fullName,
        roles: result.roles,
        blockedModules: result.blockedModules,
        loggedInAt: Date.now(),
      };
      sessionCache.set(key, session);
      return session;
    } finally {
      // Always clear the in-flight slot, even if login throws — otherwise
      // a transient ERPNext outage would leave a permanently-stuck slot
      // and every subsequent caller would `await` a rejected promise.
      loginInFlight.delete(key);
    }
  })();

  loginInFlight.set(key, promise);
  return promise;
}

/** Force a fresh login next time the instance is accessed (e.g., after 401). */
export function invalidateInstanceSession(yAppUserId: number, instanceId: number): void {
  sessionCache.delete(cacheKey(yAppUserId, instanceId));
}

/** Strip hop-by-hop and other headers we should NOT forward to upstream. */
const HOP_BY_HOP_HEADERS = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "content-length", "cookie",
]);

/** Headers we should NOT pass through from upstream back to the client. */
const RESPONSE_STRIP_HEADERS = new Set([
  "transfer-encoding", "connection", "content-encoding", "set-cookie", "content-length",
]);

/**
 * Proxy a single request to a specific ERPNext instance using the given session.
 * The path inside ERPNext is everything after `/api/i/:instanceId/`, prepended
 * with `/api/`.
 *
 * Example mapping:
 *   client request: GET /api/i/5/method/frappe.client.get?doctype=User&name=foo
 *   forwarded to:   GET https://acme.example.com/api/method/frappe.client.get?doctype=User&name=foo
 */
export async function proxyToInstance(
  req: Request,
  res: Response,
  instance: Instance,
  session: InstanceSession,
  pathInsideErpNext: string,
): Promise<void> {
  const targetUrl = new URL(`${instance.url}/api${pathInsideErpNext}`);
  const originalQuery = req.url.split("?")[1];
  if (originalQuery) targetUrl.search = "?" + originalQuery;

  // Build forwarded headers. apikey-mode instances authenticate with an
  // Authorization token; password-mode instances carry the ERPNext sid cookie.
  const forwardedHeaders: Record<string, string> = {
    Accept: (req.headers.accept as string) || "application/json",
  };
  if (session.authHeader) {
    forwardedHeaders["Authorization"] = session.authHeader;
  } else {
    forwardedHeaders["Cookie"] = session.sid;
  }
  if (req.headers["content-type"]) {
    forwardedHeaders["Content-Type"] = req.headers["content-type"] as string;
  }
  // Pass through any other safe headers
  for (const [name, value] of Object.entries(req.headers)) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (lower in forwardedHeaders) continue;
    if (lower.startsWith("x-")) {
      forwardedHeaders[name] = Array.isArray(value) ? value.join(", ") : (value as string);
    }
  }

  // Body for non-GET/HEAD
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.body && Object.keys(req.body).length > 0) {
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: forwardedHeaders,
      body,
      redirect: "manual",
    });
  } catch (err) {
    console.error(`[instance-proxy] Upstream fetch failed for instance=${instance.id}:`, (err as Error).message);
    res.status(502).json({ error: `Instance unreachable: ${(err as Error).message}` });
    return;
  }

  // Stream response back
  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (RESPONSE_STRIP_HEADERS.has(key.toLowerCase())) return;
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}

/**
 * Like getOrCreateInstanceSession but always forces a fresh login. Used by
 * the auto-retry-on-401 logic when a cached sid has expired upstream.
 */
export async function refreshInstanceSession(
  yAppUserId: number,
  instance: Instance,
  userKey: Buffer,
): Promise<InstanceSession | null> {
  invalidateInstanceSession(yAppUserId, instance.id);
  return getOrCreateInstanceSession(yAppUserId, instance, userKey);
}

/** Diagnostic: how many cached instance sessions are currently held. */
export function getCacheSize(): number {
  return sessionCache.size;
}
