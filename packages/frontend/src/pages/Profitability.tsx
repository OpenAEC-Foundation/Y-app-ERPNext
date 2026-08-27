import { useEffect, useState, useMemo } from "react";
import { fetchAll } from "../lib/erpnext";
import { useEmployees } from "../lib/DataContext";
import {
  UserCheck, RefreshCw, Filter, TrendingUp, TrendingDown,
  Clock, DollarSign, ChevronDown, ChevronUp,
} from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";

/* ─── Types ─── */

interface TimesheetRow {
  employee: string;
  employee_name: string;
  total_hours: number;
  company: string;
  start_date: string;
}

interface GLRow {
  account: string;
  debit: number;
  credit: number;
  voucher_type: string;
  company: string;
  posting_date: string;
  against: string;
  is_cancelled: number;
}

interface SalesInvRow {
  net_total: number;
  company: string;
  posting_date: string;
}

interface EmployeeStats {
  id: string;
  name: string;
  hours: number;
  revShare: number;
  overheadShare: number;
  salaryShare: number;
  totalCost: number;
  result: number;
  margin: number;
  hourlyRevenue: number;
  hourlyCost: number;
}

/* ─── Helpers ─── */

const euro = (v: number) => v.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const pct = (v: number) => `${v.toFixed(1)}%`;

const SALARY_ACCOUNTS = /salary|loon|salari|personal withdrawal|wage/i;
const EXCLUDE_ACCOUNTS = /debtor|creditor|bank|tax payable|vat|btw|cross.?post|payable|receivable/i;

type SortField = "name" | "hours" | "revShare" | "totalCost" | "result" | "margin" | "hourlyRevenue";

/* ─── Component ─── */

