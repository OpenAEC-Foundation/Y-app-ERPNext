import { getActiveContractHours } from "./instances";

export interface TimesheetDetail {
  name: string;
  parent: string;
  activity_type: string;
  hours: number;
  project: string;
  from_time: string;
  task: string;
  task_name?: string;
  description?: string;
  billable?: number;
  /** docstatus of the parent Timesheet (0 = Draft, 1 = Submitted, 2 = Cancelled).
   * Submitted timesheets can't have their time_logs child rows edited/deleted
   * without cancel+amend in ERPNext — used to disable those actions in the UI
   * instead of letting the update silently fail. */
  parent_docstatus?: number;
}

export interface ValidationWarning {
  type: "company_mismatch" | "no_project" | "no_task" | "no_activity_type" | "wrong_activity_type" | "long_block" | "hours_deviation";
  message: string;
  detail?: string;
}

export interface DetailHighlights {
  activity_type?: string;
  project?: string;
  task?: string;
  hours?: string;
  from_time?: string;
}

export const WARN_HL = "bg-amber-100";
export const ERR_HL = "bg-red-100";

export const warningTypeLabels: Record<ValidationWarning["type"], { label: string; color: string }> = {
  company_mismatch: { label: "Bedrijf mismatch", color: "bg-red-100 text-red-800" },
  no_project: { label: "Geen project", color: "bg-amber-100 text-amber-800" },
  no_task: { label: "Geen taak", color: "bg-amber-100 text-amber-800" },
  no_activity_type: { label: "Geen activiteit", color: "bg-red-100 text-red-800" },
  wrong_activity_type: { label: "Verkeerd type", color: "bg-amber-100 text-amber-800" },
  long_block: { label: "Lang blok", color: "bg-amber-100 text-amber-800" },
  hours_deviation: { label: "Uren afwijking", color: "bg-amber-100 text-amber-800" },
};

export interface TimesheetHeader {
  name: string;
  employee: string;
  employee_name: string;
  total_hours: number;
  start_date: string;
  end_date: string;
  company: string | null;
}

export interface ProjectInfo {
  name: string;
  company: string;
  project_name: string;
}

/**
 * Resolve the expected activity type for an employee.
 * Priority: per-employee map → ERPNext default_activity_type → global fallback.
 */
export function resolveDefaultActivityType(
  employeeId: string | undefined,
  employeeActivityTypes?: Record<string, string>,
  globalDefault?: string,
): string | undefined {
  if (employeeId && employeeActivityTypes?.[employeeId]) {
    return employeeActivityTypes[employeeId];
  }
  return globalDefault;
}

/**
 * Run validation checks on a timesheet and its details.
 * Returns a list of warnings.
 */
export function runTimesheetValidation(
  ts: TimesheetHeader,
  details: TimesheetDetail[],
  employeeCompany: string | undefined,
  defaultActivityType: string | undefined,
  projects: ProjectInfo[],
  employeeActivityTypes?: Record<string, string>,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const projectMap = new Map(projects.map((p) => [p.name, p]));
  const expectedType = resolveDefaultActivityType(ts.employee, employeeActivityTypes, defaultActivityType);

  for (const d of details) {
    // company_mismatch: detail project company != employee company (skip 0000-projects)
    if (d.project && employeeCompany && !d.project.startsWith("0000")) {
      const proj = projectMap.get(d.project);
      if (proj && proj.company && proj.company !== employeeCompany) {
        warnings.push({
          type: "company_mismatch",
          message: `Project ${d.project} hoort bij ${proj.company}, medewerker bij ${employeeCompany}`,
          detail: d.name,
        });
      }
    }

    // no_project
    if (!d.project) {
      warnings.push({
        type: "no_project",
        message: `Regel ${d.name} heeft geen project`,
        detail: d.name,
      });
    }

    // no_task
    if (!d.task) {
      warnings.push({
        type: "no_task",
        message: `Regel ${d.name} heeft geen taak`,
        detail: d.name,
      });
    }

    // no_activity_type
    if (!d.activity_type) {
      warnings.push({
        type: "no_activity_type",
        message: `Regel ${d.name} heeft geen activiteitstype`,
        detail: d.name,
      });
    }

    // wrong_activity_type: compare against employee-specific default
    if (d.activity_type && expectedType && d.activity_type !== expectedType) {
      warnings.push({
        type: "wrong_activity_type",
        message: `Regel ${d.name} gebruikt "${d.activity_type}" i.p.v. "${expectedType}"`,
        detail: d.name,
      });
    }

    // long_block
    if (d.hours > 4) {
      warnings.push({
        type: "long_block",
        message: `Regel ${d.name} is ${d.hours} uur (> 4 uur)`,
        detail: d.name,
      });
    }
  }

  // hours_deviation: total hours differs from expected
  const contractHours = getActiveContractHours();
  if (contractHours !== null) {
    // Calculate expected hours based on number of workdays in the timesheet period
    const start = new Date(ts.start_date + "T12:00:00");
    const end = new Date(ts.end_date + "T12:00:00");
    let workdays = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day >= 1 && day <= 5) workdays++;
      cur.setDate(cur.getDate() + 1);
    }
    const dailyHours = contractHours / 5;
    const expectedHours = workdays * dailyHours;
    const deviation = Math.abs(ts.total_hours - expectedHours);
    if (deviation > 0.5) {
      warnings.push({
        type: "hours_deviation",
        message: `Totaal ${ts.total_hours}u, verwacht ${expectedHours.toFixed(1)}u (${contractHours}u/week, ${workdays} werkdagen)`,
      });
    }
  }

  return warnings;
}

/**
 * Get per-cell highlight classes for each detail row.
 * Returns a Map keyed by detail name.
 */
export function getDetailHighlights(
  details: TimesheetDetail[],
  employeeCompany: string | undefined,
  defaultActivityType: string | undefined,
  projects: ProjectInfo[],
  employeeId?: string,
  employeeActivityTypes?: Record<string, string>,
): Map<string, DetailHighlights> {
  const result = new Map<string, DetailHighlights>();
  const projectMap = new Map(projects.map((p) => [p.name, p]));
  const expectedType = resolveDefaultActivityType(employeeId, employeeActivityTypes, defaultActivityType);

  for (const d of details) {
    const hl: DetailHighlights = {};

    // activity_type highlighting
    if (!d.activity_type) {
      hl.activity_type = ERR_HL;
    } else if (expectedType && d.activity_type !== expectedType) {
      hl.activity_type = WARN_HL;
    }

    // project highlighting (skip 0000-projects for company mismatch)
    if (!d.project) {
      hl.project = WARN_HL;
    } else if (employeeCompany && !d.project.startsWith("0000")) {
      const proj = projectMap.get(d.project);
      if (proj && proj.company && proj.company !== employeeCompany) {
        hl.project = ERR_HL;
      }
    }

    // task highlighting
    if (!d.task) {
      hl.task = WARN_HL;
    }

    // hours highlighting
    if (d.hours > 4) {
      hl.hours = WARN_HL;
    }

    if (Object.keys(hl).length > 0) {
      result.set(d.name, hl);
    }
  }

  return result;
}
