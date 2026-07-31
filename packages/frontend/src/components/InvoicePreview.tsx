import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { fetchAll } from "../lib/erpnext";
import { fetchPrintPreviewHtml } from "../lib/invoiceEmail";

/** Print Formats we use most often op de 3BM-instance. De toggle laadt
 *  alle Print Formats voor het doctype en zet deze drie vooraan; de
 *  hardcoded lijst is alleen de fallback wanneer de discovery-call faalt. */
const PRINT_FORMATS = [
  "3BM Factuur+Smart Urenstaat",
  "3BM Factuur Nieuw",
  "3BM Factuur+Urenstaat Nieuw",
] as const;

interface Props {
  doctype: string;
  /** Name van de opgeslagen ERPNext-doc. Leeg/undefined toont een
   *  placeholder zonder server-call. */
  name: string;
  /** Optioneel: hoogte van het preview-iframe. Default 75vh. */
  iframeHeight?: string;
  /** Optionele callback wanneer het geselecteerde Print Format wijzigt
   *  (handig als de parent badges of conditionals heeft die afhangen
   *  van welk format actief is, bv. "wordt deze uren-rij geprint?"). */
  onFormatChange?: (format: string) => void;
  /** Token dat een refetch forceert wanneer het wijzigt. Gebruik
   *  `doc.modified` na een save — anders ziet de gebruiker een stale
   *  preview na server-side wijzigingen op dezelfde naam. */
  refreshToken?: string;
}

/**
 * Herbruikbaar PDF-preview-paneel voor Sales Invoices (en andere doctypes
 * met dezelfde Frappe print-format endpoints). Plug-and-play mits de
 * gebruiker is ingelogd op ERPNext via Y-app session.
 *
 * Asset-URL-rewriting (logo's, letterhead) wordt gedaan door
 * `fetchPrintPreviewHtml` in [lib/invoiceEmail.ts](src/lib/invoiceEmail.ts) —
 * exact dezelfde flow als SendInvoiceModal gebruikt voor de email-preview.
 * Niet zelf rewriten of base-href injecteren: dat moet centraal blijven.
 */
