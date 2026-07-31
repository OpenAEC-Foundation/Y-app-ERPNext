/**
 * ERPNext API-client — praat same-origin met de ERPNext-site zelf.
 *
 * Er zit geen eigen backend of proxy meer tussen: de app draait op dezelfde
 * origin als ERPNext v16 en rijdt mee op de bestaande Frappe-sessiecookie die
 * de browser al heeft. Alle calls gaan daarom rechtstreeks naar de standaard
 * Frappe REST/RPC-endpoints (`/api/resource/...`, `/api/method/...`) met
 * `credentials: "same-origin"`.
 *
 * Muterende requests (POST/PUT/DELETE) sturen het Frappe CSRF-token mee via
 * de `X-Frappe-CSRF-Token`-header; zie `csrf.ts` voor waar dat token vandaan
 * komt. GET-requests hebben dat niet nodig.
 */

import { getActiveInstance, getActiveInstanceId } from "./instances.ts";
import { getCsrfToken } from "./csrf.ts";

/** Performance logging — shows cache hits, fetch times, and slow queries in console */
const PERF_LOG = typeof localStorage !== "undefined" && localStorage.getItem("y_app_perf_log") === "1";

/**
 * Per-operation timeouts. Without these, a hung ERPNext upstream stalls
 * the UI forever — the user has no recovery path short of reloading the
 * tab. AbortSignal.timeout() rejects with a DOMException whose name is
 * "TimeoutError"; fetchWithTimeout below converts that into a real
 * ApiError(0, …) so call sites get a usable message instead of the
 * browser's cryptic default.
 */
const READ_TIMEOUT_MS = 15_000;       // fetchList / fetchDocument / fetchCount
const MUTATION_TIMEOUT_MS = 30_000;   // create / update / delete / callMethod
const UPLOAD_TIMEOUT_MS = 120_000;    // uploadFile (large multipart bodies)

/** Build API URL: simple path + optional query params (no instance param) */
function buildApiUrl(path: string, extraParams?: URLSearchParams): string {
  const qs = extraParams?.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Get the ERPNext app URL for the active instance (for links, file URLs, etc.) */
export function getErpNextAppUrl(): string {
  return getActiveInstance().url;
}

/** Get the ERPNext link URL for document links (appends /app to the instance URL) */
export function getErpNextLinkUrl(): string {
  return `${getErpNextAppUrl()}/app`;
}

/** Minimal headers — no auth needed, backend handles that via cookie */
function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** CSRF header for non-GET requests, when a token is available (empty otherwise). */
function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { "X-Frappe-CSRF-Token": token } : {};
}

/** Headers for non-GET (mutating) requests — getHeaders() plus the CSRF token. */
function getMutationHeaders(): HeadersInit {
  return { ...getHeaders(), ...csrfHeaders() };
}

/** API error with status code */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Handle auth errors — only force a logout when the ERPNext session itself
 * is actually invalid. A single 401 from a given call can also mean a
 * transient upstream blip, so verify before dumping the user back at the
 * login page mid-session.
 *
 * Verify via `GET /api/method/frappe.auth.get_logged_user` (same-origin,
 * standard Frappe API). On a website page a logged-out visitor gets HTTP 200
 * with `message: "Guest"` rather than a 4xx, so that is treated the same as
 * an outright 401/403. Otherwise the session is fine and we leave the user
 * where they are; the call site still gets an ApiError and can decide what
 * to do (retry, show a toast, etc.).
 *
 * Fire-and-forget on purpose: callers don't need to await this side effect.
 */
