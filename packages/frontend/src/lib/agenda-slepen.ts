/**
 * De rekenkant van het slepen in de agenda: een afspraak verplaatsen of
 * langer/korter maken.
 *
 * Losse module omdat dit precies het stukje is dat stilletjes fout gaat en
 * niet aan het scherm af te lezen valt — een afspraak die een half uur
 * verschuift, een eindtijd die vóór de starttijd belandt, een blok dat buiten
 * de zichtbare dag valt. Hier is het te testen zonder muis.
 *
 * Alles rekent in minuten na middernacht. De aanroeper vertaalt dat naar een
 * datum en tijd, want alleen hij weet om welke dag het gaat.
 */

/** Wat er tijdens het slepen bekend is. */
export interface SleepInvoer {
  /** Oorspronkelijke start en einde, in minuten na middernacht. */
  startMin: number;
  eindMin: number;
  /** Verschuiving van de muis in minuten, nog niet afgerond. */
  verschuivingMin: number;
  /** Hoeveel dagkolommen de muis is opgeschoven; 0 bij verlengen. */
  dagVerschuiving: number;
  soort: "verplaatsen" | "verlengen";
}

export interface SleepGrenzen {
  /** Eerste zichtbare uur in het raster (bv. 7). */
  eersteUur: number;
  /** Aantal zichtbare uren (bv. 14). */
  aantalUren: number;
  /** Op hoeveel minuten afgerond wordt. */
  stap: number;
  /** Kortste afspraak die overblijft bij verkorten. */
  minimumDuur: number;
}

export interface SleepUitkomst {
  startMin: number;
  eindMin: number;
  dagVerschuiving: number;
}

export const STANDAARD_GRENZEN: SleepGrenzen = {
  // De hele dag, gelijk aan wat de agenda toont. Stond eerder op 07:00-21:00;
  // een afspraak om half zeven 's ochtends viel daarmee buiten de grenzen.
  eersteUur: 0,
  aantalUren: 24,
  stap: 15,
  minimumDuur: 15,
};

function rond(waarde: number, stap: number): number {
  return Math.round(waarde / stap) * stap;
}

function klem(waarde: number, laag: number, hoog: number): number {
  return Math.min(Math.max(waarde, laag), hoog);
}

/**
 * De nieuwe tijden na een sleepbeweging.
 *
 * Bij **verplaatsen** blijft de duur gelijk: schuift het blok tegen de rand
 * van de zichtbare dag, dan stopt het daar in plaats van korter te worden.
 * Anders zou een afspraak die je te ver omhoog trekt stilletjes inkorten.
 *
 * Bij **verlengen** beweegt alleen het einde, en nooit voorbij de start: een
 * afspraak die op zijn kop staat bestaat niet, dus onder de minimumduur stopt
 * het.
 */
export function berekenSleep(
  invoer: SleepInvoer,
  grenzen: SleepGrenzen = STANDAARD_GRENZEN,
): SleepUitkomst {
  const { eersteUur, aantalUren, stap, minimumDuur } = grenzen;
  const dagBegin = eersteUur * 60;
  const dagEind = (eersteUur + aantalUren) * 60;
  const duur = Math.max(invoer.eindMin - invoer.startMin, minimumDuur);
  const schuif = rond(invoer.verschuivingMin, stap);

  if (invoer.soort === "verlengen") {
    const ruwEind = invoer.eindMin + schuif;
    const eindMin = klem(rond(ruwEind, stap), invoer.startMin + minimumDuur, dagEind);
    return { startMin: invoer.startMin, eindMin, dagVerschuiving: 0 };
  }

  // Verplaatsen: eerst de start, daarna het einde meenemen. De klem op de
  // start houdt rekening met de duur, zodat het blok heel blijft.
  const startMin = klem(invoer.startMin + schuif, dagBegin, Math.max(dagBegin, dagEind - duur));
  return { startMin, eindMin: startMin + duur, dagVerschuiving: invoer.dagVerschuiving };
}

/** `465` → `"07:45"`. */
export function minutenNaarTijd(minuten: number): string {
  const heel = Math.max(0, Math.round(minuten));
  const u = Math.floor(heel / 60) % 24;
  const m = heel % 60;
  return `${String(u).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** De minuten na middernacht uit een datum-tijdtekst (`2026-09-08 08:30:00`). */
export function tijdNaarMinuten(datumTijd?: string): number {
  const treffer = /[T ](\d{2}):(\d{2})/.exec(String(datumTijd ?? ""));
  if (!treffer) return 0;
  return Number(treffer[1]) * 60 + Number(treffer[2]);
}

/** `2026-09-08` plus 2 dagen → `2026-09-10`. */
export function verschuifDatum(datum: string, dagen: number): string {
  const [j, m, d] = String(datum).split("-").map(Number);
  if (!j || !m || !d) return datum;
  // Middag, niet middernacht: dan tikt een zomertijdsprong de datum niet terug.
  const dt = new Date(j, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + dagen);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** `90` -> `"PT1H30M"`. De tegenhanger van `duurInMinuten` in agenda-mailserver. */
export function duurUitMinuten(minuten: number): string {
  const heel = Math.max(1, Math.round(minuten));
  const uren = Math.floor(heel / 60);
  const rest = heel % 60;
  return `PT${uren ? `${uren}H` : ""}${rest || !uren ? `${rest}M` : ""}`;
}

/**
 * Is deze afspraak te verslepen?
 *
 * Ja voor een afspraak uit ERPNext en voor een afspraak uit de mailserver.
 * Die laatste gaat als patch over JMAP: alleen de begintijd en de duur gaan
 * mee, al het andere in de afspraak blijft onaangeroerd staan. Daarom kan het
 * ook bij een afspraak die met een ander agendaprogramma is gemaakt.
 *
 * Vier soorten blijven staan waar ze staan:
 *
 * - Een taak, verlofaanvraag of urenstaat staat wél in de agenda maar is daar
 *   een afgeleide van. Die verplaats je in zijn eigen scherm; hier zou het
 *   betekenen dat slepen een taakdeadline verzet zonder dat je dat vraagt.
 * - Een herhalende afspraak is één document met een herhaalregel erin. Wie er
 *   één blok van versleept, verzet de hele reeks - meestal niet wat je
 *   bedoelt en niet terug te draaien.
 * - De agenda van een collega is om te kijken. Je ziet daar de kopie die in
 *   zijn agenda staat; die verzet hij zelf. Verplaatst de organisator een
 *   gezamenlijke afspraak, dan schuift die kopie vanzelf mee.
 * - Een uitnodiging waarop je nog niet hebt geantwoord is nog niet van jou. Hij
 *   staat er om te laten zien dat de tijd bezet is; verzetten is aan de
 *   organisator, en de uitnodiging die nog in de post staat bestaat als
 *   afspraak nog helemaal nergens.
 */
export function sleepbaar(
  afspraak: { type: string; herhaalt?: boolean; vanAnder?: boolean; onbeantwoord?: boolean },
): boolean {
  if (afspraak.herhaalt || afspraak.vanAnder || afspraak.onbeantwoord) return false;
  return afspraak.type === "event" || afspraak.type === "mailbox";
}
