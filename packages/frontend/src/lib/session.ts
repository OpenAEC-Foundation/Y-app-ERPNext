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

/** Eén rij uit de User Email-tabel van het eigen User-document. */
interface UserEmailRow {
  /** Docnaam van het Email Account — de waarde in `Communication.email_account`. */
  email_account?: string;
  email_id?: string;
}

/** Antwoord van het Server Script `mijn_postbussen`. */
interface PostbusScriptResponse {
  message?: {
    postbussen?: { name?: string; email_id?: string }[];
    alles?: boolean;
  };
}

interface UserDocResponse {
  data?: {
    full_name?: string;
    roles?: UserRoleRow[];
    user_emails?: UserEmailRow[];
  };
}

/**
 * De user van de laatst geladen sessie. De app-shell laadt de sessie één keer
 * bij bootstrap; losse modules (zoals `module-access.ts`) die daarna alleen
 * de gebruikersnaam nodig hebben, lenen 'm hier in plaats van nóg een
 * `get_logged_user`-request te doen.
 */
let cachedUser: string | null = null;

/**
 * Welke postbussen deze gebruiker mag lezen.
 *
 * ERPNext beperkt het lezen van `Communication` tot de Email Accounts in de
 * User Email-tabel van de gebruiker; alleen een System Manager komt daar
 * onderuit. Dat is dus niet hetzelfde als de accounts die hij mag zíen — en
 * juist dat verschil liet de mailmodule tabs tonen die altijd leeg bleven.
 *
 * Komt uit hetzelfde User-document dat bij het inloggen al wordt gelezen, dus
 * het kost geen extra verzoek zolang de sessie geladen is.
 */
export interface Postbustoegang {
  /**
   * De rijen uit zijn User Email-tabel: docnaam van het Email Account plus
   * het adres. Het adres hoort erbij omdat `Email Account` alleen te lezen is
   * met de rol Inbox User of System Manager — zonder dat adres zou de kiezer
   * voor een gewone medewerker leeg blijven.
   */
  accounts: { name: string; emailId: string }[];
  /** System Manager: dan geldt de beperking niet. */
  alles: boolean;
}

let cachedToegang: Postbustoegang | null = null;

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
  cachedToegang = null;
}

/**
 * De postbustoegang van de ingelogde gebruiker, desnoods door zijn
 * User-document alsnog op te halen.
 *
 * Geeft `null` als dat niet lukt. De aanroeper hoort daar terug te vallen op
 * zijn oude gedrag: niet weten wat iemand mag lezen is geen reden om hem zijn
 * postbussen af te nemen.
 */
export async function resolvePostbustoegang(): Promise<Postbustoegang | null> {
  if (cachedToegang) return cachedToegang;
  const user = await resolveSessionUser();
  if (!user) return null;

  /*
   * Eerst het Server Script. Reden: `user_emails` staat op permissieniveau 1
   * van het User-document, en dat niveau mag alleen een System Manager lezen.
   * Een gewone medewerker krijgt zijn eigen gebruiker dus terug zónder die
   * tabel — geen fout, gewoon een veld dat ontbreekt — en de postbuskiezer
   * bleef daardoor leeg, ook voor zijn eigen bus. Het script geeft alleen de
   * eigen rijen terug en gaat om dat niveau heen.
   */
  try {
    const res = await fetch("/api/method/mijn_postbussen", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as PostbusScriptResponse | null;
      const rijen = body?.message?.postbussen;
      if (Array.isArray(rijen)) {
        cachedToegang = {
          accounts: rijen
            .map((r) => ({
              name: String(r?.name || "").trim(),
              emailId: String(r?.email_id || "").trim(),
            }))
            .filter((r) => r.name && r.emailId),
          alles: !!body?.message?.alles,
        };
        return cachedToegang;
      }
    }
  } catch {
    // Geen script op deze installatie (of uitgeschakeld) — dan de gewone weg.
  }

  try {
    const res = await fetch(`/api/resource/User/${encodeURIComponent(user)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as UserDocResponse | null;
    if (!body?.data) return null;
    const toegang = leesToegang(body.data);
    // Een lege tabel is hier verdacht: vrijwel iedereen heeft minstens zijn
    // eigen bus. Waarschijnlijk is het veld weggelaten omdat het niveau niet
    // gelezen mag worden. Dan is "onbekend" eerlijker dan "geen enkele" — de
    // aanroeper valt daarop terug op de gedeelde lijst.
    if (toegang.accounts.length === 0 && !toegang.alles) return null;
    cachedToegang = toegang;
    return cachedToegang;
  } catch {
    return null;
  }
}

function leesToegang(data: NonNullable<UserDocResponse["data"]>): Postbustoegang {
  const rollen = (data.roles ?? []).map((r) => r.role).filter(Boolean);
  return {
    accounts: (data.user_emails ?? [])
      .map((r) => ({
        name: String(r.email_account || "").trim(),
        emailId: String(r.email_id || "").trim(),
      }))
      .filter((r) => r.name && r.emailId),
    alles: rollen.includes("System Manager") || rollen.includes("Administrator"),
  };
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
      // Meteen meenemen: hetzelfde document draagt de User Email-tabel, en de
      // mailmodule heeft die nodig om geen lege postbus te tonen.
      //
      // Alleen als er ook echt iets in staat. Bij een gewone medewerker
      // ontbreekt die tabel — permissieniveau 1 — en een lege lijst in de
      // cache zou `resolvePostbustoegang` ervan weerhouden het Server Script
      // te vragen, dat er wél bij kan.
      const gelezen = userBody?.data ? leesToegang(userBody.data) : null;
      if (gelezen && gelezen.accounts.length > 0) cachedToegang = gelezen;
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
