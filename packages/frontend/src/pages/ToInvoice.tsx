import { useEffect, useState, useMemo, useCallback, useRef, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchAll, fetchDocument, fetchList, createDocument, updateDocument, getErpNextLinkUrl } from "../lib/erpnext";
import { useProjects, useEmployees, useCompanies } from "../lib/DataContext";
import type { ProjectRecord } from "../lib/DataContext";
import { TaskDetail, type Task as TaskRow } from "./Tasks";
import { ProjectDetail } from "./Projects";
import InfoOverlay from "../components/InfoOverlay";
import SendInvoiceModal from "../components/SendInvoiceModal";
import {
  AlertTriangle, Clock, FileText, TrendingUp, Users,
  ChevronDown, ChevronRight, Info, CheckSquare, Square, Loader2,
  ExternalLink, X, ShieldCheck, Timer, Diamond, Search, Filter, Send, Check,
} from "lucide-react";
import {
  runInvoiceValidation, SKIP_BILLED_CHECK,
  invoiceWarningLabels,
  type InvoiceRow, type InvoiceWarning, type InvoiceValidationContext,
} from "../lib/invoiceWarnings";

// ─── Types ───

interface TimesheetHeader {
  name: string;
  employee: string;
  employee_name: string;
  total_hours: number;
  total_billable_hours: number;
  total_billed_hours: number;
  total_billed_amount: number;
  start_date: string;
  end_date: string;
  status: string;
  company: string;
  docstatus: number;
}

interface TimeLog {
  name: string;
  project: string;
  task: string;
  task_name?: string;
  activity_type: string;
  hours: number;
  is_billable: number;
  billing_hours: number;
  billing_amount: number;
  sales_invoice: string;
  from_time: string;
  to_time: string;
  description?: string;
  custom_is_billed?: number;
}

/** Flat row = one time_log entry enriched with timesheet + project info */
interface FlatRow {
  key: string;
  // Time log
  fromTime: string;
  toTime: string;
  hours: number;
  billingHours: number;
  isBillable: boolean;
  isBilled: boolean;
  customIsBilled: boolean;
  salesInvoice: string;
  activityType: string;
  task: string;
  taskName: string;
  taskBilling: string;
  description: string;
  // Timesheet
  tsName: string;
  tsStatus: string;
  employeeName: string;
  employeeCompany: string;
  startDate: string;
  // Project
  project: string;
  projectName: string;
  projectCompany: string;
  pmCompany: string;
  customer: string;
}

interface Warning {
  type: "draft" | "company-mismatch" | "cross-company" | "no-project" | "billing-mismatch" | "no-pm-company";
  severity: "error" | "warning" | "info";
  message: string;
  details?: string;
}

type Period = "vorige-maand" | "dit-jaar" | "custom";

// ─── Helpers ───

const DAY_LABELS = ["zo", "ma", "di", "wo", "do", "vr", "za"];

function getPeriodDates(period: Period): { from: string; to: string } {
  const now = new Date();
  if (period === "vorige-maand") {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const m = now.getMonth() === 0 ? 12 : now.getMonth();
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  }
  if (period === "dit-jaar") {
    // Dit jaar tot en met de laatste dag van de vorige afgeronde maand
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based, = vorige maand nummer (1-based)
    if (m === 0) {
      // January: vorige afgeronde maand = december vorig jaar
      const lastDay = new Date(y - 1, 12, 0).getDate();
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-${String(lastDay).padStart(2, "0")}` };
    }
    const lastDay = new Date(y, m, 0).getDate();
    return { from: `${y}-01-01`, to: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` };
  }
  return { from: "", to: "" };
}

function fmt(n: number): string {
  return n.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

function getDayLabel(fromTime: string): string {
  if (!fromTime) return "";
  const d = new Date(fromTime);
  return DAY_LABELS[d.getDay()];
}

function formatDate(fromTime: string): string {
  if (!fromTime) return "";
  const d = new Date(fromTime);
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "short" });
}

