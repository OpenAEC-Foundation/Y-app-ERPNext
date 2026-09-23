import { test } from "node:test";
import assert from "node:assert/strict";
import {
  btwOverzicht,
  btwRegelsVoorBoeking,
  kiesBtwSjabloon,
  tariefVanRegels,
  type BtwRegel,
  type BtwSjabloon,
} from "./purchase-invoice-btw.ts";

/** De sjablonen van 3BM Bouwtechniek zoals ze op de instance staan. */
const BOUWTECHNIEK: BtwSjabloon[] = [
  { name: "Abroad VAT - 0% - 3" },
  { name: "Netherlands VAT 0% - 3" },
  { name: "Netherlands VAT 21% - 3", is_default: 1 },
  { name: "Netherlands VAT 21% included - 3" },
  { name: "Netherlands VAT 9% - 3" },
  { name: "Netherlands VAT Abroad 0% - 3" },
  { name: "Netherlands VAT shifted 21% - 3" },
  { name: "NL Reverse Charge 21%VAT - 3" },
];

const REGEL_21: BtwRegel = {
  charge_type: "On Net Total", account_head: "VAT 21% - 3", description: "VAT 21%", rate: 21,
  category: "Total", add_deduct_tax: "Add", included_in_print_rate: 0,
};

test("kiesBtwSjabloon: het herkende tarief wint, zonder de inbegrepen- of buitenlandvariant", () => {
  assert.equal(kiesBtwSjabloon(BOUWTECHNIEK, { tarief: 9 }), "Netherlands VAT 9% - 3");
  assert.equal(kiesBtwSjabloon(BOUWTECHNIEK, { tarief: 21 }), "Netherlands VAT 21% - 3");
  assert.equal(kiesBtwSjabloon(BOUWTECHNIEK, { tarief: 0 }), "Netherlands VAT 0% - 3");
});

test("kiesBtwSjabloon: btw verlegd kiest het verleggingssjabloon", () => {
  assert.equal(kiesBtwSjabloon(BOUWTECHNIEK, { verlegd: true }), "Netherlands VAT shifted 21% - 3");
});

test("kiesBtwSjabloon: niets herkend, of geen passend sjabloon, geeft het standaardsjabloon", () => {
  assert.equal(kiesBtwSjabloon(BOUWTECHNIEK, undefined), "Netherlands VAT 21% - 3");
  assert.equal(kiesBtwSjabloon(BOUWTECHNIEK, { tarief: 6 }), "Netherlands VAT 21% - 3");
  const zonderVerlegd = BOUWTECHNIEK.filter((s) => !/shifted|reverse/i.test(s.name));
  assert.equal(kiesBtwSjabloon(zonderVerlegd, { verlegd: true }), "Netherlands VAT 21% - 3");
  assert.equal(kiesBtwSjabloon([], { tarief: 21 }), undefined);
});

test("tariefVanRegels: optellen over het netto, verlegging telt als nul", () => {
  assert.equal(tariefVanRegels([REGEL_21]), 21);
  assert.equal(tariefVanRegels([
    { ...REGEL_21, rate: -21 },
    { ...REGEL_21, account_head: "Non-Deductible VAT Expense - 3", rate: 21 },
  ]), 0);
  assert.equal(tariefVanRegels([{ ...REGEL_21, add_deduct_tax: "Deduct" }]), 0);
  assert.equal(tariefVanRegels([]), 0);
});

test("btwOverzicht: exclusief rekent de btw erbij, inclusief haalt hem eruit", () => {
  assert.deepEqual(btwOverzicht(100, 21, false), { netto: 100, btw: 21, totaal: 121 });
  assert.deepEqual(btwOverzicht(121, 21, true), { netto: 100, btw: 21, totaal: 121 });
  assert.deepEqual(btwOverzicht(89.21, 21, true), { netto: 73.73, btw: 15.48, totaal: 89.21 });
  assert.deepEqual(btwOverzicht(50, 0, true), { netto: 50, btw: 0, totaal: 50 });
});

test("btwRegelsVoorBoeking: bij inclusief staan de netto-regels op inbegrepen", () => {
  const inclusief = btwRegelsVoorBoeking([REGEL_21], true);
  assert.equal(inclusief[0].included_in_print_rate, 1);
  assert.equal(inclusief[0].account_head, "VAT 21% - 3");
  assert.equal(inclusief[0].rate, 21);
  const exclusief = btwRegelsVoorBoeking([{ ...REGEL_21, included_in_print_rate: 1 }], false);
  assert.equal(exclusief[0].included_in_print_rate, 0);
  // Een regel op een ander grondslag kan ERPNext niet als inbegrepen rekenen.
  const anders = btwRegelsVoorBoeking([{ ...REGEL_21, charge_type: "Actual" }], true);
  assert.equal(anders[0].included_in_print_rate, 0);
});
