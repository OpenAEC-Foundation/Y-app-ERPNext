/**
 * Statusvelden op een mail schrijven, langs de adresvalidatie van Frappe heen.
 *
 * Het probleem: Frappe controleert bij élke keer opslaan van een Communication
 * de adresvelden. Hij splitst `recipients`/`cc`/`bcc` op komma's en eist dat
 * elk stuk een geldig adres is. Een geadresseerde als
 *     "Veldhuijzen, F. (Friedhelm)" <f.veldhuijzen@hr.nl>
 * valt daardoor uiteen, en het eerste stuk is geen adres. Gevolg: een mail
 * afvinken of aan een project koppelen mislukt op een veld dat je niet eens
 * aanraakt — en zulke afzenders blijven binnenkomen, dus dit moest structureel.
 *
 * De gewone route gaat voorop. Alleen wanneer die op precies dat adresveld
 * struikelt, valt hij terug op het Server Script `mail_bijwerken`, dat alleen
 * de velden schrijft die het kent (status, e-mailstatus, gelezen, koppeling)
 * en de rol van de gebruiker controleert. Andere fouten — geen rechten, geen
 * netwerk — horen gewoon door te komen.
 *
 * Waarom de gewone route eerst en niet het script: het script kent alleen deze
 * handvol velden en bestaat alleen op een installatie waar hij is aangemaakt.
 * De gewone route blijft dus de norm; dit is het vangnet eronder.
 */

import { invalidateCache, callMethod, updateDocument } from "./erpnext.ts";

/** Velden die `mail_bijwerken` kent; iets anders kan hier niet doorheen. */
export type CommunicatieVelden = Record<string, string | number>;

export async function schrijfCommunicatieVelden(
  name: string,
  velden: CommunicatieVelden,
): Promise<void> {
  try {
    await updateDocument("Communication", name, velden);
  } catch (err) {
    if (!isAddressValidationError(err)) throw err;
    await callMethod("mail_bijwerken", { naam: name, ...velden });
    invalidateCache("Communication");
  }
}

/**
 * Is dit de adresvalidatie van Frappe, of iets anders? Alleen op het eerste
 * wijken we uit; op de rest zou het vangnet een echte fout verbergen.
 */
export function isAddressValidationError(err: unknown): boolean {
  const tekst = err instanceof Error ? err.message : String(err ?? "");
  return /not a valid Email Address|geen geldig e-?mailadres/i.test(tekst);
}
