import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectPurchaseInvoice,
  looksLikeInvoiceNumber,
  normalizeCompanyName,
  parseAmount,
  parseDateish,
  type InvoiceSignals,
  type SupplierHint,
} from "./invoice-detect.ts";

/**
 * De leveranciers zoals ze op de doelinstance staan (uittreksel). `emails`
 * komt van de Contacts die via een Dynamic Link aan de Supplier hangen — let
 * op het gmail-adres bij Moso Engineering: dat is precies het geval waarin
 * domeinmatching stuk zou gaan en exacte adresmatching moet werken.
 */
const SUPPLIERS: SupplierHint[] = [
  { name: "3BM Bouwkunde" },
  { name: "3BM Bouwtechniek V.O.F." },
  { name: "Castellum Rosarum BV" },
  { name: "Digidentity" },
  { name: "Drukwerkdeal.nl B.V.", emails: ["info@drukwerkdeal.nl"] },
  { name: "JBS multimedia B.V.", emails: ["info@jbs-multimedia.nl"] },
  { name: "Moso Engineering", emails: ["mojtaba.karimi1984@gmail.com"] },
  { name: "Sympraxis B.V.", emails: ["freek@sympraxis.nl"] },
];

function signals(partial: Partial<InvoiceSignals> & { subject: string; sender: string }): InvoiceSignals {
  return { attachmentNames: [], ...partial };
}

/* ─────────────────────────── Losse bouwstenen ────────────────────────── */

test("normalizeCompanyName snoeit de juridische staart weg", () => {
  assert.equal(normalizeCompanyName("3BM Bouwtechniek V.O.F."), "3bm bouwtechniek");
  assert.equal(normalizeCompanyName("Castellum Rosarum BV"), "castellum rosarum");
  assert.equal(normalizeCompanyName("Castellum Rosarum B.V."), "castellum rosarum");
  assert.equal(normalizeCompanyName("JBS multimedia B.V."), "jbs multimedia");
  assert.equal(normalizeCompanyName("Moso Engineering"), "moso engineering");
  // Eén token blijft altijd staan, ook als het toevallig een suffix is.
  assert.equal(normalizeCompanyName("SA"), "sa");
});

test("looksLikeInvoiceNumber: de echte nummers uit de instance", () => {
  for (const ok of ["263-05192", "26CRB-00007", "2026-026709", "20260430-1", "2610-00031", "2026-0006"]) {
    assert.equal(looksLikeInvoiceNumber(ok), true, ok);
  }
});

test("looksLikeInvoiceNumber: datums, jaartallen en bedragen vallen af", () => {
  for (const nope of ["2026", "2026-07-01", "21-08-2026", "2417.58", "1.234,56", "V.O.F.", "BTW", "abc", "12"]) {
    assert.equal(looksLikeInvoiceNumber(nope), false, nope);
  }
});

test("parseAmount kent de drie schrijfwijzen uit deze mailbox", () => {
  assert.equal(parseAmount("2 417.58"), 2417.58);   // ERPNext-factuurmail
  assert.equal(parseAmount("1.234,56"), 1234.56);   // Nederlands
  assert.equal(parseAmount("15928.50"), 15928.5);   // kaal
  assert.equal(parseAmount("1.234"), 1234);         // duizendtal, geen decimaal
  assert.equal(parseAmount("nvt"), undefined);
});

test("parseDateish begrijpt ISO, dd-mm-jjjj en maandnamen", () => {
  assert.equal(parseDateish("2026-07-01"), "2026-07-01");
  assert.equal(parseDateish("21-08-2026"), "2026-08-21");
  assert.equal(parseDateish("30 April 2026"), "2026-04-30");
  assert.equal(parseDateish("3 augustus 2026"), "2026-08-03");
  assert.equal(parseDateish("ergens volgende week"), undefined);
});

/* ───────────────── Echte factuurmails van de doelinstance ────────────── */

