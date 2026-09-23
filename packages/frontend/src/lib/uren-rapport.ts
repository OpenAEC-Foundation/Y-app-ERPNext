/**
 * Urenrapporten: uren bekijken per medewerker, project of activiteit, per
 * dag, week of maand, met totalen — en dat als CSV mee naar Excel.
 *
 * Pure module: de component (`components/UrenRapport.tsx`) haalt de regels op
 * en tekent de tabel; alles wat hier staat, is zonder netwerk te testen.
 *
 * Twee dingen die je niet uit de ERPNext-velden afleest:
 *
 * - **Een regel hoort bij de dag van `from_time`**, niet bij de urenstaat. Een
 *   urenstaat loopt een week of een heel jaar; de regels erin horen elk bij
 *   hun eigen dag.
 * - **De periode begrenst aan beide kanten.** Er staan regels met onmogelijke
 *   datums in (jaar 2106, 3016) uit een oude import. Wie alleen op "vanaf"
 *   filtert, telt die in elk rapport mee.
 *
 * Alle datumrekening in UTC: een rapport over een week waarin de klok verzet
 * wordt, mag geen dag kwijtraken.
 */

export interface UrenRegel {
  /** Timesheet-docname. */
  urenstaat: string;
  /** Employee-docname. */
  medewerker: string;
  medewerkerNaam: string;
  /** `yyyy-mm-dd` van `from_time`. */
  datum: string;
  van: string;
  project: string;
  activiteit: string;
  uren: number;
  declarabel: boolean;
  omschrijving: string;
}

/** Eén rij zoals de lijstquery op Timesheet met de `Timesheet Detail`-velden hem teruggeeft. */
export interface RuweUrenRij {
  name: string;
  employee?: string;
  employee_name?: string;
  from_time?: string;
  hours?: number;
  project?: string | null;
  activity_type?: string | null;
  is_billable?: number;
  description?: string | null;
}

export type PeriodeSoort = "week" | "maand" | "kwartaal" | "jaar";
export type Dimensie = "medewerker" | "project" | "activiteit" | "dag" | "week" | "maand";

const TIJD_DIMENSIES: readonly Dimensie[] = ["dag", "week", "maand"];

/* ─────────────────────────────── Datums ───────────────────────────────── */

function ontleed(datum: string): Date {
  const [j, m, d] = datum.split("-").map(Number);
  return new Date(Date.UTC(j, (m || 1) - 1, d || 1));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dagVanWeek(d: Date): number {
  // Maandag = 0 … zondag = 6.
  return (d.getUTCDay() + 6) % 7;
}

export function isoWeek(datum: string): { jaar: number; week: number } {
  const d = ontleed(datum);
  const donderdag = new Date(d);
  donderdag.setUTCDate(d.getUTCDate() - dagVanWeek(d) + 3);
  const jaar = donderdag.getUTCFullYear();
  // 4 januari valt altijd in week 1; de donderdag van die week is het anker.
  const anker = new Date(Date.UTC(jaar, 0, 4));
  anker.setUTCDate(anker.getUTCDate() - dagVanWeek(anker) + 3);
  const week = 1 + Math.round((donderdag.getTime() - anker.getTime()) / (7 * 86400000));
  return { jaar, week };
}

export function periodeVan(soort: PeriodeSoort, datum: string): { van: string; tot: string } {
  const d = ontleed(datum);
  const j = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (soort) {
    case "week": {
      const maandag = new Date(d);
      maandag.setUTCDate(d.getUTCDate() - dagVanWeek(d));
      const zondag = new Date(maandag);
      zondag.setUTCDate(maandag.getUTCDate() + 6);
      return { van: iso(maandag), tot: iso(zondag) };
    }
    case "maand":
      return { van: iso(new Date(Date.UTC(j, m, 1))), tot: iso(new Date(Date.UTC(j, m + 1, 0))) };
    case "kwartaal": {
      const begin = Math.floor(m / 3) * 3;
      return { van: iso(new Date(Date.UTC(j, begin, 1))), tot: iso(new Date(Date.UTC(j, begin + 3, 0))) };
    }
    case "jaar":
    default:
      return { van: `${j}-01-01`, tot: `${j}-12-31` };
  }
}

/** Het begin van de periode `stappen` periodes verder (of terug, bij een negatief getal). */
export function verschuif(soort: PeriodeSoort, datum: string, stappen: number): string {
  const d = ontleed(datum);
  const j = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (soort) {
    case "week": {
      const maandag = ontleed(periodeVan("week", datum).van);
      maandag.setUTCDate(maandag.getUTCDate() + 7 * stappen);
      return iso(maandag);
    }
    case "maand":
      return iso(new Date(Date.UTC(j, m + stappen, 1)));
    case "kwartaal":
      return iso(new Date(Date.UTC(j, Math.floor(m / 3) * 3 + 3 * stappen, 1)));
    case "jaar":
    default:
      return iso(new Date(Date.UTC(j + stappen, 0, 1)));
  }
}

/* ─────────────────────────────── Regels ───────────────────────────────── */

function tekstUitHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** De ruwe rijen als regels, alleen die binnen de periode en met uren. */
export function regelsUitRijen(rijen: readonly RuweUrenRij[], van: string, tot: string): UrenRegel[] {
  const uit: UrenRegel[] = [];
  for (const r of rijen) {
    const vanTijd = String(r.from_time || "");
    const datum = vanTijd.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < van || datum > tot) continue;
    const uren = Number(r.hours) || 0;
    if (uren <= 0) continue;
    uit.push({
      urenstaat: r.name,
      medewerker: String(r.employee || ""),
      medewerkerNaam: String(r.employee_name || r.employee || ""),
      datum,
      van: vanTijd,
      project: String(r.project || ""),
      activiteit: String(r.activity_type || ""),
      uren,
      declarabel: Number(r.is_billable) === 1,
      omschrijving: tekstUitHtml(String(r.description || "")),
    });
  }
  return uit;
}

