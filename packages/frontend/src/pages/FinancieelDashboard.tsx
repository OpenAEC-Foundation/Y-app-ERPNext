import { useEffect, useState, useMemo } from "react";
import { fetchAll, fetchCount, fetchChildTable } from "../lib/erpnext";
import {
  BarChart3, RefreshCw, Landmark, FileText, ShoppingCart,
  TrendingUp, AlertTriangle, Filter, Clock, Users, FolderKanban, X, Building2,
  Package,
} from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import DateRangeFilter from "../components/DateRangeFilter";
import { useCompanies } from "../lib/DataContext";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";
import {
  SALES_INVOICE_ACTIVE_FILTER,
  DOCSTATUS_SUBMITTED,
  draftShare,
} from "../lib/invoice-docstatus";

interface InvoiceTrend {
  month: string;
  label: string;
  total: number;
  outstanding: number;
  count: number;
}

interface EmpMonthly {
  employee: string;
  name: string;
  months: number[];
  billableMonths: number[];
  total: number;
  totalBillable: number;
}

interface ProjMonthly {
  project: string;
  name: string;
  months: number[];
  billableMonths: number[];
  total: number;
  totalBillable: number;
}

interface UrenDetailLog {
  date: string;
  project: string;
  activity: string;
  hours: number;
  isBillable: boolean;
  description: string;
}

interface UrenDetail {
  employee: string;
  month: number;
  year: string;
  logs: UrenDetailLog[];
  totalHours: number;
  billableHours: number;
  billablePercent: number;
}

interface ActivityMonthly {
  activity: string;
  months: number[];
  total: number;
}

interface UrenStats {
  employeeMonthly: EmpMonthly[];
  projectMonthly: ProjMonthly[];
  totalHours: number;
  totalBillable: number;
  billablePercent: number;
  monthTotalHours: number[];
  monthBillableHours: number[];
  monthBillablePercent: number[];
  bureauActivities: ActivityMonthly[];
}

interface DNoteRecord {
  name: string;
  customer_name: string;
  posting_date: string;
  grand_total: number;
  net_total: number;
  status: string;
  company: string;
  docstatus: number;
}

interface DNoteStats {
  totalCount: number;
  totalValue: number;
  thisMonthCount: number;
  thisMonthValue: number;
  thisQuarterCount: number;
  thisQuarterValue: number;
  thisYearCount: number;
  thisYearValue: number;
  topCustomers: { customer: string; count: number; total: number }[];
  monthlyTrend: { month: string; label: string; count: number; total: number }[];
  statusBreakdown: { status: string; count: number; total: number }[];
}

type Tab = "overzicht" | "uren" | "bureau" | "leveringen" | "klanten" | "omzet-klant";

interface KlantenProject {
  name: string;
  customer: string | null;
  project_name: string;
  expected_start_date: string | null;
  actual_start_date: string | null;
  creation: string;
}

interface OmzetInvoice {
  name: string;
  customer: string | null;
  customer_name: string | null;
  posting_date: string;
  net_total: number;
  docstatus?: number;
}

type OmzetGranularity = "week" | "month" | "quarter" | "year";

const MONTH_LABELS_KEYS = [
  "financieel_dashboard.month_jan","financieel_dashboard.month_feb","financieel_dashboard.month_mar",
  "financieel_dashboard.month_apr","financieel_dashboard.month_may","financieel_dashboard.month_jun",
  "financieel_dashboard.month_jul","financieel_dashboard.month_aug","financieel_dashboard.month_sep",
  "financieel_dashboard.month_oct","financieel_dashboard.month_nov","financieel_dashboard.month_dec",
];
const euro = (v: number) => `€ ${v.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`;
const fmt = (n: number) => n % 1 !== 0 ? n.toFixed(1) : n.toFixed(0);

/**
 * Client-side vervanging voor de vroegere Express-route `/api/stats/uren`.
 * Haalt Employee/Timesheet/Project/"Timesheet Detail" rechtstreeks op via
 * de standaard `/api/resource`-endpoints en aggregeert exact dezelfde
 * uren-per-medewerker/-project/-activiteit-statistieken client-side.
 * "Timesheet Detail" heeft geen eigen `company`/`employee`-kolom om op te
 * filteren, dus filteren we eerst de parent-Timesheets en batchen we de
 * detail-fetch per 200 parent-namen (voorkomt een te lange `filters`-query
 * bij grote jaren, net als de oude server-implementatie deed).
 *
 * Frappe v16 403's a plain /api/resource list query against a child-table
 * doctype like "Timesheet Detail" — even with a parenttype filter — so this
 * goes through fetchChildTable's frappe.client.get_list(parent=...) RPC
 * instead of fetchAll (verified against a live v16 instance; see
 * lib/erpnext.ts for details).
 */
async function fetchTimesheetDetailsChunked<T>(
  parentNames: string[],
  fields: string[]
): Promise<T[]> {
  if (parentNames.length === 0) return [];
  const CHUNK = 200;
  const chunks: string[][] = [];
  for (let i = 0; i < parentNames.length; i += CHUNK) chunks.push(parentNames.slice(i, i + CHUNK));
  const results = await Promise.all(
    // Generous per-chunk cap: each chunk covers 200 parent Timesheets, and a
    // Timesheet realistically has at most a handful of time-log rows each.
    chunks.map((chunk) => fetchChildTable<T>("Timesheet Detail", "Timesheet", fields, [["parent", "in", chunk]], 5000))
  );
  return results.flat();
}

interface TimesheetDetailAggRow {
  parent: string;
  hours: number;
  is_billable: number;
  project: string | null;
  activity_type: string | null;
}

