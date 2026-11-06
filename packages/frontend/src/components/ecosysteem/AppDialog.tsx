import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, X } from "lucide-react";
import { useToast } from "../Toast";
import type { ProjectRecord } from "../../lib/DataContext";
import { deleteApp, saveApp, type AppGegevens } from "../../lib/apps";
import { APP_STATUSSEN, takenVanProject, type App } from "../../lib/apps-model";
import { teLaat as isTeLaat } from "./ecosysteem-ui";
import { toegewezenAan, type Persoon, type TaakRegel } from "../../lib/werkplekken-model";
import TaakGeven, { TaakItem } from "../werkplekken/TaakGeven";

const VELD = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal";

function leeg(volgorde: number): AppGegevens {
  return {
    naam: "", status: "In ontwikkeling", in_ecosysteem: 1, productmanager: null, project: null,
    repository: null, codeowners: null, beschrijving: null, volgorde, team: [],
  };
}

/**
 * Eén app: wie productmanager (en daarmee eindverantwoordelijke) is, wie eraan werkt,
 * aan welk ERP-project hij hangt — en daaronder de open taken van dat project,
 * met een formulier om iemand uit het team een taak te geven.
 */
export default function AppDialog({ app, volgorde, personen, kleurVan, projecten, taken, vandaag, vrijdag, datumTekst, onClose, onChanged }: {
  app: App | null;
  volgorde: number;
  personen: Persoon[];
  kleurVan: (persoon: string) => string;
  projecten: ProjectRecord[];
  taken: TaakRegel[];
  vandaag: string;
  vrijdag: string;
  datumTekst: (iso: string) => string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [concept, setConcept] = useState<AppGegevens>(() => (app ? { ...app, team: app.team.map((l) => ({ ...l })) } : leeg(volgorde)));
  const [busy, setBusy] = useState(false);
  const zet = <K extends keyof AppGegevens>(k: K, v: AppGegevens[K]) => setConcept((c) => ({ ...c, [k]: v }));

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const persoonVan = (naam: string | null) => personen.find((p) => p.name === naam);
  const projectKeuzes = useMemo(() => projecten
    .filter((p) => p.status === "Open" || p.name === concept.project)
    .sort((a, b) => (a.project_name || a.name).localeCompare(b.project_name || b.name)), [projecten, concept.project]);
  const inTeam = (naam: string) => concept.team.some((l) => l.persoon === naam);
  const wisselTeam = (naam: string) => zet("team", inTeam(naam) ? concept.team.filter((l) => l.persoon !== naam) : [...concept.team, { persoon: naam, rol: null }]);

  async function bewaar() {
    if (!concept.naam.trim()) { toast.error(t("ecosysteem.naam_verplicht")); return; }
    setBusy(true);
    try {
      await saveApp(app?.name ?? null, { ...concept, naam: concept.naam.trim() });
      toast.success(t("ecosysteem.opgeslagen"));
      onChanged();
      if (!app) onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("werkplekken.opslaan_mislukt"));
    } finally {
      setBusy(false);
    }
  }

  async function verwijder() {
    if (!app || !window.confirm(t("ecosysteem.verwijderen_vraag", { naam: app.naam }))) return;
    try {
      await deleteApp(app.name);
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("werkplekken.verwijderen_mislukt"));
    }
  }


  // Taken komen uit het project zoals het nu is opgeslagen, niet uit het concept.
  const projectTaken = takenVanProject(taken, app?.project ?? null);
  const naamVanEmail = (email: string) => personen.find((p) => (p.gebruiker || "").toLowerCase() === email.toLowerCase())?.naam || email;
  const ontvangers = (app?.team || [])
    .map((l) => persoonVan(l.persoon))
    .filter((p): p is Persoon => !!p?.gebruiker)
    .map((p) => ({ email: p.gebruiker as string, naam: p.naam }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] overflow-y-auto" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-2xl bg-white rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{app ? app.naam : t("ecosysteem.nieuwe_app")}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer" aria-label={t("common.close")}><X size={18} /></button>
        </div>

        <form className="px-6 py-4 space-y-3 border-b border-slate-100" onSubmit={(e) => { e.preventDefault(); bewaar(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-500">{t("werkplekken.naam")}
              <input value={concept.naam} onChange={(e) => zet("naam", e.target.value)} disabled={!!app} className={`${VELD} mt-1 disabled:bg-slate-50`} />
            </label>
            <label className="block text-xs text-slate-500">{t("ecosysteem.status")}
              <select value={concept.status} onChange={(e) => zet("status", e.target.value as AppGegevens["status"])} className={`${VELD} mt-1`}>
                {APP_STATUSSEN.map((s) => <option key={s} value={s}>{t(`ecosysteem.statussen.${s}`)}</option>)}
              </select>
            </label>
            <label className="block text-xs text-slate-500 sm:col-span-2">{t("ecosysteem.productmanager_uitleg")}
              <select value={concept.productmanager || ""} onChange={(e) => zet("productmanager", e.target.value || null)} className={`${VELD} mt-1`}>
                <option value="">{t("ecosysteem.nog_niemand")}</option>
                {personen.map((p) => <option key={p.name} value={p.name}>{p.naam}</option>)}
              </select>
            </label>
          </div>
          <div>
            <span className="block text-xs text-slate-500 mb-1">{t("ecosysteem.werkt_eraan")}</span>
            <div className="flex flex-wrap gap-1.5">
              {personen.map((p) => (
                <button key={p.name} type="button" onClick={() => wisselTeam(p.name)} aria-pressed={inTeam(p.name)}
                  className={`px-2 py-1 rounded-md border text-xs cursor-pointer ${inTeam(p.name) ? kleurVan(p.name) : "border-slate-200 text-slate-400 hover:bg-slate-50"}`}>
                  {p.naam}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-500">{t("ecosysteem.project")}
              <select value={concept.project || ""} onChange={(e) => zet("project", e.target.value || null)} className={`${VELD} mt-1`}>
                <option value="">{t("ecosysteem.geen_project")}</option>
                {projectKeuzes.map((p) => <option key={p.name} value={p.name}>{p.project_name || p.name}</option>)}
              </select>
            </label>
            <label className="block text-xs text-slate-500">{t("ecosysteem.repository")}
              <input value={concept.repository || ""} onChange={(e) => zet("repository", e.target.value || null)} placeholder="OpenAEC-Foundation/…" className={`${VELD} mt-1`} />
            </label>
          </div>
          <label className="block text-xs text-slate-500">{t("ecosysteem.beschrijving")}
            <textarea value={concept.beschrijving || ""} onChange={(e) => zet("beschrijving", e.target.value || null)} rows={2} className={`${VELD} mt-1`} />
          </label>
          {concept.codeowners && <p className="text-[11px] text-slate-400">{t("ecosysteem.codeowners", { wie: concept.codeowners })}</p>}
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={!!concept.in_ecosysteem} onChange={(e) => zet("in_ecosysteem", e.target.checked ? 1 : 0)} className="accent-y-teal" />
            {t("ecosysteem.in_ecosysteem")}
          </label>
          <div className="flex items-center justify-between">
            {app ? (
              <button type="button" onClick={verwijder} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer">
                <Trash2 size={15} /> {t("werkplekken.verwijderen")}
              </button>
            ) : <span />}
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer disabled:opacity-50">{t("werkplekken.opslaan")}</button>
          </div>
        </form>

        {app && (
          <div className="px-6 py-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("werkplekken.taken")}</h4>
            {!app.project ? (
              <p className="text-sm text-slate-500">{t("ecosysteem.koppel_project")}</p>
            ) : (
              <>
                {projectTaken.length === 0 && <p className="text-sm text-slate-500">{t("ecosysteem.geen_open_taken")}</p>}
                <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                  {projectTaken.map((tk) => {
                    const wie = toegewezenAan(tk).map(naamVanEmail).join(", ");
                    return <TaakItem key={tk.name} taak={tk} sub={wie || t("ecosysteem.zonder_eigenaar")} laat={isTeLaat(tk, vandaag)} datumTekst={datumTekst} />;
                  })}
                </ul>
                {ontvangers.length > 0
                  ? <TaakGeven ontvangers={ontvangers} project={app.project} datum={vandaag} vrijdag={vrijdag} projecten={projecten} onGegeven={onChanged} />
                  : <p className="text-xs text-slate-400">{t("ecosysteem.eerst_team")}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
