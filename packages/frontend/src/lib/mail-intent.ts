/**
 * Eén herkenningslaag voor "wat wil deze mail van me?".
 *
 * Y-next herkende al inkoopfacturen (`invoice-detect.ts`). Daar komen nu twee
 * bedoelingen bij: een **lead** (onbekende afzender die contact zoekt) en een
 * **offerteaanvraag** (bestaande klant die om een prijs vraagt). Die zijn
 * bewust *niet* als tweede, parallel systeem gebouwd:
 *
 * 1. **Per mail hooguit één voorstel.** Een mail die zowel "factuur" als
 *    "offerte" in het onderwerp draagt mag geen twee balkjes opleveren waarvan
 *    er één per definitie fout is. Deze module beslist de volgorde
 *    (inkoopfactuur wint) en geeft precies één `MailIntentKind` terug.
 * 2. **Eén onderdrukking.** "Nee, dit is het niet" werkt via
 *    `mail-suggestions.ts` voor élke soort, met dezelfde opslag en dezelfde
 *    knop. Twee losse afwijs-lijstjes zouden onvermijdelijk uit de pas lopen.
 * 3. **Eén set afzender-feiten.** Of een adres bij een leverancier, een klant
 *    of niemand hoort, wordt hier één keer bepaald — met dezelfde
 *    domein-/gratis-mailregels als de factuurherkenning (die helpers komen
 *    letterlijk uit `invoice-detect.ts`, niet uit een kopie).
 *
 * Net als de factuurherkenning is dit een **pure** module: geen React, geen
 * netwerk. Alles komt binnen via `MailIntentSignals` en `MailIntentContext`,
 * zodat de beslisregel met `node --test` tegen de échte onderwerpen uit de
 * instance te toetsen is.
 *
 * ── De beslisregel ────────────────────────────────────────────────────────
 *
 * - Afzender is een bestaande **Customer** (adres of niet-gratis domein via de
 *   gekoppelde Contacts) + aanvraagwoorden → **offerteaanvraag**, voorstel is
 *   een `Opportunity` met `opportunity_from = "Customer"`.
 * - Afzender is **onbekend** (geen Customer, geen Supplier, niet van een eigen
 *   domein) + aanvraag-/kennismakingswoorden → **lead**, voorstel is een
 *   `Lead`.
 * - **Nooit** voorstellen bij: eigen domein, no-reply/notificatie-afzenders,
 *   automatische antwoorden, nieuwsbrieven, mails die al als inkoopfactuur
 *   gelden, mails met een offerte-/order-/factuurreeks in het onderwerp (dan
 *   loopt het traject al), support-/storingsmeldingen, en mails die al aan een
 *   ERPNext-document hangen.
 * - Een **leverancier** die iets vraagt is geen lead: dat is inkoop, niet
 *   verkoop. Die tak levert `none`.
 *
 * ── Waarom een woordscore en geen enkel signaal ───────────────────────────
 *
 * Dezelfde reden als bij de factuurherkenning: op deze mailbox zit het bewijs
 * verspreid. "Kennismaking" staat in het onderwerp, maar "we zijn op zoek naar
 * een betaalbaar alternatief" staat alleen in de body van een mail waarvan het
 * onderwerp ("CAD software voor de gemeente Haacht.") niets verraadt. Eén
 * regexje op het onderwerp zou de tweede missen; één regexje op de body zou
 * elke handtekening met het woord "informatie" binnenhalen. Onderwerp-treffers
 * wegen daarom zwaarder dan body-treffers, en er zijn drie sterktes.
 *
 * `Re:`-antwoorden krijgen een **aftrek**: een lopend gesprek is geen nieuwe
 * aanvraag. Dat is wat "Re: NLLCS++ export GEN" (een klant die in een lopende
 * thread om een vervolgafspraak vraagt) onder de drempel houdt, terwijl
 * "Offerte aanvraag website VDMB.eu" er ruim boven blijft.
 */

import {
  detectPurchaseInvoice,
  domainsRelated,
  emailDomain,
  isFreemailDomain,
  normalizeCompanyName,
  type InvoiceGuess,
  type InvoiceSignals,
  type SupplierHint,
} from "./invoice-detect.ts";