async function computeUrenStats(
  year: number,
  company: string,
  projEmployeeFilter: string
): Promise<UrenStats> {
  const [employees, timesheets, projects] = await Promise.all([
    fetchAll<{ name: string; company: string }>("Employee", ["name", "company"]),
    // Not `docstatus = 1` (submitted-only): on instances where Timesheets
    // are never explicitly "submitted" in the ERPNext document-lifecycle
    // sense, that would silently zero out every hour on this tab — same
    // reasoning as Profitability.tsx and ErpNextOverview.tsx's timesheet
    // count (`docstatus != 2`). Only exclude cancelled (docstatus = 2) rows.
    fetchAll<{ name: string; employee: string; employee_name: string; start_date: string; total_hours: number }>(
      "Timesheet",
      ["name", "employee", "employee_name", "start_date", "total_hours"],
      [["docstatus", "!=", 2], ["start_date", "like", `${year}%`]],
      "start_date asc"
    ),
    fetchAll<{ name: string; project_name: string }>("Project", ["name", "project_name"]),
  ]);

  const empCompanyMap = new Map(employees.map((e) => [e.name, e.company || ""]));
  const filteredTimesheets = company
    ? timesheets.filter((ts) => empCompanyMap.get(ts.employee) === company)
    : timesheets;

  const projNameMap = new Map(projects.map((p) => [p.name, p.project_name || p.name]));

  const empMap = new Map<string, EmpMonthly>();
  const projMap = new Map<string, ProjMonthly>();
  const activityMap = new Map<string, ActivityMonthly>();
  let totalHours = 0, totalBillable = 0;
  const monthTotalHours = new Array(12).fill(0);
  const monthBillableHours = new Array(12).fill(0);

  interface TsMeta { employee: string; monthIdx: number; }
  const tsByName = new Map<string, TsMeta>();
  for (const ts of filteredTimesheets) {
    const emp = ts.employee;
    const monthIdx = parseInt(ts.start_date.slice(5, 7), 10) - 1;
    tsByName.set(ts.name, { employee: emp, monthIdx });

    if (!empMap.has(emp)) {
      empMap.set(emp, { employee: emp, name: ts.employee_name, months: new Array(12).fill(0), billableMonths: new Array(12).fill(0), total: 0, totalBillable: 0 });
    }
    const empEntry = empMap.get(emp)!;
    empEntry.months[monthIdx] += ts.total_hours || 0;
    empEntry.total += ts.total_hours || 0;
    totalHours += ts.total_hours || 0;
    monthTotalHours[monthIdx] += ts.total_hours || 0;
  }

  const allDetails = await fetchTimesheetDetailsChunked<TimesheetDetailAggRow>(
    Array.from(tsByName.keys()),
    ["parent", "hours", "is_billable", "project", "activity_type"]
  );

  for (const log of allDetails) {
    const ts = tsByName.get(log.parent);
    if (!ts) continue;
    const empEntry = empMap.get(ts.employee);
    if (!empEntry) continue;
    const hours = log.hours || 0;
    const isBillable = log.is_billable || 0;
    const proj = log.project || "(geen project)";

    if (isBillable) {
      empEntry.billableMonths[ts.monthIdx] += hours;
      empEntry.totalBillable += hours;
      totalBillable += hours;
      monthBillableHours[ts.monthIdx] += hours;
    } else {
      const activity = log.activity_type || "(geen activiteit)";
      if (!activityMap.has(activity)) {
        activityMap.set(activity, { activity, months: new Array(12).fill(0), total: 0 });
      }
      const actEntry = activityMap.get(activity)!;
      actEntry.months[ts.monthIdx] += hours;
      actEntry.total += hours;
    }

    if (!projEmployeeFilter || ts.employee === projEmployeeFilter) {
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

  const monthBillablePercent = monthTotalHours.map((tot: number, i: number) => (tot > 0 ? Math.round((monthBillableHours[i] / tot) * 100) : 0));

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

export default function FinancieelDashboard() {
  const { t } = useTranslation();
  const [company, setCompany] = useState(getActiveCompany());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overzicht");

  // Validate stored company against actual companies list
  const companies = useCompanies();
  useEffect(() => {
    if (company && companies.length > 0 && !companies.some(c => c.name === company)) {
      setCompany("");
    }
  }, [company, companies]);

  // KPIs
  const [bankTransactions, setBankTransactions] = useState(0);
  const [unpaidPurchase, setUnpaidPurchase] = useState<{count: number; total: number}>({count: 0, total: 0});
  const [unpaidSales, setUnpaidSales] = useState<{count: number; total: number}>({count: 0, total: 0});

  // Trend data
  const [salesInvoices, setSalesInvoices] = useState<{posting_date: string; grand_total: number; outstanding_amount: number; docstatus?: number}[]>([]);

  // Uren tab
  const [urenStats, setUrenStats] = useState<UrenStats | null>(null);
  const [loadingUren, setLoadingUren] = useState(false);
  const [urenYear, setUrenYear] = useState(new Date().getFullYear());
  const [urenDetail, setUrenDetail] = useState<UrenDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [projEmployee, setProjEmployee] = useState("");
  const [projData, setProjData] = useState<ProjMonthly[] | null>(null);
  const [loadingProj, setLoadingProj] = useState(false);

  // Delivery Notes tab
  const [dnStats, setDnStats] = useState<DNoteStats | null>(null);
  const [loadingDN, setLoadingDN] = useState(false);

  // Klanten tab — project counts by customer × year
  const [klantenProjects, setKlantenProjects] = useState<KlantenProject[]>([]);
  const [loadingKlanten, setLoadingKlanten] = useState(false);
  const [klantenSearch, setKlantenSearch] = useState("");
  const [klantenYearFrom, setKlantenYearFrom] = useState<number>(() => new Date().getFullYear() - 4);
  const [klantenYearTo, setKlantenYearTo] = useState<number>(() => new Date().getFullYear());

  // Omzet-per-klant tab — revenue per customer × period (week/month/quarter/year)
  const [omzetInvoices, setOmzetInvoices] = useState<OmzetInvoice[]>([]);
  const [loadingOmzet, setLoadingOmzet] = useState(false);
  const [omzetSearch, setOmzetSearch] = useState("");
  const [omzetGranularity, setOmzetGranularity] = useState<OmzetGranularity>("month");
  const [omzetFrom, setOmzetFrom] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [omzetTo, setOmzetTo] = useState<string>(() => new Date().toISOString().slice(0, 10));

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const companyFilter: unknown[][] = company ? [["company", "=", company]] : [];
      const dateFilters: unknown[][] = [];
      if (fromDate) dateFilters.push(["posting_date", ">=", fromDate]);
      if (toDate) dateFilters.push(["posting_date", "<=", toDate]);

      const [bankCount, purchaseList, salesList] = await Promise.all([
        fetchCount("Bank Transaction", [
          ...companyFilter,
          ["status", "!=", "Reconciled"],
          ["status", "!=", "Cancelled"],
          ["docstatus", "=", 1],
        ]).catch(() => 0),
        fetchAll<{outstanding_amount: number}>(
          "Purchase Invoice",
          ["outstanding_amount"],
          [...companyFilter, ...dateFilters, ["docstatus", "=", 1], ["outstanding_amount", ">", 0]]
        ),
        // Omzettrend telt concepten mee (`docstatus != 2`); de KPI
        // "onbetaalde verkoopfacturen" hieronder blijft strikt op definitieve
        // facturen — een concept is geen vordering.
        fetchAll<{posting_date: string; grand_total: number; outstanding_amount: number; docstatus?: number}>(
          "Sales Invoice",
          ["posting_date", "grand_total", "outstanding_amount", "docstatus"],
          [...companyFilter, ...dateFilters, SALES_INVOICE_ACTIVE_FILTER],
          "posting_date asc"
        ),
      ]);

      setBankTransactions(bankCount);
      setUnpaidPurchase({
        count: purchaseList.length,
        total: purchaseList.reduce((s, i) => s + i.outstanding_amount, 0),
      });
      const outstandingSales = salesList.filter(
        i => i.outstanding_amount > 0 && i.docstatus === DOCSTATUS_SUBMITTED
      );
      setUnpaidSales({
        count: outstandingSales.length,
        total: outstandingSales.reduce((s, i) => s + i.outstanding_amount, 0),
      });
      setSalesInvoices(salesList);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  async function loadUrenData() {
    setLoadingUren(true);
    try {
      const data = await computeUrenStats(urenYear, company, "");
      setUrenStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("financial.hours_load_error"));
    } finally {
      setLoadingUren(false);
    }
  }

  async function loadUrenDetail(employee: string, monthIdx: number, empName: string) {
    setLoadingDetail(true);
    try {
      const monthStr = String(monthIdx + 1).padStart(2, "0");
      // Match computeUrenStats' `docstatus != 2` above — this drill-down
      // must find the same Timesheets that fed the aggregate hours it's
      // expanding, or a month that shows N hours in the overview would show
      // an empty detail panel on click.
      const timesheets = await fetchAll<{ name: string; start_date: string }>(
        "Timesheet",
        ["name", "start_date"],
        [["docstatus", "!=", 2], ["employee", "=", employee], ["start_date", "like", `${urenYear}-${monthStr}%`]]
      );
      const tsStartDate = new Map(timesheets.map((ts) => [ts.name, ts.start_date]));

      const [projects, details] = await Promise.all([
        fetchAll<{ name: string; project_name: string }>("Project", ["name", "project_name"]),
        fetchTimesheetDetailsChunked<{
          parent: string; from_time: string | null; project: string | null;
          activity_type: string | null; hours: number; is_billable: number; description: string | null;
        }>(
          Array.from(tsStartDate.keys()),
          ["parent", "from_time", "project", "activity_type", "hours", "is_billable", "description"]
        ),
      ]);
      const projNameMap = new Map(projects.map((p) => [p.name, p.project_name || p.name]));

      const logs: UrenDetailLog[] = details.map((log) => {
        const projId = log.project || "";
        const projName = projId ? projNameMap.get(projId) : "";
        const projDisplay = projName ? `${projId} — ${projName}` : projId;
        return {
          date: log.from_time?.split(" ")[0] || tsStartDate.get(log.parent) || "",
          project: projDisplay,
          activity: log.activity_type || "",
          hours: log.hours || 0,
          isBillable: !!log.is_billable,
          description: log.description || "",
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      const totalHours = logs.reduce((s, l) => s + l.hours, 0);
      const billableHours = logs.filter((l) => l.isBillable).reduce((s, l) => s + l.hours, 0);

      setUrenDetail({
        employee: empName, // Use display name
        month: monthIdx,
        year: String(urenYear),
        logs,
        totalHours,
        billableHours,
        billablePercent: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("financial.detail_load_error"));
    } finally {
      setLoadingDetail(false);
    }
  }

  async function loadProjData(empFilter: string) {
    setLoadingProj(true);
    try {
      const data = await computeUrenStats(urenYear, company, empFilter);
      setProjData(data.projectMonthly);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("financial.project_hours_error"));
    } finally {
      setLoadingProj(false);
    }
  }

  async function loadDeliveryNotes() {
    setLoadingDN(true);
    try {
      const companyFilter: unknown[][] = company ? [["company", "=", company]] : [];
      const notes = await fetchAll<DNoteRecord>(
        "Delivery Note",
        ["name", "customer_name", "posting_date", "grand_total", "net_total", "status", "company", "docstatus"],
        [...companyFilter, ["docstatus", "!=", 2]],
        "posting_date asc"
      );

      const now = new Date();
      const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const curYear = now.getFullYear();
      const curQuarter = Math.floor(now.getMonth() / 3);

      let thisMonthCount = 0, thisMonthValue = 0;
      let thisQuarterCount = 0, thisQuarterValue = 0;
      let thisYearCount = 0, thisYearValue = 0;
      const customerMap = new Map<string, { count: number; total: number }>();
      const monthMap = new Map<string, { count: number; total: number }>();
      const statusMap = new Map<string, { count: number; total: number }>();

      for (const n of notes) {
        const d = new Date(n.posting_date);
        const ym = n.posting_date.slice(0, 7);

        // Time period aggregation
        if (ym === curMonth) { thisMonthCount++; thisMonthValue += n.grand_total; }
        if (d.getFullYear() === curYear && Math.floor(d.getMonth() / 3) === curQuarter) { thisQuarterCount++; thisQuarterValue += n.grand_total; }
        if (d.getFullYear() === curYear) { thisYearCount++; thisYearValue += n.grand_total; }

        // Customer aggregation
        const cust = n.customer_name || t("financieel_dashboard.unknown_customer");
        const cc = customerMap.get(cust) || { count: 0, total: 0 };
        cc.count++; cc.total += n.grand_total;
        customerMap.set(cust, cc);

        // Monthly aggregation
        const mc = monthMap.get(ym) || { count: 0, total: 0 };
        mc.count++; mc.total += n.grand_total;
        monthMap.set(ym, mc);

        // Status aggregation
        const sc = statusMap.get(n.status) || { count: 0, total: 0 };
        sc.count++; sc.total += n.grand_total;
        statusMap.set(n.status, sc);
      }

      const topCustomers = Array.from(customerMap.entries())
        .map(([customer, data]) => ({ customer, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const monthlyTrend = Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => {
          const [y, m] = month.split("-");
          return { month, label: `${t(MONTH_LABELS_KEYS[parseInt(m) - 1])} ${y.slice(2)}`, ...data };
        });

      const statusBreakdown = Array.from(statusMap.entries())
        .map(([status, data]) => ({ status, ...data }))
        .sort((a, b) => b.count - a.count);

      setDnStats({
        totalCount: notes.length,
        totalValue: notes.reduce((s, n) => s + n.grand_total, 0),
        thisMonthCount, thisMonthValue,
        thisQuarterCount, thisQuarterValue,
        thisYearCount, thisYearValue,
        topCustomers, monthlyTrend, statusBreakdown,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("financial.deliveries_load_error"));
    } finally {
      setLoadingDN(false);
    }
  }

  async function loadKlantenData() {
    setLoadingKlanten(true);
    setError(null);
    try {
      const filters: unknown[][] = [];
      if (company) filters.push(["company", "=", company]);
      // NB: `customer_name` is NOT a field on the Project doctype — it lives
      // on Customer, Sales Invoice, Quotation, etc. Requesting it triggers
      // ERPNext's "Expectation Failed" (HTTP 417). We use `customer` (the
      // Customer link/ID) as the row label; in standard ERPNext setups the
      // Customer ID equals the customer name (autoname = customer_name).
      const projects = await fetchAll<KlantenProject>(
        "Project",
        ["name", "customer", "project_name", "expected_start_date", "actual_start_date", "creation"],
        filters,
        "creation desc"
      );
      setKlantenProjects(projects);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoadingKlanten(false);
    }
  }

  async function loadOmzetData() {
    setLoadingOmzet(true);
    setError(null);
    try {
      // Omzet per klant is een statistiek → concepten tellen mee.
      const filters: unknown[][] = [SALES_INVOICE_ACTIVE_FILTER];
      if (company) filters.push(["company", "=", company]);
      if (omzetFrom) filters.push(["posting_date", ">=", omzetFrom]);
      if (omzetTo) filters.push(["posting_date", "<=", omzetTo]);
      const rows = await fetchAll<OmzetInvoice>(
        "Sales Invoice",
        ["name", "customer", "customer_name", "posting_date", "net_total", "docstatus"],
        filters,
        "posting_date asc"
      );
      setOmzetInvoices(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoadingOmzet(false);
    }
  }

  useEffect(() => { loadData(); }, [company, fromDate, toDate]);
  useEffect(() => { if (activeTab === "uren" || activeTab === "bureau") loadUrenData(); }, [activeTab, company, urenYear]);
  useEffect(() => { if (activeTab === "leveringen") loadDeliveryNotes(); }, [activeTab, company]);
  useEffect(() => { if (activeTab === "klanten") loadKlantenData(); }, [activeTab, company]);
  useEffect(() => { if (activeTab === "omzet-klant") loadOmzetData(); }, [activeTab, company, omzetFrom, omzetTo]);
  useEffect(() => { if (activeTab === "uren" && projEmployee) loadProjData(projEmployee); else setProjData(null); }, [projEmployee, activeTab, company, urenYear]);

  // Build monthly trend
  const trendData = useMemo<InvoiceTrend[]>(() => {
    const months = new Map<string, {total: number; outstanding: number; count: number}>();
    for (const inv of salesInvoices) {
      const key = inv.posting_date.slice(0, 7);
      const current = months.get(key) || {total: 0, outstanding: 0, count: 0};
      current.total += inv.grand_total;
      current.outstanding += inv.outstanding_amount;
      current.count++;
      months.set(key, current);
    }
    return Array.from(months.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => {
        const [y, m] = month.split("-");
        return { month, label: `${t(MONTH_LABELS_KEYS[parseInt(m)-1])} ${y.slice(2)}`, ...data };
      });
  }, [salesInvoices]);

  const maxTrend = Math.max(...trendData.map(d => Math.max(d.total, d.outstanding)), 1);

  // Conceptdeel van de omzettrend (incl. btw — trendData rekent op grand_total).
  const salesDraft = useMemo(() => draftShare(salesInvoices, (i) => i.grand_total), [salesInvoices]);
  // Conceptdeel van de omzet-per-klant-matrix (excl. btw — net_total).
  const omzetDraft = useMemo(() => draftShare(omzetInvoices, (i) => i.net_total), [omzetInvoices]);

  // ─── Derived from backend stats ───
  const employeeMonthly = urenStats?.employeeMonthly || [];
  const projectMonthly = projData ?? urenStats?.projectMonthly ?? [];

  const activeMonths = useMemo(() => {
    const hasData = new Array(12).fill(false);
    for (const e of employeeMonthly) {
      for (let i = 0; i < 12; i++) if (e.months[i] > 0) hasData[i] = true;
    }
    return hasData.map((has, i) => ({ idx: i, label: t(MONTH_LABELS_KEYS[i]), has })).filter(m => m.has);
  }, [employeeMonthly]);

  const monthTotals = useMemo(() => {
    const totals = new Array(12).fill(0);
    for (const e of employeeMonthly) {
      for (let i = 0; i < 12; i++) totals[i] += e.months[i];
    }
    return totals;
  }, [employeeMonthly]);

  const projectMonthTotals = useMemo(() => {
    const totals = new Array(12).fill(0);
    for (const p of projectMonthly) {
      for (let i = 0; i < 12; i++) totals[i] += p.months[i];
    }
    return totals;
  }, [projectMonthly]);

  const maxEmpHours = Math.max(...employeeMonthly.flatMap(e => e.months), 1);
  const maxProjHours = Math.max(...projectMonthly.flatMap(p => p.months), 1);

  /* ─── Klanten matrix: customer × year, cells = project count ─── */
  const klantenMatrix = useMemo(() => {
    const yearRangeFrom = Math.min(klantenYearFrom, klantenYearTo);
    const yearRangeTo = Math.max(klantenYearFrom, klantenYearTo);
    const years: number[] = [];
    for (let y = yearRangeFrom; y <= yearRangeTo; y++) years.push(y);

    type Row = { customer: string; customerLabel: string; total: number; perYear: Map<number, number> };
    const byCustomer = new Map<string, Row>();

    for (const p of klantenProjects) {
      // Prefer actual_start_date, then expected_start_date, then creation —
      // that's the order ERPNext fills these as a project's lifecycle
      // progresses; they should each indicate "when the project started"
      // at the best fidelity available.
      const dateStr = p.actual_start_date || p.expected_start_date || p.creation;
      if (!dateStr) continue;
      const year = new Date(dateStr).getFullYear();
      if (isNaN(year) || year < yearRangeFrom || year > yearRangeTo) continue;
      const custKey = p.customer || "(geen klant)";
      const custLabel = p.customer || "(geen klant)";
      if (!byCustomer.has(custKey)) {
        byCustomer.set(custKey, { customer: custKey, customerLabel: custLabel, total: 0, perYear: new Map() });
      }
      const row = byCustomer.get(custKey)!;
      row.total++;
      row.perYear.set(year, (row.perYear.get(year) || 0) + 1);
    }

    let customers = Array.from(byCustomer.values()).sort((a, b) => b.total - a.total);
    if (klantenSearch.trim()) {
      const q = klantenSearch.trim().toLowerCase();
      customers = customers.filter(c => c.customerLabel.toLowerCase().includes(q));
    }

    const yearTotals = new Map<number, number>();
    for (const y of years) yearTotals.set(y, customers.reduce((s, c) => s + (c.perYear.get(y) || 0), 0));
    const grandTotal = customers.reduce((s, c) => s + c.total, 0);

    return { years, customers, yearTotals, grandTotal };
  }, [klantenProjects, klantenSearch, klantenYearFrom, klantenYearTo]);

  /* ─── Omzet matrix: customer × period bucket ─── */
  // Returns an ISO key (sortable) + a human label per bucket. The week
  // calculation follows ISO 8601 (Monday-start, week-1 contains Jan 4) so it
  // matches what NL/EU bookkeeping software shows.
  function bucketForDate(date: Date, gran: OmzetGranularity): { key: string; label: string } {
    const y = date.getFullYear();
    const m = date.getMonth(); // 0..11
    if (gran === "year") return { key: `${y}`, label: `${y}` };
    if (gran === "quarter") {
      const q = Math.floor(m / 3) + 1;
      return { key: `${y}-Q${q}`, label: `Q${q} ${y}` };
    }
    if (gran === "month") {
      const mm = String(m + 1).padStart(2, "0");
      const labels = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
      return { key: `${y}-${mm}`, label: `${labels[m]} ${y}` };
    }
    // ISO week: week 1 is the one containing the first Thursday of the year.
    const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const isoYear = tmp.getUTCFullYear();
    return { key: `${isoYear}-W${String(weekNo).padStart(2, "0")}`, label: `wk ${weekNo} ${isoYear}` };
  }

  // Build every bucket in [from..to] up front so empty buckets (no invoices
  // in that week/month/etc.) still get a column.
  function enumerateBuckets(fromStr: string, toStr: string, gran: OmzetGranularity): { key: string; label: string }[] {
    if (!fromStr || !toStr) return [];
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return [];
    const out: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    const cur = new Date(from);
    const stepDays = gran === "week" ? 1 : 1; // week/month/quarter/year — step by day, dedupe by key
    while (cur <= to) {
      const b = bucketForDate(cur, gran);
      if (!seen.has(b.key)) { seen.add(b.key); out.push(b); }
      cur.setDate(cur.getDate() + stepDays);
    }
    return out;
  }

  const omzetMatrix = useMemo(() => {
    const buckets = enumerateBuckets(omzetFrom, omzetTo, omzetGranularity);
    const bucketIndex = new Map(buckets.map((b, i) => [b.key, i]));

    type Row = { customer: string; customerLabel: string; total: number; perBucket: number[] };
    const byCustomer = new Map<string, Row>();

    for (const inv of omzetInvoices) {
      const d = new Date(inv.posting_date);
      if (isNaN(d.getTime())) continue;
      const b = bucketForDate(d, omzetGranularity);
      const idx = bucketIndex.get(b.key);
      if (idx == null) continue;
      const custKey = inv.customer || "(geen klant)";
      const custLabel = inv.customer_name || inv.customer || "(geen klant)";
      if (!byCustomer.has(custKey)) {
        byCustomer.set(custKey, { customer: custKey, customerLabel: custLabel, total: 0, perBucket: new Array(buckets.length).fill(0) });
      }
      const row = byCustomer.get(custKey)!;
      row.perBucket[idx] += inv.net_total;
      row.total += inv.net_total;
    }

    let customers = Array.from(byCustomer.values()).sort((a, b) => b.total - a.total);
    if (omzetSearch.trim()) {
      const q = omzetSearch.trim().toLowerCase();
      customers = customers.filter(c => c.customerLabel.toLowerCase().includes(q));
    }

    const bucketTotals = buckets.map((_, i) => customers.reduce((s, c) => s + c.perBucket[i], 0));
    const grandTotal = customers.reduce((s, c) => s + c.total, 0);

    return { buckets, customers, bucketTotals, grandTotal };
  }, [omzetInvoices, omzetGranularity, omzetFrom, omzetTo, omzetSearch]);

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-y-teal/10 rounded-lg">
            <BarChart3 className="text-y-teal" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t("financieel_dashboard.title")}</h2>
        </div>
        <button
          onClick={() => {
            if (activeTab === "uren" || activeTab === "bureau") loadUrenData();
            else if (activeTab === "leveringen") loadDeliveryNotes();
            else if (activeTab === "klanten") loadKlantenData();
            else if (activeTab === "omzet-klant") loadOmzetData();
            else loadData();
          }}
          disabled={loading || loadingUren || loadingDN || loadingKlanten || loadingOmzet}
          className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
          <RefreshCw size={16} className={loading || loadingUren || loadingDN || loadingKlanten || loadingOmzet ? "animate-spin" : ""} /> {t("common.refresh")}
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {([
          ["overzicht", t("financial.overview"), BarChart3],
          ["uren", t("financial.hours"), Clock],
          ["bureau", t("financieel_dashboard.tab_bureau"), Building2],
          ["leveringen", t("financieel_dashboard.tab_deliveries"), Package],
          ["klanten", t("financieel_dashboard.tab_klanten", { defaultValue: "Klanten" }), Users],
          ["omzet-klant", t("financieel_dashboard.tab_omzet_klant", { defaultValue: "Omzet/klant" }), TrendingUp],
        ] as [Tab, string, typeof BarChart3][]).map(([tab, label, Icon]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === tab
                ? "border-y-teal text-y-teal"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overzicht" && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <Filter size={16} className="text-slate-400" />
            <CompanySelect value={company} onChange={setCompany} />
            <DateRangeFilter fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-100 rounded-lg"><Landmark className="text-amber-600" size={20} /></div>
                <p className="text-sm text-slate-500">{t("financieel_dashboard.unprocessed_bank_tx")}</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">{loading ? "..." : bankTransactions}</p>
              {!loading && bankTransactions > 0 && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle size={12} /> {t("financieel_dashboard.action_required")}</p>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg"><ShoppingCart className="text-orange-600" size={20} /></div>
                <p className="text-sm text-slate-500">{t("financial.outstanding_purchase_invoices")}</p>
              </div>
              <p className="text-2xl font-bold text-slate-800">{loading ? "..." : euro(unpaidPurchase.total)}</p>
              <p className="text-xs text-slate-400 mt-1">{t("financieel_dashboard.invoices_count", { count: unpaidPurchase.count })}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg"><FileText className="text-red-600" size={20} /></div>
                <p className="text-sm text-slate-500">{t("financial.outstanding_sales")}</p>
              </div>
              <p className="text-2xl font-bold text-slate-800">{loading ? "..." : euro(unpaidSales.total)}</p>
              <p className="text-xs text-slate-400 mt-1">{t("financieel_dashboard.invoices_count", { count: unpaidSales.count })}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            {!loading && salesDraft.hasDrafts && (
              <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900 rounded">
                  {t("invoice_draft.badge")}
                </span>
                {t("invoice_draft.included", { count: salesDraft.draftCount, amount: euro(salesDraft.draftAmount) })}
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                <TrendingUp size={18} className="text-y-teal" />
                {t("financial.sales_per_month")}
              </h3>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-y-teal/30 rounded-sm" /> {t("financieel_dashboard.legend_invoiced")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-red-400 rounded-sm" /> {t("financieel_dashboard.legend_outstanding")}
                </span>
              </div>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-slate-400">{t("common.loading")}</div>
            ) : trendData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400">{t("financial.no_data")}</div>
            ) : (
              <div className="flex items-end gap-1" style={{ height: "256px" }}>
                {trendData.map((d) => {
                  const hPct = (d.total / maxTrend) * 100;
                  const oPct = (d.outstanding / maxTrend) * 100;
                  return (
                    <div key={d.month} className="flex-1 flex flex-col items-center justify-end h-full group">
                      <div className="relative w-full flex justify-center mb-1" style={{ height: "calc(100% - 24px)" }}>
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                          <div>{t("financieel_dashboard.invoices_count", { count: d.count })}</div>
                          <div>{t("financieel_dashboard.tooltip_invoiced", { value: euro(d.total) })}</div>
                          <div>{t("financieel_dashboard.tooltip_outstanding", { value: euro(d.outstanding) })}</div>
                        </div>
                        <div className="w-full max-w-[40px] h-full flex flex-col justify-end relative">
                          <div
                            className="w-full bg-y-teal/30 rounded-t"
                            style={{ height: `${Math.max(hPct, d.total > 0 ? 2 : 0)}%` }}
                          />
                          {d.outstanding > 0 && (
                            <div
                              className="w-full bg-red-400 rounded-t absolute bottom-0 left-0"
                              style={{ height: `${Math.max(oPct, 2)}%` }}
                            />
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 whitespace-nowrap mt-1">{d.label}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "uren" && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <Filter size={16} className="text-slate-400" />
            <CompanySelect value={company} onChange={setCompany} />
            <select
              value={urenYear}
              onChange={(e) => setUrenYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {loadingUren ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> {t("financieel_dashboard.hours_loading")}
            </div>
          ) : (
            <div className="space-y-6">
              {/* ─── Uren per medewerker ─── */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-y-teal" />
                    <h3 className="text-base font-semibold text-slate-700">{t("financieel_dashboard.hours_per_employee")}</h3>
                    <span className="text-xs text-slate-400 ml-2">{urenYear}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-y-teal/30 rounded-sm" /> {t("financial.total_hours")}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-emerald-500 rounded-sm" /> {t("financieel_dashboard.billable")}</span>
                  </div>
                </div>
                {employeeMonthly.length === 0 ? (
                  <div className="px-6 py-12 text-center text-slate-400">{t("financial.no_timesheets_for_year", { year: urenYear })}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50 min-w-[180px]">{t("timesheets.table.employee")}</th>
                          {activeMonths.map(m => (
                            <th key={m.idx} className="text-center px-2 py-2 text-xs font-semibold text-slate-600 min-w-[80px]">{m.label}</th>
                          ))}
                          <th className="text-center px-3 py-2 text-xs font-bold text-slate-700 min-w-[80px] bg-slate-100">{t("financial.total")}</th>
                          <th className="text-center px-3 py-2 text-xs font-bold text-slate-700 min-w-[90px] bg-emerald-50">{t("financieel_dashboard.col_pct_billable")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeMonthly.map((emp) => {
                          const billPct = emp.total > 0 ? (emp.totalBillable / emp.total) * 100 : 0;
                          return (
                            <tr key={emp.name} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-2 font-medium text-slate-700 sticky left-0 bg-white">{emp.name}</td>
                              {activeMonths.map(m => {
                                const h = emp.months[m.idx];
                                const b = emp.billableMonths[m.idx];
                                const pctH = (h / maxEmpHours) * 100;
                                const pctB = (b / maxEmpHours) * 100;
                                return (
                                  <td key={m.idx} className="px-2 py-2 text-center">
                                    {h > 0 ? (
                                      <div
                                        className="flex flex-col items-center gap-0.5 cursor-pointer hover:bg-slate-100 rounded p-0.5 transition-colors"
                                        onClick={() => loadUrenDetail(emp.employee, m.idx, emp.name)}
                                      >
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-y-teal/30 rounded-full" style={{ width: `${Math.max(pctH, 3)}%` }} />
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(pctB, b > 0 ? 3 : 0)}%` }} />
                                        </div>
                                        <span className="text-xs text-slate-600">{fmt(h)} <span className="text-emerald-600">({fmt(b)})</span></span>
                                        {h > 0 && <span className={`text-[10px] font-semibold ${(b/h*100) >= 70 ? "text-emerald-600" : (b/h*100) >= 40 ? "text-amber-600" : "text-red-500"}`}>{Math.round(b/h*100)}%</span>}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-300">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2 text-center bg-slate-50">
                                <span className="font-bold text-slate-800">{fmt(emp.total)}</span>
                                <span className="text-xs text-emerald-600 ml-1">({fmt(emp.totalBillable)})</span>
                              </td>
                              <td className="px-3 py-2 text-center bg-emerald-50">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className={`text-sm font-bold ${billPct >= 70 ? "text-emerald-600" : billPct >= 40 ? "text-amber-600" : "text-red-500"}`}>
                                    {billPct.toFixed(0)}%
                                  </span>
                                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${billPct >= 70 ? "bg-emerald-500" : billPct >= 40 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${billPct}%` }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-50">
                          <td className="px-4 py-2 font-bold text-slate-700 sticky left-0 bg-slate-50">{t("financial.total")}</td>
                          {activeMonths.map(m => (
                            <td key={m.idx} className="px-2 py-2 text-center font-bold text-slate-700">
                              {fmt(monthTotals[m.idx])}
                              <span className="text-xs text-emerald-600 ml-0.5">({fmt(urenStats?.monthBillableHours?.[m.idx] || 0)})</span>
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center bg-slate-100">
                            <span className="font-bold text-y-teal">{fmt(employeeMonthly.reduce((s, e) => s + e.total, 0))}</span>
                            <span className="text-xs text-emerald-600 ml-1">({fmt(employeeMonthly.reduce((s, e) => s + e.totalBillable, 0))})</span>
                          </td>
                          <td className="px-3 py-2 text-center font-bold bg-emerald-50">
                            {(() => {
                              const totH = employeeMonthly.reduce((s, e) => s + e.total, 0);
                              const totB = employeeMonthly.reduce((s, e) => s + e.totalBillable, 0);
                              const p = totH > 0 ? (totB / totH) * 100 : 0;
                              return <span className={`${p >= 70 ? "text-emerald-600" : p >= 40 ? "text-amber-600" : "text-red-500"}`}>{p.toFixed(0)}%</span>;
                            })()}
                          </td>
                        </tr>
                        <tr className="bg-emerald-50">
                          <td className="px-4 py-2 font-semibold text-emerald-700 sticky left-0 bg-emerald-50 text-xs">{t("financieel_dashboard.col_pct_billable")}</td>
                          {activeMonths.map(m => {
                            const pct = urenStats?.monthBillablePercent?.[m.idx] || 0;
                            return (
                              <td key={m.idx} className="px-2 py-2 text-center">
                                <span className={`text-xs font-bold ${pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-500"}`}>
                                  {pct}%
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* ─── Uren per project ─── */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2 flex-wrap">
                  <FolderKanban size={18} className="text-violet-500" />
                  <h3 className="text-base font-semibold text-slate-700">{t("financieel_dashboard.hours_per_project")}</h3>
                  <span className="text-xs text-slate-400 ml-2">{urenYear}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <Users size={14} className="text-slate-400" />
                    <select
                      value={projEmployee}
                      onChange={(e) => setProjEmployee(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white cursor-pointer min-w-[180px]"
                    >
                      <option value="">{t("instance_bar.all_employees")}</option>
                      {employeeMonthly.map(emp => (
                        <option key={emp.employee} value={emp.employee}>{emp.name}</option>
                      ))}
                    </select>
                    {loadingProj && <RefreshCw size={14} className="animate-spin text-slate-400" />}
                  </div>
                </div>
                {projectMonthly.length === 0 ? (
                  <div className="px-6 py-12 text-center text-slate-400">
                    {t("financial.no_project_hours_for_year", { year: urenYear })}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50 min-w-[220px]">{t("tasks.detail.project")}</th>
                          {activeMonths.map(m => (
                            <th key={m.idx} className="text-center px-2 py-2 text-xs font-semibold text-slate-600 min-w-[100px]">{m.label}</th>
                          ))}
                          <th className="text-center px-3 py-2 text-xs font-bold text-slate-700 min-w-[100px] bg-slate-100">{t("financial.total")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectMonthly.map((proj) => (
                          <tr key={proj.name} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                            <td className="px-4 py-2 font-medium text-slate-700 sticky left-0 bg-white truncate max-w-[220px]" title={proj.name}>
                              {proj.name}
                            </td>
                            {activeMonths.map(m => {
                              const h = proj.months[m.idx];
                              const b = proj.billableMonths?.[m.idx] || 0;
                              const billPct = h > 0 ? Math.round((b / h) * 100) : 0;
                              return (
                                <td key={m.idx} className="px-2 py-2 text-center">
                                  {h > 0 ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                                        {b > 0 && <div className="h-full bg-emerald-400 rounded-l-full" style={{ width: `${Math.max((b / maxProjHours) * 100, 2)}%` }} />}
                                        {(h - b) > 0 && <div className="h-full bg-violet-400" style={{ width: `${Math.max(((h - b) / maxProjHours) * 100, 1)}%` }} />}
                                      </div>
                                      <span className="text-xs text-slate-600">{fmt(h)}</span>
                                      {b > 0 && <span className="text-[10px] text-emerald-600">{billPct}% fact.</span>}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-center bg-slate-50">
                              <span className="font-bold text-slate-800">{fmt(proj.total)}</span>
                              {(proj.totalBillable || 0) > 0 && (
                                <div className="text-[10px] text-emerald-600">{Math.round(((proj.totalBillable || 0) / proj.total) * 100)}% fact.</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-50">
                          <td className="px-4 py-2 font-bold text-slate-700 sticky left-0 bg-slate-50">{t("financial.total")}</td>
                          {activeMonths.map(m => (
                            <td key={m.idx} className="px-2 py-2 text-center font-bold text-slate-700">{fmt(projectMonthTotals[m.idx])}</td>
                          ))}
                          <td className="px-3 py-2 text-center font-bold text-violet-600 bg-slate-100">
                            {fmt(projectMonthly.reduce((s, p) => s + p.total, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {activeTab === "bureau" && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <Filter size={16} className="text-slate-400" />
            <CompanySelect value={company} onChange={setCompany} />
            <select
              value={urenYear}
              onChange={(e) => setUrenYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {loadingUren ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> {t("common.loading")}
            </div>
          ) : (() => {
            // Filter: alleen niet-facturabele uren (Bureau Algemeen = project "0000" of geen project)
            const bureauEmployees = employeeMonthly
              .map((emp) => {
                const nonBillableMonths = emp.months.map((h, i) => h - emp.billableMonths[i]);
                const totalNonBillable = emp.total - emp.totalBillable;
                return { ...emp, nonBillableMonths, totalNonBillable };
              })
              .filter((e) => e.totalNonBillable > 0)
              .sort((a, b) => b.totalNonBillable - a.totalNonBillable);

            const maxNB = Math.max(...bureauEmployees.flatMap(e => e.nonBillableMonths), 1);

            return (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 size={18} className="text-amber-500" />
                      <h3 className="text-base font-semibold text-slate-700">{t("financial.bureau_non_billable")}</h3>
                      <span className="text-xs text-slate-400 ml-2">{urenYear}</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50 min-w-[180px]">{t("timesheets.table.employee")}</th>
                          {activeMonths.map(m => (
                            <th key={m.idx} className="text-center px-2 py-2 text-xs font-semibold text-slate-600 min-w-[70px]">{m.label}</th>
                          ))}
                          <th className="text-center px-3 py-2 text-xs font-bold text-slate-700 min-w-[80px] bg-slate-100">{t("financial.total")}</th>
                          <th className="text-center px-3 py-2 text-xs font-bold text-slate-700 min-w-[80px] bg-amber-50">% van totaal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bureauEmployees.map((emp) => {
                          const pctOfTotal = emp.total > 0 ? ((emp.totalNonBillable / emp.total) * 100) : 0;
                          return (
                            <tr key={emp.name} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-2 font-medium text-slate-700 sticky left-0 bg-white">{emp.name}</td>
                              {activeMonths.map(m => {
                                const h = emp.nonBillableMonths[m.idx];
                                const pct = (h / maxNB) * 100;
                                return (
                                  <td key={m.idx} className="px-2 py-2 text-center">
                                    {h > 0 ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.max(pct, 3)}%` }} />
                                        </div>
                                        <span className="text-xs text-slate-600">{fmt(h)}</span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-300">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2 text-center font-bold text-slate-800 bg-slate-50">{fmt(emp.totalNonBillable)}</td>
                              <td className="px-3 py-2 text-center bg-amber-50">
                                <span className={`text-sm font-bold ${pctOfTotal <= 30 ? "text-emerald-600" : pctOfTotal <= 60 ? "text-amber-600" : "text-red-500"}`}>
                                  {pctOfTotal.toFixed(0)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-50">
                          <td className="px-4 py-2 font-bold text-slate-700 sticky left-0 bg-slate-50">{t("financial.total")}</td>
                          {activeMonths.map(m => {
                            const tot = bureauEmployees.reduce((s, e) => s + e.nonBillableMonths[m.idx], 0);
                            return <td key={m.idx} className="px-2 py-2 text-center font-bold text-slate-700">{fmt(tot)}</td>;
                          })}
                          <td className="px-3 py-2 text-center font-bold text-amber-600 bg-slate-100">
                            {fmt(bureauEmployees.reduce((s, e) => s + e.totalNonBillable, 0))}
                          </td>
                          <td className="px-3 py-2 text-center font-bold bg-amber-50">
                            {(() => {
                              const totAll = employeeMonthly.reduce((s, e) => s + e.total, 0);
                              const totNB = bureauEmployees.reduce((s, e) => s + e.totalNonBillable, 0);
                              const p = totAll > 0 ? (totNB / totAll) * 100 : 0;
                              return <span className={`${p <= 30 ? "text-emerald-600" : p <= 60 ? "text-amber-600" : "text-red-500"}`}>{p.toFixed(0)}%</span>;
                            })()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                {/* ─── Uitsplitsing per activiteit ─── */}
                {(urenStats?.bureauActivities || []).length > 0 && (() => {
                  const activities = urenStats!.bureauActivities;
                  const maxAct = Math.max(...activities.flatMap(a => a.months), 1);
                  return (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                        <Clock size={18} className="text-amber-500" />
                        <h3 className="text-base font-semibold text-slate-700">{t("financial.non_billable_per_activity")}</h3>
                        <span className="text-xs text-slate-400 ml-2">{urenYear}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50 min-w-[200px]">{t("financieel_dashboard.activity")}</th>
                              {activeMonths.map(m => (
                                <th key={m.idx} className="text-center px-2 py-2 text-xs font-semibold text-slate-600 min-w-[70px]">{m.label}</th>
                              ))}
                              <th className="text-center px-3 py-2 text-xs font-bold text-slate-700 min-w-[80px] bg-slate-100">{t("financial.total")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activities.map((act) => (
                              <tr key={act.activity} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-2 font-medium text-slate-700 sticky left-0 bg-white">{act.activity}</td>
                                {activeMonths.map(m => {
                                  const h = act.months[m.idx];
                                  const pct = (h / maxAct) * 100;
                                  return (
                                    <td key={m.idx} className="px-2 py-2 text-center">
                                      {h > 0 ? (
                                        <div className="flex flex-col items-center gap-0.5">
                                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.max(pct, 3)}%` }} />
                                          </div>
                                          <span className="text-xs text-slate-600">{fmt(h)}</span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-300">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2 text-center font-bold text-slate-800 bg-slate-50">{fmt(act.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-slate-300 bg-slate-50">
                              <td className="px-4 py-2 font-bold text-slate-700 sticky left-0 bg-slate-50">{t("financial.total")}</td>
                              {activeMonths.map(m => {
                                const tot = activities.reduce((s, a) => s + a.months[m.idx], 0);
                                return <td key={m.idx} className="px-2 py-2 text-center font-bold text-slate-700">{fmt(tot)}</td>;
                              })}
                              <td className="px-3 py-2 text-center font-bold text-orange-600 bg-slate-100">
                                {fmt(activities.reduce((s, a) => s + a.total, 0))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </>
      )}

      {activeTab === "leveringen" && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <Filter size={16} className="text-slate-400" />
            <CompanySelect value={company} onChange={setCompany} />
          </div>

          {loadingDN ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> {t("financieel_dashboard.deliveries_loading")}
            </div>
          ) : dnStats ? (
            <div className="space-y-6">
              {/* KPI Cards - Period breakdown */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-y-teal/10 rounded-lg"><Package className="text-y-teal" size={20} /></div>
                    <p className="text-sm text-slate-500">{t("financial.this_month")}</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{dnStats.thisMonthCount}</p>
                  <p className="text-sm text-slate-500 mt-1">{euro(dnStats.thisMonthValue)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-violet-100 rounded-lg"><Package className="text-violet-600" size={20} /></div>
                    <p className="text-sm text-slate-500">{t("financieel_dashboard.this_quarter")}</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{dnStats.thisQuarterCount}</p>
                  <p className="text-sm text-slate-500 mt-1">{euro(dnStats.thisQuarterValue)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-amber-100 rounded-lg"><Package className="text-amber-600" size={20} /></div>
                    <p className="text-sm text-slate-500">{t("financieel_dashboard.this_year")}</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{dnStats.thisYearCount}</p>
                  <p className="text-sm text-slate-500 mt-1">{euro(dnStats.thisYearValue)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-emerald-100 rounded-lg"><TrendingUp className="text-emerald-600" size={20} /></div>
                    <p className="text-sm text-slate-500">{t("financial.total_all_time")}</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{dnStats.totalCount}</p>
                  <p className="text-sm text-slate-500 mt-1">{euro(dnStats.totalValue)}</p>
                </div>
              </div>

              {/* Status breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2 mb-4">
                  <FileText size={18} className="text-y-teal" />
                  {t("financial.status_distribution")}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {dnStats.statusBreakdown.map((s) => {
                    const colors: Record<string, string> = {
                      Draft: "bg-slate-100 text-slate-600 border-slate-200",
                      "To Bill": "bg-orange-50 text-orange-700 border-orange-200",
                      Completed: "bg-green-50 text-green-700 border-green-200",
                      Cancelled: "bg-red-50 text-red-700 border-red-200",
                      "Return Issued": "bg-purple-50 text-purple-700 border-purple-200",
                    };
                    const cls = colors[s.status] || "bg-slate-50 text-slate-600 border-slate-200";
                    return (
                      <div key={s.status} className={`rounded-lg border p-4 ${cls}`}>
                        <p className="text-sm font-medium mb-1">{s.status}</p>
                        <p className="text-2xl font-bold">{s.count}</p>
                        <p className="text-xs opacity-75 mt-1">{euro(s.total)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly trend bar chart */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                    <TrendingUp size={18} className="text-y-teal" />
                    {t("financial.deliveries_per_month")}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-y-teal/60 rounded-sm" /> {t("financieel_dashboard.legend_value")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-violet-400 rounded-sm" /> {t("financieel_dashboard.legend_count")}
                    </span>
                  </div>
                </div>
                {dnStats.monthlyTrend.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400">{t("financial.no_data")}</div>
                ) : (() => {
                  const maxVal = Math.max(...dnStats.monthlyTrend.map(d => d.total), 1);
                  const maxCnt = Math.max(...dnStats.monthlyTrend.map(d => d.count), 1);
                  return (
                    <div className="flex items-end gap-1" style={{ height: "256px" }}>
                      {dnStats.monthlyTrend.map((d) => {
                        const hPct = (d.total / maxVal) * 100;
                        return (
                          <div key={d.month} className="flex-1 flex flex-col items-center justify-end h-full group">
                            <div className="relative w-full flex justify-center mb-1" style={{ height: "calc(100% - 24px)" }}>
                              <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                <div>{t("financieel_dashboard.deliveries_count", { count: d.count })}</div>
                                <div>{euro(d.total)}</div>
                              </div>
                              <div className="w-full max-w-[40px] h-full flex flex-col justify-end relative">
                                <div
                                  className="w-full bg-y-teal/40 rounded-t"
                                  style={{ height: `${Math.max(hPct, d.total > 0 ? 2 : 0)}%` }}
                                />
                                {/* Count indicator dot */}
                                <div
                                  className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-violet-500 rounded-full border border-white"
                                  style={{ bottom: `${(d.count / maxCnt) * 85}%` }}
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400 whitespace-nowrap mt-1">{d.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Top customers */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                  <Users size={18} className="text-y-teal" />
                  <h3 className="text-base font-semibold text-slate-700">{t("financieel_dashboard.top_customers_title")}</h3>
                </div>
                {dnStats.topCustomers.length === 0 ? (
                  <div className="px-6 py-12 text-center text-slate-400">{t("financial.no_customer_data")}</div>
                ) : (() => {
                  const maxCust = Math.max(...dnStats.topCustomers.map(c => c.count), 1);
                  const maxCustVal = Math.max(...dnStats.topCustomers.map(c => c.total), 1);
                  return (
                    <div className="divide-y divide-slate-100">
                      {dnStats.topCustomers.map((c, i) => (
                        <div key={c.customer} className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50">
                          <span className="text-sm font-bold text-slate-400 w-6 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700 truncate" title={c.customer}>{c.customer}</span>
                              <div className="flex items-center gap-3 text-sm text-slate-500 ml-2 shrink-0">
                                <span>{t("financieel_dashboard.deliveries_count", { count: c.count })}</span>
                                <span className="font-semibold text-slate-700">{euro(c.total)}</span>
                              </div>
                            </div>
                            <div className="flex gap-1 h-2">
                              <div className="h-full bg-y-teal/40 rounded-full" style={{ width: `${(c.count / maxCust) * 60}%` }} />
                              <div className="h-full bg-emerald-400/60 rounded-full" style={{ width: `${(c.total / maxCustVal) * 40}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Detail modal */}
      {(urenDetail || loadingDetail) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !loadingDetail && setUrenDetail(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {loadingDetail ? (
              <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin" /> {t("financieel_dashboard.detail_loading")}
              </div>
            ) : urenDetail && (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{urenDetail.employee}</h3>
                    <p className="text-sm text-slate-500">{t(MONTH_LABELS_KEYS[urenDetail.month])} {urenDetail.year} — {fmt(urenDetail.totalHours)} {t("financial.hours_unit")}, {urenDetail.billablePercent}% {t("financial.billable_percent")}</p>
                  </div>
                  <button onClick={() => setUrenDetail(null)} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer">
                    <X size={18} className="text-slate-500" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  {/* ── Project samenvatting ── */}
                  {(() => {
                    const projSummary = new Map<string, { hours: number; billable: number }>();
                    for (const log of urenDetail.logs) {
                      const key = log.project || t("financieel_dashboard.no_project");
                      const cur = projSummary.get(key) || { hours: 0, billable: 0 };
                      cur.hours += log.hours;
                      if (log.isBillable) cur.billable += log.hours;
                      projSummary.set(key, cur);
                    }
                    const projects = Array.from(projSummary.entries()).sort((a, b) => b[1].hours - a[1].hours);
                    const maxH = Math.max(...projects.map(([, v]) => v.hours), 1);
                    return (
                      <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                        <p className="text-xs font-semibold text-slate-500 mb-2">{t("financieel_dashboard.hours_per_project")}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {projects.map(([proj, data]) => {
                            const pct = data.hours > 0 ? (data.billable / data.hours) * 100 : 0;
                            return (
                              <div key={proj} className="flex items-center gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between text-xs mb-0.5">
                                    <span className="text-slate-700 font-medium truncate max-w-[180px]" title={proj}>{proj}</span>
                                    <span className="text-slate-500 ml-2 whitespace-nowrap">{t("financieel_dashboard.hours_unit_value", { value: fmt(data.hours) })}
                                      {data.billable > 0 && <span className="text-emerald-600 ml-1">({t("financieel_dashboard.billable_fact_short", { value: fmt(data.billable) })})</span>}
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full flex">
                                      <div className="h-full bg-emerald-500" style={{ width: `${(data.billable / maxH) * 100}%` }} />
                                      <div className="h-full bg-y-teal/30" style={{ width: `${((data.hours - data.billable) / maxH) * 100}%` }} />
                                    </div>
                                  </div>
                                </div>
                                <span className={`text-xs font-bold min-w-[32px] text-right ${pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-500"}`}>
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {/* ── Detail regels ── */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">{t("common.date")}</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">{t("tasks.detail.project")}</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">{t("financieel_dashboard.activity")}</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">{t("projects.toc.hours")}</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-slate-600">{t("financieel_dashboard.billable")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {urenDetail.logs.map((log, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-600 font-mono text-xs">{log.date}</td>
                          <td className="px-4 py-2 text-slate-700">{log.project || <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-2 text-slate-500 text-xs">{log.activity || "—"}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-700">{fmt(log.hours)}</td>
                          <td className="px-4 py-2 text-center">
                            {log.isBillable ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">{t("financieel_dashboard.yes")}</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">{t("financieel_dashboard.no")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50">
                        <td className="px-4 py-2 font-bold text-slate-700" colSpan={3}>{t("financial.total")}</td>
                        <td className="px-4 py-2 text-right font-bold font-mono text-slate-800">{fmt(urenDetail.totalHours)}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`text-sm font-bold ${urenDetail.billablePercent >= 70 ? "text-emerald-600" : urenDetail.billablePercent >= 40 ? "text-amber-600" : "text-red-500"}`}>
                            {urenDetail.billablePercent}%
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Klanten tab — projecten per klant per jaar ─── */}
      {activeTab === "klanten" && (
        <>
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <Filter size={16} className="text-slate-400" />
            <CompanySelect value={company} onChange={setCompany} />
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className="text-xs">{t("common.from", { defaultValue: "Van" })}</span>
              <input
                type="number" min="2000" max="2099" value={klantenYearFrom}
                onChange={(e) => setKlantenYearFrom(Number(e.target.value) || klantenYearFrom)}
                className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className="text-xs">{t("common.to", { defaultValue: "T/m" })}</span>
              <input
                type="number" min="2000" max="2099" value={klantenYearTo}
                onChange={(e) => setKlantenYearTo(Number(e.target.value) || klantenYearTo)}
                className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
            </label>
            <input
              type="search"
              placeholder={t("financieel_dashboard.search_customer", { defaultValue: "Zoek klant..." })}
              value={klantenSearch}
              onChange={(e) => setKlantenSearch(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal min-w-[200px]"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            {loadingKlanten ? (
              <div className="py-12 text-center text-slate-400">{t("common.loading")}</div>
            ) : klantenMatrix.customers.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                {t("financieel_dashboard.no_data", { defaultValue: "Geen projecten gevonden in deze periode" })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50 min-w-[200px]">
                        {t("financieel_dashboard.customer", { defaultValue: "Klant" })}
                      </th>
                      {klantenMatrix.years.map((y) => (
                        <th key={y} className="text-right px-3 py-2 text-xs font-semibold text-slate-600 min-w-[80px]">{y}</th>
                      ))}
                      <th className="text-right px-4 py-2 text-xs font-semibold text-y-teal-dark bg-y-teal/5 min-w-[90px]">
                        {t("common.total", { defaultValue: "Totaal" })}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {klantenMatrix.customers.map((row) => (
                      <tr key={row.customer} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-700 sticky left-0 bg-white hover:bg-slate-50 font-medium">{row.customerLabel}</td>
                        {klantenMatrix.years.map((y) => {
                          const v = row.perYear.get(y) || 0;
                          return (
                            <td key={y} className={`text-right px-3 py-2 ${v === 0 ? "text-slate-300" : "text-slate-700"}`}>
                              {v || "—"}
                            </td>
                          );
                        })}
                        <td className="text-right px-4 py-2 font-semibold text-y-teal-dark bg-y-teal/5">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                      <td className="px-4 py-2 sticky left-0 bg-slate-50 text-slate-700">
                        {t("common.total", { defaultValue: "Totaal" })}
                      </td>
                      {klantenMatrix.years.map((y) => (
                        <td key={y} className="text-right px-3 py-2 text-slate-700">{klantenMatrix.yearTotals.get(y) || 0}</td>
                      ))}
                      <td className="text-right px-4 py-2 text-y-teal-dark bg-y-teal/10">{klantenMatrix.grandTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Omzet per klant tab — revenue matrix, configurable granularity ─── */}
      {activeTab === "omzet-klant" && (
        <>
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <Filter size={16} className="text-slate-400" />
            <CompanySelect value={company} onChange={setCompany} />
            <select
              value={omzetGranularity}
              onChange={(e) => setOmzetGranularity(e.target.value as OmzetGranularity)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            >
              <option value="week">{t("financieel_dashboard.gran_week", { defaultValue: "Per week" })}</option>
              <option value="month">{t("financieel_dashboard.gran_month", { defaultValue: "Per maand" })}</option>
              <option value="quarter">{t("financieel_dashboard.gran_quarter", { defaultValue: "Per kwartaal" })}</option>
              <option value="year">{t("financieel_dashboard.gran_year", { defaultValue: "Per jaar" })}</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className="text-xs">{t("common.from", { defaultValue: "Van" })}</span>
              <input
                type="date" value={omzetFrom}
                onChange={(e) => setOmzetFrom(e.target.value)}
                className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className="text-xs">{t("common.to", { defaultValue: "T/m" })}</span>
              <input
                type="date" value={omzetTo}
                onChange={(e) => setOmzetTo(e.target.value)}
                className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
            </label>
            <input
              type="search"
              placeholder={t("financieel_dashboard.search_customer", { defaultValue: "Zoek klant..." })}
              value={omzetSearch}
              onChange={(e) => setOmzetSearch(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal min-w-[200px]"
            />
            <span className="text-xs text-slate-400 ml-auto">
              {t("financieel_dashboard.amounts_excl_vat", { defaultValue: "Bedragen excl. BTW" })}
            </span>
          </div>

          {!loadingOmzet && omzetDraft.hasDrafts && (
            <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
              <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900 rounded">
                {t("invoice_draft.badge")}
              </span>
              {t("invoice_draft.included", { count: omzetDraft.draftCount, amount: euro(omzetDraft.draftAmount) })}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            {loadingOmzet ? (
              <div className="py-12 text-center text-slate-400">{t("common.loading")}</div>
            ) : omzetMatrix.customers.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                {t("financieel_dashboard.no_data", { defaultValue: "Geen facturen in deze periode" })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50 min-w-[200px] z-10">
                        {t("financieel_dashboard.customer", { defaultValue: "Klant" })}
                      </th>
                      {omzetMatrix.buckets.map((b) => (
                        <th key={b.key} className="text-right px-3 py-2 text-xs font-semibold text-slate-600 min-w-[100px] whitespace-nowrap">{b.label}</th>
                      ))}
                      <th className="text-right px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 min-w-[110px]">
                        {t("common.total", { defaultValue: "Totaal" })}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {omzetMatrix.customers.map((row) => (
                      <tr key={row.customer} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-700 sticky left-0 bg-white hover:bg-slate-50 font-medium z-10">{row.customerLabel}</td>
                        {row.perBucket.map((v, i) => (
                          <td key={i} className={`text-right px-3 py-2 whitespace-nowrap ${v === 0 ? "text-slate-300" : "text-slate-700"}`}>
                            {v === 0 ? "—" : euro(v)}
                          </td>
                        ))}
                        <td className="text-right px-4 py-2 font-semibold text-emerald-700 bg-emerald-50 whitespace-nowrap">{euro(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                      <td className="px-4 py-2 sticky left-0 bg-slate-50 text-slate-700 z-10">
                        {t("common.total", { defaultValue: "Totaal" })}
                      </td>
                      {omzetMatrix.bucketTotals.map((v, i) => (
                        <td key={i} className="text-right px-3 py-2 text-slate-700 whitespace-nowrap">{v === 0 ? "—" : euro(v)}</td>
                      ))}
                      <td className="text-right px-4 py-2 text-emerald-700 bg-emerald-100 whitespace-nowrap">{euro(omzetMatrix.grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
