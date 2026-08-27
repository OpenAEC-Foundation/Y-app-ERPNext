import { useEffect, useState, useMemo } from "react";
import { fetchAll } from "../lib/erpnext";
import {
  TrendingUp,
  RefreshCw,
  Filter,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
} from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";
import {
  SALES_INVOICE_FINAL_FILTER,
  SALES_INVOICE_DRAFT_FILTER,
} from "../lib/invoice-docstatus";

/* ── Types ────────────────────────────────────────────────────── */

interface SalesInvoice {
  name: string;
  outstanding_amount: number;
  due_date: string;
  posting_date: string;
  status: string;
  company: string;
}

interface PurchaseInvoice {
  name: string;
  outstanding_amount: number;
  due_date: string;
  posting_date: string;
  status: string;
  company: string;
}

interface SalesOrder {
  name: string;
  grand_total: number;
  delivery_date: string;
  status: string;
  company: string;
  advance_paid: number;
}

interface WeekBucket {
  weekLabel: string;
  weekStart: Date;
  income: number;
  expenses: number;
  net: number;
  runningBalance: number;
}

/* ── Helpers ──────────────────────────────────────────────────── */

const euro = (value: number) =>
  value.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

function getMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addWeeks(d: Date, weeks: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + weeks * 7);
  return copy;
}

function formatWeekLabel(d: Date): string {
  const day = d.getDate().toString().padStart(2, "0");
  const months = [
    "jan", "feb", "mrt", "apr", "mei", "jun",
    "jul", "aug", "sep", "okt", "nov", "dec",
  ];
  return `${day} ${months[d.getMonth()]}`;
}

function parseDate(s: string): Date {
  const d = new Date(s + "T12:00:00");
  return d;
}

function weekIndex(date: Date, weekStarts: Date[]): number {
  for (let i = weekStarts.length - 1; i >= 0; i--) {
    if (date >= weekStarts[i]) return i;
  }
  return 0;
}

/* ── SVG Chart ────────────────────────────────────────────────── */

