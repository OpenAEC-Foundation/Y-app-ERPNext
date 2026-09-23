import { callMethod } from "./erpnext.ts";

/**
 * De afwezigheidsmelding van je eigen postbus.
 *
 * Staat op de mailserver (JMAP VacationResponse), niet in ERPNext: dan antwoordt
 * de mailserver zelf, ook als ERPNext even geen mail ophaalt, en kent hij een
 * begin- en einddatum. Het Server Script `mail_afwezigheid` doet alleen de
 * postbus van de ingelogde gebruiker.
 *
 * De rekenkant is hier puur en getest. Wat daar stil fout gaat: de mailserver
 * rekent in UTC. Wie "tot en met vrijdag" invult, hoort geen melding te krijgen
 * die donderdagavond al stopt of zaterdag nog loopt.
 */

/** Wat het formulier toont: hele dagen als `YYYY-MM-DD`, leeg is geen datum. */
export interface AfwezigheidFormulier {
  aan: boolean;
  van: string;
  tot: string;
  onderwerp: string;
  tekst: string;
}

/** Wat de mailserver kent: tijdstippen in UTC, of `null`. */
export interface AfwezigheidStand {
  aan: boolean;
  van: string | null;
  tot: string | null;
  onderwerp: string;
  tekst: string;
  html: string;
}

const STANDAARD_ONDERWERP = "Afwezig";

function standaardZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Amsterdam";
  } catch {
    return "Europe/Amsterdam";
  }
}

/** Hoeveel minuten de klok in `zone` voorloopt op UTC, op dit tijdstip. */
function verschilMinuten(zone: string, tijdstip: number): number {
  const delen = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(tijdstip));
  const deel = (soort: string) => Number(delen.find((d) => d.type === soort)?.value ?? 0);
  const alsUtc = Date.UTC(deel("year"), deel("month") - 1, deel("day"), deel("hour"), deel("minute"), deel("second"));
  return Math.round((alsUtc - tijdstip) / 60000);
}

/** Middernacht aan het begin van deze dag in `zone`, als UTC-tijdstip. */
function middernacht(datum: string, zone: string): number {
  const [j, m, d] = datum.split("-").map(Number);
  const gok = Date.UTC(j, m - 1, d);
  // Twee rondes: rond de wisseling van zomer- naar wintertijd klopt het
  // verschil op het gegokte tijdstip net niet met dat op middernacht zelf.
  let tijdstip = gok - verschilMinuten(zone, gok) * 60000;
  tijdstip = gok - verschilMinuten(zone, tijdstip) * 60000;
  return tijdstip;
}

function dagErna(datum: string): string {
  const [j, m, d] = datum.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, d + 1)).toISOString().slice(0, 10);
}

function alsUtcTekst(tijdstip: number): string {
  return new Date(tijdstip).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** De kalenderdag in `zone` waarop dit tijdstip valt. */
function dagIn(tijdstip: number, zone: string): string {
  const delen = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(tijdstip));
  const deel = (soort: string) => delen.find((d) => d.type === soort)?.value ?? "";
  return deel("year") + "-" + deel("month") + "-" + deel("day");
}

function ontsnap(tekst: string): string {
  const tabel: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return tekst.replace(/[&<>"]/g, (c) => tabel[c]);
}

/**
 * Het formulier omzetten naar wat de mailserver verwacht.
 *
 * Hele dagen: de melding begint om middernacht op de begindag en loopt tot
 * middernacht na de einddag, in de tijdzone van de gebruiker. De tekst gaat
 * ook als HTML mee, voor mailprogramma's die dat liever tonen.
 */
export function naarMailserver(invoer: AfwezigheidFormulier, zone: string = standaardZone()): AfwezigheidStand {
  const van = (invoer.van || "").trim();
  const tot = (invoer.tot || "").trim();
  if (van && tot && tot < van) {
    throw new Error("De einddatum ligt voor de begindatum.");
  }
  const tekst = (invoer.tekst || "").trim();
  return {
    aan: !!invoer.aan,
    van: van ? alsUtcTekst(middernacht(van, zone)) : null,
    tot: tot ? alsUtcTekst(middernacht(dagErna(tot), zone)) : null,
    onderwerp: (invoer.onderwerp || "").trim() || STANDAARD_ONDERWERP,
    tekst,
    html: tekst ? "<p>" + ontsnap(tekst).replace(/\n/g, "<br>") + "</p>" : "",
  };
}

/** Wat de mailserver teruggeeft, weer als formulier met hele dagen. */
export function vanMailserver(stand: AfwezigheidStand, zone: string = standaardZone()): AfwezigheidFormulier {
  return {
    aan: !!stand.aan,
    van: stand.van ? dagIn(Date.parse(stand.van), zone) : "",
    // Het einde is middernacht na de laatste dag; een minuut ervoor is die dag.
    tot: stand.tot ? dagIn(Date.parse(stand.tot) - 60000, zone) : "",
    onderwerp: stand.onderwerp || "",
    tekst: stand.tekst || "",
  };
}

/** Staat de melding op dit moment echt aan? Aan, en binnen de periode. */
export function isActief(
  stand: { aan: boolean; van: string | null; tot: string | null },
  nu: Date = new Date(),
): boolean {
  if (!stand.aan) return false;
  const t = nu.getTime();
  if (stand.van && t < Date.parse(stand.van)) return false;
  if (stand.tot && t >= Date.parse(stand.tot)) return false;
  return true;
}

function naarStand(ruw: unknown): AfwezigheidStand {
  const r = (ruw ?? {}) as Partial<AfwezigheidStand>;
  return {
    aan: !!r.aan,
    van: typeof r.van === "string" && r.van ? r.van : null,
    tot: typeof r.tot === "string" && r.tot ? r.tot : null,
    onderwerp: typeof r.onderwerp === "string" ? r.onderwerp : "",
    tekst: typeof r.tekst === "string" ? r.tekst : "",
    html: typeof r.html === "string" ? r.html : "",
  };
}

/** De huidige afwezigheidsmelding van je eigen postbus. */
export async function haalAfwezigheid(): Promise<AfwezigheidStand> {
  return naarStand(await callMethod("mail_afwezigheid", { actie: "lezen" }));
}

/** Opslaan en de stand teruggeven zoals de mailserver hem nu heeft. */
export async function zetAfwezigheid(stand: AfwezigheidStand): Promise<AfwezigheidStand> {
  return naarStand(await callMethod("mail_afwezigheid", {
    actie: "opslaan",
    aan: stand.aan ? "1" : "0",
    van: stand.van ?? "",
    tot: stand.tot ?? "",
    onderwerp: stand.onderwerp,
    tekst: stand.tekst,
    html: stand.html,
  }));
}
