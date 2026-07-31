import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";
import { homedir } from "os";

export const ERPNEXT_URL = process.env.ERPNEXT_URL || "";

// Reasons that authMiddleware can fail. Mirrored in the frontend at
// packages/frontend/src/lib/auth-reasons.ts — the two packages don't share
// types, so the string values must stay in lockstep manually.
export type AuthReason =
  | "missing_session"
  | "missing_instance"
  | "session_invalid"
  | "instance_not_found"
  | "instance_unavailable";

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// ─── SQLite session store ───

const dbDir = process.env.ERPNEXT_LEVEL_CONFIG_DIR || join(homedir(), ".erpnext-level");
mkdirSync(dbDir, { recursive: true });
const db = new Database(join(dbDir, "sessions.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    erpnext_sid TEXT NOT NULL,
    username TEXT NOT NULL,
    full_name TEXT NOT NULL,
    roles TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  )
`);

const stmtInsert = db.prepare("INSERT INTO sessions (id, erpnext_sid, username, full_name, roles, created_at) VALUES (?, ?, ?, ?, ?, ?)");
const stmtGet = db.prepare("SELECT * FROM sessions WHERE id = ? AND created_at > ?");
const stmtDelete = db.prepare("DELETE FROM sessions WHERE id = ?");
const stmtCleanup = db.prepare("DELETE FROM sessions WHERE created_at <= ?");

// Clean up expired sessions every 5 minutes
setInterval(() => {
  stmtCleanup.run(Date.now() - SESSION_MAX_AGE);
}, 5 * 60 * 1000);

export interface Session {
  erpnextSid: string;
  username: string;
  fullName: string;
  roles: string[];
}

/**
 * Authenticate against an ERPNext instance with username/password, fetch
 * roles + full name. Defaults to the global ERPNEXT_URL for the legacy
 * single-instance flow; multi-instance callers pass the target URL.
 */
export async function loginToErpNext(
  usr: string,
  pwd: string,
  targetUrl: string = ERPNEXT_URL,
): Promise<{ ok: boolean; sid?: string; fullName?: string; roles?: string[]; blockedModules?: string[]; error?: string }> {
  if (!targetUrl) {
    return { ok: false, error: "No ERPNext URL configured" };
  }
  try {
    const res = await fetch(`${targetUrl}/api/method/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ usr, pwd }),
      redirect: "manual",
    });

    const cookies = res.headers.getSetCookie?.() || [];
    let sid = "";
    for (const c of cookies) {
      const match = c.match(/sid=([^;]+)/);
      if (match) { sid = `sid=${match[1]}`; break; }
    }
    if (!sid || sid === "sid=Guest") {
      return { ok: false, error: "Invalid credentials" };
    }

    // Fetch full name and module permissions from the User doctype.
    // Note: frappe.auth.get_logged_user only returns the user id (email),
    // NOT the full name — that lives in the User doc.
    let fullName = usr;
    let allowedModules: string[] = [];
    try {
      const userRes = await fetch(
        `${targetUrl}/api/method/frappe.client.get?doctype=User&name=${encodeURIComponent(usr)}`,
        { headers: { Cookie: sid, Accept: "application/json" } }
      );
      if (userRes.ok) {
        const userData = await userRes.json() as { message?: { full_name?: string; first_name?: string; last_name?: string; block_modules?: Array<{ module: string }> } };
        const u = userData.message;
        if (u) {
          fullName = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || usr;
          // B02: Extract allowed modules (ERPNext stores block_modules as a child table)
          if (Array.isArray(u.block_modules)) {
            allowedModules = u.block_modules.map((m) => m.module);
          }
        }
      } else {
        console.warn(`[auth] User doc fetch failed: HTTP ${userRes.status} for ${usr}`);
      }
    } catch (err) {
      console.warn(`[auth] User doc fetch error for ${usr}:`, (err as Error).message);
    }

    // Fetch user roles via the dedicated whitelisted endpoint.
    // Note: querying the "Has Role" doctype directly fails with PermissionError
    // for non-System Manager users — use frappe.core.doctype.user.user.get_roles
    // which is whitelisted and accepts a `uid` parameter.
    let roles: string[] = [];
    try {
      const rolesRes = await fetch(
        `${targetUrl}/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(usr)}`,
        { headers: { Cookie: sid, Accept: "application/json" } }
      );
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json() as { message?: string[] };
        roles = Array.isArray(rolesData.message) ? rolesData.message : [];
      } else {
        console.warn(`[auth] get_roles failed: HTTP ${rolesRes.status} for ${usr}`);
      }
    } catch (err) {
      console.warn(`[auth] get_roles error for ${usr}:`, (err as Error).message);
    }

    return { ok: true, sid, fullName, roles, blockedModules: allowedModules };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Create a new session and return the session ID */
