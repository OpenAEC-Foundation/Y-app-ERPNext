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

/**
 * De filters waarmee de **gemarkeerde** jaarstaat van (medewerker, jaar) wordt
 * opgezocht — een sheet die Y-next zelf al als jaarstaat heeft aangemerkt.
 */
export function yearSheetFilters(employee: string, year: number): unknown[][] {
  return [
    ["employee", "=", employee],
    ["docstatus", "=", 0],
    ["title", "=", yearSheetTitle(year)],
    ["start_date", ">=", `${year}-01-01`],
    ["start_date", "<=", `${year}-12-31`],
  ];
}

/**
 * De filters voor **adoptie**: élke concept-urenstaat van deze medewerker met
 * een `start_date` in dit jaar, ongeacht de titel.
 *
 * WAAROM ADOPTIE — zonder deze tweede stap maakte de eerste boeking van elke
 * medewerker gegarandeerd een nieuw document aan, óók als er al een handvol
 * concept-weekstaten van dat jaar lag. Dat is niet alleen rommelig (twee
 * parallelle urenstaten naast elkaar), het legde ook de naming-teller bloot:
 * op de doelinstance stond `Document Naming Settings` voor prefix `TS-2026-`
 * op 11 terwijl er al documenten tot `TS-2026-00294` bestonden, dus élke
 * insert botste op "TS-2026-00012 already exists". En omdat een mislukte
 * insert de tellerverhoging mee terugdraait, liep dat niet vanzelf los.
 * Adoptie haalt het aanmaken uit het normale pad: bestaat er al een concept
 * van dit jaar, dan wordt daar simpelweg aan toegevoegd.
 */
export function adoptableSheetFilters(employee: string, year: number): unknown[][] {
  return [
    ["employee", "=", employee],
    ["docstatus", "=", 0],
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
 * Zoekt de urenstaat waar een boeking van (medewerker, datum) in hoort.
 *
 * Twee stappen, in deze volgorde:
 *  1. de **gemarkeerde** jaarstaat (`title = "Urenstaat <jaar>"`);
 *  2. anders **adoptie**: de nieuwste concept-urenstaat van die medewerker met
 *     een `start_date` in dit jaar, ongeacht de titel.
 *
 * Sorteren op `start_date desc, modified desc`: de sheet van de meest recente
 * periode is de logische plek om vandaag aan toe te voegen (en bij gelijke
 * datum de laatst aangeraakte). Bij adoptie zet de append-update meteen de
 * titel-markering, zodat stap 1 het de volgende keer al vindt.
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
  const lookup = async (filters: unknown[][]) => {
    const list = await fetchList<{ name: string }>("Timesheet", {
      fields: ["name"],
      filters,
      limit_page_length: 1,
      order_by: "start_date desc, modified desc",
    });
    return list.length > 0 ? list[0].name : null;
  };
  try {
    return (
      (await lookup(yearSheetFilters(employee, year))) ??
      (await lookup(adoptableSheetFilters(employee, year)))
    );
  } catch {
    return null;
  }
}

/**
 * Herkent ERPNext's "naam bestaat al"-weigering bij een insert.
 *
 * Frappe gooit `frappe.exceptions.DuplicateEntryError` met een melding als
 * *"Timesheet TS-2026-00012 already exists"*; afhankelijk van het pad komt dat
 * als 409 of als 417 met de tekst in de body terug, dus we duck-typen op de
 * tekst in plaats van op een status.
 */
export function isDuplicateNameError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!message) return false;
  return /DuplicateEntryError/i.test(message) || /already exists/i.test(message);
}

/**
 * Een leesbare uitleg bij een duplicaat-naam, in plaats van ERPNext's kale
 * *"Timesheet TS-2026-00012 already exists"* — die zegt een medewerker niets
 * en verbergt dat het om een beheerdersinstelling gaat.
 */
