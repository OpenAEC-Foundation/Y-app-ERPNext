/**
 * Herkent of een binnengekomen e-mail een **inkoopfactuur** is, en trekt er
 * alvast de velden uit die de boekingsdialoog nodig heeft (leverancier,
 * factuurnummer, factuurdatum, bedrag).
 *
 * Bewust een **pure** module: geen React, geen netwerk, geen ERPNext-import.
 * Alles wat de herkenning nodig heeft komt binnen via `InvoiceSignals` en
 * `SupplierHint[]`, zodat dit met `node --test` te testen is tegen echte
 * onderwerpen uit de instance zonder een browser of sessie op te tuigen.
 *
 * Drie ontwerpkeuzes die niet vanzelfsprekend zijn:
 *
 * 1. **Geen enkel signaal beslist alleen.** Afzenderdomein, factuurwoord,
 *    PDF-bijlage, leveranciersnaam, factuurnummer en bedrag tellen samen op.
 *    Dat is nodig omdat de praktijk op deze instance rommelig is: facturen
 *    worden dóórgestuurd vanaf een privé-adres (`maarten@3bm.co.nl` stuurt
 *    facturen van vier verschillende leveranciers), en een gratis-mailadres
 *    (`gmail.com`) zegt niets over een leverancier. Eén hard signaal zou dus
 *    of te veel of te weinig herkennen.
 *
 * 2. **Nooit invullen wat niet gevonden is.** Ontbreekt het factuurnummer in
 *    onderwerp, bijlagenaam én body, dan blijft `invoiceNo` leeg en vult de
 *    gebruiker het zelf in. Een verzonnen nummer is erger dan een leeg veld:
 *    het wordt zonder nadenken bevestigd. De enige uitzondering is de datum,
 *    die expliciet op de maildatum terugvalt — en dat zegt `reasons` er dan
 *    ook bij (`date:mail`).
 *
 * 3. **`reasons` bevat codes, geen zinnen.** De UI vertaalt ze (i18n); dat
 *    houdt deze module vrij van taal en de tests vrij van vertaalbestanden.
 *    Codes hebben de vorm `<categorie>:<bron>`, bv. `supplier:contact-email`
 *    of `amount:body-net`.
 *
 * De negatieve kant is net zo belangrijk als de positieve. Een dóórgestuurde
 * *eigen verkoopfactuur* ("FW: Factuur ACC-SINV-2026-00012 - OpenAEC Studio
 * BV") heeft een factuurwoord, een factuurnummer én een bedrag, en zou zonder
 * tegensignaal met hoge zekerheid als inkoopfactuur worden aangeboden. De
 * verkoopfactuur-reeks in het onderwerp zet de uitkomst daarom hard op
 * `isLikely: false`.
 */

/* ─────────────────────────── Publieke vormen ─────────────────────────── */

/**
 * Eén leverancier zoals de herkenning hem kent. `emails` bevat zowel
 * `Supplier.email_id` als de adressen van de gekoppelde Contacts — zie
 * `fetchSupplierHints` in `purchase-invoice.ts` voor hoe die verzameld worden.
 */
export interface SupplierHint {
  /** Supplier-docname; dit is wat in de Purchase Invoice terechtkomt. */
  name: string;
  /** `supplier_name`, als die afwijkt van de docname. */
  supplierName?: string;
  /** Bekende e-mailadressen van deze leverancier (leverancier + contacten). */
  emails?: string[];
}

export interface InvoiceSignals {
  subject: string;
  /** Bare e-mailadres van de afzender (zonder weergavenaam). */
  sender: string;
  /** Bijlagenamen. Leeg in de lijstweergave — zie `hasAttachment`. */
  attachmentNames: string[];
  /** Platte tekst van de mailbody. Ontbreekt zolang de mail niet open is. */
  bodyText?: string;
  /**
   * De lijstweergave kent alleen `Communication.has_attachment` en niet de
   * namen. Zonder dit veld zou elke rij in de lijst als "geen bijlage"
   * scoren en zou het labeltje pas ná het openen verschijnen — precies waar
   * het níét meer nodig is.
   */
  hasAttachment?: boolean;
  /** Datum van de mail (ISO of ERPNext-datetime); fallback voor `invoiceDate`. */
  mailDate?: string;
  /**
   * Verzonden mail is per definitie geen binnengekomen inkoopfactuur. De
   * Verzonden-map en de Prullenbak geven dit mee zodat het labeltje daar niet
   * opduikt.
   */
  direction?: "received" | "sent";
}

