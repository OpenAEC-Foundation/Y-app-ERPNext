/**
 * Bevestigingsdialoog voor "mail → lead" en "mail → offerteaanvraag".
 *
 * Eén component voor beide, want het verschil is klein en de flow identiek:
 * `classifyMailIntent` vult in wat het in de mail kón vinden, de gebruiker ziet
 * **welke velden herkend zijn** (het blauwe "herkend"-chipje) en bevestigt.
 * Twee losse dialogen zouden gegarandeerd uit elkaar gaan lopen op de dingen
 * die ze wél delen: bijlagen meenemen, de bron, het bedrijf, de foutafhandeling
 * en de "wordt niet ingediend"-belofte.
 *
 * Wat de twee modi onderscheidt:
 *
 * - **Lead** — de afzender is onbekend. Er is dus geen klant om aan te hangen;
 *   naam, bedrijf, e-mail en telefoon komen uit de mail en zijn allemaal
 *   bewerkbaar. ERPNext eist minstens een persoons- óf een bedrijfsnaam.
 * - **Offerteaanvraag** — de afzender is een bestaande klant. Dan is de klant
 *   het hoofdveld (met zoek-select, want de herkenning kan ernaast zitten bij
 *   een verzamel-klant) en zijn naam/bedrijf niet relevant: die staan al bij
 *   de klant zelf.
 *
 * Drie dingen die hier expliciet geregeld zijn:
 *
 * - **Niets wordt verzonnen.** Een veld dat de herkenning niet gevonden heeft
 *   is leeg en draagt geen chipje. Een verzonnen bedrijfsnaam wordt zonder
 *   nadenken bevestigd; een leeg veld wordt ingevuld.
 * - **Het blijft een concept.** Een Lead en een Opportunity zijn allebei
 *   niet-indienbare documenten in de openstaande status ("Lead" / "Open"). Eén
 *   klik in de webmail mag geen verplichting in het CRM opleveren.
 * - **De mail komt in de tijdlijn.** Aanmaken zet `reference_*` én een
 *   `timeline_links`-rij op de Communication, zodat de mail bij het nieuwe
 *   document staat — zie `communication-link.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ExternalLink, Loader2, Search, Sparkles, X } from "lucide-react";
import { fetchAttachments, fetchList, getErpNextLinkUrl, type FileInfo } from "../lib/erpnext";
import { useDefaultCompany } from "../lib/default-company";
import type { MailIntent, PartyHint } from "../lib/mail-intent";
import {
  createLeadFromMail,
  createOpportunityFromMail,
  classifyLeadError,
  MAIL_UTM_SOURCE,
  type MailDocumentResult,
} from "../lib/lead";
import {
  isoDatePart,
  todayIso,
  validateLeadInput,
  validateOpportunityInput,
  type LeadInput,
  type OpportunityInput,
} from "../lib/lead-payload";

export interface CreateLeadMessage {
  /** Communication-docname. */
  name: string;
  subject: string;
  sender: string;
  /** ERPNext-datetime van de mail. */
  date: string;
}

interface Props {
  message: CreateLeadMessage;
  /** `kind` moet `"lead"` of `"quote-request"` zijn. */
  intent: MailIntent;
  customers: PartyHint[];
  onClose: () => void;
  onCreated: (doctype: "Lead" | "Opportunity", result: MailDocumentResult) => void;
}

/** Chipje "herkend" — alleen als de waarde uit de mail komt en niet is aangepast. */
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

