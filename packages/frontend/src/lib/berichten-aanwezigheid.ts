import { callMethod } from "./erpnext.ts";

/**
 * Foto en online-status van collega's in Berichten.
 *
 * De gegevens komen uit het Server Script `berichten_collegas`: naam, of er
 * een foto is, en `User.last_active`. De foto zelf levert `berichten_foto`,
 * omdat de bestanden afgeschermd staan en een collega het record van een ander
 * niet mag lezen.
 *
 * De rekenkant hieronder is puur. Tijden komen van de server als
 * `2026-09-15 10:40:02.123456`, zonder tijdzone; ze worden daarom als kale
 * getallen vergeleken met de servertijd die het script meestuurt. Dan maakt
 * de klok of de tijdzone van de telefoon niet uit.
 */

/** Zo lang na de laatste activiteit geldt iemand nog als online. */
export const ONLINE_MINUTEN = 5;

export interface CollegaStatus {
  user: string;
  naam: string;
  foto: boolean;
  laatstActief: string | null;
}

export interface CollegaStatusLijst {
  collegas: Map<string, CollegaStatus>;
  /** De servertijd op het moment van ophalen. */
  serverNu: string | null;
}

interface Tijdstip {
  datum: string;
  tijd: string;
  /** Milliseconden als kaal getal, alleen om te vergelijken. */
  ms: number;
  dag: number;
}

function leesTijd(waarde: string | Date | null | undefined): Tijdstip | null {
  if (waarde instanceof Date) {
    if (Number.isNaN(waarde.getTime())) return null;
    const twee = (n: number) => String(n).padStart(2, "0");
    waarde = `${waarde.getFullYear()}-${twee(waarde.getMonth() + 1)}-${twee(waarde.getDate())} `
      + `${twee(waarde.getHours())}:${twee(waarde.getMinutes())}:${twee(waarde.getSeconds())}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(waarde ?? "").trim());
  if (!m) return null;
  const [j, mnd, d, u, min, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number);
  return {
    datum: `${m[1]}-${m[2]}-${m[3]}`,
    tijd: `${m[4]}:${m[5]}`,
    ms: Date.UTC(j, mnd - 1, d, u, min, s),
    dag: Date.UTC(j, mnd - 1, d) / 86_400_000,
  };
}

/**
 * Was deze collega de afgelopen vijf minuten actief?
 *
 * Een laatst-actief dat een minuut of twee ná "nu" ligt, telt ook als online:
 * de servertijd komt uit een ander verzoek dan het moment waarop iemand iets
 * deed, en die kleine scheefstand is geen reden om iemand offline te tonen.
 */
export function isOnline(laatstActief: string | null, nu: string | Date): boolean {
  const laatst = leesTijd(laatstActief);
  const moment = leesTijd(nu);
  if (!laatst || !moment) return false;
  const verschil = moment.ms - laatst.ms;
  return verschil <= ONLINE_MINUTEN * 60_000 && verschil >= -2 * 60_000;
}

export type Aanwezigheid =
  | { soort: "online" }
  | { soort: "vandaag"; tijd: string }
  | { soort: "gisteren"; tijd: string }
  | { soort: "eerder"; datum: string }
  | { soort: "onbekend" };

/** Wat er onder de naam hoort te staan. De tekst zelf maakt de UI. */
export function aanwezigheid(laatstActief: string | null, nu: string | Date): Aanwezigheid {
  const laatst = leesTijd(laatstActief);
  const moment = leesTijd(nu);
  if (!laatst || !moment) return { soort: "onbekend" };
  if (isOnline(laatstActief, nu)) return { soort: "online" };
  const dagen = moment.dag - laatst.dag;
  if (dagen <= 0) return { soort: "vandaag", tijd: laatst.tijd };
  if (dagen === 1) return { soort: "gisteren", tijd: laatst.tijd };
  return { soort: "eerder", datum: laatst.datum };
}

/** Het adres van de foto van een collega. */
export function fotoUrl(user: string): string {
  return `/api/method/berichten_foto?gebruiker=${encodeURIComponent(user)}`;
}

/** Het antwoord van `berichten_collegas`, gecontroleerd. */
export function leesCollegaStatus(ruw: unknown): CollegaStatusLijst {
  const bron = (ruw ?? {}) as { collegas?: unknown; nu?: unknown };
  const collegas = new Map<string, CollegaStatus>();
  for (const rij of Array.isArray(bron.collegas) ? bron.collegas : []) {
    const r = (rij ?? {}) as Record<string, unknown>;
    const user = typeof r.user === "string" ? r.user.trim() : "";
    if (!user) continue;
    collegas.set(user, {
      user,
      naam: typeof r.naam === "string" && r.naam.trim() ? r.naam.trim() : user,
      foto: Boolean(r.foto),
      laatstActief: typeof r.laatst_actief === "string" && r.laatst_actief ? r.laatst_actief : null,
    });
  }
  return { collegas, serverNu: typeof bron.nu === "string" && bron.nu ? bron.nu : null };
}

/**
 * Foto en status van alle collega's. Lukt het niet, dan een lege lijst: de
 * gesprekken zelf werken gewoon door, alleen dan met initialen en zonder bolletje.
 */
export async function haalCollegaStatus(): Promise<CollegaStatusLijst> {
  try {
    return leesCollegaStatus(await callMethod("berichten_collegas", {}));
  } catch {
    return { collegas: new Map(), serverNu: null };
  }
}