export type InvoiceConfidence = "high" | "medium" | "low";

export interface InvoiceGuess {
  isLikely: boolean;
  confidence: InvoiceConfidence;
  /** Supplier-docname van de best passende leverancier. */
  supplier?: string;
  invoiceNo?: string;
  /** ISO `yyyy-mm-dd`. */
  invoiceDate?: string;
  /** Bedrag van de factuurregel; netto waar dat te bepalen viel. */
  amount?: number;
  /** `true` wanneer `amount` aantoonbaar een bedrag *inclusief* btw is. */
  amountIsGross?: boolean;
  /** Stabiele codes van wat is herkend; de UI vertaalt ze. */
  reasons: string[];
}

/* ──────────────────────────── Woordenlijsten ─────────────────────────── */

/**
 * Woorden die een factuur aankondigen. `\brekening\b` matcht bewust niet in
 * "rekeningnummer" — dat staat in élke factuurbody én in elke betaalherinnering
 * van de bank, en zou het woord waardeloos maken.
 */
const INVOICE_WORDS =
  /\b(factuur|facturen|faktuur|factuurnr|factuurnummer|invoice|invoices|nota|rekening|betaalverzoek|aanmaning|betalingsherinnering|bill)\b/i;

/**
 * Reclame en abonnementenpost. Zulke mail draagt vaak een factuurwoord ("uw
 * factuur staat klaar") zonder dat er iets te boeken valt.
 */
const NEWSLETTER_WORDS =
  /\b(nieuwsbrief|newsletter|uitschrijven|unsubscribe|afmelden|webinar|vacature|kortingscode|black\s*friday)\b/i;

/**
 * Naamgevingsreeksen van *verkoop*facturen. Staat zo'n code in het onderwerp,
 * dan kijk je naar je eigen uitgaande factuur — al dan niet doorgestuurd door
 * de klant. Dat is nooit een inkoopfactuur.
 */
const SALES_INVOICE_SERIES = /\b(acc-sinv|sinv-|sal-inv|verkoopfactuur|sales\s+invoice)\b/i;

/** Documenten die op een factuur lijken maar het niet zijn. */
const NON_INVOICE_DOCS = /\b(offerte|quotation|aanbieding|pakbon|packing\s*slip|delivery\s*note|bon\s*van\s*ontvangst)\b/i;

/**
 * Achtervoegsels die een bedrijfsnaam juridisch afsluiten. Na normalisatie
 * ("B.V." → "b v", "V.O.F." → "v o f") staan die als losse letters aan het
 * eind, dus ze worden van achteren af weggesnoeid — nooit uit het midden,
 * want dan zou "SA Bouw" tot "Bouw" verschrompelen.
 */
const NAME_SUFFIX_TOKENS = new Set([
  "b", "v", "f", "o", "c", "n",
  "bv", "bvba", "vof", "nv", "cv", "cvba",
  "ltd", "limited", "llc", "inc", "gmbh", "ag", "sa", "sarl", "plc", "srl",
]);

/**
 * Gratis-mailproviders. Een leverancier "matchen" op `gmail.com` zou elke
 * particuliere afzender aan de eerste de beste leverancier met een
 * gmail-contact hangen — precies wat er zou gebeuren met Moso Engineering,
 * dat op deze instance een gmail-adres als contactadres heeft.
 */
const FREEMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.nl", "hotmail.com",
  "hotmail.nl", "live.nl", "live.com", "yahoo.com", "yahoo.co.uk", "icloud.com",
  "me.com", "mac.com", "gmx.net", "gmx.com", "gmx.de", "protonmail.com",
  "proton.me", "msn.com", "ziggo.nl", "kpnmail.nl", "telfort.nl", "home.nl",
  "planet.nl", "xs4all.nl", "casema.nl", "chello.nl", "upcmail.nl", "hetnet.nl",
  "zonnet.nl", "quicknet.nl", "online.nl",
]);

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2,
  mrt: 3, maart: 3, mar: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  aug: 8, augustus: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/* ───────────────────────────── Normalisatie ──────────────────────────── */

