/**
 * Server-side ERPNext HTTP client.
 *
 * Two modes:
 *   1. Legacy single-instance: uses the global ERPNEXT_URL from env
 *   2. Multi-instance bridge: uses the URL stored in `erpRequestContext`,
 *      which is set by `authMiddleware` when bridging a Y-app session +
 *      X-Y-App-Instance header. Uses AsyncLocalStorage so the context
 *      propagates through async calls without touching every call site.
 */

import { AsyncLocalStorage } from "async_hooks";
import { ERPNEXT_URL } from "./auth.ts";

interface ErpRequestContext {
  url: string;
  /**
   * Optional callback that re-authenticates against ERPNext and returns a
   * fresh session id. Called by auto-retry on 401. The bridged authMiddleware
   * sets this; the legacy single-instance flow leaves it undefined (no retry).
   */
  refreshSid?: () => Promise<string | null>;
  /** Mutable holder for the current sid so retry can update it for downstream callers. */
  sidHolder?: { current: string };
}

/** Per-request URL override storage. Set by authMiddleware when bridging Y-app sessions. */
export const erpRequestContext = new AsyncLocalStorage<ErpRequestContext>();

/** Get the ERPNext URL for the current request — bridged context wins over global. */
function getEffectiveUrl(): string {
  return erpRequestContext.getStore()?.url || ERPNEXT_URL;
}

/** Try to refresh the per-instance session and return a new sid, or null if not available. */
async function tryRefreshSid(): Promise<string | null> {
  const ctx = erpRequestContext.getStore();
  if (!ctx?.refreshSid) return null;
  const newSid = await ctx.refreshSid();
  if (newSid && ctx.sidHolder) {
    ctx.sidHolder.current = newSid;
  }
  return newSid;
}

async function erpFetchOnce(sid: string, path: string, options?: RequestInit): Promise<Response> {
  const url = `${getEffectiveUrl()}${path}`;
  const headers: Record<string, string> = {
    Cookie: sid,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...headers, ...(options?.headers as Record<string, string>) },
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === "AbortError") {
      throw new Error(`ERPNext timeout: ${path}`);
    }
    throw err;
  }
}

/**
 * Generic fetch wrapper — proxies to ERPNext with the user's session cookie.
 * Auto-retries once on 401 if the bridged authMiddleware provided a refreshSid
 * callback (multi-instance flow). Legacy single-instance flow does not retry.
 */
export async function erpFetch(erpnextSid: string, path: string, options?: RequestInit): Promise<Response> {
  const ctx = erpRequestContext.getStore();
  let sid = ctx?.sidHolder?.current || erpnextSid;
  let res = await erpFetchOnce(sid, path, options);
  if (res.status === 401 && ctx?.refreshSid) {
    const newSid = await tryRefreshSid();
    if (newSid) {
      res = await erpFetchOnce(newSid, path, options);
    }
  }
  return res;
}

