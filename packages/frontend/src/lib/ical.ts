/**
 * iCalendar schrijven en lezen voor agenda-uitnodigingen.
 *
 * Waarom dit er is: de mailserver neemt genodigden alleen aan via CalDAV, waar
 * je een ruw `.ics`-bestand neerlegt. Via JMAP — waar de agenda's mee gelezen
 * worden — verdwijnen ze stilzwijgend: de afspraak wordt aangemaakt, de
 * `participants` komen leeg terug. Lezen gaat dus over JMAP, schrijven over
 * CalDAV, en dit bestand maakt wat daar heen moet.
 *
 * Pure module: geen netwerk, geen React. De opmaakregels van RFC 5545 zijn
 * precies het soort ding dat stil fout gaat (een dubbele punt in een titel,
 * een regel langer dan 75 octetten, een tijdzone die niet meegaat), en dat wil
 * je met een test kunnen vastleggen in plaats van in een agenda ontdekken.
 */

import { rrule, type Herhaalregel } from "./agenda-herhaling.ts";

export type Deelnamestatus = "needs-action" | "accepted" | "declined" | "tentative";

export interface Genodigde {
  email: string;
  naam?: string;
  status?: Deelnamestatus;
}

export interface AfspraakInvoer {
  /** Blijft gelijk over alle kopieën van dezelfde afspraak — daar hangt alles aan. */
  uid: string;
  titel: string;
  /** Lokale tijd zonder zone-achtervoegsel: `2026-09-10T10:00:00`. */
  start: string;
  eind: string;
  /** IANA-zone; bij een hele dag doet hij niet mee. */
  tijdzone?: string;
  heleDag?: boolean;
  omschrijving?: string;
  locatie?: string;
  organisator: Genodigde;
  genodigden?: Genodigde[];
  /** Volgnummer; hoger betekent "dit is de nieuwere versie van deze afspraak". */
  volgnummer?: number;
  /** Terugkerende afspraak: de regel gaat als RRULE mee. */
  herhaling?: Herhaalregel;
}

const PARTSTAT: Record<Deelnamestatus, string> = {
  "needs-action": "NEEDS-ACTION",
  accepted: "ACCEPTED",
  declined: "DECLINED",
  tentative: "TENTATIVE",
};

/**
 * Bouwt het `.ics`-bestand van één afspraak.
 *
 * `METHOD:REQUEST` staat erin zodra er genodigden zijn: dat is wat een
 * mailprogramma het verschil laat zien tussen "in mijn agenda gezet" en "je
 * bent hiervoor uitgenodigd, laat weten of je komt".
 */
export function bouwAfspraakIcs(afspraak: AfspraakInvoer, nu: Date = new Date()): string {
  const genodigden = afspraak.genodigden ?? [];
  const regels: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//3BM//Y-Next//NL",
    "CALSCALE:GREGORIAN",
  ];
  if (genodigden.length > 0) regels.push("METHOD:REQUEST");
  regels.push(
    "BEGIN:VEVENT",
    `UID:${afspraak.uid}`,
    `DTSTAMP:${utcStempel(nu)}`,
    `SEQUENCE:${afspraak.volgnummer ?? 0}`,
    ...tijdRegels(afspraak),
    ...(afspraak.herhaling ? [rrule(afspraak.herhaling, !!afspraak.heleDag)] : []),
    `SUMMARY:${ontsnap(afspraak.titel)}`,
  );
  if (afspraak.omschrijving) regels.push(`DESCRIPTION:${ontsnap(afspraak.omschrijving)}`);
  if (afspraak.locatie) regels.push(`LOCATION:${ontsnap(afspraak.locatie)}`);
  /*
   * ORGANIZER alleen bij een afspraak met genodigden. iCalendar schrijft die
   * regel voor bij een groepsafspraak; bij een afspraak die alleen van jou is
   * hoort hij er niet, en hij richt daar schade aan: van een ORGANIZER zonder
   * ATTENDEE maakt de mailserver een deelnemer zonder rol en zonder stand,
   * waarna de app je eigen afspraak las als een uitnodiging aan jezelf waarop
   * je nog moest antwoorden - met een knop die niets kon doen.
   */
  if (genodigden.length > 0) {
    regels.push(persoonRegel("ORGANIZER", afspraak.organisator, "CHAIR"));
    for (const g of genodigden) regels.push(persoonRegel("ATTENDEE", g, "REQ-PARTICIPANT"));
  }
  regels.push("END:VEVENT", "END:VCALENDAR");

  // CRLF is voorgeschreven, en de afsluitende regeleinde hoort erbij.
  return vulTijdzonesAan(regels).flatMap(vouw).join("\r\n") + "\r\n";
}

