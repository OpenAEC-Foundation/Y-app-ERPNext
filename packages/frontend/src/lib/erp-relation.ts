/**
 * "Onbekende afzender → relatie + contactpersoon" — de herkennings- en
 * schrijfkant.
 *
 * Vanuit de inbox moet één klik genoeg zijn om een afzender als **Customer**
 * (relatie) én **Contact** (contactpersoon) in ERPNext te zetten. Deze module
 * doet drie dingen, strikt gescheiden zodat het raadwerk los testbaar is van
 * het schrijfwerk:
 *
 *   1. `parseSenderDetails` — puur. Leest wat er in de afzenderregel en de
 *      handtekening *staat* en maakt daar een concept van. Wat er niet staat
 *      blijft leeg: een niet-gevonden bedrijfsnaam is een leeg veld, geen
 *      gok die er zeker uitziet. Elke wél-gevonden waarde krijgt een code in
 *      `reasons` (`company:signature`, `phone:labeled`, …) zodat de dialoog
 *      kan laten zien wáár hij het vandaan heeft — hetzelfde "herkend"-idioom
 *      als `invoice-detect.ts`.
 *   2. `lookupExisting` — is dit adres al bekend? Zonder deze check maakt de
 *      knop bij de tweede mail van dezelfde persoon een dubbele Contact aan.
 *   3. `createRelation` — schrijft, en doet dat idempotent-ish: bestaat het
 *      adres al, dan wordt dát teruggegeven in plaats van er iets naast te
 *      zetten.
 *
 * **Live geverifieerd op de doelinstance** (zie ook de tests):
 *
 * - `Customer` heeft precies twee verplichte velden: `customer_name` en
 *   `customer_type` (default `Company`). `customer_group` en `territory` zijn
 *   *niet* verplicht — ze worden daarom alleen meegestuurd als ze gevuld zijn
 *   en uit de instance zelf komen. Een Link-veld vullen met een waarde die op
 *   deze instance niet bestaat, laat het hele aanmaken klappen.
 * - `Contact` heeft géén verplichte velden in de meta, maar zonder
 *   `first_name` geeft Frappe de contactpersoon een hash als naam
 *   (`3tdqldpl7a`) in plaats van "Voornaam Achternaam-Klant". Vandaar dat
 *   `validateRelationDraft` een voornaam wél afdwingt.
 * - De koppeling Contact→Customer gaat via de `links`-child (`Dynamic Link`
 *   met `link_doctype: "Customer"` + `link_name`), en die mag in dezelfde
 *   POST mee — geen tweede update-call nodig. Het contact verschijnt daarna
 *   op de Customer.
 * - `Contact Email` is als losse lijst niet leesbaar (HTTP 403), maar je mág
 *   er wél vanuit de Contact-query op filteren (`["Contact Email", …]`) en
 *   uit selecteren met de backtick-notatie. Dezelfde truc als
 *   `fetchSupplierHints` gebruikt; zonder die truc mist de dubbelcheck elk
 *   secundair adres.
 */

import {
  createDocument,
  fetchDocument,
  fetchList,
  getErpNextLinkUrl,
} from "./erpnext.ts";
import { isPermissionError } from "./permission-error.ts";

/* ────────────────────────────── Types ────────────────────────────────── */

export interface SenderInfo {
  /** Het bare adres van de afzender, bv. "oerlemans@vandorp.eu". */
  email: string;
  /** De weergavenaam uit de From-regel, bv. "Arno Oerlemans". */
  displayName?: string;
  /** De mailtekst (plat of HTML — HTML wordt hier gestript). */
  bodyText?: string;
}

export interface RelationDraft {
  /** Naam van de relatie. Leeg = niets gevonden; `createCustomer` staat dan uit. */
  customerName: string;
  /** ERPNext-verplicht. "Company" tenzij het duidelijk een particulier is. */
  customerType: "Company" | "Individual";
  contactFirstName: string;
  contactLastName?: string;
  email: string;
  phone?: string;
  customerGroup?: string;
  territory?: string;
  createCustomer: boolean;
  /**
   * Herkenningscodes per veld, `veld:bron` (bv. `company:signature`). De
   * dialoog toont hiermee per veld of het herkend is of leeg gelaten.
   */
  reasons: string[];
}

export interface ExistingRelation {
  customer?: string;
  contact?: string;
  lead?: string;
}

