/**
 * Agenda's van collega's, uit de mailserver.
 *
 * De agenda's staan niet in ERPNext maar op de mailserver (Stalwart). Het
 * ophalen gebeurt daarom niet hier maar in een Server Script op ERPNext
 * (`agenda_ophalen`), dat via JMAP bij de mailserver aanklopt met één
 * serviceaccount. Dat account mag namens anderen kijken; de inloggegevens
 * staan in het doctype "Agenda Koppeling" en komen dus nooit in de browser.
 *
 * Waarom niet rechtstreeks vanuit de app: dan zou elke gebruiker die sleutel
 * in handen krijgen. Nu blijft hij op de server, en bepaalt ERPNext wie wat
 * mag zien.
 *
 * Schrijven loopt over een tweede script (`agenda_schrijven`), waar de
 * handelende gebruiker uit de sessie komt en niet uit het verzoek — anders zou
 * je via de app in andermans agenda kunnen schrijven.
 *
 * Dat script kent twee wegen. Een afspraak *neerleggen* gaat over CalDAV: bij
 * een JMAP-create laat de mailserver de genodigden stilzwijgend vallen, en een
 * uitnodiging zonder genodigden is geen uitnodiging. Een bestaande afspraak
 * *bijwerken* gaat juist over JMAP, want dat is een patch — alleen wat je
 * meestuurt verandert, de rest van de afspraak blijft staan. Daarom kan het
 * ook bij een afspraak die met een ander agendaprogramma is gemaakt, waarvan
 * wij de helft van de velden niet kennen.
 */
import { callMethod, fetchList } from "./erpnext.ts";
import { isUitnodigingAanJou } from "./agenda-uitnodigingen.ts";
import { bouwAfspraakIcs, zetDeelname, type AfspraakInvoer, type Deelnamestatus } from "./ical.ts";

/** Eén afspraak zoals het Server Script hem teruggeeft. */
export interface MailserverAfspraak {
  /** E-mailadres van degene in wiens agenda dit staat. */
  gebruiker: string;
  id: string;
  titel?: string;
  /** Lokale starttijd zonder zone, bijv. "2026-09-04T08:00:00". */
  start?: string;
  /** ISO 8601-duur, bijv. "PT1H30M". */
  duur?: string;
  tijdzone?: string;
  hele_dag?: boolean;
  /** Onderdeel van een herhalende reeks; die verzet je niet met de muis. */
  herhaalt?: boolean;
  status?: string;
  privacy?: string;
  /** Blijft gelijk in alle agenda's waar deze afspraak in staat. */
  uid?: string;
  genodigden?: MailserverGenodigde[];
}

export interface MailserverGenodigde {
  email: string;
  naam?: string;
  status?: Deelnamestatus | string;
  organisator?: boolean;
}

interface Antwoord {
  afspraken?: MailserverAfspraak[];
  aantal?: number;
  gelezen?: number;
  mislukt?: Array<{ gebruiker: string; reden: string }>;
}

/**
 * Zet een ISO 8601-duur om in minuten. JMAP geeft duur als "PT1H30M" en niet
 * als eindtijd; de agenda rekent met een eind, dus hier de omrekening.
 *
 * Alleen dagen, uren en minuten: kalendermaanden en -jaren komen in
 * afspraakduren niet voor, en een verkeerd geraden maandlengte zou een
 * afspraak dagen kunnen verschuiven.
 */
export function duurInMinuten(duur?: string): number {
  const d = (duur || "").trim().toUpperCase();
  const m = d.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const [, dagen, uren, minuten, seconden] = m;
  return (+(dagen || 0) * 24 * 60) + (+(uren || 0) * 60) + (+(minuten || 0)) + Math.round(+(seconden || 0) / 60);
}

