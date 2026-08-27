import { useTranslation } from "react-i18next";
import { Download, FileText, Paperclip } from "lucide-react";
import { getFileUrl } from "../../lib/erpnext";
import { isPdfName } from "../../lib/mail-erpnext-compose";

/**
 * Bijlagenpaneel van de Communication-mail (Y-next).
 *
 * Bewust niet `components/MessageAttachments.tsx`: die component werkt op de
 * IMAP-vorm (`uid` + `index` + inline-CID-filter) en hangt met zijn NAS- en
 * NextCloud-knoppen aan Express-endpoints die in Y-next niet bestaan. Hier is
 * elke bijlage een echte ERPNext-`File` met een gewone, same-origin URL —
 * openen is dus een link en downloaden een `download`-attribuut, meer niet.
 *
 * Gedeeld tussen het leespaneel in `Webmail.tsx` en de popout in
 * `MailView.tsx`, zodat die twee niet opnieuw uit elkaar groeien (dat gebeurde
 * eerder al bij de IMAP-variant, waar de popout de NextCloud-knoppen miste).
 */
export interface ErpAttachment {
  file_url: string;
  file_name: string;
}

export default function ErpAttachmentList({ attachments, onError, className }: {
  attachments: ErpAttachment[];
  /** Melding wanneer de popup-blocker het PDF-tabblad tegenhoudt. */
  onError: (message: string) => void;
  /** Container-styling; het leespaneel en de popout hebben andere marges. */
  className?: string;
}) {
  const { t } = useTranslation();
  if (attachments.length === 0) return null;

  /**
   * PDF's openen in een eigen tabblad met de viewer van de browser.
   *
   * Het tabblad wordt synchroon binnen de klik geopend — ook al is de URL hier
   * direct bekend. Zou er ooit een async stap tussen komen (een blob ophalen,
   * een token verversen), dan blokkeert de popup-blocker een `window.open` die
   * ná de await valt; dit patroon houdt dat probleem structureel weg.
   */
  function openPdf(url: string) {
    const tab = window.open("", "_blank", "noopener");
    if (!tab) { onError(t("webmail.pdf_open_failed")); return; }
    tab.location.href = url;
  }

  return (
    <div className={className ?? "border-t border-slate-200 px-5 py-2.5 flex-shrink-0"}>
      <p className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1">
        <Paperclip size={11} />
        {attachments.length === 1
          ? t("webmail.one_attachment")
          : t("webmail.n_attachments", { count: attachments.length })}
      </p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => {
          const url = getFileUrl(att.file_url);
          return (
            <span key={att.file_url}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg border border-slate-200 text-xs text-slate-600">
              {isPdfName(att.file_name) ? (
                <button onClick={() => openPdf(url)}
                  title={t("y_next.mail_open_attachment")}
                  className="inline-flex items-center gap-1.5 hover:text-blue-700 cursor-pointer">
                  <FileText size={12} className="text-red-400" />
                  <span className="truncate max-w-[180px]">{att.file_name}</span>
                </button>
              ) : (
                <a href={url} target="_blank" rel="noopener noreferrer"
                  title={t("y_next.mail_open_attachment")}
                  className="inline-flex items-center gap-1.5 hover:text-blue-700">
                  <FileText size={12} className="text-slate-400" />
                  <span className="truncate max-w-[180px]">{att.file_name}</span>
                </a>
              )}
              <a href={url} download={att.file_name} title={t("webmail.download")}
                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100">
                <Download size={11} />
              </a>
            </span>
          );
        })}
      </div>
    </div>
  );
}