export interface RelationResult {
  customer?: string;
  contact: string;
  /** True als het adres al bekend was en er dus niets nieuws is aangemaakt. */
  reused: boolean;
}

export interface RelationDefaults {
  customerGroups: string[];
  territories: string[];
  defaultCustomerGroup: string;
  defaultTerritory: string;
}

/* ──────────────────────── Adres- en naamherkenning ───────────────────── */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Adressen waar niemand achter zit. Een contactpersoon "No Reply" aanmaken is
 * erger dan niets aanmaken: hij vervuilt de suggestielijst voor altijd.
 */
const NOREPLY_PREFIXES = [
  "noreply", "donotreply", "mailerdaemon", "postmaster",
  "bounce", "notification", "automated", "autoreply",
];

export function isNoReplyAddress(email: string): boolean {
  const local = normalizeEmail(email).split("@")[0] ?? "";
  const flat = local.replace(/[^a-z]/g, "");
  if (!flat) return false;
  return NOREPLY_PREFIXES.some((prefix) => flat.startsWith(prefix));
}

/**
 * Mailboxen van een functie in plaats van een persoon. Daar hoort geen
 * verzonnen voornaam bij — de dialoog laat de gebruiker die zelf invullen.
 */
const ROLE_LOCALPARTS = new Set([
  "info", "sales", "verkoop", "inkoop", "admin", "administratie", "administration",
  "facturen", "factuur", "facturatie", "boekhouding", "accounting", "billing",
  "contact", "support", "helpdesk", "office", "kantoor", "mail", "post",
  "service", "servicedesk", "hello", "hallo", "team", "planning", "werk",
]);

export function isRoleAddress(email: string): boolean {
  const local = normalizeEmail(email).split("@")[0] ?? "";
  return ROLE_LOCALPARTS.has(local.replace(/[^a-z]/g, ""));
}

/**
 * Publieke mailproviders. Achter zo'n adres zit geen bedrijfsdomein, dus het
 * domein zegt niets over de relatie — daar mag geen bedrijfsnaam uit komen.
 */
const FREEMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.nl",
  "hotmail.be", "live.nl", "live.com", "live.be", "msn.com", "icloud.com",
  "me.com", "mac.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "aol.com",
  "proton.me", "protonmail.com", "pm.me", "gmx.net", "gmx.de", "web.de",
  "ziggo.nl", "kpnmail.nl", "planet.nl", "home.nl", "xs4all.nl", "casema.nl",
  "hetnet.nl", "chello.nl", "upcmail.nl", "telfort.nl", "online.nl",
  "telenet.be", "skynet.be", "scarlet.be", "proximus.be", "zonnet.nl",
]);

export function emailDomain(email: string): string {
  return normalizeEmail(email).split("@")[1] ?? "";
}

export function isFreemailDomain(domain: string): boolean {
  return FREEMAIL_DOMAINS.has(domain.trim().toLowerCase());
}

/**
 * "vandorp.eu" → "Vandorp", "egg-sellent.nl" → "Egg-Sellent".
 * Bewust alleen het hoofdlabel: "mail.instagram.com" → "Instagram".
 */
export function humanizeDomain(domain: string): string {
  const labels = domain.trim().toLowerCase().split(".").filter(Boolean);
  if (labels.length === 0) return "";
  // Tweede-niveau-domeinen als co.uk / com.au tellen niet als hoofdlabel.
  const generic = new Set(["co", "com", "net", "org", "gov", "edu", "ac"]);
  let idx = labels.length - 2;
  if (idx > 0 && generic.has(labels[idx])) idx -= 1;
  const label = labels[Math.max(idx, 0)];
  if (!label) return "";
  return label
    .split("-")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("-");
}