/** Eindtijd = start plus duur. Leeg als de start ontbreekt of onleesbaar is. */
export function eindTijd(start?: string, duur?: string): string | undefined {
  if (!start) return undefined;
  const minuten = duurInMinuten(duur);
  if (minuten <= 0) return undefined;
  // Zonder zone-achtervoegsel leest JS dit als lokale tijd, en dat is precies
  // wat we willen: de afspraak staat in de agenda van de mailserver al in de
  // tijdzone van de gebruiker.
  const t = new Date(start);
  if (Number.isNaN(t.getTime())) return undefined;
  t.setMinutes(t.getMinutes() + minuten);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}:00`;
}

/**
 * Haalt de afspraken op voor een periode.
 *
 * `gebruikers` leeg laten betekent: alle actieve medewerkers. Het Server
 * Script bepaalt die lijst zelf uit Employee, zodat de app niet kan vragen om
 * accounts die er niet horen te zijn.
 *
 * Faalt de koppeling (uit, geen wachtwoord, mailserver onbereikbaar), dan komt
 * er een lege lijst terug in plaats van een fout: de agenda toont dan gewoon
 * de ERPNext-bronnen. Een kapotte koppeling hoort de hele agenda niet leeg te
 * maken.
 */
export async function haalAgendas(
  van: string,
  tot: string,
  gebruikers?: string[]
): Promise<{ afspraken: MailserverAfspraak[]; mislukt: number }> {
  try {
    const res = (await callMethod("agenda_ophalen", {
      van: `${van}T00:00:00Z`,
      tot: `${tot}T23:59:59Z`,
      ...(gebruikers && gebruikers.length ? { gebruikers: gebruikers.join(",") } : {}),
    })) as Antwoord | null;
    return {
      afspraken: Array.isArray(res?.afspraken) ? res!.afspraken : [],
      mislukt: Array.isArray(res?.mislukt) ? res!.mislukt.length : 0,
    };
  } catch {
    return { afspraken: [], mislukt: 0 };
  }
}

/** Eén collega wiens agenda opgevraagd kan worden. */
export interface Collega {
  /** E-mailadres; tevens de sleutel waarop het Server Script zoekt. */
  email: string;
  naam: string;
}

/**
 * De medewerkers met een e-mailadres, als keuzelijst voor de agenda.
 *
 * Uit Employee en niet uit User: alleen wie in dienst is hoort in de lijst,
 * en Employee is waar dat staat. Gebruikers zonder gekoppeld mailadres vallen
 * af — daar valt geen agenda voor op te halen.
 */
export async function haalCollegas(): Promise<Collega[]> {
  // Eerst het Server Script. Reden: op vrijwel iedere medewerker staat een
  // User Permission "Employee = <eigen record>", en dan levert de lijstquery
  // hieronder precies één naam op — je eigen. De kiezer bleef daardoor leeg.
  // Het script gaat buiten die beperking om en geeft alleen naam en werkadres
  // terug; de rest van het Employee-record blijft dicht.
  try {
    const res = (await callMethod("agenda_collegas", {})) as { collegas?: Collega[] } | undefined;
    const rijen = res?.collegas ?? [];
    if (rijen.length > 0) return normaliseerCollegas(rijen);
  } catch {
    // Geen script op deze installatie (of uitgeschakeld) — dan de gewone weg.
  }

  try {
    const rijen = await fetchList<{ employee_name?: string; user_id?: string }>("Employee", {
      fields: ["employee_name", "user_id"],
      filters: [["status", "=", "Active"], ["user_id", "is", "set"]],
      order_by: "employee_name asc",
      limit_page_length: 0,
    });
    return normaliseerCollegas(rijen.map((r) => ({
      email: String(r.user_id || ""),
      naam: String(r.employee_name || r.user_id || ""),
    })));
  } catch {
    return [];
  }
}

/** Adressen kleingeletterd, dubbelen eruit, lege overgeslagen. */
function normaliseerCollegas(rijen: { email: string; naam: string }[]): Collega[] {
  const uniek = new Map<string, Collega>();
  for (const r of rijen) {
    const email = String(r.email || "").trim().toLowerCase();
    if (!email || uniek.has(email)) continue;
    uniek.set(email, { email, naam: String(r.naam || email).trim() });
  }
  return [...uniek.values()];
}

/**
 * Kleurenreeks voor collega-agenda's. Bewust andere tinten dan de vaste
 * bronkleuren van de agenda (blauw voor afspraken, oranje taken, rood verlof,
 * groen urenstaten), anders lijkt de agenda van een collega op een taak.
 */
const COLLEGA_KLEUREN = [
  "#0ea5e9", "#db2777", "#65a30d", "#c2410c", "#0d9488", "#9333ea",
  "#0891b2", "#b45309", "#4f46e5", "#be123c", "#15803d", "#a16207",
];

/**
 * Wijst elke collega een kleur toe, op volgorde van de lijst.
 *
 * Op index en niet op een hash van het adres: een hash geeft bij vijftien
 * mensen en twaalf kleuren vrijwel zeker twee keer dezelfde kleur naast
 * elkaar, en juist dat wil je hier niet. Nadeel is dat iemands kleur kan
 * opschuiven als er een collega bijkomt — dat weegt niet op tegen twee
 * mensen die niet uit elkaar te houden zijn.
 */
export function kleurenVoorCollegas(collegas: Collega[]): Map<string, string> {
  const uit = new Map<string, string>();
  collegas.forEach((c, i) => uit.set(c.email, COLLEGA_KLEUREN[i % COLLEGA_KLEUREN.length]));
  return uit;
}

/* ─────────────────────────────── Schrijven ───────────────────────────── */

/** Wat `agenda_schrijven` per agenda terugmeldt. */
export interface SchrijfUitslag {
  geschreven: string[];
  mislukt: Array<{ agenda: string; reden: string }>;
  /**
   * Genodigden buiten ons eigen mailserverdomein. Daar valt geen agenda te
   * schrijven, en dat hoeft ook niet: de mailserver stuurt hun een
   * uitnodiging per e-mail. Ze staan hier apart en niet bij `mislukt`, want
   * een geslaagde uitnodiging als fout melden maakt de melding waardeloos.
   */
  extern: string[];
}

/**
 * Zet een afspraak in de agenda van de organisator en van elke genodigde.
 *
 * Eén .ics, in meerdere agenda's, met dezelfde UID: zo ziet iedereen dezelfde
 * afspraak en kan een antwoord van de één in de kopie van de ander landen.
 * De organisator hoort altijd de ingelogde gebruiker te zijn; het Server
 * Script weigert het anders — daar staat de controle die telt.
 */
export async function verstuurAfspraak(afspraak: AfspraakInvoer): Promise<SchrijfUitslag> {
  const agendas = [
    afspraak.organisator.email,
    ...(afspraak.genodigden ?? []).map((g) => g.email),
  ];
  return schrijf("opslaan", afspraak.uid, bouwAfspraakIcs(afspraak), agendas);
}

/** Wat er aan een bestaande afspraak veranderd kan worden. */
export interface AfspraakWijziging {
  titel?: string;
  /** Lokale tijd zonder zone-achtervoegsel: `2026-09-10T10:00:00`. */
  start?: string;
  /** ISO 8601-duur: `PT1H30M`. Zie `duurUitMinuten`. */
  duur?: string;
  locatie?: string;
  omschrijving?: string;
}

/**
 * Werkt een bestaande afspraak bij: verplaatsen, langer maken, hernoemen.
 *
 * Alleen de meegegeven velden gaan mee. Dat is geen zuinigheid maar het punt:
 * de mailserver werkt de afspraak bij als patch, dus herhalingen,
 * herinneringen, bijlagen en velden van andere agendaprogramma's blijven
 * staan. Opnieuw opbouwen uit wat wij toevallig weten zou de rest wissen.
 *
 * `agendas` is voor de organisator: die verzet de afspraak ook in de agenda
 * van de genodigden, anders staat de vergadering bij de een om tien uur en bij
 * de ander om negen. Ben je niet de organisator, dan laat het Server Script
 * die adressen vallen en verandert alleen je eigen kopie.
 */
export async function werkAfspraakBij(
  uid: string,
  wijziging: AfspraakWijziging,
  agendas: string[] = [],
): Promise<SchrijfUitslag> {
  const uniek = [...new Set(agendas.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  const res = (await callMethod("agenda_schrijven", {
    actie: "bijwerken",
    uid,
    ...(uniek.length ? { agendas: uniek.join(",") } : {}),
    ...(wijziging.titel !== undefined ? { titel: wijziging.titel } : {}),
    ...(wijziging.start !== undefined ? { start: wijziging.start } : {}),
    ...(wijziging.duur !== undefined ? { duur: wijziging.duur } : {}),
    ...(wijziging.locatie !== undefined ? { locatie: wijziging.locatie } : {}),
    ...(wijziging.omschrijving !== undefined ? { omschrijving: wijziging.omschrijving } : {}),
  })) as Partial<SchrijfUitslag> | null;
  return {
    geschreven: Array.isArray(res?.geschreven) ? res.geschreven : [],
    mislukt: Array.isArray(res?.mislukt) ? res.mislukt : [],
    extern: Array.isArray(res?.extern) ? res.extern : [],
  };
}

/**
 * Het ruwe .ics van een afspraak uit je eigen agenda. Nodig om te kunnen
 * antwoorden: het antwoord verandert één regel in het bestand zoals het er
 * staat, in plaats van er een nieuw bestand overheen te leggen.
 */
export async function haalAfspraakIcs(uid: string): Promise<string | undefined> {
  const res = (await callMethod("agenda_schrijven", { actie: "lezen", uid })) as
    { ics?: unknown } | null;
  return typeof res?.ics === "string" && res.ics.includes("BEGIN:VCALENDAR") ? res.ics : undefined;
}

/**
 * Beantwoordt een uitnodiging: je eigen kopie krijgt de nieuwe stand, en die
 * van de organisator ook — anders weet die niet of je komt.
 *
 * Werkt op het .ics van de afspraak zelf en niet op een opnieuw opgebouwde
 * versie, zodat alles wat wij niet kennen (herhalingen, herinneringen, velden
 * van andere agendaprogramma's) blijft staan. Zie `zetDeelname`.
 */
export async function antwoordOpUitnodiging(args: {
  uid: string;
  ics: string;
  /** Het adres van degene die antwoordt — dat is de regel die verandert. */
  email: string;
  status: Deelnamestatus;
  organisator?: string;
}): Promise<SchrijfUitslag> {
  const nieuw = zetDeelname(args.ics, args.email, args.status);
  const agendas = [args.email];
  if (args.organisator) agendas.push(args.organisator);
  return schrijf("antwoorden", args.uid, nieuw, agendas);
}

/**
 * Het agendadeel van een uitnodiging, opgehaald bij de mailserver.
 *
 * Nodig omdat ERPNext het `text/calendar`-deel bij het binnenhalen van post
 * laat vallen: een uitnodiging uit Outlook of Teams komt hier aan als gewone
 * tekst met een deelnamelink, zonder de begintijd, de organisator of de
 * genodigden in machineleesbare vorm. Op de mailserver staat het origineel
 * nog compleet.
 *
 * Geeft `undefined` als er niets te vinden is — dan is het gewoon geen
 * uitnodiging, en dat is geen fout.
 */
export async function haalUitnodigingIcs(communication: string): Promise<string | undefined> {
  try {
    const res = (await callMethod("mail_uitnodiging", { communication })) as
      { ics?: unknown } | null;
    return typeof res?.ics === "string" && res.ics.includes("BEGIN:VCALENDAR")
      ? res.ics
      : undefined;
  } catch {
    // Geen script op deze installatie, geen postbus, of het bericht staat er
    // niet meer. In alle gevallen: geen uitnodiging om te tonen.
    return undefined;
  }
}

/**
 * Zet een ontvangen uitnodiging in je eigen agenda.
 *
 * Voor een uitnodiging die nog niet in je agenda staat — typisch er een van
 * buiten, die de mailserver niet zelf heeft ingepland. `zetEigenDeelname`
 * werkt alleen op een afspraak die er al is; dit legt hem er neer, met jouw
 * antwoord er al in.
 *
 * Alleen in je eigen agenda: je verstuurt hier niets, je legt iets bij jezelf
 * neer. Het Server Script dwingt dat af.
 */
export async function planUitnodigingIn(uid: string, ics: string): Promise<SchrijfUitslag> {
  const res = (await callMethod("agenda_schrijven", {
    actie: "inplannen", uid, ics,
  })) as Partial<SchrijfUitslag> | null;
  return {
    geschreven: Array.isArray(res?.geschreven) ? res.geschreven : [],
    mislukt: Array.isArray(res?.mislukt) ? res.mislukt : [],
    extern: Array.isArray(res?.extern) ? res.extern : [],
  };
}

/** Wat het antwoorden op een uitnodiging opleverde. */
export interface DeelnameUitslag {
  gelukt: boolean;
  /** Waarom het niet lukte; leeg als het wel lukte. */
  reden?: string;
  titel?: string;
}

/**
 * Je eigen antwoord op een uitnodiging zetten.
 *
 * Gaat over JMAP en niet over CalDAV, anders dan `antwoordOpUitnodiging`. Dat
 * pad legt een `.ics` neer op een bestandspad dat uit de UID wordt afgeleid,
 * en dat klopt alleen voor afspraken die Y-Next zelf heeft neergelegd. Een
 * uitnodiging van een collega of van buiten is door de mailserver in je agenda
 * gezet onder een naam die wij niet kennen; een bestand op ons eigen verzonnen
 * pad zou daar een tweede afspraak naast zetten in plaats van de bestaande bij
 * te werken.
 *
 * Het Server Script raakt alleen jouw deelnemersregel, en alleen in jouw
 * agenda. Of de organisator je antwoord ook te zien krijgt, bepaalt de
 * mailserver: die verzorgt de uitwisseling tussen agenda's.
 */
export async function zetEigenDeelname(
  uid: string, stand: Deelnamestatus,
): Promise<DeelnameUitslag> {
  const res = (await callMethod("agenda_schrijven", {
    actie: "deelname", uid, stand,
  })) as Partial<DeelnameUitslag> | null;
  return {
    gelukt: !!res?.gelukt,
    reden: typeof res?.reden === "string" ? res.reden : undefined,
    titel: typeof res?.titel === "string" ? res.titel : undefined,
  };
}

/**
 * Wat een genodigde met deze afspraak kan: alleen wanneer het een uitnodiging
 * aan hém is én Y-Next hem zelf heeft neergelegd. Bij een afspraak uit een
 * ander agendaprogramma kennen we het bestandspad niet en kunnen we er dus
 * niets in wijzigen — dan tonen we alleen de stand.
 *
 * `isUitnodigingAanJou` en niet "sta ik in de lijst": een afspraak die je zelf
 * aanmaakt komt van de mailserver terug met jou als enige deelnemer, zonder
 * rol en zonder stand. Dat las als een uitnodiging aan jezelf, met een
 * antwoordknop die niets kán doen — in het .ics staat geen ATTENDEE om te
 * beantwoorden, dus het antwoord eindigde op "Je staat niet als genodigde bij
 * deze afspraak".
 */
export function kanAntwoorden(afspraak: MailserverAfspraak, ik: string): boolean {
  if (!isEigenAfspraak(afspraak.uid)) return false;
  const organisator = (afspraak.genodigden ?? []).find((g) => g.organisator)?.email;
  return isUitnodigingAanJou(afspraak.genodigden, ik, organisator);
}

/** De stand van deze persoon bij deze afspraak, als hij genodigd is. */
export function eigenDeelname(
  afspraak: MailserverAfspraak, ik: string,
): Deelnamestatus | undefined {
  const mij = ik.trim().toLowerCase();
  const rij = (afspraak.genodigden ?? []).find((g) => g.email === mij);
  if (!rij) return undefined;
  const status = String(rij.status || "needs-action");
  return status === "accepted" || status === "declined" || status === "tentative"
    ? status
    : "needs-action";
}

async function schrijf(
  actie: "opslaan" | "antwoorden",
  uid: string,
  ics: string,
  agendas: string[],
): Promise<SchrijfUitslag> {
  const uniek = [...new Set(agendas.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  const res = (await callMethod("agenda_schrijven", {
    actie, uid, ics, agendas: uniek.join(","),
  })) as Partial<SchrijfUitslag> | null;
  return {
    geschreven: Array.isArray(res?.geschreven) ? res.geschreven : [],
    mislukt: Array.isArray(res?.mislukt) ? res.mislukt : [],
    extern: Array.isArray(res?.extern) ? res.extern : [],
  };
}

/**
 * Een nieuwe UID voor een afspraak uit Y-Next.
 *
 * Het voorvoegsel is geen sieraad: alleen afspraken die wij zelf hebben
 * neergelegd, liggen op een bestandspad dat we kunnen terugrekenen uit de UID.
 * Bij een afspraak uit een ander agendaprogramma weten we dat pad niet, en
 * daarom bieden we daar geen accepteren aan. Zie `isEigenAfspraak`.
 */
export function nieuweAfspraakUid(): string {
  const willekeurig = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `ynext-${willekeurig}@3bm.co.nl`;
}

/** Heeft Y-Next deze afspraak zelf neergelegd? Dan kunnen we hem bijwerken. */
export function isEigenAfspraak(uid?: string): boolean {
  return typeof uid === "string" && uid.startsWith("ynext-");
}
