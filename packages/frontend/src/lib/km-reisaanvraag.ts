/**
 * Kilometers via de reisaanvraag (HRMS `Travel Request`).
 *
 * Sommige sites vergoeden kilometers niet via Y-Next' eigen `Y Km Registratie`
 * maar via één `Travel Request` per medewerker per maand, met een regel per
 * rit (`Travel Itinerary`: `departure_date`, `custom_distance`,
 * `custom_journey_type`, `custom_travel_cost`). De werkgever dient die
 * reisaanvraag aan het eind van de maand in. Een rit die Y-Next dan in zijn
 * eigen doctype zet, komt daar nooit terecht.
 *
 * Zo'n site heeft het server script `km_rit_boeken`. Dat maakt de
 * reisaanvraag van de maand aan als hij er nog niet is (een medewerker mag dat
 * zelf niet), houdt de totale afstand en de kostenregel bij, en kent het
 * tarief van de maand. Y-Next vraagt één keer (`actie: "info"`) of het er is,
 * en leest en schrijft ritten dan hier; anders blijft alles bij
 * `Y Km Registratie` (zie `declaraties.ts`).
 *
 * Een rit uit de reisaanvraag heeft dezelfde vorm als een `KmRegistratie`, met
 * als `name` de naam van de itinerary-regel en `reisaanvraag` gevuld. Aan dat
 * laatste ziet de rest van de app waar hij vandaan komt.
 */

import { callMethod, fetchList, ApiError } from "./erpnext.ts";
import type { DeclaratieFilter, KmInvoer, KmRegistratie } from "./declaraties.ts";

const METHODE = "km_rit_boeken";

/** Eén rit zoals de lijstquery op `Travel Request` hem teruggeeft. */
export interface RuweReisRij {
  name: string;
  employee: string;
  employee_name?: string | null;
  docstatus: number;
  rij: string;
  departure_date?: string | null;
  travel_from?: string | null;
  travel_to?: string | null;
  custom_distance?: number | null;
  custom_journey_type?: string | null;
  custom_travel_cost?: number | null;
}

const VELDEN = [
  "name", "employee", "employee_name", "docstatus",
  "`tabTravel Itinerary`.name as rij",
  "`tabTravel Itinerary`.departure_date as departure_date",
  "`tabTravel Itinerary`.travel_from as travel_from",
  "`tabTravel Itinerary`.travel_to as travel_to",
  "`tabTravel Itinerary`.custom_distance as custom_distance",
  "`tabTravel Itinerary`.custom_journey_type as custom_journey_type",
  "`tabTravel Itinerary`.custom_travel_cost as custom_travel_cost",
];

/** Een adres uit ERPNext op één regel: regeleinden weg, geen komma aan het eind. */
function eenRegel(adres?: string | null): string {
  return String(adres || "").replace(/\s*\n\s*/g, " ").replace(/[\s,]+$/, "").trim();
}

export function ritUitReisaanvraag(r: RuweReisRij): KmRegistratie {
  const afstand = Number(r.custom_distance) || 0;
  const bedrag = Number(r.custom_travel_cost) || 0;
  const retour = r.custom_journey_type === "Return";
  return {
    name: r.rij,
    reisaanvraag: r.name,
    employee: r.employee,
    employee_name: r.employee_name || undefined,
    datum: String(r.departure_date || "").slice(0, 10),
    van: eenRegel(r.travel_from),
    naar: eenRegel(r.travel_to),
    kilometers: retour ? afstand / 2 : afstand,
    retour: retour ? 1 : 0,
    tarief_per_km: afstand > 0 && bedrag > 0 ? Math.round((bedrag / afstand) * 10000) / 10000 : undefined,
    bedrag,
    // De werkgever dient de reisaanvraag in als hij de maand verwerkt; per rit
    // is er geen aparte beoordeling.
    status: r.docstatus === 1 ? "Goedgekeurd" : "Concept",
  };
}

/**
 * De filters voor de lijstquery. `null` betekent: deze status bestaat bij
 * reisaanvragen niet (er wordt per rit niet ingediend of afgewezen), dus er
 * valt niets op te halen.
 */
