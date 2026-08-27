/**
 * De schrijf- en opzoekkant van "mail → inkoopfactuur".
 *
 * `invoice-detect.ts` bepaalt *of* een mail een inkoopfactuur is en wat er in
 * staat; `purchase-invoice-payload.ts` bouwt de payload. Deze module praat met
 * ERPNext: leveranciers en rekeningen ophalen, standaardwaarden onthouden, en
 * de daadwerkelijke boeking uitvoeren.
 *
 * De boeking bestaat uit drie stappen die bewust **niet** één transactie zijn,
 * omdat ERPNext ze niet als één transactie aanbiedt:
 *
 *   1. de concept-inkoopfactuur aanmaken (`Purchase Invoice`, docstatus 0);
 *   2. de PDF('s) van de mail aan die factuur hangen;
 *   3. de mail aan de factuur koppelen (`Communication.reference_*`).
 *
 * Alleen stap 1 mag de hele actie laten mislukken. Stap 2 en 3 zijn
 * verrijkingen: is de factuur er eenmaal, dan is "de bijlage hing er niet aan"
 * een mededeling en geen reden om de gebruiker te laten denken dat er niets
 * gebeurd is (waarna hij het nog eens probeert en een dubbele factuur maakt).
 * `BookingResult` draagt de deelfouten daarom apart mee.
 *
 * **De bijlage wordt niet opnieuw geüpload.** Het bestand staat al als `File`
 * op de Communication; er komt een tweede `File`-rij bij die naar dezelfde
 * `file_url` wijst. Live geverifieerd op de doelinstance: de koppeling werkt,
 * en het verwijderen van die tweede rij laat het fysieke bestand én de
 * oorspronkelijke koppeling ongemoeid. Opnieuw uploaden zou een tweede kopie
 * van elke factuur-PDF op de schijf zetten.
 */

