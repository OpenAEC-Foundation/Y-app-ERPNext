/**
 * Terugkerende afspraken: vastleggen en uitrekenen.
 *
 * Een herhalende afspraak is één document met een regel erin ("elke maandag",
 * "elke maand op de 15e"). Zowel de mailserver als ERPNext geven die reeks
 * terug als één afspraak op de oorspronkelijke begindatum; zonder
 * uitrekenen stond het wekelijkse overleg dus alleen in de allereerste week.
 * Hier staan de voorkomens binnen een periode berekend, plus de vertaling van
 * een keuze in het formulier naar een RRULE (mailserver) en naar de
 * herhaalvelden van een ERPNext-Event.
 *
 * Pure module: rekent met kalenderdatums in UTC, zodat een zomertijdwissel
 * geen afspraak een uur verzet.
 */

export type Frequentie = "daily" | "weekly" | "monthly" | "yearly";

/** Een herhaalregel zoals JMAP hem kent (RFC 8984, vereenvoudigd). */
export interface Herhaalregel {
  frequency: Frequentie;
  interval?: number;
  /** Weekdagen als "mo".."su". */
  byDay?: { day: string }[];
  /** Lokale datum(tijd) waarna de reeks stopt, inclusief. */
  until?: string;
  count?: number;
}

/** Wat je in het formulier kiest. */
export type HerhaalKeuze = "" | "daily" | "weekdays" | "weekly" | "biweekly" | "monthly" | "yearly";

export const HERHAAL_KEUZES: HerhaalKeuze[] = ["", "daily", "weekdays", "weekly", "biweekly", "monthly", "yearly"];

const DAGEN = ["su", "mo", "tu", "we", "th", "fr", "sa"];
const ERP_DAGEN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Veiligheidsgrens: nooit meer dan zoveel stappen per reeks doorlopen. */
const MAX_STAPPEN = 6000;

function dagNummer(datum: string): number {
  const [j, m, d] = datum.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(j, m - 1, d) / 86400000);
}

function datumVan(nummer: number): string {
  return new Date(nummer * 86400000).toISOString().slice(0, 10);
}

function weekdag(nummer: number): number {
  return new Date(nummer * 86400000).getUTCDay();
}

/** Maandnummer + dag → datum, of null als de dag in die maand niet bestaat (31 feb). */
function maandDatum(jaar: number, maand: number, dag: number): string | null {
  const d = new Date(Date.UTC(jaar, maand, dag));
  if (d.getUTCDate() !== dag) return null;
  return d.toISOString().slice(0, 10);
}

/** Accepteert zowel `recurrenceRules` (lijst) als het oudere `recurrenceRule` (één). */
export function normaliseerRegels(ruw: unknown): Herhaalregel[] {
  const lijst = Array.isArray(ruw) ? ruw : ruw ? [ruw] : [];
  const uit: Herhaalregel[] = [];
  for (const r of lijst) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const freq = String(o.frequency || "").toLowerCase();
    if (!["daily", "weekly", "monthly", "yearly"].includes(freq)) continue;
    const byDay = Array.isArray(o.byDay)
      ? (o.byDay as unknown[]).map((d) => ({ day: String((d as { day?: unknown })?.day || "").toLowerCase() }))
        .filter((d) => DAGEN.includes(d.day))
      : undefined;
    uit.push({
      frequency: freq as Frequentie,
      interval: Number(o.interval) > 0 ? Number(o.interval) : 1,
      byDay: byDay && byDay.length ? byDay : undefined,
      until: typeof o.until === "string" && o.until ? o.until : undefined,
      count: Number(o.count) > 0 ? Number(o.count) : undefined,
    });
  }
  return uit;
}

/**
 * De begintijden van een reeks die binnen [van, tot] vallen (datums
 * "YYYY-MM-DD", tot inclusief). `start` is de lokale begintijd van de reeks,
 * "YYYY-MM-DDTHH:MM:SS" of "YYYY-MM-DD HH:MM:SS"; de uitkomst heeft dezelfde
 * tijd en hetzelfde scheidingsteken. `uitgesloten` bevat voorkomens (zelfde
 * vorm, of alleen de datum) die uit de reeks zijn gehaald.
 */
