import { useEffect, useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Clock, Car, ClipboardCheck, Cake, Award, FileWarning,
  Receipt, FileSpreadsheet, FileText, Wallet, CalendarDays, ArrowRight,
  ChevronDown, ChevronRight, Medal,
} from "lucide-react";
import { fetchAll } from "../lib/erpnext";
import { useEmployees, useProjects, useDataLoading, type Employee } from "../lib/DataContext";
import { HOLIDAYS } from "../lib/holidays";
import { getActiveInstanceId, getActiveCompany } from "../lib/instances";
import { fetchMissingDaysForEmployees } from "../lib/missingDays";
import {
  SALES_INVOICE_ACTIVE_FILTER,
  SALES_INVOICE_FINAL_FILTER,
  draftShare,
  isDraftInvoice,
} from "../lib/invoice-docstatus";

/* ── Checkbox-based "done" tracker (BTW + payroll) ── */
/* Was ooit een server-side instance_settings key "mgmt-done"; er is geen
   Express-server meer om dat te bedienen en er is geen generieke
   key/value-store in standaard ERPNext om dit centraal op te slaan.
   Niet-kern extraatje (een handmatige afvink-herinnering) — bewaard
   client-side per browser, zelfde localStorage-conventie als de andere
   pref_<instanceId>_* voorkeuren in dit bestand (view_mode hierboven,
   liquidity_start_balance in LiquidityPlanning.tsx). */
/* Waarde = { "btw:2026-Q1": "2026-04-22", "payroll:2026-03": "2026-04-15" } */

type DoneMap = Record<string, string>;

function doneMapStorageKey(instanceId: string): string {
  return `pref_${instanceId}_mgmt_done`;
}

function loadDoneMap(instanceId: string): DoneMap {
  try {
    const raw = localStorage.getItem(doneMapStorageKey(instanceId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as DoneMap) : {};
  } catch {
    return {};
  }
}

function saveDoneMap(instanceId: string, value: DoneMap): void {
  try {
    localStorage.setItem(doneMapStorageKey(instanceId), JSON.stringify(value));
  } catch { /* ignore quota/serialization errors */ }
}

function currentQuarterKey(offset = 0): { key: string; year: number; quarter: number; end: Date } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3); // 0-3 current
  const target = q + offset;
  let year = now.getFullYear();
  let quarter = target;
  while (quarter < 0) { quarter += 4; year -= 1; }
  while (quarter > 3) { quarter -= 4; year += 1; }
  const endMonth = quarter * 3 + 2;
  const lastDay = new Date(year, endMonth + 1, 0).getDate();
  const end = new Date(year, endMonth, lastDay);
  end.setHours(0, 0, 0, 0);
  return { key: `btw:${year}-Q${quarter + 1}`, year, quarter: quarter + 1, end };
}

function previousMonthKey(): { key: string; year: number; month: number; label: string } {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prev.getFullYear();
  const month = prev.getMonth() + 1;
  const key = `payroll:${year}-${String(month).padStart(2, "0")}`;
  const label = prev.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
  return { key, year, month, label };
}

function formatIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CUSTOMER_MILESTONES = new Set([10, 20, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000]);

type Status = "loading" | "ok" | "attention" | "overdue" | "info";

interface DetailItem {
  label: string;
  sub?: string;
}

interface CheckResult {
  status: Status;
  subtextKey: string;
  subtextVars?: Record<string, string | number>;
  items?: DetailItem[];
}

const statusStyles: Record<Status, { badge: string; dot: string; label: string }> = {
  loading: { badge: "bg-slate-100 text-slate-500", dot: "bg-slate-300", label: "mgmt.status.loading" },
  ok: { badge: "bg-green-100 text-green-700", dot: "bg-green-500", label: "mgmt.status.ok" },
  attention: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", label: "mgmt.status.attention" },
  overdue: { badge: "bg-red-100 text-red-700", dot: "bg-red-500", label: "mgmt.status.overdue" },
  info: { badge: "bg-y-teal/10 text-y-teal-dark", dot: "bg-y-teal", label: "mgmt.status.info" },
};

