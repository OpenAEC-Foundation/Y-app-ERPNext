/**
 * Eén antwoord op de vraag "onder welk bedrijf valt dit scherm?".
 *
 * Y-next draait op een instance met vijf Companies. Tot nu toe beantwoordde
 * elk scherm die vraag zelf, en op twee manieren tegelijk:
 *
 * - `getActiveCompany()` — de expliciete voorkeur van de gebruiker, opgeslagen
 *   in localStorage. Prima, maar leeg zolang niemand hem heeft gezet.
 * - `rows[0]?.name` uit een `fetchList("Company", …)` — het vangnet in
 *   `BookPurchaseInvoiceDialog` en `CreateLeadDialog`. Dat pakt op deze
 *   instance **"Castellum Rosarum"**, want dat is alfabetisch het eerste
 *   bedrijf. Terwijl ERPNext zelf al weet dat "OpenAEC Studio BV" het
 *   standaardbedrijf is: het staat in `Global Defaults.default_company`.
 *
 * Deze module maakt daar één volgorde van, en die volgorde is de hele module:
 *
 * 1. **De gebruikersvoorkeur** (`getActiveCompany()`). Wie bewust een ander
 *    bedrijf kiest, houdt dat — ook als ERPNext iets anders als standaard
 *    heeft staan. Dat is het enige signaal dat van een mens komt.
 * 2. **`Global Defaults.default_company`**. Het antwoord dat de beheerder in
 *    ERPNext zelf heeft ingesteld. Geen leesrecht, geen waarde, of een bedrijf
 *    dat niet (meer) bestaat → door naar 3.
 * 3. **Het alfabetisch eerste bedrijf.** Bewust *gesorteerd* en niet "de
 *    eerste rij die de server toevallig teruggeeft": een vangnet dat per
 *    request kan wisselen is erger dan een vangnet dat consequent hetzelfde
 *    verkeerde antwoord geeft, want alleen het tweede valt op.
 *
 * `pickDefaultCompany` is **puur** — geen netwerk, geen localStorage — zodat
 * alle drie de takken met `node --test` te controleren zijn. `resolveDefaultCompany`
 * is de asynchrone schil eromheen.
 *
 * **Let op de betekenis van leeg.** Op de financiële pagina's staat een
 * `CompanySelect` mét "Alle bedrijven"-optie; `""` is dáár een geldige keuze
 * ("niet filteren") en géén ontbrekend antwoord. Die schermen horen dus juist
 * *niet* door deze resolver te lopen. Hij is voor de plekken waar het bedrijf
 * een **verplicht veld** is: de dialogen die een document aanmaken.
 */

import { useEffect, useRef, useState } from "react";
import { fetchDocument, fetchList } from "./erpnext.ts";
import { getActiveCompany } from "./instances.ts";

export interface CompanyOption {
  name: string;
  company_name?: string;
}

/* ─────────────────────────── De keuzeregel ───────────────────────────── */

/**
 * Alfabetisch, met een stabiele vergelijking. `localeCompare` met `numeric`
 * zodat "Bedrijf 2" vóór "Bedrijf 10" komt; de sorteervolgorde van de server
 * hangt van de collation van de database af en is dus geen betrouwbare bron.
 */
export function sortCompanies(companies: CompanyOption[]): CompanyOption[] {
  return [...companies].sort((a, b) =>
    a.name.localeCompare(b.name, "nl", { numeric: true, sensitivity: "base" }),
  );
}

function knownIn(companies: CompanyOption[] | undefined, value: string): boolean {
  // Zonder lijst valt er niets te controleren; dan telt de waarde als geldig.
  // Anders zou een mislukte Company-fetch de voorkeur van de gebruiker wissen.
  if (!companies || companies.length === 0) return true;
  return companies.some((c) => c.name === value);
}

/**
 * De volgorde uit de moduletoelichting, als pure functie.
 *
 * Een voorkeur of standaard die niet (meer) in de lijst voorkomt wordt
 * overgeslagen in plaats van doorgegeven: een verwijderd of hernoemd bedrijf
 * zou anders een `LinkValidationError` opleveren op het moment van opslaan,
 * ver van de plek waar de waarde vandaan kwam.
 */
export function pickDefaultCompany(args: {
  /** Expliciete keuze van de gebruiker (`getActiveCompany()`). */
  preference?: string;
  /** `Global Defaults.default_company`. */
  globalDefault?: string;
  /** Wat er te kiezen valt. Leeg/onbekend = geen controle mogelijk. */
  companies?: CompanyOption[];
}): string {
  const preference = (args.preference || "").trim();
  if (preference && knownIn(args.companies, preference)) return preference;

  const globalDefault = (args.globalDefault || "").trim();
  if (globalDefault && knownIn(args.companies, globalDefault)) return globalDefault;

  const sorted = sortCompanies(args.companies ?? []);
  return sorted[0]?.name ?? "";
}

/* ────────────────────────── De opgehaalde kant ───────────────────────── */