function tijdRegels(a: AfspraakInvoer): string[] {
  if (a.heleDag) {
    // Bij een hele dag is DTEND exclusief: een dag duurt tot de volgende.
    return [
      `DTSTART;VALUE=DATE:${datumDeel(a.start)}`,
      `DTEND;VALUE=DATE:${datumDeel(volgendeDag(a.eind))}`,
    ];
  }
  const zone = a.tijdzone ? `;TZID=${a.tijdzone}` : "";
  return [
    `DTSTART${zone}:${lokaleStempel(a.start)}`,
    `DTEND${zone}:${lokaleStempel(a.eind)}`,
  ];
}

function persoonRegel(soort: "ORGANIZER" | "ATTENDEE", p: Genodigde, rol: string): string {
  const delen: string[] = [soort];
  if (p.naam) delen.push(`CN=${ontsnapParam(p.naam)}`);
  if (soort === "ATTENDEE") {
    delen.push(`ROLE=${rol}`);
    delen.push(`PARTSTAT=${PARTSTAT[p.status ?? "needs-action"]}`);
    // RSVP alleen zolang er nog geen antwoord is; anders blijft een
    // mailprogramma om een reactie vragen die al gegeven is.
    if ((p.status ?? "needs-action") === "needs-action") delen.push("RSVP=TRUE");
  }
  return `${delen.join(";")}:mailto:${p.email}`;
}

/* ────────────────────────────── Antwoorden ───────────────────────────── */

/**
 * Zet de deelnamestatus van één genodigde om, in een bestaand `.ics`. De rest
 * van het bestand blijft letterlijk staan.
 *
 * Waarom niet opnieuw opbouwen uit gelezen velden: dan zou alles wat we níet
 * kennen — herhalingen, herinneringen, bijlagen, velden van andere
 * agendaprogramma's — bij het accepteren verdwijnen. Een antwoord hoort één
 * regel te veranderen en verder niets.
 */
export function zetDeelname(ics: string, email: string, status: Deelnamestatus): string {
  const doel = email.trim().toLowerCase();
  const uit = ontvouw(ics).map((regel) => {
    if (!regel.toUpperCase().startsWith("ATTENDEE")) return regel;
    if (adresVanRegel(regel) !== doel) return regel;
    let nieuw = vervangParam(regel, "PARTSTAT", PARTSTAT[status]);
    // Antwoord gegeven: de vraag om een reactie kan weg.
    nieuw = verwijderParam(nieuw, "RSVP");
    return nieuw;
  });
  // Een antwoord is geen nieuw verzoek meer.
  const metMethode = uit.map((r) => (r.toUpperCase().startsWith("METHOD:") ? "METHOD:REPLY" : r));
  return metMethode.flatMap(vouw).join("\r\n") + "\r\n";
}

/** Het e-mailadres uit een ORGANIZER- of ATTENDEE-regel, in kleine letters. */
/**
 * Van een afspraak een afzegging maken: `METHOD:CANCEL`, `STATUS:CANCELLED`
 * en een volgnummer dat hoger is dan dat van de uitnodiging.
 *
 * Een afspraak met genodigden intrekken hoort volgens de norm zo'n bericht te
 * zijn en geen stille verwijdering. Wie van buiten 3BM komt heeft hier geen
 * agenda die wij kunnen bijwerken; zonder afzegging blijft de afspraak bij hem
 * gewoon staan. Het hogere volgnummer is geen detail: een agendaprogramma
 * negeert een bericht dat niet nieuwer is dan wat het al heeft.
 *
 * Alleen die drie regels veranderen; genodigden, tijden en al het andere
 * blijven staan, zodat de ontvanger herkent welke afspraak het betreft.
 */
