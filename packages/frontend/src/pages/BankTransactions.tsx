import { useEffect, useState } from "react";
import { fetchList, getErpNextLinkUrl } from "../lib/erpnext";
import { Landmark, RefreshCw, Filter, ExternalLink, Search } from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";

interface BankTransaction {
  name: string;
  date: string;
  bank_account: string;
  deposit: number;
  withdrawal: number;
  currency: string;
  description: string;
  status: string;
  reference_number: string;
  company: string;
  unallocated_amount: number;
}

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Settled: "bg-green-100 text-green-700",
  Unreconciled: "bg-red-100 text-red-700",
  Reconciled: "bg-blue-100 text-blue-700",
};

export default function BankTransactions() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState(getActiveCompany());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [["docstatus", "=", 1]];
      if (company) filters.push(["company", "=", company]);
      if (statusFilter) filters.push(["status", "=", statusFilter]);
      if (fromDate) filters.push(["date", ">=", fromDate]);
      if (toDate) filters.push(["date", "<=", toDate]);

      const list = await fetchList<BankTransaction>("Bank Transaction", {
        fields: [
          "name", "date", "bank_account", "deposit", "withdrawal", "currency",
          "description", "status", "reference_number", "company", "unallocated_amount",
        ],
        filters,
        limit_page_length: 200,
        order_by: "date desc",
      });
      setTransactions(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [company, statusFilter, fromDate, toDate]);

  const filtered = transactions.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      (t.reference_number || "").toLowerCase().includes(q) ||
      (t.bank_account || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <Landmark className="text-emerald-600" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{t("banktransacties.title")}</h1>
            <p className="text-xs text-slate-500">{t("banktransacties.subtitle")}</p>
          </div>
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {t("common.refresh")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <Filter size={14} className="text-slate-400" />
        <CompanySelect value={company} onChange={setCompany} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
          <option value="">{t("common.all_statuses")}</option>
          <option value="Pending">Pending</option>
          <option value="Settled">Settled</option>
          <option value="Unreconciled">Unreconciled</option>
          <option value="Reconciled">Reconciled</option>
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
        <div className="relative flex-1 min-w-[200px] max-w-[90vw]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("bank.search_placeholder")}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600">{t("common.date")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{t("banktransacties.col_reference")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{t("banktransacties.col_bank_account")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{t("banktransacties.col_description")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">{t("banktransacties.col_deposit")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">{t("banktransacties.col_withdrawal")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{t("projects.detail.status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t("bank.no_transactions")}</td></tr>
              )}
              {!loading && filtered.map((t) => (
                <tr key={t.name} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-600">{new Date(t.date).toLocaleDateString("nl-NL")}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{t.reference_number || t.name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{t.bank_account}</td>
                  <td className="px-4 py-2.5 text-slate-700 max-w-[300px] truncate">{t.description || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {t.deposit > 0 ? (
                      <span className="text-green-600">+ € {t.deposit.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {t.withdrawal > 0 ? (
                      <span className="text-red-600">- € {t.withdrawal.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || "bg-slate-100 text-slate-600"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <a href={`${getErpNextLinkUrl()}/bank-transaction/${encodeURIComponent(t.name)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-emerald-500 hover:text-emerald-700">
                      <ExternalLink size={13} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          {t("banktransacties.count", { count: filtered.length })}
        </div>
      </div>
    </div>
  );
}
