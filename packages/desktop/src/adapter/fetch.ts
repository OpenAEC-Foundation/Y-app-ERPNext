import { invoke } from "@tauri-apps/api/core";
import { getActiveInstance } from "@frontend/lib/instances";
import { getAllCredentials, getInstanceCredentials, setInstanceCredentials, listMailAccounts, upsertMailAccount, removeMailAccount, type InstanceCredentials, type MailAccount } from "./vault";
import { computeUrenStats, computeUrenDetail } from "./stats";
// Gedeelde ICS-builder met de web-server (routes/calendar.ts) — één bron,
// geen drift tussen web- en desktop-agenda-events.
import { buildICalEvent } from "../../../server/src/ical-build";
// Gedeeld wire-contract met de web-server-handlers (Fase 5 drift-safety).
// De server bindt dezelfde shapes met `satisfies`; loopt een envelope hier
// uit de pas, dan faalt tsc i.p.v. dat de frontend het stil negeert.
import type {
  MailFoldersResponse,
  MailFolderShape,
  MailUnseenSummaryResponse,
  UnseenFolderShape,
  MessengerConversationsResponse,
  MessengerConversationShape,
  MessengerMessagesResponse,
  MessengerMessageShape,
} from "@frontend/lib/api-shapes";

let interceptorInstalled = false;
let credentialCache: InstanceCredentials[] = [];
/** Saved before the interceptor overwrites window.fetch — used for external
 *  HTTP calls (e.g. OAuth2 token refresh to Microsoft) that must bypass the
 *  /api/* interceptor. */
let originalFetch: typeof window.fetch = window.fetch.bind(window);

/** Call after vault unlock to load credentials into memory */
export async function loadCredentialCache() {
  credentialCache = await getAllCredentials();
  // Popout-sneltoegang: deel de ontsleutelde snapshot via Rust-procesgeheugen
  // zodat een popout-venster de kluis (Argon2, seconden) niet opnieuw hoeft
  // te openen. Best-effort; gewist bij vergrendelen (session_clear_unlock).
  if (credentialCache.length > 0) {
    invoke("session_put_creds", { json: JSON.stringify(credentialCache) }).catch(() => {});
  }
}

function getCredsForInstance(id: number): InstanceCredentials | undefined {
  return credentialCache.find((c) => c.instance_id === id);
}

/** NextCloud Talk creds for the desktop messenger routes. The Stronghold vault
 *  only stores erpnext_* at instance-add; NC creds are configured in Settings →
 *  Berichten, which writes localStorage (shared frontend), exactly like the web.
 *  So resolve from the vault first, then fall back to localStorage. Returns null
 *  unless url+user+pass are all present. */
function getNcCreds(instanceId: number): { url: string; user: string; pass: string } | null {
  const v = getCredsForInstance(instanceId);
  let url = v?.nextcloud_talk_url || v?.nextcloud_url
    || localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_url`)
    || localStorage.getItem(`pref_${instanceId}_nextcloud_url`) || "";
  const user = v?.nextcloud_talk_user || v?.nextcloud_user
    || localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_user`)
    || localStorage.getItem(`pref_${instanceId}_nextcloud_user`) || "";
  const pass = v?.nextcloud_talk_pass || v?.nextcloud_pass
    || localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_pass`)
    || localStorage.getItem(`pref_${instanceId}_nextcloud_pass`) || "";
  if (url && !/^https?:\/\//.test(url)) url = `https://${url}`;
  return url && user && pass ? { url, user, pass } : null;
}

/** Pull de gedeelde, niet-geheime werkgever-config van de Y-app-server naar de
 *  lokale store (best-effort). Het Rust-commando forward't de ERPNext-sid naar
 *  /api/desktop-config en schrijft de keys lokaal weg. Offline / geen creds →
 *  stil; de bestaande lokale cache blijft dan leidend. */
export async function syncConfigForInstance(instanceId: number, instanceUrl: string): Promise<void> {
  try {
    const creds = getCredsForInstance(instanceId);
    if (!creds || !instanceUrl) return;
    await invoke("sync_instance_config", {
      instanceId,
      instanceUrl,
      username: creds.erpnext_username,
      password: creds.erpnext_password,
    });
  } catch {
    /* offline / geen sessie → lokale cache gebruiken */
  }
}

/** Per-instance IMAP + SMTP creds for the active mail session. Filled by
 * ensureMailCredsPopulated (local vault → ERPNext resolve) before any mail
 * route runs, or overwritten by an explicit POST /api/mail/config. Mirrors the
 * server's per-session mail-session cache, but here a single-user single-
 * process map suffices (one Y-app instance = one mail account at a time). SMTP
 * fields are optional — when missing the Rust mail_send derives smtp host =
 * imap host, port 587 + STARTTLS. */
const desktopMailCreds = new Map<number, MailCredsPayload>();
interface MailCredsPayload {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  authMode?: string;
  accessToken?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}

/** In-flight guard: concurrent first-load mail requests (folders + messages +
 *  warmup fire together) must trigger only ONE ERPNext resolve. */
const mailCredsResolving = new Map<number, Promise<void>>();

/**
 * Resolve IMAP/SMTP creds for a PASSWORD-authenticated mailbox from the
 * instance's ERPNext "Email Account" doctype. Mirrors the password branch of
 * mailAutoConfigInternal (packages/server/src/mail.ts): an account with an
 * empty `connected_app` is, by definition, password-authenticated. Returns
 * null for OAuth accounts (no usable password), missing Email Accounts, or
 * when the password cannot be read — none of those are resolvable this way.
 */
async function resolveMailCredsFromErpnext(
  instanceId: number,
  email: string,
): Promise<MailCredsPayload | null> {
  if (!email) return null;
  try {
    const filters = JSON.stringify([["email_id", "=", email]]);
    const fields = JSON.stringify(["name", "email_id", "email_server", "incoming_port", "use_ssl", "smtp_server", "smtp_port", "use_ssl_for_outgoing", "connected_app"]);
    const accRes = await erpnextFetch(instanceId,
      `/api/resource/Email Account?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`);
    const accounts = JSON.parse(accRes.body)?.data || [];
    if (accounts.length === 0) return null;
    const acc = accounts[0];
    // A linked Connected App means OAuth2 — no password to resolve here.
    if (acc.connected_app) return null;
    let password = "";
    try {
      const pwRes = await erpnextFetch(instanceId,
        `/api/method/frappe.client.get_password?doctype=Email+Account&name=${encodeURIComponent(acc.name)}&fieldname=password`);
      password = JSON.parse(pwRes.body)?.message || "";
    } catch { /* no readable password */ }
    if (!password) return null;
    return {
      host: acc.email_server || "",
      port: parseInt(acc.incoming_port || "993"),
      user: email,
      pass: password,
      secure: !!acc.use_ssl,
      authMode: "password",
      smtpHost: acc.smtp_server || acc.email_server || "",
      smtpPort: parseInt(acc.smtp_port || "587"),
      smtpSecure: !!acc.use_ssl_for_outgoing || parseInt(acc.smtp_port || "0", 10) === 465,
    };
  } catch {
    return null;
  }
}

/**
 * Ensure desktopMailCreds holds IMAP/SMTP creds for this instance BEFORE a mail
 * route runs. The web server resolves creds per-request in getCredentials();
 * the desktop has no server, so we mirror that locally, in priority order:
 *   1. creds already in the map (explicit /api/mail/config or test) → keep them
 *   2. local Stronghold vault has imap_* → use them (works fully offline)
 *   3. resolve on-demand from ERPNext (password accounts) AND persist into the
 *      vault, so mail keeps working offline + after restart without re-hitting
 *      ERPNext.
 * Resolved creds never leave the device (no Y-app server involved) — this is
 * the "mail accounts stay local in the desktop vault" decision in code.
 */
async function ensureMailCredsPopulated(instanceId: number, url: string): Promise<void> {
  // Account-aware: when Webmail sends ?account=<id> (it does once vault mail
  // accounts exist), the selected vault account wins. Re-resolved on every call
  // because the active account changes via the Webmail account-tabs.
  const accountId = new URL(url, "http://x").searchParams.get("account");
  if (accountId) {
    const vault = getCredsForInstance(instanceId);
    const acc = vault?.mail_accounts?.find((a) => a.id === accountId);
    if (acc) {
      desktopMailCreds.set(instanceId, {
        host: acc.imapHost,
        port: acc.imapPort,
        user: acc.username,
        pass: acc.password,
        secure: acc.imapSecure,
        authMode: "password",
        smtpHost: acc.smtpHost || acc.imapHost,
        smtpPort: acc.smtpPort,
        smtpSecure: acc.smtpSecure,
      });
      return;
    }
    // Unknown id (e.g. the synthetic "erpnext-auto" tab): use the auto-resolved
    // imap_* fields so switching back from a manual account does not keep that
    // account's stale creds in the map.
    if (vault?.imap_host && vault?.imap_user && vault?.imap_pass) {
      desktopMailCreds.set(instanceId, {
        host: vault.imap_host,
        port: vault.imap_port ?? 993,
        user: vault.imap_user,
        pass: vault.imap_pass,
        secure: (vault.imap_port ?? 993) !== 143,
        authMode: "password",
        smtpHost: vault.smtp_host || vault.imap_host,
        smtpPort: vault.smtp_port,
        smtpSecure: vault.smtp_port === 465,
      });
      return;
    }
  }
  if (desktopMailCreds.has(instanceId)) return;
  const inflight = mailCredsResolving.get(instanceId);
  if (inflight) return inflight;

  const run = (async () => {
    // 1/2. Local vault — survives restart, works offline.
    const vault = getCredsForInstance(instanceId);
    if (vault?.imap_host && vault?.imap_user && vault?.imap_pass) {
      desktopMailCreds.set(instanceId, {
        host: vault.imap_host,
        port: vault.imap_port ?? 993,
        user: vault.imap_user,
        pass: vault.imap_pass,
        secure: (vault.imap_port ?? 993) !== 143,
        authMode: "password",
        smtpHost: vault.smtp_host || vault.imap_host,
        smtpPort: vault.smtp_port,
        smtpSecure: vault.smtp_port === 465,
      });
      return;
    }

    // 3. Resolve from ERPNext, then persist locally. Prefer the primary
    // mailbox (delegated shared mailboxes must resolve via the primary, not
    // their own — often unlicensed — Email Account; see CLAUDE.md).
    const params = new URL(url, "http://x").searchParams;
    const email = params.get("primaryEmail") || params.get("email") || vault?.erpnext_username || "";
    const resolved = await resolveMailCredsFromErpnext(instanceId, email);
    if (!resolved) return;
    desktopMailCreds.set(instanceId, resolved);
    try {
      const existing = await getInstanceCredentials(instanceId);
      if (existing) {
        await setInstanceCredentials({
          ...existing,
          imap_host: resolved.host,
          imap_port: resolved.port,
          imap_user: resolved.user,
          imap_pass: resolved.pass,
          smtp_host: resolved.smtpHost || resolved.host,
          smtp_port: resolved.smtpPort,
          smtp_user: resolved.user,
          smtp_pass: resolved.pass,
        });
        await loadCredentialCache();
      }
    } catch { /* vault locked → in-memory creds still serve this session */ }
  })().finally(() => mailCredsResolving.delete(instanceId));

  mailCredsResolving.set(instanceId, run);
  return run;
}

/** Bouw een JSON-Response. Geef expliciet een type-argument mee op plekken
 *  waar de payload een gedeeld wire-contract volgt (api-shapes.ts) — dan
 *  bewaakt tsc dat de desktop-envelope gelijk blijft aan de server-envelope. */
function jsonResponse<T = unknown>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Make an ERPNext API call through the Rust backend for the active instance. */
async function erpnextFetch(
  instanceId: number,
  path: string,
  method: string = "GET",
  body: string | null = null,
): Promise<{ status: number; body: string }> {
  const instancesList = await invoke<{ instances: any[] }>("list_instances");
  const inst = instancesList.instances.find((i: any) => i.id === instanceId);
  if (!inst) throw new Error("Instance not found");
  const creds = getCredsForInstance(instanceId);
  if (!creds) throw new Error("No credentials for instance");
  return invoke<{ status: number; body: string; headers: Record<string, string> }>(
    "erpnext_request_with_creds",
    {
      instanceId,
      instanceUrl: inst.url,
      username: creds.erpnext_username,
      password: creds.erpnext_password,
      method,
      path,
      body,
    },
  );
}

/**
 * Resolve Basic-auth creds for an authenticated CalDAV collection from the
 * instance's vault mail-account (same host as the calendar URL). Mirrors the
 * web's getDecryptedMailCredentials(account) path — no plaintext password is
 * kept client-side. Falls back to the auto-resolved imap_* fields when the
 * selected account is the synthetic "erpnext-auto" row (or otherwise not a
 * stored mail account).
 */
