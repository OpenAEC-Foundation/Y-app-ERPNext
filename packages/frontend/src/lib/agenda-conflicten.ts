/**
 * Botst een uitnodiging met wat er al in je agenda staat?
 *
 * Losse module omdat dit precies het soort rekenwerk is dat je met het oog
 * niet controleert: aansluitende afspraken (10:00–11:00 en 11:00–12:00) mogen
 * géén conflict geven, een afspraak over middernacht wél, en een hele dag
 * botst met alles op die dag. Zonder test glipt daar altijd één geval
 * doorheen — en dan zeg je iemand toe dat je komt terwijl je al bezet bent.
 *
 * Alles rekent in minuten sinds een vast punt, uitgerekend uit de datum zelf.
 * Geen `Date`: die haalt zomertijd en tijdzones erbij, en een uitnodiging is
 * juist bedoeld als wandkloktijd.
 */

export interface Tijdvak {
  /** `2026-09-10T16:00:00`, `2026-09-10 16:00:00` of `2026-09-10`. */
  start: string;
  /** Leeg betekent: één moment, geen duur. */
  eind?: string;
  /** Een hele dag beslaat de dag van `start` tot en met die van `eind`. */
  heleDag?: boolean;
}

export interface Bezetting extends Tijdvak {
  id: string;
  titel: string;
  /**
   * Deze afspraak houdt je niet bezig — je hebt hem afgezegd, of hij staat op
   * "vrij". Hij blijft in beeld maar telt niet mee als conflict.
   */
  vrij?: boolean;
}

/** Minuten sinds 1 januari 2000; alleen bedoeld om mee te vergelijken. */
export function naarMinuten(datumTijd: string): number {
  const tekst = String(datumTijd || "").trim();
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(tekst);
  if (!d) return Number.NaN;
  const dagen = dagNummer(+d[1], +d[2], +d[3]);
  const t = /[T ](\d{2}):(\d{2})/.exec(tekst);
  return dagen * 1440 + (t ? +t[1] * 60 + +t[2] : 0);
}

/** Doorlopende dagteller, zodat maand- en jaargrenzen vanzelf goed gaan. */
function dagNummer(jaar: number, maand: number, dag: number): number {
  // Rekentruc uit de burgerlijke kalender: maart als eerste maand nemen maakt
  // de schrikkeldag de laatste dag van het jaar, en dan klopt de formule
  // zonder losse uitzondering voor februari.
  const j = jaar - (maand <= 2 ? 1 : 0);
  const m = maand + (maand <= 2 ? 12 : 0);
  return Math.floor(365.25 * j) - Math.floor(j / 100) + Math.floor(j / 400)
    + Math.floor(30.6001 * (m + 1)) + dag;
}

/** Het tijdvak als [begin, eind) in minuten. Ongeldige invoer geeft `null`. */
export function alsBereik(v: Tijdvak): { van: number; tot: number } | null {
  const van = naarMinuten(v.start);
  if (Number.isNaN(van)) return null;
  if (v.heleDag) {
    // Een hele dag loopt tot het einde van de laatste dag. Zonder eind is dat
    // de dag van de start zelf.
    const laatste = v.eind ? naarMinuten(v.eind) : van;
    const eindeDag = (Number.isNaN(laatste) ? van : laatste);
    return { van: Math.floor(van / 1440) * 1440, tot: Math.floor(eindeDag / 1440) * 1440 + 1440 };
  }
  const tot = v.eind ? naarMinuten(v.eind) : van;
  return { van, tot: Number.isNaN(tot) ? van : Math.max(tot, van) };
}

/**
 * Overlappen twee tijdvakken?
 *
 * Aansluiten is geen overlap: een afspraak die om 11:00 eindigt botst niet met
 * een die om 11:00 begint. Een tijdvak zonder duur (één moment) botst alleen
 * als het écht binnen het andere valt.
 */
export function overlapt(a: Tijdvak, b: Tijdvak): boolean {
  const x = alsBereik(a);
  const y = alsBereik(b);
  if (!x || !y) return false;
  if (x.van === x.tot) return x.van > y.van && x.van < y.tot;
  if (y.van === y.tot) return y.van > x.van && y.van < x.tot;
  return x.van < y.tot && y.van < x.tot;
}

/**
 * Wat er in de agenda botst met dit voorstel, op volgorde van begintijd.
 *
 * Afspraken die je hebt afgezegd of die op "vrij" staan blijven eruit: die
 * houden je niet bezig, en ze als conflict tonen maakt de melding
 * ongeloofwaardig.
 */
export function zoekConflicten(voorstel: Tijdvak, agenda: Bezetting[]): Bezetting[] {
  return agenda
    .filter((b) => !b.vrij && overlapt(voorstel, b))
    .sort((a, b) => naarMinuten(a.start) - naarMinuten(b.start));
}
