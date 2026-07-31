/**
 * Detect, per employee, which workdays in a date range have no booking.
 *
 * `kind = "hours"` checks for Timesheet → time_logs entries (default).
 * `kind = "km"`    checks for Travel Request → itinerary entries.
 *
 * Workdays come EXCLUSIVELY from the employee's active Shift Plan Assignment
 * → Shift Plan → repeat_on_days. Employees without a Shift Plan are skipped.
 *
 * Days excluded:
 *   - The employee's Holiday List in ERPNext (Employee.holiday_list, or
 *     Company.default_holiday_list as fallback) — see lib/employeeHolidays.ts
 *   - Dutch national holidays as a last-resort fallback (lib/holidays.ts)
 *   - Days before the employee's date_of_joining
 *   - Days where a Timesheet Detail / Travel Request itinerary row exists
 *   - Days covered by an approved (docstatus=1) Leave Application
 */

import { fetchAll, fetchDocument } from "./erpnext";
import { isHoliday } from "./holidays";
import { getEmployeeHolidaySet } from "./employeeHolidays";

const DAY_NAMES_EN = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export type MissingKind = "hours" | "km";

export interface MissingDay {
  /** YYYY-MM-DD */
  date: string;
  /** English day name (e.g. "Monday") */
  dayName: string;
}

export interface MissingDaysResult {
  /** employee ID → ordered list of missing dates */
  missing: Map<string, MissingDay[]>;
}

interface EmployeeLite {
  name: string;
  date_of_joining?: string;
}

function fmtIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Build per-employee workday sets from Shift Plan Assignment + Shift Plan.
 * Employees without an active Shift Plan are omitted from the returned map.
 *
 * Exported so other places (e.g. Goedkeuren delta calc) can share the same
 * source of truth for "which days does this employee actually work?".
 */
export async function fetchEmployeeShiftWorkdays(
  employeeIds: string[],
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (employeeIds.length === 0) return result;

  let assignments: { employee: string; shift_plan: string }[] = [];
  try {
    assignments = await fetchAll<{ employee: string; shift_plan: string }>(
      "Shift Plan Assignment",
      ["employee", "shift_plan"],
      [["employee", "in", employeeIds]],
    );
  } catch { /* fall through */ }

  const planByEmployee = new Map<string, string>();
  for (const a of assignments) {
    if (a.employee && a.shift_plan && !planByEmployee.has(a.employee)) {
      planByEmployee.set(a.employee, a.shift_plan);
    }
  }

  const uniquePlans = [...new Set(planByEmployee.values())];
  const planDays = new Map<string, Set<string>>();
  await Promise.all(
    uniquePlans.map(async (plan) => {
      try {
        const doc = await fetchDocument<{ repeat_on_days?: { day: string }[] }>("Shift Plan", plan);
        if (doc.repeat_on_days?.length) {
          planDays.set(plan, new Set(doc.repeat_on_days.map((d) => d.day)));
        }
      } catch { /* ignore */ }
    }),
  );

  for (const empId of employeeIds) {
    const plan = planByEmployee.get(empId);
    if (!plan) continue;
    const days = planDays.get(plan);
    if (days && days.size > 0) result.set(empId, days);
  }
  return result;
}

/**
 * For each employee, return the list of workdays in [from, to] with no
 * Timesheet (kind="hours") or Travel Request itinerary (kind="km") entry.
 */