/** Alleen letters+cijfers, lowercase — om namen los van spaties te vergelijken. */
function flatten(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Titels die vóór de naam kunnen staan en er geen deel van zijn. */
const NAME_TITLES = new Set([
  "ing", "ir", "drs", "dr", "mr", "mw", "mevr", "mevrouw", "dhr", "heer",
  "prof", "bc", "msc", "bsc", "bba", "mba", "eur",
]);

/** Nederlandse/Belgische tussenvoegsels — die horen bij de achternaam. */
const NAME_INFIXES = new Set([
  "van", "de", "den", "der", "das", "het", "te", "ten", "ter", "op", "in",
  "aan", "bij", "onder", "over", "uit", "voor", "vd", "'t", "t", "la", "le",
  "du", "des", "di", "da", "von", "zu", "el", "al",
]);

export interface PersonName {
  first: string;
  last?: string;
}

/**
 * Splitst een weergavenaam in voor- en achternaam.
 *
 * De tussenvoegsel-regel is de reden dat dit geen `split(" ")` is: "Piebe van
 * der Storm" moet "Piebe" + "van der Storm" opleveren en niet "Piebe" + "van".
 */
export function splitPersonName(displayName: string): PersonName {
  let raw = displayName.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
  if (!raw) return { first: "" };

  // "Oerlemans, Arno" → "Arno Oerlemans".
  const comma = raw.split(",");
  if (comma.length === 2 && comma[0].trim() && comma[1].trim()) {
    raw = `${comma[1].trim()} ${comma[0].trim()}`;
  }

  let tokens = raw.split(" ").filter(Boolean);
  // Titels aan de kop weghalen ("Ing Vladimír Zima").
  while (tokens.length > 1 && NAME_TITLES.has(tokens[0].toLowerCase().replace(/\./g, ""))) {
    tokens = tokens.slice(1);
  }
  if (tokens.length === 0) return { first: "" };
  if (tokens.length === 1) return { first: tokens[0] };

  // Eerste tussenvoegsel ná het eerste token markeert het begin van de
  // achternaam.
  for (let i = 1; i < tokens.length; i += 1) {
    if (NAME_INFIXES.has(tokens[i].toLowerCase().replace(/\./g, ""))) {
      return { first: tokens.slice(0, i).join(" "), last: tokens.slice(i).join(" ") };
    }
  }
  return { first: tokens[0], last: tokens.slice(1).join(" ") };
}

/** "jan.jansen" → "Jan Jansen"; "info" → "Info". */
export function nameFromLocalPart(email: string): PersonName {
  const local = normalizeEmail(email).split("@")[0] ?? "";
  const cleaned = local.replace(/\d+/g, " ").replace(/[._\-+]+/g, " ").trim();
  if (!cleaned) return { first: "" };
  const parts = cleaned.split(/\s+/).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  if (parts.length === 1) return { first: parts[0] };
  return splitPersonName(parts.join(" "));
}

/* ────────────────────────── Bedrijfsnaam raden ───────────────────────── */

/**
 * Juridische staarten — een regel met zo'n staart ís een bedrijfsnaam.
 *
 * Bewust in drieën, en de losse afkortingen bewust **hoofdlettergevoelig**:
 * `\b(ab|as|ag|cv|sa)\b` case-insensitive aan het eind van een zin vist
 * vrolijk gewone Nederlandse en Engelse woorden op ("… en zo als", "… op de
 * as"). Met een punt erin ("B.V.") of in hoofdletters ("BV") is het signaal
 * eenduidig.
 */
const LEGAL_SUFFIX_DOTTED = /\b(?:b\.\s?v|n\.\s?v|v\.\s?o\.\s?f|c\.\s?v|s\.\s?a|s\.\s?r\.\s?l|u\.\s?a)\.[,]?\s*$/i;
const LEGAL_SUFFIX_ABBREV = /\b(?:BV|NV|VOF|BVBA|VZW|GmbH|mbH|AG|Ltd|Limited|LLC|Inc|PLC|SARL|SRL|ApS|AB|Oy)\b[.,]?\s*$/;
const LEGAL_SUFFIX_WORD = /\b(?:holding|groep|group|maatschap|co[oö]peratie)\b[.,]?\s*$/i;

export function looksLikeCompanyName(value: string): boolean {
  const trimmed = value.trim();
  return LEGAL_SUFFIX_DOTTED.test(trimmed)
    || LEGAL_SUFFIX_ABBREV.test(trimmed)
    || LEGAL_SUFFIX_WORD.test(trimmed);
}

/** Regels die een URL/domein zijn en dus geen bedrijfsnaam. */
function isUrlLine(line: string): boolean {
  return /^(https?:\/\/|www\.)/i.test(line.trim())
    || /^[\w.-]+\.[a-z]{2,6}(\/\S*)?$/i.test(line.trim());
}

function textLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Zet mail-HTML om naar platte regels. `bodyText` mág al plat zijn; dan doet
 * dit vrijwel niets.
 */
export function toPlainText(body: string): string {
  if (!body) return "";
  let text = body;
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  }
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t\u00a0\u200b\u200e\u200f]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