async function resolveCalDavCreds(
  instanceId: number,
  accountId: string,
): Promise<{ user: string; pass: string } | null> {
  const acc = (await listMailAccounts(instanceId)).find((a) => a.id === accountId);
  if (acc?.username && acc.password) return { user: acc.username, pass: acc.password };
  const vault = await getInstanceCredentials(instanceId);
  if (vault?.imap_user && vault?.imap_pass) return { user: vault.imap_user, pass: vault.imap_pass };
  return null;
}

/**
 * Discover + read all VEVENT iCalendar text from an authenticated CalDAV
 * collection (e.g. https://mail.3bm.co.nl/dav/cal/). Mirrors the web's
 * fetchCalDavIcs in packages/server/src/routes/calendar.ts: current-user-
 * principal → calendar-home-set → PROPFIND Depth:1 for calendar collections →
 * calendar-query REPORT per calendar. The webview may not do cross-origin
 * PROPFIND/REPORT (CORS + no auth), so every request goes through the Rust
 * `dav_request` bridge. Returns the concatenated raw ICS.
 */
async function davDiscoverIcs(user: string, pass: string, base: string): Promise<string> {
  const origin = new URL(base).origin;
  const dav = (m: string, u: string, b: string, depth = "1") =>
    invoke<[number, string]>("dav_request", {
      method: m, url: u, user, pass,
      contentType: 'application/xml; charset="utf-8"', depth, body: b,
    });
  const xmlUnescape = (s: string) => s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&#13;/g, "\r").replace(/&#10;/g, "\n").replace(/&amp;/g, "&");

  // 1. calendar-home-set probe (Depth:0)
  let homeUrl = base;
  try {
    const [, hpXml] = await dav("PROPFIND", base,
      '<?xml version="1.0" encoding="utf-8"?>\n<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:current-user-principal/><c:calendar-home-set/></d:prop></d:propfind>',
      "0");
    const homeM = hpXml.match(/<[a-z0-9]*:?calendar-home-set[^>]*>[\s\S]*?<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/i);
    if (homeM) homeUrl = new URL(xmlUnescape(homeM[1].trim()), origin).href;
  } catch { /* val terug op base */ }

  // 2. calendar-collecties zoeken (Depth:1)
  const [pfStatus, pfXml] = await dav("PROPFIND", homeUrl,
    '<?xml version="1.0" encoding="utf-8"?>\n<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>');
  if (pfStatus === 401) throw new Error("CalDAV auth failed (401)");
  if (pfStatus >= 400 && pfStatus !== 207) throw new Error(`CalDAV PROPFIND returned ${pfStatus}`);
  const calendarHrefs: string[] = [];
  const responseRe = /<[a-z0-9]*:?response[\s>][\s\S]*?<\/[a-z0-9]*:?response>/gi;
  let m: RegExpExecArray | null;
  while ((m = responseRe.exec(pfXml)) !== null) {
    const resp = m[0];
    const hrefM = resp.match(/<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/i);
    if (!hrefM) continue;
    const rtM = resp.match(/<[a-z0-9]*:?resourcetype[^>]*>([\s\S]*?)<\/[a-z0-9]*:?resourcetype>/i);
    if (rtM && /<[a-z0-9]*:?calendar[\s/>]/i.test(rtM[1])) {
      calendarHrefs.push(new URL(xmlUnescape(hrefM[1].trim()), origin).href);
    }
  }
  if (calendarHrefs.length === 0) calendarHrefs.push(homeUrl);

  // 3. calendar-query REPORT per kalender → calendar-data
  const reportBody = '<?xml version="1.0" encoding="utf-8"?>\n<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>';
  let ics = "";
  for (const cal of calendarHrefs) {
    try {
      const [repStatus, repXml] = await dav("REPORT", cal, reportBody, "1");
      if (repStatus === 207 || (repStatus >= 200 && repStatus < 300)) {
        const dataRe = /<[a-z0-9]*:?calendar-data[^>]*>([\s\S]*?)<\/[a-z0-9]*:?calendar-data>/gi;
        let dm: RegExpExecArray | null;
        while ((dm = dataRe.exec(repXml)) !== null) ics += xmlUnescape(dm[1]) + "\n";
      }
    } catch { /* sla deze kalender over, probeer de volgende */ }
  }
  return ics;
}

/**
 * Installs a fetch interceptor that routes /api/* through Tauri invoke()
 * instead of HTTP. The Rust backend handles ERPNext requests directly.
 */
