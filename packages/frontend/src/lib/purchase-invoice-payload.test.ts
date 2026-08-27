import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPurchaseInvoicePayload,
  todayIso,
  validatePurchaseInvoiceInput,
  type PurchaseInvoiceInput,
} from "./purchase-invoice-payload.ts";

/** De invoer zoals de dialoog hem oplevert voor een echte factuur uit de instance. */
function input(overrides: Partial<PurchaseInvoiceInput> = {}): PurchaseInvoiceInput {
  return {
    supplier: "3BM Bouwtechniek V.O.F.",
    company: "OpenAEC Studio BV",
    creditTo: "Crediteuren - OSB",
    expenseAccount: "Kostprijs omzet grondstoffen - OSB",
    postingDate: "2026-08-27",
    billNo: "263-05192",
    billDate: "2026-08-03",
    description: "Factuur 3BM Bouwtechniek V.O.F. 263-05192",
    amount: 1998,
    ...overrides,
  };
}

const NOW = new Date("2026-08-27T10:00:00");

test("payload heeft exact de velden die ERPNext v16 verplicht stelt", () => {
  const payload = buildPurchaseInvoicePayload(input(), NOW);
  assert.equal(payload.supplier, "3BM Bouwtechniek V.O.F.");
  assert.equal(payload.company, "OpenAEC Studio BV");
  assert.equal(payload.posting_date, "2026-08-27");
  assert.equal(payload.credit_to, "Crediteuren - OSB");
  assert.equal(payload.currency, "EUR");
  assert.equal(payload.bill_no, "263-05192");
  assert.equal(payload.bill_date, "2026-08-03");
  // Geen docstatus meesturen: een nieuw document is per definitie concept, en
  // een expliciete 0 zou suggereren dat de waarde ergens anders vandaan komt.
  assert.equal("docstatus" in payload, false);
});

test("de factuurregel draagt de velden die zonder item_code nodig zijn", () => {
  const items = buildPurchaseInvoicePayload(input(), NOW).items as Record<string, unknown>[];
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.qty, 1);
  assert.equal(item.rate, 1998);
  assert.equal(item.uom, "Nos");
  // Live geverifieerd: zonder deze twee weigert ERPNext de regel.
  assert.equal(item.conversion_factor, 1);
  assert.equal(item.expense_account, "Kostprijs omzet grondstoffen - OSB");
  // `amount` is read-only en wordt door ERPNext berekend; meesturen zou een
  // waarde vastleggen die na een tarief-wijziging niet meer klopt.
  assert.equal("amount" in item, false);
  assert.equal("item_code" in item, false);
});

test("boekdatum in het verleden zet set_posting_time", () => {
  const payload = buildPurchaseInvoicePayload(input({ postingDate: "2026-07-01" }), NOW);
  assert.equal(payload.set_posting_time, 1);
  assert.equal(payload.posting_time, "00:00:00");
});

test("boekdatum van vandaag laat de payload ongemoeid", () => {
  const payload = buildPurchaseInvoicePayload(input(), NOW);
  assert.equal("set_posting_time" in payload, false);
  assert.equal("posting_time" in payload, false);
});

test("project en kostenplaats komen op zowel de kop als de regel", () => {
  const payload = buildPurchaseInvoicePayload(
    input({ project: "3273", costCenter: "Main - OSB" }),
    NOW,
  );
  assert.equal(payload.project, "3273");
  assert.equal(payload.cost_center, "Main - OSB");
  const [item] = payload.items as Record<string, unknown>[];
  assert.equal(item.project, "3273");
  assert.equal(item.cost_center, "Main - OSB");
});

test("lege optionele velden worden weggelaten, niet als lege string gestuurd", () => {
  const payload = buildPurchaseInvoicePayload(
    input({ billNo: "", billDate: undefined, project: "", costCenter: "" }),
    NOW,
  );
  for (const key of ["bill_no", "bill_date", "project", "cost_center"]) {
    assert.equal(key in payload, false, key);
  }
});

test("bedrag wordt op centen afgerond", () => {
  const payload = buildPurchaseInvoicePayload(input({ amount: 1991.2549 }), NOW);
  const [item] = payload.items as Record<string, unknown>[];
  assert.equal(item.rate, 1991.25);
});

test("een lange omschrijving knakt item_name, niet de insert", () => {
  const long = "x".repeat(200);
  const [item] = buildPurchaseInvoicePayload(input({ description: long }), NOW)
    .items as Record<string, unknown>[];
  assert.equal((item.item_name as string).length, 140);
  assert.equal(item.description, long, "de volledige tekst blijft in description");
});

test("validatie benoemt elk ontbrekend veld", () => {
  assert.deepEqual(validatePurchaseInvoiceInput(input()), []);
  assert.deepEqual(
    validatePurchaseInvoiceInput(input({ supplier: "  ", expenseAccount: "" })).sort(),
    ["expenseAccount", "supplier"],
  );
  assert.deepEqual(validatePurchaseInvoiceInput(input({ amount: 0 })), ["amount"]);
  assert.deepEqual(validatePurchaseInvoiceInput(input({ postingDate: "27-08-2026" })), ["postingDate"]);
  assert.deepEqual(validatePurchaseInvoiceInput(input({ billDate: "nope" })), ["billDate"]);
});

test("bouwen zonder verplichte velden gooit in plaats van half te versturen", () => {
  assert.throws(
    () => buildPurchaseInvoicePayload(input({ creditTo: "" }), NOW),
    /creditTo/,
  );
});

test("todayIso gebruikt de lokale datum, niet UTC", () => {
  // 23:30 lokale tijd op 31 december is in UTC al 1 januari; de boeking hoort
  // op 31 december te vallen.
  assert.equal(todayIso(new Date(2026, 11, 31, 23, 30, 0)), "2026-12-31");
});
