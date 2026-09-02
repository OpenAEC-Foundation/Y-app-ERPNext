/**
 * Bevestigingsdialoog voor "mail → offerte".
 *
 * De derde uitkomst naast lead en offerteaanvraag, en bewust een eigen
 * component en niet nóg een modus in `CreateLeadDialog`: een offerte heeft een
 * **regeltabel**, en dat is precies het stuk dat niet uit de mail te halen
 * valt. Het samenvoegen zou van die dialoog een schakelaar-met-twee-gezichten
 * maken; de dingen die ze wél delen (bijlagen kiezen, het bedrijf, de
 * "blijft een concept"-belofte, de foutafhandeling) komen uit dezelfde modules
 * — `communication-link.ts`, `default-company.ts`, `quotation.ts`.
 *
 * Vier dingen die hier expliciet geregeld zijn:
 *
 * - **Niets wordt verzonnen.** Het onderwerp van de mail wordt de eerste
 *   regel, met aantal 1 en tarief **0**. De prijs is wat de gebruiker moet
 *   invullen; een verzonnen bedrag wordt zonder nadenken bevestigd.
 * - **Het blijft een concept.** `docstatus: 0`, status "Draft". Eén klik in de
 *   webmail mag geen verstuurde offerte opleveren.
 * - **De partij kan een Lead zijn.** `quotation_to` is een Dynamic Link; live
 *   geverifieerd dat `"Lead"` werkt en `customer_name` uit `Lead.company_name`
 *   vult. Daardoor kan een lead die net vanuit dezelfde mail is aangemaakt
 *   meteen een offerte krijgen, zonder eerst een Customer te maken.
 * - **Het bedrijf komt uit één bron.** `useDefaultCompany()` — voorkeur van de
 *   gebruiker, dan `Global Defaults.default_company`, dan alfabetisch de
 *   eerste. Zie `default-company.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ExternalLink, Loader2, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { fetchAttachments, getErpNextLinkUrl, type FileInfo } from "../lib/erpnext";
import ItemSearchSelect from "./ItemSearchSelect";
import { useDefaultCompany } from "../lib/default-company";
import type { PartyHint } from "../lib/mail-intent";
import type { QuoteParty } from "../lib/mail-quote-actions";
import {
  classifyQuotationError,
  createQuotationFromMail,
  fetchQuotationDefaults,
  fetchSellingPriceLists,
  type MailDocumentResult,
} from "../lib/quotation";
import {
  DEFAULT_UOM,
  defaultValidTill,
  lineFromMailSubject,
  quotationDateFromMail,
  quotationTotal,
  validateQuotationInput,
  type QuotationInput,
  type QuotationLine,
} from "../lib/quotation-payload";

export interface CreateQuotationMessage {
  /** Communication-docname. */
  name: string;
  subject: string;
  sender: string;
  /** ERPNext-datetime van de mail. */
  date: string;
  /** Platte tekst van de mail; komt in het voorwaarden-veld terecht. */
  bodyText?: string;
}

interface Props {
  message: CreateQuotationMessage;
  /** De partij die de herkenning vond; leeg = de gebruiker kiest er zelf een. */
  party?: QuoteParty;
  /** Klanten uit `MailIntentContext`, voor de zoek-select. */
  customers: PartyHint[];
  onClose: () => void;
  onCreated: (result: MailDocumentResult) => void;
}

/** Chipje "herkend" — alleen als de waarde uit de mail komt. */
function RecognisedChip({ shown, title }: { shown: boolean; title: string }) {
  const { t } = useTranslation();
  if (!shown) return null;
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
    >
      <Sparkles size={9} /> {t("y_next.lead_recognised")}
    </span>
  );
}

/** Bedragen tonen zoals de rest van Y-next dat doet. */
function money(value: number, currency: string): string {
  try {
    return value.toLocaleString("nl-NL", { style: "currency", currency: currency || "EUR" });
  } catch {
    // Een valuta-code die `Intl` niet kent (of een lege) mag de dialoog niet
    // laten crashen midden in het invullen van een regel.
    return `${value.toFixed(2)} ${currency}`.trim();
  }
}