function handleAuthError(res: Response): void {
  if (res.status !== 401) return;
  void (async () => {
    try {
      const meRes = await fetch("/api/method/frappe.auth.get_logged_user", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (meRes.status === 401 || meRes.status === 403) {
        window.dispatchEvent(new CustomEvent("y-app:unauthorized"));
        return;
      }
      const body = (await meRes.json().catch(() => null)) as { message?: string } | null;
      if (body?.message === "Guest") {
        window.dispatchEvent(new CustomEvent("y-app:unauthorized"));
      }
    } catch {
      // Network error verifying — leave the user where they are.
    }
  })();
}

/**
 * Extract a human-readable error message from an ERPNext/Frappe error response.
 * Frappe returns one of: { _server_messages: "[\"<json>\"]" } (validation /
 * permission), { exception: "..." } / { message: "..." }, or { exc: "<traceback>" }
 * (Python error). Tries each in order of usefulness and returns "" if nothing
 * usable, so callers can fall back to a generic "ERPNext API error: <status>".
 *
 * Why this exists: REST create/update permission errors come back as
 * { exc_type: "PermissionError", _server_messages: "[...]" }. The old
 * createDocument/updateDocument only read `exc`/`error`/`message`, so they
 * dropped the real reason and surfaced a useless "ERPNext API error: 403".
 * This mirrors the parsing callMethod already did and is now shared by all three.
 */
async function parseErpError(res: Response): Promise<string> {
  const errData = (await res.json().catch(() => null)) as
    | { exc?: string; _server_messages?: string; message?: string; exception?: string; error?: string }
    | null;
  if (!errData) return "";
  let detail = "";
  if (errData._server_messages) {
    try {
      const arr = JSON.parse(errData._server_messages);
      const first = Array.isArray(arr) && arr.length > 0 ? JSON.parse(arr[0]) : null;
      detail = first?.message || first?.title || "";
    } catch {
      /* fall through */
    }
  }
  if (!detail && errData.exception) detail = errData.exception;
  if (!detail && errData.error) detail = errData.error;
  if (!detail && errData.message) detail = errData.message;
  if (!detail && errData.exc) {
    // exc is a (sometimes huge) traceback — pull the last line for brevity
    const lines = String(errData.exc).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    detail = lines[lines.length - 1] || "";
  }
  return detail;
}

export interface ERPNextListResponse<T = Record<string, unknown>> {
  data: T[];
}

/** Client-side response cache (30s TTL) — eliminates redundant fetches on navigation */
const responseCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 30_000; // 30s
/** In-flight request deduplication — coalesces identical requests within 100ms */
const inflightRequests = new Map<string, Promise<unknown>>();

/**
 * Scope a cache/dedup key to the active instance. Without the instance id,
 * `/api/resource/Project` would collide between two tenants — a user
 * switching tabs within CACHE_TTL would be served the previous tenant's
 * rows. Each instance gets its own disjoint cache.
 */
function cacheKey(url: string): string {
  return `${getActiveInstance().id}::${url}`;
}

/** Invalidate cache entries matching a doctype (call after mutations) */
export function invalidateCache(doctype?: string) {
  if (!doctype) { responseCache.clear(); return; }
  // Mutations are scoped to the current instance — only drop that
  // instance's entries, not every tenant's cached copy of the doctype.
  const prefix = `${getActiveInstance().id}::`;
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix) && key.includes(`/api/resource/${doctype}`)) {
      responseCache.delete(key);
    }
  }
}

