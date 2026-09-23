/**
 * Tijdsduur van een afspraak, zoals in Outlook.
 *
 * - Kies je een duur, dan volgt de eindtijd.
 * - Verschuif je de begintijd, dan schuift de eindtijd mee en blijft de duur
 *   gelijk.
 * - Pas je de eindtijd aan, dan rekent de duur mee.
 *
 * Een afspraak blijft binnen één dag: de eindtijd gaat nooit voorbij 23:59.
 */

/** Keuzes in de lijst, in minuten. */
export const DUUR_KEUZES = [15, 30, 45, 60, 90, 120, 180, 240, 480];

/** "13:30" → 810. Onleesbaar → null. */
export function naarMinuten(tijd: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(tijd || "").trim());
  if (!m) return null;
  const u = Number(m[1]), min = Number(m[2]);
  if (u > 23 || min > 59) return null;
  return u * 60 + min;
}

/** 810 → "13:30", begrensd op 00:00 en 23:59. */
export function naarTijd(minuten: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minuten)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Duur tussen begin en eind in minuten; 0 als het eind niet na het begin ligt. */
export function duurTussen(start: string, eind: string): number {
  const a = naarMinuten(start), b = naarMinuten(eind);
  if (a === null || b === null) return 0;
  return Math.max(0, b - a);
}

/** Eindtijd bij een begintijd en een duur. */
export function eindNaDuur(start: string, duurMinuten: number): string {
  const a = naarMinuten(start);
  if (a === null) return "";
  return naarTijd(a + Math.max(0, duurMinuten));
}

/** Nieuwe eindtijd als de begintijd verschuift: de duur blijft gelijk. */
export function eindBijNieuweStart(oudeStart: string, oudEind: string, nieuweStart: string): string {
  const duur = duurTussen(oudeStart, oudEind);
  return eindNaDuur(nieuweStart, duur > 0 ? duur : 60);
}

/** "30 min", "1 uur", "1 uur 30 min", "8 uur". */
export function duurLabel(minuten: number): string {
  const m = Math.max(0, Math.round(minuten));
  const u = Math.floor(m / 60), r = m % 60;
  if (u === 0) return `${r} min`;
  return r ? `${u} uur ${r} min` : `${u} uur`;
}

/** De keuzes voor de lijst, met de huidige duur erbij als die er niet in staat. */
export function duurOpties(huidig: number): number[] {
  const set = new Set(DUUR_KEUZES);
  if (huidig > 0) set.add(huidig);
  return [...set].sort((a, b) => a - b);
}
