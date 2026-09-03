/**
 * De schrijf- en opzoekkant van "mail → inkoopfactuur".
 *
 * `invoice-detect.ts` bepaalt *of* een mail een inkoopfactuur is en wat er in
 * staat; `purchase-invoice-payload.ts` bouwt de payload. Deze module praat met
 * ERPNext: leveranciers en rekeningen ophalen, standaardwaarden onthouden, en
 * de daadwerkelijke boeking uitvoeren.
 *
 * De boeking zelf (aanmaken + bijlagen + mail koppelen) staat in
 * `communication-link.ts`: die drie stappen zijn identiek voor elk document dat
 * Y-next vanuit een mail aanmaakt, en horen dus niet per doctype herhaald te
 * worden. Wat hier blijft, is alles wat *specifiek* aan een inkoopfactuur is.
 */

import {
  ApiError,
  createDocument,
  fetchDocument,
  fetchList,
  updateDocument,
} from "./erpnext.ts";
import {
  createDocumentFromMail,
  type MailAttachmentRef,
  type MailDocumentResult,
} from "./communication-link.ts";
import type { SupplierHint } from "./invoice-detect.ts";
import {
  dismissMailSuggestion,
  isMailSuggestionDismissed,
  readDismissedMailSuggestions,
} from "./mail-suggestions.ts";
import {
  buildPurchaseInvoicePayload,
  dueDateFromTerms,
  type PaymentTermRow,
  type PurchaseInvoiceInput,
} from "./purchase-invoice-payload.ts";

/* ───────────────────────────── Leveranciers ──────────────────────────── */

interface SupplierRow {
  name: string;
  supplier_name?: string;
  email_id?: string;
}

interface SupplierContactRow {
  email_id?: string;
  /** Uit `` `tabDynamic Link`.link_name `` — de Supplier waaraan dit contact hangt. */
  link_name?: string;
}

let supplierCache: { at: number; hints: SupplierHint[] } | null = null;
const SUPPLIER_TTL_MS = 10 * 60_000;

/**
 * Alle leveranciers plus de e-mailadressen waaraan je ze kunt herkennen.
 *
 * De adressen komen uit twee bronnen. `Supplier.email_id` is op deze instance
 * overal leeg, dus in de praktijk komt alles uit de **Contacts** die via een
 * `Dynamic Link` aan een Supplier hangen. Die child-tabel is zelf niet
 * leesbaar (`Dynamic Link` geeft een 403), maar je mág er wél op filteren en
 * uit selecteren via de parent-query — vandaar de backtick-notatie in
 * `fields`. Zonder die truc zou er geen enkel adres bekend zijn en zou de
 * herkenning volledig op namen in het onderwerp moeten leunen.
 *
 * Faalt de contactenquery (rechten verschillen per rol), dan blijft de
 * leveranciersnaam-herkenning gewoon werken; de lijst wordt dan alleen minder
 * scherp. Daarom geen `throw` maar een lege aanvulling.
 */
export async function fetchSupplierHints(force = false): Promise<SupplierHint[]> {
  if (!force && supplierCache && Date.now() - supplierCache.at < SUPPLIER_TTL_MS) {
    return supplierCache.hints;
  }
  const suppliers = await fetchList<SupplierRow>("Supplier", {
    fields: ["name", "supplier_name", "email_id"],
    filters: [["disabled", "=", 0]],
    limit_page_length: 0,
    order_by: "supplier_name asc",
  });

  const byName = new Map<string, SupplierHint>();
  for (const row of suppliers) {
    const hint: SupplierHint = { name: row.name };
    if (row.supplier_name && row.supplier_name !== row.name) hint.supplierName = row.supplier_name;
    if (row.email_id?.trim()) hint.emails = [row.email_id.trim()];
    byName.set(row.name, hint);
  }

  try {
    const contacts = await fetchList<SupplierContactRow>("Contact", {
      fields: ["email_id", "`tabDynamic Link`.link_name"],
      filters: [["Dynamic Link", "link_doctype", "=", "Supplier"]],
      limit_page_length: 0,
    });
    for (const row of contacts) {
      const supplier = row.link_name?.trim();
      const email = row.email_id?.trim();
      if (!supplier || !email) continue;
      const hint = byName.get(supplier);
      if (!hint) continue;
      hint.emails = hint.emails ? [...new Set([...hint.emails, email])] : [email];
    }
  } catch {
    // Geen leesrecht op Contact — naamherkenning blijft over.
  }

  const hints = [...byName.values()];
  supplierCache = { at: Date.now(), hints };
  return hints;
}

