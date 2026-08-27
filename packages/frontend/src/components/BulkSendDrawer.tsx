/**
 * BulkSendDrawer — sequentieel meerdere submitted Sales Invoices versturen.
 *
 * Pakt voor elke factuur de Y-app defaults uit `invoice-email-defaults`,
 * laat ERPNext z'n Email Template renderen met de specifieke invoice als
 * Jinja-context, en roept dan `email.make` aan. Elke factuur krijgt z'n
 * eigen mail (geen samengevoegd bericht). Sequentieel om de Email Queue
 * niet te overstelpen en om naming-ordering van Communications stabiel
 * te houden.
 *
 * Een rij klikbaar maken voor edit-per-factuur valt buiten v1 — de
 * SendInvoiceModal in de hoofdpagina dekt dat al, gebruikers kunnen het
 * single-send pad daar voor specifieke tweaks gebruiken.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, RefreshCw, Send, AlertTriangle, Check, ExternalLink } from "lucide-react";
import {
  fetchInvoiceEmailTemplates,
  loadInvoiceEmailDefaults,
  loadOutgoingEmailAccount,
  renderEmailTemplate,
  sendInvoiceEmail,
} from "../lib/invoiceEmail";
import { fetchDocument, getErpNextLinkUrl } from "../lib/erpnext";

interface BulkSendDrawerProps {
  invoiceNames: string[];
  onClose: () => void;
  onCompleted?: () => void;
}

type ItemStatus = "pending" | "sending" | "sent" | "error";

interface ItemState {
  name: string;
  customer_name?: string;
  contact_email?: string;
  status: ItemStatus;
  error?: string;
}

export default function BulkSendDrawer({ invoiceNames, onClose, onCompleted }: BulkSendDrawerProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ItemState[]>(
    invoiceNames.map((name) => ({ name, status: "pending" })),
  );
  const [preflightOk, setPreflightOk] = useState<boolean | null>(null);
  const [defaultsTemplate, setDefaultsTemplate] = useState<string>("");
  const [defaultsPrintFormat, setDefaultsPrintFormat] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  // Cancellation: set when component unmounts mid-batch so the loop stops
  // calling setState on a dead component.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  // ── Preflight + load metadata for the table ────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const account = await loadOutgoingEmailAccount();
      if (cancelled) return;
      setPreflightOk(!!account);

      const defaults = await loadInvoiceEmailDefaults();
      const tmpls = await fetchInvoiceEmailTemplates().catch(() => []);
      if (cancelled) return;
      // Strict: only use what Settings explicitly configured. The picker UI
      // exists so a future change can give per-run override; until then,
      // refusing to send without a configured default beats silently picking
      // an alphabetically-first template for 50 invoices.
      void tmpls; // load is still useful diagnostically
      setDefaultsTemplate(defaults.default_email_template || "");
      setDefaultsPrintFormat(defaults.default_print_format || "");

      const fetched = await Promise.all(
        invoiceNames.map((name) =>
          fetchDocument<{ name: string; customer_name?: string; contact_email?: string }>(
            "Sales Invoice",
            name,
          ).catch(() => null),
        ),
      );
      if (cancelled) return;
      setItems(invoiceNames.map((name, i) => ({
        name,
        customer_name: fetched[i]?.customer_name,
        contact_email: fetched[i]?.contact_email,
        status: "pending",
      })));
    })();
    return () => { cancelled = true; };
  }, [invoiceNames]);

  function updateItem(idx: number, patch: Partial<ItemState>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function runBatch() {
    if (!preflightOk || !defaultsTemplate || !defaultsPrintFormat) return;
    setRunning(true);
    for (let i = 0; i < items.length; i++) {
      if (cancelledRef.current) return; // drawer was closed
      const it = items[i];
      if (it.status === "sent") continue;
      if (!it.contact_email) {
        updateItem(i, { status: "error", error: "no contact_email" });
        continue;
      }
      updateItem(i, { status: "sending", error: undefined });
      try {
        const rendered = await renderEmailTemplate(defaultsTemplate, "Sales Invoice", it.name);
        if (cancelledRef.current) return;
        await sendInvoiceEmail({
          name: it.name,
          subject: rendered.subject || `Factuur ${it.name}`,
          content: rendered.message || `Beste,\n\nBijgaand de factuur ${it.name}.`,
          recipients: it.contact_email,
          printFormat: defaultsPrintFormat,
          includeLetterhead: true,
        });
        if (cancelledRef.current) return;
        updateItem(i, { status: "sent" });
      } catch (e) {
        if (cancelledRef.current) return;
        updateItem(i, {
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (cancelledRef.current) return;
    setRunning(false);
    setFinished(true);
  }

  async function retryItem(idx: number) {
    const it = items[idx];
    if (!it.contact_email || !defaultsTemplate || !defaultsPrintFormat) return;
    updateItem(idx, { status: "sending", error: undefined });
    try {
      const rendered = await renderEmailTemplate(defaultsTemplate, "Sales Invoice", it.name);
      await sendInvoiceEmail({
        name: it.name,
        subject: rendered.subject || `Factuur ${it.name}`,
        content: rendered.message || `Beste,\n\nBijgaand de factuur ${it.name}.`,
        recipients: it.contact_email,
        printFormat: defaultsPrintFormat,
        includeLetterhead: true,
      });
      updateItem(idx, { status: "sent" });
    } catch (e) {
      updateItem(idx, {
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const canStart = preflightOk && !!defaultsTemplate && !!defaultsPrintFormat && !running && !finished;
  const sentCount = items.filter((i) => i.status === "sent").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {t("invoice_email.bulk_title", { defaultValue: "Facturen in bulk versturen" })}
            </h2>
            <div className="text-xs text-slate-500 mt-0.5">
              {t("invoice_email.bulk_subtitle", {
                count: items.length,
                defaultValue: `${items.length} facturen — elk eigen mail`,
              })}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {preflightOk === null && (
          <div className="flex-1 flex items-center justify-center text-slate-500 p-8">
            <RefreshCw size={18} className="animate-spin mr-2" />
            {t("invoice_email.loading", { defaultValue: "Laden…" })}
          </div>
        )}

        {preflightOk === false && (
          <div className="p-6">
            <div className="bg-amber-50 border border-amber-300 rounded p-4 text-sm text-amber-900">
              <div className="font-semibold flex items-center gap-2 mb-1">
                <AlertTriangle size={16} />
                {t("invoice_email.no_email_account_title", { defaultValue: "Geen outgoing Email Account in ERPNext" })}
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

        {preflightOk && (
          <>
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <div>
                <span className="font-medium">{t("invoice_email.template", { defaultValue: "Sjabloon" })}:</span>{" "}
                {defaultsTemplate || <span className="text-red-600">{t("invoice_email.bulk_no_default_template", { defaultValue: "geen default ingesteld" })}</span>}
              </div>
              <div>
                <span className="font-medium">{t("invoice_email.print_format", { defaultValue: "Print Format" })}:</span>{" "}
                {defaultsPrintFormat || <span className="text-red-600">{t("invoice_email.bulk_no_default_format", { defaultValue: "geen default ingesteld" })}</span>}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {t("invoice_email.bulk_defaults_hint", {
                  defaultValue: "Defaults uit Settings → Project instellingen → Factuur versturen. Pas ze daar aan om bulk-onderwerp/-format te wijzigen.",
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("sales_invoices.invoice_nr")}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("sales_invoices.customer")}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("invoice_email.to", { defaultValue: "Aan" })}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("invoice_email.bulk_status", { defaultValue: "Status" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.name} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-700">{it.name}</td>
                      <td className="px-3 py-2 text-slate-600">{it.customer_name || "-"}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{it.contact_email || "-"}</td>
                      <td className="px-3 py-2">
                        {it.status === "pending" && <span className="text-xs text-slate-400">{t("invoice_email.status_pending", { defaultValue: "wacht" })}</span>}
                        {it.status === "sending" && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-700">
                            <RefreshCw size={12} className="animate-spin" /> {t("invoice_email.status_sending", { defaultValue: "versturen…" })}
                          </span>
                        )}
                        {it.status === "sent" && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700">
                            <Check size={12} /> {t("invoice_email.status_sent", { defaultValue: "verstuurd" })}
                          </span>
                        )}
                        {it.status === "error" && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-700" title={it.error}>
                              <AlertTriangle size={12} className="inline mr-1" />
                              {t("invoice_email.status_error", { defaultValue: "fout" })}
                            </span>
                            <button onClick={() => retryItem(idx)}
                              disabled={running}
                              className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 cursor-pointer">
                              {t("common.retry", { defaultValue: "Opnieuw" })}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
              <div className="text-xs text-slate-500">
                {sentCount > 0 && <span className="text-green-700 mr-3">✓ {sentCount}</span>}
                {errorCount > 0 && <span className="text-red-700">✗ {errorCount}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={finished && sentCount > 0 ? onCompleted : onClose}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 cursor-pointer">
                  {finished ? t("common.close", { defaultValue: "Sluiten" }) : t("common.cancel", { defaultValue: "Annuleren" })}
                </button>
                <button onClick={runBatch} disabled={!canStart}
                  className="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-y-teal hover:bg-y-teal-dark rounded disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                  <Send size={14} className={running ? "animate-pulse" : ""} />
                  {running
                    ? t("invoice_email.bulk_running", { defaultValue: "Bezig…" })
                    : t("invoice_email.bulk_start", { defaultValue: "Start batch" })}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