export function installDesktopFetchInterceptor() {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  const originalFetch = window.fetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.toString();
    else url = input.url;

    // Only intercept /api/* requests
    if (!url.startsWith("/api/")) {
      return originalFetch.call(window, input, init);
    }

    const method = init?.method || "GET";
    const body = init?.body ? String(init.body) : null;

    // Get active instance
    const activeInst = getActiveInstance();
    const instanceId = activeInst ? parseInt(activeInst.id, 10) : 0;

    // ── Routes handled locally by Rust commands ──

    // Y-app session (always logged in on desktop)
    if (url === "/api/yapp/me") {
      const data = await invoke("yapp_me");
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    // ERPNext user context (username, fullName, roles) — door de Sidebar gebruikt
    // voor module-zichtbaarheid. Zonder dit bleef `roles` leeg → getAccessiblePages([])
    // gaf alleen de universele pagina's terug en werden alle werkgever-modules
    // weggefilterd. Spiegelt het web-pad in server/src/auth.ts (get_logged_user →
    // User-doc voor full_name → get_roles voor de rollen).
    if (url === "/api/auth/me" && method === "GET") {
      if (!instanceId) return jsonResponse({ username: "", fullName: "", roles: [] });
      try {
        const luRes = await erpnextFetch(instanceId, "/api/method/frappe.auth.get_logged_user");
        const email = String(JSON.parse(luRes.body)?.message || "");
        if (!email) return jsonResponse({ username: "", fullName: "", roles: [] });
        let fullName = email;
        let roles: string[] = [];
        try {
          const fields = encodeURIComponent('["full_name","first_name","last_name"]');
          const userRes = await erpnextFetch(instanceId, `/api/resource/User/${encodeURIComponent(email)}?fields=${fields}`);
          const u = JSON.parse(userRes.body)?.data;
          if (u) fullName = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || email;
        } catch { /* fullName is cosmetisch — negeer */ }
        try {
          // get_roles werkt ook voor niet-System-Manager-gebruikers (de User-doc
          // geeft de rollen niet altijd terug); zelfde keuze als het web-pad.
          const rolesRes = await erpnextFetch(instanceId, `/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(email)}`);
          const r = JSON.parse(rolesRes.body)?.message;
          if (Array.isArray(r)) roles = r;
        } catch { /* rollen best-effort */ }
        return jsonResponse({ username: email, fullName, roles });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // Instance CRUD
    if (url === "/api/instances" && method === "GET") {
      const data = await invoke("list_instances");
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "/api/instances" && method === "POST") {
      const data = await invoke("add_instance", { input: body ? JSON.parse(body) : {} });
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.match(/^\/api\/instances\/(\d+)$/) && method === "PUT") {
      const id = parseInt(url.split("/")[3], 10);
      const data = await invoke("update_instance", { id, input: body ? JSON.parse(body) : {} });
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.match(/^\/api\/instances\/(\d+)$/) && method === "DELETE") {
      const id = parseInt(url.split("/")[3], 10);
      await invoke("delete_instance", { id });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "/api/instances/test" && method === "POST") {
      const parsed = body ? JSON.parse(body) : {};
      const data = await invoke("test_instance", {
        url: parsed.url,
        username: parsed.erpnextUsername || parsed.username,
        password: parsed.erpnextPassword || parsed.password,
      });
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    }

    // Instance settings
    const settingsMatch = url.match(/^\/api\/instances\/(\d+)\/settings(?:\/(.+))?$/);
    if (settingsMatch) {
      const id = parseInt(settingsMatch[1], 10);
      const key = settingsMatch[2];
      if (method === "GET" && !key) {
        // Web shape: { ok: true, settings: { key: <parsed> } } (index.ts).
        const all = await invoke<Record<string, string>>("get_instance_settings", { id });
        const settings: Record<string, unknown> = {};
        for (const k of Object.keys(all)) {
          try { settings[k] = JSON.parse(all[k]); } catch { settings[k] = all[k]; }
        }
        return new Response(JSON.stringify({ ok: true, settings }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "GET" && key) {
        // Web shape: { ok: true, value: <parsed|null> }. The frontend reads
        // `data.ok && data.value` — a bare value silently dropped the setting.
        const all = await invoke<Record<string, string>>("get_instance_settings", { id });
        const val = all[key];
        return new Response(JSON.stringify({ ok: true, value: val ? JSON.parse(val) : null }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "PUT" && key) {
        const parsed = body ? JSON.parse(body) : {};
        await invoke("put_instance_setting", { id, key, value: JSON.stringify(parsed.value ?? parsed) });
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
    }

    // User settings
    const userSettingsMatch = url.match(/^\/api\/user-settings\/(.+)$/);
    if (userSettingsMatch) {
      // Web shape: { ok: true, value: <parsed|null> } (index.ts /user-settings).
      const data = await invoke<string | null>("get_user_setting", { key: userSettingsMatch[1] });
      return new Response(JSON.stringify({ ok: true, value: data ? JSON.parse(data) : null }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // Per-account connection test (web: POST .../mail-accounts/:id/test). The
    // catch-all mailAcctMatch regex below stops at the id and never matches the
    // "/test" suffix, so this must come first or the Test button silently fails.
    const mailAcctTestMatch = url.match(/^\/api\/instances\/(\d+)\/mail-accounts\/([^/?]+)\/test$/);
    if (mailAcctTestMatch && method === "POST") {
      const id = parseInt(mailAcctTestMatch[1], 10);
      const accId = mailAcctTestMatch[2];
      let testCreds: { host: string; port: number; user: string; pass: string; secure: boolean } | null = null;
      const acc = (await listMailAccounts(id)).find((a) => a.id === accId);
      if (acc) {
        testCreds = { host: acc.imapHost, port: acc.imapPort, user: acc.username, pass: acc.password, secure: acc.imapSecure };
      } else {
        // Synthetic "erpnext-auto" account → test the auto-resolved imap_* fields.
        const vault = await getInstanceCredentials(id);
        if (vault?.imap_host && vault?.imap_user && vault?.imap_pass) {
          testCreds = { host: vault.imap_host, port: vault.imap_port ?? 993, user: vault.imap_user, pass: vault.imap_pass, secure: (vault.imap_port ?? 993) !== 143 };
        }
      }
      if (!testCreds) return jsonResponse({ ok: false, message: "Mail account not found" }, 404);
      try {
        await invoke("mail_test", { creds: { ...testCreds, authMode: "password" } });
        return jsonResponse({ ok: true, message: `Verbonden als ${testCreds.user}` });
      } catch (e) {
        return jsonResponse({ ok: false, message: String(e) });
      }
    }

    // Mail accounts (vault-backed; desktop equivalent of the web's mail_accounts
    // table). The web encrypts with the Y-app userKey; here they live in the
    // Stronghold vault. Passwords are never returned by the GET list. Same wire
    // shapes as index.ts so MailAccountSettings.tsx works unchanged.
    const mailAcctMatch = url.match(/^\/api\/instances\/(\d+)\/mail-accounts(?:\/([^/?]+))?$/);
    if (mailAcctMatch) {
      const id = parseInt(mailAcctMatch[1], 10);
      const accountId = mailAcctMatch[2];
      const strip = (a: MailAccount) => { const { password: _pw, ...rest } = a; return rest; };

      if (method === "GET" && !accountId) {
        const vault = await getInstanceCredentials(id);
        const accounts = (vault?.mail_accounts ?? []).map(strip);
        // Also surface the auto-resolved mailbox (the single imap_* fields,
        // filled from ERPNext by ensureMailCredsPopulated) so the user sees
        // their loaded account in Settings → Email accounts even though it was
        // never manually added.
        if (
          vault?.imap_host &&
          vault?.imap_user &&
          !accounts.some((a) => a.email === vault.imap_user)
        ) {
          accounts.push({
            id: "erpnext-auto",
            email: vault.imap_user,
            label: `${vault.imap_user} (automatisch uit ERPNext)`,
            imapHost: vault.imap_host,
            imapPort: vault.imap_port ?? 993,
            imapSecure: (vault.imap_port ?? 993) !== 143,
            smtpHost: vault.smtp_host || vault.imap_host,
            smtpPort: vault.smtp_port,
            smtpSecure: vault.smtp_port === 465,
            username: vault.imap_user,
          });
        }
        return jsonResponse({ ok: true, accounts });
      }
      if (method === "POST" && !accountId) {
        const b = body ? JSON.parse(body) : {};
        if (!b.email || !b.imapHost || !b.smtpHost) {
          return jsonResponse({ error: "email, imapHost en smtpHost zijn verplicht" }, 400);
        }
        // MailAccountSettings.tsx nests the username/password under `credentials`
        // (the web server reads input.credentials.username/.password). Read from
        // there first, with a top-level fallback for robustness — otherwise the
        // password is stored empty and every IMAP login fails AUTHENTICATIONFAILED.
        const cr = b.credentials ?? {};
        const acc: MailAccount = {
          id: crypto.randomUUID(),
          email: b.email,
          label: b.label || b.email,
          imapHost: b.imapHost,
          imapPort: Number(b.imapPort) || 993,
          imapSecure: b.imapSecure !== false,
          smtpHost: b.smtpHost,
          smtpPort: Number(b.smtpPort) || 587,
          smtpSecure: !!b.smtpSecure,
          username: cr.username || b.username || b.email,
          password: String(cr.password ?? b.password ?? ""),
        };
        await upsertMailAccount(id, acc);
        await loadCredentialCache();
        return jsonResponse({ ok: true, account: strip(acc) });
      }
      if (method === "PUT" && accountId) {
        const b = body ? JSON.parse(body) : {};
        // Credentials are nested under `credentials` (see POST above). An empty
        // password means "keep the existing one" — mirrors the web update route.
        const cr = b.credentials ?? {};
        const newPass = cr.password ?? b.password;
        const existing = (await listMailAccounts(id)).find((a) => a.id === accountId);
        if (!existing) {
          // The synthetic "erpnext-auto" row isn't a stored account, so editing
          // it would 404 ("Opslaan mislukt"). Materialize it into a real vault
          // account instead, pulling the auto-resolved password from imap_* when
          // the form leaves it blank (the synthetic row never exposes a password).
          const vault = await getInstanceCredentials(id);
          const acc: MailAccount = {
            id: crypto.randomUUID(),
            email: b.email ?? vault?.imap_user ?? "",
            label: b.label ?? b.email ?? vault?.imap_user ?? "",
            imapHost: b.imapHost ?? vault?.imap_host ?? "",
            imapPort: b.imapPort != null ? Number(b.imapPort) : (vault?.imap_port ?? 993),
            imapSecure: b.imapSecure ?? ((vault?.imap_port ?? 993) !== 143),
            smtpHost: b.smtpHost ?? vault?.smtp_host ?? vault?.imap_host ?? "",
            smtpPort: b.smtpPort != null ? Number(b.smtpPort) : (vault?.smtp_port ?? 587),
            smtpSecure: b.smtpSecure ?? (vault?.smtp_port === 465),
            username: cr.username ?? b.username ?? vault?.imap_user ?? "",
            password: String(newPass ?? vault?.imap_pass ?? ""),
          };
          if (!acc.email || !acc.imapHost || !acc.password) {
            return jsonResponse({ error: "Mail account not found" }, 404);
          }
          await upsertMailAccount(id, acc);
          await loadCredentialCache();
          return jsonResponse({ ok: true, account: strip(acc) });
        }
        const acc: MailAccount = {
          ...existing,
          email: b.email ?? existing.email,
          label: b.label ?? existing.label,
          imapHost: b.imapHost ?? existing.imapHost,
          imapPort: b.imapPort != null ? Number(b.imapPort) : existing.imapPort,
          imapSecure: b.imapSecure ?? existing.imapSecure,
          smtpHost: b.smtpHost ?? existing.smtpHost,
          smtpPort: b.smtpPort != null ? Number(b.smtpPort) : existing.smtpPort,
          smtpSecure: b.smtpSecure ?? existing.smtpSecure,
          username: cr.username ?? b.username ?? existing.username,
          password: newPass ? String(newPass) : existing.password,
        };
        await upsertMailAccount(id, acc);
        await loadCredentialCache();
        return jsonResponse({ ok: true, account: strip(acc) });
      }
      if (method === "DELETE" && accountId) {
        const ok = await removeMailAccount(id, accountId);
        await loadCredentialCache();
        return ok ? jsonResponse({ ok: true }) : jsonResponse({ error: "Mail account not found" }, 404);
      }
    }

    // Preferences
    if (url === "/api/desktop/preferences" && method === "GET") {
      const data = await invoke("get_all_preferences");
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "/api/desktop/preferences" && method === "POST") {
      const parsed = body ? JSON.parse(body) : {};
      await invoke("set_preference", { key: parsed.key, value: parsed.value });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // Open een externe http(s)-link in de systeembrowser. Nodig omdat een
    // Tauri-webview window.open()/target="_blank" slikt (geen echte tabs, geen
    // window-creation-permissie). De gedeelde mail-link-handler
    // (packages/frontend/src/lib/mail-format.ts) POST hierheen op desktop; web
    // heeft deze route niet en opent gewoon een browsertabblad. Gebruikt de al
    // geregistreerde shell-plugin (tauri_plugin_shell + shell:allow-open) —
    // geen extra dependency/permissie nodig. Body: { url } → { ok } of { error }.
    if (url === "/api/desktop/open-external" && method === "POST") {
      const parsed = body ? JSON.parse(body) : {};
      const target = String(parsed.url || "");
      if (!/^https?:\/\//i.test(target)) return jsonResponse({ error: "invalid_url" }, 400);
      try {
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(target);
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // ── NAS projectmappen (desktop-only) ──────────────────────────────
    // Recursieve native map-kopie via Rust. De web-build (Express) heeft deze
    // route niet, dus de knop in ProjectDetail is daar verborgen via
    // isDesktopApp(). Body: { masterPath, targetPath } → { ok } of { error }.
    if (url === "/api/nas/create-folders" && method === "POST") {
      const parsed = body ? JSON.parse(body) : {};
      const masterPath = String(parsed.masterPath || "");
      const targetPath = String(parsed.targetPath || "");
      if (!masterPath || !targetPath) {
        return jsonResponse({ error: "missing_paths" }, 400);
      }
      try {
        await invoke("create_project_folders", { masterPath, targetPath });
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // Open een projectmap in de OS-bestandsbeheerder (Verkenner). Desktop-only.
    // Body: { path } → { ok } of { error } (404 not_found als de map niet bestaat).
    if (url === "/api/nas/open-folder" && method === "POST") {
      const parsed = body ? JSON.parse(body) : {};
      const path = String(parsed.path || "");
      if (!path) {
        return jsonResponse({ error: "missing_path" }, 400);
      }
      try {
        await invoke("open_in_explorer", { path });
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // Native map-picker dialoog. Desktop-only.
    // → { ok, path } (path = "" als geannuleerd) of { error }.
    if (url === "/api/nas/pick-folder" && method === "POST") {
      try {
        const path = await invoke<string | null>("pick_folder");
        return jsonResponse({ ok: true, path: path || "" });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 500);
      }
    }

    // Meetings
    if (url === "/api/meetings" && method === "GET") {
      const data = await invoke<any[]>("list_meetings");
      return new Response(JSON.stringify(data.map((m: any) => JSON.parse(m.data))), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "/api/meetings" && method === "POST") {
      const parsed = body ? JSON.parse(body) : {};
      const id = parsed.id || crypto.randomUUID();
      await invoke("save_meeting", { id, data: body });
      return new Response(JSON.stringify({ ...parsed, id }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.match(/^\/api\/meetings\//) && method === "PUT") {
      const id = url.split("/")[3];
      await invoke("save_meeting", { id, data: body });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.match(/^\/api\/meetings\//) && method === "DELETE") {
      const id = url.split("/")[3];
      await invoke("delete_meeting", { id });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // Services — report which messenger services are configured for this instance
    if (url === "/api/services") {
      const svcCreds = instanceId ? getCredsForInstance(instanceId) : undefined;
      const nc = instanceId ? getNcCreds(instanceId) : null;
      return new Response(
        JSON.stringify({
          nextcloud: nc?.url ?? null,
          telegram: svcCreds?.telegram_token ? true : null,
          mailHost: svcCreds?.imap_host ?? null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    // ── Messenger (NextCloud Talk + Telegram) ──
    // Matches the CURRENT frontend contract (Messenger.tsx): list via
    // all-conversations / conversations, history via /messages?conversation=,
    // send via POST /send. The web pushes NC creds to a server cache over the
    // /ws/events WebSocket; the desktop has no such server, so getNcCreds
    // resolves them (vault → localStorage). All list/history responses use the
    // { data: [...] } envelope the frontend reads (json.data).

    // GET /api/messenger/all-conversations  +  GET /api/messenger/conversations
    if (method === "GET" && (
      url.startsWith("/api/messenger/all-conversations") ||
      url === "/api/messenger/conversations" ||
      url.startsWith("/api/messenger/conversations?")
    )) {
      const out: MessengerConversationShape[] = [];
      const nc = instanceId ? getNcCreds(instanceId) : null;
      if (nc) {
        try {
          out.push(...await invoke<MessengerConversationShape[]>("messenger_list_conversations", {
            platform: "nextcloud-talk", url: nc.url, user: nc.user, pass: nc.pass, token: null,
          }));
        } catch { /* service unavailable — skip silently */ }
      }
      const tgToken = instanceId ? getCredsForInstance(instanceId)?.telegram_token : null;
      if (tgToken) {
        try {
          out.push(...await invoke<MessengerConversationShape[]>("messenger_list_conversations", {
            platform: "telegram", url: null, user: null, pass: null, token: tgToken,
          }));
        } catch { /* service unavailable — skip silently */ }
      }
      // Mirror the web ordering: pinned first, then newest lastMessageTime first.
      out.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return tb - ta;
      });
      return jsonResponse<MessengerConversationsResponse>({ data: out });
    }

    // GET /api/messenger/messages?conversation=<id>&platform=<p>
    if (url.startsWith("/api/messenger/messages") && method === "GET") {
      const q = new URL(url, "http://x").searchParams;
      const roomId = q.get("conversation") ?? "";
      const platform = q.get("platform") ?? "nextcloud-talk";
      const limit = parseInt(q.get("limit") ?? "50", 10);
      if (!roomId) return jsonResponse<MessengerMessagesResponse>({ data: [] });
      const nc = instanceId ? getNcCreds(instanceId) : null;
      if (platform === "nextcloud-talk" && nc) {
        try {
          // Rust levert { messages, lastGivenId } — lastGivenId is het hoogste
          // RAUWE NC-id (incl. noise-gefilterde rijen) zodat mark-read de
          // read-marker voorbij gefilterde events (reacties e.d.) kan zetten.
          const page = await invoke<{ messages: MessengerMessageShape[]; lastGivenId?: number }>(
            "messenger_get_messages",
            { platform: "nextcloud-talk", url: nc.url, user: nc.user, pass: nc.pass, roomId, limit },
          );
          return jsonResponse<MessengerMessagesResponse>({
            data: page.messages,
            ...(typeof page.lastGivenId === "number" ? { lastGivenId: page.lastGivenId } : {}),
          });
        } catch (e) {
          return jsonResponse({ error: String(e) }, 502);
        }
      }
      // Telegram has no per-chat history via getUpdates.
      return jsonResponse<MessengerMessagesResponse>({ data: [] });
    }

    // POST /api/messenger/send  { conversation, message, platform, url?, user?, pass?, token? }
    // The frontend includes url/user/pass in the body for NC; fall back to
    // getNcCreds when absent.
    if (url.startsWith("/api/messenger/send") && method === "POST") {
      const p = body ? JSON.parse(body) : {};
      const platform: string = p.platform ?? "nextcloud-talk";
      const roomId = p.conversation ?? p.roomId ?? "";
      const nc = (p.url && p.user && p.pass)
        ? { url: p.url as string, user: p.user as string, pass: p.pass as string }
        : (instanceId ? getNcCreds(instanceId) : null);
      try {
        await invoke("messenger_send_message", {
          platform,
          url: platform === "nextcloud-talk" ? nc?.url ?? null : null,
          user: platform === "nextcloud-talk" ? nc?.user ?? null : null,
          pass: platform === "nextcloud-talk" ? nc?.pass ?? null : null,
          token: p.token ?? (instanceId ? getCredsForInstance(instanceId)?.telegram_token : null) ?? null,
          roomId,
          message: p.message ?? "",
        });
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // POST /api/messenger/mark-read  { conversation, platform, lastReadMessage?, url?, user?, pass? }
    // Spiegelt de web-server-fix: NC Talk's /read endpoint MOET het
    // `lastReadMessage`-body-veld krijgen (het hoogste rauwe NC-id, uit
    // lastGivenId), anders markeren nieuwere NextCloud-versies effectief niets
    // als gelezen en komt de unread-teller terug. Zonder creds: ack (zoals
    // voorheen) zodat de optimistische UI niet errort.
    if (url.startsWith("/api/messenger/mark-read") && method === "POST") {
      const p = body ? JSON.parse(body) : {};
      const platform: string = p.platform ?? "nextcloud-talk";
      const roomId = p.conversation ?? "";
      if (platform !== "nextcloud-talk" || !roomId) return jsonResponse({ ok: true });
      const nc = (p.url && p.user && p.pass)
        ? { url: p.url as string, user: p.user as string, pass: p.pass as string }
        : (instanceId ? getNcCreds(instanceId) : null);
      if (!nc) return jsonResponse({ ok: true });
      const lastReadRaw = p.lastReadMessage ?? p.messageId;
      const lastRead = lastReadRaw !== undefined ? parseInt(String(lastReadRaw), 10) : NaN;
      try {
        await invoke("messenger_mark_read", {
          url: nc.url, user: nc.user, pass: nc.pass,
          roomId,
          lastReadMessage: Number.isFinite(lastRead) && lastRead > 0 ? lastRead : null,
        });
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // GET /api/messenger/full-image?fileId=<id>&conversation=… — desktop-only
    // endpoint: grote (ware-afmetingen) versie van een afbeelding-bijlage als
    // data: URL, LAZY (bij lightbox-klik) i.p.v. embedded in de message-payload.
    // Web heeft dit niet nodig (daar gaat de lightbox via /api/messenger/file-proxy).
    if (url.startsWith("/api/messenger/full-image") && method === "GET") {
      const q = new URL(url, "http://x").searchParams;
      const fileId = q.get("fileId") ?? "";
      const nc = instanceId ? getNcCreds(instanceId) : null;
      if (!fileId || !nc) return jsonResponse({ error: "missing fileId or creds" }, 400);
      try {
        const dataUrl = await invoke<string>("messenger_get_full_image", {
          url: nc.url, user: nc.user, pass: nc.pass, fileId,
        });
        return jsonResponse({ url: dataUrl });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // POST /api/messenger/react  { conversation, messageId, reaction, remove, url?, user?, pass? }
    // Web-pariteit: emoji-reactie toevoegen/verwijderen (alleen NC Talk).
    if (url.startsWith("/api/messenger/react") && method === "POST") {
      const p = body ? JSON.parse(body) : {};
      const nc = (p.url && p.user && p.pass)
        ? { url: p.url as string, user: p.user as string, pass: p.pass as string }
        : (instanceId ? getNcCreds(instanceId) : null);
      if (!nc) return jsonResponse({ error: "Missende NextCloud Talk credentials" }, 400);
      try {
        await invoke("messenger_react", {
          url: nc.url, user: nc.user, pass: nc.pass,
          roomId: p.conversation ?? "",
          messageId: String(p.messageId ?? ""),
          reaction: (p.reaction as string) || "\u{1F44D}",
          remove: p.remove === true,
        });
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // POST /api/messenger/edit  { conversation, messageId, message, url?, user?, pass? }
    if (url.startsWith("/api/messenger/edit") && method === "POST") {
      const p = body ? JSON.parse(body) : {};
      const nc = (p.url && p.user && p.pass)
        ? { url: p.url as string, user: p.user as string, pass: p.pass as string }
        : (instanceId ? getNcCreds(instanceId) : null);
      if (!nc) return jsonResponse({ error: "Missende NextCloud Talk credentials" }, 400);
      try {
        await invoke("messenger_edit", {
          url: nc.url, user: nc.user, pass: nc.pass,
          roomId: p.conversation ?? "",
          messageId: String(p.messageId ?? ""),
          message: p.message ?? "",
        });
        return jsonResponse({ ok: true });
      } catch (e) {
        // NC's edit-venster (6u) → 403-achtige fout; frontend toont de toast.
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // POST /api/messenger/delete  { conversation, messageId, url?, user?, pass? }
    if (url.startsWith("/api/messenger/delete") && method === "POST") {
      const p = body ? JSON.parse(body) : {};
      const nc = (p.url && p.user && p.pass)
        ? { url: p.url as string, user: p.user as string, pass: p.pass as string }
        : (instanceId ? getNcCreds(instanceId) : null);
      if (!nc) return jsonResponse({ error: "Missende NextCloud Talk credentials" }, 400);
      try {
        await invoke("messenger_delete", {
          url: nc.url, user: nc.user, pass: nc.pass,
          roomId: p.conversation ?? "",
          messageId: String(p.messageId ?? ""),
        });
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // POST /api/messenger/test  { platform, url, user, pass } — de "Test
    // verbinding"-knop in Settings. Web doet capabilities- + Talk-checks; hier
    // volstaat één Talk-room-list met de opgegeven creds (zelfde signaal).
    if (url.startsWith("/api/messenger/test") && method === "POST") {
      const p = body ? JSON.parse(body) : {};
      if ((p.platform ?? "nextcloud-talk") !== "nextcloud-talk") {
        return jsonResponse({ ok: false, error: `Test niet ondersteund voor ${p.platform} op desktop` });
      }
      let ncUrl = String(p.url || "").replace(/\/+$/, "");
      if (ncUrl && !/^https?:\/\//.test(ncUrl)) ncUrl = `https://${ncUrl}`;
      if (!ncUrl || !p.user || !p.pass) {
        return jsonResponse({ ok: false, error: "URL, gebruikersnaam en wachtwoord zijn verplicht" }, 400);
      }
      try {
        const convs = await invoke<MessengerConversationShape[]>("messenger_list_conversations", {
          platform: "nextcloud-talk", url: ncUrl, user: p.user, pass: p.pass, token: null,
        });
        const unread = convs.reduce((s, c) => s + (c.unreadCount || 0), 0);
        return jsonResponse({
          ok: true,
          message: `Verbonden met ${ncUrl}`,
          conversations: convs.length,
          unread,
        });
      } catch (e) {
        return jsonResponse({ ok: false, error: String(e) });
      }
    }

    // POST /api/messenger/create-conversation  { roomType, invite?, roomName?, url?, user?, pass? }
    if (url.startsWith("/api/messenger/create-conversation") && method === "POST") {
      const p = body ? JSON.parse(body) : {};
      const nc = (p.url && p.user && p.pass)
        ? { url: p.url as string, user: p.user as string, pass: p.pass as string }
        : (instanceId ? getNcCreds(instanceId) : null);
      if (!nc) return jsonResponse({ error: "Missing NextCloud credentials" }, 400);
      if (!p.roomType) return jsonResponse({ error: "Missing roomType (1=one-to-one, 2=group, 3=public)" }, 400);
      try {
        const [token, displayName, roomType] = await invoke<[string, string, number]>(
          "messenger_create_conversation",
          {
            url: nc.url, user: nc.user, pass: nc.pass,
            roomType: Number(p.roomType),
            invite: (p.invite as string) || "",
            roomName: (p.roomName as string) || "",
          },
        );
        const typeLabel = roomType === 1 ? "one-to-one" : roomType === 3 ? "public" : "group";
        return jsonResponse({
          ok: true,
          conversation: { id: token, name: displayName || p.roomName || p.invite || "", type: typeLabel },
        });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // POST /api/messenger/add-participant  { conversation, userId, url?, user?, pass? }
    if (url.startsWith("/api/messenger/add-participant") && method === "POST") {
      const p = body ? JSON.parse(body) : {};
      const nc = (p.url && p.user && p.pass)
        ? { url: p.url as string, user: p.user as string, pass: p.pass as string }
        : (instanceId ? getNcCreds(instanceId) : null);
      if (!nc) return jsonResponse({ error: "Missing NextCloud credentials" }, 400);
      if (!p.conversation || !p.userId) return jsonResponse({ error: "Missing conversation or userId" }, 400);
      try {
        await invoke("messenger_add_participant", {
          url: nc.url, user: nc.user, pass: nc.pass,
          roomId: p.conversation, userId: p.userId,
        });
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // POST /api/messenger/upload  { conversation, fileData(b64), fileName,
    // mimeType, caption?, replyTo?, url?, user?, pass? } — plaatje/bestand
    // naar een Talk-gesprek. Zelfde flow als de web-server: vrije naam →
    // WebDAV PUT → OCS-share (met caption/replyTo-metadata). Rust doet het
    // netwerk-werk; respons spiegelt { ok, fileName }.
    if (url.startsWith("/api/messenger/upload") && method === "POST") {
      const p = body ? JSON.parse(body) : {};
      if ((p.platform ?? "nextcloud-talk") !== "nextcloud-talk") {
        return jsonResponse({ error: "File upload only supported for NextCloud Talk" }, 400);
      }
      if (!p.conversation) return jsonResponse({ error: "Missende parameter: conversation" }, 400);
      if (!p.fileData) return jsonResponse({ error: "Missende parameter: fileData (base64)" }, 400);
      const nc = (p.url && p.user && p.pass)
        ? { url: p.url as string, user: p.user as string, pass: p.pass as string }
        : (instanceId ? getNcCreds(instanceId) : null);
      if (!nc) return jsonResponse({ error: "Missende NextCloud Talk credentials" }, 400);
      try {
        const fileName = await invoke<string>("messenger_upload", {
          url: nc.url, user: nc.user, pass: nc.pass,
          roomId: p.conversation,
          fileData: p.fileData,
          fileName: (p.fileName as string) || `paste-${Date.now()}.png`,
          mimeType: (p.mimeType as string) || "image/png",
          caption: ((p.caption as string) || "").trim(),
          replyTo: (p.replyTo as string) || "",
        });
        return jsonResponse({ ok: true, fileName });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // ── NextCloud bestanden (WebDAV via Rust) ─────────────────────────
    // Zelfde wire-shapes als packages/server/src/nextcloud.ts. Creds: query
    // url/user/pass (legacy) → getNcCreds (vault → localStorage prefs; Talk en
    // Files delen bij ons dezelfde NC-instance/gebruiker).

    // GET /api/nextcloud/files?path=/
    if (url.startsWith("/api/nextcloud/files") && method === "GET") {
      const q = new URL(url, "http://x").searchParams;
      const nc = (q.get("url") && q.get("user") && q.get("pass"))
        ? { url: q.get("url")!, user: q.get("user")!, pass: q.get("pass")! }
        : (instanceId ? getNcCreds(instanceId) : null);
      if (!nc) return jsonResponse({ error: "Missing NextCloud credentials" }, 400);
      try {
        const entries = await invoke("nextcloud_list_files", {
          url: nc.url, user: nc.user, pass: nc.pass, path: q.get("path") || "/",
        });
        return jsonResponse({ data: entries });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // GET /api/nextcloud/download?path=… — binaire respons (blob), zoals web.
    if (url.startsWith("/api/nextcloud/download") && !url.startsWith("/api/nextcloud/download-url") && method === "GET") {
      const q = new URL(url, "http://x").searchParams;
      const path = q.get("path") || "";
      if (!path) return jsonResponse({ error: "Missing path parameter" }, 400);
      const nc = (q.get("url") && q.get("user") && q.get("pass"))
        ? { url: q.get("url")!, user: q.get("user")!, pass: q.get("pass")! }
        : (instanceId ? getNcCreds(instanceId) : null);
      if (!nc) return jsonResponse({ error: "Missing NextCloud credentials" }, 400);
      try {
        const [b64, contentType] = await invoke<[string, string]>("nextcloud_download", {
          url: nc.url, user: nc.user, pass: nc.pass, path,
        });
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const filename = path.split("/").pop() || "download";
        return new Response(bytes, {
          status: 200,
          headers: {
            "content-type": contentType || "application/octet-stream",
            "content-disposition": `inline; filename="${encodeURIComponent(filename)}"`,
          },
        });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // PUT /api/nextcloud/upload?path=… — raw body (File/Blob) → base64 → Rust.
    // LET OP: niet de ge-String()-de `body` gebruiken (dat wordt "[object File]");
    // lees de bytes rechtstreeks uit init.body.
    if (url.startsWith("/api/nextcloud/upload") && method === "PUT") {
      const q = new URL(url, "http://x").searchParams;
      const path = q.get("path") || "";
      if (!path) return jsonResponse({ error: "Missing path parameter" }, 400);
      const nc = (q.get("url") && q.get("user") && q.get("pass"))
        ? { url: q.get("url")!, user: q.get("user")!, pass: q.get("pass")! }
        : (instanceId ? getNcCreds(instanceId) : null);
      if (!nc) return jsonResponse({ error: "Missing NextCloud credentials" }, 400);
      try {
        const raw = init?.body;
        let buf: ArrayBuffer;
        let contentType = "application/octet-stream";
        if (raw instanceof Blob) {
          buf = await raw.arrayBuffer();
          contentType = raw.type || contentType;
        } else if (raw instanceof ArrayBuffer) {
          buf = raw;
        } else if (ArrayBuffer.isView(raw)) {
          buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
        } else {
          buf = new TextEncoder().encode(String(raw ?? "")).buffer as ArrayBuffer;
        }
        const bytes = new Uint8Array(buf);
        let bin = "";
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        await invoke("nextcloud_upload", {
          url: nc.url, user: nc.user, pass: nc.pass, path,
          fileData: btoa(bin),
          contentType,
        });
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // POST /api/nextcloud/share?path=… → { url } (publieke read-only link)
    if (url.startsWith("/api/nextcloud/share") && method === "POST") {
      const q = new URL(url, "http://x").searchParams;
      const path = q.get("path") || "";
      if (!path) return jsonResponse({ error: "Missing path parameter" }, 400);
      const nc = (q.get("url") && q.get("user") && q.get("pass"))
        ? { url: q.get("url")!, user: q.get("user")!, pass: q.get("pass")! }
        : (instanceId ? getNcCreds(instanceId) : null);
      if (!nc) return jsonResponse({ error: "Missing NextCloud credentials" }, 400);
      try {
        const shareUrl = await invoke<string>("nextcloud_share", {
          url: nc.url, user: nc.user, pass: nc.pass, path,
        });
        return jsonResponse({ url: shareUrl });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // POST /api/calendar/event — CalDAV-afspraak aanmaken. De ICS komt uit
    // exact dezelfde builder als de web-server (import uit server-src = één
    // bron); de CalDAV-discovery+PUT spiegelt caldavCreateEvent in
    // routes/calendar.ts, met het generieke Rust dav_request-bruggetje voor
    // het netwerk (de webview mag zelf geen cross-origin PROPFIND/PUT doen).
    if (url.startsWith("/api/calendar/event") && method === "POST") {
      const p = body ? JSON.parse(body) : {};
      const { url: calUrl, account, summary, start, end, allDay, description, location,
        attendees: attendeeInput, uid: existingUid, sequence } = p as {
        url?: string; account?: string; summary?: string; start?: string; end?: string;
        allDay?: boolean; description?: string; location?: string;
        attendees?: string[]; uid?: string; sequence?: number;
      };
      if (!calUrl || !summary || !start) return jsonResponse({ error: "Missing url/summary/start" }, 400);
      if (!account) return jsonResponse({ error: "CalDAV write requires an authenticated account" }, 400);
      try {
        // FIX: listMailAccounts vereist de instance-id (was zonder argument →
        // TS2554 + runtime-throw die als "Failed to fetch" uit de adapter viel).
        if (!instanceId) return jsonResponse({ error: "No active instance" }, 400);
        let acct = (await listMailAccounts(instanceId)).find((a) => a.id === account);
        if (!acct?.username) {
          // Synthetische "erpnext-auto" account of onbekende id → val terug op de
          // auto-geresolvede imap_* velden uit de vault (zelfde host als CalDAV).
          const vault = await getInstanceCredentials(instanceId);
          if (vault?.imap_user && vault?.imap_pass) {
            acct = {
              id: account, email: vault.imap_user, label: vault.imap_user,
              imapHost: vault.imap_host ?? "", imapPort: vault.imap_port ?? 993,
              imapSecure: (vault.imap_port ?? 993) !== 143,
              smtpHost: vault.smtp_host ?? vault.imap_host ?? "",
              smtpPort: vault.smtp_port ?? 587, smtpSecure: vault.smtp_port === 465,
              username: vault.imap_user, password: vault.imap_pass,
            };
          }
        }
        if (!acct?.username) return jsonResponse({ error: "Mail account not found" }, 404);

        const uid = existingUid || `${crypto.randomUUID()}@y-app`;
        const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
        const seq = typeof sequence === "number" ? sequence : 0;
        // Zelfde lenient adres-parse als de server (parseCalAddress): "Naam <mail>" of kaal adres.
        const attendees = (attendeeInput || [])
          .map((s) => {
            const m = String(s).trim().match(/^(.*)<([^>]+)>$/);
            if (m) return { email: m[2].trim(), name: m[1].trim() || undefined };
            return String(s).includes("@") ? { email: String(s).trim() } : null;
          })
          .filter((a): a is { email: string; name?: string } => !!a);
        const organizer = { email: acct.username.includes("@") ? acct.username : acct.email };
        const hasAttendees = attendees.length > 0;
        const ics = buildICalEvent({
          uid, dtstamp, summary, start, end, allDay: !!allDay, description, location,
          organizer: hasAttendees ? organizer : undefined,
          attendees: hasAttendees ? attendees : undefined,
          sequence: hasAttendees ? seq : undefined,
        });

        const base = String(calUrl).replace(/^webcal:\/\//, "https://");
        const origin = new URL(base).origin;
        const dav = (m: string, u: string, b: string, depth = "1") =>
          invoke<[number, string]>("dav_request", {
            method: m, url: u, user: acct.username, pass: acct.password,
            contentType: 'application/xml; charset="utf-8"', depth, body: b,
          });
        const xmlUnescape = (s: string) => s
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'").replace(/&amp;/g, "&");

        // 1. calendar-home-set probe
        let homeUrl = base;
        try {
          const [, hpXml] = await dav("PROPFIND",
            base,
            '<?xml version="1.0" encoding="utf-8"?>\n<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:current-user-principal/><c:calendar-home-set/></d:prop></d:propfind>',
            "0");
          const homeM = hpXml.match(/<[a-z0-9]*:?calendar-home-set[^>]*>[\s\S]*?<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/i);
          if (homeM) homeUrl = new URL(xmlUnescape(homeM[1].trim()), origin).href;
        } catch { /* val terug op base */ }

        // 2. calendar-collecties zoeken
        const [pfStatus, pfXml] = await dav("PROPFIND", homeUrl,
          '<?xml version="1.0" encoding="utf-8"?>\n<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>');
        if (pfStatus === 401) return jsonResponse({ error: "CalDAV auth failed (401)" }, 502);
        if (pfStatus >= 400 && pfStatus !== 207) return jsonResponse({ error: `CalDAV PROPFIND returned ${pfStatus}` }, 502);
        const calendarHrefs: string[] = [];
        const responseRe = /<[a-z0-9]*:?response[\s>][\s\S]*?<\/[a-z0-9]*:?response>/gi;
        let m2: RegExpExecArray | null;
        while ((m2 = responseRe.exec(pfXml)) !== null) {
          const resp = m2[0];
          const hrefM = resp.match(/<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/i);
          if (!hrefM) continue;
          const rtM = resp.match(/<[a-z0-9]*:?resourcetype[^>]*>([\s\S]*?)<\/[a-z0-9]*:?resourcetype>/i);
          if (rtM && /<[a-z0-9]*:?calendar[\s/>]/i.test(rtM[1])) {
            calendarHrefs.push(new URL(xmlUnescape(hrefM[1].trim()), origin).href);
          }
        }
        if (calendarHrefs.length === 0) calendarHrefs.push(homeUrl);

        // 3. PUT uid.ics in de eerste kalender
        const target = calendarHrefs[0].endsWith("/") ? calendarHrefs[0] : calendarHrefs[0] + "/";
        const eventUrl = new URL(`${uid}.ics`, target).href;
        const [putStatus] = await invoke<[number, string]>("dav_request", {
          method: "PUT", url: eventUrl, user: acct.username, pass: acct.password,
          contentType: "text/calendar; charset=utf-8", depth: "", body: ics,
        });
        if (putStatus >= 400) return jsonResponse({ error: `CalDAV PUT returned ${putStatus}` }, 502);

        // iMIP-uitnodiging: zelfde ICS met METHOD:REQUEST; de frontend
        // verstuurt 'm via /api/mail/send (werkt op desktop).
        let inviteIcs: string | undefined;
        if (hasAttendees) {
          inviteIcs = buildICalEvent({
            uid, dtstamp, summary, start, end, allDay: !!allDay, description, location,
            method: "REQUEST", organizer, attendees, sequence: seq,
          });
        }
        return jsonResponse({
          ok: true, uid, organizer: organizer.email,
          attendees: attendees.map((a) => a.email), inviteIcs,
        });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // GET /api/printview-html?doctype=&name=&format=… — factuur-/print-preview.
    // Haalt ERPNext's /printview-HTML op via de Rust-sessie en herschrijft
    // relatieve asset-URLs naar ABSOLUTE instance-URLs (de web herschrijft
    // naar zijn asset-proxy; die bestaat hier niet). Publieke /files/ laden
    // dan direct vanaf ERPNext; /private/files/ blijft zonder cookie 403 —
    // bekende beperking, gedocumenteerd.
    if (url.startsWith("/api/printview-html") && method === "GET") {
      if (!instanceId) return jsonResponse({ error: "No active instance" }, 400);
      try {
        const qs = new URL(url, "http://x").search;
        const result = await erpnextFetch(instanceId, `/printview${qs}`);
        let html = result.body;
        if (result.status >= 200 && result.status < 300) {
          const instancesList = await invoke<{ instances: any[] }>("list_instances");
          const instUrl = (instancesList.instances.find((i: any) => i.id === instanceId)?.url || "").replace(/\/+$/, "");
          if (instUrl) {
            html = html
              .replace(/(src|href)=(["'])(\/(?:files|private\/files|assets)\/)/g, `$1=$2${instUrl}$3`)
              .replace(/url\((['"]?)(\/(?:files|private\/files|assets)\/)/g, `url($1${instUrl}$2`);
          }
        }
        return new Response(html, {
          status: result.status,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // ── Kleine web-server-routes lokaal afgehandeld ────────────────────

    // GET/PUT /api/instances/:id/synced-prefs — prefs-sync is Y-app-account-
    // gebonden (cross-device); op desktop is localStorage al de lokale bron.
    // Ack'en met de web-shape voorkomt 4xx-ruis op élke mount/wijziging.
    const syncedPrefsMatch = url.match(/^\/api\/instances\/(\d+)\/synced-prefs$/);
    if (syncedPrefsMatch) {
      if (method === "GET") return jsonResponse({ ok: true, prefs: {}, updated_at: null });
      if (method === "PUT") return jsonResponse({ ok: true });
    }

    // GET /api/shared-settings/:key — employer→employee-bridge. Op desktop
    // staan de gedeelde keys al lokaal via de desktop-config-sync; zelfde
    // web-shape { ok, value } als /api/user-settings/:key.
    const sharedSettingsMatch = url.match(/^\/api\/shared-settings\/(.+)$/);
    if (sharedSettingsMatch && method === "GET") {
      const data = await invoke<string | null>("get_user_setting", { key: sharedSettingsMatch[1] });
      return jsonResponse({ ok: true, value: data ? JSON.parse(data) : null });
    }

    // GET /api/i/:instanceId/count?doctype=&filters= — lichte count voor
    // lijst-badges. Web proxied via de instance-sessie; hier direct naar
    // ERPNext: v16-COUNT(*)-query met get_count-fallback voor oudere versies.
    const countMatch = url.match(/^\/api\/i\/(\d+)\/count/);
    if (countMatch && method === "GET") {
      const q = new URL(url, "http://x").searchParams;
      const doctype = q.get("doctype") || "";
      const filtersStr = q.get("filters") || "[]";
      if (!doctype) return jsonResponse({ error: "Missing doctype" }, 400);
      const targetId = parseInt(countMatch[1], 10) || instanceId;
      try {
        const params = new URLSearchParams({
          fields: JSON.stringify([{ COUNT: "*" }]),
          filters: filtersStr,
          limit_page_length: "1",
        });
        const result = await erpnextFetch(targetId, `/api/resource/${encodeURIComponent(doctype)}?${params}`);
        if (result.status >= 200 && result.status < 300) {
          const parsed = JSON.parse(result.body);
          const row = parsed?.data?.[0] || {};
          return jsonResponse({ count: Number(row["COUNT(*)"] ?? row.count ?? row.total ?? 0) });
        }
        // Fallback voor ERPNext < 16
        const fb = await erpnextFetch(
          targetId,
          `/api/method/frappe.client.get_count?${new URLSearchParams({ doctype, filters: filtersStr })}`,
        );
        const fbParsed = JSON.parse(fb.body);
        return jsonResponse({ count: Number(fbParsed?.message ?? 0) });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // ── Mail (IMAP via Rust) ──────────────────────────────────────────
    // Same wire shapes as the server's mail.ts so Webmail.tsx works unchanged.
    // Desktop has no mail server, so resolve IMAP/SMTP creds (local vault →
    // ERPNext) BEFORE any read/send route runs. /config sets creds explicitly,
    // /auto-config resolves+returns, /test uses body creds — those opt out.
    if (
      instanceId &&
      url.startsWith("/api/mail/") &&
      !url.startsWith("/api/mail/config") &&
      !url.startsWith("/api/mail/auto-config") &&
      !url.startsWith("/api/mail/test")
    ) {
      await ensureMailCredsPopulated(instanceId, url);
    }

    if (url === "/api/mail/config" && method === "POST") {
      try {
        const parsed = body ? (JSON.parse(body) as MailCredsPayload) : null;
        if (!parsed || !parsed.host || !parsed.user || (!parsed.pass && !parsed.accessToken)) {
          return jsonResponse({ ok: false, error: "Incomplete credentials" }, 400);
        }
        desktopMailCreds.set(instanceId, {
          host: parsed.host,
          port: typeof parsed.port === "string" ? parseInt(parsed.port, 10) : parsed.port || 993,
          user: parsed.user,
          pass: parsed.pass,
          secure: parsed.secure !== false,
          authMode: parsed.authMode,
          accessToken: parsed.accessToken,
          smtpHost: parsed.smtpHost,
          smtpPort: typeof parsed.smtpPort === "string" ? parseInt(parsed.smtpPort, 10) : parsed.smtpPort,
          smtpSecure: parsed.smtpSecure,
        });
        return jsonResponse({ ok: true });
      } catch (e) {
        return jsonResponse({ ok: false, error: String(e) }, 400);
      }
    }

    if (url === "/api/mail/config" && method === "DELETE") {
      desktopMailCreds.delete(instanceId);
      return jsonResponse({ ok: true });
    }

    if (url === "/api/mail/test" && method === "POST") {
      try {
        const parsed = body ? (JSON.parse(body) as MailCredsPayload) : null;
        if (!parsed) return jsonResponse({ ok: false, error: "Missing body" }, 400);
        await invoke("mail_test", {
          creds: {
            host: parsed.host,
            port: typeof parsed.port === "string" ? parseInt(parsed.port, 10) : parsed.port || 993,
            user: parsed.user,
            pass: parsed.pass,
            secure: parsed.secure !== false,
            authMode: parsed.authMode,
            accessToken: parsed.accessToken,
          },
        });
        return jsonResponse({ ok: true, message: `Verbonden als ${parsed.user}` });
      } catch (e) {
        return jsonResponse({ ok: false, error: String(e) }, 401);
      }
    }

    if (url.startsWith("/api/mail/folders") && method === "GET") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      try {
        const folders = await invoke<MailFolderShape[]>("mail_list_folders", { creds });
        return jsonResponse<MailFoldersResponse>({ data: folders });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    if (url.startsWith("/api/mail/messages") && method === "GET") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const params = new URL(url, "http://x").searchParams;
      const folder = params.get("folder") ?? "INBOX";
      const page = parseInt(params.get("page") ?? "1", 10);
      const pageSize = parseInt(params.get("pageSize") ?? "50", 10);
      try {
        const result = await invoke<{ messages: unknown[]; total: number }>("mail_list_messages", {
          creds, folder, page, pageSize,
        });
        return jsonResponse({ data: { ...result, page, pageSize } });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // GET /api/mail/bodies?folder=X&uids=1,2,3 — batch BODY.PEEK[] (no \Seen).
    // Drives the offline body-cache pre-fill (mail-body-prefill.ts). Same
    // element shape as /api/mail/message so the read-path renders cached
    // bodies unchanged.
    if (url.startsWith("/api/mail/bodies") && method === "GET") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const params = new URL(url, "http://x").searchParams;
      const folder = params.get("folder") ?? "INBOX";
      const uids = (params.get("uids") ?? "")
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n))
        .slice(0, 200);
      if (uids.length === 0) return jsonResponse({ data: [] });
      try {
        // withAttachments: desktop cachet bijlages standaard mee tijdens de
        // body-prefill (de bytes komen hier tóch al binnen). De prefill-caller
        // markeert achtergrond-fetches met ?bg=1; alleen dán bijlages meesturen
        // zodat een interactieve mail-open niet onnodig zware base64 door de
        // IPC-bridge trekt (de mail-open leest de body uit de cache, niet hier).
        const withAttachments = params.get("bg") === "1";
        const bodies = await invoke<unknown[]>("mail_get_bodies", { creds, folder, uids, withAttachments });
        return jsonResponse({ data: bodies });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // GET /api/mail/unseen-summary — lightweight per-folder unseen counts for
    // the sidebar mail-badge (polled by BackgroundSyncProvider). Reuses the
    // folder list and strips to { path, unseen } + total.
    if (url.startsWith("/api/mail/unseen-summary") && method === "GET") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse<MailUnseenSummaryResponse>({ data: { folders: [], total: 0 } });
      try {
        const folders = await invoke<MailFolderShape[]>("mail_list_folders", { creds });
        const summary: UnseenFolderShape[] = (folders || [])
          .filter((f): f is MailFolderShape & { unseen: number } => typeof f.unseen === "number")
          .map((f) => ({ path: f.path, unseen: f.unseen }));
        const total = summary.reduce((s, f) => s + (f.unseen || 0), 0);
        return jsonResponse<MailUnseenSummaryResponse>({ data: { folders: summary, total } });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    if (url.startsWith("/api/mail/message") && method === "GET" && !url.startsWith("/api/mail/messages")) {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const params = new URL(url, "http://x").searchParams;
      const folder = params.get("folder") ?? "INBOX";
      const uid = parseInt(params.get("uid") ?? "0", 10);
      if (!uid) return jsonResponse({ error: "Missing uid" }, 400);
      try {
        const data = await invoke("mail_get_message", { creds, folder, uid });
        return jsonResponse({ data });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    /* ── Phase B: writes + attachments + send ────────────────────── */

    // DELETE /api/mail/message?folder=X&uid=Y
    if (url.startsWith("/api/mail/message") && method === "DELETE" && !url.startsWith("/api/mail/messages")) {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const params = new URL(url, "http://x").searchParams;
      const folder = params.get("folder") ?? "INBOX";
      const uid = parseInt(params.get("uid") ?? "0", 10);
      const trashFolder = params.get("trashFolder") || undefined;
      try {
        // mail_delete verplaatst nu naar Verwijderde items (of expunget als de
        // mail al in de prullenbak staat) en geeft { action, trashPath } terug
        // — zelfde vorm als de web-server, zodat Webmail de juiste map
        // invalideert.
        const res = await invoke<{ action: string; trashPath: string | null }>(
          "mail_delete", { creds, folder, uid, trashFolder },
        );
        return jsonResponse({ ok: true, ...res });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }

    // POST /api/mail/move?folder=X&uid=Y&toFolder=Z
    if (url.startsWith("/api/mail/move") && method === "POST") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const params = new URL(url, "http://x").searchParams;
      const folder = params.get("folder") ?? "INBOX";
      const uid = parseInt(params.get("uid") ?? "0", 10);
      const toFolder = params.get("toFolder") ?? "";
      try {
        await invoke("mail_move", { creds, folder, uid, toFolder });
        return jsonResponse({ ok: true });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }

    // POST /api/mail/mark-read | mark-unread
    const markMatch = url.match(/^\/api\/mail\/mark-(read|unread)/);
    if (markMatch && method === "POST") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const params = new URL(url, "http://x").searchParams;
      const folder = params.get("folder") ?? "INBOX";
      const uid = parseInt(params.get("uid") ?? "0", 10);
      const cmd = markMatch[1] === "read" ? "mail_mark_read" : "mail_mark_unread";
      try {
        await invoke(cmd, { creds, folder, uid });
        return jsonResponse({ ok: true });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }

    // POST /api/mail/folder?name=X — create folder
    if (url.startsWith("/api/mail/folder?") && method === "POST") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const name = new URL(url, "http://x").searchParams.get("name") ?? "";
      if (!name) return jsonResponse({ error: "Missing folder name" }, 400);
      try {
        await invoke("mail_create_folder", { creds, name });
        return jsonResponse({ ok: true });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }

    // POST /api/mail/rename-folder { oldPath, newPath }
    if (url.startsWith("/api/mail/rename-folder") && method === "POST") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      try {
        const parsed = body ? JSON.parse(body) : {};
        if (!parsed.oldPath || !parsed.newPath) return jsonResponse({ error: "Missing oldPath/newPath" }, 400);
        await invoke("mail_rename_folder", { creds, oldPath: parsed.oldPath, newPath: parsed.newPath });
        return jsonResponse({ ok: true });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }

    // POST /api/mail/delete-folder?path=X — delete folder (UI confirms + hides
    // system/INBOX folders; Rust guards INBOX as defense-in-depth).
    if (url.startsWith("/api/mail/delete-folder") && method === "POST") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const path = new URL(url, "http://x").searchParams.get("path")
        ?? (body ? (JSON.parse(body).path ?? "") : "");
      if (!path) return jsonResponse({ error: "Missing folder path" }, 400);
      if (path === "INBOX") return jsonResponse({ error: "Cannot delete INBOX" }, 400);
      try {
        await invoke("mail_delete_folder", { creds, path });
        return jsonResponse({ ok: true });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }

    // GET /api/mail/attachment?folder=X&uid=Y&index=Z — return binary.
    // Wrap the base64 from Rust into a real Response so the existing
    // Webmail download/preview code (which does fetch().blob()) works
    // unchanged.
    if (url.startsWith("/api/mail/attachment") && method === "GET") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const params = new URL(url, "http://x").searchParams;
      const folder = params.get("folder") ?? "INBOX";
      const uid = parseInt(params.get("uid") ?? "0", 10);
      const index = parseInt(params.get("index") ?? "0", 10);
      try {
        const att = await invoke<{ contentBase64: string; contentType: string; filename: string }>(
          "mail_get_attachment",
          { creds, folder, uid, index },
        );
        const bin = atob(att.contentBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Response(bytes, {
          status: 200,
          headers: {
            "content-type": att.contentType || "application/octet-stream",
            "content-disposition": `attachment; filename="${encodeURIComponent(att.filename)}"`,
          },
        });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }

    // POST /api/mail/attachment/open-external?folder=&uid=&index= — desktop-
    // only: schrijft de bijlage rechtstreeks (Rust, geen base64-omweg) naar een
    // tijdelijk bestand en opent 'm met de OS-standaardviewer. Vervangt op
    // desktop de web-flow (window.open naar een blob-URL in een nieuw
    // tabblad), want een Tauri-webview heeft geen echte tabs — window.open
    // faalde daar stil en de UI viel terug op een onzichtbare download.
    if (url.startsWith("/api/mail/attachment/open-external") && method === "POST") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const params = new URL(url, "http://x").searchParams;
      const folder = params.get("folder") ?? "INBOX";
      const uid = parseInt(params.get("uid") ?? "0", 10);
      const index = parseInt(params.get("index") ?? "0", 10);
      try {
        await invoke("mail_open_attachment_external", { creds, folder, uid, index });
        return jsonResponse({ ok: true });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }

    // POST /api/mail/send — body is the SendPayload from Webmail
    if (url === "/api/mail/send" && method === "POST") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      try {
        const payload = body ? JSON.parse(body) : {};
        const result = await invoke<{ messageId: string }>("mail_send", { creds, payload });
        return jsonResponse({ ok: true, messageId: result.messageId });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }

    // GET /api/mail/contacts — scan IMAP for unique addresses
    if (url.startsWith("/api/mail/contacts") && method === "GET") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      try {
        const contacts = await invoke<any[]>("mail_contacts", { creds });
        return jsonResponse({ data: contacts });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }

    // GET /api/mail/conversation?folder=X&subject=Y — thread by subject
    if (url.startsWith("/api/mail/conversation") && method === "GET") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const params = new URL(url, "http://x").searchParams;
      const folder = params.get("folder") ?? "INBOX";
      const subject = params.get("subject") ?? "";
      if (!subject) return jsonResponse({ data: [] });
      try {
        const messages = await invoke<any[]>("mail_conversation", { creds, folder, subject });
        return jsonResponse({ data: messages });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }

    // POST /api/mail/warmup — fire-and-forget preload
    if (url.startsWith("/api/mail/warmup") && method === "POST") {
      const creds = desktopMailCreds.get(instanceId);
      if (creds) {
        // Fire-and-forget: pre-connect + fetch folders + INBOX
        invoke("mail_list_folders", { creds }).catch(() => {});
        invoke("mail_list_messages", { creds, folder: "INBOX", page: 1, pageSize: 100 }).catch(() => {});
      }
      return jsonResponse({ ok: true, message: "Warmup started" });
    }

    // GET /api/mail/cache-stats — no meaningful stats on desktop
    if (url.startsWith("/api/mail/cache-stats") && method === "GET") {
      return jsonResponse({ data: {} });
    }

    // GET /api/mail/auto-config?email=X — fetch IMAP/SMTP config from ERPNext
    if (url.startsWith("/api/mail/auto-config") && method === "GET") {
      const email = new URL(url, "http://x").searchParams.get("email") ?? "";
      if (!email) return jsonResponse({ error: "Missing email parameter" }, 400);

      try {
        // 1. Fetch Email Account from ERPNext
        const filters = JSON.stringify([["email_id", "=", email]]);
        const fields = JSON.stringify(["name", "email_id", "email_server", "incoming_port", "use_ssl", "smtp_server", "smtp_port", "use_tls", "use_ssl_for_outgoing", "signature", "connected_app"]);
        const emailAccRes = await erpnextFetch(instanceId,
          `/api/resource/Email Account?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`);
        const emailAccounts = JSON.parse(emailAccRes.body)?.data || [];
        if (emailAccounts.length === 0) {
          return jsonResponse({ error: "Email Account not found in ERPNext" }, 404);
        }
        const emailAcc = emailAccounts[0];

        // 2. Check for Connected App (Microsoft 365 OAuth2)
        const connAppFields = JSON.stringify(["name", "client_id", "provider_name", "token_uri"]);
        const connAppRes = await erpnextFetch(instanceId,
          `/api/resource/Connected App?fields=${encodeURIComponent(connAppFields)}&limit_page_length=10`);
        const allConnApps = JSON.parse(connAppRes.body)?.data || [];
        const connApps = allConnApps.filter((a: any) =>
          a.provider_name?.toLowerCase().includes("microsoft") || a.client_id);

        // Password-authenticated when there is NO Microsoft Connected App at all,
        // OR this specific Email Account is not linked to one. The second condition
        // is essential for tenants that DO have a Connected App for OAuth accounts
        // but ALSO host plain-IMAP accounts (e.g. piet@3bm.co.nl on mail.3bm.co.nl):
        // without it, every account fell through to the OAuth branch below and
        // returned authMode "password" WITHOUT a `pass`, so IMAP login failed.
        if (connApps.length === 0 || !emailAcc.connected_app) {
          // No OAuth2 — return password-based config
          let password = "";
          try {
            const pwRes = await erpnextFetch(instanceId,
              `/api/method/frappe.client.get_password?doctype=Email+Account&name=${encodeURIComponent(emailAcc.name)}&fieldname=password`);
            password = JSON.parse(pwRes.body)?.message || "";
          } catch { /* ignore */ }

          return jsonResponse({ data: {
            authMode: "password",
            host: emailAcc.email_server || "",
            port: parseInt(emailAcc.incoming_port || "993"),
            user: email,
            pass: password,
            secure: !!emailAcc.use_ssl,
            smtpHost: emailAcc.smtp_server || "",
            smtpPort: parseInt(emailAcc.smtp_port || "587"),
            // Implicit-SSL SMTP (port 465) needs secure=true; STARTTLS (587) needs
            // false. Derive from ERPNext's use_ssl_for_outgoing flag, with a
            // port-465 fallback — was hardcoded false, breaking 465 mailhosts.
            smtpSecure: !!emailAcc.use_ssl_for_outgoing || parseInt(emailAcc.smtp_port || "0", 10) === 465,
            signature: emailAcc.signature || "",
          }});
        }

        // 3. OAuth2 flow — get tokens from ERPNext
        const connApp = emailAcc.connected_app
          ? allConnApps.find((a: any) => a.name === emailAcc.connected_app) ?? connApps[0]
          : connApps[0];

        // Get client_secret
        let clientSecret = "";
        try {
          const secretRes = await erpnextFetch(instanceId,
            `/api/method/frappe.client.get_password?doctype=Connected+App&name=${encodeURIComponent(connApp.name)}&fieldname=client_secret`);
          clientSecret = JSON.parse(secretRes.body)?.message || "";
        } catch { /* ignore */ }

        // Get Token Cache (access_token + refresh_token)
        const tokenName = `${connApp.name}-${email}`;
        let accessToken = "";
        let refreshToken = "";
        try {
          const atRes = await erpnextFetch(instanceId,
            `/api/method/frappe.client.get_password?doctype=Token+Cache&name=${encodeURIComponent(tokenName)}&fieldname=access_token`);
          accessToken = JSON.parse(atRes.body)?.message || "";
        } catch { /* ignore */ }
        try {
          const rtRes = await erpnextFetch(instanceId,
            `/api/method/frappe.client.get_password?doctype=Token+Cache&name=${encodeURIComponent(tokenName)}&fieldname=refresh_token`);
          refreshToken = JSON.parse(rtRes.body)?.message || "";
        } catch { /* ignore */ }

        // 4. Refresh the token (it's likely expired)
        let finalAccessToken = accessToken;
        if (refreshToken && clientSecret && connApp.client_id && connApp.token_uri) {
          try {
            const tokenBody = new URLSearchParams({
              client_id: connApp.client_id,
              client_secret: clientSecret,
              refresh_token: refreshToken,
              grant_type: "refresh_token",
              scope: "https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send offline_access",
            });
            const tokenResp = await originalFetch(connApp.token_uri, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: tokenBody,
            });
            const tokenResult = await tokenResp.json() as { access_token?: string };
            if (tokenResult.access_token) {
              finalAccessToken = tokenResult.access_token;
            }
          } catch { /* token refresh failed — use existing token */ }
        }

        return jsonResponse({ data: {
          authMode: finalAccessToken ? "oauth2" : "password",
          host: emailAcc.email_server || "outlook.office365.com",
          port: parseInt(emailAcc.incoming_port || "993"),
          user: email,
          secure: emailAcc.use_ssl !== 0,
          smtpHost: emailAcc.smtp_server || "smtp.office365.com",
          smtpPort: parseInt(emailAcc.smtp_port || "587"),
          smtpSecure: false,
          accessToken: finalAccessToken || undefined,
          refreshToken: refreshToken || undefined,
          clientId: connApp.client_id || undefined,
          clientSecret: clientSecret || undefined,
          tokenUri: connApp.token_uri || undefined,
          signature: emailAcc.signature || "",
        }});
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // GET /api/mail/signature?email=X — fetch from ERPNext (4 sources)
    if (url.startsWith("/api/mail/signature") && method === "GET") {
      const email = new URL(url, "http://x").searchParams.get("email") ?? "";
      if (!email) return jsonResponse({ data: { signature: "", source: null } });

      try {
        // 1. Email Account → signature
        try {
          const filters = JSON.stringify([["email_id", "=", email]]);
          const fields = JSON.stringify(["signature"]);
          const r = await erpnextFetch(instanceId,
            `/api/resource/Email Account?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`);
          const sig = JSON.parse(r.body)?.data?.[0]?.signature;
          if (sig) return jsonResponse({ data: { signature: sig, source: "Email Account" } });
        } catch { /* continue */ }

        // 2. User → email_signature
        try {
          const filters = JSON.stringify([["email", "=", email]]);
          const fields = JSON.stringify(["email_signature"]);
          const r = await erpnextFetch(instanceId,
            `/api/resource/User?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`);
          const sig = JSON.parse(r.body)?.data?.[0]?.email_signature;
          if (sig) return jsonResponse({ data: { signature: sig, source: "User" } });
        } catch { /* continue */ }

        // 3. Employee → User → email_signature
        try {
          let employees: any[] = [];
          const empFilters1 = JSON.stringify([["status", "=", "Active"], ["company_email", "=", email]]);
          const empFields = JSON.stringify(["user_id", "employee_name"]);
          const r1 = await erpnextFetch(instanceId,
            `/api/resource/Employee?filters=${encodeURIComponent(empFilters1)}&fields=${encodeURIComponent(empFields)}`);
          employees = JSON.parse(r1.body)?.data || [];
          if (employees.length === 0) {
            const empFilters2 = JSON.stringify([["status", "=", "Active"], ["user_id", "=", email]]);
            const r2 = await erpnextFetch(instanceId,
              `/api/resource/Employee?filters=${encodeURIComponent(empFilters2)}&fields=${encodeURIComponent(empFields)}`);
            employees = JSON.parse(r2.body)?.data || [];
          }
          if (employees.length > 0 && employees[0].user_id) {
            const userFilters = JSON.stringify([["name", "=", employees[0].user_id]]);
            const userFields = JSON.stringify(["email_signature"]);
            const r3 = await erpnextFetch(instanceId,
              `/api/resource/User?filters=${encodeURIComponent(userFilters)}&fields=${encodeURIComponent(userFields)}`);
            const sig = JSON.parse(r3.body)?.data?.[0]?.email_signature;
            if (sig) return jsonResponse({ data: { signature: sig, source: "User (via Employee)" } });
          }
        } catch { /* continue */ }

        // 4. Default Email Account → signature
        try {
          const filters = JSON.stringify([["default_outgoing", "=", 1]]);
          const fields = JSON.stringify(["signature"]);
          const r = await erpnextFetch(instanceId,
            `/api/resource/Email Account?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`);
          const sig = JSON.parse(r.body)?.data?.[0]?.signature;
          if (sig) return jsonResponse({ data: { signature: sig, source: "Default Email Account" } });
        } catch { /* continue */ }

        return jsonResponse({ data: { signature: "", source: null } });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // Remaining /api/mail/* not handled above
    if (url.startsWith("/api/mail/")) {
      return jsonResponse({ error: "Mail endpoint not implemented in desktop build" }, 501);
    }

    // ── Calendar ──────────────────────────────────────────────────────

    // GET /api/calendar/ical?url=X[&account=<id>] — fetch + parse iCal/WebCal
    // feed. Met `account` = geauthenticeerde CalDAV-collectie (bv.
    // mail.3bm.co.nl/dav/cal/): de webview mag zelf geen cross-origin
    // PROPFIND/REPORT doen (CORS → "Failed to fetch"), dus discovery via het
    // Rust dav_request-bruggetje met Basic-auth uit de vault — spiegelt het
    // account-pad van calendarGetICal in packages/server/src/routes/calendar.ts.
    if (url.startsWith("/api/calendar/ical") && method === "GET") {
      const icalParams = new URL(url, "http://x").searchParams;
      const icalUrl = icalParams.get("url") ?? "";
      const icalAccount = icalParams.get("account") ?? "";
      if (!icalUrl) return jsonResponse({ error: "Missing url parameter" }, 400);

      try {
        const fetchUrl = icalUrl.replace(/^webcal:\/\//, "https://");
        let text: string;
        if (icalAccount) {
          if (!instanceId) return jsonResponse({ error: "No active instance" }, 400);
          const creds = await resolveCalDavCreds(instanceId, icalAccount);
          if (!creds) return jsonResponse({ error: "Mail account not found" }, 404);
          text = await davDiscoverIcs(creds.user, creds.pass, fetchUrl);
        } else {
          const response = await originalFetch(fetchUrl, {
            headers: { Accept: "text/calendar, text/plain, */*" },
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) {
            return jsonResponse({ error: `Upstream returned ${response.status}` }, response.status);
          }
          text = await response.text();
        }

        // Parse VEVENT blocks into simple event objects
        const events: Array<{
          uid: string; summary: string; dtstart: string; dtend: string;
          description: string; location: string; allDay: boolean;
        }> = [];

        const veventBlocks = text.split("BEGIN:VEVENT");
        for (let i = 1; i < veventBlocks.length; i++) {
          const block = veventBlocks[i].split("END:VEVENT")[0];

          const getField = (name: string): string => {
            const regex = new RegExp(`^${name}[;:](.*)`, "m");
            const match = block.match(regex);
            if (!match) return "";
            let val = match[1];
            const startIdx = block.indexOf(match[0]);
            const afterMatch = block.substring(startIdx + match[0].length);
            const continuationMatch = afterMatch.match(/^(\r?\n[ \t].*)*/);
            if (continuationMatch && continuationMatch[0]) {
              val += continuationMatch[0].replace(/\r?\n[ \t]/g, "");
            }
            return val.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\\\/g, "\\").trim();
          };

          const dtstart = getField("DTSTART");
          const dtend = getField("DTEND");
          const summary = getField("SUMMARY");
          const uid = getField("UID") || `ical-${i}`;
          const description = getField("DESCRIPTION");
          const location = getField("LOCATION");
          const allDay = /^\d{8}$/.test(dtstart);

          const parseICalDate = (val: string): string => {
            if (!val) return "";
            const colonIdx = val.indexOf(":");
            const dateStr = colonIdx >= 0 ? val.substring(colonIdx + 1) : val;
            if (/^\d{8}$/.test(dateStr)) {
              return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
            }
            if (/^\d{8}T\d{6}Z?$/.test(dateStr)) {
              const d = dateStr.replace("Z", "");
              return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}`;
            }
            return val;
          };

          events.push({
            uid,
            summary: summary || "(Geen titel)",
            dtstart: parseICalDate(dtstart),
            dtend: parseICalDate(dtend),
            description,
            location,
            allDay,
          });
        }

        return jsonResponse({ data: events });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // GET /api/calendar/o365?email=X&start=Y&end=Z — Office 365 / Exchange calendar
    // Strategy: try OAuth2 + Graph API first, fall back to EWS basic auth.
    if (url.startsWith("/api/calendar/o365") && method === "GET") {
      const params = new URL(url, "http://x").searchParams;
      const email = params.get("email") ?? "";
      const startDate = params.get("start") || new Date().toISOString().split("T")[0];
      const endDate = params.get("end") || (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split("T")[0]; })();

      if (!email) return jsonResponse({ error: "Missing email" }, 400);

      // ── Attempt 1: OAuth2 + Microsoft Graph API ──
      try {
        const filters = JSON.stringify([["email_id", "=", email]]);
        const fields = JSON.stringify(["name", "email_id", "connected_app"]);
        const emailAccRes = await erpnextFetch(instanceId,
          `/api/resource/Email Account?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`);
        const emailAcc = JSON.parse(emailAccRes.body)?.data?.[0];

        if (emailAcc?.connected_app) {
          // Has Connected App → try OAuth2 Graph API
          const connAppFields = JSON.stringify(["name", "client_id", "provider_name", "token_uri"]);
          const connAppRes = await erpnextFetch(instanceId,
            `/api/resource/Connected App?fields=${encodeURIComponent(connAppFields)}&limit_page_length=10`);
          const allConnApps = JSON.parse(connAppRes.body)?.data || [];
          const connApp = allConnApps.find((a: any) => a.name === emailAcc.connected_app)
            ?? allConnApps.find((a: any) => a.provider_name?.toLowerCase().includes("microsoft") || a.client_id);

          if (connApp) {
            let clientSecret = "";
            let refreshToken = "";
            try {
              const secretRes = await erpnextFetch(instanceId,
                `/api/method/frappe.client.get_password?doctype=Connected+App&name=${encodeURIComponent(connApp.name)}&fieldname=client_secret`);
              clientSecret = JSON.parse(secretRes.body)?.message || "";
            } catch { /* ignore */ }
            const tokenName = `${connApp.name}-${email}`;
            try {
              const rtRes = await erpnextFetch(instanceId,
                `/api/method/frappe.client.get_password?doctype=Token+Cache&name=${encodeURIComponent(tokenName)}&fieldname=refresh_token`);
              refreshToken = JSON.parse(rtRes.body)?.message || "";
            } catch { /* ignore */ }

            if (refreshToken && clientSecret && connApp.client_id && connApp.token_uri) {
              const tokenResp = await originalFetch(connApp.token_uri, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  client_id: connApp.client_id,
                  client_secret: clientSecret,
                  refresh_token: refreshToken,
                  grant_type: "refresh_token",
                  scope: "https://graph.microsoft.com/.default offline_access",
                }),
              });
              const tokenData = await tokenResp.json() as { access_token?: string };
              if (tokenData.access_token) {
                const graphUrl = new URL("https://graph.microsoft.com/v1.0/me/calendarview");
                graphUrl.searchParams.set("startdatetime", `${startDate}T00:00:00Z`);
                graphUrl.searchParams.set("enddatetime", `${endDate}T23:59:59Z`);
                graphUrl.searchParams.set("$top", "200");
                graphUrl.searchParams.set("$select", "id,subject,start,end,isAllDay,location,bodyPreview,organizer,attendees,webLink,isCancelled");
                graphUrl.searchParams.set("$orderby", "start/dateTime");

                const graphResp = await originalFetch(graphUrl.toString(), {
                  headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    Accept: "application/json",
                    Prefer: 'outlook.timezone="Europe/Amsterdam"',
                  },
                  signal: AbortSignal.timeout(15000),
                });
                if (graphResp.ok) {
                  const graphData = await graphResp.json() as { value: any[] };
                  const events = (graphData.value || [])
                    .filter((e: any) => !e.isCancelled)
                    .map((e: any) => ({
                      id: e.id,
                      subject: e.subject || "(Geen titel)",
                      start: e.start?.dateTime || "",
                      end: e.end?.dateTime || "",
                      isAllDay: e.isAllDay || false,
                      location: e.location?.displayName || "",
                      bodyPreview: e.bodyPreview || "",
                      organizer: e.organizer?.emailAddress?.name || "",
                      attendees: (e.attendees || []).map((a: any) => a.emailAddress?.name || a.emailAddress?.address).filter(Boolean),
                      webLink: e.webLink || "",
                    }));
                  return jsonResponse({ data: events });
                }
              }
            }
          }
        }
      } catch { /* OAuth2/Graph not available — fall through to EWS */ }

      // ── Attempt 2: EWS (Exchange Web Services) with basic auth ──
      // Uses the same IMAP credentials the user already has configured.
      try {
        const mailCreds = desktopMailCreds.get(instanceId);
        if (!mailCreds) {
          return jsonResponse({ error: "No mail credentials configured — open Webmail first to set up email" }, 400);
        }

        // Discover EWS endpoint: try common patterns
        const domain = email.split("@")[1];
        const ewsCandidates = [
          `https://mail.${domain}/EWS/Exchange.asmx`,
          `https://${domain}/EWS/Exchange.asmx`,
          `https://outlook.office365.com/EWS/Exchange.asmx`,
          `https://${mailCreds.host}/EWS/Exchange.asmx`,
        ];
        // Deduplicate
        const uniqueEws = [...new Set(ewsCandidates)];

        const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2013"/>
  </soap:Header>
  <soap:Body>
    <m:FindItem Traversal="Shallow">
      <m:ItemShape>
        <t:BaseShape>Default</t:BaseShape>
        <t:AdditionalProperties>
          <t:FieldURI FieldURI="item:Subject"/>
          <t:FieldURI FieldURI="calendar:Start"/>
          <t:FieldURI FieldURI="calendar:End"/>
          <t:FieldURI FieldURI="calendar:IsAllDayEvent"/>
          <t:FieldURI FieldURI="calendar:Location"/>
          <t:FieldURI FieldURI="calendar:Organizer"/>
          <t:FieldURI FieldURI="item:Body"/>
        </t:AdditionalProperties>
      </m:ItemShape>
      <m:CalendarView StartDate="${startDate}T00:00:00Z" EndDate="${endDate}T23:59:59Z" MaxEntriesReturned="200"/>
      <m:ParentFolderIds>
        <t:DistinguishedFolderId Id="calendar"/>
      </m:ParentFolderIds>
    </m:FindItem>
  </soap:Body>
</soap:Envelope>`;

        const basicAuth = btoa(`${mailCreds.user}:${mailCreds.pass}`);
        let ewsResponse: Response | null = null;
        let ewsUrl = "";

        for (const candidate of uniqueEws) {
          try {
            const resp = await originalFetch(candidate, {
              method: "POST",
              headers: {
                "Content-Type": "text/xml; charset=utf-8",
                Authorization: `Basic ${basicAuth}`,
              },
              body: soapBody,
              signal: AbortSignal.timeout(10000),
            });
            if (resp.ok || resp.status === 401) {
              ewsResponse = resp;
              ewsUrl = candidate;
              break;
            }
          } catch { /* try next */ }
        }

        if (!ewsResponse) {
          return jsonResponse({ error: "Could not reach Exchange Web Services (EWS) — no OAuth2 and no EWS endpoint found" }, 502);
        }

        if (ewsResponse.status === 401) {
          return jsonResponse({ error: "EWS authentication failed — Exchange may not support basic auth" }, 401);
        }

        const xml = await ewsResponse.text();

        // Parse EWS XML response — extract CalendarItem elements
        const events: Array<{
          id: string; subject: string; start: string; end: string;
          isAllDay: boolean; location: string; bodyPreview: string;
          organizer: string; attendees: string[]; webLink: string;
        }> = [];

        // Simple XML extraction (no DOM parser needed)
        const calendarItems = xml.split("<t:CalendarItem");
        for (let i = 1; i < calendarItems.length; i++) {
          const item = calendarItems[i].split("</t:CalendarItem")[0];

          const getTag = (tag: string): string => {
            const match = item.match(new RegExp(`<t:${tag}[^>]*>([^<]*)</t:${tag}>`));
            return match ? match[1].trim() : "";
          };

          const subject = getTag("Subject") || "(Geen titel)";
          const start = getTag("Start");
          const end = getTag("End");
          const isAllDay = getTag("IsAllDayEvent") === "true";
          const location = getTag("Location");
          const organizer = item.match(/<t:Organizer>.*?<t:Name>([^<]*)<\/t:Name>/s)?.[1] || "";
          const itemId = item.match(/Id="([^"]*)"/)?.[1] || `ews-${i}`;

          if (start) {
            events.push({
              id: itemId,
              subject,
              start,
              end,
              isAllDay,
              location,
              bodyPreview: "",
              organizer,
              attendees: [],
              webLink: "",
            });
          }
        }

        return jsonResponse({ data: events });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }

    // Status
    if (url === "/api/status") {
      return new Response(JSON.stringify({ mode: "desktop-rust", version: "0.6.0" }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // Health ping
    if (url === "/api/health/ping") {
      return new Response(JSON.stringify({ ok: true, timestamp: Date.now() }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // ── Stats: /api/stats/uren and /api/stats/uren/detail ──

    if (url.startsWith("/api/stats/uren") && method === "GET") {
      const parsedUrl = new URL(url, "http://x");
      const year = parsedUrl.searchParams.get("year") || new Date().getFullYear().toString();
      const company = parsedUrl.searchParams.get("company") || "";
      const projEmployee = parsedUrl.searchParams.get("projEmployee") || "";

      if (!instanceId) {
        return new Response(JSON.stringify({ error: "No active instance" }), { status: 400, headers: { "content-type": "application/json" } });
      }
      const statsCreds = getCredsForInstance(instanceId);
      if (!statsCreds) {
        return new Response(JSON.stringify({ error: "No credentials for instance" }), { status: 401, headers: { "content-type": "application/json" } });
      }
      const instancesList = await invoke<{ instances: any[] }>("list_instances");
      const statsUrl = instancesList.instances.find((i: any) => i.id === instanceId)?.url;
      if (!statsUrl) {
        return new Response(JSON.stringify({ error: "Instance URL not found" }), { status: 404, headers: { "content-type": "application/json" } });
      }
      const erpParams = {
        instanceId,
        instanceUrl: statsUrl,
        username: statsCreds.erpnext_username,
        password: statsCreds.erpnext_password,
      };

      try {
        if (url.startsWith("/api/stats/uren/detail")) {
          const month = parseInt(parsedUrl.searchParams.get("month") || "0", 10);
          const employee = parsedUrl.searchParams.get("employee") || "";
          if (!employee) {
            return new Response(JSON.stringify({ error: "Missing employee parameter" }), { status: 400, headers: { "content-type": "application/json" } });
          }
          const data = await computeUrenDetail(erpParams, year, month, employee);
          return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
        } else {
          const data = await computeUrenStats(erpParams, year, company, projEmployee);
          return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
      }
    }

    // ── ERPNext proxy (everything else) ──

    if (!instanceId) {
      return new Response(JSON.stringify({ error: "No active instance" }), { status: 400, headers: { "content-type": "application/json" } });
    }

    const creds = getCredsForInstance(instanceId);
    if (!creds) {
      return new Response(JSON.stringify({ error: "No credentials for instance" }), { status: 401, headers: { "content-type": "application/json" } });
    }

    // Get instance URL from the credential or fetch from DB
    const instanceUrl = (await invoke<{ instances: any[] }>("list_instances"))
      .instances.find((i: any) => i.id === instanceId)?.url;

    if (!instanceUrl) {
      return new Response(JSON.stringify({ error: "Instance URL not found" }), { status: 404, headers: { "content-type": "application/json" } });
    }

    try {
      const result = await invoke<{ status: number; body: string; headers: Record<string, string> }>(
        "erpnext_request_with_creds",
        {
          instanceId,
          instanceUrl,
          username: creds.erpnext_username,
          password: creds.erpnext_password,
          method,
          path: url,
          body,
        },
      );
      return new Response(result.body, {
        status: result.status,
        headers: result.headers,
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: { "content-type": "application/json" } });
    }
  };
}
