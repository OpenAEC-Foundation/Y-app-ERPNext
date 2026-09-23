/**
 * Overlappende afspraken naast elkaar in de week- en dagweergave.
 *
 * Eerst kreeg elke afspraak op een dag dezelfde breedte: één gedeeld door het
 * aantal kolommen op het drúkste moment van die dag. Drie afspraken naast
 * elkaar om 10:00 maakten zo een afspraak om 14:00 een derde breed, terwijl
 * hij daar alleen stond.
 *
 * Nu in twee stappen, zoals een agendaprogramma het doet:
 *
 * 1. **Groepen.** Afspraken die elkaar (via elkaar) raken vormen een groep;
 *    alleen binnen een groep worden kolommen verdeeld. Wie los staat, krijgt
 *    de hele breedte.
 * 2. **Uitrekken.** Binnen een groep groeit een afspraak naar rechts, zolang
 *    de kolommen daar op zijn tijdstip leeg zijn.
 *
 * Aansluitend (de ene eindigt waar de andere begint) telt niet als overlap.
 */

export interface TijdBlok {
  /** Bovenkant in pixels (of welke maat ook, zolang `_bottom` dezelfde is). */
  _top: number;
  _bottom: number;
}

export type Ingedeeld<T> = T & {
  /** Linkerkant als deel van de dagbreedte (0–1). */
  left: number;
  /** Breedte als deel van de dagbreedte (0–1). */
  width: number;
};

function overlapt(a: TijdBlok, b: TijdBlok): boolean {
  return a._top < b._bottom && b._top < a._bottom;
}

export function deelKolommenIn<T extends TijdBlok>(items: readonly T[]): Ingedeeld<T>[] {
  // Op begintijd, en bij gelijke begintijd de langste eerst: die krijgt de
  // linkerkolom, zoals in een agendaprogramma. Kortere afspraken die daarna
  // komen, vullen de ruimte ernaast.
  const gesorteerd = [...items].sort((a, b) => a._top - b._top || b._bottom - a._bottom);
  const uit: Ingedeeld<T>[] = [];

  let groep: Ingedeeld<T>[] = [];
  let groepEind = -Infinity;

  const deelGroepIn = () => {
    if (groep.length === 0) return;
    // Eerste vrije kolom per afspraak. Binnen een kolom staan ze op volgorde
    // van begintijd en overlappen ze niet, dus de laatste eindigt het laatst.
    const kolommen: Ingedeeld<T>[][] = [];
    const kolomVan = new Map<Ingedeeld<T>, number>();
    for (const ev of groep) {
      let k = kolommen.findIndex((kol) => kol[kol.length - 1]._bottom <= ev._top);
      if (k === -1) {
        k = kolommen.length;
        kolommen.push([]);
      }
      kolommen[k].push(ev);
      kolomVan.set(ev, k);
    }
    const aantal = kolommen.length;
    for (const ev of groep) {
      const kolom = kolomVan.get(ev) ?? 0;
      let span = 1;
      for (let k = kolom + 1; k < aantal; k++) {
        if (kolommen[k].some((ander) => overlapt(ander, ev))) break;
        span += 1;
      }
      ev.left = kolom / aantal;
      ev.width = span / aantal;
    }
    groep = [];
  };

  for (const item of gesorteerd) {
    const ev = { ...item, left: 0, width: 1 } as Ingedeeld<T>;
    // Begint deze na het einde van alles in de groep, dan is de groep af.
    if (groep.length > 0 && ev._top >= groepEind) {
      deelGroepIn();
      groepEind = -Infinity;
    }
    groep.push(ev);
    uit.push(ev);
    groepEind = Math.max(groepEind, ev._bottom);
  }
  deelGroepIn();
  return uit;
}