let globalDefaultCache: { at: number; value: string } | null = null;
let companiesCache: { at: number; rows: CompanyOption[] } | null = null;
/** Ruim: het standaardbedrijf en de bedrijvenlijst wijzigen hooguit een paar
 *  keer per jaar, en `erpnext.ts` heeft er zelf al een 30-seconden-cache voor. */
const TTL_MS = 15 * 60_000;

/** Alleen voor tests en na een instance-wissel. */
export function resetDefaultCompanyCache(): void {
  globalDefaultCache = null;
  companiesCache = null;
}

/**
 * `Global Defaults` is een Single-doctype; hij wordt gelezen als
 * `/api/resource/Global Defaults/Global Defaults`. Geen leesrecht (403) of
 * geen waarde → `""`, want dit is een *voorkeur* en geen vereiste.
 */
export async function fetchGlobalDefaultCompany(force = false): Promise<string> {
  if (!force && globalDefaultCache && Date.now() - globalDefaultCache.at < TTL_MS) {
    return globalDefaultCache.value;
  }
  let value = "";
  try {
    const doc = await fetchDocument<{ default_company?: string }>("Global Defaults", "Global Defaults");
    value = (doc?.default_company || "").trim();
  } catch {
    // Zie de toelichting hierboven: stilzwijgend door naar het vangnet.
  }
  globalDefaultCache = { at: Date.now(), value };
  return value;
}

/**
 * De bedrijvenlijst. Bewust een eigen query en niet `useCompanies()` uit
 * `DataContext`: de mail-popout (`/mail/view`) rendert buiten `DataProvider`,
 * en juist daar staan de dialogen die deze waarde nodig hebben.
 */
export async function fetchCompanyOptions(force = false): Promise<CompanyOption[]> {
  if (!force && companiesCache && Date.now() - companiesCache.at < TTL_MS) {
    return companiesCache.rows;
  }
  let rows: CompanyOption[] = [];
  try {
    rows = await fetchList<CompanyOption>("Company", {
      fields: ["name", "company_name"],
      limit_page_length: 0,
      order_by: "name asc",
    });
  } catch {
    // Zonder lijst blijft alleen de voorkeur/standaard over; die zijn dan
    // niet te controleren, maar wel bruikbaar (zie `knownIn`).
  }
  rows = sortCompanies(rows);
  companiesCache = { at: Date.now(), rows };
  return rows;
}

/** De gebruikersvoorkeur, veilig ook zonder `localStorage` (node --test). */
function safePreference(): string {
  try {
    return getActiveCompany();
  } catch {
    return "";
  }
}

/**
 * Het standaardbedrijf, volgens de volgorde uit de moduletoelichting.
 *
 * `companies` mag meegegeven worden door een scherm dat de lijst tóch al
 * ophaalt (dan is er geen tweede query); anders haalt de resolver hem zelf op.
 */
export async function resolveDefaultCompany(opts?: {
  companies?: CompanyOption[];
  /** Overschrijft `getActiveCompany()`; alleen voor tests en popouts. */
  preference?: string;
}): Promise<string> {
  const preference = opts?.preference ?? safePreference();
  const [companies, globalDefault] = await Promise.all([
    opts?.companies ? Promise.resolve(opts.companies) : fetchCompanyOptions(),
    fetchGlobalDefaultCompany(),
  ]);
  return pickDefaultCompany({ preference, globalDefault, companies });
}

/* ─────────────────────────────── React ───────────────────────────────── */

export interface DefaultCompanyState {
  /** Het gekozen bedrijf; `""` zolang de resolver nog niets terug heeft. */
  company: string;
  setCompany: (value: string) => void;
  /** De bedrijvenlijst, gesorteerd — zodat een `<select>` niet nóg een query doet. */
  companies: CompanyOption[];
}

/**
 * Het bedrijf-veld van een dialoog, met de resolver erachter.
 *
 * Start op de gebruikersvoorkeur (synchroon, dus het veld staat meteen goed
 * voor wie er een heeft) en vult zichzelf aan zodra ERPNext antwoordt. De
 * `touched`-ref is het belangrijke detail: kiest de gebruiker binnen die
 * paar honderd milliseconden zélf een bedrijf, dan mag het antwoord van de
 * server dat niet meer overschrijven.
 */
export function useDefaultCompany(): DefaultCompanyState {
  const [company, setCompanyState] = useState<string>(() => safePreference());
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const touched = useRef(false);

  const setCompany = (value: string) => {
    touched.current = true;
    setCompanyState(value);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await fetchCompanyOptions();
      if (cancelled) return;
      setCompanies(rows);
      const resolved = await resolveDefaultCompany({ companies: rows });
      if (cancelled || touched.current) return;
      setCompanyState((prev) => (prev && knownIn(rows, prev) ? prev : resolved));
    })();
    return () => { cancelled = true; };
  }, []);

  return { company, setCompany, companies };
}
