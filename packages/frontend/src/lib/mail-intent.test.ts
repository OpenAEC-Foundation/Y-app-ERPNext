import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyMailIntent,
  classifySender,
  companyFromDomain,
  companyFromSignature,
  extractContactDetails,
  extractPhone,
  splitPersonName,
  type MailIntentContext,
  type MailIntentSignals,
} from "./mail-intent.ts";

/**
 * De relaties zoals ze op de doelinstance staan (uittreksel, live opgehaald).
 *
 * Twee dingen zijn met opzet meegenomen omdat ze de valkuilen zijn:
 *
 * - **"Domera"** is een verzamel-klant met contacten van tientallen
 *   verschillende domeinen, inclusief gratis-mail en notificatie-afzenders.
 *   Wie op domein zou matchen zonder gratis-mailfilter, hangt elke
 *   gmail-afzender aan Domera.
 * - **Moso Engineering** is een *leverancier* met een gmail-adres. Een
 *   leverancier die iets vraagt is inkoop, geen verkoopkans — dus die tak moet
 *   `none` opleveren en niet "lead".
 */
const CTX: MailIntentContext = {
  suppliers: [
    { name: "Drukwerkdeal.nl B.V.", emails: ["info@drukwerkdeal.nl"] },
    { name: "JBS multimedia B.V.", emails: ["info@jbs-multimedia.nl"] },
    { name: "Moso Engineering", emails: ["mojtaba.karimi1984@gmail.com"] },
    { name: "Cubic Colors B.V.", emails: ["service@cubic-colors.nl"] },
    { name: "3BM Bouwtechniek V.O.F." },
    { name: "Castellum Rosarum BV" },
  ],
  customers: [
    { name: "Van Dorp Infra B.V.", emails: ["Oerlemans@vandorp.eu"] },
    { name: "Gortemaker Algra Feenstra Architects B.V.", emails: ["martjan.denhoed@gaf.eu"] },
    { name: "Groothandel Egg-sellent B.V.", emails: ["facturen@egg-sellent.nl", "dylan@egg-sellent.nl"] },
    { name: "AddVision BV", emails: ["info@addvision.nl"] },
    {
      name: "Domera",
      emails: [
        "admin@nade.es", "eelkedollee@gmail.com", "notifications@frappecloud.com",
        "azure-noreply@microsoft.com", "joris@krieke.nl", "peter@fieldworks.nl",
      ],
    },
  ],
  ownDomains: ["open-aec.com"],
  ownEmails: ["maarten@open-aec.com"],
};

function mail(over: Partial<MailIntentSignals>): MailIntentSignals {
  return {
    subject: "",
    sender: "",
    attachmentNames: [],
    direction: "received",
    ...over,
  };
}

/* ───────────── De drie aanvragen die er écht in de mailbox staan ─────── */

/**
 * Body's zijn ingekorte, letterlijke fragmenten uit de Communications op de
 * doelinstance. Alleen de zinnen die de herkenning raken staan erin — het
 * complete origineel maakt de test onleesbaar zonder iets toe te voegen.
 */
const OERLEMANS = mail({
  subject: "Offerte aanvraag website VDMB.eu",
  sender: "oerlemans@vandorp.eu",
  senderName: "Arno Oerlemans",
  hasAttachment: true,
  mailDate: "2026-08-20 09:14:02",
  bodyText: [
    "Goedemorgen Maarten,",
    "We hebben voor de combinatie van Dorp – Max Bögl vdmb.eu een website nodig.",
    "Zou je hier een inschatting kunnen maken van wat dit zou gaan kosten als jullie dit zouden doen.",
    "Met vriendelijke groet,",
    "Arno Oerlemans",
    "Bedrijfsleider Infra",
    "Van Dorp Infra",
    "+31 657421249",
    "vandorp.eu/infra",
  ].join("\n"),
});

