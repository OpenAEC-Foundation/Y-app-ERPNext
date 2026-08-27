/**
 * Bouwt de payloads van een **Lead** en een **Opportunity** voor ERPNext v16,
 * en zegt vooraf welke velden nog ontbreken.
 *
 * Pure module — geen netwerk, geen React — zodat de payload met `node --test`
 * te controleren is zonder een sessie op te tuigen. De schrijfkant staat in
 * `lead.ts`. Zelfde opzet als `purchase-invoice-payload.ts`, en om dezelfde
 * reden: de vorm is **live uitgeprobeerd** tegen de doelinstance (Frappe
 * 16.19.0 / ERPNext 16.16.0), want vier dingen leid je niet uit de
 * DocType-meta af:
 *
 * 1. **`Lead.source` bestaat niet meer.** ERPNext v16 heeft dat vervangen door
 *    `utm_source`, een Link naar **UTM Source**. De foutmelding blijft
 *    misleidend praten over "Source" ("Could not find Source: Email"), dus wie
 *    op de melding afgaat zoekt zich suf naar een DocType `Lead Source` dat er
 *    niet is.
 * 2. **`UTM Source` heeft `autoname: prompt`.** Een nieuwe bron aanmaken
 *    zonder expliciete `name` faalt met "Please set the document name". Zie
 *    `scripts/provision-y-next.mjs`, dat de bron "Email" idempotent aanlegt.
 * 3. **`title` is read-only** op zowel Lead als Opportunity — ERPNext leidt
 *    hem zelf af uit bedrijfs- of klantnaam. De omschrijving uit de mail gaat
 *    daarom naar `notes` (child-tabel **CRM Note**), die op beide doctypes
 *    bestaat en bij een insert gewoon meegaat.
 * 4. **`Opportunity.party_name` is een Dynamic Link** op `opportunity_from`.
 *    Beide moeten in dezelfde payload zitten; alleen `party_name` sturen levert
 *    een lege koppeling op zonder foutmelding.
 *
 * Wat hier bewust NIET gebeurt: een Customer of Contact aanmaken. Een lead is
 * juist het document dat vóór die keuze komt; ERPNext heeft er een eigen
 * conversie voor ("Lead → Customer"), met adres- en btw-gegevens die niet uit
 * een mail te halen zijn.
 */

/* ──────────────────────────────── Lead ───────────────────────────────── */

export interface LeadInput {
  /** Volledige persoonsnaam; leeg als de mail alleen een bedrijf noemt. */
  leadName?: string;
  firstName?: string;
  lastName?: string;
  /** Bedrijfsnaam; leeg als er alleen een persoon bekend is. */
  companyName?: string;
  email?: string;
  phone?: string;
  /** Company-docname waaronder de lead valt. */
  company?: string;
  /** UTM Source-docname (bv. "Email"); leeg = veld weglaten. */
  source?: string;
  /** Onderwerp/omschrijving; belandt als CRM Note op de lead. */
  note?: string;
}

export const DEFAULT_LEAD_STATUS = "Lead";
export const DEFAULT_LEAD_REQUEST_TYPE = "Request for Information";
export const LEAD_NAMING_SERIES = "CRM-LEAD-.YYYY.-";

/**
 * Wat er nog ontbreekt. Geeft veldnamen terug (geen zinnen) zodat de dialoog
 * ze kan vertalen én de bijbehorende invoervelden kan markeren.
 *
 * ERPNext eist "either a person's name or an organization's name" — dat is een
 * server-side validatie die zonder deze controle pas ná het klikken zichtbaar
 * wordt, in het Engels, met een stacktrace eromheen.
 */
export function validateLeadInput(input: LeadInput): string[] {
  const missing: string[] = [];
  if (!input.leadName?.trim() && !input.companyName?.trim()) missing.push("leadName");
  if (input.email && !isEmailish(input.email)) missing.push("email");
  return missing;
}

