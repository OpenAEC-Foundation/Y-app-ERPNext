/**
 * Gedeelde attachment-balk voor Webmail's ReadingPane en de standalone
 * MailView popout. Beide bestanden gebruikten eerder eigen JSX-blokken
 * met subtiele verschillen (NextCloud-knop ontbrak in MailView etc.).
 * Eén component = één gedrag.
 *
 * Render-conditie: NIETS tonen als visibleAtts.length === 0. Inline-CIDs
 * uit handtekeningen blijven via cid:-references in de HTML body zichtbaar
 * en hoeven geen aparte UI.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Paperclip, Download, CloudUpload, HardDrive, HardDriveDownload, Loader2,
  FileText, FileImage, FileSpreadsheet, File,
} from "lucide-react";
import { isInlineAttachment, type AttachmentMeta } from "../lib/attachment-utils";

interface Props {
  attachments: AttachmentMeta[];
  htmlBody?: string;
  onOpen?: (index: number) => void;
  onDownload?: (index: number) => void;
  onDownloadAll?: () => void;
  onSaveToNextCloud?: (index: number) => void;
  onSaveAllToNextCloud?: () => void;
  onSaveToNas?: () => void;
  /** "all" tijdens een save-all-naar-NextCloud, filename tijdens een single-save, of null/idle. */
  ncSaving?: string | null;
}

export function MessageAttachments({
  attachments,
  htmlBody,
  onOpen,
  onDownload,
  onDownloadAll,
  onSaveToNextCloud,
  onSaveAllToNextCloud,
  onSaveToNas,
  ncSaving,
}: Props) {
  const { t } = useTranslation();
  const [showHiddenAttachments, setShowHiddenAttachments] = useState(false);

  if (!attachments || attachments.length === 0) return null;

  const hiddenIndices = new Set<number>();
  attachments.forEach((att, idx) => {
    if (isInlineAttachment(att, htmlBody)) hiddenIndices.add(idx);
  });
  const visibleAtts = attachments
    .map((att, idx) => ({ att, idx }))
    .filter(({ idx }) => !hiddenIndices.has(idx));
  const hiddenCount = hiddenIndices.size;
  const displayAtts = showHiddenAttachments
    ? attachments.map((att, idx) => ({ att, idx }))
    : visibleAtts;

  // Verberg balk als er geen ECHTE bijlages zijn (alleen sig-CIDs).
  if (visibleAtts.length === 0) return null;

  return (
    <div className="px-4 md:px-6 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Paperclip size={12} className="text-slate-400" />
        <span className="text-[11px] font-semibold text-slate-600">
          {visibleAtts.length === 1
            ? t("webmail.one_attachment")
            : t("webmail.n_attachments", { count: visibleAtts.length })}
        </span>
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowHiddenAttachments((prev) => !prev)}
            className="text-[10px] text-slate-400 hover:text-blue-600 cursor-pointer ml-1 underline decoration-dotted"
          >
            {showHiddenAttachments
              ? t("webmail.hide_inline_images")
              : hiddenCount === 1
                ? t("webmail.one_hidden_attachment")
                : t("webmail.n_hidden_attachments", { count: hiddenCount })}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {visibleAtts.length > 1 && onDownloadAll && (
            <button
              onClick={() => onDownloadAll()}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
              title={t("webmail.save_all_local")}
            >
              <HardDriveDownload size={11} /> {t("webmail.save_all")}
            </button>
          )}
          {onSaveToNas && (
            <button
              onClick={onSaveToNas}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors cursor-pointer"
              title={t("webmail.save_to_nas.button_tooltip", { defaultValue: "Bijlages opslaan op NAS" })}
            >
              <HardDrive size={11} /> {t("webmail.save_to_nas.button", { defaultValue: "NAS" })}
            </button>
          )}
          {visibleAtts.length > 1 && onSaveAllToNextCloud && (
            <button
              onClick={() => onSaveAllToNextCloud()}
              disabled={ncSaving === "all"}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer disabled:opacity-50"
              title={t("webmail.save_all_nextcloud")}
            >
              {ncSaving === "all" ? <Loader2 size={11} className="animate-spin" /> : <CloudUpload size={11} />}
              NextCloud
            </button>
          )}
        </div>
      </div>
      {displayAtts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-[96px] overflow-y-auto">
          {displayAtts.map(({ att, idx }) => {
            const isImage = att.contentType.startsWith("image/");
            const isPdf = att.contentType === "application/pdf";
            const isSpreadsheet =
              att.contentType.includes("spreadsheet") ||
              att.contentType.includes("excel") ||
              !!att.filename.match(/\.(xlsx?|csv)$/i);
            const AttIcon = isImage ? FileImage : isPdf ? FileText : isSpreadsheet ? FileSpreadsheet : File;
            const sizeStr =
              att.size < 1024
                ? `${att.size} B`
                : att.size < 1024 * 1024
                  ? `${(att.size / 1024).toFixed(1)} KB`
                  : `${(att.size / (1024 * 1024)).toFixed(1)} MB`;
            const isHidden = hiddenIndices.has(idx);
            const isSavingThis = ncSaving === att.filename;

            return (
              <div
                key={`${att.filename}-${idx}`}
                className={`group flex items-center gap-1 px-2 py-1 bg-white border rounded text-[11px] ${
                  isHidden ? "border-dashed border-slate-300 opacity-60" : "border-slate-200"
                }`}
              >
                <button
                  onClick={() => onOpen?.(idx)}
                  className="flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer"
                  title={t("webmail.tt_click_to_open")}
                >
                  <AttIcon
                    size={13}
                    className={`flex-shrink-0 ${
                      isImage ? "text-green-500" : isPdf ? "text-red-500" : isSpreadsheet ? "text-emerald-600" : "text-slate-400"
                    }`}
                  />
                  <span className="font-medium text-slate-700 truncate max-w-[120px]">{att.filename}</span>
                  <span className="text-slate-400">({sizeStr})</span>
                </button>
                <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onDownload && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(idx);
                      }}
                      className="p-0.5 text-slate-400 hover:text-blue-600 cursor-pointer rounded hover:bg-blue-50 transition-colors"
                      title={t("webmail.tt_save_local")}
                    >
                      <Download size={12} />
                    </button>
                  )}
                  {onSaveToNextCloud && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSaveToNextCloud(idx);
                      }}
                      disabled={!!ncSaving}
                      className="p-0.5 text-slate-400 hover:text-emerald-600 cursor-pointer rounded hover:bg-emerald-50 transition-colors disabled:opacity-50"
                      title={t("webmail.save_to_nextcloud")}
                    >
                      {isSavingThis ? <Loader2 size={12} className="animate-spin" /> : <CloudUpload size={12} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