export interface CompanyGuess {
  name: string;
  /** Bron-code voor `reasons`, zonder het `company:`-voorvoegsel. */
  source: "display" | "signature" | "domain";
}

/**
 * Raadt de bedrijfsnaam, in aflopende betrouwbaarheid:
 *
 *   1. de weergavenaam zélf draagt een juridische staart ("Sympraxis B.V.");
 *   2. een handtekeningregel "Voornaam Achternaam - Bedrijf";
 *   3. een korte handtekeningregel die het maildomein bevestigt
 *      ("Van Dorp Infra" bij `@vandorp.eu`) — corroboratie, geen gok;
 *   4. een korte handtekeningregel met een juridische staart;
 *   5. het maildomein zelf, maar nooit bij een publieke mailprovider.
 *
 * Levert niets op → lege naam. De dialoog laat het veld dan leeg staan met de
 * schakelaar "ook als klant vastleggen" uit.
 */
export function guessCompanyName(info: SenderInfo, person: PersonName): CompanyGuess | null {
  const display = (info.displayName ?? "").trim();
  if (display && !display.includes("@") && looksLikeCompanyName(display)) {
    return { name: display, source: "display" };
  }

  const domain = emailDomain(info.email);
  const freemail = isFreemailDomain(domain);
  const domainLabel = flatten(humanizeDomain(domain));
  const lines = textLines(toPlainText(info.bodyText ?? ""));
  // De handtekening staat achteraan; de staart bekijken houdt citaten van
  // eerdere mails buiten beeld.
  const tail = lines.slice(-30);
  const personFlat = flatten([person.first, person.last].filter(Boolean).join(" "));

  // 2. "Piebe van der Storm - Ekster Monument & Renovatie"
  if (personFlat.length >= 4) {
    for (const line of tail) {
      const split = line.split(/\s+[-–|·]\s+/);
      if (split.length < 2) continue;
      if (flatten(split[0]) !== personFlat) continue;
      const candidate = split.slice(1).join(" - ").trim();
      if (candidate.length >= 2 && candidate.length <= 60 && !isUrlLine(candidate)) {
        return { name: candidate, source: "signature" };
      }
    }
  }

  // 3. Korte regel die het domein bevestigt: "Van Dorp Infra" bij vandorp.eu.
  if (!freemail && domainLabel.length >= 4) {
    for (const line of tail) {
      if (line.length > 45 || isUrlLine(line)) continue;
      const flat = flatten(line);
      if (flat === domainLabel) continue; // dat is het domein, niet de naam
      if (!flat.includes(domainLabel)) continue;
      if (flat === personFlat) continue;
      return { name: line.replace(/[.,;:]+$/, "").trim(), source: "signature" };
    }
  }

  // 4. Korte regel met een juridische staart. Minstens twee woorden: een
  //    losse "BV" of "Holding" is geen bedrijfsnaam.
  for (const line of tail) {
    if (line.length > 60 || isUrlLine(line)) continue;
    if (line.split(" ").length < 2) continue;
    if (!looksLikeCompanyName(line)) continue;
    if (flatten(line) === personFlat) continue;
    return { name: line.replace(/[,;:]+$/, "").trim(), source: "signature" };
  }

  // 5. Het domein.
  if (!freemail) {
    const humanized = humanizeDomain(domain);
    if (humanized) return { name: humanized, source: "domain" };
  }
  return null;
}

/* ─────────────────────────── Telefoon zoeken ─────────────────────────── */

/**
 * Internationaal (`+31 6 5742 1249`) of nationaal (`06 130 724 08`,
 * `0643430257`). Bewust alléén deze twee vormen: elk losser patroon vist
 * factuurnummers, huisnummers en jaartallen uit de tekst.
 */
const PHONE_INTL = /\+\d{1,3}(?:[\s.-]?\(0\))?[\s.-]?\d(?:[\d\s.-]{5,16})\d/g;
const PHONE_NL = /\b0\d(?:[\d\s.-]{7,14})\d\b/g;

const PHONE_LABEL_PATTERN = /\b(tel|telefoon|telefoonnummer|phone|mobiel|mobile|mob|gsm|m|t|k)\b\s*[.:]?\s*$/i;

/** Datums zijn de klassieke vals-positief: "01-09-2026", "1 9 2026". */
const DATE_LIKE = /^\s*[0-3]?\d[\s./-][0-1]?\d[\s./-](?:19|20)\d{2}\s*$/;