export default function CreateQuotationDialog({
  message, party, customers, onClose, onCreated,
}: Props) {
  const { t } = useTranslation();

  const { company, setCompany, companies } = useDefaultCompany();

  /* De partij. Een meegegeven Lead blijft een Lead — hem stilzwijgend als
     Customer doorgeven zou een lege Dynamic Link opleveren. */
  const [partyType, setPartyType] = useState<QuoteParty["doctype"]>(party?.doctype ?? "Customer");
  const [partyName, setPartyName] = useState(party?.name ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const customerBoxRef = useRef<HTMLDivElement>(null);

  const [transactionDate, setTransactionDate] = useState(() => quotationDateFromMail(message.date));
  const [validTill, setValidTill] = useState(() => defaultValidTill(quotationDateFromMail(message.date)));
  const [currency, setCurrency] = useState("");
  const [priceList, setPriceList] = useState("");
  const [priceLists, setPriceLists] = useState<string[]>([]);
  const [terms, setTerms] = useState(() => {
    const subject = (message.subject || "").trim();
    const body = (message.bodyText || "").trim().slice(0, 2000);
    return [subject, body].filter(Boolean).join("\n\n");
  });

  const [lines, setLines] = useState<QuotationLine[]>(() => [lineFromMailSubject(message.subject)]);

  const [attachments, setAttachments] = useState<FileInfo[]>([]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);

  /* Valuta + prijslijst horen bij het bedrijf, dus ze laden opnieuw zodra dat
     wisselt. Blijft het antwoord leeg, dan gaan de velden niet mee in de
     payload en leidt ERPNext ze zelf af — zie `quotation.ts`. */
  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    fetchQuotationDefaults(company)
      .then((d) => {
        if (cancelled) return;
        setCurrency(d.currency);
        setPriceList(d.sellingPriceList);
      })
      .catch(() => { /* ERPNext vult ze dan zelf in */ });
    return () => { cancelled = true; };
  }, [company]);

  useEffect(() => {
    let cancelled = false;
    fetchSellingPriceLists()
      .then((rows) => { if (!cancelled) setPriceLists(rows); })
      .catch(() => { /* de select toont dan alleen de opgeloste default */ });
    return () => { cancelled = true; };
  }, []);

  /* Bijlagen van de mail. PDF's staan standaard aan — dat is doorgaans de
     aanvraag zelf (bestek, tekening, programma van eisen). */
  useEffect(() => {
    let cancelled = false;
    fetchAttachments("Communication", message.name)
      .then((files) => {
        if (cancelled) return;
        setAttachments(files);
        setPicked(new Set(files.filter((f) => /\.pdf$/i.test(f.file_name)).map((f) => f.name)));
      })
      .catch(() => { /* zonder bijlagen aanmaken mag gewoon */ });
    return () => { cancelled = true; };
  }, [message.name]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target as Node)) setCustomerOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const rows = q
      ? customers.filter((c) => `${c.name} ${c.partyName ?? ""}`.toLowerCase().includes(q))
      : customers;
    return rows.slice(0, 30);
  }, [customers, customerQuery]);

  const pickedAttachments = useCallback(() => attachments
    .filter((f) => picked.has(f.name))
    .map((f) => ({ name: f.name, fileName: f.file_name, fileUrl: f.file_url, isPrivate: f.is_private === 1 })),
  [attachments, picked]);

  const total = useMemo(() => quotationTotal(lines), [lines]);

  function updateLine(index: number, patch: Partial<QuotationLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function addEmptyLine() {
    setLines((prev) => [...prev, { itemName: "", description: "", qty: 1, rate: 0, uom: DEFAULT_UOM }]);
  }

  /**
   * Een gekozen Item vult de láátste lege regel in plaats van er een nieuwe
   * onder te plakken: de eerste regel is voorgevuld met het mailonderwerp en
   * die is bijna altijd nog leeg qua prijs.
   */
  function addItemFromPicker(item: { item_code: string; item_name: string; description: string; rate: number; uom: string }) {
    setLines((prev) => {
      const line: QuotationLine = {
        itemCode: item.item_code,
        itemName: item.item_name,
        description: item.description,
        qty: 1,
        rate: item.rate,
        uom: item.uom || DEFAULT_UOM,
      };
      const emptyIndex = prev.findIndex((l) => !l.itemName.trim() && !l.rate);
      if (emptyIndex >= 0) return prev.map((l, i) => (i === emptyIndex ? line : l));
      return [...prev, line];
    });
  }

  const currentInput = (): QuotationInput => ({
    partyType,
    party: partyName,
    company,
    transactionDate,
    ...(validTill ? { validTill } : {}),
    lines,
    ...(message.sender ? { contactEmail: message.sender } : {}),
    ...(currency ? { currency } : {}),
    ...(priceList ? { sellingPriceList: priceList } : {}),
    ...(terms.trim() ? { terms: terms.trim() } : {}),
  });

  async function handleSubmit() {
    setError("");
    const input = currentInput();
    const gaps = validateQuotationInput(input);
    setMissing(gaps);
    if (gaps.length > 0) return;
    setSaving(true);
    try {
      onCreated(await createQuotationFromMail({
        input, communication: message.name, attachments: pickedAttachments(),
      }));
    } catch (err) {
      setError(t(`y_next.quote_error_${classifyQuotationError(err).replace(/-/g, "_")}`));
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = (name: string) =>
    `w-full rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 ${
      missing.includes(name) ? "border-red-400 bg-red-50" : "border-slate-200"
    }`;

  const label = (key: string, recognised = false, why = "") => (
    <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
      {t(key)}
      <RecognisedChip shown={recognised} title={why} />
    </span>
  );

  const selectedPartyLabel = partyName
    ? (partyType === "Customer"
      ? (customers.find((c) => c.name === partyName)?.partyName ?? partyName)
      : partyName)
    : "";

  return (
    // Lichte sluier, net als `CreateLeadDialog`: de mailtekst eronder moet
    // leesbaar blijven — je opent dit venster juist om er iets uit over te nemen.
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/10 p-4 sm:p-8">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800">{t("y_next.quote_dialog_title")}</h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {message.subject} · {message.sender}
            </p>
          </div>
          <button onClick={onClose} title={t("common.close")}
            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[72vh] space-y-3 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Partij. Een Lead houdt zijn eigen label — de gebruiker moet
                zien dát hij aan een lead offreert en niet aan een klant. */}
            <div className="sm:col-span-2" ref={customerBoxRef}>
              {label(
                partyType === "Lead" ? "y_next.quote_party_lead" : "y_next.quote_party_customer",
                Boolean(party?.name) && partyName === party?.name,
                t("y_next.lead_reason_customer"),
              )}
              {partyType === "Lead" ? (
                <div className="flex items-center gap-2">
                  <span className={`${fieldClass("party")} flex-1 truncate bg-slate-50 text-slate-700`}>
                    {selectedPartyLabel}
                  </span>
                  <button type="button"
                    onClick={() => { setPartyType("Customer"); setPartyName(""); setCustomerOpen(true); }}
                    className="cursor-pointer whitespace-nowrap rounded px-2 py-1.5 text-[11px] text-slate-500 hover:bg-slate-100">
                    {t("y_next.quote_switch_to_customer")}
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <button type="button"
                    onClick={() => { setCustomerOpen((v) => !v); setCustomerQuery(""); }}
                    className={`${fieldClass("party")} flex cursor-pointer items-center justify-between gap-2 text-left`}>
                    <span className={selectedPartyLabel ? "text-slate-800" : "text-slate-400"}>
                      {selectedPartyLabel || t("y_next.lead_pick_customer")}
                    </span>
                    <Search size={12} className="flex-shrink-0 text-slate-400" />
                  </button>
                  {customerOpen && (
                    <div className="absolute left-0 top-full z-10 mt-1 flex max-h-60 w-full flex-col rounded-lg border border-slate-200 bg-white shadow-lg">
                      <div className="border-b border-slate-100 p-2">
                        <input autoFocus type="search" value={customerQuery}
                          onChange={(e) => setCustomerQuery(e.target.value)}
                          placeholder={t("y_next.lead_search_customer")}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </div>
                      <div className="flex-1 overflow-y-auto py-1">
                        {customerMatches.length === 0 ? (
                          <p className="px-3 py-2 text-xs italic text-slate-400">{t("webmail.no_results")}</p>
                        ) : customerMatches.map((c) => (
                          <button key={c.name} type="button"
                            onClick={() => { setPartyName(c.name); setCustomerOpen(false); }}
                            className="w-full cursor-pointer truncate px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                            {c.partyName ?? c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <label className="block">
              {label("y_next.lead_owner_company")}
              <select value={company} onChange={(e) => setCompany(e.target.value)} className={fieldClass("company")}>
                {/* Zolang de lijst nog binnenkomt heeft `company` al de
                    opgeloste waarde; zonder deze regel zou de select leeg
                    staan terwijl er wél een bedrijf gekozen is. */}
                {!companies.some((c) => c.name === company) && (
                  <option value={company}>{company || t("common.loading")}</option>
                )}
                {companies.map((c) => <option key={c.name} value={c.name}>{c.company_name || c.name}</option>)}
              </select>
            </label>

            <label className="block">
              {label("y_next.quote_transaction_date", true, t("y_next.lead_reason_mail_date"))}
              <input type="date" value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className={fieldClass("transactionDate")} />
            </label>

            <label className="block">
              {label("y_next.quote_valid_till")}
              <input type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)}
                className={fieldClass("validTill")} />
              <span className="mt-0.5 block text-[10px] text-slate-400">{t("y_next.quote_valid_till_hint")}</span>
            </label>

            <label className="block">
              {label("y_next.quote_price_list")}
              <select value={priceList} onChange={(e) => setPriceList(e.target.value)}
                className={fieldClass("sellingPriceList")}>
                <option value="">{t("y_next.quote_price_list_auto")}</option>
                {priceLists.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {currency && (
                <span className="mt-0.5 block text-[10px] text-slate-400">
                  {t("y_next.quote_currency", { currency })}
                </span>
              )}
            </label>
          </div>

          {/* Regels */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-slate-500">{t("y_next.quote_lines")}</p>
              <button type="button" onClick={addEmptyLine}
                className="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100">
                <Plus size={10} /> {t("y_next.quote_add_line")}
              </button>
            </div>

            <div className="mb-2">
              <ItemSearchSelect onAdd={(qi) => addItemFromPicker(qi)} />
              <span className="mt-0.5 block text-[10px] text-slate-400">{t("y_next.quote_item_hint")}</span>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500">
                    <th className="px-2 py-1.5 text-left">{t("y_next.quote_col_description")}</th>
                    <th className="w-16 px-2 py-1.5 text-right">{t("y_next.quote_col_qty")}</th>
                    <th className="w-24 px-2 py-1.5 text-right">{t("y_next.quote_col_rate")}</th>
                    <th className="w-24 px-2 py-1.5 text-right">{t("y_next.quote_col_amount")}</th>
                    <th className="w-7" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-2 py-1.5">
                        <input value={line.itemName}
                          onChange={(e) => updateLine(i, { itemName: e.target.value })}
                          placeholder={t("y_next.quote_line_placeholder")}
                          className={fieldClass(`lines.${i}.itemName`)} />
                        {line.itemCode && (
                          <p className="px-1 pt-0.5 font-mono text-[10px] text-slate-400">{line.itemCode}</p>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0.01" step="0.01" value={line.qty}
                          onChange={(e) => updateLine(i, { qty: parseFloat(e.target.value) || 0 })}
                          className={`${fieldClass(`lines.${i}.qty`)} text-right`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" value={line.rate}
                          onChange={(e) => updateLine(i, { rate: parseFloat(e.target.value) || 0 })}
                          className={`${fieldClass(`lines.${i}.rate`)} text-right`} />
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs font-semibold text-slate-700">
                        {money((line.qty || 0) * (line.rate || 0), currency)}
                      </td>
                      <td className="px-1 py-1.5">
                        <button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 1}
                          title={t("common.delete")}
                          className="cursor-pointer p-1 text-slate-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <td colSpan={3} className="px-2 py-2 text-right text-[11px] font-semibold text-slate-500">
                      {t("common.total")}
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-bold text-slate-800">{money(total, currency)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <label className="block">
            {label("y_next.quote_terms", true, t("y_next.lead_reason_subject"))}
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={4}
              className={`${fieldClass("terms")} resize-y`} />
            <span className="mt-0.5 block text-[10px] text-slate-400">{t("y_next.quote_terms_hint")}</span>
          </label>

          {/* Bijlagen */}
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">{t("y_next.lead_attachments")}</p>
            {attachments.length === 0 ? (
              <p className="text-[11px] italic text-slate-400">{t("y_next.lead_no_attachments")}</p>
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

          {missing.length > 0 && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {t("y_next.quote_missing_fields", { fields: missing.map(fieldLabel(t)).join(", ") })}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <p className="text-[11px] text-slate-400">{t("y_next.quote_draft_note")}</p>
          <div className="flex items-center gap-2">
            <a href={`${getErpNextLinkUrl()}/quotation`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 rounded px-2 py-1.5 text-[11px] text-slate-500 hover:bg-slate-100">
              <ExternalLink size={10} /> {t("y_next.quote_open_list")}
            </a>
            <button onClick={onClose} disabled={saving}
              className="cursor-pointer rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50">
              {t("common.cancel")}
            </button>
            <button onClick={() => void handleSubmit()} disabled={saving}
              className="flex cursor-pointer items-center gap-1.5 rounded bg-violet-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {saving ? t("y_next.quote_creating") : t("y_next.quote_create")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Validatiecode → leesbaar veld. Regelfouten dragen hun index (`lines.2.qty`);
 * die wordt "Regel 3 · Aantal", zodat de melding zegt wélke regel niet klopt.
 */
function fieldLabel(t: (key: string, opts?: Record<string, unknown>) => string) {
  return (code: string): string => {
    const row = code.match(/^lines\.(\d+)\.(\w+)$/);
    if (row) {
      return `${t("y_next.quote_field_line", { nr: Number(row[1]) + 1 })} · ${
        t(`y_next.quote_field_${toKey(row[2])}`, { defaultValue: row[2] })}`;
    }
    return t(`y_next.quote_field_${toKey(code)}`, { defaultValue: code });
  };
}

/** `sellingPriceList` → `selling_price_list`: codes zijn camelCase, sleutels snake_case. */
function toKey(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