export function reisaanvraagFilters(filter: DeclaratieFilter): unknown[][] | null {
  const filters: unknown[][] = [["docstatus", "!=", 2]];
  if (filter.status === "Concept") filters.push(["docstatus", "=", 0]);
  else if (filter.status === "Goedgekeurd") filters.push(["docstatus", "=", 1]);
  else if (filter.status) return null;
  if (filter.employee) filters.push(["employee", "=", filter.employee]);
  if (filter.vanaf) filters.push(["Travel Itinerary", "departure_date", ">=", `${filter.vanaf} 00:00:00`]);
  if (filter.tot) filters.push(["Travel Itinerary", "departure_date", "<=", `${filter.tot} 23:59:59`]);
  return filters;
}

/** De parameters voor `km_rit_boeken`. Een project kent de reisaanvraag niet. */
export function kmBoekArgs(invoer: KmInvoer, opties: { toch?: boolean } = {}): Record<string, unknown> {
  return {
    actie: "boeken",
    employee: invoer.employee,
    datum: invoer.datum,
    van: invoer.van,
    naar: invoer.naar,
    kilometers: invoer.kilometers,
    retour: invoer.retour ? 1 : 0,
    ...(opties.toch ? { toch: 1 } : {}),
  };
}

/**
 * Het tarief dat de reisaanvraag van die maand al hanteert. Het server script
 * rekent een nieuwe rit tegen dat tarief, dus het voorbeeldbedrag moet dat ook.
 */
export function maandTarief(
  ritten: ReadonlyArray<Pick<KmRegistratie, "datum" | "tarief_per_km">>,
  datum: string,
): number | undefined {
  const maand = String(datum).slice(0, 7);
  return ritten.find((r) => String(r.datum || "").startsWith(maand) && r.tarief_per_km)?.tarief_per_km;
}

/* ─────────────────────────── Server ─────────────────────────── */

let bron: Promise<boolean> | null = null;

/**
 * Boekt deze site km via reisaanvragen? Eén keer per sessie gevraagd. Een
 * antwoord van de server (ook een foutmelding: het script bestaat niet) is
 * definitief; een netwerkfout niet, dan wordt het de volgende keer opnieuw
 * gevraagd.
 */
export function kmViaReisaanvraag(): Promise<boolean> {
  if (!bron) {
    bron = callMethod(METHODE, { actie: "info" })
      .then((uit) => !!(uit as { reisaanvraag?: boolean } | null)?.reisaanvraag)
      .catch((err: unknown) => {
        if (!(err instanceof ApiError)) bron = null;
        return false;
      });
  }
  return bron;
}

export async function fetchKmRittenReisaanvraag(filter: DeclaratieFilter = {}): Promise<KmRegistratie[]> {
  const filters = reisaanvraagFilters(filter);
  if (!filters) return [];
  const rijen = await fetchList<RuweReisRij>("Travel Request", {
    fields: VELDEN,
    filters,
    order_by: "`tabTravel Itinerary`.departure_date desc",
    limit_page_length: filter.limit ?? 200,
  });
  return rijen.filter((r) => r.rij).map(ritUitReisaanvraag);
}

export interface KmBoekResultaat {
  /** Er staat op die dag al een rit met dezelfde afstand; niets geboekt. */
  dubbel: boolean;
  reisaanvraag: string;
  rij?: string;
  nieuwe_reisaanvraag?: boolean;
  afstand?: number;
  tarief?: number;
  bedrag?: number;
  totaal_afstand?: number;
  totaal_kosten?: number;
}

export async function boekKmRit(invoer: KmInvoer, opties: { toch?: boolean } = {}): Promise<KmBoekResultaat> {
  return (await callMethod(METHODE, kmBoekArgs(invoer, opties))) as KmBoekResultaat;
}

export interface KmRitWijziging {
  datum: string;
  van: string;
  naar: string;
  kilometers: number;
  retour: boolean;
}

/** Past een rit aan; hij houdt zijn eigen tarief. Geeft het nieuwe bedrag terug. */
export async function wijzigKmRit(rij: string, w: KmRitWijziging): Promise<{ bedrag?: number }> {
  return (await callMethod(METHODE, {
    actie: "wijzigen", rij, datum: w.datum, van: w.van, naar: w.naar,
    kilometers: w.kilometers, retour: w.retour ? 1 : 0,
  })) as { bedrag?: number };
}

export async function verwijderKmRit(rij: string): Promise<void> {
  await callMethod(METHODE, { actie: "verwijderen", rij });
}
