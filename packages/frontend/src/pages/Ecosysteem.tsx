import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive, Boxes, ChevronDown, ChevronRight, ExternalLink, Plus, RefreshCw } from "lucide-react";
import { useProjects } from "../lib/DataContext";
import { appsStand, listApps, saveApp, type AppsStand } from "../lib/apps";
import { APP_STATUSSEN, githubUrl, sorteerApps, takenStand, type App, type AppStatus } from "../lib/apps-model";
import { listOpenTaken, listPersonen } from "../lib/werkplekken";
import { isoDatum, maandagVan, sorteerPersonen, werkdagen, type Persoon, type TaakRegel } from "../lib/werkplekken-model";
import { persoonsKleur } from "../components/werkplekken/werkplekken-ui";
import { STATUS_KLEUR } from "../components/ecosysteem/ecosysteem-ui";
import { PersoonChip } from "../components/ecosysteem/PersoonChip";
import AppDialog from "../components/ecosysteem/AppDialog";

/**
 * Ecosysteem: de apps van OpenAEC, met per app de productmanager (die ook
 * eindverantwoordelijk is), wie eraan werkt en hoe de taken van het
 * gekoppelde project ervoor staan. De mensen en hun kleuren zijn die van
 * Werkplekken. Apps die niet (meer) in het ecosysteem staan, gaan naar het
 * archief onderaan; daar zet je ze met één klik terug.
 */
