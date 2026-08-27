/**
 * De schrijf- en opzoekkant van "mail → lead / offerteaanvraag".
 *
 * `mail-intent.ts` bepaalt *of* een mail een lead of een offerteaanvraag is en
 * wat erin staat; `lead-payload.ts` bouwt de payload. Deze module praat met
 * ERPNext: klanten en eigen maildomeinen ophalen, de bron controleren, en het
 * document daadwerkelijk aanmaken (via `communication-link.ts`, dezelfde weg
 * als de inkoopfactuur).
 *
 * Twee dingen die live zijn uitgezocht en niet uit de meta blijken:
 *
 * - **De bron heet `utm_source`, niet `source`.** ERPNext v16 heeft `Lead
 *   Source` vervangen door **UTM Source**, maar de foutmelding praat nog over
 *   "Source". Y-next gebruikt de bron `"Email"`; bestaat die niet, dan wordt
 *   het veld gewoon weggelaten in plaats van de hele aanmaak te laten
 *   struikelen op een ontbrekend stamgegeven. `scripts/provision-y-next.mjs`
 *   legt hem idempotent aan.
 * - **De klantenlijst is rommelig.** Op deze instance hangt een verzamel-klant
 *   ("Domera") aan tientallen contacten van totaal verschillende domeinen,
 *   inclusief gratis-mailadressen en notificatie-afzenders. De matchlogica in
 *   `mail-intent.ts` vangt dat op (gratis-mailproviders tellen niet mee voor
 *   domeinmatching), maar het blijft de reden dat de gekozen klant in de
 *   dialoog **altijd te wijzigen** is en nooit stilzwijgend wordt vastgezet.
 */

import { ApiError, fetchList } from "./erpnext.ts";
import {
  createDocumentFromMail,
  type MailAttachmentRef,
  type MailDocumentResult,
} from "./communication-link.ts";
import type { MailIntentContext, PartyHint } from "./mail-intent.ts";
import { fetchSupplierHints } from "./purchase-invoice.ts";
import {
  buildLeadPayload,
  buildOpportunityPayload,
  type LeadInput,
  type OpportunityInput,
} from "./lead-payload.ts";

/* ─────────────────────────────── Klanten ─────────────────────────────── */

interface CustomerRow {
  name: string;
  customer_name?: string;
  email_id?: string;
}

interface PartyContactRow {
  email_id?: string;
  /** Uit `` `tabDynamic Link`.link_name `` — de Customer waaraan dit contact hangt. */
  link_name?: string;
}

let customerCache: { at: number; hints: PartyHint[] } | null = null;
const PARTY_TTL_MS = 10 * 60_000;

/**
 * Alle klanten plus de e-mailadressen waaraan je ze kunt herkennen. Exact
 * dezelfde opzet als `fetchSupplierHints`, inclusief de truc om via de
 * parent-query op `Contact` te filteren op `Dynamic Link` — die child-tabel is
 * zelf niet leesbaar (403), maar je mag er wél op filteren en uit selecteren.
 *
 * Faalt de contactenquery (rechten verschillen per rol), dan blijft de lijst
 * bestaan met alleen `Customer.email_id`; de herkenning wordt dan minder
 * scherp maar niet stuk. Daarom geen `throw` maar een lege aanvulling.
 */
