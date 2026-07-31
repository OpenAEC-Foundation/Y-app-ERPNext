import { useEffect, useState, useMemo } from "react";
import { fetchList, fetchDocument, updateDocument, getErpNextLinkUrl } from "../lib/erpnext";
import { getActiveCompany } from "../lib/instances";
import { useProjects } from "../lib/DataContext";
import { useToast } from "../components/Toast";
import { FileBarChart, RefreshCw, Search, Filter, ChevronDown, Plus, X, ExternalLink } from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import DateRangeFilter from "../components/DateRangeFilter";
import QuotationCreateModal from "./QuotationCreateModal";
import { useTranslation } from "react-i18next";

interface Quotation {
  name: string;
  custom_description?: string;
  party_name: string;
  net_total: number;
  transaction_date: string;
  valid_till: string;
  status: string;
  company: string;
}

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Open: "bg-y-teal/10 text-y-teal-dark",
  Replied: "bg-purple-100 text-purple-700",
  Ordered: "bg-green-100 text-green-700",
  Lost: "bg-red-100 text-red-700",
  Cancelled: "bg-slate-100 text-slate-600",
  Expired: "bg-orange-100 text-orange-700",
};

export default function Quotations() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [detailDoc, setDetailDoc] = useState<Record<string, any> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [company, setCompany] = useState(getActiveCompany());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortCol, setSortCol] = useState<keyof Quotation>("transaction_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleStatus(s: string) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [["docstatus", "!=", 2]];
      if (statusFilter.length > 0) filters.push(["status", "in", statusFilter]);
      if (company) filters.push(["company", "=", company]);
      if (fromDate) filters.push(["transaction_date", ">=", fromDate]);
      if (toDate) filters.push(["transaction_date", "<=", toDate]);

      const standardFields = [
        "name", "party_name", "net_total",
        "transaction_date", "valid_till", "status", "company",
      ];
      const fetchParams = { filters, limit_page_length: 200, order_by: "transaction_date desc" };

      let list: Quotation[];
      try {
        // Try with custom_description first (exists on some instances)
        list = await fetchList<Quotation>("Quotation", {
          ...fetchParams,
          fields: [...standardFields, "custom_description"],
        });
      } catch {
        // If custom_description doesn't exist (e.g. ERPNext v16), fetch without it
        list = await fetchList<Quotation>("Quotation", {
          ...fetchParams,
          fields: standardFields,
        });
      }
      setQuotations(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [statusFilter, company, fromDate, toDate]);

  const filtered = useMemo(() => {
    if (!search.trim()) return quotations;
    const q = search.toLowerCase();
    return quotations.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.custom_description?.toLowerCase().includes(q) ||
        o.party_name?.toLowerCase().includes(q)
    );
  }, [quotations, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortCol, sortDir]);

  function handleSort(col: keyof Quotation) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const totalValue = sorted.reduce((s, q) => s + q.net_total, 0);

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t("quotations.title")}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer"
          >
            <Plus size={16} />
            {t("common.new")}
          </button>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <FileBarChart className="text-indigo-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("quotations.kpi_count_label")}</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? "..." : sorted.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="p-2 bg-green-100 rounded-lg">
            <FileBarChart className="text-green-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("quotations.total_value_excl_vat")}</p>
            <p className="text-2xl font-bold text-slate-800">
              {loading ? "..." : `\u20AC ${totalValue.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
            </p>
          </div>
        </div>

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
              : t("quotations.statuses_selected", { count: statusFilter.length })}
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          {statusDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[180px]">
                {["Draft", "Open", "Replied", "Ordered", "Lost", "Cancelled", "Expired"].map((s) => (
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

        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={t("quotations.search_placeholder")}
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-y-teal text-sm" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {([
                ["name", "text-left", t("quotations.col_quotation_nr")],
                ["custom_description", "text-left", t("quotations.col_project_name")],
                ["party_name", "text-left", t("sales_invoices.customer")],
                ["transaction_date", "text-left", t("common.date")],
                ["valid_till", "text-left", t("quotations.valid_until")],
                ["net_total", "text-right", t("quotations.col_amount_excl_vat")],
                ["status", "text-left", t("projects.detail.status")],
              ] as [keyof Quotation, string, string][]).map(([col, align, label]) => (
                <th key={col}
                  onClick={() => handleSort(col)}
                  className={`${align} px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:text-y-teal select-none`}
                >
                  {label}
                  {sortCol === col && (
                    <span className="ml-1 text-y-teal">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t("quotations.no_quotations")}</td></tr>
            ) : sorted.map((q) => (
              <tr key={q.name} onClick={() => { setSelectedName(q.name); setDetailLoading(true); fetchDocument("Quotation", q.name).then(setDetailDoc).catch(() => setDetailDoc(null)).finally(() => setDetailLoading(false)); }}
                className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${selectedName === q.name ? "bg-y-teal/5" : ""}`}>
                <td className="px-4 py-3 text-sm font-medium text-y-teal">{q.name}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{q.custom_description || "-"}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{q.party_name}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{q.transaction_date}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{q.valid_till || "-"}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">
                  {`\u20AC ${q.net_total.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusColors[q.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {q.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quotation detail panel — editable */}
      {selectedName && detailDoc && !detailLoading && (
        <QuotationDetail
          doc={detailDoc}
          onClose={() => { setSelectedName(null); setDetailDoc(null); }}
          onUpdated={() => { loadData(); fetchDocument("Quotation", selectedName!).then(setDetailDoc).catch(() => {}); }}
        />
      )}

      {showCreate && (
        <QuotationCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => loadData()}
        />
      )}
    </div>
  );
}

/* ─── Quotation Detail Panel (editable) ─── */

function QuotationDetail({ doc, onClose, onUpdated }: {
  doc: Record<string, any>;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const projects = useProjects();
  const [saving, setSaving] = useState(false);
  const [editStatus, setEditStatus] = useState(String(doc.status || "Draft"));
  const [editProject, setEditProject] = useState(String(doc.project || ""));
  const [editValidTill, setEditValidTill] = useState(String(doc.valid_till || ""));
  const [editDescription, setEditDescription] = useState(String(doc.custom_description || ""));

  const dirty = editStatus !== String(doc.status || "Draft")
    || editProject !== String(doc.project || "")
    || editValidTill !== String(doc.valid_till || "")
    || editDescription !== String(doc.custom_description || "");

  async function handleSave() {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      if (editStatus !== String(doc.status)) updates.status = editStatus;
      if (editProject !== String(doc.project || "")) updates.project = editProject || null;
      if (editValidTill !== String(doc.valid_till || "")) updates.valid_till = editValidTill || null;
      if (editDescription !== String(doc.custom_description || "")) updates.custom_description = editDescription || null;
      if (Object.keys(updates).length > 0) {
        await updateDocument("Quotation", String(doc.name), updates);
        toast.success(t("common.saved"));
        onUpdated();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{String(doc.name)}</h3>
            <p className="text-sm text-slate-500">{String(doc.party_name || "")}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={`${getErpNextLinkUrl()}/quotation/${doc.name}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-y-teal hover:text-y-teal-dark border border-slate-200 rounded-lg hover:bg-slate-50">
              <ExternalLink size={12} /> ERPNext
            </a>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t("projects.detail.status")}</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
                {["Draft", "Open", "Replied", "Ordered", "Lost", "Cancelled", "Expired"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t("quotations.valid_until")}</label>
              <input type="date" value={editValidTill} onChange={(e) => setEditValidTill(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t("nav.projects")}</label>
              <select value={editProject} onChange={(e) => setEditProject(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
                <option value="">—</option>
                {projects.filter(p => p.status === "Open").map(p => (
                  <option key={p.name} value={p.name}>{p.name} — {p.project_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t("quotation_create.description")}</label>
              <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
            </div>
          </div>

          {/* Read-only summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500">{t("sales_invoices.customer")}</p>
              <p className="text-sm font-semibold text-slate-700 mt-1">{String(doc.party_name || "-")}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500">{t("common.date")}</p>
              <p className="text-sm font-semibold text-slate-700 mt-1">{String(doc.transaction_date || "-")}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500">{t("quotations.col_amount_excl_vat")}</p>
              <p className="text-sm font-bold text-slate-800 mt-1">
                {Number(doc.net_total || 0).toLocaleString("nl-NL", { style: "currency", currency: "EUR" })}
              </p>
            </div>
          </div>

          {/* Items table */}
          {Array.isArray(doc.items) && doc.items.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("quotation_create.col_item")}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("quotation_create.col_description")}</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">{t("quotation_create.col_qty")}</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">{t("quotation_create.col_rate")}</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">{t("quotation_create.col_amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-sm font-medium text-slate-700">{item.item_name || item.item_code || ""}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 max-w-xs truncate">{String(item.description || "-").replace(/<[^>]*>/g, "")}</td>
                      <td className="px-3 py-2 text-sm text-right text-slate-600">{item.qty || 0} {item.uom || ""}</td>
                      <td className="px-3 py-2 text-sm text-right text-slate-600">
                        {Number(item.rate || 0).toLocaleString("nl-NL", { style: "currency", currency: "EUR" })}
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-semibold text-slate-700">
                        {Number(item.amount || 0).toLocaleString("nl-NL", { style: "currency", currency: "EUR" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        {dirty && (
          <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-slate-200 bg-slate-50">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
              {t("common.cancel")}
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-y-teal rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
              {t("common.save")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