export default function Ecosysteem() {
  const { t, i18n } = useTranslation();
  const projecten = useProjects();
  const [stand, setStand] = useState<AppsStand | "laden">("laden");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [personen, setPersonen] = useState<Persoon[]>([]);
  const [taken, setTaken] = useState<TaakRegel[]>([]);
  const [filter, setFilter] = useState<AppStatus | "">("");
  const [open, setOpen] = useState<string | "nieuw" | null>(null);
  const [archiefOpen, setArchiefOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const s = await appsStand();
      setStand(s);
      setError(null);
      if (s !== "klaar") return;
      const [a, p, tk] = await Promise.all([
        listApps(), listPersonen().catch(() => [] as Persoon[]), listOpenTaken().catch(() => [] as TaakRegel[]),
      ]);
      setApps(a);
      setPersonen(p);
      setTaken(tk);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    }
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchAll();
    setLoading(false);
  }, [fetchAll]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const actief = useMemo(() => sorteerPersonen(personen.filter((p) => p.actief)), [personen]);
  const kleurVan = (naam: string) => persoonsKleur(actief.findIndex((p) => p.name === naam));
  const naamVan = (naam: string) => personen.find((p) => p.name === naam)?.naam || naam;
  const projectNaam = (id: string) => projecten.find((p) => p.name === id)?.project_name || id;
  const vandaag = isoDatum(new Date());
  const vrijdag = werkdagen(maandagVan(new Date()))[4];
  const datumTekst = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language, { weekday: "short", day: "numeric", month: "short" });

  const header = (
    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-y-teal/10 rounded-lg"><Boxes className="text-y-teal" size={24} /></div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t("nav.ecosysteem")}</h2>
          <p className="text-sm text-slate-500">{t("ecosysteem.subtitle")}</p>
        </div>
      </div>
      {stand === "klaar" && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen("nieuw")}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer text-sm font-medium">
            <Plus size={16} /> {t("ecosysteem.nieuwe_app")}
          </button>
          <button type="button" onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer text-sm">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
          </button>
        </div>
      )}
    </div>
  );

  if (stand === "laden" && !error) return <div className="p-3 sm:p-6">{header}<div className="py-16 text-center text-slate-400">{t("common.loading")}</div></div>;
  if (error) return <div className="p-3 sm:p-6">{header}<div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div></div>;
  if (stand !== "klaar") {
    return (
      <div className="p-3 sm:p-6">
        {header}
        <div className="max-w-xl bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <p className="text-sm text-slate-600">{t(stand === "geen-rechten" ? "ecosysteem.geen_rechten" : "ecosysteem.setup_text")}</p>
        </div>
      </div>
    );
  }

  const inEcosysteem = apps.filter((a) => a.in_ecosysteem);
  const archief = sorteerApps(apps.filter((a) => !a.in_ecosysteem));
  const zichtbaar = sorteerApps(inEcosysteem.filter((a) => !filter || a.status === filter));

  async function terugZetten(a: App) {
    try {
      await saveApp(a.name, { ...a, in_ecosysteem: 1 });
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    }
  }
  const geopend = open && open !== "nieuw" ? apps.find((a) => a.name === open) : undefined;
  const filterKnop = (waarde: AppStatus | "", label: string, aantal: number) => (
    <button key={waarde || "alle"} type="button" onClick={() => setFilter(waarde)} aria-pressed={filter === waarde}
      className={`px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${filter === waarde ? "bg-y-teal/10 border-y-teal text-y-teal font-semibold" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
      {label} <span className="text-xs opacity-60 tabular-nums">{aantal}</span>
    </button>
  );

  return (
    <div className="p-3 sm:p-6">
      {header}
      <div className="mb-4 flex flex-wrap gap-2">
        {filterKnop("", t("ecosysteem.alle"), inEcosysteem.length)}
        {APP_STATUSSEN.filter((s) => inEcosysteem.some((a) => a.status === s)).map((s) =>
          filterKnop(s, t(`ecosysteem.statussen.${s}`), inEcosysteem.filter((a) => a.status === s).length))}
      </div>

      {zichtbaar.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">{t("ecosysteem.leeg")}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {zichtbaar.map((a) => {
            const tk = takenStand(taken, a.project, vandaag);
            const url = githubUrl(a.repository);
            const rol = (label: string, persoon: string | null) => (
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-32 shrink-0 text-xs text-slate-400">{label}</span>
                {persoon ? <PersoonChip naam={naamVan(persoon)} kleur={kleurVan(persoon)} /> : <span className="text-xs text-slate-300">—</span>}
              </div>
            );
            return (
              <div key={a.name} role="button" tabIndex={0} onClick={() => setOpen(a.name)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(a.name); } }}
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 cursor-pointer hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-y-teal/40">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-800">{a.naam}</h3>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-medium ${STATUS_KLEUR[a.status] || STATUS_KLEUR["In ontwikkeling"]}`}>
                    {t(`ecosysteem.statussen.${a.status}`)}
                  </span>
                </div>
                {rol(t("ecosysteem.productmanager"), a.productmanager)}
                <div className="flex items-start gap-2">
                  <span className="w-32 shrink-0 text-xs text-slate-400 pt-0.5">{t("ecosysteem.werkt_eraan")}</span>
                  <div className="flex flex-wrap gap-1">
                    {a.team.length ? a.team.map((l) => <PersoonChip key={l.persoon} naam={naamVan(l.persoon)} kleur={kleurVan(l.persoon)} />)
                      : <span className="text-xs text-slate-300">—</span>}
                  </div>
                </div>
                <div className="text-xs text-slate-500 border-t border-slate-100 pt-2">
                  {a.project ? (
                    <span>
                      {projectNaam(a.project)} · {t("ecosysteem.aantal_open", { count: tk.open })}
                      {tk.teLaat > 0 && <span className="text-red-600 font-medium"> · {t("ecosysteem.aantal_te_laat", { count: tk.teLaat })}</span>}
                      {tk.volgendeDeadline && <span> · {t("ecosysteem.volgende_deadline", { datum: datumTekst(tk.volgendeDeadline) })}</span>}
                    </span>
                  ) : <span className="text-slate-400">{t("ecosysteem.geen_project")}</span>}
                </div>
                {(a.codeowners || url) && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="truncate">{a.codeowners ? t("ecosysteem.codeowners", { wie: a.codeowners }) : ""}</span>
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 shrink-0 hover:text-y-teal">
                        GitHub <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {archief.length > 0 && (
        <div className="mt-8">
          <button type="button" onClick={() => setArchiefOpen((v) => !v)} aria-expanded={archiefOpen}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">
            {archiefOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Archive size={15} /> {t("ecosysteem.archief", { count: archief.length })}
          </button>
          {archiefOpen && (
            <ul className="mt-3 divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
              {archief.map((a) => (
                <li key={a.name} className="flex items-center gap-3 px-4 py-2.5">
                  <button type="button" onClick={() => setOpen(a.name)} className="flex-1 min-w-0 text-left cursor-pointer">
                    <span className="block text-sm font-medium text-slate-700 truncate">{a.naam}</span>
                    {a.repository && <span className="block text-[11px] text-slate-400 truncate">{a.repository}</span>}
                  </button>
                  <button type="button" onClick={() => terugZetten(a)}
                    className="shrink-0 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    {t("ecosysteem.naar_ecosysteem")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {open && (open === "nieuw" || geopend) && (
        <AppDialog key={open} app={geopend ?? null} volgorde={Math.max(0, ...apps.map((a) => a.volgorde || 0)) + 1}
          personen={actief} kleurVan={kleurVan} projecten={projecten} taken={taken}
          vandaag={vandaag} vrijdag={vrijdag} datumTekst={datumTekst}
          onClose={() => setOpen(null)} onChanged={fetchAll} />
      )}
    </div>
  );
}