test("hoge zekerheid: leveranciersnaam in onderwerp + factuur-PDF", () => {
  const guess = detectPurchaseInvoice(signals({
    subject: "Factuur 3BM Bouwtechniek V.O.F. 263-05192",
    sender: "maarten@3bm.co.nl",
    attachmentNames: ["263-05192.pdf"],
    mailDate: "2026-08-03 21:56:28",
    bodyText: "Factuur 3BM Bouwtechniek V.O.F. 263-05192 Beste heer/mevrouw, Bij deze stuur ik u de factuur "
      + "voor onze advieswerkzaamheden voor het project: 3273 Open Pile Plan Studio Het totale bedrag bedraagt "
      + "€ 2 417.58 (inclusief BTW). € 1 998.00 (excl. BTW). Wij verzoeken u vriendelijk dit voor "
      + "2026-08-21 te voldoen op rekeningnummer NL95RABO0152787410 t.n.v. 3BM Bouwtechniek V.O.F. onder "
      + "vermelding van factuurnummer 263-05192 .",
  }), SUPPLIERS);

  assert.equal(guess.isLikely, true);
  assert.equal(guess.confidence, "high");
  assert.equal(guess.supplier, "3BM Bouwtechniek V.O.F.");
  assert.equal(guess.invoiceNo, "263-05192");
  // Netto, niet bruto: dat is wat als regelbedrag geboekt moet worden.
  assert.equal(guess.amount, 1998);
  assert.equal(guess.amountIsGross, false);
  // Geen factuurdatum in de body — de datum "2026-08-21" is de vervaldatum,
  // dus de maildatum wint.
  assert.equal(guess.invoiceDate, "2026-08-03");
  assert.ok(guess.reasons.includes("date:mail"));
  assert.ok(guess.reasons.includes("attachment:pdf"));
});

test("de langste leveranciersnaam wint van de kortere naamgenoot", () => {
  // "3BM Bouwkunde" en "3BM Bouwtechniek V.O.F." bestaan allebei.
  const guess = detectPurchaseInvoice(signals({
    subject: "Factuur Castellum Rosarum B.V. 26CRB-00007",
    sender: "maarten@3bm.co.nl",
    attachmentNames: ["26CRB-00007.pdf"],
    mailDate: "2026-08-03 23:20:38",
    bodyText: "Het totale bedrag bedraagt € 2 409.41 (inclusief BTW). € 1 991.25 (excl. BTW).",
  }), SUPPLIERS);

  assert.equal(guess.confidence, "high");
  assert.equal(guess.supplier, "Castellum Rosarum BV");
  assert.equal(guess.invoiceNo, "26CRB-00007");
  assert.equal(guess.amount, 1991.25);
});

test("leverancier via een gmail-contactadres, factuurnummer uit de body", () => {
  const guess = detectPurchaseInvoice(signals({
    subject: "Fwd: Invoice for Recent Services",
    sender: "mojtaba.karimi1984@gmail.com",
    attachmentNames: ["20260430-1.pdf"],
    mailDate: "2026-06-11 09:36:43",
    bodyText: "This is a reminder regarding the invoice below, which is currently overdue. "
      + "Invoice: 20260430-1 Date sent: 30 April 2026 Due date: 15 May 2026 Amount: € 15928.50",
  }), SUPPLIERS);

  assert.equal(guess.isLikely, true);
  assert.equal(guess.confidence, "high");
  assert.equal(guess.supplier, "Moso Engineering");
  assert.equal(guess.invoiceNo, "20260430-1");
  assert.equal(guess.amount, 15928.5);
  assert.ok(guess.reasons.includes("supplier:contact-email"));
});

test("doorgestuurde factuurthread zonder PDF blijft medium", () => {
  // Echte mail: alleen inline PNG's uit de handtekening, geen factuur-PDF.
  const guess = detectPurchaseInvoice(signals({
    subject: "Fwd: Factuur 3BM Bouwtechniek V.O.F. 263-05163",
    sender: "maarten@3bm.co.nl",
    attachmentNames: ["Outlook-kzymgmpg.png", "bDdmi9EVxqEirblI.png"],
    mailDate: "2026-08-24 14:25:21",
  }), SUPPLIERS);

  assert.equal(guess.isLikely, true);
  assert.equal(guess.confidence, "medium");
  assert.equal(guess.supplier, "3BM Bouwtechniek V.O.F.");
  assert.equal(guess.invoiceNo, "263-05163");
  assert.equal(guess.amount, undefined, "niets verzinnen wat er niet staat");
});

