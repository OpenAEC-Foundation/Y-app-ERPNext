import { alleenDatum, type TaakRegel } from "../../lib/werkplekken-model";
import type { AppStatus } from "../../lib/apps-model";

/** De kleur van het statuslabel van een app. */
export const STATUS_KLEUR: Record<AppStatus, string> = {
  Beschikbaar: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Beta: "bg-violet-50 text-violet-700 border-violet-200",
  "In ontwikkeling": "bg-sky-50 text-sky-700 border-sky-200",
  Community: "bg-amber-50 text-amber-700 border-amber-200",
};

/** Is de deadline van een taak al voorbij? */
export function teLaat(taak: TaakRegel, vandaag: string): boolean {
  const eind = alleenDatum(taak.exp_end_date);
  return !!eind && eind < vandaag;
}
