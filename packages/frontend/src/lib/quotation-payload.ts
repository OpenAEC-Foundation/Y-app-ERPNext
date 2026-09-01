/**
 * Bouwt de payload van een **Quotation** (offerte) voor ERPNext v16, en zegt
 * vooraf welke velden nog ontbreken.
 *
 * Pure module — geen netwerk, geen React — zelfde opzet en om dezelfde reden
 * als `lead-payload.ts`: de vorm is **live uitgeprobeerd** tegen de
 * doelinstance (Frappe 16.19.0 / ERPNext 16.16.0), want de DocType-meta
 * vertelt niet wat je écht moet meesturen.
 *
 * ── Wat de meta zegt, en wat er in de praktijk van klopt ──────────────────
 *
 * `Quotation` heeft **tien** verplichte velden volgens de meta:
 * `naming_series`, `quotation_to`, `transaction_date`, `order_type`,
 * `company`, `currency`, `conversion_rate`, `selling_price_list`,
 * `price_list_currency`, `plc_conversion_rate`, `items` en `status`.
 * Zeven daarvan vult ERPNext zelf in `set_missing_values`, mits je de
 * *partij* en het *bedrijf* meestuurt. Live geverifieerd: een insert met
 * alleen
 *
 *     quotation_to, party_name, company, transaction_date, valid_till, items
 *
 * levert een concept-offerte op met `currency: "EUR"`, `conversion_rate: 1`,
 * `selling_price_list: "Standard Selling"`, `order_type: "Sales"`,
 * `naming_series: "SAL-QTN-.YYYY.-"` en `status: "Draft"` — allemaal afgeleid
 * uit de Company- en Customer-defaults. Daarom stuurt deze payload valuta en
 * prijslijst **alleen mee als de aanroeper ze expliciet kent**: een lege
 * waarde meesturen zou de afleiding juist kapotmaken.
 *
 * ── Vier dingen die je niet uit de meta afleidt ───────────────────────────
 *
 * 1. **`party_name` is een Dynamic Link op `quotation_to`.** Beide moeten in
 *    dezelfde payload; alleen `party_name` sturen levert een lege koppeling
 *    zonder foutmelding. `quotation_to` mag `"Customer"` of `"Lead"` zijn —
 *    de Lead-variant is live getest en vult `customer_name` uit
 *    `Lead.company_name`.
 * 2. **`item_code` is optioneel, `item_name` niet.** Een regel zonder
 *    item_code (vrije tekst — precies wat je uit een mail overneemt) wordt
 *    geaccepteerd, mits `item_name`, `qty`, `uom` én `conversion_factor`
 *    meegaan. `uom` en `conversion_factor` zijn verplicht op *Quotation Item*
 *    en worden alleen automatisch gevuld wanneer er een `item_code` is; bij
 *    een vrije regel moet je ze zelf zetten, anders faalt de insert op een
 *    veld dat de gebruiker nooit heeft gezien. Vandaar `DEFAULT_UOM`.
 * 3. **Er is geen `custom_description`-veld op deze instance.** De
 *    mailomschrijving hoort in `terms` (Text Editor) — dat veld bestaat wél
 *    en verschijnt op de afdruk. Frappe negeert onbekende sleutels stil, dus
 *    een fout veld levert geen melding op maar wél een lege offerte.
 * 4. **`valid_till` is niet verplicht**, maar een offerte zonder
 *    geldigheidsdatum is er in de praktijk geen. Default: 30 dagen na de
 *    offertedatum (`defaultValidTill`).
 *
 * Wat hier bewust NIET gebeurt: indienen (`docstatus: 1`). Eén klik in de
 * webmail mag een concept opleveren, geen verstuurde offerte.
 */

import { isoDatePart, todayIso } from "./lead-payload.ts";

/* ─────────────────────────────── Vormen ──────────────────────────────── */

/** Aan wie de offerte gericht is. Dynamic-Link-doel van `party_name`. */
export type QuotationParty = "Customer" | "Lead";

export interface QuotationLine {
  /** Optioneel: alleen als de gebruiker een bestaand Item koos. */
  itemCode?: string;
  /** Verplicht — dit is wat er op de offerte staat. */
  itemName: string;
  /** Toelichting; belandt in de kolom "Omschrijving". */
  description?: string;
  qty: number;
  rate: number;
  /** Eenheid; leeg → `DEFAULT_UOM`. */
  uom?: string;
}

export interface QuotationInput {
  /** `"Customer"` of `"Lead"`. */
  partyType: QuotationParty;
  /** Docname van de Customer of Lead. */
  party: string;
  /** Company-docname. Verplicht. */
  company: string;
  /** Offertedatum (`yyyy-mm-dd`), doorgaans de maildatum. */
  transactionDate: string;
  /** Geldig tot (`yyyy-mm-dd`); leeg = veld weglaten. */
  validTill?: string;
  lines: QuotationLine[];
  /** Contactadres van de aanvrager; doorgaans de afzender van de mail. */
  contactEmail?: string;
  /** Valuta-docname; leeg = ERPNext leidt hem af uit de bedrijfsdefaults. */
  currency?: string;
  /** Price List-docname; leeg = ERPNext leidt hem af. */
  sellingPriceList?: string;
  /** Voorwaarden/omschrijving; hier belandt de mailtekst. */
  terms?: string;
}

export const QUOTATION_NAMING_SERIES = "SAL-QTN-.YYYY.-";
export const DEFAULT_ORDER_TYPE = "Sales";
/** ERPNext's eigen basiseenheid; bestaat op elke instance. */
export const DEFAULT_UOM = "Nos";
/** Standaard geldigheidsduur van een offerte, in dagen. */
export const DEFAULT_VALID_DAYS = 30;

/* ──────────────────────────── Geldigheid ─────────────────────────────── */

