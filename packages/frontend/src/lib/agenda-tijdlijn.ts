/**
 * De lijn van "nu" in het agendarooster — de rekenkant.
 *
 * Pure module: de agenda tekent de lijn, hier staat alleen waar hij hoort en
 * wanneer hij moet verspringen.
 */

/**
 * Waar de lijn in het rooster staat, in pixels vanaf de bovenkant. Buiten het
 * zichtbare deel van de dag is er geen lijn: `null`.
 *
 * Op hele minuten, niet op seconden: de lijn springt eens per minuut mee, en
 * een lijn die tussen twee minuten door kruipt, ziet er onrustig uit zonder
 * iets te zeggen.
 */
export function tijdlijnTop(nu: Date, uurHoogte: number, startUur = 0, totaalUren = 24): number | null {
  const minuten = (nu.getHours() - startUur) * 60 + nu.getMinutes();
  if (minuten < 0 || minuten > totaalUren * 60) return null;
  return (minuten / 60) * uurHoogte;
}

/** De tijd bij de lijn: `09:05`. */
export function tijdlijnLabel(nu: Date): string {
  return `${String(nu.getHours()).padStart(2, "0")}:${String(nu.getMinutes()).padStart(2, "0")}`;
}

/** Hoe lang het nog duurt tot de volgende hele minuut, in milliseconden. */
export function totVolgendeMinuut(nu: Date): number {
  return 60_000 - (nu.getSeconds() * 1000 + nu.getMilliseconds());
}
