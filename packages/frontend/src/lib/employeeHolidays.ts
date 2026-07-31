/**
 * Per-employee holiday lookup via ERPNext Holiday List.
 *
 * Wordt gebruikt voor verlof-berekeningen waar de werkgever-specifieke set
 * feestdagen geldt — niet de generieke NL-lijst in `lib/holidays.ts`. Een
 * werkgever kan in ERPNext kiezen welke dagen vrij zijn (Bevrijdingsdag is
 * niet jaarlijks vrij; sommige werkgevers tellen Goede Vrijdag wel/niet).
 *
 * Resolutie van de Holiday List per werknemer:
 *   1. Employee.holiday_list als deze gezet is
 *   2. anders Company.default_holiday_list
 *   3. anders: lege set (geen feestdagen onttrokken aan verlof)
 *
 * De `weekly_off=1` rijen (zaterdag/zondag) worden uitgesloten — die zijn
 * al niet-werkdagen via de Shift Plan. Anders telt een weekend dubbel als
 * "feestdag + niet-werkdag".
 */

import { fetchList, fetchDocument } from "./erpnext";

interface EmployeeDoc {
  name: string;
  holiday_list?: string;
  company?: string;
}

interface CompanyDoc {
  name: string;
  default_holiday_list?: string;
}

interface HolidayRow {
  name: string;
  holiday_date: string;
  description?: string;
  weekly_off?: 0 | 1;
}

/** Cache: employee name → Set of YYYY-MM-DD strings. */
const cache = new Map<string, Set<string>>();
/** Cache: employee name → Map of date → description. For tooltips. */
const descCache = new Map<string, Map<string, string>>();
/** Pending lookups, so parallel callers wait on the same promise. */
const pending = new Map<string, Promise<void>>();

async function resolveHolidayListName(empName: string): Promise<string | null> {
  try {
    const emp = await fetchDocument<EmployeeDoc>("Employee", empName);
    if (emp.holiday_list) return emp.holiday_list;
    if (emp.company) {
      try {
        const company = await fetchDocument<CompanyDoc>("Company", emp.company);
        return company.default_holiday_list || null;
      } catch {
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function loadHolidaysForEmployee(empName: string): Promise<void> {
  const listName = await resolveHolidayListName(empName);
  if (!listName) {
    cache.set(empName, new Set());
    descCache.set(empName, new Map());
    return;
  }

  // Fetch holidays — child table on Holiday List. Only "real" holidays
  // (weekly_off=0); the weekend rows are handled by the shift plan.
  let rows: HolidayRow[] = [];
  try {
    rows = await fetchList<HolidayRow>("Holiday", {
      fields: ["name", "holiday_date", "description", "weekly_off"],
      filters: [["parent", "=", listName], ["weekly_off", "=", 0]],
      limit_page_length: 0,
    });
  } catch {
    // Fallback: load the parent doc and read its child table directly.
    // Some ERPNext versions don't allow fetchList on child doctypes.
    try {
      const list = await fetchDocument<{ holidays?: HolidayRow[] }>("Holiday List", listName);
      rows = (list.holidays || []).filter((h) => !h.weekly_off);
    } catch {
      rows = [];
    }
  }

  const dates = new Set<string>();
  const descMap = new Map<string, string>();
  for (const r of rows) {
    if (!r.holiday_date) continue;
    // Normalize to YYYY-MM-DD (ERPNext returns ISO; safe to slice).
    const d = r.holiday_date.slice(0, 10);
    dates.add(d);
    if (r.description) descMap.set(d, r.description);
  }
  cache.set(empName, dates);
  descCache.set(empName, descMap);
}

/**
 * Returns the set of holiday dates (YYYY-MM-DD) that count as paid leave
 * exemption for this employee. First call triggers an ERPNext fetch;
 * subsequent calls are synchronous via cache.
 */
export async function getEmployeeHolidaySet(empName: string): Promise<Set<string>> {
  if (!empName) return new Set();
  if (cache.has(empName)) return cache.get(empName)!;
  let p = pending.get(empName);
  if (!p) {
    p = loadHolidaysForEmployee(empName).finally(() => pending.delete(empName));
    pending.set(empName, p);
  }
  await p;
  return cache.get(empName) || new Set();
}

/** Tooltip text for a given employee+date. Returns null if it's not a holiday. */
export function getEmployeeHolidayDescription(
  empName: string,
  dateStr: string,
): string | null {
  const m = descCache.get(empName);
  if (!m) return null;
  return m.get(dateStr) || null;
}

/** Drop the cache for an employee (or all if not specified). Useful after
 * the user updates the Holiday List in ERPNext and wants to refresh. */
export function clearEmployeeHolidayCache(empName?: string): void {
  if (empName) {
    cache.delete(empName);
    descCache.delete(empName);
    pending.delete(empName);
  } else {
    cache.clear();
    descCache.clear();
    pending.clear();
  }
}