/** Alles naar kleine letters, zonder accenten, met enkele spaties als scheiding. */
export function normalizeText(value: string): string {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Bedrijfsnaam zonder juridische staart, zodat "Castellum Rosarum BV" (de
 * Supplier) en "Castellum Rosarum B.V." (het onderwerp) op elkaar uitkomen.
 */
export function normalizeCompanyName(value: string): string {
  const tokens = normalizeText(value).split(" ").filter(Boolean);
  while (tokens.length > 1 && NAME_SUFFIX_TOKENS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

function emailDomain(address: string): string {
  const at = (address || "").lastIndexOf("@");
  return at === -1 ? "" : address.slice(at + 1).trim().toLowerCase();
}

/** `mail.3bm.co.nl` en `3bm.co.nl` horen bij elkaar; `3bm.nl` niet. */
function domainsRelated(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function fileStem(fileName: string): string {
  const base = (fileName || "").split(/[\\/]/).pop() || "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

function fileExt(fileName: string): string {
  const base = (fileName || "").split(/[\\/]/).pop() || "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/**
 * Platte tekst uit een mailbody-HTML, geschikt als `bodyText`.
 *
 * `<style>`- en `<script>`-blokken gaan er eerst uit: Outlook plakt een blok
 * VML-CSS bovenaan elke mail, en dat zou anders als "tekst" meetellen en
 * bijvoorbeeld getallen uit `mso-` regels als bedrag aanbieden. Entities
 * worden voor de vier gevallen vertaald die er hier toe doen — `&nbsp;` is de
 * belangrijkste, want ERPNext' eigen factuurmail scheidt duizendtallen
 * daarmee ("€ 2&nbsp;417.58").
 */
export function plainTextFromHtml(html: string): string {
  return (html || "")
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t\u00a0\u202f]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n")
    .trim();
}

/* ─────────────────────────── Factuurnummer ───────────────────────────── */

/**
 * Herkent een factuurnummer aan zijn vorm. Deze instance kent er vier
 * varianten (`263-05192`, `26CRB-00007`, `2026-026709`, `20260430-1`), dus
 * een enkel regexje volstaat niet — het criterium is "genoeg cijfers, geen
 * datum, geen bedrag, geen jaartal".
 */
export function looksLikeInvoiceNumber(raw: string): boolean {
  const token = (raw || "").replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9]+$/, "");
  if (token.length < 4 || token.length > 32) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(token)) return false;
  const digits = (token.match(/\d/g) || []).length;
  if (digits < 4) return false;
  // Een kaal jaartal is geen factuurnummer.
  if (/^(19|20)\d{2}$/.test(token)) return false;
  // Datums in de gangbare schrijfwijzen.
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(token)) return false;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(token)) return false;
  // Bedragen ("2417.58", "1.234,56").
  if (/^\d{1,3}([.,]\d{3})*[.,]\d{2}$/.test(token)) return false;
  if (/^\d+[.,]\d{2}$/.test(token)) return false;
  // Minstens één aaneengesloten reeks van 3 cijfers; "a1b2c3" is ruis.
  if (!/\d{3}/.test(token)) return false;
  return true;
}

const LABELLED_INVOICE_NO =
  /(?:factuurnummer|factuurnr\.?|factuur\s*nr\.?|factuur\s*nummer|invoice\s*(?:number|no\.?|nr\.?|#)|invoice)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,31})/i;

function findInvoiceNo(signals: InvoiceSignals): { value: string; reason: string } | null {
  const body = signals.bodyText || "";
  const labelled = body.match(LABELLED_INVOICE_NO) || signals.subject.match(LABELLED_INVOICE_NO);
  if (labelled && looksLikeInvoiceNumber(labelled[1])) {
    return { value: cleanToken(labelled[1]), reason: "invoice-no:labelled" };
  }
  // De bestandsnaam van een factuur-PDF ís vaak precies het factuurnummer.
  for (const fileName of signals.attachmentNames) {
    if (fileExt(fileName) !== "pdf") continue;
    const stem = fileStem(fileName);
    if (looksLikeInvoiceNumber(stem)) return { value: cleanToken(stem), reason: "invoice-no:attachment" };
  }
  // Laatste kandidaat uit het onderwerp: daar staat het nummer achteraan
  // ("Factuur 3BM Bouwtechniek V.O.F. 263-05192").
  const subjectTokens = signals.subject.split(/\s+/).filter(looksLikeInvoiceNumber);
  if (subjectTokens.length > 0) {
    return { value: cleanToken(subjectTokens[subjectTokens.length - 1]), reason: "invoice-no:subject" };
  }
  return null;
}

function cleanToken(raw: string): string {
  return raw.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9]+$/, "");
}

/* ──────────────────────────────── Bedrag ─────────────────────────────── */

/**
 * Zet een geschreven bedrag om naar een getal. Werkt voor de drie vormen die
 * in deze mailbox voorkomen: `2 417.58` (spatie als duizendtal, punt als
 * decimaal — zo genereert ERPNext zijn eigen factuurmails), `1.234,56`
 * (Nederlands) en `15928.50`.
 */
