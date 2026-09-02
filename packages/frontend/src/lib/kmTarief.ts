/**
 * Het kilometertarief — één gedeelde instelling voor de hele organisatie.
 *
 * Opgeslagen als rij in het bestaande sleutel/waarde-doctype `Y Next Setting`
 * onder de sleutel `km-tarief` (aangemaakt door
 * `scripts/provision-y-next.mjs`, default € 0,23 — de gangbare onbelaste
 * kilometervergoeding). Schrijven op dat doctype is **System-Manager-only**,
 * en dat is precies de bedoeling: een medewerker mag zijn eigen vergoeding
 * niet ophogen. `saveKmTarief` meldt daarom via zijn returnwaarde of het
 * gelukt is, zodat de UI geen "opgeslagen" kan beweren na een 403.
 *
 * **Het tarief wordt bij het boeken overgenomen in `tarief_per_km` op het
 * document zelf.** Een latere tariefwijziging herrekent dus niets van wat al
 * geboekt is — historisch correct, en het maakt een goedgekeurde declaratie
 * onveranderlijk in bedrag.
 */

import { fetchDocument, updateDocument, createDocument, ApiError } from "./erpnext.ts";

const SETTING_DOCTYPE = "Y Next Setting";
/** Moet gelijk blijven aan `KM_TARIEF_SETTING_KEY` in het provisioningscript. */
export const KM_TARIEF_SETTING_KEY = "km-tarief";
/** Moet gelijk blijven aan `DEFAULT_KM_TARIEF` in het provisioningscript. */
export const DEFAULT_KM_TARIEF = 0.23;

interface YNextSettingDoc {
  setting_key?: string;
  setting_value?: string;
}

/**
 * Leest een tariefwaarde uit de opgeslagen tekst.
 *
 * Apart en puur omdat de bron een `Long Text` is: er kan van alles in staan.
 * Een komma wordt als decimaalteken geaccepteerd (iemand die "0,25" typt
 * bedoelt geen 25), en alles wat geen positief getal oplevert valt terug op de
 * default — een tarief van 0 of NaN zou stilzwijgend elke vergoeding op € 0
 * zetten.
 */
export function parseKmTarief(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_KM_TARIEF;
  if (typeof raw !== "string") return DEFAULT_KM_TARIEF;
  const value = Number(raw.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_KM_TARIEF;
}

export async function fetchKmTarief(): Promise<number> {
  try {
    const doc = await fetchDocument<YNextSettingDoc>(SETTING_DOCTYPE, KM_TARIEF_SETTING_KEY);
    return parseKmTarief(doc?.setting_value);
  } catch {
    // Nog niet geprovisioneerd, of geen leesrecht — dan is de default de
    // eerlijkste waarde. Boeken moet blijven werken.
    return DEFAULT_KM_TARIEF;
  }
}

/**
 * Slaat het tarief op. `"forbidden"` betekent: geen System Manager, dus de
 * instelling is níét gewijzigd (in tegenstelling tot bv. de
 * inkoopfactuur-defaults is er hier geen zinnige lokale terugval — een tarief
 * dat alleen op één apparaat geldt zou tot verschillende bedragen per
 * medewerker leiden).
 */
export async function saveKmTarief(tarief: number): Promise<"saved" | "forbidden"> {
  const payload = { setting_value: String(tarief) };
  try {
    await updateDocument(SETTING_DOCTYPE, KM_TARIEF_SETTING_KEY, payload);
    return "saved";
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      try {
        await createDocument(SETTING_DOCTYPE, { setting_key: KM_TARIEF_SETTING_KEY, ...payload });
        return "saved";
      } catch { /* val door naar forbidden */ }
    }
    return "forbidden";
  }
}
