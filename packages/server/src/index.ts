/**
 * Y-app — Backend
 *
 * - Single-instance web app with user authentication
 * - Proxies all ERPNext requests using the user's session cookie
 * - Auth via ERPNext login → server-side session → HttpOnly cookie
 */

import express from "express";
import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { perfTimingMiddleware } from "./middleware/timing.ts";

// In ESM (dev via tsx): derive __dirname from import.meta.url
// In CJS (esbuild bundle): esbuild injects __dirname automatically
let _serverDir: string;
try {
  _serverDir = dirname(fileURLToPath(import.meta.url));
} catch {
  _serverDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
}

import { ERPNEXT_URL, authMiddleware } from "./auth.ts";
import {
  signupYAppUser,
  verifyYAppLogin,
  createYAppSession,
  getYAppUserForSession,
  getYAppSessionWithKey,
  destroyYAppSession,
  setYAppSessionCookie,
  clearYAppSessionCookie,
  getYAppSessionId,
  AccountLockedError,
  findOrCreateSsoUser,
  storeSessionOidcTokens,
} from "./yapp-auth.ts";
import {
  isOpenAecSsoEnabled,
  getOpenAecSsoConfig,
  generatePkce,
  generateState,
  buildAuthorizeUrl,
  exchangeCode,
  fetchUserinfo,
} from "./openaec-sso.ts";
import { provisionFromOpenAec } from "./openaec-provision.ts";
import {
  listInstancesForUser,
  getInstanceForUser,
  addInstance,
  updateInstance,
  deleteInstance,
  testInstanceConnection,
  refreshInstanceVersion,
  setInstanceVersionOverride,
} from "./instances.ts";
import { getEffectiveVersion } from "./erpnext-version.ts";
import { db } from "./db.ts";
import { encryptWithKey, decryptToJson } from "./crypto.ts";
import {
  getOrCreateInstanceSession,
  proxyToInstance,
  invalidateInstanceSession,
} from "./instance-proxy.ts";
import { proxyRequest, erpRequestContext } from "./erpnext-client.ts";
import { handleAgentChat } from "./agent.ts";
import { handleTerminalConnection } from "./terminal.ts";
import { mailTestConnection, mailTestShared, mailListFolders, mailListMessages, mailGetMessage, mailGetBodies, mailGetAttachment, mailSend, mailDeleteMessage, mailMoveMessage, mailMoveMessageCrossAccount, mailCreateFolder, mailDeleteFolder, mailWarmup, mailCacheStats, mailMarkRead, mailMarkUnread, mailRenameFolder, mailAutoConfig, mailStartupWarmup, mailIsWarm, mailListContacts, mailGetSignature, mailGetConversation, mailUpstreamHealth, testMailConnectionFromCreds } from "./mail.ts";
import type { MailCredentials } from "./mail.ts";
import {
  listMailAccounts, getMailAccount, addMailAccount, updateMailAccount,
  deleteMailAccount, getDecryptedMailCredentials, updateTestResult,
} from "./mail-accounts.ts";
import { nextcloudListFiles, nextcloudDownloadUrl, nextcloudDownload, nextcloudUpload, nextcloudCreateShareLink } from "./nextcloud.ts";
import { healthGetReport, healthRunTests, healthGetMail, healthGetMessenger, runAllTests } from "./health.ts";
import { messengerListConversations, messengerGetMessages, messengerSendMessage, messengerEditMessage, messengerDeleteMessage, messengerMarkRead, messengerAllConversations, messengerReact, messengerFileProxy, messengerUploadFile, messengerCreateConversation, messengerAddParticipant, messengerTestConnection, messengerSubscribe } from "./messenger.ts";
import { meetingsGet, meetingsCreate, meetingsUpdate, meetingsDelete } from "./meetings.ts";
import { handleProjectTemplateSuggest } from "./project-suggestions.ts";
import { calendarGetO365, calendarPatchO365, calendarDeleteO365, calendarGetICal, calendarPostEvent } from "./routes/calendar.ts";
import { statsUren, statsUrenDetail } from "./routes/stats.ts";
// Gedeeld wire-contract met de desktop fetch-adapter (Fase 5 drift-safety).
// Type-only — esbuild/tsx strippen dit weg; nul runtime-effect.
import type { MailUnseenSummaryResponse, UnseenFolderShape } from "../../frontend/src/lib/api-shapes.ts";

const PORT = parseInt(process.env.PORT || "3500", 10);

const app = express();
app.use(compression());
app.use(cors());
app.use(cookieParser());
// Mail send accepts forwarded attachments (re-base64'd) — needs higher limit
// than the global 10mb default. Must precede the global parser so this matcher
// drains the stream first and sets req._body, skipping the global parser.
app.use("/api/mail/send", express.json({ limit: "50mb" }));
app.use(express.json({ limit: "10mb" }));

// §7 Performance tooling: per-request duration logging (opt-in via env var).
// Statische import — esbuild bundelt naar CJS waarvan top-level await niet
// is toegestaan. Zie commit-history voor build-failure context.
app.use(perfTimingMiddleware);

// Rate limit login endpoint — 5 attempts per 15 minutes per IP.
// This is the per-IP first line of defence; per-account lockout in
// verifyYAppLogin handles the "rotating IPs against one account" case.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, try again in 15 minutes" },
});

// Per-Y-app-session limit on /api/instances/test, which triggers a real
// ERPNext login on any URL the caller provides. Without this, an attacker
// with a single Y-app session could use it as a brute-force proxy against
// arbitrary ERPNext sites. Keyed on session id (set by requireYAppSession
// upstream), so it's a per-account budget regardless of source IP.
const instanceTestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getYAppSessionId(req) || "anon",
  message: { error: "Too many instance test attempts, try again in a few minutes" },
});

// Static file serving is set up lazily in startServer() so that
// ERPNEXT_LEVEL_DIST can be set before evaluation.
let distDir = "";

/* ─── Auth endpoint (kept for compatibility — only the bridged path remains) ─── */

app.get("/api/auth/me", async (req, res) => {
  // Bridged Y-app session + X-Y-App-Instance header — looks up the
  // per-instance ERPNext session and returns its username/fullName/roles
  // so the Sidebar can apply role-based filtering.
  const yAppSid = getYAppSessionId(req);
  const instanceHeader = req.headers["x-y-app-instance"];
  if (yAppSid && instanceHeader) {
    const instanceId = parseInt(Array.isArray(instanceHeader) ? instanceHeader[0] : String(instanceHeader), 10);
    if (!Number.isNaN(instanceId)) {
      const sessionData = getYAppSessionWithKey(yAppSid);
      if (sessionData) {
        const instance = getInstanceForUser(instanceId, sessionData.user.id);
        if (instance) {
          const erpSession = await getOrCreateInstanceSession(sessionData.user.id, instance, sessionData.userKey);
          if (erpSession) {
            return res.json({
              username: sessionData.user.email,
              fullName: erpSession.fullName || sessionData.user.email,
              roles: erpSession.roles || [],
              blockedModules: erpSession.blockedModules || [],
            });
          }
        }
      }
    }
  }

  res.status(401).json({ error: "Not authenticated" });
});

/* ─── Y-app account endpoints (Phase 1: signup/login/logout/me) ─── */

// Stricter rate limit on signup to prevent enumeration / spam
const yAppSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signups from this IP, try again later" },
});

app.post("/api/yapp/signup", yAppSignupLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const result = await signupYAppUser(email, password);
    const sessionId = createYAppSession(result.user.id, result.userKey);
    setYAppSessionCookie(res, sessionId);
    res.json({ ok: true, user: result.user });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/yapp/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const result = await verifyYAppLogin(email, password);
    if (!result) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const sessionId = createYAppSession(result.user.id, result.userKey);
    setYAppSessionCookie(res, sessionId);
    res.json({ ok: true, user: result.user });
  } catch (err) {
    if (err instanceof AccountLockedError) {
      const retryAfterSec = Math.max(1, Math.ceil((err.until - Date.now()) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(423).json({
        error: "Account temporarily locked due to too many failed login attempts",
        retryAfter: retryAfterSec,
      });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/yapp/logout", (req, res) => {
  const sid = getYAppSessionId(req);
  destroyYAppSession(sid);
  clearYAppSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/yapp/me", (req, res) => {
  const sid = getYAppSessionId(req);
  const user = getYAppUserForSession(sid);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ user: { id: user.id, email: user.email } });
});

/* ─── OpenAEC SSO (Zitadel OIDC, Authorization Code + PKCE) ─── */

const SSO_STATE_COOKIE = "openaec_sso_state";
const SSO_VERIFIER_COOKIE = "openaec_sso_verifier";
const SSO_RETURN_COOKIE = "openaec_sso_return";
const SSO_TXN_MAX_AGE_MS = 5 * 60 * 1000; // login transaction cookies live 5 min

/**
 * Sanitise a ?returnTo= so the post-login redirect can only land on a path
 * INSIDE this app. Accept a relative path that starts with a single "/" (not
 * "//host" — that's a protocol-relative URL to another origin) and contains
 * no scheme. Anything else falls back to "/". This lets the SuperCloud portal
 * deep-link the Y-app tile to a specific view (e.g. /?app=webmail) while the
 * Zitadel session is reused, without becoming an open redirect.
 */
