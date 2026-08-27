/**
 * Bevestigingsdialoog voor "mail → concept-inkoopfactuur".
 *
 * De dialoog staat bewust tússen de herkenning en de boeking: `detectPurchaseInvoice`
 * vult in wat het in de mail kón vinden, en de gebruiker ziet **welke velden
 * herkend zijn** (het blauwe "herkend"-chipje) voordat hij bevestigt. Dat is
 * het verschil tussen een hulpmiddel en een black box — een veld dat de
 * herkenning niet gevonden heeft is leeg en niet stiekem geraden.
 *
 * Drie dingen die hier expliciet geregeld zijn:
 *
 * - **Bedrag is het nettobedrag.** Vond de herkenning alleen een brutobedrag
 *   (incl. btw), dan zegt de dialoog dat er hardop bij; de btw hoort in
 *   ERPNext via een btw-sjabloon op de concept-factuur en niet in het
 *   regelbedrag.
 * - **De projectkoppeling van de mail gaat niet verloren.** Boeken zet
 *   `Communication.reference_*` op de nieuwe factuur — een Communication kan
 *   maar aan één document hangen. Stond er een project op, dan verhuist dat
 *   naar het `project`-veld van de factuur, waar het inhoudelijk beter zit.
 * - **Bijlagen worden hergebruikt, niet opnieuw geüpload.** Zie
 *   `bookPurchaseInvoiceFromMail`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, ExternalLink, Loader2, Search, Sparkles, X } from "lucide-react";
import { fetchAttachments, getErpNextLinkUrl, type FileInfo } from "../lib/erpnext";
import { useCompanies } from "../lib/DataContext";
import { getActiveCompany } from "../lib/instances";
import type { InvoiceGuess, SupplierHint } from "../lib/invoice-detect";
import {
  todayIso,
  validatePurchaseInvoiceInput,
  type PurchaseInvoiceInput,
} from "../lib/purchase-invoice-payload";
import {
  bookPurchaseInvoiceFromMail,
  classifyBookingError,
  fetchExpenseAccounts,
  fetchPayableAccounts,
  fetchPurchaseInvoiceDefaults,
  savePurchaseInvoiceDefaults,
  type AccountOption,
  type BookingResult,
} from "../lib/purchase-invoice";

export interface BookPurchaseInvoiceMessage {
  /** Communication-docname. */
  name: string;
  subject: string;
  sender: string;
  /** ERPNext-datetime van de mail. */
  date: string;
  /** Project waaraan de mail nu gekoppeld is, indien van toepassing. */
  project?: string;
}

interface Props {
  message: BookPurchaseInvoiceMessage;
  guess: InvoiceGuess;
  suppliers: SupplierHint[];
  onClose: () => void;
  onBooked: (result: BookingResult) => void;
}

/** Welk veld hoort bij welke herkenningscode (voor het "herkend"-chipje). */
function reasonFor(guess: InvoiceGuess, prefix: string): string | undefined {
  return guess.reasons.find((r) => r.startsWith(`${prefix}:`));
}