export function maakAfzegging(ics: string): string {
  const regels = ontvouw(ics).filter((r) => r !== "");
  const uit: string[] = [];
  let inEvent = false;
  let heeftMethode = false;
  let heeftVolgnummer = false;
  for (const regel of regels) {
    const boven = regel.toUpperCase();
    if (boven.startsWith("METHOD:")) {
      if (!heeftMethode) uit.push("METHOD:CANCEL");
      heeftMethode = true;
      continue;
    }
    if (boven === "BEGIN:VEVENT") {
      if (!heeftMethode) {
        // METHOD hoort in de kalender, vóór de afspraak.
        uit.push("METHOD:CANCEL");
        heeftMethode = true;
      }
      inEvent = true;
      uit.push(regel);
      continue;
    }
    if (inEvent && boven.startsWith("STATUS:")) continue;
    if (inEvent && boven.startsWith("SEQUENCE:")) {
      const nu = parseInt(regel.slice(regel.indexOf(":") + 1), 10);
      uit.push(`SEQUENCE:${Number.isFinite(nu) ? nu + 1 : 1}`);
      heeftVolgnummer = true;
      continue;
    }
    if (boven === "END:VEVENT") {
      if (!heeftVolgnummer) uit.push("SEQUENCE:1");
      uit.push("STATUS:CANCELLED");
      inEvent = false;
      uit.push(regel);
      continue;
    }
    uit.push(regel);
  }
  // Een afspraak die zonder VTIMEZONE op de mailserver staat, krijgt er hier
  // alsnog een; anders verschuift de afzegging net zo als de uitnodiging.
  return vulTijdzonesAan(uit).flatMap(vouw).join("\r\n") + "\r\n";
}

export function adresVanRegel(regel: string): string {
  const i = regel.lastIndexOf(":");
  if (i < 0) return "";
  return regel.slice(i + 1).replace(/^mailto:/i, "").trim().toLowerCase();
}

/* ───────────────────────────────── Lezen ─────────────────────────────── */

export interface GelezenAfspraak {
  uid?: string;
  titel?: string;
  organisator?: string;
  genodigden: Genodigde[];
  methode?: string;
  volgnummer: number;
  /** Lokale start als `2026-09-10T16:00:00`; bij een hele dag `2026-09-10`. */
  start?: string;
  eind?: string;
  heleDag?: boolean;
  locatie?: string;
  omschrijving?: string;
}

/**
 * Leest er precies uit wat de app nodig heeft om een uitnodiging te tonen en
 * te beantwoorden. Geen volledige parser: de rest van het bestand gaat
 * ongelezen weer terug naar de server.
 */
export function leesAfspraakIcs(ics: string): GelezenAfspraak {
  const uit: GelezenAfspraak = { genodigden: [], volgnummer: 0 };
  for (const regel of ontvouw(ics)) {
    const boven = regel.toUpperCase();
    if (boven.startsWith("UID:")) uit.uid = regel.slice(4).trim();
    else if (boven.startsWith("SUMMARY")) uit.titel = ontsnapTerug(waardeVan(regel));
    else if (boven.startsWith("METHOD:")) uit.methode = regel.slice(7).trim().toUpperCase();
    else if (boven.startsWith("SEQUENCE:")) uit.volgnummer = Number(regel.slice(9).trim()) || 0;
    else if (boven.startsWith("LOCATION")) uit.locatie = ontsnapTerug(waardeVan(regel));
    else if (boven.startsWith("DESCRIPTION")) uit.omschrijving = ontsnapTerug(waardeVan(regel));
    else if (boven.startsWith("DTSTART")) {
      const gelezen = leesTijdstip(regel);
      uit.start = gelezen.waarde;
      uit.heleDag = gelezen.heleDag;
    } else if (boven.startsWith("DTEND")) {
      uit.eind = leesTijdstip(regel).waarde;
    }
    else if (boven.startsWith("ORGANIZER")) uit.organisator = adresVanRegel(regel);
    else if (boven.startsWith("ATTENDEE")) {
      uit.genodigden.push({
        email: adresVanRegel(regel),
        naam: ontsnapParamTerug(paramVan(regel, "CN")),
        status: statusVanParam(paramVan(regel, "PARTSTAT")),
      });
    }
  }
  return uit;
}

/**
 * Een DTSTART- of DTEND-regel naar een leesbare lokale tijd.
 *
 * Drie vormen komen voor. `VALUE=DATE` is een hele dag. Een tijd met een `Z`
 * staat in UTC en wordt naar de tijd van dit apparaat gehaald — anders zou een
 * uitnodiging uit een ander programma een uur mis staan. Een tijd met een
 * `TZID` of zonder achtervoegsel nemen we zoals hij er staat: dat is de
 * bedoelde wandkloktijd, en die klopt zolang uitnodiging en agenda in dezelfde
 * zone leven. Een echte zone-omrekening zou een tijdzonedatabase vragen.
 */
