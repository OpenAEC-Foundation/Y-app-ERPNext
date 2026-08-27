import { useEffect, useState, useMemo } from "react";
import { fetchAll, getErpNextLinkUrl } from "../lib/erpnext";
import {
  TrendingUp, RefreshCw, Filter, ExternalLink, BarChart3, Hash,
} from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";
import {
  SALES_INVOICE_ACTIVE_FILTER,
  draftShare,
  isDraftInvoice,
} from "../lib/invoice-docstatus";

interface SalesInvoice {
  name: string;
  net_total: number;
  posting_date: string;
  customer_name: string;
  company: string;
  docstatus?: number;
}

interface MonthData {
  month: number;       // 0..11 (month-of-year for label lookup)
  year: number;        // actual year — periods can span multiple
  label: string;       // e.g. "Mei" or "Mei 2025" when period spans years
  count: number;
  revenue: number;
  /** Deel van `revenue` dat nog uit conceptfacturen komt (docstatus 0). */
  draftRevenue: number;
  prevRevenue: number;
  prevCount: number;
  cumRevenue: number;
  cumPrevRevenue: number;
}

type PeriodKind = "year" | "last_12_months" | "last_6_months" | "last_3_months" | "ytd" | "custom";

const MONTH_LABEL_KEYS = [
  "omzet.month_january","omzet.month_february","omzet.month_march",
  "omzet.month_april","omzet.month_may","omzet.month_june",
  "omzet.month_july","omzet.month_august","omzet.month_september",
  "omzet.month_october","omzet.month_november","omzet.month_december",
];

const euro = (value: number) =>
  value.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

const currentYear = new Date().getFullYear();
const yearOptions = [2022, 2023, 2024, 2025, 2026];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftYears(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y + delta, m - 1, d);
  return ymd(dt);
}

