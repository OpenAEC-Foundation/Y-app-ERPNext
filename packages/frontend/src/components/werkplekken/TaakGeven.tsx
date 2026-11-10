import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, ListPlus } from "lucide-react";
import { useToast } from "../Toast";
import type { ProjectRecord } from "../../lib/DataContext";
import { geefBestaandeTaak, geefNieuweTaak, listVrijeTaken } from "../../lib/werkplekken";
import { alleenDatum, type TaakRegel } from "../../lib/werkplekken-model";

/** Eén taak in een lijst: onderwerp, een regel eronder (project of wie) en de deadline, rood als die voorbij is. */
export function TaakItem({ taak, sub, laat, datumTekst }: { taak: TaakRegel; sub: string; laat?: boolean; datumTekst: (iso: string) => string }) {
  const { t } = useTranslation();
  return (
    <li className={`rounded-lg border px-3 py-2 text-sm ${laat ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <span className="block font-medium text-slate-800">{taak.subject}</span>
      <span className="flex items-center gap-2 text-xs text-slate-500">
        {sub && <span className="truncate">{sub}</span>}
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
 *
 * Vanuit Werkplekken is er één ontvanger en kies je het project; vanuit een
 * app ligt het project vast (`project`) en kies je wie uit het team.
 */
export default function TaakGeven({ ontvangers, project: vastProject, datum, vrijdag, projecten, onGegeven }: {
  ontvangers: { email: string; naam: string }[];
  project?: string;
  datum: string;
  vrijdag: string;
  projecten: ProjectRecord[];
  onGegeven: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState(vastProject || "");
  const [gebruiker, setGebruiker] = useState(ontvangers.length === 1 ? ontvangers[0].email : "");
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
    if (!gebruiker) { setFout(t("werkplekken.kies_ontvanger")); return; }
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
    if (!gebruiker) { setFout(t("werkplekken.kies_ontvanger")); return; }
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
      {ontvangers.length > 1 && (
        <label className="block text-xs text-slate-500">{t("werkplekken.voor_wie")}
          <select value={gebruiker} onChange={(e) => { setGebruiker(e.target.value); setFout(null); }} className={`${veld} mt-1`}>
            <option value="">{t("werkplekken.kies_ontvanger")}</option>
            {ontvangers.map((o) => <option key={o.email} value={o.email}>{o.naam}</option>)}
          </select>
        </label>
      )}
      {!vastProject && (
        <label className="block text-xs text-slate-500">{t("werkplekken.project")}
          <select value={project} onChange={(e) => { setProject(e.target.value); setVrij([]); setFout(null); }} className={`${veld} mt-1`}>
            <option value="">{t("werkplekken.kies_project")}</option>
            {keuzes.map((p) => <option key={p.name} value={p.name}>{p.project_name || p.name}</option>)}
          </select>
        </label>
      )}
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
