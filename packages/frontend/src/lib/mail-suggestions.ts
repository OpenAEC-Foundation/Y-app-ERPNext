/**
 * "Nee, dit is het niet" — één onderdrukking voor álle mailvoorstellen.
 *
 * Y-next stelt bij een mail hooguit één ding voor: hem inboeken als
 * inkoopfactuur, aanmaken als lead, aanmaken als offerteaanvraag, of koppelen
 * aan een project. Elk van die voorstellen heeft dezelfde wegklik-knop nodig,
 * en die moet per soort werken: iemand die zegt "dit is geen factuur" heeft
 * daarmee niet gezegd "dit hoort ook bij geen enkel project".
 *
 * **Bewust localStorage**, net als de eerste versie voor inkoopfacturen:
 *
 * - Een ERPNext-tag zou als zichtbare mailmap in de mappenlijst opduiken (zie
 *   `MAIL_TAG_NAME_PREFIX` in `mail-erpnext.ts`).
 * - `Y Next Setting` is voor schrijven System-Manager-only, dus voor een
 *   gewone medewerker zou de knop een 403 opleveren en dus niets doen. Een
 *   knop die niets doet is erger dan een voorkeur die per apparaat geldt.
 *
 * Prijs: de afwijzing geldt per apparaat. Dat is acceptabel omdat het effect
 * klein en omkeerbaar is — het voorstel verschijnt elders opnieuw.
 *
 * De *positieve* kant heeft deze opslag niet nodig: een afgehandelde mail
 * draagt `reference_doctype` en is daarmee server-side, voor iedereen, als
 * afgehandeld herkenbaar.
 */

export type SuggestionKind = "purchase-invoice" | "lead" | "quote-request" | "project";

const KEY = "y_next_dismissed_mail_suggestions";
/**
 * De sleutel van vóór de generieke laag. Hij wordt bij de eerste lezing
 * meegenomen (en niet gewist), zodat wie al mails had weggeklikt ze niet
 * allemaal opnieuw voorgeschoteld krijgt.
 */
const LEGACY_INVOICE_KEY = "y_next_not_purchase_invoice";

/** Zoveel afwijzingen worden onthouden; daarna valt de oudste eruit. */
const CAP = 1000;

/** Opslagvorm: `<kind>::<communication>` in één platte, geordende lijst. */
function entryFor(communication: string, kind: SuggestionKind): string {
  return `${kind}::${communication}`;
}

function readRaw(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function readLegacy(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_INVOICE_KEY) || "null");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .map((name) => entryFor(name, "purchase-invoice"));
  } catch {
    return [];
  }
}

/** Onthoud dat dit voorstel voor deze mail niet klopt. */
export function dismissMailSuggestion(communication: string, kind: SuggestionKind): void {
  if (!communication) return;
  try {
    const entry = entryFor(communication, kind);
    const list = readRaw().filter((v) => v !== entry);
    list.push(entry);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-CAP)));
  } catch { /* quota — dan komt het voorstel terug, meer niet */ }
}

/**
 * Alle afwijzingen als set van `<kind>::<communication>`. De aanroeper houdt
 * deze in React-state en test er per rij tegen — één lees-actie per render in
 * plaats van één per bericht.
 */
export function readDismissedMailSuggestions(): Set<string> {
  return new Set([...readLegacy(), ...readRaw()]);
}

/** Zit dit voorstel in de afwijzingen? */
export function isMailSuggestionDismissed(
  dismissed: Set<string>,
  communication: string,
  kind: SuggestionKind,
): boolean {
  return dismissed.has(entryFor(communication, kind));
}