export default function CreateLeadDialog({ message, intent, customers, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const isQuote = intent.kind === "quote-request";
  const detected = intent.contact ?? {};

  /**
   * Bedrijf én bedrijvenlijst komen uit `useDefaultCompany()` en niet uit
   * `useCompanies()`: de popout-lezer (`/mail/view`) rendert bewust buiten
   * `DataProvider` — een DataContext-hook zou daar gooien en de dialoog
   * onbruikbaar maken in precies de weergave waar je een mail via dubbelklik
   * opent. Het vangnet "pak `rows[0]`" is er bewust uit: dat is op deze
   * instance alfabetisch het verkeerde bedrijf. Zie `default-company.ts`.
   */
  const { company, setCompany, companies } = useDefaultCompany();
  const [opportunityTypes, setOpportunityTypes] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [customer, setCustomer] = useState(intent.customer ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [personName, setPersonName] = useState(detected.personName ?? "");
  const [companyName, setCompanyName] = useState(detected.companyName ?? "");
  const [email, setEmail] = useState(detected.email ?? message.sender ?? "");
  const [phone, setPhone] = useState(detected.phone ?? "");
  const [note, setNote] = useState(message.subject || "");
  const [source, setSource] = useState(MAIL_UTM_SOURCE);
  const [opportunityType, setOpportunityType] = useState("Sales");
  const [transactionDate, setTransactionDate] = useState(
    () => isoDatePart(message.date) || todayIso(),
  );

  const [attachments, setAttachments] = useState<FileInfo[]>([]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const customerBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchList<{ name: string }>("Opportunity Type", { fields: ["name"], limit_page_length: 0 })
      .then((rows) => { if (!cancelled) setOpportunityTypes(rows.map((r) => r.name)); })
      .catch(() => { /* zonder lijst blijft "Sales" staan; die bestaat standaard */ });

    // De bron is optioneel: bestaat "Email" niet op deze instance, dan wordt
    // het veld gewoon leeg gelaten (en `createLeadFromMail` laat het weg).
    fetchList<{ name: string }>("UTM Source", { fields: ["name"], limit_page_length: 0, order_by: "name asc" })
      .then((rows) => {
        if (cancelled) return;
        const names = rows.map((r) => r.name);
        setSources(names);
        setSource((prev) => (names.includes(prev) ? prev : ""));
      })
      .catch(() => { if (!cancelled) setSource(""); });

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

  async function handleSubmit() {
    setError("");
    if (isQuote) {
      const input: OpportunityInput = {
        customer, company, transactionDate,
        opportunityType,
        ...(email.trim() ? { contactEmail: email.trim() } : {}),
        ...(phone.trim() ? { contactPhone: phone.trim() } : {}),
        ...(source ? { source } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      const gaps = validateOpportunityInput(input);
      setMissing(gaps);
      if (gaps.length > 0) return;
      setSaving(true);
      try {
        onCreated("Opportunity", await createOpportunityFromMail({
          input, communication: message.name, attachments: pickedAttachments(),
        }));
      } catch (err) {
        setError(t(`y_next.lead_error_${classifyLeadError(err).replace(/-/g, "_")}`));
      } finally {
        setSaving(false);
      }
      return;
    }

    const input: LeadInput = {
      ...(personName.trim() ? { leadName: personName.trim() } : {}),
      ...(detected.firstName ? { firstName: detected.firstName } : {}),
      ...(detected.lastName ? { lastName: detected.lastName } : {}),
      ...(companyName.trim() ? { companyName: companyName.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(company ? { company } : {}),
      ...(source ? { source } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    const gaps = validateLeadInput(input);
    setMissing(gaps);
    if (gaps.length > 0) return;
    setSaving(true);
    try {
      onCreated("Lead", await createLeadFromMail({
        input, communication: message.name, attachments: pickedAttachments(),
      }));
    } catch (err) {
      setError(t(`y_next.lead_error_${classifyLeadError(err).replace(/-/g, "_")}`));
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

  const selectedCustomerLabel = customer
    ? (customers.find((c) => c.name === customer)?.partyName ?? customer)
    : "";

  return (
    // Bewust een lichte sluier (10%) in plaats van de gebruikelijke 40%: de
    // mailtekst eronder moet leesbaar blijven terwijl dit venster open staat —
    // je opent het juist om iets uit die mail over te nemen. De schaduw en de
    // rand van het paneel doen het scheiden, niet het verduisteren.
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/10 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800">
              {t(isQuote ? "y_next.lead_dialog_title_quote" : "y_next.lead_dialog_title_lead")}
            </h2>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isQuote ? (
              <div className="sm:col-span-2" ref={customerBoxRef}>
                {label("y_next.lead_customer", Boolean(intent.customer), t("y_next.lead_reason_customer"))}
                <div className="relative">
                  <button type="button"
                    onClick={() => { setCustomerOpen((v) => !v); setCustomerQuery(""); }}
                    className={`${fieldClass("customer")} flex cursor-pointer items-center justify-between gap-2 text-left`}>
                    <span className={selectedCustomerLabel ? "text-slate-800" : "text-slate-400"}>
                      {selectedCustomerLabel || t("y_next.lead_pick_customer")}
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
                            onClick={() => { setCustomer(c.name); setCustomerOpen(false); }}
                            className="w-full cursor-pointer truncate px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                            {c.partyName ?? c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <label className="block">
                  {label("y_next.lead_person", Boolean(detected.personName), t("y_next.lead_reason_sender_name"))}
                  <input value={personName} onChange={(e) => setPersonName(e.target.value)}
                    className={fieldClass("leadName")} placeholder={t("y_next.lead_person_placeholder")} />
                </label>
                <label className="block">
                  {label("y_next.lead_company_name", Boolean(detected.companyName), t("y_next.lead_reason_signature"))}
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                    className={fieldClass("companyName")} placeholder={t("y_next.lead_company_placeholder")} />
                </label>
              </>
            )}

            <label className="block">
              {label("y_next.lead_email", Boolean(detected.email), t("y_next.lead_reason_sender"))}
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                className={fieldClass(isQuote ? "contactEmail" : "email")} />
            </label>

            <label className="block">
              {label("y_next.lead_phone", Boolean(detected.phone), t("y_next.lead_reason_signature_phone"))}
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className={fieldClass("phone")} placeholder={t("y_next.lead_phone_placeholder")} />
            </label>

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

            {isQuote && (
              <>
                <label className="block">
                  {label("y_next.lead_opportunity_type")}
                  <select value={opportunityType} onChange={(e) => setOpportunityType(e.target.value)}
                    className={fieldClass("opportunityType")}>
                    {(opportunityTypes.length > 0 ? opportunityTypes : ["Sales"]).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  {label("y_next.lead_transaction_date", true, t("y_next.lead_reason_mail_date"))}
                  <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)}
                    className={fieldClass("transactionDate")} />
                </label>
              </>
            )}

            <label className="block">
              {label("y_next.lead_source")}
              <select value={source} onChange={(e) => setSource(e.target.value)} className={fieldClass("source")}>
                <option value="">{t("y_next.lead_no_source")}</option>
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {sources.length > 0 && !sources.includes(MAIL_UTM_SOURCE) && (
                <span className="mt-0.5 block text-[10px] text-slate-400">{t("y_next.lead_source_missing")}</span>
              )}
            </label>

            <label className="block sm:col-span-2">
              {label("y_next.lead_note", true, t("y_next.lead_reason_subject"))}
              <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass("note")} />
              <span className="mt-0.5 block text-[10px] text-slate-400">{t("y_next.lead_note_hint")}</span>
            </label>
          </div>

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
              {t("y_next.lead_missing_fields", {
                fields: missing.map((m) => t(`y_next.lead_field_${toKey(m)}`, { defaultValue: m })).join(", "),
              })}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <p className="text-[11px] text-slate-400">{t("y_next.lead_open_note")}</p>
          <div className="flex items-center gap-2">
            <a href={`${getErpNextLinkUrl()}/${isQuote ? "opportunity" : "lead"}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 rounded px-2 py-1.5 text-[11px] text-slate-500 hover:bg-slate-100">
              <ExternalLink size={10} /> {t("y_next.lead_open_list")}
            </a>
            <button onClick={onClose} disabled={saving}
              className="cursor-pointer rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50">
              {t("common.cancel")}
            </button>
            <button onClick={() => void handleSubmit()} disabled={saving}
              className="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {saving
                ? t("y_next.lead_creating")
                : t(isQuote ? "y_next.lead_create_quote" : "y_next.lead_create_lead")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** `contactEmail` → `contact_email`: de validatiecodes gebruiken camelCase, de
 *  vertaalsleutels snake_case. */
function toKey(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