const HAACHT = mail({
  subject: "CAD software voor de gemeente Haacht.",
  sender: "johan.artois@haacht.be",
  senderName: "Johan Artois",
  hasAttachment: true,
  mailDate: "2026-08-26 11:02:00",
  bodyText: [
    "Beste Maarten",
    "Ik contacteer je namens de gemeente Haacht in België. Wij gebruiken momenteel een zeer oude",
    "versie van Autocad die eigenlijk dringend aan vervanging toe is binnen de departementen",
    "Patrimonium en Omgeving. Omdat het dus hoog tijd wordt om te upgraden zijn we op zoek naar",
    "een betaalbaar alternatief. In totaal zou het gaan over een 10-tal regelmatige gebruikers.",
    "Met vriendelijke groet,",
    "Johan Artois",
    "Gemeente Haacht",
  ].join("\n"),
});

const PIEBE = mail({
  subject: "Kennismaking",
  sender: "piebevdstorm@gmail.com",
  senderName: "Piebe van der Storm",
  mailDate: "2026-08-20 20:31:00",
  bodyText: [
    "Beste Maarten",
    "Je spreekt met Piebe van der Storm,",
    "Ik heb een klein aannemers bedrijfje en 3d computer animation gestudeerd.",
    "Ik zou graag eens een gesprek voeren om te kijken of wij op dezelfde lijn zitten.",
    "Ik ben zo goed als constant bereikbaar op 0643430257.",
    "Vriendelijke groeten;",
    "Piebe van der Storm - Ekster Monument & Renovatie",
    "Ekstergroep.nl",
  ].join("\n"),
});

test("bestaande klant met offerteaanvraag → offerteaanvraag op die klant", () => {
  const intent = classifyMailIntent(OERLEMANS, CTX);
  assert.equal(intent.kind, "quote-request");
  assert.equal(intent.customer, "Van Dorp Infra B.V.");
  assert.equal(intent.confidence, "high");
  assert.equal(intent.contact?.personName, "Arno Oerlemans");
});

test("onbekende afzender die om een alternatief vraagt → lead", () => {
  const intent = classifyMailIntent(HAACHT, CTX);
  assert.equal(intent.kind, "lead");
  assert.equal(intent.contact?.firstName, "Johan");
  assert.equal(intent.contact?.lastName, "Artois");
  assert.equal(intent.contact?.email, "johan.artois@haacht.be");
});

test("kennismaking van een onbekende → lead, met bedrijf uit de handtekening", () => {
  const intent = classifyMailIntent(PIEBE, CTX);
  assert.equal(intent.kind, "lead");
  assert.equal(intent.confidence, "high");
  assert.equal(intent.contact?.companyName, "Ekster Monument & Renovatie");
  assert.equal(intent.contact?.lastName, "van der Storm");
  assert.equal(intent.contact?.phone, "0643430257");
});

/* ─────────────────────── Wat NIET voorgesteld mag worden ─────────────── */

test("nieuwsbrief levert geen voorstel op", () => {
  const intent = classifyMailIntent(mail({
    subject: "Onze nieuwsbrief: interesse in een demo?",
    sender: "redactie@bouwwereld.nl",
  }), CTX);
  assert.equal(intent.kind, "none");
  assert.equal(intent.reasons[0], "negative:newsletter");
});

test("platformnotificatie levert geen voorstel op", () => {
  const intent = classifyMailIntent(mail({
    subject: "0420640686 is your Instagram recovery code",
    sender: "security@mail.instagram.com",
  }), CTX);
  assert.equal(intent.kind, "none");
});

test("GitHub-notificatie levert geen voorstel op, ook mét aanvraagwoorden", () => {
  const intent = classifyMailIntent(mail({
    subject: "[OpenAEC/studio] Request for information about licensing (#42)",
    sender: "notifications@github.com",
    bodyText: "I am interested in a quotation for commercial use.",
  }), CTX);
  assert.equal(intent.kind, "none");
});