export function createSession(erpnextSid: string, username: string, fullName: string, roles: string[] = []): string {
  const sessionId = randomUUID();
  stmtInsert.run(sessionId, erpnextSid, username, fullName, JSON.stringify(roles), Date.now());
  return sessionId;
}

export function getSession(sessionId: string): Session | undefined {
  const row = stmtGet.get(sessionId, Date.now() - SESSION_MAX_AGE) as any;
  if (!row) return undefined;
  return {
    erpnextSid: row.erpnext_sid,
    username: row.username,
    fullName: row.full_name,
    roles: JSON.parse(row.roles || "[]"),
  };
}

export function deleteSession(sessionId: string): void {
  stmtDelete.run(sessionId);
}

/**
 * Express middleware that gates legacy `/api/*` routes.
 *
 * Bridged Y-app multi-instance: y_app_session cookie + X-Y-App-Instance
 * header → recover the user's encryption key, look up the per-instance
 * ERPNext session via the proxy cache (logging in if needed), inject
 * the sid into `req`, AND set the per-request URL via AsyncLocalStorage
 * so erpnext-client.ts targets the right ERPNext instance. The bridge
 * also wires up an auto-retry callback for 401s from upstream.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const yAppSid = (req as any).cookies?.y_app_session;
  const instanceHeader = req.headers["x-y-app-instance"];

  // Track the failure reason so the 401 at the bottom can carry an
  // actionable code instead of a generic "Unauthorized". The frontend
  // distinguishes "session_invalid" (force re-login) from
  // "instance_unavailable" (show banner, don't kick the user out).
  // KEEP IN SYNC with AUTH_REASON in packages/frontend/src/lib/auth-reasons.ts —
  // no compile-time link between the packages, so a typo here will silently
  // diverge from the frontend consumer.
  let reason: AuthReason = "missing_session";

  if (!yAppSid) {
    reason = "missing_session";
  } else if (!instanceHeader) {
    reason = "missing_instance";
  } else {
    const instanceId = parseInt(Array.isArray(instanceHeader) ? instanceHeader[0] : String(instanceHeader), 10);
    if (!Number.isNaN(instanceId)) {
      try {
        // Lazy imports to avoid circular dependency at module load time
        const { getYAppSessionWithKey } = await import("./yapp-auth.ts");
        const { getInstanceForUser } = await import("./instances.ts");
        const { getOrCreateInstanceSession, refreshInstanceSession } = await import("./instance-proxy.ts");
        const { erpRequestContext } = await import("./erpnext-client.ts");

        const sessionData = getYAppSessionWithKey(String(yAppSid));
        if (!sessionData) {
          reason = "session_invalid";
        } else {
          const instance = getInstanceForUser(instanceId, sessionData.user.id);
          if (!instance) {
            reason = "instance_not_found";
          } else {
            const erpSession = await getOrCreateInstanceSession(sessionData.user.id, instance, sessionData.userKey);
            if (!erpSession) {
              reason = "instance_unavailable";
            } else {
              (req as any).erpnextSid = erpSession.sid;
              (req as any).username = sessionData.user.email;
              (req as any).fullName = erpSession.fullName || sessionData.user.email;
              (req as any).roles = erpSession.roles || [];
              (req as any).instanceId = instance.id;
              (req as any).instanceUrl = instance.url;
              // Expose the Y-app user id + decryption key so credential-bearing
              // routes (e.g. /api/mail/*) can read the encrypted mail-account
              // vault (mail_accounts) without a second middleware. getCredentials
              // uses these to decrypt the account referenced by ?account=<id>.
              (req as any).yAppUserId = sessionData.user.id;
              (req as any).yAppUserKey = sessionData.userKey;
              // Run the rest of the request inside a context that scopes the
              // ERPNext URL AND provides a refresh callback for auto-retry on 401.
              const sidHolder = { current: erpSession.sid };
              erpRequestContext.run(
                {
                  url: instance.url,
                  sidHolder,
                  refreshSid: async () => {
                    const fresh = await refreshInstanceSession(sessionData.user.id, instance, sessionData.userKey);
                    if (fresh) {
                      sidHolder.current = fresh.sid;
                      (req as any).erpnextSid = fresh.sid;
                      return fresh.sid;
                    }
                    return null;
                  },
                },
                () => next(),
              );
              return;
            }
          }
        }
      } catch (err) {
        console.error("[auth] bridged Y-app auth failed:", (err as Error).message);
      }
    }
  }

  // session_invalid + missing_session → real 401, frontend redirects to /login.
  // instance_unavailable + instance_not_found → 502, frontend keeps the user
  // logged in and surfaces an instance-level banner.
  const status = (reason === "instance_unavailable" || reason === "instance_not_found") ? 502 : 401;
  res.status(status).json({ error: "Unauthorized", reason });
}
