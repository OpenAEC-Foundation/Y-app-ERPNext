/**
 * Pure helpers for the overuren/verlof-saldo berekening (Verlof & Overuren →
 * tab "Overuren", plus the "uren saldo"-kaarten).
 *
 * Single source of truth so the grid (`OverurenView`) and the cards
 * (`urenSaldoData`) compute a week's expected hours identically. Kept pure
 * (no fetch, no React) so the math is testable in isolation.
 *
 * Model (per ISO-week, per employee):
 *   weekTotal    = gewerkt + verlof + ziekte      (verlof/ziekte = "verantwoorde tijd")
 *   expected     = Σ dagUren over werkdagen die géén feestdag zijn
 *   feestdagUren = Σ dagUren over werkdagen die wél feestdag zijn (aparte balk)
 *   delta        = weekTotal − expected           (mag negatief; volle verlofweek → 0)
 *   dagUren      = weekuren / (aantal werkdagen)   (NIET hardcoded /5 of 8u)
 *
 * "Feestdag" = de werkgever-specifieke ERPNext Holiday List (holidaySet) OF de
 * generieke NL-lijst als fallback — zelfde OR-patroon als lib/missingDays.ts.
 */

import { isHoliday } from "./holidays";

/** getDay() (0 = zondag) → Engelse dagnaam, zoals Shift Plan `repeat_on_days`. */
const DAY_NAMES_EN = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

function fmtIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Is `iso` een feestdag voor deze medewerker?
 *
 * De werkgever-Holiday-List (ERPNext) is **autoritair zodra die bestaat** —
 * dan NIET ook de generieke NL-lijst OR'en. Anders zou bv. Goede Vrijdag
 * (wél in lib/holidays.ts, niet in de 3BM-lijst) onterecht als feestdag
 * gelden terwijl de medewerker die dag verlof opnam. Alleen als er géén
 * werkgever-lijst is (lege set) valt het terug op de generieke NL-lijst.
 */
function dayIsHoliday(iso: string, year: number, holidaySet: Set<string>): boolean {
  if (holidaySet.size > 0) return holidaySet.has(iso);
  return isHoliday(iso, year) !== null;
}

/**
 * Maandag (12:00 lokaal) van ISO-week `week` in `year`.
 * Jan 4 zit altijd in ISO-week 1; vanaf daar `(week-1)*7` dagen vooruit en
 * terug naar de maandag. Zelfde truc als voorheen inline in Leave.tsx.
 */
export function isoWeekMonday(year: number, week: number): Date {
  const d = new Date(year, 0, 4 + (week - 1) * 7, 12, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Dag-uren = weekuren gedeeld door het werkelijke aantal werkdagen (fallback 5). */
export function dailyHoursFor(weeklyHours: number, workdays: Set<string>): number {
  const size = workdays.size || 5;
  return weeklyHours / size;
}

/**
 * Uren van één specifieke weekdag. Als `dayHours` (uit de Shift Plan, bv.
 * {Monday:8,…,Friday:4}) die dag bevat → die exacte uren; anders het gemiddelde
 * weekuren/aantal-werkdagen. Zo klopt een feestdag/verlof op een korte of lange
 * dag bij een ongelijk deeltijdrooster, i.p.v. het gemiddelde te pakken.
 */
export function hoursForDay(
  dayName: string,
  weeklyHours: number,
  workdays: Set<string>,
  dayHours?: Record<string, number>,
): number {
  if (dayHours && Object.prototype.hasOwnProperty.call(dayHours, dayName)) {
    return dayHours[dayName];
  }
  return dailyHoursFor(weeklyHours, workdays);
}

export interface WeekBuckets {
  gewerkt: number;
  verlof: number;
  ziekte: number;
}

export interface ExpectedWeek {
  /** Verwachte werk-uren: werkdagen zonder feestdag × dagUren. */
  expected: number;
  /** Feestdag-uren: werkdagen mét feestdag × dagUren (aparte balk, niet in weekTotal). */
  feestdagHours: number;
  /** weekuren / aantal werkdagen. */
  dailyHours: number;
}

/**
 * Verwachte uren + feestdag-uren voor één ISO-week, op basis van het échte
 * rooster (workdays) en de feestdagen van deze medewerker.
 *
 * Rekent **per kalenderjaar**: alleen dagen waarvan het jaar === `year` tellen
 * mee. ISO-week 1 loopt vaak nog in december van het vorige jaar (en week
 * 52/53 in januari van het volgende) — die dagen horen bij het andere
 * kalenderjaar en worden overgeslagen. Zonder deze begrenzing telde bv. week 1
 * van 2026 de werkdagen 29–31 dec 2025 mee → vals tekort.
 *
 * Roept `holidaySet.has(iso) || isHoliday(iso, jaar-van-de-dag)` aan per werkdag.
 * `workdays` moet de werkelijke werkdagen bevatten; is die leeg dan wordt er
 * geen enkele dag als werkdag geteld (caller behoort zulke medewerkers als
 * "missing shift" te behandelen en niet mee te rekenen).
 */
export function expectedWeekHours(params: {
  year: number;
  week: number;
  weeklyHours: number;
  workdays: Set<string>;
  holidaySet: Set<string>;
  /** Optioneel: werkelijke uren per weekdag uit de Shift Plan (bv. Friday: 4). */
  dayHours?: Record<string, number>;
}): ExpectedWeek {
  const { year, week, weeklyHours, workdays, holidaySet, dayHours } = params;
  const monday = isoWeekMonday(year, week);

  let expected = 0;
  let feestdagHours = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (d.getFullYear() !== year) continue; // alleen dit kalenderjaar
    const dayName = DAY_NAMES_EN[d.getDay()];
    if (!workdays.has(dayName)) continue;
    const dh = hoursForDay(dayName, weeklyHours, workdays, dayHours);
    const iso = fmtIso(d);
    if (dayIsHoliday(iso, d.getFullYear(), holidaySet)) feestdagHours += dh;
    else expected += dh;
  }
  return { expected, feestdagHours, dailyHours: dailyHoursFor(weeklyHours, workdays) };
}

/** Is `iso` (YYYY-MM-DD) een werkdag én geen feestdag voor deze medewerker? */
export function isCountableWorkday(
  iso: string,
  workdays: Set<string>,
  holidaySet: Set<string>,
): boolean {
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return false;
  const dayName = DAY_NAMES_EN[d.getDay()];
  if (!workdays.has(dayName)) return false;
  return !dayIsHoliday(iso, d.getFullYear(), holidaySet);
}

/** delta = gewerkt + verlof + ziekte − expected. */
export function weekDelta(b: WeekBuckets, expected: number): number {
  return b.gewerkt + b.verlof + b.ziekte - expected;
}
