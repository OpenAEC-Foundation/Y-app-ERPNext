/**
 * Een bijlage in de projectmap op de NAS zetten.
 *
 * De projectmappen staan op een netwerkschijf, niet in ERPNext. De browser
 * mag daar alleen bij via een map die je zelf één keer aanwijst (de File
 * System Access API); die keuze blijft bewaard, zie `lib/nasStorage`.
 *
 * Wat hier staat is het zoeken: welke map hoort bij projectnummer 2892? De
 * naamgeving is "2892 Bedrijfspand Jelier Einsteinstraat 10 Dordrecht", maar
 * ook "2892" of "2892-Jelier" komt voor, en de mappen kunnen één laag dieper
 * staan (per bedrijfsonderdeel). Het vergelijken zelf is puur, zodat het te
 * testen is zonder schijf.
 */

/** Hoort deze mapnaam bij dit projectnummer? */
export function isProjectmap(mapnaam: string, projectnummer: string): boolean {
  const nr = String(projectnummer || "").trim();
  if (!nr) return false;
  const naam = String(mapnaam || "").trim();
  // Het nummer staat vooraan, gevolgd door een scheiding of het eind van de naam.
  return new RegExp(`^0*${nr}(?=$|[\\s._\\-–])`).test(naam);
}

/** De beste map uit een lijst; de kortste naam wint bij meerdere treffers. */
export function kiesProjectmap(mapnamen: string[], projectnummer: string): string | null {
  const treffers = mapnamen.filter((naam) => isProjectmap(naam, projectnummer));
  if (treffers.length === 0) return null;
  return treffers.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

/** De submappen van een map, op naam. */
async function submappen(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const namen: string[] = [];
  const iter = (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)[Symbol.asyncIterator]();
  for (;;) {
    const volgende = await iter.next();
    if (volgende.done) break;
    const [naam, handle] = volgende.value;
    if (handle.kind === "directory") namen.push(naam);
  }
  return namen;
}

export interface GevondenMap {
  handle: FileSystemDirectoryHandle;
  /** Het pad vanaf de gekozen hoofdmap, voor in de melding. */
  pad: string[];
}

/**
 * Zoekt de map van dit project onder `root`, hoogstens `diepte` lagen diep.
 * Twee lagen is genoeg voor "50_projecten / 3_3BM_bouwtechniek / 2892 …".
 */
export async function zoekProjectmap(
  root: FileSystemDirectoryHandle,
  projectnummer: string,
  diepte = 2,
): Promise<GevondenMap | null> {
  const rij: { dir: FileSystemDirectoryHandle; pad: string[] }[] = [{ dir: root, pad: [] }];
  for (let laag = 0; laag <= diepte && rij.length > 0; laag++) {
    const volgende: typeof rij = [];
    for (const { dir, pad } of rij) {
      const namen = await submappen(dir);
      const treffer = kiesProjectmap(namen, projectnummer);
      if (treffer) {
        return { handle: await dir.getDirectoryHandle(treffer), pad: [...pad, treffer] };
      }
      if (laag < diepte) {
        for (const naam of namen) {
          volgende.push({ dir: await dir.getDirectoryHandle(naam), pad: [...pad, naam] });
        }
      }
    }
    rij.length = 0;
    rij.push(...volgende);
  }
  return null;
}