function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

function isPlausiblePhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (DATE_LIKE.test(trimmed)) return false;
  const digits = digitsOf(trimmed);
  if (digits.length < 9 || digits.length > 15) return false;
  // "00000000000" en oplopende reeksen zijn geen nummers.
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

/** Nette weergave: spaties/haakjes weg, `+` blijft staan. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+");
  const digits = digitsOf(trimmed);
  return plus ? `+${digits}` : digits;
}

export interface PhoneGuess {
  phone: string;
  source: "labeled" | "signature";
}

/**
 * Zoekt een telefoonnummer in de mailtekst. Een regel met een label
 * ("Tel: …", "M 06-…") wint; anders het láátste plausibele nummer, want dat
 * staat in de handtekening en niet in een geciteerde eerdere mail.
 */
export function extractPhone(bodyText: string): PhoneGuess | null {
  const text = toPlainText(bodyText ?? "");
  if (!text) return null;

  const candidates: { value: string; index: number; labeled: boolean }[] = [];
  for (const pattern of [PHONE_INTL, PHONE_NL]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[0];
      if (!isPlausiblePhone(value)) continue;
      const before = text.slice(Math.max(0, match.index - 24), match.index);
      const labeled = PHONE_LABEL_PATTERN.test(before);
      // Bank-/btw-/kvk-context uitsluiten: dat zijn óók lange cijferreeksen,
      // en een IBAN valt zonder deze check als "0123 4567 89" in het net.
      // Staat er een telefoonlabel vlak vóór (handtekeningregel "KvK … · Tel
      // …"), dan wint dat label — dan is het aantoonbaar wél een nummer.
      if (!labeled && /\b(iban|bic|kvk|btw|vat|postbus|factuur|order|rekening)\b/i.test(before)) continue;
      candidates.push({ value, index: match.index, labeled });
    }
  }
  if (candidates.length === 0) return null;

  const labeled = candidates.filter((c) => c.labeled);
  const pick = labeled.length > 0
    ? labeled[labeled.length - 1]
    : candidates.reduce((best, c) => (c.index > best.index ? c : best), candidates[0]);
  return { phone: normalizePhone(pick.value), source: pick.labeled ? "labeled" : "signature" };
}

/* ─────────────────────────── parseSenderDetails ──────────────────────── */

/**
 * Maakt uit een afzender een concept-relatie. Puur: geen netwerk, geen
 * localStorage, geen `Date.now()` — alles wat hier uitkomt volgt uit de
 * meegegeven tekst, zodat de tests echte afzenders kunnen naspelen.
 */
export function parseSenderDetails(info: SenderInfo): RelationDraft {
  const email = normalizeEmail(info.email);
  const reasons: string[] = [];

  const display = (info.displayName ?? "").trim();
  const displayIsEmail = display.includes("@") || flatten(display) === flatten(email);
  const noReply = isNoReplyAddress(email);
  const role = isRoleAddress(email);

  let person: PersonName = { first: "" };
  // Achter een no-reply-adres zit niemand. De weergavenaam is dan de naam van
  // een systeem ("Instagram"), en een contactpersoon met die naam vervuilt de
  // suggestielijst voor altijd. Alles blijft leeg; wil de gebruiker er tóch
  // iets van maken, dan typt hij het bewust zelf.
  if (!noReply && display && !displayIsEmail && !looksLikeCompanyName(display)) {
    person = splitPersonName(display);
    if (person.first) reasons.push("name:display");
  }
  if (!person.first && !noReply) {
    // Geen bruikbare weergavenaam: het mailboxdeel is het enige dat er
    // *staat*. Bij een functiemailbox is dat geen persoon — dat zegt de code
    // er expliciet bij zodat de dialoog het als "controleer dit" toont.
    person = nameFromLocalPart(email);
    if (person.first) reasons.push(role ? "name:mailbox" : "name:localpart");
  }

  const company = noReply ? null : guessCompanyName({ ...info, email }, person);
  if (company) reasons.push(`company:${company.source}`);

  const phoneGuess = info.bodyText ? extractPhone(info.bodyText) : null;
  if (phoneGuess) reasons.push(`phone:${phoneGuess.source}`);

  if (noReply) reasons.push("address:noreply");
  else if (role) reasons.push("address:role");

  const draft: RelationDraft = {
    customerName: company?.name ?? "",
    // Een bedrijfsnaam uit een handtekening/domein hoort bij een organisatie;
    // zonder bedrijfsnaam is de relatie hooguit een particulier.
    customerType: company ? "Company" : "Individual",
    contactFirstName: person.first,
    email,
    // Zonder bedrijfsnaam niets aanzetten: een relatie aanmaken die "Piebe"
    // heet is bijna nooit wat de gebruiker bedoelde, en de schakelaar staat
    // klaar als het wél zo is.
    createCustomer: Boolean(company) && !noReply,
    reasons,
  };
  if (person.last) draft.contactLastName = person.last;
  if (phoneGuess) draft.phone = phoneGuess.phone;
  // Geen bedrijf gevonden? Dan is de persoonsnaam de enige zinnige voorzet
  // voor het moment dat de gebruiker de schakelaar tóch aanzet.
  if (!draft.customerName && person.first) {
    draft.customerName = [person.first, person.last].filter(Boolean).join(" ");
  }
  return draft;
}

