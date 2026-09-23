/**
 * Urenrapporten: uren bekijken en er een overzicht van maken.
 *
 * Een draaitabel met vrij te kiezen rijen (medewerker, project, activiteit)
 * en kolommen (dag, week, maand, project, medewerker), met totalen. Elke cel
 * klikt door naar de boekingen erachter; de tabel gaat als CSV naar Excel of
 * via de printfunctie naar papier of pdf.
 *
 * Eén lijstquery voor de hele periode: Timesheet met de velden van
 * `Timesheet Detail` erbij. Het oude overzicht haalde elke urenstaat los op,
 * wat voor een kwartaal of een jaar honderden verzoeken werd. De rekenkant
 * staat in `lib/uren-rapport.ts`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Download, Loader2, Printer, X } from "lucide-react";
import { fetchList } from "../lib/erpnext";
import { useEmployees, useProjects } from "../lib/DataContext";
import { getActiveCompany } from "../lib/instances";
import { useSessionEmployeeId } from "../lib/useSessionEmployee";
import type { ViewMode } from "./Sidebar";
import {
  draaitabel,
  isoWeek,
  naarCsv,
  periodeVan,
  regelsUitRijen,
  sleutelVan,
  tijdLabel,
  urenTekst,
  verschuif,
  type Dimensie,
  type Labeler,
  type PeriodeSoort,
  type RuweUrenRij,
  type UrenRegel,
} from "../lib/uren-rapport";

type Periode = PeriodeSoort | "vrij";

const PERIODES: Periode[] = ["week", "maand", "kwartaal", "jaar", "vrij"];
const DIMENSIES: Dimensie[] = ["medewerker", "project", "activiteit", "dag", "week", "maand"];

const VELDEN = [
  "name", "employee", "employee_name",
  "`tabTimesheet Detail`.from_time as from_time",
  "`tabTimesheet Detail`.hours as hours",
  "`tabTimesheet Detail`.project as project",
  "`tabTimesheet Detail`.activity_type as activity_type",
  "`tabTimesheet Detail`.is_billable as is_billable",
  "`tabTimesheet Detail`.description as description",
];

function vandaagIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function datumKort(iso: string): string {
  return `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
}

function html(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function UrenRapport({ viewMode }: { viewMode: ViewMode }) {
  const { t } = useTranslation();
  const medewerkers = useEmployees();
  const projecten = useProjects();
  const sessieMedewerker = useSessionEmployeeId(medewerkers);
  const isMedewerker = viewMode === "employee";
  const bedrijf = getActiveCompany();

  const [periode, setPeriode] = useState<Periode>("maand");
  const [referentie, setReferentie] = useState(vandaagIso);
  const [vrijVan, setVrijVan] = useState(() => periodeVan("maand", vandaagIso()).van);
  const [vrijTot, setVrijTot] = useState(vandaagIso);
  const [rijDim, setRijDim] = useState<Dimensie>("medewerker");
  const [kolomDim, setKolomDim] = useState<Dimensie | "">("week");
  const [medewerkerFilter, setMedewerkerFilter] = useState("");
  const [projectZoek, setProjectZoek] = useState("");
  const [alleenDeclarabel, setAlleenDeclarabel] = useState(false);
  const [regels, setRegels] = useState<UrenRegel[]>([]);
  /** Voor welk bereik `regels` gelden; wijkt het af, dan wordt er geladen. */
  const [geladenVoor, setGeladenVoor] = useState("");
  const [fout, setFout] = useState("");
  const [cel, setCel] = useState<{ rij: string; kolom: string | null } | null>(null);

  const bereik = periode === "vrij" ? { van: vrijVan, tot: vrijTot } : periodeVan(periode, referentie);
  const bereikSleutel = `${bereik.van}|${bereik.tot}`;
  const bereikGeldig = Boolean(bereik.van && bereik.tot && bereik.van <= bereik.tot);
  const laden = bereikGeldig && geladenVoor !== bereikSleutel;

  useEffect(() => {
    const [van, tot] = bereikSleutel.split("|");
    if (!van || !tot || van > tot) return;
    let gestopt = false;
    fetchList<RuweUrenRij>("Timesheet", {
      fields: VELDEN,
      filters: [
        ["Timesheet Detail", "from_time", ">=", `${van} 00:00:00`],
        ["Timesheet Detail", "from_time", "<=", `${tot} 23:59:59`],
        ["docstatus", "!=", 2],
      ],
      limit_page_length: 0,
    }).then((rijen) => {
      if (gestopt) return;
      setRegels(regelsUitRijen(rijen, van, tot));
      setFout("");
      setGeladenVoor(bereikSleutel);
    }).catch((err: unknown) => {
      if (gestopt) return;
      setRegels([]);
      setFout(err instanceof Error ? err.message : String(err));
      setGeladenVoor(bereikSleutel);
    });
    return () => { gestopt = true; };
  }, [bereikSleutel]);

  /** Medewerkers van het actieve bedrijf; sommige urenstaten hebben zelf geen bedrijf ingevuld. */
  const bedrijfsMedewerkers = useMemo(() => {
    if (!bedrijf) return null;
    return new Set(medewerkers.filter((m) => m.company === bedrijf).map((m) => m.name));
  }, [medewerkers, bedrijf]);

  const naamVanMedewerker = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of medewerkers) map.set(m.name, m.employee_name);
    for (const r of regels) if (!map.has(r.medewerker)) map.set(r.medewerker, r.medewerkerNaam);
    return map;
  }, [medewerkers, regels]);

  const projectNaam = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projecten) if (p.project_name) map.set(p.name, p.project_name.trim());
    return map;
  }, [projecten]);

  const zichtbaar = useMemo(() => {
    const zoek = projectZoek.trim().toLowerCase();
    return regels.filter((r) =>
      (!bedrijfsMedewerkers || bedrijfsMedewerkers.has(r.medewerker))
      && (!isMedewerker || (sessieMedewerker !== null && sessieMedewerker !== undefined && r.medewerker === sessieMedewerker))
      && (!medewerkerFilter || r.medewerker === medewerkerFilter)
      && (!alleenDeclarabel || r.declarabel)
      && (!zoek || `${r.project} ${projectNaam.get(r.project) ?? ""}`.toLowerCase().includes(zoek)));
  }, [regels, bedrijfsMedewerkers, isMedewerker, sessieMedewerker, medewerkerFilter, alleenDeclarabel, projectZoek, projectNaam]);

  const label: Labeler = useCallback((dim, sleutel) => {
    if (dim === "medewerker") return naamVanMedewerker.get(sleutel) || sleutel;
    if (dim === "project") {
      if (!sleutel) return t("timesheets.report.no_project");
      const naam = projectNaam.get(sleutel);
      return naam ? `${sleutel} ${naam}` : sleutel;
    }
    if (dim === "activiteit") return sleutel || t("timesheets.report.no_activity");
    return tijdLabel(dim, sleutel);
  }, [naamVanMedewerker, projectNaam, t]);

  const kolom = kolomDim === "" || kolomDim === rijDim ? null : kolomDim;
  const tabel = useMemo(() => draaitabel(zichtbaar, rijDim, kolom, label), [zichtbaar, rijDim, kolom, label]);

  const samenvatting = useMemo(() => {
    let totaal = 0;
    let declarabel = 0;
    const mw = new Set<string>();
    const pr = new Set<string>();
    for (const r of zichtbaar) {
      totaal += r.uren;
      if (r.declarabel) declarabel += r.uren;
      mw.add(r.medewerker);
      if (r.project) pr.add(r.project);
    }
    return { totaal, declarabel, medewerkers: mw.size, projecten: pr.size };
  }, [zichtbaar]);

  const medewerkerOpties = useMemo(() => {
    const ids = new Set(regels.map((r) => r.medewerker));
    return [...ids]
      .filter((id) => !bedrijfsMedewerkers || bedrijfsMedewerkers.has(id))
      .map((id) => [id, naamVanMedewerker.get(id) || id] as const)
      .sort((a, b) => a[1].localeCompare(b[1], "nl"));
  }, [regels, bedrijfsMedewerkers, naamVanMedewerker]);

  const celRegels = useMemo(() => {
    if (!cel) return [];
    return zichtbaar
      .filter((r) => sleutelVan(r, rijDim) === cel.rij && (cel.kolom === null || !kolom || sleutelVan(r, kolom) === cel.kolom))
      .sort((a, b) => a.van.localeCompare(b.van));
  }, [cel, zichtbaar, rijDim, kolom]);

  const dimLabel = (d: Dimensie) => t(`timesheets.report.dim_${d}`);

  const periodeTekst = (() => {
    if (!bereikGeldig) return "";
    if (periode === "week") return `wk ${isoWeek(bereik.van).week} · ${datumKort(bereik.van)} – ${datumKort(bereik.tot)}`;
    if (periode === "maand") return tijdLabel("maand", bereik.van.slice(0, 7));
    if (periode === "kwartaal") return `Q${Math.floor(Number(bereik.van.slice(5, 7)) / 3) + 1} ${bereik.van.slice(0, 4)}`;
    if (periode === "jaar") return bereik.van.slice(0, 4);
    return `${datumKort(bereik.van)} – ${datumKort(bereik.tot)}`;
  })();

  function exporteer() {
    const csv = naarCsv(tabel, rijDim, kolom, label, dimLabel(rijDim));
    // Met BOM: anders leest Excel de é's en ë's als rommel.
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `urenrapport-${bereik.van}-${bereik.tot}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function afdrukken() {
    const venster = window.open("", "_blank");
    if (!venster) return;
    const kop = [dimLabel(rijDim), ...(kolom ? tabel.kolommen.map((k) => label(kolom, k)) : []), t("timesheets.report.total")];
    const rijen = tabel.rijen.map((r) => [
      label(rijDim, r.sleutel),
      ...(kolom ? tabel.kolommen.map((k) => (r.cellen[k] ? urenTekst(r.cellen[k]) : "")) : []),
      urenTekst(r.totaal),
    ]);
    const voet = [t("timesheets.report.total"), ...(kolom ? tabel.kolommen.map((k) => urenTekst(tabel.kolomTotalen[k] ?? 0)) : []), urenTekst(tabel.totaal)];
    const cellen = (rij: string[], tag: string) => rij.map((c, i) => `<${tag}${i > 0 ? ' class="r"' : ""}>${html(c)}</${tag}>`).join("");
    venster.document.write(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${html(t("timesheets.report.title"))} ${html(periodeTekst)}</title>
<style>body{font:12px system-ui,sans-serif;margin:24px;color:#1e293b}h1{font-size:16px;margin:0 0 4px}p{margin:0 0 12px;color:#64748b}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #e2e8f0;padding:4px 6px;text-align:left;white-space:nowrap}
th{background:#f1f5f9;font-size:11px}.r{text-align:right}tfoot td{font-weight:600;background:#f8fafc}</style></head><body>
<h1>${html(t("timesheets.report.title"))} — ${html(periodeTekst)}</h1>
<p>${html(bedrijf || "")}${medewerkerFilter ? " · " + html(naamVanMedewerker.get(medewerkerFilter) || medewerkerFilter) : ""}${alleenDeclarabel ? " · " + html(t("timesheets.report.only_billable")) : ""}</p>
<table><thead><tr>${cellen(kop, "th")}</tr></thead><tbody>${rijen.map((r) => `<tr>${cellen(r, "td")}</tr>`).join("")}</tbody>
<tfoot><tr>${cellen(voet, "td")}</tr></tfoot></table></body></html>`);
    venster.document.close();
    venster.focus();
    venster.print();
  }

  const knop = "flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer disabled:cursor-default disabled:opacity-40";
  const veld = "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-y-teal";

  return (
    <div data-urenrapport className="space-y-4">
      {/* Periode */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs">
          {PERIODES.map((p) => (
            <button key={p} type="button" aria-pressed={periode === p} onClick={() => { setPeriode(p); setCel(null); }}
              className={`cursor-pointer px-3 py-1.5 ${periode === p ? "bg-y-teal font-medium text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {t(`timesheets.report.period_${p}`)}
            </button>
          ))}
        </div>
        {periode !== "vrij" ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => { setReferentie((r) => verschuif(periode, r, -1)); setCel(null); }}
              title={t("timesheets.report.previous")} className={knop}><ChevronLeft size={14} /></button>
            <span className="min-w-[10rem] text-center text-sm font-medium text-slate-700">{periodeTekst}</span>
            <button type="button" onClick={() => { setReferentie((r) => verschuif(periode, r, 1)); setCel(null); }}
              title={t("timesheets.report.next")} className={knop}><ChevronRight size={14} /></button>
            <button type="button" onClick={() => { setReferentie(vandaagIso()); setCel(null); }} className={knop}>
              {t("timesheets.report.today")}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="date" value={vrijVan} onChange={(e) => { setVrijVan(e.target.value); setCel(null); }} className={veld} />
            <span>–</span>
            <input type="date" value={vrijTot} onChange={(e) => { setVrijTot(e.target.value); setCel(null); }} className={veld} />
          </div>
        )}
      </div>

      {/* Indeling en filters */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          {t("timesheets.report.rows")}
          <select value={rijDim} onChange={(e) => { setRijDim(e.target.value as Dimensie); setCel(null); }} className={veld}>
            {DIMENSIES.map((d) => <option key={d} value={d}>{dimLabel(d)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          {t("timesheets.report.columns")}
          <select value={kolomDim} onChange={(e) => { setKolomDim(e.target.value as Dimensie | ""); setCel(null); }} className={veld}>
            <option value="">{t("timesheets.report.only_total")}</option>
            {DIMENSIES.filter((d) => d !== rijDim).map((d) => <option key={d} value={d}>{dimLabel(d)}</option>)}
          </select>
        </label>
        {!isMedewerker && (
          <select value={medewerkerFilter} onChange={(e) => { setMedewerkerFilter(e.target.value); setCel(null); }} className={veld}>
            <option value="">{t("timesheets.report.all_employees")}</option>
            {medewerkerOpties.map(([id, naam]) => <option key={id} value={id}>{naam}</option>)}
          </select>
        )}
        <input type="search" value={projectZoek} onChange={(e) => { setProjectZoek(e.target.value); setCel(null); }}
          placeholder={t("timesheets.report.search_project")} className={`${veld} w-44`} />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={alleenDeclarabel} onChange={(e) => { setAlleenDeclarabel(e.target.checked); setCel(null); }} className="cursor-pointer" />
          {t("timesheets.report.only_billable")}
        </label>
        <div className="flex-1" />
        <button type="button" onClick={exporteer} disabled={tabel.rijen.length === 0} className={knop}>
          <Download size={13} /> {t("timesheets.report.export_csv")}
        </button>
        <button type="button" onClick={afdrukken} disabled={tabel.rijen.length === 0} className={knop}>
          <Printer size={13} /> {t("timesheets.report.print")}
        </button>
      </div>

      {/* Samenvatting */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [t("timesheets.report.total_hours"), urenTekst(samenvatting.totaal)],
          [t("timesheets.report.billable_hours"), `${urenTekst(samenvatting.declarabel)}${samenvatting.totaal > 0 ? ` (${Math.round((samenvatting.declarabel / samenvatting.totaal) * 100)}%)` : ""}`],
          [t("timesheets.report.employees_count"), String(samenvatting.medewerkers)],
          [t("timesheets.report.projects_count"), String(samenvatting.projecten)],
        ].map(([kop, waarde]) => (
          <div key={kop} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="text-[11px] text-slate-500">{kop}</div>
            <div className="text-lg font-semibold text-slate-800">{waarde}</div>
          </div>
        ))}
      </div>

      {isMedewerker && !sessieMedewerker && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("timesheets.report.no_employee_link")}</p>
      )}
      {fout && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{t("timesheets.report.load_failed", { error: fout })}</p>
      )}

      {/* Draaitabel */}
      {laden ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> {t("common.loading")}
        </div>
      ) : tabel.rijen.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">{t("timesheets.report.no_hours")}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table data-urentabel className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-medium">{dimLabel(rijDim)}</th>
                {kolom && tabel.kolommen.map((k) => (
                  <th key={k} className="whitespace-nowrap px-2 py-2 text-right font-medium">{label(kolom, k)}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold text-slate-700">{t("timesheets.report.total")}</th>
              </tr>
            </thead>
            <tbody>
              {tabel.rijen.map((r) => (
                <tr key={r.sleutel} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="sticky left-0 z-10 max-w-[18rem] truncate bg-white px-3 py-1.5 text-slate-700" title={label(rijDim, r.sleutel)}>
                    {label(rijDim, r.sleutel)}
                  </td>
                  {kolom && tabel.kolommen.map((k) => (
                    <td key={k} className="px-1 py-0.5 text-right">
                      {r.cellen[k] ? (
                        <button type="button" onClick={() => setCel({ rij: r.sleutel, kolom: k })}
                          className={`w-full cursor-pointer rounded px-1.5 py-1 text-right tabular-nums hover:bg-y-teal/10 ${
                            cel?.rij === r.sleutel && cel?.kolom === k ? "bg-y-teal/15 font-semibold" : ""
                          }`}>
                          {urenTekst(r.cellen[k])}
                        </button>
                      ) : null}
                    </td>
                  ))}
                  <td className="px-1 py-0.5 text-right">
                    <button type="button" onClick={() => setCel({ rij: r.sleutel, kolom: null })}
                      className="w-full cursor-pointer rounded px-2 py-1 text-right font-semibold tabular-nums text-slate-800 hover:bg-y-teal/10">
                      {urenTekst(r.totaal)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
              <tr>
                <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2">{t("timesheets.report.total")}</td>
                {kolom && tabel.kolommen.map((k) => (
                  <td key={k} className="px-2 py-2 text-right tabular-nums">{urenTekst(tabel.kolomTotalen[k] ?? 0)}</td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{urenTekst(tabel.totaal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Boekingen achter een cel */}
      {cel && celRegels.length > 0 && (
        <div data-urenboekingen className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-medium text-slate-700">
              {t("timesheets.report.details")}: {label(rijDim, cel.rij)}{cel.kolom && kolom ? ` · ${label(kolom, cel.kolom)}` : ""}
              {" · "}{urenTekst(celRegels.reduce((s, r) => s + r.uren, 0))} {t("timesheets.report.hours_short")}
            </span>
            <div className="flex-1" />
            <button type="button" onClick={() => setCel(null)} title={t("common.close")}
              className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={14} /></button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">{t("timesheets.report.col_date")}</th>
                  <th className="px-3 py-1.5 text-left font-medium">{t("timesheets.report.col_employee")}</th>
                  <th className="px-3 py-1.5 text-left font-medium">{t("timesheets.report.col_project")}</th>
                  <th className="px-3 py-1.5 text-left font-medium">{t("timesheets.report.col_activity")}</th>
                  <th className="px-3 py-1.5 text-right font-medium">{t("timesheets.report.col_hours")}</th>
                  <th className="px-3 py-1.5 text-left font-medium">{t("timesheets.report.col_description")}</th>
                </tr>
              </thead>
              <tbody>
                {celRegels.map((r, i) => (
                  <tr key={`${r.urenstaat}-${r.van}-${i}`} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{datumKort(r.datum)} {r.van.slice(11, 16)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">{label("medewerker", r.medewerker)}</td>
                    <td className="max-w-[16rem] truncate px-3 py-1.5 text-slate-700" title={label("project", r.project)}>{label("project", r.project)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{label("activiteit", r.activiteit)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">{urenTekst(r.uren)}</td>
                    <td className="max-w-[20rem] truncate px-3 py-1.5 text-slate-500" title={r.omschrijving}>{r.omschrijving}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
