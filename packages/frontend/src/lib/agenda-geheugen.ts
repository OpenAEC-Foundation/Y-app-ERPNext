/**
 * Geheugen voor de mailserver-agenda's, per week en per persoon.
 *
 * Ophalen uit de mailserver is traag: het Server Script logt voor elke
 * gekozen collega apart in. Daarom onthoudt de app wat hij al heeft, zodat
 * terugbladeren en een volgende week die al vooruit is gehaald direct op het
 * scherm staan. Per week en per persoon, zodat een collega erbij aanvinken
 * niet alles opnieuw laat ophalen.
 *
 * Eén ophaalronde voor alle ontbrekende weken samen (één aanroep, niet één per
 * week), waarna de uitkomst over de weken wordt verdeeld. Een herhalende reeks
 * hoort bij elke week van de ronde: waar hij valt, rekent de agenda zelf uit.
 *
 * Pure logica met een klok van buiten, zodat het met `node --test` te testen is.
 */

export interface GeheugenAfspraak {
  gebruiker: string;
  id: string;
  start?: string;
  duur?: string;
  herhaalt?: boolean;
}

/** Hoelang een opgehaalde week geldig blijft. */
export const GEHEUGEN_MS = 5 * 60 * 1000;

function dagNr(datum: string): number {
  const [j, m, d] = datum.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(j, m - 1, d) / 86400000);
}

function datum(nr: number): string {
  return new Date(nr * 86400000).toISOString().slice(0, 10);
}

/** Maandag van de week waarin `dag` valt. */
export function maandagVan(dag: string): string {
  const nr = dagNr(dag);
  const wd = new Date(nr * 86400000).getUTCDay();
  return datum(nr - ((wd + 6) % 7));
}

/** De maandagen van alle weken die [van, tot] raken. */
export function wekenIn(van: string, tot: string): string[] {
  const uit: string[] = [];
  const eind = dagNr(tot);
  for (let nr = dagNr(maandagVan(van)); nr <= eind; nr += 7) uit.push(datum(nr));
  return uit;
}

/** Duur "PT1H30M" / "P1D" in minuten. */
function minuten(duur?: string): number {
  const m = String(duur || "").toUpperCase().match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  return (+(m[1] || 0) * 7 * 1440) + (+(m[2] || 0) * 1440) + (+(m[3] || 0) * 60) + (+(m[4] || 0));
}

/** In welke van `weken` een afspraak valt. */
export function wekenVanAfspraak(a: GeheugenAfspraak, weken: string[]): string[] {
  if (a.herhaalt || !a.start) return weken;
  const begin = dagNr(a.start);
  // Een afspraak die precies om middernacht eindigt, hoort niet meer bij die dag.
  const eindMin = minuten(a.duur);
  const eind = begin + Math.max(0, Math.ceil(eindMin / 1440) - 1);
  return weken.filter((w) => {
    const ws = dagNr(w);
    return begin <= ws + 6 && eind >= ws;
  });
}

interface Vak<T> { tijd: number; afspraken: T[] }

export class AgendaGeheugen<T extends GeheugenAfspraak> {
  private vakken = new Map<string, Vak<T>>();
  private bezig = new Map<string, Promise<void>>();
  /** Telt op bij elke `wis`; een ronde die daarvóór begon, schrijft niets meer weg. */
  private generatie = 0;
  private readonly nu: () => number;

  constructor(nu: () => number = () => Date.now()) {
    this.nu = nu;
  }

  private sleutel(week: string, gebruiker: string): string {
    return `${week}|${gebruiker.toLowerCase()}`;
  }

  private vers(week: string, gebruiker: string): Vak<T> | undefined {
    const vak = this.vakken.get(this.sleutel(week, gebruiker));
    if (!vak || this.nu() - vak.tijd > GEHEUGEN_MS) return undefined;
    return vak;
  }

  /** Alles vergeten, bijvoorbeeld na het opslaan of verwijderen van een afspraak. */
  wis(): void {
    this.vakken.clear();
    this.bezig.clear();
    this.generatie += 1;
  }

  /**
   * De afspraken van `gebruikers` in [van, tot]. Wat ontbreekt of verlopen is,
   * wordt in één ronde opgehaald via `haal(van, tot, gebruikers)`.
   */
  async lees(
    van: string,
    tot: string,
    gebruikers: string[],
    haal: (van: string, tot: string, gebruikers: string[]) => Promise<{ afspraken: T[]; mislukt: string[] }>,
  ): Promise<{ afspraken: T[]; mislukt: number }> {
    const weken = wekenIn(van, tot);
    const mensen = [...new Set(gebruikers.map((g) => g.toLowerCase()))];

    // Wat al onderweg is (bv. vooruit ophalen) afwachten in plaats van dubbel vragen.
    const lopend = [...new Set(weken.flatMap((w) => mensen.map((g) => this.bezig.get(this.sleutel(w, g)))))]
      .filter((p): p is Promise<void> => !!p);
    if (lopend.length) await Promise.all(lopend.map((p) => p.catch(() => undefined)));

    const ontbrekendeWeken = weken.filter((w) => mensen.some((g) => !this.vers(w, g)));
    let mislukt = 0;
    // Wat deze ronde ophaalde, ook als het geheugen intussen gewist is.
    const opgehaald = new Map<string, T[]>();
    if (ontbrekendeWeken.length) {
      const wie = mensen.filter((g) => ontbrekendeWeken.some((w) => !this.vers(w, g)));
      const eerste = ontbrekendeWeken[0];
      const laatste = datum(dagNr(ontbrekendeWeken[ontbrekendeWeken.length - 1]) + 6);
      const generatie = this.generatie;
      const ronde = (async () => {
        const uit = await haal(eerste, laatste, wie);
        const fout = new Set(uit.mislukt.map((g) => g.toLowerCase()));
        mislukt = fout.size;
        for (const w of ontbrekendeWeken) for (const g of wie) opgehaald.set(this.sleutel(w, g), []);
        for (const a of uit.afspraken) {
          for (const w of wekenVanAfspraak(a, ontbrekendeWeken)) {
            opgehaald.get(this.sleutel(w, a.gebruiker))?.push(a);
          }
        }
        if (generatie !== this.generatie) return;
        const tijd = this.nu();
        for (const [k, afspraken] of opgehaald) {
          const gebruiker = k.slice(k.indexOf("|") + 1);
          // Een agenda die niet te lezen was, onthouden we niet als leeg.
          if (!fout.has(gebruiker)) this.vakken.set(k, { tijd, afspraken });
        }
      })();
      const sleutels = ontbrekendeWeken.flatMap((w) => wie.map((g) => this.sleutel(w, g)));
      for (const k of sleutels) this.bezig.set(k, ronde);
      try {
        await ronde;
      } finally {
        for (const k of sleutels) if (this.bezig.get(k) === ronde) this.bezig.delete(k);
      }
    }

    // Samenvoegen; een afspraak die over twee weken loopt maar één keer.
    const gezien = new Set<string>();
    const afspraken: T[] = [];
    for (const w of weken) {
      for (const g of mensen) {
        const k0 = this.sleutel(w, g);
        for (const a of opgehaald.get(k0) ?? this.vakken.get(k0)?.afspraken ?? []) {
          const k = `${a.gebruiker.toLowerCase()}|${a.id}`;
          if (gezien.has(k)) continue;
          gezien.add(k);
          afspraken.push(a);
        }
      }
    }
    return { afspraken, mislukt };
  }
}