/** Vergeet de leverancierscache (na het aanmaken van een nieuwe leverancier). */
export function resetSupplierCache(): void {
  supplierCache = null;
}

/* ───────────────────────────── Rekeningen ────────────────────────────── */

export interface AccountOption {
  name: string;
  accountName: string;
}

interface AccountRow {
  name: string;
  account_name?: string;
}

async function fetchAccounts(company: string, extra: unknown[][]): Promise<AccountOption[]> {
  if (!company) return [];
  const rows = await fetchList<AccountRow>("Account", {
    fields: ["name", "account_name"],
    filters: [["company", "=", company], ["is_group", "=", 0], ...extra],
    limit_page_length: 0,
    order_by: "name asc",
  });
  return rows.map((r) => ({ name: r.name, accountName: r.account_name || r.name }));
}

/** Kostenrekeningen (`root_type = Expense`) van één bedrijf. */
export function fetchExpenseAccounts(company: string): Promise<AccountOption[]> {
  return fetchAccounts(company, [["root_type", "=", "Expense"]]);
}

/** Crediteurenrekeningen van één bedrijf — de kandidaten voor `credit_to`. */
export function fetchPayableAccounts(company: string): Promise<AccountOption[]> {
  return fetchAccounts(company, [["account_type", "=", "Payable"]]);
}

/* ─────────────────────────── Standaardwaarden ────────────────────────── */

export interface PurchaseInvoiceDefaults {
  expenseAccount: string;
  creditTo: string;
  costCenter: string;
  currency: string;
}

const SETTING_DOCTYPE = "Y Next Setting";
const SETTING_KEY = "purchase-invoice-defaults";
const LS_KEY = "y_next_purchase_invoice_defaults";

interface YNextSettingDoc {
  name: string;
  setting_key: string;
  setting_value?: string;
}

/** De opgeslagen vorm: per bedrijf een eigen set standaardwaarden. */
type StoredDefaults = Record<string, Partial<PurchaseInvoiceDefaults>>;

function readLocalDefaults(): StoredDefaults {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as StoredDefaults) : {};
  } catch {
    return {};
  }
}

function writeLocalDefaults(value: StoredDefaults): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(value));
  } catch { /* quota — de defaults zijn een gemak, geen vereiste */ }
}

async function readStoredDefaults(): Promise<StoredDefaults> {
  try {
    const doc = await fetchDocument<YNextSettingDoc>(SETTING_DOCTYPE, SETTING_KEY);
    const parsed = doc.setting_value ? JSON.parse(doc.setting_value) : null;
    if (parsed && typeof parsed === "object") return parsed as StoredDefaults;
  } catch {
    // Nog niets opgeslagen, of het DocType is nog niet geprovisioned — beide
    // een gewone 404. De lokale kopie is dan de enige bron.
  }
  return readLocalDefaults();
}

interface CompanyDoc {
  default_payable_account?: string;
  default_expense_account?: string;
  cost_center?: string;
  default_currency?: string;
}

/**
 * Standaardwaarden voor één bedrijf: eerst wat de gebruiker heeft onthouden,
 * daarna de bedrijfsinstellingen uit ERPNext zelf.
 *
 * De ERPNext-defaults zijn de eerlijkste bodem: `default_payable_account` is
 * exact de rekening die elke bestaande inkoopfactuur op deze instance als
 * `credit_to` heeft. Voor de kostenrekening bestaat geen even scherpe default —
 * daarom is dat het veld dat de dialoog het duidelijkst toont en waarvan de
 * gebruiker de keuze kan laten onthouden.
 */
