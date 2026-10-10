/**
 * Het weekdashboard: een aparte webpagina op dezelfde site die Y-next insluit.
 *
 * Welke pagina dat is verschilt per organisatie, dus het pad staat in de
 * instelling `weekplanning-pad` (`Y Next Setting`) en niet in de code. Zonder
 * die instelling is er geen weekplanning en verdwijnt het onderdeel uit het
 * menu.
 */
import { leesInstelling } from "./instelling.ts";

export const WEEKPLANNING_INSTELLING = "weekplanning-pad";

const BACKSLASH = String.fromCharCode(92);

/**
 * Een pad op deze site, of `null` als de waarde daar niet op lijkt.
 *
 * Alleen een pad dat met één schuine streep begint. Een volledig adres of
 * "//server/…" zou een pagina van elders insluiten, met de sessie van de
 * gebruiker eromheen; dat mag een instelling niet kunnen.
 */
export function geldigDashboardPad(waarde: string | null | undefined): string | null {
  const pad = (waarde ?? "").trim();
  if (!pad.startsWith("/") || pad.startsWith("//") || pad.includes(BACKSLASH)) return null;
  return pad;
}

/** Het ingestelde pad van het weekdashboard, of `null` als er geen is. */
export async function haalDashboardPad(): Promise<string | null> {
  try {
    return geldigDashboardPad(await leesInstelling(WEEKPLANNING_INSTELLING));
  } catch {
    return null;
  }
}
