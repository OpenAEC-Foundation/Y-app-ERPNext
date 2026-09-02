import { Fragment, useEffect, useState, useMemo, useRef, useCallback } from "react";
import { fetchList, fetchChildTable, fetchDocument, createDocument, getErpNextLinkUrl, isDoctypeMissing } from "../lib/erpnext";
import {
  bucketHoursByEmployeeDay,
  bucketHoursByEmployeeWeek,
  fetchTimesheetHourRows,
  type TimesheetHourRow,
} from "../lib/timesheet-hours";
import CompanySelect from "../components/CompanySelect";
import { useEmployees } from "../lib/DataContext";
import { fetchShiftHoursMap, fetchShiftDayHoursMap, fetchEmployeeDayHours } from "../lib/shiftHours";
import {
  getEmployeeHolidaySet,
  getEmployeeHolidayDescription,
} from "../lib/employeeHolidays";

import { HOLIDAYS, isHoliday } from "../lib/holidays";
import { fetchEmployeeShiftWorkdays } from "../lib/missingDays";
import { expectedWeekHours, isCountableWorkday, hoursForDay, isoWeekMonday } from "../lib/overtimeBalance";

/** Fallback-rooster (ma‑vr) voor medewerkers zonder Shift Plan (alleen Shift Assignment). */
const DEFAULT_WORKDAYS = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);

/**
 * A holiday lookup function: returns the holiday name for a date, or null if
 * the date is not a holiday. Used to inject either the generic NL list
 * (year-overview) or an employee-specific Holiday List set (the modal).
 */
type HolidayLookup = (dateStr: string) => string | null;

/** Default lookup using the generic NL holidays list (lib/holidays.ts). */
function defaultHolidayLookup(dateStr: string): string | null {
  const year = parseInt(dateStr.slice(0, 4), 10);
  return isHoliday(dateStr, year);
}
import {
  CalendarCheck, RefreshCw, Search, Filter, ExternalLink,
  CheckCircle2, Clock, XCircle, CalendarDays, ZoomIn,
  Thermometer, ArrowUpDown, Plus, X, AlertTriangle, Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getActiveCompany, getActiveEmployee } from "../lib/instances";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { nl } from "react-day-picker/locale";

const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface LeaveApplication {
  name: string;
  employee_name: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  total_leave_days: number;
  status: string;
  company: string;
  /** ERPNext: 1 = één dag van de aanvraag is een halve dag. */
  half_day?: 0 | 1;
  /** De specifieke datum (YYYY-MM-DD) die als halve dag telt. */
  half_day_date?: string;
}

interface LeaveAllocation {
  name: string;
  employee: string;
  employee_name: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  new_leaves_allocated: number;
  total_leaves_allocated: number;
  company: string;
}

const statusColors: Record<string, string> = {
  Approved: "bg-y-teal/10 text-y-teal-dark",
  Open: "bg-orange-100 text-orange-700",
  Rejected: "bg-red-100 text-red-700",
};

const MONTH_KEYS = [
  "vakantieplanning.month_jan", "vakantieplanning.month_feb", "vakantieplanning.month_mrt",
  "vakantieplanning.month_apr", "vakantieplanning.month_mei", "vakantieplanning.month_jun",
  "vakantieplanning.month_jul", "vakantieplanning.month_aug", "vakantieplanning.month_sep",
  "vakantieplanning.month_okt", "vakantieplanning.month_nov", "vakantieplanning.month_dec",
];

const DAY_KEYS = [
  "vakantieplanning.day_ma", "vakantieplanning.day_di", "vakantieplanning.day_wo",
  "vakantieplanning.day_do", "vakantieplanning.day_vr",
];

/* ── Helpers ── */

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function dayOfYear(dateStr: string, year: number): number {
  const parts = dateStr.split("-");
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  let doy = 0;
  for (let m = 0; m < month; m++) {
    doy += daysInMonth(year, m);
  }
  return doy + day - 1;
}

function totalDaysInYear(year: number): number {
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
}

function isZiekte(leaveType: string): boolean {
  return leaveType.toLowerCase().includes("ziekte");
}

function getBarColor(status: string, leaveType: string): string {
  if (status === "Approved" && isZiekte(leaveType)) return "bg-red-400";
  if (status === "Approved") return "bg-y-teal";
  if (status === "Open") return "bg-orange-400";
  return "bg-slate-300";
}