/* ──────────────────────────── Payload-bouw ───────────────────────────── */

/**
 * Ontbrekende verplichte velden, als veldcodes. Leeg = klaar om te schrijven.
 * Zelfde contract als `validatePurchaseInvoiceInput`.
 */
export function validateRelationDraft(draft: RelationDraft): string[] {
  const missing: string[] = [];
  if (!draft.contactFirstName.trim()) missing.push("contactFirstName");
  if (!draft.email.trim() || !isValidEmail(draft.email)) missing.push("email");
  if (draft.createCustomer && !draft.customerName.trim()) missing.push("customerName");
  return missing;
}

export function buildCustomerPayload(draft: RelationDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    customer_name: draft.customerName.trim(),
    customer_type: draft.customerType,
  };
  // Alleen meesturen als er echt iets gekozen is: een Link-veld met een
  // waarde die op deze instance niet bestaat laat het aanmaken klappen, en
  // ERPNext vult zelf zijn eigen default als het veld ontbreekt.
  if (draft.customerGroup?.trim()) payload.customer_group = draft.customerGroup.trim();
  if (draft.territory?.trim()) payload.territory = draft.territory.trim();
  return payload;
}

export function buildContactPayload(
  draft: RelationDraft,
  customer?: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    first_name: draft.contactFirstName.trim(),
    // `email_ids` is de bron; `Contact.email_id` wordt daar server-side uit
    // afgeleid zodra er een rij met `is_primary` staat. Zelf `email_id`
    // zetten zou naast de child-tabel gaan staan en bij de eerstvolgende
    // save weer overschreven worden.
    email_ids: [{ email_id: normalizeEmail(draft.email), is_primary: 1 }],
  };
  if (draft.contactLastName?.trim()) payload.last_name = draft.contactLastName.trim();
  if (draft.phone?.trim()) {
    payload.phone_nos = [{ phone: draft.phone.trim(), is_primary_phone: 1 }];
  }
  if (customer) {
    payload.company_name = customer;
    payload.links = [{ link_doctype: "Customer", link_name: customer }];
  }
  return payload;
}

/* ─────────────────────────── Bestaand of nieuw ───────────────────────── */

interface ContactLinkRow {
  name: string;
  email_id?: string;
  link_doctype?: string | null;
  link_name?: string | null;
}

interface NamedRow {
  name: string;
}

const CONTACT_LINK_FIELDS = [
  "name",
  "email_id",
  "`tabDynamic Link`.link_doctype",
  "`tabDynamic Link`.link_name",
];

/**
 * Is dit adres al bekend? Kijkt naar vier plekken, omdat het adres op elk
 * daarvan kan staan zonder op de andere te staan:
 *
 *   - `Contact.email_id`      — het primaire adres van een contactpersoon;
 *   - `Contact Email`-child   — een tweede/derde adres van diezelfde persoon;
 *   - `Customer.email_id`     — een relatie zonder contactpersoon;
 *   - `Lead.email_id`         — er loopt al een lead op dit adres.
 *
 * Faalt een deelquery (rechten verschillen per rol), dan telt die simpelweg
 * niet mee: een onvolledige dubbelcheck is beter dan een knop die niets doet.
 * Het echte vangnet blijft ERPNext zelf bij het aanmaken.
 */