async function proxyRequestOnce(
  sid: string,
  path: string,
  method: string,
  body?: string,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const url = `${getEffectiveUrl()}${path}`;
  const headers: Record<string, string> = {
    Cookie: sid,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extraHeaders,
  };
  const opts: RequestInit = { method, headers };
  if (body && (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE")) {
    opts.body = body;
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { responseHeaders[k] = v; });
  return { status: res.status, headers: responseHeaders, body: text };
}

/**
 * Proxy a raw request to ERPNext. Auto-retries once on 401 if the bridged
 * authMiddleware provided a refreshSid callback.
 */
export async function proxyRequest(
  erpnextSid: string,
  path: string,
  method: string,
  body?: string,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const ctx = erpRequestContext.getStore();
  let sid = ctx?.sidHolder?.current || erpnextSid;
  let result = await proxyRequestOnce(sid, path, method, body, extraHeaders);
  if (result.status === 401 && ctx?.refreshSid) {
    const newSid = await tryRefreshSid();
    if (newSid) {
      result = await proxyRequestOnce(newSid, path, method, body, extraHeaders);
    }
  }
  // Surface errors in the server log so we can diagnose what ERPNext actually
  // rejected — the proxy otherwise just hands the opaque body back to the
  // browser. 5xx is always logged; for write methods we also log 4xx (e.g. a
  // 403 PermissionError or a 417 validation/mandatory error on create/update),
  // because those are exactly the failures that surface as an opaque
  // "ERPNext API error" in the UI. Trim the body to keep logs sane.
  const isWrite = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
  if (result.status >= 500 || (isWrite && result.status >= 400)) {
    const preview = (result.body || "").replace(/\s+/g, " ").slice(0, 600);
    console.error(`[erpnext-proxy] ${method} ${path} → ${result.status}: ${preview}`);
  }
  return result;
}

/**
 * Upload a binary as a PRIVATE File in ERPNext via multipart POST to
 * /api/method/upload_file, and return the created File document `name`.
 *
 * Used to attach files when relaying an outgoing mail through ERPNext
 * (frappe.core.doctype.communication.email.make accepts attachments only as
 * File-doc names, not as raw content). The File is created standalone (no
 * attached_to_doctype); ERPNext clones it onto the Communication at send time.
 */
export async function uploadPrivateFile(
  erpnextSid: string,
  filename: string,
  content: Buffer,
  contentType: string,
): Promise<string> {
  const ctx = erpRequestContext.getStore();
  const sid = ctx?.sidHolder?.current || erpnextSid;
  const url = `${getEffectiveUrl()}/api/method/upload_file`;
  const form = new FormData();
  // Copy into a plain ArrayBuffer-backed Uint8Array — a Node Buffer types as
  // Buffer<ArrayBufferLike>, which is not assignable to BlobPart. Do NOT set
  // Content-Type manually; fetch must add the multipart boundary itself.
  form.append(
    "file",
    new Blob([new Uint8Array(content)], { type: contentType || "application/octet-stream" }),
    filename,
  );
  form.append("is_private", "1");
  const res = await fetch(url, {
    method: "POST",
    headers: { Cookie: sid, Accept: "application/json" },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`upload_file failed (${res.status}): ${text.replace(/\s+/g, " ").slice(0, 300)}`);
  }
  let json: { message?: { name?: string } };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`upload_file: non-JSON response: ${text.slice(0, 200)}`);
  }
  const name = json?.message?.name;
  if (!name) throw new Error(`upload_file: no File name in response: ${text.slice(0, 200)}`);
  return name;
}

/**
 * Check whether ERPNext has an outgoing-enabled Email Account whose `email_id`
 * matches `sender`. This is load-bearing for the mail-send relay-fallback:
 * `communication.email.make` resolves the outgoing account by `email_id`, and
 * when there is NO match it silently falls back to ERPNext's DEFAULT outgoing
 * account — which then rewrites the From to that account's own address. So a
 * reply from piet@… relayed while piet@… has no outgoing account goes out as
 * the default (e.g. cooperatie@…). The caller uses this to refuse relaying a
 * From we can't preserve, rather than sending under a stranger's identity.
 *
 * Returns:
 *   - `true`  → a matching enable_outgoing account exists (From will be kept)
 *   - `false` → no match (relay would rewrite the From)
 *   - `null`  → lookup itself failed (unknown; caller refuses to relay — a
 *               wrong identity is worse than a temporarily failed send)
 */
export async function hasMatchingOutgoingAccount(
  erpnextSid: string,
  sender: string,
): Promise<boolean | null> {
  const email = (sender || "").trim();
  if (!email) return false;
  try {
    const rows = await fetchList(
      erpnextSid,
      "Email Account",
      ["name"],
      [
        ["email_id", "=", email],
        ["enable_outgoing", "=", 1],
      ],
      "modified desc",
      1,
    );
    return rows.length > 0;
  } catch (err) {
    console.warn(
      `[erpnext-client] hasMatchingOutgoingAccount(${email}) lookup failed: ${(err as Error).message}`,
    );
    return null;
  }
}