test("supportmelding is geen lead", () => {
  const intent = classifyMailIntent(mail({
    subject: "Download link(s) van Open Energy Studio (GitHub) lijken niet te werken",
    sender: "dickdekker@outlook.com",
    senderName: "Dick Dekker",
    bodyText: "Ik ben erg nieuwsgierig naar de calculator. Kunnen jullie me laten weten waar ik deze downloads kan vinden?",
  }), CTX);
  assert.equal(intent.kind, "none");
  assert.equal(intent.reasons[0], "negative:support");
});

test("antwoord in een lopende offertethread is geen nieuwe aanvraag", () => {
  const intent = classifyMailIntent(mail({
    subject: "Re: Offerte MPG-berekening & Bestekschrijven — SAL-QTN-2026-00013",
    sender: "martjan.denhoed@gaf.eu",
    senderName: "Martjan den Hoed",
    bodyText: "Dank voor de offerte, we bespreken hem intern.",
  }), CTX);
  assert.equal(intent.kind, "none");
  assert.equal(intent.reasons[0], "negative:existing-deal");
});

test("lopend gesprek met een klant zonder aanvraag levert niets op", () => {
  const intent = classifyMailIntent(mail({
    subject: "Re: NLLCS++ export GEN",
    sender: "hulsing@vandorp.eu",
    senderName: "Esther Hulsing",
    bodyText: [
      "Goedemiddag Maarten,",
      "Ik zag in mijn notities staat dat ik je nog iets meer informatie over de horizontale boring zou sturen.",
      "Zullen we een vervolgafspraak inplannen?",
      "Met vriendelijke groet,",
      "Esther Hulsing",
      "Van Dorp Infra",
    ].join("\n"),
  }), CTX);
  assert.equal(intent.kind, "none");
});

test("inkoopfactuur wint van het verkoopspoor", () => {
  const intent = classifyMailIntent(mail({
    subject: "Factuur 3BM Bouwtechniek V.O.F. 263-05192",
    sender: "maarten@3bm.co.nl",
    senderName: "Maarten Vroegindeweij",
    attachmentNames: ["263-05192.pdf"],
    hasAttachment: true,
    mailDate: "2026-08-03 08:00:00",
  }), CTX);
  assert.equal(intent.kind, "purchase-invoice");
  assert.ok(intent.invoice);
});

test("doorgestuurde eigen verkoopfactuur levert geen enkel voorstel op", () => {
  const intent = classifyMailIntent(mail({
    subject: "FW: Factuur ACC-SINV-2026-00012 - OpenAEC Studio BV",
    sender: "facturen@egg-sellent.nl",
    attachmentNames: ["ACC-SINV-2026-00012.pdf"],
    hasAttachment: true,
  }), CTX);
  assert.equal(intent.kind, "none");
});

test("eigen collega is nooit een lead", () => {
  const intent = classifyMailIntent(mail({
    subject: "Offerte aanvraag doorsturen?",
    sender: "maarten@open-aec.com",
    bodyText: "Zullen we hier een offerte voor maken?",
  }), CTX);
  assert.equal(intent.kind, "none");
  assert.equal(intent.reasons[0], "negative:own-domain");
});

test("leverancier die om iets vraagt is inkoop, geen lead", () => {
  const intent = classifyMailIntent(mail({
    subject: "Kennismaking en offerte voor drukwerk",
    sender: "info@drukwerkdeal.nl",
  }), CTX);
  assert.equal(intent.kind, "none");
  assert.equal(intent.reasons[0], "negative:supplier");
});

test("mail zonder aanvraagwoorden levert niets op", () => {
  const intent = classifyMailIntent(mail({
    subject: "test",
    sender: "maarten@3bm.co.nl",
    hasAttachment: true,
  }), CTX);
  assert.equal(intent.kind, "none");
  assert.equal(intent.reasons[0], "negative:no-request-words");
});

