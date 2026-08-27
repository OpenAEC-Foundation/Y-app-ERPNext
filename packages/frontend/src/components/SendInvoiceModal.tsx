/**
 * Modal that lets the user review and send a Sales Invoice through
 * ERPNext's own Communication mechanism.
 *
 * Layout:
 *   ┌──────────────────────────────────────────┐
 *   │ Header: title + close                    │
 *   ├──────────────────┬───────────────────────┤
 *   │ PDF preview      │ Email form            │
 *   │ (iframe)         │  - From (read-only)   │
 *   │                  │  - To / CC / BCC      │
 *   │                  │  - Subject            │
 *   │                  │  - Body (HTML)        │
 *   │                  │  - Signature preview  │
 *   ├──────────────────┴───────────────────────┤
 *   │ Footer: Annuleren / Open in ERPNext / … │
 *   └──────────────────────────────────────────┘
 *
 * For draft invoices (mode="draft") the bottom-right button submits
 * the invoice first (docstatus 0 → 1) and then sends the mail.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, ExternalLink, AlertTriangle, RefreshCw, Send, FileText, ZoomIn, ZoomOut, Maximize2, Mail, Paperclip } from "lucide-react";
import { fetchDocument, getErpNextAppUrl, getErpNextLinkUrl } from "../lib/erpnext";
import {
  fetchInvoiceEmailTemplates,
  fetchPrintPreviewHtml,
  fetchSalesInvoicePrintFormats,
  loadAccountSignature,
  loadInvoiceEmailDefaults,
  loadOutgoingEmailAccount,
  renderEmailTemplate,
  sendInvoiceEmail,
  submitInvoice,
  type EmailTemplateOption,
  type OutgoingEmailAccount,
  type PrintFormatOption,
  type SignatureSource,
} from "../lib/invoiceEmail";

export type SendInvoiceMode = "draft" | "submitted";

interface SendInvoiceModalProps {
  invoiceName: string;
  /** "draft" = will submit + send. "submitted" = send only. */
  mode: SendInvoiceMode;
  onClose: () => void;
  /** Called after a successful send. The page can refresh its data. */
  onSent?: () => void;
}

interface InvoiceLite {
  name: string;
  customer_name?: string;
  contact_email?: string;
  grand_total?: number;
}

