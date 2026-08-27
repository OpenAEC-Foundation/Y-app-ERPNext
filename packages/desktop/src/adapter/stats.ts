/**
 * Client-side aggregation for /api/stats/uren and /api/stats/uren/detail.
 *
 * The server-side endpoints no longer exist in the desktop (direct-Rust) build.
 * These helpers replicate the same logic by calling ERPNext directly via
 * `invoke("erpnext_request_with_creds", ...)`.
 */

import { invoke } from "@tauri-apps/api/core";

// ── Types ────────────────────────────────────────────────────────────────────

interface ErpParams {
  instanceId: number;
  instanceUrl: string;
  username: string;
  password: string;
}

interface InvokeResult {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export interface UrenStats {
  employeeMonthly: {
    employee: string;
    name: string;
    months: number[];
    billableMonths: number[];
    total: number;
    totalBillable: number;
  }[];
  projectMonthly: {
    project: string;
    name: string;
    months: number[];
    billableMonths: number[];
    total: number;
    totalBillable: number;
  }[];
  totalHours: number;
  totalBillable: number;
  billablePercent: number;
  monthTotalHours: number[];
  monthBillableHours: number[];
  monthBillablePercent: number[];
  bureauActivities: { activity: string; months: number[]; total: number }[];
}

export interface UrenDetail {
  employee: string;
  month: number;
  year: string;
  logs: {
    date: string;
    project: string;
    activity: string;
    hours: number;
    isBillable: boolean;
    description: string;
  }[];
  totalHours: number;
  billableHours: number;
  billablePercent: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Make a GET request to ERPNext via the Rust invoke layer (no fetch — avoids recursion). */
async function erpGet(params: ErpParams, path: string): Promise<Record<string, unknown>[]> {
  const result = await invoke<InvokeResult>("erpnext_request_with_creds", {
    instanceId: params.instanceId,
    instanceUrl: params.instanceUrl,
    username: params.username,
    password: params.password,
    method: "GET",
    path,
    body: null,
  });
  const parsed = JSON.parse(result.body);
  return (parsed?.data || []) as Record<string, unknown>[];
}

const CHUNK = 200;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Aggregate uren statistics for a given year (and optional company / employee
 * filter). Mirrors the logic of the Express `/api/stats/uren` route.
 */
export async function computeUrenStats(
  params: ErpParams,
  year: string,
  company: string,
  projEmployee: string,
): Promise<UrenStats> {
  // 1 — Employee → company map (for company filtering)
  const empData = await erpGet(params, `/api/resource/Employee?fields=["name","company"]&limit_page_length=0`);
  const empCompanyMap = new Map<string, string>();
  for (const emp of empData) {
    empCompanyMap.set(emp.name as string, (emp.company as string) || "");
  }

  // 2 — Timesheets for the year (submitted only)
  const tsFilters = encodeURIComponent(
    JSON.stringify([["docstatus", "=", 1], ["start_date", "like", `${year}%`]]),
  );
  let timesheets = await erpGet(
    params,
    `/api/resource/Timesheet?fields=["name","employee","employee_name","start_date","total_hours","docstatus"]&filters=${tsFilters}&limit_page_length=0&order_by=start_date+asc`,
  );

  // 3 — Filter by company
  if (company) {
    timesheets = timesheets.filter(
      (ts) => (empCompanyMap.get(ts.employee as string) || "") === company,
    );
  }

  // 4 — Projects for display names
  const projectDocs = await erpGet(
    params,
    `/api/resource/Project?fields=["name","project_name"]&limit_page_length=0`,
  );
  const projNameMap = new Map<string, string>();
  for (const p of projectDocs) {
    projNameMap.set(p.name as string, (p.project_name as string) || (p.name as string));
  }

  // Accumulator maps
  const empMap = new Map<
    string,
    { employee: string; name: string; months: number[]; billableMonths: number[]; total: number; totalBillable: number }
  >();
  const projMap = new Map<
    string,
    { project: string; name: string; months: number[]; billableMonths: number[]; total: number; totalBillable: number }
  >();
  const activityMap = new Map<string, { activity: string; months: number[]; total: number }>();
  let totalHours = 0;
  let totalBillable = 0;
  const monthTotalHours = new Array(12).fill(0) as number[];
  const monthBillableHours = new Array(12).fill(0) as number[];

  // Step 1 — walk parent timesheets for roll-up totals + metadata
  interface TsMeta { employee: string; monthIdx: number }
  const tsByName = new Map<string, TsMeta>();

  for (const ts of timesheets) {
    const emp = ts.employee as string;
    const empName = (ts.employee_name as string) || emp;
    const monthIdx = parseInt((ts.start_date as string).slice(5, 7), 10) - 1;
    tsByName.set(ts.name as string, { employee: emp, monthIdx });

    if (!empMap.has(emp)) {
      empMap.set(emp, {
        employee: emp,
        name: empName,
        months: new Array(12).fill(0),
        billableMonths: new Array(12).fill(0),
        total: 0,
        totalBillable: 0,
      });
    }
    const empEntry = empMap.get(emp)!;
    const hrs = (ts.total_hours as number) || 0;
    empEntry.months[monthIdx] += hrs;
    empEntry.total += hrs;
    totalHours += hrs;
    monthTotalHours[monthIdx] += hrs;
  }

  // Step 2 — batch-fetch Timesheet Detail rows (chunked at 200)
  const tsNames = Array.from(tsByName.keys());
  const allDetails: Record<string, unknown>[] = [];

  for (let i = 0; i < tsNames.length; i += CHUNK) {
    const chunk = tsNames.slice(i, i + CHUNK);
    try {
      const detailFilters = encodeURIComponent(JSON.stringify([["parent", "in", chunk]]));
      const detailFields = encodeURIComponent(
        JSON.stringify(["parent", "hours", "is_billable", "project", "activity_type"]),
      );
      const rows = await erpGet(
        params,
        `/api/resource/Timesheet Detail?fields=${detailFields}&filters=${detailFilters}&limit_page_length=0`,
      );
      allDetails.push(...rows);
    } catch (err) {
      console.warn(
        `[stats/uren] Timesheet Detail chunk ${i}–${i + chunk.length} failed:`,
        (err as Error).message,
      );
    }
  }

  // Step 3 — aggregate detail rows
  for (const log of allDetails) {
    const ts = tsByName.get(log.parent as string);
    if (!ts) continue;

    const empEntry = empMap.get(ts.employee);
    if (!empEntry) continue;

    const hours = (log.hours as number) || 0;
    const isBillable = !!(log.is_billable);
    const proj = (log.project as string) || "(geen project)";

    if (isBillable) {
      empEntry.billableMonths[ts.monthIdx] += hours;
      empEntry.totalBillable += hours;
      totalBillable += hours;
      monthBillableHours[ts.monthIdx] += hours;
    } else {
      const activity = (log.activity_type as string) || "(geen activiteit)";
      if (!activityMap.has(activity)) {
        activityMap.set(activity, { activity, months: new Array(12).fill(0), total: 0 });
      }
      const actEntry = activityMap.get(activity)!;
      actEntry.months[ts.monthIdx] += hours;
      actEntry.total += hours;
    }

    if (!projEmployee || ts.employee === projEmployee) {
      if (!projMap.has(proj)) {
        const projDisplayName = projNameMap.has(proj)
          ? `${proj} — ${projNameMap.get(proj)}`
          : proj;
        projMap.set(proj, {
          project: proj,
          name: projDisplayName,
          months: new Array(12).fill(0),
          billableMonths: new Array(12).fill(0),
          total: 0,
          totalBillable: 0,
        });
      }
      const projEntry = projMap.get(proj)!;
      projEntry.months[ts.monthIdx] += hours;
      projEntry.total += hours;
      if (isBillable) {
        projEntry.billableMonths[ts.monthIdx] += hours;
        projEntry.totalBillable += hours;
      }
    }
  }

  const monthBillablePercent = monthTotalHours.map((t, i) =>
    t > 0 ? Math.round((monthBillableHours[i] / t) * 100) : 0,
  );

  return {
    employeeMonthly: Array.from(empMap.values()).sort((a, b) => b.total - a.total),
    projectMonthly: Array.from(projMap.values()).sort((a, b) => b.total - a.total),
    totalHours,
    totalBillable,
    billablePercent: totalHours > 0 ? Math.round((totalBillable / totalHours) * 100) : 0,
    monthTotalHours,
    monthBillableHours,
    monthBillablePercent,
    bureauActivities: Array.from(activityMap.values()).sort((a, b) => b.total - a.total),
  };
}

/**
 * Return individual time-log rows for a specific employee + month.
 * Mirrors the logic of the Express `/api/stats/uren/detail` route.
 */
export async function computeUrenDetail(
  params: ErpParams,
  year: string,
  month: number,
  employee: string,
): Promise<UrenDetail> {
  const monthStr = String(month + 1).padStart(2, "0");
  const tsFilters = encodeURIComponent(
    JSON.stringify([
      ["docstatus", "=", 1],
      ["employee", "=", employee],
      ["start_date", "like", `${year}-${monthStr}%`],
    ]),
  );
  const timesheets = await erpGet(
    params,
    `/api/resource/Timesheet?fields=["name","employee","employee_name","start_date","total_hours","docstatus"]&filters=${tsFilters}&limit_page_length=0`,
  );

  // Project name lookup
  const projectDocs = await erpGet(
    params,
    `/api/resource/Project?fields=["name","project_name"]&limit_page_length=0`,
  );
  const projNameMap = new Map<string, string>();
  for (const p of projectDocs) {
    projNameMap.set(p.name as string, (p.project_name as string) || (p.name as string));
  }

  // parent → start_date fallback for rows without from_time
  const tsStartDate = new Map<string, string>();
  for (const ts of timesheets) {
    tsStartDate.set(ts.name as string, ts.start_date as string);
  }

  // Batch-fetch detail rows
  const tsNames = Array.from(tsStartDate.keys());
  const allDetails: Record<string, unknown>[] = [];

  for (let i = 0; i < tsNames.length; i += CHUNK) {
    const chunk = tsNames.slice(i, i + CHUNK);
    try {
      const detailFilters = encodeURIComponent(JSON.stringify([["parent", "in", chunk]]));
      const detailFields = encodeURIComponent(
        JSON.stringify(["parent", "from_time", "project", "activity_type", "hours", "is_billable", "description"]),
      );
      const rows = await erpGet(
        params,
        `/api/resource/Timesheet Detail?fields=${detailFields}&filters=${detailFilters}&limit_page_length=0`,
      );
      allDetails.push(...rows);
    } catch (err) {
      console.warn(
        `[stats/uren/detail] Timesheet Detail chunk ${i}–${i + chunk.length} failed:`,
        (err as Error).message,
      );
    }
  }

  const logs: UrenDetail["logs"] = [];

  for (const log of allDetails) {
    const parent = log.parent as string;
    const projId = (log.project as string) || "";
    const projName = projId ? projNameMap.get(projId) : undefined;
    const projDisplay = projName ? `${projId} — ${projName}` : projId;
    const fromTime = log.from_time as string | undefined;
    logs.push({
      date: fromTime?.split(" ")[0] || tsStartDate.get(parent) || "",
      project: projDisplay,
      activity: (log.activity_type as string) || "",
      hours: (log.hours as number) || 0,
      isBillable: !!(log.is_billable),
      description: (log.description as string) || "",
    });
  }

  logs.sort((a, b) => a.date.localeCompare(b.date));

  const totalHours = logs.reduce((s, l) => s + l.hours, 0);
  const billableHours = logs.filter((l) => l.isBillable).reduce((s, l) => s + l.hours, 0);

  return {
    employee,
    month,
    year,
    logs,
    totalHours,
    billableHours,
    billablePercent: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0,
  };
}
