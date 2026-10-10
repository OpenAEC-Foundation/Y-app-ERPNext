import { useCallback, useEffect, useMemo, useState } from "react";
import { Map as MapIcon, RefreshCw, Plus, CheckCircle2, Circle, AlertTriangle, X } from "lucide-react";
import { useEmployees } from "../lib/DataContext";
import {
  eindeVanMaand, groepeerPerMaand, isAchterstand, isKlaar, laadMijlpalen, laadProducten,
  maakMijlpaal, maakRoadmapProject, maandenTussen, vindRoadmapProject, voortgang, zetKlaar,
  type Mijlpaal, type RoadmapProject,
} from "../lib/roadmap";

const MAANDNAMEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli",
  "augustus", "september", "oktober", "november", "december"];

/** Vaste kleurvolgorde voor producten, toegekend op alfabet zodat een product zijn kleur houdt. */
const PRODUCTKLEUREN = [
  "bg-blue-100 text-blue-800", "bg-orange-100 text-orange-800", "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800", "bg-pink-100 text-pink-800", "bg-violet-100 text-violet-800",
  "bg-red-100 text-red-800", "bg-cyan-100 text-cyan-800",
];

function maandLabel(maand: string): string {
  const [j, m] = maand.split("-").map(Number);
  return `${MAANDNAMEN[m - 1]} ${j}`;
}

function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Roadmap() {
  const medewerkers = useEmployees();
  const [project, setProject] = useState<RoadmapProject | null>(null);
  const [mijlpalen, setMijlpalen] = useState<Mijlpaal[]>([]);
  const [producten, setProducten] = useState<string[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [nieuwIn, setNieuwIn] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const p = await vindRoadmapProject();
      setProject(p);
      const [m, prod] = await Promise.all([p ? laadMijlpalen(p.name) : Promise.resolve([]), laadProducten().catch(() => [])]);
      setMijlpalen(m);
      setProducten(prod);
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => { void laad(); }, [laad]);

  const maanden = useMemo(
    () => (project ? maandenTussen(project.expected_start_date, project.expected_end_date) : []),
    [project],
  );
  const perMaand = useMemo(() => groepeerPerMaand(mijlpalen, maanden), [mijlpalen, maanden]);
  const kleurVan = useMemo(() => {
    const namen = [...new Set(mijlpalen.map((m) => m.type).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return (type: string) => PRODUCTKLEUREN[namen.indexOf(type) % PRODUCTKLEUREN.length] ?? "bg-slate-100 text-slate-700";
  }, [mijlpalen]);
  const persoon = useCallback((user: string) => {
    const mw = medewerkers.find((e) => e.user_id === user || e.company_email === user);
    return { naam: mw?.employee_name || user, foto: mw?.image || "" };
  }, [medewerkers]);

  async function wissel(mp: Mijlpaal) {
    const klaar = !isKlaar(mp.status);
    setMijlpalen((lijst) => lijst.map((m) => (m.name === mp.name ? { ...m, status: klaar ? "Completed" : "Open" } : m)));
    try {
      await zetKlaar(mp.name, klaar, mp.eigenaren);
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
      void laad();
    }
  }

  const totaal = voortgang(maanden.flatMap((m) => perMaand[m] ?? []));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MapIcon className="text-y-teal" size={24} />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Roadmap</h1>
            <p className="text-sm text-slate-500">
              {project ? `${project.project_name} · ${totaal.klaar} van ${totaal.totaal} mijlpalen klaar` : "Productmijlpalen per maand"}
            </p>
          </div>
        </div>
        <button onClick={() => void laad()} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Vernieuwen">
          <RefreshCw size={18} className={laden ? "animate-spin" : ""} />
        </button>
      </div>

      {fout && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{fout}</div>}

      {!laden && !project && (
        <GeenRoadmap onGemaakt={() => void laad()} />
      )}

      {project && (
        <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.max(maanden.length, 1)}, minmax(260px, 1fr))` }}>
          {maanden.map((maand) => {
            const lijst = perMaand[maand] ?? [];
            const v = voortgang(lijst);
            return (
              <section key={maand} className="rounded-xl bg-slate-50 border border-slate-200 flex flex-col">
                <header className="px-4 pt-4 pb-3">
                  <div className="flex items-baseline justify-between">
                    <h2 className="font-semibold text-slate-800 capitalize">Eind {maandLabel(maand)}</h2>
                    <span className="text-xs text-slate-500">{v.klaar} / {v.totaal}</span>
                  </div>
                  <div className="h-1.5 mt-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-y-teal" style={{ width: v.totaal ? `${(100 * v.klaar) / v.totaal}%` : "0%" }} />
                  </div>
                </header>
                <div className="px-3 pb-3 space-y-2 flex-1">
                  {lijst.map((mp) => {
                    const klaar = isKlaar(mp.status);
                    const achter = isAchterstand(mp, vandaag());
                    return (
                      <article key={mp.name}
                        className={`rounded-lg bg-white border px-3 py-2.5 shadow-sm ${achter ? "border-red-300" : "border-slate-200"}`}>
                        <div className="flex items-start gap-2">
                          <button onClick={() => void wissel(mp)} className="mt-0.5 shrink-0"
                            title={klaar ? "Terug naar open" : "Markeren als klaar"}>
                            {klaar ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Circle size={18} className="text-slate-400" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium ${klaar ? "line-through text-slate-400" : "text-slate-800"}`}>{mp.subject}</p>
                            <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                              {mp.type && <span className={`text-[11px] px-2 py-0.5 rounded-full ${kleurVan(mp.type)}`}>{mp.type}</span>}
                              {achter && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 inline-flex items-center gap-1">
                                  <AlertTriangle size={11} /> achterstand
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex -space-x-1.5 shrink-0">
                            {mp.eigenaren.map((u) => {
                              const p = persoon(u);
                              return p.foto
                                ? <img key={u} src={p.foto} alt={p.naam} title={p.naam} className="w-6 h-6 rounded-full border-2 border-white object-cover" />
                                : <span key={u} title={p.naam} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 text-[10px] font-semibold text-slate-600 flex items-center justify-center">
                                    {p.naam.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                                  </span>;
                            })}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {lijst.length === 0 && <p className="text-xs text-slate-400 px-1 py-2">Nog geen mijlpalen.</p>}
                </div>
                <button onClick={() => setNieuwIn(maand)}
                  className="mx-3 mb-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-500 hover:bg-white hover:text-slate-700">
                  <Plus size={15} /> Mijlpaal
                </button>
              </section>
            );
          })}
        </div>
      )}

      {project && nieuwIn && (
        <NieuweMijlpaal
          maand={nieuwIn}
          project={project.name}
          producten={producten}
          medewerkers={medewerkers.filter((m) => m.status === "Active" && (m.user_id || m.company_email))
            .map((m) => ({ user: m.user_id || m.company_email, naam: m.employee_name }))
            .sort((a, b) => a.naam.localeCompare(b.naam))}
          onSluit={() => setNieuwIn(null)}
          onGemaakt={() => { setNieuwIn(null); void laad(); }}
        />
      )}
    </div>
  );
}

