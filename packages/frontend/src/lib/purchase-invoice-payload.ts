/**
 * Bouwt de payload van een **concept**-inkoopfactuur (`docstatus 0`) voor
 * ERPNext v16, en zegt vooraf welke velden nog ontbreken.
 *
 * Pure module — geen netwerk, geen React — zodat de payload met `node --test`
 * te controleren is zonder een sessie op te tuigen. De schrijfkant staat in
 * `purchase-invoice.ts`.
 *
 * De vorm is **live uitgeprobeerd** tegen de doelinstance (Frappe 16.19.0 /
 * ERPNext 16.16.0). Vier dingen die je er niet uit de DocType-meta afleidt:
 *
 * 1. **`expense_account` is verplicht zodra er geen `item_code` is.** De meta
 *    zegt `reqd: 0`, maar `PurchaseInvoice.validate` gooit
 *    "Expense account is mandatory for item …" voor elke regel zonder
 *    voorraadartikel. Een factuurmail heeft per definitie geen artikel, dus
 *    dit veld hoort in de dialoog thuis en niet in een stille default.
 * 2. **`uom` is verplicht en wordt niet afgeleid** — zonder `item_code` is er
 *    geen `stock_uom` om uit te lezen. "Nos" is op deze instance aanwezig.
 * 3. **`conversion_factor: 1` gaat expliciet mee.** Het veld is `reqd: 1` en
 *    read-only; ERPNext vult het normaal uit het artikel. Zonder artikel is
 *    er niets om uit te vullen, dus sturen we de enige juiste waarde zelf.
 * 4. **`credit_to` is verplicht** en is de crediteurenrekening van het bedrijf
 *    (`Company.default_payable_account`), niet de kostenrekening.
 *
 * Wat hier bewust NIET gebeurt: indienen. De factuur blijft een concept, zodat
 * de gebruiker hem in ERPNext kan nakijken, btw-regels kan toevoegen en pas
 * daarna boekt. Eén klik in de webmail mag geen boeking in het grootboek
 * opleveren.
 */

export interface PurchaseInvoiceInput {
  /** Supplier-docname. */
  supplier: string;
  company: string;
  /** Crediteurenrekening, bv. "Crediteuren - OSB". */
  creditTo: string;
  /** Kostenrekening van de factuurregel. */
  expenseAccount: string;
  /** Boekdatum (`yyyy-mm-dd`); standaard vandaag. */
  postingDate: string;
  /** Factuurnummer van de leverancier (`bill_no`). */
  billNo?: string;
  /** Factuurdatum van de leverancier (`bill_date`). */
  billDate?: string;
  /** ISO-valutacode; standaard EUR. */
  currency?: string;
  /** Omschrijving van de factuurregel. */
  description: string;
  /** Netto regelbedrag. */
  amount: number;
  /** Eenheid van de regel; standaard "Nos". */
  uom?: string;
  costCenter?: string;
  /** Project waaraan de kosten hangen (uit de projectkoppeling van de mail). */
  project?: string;
}

/** Standaardeenheid: op deze instance bestaan alleen Nos / Unit / Hour. */
export const DEFAULT_PI_UOM = "Nos";
export const DEFAULT_PI_CURRENCY = "EUR";

/**
 * Wat er nog ontbreekt voordat de factuur aangemaakt kan worden. Geeft
 * veldnamen terug (geen zinnen) zodat de dialoog ze kan vertalen én de
 * bijbehorende invoervelden kan markeren.
 */
export function validatePurchaseInvoiceInput(input: PurchaseInvoiceInput): string[] {
  const missing: string[] = [];
  if (!input.supplier?.trim()) missing.push("supplier");
  if (!input.company?.trim()) missing.push("company");
  if (!input.creditTo?.trim()) missing.push("creditTo");
  if (!input.expenseAccount?.trim()) missing.push("expenseAccount");
  if (!isIsoDate(input.postingDate)) missing.push("postingDate");
  if (input.billDate && !isIsoDate(input.billDate)) missing.push("billDate");
  if (!input.description?.trim()) missing.push("description");
  if (!Number.isFinite(input.amount) || input.amount <= 0) missing.push("amount");
  return missing;
}

function isIsoDate(value: string | undefined): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Vandaag als `yyyy-mm-dd` in de lokale tijdzone (niet UTC — een boeking om
 *  23:00 hoort niet op morgen te vallen). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * De payload voor `POST /api/resource/Purchase Invoice`.
 *
 * `set_posting_time` gaat alleen mee bij een boekdatum in het verleden: dat is
 * het pad dat ERPNext nodig heeft om de datum niet naar vandaag te trekken.
 * Voor de gewone boeking-van-vandaag blijft de payload exact zoals hij live
 * getest is, zonder extra velden.
 */
export function buildPurchaseInvoicePayload(
  input: PurchaseInvoiceInput,
  now: Date = new Date(),
): Record<string, unknown> {
  const missing = validatePurchaseInvoiceInput(input);
  if (missing.length > 0) {
    throw new Error(`Onvolledige inkoopfactuur: ${missing.join(", ")}`);
  }

  const item: Record<string, unknown> = {
    item_name: truncate(input.description.trim(), 140),
    description: input.description.trim(),
    qty: 1,
    uom: input.uom?.trim() || DEFAULT_PI_UOM,
    conversion_factor: 1,
    rate: round2(input.amount),
    expense_account: input.expenseAccount.trim(),
  };
  if (input.costCenter?.trim()) item.cost_center = input.costCenter.trim();
  if (input.project?.trim()) item.project = input.project.trim();

  const payload: Record<string, unknown> = {
    supplier: input.supplier.trim(),
    company: input.company.trim(),
    posting_date: input.postingDate,
    currency: input.currency?.trim() || DEFAULT_PI_CURRENCY,
    credit_to: input.creditTo.trim(),
    items: [item],
  };
  if (input.billNo?.trim()) payload.bill_no = truncate(input.billNo.trim(), 140);
  if (input.billDate) payload.bill_date = input.billDate;
  if (input.project?.trim()) payload.project = input.project.trim();
  if (input.costCenter?.trim()) payload.cost_center = input.costCenter.trim();
  if (input.postingDate < todayIso(now)) {
    payload.set_posting_time = 1;
    payload.posting_time = "00:00:00";
  }
  return payload;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `item_name` is een Data-veld (140 tekens); een lange omschrijving zou de
 *  insert laten falen op een lengtefout in plaats van op iets begrijpelijks. */
function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
