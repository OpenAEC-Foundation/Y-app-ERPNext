/**
 * Het klembord lezen voor de plakknoppen van het opstelvenster.
 *
 * Ctrl+V krijgt de inhoud van de browser cadeau in het plak-event. Een knop
 * niet: die moet het klembord zelf opvragen via `navigator.clipboard`. Dat
 * gaat anders — de browser vraagt de eerste keer toestemming, en kan weigeren
 * of niets bruikbaars aantreffen. Deze module maakt van beide routes dezelfde
 * `KlembordInhoud`, zodat de rest van het plakken (`plakPlan` in
 * `mail-plakken.ts`) niet hoeft te weten hoe er geplakt werd.
 */

/** Wat er van het klembord in een mail kan: opmaak, tekst en afbeeldingen. */
export interface KlembordInhoud {
  html: string;
  tekst: string;
  /** Schermafdrukken en gekopieerde plaatjes; nooit SVG (zie `isPlakbareAfbeelding`). */
  afbeeldingen: File[];
}

/** Waarom de knop niets kon plakken. Elk geval heeft een eigen melding. */
export type KlembordFout = "geweigerd" | "niet_ondersteund" | "leeg";

export type KlembordUitkomst = { inhoud: KlembordInhoud } | { fout: KlembordFout };

/** Het deel van een `ClipboardItem` dat we gebruiken. */
export interface KlembordItem {
  readonly types: readonly string[];
  getType(type: string): Promise<Blob>;
}

/** Het deel van `navigator.clipboard` dat we gebruiken; in tests na te maken. */
export interface KlembordBron {
  read?: () => Promise<readonly KlembordItem[]>;
  readText?: () => Promise<string>;
}

/** Het deel van een `DataTransfer` (het plak-event van Ctrl+V) dat we gebruiken. */
export interface PlakData {
  getData(type: string): string;
  items?: ArrayLike<{ kind: string; type: string; getAsFile(): File | null }>;
}

/**
 * Mag dit bestandstype als afbeelding de mail in? SVG nooit: dat is een
 * scriptbaar document, geen plaatje.
 */
export function isPlakbareAfbeelding(type: string): boolean {
  return type.startsWith("image/") && type !== "image/svg+xml";
}

const EXTENSIE: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/bmp": "bmp",
};

/** De inhoud uit wat `navigator.clipboard.read()` teruggeeft. */
export async function inhoudUitItems(items: readonly KlembordItem[]): Promise<KlembordInhoud> {
  const inhoud: KlembordInhoud = { html: "", tekst: "", afbeeldingen: [] };
  for (const item of items) {
    for (const type of item.types) {
      if (type === "text/html" && !inhoud.html) {
        inhoud.html = await (await item.getType(type)).text();
      } else if (type === "text/plain" && !inhoud.tekst) {
        inhoud.tekst = await (await item.getType(type)).text();
      } else if (isPlakbareAfbeelding(type)) {
        // Het klembord kent geen bestandsnaam; de upload naar ERPNext wel.
        const blob = await item.getType(type);
        inhoud.afbeeldingen.push(new File([blob], `klembord.${EXTENSIE[type] ?? "png"}`, { type }));
      }
    }
  }
  return inhoud;
}

/** De inhoud uit het plak-event van Ctrl+V. */
export function inhoudUitDataTransfer(data: PlakData): KlembordInhoud {
  const afbeeldingen: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== "file") continue;
    const bestand = item.getAsFile();
    if (bestand && isPlakbareAfbeelding(bestand.type)) afbeeldingen.push(bestand);
  }
  return { html: data.getData("text/html"), tekst: data.getData("text/plain"), afbeeldingen };
}

function isLeeg(inhoud: KlembordInhoud): boolean {
  return !inhoud.html.trim() && !inhoud.tekst.trim() && inhoud.afbeeldingen.length === 0;
}

function isGeweigerd(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: string }).name === "NotAllowedError";
}

/** Alleen tekst, voor als `read()` ontbreekt of er niets mee kon. */
async function leesTekst(bron: KlembordBron): Promise<KlembordUitkomst> {
  if (typeof bron.readText !== "function") return { fout: "leeg" };
  try {
    const tekst = await bron.readText();
    return tekst.trim() ? { inhoud: { html: "", tekst, afbeeldingen: [] } } : { fout: "leeg" };
  } catch (err) {
    return { fout: isGeweigerd(err) ? "geweigerd" : "leeg" };
  }
}

/**
 * Leest het klembord voor een plakknop.
 *
 * Eerst `read()`, want alleen die levert opmaak en afbeeldingen. Weigert de
 * browser, dan houdt het daar op: meteen `readText()` erachteraan zou een
 * tweede toestemmingsvraag geven vlak na een nee. Kan `read()` het klembord
 * alleen niet lezen (Chrome geeft een `DataError` bij inhoud die hij niet
 * kent), dan is er misschien nog wel tekst.
 */
export async function leesKlembord(bron: KlembordBron | undefined): Promise<KlembordUitkomst> {
  if (!bron || (typeof bron.read !== "function" && typeof bron.readText !== "function")) {
    return { fout: "niet_ondersteund" };
  }
  if (typeof bron.read !== "function") return leesTekst(bron);
  try {
    const inhoud = await inhoudUitItems(await bron.read());
    return isLeeg(inhoud) ? { fout: "leeg" } : { inhoud };
  } catch (err) {
    if (isGeweigerd(err)) return { fout: "geweigerd" };
    return leesTekst(bron);
  }
}
