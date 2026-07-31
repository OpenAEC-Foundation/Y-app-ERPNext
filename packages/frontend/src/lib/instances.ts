/**
 * Instance management for the frontend.
 *
 * With cookie-based auth, there is only a single implicit instance.
 * These functions return stub values for backward compatibility with
 * pages that still reference getActiveInstanceId() or getActiveInstance().
 */

import { type AuthReason, SESSION_LOST_REASONS, INSTANCE_FAILED_REASONS } from "./auth-reasons";

export interface InstanceTheme {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  sidebar: string;
  sidebarLight: string;
  sidebarDark: string;
}

export interface ERPInstance {
  id: string;
  name: string;
  url: string;
  color: string;
  theme?: InstanceTheme;
}

/* ─── Default theme (used when no custom theme is set) ─── */

const DEFAULT_THEME: InstanceTheme = {
  primary: "#006876",
  primaryLight: "#99c2c8",
  primaryDark: "#043b42",
  sidebar: "#043b42",
  sidebarLight: "#065a64",
  sidebarDark: "#022a2f",
};

const DEFAULT_INSTANCE: ERPInstance = {
  id: "default",
  name: "Y-App",
  url: "",
  color: "#45b6a8",
};

/* ─── Active instance state (Phase 5+) ─── */

let activeInstance: ERPInstance | null = null;

/** Set the currently active multi-instance ERPInstance. Called by App.tsx
 * when the user opens or switches an instance tab. Updates the in-memory
 * value and applies the theme. Subsequent ERPNext API calls in `erpnext.ts`
 * will route through `/api/i/<id>/...` and include the X-Y-App-Instance header. */
export function setActiveInstance(inst: ERPInstance | null): void {
  activeInstance = inst;
  if (inst) {
    applyTheme(inst);
  }
}

/* ─── Instance accessors ─── */

export function getActiveInstanceId(): string {
  return activeInstance?.id || "default";
}

export function getActiveInstance(): ERPInstance {
  return activeInstance || DEFAULT_INSTANCE;
}

export function getInstances(): ERPInstance[] {
  return [DEFAULT_INSTANCE];
}

/* ─── Per-instance preferences (Chinese walls) ───
 * Every page that filters on "default company" / "default employee" must read
 * through these helpers, NOT through a global localStorage key. Previously
 * pages read `erpnext_default_company` which is shared across all tabs — so
 * switching from 3BM to Domera left 3BM's company name as the filter for
 * Domera's data. That global key has been removed; pages must use these
 * accessors so each instance has its own isolated preference. */

export function getActiveCompany(): string {
  return localStorage.getItem(`pref_${getActiveInstanceId()}_company`) || "";
}

export function setActiveCompany(value: string): void {
  const id = getActiveInstanceId();
  if (value) localStorage.setItem(`pref_${id}_company`, value);
  else localStorage.removeItem(`pref_${id}_company`);
  // Laat luisteraars (bv. de sidebar-verlofbadge) weten dat het actieve bedrijf wijzigde.
  window.dispatchEvent(new CustomEvent("y-app:company-changed"));
}

export function getActiveEmployee(): string {
  return localStorage.getItem(`pref_${getActiveInstanceId()}_employee`) || "";
}

export function setActiveEmployee(value: string): void {
  const id = getActiveInstanceId();
  if (value) localStorage.setItem(`pref_${id}_employee`, value);
  else localStorage.removeItem(`pref_${id}_employee`);
}

export function getActiveActivityType(): string {
  const id = getActiveInstanceId();
  const emp = localStorage.getItem(`pref_${id}_employee`) || "";
  if (!emp) return "";
  return localStorage.getItem(`pref_${id}_default_activity_type_${emp}`) || "";
}

export function setActiveActivityType(value: string): void {
  const id = getActiveInstanceId();
  const emp = localStorage.getItem(`pref_${id}_employee`) || "";
  if (!emp) return;
  if (value) localStorage.setItem(`pref_${id}_default_activity_type_${emp}`, value);
  else localStorage.removeItem(`pref_${id}_default_activity_type_${emp}`);
}

export function getActiveContractHours(): number | null {
  const id = getActiveInstanceId();
  const raw = localStorage.getItem(`pref_${id}_employee_contract_hours`);
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/* ─── Theme ─── */

export function applyTheme(inst?: ERPInstance): void {
  const theme = inst?.theme || DEFAULT_THEME;
  const root = document.documentElement;
  root.style.setProperty("--color-y-teal", theme.primary);
  root.style.setProperty("--color-y-teal-light", theme.primaryLight);
  root.style.setProperty("--color-y-teal-dark", theme.primaryDark);
  root.style.setProperty("--color-y-purple", theme.sidebar);
  root.style.setProperty("--color-y-purple-light", theme.sidebarLight);
  root.style.setProperty("--color-y-purple-dark", theme.sidebarDark);
}

/* ─── Init ─── */

let fetchPatched = false;

/**
 * In-flight dedup-cache voor GET `/api/*` calls. Twee componenten of een
 * StrictMode double-mount kunnen dezelfde URL binnen milliseconden fetchen
 * — gemeten cold: 2× `/api/yapp/me`, 2× `/api/auth/me`, 2× `/api/instances/
 * <id>/mail-accounts`, 2× `/api/instances/<id>/settings/remote-extensions`.
 * Bij cache-miss op de tweede call op de server kost dat 1-2 s extra
 * ERPNext-werk. Een gedeelde Promise per (instance, url)-key laat alle
 * concurrent callers wachten op dezelfde response (gecloned per caller
 * zodat ze elk hun eigen body kunnen streamen).
 *
 * Bewust GEEN cache — zodra de fetch klaar is wordt de key na 100 ms
 * grace-window verwijderd. Dit is een race-fix, geen client-side cache.
 */
const inFlightFetches = new Map<string, Promise<Response>>();
const DEDUP_GRACE_MS = 100;

function dedupKey(input: RequestInfo | URL, init?: RequestInit): string | null {
  const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? (input as Request).method : "GET")).toUpperCase();
  if (method !== "GET") return null;
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  if (!url || !url.startsWith("/api/")) return null;
  const instanceId = activeInstance?.id || "default";
  return `${instanceId}:${url}`;
}

