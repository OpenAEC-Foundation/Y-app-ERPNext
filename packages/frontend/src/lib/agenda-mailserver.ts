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
 * Dit bestand leest alleen. Een afspraak maken of accepteren hoort namens de
 * ingelogde gebruiker te gebeuren en krijgt een eigen script, waar de
 * gebruiker uit de sessie komt en niet uit het verzoek — anders zou je via de
 * app in andermans agenda kunnen schrijven.
 */
import { callMethod } from "./erpnext.ts";

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
  status?: string;
  privacy?: string;
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
