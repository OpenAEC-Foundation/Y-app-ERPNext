import { useTranslation } from "react-i18next";
import { CalendarPlus, Check, HelpCircle, Loader2, X } from "lucide-react";
import type { Deelnamestatus } from "../../lib/ical";
import type { Uitnodiging } from "../../lib/useUitnodiging";

/**
 * De antwoordbalk boven een uitnodiging.
 *
 * Hier en niet alleen in de kolom ernaast: bovenaan het bericht is waar je
 * kijkt als je een uitnodiging opent, en waar elk mailprogramma die knoppen
 * zet. De kolom ernaast blijft waar je je eigen dag ziet — die beantwoordt de
 * vraag "kan ik dan?", deze balk de vraag "kom ik?".
 */

const KEUZES: [Deelnamestatus, typeof Check, string][] = [
  ["accepted", Check, "border-emerald-300 bg-emerald-50 text-emerald-700"],
  ["tentative", HelpCircle, "border-amber-300 bg-amber-50 text-amber-700"],
  ["declined", X, "border-rose-300 bg-rose-50 text-rose-700"],
];

export default function UitnodigingBalk({ uitnodiging }: { uitnodiging: Uitnodiging }) {
  const { t } = useTranslation();
  const { afspraak, genodigd, stand, bezig, bevestigd, fout, antwoord } = uitnodiging;

  // Geen uitnodiging, of eentje waar je zelf niet in staat: dan valt er niets
  // te beantwoorden en hoort er geen balk te staan.
  if (!afspraak?.start || !genodigd) return null;

  return (
    /* Opgebouwd als in Thunderbird: eerst de mededeling dát dit een
       uitnodiging is, daaronder de afspraak zelf met de drie knoppen. Aan een
       mail met een Teams-link en een tabel zie je niet dat er een afspraak in
       zit; die zin is wat het verschil maakt. */
    <div className="border-b border-violet-100 bg-violet-50/60 px-5 py-2">
      <p className="flex items-center gap-2 text-xs text-violet-900">
        <CalendarPlus size={14} className="flex-shrink-0 text-violet-500" />
        {stand === "needs-action" ? t("agenda.invite_banner") : t("agenda.invite_answer_question")}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[22px]">
      <span className="text-xs font-medium text-violet-900">
        {langeDatum(afspraak.start)}
        {!afspraak.heleDag && afspraak.eind
          ? ` · ${klok(afspraak.start)}–${klok(afspraak.eind)}`
          : ` · ${t("agenda.all_day")}`}
      </span>

      <div className="flex items-center gap-1">
        {KEUZES.map(([waarde, Icoon, actiefKlasse]) => {
          const actief = stand === waarde;
          return (
            <button key={waarde} type="button" disabled={bezig}
              onClick={() => void antwoord(waarde)}
              aria-pressed={actief}
              className={`flex cursor-pointer items-center gap-1 rounded border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                actief
                  ? `${actiefKlasse} font-medium`
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}>
              <Icoon size={12} /> {t(`agenda.invite_answer_${waarde}`)}
            </button>
          );
        })}
      </div>

      {bezig && <Loader2 size={12} className="animate-spin text-violet-400" />}
      {!bezig && bevestigd && !fout && (
        <span className="text-[11px] text-emerald-600">{t("agenda.invite_answer_saved")}</span>
      )}
      {!bezig && fout && (
        <span className="text-[11px] text-amber-700">{fout || t("agenda.invite_answer_failed")}</span>
      )}
      </div>
    </div>
  );
}

function klok(waarde?: string): string {
  const m = /[T ](\d{2}:\d{2})/.exec(String(waarde || ""));
  return m ? m[1] : "";
}

function langeDatum(waarde: string): string {
  const [j, m, d] = waarde.slice(0, 10).split("-").map(Number);
  if (!j || !m || !d) return waarde;
  return new Date(j, m - 1, d).toLocaleDateString("nl-NL", {
    weekday: "long", day: "numeric", month: "long",
  });
}