export function parseAmount(raw: string): number | undefined {
  const cleaned = (raw || "").replace(/[\s\u00a0\u202f\u2009\u0027]/g, "");
  if (!/^\d[\d.,]*$/.test(cleaned)) return undefined;
  const sep = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
  let value: number;
  if (sep === -1) {
    value = Number(cleaned);
  } else {
    const decimals = cleaned.length - sep - 1;
    if (decimals === 1 || decimals === 2) {
      value = Number(`${cleaned.slice(0, sep).replace(/[.,]/g, "")}.${cleaned.slice(sep + 1)}`);
    } else {
      // Drie of meer cijfers achter het laatste scheidingsteken: dan is het
      // een duizendtalscheiding, geen komma ("1.234" = 1234).
      value = Number(cleaned.replace(/[.,]/g, ""));
    }
  }
  if (!Number.isFinite(value) || value <= 0 || value > 1e9) return undefined;
  return Math.round(value * 100) / 100;
}

const AMOUNT_RE = /(?:€|EUR\b)\s*([\d][\d.,\s\u00a0\u202f]*[\d])|([\d][\d.,\s\u00a0\u202f]*[\d])\s*(?:€|EUR\b)/gi;
const GROSS_RE = /\b(incl|inclusief|including|bruto|met\s+btw)\b/i;
const NET_RE = /\b(excl|exclusief|excluding|netto|ex\.?\s*btw|zonder\s+btw|subtotaal|subtotal)\b/i;

/**
 * Afstand tot het dichtstbijzijnde btw-label rondom een bedrag, of
 * `Infinity`. Bewust op *afstand* en niet op "komt voor in het venster":
 * in "€ 2 417.58 (inclusief BTW). € 1 991.25 (excl. BTW)" staan beide labels
 * binnen 40 tekens ná het eerste bedrag. Wie alleen kijkt óf een label
 * voorkomt, plakt "excl." aan het brutobedrag en boekt de btw mee.
 */
function labelDistance(before: string, after: string, pattern: RegExp): number {
  const ahead = after.match(pattern);
  const behind = before.match(new RegExp(pattern.source, `${pattern.flags}g`));
  let best = Infinity;
  if (ahead?.index !== undefined) best = ahead.index;
  if (behind && behind.length > 0) {
    const last = before.lastIndexOf(behind[behind.length - 1]);
    if (last !== -1) best = Math.min(best, before.length - last);
  }
  return best;
}

function findAmount(text: string): { value: number; isGross?: boolean; reason: string } | null {
  if (!text) return null;
  let net: number | undefined;
  let gross: number | undefined;
  let plain: number | undefined;
  AMOUNT_RE.lastIndex = 0;
  for (let m = AMOUNT_RE.exec(text); m !== null; m = AMOUNT_RE.exec(text)) {
    const value = parseAmount(m[1] ?? m[2] ?? "");
    if (value === undefined) continue;
    // Het label staat in de praktijk vlák achter het bedrag ("€ 1 991.25
    // (excl. BTW)"), soms er net voor ("exclusief btw: € 1 991.25").
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40);
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    const netAt = labelDistance(before, after, NET_RE);
    const grossAt = labelDistance(before, after, GROSS_RE);
    if (netAt < grossAt) net ??= value;
    else if (grossAt < netAt) gross ??= value;
    else plain ??= value;
  }
  if (net !== undefined) return { value: net, isGross: false, reason: "amount:net" };
  if (plain !== undefined) return { value: plain, reason: "amount:plain" };
  if (gross !== undefined) return { value: gross, isGross: true, reason: "amount:gross" };
  return null;
}

/* ───────────────────────────────── Datum ─────────────────────────────── */

/** Zet één geschreven datum om naar `yyyy-mm-dd`, of `undefined`. */
export function parseDateish(raw: string): string | undefined {
  const text = (raw || "").trim();
  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (dmy) {
    const year = Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return toIso(year, Number(dmy[2]), Number(dmy[1]));
  }
  const named = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,10})\.?\s+(\d{4})\b/);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month) return toIso(Number(named[3]), month, Number(named[1]));
  }
  return undefined;
}

