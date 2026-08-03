import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchCount, fetchList, callMethod, getErpNextLinkUrl } from "../lib/erpnext";
import {
  FileText, RefreshCw, Filter, Clock, TrendingUp, Search,
  AlertTriangle, Send, ChevronDown, ChevronUp, ExternalLink, Plus,
  Mail, Check, Minus,
} from "lucide-react";
import InvoiceModal from "../components/InvoiceModal";
import SendInvoiceModal, { type SendInvoiceMode } from "../components/SendInvoiceModal";
import BulkSendDrawer from "../components/BulkSendDrawer";
import CompanySelect from "../components/CompanySelect";
import DateRangeFilter from "../components/DateRangeFilter";
import { useTranslation } from "react-i18next";
import ToInvoice from "./ToInvoice";
import { getActiveCompany } from "../lib/instances";

type SubTab = "openstaand" | "te-factureren" | "betalingstermijn" | "alle";

interface SalesInvoice {
  name: string;
  customer_name: string;
  contact_email: string;
  grand_total: number;
  net_total: number;
  outstanding_amount: number;
  posting_date: string;
  due_date: string;
  status: string;
  company: string;
  currency: string;
  docstatus: number;
  is_return: number;
  payment_terms_template: string;
  project: string;
}

interface PaidInvoice {
  name: string;
  customer_name: string;
  grand_total: number;
  posting_date: string;
  due_date: string;
  company: string;
  payment_terms_template: string;
  custom_date_paid: string;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function daysOpen(postingDate: string): number {
  return daysBetween(postingDate, new Date().toISOString().split("T")[0]);
}

function daysOverdue(dueDate: string): number {
  const today = new Date().toISOString().split("T")[0];
  if (dueDate >= today) return 0;
  return daysBetween(dueDate, today);
}

function agingBucket(days: number): string {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

const agingColors: Record<string, string> = {
  "0-30": "bg-green-500",
  "31-60": "bg-yellow-500",
  "61-90": "bg-orange-500",
  "90+": "bg-red-500",
};

const statusColors: Record<string, string> = {
  Draft: "bg-amber-100 text-amber-800",
  Overdue: "bg-red-100 text-red-700",
  "Partly Paid": "bg-yellow-100 text-yellow-700",
  Unpaid: "bg-y-teal/10 text-y-teal-dark",
  Paid: "bg-green-100 text-green-700",
  "Return": "bg-purple-100 text-purple-700",
  "Credit Note Issued": "bg-purple-100 text-purple-700",
  Cancelled: "bg-slate-100 text-slate-600",
};

type SortField = "name" | "customer_name" | "posting_date" | "due_date" | "net_total" | "outstanding_amount" | "daysOpen" | "daysOverdue";

export default function SalesInvoices() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: SubTab[] = ["openstaand", "te-factureren", "betalingstermijn", "alle"];
  const tabFromUrl = searchParams.get("tab");
  const statusFromUrl = searchParams.get("status");
  const initialTab: SubTab = (validTabs.includes(tabFromUrl as SubTab) ? tabFromUrl : "alle") as SubTab;
  const [subTab, _setSubTab] = useState<SubTab>(initialTab);
  function setSubTab(tab: SubTab) {
    _setSubTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  }
  const [count, setCount] = useState<number | null>(null);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [paidInvoices, setPaidInvoices] = useState<PaidInvoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPaid, setLoadingPaid] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState(getActiveCompany());
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("daysOverdue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  // Send-invoice modal state — a single modal serves both DRAFT (submit + send)
  // and SUBMITTED (resend) cases, controlled by `sendInvoiceMode`.
  const [sendInvoiceTarget, setSendInvoiceTarget] = useState<{ name: string; mode: SendInvoiceMode } | null>(null);
  // Bulk send: set of selected invoice names + open-drawer flag.
  const [selectedForSend, setSelectedForSend] = useState<Set<string>>(new Set());
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>(
    statusFromUrl ? statusFromUrl.split(",").filter(Boolean) : []
  );
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [showNewInvoice, setShowNewInvoice] = useState(false);

  // Sync URL when tab changes externally (back/forward) or when post-creation deep-link arrives.
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl as SubTab) && tabFromUrl !== subTab) {
      _setSubTab(tabFromUrl as SubTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  // Sync URL when status filter changes (kept in sync with the dropdown state).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (statusFilter.length > 0) next.set("status", statusFilter.join(","));
    else next.delete("status");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);
  const [emailMap, setEmailMap] = useState<Map<string, string>>(new Map());
  const [projectNameMap, setProjectNameMap] = useState<Map<string, string>>(new Map());
  // Standaardvenster: het lopende jaar (1 jan t/m vandaag). Het kwartaal
  // waar dit eerder op stond is te smal voor een facturenlijst — bij
  // binnenkomst toonde die 1 van de 8 openstaande facturen, wat makkelijk
  // te lezen is als "de lijst is leeg". De filter-UI is een simpel
  // van/tot-paar (DateRangeFilter), dus een jaarvenster is ook het
  // makkelijkst met de hand te versmallen. Gelijk aan het venster dat de
  // "te factureren"-subtab al gebruikt.
  const [fromDate, setFromDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Separate date range for the "te factureren" sub-tab. Defaults to
  // 1 jan of the current year through the last day of the last completed
  // month — the natural window for invoice prep.
  const [toInvoiceFromDate, setToInvoiceFromDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
  });
  const [toInvoiceToDate, setToInvoiceToDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based; previous full month = month index m
    if (m === 0) {
      // January → last full month is December previous year
      return `${y - 1}-12-31`;
    }
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  });

  function toggleStatus(s: string) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  // --- Data loading ---
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [
        ["docstatus", "=", 1],
        ["outstanding_amount", ">", 0],
      ];
      if (company) filters.push(["company", "=", company]);
      if (fromDate) filters.push(["posting_date", ">=", fromDate]);
      if (toDate) filters.push(["posting_date", "<=", toDate]);

      const [cnt, list] = await Promise.all([
        fetchCount("Sales Invoice", filters),
        fetchList<SalesInvoice>("Sales Invoice", {
          fields: [
            "name", "customer_name", "contact_email", "grand_total", "net_total",
            "outstanding_amount", "posting_date", "due_date", "status",
            "company", "currency", "is_return", "payment_terms_template", "project",
          ],
          filters,
          limit_page_length: 500,
          order_by: "posting_date desc",
        }),
      ]);
      setCount(cnt);
      setInvoices(list);
      void loadProjectNames(list.map((i) => i.project).filter(Boolean));

      // Fetch email communications for these invoices
      try {
        const comms = await fetchList<{ reference_name: string; communication_date: string; status: string }>("Communication", {
          fields: ["reference_name", "communication_date", "status"],
          filters: [
            ["reference_doctype", "=", "Sales Invoice"],
            ["communication_type", "=", "Communication"],
            ["sent_or_received", "=", "Sent"],
          ],
          limit_page_length: 2000,
          order_by: "communication_date desc",
        });

        // Build map: invoice name -> latest email date
        const map = new Map<string, string>();
        for (const comm of comms) {
          if (comm.reference_name && !map.has(comm.reference_name)) {
            map.set(comm.reference_name, comm.communication_date);
          }
        }
        setEmailMap(map);
      } catch (commError) {
        // Don't block invoice display if communications fail
        console.warn("Communication data could not be loaded:", commError);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  async function loadPaidInvoices() {
    setLoadingPaid(true);
    try {
      const filters: unknown[][] = [
        ["docstatus", "=", 1],
        ["outstanding_amount", "=", 0],
        ["status", "=", "Paid"],
      ];
      if (company) filters.push(["company", "=", company]);
      if (fromDate) filters.push(["posting_date", ">=", fromDate]);
      if (toDate) filters.push(["posting_date", "<=", toDate]);
      const list = await fetchList<PaidInvoice>("Sales Invoice", {
        fields: ["name", "customer_name", "grand_total", "posting_date", "due_date", "company", "payment_terms_template", "custom_date_paid"],
        filters,
        limit_page_length: 500,
        order_by: "posting_date desc",
      });
      setPaidInvoices(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoadingPaid(false);
    }
  }

  async function loadAllInvoices() {
    setLoadingAll(true);
    try {
      const filters: unknown[][] = [];
      if (company) filters.push(["company", "=", company]);
      if (statusFilter.length > 0) filters.push(["status", "in", statusFilter]);
      if (fromDate) filters.push(["posting_date", ">=", fromDate]);
      if (toDate) filters.push(["posting_date", "<=", toDate]);
      const list = await fetchList<SalesInvoice>("Sales Invoice", {
        fields: [
          "name", "customer_name", "contact_email", "grand_total", "net_total",
          "outstanding_amount", "posting_date", "due_date", "status", "docstatus",
          "company", "currency", "is_return", "payment_terms_template", "project",
        ],
        filters,
        limit_page_length: 500,
        order_by: "posting_date desc",
      });
      setAllInvoices(list);
      void loadProjectNames(list.map((i) => i.project).filter(Boolean));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoadingAll(false);
    }
  }

  async function loadProjectNames(projectIds: string[]) {
    const unique = Array.from(new Set(projectIds.filter(Boolean)));
    if (unique.length === 0) return;
    try {
      const list = await fetchList<{ name: string; project_name: string }>("Project", {
        fields: ["name", "project_name"],
        filters: [["name", "in", unique]],
        limit_page_length: unique.length,
      });
      setProjectNameMap((prev) => {
        const next = new Map(prev);
        for (const p of list) next.set(p.name, p.project_name);
        return next;
      });
    } catch (e) {
      console.warn("[SalesInvoices] loadProjectNames failed:", e);
    }
  }

  useEffect(() => { loadData(); }, [company, fromDate, toDate]);
  useEffect(() => { if (subTab === "betalingstermijn") loadPaidInvoices(); }, [subTab, company, fromDate, toDate]);
  useEffect(() => { if (subTab === "alle") loadAllInvoices(); }, [subTab, company, statusFilter, fromDate, toDate]);

  // --- Computed ---


  const totalOutstanding = invoices.reduce((s, i) => s + i.outstanding_amount, 0);
  const totalOverdue = invoices.filter((i) => i.status === "Overdue");
  const overdueAmount = totalOverdue.reduce((s, i) => s + i.outstanding_amount, 0);

  // Aging buckets
  const agingData = useMemo(() => {
    const buckets: Record<string, { count: number; amount: number }> = {
      "0-30": { count: 0, amount: 0 },
      "31-60": { count: 0, amount: 0 },
      "61-90": { count: 0, amount: 0 },
      "90+": { count: 0, amount: 0 },
    };
    for (const inv of invoices) {
      const days = daysOpen(inv.posting_date);
      const bucket = agingBucket(days);
      buckets[bucket].count++;
      buckets[bucket].amount += inv.outstanding_amount;
    }
    return buckets;
  }, [invoices]);

  // Sorted & filtered invoices for openstaand tab
  const sortedInvoices = useMemo(() => {
    let list = [...invoices];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.customer_name?.toLowerCase().includes(q) ||
          i.contact_email?.toLowerCase().includes(q) ||
          i.project?.toLowerCase().includes(q) ||
          projectNameMap.get(i.project)?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      switch (sortField) {
        case "name": va = a.name; vb = b.name; break;
        case "customer_name": va = a.customer_name || ""; vb = b.customer_name || ""; break;
        case "posting_date": va = a.posting_date; vb = b.posting_date; break;
        case "due_date": va = a.due_date || ""; vb = b.due_date || ""; break;
        case "net_total": va = a.net_total; vb = b.net_total; break;
        case "outstanding_amount": va = a.outstanding_amount; vb = b.outstanding_amount; break;
        case "daysOpen": va = daysOpen(a.posting_date); vb = daysOpen(b.posting_date); break;
        case "daysOverdue": va = daysOverdue(a.due_date); vb = daysOverdue(b.due_date); break;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return list;
  }, [invoices, search, sortField, sortDir, projectNameMap]);

  const filteredAllInvoices = useMemo(() => {
    if (!search.trim()) return allInvoices;
    const q = search.toLowerCase();
    return allInvoices.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q) ||
        i.contact_email?.toLowerCase().includes(q) ||
        i.project?.toLowerCase().includes(q) ||
        projectNameMap.get(i.project)?.toLowerCase().includes(q)
    );
  }, [allInvoices, search, projectNameMap]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  }

  async function sendReminder(inv: SalesInvoice) {
    if (!inv.contact_email) {
      alert(t("sales_invoices.no_email_available"));
      return;
    }
    setSendingReminder(inv.name);
    try {
      await callMethod("frappe.core.doctype.communication.email.make", {
        recipients: inv.contact_email,
        subject: t("sales_invoices.payment_reminder_subject", { name: inv.name }),
        content: t("sales_invoices.reminder_email_body", {
          name: inv.name,
          amount: `\u20AC ${inv.outstanding_amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`,
          due_date: inv.due_date,
        }),
        doctype: "Sales Invoice",
        name: inv.name,
        send_email: 1,
      });
      alert(t("sales_invoices.reminder_sent_to", { email: inv.contact_email }));
    } catch (e) {
      alert(t("sales_invoices.generic_error", { message: e instanceof Error ? e.message : t("common.unknown") }));
    } finally {
      setSendingReminder(null);
    }
  }

  // --- Payment term analytics ---
  const paymentStats = useMemo(() => {
    const withDays = paidInvoices
      .map((inv) => {
        if (!inv.posting_date) return null;
        // Use actual payment date if available, otherwise fall back to due_date
        const payDate = inv.custom_date_paid || inv.due_date;
        if (!payDate) return null;
        const days = daysBetween(inv.posting_date, payDate);
        const termDays = inv.due_date ? daysBetween(inv.posting_date, inv.due_date) : null;
        return days >= 0 ? { ...inv, days, termDays } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (withDays.length === 0) return { avg: 0, median: 0, min: 0, max: 0, count: 0, byCustomer: [], byMonth: [] };

    const sorted = [...withDays].sort((a, b) => a.days - b.days);
    const avg = Math.round(sorted.reduce((s, x) => s + x.days, 0) / sorted.length);
    const median = sorted[Math.floor(sorted.length / 2)].days;

    const custMap = new Map<string, number[]>();
    for (const inv of withDays) {
      if (!custMap.has(inv.customer_name)) custMap.set(inv.customer_name, []);
      custMap.get(inv.customer_name)!.push(inv.days);
    }
    const byCustomer = Array.from(custMap.entries())
      .map(([customer, days]) => ({
        customer,
        avg: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
        count: days.length,
        min: Math.min(...days),
        max: Math.max(...days),
      }))
      .sort((a, b) => b.avg - a.avg);

    const monthMap = new Map<string, number[]>();
    for (const inv of withDays) {
      const month = inv.posting_date.slice(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, []);
      monthMap.get(month)!.push(inv.days);
    }
    const byMonth = Array.from(monthMap.entries())
      .map(([month, days]) => ({
        month,
        avg: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
        count: days.length,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { avg, median, min: sorted[0].days, max: sorted[sorted.length - 1].days, count: withDays.length, byCustomer, byMonth };
  }, [paidInvoices]);

  const maxMonthAvg = Math.max(...paymentStats.byMonth.map((m) => m.avg), 1);
  const maxAgingAmount = Math.max(...Object.values(agingData).map((b) => b.amount), 1);

  const isLoading = loading || loadingPaid || loadingAll;

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t("sales_invoices.title")}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewInvoice(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <Plus size={16} />
            {t("sales_invoices.new_invoice", { defaultValue: "Nieuwe factuur" })}
          </button>
          <a
            href={`${getErpNextLinkUrl()}/sales-invoice?company=${encodeURIComponent(company)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <ExternalLink size={14} /> ERPNext
          </a>
          <button
            onClick={() => { loadData(); if (subTab === "betalingstermijn") loadPaidInvoices(); if (subTab === "alle") loadAllInvoices(); }}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> {t("common.refresh")}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 bg-slate-200 rounded-lg p-1 w-fit">
        {(["alle", "openstaand", "te-factureren", "betalingstermijn"] as SubTab[]).map((tab) => (
          <button key={tab} onClick={() => setSubTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer capitalize ${
              subTab === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {tab === "openstaand" ? t("sales_invoices.tab_outstanding") : tab === "te-factureren" ? t("sales_invoices.tab_to_invoice") : tab === "betalingstermijn" ? t("sales_invoices.tab_payment_terms") : t("sales_invoices.tab_all")}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      {/* Company filter */}
      <div className="mb-4 flex items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <CompanySelect value={company} onChange={setCompany} />
        <DateRangeFilter
          fromDate={subTab === "te-factureren" ? toInvoiceFromDate : fromDate}
          toDate={subTab === "te-factureren" ? toInvoiceToDate : toDate}
          onFromChange={subTab === "te-factureren" ? setToInvoiceFromDate : setFromDate}
          onToChange={subTab === "te-factureren" ? setToInvoiceToDate : setToDate}
        />
        {subTab === "alle" && (
          <div className="relative">
            <button
              onClick={() => setStatusDropdownOpen((o) => !o)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal flex items-center gap-2 cursor-pointer"
            >
              {statusFilter.length === 0
                ? t("common.all_statuses")
                : t("sales_invoices.statuses_selected", { count: statusFilter.length })}
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {statusDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[180px]">
                  {["Draft", "Overdue", "Partly Paid", "Unpaid", "Paid", "Return", "Credit Note Issued", "Cancelled"].map((s) => (
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
        )}
      </div>

      {/* ===================== OPENSTAAND TAB ===================== */}
      {subTab === "openstaand" && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-y-teal/10 rounded-lg"><FileText className="text-y-teal" size={20} /></div>
                <p className="text-sm text-slate-500">{t("sales_invoices.outstanding")}</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">{loading ? "..." : count}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-green-100 rounded-lg"><FileText className="text-green-600" size={20} /></div>
                <p className="text-sm text-slate-500">{t("outstanding.total_outstanding")}</p>
              </div>
              <p className="text-2xl font-bold text-slate-800">{loading ? "..." : `\u20AC ${totalOutstanding.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="text-red-600" size={20} /></div>
                <p className="text-sm text-slate-500">{t("sales_invoices.overdue")}</p>
              </div>
              <p className="text-3xl font-bold text-red-600">{loading ? "..." : totalOverdue.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-orange-100 rounded-lg"><Clock className="text-orange-600" size={20} /></div>
                <p className="text-sm text-slate-500">{t("sales_invoices.overdue_amount")}</p>
              </div>
              <p className="text-2xl font-bold text-red-600">{loading ? "..." : `\u20AC ${overdueAmount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}</p>
            </div>
          </div>

          {/* Aging Analysis */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">{t("sales_invoices.aging_analysis")}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(agingData).map(([bucket, data]) => (
                <div key={bucket} className="text-center">
                  <div className="h-20 flex items-end justify-center mb-2">
                    <div
                      className={`w-12 ${agingColors[bucket]} rounded-t transition-all`}
                      style={{ height: `${Math.max((data.amount / maxAgingAmount) * 100, 4)}%` }}
                    />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{t("sales_invoices.aging_days_label", { range: bucket })}</p>
                  <p className="text-xs text-slate-500">{t("sales_invoices.invoices_short", { count: data.count })}</p>
                  <p className="text-xs font-medium text-slate-600">{`\u20AC ${data.amount.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="mb-4 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder={t("sales_invoices.search_placeholder")}
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-y-teal text-sm" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {([
                    ["name", t("sales_invoices.invoice_nr")],
                    ["customer_name", t("sales_invoices.customer")],
                    ["posting_date", t("sales_invoices.invoice_date")],
                    ["due_date", t("sales_invoices.col_due_date")],
                    ["daysOpen", t("sales_invoices.col_days_open")],
                    ["daysOverdue", t("sales_invoices.col_days_overdue")],
                    ["net_total", t("sales_invoices.col_amount_excl_vat")],
                    ["outstanding_amount", t("sales_invoices.outstanding")],
                  ] as [SortField, string][]).map(([field, label]) => (
                    <th key={field} onClick={() => toggleSort(field)}
                      className={`${field === "net_total" || field === "outstanding_amount" || field === "daysOpen" || field === "daysOverdue" ? "text-right" : "text-left"} px-3 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-800 select-none`}>
                      <span className="inline-flex items-center gap-1">{label} <SortIcon field={field} /></span>
                    </th>
                  ))}
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.col_project")}</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.col_project_name")}</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.col_term")}</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-1"><Mail size={14} /> {t("sales_invoices.col_email_status")}</span></th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("projects.detail.status")}</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.col_action")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={15} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td></tr>
                ) : sortedInvoices.length === 0 ? (
                  <tr><td colSpan={15} className="px-4 py-8 text-center text-slate-400">{t("sales_invoices.no_invoices")}</td></tr>
                ) : sortedInvoices.map((inv) => {
                  const open = daysOpen(inv.posting_date);
                  const overdue = daysOverdue(inv.due_date);
                  return (
                    <tr key={inv.name} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-sm font-medium">
                        <button onClick={() => setSelectedInvoice(inv)}
                          className="text-y-teal hover:text-y-teal-dark hover:underline cursor-pointer">
                          {inv.name}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-700">{inv.customer_name}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-500">{inv.posting_date}</td>
                      <td className={`px-3 py-2.5 text-sm ${overdue > 0 ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                        {inv.due_date}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-600 text-right">{open}</td>
                      <td className="px-3 py-2.5 text-sm text-right">
                        {overdue > 0 ? (
                          <span className="text-red-600 font-semibold">{overdue}</span>
                        ) : (
                          <span className="text-green-600">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-700 text-right">
                        {`\u20AC ${inv.net_total.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-semibold text-orange-600 text-right">
                        {`\u20AC ${inv.outstanding_amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-700">{inv.project || "-"}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-500">{projectNameMap.get(inv.project) || "-"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">
                        {inv.payment_terms_template || "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        {emailMap.has(inv.name) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            <Check size={12} /> {t("sales_invoices.sent")}
                            <span className="text-green-600 font-normal ml-0.5">{emailMap.get(inv.name)?.split(" ")[0]}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            <Minus size={12} /> {t("sales_invoices.not_sent")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[inv.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {overdue > 0 && inv.contact_email && (
                          <button
                            onClick={() => sendReminder(inv)}
                            disabled={sendingReminder === inv.name}
                            title={t("sales_invoices.send_reminder_to", { email: inv.contact_email })}
                            className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg cursor-pointer disabled:opacity-50"
                          >
                            <Send size={14} className={sendingReminder === inv.name ? "animate-pulse" : ""} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary row */}
          {!loading && sortedInvoices.length > 0 && (
            <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg flex items-center justify-between text-sm">
              <span className="text-slate-500">{t("sales_invoices.invoices_count_short", { count: sortedInvoices.length })}</span>
              <span className="font-semibold text-slate-700">
                {t("sales_invoices.total_outstanding_label")}: {`\u20AC ${sortedInvoices.reduce((s, i) => s + i.outstanding_amount, 0).toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
              </span>
            </div>
          )}
        </>
      )}

      {/* ===================== TO INVOICE TAB ===================== */}
      {subTab === "te-factureren" && (
        <ToInvoice
          company={company}
          fromDate={toInvoiceFromDate}
          toDate={toInvoiceToDate}
          onFromChange={setToInvoiceFromDate}
          onToChange={setToInvoiceToDate}
        />
      )}

      {/* ===================== BETALINGSTERMIJN TAB ===================== */}
      {subTab === "betalingstermijn" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: t("sales_invoices.kpi_average"), value: paymentStats.avg, bg: "bg-blue-100", text: "text-blue-600", icon: Clock },
              { label: t("sales_invoices.kpi_median"), value: paymentStats.median, bg: "bg-purple-100", text: "text-purple-600", icon: TrendingUp },
              { label: t("sales_invoices.kpi_fastest"), value: paymentStats.min, bg: "bg-green-100", text: "text-green-600", icon: Clock },
              { label: t("sales_invoices.kpi_slowest"), value: paymentStats.max, bg: "bg-red-100", text: "text-red-600", icon: Clock },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 ${kpi.bg} rounded-lg`}><kpi.icon className={kpi.text} size={20} /></div>
                  <p className="text-sm text-slate-500">{kpi.label}</p>
                </div>
                <p className="text-3xl font-bold text-slate-800">
                  {loadingPaid ? "..." : kpi.value}<span className="text-base font-normal text-slate-400 ml-1">{t("common.days")}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-700 mb-4">{t("sales_invoices.avg_payment_time")}</h3>
            {loadingPaid ? <div className="h-48 flex items-center justify-center text-slate-400">{t("common.loading")}</div>
            : paymentStats.byMonth.length === 0 ? <div className="h-48 flex items-center justify-center text-slate-400">{t("sales_invoices.no_data")}</div>
            : (
              <div className="flex items-end gap-2 h-48">
                {paymentStats.byMonth.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div className="absolute -top-8 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {t("sales_invoices.month_tooltip", { month: m.month, avg: m.avg, count: m.count })}
                    </div>
                    <span className="text-xs text-slate-600 font-medium mb-1">{m.avg}d</span>
                    <div className="w-full bg-y-teal/100 rounded-t hover:bg-y-teal transition-colors min-h-[4px]"
                      style={{ height: `${(m.avg / maxMonthAvg) * 80}%` }} />
                    <span className="text-[10px] text-slate-400 mt-1">{m.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-600">{t("sales_invoices.payment_time_per_customer")}</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t("sales_invoices.customer")}</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">{t("sales_invoices.col_invoices")}</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">{t("sales_invoices.avg_days")}</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">{t("sales_invoices.col_min")}</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">{t("sales_invoices.col_max")}</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600 w-48">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {loadingPaid ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td></tr>
                : paymentStats.byCustomer.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t("sales_invoices.no_data")}</td></tr>
                : paymentStats.byCustomer.map((c) => {
                  const maxDays = paymentStats.byCustomer[0]?.avg || 1;
                  const bar = c.avg <= 30 ? "bg-green-500" : c.avg <= 60 ? "bg-yellow-500" : "bg-red-500";
                  return (
                    <tr key={c.customer} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium">{c.customer}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 text-right">{c.count}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">{c.avg}d</td>
                      <td className="px-4 py-3 text-sm text-slate-500 text-right">{c.min}d</td>
                      <td className="px-4 py-3 text-sm text-slate-500 text-right">{c.max}d</td>
                      <td className="px-4 py-3"><div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${bar} rounded-full`} style={{ width: `${(c.avg / maxDays) * 100}%` }} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===================== ALLE FACTUREN TAB ===================== */}
      {subTab === "alle" && (
        <>
        <div className="mb-4 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={t("sales_invoices.search_placeholder")}
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-y-teal text-sm" />
        </div>
        {selectedForSend.size > 0 && (
          <div className="mb-3 px-4 py-2 bg-y-teal/10 border border-y-teal/30 rounded-lg flex items-center justify-between">
            <span className="text-sm text-slate-700">
              {t("invoice_email.selected_count", {
                count: selectedForSend.size,
                defaultValue: `${selectedForSend.size} geselecteerd`,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedForSend(new Set())}
                className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900">
                {t("common.clear", { defaultValue: "Wissen" })}
              </button>
              <button onClick={() => setBulkDrawerOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-y-teal hover:bg-y-teal-dark rounded cursor-pointer">
                <Send size={12} />
                {t("invoice_email.bulk_send", { defaultValue: "Verstuur geselecteerde" })}
              </button>
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.invoice_nr")}</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.customer")}</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.col_project")}</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.col_project_name")}</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("common.date")}</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.col_due_date")}</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.col_amount_excl_vat")}</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600">{t("sales_invoices.outstanding")}</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-1"><Mail size={14} /> {t("sales_invoices.col_email")}</span></th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">{t("projects.detail.status")}</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-600 w-10">
                  <input type="checkbox"
                    title={t("invoice_email.select_all_sendable", { defaultValue: "Selecteer alle verzendbare facturen" })}
                    checked={(() => {
                      const sendable = filteredAllInvoices.filter((i) => i.docstatus === 1 && i.contact_email);
                      return sendable.length > 0 && sendable.every((i) => selectedForSend.has(i.name));
                    })()}
                    onChange={(e) => {
                      const sendable = filteredAllInvoices.filter((i) => i.docstatus === 1 && i.contact_email).map((i) => i.name);
                      setSelectedForSend((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) sendable.forEach((n) => next.add(n));
                        else sendable.forEach((n) => next.delete(n));
                        return next;
                      });
                    }} />
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">Acties</th>
              </tr>
            </thead>
            <tbody>
              {loadingAll ? <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td></tr>
              : filteredAllInvoices.length === 0 ? <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">{t("sales_invoices.no_invoices_all")}</td></tr>
              : filteredAllInvoices.map((inv) => (
                <tr key={inv.name} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-sm font-medium">
                    <button onClick={() => setSelectedInvoice(inv)} className="text-y-teal hover:text-y-teal-dark hover:underline cursor-pointer">{inv.name}</button>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-700">{inv.customer_name}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-700">{inv.project || "-"}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-500">{projectNameMap.get(inv.project) || "-"}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-500">{inv.posting_date}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-500">{inv.due_date}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-700 text-right">{`\u20AC ${inv.net_total.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}</td>
                  <td className="px-3 py-2.5 text-sm text-right">{inv.outstanding_amount > 0 ? <span className="font-semibold text-orange-600">{`\u20AC ${inv.outstanding_amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}</span> : <span className="text-green-600">-</span>}</td>
                  <td className="px-3 py-2.5">
                    {emailMap.has(inv.name) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                        <Check size={12} /> {t("sales_invoices.sent")}
                        <span className="text-green-600 font-normal ml-0.5">{emailMap.get(inv.name)?.split(" ")[0]}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                        <Minus size={12} /> {t("sales_invoices.not_sent")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5"><span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[inv.status] ?? "bg-slate-100 text-slate-600"}`}>{inv.status}</span></td>
                  <td className="px-3 py-2.5 text-center">
                    {inv.docstatus === 1 && inv.contact_email && (
                      <input type="checkbox"
                        checked={selectedForSend.has(inv.name)}
                        onChange={(e) => {
                          setSelectedForSend((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(inv.name);
                            else next.delete(inv.name);
                            return next;
                          });
                        }} />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      {inv.docstatus === 0 && (
                        <>
                          <button onClick={() => setSelectedInvoice(inv)}
                            className="px-2 py-1 text-[10px] font-medium bg-y-teal/10 text-y-teal-dark rounded hover:bg-y-teal/20 cursor-pointer">
                            Review
                          </button>
                          {inv.contact_email && (
                            <button onClick={() => setSendInvoiceTarget({ name: inv.name, mode: "draft" })}
                              className="px-2 py-1 text-[10px] font-medium bg-amber-50 text-amber-700 rounded hover:bg-amber-100 cursor-pointer">
                              {t("invoice_email.submit_and_send_short", { defaultValue: "Inboeken & Verstuur" })}
                            </button>
                          )}
                        </>
                      )}
                      {inv.docstatus === 1 && inv.contact_email && (
                        <button onClick={() => setSendInvoiceTarget({ name: inv.name, mode: "submitted" })}
                          className={`px-2 py-1 text-[10px] font-medium rounded cursor-pointer ${emailMap.has(inv.name) ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-y-teal/10 text-y-teal-dark hover:bg-y-teal/20"}`}>
                          {emailMap.has(inv.name)
                            ? t("invoice_email.resend", { defaultValue: "Opnieuw" })
                            : t("invoice_email.send", { defaultValue: "Versturen" })}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {selectedInvoice && (
        <InvoiceModal
          doctype="Sales Invoice"
          name={selectedInvoice.name}
          title={selectedInvoice.customer_name}
          onClose={() => {
            setSelectedInvoice(null);
            // Refresh whichever list is currently visible so a newly-created
            // draft shows up in the table.
            loadData();
            if (subTab === "alle") loadAllInvoices();
          }}
        />
      )}

      {showNewInvoice && (
        <InvoiceModal
          doctype="Sales Invoice"
          company={company}
          title="Nieuwe factuur"
          onClose={() => {
            setShowNewInvoice(false);
            loadData();
            if (subTab === "alle") loadAllInvoices();
          }}
        />
      )}

      {sendInvoiceTarget && (
        <SendInvoiceModal
          invoiceName={sendInvoiceTarget.name}
          mode={sendInvoiceTarget.mode}
          onClose={() => setSendInvoiceTarget(null)}
          onSent={() => {
            loadData();
            if (subTab === "alle") loadAllInvoices();
          }}
        />
      )}

      {bulkDrawerOpen && (
        <BulkSendDrawer
          invoiceNames={Array.from(selectedForSend)}
          onClose={() => setBulkDrawerOpen(false)}
          onCompleted={() => {
            setSelectedForSend(new Set());
            setBulkDrawerOpen(false);
            loadData();
            if (subTab === "alle") loadAllInvoices();
          }}
        />
      )}
    </div>
  );
}
