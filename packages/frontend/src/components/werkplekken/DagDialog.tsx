import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, ListPlus, X } from "lucide-react";
import { useToast } from "../Toast";
import type { ProjectRecord } from "../../lib/DataContext";
import {
  geefBestaandeTaak, geefNieuweTaak, listVrijeTaken, zetDag,
} from "../../lib/werkplekken";
import {
  BOEKING_STATUSSEN, alleenDatum, patroonVan, takenOpDag, teLaat,
  type Boeking, type BoekingStatus, type Dag, type Persoon, type TaakRegel,
} from "../../lib/werkplekken-model";

/**
 * De dag van één persoon: is hij of zij er, en wat moet er gebeuren.
 * Boven de aanwezigheid (een afwijking voor deze ene dag; de plek deelt de
 * pagina zelf in), onder de taken uit de takenplanning en een formulier om er
 * een te geven.
 */
export default function DagDialog({
  persoon, datum, dag, boekingen, taken, projecten, vrijdag, datumTekst, onClose, onChanged,
}: {
  persoon: Persoon;
  datum: string;
  dag: Dag;
  boekingen: Boeking[];
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
                {achter.map((tk) => <TaakItem key={tk.name} taak={tk} project={projectNaam(tk.project)} laat datumTekst={datumTekst} />)}
                {lopend.map((tk) => <TaakItem key={tk.name} taak={tk} project={projectNaam(tk.project)} datumTekst={datumTekst} />)}
              </ul>
              <TaakGeven gebruiker={persoon.gebruiker} datum={datum} vrijdag={vrijdag} projecten={projecten} onGegeven={onChanged} />
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

function TaakItem({ taak, project, laat, datumTekst }: { taak: TaakRegel; project: string; laat?: boolean; datumTekst: (iso: string) => string }) {
  const { t } = useTranslation();
  return (
    <li className={`rounded-lg border px-3 py-2 text-sm ${laat ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <span className="block font-medium text-slate-800">{taak.subject}</span>
      <span className="flex items-center gap-2 text-xs text-slate-500">
        {project && <span className="truncate">{project}</span>}
        {taak.exp_end_date && (
          <span className={`inline-flex items-center gap-1 ${laat ? "text-red-700 font-semibold" : ""}`}>
            <CalendarClock size={12} />{laat ? t("werkplekken.te_laat", { datum: datumTekst(alleenDatum(taak.exp_end_date) as string) }) : datumTekst(alleenDatum(taak.exp_end_date) as string)}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * Iemand een taak geven: kies een project, typ wat er moet gebeuren, of pak
 * een open taak uit dat project die nog niemand heeft. Het blijft een gewone
 * ERPNext-taak, dus hij staat meteen in de takenplanning en de kanban.
 */
function TaakGeven({ gebruiker, datum, vrijdag, projecten, onGegeven }: {
  gebruiker: string; datum: string; vrijdag: string; projecten: ProjectRecord[]; onGegeven: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState("");
  const [onderwerp, setOnderwerp] = useState("");
  const [start, setStart] = useState(datum);
  const [deadline, setDeadline] = useState(vrijdag >= datum ? vrijdag : datum);
  const [vrij, setVrij] = useState<TaakRegel[]>([]);
  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const keuzes = useMemo(() => projecten
    .filter((p) => p.status === "Open")
    .sort((a, b) => (a.project_name || a.name).localeCompare(b.project_name || b.name)), [projecten]);

  useEffect(() => {
    if (!project) return;
    let actief = true;
    listVrijeTaken(project).then((r) => { if (actief) setVrij(r); }).catch(() => { if (actief) setVrij([]); });
    return () => { actief = false; };
  }, [project]);

  async function geef() {
    if (!project) { setFout(t("werkplekken.kies_project")); return; }
    if (!onderwerp.trim()) { setFout(t("werkplekken.vul_taak_in")); return; }
    if (deadline && start && deadline < start) { setFout(t("werkplekken.deadline_voor_start")); return; }
    setBusy(true);
    try {
      await geefNieuweTaak(gebruiker, { subject: onderwerp.trim(), project, start: start || null, deadline: deadline || null });
      toast.success(t("werkplekken.taak_gegeven"));
      setOnderwerp("");
      setOpen(false);
      onGegeven();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("werkplekken.opslaan_mislukt"));
    } finally {
      setBusy(false);
    }
  }

  async function geefBestaand(taak: TaakRegel) {
    setBusy(true);
    try {
      await geefBestaandeTaak(gebruiker, taak, start || null, deadline || null);
      toast.success(t("werkplekken.taak_gegeven"));
      setOpen(false);
      onGegeven();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("werkplekken.opslaan_mislukt"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer text-sm font-medium">
        <ListPlus size={16} /> {t("werkplekken.taak_geven")}
      </button>
    );
  }

  const veld = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal";
  return (
    <form className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3" onSubmit={(e) => { e.preventDefault(); geef(); }}>
      <label className="block text-xs text-slate-500">{t("werkplekken.project")}
        <select value={project} onChange={(e) => { setProject(e.target.value); setVrij([]); setFout(null); }} className={`${veld} mt-1`}>
          <option value="">{t("werkplekken.kies_project")}</option>
          {keuzes.map((p) => <option key={p.name} value={p.name}>{p.project_name || p.name}</option>)}
        </select>
      </label>
      <label className="block text-xs text-slate-500">{t("werkplekken.wat_moet_er_gebeuren")}
        <input value={onderwerp} onChange={(e) => { setOnderwerp(e.target.value); setFout(null); }} className={`${veld} mt-1`} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-slate-500">{t("werkplekken.start")}
          <input type="date" value={start} onChange={(e) => { setStart(e.target.value); setFout(null); }} className={`${veld} mt-1`} />
        </label>
        <label className="block text-xs text-slate-500">{t("werkplekken.deadline")}
          <input type="date" value={deadline} onChange={(e) => { setDeadline(e.target.value); setFout(null); }} className={`${veld} mt-1`} />
        </label>
      </div>
      {fout && <p className="text-xs text-red-600">{fout}</p>}
      {vrij.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-slate-500">{t("werkplekken.vrije_taken")}</p>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {vrij.map((tk) => (
              <li key={tk.name} className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-lg px-2 py-1">
                <span className="flex-1 min-w-0 truncate">{tk.subject}</span>
                <button type="button" disabled={busy} onClick={() => geefBestaand(tk)}
                  className="px-2 py-0.5 text-xs border border-slate-200 rounded hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                  {t("werkplekken.geef")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 cursor-pointer">{t("common.cancel")}</button>
        <button type="submit" disabled={busy} className="px-3 py-2 text-sm bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer disabled:opacity-50">{t("werkplekken.taak_geven")}</button>
      </div>
    </form>
  );
}