/* ───────────────────────────── Draaitabel ─────────────────────────────── */

export function sleutelVan(regel: UrenRegel, dim: Dimensie): string {
  switch (dim) {
    case "medewerker": return regel.medewerker;
    case "project": return regel.project;
    case "activiteit": return regel.activiteit;
    case "dag": return regel.datum;
    case "week": {
      const { jaar, week } = isoWeek(regel.datum);
      return `${jaar}-W${String(week).padStart(2, "0")}`;
    }
    case "maand": return regel.datum.slice(0, 7);
  }
}

export interface Draaitabel {
  kolommen: string[];
  rijen: { sleutel: string; cellen: Record<string, number>; totaal: number }[];
  kolomTotalen: Record<string, number>;
  totaal: number;
}

export type Labeler = (dim: Dimensie, sleutel: string) => string;

function afronden(uren: number): number {
  return Math.round(uren * 100) / 100;
}

function vergelijk(a: string, b: string): number {
  return a.localeCompare(b, "nl", { numeric: true, sensitivity: "base" });
}

/**
 * Uren per rij × kolom. Zonder kolom (`null`) alleen een totaal per rij.
 * Rijen op hun label, kolommen in de tijd op volgorde en anders op label.
 */
export function draaitabel(
  regels: readonly UrenRegel[],
  rij: Dimensie,
  kolom: Dimensie | null,
  label: Labeler = (_dim, sleutel) => sleutel,
): Draaitabel {
  const rijen = new Map<string, { sleutel: string; cellen: Record<string, number>; totaal: number }>();
  const kolomTotalen: Record<string, number> = {};
  let totaal = 0;
  for (const r of regels) {
    const rs = sleutelVan(r, rij);
    let rijItem = rijen.get(rs);
    if (!rijItem) {
      rijItem = { sleutel: rs, cellen: {}, totaal: 0 };
      rijen.set(rs, rijItem);
    }
    if (kolom) {
      const ks = sleutelVan(r, kolom);
      rijItem.cellen[ks] = (rijItem.cellen[ks] ?? 0) + r.uren;
      kolomTotalen[ks] = (kolomTotalen[ks] ?? 0) + r.uren;
    }
    rijItem.totaal += r.uren;
    totaal += r.uren;
  }

  const lijst = [...rijen.values()].map((r) => ({
    sleutel: r.sleutel,
    cellen: Object.fromEntries(Object.entries(r.cellen).map(([k, v]) => [k, afronden(v)])),
    totaal: afronden(r.totaal),
  }));
  lijst.sort((a, b) => vergelijk(label(rij, a.sleutel), label(rij, b.sleutel)) || vergelijk(a.sleutel, b.sleutel));

  const kolommen = Object.keys(kolomTotalen);
  if (kolom && TIJD_DIMENSIES.includes(kolom)) kolommen.sort();
  else if (kolom) kolommen.sort((a, b) => vergelijk(label(kolom, a), label(kolom, b)) || vergelijk(a, b));

  return {
    kolommen,
    rijen: lijst,
    kolomTotalen: Object.fromEntries(Object.entries(kolomTotalen).map(([k, v]) => [k, afronden(v)])),
    totaal: afronden(totaal),
  };
}

/* ─────────────────────────── Labels en export ─────────────────────────── */

const WEEKDAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** Kolomkop voor een tijdsleutel; andere dimensies houden hun sleutel. */
export function tijdLabel(dim: Dimensie, sleutel: string): string {
  if (dim === "dag") {
    const d = ontleed(sleutel);
    return `${WEEKDAGEN[d.getUTCDay()]} ${sleutel.slice(8, 10)}-${sleutel.slice(5, 7)}`;
  }
  if (dim === "week") return `wk ${Number(sleutel.split("-W")[1])}`;
  if (dim === "maand") return `${MAANDEN[Number(sleutel.slice(5, 7)) - 1]} ${sleutel.slice(0, 4)}`;
  return sleutel;
}

/** Uren zoals je ze leest: decimale komma, hooguit twee decimalen, geen overbodige nullen. */
export function urenTekst(uren: number): string {
  return String(afronden(uren)).replace(".", ",");
}

/**
 * De tabel als CSV voor Excel: puntkomma als scheiding en een decimale komma,
 * zoals een Nederlandse Excel hem zonder importstappen opent.
 */
export function naarCsv(tabel: Draaitabel, rij: Dimensie, kolom: Dimensie | null, label: Labeler, kopRij: string): string {
  const veld = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const regels: string[][] = [];
  regels.push([kopRij, ...(kolom ? tabel.kolommen.map((k) => label(kolom, k)) : []), "Totaal"]);
  for (const r of tabel.rijen) {
    regels.push([
      label(rij, r.sleutel),
      ...(kolom ? tabel.kolommen.map((k) => (r.cellen[k] ? urenTekst(r.cellen[k]) : "")) : []),
      urenTekst(r.totaal),
    ]);
  }
  regels.push(["Totaal", ...(kolom ? tabel.kolommen.map((k) => urenTekst(tabel.kolomTotalen[k] ?? 0)) : []), urenTekst(tabel.totaal)]);
  return regels.map((r) => r.map(veld).join(";")).join("\r\n");
}
