import { Fragment, useEffect, useRef, useState } from "react";
import { fetchAttachments, fetchDocument, fetchList, updateDocument, createDocument, callMethod, getErpNextLinkUrl, type FileInfo } from "../lib/erpnext";
import { X, Paperclip, FileText, Download, ExternalLink, ChevronRight, Save, Plus, Trash2, Check, Mail, Briefcase, Search, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import CustomerSearchSelect, { type Customer } from "./CustomerSearchSelect";
import ItemSearchSelect, { type QuotationItem } from "./ItemSearchSelect";
import SendInvoiceModal, { type SendInvoiceMode } from "./SendInvoiceModal";
import InvoicePreview from "./InvoicePreview";
import { useCompanies } from "../lib/DataContext";

interface InvoiceModalProps {
  doctype: string;
  /** Omit / leave blank to open in "new" mode — same UI, empty fields, with
   *  a "Maak factuur" button at the bottom that creates the doc in ERPNext. */
  name?: string;
  title?: string;
  /** Active company — only used in new mode (pre-fills `doc.company`). */
  company?: string;
  onClose: () => void;
}

interface SalesInvoiceItem {
  name?: string;
  item_code?: string;
  item_name?: string;
  description?: string;
  qty: number;
  uom?: string;
  rate: number;
  amount: number;
}

interface SalesInvoiceTimesheet {
  name?: string;
  time_sheet: string;
  timesheet_detail?: string;
  activity_type?: string;
  description?: string;
  billing_hours: number;
  from_time?: string;
  to_time?: string;
  project_name?: string;
}

/** Enriched timesheet row — combines invoice-side data with the parent Timesheet's employee + the specific time_log's task. */
interface EnrichedTimesheetRow extends SalesInvoiceTimesheet {
  employee_name?: string;
  task?: string;
  task_name?: string;
  log_description?: string;
}

interface SalesInvoiceTax {
  name?: string;
  description?: string;
  rate?: number;
  tax_amount?: number;
}

interface SalesInvoiceDoc {
  name: string;
  status: string;
  docstatus: number;
  /** ERPNext-timestamp van laatste server-side wijziging. Gebruiken we
   *  als refreshToken voor InvoicePreview zodat de PDF refresht na elke save. */
  modified?: string;
  customer: string;
  customer_name: string;
  contact_email?: string;
  posting_date: string;
  due_date: string;
  project?: string;
  company: string;
  currency: string;
  net_total: number;
  total_taxes_and_charges: number;
  grand_total: number;
  outstanding_amount: number;
  paid_amount?: number;
  payment_terms_template?: string;
  taxes_and_charges?: string;
  remarks?: string;
  is_return?: number;
  items?: SalesInvoiceItem[];
  timesheets?: SalesInvoiceTimesheet[];
  taxes?: SalesInvoiceTax[];
}

const statusColors: Record<string, string> = {
  Draft: "bg-amber-100 text-amber-800",
  Overdue: "bg-red-100 text-red-700",
  "Partly Paid": "bg-yellow-100 text-yellow-700",
  Unpaid: "bg-y-teal/10 text-y-teal-dark",
  Paid: "bg-green-100 text-green-700",
  Return: "bg-purple-100 text-purple-700",
  "Credit Note Issued": "bg-purple-100 text-purple-700",
  Cancelled: "bg-slate-100 text-slate-600",
};

/**
 * Maakt een leesbare één-regel error van een ERPNext exception-string.
 *
 * ERPNext stuurt fouten meestal terug als een JSON-array met de volledige
 * Python-traceback erin. De daadwerkelijke validatie-melding zit op de
 * laatste regel ("Error:" / "Exception:"); alles daarboven is stack-info
 * waarmee een eindgebruiker niets kan. We splitsen die twee in een korte
 * summary (banner) en een optionele detail-blob (collapsible).
 */
function summarizeErpnextError(raw: string): { summary: string; detail: string } {
  if (!raw) return { summary: "", detail: "" };
  let cleaned = raw;
  // Strip eventuele "Opslaan mislukt: " of vergelijkbare prefix.
  cleaned = cleaned.replace(/^[^:]*mislukt:\s*/i, "");
  // ERPNext serializeert traceback vaak als JSON-array van strings.
  if (/^\[.*\]$/s.test(cleaned.trim())) {
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) cleaned = parsed.map((s) => String(s)).join("\n");
    } catch { /* niet geldig JSON, laat staan */ }
  }
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  // Laatste regel met "Error:" of "Exception:" is meestal de echte melding.
  const errLine = [...lines].reverse().find((l) => /(?:Error|Exception):/.test(l));
  if (errLine) {
    // Strip module-pad: "frappe.exceptions.ValidationError: foo" → "ValidationError: foo"
    const summary = errLine.replace(/^.*?([A-Z][A-Za-z]*(?:Error|Exception):)/, "$1");
    return { summary, detail: raw };
  }
  // Geen herkenbare error-regel — eerste 200 chars als summary.
  return { summary: cleaned.slice(0, 200), detail: raw };
}

