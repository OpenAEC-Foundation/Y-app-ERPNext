import { useEffect, useState } from "react";
import { fetchList, getErpNextLinkUrl } from "../lib/erpnext";
import { BookMarked, RefreshCw, Filter, ExternalLink, Search, Plus } from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";

interface JournalEntry {
  name: string;
  posting_date: string;
  title: string;
  voucher_type: string;
  total_debit: number;
  total_credit: number;
  company: string;
  user_remark: string;
  docstatus: number;
}

const VOUCHER_TYPE_COLORS: Record<string, string> = {
  "Journal Entry": "bg-blue-100 text-blue-700",
  "Bank Entry": "bg-emerald-100 text-emerald-700",
  "Cash Entry": "bg-amber-100 text-amber-700",
  "Credit Card Entry": "bg-purple-100 text-purple-700",
  "Debit Note": "bg-red-100 text-red-700",
  "Credit Note": "bg-green-100 text-green-700",
  "Contra Entry": "bg-slate-100 text-slate-700",
  "Excise Entry": "bg-orange-100 text-orange-700",
  "Write Off Entry": "bg-rose-100 text-rose-700",
  "Opening Entry": "bg-cyan-100 text-cyan-700",
  "Depreciation Entry": "bg-gray-100 text-gray-700",
};

export default function BookingProgram() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState(getActiveCompany());
  const [search, setSearch] = useState("");
  const [voucherType, setVoucherType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [["docstatus", "=", 1]];
      if (company) filters.push(["company", "=", company]);
      if (voucherType) filters.push(["voucher_type", "=", voucherType]);
      if (fromDate) filters.push(["posting_date", ">=", fromDate]);
      if (toDate) filters.push(["posting_date", "<=", toDate]);

      const list = await fetchList<JournalEntry>("Journal Entry", {
        fields: [
          "name", "posting_date", "title", "voucher_type",
          "total_debit", "total_credit", "company", "user_remark", "docstatus",
        ],
        filters,
        limit_page_length: 200,
        order_by: "posting_date desc",
      });
      setEntries(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [company, voucherType, fromDate, toDate]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      (e.title || "").toLowerCase().includes(q) ||
      (e.user_remark || "").toLowerCase().includes(q)
    );
  });

  const totalDebit = filtered.reduce((sum, e) => sum + e.total_debit, 0);
  const totalCredit = filtered.reduce((sum, e) => sum + e.total_credit, 0);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-50 rounded-lg">
            <BookMarked className="text-violet-600" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{t("boekingsprogramma.title")}</h1>
            <p className="text-xs text-slate-500">{t("boekingsprogramma.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={`${getErpNextLinkUrl()}/journal-entry/new`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 cursor-pointer">
            <Plus size={14} /> {t("boekingsprogramma.new_booking")}
          </a>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">{t("boekingsprogramma.total_debit")}</p>
          <p className="text-lg font-bold text-slate-800">€ {totalDebit.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">{t("boekingsprogramma.total_credit")}</p>
          <p className="text-lg font-bold text-slate-800">€ {totalCredit.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">{t("boekingsprogramma.count_label")}</p>
          <p className="text-lg font-bold text-slate-800">{filtered.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <Filter size={14} className="text-slate-400" />
        <CompanySelect value={company} onChange={setCompany} />
        <select value={voucherType} onChange={(e) => setVoucherType(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
          <option value="">{t("boekingsprogramma.all_types")}</option>
          {Object.keys(VOUCHER_TYPE_COLORS).map((vt) => (
            <option key={vt} value={vt}>{vt}</option>
          ))}
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
        <div className="relative flex-1 min-w-[200px] max-w-[90vw]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("boekingsprogramma.search_placeholder")}
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
                <th className="px-4 py-3 font-semibold text-slate-600">{t("settings.name_label")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{t("boekingsprogramma.col_title")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{t("boekingsprogramma.col_type")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">{t("boekingsprogramma.col_debit")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">{t("boekingsprogramma.col_credit")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{t("boekingsprogramma.col_remark")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t("boekingsprogramma.no_bookings")}</td></tr>
              )}
              {!loading && filtered.map((e) => (
                <tr key={e.name} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-600">{new Date(e.posting_date).toLocaleDateString("nl-NL")}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{e.name}</td>
                  <td className="px-4 py-2.5 text-slate-800">{e.title || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VOUCHER_TYPE_COLORS[e.voucher_type] || "bg-slate-100 text-slate-600"}`}>
                      {e.voucher_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    € {e.total_debit.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    € {e.total_credit.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[200px] truncate">{e.user_remark || "—"}</td>
                  <td className="px-4 py-2.5">
                    <a href={`${getErpNextLinkUrl()}/journal-entry/${encodeURIComponent(e.name)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-violet-500 hover:text-violet-700">
                      <ExternalLink size={13} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          {t("boekingsprogramma.count_summary", { count: filtered.length })}
        </div>
      </div>
    </div>
  );
}
