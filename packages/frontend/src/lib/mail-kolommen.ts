/**
 * Breedte van de kolommen in de mail: de mappen en de berichtenlijst.
 *
 * Beide zijn aan hun rechterrand te verslepen en blijven per apparaat bewaard:
 * hoe breed je de lijst wilt hangt af van je scherm, niet van de mail. Het
 * leespaneel krijgt de rest en mag nooit onder `LEESPANEEL_MIN` komen — daar
 * lees en schrijf je, en een lijst die alles opeet laat een onleesbare strook
 * over.
 */

export type MailKolom = "mappen" | "lijst";

/** De breedtes van vóór het verslepen (w-56 en w-96). */
export const KOLOM_START: Record<MailKolom, number> = { mappen: 224, lijst: 384 };

const KOLOM_MIN: Record<MailKolom, number> = { mappen: 160, lijst: 280 };
const KOLOM_MAX: Record<MailKolom, number> = { mappen: 400, lijst: 900 };

export const LEESPANEEL_MIN = 420;

export const KOLOM_SLEUTEL: Record<MailKolom, string> = {
  mappen: "ynext_mail_mappen_breedte",
  lijst: "ynext_mail_lijst_breedte",
};

/**
 * De breedte waar een sleepbeweging op uitkomt.
 *
 * @param ruimte      breedte van de rij met de drie kolommen
 * @param andereKolom breedte van de kolom die niet versleept wordt
 */
export function begrensKolom(kolom: MailKolom, px: number, ruimte: number, andereKolom: number): number {
  let max = KOLOM_MAX[kolom];
  if (Number.isFinite(ruimte) && ruimte > 0) max = Math.min(max, ruimte - andereKolom - LEESPANEEL_MIN);
  // Is het scherm te smal voor alle drie, dan wint het minimum van de kolom:
  // een lijst van nul pixels is geen oplossing.
  return Math.round(Math.max(KOLOM_MIN[kolom], Math.min(px, max)));
}

/** Een bewaarde breedte terug; iets onleesbaars geeft de standaardbreedte. */
export function opgeslagenKolom(kolom: MailKolom, raw: string | null): number {
  if (raw === null || raw.trim() === "") return KOLOM_START[kolom];
  const px = Number(raw);
  if (!Number.isFinite(px)) return KOLOM_START[kolom];
  return Math.round(Math.max(KOLOM_MIN[kolom], Math.min(px, KOLOM_MAX[kolom])));
}
