/**
 * Wat voor bijlage is dit, en kun je hem naast de mail bekijken?
 *
 * De app kent vier soorten voorbeeld: pdf (in een `iframe`), IFC (web-ifc),
 * Office (Word, Excel, csv — alleen lezen) en tekening (dwg/dxf). Elke soort
 * heeft zijn eigen paneel; deze module zegt alleen welke het is, zodat die
 * keuze op één plek staat en te testen is zonder DOM.
 */

export type BijlageSoort = "pdf" | "ifc" | "office" | "cad";

/** Wat voor Office-bestand: een tekstdocument of een rekenblad. */
export type OfficeSoort = "word" | "excel" | "csv";

const EXT = (naam: string) => {
  const schoon = String(naam || "").trim().toLowerCase();
  const punt = schoon.lastIndexOf(".");
  return punt === -1 ? "" : schoon.slice(punt + 1);
};

const WORD = new Set(["docx", "doc", "odt", "rtf"]);
const EXCEL = new Set(["xlsx", "xls", "xlsm", "ods"]);
const CSV = new Set(["csv", "tsv"]);
const CAD = new Set(["dwg", "dxf"]);

/** "word", "excel", "csv" — of `null` als het geen Office-bestand is. */
export function officeSoort(naam: string): OfficeSoort | null {
  const ext = EXT(naam);
  if (WORD.has(ext)) return "word";
  if (EXCEL.has(ext)) return "excel";
  if (CSV.has(ext)) return "csv";
  return null;
}

/**
 * Welke Office-bestanden de ingebouwde lezer echt kan tonen.
 *
 * `.docx` en `.xlsx` (en csv) lukken in de browser. Het oude `.doc`, `.xls`,
 * en de OpenDocument-varianten niet: die blijven een download, want een leeg
 * of half leesvenster is erger dan geen leesvenster.
 */
export function isLeesbaarOffice(naam: string): boolean {
  const ext = EXT(naam);
  return ext === "docx" || ext === "xlsx" || ext === "xlsm" || CSV.has(ext);
}

export function isCadNaam(naam: string): boolean {
  return CAD.has(EXT(naam));
}

export function isPdfNaam(naam: string): boolean {
  return EXT(naam) === "pdf";
}

export function isIfcNaam(naam: string): boolean {
  return EXT(naam) === "ifc";
}

/** De soort voorbeeldweergave voor deze bijlage, of `null` voor downloaden. */
export function voorbeeldSoort(naam: string): BijlageSoort | null {
  if (isPdfNaam(naam)) return "pdf";
  if (isIfcNaam(naam)) return "ifc";
  if (isCadNaam(naam)) return "cad";
  if (isLeesbaarOffice(naam)) return "office";
  return null;
}
