/**
 * De begrote uren van een taak (`Task.expected_time`), zoals ze op een
 * taakkaart passen.
 *
 * Losse module omdat `Tasks.tsx` een `.tsx` is en `node --test` daar niet in
 * kan kijken; een opmaakregel als deze hoort getest te zijn.
 */

/** "8 u", "1,5 u", of "" wanneer er niets begroot is. */
export function formatUren(uren: number | string | null | undefined): string {
  const n = Number(uren);
  if (!Number.isFinite(n) || n <= 0) return "";
  // Hele uren zonder decimaal; een half uur wél, anders leest 0,5 als 1.
  const tekst = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
  return `${tekst} u`;
}