function safeReturnTo(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "/";
  // Must be a site-relative path; reject absolute URLs and protocol-relative.
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\")) return "/";
  if (/[\r\n]/.test(s)) return "/";
  return s;
}

function ssoTxnCookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: SSO_TXN_MAX_AGE_MS,
    path: "/api/auth/openaec",
  };
}

// Frontend asks this to decide whether to render the "Inloggen met OpenAEC" button.
app.get("/api/auth/openaec/config", (_req, res) => {
  res.json({ enabled: isOpenAecSsoEnabled() });
});

// Start login: generate PKCE + state, stash in short-lived cookies, redirect to Zitadel.
// Accepts an optional ?returnTo=<site-relative path> so the SuperCloud portal can
// deep-link the Y-app tile to a specific view; the path is sanitised and carried
// through a short-lived cookie (never through the OIDC state sent to Zitadel).
app.get("/api/auth/openaec/login", (req, res) => {
  const cfg = getOpenAecSsoConfig();
  if (!cfg) return res.status(503).json({ error: "OpenAEC SSO not configured" });
  const { verifier, challenge } = generatePkce();
  const state = generateState();
  res.cookie(SSO_STATE_COOKIE, state, ssoTxnCookieOpts());
  res.cookie(SSO_VERIFIER_COOKIE, verifier, ssoTxnCookieOpts());
  const returnTo = safeReturnTo(req.query.returnTo);
  if (returnTo !== "/") res.cookie(SSO_RETURN_COOKIE, returnTo, ssoTxnCookieOpts());
  res.redirect(buildAuthorizeUrl(cfg, state, challenge));
});

// Callback: verify state, exchange code, fetch userinfo, find/create user,
// create Y-app session, persist Zitadel tokens, drop the user on the app.
app.get("/api/auth/openaec/callback", async (req, res) => {
  const cfg = getOpenAecSsoConfig();
  if (!cfg) return res.status(503).send("OpenAEC SSO not configured");

  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const cookieState = (req.cookies && req.cookies[SSO_STATE_COOKIE]) || "";
  const verifier = (req.cookies && req.cookies[SSO_VERIFIER_COOKIE]) || "";
  const returnTo = safeReturnTo(req.cookies && req.cookies[SSO_RETURN_COOKIE]);

  // Clear the txn cookies regardless of outcome.
  res.clearCookie(SSO_STATE_COOKIE, { path: "/api/auth/openaec" });
  res.clearCookie(SSO_VERIFIER_COOKIE, { path: "/api/auth/openaec" });
  res.clearCookie(SSO_RETURN_COOKIE, { path: "/api/auth/openaec" });

  if (req.query.error) {
    console.warn(`[sso] provider error: ${req.query.error} ${req.query.error_description || ""}`);
    return res.redirect("/login?sso_error=provider");
  }
  if (!code || !state || !cookieState || state !== cookieState || !verifier) {
    return res.redirect("/login?sso_error=state");
  }

  try {
    const tokens = await exchangeCode(cfg, code, verifier);
    const info = await fetchUserinfo(cfg, tokens.accessToken);
    const { user, userKey } = findOrCreateSsoUser({ sub: info.sub, email: info.email, provider: "openaec" });
    const sessionId = createYAppSession(user.id, userKey);
    storeSessionOidcTokens(sessionId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresInSec: tokens.expiresInSec,
    });
    setYAppSessionCookie(res, sessionId);
    // Auto-provision the SuperCloud services (ERPNext instance + NextCloud +
    // mail config) from the Accounts API. Best-effort: never block the login.
    provisionFromOpenAec({ yAppUserId: user.id, userKey, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
      .then((r) => console.log(`[sso] provisioned user=${user.id}: erpnext=${r.erpnextInstanceId} nc=${r.nextcloud} mail=${r.mail} errors=${r.errors.join("|") || "none"}`))
      .catch((e) => console.warn(`[sso] provisioning failed: ${(e as Error).message}`));
    res.redirect(returnTo);
  } catch (err) {
    console.error(`[sso] callback failed: ${(err as Error).message}`);
    res.redirect("/login?sso_error=exchange");
  }
});

/* ─── Y-app instance management endpoints ─── */

// Middleware: require Y-app session AND recover the user key for credential ops
function requireYAppSessionWithKey(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const sid = getYAppSessionId(req);
  const sessionData = getYAppSessionWithKey(sid);
  if (!sessionData) {
    res.status(401).json({ error: "Y-app authentication required" });
    return;
  }
  (req as any).yAppUser = sessionData.user;
  (req as any).yAppUserKey = sessionData.userKey;
  next();
}

// Lighter middleware: only checks session, no key recovery
function requireYAppSession(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const sid = getYAppSessionId(req);
  const user = getYAppUserForSession(sid);
  if (!user) {
    res.status(401).json({ error: "Y-app authentication required" });
    return;
  }
  (req as any).yAppUser = user;
  next();
}

// List instances (no credentials returned, just metadata)
app.get("/api/instances", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const instances = listInstancesForUser(user.id);
  // Merge in per-instance Frappe version fields so the frontend can show
  // the detected major version, the override (if any), and when it was
  // last detected. Querying the columns directly here avoids extending
  // the Instance interface in instances.ts.
  const versionRows = db
    .prepare(
      "SELECT id, frappe_major_version, version_detected_at, version_override FROM instances WHERE y_app_user_id = ?"
    )
    .all(user.id) as { id: number; frappe_major_version: number; version_detected_at: number | null; version_override: number | null }[];
  const versionById = new Map(versionRows.map((r) => [r.id, r]));
  const enriched = instances.map((inst) => {
    const v = versionById.get(inst.id);
    return {
      ...inst,
      frappe_major_version: v?.frappe_major_version ?? null,
      version_detected_at: v?.version_detected_at ?? null,
      version_override: v?.version_override ?? null,
    };
  });
  res.json({ instances: enriched });
});

// Add a new instance — tests credentials, encrypts, persists
app.post("/api/instances", requireYAppSessionWithKey, async (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const userKey = (req as any).yAppUserKey as Buffer;
  try {
    const { name, url, themeColor, erpnextUsername, erpnextPassword } = req.body as {
      name?: string;
      url?: string;
      themeColor?: string | null;
      erpnextUsername?: string;
      erpnextPassword?: string;
    };
    const result = await addInstance(user.id, userKey, {
      name: name || "",
      url: url || "",
      themeColor: themeColor ?? null,
      erpnextUsername: erpnextUsername || "",
      erpnextPassword: erpnextPassword || "",
    });
    res.json({ ok: true, instance: result.instance, fullName: result.fullName, roles: result.roles });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Test connection without persisting
app.post("/api/instances/test", requireYAppSession, instanceTestLimiter, async (req, res) => {
  try {
    const { url, erpnextUsername, erpnextPassword } = req.body as {
      url?: string;
      erpnextUsername?: string;
      erpnextPassword?: string;
    };
    const result = await testInstanceConnection(url || "", erpnextUsername || "", erpnextPassword || "");
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, fullName: result.fullName, roles: result.roles });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Update instance metadata (does not change credentials)
app.put("/api/instances/:id", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid instance id" });
  try {
    const { name, url, themeColor } = req.body as { name?: string; url?: string; themeColor?: string | null };
    const updated = updateInstance(id, user.id, { name, url, themeColor });
    res.json({ ok: true, instance: updated });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Delete instance
app.delete("/api/instances/:id", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid instance id" });
  const ok = deleteInstance(id, user.id);
  if (!ok) return res.status(404).json({ error: "Instance not found" });
  res.json({ ok: true });
});

// Force-drop the cached ERPNext sid for an instance. Use after rotating
// the ERPNext password, after being revoked from an instance, or when
// debugging "why am I still logged in upstream as the wrong user". The
// next request to the instance triggers a fresh ERPNext login using the
// stored credentials (or fails cleanly if the credentials no longer work).
app.post("/api/instances/:id/invalidate-session", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid instance id" });

  // Ownership check — never let a user invalidate sessions for instances
  // they don't own. Same pattern as the settings routes below.
  const inst = db.prepare("SELECT id FROM instances WHERE id = ? AND y_app_user_id = ?").get(id, user.id) as { id: number } | undefined;
  if (!inst) return res.status(404).json({ error: "Instance not found" });

  invalidateInstanceSession(user.id, id);
  res.json({ ok: true });
});

/* ─── Instance settings (shared employer → employee config) ─── */

// Get all settings for an instance (or all instances of the same user)
app.get("/api/instances/:id/settings", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid instance id" });

  // Verify ownership
  const inst = db.prepare("SELECT id FROM instances WHERE id = ? AND y_app_user_id = ?").get(id, user.id) as { id: number } | undefined;
  if (!inst) return res.status(404).json({ error: "Instance not found" });

  const rows = db.prepare("SELECT setting_key, setting_value, updated_at FROM instance_settings WHERE instance_id = ?").all(id) as { setting_key: string; setting_value: string; updated_at: number }[];
  const settings: Record<string, unknown> = {};
  for (const r of rows) {
    try { settings[r.setting_key] = JSON.parse(r.setting_value); }
    catch { settings[r.setting_key] = r.setting_value; }
  }
  res.json({ ok: true, settings });
});

// Get a specific setting
app.get("/api/instances/:id/settings/:key", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid instance id" });

  const inst = db.prepare("SELECT id FROM instances WHERE id = ? AND y_app_user_id = ?").get(id, user.id) as { id: number } | undefined;
  if (!inst) return res.status(404).json({ error: "Instance not found" });

  const row = db.prepare("SELECT setting_value FROM instance_settings WHERE instance_id = ? AND setting_key = ?").get(id, req.params.key) as { setting_value: string } | undefined;
  if (!row) return res.status(404).json({ error: "Setting not found" });

  try { res.json({ ok: true, value: JSON.parse(row.setting_value) }); }
  catch { res.json({ ok: true, value: row.setting_value }); }
});

// Upsert a setting (employer sets config that employees inherit)
app.put("/api/instances/:id/settings/:key", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid instance id" });

  const inst = db.prepare("SELECT id FROM instances WHERE id = ? AND y_app_user_id = ?").get(id, user.id) as { id: number } | undefined;
  if (!inst) return res.status(404).json({ error: "Instance not found" });

  const value = req.body.value;
  if (value === undefined) return res.status(400).json({ error: "Missing 'value' in body" });

  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  db.prepare(`
    INSERT INTO instance_settings (instance_id, setting_key, setting_value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(instance_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at
  `).run(id, req.params.key, serialized, Date.now());

  res.json({ ok: true });
});

/* ─── Cross-device synced prefs (encrypted blob, per instance, per user) ───
 *
 * Versleutelde JSON blob die de client-side localStorage prefs spiegelt zodat
 * een gebruiker dezelfde credentials/folder-prefs/etc. op desktop + browser +
 * mobiel ziet. Encryption gebruikt dezelfde userKey als instance_credentials,
 * dus dezelfde two-key guarantees (DB-dump zonder Y-app password + master key
 * onthult de blob niet).
 */

app.get("/api/instances/:id/synced-prefs", requireYAppSessionWithKey, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const userKey = (req as any).yAppUserKey as Buffer;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid instance id" });

  const inst = db.prepare("SELECT id FROM instances WHERE id = ? AND y_app_user_id = ?").get(id, user.id) as { id: number } | undefined;
  if (!inst) return res.status(404).json({ error: "Instance not found" });

  const row = db.prepare(
    "SELECT synced_prefs_encrypted, synced_prefs_iv, synced_prefs_updated_at FROM instance_credentials WHERE instance_id = ?"
  ).get(id) as { synced_prefs_encrypted: Buffer | null; synced_prefs_iv: Buffer | null; synced_prefs_updated_at: number | null } | undefined;

  if (!row || !row.synced_prefs_encrypted || !row.synced_prefs_iv) {
    return res.json({ ok: true, prefs: {}, updated_at: null });
  }

  try {
    const prefs = decryptToJson(row.synced_prefs_encrypted, row.synced_prefs_iv, userKey);
    res.json({ ok: true, prefs, updated_at: row.synced_prefs_updated_at });
  } catch (err) {
    res.status(500).json({ error: "Decryption failed: " + (err as Error).message });
  }
});