export function buildLeadPayload(input: LeadInput): Record<string, unknown> {
  const missing = validateLeadInput(input);
  if (missing.length > 0) {
    throw new Error(`Onvolledige lead: ${missing.join(", ")}`);
  }

  const payload: Record<string, unknown> = {
    naming_series: LEAD_NAMING_SERIES,
    status: DEFAULT_LEAD_STATUS,
    request_type: DEFAULT_LEAD_REQUEST_TYPE,
  };
  const leadName = input.leadName?.trim();
  if (leadName) {
    payload.lead_name = truncate(leadName, 140);
    if (input.firstName?.trim()) payload.first_name = truncate(input.firstName.trim(), 140);
    if (input.lastName?.trim()) payload.last_name = truncate(input.lastName.trim(), 140);
  }
  if (input.companyName?.trim()) payload.company_name = truncate(input.companyName.trim(), 140);
  if (input.email?.trim()) payload.email_id = input.email.trim();
  // `mobile_no` en niet `phone`: uit een handtekening komt in de praktijk een
  // mobiel nummer, en ERPNext toont `mobile_no` in de lijstweergave.
  if (input.phone?.trim()) payload.mobile_no = truncate(input.phone.trim(), 20);
  if (input.company?.trim()) payload.company = input.company.trim();
  if (input.source?.trim()) payload.utm_source = input.source.trim();
  const note = input.note?.trim();
  if (note) payload.notes = [{ note: truncate(note, 500) }];
  return payload;
}

/* ───────────────────────────── Opportunity ───────────────────────────── */

export interface OpportunityInput {
  /** Customer-docname; `opportunity_from` staat vast op "Customer". */
  customer: string;
  /** Company-docname. Verplicht op Opportunity. */
  company: string;
  /** Datum van de aanvraag (`yyyy-mm-dd`), doorgaans de maildatum. */
  transactionDate: string;
  /** Opportunity Type-docname; standaard "Sales". */
  opportunityType?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** UTM Source-docname (bv. "Email"); leeg = veld weglaten. */
  source?: string;
  /** Onderwerp/omschrijving; belandt als CRM Note op de opportunity. */
  note?: string;
}

export const DEFAULT_OPPORTUNITY_TYPE = "Sales";
export const OPPORTUNITY_NAMING_SERIES = "CRM-OPP-.YYYY.-";

export function validateOpportunityInput(input: OpportunityInput): string[] {
  const missing: string[] = [];
  if (!input.customer?.trim()) missing.push("customer");
  if (!input.company?.trim()) missing.push("company");
  if (!isIsoDate(input.transactionDate)) missing.push("transactionDate");
  if (input.contactEmail && !isEmailish(input.contactEmail)) missing.push("contactEmail");
  return missing;
}

export function buildOpportunityPayload(input: OpportunityInput): Record<string, unknown> {
  const missing = validateOpportunityInput(input);
  if (missing.length > 0) {
    throw new Error(`Onvolledige offerteaanvraag: ${missing.join(", ")}`);
  }

  const payload: Record<string, unknown> = {
    naming_series: OPPORTUNITY_NAMING_SERIES,
    opportunity_from: "Customer",
    party_name: input.customer.trim(),
    status: "Open",
    opportunity_type: input.opportunityType?.trim() || DEFAULT_OPPORTUNITY_TYPE,
    company: input.company.trim(),
    transaction_date: input.transactionDate,
  };
  if (input.contactEmail?.trim()) payload.contact_email = input.contactEmail.trim();
  if (input.contactPhone?.trim()) payload.contact_mobile = truncate(input.contactPhone.trim(), 20);
  if (input.source?.trim()) payload.utm_source = input.source.trim();
  const note = input.note?.trim();
  if (note) payload.notes = [{ note: truncate(note, 500) }];
  return payload;
}

/* ──────────────────────────────── Hulp ───────────────────────────────── */

/** Vandaag als `yyyy-mm-dd` in de lokale tijdzone (niet UTC — een aanvraag om
 *  23:00 hoort niet op morgen te vallen). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Datumdeel van een ERPNext-datetime (`2026-08-20 09:14:02` → `2026-08-20`),
 *  of `""` als er geen bruikbare datum in zit. */
export function isoDatePart(value: string | undefined): string {
  const match = (value || "").match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return match ? match[0] : "";
}

function isIsoDate(value: string | undefined): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isEmailish(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** `lead_name`/`company_name` zijn Data-velden (140 tekens); een te lange
 *  waarde zou de insert laten falen op een lengtefout in plaats van op iets
 *  begrijpelijks. */
function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
