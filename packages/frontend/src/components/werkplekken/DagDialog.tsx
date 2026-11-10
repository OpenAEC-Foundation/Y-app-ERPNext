import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useToast } from "../Toast";
import TaakGeven, { TaakItem } from "./TaakGeven";
import type { ProjectRecord } from "../../lib/DataContext";
import { zetDag } from "../../lib/werkplekken";
import {
  BOEKING_STATUSSEN, patroonVan, takenOpDag, teLaat,
  type Boeking, type BoekingStatus, type Dag, type DagInvulling, type Persoon, type Plaatsing, type TaakRegel,
} from "../../lib/werkplekken-model";

/**
 * De dag van één persoon: is hij of zij er, en wat moet er gebeuren.
 * Boven de aanwezigheid (een afwijking voor deze ene dag; de plek deelt de
 * pagina zelf in), onder de taken uit de takenplanning en een formulier om er
 * een te geven.
 */
export default function DagDialog({
  persoon, datum, dag, boekingen, plaatsing, plekNaam, stand, apps, taken, projecten, vrijdag, datumTekst, onClose, onChanged,
}: {
  persoon: Persoon;
  datum: string;
  dag: Dag;
  boekingen: Boeking[];
  /** Waar de indeling deze persoon die dag heeft neergezet. */
  plaatsing: Plaatsing | undefined;
  plekNaam: (id: string) => string;
  /** Hoe de dag nu uitvalt; zegt ook of dat uit de agenda komt. */
  stand: DagInvulling | undefined;
  /** De apps waar deze persoon aan werkt (namen). */
  apps: string[];
  taken: TaakRegel[];
  projecten: ProjectRecord[];
  /** De vrijdag van deze week; de standaarddeadline van een nieuwe taak. */
  vrijdag: string;
  datumTekst: (iso: string) => string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const huidig: BoekingStatus | null = boekingen[0]?.status ?? null;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  // De plek kiest de pagina zelf; hier zet je alleen of iemand er is.
  async function zet(status: BoekingStatus | null) {
    setBusy(true);
    try {
      await zetDag(persoon.name, datum, status, null, boekingen);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("werkplekken.opslaan_mislukt"));
    } finally {
      setBusy(false);
    }
  }

  const patroon = patroonVan(persoon, dag);
  // Met de hand neergezet: "Van deze plek halen" haalt de boeking weg, zodat het patroon weer geldt.
  const handmatig = plaatsing?.reden === "gekozen" || plaatsing?.reden === "dubbel";
  const patroonLabel = patroon ? t(`werkplekken.patroon.${patroon}`) : persoon.wisselend ? t("werkplekken.wisselend") : t("werkplekken.patroon.leeg");
  const projectNaam = (id: string | null) => projecten.find((p) => p.name === id)?.project_name || id || "";
  const lopend = takenOpDag(taken, persoon.gebruiker, datum);
  const achter = teLaat(taken, persoon.gebruiker, datum);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] overflow-y-auto" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-lg bg-white rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-800">{persoon.naam}</h3>
            <p className="text-sm text-slate-500">{datumTekst(datum)}</p>
            {apps.length > 0 && <p className="text-xs text-slate-400 mt-0.5">{t("werkplekken.werkt_aan", { apps: apps.join(", ") })}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer" aria-label={t("common.close")}><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-3 border-b border-slate-100">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("werkplekken.aanwezigheid")}</h4>
          <div className="flex flex-wrap gap-2">
            <Keuze actief={huidig === null} disabled={busy} onClick={() => zet(null)}>
              {t("werkplekken.standaard", { patroon: patroonLabel })}
            </Keuze>
            {BOEKING_STATUSSEN.map((s) => (
              <Keuze key={s} actief={huidig === s} disabled={busy} onClick={() => zet(s)}>
                {t(`werkplekken.status.${s}`)}
              </Keuze>
            ))}
          </div>
          {stand?.uitAgenda && (
            <p className="text-xs text-slate-500">{t("werkplekken.volgens_agenda", { stand: t(`werkplekken.${stand.stand}`) })}</p>
          )}
          {plaatsing?.werkplek && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="text-slate-500">{t("werkplekken.plek")}: </span>
                <span className="font-medium text-slate-800">{plekNaam(plaatsing.werkplek)}</span>
                <span className="text-xs text-slate-400"> · {t(handmatig ? "werkplekken.plek_met_de_hand" : "werkplekken.plek_automatisch_gekozen")}</span>
              </span>
              {handmatig && (
                <button type="button" disabled={busy} onClick={() => zet(null)}
                  className="shrink-0 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                  {t("werkplekken.van_plek_halen")}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("werkplekken.taken")}</h4>
          {!persoon.gebruiker ? (
            <p className="text-sm text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">{t("werkplekken.geen_account_uitleg")}</p>
          ) : (
            <>
              {lopend.length === 0 && achter.length === 0 && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{t("werkplekken.geen_taak_uitleg")}</p>
              )}
              <ul className="space-y-1.5">
                {achter.map((tk) => <TaakItem key={tk.name} taak={tk} sub={projectNaam(tk.project)} laat datumTekst={datumTekst} />)}
                {lopend.map((tk) => <TaakItem key={tk.name} taak={tk} sub={projectNaam(tk.project)} datumTekst={datumTekst} />)}
              </ul>
              <TaakGeven ontvangers={[{ email: persoon.gebruiker, naam: persoon.naam }]} datum={datum} vrijdag={vrijdag} projecten={projecten} onGegeven={onChanged} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Keuze({ actief, disabled, onClick, children }: { actief: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={actief}
      className={`px-3 py-1.5 rounded-lg border text-sm cursor-pointer disabled:opacity-50 ${actief ? "bg-y-teal/10 border-y-teal text-y-teal font-semibold" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
      {children}
    </button>
  );
}