/* ─────────────────────────── Publieke vormen ─────────────────────────── */

/**
 * Eén relatie zoals de herkenning hem kent — klant óf leverancier. Zelfde
 * vorm als `SupplierHint`, want de matchlogica is identiek; alleen de
 * conclusie verschilt.
 */
export interface PartyHint {
  /** Docname (Customer of Supplier). */
  name: string;
  /** `customer_name` / `supplier_name`, als die afwijkt van de docname. */
  partyName?: string;
  /** Bekende adressen (het party-veld zelf + de gekoppelde Contacts). */
  emails?: string[];
}

export interface MailIntentSignals extends InvoiceSignals {
  /** `Communication.sender_full_name`; de beste bron voor de persoonsnaam. */
  senderName?: string;
  /**
   * Doctype waaraan de mail al hangt (`Communication.reference_doctype`).
   * Een mail die al aan een factuur, project of lead gekoppeld is, is
   * afgehandeld — daar hoort geen nieuw voorstel meer bij.
   */
  linkedDoctype?: string;
}

export interface MailIntentContext {
  suppliers: SupplierHint[];
  customers: PartyHint[];
  /**
   * Domeinen van de eigen Email Accounts. Een mail van een collega is nooit
   * een lead; zonder deze lijst zou elke interne mail met het woord "offerte"
   * er een worden.
   */
  ownDomains?: string[];
  /** Losse eigen adressen (bv. het adres van de ingelogde gebruiker). */
  ownEmails?: string[];
}

/** Wat de herkenning over de afzender heeft kunnen vinden. Leeg = niet gevonden. */
export interface ContactDetails {
  personName?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
}

export type MailIntentKind = "purchase-invoice" | "lead" | "quote-request" | "none";
export type IntentConfidence = "high" | "medium" | "low";

export interface MailIntent {
  kind: MailIntentKind;
  confidence: IntentConfidence;
  /** Stabiele codes van wat is herkend; de UI vertaalt ze. */
  reasons: string[];
  /** Gevuld bij `purchase-invoice` — de bestaande factuurherkenning. */
  invoice?: InvoiceGuess;
  /** Gevuld bij `lead` en `quote-request`. */
  contact?: ContactDetails;
  /** Customer-docname; alleen bij `quote-request`. */
  customer?: string;
}

/* ──────────────────────────── Woordenlijsten ─────────────────────────── */

/**
 * Woorden die zonder meer een commerciële aanvraag aankondigen. Een treffer
 * hierop in het onderwerp is in de praktijk beslissend.
 */
const STRONG_REQUEST_WORDS: RegExp[] = [
  /\bofferte(?:s|aanvraag|aanvragen)?\b/i,
  /\bprijs(?:opgave|indicatie|aanvraag|vraag)\b/i,
  /\bkostenraming\b/i,
  /\bofferteverzoek\b/i,
  /\baanvraag\b/i,
  /\bkennismaking\b/i,
  /\bkennis\s*(?:te\s*)?maken\b/i,
  /\bop\s+zoek\s+naar\b/i,
  /\blooking\s+for\b/i,
  /\brequest\s+for\s+(?:quote|quotation|proposal|information)\b/i,
  /\brfq\b/i,
  /\bquotation\b/i,
  /\bquote\b/i,
];

/** Woorden die op zichzelf te zwak zijn, maar samen wél iets zeggen. */
const MEDIUM_REQUEST_WORDS: RegExp[] = [
  /\binteresse\b/i,
  /\bge[iï]nteresseerd\b/i,
  /\binterested\b/i,
  /\b(?:meer\s+)?informatie\s+over\b/i,
  /\bvrijblijvend\b/i,
  /\binschatting\b/i,
  /\bmogelijkheden\b/i,
  /\bsamenwerking\b/i,
  /\bcooperation\b/i,
  /\bcollaborat(?:e|ion)\b/i,
  /\bpartnership\b/i,
  /\bdemo(?:nstratie)?\b/i,
  /\blicent(?:ie|ies)\b/i,
  /\blicens(?:e|ing)\b/i,
  /\bwat\s+(?:zou\s+)?(?:dit|het|dat)\s+(?:gaat?\s+)?kost/i,
];