export default function InvoicePreview({ doctype, name, iframeHeight = "75vh", onFormatChange, refreshToken }: Props) {
  const [printFormat, setPrintFormatState] = useState<string>(PRINT_FORMATS[0]);
  const setPrintFormat = (f: string) => {
    setPrintFormatState(f);
    onFormatChange?.(f);
  };
  const [availableFormats, setAvailableFormats] = useState<string[]>(PRINT_FORMATS as unknown as string[]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Print Format discovery per doctype.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchAll<{ name: string }>(
          "Print Format",
          ["name"],
          [["doc_type", "=", doctype]],
        );
        if (cancelled) return;
        const names = list.map((p) => p.name);
        const ordered = [
          ...(PRINT_FORMATS as readonly string[]).filter((n) => names.includes(n)),
          ...names.filter((n) => !(PRINT_FORMATS as readonly string[]).includes(n)),
        ];
        if (ordered.length > 0) {
          setAvailableFormats(ordered);
          if (!names.includes(printFormat) && ordered[0]) setPrintFormat(ordered[0]);
        }
      } catch { /* fallback naar hardcoded lijst */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctype]);

  // HTML preview ophalen via de gedeelde helper. Logo's/letterhead lopen
  // hierdoor via /api/erpnext-asset proxy (zelfde mechanisme als email).
  useEffect(() => {
    if (!name) {
      setPreviewHtml(null);
      setPdfError(null);
      setPdfLoading(false);
      return;
    }
    let cancelled = false;
    setPdfError(null);
    setPdfLoading(true);
    setPreviewHtml(null);
    (async () => {
      try {
        // refreshToken doubles als cache-buster — voorkomt dat de browser
        // een identieke URL uit z'n disk-cache trekt na een save.
        const html = await fetchPrintPreviewHtml(doctype, name, printFormat, true, refreshToken);
        if (cancelled) return;
        if (html) {
          setPreviewHtml(html);
        } else {
          setPdfError("Geen preview beschikbaar");
        }
      } catch (e) {
        if (!cancelled) setPdfError(e instanceof Error ? e.message : "Onbekende fout");
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [name, doctype, printFormat, refreshToken]);

  // PDF blob — alleen voor de "Open PDF" download-link. Eigen fetch (apart
  // van HTML preview) omdat wkhtmltopdf soms blank renders op draft-facturen;
  // we proberen meerdere endpoints en pakken de eerste niet-lege %PDF binary.
  useEffect(() => {
    if (!name) {
      setPdfBlobUrl(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    (async () => {
      const enc = encodeURIComponent;
      const bust = refreshToken ? `&_t=${enc(refreshToken)}` : "";
      const pdfEndpoints = [
        `/api/method/frappe.utils.print_format.download_pdf?doctype=${enc(doctype)}&name=${enc(name)}&format=${enc(printFormat)}&no_letterhead=0&_lang=nl${bust}`,
        `/api/method/frappe.utils.print_format.download_pdf?doctype=${enc(doctype)}&name=${enc(name)}&print_format=${enc(printFormat)}&no_letterhead=0&_lang=nl${bust}`,
        `/api/method/frappe.utils.weasyprint.download_pdf?doctype=${enc(doctype)}&name=${enc(name)}&print_format=${enc(printFormat)}&no_letterhead=0&_lang=nl${bust}`,
      ];
      for (const u of pdfEndpoints) {
        if (cancelled) return;
        try {
          const r = await fetch(u, { credentials: "same-origin", cache: "no-store" });
          const buf = await r.arrayBuffer();
          if (cancelled) return;
          const h = new Uint8Array(buf.slice(0, 4));
          const isPdf = h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46;
          if (r.ok && isPdf && buf.byteLength > 2000) {
            const blob = new Blob([buf], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            createdUrl = url;
            setPdfBlobUrl(url);
            return;
          }
        } catch { /* try next */ }
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [name, doctype, printFormat, refreshToken]);

  if (!name) {
    return (
      <div className="pt-4 border-t border-slate-200">
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center bg-slate-50/60">
          <p className="text-sm text-slate-500">
            PDF-voorbeeld verschijnt hier zodra het concept is opgeslagen.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Klik op <span className="font-medium">Maak factuur</span> om door te gaan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-slate-200">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-xs text-slate-500 font-medium">Print format:</span>
        <select
          value={printFormat}
          onChange={(e) => setPrintFormat(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-y-teal cursor-pointer"
        >
          {availableFormats.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        {previewHtml ? (
          <button
            onClick={() => {
              const blob = new Blob([previewHtml], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const w = window.open(url, "_blank", "noopener");
              if (w) {
                w.addEventListener("load", () => {
                  try { w.print(); } catch { /* user can still ctrl+P */ }
                });
              }
              setTimeout(() => URL.revokeObjectURL(url), 60_000);
            }}
            className="ml-auto inline-flex items-center gap-1 text-xs text-y-teal hover:text-y-teal-dark cursor-pointer"
            title="Open preview in nieuwe tab en print naar PDF"
          >
            <ExternalLink size={12} /> Open / Print PDF
          </button>
        ) : pdfBlobUrl ? (
          <a
            href={pdfBlobUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={`${name}.pdf`}
            className="ml-auto inline-flex items-center gap-1 text-xs text-y-teal hover:text-y-teal-dark"
            title="Open PDF in nieuw tabblad"
          >
            <ExternalLink size={12} /> Open PDF
          </a>
        ) : null}
      </div>
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        {pdfError && !previewHtml && !pdfBlobUrl ? (
          <div className="p-8 text-center text-sm text-red-600">
            Preview kon niet geladen worden: {pdfError}
          </div>
        ) : pdfLoading && !previewHtml && !pdfBlobUrl ? (
          <div className="p-8 text-center text-sm text-slate-400" style={{ height: iframeHeight }}>
            Preview laden…
          </div>
        ) : previewHtml ? (
          <iframe
            srcDoc={previewHtml}
            title={`${name} – ${printFormat}`}
            className="w-full block"
            style={{ height: iframeHeight, border: 0, background: "white" }}
            sandbox="allow-same-origin allow-popups"
          />
        ) : pdfBlobUrl ? (
          <iframe
            src={pdfBlobUrl}
            title={`${name} – ${printFormat}`}
            className="w-full block"
            style={{ height: iframeHeight, border: 0, background: "white" }}
          />
        ) : null}
      </div>
    </div>
  );
}
