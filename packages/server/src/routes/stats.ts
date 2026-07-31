/**
 * Y-app — Hours (uren) stats routes
 *
 * Extracted verbatim from index.ts. Pre-computed uren statistics
 * (employee monthly, project monthly, billable %) plus the per-employee
 * per-month detail view.
 */

import type { Request, Response } from "express";
import { proxyRequest } from "../erpnext-client.ts";

/* ─── Stats: GET /api/stats/uren ─── */
// Pre-computed uren statistics: employee monthly, project monthly, billable %
interface UrenStatsCache {
  data: {
    employeeMonthly: { employee: string; name: string; months: number[]; billableMonths: number[]; total: number; totalBillable: number }[];
    projectMonthly: { project: string; name: string; months: number[]; billableMonths: number[]; total: number; totalBillable: number }[];
    totalHours: number;
    totalBillable: number;
    billablePercent: number;
  };
  ts: number;
}
const urenStatsCache = new Map<string, UrenStatsCache>();
const UREN_STATS_TTL = 5 * 60_000; // 5 min

export async function statsUren(req: Request, res: Response) {
  const sid = (req as any).erpnextSid;
  const instanceId = (req as any).instanceId as number;
  const year = req.query.year as string || new Date().getFullYear().toString();
  const projEmployee = req.query.projEmployee as string || "";
  const company = req.query.company as string || "";
  // Cache key MUST include `instanceId` — without it, two Y-app users on
  // different ERPNext instances querying the same year would share a
  // single cache entry, leaking one tenant's hours/employees/projects
  // to the other for up to UREN_STATS_TTL. Also includes `company`
  // because the result is filtered by it below; otherwise a query for
  // company A would return a cached result for company B (or "all").
  const cacheKey = `${instanceId}::${year}:${company}:${projEmployee}`;

  // Return cached if fresh
  const cached = urenStatsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < UREN_STATS_TTL) {
    return res.json(cached.data);
  }

  try {
    // Build employee → company map for filtering

    // Fetch employees for company filtering
    const empResult = await proxyRequest(sid, `/api/resource/Employee?fields=["name","company"]&limit_page_length=0`, "GET");
    const empData = JSON.parse(empResult.body)?.data || [];
    const empCompanyMap = new Map<string, string>();
    for (const emp of empData) {
      empCompanyMap.set(emp.name as string, emp.company as string || "");
    }

    // Fetch timesheets for the year
    const tsFilters = JSON.stringify([["docstatus", "=", 1], ["start_date", "like", `${year}%`]]);
    const tsResult = await proxyRequest(sid, `/api/resource/Timesheet?fields=["name","employee","employee_name","start_date","total_hours","docstatus"]&filters=${encodeURIComponent(tsFilters)}&limit_page_length=0&order_by=start_date+asc`, "GET");
    let timesheets = (JSON.parse(tsResult.body)?.data || []) as Record<string, unknown>[];

    // Filter by company if specified
    if (company) {
      timesheets = timesheets.filter(ts => {
        const empCompany = empCompanyMap.get(ts.employee as string) || "";
        return empCompany === company;
      });
    }

    // Fetch time_logs from individual timesheets in parallel batches
    const empMap = new Map<string, { employee: string; name: string; months: number[]; billableMonths: number[]; total: number; totalBillable: number }>();
    const projMap = new Map<string, { project: string; name: string; months: number[]; billableMonths: number[]; total: number; totalBillable: number }>();
    let totalHours = 0, totalBillable = 0;
    // Per-month totals for billable percentage
    const monthTotalHours = new Array(12).fill(0);
    const monthBillableHours = new Array(12).fill(0);
    // Bureau Algemeen: non-billable hours by activity type
    const activityMap = new Map<string, { activity: string; months: number[]; total: number }>();

    // Fetch projects for display names
    const projResult = await proxyRequest(sid, `/api/resource/Project?fields=["name","project_name"]&limit_page_length=0`, "GET");
    const projectDocs = (JSON.parse(projResult.body)?.data || []) as Record<string, unknown>[];
    const projNameMap = new Map<string, string>();
    for (const p of projectDocs) {
      projNameMap.set(p.name as string, p.project_name as string || p.name as string);
    }

    // Step 1 — timesheet-level totals.
    //
    // Walk the parent timesheets exactly once to populate empMap with the
    // total_hours roll-up. Also build a parent → metadata lookup so the
    // detail-row pass below can join back to employee + month index
    // without re-fetching anything.
    interface TsMeta { employee: string; monthIdx: number; }
    const tsByName = new Map<string, TsMeta>();
    for (const ts of timesheets) {
      const emp = ts.employee as string;
      const empName = ts.employee_name as string;
      const monthIdx = parseInt((ts.start_date as string).slice(5, 7)) - 1;
      tsByName.set(ts.name as string, { employee: emp, monthIdx });

      if (!empMap.has(emp)) {
        empMap.set(emp, { employee: emp, name: empName, months: new Array(12).fill(0), billableMonths: new Array(12).fill(0), total: 0, totalBillable: 0 });
      }
      const empEntry = empMap.get(emp)!;
      empEntry.months[monthIdx] += (ts.total_hours as number) || 0;
      empEntry.total += (ts.total_hours as number) || 0;
      totalHours += (ts.total_hours as number) || 0;
      monthTotalHours[monthIdx] += (ts.total_hours as number) || 0;
    }

    // Step 2 — ONE batched fetch for every Timesheet Detail row owned by
    // those parents, replacing the old fetchDocument-per-timesheet loop
    // (was 1 + N round-trips per stats query). Chunked at 200 names per
    // request so the IN filter URL stays under 8KB even for users with
    // thousands of timesheets in a year. Each chunk is wrapped in
    // try/catch so a single ERPNext hiccup degrades the same way the old
    // Promise.allSettled loop did — partial data, not a 500.
    const tsNames = Array.from(tsByName.keys());
    const allDetails: Record<string, unknown>[] = [];
    const CHUNK = 200;
    for (let i = 0; i < tsNames.length; i += CHUNK) {
      const chunk = tsNames.slice(i, i + CHUNK);
      try {
        const detailFilters = JSON.stringify([["parent", "in", chunk]]);
        const detailFields = JSON.stringify(["parent", "hours", "is_billable", "project", "activity_type"]);
        const detailResult = await proxyRequest(
          sid,
          `/api/resource/Timesheet Detail?fields=${encodeURIComponent(detailFields)}&filters=${encodeURIComponent(detailFilters)}&limit_page_length=0`,
          "GET",
        );
        const data = (JSON.parse(detailResult.body)?.data || []) as Record<string, unknown>[];
        allDetails.push(...data);
      } catch (err) {
        console.warn(`[stats/uren] Timesheet Detail chunk ${i}-${i + chunk.length} failed:`, (err as Error).message);
        // Skip this chunk; remaining stats will be incomplete by exactly
        // these timesheets, same partial-degradation as the old loop.
      }
    }

    // Step 3 — aggregate detail rows into project / activity / billable
    // buckets. Joins back to the parent metadata via tsByName.
    for (const log of allDetails) {
      const parent = log.parent as string;
      const ts = tsByName.get(parent);
      if (!ts) continue; // defensive: row whose parent wasn't in the filtered list
      const empEntry = empMap.get(ts.employee)!;
      const hours = (log.hours as number) || 0;
      const isBillable = (log.is_billable as number) || 0;
      const proj = (log.project as string) || "(geen project)";

      if (isBillable) {
        empEntry.billableMonths[ts.monthIdx] += hours;
        empEntry.totalBillable += hours;
        totalBillable += hours;
        monthBillableHours[ts.monthIdx] += hours;
      } else {
        // Track non-billable by activity type
        const activity = (log.activity_type as string) || "(geen activiteit)";
        if (!activityMap.has(activity)) {
          activityMap.set(activity, { activity, months: new Array(12).fill(0), total: 0 });
        }
        const actEntry = activityMap.get(activity)!;
        actEntry.months[ts.monthIdx] += hours;
        actEntry.total += hours;
      }

      // Only include in projMap if no employee filter, or employee matches
      if (!projEmployee || ts.employee === projEmployee) {
        if (!projMap.has(proj)) {
          const projDisplayName = projNameMap.get(proj) ? `${proj} — ${projNameMap.get(proj)}` : proj;
          projMap.set(proj, { project: proj, name: projDisplayName, months: new Array(12).fill(0), billableMonths: new Array(12).fill(0), total: 0, totalBillable: 0 });
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

    const monthBillablePercent = monthTotalHours.map((t: number, i: number) => t > 0 ? Math.round((monthBillableHours[i] / t) * 100) : 0);

    const data = {
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

    urenStatsCache.set(cacheKey, { data, ts: Date.now() });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

/* ─── Stats: GET /api/stats/uren/detail ─── */
// Detail view: individual time_logs for a specific employee + month
export async function statsUrenDetail(req: Request, res: Response) {
  const sid = (req as any).erpnextSid;
  const year = req.query.year as string || new Date().getFullYear().toString();
  const month = parseInt(req.query.month as string || "0", 10); // 0-based
  const employee = req.query.employee as string;

  if (!employee) return res.status(400).json({ error: "Missing employee parameter" });

  try {
    const monthStr = String(month + 1).padStart(2, "0");
    const tsFilters = JSON.stringify([["docstatus", "=", 1], ["employee", "=", employee], ["start_date", "like", `${year}-${monthStr}%`]]);
    const tsResult = await proxyRequest(sid, `/api/resource/Timesheet?fields=["name","employee","employee_name","start_date","total_hours","docstatus"]&filters=${encodeURIComponent(tsFilters)}&limit_page_length=0`, "GET");
    const timesheets = (JSON.parse(tsResult.body)?.data || []) as Record<string, unknown>[];

    // Build project name lookup
    const projResult = await proxyRequest(sid, `/api/resource/Project?fields=["name","project_name"]&limit_page_length=0`, "GET");
    const projectDocs = (JSON.parse(projResult.body)?.data || []) as Record<string, unknown>[];
    const projNameMap = new Map<string, string>();
    for (const p of projectDocs) {
      projNameMap.set(p.name as string, p.project_name as string || p.name as string);
    }

    const logs: { date: string; project: string; activity: string; hours: number; isBillable: boolean; description: string }[] = [];

    // parent → start_date lookup, used as date fallback when a detail
    // row has no from_time set.
    const tsStartDate = new Map<string, string>();
    for (const ts of timesheets) {
      tsStartDate.set(ts.name as string, ts.start_date as string);
    }

    // ONE batched fetch for every Timesheet Detail row owned by those
    // parents (chunked at 200 names per request to stay under URL length
    // limits), replacing the old fetchDocument-per-timesheet loop.
    const tsNames = Array.from(tsStartDate.keys());
    const allDetails: Record<string, unknown>[] = [];
    const CHUNK = 200;
    for (let i = 0; i < tsNames.length; i += CHUNK) {
      const chunk = tsNames.slice(i, i + CHUNK);
      try {
        const detailFilters = JSON.stringify([["parent", "in", chunk]]);
        const detailFields = JSON.stringify(["parent", "from_time", "project", "activity_type", "hours", "is_billable", "description"]);
        const detailResult = await proxyRequest(
          sid,
          `/api/resource/Timesheet Detail?fields=${encodeURIComponent(detailFields)}&filters=${encodeURIComponent(detailFilters)}&limit_page_length=0`,
          "GET",
        );
        const data = (JSON.parse(detailResult.body)?.data || []) as Record<string, unknown>[];
        allDetails.push(...data);
      } catch (err) {
        console.warn(`[stats/uren/detail] Timesheet Detail chunk ${i}-${i + chunk.length} failed:`, (err as Error).message);
      }
    }

    for (const log of allDetails) {
      const parent = log.parent as string;
      const projId = (log.project as string) || "";
      const projName = projId ? projNameMap.get(projId) : "";
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
    const billableHours = logs.filter(l => l.isBillable).reduce((s, l) => s + l.hours, 0);

    res.json({
      employee,
      month,
      year,
      logs,
      totalHours,
      billableHours,
      billablePercent: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
