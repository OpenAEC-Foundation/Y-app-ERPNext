import { Fragment, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchAll, fetchDocument, updateDocument, callMethod, getErpNextLinkUrl } from "../lib/erpnext";
import UrenBoekenWidget from "../components/UrenBoekenWidget";
import DateRangeFilter from "../components/DateRangeFilter";
import { useEmployees, useProjects } from "../lib/DataContext";
import {
  Timer, RefreshCw, Search, ExternalLink,
  Clock, CheckCircle, FileText, ChevronRight,
  Plus, ClipboardCheck, X, AlertTriangle, ShieldCheck,
  ChevronUp, ChevronDown,
} from "lucide-react";
import {
  type TimesheetDetail as TSDetail,
  type ValidationWarning,
  type ProjectInfo,
  runTimesheetValidation,
  getDetailHighlights,
  warningTypeLabels,
} from "../lib/timesheetValidation";
import { useTranslation } from "react-i18next";
import type { ViewMode } from "../components/Sidebar";
import { getActiveCompany, getActiveEmployee, getActiveActivityType, getActiveContractHours } from "../lib/instances";
import { isFeatureEnabled } from "../lib/capabilities";
import { useSessionEmployeeId } from "../lib/useSessionEmployee";

function getViewMode(): ViewMode {
  return (localStorage.getItem("view_mode") as ViewMode) || "employer";
}

interface Timesheet {
  name: string;
  employee: string;
  employee_name: string;
  total_hours: number;
  total_billed_hours: number;
  total_billed_amount: number;
  start_date: string;
  end_date: string;
  status: string;
  company: string | null;
}

export default function Timesheets() {
  const { t } = useTranslation();
  const viewMode = getViewMode();
  const [searchParams, setSearchParams] = useSearchParams();
  type TabId = "overzicht" | "boeken" | "goedkeuren";
  const validTabs: TabId[] = ["overzicht", "boeken", "goedkeuren"];
  const tabFromUrl = searchParams.get("tab");
  const initialTab: TabId = (validTabs.includes(tabFromUrl as TabId) ? tabFromUrl : "boeken") as TabId;
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Keep state in sync if the URL changes (e.g. user re-clicks the dashboard card).
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl as TabId) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl as TabId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  function selectTab(id: TabId) {
    setActiveTab(id);
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{t("timesheets.title")}</h2>
        <a
          href={`${getErpNextLinkUrl()}/timesheet`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <ExternalLink size={14} /> ERPNext
        </a>
      </div>

      {/* Tabs — horizontally scroll on narrow screens */}
      <div className="flex gap-1 mb-4 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
        <button
          onClick={() => selectTab("overzicht")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "overzicht"
              ? "bg-y-teal text-white"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Timer size={16} /> {t("timesheets.tab.overview")}
        </button>
        <button
          onClick={() => selectTab("boeken")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "boeken"
              ? "bg-y-teal text-white"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Plus size={16} /> {t("timesheets.tab.book_hours")}
        </button>
        {viewMode === "employer" && (
          <button
            onClick={() => selectTab("goedkeuren")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "goedkeuren"
                ? "bg-y-teal text-white"
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            <ClipboardCheck size={16} /> {t("timesheets.tab.approve")}
          </button>
        )}
      </div>

      {activeTab === "overzicht" && <BoekingenView viewMode={viewMode} />}
      {activeTab === "boeken" && <UrenBoekenWidget showWeekTable={true} layout="side-by-side" />}
      {activeTab === "goedkeuren" && <TimesheetGoedkeuren />}
    </div>
  );
}

/* ─── BoekingenView (individual booking rows) ─── */

interface BookingRow {
  name: string;
  parent: string;
  activity_type: string;
  hours: number;
  project: string;
  task: string;
  task_name?: string;
  description?: string;
  from_time: string;
  billable?: number;
  employee: string;
  employee_name: string;
}

type BookingPeriod = "4_weken" | "vorige_week" | "deze_maand" | "dit_jaar" | "aangepast";

function getBookingDateRange(period: BookingPeriod): { from: string; to: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  switch (period) {
    case "4_weken": {
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fourWeeksAgo = new Date(monday);
      fourWeeksAgo.setDate(monday.getDate() - 21);
      return { from: fmt(fourWeeksAgo), to: fmt(sunday) };
    }
    case "vorige_week": {
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday - 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: fmt(monday), to: fmt(sunday) };
    }
    case "deze_maand": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: fmt(first), to: fmt(last) };
    }
    case "dit_jaar": {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: fmt(first), to: fmt(now) };
    }
    case "aangepast":
    default:
      return { from: "", to: "" };
  }
}

const bookingPeriodKeys: Record<BookingPeriod, string> = {
  vorige_week: "timesheets.bookings.last_week",
  "4_weken": "timesheets.preset_last_4_weeks",
  deze_maand: "timesheets.bookings.this_month",
  dit_jaar: "timesheets.preset_this_year",
  aangepast: "timesheets.bookings.custom",
};

