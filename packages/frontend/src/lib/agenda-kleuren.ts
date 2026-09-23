/**
 * Een kleur per agenda op de mailserver.
 *
 * Eerst kreeg elke medewerker een kleur op zijn plek in de medewerkerslijst.
 * Twee dingen gingen daarmee mis: bij veertien mensen en twaalf kleuren
 * kregen twee mensen precies dezelfde kleur, en de reeks bevatte tinten die
 * naast elkaar niet uit elkaar te houden waren (Maarten #be123c, Nino #db2777:
 * allebei roze). Wie je naast elkaar ziet, hangt af van wat je aanvinkt — niet
 * van waar iemand in de lijst staat.
 *
 * Daarom nu:
 * - **Je eigen agenda** heeft altijd dezelfde kleur, de blauwe van de mailbox.
 * - **Aangevinkte collega's** krijgen op volgorde van aanvinken de kleuren uit
 *   `COLLEGA_KLEUREN`. Die reeks begint met de tinten die het verst uit elkaar
 *   liggen, zodat een handvol agenda's naast elkaar altijd goed te scheiden is.
 *
 * Wat in de agenda al een betekenis heeft, zit niet in de reeks: blauw
 * (afspraken en je eigen agenda), oranje-geel (taken), rood (verlof) en groen
 * (urenstaten).
 */

/** Gelijk aan de bronkleur van de mailbox in de agenda. */
export const EIGEN_AGENDA_KLEUR = "#0ea5e9";

export const COLLEGA_KLEUREN: readonly string[] = [
  "#0d9488", // teal
  "#db2777", // roze
  "#65a30d", // limoen
  "#4f46e5", // indigo
  "#a16207", // oker
  "#9333ea", // paars
  "#c2410c", // gebrand oranje
  "#475569", // leisteen
  "#86198f", // magenta
  "#155e75", // donker cyaan
  "#3f6212", // olijf
  "#78350f", // bruin
];

/**
 * Kleur per agenda-adres (kleine letters), voor de agenda's die aan staan.
 *
 * @param gekozen de aangevinkte adressen, in de volgorde van aanvinken
 * @param ikZelf  het eigen adres; leeg zolang dat nog niet bekend is
 */
export function kleurenVoorAgendas(gekozen: readonly string[], ikZelf: string): Map<string, string> {
  const eigen = (ikZelf || "").trim().toLowerCase();
  const uit = new Map<string, string>();
  let volgende = 0;
  for (const ruw of gekozen) {
    const adres = (ruw || "").trim().toLowerCase();
    if (!adres || uit.has(adres)) continue;
    if (eigen && adres === eigen) {
      uit.set(adres, EIGEN_AGENDA_KLEUR);
      continue;
    }
    uit.set(adres, COLLEGA_KLEUREN[volgende % COLLEGA_KLEUREN.length]);
    volgende += 1;
  }
  return uit;
}
