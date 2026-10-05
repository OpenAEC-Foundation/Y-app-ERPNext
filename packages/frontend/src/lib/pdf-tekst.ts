/**
 * De tekst van een PDF-bijlage, als regels.
 *
 * Bij veel facturen staat het bedrag, de factuurdatum en het nummer alleen in
 * de PDF; de mail zelf zegt hooguit "in de bijlage vindt u uw factuur". De
 * herkenning in `invoice-detect.ts` moet de PDF dus ook kunnen lezen.
 *
 * Een PDF kent geen regels, alleen losse stukjes tekst met een plek op de
 * pagina. Bij een factuur met twee kolommen ("Factuurdatum:" links,
 * "30-09-2026" rechts) somt het bestand eerst alle labels op en daarna alle
 * waarden. Daarom bouwen we de regels terug op hoogte: wat op dezelfde
 * hoogte staat is één regel, van links naar rechts gelezen.
 *
 * Het lezen gebeurt met pdfjs, en pas wanneer het nodig is: de bibliotheek is
 * groot en hoort niet in de eerste lading van de app. Hij draait in de
 * hoofddraad (`globalThis.pdfjsWorker`) in plaats van in een eigen worker;
 * een losse workerbestand zou bij het publiceren naar ERPNext een eigen pad
 * nodig hebben, en voor een factuur van een paar pagina's scheelt het niets.
 */

/** Eén stukje tekst op een pagina; `y` loopt van onder naar boven. */
export interface PdfTekstItem {
  str: string;
  x: number;
  y: number;
  /** Hoogte van de letters; bepaalt hoeveel `y` mag schuiven binnen één regel. */
  h?: number;
}

/** Regels terugbouwen uit de stukjes van één pagina. */
export function regelsUitTekstItems(items: PdfTekstItem[]): string {
  const bruikbaar = items.filter((i) => i.str.trim() !== "");
  // Van boven naar beneden; daarbinnen van links naar rechts.
  const gesorteerd = [...bruikbaar].sort((a, b) => b.y - a.y || a.x - b.x);
  const regels: { y: number; marge: number; stukken: PdfTekstItem[] }[] = [];
  for (const it of gesorteerd) {
    const marge = Math.max(2, (it.h ?? 0) * 0.4);
    const regel = regels.find((r) => Math.abs(r.y - it.y) <= Math.max(marge, r.marge));
    if (regel) regel.stukken.push(it);
    else regels.push({ y: it.y, marge, stukken: [it] });
  }
  return regels
    .map((r) => r.stukken.sort((a, b) => a.x - b.x).map((s) => s.str.trim()).join(" "))
    .map((r) => r.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Hoogstens zoveel pagina's: het bedrag en de datum staan op de eerste. */
const MAX_PAGINAS = 3;

/**
 * De tekst van een PDF op `url`, pagina's gescheiden door een lege regel.
 * Geeft een lege string als het bestand niet te lezen is (gescand, beveiligd,
 * geen PDF) — dan valt de herkenning terug op de mail zelf.
 */
export async function leesPdfTekst(url: string): Promise<string> {
  try {
    const antwoord = await fetch(url, { credentials: "include" });
    if (!antwoord.ok) return "";
    const data = new Uint8Array(await antwoord.arrayBuffer());
    const pdfjs = await import("pdfjs-dist");
    const g = globalThis as { pdfjsWorker?: unknown };
    if (!g.pdfjsWorker) g.pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
    const taak = pdfjs.getDocument({ data });
    const doc = await taak.promise;
    const paginas: string[] = [];
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGINAS); p++) {
      const pagina = await doc.getPage(p);
      const inhoud = await pagina.getTextContent();
      const items: PdfTekstItem[] = [];
      for (const i of inhoud.items) {
        if (!("str" in i)) continue;
        items.push({ str: i.str, x: i.transform[4], y: i.transform[5], h: i.height });
      }
      paginas.push(regelsUitTekstItems(items));
    }
    void taak.destroy();
    return paginas.filter(Boolean).join("\n\n");
  } catch {
    return "";
  }
}
