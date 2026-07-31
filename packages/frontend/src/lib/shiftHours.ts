/**
 * Shared shift hours utility — single source of truth for contract hours.
 *
 * Two paths to determine weekly hours:
 * 1. Shift Plan Assignment → Shift Plan → schedule with days/shift types → sum daily hours
 * 2. Shift Assignment → Shift Type → daily hours × 5 (fallback if no Shift Plan)
 *
 * Shift Plan Assignment is preferred because it knows the actual working days.
 * Employees without either are tracked in `missingEmployees`.
 */

import { fetchList, fetchDocument } from "./erpnext";

interface ShiftAssignment {
  name: string;
  employee: string;
  shift_type: string;
}

interface ShiftPlanAssignment {
  name: string;
  employee: string;
  shift_plan: string;
}

interface ShiftTypeDoc {
  name: string;
  start_time: string;
  end_time: string;
}

export interface ShiftHoursResult {
  /** employee ID → weekly hours */
  hoursMap: Record<string, number>;
  /** employee IDs with no shift data or unresolvable */
  missingEmployees: Set<string>;
}

/** Calculate hours between two HH:MM:SS time strings */
export function calcHoursFromTimes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60; // overnight shift
  return diff / 60;
}

/** Cache for Shift Type daily hours to avoid re-fetching */
const shiftTypeCache: Record<string, number | null> = {};

async function getShiftTypeHours(stName: string): Promise<number | null> {
  if (stName in shiftTypeCache) return shiftTypeCache[stName];
  try {
    const doc = await fetchDocument<ShiftTypeDoc>("Shift Type", stName);
    const hours = calcHoursFromTimes(doc.start_time, doc.end_time);
    shiftTypeCache[stName] = hours > 0 ? hours : null;
    return shiftTypeCache[stName];
  } catch {
    shiftTypeCache[stName] = null;
    return null;
  }
}

/**
 * Try to resolve weekly hours from a Shift Plan document.
 * A Shift Plan has a child table with day assignments, each referencing a Shift Type.
 * Weekly hours = sum of daily hours for each assigned day.
 */
async function resolveShiftPlanWeeklyHours(planName: string): Promise<number | null> {
  try {
    // Fetch the full Shift Plan document — field names vary across ERPNext versions
    const doc = await fetchDocument<Record<string, unknown>>("Shift Plan", planName);

    // Find the child table that contains day/shift_type entries
    // Common field names: shift_plan_detail, assignments, shift_details, plan_details
    let details: Array<{ day?: string; shift_type?: string }> = [];
    for (const value of Object.values(doc)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
        const first = value[0] as Record<string, unknown>;
        if ("shift_type" in first) {
          details = value as Array<{ day?: string; shift_type?: string }>;
          break;
        }
      }
    }

    if (details.length === 0) return null;

    // Sum up hours for each day in the plan
    let totalWeeklyHours = 0;
    for (const detail of details) {
      if (!detail.shift_type) continue;
      const dailyHours = await getShiftTypeHours(detail.shift_type);
      if (dailyHours !== null) {
        totalWeeklyHours += dailyHours;
      }
    }

    return totalWeeklyHours > 0 ? totalWeeklyHours : null;
  } catch {
    return null;
  }
}

/**
 * Fetch weekly contract hours for all employees.
 *
 * Priority:
 * 1. Shift Plan Assignment → Shift Plan → actual weekly schedule
 * 2. Shift Assignment → Shift Type → daily hours × 5
 * 3. Neither → missingEmployees
 */