export function voorkomens(
  start: string,
  regel: Herhaalregel,
  van: string,
  tot: string,
  uitgesloten: Iterable<string> = [],
): string[] {
  const scheiding = start.includes("T") ? "T" : " ";
  const tijd = start.length > 10 ? start.slice(11) : "";
  const maak = (datum: string) => (tijd ? `${datum}${scheiding}${tijd}` : datum);
  const weg = new Set<string>();
  for (const u of uitgesloten) weg.add(String(u).slice(0, 10));

  const eerste = dagNummer(start);
  const vanNr = dagNummer(van);
  const totNr = dagNummer(tot);
  const totRegel = regel.until ? dagNummer(regel.until) : Infinity;
  const interval = Math.max(1, regel.interval || 1);
  const uit: string[] = [];
  let geteld = 0;

  /** Eén kandidaat afhandelen; `false` betekent: stoppen. */
  const neem = (nr: number): boolean => {
    if (nr < eerste) return true;
    if (nr > totRegel || nr > totNr) return false;
    geteld += 1;
    if (regel.count && geteld > regel.count) return false;
    const datum = datumVan(nr);
    if (nr >= vanNr && !weg.has(datum)) uit.push(maak(datum));
    return true;
  };

  if (regel.frequency === "daily") {
    for (let i = 0; i < MAX_STAPPEN; i++) if (!neem(eerste + i * interval)) break;
  } else if (regel.frequency === "weekly") {
    const dagen = (regel.byDay?.map((d) => DAGEN.indexOf(d.day)) ?? [weekdag(eerste)]).sort((a, b) => {
      // Maandag eerst, zondag laatst: zo loopt de week zoals in de agenda.
      const x = (a + 6) % 7;
      const y = (b + 6) % 7;
      return x - y;
    });
    const maandag = eerste - ((weekdag(eerste) + 6) % 7);
    buiten: for (let w = 0; w < MAX_STAPPEN; w++) {
      const weekStart = maandag + w * 7 * interval;
      for (const d of dagen) {
        if (!neem(weekStart + ((d + 6) % 7))) break buiten;
      }
    }
  } else {
    const [j, m, d] = start.slice(0, 10).split("-").map(Number);
    const stapMaanden = regel.frequency === "monthly" ? interval : interval * 12;
    for (let i = 0; i < MAX_STAPPEN; i++) {
      const totaal = (m - 1) + i * stapMaanden;
      const datum = maandDatum(j + Math.floor(totaal / 12), totaal % 12, d);
      if (datum === null) continue;
      if (!neem(dagNummer(datum))) break;
    }
  }
  // De begintijd is altijd het eerste voorkomen, ook als hij niet op een van
  // de gekozen weekdagen valt (zo rekenen iCalendar en JSCalendar ook).
  const eersteDatum = datumVan(eerste);
  if (eerste >= vanNr && eerste <= totNr && !weg.has(eersteDatum) && !uit.some((u) => u.startsWith(eersteDatum))) {
    uit.unshift(maak(eersteDatum));
  }
  return uit;
}

/** Eén afspraak uit de mailserver zoals de agenda hem nodig heeft. */
export interface ReeksBron {
  start?: string;
  duur?: string;
  herhaalt?: boolean;
  herhaling?: unknown;
  uitzonderingen?: Record<string, { weg?: boolean; start?: string; duur?: string } | null>;
}

/**
 * De keren dat een mailserver-afspraak in [van, tot] valt. Zonder herhaalregel
 * is dat gewoon de afspraak zelf (`reeks: false`); met regel elk voorkomen,
 * minus wat eruit gehaald is, plus wat naar een andere tijd verzet is.
 */
export function kerenInPeriode(a: ReeksBron, van: string, tot: string): { start: string; duur?: string; reeks: boolean }[] {
  if (!a.start) return [];
  const regels = a.herhaalt ? normaliseerRegels(a.herhaling) : [];
  if (regels.length === 0) return [{ start: a.start, duur: a.duur, reeks: false }];
  const afwijkend = Object.entries(a.uitzonderingen ?? {});
  const uitgesloten = afwijkend.filter(([, v]) => !v || v.weg || v.start).map(([k]) => k);
  const starts = new Set<string>();
  for (const regel of regels) for (const s of voorkomens(a.start, regel, van, tot, uitgesloten)) starts.add(s);
  const uit = [...starts].map((start) => ({ start, duur: a.duur, reeks: true }));
  for (const [, v] of afwijkend) {
    if (!v || v.weg || !v.start) continue;
    const dag = v.start.slice(0, 10);
    if (dag >= van && dag <= tot) uit.push({ start: v.start, duur: v.duur ?? a.duur, reeks: true });
  }
  return uit.sort((x, y) => x.start.localeCompare(y.start));
}

/** De regel die bij een keuze in het formulier hoort. */
export function regelVoorKeuze(keuze: HerhaalKeuze, datum: string, tot?: string): Herhaalregel | null {
  if (!keuze) return null;
  const until = tot || undefined;
  const dag = DAGEN[weekdag(dagNummer(datum))];
  switch (keuze) {
    case "daily": return { frequency: "daily", interval: 1, until };
    case "weekdays": return { frequency: "weekly", interval: 1, byDay: ["mo", "tu", "we", "th", "fr"].map((day) => ({ day })), until };
    case "weekly": return { frequency: "weekly", interval: 1, byDay: [{ day: dag }], until };
    case "biweekly": return { frequency: "weekly", interval: 2, byDay: [{ day: dag }], until };
    case "monthly": return { frequency: "monthly", interval: 1, until };
    case "yearly": return { frequency: "yearly", interval: 1, until };
  }
  return null;
}

