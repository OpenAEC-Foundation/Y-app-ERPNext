/**
 * Welke afdrukformaten een document aanbiedt.
 *
 * De formaten komen van de site: elke organisatie heeft haar eigen Print
 * Formats, en een nieuwe site heeft er voor een doctype soms nog geen. Er
 * staat daarom geen naam van een formaat in de code.
 */

/** Het formaat dat Frappe voor elk doctype zelf opbouwt; bestaat op elke site. */
export const STANDAARD_AFDRUKFORMAAT = "Standard";

/**
 * De keuzelijst: het ingestelde formaat vooraan, de rest op naam. Heeft de
 * site voor dit doctype geen eigen formaten, dan het standaardformaat.
 *
 * @param namen de Print Formats die de site voor het doctype heeft
 * @param voorkeur het formaat uit de instellingen, of ""
 */
export function kiesAfdrukformaten(namen: readonly string[], voorkeur: string): string[] {
  const uniek = [...new Set(namen.map((naam) => naam.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  if (uniek.length === 0) return [STANDAARD_AFDRUKFORMAAT];
  if (!uniek.includes(voorkeur)) return uniek;
  return [voorkeur, ...uniek.filter((naam) => naam !== voorkeur)];
}
