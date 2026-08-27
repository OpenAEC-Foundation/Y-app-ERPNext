import { useEffect, useState, useMemo } from "react";
import { fetchList, getErpNextLinkUrl } from "../lib/erpnext";
import {
  RefreshCw, Filter, Search, ExternalLink,
  Package, Clock, CheckCircle, DollarSign, Plus, ChevronDown,
} from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import DateRangeFilter from "../components/DateRangeFilter";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";

interface DeliveryNote {
  name: string;
  customer: string;
  posting_date: string;
  status: string;
  net_total: number;
  project: string;
  company: string;
  per_billed: number;
}

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  "To Bill": "bg-orange-100 text-orange-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

const euro = (v: number) =>
  `\u20AC ${v.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`;

export default function DeliveryNotes() {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState(getActiveCompany());
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  function toggleStatus(s: string) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [
        ["docstatus", "!=", 2],
      ];
      if (company) filters.push(["company", "=", company]);
      if (statusFilter.length > 0) filters.push(["status", "in", statusFilter]);
      if (fromDate) filters.push(["posting_date", ">=", fromDate]);
      if (toDate) filters.push(["posting_date", "<=", toDate]);

      const list = await fetchList<DeliveryNote>("Delivery Note", {
        fields: [
          "name", "customer", "posting_date", "status",
          "net_total", "project", "company", "per_billed",
        ],
        filters,
        limit_page_length: 200,
        order_by: "posting_date desc",
      });
      setNotes(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [company, statusFilter, fromDate, toDate]);


  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.customer?.toLowerCase().includes(q) ||
        n.project?.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const toBillNotes = notes.filter((n) => n.status === "To Bill");
  const completedNotes = notes.filter((n) => n.status === "Completed");
  const totalValue = notes.reduce((s, n) => s + n.net_total, 0);

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t("delivery_notes.title")}</h2>
        <div className="flex items-center gap-2">
          <a
            href={`${getErpNextLinkUrl()}/delivery-note/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <Plus size={16} />
            {t("delivery_notes.new")}
          </a>
          <a
            href={`${getErpNextLinkUrl()}/delivery-note?company=${encodeURIComponent(company)}`}
            target="_blank" rel="noopener noreferrer"
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

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <CompanySelect value={company} onChange={setCompany} />
        <DateRangeFilter fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />
        <div className="relative">
          <button
            onClick={() => setStatusDropdownOpen((o) => !o)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal flex items-center gap-2 cursor-pointer"
          >
            {statusFilter.length === 0
              ? t("common.all_statuses")
              : t("delivery_notes.statuses_selected", { count: statusFilter.length })}
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          {statusDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[180px]">
                {["Draft", "To Bill", "Completed", "Cancelled"].map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(s)}
                      onChange={() => toggleStatus(s)}
                      className="rounded border-slate-300 text-y-teal focus:ring-y-teal"
                    />
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[s] ?? "bg-slate-100 text-slate-600"}`}>
                      {s}
                    </span>
                  </label>
                ))}
                {statusFilter.length > 0 && (
                  <button
                    onClick={() => { setStatusFilter([]); setStatusDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:text-slate-600 border-t border-slate-100 cursor-pointer"
                  >
                    {t("common.clear_filters")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-y-teal/10 rounded-lg"><Package className="text-y-teal" size={20} /></div>
            <p className="text-sm text-slate-500">{t("delivery_notes.total_deliveries")}</p>
          </div>
          <p className="text-3xl font-bold text-slate-800">{loading ? "..." : notes.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-orange-100 rounded-lg"><Clock className="text-orange-600" size={20} /></div>
            <p className="text-sm text-slate-500">{t("delivery_notes.to_bill")}</p>
          </div>
          <p className="text-3xl font-bold text-orange-600">{loading ? "..." : toBillNotes.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="text-green-600" size={20} /></div>
            <p className="text-sm text-slate-500">{t("delivery_notes.billed")}</p>
          </div>
          <p className="text-3xl font-bold text-green-600">{loading ? "..." : completedNotes.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-purple-100 rounded-lg"><DollarSign className="text-purple-600" size={20} /></div>
            <p className="text-sm text-slate-500">{t("delivery_notes.total_value_excl_vat")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{loading ? "..." : euro(totalValue)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={t("delivery_notes.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-y-teal text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">{t("delivery_notes.col_delivery_nr")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">{t("delivery_notes.customer")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">{t("tasks.detail.project")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">{t("common.date")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{t("delivery_notes.col_amount_excl_vat")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 w-36">{t("delivery_notes.col_billed_pct")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">{t("projects.detail.status")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t("delivery_notes.no_deliveries")}</td></tr>
            ) : (
              filtered.map((note) => (
                <tr key={note.name} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium">
                    <a
                      href={`${getErpNextLinkUrl()}/delivery-note/${note.name}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-y-teal hover:text-y-teal-dark hover:underline"
                    >
                      {note.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{note.customer}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{note.project || "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{note.posting_date}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-right">{euro(note.net_total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            note.per_billed >= 100
                              ? "bg-green-500"
                              : note.per_billed > 0
                              ? "bg-y-teal"
                              : "bg-slate-300"
                          }`}
                          style={{ width: `${Math.min(note.per_billed, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-10 text-right">
                        {Math.round(note.per_billed)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[note.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {note.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {!loading && filtered.length > 0 && (
        <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg flex items-center justify-between text-sm">
          <span className="text-slate-500">{t("delivery_notes.count_label", { count: filtered.length })}</span>
          <span className="font-semibold text-slate-700">
            {t("delivery_notes.total", { amount: euro(filtered.reduce((s, n) => s + n.net_total, 0)) })}
          </span>
        </div>
      )}
    </div>
  );
}
