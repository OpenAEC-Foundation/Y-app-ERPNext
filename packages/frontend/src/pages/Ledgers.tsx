import { useEffect, useState } from "react";
import { fetchList, getErpNextLinkUrl } from "../lib/erpnext";
import { BookOpen, RefreshCw, Filter, ExternalLink, Search } from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";

interface Account {
  name: string;
  account_name: string;
  account_number: string;
  parent_account: string;
  root_type: string;
  account_type: string;
  company: string;
  is_group: number;
}

const ROOT_TYPE_COLORS: Record<string, string> = {
  Asset: "bg-blue-100 text-blue-700",
  Liability: "bg-purple-100 text-purple-700",
  Income: "bg-green-100 text-green-700",
  Expense: "bg-red-100 text-red-700",
  Equity: "bg-amber-100 text-amber-700",
};

export default function Ledgers() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState(getActiveCompany());
  const [search, setSearch] = useState("");
  const [rootFilter, setRootFilter] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [];
      if (company) filters.push(["company", "=", company]);

      const list = await fetchList<Account>("Account", {
        fields: ["name", "account_name", "account_number", "parent_account", "root_type", "account_type", "company", "is_group"],
        filters,
        limit_page_length: 0,
        order_by: "account_number asc, name asc",
      });
      setAccounts(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [company]);

  const filtered = accounts.filter((a) => {
    if (rootFilter && a.root_type !== rootFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.account_name.toLowerCase().includes(q) ||
        (a.account_number || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const rootTypes = [...new Set(accounts.map((a) => a.root_type).filter(Boolean))];

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <BookOpen className="text-indigo-600" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{t("grootboeken.title")}</h1>
            <p className="text-xs text-slate-500">{t("grootboeken.subtitle")}</p>
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
        <select value={rootFilter} onChange={(e) => setRootFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
          <option value="">{t("grootboeken.all_types")}</option>
          {rootTypes.map((rt) => (
            <option key={rt} value={rt}>{rt}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-[90vw]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("grootboeken.search_placeholder")}
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
                <th className="px-4 py-3 font-semibold text-slate-600">{t("grootboeken.col_number")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{t("settings.name_label")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{t("grootboeken.col_type")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{t("grootboeken.col_root_type")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">{t("grootboeken.col_balance")}</th>
                <th className="px-4 py-3 font-semibold text-slate-600">{t("tasks.detail.company")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t("grootboeken.no_accounts")}</td></tr>
              )}
              {!loading && filtered.map((a) => (
                <tr key={a.name} className={`hover:bg-slate-50 ${a.is_group ? "font-semibold" : ""}`}>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{a.account_number || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-800">{a.account_name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{a.account_type || "—"}</td>
                  <td className="px-4 py-2.5">
                    {a.root_type && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROOT_TYPE_COLORS[a.root_type] || "bg-slate-100 text-slate-600"}`}>
                        {a.root_type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-400">—</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{a.company}</td>
                  <td className="px-4 py-2.5">
                    <a href={`${getErpNextLinkUrl()}/account/${encodeURIComponent(a.name)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-indigo-500 hover:text-indigo-700">
                      <ExternalLink size={13} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          {t("grootboeken.count_summary", { shown: filtered.length, total: accounts.length })}
        </div>
      </div>
    </div>
  );
}