/**
 * Wat er nog ontbreekt. Geeft veldnamen terug (geen zinnen) zodat de dialoog
 * ze kan vertalen én de bijbehorende invoervelden kan markeren — zelfde
 * afspraak als `validateLeadInput`.
 *
 * Regels raken hier hun eigen index mee: `lines.0.qty` markeert precies die
 * cel, want "aantal moet groter dan nul zijn" is nutteloos als je vier regels
 * hebt ingevuld.
 */
export function validateQuotationInput(input: QuotationInput): string[] {
  const missing: string[] = [];
  if (!input.party?.trim()) missing.push("party");
  if (!input.company?.trim()) missing.push("company");
  if (!isIsoDate(input.transactionDate)) missing.push("transactionDate");
  if (input.validTill && !isIsoDate(input.validTill)) missing.push("validTill");
  if (input.validTill && isIsoDate(input.transactionDate) && input.validTill < input.transactionDate) {
    missing.push("validTill");
  }
  if (input.contactEmail && !isEmailish(input.contactEmail)) missing.push("contactEmail");

  const lines = input.lines ?? [];
  if (lines.length === 0) {
    missing.push("lines");
  } else {
    lines.forEach((line, i) => {
      if (!line.itemName?.trim()) missing.push(`lines.${i}.itemName`);
      if (!Number.isFinite(line.qty) || line.qty <= 0) missing.push(`lines.${i}.qty`);
      // Een tarief van 0 is geldig (een post "in overleg" of een gratis
      // onderdeel); negatief is dat niet.
      if (!Number.isFinite(line.rate) || line.rate < 0) missing.push(`lines.${i}.rate`);
    });
  }
  return missing;
}

/* ───────────────────────────── De payload ────────────────────────────── */

export function buildQuotationPayload(input: QuotationInput): Record<string, unknown> {
  const missing = validateQuotationInput(input);
  if (missing.length > 0) {
    throw new Error(`Onvolledige offerte: ${missing.join(", ")}`);
  }

  const payload: Record<string, unknown> = {
    naming_series: QUOTATION_NAMING_SERIES,
    quotation_to: input.partyType,
    party_name: input.party.trim(),
    company: input.company.trim(),
    transaction_date: input.transactionDate,
    order_type: DEFAULT_ORDER_TYPE,
    // Expliciet, ook al is het de default: een concept is de hele belofte van
    // deze knop en dat hoort in de payload te staan, niet in een aanname.
    status: "Draft",
    docstatus: 0,
    items: input.lines.map((line) => {
      const row: Record<string, unknown> = {
        item_name: truncate(line.itemName.trim(), 140),
        qty: line.qty,
        rate: line.rate,
        uom: line.uom?.trim() || DEFAULT_UOM,
        conversion_factor: 1,
      };
      if (line.itemCode?.trim()) row.item_code = line.itemCode.trim();
      const description = line.description?.trim();
      // Zonder eigen omschrijving valt ERPNext terug op de item-omschrijving;
      // bij een vrije regel is dat de regelnaam zelf. Beter dan een lege cel.
      row.description = description || truncate(line.itemName.trim(), 500);
      return row;
    }),
  };

  if (input.validTill) payload.valid_till = input.validTill;
  if (input.contactEmail?.trim()) payload.contact_email = input.contactEmail.trim();
  // Alleen meesturen wanneer ze écht bekend zijn — zie de moduletoelichting.
  if (input.currency?.trim()) payload.currency = input.currency.trim();
  if (input.sellingPriceList?.trim()) payload.selling_price_list = input.sellingPriceList.trim();
  const terms = input.terms?.trim();
  if (terms) payload.terms = terms;
  return payload;
}

/* ──────────────────────────────── Hulp ───────────────────────────────── */

/**
 * Geldig tot: `days` dagen ná de offertedatum. Rekent op UTC-middernacht zodat
 * een zomertijd-overgang binnen het venster er geen dag af of bij haalt.
 */
export function defaultValidTill(fromIso: string, days: number = DEFAULT_VALID_DAYS): string {
  const base = isIsoDate(fromIso) ? fromIso : todayIso();
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * De offertedatum die bij een mail hoort: de maildatum als die bruikbaar is,
 * anders vandaag. Een offerte terugdateren naar een mail van vorige maand is
 * gewenst — de aanvraag kwam toen binnen.
 */
export function quotationDateFromMail(mailDate: string | undefined): string {
  return isoDatePart(mailDate) || todayIso();
}

/**
 * Eerste regel van een offerte op basis van het mailonderwerp. Geen bedragen
 * en geen aantallen verzinnen: aantal 1, tarief 0. De gebruiker vult de prijs
 * in — dat is precies het stuk dat niet uit de mail te halen valt.
 */
export function lineFromMailSubject(subject: string): QuotationLine {
  const name = (subject || "").trim();
  return {
    itemName: name ? truncate(name, 140) : "",
    description: name,
    qty: 1,
    rate: 0,
    uom: DEFAULT_UOM,
  };
}

/** Regeltotaal; de dialoog toont hem en ERPNext rekent hem zelf ook uit. */
export function lineAmount(line: QuotationLine): number {
  const qty = Number.isFinite(line.qty) ? line.qty : 0;
  const rate = Number.isFinite(line.rate) ? line.rate : 0;
  return Math.round(qty * rate * 100) / 100;
}

export function quotationTotal(lines: QuotationLine[]): number {
  return Math.round(lines.reduce((sum, l) => sum + lineAmount(l), 0) * 100) / 100;
}

function isIsoDate(value: string | undefined): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isEmailish(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** `item_name` is een Data-veld (140 tekens); een te lange waarde zou de
 *  insert laten falen op een lengtefout in plaats van op iets begrijpelijks. */
function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