test("lijstweergave kent alleen has_attachment en komt tot medium", () => {
  // Zelfde mail als de high-test, maar zonder body en bijlagenamen: precies
  // wat de berichtenlijst weet. Het labeltje verschijnt, de zekerheid is
  // lager, en na openen wordt het vanzelf high.
  const guess = detectPurchaseInvoice(signals({
    subject: "Factuur 3BM Bouwtechniek V.O.F. 263-05192",
    sender: "maarten@3bm.co.nl",
    hasAttachment: true,
    mailDate: "2026-08-03 21:56:28",
  }), SUPPLIERS);

  assert.equal(guess.isLikely, true);
  assert.equal(guess.confidence, "medium");
  assert.equal(guess.supplier, "3BM Bouwtechniek V.O.F.");
});

/* ───────────────────────── Negatieve gevallen ────────────────────────── */

test("eigen verkoopfactuur die terugkomt is geen inkoopfactuur", () => {
  const guess = detectPurchaseInvoice(signals({
    subject: "FW: Factuur ACC-SINV-2026-00012 - OpenAEC Studio BV",
    sender: "facturen@egg-sellent.nl",
    attachmentNames: ["image005.png", "image004.png"],
    mailDate: "2026-08-11 12:05:31",
    bodyText: "Dag Maarten, Alles goed? Dank voor de factuur.",
  }), SUPPLIERS);

  assert.equal(guess.isLikely, false);
  assert.equal(guess.confidence, "low");
  assert.deepEqual(guess.reasons, ["negative:own-sales-invoice"]);
});

test("gewone zakelijke mail met bijlage blijft ongemoeid", () => {
  const guess = detectPurchaseInvoice(signals({
    subject: "CAD software voor de gemeente Haacht.",
    sender: "johan.artois@haacht.be",
    attachmentNames: ["image001cc4e28.png"],
    mailDate: "2026-08-26 09:55:44",
  }), SUPPLIERS);
  assert.equal(guess.isLikely, false);
  assert.equal(guess.confidence, "low");
});

test("offerteaanvraag is geen factuur", () => {
  const guess = detectPurchaseInvoice(signals({
    subject: "Offerte aanvraag website VDMB.eu",
    sender: "oerlemans@vandorp.eu",
    attachmentNames: ["offerte-2026.pdf"],
    mailDate: "2026-08-20 08:19:28",
  }), SUPPLIERS);
  assert.equal(guess.isLikely, false);
  assert.deepEqual(guess.reasons, ["negative:other-document"]);
});

test("nieuwsbrief met factuurwoord en PDF wordt onderdrukt", () => {
  const guess = detectPurchaseInvoice(signals({
    subject: "Nieuwsbrief augustus — uw factuur staat klaar",
    sender: "noreply@example.com",
    attachmentNames: ["nieuwsbrief.pdf"],
  }), SUPPLIERS);
  assert.equal(guess.isLikely, false);
  assert.deepEqual(guess.reasons, ["negative:newsletter"]);
});

test("verzonden mail wordt nooit als inkoopfactuur aangeboden", () => {
  const guess = detectPurchaseInvoice(signals({
    subject: "Factuur 3BM Bouwtechniek V.O.F. 263-05192",
    sender: "maarten@3bm.co.nl",
    attachmentNames: ["263-05192.pdf"],
    direction: "sent",
  }), SUPPLIERS);
  assert.equal(guess.isLikely, false);
  assert.deepEqual(guess.reasons, ["negative:sent"]);
});

test("de handtekening van de afzender maakt van 'test' geen factuur", () => {
  // Echte mail uit de instance. Elke mail van dit adres draagt "3BM
  // Bouwtechniek V.O.F." in de handtekening; zonder de factuurwoord-eis
  // haalde deze mail `medium` op leveranciersnaam + bijlage alleen.
  const guess = detectPurchaseInvoice(signals({
    subject: "test",
    sender: "maarten@3bm.co.nl",
    attachmentNames: ["Outlook-kzymgmpg.png"],
    mailDate: "2026-08-24 10:27:20",
    bodyText: "Met vriendelijke groet, Maarten Vroegindeweij 3BM Bouwtechniek V.O.F. "
      + "Burgemeester de Raadtsingel 31 3311 JG Dordrecht 3bm.co.nl",
  }), SUPPLIERS);
  assert.equal(guess.isLikely, false);
  assert.equal(guess.confidence, "low");
});