import {
  ApiError,
  createDocument,
  fetchDocument,
  fetchList,
  updateDocument,
} from "./erpnext.ts";
import type { SupplierHint } from "./invoice-detect.ts";
import {
  buildPurchaseInvoicePayload,
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

export interface BookingAttachment {
  /** File-docname van de bijlage op de Communication (alleen ter herkenning). */
  name: string;
  fileName: string;
  fileUrl: string;
  isPrivate: boolean;
}

export interface BookingResult {
  /** Docname van de aangemaakte concept-inkoopfactuur. */
  name: string;
  /** Bijlagen die niet gekoppeld konden worden (de factuur bestaat wél). */
  failedAttachments: string[];
  /** `true` als de mail niet aan de factuur gekoppeld kon worden. */
  linkFailed: boolean;
}

/**
 * Maak de concept-inkoopfactuur, hang de gekozen bijlagen eraan en koppel de
 * mail. Gooit alleen wanneer stap 1 mislukt — zie de moduletoelichting.
 */
export async function bookPurchaseInvoiceFromMail(args: {
  input: PurchaseInvoiceInput;
  /** Communication-docname van de mail. */
  communication: string;
  attachments: BookingAttachment[];
}): Promise<BookingResult> {
  const created = await createDocument<{ name: string }>(
    "Purchase Invoice",
    buildPurchaseInvoicePayload(args.input),
  );
  const name = created?.name;
  if (!name) throw new Error("ERPNext gaf geen factuurnummer terug");

  const failedAttachments: string[] = [];
  for (const att of args.attachments) {
    try {
      await createDocument("File", {
        file_url: att.fileUrl,
        file_name: att.fileName,
        is_private: att.isPrivate ? 1 : 0,
        attached_to_doctype: "Purchase Invoice",
        attached_to_name: name,
      });
    } catch {
      failedAttachments.push(att.fileName);
    }
  }

  let linkFailed = false;
  try {
    await linkCommunicationToInvoice(args.communication, name);
  } catch {
    linkFailed = true;
  }

  return { name, failedAttachments, linkFailed };
}

interface CommunicationLinkRow {
  link_doctype?: string;
  link_name?: string;
}

/**
 * Hang de mail aan de factuur, op de twee manieren die ERPNext's
 * desk-tijdlijn kent.
 *
 * Live geverifieerd op de doelinstance: `frappe.desk.form.load.get_docinfo`
 * op de nieuwe factuur toont de mail **al** bij alleen `reference_doctype` +
 * `reference_name`, en óók bij alleen een `timeline_links`-rij. Ze werken dus
 * onafhankelijk van elkaar — vandaar dat de child-tabel-update hieronder
 * best-effort is en de PUT hierboven leidend.
 *
 * Toch worden ze allebei gezet, want ze doen niet hetzelfde:
 * `reference_*` is **enkelvoudig** (een Communication hangt aan één document),
 * dus zodra de mail later aan een project wordt gekoppeld, verdwijnt de
 * factuurverwijzing weer. `timeline_links` is een lijst en overleeft dat.
 *
 * **De bestaande rijen moeten mee.** Frappe vervangt een child-tabel volledig
 * bij een PUT; de Communications in deze mailbox dragen al `Contact`-rijen
 * (die ERPNext zelf bij het binnenhalen zet). Alleen de nieuwe rij sturen zou
 * die stilzwijgend wissen — vandaar eerst lezen, dan aanvullen.
 */
async function linkCommunicationToInvoice(communication: string, invoice: string): Promise<void> {
  await updateDocument("Communication", communication, {
    reference_doctype: "Purchase Invoice",
    reference_name: invoice,
    // Frappe's eigen aanduiding voor "hangt aan een document"; hij kleurt de
    // rij in de desk-lijst. Raakt `email_status` (Open/Spam/Trash) niet, dus
    // de Prullenbak-logica van de webmail blijft ongemoeid.
    status: "Linked",
  });
  try {
    const doc = await fetchDocument<{ timeline_links?: CommunicationLinkRow[] }>(
      "Communication", communication,
    );
    const existing = doc.timeline_links ?? [];
    if (existing.some((l) => l.link_doctype === "Purchase Invoice" && l.link_name === invoice)) return;
    await updateDocument("Communication", communication, {
      timeline_links: [
        ...existing.map((l) => ({ link_doctype: l.link_doctype, link_name: l.link_name })),
        { link_doctype: "Purchase Invoice", link_name: invoice },
      ],
    });
  } catch {
    // De tijdlijn werkt al via `reference_*`; dit was de duurzame extra.
  }
}

/* ──────────────────────── "Nee, geen factuur" ────────────────────────── */

const DISMISS_KEY = "y_next_not_purchase_invoice";
/** Zoveel afwijzingen worden onthouden; daarna valt de oudste eruit. */
const DISMISS_CAP = 500;

/**
 * Onthoud dat een mail géén inkoopfactuur is.
 *
 * Bewust **localStorage** en niet het tag-mechanisme of `Y Next Setting`. Een
 * tag zou als zichtbare mailmap in de mappenlijst opduiken (zie
 * `MAIL_TAG_NAME_PREFIX` in `mail-erpnext.ts`), en `Y Next Setting` is
 * System-Manager-only voor schrijven — dan zou "Nee, geen factuur" voor een
 * gewone medewerker een 403 opleveren en dus niets doen. Prijs: de afwijzing
 * geldt per apparaat. Dat is acceptabel omdat het effect klein en omkeerbaar
 * is (het labeltje verschijnt elders opnieuw), terwijl een knop die niets doet
 * dat niet is.
 *
 * De *positieve* kant heeft deze opslag niet nodig: een geboekte mail draagt
 * `reference_doctype = "Purchase Invoice"` en is daarmee server-side, voor
 * iedereen, als afgehandeld herkenbaar.
 */
export function dismissInvoiceSuggestion(communication: string): void {
  try {
    const list = readDismissed().filter((n) => n !== communication);
    list.push(communication);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(list.slice(-DISMISS_CAP)));
  } catch { /* quota — dan komt de suggestie terug, meer niet */ }
}

export function readDismissedInvoiceSuggestions(): Set<string> {
  return new Set(readDismissed());
}

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/* ─────────────────────────── Foutvertaling ───────────────────────────── */

export type BookingErrorKind = "series-stuck" | "permission" | "duplicate-bill" | "generic";

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
  if (status === 409 || /already exists/i.test(message)) return "series-stuck";
  if (status === 403 || /permissionerror|not permitted|no permission/i.test(message)) return "permission";
  return "generic";
}
