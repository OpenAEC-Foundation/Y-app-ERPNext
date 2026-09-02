/**
 * Wanneer verschijnt "Offerte maken" bij een mail, en met hoeveel nadruk?
 *
 * `mail-intent.ts` beantwoordt "wat wil deze mail van me?" en levert precies
 * één bedoeling. Deze module beantwoordt de vervolgvraag: **welke knoppen
 * horen daarbij**, gegeven wat we óók over de afzender weten (is hij al klant,
 * hangt er al een lead aan zijn adres). Dat is bewust een aparte, pure functie
 * en geen `&&`-keten in de JSX van `Webmail.tsx` en `MailView.tsx` — die twee
 * schermen tonen dezelfde balk en zouden gegarandeerd uit elkaar lopen.
 *
 * ── De regel ──────────────────────────────────────────────────────────────
 *
 * - **Offerteaanvraag** (`quote-request`, dus een bestáánde klant die om een
 *   prijs vraagt) → offerte is de **primaire** actie. Dit is het geval waar de
 *   gebruiker om vroeg: "ook maar echt gelijk quotation dus."
 * - **Lead** (onbekende afzender) → offerte is **secundair**. De lead blijft
 *   de primaire knop, want die legt de relatie vast en dát is wat er als
 *   eerste moet gebeuren; ERPNext converteert een Lead zelf naar Customer,
 *   andersom is het handwerk. De offerte kan wél meteen: `quotation_to` mag
 *   `"Lead"` zijn, dus er hoeft geen klant te bestaan.
 * - **Gewone mail van een bekende klant** (geen bedoeling herkend) → offerte
 *   **secundair**. Iemand die belt "stuur even een offerte" laat geen
 *   aanvraagwoorden achter in zijn mail; de knop moet er dan toch zijn.
 * - **Onbekende afzender zonder herkende bedoeling** → `needsParty`. De knop
 *   verschijnt, maar leidt eerst langs "relatie of lead aanmaken" — falen op
 *   een ontbrekende klant ná het invullen van vier offerteregels is de
 *   slechtste van alle uitkomsten.
 * - **Inkoopfactuur** en **verzonden mail** → geen offerte-knop. Een
 *   factuurmail is inkoop; bij een verzonden mail ben jíj de afzender.
 *
 * Alles wat de regel nodig heeft komt binnen als gewone waarden, zodat elke
 * tak met `node --test` te controleren is.
 */

import type { MailIntentKind } from "./mail-intent.ts";

export interface QuoteActionSignals {
  /** Uitkomst van `classifyMailIntent`. */
  intentKind: MailIntentKind;
  /** `"sent"` = eigen verzonden mail. */
  direction: "received" | "sent";
  /** Customer-docname als de afzender een bekende klant is. */
  customer?: string;
  /** Lead-docname als er al een lead op dit adres staat. */
  lead?: string;
  /** Doctype waaraan de mail al hangt; een offerte-mail krijgt geen tweede. */
  linkedDoctype?: string;
}

/** Aan wie de offerte gericht wordt, als dat al vaststaat. */
export interface QuoteParty {
  doctype: "Customer" | "Lead";
  name: string;
}

export interface QuoteActionDecision {
  /** Wordt de knop getoond? */
  show: boolean;
  /** `"primary"` = gevulde knop, `"secondary"` = smallere tekstknop. */
  emphasis: "primary" | "secondary";
  /** De partij, als die al bekend is. Leeg bij `needsParty`. */
  party?: QuoteParty;
  /**
   * `true` wanneer er nog geen klant of lead is. De knop opent dan niet de
   * offertedialoog maar wijst eerst naar het aanmaken van de relatie/lead.
   */
  needsParty: boolean;
  /** Stabiele code van waaróm; de UI vertaalt hem in de tooltip. */
  reason: string;
}

const HIDDEN: QuoteActionDecision = {
  show: false, emphasis: "secondary", needsParty: false, reason: "quote:hidden",
};

/**
 * Levert de offerte-actie voor deze mail. Geeft altijd een uitspraak terug —
 * `show: false` is er één van, en draagt net als de rest een reden mee zodat
 * "waarom zie ik die knop niet?" te beantwoorden is zonder de code te lezen.
 */
export function decideQuoteAction(signals: QuoteActionSignals): QuoteActionDecision {
  if (signals.direction === "sent") return { ...HIDDEN, reason: "quote:sent" };
  // Een factuurmail hoort aan de inkoopkant; een tweede, tegengesteld voorstel
  // in dezelfde balk maakt de keuze alleen maar moeilijker.
  if (signals.intentKind === "purchase-invoice") return { ...HIDDEN, reason: "quote:purchase-invoice" };
  // Hangt de mail al aan een offerte, dan is het traject al begonnen.
  if (signals.linkedDoctype === "Quotation") return { ...HIDDEN, reason: "quote:already-quoted" };

  const customer = (signals.customer || "").trim();
  const lead = (signals.lead || "").trim();
  const party: QuoteParty | undefined = customer
    ? { doctype: "Customer", name: customer }
    : lead
      ? { doctype: "Lead", name: lead }
      : undefined;

  if (signals.intentKind === "quote-request") {
    // De herkenning heeft de klant al gevonden; zonder klant zou hij deze
    // bedoeling niet hebben afgegeven. Toch het vangnet, want de aanroeper
    // levert de klant aan en die kan hem vergeten.
    return party
      ? { show: true, emphasis: "primary", party, needsParty: false, reason: "quote:intent-quote-request" }
      : { show: true, emphasis: "primary", needsParty: true, reason: "quote:no-party" };
  }

  if (signals.intentKind === "lead") {
    return party
      ? { show: true, emphasis: "secondary", party, needsParty: false, reason: "quote:intent-lead" }
      : { show: true, emphasis: "secondary", needsParty: true, reason: "quote:no-party" };
  }

  // Geen bedoeling herkend. Bij een bekende klant of lead is de offerte een
  // gewone handeling die er gewoon moet staan; bij een volslagen onbekende
  // afzender zou een offerte-knop zonder partij alleen maar in een fout
  // eindigen — vandaar dat die de relatie-route krijgt.
  if (party) {
    return {
      show: true, emphasis: "secondary", party, needsParty: false,
      reason: party.doctype === "Customer" ? "quote:known-customer" : "quote:known-lead",
    };
  }
  return { ...HIDDEN, reason: "quote:unknown-sender" };
}
