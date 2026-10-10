/**
 * Eén rij lezen uit de sleutel/waarde-opslag `Y Next Setting`.
 *
 * Via een lijstverzoek, niet door het document rechtstreeks op te vragen: een
 * instelling die nog niet bestaat is dan een lege lijst. Het document zelf
 * opvragen geeft een 404, en voor een instelling die bij elke keer laden
 * gelezen wordt is dat een mislukt verzoek per paginabezoek.
 */
import { fetchList } from "./erpnext.ts";

export const SETTING_DOCTYPE = "Y Next Setting";

/** De waarde van de instelling, of `null` als de instelling niet bestaat. */
export async function leesInstelling(sleutel: string): Promise<string | null> {
  const rijen = await fetchList<{ name: string; setting_value?: string | null }>(SETTING_DOCTYPE, {
    fields: ["name", "setting_value"],
    filters: [["name", "=", sleutel]],
    limit_page_length: 1,
  });
  const rij = rijen.find((r) => r.name === sleutel);
  return rij ? rij.setting_value ?? "" : null;
}
