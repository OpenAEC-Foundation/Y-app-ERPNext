/**
 * Eén urenstaat per medewerker per kalenderjaar.
 *
 * Gebruikerswens: een medewerker heeft niet langer een Timesheet per week maar
 * **één doorlopende urenstaat per jaar**; elke boeking (dashboardwidget én de
 * tab "Uren boeken" op /timesheets) wordt daar als extra `time_logs`-regel aan
 * toegevoegd.
 *
 * WAAROM DIT EEN EIGEN MODULE IS — de resolve-stap is de enige plek waar het
 * jaarmodel echt "beslist" (welk jaar, welke sheet, appenden of aanmaken), en
 * dat is puur genoeg om zonder DOM/React te testen. De widget houdt alleen de
 * React-state over.
 *
 * HOE EEN JAARSTAAT HERKEND WORDT — twee signalen tegelijk, allebei nodig:
 *
 * 1. **`title === "Urenstaat <jaar>"`.** `title` is Timesheet's `title_field`
 *    en het enige vrij beschrijfbare tekstveld dat we bij create kunnen zetten
 *    (`note` is een Text Editor, `start_date`/`end_date` zijn read-only en
 *    worden door ERPNext uit de time_logs afgeleid — zie `set_dates()` in
 *    erpnext/projects/doctype/timesheet/timesheet.py).
 * 2. **`start_date` binnen dat jaar.** De titel alleen is een vrij tekstveld
 *    dat een gebruiker in de ERPNext-desk kan overtypen; de datumgrens houdt
 *    de match eerlijk. ERPNext zet `start_date` op `min(from_time)` van de
 *    regels, dus voor een sheet die met een boeking in jaar N begonnen is
 *    staat hij per definitie in N.
 *
 * En **`docstatus = 0`**: alleen een concept-sheet is nog te bewerken. Een
 * ingediende (docstatus 1) urenstaat weigert `time_logs`-wijzigingen via de
 * REST-API, dus die mag nooit als doel gekozen worden — anders faalt élke
 * boeking van de rest van het jaar.
 *
 * MIGRATIE — bestaande week-sheets blijven gewoon staan; er wordt niets
 * verplaatst. Ze matchen de titel niet, dus een nieuwe boeking landt in (of
 * maakt) de jaarstaat, en de overzichten blijven beide vormen tonen omdat die
 * op `time_logs` werken en niet op de sheet-indeling.
 *
 * KOSTEN VAN EEN LANGE STAAT (bekend en geaccepteerd, klein team). ERPNext
 * valideert bij élke save de héle child-tabel: `Timesheet.validate_time_logs()`
 * loopt alle regels en `validate_overlap()` doet per regel twee SQL-queries
 * (op `user` en op `employee`) plus een O(n)-`check_internal_overlap`. Een
 * append kost dus ~2N queries en O(N²) vergelijkingen; bij 2-3 boekingen per
 * werkdag zit een jaarstaat in Q4 rond de 450-700 regels. Escape-hatch als dat
 * merkbaar wordt, in volgorde van ingrijpendheid:
 *   1. ERPNext → **Projects Settings** → `ignore_employee_time_overlap` +
 *      `ignore_user_time_overlap` aanzetten. `validate_overlap_for()` keert dan
 *      meteen terug en de hele 2N+O(N²)-last verdwijnt — ten koste van de
 *      overlapmelding ("… is overlapping with TS-…") die de boekwidget nu toont.
 *   2. Overstappen op maandstaten: alleen `yearSheetTitle`/`bookingYear`/
 *      `yearSheetFilters` hoeven dan mee te veranderen, de rest van deze module
 *      en alle aanroepers blijven gelijk.
 * Bewust géén code hiervoor: het is een instelling, geen feature.
 */

/** Titel-prefix van een jaarstaat. Bewust niet vertaald: het is een sleutel in ERPNext-data, geen UI-tekst. */
export const YEAR_SHEET_TITLE_PREFIX = "Urenstaat";

/** De titel die een jaarstaat draagt, bv. `Urenstaat 2026`. */
export function yearSheetTitle(year: number): string {
  return `${YEAR_SHEET_TITLE_PREFIX} ${year}`;
}

/**
 * Het kalenderjaar van een boekdatum (`YYYY-MM-DD`, eventueel met tijd erachter).
 *
 * Bewust op de string en niet via `new Date(...)`: een `Date` schuift op een
 * machine met een negatieve UTC-offset een boeking van 1 januari terug naar het
 * vorige jaar, en dan zou de eerste boeking van het jaar in de vórige jaarstaat
 * landen.
 */