/** Beleefdheidsvormen waarmee om iets gevraagd wordt. Alleen als versterking. */
const WEAK_REQUEST_WORDS: RegExp[] = [
  /\bkunnen\s+jullie\b/i,
  /\bzouden\s+jullie\b/i,
  /\bzou\s+je\s+.{0,30}\bkunnen\b/i,
  /\bwould\s+like\s+to\b/i,
  /\bcould\s+you\b/i,
  /\bgraag\s+(?:een\s+)?(?:gesprek|afspraak|contact)\b/i,
];

/**
 * Onderwerpen van storings- en supportmeldingen. Iemand die meldt dat iets
 * kapot is, vraagt niet om een offerte — ook al staat er "kunnen jullie" in.
 *
 * Bewust **alleen op het onderwerp**. In een body is "probleem" een gewoon
 * Nederlands woord ("we hebben een probleem met onze oude tekensoftware") en
 * staat het juist ín een aanvraag; in een onderwerp is het een melding.
 */
const SUPPORT_SUBJECT_WORDS =
  /(werk(?:t|en)?\s+niet|niet\s+te\s+werken|doet\s+het\s+niet|foutmelding|storing|kapot|defect|\bbug\b|\bcrash|klacht|does\s+not\s+work|not\s+working|\berror\b)/i;

/**
 * Naamgevingsreeksen die zeggen dat het traject al lóópt. "Re: Offerte
 * MPG-berekening & Bestekschrijven — SAL-QTN-2026-00013" is een gesprek over
 * een bestaande offerte; daar hoort geen nieuwe offerteaanvraag bij.
 *
 * `crm-lead`/`crm-opp` staan er ook in: een mail die al naar een lead of
 * opportunity verwijst, heeft er al één.
 */
const EXISTING_DEAL_SERIES =
  /\b(sal-qtn|imp-qtn|qtn-\d|crm-lead|crm-opp|sal-ord|acc-sinv|acc-pinv|sinv-|purch-ord)\b/i;

/** Reclame en abonnementenpost — nooit een lead. */
const NEWSLETTER_WORDS =
  /\b(nieuwsbrief|newsletter|uitschrijven|unsubscribe|afmelden|webinar|kortingscode|black\s*friday|vacature)\b/i;

/** Automatische antwoorden en systeemmeldingen, herkend aan het onderwerp. */
const AUTOMATED_SUBJECT =
  /(automatisch\s+antwoord|automatic\s+reply|out\s+of\s+office|afwezigheidsbericht|undeliverable|delivery\s+status\s+notification|mail\s+delivery\s+failed|verification\s+code|recovery\s+code|beveiligingscode|one-?time\s+(?:pass)?code|\bOTP\b|password\s+reset|wachtwoord\s+herstellen)/i;

/** Lokale delen van adressen waar geen mens achter zit. */
const AUTOMATED_LOCALPART =
  /^(no-?reply|donotreply|do-not-reply|noreply|mailer-daemon|postmaster|bounces?|bounced|notifications?|notify|alerts?|automated?|auto-?reply|newsletter|nieuwsbrief|security|verify|verification|accounts?)([-.+]|$)/i;

/**
 * Domeinen waarvandaan alleen platformmeldingen komen. Subdomeinen tellen mee
 * (`mail.instagram.com` hoort bij `instagram.com`) via `domainsRelated`.
 */
const AUTOMATED_DOMAINS = [
  "github.com", "instagram.com", "linkedin.com", "facebook.com", "facebookmail.com",
  "twitter.com", "x.com", "google.com", "microsoft.com", "microsoftonline.com",
  "frappecloud.com", "atlassian.net", "slack.com", "sendgrid.net", "amazonses.com",
  "mailchimp.com", "mailchimpapp.net", "docusign.net", "zoom.us",
];

/** `Re:`-varianten in de talen die deze mailbox tegenkomt. */
const REPLY_PREFIX = /^\s*(re|aw|antw|antwoord|sv|vs)\s*[:\]]/i;

