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

import { getActiveInstance } from "./instances.ts";
import { getCsrfToken, refreshCsrfToken } from "./csrf.ts";

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

/**
 * Statuscodes waaronder Frappe een CSRF-weigering kan terugsturen.
 * `CSRFTokenError` is een 400; 417 staat erbij omdat Frappe's generieke
 * `throw`-pad sommige validatiefouten daarop afbeeldt.
 */
const CSRF_RETRY_STATUSES = new Set([400, 417]);
/** Frappe's melding bij CSRFTokenError is letterlijk "Invalid Request". */
const CSRF_ERROR_PATTERN = /csrf|invalid request/i;

/**
 * Voert een muterende request uit en probeert hem **één keer** opnieuw als het
 * antwoord naar een verlopen/verkeerd CSRF-token ruikt.
 *
 * Waarom dit nodig is: de pagina-HTML van de Web Page is browser-cachebaar,
 * dus na een login-redirect kan de SPA nog met het gast-token ("None") draaien
 * — élke schrijfactie faalt dan met `Invalid Request`, terwijl lezen gewoon
 * werkt omdat GET geen CSRF-check kent. `refreshCsrfToken()` haalt een vers
 * token op; alleen als dat écht een ander token oplevert heeft opnieuw
 * proberen zin (anders zou een echte "Invalid Request" verdubbelen).
 *
 * De headers worden per poging opnieuw opgebouwd, zodat de retry het verse
 * token meekrijgt. Bodies zijn strings of FormData en dus herbruikbaar.
 */
