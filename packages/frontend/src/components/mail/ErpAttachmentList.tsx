import { useTranslation } from "react-i18next";
import { Download, FileText, Paperclip } from "lucide-react";
import { getFileUrl } from "../../lib/erpnext";
import { isPdfName } from "../../lib/mail-erpnext-compose";
import { isPermissionError } from "../../lib/permission-error";
import {
  checkAttachmentAccess,
  openAttachmentInTab,
  type MailAttachmentRef,
} from "../../lib/mail-attachment";

/**
 * Bijlagenpaneel van de Communication-mail (Y-next).
 *
 * Bewust niet `components/MessageAttachments.tsx`: die component werkt op de
 * IMAP-vorm (`uid` + `index` + inline-CID-filter) en hangt met zijn NAS- en
 * NextCloud-knoppen aan Express-endpoints die in Y-next niet bestaan. Hier is
 * elke bijlage een echte ERPNext-`File` met een gewone, same-origin URL.
 *
 * Twee routes, met opzet verschillend:
 *
 * - **PDF** gaat via `openAttachmentInTab`: een eigen tabblad dat synchroon
 *   binnen de klik geopend moet worden en pas daarna navigeert. Zie de kop van
 *   `lib/mail-attachment.ts` voor waarom dat zo precies luistert (en waarom
 *   `noopener` daar níét mag staan).
 * - **Al het andere** (afbeeldingen, Office-bestanden) en de downloadknop
 *   blijven gewone `<a>`-links: de browser doet dat native, met de echte
 *   bestandsnaam en zonder dat er iets te blokkeren valt. De klik start
 *   daarnaast een controle die een 403 alsnog in de app meldt.
 *
 * Gedeeld tussen het leespaneel in `Webmail.tsx` en de popout in
 * `MailView.tsx`, zodat die twee niet opnieuw uit elkaar groeien (dat gebeurde
 * eerder al bij de IMAP-variant, waar de popout de NextCloud-knoppen miste).
 */
export type ErpAttachment = MailAttachmentRef;

export default function ErpAttachmentList({ attachments, onError, className }: {
  attachments: ErpAttachment[];
  /** Meldkanaal richting de gebruiker (toast of foutregel). */
  onError: (message: string) => void;
  /** Container-styling; het leespaneel en de popout hebben andere marges. */
  className?: string;
}) {
  const { t } = useTranslation();
  if (attachments.length === 0) return null;

  /**
   * Vertaal een fout naar iets wat een gebruiker verder helpt. Een 403 is geen
   * ruis maar een oplosbaar rechtenprobleem (zie `lib/permission-error.ts`) en
   * verdient daarom een eigen tekst; al het andere komt met de reden erbij,
   * zodat er nooit een fout stilletjes verdwijnt.
   */
  function report(err: unknown, fallbackKey: string) {
    if (isPermissionError(err)) {
      onError(t("y_next.attachment_no_permission"));
      return;
    }
    const detail = err instanceof Error ? err.message : String(err);
    onError(t(fallbackKey, { error: detail }));
  }

  async function handleOpenPdf(att: ErpAttachment) {
    try {
      const outcome = await openAttachmentInTab(att);
      if (outcome === "downloaded") onError(t("y_next.attachment_popup_blocked"));
    } catch (err) {
      report(err, "y_next.attachment_open_failed");
    }
  }

  /**
   * Loopt mee met de standaardactie van een `<a>` — de link opent of downloadt
   * gewoon door. Alleen als de bijlage onbereikbaar blijkt, verschijnt er een
   * melding; zonder deze controle zou een 403 hoogstens als Frappe-foutpagina
   * in een nieuw tabblad of als mislukte download in de downloadbalk landen.
   */
  function verifyInBackground(att: ErpAttachment, fallbackKey: string) {
    void checkAttachmentAccess(att).catch((err) => report(err, fallbackKey));
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
                <button onClick={() => void handleOpenPdf(att)}
                  title={t("y_next.mail_open_attachment")}
                  className="inline-flex items-center gap-1.5 hover:text-blue-700 cursor-pointer">
                  <FileText size={12} className="text-red-400" />
                  <span className="truncate max-w-[180px]">{att.file_name}</span>
                </button>
              ) : (
                <a href={url} target="_blank" rel="noopener noreferrer"
                  onClick={() => verifyInBackground(att, "y_next.attachment_open_failed")}
                  title={t("y_next.mail_open_attachment")}
                  className="inline-flex items-center gap-1.5 hover:text-blue-700">
                  <FileText size={12} className="text-slate-400" />
                  <span className="truncate max-w-[180px]">{att.file_name}</span>
                </a>
              )}
              <a href={url} download={att.file_name} title={t("webmail.download")}
                onClick={() => verifyInBackground(att, "y_next.attachment_download_failed")}
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