export async function lookupExisting(email: string): Promise<ExistingRelation> {
  const address = normalizeEmail(email);
  if (!isValidEmail(address)) return {};

  const settled = await Promise.allSettled([
    fetchList<ContactLinkRow>("Contact", {
      fields: CONTACT_LINK_FIELDS,
      filters: [["email_id", "=", address]],
      limit_page_length: 20,
    }),
    fetchList<ContactLinkRow>("Contact", {
      fields: CONTACT_LINK_FIELDS,
      filters: [["Contact Email", "email_id", "=", address]],
      limit_page_length: 20,
    }),
    fetchList<NamedRow>("Customer", {
      fields: ["name"],
      filters: [["email_id", "=", address]],
      limit_page_length: 5,
    }),
    fetchList<NamedRow>("Lead", {
      fields: ["name"],
      filters: [["email_id", "=", address]],
      limit_page_length: 5,
    }),
  ]);

  const rows = (index: 0 | 1): ContactLinkRow[] =>
    settled[index].status === "fulfilled" ? (settled[index].value as ContactLinkRow[]) : [];
  const named = (index: 2 | 3): NamedRow[] =>
    settled[index].status === "fulfilled" ? (settled[index].value as NamedRow[]) : [];

  const contactRows = [...rows(0), ...rows(1)];
  const result: ExistingRelation = {};
  if (contactRows.length > 0) {
    result.contact = contactRows[0].name;
    const linked = contactRows.find(
      (r) => r.link_doctype === "Customer" && typeof r.link_name === "string" && r.link_name
    );
    if (linked?.link_name) result.customer = linked.link_name;
  }
  if (!result.customer) {
    const customer = named(2)[0]?.name;
    if (customer) result.customer = customer;
  }
  const lead = named(3)[0]?.name;
  if (lead) result.lead = lead;
  return result;
}

/** Bestaat er al een relatie met exact deze naam? Dan die hergebruiken. */
async function findCustomerByName(customerName: string): Promise<string | null> {
  const name = customerName.trim();
  if (!name) return null;
  const rows = await fetchList<NamedRow>("Customer", {
    fields: ["name"],
    filters: [["customer_name", "=", name]],
    limit_page_length: 1,
  });
  return rows[0]?.name ?? null;
}

/**
 * Legt de relatie en/of de contactpersoon vast.
 *
 * Idempotent-ish, in twee stappen:
 *
 *   1. Is het adres al bekend, dan wordt dát teruggegeven (`reused: true`) en
 *      wordt er niets aangemaakt. Twee keer op de knop drukken maakt dus geen
 *      tweede contactpersoon.
 *   2. Bestaat er al een relatie met exact dezelfde naam, dan wordt die
 *      hergebruikt in plaats van dat ERPNext er een "Naam - 1" naast zet.
 *
 * De Customer gaat eerst, want de Contact verwijst ernaar via de
 * `links`-child. Klapt de Contact ná een net aangemaakte Customer, dan blijft
 * die Customer staan — de fout die de gebruiker ziet zegt wat er wél gelukt
 * is via `RelationResult`/de foutmelding.
 */
export async function createRelation(draft: RelationDraft): Promise<RelationResult> {
  const missing = validateRelationDraft(draft);
  if (missing.length > 0) {
    throw new Error(`Onvolledige relatie: ${missing.join(", ")}`);
  }

  const existing = await lookupExisting(draft.email);
  if (existing.contact) {
    const result: RelationResult = { contact: existing.contact, reused: true };
    if (existing.customer) result.customer = existing.customer;
    return result;
  }

  let customer: string | undefined;
  if (draft.createCustomer) {
    customer = existing.customer ?? (await findCustomerByName(draft.customerName)) ?? undefined;
    if (!customer) {
      const created = await createDocument<NamedRow>("Customer", buildCustomerPayload(draft));
      customer = created.name;
    }
  } else if (existing.customer) {
    // Niet aanmaken, maar de contactpersoon mag er wél aan hangen.
    customer = existing.customer;
  }

  const contact = await createDocument<NamedRow>("Contact", buildContactPayload(draft, customer));
  const result: RelationResult = { contact: contact.name, reused: false };
  if (customer) result.customer = customer;
  return result;
}

/* ───────────────────────── Standaardwaarden ──────────────────────────── */

let defaultsCache: { at: number; value: RelationDefaults } | null = null;
const DEFAULTS_TTL_MS = 10 * 60_000;

interface GroupRow {
  name: string;
  is_group?: number;
}

interface CustomerDefaultsRow {
  customer_group?: string;
  territory?: string;
}