function formatMoney(amount: number, currency = "EUR"): string {
  const symbol = currency === "EUR" ? "€" : currency;
  return `${symbol} ${amount.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatHours(h: number): string {
  return h.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

interface ProjectOption {
  name: string;
  project_name?: string;
  customer?: string;
}

function ProjectPicker({
  value,
  customer,
  onChange,
}: {
  value: ProjectOption | null;
  /** Customer.name (ERPNext ID) to default-filter the project list on. */
  customer: string;
  onChange: (project: ProjectOption | null) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  /** When true: ignore the customer-filter and search across all projects. */
  const [showAll, setShowAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    // Trigger search on query change, customer change, or filter-toggle change.
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const filters: unknown[][] = [["status", "!=", "Cancelled"]];
        if (!showAll && customer) filters.push(["customer", "=", customer]);
        const orFilters: unknown[][] = query.trim().length >= 2 ? [
          ["project_name", "like", `%${query}%`],
          ["name", "like", `%${query}%`],
        ] : [];
        const list = await fetchList<ProjectOption>("Project", {
          fields: ["name", "project_name", "customer"],
          filters,
          or_filters: orFilters.length ? orFilters : undefined,
          limit_page_length: 30,
          order_by: "modified desc",
        });
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, customer, showAll]);

  const mismatched = value && customer && value.customer && value.customer !== customer;

  if (value) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-2 py-1 border border-slate-200 rounded bg-slate-50">
          <Briefcase size={12} className="text-y-teal flex-shrink-0" />
          <span className="text-xs flex-1 truncate" title={`${value.name}${value.project_name ? " · " + value.project_name : ""}`}>
            <span className="font-medium text-slate-700">{value.name}</span>
            {value.project_name && value.project_name !== value.name && (
              <span className="text-slate-500"> · {value.project_name}</span>
            )}
          </span>
          <button
            onClick={() => onChange(null)}
            className="p-0.5 text-slate-400 hover:text-red-500 cursor-pointer"
            title={t("common.clear", { defaultValue: "Wissen" })}
          >
            <X size={12} />
          </button>
        </div>
        {mismatched && (
          <div className="flex items-start gap-1 text-[10px] text-amber-700">
            <AlertTriangle size={10} className="flex-shrink-0 mt-0.5" />
            <span>
              {t("invoice_modal.project_other_customer", {
                defaultValue: "Project hoort bij klant {{customer}}.",
                customer: value.customer,
              })}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t("invoice_modal.project_placeholder", { defaultValue: "Zoek project..." })}
          className="w-full pl-7 pr-7 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-y-teal"
        />
        {loading && <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-72 overflow-y-auto">
          {customer && (
            <div className="px-2 py-1.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-[10px] text-slate-500">
                {showAll
                  ? t("invoice_modal.project_showing_all", { defaultValue: "Alle projecten" })
                  : t("invoice_modal.project_filtered_by_customer", { defaultValue: "Gefilterd op klant" })}
              </span>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-[10px] text-y-teal hover:underline cursor-pointer"
              >
                {showAll
                  ? t("invoice_modal.project_filter_by_customer", { defaultValue: "Filter op klant" })
                  : t("invoice_modal.project_show_all", { defaultValue: "Toon alle" })}
              </button>
            </div>
          )}
          {results.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => { onChange(p); setOpen(false); setQuery(""); }}
              className="w-full text-left px-2 py-1.5 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
            >
              <Briefcase size={12} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 truncate">
                  <span className="font-medium">{p.name}</span>
                  {p.project_name && p.project_name !== p.name && (
                    <span className="text-slate-500"> · {p.project_name}</span>
                  )}
                </p>
                {p.customer && p.customer !== customer && (
                  <p className="text-[10px] text-amber-600 truncate">{p.customer}</p>
                )}
              </div>
            </button>
          ))}
          {!loading && results.length === 0 && (
            <div className="px-2 py-3 text-center text-[10px] text-slate-400">
              {t("invoice_modal.project_none_found", { defaultValue: "Geen projecten gevonden" })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InvoiceModal({
  doctype,
  name,
  title,
  company,
  onClose,
}: InvoiceModalProps) {
  const { t } = useTranslation();
  // `currentName` is the source of truth for "which doc am I showing".
  // Starts as the prop; switches to the freshly created name after a
  // successful "Maak factuur" so the modal flips to edit-mode in place.
  const [currentName, setCurrentName] = useState<string>(name ?? "");
  const isNewMode = !currentName;
  const [doc, setDoc] = useState<SalesInvoiceDoc | null>(null);
  const [attachments, setAttachments] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(!isNewMode);
  const [error, setError] = useState<string | null>(null);
  // Schaduw-state van het in InvoicePreview geselecteerde Print Format —
  // alleen nodig zodat isRowPrintedOnInvoice (edit-mode badges op uren-
  // rijen) weet welk format actief is. InvoicePreview pusht updates via
  // de onFormatChange callback.
  const [printFormat, setPrintFormat] = useState<string>("3BM Factuur+Smart Urenstaat");
  // New-mode only: customer picked via CustomerSearchSelect; mirrors into
  // doc.customer / doc.customer_name on change.
  const [pickedCustomer, setPickedCustomer] = useState<Customer | null>(null);
  // New-mode only: project picked via ProjectPicker; mirrors into doc.project.
  // Customer-mismatch warning lives inside ProjectPicker itself.
  const [pickedProject, setPickedProject] = useState<ProjectOption | null>(null);
  // Factuur vs creditnota. ERPNext slaat creditnota op met is_return=1;
  // qty op items mag dan negatief zijn. In draft mode (docstatus=0) is dit
  // ook toggleable — submitten van een credit/regulier verschil daarna kan
  // alleen via ERPNext desk.
  const [isCreditNote, setIsCreditNote] = useState<boolean>(false);
  // Project name (apart opgehaald — Sales Invoice geeft alleen de project ID).
  const [projectName, setProjectName] = useState<string>("");
  // BTW-templates + Payment Terms-templates (beide gefilterd op company).
  const [taxTemplates, setTaxTemplates] = useState<Array<{ name: string; title?: string }>>([]);
  const [paymentTermsTemplates, setPaymentTermsTemplates] = useState<Array<{ name: string }>>([]);
  const [creating, setCreating] = useState(false);
  // "Akkoord" → submitter the draft Sales Invoice (docstatus 0 → 1). After
  // submit, the "Mail" button switches from "Inboeken & Verstuur" to
  // "Versturen" — both open the SendInvoiceModal below.
  const [submitting, setSubmitting] = useState(false);
  // Mode-aware trigger for SendInvoiceModal: "draft" submits first, then sends;
  // "submitted" only sends.
  const [sendModalMode, setSendModalMode] = useState<SendInvoiceMode | null>(null);

  async function handleSubmitInvoice() {
    if (!doc || !currentName || doc.docstatus !== 0) return;
    if (!confirm("Factuur akkoord geven en inboeken? Dit kan niet ongedaan gemaakt worden via Y-app.")) return;
    setSubmitting(true);
    setError(null);
    try {
      // Frappe v15+ `frappe.client.submit` expects the full doc as a JSON
      // string (zelfde signature als Timesheet-goedkeuren en Travel Request).
      const fresh = await fetchDocument<SalesInvoiceDoc>(doctype, currentName);
      await callMethod("frappe.client.submit", { doc: JSON.stringify(fresh) });
      const updated = await fetchDocument<SalesInvoiceDoc>(doctype, currentName);
      setDoc(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }
  // Editable buffer for inline item edits. Keyed by child-row name. The user
  // edits cells here; flush gebeurt centraal via saveDraft (header-knop
  // "Opslaan") of bij submit. Geen per-rij save meer.
  const [editBuf, setEditBuf] = useState<Record<string, Partial<SalesInvoiceItem>>>({});

  // Header-level edits (customer). Saved on blur if changed.
  const [customerDraft, setCustomerDraft] = useState<string>("");
  const [savingHeader, setSavingHeader] = useState(false);
  useEffect(() => { if (doc) setCustomerDraft(doc.customer || ""); }, [doc?.customer]);

  // Sync local state vanuit het geladen doc — zodat de UI-controls de echte
  // doc-waarden tonen wanneer een bestaande factuur wordt geopend.
  useEffect(() => {
    if (doc?.is_return !== undefined) setIsCreditNote(!!doc.is_return);
  }, [doc?.is_return]);
  useEffect(() => {
    if (!isNewMode && doc?.customer && !pickedCustomer) {
      setPickedCustomer({ name: doc.customer, customer_name: doc.customer_name || doc.customer });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.customer, doc?.customer_name, isNewMode]);

  // Project-name lookup. Sales Invoice slaat alleen de project ID op; we
  // willen 'm naast die ID ook met titel kunnen tonen.
  useEffect(() => {
    if (!doc?.project) { setProjectName(""); return; }
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchDocument<{ project_name?: string }>("Project", doc.project!);
        if (!cancelled) setProjectName(p.project_name || "");
      } catch { /* silent — toont alleen ID */ }
    })();
    return () => { cancelled = true; };
  }, [doc?.project]);

  // Editable-predicate: in nieuw mode of bij een nog niet ingeboekte draft
  // (docstatus 0). Submitted invoices (docstatus 1) zijn gelocked.
  const canEdit = isNewMode || doc?.docstatus === 0;

  // Beschikbare companies voor de bedrijf-dropdown. useCompanies prefetched
  // in DataContext, dus instant beschikbaar.
  const companies = useCompanies();

  // Staged header-updates voor draft mode: wijzigingen worden lokaal in doc
  // gezet én apart bijgehouden in pendingHeaderUpdates. Pas wanneer de
  // gebruiker op "Opslaan" klikt gaat alles in één keer naar ERPNext.
  // Voorkomt dat de PDF-preview tussendoor refresht op halve wijzigingen,
  // en dat de gebruiker met meerdere save-flows te maken krijgt.
  const [pendingHeaderUpdates, setPendingHeaderUpdates] = useState<Partial<SalesInvoiceDoc>>({});

  // Expliciete teller die na elke succesvolle save +1 doet. Gebruikt als
  // (deel van) de refreshToken voor InvoicePreview — vertrouwen op alleen
  // doc.modified bleek niet altijd te werken (ERPNext kan dezelfde
  // timestamp teruggeven binnen dezelfde seconde, response-cache kon de
  // oude waarde teruggeven). Een lokale counter is bulletproof.
  const [saveCounter, setSaveCounter] = useState(0);

  function stageHeader(patch: Partial<SalesInvoiceDoc>) {
    if (!doc) return;
    setDoc({ ...doc, ...patch });
    if (isNewMode || doc.docstatus !== 0) return;
    setPendingHeaderUpdates((prev) => ({ ...prev, ...patch }));
  }

  // Globale dirty-state: ofwel header-velden zijn gestaged, ofwel rij-edits
  // wachten nog in editBuf. Gebruikt om Akkoord/Inboeken te verbergen en
  // "Opslaan" te tonen.
  const anyDirty =
    !isNewMode &&
    doc?.docstatus === 0 &&
    (Object.keys(pendingHeaderUpdates).length > 0 ||
      Object.values(editBuf).some((p) => p && Object.keys(p).length > 0));

  /** Persist all staged changes (header + rows + deletes/adds) naar ERPNext
   *  in één call. Gebruikt de LOKALE doc.items als source-of-truth — zo
   *  worden verwijderde rijen ook server-side opgeruimd, en blijven nieuw
   *  toegevoegde rijen (in draft mode via ItemSearchSelect) erin staan. */
  async function saveDraft() {
    if (!doc || !currentName || isNewMode || doc.docstatus !== 0) return;
    setSavingHeader(true);
    setError(null);
    try {
      const dirtyRows = Object.keys(editBuf).some(
        (k) => editBuf[k] && Object.keys(editBuf[k]).length > 0,
      );
      const localItems = doc.items || [];
      // Detecteer of rijen lokaal zijn toegevoegd of verwijderd — dan moet
      // de complete items-array mee, anders alleen wanneer er edits zijn.
      const fresh = await fetchDocument<SalesInvoiceDoc>(doctype, currentName);
      const freshNames = new Set((fresh.items || []).map((it) => it.name));
      const localNames = new Set(localItems.map((it) => it.name));
      const itemsChanged =
        dirtyRows ||
        localItems.length !== (fresh.items || []).length ||
        localItems.some((it) => !freshNames.has(it.name)) ||
        (fresh.items || []).some((it) => !localNames.has(it.name));
      const payload: Partial<SalesInvoiceDoc> & { items?: SalesInvoiceItem[] } = {
        ...pendingHeaderUpdates,
      };
      if (itemsChanged) {
        payload.items = localItems.map((it) => {
          const patch = it.name ? editBuf[it.name] : undefined;
          return patch && Object.keys(patch).length > 0 ? { ...it, ...patch } : it;
        });
      }
      // Diagnostiek — laat de gebruiker in DevTools zien welk payload
      // daadwerkelijk verstuurd wordt en of de server-roundtrip slaagt.
      // eslint-disable-next-line no-console
      console.info("[invoice-save-draft] PUT", { name: currentName, payload });
      if (Object.keys(payload).length === 0) {
        // Niets te sturen — kan gebeuren bij race met externe state-clear.
        // eslint-disable-next-line no-console
        console.warn("[invoice-save-draft] payload was empty, skipping");
        setPendingHeaderUpdates({});
        setEditBuf({});
        return;
      }
      const updateResult = await updateDocument<SalesInvoiceDoc>(
        doctype,
        currentName,
        payload as Record<string, unknown>,
      );
      // eslint-disable-next-line no-console
      console.info("[invoice-save-draft] OK", { modified: updateResult?.modified });
      // updateDocument retourneert al de fresh server-doc — gebruik die
      // i.p.v. een tweede fetch (cache-race vermijden, en sneller).
      setDoc(updateResult);
      setPendingHeaderUpdates({});
      setEditBuf({});
      // Force PDF refresh — onafhankelijk van of doc.modified naar React's
      // re-render heeft gepropageerd.
      setSaveCounter((c) => c + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error("[invoice-save-draft] FAIL", e);
      // Raw message — de banner zet zelf "Opslaan mislukt" ervoor en
      // splitst summary van detail via summarizeErpnextError.
      setError(msg);
    } finally {
      setSavingHeader(false);
    }
  }

  // Toggle factuur ↔ creditnota. Routes via stageHeader zodat het pas bij
  // Opslaan naar ERPNext gaat (in draft mode); in new mode alleen lokaal.
  function toggleCreditNote(next: boolean) {
    setIsCreditNote(next);
    stageHeader({ is_return: next ? 1 : 0 });
  }

  // Backwards-compat aliasing: alle bestaande call-sites blijven
  // persistHeaderField aanroepen, maar die routet nu naar stageHeader.
  function persistHeaderField(patch: Partial<SalesInvoiceDoc>) {
    stageHeader(patch);
  }

  async function saveCustomer() {
    if (!doc || !customerDraft || customerDraft === doc.customer) return;
    if (isNewMode) {
      // In new mode, just update local state — the customer is committed
      // together with everything else when "Maak factuur" is pressed.
      setDoc({ ...doc, customer: customerDraft });
      return;
    }
    setSavingHeader(true);
    try {
      await updateDocument(doctype, currentName, { customer: customerDraft });
      const updated = await fetchDocument<SalesInvoiceDoc>(doctype, currentName);
      setDoc(updated);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[invoice-customer]", e);
    } finally {
      setSavingHeader(false);
    }
  }

  // New-mode only: tracks which row is currently in "wissel artikel"-mode.
  // Toont een inline ItemSearchSelect onder de rij. Eén rij tegelijk.
  const [swapRow, setSwapRow] = useState<string | null>(null);

  // Per-item expand → time_logs (Timesheet Detail rows). Items linked via a
  // timesheet row in `doc.timesheets` share `timesheet_detail` references;
  // we group by the parent timesheet entry of each invoice item.
  const [expandedItem, setExpandedItem] = useState<Set<string>>(new Set());
  // Map: parent Timesheet name → { employee_name, time_logs }. Fetched once
  // per modal open so per-row enrichment (medewerker, taak) doesn't hammer
  // the API every expand.
  const [tsParents, setTsParents] = useState<Map<string, { employee_name: string; time_logs: Array<{ name: string; task?: string; task_name?: string; description?: string }> }>>(new Map());
  // Map: Task name → custom_billing_type. Used to tag each uren-rij with
  // "Op factuur" / "Niet op factuur" based on whether the linked task is
  // a Timesheet-based task (printed on the Smart Urenstaat format) or a fixed
  // price task (linked but not detailed on the print).
  const [taskBillingMap, setTaskBillingMap] = useState<Map<string, string>>(new Map());

  function toggleItemExpand(itemKey: string) {
    setExpandedItem(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey); else next.add(itemKey);
      return next;
    });
  }

  function setEditField(itemName: string, field: keyof SalesInvoiceItem, value: string | number) {
    setEditBuf(prev => ({ ...prev, [itemName]: { ...prev[itemName], [field]: value } }));
  }

  useEffect(() => {
    if (!currentName) {
      // New mode: seed a synthetic blank doc once so the regular render
      // path "just works". After "Maak factuur", setCurrentName triggers
      // this effect again and the real doc replaces the synthetic one.
      if (!doc) {
        const today = new Date().toISOString().split("T")[0];
        setDoc({
          name: "",
          docstatus: 0,
          status: "Draft",
          customer: "",
          customer_name: "",
          posting_date: today,
          due_date: today,
          company: company || "",
          currency: "EUR",
          net_total: 0,
          total_taxes_and_charges: 0,
          grand_total: 0,
          outstanding_amount: 0,
          items: [],
          timesheets: [],
          taxes: [],
        });
      }
      setLoading(false);
      return;
    }
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [d, files] = await Promise.all([
          fetchDocument<SalesInvoiceDoc>(doctype, currentName),
          fetchAttachments(doctype, currentName).catch(() => [] as FileInfo[]),
        ]);
        setDoc(d);
        setAttachments(files);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("invoice_modal.attachment_error"));
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctype, currentName]);

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const erpnextUrl = currentName
    ? `${getErpNextLinkUrl()}/${doctype.toLowerCase().replace(/ /g, "-")}/${currentName}`
    : "";

  // New-mode helpers: add rows, remove rows, create the doc in ERPNext.
  function addItemFromPicker(qi: QuotationItem) {
    if (!doc) return;
    const localName = `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setDoc({
      ...doc,
      items: [
        ...(doc.items || []),
        {
          name: localName,
          item_code: qi.item_code,
          item_name: qi.item_name,
          qty: qi.qty,
          rate: qi.rate,
          amount: qi.qty * qi.rate,
        },
      ],
    });
  }

  function removeLocalRow(itemName: string | undefined) {
    if (!doc || !itemName) return;
    setDoc({ ...doc, items: (doc.items || []).filter((it) => it.name !== itemName) });
    setEditBuf((prev) => { const n = { ...prev }; delete n[itemName]; return n; });
  }

  /** Vervangt het Item op een factuur-rij (zowel new als edit mode). De
   *  op-factuur tekst (item_name) blijft als de gebruiker 'm zelf had
   *  aangepast — artikel + tarief + qty komen van het nieuwe Item.
   *
   *  In edit mode wordt parallel ook editBuf bijgewerkt zodat de save-
   *  button per rij verschijnt — de wijziging is dan nog niet gepersist
   *  naar ERPNext; klikken op save schrijft 'm pas door.
   */
  function swapItemForRow(rowName: string, qi: QuotationItem) {
    if (!doc) return;
    let newItemName = qi.item_name;
    setDoc({
      ...doc,
      items: (doc.items || []).map((it) => {
        if (it.name !== rowName) return it;
        const patch = editBuf[rowName] || {};
        const userTypedName = typeof patch.item_name === "string" && patch.item_name !== it.item_name;
        if (userTypedName) newItemName = patch.item_name as string;
        return {
          ...it,
          item_code: qi.item_code,
          item_name: userTypedName ? (patch.item_name as string) : qi.item_name,
          qty: qi.qty,
          rate: qi.rate,
          amount: qi.qty * qi.rate,
        };
      }),
    });
    if (isNewMode) {
      // Verwijder stale buffer-entries voor velden die we net hebben overschreven,
      // zodat de live-calculator (effectiveItem) niet het oude tarief blijft tonen.
      setEditBuf((prev) => {
        const e = prev[rowName];
        if (!e) return prev;
        const next = { ...e };
        delete next.item_code;
        delete next.qty;
        delete next.rate;
        return { ...prev, [rowName]: next };
      });
    } else {
      // Edit mode: schrijf de wijzigingen ook naar editBuf zodat de
      // save-button per rij verschijnt en saveEditedRow ze server-side pusht.
      setEditBuf((prev) => ({
        ...prev,
        [rowName]: {
          ...(prev[rowName] || {}),
          item_code: qi.item_code,
          item_name: newItemName,
          qty: qi.qty,
          rate: qi.rate,
        },
      }));
    }
    setSwapRow(null);
  }

  async function handleCreateInvoice() {
    if (!doc) return;
    // Apply any uncommitted per-row edits (qty/rate/code/name still in editBuf)
    // before sending to ERPNext.
    const items = (doc.items || []).map((it) => {
      const patch = it.name ? editBuf[it.name] : undefined;
      return {
        item_code: (patch?.item_code ?? it.item_code) || "",
        item_name: (patch?.item_name ?? it.item_name) || undefined,
        qty: Number(patch?.qty ?? it.qty) || 0,
        rate: Number(patch?.rate ?? it.rate) || 0,
      };
    }).filter((it) => it.item_code);

    if (!doc.customer) {
      setError("Kies een klant.");
      return;
    }
    if (items.length === 0) {
      setError("Voeg minstens één factuurregel toe.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await createDocument<{ name: string }>(doctype, {
        customer: doc.customer,
        company: doc.company || company || undefined,
        posting_date: doc.posting_date,
        // due_date wordt server-side door ERPNext afgeleid uit het Payment
        // Terms Template (posting_date + credit_days van de eerste rij).
        // Alleen meesturen als fallback wanneer geen template is gekozen.
        ...(doc.payment_terms_template ? {} : { due_date: doc.due_date || doc.posting_date }),
        currency: doc.currency || "EUR",
        project: doc.project || undefined,
        payment_terms_template: doc.payment_terms_template || undefined,
        taxes_and_charges: doc.taxes_and_charges || undefined,
        is_return: isCreditNote ? 1 : undefined,
        items,
      });
      // Flip the modal into edit-mode for the freshly created doc. The
      // load effect re-runs because currentName changed, and fetches the
      // real doc (with totals, due date computed from payment terms, etc.).
      setEditBuf({});
      setDoc(null);
      setCurrentName(created.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }
  const currency = doc?.currency || "EUR";
  const items = doc?.items ?? [];
  const timesheets = doc?.timesheets ?? [];
  const taxes = doc?.taxes ?? [];

  // Live-berekening voor new mode: ERPNext rekent pas na aanmaken (en zet
  // dan net_total/grand_total). Tijdens samenstellen leest de UI qty en rate
  // uit editBuf (uncontrolled inputs schrijven daar naartoe) en berekent
  // het bedrag per regel + subtotaal direct, zodat de gebruiker live ziet
  // wat de factuur gaat worden.
  const effectiveItem = (it: SalesInvoiceItem): SalesInvoiceItem => {
    if (!isNewMode) return it;
    const patch = it.name ? editBuf[it.name] : undefined;
    const qty  = Number(patch?.qty  ?? it.qty)  || 0;
    const rate = Number(patch?.rate ?? it.rate) || 0;
    return { ...it, qty, rate, amount: qty * rate };
  };
  const liveSubtotal = isNewMode
    ? items.reduce((sum, it) => sum + (effectiveItem(it).amount || 0), 0)
    : (doc?.net_total ?? 0);

  // Load Sales Taxes and Charges Templates for the active company. Filters
  // op company zodat 3BM Engineering alleen z'n eigen templates ziet en
  // niet die van andere bedrijven in dezelfde ERPNext-tenant. Default-
  // selectie zoekt een template waarvan de naam "VAT 21" of "21%" bevat
  // (case-insensitive) zodat NL-tarief automatisch klopt.
  //
  // Loopt ook in draft mode (canEdit) zodat de dropdown gevuld is en de
  // gebruiker een ander BTW-template kan kiezen op een bestaande draft.
  useEffect(() => {
    if (!canEdit) return;
    const activeCompany = doc?.company || company;
    if (!activeCompany) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchList<{ name: string; title?: string }>(
          "Sales Taxes and Charges Template",
          {
            fields: ["name", "title"],
            filters: [
              ["company", "=", activeCompany],
              ["disabled", "=", 0],
            ],
            limit_page_length: 50,
            order_by: "name asc",
          },
        );
        if (cancelled) return;
        setTaxTemplates(list);
        // Auto-default als nog niets gekozen is.
        if (!doc?.taxes_and_charges && list.length > 0) {
          const def = list.find((t) => /21\s*%|vat\s*21|btw.*21/i.test(t.name) || /21\s*%|vat\s*21|btw.*21/i.test(t.title || ""));
          const pick = def || list[0];
          setDoc((d) => (d ? { ...d, taxes_and_charges: pick.name } : d));
        }
      } catch { /* silent — gebruiker kan handmatig kiezen */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, doc?.company, company]);

  // Payment Terms Templates (company-onafhankelijk in standaard-ERPNext).
  // Default-keus: "21 dagen" als die bestaat. Loopt ook in draft mode.
  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchList<{ name: string }>("Payment Terms Template", {
          fields: ["name"],
          limit_page_length: 50,
          order_by: "name asc",
        });
        if (cancelled) return;
        setPaymentTermsTemplates(list);
        if (!doc?.payment_terms_template && list.length > 0) {
          const def = list.find((t) => /21\s*(d|dagen)/i.test(t.name));
          const pick = def || list[0];
          setDoc((d) => (d ? { ...d, payment_terms_template: pick.name } : d));
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  // Load each unique parent Timesheet once (for employee_name + task per
  // time_log row). Triggered on doc load.
  useEffect(() => {
    const names = Array.from(new Set(timesheets.map(t => t.time_sheet).filter(Boolean)));
    if (names.length === 0) return;
    let cancelled = false;
    (async () => {
      const out = new Map<string, { employee_name: string; time_logs: Array<{ name: string; task?: string; task_name?: string; description?: string }> }>();
      await Promise.all(names.map(async (tsName) => {
        try {
          const d = await fetchDocument<{ employee_name?: string; time_logs?: Array<{ name: string; task?: string; task_name?: string; description?: string; custom_subject?: string }> }>("Timesheet", tsName);
          out.set(tsName, {
            employee_name: d.employee_name || "",
            time_logs: (d.time_logs || []).map(l => ({
              name: l.name,
              task: l.task,
              task_name: l.task_name || l.custom_subject,
              description: l.description,
            })),
          });
        } catch { /* ignore */ }
      }));
      if (!cancelled) setTsParents(out);

      // Bonus pass: load custom_billing_type for every Task referenced by a
      // time_log. Used to mark each uren-row as "wordt geprint" (Timesheet
      // based) or "niet geprint" (Fixed Cost / vaste prijs).
      //
      // We fetch each Task doc individually — the `["name", "in", [...]]`
      // filter via fetchAll doesn't always return the field reliably on
      // this Frappe build, especially for Task which has docstatus-aware
      // permission rules. fetchDocument always works.
      const taskIds = new Set<string>();
      for (const v of out.values()) for (const l of v.time_logs) if (l.task) taskIds.add(l.task);
      if (taskIds.size > 0) {
        const m = new Map<string, string>();
        await Promise.all(Array.from(taskIds).map(async (tid) => {
          try {
            const td = await fetchDocument<{ custom_billing_type?: string }>("Task", tid);
            if (td.custom_billing_type) m.set(tid, td.custom_billing_type);
          } catch { /* ignore */ }
        }));
        if (!cancelled) {
          setTaskBillingMap(m);
          // eslint-disable-next-line no-console
          console.log("[invoice-tasks]", Object.fromEntries(m));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timesheets.length, currentName]);

  // Whether the currently-selected print format will print uren on the PDF
  // for a given row. Used to render badges in the "Alle gekoppelde uren"
  // table and the per-item child rows.
  function isRowPrintedOnInvoice(row: EnrichedTimesheetRow): boolean {
    // No-urenstaat format: uren are never printed.
    if (!/urenstaat/i.test(printFormat)) return false;
    // Smart Urenstaat variant: only Timesheet-based tasks.
    if (/smart/i.test(printFormat)) {
      if (!row.task) return false;
      return taskBillingMap.get(row.task) === "Timesheet based";
    }
    // Default "Nieuw" full urenstaat — all rows printed.
    return true;
  }

  // Build the enriched child rows for an item. We show ALL invoice
  // timesheets — most 3BM invoices have one item per project so the simple
  // "show everything per item" model works in practice.
  function getEnrichedRows(_item: SalesInvoiceItem): EnrichedTimesheetRow[] {
    return timesheets.map((ts) => {
      const parent = tsParents.get(ts.time_sheet);
      const log = parent?.time_logs.find(l => l.name === ts.timesheet_detail);
      return {
        ...ts,
        employee_name: parent?.employee_name,
        task: log?.task,
        task_name: log?.task_name,
        log_description: log?.description || ts.description,
      };
    });
  }
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-5xl w-full mx-4 max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-slate-800">
                {currentName || (title ?? "Nieuwe factuur")}
              </h3>
              {doc?.status && !isNewMode && (
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[doc.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {doc.status}
                </span>
              )}
              {isNewMode && (
                <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                  Concept (niet opgeslagen)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {/* Opslaan — verschijnt wanneer er gestagede wijzigingen zijn.
                Zolang er ongesaved werk is verbergen we Akkoord/Inboeken
                zodat de gebruiker eerst expliciet opslaat en de PDF-preview
                de juiste staat krijgt. */}
            {anyDirty && (
              <button
                onClick={() => void saveDraft()}
                disabled={savingHeader}
                className="px-3 py-1.5 text-xs font-medium bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                title="Sla alle wijzigingen op naar ERPNext en ververs de PDF-preview"
              >
                <Save size={14} />
                {savingHeader ? "Bezig…" : "Opslaan"}
              </button>
            )}
            {/* Akkoord — submit de draft zonder versturen. */}
            {!isNewMode && doc?.docstatus === 0 && !anyDirty && (
              <button
                onClick={handleSubmitInvoice}
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-medium bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                title="Factuur akkoord geven en inboeken (docstatus 0 → 1)"
              >
                <Check size={14} />
                {submitting ? "Bezig…" : "Akkoord & inboeken"}
              </button>
            )}
            {/* Inboeken & Verstuur — submit + mail in één klik (DRAFT) */}
            {!isNewMode && doc?.docstatus === 0 && !anyDirty && (
              <button
                onClick={() => setSendModalMode("draft")}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-y-teal text-y-teal rounded-lg hover:bg-y-teal/5 cursor-pointer inline-flex items-center gap-1"
                title="Submit (docstatus 0 → 1) en verstuur als e-mail naar de klant"
              >
                <Mail size={14} />
                Inboeken & Verstuur
              </button>
            )}
            {/* Versturen — submitted factuur naar klant mailen via ERPNext */}
            {!isNewMode && doc?.docstatus === 1 && (
              <button
                onClick={() => setSendModalMode("submitted")}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-y-teal text-y-teal rounded-lg hover:bg-y-teal/5 cursor-pointer inline-flex items-center gap-1"
                title="Verstuur factuur als e-mail naar de klant via ERPNext Communication"
              >
                <Mail size={14} />
                Mail versturen
              </button>
            )}
            {!isNewMode && (
              <a
                href={erpnextUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 text-xs text-y-teal hover:text-y-teal-dark inline-flex items-center gap-1"
                title={t("common.open_in_erpnext")}
              >
                <ExternalLink size={14} />
                ERPNext
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 overflow-auto flex-1 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-400">{t("common.loading")}</p>
          ) : !doc ? (
            error ? <p className="text-sm text-red-500">{error}</p> : null
          ) : (
            <>
              {/* Save/runtime fouten: banner bovenaan i.p.v. de form vervangen,
                  zodat de gebruiker kan zien wat er mis ging en blijft kijken
                  naar de velden die ze aan het bewerken waren. ERPNext-
                  tracebacks worden samengevat tot één leesbare regel; de
                  volledige stack zit achter "Toon details" voor wanneer je
                  daar toch in moet duiken. */}
              {error && (() => {
                const { summary, detail } = summarizeErpnextError(error);
                return (
                  <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-red-700 flex-1">
                        <span className="font-medium">Opslaan mislukt</span>
                        {summary && <span> — {summary}</span>}
                      </p>
                      <button
                        type="button"
                        onClick={() => setError(null)}
                        className="text-red-400 hover:text-red-600 cursor-pointer flex-shrink-0"
                        title="Sluit"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {detail && detail !== summary && (
                      <details className="text-[10px] text-red-500">
                        <summary className="cursor-pointer hover:underline select-none">
                          Toon details
                        </summary>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap bg-red-100/40 p-2 rounded font-mono">
                          {detail}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })()}
              {/* Factuur / Creditnota toggle — beschikbaar in new mode én bij
                  drafts (docstatus=0). Stuurt is_return naar ERPNext: items
                  mogen dan negatieve qty hebben, en het Print Format swap't
                  automatisch naar de credit-tekst. */}
              {canEdit && (
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 self-start">
                  <button
                    type="button"
                    onClick={() => void toggleCreditNote(false)}
                    className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                      !isCreditNote
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Factuur
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleCreditNote(true)}
                    className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                      isCreditNote
                        ? "bg-white text-amber-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Creditnota
                  </button>
                </div>
              )}

              {/* Klantnaam — vlak onder de header. CustomerSearchSelect in
                  new mode én bij draft (canEdit); read-only chip op een
                  submitted invoice. */}
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Klantnaam:</span>
                {canEdit ? (
                  <div className="flex-1 min-w-0">
                    <CustomerSearchSelect
                      value={pickedCustomer}
                      onChange={(c) => {
                        setPickedCustomer(c);
                        // Silent clear van het project als de nieuwe klant niet
                        // matcht — voorkomt onbedoeld doorzetten van een verkeerd
                        // klant↔project paar.
                        const clearProject =
                          pickedProject && pickedProject.customer && pickedProject.customer !== c?.name;
                        if (clearProject) setPickedProject(null);
                        // Stage de wijziging — pas bij Opslaan gaat het naar ERPNext.
                        stageHeader({
                          customer: c?.name || "",
                          customer_name: c?.customer_name || "",
                          ...(clearProject ? { project: "" } : {}),
                        });
                      }}
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={customerDraft}
                    onChange={(e) => setCustomerDraft(e.target.value)}
                    onBlur={saveCustomer}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    disabled={savingHeader}
                    className="flex-1 text-sm text-slate-700 font-medium truncate bg-transparent border border-transparent hover:border-slate-200 focus:border-y-teal focus:bg-white rounded px-1 py-0.5 cursor-text"
                    title="Klant ID (Customer in ERPNext) — wijzig en klik buiten het veld om op te slaan"
                  />
                )}
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-slate-400">Factuurdatum</div>
                  {isNewMode ? (
                    <input
                      type="date"
                      value={doc.posting_date}
                      onChange={(e) => setDoc({ ...doc, posting_date: e.target.value })}
                      className="text-slate-700 font-medium w-full bg-transparent border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-y-teal"
                    />
                  ) : (
                    <div className="text-slate-700 font-medium">{doc.posting_date || "—"}</div>
                  )}
                </div>
                <div>
                  <div className="text-slate-400">Betaaldatum</div>
                  {canEdit ? (
                    <input
                      type="date"
                      value={doc.due_date || ""}
                      onChange={(e) => setDoc({ ...doc, due_date: e.target.value })}
                      onBlur={(e) => {
                        // In draft mode pas op blur server-side persisteren —
                        // anders krijg je een ERPNext-call per toets-aanslag.
                        if (!isNewMode && (e.target.value || "") !== (doc.due_date || "")) {
                          void persistHeaderField({ due_date: e.target.value });
                        }
                      }}
                      disabled={savingHeader}
                      className="text-slate-700 font-medium w-full bg-white border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-y-teal"
                      title="Default uit posting_date + Betaaltermijn template — handmatig te overschrijven"
                    />
                  ) : (
                    <div className="text-slate-700 font-medium">{doc.due_date || "—"}</div>
                  )}
                </div>
                <div>
                  <div className="text-slate-400">Project</div>
                  {canEdit ? (
                    <ProjectPicker
                      value={pickedProject || (doc.project ? { name: doc.project, project_name: projectName } : null)}
                      customer={doc.customer}
                      onChange={(p) => {
                        setPickedProject(p);
                        void persistHeaderField({ project: p?.name || "" });
                      }}
                    />
                  ) : (
                    <div className="text-slate-700 font-medium truncate" title={projectName || doc.project}>
                      {doc.project ? (
                        <>
                          {doc.project}
                          {projectName && (
                            <span className="text-slate-500 font-normal"> · {projectName}</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-slate-400">Bedrijf</div>
                  {canEdit ? (
                    <select
                      value={doc.company || ""}
                      onChange={(e) => {
                        const next = e.target.value;
                        // Wisselen van bedrijf op een bestaande draft → ERPNext
                        // gebruikt een andere naming-series → factuurnummer
                        // verandert. Bij new mode is er nog geen factuurnummer
                        // dus geen waarschuwing nodig.
                        if (!isNewMode && doc.company && next && next !== doc.company) {
                          const ok = window.confirm(
                            "Bij wisselen van bedrijf gebruikt ERPNext een andere naming-series voor de factuur. " +
                              "Het factuurnummer wordt daardoor opnieuw uitgegeven. Doorgaan?",
                          );
                          if (!ok) {
                            // Reset het select-element zichtbaar terug — onChange
                            // heeft visueel niets gedaan, maar voor de duidelijkheid:
                            e.target.value = doc.company;
                            return;
                          }
                        }
                        void persistHeaderField({ company: next });
                      }}
                      disabled={savingHeader}
                      className="text-slate-700 font-medium w-full bg-white border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-y-teal cursor-pointer"
                      title="Bedrijf bepaalt de letterhead, BTW-template, footer-gegevens en (in edit mode) het factuurnummer"
                    >
                      {!doc.company && <option value="">— kies bedrijf —</option>}
                      {companies.map((c) => (
                        <option key={c.name} value={c.name}>{c.company_name || c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-slate-700 font-medium truncate">{doc.company || "—"}</div>
                  )}
                </div>
                {canEdit && (
                  <div className="col-span-2 md:col-span-2">
                    <div className="text-slate-400">BTW-template</div>
                    <select
                      value={doc.taxes_and_charges || ""}
                      onChange={(e) => void persistHeaderField({ taxes_and_charges: e.target.value })}
                      disabled={savingHeader}
                      className="text-slate-700 font-medium w-full bg-white border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-y-teal cursor-pointer"
                      title="Sales Taxes and Charges Template — bepaalt de BTW-rij op de factuur"
                    >
                      {taxTemplates.length === 0 && (
                        <option value="">— geen templates voor dit bedrijf —</option>
                      )}
                      {taxTemplates.map((tx) => (
                        <option key={tx.name} value={tx.name}>{tx.title || tx.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {canEdit && (
                  <div className="col-span-2">
                    <div className="text-slate-400">Betaaltermijn</div>
                    <select
                      value={doc.payment_terms_template || ""}
                      onChange={(e) => {
                        if (isNewMode) {
                          setDoc({ ...doc, payment_terms_template: e.target.value });
                        } else {
                          // Draft: server computes nieuwe due_date uit
                          // posting_date + template-credit_days; persistHeaderField
                          // fetcht het fresh doc terug zodat Betaaldatum
                          // automatisch meebeweegt.
                          void persistHeaderField({ payment_terms_template: e.target.value });
                        }
                      }}
                      disabled={savingHeader}
                      className="text-slate-700 font-medium w-full bg-white border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-y-teal cursor-pointer"
                      title="ERPNext berekent de betaaldatum uit posting_date + Payment Terms Template"
                    >
                      <option value="">— geen template —</option>
                      {paymentTermsTemplates.map((p) => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {!canEdit && doc.payment_terms_template && (
                  <div className="col-span-2">
                    <div className="text-slate-400">Betaaltermijn</div>
                    <div className="text-slate-700">{doc.payment_terms_template}</div>
                  </div>
                )}
                {canEdit ? (
                  <div className="col-span-2">
                    <div className="text-slate-400">Contact</div>
                    <input
                      type="email"
                      value={doc.contact_email || ""}
                      onChange={(e) => setDoc({ ...doc, contact_email: e.target.value })}
                      onBlur={(e) => {
                        // Alleen persisteren bij draft, niet bij new mode
                        // (daar gaat alles in één keer mee bij Maak factuur).
                        if (!isNewMode && (e.target.value || "") !== (doc.contact_email || "")) {
                          void persistHeaderField({ contact_email: e.target.value });
                        }
                      }}
                      placeholder="contact@klant.nl"
                      disabled={savingHeader}
                      className="text-slate-700 w-full bg-white border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-y-teal"
                      title="E-mailadres voor verzending van de factuur"
                    />
                  </div>
                ) : (
                  doc.contact_email && (
                    <div className="col-span-2">
                      <div className="text-slate-400">Contact</div>
                      <div className="text-slate-700 truncate">{doc.contact_email}</div>
                    </div>
                  )
                )}
              </div>

              {/* Editable invoice rows + expandable timesheet child-rows.
                  Always rendered in new mode (so the picker + empty table
                  are visible from the start); gated on items.length>0 in
                  edit mode to avoid an empty table on legacy invoices. */}
              {(items.length > 0 || isNewMode) && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                    Factuurregels
                    {!isNewMode && (
                      <span className="text-[10px] text-slate-400 font-mono">items={items.length} timesheets={timesheets.length} parents={tsParents.size}</span>
                    )}
                  </h4>
                  {canEdit && (
                    <div className="mb-2">
                      <ItemSearchSelect onAdd={addItemFromPicker} />
                    </div>
                  )}
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr className="text-slate-500">
                          <th className="w-6 px-1 py-2" />
                          <th className="text-left px-2 py-2">
                            {isNewMode ? (
                              <>
                                <div>Omschrijving op factuur</div>
                                <div className="text-[10px] font-normal text-slate-400">Artikel-code (intern, niet op factuur)</div>
                              </>
                            ) : (
                              <>
                                <div>Artikel</div>
                                <div className="text-[10px] font-normal text-slate-400">Omschrijving op factuur</div>
                              </>
                            )}
                          </th>
                          <th className="text-right px-2 py-2">Aantal</th>
                          <th className="text-right px-2 py-2">Tarief</th>
                          <th className="text-right px-2 py-2">Bedrag</th>
                          <th className="w-8 px-1 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => {
                          const key = it.name || `${i}`;
                          const open = expandedItem.has(key);
                          const childRows = getEnrichedRows(it);
                          return (
                            <Fragment key={key}>
                              <tr className="border-t border-slate-100 hover:bg-slate-50/50">
                                <td className="px-1 py-1.5 align-top">
                                  {/* Chevron only — geen count-badge, dat werd verwarrend.
                                      De gekoppelde uren-rijen verschijnen onder de regel
                                      als hij uitgeklapt is. */}
                                  <button
                                    onClick={() => toggleItemExpand(key)}
                                    className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                                    title="Toon gekoppelde uren"
                                  >
                                    <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
                                  </button>
                                </td>
                                <td className="px-2 py-1.5 text-slate-700">
                                  {/* Eén layout voor zowel new als edit mode: de omschrijving die
                                      de klant op de factuur ziet (item_name) staat prominent
                                      bovenaan; de interne artikel-code (item_code) is klein-grijs
                                      eronder met een "wissel" affordance. */}
                                  <input
                                    key={`name-${it.item_code}`}
                                    type="text"
                                    defaultValue={it.item_name || ""}
                                    onChange={(e) => it.name && setEditField(it.name, "item_name", e.target.value)}
                                    placeholder="Naam zoals klant ziet op factuur"
                                    title="Deze tekst verschijnt op de PDF-factuur"
                                    className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-y-teal focus:border-y-teal"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => it.name && setSwapRow(swapRow === it.name ? null : it.name)}
                                    title="Klik om een ander artikel te kiezen"
                                    className="mt-1 text-[10px] text-slate-400 hover:text-y-teal cursor-pointer flex items-center gap-1 truncate max-w-full"
                                  >
                                    <RefreshCw size={9} className="flex-shrink-0" />
                                    <span className="truncate">
                                      artikel: <span className="font-mono">{it.item_code || "—"}</span>
                                      <span className="text-slate-300"> · niet op factuur · {swapRow === it.name ? "annuleer" : "wissel"}</span>
                                    </span>
                                  </button>
                                  {swapRow === it.name && (
                                    <div className="mt-1">
                                      <ItemSearchSelect onAdd={(qi) => it.name && swapItemForRow(it.name, qi)} />
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input
                                    /* Key bevat it.qty zodat een swap (setDoc met nieuwe qty)
                                       het uncontrolled input opnieuw mount met de juiste defaultValue.
                                       Bij typen verandert alleen editBuf — it.qty blijft hetzelfde —
                                       dus geen ongewenste remount. */
                                    key={isNewMode ? `qty-${it.qty}-${it.item_code}` : undefined}
                                    type="number"
                                    step="0.01"
                                    defaultValue={it.qty}
                                    onChange={(e) => it.name && setEditField(it.name, "qty", parseFloat(e.target.value) || 0)}
                                    className="w-16 text-right font-mono bg-transparent border border-transparent hover:border-slate-200 focus:border-y-teal focus:bg-white rounded px-1 py-0.5"
                                  />
                                  {it.uom && <span className="text-slate-400 ml-1">{it.uom}</span>}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input
                                    key={isNewMode ? `rate-${it.rate}-${it.item_code}` : undefined}
                                    type="number"
                                    step="0.01"
                                    defaultValue={it.rate}
                                    onChange={(e) => it.name && setEditField(it.name, "rate", parseFloat(e.target.value) || 0)}
                                    className="w-20 text-right font-mono bg-transparent border border-transparent hover:border-slate-200 focus:border-y-teal focus:bg-white rounded px-1 py-0.5"
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono font-medium">{formatMoney(effectiveItem(it).amount, currency)}</td>
                                <td className="px-1 py-1.5 text-center">
                                  {canEdit && (
                                    <button
                                      onClick={() => removeLocalRow(it.name)}
                                      className="text-slate-400 hover:text-red-500 cursor-pointer"
                                      title="Verwijder regel — pas server-side na Opslaan"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {open && (
                                <tr className="bg-slate-50/60">
                                  <td colSpan={6} className="px-4 py-2">
                                    {childRows.length === 0 ? (
                                      <p className="text-[10px] text-slate-400 italic">Geen gekoppelde uren-regels gevonden voor deze factuurregel.</p>
                                    ) : (
                                      <table className="w-full text-[11px]">
                                        <thead>
                                          <tr className="text-slate-500">
                                            <th className="text-left py-1 pr-2">Datum</th>
                                            <th className="text-left py-1 pr-2">Medewerker</th>
                                            <th className="text-left py-1 pr-2">Taak</th>
                                            <th className="text-left py-1 pr-2">Activiteit</th>
                                            <th className="text-left py-1 pr-2">Omschrijving</th>
                                            <th className="text-right py-1">Uren</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {childRows.map((ts, j) => (
                                            <tr key={ts.name || j} className="border-t border-slate-200/60">
                                              <td className="py-1 pr-2 text-slate-700 whitespace-nowrap">{ts.from_time ? ts.from_time.split(" ")[0] : "—"}</td>
                                              <td className="py-1 pr-2 text-slate-700">{ts.employee_name || "—"}</td>
                                              <td className="py-1 pr-2 text-slate-700">{ts.task_name || ts.task || "—"}</td>
                                              <td className="py-1 pr-2 text-slate-600">{ts.activity_type || "—"}</td>
                                              <td className="py-1 pr-2 text-slate-500 max-w-[260px] truncate" title={ts.log_description || ""}>{ts.log_description || "—"}</td>
                                              <td className="py-1 text-right font-mono">{formatHours(ts.billing_hours)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* All linked timesheets (full, unfiltered list) — enriched with
                  employee + task from the parent Timesheet docs, same as the
                  per-item chevron expand. Open by default so users see the
                  uren immediately. */}
              {timesheets.length > 0 && (() => {
                const enriched = timesheets.map(ts => {
                  const parent = tsParents.get(ts.time_sheet);
                  const log = parent?.time_logs.find(l => l.name === ts.timesheet_detail);
                  return { ts, parent, log };
                });
                const printedCount = enriched.filter(e => isRowPrintedOnInvoice({
                  ...e.ts,
                  employee_name: e.parent?.employee_name,
                  task: e.log?.task,
                  task_name: e.log?.task_name,
                  log_description: e.log?.description,
                })).length;
                return (
                <details className="text-xs" open>
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                    Gekoppelde uren-rijen — alle {timesheets.length} regels horen bij deze factuur ·{" "}
                    <span className="text-green-700 font-medium">{printedCount} worden op de PDF afgedrukt</span>
                    {printedCount < timesheets.length && (
                      <span className="text-slate-400"> · {timesheets.length - printedCount} niet (vaste-prijs taak)</span>
                    )}
                  </summary>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 mt-2">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr className="text-slate-500">
                          <th className="text-left px-2 py-2">Op factuur?</th>
                          <th className="text-left px-2 py-2">Datum</th>
                          <th className="text-left px-2 py-2">Medewerker</th>
                          <th className="text-left px-2 py-2">Taak</th>
                          <th className="text-left px-2 py-2">Type taak</th>
                          <th className="text-left px-2 py-2">Activiteit</th>
                          <th className="text-left px-2 py-2">Omschrijving</th>
                          <th className="text-left px-2 py-2">Timesheet</th>
                          <th className="text-right px-2 py-2">Uren</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enriched.map(({ ts, parent, log }, i) => {
                          const enrichedRow: EnrichedTimesheetRow = {
                            ...ts,
                            employee_name: parent?.employee_name,
                            task: log?.task,
                            task_name: log?.task_name,
                            log_description: log?.description,
                          };
                          const printed = isRowPrintedOnInvoice(enrichedRow);
                          const billingType = log?.task ? taskBillingMap.get(log.task) : undefined;
                          return (
                          <tr key={ts.name || i} className={`border-t border-slate-100 ${printed ? "" : "bg-slate-50/60"}`}>
                            <td className="px-2 py-1.5">
                              {printed ? (
                                <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-700">✓ Op factuur</span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-slate-200 text-slate-600">— Niet geprint</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">{ts.from_time ? ts.from_time.split(" ")[0] : "—"}</td>
                            <td className="px-2 py-1.5 text-slate-700">{parent?.employee_name || "—"}</td>
                            <td className="px-2 py-1.5 text-slate-700">{log?.task_name || log?.task || "—"}</td>
                            <td className="px-2 py-1.5 text-slate-500 text-[10px]">{billingType || "—"}</td>
                            <td className="px-2 py-1.5 text-slate-700">{ts.activity_type || "—"}</td>
                            <td className="px-2 py-1.5 text-slate-500 max-w-[280px] truncate" title={log?.description || ts.description || ""}>{log?.description || ts.description || "—"}</td>
                            <td className="px-2 py-1.5 text-slate-400 font-mono text-[10px]">{ts.time_sheet}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{formatHours(ts.billing_hours)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
                );
              })()}

              {/* Totals */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotaal (excl. btw)</span>
                  <span className="font-mono">{formatMoney(liveSubtotal, currency)}</span>
                </div>
                {taxes.map((tx, i) => (
                  <div key={tx.name || i} className="flex justify-between text-xs text-slate-500">
                    <span>
                      {tx.description || "Belasting"}
                      {tx.rate ? ` (${tx.rate}%)` : ""}
                    </span>
                    <span className="font-mono">{formatMoney(tx.tax_amount ?? 0, currency)}</span>
                  </div>
                ))}
                {!taxes.length && doc.total_taxes_and_charges > 0 && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Belasting</span>
                    <span className="font-mono">{formatMoney(doc.total_taxes_and_charges, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
                  <span>Totaal</span>
                  <span className="font-mono">{formatMoney(isNewMode ? liveSubtotal : doc.grand_total, currency)}</span>
                </div>
                {isNewMode && (
                  <div className="text-[10px] text-slate-400 text-right italic">
                    BTW wordt berekend na aanmaken
                  </div>
                )}
                {doc.docstatus === 1 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Openstaand</span>
                    <span className={`font-mono ${doc.outstanding_amount > 0 ? "text-orange-600 font-semibold" : "text-green-600"}`}>
                      {formatMoney(doc.outstanding_amount, currency)}
                    </span>
                  </div>
                )}
              </div>

              {doc.remarks && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 mb-1">Opmerkingen</h4>
                  <div className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-2">{doc.remarks}</div>
                </div>
              )}

              {/* ─── PDF preview ─── Herbruikbare module. Toont placeholder
                  in new mode (currentName=""), echte preview zodra het concept
                  is opgeslagen en de modal naar edit-mode is geflipped.
                  onFormatChange synct het geselecteerde format zodat de
                  badges op uren-rijen (isRowPrintedOnInvoice) kloppen. */}
              <InvoicePreview
                doctype={doctype}
                name={currentName}
                onFormatChange={setPrintFormat}
                /* Refresh-trigger: doc.modified updatet bij elke server-save,
                   en saveCounter bumpt als sluitstuk zodat de PDF gegarandeerd
                   refresht zelfs als ERPNext dezelfde modified-string teruggeeft. */
                refreshToken={`${doc?.modified || ""}#${saveCounter}`}
              />

              {/* Attachments — edit-mode only */}
              {!isNewMode && (
              <div>
                <h4 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                  <Paperclip size={16} />
                  {t("invoice_modal.attachments")} ({attachments.length})
                </h4>
                {attachments.length === 0 ? (
                  <p className="text-xs text-slate-400">{t("invoice_modal.no_attachments")}</p>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((file) => {
                      // ERPNext v15 heeft geen `frappe.client.get_file`; de
                      // File-URL is same-origin direct opvraagbaar.
                      const fileUrl = file.file_url;
                      const isPdf = file.file_name?.toLowerCase().endsWith(".pdf");
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.file_name || "");
                      return (
                        <div
                          key={file.name}
                          className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <div className="p-1.5 bg-white rounded border border-slate-200">
                            <FileText size={16} className="text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{file.file_name}</p>
                            <p className="text-[10px] text-slate-400">{formatSize(file.file_size)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {(isPdf || isImage) && (
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 hover:bg-slate-200 rounded"
                                title={t("component_invoice_modal.view")}
                              >
                                <ExternalLink size={14} className="text-y-teal" />
                              </a>
                            )}
                            <a
                              href={fileUrl}
                              download={file.file_name}
                              className="p-1.5 hover:bg-slate-200 rounded"
                              title={t("component_invoice_modal.download")}
                            >
                              <Download size={14} className="text-slate-500" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
            </>
          )}
        </div>

        {/* Footer — only in new mode. Edit-mode saves per-row via the floppy. */}
        {isNewMode && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
            <button
              onClick={onClose}
              disabled={creating}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 cursor-pointer disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleCreateInvoice}
              disabled={creating || !doc?.customer || (doc?.items?.length ?? 0) === 0}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-y-teal rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
            >
              <Plus size={14} />
              {creating ? "Bezig…" : "Maak factuur"}
            </button>
          </div>
        )}
      </div>

      {/* Send-mail modal — stacks bovenop deze InvoiceModal */}
      {sendModalMode && currentName && (
        <SendInvoiceModal
          invoiceName={currentName}
          mode={sendModalMode}
          onClose={() => setSendModalMode(null)}
          onSent={async () => {
            // Refresh the displayed doc so docstatus + sent-status reflect reality
            try {
              const updated = await fetchDocument<SalesInvoiceDoc>(doctype, currentName);
              setDoc(updated);
            } catch { /* non-critical */ }
          }}
        />
      )}
    </div>
  );
}
