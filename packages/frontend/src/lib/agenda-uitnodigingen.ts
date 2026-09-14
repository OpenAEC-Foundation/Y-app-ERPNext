import type { GelezenAfspraak } from "./ical.ts";

/**
 * Uitnodigingen die nog in de mail staan, als afspraak in de agenda.
 *
 * Een uitnodiging is pas een afspraak als je hem hebt aangenomen, maar tot dat
 * moment houdt hij wél tijd bezet. Staat hij alleen in je postvak, dan zie je
 * in de agenda een gat waar geen gat is, en plan je er iets overheen. Daarom
 * tekent de agenda hem alvast — gestippeld, want hij staat er onder voorbehoud.
 *
 * Pure module: wat wél en niet meetelt is de hele vraag, en dat hoort met
 * `node --test` te beantwoorden te zijn in plaats van door naar een scherm te
 * kijken. Het ophalen zit in `Agenda.tsx`.
 */

/** Het minimum dat een deelnemersregel moet dragen, uit .ics of mailserver. */
export interface Deelnemer {
  email: string;
  status?: string;
  organisator?: boolean;
}

/** Een uitnodiging zoals hij in een binnengekomen mail zat. */
export interface MailUitnodiging {
  /** De Communication waar hij in zat; daarmee is de mail te openen. */
  communication: string;
  afspraak: GelezenAfspraak;
}

/**
 * Methodes die géén openstaande uitnodiging zijn.
 *
 * `CANCEL` haalt een afspraak juist wég, `REPLY` is iemand anders die antwoord
 * geeft op een uitnodiging van jou, en `DECLINECOUNTER` is het afwijzen van een
 * tegenvoorstel. Alle drie komen als gewone mail binnen met een .ics eraan, dus
 * zonder deze uitzondering zou een afgezegde afspraak alsnog in de agenda
 * verschijnen.
 */
const GEEN_VERZOEK = new Set(["cancel", "reply", "declinecounter"]);

function schoon(waarde?: string): string {
  return String(waarde || "").trim().toLowerCase();
}

/**
 * Is dit een uitnodiging aan jou?
 *
 * Alleen dan hoort hij gestippeld: heb je aangenomen dan staat hij gewoon in je
 * agenda, en heb je geweigerd dan houdt hij geen tijd meer bezet. De organisator
 * valt af omdat een afspraak die je zelf belegt geen uitnodiging aan jezelf is.
 *
 * Sta je er in je eentje in, dan is het je eigen afspraak. Gemeten op de
 * mailserver: een afspraak die je zonder genodigden aanmaakt komt terug met
 * precies één deelnemer — jij, zonder rol en zonder deelnamestand, en zonder
 * organisator. Dat leest anders als "uitgenodigd, nog niet geantwoord", en dan
 * staat je eigen afspraak gestippeld in de agenda met een antwoordknop die
 * niets kán doen: in het .ics-bestand staat geen ATTENDEE om te beantwoorden.
 * Een echte uitnodiging heeft altijd iemand anders — een organisator, of een
 * tweede genodigde.
 */
export function isUitnodigingAanJou(
  genodigden: Deelnemer[] | undefined,
  ik: string,
  organisator?: string,
): boolean {
  const doel = schoon(ik);
  if (!doel) return false;
  if (schoon(organisator) === doel) return false;
  const mij = (genodigden || []).find((g) => schoon(g.email) === doel);
  if (!mij || mij.organisator) return false;
  // Sta je er in je eentje in, dan is het je eigen afspraak — zie de
  // toelichting hierboven.
  const anderen = (genodigden || []).filter((g) => schoon(g.email) !== doel);
  return anderen.length > 0 || !!schoon(organisator);
}

/**
 * Wacht deze afspraak nog op jóuw antwoord? Een uitnodiging aan jou waarop je
 * nog niets hebt gezegd.
 */
export function wachtOpAntwoord(
  genodigden: Deelnemer[] | undefined,
  ik: string,
  organisator?: string,
): boolean {
  if (!isUitnodigingAanJou(genodigden, ik, organisator)) return false;
  const doel = schoon(ik);
  const mij = (genodigden || []).find((g) => schoon(g.email) === doel);
  const status = schoon(mij?.status);
  // Geen PARTSTAT betekent in iCalendar "needs-action"; zo staat het ook in
  // uitnodigingen van Outlook, die het veld vaak helemaal weglaten.
  return status === "" || status === "needs-action";
}

/**
 * Welke van de gevonden .ics-bestanden horen als open uitnodiging in de agenda?
 *
 * `bestaandeUids` zijn de afspraken die de agenda al tekent. Staat een
 * uitnodiging daar al bij — de mailserver zet hem er bij binnenkomst vaak zelf
 * in — dan hoort er geen tweede, gestippelde kopie naast.
 */
export function kiesUitnodigingen(
  kandidaten: MailUitnodiging[],
  bestaandeUids: Iterable<string>,
  ik: string,
): MailUitnodiging[] {
  const bestaand = new Set<string>();
  for (const uid of bestaandeUids) if (uid) bestaand.add(String(uid).trim());

  // Eerst alle afzeggingen verzamelen, ongeacht voor wie ze waren. Een
  // afzegging komt ná de uitnodiging binnen; zou hij pas op zijn beurt worden
  // bekeken, dan bleef de afspraak staan wanneer de uitnodigingsmail later in
  // de lijst stond.
  const afgezegd = new Set<string>();
  for (const k of kandidaten || []) {
    if (GEEN_VERZOEK.has(schoon(k.afspraak?.methode)) && k.afspraak?.uid) {
      afgezegd.add(k.afspraak.uid.trim());
    }
  }

  const beste = new Map<string, MailUitnodiging>();
  for (const k of kandidaten || []) {
    const a = k.afspraak;
    const uid = String(a?.uid || "").trim();
    if (!uid || !a?.start) continue;
    if (GEEN_VERZOEK.has(schoon(a.methode))) continue;
    if (bestaand.has(uid) || afgezegd.has(uid)) continue;
    if (!wachtOpAntwoord(a.genodigden, ik, a.organisator)) continue;

    // Dezelfde afspraak kan twee keer zijn gestuurd; het hoogste SEQUENCE is de
    // nieuwste versie. Bij gelijk volgnummer wint de eerste, want de lijst komt
    // met de nieuwste mail vooraan binnen.
    const staand = beste.get(uid);
    if (!staand || a.volgnummer > staand.afspraak.volgnummer) beste.set(uid, k);
  }

  return [...beste.values()].sort((a, b) =>
    String(a.afspraak.start).localeCompare(String(b.afspraak.start)));
}