/* ─────────────────────────── Afzender-feiten ─────────────────────────── */

export type SenderRelation = "own" | "supplier" | "customer" | "unknown";

export interface SenderFacts {
  relation: SenderRelation;
  /** Docname van de gematchte Customer (alleen bij `relation === "customer"`). */
  customer?: string;
  /** Code die zegt waaróp gematcht is; de UI vertaalt hem. */
  reason?: string;
  /** `true` bij no-reply-, notificatie- en platformafzenders. */
  automated: boolean;
}

function matchParty(
  sender: string,
  parties: PartyHint[],
): { name: string; reason: "email" | "domain" } | null {
  const address = (sender || "").trim().toLowerCase();
  if (!address) return null;
  const domain = emailDomain(address);
  const domainUsable = Boolean(domain) && !isFreemailDomain(domain);

  let byDomain: string | null = null;
  for (const party of parties) {
    const emails = (party.emails || []).map((e) => e.trim().toLowerCase()).filter(Boolean);
    // Exact adres is beslissend en werkt óók op een gratis-mailadres: dit is
    // een gerichte treffer en geen domeingok.
    if (emails.includes(address)) return { name: party.name, reason: "email" };
    if (!byDomain && domainUsable && emails.some((e) => domainsRelated(domain, emailDomain(e)))) {
      byDomain = party.name;
    }
  }
  return byDomain ? { name: byDomain, reason: "domain" } : null;
}

/**
 * Wie is de afzender voor ons? Deze volgorde is bewust:
 *
 * 1. **Eigen domein** wint van alles — een collega is geen relatie.
 * 2. **Leverancier** vóór klant. Een partij die beide is (het komt voor: een
 *    klant die ook dienstverlener is) moet aan de inkoopkant landen, want dáár
 *    zit het risico op een onterecht verkoopvoorstel.
 * 3. **Klant** — de tak die tot een offerteaanvraag leidt.
 */
export function classifySender(sender: string, ctx: MailIntentContext): SenderFacts {
  const address = (sender || "").trim().toLowerCase();
  const domain = emailDomain(address);
  const local = address.slice(0, address.indexOf("@") === -1 ? address.length : address.indexOf("@"));

  const automated =
    AUTOMATED_LOCALPART.test(local)
    || AUTOMATED_DOMAINS.some((d) => domainsRelated(domain, d));

  const ownEmails = (ctx.ownEmails || []).map((e) => e.trim().toLowerCase());
  const ownDomains = (ctx.ownDomains || []).map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (address && (ownEmails.includes(address) || ownDomains.some((d) => domainsRelated(domain, d)))) {
    return { relation: "own", automated };
  }

  const supplier = matchParty(address, ctx.suppliers.map(toPartyHint));
  if (supplier) return { relation: "supplier", reason: `supplier:${supplier.reason}`, automated };

  const customer = matchParty(address, ctx.customers);
  if (customer) {
    return { relation: "customer", customer: customer.name, reason: `customer:${customer.reason}`, automated };
  }
  return { relation: "unknown", automated };
}

function toPartyHint(hint: SupplierHint): PartyHint {
  const out: PartyHint = { name: hint.name };
  if (hint.supplierName) out.partyName = hint.supplierName;
  if (hint.emails) out.emails = hint.emails;
  return out;
}

/* ───────────────────────────── Woordscore ────────────────────────────── */

interface WordScore {
  score: number;
  reasons: string[];
}

function countWords(subject: string, body: string): WordScore {
  const reasons: string[] = [];
  let score = 0;

  const tiers: Array<[RegExp[], number, string]> = [
    [STRONG_REQUEST_WORDS, 3, "strong"],
    [MEDIUM_REQUEST_WORDS, 2, "medium"],
    [WEAK_REQUEST_WORDS, 1, "weak"],
  ];
  // Per sterkte hooguit twee treffers meetellen. Een body die "offerte" acht
  // keer noemt is niet vier keer zo zeker als een die het twee keer noemt, en
  // zonder plafond zou één woordenrijke mail elke drempel halen.
  for (const [patterns, weight, tier] of tiers) {
    let hits = 0;
    for (const pattern of patterns) {
      if (hits >= 2) break;
      const inSubject = pattern.test(subject);
      const inBody = !inSubject && pattern.test(body);
      if (!inSubject && !inBody) continue;
      hits += 1;
      score += weight;
      if (inSubject) {
        // Het onderwerp is de samenvatting die de afzender zelf koos; een
        // aanvraagwoord dáár weegt zwaarder dan hetzelfde woord in een
        // handtekening of een geciteerde eerdere mail.
        score += 2;
        reasons.push(`request:${tier}-subject`);
      } else {
        reasons.push(`request:${tier}-body`);
      }
    }
  }
  return { score, reasons };
}