export async function fetchMissingDaysForEmployees(
  employees: EmployeeLite[],
  from: Date,
  to: Date,
  kind: MissingKind = "hours",
): Promise<MissingDaysResult> {
  const DBG = (...args: unknown[]) => console.log(`[missing-${kind}]`, ...args);
  const missing = new Map<string, MissingDay[]>();
  if (employees.length === 0) return { missing };

  const employeeIds = employees.map((e) => e.name);
  DBG("range", fmtIso(from), "→", fmtIso(to), "employees:", employeeIds.length);

  const workdaysMap = await fetchEmployeeShiftWorkdays(employeeIds);

  const fromStr = fmtIso(from);
  const toStr = fmtIso(to);

  // Approved leaves
  const onLeave = new Set<string>();
  try {
    const leaves = await fetchAll<{ employee: string; from_date: string; to_date: string }>(
      "Leave Application",
      ["employee", "from_date", "to_date"],
      [
        ["employee", "in", employeeIds],
        ["from_date", "<=", toStr],
        ["to_date", ">=", fromStr],
        ["docstatus", "=", 1],
      ],
    );
    for (const lv of leaves) {
      if (!lv.employee || !lv.from_date || !lv.to_date) continue;
      const lvFrom = new Date(lv.from_date + "T12:00:00");
      const lvTo = new Date(lv.to_date + "T12:00:00");
      if (isNaN(lvFrom.getTime()) || isNaN(lvTo.getTime())) continue;
      const cur = new Date(lvFrom);
      while (cur <= lvTo) {
        onLeave.add(`${lv.employee}|${fmtIso(cur)}`);
        cur.setDate(cur.getDate() + 1);
      }
    }
  } catch (e) { DBG("leave fetch error", e); }

  // Booked-set: per-day index of (employee, date) with a booking.
  const booked = new Set<string>();
  if (kind === "hours") {
    let timesheets: { name: string; employee: string }[] = [];
    try {
      timesheets = await fetchAll<{ name: string; employee: string }>(
        "Timesheet",
        ["name", "employee"],
        [
          ["employee", "in", employeeIds],
          ["start_date", "<=", toStr],
          ["end_date", ">=", fromStr],
          ["docstatus", "!=", 2],
        ],
      );
    } catch (e) { DBG("timesheet fetch error", e); }
    const tsToEmp = new Map<string, string>();
    for (const ts of timesheets) tsToEmp.set(ts.name, ts.employee);
    if (timesheets.length > 0) {
      const CHUNK = 20;
      for (let i = 0; i < timesheets.length; i += CHUNK) {
        const chunk = timesheets.slice(i, i + CHUNK);
        const docs = await Promise.all(
          chunk.map((ts) =>
            fetchDocument<{ employee: string; time_logs?: { from_time?: string; hours?: number }[] }>(
              "Timesheet", ts.name,
            ).catch(() => null),
          ),
        );
        for (let j = 0; j < docs.length; j++) {
          const doc = docs[j];
          if (!doc) continue;
          const emp = doc.employee || tsToEmp.get(chunk[j].name);
          if (!emp) continue;
          for (const log of doc.time_logs || []) {
            if (!log.from_time) continue;
            const day = log.from_time.includes("T")
              ? log.from_time.split("T")[0]
              : log.from_time.split(" ")[0];
            if (day) booked.add(`${emp}|${day}`);
          }
        }
      }
    }
  } else {
    let trs: { name: string; employee: string }[] = [];
    try {
      trs = await fetchAll<{ name: string; employee: string }>(
        "Travel Request",
        ["name", "employee"],
        [
          ["employee", "in", employeeIds],
          ["custom_from_date", "<=", toStr],
          ["custom_to_date", ">=", fromStr],
          ["docstatus", "!=", 2],
        ],
      );
    } catch (e) { DBG("travel request fetch error", e); }
    const trToEmp = new Map<string, string>();
    for (const tr of trs) trToEmp.set(tr.name, tr.employee);
    if (trs.length > 0) {
      const CHUNK = 20;
      for (let i = 0; i < trs.length; i += CHUNK) {
        const chunk = trs.slice(i, i + CHUNK);
        const docs = await Promise.all(
          chunk.map((tr) =>
            fetchDocument<{ employee: string; itinerary?: { departure_date?: string; custom_distance?: number }[] }>(
              "Travel Request", tr.name,
            ).catch(() => null),
          ),
        );
        for (let j = 0; j < docs.length; j++) {
          const doc = docs[j];
          if (!doc) continue;
          const emp = doc.employee || trToEmp.get(chunk[j].name);
          if (!emp) continue;
          for (const row of doc.itinerary || []) {
            if (!row.departure_date) continue;
            const day = row.departure_date.includes("T")
              ? row.departure_date.split("T")[0]
              : row.departure_date.split(" ")[0];
            if (day) booked.add(`${emp}|${day}`);
          }
        }
      }
    }
  }

  // Per-employee Holiday List
  const empHolidaySets = new Map<string, Set<string>>();
  await Promise.all(
    employees.map(async (emp) => {
      try { empHolidaySets.set(emp.name, await getEmployeeHolidaySet(emp.name)); }
      catch { /* ignore */ }
    }),
  );

  // Iterate
  for (const emp of employees) {
    const workdays = workdaysMap.get(emp.name);
    if (!workdays) continue;
    const empHolidays = empHolidaySets.get(emp.name) || new Set<string>();
    const joinDate = emp.date_of_joining ? new Date(emp.date_of_joining + "T12:00:00") : null;
    const list: MissingDay[] = [];
    const cur = new Date(from);
    while (cur <= to) {
      const dateStr = fmtIso(cur);
      const dayName = DAY_NAMES_EN[cur.getDay()];
      const beforeJoin = joinDate && cur < joinDate;
      const isWorkday = workdays.has(dayName);
      const holiday = empHolidays.has(dateStr) || isHoliday(dateStr, cur.getFullYear());
      const hasBooking = booked.has(`${emp.name}|${dateStr}`);
      const onLeaveDay = onLeave.has(`${emp.name}|${dateStr}`);
      if (!beforeJoin && isWorkday && !holiday && !hasBooking && !onLeaveDay) {
        list.push({ date: dateStr, dayName });
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (list.length > 0) missing.set(emp.name, list);
  }

  return { missing };
}
