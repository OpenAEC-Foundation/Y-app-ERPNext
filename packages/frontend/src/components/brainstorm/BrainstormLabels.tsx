import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tags, X } from "lucide-react";
import { createLabel, deleteLabel } from "../../lib/brainstorm";
import { LABEL_GROUPS, type Label, type LabelGroep } from "../../lib/brainstorm-model";
import { useToast } from "../Toast";
import { LabelChip } from "./shared";

/** Iedereen beheert de labels; ze gelden voor de hele organisatie. */
export default function BrainstormLabels({ labels, onClose, onChanged }: {
  labels: Label[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [nieuw, setNieuw] = useState("");
  const [groep, setGroep] = useState<LabelGroep>("Overig");
  const [busy, setBusy] = useState(false);

  async function add() {
    const label = nieuw.trim();
    if (!label) return;
    if (labels.some((l) => (l.label || "").toLowerCase() === label.toLowerCase())) {
      toast.error(t("brainstorm.label_exists", { label }));
      return;
    }
    setBusy(true);
    try {
      await createLabel(label, groep);
      setNieuw("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("brainstorm.save_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(l: Label) {
    try {
      await deleteLabel(l.name);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("brainstorm.save_failed"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Tags size={18} className="text-y-teal" /> {t("brainstorm.labels_manage")}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer" aria-label={t("common.close")}><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-slate-500">{t("brainstorm.labels_manage_hint")}</p>
          <div className="flex gap-2 flex-wrap">
            <input value={nieuw} onChange={(e) => setNieuw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              placeholder={t("brainstorm.label_new")}
              className="flex-1 min-w-[12rem] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
            <select value={groep} onChange={(e) => setGroep(e.target.value as LabelGroep)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" aria-label={t("brainstorm.label_group")}>
              {LABEL_GROUPS.map((g) => <option key={g} value={g}>{t(`brainstorm.group.${g}`)}</option>)}
            </select>
            <button type="button" onClick={add} disabled={busy || !nieuw.trim()}
              className="px-4 py-2 bg-y-teal text-white rounded-lg text-sm font-medium hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
              {t("brainstorm.label_add")}
            </button>
          </div>
          {LABEL_GROUPS.map((g) => {
            const inGroep = labels.filter((l) => l.groep === g);
            if (!inGroep.length) return null;
            return (
              <div key={g} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`brainstorm.group.${g}`)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {inGroep.map((l) => <LabelChip key={l.name} label={l.label} groep={g} onRemove={() => remove(l)} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