export async function fetchCustomerHints(force = false): Promise<PartyHint[]> {
  if (!force && customerCache && Date.now() - customerCache.at < PARTY_TTL_MS) {
    return customerCache.hints;
  }
  const customers = await fetchList<CustomerRow>("Customer", {
    fields: ["name", "customer_name", "email_id"],
    filters: [["disabled", "=", 0]],
    limit_page_length: 0,
    order_by: "customer_name asc",
  });

  const byName = new Map<string, PartyHint>();
  for (const row of customers) {
    const hint: PartyHint = { name: row.name };
    if (row.customer_name && row.customer_name !== row.name) hint.partyName = row.customer_name;
    if (row.email_id?.trim()) hint.emails = [row.email_id.trim()];
    byName.set(row.name, hint);
  }

  try {
    const contacts = await fetchList<PartyContactRow>("Contact", {
      fields: ["email_id", "`tabDynamic Link`.link_name"],
      filters: [["Dynamic Link", "link_doctype", "=", "Customer"]],
      limit_page_length: 0,
    });
    for (const row of contacts) {
      const customer = row.link_name?.trim();
      const email = row.email_id?.trim();
      if (!customer || !email) continue;
      const hint = byName.get(customer);
      if (!hint) continue;
      hint.emails = hint.emails ? [...new Set([...hint.emails, email])] : [email];
    }
  } catch {
    // Geen leesrecht op Contact — alleen `Customer.email_id` blijft over.
  }

  const hints = [...byName.values()];
  customerCache = { at: Date.now(), hints };
  return hints;
}

export function resetCustomerCache(): void {
  customerCache = null;
}

/* ──────────────────────── Eigen maildomeinen ─────────────────────────── */

let ownDomainCache: { at: number; domains: string[] } | null = null;

/**
 * De domeinen van de eigen Email Accounts. Zonder deze lijst zou elke interne
 * mail met het woord "offerte" als lead worden voorgesteld — de gebruiker
 * mailt zichzelf en zijn collega's nu eenmaal het vaakst.
 *
 * Zonder leesrecht op `Email Account` blijft de lijst leeg. Dat is een bewuste
 * degradatie en geen fout: de herkenning wordt dan iets ruimer, maar hij
 * blijft werken.
 */
export async function fetchOwnMailDomains(force = false): Promise<string[]> {
  if (!force && ownDomainCache && Date.now() - ownDomainCache.at < PARTY_TTL_MS) {
    return ownDomainCache.domains;
  }
  let domains: string[] = [];
  try {
    const rows = await fetchList<{ email_id?: string }>("Email Account", {
      fields: ["email_id"],
      limit_page_length: 0,
    });
    domains = [...new Set(
      rows
        .map((r) => (r.email_id || "").trim().toLowerCase())
        .map((e) => e.slice(e.lastIndexOf("@") + 1))
        .filter((d) => d.length > 3 && d.includes(".")),
    )];
  } catch {
    // Geen leesrecht — zie de toelichting hierboven.
  }
  ownDomainCache = { at: Date.now(), domains };
  return domains;
}

/**
 * Alles wat `classifyMailIntent` nodig heeft, in één keer opgehaald. De
 * deelqueries lopen parallel en falen onafhankelijk: één ontbrekend leesrecht
 * mag de herkenning verzwakken, niet uitschakelen.
 */
export async function fetchMailIntentContext(extraOwnEmails: string[] = []): Promise<MailIntentContext> {
  const [suppliers, customers, ownDomains] = await Promise.all([
    fetchSupplierHints().catch(() => []),
    fetchCustomerHints().catch(() => []),
    fetchOwnMailDomains().catch(() => []),
  ]);
  const ownEmails = extraOwnEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  return { suppliers, customers, ownDomains, ownEmails };
}

/* ──────────────────────────────── Bron ───────────────────────────────── */

/** UTM Source-docname die Y-next op een lead/offerteaanvraag zet. */
export const MAIL_UTM_SOURCE = "Email";

let sourceCache: { at: number; available: boolean } | null = null;

/**
 * Bestaat de bron "Email"? Zo nee, dan laat de payload het veld weg.
 *
 * Waarom niet gewoon proberen en de fout opvangen: een ontbrekende Link laat
 * de hele insert falen met `LinkValidationError`, en dan is de lead er niet.
 * Vooraf één goedkope check is het verschil tussen "de lead is aangemaakt,
 * zonder bron" en "er is niets gebeurd en de melding gaat over een DocType dat
 * de gebruiker niet kent".
 */
