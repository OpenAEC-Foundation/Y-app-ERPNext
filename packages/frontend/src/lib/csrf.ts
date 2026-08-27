/**
 * CSRF token for same-origin ERPNext mutations.
 *
 * Frappe injects the token into logged-in website pages via the
 * `<!-- csrf_token -->` template marker, which sets `window.frappe.csrf_token`
 * (older templates set the bare `window.csrf_token`). Every non-GET call to
 * the ERPNext REST/RPC API must echo this back as `X-Frappe-CSRF-Token`.
 *
 * Twee scherpe randen, allebei live waargenomen op `/y-next`:
 *
 * 1. **Frappe rendert Python's `None` als tekst.** Een uitgelogde bezoeker
 *    krijgt letterlijk `frappe.csrf_token = "None"` mee. Dat is een truthy
 *    string, dus een naïeve lezing stuurt hem vrolijk mee als header — waarop
 *    Frappe élke mutatie afwijst met `Invalid Request` (CSRFTokenError).
 *    `normalizeCsrfToken` filtert die placeholders eruit.
 *
 * 2. **De pagina-HTML is browser-cachebaar** (`Cache-Control: private,
 *    max-age=300, stale-while-revalidate=10800`). Wie /y-next uitgelogd opent
 *    en daarna via /login terugkeert, krijgt de HTML uit de HTTP-cache — mét
 *    het gast-token van vóór de login. Lezen werkt dan gewoon (GET kent geen
 *    CSRF-check) maar élke schrijfactie faalt. `refreshCsrfToken` haalt de
 *    pagina daarom opnieuw op met `cache: "reload"` en trekt er een vers
 *    token uit.
 */

declare global {
  interface Window {
    frappe?: { csrf_token?: string };
    csrf_token?: string;
  }
}

let cachedToken: string | null = null;
let inflightRefresh: Promise<string | null> | null = null;

/**
 * Waarden die Frappe rendert als er géén echt token is. `"None"` is Python's
 * `None` door de template heen; de rest is defensief.
 */
const PLACEHOLDER_TOKENS = new Set(["none", "null", "undefined"]);

/** Geeft een bruikbaar token terug, of null bij leeg/placeholder/niet-string. */
export function normalizeCsrfToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || PLACEHOLDER_TOKENS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/** Trekt `csrf_token = "…"` uit een stuk pagina-HTML. */
export function extractCsrfTokenFromHtml(html: string): string | null {
  const match = html.match(/csrf_token\s*=\s*(["'])([\s\S]*?)\1/);
  return match ? normalizeCsrfToken(match[2]) : null;
}

/**
 * Returns the current CSRF token, or null when none is available (e.g. in
 * tests/dev tooling that runs outside a Frappe website context, or when the
 * page only carries the guest placeholder). The result is cached after the
 * first successful (non-placeholder) read.
 */
export function getCsrfToken(): string | null {
  if (cachedToken !== null) return cachedToken;
  if (typeof window === "undefined") return null;

  const token = normalizeCsrfToken(window.frappe?.csrf_token ?? window.csrf_token);
  if (token) cachedToken = token;
  return token;
}

/**
 * Haalt de eigen pagina-HTML opnieuw op (langs de HTTP-cache heen) en cachet
 * het token dat daarin staat. Concurrent aanroepen delen één fetch.
 *
 * De app draait op een HashRouter, dus `location.pathname` is altijd de
 * Web-Page-route zelf (`/y-next`) en nooit een client-side subroute — precies
 * de URL waar Frappe de `<!-- csrf_token -->`-marker invult.
 */
export function refreshCsrfToken(): Promise<string | null> {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    if (typeof window === "undefined") return null;
    try {
      const res = await fetch(window.location.pathname, {
        credentials: "same-origin",
        cache: "reload",
        headers: { Accept: "text/html" },
      });
      if (!res.ok) return null;
      const token = extractCsrfTokenFromHtml(await res.text());
      if (token) {
        cachedToken = token;
        if (window.frappe) window.frappe.csrf_token = token;
        else window.csrf_token = token;
      }
      return token;
    } catch {
      // Netwerkfout — de aanroeper valt terug op het bestaande gedrag.
      return null;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

/**
 * Zorgt dat er een token is vóór de eerste mutatie. Doet niets als de pagina
 * al een bruikbaar token draagt, en is dus veilig om bij bootstrap
 * fire-and-forget aan te roepen.
 */
export async function ensureCsrfToken(): Promise<string | null> {
  return getCsrfToken() ?? (await refreshCsrfToken());
}

/** Test-only: clears the cache so the next getCsrfToken() call re-reads window. */
export function resetCsrfTokenCache(): void {
  cachedToken = null;
  inflightRefresh = null;
}