export default function Revenue() {
  const { t } = useTranslation();
  const [company, setCompany] = useState(getActiveCompany());
  const [periodKind, setPeriodKind] = useState<PeriodKind>("year");
  const [year, setYear] = useState(currentYear);
  const [customFrom, setCustomFrom] = useState<string>(() => `${currentYear}-01-01`);
  const [customTo, setCustomTo] = useState<string>(() => ymd(new Date()));
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [prevInvoices, setPrevInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve the current period (from/to dates) from the chosen kind.
  // Comparison period is always the same window shifted back one year so
  // YoY growth still makes sense for rolling/custom ranges.
  const { from, to, prevFrom, prevTo } = useMemo(() => {
    const today = new Date();
    const startOfMonth = (yr: number, mo: number) => new Date(yr, mo, 1);
    const endOfMonth = (yr: number, mo: number) => new Date(yr, mo + 1, 0);
    let f: string;
    let tt: string;
    switch (periodKind) {
      case "year":
        f = `${year}-01-01`;
        tt = `${year}-12-31`;
        break;
      case "last_12_months":
        f = ymd(startOfMonth(today.getFullYear(), today.getMonth() - 11));
        tt = ymd(endOfMonth(today.getFullYear(), today.getMonth()));
        break;
      case "last_6_months":
        f = ymd(startOfMonth(today.getFullYear(), today.getMonth() - 5));
        tt = ymd(endOfMonth(today.getFullYear(), today.getMonth()));
        break;
      case "last_3_months":
        f = ymd(startOfMonth(today.getFullYear(), today.getMonth() - 2));
        tt = ymd(endOfMonth(today.getFullYear(), today.getMonth()));
        break;
      case "ytd":
        f = `${today.getFullYear()}-01-01`;
        tt = ymd(today);
        break;
      case "custom":
        f = customFrom;
        tt = customTo;
        break;
    }
    return { from: f, to: tt, prevFrom: shiftYears(f, -1), prevTo: shiftYears(tt, -1) };
  }, [periodKind, year, customFrom, customTo]);

  // Build the list of months in the period (zero-buckets that the chart and
  // table will iterate over). Works across year boundaries (e.g. last-12mo
  // starting in Aug 2025 → 12 buckets through Jul 2026).
  const periodMonths = useMemo(() => {
    if (!from || !to) return [] as { year: number; month: number; label: string }[];
    const start = new Date(from);
    const end = new Date(to);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
    const spansYears = start.getFullYear() !== end.getFullYear();
    const list: { year: number; month: number; label: string }[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const stop = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= stop) {
      const baseLabel = t(MONTH_LABEL_KEYS[cur.getMonth()]);
      list.push({
        year: cur.getFullYear(),
        month: cur.getMonth(),
        label: spansYears ? `${baseLabel.slice(0, 3)} '${String(cur.getFullYear()).slice(-2)}` : baseLabel,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return list;
  }, [from, to, t]);

  async function loadData() {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      // Concepten tellen mee, geannuleerde nooit — zie lib/invoice-docstatus.ts.
      // Op instances waar facturen lang in concept blijven staan zou
      // `docstatus = 1` het hele omzetoverzicht leeg laten.
      const baseFilters: unknown[][] = [
        SALES_INVOICE_ACTIVE_FILTER,
      ];
      if (company) baseFilters.push(["company", "=", company]);

      const currentFilters: unknown[][] = [
        ...baseFilters,
        ["posting_date", ">=", from],
        ["posting_date", "<=", to],
      ];

      const prevFilters: unknown[][] = [
        ...baseFilters,
        ["posting_date", ">=", prevFrom],
        ["posting_date", "<=", prevTo],
      ];

      const fields: string[] = ["name", "net_total", "posting_date", "customer_name", "company", "docstatus"];

      const [current, prev] = await Promise.all([
        fetchAll<SalesInvoice>(
          "Sales Invoice",
          fields,
          currentFilters,
          "posting_date asc"
        ),
        fetchAll<SalesInvoice>(
          "Sales Invoice",
          fields,
          prevFilters,
          "posting_date asc"
        ),
      ]);

      setInvoices(current);
      setPrevInvoices(prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [company, from, to]);

  // Monthly data — driven by the chosen period (1 ≤ N ≤ ~24 buckets).
  // Comparison year is matched by month-of-year + (year - 1) so each bucket
  // pairs with the equivalent month one year earlier, regardless of whether
  // the period spans a year boundary.
  const monthlyData = useMemo<MonthData[]>(() => {
    const months: MonthData[] = periodMonths.map((p) => ({
      month: p.month,
      year: p.year,
      label: p.label,
      count: 0,
      revenue: 0,
      draftRevenue: 0,
      prevRevenue: 0,
      prevCount: 0,
      cumRevenue: 0,
      cumPrevRevenue: 0,
    }));

    // Index by `${year}-${month}` for O(1) bucket lookup.
    const indexBy = new Map<string, MonthData>();
    for (const m of months) indexBy.set(`${m.year}-${m.month}`, m);

    for (const inv of invoices) {
      const d = new Date(inv.posting_date);
      const bucket = indexBy.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (bucket) {
        bucket.count++;
        bucket.revenue += inv.net_total;
        if (isDraftInvoice(inv)) bucket.draftRevenue += inv.net_total;
      }
    }

    // Prev-year invoices are bucketed by (year + 1) so they align with the
    // current-period bucket of the same month-of-year.
    for (const inv of prevInvoices) {
      const d = new Date(inv.posting_date);
      const bucket = indexBy.get(`${d.getFullYear() + 1}-${d.getMonth()}`);
      if (bucket) {
        bucket.prevCount++;
        bucket.prevRevenue += inv.net_total;
      }
    }

    // Running totals — reset at the start of the period (NOT calendar year).
    let runCur = 0;
    let runPrev = 0;
    for (const m of months) {
      runCur += m.revenue;
      runPrev += m.prevRevenue;
      m.cumRevenue = runCur;
      m.cumPrevRevenue = runPrev;
    }

    return months;
  }, [invoices, prevInvoices, periodMonths]);

  // KPIs
  const totalRevenue = invoices.reduce((s, i) => s + i.net_total, 0);
  const prevTotalRevenue = prevInvoices.reduce((s, i) => s + i.net_total, 0);
  // Conceptdeel apart houden: het telt mee in `totalRevenue`, maar de gebruiker
  // moet kunnen zien hoeveel daarvan nog niet ingeboekt is.
  const draft = useMemo(() => draftShare(invoices, (i) => i.net_total), [invoices]);
  const activeMonths = monthlyData.filter((m) => m.revenue > 0).length;
  const avgPerMonth = activeMonths > 0 ? totalRevenue / activeMonths : 0;
  const growthPct = prevTotalRevenue > 0
    ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100
    : 0;

  const maxBarValue = Math.max(
    ...monthlyData.map((m) => Math.max(m.revenue, m.prevRevenue)),
    1
  );

  // Human-readable period label used by KPI cards, legend, table headers,
  // and tooltips. Keeps year-mode terse ("2026") and shows the date range
  // for everything else so the comparison column is unambiguous.
  const periodLabel = useMemo(() => {
    switch (periodKind) {
      case "year": return String(year);
      case "ytd": return t("revenue.period_ytd", { defaultValue: "YTD" });
      case "last_12_months": return t("revenue.period_last_12", { defaultValue: "Laatste 12 mnd" });
      case "last_6_months": return t("revenue.period_last_6", { defaultValue: "Laatste 6 mnd" });
      case "last_3_months": return t("revenue.period_last_3", { defaultValue: "Laatste 3 mnd" });
      case "custom": return `${from} — ${to}`;
    }
  }, [periodKind, year, from, to, t]);

  const prevPeriodLabel = useMemo(() => {
    if (periodKind === "year") return String(year - 1);
    return `${prevFrom} — ${prevTo}`;
  }, [periodKind, year, prevFrom, prevTo]);

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <TrendingUp className="text-emerald-600" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t("omzet.title")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${getErpNextLinkUrl()}/sales-invoice`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <ExternalLink size={14} /> ERPNext
          </a>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* Concept-facturen tellen mee in alle cijfers op deze pagina — expliciet
          benoemen zodat een conceptbedrag niet voor definitieve omzet doorgaat. */}
      {!loading && draft.hasDrafts && (
        <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900 rounded">
            {t("invoice_draft.badge")}
          </span>
          {t("invoice_draft.included", { count: draft.draftCount, amount: euro(draft.draftAmount) })}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <Filter size={16} className="text-slate-400" />
        <CompanySelect value={company} onChange={setCompany} />
        <select
          value={periodKind}
          onChange={(e) => setPeriodKind(e.target.value as PeriodKind)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          <option value="year">{t("revenue.period_full_year", { defaultValue: "Volledig jaar" })}</option>
          <option value="ytd">{t("revenue.period_ytd_full", { defaultValue: "Year-to-date" })}</option>
          <option value="last_12_months">{t("revenue.period_last_12", { defaultValue: "Laatste 12 maanden" })}</option>
          <option value="last_6_months">{t("revenue.period_last_6", { defaultValue: "Laatste 6 maanden" })}</option>
          <option value="last_3_months">{t("revenue.period_last_3", { defaultValue: "Laatste 3 maanden" })}</option>
          <option value="custom">{t("revenue.period_custom", { defaultValue: "Aangepast..." })}</option>
        </select>

        {/* Year selector — only relevant for "full year" mode */}
        {periodKind === "year" && (
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}

        {/* Custom date inputs */}
        {periodKind === "custom" && (
          <>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className="text-xs">{t("common.from", { defaultValue: "Van" })}</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className="text-xs">{t("common.to", { defaultValue: "T/m" })}</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
            </label>
          </>
        )}

        {/* Compact summary of the selected window */}
        <span className="text-xs text-slate-400 ml-1">
          {from} — {to}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <TrendingUp className="text-emerald-600" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("omzet.total_revenue_year", { year: periodLabel })}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {loading ? "..." : euro(totalRevenue)}
          </p>
          {!loading && draft.hasDrafts && (
            <p className="text-xs text-amber-700 mt-1">
              {t("invoice_draft.of_which", { amount: euro(draft.draftAmount) })}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-y-teal/10 rounded-lg">
              <BarChart3 className="text-y-teal" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("omzet.avg_per_month")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {loading ? "..." : euro(avgPerMonth)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Hash className="text-purple-600" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("omzet.invoice_count")}</p>
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {loading ? "..." : invoices.length}
          </p>
          {!loading && draft.hasDrafts && (
            <p className="text-xs text-amber-700 mt-1">
              {t("invoice_draft.of_which_count", { count: draft.draftCount })}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="text-orange-600" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("omzet.growth_vs_year", { year: prevPeriodLabel })}</p>
          </div>
          <p className={`text-3xl font-bold ${growthPct >= 0 ? "text-green-600" : "text-red-600"}`}>
            {loading
              ? "..."
              : prevTotalRevenue === 0
                ? t("omzet.not_applicable")
                : `${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(1)}%`}
          </p>
          {!loading && prevTotalRevenue > 0 && (
            <p className="text-xs text-slate-400 mt-1">
              {prevPeriodLabel}: {euro(prevTotalRevenue)}
            </p>
          )}
        </div>
      </div>

      {/* Bar Chart with cumulative-revenue line overlay */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-700">{t("revenue.monthly_revenue_excl_vat")}</h3>
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-y-teal rounded" /> {periodLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-slate-200 rounded" /> {prevPeriodLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-emerald-500 inline-block" /> {t("revenue.cumulative", { defaultValue: "Cumulatief" })} {periodLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-slate-400 inline-block" style={{ borderTop: "1px dashed" }} /> {t("revenue.cumulative", { defaultValue: "Cumulatief" })} {prevPeriodLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-orange-500 inline-block" style={{ borderTop: "1px dashed" }} /> {t("revenue.monthly_avg", { defaultValue: "Gemiddeld/maand" })}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-56 flex items-center justify-center text-slate-400">{t("common.loading")}</div>
        ) : (
          (() => {
            // Separate scale for cumulative line so the line uses the full
            // chart height instead of being dwarfed by single-month bars.
            const maxCum = Math.max(
              ...monthlyData.map(m => Math.max(m.cumRevenue, m.cumPrevRevenue)),
              1
            );
            // SVG viewBox is 0..1200 wide × 0..100 tall. Column centers
            // distribute evenly across N months for the active period (N can
            // be 1..24 depending on the picker — `Volledig jaar` → 12,
            // `Laatste 3 maanden` → 3, `Aangepast` → range-dependent).
            const N = Math.max(monthlyData.length, 1);
            const colWidth = 1200 / N;
            const pointX = (i: number) => colWidth * (i + 0.5);
            const pointY = (val: number) => 100 - (val / maxCum) * 100;
            const linePath = (key: "cumRevenue" | "cumPrevRevenue") =>
              monthlyData
                .map((m, i) => `${i === 0 ? "M" : "L"} ${pointX(i)} ${pointY(m[key])}`)
                .join(" ");

            return (
              <div className="relative h-56">
                <div className="flex items-end gap-2 h-56">
                  {monthlyData.map((m, i) => (
                    <div key={`${m.year}-${m.month}-${i}`} className="flex-1 flex flex-col items-center justify-end group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-20 bg-slate-800 text-white text-xs px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 leading-tight">
                        <div>{m.label} ({m.year}): {euro(m.revenue)}</div>
                        {m.draftRevenue > 0 && (
                          <div className="text-amber-300">
                            {t("invoice_draft.of_which", { amount: euro(m.draftRevenue) })}
                          </div>
                        )}
                        <div>{m.label} ({m.year - 1}): {euro(m.prevRevenue)}</div>
                        <div className="border-t border-slate-600 mt-1 pt-1">
                          {t("revenue.cumulative", { defaultValue: "Cumulatief" })}: {euro(m.cumRevenue)}
                        </div>
                        <div>
                          {t("revenue.cumulative", { defaultValue: "Cumulatief" })} {prevPeriodLabel}: {euro(m.cumPrevRevenue)}
                        </div>
                        {avgPerMonth > 0 && (
                          <div className="border-t border-slate-600 mt-1 pt-1">
                            {t("revenue.monthly_avg", { defaultValue: "Gemiddeld/maand" })}: {euro(avgPerMonth)}
                          </div>
                        )}
                      </div>

                      {/* Bars container */}
                      <div className="w-full flex items-end justify-center gap-0.5 h-44">
                        <div
                          className="w-[45%] bg-slate-200 rounded-t transition-all hover:bg-slate-300"
                          style={{ height: `${Math.max((m.prevRevenue / maxBarValue) * 100, m.prevRevenue > 0 ? 2 : 0)}%` }}
                        />
                        <div
                          className="w-[45%] bg-y-teal rounded-t transition-all hover:bg-y-teal"
                          style={{ height: `${Math.max((m.revenue / maxBarValue) * 100, m.revenue > 0 ? 2 : 0)}%` }}
                        />
                      </div>

                      <span className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">{m.label}</span>
                    </div>
                  ))}
                </div>

                {/* Monthly-average reference line — uses the BAR scale
                    (maxBarValue), not the cumulative scale, so it lines up
                    with the bar heights and you can see which months
                    over/underperformed against the year's average. */}
                {avgPerMonth > 0 && (
                  <svg
                    viewBox="0 0 1200 100"
                    preserveAspectRatio="none"
                    className="absolute left-0 right-0 top-0 pointer-events-none"
                    style={{ width: "100%", height: "176px" }}
                  >
                    <line
                      x1="0"
                      x2="1200"
                      y1={100 - (avgPerMonth / maxBarValue) * 100}
                      y2={100 - (avgPerMonth / maxBarValue) * 100}
                      stroke="rgb(249 115 22)"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )}

                {/* Cumulative-line overlay. Pointer-events-none so the bar
                    hover tooltips below remain interactive. Height matches
                    the bars area (h-44 ≈ 176px out of 224px = 78%). */}
                <svg
                  viewBox="0 0 1200 100"
                  preserveAspectRatio="none"
                  className="absolute left-0 right-0 top-0 pointer-events-none"
                  style={{ width: "100%", height: "176px" }}
                >
                  {/* Previous year cumulative (dashed grey) */}
                  <path
                    d={linePath("cumPrevRevenue")}
                    fill="none"
                    stroke="rgb(148 163 184)"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Current year cumulative (solid emerald) */}
                  <path
                    d={linePath("cumRevenue")}
                    fill="none"
                    stroke="rgb(16 185 129)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Dots on the current-year line at each month */}
                  {monthlyData.map((m, i) => (
                    <circle
                      key={m.month}
                      cx={pointX(i)}
                      cy={pointY(m.cumRevenue)}
                      r="3"
                      fill="rgb(16 185 129)"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
              </div>
            );
          })()
        )}
      </div>

      {/* Monthly table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-600">{t("omzet.overview_per_month")}</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">{t("omzet.col_month")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{t("omzet.col_invoice_count")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{t("omzet.col_revenue_year", { year: periodLabel })}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{t("omzet.col_revenue_year", { year: prevPeriodLabel })}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{t("omzet.col_diff_pct")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-700 bg-emerald-50/50">{t("revenue.cumulative", { defaultValue: "Cumulatief" })}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{t("revenue.cumulative", { defaultValue: "Cumulatief" })} {prevPeriodLabel}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td>
              </tr>
            ) : (
              <>
                {monthlyData.map((m, i) => {
                  const diff = m.prevRevenue > 0
                    ? ((m.revenue - m.prevRevenue) / m.prevRevenue) * 100
                    : null;
                  return (
                    <tr key={`${m.year}-${m.month}-${i}`} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">{m.label}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">{m.count}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">
                        {euro(m.revenue)}
                        {m.draftRevenue > 0 && (
                          <span className="block text-[11px] font-normal text-amber-700">
                            {t("invoice_draft.of_which", { amount: euro(m.draftRevenue) })}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 text-right">
                        {euro(m.prevRevenue)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {diff === null ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <span className={diff >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                            {diff >= 0 ? "+" : ""}{diff.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right bg-emerald-50/30">
                        {euro(m.cumRevenue)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 text-right">
                        {euro(m.cumPrevRevenue)}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3 text-sm text-slate-800">{t("omzet.total")}</td>
                  <td className="px-4 py-3 text-sm text-slate-800 text-right">{invoices.length}</td>
                  <td className="px-4 py-3 text-sm text-slate-800 text-right">
                    {euro(totalRevenue)}
                    {draft.hasDrafts && (
                      <span className="block text-[11px] font-normal text-amber-700">
                        {t("invoice_draft.of_which", { amount: euro(draft.draftAmount) })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">{euro(prevTotalRevenue)}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    {prevTotalRevenue > 0 ? (
                      <span className={growthPct >= 0 ? "text-green-600" : "text-red-600"}>
                        {growthPct >= 0 ? "+" : ""}{growthPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right bg-emerald-50/30">
                    {euro(totalRevenue)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">
                    {euro(prevTotalRevenue)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
