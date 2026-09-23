/**
 * De agenda alvast ophalen zodra de app opent: deze week en de twee weken
 * erna, voor de collega's die in de agenda aan staan. Wie daarna de agenda
 * opent, ziet hem meteen in plaats van te wachten op de mailserver.
 */
import { voorlaadAgendas } from "./agenda-mailserver.ts";
import { maandagVan } from "./agenda-geheugen.ts";
import { resolveSessionUser } from "./session.ts";

/** Waar de agenda onthoudt welke collega-agenda's aan staan. */
export const COLLEGA_SLEUTEL = "agenda_collegas";

/** Hoeveel weken vooruit bij het openen van de app. */
const WEKEN_VOORUIT = 3;

function dagSleutel(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** De bewaarde keuze, of `null` als er nog nooit iets gekozen is. */
export function bewaardeCollegas(): string[] | null {
  try {
    const rauw = localStorage.getItem(COLLEGA_SLEUTEL);
    if (rauw === null) return null;
    const lijst = JSON.parse(rauw);
    return Array.isArray(lijst) ? lijst.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}

export async function voorlaadAgendaBijStart(vandaag: Date = new Date()): Promise<void> {
  let wie = bewaardeCollegas();
  if (wie === null) {
    // Nog nooit gekozen: de agenda begint dan met je eigen agenda.
    const ik = String((await resolveSessionUser()) || "").toLowerCase();
    wie = ik.includes("@") ? [ik] : [];
  }
  if (!wie.length) return;
  const van = maandagVan(dagSleutel(vandaag));
  const eind = new Date(`${van}T12:00:00`);
  eind.setDate(eind.getDate() + WEKEN_VOORUIT * 7 - 1);
  voorlaadAgendas(van, dagSleutel(eind), wie);
}