function GeenRoadmap({ onGemaakt }: { onGemaakt: () => void }) {
  const jaar = new Date().getFullYear();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  async function maak() {
    setBezig(true);
    try {
      await maakRoadmapProject(`Roadmap ${jaar}`, `${jaar}-10-01`, `${jaar}-12-31`);
      onGemaakt();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
      setBezig(false);
    }
  }
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
      <p className="text-slate-600">Er is nog geen roadmap. Een roadmap is een project waarvan de naam met &ldquo;Roadmap&rdquo; begint.</p>
      <button onClick={() => void maak()} disabled={bezig}
        className="inline-flex items-center gap-2 rounded-lg bg-y-teal text-white px-4 py-2 text-sm disabled:opacity-50">
        <Plus size={16} /> Roadmap {jaar} aanmaken
      </button>
      {fout && <p className="text-sm text-red-600">{fout}</p>}
    </div>
  );
}

function NieuweMijlpaal(props: {
  maand: string;
  project: string;
  producten: string[];
  medewerkers: { user: string; naam: string }[];
  onSluit: () => void;
  onGemaakt: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("");
  const [eigenaar, setEigenaar] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function opslaan() {
    if (!subject.trim()) return;
    setBezig(true);
    setFout(null);
    try {
      await maakMijlpaal({ project: props.project, subject: subject.trim(), type, deadline: eindeVanMaand(props.maand), eigenaar });
      props.onGemaakt();
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
      setBezig(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={props.onSluit}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Mijlpaal eind {maandLabel(props.maand)}</h3>
          <button onClick={props.onSluit} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <input autoFocus value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Wat moet er af zijn?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onKeyDown={(e) => { if (e.key === "Enter") void opslaan(); }} />
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Product (optioneel)</option>
          {props.producten.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={eigenaar} onChange={(e) => setEigenaar(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Eigenaar (optioneel)</option>
          {props.medewerkers.map((m) => <option key={m.user} value={m.user}>{m.naam}</option>)}
        </select>
        {fout && <p className="text-sm text-red-600">{fout}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={props.onSluit} className="px-3 py-2 text-sm text-slate-600">Annuleren</button>
          <button onClick={() => void opslaan()} disabled={bezig || !subject.trim()}
            className="rounded-lg bg-y-teal text-white px-4 py-2 text-sm disabled:opacity-50">Toevoegen</button>
        </div>
      </div>
    </div>
  );
}
