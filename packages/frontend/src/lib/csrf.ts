/**
 * CSRF token for same-origin ERPNext mutations.
 *
 * Frappe injects the token into logged-in website pages via the
 * `<!-- csrf_token -->` template marker, which sets `window.frappe.csrf_token`
 * (older templates set the bare `window.csrf_token`). Every non-GET call to
 * the ERPNext REST/RPC API must echo this back as `X-Frappe-CSRF-Token`.
 */

declare global {
  interface Window {
    frappe?: { csrf_token?: string };
    csrf_token?: string;
  }
}

let cachedToken: string | null = null;

/**
 * Returns the current CSRF token, or null when none is available (e.g. in
 * tests/dev tooling that runs outside a Frappe website context). The result
 * is cached after the first successful (non-empty) read — later calls skip
 * re-reading `window` once a token has been found.
 */
export function getCsrfToken(): string | null {
  if (cachedToken !== null) return cachedToken;
  if (typeof window === "undefined") return null;

  const token = window.frappe?.csrf_token ?? window.csrf_token ?? null;
  if (token) cachedToken = token;
  return token;
}

/** Test-only: clears the cache so the next getCsrfToken() call re-reads window. */
export function resetCsrfTokenCache(): void {
  cachedToken = null;
}