function toIso(year: number, month: number, day: number): string | undefined {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const LABELLED_DATE =
  /(?:factuurdatum|factuur\s*datum|datum\s*factuur|invoice\s*date|date\s*of\s*invoice|dated)\s*[:#]?\s*([^\n<;,]{6,32})/i;

function findInvoiceDate(signals: InvoiceSignals): { value: string; reason: string } | null {
  const haystacks = [signals.bodyText || "", signals.subject];
  for (const hay of haystacks) {
    const labelled = hay.match(LABELLED_DATE);
    if (!labelled) continue;
    const parsed = parseDateish(labelled[1]);
    if (parsed) return { value: parsed, reason: "date:labelled" };
  }
  // Bewust GEEN losse datum uit de body: die is daar bijna altijd de
  // vervaldatum ("dit voor 2026-07-01 te voldoen"). Liever de maildatum, die
  // klopt vaker en waarvan de gebruiker wéét dat het een aanname is.
  const mail = signals.mailDate ? parseDateish(signals.mailDate) : undefined;
  if (mail) return { value: mail, reason: "date:mail" };
  return null;
}

/* ──────────────────────────── Leverancier ────────────────────────────── */

interface SupplierMatch {
  supplier: string;
  score: number;
  reason: string;
}

function matchSupplier(signals: InvoiceSignals, suppliers: SupplierHint[]): SupplierMatch | null {
  const sender = (signals.sender || "").trim().toLowerCase();
  const senderDomain = emailDomain(sender);
  const senderDomainUsable = Boolean(senderDomain) && !FREEMAIL_DOMAINS.has(senderDomain);
  const subjectHay = ` ${normalizeText(signals.subject)} `;
  const attachHay = ` ${normalizeText(signals.attachmentNames.join(" "))} `;
  const bodyHay = signals.bodyText ? ` ${normalizeText(signals.bodyText.slice(0, 4000))} ` : "";
  const domainWords = senderDomainUsable ? normalizeText(senderDomain).split(" ").filter(Boolean) : [];

  let best: SupplierMatch | null = null;
  const consider = (candidate: SupplierMatch) => {
    if (!best || candidate.score > best.score) best = candidate;
  };

  for (const hint of suppliers) {
    const label = hint.supplierName || hint.name;
    const needle = normalizeCompanyName(label);
    const emails = (hint.emails || []).map((e) => e.trim().toLowerCase()).filter(Boolean);

    // 1. Exact afzenderadres. Werkt óók bij een gratis-mailadres, want dit is
    //    een gerichte treffer en geen domeingok.
    if (sender && emails.includes(sender)) {
      consider({ supplier: hint.name, score: 100, reason: "supplier:contact-email" });
      continue;
    }
    // 2. Afzenderdomein tegen een bekend leveranciersdomein.
    if (senderDomainUsable && emails.some((e) => domainsRelated(senderDomain, emailDomain(e)))) {
      consider({ supplier: hint.name, score: 85, reason: "supplier:domain" });
      continue;
    }
    if (needle.length < 4) continue;
    // 3. Naam in het onderwerp — op deze instance het sterkste signaal, omdat
    //    facturen vanaf een privé-adres worden doorgestuurd.
    if (subjectHay.includes(` ${needle} `)) {
      consider({ supplier: hint.name, score: 70 + needle.length, reason: "supplier:subject" });
      continue;
    }
    // 4. Naam in het afzenderdomein ("info@drukwerkdeal.nl").
    if (domainWords.length > 0 && needle.split(" ").every((w) => domainWords.includes(w))) {
      consider({ supplier: hint.name, score: 65, reason: "supplier:sender-domain" });
      continue;
    }
    if (attachHay.includes(` ${needle} `)) {
      consider({ supplier: hint.name, score: 55, reason: "supplier:attachment" });
      continue;
    }
    // 5. Naam ergens in de mailtekst. Zwak en met opzet als laatste: élke mail
    //    van een afzender draagt diens bedrijfsnaam in de handtekening, dus
    //    dit "herkent" ook een mailtje met onderwerp "test". Het telt daarom
    //    lichter mee (zie `SUPPLIER_WEIGHTS`) en kan nooit alleen een
    //    suggestie opleveren.
    if (bodyHay && bodyHay.includes(` ${needle} `)) {
      consider({ supplier: hint.name, score: 35 + needle.length, reason: "supplier:body" });
    }
  }
  return best;
}

/* ──────────────────────────── De herkenning ──────────────────────────── */

/**
 * Weegt alle signalen en geeft een oordeel plus de velden die de
 * boekingsdialoog kan voorinvullen.
 *
 * Puntenverdeling (zie de moduletoelichting voor het waarom):
 * factuurwoord in onderwerp/bijlagenaam 3 · in body 1 · PDF-bijlage 2 ·
 * bijlage zonder bekende naam 1 · leverancier 3 · factuurnummer 1 · bedrag 1.
 *
 * `high` vraagt de combinatie leverancier + factuurwoord + PDF; `medium` vraagt
 * minstens 4 punten. Alles daaronder is `low` en wordt niet aangeboden — een
 * labeltje dat er vaak naast zit, leert de gebruiker het te negeren.
 */
export function detectPurchaseInvoice(
  signals: InvoiceSignals,
  suppliers: SupplierHint[],
): InvoiceGuess {
  const reasons: string[] = [];
  const subject = signals.subject || "";
  const attachmentText = signals.attachmentNames.join(" ");
  const body = signals.bodyText || "";

  /* Tegensignalen eerst: die zetten de uitkomst hard uit. */
  if (signals.direction === "sent") {
    return { isLikely: false, confidence: "low", reasons: ["negative:sent"] };
  }
  if (SALES_INVOICE_SERIES.test(subject) || SALES_INVOICE_SERIES.test(attachmentText)) {
    return { isLikely: false, confidence: "low", reasons: ["negative:own-sales-invoice"] };
  }
  if (NEWSLETTER_WORDS.test(subject)) {
    return { isLikely: false, confidence: "low", reasons: ["negative:newsletter"] };
  }

  let score = 0;

  const wordInSubject = INVOICE_WORDS.test(subject);
  const wordInAttachment = INVOICE_WORDS.test(attachmentText);
  const wordInBody = INVOICE_WORDS.test(body);
  const strongWord = wordInSubject || wordInAttachment;
  if (wordInSubject) { score += 3; reasons.push("keyword:subject"); }
  else if (wordInAttachment) { score += 3; reasons.push("keyword:attachment"); }
  else if (wordInBody) { score += 1; reasons.push("keyword:body"); }

  const hasPdf = signals.attachmentNames.some((n) => fileExt(n) === "pdf");
  const hasSomeAttachment = signals.attachmentNames.length > 0 || signals.hasAttachment === true;
  if (hasPdf) { score += 2; reasons.push("attachment:pdf"); }
  else if (hasSomeAttachment) { score += 1; reasons.push("attachment:present"); }

  const supplier = matchSupplier(signals, suppliers);
  if (supplier) {
    score += supplier.reason === "supplier:body" ? 2 : 3;
    reasons.push(supplier.reason);
  }

  const invoiceNo = findInvoiceNo(signals);
  if (invoiceNo) { score += 1; reasons.push(invoiceNo.reason); }

  const amount = findAmount(body || subject);
  if (amount) { score += 1; reasons.push(amount.reason); }

  const invoiceDate = findInvoiceDate(signals);
  if (invoiceDate) reasons.push(invoiceDate.reason);

  // Een offerte of pakbon zonder factuurwoord in het onderwerp is geen factuur;
  // mét factuurwoord ("factuur bij offerte 123") wint het factuurwoord.
  if (!wordInSubject && NON_INVOICE_DOCS.test(subject)) {
    return { isLikely: false, confidence: "low", reasons: ["negative:other-document"] };
  }

  /**
   * Harde eis: érgens moet het woord "factuur" (of een variant) staan.
   *
   * Zonder deze poort haalde een mailtje met onderwerp "test" al `medium`,
   * puur omdat de handtekening van de afzender een leveranciersnaam bevat en
   * er een plaatje aan hing — en een doorgestuurde set loonstroken haalde het
   * ook, omdat de bestandsnaam op een factuurnummer lijkt. Beide zijn echte
   * mails uit deze mailbox. Punten stapelen is prima om te wégen hoe zeker
   * iets is, maar niet om te bepalen *of* het over een factuur gaat.
   */
  const anyWord = wordInSubject || wordInAttachment || wordInBody;

  const confidence: InvoiceConfidence =
    !anyWord ? "low"
      : supplier && strongWord && hasPdf ? "high"
        : score >= 4 ? "medium"
          : "low";

  const guess: InvoiceGuess = {
    isLikely: confidence !== "low",
    confidence,
    reasons,
  };
  if (supplier) guess.supplier = supplier.supplier;
  if (invoiceNo) guess.invoiceNo = invoiceNo.value;
  if (invoiceDate) guess.invoiceDate = invoiceDate.value;
  if (amount) {
    guess.amount = amount.value;
    if (amount.isGross !== undefined) guess.amountIsGross = amount.isGross;
  }
  return guess;
}