/* ─────────────────────── Gegevens uit de afzender ────────────────────── */

/** Tussenvoegsels die bij de achternaam horen, niet bij de voornaam. */
const NAME_INFIXES = new Set([
  "van", "de", "der", "den", "het", "ter", "te", "ten", "op", "aan", "in", "'t",
  "vd", "von", "du", "da", "di", "del", "la", "le", "dos", "das",
]);

/**
 * Splitst een volledige naam in voor- en achternaam. "Piebe van der Storm" →
 * `{ first: "Piebe", last: "van der Storm" }`; de tussenvoegsels gaan mee naar
 * achteren, want dat is hoe ERPNext ze in `last_name` verwacht.
 */
export function splitPersonName(full: string): { firstName: string; lastName: string } {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  // Vanaf het eerste tussenvoegsel hoort alles bij de achternaam.
  let cut = 1;
  for (let i = 1; i < parts.length; i += 1) {
    if (NAME_INFIXES.has(parts[i].toLowerCase())) { cut = i; break; }
    cut = parts.length - 1;
  }
  return { firstName: parts.slice(0, cut).join(" "), lastName: parts.slice(cut).join(" ") };
}

/**
 * Een adres in de mailtekst laat zich niet van een bedrijfsnaam onderscheiden
 * op woordniveau, maar wél op vorm: adresregels eindigen op een huisnummer of
 * dragen een postcode. "Ekster Monument & Renovatie" mag door, "Přelovice 99"
 * niet — anders zou de dialoog een straatnaam als bedrijfsnaam voorstellen.
 */
function looksLikeAddressLine(line: string): boolean {
  if (/\d{4}\s?[A-Za-z]{2}\b/.test(line)) return true;      // NL-postcode
  if (/^\d{4,6}\b/.test(line)) return true;                  // buitenlandse postcode vooraan
  if (/\d+\s*[a-zA-Z]?$/.test(line.trim())) return true;     // eindigt op huisnummer
  return false;
}

const SIGNATURE_MARKER =
  /(met\s+vriendelijke\s+groet|vriendelijke\s+groet|met\s+hartelijke\s+groet|hartelijke\s+groet|groeten|kind\s+regards|best\s+regards|regards|sincerely|mit\s+freundlichen\s+gr)/i;

const CONTACT_NOISE =
  /(@|https?:\/\/|www\.|\.nl\b|\.com\b|\.be\b|\.eu\b|\.cz\b|\.de\b|tel\.?[:\s]|telefoon|mobiel|\bT\s*[:+]|\bM\s*[:+])/i;

/**
 * Bedrijfsnaam uit het handtekeningblok. Gaat als volgt te werk:
 *
 * - Zoek de laatste groet-regel; alles daaronder is de handtekening.
 * - Staat de persoonsnaam op een regel met " - " of " | " erin, dan is wat er
 *   ná de scheiding staat de bedrijfsnaam ("Piebe van der Storm - Ekster
 *   Monument & Renovatie"). Dat is de vorm die particuliere afzenders
 *   gebruiken.
 * - Anders: de eerste bruikbare regel ná de naamregel — geen adres, geen
 *   telefoonnummer, geen URL, geen functietitel-achtige lengte.
 *
 * Vindt hij niets, dan geeft hij `""` terug. **Niets verzinnen** is hier de
 * regel: een verkeerde bedrijfsnaam wordt zonder nadenken bevestigd, een leeg
 * veld wordt ingevuld.
 */
