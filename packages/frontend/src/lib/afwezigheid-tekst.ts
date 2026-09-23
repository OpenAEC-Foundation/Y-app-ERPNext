/**
 * De standaardtekst van een afwezigheidsmelding.
 *
 * Wie een afwezigheidsmelding instelt, begint nu met een leeg vak en typt elke
 * keer hetzelfde. Hier staat die tekst één keer, met de datums uit de velden
 * en de collega die je kiest erin, plus je eigen ondertekening eronder.
 *
 * Pure module: geen netwerk, geen DOM. De ondertekening komt van buiten, als
 * platte tekst.
 */

const MAANDEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

const AANHEF = "Geachte heer, mevrouw,";
const GROET = "Met vriendelijke groet,";

/** "2026-09-28" → "28 september 2026"; lege of rare invoer geeft "". */
export function datumInWoorden(datum: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((datum || "").trim());
  if (!m) return "";
  const maand = MAANDEN[Number(m[2]) - 1];
  if (!maand) return "";
  return `${Number(m[3])} ${maand} ${m[1]}`;
}

export interface TekstInvoer {
  van: string;
  tot: string;
  /** Naam van de collega die waarneemt; leeg = die zin valt weg. */
  collega?: string;
  /** E-mailadres van die collega, tussen haakjes achter de naam. */
  collegaEmail?: string;
  /** Eigen ondertekening als platte tekst; leeg = alleen de groet. */
  ondertekening?: string;
}

/** De afwezigheidszin, met de datums die ingevuld zijn. */
export function afwezigZin(van: string, tot: string): string {
  const v = datumInWoorden(van);
  const t = datumInWoorden(tot);
  if (v && t) return `Ik ben afwezig van ${v} tot en met ${t}.`;
  if (v) return `Ik ben afwezig vanaf ${v}.`;
  if (t) return `Ik ben afwezig tot en met ${t}.`;
  return "Ik ben op dit moment afwezig.";
}

/** De hele standaardtekst, klaar om in het tekstvak te zetten. */
export function standaardTekst(invoer: TekstInvoer): string {
  const collega = (invoer.collega || "").trim();
  const adres = (invoer.collegaEmail || "").trim();
  const regels = [AANHEF, "", afwezigZin(invoer.van, invoer.tot)];
  if (collega) {
    regels.push(`Bij vragen kunt u contact opnemen met mijn collega ${collega}${adres ? ` (${adres})` : ""}.`);
  }
  regels.push("", GROET);
  const onder = (invoer.ondertekening || "").trim();
  if (onder) regels.push("", onder);
  return regels.join("\n");
}

/**
 * Is deze tekst nog de standaardtekst (eventueel met andere datums of een
 * andere collega)? Zo ja, dan mag hij meeveranderen als je een datum of
 * collega wijzigt; heeft iemand er zelf iets van gemaakt, dan blijft hij staan.
 */
export function isStandaardTekst(tekst: string): boolean {
  const huidig = (tekst || "").trim();
  if (!huidig) return true;
  return huidig.startsWith(AANHEF) && huidig.includes(GROET);
}
