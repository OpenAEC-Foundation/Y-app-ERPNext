/**
 * ERPNext session bootstrap for the single-tenant (same-origin) setup.
 *
 * There is no separate Y-app session anymore — the app runs directly on top
 * of one ERPNext v16 site and rides its existing session cookie. Login state
 * is therefore whatever Frappe itself reports via its stock REST/RPC API.
 */

export interface ERPNextSession {
  user: string;
  fullName: string;
  roles: string[];
}

/** Thrown by loadSession() when there is no usable ERPNext session. */
export class SessionUnavailableError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "SessionUnavailableError";
    this.status = status;
  }
}

interface GetLoggedUserResponse {
  message?: string;
}

interface UserRoleRow {
  role: string;
}

interface UserDocResponse {
  data?: {
    full_name?: string;
    roles?: UserRoleRow[];
  };
}

/**
 * De user van de laatst geladen sessie. De app-shell laadt de sessie één keer
 * bij bootstrap; losse modules (zoals `module-access.ts`) die daarna alleen
 * de gebruikersnaam nodig hebben, lenen 'm hier in plaats van nóg een
 * `get_logged_user`-request te doen.
 */
let cachedUser: string | null = null;

/** De ingelogde ERPNext-user, of null zolang de sessie niet geladen is. */
export function getSessionUser(): string | null {
  return cachedUser;
}

/**
 * De ingelogde ERPNext-user, desnoods door hem alsnog op te halen. Levert
 * `null` bij een gast/ontbrekende sessie in plaats van te gooien — bedoeld
 * voor best-effort-consumenten die zonder user gewoon minder kunnen.
 */
export async function resolveSessionUser(): Promise<string | null> {
  if (cachedUser) return cachedUser;
  try {
    const res = await fetch("/api/method/frappe.auth.get_logged_user", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as GetLoggedUserResponse | null;
    const user = body?.message;
    if (!user || user === "Guest") return null;
    cachedUser = user;
    return user;
  } catch {
    return null;
  }
}

/** Vergeet de onthouden user (uitloggen, en het opruimpad in tests). */
export function resetSessionUserCache(): void {
  cachedUser = null;
}

/**
 * Loads the current ERPNext session.
 *
 * 1. `GET /api/method/frappe.auth.get_logged_user` — on a website page a
 *    logged-out visitor gets HTTP 200 with `message: "Guest"` rather than a
 *    4xx, so that value is treated the same as an outright 401/403.
 * 2. `GET /api/resource/User/<user>` for `full_name` and the `roles` child
 *    table. If this second call fails, the session itself is still valid —
 *    degrade gracefully instead of failing the whole load.
 */
export async function loadSession(): Promise<ERPNextSession> {
  const res = await fetch("/api/method/frappe.auth.get_logged_user", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  if (res.status === 401 || res.status === 403) {
    throw new SessionUnavailableError("ERPNext session unavailable", 401);
  }
  if (!res.ok) {
    throw new SessionUnavailableError("Failed to load ERPNext session", res.status);
  }

  const body = (await res.json().catch(() => null)) as GetLoggedUserResponse | null;
  const user = body?.message;

  if (!user || user === "Guest") {
    throw new SessionUnavailableError("ERPNext session unavailable", 401);
  }
  cachedUser = user;

  let fullName = user;
  let roles: string[] = [];

  try {
    const userRes = await fetch(`/api/resource/User/${encodeURIComponent(user)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (userRes.ok) {
      const userBody = (await userRes.json().catch(() => null)) as UserDocResponse | null;
      fullName = userBody?.data?.full_name || user;
      roles = (userBody?.data?.roles ?? []).map((row) => row.role).filter(Boolean);
    }
  } catch {
    // Network error on the secondary call — the session itself is still
    // valid, so degrade to the bare username instead of failing the login.
  }

  return { user, fullName, roles };
}

/** Frappe's standard login page, redirecting back to `returnTo` after auth. */
export function loginUrl(returnTo: string = "/y-next"): string {
  return `/login?redirect-to=${encodeURIComponent(returnTo)}`;
}