app.put("/api/instances/:id/synced-prefs", requireYAppSessionWithKey, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const userKey = (req as any).yAppUserKey as Buffer;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid instance id" });

  const inst = db.prepare("SELECT id FROM instances WHERE id = ? AND y_app_user_id = ?").get(id, user.id) as { id: number } | undefined;
  if (!inst) return res.status(404).json({ error: "Instance not found" });

  const prefs = req.body?.prefs;
  if (prefs === undefined || prefs === null || typeof prefs !== "object") {
    return res.status(400).json({ error: "Missing or invalid 'prefs' object in body" });
  }

  // Size guard: 1 MB max op de gespeicherte blob
  const serialized = JSON.stringify(prefs);
  if (serialized.length > 1024 * 1024) {
    return res.status(413).json({ error: "Synced prefs blob too large (max 1 MB)" });
  }

  try {
    const { ciphertext, iv } = encryptWithKey(serialized, userKey);
    const now = Date.now();
    db.prepare(
      "UPDATE instance_credentials SET synced_prefs_encrypted = ?, synced_prefs_iv = ?, synced_prefs_updated_at = ? WHERE instance_id = ?"
    ).run(ciphertext, iv, now, id);
    res.json({ ok: true, updated_at: now });
  } catch (err) {
    res.status(500).json({ error: "Encryption failed: " + (err as Error).message });
  }
});

// Get settings from any instance of the same user (for employees to read employer config)
app.get("/api/user-settings/:key", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };

  // Find the first instance of this user that has this setting
  const row = db.prepare(`
    SELECT s.setting_value FROM instance_settings s
    JOIN instances i ON s.instance_id = i.id
    WHERE i.y_app_user_id = ? AND s.setting_key = ?
    ORDER BY s.updated_at DESC LIMIT 1
  `).get(user.id, req.params.key) as { setting_value: string } | undefined;

  if (!row) return res.status(404).json({ error: "Setting not found" });

  try { res.json({ ok: true, value: JSON.parse(row.setting_value) }); }
  catch { res.json({ ok: true, value: row.setting_value }); }
});

// Get settings from any instance with the same ERPNext URL (cross-user, for employer→employee config sharing)
// This is the URL-match bridge — temporary solution until organization concept is built.
app.get("/api/shared-settings/:key", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const key = req.params.key;

  // Find this user's instance URLs
  const userInstances = db.prepare(
    "SELECT id, url FROM instances WHERE y_app_user_id = ?"
  ).all(user.id) as { id: number; url: string }[];

  if (userInstances.length === 0) {
    return res.status(404).json({ error: "No instances found" });
  }

  // For each of the user's instance URLs, look for settings from OTHER users' instances with the same URL
  const urls = [...new Set(userInstances.map((i) => i.url))];
  const userInstanceIds = userInstances.map((i) => i.id);

  for (const url of urls) {
    const row = db.prepare(`
      SELECT s.setting_value FROM instance_settings s
      JOIN instances i ON s.instance_id = i.id
      WHERE i.url = ? AND s.setting_key = ? AND i.id NOT IN (${userInstanceIds.map(() => "?").join(",")})
      ORDER BY s.updated_at DESC LIMIT 1
    `).get(url, key, ...userInstanceIds) as { setting_value: string } | undefined;

    if (row) {
      try { return res.json({ ok: true, value: JSON.parse(row.setting_value) }); }
      catch { return res.json({ ok: true, value: row.setting_value }); }
    }
  }

  // Fallback: also check this user's own instances (employer viewing as employee)
  const ownRow = db.prepare(`
    SELECT s.setting_value FROM instance_settings s
    JOIN instances i ON s.instance_id = i.id
    WHERE i.y_app_user_id = ? AND s.setting_key = ?
    ORDER BY s.updated_at DESC LIMIT 1
  `).get(user.id, key) as { setting_value: string } | undefined;

  if (ownRow) {
    try { return res.json({ ok: true, value: JSON.parse(ownRow.setting_value) }); }
    catch { return res.json({ ok: true, value: ownRow.setting_value }); }
  }

  return res.status(404).json({ error: "Setting not found" });
});

/* ─── Desktop-config: niet-geheime werkgever-config per ERPNext-URL ─── */

const DESKTOP_CONFIG_KEYS = [
  "activity-types", "employee-activity-types", "employee-visible-modules",
  "project-template-mapping", "nas-attachment-template", "nas-project-folders",
  "enabled-extensions", "invoice-email-defaults",
];

// De desktop-app heeft geen Y-app-account; ze bewijst toegang via de ERPNext-
// sessie (sid) die ze al heeft. We verifiëren die tegen díe ERPNext en geven
// dan de gedeelde (niet-geheime) config voor die ERPNext-URL terug via URL-match.
// Whitelisted in de auth-middleware (doet hier eigen auth). Géén credentials.
app.get("/api/desktop-config", async (req, res) => {
  const erpnextUrl = String(req.query.erpnextUrl || "").replace(/\/+$/, "");
  const sid = req.headers["x-erpnext-sid"] as string | undefined;
  if (!erpnextUrl || !sid) return res.status(400).json({ error: "missing_params" });
  try {
    const verify = await fetch(`${erpnextUrl}/api/method/frappe.auth.get_logged_user`, {
      headers: { Cookie: `sid=${sid}` }, signal: AbortSignal.timeout(10000),
    });
    const vd = await verify.json().catch(() => ({} as { message?: string }));
    const loggedUser = (vd as { message?: string }).message;
    if (!verify.ok || !loggedUser || loggedUser === "Guest") {
      return res.status(401).json({ error: "invalid_erpnext_session" });
    }
  } catch {
    return res.status(502).json({ error: "erpnext_unreachable" });
  }
  const config: Record<string, unknown> = {};
  for (const key of DESKTOP_CONFIG_KEYS) {
    const row = db.prepare(`
      SELECT s.setting_value FROM instance_settings s
      JOIN instances i ON s.instance_id = i.id
      WHERE (i.url = ? OR i.url = ?) AND s.setting_key = ?
      ORDER BY s.updated_at DESC LIMIT 1
    `).get(erpnextUrl, erpnextUrl + "/", key) as { setting_value: string } | undefined;
    if (row) {
      try { config[key] = JSON.parse(row.setting_value); } catch { config[key] = row.setting_value; }
    }
  }
  res.json({ ok: true, config });
});