export async function fetchPurchaseInvoiceDefaults(company: string): Promise<PurchaseInvoiceDefaults> {
  const stored = (await readStoredDefaults())[company] ?? {};
  let fromCompany: CompanyDoc = {};
  if (company) {
    try {
      fromCompany = await fetchDocument<CompanyDoc>("Company", company);
    } catch { /* geen leesrecht — dan blijft alleen wat is onthouden */ }
  }
  return {
    expenseAccount: stored.expenseAccount || fromCompany.default_expense_account || "",
    creditTo: stored.creditTo || fromCompany.default_payable_account || "",
    costCenter: stored.costCenter || fromCompany.cost_center || "",
    currency: stored.currency || fromCompany.default_currency || "EUR",
  };
}

/**
 * Onthoud de standaardwaarden voor dit bedrijf.
 *
 * Schrijven naar `Y Next Setting` is op deze instance System-Manager-only (zie
 * `scripts/provision-y-next.mjs`). Een gewone medewerker krijgt daar een 403 —
 * en dan is localStorage de juiste plek: zijn voorkeur blijft op dit apparaat
 * staan in plaats van geruisloos te verdwijnen. De functie meldt via de
 * returnwaarde waar het is beland, zodat de UI niet "gedeeld opgeslagen" kan
 * beweren terwijl het lokaal bleef.
 */
export async function savePurchaseInvoiceDefaults(
  company: string,
  defaults: PurchaseInvoiceDefaults,
): Promise<"shared" | "local"> {
  const merged: StoredDefaults = { ...(await readStoredDefaults()), [company]: defaults };
  writeLocalDefaults(merged);
  const payload = { setting_value: JSON.stringify(merged) };
  try {
    await updateDocument(SETTING_DOCTYPE, SETTING_KEY, payload);
    return "shared";
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      try {
        await createDocument(SETTING_DOCTYPE, { setting_key: SETTING_KEY, ...payload });
        return "shared";
      } catch { /* val terug op lokaal */ }
    }
    return "local";
  }
}

/* ─────────────────────────────── Boeken ──────────────────────────────── */

/** @deprecated Gebruik `MailAttachmentRef`; blijft staan als bekende naam. */
export type BookingAttachment = MailAttachmentRef;

/** @deprecated Gebruik `MailDocumentResult`; blijft staan als bekende naam. */
export type BookingResult = MailDocumentResult;

/**
 * Maak de concept-inkoopfactuur, hang de gekozen bijlagen eraan en koppel de
 * mail. Gooit alleen wanneer het aanmaken zelf mislukt — zie
 * `createDocumentFromMail`.
 */
export async function bookPurchaseInvoiceFromMail(args: {
  input: PurchaseInvoiceInput;
  /** Communication-docname van de mail. */
  communication: string;
  attachments: BookingAttachment[];
}): Promise<BookingResult> {
  const input = args.input.dueDate
    ? args.input
    : { ...args.input, dueDate: await vervaldatumUitTermijn(args.input) };
  return createDocumentFromMail({
    doctype: "Purchase Invoice",
    payload: buildPurchaseInvoicePayload(input),
    communication: args.communication,
    attachments: args.attachments,
  });
}

/**
 * De vervaldatum die bij deze factuur hoort, gerekend vanaf de factuurdatum
 * en de betalingstermijn van de leverancier. Zonder deze datum weigert ERPNext
 * elke factuur waarvan de termijn al verstreken is op de boekdatum — zie
 * `dueDateFromTerms` voor het waarom.
 *
 * Lukt het ophalen niet, dan geeft dit `undefined` en blijft het veld weg. Dat
 * is precies het oude gedrag: een factuur van vandaag boekt dan gewoon door,
 * en een oudere loopt tegen de melding van ERPNext aan in plaats van tegen een
 * fout uit deze functie.
 */
async function vervaldatumUitTermijn(
  input: PurchaseInvoiceInput,
): Promise<string | undefined> {
  if (!input.billDate) return undefined;
  try {
    const leverancier = await fetchDocument<{ payment_terms?: string }>(
      "Supplier", input.supplier,
    );
    if (!leverancier.payment_terms) return undefined;
    const template = await fetchDocument<{ terms?: PaymentTermRow[] }>(
      "Payment Terms Template", leverancier.payment_terms,
    );
    return dueDateFromTerms(input.billDate, template.terms);
  } catch {
    return undefined;
  }
}