export function leesTijdstip(regel: string): { waarde?: string; heleDag: boolean } {
  const rauw = waardeVan(regel).trim();
  if (!rauw) return { heleDag: false };
  if (/VALUE=DATE(?![-A-Z])/i.test(regel) || /^\d{8}$/.test(rauw)) {
    return { waarde: `${rauw.slice(0, 4)}-${rauw.slice(4, 6)}-${rauw.slice(6, 8)}`, heleDag: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(rauw);
  if (!m) return { heleDag: false };
  const [, j, mnd, d, u, min, sec, zulu] = m;
  if (zulu) {
    const t = new Date(Date.UTC(+j, +mnd - 1, +d, +u, +min, +sec));
    const p = (n: number) => String(n).padStart(2, "0");
    return {
      waarde: `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
        + `T${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`,
      heleDag: false,
    };
  }
  return { waarde: `${j}-${mnd}-${d}T${u}:${min}:${sec}`, heleDag: false };
}

function statusVanParam(waarde?: string): Deelnamestatus {
  switch ((waarde || "").toUpperCase()) {
    case "ACCEPTED": return "accepted";
    case "DECLINED": return "declined";
    case "TENTATIVE": return "tentative";
    default: return "needs-action";
  }
}

/* ─────────────────────────── Opmaak van regels ───────────────────────── */

/* ─────────────────────────────── Tijdzones ────────────────────────────── */

/*
 * Een `TZID` noemen is niet genoeg: de norm wil dat elke genoemde zone in het
 * bestand zelf gedefinieerd staat, in een VTIMEZONE. Wie dat overslaat, laat de
 * ontvanger raden. Gmail kent "Europe/Amsterdam" toevallig; Outlook en Exchange
 * niet, en die lezen de tijd dan als UTC. Een afspraak om 10:00 kwam daar in de
 * zomer binnen als 12:00. De mailserver stuurt de uitnodiging door zoals hij is
 * opgeslagen, dus de definitie moet er bij het opslaan al in staan.
 *
 * De definitie wordt afgeleid van de klok van dit apparaat (`Intl`), voor het
 * jaar van de afspraak: wanneer verspringt de klok, van hoeveel naar hoeveel,
 * en welke regel hoort daarbij ("laatste zondag van maart"). Zo klopt hij ook
 * voor een zone op het zuidelijk halfrond of een zone zonder zomertijd, zonder
 * een eigen tabel die veroudert.
 */

const DAGCODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Hoeveel minuten de klok in de zone van `opmaak` op dit moment voorloopt op UTC. */
function verschilMinuten(opmaak: Intl.DateTimeFormat, ms: number): number {
  const delen = opmaak.formatToParts(new Date(ms));
  const deel = (soort: string) => Number(delen.find((d) => d.type === soort)?.value ?? 0);
  const alsUtc = Date.UTC(
    deel("year"), deel("month") - 1, deel("day"), deel("hour") % 24, deel("minute"), deel("second"),
  );
  return Math.round((alsUtc - ms) / 60_000);
}

/** `120` → `+0200`, `-300` → `-0500`. */
function offsetTekst(minuten: number): string {
  const teken = minuten < 0 ? "-" : "+";
  const absoluut = Math.abs(minuten);
  return `${teken}${String(Math.floor(absoluut / 60)).padStart(2, "0")}${String(absoluut % 60).padStart(2, "0")}`;
}

/**
 * De VTIMEZONE van een IANA-zone voor één jaar, als losse regels. Een zone die
 * dit apparaat niet kent, levert niets op: dan blijft het bestand zoals het was.
 */
export function vtimezoneRegels(zone: string, jaar: number): string[] {
  let opmaak: Intl.DateTimeFormat;
  try {
    opmaak = new Intl.DateTimeFormat("en-US", {
      timeZone: zone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return [];
  }

  const DAG = 86_400_000;
  const MINUUT = 60_000;
  const begin = Date.UTC(jaar, 0, 1);
  const eind = Date.UTC(jaar + 1, 0, 1);
  const overgangen: { ms: number; van: number; naar: number }[] = [];
  let vorige = verschilMinuten(opmaak, begin);
  for (let t = begin + DAG; t <= eind; t += DAG) {
    const nu = verschilMinuten(opmaak, t);
    if (nu === vorige) continue;
    // Binnen die dag zoeken tot op de minuut.
    let laag = t - DAG;
    let hoog = t;
    while (hoog - laag > MINUUT) {
      const midden = laag + Math.max(1, Math.floor((hoog - laag) / 2 / MINUUT)) * MINUUT;
      if (verschilMinuten(opmaak, midden) === vorige) laag = midden;
      else hoog = midden;
    }
    overgangen.push({ ms: hoog, van: vorige, naar: nu });
    vorige = nu;
  }

  const twee = (n: number) => String(n).padStart(2, "0");
  const regels = ["BEGIN:VTIMEZONE", `TZID:${zone}`];
  if (overgangen.length === 0) {
    const vast = offsetTekst(vorige);
    regels.push("BEGIN:STANDARD", "DTSTART:19700101T000000", `TZOFFSETFROM:${vast}`, `TZOFFSETTO:${vast}`, "END:STANDARD");
  }
  for (const o of overgangen) {
    const soort = o.naar > o.van ? "DAYLIGHT" : "STANDARD";
    // Het moment van verspringen in de kloktijd van vóór de sprong, zoals de norm het wil.
    const lokaal = new Date(o.ms + o.van * MINUUT);
    const j = lokaal.getUTCFullYear();
    const m = lokaal.getUTCMonth() + 1;
    const d = lokaal.getUTCDate();
    const dagenInMaand = new Date(Date.UTC(j, m, 0)).getUTCDate();
    const code = DAGCODES[lokaal.getUTCDay()];
    const welke = d + 7 > dagenInMaand ? "-1" : String(Math.ceil(d / 7));
    regels.push(
      `BEGIN:${soort}`,
      `DTSTART:${j}${twee(m)}${twee(d)}T${twee(lokaal.getUTCHours())}${twee(lokaal.getUTCMinutes())}00`,
      `TZOFFSETFROM:${offsetTekst(o.van)}`,
      `TZOFFSETTO:${offsetTekst(o.naar)}`,
      `RRULE:FREQ=YEARLY;BYMONTH=${m};BYDAY=${welke}${code}`,
      `END:${soort}`,
    );
  }
  regels.push("END:VTIMEZONE");
  return regels;
}

/**
 * Zet voor elke `TZID` die genoemd wordt maar nergens gedefinieerd is een
 * VTIMEZONE vóór de eerste VEVENT. Wat al gedefinieerd is, blijft staan; een
 * zone die dit apparaat niet kent (een Windows-naam uit Outlook, bijvoorbeeld)
 * wordt overgeslagen — die bestanden hebben hun eigen definitie al.
 */
function vulTijdzonesAan(regels: string[]): string[] {
  const gedefinieerd = new Set<string>();
  const genoemd = new Map<string, number>();
  let inTijdzone = false;
  for (const regel of regels) {
    const boven = regel.toUpperCase();
    if (boven === "BEGIN:VTIMEZONE") {
      inTijdzone = true;
    } else if (boven === "END:VTIMEZONE") {
      inTijdzone = false;
    } else if (inTijdzone) {
      if (boven.startsWith("TZID:")) gedefinieerd.add(regel.slice(5).trim());
    } else {
      const zone = /;TZID=("?)([^;:"]+)\1[;:]/i.exec(regel)?.[2];
      if (zone && !genoemd.has(zone)) {
        const jaar = /:(\d{4})\d{4}T/.exec(regel)?.[1];
        genoemd.set(zone, jaar ? Number(jaar) : new Date().getUTCFullYear());
      }
    }
  }

  const erbij: string[] = [];
  for (const [zone, jaar] of genoemd) {
    if (!gedefinieerd.has(zone)) erbij.push(...vtimezoneRegels(zone, jaar));
  }
  const plek = regels.findIndex((r) => r.toUpperCase() === "BEGIN:VEVENT");
  if (erbij.length === 0 || plek < 0) return regels;
  return [...regels.slice(0, plek), ...erbij, ...regels.slice(plek)];
}

/** `2026-09-10T10:00:00` → `20260910T100000`. */
function lokaleStempel(waarde: string): string {
  return waarde.replace(/[-:]/g, "").replace(/\.\d+$/, "").slice(0, 15);
}

function datumDeel(waarde: string): string {
  return waarde.slice(0, 10).replace(/-/g, "");
}

/** De dag ná deze — DTEND van een hele dag is exclusief. */
function volgendeDag(waarde: string): string {
  const [j, m, d] = waarde.slice(0, 10).split("-").map(Number);
  const dag = new Date(Date.UTC(j, m - 1, d));
  dag.setUTCDate(dag.getUTCDate() + 1);
  return dag.toISOString().slice(0, 10);
}

function utcStempel(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Tekens die in een waarde een eigen betekenis hebben. Zonder dit knapt een
 * titel als "Overleg: offerte, tekening" het bestand in stukken.
 */
function ontsnap(waarde: string): string {
  return waarde
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function ontsnapTerug(waarde: string): string {
  return waarde
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** In een parameter mag geen aanhalingsteken of dubbele punt staan. */
function ontsnapParam(waarde: string): string {
  const schoon = waarde.replace(/["^]/g, "").replace(/[\r\n]/g, " ");
  return /[;:,]/.test(schoon) ? `"${schoon}"` : schoon;
}

function ontsnapParamTerug(waarde?: string): string | undefined {
  if (!waarde) return undefined;
  return waarde.replace(/^"(.*)"$/, "$1");
}

/** De waarde achter de eerste dubbele punt die niet in aanhalingstekens staat. */
function waardeVan(regel: string): string {
  let inTekst = false;
  for (let i = 0; i < regel.length; i++) {
    const c = regel[i];
    if (c === '"') inTekst = !inTekst;
    else if (c === ":" && !inTekst) return regel.slice(i + 1);
  }
  return "";
}

function paramVan(regel: string, naam: string): string | undefined {
  const kop = regel.slice(0, regel.length - waardeVan(regel).length - 1);
  for (const deel of splitsParams(kop)) {
    const is = deel.indexOf("=");
    if (is > 0 && deel.slice(0, is).toUpperCase() === naam) return deel.slice(is + 1);
  }
  return undefined;
}

/** Splitst op `;`, maar niet binnen aanhalingstekens. */
function splitsParams(kop: string): string[] {
  const uit: string[] = [];
  let huidig = "";
  let inTekst = false;
  for (const c of kop) {
    if (c === '"') { inTekst = !inTekst; huidig += c; }
    else if (c === ";" && !inTekst) { uit.push(huidig); huidig = ""; }
    else huidig += c;
  }
  uit.push(huidig);
  return uit;
}

function vervangParam(regel: string, naam: string, waarde: string): string {
  const value = waardeVan(regel);
  const kop = regel.slice(0, regel.length - value.length - 1);
  const delen = splitsParams(kop);
  let gezet = false;
  const nieuw = delen.map((deel) => {
    const is = deel.indexOf("=");
    if (is > 0 && deel.slice(0, is).toUpperCase() === naam) { gezet = true; return `${naam}=${waarde}`; }
    return deel;
  });
  if (!gezet) nieuw.push(`${naam}=${waarde}`);
  return `${nieuw.join(";")}:${value}`;
}

function verwijderParam(regel: string, naam: string): string {
  const value = waardeVan(regel);
  const kop = regel.slice(0, regel.length - value.length - 1);
  const delen = splitsParams(kop).filter((deel) => {
    const is = deel.indexOf("=");
    return !(is > 0 && deel.slice(0, is).toUpperCase() === naam);
  });
  return `${delen.join(";")}:${value}`;
}

/**
 * Een regel mag hoogstens 75 octetten zijn; wat erover gaat, gaat verder op de
 * volgende regel met een spatie ervoor. We tellen octetten en niet tekens,
 * anders knipt een naam met een accent middenin een teken door.
 */
export function vouw(regel: string): string[] {
  const coder = new TextEncoder();
  if (coder.encode(regel).length <= 75) return [regel];
  const uit: string[] = [];
  let huidig = "";
  let ruimte = 75;
  for (const teken of regel) {
    const breedte = coder.encode(teken).length;
    if (breedte > ruimte) {
      uit.push(huidig);
      huidig = " ";
      ruimte = 74;
    }
    huidig += teken;
    ruimte -= breedte;
  }
  if (huidig) uit.push(huidig);
  return uit;
}

/** De tegenhanger van `vouw`: gevouwen regels weer aan elkaar. */
export function ontvouw(ics: string): string[] {
  const uit: string[] = [];
  for (const regel of ics.split(/\r?\n/)) {
    if ((regel.startsWith(" ") || regel.startsWith("\t")) && uit.length > 0) {
      uit[uit.length - 1] += regel.slice(1);
    } else if (regel.length > 0) {
      uit.push(regel);
    }
  }
  return uit;
}
