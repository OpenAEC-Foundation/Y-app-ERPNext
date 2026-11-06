import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Armchair, CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Settings2 } from "lucide-react";
import { useProjects } from "../lib/DataContext";
import { listApps } from "../lib/apps";
import { appsVanPersoon, type App } from "../lib/apps-model";
import {
  haalAgendaAanwezigheid, listBoekingen, listOpenTaken, listPersonen, listWerkplekken, werkplekkenStand, type WerkplekkenStand,
} from "../lib/werkplekken";
import {
  berekenWeek, groepVan, opKantoorTePlaatsen, isoDatum, maandagVan, perRuimte, sorteerPersonen,
  weekNummer, werkdagen,
  type Boeking, type BoekingStatus, type DagInvulling, type DagOverzicht, type Persoon, type PersoonGroep, type TaakRegel, type Werkplek,
} from "../lib/werkplekken-model";
import { Kader, PersoonVakje } from "../components/werkplekken/Vakje";
import { VAKJE, persoonsKleur } from "../components/werkplekken/werkplekken-ui";
import DagDialog from "../components/werkplekken/DagDialog";
import IemandNeerzetten from "../components/werkplekken/IemandNeerzetten";
import Beheer from "../components/werkplekken/Beheer";

type View = "plek" | "persoon";
const VIEW_KEY = "pref_werkplekken_view";


/**
 * Werkplekken: wie zit wanneer op welke plek, en waaraan werkt hij of zij.
 * Twee weergaven van dezelfde week: per bureau (gegroepeerd per ruimte) en
 * per persoon. De plekken worden automatisch ingedeeld (op een vrije
 * flexplek kun je iemand ook met de hand neerzetten); iedereen heeft een
 * eigen kleur. Een vakje aanklikken opent de dag van die persoon, met de
 * aanwezigheid en de taken.
 */