export default function Profitability() {
  const { t } = useTranslation();
  const employees = useEmployees();
  const [company, setCompany] = useState(getActiveCompany());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [timesheets, setTimesheets] = useState<TimesheetRow[]>([]);
  const [glEntries, setGlEntries] = useState<GLRow[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("result");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  async function loadData() {
    setLoading(true);
    try {
      // Not `docstatus = 1` (submitted-only): on instances where Timesheets
      // are never explicitly "submitted" in the ERPNext document-lifecycle
      // sense (approval tracked some other way — same reality
      // ErpNextOverview.tsx's timesheet count already accounts for with
      // `docstatus != 2`), that would silently zero out every hour here.
      // Only exclude cancelled (docstatus = 2) rows.
      const tsFilters: unknown[][] = [
        ["docstatus", "!=", 2],
        ["start_date", ">=", yearStart],
        ["start_date", "<=", yearEnd],
      ];
      if (company) tsFilters.push(["company", "=", company]);

      const glFilters: unknown[][] = [
        ["is_cancelled", "=", 0],
        ["posting_date", ">=", yearStart],
        ["posting_date", "<=", yearEnd],
      ];
      if (company) glFilters.push(["company", "=", company]);

      const siFilters: unknown[][] = [
        ["docstatus", "=", 1],
        ["posting_date", ">=", yearStart],
        ["posting_date", "<=", yearEnd],
      ];
      if (company) siFilters.push(["company", "=", company]);

      const [ts, gl, si] = await Promise.all([
        fetchAll<TimesheetRow>("Timesheet",
          ["employee", "employee_name", "total_hours", "company", "start_date"],
          tsFilters, "start_date asc"),
        fetchAll<GLRow>("GL Entry",
          ["account", "debit", "credit", "voucher_type", "company", "posting_date", "against", "is_cancelled"],
          glFilters, "posting_date asc"),
        fetchAll<SalesInvRow>("Sales Invoice",
          ["net_total", "company", "posting_date"],
          siFilters, "posting_date asc"),
      ]);

      setTimesheets(ts);
      setGlEntries(gl);
      setSalesInvoices(si);
    } catch (err) {
      console.error("Rendabiliteit load error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [company, year]);

  // ─── Calculations ───

  const totalRevenue = useMemo(
    () => salesInvoices.reduce((s, i) => s + (i.net_total || 0), 0),
    [salesInvoices]
  );

  // Split costs: salary vs overhead
  const { totalSalary, totalOverhead } = useMemo(() => {
    let salary = 0;
    let overhead = 0;
    for (const gl of glEntries) {
      const net = gl.debit - gl.credit;
      if (net <= 0) continue; // only expenses (net debit)
      if (EXCLUDE_ACCOUNTS.test(gl.account)) continue;
      if (SALARY_ACCOUNTS.test(gl.account)) {
        salary += net;
      } else {
        overhead += net;
      }
    }
    return { totalSalary: salary, totalOverhead: overhead };
  }, [glEntries]);

  // Hours per employee
  const hoursPerEmployee = useMemo(() => {
    const map = new Map<string, { hours: number; name: string }>();
    for (const ts of timesheets) {
      if (!ts.employee) continue;
      const existing = map.get(ts.employee) || { hours: 0, name: ts.employee_name };
      existing.hours += ts.total_hours || 0;
      map.set(ts.employee, existing);
    }
    return map;
  }, [timesheets]);

  const totalHours = useMemo(
    () => Array.from(hoursPerEmployee.values()).reduce((s, e) => s + e.hours, 0),
    [hoursPerEmployee]
  );

  const activeEmployeeCount = useMemo(
    () => employees.filter((e) => e.status === "Active" && (!company || e.company === company)).length || 1,
    [employees, company]
  );

  // Build employee stats
  const employeeStats = useMemo<EmployeeStats[]>(() => {
    const stats: EmployeeStats[] = [];
    for (const [empId, data] of hoursPerEmployee) {
      if (data.hours <= 0) continue;
      const hoursFraction = totalHours > 0 ? data.hours / totalHours : 0;

      // Revenue share proportional to hours worked
      const revShare = totalRevenue * hoursFraction;

      // Salary share proportional to hours worked (since we don't have per-employee salary)
      const salaryShare = totalSalary * hoursFraction;

      // Overhead divided equally among active employees
      const overheadShare = totalOverhead / activeEmployeeCount;

      const totalCost = salaryShare + overheadShare;
      const result = revShare - totalCost;
      const margin = revShare > 0 ? (result / revShare) * 100 : 0;

      stats.push({
        id: empId,
        name: data.name,
        hours: data.hours,
        revShare,
        overheadShare,
        salaryShare,
        totalCost,
        result,
        margin,
        hourlyRevenue: data.hours > 0 ? revShare / data.hours : 0,
        hourlyCost: data.hours > 0 ? totalCost / data.hours : 0,
      });
    }
    return stats;
  }, [hoursPerEmployee, totalRevenue, totalSalary, totalOverhead, totalHours, activeEmployeeCount]);

  // Sort
  const sorted = useMemo(() => {
    return [...employeeStats].sort((a, b) => {
      const va = a[sortField] ?? 0;
      const vb = b[sortField] ?? 0;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [employeeStats, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  }

  // Totals
  const totals = useMemo(() => ({
    hours: employeeStats.reduce((s, e) => s + e.hours, 0),
    revShare: employeeStats.reduce((s, e) => s + e.revShare, 0),
    totalCost: employeeStats.reduce((s, e) => s + e.totalCost, 0),
    result: employeeStats.reduce((s, e) => s + e.result, 0),
  }), [employeeStats]);

  const avgMargin = totals.revShare > 0 ? (totals.result / totals.revShare) * 100 : 0;
  const avgHourlyRate = totalHours > 0 ? totalRevenue / totalHours : 0;

  // Year options
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(y - i));
  }, []);

  // Bar chart data
  const maxResult = Math.max(...sorted.map((e) => Math.abs(e.result)), 1);

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-y-teal/10 rounded-lg">
            <UserCheck className="text-y-teal" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t("rendabiliteit.title")}</h2>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <CompanySelect value={company} onChange={setCompany} />
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPI icon={DollarSign} iconColor="text-green-600" iconBg="bg-green-100"
          label={t("rendabiliteit.kpi_total_revenue")} value={loading ? "..." : euro(totalRevenue)} />
        <KPI icon={TrendingDown} iconColor="text-red-600" iconBg="bg-red-100"
          label={t("rendabiliteit.kpi_payroll")} value={loading ? "..." : euro(totalSalary)} />
        <KPI icon={TrendingDown} iconColor="text-orange-600" iconBg="bg-orange-100"
          label={t("rendabiliteit.kpi_overhead")} value={loading ? "..." : euro(totalOverhead)} />
        <KPI icon={Clock} iconColor="text-y-teal" iconBg="bg-y-teal/10"
          label={t("rendabiliteit.kpi_total_hours")} value={loading ? "..." : `${Math.round(totalHours).toLocaleString("nl-NL")}`}
          sub={t("rendabiliteit.kpi_avg_hourly", { rate: euro(avgHourlyRate) })} />
        <KPI icon={TrendingUp} iconColor={avgMargin >= 0 ? "text-green-600" : "text-red-600"}
          iconBg={avgMargin >= 0 ? "bg-green-100" : "bg-red-100"}
          label={t("rendabiliteit.kpi_result")} value={loading ? "..." : euro(totals.result)}
          sub={t("rendabiliteit.kpi_margin", { value: pct(avgMargin) })} />
      </div>

      {/* Explanation */}
      <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
        <strong>{t("rendabiliteit.calculation_label")}</strong> {t("rendabiliteit.calculation_explanation", { employees: activeEmployeeCount, perPerson: euro(totalOverhead / activeEmployeeCount) })}
      </div>

      {/* Chart */}
      {!loading && sorted.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">{t("rendabiliteit.result_per_employee")}</h3>
          <div className="space-y-2">
            {sorted.slice(0, 15).map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-36 truncate text-right">{e.name.split(" ")[0]}</span>
                <div className="flex-1 flex items-center h-5">
                  {e.result >= 0 ? (
                    <div
                      className="h-full bg-green-400 rounded-r"
                      style={{ width: `${(e.result / maxResult) * 50}%`, marginLeft: "50%" }}
                    />
                  ) : (
                    <div
                      className="h-full bg-red-400 rounded-l"
                      style={{
                        width: `${(Math.abs(e.result) / maxResult) * 50}%`,
                        marginLeft: `${50 - (Math.abs(e.result) / maxResult) * 50}%`,
                      }}
                    />
                  )}
                </div>
                <span className={`text-xs font-semibold w-20 text-right ${e.result >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {euro(e.result)}
                </span>
              </div>
            ))}
          </div>
          {/* Zero line indicator */}
          <div className="flex items-center gap-3 mt-1">
            <span className="w-36" />
            <div className="flex-1 relative h-0">
              <div className="absolute left-1/2 -top-[calc(100%+8px)] bottom-0 w-px bg-slate-300" style={{ height: `${Math.min(sorted.length, 15) * 28 + 16}px` }} />
            </div>
            <span className="w-20" />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {([
                ["name", t("rendabiliteit.employee_col"), "text-left"],
                ["hours", t("rendabiliteit.col_hours"), "text-right"],
                ["revShare", t("rendabiliteit.col_revenue_share"), "text-right"],
                ["totalCost", t("rendabiliteit.col_total_costs"), "text-right"],
                ["result", t("rendabiliteit.col_result"), "text-right"],
                ["margin", t("rendabiliteit.col_margin"), "text-right"],
                ["hourlyRevenue", t("rendabiliteit.col_revenue_per_hour"), "text-right"],
              ] as [SortField, string, string][]).map(([field, label, align]) => (
                <th key={field}
                  onClick={() => toggleSort(field)}
                  className={`${align} px-3 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-800 select-none`}
                >
                  <span className="inline-flex items-center gap-1">{label} <SortIcon field={field} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t("rendabiliteit.no_data")}</td></tr>
            ) : sorted.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2.5 text-sm font-medium text-slate-700">
                  {e.name}
                  <span className="text-xs text-slate-400 ml-1.5">{e.id}</span>
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-600 text-right">
                  {Math.round(e.hours).toLocaleString("nl-NL")}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700 text-right">{euro(e.revShare)}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700 text-right">
                  <span title={t("rendabiliteit.cost_breakdown_tooltip", { salary: euro(e.salaryShare), overhead: euro(e.overheadShare) })}>
                    {euro(e.totalCost)}
                  </span>
                </td>
                <td className={`px-3 py-2.5 text-sm font-semibold text-right ${e.result >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {euro(e.result)}
                </td>
                <td className={`px-3 py-2.5 text-sm font-semibold text-right ${e.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {pct(e.margin)}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-600 text-right">{euro(e.hourlyRevenue)}</td>
              </tr>
            ))}
          </tbody>
          {!loading && sorted.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="px-3 py-3 text-sm font-semibold text-slate-700">{t("rendabiliteit.total_average")}</td>
                <td className="px-3 py-3 text-sm font-semibold text-slate-700 text-right">
                  {Math.round(totals.hours).toLocaleString("nl-NL")}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-slate-700 text-right">{euro(totals.revShare)}</td>
                <td className="px-3 py-3 text-sm font-semibold text-slate-700 text-right">{euro(totals.totalCost)}</td>
                <td className={`px-3 py-3 text-sm font-bold text-right ${totals.result >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {euro(totals.result)}
                </td>
                <td className={`px-3 py-3 text-sm font-bold text-right ${avgMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {pct(avgMargin)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-slate-700 text-right">{euro(avgHourlyRate)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ─── KPI Card ─── */

function KPI({ icon: Icon, iconColor, iconBg, label, value, sub }: {
  icon: typeof TrendingUp;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-1">
        <div className={`p-2 ${iconBg} rounded-lg`}>
          <Icon className={iconColor} size={20} />
        </div>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