/**
 * fetch() wrapper that enforces a per-call timeout via AbortSignal and
 * converts AbortError / TimeoutError into a consistent ApiError. Use this
 * everywhere instead of raw fetch() in this file.
 */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new ApiError(0, `Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  }
}

export async function fetchList<T = Record<string, unknown>>(
  doctype: string,
  params?: {
    fields?: string[];
    filters?: unknown[][];
    or_filters?: unknown[][];
    limit_page_length?: number;
    limit_start?: number;
    order_by?: string;
  }
): Promise<T[]> {
  const searchParams = new URLSearchParams();
  if (params?.fields) {
    searchParams.set("fields", JSON.stringify(params.fields));
  }
  if (params?.filters) {
    searchParams.set("filters", JSON.stringify(params.filters));
  }
  if (params?.or_filters) {
    // Frappe's REST endpoint accepts `or_filters` as a JSON array. Useful for
    // search-style queries where any of N predicates should match (e.g. find
    // a customer whose `name` OR `customer_name` matches the typed text).
    searchParams.set("or_filters", JSON.stringify(params.or_filters));
  }
  if (params?.limit_page_length !== undefined) {
    searchParams.set("limit_page_length", String(params.limit_page_length));
  }
  if (params?.limit_start !== undefined) {
    searchParams.set("limit_start", String(params.limit_start));
  }
  if (params?.order_by) {
    searchParams.set("order_by", params.order_by);
  }

  const url = buildApiUrl(`/api/resource/${doctype}`, searchParams);
  const key = cacheKey(url);

  // Check response cache
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    if (PERF_LOG) console.log(`%c[cache hit] ${doctype}`, "color:#16a34a", `${Date.now() - cached.ts}ms old`);
    return cached.data as T[];
  }

  // Deduplicate in-flight requests
  const inflight = inflightRequests.get(key);
  if (inflight) {
    if (PERF_LOG) console.log(`%c[dedup] ${doctype}`, "color:#d97706", "coalesced with in-flight");
    return inflight as Promise<T[]>;
  }

  const t0 = performance.now();
  const promise = (async () => {
    const res = await fetchWithTimeout(url, { headers: getHeaders(), credentials: "same-origin" }, READ_TIMEOUT_MS);
    if (!res.ok) {
      handleAuthError(res);
      if (res.status === 403) throw new ApiError(403, `No permission to access ${doctype}`);
      throw new ApiError(res.status, `ERPNext API error: ${res.status}`);
    }
    const json: ERPNextListResponse<T> = await res.json();
    const ms = Math.round(performance.now() - t0);
    if (PERF_LOG) console.log(`%c[fetch] ${doctype}`, ms > 500 ? "color:#dc2626;font-weight:bold" : "color:#2563eb", `${ms}ms (${json.data.length} rows)`);
    responseCache.set(key, { data: json.data, ts: Date.now() });
    return json.data;
  })();

  inflightRequests.set(key, promise);
  // The .finally() returns a NEW promise (the chain) which is discarded.
  // If `promise` rejects (e.g., 403/417 from ERPNext), the discarded chain
  // also rejects and shows up as "Uncaught (in promise)" noise in the
  // browser console — even though the original `promise` returned to
  // callers IS handled by their .catch. The .catch(() => {}) here only
  // attaches to the discarded chain, leaving the original `promise`'s
  // rejection visible to actual callers as before.
  promise.finally(() => setTimeout(() => inflightRequests.delete(key), 100)).catch(() => {});

  return promise;
}

/** Fetch ALL records with parallel pagination */
export async function fetchAll<T = Record<string, unknown>>(
  doctype: string,
  fields: string[],
  filters?: unknown[][],
  orderBy?: string
): Promise<T[]> {
  const pageSize = 500;
  // First page — determines if we need more
  const first = await fetchList<T>(doctype, {
    fields, filters, order_by: orderBy,
    limit_page_length: pageSize, limit_start: 0,
  });
  if (first.length < pageSize) return first;

  // Fetch remaining pages in batches of 5 (parallel), stop when a batch returns < pageSize
  const allResults = [...first];
  let start = pageSize;
  while (true) {
    const batch = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        fetchList<T>(doctype, {
          fields, filters, order_by: orderBy,
          limit_page_length: pageSize, limit_start: start + i * pageSize,
        })
      )
    );
    let done = false;
    for (const page of batch) {
      if (page.length > 0) allResults.push(...page);
      if (page.length < pageSize) { done = true; break; }
    }
    if (done) break;
    start += 5 * pageSize;
    if (start > 50000) break; // Safety limit
  }
  return allResults;
}

export async function fetchDocument<T = Record<string, unknown>>(
  doctype: string,
  name: string
): Promise<T> {
  const url = `/api/resource/${doctype}/${encodeURIComponent(name)}`;
  const key = cacheKey(url);

  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    if (PERF_LOG) console.log(`%c[cache hit] ${doctype}/${name}`, "color:#16a34a");
    return cached.data as T;
  }

  const inflight = inflightRequests.get(key);
  if (inflight) {
    if (PERF_LOG) console.log(`%c[dedup] ${doctype}/${name}`, "color:#d97706");
    return inflight as Promise<T>;
  }

  const t0 = performance.now();
  const promise = (async () => {
    const res = await fetchWithTimeout(url, { headers: getHeaders(), credentials: "same-origin" }, READ_TIMEOUT_MS);
    if (!res.ok) {
      handleAuthError(res);
      if (res.status === 403) throw new ApiError(403, `No permission to access ${doctype}`);
      throw new ApiError(res.status, `ERPNext API error: ${res.status}`);
    }
    const json = await res.json();
    const ms = Math.round(performance.now() - t0);
    if (PERF_LOG) console.log(`%c[fetch] ${doctype}/${name}`, ms > 500 ? "color:#dc2626;font-weight:bold" : "color:#2563eb", `${ms}ms`);
    responseCache.set(key, { data: json.data, ts: Date.now() });
    return json.data as T;
  })();

  inflightRequests.set(key, promise);
  // See fetchList for why the .catch(() => {}) is here — silences the
  // unhandled-rejection noise on the discarded .finally chain without
  // affecting the rejection visible on the returned promise.
  promise.finally(() => setTimeout(() => inflightRequests.delete(key), 100)).catch(() => {});

  return promise;
}

export interface FileInfo {
  name: string;
  file_name: string;
  file_url: string;
  file_size: number;
  is_private: number;
}

export async function fetchAttachments(
  doctype: string,
  docname: string
): Promise<FileInfo[]> {
  return fetchList<FileInfo>("File", {
    fields: ["name", "file_name", "file_url", "file_size", "is_private"],
    filters: [
      ["attached_to_doctype", "=", doctype],
      ["attached_to_name", "=", docname],
    ],
    limit_page_length: 50,
  });
}

export function getFileUrl(fileUrl: string): string {
  return `${getErpNextAppUrl()}${fileUrl}`;
}

export function getAuthHeaders(): HeadersInit {
  return getHeaders();
}

export async function callMethod(
  method: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const url = `/api/method/${method}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: getMutationHeaders(),
    credentials: "same-origin",
    body: JSON.stringify(args),
  }, MUTATION_TIMEOUT_MS);
  if (!res.ok) {
    handleAuthError(res);
    if (res.status === 403) throw new ApiError(403, `No permission to access ${method}`);
    // Parse ERPNext's error body so the UI can show what actually went wrong.
    const detail = await parseErpError(res);
    throw new ApiError(res.status, detail
      ? `${method}: ${detail}`
      : `ERPNext API error: ${res.status} (${method})`);
  }
  const json = await res.json();
  return json.message;
}