export default function BookPurchaseInvoiceDialog({ message, guess, suppliers, onClose, onBooked }: Props) {
  const { t } = useTranslation();
  const companies = useCompanies();

  const [company, setCompany] = useState(() => getActiveCompany());
  const [supplier, setSupplier] = useState(guess.supplier ?? "");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [billNo, setBillNo] = useState(guess.invoiceNo ?? "");
  const [billDate, setBillDate] = useState(guess.invoiceDate ?? "");
  const [postingDate, setPostingDate] = useState(() => todayIso());
  const [amount, setAmount] = useState(guess.amount !== undefined ? String(guess.amount) : "");
  const [description, setDescription] = useState(message.subject || "");
  const [expenseAccount, setExpenseAccount] = useState("");
  const [creditTo, setCreditTo] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [remember, setRemember] = useState(false);

  const [expenseOptions, setExpenseOptions] = useState<AccountOption[]>([]);
  const [payableOptions, setPayableOptions] = useState<AccountOption[]>([]);
  const [attachments, setAttachments] = useState<FileInfo[]>([]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const supplierBoxRef = useRef<HTMLDivElement>(null);

  /* Zonder actief bedrijf valt de dialoog terug op het eerste bedrijf; anders
     zou hij met een leeg verplicht veld openen zonder dat duidelijk is waarom. */
  useEffect(() => {
    if (!company && companies.length > 0) setCompany(companies[0].name);
  }, [companies, company]);

  /* Standaardwaarden + rekeningkeuzes horen bij het bedrijf, dus ze laden
     opnieuw zodra dat wisselt. */
  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    fetchPurchaseInvoiceDefaults(company).then((d) => {
      if (cancelled) return;
      setExpenseAccount(d.expenseAccount);
      setCreditTo(d.creditTo);
      setCostCenter(d.costCenter);
    }).catch(() => { /* de velden blijven leeg en zijn zelf in te vullen */ });
    fetchExpenseAccounts(company).then((rows) => { if (!cancelled) setExpenseOptions(rows); }).catch(() => {});
    fetchPayableAccounts(company).then((rows) => { if (!cancelled) setPayableOptions(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [company]);

  /* Bijlagen van de mail. PDF's staan standaard aan — dát is de factuur; een
     inline handtekeningafbeelding hoort niet aan een boekstuk te hangen. */
  useEffect(() => {
    let cancelled = false;
    fetchAttachments("Communication", message.name).then((files) => {
      if (cancelled) return;
      setAttachments(files);
      setPicked(new Set(files.filter((f) => /\.pdf$/i.test(f.file_name)).map((f) => f.name)));
    }).catch(() => { /* zonder bijlagen boeken mag gewoon */ });
    return () => { cancelled = true; };
  }, [message.name]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (supplierBoxRef.current && !supplierBoxRef.current.contains(e.target as Node)) setSupplierOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const supplierMatches = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    const rows = q
      ? suppliers.filter((s) => `${s.name} ${s.supplierName ?? ""}`.toLowerCase().includes(q))
      : suppliers;
    return rows.slice(0, 30);
  }, [suppliers, supplierQuery]);

  const parsedAmount = useMemo(() => {
    const normalized = amount.trim().replace(/\s/g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : NaN;
  }, [amount]);

  const buildInput = useCallback((): PurchaseInvoiceInput => {
    const input: PurchaseInvoiceInput = {
      supplier, company, creditTo, expenseAccount,
      postingDate,
      description: description.trim(),
      amount: parsedAmount,
    };
    if (billNo.trim()) input.billNo = billNo.trim();
    if (billDate) input.billDate = billDate;
    if (costCenter) input.costCenter = costCenter;
    if (message.project) input.project = message.project;
    return input;
  }, [supplier, company, creditTo, expenseAccount, postingDate, description, parsedAmount,
    billNo, billDate, costCenter, message.project]);

  async function handleSubmit() {
    setError("");
    const input = buildInput();
    const gaps = validatePurchaseInvoiceInput(input);
    setMissing(gaps);
    if (gaps.length > 0) return;

    setSaving(true);
    try {
      const result = await bookPurchaseInvoiceFromMail({
        input,
        communication: message.name,
        attachments: attachments
          .filter((f) => picked.has(f.name))
          .map((f) => ({ name: f.name, fileName: f.file_name, fileUrl: f.file_url, isPrivate: f.is_private === 1 })),
      });
      if (remember) {
        // Best effort: of de voorkeur gedeeld of lokaal landt verandert niets
        // aan de zojuist geboekte factuur.
        void savePurchaseInvoiceDefaults(company, { expenseAccount, creditTo, costCenter, currency: "EUR" });
      }
      onBooked(result);
    } catch (err) {
      setError(t(`y_next.pinv_error_${classifyBookingError(err)}`));
    } finally {
      setSaving(false);
    }
  }

  const RecognisedChip = ({ prefix }: { prefix: string }) => {
    const reason = reasonFor(guess, prefix);
    if (!reason) return null;
    return (
      <span
        title={t(`y_next.pinv_reason_${reason.replace(/[:-]/g, "_")}`, { defaultValue: reason })}
        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
      >
        <Sparkles size={9} /> {t("y_next.pinv_recognised")}
      </span>
    );
  };

  const label = (key: string, prefix?: string) => (
    <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
      {t(key)}
      {prefix ? <RecognisedChip prefix={prefix} /> : null}
    </span>
  );

  const fieldClass = (name: string) =>
    `w-full rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 ${
      missing.includes(name) ? "border-red-400 bg-red-50" : "border-slate-200"
    }`;

  const selectedSupplierLabel = supplier
    ? (suppliers.find((s) => s.name === supplier)?.supplierName ?? supplier)
    : "";

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800">{t("y_next.pinv_dialog_title")}</h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {message.subject} · {message.sender}
            </p>
          </div>
          <button onClick={onClose} title={t("common.close")}
            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          {guess.amountIsGross && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{t("y_next.pinv_amount_is_gross")}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Leverancier */}
            <div className="sm:col-span-2" ref={supplierBoxRef}>
              {label("y_next.pinv_supplier", "supplier")}
              <div className="relative">
                <button type="button"
                  onClick={() => { setSupplierOpen((v) => !v); setSupplierQuery(""); }}
                  className={`${fieldClass("supplier")} flex items-center justify-between gap-2 text-left cursor-pointer`}>
                  <span className={selectedSupplierLabel ? "text-slate-800" : "text-slate-400"}>
                    {selectedSupplierLabel || t("y_next.pinv_pick_supplier")}
                  </span>
                  <Search size={12} className="flex-shrink-0 text-slate-400" />
                </button>
                {supplierOpen && (
                  <div className="absolute left-0 top-full z-10 mt-1 flex max-h-60 w-full flex-col rounded-lg border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 p-2">
                      <input autoFocus type="search" value={supplierQuery}
                        onChange={(e) => setSupplierQuery(e.target.value)}
                        placeholder={t("y_next.pinv_search_supplier")}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                    <div className="flex-1 overflow-y-auto py-1">
                      {supplierMatches.length === 0 ? (
                        <p className="px-3 py-2 text-xs italic text-slate-400">{t("webmail.no_results")}</p>
                      ) : supplierMatches.map((s) => (
                        <button key={s.name} type="button"
                          onClick={() => { setSupplier(s.name); setSupplierOpen(false); }}
                          className="w-full cursor-pointer truncate px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                          {s.supplierName ?? s.name}
                        </button>
                      ))}
                    </div>
                    {/* Een leverancier aanmaken raakt btw-, betaal- en
                        adresgegevens die niet uit een mail te halen zijn —
                        dat hoort in ERPNext zelf te gebeuren. */}
                    <a href={`${getErpNextLinkUrl()}/supplier/new`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500 hover:bg-slate-50">
                      <ExternalLink size={10} /> {t("y_next.pinv_new_supplier_hint")}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <label className="block">
              {label("y_next.pinv_company")}
              <select value={company} onChange={(e) => setCompany(e.target.value)} className={fieldClass("company")}>
                {companies.map((c) => (
                  <option key={c.name} value={c.name}>{c.company_name || c.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              {label("y_next.pinv_credit_to")}
              <select value={creditTo} onChange={(e) => setCreditTo(e.target.value)} className={fieldClass("creditTo")}>
                <option value="">{t("y_next.pinv_pick_account")}</option>
                {payableOptions.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </label>

            <label className="block">
              {label("y_next.pinv_bill_no", "invoice-no")}
              <input value={billNo} onChange={(e) => setBillNo(e.target.value)}
                placeholder={t("y_next.pinv_bill_no_placeholder")} className={fieldClass("billNo")} />
            </label>

            <label className="block">
              {label("y_next.pinv_bill_date", "date")}
              <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={fieldClass("billDate")} />
            </label>

            <label className="block">
              {label("y_next.pinv_posting_date")}
              <input type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} className={fieldClass("postingDate")} />
            </label>

            <label className="block">
              {label("y_next.pinv_amount", "amount")}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">€</span>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00" className={fieldClass("amount")} />
              </div>
              <span className="mt-0.5 block text-[10px] text-slate-400">{t("y_next.pinv_amount_hint")}</span>
            </label>

            <label className="block sm:col-span-2">
              {label("y_next.pinv_description")}
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass("description")} />
            </label>

            <label className="block sm:col-span-2">
              {label("y_next.pinv_expense_account")}
              <select value={expenseAccount} onChange={(e) => setExpenseAccount(e.target.value)}
                className={fieldClass("expenseAccount")}>
                <option value="">{t("y_next.pinv_pick_account")}</option>
                {expenseOptions.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </label>
          </div>

          {message.project && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              {t("y_next.pinv_project_carried", { project: message.project })}
            </p>
          )}

          {/* Bijlagen */}
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">{t("y_next.pinv_attachments")}</p>
            {attachments.length === 0 ? (
              <p className="text-[11px] italic text-slate-400">{t("y_next.pinv_no_attachments")}</p>
            ) : (
              <div className="space-y-1">
                {attachments.map((f) => (
                  <label key={f.name} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={picked.has(f.name)} className="cursor-pointer"
                      onChange={() => setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(f.name)) next.delete(f.name); else next.add(f.name);
                        return next;
                      })} />
                    <span className="truncate">{f.file_name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-500">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="cursor-pointer" />
            {t("y_next.pinv_remember_defaults")}
          </label>

          {missing.length > 0 && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {t("y_next.pinv_missing_fields", {
                fields: missing.map((m) => t(`y_next.pinv_${toKey(m)}`)).join(", "),
              })}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <p className="text-[11px] text-slate-400">{t("y_next.pinv_draft_note")}</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={saving}
              className="cursor-pointer rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50">
              {t("common.cancel")}
            </button>
            <button onClick={() => void handleSubmit()} disabled={saving}
              className="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {saving ? t("y_next.pinv_booking") : t("y_next.pinv_book")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** `creditTo` → `credit_to`: de validatiecodes gebruiken camelCase, de
 *  vertaalsleutels snake_case. */
function toKey(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