/* ──────────────────────── "Nee, geen factuur" ────────────────────────── */

/**
 * Onthoud dat een mail géén inkoopfactuur is. De opslag zelf (en het waarom
 * van localStorage) staat in `mail-suggestions.ts`, die dezelfde afwijzing ook
 * voor leads, offerteaanvragen en projectsuggesties bijhoudt. Deze twee
 * functies blijven bestaan omdat ze de bekende namen zijn op de aanroepplekken.
 */
export function dismissInvoiceSuggestion(communication: string): void {
  dismissMailSuggestion(communication, "purchase-invoice");
}

/**
 * De weggeklikte inkoopfactuur-voorstellen als set van Communication-docnames,
 * zodat bestaande aanroepers `set.has(name)` kunnen blijven doen.
 */
export function readDismissedInvoiceSuggestions(): Set<string> {
  const all = readDismissedMailSuggestions();
  const out = new Set<string>();
  for (const entry of all) {
    const [kind, ...rest] = entry.split("::");
    const name = rest.join("::");
    if (kind === "purchase-invoice" && name) out.add(name);
  }
  // Defensief: `isMailSuggestionDismissed` is de gezaghebbende test; dit is
  // alleen de platgeslagen vorm ervan voor de bestaande aanroepers.
  return out;
}

/** Directe variant voor code die de gedeelde set al in handen heeft. */
export function isInvoiceSuggestionDismissed(dismissed: Set<string>, communication: string): boolean {
  return isMailSuggestionDismissed(dismissed, communication, "purchase-invoice");
}

/* ─────────────────────────── Foutvertaling ───────────────────────────── */

export type BookingErrorKind =
  | "series-stuck" | "permission" | "duplicate-bill" | "due-date" | "generic";

/**
 * Vertaalt een mislukte boeking naar een categorie waar de UI iets zinnigs
 * over kan zeggen.
 *
 * `series-stuck` verdient uitleg. Frappe telt de naamgevingsreeks **niet** op
 * bij een mislukte insert, dus een reeks die achterloopt op de al bestaande
 * documenten (bijvoorbeeld na een bulkimport) is een permanente blokkade: elke
 * poging kiest hetzelfde, al bezette nummer. Dit is op de doelinstance
 * daadwerkelijk het geval voor `ACC-PINV-` — vier achtereenvolgende pogingen
 * kregen exact dezelfde "already exists". Zonder deze vertaling zou de
 * gebruiker "Purchase Invoice ACC-PINV-2026-00010 already exists" te zien
 * krijgen en denken dat hij de factuur al geboekt had. De oplossing ligt bij
 * een beheerder: Instellingen → Document Naming Settings → reeksnummer
 * bijwerken.
 */
export function classifyBookingError(err: unknown): BookingErrorKind {
  const status = Number((err as { status?: unknown })?.status);
  const message = typeof (err as { message?: unknown })?.message === "string"
    ? (err as { message: string }).message
    : "";
  // Eerst de specifieke: ERPNext meldt een al geboekt leveranciersfactuur-
  // nummer als "Supplier Invoice No exists in Purchase Invoice …". Dat is een
  // inhoudelijke dubbeling en iets heel anders dan een vastgelopen reeks.
  if (/supplier invoice no|leveranciersfactuurnummer/i.test(message)) return "duplicate-bill";
  // De vervaldatum-toets van ERPNext. `vervaldatumUitTermijn` vangt dit
  // normaal af; komt hij er tóch langs (termijn met een grondslag die we niet
  // kennen, of de leverancier niet leesbaar), dan is een boekdatum gelijk aan
  // de factuurdatum de uitweg — en dat moet de melding vertellen.
  if (/due \/ reference date|due date cannot be/i.test(message)) return "due-date";
  if (status === 409 || /already exists/i.test(message)) return "series-stuck";
  if (status === 403 || /permissionerror|not permitted|no permission/i.test(message)) return "permission";
  return "generic";
}