function getISOWeek(d: Date): number {
  const tmp = new Date(d.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const w1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

export default function Leave() {
  const { t } = useTranslation();
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Set once the initial load has confirmed Leave Application/Leave
  // Allocation don't exist on this ERPNext instance (no HRMS app installed —
  // see lib/erpnext.ts's missing-doctype cache). When true, every count and
  // balance below is structurally zero, not a data fact, so the page shows
  // a dedicated notice instead of a misleading wall of zeros.
  const [hrModuleUnavailable, setHrModuleUnavailable] = useState(false);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState("");
  const [company, setCompany] = useState(getActiveCompany());
  const [activeTab, setActiveTab] = useState<"kalender" | "aanvragen" | "overuren">("overuren");
  // Geboekte uren op regelniveau (zie lib/timesheet-hours.ts) — de bron voor
  // álle "gewerkt"-getallen op deze pagina.
  const [hourRows, setHourRows] = useState<TimesheetHourRow[]>([]);
  const [allocations, setAllocations] = useState<LeaveAllocation[]>([]);
  const [contractHoursMap, setContractHoursMap] = useState<Record<string, number>>({});
  const [missingShiftEmployees, setMissingShiftEmployees] = useState<Set<string>>(new Set());
  // Werkelijk rooster (Shift Plan repeat_on_days) + werkgever-Holiday-List per
  // medewerker, voor een accurate overuren/verlof-saldo-berekening. Beide vullen
  // async; zolang ze leeg zijn valt de berekening terug op ma‑vr + de NL-lijst.
  const [workdaysMap, setWorkdaysMap] = useState<Map<string, Set<string>>>(new Map());
  const [holidaySets, setHolidaySets] = useState<Map<string, Set<string>>>(new Map());
  // Werkelijke uren per weekdag uit de Shift Plan (bv. {Friday:4}); leeg = terugval op weekuren/dagen.
  const [dayHoursMap, setDayHoursMap] = useState<Record<string, Record<string, number>>>({});
  const allEmployees = useEmployees();

  // Leave request modal state
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [];
      if (company) filters.push(["company", "=", company]);
      if (statusFilter) filters.push(["status", "=", statusFilter]);
      // Fetch leaves that overlap with the selected year
      filters.push(["from_date", "<=", `${year}-12-31`]);
      filters.push(["to_date", ">=", `${year}-01-01`]);

      const allocFilters: unknown[][] = [
        ["docstatus", "=", 1],
        ["from_date", "<=", `${year}-12-31`],
        ["to_date", ">=", `${year}-01-01`],
      ];
      if (company) allocFilters.push(["company", "=", company]);

      // Gewerkte uren komen op REGELNIVEAU binnen (`Timesheet Detail`), niet
      // meer als `total_hours` per sheet: sinds de urenstaat per jaar loopt
      // zou een sheettotaal volledig in de week van `start_date` (begin
      // januari) landen. Zie lib/timesheet-hours.ts. Eén gedeelde fetch voor
      // het hele jaar; Timesheet.company is in ERPNext vaak leeg, dus de
      // medewerkerfiltering blijft client-side via filteredEmployees.
      const [list, allocData, tsHourRows, shiftResult] = await Promise.all([
        fetchList<LeaveApplication>("Leave Application", {
          fields: [
            "name", "employee_name", "leave_type", "from_date", "to_date",
            "total_leave_days", "status", "company", "half_day", "half_day_date",
          ],
          filters,
          limit_page_length: 500,
          order_by: "from_date asc",
        }),
        fetchList<LeaveAllocation>("Leave Allocation", {
          fields: [
            "name", "employee", "employee_name", "leave_type", "from_date", "to_date",
            "new_leaves_allocated", "total_leaves_allocated", "company",
          ],
          filters: allocFilters,
          limit_page_length: 500,
        }),
        fetchTimesheetHourRows(
          { from: `${year}-01-01`, to: `${year}-12-31` },
          { fetchList, fetchChildTable }
        ),
        fetchShiftHoursMap(),
      ]);
      setLeaves(list);
      setAllocations(allocData);
      setHourRows(tsHourRows);
      // fetchList already degraded these to [] instead of throwing if the
      // doctype itself doesn't exist on this instance (no HRMS app) — check
      // that after the fact so the UI can explain *why* everything is zero.
      setHrModuleUnavailable(isDoctypeMissing("Leave Application") || isDoctypeMissing("Leave Allocation"));

      // Use shared shift hours utility (B09/B11: real Shift Type data, no name-parsing)
      setContractHoursMap(shiftResult.hoursMap);
      setMissingShiftEmployees(shiftResult.missingEmployees);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [year, statusFilter, company]);

  // Haal het werkelijke rooster + de Holiday List per medewerker op zodra de
  // medewerkerslijst geladen is (los van loadData, dat op year/company draait).
  useEffect(() => {
    const emps = allEmployees.filter(
      (e) => e.status === "Active" && (!company || e.company === company),
    );
    if (emps.length === 0) return;
    let cancelled = false;
    (async () => {
      const ids = emps.map((e) => e.name);
      const [wd, holidayEntries, dayHours] = await Promise.all([
        fetchEmployeeShiftWorkdays(ids).catch(() => new Map<string, Set<string>>()),
        Promise.all(
          emps.map(async (e) => [e.name, await getEmployeeHolidaySet(e.name)] as const),
        ),
        fetchShiftDayHoursMap().catch(() => ({} as Record<string, Record<string, number>>)),
      ]);
      if (cancelled) return;
      setWorkdaysMap(wd);
      setHolidaySets(new Map(holidayEntries));
      setDayHoursMap(dayHours);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [allEmployees, company]);

  const filtered = useMemo(() => {
    if (!search.trim()) return leaves;
    const q = search.toLowerCase();
    return leaves.filter((l) => l.employee_name.toLowerCase().includes(q));
  }, [leaves, search]);

  // Group by employee for calendar
  const employeeLeaves = useMemo(() => {
    const map = new Map<string, LeaveApplication[]>();
    for (const l of filtered) {
      if (!map.has(l.employee_name)) map.set(l.employee_name, []);
      map.get(l.employee_name)!.push(l);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // Filtered employees for overuren view
  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase();
    let emps = allEmployees.filter((e: any) => e.status === "Active" && (!company || e.company === company));
    if (search.trim()) {
      emps = emps.filter((e: any) => e.employee_name.toLowerCase().includes(q));
    }
    return emps;
  }, [allEmployees, company, search]);

  // KPI counts
  const totalCount = filtered.length;
  const approvedCount = filtered.filter((l) => l.status === "Approved").length;
  const openCount = filtered.filter((l) => l.status === "Open").length;
  const rejectedCount = filtered.filter((l) => l.status === "Rejected").length;

  const totalDays = totalDaysInYear(year);

  // Calculate month start positions as percentages
  const monthPositions = useMemo(() => {
    const positions: { left: number; width: number }[] = [];
    let dayCount = 0;
    for (let m = 0; m < 12; m++) {
      const days = daysInMonth(year, m);
      positions.push({
        left: (dayCount / totalDays) * 100,
        width: (days / totalDays) * 100,
      });
      dayCount += days;
    }
    return positions;
  }, [year, totalDays]);

  // ── Uren saldo data ──
  const now = new Date();
  const currentWeekNum = now.getFullYear() === year ? getISOWeek(now) : 53;
  const lastCompletedWeek = Math.max(0, currentWeekNum - 1);

  const urenSaldoData = useMemo(() => {
    const result: {
      empId: string;
      empName: string;
      vakantieAllocated: number;
      vakantieUsed: number;
      vakantiePending: number;
      ziekteUsed: number;
      overurenSaldo: number | undefined;
    }[] = [];

    const empList = allEmployees.filter((e: any) => e.status === "Active" && (!company || e.company === company));
    const approvedLeaves = leaves.filter(l => l.status === "Approved");
    const openLeaves = leaves.filter(l => l.status === "Open");
    // Eén keer bucketen voor alle medewerkers, op de datum van elke geboekte
    // regel — niet op de sheet-`start_date`, die bij een jaarstaat altijd
    // begin januari is.
    const gewerktPerWeek = bucketHoursByEmployeeWeek(hourRows);

    for (const emp of empList) {
      // Vakantie allocation
      const empAllocs = allocations.filter(a => a.employee === emp.name && !isZiekte(a.leave_type));
      const vakantieAllocated = empAllocs.reduce((s, a) => s + a.total_leaves_allocated, 0);

      // Vakantie used (approved, non-ziekte)
      const empLeaves = approvedLeaves.filter(l => l.employee_name === emp.employee_name);
      const vakantieUsed = empLeaves.filter(l => !isZiekte(l.leave_type)).reduce((s, l) => s + l.total_leave_days, 0);
      const ziekteUsed = empLeaves.filter(l => isZiekte(l.leave_type)).reduce((s, l) => s + l.total_leave_days, 0);

      // Vakantie pending (open requests, non-ziekte)
      const empOpenLeaves = openLeaves.filter(l => l.employee_name === emp.employee_name);
      const vakantiePending = empOpenLeaves.filter(l => !isZiekte(l.leave_type)).reduce((s, l) => s + l.total_leave_days, 0);

      // Netto uren-saldo (zelfde logica als OverurenView, gedeelde helper).
      // B10: geen berekening voor medewerkers zonder shift-data.
      const weeklyHours = contractHoursMap[emp.name];
      let saldo = 0;

      if (weeklyHours !== undefined && !missingShiftEmployees.has(emp.name)) {
        // Echt rooster + werkgever-feestdagen waar beschikbaar; anders ma‑vr + NL-lijst.
        const workdays = workdaysMap.get(emp.name) ?? DEFAULT_WORKDAYS;
        const holidaySet = holidaySets.get(emp.name) ?? new Set<string>();
        const dayHours = dayHoursMap[emp.name];
        const joinDate = emp.date_of_joining ? new Date(emp.date_of_joining + "T12:00:00") : null;

        const weekMap = new Map<number, { gewerkt: number; verlof: number; ziekte: number }>();

        for (const [week, gewerkt] of gewerktPerWeek.get(emp.name) ?? []) {
          if (!weekMap.has(week)) weekMap.set(week, { gewerkt: 0, verlof: 0, ziekte: 0 });
          weekMap.get(week)!.gewerkt += gewerkt;
        }

        for (const la of approvedLeaves) {
          if (la.employee_name !== emp.employee_name) continue;
          const from = new Date(la.from_date);
          const to = new Date(la.to_date);
          const d = new Date(from);
          while (d <= to) {
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            // Verlof/ziekte tellen alleen op werkelijke werkdagen die geen feestdag zijn,
            // met de echte dag-uren (niet hardcoded 8).
            if (d.getFullYear() === year && isCountableWorkday(dateStr, workdays, holidaySet)) {
              const week = getISOWeek(d);
              if (!weekMap.has(week)) weekMap.set(week, { gewerkt: 0, verlof: 0, ziekte: 0 });
              const dh = hoursForDay(DAY_NAMES_EN[d.getDay()], weeklyHours, workdays, dayHours);
              const hrs = dh * (la.half_day && la.half_day_date === dateStr ? 0.5 : 1);
              if (isZiekte(la.leave_type)) {
                weekMap.get(week)!.ziekte += hrs;
              } else {
                weekMap.get(week)!.verlof += hrs;
              }
            }
            d.setDate(d.getDate() + 1);
          }
        }

        for (const [w, wd] of weekMap) {
          if (w > lastCompletedWeek) continue;
          const weekTotal = wd.gewerkt + wd.verlof + wd.ziekte;
          if (weekTotal <= 0) continue;
          // Sla weken volledig vóór indiensttreding over (anders vals tekort).
          if (joinDate) {
            const weekEnd = isoWeekMonday(year, w);
            weekEnd.setDate(weekEnd.getDate() + 6);
            if (weekEnd < joinDate) continue;
          }
          const { expected } = expectedWeekHours({ year, week: w, weeklyHours, workdays, holidaySet, dayHours });
          saldo += weekTotal - expected; // netto: tekort-weken tellen mee
        }
      }

      result.push({
        empId: emp.name,
        empName: emp.employee_name,
        vakantieAllocated,
        vakantieUsed,
        vakantiePending,
        ziekteUsed,
        overurenSaldo: missingShiftEmployees.has(emp.name) ? undefined : saldo,
      });
    }

    return result.sort((a, b) => a.empName.localeCompare(b.empName));
  }, [allEmployees, company, leaves, allocations, hourRows, year, lastCompletedWeek, contractHoursMap, missingShiftEmployees, workdaysMap, holidaySets]);

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t("nav.leave_overtime")}</h2>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {t("common.refresh")}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {!loading && hrModuleUnavailable && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-3">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{t("y_next.module_unavailable")}</span>
        </div>
      )}

      {/* KPI Cards - clickable to switch to aanvragen tab */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <div
          className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveTab("aanvragen")}
        >
          <div className="p-2 bg-y-teal/10 rounded-lg">
            <CalendarCheck className="text-y-teal" size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("leave.total_requests")}</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? "..." : totalCount}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveTab("aanvragen")}
        >
          <div className="p-2 bg-y-teal/10 rounded-lg">
            <CheckCircle2 className="text-y-teal" size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("vakantieplanning.approved")}</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? "..." : approvedCount}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveTab("aanvragen")}
        >
          <div className="p-2 bg-orange-100 rounded-lg">
            <Clock className="text-orange-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("vakantieplanning.open")}</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? "..." : openCount}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveTab("aanvragen")}
        >
          <div className="p-2 bg-red-100 rounded-lg">
            <XCircle className="text-red-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("vakantieplanning.rejected")}</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? "..." : rejectedCount}</p>
          </div>
        </div>
      </div>

      {/* Uren saldo cards */}
      {!loading && urenSaldoData.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer size={16} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-600">{t("vakantieplanning.hours_balance")}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {urenSaldoData.map((emp) => {
              const vakantieRemaining = emp.vakantieAllocated - emp.vakantieUsed;
              const vakantieBarPct = emp.vakantieAllocated > 0
                ? Math.max(0, (vakantieRemaining / emp.vakantieAllocated) * 100)
                : 0;
              const vakantieColor = vakantieRemaining <= 3 ? "bg-red-500" : vakantieRemaining <= 5 ? "bg-amber-500" : "bg-emerald-500";
              const ziekteBarPct = Math.min(100, emp.ziekteUsed * 4); // scale: 25 days = full bar

              return (
                <div key={emp.empId} className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-700 mb-2 truncate">{emp.empName}</p>

                  {/* Vakantie bar */}
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                      <span>{t("vakantieplanning.vacation")}</span>
                      <span>{t("vakantieplanning.days_of", { remaining: Math.round(vakantieRemaining), total: Math.round(emp.vakantieAllocated) })}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${vakantieColor} transition-all`}
                        style={{ width: `${vakantieBarPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Pending leave */}
                  {emp.vakantiePending > 0 && (
                    <div className="flex items-center justify-between text-[10px] mb-1.5">
                      <span className="text-orange-500 font-medium">+ {Math.round(emp.vakantiePending)}d {t("vakantieplanning.pending", "aangevraagd")}</span>
                    </div>
                  )}

                  {/* Ziekte bar */}
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                      <span>{t("vakantieplanning.sickness")}</span>
                      <span>{t("vakantieplanning.days_count", { count: Math.round(emp.ziekteUsed) })}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-orange-400 transition-all"
                        style={{ width: `${ziekteBarPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Overuren */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">{t("vakantieplanning.overtime")}</span>
                    {emp.overurenSaldo !== undefined ? (
                      <span className={`font-semibold ${emp.overurenSaldo > 0 ? "text-red-600" : emp.overurenSaldo < 0 ? "text-blue-600" : "text-slate-400"}`}>
                        {emp.overurenSaldo > 0 ? "+" : ""}{Math.round(emp.overurenSaldo)}u
                      </span>
                    ) : (
                      <span className="text-amber-500 font-semibold" title={t("warnings.shift_hours_defaulted")}>—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Filter size={16} className="text-slate-400" />
        <CompanySelect value={company} onChange={setCompany} />
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          <option value={2024}>2024</option>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          <option value="">{t("common.all_statuses")}</option>
          <option value="Approved">{t("vakantieplanning.approved")}</option>
          <option value="Open">{t("vakantieplanning.open")}</option>
          <option value="Rejected">{t("vakantieplanning.rejected")}</option>
        </select>
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t("vakantieplanning.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-y-teal text-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setActiveTab("overuren")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "overuren"
              ? "bg-y-teal text-white"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Clock size={16} />
          {t("vakantieplanning.overtime")}
        </button>
        <button
          onClick={() => setActiveTab("kalender")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "kalender"
              ? "bg-y-teal text-white"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <CalendarDays size={16} />
          {t("vakantieplanning.calendar")}
        </button>
        <button
          onClick={() => setActiveTab("aanvragen")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "aanvragen"
              ? "bg-y-teal text-white"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <CalendarCheck size={16} />
          {t("vakantieplanning.requests")}
        </button>
        <button
          onClick={() => setShowLeaveModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-y-teal border border-y-teal hover:bg-y-teal/5 cursor-pointer transition-colors"
        >
          <Plus size={16} />
          {t("vakantieplanning.new_request", "Nieuwe aanvraag")}
        </button>
      </div>

      {/* Content */}
      {activeTab === "overuren" ? (
        loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">{t("common.loading")}</div>
        ) : (
          <OverurenView
            employees={filteredEmployees}
            hourRows={hourRows}
            leaves={leaves}
            year={year}
            company={company}
            contractHoursMap={contractHoursMap}
            missingShiftEmployees={missingShiftEmployees}
            workdaysMap={workdaysMap}
            holidaySets={holidaySets}
            dayHoursMap={dayHoursMap}
          />
        )
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">{t("common.loading")}</div>
      ) : activeTab === "kalender" ? (
        <CalendarView
          employeeLeaves={employeeLeaves}
          allEmployeeNames={filteredEmployees.map((e: any) => e.employee_name as string)}
          year={year}
          totalDays={totalDays}
          monthPositions={monthPositions}
        />
      ) : (
        <AanvragenView leaves={filtered} />
      )}

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <LeaveRequestModal
          employees={allEmployees.filter(e => e.status === "Active")}
          allocations={allocations}
          company={company}
          onClose={() => setShowLeaveModal(false)}
          onCreated={() => { setShowLeaveModal(false); loadData(); }}
        />
      )}
    </div>
  );
}

/* ──────────── Leave Request Modal ──────────── */

interface LeaveRequestModalProps {
  employees: { name: string; employee_name: string; company: string }[];
  allocations: LeaveAllocation[];
  company: string;
  onClose: () => void;
  onCreated: () => void;
}

interface WorkBlock {
  from: string;
  to: string;
  /** Effectieve verlofdagen: hele dagen tellen 1, een halve-dag-dag telt 0,5. */
  days: number;
  /** Als gezet: de (laatste) dag van dit blok is een halve dag (ERPNext half_day_date). */
  halfDayDate?: string;
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function splitIntoWorkBlocks(
  fromDate: string, toDate: string,
  workdays: Set<string>,
  holidayLookup: HolidayLookup = defaultHolidayLookup,
  isHalfDay: (dateStr: string) => boolean = () => false,
): WorkBlock[] {
  const blocks: WorkBlock[] = [];
  const start = new Date(fromDate + "T12:00:00");
  const end = new Date(toDate + "T12:00:00");

  let blockStart: string | null = null;
  let blockEnd: string | null = null;
  let blockDays = 0;
  const flush = (halfDayDate?: string) => {
    if (blockStart && blockEnd) {
      blocks.push({ from: blockStart, to: blockEnd, days: blockDays, ...(halfDayDate ? { halfDayDate } : {}) });
    }
    blockStart = null; blockEnd = null; blockDays = 0;
  };
  const cur = new Date(start);

  while (cur <= end) {
    const dayName = DAY_NAMES_EN[cur.getDay()];
    const dateStr = localDateStr(cur);
    const isWorkDay = workdays.has(dayName) && !holidayLookup(dateStr);

    if (isWorkDay) {
      if (!blockStart) blockStart = dateStr;
      blockEnd = dateStr;
      if (isHalfDay(dateStr)) {
        // Halve dag = laatste dag van dit blok (ERPNext ondersteunt één
        // half_day_date per aanvraag); sluit het blok hier af.
        blockDays += 0.5;
        flush(dateStr);
      } else {
        blockDays += 1;
      }
    } else {
      flush();
    }
    cur.setDate(cur.getDate() + 1);
  }
  flush();
  return blocks;
}

function getSkippedDays(
  fromDate: string, toDate: string,
  workdays: Set<string>,
  holidayLookup: HolidayLookup = defaultHolidayLookup,
): { date: string; reason: string }[] {
  const skipped: { date: string; reason: string }[] = [];
  const start = new Date(fromDate + "T12:00:00");
  const end = new Date(toDate + "T12:00:00");
  const cur = new Date(start);
  while (cur <= end) {
    const dayName = DAY_NAMES_EN[cur.getDay()];
    const dateStr = localDateStr(cur);
    const holidayName = holidayLookup(dateStr);
    if (!workdays.has(dayName)) {
      // Only show weekdays that are skipped due to schedule (not weekends)
      if (cur.getDay() !== 0 && cur.getDay() !== 6) {
        skipped.push({ date: dateStr, reason: "schedule" });
      }
    } else if (holidayName) {
      skipped.push({ date: dateStr, reason: holidayName });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return skipped;
}

function formatDateNL(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

function LeaveRequestModal({ employees, allocations, company, onClose, onCreated }: LeaveRequestModalProps) {
  const { t } = useTranslation();
  const defaultEmp = getActiveEmployee();

  const [step, setStep] = useState<"form" | "confirm">("form");
  const [employee, setEmployee] = useState(defaultEmp);
  const [leaveType, setLeaveType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [description, setDescription] = useState("");
  const [halfDayDate, setHalfDayDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [calMonth, setCalMonth] = useState(new Date());

  // Shift plan workdays for selected employee
  const [workdays, setWorkdays] = useState<Set<string>>(new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]));
  const [loadingShift, setLoadingShift] = useState(false);
  // Werkelijke uren per weekdag uit de Shift Plan (bv. {…, Friday: 4}) — om een
  // roosterdag van een halve dag automatisch als halve dag te herkennen.
  const [dayHours, setDayHours] = useState<Record<string, number>>({});

  // Computed blocks for confirmation step
  const [blocks, setBlocks] = useState<WorkBlock[]>([]);
  const [skippedDays, setSkippedDays] = useState<{ date: string; reason: string }[]>([]);

  // Existing leaves for the selected employee (for tooltip)
  const [existingLeaves, setExistingLeaves] = useState<{ from_date: string; to_date: string; leave_type: string; status: string }[]>([]);

  // Available leave types based on employee's allocations
  const availableLeaveTypes = useMemo(() => {
    if (!employee) return [];
    const empAllocs = allocations.filter(a => a.employee === employee);
    return [...new Set(empAllocs.map(a => a.leave_type))];
  }, [employee, allocations]);

  // Auto-select first leave type when employee changes
  useEffect(() => {
    if (availableLeaveTypes.length > 0 && !availableLeaveTypes.includes(leaveType)) {
      setLeaveType(availableLeaveTypes[0]);
    } else if (availableLeaveTypes.length === 0) {
      setLeaveType("");
    }
  }, [availableLeaveTypes]);

  // Load existing leaves for tooltip
  useEffect(() => {
    if (!employee) { setExistingLeaves([]); return; }
    const emp = employees.find(e => e.name === employee);
    if (!emp) return;
    fetchList<{ from_date: string; to_date: string; leave_type: string; status: string }>("Leave Application", {
      fields: ["from_date", "to_date", "leave_type", "status"],
      filters: [["employee_name", "=", emp.employee_name], ["status", "in", ["Open", "Approved"]]],
      limit_page_length: 100,
      order_by: "from_date desc",
    }).then(setExistingLeaves).catch(() => setExistingLeaves([]));
  }, [employee, employees]);

  // Load this employee's Holiday List from ERPNext. The result is the
  // authoritative source for which days count as paid holidays — NOT the
  // generic NL list in lib/holidays.ts. Bevrijdingsdag, for instance, is
  // only vrij in lustrum years and only when the employer chooses to.
  const [empHolidays, setEmpHolidays] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!employee) { setEmpHolidays(new Set()); return; }
    let cancelled = false;
    getEmployeeHolidaySet(employee).then((s) => {
      if (!cancelled) setEmpHolidays(s);
    });
    return () => { cancelled = true; };
  }, [employee]);

  // Holiday lookup specific to this employee. Replaces the generic
  // isHoliday(date, year) inside this modal.
  const empHolidayLookup = useCallback<HolidayLookup>((dateStr) => {
    if (!empHolidays.has(dateStr)) return null;
    return getEmployeeHolidayDescription(employee, dateStr) || "Feestdag";
  }, [empHolidays, employee]);

  // Load shift plan when employee changes
  useEffect(() => {
    if (!employee) return;
    setLoadingShift(true);
    fetchList<{ shift_plan: string }>("Shift Plan Assignment", {
      fields: ["shift_plan"],
      filters: [["employee", "=", employee]],
      limit_page_length: 1,
    }).then(async (assignments) => {
      if (assignments.length > 0 && assignments[0].shift_plan) {
        const plan = await fetchDocument<{ repeat_on_days: { day: string }[] }>("Shift Plan", assignments[0].shift_plan);
        if (plan.repeat_on_days?.length) {
          setWorkdays(new Set(plan.repeat_on_days.map(d => d.day)));
          return;
        }
      }
      setWorkdays(new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]));
    }).catch(() => {
      setWorkdays(new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]));
    }).finally(() => setLoadingShift(false));
  }, [employee]);

  // Werkelijke uren per weekdag (voor automatische halve-dag-herkenning).
  useEffect(() => {
    if (!employee) { setDayHours({}); return; }
    let cancelled = false;
    fetchEmployeeDayHours(employee)
      .then((dh) => { if (!cancelled) setDayHours(dh); })
      .catch(() => { if (!cancelled) setDayHours({}); });
    return () => { cancelled = true; };
  }, [employee]);

  // Weekdag-namen die volgens het rooster een halve dag zijn: uren ≈ helft van
  // de volledige werkdag (bv. 4u bij een 8u-dag). "3BM: alleen halve dagen."
  const halfDayNames = useMemo(() => {
    const vals = Object.values(dayHours);
    const s = new Set<string>();
    if (vals.length === 0) return s;
    const fullDay = Math.max(...vals);
    for (const [day, h] of Object.entries(dayHours)) {
      if (h > 0 && h < fullDay && Math.abs(h - fullDay / 2) < 0.01) s.add(day);
    }
    return s;
  }, [dayHours]);

  const isRosterHalfDay = useCallback((dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return halfDayNames.has(DAY_NAMES_EN[d.getDay()]);
  }, [halfDayNames]);

  // Calculate preview totals
  const dayBreakdown = useMemo(() => {
    if (!fromDate || !toDate) return { workDays: 0, totalDays: 0, holidays: 0, nonWorkDays: 0 };
    const start = new Date(fromDate + "T12:00:00");
    const end = new Date(toDate + "T12:00:00");
    if (end < start) return { workDays: 0, totalDays: 0, holidays: 0, nonWorkDays: 0 };
    let workDays = 0, holidays = 0, nonWorkDays = 0, totalDays = 0;
    const cur = new Date(start);
    while (cur <= end) {
      totalDays++;
      const dayName = DAY_NAMES_EN[cur.getDay()];
      const dateStr = localDateStr(cur);
      if (!workdays.has(dayName)) { nonWorkDays++; }
      else if (empHolidayLookup(dateStr)) { holidays++; }
      else { workDays++; }
      cur.setDate(cur.getDate() + 1);
    }
    return { workDays, totalDays, holidays, nonWorkDays };
  }, [fromDate, toDate, workdays, empHolidayLookup]);

  // Tooltip for calendar days
  const getDayTooltip = useCallback((date: Date): string | undefined => {
    const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const dayName = DAY_NAMES_EN[date.getDay()];
    // Check existing leave
    const leave = existingLeaves.find(l => ds >= l.from_date && ds <= l.to_date);
    if (leave) return `${leave.leave_type} (${leave.status === "Open"
      ? t("leave.status_requested", { defaultValue: "requested" })
      : t("leave.status_approved", { defaultValue: "approved" })})`;
    // Check holiday (employee-specific from ERPNext Holiday List)
    const holidayName = empHolidayLookup(ds);
    if (holidayName) return holidayName;
    // Check non-workday
    if (!workdays.has(dayName)) return t("leave.non_workday_tooltip", { defaultValue: "Non-workday (schedule)" });
    return undefined;
  }, [workdays, existingLeaves, empHolidayLookup, t]);

  const workdayNames = Array.from(workdays).join(", ");
  const selectedEmp = employees.find(e => e.name === employee);

  // Workday dates in the range (for half-day picker)
  const workDayDates = useMemo(() => {
    if (!fromDate || !toDate) return [];
    const dates: string[] = [];
    const cur = new Date(fromDate + "T12:00:00");
    const end = new Date(toDate + "T12:00:00");
    while (cur <= end) {
      const dayName = DAY_NAMES_EN[cur.getDay()];
      const dateStr = localDateStr(cur);
      if (workdays.has(dayName) && !empHolidayLookup(dateStr)) {
        dates.push(dateStr);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }, [fromDate, toDate, workdays, empHolidayLookup]);

  // Halve-dag-dagen in het bereik: automatisch herkende rooster-halve-dagen
  // + evt. de handmatig aangevinkte dag. Elke telt als 0,5 verlofdag.
  const halfDayDatesInRange = useMemo(
    () => workDayDates.filter((ds) => isRosterHalfDay(ds) || ds === halfDayDate),
    [workDayDates, isRosterHalfDay, halfDayDate],
  );
  const effectiveDays = dayBreakdown.workDays - 0.5 * halfDayDatesInRange.length;
  const combinedIsHalfDay = useCallback(
    (ds: string) => isRosterHalfDay(ds) || ds === halfDayDate,
    [isRosterHalfDay, halfDayDate],
  );

  // Step 1 → Step 2
  function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!employee || !leaveType || !fromDate || !toDate) return;
    setBlocks(splitIntoWorkBlocks(fromDate, toDate, workdays, empHolidayLookup, combinedIsHalfDay));
    setSkippedDays(getSkippedDays(fromDate, toDate, workdays, empHolidayLookup));
    setError("");
    setStep("confirm");
  }

  // Step 2 → Submit
  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const emp = employees.find(e => e.name === employee);
      for (const block of blocks) {
        await createDocument("Leave Application", {
          employee,
          leave_type: leaveType,
          from_date: block.from,
          to_date: block.to,
          ...(block.halfDayDate ? { half_day: 1, half_day_date: block.halfDayDate } : {}),
          company: emp?.company || company || undefined,
          description: description || undefined,
          status: "Open",
        });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknown_error"));
    } finally {
      setSubmitting(false);
    }
  }

  const totalBlockDays = blocks.reduce((s, b) => s + b.days, 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{t("vakantieplanning.new_request", "Nieuwe verlofaanvraag")}</h3>
            <p className="text-sm text-slate-500">
              {step === "form"
                ? t("vakantieplanning.new_request_desc", "Dien een verlofaanvraag in via ERPNext")
                : t("vakantieplanning.confirm_desc", "Controleer de aanvraag voordat je indient")}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* ─── Step 1: Form ─── */}
        {step === "form" && (
          <form onSubmit={handleCheck} className="p-5 space-y-4">
            {/* Employee */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("common.employee_required")}</label>
              <select value={employee} onChange={e => setEmployee(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
                <option value="">{t("common.select")}</option>
                {employees.map(emp => (
                  <option key={emp.name} value={emp.name}>{emp.employee_name}</option>
                ))}
              </select>
            </div>

            {/* Leave Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("vakantieplanning.leave_type", "Verloftype")} *</label>
              <select value={leaveType} onChange={e => setLeaveType(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
                {availableLeaveTypes.map(lt => (
                  <option key={lt} value={lt}>{lt}</option>
                ))}
              </select>
            </div>

            {/* Date range picker */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-slate-700">
                  {t("vakantieplanning.from_date", "Van datum")} – {t("vakantieplanning.to_date", "Tot/met datum")} *
                </label>
                <button type="button" onClick={() => setCalMonth(new Date())}
                  className="text-[11px] font-medium text-y-teal hover:text-y-teal-dark cursor-pointer">
                  {t("vakantieplanning.go_to_today", "Vandaag")}
                </button>
              </div>
              <div className="border border-slate-200 rounded-lg p-1 bg-white flex justify-center">
                <DayPicker
                  locale={nl}
                  mode="range"
                  timeZone="Europe/Amsterdam"
                  month={calMonth}
                  onMonthChange={setCalMonth}
                  today={new Date()}
                  selected={fromDate && toDate ? { from: new Date(fromDate + "T12:00:00"), to: new Date(toDate + "T12:00:00") } : undefined}
                  onSelect={(range) => {
                    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    if (range?.from) setFromDate(fmt(range.from));
                    else setFromDate("");
                    if (range?.to) setToDate(fmt(range.to));
                    else if (range?.from) setToDate(fmt(range.from));
                    else setToDate("");
                    setHalfDayDate("");
                  }}
                  modifiers={{
                    nonWorkday: (date) => {
                      const dayName = DAY_NAMES_EN[date.getDay()];
                      const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                      return !workdays.has(dayName) && !empHolidayLookup(ds);
                    },
                    holiday: (date) => {
                      const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                      return !!empHolidayLookup(ds);
                    },
                    existingLeave: (date) => {
                      const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                      return existingLeaves.some(l => ds >= l.from_date && ds <= l.to_date);
                    },
                  }}
                  modifiersClassNames={{
                    nonWorkday: "rdp-day--nonworkday",
                    holiday: "rdp-day--holiday",
                    existingLeave: "rdp-day--existing-leave",
                  }}
                  components={{
                    DayButton: (props) => {
                      const tooltip = getDayTooltip(props.day.date);
                      return <button {...props} title={tooltip} />;
                    },
                  }}
                  numberOfMonths={2}
                  weekStartsOn={1}
                  showOutsideDays
                />
              </div>
              {fromDate && toDate && (
                <p className="text-xs text-slate-500 mt-1">
                  {formatDateNL(fromDate)} – {formatDateNL(toDate)}
                </p>
              )}
            </div>

            {/* Half day option */}
            {fromDate && toDate && workDayDates.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={!!halfDayDate}
                    onChange={e => setHalfDayDate(e.target.checked ? (workDayDates[workDayDates.length - 1] || "") : "")}
                    className="w-4 h-4 rounded border-slate-300 text-y-teal focus:ring-y-teal cursor-pointer" />
                  <span className="text-sm text-slate-700">{t("vakantieplanning.include_half_day", "Inclusief halve dag")}</span>
                </label>
                {halfDayDate && workDayDates.length > 1 && (
                  <select value={halfDayDate} onChange={e => setHalfDayDate(e.target.value)}
                    className="px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
                    {workDayDates.map(d => (
                      <option key={d} value={d}>{formatDateNL(d)}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Rooster-halve-dagen worden automatisch als halve dag geteld */}
            {fromDate && toDate && workDayDates.some(isRosterHalfDay) && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Clock size={12} />
                {t("vakantieplanning.roster_half_day_auto", "Rooster: {{days}} telt automatisch als halve dag", { days: workDayDates.filter(isRosterHalfDay).map(formatDateNL).join(", ") })}
              </p>
            )}

            {/* Day calculation preview */}
            {fromDate && toDate && dayBreakdown.totalDays > 0 && (
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{t("vakantieplanning.calendar_days", "Kalenderdagen")}</span>
                  <span className="font-medium text-slate-800">{dayBreakdown.totalDays}</span>
                </div>
                {dayBreakdown.nonWorkDays > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{t("vakantieplanning.non_work_days", "Vrije dagen (niet in rooster)")}</span>
                    <span className="text-slate-500">-{dayBreakdown.nonWorkDays}</span>
                  </div>
                )}
                {dayBreakdown.holidays > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{t("vakantieplanning.public_holidays", "Feestdagen")}</span>
                    <span className="text-slate-500">-{dayBreakdown.holidays}</span>
                  </div>
                )}
                {halfDayDatesInRange.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      {halfDayDatesInRange.length === 1
                        ? t("vakantieplanning.half_day_on", "Halve dag op {{date}}", { date: formatDateNL(halfDayDatesInRange[0]) })
                        : t("vakantieplanning.half_days_count", "{{count}} halve dagen", { count: halfDayDatesInRange.length })}
                    </span>
                    <span className="text-slate-500">-{(0.5 * halfDayDatesInRange.length).toLocaleString("nl-NL")}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-1.5 border-t border-slate-200">
                  <span className="font-semibold text-slate-800">{t("vakantieplanning.leave_days_used", "Verlof dagen")}</span>
                  <span className="font-bold text-y-teal text-base">{effectiveDays}</span>
                </div>
                {loadingShift ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    {t("vakantieplanning.loading_shift", "Rooster laden...")}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    {t("vakantieplanning.shift_info", "Werkdagen o.b.v. rooster:")} {workdayNames}
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("vakantieplanning.reason", "Reden / opmerking")}</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder={t("vakantieplanning.reason_placeholder", "Optioneel: reden voor verlofaanvraag")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal resize-none" />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                {t("common.cancel")}
              </button>
              <button type="submit"
                disabled={!employee || !leaveType || !fromDate || !toDate || effectiveDays <= 0 || loadingShift}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-y-teal rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
                {t("vakantieplanning.check_request", "Controleren")}
              </button>
            </div>
          </form>
        )}

        {/* ─── Step 2: Confirmation ─── */}
        {step === "confirm" && (
          <div className="p-5 space-y-4">
            {/* Summary header */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">{t("common.employee")}</span>
                <p className="font-medium text-slate-800">{selectedEmp?.employee_name}</p>
              </div>
              <div>
                <span className="text-slate-500">{t("vakantieplanning.leave_type", "Verloftype")}</span>
                <p className="font-medium text-slate-800">{leaveType}</p>
              </div>
              <div>
                <span className="text-slate-500">{t("vakantieplanning.from_date", "Van")}</span>
                <p className="font-medium text-slate-800">{formatDateNL(fromDate)}</p>
              </div>
              <div>
                <span className="text-slate-500">{t("vakantieplanning.to_date", "Tot/met")}</span>
                <p className="font-medium text-slate-800">{formatDateNL(toDate)}</p>
              </div>
            </div>

            {/* Blocks table */}
            <div className="bg-slate-50 rounded-lg overflow-hidden">
              {blocks.length === 1 ? (
                <div className="p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">
                      {formatDateNL(blocks[0].from)}
                      {blocks[0].from !== blocks[0].to && ` – ${formatDateNL(blocks[0].to)}`}
                    </span>
                    <span className="font-bold text-y-teal">{t("common.days_count", { count: blocks[0].days })}</span>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {blocks.map((block, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-slate-700">
                        {formatDateNL(block.from)}
                        {block.from !== block.to && ` – ${formatDateNL(block.to)}`}
                      </span>
                      <span className="font-medium text-slate-600">{t("common.days_count", { count: block.days })}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2.5 bg-slate-100 text-sm">
                    <span className="font-semibold text-slate-800">
                      {t("vakantieplanning.total", "Totaal")}
                      {blocks.length > 1 && (
                        <span className="font-normal text-slate-500 ml-1.5">
                          ({blocks.length} {t("vakantieplanning.requests_count", "aanvragen")})
                        </span>
                      )}
                    </span>
                    <span className="font-bold text-y-teal text-base">{t("common.days_count", { count: totalBlockDays })}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Half day info (rooster-halve-dagen + evt. handmatige) */}
            {blocks.some(b => b.halfDayDate) && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <Clock size={14} />
                {(() => {
                  const hd = blocks.filter(b => b.halfDayDate).map(b => formatDateNL(b.halfDayDate!));
                  return hd.length === 1
                    ? t("vakantieplanning.half_day_on", "Halve dag op {{date}}", { date: hd[0] })
                    : `${t("vakantieplanning.half_days_count", "{{count}} halve dagen", { count: hd.length })}: ${hd.join(", ")}`;
                })()}
              </div>
            )}

            {/* Skipped days */}
            {skippedDays.length > 0 && (
              <div className="text-xs text-slate-400 space-y-0.5">
                <p className="font-medium text-slate-500 mb-1">{t("vakantieplanning.skipped_days", "Overgeslagen dagen:")}</p>
                {skippedDays.map((sd, i) => (
                  <p key={i}>
                    {formatDateNL(sd.date)}: {sd.reason === "schedule"
                      ? t("vakantieplanning.not_in_schedule", "geen werkdag (rooster)")
                      : sd.reason}
                  </p>
                ))}
              </div>
            )}

            {description && (
              <div className="text-sm">
                <span className="text-slate-500">{t("vakantieplanning.reason", "Reden")}</span>
                <p className="text-slate-700">{description}</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setStep("form"); setError(""); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                {t("vakantieplanning.back", "Terug")}
              </button>
              <button type="button" onClick={handleSubmit}
                disabled={submitting || blocks.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-y-teal rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {submitting
                  ? t("common.loading")
                  : blocks.length > 1
                    ? t("vakantieplanning.submit_requests", "{{count}} aanvragen indienen", { count: blocks.length })
                    : t("vakantieplanning.submit_request", "Aanvraag indienen")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────── Calendar View ──────────── */

interface MergedLeave {
  from_date: string;
  to_date: string;
  status: string;
  leave_type: string;
  employee_name: string;
  names: string[];
}

function mergeLeaves(apps: LeaveApplication[]): MergedLeave[] {
  if (apps.length === 0) return [];

  const groups = new Map<string, LeaveApplication[]>();
  for (const app of apps) {
    const key = `${app.status}|||${app.leave_type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(app);
  }

  const merged: MergedLeave[] = [];

  for (const [, group] of groups) {
    const sorted = [...group].sort((a, b) => a.from_date.localeCompare(b.from_date));

    let current: MergedLeave = {
      from_date: sorted[0].from_date,
      to_date: sorted[0].to_date,
      status: sorted[0].status,
      leave_type: sorted[0].leave_type,
      employee_name: sorted[0].employee_name,
      names: [sorted[0].name],
    };

    for (let i = 1; i < sorted.length; i++) {
      const app = sorted[i];
      const currentEnd = new Date(current.to_date);
      const nextStart = new Date(app.from_date);
      const gapDays = (nextStart.getTime() - currentEnd.getTime()) / 86400000;

      if (gapDays <= 5) {
        if (app.to_date > current.to_date) current.to_date = app.to_date;
        current.names.push(app.name);
      } else {
        merged.push(current);
        current = {
          from_date: app.from_date,
          to_date: app.to_date,
          status: app.status,
          leave_type: app.leave_type,
          employee_name: app.employee_name,
          names: [app.name],
        };
      }
    }
    merged.push(current);
  }

  merged.sort((a, b) => a.from_date.localeCompare(b.from_date));
  return merged;
}

type ZoomLevel = 1 | 2 | 3 | 4;

function CalendarView({
  employeeLeaves,
  allEmployeeNames,
  year,
  totalDays,
  monthPositions,
}: {
  employeeLeaves: [string, LeaveApplication[]][];
  allEmployeeNames: string[];
  year: number;
  totalDays: number;
  monthPositions: { left: number; width: number }[];
}) {
  const [tooltip, setTooltip] = useState<{
    leave: MergedLeave;
    x: number;
    y: number;
  } | null>(null);

  const [holidayTooltip, setHolidayTooltip] = useState<{
    name: string;
    x: number;
    y: number;
  } | null>(null);

  const { t } = useTranslation();
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(1);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to today's date when zoom changes
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const now = new Date();
    if (now.getFullYear() !== year) return;
    const todayDOY = dayOfYear(toLocalDateStr(now), year);
    const fraction = todayDOY / totalDays;
    requestAnimationFrame(() => {
      const scrollTarget = el.scrollWidth * fraction - el.clientWidth / 2;
      el.scrollLeft = Math.max(0, scrollTarget);
    });
  }, [zoomLevel, year, totalDays]);

  // Calculate holiday positions for the current year
  const holidayPositions = useMemo(() => {
    const holidays = HOLIDAYS[year] || [];
    return holidays.map((h) => {
      const day = dayOfYear(h.date, year);
      const left = (day / totalDays) * 100;
      const width = (1 / totalDays) * 100;
      return { ...h, left, width };
    });
  }, [year, totalDays]);

  // Build employee list: all active employees, with their leaves (or empty array)
  const allEmployeeRows = useMemo(() => {
    const leaveMap = new Map<string, LeaveApplication[]>();
    for (const [name, apps] of employeeLeaves) {
      leaveMap.set(name, apps);
    }
    const names = [...new Set([...allEmployeeNames, ...leaveMap.keys()])].sort((a, b) => a.localeCompare(b));
    return names.map(name => [name, leaveMap.get(name) || []] as [string, LeaveApplication[]]);
  }, [employeeLeaves, allEmployeeNames]);

  // Build columns based on zoom level
  const columns = useMemo(() => {
    if (zoomLevel === 1) {
      // Year: 12 month columns
      return monthPositions.map((pos, i) => ({
        label: t(MONTH_KEYS[i]),
        left: pos.left,
        width: pos.width,
        isWeekend: false,
      }));
    }
    if (zoomLevel === 2) {
      // Quarter: week columns with week numbers
      const cols: { label: string; left: number; width: number; isWeekend: boolean }[] = [];
      const d = new Date(year, 0, 1);
      while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
      while (d.getFullYear() <= year) {
        const weekStart = new Date(d);
        const weekEnd = new Date(d);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const wk = getISOWeek(weekStart);
        const startDOY = Math.max(0, dayOfYear(toLocalDateStr(weekStart), year));
        const endDOY = Math.min(totalDays - 1, dayOfYear(toLocalDateStr(weekEnd), year));
        const left = (startDOY / totalDays) * 100;
        const width = ((endDOY - startDOY + 1) / totalDays) * 100;
        cols.push({ label: `W${wk}`, left, width, isWeekend: false });
        d.setDate(d.getDate() + 7);
        if (weekEnd.getFullYear() > year) break;
      }
      return cols;
    }
    if (zoomLevel === 3) {
      // Month: day numbers
      const cols: { label: string; left: number; width: number; isWeekend: boolean }[] = [];
      let doy = 0;
      for (let m = 0; m < 12; m++) {
        const dim = daysInMonth(year, m);
        for (let d = 1; d <= dim; d++) {
          const dt = new Date(year, m, d);
          const dayW = dt.getDay();
          const isWeekend = dayW === 0 || dayW === 6;
          cols.push({
            label: String(d),
            left: (doy / totalDays) * 100,
            width: (1 / totalDays) * 100,
            isWeekend,
          });
          doy++;
        }
      }
      return cols;
    }
    // zoomLevel === 4: Week view with day names + week number on Monday
    const cols: { label: string; left: number; width: number; isWeekend: boolean }[] = [];
    let doy = 0;
    for (let m = 0; m < 12; m++) {
      const dim = daysInMonth(year, m);
      for (let d = 1; d <= dim; d++) {
        const dt = new Date(year, m, d);
        const dayW = dt.getDay();
        const isWeekend = dayW === 0 || dayW === 6;
        const dayIdx = (dayW + 6) % 7; // Mon=0
        const dayName = dayIdx < 5 ? t(DAY_KEYS[dayIdx]) : (dayW === 6 ? t("vakantieplanning.day_za") : t("vakantieplanning.day_zo"));
        const wk = dayIdx === 0 ? `W${getISOWeek(dt)} ` : "";
        cols.push({
          label: `${wk}${dayName} ${d}/${m + 1}`,
          left: (doy / totalDays) * 100,
          width: (1 / totalDays) * 100,
          isWeekend,
        });
        doy++;
      }
    }
    return cols;
  }, [zoomLevel, year, totalDays, monthPositions]);

  // Zoom width multipliers: 1x, 4x, 12x, 52x
  const zoomMultiplier = [1, 4, 12, 52][zoomLevel - 1];
  const minWidth = 900 * zoomMultiplier;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Legend */}
      <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-y-teal inline-block" /> {t("vakantieplanning.approved")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-400 inline-block" /> {t("vakantieplanning.open")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-400 inline-block" /> {t("vakantieplanning.sick_leave")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-3 border-l-2 border-dashed border-red-400 inline-block" /> {t("vakantieplanning.holiday")}
        </span>
      </div>

      {/* Zoom controls */}
      <div className="px-4 py-1.5 border-b border-slate-100 flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <ZoomIn size={14} />
          {t("vakantieplanning.zoom")}
        </span>
        {([
          [1, "vakantieplanning.zoom_year"],
          [2, "vakantieplanning.zoom_quarter"],
          [3, "vakantieplanning.zoom_month"],
          [4, "vakantieplanning.zoom_week"],
        ] as [ZoomLevel, string][]).map(([level, labelKey]) => (
          <button
            key={level}
            onClick={() => setZoomLevel(level)}
            className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
              zoomLevel === level
                ? "bg-y-teal text-white"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Sticky employee column + scrollable calendar */}
      <div className="flex">
        {/* Fixed employee column */}
        <div className="flex-shrink-0 w-48 border-r border-slate-200">
          {/* Header */}
          <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 h-8 flex items-center border-b border-slate-200">
            {t("planning.employee")}
          </div>
          {/* Employee rows */}
          {allEmployeeRows.map(([name]) => (
            <div key={name} className="px-4 py-2 text-sm font-medium text-slate-700 truncate h-10 flex items-center border-b border-slate-100">
              {name}
            </div>
          ))}
        </div>

        {/* Scrollable calendar area */}
        <div className="flex-1 overflow-x-auto" ref={scrollContainerRef}>
          <div style={{ minWidth: `${minWidth}px` }}>
            {/* Column headers */}
            <div className="relative h-8 border-b border-slate-200">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className={`absolute top-0 h-full flex items-center justify-center text-xs font-medium text-slate-500 border-l border-slate-100 ${
                    col.isWeekend ? "bg-slate-100/50" : ""
                  }`}
                  style={{ left: `${col.left}%`, width: `${col.width}%` }}
                >
                  {(zoomLevel <= 2 || col.width * minWidth / 100 > 16) ? col.label : ""}
                </div>
              ))}
              {/* Holiday markers in header: red shading in day views, dots in year/quarter */}
              {zoomLevel >= 3 ? holidayPositions.map((h) => (
                <div
                  key={h.date}
                  className="absolute top-0 h-full bg-red-100/60"
                  style={{ left: `${h.left}%`, width: `${h.width}%` }}
                  title={h.name}
                />
              )) : holidayPositions.map((h) => (
                <div
                  key={h.date}
                  className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-red-400"
                  style={{ left: `${h.left}%`, transform: "translateX(-50%)" }}
                  title={h.name}
                />
              ))}
            </div>

            {/* Employee rows */}
            {allEmployeeRows.map(([name, apps]) => (
              <div key={name} className="relative h-10 border-b border-slate-100 hover:bg-slate-50/50">
                {/* Weekend shading columns */}
                {(zoomLevel >= 3) && columns.filter(c => c.isWeekend).map((col, i) => (
                  <div
                    key={`we-${i}`}
                    className="absolute top-0 h-full bg-slate-100/50"
                    style={{ left: `${col.left}%`, width: `${col.width}%` }}
                  />
                ))}
                {/* Grid lines */}
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l border-slate-100"
                    style={{ left: `${col.left}%` }}
                  />
                ))}
                {/* Holiday markers: full red shading in day views, dashed line in year/quarter */}
                {holidayPositions.map((h) => (
                  zoomLevel >= 3 ? (
                    <div
                      key={h.date}
                      className="absolute top-0 h-full bg-red-100/60 z-[1] cursor-help"
                      style={{ left: `${h.left}%`, width: `${h.width}%` }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHolidayTooltip({
                          name: h.name,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        });
                      }}
                      onMouseLeave={() => setHolidayTooltip(null)}
                    />
                  ) : (
                    <div
                      key={h.date}
                      className="absolute top-0 h-full border-l-[1.5px] border-dashed border-red-300 z-[1] cursor-help"
                      style={{ left: `${h.left}%` }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHolidayTooltip({
                          name: h.name,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        });
                      }}
                      onMouseLeave={() => setHolidayTooltip(null)}
                    />
                  )
                ))}
                {/* Leave bars */}
                {mergeLeaves(apps).map((leave, idx) => {
                  const fromDay = Math.max(0, dayOfYear(leave.from_date, year));
                  const toDay = Math.min(totalDays - 1, dayOfYear(leave.to_date, year));
                  // Use same division for left and right edge to avoid floating point mismatch with columns
                  const left = fromDay / totalDays * 100;
                  const right = (toDay + 1) / totalDays * 100;
                  const width = Math.max(0.08, right - left);

                  return (
                    <div
                      key={leave.names.join("-") || idx}
                      className={`absolute top-1.5 h-7 rounded-sm ${getBarColor(leave.status, leave.leave_type)} opacity-80 hover:opacity-100 cursor-pointer transition-opacity z-[2]`}
                      style={{ left: `${left}%`, width: `${width}%`, minWidth: "3px" }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ leave, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leave tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold">{tooltip.leave.employee_name}</p>
          <p>{tooltip.leave.leave_type}</p>
          <p>
            {tooltip.leave.from_date} — {tooltip.leave.to_date}
          </p>
          <p>{tooltip.leave.status}{tooltip.leave.names.length > 1 ? ` (${tooltip.leave.names.length} aanvragen)` : ""}</p>
        </div>
      )}

      {/* Holiday tooltip */}
      {holidayTooltip && (
        <div
          className="fixed z-50 bg-red-700 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg pointer-events-none"
          style={{
            left: holidayTooltip.x,
            top: holidayTooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold">{holidayTooltip.name}</p>
        </div>
      )}
    </div>
  );
}

/* ──────────── Overuren View ──────────── */
/* Transposed layout: weeks = rows, employees = columns (original transposed design) */

function OverurenView({ employees, hourRows, leaves, year, company: _company, contractHoursMap, missingShiftEmployees, workdaysMap, holidaySets, dayHoursMap }: {
  employees: { name: string; employee_name: string; company: string; date_of_joining?: string }[];
  hourRows: TimesheetHourRow[];
  leaves: LeaveApplication[];
  year: number;
  company: string;
  contractHoursMap: Record<string, number>;
  missingShiftEmployees: Set<string>;
  workdaysMap: Map<string, Set<string>>;
  holidaySets: Map<string, Set<string>>;
  dayHoursMap: Record<string, Record<string, number>>;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const currentWeekNum = now.getFullYear() === year ? getISOWeek(now) : 53;
  const lastCompletedWeek = Math.max(0, currentWeekNum - 1);
  const isZiekteType = (lt: string) => lt.toLowerCase().includes("ziekte");

  // Sla weken volledig vóór indiensttreding over (anders vals tekort in het saldo).
  const weekBeforeJoin = (joinDate: Date | null, w: number): boolean => {
    if (!joinDate) return false;
    const weekEnd = isoWeekMonday(year, w);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return weekEnd < joinDate;
  };

  type Bucket = { gewerkt: number; verlof: number; ziekte: number; feestdag: number; expected: number };
  const EMPTY_BUCKET: Bucket = { gewerkt: 0, verlof: 0, ziekte: 0, feestdag: 0, expected: 0 };

  // Build per-employee per-week data. Feestdag-uren én verwachte uren komen uit
  // het échte rooster + de werkgever-Holiday-List per medewerker (helper); leave
  // telt met de werkelijke dag-uren, alleen op werkdagen die geen feestdag zijn.
  const empData = useMemo(() => {
    const result = new Map<string, Map<number, Bucket>>();
    const empIds = new Set(employees.map(e => e.name));

    const ensure = (empName: string, week: number): Bucket | null => {
      if (!empIds.has(empName)) return null;
      let m = result.get(empName);
      if (!m) { m = new Map(); result.set(empName, m); }
      let b = m.get(week);
      if (!b) { b = { gewerkt: 0, verlof: 0, ziekte: 0, feestdag: 0, expected: 0 }; m.set(week, b); }
      return b;
    };

    // Pre-fill expected + feestdag per week voor medewerkers mét contract-uren.
    for (const emp of employees) {
      const weeklyHours = contractHoursMap[emp.name];
      if (!weeklyHours) continue;
      const workdays = workdaysMap.get(emp.name) ?? DEFAULT_WORKDAYS;
      const holidaySet = holidaySets.get(emp.name) ?? new Set<string>();
      const dayHours = dayHoursMap[emp.name];
      const m = new Map<number, Bucket>();
      for (let w = 1; w <= 53; w++) {
        const { expected, feestdagHours } = expectedWeekHours({ year, week: w, weeklyHours, workdays, holidaySet, dayHours });
        m.set(w, { gewerkt: 0, verlof: 0, ziekte: 0, feestdag: feestdagHours, expected });
      }
      result.set(emp.name, m);
    }

    // Per geboekte REGEL in de week van zijn eigen `from_time` — een jaarstaat
    // zou anders integraal in week 1/2 landen (lib/timesheet-hours.ts).
    for (const [employee, weeks] of bucketHoursByEmployeeWeek(hourRows)) {
      for (const [week, gewerkt] of weeks) {
        const b = ensure(employee, week);
        if (b) b.gewerkt += gewerkt;
      }
    }

    for (const la of leaves) {
      if (la.status !== "Approved") continue;
      const empName = employees.find(e => e.employee_name === la.employee_name)?.name;
      if (!empName) continue;
      const workdays = workdaysMap.get(empName) ?? DEFAULT_WORKDAYS;
      const holidaySet = holidaySets.get(empName) ?? new Set<string>();
      const dayHours = dayHoursMap[empName];
      const from = new Date(la.from_date);
      const to = new Date(la.to_date);
      const d = new Date(from);
      while (d <= to) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (d.getFullYear() === year && isCountableWorkday(dateStr, workdays, holidaySet)) {
          const week = getISOWeek(d);
          const b = ensure(empName, week);
          if (b) {
            const dh = hoursForDay(DAY_NAMES_EN[d.getDay()], contractHoursMap[empName] ?? 0, workdays, dayHours);
            const hrs = dh * (la.half_day && la.half_day_date === dateStr ? 0.5 : 1);
            if (isZiekteType(la.leave_type)) b.ziekte += hrs;
            else b.verlof += hrs;
          }
        }
        d.setDate(d.getDate() + 1);
      }
    }

    return result;
  }, [employees, hourRows, leaves, year, contractHoursMap, workdaysMap, holidaySets, dayHoursMap]);

  // Get all weeks 1..lastCompletedWeek+2 (show a few ahead)
  const allWeeks = useMemo(() => {
    const maxWeek = Math.min(53, lastCompletedWeek + 4);
    const weeks: number[] = [];
    for (let w = 1; w <= maxWeek; w++) weeks.push(w);
    return weeks;
  }, [lastCompletedWeek]);

  function fmt(n: number): string {
    return n % 1 !== 0 ? n.toFixed(1) : n.toFixed(0);
  }

  /** Signed saldo: "+X" / "−X" met nl-komma. */
  function fmtSigned(n: number): string {
    const r = Math.round(n * 10) / 10;
    return (r > 0 ? "+" : r < 0 ? "−" : "") + fmt(Math.abs(r));
  }

  // Per-week netto totalen over alle medewerkers.
  const weekTotals = useMemo(() => {
    const wTotals = new Map<number, { gewerkt: number; verlof: number; ziekte: number; feestdag: number; saldo: number }>();

    for (const emp of employees) {
      const isMissing = missingShiftEmployees.has(emp.name) || contractHoursMap[emp.name] === undefined;
      const joinDate = emp.date_of_joining ? new Date(emp.date_of_joining + "T12:00:00") : null;
      const weeks = empData.get(emp.name);

      for (const w of allWeeks) {
        const wd = weeks?.get(w) || EMPTY_BUCKET;
        const weekTotal = wd.gewerkt + wd.verlof + wd.ziekte;

        if (!wTotals.has(w)) wTotals.set(w, { gewerkt: 0, verlof: 0, ziekte: 0, feestdag: 0, saldo: 0 });
        const wt = wTotals.get(w)!;
        wt.gewerkt += wd.gewerkt;
        wt.verlof += wd.verlof;
        wt.ziekte += wd.ziekte;
        wt.feestdag += wd.feestdag;

        // Netto saldo: tekort-weken tellen mee (geen Math.max meer).
        if (!isMissing && weekTotal > 0 && w <= lastCompletedWeek && !weekBeforeJoin(joinDate, w)) {
          wt.saldo += weekTotal - wd.expected;
        }
      }
    }

    return wTotals;
  }, [employees, empData, contractHoursMap, allWeeks, lastCompletedWeek, missingShiftEmployees, year]);

  // Footer totals per employee (netto saldo).
  const footerTotals = useMemo(() => {
    const totals = new Map<string, { gewerkt: number; verlof: number; ziekte: number; feestdag: number; saldo: number }>();
    for (const emp of employees) {
      const isMissing = missingShiftEmployees.has(emp.name) || contractHoursMap[emp.name] === undefined;
      const joinDate = emp.date_of_joining ? new Date(emp.date_of_joining + "T12:00:00") : null;
      const weeks = empData.get(emp.name);
      let totalGewerkt = 0;
      let totalVerlof = 0;
      let totalZiekte = 0;
      let totalFeestdag = 0;
      let saldo = 0;

      if (weeks) {
        for (const [w, wd] of weeks) {
          totalGewerkt += wd.gewerkt;
          totalVerlof += wd.verlof;
          totalZiekte += wd.ziekte;
          totalFeestdag += wd.feestdag;
          if (!isMissing && w <= lastCompletedWeek && !weekBeforeJoin(joinDate, w)) {
            const weekTotal = wd.gewerkt + wd.verlof + wd.ziekte;
            if (weekTotal > 0) saldo += weekTotal - wd.expected;
          }
        }
      }

      totals.set(emp.name, { gewerkt: totalGewerkt, verlof: totalVerlof, ziekte: totalZiekte, feestdag: totalFeestdag, saldo: isMissing ? NaN : saldo });
    }
    return totals;
  }, [employees, empData, contractHoursMap, lastCompletedWeek, missingShiftEmployees, year]);

  // ── Per-dag uitklappen van een week (on-demand timesheet-detail) ──
  interface DayCell {
    iso: string;
    gewerkt: number;
    verlof: number;
    ziekte: number;
    feestdag: number;
    expected: number;
    isWorkday: boolean;
  }
  const DAY_LABELS_NL = ["ma", "di", "wo", "do", "vr"];
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [weekDetail, setWeekDetail] = useState<{ week: number; days: { iso: string; label: string }[]; data: Map<string, DayCell[]> } | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);

  const isoOf = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

  async function toggleWeek(w: number) {
    if (expandedWeek === w) { setExpandedWeek(null); setWeekDetail(null); return; }
    setExpandedWeek(w);
    setWeekDetail(null);
    setLoadingWeek(true);
    try {
      const monday = isoWeekMonday(year, w);
      const days: { iso: string; label: string; dayName: string }[] = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(monday); d.setDate(monday.getDate() + i);
        days.push({
          iso: isoOf(d),
          label: `${DAY_LABELS_NL[i]} ${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          dayName: DAY_NAMES_EN[d.getDay()],
        });
      }
      // Gewerkte uren per medewerker per dag, rechtstreeks uit de al geladen
      // regels van dit jaar. Voorheen werd hier per weekstaat een volledig
      // Timesheet-document opgehaald — dat selecteerde bovendien op
      // `getISOWeek(start_date)`, waardoor een jaarstaat alleen in week 1/2
      // meegenomen zou worden en de rest van het jaar leeg bleef. Nu nul
      // extra requests bij het uitklappen van een week.
      const weekDays = new Set(days.map((d) => d.iso));
      const workedByEmpDay = bucketHoursByEmployeeDay(
        hourRows.filter((row) => weekDays.has(row.date))
      );
      // Per medewerker per dag: gewerkt (uit time_logs) + afgeleide verlof/ziekte/feestdag/verwacht.
      const data = new Map<string, DayCell[]>();
      for (const emp of employees) {
        const workdays = workdaysMap.get(emp.name) ?? DEFAULT_WORKDAYS;
        const holidaySet = holidaySets.get(emp.name) ?? new Set<string>();
        const dayHours = dayHoursMap[emp.name];
        const worked = workedByEmpDay.get(emp.name);
        const cells: DayCell[] = days.map((day) => {
          const dObj = new Date(day.iso + "T12:00:00");
          const isWorkday = workdays.has(DAY_NAMES_EN[dObj.getDay()]);
          const countable = isCountableWorkday(day.iso, workdays, holidaySet);
          const dh = hoursForDay(DAY_NAMES_EN[dObj.getDay()], contractHoursMap[emp.name] ?? 0, workdays, dayHours);
          let verlof = 0, ziekte = 0;
          for (const la of leaves) {
            if (la.status !== "Approved" || la.employee_name !== emp.employee_name) continue;
            if (countable && day.iso >= la.from_date && day.iso <= la.to_date) {
              const hrs = dh * (la.half_day && la.half_day_date === day.iso ? 0.5 : 1);
              if (isZiekteType(la.leave_type)) ziekte += hrs; else verlof += hrs;
            }
          }
          return {
            iso: day.iso,
            gewerkt: worked?.get(day.iso) ?? 0,
            verlof,
            ziekte,
            feestdag: isWorkday && !countable ? dh : 0,
            expected: countable ? dh : 0,
            isWorkday,
          };
        });
        data.set(emp.name, cells);
      }
      setWeekDetail({ week: w, days: days.map((d) => ({ iso: d.iso, label: d.label })), data });
    } finally {
      setLoadingWeek(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Legend */}
      <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-y-teal rounded-full inline-block" /> {t("vakantieplanning.worked")}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-400 rounded-full inline-block" /> {t("vakantieplanning.leave")}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-orange-400 rounded-full inline-block" /> {t("vakantieplanning.sickness")}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-400 rounded-full inline-block" /> {t("vakantieplanning.holiday", { defaultValue: "Feestdag" })}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-400 rounded-full inline-block" /> {t("vakantieplanning.overtime")}</span>
        <span className="flex items-center gap-1 text-slate-400">
          <span className="text-red-600 font-semibold">+</span>/<span className="text-blue-600 font-semibold">−</span>
          {t("vakantieplanning.net_balance", { defaultValue: "Netto saldo (over/tekort)" })}
        </span>
      </div>

      <div className="overflow-y-auto scrollbar-visible" style={{ maxHeight: "700px" }} ref={scrollRef}>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 sticky left-0 bg-slate-50 w-16">{t("vakantieplanning.week")}</th>
              {employees.map(emp => {
                const isMissing = missingShiftEmployees.has(emp.name) || contractHoursMap[emp.name] === undefined;
                const weeklyHours = contractHoursMap[emp.name];
                return (
                  <th key={emp.name} className={`text-center px-2 py-1 font-semibold ${isMissing ? "text-amber-600 bg-amber-50" : "text-slate-600"}`}>
                    <div>{emp.employee_name.split(" ")[0]}</div>
                    <div className="text-[10px] font-normal text-slate-400">
                      {isMissing
                        ? <span className="text-amber-500" title={t("warnings.shift_hours_defaulted")}>&#9888; —</span>
                        : t("vakantieplanning.hours_per_week", { hours: weeklyHours })}
                    </div>
                  </th>
                );
              })}
              <th className="text-right px-3 py-2 font-semibold text-slate-600 w-28">{t("vakantieplanning.total")}</th>
            </tr>
          </thead>
          <tbody>
            {allWeeks.map(w => {
              const hasAnyData = employees.some(emp => {
                const wd = empData.get(emp.name)?.get(w);
                return wd && (wd.gewerkt > 0 || wd.verlof > 0 || wd.ziekte > 0);
              });
              const isCurrent = w === currentWeekNum;
              const wt = weekTotals.get(w);
              const isExpanded = expandedWeek === w;

              return (
                <Fragment key={w}>
                <tr
                  className={`border-t border-slate-100 ${isCurrent ? "bg-amber-50" : "hover:bg-slate-50"}`}
                >
                  <td
                    onClick={() => toggleWeek(w)}
                    title={t("vakantieplanning.expand_days", { defaultValue: "Klik voor dagen" })}
                    className={`px-3 py-2 font-semibold sticky left-0 cursor-pointer select-none ${isCurrent ? "text-amber-700 bg-amber-50" : "text-slate-500 bg-white hover:text-y-teal"}`}
                  >
                    <span className="inline-block w-3 text-slate-400 mr-0.5">{isExpanded ? "▾" : "▸"}</span>W{w}
                  </td>
                  {employees.map(emp => {
                    const isMissing = missingShiftEmployees.has(emp.name) || contractHoursMap[emp.name] === undefined;
                    const weeks = empData.get(emp.name);
                    const wd = weeks?.get(w) || EMPTY_BUCKET;
                    const weeklyHours = contractHoursMap[emp.name] ?? 0;
                    const joinDate = emp.date_of_joining ? new Date(emp.date_of_joining + "T12:00:00") : null;
                    const weekTotal = wd.gewerkt + wd.verlof + wd.ziekte;
                    const countable = !isMissing && weekTotal > 0 && w <= lastCompletedWeek && !weekBeforeJoin(joinDate, w);
                    const delta = countable ? weekTotal - wd.expected : 0;
                    const overtime = Math.max(0, delta);

                    // Bar segments
                    const effectiveContract = isMissing ? weekTotal : weeklyHours;
                    const contractPart = Math.min(wd.gewerkt, effectiveContract || wd.gewerkt);
                    const barTotal = contractPart + wd.verlof + wd.ziekte + wd.feestdag;
                    const barMax = Math.max(effectiveContract, barTotal) || weekTotal;
                    const gewerktPct = barMax > 0 ? (contractPart / barMax) * 100 : 0;
                    const verlofPct = barMax > 0 ? (wd.verlof / barMax) * 100 : 0;
                    const ziektePct = barMax > 0 ? (wd.ziekte / barMax) * 100 : 0;
                    const feestdagPct = barMax > 0 ? (wd.feestdag / barMax) * 100 : 0;

                    return (
                      <td key={emp.name} className="px-1 py-1.5">
                        {weekTotal > 0 || wd.feestdag > 0 ? (
                          <div className="flex items-center gap-0.5">
                            <div className="h-3 bg-slate-100 rounded-full flex overflow-hidden flex-shrink-0" style={{ width: "65%" }}>
                              {gewerktPct > 0 && <div className="h-3 bg-y-teal" style={{ width: `${gewerktPct}%` }} />}
                              {verlofPct > 0 && <div className="h-3 bg-emerald-400" style={{ width: `${verlofPct}%` }} />}
                              {ziektePct > 0 && <div className="h-3 bg-orange-400" style={{ width: `${ziektePct}%` }} />}
                              {feestdagPct > 0 && <div className="h-3 bg-blue-400" style={{ width: `${feestdagPct}%` }} />}
                            </div>
                            {overtime > 0 && (
                              <div className="h-3 bg-red-400 rounded-r-full flex-shrink-0"
                                style={{ width: `${Math.min((overtime / weeklyHours) * 65, 25)}%` }} />
                            )}
                            <span className="text-[10px] flex-shrink-0 whitespace-nowrap ml-0.5">
                              {isMissing ? (
                                <span className="text-slate-500">{fmt(wd.gewerkt)}</span>
                              ) : (
                              <span className={overtime > 0 ? "text-red-600 font-semibold" : "text-slate-500"}>
                                {delta > 0 ? "+" : ""}{fmt(delta)}
                              </span>
                              )}
                              {wd.verlof > 0 && <span className="text-emerald-600 ml-0.5">{fmt(wd.verlof)}v</span>}
                              {wd.ziekte > 0 && <span className="text-orange-600 ml-0.5">{fmt(wd.ziekte)}z</span>}
                              {wd.feestdag > 0 && <span className="text-blue-500 ml-0.5">{fmt(wd.feestdag)}f</span>}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">{"\u2014"}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right px-3 py-1.5 whitespace-nowrap">
                    {hasAnyData && wt ? (
                      <div className="flex items-center justify-end gap-1 text-[10px]">
                        <span className="text-y-teal font-medium">{fmt(wt.gewerkt)}</span>
                        {wt.verlof > 0 && <span className="text-emerald-600">{fmt(wt.verlof)}v</span>}
                        {wt.ziekte > 0 && <span className="text-orange-600">{fmt(wt.ziekte)}z</span>}
                        {wt.feestdag > 0 && <span className="text-blue-500">{fmt(wt.feestdag)}f</span>}
                        {Math.abs(wt.saldo) >= 0.05 && <span className={wt.saldo > 0 ? "text-red-600 font-semibold" : "text-blue-600 font-semibold"}>{fmtSigned(wt.saldo)}</span>}
                      </div>
                    ) : (
                      <span className="text-slate-300">{"\u2014"}</span>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  loadingWeek ? (
                    <tr className="bg-slate-50/60">
                      <td colSpan={employees.length + 2} className="px-7 py-2 text-[11px] text-slate-400">{t("common.loading")}</td>
                    </tr>
                  ) : weekDetail?.week === w ? (
                    weekDetail.days.map((day, di) => (
                      <tr key={`${w}-${day.iso}`} className="bg-slate-50/60 border-t border-slate-100/70">
                        <td className="px-3 py-1 sticky left-0 bg-slate-50 text-[10px] text-slate-400 pl-7 whitespace-nowrap">{day.label}</td>
                        {employees.map(emp => {
                          const cell = weekDetail.data.get(emp.name)?.[di];
                          const hasData = !!cell && (cell.gewerkt > 0 || cell.verlof > 0 || cell.ziekte > 0 || cell.feestdag > 0);
                          // Geen cel, of een dag zonder enige uren (niet-roosterdag \u00f3f leeg gebleven
                          // roosterdag) \u2192 streepje. Let op: {"\u2014"} als expressie, anders rendert
                          // React de letterlijke tekst \u2014.
                          if (!cell || !hasData) {
                            return <td key={emp.name} className="px-1 py-0.5 text-center"><span className="text-slate-300 text-[10px]">{"\u2014"}</span></td>;
                          }
                          // Uren op een niet-roosterdag zijn overuren (bv. op een vrije dag komen
                          // werken) \u2192 rood tonen op d\u00ed\u00e9 dag, niet verbergen achter een streepje.
                          const isOvertimeDay = !cell.isWorkday;
                          const dayH = (cell.expected + cell.feestdag) || (contractHoursMap[emp.name] ?? 40) / ((workdaysMap.get(emp.name) ?? DEFAULT_WORKDAYS).size || 5);
                          const barMax = Math.max(dayH, cell.gewerkt + cell.verlof + cell.ziekte + cell.feestdag) || dayH;
                          const seg = (v: number) => (barMax > 0 ? (Math.min(v, barMax) / barMax) * 100 : 0);
                          return (
                            <td key={emp.name} className="px-1 py-0.5">
                              <div className="flex items-center gap-0.5">
                                <div className="h-1.5 bg-slate-200/70 rounded-full flex overflow-hidden flex-shrink-0" style={{ width: "42%" }}>
                                  {cell.gewerkt > 0 && <div className={`h-1.5 ${isOvertimeDay ? "bg-red-400" : "bg-y-teal"}`} style={{ width: `${seg(cell.gewerkt)}%` }} />}
                                  {cell.verlof > 0 && <div className="h-1.5 bg-emerald-400" style={{ width: `${seg(cell.verlof)}%` }} />}
                                  {cell.ziekte > 0 && <div className="h-1.5 bg-orange-400" style={{ width: `${seg(cell.ziekte)}%` }} />}
                                  {cell.feestdag > 0 && <div className="h-1.5 bg-blue-400" style={{ width: `${seg(cell.feestdag)}%` }} />}
                                </div>
                                <span className="text-[9px] flex-shrink-0 whitespace-nowrap ml-0.5 text-slate-500">
                                  {cell.gewerkt > 0 && <span className={isOvertimeDay ? "text-red-600 font-semibold" : undefined} title={isOvertimeDay ? t("vakantieplanning.overtime", { defaultValue: "Overuren" }) : undefined}>{fmt(cell.gewerkt)}</span>}
                                  {cell.verlof > 0 && <span className="text-emerald-600 ml-0.5">{fmt(cell.verlof)}v</span>}
                                  {cell.ziekte > 0 && <span className="text-orange-600 ml-0.5">{fmt(cell.ziekte)}z</span>}
                                  {cell.feestdag > 0 && <span className="text-blue-500 ml-0.5">{fmt(cell.feestdag)}f</span>}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                        <td />
                      </tr>
                    ))
                  ) : null
                )}
                </Fragment>
              );
            })}
          </tbody>
          {/* Footer totals */}
          <tfoot className="bg-slate-50 border-t-2 border-slate-300 sticky bottom-0">
            <tr>
              <td className="px-3 py-2 font-bold text-slate-600 sticky left-0 bg-slate-50">{t("vakantieplanning.total")}</td>
              {employees.map(emp => {
                const ft = footerTotals.get(emp.name);
                if (!ft) return <td key={emp.name} />;
                return (
                  <td key={emp.name} className="px-1 py-2 text-center">
                    <div className="text-[10px] leading-relaxed">
                      <span className="text-y-teal font-medium">{fmt(ft.gewerkt)}u</span>
                      {ft.verlof > 0 && <span className="text-emerald-600 ml-1">{fmt(ft.verlof)}v</span>}
                      {ft.ziekte > 0 && <span className="text-orange-600 ml-1">{fmt(ft.ziekte)}z</span>}
                      {ft.feestdag > 0 && <span className="text-blue-500 ml-1">{fmt(ft.feestdag)}f</span>}
                      {!isNaN(ft.saldo) && Math.abs(ft.saldo) >= 0.05 && (
                        <span
                          className={`ml-1 font-semibold ${ft.saldo > 0 ? "text-red-600" : "text-blue-600"}`}
                          title={t("vakantieplanning.net_balance", { defaultValue: "Netto saldo (over/tekort)" })}
                        >
                          {fmtSigned(ft.saldo)}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
              <td className="text-right px-3 py-2">
                {(() => {
                  let totalGewerkt = 0, totalVerlof = 0, totalZiekte = 0, totalFeestdag = 0, totalSaldo = 0;
                  for (const [, ft] of footerTotals) {
                    totalGewerkt += ft.gewerkt;
                    totalVerlof += ft.verlof;
                    totalZiekte += ft.ziekte;
                    totalFeestdag += ft.feestdag;
                    if (!isNaN(ft.saldo)) totalSaldo += ft.saldo;
                  }
                  return (
                    <div className="text-[10px] leading-relaxed">
                      <span className="text-y-teal font-bold">{fmt(totalGewerkt)}u</span>
                      {totalVerlof > 0 && <span className="text-emerald-600 ml-1">{fmt(totalVerlof)}v</span>}
                      {totalZiekte > 0 && <span className="text-orange-600 ml-1">{fmt(totalZiekte)}z</span>}
                      {totalFeestdag > 0 && <span className="text-blue-500 ml-1">{fmt(totalFeestdag)}f</span>}
                      {Math.abs(totalSaldo) >= 0.05 && <span className={`ml-1 font-bold ${totalSaldo > 0 ? "text-red-600" : "text-blue-600"}`}>{fmtSigned(totalSaldo)}</span>}
                    </div>
                  );
                })()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ──────────── Aanvragen View ──────────── */

type GroupByColumn = "employee_name" | "leave_type" | "status" | null;

function AanvragenView({ leaves }: { leaves: LeaveApplication[] }) {
  const { t } = useTranslation();
  const [groupBy, setGroupBy] = useState<GroupByColumn>(null);

  const toggleGroup = (col: GroupByColumn) => {
    setGroupBy(prev => prev === col ? null : col);
  };

  const groupedData = useMemo(() => {
    if (!groupBy) return null;

    const map = new Map<string, LeaveApplication[]>();
    for (const l of leaves) {
      const key = l[groupBy];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [leaves, groupBy]);

  if (leaves.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        {t("vakantieplanning.no_leave_requests")}
      </div>
    );
  }

  const SortableHeader = ({ col, label }: { col: GroupByColumn; label: string }) => (
    <th
      className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 select-none"
      onClick={() => toggleGroup(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown size={12} className={groupBy === col ? "text-y-teal" : "text-slate-300"} />
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-600">
            <SortableHeader col="employee_name" label={t("planning.employee")} />
            <SortableHeader col="leave_type" label={t("vakantieplanning.type")} />
            <th className="px-4 py-3 font-semibold">{t("vakantieplanning.from")}</th>
            <th className="px-4 py-3 font-semibold">{t("vakantieplanning.to")}</th>
            <th className="px-4 py-3 font-semibold text-right">{t("vakantieplanning.days")}</th>
            <SortableHeader col="status" label={t("vakantieplanning.status")} />
            <th className="px-4 py-3 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {groupedData ? (
            groupedData.map(([groupName, items]) => {
              const totalDays = items.reduce((s, l) => s + l.total_leave_days, 0);
              return (
                <Fragment key={groupName}>
                  <tr className="bg-slate-100 border-t border-slate-200">
                    <td colSpan={7} className="px-4 py-2 font-semibold text-slate-700 text-sm">
                      {groupName} <span className="text-slate-400 font-normal">{t("vakantieplanning.group_summary", { count: items.length, days: totalDays })}</span>
                    </td>
                  </tr>
                  {items.map((l) => (
                    <tr key={l.name} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{l.employee_name}</td>
                      <td className="px-4 py-3 text-slate-600">{l.leave_type}</td>
                      <td className="px-4 py-3 text-slate-600">{l.from_date}</td>
                      <td className="px-4 py-3 text-slate-600">{l.to_date}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{l.total_leave_days}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[l.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`${getErpNextLinkUrl()}/leave-application/${l.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-y-teal hover:text-y-teal-dark"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })
          ) : (
            leaves.map((l) => (
              <tr key={l.name} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{l.employee_name}</td>
                <td className="px-4 py-3 text-slate-600">{l.leave_type}</td>
                <td className="px-4 py-3 text-slate-600">{l.from_date}</td>
                <td className="px-4 py-3 text-slate-600">{l.to_date}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">{l.total_leave_days}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[l.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`${getErpNextLinkUrl()}/leave-application/${l.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-y-teal hover:text-y-teal-dark"
                  >
                    <ExternalLink size={14} />
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