export async function fetchShiftHoursMap(): Promise<ShiftHoursResult> {
  const missingEmployees = new Set<string>();
  const hoursMap: Record<string, number> = {};

  // Fetch both assignment types in parallel
  const [shiftAssignments, planAssignments] = await Promise.all([
    fetchList<ShiftAssignment>("Shift Assignment", {
      fields: ["name", "employee", "shift_type"],
      filters: [["status", "=", "Active"]],
      limit_page_length: 500,
    }).catch(() =>
      fetchList<ShiftAssignment>("Shift Assignment", {
        fields: ["name", "employee", "shift_type"],
        limit_page_length: 500,
      }).catch(() => [] as ShiftAssignment[]),
    ),
    fetchList<ShiftPlanAssignment>("Shift Plan Assignment", {
      fields: ["employee", "shift_plan"],
      limit_page_length: 500,
    }).catch(() => [] as ShiftPlanAssignment[]),
  ]);

  // Build Shift Plan Assignment map (employee → plan name)
  const planMap = new Map<string, string>();
  for (const spa of planAssignments) {
    if (spa.employee && spa.shift_plan) {
      planMap.set(spa.employee, spa.shift_plan);
    }
  }

  // Resolve unique Shift Plans → weekly hours
  const uniquePlans = [...new Set(planAssignments.map((a) => a.shift_plan).filter(Boolean))];
  const planHoursMap: Record<string, number | null> = {};
  await Promise.all(
    uniquePlans.map(async (planName) => {
      planHoursMap[planName] = await resolveShiftPlanWeeklyHours(planName);
    }),
  );

  // Track which employees are handled
  const handledEmployees = new Set<string>();

  // Priority 1: Shift Plan Assignment (knows actual working days)
  for (const spa of planAssignments) {
    if (!spa.employee || handledEmployees.has(spa.employee)) continue;
    const weeklyHours = planHoursMap[spa.shift_plan];
    if (weeklyHours !== null && weeklyHours !== undefined) {
      hoursMap[spa.employee] = weeklyHours;
      handledEmployees.add(spa.employee);
    }
  }

  // Priority 2: Shift Assignment (fallback, assumes 5-day week)
  for (const sa of shiftAssignments) {
    if (handledEmployees.has(sa.employee)) continue;
    const dailyHours = await getShiftTypeHours(sa.shift_type);
    if (dailyHours !== null) {
      hoursMap[sa.employee] = dailyHours * 5;
      handledEmployees.add(sa.employee);
    } else {
      missingEmployees.add(sa.employee);
      handledEmployees.add(sa.employee);
    }
  }

  return { hoursMap, missingEmployees };
}

/** Per-dag uren van één Shift Plan: {Monday: 8, ..., Friday: 4}. Leeg = onbekend. */
async function resolveShiftPlanDayHours(planName: string): Promise<Record<string, number>> {
  try {
    const doc = await fetchDocument<Record<string, unknown>>("Shift Plan", planName);
    let details: Array<{ day?: string; shift_type?: string }> = [];
    for (const value of Object.values(doc)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
        const first = value[0] as Record<string, unknown>;
        if ("shift_type" in first) {
          details = value as Array<{ day?: string; shift_type?: string }>;
          break;
        }
      }
    }
    const out: Record<string, number> = {};
    for (const detail of details) {
      if (!detail.day || !detail.shift_type) continue;
      const h = await getShiftTypeHours(detail.shift_type);
      if (h !== null) out[detail.day] = (out[detail.day] ?? 0) + h;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Per medewerker de werkelijke uren per weekdag uit hun Shift Plan
 * (repeat_on_days → shift_type → uren), bijv. {Monday:8,…,Friday:4} bij een
 * 36u-rooster met een korte vrijdag. Alleen medewerkers mét een Shift Plan
 * Assignment; anderen ontbreken (caller valt dan terug op weekuren/aantal-dagen).
 */
export async function fetchShiftDayHoursMap(): Promise<Record<string, Record<string, number>>> {
  const planAssignments = await fetchList<ShiftPlanAssignment>("Shift Plan Assignment", {
    fields: ["employee", "shift_plan"],
    limit_page_length: 500,
  }).catch(() => [] as ShiftPlanAssignment[]);

  const uniquePlans = [...new Set(planAssignments.map((a) => a.shift_plan).filter(Boolean))];
  const planDayHours: Record<string, Record<string, number>> = {};
  await Promise.all(
    uniquePlans.map(async (plan) => {
      planDayHours[plan] = await resolveShiftPlanDayHours(plan);
    }),
  );

  const result: Record<string, Record<string, number>> = {};
  for (const spa of planAssignments) {
    if (!spa.employee || !spa.shift_plan || result[spa.employee]) continue;
    const dh = planDayHours[spa.shift_plan];
    if (dh && Object.keys(dh).length > 0) result[spa.employee] = dh;
  }
  return result;
}

/**
 * Uren per weekdag voor één medewerker uit hun Shift Plan (bv. {…,Friday:4}).
 * Leeg als er geen Shift Plan Assignment is. Gebruikt door het verlofaanvraag-
 * formulier om een roosterdag van een halve dag automatisch te herkennen.
 */
export async function fetchEmployeeDayHours(employeeId: string): Promise<Record<string, number>> {
  if (!employeeId) return {};
  const assignments = await fetchList<ShiftPlanAssignment>("Shift Plan Assignment", {
    fields: ["shift_plan"],
    filters: [["employee", "=", employeeId]],
    limit_page_length: 1,
  }).catch(() => [] as ShiftPlanAssignment[]);
  const plan = assignments[0]?.shift_plan;
  if (!plan) return {};
  return resolveShiftPlanDayHours(plan);
}
