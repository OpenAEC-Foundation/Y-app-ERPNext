import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_UOM,
  buildQuotationPayload,
  defaultValidTill,
  lineFromMailSubject,
  quotationDateFromMail,
  quotationTotal,
  validateQuotationInput,
  type QuotationInput,
} from "./quotation-payload.ts";

/**
 * De vorm hieronder is de payload die **live** op de doelinstance een
 * concept-offerte opleverde (Frappe 16.19.0 / ERPNext 16.16.0): `SAL-QTN-2026-…`
 * met `status: "Draft"`, `docstatus: 0`, en door ERPNext zelf ingevulde
 * `currency: "EUR"`, `conversion_rate: 1`, `selling_price_list: "Standard
 * Selling"` en `order_type: "Sales"`. Wijkt deze test af, dan wijkt de payload
 * af van wat er bewezen werkt.
 */
function base(): QuotationInput {
  return {
    partyType: "Customer",
    party: "AddVision BV",
    company: "OpenAEC Studio BV",
    transactionDate: "2026-09-01",
    validTill: "2026-10-01",
    lines: [{ itemName: "Advieswerk n.a.v. mailaanvraag", description: "Testregel", qty: 2, rate: 95 }],
  };
}

/* ───────────────────────────── Geldigheid ────────────────────────────── */

test("een volledige invoer heeft geen ontbrekende velden", () => {
  assert.deepEqual(validateQuotationInput(base()), []);
});

test("zonder partij, bedrijf of regels meldt de validatie precies dát", () => {
  const missing = validateQuotationInput({
    partyType: "Customer", party: "", company: "", transactionDate: "2026-09-01", lines: [],
  });
  assert.deepEqual(missing, ["party", "company", "lines"]);
});

test("een regelfout draagt zijn eigen index mee", () => {
  const input = base();
  input.lines = [
    { itemName: "Goede regel", qty: 1, rate: 10 },
    { itemName: "", qty: 0, rate: -5 },
  ];
  assert.deepEqual(validateQuotationInput(input), ["lines.1.itemName", "lines.1.qty", "lines.1.rate"]);
});

test("tarief 0 is geldig — een post 'in overleg' hoort te kunnen", () => {
  const input = base();
  input.lines = [{ itemName: "Nader te bepalen", qty: 1, rate: 0 }];
  assert.deepEqual(validateQuotationInput(input), []);
});

test("een geldigheidsdatum vóór de offertedatum is een fout", () => {
  const input = base();
  input.validTill = "2026-08-01";
  assert.ok(validateQuotationInput(input).includes("validTill"));
});

test("een onzinnige datum of een kapot e-mailadres wordt gemeld, niet doorgelaten", () => {
  const input = base();
  input.transactionDate = "01-09-2026";
  input.contactEmail = "geen adres";
  const missing = validateQuotationInput(input);
  assert.ok(missing.includes("transactionDate"));
  assert.ok(missing.includes("contactEmail"));
});

/* ───────────────────────────── De payload ────────────────────────────── */

test("de payload heeft precies de velden die live werkten", () => {
  const payload = buildQuotationPayload(base());
  assert.equal(payload.quotation_to, "Customer");
  assert.equal(payload.party_name, "AddVision BV");
  assert.equal(payload.company, "OpenAEC Studio BV");
  assert.equal(payload.transaction_date, "2026-09-01");
  assert.equal(payload.valid_till, "2026-10-01");
  assert.equal(payload.naming_series, "SAL-QTN-.YYYY.-");
  assert.equal(payload.order_type, "Sales");
  // De belofte van de knop: dit blijft een concept.
  assert.equal(payload.status, "Draft");
  assert.equal(payload.docstatus, 0);
});

test("valuta en prijslijst gaan alleen mee als ze bekend zijn", () => {
  const zonder = buildQuotationPayload(base());
  assert.equal("currency" in zonder, false);
  assert.equal("selling_price_list" in zonder, false);

  const met = buildQuotationPayload({ ...base(), currency: "EUR", sellingPriceList: "Standard Selling" });
  assert.equal(met.currency, "EUR");
  assert.equal(met.selling_price_list, "Standard Selling");
});

