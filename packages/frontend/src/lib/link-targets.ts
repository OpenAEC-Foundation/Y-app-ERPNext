/**
 * Koppelen van een mail aan wélk document dan ook.
 *
 * Waarom dit bestaat: de mailpagina kon alleen aan een project koppelen, en
 * verder alleen dat wat een herkende bedoeling opleverde ("dit lijkt een
 * inkoopfactuur"). Herkent hij die bedoeling niet — en dat gebeurt, want een
 * factuurmail ziet er lang niet altijd uit als een factuurmail — dan was er
 * geen weg meer. Een koppeling is geen bedoeling: je weet zelf waar deze mail
 * bij hoort, en dat moet je gewoon kunnen aanwijzen.
 *
 * Zoeken gaat via `frappe.desk.search.search_link`, hetzelfde endpoint dat de
 * ERPNext-desk voor elk Link-veld gebruikt. Dat scheelt per doctype uitzoeken
 * welk veld de titel is, en het respecteert de leesrechten van de gebruiker:
 * wat je in ERPNext niet mag zien, komt hier ook niet terug.
 */

import { callMethod, fetchList } from "./erpnext.ts";

/** Eén zoekresultaat: de docname plus de regel eronder. */
export interface LinkDoel {
  /** Docname — dit komt in `reference_name`. */
  naam: string;
  /** De omschrijving die ERPNext zelf bij dit document toont. */
  omschrijving?: string;
}

/**
 * Waar je in de praktijk aan koppelt, in de volgorde waarin je het zoekt.
 * Staat vóór de volledige lijst van 500+ doctypes, want zonder voorsortering
 * is "kies maar iets" geen keuze maar een zoekopdracht.
 */
export const VEELGEBRUIKTE_DOCTYPES = [
  "Project",
  "Task",
  "Purchase Invoice",
  "Sales Invoice",
  "Quotation",
  "Sales Order",
  "Purchase Order",
  "Customer",
  "Supplier",
  "Lead",
  "Opportunity",
  "Employee",
  "Delivery Note",
  "Timesheet",
] as const;

/**
 * Doctypes waar niet aan te koppelen valt: onderliggende tabellen (die hebben
 * geen eigen pagina) en instellingen-documenten (daar is er maar één van, dus
 * "welke" is geen vraag).
 */
const DOCTYPE_FILTERS: [string, string, unknown][] = [
  ["issingle", "=", 0],
  ["istable", "=", 0],
];

let doctypeCache: { at: number; namen: string[] } | null = null;
const DOCTYPE_TTL_MS = 10 * 60 * 1000;

/**
 * Alle doctypes waar een koppeling naartoe kan wijzen, alfabetisch. Wordt pas
 * opgehaald als de kiezer opengaat — het zijn er honderden en de meeste
 * gebruikers komen niet verder dan de veelgebruikte.
 */
export async function haalKoppelbareDoctypes(force = false): Promise<string[]> {
  if (!force && doctypeCache && Date.now() - doctypeCache.at < DOCTYPE_TTL_MS) {
    return doctypeCache.namen;
  }
  const rijen = await fetchList<{ name: string }>("DocType", {
    fields: ["name"],
    filters: DOCTYPE_FILTERS,
    limit_page_length: 0,
    order_by: "name asc",
  });
  const namen = rijen.map((r) => r.name).filter(Boolean);
  doctypeCache = { at: Date.now(), namen };
  return namen;
}

/**
 * De doctypes zoals ze in de kiezer staan: eerst de veelgebruikte, daarna de
 * rest, zonder dubbelen. Een zoekterm filtert door beide groepen heen — dan
 * blijft de volgorde staan maar valt de ruis weg.
 */
export function sorteerDoctypes(alle: string[], zoek: string): string[] {
  const q = zoek.trim().toLowerCase();
  const past = (naam: string) => !q || naam.toLowerCase().includes(q);
  const veel = VEELGEBRUIKTE_DOCTYPES.filter(past);
  const gezien = new Set<string>(veel);
  const rest = alle.filter((n) => past(n) && !gezien.has(n));
  return [...veel, ...rest];
}

/**
 * Zoek documenten van één doctype. Een lege zoekterm is geldig: ERPNext geeft
 * dan de eerste documenten terug, en dat is precies wat je wil bij een lijst
 * die je nog niet kent.
 */
export async function zoekKoppeldoelen(
  doctype: string,
  zoek: string,
  aantal = 20,
): Promise<LinkDoel[]> {
  const antwoord = await callMethod("frappe.desk.search.search_link", {
    doctype,
    txt: zoek.trim(),
    page_length: aantal,
  });
  return leesZoekantwoord(antwoord);
}

/**
 * Pelt de resultaten uit wat `search_link` teruggeeft. De vorm verschilt per
 * Frappe-versie — soms `{message: [...]}`, soms `{results: [...]}`, soms de
 * lijst zelf — en een doctype zonder treffers geeft niets terug. Alle vier
 * horen "geen resultaten" te betekenen en geen lege pagina met een fout.
 */
export function leesZoekantwoord(antwoord: unknown): LinkDoel[] {
  const lijst = Array.isArray(antwoord)
    ? antwoord
    : Array.isArray((antwoord as { message?: unknown })?.message)
      ? (antwoord as { message: unknown[] }).message
      : Array.isArray((antwoord as { results?: unknown })?.results)
        ? (antwoord as { results: unknown[] }).results
        : [];
  const uit: LinkDoel[] = [];
  for (const rij of lijst) {
    if (typeof rij === "string") { uit.push({ naam: rij }); continue; }
    const naam = (rij as { value?: unknown })?.value;
    if (typeof naam !== "string" || !naam) continue;
    const omschrijving = (rij as { description?: unknown })?.description;
    uit.push({
      naam,
      omschrijving: typeof omschrijving === "string" ? opschonen(omschrijving) : undefined,
    });
  }
  return uit;
}

/**
 * De omschrijving van ERPNext bevat soms HTML (adresvelden komen met `<br>`
 * uit de database). Die hoort als tekst op één regel te staan, niet als
 * opmaak — we zetten hem in een tekstknoop, dus meesturen zou hem letterlijk
 * tonen.
 */
function opschonen(waarde: string): string {
  return waarde
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s*,\s*(?=,|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