/** Meest voorkomende waarde in een lijst, of "" bij een lege lijst. */
function mode(values: (string | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value?.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) { best = key; bestCount = count; }
  }
  return best;
}

/**
 * Keuzelijsten + standaardwaarden voor klantgroep en regio.
 *
 * De standaard komt uit `Selling Settings` als de instance die heeft; op de
 * doelinstance staan die velden leeg. Dan wordt de **meest gebruikte** waarde
 * bij de bestaande relaties genomen (daar: "Commercial" + "Netherlands").
 * Bewust niet hardcoded: op een andere instance heten die groepen anders, en
 * een niet-bestaande Link-waarde laat het aanmaken klappen.
 */
export async function fetchRelationDefaults(force = false): Promise<RelationDefaults> {
  if (!force && defaultsCache && Date.now() - defaultsCache.at < DEFAULTS_TTL_MS) {
    return defaultsCache.value;
  }

  const [groupsRes, territoriesRes, settingsRes, recentRes] = await Promise.allSettled([
    fetchList<GroupRow>("Customer Group", {
      fields: ["name", "is_group"],
      limit_page_length: 0,
      order_by: "name asc",
    }),
    fetchList<GroupRow>("Territory", {
      fields: ["name", "is_group"],
      limit_page_length: 0,
      order_by: "name asc",
    }),
    fetchDocument<CustomerDefaultsRow>("Selling Settings", "Selling Settings"),
    fetchList<CustomerDefaultsRow>("Customer", {
      fields: ["customer_group", "territory"],
      limit_page_length: 100,
      order_by: "modified desc",
    }),
  ]);

  const leaves = (res: PromiseSettledResult<GroupRow[]>): string[] =>
    res.status === "fulfilled"
      ? res.value.filter((r) => Number(r.is_group ?? 0) === 0).map((r) => r.name)
      : [];

  const customerGroups = leaves(groupsRes);
  const territories = leaves(territoriesRes);
  const settings = settingsRes.status === "fulfilled" ? settingsRes.value : {};
  const recent = recentRes.status === "fulfilled" ? recentRes.value : [];

  const pick = (fromSettings: string | undefined, values: (string | undefined)[], options: string[]): string => {
    const candidate = fromSettings?.trim() || mode(values);
    if (candidate && (options.length === 0 || options.includes(candidate))) return candidate;
    return options[0] ?? "";
  };

  const value: RelationDefaults = {
    customerGroups,
    territories,
    defaultCustomerGroup: pick(settings.customer_group, recent.map((r) => r.customer_group), customerGroups),
    defaultTerritory: pick(settings.territory, recent.map((r) => r.territory), territories),
  };
  defaultsCache = { at: Date.now(), value };
  return value;
}

/** Test-only / na een instance-wissel: vergeet de gecachte standaardwaarden. */
export function resetRelationDefaultsCache(): void {
  defaultsCache = null;
}

/* ──────────────────────────── Foutclassificatie ──────────────────────── */

export type RelationErrorKind =
  | "permission"
  | "duplicate"
  | "link-missing"
  | "mandatory"
  | "generic";

/**
 * Vertaalt een ERPNext-fout naar iets waar de dialoog een leesbare zin bij
 * heeft. `permission` gaat expliciet vóór de rest: een ontbrekend DocPerm is
 * een oplosbaar, structureel probleem en mag niet als "er ging iets mis"
 * verdwijnen (zie `permission-error.ts`).
 */
export function classifyRelationError(err: unknown): RelationErrorKind {
  if (isPermissionError(err)) return "permission";
  const message = typeof (err as { message?: unknown })?.message === "string"
    ? (err as { message: string }).message
    : "";
  if (/duplicate|already exists|bestaat al/i.test(message)) return "duplicate";
  if (/could not find|not found|ongeldige link|invalid link/i.test(message)) return "link-missing";
  if (/mandatory|verplicht|required/i.test(message)) return "mandatory";
  return "generic";
}

/* ────────────────────────────── Deeplinks ────────────────────────────── */

/** Directe link naar het document in ERPNext (nieuw tabblad in de dialoog). */
export function relationDocUrl(doctype: "Customer" | "Contact", name: string): string {
  const slug = doctype.toLowerCase().replace(/\s+/g, "-");
  return `${getErpNextLinkUrl()}/${slug}/${encodeURIComponent(name)}`;
}
