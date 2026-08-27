import { useEffect, useState, useMemo } from "react";
import { fetchAll, getErpNextLinkUrl } from "../lib/erpnext";
import {
  Clock, RefreshCw, Filter, ExternalLink, FileText, Users, Calculator,
} from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import DateRangeFilter from "../components/DateRangeFilter";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";
import {
  SALES_INVOICE_FINAL_FILTER,
  SALES_INVOICE_DRAFT_FILTER,
} from "../lib/invoice-docstatus";

interface OutstandingInvoice {
  name: string;
  customer_name: string;
  grand_total: number;
  net_total: number;
  outstanding_amount: number;
  posting_date: string;
  due_date: string;
  status: string;
  company: string;
  contact_email: string;
}

interface CustomerTotal {
  customer: string;
  count: number;
  total: number;
}

const euro = (value: number) =>
  value.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

function daysOpen(postingDate: string): number {
  const today = new Date();
  const posted = new Date(postingDate);
  return Math.max(0, Math.round((today.getTime() - posted.getTime()) / 86400000));
}

const agingBuckets = [
  { labelKey: "openstaand.aging_0_30", min: 0, max: 30, color: "bg-green-500", lightColor: "bg-green-100", textColor: "text-green-700" },
  { labelKey: "openstaand.aging_31_60", min: 31, max: 60, color: "bg-yellow-500", lightColor: "bg-yellow-100", textColor: "text-yellow-700" },
  { labelKey: "openstaand.aging_61_90", min: 61, max: 90, color: "bg-orange-500", lightColor: "bg-orange-100", textColor: "text-orange-700" },
  { labelKey: "openstaand.aging_90_plus", min: 91, max: Infinity, color: "bg-red-500", lightColor: "bg-red-100", textColor: "text-red-700" },
];

const statusColors: Record<string, string> = {
  Overdue: "bg-red-100 text-red-700",
  "Partly Paid": "bg-yellow-100 text-yellow-700",
  Unpaid: "bg-y-teal/10 text-y-teal-dark",
};

