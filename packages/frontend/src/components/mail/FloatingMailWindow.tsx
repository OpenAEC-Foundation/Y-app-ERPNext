import { useState, useRef } from "react";
import { ChevronRight, ChevronDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "../../lib/useIsMobile";
import type { MailMessageFull } from "../../lib/mail-types";
import ReadingPane from "./ReadingPane";

/* ─── Floating mail window (geopend via dubbelklik) ─── */

export default function FloatingMailWindow({ msg, folder, offsetIndex, onClose, onReply, onReplyAll, onForward }: {
  msg: MailMessageFull;
  folder: string;
  offsetIndex: number;
  onClose: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [minimized, setMinimized] = useState(false);
  // Positie als offset vanaf default (cascade op basis van index), drag past dit aan
  const [pos, setPos] = useState({ x: offsetIndex * 28, y: offsetIndex * 28 });
  const [size, setSize] = useState({ w: 780, h: 640 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  function startDrag(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      // If the primary button was released outside our mouseup (e.g. an HTML5
      // drag on another element consumed the mouseup), abort the drag.
      if ((ev.buttons & 1) === 0) { cleanup(); return; }
      setPos({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };
    const cleanup = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", cleanup);
      window.removeEventListener("dragstart", cleanup, true);
      window.removeEventListener("blur", cleanup);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", cleanup);
    // Any HTML5 drag starting anywhere aborts our window-drag.
    window.addEventListener("dragstart", cleanup, true);
    window.addEventListener("blur", cleanup);
  }

  function startResize(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      if ((ev.buttons & 1) === 0) { cleanup(); return; }
      setSize({
        w: Math.max(420, resizeRef.current.origW + (ev.clientX - resizeRef.current.startX)),
        h: Math.max(320, resizeRef.current.origH + (ev.clientY - resizeRef.current.startY)),
      });
    };
    const cleanup = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", cleanup);
      window.removeEventListener("dragstart", cleanup, true);
      window.removeEventListener("blur", cleanup);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", cleanup);
    window.addEventListener("dragstart", cleanup, true);
    window.addEventListener("blur", cleanup);
  }

  const title = msg.subject || t("webmail.no_subject");

  if (minimized) {
    return (
      <div className="fixed bottom-0 right-6 w-80 bg-slate-700 text-white rounded-t-lg shadow-2xl z-[55] cursor-pointer"
        style={{ right: 24 + offsetIndex * 328 }}
        onClick={() => setMinimized(false)}>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm font-medium truncate">{title}</span>
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setMinimized(false); }} className="text-white/80 hover:text-white cursor-pointer p-0.5"><ChevronRight size={14} className="rotate-[-90deg]" /></button>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-white/80 hover:text-white cursor-pointer p-0.5"><X size={14} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={isMobile
        ? "fixed inset-0 bg-white flex flex-col z-[55] pt-[env(safe-area-inset-top,0px)]"
        : "fixed bg-white rounded-xl shadow-2xl border border-slate-300 flex flex-col z-[55] overflow-hidden"}
      style={isMobile ? undefined : {
        top: `calc(50% - ${size.h / 2}px + ${pos.y}px)`,
        left: `calc(50% - ${size.w / 2}px + ${pos.x}px)`,
        width: size.w,
        height: size.h,
        maxHeight: "92vh",
        maxWidth: "96vw",
      }}>
      {/* Header — draggable */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-700 flex-shrink-0 cursor-move select-none"
        onMouseDown={isMobile ? undefined : startDrag}>
        <span className="text-white font-semibold text-sm truncate pr-2">{title}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isMobile && <button onClick={() => setMinimized(true)} className="text-white/80 hover:text-white cursor-pointer p-1" title={t("webmail.minimize") as string || "Minimaliseren"}><ChevronDown size={14} /></button>}
          <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer p-1" title={t("webmail.close") as string || "Sluiten"}><X size={isMobile ? 18 : 14} /></button>
        </div>
      </div>

      {/* Content — hergebruikt ReadingPane. Attachments werken via de huidige
          activeFolder-context op de hoofdpagina; als de floating mail uit een
          andere folder komt moet je 'm in het hoofdpaneel openen voor bijlages. */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ReadingPane
          message={msg}
          onReply={onReply}
          onReplyAll={onReplyAll}
          onForward={onForward}
          onDelete={() => { /* niet ondersteund in floating-view */ }}
        />
      </div>

      {/* Resize handle (rechts-onder) */}
      {!isMobile && (
        <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10" onMouseDown={startResize} />
      )}

      {/* Folder-context hint onderin */}
      {!isMobile && folder && folder !== "INBOX" && (
        <div className="px-3 py-1 text-[10px] text-slate-400 border-t border-slate-100 bg-slate-50 flex-shrink-0 truncate">
          {folder}
        </div>
      )}
    </div>
  );
}