test("verzonden mail levert nooit een voorstel op", () => {
  const intent = classifyMailIntent(mail({
    ...PIEBE,
    direction: "sent",
  }), CTX);
  assert.equal(intent.kind, "none");
});

test("al gekoppelde mail krijgt geen nieuw voorstel", () => {
  const intent = classifyMailIntent(mail({ ...PIEBE, linkedDoctype: "Lead" }), CTX);
  assert.equal(intent.kind, "none");
  assert.equal(intent.reasons[0], "negative:already-linked");
});

/* ──────────────────────────── Afzenderfeiten ─────────────────────────── */

test("gratis-mailadres van een klantcontact hangt de afzender niet aan die klant", () => {
  // `eelkedollee@gmail.com` staat als contact bij Domera; een wíllekeurige
  // andere gmail-afzender mag daar niet op meeliften.
  assert.equal(classifySender("iemand.anders@gmail.com", CTX).relation, "unknown");
  assert.equal(classifySender("eelkedollee@gmail.com", CTX).relation, "customer");
});

test("subdomein van een klantdomein telt als dezelfde klant", () => {
  const facts = classifySender("nieuw.persoon@mail.vandorp.eu", CTX);
  assert.equal(facts.relation, "customer");
  assert.equal(facts.customer, "Van Dorp Infra B.V.");
});

test("leverancier gaat vóór klant", () => {
  assert.equal(classifySender("mojtaba.karimi1984@gmail.com", CTX).relation, "supplier");
});

/* ───────────────────────── Gegevens uit de mail ──────────────────────── */

test("naam splitsen houdt tussenvoegsels bij de achternaam", () => {
  assert.deepEqual(splitPersonName("Piebe van der Storm"), { firstName: "Piebe", lastName: "van der Storm" });
  assert.deepEqual(splitPersonName("Arno Oerlemans"), { firstName: "Arno", lastName: "Oerlemans" });
  assert.deepEqual(splitPersonName("Cher"), { firstName: "Cher", lastName: "" });
  assert.deepEqual(splitPersonName(""), { firstName: "", lastName: "" });
});

test("telefoonnummer uit de handtekening, geen jaartallen of bedragen", () => {
  assert.equal(extractPhone("Met vriendelijke groet,\nArno Oerlemans\nVan Dorp Infra\n+31 657421249"), "+31 657421249");
  assert.equal(extractPhone("Dick Dekker\n(06 130 724 08)"), "06 130 724 08");
  assert.equal(extractPhone("Factuurnummer 20260430-1, bedrag 2 417.58"), "");
});

test("bedrijfsnaam uit de handtekening, nooit een adresregel", () => {
  const withDash = "Vriendelijke groeten;\nPiebe van der Storm - Ekster Monument & Renovatie\nEkstergroep.nl";
  assert.equal(companyFromSignature(withDash, "Piebe van der Storm"), "Ekster Monument & Renovatie");

  const withAddress = "S pozdravem\ning. Vladimír Zima\nPřelovice 99\n53341";
  assert.equal(companyFromSignature(withAddress, "ing. Vladimír Zima"), "");
});

test("bedrijfsnaam uit het domein als laatste redmiddel", () => {
  assert.equal(companyFromDomain("zima-engineering.cz"), "Zima Engineering");
  assert.equal(companyFromDomain("ramboll.com"), "Ramboll");
  assert.equal(companyFromDomain("haacht.be"), "Haacht");
  // Gratis-mail levert bewust niets op: "Gmail" is erger dan leeg.
  assert.equal(companyFromDomain("gmail.com"), "");
});

test("niets verzinnen: zonder body blijven bedrijf en telefoon leeg", () => {
  const details = extractContactDetails(mail({
    subject: "Kennismaking",
    sender: "iemand@gmail.com",
    senderName: "Jan Jansen",
  }));
  assert.equal(details.personName, "Jan Jansen");
  assert.equal(details.companyName, undefined);
  assert.equal(details.phone, undefined);
});