export async function isMailSourceAvailable(): Promise<boolean> {
  if (sourceCache && Date.now() - sourceCache.at < PARTY_TTL_MS) return sourceCache.available;
  let available = false;
  try {
    const rows = await fetchList<{ name: string }>("UTM Source", {
      fields: ["name"],
      filters: [["name", "=", MAIL_UTM_SOURCE]],
      limit_page_length: 1,
    });
    available = rows.length > 0;
  } catch {
    // Geen leesrecht op UTM Source → het veld weglaten is dan het veiligst.
  }
  sourceCache = { at: Date.now(), available };
  return available;
}

/* ────────────────────────────── Aanmaken ─────────────────────────────── */

export type { MailAttachmentRef, MailDocumentResult };

/**
 * Maak de lead, hang de gekozen bijlagen eraan en koppel de mail. Gooit alleen
 * wanneer het aanmaken zelf mislukt — zie `createDocumentFromMail`.
 */
export async function createLeadFromMail(args: {
  input: LeadInput;
  /** Communication-docname van de mail. */
  communication: string;
  attachments: MailAttachmentRef[];
}): Promise<MailDocumentResult> {
  const input: LeadInput = { ...args.input };
  if (input.source && !(await isMailSourceAvailable())) delete input.source;
  return createDocumentFromMail({
    doctype: "Lead",
    payload: buildLeadPayload(input),
    communication: args.communication,
    attachments: args.attachments,
  });
}

/** Idem voor de offerteaanvraag (`Opportunity`, `opportunity_from = Customer`). */
export async function createOpportunityFromMail(args: {
  input: OpportunityInput;
  communication: string;
  attachments: MailAttachmentRef[];
}): Promise<MailDocumentResult> {
  const input: OpportunityInput = { ...args.input };
  if (input.source && !(await isMailSourceAvailable())) delete input.source;
  return createDocumentFromMail({
    doctype: "Opportunity",
    payload: buildOpportunityPayload(input),
    communication: args.communication,
    attachments: args.attachments,
  });
}

/* ─────────────────────────── Foutvertaling ───────────────────────────── */

export type LeadErrorKind = "series-stuck" | "permission" | "duplicate" | "missing-link" | "generic";

/**
 * Vertaalt een mislukte aanmaak naar een categorie waar de UI iets zinnigs
 * over kan zeggen. Zelfde opzet als `classifyBookingError`, met twee extra
 * gevallen die op de CRM-doctypes horen:
 *
 * - **`missing-link`** — een `LinkValidationError`, in de praktijk een
 *   ontbrekende UTM Source, Opportunity Type of Company. De payload laat de
 *   bron al weg als hij ontbreekt, maar een instance kan ook `Opportunity
 *   Type: Sales` missen, en dan is "stamgegeven ontbreekt" de enige melding
 *   waar een beheerder iets mee kan.
 * - **`series-stuck`** — Frappe telt de naamgevingsreeks niet op bij een
 *   mislukte insert, dus een reeks die achterloopt op de bestaande documenten
 *   is een permanente blokkade: elke poging kiest hetzelfde, al bezette
 *   nummer. Dat is op deze instance eerder gebeurd met `ACC-PINV-`; de
 *   oplossing ligt bij een beheerder (Instellingen → Document Naming
 *   Settings).
 */
export function classifyLeadError(err: unknown): LeadErrorKind {
  const status = Number((err as { status?: unknown })?.status);
  const message = typeof (err as { message?: unknown })?.message === "string"
    ? (err as { message: string }).message
    : "";
  if (/linkvalidationerror|could not find/i.test(message)) return "missing-link";
  if (status === 409 || /already exists/i.test(message)) return "series-stuck";
  if (status === 403 || /permissionerror|not permitted|no permission/i.test(message)) return "permission";
  if (/duplicate/i.test(message)) return "duplicate";
  return "generic";
}

/** Zodat aanroepers `err instanceof ApiError` niet zelf hoeven te importeren. */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