test("doorgestuurde loonstroken zijn geen factuur, ook niet met PDF", () => {
  // Ook echt: de bestandsnaam bevat genoeg cijfers om op een factuurnummer te
  // lijken, en de handtekening levert een leverancier. Alleen het ontbreken
  // van élk factuurwoord houdt dit tegen.
  const guess = detectPurchaseInvoice(signals({
    subject: "Fwd: Impertio Studio B.V., Periodeverslagen Maandelijks 2026-7/2",
    sender: "maarten@3bm.co.nl",
    attachmentNames: ["Loonstroken_Maandelijks_2026_7_2.pdf"],
    mailDate: "2026-08-04 01:21:07",
    bodyText: "Met vriendelijke groet, Maarten Vroegindeweij 3BM Bouwtechniek V.O.F.",
  }), SUPPLIERS);
  assert.equal(guess.isLikely, false);
  assert.equal(guess.confidence, "low");
});

test("factuurwoord alleen in de body is genoeg om de poort te passeren", () => {
  const guess = detectPurchaseInvoice(signals({
    subject: "Bijgaand het overzicht",
    sender: "info@jbs-multimedia.nl",
    attachmentNames: ["2026-0451.pdf"],
    mailDate: "2026-08-04 09:00:00",
    bodyText: "Beste, hierbij de factuur voor de geleverde werkzaamheden.",
  }), SUPPLIERS);
  assert.equal(guess.isLikely, true);
  assert.equal(guess.confidence, "medium");
  assert.equal(guess.supplier, "JBS multimedia B.V.");
});

test("kale mail zonder bijlage en zonder factuurwoord scoort laag", () => {
  const guess = detectPurchaseInvoice(signals({
    subject: "Kennismaking",
    sender: "piebevdstorm@gmail.com",
  }), SUPPLIERS);
  assert.equal(guess.isLikely, false);
  assert.equal(guess.confidence, "low");
  assert.equal(guess.supplier, undefined);
});

test("gratis-maildomein koppelt nooit op domeinnaam alleen", () => {
  // Een wildvreemde gmail-afzender mag niet aan Moso Engineering hangen,
  // ook al staat dáár een gmail-contact bij.
  const guess = detectPurchaseInvoice(signals({
    subject: "Factuur 2026-0099",
    sender: "iemand.anders@gmail.com",
    attachmentNames: ["2026-0099.pdf"],
  }), SUPPLIERS);
  assert.equal(guess.supplier, undefined);
  assert.equal(guess.confidence, "medium", "wel een factuur, maar zonder leverancier");
});

test("leverancier via het domein van een bekend contactadres", () => {
  // Ander postvak (`boekhouding@`) dan het contact (`info@`), zelfde domein.
  const guess = detectPurchaseInvoice(signals({
    subject: "Uw factuur 2026-0006",
    sender: "boekhouding@drukwerkdeal.nl",
    attachmentNames: ["2026-0006.pdf"],
  }), SUPPLIERS);
  assert.equal(guess.confidence, "high");
  assert.equal(guess.supplier, "Drukwerkdeal.nl B.V.");
  assert.ok(guess.reasons.includes("supplier:domain"));
});

test("leverancier zonder contactgegevens wordt uit het afzenderdomein gehaald", () => {
  // Digidentity heeft op deze instance geen e-mailadres én geen contact —
  // de bedrijfsnaam in het domein is dan het enige aanknopingspunt.
  const guess = detectPurchaseInvoice(signals({
    subject: "Uw factuur 2026-026709",
    sender: "facturen@digidentity.com",
    attachmentNames: ["2026-026709.pdf"],
  }), SUPPLIERS);
  assert.equal(guess.supplier, "Digidentity");
  assert.ok(guess.reasons.includes("supplier:sender-domain"));
});

test("expliciete factuurdatum in de body wint van de maildatum", () => {
  const guess = detectPurchaseInvoice(signals({
    subject: "Factuur 2026-0006",
    sender: "info@drukwerkdeal.nl",
    attachmentNames: ["2026-0006.pdf"],
    mailDate: "2026-08-26 09:55:44",
    bodyText: "Factuurdatum: 12-08-2026 — te voldoen voor 2026-09-12.",
  }), SUPPLIERS);
  assert.equal(guess.invoiceDate, "2026-08-12");
  assert.ok(guess.reasons.includes("date:labelled"));
});