export default function Werkplekken() {
  const { t, i18n } = useTranslation();
  const projecten = useProjects();
  const [stand, setStand] = useState<WerkplekkenStand | "laden">("laden");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [maandag, setMaandag] = useState(() => maandagVan(new Date()));
  const [personen, setPersonen] = useState<Persoon[]>([]);
  const [werkplekken, setWerkplekken] = useState<Werkplek[]>([]);
  const [boekingen, setBoekingen] = useState<Boeking[]>([]);
  const [taken, setTaken] = useState<TaakRegel[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [agenda, setAgenda] = useState<Map<string, Map<string, BoekingStatus>>>(() => new Map());
  const [view, setView] = useState<View>(() => {
    try { return localStorage.getItem(VIEW_KEY) === "persoon" ? "persoon" : "plek"; } catch { return "plek"; }
  });
  const [open, setOpen] = useState<{ persoon: string; datum: string } | null>(null);
  const [beheer, setBeheer] = useState(false);
  const [neerzetten, setNeerzetten] = useState<{ werkplek: string; datum: string } | null>(null);

  const dagen = useMemo(() => werkdagen(maandag), [maandag]);
  const vandaag = isoDatum(new Date());

  const fetchAll = useCallback(async () => {
    try {
      const s = await werkplekkenStand();
      setStand(s);
      setError(null);
      if (s !== "klaar") return;
      const [p, w, b, tk, ap] = await Promise.all([
        listPersonen(), listWerkplekken(), listBoekingen(dagen[0], dagen[4]),
        // Zonder takenrechten blijft het overzicht bruikbaar, alleen zonder taken.
        listOpenTaken().catch(() => [] as TaakRegel[]),
        // De apps zijn een extraatje: zonder doctype of rechten gewoon geen.
        listApps().catch(() => [] as App[]),
      ]);
      setPersonen(p);
      setWerkplekken(w);
      setBoekingen(b);
      setTaken(tk);
      setApps(ap);
      // De agenda's pas na de personen: we vragen alleen naar wie er meedoet.
      setAgenda(await haalAgendaAanwezigheid(p, dagen));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    }
  }, [dagen, t]);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchAll();
    setLoading(false);
  }, [fetchAll]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function switchView(v: View) {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* alleen gemak */ }
  }

  // Kleuren over iedereen die actief is, zoals bij Ecosysteem; de rijen alleen wie een werkplek krijgt.
  const alleActief = useMemo(() => sorteerPersonen(personen.filter((p) => p.actief)), [personen]);
  const actief = useMemo(() => opKantoorTePlaatsen(personen), [personen]);
  // De hele week in één keer indelen, zodat iemand steeds op dezelfde plek zit.
  const week: DagOverzicht[] = useMemo(() => berekenWeek(personen, werkplekken, boekingen, maandag, agenda), [personen, werkplekken, boekingen, maandag, agenda]);

  const persoonVan = (name: string | null | undefined) => personen.find((p) => p.name === name);
  const plekNaam = (id: string) => werkplekken.find((w) => w.name === id)?.plek || id;
  const kleurVan = (name: string) => persoonsKleur(alleActief.findIndex((p) => p.name === name));
  const datumTekst = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language, { weekday: "short", day: "numeric", month: "short" });
  const verschuif = (weken: number) => setMaandag((m) => new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7 * weken));

  const header = (
    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-y-teal/10 rounded-lg"><Armchair className="text-y-teal" size={24} /></div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t("nav.werkplekken")}</h2>
          <p className="text-sm text-slate-500">{t("werkplekken.subtitle")}</p>
        </div>
      </div>
      {stand === "klaar" && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setBeheer(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
            <Settings2 size={16} /> {t("werkplekken.beheer")}
          </button>
          <button type="button" onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer text-sm">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
          </button>
        </div>
      )}
    </div>
  );

  if (stand === "laden" && !error) {
    return <div className="p-3 sm:p-6">{header}<div className="py-16 text-center text-slate-400">{t("common.loading")}</div></div>;
  }
  if (error) {
    return <div className="p-3 sm:p-6">{header}<div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div></div>;
  }
  if (stand === "niet-ingesteld" || stand === "geen-rechten") {
    return (
      <div className="p-3 sm:p-6">
        {header}
        <div className="max-w-xl bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-3">
          <h3 className="text-lg font-semibold text-slate-800">{t(stand === "geen-rechten" ? "werkplekken.geen_rechten_titel" : "werkplekken.setup_title")}</h3>
          <p className="text-sm text-slate-600">{t(stand === "geen-rechten" ? "werkplekken.geen_rechten" : "werkplekken.setup_text")}</p>
        </div>
      </div>
    );
  }

  const kolommen = (
    <colgroup>
      <col className="w-36" />
      {dagen.map((d) => <col key={d} />)}
    </colgroup>
  );
  const kop = (eerste: string) => (
    <thead>
      <tr>
        <th className="py-2 pr-2 text-left text-xs font-medium text-slate-500">{eerste}</th>
        {dagen.map((d) => (
          <th key={d} className={`py-2 px-1 text-left text-xs font-medium ${d === vandaag ? "text-y-teal font-semibold" : "text-slate-500"}`}>
            {datumTekst(d)}
          </th>
        ))}
      </tr>
    </thead>
  );
  const groepsRij = (key: string, titel: string, extra?: string) => (
    <tr key={key}><td colSpan={6} className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
      {titel}{extra && <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">{extra}</span>}
    </td></tr>
  );
  const naamCel = (titel: string, kleur?: string, sub?: string) => (
    <td className="py-1.5 pr-2 align-middle">
      <span className="flex items-center gap-2 text-sm font-medium text-slate-800 truncate">
        {kleur && <span className={`inline-block w-3 h-3 shrink-0 rounded border ${kleur}`} />}
        {titel}
      </span>
      {sub && <span className="block text-[11px] text-slate-400 truncate">{sub}</span>}
    </td>
  );
  const persoonVakje = (p: Persoon, d: DagOverzicht, titel?: string) => (
    <PersoonVakje persoon={p} kleur={kleurVan(p.name)} stand={d.standen.get(p.name) as DagInvulling} plaatsing={d.plaatsing.get(p.name)}
      plekNaam={plekNaam} titel={titel} onClick={() => setOpen({ persoon: p.name, datum: d.datum })} />
  );

  const perPlek = (
    <table className="w-full table-fixed border-collapse min-w-[48rem]">
      {kolommen}
      {kop(t("werkplekken.plek"))}
      <tbody>
        {perRuimte(werkplekken.filter((w) => w.actief)).map((g) => [
          groepsRij(`r-${g.ruimte}`, g.ruimte, t("werkplekken.aantal_plekken", { count: g.plekken.length })),
          ...g.plekken.map((w) => {
            const eigenaar = persoonVan(w.vaste_persoon);
            return (
              <tr key={w.name} className="border-b border-slate-100">
                {naamCel(w.plek, undefined, t(eigenaar ? "werkplekken.soort.vast" : "werkplekken.soort.flex"))}
                {week.map((d) => {
                  const hier = [...d.plaatsing.values()].filter((pl) => pl.werkplek === w.name);
                  return (
                    <td key={d.datum} className="p-1 align-top space-y-1">
                      {hier.length > 0 ? hier.map((pl) => {
                        const p = persoonVan(pl.persoon) as Persoon;
                        return <div key={pl.persoon}>{persoonVakje(p, d, p.naam)}</div>;
                      }) : (
                        <VrijePlek eigenaar={eigenaar} dag={d}
                          onNeerzetten={eigenaar ? undefined : () => setNeerzetten({ werkplek: w.name, datum: d.datum })} />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          }),
        ])}
        <ZonderPlek week={week} personen={actief} persoonVakje={persoonVakje} />
      </tbody>
    </table>
  );

  const groepen: { groep: PersoonGroep; mensen: Persoon[] }[] = (["vast", "flex"] as PersoonGroep[])
    .map((groep) => ({ groep, mensen: actief.filter((p) => groepVan(p, werkplekken) === groep) }))
    .filter((g) => g.mensen.length > 0);

  const perPersoon = (
    <table className="w-full table-fixed border-collapse min-w-[48rem]">
      {kolommen}
      {kop(t("werkplekken.persoon"))}
      <tbody>
        {groepen.map((g) => [
          groepsRij(`g-${g.groep}`, t(`werkplekken.groep.${g.groep}`)),
          ...g.mensen.map((p) => {
            return (
              <tr key={p.name} className="border-b border-slate-100">
                {naamCel(p.naam, kleurVan(p.name))}
                {week.map((d) => <td key={d.datum} className="p-1 align-top">{persoonVakje(p, d)}</td>)}
              </tr>
            );
          }),
        ])}
      </tbody>
    </table>
  );

  const openPersoon = open ? persoonVan(open.persoon) : undefined;
  const openDag = open ? week.find((d) => d.datum === open.datum) : undefined;
  const neerzetPlek = neerzetten ? werkplekken.find((w) => w.name === neerzetten.werkplek) : undefined;
  const neerzetDag = neerzetten ? week.find((d) => d.datum === neerzetten.datum) : undefined;
  const leeg = werkplekken.length === 0 && personen.length === 0;

  return (
    <div className="p-3 sm:p-6">
      {header}

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => verschuif(-1)} className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 cursor-pointer" aria-label={t("werkplekken.vorige_week")}><ChevronLeft size={16} /></button>
          <span className="px-2 text-sm font-medium text-slate-700 tabular-nums">
            {t("werkplekken.week", { nr: weekNummer(maandag) })} · {datumTekst(dagen[0])} – {datumTekst(dagen[4])}
          </span>
          <button type="button" onClick={() => verschuif(1)} className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 cursor-pointer" aria-label={t("werkplekken.volgende_week")}><ChevronRight size={16} /></button>
          {!dagen.includes(vandaag) && (
            <button type="button" onClick={() => setMaandag(maandagVan(new Date()))} className="ml-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 cursor-pointer">{t("werkplekken.deze_week")}</button>
          )}
        </div>
        <div className="inline-flex border border-slate-200 rounded-lg overflow-hidden bg-white" role="group" aria-label={t("werkplekken.weergave")}>
          <button type="button" onClick={() => switchView("plek")} aria-pressed={view === "plek"}
            className={`px-3 py-2 text-sm cursor-pointer ${view === "plek" ? "bg-y-teal/10 text-y-teal font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
            {t("werkplekken.per_plek")}
          </button>
          <button type="button" onClick={() => switchView("persoon")} aria-pressed={view === "persoon"}
            className={`px-3 py-2 text-sm cursor-pointer border-l border-slate-200 ${view === "persoon" ? "bg-y-teal/10 text-y-teal font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
            {t("werkplekken.per_persoon")}
          </button>
        </div>
      </div>

      {leeg ? (
        <div className="py-12 text-center text-slate-500 text-sm space-y-3">
          <p>{t("werkplekken.leeg")}</p>
          <button type="button" onClick={() => setBeheer(true)} className="px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer text-sm font-medium">{t("werkplekken.beheer")}</button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">{view === "plek" ? perPlek : perPersoon}</div>
          <Legenda />
        </>
      )}

      {open && openPersoon && openDag && (
        <DagDialog key={`${open.persoon}-${open.datum}`} persoon={openPersoon} datum={open.datum} dag={openDag.dag}
          boekingen={boekingen.filter((b) => b.persoon === open.persoon && b.datum === open.datum)}
          plaatsing={openDag.plaatsing.get(open.persoon)} plekNaam={plekNaam} stand={openDag.standen.get(open.persoon)}
          apps={appsVanPersoon(apps, open.persoon).map((x) => x.naam)}
          taken={taken} projecten={projecten} vrijdag={dagen[4]} datumTekst={datumTekst}
          onClose={() => setOpen(null)} onChanged={fetchAll} />
      )}
      {neerzetten && neerzetPlek && neerzetDag && (
        <IemandNeerzetten werkplek={neerzetPlek} datum={neerzetten.datum} datumTekst={datumTekst}
          personen={actief.filter((p) => groepVan(p, werkplekken) === "flex")}
          standen={neerzetDag.standen} boekingen={boekingen} onClose={() => setNeerzetten(null)} onChanged={fetchAll} />
      )}
      {beheer && (
        <Beheer personen={personen} werkplekken={werkplekken} onClose={() => setBeheer(false)} onChanged={fetchAll} />
      )}
    </div>
  );
}

/**
 * Een plek waar die dag niemand zit. Op een vrije flexplek kun je iemand
 * neerzetten; een vaste plek blijft van de eigenaar, dus daar niet. Staat nog
 * open of de eigenaar komt, dan staat zijn of haar naam er met een vraagteken.
 */
function VrijePlek({ eigenaar, dag, onNeerzetten }: { eigenaar: Persoon | undefined; dag: DagOverzicht; onNeerzetten?: () => void }) {
  const { t } = useTranslation();
  const s = eigenaar ? dag.standen.get(eigenaar.name)?.stand : undefined;
  if (eigenaar && (s === "keuze" || s === "onbekend")) return <Kader klasse={VAKJE.open} titel={`${eigenaar.naam}?`} />;
  // Waarom een vaste plek leeg is, hoort zichtbaar te zijn; anders lijkt een
  // ingestelde thuiswerkdag niet opgeslagen.
  if (eigenaar && s === "thuis") return <Kader klasse={VAKJE.thuis} titel={`${eigenaar.naam} · ${t("werkplekken.thuis")}`} />;
  if (eigenaar && s === "afwezig") return <Kader klasse={VAKJE.vrij} titel={`${eigenaar.naam} · ${t("werkplekken.afwezig")}`} />;
  return <Kader klasse={VAKJE.vrij} titel={t("werkplekken.vrij")} onClick={onNeerzetten} label={onNeerzetten ? t("werkplekken.iemand_neerzetten") : undefined} />;
}

/** Wie op kantoor is maar geen plek kreeg, of dubbel geboekt staat. Alleen zichtbaar als dat zo is. */
function ZonderPlek({ week, personen, persoonVakje }: {
  week: DagOverzicht[]; personen: Persoon[]; persoonVakje: (p: Persoon, d: DagOverzicht, titel?: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const perDag = week.map((d) => personen.filter((p) => {
    const pl = d.plaatsing.get(p.name);
    return pl && (!pl.werkplek || pl.reden === "dubbel");
  }));
  if (perDag.every((l) => l.length === 0)) return null;
  return (
    <tr className="border-b border-slate-100">
      <td className="py-1.5 pr-2 align-top text-sm font-medium text-red-700">{t("werkplekken.geen_plek")}</td>
      {week.map((d, i) => (
        <td key={d.datum} className="p-1 align-top space-y-1">
          {perDag[i].map((p) => <div key={p.name}>{persoonVakje(p, d, p.naam)}</div>)}
        </td>
      ))}
    </tr>
  );
}

function Legenda() {
  const { t } = useTranslation();
  const item = (klasse: string, label: string) => (
    <span className="inline-flex items-center gap-1.5"><span className={`inline-block w-3 h-3 rounded border ${klasse}`} />{label}</span>
  );
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
      {item(VAKJE.thuis, t("werkplekken.legenda.thuis"))}
      {item(VAKJE.open, t("werkplekken.legenda.open"))}
      {item(VAKJE.vrij, t("werkplekken.legenda.vrij"))}
      {item(VAKJE.fout, t("werkplekken.geen_plek"))}
      <span className="inline-flex items-center gap-1.5"><CalendarDays size={12} />{t("werkplekken.legenda.agenda")}</span>
    </div>
  );
}