test("een vrije regel krijgt uom en conversion_factor mee (beide verplicht op Quotation Item)", () => {
  const items = buildQuotationPayload(base()).items as Record<string, unknown>[];
  assert.equal(items.length, 1);
  assert.equal(items[0].item_name, "Advieswerk n.a.v. mailaanvraag");
  assert.equal(items[0].uom, DEFAULT_UOM);
  assert.equal(items[0].conversion_factor, 1);
  // Zonder item_code: het veld hoort er dan helemaal niet in te zitten, want
  // een lege Link laat de insert falen op "Could not find Item: ".
  assert.equal("item_code" in items[0], false);
});

test("een gekozen artikel houdt zijn code en eenheid", () => {
  const input = base();
  input.lines = [{ itemCode: "ADV-001", itemName: "Advies", qty: 3, rate: 120, uom: "Hour" }];
  const items = buildQuotationPayload(input).items as Record<string, unknown>[];
  assert.equal(items[0].item_code, "ADV-001");
  assert.equal(items[0].uom, "Hour");
});

test("een regel zonder eigen omschrijving krijgt de regelnaam als omschrijving", () => {
  const input = base();
  input.lines = [{ itemName: "Bestekschrijven", qty: 1, rate: 500 }];
  const items = buildQuotationPayload(input).items as Record<string, unknown>[];
  assert.equal(items[0].description, "Bestekschrijven");
});

test("de Lead-variant zet quotation_to op Lead", () => {
  const payload = buildQuotationPayload({
    ...base(), partyType: "Lead", party: "CRM-LEAD-2026-00001",
  });
  assert.equal(payload.quotation_to, "Lead");
  assert.equal(payload.party_name, "CRM-LEAD-2026-00001");
});

test("de mailtekst belandt in terms, niet in een verzonnen veld", () => {
  const payload = buildQuotationPayload({ ...base(), terms: "Graag een prijs voor de gevel." });
  assert.equal(payload.terms, "Graag een prijs voor de gevel.");
  // `custom_description` bestaat niet op deze instance; Frappe zou het stil
  // negeren en de offerte zonder toelichting opleveren.
  assert.equal("custom_description" in payload, false);
});

test("een te lange regelnaam wordt afgekapt op de Data-veldlengte", () => {
  const input = base();
  input.lines = [{ itemName: "x".repeat(300), qty: 1, rate: 1 }];
  const items = buildQuotationPayload(input).items as Record<string, unknown>[];
  assert.equal((items[0].item_name as string).length, 140);
});

test("bouwen met een onvolledige invoer gooit in plaats van half te verzenden", () => {
  assert.throws(
    () => buildQuotationPayload({ ...base(), party: "" }),
    /Onvolledige offerte: party/,
  );
});

/* ──────────────────────────────── Hulp ───────────────────────────────── */

test("defaultValidTill telt 30 dagen op, ook over een zomertijdgrens", () => {
  assert.equal(defaultValidTill("2026-09-01"), "2026-10-01");
  // 25 oktober 2026 valt binnen dit venster (einde zomertijd in NL).
  assert.equal(defaultValidTill("2026-10-10"), "2026-11-09");
});

test("quotationDateFromMail neemt de maildatum over, met vandaag als vangnet", () => {
  assert.equal(quotationDateFromMail("2026-08-20 09:14:02"), "2026-08-20");
  assert.match(quotationDateFromMail(undefined), /^\d{4}-\d{2}-\d{2}$/);
});

test("de eerste regel komt uit het onderwerp, met tarief 0 — niets verzinnen", () => {
  const line = lineFromMailSubject("Offerte aanvraag website VDMB.eu");
  assert.equal(line.itemName, "Offerte aanvraag website VDMB.eu");
  assert.equal(line.qty, 1);
  assert.equal(line.rate, 0);
});

test("quotationTotal rondt op centen af", () => {
  assert.equal(quotationTotal([{ itemName: "a", qty: 3, rate: 0.1 }]), 0.3);
  assert.equal(quotationTotal([
    { itemName: "a", qty: 2, rate: 95 },
    { itemName: "b", qty: 1, rate: 12.345 },
  ]), 202.35);
});
