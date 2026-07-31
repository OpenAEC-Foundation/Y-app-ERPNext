import { useEffect, useState, useMemo } from "react";
import { fetchList, fetchDocument, getErpNextLinkUrl } from "../lib/erpnext";
import {
  Users, RefreshCw, Search, LayoutGrid, List, Filter, ChevronDown,
  Plus, X, ExternalLink, Building2, Phone, Mail, MapPin, TrendingUp,
  Target, UserCheck, AlertCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface Lead {
  name: string;
  lead_name: string;
  company_name: string;
  email_id: string;
  mobile_no: string;
  source: string;
  status: string;
  territory: string;
  industry: string;
  notes: string;
  creation: string;
  modified: string;
}

interface LeadDetail extends Lead {
  annual_revenue: number;
  [key: string]: unknown;
}

const LEAD_STATUSES = [
  "Lead",
  "Open",
  "Replied",
  "Opportunity",
  "Interested",
  "Quotation",
  "Lost Quotation",
  "Converted",
  "Do Not Contact",
];

const statusColors: Record<string, string> = {
  Lead: "bg-slate-100 text-slate-700 border-slate-300",
  Open: "bg-y-teal/10 text-y-teal-dark border-y-teal/30",
  Replied: "bg-purple-100 text-purple-700 border-purple-300",
  Opportunity: "bg-blue-100 text-blue-700 border-blue-300",
  Interested: "bg-cyan-100 text-cyan-700 border-cyan-300",
  Quotation: "bg-amber-100 text-amber-700 border-amber-300",
  "Lost Quotation": "bg-red-100 text-red-700 border-red-300",
  Converted: "bg-green-100 text-green-700 border-green-300",
  "Do Not Contact": "bg-rose-100 text-rose-700 border-rose-300",
};

const kanbanColumnColors: Record<string, string> = {
  Lead: "border-t-slate-400",
  Open: "border-t-y-teal",
  Replied: "border-t-purple-500",
  Opportunity: "border-t-blue-500",
  Interested: "border-t-cyan-500",
  Quotation: "border-t-amber-500",
  "Lost Quotation": "border-t-red-500",
  Converted: "border-t-green-500",
  "Do Not Contact": "border-t-rose-500",
};

function formatDate(d: string | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateShort(d: string | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  return date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export default function Leads() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function toggleStatus(s: string) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [];
      if (statusFilter.length > 0) filters.push(["status", "in", statusFilter]);
      if (sourceFilter) filters.push(["source", "=", sourceFilter]);
      const list = await fetchList<Lead>("Lead", {
        fields: [
          "name", "lead_name", "company_name", "email_id", "mobile_no",
          "source", "status", "territory", "industry", "notes", "creation", "modified",
        ],
        filters,
        limit_page_length: 500,
        order_by: "modified desc",
      });
      setLeads(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(lead: Lead) {
    setDetailLoading(true);
    try {
      const doc = await fetchDocument<LeadDetail>("Lead", lead.name);
      setSelectedLead(doc);
    } catch {
      setSelectedLead({ ...lead, annual_revenue: 0 } as LeadDetail);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [statusFilter, sourceFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.lead_name?.toLowerCase().includes(q) ||
        l.company_name?.toLowerCase().includes(q) ||
        l.email_id?.toLowerCase().includes(q) ||
        l.name?.toLowerCase().includes(q) ||
        l.source?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  // KPI calculations
  const totalLeads = filtered.length;
  const convertedCount = filtered.filter((l) => l.status === "Converted").length;
  const openCount = filtered.filter((l) => ["Lead", "Open", "Replied", "Interested"].includes(l.status)).length;
  const conversionRate = totalLeads > 0 ? ((convertedCount / totalLeads) * 100).toFixed(1) : "0.0";

  // Unique sources for filter
  const sources = useMemo(() => {
    const s = new Set(leads.map((l) => l.source).filter(Boolean));
    return Array.from(s).sort();
  }, [leads]);

  // Kanban columns
  const kanbanData = useMemo(() => {
    const cols: Record<string, Lead[]> = {};
    for (const status of LEAD_STATUSES) {
      cols[status] = [];
    }
    for (const lead of filtered) {
      if (cols[lead.status]) {
        cols[lead.status].push(lead);
      } else {
        // Unknown status - put in Lead column
        cols["Lead"].push(lead);
      }
    }
    return cols;
  }, [filtered]);

  return (
    <div className="p-3 sm:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users size={24} className="text-y-teal" />
          {t("leads.title")}
        </h2>
        <div className="flex items-center gap-2">
          <a
            href={`${getErpNextLinkUrl()}/lead/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <Plus size={16} />
            {t("leads.new")}
          </a>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Users size={14} />
            {t("leads.total_leads")}
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalLeads}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Target size={14} />
            {t("leads.open")}
          </div>
          <div className="text-2xl font-bold text-y-teal">{openCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <UserCheck size={14} />
            {t("leads.converted")}
          </div>
          <div className="text-2xl font-bold text-green-600">{convertedCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <TrendingUp size={14} />
            {t("leads.conversion_rate")}
          </div>
          <div className="text-2xl font-bold text-purple-600">{conversionRate}%</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-[90vw] sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t("leads.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
          />
        </div>

        {/* Status filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
          >
            <Filter size={14} />
            {t("leads.status")}
            {statusFilter.length > 0 && (
              <span className="bg-y-teal text-white text-xs rounded-full px-1.5">{statusFilter.length}</span>
            )}
            <ChevronDown size={14} />
          </button>
          {statusDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownOpen(false)} />
              <div className="absolute z-20 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px] max-w-[90vw]">
                {LEAD_STATUSES.map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(s)}
                      onChange={() => toggleStatus(s)}
                      className="rounded"
                    />
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || "bg-slate-100 text-slate-600"}`}>
                      {s}
                    </span>
                  </label>
                ))}
                {statusFilter.length > 0 && (
                  <button
                    onClick={() => setStatusFilter([])}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border-t border-slate-100"
                  >
                    {t("common.clear_filters")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          <option value="">{t("leads.all_sources")}</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* View toggle */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode("kanban")}
            className={`p-2 ${viewMode === "kanban" ? "bg-y-teal text-white" : "text-slate-500 hover:bg-slate-50"}`}
            title={t("leads.kanban_view")}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 ${viewMode === "list" ? "bg-y-teal text-white" : "text-slate-500 hover:bg-slate-50"}`}
            title={t("leads.list_view")}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Main area */}
        <div className={`flex-1 min-h-0 overflow-auto ${selectedLead ? "hidden lg:block" : ""}`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw size={24} className="animate-spin text-y-teal" />
            </div>
          ) : viewMode === "kanban" ? (
            <KanbanView
              columns={kanbanData}
              onSelect={openDetail}
              selectedName={selectedLead?.name}
            />
          ) : (
            <ListView
              leads={filtered}
              onSelect={openDetail}
              selectedName={selectedLead?.name}
            />
          )}
        </div>

        {/* Detail panel */}
        {selectedLead && (
          <DetailPanel
            lead={selectedLead}
            loading={detailLoading}
            onClose={() => setSelectedLead(null)}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Kanban View ─── */

function KanbanView({
  columns,
  onSelect,
  selectedName,
}: {
  columns: Record<string, Lead[]>;
  onSelect: (l: Lead) => void;
  selectedName?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3 h-full overflow-x-auto pb-2">
      {LEAD_STATUSES.map((status) => {
        const items = columns[status] || [];
        return (
          <div
            key={status}
            className={`flex-shrink-0 w-64 bg-slate-50 rounded-xl border border-slate-200 border-t-4 ${kanbanColumnColors[status] || "border-t-slate-400"} flex flex-col`}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">{status}</h3>
              <span className="bg-white text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full border border-slate-200">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
              {items.map((lead) => (
                <button
                  key={lead.name}
                  onClick={() => onSelect(lead)}
                  className={`w-full text-left bg-white rounded-lg border p-3 hover:shadow-md transition-shadow cursor-pointer ${
                    selectedName === lead.name
                      ? "border-y-teal ring-2 ring-y-teal/20"
                      : "border-slate-200"
                  }`}
                >
                  <div className="font-medium text-sm text-slate-800 truncate">
                    {lead.lead_name || lead.name}
                  </div>
                  {lead.company_name && (
                    <div className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1">
                      <Building2 size={10} />
                      {lead.company_name}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {lead.source && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {lead.source}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 ml-auto">
                      {formatDateShort(lead.creation)}
                    </span>
                  </div>
                </button>
              ))}
              {items.length === 0 && (
                <div className="text-xs text-slate-400 text-center py-4">{t("leads.no_leads_card")}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── List View ─── */

function ListView({
  leads,
  onSelect,
  selectedName,
}: {
  leads: Lead[];
  onSelect: (l: Lead) => void;
  selectedName?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-left">
            <th className="px-4 py-3 font-medium text-slate-600">{t("settings.name_label")}</th>
            <th className="px-4 py-3 font-medium text-slate-600">{t("tasks.detail.company")}</th>
            <th className="px-4 py-3 font-medium text-slate-600">{t("projects.detail.status")}</th>
            <th className="px-4 py-3 font-medium text-slate-600">{t("leads.source")}</th>
            <th className="px-4 py-3 font-medium text-slate-600">{t("leads.created")}</th>
            <th className="px-4 py-3 font-medium text-slate-600">{t("leads.modified")}</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.name}
              onClick={() => onSelect(lead)}
              className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
                selectedName === lead.name ? "bg-y-teal/5" : ""
              }`}
            >
              <td className="px-4 py-3">
                <div className="font-medium text-slate-800">{lead.lead_name || lead.name}</div>
                {lead.email_id && (
                  <div className="text-xs text-slate-400">{lead.email_id}</div>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">{lead.company_name || "-"}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[lead.status] || "bg-slate-100 text-slate-600"}`}>
                  {lead.status}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">{lead.source || "-"}</td>
              <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(lead.creation)}</td>
              <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(lead.modified)}</td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                {t("leads.no_leads_table")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Detail Panel ─── */

function DetailPanel({
  lead,
  loading,
  onClose,
}: {
  lead: LeadDetail;
  loading: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="w-full lg:w-96 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="font-semibold text-slate-800 truncate">{lead.lead_name || lead.name}</h3>
        <div className="flex items-center gap-1">
          <a
            href={`${getErpNextLinkUrl()}/lead/${lead.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-400 hover:text-y-teal rounded"
            title={t("common.open_in_erpnext")}
          >
            <ExternalLink size={16} />
          </a>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={20} className="animate-spin text-y-teal" />
          </div>
        ) : (
          <>
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[lead.status] || "bg-slate-100 text-slate-600"}`}>
                {lead.status}
              </span>
            </div>

            {/* Contact info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("leads.contact_details")}</h4>
              {lead.company_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-700">{lead.company_name}</span>
                </div>
              )}
              {lead.email_id && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-slate-400 flex-shrink-0" />
                  <a href={`mailto:${lead.email_id}`} className="text-y-teal hover:underline truncate">
                    {lead.email_id}
                  </a>
                </div>
              )}
              {lead.mobile_no && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-slate-400 flex-shrink-0" />
                  <a href={`tel:${lead.mobile_no}`} className="text-y-teal hover:underline">
                    {lead.mobile_no}
                  </a>
                </div>
              )}
              {lead.territory && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-700">{lead.territory}</span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("leads.details")}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-400 text-xs">{t("leads.source")}</span>
                  <div className="text-slate-700">{lead.source || "-"}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">{t("leads.industry")}</span>
                  <div className="text-slate-700">{lead.industry || "-"}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">{t("leads.annual_revenue")}</span>
                  <div className="text-slate-700">
                    {lead.annual_revenue
                      ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(lead.annual_revenue)
                      : "-"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">{t("leads.id")}</span>
                  <div className="text-slate-700 text-xs font-mono">{lead.name}</div>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("leads.dates_title")}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-400 text-xs">{t("leads.created")}</span>
                  <div className="text-slate-700">{formatDate(lead.creation)}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">{t("leads.modified")}</span>
                  <div className="text-slate-700">{formatDate(lead.modified)}</div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {lead.notes && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("leads.notes")}</h4>
                <div
                  className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: lead.notes }}
                />
              </div>
            )}

            {/* ERPNext link */}
            <a
              href={`${getErpNextLinkUrl()}/lead/${lead.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark transition-colors text-sm font-medium"
            >
              <ExternalLink size={14} />
              {t("leads.edit_in_erpnext")}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