export function companyFromSignature(bodyText: string, personName?: string): string {
  const text = (bodyText || "").replace(/\r/g, "");
  if (!text) return "";
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let start = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (SIGNATURE_MARKER.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return "";

  const tail = lines.slice(start + 1, start + 8);
  const name = (personName || "").trim().toLowerCase();

  for (let i = 0; i < tail.length; i += 1) {
    const line = tail[i];
    if (!name || !line.toLowerCase().includes(name)) continue;
    const split = line.split(/\s+[-–|·]\s+/);
    if (split.length > 1) {
      const candidate = split[split.length - 1].trim();
      if (isUsableCompanyLine(candidate)) return candidate;
    }
    // Naamregel gevonden zonder scheidingsteken: pak de eerstvolgende regel
    // die geen contactgegeven of adres is. Dat is in de praktijk óf de
    // functietitel óf het bedrijf; een functietitel bevat bijna altijd een
    // spatie en geen hoofdlettergevoelige merknaam, dus we nemen de eerste
    // twee kandidaten en kiezen de laatste — dat is waar het bedrijf staat.
    const following = tail.slice(i + 1).filter(isUsableCompanyLine).slice(0, 2);
    if (following.length > 0) return following[following.length - 1];
    return "";
  }
  return "";
}

function isUsableCompanyLine(line: string): boolean {
  const value = (line || "").trim();
  if (value.length < 2 || value.length > 60) return false;
  if (CONTACT_NOISE.test(value)) return false;
  if (looksLikeAddressLine(value)) return false;
  if (/^[^a-zA-Z]+$/.test(value)) return false;
  return true;
}

/**
 * Bedrijfsnaam afgeleid uit het afzenderdomein, als laatste redmiddel.
 * `zima-engineering.cz` → "Zima Engineering". Dat is geen gok maar een
 * herschrijving van gegevens die er staan; de gebruiker ziet hem in een
 * bewerkbaar veld en corrigeert hem als het net anders heet.
 *
 * Gratis-mailproviders leveren niets op — "Gmail" als bedrijfsnaam is erger
 * dan leeg.
 */
export function companyFromDomain(domain: string): string {
  const value = (domain || "").trim().toLowerCase();
  if (!value || isFreemailDomain(value)) return "";
  const labels = value.split(".").filter(Boolean);
  if (labels.length < 2) return "";
  // Achtervoegsel weg (`.co.nl`, `.com`); wat overblijft is de merknaam.
  let base = labels[labels.length - 2];
  if (base.length <= 3 && labels.length >= 3) base = labels[labels.length - 3];
  if (base.length < 2) return "";
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Telefoonnummer uit het handtekeninggedeelte. Alleen de laatste 1200 tekens
 * worden bekeken: eerder in de mail staan projectnummers, bedragen en
 * jaartallen die er ook als een nummer uitzien.
 *
 * Geaccepteerd worden `+31 657421249`, `0643430257`, `(06 130 724 08)` en
 * `M 9038375227` — allemaal vormen die letterlijk in deze mailbox staan.
 */
export function extractPhone(bodyText: string): string {
  const tail = (bodyText || "").slice(-1200);
  const candidates = tail.match(/(?:\+\d[\d\s().-]{7,20}\d)|(?:\b0\d[\d\s().-]{6,18}\d)|(?:\b[1-9]\d{8,11}\b)/g);
  if (!candidates) return "";
  for (const raw of candidates) {
    const cleaned = raw.replace(/[^\d+]/g, "");
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) continue;
    // Een jaartal-reeks als "20260430" is geen telefoonnummer.
    if (/^(19|20)\d{2}(0[1-9]|1[0-2])/.test(digits)) continue;
    return raw.trim().replace(/^\(|\)$/g, "").replace(/\s{2,}/g, " ");
  }
  return "";
}

/** Alles wat over de afzender te vinden was. Leeg blijft leeg. */
export function extractContactDetails(signals: MailIntentSignals): ContactDetails {
  const out: ContactDetails = {};
  const sender = (signals.sender || "").trim();
  if (sender) out.email = sender;

  const personName = (signals.senderName || "").trim();
  if (personName && !personName.includes("@")) {
    out.personName = personName;
    const { firstName, lastName } = splitPersonName(personName);
    if (firstName) out.firstName = firstName;
    if (lastName) out.lastName = lastName;
  }

  const body = signals.bodyText || "";
  const company = companyFromSignature(body, out.personName) || companyFromDomain(emailDomain(sender));
  if (company) out.companyName = company;

  const phone = extractPhone(body);
  if (phone) out.phone = phone;
  return out;
}

/* ──────────────────────────── De herkenning ──────────────────────────── */

/** Vanaf hier wordt een aanvraag voorgesteld; daaronder houdt Y-next zijn mond. */
const PROPOSE_THRESHOLD = 3;
/** Vanaf hier heet het "hoge zekerheid". */
const HIGH_THRESHOLD = 5;
/** Aftrek voor een `Re:`-antwoord: een lopend gesprek is geen nieuwe aanvraag. */
const REPLY_PENALTY = 2;

/**
 * Bepaalt wat deze mail van de gebruiker wil. Geeft altijd precies één
 * bedoeling terug — zie de moduletoelichting voor de volgorde.
 */
export function classifyMailIntent(
  signals: MailIntentSignals,
  ctx: MailIntentContext,
): MailIntent {
  const none = (reason: string): MailIntent => ({ kind: "none", confidence: "low", reasons: [reason] });

  if (signals.direction === "sent") return none("negative:sent");
  if (signals.linkedDoctype) return none("negative:already-linked");

  // De factuurherkenning gaat vóór: een factuurmail is nooit een lead, en het
  // omgekeerde voorstel zou een boeking in de weg zitten.
  const invoice = detectPurchaseInvoice(signals, ctx.suppliers);
  if (invoice.isLikely) {
    return { kind: "purchase-invoice", confidence: invoice.confidence, reasons: invoice.reasons, invoice };
  }

  const subject = signals.subject || "";
  const body = signals.bodyText || "";

  if (NEWSLETTER_WORDS.test(subject)) return none("negative:newsletter");
  if (AUTOMATED_SUBJECT.test(subject)) return none("negative:automated-subject");
  if (SUPPORT_SUBJECT_WORDS.test(subject)) return none("negative:support");
  if (EXISTING_DEAL_SERIES.test(subject)) return none("negative:existing-deal");

  const facts = classifySender(signals.sender, ctx);
  if (facts.automated) return none("negative:automated-sender");
  if (facts.relation === "own") return none("negative:own-domain");
  // Een leverancier die iets vraagt is inkoop, geen verkoopkans.
  if (facts.relation === "supplier") return none("negative:supplier");

  const words = countWords(subject, body);
  let score = words.score;
  const reasons = [...words.reasons];
  if (REPLY_PREFIX.test(subject)) {
    score -= REPLY_PENALTY;
    reasons.push("negative:reply");
  }
  if (score < PROPOSE_THRESHOLD) return none("negative:no-request-words");

  const confidence: IntentConfidence = score >= HIGH_THRESHOLD ? "high" : "medium";
  const contact = extractContactDetails(signals);

  if (facts.relation === "customer" && facts.customer) {
    return {
      kind: "quote-request",
      confidence,
      reasons: [...reasons, facts.reason ?? "customer:email"],
      contact,
      customer: facts.customer,
    };
  }
  return { kind: "lead", confidence, reasons: [...reasons, "sender:unknown"], contact };
}

/**
 * Handige afgeleide: hoort deze bedoeling bij het verkoop-spoor (lead of
 * offerteaanvraag)? Scheelt de UI twee vergelijkingen op elke plek.
 */
export function isSalesIntent(kind: MailIntentKind): kind is "lead" | "quote-request" {
  return kind === "lead" || kind === "quote-request";
}

/** Alleen voor de dialoog: de bedrijfsnaam die als klant getoond moet worden. */
export function partyLabel(hints: PartyHint[], name: string): string {
  const hit = hints.find((h) => h.name === name);
  return hit?.partyName ?? name;
}

/** Zelfde normalisatie als de factuurherkenning; hier her-geëxporteerd zodat
 *  aanroepers niet twee modules hoeven te importeren voor één helper. */
export { normalizeCompanyName };