function CashFlowChart({ weeks }: { weeks: WeekBucket[] }) {
  const { t } = useTranslation();
  if (weeks.length === 0)
    return (
      <div className="h-72 flex items-center justify-center text-slate-400">
        {t("financial.no_data")}
      </div>
    );

  const padding = { top: 30, right: 20, bottom: 50, left: 70 };
  const width = 900;
  const height = 320;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const allValues = weeks.flatMap((w) => [w.income, w.expenses, w.runningBalance]);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const barGroupWidth = chartW / weeks.length;
  const barWidth = Math.max(barGroupWidth * 0.3, 4);
  const gap = 3;

  const yScale = (v: number) =>
    padding.top + chartH - ((v - minVal) / range) * chartH;
  const zeroY = yScale(0);

  // Running balance line points
  const linePoints = weeks
    .map((w, i) => {
      const x = padding.left + i * barGroupWidth + barGroupWidth / 2;
      const y = yScale(w.runningBalance);
      return `${x},${y}`;
    })
    .join(" ");

  // Y-axis ticks (5 ticks)
  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) {
    yTicks.push(minVal + (range / 4) * i);
  }

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: string;
  } | null>(null);

  return (
    <div className="relative overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ minWidth: 600 }}
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={yScale(tick)}
              x2={width - padding.right}
              y2={yScale(tick)}
              stroke="#e2e8f0"
              strokeDasharray={tick === 0 ? "0" : "4,4"}
              strokeWidth={tick === 0 ? 1.5 : 0.5}
            />
            <text
              x={padding.left - 8}
              y={yScale(tick) + 4}
              textAnchor="end"
              className="text-[10px] fill-slate-400"
              style={{ fontSize: 10 }}
            >
              {tick >= 1000 || tick <= -1000
                ? `€${(tick / 1000).toFixed(0)}k`
                : `€${tick.toFixed(0)}`}
            </text>
          </g>
        ))}

        {/* Zero line highlight */}
        <line
          x1={padding.left}
          y1={zeroY}
          x2={width - padding.right}
          y2={zeroY}
          stroke="#94a3b8"
          strokeWidth={1}
        />

        {/* Bars */}
        {weeks.map((w, i) => {
          const groupX = padding.left + i * barGroupWidth;
          const centerX = groupX + barGroupWidth / 2;

          const incomeBarX = centerX - barWidth - gap / 2;
          const expenseBarX = centerX + gap / 2;

          const incomeTop = yScale(w.income);
          const incomeHeight = Math.abs(zeroY - incomeTop);

          const expenseTop = yScale(w.expenses);
          const expenseHeight = Math.abs(zeroY - expenseTop);

          return (
            <g key={i}>
              {/* Income bar */}
              <rect
                x={incomeBarX}
                y={Math.min(zeroY, incomeTop)}
                width={barWidth}
                height={Math.max(incomeHeight, 0)}
                rx={2}
                className="fill-emerald-400 hover:fill-emerald-500 cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGRectElement).getBoundingClientRect();
                  setTooltip({
                    x: rect.x + rect.width / 2,
                    y: rect.y,
                    content: `${t("liquiditeitsplanning.income")}: ${euro(w.income)}`,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              {/* Expense bar */}
              <rect
                x={expenseBarX}
                y={Math.min(zeroY, expenseTop)}
                width={barWidth}
                height={Math.max(expenseHeight, 0)}
                rx={2}
                className="fill-red-400 hover:fill-red-500 cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGRectElement).getBoundingClientRect();
                  setTooltip({
                    x: rect.x + rect.width / 2,
                    y: rect.y,
                    content: `${t("liquiditeitsplanning.expenses")}: ${euro(w.expenses)}`,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />

              {/* Week label */}
              <text
                x={centerX}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                className="fill-slate-500"
                style={{ fontSize: 9 }}
              >
                {w.weekLabel}
              </text>
            </g>
          );
        })}

        {/* Running balance line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#0d9488"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Balance dots */}
        {weeks.map((w, i) => {
          const x = padding.left + i * barGroupWidth + barGroupWidth / 2;
          const y = yScale(w.runningBalance);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={4}
              className="fill-white stroke-[#0d9488] cursor-pointer"
              strokeWidth={2}
              onMouseEnter={(e) => {
                const rect = (e.target as SVGCircleElement).getBoundingClientRect();
                setTooltip({
                  x: rect.x + rect.width / 2,
                  y: rect.y,
                  content: `${t("liquiditeitsplanning.balance")}: ${euro(w.runningBalance)}`,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}

        {/* Legend */}
        <rect x={padding.left} y={4} width={10} height={10} rx={2} className="fill-emerald-400" />
        <text x={padding.left + 14} y={13} style={{ fontSize: 10 }} className="fill-slate-600">
          {t("liquiditeitsplanning.income")}
        </text>
        <rect x={padding.left + 80} y={4} width={10} height={10} rx={2} className="fill-red-400" />
        <text x={padding.left + 94} y={13} style={{ fontSize: 10 }} className="fill-slate-600">
          {t("liquiditeitsplanning.expenses")}
        </text>
        <line
          x1={padding.left + 160}
          y1={9}
          x2={padding.left + 180}
          y2={9}
          stroke="#0d9488"
          strokeWidth={2.5}
        />
        <text x={padding.left + 184} y={13} style={{ fontSize: 10 }} className="fill-slate-600">
          {t("liquiditeitsplanning.running_balance")}
        </text>
      </svg>

      {/* Tooltip overlay */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-800 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y - 30, transform: "translateX(-50%)" }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function LiquidityPlanning() {
  const { t } = useTranslation();
  const [company, setCompany] = useState(getActiveCompany());
  const [startBalance, setStartBalance] = useState<number>(() => {
    const saved = localStorage.getItem("liquidity_start_balance");
    return saved ? parseFloat(saved) : 0;
  });
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  /** Concepten — NIET in de prognose, alleen als losse teller. */
  const [draftTotals, setDraftTotals] = useState<{ count: number; amount: number }>({ count: 0, amount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // De prognose rekent op DEFINITIEVE facturen: een concept is niet naar de
      // klant verstuurd, heeft dus geen afgesproken betaaltermijn, en het
      // onderliggende werk zit hier al in als Sales Order — meetellen zou
      // dubbeltellen. Het conceptbedrag wordt apart opgehaald en getoond.
      const siFilters: unknown[][] = [
        SALES_INVOICE_FINAL_FILTER,
        ["outstanding_amount", ">", 0],
      ];
      const piFilters: unknown[][] = [
        ["docstatus", "=", 1],
        ["outstanding_amount", ">", 0],
      ];
      const soFilters: unknown[][] = [
        ["docstatus", "=", 1],
        ["status", "not in", ["Closed", "Completed", "Cancelled"]],
      ];

      const draftSiFilters: unknown[][] = [SALES_INVOICE_DRAFT_FILTER];

      if (company) {
        siFilters.push(["company", "=", company]);
        piFilters.push(["company", "=", company]);
        soFilters.push(["company", "=", company]);
        draftSiFilters.push(["company", "=", company]);
      }

      const [si, pi, so, draftSi] = await Promise.all([
        fetchAll<SalesInvoice>(
          "Sales Invoice",
          ["name", "outstanding_amount", "due_date", "posting_date", "status", "company"],
          siFilters,
          "due_date asc"
        ),
        fetchAll<PurchaseInvoice>(
          "Purchase Invoice",
          ["name", "outstanding_amount", "due_date", "posting_date", "status", "company"],
          piFilters,
          "due_date asc"
        ),
        fetchAll<SalesOrder>(
          "Sales Order",
          ["name", "grand_total", "delivery_date", "status", "company", "advance_paid"],
          soFilters,
          "delivery_date asc"
        ),
        fetchAll<{ name: string; grand_total: number }>(
          "Sales Invoice",
          ["name", "grand_total"],
          draftSiFilters,
          "posting_date asc"
        ).catch(() => [] as { name: string; grand_total: number }[]),
      ]);

      setSalesInvoices(si);
      setPurchaseInvoices(pi);
      setSalesOrders(so);
      setDraftTotals({
        count: draftSi.length,
        amount: draftSi.reduce((s, d) => s + (d.grand_total || 0), 0),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [company]);

  // Persist start balance
  useEffect(() => {
    localStorage.setItem("liquidity_start_balance", String(startBalance));
  }, [startBalance]);

  /* ── Build 12-week forecast ──────────────────────────────────── */

  const weeks = useMemo<WeekBucket[]>(() => {
    const today = new Date();
    const thisMonday = getMonday(today);
    const weekStarts: Date[] = [];

    for (let i = 0; i < 12; i++) {
      weekStarts.push(addWeeks(thisMonday, i));
    }

    const buckets: WeekBucket[] = weekStarts.map((ws) => ({
      weekLabel: formatWeekLabel(ws),
      weekStart: ws,
      income: 0,
      expenses: 0,
      net: 0,
      runningBalance: 0,
    }));

    const endDate = addWeeks(thisMonday, 12);

    // Sales invoices -> income by due_date (or posting_date as fallback)
    for (const si of salesInvoices) {
      const dateStr = si.due_date || si.posting_date;
      if (!dateStr) continue;
      const d = parseDate(dateStr);
      if (d < thisMonday) {
        // Overdue: put in first week
        buckets[0].income += si.outstanding_amount;
      } else if (d < endDate) {
        const idx = weekIndex(d, weekStarts);
        buckets[idx].income += si.outstanding_amount;
      }
    }

    // Sales orders -> income by delivery_date (remaining amount)
    for (const so of salesOrders) {
      if (!so.delivery_date) continue;
      const remaining = so.grand_total - (so.advance_paid || 0);
      if (remaining <= 0) continue;
      const d = parseDate(so.delivery_date);
      if (d < thisMonday) {
        buckets[0].income += remaining;
      } else if (d < endDate) {
        const idx = weekIndex(d, weekStarts);
        buckets[idx].income += remaining;
      }
    }

    // Purchase invoices -> expenses by due_date
    for (const pi of purchaseInvoices) {
      const dateStr = pi.due_date || pi.posting_date;
      if (!dateStr) continue;
      const d = parseDate(dateStr);
      if (d < thisMonday) {
        buckets[0].expenses += pi.outstanding_amount;
      } else if (d < endDate) {
        const idx = weekIndex(d, weekStarts);
        buckets[idx].expenses += pi.outstanding_amount;
      }
    }

    // Calculate net and running balance
    let balance = startBalance;
    for (const b of buckets) {
      b.net = b.income - b.expenses;
      balance += b.net;
      b.runningBalance = balance;
    }

    return buckets;
  }, [salesInvoices, purchaseInvoices, salesOrders, startBalance]);

  /* ── KPIs ────────────────────────────────────────────────────── */

  const totalReceivables = useMemo(
    () => salesInvoices.reduce((s, si) => s + si.outstanding_amount, 0),
    [salesInvoices]
  );

  const totalPayables = useMemo(
    () => purchaseInvoices.reduce((s, pi) => s + pi.outstanding_amount, 0),
    [purchaseInvoices]
  );

  const netPosition = totalReceivables - totalPayables;

  const weeksUntilNegative = useMemo(() => {
    for (let i = 0; i < weeks.length; i++) {
      if (weeks[i].runningBalance < 0) return i + 1;
    }
    return null;
  }, [weeks]);

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-y-teal/10 rounded-lg">
            <TrendingUp className="text-y-teal" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">
            {t("liquiditeitsplanning.title")}
          </h2>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
          {t("common.refresh")}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Concepten zitten NIET in de prognose (geen betaaltermijn, en het werk
          telt al mee via de verkooporders) — wel zichtbaar maken. */}
      {!loading && draftTotals.count > 0 && (
        <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900 rounded">
            {t("invoice_draft.badge")}
          </span>
          {t("invoice_draft.not_counted", { count: draftTotals.count, amount: euro(draftTotals.amount) })}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <CompanySelect value={company} onChange={setCompany} />
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">{t("liquiditeitsplanning.start_balance_label")}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              €
            </span>
            <input
              type="number"
              value={startBalance}
              onChange={(e) => setStartBalance(parseFloat(e.target.value) || 0)}
              className="pl-7 pr-3 py-2 w-40 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal text-right"
              step="100"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <ArrowDownRight className="text-emerald-600" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("liquidity.outstanding_debtors")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {loading ? "..." : euro(totalReceivables)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-red-100 rounded-lg">
              <ArrowUpRight className="text-red-600" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("liquidity.outstanding_creditors")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {loading ? "..." : euro(totalPayables)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-y-teal/10 rounded-lg">
              <Wallet className="text-y-teal" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("liquiditeitsplanning.net_position")}</p>
          </div>
          <p
            className={`text-2xl font-bold ${
              netPosition >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {loading ? "..." : euro(netPosition)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="text-amber-600" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("liquidity.weeks_until_negative")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {loading
              ? "..."
              : weeksUntilNegative !== null
              ? (
                  <>
                    <span className="text-red-600">{weeksUntilNegative}</span>
                    <span className="text-base font-normal text-slate-400 ml-1">
                      {weeksUntilNegative === 1 ? t("liquidity.week_count") : t("liquidity.weeks_count")}
                    </span>
                  </>
                )
              : (
                  <span className="text-emerald-600 text-base font-medium">
                    {t("liquidity.not_within_12_weeks")}
                  </span>
                )}
          </p>
        </div>
      </div>

      {/* Cash Flow Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          {t("liquidity.cashflow_forecast")}
        </h3>
        {loading ? (
          <div className="h-72 flex items-center justify-center text-slate-400">
            {t("common.loading")}
          </div>
        ) : (
          <CashFlowChart weeks={weeks} />
        )}
      </div>

      {/* Week-by-week Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-600">
            {t("liquiditeitsplanning.week_overview")}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">
                  {t("liquiditeitsplanning.col_week")}
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">
                  {t("liquiditeitsplanning.col_expected_income")}
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">
                  {t("liquiditeitsplanning.col_expected_expenses")}
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">
                  {t("liquiditeitsplanning.col_net")}
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">
                  {t("liquiditeitsplanning.running_balance")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    {t("common.loading")}
                  </td>
                </tr>
              ) : weeks.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    {t("financial.no_data")}
                  </td>
                </tr>
              ) : (
                <>
                  {/* Start balance row */}
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-500 italic">
                      {t("liquiditeitsplanning.start_balance")}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-slate-400">
                      —
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-slate-400">
                      —
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-slate-400">
                      —
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-right text-slate-700">
                      {euro(startBalance)}
                    </td>
                  </tr>
                  {weeks.map((w, i) => {
                    const isNegative = w.runningBalance < 0;
                    const isCurrentWeek = i === 0;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-100 hover:bg-slate-50 ${
                          isCurrentWeek ? "bg-y-teal/5" : ""
                        } ${isNegative ? "bg-red-50/50" : ""}`}
                      >
                        <td className="px-4 py-2.5 text-sm font-medium text-slate-700">
                          <span className="flex items-center gap-2">
                            {w.weekLabel}
                            {isCurrentWeek && (
                              <span className="text-[10px] bg-y-teal text-white px-1.5 py-0.5 rounded-full">
                                {t("liquidity.this_week")}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-right text-emerald-600 font-medium">
                          {w.income > 0 ? euro(w.income) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-right text-red-600 font-medium">
                          {w.expenses > 0 ? euro(w.expenses) : "—"}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-sm text-right font-semibold ${
                            w.net >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {euro(w.net)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-sm text-right font-bold ${
                            isNegative ? "text-red-600" : "text-slate-800"
                          }`}
                        >
                          {euro(w.runningBalance)}
                          {isNegative && (
                            <AlertTriangle
                              size={14}
                              className="inline ml-1 text-red-500"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary footer */}
        {!loading && weeks.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm">
            <span className="text-slate-500">{t("liquidity.12_week_forecast")}</span>
            <span className="font-semibold text-slate-700">
              {t("liquiditeitsplanning.end_balance_label")}:{" "}
              <span
                className={
                  weeks[weeks.length - 1].runningBalance >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }
              >
                {euro(weeks[weeks.length - 1].runningBalance)}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
