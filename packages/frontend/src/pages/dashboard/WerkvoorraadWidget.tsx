import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Layers, Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { fetchList } from "../../lib/erpnext";
import {
  telWerkvoorraad, toonUren, type VoorraadTaak, type Werkvoorraad,
} from "../../lib/werkvoorraad";
import type { Page } from "../../components/Sidebar";

/**
 * De werkvoorraad: hoeveel uur werk staat er open.
 *
 * Twee getallen naast elkaar, en dat onderscheid is het punt. **Oppakbaar** is
 * werk dat iemand vandaag kan doen. **Wacht** is werk dat op een beoordeling,
 * op ontbrekende informatie of op een bewuste pauze staat — dat is geen
 * capaciteit die je kunt inplannen. Eén totaal zou de voorraad groter maken
 * dan wat er te doen valt, en juist op dat getal ga je plannen.
 *
 * De uitsplitsing per stand staat eronder, zodat "waarom wacht er zoveel?" met
 * één blik te beantwoorden is.
 */

/** Standen die niet opgehaald hoeven te worden; dat scheelt honderden rijen. */
const KLAAR_STANDEN = ["Completed", "Cancelled", "Template", "Closed"];

export function WerkvoorraadWidget({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { t } = useTranslation();
  const [taken, setTaken] = useState<VoorraadTaak[] | null>(null);
  const [fout, setFout] = useState("");

  useEffect(() => {
    let afgebroken = false;
    (async () => {
      try {
        /*
         * Filteren op `status` en niet op `workflow_state`: niet elke
         * installatie heeft een workflow, en dan bestaat dat veld niet als
         * filter. De echte indeling gebeurt daarna alsnog op
         * `workflow_state` — zie `soortVan`. Dit filter haalt alleen de
         * grootste stapel eraf.
         */
        const rijen = await fetchList<VoorraadTaak>("Task", {
          fields: ["name", "status", "workflow_state", "expected_time", "actual_time"],
          filters: [["status", "not in", KLAAR_STANDEN]],
          limit_page_length: 0,
        });
        if (!afgebroken) setTaken(rijen);
      } catch (err) {
        if (!afgebroken) setFout(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { afgebroken = true; };
  }, []);

  const voorraad: Werkvoorraad | null = useMemo(
    () => (taken ? telWerkvoorraad(taken) : null), [taken]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Layers size={18} className="text-y-teal" />
        <button onClick={() => onNavigate("tasks")}
          className="cursor-pointer font-semibold text-slate-800 hover:text-y-teal">
          {t("werkvoorraad.title")} &rarr;
        </button>
      </div>

      {fout ? (
        <p className="text-sm text-amber-700">{fout}</p>
      ) : !voorraad ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={14} className="animate-spin" /> {t("common.loading")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Hoop
              icoon={<PlayCircle size={14} className="text-emerald-600" />}
              label={t("werkvoorraad.active")}
              uren={voorraad.actief.begroot}
              taken={voorraad.actief.taken}
              kleur="text-emerald-700"
            />
            <Hoop
              icoon={<PauseCircle size={14} className="text-amber-600" />}
              label={t("werkvoorraad.waiting")}
              uren={voorraad.wacht.begroot}
              taken={voorraad.wacht.taken}
              kleur="text-amber-700"
            />
          </div>

          {/* Resterend werk: begroot min wat er al op geboekt is. */}
          <p className="mt-3 text-xs text-slate-500">
            {t("werkvoorraad.remaining", {
              uren: toonUren(voorraad.actief.resterend + voorraad.wacht.resterend),
            })}
          </p>

          {/* Zonder dit getal is het urentotaal misleidend: verreweg de meeste
              taken dragen hier geen schatting. */}
          {voorraad.actief.zonderSchatting + voorraad.wacht.zonderSchatting > 0 && (
            <p className="mt-2 flex items-start gap-1.5 rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-slate-400" />
              {t("werkvoorraad.unestimated", {
                count: voorraad.actief.zonderSchatting + voorraad.wacht.zonderSchatting,
                totaal: voorraad.actief.taken + voorraad.wacht.taken,
              })}
            </p>
          )}

          {voorraad.perStand.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
              {voorraad.perStand.map((rij) => (
                <div key={rij.stand} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 truncate text-slate-600">
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      rij.soort === "wacht" ? "bg-amber-400" : "bg-emerald-500"
                    }`} />
                    {rij.stand}
                  </span>
                  <span className="flex-shrink-0 text-slate-500">
                    {t("werkvoorraad.rowvalue", { uren: toonUren(rij.begroot), taken: rij.taken })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Hoop({ icoon, label, uren, taken, kleur }: {
  icoon: React.ReactNode;
  label: string;
  uren: number;
  taken: number;
  kleur: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icoon} {label}
      </p>
      <p className={`text-2xl font-bold ${kleur}`}>
        {toonUren(uren)} <span className="text-sm font-normal text-slate-400">{t("werkvoorraad.hours")}</span>
      </p>
      <p className="text-[11px] text-slate-400">{t("werkvoorraad.tasks", { count: taken })}</p>
    </div>
  );
}