/**
 * De RRULE-regel voor het .ics-bestand. `heleDag` bepaalt de vorm van UNTIL:
 * bij een hele dag een datum, anders een UTC-tijd aan het eind van die dag
 * (RFC 5545 eist UTC zodra DTSTART een tijdzone heeft).
 */
export function rrule(regel: Herhaalregel, heleDag: boolean): string {
  const delen = [`FREQ=${regel.frequency.toUpperCase()}`];
  if (regel.interval && regel.interval > 1) delen.push(`INTERVAL=${regel.interval}`);
  if (regel.byDay?.length) delen.push(`BYDAY=${regel.byDay.map((d) => d.day.toUpperCase()).join(",")}`);
  if (regel.count) delen.push(`COUNT=${regel.count}`);
  if (regel.until) {
    const d = regel.until.slice(0, 10).replace(/-/g, "");
    delen.push(`UNTIL=${heleDag ? d : `${d}T235959Z`}`);
  }
  return `RRULE:${delen.join(";")}`;
}

/**
 * De herhaalvelden van een ERPNext-Event. ERPNext kent geen "om de week";
 * die keuze valt hier dus terug op wekelijks — het formulier biedt hem bij
 * ERPNext ook niet aan.
 */
export function erpHerhaalVelden(keuze: HerhaalKeuze, datum: string, tot?: string): Record<string, unknown> {
  if (!keuze) return { repeat_this_event: 0 };
  const velden: Record<string, unknown> = { repeat_this_event: 1 };
  if (tot) velden.repeat_till = tot;
  for (const d of ERP_DAGEN) velden[d] = 0;
  if (keuze === "daily") velden.repeat_on = "Daily";
  else if (keuze === "monthly") velden.repeat_on = "Monthly";
  else if (keuze === "yearly") velden.repeat_on = "Yearly";
  else {
    velden.repeat_on = "Weekly";
    if (keuze === "weekdays") for (const d of ERP_DAGEN.slice(1, 6)) velden[d] = 1;
    else velden[ERP_DAGEN[weekdag(dagNummer(datum))]] = 1;
  }
  return velden;
}

/** Een ERPNext-Event met herhaling als regel, of null als hij niet herhaalt. */
export function regelVanErpEvent(ev: Record<string, unknown>): Herhaalregel | null {
  if (!Number(ev.repeat_this_event)) return null;
  const until = typeof ev.repeat_till === "string" && ev.repeat_till ? ev.repeat_till : undefined;
  switch (String(ev.repeat_on || "")) {
    case "Daily": return { frequency: "daily", interval: 1, until };
    case "Weekly": {
      const byDay = ERP_DAGEN.map((d, i) => (Number(ev[d]) ? { day: DAGEN[i] } : null))
        .filter((x): x is { day: string } => x !== null);
      return { frequency: "weekly", interval: 1, byDay: byDay.length ? byDay : undefined, until };
    }
    case "Monthly": return { frequency: "monthly", interval: 1, until };
    case "Quarterly": return { frequency: "monthly", interval: 3, until };
    case "Half Yearly": return { frequency: "monthly", interval: 6, until };
    case "Yearly": return { frequency: "yearly", interval: 1, until };
  }
  return null;
}

/** Verschil in minuten tussen twee lokale tijden ("YYYY-MM-DD HH:MM:SS"). */
export function minutenTussen(van: string, tot: string): number {
  const ms = (s: string) => {
    const [d, t = "00:00:00"] = s.replace("T", " ").split(" ");
    const [j, m, dg] = d.split("-").map(Number);
    const [u, mi] = t.split(":").map(Number);
    return Date.UTC(j, m - 1, dg, u || 0, mi || 0);
  };
  return Math.round((ms(tot) - ms(van)) / 60000);
}

/** Lokale tijd + minuten, in dezelfde vorm terug. */
export function plusMinuten(start: string, minuten: number): string {
  const scheiding = start.includes("T") ? "T" : " ";
  const [d, t = "00:00:00"] = start.replace("T", " ").split(" ");
  const [j, m, dg] = d.split("-").map(Number);
  const [u, mi] = t.split(":").map(Number);
  const iso = new Date(Date.UTC(j, m - 1, dg, u || 0, (mi || 0) + minuten)).toISOString();
  return `${iso.slice(0, 10)}${scheiding}${iso.slice(11, 19)}`;
}
