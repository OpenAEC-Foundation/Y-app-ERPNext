/**
 * Wat voor bijlage is dit, en kun je hem naast de mail bekijken?
 *
 * De app kent vijf soorten voorbeeld: pdf (in een `iframe`), IFC (web-ifc),
 * Office (Word, Excel, csv — alleen lezen), tekening (dwg/dxf) en afbeelding
 * (foto's en schermafdrukken, door de browser zelf getoond). Elke soort
 * heeft zijn eigen paneel; deze module zegt alleen welke het is, zodat die
 * keuze op één plek staat en te testen is zonder DOM.
 */

export type BijlageSoort = "pdf" | "ifc" | "office" | "cad" | "afbeelding";

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
// Alleen wat elke gangbare browser zelf kan tonen. HEIC (iPhone) en TIFF horen
// daar niet bij: die blijven een download.
const AFBEELDING = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"]);

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

export function isAfbeeldingNaam(naam: string): boolean {
  return AFBEELDING.has(EXT(naam));
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
  if (isAfbeeldingNaam(naam)) return "afbeelding";
  return null;
}

export interface AfbeeldingBuren<T> {
  /** Plaats van de getoonde afbeelding, vanaf 1; 0 als hij er niet tussen staat. */
  positie: number;
  totaal: number;
  vorige: T | null;
  volgende: T | null;
}

/**
 * De afbeeldingen vóór en na de getoonde, binnen de bijlagen van één mail.
 *
 * Een mail met bouwplaatsfoto's heeft er al gauw tien; dan wil je bladeren en
 * niet tien keer een bijlage aanklikken. Andere bijlagen (pdf, tekening) doen
 * niet mee, en aan het begin en eind houdt het op: rondbladeren zou verbergen
 * dat je alles gezien hebt.
 */
export function buurAfbeeldingen<T extends { file_url: string; file_name: string }>(
  bijlagen: T[], huidigeUrl: string,
): AfbeeldingBuren<T> {
  // Eén bestand kan onder twee namen in de bijlagen staan (de plaatjes uit een
  // Outlook-mail); bij het bladeren telt het één keer, anders blijf je hangen.
  const gezien = new Set<string>();
  const beelden = (bijlagen || []).filter((b) => {
    if (!isAfbeeldingNaam(b.file_name) || gezien.has(b.file_url)) return false;
    gezien.add(b.file_url);
    return true;
  });
  const i = beelden.findIndex((b) => b.file_url === huidigeUrl);
  return {
    positie: i + 1,
    totaal: beelden.length,
    vorige: i > 0 ? beelden[i - 1] : null,
    volgende: i >= 0 && i < beelden.length - 1 ? beelden[i + 1] : null,
  };
}

/**
 * Is dit het pad van een bestand op de eigen ERPNext (`/files/…` of
 * `/private/files/…`)?
 *
 * De schermvullende viewer krijgt zijn bestand uit het adres van het tabblad.
 * Zonder deze toets zou een gemaakte link er een pagina van elders in kunnen
 * laden, onder het vertrouwde adres van de app.
 */
export function isEigenBestand(url: string): boolean {
  const pad = String(url || "");
  if (!/^\/(private\/)?files\//.test(pad)) return false;
  return !pad.includes("..") && !pad.includes("\\");
}