export async function createDocument<T = Record<string, unknown>>(
  doctype: string,
  data: Record<string, unknown>
): Promise<T> {
  const url = `/api/resource/${doctype}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: getMutationHeaders(),
    credentials: "same-origin",
    body: JSON.stringify(data),
  }, MUTATION_TIMEOUT_MS);
  if (!res.ok) {
    handleAuthError(res);
    const detail = await parseErpError(res);
    throw new ApiError(res.status, detail || `ERPNext API error: ${res.status}`);
  }
  const json = await res.json();
  invalidateCache(doctype);
  return json.data;
}

export async function updateDocument<T = Record<string, unknown>>(
  doctype: string,
  name: string,
  data: Record<string, unknown>
): Promise<T> {
  const url = `/api/resource/${doctype}/${encodeURIComponent(name)}`;
  const res = await fetchWithTimeout(url, {
    method: "PUT",
    headers: getMutationHeaders(),
    credentials: "same-origin",
    body: JSON.stringify(data),
  }, MUTATION_TIMEOUT_MS);
  if (!res.ok) {
    handleAuthError(res);
    const detail = await parseErpError(res);
    throw new ApiError(res.status, detail || `ERPNext API error: ${res.status}`);
  }
  const json = await res.json();
  invalidateCache(doctype);
  return json.data;
}

export async function deleteDocument(
  doctype: string,
  name: string
): Promise<void> {
  const url = `/api/resource/${doctype}/${encodeURIComponent(name)}`;
  const res = await fetchWithTimeout(url, {
    method: "DELETE",
    headers: getMutationHeaders(),
    credentials: "same-origin",
  }, MUTATION_TIMEOUT_MS);
  if (!res.ok) {
    handleAuthError(res);
    const detail = await parseErpError(res);
    throw new ApiError(res.status, detail || `ERPNext API error: ${res.status}`);
  }
  invalidateCache(doctype);
}

export async function uploadFile(
  file: File,
  doctype: string,
  docname: string,
  isPrivate: boolean = false
): Promise<FileInfo> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doctype", doctype);
  formData.append("docname", docname);
  formData.append("is_private", isPrivate ? "1" : "0");

  const url = `/api/method/upload_file`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    // NB: no Content-Type here — the browser must set its own multipart
    // boundary for FormData bodies, so this can't reuse getMutationHeaders().
    headers: { Accept: "application/json", ...csrfHeaders() },
    credentials: "same-origin",
    body: formData,
  }, UPLOAD_TIMEOUT_MS);
  if (!res.ok) {
    handleAuthError(res);
    throw new Error(`Upload failed: ${res.status}`);
  }
  const json = await res.json();
  return json.message;
}

export async function fetchCount(
  doctype: string,
  filters?: unknown[][]
): Promise<number> {
  const instanceId = getActiveInstanceId();
  if (instanceId === "default") {
    // Legacy fallback: use old REST aggregate (only for the default/non-multi-instance case)
    const args: Record<string, string> = {
      fields: JSON.stringify(["count(name) as total"]),
      filters: filters ? JSON.stringify(filters) : "[]",
      limit_page_length: "1",
    };
    const url = `/api/resource/${doctype}?${new URLSearchParams(args)}`;
    const key = cacheKey(url);
    const cached = responseCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data as number;
    const res = await fetchWithTimeout(url, { headers: getHeaders(), credentials: "same-origin" }, READ_TIMEOUT_MS);
    if (!res.ok) {
      handleAuthError(res);
      throw new ApiError(res.status, `ERPNext API error: ${res.status}`);
    }
    const json = await res.json();
    const count = json.data?.[0]?.total ?? 0;
    responseCache.set(key, { data: count, ts: Date.now() });
    return count;
  }

  // Version-aware count via server abstraction
  const params = new URLSearchParams({ doctype });
  if (filters) params.set("filters", JSON.stringify(filters));
  const url = `/api/i/${instanceId}/count?${params}`;
  const key = cacheKey(url);
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data as number;

  const res = await fetchWithTimeout(url, { headers: getHeaders(), credentials: "same-origin" }, READ_TIMEOUT_MS);
  if (!res.ok) {
    handleAuthError(res);
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.error || `Count failed: ${res.status}`);
  }
  const json = await res.json();
  const count = Number(json.count ?? 0);
  responseCache.set(key, { data: count, ts: Date.now() });
  return count;
}
