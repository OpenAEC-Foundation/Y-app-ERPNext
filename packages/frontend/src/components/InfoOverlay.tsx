import type { ReactNode } from "react";
import { X, Info } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Body content — accepts JSX so callers can structure with headers,
   *  tables, etc. Wrap long-form docs in <div className="prose ..."> */
  children: ReactNode;
  /** Optional footer note — typically "Wordt nog aangevuld" or a link. */
  footer?: ReactNode;
}

/**
 * Lightweight info-overlay modal. Used for in-app help screens — e.g.
 * "hoe werkt facturatie", "hoe werken contracturen". Renders an
 * `Info` icon by default; callers usually trigger via their own button.
 */
export default function InfoOverlay({ open, title, onClose, children, footer }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Info size={20} className="text-y-teal" />
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <div className="p-5 overflow-auto flex-1 text-sm text-slate-700 space-y-3 leading-relaxed">
          {children}
        </div>
        {footer && (
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl text-xs text-slate-500">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
