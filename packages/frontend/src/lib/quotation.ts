/**
 * De schrijf- en opzoekkant van "mail → offerte".
 *
 * Zelfde rolverdeling als bij de lead: `mail-quote-actions.ts` bepaalt *of* de
 * knop er staat, `quotation-payload.ts` bouwt de payload, en deze module praat
 * met ERPNext — defaults ophalen en het document aanmaken via
 * `communication-link.ts`, dezelfde weg als de inkoopfactuur en de lead. Dat
 * hergebruik is de reden dat de bijlagen niet opnieuw geüpload worden en dat
 * de mail zowel via `reference_*` als via `timeline_links` aan de offerte
 * hangt.
 */

import { ApiError, fetchDocument, fetchList } from "./erpnext.ts";
import {
  createDocumentFromMail,
  type MailAttachmentRef,
  type MailDocumentResult,
} from "./communication-link.ts";
import { buildQuotationPayload, type QuotationInput } from "./quotation-payload.ts";

export type { MailAttachmentRef, MailDocumentResult };

/* ─────────────────────────────── Defaults ────────────────────────────── */

export interface QuotationDefaults {
  /** Valuta-docname; `""` als hij niet te bepalen was. */
  currency: string;
  /** Selling Price List-docname; `""` als er geen bruikbare is. */
  sellingPriceList: string;
}

const DEFAULTS_TTL_MS = 15 * 60_000;
const defaultsCache = new Map<string, { at: number; value: QuotationDefaults }>();

export function resetQuotationDefaultsCache(): void {
  defaultsCache.clear();
}

/**
 * Valuta en verkoopprijslijst voor dit bedrijf.
 *
 * Beide zijn **verplicht** op Quotation, maar ERPNext vult ze zelf in als je
 * ze weglaat (live geverifieerd: een insert zonder valuta kwam terug met
 * `currency: "EUR"` en `selling_price_list: "Standard Selling"`). Deze functie
 * bestaat dus niet om de insert te laten slagen, maar om de gebruiker in de
 * dialoog te laten *zien* waarin hij offreert — en om het te kunnen wijzigen
 * wanneer de instance meerdere prijslijsten heeft.
 *
 * Mislukt een van de queries, dan blijft het veld leeg en laat de payload het
 * weg; ERPNext leidt het dan alsnog af. Nooit een waarde verzinnen: een
 * verkeerde prijslijst levert stilzwijgend verkeerde tarieven op.
 */
export async function fetchQuotationDefaults(company: string): Promise<QuotationDefaults> {
  const key = company || "-";
  const hit = defaultsCache.get(key);
  if (hit && Date.now() - hit.at < DEFAULTS_TTL_MS) return hit.value;

  let currency = "";
  if (company) {
    try {
      const doc = await fetchDocument<{ default_currency?: string }>("Company", company);
      currency = (doc?.default_currency || "").trim();
    } catch {
      // Geen leesrecht op Company → ERPNext leidt de valuta zelf af.
    }
  }
  if (!currency) {
    try {
      const gd = await fetchDocument<{ default_currency?: string }>("Global Defaults", "Global Defaults");
      currency = (gd?.default_currency || "").trim();
    } catch {
      // Ook hier: leeg laten is beter dan gokken.
    }
  }

  let sellingPriceList = "";
  try {
    const rows = await fetchList<{ name: string; currency?: string }>("Price List", {
      fields: ["name", "currency"],
      filters: [["selling", "=", 1], ["enabled", "=", 1]],
      limit_page_length: 0,
      order_by: "name asc",
    });
    // Voorkeur voor een prijslijst in dezelfde valuta; anders de eerste. Een
    // prijslijst in een andere valuta laat ERPNext omrekenen, en dat is bijna
    // nooit wat er bedoeld wordt.
    const match = currency ? rows.find((r) => r.currency === currency) : undefined;
    sellingPriceList = (match ?? rows[0])?.name ?? "";
  } catch {
    // Geen leesrecht op Price List → ERPNext kiest de bedrijfsdefault.
  }

  const value: QuotationDefaults = { currency, sellingPriceList };
  defaultsCache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * De verkoopprijslijsten waaruit gekozen kan worden. Leeg = de dialoog toont
 * alleen de opgeloste default (of niets) en laat ERPNext beslissen.
 */
export async function fetchSellingPriceLists(): Promise<string[]> {
  try {
    const rows = await fetchList<{ name: string }>("Price List", {
      fields: ["name"],
      filters: [["selling", "=", 1], ["enabled", "=", 1]],
      limit_page_length: 0,
      order_by: "name asc",
    });
    return rows.map((r) => r.name);
  } catch {
    return [];
  }
}

/* ────────────────────────────── Aanmaken ─────────────────────────────── */

/**
 * Maak de concept-offerte, hang de gekozen bijlagen eraan en koppel de mail.
 * Gooit alleen wanneer het aanmaken zelf mislukt — zie `createDocumentFromMail`.
 */
export async function createQuotationFromMail(args: {
  input: QuotationInput;
  /** Communication-docname van de mail. */
  communication: string;
  attachments: MailAttachmentRef[];
}): Promise<MailDocumentResult> {
  return createDocumentFromMail({
    doctype: "Quotation",
    payload: buildQuotationPayload(args.input),
    communication: args.communication,
    attachments: args.attachments,
  });
}

/* ─────────────────────────── Foutvertaling ───────────────────────────── */

export type QuotationErrorKind =
  | "series-stuck" | "permission" | "missing-link" | "missing-party" | "generic";

/**
 * Vertaalt een mislukte aanmaak naar een categorie waar de UI iets zinnigs
 * over kan zeggen. Zelfde opzet als `classifyLeadError`, met één extra geval
 * dat op Quotation hoort:
 *
 * - **`missing-party`** — `party_name` verwijst naar een Customer of Lead die
 *   niet (meer) bestaat, of `quotation_to` en `party_name` spreken elkaar
 *   tegen. Dat is de enige fout die de gebruiker zélf kan oplossen (andere
 *   partij kiezen), dus hij verdient een eigen melding in plaats van de
 *   algemene "stamgegeven ontbreekt".
 */
export function classifyQuotationError(err: unknown): QuotationErrorKind {
  const status = Number((err as { status?: unknown })?.status);
  const message = typeof (err as { message?: unknown })?.message === "string"
    ? (err as { message: string }).message
    : "";
  if (/could not find (customer|lead)|invalid.*party|party_name/i.test(message)) return "missing-party";
  if (/linkvalidationerror|could not find/i.test(message)) return "missing-link";
  if (status === 409 || /already exists/i.test(message)) return "series-stuck";
  if (status === 403 || /permissionerror|not permitted|no permission/i.test(message)) return "permission";
  return "generic";
}

/** Zodat aanroepers `err instanceof ApiError` niet zelf hoeven te importeren. */
export function isQuotationApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