function formatTimeRange(fromTime: string, hours: number): string {
  if (!fromTime) return "";
  const start = new Date(fromTime);
  const end = new Date(start.getTime() + hours * 3600000);
  const f = (d: Date) => `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  return `${f(start)}-${f(end)}`;
}

// Highlighting constants (same as timesheetValidation)
const WARN_HL = "bg-amber-100";
const ERR_HL = "bg-red-100";

// ─── Component ───

interface ToInvoiceProps {
  company?: string;
  fromDate: string;
  toDate: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

export default function ToInvoice({ company, fromDate, toDate, onFromChange, onToChange }: ToInvoiceProps) {
  const { t } = useTranslation();
  // In-page detail panels — same components the /projects and /tasks pages use.
  const [inlineProject, setInlineProject] = useState<ProjectRecord | null>(null);
  const [inlineTask, setInlineTask] = useState<TaskRow | null>(null);
  const projects = useProjects();
  const employees = useEmployees();
  const companies = useCompanies();

  function openProjectInline(projKey: string) {
    const match = projects.find((p) => p.name === projKey);
    if (match) setInlineProject(match);
  }
  async function openTaskInline(taskId: string) {
    try {
      const doc = await fetchDocument<TaskRow>("Task", taskId);
      setInlineTask(doc);
    } catch { /* ignore */ }
  }
  const displayNameByEmail = useCallback((email: string) => {
    if (!email) return "";
    const emp = employees.find((e) => e.user_id === email || e.name === email);
    return emp?.employee_name || email;
  }, [employees]);

  // Company name → abbreviation lookup (for naming series validation)
  const companyAbbrMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companies) m.set(c.name, c.abbr);
    return m;
  }, [companies]);

  const [loading, setLoading] = useState(false);
  const [groupByCustomer, setGroupByCustomer] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  // Excel-style per-column filters. Key = column id, value = Set of allowed
  // display values. Missing key = no filter for that column.
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [openColumnFilter, setOpenColumnFilter] = useState<string | null>(null);

  const [flatRows, setFlatRows] = useState<FlatRow[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [draftTimesheets, setDraftTimesheets] = useState<TimesheetHeader[]>([]);
  const [expandedWarnings, setExpandedWarnings] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // ─── Selection state ───
  /** Selected row keys (time_log names) */
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  /** Selected project keys */
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

  // ─── Invoice creation state ───
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceWarnings, setInvoiceWarnings] = useState<InvoiceWarning[]>([]);
  const [invoiceCreating, setInvoiceCreating] = useState(false);
  const [invoiceResults, setInvoiceResults] = useState<{ project: string; projectName: string; siName: string; error?: string }[]>([]);
  // Opens the SendInvoiceModal in DRAFT mode for the freshly created SI;
  // ERPNext submits + sends in one click.
  const [sendInvoiceTarget, setSendInvoiceTarget] = useState<string | null>(null);
  // Tracks which Sales Invoices in the results-list are already verzonden,
  // zodat de "Bekijken & Versturen"-knop in de Resultaat-modal visueel
  // omschakelt naar "Verzonden" zonder de modal te hoeven sluiten.
  const [sentSiNames, setSentSiNames] = useState<Set<string>>(new Set());
  // Eenvoudige toast-state voor parent-feedback na succesvolle send.
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (toast) { const tm = setTimeout(() => setToast(null), 4000); return () => clearTimeout(tm); }
  }, [toast]);
  const [billingRates, setBillingRates] = useState<Map<string, number>>(new Map());

  // Default to "dit-jaar" on first mount = 1 jan tot laatste dag van de
  // vorige afgeronde maand. Geeft direct het ruwe jaaroverzicht voor facturatie.
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    if (!fromDate && !toDate) {
      const { from, to } = getPeriodDates("dit-jaar");
      onFromChange(from);
      onToChange(to);
    }
  }, [initialized, fromDate, toDate, onFromChange, onToChange]);

  const from = fromDate;
  const to = toDate;

  function applyPreset(preset: Period) {
    const dates = getPeriodDates(preset);
    onFromChange(dates.from);
    onToChange(dates.to);
  }

  // Build lookup maps (refs to avoid re-triggering loadData)
  const projectMap = useMemo(() => {
    const m = new Map<string, { name: string; project_name: string; company: string; customer?: string; customer_name?: string; custom_project_manager_company?: string; sales_order?: string }>();
    for (const p of projects) m.set(p.name, p);
    return m;
  }, [projects]);

  const employeeMap = useMemo(() => {
    const m = new Map<string, { employee_name: string; company: string }>();
    for (const e of employees) m.set(e.name, { employee_name: e.employee_name, company: e.company });
    return m;
  }, [employees]);

  const projectMapRef = useRef(projectMap);
  projectMapRef.current = projectMap;
  const employeeMapRef = useRef(employeeMap);
  employeeMapRef.current = employeeMap;
  const employeesRef = useRef(employees);
  employeesRef.current = employees;

  const loadData = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setWarnings([]);

    try {
      // 1. Fetch ALL timesheets in period (submitted + draft)
      const allTimesheets = await fetchAll<TimesheetHeader>(
        "Timesheet",
        [
          "name", "employee", "employee_name", "total_hours",
          "total_billable_hours", "total_billed_hours", "total_billed_amount",
          "start_date", "end_date", "status", "company", "docstatus",
        ],
        [
          ["start_date", ">=", from],
          ["start_date", "<=", to],
          ["docstatus", "in", [0, 1]],
        ],
        "employee_name asc, start_date asc",
      );

      // 2. Separate drafts vs submitted
      const drafts = allTimesheets.filter(ts => ts.docstatus === 0);
      const submitted = allTimesheets.filter(ts => ts.docstatus === 1);
      setDraftTimesheets(drafts);

      const newWarnings: Warning[] = [];

      // Warning: draft timesheets — only for selected company
      const companyDrafts = company
        ? drafts.filter(d => (employeeMapRef.current.get(d.employee)?.company ?? d.company) === company)
        : drafts;
      if (companyDrafts.length > 0) {
        newWarnings.push({
          type: "draft",
          severity: "error",
          message: `${companyDrafts.length} timesheet(s) nog in Draft`,
          details: companyDrafts.map(d => `${d.employee_name}: ${d.name} (${d.start_date})`).join("\n"),
        });
      }

      // 3. Fetch task subjects for lookup
      const taskList = await fetchAll<{ name: string; subject: string; custom_billing_type?: string }>(
        "Task", ["name", "subject", "custom_billing_type"], [],
      );
      const taskSubjectMap = new Map<string, string>();
      const taskBillingMap = new Map<string, string>();
      for (const t of taskList) {
        taskSubjectMap.set(t.name, t.subject);
        if (t.custom_billing_type) taskBillingMap.set(t.name, t.custom_billing_type);
      }

      // 4. Fetch time_logs for submitted timesheets → flat rows
      const rows: FlatRow[] = [];
      const noProjectLogs: { employee: string; hours: number; activity: string }[] = [];

      const batchSize = 20;
      for (let i = 0; i < submitted.length; i += batchSize) {
        const batch = submitted.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(ts => fetchDocument<{ time_logs: TimeLog[] }>("Timesheet", ts.name))
        );

        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status !== "fulfilled" || !r.value?.time_logs) continue;
          const ts = batch[j];
          const empInfo = employeeMapRef.current.get(ts.employee);
          const empCompany = empInfo?.company ?? ts.company;

          for (const log of r.value.time_logs) {
            // Filter detail rows by date range (from_time contains datetime)
            if (from && log.from_time && log.from_time.slice(0, 10) < from) continue;
            if (to && log.from_time && log.from_time.slice(0, 10) > to) continue;

            const proj = log.project || "";
            const pRec = proj ? projectMapRef.current.get(proj) : undefined;

            if (!proj) {
              noProjectLogs.push({ employee: ts.employee_name, hours: log.hours, activity: log.activity_type });
            }

            rows.push({
              key: log.name || `${ts.name}-${log.from_time}`,
              fromTime: log.from_time,
              toTime: log.to_time || "",
              hours: log.hours || 0,
              billingHours: log.billing_hours || 0,
              isBillable: !!log.is_billable,
              isBilled: !!log.sales_invoice,
              customIsBilled: !!log.custom_is_billed,
              salesInvoice: log.sales_invoice || "",
              activityType: log.activity_type || "",
              task: log.task || "",
              taskName: log.task_name || (log.task ? taskSubjectMap.get(log.task) ?? "" : ""),
              taskBilling: log.task ? taskBillingMap.get(log.task) ?? "" : "",
              description: log.description || "",
              tsName: ts.name,
              tsStatus: ts.status,
              employeeName: ts.employee_name,
              employeeCompany: empCompany,
              startDate: ts.start_date,
              project: proj,
              projectName: pRec?.project_name ?? proj,
              projectCompany: pRec?.company ?? "",
              pmCompany: pRec?.custom_project_manager_company ?? "",
              customer: pRec?.customer_name || pRec?.customer || "",
            });
          }
        }
      }

      // 4. Warnings
      // Company mismatches
      const mismatchProjects = new Map<string, Set<string>>();
      for (const row of rows) {
        if (row.project && row.projectCompany && row.employeeCompany !== row.projectCompany) {
          if (!mismatchProjects.has(row.project)) mismatchProjects.set(row.project, new Set());
          mismatchProjects.get(row.project)!.add(row.employeeName);
        }
      }
      for (const [proj, emps] of mismatchProjects) {
        const pRec = projectMapRef.current.get(proj);
        if (company && pRec?.company !== company) continue;
        newWarnings.push({
          type: "company-mismatch",
          severity: "warning",
          message: `${pRec?.project_name ?? proj}: medewerker(s) van andere company`,
          details: Array.from(emps).join(", "),
        });
      }

      // No-project hours
      const companyNoProj = company
        ? noProjectLogs.filter(l => {
            const emp = employeesRef.current.find(e => e.employee_name === l.employee);
            return emp?.company === company;
          })
        : noProjectLogs;
      if (companyNoProj.length > 0) {
        const total = companyNoProj.reduce((s, l) => s + l.hours, 0);
        newWarnings.push({
          type: "no-project",
          severity: "warning",
          message: `${fmt(total)} uur zonder project geboekt`,
          details: companyNoProj.map(l => `${l.employee}: ${fmt(l.hours)}u (${l.activity})`).join("\n"),
        });
      }

      // Billing consistency: billed timesheets without SI
      const billedNoSI = rows.filter(r => r.isBilled && !r.salesInvoice);
      if (billedNoSI.length > 0) {
        const hrs = billedNoSI.reduce((s, r) => s + r.hours, 0);
        newWarnings.push({
          type: "billing-mismatch",
          severity: "warning",
          message: `${billedNoSI.length} time log(s) gemarkeerd als gefactureerd maar zonder Sales Invoice (${fmt(hrs)} uur)`,
          details: billedNoSI.slice(0, 10).map(r => `${r.employeeName}: ${r.project || "(geen)"} ${fmt(r.hours)}u`).join("\n"),
        });
      }

      // Billing consistency: SIs in period without matching timesheet hours
      try {
        const periodSIs = await fetchAll<{ name: string; customer_name: string; grand_total: number; is_return: number }>(
          "Sales Invoice",
          ["name", "customer_name", "grand_total", "is_return"],
          [["posting_date", ">=", from], ["posting_date", "<=", to], ["docstatus", "=", 1], ["is_return", "=", 0]],
        );
        const billedSINames = new Set(rows.filter(r => r.salesInvoice).map(r => r.salesInvoice));
        const unmatchedSIs = periodSIs.filter(si => !billedSINames.has(si.name));
        if (unmatchedSIs.length > 0) {
          newWarnings.push({
            type: "billing-mismatch",
            severity: "info",
            message: `${unmatchedSIs.length} Sales Invoice(s) in periode zonder gekoppelde timesheet uren`,
            details: unmatchedSIs.slice(0, 10).map(si => `${si.name}: ${si.customer_name} (€${si.grand_total})`).join("\n"),
          });
        }
      } catch { /* SI fetch failure is non-critical */ }

      // PM company validation: projects without custom_project_manager_company
      const projectsInRows = new Set(rows.filter(r => r.project).map(r => r.project));
      const noPmCompanyProjects: string[] = [];
      for (const projId of projectsInRows) {
        const pRec = projectMapRef.current.get(projId);
        if (!pRec) continue;
        if (company && pRec.company !== company) continue;
        if (!pRec.custom_project_manager_company) {
          noPmCompanyProjects.push(`${projId} — ${pRec.project_name}`);
        }
      }
      if (noPmCompanyProjects.length > 0) {
        newWarnings.push({
          type: "no-pm-company",
          severity: "info",
          message: `${noPmCompanyProjects.length} project(en) zonder projectmanager company`,
          details: noPmCompanyProjects.slice(0, 15).join("\n"),
        });
      }

      setFlatRows(rows);
      setWarnings(newWarnings);
    } catch (e) {
      setWarnings([{
        type: "no-project",
        severity: "error",
        message: t("to_invoice.load_error", { defaultValue: "Load error: {{msg}}", msg: e instanceof Error ? e.message : t("common.unknown", { defaultValue: "Unknown" }) }),
      }]);
    } finally {
      setLoading(false);
    }
  }, [from, to, company]);

  useEffect(() => { if (from && to) loadData(); }, [from, to, loadData]);

  // Map a column id to the display value used for column filters.
  const getColumnValue = useCallback((r: FlatRow, col: string): string => {
    switch (col) {
      case "medewerker": return r.employeeName || "(leeg)";
      case "activiteit": return r.activityType || "(leeg)";
      case "taak": return r.taskName || r.task || "(leeg)";
      case "billable": return r.isBillable ? "Ja" : "Nee";
      case "gefact": return r.isBilled ? "Ja" : "Nee";
      default: return "";
    }
  }, []);

  // Unique values per column — used by the column-filter dropdown.
  // Computed from flatRows (not filteredRows) so the dropdown lists all
  // values regardless of other active filters.
  const uniqueValuesFor = useCallback((col: string): string[] => {
    const set = new Set<string>();
    for (const r of flatRows) set.add(getColumnValue(r, col));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "nl"));
  }, [flatRows, getColumnValue]);

  // Inline component: filter icon + popover dropdown for one column header.
  function renderColumnFilter(col: string): React.ReactNode {
    const allowed = columnFilters[col];
    const isActive = !!allowed && allowed.size > 0;
    const isOpen = openColumnFilter === col;
    return (
      <span className="relative inline-block ml-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setOpenColumnFilter(isOpen ? null : col)}
          className={`p-0.5 cursor-pointer rounded hover:bg-slate-200 ${isActive ? "text-y-teal" : "text-slate-400 hover:text-slate-600"}`}
          title={t("to_invoice.filter_column", { defaultValue: "Filter kolom" })}
        >
          <Filter size={12} />
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpenColumnFilter(null)} />
            <div className="absolute top-full left-0 mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-lg w-56 max-h-72 overflow-auto py-1">
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 sticky top-0 bg-white">
                <button
                  onClick={() => setColumnFilters(prev => { const next = { ...prev }; delete next[col]; return next; })}
                  className="text-xs text-y-teal hover:underline cursor-pointer"
                >
                  {t("common.clear", { defaultValue: "Wissen" })}
                </button>
                <button
                  onClick={() => setOpenColumnFilter(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
              {uniqueValuesFor(col).map(v => {
                const checked = !allowed || allowed.has(v);
                return (
                  <label key={v} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const allValues = uniqueValuesFor(col);
                        setColumnFilters(prev => {
                          const current = prev[col] ? new Set(prev[col]) : new Set(allValues);
                          if (e.target.checked) current.add(v); else current.delete(v);
                          if (current.size === allValues.length) {
                            const next = { ...prev }; delete next[col]; return next;
                          }
                          return { ...prev, [col]: current };
                        });
                      }}
                      className="accent-y-teal cursor-pointer"
                    />
                    <span className="truncate">{v}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </span>
    );
  }

  // ─── Filter rows by company + column filters ───
  const filteredRows = useMemo(() => {
    let rows = flatRows;
    if (company) {
      rows = rows.filter(r => {
        if (!r.project) return r.employeeCompany === company;
        const projMatch = r.pmCompany ? r.pmCompany === company : r.projectCompany === company;
        if (projMatch) return true;
        if (r.employeeCompany === company) return true;
        return false;
      });
    }
    for (const [col, allowed] of Object.entries(columnFilters)) {
      if (!allowed || allowed.size === 0) continue;
      rows = rows.filter(r => allowed.has(getColumnValue(r, col)));
    }
    return rows;
  }, [flatRows, company, columnFilters, getColumnValue]);

  // ─── Group by project ───
  const grouped = useMemo(() => {
    const map = new Map<string, FlatRow[]>();
    for (const r of filteredRows) {
      const key = r.project || "(geen project)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Sort groups: most unbilled hours first, then by total hours
    return Array.from(map.entries()).sort((a, b) => {
      const unbilledA = a[1].filter(r => r.isBillable && !r.isBilled).reduce((s, r) => s + r.hours, 0);
      const unbilledB = b[1].filter(r => r.isBillable && !r.isBilled).reduce((s, r) => s + r.hours, 0);
      if (unbilledA > 0 && unbilledB === 0) return -1;
      if (unbilledA === 0 && unbilledB > 0) return 1;
      const totalA = a[1].reduce((s, r) => s + r.hours, 0);
      const totalB = b[1].reduce((s, r) => s + r.hours, 0);
      return totalB - totalA;
    });
  }, [filteredRows]);

  // When grouped-by-customer is on, re-order the project list so projects
  // belonging to the same customer are contiguous. Customer ordering: most
  // unbilled hours first, then alphabetic on customer name. Within a customer
  // the original `grouped` order is preserved (unbilled-first / total desc).
  // A free-text search filters by project key, project name, or customer.
  const displayGrouped = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    const matches = (projKey: string, rows: FlatRow[]): boolean => {
      if (!q) return true;
      const first = rows[0];
      if (projKey.toLowerCase().includes(q)) return true;
      if ((first?.projectName || "").toLowerCase().includes(q)) return true;
      if ((first?.customer || "").toLowerCase().includes(q)) return true;
      return false;
    };
    const filtered = grouped.filter(([k, rs]) => matches(k, rs));
    if (!groupByCustomer) return filtered;
    const byCustomer = new Map<string, [string, FlatRow[]][]>();
    for (const entry of filtered) {
      const cust = entry[1][0]?.customer || "(geen klant)";
      if (!byCustomer.has(cust)) byCustomer.set(cust, []);
      byCustomer.get(cust)!.push(entry);
    }
    const customerOrder = Array.from(byCustomer.entries()).sort((a, b) => {
      const unA = a[1].reduce((s, [, rs]) => s + rs.filter(r => r.isBillable && !r.isBilled).reduce((ss, rr) => ss + rr.hours, 0), 0);
      const unB = b[1].reduce((s, [, rs]) => s + rs.filter(r => r.isBillable && !r.isBilled).reduce((ss, rr) => ss + rr.hours, 0), 0);
      if (unA > 0 && unB === 0) return -1;
      if (unA === 0 && unB > 0) return 1;
      return a[0].localeCompare(b[0]);
    });
    const out: [string, FlatRow[]][] = [];
    for (const [, projs] of customerOrder) {
      // Within a customer: project key (= project number/name) descending,
      // so highest project number first. Other sorts apply to rows inside.
      projs.sort((a, b) => b[0].localeCompare(a[0]));
      out.push(...projs);
    }
    return out;
  }, [grouped, groupByCustomer, projectSearch]);

  // ─── Totals ───
  const totals = useMemo(() => {
    const t = { hours: 0, billable: 0, billed: 0, unbilled: 0, nonBillable: 0 };
    for (const r of filteredRows) {
      t.hours += r.hours;
      if (r.isBillable) {
        t.billable += r.hours;
        if (r.isBilled) t.billed += r.billingHours || r.hours;
        else t.unbilled += r.hours;
      } else {
        t.nonBillable += r.hours;
      }
    }
    return t;
  }, [filteredRows]);

  const warningCount = warnings.filter(w => w.severity === "error" || w.severity === "warning").length;

  // Sorting state for detail rows
  type SortCol = "dag" | "uren" | "medewerker" | "activiteit" | "taak" | "billable" | "gefact";
  const [sortCol, setSortCol] = useState<SortCol>("dag");
  const [sortAsc, setSortAsc] = useState(true);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortAsc(prev => !prev);
    else { setSortCol(col); setSortAsc(true); }
  }

  function sortRows(rows: FlatRow[]): FlatRow[] {
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "dag": cmp = (a.fromTime || "").localeCompare(b.fromTime || ""); break;
        case "uren": cmp = a.hours - b.hours; break;
        case "medewerker": cmp = a.employeeName.localeCompare(b.employeeName); break;
        case "activiteit": cmp = a.activityType.localeCompare(b.activityType); break;
        case "taak": cmp = (a.taskName || a.task).localeCompare(b.taskName || b.task); break;
        case "billable": cmp = (a.isBillable ? 1 : 0) - (b.isBillable ? 1 : 0); break;
        case "gefact": cmp = (a.isBilled ? 1 : 0) - (b.isBilled ? 1 : 0); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }

  const sortIndicator = (col: SortCol) =>
    sortCol === col ? (sortAsc ? " ▲" : " ▼") : "";

  const thClass = (col: SortCol) =>
    `text-left px-3 py-3 text-xs font-semibold cursor-pointer select-none hover:text-y-teal ${
      sortCol === col ? "text-y-teal underline" : "text-slate-600"
    }`;

  function toggleProject(proj: string) {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(proj)) next.delete(proj);
      else next.add(proj);
      return next;
    });
  }

  // ─── Selection helpers ───

  /** Get all billable+unbilled rows for a project */
  function getInvoiceableRowsForProject(projKey: string): FlatRow[] {
    const projRows = grouped.find(([k]) => k === projKey)?.[1] ?? [];
    return projRows.filter(r => r.isBillable && !r.isBilled);
  }

  function toggleProjectSelection(projKey: string) {
    const invoiceable = getInvoiceableRowsForProject(projKey);
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projKey)) {
        next.delete(projKey);
        // Deselect all rows of this project
        setSelectedRows(prevRows => {
          const nextRows = new Set(prevRows);
          for (const r of invoiceable) nextRows.delete(r.key);
          return nextRows;
        });
      } else {
        next.add(projKey);
        // Select all invoiceable rows of this project
        setSelectedRows(prevRows => {
          const nextRows = new Set(prevRows);
          for (const r of invoiceable) nextRows.add(r.key);
          return nextRows;
        });
      }
      return next;
    });
  }

  function toggleRowSelection(rowKey: string, projKey: string) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);

      // Update project selection state: project is selected if any of its rows are selected
      const invoiceable = getInvoiceableRowsForProject(projKey);
      const anySelected = invoiceable.some(r => next.has(r.key));
      setSelectedProjects(prevProj => {
        const nextProj = new Set(prevProj);
        if (anySelected) nextProj.add(projKey);
        else nextProj.delete(projKey);
        return nextProj;
      });

      return next;
    });
  }

  /** All selected rows as InvoiceRow[] for validation */
  const selectedFlatRows = useMemo(() => {
    return filteredRows.filter(r => selectedRows.has(r.key));
  }, [filteredRows, selectedRows]);

  const selectedProjectCount = selectedProjects.size;
  const selectedRowCount = selectedRows.size;

  // ─── Invoice creation flow ───

  async function handleFacturenClick() {
    if (selectedRowCount === 0) return;

    // Fetch billing rates for Activity Types
    try {
      const atList = await fetchAll<{ name: string; billing_rate?: number; costing_rate?: number }>(
        "Activity Type",
        ["name", "billing_rate", "costing_rate"],
        [],
      );
      const rateMap = new Map<string, number>();
      for (const at of atList) {
        rateMap.set(at.name, at.billing_rate ?? 0);
      }
      setBillingRates(rateMap);

      // Run validation
      const invoiceRows: InvoiceRow[] = selectedFlatRows;
      const draftNames = company
        ? draftTimesheets.filter(d => {
            const emp = employeeMap.get(d.employee);
            return (emp?.company ?? d.company) === company;
          }).map(d => d.name)
        : draftTimesheets.map(d => d.name);

      const ctx: InvoiceValidationContext = {
        company: company || "",
        billingRates: rateMap,
        draftTimesheetNames: draftNames,
      };

      const warns = runInvoiceValidation(invoiceRows, ctx);
      setInvoiceWarnings(warns);
      setInvoiceResults([]);
      setShowInvoiceModal(true);
    } catch (e) {
      alert(t("to_invoice.rates_fetch_error", { defaultValue: "Error fetching rates: {{msg}}", msg: e instanceof Error ? e.message : t("common.unknown", { defaultValue: "Unknown" }) }));
    }
  }

  async function handleConfirmCreateInvoices() {
    setInvoiceCreating(true);
    const results: typeof invoiceResults = [];

    // Fetch default tax templates per company (one-time)
    let taxTemplateMap = new Map<string, string>();
    try {
      const templates = await fetchList<{ name: string; company: string; is_default: number }>(
        "Sales Taxes and Charges Template",
        { fields: ["name", "company", "is_default"], filters: [["is_default", "=", 1]], limit_page_length: 50 },
      );
      for (const t of templates) {
        taxTemplateMap.set(t.company, t.name);
      }
    } catch { /* non-critical: SI creation may still work without */ }

    // Group selected rows by project
    const byProject = new Map<string, FlatRow[]>();
    for (const r of selectedFlatRows) {
      if (!r.project) continue;
      if (!byProject.has(r.project)) byProject.set(r.project, []);
      byProject.get(r.project)!.push(r);
    }

    for (const [projId, projRows] of byProject) {
      const first = projRows[0];
      const projInfo = projectMap.get(projId);
      // Company from project (multi-company support)
      const projCompany = projInfo?.company || first.projectCompany || company || "";

      try {
        // ── Timesheet-based items: group by activity_type ──
        const timesheetRows = projRows.filter(r => !r.taskBilling || r.taskBilling === "Timesheet based");
        const byActivity = new Map<string, FlatRow[]>();
        for (const r of timesheetRows) {
          const key = r.activityType || "(geen)";
          if (!byActivity.has(key)) byActivity.set(key, []);
          byActivity.get(key)!.push(r);
        }

        const items: Record<string, unknown>[] = [];
        for (const [activity, actRows] of byActivity) {
          const totalHours = actRows.reduce((s, r) => s + r.hours, 0);
          items.push({
            item_code: activity,
            qty: parseFloat(totalHours.toFixed(2)),
            project: projId,
          });
        }

        // ── Fixed Price / Milestone / Progress items: group by task ──
        const fixedRows = projRows.filter(r => r.taskBilling && r.taskBilling !== "Timesheet based");
        const byTask = new Map<string, FlatRow[]>();
        for (const r of fixedRows) {
          const key = r.task || r.taskName || "(geen taak)";
          if (!byTask.has(key)) byTask.set(key, []);
          byTask.get(key)!.push(r);
        }
        for (const [, taskRows] of byTask) {
          const tr = taskRows[0];
          const taskName = tr.taskName || tr.task;

          let matchedItemCode = "Aangenomen werk";
          let matchedUom: string | undefined;
          try {
            const matched = await fetchList<{ name: string; item_code: string; stock_uom: string }>("Item", {
              fields: ["name", "item_code", "stock_uom"],
              filters: [["item_name", "=", taskName]],
              limit_page_length: 2,
            });
            if (matched.length >= 1) {
              matchedItemCode = matched[0].item_code;
              matchedUom = matched[0].stock_uom;
              if (matched.length > 1) {
                console.warn(`[ToInvoice] Meerdere Items met item_name "${taskName}", pakte eerste`);
              }
            }
          } catch {
            // lookup faalt → fallback naar "Aangenomen werk"
          }

          items.push({
            item_code: matchedItemCode,
            item_name: taskName,
            qty: 1,
            rate: 0,
            price_list_rate: 0,
            project: projId,
            print_hide: 1,
            ...(matchedUom ? { uom: matchedUom } : {}),
          });
        }

        if (items.length === 0) {
          results.push({ project: projId, projectName: first.projectName, siName: "", error: t("to_invoice.no_billable_lines", { defaultValue: "No billable lines" }) });
          continue;
        }

        // ── Timesheets child table: link individual time_logs ──
        const timesheetEntries: Record<string, unknown>[] = [];
        for (const r of projRows) {
          timesheetEntries.push({
            time_sheet: r.tsName,
            timesheet_detail: r.key,
            activity_type: r.activityType,
            description: r.description || r.activityType,
            billing_hours: r.hours,
            from_time: r.fromTime,
            to_time: r.toTime || "",
            project_name: first.projectName,
          });
        }

        // ── Create DRAFT Sales Invoice ──
        // ERPNext fills: naming_series, debit_to, tax_category, letter_head,
        // payment_terms, rate (Price List), uom, income_account, cost_center
        const taxTemplate = taxTemplateMap.get(projCompany) || "";
        const si = await createDocument<{ name: string }>("Sales Invoice", {
          customer: projInfo?.customer || projInfo?.customer_name || first.customer,
          company: projCompany,
          project: projId,
          currency: "EUR",
          ...(taxTemplate ? { taxes_and_charges: taxTemplate } : {}),
          items,
          timesheets: timesheetEntries,
        });

        // ── Naming series validation: check volgnummer ──
        const abbr = companyAbbrMap.get(projCompany);
        const yy = new Date().getFullYear().toString().slice(2);
        const expectedPrefix = abbr ? `${yy}${abbr}-` : null;
        let namingWarning = "";

        if (expectedPrefix && !si.name.startsWith(expectedPrefix)) {
          namingWarning = `Company mismatch: verwacht ${expectedPrefix}xxxxx, gekregen ${si.name}`;
        } else if (expectedPrefix) {
          // Check volgnummer: haal laatste SI op voor deze company/jaar
          try {
            const lastSIs = await fetchList<{ name: string }>("Sales Invoice", {
              fields: ["name"],
              filters: [["name", "like", `${expectedPrefix}%`], ["name", "!=", si.name]],
              order_by: "name desc",
              limit_page_length: 1,
            });
            if (lastSIs.length > 0) {
              const lastNum = parseInt(lastSIs[0].name.split("-").pop() || "0", 10);
              const newNum = parseInt(si.name.split("-").pop() || "0", 10);
              if (newNum !== lastNum + 1) {
                namingWarning = `Volgnummer sprong: vorige was ${lastSIs[0].name}, nieuwe is ${si.name} (verwacht ${expectedPrefix}${String(lastNum + 1).padStart(5, "0")})`;
              }
            }
          } catch { /* non-critical */ }
        }

        results.push({
          project: projId,
          projectName: first.projectName,
          siName: si.name,
          ...(namingWarning ? { error: namingWarning } : {}),
        });

        // ── Post-creation: set custom_is_billed on processed time_logs ──
        if (!SKIP_BILLED_CHECK) {
          for (const r of projRows) {
            try {
              await updateDocument("Timesheet Detail", r.key, { custom_is_billed: 1 });
            } catch { /* non-critical: SI is created, billed flag is secondary */ }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Onbekend";
        results.push({ project: projId, projectName: first.projectName, siName: "", error: msg });
      }
    }

    setInvoiceResults(results);
    setInvoiceCreating(false);
  }

  // ─── Render ───

  return (
    <div className="space-y-4">
      {/* Period presets */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-500">{t("common.period")}:</span>
        {([
          ["vorige-maand", t("to_invoice.period_last_month", { defaultValue: "Last month" })],
          ["dit-jaar", t("to_invoice.period_this_year", { defaultValue: "This year" })],
        ] as [Period, string][]).map(([p, label]) => {
          const dates = getPeriodDates(p);
          const isActive = from === dates.from && to === dates.to;
          return (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                isActive ? "bg-y-teal text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          );
        })}
        {from && to && (
          <span className="text-xs text-slate-400 ml-2">
            {from} {t("to_invoice.through", { defaultValue: "through" })} {to}
          </span>
        )}
        <button
          onClick={() => setShowInfo(true)}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-y-teal hover:bg-slate-100 rounded-lg cursor-pointer"
          title="Hoe wordt een factuur opgebouwd?"
        >
          <Info size={14} />
          Hoe werkt facturatie?
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Clock} color="slate" label={t("to_invoice.kpi_total_hours", { defaultValue: "Total hours" })} value={totals.hours} loading={loading} suffix="u" />
        <KpiCard icon={FileText} color="teal" label={t("to_invoice.kpi_billable", { defaultValue: "Billable" })} value={totals.billable} loading={loading} suffix="u" />
        <KpiCard icon={TrendingUp} color="green" label={t("to_invoice.kpi_invoiced", { defaultValue: "Invoiced" })} value={totals.billed} loading={loading} suffix="u" />
        <KpiCard icon={AlertTriangle} color="orange" label={t("to_invoice.kpi_to_invoice", { defaultValue: "To invoice" })} value={totals.unbilled} loading={loading} suffix="u" highlight />
        <KpiCard icon={Users} color="slate" label={t("to_invoice.kpi_non_billable", { defaultValue: "Non-billable" })} value={totals.nonBillable} loading={loading} suffix="u" />
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <button
            onClick={() => setExpandedWarnings(!expandedWarnings)}
            className="w-full px-4 py-3 flex items-center gap-2 bg-amber-50 border-b border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
          >
            {expandedWarnings ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {t("to_invoice.warnings_count", { count: warningCount })}
            </span>
            {warnings.filter(w => w.severity === "info").length > 0 && (
              <span className="text-xs text-slate-400 ml-1">
                + {warnings.filter(w => w.severity === "info").length} info
              </span>
            )}
          </button>
          {expandedWarnings && (
            <div className="divide-y divide-slate-100">
              {warnings.map((w, i) => (
                <div key={i} className={`px-4 py-2.5 flex items-start gap-3 ${
                  w.severity === "error" ? "bg-red-50" : w.severity === "warning" ? "bg-amber-50/50" : "bg-blue-50/50"
                }`}>
                  <span className={`mt-0.5 ${
                    w.severity === "error" ? "text-red-500" : w.severity === "warning" ? "text-amber-500" : "text-blue-400"
                  }`}>
                    {w.severity === "info" ? <Info size={14} /> : <AlertTriangle size={14} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{w.message}</p>
                    {w.details && (
                      <pre className="text-[10px] text-slate-500 mt-1 whitespace-pre-wrap font-mono">{w.details}</pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main table: flat rows grouped by project */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <div className="animate-spin w-6 h-6 border-2 border-y-teal border-t-transparent rounded-full mx-auto mb-2" />
          {t("to_invoice.analyzing_timesheets", { defaultValue: "Analyzing timesheets..." })}
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-12 text-center text-slate-400">{t("to_invoice.no_timesheets_in_period", { defaultValue: "No timesheets found in this period" })}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Group-by-customer toggle */}
          <div className="flex items-center justify-end px-4 py-2 border-b border-slate-200 bg-white">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={groupByCustomer}
                onChange={(e) => setGroupByCustomer(e.target.checked)}
                className="accent-y-teal cursor-pointer"
              />
              {t("to_invoice.group_by_customer", { defaultValue: "Groepeer per klant" })}
            </label>
          </div>

          {/* Facturen button bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative w-64 max-w-full">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder={t("to_invoice.search_placeholder", { defaultValue: "Zoek klant, projectnr, naam..." })}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-y-teal"
                />
                {projectSearch && (
                  <button
                    onClick={() => setProjectSearch("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={t("common.clear", { defaultValue: "Wissen" })}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {selectedProjectCount > 0
                  ? t("to_invoice.selection_summary", {
                      defaultValue: "{{projects}} project(s), {{rows}} line(s) selected",
                      projects: selectedProjectCount,
                      rows: selectedRowCount,
                    })
                  : t("to_invoice.select_projects_hint", { defaultValue: "Select projects to invoice" })}
              </div>
            </div>
            <button
              onClick={handleFacturenClick}
              disabled={selectedRowCount === 0}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
                selectedRowCount > 0
                  ? "bg-y-teal text-white hover:bg-y-teal/90 shadow-sm"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <FileText size={14} />
              {t("to_invoice.create_invoices", { defaultValue: "Create invoices" })}
            </button>
          </div>

          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-10 px-2 py-3" />
                <th className={thClass("dag")} onClick={() => toggleSort("dag")}>{t("to_invoice.col_day", { defaultValue: "Day" })}{sortIndicator("dag")}</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("to_invoice.col_time", { defaultValue: "Time" })}</th>
                <th className={`${thClass("uren")} text-right`} onClick={() => toggleSort("uren")}>{t("to_invoice.col_hours", { defaultValue: "Hours" })}{sortIndicator("uren")}</th>
                <th className={thClass("medewerker")} onClick={() => toggleSort("medewerker")}>
                  <span className="inline-flex items-center gap-1">{t("common.employee")}{sortIndicator("medewerker")}{renderColumnFilter("medewerker")}</span>
                </th>
                <th className={thClass("activiteit")} onClick={() => toggleSort("activiteit")}>
                  <span className="inline-flex items-center gap-1">{t("to_invoice.col_activity", { defaultValue: "Activity" })}{sortIndicator("activiteit")}{renderColumnFilter("activiteit")}</span>
                </th>
                <th className={thClass("taak")} onClick={() => toggleSort("taak")}>
                  <span className="inline-flex items-center gap-1">{t("to_invoice.col_task", { defaultValue: "Task" })}{sortIndicator("taak")}{renderColumnFilter("taak")}</span>
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("to_invoice.col_description", { defaultValue: "Description" })}</th>
                <th className={`${thClass("billable")} text-center`} onClick={() => toggleSort("billable")}>
                  <span className="inline-flex items-center gap-1">{t("to_invoice.col_billable", { defaultValue: "Billable" })}{sortIndicator("billable")}{renderColumnFilter("billable")}</span>
                </th>
                <th className={`${thClass("gefact")} text-center`} onClick={() => toggleSort("gefact")}>
                  <span className="inline-flex items-center gap-1">{t("to_invoice.col_invoice", { defaultValue: "Invoice" })}{sortIndicator("gefact")}{renderColumnFilter("gefact")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let prevCustomer: string | null = null;
                return displayGrouped.map(([projKey, rows]) => {
                  const isExpanded = expandedProjects.has(projKey);
                  const projTotal = rows.reduce((s, r) => s + r.hours, 0);
                  const projBillable = rows.filter(r => r.isBillable).reduce((s, r) => s + r.hours, 0);
                  const projBilled = rows.filter(r => r.isBilled).reduce((s, r) => s + (r.billingHours || r.hours), 0);
                  const projUnbilled = rows.filter(r => r.isBillable && !r.isBilled).reduce((s, r) => s + r.hours, 0);
                  const projNonBillable = rows.filter(r => !r.isBillable).reduce((s, r) => s + r.hours, 0);
                  const first = rows[0];
                  const pRec = projectMap.get(projKey);
                  const hasUnbilled = projUnbilled > 0;
                  const customer = first?.customer || "(geen klant)";
                  const showCustomerHeader = groupByCustomer && customer !== prevCustomer;
                  prevCustomer = customer;

                  return (
                    <Fragment key={projKey}>
                      {showCustomerHeader && (
                        <tr className="bg-slate-200">
                          <td colSpan={10} className="px-4 py-2 text-sm font-bold text-slate-800">
                            {customer}
                          </td>
                        </tr>
                      )}
                    {/* Project group header */}
                    <tr
                      className={`border-b border-slate-200 cursor-pointer hover:bg-slate-100 ${
                        hasUnbilled ? "bg-orange-50" : "bg-slate-50"
                      }`}
                    >
                      <td className="px-2 py-2.5 text-slate-400" onClick={(e) => { e.stopPropagation(); }}>
                        <div className="flex items-center gap-1">
                          {hasUnbilled && projKey !== "(geen project)" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleProjectSelection(projKey); }}
                              className="text-slate-400 hover:text-y-teal transition-colors cursor-pointer"
                              title={t("to_invoice.select_project", { defaultValue: "Select project" })}
                            >
                              {selectedProjects.has(projKey)
                                ? <CheckSquare size={14} className="text-y-teal" />
                                : <Square size={14} />
                              }
                            </button>
                          )}
                          <button
                            onClick={() => toggleProject(projKey)}
                            className="cursor-pointer"
                          >
                            <ChevronRight
                              size={14}
                              className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            />
                          </button>
                        </div>
                      </td>
                      <td colSpan={2} className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {projKey === "(geen project)" ? (
                            <span
                              className="text-sm font-semibold text-slate-800 cursor-pointer"
                              onClick={() => toggleProject(projKey)}
                            >
                              {t("to_invoice.no_project", { defaultValue: "(no project)" })}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openProjectInline(projKey); }}
                              className="text-sm font-semibold text-y-teal hover:text-y-teal-dark hover:underline cursor-pointer text-left"
                              title={t("to_invoice.open_project", { defaultValue: "Open project" })}
                            >
                              {(first?.projectName && first.projectName !== projKey) ? `${projKey} — ${first.projectName}` : projKey}
                            </button>
                          )}
                          {first?.customer && (
                            <span className="text-[10px] text-slate-400">{first.customer}</span>
                          )}
                          {pRec?.sales_order && (
                            <a
                              href={`${getErpNextLinkUrl()}/sales-order/${encodeURIComponent(pRec.sales_order)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-y-teal/10 text-y-teal hover:bg-y-teal/20 font-mono cursor-pointer"
                              title={t("to_invoice.open_sales_order", { defaultValue: "Open sales order" })}
                            >
                              SO {pRec.sales_order}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-slate-700">
                        {fmt(projTotal)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">
                        {t("to_invoice.rows_count", { defaultValue: "{{count}} lines", count: rows.length })}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">
                        {projBillable > 0 && <span className="text-y-teal">{fmt(projBillable)}b</span>}
                        {projNonBillable > 0 && <span className="text-slate-400 ml-1">{fmt(projNonBillable)}nb</span>}
                      </td>
                      <td />
                      <td />
                      <td />
                      <td className={`px-3 py-2.5 text-xs font-semibold text-center ${hasUnbilled ? "text-orange-600" : "text-green-600"}`}>
                        {hasUnbilled ? t("to_invoice.to_invoice_short", { defaultValue: "{{h}} to inv.", h: fmt(projUnbilled) }) : projBilled > 0 ? `✓ ${fmt(projBilled)}` : "✓"}
                      </td>
                    </tr>
                    {/* Expanded: individual time_log rows */}
                    {isExpanded && sortRows(rows)
                      .map((row) => {
                        // Highlighting (same logic as timesheetValidation)
                        const billingMismatchHl = row.isBillable && row.billingHours > 0 && row.hours !== row.billingHours ? WARN_HL : "";
                        const hoursHl = row.hours > 4 ? WARN_HL : billingMismatchHl;
                        const actHl = !row.activityType ? ERR_HL : "";
                        const taskHl = !row.task ? WARN_HL : "";
                        const companyMismatch = row.employeeCompany !== row.projectCompany && !!row.projectCompany;

                        return (
                          <tr key={row.key} className={`border-b border-slate-50 hover:bg-slate-50 text-xs ${
                            row.isBillable && !row.isBilled ? "bg-orange-50/30" : ""
                          } ${selectedRows.has(row.key) ? (row.customIsBilled ? "bg-red-50/50" : "bg-y-teal/5") : ""}`}>
                            <td className="px-2 py-1.5 text-center">
                              {row.isBillable && !row.isBilled && (
                                <div className="relative">
                                  <button
                                    onClick={() => toggleRowSelection(row.key, projKey)}
                                    className="text-slate-400 hover:text-y-teal transition-colors cursor-pointer"
                                  >
                                    {selectedRows.has(row.key)
                                      ? <CheckSquare size={12} className={row.customIsBilled ? "text-red-500" : "text-y-teal"} />
                                      : <Square size={12} />
                                    }
                                  </button>
                                  {selectedRows.has(row.key) && row.customIsBilled && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" title={t("to_invoice.already_on_draft", { defaultValue: "Already on draft invoice" })} />
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-slate-500">
                              {getDayLabel(row.fromTime)} {formatDate(row.fromTime)}
                            </td>
                            <td className="px-3 py-1.5 text-slate-500 font-mono">
                              {formatTimeRange(row.fromTime, row.hours)}
                            </td>
                            <td className={`px-3 py-1.5 text-right font-mono text-slate-700 ${hoursHl}`}>
                              {fmt(row.hours)}
                              {row.billingHours > 0 && row.billingHours !== row.hours && (
                                <span className="text-amber-500 ml-0.5">({fmt(row.billingHours)})</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <span className={companyMismatch ? "text-amber-700 font-medium" : "text-slate-700"}>
                                {row.employeeName}
                              </span>
                              {companyMismatch && (
                                <span className="text-[9px] text-amber-500 ml-1" title={`Employee: ${row.employeeCompany}`}>⚠</span>
                              )}
                            </td>
                            <td className={`px-3 py-1.5 text-slate-500 ${actHl}`}>{row.activityType || "—"}</td>
                            <td className={`px-3 py-1.5 text-slate-500 max-w-[140px] truncate ${taskHl}`} title={`${row.taskName || row.task}${row.taskBilling ? ` (${row.taskBilling})` : ""}`}>
                              {row.taskBilling && (
                                <span className="inline-flex items-center mr-1" title={row.taskBilling}>
                                  {row.taskBilling === "Timesheet based" ? (
                                    <Timer size={12} className="text-y-teal" />
                                  ) : (
                                    <Diamond size={12} className="text-violet-500" />
                                  )}
                                </span>
                              )}
                              {row.task ? (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openTaskInline(row.task); }}
                                  className="text-y-teal hover:text-y-teal-dark hover:underline cursor-pointer text-left"
                                  title={t("to_invoice.open_task", { defaultValue: "Open taak" })}
                                >
                                  {row.taskName || row.task}
                                </button>
                              ) : (
                                <span>—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-slate-400 max-w-[150px] truncate" title={row.description}>
                              {row.description || "—"}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {row.isBillable
                                ? <span className="text-green-600">✓</span>
                                : <span className="text-slate-300">—</span>
                              }
                            </td>
                            <td className="px-3 py-1.5 text-center text-[10px] font-mono">
                              {row.salesInvoice ? (
                                <a
                                  href={`${getErpNextLinkUrl()}/sales-invoice/${row.salesInvoice}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-600 hover:underline"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {row.salesInvoice}
                                </a>
                              ) : row.isBillable ? (
                                <span className="text-orange-500 font-semibold">✗</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
                });
              })()}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-sm">
                <td />
                <td colSpan={2} className="px-3 py-2.5 text-slate-600">
                  {grouped.length} projecten · {filteredRows.length} regels
                </td>
                <td className="px-3 py-2.5 text-right font-mono">{fmt(totals.hours)}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {fmt(totals.billable)}b / {fmt(totals.nonBillable)}nb
                </td>
                <td colSpan={2} />
                <td />
                <td />
                <td className="px-3 py-2.5 text-center font-mono text-xs">
                  <span className="text-green-600">{fmt(totals.billed)}</span>
                  {totals.unbilled > 0 && <span className="text-orange-600 ml-2">{fmt(totals.unbilled)} te fact.</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Draft timesheets detail — filtered by company */}
      {(() => {
        const companyDrafts = company
          ? draftTimesheets.filter(d => (employeeMapRef.current.get(d.employee)?.company ?? d.company) === company)
          : draftTimesheets;
        return companyDrafts.length > 0 ? (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <h4 className="text-sm font-semibold text-red-800 mb-2">
              Draft timesheets ({companyDrafts.length}) — niet meegeteld in bovenstaande analyse
            </h4>
            <div className="space-y-1">
              {companyDrafts.map(ts => (
                <div key={ts.name} className="text-xs text-red-700 flex items-center gap-2">
                  <span className="font-mono">{ts.name}</span>
                  <span>{ts.employee_name}</span>
                  <span className="text-red-400">{ts.start_date}</span>
                  <span className="font-semibold">{ts.total_hours.toFixed(1)}u</span>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* ─── Invoice Modal ─── */}
      {showInvoiceModal && (
        <InvoiceModal
          warnings={invoiceWarnings}
          selectedRows={selectedFlatRows}
          billingRates={billingRates}
          creating={invoiceCreating}
          results={invoiceResults}
          onConfirm={handleConfirmCreateInvoices}
          onClose={() => { setShowInvoiceModal(false); setInvoiceResults([]); }}
          onSendInvoice={(siName) => setSendInvoiceTarget(siName)}
          sentSiNames={sentSiNames}
          projectMap={projectMap}
          companyAbbrMap={companyAbbrMap}
        />
      )}

      {/* ─── Send Invoice Modal (opened from results-lijst van aanmaak) ─── */}
      {sendInvoiceTarget && (
        <SendInvoiceModal
          invoiceName={sendInvoiceTarget}
          mode="draft"
          onClose={() => setSendInvoiceTarget(null)}
          onSent={() => {
            const sent = sendInvoiceTarget;
            setSentSiNames(prev => {
              const next = new Set(prev);
              next.add(sent);
              return next;
            });
            setToast(t("invoice_email.sent_toast", { defaultValue: `Factuur ${sent} verzonden` }));
          }}
        />
      )}

      {/* Global toast (verzending-feedback uit SendInvoiceModal) */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-fade-in">
          <div className="flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg bg-slate-800 text-white">
            <Check size={16} className="text-green-400" />
            <span className="text-sm">{toast}</span>
          </div>
        </div>
      )}

      {/* In-page Project detail panel — same component as /projects */}
      {inlineProject && (
        <ProjectDetail
          project={inlineProject}
          projectHours={new Map()}
          onClose={() => setInlineProject(null)}
        />
      )}

      {/* In-page Task detail panel — same component as /tasks */}
      {inlineTask && (
        <TaskDetail
          task={inlineTask}
          mode="edit"
          onClose={() => setInlineTask(null)}
          getDisplayName={displayNameByEmail}
          projectName={projects.find((p) => p.name === inlineTask.project)?.project_name || ""}
          projects={projects}
          employees={employees}
        />
      )}

      {/* Info-overlay: hoe wordt een Sales Invoice opgebouwd uit
          geselecteerde uren. Korte voorzet — volledige beschrijving in
          docs/invoicing-workflow.md (sectie "Stap-voor-stap"). */}
      <InfoOverlay
        open={showInfo}
        title="Hoe wordt een factuur opgebouwd?"
        onClose={() => setShowInfo(false)}
        footer={<>Volledige uitleg: <code className="text-y-teal">docs/invoicing-workflow.md</code></>}
      >
        <p>
          Als je in deze tab uren selecteert en op "Factureer geselecteerd"
          drukt, splitst Y-app de geselecteerde rijen per project en
          bouwt daaruit één <strong>Sales Invoice</strong> per project.
          Hoe een uurregel op de factuur landt, hangt af van het
          <em> billing-type</em> van de gekoppelde taak.
        </p>

        <div>
          <p>
            Voor elke geselecteerde time_log haalt Y-app de bijbehorende
            <code className="text-xs"> Task.custom_billing_type</code> op.
            Dat is dé schakelaar tussen twee routes: <strong>Timesheet
            based</strong> (uurtarief per regel) of <strong>Fixed price</strong>
            (vaste prijs per taak). Taken zonder waarde tellen als
            Timesheet based.
          </p>
        </div>

        <div className="border-l-2 border-y-teal pl-3">
          <h4 className="font-semibold text-slate-800 mb-1">A. Task op urenbasis (Timesheet based)</h4>
          <p>
            Rijen worden gegroepeerd op <code className="text-xs">activity_type</code>
            (bv. "Senior Bouwkundige"). Per groep komt er één regel op
            de factuur met <code className="text-xs">item_code = de
            Activity Type-naam</code> en als aantal de som van de uren.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            <strong>Voorwaarde:</strong> per Activity Type moet er een
            gelijknamig <strong>Item</strong>-record bestaan in ERPNext
            (Activity Type "Senior Bouwkundige" → Item "Senior Bouwkundige").
            Anders weigert ERPNext de Sales Invoice met "Item not found".
          </p>
          <p className="mt-2 font-medium text-slate-700">Tarief-berekening door ERPNext (in deze volgorde):</p>
          <ol className="list-decimal list-inside text-xs text-slate-600 mt-1 space-y-0.5">
            <li><strong>Item Price</strong> in een actief Price List (klant- of company-specifiek)</li>
            <li><strong>Activity Type → <code>billing_rate</code></strong> — het standaard uurtarief</li>
            <li><strong>Item → <code>standard_rate</code></strong> — fallback</li>
          </ol>
          <p className="mt-1 text-xs text-slate-500">
            Wil je een klant een afwijkend tarief geven? Gebruik een
            klant-specifiek Price List, niet de Activity Type — die
            geldt voor iedereen.
          </p>
        </div>

        <div className="border-l-2 border-amber-400 pl-3">
          <h4 className="font-semibold text-slate-800 mb-1">B. Task fixed price</h4>
          <p>
            Voor taken met <code className="text-xs">custom_billing_type ≠
            "Timesheet based"</code> komt er één regel per taak op de
            factuur (qty = 1). Y-app zoekt het Item op via
            <strong> item_name = taaknaam</strong> en gebruikt dat item_code
            op de factuurregel. ERPNext past daar automatisch de
            price-list rate / <code className="text-xs">standard_rate</code>
            van dat Item op toe — dus de overeengekomen prijs uit de
            opdrachtbevestiging komt zo vanzelf op de factuur, mits het
            Item correct is opgevoerd in ERPNext.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            <strong>Voorwaarde:</strong> voor elke Fixed Price taak moet
            er een Item bestaan met <code className="text-xs">item_name</code>
            gelijk aan de taaknaam, en een geldige Item Price (of
            <code className="text-xs"> standard_rate</code>) in Standard
            Selling. Conventie: <em>"Engineering &lt;taaknaam&gt;"</em>
            als item_code, item_group "Engineering Advies".
          </p>
          <p className="mt-2 text-xs text-slate-500">
            <strong>Geen match?</strong> Dan valt Y-app terug op
            <code className="text-xs"> item_code = "Aangenomen werk"</code>
            (rate uit de generieke Item Price van dat item). Check de
            rate handmatig voor je submit — die kan afwijken van de
            opdrachtbevestiging.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-slate-800 mb-1">Print: alleen Timesheet-based uren in de urenstaat</h4>
          <p>
            De Print Format <strong>"3BM Factuur+Smart Urenstaat"</strong>
            heeft een Jinja-filter dat per timesheet-rij de Task ophaalt
            en alleen de rijen toont waarvan
            <code className="text-xs"> custom_billing_type ==
            "Timesheet based"</code>. Vaste-prijs uren worden
            <strong> niet</strong> in de urenstaat-bijlage afgedrukt.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-slate-800 mb-1">Álle uren worden gekoppeld</h4>
          <p>
            Onafhankelijk van het billing-type wordt élke geselecteerde
            time_log opgenomen in de Sales Invoice's
            <code className="text-xs"> timesheets</code> child-table. Ook
            de vaste-prijs-uren <em>hangen aan de factuur</em> — niet
            zichtbaar op de PDF, wel traceerbaar.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Waarom? Zo verdwijnen die uren uit de Te-factureren-lijst
            (= "afgehandeld") en kun je in ERPNext desk altijd zien
            <em> waar</em> uren naartoe zijn gegaan. Anders blijven ze
            eeuwig "open" in het overzicht.
          </p>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 text-xs">
          <div className="font-semibold text-slate-700 mb-1">Resultaat per uur-type</div>
          <table className="w-full">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left py-1">Taak-type</th>
                <th className="text-left py-1">Regel op PDF</th>
                <th className="text-left py-1">In urenstaat</th>
                <th className="text-left py-1">Gelinkt</th>
              </tr>
            </thead>
            <tbody className="text-slate-600">
              <tr className="border-t border-slate-200">
                <td className="py-1">Timesheet based</td>
                <td className="py-1 text-green-700">✓ per Activity Type</td>
                <td className="py-1 text-green-700">✓ ja</td>
                <td className="py-1 text-green-700">✓ ja</td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="py-1">Fixed price</td>
                <td className="py-1 text-slate-700">Item-rate per taak</td>
                <td className="py-1 text-slate-400">— nee</td>
                <td className="py-1 text-green-700">✓ ja (zonder spec)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </InfoOverlay>
    </div>
  );
}

// ─── Invoice Modal ───

function InvoiceModal({
  warnings, selectedRows, billingRates, creating, results, onConfirm, onClose, onSendInvoice, sentSiNames, projectMap, companyAbbrMap,
}: {
  warnings: InvoiceWarning[];
  selectedRows: FlatRow[];
  billingRates: Map<string, number>;
  creating: boolean;
  results: { project: string; projectName: string; siName: string; error?: string }[];
  onConfirm: () => void;
  onClose: () => void;
  onSendInvoice?: (siName: string) => void;
  sentSiNames?: Set<string>;
  projectMap: Map<string, { name: string; project_name: string; company: string; customer?: string; customer_name?: string }>;
  companyAbbrMap: Map<string, string>;
}) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasBlockingWarnings = warnings.some(w => w.blocking);
  const hasResults = results.length > 0;
  const allSuccess = hasResults && results.every(r => r.siName && !r.error);
  const someSuccess = hasResults && results.some(r => r.siName && !r.error);

  function jumpToDraftInvoices() {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "alle");
    next.set("status", "Draft");
    setSearchParams(next, { replace: false });
    onClose();
  }

  // Group selected rows by project for preview
  const byProject = useMemo(() => {
    const m = new Map<string, FlatRow[]>();
    for (const r of selectedRows) {
      if (!r.project) continue;
      if (!m.has(r.project)) m.set(r.project, []);
      m.get(r.project)!.push(r);
    }
    return Array.from(m.entries());
  }, [selectedRows]);

  // ─── Factuurnummer-voorspelling per project ───
  // Per company haalt we (a) hoogste bestaande SI met prefix `${yy}${abbr}-`,
  // en (b) Series-counter in ERPNext. Bij mismatch tussen die twee tonen we
  // een waarschuwing — dat betekent vaak een geannuleerde SI of een handmatige
  // counter-reset in ERPNext.
  type CompanySeries = { prefix: string; lastNum: number; counter: number | null };
  const [seriesByCompany, setSeriesByCompany] = useState<Map<string, CompanySeries>>(new Map());

  useEffect(() => {
    if (hasResults) return; // alleen voorspellen in preview-fase
    const yy = new Date().getFullYear().toString().slice(2);
    const companies = new Set<string>();
    for (const [projId] of byProject) {
      const c = projectMap.get(projId)?.company;
      if (c) companies.add(c);
    }
    let cancelled = false;
    (async () => {
      const next = new Map<string, CompanySeries>();
      for (const company of companies) {
        const abbr = companyAbbrMap.get(company);
        if (!abbr) continue;
        const prefix = `${yy}${abbr}-`;
        let lastNum = 0;
        let counter: number | null = null;
        try {
          const lastSIs = await fetchList<{ name: string }>("Sales Invoice", {
            fields: ["name"],
            filters: [["name", "like", `${prefix}%`]],
            order_by: "name desc",
            limit_page_length: 1,
          });
          if (lastSIs.length > 0) {
            lastNum = parseInt(lastSIs[0].name.split("-").pop() || "0", 10) || 0;
          }
        } catch { /* non-critical */ }
        try {
          const series = await fetchDocument<{ current?: number }>("Series", prefix);
          counter = typeof series.current === "number" ? series.current : null;
        } catch { /* Series doc kan ontbreken voor nieuwe prefix */ }
        next.set(company, { prefix, lastNum, counter });
      }
      if (!cancelled) setSeriesByCompany(next);
    })();
    return () => { cancelled = true; };
  }, [byProject, projectMap, companyAbbrMap, hasResults]);

  // Voorspel per project een opeenvolgend nummer per company (op volgorde van byProject).
  const predictions = useMemo(() => {
    const offset = new Map<string, number>(); // company → reeds gebruikte slots
    const out = new Map<string, { predicted: string; lastSI: string; counter: number | null; mismatch: boolean }>();
    for (const [projId] of byProject) {
      const company = projectMap.get(projId)?.company || "";
      const s = seriesByCompany.get(company);
      if (!s) continue;
      const used = offset.get(company) ?? 0;
      const base = Math.max(s.lastNum, s.counter ?? 0);
      const newNum = base + used + 1;
      const predicted = `${s.prefix}${String(newNum).padStart(5, "0")}`;
      const lastSI = s.lastNum > 0 ? `${s.prefix}${String(s.lastNum).padStart(5, "0")}` : "";
      const mismatch = s.counter !== null && s.counter !== s.lastNum;
      out.set(projId, { predicted, lastSI, counter: s.counter, mismatch });
      offset.set(company, used + 1);
    }
    return out;
  }, [byProject, projectMap, seriesByCompany]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between ${
          hasResults
            ? (allSuccess ? "bg-green-50" : "bg-amber-50")
            : hasBlockingWarnings ? "bg-red-50" : warnings.length > 0 ? "bg-amber-50" : "bg-green-50"
        }`}>
          <div className="flex items-center gap-3">
            {hasResults ? (
              allSuccess
                ? <ShieldCheck className="text-green-600" size={20} />
                : <AlertTriangle className="text-amber-600" size={20} />
            ) : hasBlockingWarnings ? (
              <AlertTriangle className="text-red-600" size={20} />
            ) : warnings.length > 0 ? (
              <AlertTriangle className="text-amber-600" size={20} />
            ) : (
              <ShieldCheck className="text-green-600" size={20} />
            )}
            <h2 className="text-lg font-semibold text-slate-800">
              {hasResults ? t("to_invoice.result_title", { defaultValue: "Result" }) : t("to_invoice.create_invoices")}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Results view */}
          {hasResults && (
            <div className="space-y-2">
              {results.map((r, i) => {
                const isSent = !!(r.siName && sentSiNames?.has(r.siName));
                return (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${
                  r.error ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
                }`}>
                  <div>
                    <span className="text-sm font-medium text-slate-700">{r.projectName && r.projectName !== r.project ? `${r.project} — ${r.projectName}` : r.project}</span>
                    {r.error && <p className="text-xs text-red-600 mt-0.5">{r.error}</p>}
                  </div>
                  {r.siName && (
                    <div className="flex items-center gap-2">
                      {onSendInvoice && (
                        isSent ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded border border-emerald-200 cursor-default"
                            title={t("invoice_email.sent_label", { defaultValue: "Verzonden" })}
                          >
                            <Check size={12} />
                            {t("invoice_email.sent_label", { defaultValue: "Verzonden" })}
                          </span>
                        ) : (
                          <button
                            onClick={() => onSendInvoice(r.siName)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-y-teal/10 text-y-teal-dark rounded hover:bg-y-teal/20 cursor-pointer"
                            title={t("invoice_email.preview_and_send", { defaultValue: "Bekijken & Versturen" })}
                          >
                            <Send size={12} />
                            {t("invoice_email.preview_and_send", { defaultValue: "Bekijken & Versturen" })}
                          </button>
                        )
                      )}
                      <a
                        href={`${getErpNextLinkUrl()}/sales-invoice/${r.siName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm font-mono text-y-teal hover:underline"
                      >
                        {r.siName} <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {/* Warnings */}
          {!hasResults && warnings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-600">
                Waarschuwingen ({warnings.length})
              </h3>
              {warnings.map((w, i) => (
                <div key={i} className={`p-3 rounded-lg border ${
                  w.severity === "error" ? "bg-red-50 border-red-200" :
                  w.severity === "warning" ? "bg-amber-50 border-amber-200" :
                  "bg-blue-50 border-blue-200"
                }`}>
                  <div className="flex items-start gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${invoiceWarningLabels[w.type].color}`}>
                      {invoiceWarningLabels[w.type].label}
                    </span>
                    {w.blocking && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">BLOKKEREND</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{w.message}</p>
                  {w.details && (
                    <pre className="text-[10px] text-slate-500 mt-1 whitespace-pre-wrap font-mono">{w.details}</pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Preview: what will be created */}
          {!hasResults && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-600">
                Te maken facturen ({byProject.length} project{byProject.length !== 1 ? "en" : ""})
              </h3>
              {byProject.map(([projId, rows]) => {
                const pRec = projectMap.get(projId);
                const totalHours = rows.reduce((s, r) => s + r.hours, 0);

                // Preview invoice lines
                const timesheetRows = rows.filter(r => !r.taskBilling || r.taskBilling === "Timesheet based");
                const byActivity = new Map<string, number>();
                for (const r of timesheetRows) {
                  const key = r.activityType || "(geen)";
                  byActivity.set(key, (byActivity.get(key) ?? 0) + r.hours);
                }

                const fixedRows = rows.filter(r => r.taskBilling && r.taskBilling !== "Timesheet based");
                const byTask = new Map<string, { name: string; billing: string; hours: number }>();
                for (const r of fixedRows) {
                  const key = r.task;
                  const prev = byTask.get(key);
                  if (prev) prev.hours += r.hours;
                  else byTask.set(key, { name: r.taskName || r.task, billing: r.taskBilling, hours: r.hours });
                }

                const pred = predictions.get(projId);
                return (
                  <div key={projId} className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-700">{pRec?.project_name && pRec.project_name !== projId ? `${projId} — ${pRec.project_name}` : projId}</span>
                      <span className="text-xs text-slate-500">{pRec?.customer_name || pRec?.customer || rows[0]?.customer}</span>
                    </div>
                    {pred && (
                      <div className="flex items-center justify-between mb-2 text-[11px]">
                        <span className="text-slate-500">
                          Laatste factuur:{" "}
                          {pred.lastSI ? (
                            <span className="font-mono text-slate-700">{pred.lastSI}</span>
                          ) : (
                            <span className="italic text-slate-400">geen (eerste van dit jaar)</span>
                          )}
                          {pred.counter !== null && (
                            <span className="text-slate-400"> · counter: {pred.counter}</span>
                          )}
                        </span>
                        <span
                          className={`font-mono px-1.5 py-0.5 rounded ${
                            pred.mismatch
                              ? "bg-amber-100 text-amber-800"
                              : "bg-y-teal/10 text-y-teal"
                          }`}
                          title={
                            pred.mismatch
                              ? `Mismatch: laatste SI = ${pred.lastSI || "—"}, Series-counter = ${pred.counter}. Voorspelling gebruikt het hoogste van beide.`
                              : "Voorspeld factuurnummer op basis van laatste SI + Series-counter"
                          }
                        >
                          Nieuw: {pred.predicted}
                          {pred.mismatch && <span className="ml-1">⚠</span>}
                        </span>
                      </div>
                    )}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="text-left py-1">{t("to_invoice.col_line", { defaultValue: "Line" })}</th>
                          <th className="text-right py-1">{t("to_invoice.col_hours")}</th>
                          <th className="text-right py-1">{t("to_invoice.col_rate", { defaultValue: "Rate" })}</th>
                          <th className="text-right py-1">{t("to_invoice.col_amount", { defaultValue: "Amount" })}</th>
                          <th className="text-center py-1" title={t("to_invoice.timesheet_visible_on_invoice", { defaultValue: "Timesheet line visible on invoice" })}>{t("to_invoice.col_timesheet_short", { defaultValue: "Timesheet" })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(byActivity.entries()).map(([act, hrs]) => {
                          const rate = billingRates.get(act) ?? 0;
                          return (
                            <tr key={act} className="border-t border-slate-100">
                              <td className="py-1 text-slate-700">{act}</td>
                              <td className="py-1 text-right font-mono">{hrs.toFixed(1)}</td>
                              <td className="py-1 text-right font-mono">{rate > 0 ? `€${rate}` : <span className="text-amber-500">€0</span>}</td>
                              <td className="py-1 text-right font-mono">{rate > 0 ? `€${(hrs * rate).toFixed(0)}` : "—"}</td>
                              <td className="py-1 text-center text-green-600">✓</td>
                            </tr>
                          );
                        })}
                        {Array.from(byTask.values()).map((tk) => (
                          <tr key={tk.name} className="border-t border-slate-100 text-slate-400">
                            <td className="py-1">{tk.name} <span className="text-[10px]">({tk.billing})</span></td>
                            <td className="py-1 text-right font-mono">{tk.hours.toFixed(1)}</td>
                            <td className="py-1 text-right font-mono text-amber-500">€0*</td>
                            <td className="py-1 text-right">—</td>
                            <td className="py-1 text-center text-slate-300" title={t("to_invoice.not_visible_on_invoice", { defaultValue: "Not visible on invoice" })}>✗</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-semibold">
                          <td className="py-1">{t("to_invoice.total", { defaultValue: "Total" })}</td>
                          <td className="py-1 text-right font-mono">{totalHours.toFixed(1)}</td>
                          <td />
                          <td className="py-1 text-right font-mono">
                            {Array.from(byActivity.entries()).reduce((s, [act, hrs]) => s + hrs * (billingRates.get(act) ?? 0), 0) > 0
                              ? `€${Array.from(byActivity.entries()).reduce((s, [act, hrs]) => s + hrs * (billingRates.get(act) ?? 0), 0).toFixed(0)}`
                              : "—"}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                    {byTask.size > 0 && (
                      <p className="text-[10px] text-amber-500 mt-1">* Fixed Price/Milestone regels: tarief uit Sales Order (nog niet gekoppeld)</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {SKIP_BILLED_CHECK && !hasResults && (
            <div className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 rounded p-2">
              <Info size={10} />
              <span>Test-modus: custom_is_billed check is uitgeschakeld</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 cursor-pointer"
          >
            {hasResults ? t("common.close", { defaultValue: "Close" }) : t("common.cancel")}
          </button>
          {someSuccess && (
            <button
              onClick={jumpToDraftInvoices}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-y-teal hover:bg-y-teal/90 text-white cursor-pointer flex items-center gap-2"
            >
              <FileText size={14} />
              Bekijk in alle facturen
            </button>
          )}
          {!hasResults && (
            <button
              onClick={onConfirm}
              disabled={hasBlockingWarnings || creating}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
                hasBlockingWarnings
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : creating
                    ? "bg-y-teal/70 text-white cursor-wait"
                    : warnings.length > 0
                      ? "bg-amber-500 hover:bg-amber-600 text-white"
                      : "bg-y-teal hover:bg-y-teal/90 text-white"
              }`}
            >
              {creating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t("to_invoice.creating", { defaultValue: "Creating..." })}
                </>
              ) : hasBlockingWarnings ? (
                t("to_invoice.resolve_blocking_warnings", { defaultValue: "Resolve blocking warnings" })
              ) : warnings.length > 0 ? (
                t("to_invoice.create_anyway", { defaultValue: "Create anyway ({{n}} invoices)", n: byProject.length })
              ) : (
                t("to_invoice.create_n_invoices", { defaultValue: "Create {{n}} invoices", n: byProject.length })
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function KpiCard({ icon: Icon, color, label, value, loading, suffix, highlight }: {
  icon: typeof Clock; color: string; label: string; value: number;
  loading: boolean; suffix?: string; highlight?: boolean;
}) {
  const bgClass = highlight ? "bg-orange-50 border-orange-200" : "bg-white border-slate-200";
  const valueClass = highlight ? "text-orange-600" : "text-slate-800";
  const iconBg: Record<string, string> = {
    slate: "bg-slate-100", teal: "bg-y-teal/10", green: "bg-green-100", orange: "bg-orange-100",
  };
  const iconColor: Record<string, string> = {
    slate: "text-slate-600", teal: "text-y-teal", green: "text-green-600", orange: "text-orange-600",
  };

  return (
    <div className={`rounded-xl shadow-sm border p-4 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1.5 rounded-lg ${iconBg[color] ?? "bg-slate-100"}`}>
          <Icon className={iconColor[color] ?? "text-slate-600"} size={16} />
        </div>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${valueClass}`}>
        {loading ? "..." : fmt(value)}{suffix && <span className="text-sm font-normal text-slate-400 ml-0.5">{suffix}</span>}
      </p>
    </div>
  );
}