export function bookingYear(date: string): number | null {
  if (typeof date !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return year;
}

/** De filters waarmee de jaarstaat van (medewerker, jaar) wordt opgezocht. */
export function yearSheetFilters(employee: string, year: number): unknown[][] {
  return [
    ["employee", "=", employee],
    ["docstatus", "=", 0],
    ["title", "=", yearSheetTitle(year)],
    ["start_date", ">=", `${year}-01-01`],
    ["start_date", "<=", `${year}-12-31`],
  ];
}

/** Minimale vorm van `fetchList` die deze module nodig heeft (zo is hij mockbaar). */
export type FetchListFn = <T>(
  doctype: string,
  options: {
    fields?: string[];
    filters?: unknown[][];
    limit_page_length?: number;
    order_by?: string;
  }
) => Promise<T[]>;

/**
 * Zoekt de bestaande concept-jaarstaat voor (medewerker, jaar-van-boekdatum).
 *
 * Geeft `null` bij een lege/ongeldige medewerker of datum, en ook wanneer de
 * lookup faalt — de aanroeper valt dan terug op het aanmaakpad. Een mislukte
 * lookup mag nooit de boeking blokkeren; het slechtste geval is een tweede
 * sheet, niet een verloren uur.
 */
export async function resolveYearTimesheet(
  employee: string,
  date: string,
  fetchList: FetchListFn
): Promise<string | null> {
  const year = bookingYear(date);
  if (!employee || year === null) return null;
  try {
    const list = await fetchList<{ name: string }>("Timesheet", {
      fields: ["name"],
      filters: yearSheetFilters(employee, year),
      limit_page_length: 1,
      order_by: "modified desc",
    });
    return list.length > 0 ? list[0].name : null;
  } catch {
    return null;
  }
}

/** Eén regel zoals de widget hem opbouwt vóór verzending. */
export type NewTimeLog = Record<string, unknown>;

/**
 * Herbouwt de bestaande `time_logs` van een sheet tot een payload die ERPNext
 * accepteert bij een PUT.
 *
 * Frappe vervangt bij een save de héle child-tabel, dus de bestaande regels
 * moeten compleet mee — inclusief hun `name` (anders worden het duplicaten) en
 * de child-metadata (`doctype`/`parent`/`parenttype`/`parentfield`). Lege
 * regels (zonder `from_time` of zonder uren) worden weggelaten: ERPNext weigert
 * die bij validatie ("Row N: Hours value must be greater than zero"), en ze
 * kunnen in een handmatig in de desk bewerkte sheet blijven hangen.
 *
 * Alléén de velden die de UI kent worden overgenomen; afgeleide velden
 * (`hours` uitgezonderd) en de billing-kolommen op permlevel 1 laat ERPNext
 * zelf herberekenen.
 */
export function normalizeExistingTimeLogs(
  logs: Record<string, unknown>[] | undefined | null,
  parent: string
): Record<string, unknown>[] {
  return (logs || [])
    .filter((log) => log && log.from_time && log.hours)
    .map((log) => ({
      name: log.name,
      doctype: "Timesheet Detail",
      parent,
      parenttype: "Timesheet",
      parentfield: "time_logs",
      activity_type: log.activity_type,
      from_time: log.from_time,
      to_time: log.to_time,
      hours: log.hours,
      project: log.project,
      task: log.task,
      description: log.description,
      is_billable: log.is_billable,
    }));
}

/** De PUT-payload waarmee één nieuwe regel aan een bestaande jaarstaat wordt toegevoegd. */
export function buildAppendPayload(
  existingLogs: Record<string, unknown>[] | undefined | null,
  parent: string,
  newLog: NewTimeLog
): { time_logs: Record<string, unknown>[] } {
  return { time_logs: [...normalizeExistingTimeLogs(existingLogs, parent), newLog] };
}

/**
 * De POST-payload voor een nieuwe jaarstaat.
 *
 * `company` wordt alleen meegestuurd als hij bekend is — op instances zonder
 * actieve company vult ERPNext hem zelf uit de Employee, en een leeg
 * Link-veld zou juist een validatiefout geven.
 */
export function buildCreatePayload(params: {
  employee: string;
  company?: string;
  year: number;
  newLog: NewTimeLog;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    employee: params.employee,
    title: yearSheetTitle(params.year),
    time_logs: [params.newLog],
  };
  if (params.company) payload.company = params.company;
  return payload;
}
