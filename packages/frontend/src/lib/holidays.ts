/**
 * Generic Dutch national holidays. Used by Agenda overlays, Planning,
 * dashboard and the Leave year-overview ribbon.
 *
 * Bevrijdingsdag (5 mei) is in NL alleen wettelijk vrij voor ambtenaren en
 * onderwijs in lustrumjaren (2025, 2030, ...). Voor de meeste werknemers
 * geldt het alleen als de werkgever het toekent. Daarom staat het hier
 * alleen in lustrumjaren; voor de Leave-modal komt de échte werkgever-
 * lijst uit ERPNext (zie lib/employeeHolidays.ts).
 */
export const HOLIDAYS: Record<number, { date: string; name: string }[]> = {
  2024: [
    { date: "2024-01-01", name: "Nieuwjaarsdag" },
    { date: "2024-03-29", name: "Goede Vrijdag" },
    { date: "2024-03-31", name: "Eerste Paasdag" },
    { date: "2024-04-01", name: "Tweede Paasdag" },
    { date: "2024-04-27", name: "Koningsdag" },
    { date: "2024-05-09", name: "Hemelvaartsdag" },
    { date: "2024-05-19", name: "Eerste Pinksterdag" },
    { date: "2024-05-20", name: "Tweede Pinksterdag" },
    { date: "2024-12-25", name: "Eerste Kerstdag" },
    { date: "2024-12-26", name: "Tweede Kerstdag" },
  ],
  2025: [
    { date: "2025-01-01", name: "Nieuwjaarsdag" },
    { date: "2025-04-18", name: "Goede Vrijdag" },
    { date: "2025-04-20", name: "Eerste Paasdag" },
    { date: "2025-04-21", name: "Tweede Paasdag" },
    { date: "2025-04-26", name: "Koningsdag" },
    { date: "2025-05-05", name: "Bevrijdingsdag" }, // 80 jaar bevrijding (lustrumjaar)
    { date: "2025-05-29", name: "Hemelvaartsdag" },
    { date: "2025-06-08", name: "Eerste Pinksterdag" },
    { date: "2025-06-09", name: "Tweede Pinksterdag" },
    { date: "2025-12-25", name: "Eerste Kerstdag" },
    { date: "2025-12-26", name: "Tweede Kerstdag" },
  ],
  2026: [
    { date: "2026-01-01", name: "Nieuwjaarsdag" },
    { date: "2026-04-03", name: "Goede Vrijdag" },
    { date: "2026-04-05", name: "Eerste Paasdag" },
    { date: "2026-04-06", name: "Tweede Paasdag" },
    { date: "2026-04-27", name: "Koningsdag" },
    { date: "2026-05-14", name: "Hemelvaartsdag" },
    { date: "2026-05-24", name: "Eerste Pinksterdag" },
    { date: "2026-05-25", name: "Tweede Pinksterdag" },
    { date: "2026-12-25", name: "Eerste Kerstdag" },
    { date: "2026-12-26", name: "Tweede Kerstdag" },
  ],
};

/** Check if a date string (YYYY-MM-DD) is a holiday in the given year */
export function isHoliday(dateStr: string, year: number): string | null {
  const holidays = HOLIDAYS[year] || [];
  const match = holidays.find((h) => h.date === dateStr);
  return match ? match.name : null;
}
