import { useTranslation } from "react-i18next";
import { CalendarClock } from "lucide-react";
import { NEXT_STATUS, deadlineStand, type IdeeStatus, type LabelGroep } from "../../lib/brainstorm-model";
import { GROUP_CLASSES, formatDatum, todayLocal } from "./brainstorm-ui";

const STATUS_CLASSES: Record<IdeeStatus, string> = {
  Open: "border-slate-300 text-slate-600 bg-white",
  Bezig: "border-blue-300 text-blue-700 bg-blue-50",
  Klaar: "border-green-300 text-green-700 bg-green-50",
};
const STATUS_DOT: Record<IdeeStatus, string> = { Open: "bg-slate-400", Bezig: "bg-blue-500", Klaar: "bg-green-500" };

export function LabelChip({ label, groep, onRemove }: { label: string; groep: LabelGroep; onRemove?: () => void }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${GROUP_CLASSES[groep]}`}>
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="opacity-60 hover:opacity-100 cursor-pointer" aria-label={t("brainstorm.label_remove", { label })}>
          ×
        </button>
      )}
    </span>
  );
}

/** De status is één knop: klikken zet hem een stap verder. */
export function StatusKnop({ status, onClick, groot }: { status: IdeeStatus; onClick: () => void; groot?: boolean }) {
  const { t } = useTranslation();
  const next = NEXT_STATUS[status];
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={t("brainstorm.status_click", { next: t(`brainstorm.status.${next}`) })}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold cursor-pointer hover:shadow-sm ${STATUS_CLASSES[status]} ${groot ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"}`}
    >
      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
      {t(`brainstorm.status.${status}`)}
    </button>
  );
}

export function DeadlineBadge({ deadline, status }: { deadline: string | null; status: IdeeStatus }) {
  const { t, i18n } = useTranslation();
  const stand = deadlineStand(deadline, status, todayLocal());
  if (!deadline) return null;
  const cls = stand === "verlopen" ? "bg-red-50 text-red-700 border-red-200"
    : stand === "binnenkort" ? "bg-orange-50 text-orange-700 border-orange-200"
    : "bg-slate-50 text-slate-500 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold rounded border whitespace-nowrap ${cls}`}>
      <CalendarClock size={11} />
      {stand === "verlopen" ? t("brainstorm.deadline_late") : t("brainstorm.deadline")} {formatDatum(deadline, i18n.language)}
    </span>
  );
}