export function duplicateNameHint(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const name = /([A-Z][\w-]*-\d[\w-]*)\s+already exists/i.exec(message)?.[1];
  return (
    `De urenstaat kon niet worden aangemaakt: ERPNext wil de naam ${name || "uit de reeks"} ` +
    "gebruiken, maar die bestaat al. De nummerreeks van Timesheet loopt achter op de " +
    "bestaande documenten. Vraag een beheerder de tellerstand bij te werken via " +
    "ERPNext → Instellingen → Document Naming Settings (prefix van de Timesheet-reeks, " +
    "'Update Series Number' hoger zetten dan het hoogste bestaande nummer)."
  );
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

/**
 * De PUT-payload waarmee één nieuwe regel aan de jaarstaat wordt toegevoegd.
 *
 * De titel-markering gaat **altijd** mee, niet alleen bij adoptie: dat is
 * idempotent (bij een al gemarkeerde sheet verandert er niets) en het spaart
 * een aparte "is dit een adoptie?"-vlag door de hele React-state heen. Zo is
 * een geadopteerde weekstaat na één boeking gemarkeerd en vindt stap 1 van
 * `resolveYearTimesheet` hem daarna direct.
 *
 * `start_date`/`end_date` gaan bewust NIET mee — die zijn read-only en leidt
 * ERPNext zelf af uit de regels (`set_dates()`).
 */
export function buildAppendPayload(
  existingLogs: Record<string, unknown>[] | undefined | null,
  parent: string,
  newLog: NewTimeLog,
  year: number
): { time_logs: Record<string, unknown>[]; title: string } {
  return {
    time_logs: [...normalizeExistingTimeLogs(existingLogs, parent), newLog],
    title: yearSheetTitle(year),
  };
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

/* ─────────────────────── Het boekpad zelf ─────────────────────── */

/** De ERPNext-calls die `bookTimeLog` nodig heeft — injecteerbaar zodat het pad testbaar is. */
export interface BookDeps {
  fetchList: FetchListFn;
  fetchDocument: <T>(doctype: string, name: string) => Promise<T>;
  createDocument: <T>(doctype: string, data: Record<string, unknown>) => Promise<T>;
  updateDocument: (doctype: string, name: string, data: Record<string, unknown>) => Promise<unknown>;
}

export interface BookResult {
  /** De urenstaat waar de regel in terecht is gekomen. */
  name: string;
  /** True als er een nieuwe urenstaat is aangemaakt. */
  created: boolean;
}

/**
 * Boekt één regel: appenden aan de jaarstaat, of er één aanmaken.
 *
 * Volgorde:
 *  1. `knownSheet` gebruiken als die bij dít jaar hoort (bespaart een lookup);
 *  2. anders `resolveYearTimesheet` (gemarkeerde jaarstaat → adoptie);
 *  3. anders aanmaken.
 *
 * **Duplicaat-vangnet.** Loopt het aanmaken stuk op een bestaande naam, dan
 * wordt er *eerst opnieuw geresolved* — in de tussentijd kan een parallelle
 * boeking (ander tabblad, andere gebruiker) al een sheet hebben gemaakt die we
 * gewoon kunnen adopteren. Levert dat niets op, dan is de naming-teller van de
 * instance achterhaald en heeft blind opnieuw proberen géén zin: Frappe draait
 * de tellerverhoging bij een mislukte insert mee terug, dus de volgende poging
 * kiest exact dezelfde naam. Daarom precies één herpoging, en anders een
 * leesbare uitleg (`duplicateNameHint`) in plaats van een stille stranding of
 * een oneindige lus.
 */
export async function bookTimeLog(
  params: {
    employee: string;
    company?: string;
    date: string;
    newLog: NewTimeLog;
    knownSheet?: { year: number; name: string } | null;
  },
  deps: BookDeps
): Promise<BookResult> {
  const { employee, company, date, newLog, knownSheet } = params;
  const year = bookingYear(date);
  if (!employee) throw new Error("Kies een medewerker voordat je boekt.");
  if (year === null) throw new Error("Kies een geldige boekdatum.");

  const appendTo = async (name: string): Promise<BookResult> => {
    const existing = await deps.fetchDocument<{ time_logs?: Record<string, unknown>[] }>("Timesheet", name);
    await deps.updateDocument("Timesheet", name, buildAppendPayload(existing.time_logs, name, newLog, year));
    return { name, created: false };
  };

  const target =
    knownSheet && knownSheet.year === year
      ? knownSheet.name
      : await resolveYearTimesheet(employee, date, deps.fetchList);
  if (target) return appendTo(target);

  try {
    const doc = await deps.createDocument<{ name: string }>(
      "Timesheet",
      buildCreatePayload({ employee, company, year, newLog })
    );
    return { name: doc.name, created: true };
  } catch (err) {
    if (!isDuplicateNameError(err)) throw err;
    const retry = await resolveYearTimesheet(employee, date, deps.fetchList);
    if (retry) return appendTo(retry);
    throw new Error(duplicateNameHint(err));
  }
}