/**
 * Install a global fetch interceptor that adds the `X-Y-App-Instance` header
 * to every `/api/*` request whenever an active instance is set. The server's
 * authMiddleware uses this header to bridge legacy ERPNext routes to the
 * per-instance proxy without each call site having to know about it.
 * Idempotent — only patches once.
 */
export function installFetchInterceptor(): void {
  if (fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  // Inner: doet de feitelijke fetch met header-injectie. Wordt gedeeld via
  // inFlightFetches voor identieke concurrent GET-calls.
  const doFetchWithHeader = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url && url.startsWith("/api/") && activeInstance && activeInstance.id !== "default") {
      const headers = new Headers(init?.headers || (typeof input !== "string" && !(input instanceof URL) ? (input as Request).headers : undefined));
      if (!headers.has("x-y-app-instance")) {
        headers.set("X-Y-App-Instance", activeInstance.id);
      }
      return originalFetch(input, { ...(init || {}), headers });
    }
    return originalFetch(input, init);
  };

  window.fetch = async (input, init) => {
    let res: Response;
    try {
      const key = dedupKey(input, init);
      if (key) {
        const existing = inFlightFetches.get(key);
        if (existing) {
          // Concurrent call op dezelfde URL — wacht op de bestaande Promise
          // en clone de response zodat deze caller zijn eigen body kan
          // streamen. Response-body is een ReadableStream en kan maar één
          // keer geconsumeerd worden.
          res = (await existing).clone();
        } else {
          const promise = doFetchWithHeader(input, init);
          inFlightFetches.set(key, promise);
          try {
            res = (await promise).clone();
          } finally {
            // Grace-window van 100 ms: callers die binnen die tijd komen
            // raken nog de dedup. Daarna purgen om de map klein te houden
            // en stale Response-objecten niet te lekken.
            setTimeout(() => inFlightFetches.delete(key), DEDUP_GRACE_MS);
          }
        }
      } else {
        res = await doFetchWithHeader(input, init);
      }
    } catch (err) {
      throw err;
    }

    // authMiddleware now annotates 401/502 responses with a `reason` so we
    // can react differently to "you're logged out" vs "this instance is
    // momentarily unreachable". Only act on /api/* responses; clone() so
    // callers still get a fresh body.
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url && url.startsWith("/api/") && (res.status === 401 || res.status === 502)) {
      try {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = await res.clone().json().catch(() => null) as { reason?: string } | null;
          const reason = data?.reason;
          const typed = reason as AuthReason;
          if (SESSION_LOST_REASONS.has(typed)) {
            // Reuse the existing y-app:unauthorized handler in App.tsx that
            // already drops the user back to the logged-out screen. Skip if
            // we're already on /login so a bad-password 401 doesn't loop.
            if (!window.location.pathname.startsWith("/login")) {
              window.dispatchEvent(new CustomEvent("y-app:unauthorized"));
            }
          } else if (INSTANCE_FAILED_REASONS.has(typed)) {
            window.dispatchEvent(new CustomEvent("y-app:instance-unavailable"));
          }
        }
      } catch {
        // ignore — surfacing the original response is more important than the hint
      }
    }
    return res;
  };
}

/** One-shot migration: rewrite legacy `view_mode` localStorage values
 *  (Dutch: w-e-r-k-g-e-v-e-r / w-e-r-k-n-e-m-e-r) to the English equivalents
 *  (employer / employee). Idempotent — runs every startup but is a no-op
 *  once migrated. The legacy literals are built from char codes so a future
 *  bulk sed across the codebase doesn't accidentally rewrite them. */
function migrateViewMode(): void {
  try {
    const raw = localStorage.getItem("view_mode");
    const legacyEmployer = String.fromCharCode(119, 101, 114, 107, 103, 101, 118, 101, 114); // "werkgever"
    const legacyEmployee = String.fromCharCode(119, 101, 114, 107, 110, 101, 109, 101, 114); // "werknemer"
    if (raw === legacyEmployer) localStorage.setItem("view_mode", "employer");
    else if (raw === legacyEmployee) localStorage.setItem("view_mode", "employee");
  } catch { /* ignore */ }
}

/** One-shot migration: legacy "erpnext_default_*" globals that used to leak
 *  filter state across instance tabs. Now everything lives in
 *  pref_${instanceId}_* — drop the globals so they can never be read again
 *  by accident. Idempotent.
 *  NB: `erpnext_employee_contract_hours` is NOT deleted here — Employees.tsx
 *  uses that key to store a JSON map of {employee: hours}, which is a
 *  different shape than the per-instance singular value
 *  `pref_${id}_employee_contract_hours` that getActiveContractHours() reads. */
function migrateGlobalDefaults(): void {
  try {
    localStorage.removeItem("erpnext_default_company");
    localStorage.removeItem("erpnext_default_employee");
    localStorage.removeItem("erpnext_default_activity_type");
  } catch { /* ignore */ }
}

export function initInstances(): void {
  applyTheme(DEFAULT_INSTANCE);
  installFetchInterceptor();
  migrateViewMode();
  migrateGlobalDefaults();
}