/* ─── Mail account CRUD (per-instance) ─── */

// List all mail accounts for an instance
app.get("/api/instances/:id/mail-accounts", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const instanceId = parseInt(req.params.id, 10);
  if (Number.isNaN(instanceId)) return res.status(400).json({ error: "Invalid instance id" });

  const inst = db.prepare("SELECT id FROM instances WHERE id = ? AND y_app_user_id = ?").get(instanceId, user.id) as { id: number } | undefined;
  if (!inst) return res.status(404).json({ error: "Instance not found" });

  const accounts = listMailAccounts(user.id, instanceId);
  res.json({ ok: true, accounts });
});

// Add a new mail account
app.post("/api/instances/:id/mail-accounts", requireYAppSessionWithKey, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const userKey = (req as any).yAppUserKey as Buffer;
  const instanceId = parseInt(req.params.id, 10);
  if (Number.isNaN(instanceId)) return res.status(400).json({ error: "Invalid instance id" });

  const inst = db.prepare("SELECT id FROM instances WHERE id = ? AND y_app_user_id = ?").get(instanceId, user.id) as { id: number } | undefined;
  if (!inst) return res.status(404).json({ error: "Instance not found" });

  try {
    const account = addMailAccount(user.id, instanceId, userKey, req.body);
    res.json({ ok: true, account });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Update a mail account
app.put("/api/instances/:id/mail-accounts/:accountId", requireYAppSessionWithKey, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const userKey = (req as any).yAppUserKey as Buffer;
  const instanceId = parseInt(req.params.id, 10);
  if (Number.isNaN(instanceId)) return res.status(400).json({ error: "Invalid instance id" });

  const inst = db.prepare("SELECT id FROM instances WHERE id = ? AND y_app_user_id = ?").get(instanceId, user.id) as { id: number } | undefined;
  if (!inst) return res.status(404).json({ error: "Instance not found" });

  try {
    const updated = updateMailAccount(req.params.accountId, user.id, userKey, req.body);
    if (!updated) return res.status(404).json({ error: "Mail account not found" });
    res.json({ ok: true, account: updated });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Delete a mail account
app.delete("/api/instances/:id/mail-accounts/:accountId", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const instanceId = parseInt(req.params.id, 10);
  if (Number.isNaN(instanceId)) return res.status(400).json({ error: "Invalid instance id" });

  const inst = db.prepare("SELECT id FROM instances WHERE id = ? AND y_app_user_id = ?").get(instanceId, user.id) as { id: number } | undefined;
  if (!inst) return res.status(404).json({ error: "Instance not found" });

  const ok = deleteMailAccount(req.params.accountId, user.id);
  if (!ok) return res.status(404).json({ error: "Mail account not found" });
  res.json({ ok: true });
});

// Test a mail account's IMAP connection
app.post("/api/instances/:id/mail-accounts/:accountId/test", requireYAppSessionWithKey, async (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const userKey = (req as any).yAppUserKey as Buffer;
  const instanceId = parseInt(req.params.id, 10);
  if (Number.isNaN(instanceId)) return res.status(400).json({ error: "Invalid instance id" });

  const inst = db.prepare("SELECT id FROM instances WHERE id = ? AND y_app_user_id = ?").get(instanceId, user.id) as { id: number } | undefined;
  if (!inst) return res.status(404).json({ error: "Instance not found" });

  const decrypted = await getDecryptedMailCredentials(req.params.accountId, user.id, userKey);
  if (!decrypted) return res.status(404).json({ error: "Mail account not found or decryption failed" });

  // Map DecryptedMailAccount to MailCredentials shape expected by withClient
  const creds: MailCredentials = {
    host: decrypted.imapHost,
    port: decrypted.imapPort,
    user: decrypted.username,
    pass: decrypted.password || "",
    secure: decrypted.imapSecure,
    authMode: decrypted.accessToken ? "oauth2" : "password",
    accessToken: decrypted.accessToken,
    refreshToken: decrypted.refreshToken,
    clientId: decrypted.clientId,
    clientSecret: decrypted.clientSecret,
    tokenUri: decrypted.tokenUri,
  };

  const result = await testMailConnectionFromCreds(creds);
  updateTestResult(req.params.accountId, result.ok);
  res.json({ ok: result.ok, message: result.message });
});

/* ─── Version-aware /count endpoint ─── */
/*
 * Frappe v15: uses `frappe.client.get_count` (legacy method).
 * Frappe v16: uses the REST aggregate syntax `fields=[{"COUNT":"*"}]`.
 *
 * Must be registered BEFORE the `/api/i/:instanceId/*splat` wildcard so
 * Express matches this route first.
 */
app.get("/api/i/:instanceId/count", requireYAppSessionWithKey, async (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const userKey = (req as any).yAppUserKey as Buffer;
  const instanceId = parseInt(req.params.instanceId, 10);
  if (Number.isNaN(instanceId)) return res.status(400).json({ error: "Invalid instance id" });

  const instance = getInstanceForUser(instanceId, user.id);
  if (!instance) return res.status(404).json({ error: "Instance not found" });

  const doctype = req.query.doctype as string;
  const filtersStr = (req.query.filters as string) || "[]";
  if (!doctype) return res.status(400).json({ error: "Missing doctype" });

  try {
    const session = await getOrCreateInstanceSession(user.id, instance, userKey);
    if (!session) return res.status(502).json({ error: "Could not get ERPNext session" });

    const version = getEffectiveVersion(instanceId);

    // Run inside erpRequestContext so proxyRequest knows the instance URL
    const sidHolder = { current: session.sid };
    const count = await erpRequestContext.run(
      { url: instance.url, sidHolder },
      async () => {
        if (version >= 16) {
          // v16: REST aggregate with dict syntax
          const params = new URLSearchParams({
            fields: JSON.stringify([{ COUNT: "*" }]),
            filters: filtersStr,
            limit_page_length: "1",
          });
          const result = await proxyRequest(session.sid, `/api/resource/${encodeURIComponent(doctype)}?${params}`, "GET");
          const body = JSON.parse(result.body);
          const row = body?.data?.[0] || {};
          return Number(row["COUNT(*)"] ?? row.count ?? row.total ?? 0);
        } else {
          // v15: frappe.client.get_count
          const params = new URLSearchParams({ doctype, filters: filtersStr });
          const result = await proxyRequest(session.sid, `/api/method/frappe.client.get_count?${params}`, "GET");
          const body = JSON.parse(result.body);
          return Number(body?.message ?? 0);
        }
      }
    );
    return res.json({ count });
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
});

/* ─── Version refresh + override routes ─── */

app.post("/api/instances/:id/refresh-version", requireYAppSessionWithKey, async (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const userKey = (req as any).yAppUserKey as Buffer;
  const instanceId = parseInt(req.params.id, 10);
  if (Number.isNaN(instanceId)) return res.status(400).json({ error: "Invalid instance id" });

  try {
    const major = await refreshInstanceVersion(instanceId, user.id, userKey);
    res.json({ ok: true, frappeMajorVersion: major });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.put("/api/instances/:id/version-override", requireYAppSession, (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const instanceId = parseInt(req.params.id, 10);
  if (Number.isNaN(instanceId)) return res.status(400).json({ error: "Invalid instance id" });

  const { version } = req.body as { version?: number | null };
  if (version !== null && version !== undefined && version !== 15 && version !== 16) {
    return res.status(400).json({ error: "Override must be 15, 16, or null" });
  }

  const ok = setInstanceVersionOverride(instanceId, user.id, version ?? null);
  if (!ok) return res.status(404).json({ error: "Instance not found" });
  res.json({ ok: true });
});

/* ─── Per-instance ERPNext proxy (Phase 3) ─── */
/*
 * Mounted at `/api/i/:instanceId/*`. Forwards everything after that prefix
 * to the instance's ERPNext API, using the per-instance session sid.
 *
 * Example:
 *   GET /api/i/5/method/frappe.client.get?doctype=User&name=foo
 *     → GET https://acme.example.com/api/method/frappe.client.get?doctype=User&name=foo
 *
 * Authenticated by Y-app session cookie. ERPNext credentials are decrypted
 * server-side from the user's wrapped key.
 */
app.all("/api/i/:instanceId/*splat", requireYAppSessionWithKey, async (req, res) => {
  const user = (req as any).yAppUser as { id: number; email: string };
  const userKey = (req as any).yAppUserKey as Buffer;
  const instanceId = parseInt(req.params.instanceId, 10);
  if (Number.isNaN(instanceId)) {
    return res.status(400).json({ error: "Invalid instance id" });
  }

  const instance = getInstanceForUser(instanceId, user.id);
  if (!instance) {
    return res.status(404).json({ error: "Instance not found" });
  }

  // Get a working ERPNext session for this instance, logging in if needed
  let session = await getOrCreateInstanceSession(user.id, instance, userKey);
  if (!session) {
    return res.status(502).json({ error: "Failed to authenticate to ERPNext instance" });
  }

  // The path inside ERPNext is everything after /api/i/:instanceId/.
  // Express 5 named wildcards expose the captured segments as an array.
  const splat = (req.params as Record<string, string | string[]>).splat;
  const wildcardMatch = Array.isArray(splat) ? splat.join("/") : (splat || "");
  const pathInsideErpNext = "/" + wildcardMatch;

  await proxyToInstance(req, res, instance, session, pathInsideErpNext);
});

/* ─── Public health/uptime endpoint (no auth) ─── */

app.get("/api/health/ping", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), timestamp: Date.now() });
});

// Publieke versie-check voor de desktop-app: vergelijkt zijn eigen versie met
// de hier gedeployde (= laatste uitgebrachte) versie en toont zo nodig een
// "nieuwe versie beschikbaar"-melding. Geen auth/instance nodig (whitelist).
// De versie wordt door build-server.mjs als esbuild-define ingebakken.
app.get("/api/app-version", (_req, res) => {
  res.json({ version: process.env.APP_VERSION || "dev" });
});

/* ─── Auth middleware for all /api/* routes except public ones ─── */

app.use("/api", (req, res, next) => {
  if (
    req.path.startsWith("/auth/") ||
    req.path.startsWith("/yapp/") ||
    req.path.startsWith("/instances") ||
    req.path.startsWith("/i/") ||
    req.path === "/health/ping" ||
    req.path === "/app-version" ||
    req.path === "/desktop-config" ||
    req.path === "/messenger/file-proxy" ||
    // Static-asset proxy (letterhead, signature images) wordt geladen via
    // <img> tags in iframes/srcDoc. Img-elementen kunnen géén custom headers
    // sturen, dus geen X-Y-App-Instance header. Het endpoint zelf doet eigen
    // auth via cookie + ?instance=NN query param — zie /api/erpnext-asset
    // handler. Zonder deze whitelist: alle letterhead/signature logos 401.
    req.path === "/erpnext-asset"
  ) {
    return next();
  }
  return authMiddleware(req, res, next);
});

/* ─── Service config (from env vars) ─── */

app.get("/api/services", (_req, res) => {
  res.json({
    data: {
      nextcloud: process.env.NEXTCLOUD_URL ? { url: process.env.NEXTCLOUD_URL, user: process.env.NEXTCLOUD_USER || "", pass: process.env.NEXTCLOUD_PASS ? "***" : "" } : null,
      telegram: process.env.TELEGRAM_BOT_TOKEN ? { token: process.env.TELEGRAM_BOT_TOKEN } : null,
      mail: process.env.MAIL_HOST ? { host: process.env.MAIL_HOST, user: process.env.MAIL_USER || "" } : null,
    },
  });
});

/* ─── Health / Status ─── */

app.get("/api/status", (_req, res) => {
  res.json({ ok: true, erpnextUrl: ERPNEXT_URL });
});

/* ─── Cached data: GET /api/resource/:doctype ─── */

app.get("/api/resource/:doctype", async (req, res) => {
  const sid = (req as any).erpnextSid;
  const qs = new URL(req.url, "http://x").search;
  const result = await proxyRequest(sid, `/api/resource/${encodeURIComponent(req.params.doctype)}${qs}`, "GET");
  res.status(result.status).set("content-type", "application/json").send(result.body);
});

/* ─── Stats: GET /api/stats/uren ─── */

app.get("/api/stats/uren", statsUren);

/* ─── Stats: GET /api/stats/uren/detail ─── */

app.get("/api/stats/uren/detail", statsUrenDetail);

/* ─── Single document: GET /api/resource/:doctype/:name ─── */

app.get("/api/resource/:doctype/:name", async (req, res) => {
  const sid = (req as any).erpnextSid;
  const qs = new URL(req.url, "http://x").search;
  try {
    const result = await proxyRequest(sid, `/api/resource/${encodeURIComponent(req.params.doctype)}/${encodeURIComponent(req.params.name)}${qs}`, "GET");
    res.status(result.status).set("content-type", "application/json").send(result.body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/* ─── Proxy write operations: POST /api/resource/:doctype ─── */

app.post("/api/resource/:doctype", async (req, res) => {
  const sid = (req as any).erpnextSid;
  try {
    const result = await proxyRequest(
      sid,
      `/api/resource/${encodeURIComponent(req.params.doctype)}`,
      "POST",
      JSON.stringify(req.body)
    );
    res.status(result.status).type("json").send(result.body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

app.put("/api/resource/:doctype/:name", async (req, res) => {
  const sid = (req as any).erpnextSid;
  try {
    const result = await proxyRequest(
      sid,
      `/api/resource/${encodeURIComponent(req.params.doctype)}/${encodeURIComponent(req.params.name)}`,
      "PUT",
      JSON.stringify(req.body)
    );
    res.status(result.status).type("json").send(result.body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

app.delete("/api/resource/:doctype/:name", async (req, res) => {
  const sid = (req as any).erpnextSid;
  try {
    const result = await proxyRequest(
      sid,
      `/api/resource/${encodeURIComponent(req.params.doctype)}/${encodeURIComponent(req.params.name)}`,
      "DELETE"
    );
    res.status(result.status).type("json").send(result.body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/* ─── Proxy method calls: POST/GET /api/method/:method ─── */

// Express 5 / path-to-regexp v8 dropped the regex-in-route `(*)` syntax.
// ERPNext method names are dot-separated (e.g. frappe.client.get_file) and
// never contain slashes, so the default `:method` parameter is sufficient.
app.all("/api/method/:method", async (req, res) => {
  const sid = (req as any).erpnextSid;
  const methodPath = req.params.method;
  const fullPath = `/api/method/${methodPath}`;

  try {
    const qs = new URL(req.url, "http://x").search;
    const result = await proxyRequest(
      sid,
      `${fullPath}${qs}`,
      req.method,
      req.method === "POST" ? JSON.stringify(req.body) : undefined
    );
    res.status(result.status).type("json").send(result.body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/* ─── Proxy printview HTML rendering ───
 * Frappe's `/printview` route returns the rendered HTML for a Print Format
 * — exactly what the desk shows in its print-preview tab. The frontend
 * iframes that HTML via srcDoc instead of trying to embed a PDF blob.
 * This endpoint isn't under /api/* so we register it separately and pipe
 * through the same ERPNext session as the rest.
 */
app.get("/api/printview-html", authMiddleware, async (req, res) => {
  const sid = (req as any).erpnextSid;
  const instanceId = (req as any).instanceId as number | undefined;
  const instanceUrl = (req as any).instanceUrl as string | undefined;
  try {
    const qs = new URL(req.url, "http://x").search;
    // Frappe's /printview is a Jinja-rendered web page. The default
    // proxyRequest headers ask for `application/json` — with that Accept
    // header Frappe returns a ~1KB JSON error shell instead of the real
    // print HTML. Override to text/html so we get the rendered page.
    const result = await proxyRequest(
      sid,
      `/printview${qs}`,
      "GET",
      undefined,
      { Accept: "text/html, application/xhtml+xml" },
    );
    const body = (result.status >= 200 && result.status < 300 && instanceId)
      ? rewriteErpnextAssetUrls(result.body, instanceId, instanceUrl || "")
      : result.body;
    res.status(result.status).set("content-type", "text/html; charset=utf-8").send(body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/* ─── Proxy ERPNext static assets (images, CSS) ───
 * Loads `/files/...`, `/private/files/...` and `/assets/...` through the
 * authenticated ERPNext session. Used by the print-preview iframe (where
 * `<img>` element loads cannot carry the `X-Y-App-Instance` header) and
 * anywhere else that needs ERPNext-hosted images same-origin.
 *
 * Instance is read from the `?instance=` query param (not header) so plain
 * `<img src=…>` loads work. The user is still authenticated via the
 * `y_app_session` cookie; the instance query param only selects WHICH of the
 * user's instances to proxy through. Path is whitelisted to static asset
 * prefixes — this is NOT a general ERPNext API bypass.
 */
app.get("/api/erpnext-asset", async (req, res) => {
  const instanceId = parseInt(String(req.query.instance ?? ""), 10);
  const path = String(req.query.path ?? "");
  console.log(`[erpnext-asset] req: instance=${req.query.instance} path=${path}`);
  const allowedPrefix = path.startsWith("/files/")
    || path.startsWith("/private/files/")
    || path.startsWith("/assets/");
  // Reject `?`/`#` in the path — without this an attacker could smuggle a
  // query string through and have erpFetch concatenate it onto the upstream
  // URL (e.g. `/files/x?cmd=…`), turning this static-asset proxy into an
  // arbitrary-API forwarder against ERPNext with the user's session cookie.
  if (!allowedPrefix || path.includes("..") || path.includes("?") || path.includes("#")) {
    res.status(400).json({ error: "invalid_path" });
    return;
  }
  const yAppSid = (req as any).cookies?.y_app_session;
  if (!yAppSid || Number.isNaN(instanceId)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const { getYAppSessionWithKey } = await import("./yapp-auth.ts");
    const { getInstanceForUser } = await import("./instances.ts");
    const { getOrCreateInstanceSession, refreshInstanceSession } = await import("./instance-proxy.ts");
    const { erpRequestContext, erpFetch } = await import("./erpnext-client.ts");

    const sessionData = getYAppSessionWithKey(String(yAppSid));
    if (!sessionData) { console.log(`[erpnext-asset] 401 session_invalid`); res.status(401).json({ error: "session_invalid" }); return; }
    const instance = getInstanceForUser(instanceId, sessionData.user.id);
    if (!instance) { console.log(`[erpnext-asset] 404 instance ${instanceId} not_found for user ${sessionData.user.id}`); res.status(404).json({ error: "instance_not_found" }); return; }
    const erpSession = await getOrCreateInstanceSession(sessionData.user.id, instance, sessionData.userKey);
    if (!erpSession) { console.log(`[erpnext-asset] 502 instance_unavailable`); res.status(502).json({ error: "instance_unavailable" }); return; }

    const sidHolder = { current: erpSession.sid };
    await erpRequestContext.run(
      {
        url: instance.url,
        sidHolder,
        refreshSid: async () => {
          const fresh = await refreshInstanceSession(sessionData.user.id, instance, sessionData.userKey);
          if (fresh) { sidHolder.current = fresh.sid; return fresh.sid; }
          return null;
        },
      },
      async () => {
        const upstream = await erpFetch(sidHolder.current, path, {
          headers: { Accept: "*/*" },
        });
        const ct = upstream.headers.get("content-type") || "application/octet-stream";
        const buf = Buffer.from(await upstream.arrayBuffer());
        console.log(`[erpnext-asset] ${path} → status=${upstream.status} ct=${ct} size=${buf.length}`);
        res.status(upstream.status)
          .set("content-type", ct)
          .set("cache-control", "private, max-age=3600")
          .send(buf);
      },
    );
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/**
 * Rewrite `<img src="/files/…">`, `<link href="/assets/…">`, and
 * `url(/private/files/…)` references in ERPNext-rendered HTML so they load
 * via `/api/erpnext-asset` instead of directly from ERPNext. Same-origin
 * loads avoid the cross-origin auth problem for private files and the
 * "ERPNext isn't browser-reachable" problem for public files.
 */
function rewriteErpnextAssetUrls(html: string, instanceId: number, erpHost: string): string {
  const proxy = `/api/erpnext-asset?instance=${instanceId}&path=`;
  let out = html;
  // 1. Absolute ERPNext-host URLs in src/href/url() → strip host, route via proxy
  if (erpHost) {
    const host = erpHost.replace(/\/$/, "");
    const hostEsc = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const absRe = new RegExp(`(["'(])${hostEsc}(/(?:files|private/files|assets)/[^"')\\s]+)`, "g");
    out = out.replace(absRe, (_m, q, p) => `${q}${proxy}${encodeURIComponent(p)}`);
  }
  // 2. Relative src="/files/…" / href="/assets/…"
  out = out.replace(
    /((?:src|href)=)(["'])(\/(?:files|private\/files|assets)\/[^"']+)\2/g,
    (_m, attr, q, p) => `${attr}${q}${proxy}${encodeURIComponent(p)}${q}`,
  );
  // 3. CSS url(/files/…) inside <style> blocks
  out = out.replace(
    /url\((["']?)(\/(?:files|private\/files|assets)\/[^"')]+)\1\)/g,
    (_m, q, p) => `url(${q}${proxy}${encodeURIComponent(p)}${q})`,
  );
  // 4. Hide ERPNext printview chrome (Print / Get PDF buttons, navbar, …).
  //    The iframe is meant to show only the document itself — the toolbar is
  //    noise that confuses users.
  const hideChromeCss = `
    <style id="y-app-hide-chrome">
      .print-format-gap > a,
      .print-format-gap > button,
      .btn-print, .btn-pdf, .btn-print-preview,
      .print-toolbar, .print-preview-actions,
      .navbar, .nav-bar, #toolbar, .web-sidebar, .page-head, .form-toolbar,
      a[onclick*="print"], a[onclick*="window.print"],
      button[onclick*="print"], button[onclick*="window.print"],
      a[href*="download_pdf"] { display: none !important; }
      body > .print-format-gap:empty { display: none !important; }
    </style>`;
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${hideChromeCss}</head>`);
  } else if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${hideChromeCss}`);
  } else {
    out = hideChromeCss + out;
  }
  return out;
}

/* ─── Mail (IMAP) ─── */

/* ─── Health checks ─── */

app.get("/api/health", healthGetReport);
app.get("/api/health/run", healthRunTests);
app.get("/api/health/mail", healthGetMail);
app.get("/api/health/messenger", healthGetMessenger);

/* ─── Mail (IMAP/SMTP) — lightweight instance header parsing for cache isolation ─── */
// Light middleware: parse X-Y-App-Instance header and set req.instanceId
// WITHOUT requiring full ERPNext session (mail credentials come from their own flow)
function parseInstanceHeader(req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) {
  const header = req.headers["x-y-app-instance"];
  if (header) {
    const val = Array.isArray(header) ? header[0] : String(header);
    const num = parseInt(val, 10);
    if (!Number.isNaN(num)) (req as any).instanceId = num;
  }
  // Best-effort: recover the Y-app user + userKey so vault-backed mail accounts
  // (?account=<id>) can be decrypted. Non-fatal — the legacy password / ERPNext
  // credential paths don't need it, so a missing session must not 401 here.
  try {
    const sid = getYAppSessionId(req);
    const sessionData = getYAppSessionWithKey(sid);
    if (sessionData) {
      (req as any).yAppUser = sessionData.user;
      (req as any).yAppUserKey = sessionData.userKey;
    }
  } catch { /* ignore — leave req without vault key, fall back to other paths */ }
  next();
}

app.post("/api/mail/test", parseInstanceHeader, mailTestConnection);
app.post("/api/mail/test-shared", parseInstanceHeader, mailTestShared);
app.get("/api/health/mail/upstream", mailUpstreamHealth);
app.get("/api/mail/folders", parseInstanceHeader, mailListFolders);
app.get("/api/mail/messages", parseInstanceHeader, mailListMessages);
app.get("/api/mail/bodies", parseInstanceHeader, mailGetBodies);
// §14 BackgroundSync: lichtgewicht unseen-count summary endpoint. Wordt door
// de BackgroundSyncProvider gepolt elke 60s om de sidebar-mail-badge fris
// te houden, zonder een hele folder-list te hoeven herladen.
app.get("/api/mail/unseen-summary", parseInstanceHeader, async (req, res) => {
  try {
    const { mailListFolders: handler } = await import("./mail.ts");
    // Hergebruik de folder-list (die heeft per-folder unseen counts) en
    // strip alles behalve path + unseen voor minimaal payload-formaat.
    const origJson = res.json.bind(res);
    res.json = (data: any) => {
      const folders = Array.isArray(data?.data) ? data.data : [];
      const summary: UnseenFolderShape[] = folders
        .filter((f: any) => typeof f.unseen === "number")
        .map((f: any) => ({ path: f.path, unseen: f.unseen }));
      const total = summary.reduce((sum: number, f) => sum + (f.unseen || 0), 0);
      // Zelfde wire-contract als de desktop-adapter-mirror (fetch.ts) — zie
      // api-shapes.ts (Fase 5 drift-safety).
      return origJson({ data: { folders: summary, total } } satisfies MailUnseenSummaryResponse);
    };
    return handler(req, res);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
app.get("/api/mail/message", parseInstanceHeader, mailGetMessage);
app.get("/api/mail/attachment", parseInstanceHeader, mailGetAttachment);
app.post("/api/mail/send", parseInstanceHeader, mailSend);
app.delete("/api/mail/message", parseInstanceHeader, mailDeleteMessage);
app.post("/api/mail/move", parseInstanceHeader, mailMoveMessage);
app.post("/api/mail/move-cross-account", parseInstanceHeader, mailMoveMessageCrossAccount);
app.post("/api/mail/folder", parseInstanceHeader, mailCreateFolder);
app.post("/api/mail/delete-folder", parseInstanceHeader, mailDeleteFolder);
app.post("/api/mail/warmup", parseInstanceHeader, mailWarmup);
app.get("/api/mail/warmup", parseInstanceHeader, mailWarmup);
app.get("/api/mail/cache-stats", parseInstanceHeader, mailCacheStats);
app.post("/api/mail/mark-read", parseInstanceHeader, mailMarkRead);
app.post("/api/mail/mark-unread", parseInstanceHeader, mailMarkUnread);
app.post("/api/mail/rename-folder", parseInstanceHeader, mailRenameFolder);
app.get("/api/mail/auto-config", authMiddleware, mailAutoConfig);
app.get("/api/mail/warm", parseInstanceHeader, mailIsWarm);
app.get("/api/mail/contacts", parseInstanceHeader, mailListContacts);
app.get("/api/mail/signature", parseInstanceHeader, mailGetSignature);
app.get("/api/mail/conversation", parseInstanceHeader, mailGetConversation);

/* ─── Debug: user visibility (gated by YAPP_DEBUG_USER_VISIBILITY) ─── */
//
// Issue #1 (Joran): one user sees fewer sidebar items than colleagues on the
// same ERPNext. Without access to that user's browser DevTools, we cannot
// see their roles / block_modules / view_mode. This endpoint exposes those
// for any employee, gated on:
//   1. An employer-level ERPNext role on the caller (System Manager,
//      HR Manager, Accounts Manager, Projects Manager, Administrator)
//   2. The env var YAPP_DEBUG_USER_VISIBILITY=1 on the server
//
// Disabled by default. Operator flips the env var on the VPS to use it,
// flips it off again after diagnosis. No UI — call via curl.
//
// Example:
//   curl -b 'y_app_session=...' -H 'X-Y-App-Instance: 3' \
//     'https://y-app.impertio.app/api/debug/user-visibility?employee=joran@3bm.co.nl'

const EMPLOYER_ROLES_FOR_DEBUG = new Set([
  "System Manager", "Administrator",
  "HR Manager", "Accounts Manager", "Projects Manager", "Sales Manager",
]);

app.get("/api/debug/user-visibility", async (req, res) => {
  if (process.env.YAPP_DEBUG_USER_VISIBILITY !== "1") {
    return res.status(404).json({ error: "Not enabled" });
  }
  const callerRoles = ((req as any).roles as string[]) || [];
  if (!callerRoles.some((r) => EMPLOYER_ROLES_FOR_DEBUG.has(r))) {
    return res.status(403).json({ error: "Employer role required" });
  }

  const employeeEmail = req.query.employee as string;
  if (!employeeEmail) return res.status(400).json({ error: "Missing 'employee' query param" });
  const erpnextSid = (req as any).erpnextSid as string;
  if (!erpnextSid) return res.status(400).json({ error: "No ERPNext session" });

  const out: Record<string, unknown> = { employee: employeeEmail, caller: (req as any).username };

  // Fetch User doc: roles + block_modules
  try {
    const userR = await (await import("./erpnext-client.ts")).proxyRequest(
      erpnextSid,
      `/api/method/frappe.client.get?doctype=User&name=${encodeURIComponent(employeeEmail)}`,
      "GET",
    );
    const userDoc = JSON.parse(userR.body)?.message;
    if (userDoc) {
      out.user = {
        name: userDoc.name,
        enabled: userDoc.enabled,
        user_type: userDoc.user_type,
        full_name: userDoc.full_name,
        block_modules: Array.isArray(userDoc.block_modules)
          ? userDoc.block_modules.map((m: { module: string }) => m.module)
          : [],
        // Note: roles_table is `roles` on User doc with child-rows {role}.
        // get_roles endpoint below is the authoritative source.
      };
    } else {
      out.user = { error: "User doc not found" };
    }
  } catch (err) {
    out.user = { error: (err as Error).message };
  }

  // Fetch roles via the whitelisted endpoint
  try {
    const rolesR = await (await import("./erpnext-client.ts")).proxyRequest(
      erpnextSid,
      `/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(employeeEmail)}`,
      "GET",
    );
    const rolesData = JSON.parse(rolesR.body)?.message;
    out.roles = Array.isArray(rolesData) ? rolesData : { error: "Unexpected shape", raw: rolesData };
  } catch (err) {
    out.roles = { error: (err as Error).message };
  }

  // Read the employer-level employee-visible-modules from instance_settings
  // (the whitelist that Settings → Module visibility writes)
  try {
    const instanceId = (req as any).instanceId as number;
    const row = db.prepare(
      "SELECT setting_value FROM instance_settings WHERE instance_id = ? AND setting_key = ?"
    ).get(instanceId, "employee-visible-modules") as { setting_value: string } | undefined;
    if (row) {
      try { out.employee_visible_modules = JSON.parse(row.setting_value); }
      catch { out.employee_visible_modules = row.setting_value; }
    } else {
      out.employee_visible_modules = null;
    }
  } catch (err) {
    out.employee_visible_modules = { error: (err as Error).message };
  }

  res.json({ ok: true, data: out });
});

/* ─── NextCloud WebDAV ─── */

app.get("/api/nextcloud/files", nextcloudListFiles);
app.get("/api/nextcloud/download-url", nextcloudDownloadUrl);
app.get("/api/nextcloud/download", nextcloudDownload);
app.put("/api/nextcloud/upload", express.raw({ type: "*/*", limit: "100mb" }), nextcloudUpload);
app.post("/api/nextcloud/share", nextcloudCreateShareLink);

/* ─── Messenger (multi-platform) ─── */

app.post("/api/messenger/test", messengerTestConnection);
app.post("/api/messenger/subscribe", messengerSubscribe);
app.get("/api/messenger/conversations", messengerListConversations);
app.get("/api/messenger/all-conversations", messengerAllConversations);
app.get("/api/messenger/messages", messengerGetMessages);
app.post("/api/messenger/send", messengerSendMessage);
app.post("/api/messenger/edit", messengerEditMessage);
app.post("/api/messenger/delete", messengerDeleteMessage);
app.post("/api/messenger/react", messengerReact);
app.post("/api/messenger/mark-read", messengerMarkRead);
app.post("/api/messenger/upload", messengerUploadFile);
app.get("/api/messenger/file-proxy", messengerFileProxy);
app.post("/api/messenger/create-conversation", messengerCreateConversation);
app.post("/api/messenger/add-participant", messengerAddParticipant);

/* ─── Office 365 Calendar via Microsoft Graph ─── */

app.get("/api/calendar/o365", calendarGetO365);

/* ─── O365 calendar update (PATCH) ─── */

app.patch("/api/calendar/o365/:eventId", calendarPatchO365);

/* ─── O365 calendar delete (DELETE) ─── */

app.delete("/api/calendar/o365/:eventId", calendarDeleteO365);

/* ─── iCal calendar proxy ─── */

app.get("/api/calendar/ical", calendarGetICal);

app.post("/api/calendar/event", calendarPostEvent);

/* ─── Meeting Notes ─── */

app.get("/api/meetings", meetingsGet);
app.post("/api/meetings", meetingsCreate);
app.put("/api/meetings/:id", meetingsUpdate);
app.delete("/api/meetings/:id", meetingsDelete);

/* ─── Project template suggestions ─── */

app.get("/api/project-template-suggest", requireYAppSessionWithKey, handleProjectTemplateSuggest);

/* ─── Agent chat ─── */

app.post("/api/agent/chat", handleAgentChat);

/* ─── SPA fallback is registered in startServer() after distDir is resolved ─── */

/* ─── Start ─── */

export async function startServer(port?: number): Promise<number> {
  const listenPort = port !== undefined ? port : PORT;

  // ERPNEXT_URL is now optional. In multi-instance mode (Phase 5+), each
  // Y-app user enrolls their own ERPNext instances and we use those URLs.
  // The global env var is only used by the legacy single-instance
  // loginToErpNext() default — no longer required for the server to start.
  if (ERPNEXT_URL) {
    console.log(`[server] Default ERPNext URL (legacy fallback): ${ERPNEXT_URL}`);
  } else {
    console.log(`[server] No default ERPNext URL — multi-instance mode only`);
  }

  // Set up static file serving (lazy so ERPNEXT_LEVEL_DIST is available)
  distDir = resolve(process.env.ERPNEXT_LEVEL_DIST || join(_serverDir, "..", "dist"));
  if (existsSync(distDir)) {
    console.log(`[server] Serving static files from ${distDir}`);
    app.use(express.static(distDir));
    // SPA fallback — must be after all API routes, skip /api/* paths.
    // Express 5 / path-to-regexp v8 no longer accepts a bare `"*"` route,
    // so we use a final middleware that matches anything still unhandled.
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(join(distDir, "index.html"));
    });
  }

  // Create HTTP server from Express app
  const server = createServer(app);

  // §14/§5: Push-events WebSocket. IMAP IDLE en NC Talk long-poll
  // broadcasten hierdoor naar de browser zodat polling overbodig wordt.
  //
  // Belangrijk: gebruik `noServer: true` i.p.v. `{ server, path }`. Twee
  // WebSocketServers met `{ server, path }` op dezelfde HTTP-server
  // conflicteren: ws-library voegt voor elk een 'upgrade' listener toe
  // die ALLE upgrade-requests ziet, en wie als tweede luistert kan een
  // al-geaccepteerde connection alsnog sluiten. Resultaat: code 1006
  // direct na connect. Met noServer + handmatige upgrade-routing
  // bestaat dat probleem niet.
  const eventsWss = new WebSocketServer({ noServer: true });
  const terminalWss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    if (url.startsWith("/ws/events")) {
      eventsWss.handleUpgrade(req, socket, head, (ws) => {
        eventsWss.emit("connection", ws, req);
      });
    } else if (url.startsWith("/ws/terminal")) {
      terminalWss.handleUpgrade(req, socket, head, (ws) => {
        terminalWss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });
  eventsWss.on("connection", async (ws, req) => {
    const cookieHeader = req.headers.cookie || "";
    const yAppMatch = cookieHeader.match(/y_app_session=([^;]+)/);
    if (!yAppMatch || !req.url) { ws.close(4001, "Unauthorized"); return; }
    const yAppSid = yAppMatch[1];
    const url = new URL(req.url, "http://localhost");
    const instanceParam = url.searchParams.get("instance");
    const instanceId = instanceParam ? parseInt(instanceParam, 10) : NaN;
    if (Number.isNaN(instanceId)) { ws.close(4001, "Missing instance"); return; }

    try {
      const sessionData = getYAppSessionWithKey(yAppSid);
      if (!sessionData) { ws.close(4001, "Unauthorized"); return; }
      const instance = getInstanceForUser(instanceId, sessionData.user.id);
      if (!instance) { ws.close(4004, "Instance not found"); return; }
    } catch (err) {
      console.warn(`[ws/events] auth error: ${(err as Error).message}`);
      ws.close(4001, "Auth error"); return;
    }

    const { addEventClient, subscribeConversation, unsubscribeConversation } = await import("./ws-events.ts");
    const { ensureLongPoll, stopLoopsForSession } = await import("./messenger-longpoll.ts");
    const { startIdleForCachedSession, ensureIdleForSession } = await import("./mail.ts");
    const { setNcSession } = await import("./messenger.ts");
    // NB: getYAppSessionWithKey, getInstanceForUser, getOrCreateInstanceSession
    // staan al statisch geïmporteerd bovenin dit bestand — niet opnieuw
    // dynamisch importeren want dat creëert een TDZ-shadow waarbij de
    // auth-try-block hierboven (regel 1934-1941) een ReferenceError krijgt.
    const entry = addEventClient(ws, yAppSid, instanceId);
    console.log(`[ws/events] client connected: instance=${instanceId} sid=${yAppSid.slice(0, 8)}...`);
    ws.send(JSON.stringify({ type: "connected", instance: instanceId }));

    // Helper: resolve een bridged ERPNext-sid + de y-app user-email +
    // de instance-URL voor deze (yAppSid, instance). De HTTP-middleware
    // doet dit via `authMiddleware`; voor WS doen we het expliciet zodat
    // subscribe-mail creds kan resolven uit ERPNext.
    async function getBridgedContext(): Promise<{ erpnextSid: string | null; userEmail: string | null; instanceUrl: string | null }> {
      try {
        const sd = getYAppSessionWithKey(yAppSid);
        if (!sd) return { erpnextSid: null, userEmail: null, instanceUrl: null };
        const inst = getInstanceForUser(instanceId, sd.user.id);
        if (!inst) return { erpnextSid: null, userEmail: sd.user.email, instanceUrl: null };
        const erp = await getOrCreateInstanceSession(sd.user.id, inst, sd.userKey);
        return { erpnextSid: erp?.sid || null, userEmail: sd.user.email, instanceUrl: inst.url };
      } catch (e) {
        console.warn(`[ws/events] bridge lookup failed: ${(e as Error).message}`);
        return { erpnextSid: null, userEmail: null, instanceUrl: null };
      }
    }

    // Best-effort fast-path: cache-hit zonder ERPNext-resolve. Volstaat
    // wanneer een eerdere mail-call in deze sessie de cache heeft gevuld.
    try {
      if (startIdleForCachedSession(yAppSid, instanceId)) {
        console.log(`[ws/events] auto-started IDLE for instance=${instanceId} (cached)`);
      }
    } catch (e) {
      console.warn(`[ws/events] auto-IDLE cached failed: ${(e as Error).message}`);
    }

    // Heartbeat: stuur elke 25s een ping zodat proxies/browsers de stille
    // WS niet als dood beschouwen (Vite dev-server sluit anders na ~30s).
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) {
        try { ws.ping(); } catch { /* ignore */ }
      } else {
        clearInterval(pingInterval);
      }
    }, 25_000);

    // Client kan subscriben op specifieke NC Talk-conversaties zodat de
    // server long-poll voor die rooms aanzet. De NC-creds komen mee in het
    // bericht (url + user + pass) zodat de loop NC kan bereiken.
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string;
          conversation?: string;
          ncUrl?: string;
          ncUser?: string;
          ncPass?: string;
          acct?: string;
          email?: string;
        };
        if (msg.type === "subscribe-conversation" && msg.conversation && msg.ncUrl && msg.ncUser && msg.ncPass) {
          subscribeConversation(entry, msg.conversation);
          ensureLongPoll(yAppSid, instanceId, msg.conversation, { url: msg.ncUrl, user: msg.ncUser, pass: msg.ncPass });
          // Mirror the per-conversation creds into the per-session cache so
          // generic HTTP routes (all-conversations / conversations / messages)
          // don't need creds in their URL anymore.
          setNcSession(yAppSid, instanceId, { ncUrl: msg.ncUrl, user: msg.ncUser, pass: msg.ncPass });
        } else if (msg.type === "unsubscribe-conversation" && msg.conversation) {
          unsubscribeConversation(entry, msg.conversation);
        } else if (msg.type === "subscribe-messenger" && msg.ncUrl && msg.ncUser && msg.ncPass) {
          // Wave 0a: frontend pushes NC Talk creds once over the WS so the
          // server can resolve them from cache on every messenger HTTP call,
          // killing the `pass=…` URL leak.
          setNcSession(yAppSid, instanceId, { ncUrl: msg.ncUrl, user: msg.ncUser, pass: msg.ncPass });
          try {
            ws.send(JSON.stringify({ type: "subscribe-messenger-ack", ok: true }));
          } catch { /* ignore */ }
        } else if (msg.type === "subscribe-mail") {
          // Plan A: start IMAP IDLE op basis van de primary email zodat
          // push werkt zonder dat de gebruiker Webmail hoeft te openen.
          // Email-resolution order: (1) wat de frontend stuurt, (2) y-app
          // account-email als fallback. Server doet vervolgens cache-hit OF
          // ERPNext-resolve.
          const acct = typeof msg.acct === "string" && msg.acct.length > 0 ? msg.acct : undefined;
          const hintedEmail = typeof msg.email === "string" && msg.email.length > 0 ? msg.email : undefined;
          (async () => {
            try {
              const { erpnextSid, userEmail, instanceUrl } = await getBridgedContext();
              const email = hintedEmail || userEmail || undefined;
              // Wikkel de resolve in erpRequestContext zodat de ERPNext-client
              // de juiste base-URL gebruikt (per-instance). Zonder context
              // probeert `fetch` een relative path en explodeert.
              const run = async () => ensureIdleForSession({
                yAppSid, instanceId,
                email, acct, erpnextSid: erpnextSid || undefined,
              });
              const result = instanceUrl
                ? await erpRequestContext.run({ url: instanceUrl }, run)
                : await run();
              console.log(`[ws/events] subscribe-mail instance=${instanceId} email=${email || "?"} acct=${acct || "<primary>"} → ${result.reason}`);
            } catch (e) {
              console.warn(`[ws/events] subscribe-mail failed: ${(e as Error).message}`);
            }
          })();
        }
      } catch { /* ignore malformed */ }
    });

    ws.on("close", (code, reason) => {
      console.log(`[ws/events] client disconnected: code=${code} reason=${reason?.toString() || "no reason"} instance=${instanceId}`);
      clearInterval(pingInterval);
      // Bij sluiten alle long-poll loops van deze (sessie, instance) opruimen
      // — andere clients in dezelfde sessie houden zelf hun subs open via
      // het ws-events.subscribedConversations register, dus alleen LOOPS
      // zonder enige listener stoppen automatisch in hun eigen loop-body.
      stopLoopsForSession(yAppSid, instanceId);
    });
  });
  console.log("[server] WebSocket events enabled at /ws/events");

  // Attach handler for terminal WS (noServer variant, upgrade gerouted hierboven).
  terminalWss.on("connection", async (ws, req) => {
    const cookieHeader = req.headers.cookie || "";

    // Y-app session + instance id from query string.
    // Frontend appends ?instance=<id> when opening the WebSocket.
    const yAppMatch = cookieHeader.match(/y_app_session=([^;]+)/);
    if (yAppMatch && req.url) {
      const yAppSid = yAppMatch[1];
      const url = new URL(req.url, "http://localhost");
      const instanceParam = url.searchParams.get("instance");
      if (instanceParam) {
        const instanceId = parseInt(instanceParam, 10);
        if (!Number.isNaN(instanceId)) {
          try {
            const sessionData = getYAppSessionWithKey(yAppSid);
            if (sessionData) {
              const instance = getInstanceForUser(instanceId, sessionData.user.id);
              if (instance) {
                const erpSession = await getOrCreateInstanceSession(sessionData.user.id, instance, sessionData.userKey);
                if (erpSession) {
                  handleTerminalConnection(ws, erpSession.sid);
                  return;
                }
              }
            }
          } catch (err) {
            console.error("[ws] bridged Y-app auth failed:", (err as Error).message);
          }
        }
      }
    }

    ws.close(4001, "Unauthorized");
  });
  console.log("[server] WebSocket terminal enabled at /ws/terminal");

  return new Promise((resolve) => {
    server.listen(listenPort, () => {
      const actualPort = (server.address() as { port: number }).port;
      console.log(`[server] Backend running on http://localhost:${actualPort}`);

      // Eagerly warm up all mail accounts (IMAP connections + INBOX preload)
      mailStartupWarmup().catch(err => console.error("[mail-warmup] Startup error:", err));

      // Run health checks in background after startup (30s delay)
      setTimeout(() => {
        console.log("[server] Starting automatic health checks...");
        runAllTests().catch(err => console.error("[health] Auto-run failed:", err));
      }, 30_000);

      resolve(actualPort);
    });
  });
}

// Prevent crashes from unhandled promise rejections (e.g. IMAP timeouts)
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err);
});

startServer().catch((err) => {
  console.error("[server] Fatal error:", err);
  process.exit(1);
});