/**
 * Send an email THROUGH ERPNext (Communication + Email Queue) instead of
 * opening an SMTP connection from this server. Used as a fallback when direct
 * SMTP submission is blocked at the network layer — the mail host refuses this
 * server's IP while ERPNext (a different, accepted IP) can deliver. Mirrors the
 * invoice-send payload (see frontend lib/invoiceEmail.ts sendInvoiceEmail).
 *
 * `sender` is the From email address; ERPNext resolves the matching outgoing
 * Email Account (enable_outgoing=1) by email_id, else falls back to the
 * default outgoing account. Standalone mail — no doctype/name reference.
 * Callers MUST verify a matching account exists first (see
 * `hasMatchingOutgoingAccount`); otherwise ERPNext rewrites the From to its
 * default account and the mail goes out under the wrong identity.
 */
export async function erpnextSendEmail(
  erpnextSid: string,
  payload: {
    sender: string;
    senderFullName?: string;
    recipients: string;
    cc?: string;
    bcc?: string;
    subject: string;
    content: string;
    attachments?: string[]; // File doc names from uploadPrivateFile
  },
): Promise<void> {
  const body: Record<string, unknown> = {
    subject: payload.subject || "(geen onderwerp)",
    content: payload.content || "",
    recipients: payload.recipients,
    cc: payload.cc || "",
    bcc: payload.bcc || "",
    sender: payload.sender,
    send_email: 1,
    communication_medium: "Email",
    sent_or_received: "Sent",
  };
  if (payload.senderFullName) body.sender_full_name = payload.senderFullName;
  if (payload.attachments?.length) body.attachments = JSON.stringify(payload.attachments);

  const result = await proxyRequest(
    erpnextSid,
    "/api/method/frappe.core.doctype.communication.email.make",
    "POST",
    JSON.stringify(body),
  );
  if (result.status >= 400) {
    throw new Error(
      `ERPNext email.make failed (${result.status}): ${(result.body || "").replace(/\s+/g, " ").slice(0, 400)}`,
    );
  }
}

/** Fetch a list page from ERPNext */
export async function fetchList(
  erpnextSid: string,
  doctype: string,
  fields: string[],
  filters: unknown[][] = [],
  orderBy = "modified desc",
  limitPageLength = 500,
  limitStart = 0
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(fields),
    filters: JSON.stringify(filters),
    limit_page_length: String(limitPageLength),
    limit_start: String(limitStart),
    order_by: orderBy,
  });
  const res = await erpFetch(erpnextSid, `/api/resource/${encodeURIComponent(doctype)}?${params}`);
  const json = await res.json() as { data?: Record<string, unknown>[] };
  return json.data || [];
}

/** Fetch ALL records with automatic pagination */
export async function fetchAll(
  erpnextSid: string,
  doctype: string,
  fields: string[],
  filters: unknown[][] = [],
  orderBy = "modified desc"
): Promise<Record<string, unknown>[]> {
  const PAGE = 500;
  // Hard cap mirrors the frontend `lib/erpnext.ts` cap. Without it,
  // a misbehaving ERPNext upstream that returns full batches forever
  // (e.g. order_by ignored, or a custom doctype with broken pagination)
  // would pin a Node thread in this loop until OOM. 50_000 records is
  // already 100 sequential round-trips and well past any realistic
  // dataset for a single user/company stats query.
  const MAX_RECORDS = 50_000;
  let all: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const batch = await fetchList(erpnextSid, doctype, fields, filters, orderBy, PAGE, offset);
    all = all.concat(batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
    if (offset >= MAX_RECORDS) {
      console.warn(`[erpnext-client] fetchAll(${doctype}) hit safety cap at ${MAX_RECORDS} records — truncating result`);
      break;
    }
  }
  return all;
}
