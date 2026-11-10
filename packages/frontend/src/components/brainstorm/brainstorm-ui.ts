import type { Label, LabelGroep } from "../../lib/brainstorm-model";

/** Eén kleur per labelgroep, zodat je aan een tegel ziet waar een label over gaat. */
export const GROUP_CLASSES: Record<LabelGroep, string> = {
  Soort: "bg-blue-50 text-blue-700 border-blue-200",
  Kanaal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Nodig: "bg-violet-50 text-violet-700 border-violet-200",
  Prioriteit: "bg-red-50 text-red-700 border-red-200",
  Programma: "bg-slate-100 text-slate-700 border-slate-300",
  Overig: "bg-amber-50 text-amber-800 border-amber-200",
};

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDatum(iso: string, lang: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" });
}

export function groepVan(label: string, labels: Label[]): LabelGroep {
  return labels.find((l) => l.label === label)?.groep || "Overig";
}