async function mutationFetch(
  url: string,
  init: Omit<RequestInit, "headers">,
  timeoutMs: number,
  buildHeaders: () => HeadersInit = getMutationHeaders,
): Promise<Response> {
  const attempt = () => fetchWithTimeout(url, { ...init, headers: buildHeaders() }, timeoutMs);

  const res = await attempt();
  if (res.ok || !CSRF_RETRY_STATUSES.has(res.status)) return res;

  // Body via clone() lezen: de originele response moet leesbaar blijven voor
  // parseErpError() als dit tóch geen CSRF-fout is.
  const body = await res.clone().text().catch(() => "");
  if (!CSRF_ERROR_PATTERN.test(body)) return res;

  const before = getCsrfToken();
  const fresh = await refreshCsrfToken();
  if (!fresh || fresh === before) return res;

  return attempt();
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
 * Field self-healing — some ERPNext instances reject query fields that
 * don't exist on that install (e.g. `workflow_state` on `Task` when no
 * Task workflow is configured). Frappe answers with HTTP 417 and a
 * DataError body naming the offending field:
 * `Field not permitted in query: workflow_state`.
 *
 * Rather than hard-failing every list fetch against that doctype, fetchList
 * (and fetchCount, for fields named in its filters) drops the named field,
 * remembers the exclusion per doctype, and retries. Subsequent calls
 * (including via fetchAll's pagination) never even ask for the field again.
 *
 * The exclusion list is mirrored into **sessionStorage**, because an
 * in-memory-only cache is rebuilt from scratch on every full page load: a
 * measured 4-5 doomed round-trips per project/task list fetch, plus a wall of
 * red console noise that masks real errors. sessionStorage — not
 * localStorage — on purpose: a field can genuinely appear later (a custom
 * field gets added, a Task workflow gets configured), and a browser-session
 * boundary is the natural moment to re-check that. Persisting is
 * best-effort: any storage failure (Safari private mode, quota, blocked
 * third-party storage) degrades silently to the old in-memory behaviour.
 */
const REJECTED_FIELDS_STORAGE_KEY = "ynext_bad_fields_v1";
const rejectedFieldsCache = new Map<string, Set<string>>();
const warnedRejectedFields = new Set<string>();

/** sessionStorage if it exists and is usable; `null` otherwise (SSR, tests,
 *  blocked storage — merely *touching* the property can throw in Safari). */
function rejectedFieldsStore(): Storage | null {
  try {
    return (globalThis as { sessionStorage?: Storage }).sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * (Re)hydrate the exclusion list from sessionStorage, replacing whatever is
 * in memory. Called once at module init; exported so tests can install a
 * storage mock and reload deterministically.
 */
export function loadRejectedFieldsFromStorage(): void {
  rejectedFieldsCache.clear();
  const store = rejectedFieldsStore();
  if (!store) return;
  let parsed: unknown;
  try {
    const raw = store.getItem(REJECTED_FIELDS_STORAGE_KEY);
    if (!raw) return;
    parsed = JSON.parse(raw);
  } catch {
    return; // corrupt or unreadable — start clean rather than throw at import time
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
  for (const [doctype, fields] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(fields)) continue;
    const set = new Set(fields.filter((f): f is string => typeof f === "string"));
    if (set.size > 0) rejectedFieldsCache.set(doctype, set);
  }
}

function persistRejectedFields(): void {
  const store = rejectedFieldsStore();
  if (!store) return;
  const plain: Record<string, string[]> = {};
  for (const [doctype, set] of rejectedFieldsCache) {
    if (set.size > 0) plain[doctype] = [...set];
  }
  try {
    store.setItem(REJECTED_FIELDS_STORAGE_KEY, JSON.stringify(plain));
  } catch {
    /* quota or blocked storage — the in-memory cache still works this tab */
  }
}

/** Test seam: drop both the in-memory list and the persisted copy. */
export function resetRejectedFieldsCache(): void {
  rejectedFieldsCache.clear();
  warnedRejectedFields.clear();
  const store = rejectedFieldsStore();
  try {
    store?.removeItem(REJECTED_FIELDS_STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}

function getRejectedFields(doctype: string): Set<string> {
  let set = rejectedFieldsCache.get(doctype);
  if (!set) {
    set = new Set();
    rejectedFieldsCache.set(doctype, set);
  }
  return set;
}

/**
 * Record one newly-rejected field: remember it in memory, write the whole
 * list through to sessionStorage, and warn once.
 */
function rememberRejectedField(doctype: string, field: string): void {
  getRejectedFields(doctype).add(field);
  persistRejectedFields();
  warnRejectedFieldOnce(doctype, field);
}

function warnRejectedFieldOnce(doctype: string, field: string): void {
  const warnKey = `${doctype}::${field}`;
  if (warnedRejectedFields.has(warnKey)) return;
  warnedRejectedFields.add(warnKey);
  console.warn(`[erpnext] "${doctype}" rejected field "${field}" (not permitted in query) — excluding it from future requests.`);
}

// Pick up this session's already-known exclusions before the first fetch, so
// a page reload doesn't re-walk the whole 417 chain.
loadRejectedFieldsFromStorage();

/**
 * Pull every human-readable message string out of a parsed Frappe/ERPNext
 * error response body. Frappe is inconsistent about which key carries the
 * actual message depending on version and error path (`exception`, `exc`,
 * `message`, or the JSON-encoded `_server_messages` array), so callers that
 * need to pattern-match on the message (self-heal, missing-doctype
 * detection, …) all search this same combined haystack.
 */
function collectErrorMessageTexts(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const b = body as { exception?: string; exc?: string; message?: string; _server_messages?: string };
  const haystacks: string[] = [];
  if (b.exception) haystacks.push(b.exception);
  if (b.exc) haystacks.push(b.exc);
  if (b.message) haystacks.push(b.message);
  if (b._server_messages) {
    try {
      const arr = JSON.parse(b._server_messages);
      if (Array.isArray(arr)) {
        for (const item of arr) {
          try {
            const parsed = JSON.parse(item);
            if (parsed?.message) haystacks.push(String(parsed.message));
          } catch {
            haystacks.push(String(item));
          }
        }
      }
    } catch {
      /* not JSON — ignore */
    }
  }
  return haystacks;
}

/**
 * Look for Frappe's "Field not permitted in query: <field>" DataError
 * message anywhere in a parsed error response body.
 */
function extractRejectedField(body: unknown): string | null {
  for (const text of collectErrorMessageTexts(body)) {
    const m = /Field not permitted in query:\s*([A-Za-z0-9_]+)/.exec(text);
    if (m) return m[1];
  }
  return null;
}

/**
 * Missing-doctype detection — some ERPNext instances don't have every app
 * installed (e.g. no HRMS → no `Leave Application`/`Leave Allocation`, no
 * Wiki app → no `Wiki Page`). Frappe answers list/count requests against
 * those doctypes with HTTP 404 and a DoesNotExistError body:
 * `DocType <name> not found` — a different message shape than "record not
 * found" (`{Doctype} {docname} not found`), which is what fetchDocument's
 * single-record lookups should keep surfacing as a normal 404.
 */
function extractMissingDoctype(body: unknown): string | null {
  for (const text of collectErrorMessageTexts(body)) {
    const m = /^DocType\s+(.+?)\s+not found$/.exec(text.trim());
    if (m) return m[1];
  }
  return null;
}

/**
 * Doctypes confirmed missing on the active instance, scoped per instance
 * (so switching tenants doesn't leak one site's missing-app list onto
 * another). Once a doctype is known missing, fetchList/fetchAll/fetchCount
 * short-circuit to an empty result without another network round-trip for
 * the life of the tab.
 */
const missingDoctypesCache = new Set<string>();
const warnedMissingDoctypes = new Set<string>();

function missingDoctypeKey(doctype: string): string {
  return `${getActiveInstance().id}::${doctype}`;
}

/**
 * Whether `doctype` has already been confirmed missing on the active
 * instance (see markDoctypeMissing above) — i.e. every fetchList/fetchAll/
 * fetchCount call against it is degrading to an empty result rather than
 * hitting the network. Pages that need to tell "genuinely zero records"
 * apart from "this app isn't installed here" (e.g. to show a dedicated
 * "module unavailable" notice instead of a misleading all-zeros view) can
 * check this after their initial load instead of re-deriving the same
 * missing-doctype detection themselves.
 *
 * Only reflects doctypes this tab has actually queried at least once —
 * before the first request, a genuinely-missing doctype still reads as
 * `false` here.
 */
export function isDoctypeMissing(doctype: string): boolean {
  return missingDoctypesCache.has(missingDoctypeKey(doctype));
}

function markDoctypeMissing(doctype: string): void {
  const key = missingDoctypeKey(doctype);
  missingDoctypesCache.add(key);
  if (!warnedMissingDoctypes.has(key)) {
    warnedMissingDoctypes.add(key);
    console.warn(`[erpnext] doctype "${doctype}" does not exist on this instance — returning empty results for it from now on.`);
  }
}

/**
 * Scope a cache/dedup key to the active instance. Without the instance id,
 * `/api/resource/Project` would collide between two tenants — a user
 * switching tabs within CACHE_TTL would be served the previous tenant's
 * rows. Each instance gets its own disjoint cache.
 */
function cacheKey(url: string): string {
  return `${getActiveInstance().id}::${url}`;
}

/**
 * Invalidate cache entries matching a doctype (call after mutations).
 *
 * Raakt twee vormen, want tellingen lopen niet via `/api/resource`:
 * de REST-lijsten (`/api/resource/<doctype>…`) én de RPC's die het doctype in
 * hun querystring dragen (`frappe.client.get_count?doctype=<doctype>&…`,
 * idem `get_list`). Zonder die tweede vorm bleef een badge na een
 * schrijfactie tot 30 s de oude telling tonen — een map die leeg is maar "2"
 * blijft zeggen leest als een kapotte teller.
 */
export function invalidateCache(doctype?: string) {
  if (!doctype) { responseCache.clear(); return; }
  // Mutations are scoped to the current instance — only drop that
  // instance's entries, not every tenant's cached copy of the doctype.
  const prefix = `${getActiveInstance().id}::`;
  // Exacte doctype-match in de querystring: `doctype=Communication` mag geen
  // `doctype=Communication%20Link` meetrekken (en andersom).
  const rpcDoctype = `doctype=${encodeURIComponent(doctype)}`;
  for (const key of responseCache.keys()) {
    if (!key.startsWith(prefix)) continue;
    const rpcAt = key.indexOf(rpcDoctype);
    const rpcMatch = rpcAt >= 0
      && (key.length === rpcAt + rpcDoctype.length || key[rpcAt + rpcDoctype.length] === "&");
    if (key.includes(`/api/resource/${doctype}`) || rpcMatch) {
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
    /**
     * `GROUP BY`-expressie. Nodig zodra een filter op een **child-tabel**
     * staat (bv. `["Communication Link", "link_doctype", "=", "Project"]`):
     * Frappe joint die tabel er dan bij en levert de parent één keer per
     * gematchte child-rij op. Live geverifieerd op de doelinstance: dezelfde
     * query gaf 94 rijen voor 36 verschillende Communications, en `distinct=1`
     * hielp daar niet tegen — alleen `group_by` ontdubbelt.
     */
    group_by?: string;
  }
): Promise<T[]> {
  // Doctype confirmed missing on this instance (no app installed for it) —
  // skip the network round-trip entirely and behave like an empty list.
  if (isDoctypeMissing(doctype)) return [];

  // Drop fields this doctype has already told us it doesn't permit, so
  // repeat calls (including fetchAll's pagination) never re-trigger a 417.
  const rejected = getRejectedFields(doctype);
  let fields = params?.fields ? params.fields.filter((f) => !rejected.has(f)) : params?.fields;

  const searchParams = new URLSearchParams();
  if (fields) {
    searchParams.set("fields", JSON.stringify(fields));
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
  if (params?.group_by) {
    searchParams.set("group_by", params.group_by);
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
    let attemptFields = fields;
    let attemptUrl = url;
    for (;;) {
      const res = await fetchWithTimeout(attemptUrl, { headers: getHeaders(), credentials: "same-origin" }, READ_TIMEOUT_MS);
      if (!res.ok) {
        // Self-heal: drop a field the instance just told us it doesn't
        // permit in queries (417 DataError) and retry. Naturally bounded —
        // each retry removes one distinct field from attemptFields, so the
        // loop can iterate at most `attemptFields.length` times regardless
        // of how many fields on this doctype turn out to be restricted; a
        // fixed attempt cap here would cut a legitimate heal short on a
        // doctype with many restricted fields.
        if (attemptFields && attemptFields.length > 0) {
          const errBody = await res.clone().json().catch(() => null);
          const badField = extractRejectedField(errBody);
          if (badField && attemptFields.includes(badField)) {
            rememberRejectedField(doctype, badField);
            attemptFields = attemptFields.filter((f) => f !== badField);
            const retryParams = new URLSearchParams(searchParams);
            if (attemptFields.length > 0) retryParams.set("fields", JSON.stringify(attemptFields));
            else retryParams.delete("fields");
            attemptUrl = buildApiUrl(`/api/resource/${doctype}`, retryParams);
            continue;
          }
        }
        // Doctype not installed on this instance (no app providing it) —
        // cache that fact and degrade to an empty list instead of a
        // recurring, unrecoverable error on every page that queries it.
        if (res.status === 404) {
          const errBody = await res.clone().json().catch(() => null);
          const missingDoctype = extractMissingDoctype(errBody);
          if (missingDoctype) {
            markDoctypeMissing(doctype);
            responseCache.set(key, { data: [], ts: Date.now() });
            return [] as T[];
          }
        }
        handleAuthError(res);
        if (res.status === 403) throw new ApiError(403, `No permission to access ${doctype}`);
        throw new ApiError(res.status, `ERPNext API error: ${res.status}`);
      }
      const json: ERPNextListResponse<T> = await res.json();
      const ms = Math.round(performance.now() - t0);
      if (PERF_LOG) console.log(`%c[fetch] ${doctype}`, ms > 500 ? "color:#dc2626;font-weight:bold" : "color:#2563eb", `${ms}ms (${json.data.length} rows)`);
      responseCache.set(key, { data: json.data, ts: Date.now() });
      return json.data;
    }
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
  const res = await mutationFetch(url, {
    method: "POST",
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

/**
 * List rows of a Frappe child-table doctype (e.g. "Timesheet Detail")
 * directly, scoped to its parent doctype.
 *
 * On Frappe v16, a plain `/api/resource/<Child Doctype>` list query for a
 * child table — fetchList's usual path — comes back HTTP 403
 * ("Insufficient Permission for Timesheet Detail"), *even when the query
 * includes a `["parenttype", "=", "<Parent Doctype>"]` filter*: verified
 * against a live v16 instance, both plain and parenttype-filtered
 * `/api/resource` requests 403 identically. The documented, working way to
 * list child-table rows is the `frappe.client.get_list` RPC with an
 * explicit `parent` argument (not a filter) naming the parent doctype —
 * also verified live: same query, only the `parent` kwarg differs, and it
 * returns 200 with the expected rows. This wraps that call.
 *
 * Unlike fetchList, this is not client-side cached or self-healing on
 * rejected fields — callers with those needs should wrap this themselves.
 */
export async function fetchChildTable<T = Record<string, unknown>>(
  childDoctype: string,
  parentDoctype: string,
  fields: string[],
  filters?: unknown[][],
  limitPageLength?: number
): Promise<T[]> {
  const args: Record<string, unknown> = { doctype: childDoctype, parent: parentDoctype, fields };
  if (filters && filters.length > 0) args.filters = filters;
  if (limitPageLength !== undefined) args.limit_page_length = limitPageLength;
  const result = await callMethod("frappe.client.get_list", args);
  return (result as T[] | null) || [];
}

export async function createDocument<T = Record<string, unknown>>(
  doctype: string,
  data: Record<string, unknown>
): Promise<T> {
  const url = `/api/resource/${doctype}`;
  const res = await mutationFetch(url, {
    method: "POST",
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
  const res = await mutationFetch(url, {
    method: "PUT",
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
  const res = await mutationFetch(url, {
    method: "DELETE",
    credentials: "same-origin",
  }, MUTATION_TIMEOUT_MS);
  if (!res.ok) {
    handleAuthError(res);
    const detail = await parseErpError(res);
    throw new ApiError(res.status, detail || `ERPNext API error: ${res.status}`);
  }
  invalidateCache(doctype);
}

/**
 * Extra's die Frappe's `upload_file` kent maar die lang niet elke aanroeper
 * wil. `optimize` laat Frappe de afbeelding **server-side** herschalen en
 * hercomprimeren (Pillow) vóór hij hem wegschrijft. Dat is beter dan een
 * canvas-truc in de browser: het werkt in elke webview, kost hier geen code,
 * en een client die het overslaat kan het resultaat niet stiekem oprekken.
 * Niet-afbeeldingen en SVG laat Frappe ongemoeid.
 */
export interface UploadOptions {
  optimize?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

export async function uploadFile(
  file: File,
  doctype: string,
  docname: string,
  isPrivate: boolean = false,
  options?: UploadOptions
): Promise<FileInfo> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doctype", doctype);
  formData.append("docname", docname);
  formData.append("is_private", isPrivate ? "1" : "0");
  if (options?.optimize) formData.append("optimize", "1");
  if (options?.maxWidth !== undefined) formData.append("max_width", String(options.maxWidth));
  if (options?.maxHeight !== undefined) formData.append("max_height", String(options.maxHeight));

  const url = `/api/method/upload_file`;
  const res = await mutationFetch(url, {
    method: "POST",
    credentials: "same-origin",
    body: formData,
    // NB: no Content-Type here — the browser must set its own multipart
    // boundary for FormData bodies, so this can't reuse getMutationHeaders().
  }, UPLOAD_TIMEOUT_MS, () => ({ Accept: "application/json", ...csrfHeaders() }));
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
  // Doctype confirmed missing on this instance — skip the round-trip.
  if (isDoctypeMissing(doctype)) return 0;

  // Uses Frappe's dedicated frappe.client.get_count RPC rather than the old
  // /api/resource aggregate-field trick (`fields=["count(name) as total"]`):
  // current Frappe versions reject raw SQL function strings in `fields` with
  // HTTP 417 ("SQL functions are not allowed as strings in SELECT"), and
  // that failure has no field to drop — it fails identically on every retry,
  // for every doctype, forever. frappe.client.get_count is the documented,
  // always-available way to get a row count and carries none of that baggage.
  const rejected = getRejectedFields(doctype);
  let attemptFilters = filters
    ? filters.filter((f) => !(Array.isArray(f) && typeof f[0] === "string" && rejected.has(f[0])))
    : filters;

  function buildUrl(filts?: unknown[][]): string {
    const args: Record<string, string> = { doctype };
    if (filts && filts.length > 0) args.filters = JSON.stringify(filts);
    return buildApiUrl("/api/method/frappe.client.get_count", new URLSearchParams(args));
  }

  let url = buildUrl(attemptFilters);
  const key = cacheKey(url);
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data as number;

  for (;;) {
    const res = await fetchWithTimeout(url, { headers: getHeaders(), credentials: "same-origin" }, READ_TIMEOUT_MS);
    if (!res.ok) {
      // Self-heal: drop a filter naming a field this doctype doesn't permit
      // in queries (417 DataError), mirroring fetchList's field self-heal —
      // get_count validates filter fields the same way list queries do.
      if (attemptFilters && attemptFilters.length > 0) {
        const errBody = await res.clone().json().catch(() => null);
        const badField = extractRejectedField(errBody);
        if (badField && attemptFilters.some((f) => Array.isArray(f) && f[0] === badField)) {
          rememberRejectedField(doctype, badField);
          attemptFilters = attemptFilters.filter((f) => !(Array.isArray(f) && f[0] === badField));
          url = buildUrl(attemptFilters);
          continue;
        }
      }
      // Doctype not installed on this instance — cache that and degrade to
      // a zero count instead of a recurring, unrecoverable error.
      if (res.status === 404) {
        const errBody = await res.clone().json().catch(() => null);
        const missingDoctype = extractMissingDoctype(errBody);
        if (missingDoctype) {
          markDoctypeMissing(doctype);
          responseCache.set(key, { data: 0, ts: Date.now() });
          return 0;
        }
      }
      handleAuthError(res);
      throw new ApiError(res.status, `ERPNext API error: ${res.status}`);
    }
    const json = await res.json();
    const count = typeof json.message === "number" ? json.message : 0;
    responseCache.set(key, { data: count, ts: Date.now() });
    return count;
  }
}