function CheckCard({
  icon: Icon, titleKey, result, actionKey, onClick, extraAction,
}: {
  icon: typeof Clock;
  titleKey: string;
  result: CheckResult;
  actionKey: string;
  onClick: () => void;
  extraAction?: { label: string; onClick: () => void; loading?: boolean } | null;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const s = statusStyles[result.status];
  const hasItems = (result.items?.length ?? 0) > 0;
  const dim = result.status === "ok";

  return (
    <div className={`rounded-xl shadow-sm border transition-all flex flex-col ${dim ? "bg-slate-50 border-slate-200 opacity-70 hover:opacity-100" : "bg-white border-slate-200 hover:border-y-teal/50"}`}>
      <button
        type="button"
        onClick={() => hasItems && setExpanded(e => !e)}
        className={`text-left p-4 flex flex-col gap-3 ${hasItems ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={18} className={`shrink-0 ${dim ? "text-slate-400" : "text-y-teal"}`} />
            <h3 className={`font-semibold truncate ${dim ? "text-slate-500" : "text-slate-800"}`}>{t(titleKey)}</h3>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${s.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {t(s.label)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm min-h-[2.5rem] flex-1 ${dim ? "text-slate-500" : "text-slate-600"}`}>
            {t(result.subtextKey, result.subtextVars as Record<string, unknown>)}
          </p>
          {hasItems && (
            <span className="text-slate-400 shrink-0">
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
        </div>
      </button>

      {expanded && hasItems && (
        <div className="border-t border-slate-100 px-4 py-3 max-h-56 overflow-auto space-y-1.5">
          {result.items!.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm gap-2">
              <span className="text-slate-700 truncate">{item.label}</span>
              {item.sub && <span className="text-xs text-slate-400 shrink-0">{item.sub}</span>}
            </div>
          ))}
          {extraAction && (
            <button
              type="button"
              onClick={extraAction.onClick}
              disabled={extraAction.loading}
              className="mt-2 w-full text-center text-xs font-medium text-y-teal hover:text-y-teal-dark hover:bg-slate-50 py-1.5 rounded border border-dashed border-slate-300 disabled:opacity-50 cursor-pointer"
            >
              {extraAction.loading ? t("common.loading") : extraAction.label}
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="border-t border-slate-100 px-4 py-2 flex items-center justify-between text-xs text-y-teal hover:text-y-teal-dark hover:bg-slate-50 transition-colors"
      >
        <span>{t(actionKey)}</span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
}

/* ── DoneCard: manual checkbox-tracked card (for BTW + payroll) ── */

function DoneCard({
  icon: Icon, titleKey, periodLabel, doneDate, onToggle,
  deadlineKey, deadlineVars, loaded,
}: {
  icon: typeof Clock;
  titleKey: string;
  periodLabel: string;
  doneDate: string | undefined;
  onToggle: () => void;
  deadlineKey: string;
  deadlineVars?: Record<string, string | number>;
  loaded: boolean;
}) {
  const { t } = useTranslation();
  const status: Status = !loaded ? "loading" : doneDate ? "ok" : "attention";
  const s = statusStyles[status];
  const dim = status === "ok";

  return (
    <div className={`rounded-xl shadow-sm border transition-all flex flex-col ${dim ? "bg-slate-50 border-slate-200 opacity-70 hover:opacity-100" : "bg-white border-slate-200"}`}>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={18} className={`shrink-0 ${dim ? "text-slate-400" : "text-y-teal"}`} />
            <h3 className={`font-semibold truncate ${dim ? "text-slate-500" : "text-slate-800"}`}>{t(titleKey)}</h3>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${s.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {t(s.label)}
          </span>
        </div>
        <p className={`text-sm ${dim ? "text-slate-500" : "text-slate-600"}`}>{periodLabel}</p>
        {!doneDate && (
          <p className="text-xs text-slate-500">{t(deadlineKey, deadlineVars as Record<string, unknown>)}</p>
        )}
        {doneDate && (
          <p className="text-xs text-slate-500">{t("mgmt.done_on", { date: doneDate })}</p>
        )}
      </div>
      <label className="border-t border-slate-100 px-4 py-2 flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 transition-colors">
        <input
          type="checkbox"
          checked={!!doneDate}
          onChange={onToggle}
          disabled={!loaded}
          className="w-4 h-4 rounded accent-y-teal cursor-pointer disabled:cursor-wait"
        />
        <span className={dim ? "text-slate-500" : "text-slate-700"}>{t("mgmt.mark_done")}</span>
      </label>
    </div>
  );
}

/* ── Date helpers ── */

function daysUntilBirthday(dobStr: string): number {
  const dob = new Date(dobStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  next.setHours(0, 0, 0, 0);
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return Math.floor((next.getTime() - today.getTime()) / 86400000);
}

function daysUntilAnniversary(joinStr: string): { days: number; years: number } | null {
  if (!joinStr) return null;
  const join = new Date(joinStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), join.getMonth(), join.getDate());
  next.setHours(0, 0, 0, 0);
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  const days = Math.floor((next.getTime() - today.getTime()) / 86400000);
  const years = next.getFullYear() - join.getFullYear();
  return { days, years };
}

function daysUntilDate(dateStr: string): number {
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function daysOpen(postingDate: string): number {
  const today = new Date();
  const posted = new Date(postingDate);
  return Math.max(0, Math.round((today.getTime() - posted.getTime()) / 86400000));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });
}

/* ── Page ── */

export default function ManagementDashboard() {
  const viewMode = (localStorage.getItem("view_mode") || "employer");
  if (viewMode !== "employer") return <Navigate to="/" replace />;
  return <ManagementDashboardContent />;
}

function ManagementDashboardContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const employees = useEmployees();
  const projects = useProjects();
  const dataLoading = useDataLoading();

  const defaultCompany = getActiveCompany();

  const activeEmployees = useMemo(
    () => employees.filter(e => e.status === "Active" && (!defaultCompany || e.company === defaultCompany)),
    [employees, defaultCompany]
  );

/* Check 1b: Missing workdays per date (shift-plan-aware, last 5 weeks default) */
  const [missingDaysCheck, setMissingDaysCheck] = useState<CheckResult>({ status: "loading", subtextKey: "mgmt.loading" });
  const [missingDaysFullYear, setMissingDaysFullYear] = useState(false);
  const [missingDaysLoading, setMissingDaysLoading] = useState(false);
  useEffect(() => {
    if (dataLoading || activeEmployees.length === 0) return;
    let cancelled = false;
    (async () => {
      setMissingDaysLoading(true);
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const from = missingDaysFullYear
          ? new Date(today.getFullYear(), 0, 1)
          : (() => { const d = new Date(today); d.setDate(d.getDate() - 35); return d; })();
        const { missing } = await fetchMissingDaysForEmployees(
          activeEmployees.map(e => ({ name: e.name, date_of_joining: e.date_of_joining })),
          from,
          today,
          "hours",
        );
        if (cancelled) return;
        const empByName = new Map(activeEmployees.map(e => [e.name, e.employee_name]));
        const byDate = new Map<string, { dayName: string; names: string[] }>();
        for (const [empId, days] of missing.entries()) {
          const empName = empByName.get(empId) || empId;
          for (const d of days) {
            let entry = byDate.get(d.date);
            if (!entry) { entry = { dayName: d.dayName, names: [] }; byDate.set(d.date, entry); }
            entry.names.push(empName);
          }
        }
        const dates = Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]));
        const totalMissing = dates.reduce((s, [, v]) => s + v.names.length, 0);
        const employeesAffected = new Set<string>();
        for (const [, v] of dates) for (const n of v.names) employeesAffected.add(n);
        if (dates.length === 0 || totalMissing === 0) {
          setMissingDaysCheck({ status: "ok", subtextKey: "mgmt.missing_days.none" });
          return;
        }
        const items: DetailItem[] = [];
        for (const [date, entry] of dates) {
          entry.names.sort((a, b) => a.localeCompare(b));
          const [y, m, d] = date.split("-");
          const dmy = `${d}-${m}-${y}`;
          for (const n of entry.names) {
            items.push({ label: `${entry.dayName} ${dmy} — ${n}`, sub: "" });
          }
        }
        const status: Status = totalMissing > 20 ? "overdue" : "attention";
        setMissingDaysCheck({
          status,
          subtextKey: "mgmt.missing_days.summary",
          subtextVars: { employees: employeesAffected.size, total: totalMissing },
          items,
        });
      } catch {
        if (!cancelled) setMissingDaysCheck({ status: "info", subtextKey: "mgmt.error_fetch" });
      } finally {
        if (!cancelled) setMissingDaysLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dataLoading, activeEmployees, missingDaysFullYear]);

  /* Check 2b: Missing-km per workday (same as missing-days but for Travel Request) */
  const [missingKmCheck, setMissingKmCheck] = useState<CheckResult>({ status: "loading", subtextKey: "mgmt.loading" });
  const [missingKmFullYear, setMissingKmFullYear] = useState(false);
  const [missingKmLoading, setMissingKmLoading] = useState(false);
  useEffect(() => {
    if (dataLoading || activeEmployees.length === 0) return;
    let cancelled = false;
    (async () => {
      setMissingKmLoading(true);
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const from = missingKmFullYear
          ? new Date(today.getFullYear(), 0, 1)
          : (() => { const d = new Date(today); d.setDate(d.getDate() - 35); return d; })();
        const { missing } = await fetchMissingDaysForEmployees(
          activeEmployees.map(e => ({ name: e.name, date_of_joining: e.date_of_joining })),
          from,
          today,
          "km",
        );
        if (cancelled) return;
        const empByName = new Map(activeEmployees.map(e => [e.name, e.employee_name]));
        const byDate = new Map<string, { dayName: string; names: string[] }>();
        for (const [empId, days] of missing.entries()) {
          const empName = empByName.get(empId) || empId;
          for (const d of days) {
            let entry = byDate.get(d.date);
            if (!entry) { entry = { dayName: d.dayName, names: [] }; byDate.set(d.date, entry); }
            entry.names.push(empName);
          }
        }
        const dates = Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]));
        const totalMissing = dates.reduce((s, [, v]) => s + v.names.length, 0);
        const employeesAffected = new Set<string>();
        for (const [, v] of dates) for (const n of v.names) employeesAffected.add(n);
        if (dates.length === 0 || totalMissing === 0) {
          setMissingKmCheck({ status: "ok", subtextKey: "mgmt.missing_km.none" });
          return;
        }
        const items: DetailItem[] = [];
        for (const [date, entry] of dates) {
          entry.names.sort((a, b) => a.localeCompare(b));
          const [y, m, d] = date.split("-");
          const dmy = `${d}-${m}-${y}`;
          for (const n of entry.names) {
            items.push({ label: `${entry.dayName} ${dmy} — ${n}`, sub: "" });
          }
        }
        const status: Status = totalMissing > 20 ? "overdue" : "attention";
        setMissingKmCheck({
          status,
          subtextKey: "mgmt.missing_km.summary",
          subtextVars: { employees: employeesAffected.size, total: totalMissing },
          items,
        });
      } catch {
        if (!cancelled) setMissingKmCheck({ status: "info", subtextKey: "mgmt.error_fetch" });
      } finally {
        if (!cancelled) setMissingKmLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dataLoading, activeEmployees, missingKmFullYear]);

  /* Check 3b: Travel Requests awaiting approval (kilometers goedkeuren) */
  const [travelApprovalCheck, setTravelApprovalCheck] = useState<CheckResult>({ status: "loading", subtextKey: "mgmt.loading" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const employeeIds = activeEmployees.map(e => e.name);
        const filters: unknown[][] = [["docstatus", "=", 0]];
        if (employeeIds.length > 0) filters.push(["employee", "in", employeeIds]);
        const drafts = await fetchAll<{ name: string; employee_name: string; custom_from_date: string; custom_total_distance: number }>(
          "Travel Request",
          ["name", "employee_name", "custom_from_date", "custom_total_distance"],
          filters,
          "custom_from_date desc",
        );
        if (cancelled) return;
        const n = drafts.length;
        const items: DetailItem[] = drafts.map(d => ({
          label: d.employee_name || d.name,
          sub: `${formatDate(d.custom_from_date)} — ${(d.custom_total_distance ?? 0).toFixed(0)} km`,
        }));
        if (n === 0) setTravelApprovalCheck({ status: "ok", subtextKey: "mgmt.travel_approval.none" });
        else if (n <= 5) setTravelApprovalCheck({ status: "attention", subtextKey: "mgmt.travel_approval.pending", subtextVars: { count: n }, items });
        else setTravelApprovalCheck({ status: "overdue", subtextKey: "mgmt.travel_approval.pending", subtextVars: { count: n }, items });
      } catch {
        if (!cancelled) setTravelApprovalCheck({ status: "info", subtextKey: "mgmt.error_fetch" });
      }
    })();
    return () => { cancelled = true; };
  }, [activeEmployees]);

/* Check 3: Timesheets awaiting approval — only drafts whose start_date is
     more than 7 days ago. ERPNext sets `end_date` to the last time_log date,
     so an incomplete week looks like a one-day timesheet (e.g. 11..11 mei)
     and end_date filtering is unreliable. start_date is fixed when the
     timesheet is created, so it's a stable signal of "this week is past". */
  const [approvalCheck, setApprovalCheck] = useState<CheckResult>({ status: "loading", subtextKey: "mgmt.loading" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - 7);
        const cutoffStr = formatIsoDate(cutoff);
        const draftFilters: unknown[][] = [
          ["docstatus", "=", 0],
          ["start_date", "<=", cutoffStr],
        ];
        if (defaultCompany) draftFilters.push(["company", "=", defaultCompany]);
        const drafts = await fetchAll<{ name: string; employee_name: string; start_date: string; end_date: string; total_hours: number }>(
          "Timesheet",
          ["name", "employee_name", "start_date", "end_date", "total_hours"],
          draftFilters,
          "start_date desc",
        );
        if (cancelled) return;
        const n = drafts.length;
        const items: DetailItem[] = drafts.map(d => ({
          label: `${d.employee_name || d.name}`,
          sub: `${formatDate(d.start_date)} – ${formatDate(d.end_date)} · ${d.total_hours?.toFixed(1) ?? "0"}u`,
        }));
        if (n === 0) setApprovalCheck({ status: "ok", subtextKey: "mgmt.approval.none" });
        else if (n <= 5) setApprovalCheck({ status: "attention", subtextKey: "mgmt.approval.pending", subtextVars: { count: n }, items });
        else setApprovalCheck({ status: "overdue", subtextKey: "mgmt.approval.pending", subtextVars: { count: n }, items });
      } catch {
        if (!cancelled) setApprovalCheck({ status: "info", subtextKey: "mgmt.error_fetch" });
      }
    })();
    return () => { cancelled = true; };
  }, [defaultCompany]);

  /* Check 4: Upcoming birthdays */
  const birthdayCheck: CheckResult = useMemo(() => {
    if (dataLoading) return { status: "loading", subtextKey: "mgmt.loading" };
    const upcoming = activeEmployees
      .filter(e => e.date_of_birth)
      .map(e => ({ e, days: daysUntilBirthday(e.date_of_birth) }))
      .filter(x => x.days <= 30)
      .sort((a, b) => a.days - b.days);
    if (upcoming.length === 0) return { status: "ok", subtextKey: "mgmt.birthdays.none" };
    const items: DetailItem[] = upcoming.map(x => ({
      label: x.e.employee_name,
      sub: x.days === 0 ? t("mgmt.today") : t("mgmt.in_n_days", { n: x.days }),
    }));
    return { status: "info", subtextKey: "mgmt.birthdays.upcoming", subtextVars: { count: upcoming.length }, items };
  }, [dataLoading, activeEmployees, t]);

  /* Check 5: Work anniversaries */
  const anniversaryCheck: CheckResult = useMemo(() => {
    if (dataLoading) return { status: "loading", subtextKey: "mgmt.loading" };
    const milestones = [5, 10, 15, 20, 25, 30, 40];
    const upcoming: { e: Employee; days: number; years: number }[] = [];
    for (const e of activeEmployees) {
      if (!e.date_of_joining) continue;
      const a = daysUntilAnniversary(e.date_of_joining);
      if (!a) continue;
      if (a.days <= 60 && milestones.includes(a.years)) upcoming.push({ e, ...a });
    }
    upcoming.sort((a, b) => a.days - b.days);
    if (upcoming.length === 0) return { status: "ok", subtextKey: "mgmt.anniversaries.none" };
    const items: DetailItem[] = upcoming.map(x => ({
      label: x.e.employee_name,
      sub: t("mgmt.anniversaries.item_sub", { years: x.years, days: x.days }),
    }));
    return { status: "info", subtextKey: "mgmt.anniversaries.upcoming", subtextVars: { count: upcoming.length }, items };
  }, [dataLoading, activeEmployees, t]);

  /* Check 6: Contracts ending <2 months */
  const contractCheck: CheckResult = useMemo(() => {
    if (dataLoading) return { status: "loading", subtextKey: "mgmt.loading" };
    const ending = activeEmployees
      .filter(e => e.contract_end_date)
      .map(e => ({ e, days: daysUntilDate(e.contract_end_date!) }))
      .filter(x => x.days >= 0 && x.days <= 60)
      .sort((a, b) => a.days - b.days);
    if (ending.length === 0) return { status: "ok", subtextKey: "mgmt.contracts.none" };
    const items: DetailItem[] = ending.map(x => ({
      label: x.e.employee_name,
      sub: `${formatDate(x.e.contract_end_date!)} (${t("mgmt.in_n_days", { n: x.days })})`,
    }));
    return { status: "attention", subtextKey: "mgmt.contracts.ending", subtextVars: { count: ending.length }, items };
  }, [dataLoading, activeEmployees, t]);

  /* Check 7: Sales invoices > 30 days open.
     Blijft strikt op definitieve facturen: een conceptfactuur is niet naar de
     klant verstuurd en dus geen openstaande vordering. */
  const [invoiceCheck, setInvoiceCheck] = useState<CheckResult>({ status: "loading", subtextKey: "mgmt.loading" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const invFilters: unknown[][] = [SALES_INVOICE_FINAL_FILTER, ["outstanding_amount", ">", 0]];
        if (defaultCompany) invFilters.push(["company", "=", defaultCompany]);
        const invoices = await fetchAll<{ name: string; customer_name: string; posting_date: string; outstanding_amount: number }>(
          "Sales Invoice",
          ["name", "customer_name", "posting_date", "outstanding_amount"],
          invFilters,
          "posting_date asc",
        );
        const overdue = invoices.filter(i => daysOpen(i.posting_date) > 30);
        const total = overdue.reduce((s, i) => s + (i.outstanding_amount || 0), 0);
        if (cancelled) return;
        const items: DetailItem[] = overdue.map(i => ({
          label: `${i.customer_name} — ${i.name}`,
          sub: `${(i.outstanding_amount || 0).toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })} · ${daysOpen(i.posting_date)}d`,
        }));
        if (overdue.length === 0) setInvoiceCheck({ status: "ok", subtextKey: "mgmt.invoices.none" });
        else {
          const sev = overdue.length > 5 ? "overdue" : "attention";
          setInvoiceCheck({
            status: sev as Status,
            subtextKey: "mgmt.invoices.overdue",
            subtextVars: { count: overdue.length, amount: total.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) },
            items,
          });
        }
      } catch {
        if (!cancelled) setInvoiceCheck({ status: "info", subtextKey: "mgmt.error_fetch" });
      }
    })();
    return () => { cancelled = true; };
  }, [defaultCompany]);

  /* Check 7b: Were invoices raised in the current calendar month?
     Telt concept + definitief (`docstatus != 2`): op instances waar facturen
     lang in concept blijven staan zou een submitted-only telling elke maand
     "geen facturen" roepen terwijl het werk gedaan is. Het conceptdeel wordt
     expliciet benoemd — zijn ze állemaal nog concept, dan blijft het een
     aandachtspunt, want naar de klant is er dan nog niets. */
  const [invoicesSentCheck, setInvoicesSentCheck] = useState<CheckResult>({ status: "loading", subtextKey: "mgmt.loading" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth(); // 0-based
        const monthFirst = new Date(y, m, 1);
        const monthLast = new Date(y, m + 1, 0);
        const fromStr = formatIsoDate(monthFirst);
        const toStr = formatIsoDate(monthLast);
        const monthLabel = monthFirst.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
        const filters: unknown[][] = [
          SALES_INVOICE_ACTIVE_FILTER,
          ["posting_date", ">=", fromStr],
          ["posting_date", "<=", toStr],
        ];
        if (defaultCompany) filters.push(["company", "=", defaultCompany]);
        const invoices = await fetchAll<{ name: string; customer_name: string; posting_date: string; grand_total: number; docstatus?: number }>(
          "Sales Invoice",
          ["name", "customer_name", "posting_date", "grand_total", "docstatus"],
          filters,
          "posting_date desc",
        );
        if (cancelled) return;
        const totalAmount = invoices.reduce((s, i) => s + (i.grand_total || 0), 0);
        const share = draftShare(invoices, i => i.grand_total);
        const items: DetailItem[] = invoices.map(i => ({
          label: `${i.customer_name || ""} — ${i.name}${isDraftInvoice(i) ? ` (${t("invoice_draft.badge")})` : ""}`,
          sub: `${formatDate(i.posting_date)} · ${(i.grand_total || 0).toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}`,
        }));
        const amountLabel = totalAmount.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
        if (invoices.length === 0) {
          setInvoicesSentCheck({
            status: "attention",
            subtextKey: "mgmt.invoices_sent.none",
            subtextVars: { month: monthLabel },
          });
        } else if (share.finalCount === 0) {
          // Alles staat nog in concept: geteld, maar nog niets de deur uit.
          setInvoicesSentCheck({
            status: "attention",
            subtextKey: "mgmt.invoices_sent.only_drafts",
            subtextVars: { month: monthLabel, count: invoices.length, amount: amountLabel },
            items,
          });
        } else {
          setInvoicesSentCheck({
            status: "ok",
            subtextKey: share.hasDrafts ? "mgmt.invoices_sent.summary_with_drafts" : "mgmt.invoices_sent.summary",
            subtextVars: {
              month: monthLabel,
              count: invoices.length,
              amount: amountLabel,
              draftCount: share.draftCount,
            },
            items,
          });
        }
      } catch {
        if (!cancelled) setInvoicesSentCheck({ status: "info", subtextKey: "mgmt.error_fetch" });
      }
    })();
    return () => { cancelled = true; };
  }, [defaultCompany, t]);

  /* Manual "done" tracker for BTW + payroll (stored in instance_settings) */
  const [doneMap, setDoneMap] = useState<DoneMap>({});
  const [doneLoaded, setDoneLoaded] = useState(false);
  const instanceId = getActiveInstanceId();
  useEffect(() => {
    if (!instanceId) { setDoneLoaded(true); return; }
    setDoneMap(loadDoneMap(instanceId));
    setDoneLoaded(true);
  }, [instanceId]);

  function toggleDone(key: string) {
    const next = { ...doneMap };
    if (next[key]) delete next[key];
    else next[key] = formatIsoDate(new Date());
    setDoneMap(next);
    if (instanceId) saveDoneMap(instanceId, next);
  }

  /* Check: Customer project milestones (10/20/25/50/75/100/… projects) */
  const customerMilestoneCheck: CheckResult = useMemo(() => {
    if (dataLoading) return { status: "loading", subtextKey: "mgmt.loading" };
    const counts = new Map<string, number>();
    for (const p of projects) {
      if (!p.customer) continue;
      if (defaultCompany && p.company !== defaultCompany) continue;
      counts.set(p.customer, (counts.get(p.customer) || 0) + 1);
    }
    const hits = Array.from(counts.entries())
      .filter(([, n]) => CUSTOMER_MILESTONES.has(n))
      .sort((a, b) => b[1] - a[1]);
    if (hits.length === 0) return { status: "ok", subtextKey: "mgmt.customers.none" };
    const items: DetailItem[] = hits.map(([customer, n]) => ({
      label: customer,
      sub: t("mgmt.customers.item_sub", { count: n }),
    }));
    return { status: "info", subtextKey: "mgmt.customers.upcoming", subtextVars: { count: hits.length }, items };
  }, [dataLoading, projects, defaultCompany, t]);

  /* Check 10: Upcoming holidays */
  const holidayCheck: CheckResult = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const combined = [...(HOLIDAYS[year] || []), ...(HOLIDAYS[year + 1] || [])];
    const upcoming = combined
      .map(h => ({ ...h, days: daysUntilDate(h.date) }))
      .filter(h => h.days >= 0 && h.days <= 60)
      .sort((a, b) => a.days - b.days);
    if (upcoming.length === 0) return { status: "ok", subtextKey: "mgmt.holidays.none" };
    const next = upcoming[0];
    const items: DetailItem[] = upcoming.map(h => ({
      label: h.name,
      sub: `${formatDate(h.date)} (${t("mgmt.in_n_days", { n: h.days })})`,
    }));
    return { status: "info", subtextKey: "mgmt.holidays.next", subtextVars: { name: next.name, days: next.days }, items };
  }, [t]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t("mgmt.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("mgmt.subtitle")}</p>
      </div>

      <Section title={t("mgmt.section.personnel")}>
        <CheckCard
          icon={Clock}
          titleKey={missingDaysFullYear ? "mgmt.missing_days.title_year" : "mgmt.missing_days.title_5w"}
          result={missingDaysCheck}
          actionKey="mgmt.goto.timesheets"
          onClick={() => navigate("/timesheets?tab=goedkeuren")}
          extraAction={!missingDaysFullYear ? {
            label: t("mgmt.missing_days.show_full_year"),
            onClick: () => setMissingDaysFullYear(true),
            loading: missingDaysLoading,
          } : null}
        />
        <CheckCard
          icon={Car}
          titleKey={missingKmFullYear ? "mgmt.missing_km.title_year" : "mgmt.missing_km.title_5w"}
          result={missingKmCheck}
          actionKey="mgmt.goto.expenses"
          onClick={() => navigate("/expenses?tab=overzicht")}
          extraAction={!missingKmFullYear ? {
            label: t("mgmt.missing_days.show_full_year"),
            onClick: () => setMissingKmFullYear(true),
            loading: missingKmLoading,
          } : null}
        />
        <CheckCard icon={ClipboardCheck} titleKey="mgmt.approval.title" result={approvalCheck}
          actionKey="mgmt.goto.approve" onClick={() => navigate("/timesheets?tab=goedkeuren")} />
        <CheckCard icon={ClipboardCheck} titleKey="mgmt.travel_approval.title" result={travelApprovalCheck}
          actionKey="mgmt.goto.travel_approve" onClick={() => navigate("/expenses?tab=overzicht")} />
        <CheckCard icon={Cake} titleKey="mgmt.birthdays.title" result={birthdayCheck}
          actionKey="mgmt.goto.employees" onClick={() => navigate("/employees")} />
        <CheckCard icon={Award} titleKey="mgmt.anniversaries.title" result={anniversaryCheck}
          actionKey="mgmt.goto.employees" onClick={() => navigate("/employees")} />
        <CheckCard icon={FileWarning} titleKey="mgmt.contracts.title" result={contractCheck}
          actionKey="mgmt.goto.employees" onClick={() => navigate("/employees")} />
      </Section>

      <Section title={t("mgmt.section.financial")}>
        <CheckCard icon={FileText} titleKey="mgmt.invoices_sent.title" result={invoicesSentCheck}
          actionKey="mgmt.goto.sales_invoices" onClick={() => navigate("/sales")} />
        <CheckCard icon={Receipt} titleKey="mgmt.invoices.title" result={invoiceCheck}
          actionKey="mgmt.goto.outstanding" onClick={() => navigate("/outstanding")} />
        {(() => {
          const q = currentQuarterKey(-1);
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const daysSinceEnd = Math.floor((today.getTime() - q.end.getTime()) / 86400000);
          const daysLeft = 30 - daysSinceEnd;
          const deadlineKey = daysSinceEnd < 0 ? "mgmt.vat.not_due"
            : daysLeft < 0 ? "mgmt.vat.overdue"
            : "mgmt.vat.deadline_in";
          const deadlineVars = daysLeft < 0 ? { days: -daysLeft } : { days: daysLeft };
          return (
            <DoneCard icon={FileSpreadsheet} titleKey="mgmt.vat.title"
              periodLabel={t("mgmt.vat.period", { year: q.year, quarter: q.quarter })}
              doneDate={doneMap[q.key]}
              onToggle={() => toggleDone(q.key)}
              deadlineKey={deadlineKey}
              deadlineVars={deadlineVars}
              loaded={doneLoaded} />
          );
        })()}
        {(() => {
          const p = previousMonthKey();
          return (
            <DoneCard icon={Wallet} titleKey="mgmt.payroll.title"
              periodLabel={t("mgmt.payroll.period", { month: p.label })}
              doneDate={doneMap[p.key]}
              onToggle={() => toggleDone(p.key)}
              deadlineKey="mgmt.payroll.deadline"
              loaded={doneLoaded} />
          );
        })()}
      </Section>

      <Section title={t("mgmt.section.agenda")}>
        <CheckCard icon={CalendarDays} titleKey="mgmt.holidays.title" result={holidayCheck}
          actionKey="mgmt.goto.leave" onClick={() => navigate("/leave")} />
        <CheckCard icon={Medal} titleKey="mgmt.customers.title" result={customerMilestoneCheck}
          actionKey="mgmt.goto.customers" onClick={() => navigate("/projects")} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {children}
      </div>
    </div>
  );
}
