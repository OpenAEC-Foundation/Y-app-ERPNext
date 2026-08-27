import { useState } from "react";
import { Mail, ChevronDown, Plus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SharedMailbox } from "../../lib/webmail-prefetch";

/* ─── Mobile mailbox dropdown ───
   Compact replacement for the horizontal tab bar on small screens.
   Shows the active mailbox name with a chevron; tap opens a dropdown
   with all accounts (primary + shared) + an "Add" entry. */
export default function MobileMailboxDropdown({
  activeAcct, primaryLabel, sharedMailboxes, onSelect, onAdd,
}: {
  activeAcct: string | null;
  primaryLabel: string;
  sharedMailboxes: SharedMailbox[];
  onSelect: (acct: string | null) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const activeLabel = activeAcct === null
    ? primaryLabel
    : (sharedMailboxes.find(sm => sm.email === activeAcct)?.label || activeAcct);
  return (
    <div className="relative px-3 py-1.5 bg-white border-b border-slate-200 flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {activeAcct === null
            ? <Mail size={12} className="text-blue-600 flex-shrink-0" />
            : <Users size={12} className="text-blue-600 flex-shrink-0" />}
          <span className="truncate">{activeLabel}</span>
        </span>
        <ChevronDown size={14} className={`text-slate-500 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 top-full mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-72 overflow-auto">
            <button
              onClick={() => { onSelect(null); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left cursor-pointer ${activeAcct === null ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-slate-50"}`}
            >
              <Mail size={12} />
              <span className="truncate">{primaryLabel}</span>
            </button>
            {sharedMailboxes.map(sm => (
              <button
                key={sm.email}
                onClick={() => { onSelect(sm.email); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left cursor-pointer ${activeAcct === sm.email ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-slate-50"}`}
              >
                <Users size={12} />
                <span className="truncate">{sm.label || sm.email}</span>
              </button>
            ))}
            <div className="border-t border-slate-100 my-1" />
            <button
              onClick={() => { onAdd(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-blue-600 hover:bg-slate-50 cursor-pointer"
            >
              <Plus size={12} />
              {t("webmail.add_shared_mailbox", { defaultValue: "Gedeelde mailbox toevoegen" })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