function BoekingenView({ viewMode }: { viewMode: ViewMode }) {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
  const allProjects = useProjects();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BookingPeriod>("4_weken");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const defaultEmployee = getActiveEmployee();
  const [employeeFilter, setEmployeeFilter] = useState(defaultEmployee);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>("from_time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const company = getActiveCompany();
  const isEmployee = viewMode === "employee";
  // Personal ("employee") view is employee-bound: resolve "who am I" via the
  // shared session-employee hook rather than the raw instance setting alone,
  // so API-/beheeraccounts without a configured "Standaard medewerker" but
  // with a matching ERPNext Employee record still resolve correctly. If it
  // genuinely can't resolve one, show that honestly instead of a silent
  // 0-hours table (or, worse, unfiltered company-wide data).
  const sessionEmployeeId = useSessionEmployeeId(allEmployees);
  const noEmployeeLink = isEmployee && !sessionEmployeeId;

  // Build employee ID set for company filtering
  const employeeIdSet = useMemo(() => {
    if (!company) return null;
    const set = new Set<string>();
    for (const emp of allEmployees) {
      if (emp.company === company) set.add(emp.name);
    }
    return set;
  }, [allEmployees, company]);

  // Get employee list for filter dropdown — show all active employees from company, not just those with bookings
  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of allEmployees) {
      if (emp.status === "Active" && (!company || emp.company === company)) {
        map.set(emp.name, emp.employee_name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allEmployees, company]);

  // Build project name map
  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allProjects) {
      if (p.project_name) map.set(p.name, p.project_name);
    }
    return map;
  }, [allProjects]);

  // Resolve effective date range
  const dateRange = useMemo(() => {
    if (period === "aangepast") return { from: customFrom, to: customTo };
    return getBookingDateRange(period);
  }, [period, customFrom, customTo]);

  async function loadBookings() {
    setLoading(true);
    setError(null);
    try {
      // Build timesheet filters based on date range
      // OVERLAP met het datumbereik, niet "helemaal binnen het bereik".
      // Een urenstaat loopt sinds het jaarmodel van januari tot december
      // (lib/year-timesheet.ts), dus `start_date >= from AND end_date <= to`
      // zou hem uit élk deel-bereik gooien en het overzicht leeg laten. Ook
      // voor de oude week-sheets is dit een correctie: een week die over een
      // maandgrens loopt viel voorheen uit de maandweergave. De begrenzing tot
      // het bereik gebeurt hieronder al per regel op `from_time`.
      const tsFilters: unknown[][] = [];
      if (dateRange.to) tsFilters.push(["start_date", "<=", dateRange.to]);
      if (dateRange.from) tsFilters.push(["end_date", ">=", dateRange.from]);

      // Fetch timesheets in the date range
      const timesheets = await fetchAll<Timesheet>(
        "Timesheet",
        [
          "name", "employee", "employee_name", "total_hours",
          "total_billed_hours", "total_billed_amount",
          "start_date", "end_date", "status", "company",
        ],
        tsFilters,
        "start_date desc"
      );

      // Filter by company if needed
      const filteredTs = employeeIdSet
        ? timesheets.filter((ts) => employeeIdSet.has(ts.employee))
        : timesheets;

      // For employee view, filter on own employee (resolved via the shared
      // session-employee hook — see sessionEmployeeId above). Unlike the
      // employer view, an unresolved employee here must NOT fall back to
      // "show everything" — that would leak every employee's bookings into
      // what's supposed to be a personal overview.
      const relevantTs = isEmployee
        ? (sessionEmployeeId ? filteredTs.filter((ts) => ts.employee === sessionEmployeeId) : [])
        : filteredTs;

      if (relevantTs.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      // Fetch time_logs for all relevant timesheets (batch by 10)
      const allRows: BookingRow[] = [];
      const batchSize = 10;
      for (let i = 0; i < relevantTs.length; i += batchSize) {
        const batch = relevantTs.slice(i, i + batchSize);
        const docs = await Promise.all(
          batch.map((ts) =>
            fetchDocument<{
              time_logs: (TSDetail & { custom_subject?: string })[];
            }>("Timesheet", ts.name).catch(() => ({ time_logs: [] }))
          )
        );
        for (let j = 0; j < batch.length; j++) {
          const ts = batch[j];
          const doc = docs[j];
          for (const log of doc.time_logs || []) {
            // Filter by date range on the actual from_time
            const logDate = (log.from_time || "").split(" ")[0] || "";
            if (dateRange.from && logDate < dateRange.from) continue;
            if (dateRange.to && logDate > dateRange.to) continue;
            allRows.push({
              name: log.name,
              parent: log.parent || ts.name,
              activity_type: log.activity_type,
              hours: log.hours,
              project: log.project,
              task: log.task,
              task_name: log.custom_subject || log.task_name,
              description: log.description,
              from_time: log.from_time,
              // ERPNext's Timesheet Detail field is `is_billable` (0/1); some
              // older code paths used `billable` — read both so we don't miss
              // the value either way.
              billable: (log as any).is_billable ?? (log as any).billable,
              employee: ts.employee,
              employee_name: ts.employee_name,
            });
          }
        }
      }

      // Sort by from_time desc
      allRows.sort((a, b) =>
        (b.from_time || "").localeCompare(a.from_time || "")
      );

      setBookings(allRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (dateRange.from || dateRange.to) {
      loadBookings();
    } else {
      setBookings([]);
      setLoading(false);
    }
    // sessionEmployeeId resolves asynchronously (session lookup) — reload
    // once it settles so the employee-view filter picks it up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.from, dateRange.to, sessionEmployeeId]);

  // Apply employee filter (by employee ID)
  const employeeFiltered = useMemo(() => {
    if (!employeeFilter) return bookings;
    return bookings.filter((b) => b.employee === employeeFilter);
  }, [bookings, employeeFilter]);

  // Apply search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return employeeFiltered;
    const q = search.toLowerCase();
    return employeeFiltered.filter(
      (b) =>
        (b.project || "").toLowerCase().includes(q) ||
        (b.task_name || "").toLowerCase().includes(q) ||
        (b.description || "").toLowerCase().includes(q) ||
        (b.employee_name || "").toLowerCase().includes(q) ||
        (b.activity_type || "").toLowerCase().includes(q) ||
        (projectNameMap.get(b.project) || "").toLowerCase().includes(q)
    );
  }, [employeeFiltered, search, projectNameMap]);

  // Sort the filtered results by active sort field
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      switch (sortField) {
        case "from_time":
          va = a.from_time || "";
          vb = b.from_time || "";
          break;
        case "hours":
          return dir * (a.hours - b.hours);
        case "employee_name":
          va = (a.employee_name || "").toLowerCase();
          vb = (b.employee_name || "").toLowerCase();
          break;
        case "project":
          va = (a.project || "").toLowerCase();
          vb = (b.project || "").toLowerCase();
          break;
        case "task_name":
          va = (a.task_name || "").toLowerCase();
          vb = (b.task_name || "").toLowerCase();
          break;
        case "description":
          va = (a.description || "").toLowerCase();
          vb = (b.description || "").toLowerCase();
          break;
        case "activity_type":
          va = (a.activity_type || "").toLowerCase();
          vb = (b.activity_type || "").toLowerCase();
          break;
        case "billable":
          return dir * ((a.billable || 0) - (b.billable || 0));
        default:
          va = a.from_time || "";
          vb = b.from_time || "";
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // Dynamic grouping based on active sort field
  const groupedRows = useMemo(() => {
    const groups: { key: string; label: string; rows: BookingRow[]; totalHours: number }[] = [];
    const map = new Map<string, BookingRow[]>();
    const order: string[] = [];

    for (const b of sorted) {
      let groupKey: string;
      switch (sortField) {
        case "employee_name":
          groupKey = b.employee_name || "(onbekend)";
          break;
        case "project":
          groupKey = b.project ? `${b.project} — ${projectNameMap.get(b.project) || ""}` : "(geen project)";
          break;
        case "task_name":
          groupKey = b.task_name || "(geen taak)";
          break;
        case "activity_type":
          groupKey = b.activity_type || "(geen type)";
          break;
        default: {
          // Default: group by month
          const dateStr = (b.from_time || "").split(" ")[0] || (b.from_time || "").split("T")[0] || "";
          groupKey = dateStr.slice(0, 7); // "YYYY-MM"
          break;
        }
      }
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
        order.push(groupKey);
      }
      map.get(groupKey)!.push(b);
    }

    for (const key of order) {
      const rows = map.get(key)!;
      let label = key;
      // Format month labels nicely
      if (sortField === "from_time" || sortField === "hours" || sortField === "billable" || sortField === "description") {
        if (key && key.match(/^\d{4}-\d{2}$/)) {
          const [y, m] = key.split("-");
          const d = new Date(Number(y), Number(m) - 1, 1);
          label = d.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
          label = label.charAt(0).toUpperCase() + label.slice(1);
        }
      }
      groups.push({ key, label, rows, totalHours: rows.reduce((s, r) => s + r.hours, 0) });
    }
    return groups;
  }, [sorted, sortField, projectNameMap]);

  const totalHours = filtered.reduce((s, b) => s + b.hours, 0);

  function handleSortClick(field: string) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "hours" || field === "billable" ? "desc" : "asc");
    }
  }

  function SortIndicator({ field }: { field: string }) {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp size={12} className="inline ml-0.5" />
    ) : (
      <ChevronDown size={12} className="inline ml-0.5" />
    );
  }

  function formatDate(fromTime: string): string {
    if (!fromTime) return "";
    const dateStr = fromTime.split(" ")[0] || fromTime.split("T")[0] || "";
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("nl-NL", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function formatTime(fromTime: string, hours: number): string {
    if (!fromTime) return "";
    const start = new Date(fromTime);
    const end = new Date(start.getTime() + hours * 3600000);
    const fmt = (d: Date) =>
      `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    return `${fmt(start)} - ${fmt(end)}`;
  }

  return (
    <div className="min-w-0">
      {/* Filter bar: period presets + employee + search — wraps cleanly on mobile */}
      <div className="mb-4 flex items-center gap-2 flex-wrap min-w-0">
        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
          {(Object.keys(bookingPeriodKeys) as BookingPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                period === p
                  ? "bg-y-teal text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t(bookingPeriodKeys[p])}
            </button>
          ))}
        </div>
        <DateRangeFilter
          fromDate={customFrom || dateRange.from}
          toDate={customTo || dateRange.to}
          onFromChange={(v) => { setCustomFrom(v); setPeriod("aangepast"); }}
          onToChange={(v) => { setCustomTo(v); setPeriod("aangepast"); }}
        />
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          disabled={isEmployee}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal disabled:opacity-60"
        >
          <option value="">
            {t("instance_bar.all_employees")}
          </option>
          {employeeOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder={t("timesheets.bookings.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && noEmployeeLink && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-3 text-sm">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{t("y_next.no_employee_link")}</span>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-y-teal/10 rounded-lg">
              <Clock className="text-y-teal" size={18} />
            </div>
            <p className="text-sm text-slate-500">
              {t("projects.detail.total_hours")}
            </p>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {loading
              ? "..."
              : totalHours.toLocaleString("nl-NL", {
                  maximumFractionDigits: 1,
                })}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="text-orange-600" size={18} />
            </div>
            <p className="text-sm text-slate-500">
              {t("timesheets.bookings.count")}
            </p>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {loading ? "..." : filtered.length}
          </p>
        </div>
      </div>

      {/* Table — horizontal scroll on narrow screens so columns never collapse */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer select-none hover:text-y-teal"
                onClick={() => handleSortClick("from_time")}
              >
                {t("timesheets.bookings.col_date")}
                <SortIndicator field="from_time" />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">
                {t("timesheets.col_time")}
              </th>
              <th
                className="text-right px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer select-none hover:text-y-teal"
                onClick={() => handleSortClick("hours")}
              >
                {t("projects.toc.hours")}
                <SortIndicator field="hours" />
              </th>
              {!isEmployee && (
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer select-none hover:text-y-teal"
                  onClick={() => handleSortClick("employee_name")}
                >
                  {t("timesheets.table.employee")}
                  <SortIndicator field="employee_name" />
                </th>
              )}
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer select-none hover:text-y-teal"
                onClick={() => handleSortClick("project")}
              >
                {t("tasks.detail.project")}
                <SortIndicator field="project" />
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer select-none hover:text-y-teal"
                onClick={() => handleSortClick("task_name")}
              >
                {t("hours_widget.task")}
                <SortIndicator field="task_name" />
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer select-none hover:text-y-teal"
                onClick={() => handleSortClick("description")}
              >
                {t("tasks.detail.description")}
                <SortIndicator field="description" />
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer select-none hover:text-y-teal"
                onClick={() => handleSortClick("activity_type")}
              >
                {t("timesheets.bookings.col_type")}
                <SortIndicator field="activity_type" />
              </th>
              <th
                className="text-center px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer select-none hover:text-y-teal"
                onClick={() => handleSortClick("billable")}
              >
                {t("timesheets.billable")}
                <SortIndicator field="billable" />
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={isEmployee ? 8 : 9}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  {t("common.loading")}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={isEmployee ? 8 : 9}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  {t("timesheets.bookings.no_bookings")}
                </td>
              </tr>
            ) : (
              groupedRows.map((group) => (
                <Fragment key={group.key}>
                  {/* Month group header */}
                  <tr className="bg-slate-100 sticky top-0 z-10">
                    <td
                      colSpan={isEmployee ? 8 : 9}
                      className="px-4 py-2 text-slate-600 font-semibold text-sm"
                    >
                      {group.label}
                      <span className="ml-2 font-normal text-slate-400 text-xs">
                        {group.totalHours.toLocaleString("nl-NL", {
                          maximumFractionDigits: 1,
                        })}{" "}
                        {t("common.hours")}
                      </span>
                    </td>
                  </tr>
                  {group.rows.map((b) => (
                    <tr
                      key={b.name}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2.5 text-sm text-slate-700 whitespace-nowrap">
                        {formatDate(b.from_time)}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-500 whitespace-nowrap">
                        {formatTime(b.from_time, b.hours)}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-700 text-right font-medium">
                        {b.hours.toLocaleString("nl-NL", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      {!isEmployee && (
                        <td className="px-4 py-2.5 text-sm text-slate-700">
                          {b.employee_name}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-sm text-slate-800">
                        {b.project ? (
                          <>
                            <span className="font-mono text-xs">
                              {b.project}
                            </span>
                            {projectNameMap.get(b.project) && (
                              <span className="text-slate-500 ml-1">
                                {projectNameMap.get(b.project)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-700">
                        {b.task_name || (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-500 max-w-[200px] truncate">
                        {b.description || (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        {b.activity_type ? (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                            {b.activity_type}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-center">
                        {b.billable ? (
                          <span className="inline-block w-2 h-2 rounded-full bg-y-teal" title={t("timesheets.billable")} />
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {!loading && filtered.length > 0 && (
        <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {t("timesheets.bookings.count_label", {
              count: filtered.length,
            })}
          </span>
          <span className="font-semibold text-slate-700">
            {t("timesheets.total_label")}{" "}
            {totalHours.toLocaleString("nl-NL", {
              maximumFractionDigits: 1,
            })}{" "}
            {t("common.hours")}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Inline search-select for project/task in edit mode ─── */

function InlineSearchSelect({ value, onChange, fetchOptions, placeholder, displayValue }: {
  value: string;
  onChange: (id: string, label?: string) => void;
  fetchOptions: (query: string) => Promise<{ id: string; label: string }[]>;
  placeholder: string;
  displayValue?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingOpts(true);
    fetchOptions(search).then(setOptions).catch(() => setOptions([])).finally(() => setLoadingOpts(false));
  }, [open, search]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={open ? search : (displayValue || value)}
        onChange={(e) => { setSearch(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-1 py-0.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-y-teal"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded shadow-lg z-30 max-h-36 overflow-y-auto">
          <button type="button" onClick={() => { onChange("", ""); setSearch(""); setOpen(false); }}
            className="w-full text-left px-2 py-1 hover:bg-slate-50 text-[11px] text-slate-400 cursor-pointer">— {t("common.none", { defaultValue: "None" })} —</button>
          {loadingOpts && <div className="px-2 py-1 text-[11px] text-slate-400">{t("common.loading")}</div>}
          {options.map((opt) => (
            <button key={opt.id} type="button"
              onClick={() => { onChange(opt.id, opt.label); setSearch(""); setOpen(false); }}
              className={`w-full text-left px-2 py-1 hover:bg-slate-50 text-[11px] cursor-pointer ${value === opt.id ? "bg-y-teal/5 text-y-teal-dark" : "text-slate-700"}`}>
              <span className="font-mono text-[10px] text-slate-400">{opt.id}</span>{" "}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── TimesheetDetailsTable ─── */

const DAY_LABELS = ["zo", "ma", "di", "wo", "do", "vr", "za"];

type GroupByOption = "project" | "dag" | "activiteit" | "taak" | null;

interface TimesheetDetailsTableProps {
  details: TSDetail[];
  projects: ProjectInfo[];
  employeeCompany?: string;
  defaultActivityType?: string;
  employeeId?: string;
  employeeActivityTypes?: Record<string, string>;
  loading?: boolean;
  defaultGroupBy?: GroupByOption;
  hideBillable?: boolean;
  /** Sort order within groups: true = oldest first (default), false = newest first */
  sortAscending?: boolean;
  onUpdateDetail?: (detail: TSDetail, field: "task" | "description" | "billable" | "from_time" | "to_time", value: string) => Promise<void>;
  onRefresh?: () => void;
  onDetailsChange?: (updated: TSDetail[]) => void;
}

function formatTimeRange(fromTime: string, hours: number): string {
  if (!fromTime) return "";
  const start = new Date(fromTime);
  const end = new Date(start.getTime() + hours * 3600000);
  const fmt = (d: Date) => `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  return `${fmt(start)}-${fmt(end)}`;
}

function getDayLabel(fromTime: string): string {
  if (!fromTime) return "";
  const d = new Date(fromTime);
  return DAY_LABELS[d.getDay()];
}

function getDateKey(fromTime: string): string {
  if (!fromTime) return "";
  return fromTime.split(" ")[0] || fromTime.split("T")[0] || "";
}

export function TimesheetDetailsTable({
  details,
  projects,
  employeeCompany,
  defaultActivityType,
  employeeId,
  employeeActivityTypes,
  loading,
  defaultGroupBy = null,
  hideBillable = false,
  sortAscending = true,
  onUpdateDetail,
  onRefresh,
  onDetailsChange,
}: TimesheetDetailsTableProps) {
  const { t } = useTranslation();
  const [groupBy, setGroupBy] = useState<GroupByOption>(defaultGroupBy);
  const [saving, setSaving] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editRowData, setEditRowData] = useState<Partial<TSDetail> & { _toTime?: string }>({});

  const highlights = useMemo(
    () => getDetailHighlights(details, employeeCompany, defaultActivityType, projects, employeeId, employeeActivityTypes),
    [details, employeeCompany, defaultActivityType, projects, employeeId, employeeActivityTypes]
  );

  function toggleGroupBy(col: GroupByOption) {
    setGroupBy((prev) => (prev === col ? null : col));
  }

  const headerClass = (col: GroupByOption) =>
    `text-left px-3 py-2 text-xs font-semibold cursor-pointer select-none ${
      groupBy === col ? "text-y-teal underline" : "text-slate-600"
    }`;

  // Grouping logic
  const grouped = useMemo(() => {
    if (!groupBy) return null;

    const map = new Map<string, TSDetail[]>();

    // Filter out empty rows and weekend days with no hours before grouping
    const validDetails = details.filter(d => {
      if (!d.from_time || !d.hours) return false;
      const day = new Date(d.from_time).getDay();
      const isWeekend = day === 0 || day === 6;
      return !isWeekend || d.hours > 0;
    });

    for (const d of validDetails) {
      let key: string;
      switch (groupBy) {
        case "project":
          key = d.project || `(${t("validation.no_project")})`;
          break;
        case "dag":
          key = getDateKey(d.from_time);
          break;
        case "activiteit":
          key = d.activity_type || `(${t("validation.no_activity")})`;
          break;
        case "taak":
          key = d.task_name || d.task || `(${t("validation.no_task")})`;
          break;
        default:
          key = "";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }

    // For day grouping: remove weekend groups with no real hours, then add empty workdays
    if (groupBy === "dag") {
      for (const [key, entries] of map) {
        if (!key) continue;
        const d = new Date(key + "T12:00:00");
        const dayOfWeek = d.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          const hasHours = entries.some(e => e.hours > 0);
          if (!hasHours) map.delete(key);
        }
      }
    }
    if (groupBy === "dag" && validDetails.length > 0) {
      const allDates = validDetails.map((d) => getDateKey(d.from_time)).filter(Boolean);
      if (allDates.length > 0) {
        const sorted = allDates.sort();
        const start = new Date(sorted[0] + "T12:00:00");
        const end = new Date(sorted[sorted.length - 1] + "T12:00:00");
        const cur = new Date(start);
        while (cur <= end) {
          const day = cur.getDay();
          if (day >= 1 && day <= 5) {
            // Use local date parts (not toISOString which is UTC — would shift in UTC+N timezones)
            const y = cur.getFullYear();
            const mo = String(cur.getMonth() + 1).padStart(2, "0");
            const da = String(cur.getDate()).padStart(2, "0");
            const key = `${y}-${mo}-${da}`;
            if (!map.has(key)) map.set(key, []);
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    // Sort groups by key, then entries within each group by from_time desc
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, entries]) => [key, entries.sort((a, b) => sortAscending
        ? (a.from_time || "").localeCompare(b.from_time || "")
        : (b.from_time || "").localeCompare(a.from_time || "")
      )] as [string, TSDetail[]]);
  }, [details, groupBy]);


  // Build a map from project ID to project_name for display
  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      if (p.project_name) map.set(p.name, p.project_name);
    }
    return map;
  }, [projects]);

  function startRowEdit(d: TSDetail) {
    if (!onUpdateDetail) return;
    // Submitted (docstatus=1) timesheets reject child-row (time_logs)
    // updates from the REST API — editing here would just fail silently
    // against ERPNext. Block entry into edit mode instead of letting the
    // user hit a dead end after typing changes.
    if (d.parent_docstatus === 1) {
      alert(t("timesheets.row_locked_submitted"));
      return;
    }
    setEditingRow(d.name);
    const fromParts = (d.from_time || "").split(" ");
    const fromHHMM = fromParts[1]?.slice(0, 5) || "09:00";
    // Calculate to_time from from_time + hours
    const fromDate = new Date(d.from_time || Date.now());
    const toDate = new Date(fromDate.getTime() + (d.hours || 0) * 3600000);
    const toHHMM = `${toDate.getHours().toString().padStart(2, "0")}:${toDate.getMinutes().toString().padStart(2, "0")}`;
    setEditRowData({ ...d, from_time: fromHHMM, hours: d.hours, _toTime: toHHMM } as any);
  }

  async function saveRowEdit(d: TSDetail) {
    if (!editRowData) return;
    setSaving(true);
    try {
      const doc = await fetchDocument<{ name: string; time_logs: any[] }>("Timesheet", d.parent);
      if (!doc.time_logs) { setSaving(false); return; }
      const origDate = (d.from_time || "").split(" ")[0] || new Date().toISOString().split("T")[0];
      const newFrom = `${origDate} ${editRowData.from_time || "09:00"}:00`;
      const newTo = `${origDate} ${editRowData._toTime || "17:00"}:00`;
      const fromD = new Date(newFrom);
      const toD = new Date(newTo);
      const newHours = !isNaN(fromD.getTime()) && !isNaN(toD.getTime()) ? Math.max(0, (toD.getTime() - fromD.getTime()) / 3600000) : d.hours;

      const updatedLogs = doc.time_logs.map((log: any) => {
        if (log.name !== d.name) return log;
        return {
          ...log,
          from_time: newFrom,
          to_time: newTo,
          hours: newHours,
          project: editRowData.project ?? log.project,
          task: editRowData.task ?? log.task,
          description: editRowData.description ?? log.description,
          is_billable: editRowData.billable != null ? editRowData.billable : log.is_billable,
        };
      });
      await updateDocument("Timesheet", d.parent, { time_logs: updatedLogs });
      // Update local details immediately (no re-fetch needed)
      if (onDetailsChange) {
        const updatedDetails = details.map(det => {
          if (det.name !== d.name) return det;
          return { ...det, from_time: newFrom, hours: newHours, project: editRowData.project ?? det.project, task: editRowData.task ?? det.task, description: editRowData.description ?? det.description, billable: editRowData.billable != null ? editRowData.billable : det.billable };
        });
        onDetailsChange(updatedDetails);
      } else if (onRefresh) {
        onRefresh();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : t("common.save_failed", { defaultValue: "Save failed" }));
    }
    setSaving(false);
    setEditingRow(null);
  }

  async function deleteRow(d: TSDetail) {
    if (!onUpdateDetail) return;
    // Same submitted-timesheet guard as startRowEdit — ERPNext refuses to
    // update time_logs on a docstatus=1 Timesheet (must cancel/amend first).
    // Without this check the update below fails and — before this fix —
    // that failure was swallowed silently, so the delete button looked
    // like it "did nothing".
    if (d.parent_docstatus === 1) {
      alert(t("timesheets.row_locked_submitted"));
      return;
    }
    setSaving(true);
    try {
      const doc = await fetchDocument<{ name: string; time_logs: TSDetail[] }>("Timesheet", d.parent);
      if (!doc.time_logs) return;
      const updatedLogs = doc.time_logs.filter(log => log.name !== d.name);
      await updateDocument("Timesheet", d.parent, { time_logs: updatedLogs });
      if (onRefresh) onRefresh();
    } catch (e) {
      // Surface the real ERPNext error (e.g. a race where the timesheet was
      // submitted after this row was loaded) instead of failing silently.
      alert(e instanceof Error ? e.message : t("timesheets.delete_row_failed"));
    } finally {
      setSaving(false);
    }
  }

  function renderRow(d: TSDetail) {
    const hl = highlights.get(d.name) || {};
    const isEditing = editingRow === d.name;

    if (isEditing && onUpdateDetail) {
      const fromTime = editRowData.from_time || "";
      const toTime = editRowData._toTime || "";
      return (
        <tr key={d.name} className="border-b border-slate-100 bg-y-teal/5 text-xs">
          <td className="px-2 py-1">{getDayLabel(d.from_time)}</td>
          <td className="px-2 py-1">
            <div className="flex items-center gap-1">
              <input type="text" inputMode="numeric" placeholder="HH:MM" maxLength={5} value={fromTime}
                onChange={e => { let v = e.target.value.replace(/[^\d:]/g, ""); if (v.length === 2 && !v.includes(":")) v += ":"; setEditRowData({ ...editRowData, from_time: v } as any); }}
                onBlur={e => { const m = e.target.value.match(/^(\d{1,2}):?(\d{2})$/); if (m) setEditRowData({ ...editRowData, from_time: `${m[1].padStart(2,"0")}:${m[2]}` } as any); }}
                className="w-16 px-1 py-0.5 border border-slate-200 rounded text-xs font-mono" />
              <span className="text-slate-400">-</span>
              <input type="text" inputMode="numeric" placeholder="HH:MM" maxLength={5} value={toTime}
                onChange={e => { let v = e.target.value.replace(/[^\d:]/g, ""); if (v.length === 2 && !v.includes(":")) v += ":"; setEditRowData({ ...editRowData, _toTime: v } as any); }}
                onBlur={e => { const m = e.target.value.match(/^(\d{1,2}):?(\d{2})$/); if (m) setEditRowData({ ...editRowData, _toTime: `${m[1].padStart(2,"0")}:${m[2]}` } as any); }}
                className="w-16 px-1 py-0.5 border border-slate-200 rounded text-xs font-mono" />
            </div>
          </td>
          <td className="px-2 py-1 text-right text-slate-500">
            {(() => {
              if (!fromTime || !toTime) return "-";
              const [fh, fm] = fromTime.split(":").map(Number);
              const [th, tm] = toTime.split(":").map(Number);
              return ((th * 60 + tm - fh * 60 - fm) / 60).toFixed(1);
            })()}
          </td>
          <td className="px-2 py-1">
            <InlineSearchSelect
              value={editRowData.project || ""}
              displayValue={editRowData.project ? `${editRowData.project} — ${projects.find(p => p.name === editRowData.project)?.project_name || ""}` : ""}
              onChange={(id) => { setEditRowData({ ...editRowData, project: id, task: "" }); }}
              placeholder="Zoek project..."
              fetchOptions={async (q) => {
                const list = await fetchAll<{ name: string; project_name: string }>("Project",
                  ["name", "project_name"],
                  [["status", "not in", ["Cancelled", "Completed"]]],
                );
                const lower = q.toLowerCase();
                return list
                  .filter(p => !q || p.name.toLowerCase().includes(lower) || (p.project_name || "").toLowerCase().includes(lower))
                  .map(p => ({ id: p.name, label: p.project_name || p.name }));
              }}
            />
          </td>
          <td className="px-2 py-1">
            <InlineSearchSelect
              value={editRowData.task || ""}
              displayValue={editRowData.task || ""}
              onChange={(id) => setEditRowData({ ...editRowData, task: id })}
              placeholder="Zoek taak..."
              fetchOptions={async (q) => {
                const proj = editRowData.project || d.project;
                if (!proj) return [];
                const list = await fetchAll<{ name: string; subject: string }>("Task",
                  ["name", "subject"],
                  [["project", "=", proj], ["status", "not in", ["Cancelled"]]],
                );
                const lower = q.toLowerCase();
                return list
                  .filter(t => !q || t.name.toLowerCase().includes(lower) || (t.subject || "").toLowerCase().includes(lower))
                  .map(t => ({ id: t.name, label: t.subject || t.name }));
              }}
            />
          </td>
          <td className="px-2 py-1">
            <input type="text" value={editRowData.description || ""} onChange={e => setEditRowData({ ...editRowData, description: e.target.value })}
              className="w-full px-1 py-0.5 border border-slate-200 rounded text-xs" placeholder={t("timesheets.description_placeholder")} />
          </td>
          <td className="px-2 py-1 text-slate-500 text-xs">{editRowData.activity_type || d.activity_type || "-"}</td>
          {!hideBillable && (
            <td className="px-2 py-1 text-center">
              <input type="checkbox" checked={!!editRowData.billable}
                onChange={() => setEditRowData({ ...editRowData, billable: editRowData.billable ? 0 : 1 })}
                className="cursor-pointer accent-y-teal" />
            </td>
          )}
          <td className="px-2 py-1 whitespace-nowrap">
            <button onClick={() => saveRowEdit(d)} disabled={saving} className="px-1.5 py-0.5 bg-y-teal text-white rounded text-xs cursor-pointer disabled:opacity-50">&#10003;</button>
            <button onClick={() => setEditingRow(null)} className="px-1.5 py-0.5 text-slate-400 text-xs cursor-pointer ml-1">&#10005;</button>
            <button onClick={() => deleteRow(d)} disabled={saving} className="px-1.5 py-0.5 text-red-400 hover:text-red-600 text-xs cursor-pointer ml-1 disabled:opacity-50" title={t("common.delete_tooltip")}>&#128465;</button>
          </td>
        </tr>
      );
    }

    return (
      <tr key={d.name} className="border-b border-slate-50 hover:bg-slate-50 text-xs group">
        <td className={`px-3 py-1.5 ${hl.from_time || ""}`}>{getDayLabel(d.from_time)}</td>
        <td className="px-3 py-1.5">{formatTimeRange(d.from_time, d.hours)}</td>
        <td className={`px-3 py-1.5 text-right ${hl.hours || ""}`}>{d.hours.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}</td>
        <td className={`px-3 py-1.5 text-slate-800 ${hl.project || ""}`}>
          {d.project ? (
            <>
              <span className="font-mono">{d.project}</span>
              {projectNameMap.get(d.project) ? ` \u2014 ${projectNameMap.get(d.project)}` : ""}
            </>
          ) : "-"}
        </td>
        <td className={`px-3 py-1.5 ${hl.task || ""}`}>{d.task_name || "-"}</td>
        <td className="px-3 py-1.5 text-slate-500 max-w-[200px] truncate">{d.description || "-"}</td>
        <td className={`px-3 py-1.5 ${hl.activity_type || ""}`}>
          {d.activity_type ? (
            <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">{d.activity_type}</span>
          ) : <span className="text-slate-400">-</span>}
        </td>
        {!hideBillable && (
          <td className="px-3 py-1.5 text-center">
            <input
              type="checkbox"
              checked={!!d.billable}
              onChange={(e) => { e.stopPropagation(); if (onUpdateDetail) onUpdateDetail(d, "billable", d.billable ? "0" : "1"); }}
              disabled={!onUpdateDetail || saving}
              className="cursor-pointer accent-y-teal"
            />
          </td>
        )}
        {onUpdateDetail && (
          <td className="px-1 py-1.5">
            <button onClick={() => startRowEdit(d)}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-y-teal cursor-pointer"
              title={d.parent_docstatus === 1 ? t("timesheets.row_locked_submitted") : t("common.edit")}>
              &#9998;
            </button>
          </td>
        )}
      </tr>
    );
  }

  if (loading) {
    return <div className="text-center text-slate-400 py-4 text-sm">{t("common.loading")}</div>;
  }

  if (details.length === 0) {
    return <div className="text-center text-slate-400 py-4 text-sm">{t("timesheets.no_details")}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className={headerClass("dag")} onClick={() => toggleGroupBy("dag")}>{t("timesheets.col_day")}</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("timesheets.col_time")}</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">{t("projects.toc.hours")}</th>
            <th className={headerClass("project")} onClick={() => toggleGroupBy("project")}>{t("tasks.detail.project")}</th>
            <th className={headerClass("taak")} onClick={() => toggleGroupBy("taak")}>{t("hours_widget.task")}</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("tasks.detail.description")}</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("timesheets.bookings.col_type")}</th>
            {!hideBillable && <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">{t("timesheets.billable")}</th>}
            {onUpdateDetail && <th className="px-1 py-2 text-xs font-semibold text-slate-600"></th>}
          </tr>
        </thead>
        <tbody>
          {grouped ? (
            grouped.map(([groupKey, items]) => {
              const groupTotal = items.reduce((s, d) => s + d.hours, 0);
              let groupLabel = groupKey;
              if (groupBy === "dag" && groupKey) {
                const dt = new Date(groupKey + "T12:00:00");
                groupLabel = `${DAY_LABELS[dt.getDay()]} ${dt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`;
              } else if (groupBy === "project" && groupKey && groupKey !== "(geen project)") {
                const pName = projectNameMap.get(groupKey);
                if (pName) groupLabel = `${groupKey} — ${pName}`;
              }
              return (
                <Fragment key={groupKey}>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <td colSpan={2} className="px-3 py-1.5 text-xs font-semibold text-slate-700">{groupLabel}</td>
                    <td className="px-3 py-1.5 text-xs font-semibold text-slate-700 text-right">
                      {groupTotal.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}
                    </td>
                    <td colSpan={5} />
                  </tr>
                  {items.map(renderRow)}
                </Fragment>
              );
            })
          ) : (
            details.filter(d => d.from_time && d.hours).map(renderRow)
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50">
            <td colSpan={2} className="px-3 py-1.5 text-xs font-semibold text-slate-700">{t("timesheets.total_label")}</td>
            <td className="px-3 py-1.5 text-xs font-semibold text-slate-700 text-right">
              {details.reduce((s, d) => s + d.hours, 0).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}
            </td>
            <td colSpan={5} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ─── ValidationModal ─── */

interface ValidationModalProps {
  warnings: ValidationWarning[];
  onClose: () => void;
  onApprove: () => void;
  tsName: string;
}

function ValidationModal({ warnings, onClose, onApprove, tsName }: ValidationModalProps) {
  const { t } = useTranslation();
  const hasWarnings = warnings.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between ${hasWarnings ? "bg-amber-50 border-b border-amber-200" : "bg-green-50 border-b border-green-200"}`}>
          <div className="flex items-center gap-2">
            {hasWarnings ? (
              <AlertTriangle size={20} className="text-amber-600" />
            ) : (
              <ShieldCheck size={20} className="text-green-600" />
            )}
            <h3 className={`font-semibold ${hasWarnings ? "text-amber-800" : "text-green-800"}`}>
              {hasWarnings ? `${warnings.length} ${t("timesheets.warnings")}` : t("timesheets.no_warnings")}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-sm text-slate-600 mb-3">
            {t("timesheets.timesheet_label")} <span className="font-mono font-medium">{tsName}</span>
          </p>
          {hasWarnings ? (
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {warnings.map((w, i) => {
                const badge = warningTypeLabels[w.type];
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-slate-700">{w.message}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-green-700">{t("timesheets.all_checks_passed")}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onApprove}
            className={`px-4 py-2 text-sm text-white rounded-lg cursor-pointer flex items-center gap-1 ${
              hasWarnings
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-y-teal hover:bg-y-teal-dark"
            }`}
          >
            <CheckCircle size={14} />
            {t("timesheets.approve")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Timesheets Goedkeuren ─── */

type DateRangePreset = "vorige_4_weken" | "vorige_week" | "dit_jaar" | "alle_drafts";

function getDateRangeForPreset(preset: DateRangePreset): { from: string | null; to: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - diffToMonday);
  // Always exclude current week
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const to = fmtD(lastSunday);

  switch (preset) {
    case "vorige_week": {
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      return { from: fmtD(lastMonday), to };
    }
    case "vorige_4_weken": {
      const fourWeeksAgo = new Date(thisMonday);
      fourWeeksAgo.setDate(thisMonday.getDate() - 28);
      return { from: fmtD(fourWeeksAgo), to };
    }
    case "dit_jaar": {
      return { from: `${now.getFullYear()}-01-01`, to };
    }
    case "alle_drafts": {
      return { from: null, to };
    }
  }
}

const presetLabelsKeys: Record<DateRangePreset, string> = {
  vorige_4_weken: "timesheets.preset_last_4_weeks",
  vorige_week: "timesheets.preset_last_week",
  dit_jaar: "timesheets.preset_this_year",
  alle_drafts: "timesheets.preset_all_drafts",
};

function TimesheetGoedkeuren() {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
  const allProjects = useProjects();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [expandedTs, setExpandedTs] = useState<string | null>(null);
  const [tsDetails, setTsDetails] = useState<Map<string, TSDetail[]>>(new Map());
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("dit_jaar");
  const [employeeActivityMap, setEmployeeActivityMap] = useState<Record<string, string>>({});

  // Fetch per-employee activity-type mapping (employer-configured) once on mount.
  // Bron is de Express-only settings-bridge (/api/shared-settings/*), die in
  // Y-next niet bestaat — zelfde gate + stille fallback als lib/activityTypes.ts
  // (isFeatureEnabled("shared-settings")); zonder mapping toont de kolom
  // gewoon de standaard-activiteit i.p.v. de werkgever-override.
  useEffect(() => {
    if (!isFeatureEnabled("shared-settings")) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/shared-settings/employee-activity-types", {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok && data.value && typeof data.value === "object") {
          setEmployeeActivityMap(data.value as Record<string, string>);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Validation modal state
  const [validationModal, setValidationModal] = useState<{
    tsName: string;
    warnings: ValidationWarning[];
  } | null>(null);

  const company = getActiveCompany();
  const defaultActivityType = getActiveActivityType() || undefined;
  const contractHours = getActiveContractHours();

  // Build employee ID set for company filtering
  const employeeIdSet = useMemo(() => {
    if (!company) return null;
    const set = new Set<string>();
    for (const emp of allEmployees) {
      if (emp.company === company) set.add(emp.name);
    }
    return set;
  }, [allEmployees, company]);

  // Project info for validation
  const projectInfos: ProjectInfo[] = useMemo(
    () => allProjects.map((p) => ({ name: p.name, company: p.company, project_name: p.project_name })),
    [allProjects]
  );

  const dateRange = useMemo(() => getDateRangeForPreset(datePreset), [datePreset]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [
        ["docstatus", "=", 0], // Draft only
      ];
      if (dateRange.from) filters.push(["start_date", ">=", dateRange.from]);
      // Always exclude current week
      filters.push(["start_date", "<=", dateRange.to]);

      const list = await fetchAll<Timesheet>(
        "Timesheet",
        [
          "name", "employee", "employee_name", "total_hours", "total_billed_hours",
          "total_billed_amount", "start_date", "end_date", "status", "company",
        ],
        filters,
        "employee_name asc, start_date asc"
      );

      // Filter by employee company if needed
      const filtered = employeeIdSet
        ? list.filter((t) => employeeIdSet.has(t.employee))
        : list;

      setTimesheets(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [datePreset, company]);

  async function loadDetails(tsName: string, force = false) {
    if (!force && tsDetails.has(tsName)) return;
    setDetailsLoading(tsName);
    try {
      const doc = await fetchDocument<{ time_logs: (TSDetail & { custom_subject?: string; is_billable?: number })[] }>("Timesheet", tsName);
      const details = (doc.time_logs || []).map(log => ({
        ...log,
        task_name: log.custom_subject || log.task_name,
        // Normalize ERPNext's `is_billable` to the internal `billable` field
        // the UI binds to — otherwise the checkbox always renders unchecked.
        billable: (log as any).is_billable ?? log.billable,
      })).sort((a, b) =>
        (a.from_time || "").localeCompare(b.from_time || "")
      );
      setTsDetails((prev) => new Map(prev).set(tsName, details));
    } catch {
      // ignore
    } finally {
      setDetailsLoading(null);
    }
  }

  async function handleUpdateDetail(detail: TSDetail, field: "task" | "description" | "billable" | "from_time" | "to_time", value: string) {
    const doc = await fetchDocument<{ name: string; time_logs: TSDetail[] }>("Timesheet", detail.parent);
    if (!doc.time_logs) return;
    const erpField = field === "billable" ? "is_billable" : field;
    const updatedLogs = doc.time_logs.map((log) => {
      if (log.name === detail.name) {
        const val = field === "billable" ? parseInt(value) : value;
        const updated = { ...log, [erpField]: val };
        if (field === "from_time" || field === "to_time") {
          const from = new Date(field === "from_time" ? value : log.from_time);
          const to = new Date(field === "to_time" ? value : (log as any).to_time);
          if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
            updated.hours = Math.max(0, (to.getTime() - from.getTime()) / 3600000);
          }
        }
        return updated;
      }
      return log;
    });
    await updateDocument("Timesheet", detail.parent, { time_logs: updatedLogs });
    // Update local state
    setTsDetails(prev => {
      const next = new Map(prev);
      const current = next.get(detail.parent) || [];
      next.set(detail.parent, current.map(d =>
        d.name === detail.name ? { ...d, [field]: field === "billable" ? parseInt(value) : value } : d
      ));
      return next;
    });
  }

  function toggleExpand(tsName: string) {
    if (expandedTs === tsName) {
      setExpandedTs(null);
    } else {
      setExpandedTs(tsName);
      loadDetails(tsName);
    }
  }

  async function handleApproveClick(ts: Timesheet) {
    // Load details if not already loaded
    let details = tsDetails.get(ts.name);
    if (!details) {
      setDetailsLoading(ts.name);
      try {
        const doc = await fetchDocument<{ time_logs: (TSDetail & { is_billable?: number })[] }>("Timesheet", ts.name);
        details = (doc.time_logs || []).map(log => ({
          ...log,
          // Normalize ERPNext's `is_billable` → internal `billable` for the
          // checkbox column. Without this the rendered state always shows
          // unchecked even when the timesheet has billable rows.
          billable: (log as any).is_billable ?? log.billable,
        })).sort((a, b) =>
          (a.from_time || "").localeCompare(b.from_time || "")
        );
        setTsDetails((prev) => new Map(prev).set(ts.name, details!));
      } catch {
        details = [];
      } finally {
        setDetailsLoading(null);
      }
    }

    // Find employee company
    const emp = allEmployees.find((e) => e.name === ts.employee);
    const empCompany = emp?.company || company || undefined;

    // Run validation
    const warnings = runTimesheetValidation(ts, details, empCompany, defaultActivityType, projectInfos, employeeActivityMap);
    setValidationModal({ tsName: ts.name, warnings });
  }

  async function handleConfirmApprove(tsName: string) {
    setValidationModal(null);
    setSubmittingId(tsName);
    try {
      // Frappe v15+ `frappe.client.submit` expects the full doc as its single
      // argument, not {doctype, name}. Fetch it first, then submit. Send the
      // doc as a JSON string — that's what the Python signature
      // `submit(doc)` actually accepts (it `json.loads()`es strings).
      const doc = await fetchDocument("Timesheet", tsName);
      await callMethod("frappe.client.submit", {
        doc: JSON.stringify(doc),
      });
      setTimesheets((prev) => prev.filter((t) => t.name !== tsName));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("timesheets.approve_error"));
    } finally {
      setSubmittingId(null);
    }
  }

  // Calculate expected daily hours from contract
  function getHoursHighlight(ts: Timesheet): string {
    if (!contractHours || isNaN(contractHours)) return "";
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
    const expected = workdays * dailyHours;
    return Math.abs(ts.total_hours - expected) > 0.5 ? "bg-amber-100" : "";
  }

  // Group by employee
  const grouped = useMemo(() => {
    const map = new Map<string, Timesheet[]>();
    for (const ts of timesheets) {
      const key = ts.employee_name || ts.employee;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ts);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [timesheets]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{t("timesheets.tab.approve")}</h3>
          <p className="text-sm text-slate-500">
            {dateRange.from ? `${dateRange.from} ${t("date_range.through")} ${dateRange.to}` : `${t("timesheets.preset_all_drafts")} ${t("date_range.through")} ${dateRange.to}`}
            {company && <span className="ml-2 text-slate-400">· {company}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
            {(Object.keys(presetLabelsKeys) as DateRangePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => setDatePreset(p)}
                className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  datePreset === p
                    ? "bg-y-teal text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t(presetLabelsKeys[p])}
              </button>
            ))}
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer text-sm"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center text-slate-400 py-12">{t("common.loading")}</div>
      ) : timesheets.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">{t("timesheets.all_approved")}</p>
          <p className="text-sm text-slate-400 mt-1">{t("timesheets.no_drafts_to_review")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([empName, sheets]) => (
            <div key={empName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-y-teal flex items-center justify-center text-white text-xs font-bold">
                    {empName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-700">{empName}</span>
                </div>
                <span className="text-sm text-slate-500">
                  {sheets.reduce((s, t) => s + t.total_hours, 0).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} {t("common.hour_unit")} {t("timesheets.total_label")}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {sheets.map((ts) => (
                  <div key={ts.name}>
                    <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleExpand(ts.name)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                        >
                          <ChevronRight
                            size={16}
                            className={`transition-transform ${expandedTs === ts.name ? "rotate-90" : ""}`}
                          />
                        </button>
                        <a
                          href={`${getErpNextLinkUrl()}/timesheet/${ts.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono text-y-teal hover:underline"
                        >
                          {ts.name}
                        </a>
                        <span className="text-sm text-slate-500">{ts.start_date}</span>
                        <span className={`text-sm font-medium text-slate-700 px-1 rounded ${getHoursHighlight(ts)}`}>
                          {ts.total_hours.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} {t("common.hour_unit")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`${getErpNextLinkUrl()}/timesheet/${ts.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          {t("timesheets.view")}
                        </a>
                        <button
                          onClick={() => handleApproveClick(ts)}
                          disabled={submittingId === ts.name || detailsLoading === ts.name}
                          className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle size={14} />
                          {submittingId === ts.name ? t("common.saving") : detailsLoading === ts.name ? t("common.loading") : t("timesheets.approve")}
                        </button>
                      </div>
                    </div>
                    {/* Expanded details */}
                    {expandedTs === ts.name && (
                      <div className="px-4 pb-3 border-t border-slate-100 bg-slate-50/50">
                        <TimesheetDetailsTable
                          details={tsDetails.get(ts.name) || []}
                          projects={projectInfos}
                          employeeCompany={allEmployees.find((e) => e.name === ts.employee)?.company}
                          defaultActivityType={defaultActivityType}
                          employeeId={ts.employee}
                          employeeActivityTypes={employeeActivityMap}
                          loading={detailsLoading === ts.name}
                          defaultGroupBy="dag"
                          hideBillable={localStorage.getItem("view_mode") === "employee"}
                          onUpdateDetail={handleUpdateDetail}
                          onRefresh={() => loadDetails(ts.name, true)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Validation Modal */}
      {validationModal && (
        <ValidationModal
          warnings={validationModal.warnings}
          onClose={() => setValidationModal(null)}
          onApprove={() => handleConfirmApprove(validationModal.tsName)}
          tsName={validationModal.tsName}
        />
      )}
    </div>
  );
}
