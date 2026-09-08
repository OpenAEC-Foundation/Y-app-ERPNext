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
  eersteUur: 7,
  aantalUren: 14,
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

/**
 * Is deze afspraak te verslepen?
 *
 * Alleen een ERPNext-afspraak. Twee redenen om de rest te weren:
 *
 * - Een taak, verlofaanvraag of urenstaat staat wél in de agenda maar is daar
 *   een afgeleide van. Die verplaats je in zijn eigen scherm; hier zou het
 *   betekenen dat slepen een taakdeadline verzet zonder dat je dat vraagt.
 * - Een afspraak uit de mailserver wordt als compleet `.ics` opgeslagen. Wij
 *   kennen maar een handvol velden van dat bestand; opnieuw wegschrijven zou
 *   de rest wissen. Zolang de schrijfkant naar de mailserver niet af is,
 *   blijft die dus staan waar hij staat.
 */
export function sleepbaar(afspraak: { type: string }): boolean {
  return afspraak.type === "event";
}