export default function SendInvoiceModal({
  invoiceName,
  mode,
  onClose,
  onSent,
}: SendInvoiceModalProps) {
  const { t } = useTranslation();

  // ── Loading state ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Invoice + ERPNext context (single source of truth) ─────────
  const [invoice, setInvoice] = useState<InvoiceLite | null>(null);
  const [outgoingAccount, setOutgoingAccount] = useState<OutgoingEmailAccount | null>(null);
  const [outgoingOptions, setOutgoingOptions] = useState<OutgoingEmailAccount[]>([]);
  const [signature, setSignature] = useState<string>("");
  const [signatureSource, setSignatureSource] = useState<SignatureSource>("none");
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([]);
  const [printFormats, setPrintFormats] = useState<PrintFormatOption[]>([]);
  // Diagnostics — remember what defaults Settings handed us so we can show
  // the user whether their configured default is actually being applied.
  const [loadedDefaults, setLoadedDefaults] = useState<{ template: string; format: string }>({ template: "", format: "" });

  // ── Form state (editable overrides — not persisted in Y-app) ──
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [printFormat, setPrintFormat] = useState<string>("");
  const [includeLetterhead, setIncludeLetterhead] = useState(true);
  const [recipients, setRecipients] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // ── Send state ─────────────────────────────────────────────────
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentOk, setSentOk] = useState(false);
  // Atomicity: once we've submitted the draft (docstatus 0 → 1) we must NOT
  // try to submit again on retry — that would error and prevent the user
  // from re-sending the (now-submitted) invoice.
  const [effectiveMode, setEffectiveMode] = useState<SendInvoiceMode>(mode);
  useEffect(() => { setEffectiveMode(mode); }, [mode]);

  // Track whether the user has manually edited subject/body so we don't
  // overwrite their tweaks when they pick a different template.
  const subjectTouched = useRef(false);
  const bodyTouched = useRef(false);
  // contentEditable ref — kept out of React's controlled state so cursor
  // position is preserved while typing. We push to `body` state on input.
  const bodyEditorRef = useRef<HTMLDivElement | null>(null);
  // Track the last template-rendered HTML so we know when to actually
  // replace the editor's innerHTML (changing it nukes the cursor).
  const lastSetBodyHtml = useRef<string>("");

  // ── Initial load ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [
          inv,
          accountRes,
          tmpls,
          formats,
          defaults,
        ] = await Promise.all([
          fetchDocument<InvoiceLite>("Sales Invoice", invoiceName),
          loadOutgoingEmailAccount(),
          fetchInvoiceEmailTemplates(),
          fetchSalesInvoicePrintFormats(),
          loadInvoiceEmailDefaults(),
        ]);
        if (cancelled) return;
        setInvoice(inv);
        setOutgoingAccount(accountRes.preferred);
        setOutgoingOptions(accountRes.options);
        // Signature: per-account, not per-user. Initial load is for the
        // preferred account; the change-effect below re-fetches when the
        // user switches the From-dropdown.
        const initialSig = accountRes.preferred
          ? await loadAccountSignature(accountRes.preferred.name)
          : { html: "", source: "none" as const };
        if (cancelled) return;
        setSignature(initialSig.html);
        setSignatureSource(initialSig.source);
        setTemplates(tmpls);
        setPrintFormats(formats);

        // Strict defaults — only use what the employer configured in
        // Settings → Project instellingen → Factuur versturen.
        // If they didn't configure it, leave empty so the user must pick
        // and it's visually obvious nothing was set (avoids silently
        // sending with the wrong print format).
        setLoadedDefaults({
          template: defaults.default_email_template || "",
          format: defaults.default_print_format || "",
        });
        setSelectedTemplate(defaults.default_email_template || "");
        setPrintFormat(defaults.default_print_format || "");
        setRecipients(inv.contact_email || "");
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invoiceName]);

  // ── Re-load signature whenever the From-account changes ───────
  // The user can pick a different Email Account in the From-dropdown
  // (e.g. switch between administratie@ and piet@). Each ERPNext Email
  // Account has its own `signature` field, so the preview must follow.
  useEffect(() => {
    if (!outgoingAccount) return;
    let cancelled = false;
    (async () => {
      const sig = await loadAccountSignature(outgoingAccount.name);
      if (!cancelled) {
        setSignature(sig.html);
        setSignatureSource(sig.source);
      }
    })();
    return () => { cancelled = true; };
  }, [outgoingAccount]);

  // ── On first mount with body already in state (e.g. fast re-open of the
  //    same invoice), push it into the contentEditable div. The template-
  //    render effect below also writes innerHTML, but it only runs after the
  //    async template fetch — if the editor mounts after that completes,
  //    we'd otherwise show an empty editor with non-empty `body` state.
  useEffect(() => {
    if (bodyEditorRef.current && body && bodyEditorRef.current.innerHTML !== body) {
      bodyEditorRef.current.innerHTML = body;
      lastSetBodyHtml.current = body;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoingAccount, invoice]);

  // ── Re-render subject + body when the template changes ─────────
  useEffect(() => {
    if (!selectedTemplate || !invoice) return;
    let cancelled = false;
    (async () => {
      const rendered = await renderEmailTemplate(
        selectedTemplate,
        "Sales Invoice",
        invoiceName,
      );
      if (cancelled) return;
      if (!subjectTouched.current) setSubject(rendered.subject);
      if (!bodyTouched.current) {
        setBody(rendered.message);
        // Push rendered HTML directly into the contentEditable so the
        // browser renders the markup instead of showing raw tags.
        if (bodyEditorRef.current) {
          bodyEditorRef.current.innerHTML = rendered.message;
          lastSetBodyHtml.current = rendered.message;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTemplate, invoice, invoiceName]);

  // ── PDF preview HTML (fetched via window.fetch so the interceptor adds
  //    X-Y-App-Instance — iframe src=… would bypass it and 401) ─────────
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  // Zoom: 1.0 = native A4 (794px wide at 96dpi). Auto-fit when first preview
  // arrives so the page fills the available container width.
  const [zoom, setZoom] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const zoomTouched = useRef(false);
  function fitToWidth() {
    const c = previewContainerRef.current;
    if (!c) return;
    // 794 = A4 at 96dpi. Subtract a few px for scrollbar.
    const w = Math.max(200, c.clientWidth - 16);
    setZoom(w / 794);
    zoomTouched.current = true;
  }
  // Auto-fit on first preview render
  useEffect(() => {
    if (previewHtml && !zoomTouched.current) {
      // Defer one frame so layout settles
      const t = setTimeout(fitToWidth, 50);
      return () => clearTimeout(t);
    }
  }, [previewHtml]);
  useEffect(() => {
    if (!invoice || !printFormat) {
      setPreviewHtml("");
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      const html = await fetchPrintPreviewHtml("Sales Invoice", invoice.name, printFormat, includeLetterhead);
      if (cancelled) return;
      setPreviewHtml(html);
      setPreviewLoading(false);
    })();
    return () => { cancelled = true; };
  }, [invoice, printFormat, includeLetterhead]);

  // ── Send action ────────────────────────────────────────────────
  const canSend = !!invoice && !!recipients.trim() && !!printFormat &&
    !!subject.trim() && !!body.trim() && !!outgoingAccount && !sending;

  async function handleSend() {
    if (!invoice || !canSend) return;
    setSending(true);
    setSendError(null);
    try {
      if (effectiveMode === "draft") {
        await submitInvoice(invoiceName);
        // From here on the invoice is submitted — retrying the submit step
        // would fail with "already submitted". Lock the mode so subsequent
        // attempts only retry the email send.
        setEffectiveMode("submitted");
      }
      // Append the user's signature to the content. Frappe's email.make
      // does NOT auto-append the signature — only ERPNext's own compose-UI
      // does that, by prefilling the textarea with signature HTML. When we
      // bypass the UI we have to mimic the behavior ourselves. We use the
      // raw signature HTML (with original/relative URLs, as the recipient's
      // mail client will see them) — NOT the URL-rewritten preview.
      // Wrap in a max-width container so embedded <hr> / underline elements
      // don't stretch across the full mail viewport (matches modal preview).
      const contentWithSignature = signatureForRecipient
        ? `${body}<br><br><div style="max-width:300px">${signatureForRecipient}</div>`
        : body;
      await sendInvoiceEmail({
        name: invoiceName,
        subject: subject.trim(),
        content: contentWithSignature,
        recipients: recipients.trim(),
        cc: cc.trim(),
        bcc: bcc.trim(),
        printFormat,
        includeLetterhead,
        senderAccount: outgoingAccount?.name,
      });
      setSentOk(true);
      onSent?.();
      // Close after a brief delay so the user sees the success state.
      setTimeout(() => onClose(), 800);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  const erpnextLink = `${getErpNextLinkUrl()}/sales-invoice/${invoiceName}`;

  // Signature HTML often references `/files/foo.png`, `/private/files/...`,
  // `/assets/...`. `signatureForRecipient` rewrites those to absolute
  // ERPNext URLs — needed for what we send out in the email body (the
  // recipient's mail client fetches them from a browser/device that isn't
  // same-origin with ERPNext). The in-app preview below, in contrast, is
  // rendered directly into the page DOM (not a sandboxed iframe) and Y-next
  // runs same-origin with ERPNext, so the original relative paths already
  // resolve correctly there — no proxy/rewrite needed for the preview.
  const signatureForRecipient = (() => {
    if (!signature) return "";
    const erpHost = getErpNextAppUrl().replace(/\/$/, "");
    if (!erpHost) return signature;
    return signature
      .replace(/(src|href)="(\/(?:files|private\/files|assets)\/[^"]*)"/g,
               `$1="${erpHost}$2"`)
      .replace(/(src|href)='(\/(?:files|private\/files|assets)\/[^']*)'/g,
               `$1='${erpHost}$2'`);
  })();
  const signaturePreviewHtml = signature;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {t("invoice_email.modal_title", { defaultValue: "Factuur versturen" })}
            </h2>
            <div className="text-xs text-slate-500 mt-0.5">
              {invoice ? `${invoice.name} — ${invoice.customer_name ?? ""}` : invoiceName}
              {effectiveMode === "draft" && (
                <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full">
                  {t("invoice_email.draft_will_submit", { defaultValue: "DRAFT — wordt eerst ingeboekt" })}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────── */}
        {loading && (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <RefreshCw size={18} className="animate-spin mr-2" />
            {t("invoice_email.loading", { defaultValue: "Laden…" })}
          </div>
        )}

        {!loading && loadError && (
          <div className="flex-1 p-6">
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
              <AlertTriangle size={16} className="inline mr-1" />
              {loadError}
            </div>
          </div>
        )}

        {!loading && !loadError && !outgoingAccount && (
          <div className="flex-1 p-6">
            <div className="bg-amber-50 border border-amber-300 rounded p-4 text-sm text-amber-900">
              <div className="font-semibold flex items-center gap-2 mb-1">
                <AlertTriangle size={16} />
                {t("invoice_email.no_email_account_title", { defaultValue: "Geen outgoing Email Account in ERPNext" })}
              </div>
              <div>
                {t("invoice_email.no_email_account_body", {
                  defaultValue: "ERPNext heeft geen default outgoing Email Account voor deze instance. Zonder geconfigureerd account blijft de mail in de Email Queue staan. Stel eerst een Email Account in en zet 'Default Outgoing' aan.",
                })}
              </div>
              <a href={`${getErpNextLinkUrl()}/email-account`}
                 target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 mt-3 text-amber-900 hover:underline font-medium">
                <ExternalLink size={14} />
                {t("invoice_email.open_email_account", { defaultValue: "Open Email Account in ERPNext" })}
              </a>
            </div>
          </div>
        )}

        {!loading && !loadError && outgoingAccount && invoice && (
          <div className="flex-1 overflow-y-auto">
            {/* ── Section banner: E-mail ─────────────────────── */}
            <div className="flex items-center gap-2 px-4 py-2 bg-y-teal/10 border-y border-y-teal/30">
              <Mail size={16} className="text-y-teal-dark flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  {t("invoice_email.section_mail", { defaultValue: "E-mail" })}
                </div>
                <div className="text-[11px] text-slate-500 leading-tight">
                  {t("invoice_email.section_mail_hint", { defaultValue: "Wat de ontvanger in zijn mailbox ziet" })}
                </div>
              </div>
            </div>
            {/* ── Mail form on top ───────────────────────────── */}
            <div className="p-4 space-y-2">
                {/* Row 1: Verzonden vanaf + Sjabloon side-by-side */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5 block">
                      {t("invoice_email.from", { defaultValue: "Verzonden vanaf" })}
                    </label>
                    {outgoingOptions.length > 1 ? (
                      <select
                        value={outgoingAccount.name}
                        onChange={(e) => {
                          const next = outgoingOptions.find((o) => o.name === e.target.value);
                          if (next) setOutgoingAccount(next);
                        }}
                        className="w-full text-sm border border-slate-300 rounded px-2 py-1.5"
                      >
                        {outgoingOptions.map((opt) => (
                          <option key={opt.name} value={opt.name}>
                            {opt.email_id} {opt.name !== opt.email_id ? `(${opt.name})` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 truncate"
                           title={outgoingAccount.email_id}>
                        {outgoingAccount.email_id}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5 block">
                      {t("invoice_email.template", { defaultValue: "Sjabloon" })}
                    </label>
                    <select value={selectedTemplate}
                            onChange={(e) => {
                              setSelectedTemplate(e.target.value);
                              subjectTouched.current = false;
                              bodyTouched.current = false;
                            }}
                            className="w-full text-sm border border-slate-300 rounded px-2 py-1.5">
                      <option value="">{t("invoice_email.no_template", { defaultValue: "— Geen sjabloon —" })}</option>
                      {loadedDefaults.template && !templates.some((t) => t.name === loadedDefaults.template) && (
                        <option value={loadedDefaults.template}>{loadedDefaults.template} (uit Settings)</option>
                      )}
                      {templates.map((tmpl) => (
                        <option key={tmpl.name} value={tmpl.name}>{tmpl.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Aan / CC / BCC — 50/25/25 split */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5 block">
                      {t("invoice_email.to", { defaultValue: "Aan" })} <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={recipients}
                           onChange={(e) => setRecipients(e.target.value)}
                           placeholder="naam@klant.nl"
                           className="w-full text-sm border border-slate-300 rounded px-2 py-1.5" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5 block">CC</label>
                    <input type="text" value={cc}
                           onChange={(e) => setCc(e.target.value)}
                           placeholder="komma-gescheiden"
                           className="w-full text-sm border border-slate-300 rounded px-2 py-1.5" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5 block">BCC</label>
                    <input type="text" value={bcc}
                           onChange={(e) => setBcc(e.target.value)}
                           placeholder="komma-gescheiden"
                           className="w-full text-sm border border-slate-300 rounded px-2 py-1.5" />
                  </div>
                </div>

                {/* Row 3: Onderwerp */}
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5 block">
                    {t("invoice_email.subject", { defaultValue: "Onderwerp" })} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={subject}
                         onChange={(e) => { setSubject(e.target.value); subjectTouched.current = true; }}
                         className="w-full text-sm border border-slate-300 rounded px-2 py-1.5" />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-1 block">
                    {t("invoice_email.body", { defaultValue: "Bericht" })} <span className="text-red-500">*</span>
                  </label>
                  <div
                    ref={bodyEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const html = (e.currentTarget as HTMLDivElement).innerHTML;
                      setBody(html);
                      bodyTouched.current = true;
                    }}
                    className="w-full min-h-[180px] max-h-[320px] overflow-y-auto text-sm border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-y-teal prose prose-sm max-w-none"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">
                    {t("invoice_email.body_hint", {
                      defaultValue: "Eindig op de groet — naam en contactgegevens worden door ERPNext aangevuld uit je User Signature.",
                    })}
                  </div>
                </div>

                {signature && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5">
                      Handtekening
                      <span className="ml-1 text-slate-400 normal-case font-normal">
                        ({signatureSource === "email_account"
                          ? "uit Email Account"
                          : signatureSource === "user"
                            ? "uit User profile"
                            : "niet ingesteld"})
                      </span>
                    </div>
                    <div className="text-sm text-slate-700 pt-2 max-w-[300px] [&_img]:inline-block [&_img]:max-w-full [&_table]:border-collapse"
                         dangerouslySetInnerHTML={{ __html: signaturePreviewHtml }} />
                  </div>
                )}

                {sendError && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-800">
                    <AlertTriangle size={12} className="inline mr-1" />
                    {sendError}
                  </div>
                )}
                {sentOk && (
                  <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-green-800">
                    {t("invoice_email.sent_ok", { defaultValue: "Verstuurd. Communication staat in de invoice-timeline." })}
                  </div>
                )}
            </div>

            {/* ── Section banner: Bijlage (PDF) ──────────────── */}
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-y border-amber-200">
              <Paperclip size={16} className="text-amber-700 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  {t("invoice_email.section_attachment", { defaultValue: "Bijlage (PDF)" })}
                </div>
                <div className="text-[11px] text-slate-500 leading-tight">
                  {t("invoice_email.section_attachment_hint", { defaultValue: "Wordt als bestand meegestuurd met de mail" })}
                </div>
              </div>
            </div>
            {/* ── PDF preview below ───────────────────────────── */}
            <div className="flex flex-col bg-slate-50">
              {/* Toolbar */}
              <div className="flex flex-col gap-1 p-2 border-b border-slate-200 bg-white flex-shrink-0">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-slate-500 flex-shrink-0" />
                  <select value={printFormat}
                          onChange={(e) => setPrintFormat(e.target.value)}
                          className="text-xs border border-slate-300 rounded px-2 py-1 flex-1 min-w-0">
                    <option value="">— {t("invoice_email.no_format_selected", { defaultValue: "Kies een print format" })} —</option>
                    {loadedDefaults.format && !printFormats.some((f) => f.name === loadedDefaults.format) && (
                      <option value={loadedDefaults.format}>{loadedDefaults.format} (uit Settings)</option>
                    )}
                    {printFormats.map((f) => (
                      <option key={f.name} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                  <label className="text-xs text-slate-600 flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={includeLetterhead}
                           onChange={(e) => setIncludeLetterhead(e.target.checked)} />
                    {t("invoice_email.letterhead", { defaultValue: "Briefpapier" })}
                  </label>
                  {/* Zoom controls */}
                  <div className="flex items-center gap-0.5 ml-2 border-l border-slate-200 pl-2">
                    <button type="button"
                            onClick={() => { zoomTouched.current = true; setZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2))); }}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                            title="Uitzoomen">
                      <ZoomOut size={14} />
                    </button>
                    <span className="text-[11px] text-slate-600 font-mono w-10 text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button type="button"
                            onClick={() => { zoomTouched.current = true; setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2))); }}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                            title="Inzoomen">
                      <ZoomIn size={14} />
                    </button>
                    <button type="button"
                            onClick={fitToWidth}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded cursor-pointer ml-1"
                            title="Pas op breedte aan">
                      <Maximize2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 ml-5">
                  {loadedDefaults.format
                    ? `Default uit Settings: ${loadedDefaults.format}`
                    : "Geen default ingesteld in Settings → Project instellingen → Factuur versturen"}
                </div>
              </div>
              {/* Preview canvas */}
              <div ref={previewContainerRef}
                   className="overflow-auto bg-slate-200 relative p-4"
                   style={{ height: "70vh" }}>
                {previewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 bg-white/70 z-10">
                    <RefreshCw size={14} className="animate-spin mr-1" />
                    {t("invoice_email.loading", { defaultValue: "Laden…" })}
                  </div>
                )}
                {previewHtml ? (
                  // Wrapper takes the scaled visual size of the iframe so the
                  // surrounding gray padding stays visible on all four sides
                  // (and the parent's overflow-auto computes scroll bounds
                  // correctly when zoomed in).
                  <div style={{ width: 794 * zoom, height: 1123 * zoom }}>
                    <iframe srcDoc={previewHtml}
                            sandbox="allow-same-origin"
                            title="Invoice preview"
                            style={{
                              width: 794,
                              height: 1123,
                              border: 0,
                              background: "white",
                              display: "block",
                              transform: `scale(${zoom})`,
                              transformOrigin: "top left",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                            }} />
                  </div>
                ) : !previewLoading ? (
                  <div className="p-4 text-xs text-slate-500">
                    {t("invoice_email.preview_unavailable", { defaultValue: "Kies een Print Format om voorbeeld te tonen." })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <button onClick={onClose}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 cursor-pointer">
            {t("common.cancel", { defaultValue: "Annuleren" })}
          </button>
          <div className="flex items-center gap-2">
            <a href={erpnextLink} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded hover:bg-slate-50">
              <ExternalLink size={14} />
              {t("invoice_email.open_in_erpnext", { defaultValue: "Open in ERPNext" })}
            </a>
            <button onClick={handleSend} disabled={!canSend}
                    className="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-y-teal hover:bg-y-teal-dark rounded disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              <Send size={14} className={sending ? "animate-pulse" : ""} />
              {effectiveMode === "draft"
                ? t("invoice_email.submit_and_send", { defaultValue: "Inboeken & Versturen" })
                : t("invoice_email.send", { defaultValue: "Versturen" })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