function MonthlyChart({ invoices }: { invoices: OutstandingInvoice[] }) {
  const { t } = useTranslation();
  const monthData = useMemo(() => {
    const months = new Map<string, { count: number; amount: number }>();
    for (const inv of invoices) {
      const key = inv.posting_date.slice(0, 7);
      const current = months.get(key) || { count: 0, amount: 0 };
      current.count++;
      current.amount += inv.outstanding_amount;
      months.set(key, current);
    }
    return Array.from(months.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => {
        const [y, m] = month.split("-");
        const labels = ["Jan","Feb","Mrt","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
        return { month, label: `${labels[parseInt(m)-1]} '${y.slice(2)}`, ...data };
      });
  }, [invoices]);

  if (monthData.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400">{t("openstaand.no_data")}</div>;

  const maxAmount = Math.max(...monthData.map(d => d.amount), 1);

  return (
    <div className="flex items-end gap-2 h-48">
      {monthData.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center justify-end h-full group">
          <div className="relative w-full h-full flex flex-col justify-end items-center">
            <div className="absolute -top-10 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              {t("openstaand.tooltip_invoices", { count: d.count, amount: euro(d.amount) })}
            </div>
            <div
              className="w-full max-w-[36px] bg-red-400 rounded-t hover:bg-red-500 transition-colors"
              style={{
                height: `${Math.max((d.amount / maxAmount) * 100, d.amount > 0 ? 3 : 0)}%`,
                minHeight: d.amount > 0 ? '4px' : '0'
              }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">{d.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function Outstanding() {
  const { t } = useTranslation();
  const [company, setCompany] = useState(getActiveCompany());
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [draftTotals, setDraftTotals] = useState<{ count: number; amount: number }>({ count: 0, amount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // Openstaand/DSO blijft strikt op DEFINITIEVE facturen: een concept is
      // niet naar de klant verstuurd en dus geen vordering — meetellen zou de
      // aging-analyse en de DSO vervuilen. Het conceptbedrag wordt hieronder
      // wel apart opgehaald en als losse teller getoond.
      const filters: unknown[][] = [
        SALES_INVOICE_FINAL_FILTER,
        ["outstanding_amount", ">", 0],
      ];
      if (company) filters.push(["company", "=", company]);
      if (fromDate) filters.push(["posting_date", ">=", fromDate]);
      if (toDate) filters.push(["posting_date", "<=", toDate]);

      const draftFilters: unknown[][] = [SALES_INVOICE_DRAFT_FILTER];
      if (company) draftFilters.push(["company", "=", company]);
      if (fromDate) draftFilters.push(["posting_date", ">=", fromDate]);
      if (toDate) draftFilters.push(["posting_date", "<=", toDate]);

      const [list, drafts] = await Promise.all([
        fetchAll<OutstandingInvoice>(
          "Sales Invoice",
          ["name", "customer_name", "grand_total", "net_total", "outstanding_amount",
           "posting_date", "due_date", "status", "company", "contact_email"],
          filters,
          "posting_date desc"
        ),
        fetchAll<{ name: string; grand_total: number }>(
          "Sales Invoice",
          ["name", "grand_total"],
          draftFilters,
          "posting_date desc"
        ).catch(() => [] as { name: string; grand_total: number }[]),
      ]);

      setInvoices(list);
      setDraftTotals({
        count: drafts.length,
        amount: drafts.reduce((s, d) => s + (d.grand_total || 0), 0),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [company, fromDate, toDate]);

  // KPIs
  const totalOutstanding = invoices.reduce((s, i) => s + i.outstanding_amount, 0);
  const avgPerInvoice = invoices.length > 0 ? totalOutstanding / invoices.length : 0;
  const dso = useMemo(() => {
    if (invoices.length === 0) return 0;
    const totalDays = invoices.reduce((s, i) => s + daysOpen(i.posting_date), 0);
    return Math.round(totalDays / invoices.length);
  }, [invoices]);

  // Aging analysis
  const agingData = useMemo(() => {
    return agingBuckets.map((bucket) => {
      const matches = invoices.filter((inv) => {
        const days = daysOpen(inv.posting_date);
        return days >= bucket.min && days <= bucket.max;
      });
      return {
        ...bucket,
        count: matches.length,
        amount: matches.reduce((s, i) => s + i.outstanding_amount, 0),
      };
    });
  }, [invoices]);

  const maxAgingAmount = Math.max(...agingData.map((b) => b.amount), 1);

  // Top 10 customers
  const topCustomers = useMemo<CustomerTotal[]>(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const inv of invoices) {
      const existing = map.get(inv.customer_name) || { count: 0, total: 0 };
      existing.count++;
      existing.total += inv.outstanding_amount;
      map.set(inv.customer_name, existing);
    }
    return Array.from(map.entries())
      .map(([customer, data]) => ({ customer, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [invoices]);

  const maxCustomerTotal = topCustomers.length > 0 ? topCustomers[0].total : 1;

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Clock className="text-amber-600" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t("openstaand.title")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${getErpNextLinkUrl()}/sales-invoice?status=Unpaid&status=Overdue&company=${encodeURIComponent(company)}`}
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

      {/* Company filter */}
      <div className="mb-6 flex items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <CompanySelect value={company} onChange={setCompany} />
        <DateRangeFilter fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />
      </div>

      {/* Concepten zijn géén vordering en zitten dus niet in de cijfers
          hieronder — wel als losse teller tonen, anders lijkt het alsof er
          niets meer te factureren valt. */}
      {!loading && draftTotals.count > 0 && (
        <div className="mb-6 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900 rounded">
            {t("invoice_draft.badge")}
          </span>
          {t("invoice_draft.not_counted", { count: draftTotals.count, amount: euro(draftTotals.amount) })}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-red-100 rounded-lg">
              <FileText className="text-red-600" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("outstanding.total_outstanding")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {loading ? "..." : euro(totalOutstanding)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-y-teal/10 rounded-lg">
              <FileText className="text-y-teal" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("openstaand.invoice_count")}</p>
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {loading ? "..." : invoices.length}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calculator className="text-purple-600" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("openstaand.avg_per_invoice")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {loading ? "..." : euro(avgPerInvoice)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="text-orange-600" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("openstaand.dso_avg_days")}</p>
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {loading ? "..." : dso}
            {!loading && <span className="text-base font-normal text-slate-400 ml-1">{t("common.days")}</span>}
          </p>
        </div>
      </div>

      {/* Outstanding Trend */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">{t("openstaand.outstanding_per_month")}</h3>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-slate-400">{t("common.loading")}</div>
        ) : (
          <MonthlyChart invoices={invoices} />
        )}
      </div>

      {/* Aging Analysis */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">{t("openstaand.aging_analysis")}</h3>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-slate-400">{t("common.loading")}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {agingData.map((bucket) => (
              <div key={bucket.labelKey} className="text-center">
                <div className="h-32 flex items-end justify-center mb-3">
                  <div className="w-full h-full max-w-[80px] relative group flex flex-col justify-end">
                    {/* Tooltip */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {t("openstaand.tooltip_invoices", { count: bucket.count, amount: euro(bucket.amount) })}
                    </div>
                    <div
                      className={`w-full ${bucket.color} rounded-t transition-all hover:opacity-80`}
                      style={{ height: `${Math.max((bucket.amount / maxAgingAmount) * 100, bucket.amount > 0 ? 4 : 0)}%`, minHeight: bucket.amount > 0 ? "8px" : "0px" }}
                    />
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-700">{t(bucket.labelKey)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t("openstaand.invoices_label", { count: bucket.count })}</p>
                <p className="text-sm font-medium text-slate-800 mt-0.5">{euro(bucket.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top 10 Customers */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <Users size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-600">{t("openstaand.top_10_customers")}</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.customer")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{t("openstaand.col_invoices")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{t("openstaand.col_outstanding")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 w-48">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td>
              </tr>
            ) : topCustomers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t("openstaand.no_data")}</td>
              </tr>
            ) : (
              topCustomers.map((c) => (
                <tr key={c.customer} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{c.customer}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 text-right">{c.count}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">{euro(c.total)}</td>
                  <td className="px-4 py-3">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full"
                        style={{ width: `${(c.total / maxCustomerTotal) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-600">{t("outstanding.all_invoices")}</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("openstaand.invoice_nr")}</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.customer")}</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("openstaand.invoice_date")}</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("openstaand.col_due_date")}</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600">{t("openstaand.col_amount_excl_vat")}</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600">{t("openstaand.col_outstanding")}</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600">{t("outstanding.days_open")}</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("projects.detail.status")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t("outstanding.no_invoices")}</td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const days = daysOpen(inv.posting_date);
                const agingColor = days <= 30
                  ? "text-green-600"
                  : days <= 60
                    ? "text-yellow-600"
                    : days <= 90
                      ? "text-orange-600"
                      : "text-red-600";

                return (
                  <tr key={inv.name} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-sm font-medium">
                      <a
                        href={`${getErpNextLinkUrl()}/sales-invoice/${inv.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-y-teal hover:text-y-teal-dark hover:underline"
                      >
                        {inv.name}
                      </a>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-700">{inv.customer_name}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-500">{inv.posting_date}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-500">{inv.due_date || "-"}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-700 text-right">{euro(inv.net_total)}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-orange-600 text-right">
                      {euro(inv.outstanding_amount)}
                    </td>
                    <td className={`px-3 py-2.5 text-sm font-semibold text-right ${agingColor}`}>
                      {days}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[inv.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Summary row */}
        {!loading && invoices.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm">
            <span className="text-slate-500">{t("openstaand.invoices_label", { count: invoices.length })}</span>
            <span className="font-semibold text-slate-700">
              {t("openstaand.total_outstanding", { amount: euro(totalOutstanding) })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
