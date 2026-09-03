import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPurchaseInvoicePayload,
  dueDateFromTerms,
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

/* ─────────────────────── Vervaldatum uit de termijn ──────────────────── */

test("dueDateFromTerms rekent vanaf de factuurdatum, niet vanaf de boekdatum", () => {
  // De echte factuur waarop dit stukliep: 30 juli, termijn 21 dagen, pas op
  // 3 september geboekt. ERPNext mikte op 24 september en stond maximaal
  // 20 augustus toe, en weigerde daarom de hele boeking.
  assert.equal(
    dueDateFromTerms("2026-07-30", [{ due_date_based_on: "Day(s) after invoice date", credit_days: 21 }]),
    "2026-08-20",
  );
});

test("dueDateFromTerms: dagen na het einde van de factuurmaand", () => {
  assert.equal(
    dueDateFromTerms("2026-07-30", [
      { due_date_based_on: "Day(s) after the end of the invoice month", credit_days: 14 },
    ]),
    "2026-08-14",
  );
});

test("dueDateFromTerms: maanden na het einde van de factuurmaand", () => {
  assert.equal(
    dueDateFromTerms("2026-07-30", [
      { due_date_based_on: "Month(s) after the end of the invoice month", credit_months: 1 },
    ]),
    "2026-08-31",
  );
});

test("dueDateFromTerms neemt de laatste termijn — zo haalt ERPNext hem ook uit het betaalschema", () => {
  assert.equal(
    dueDateFromTerms("2026-07-30", [
      { due_date_based_on: "Day(s) after invoice date", credit_days: 14 },
      { due_date_based_on: "Day(s) after invoice date", credit_days: 30 },
    ]),
    "2026-08-29",
  );
});

test("dueDateFromTerms zwijgt wanneer er niets te rekenen is", () => {
  const termijn = [{ due_date_based_on: "Day(s) after invoice date", credit_days: 21 }];
  assert.equal(dueDateFromTerms(undefined, termijn), undefined);
  assert.equal(dueDateFromTerms("30-07-2026", termijn), undefined);
  assert.equal(dueDateFromTerms("2026-07-30", []), undefined);
  assert.equal(dueDateFromTerms("2026-07-30", undefined), undefined);
  // Onbekende grondslag: dan laten we ERPNext het bepalen in plaats van gokken.
  assert.equal(dueDateFromTerms("2026-07-30", [{ due_date_based_on: "Iets nieuws", credit_days: 5 }]), undefined);
});

test("de vervaldatum gaat als due_date mee in de payload", () => {
  const payload = buildPurchaseInvoicePayload(input({ dueDate: "2026-08-20" }), NOW);
  assert.equal(payload.due_date, "2026-08-20");
  // Zonder vervaldatum blijft het veld weg, zodat ERPNext hem zelf bepaalt.
  assert.equal("due_date" in buildPurchaseInvoicePayload(input(), NOW), false);
});
