import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dubbelSleutel,
  geboekteStand,
  koppelGeboekteFacturen,
  normaliseerFactuurnummer,
  vindDubbeleInkoopfacturen,
  type BestaandeInkoopfactuur,
} from "./purchase-invoice-duplicates.ts";

/** Een ingediende factuur zoals de instance hem teruggeeft (TransIP, echte dubbeling). */
function factuur(overrides: Partial<BestaandeInkoopfactuur> = {}): BestaandeInkoopfactuur {
  return {
    name: "PI-2606-00012",
    supplier: "TransIP BV",
    bill_no: "F0000.2606.0010.2260",
    bill_date: "2026-06-01",
    posting_date: "2026-06-03",
    net_total: 49.97,
    grand_total: 60.46,
    docstatus: 1,
    status: "Paid",
    ...overrides,
  };
}

/** De betaalde factuur van Verbonden BV die met de hand in ERPNext geboekt is. */
const VERBONDEN = factuur({
  name: "PI-267-00109", supplier: "Verbonden BV", bill_no: "2018284392",
  bill_date: "2026-08-03", posting_date: "2026-08-03", net_total: 73.73, grand_total: 89.21,
});

test("normaliseerFactuurnummer negeert spaties en hoofdletters", () => {
  assert.equal(normaliseerFactuurnummer(" F0000 2606.0010 "), "f00002606.0010");
  assert.equal(normaliseerFactuurnummer(undefined), "");
  assert.equal(normaliseerFactuurnummer(null), "");
});

test("zelfde factuurnummer bij dezelfde leverancier is een dubbele", () => {
  const uit = vindDubbeleInkoopfacturen(
    { supplier: "TransIP BV", billNo: "f0000.2606.0010.2260 " },
    [factuur(), factuur({ name: "PI-2607-00001", bill_no: "F0000.2607.0010.1111" })],
  );
  assert.deepEqual(uit.map((d) => [d.factuur.name, d.redenen]), [["PI-2606-00012", ["factuurnummer"]]]);
});

test("een leeg factuurnummer matcht niet met facturen zonder nummer", () => {
  const uit = vindDubbeleInkoopfacturen(
    { supplier: "TransIP BV", billNo: "" },
    [factuur({ bill_no: null }), factuur({ name: "PI-2", bill_no: "" })],
  );
  assert.deepEqual(uit, []);
});

test("een geannuleerde factuur telt nooit als dubbele", () => {
  const uit = vindDubbeleInkoopfacturen(
    { supplier: "TransIP BV", billNo: "F0000.2606.0010.2260" },
    [factuur({ docstatus: 2, status: "Cancelled" })],
    [factuur({ docstatus: 2, status: "Cancelled" })],
  );
  assert.deepEqual(uit, []);
});

test("een kort nummer bij een andere leverancier telt niet", () => {
  const uit = vindDubbeleInkoopfacturen(
    { supplier: "Verbonden BV", billNo: "7015" },
    [factuur({ bill_no: "7015" })],
  );
  assert.deepEqual(uit, []);
});

test("een lang nummer telt ook als de herkende leverancier ernaast zit", () => {
  // De herkenning las het adresblok van de factuur en gokte de eigen coöperatie.
  const uit = vindDubbeleInkoopfacturen(
    { supplier: "3BM Coöperatie U.A.", billNo: "2018284392", billDate: "2026-08-03", amount: 89.21 },
    [VERBONDEN],
  );
  assert.deepEqual(uit.map((d) => [d.factuur.name, d.redenen]), [["PI-267-00109", ["factuurnummer"]]]);
});

test("zonder gekozen leverancier telt hetzelfde nummer bij elke leverancier", () => {
  const uit = vindDubbeleInkoopfacturen(
    { supplier: "", billNo: "2018284392", billDate: "2026-08-11" },
    [VERBONDEN],
  );
  assert.deepEqual(uit.map((d) => [d.factuur.name, d.redenen]), [["PI-267-00109", ["factuurnummer"]]]);
});

test("zelfde bedrag op dezelfde factuurdatum is een dubbele, netto of bruto", () => {
  const netto = vindDubbeleInkoopfacturen(
    { supplier: "TransIP BV", billDate: "2026-06-01", amount: 49.97 },
    [factuur({ bill_no: null })],
  );
  assert.deepEqual(netto.map((d) => d.redenen), [["bedrag-datum"]]);

  const bruto = vindDubbeleInkoopfacturen(
    { supplier: "TransIP BV", billDate: "2026-06-01", amount: 60.46 },
    [factuur({ bill_no: null })],
  );
  assert.deepEqual(bruto.map((d) => d.redenen), [["bedrag-datum"]]);
});

test("zelfde bedrag en datum bij een andere leverancier is geen dubbele", () => {
  const uit = vindDubbeleInkoopfacturen(
    { supplier: "Vimexx", billDate: "2026-06-01", amount: 49.97 },
    [factuur({ bill_no: null })],
  );
  assert.deepEqual(uit, []);
});

test("een abonnement met elke maand hetzelfde bedrag is geen dubbele", () => {
  const uit = vindDubbeleInkoopfacturen(
    { supplier: "TransIP BV", billNo: "F0000.2607.0010.9999", billDate: "2026-07-01", amount: 49.97 },
    [factuur()],
  );
  assert.deepEqual(uit, []);
});

test("zonder bedrag of datum geen bedrag-datum-treffer", () => {
  const zonderBedrag = vindDubbeleInkoopfacturen(
    { supplier: "TransIP BV", billDate: "2026-06-01", amount: Number.NaN },
    [factuur({ bill_no: null })],
  );
  const zonderDatum = vindDubbeleInkoopfacturen(
    { supplier: "TransIP BV", amount: 49.97 },
    [factuur({ bill_no: null })],
  );
  assert.deepEqual([zonderBedrag, zonderDatum], [[], []]);
});

test("dezelfde pdf telt ook bij een andere leverancier, en redenen worden samengevoegd", () => {
  const elders = factuur({ name: "PI-2609-00633", supplier: "Vimexx", bill_no: "V-1", posting_date: "2026-07-08" });
  const uit = vindDubbeleInkoopfacturen(
    { supplier: "TransIP BV", billNo: "F0000.2606.0010.2260" },
    [factuur()],
    [elders, factuur()],
  );
  assert.deepEqual(
    uit.map((d) => [d.factuur.name, d.redenen]),
    [["PI-2606-00012", ["factuurnummer", "bijlage"]], ["PI-2609-00633", ["bijlage"]]],
  );
});

test("sterkste reden eerst, daarna de nieuwste boeking", () => {
  const uit = vindDubbeleInkoopfacturen(
    { supplier: "TransIP BV", billNo: "X-1", billDate: "2026-06-01", amount: 49.97 },
    [
      factuur({ name: "PI-OUD", bill_no: null, posting_date: "2026-06-02" }),
      factuur({ name: "PI-NIEUW", bill_no: null, posting_date: "2026-06-05" }),
      factuur({ name: "PI-NUMMER", bill_no: "x-1", bill_date: "2026-05-01", posting_date: "2026-05-02" }),
    ],
  );
  assert.deepEqual(uit.map((d) => d.factuur.name), ["PI-NUMMER", "PI-NIEUW", "PI-OUD"]);
});

test("geboekteStand: concept, betaald, deels betaald, en de rest is ingeboekt", () => {
  assert.equal(geboekteStand(factuur({ docstatus: 0, status: "Draft" })), "concept");
  assert.equal(geboekteStand(factuur({ status: "Paid" })), "betaald");
  assert.equal(geboekteStand(factuur({ status: "Partly Paid" })), "deels-betaald");
  assert.equal(geboekteStand(factuur({ status: "Unpaid" })), "ingeboekt");
  assert.equal(geboekteStand(factuur({ status: "Overdue" })), "ingeboekt");
});

test("koppelGeboekteFacturen: mail zonder herkende leverancier vindt de betaalde factuur", () => {
  const uit = koppelGeboekteFacturen(
    [{ naam: "4g3t7n84af", billNo: "2018284392" }, { naam: "andere-mail", billNo: "999999" }],
    [VERBONDEN],
  );
  assert.deepEqual([...uit].map(([mail, f]) => [mail, f.name]), [["4g3t7n84af", "PI-267-00109"]]);
});

test("koppelGeboekteFacturen: een verkeerd gegokte leverancier verbergt de betaalde factuur niet", () => {
  // De losse mailweergave las "3BM Coöperatie U.A." uit het adresblok van de pdf.
  const uit = koppelGeboekteFacturen(
    [{ naam: "4g3t7n84af", billNo: "2018284392", supplier: "3BM Coöperatie U.A." }],
    [VERBONDEN],
  );
  assert.equal(uit.get("4g3t7n84af")?.name, "PI-267-00109");
});

test("koppelGeboekteFacturen: een kort nummer telt alleen bij de herkende leverancier", () => {
  const facturen = [factuur({ bill_no: "1234" })];
  assert.equal(koppelGeboekteFacturen([{ naam: "m1", billNo: "1234" }], facturen).size, 0);
  assert.equal(koppelGeboekteFacturen([{ naam: "m1", billNo: "1234", supplier: "Vimexx" }], facturen).size, 0);
  assert.equal(koppelGeboekteFacturen([{ naam: "m1", billNo: "1234", supplier: "TransIP BV" }], facturen).size, 1);
});

test("koppelGeboekteFacturen: de factuur van de herkende leverancier gaat voor", () => {
  const uit = koppelGeboekteFacturen(
    [{ naam: "m1", billNo: "2510-00150", supplier: "TransIP BV" }],
    [
      factuur({ name: "PI-ELDERS", supplier: "Vimexx", bill_no: "2510-00150", status: "Paid" }),
      factuur({ name: "PI-EIGEN", supplier: "TransIP BV", bill_no: "2510-00150", docstatus: 0, status: "Draft" }),
    ],
  );
  assert.equal(uit.get("m1")?.name, "PI-EIGEN");
});

test("koppelGeboekteFacturen: bij een echte dubbeling telt de betaalde, geannuleerde nooit", () => {
  const uit = koppelGeboekteFacturen(
    [{ naam: "m1", billNo: "F20260301", supplier: "LC ICT Support" }],
    [
      factuur({ name: "PI-GEANNULEERD", supplier: "LC ICT Support", bill_no: "F20260301", docstatus: 2, status: "Cancelled" }),
      factuur({ name: "PI-CONCEPT", supplier: "LC ICT Support", bill_no: "F20260301", docstatus: 0, status: "Draft", posting_date: "2026-09-10" }),
      factuur({ name: "PI-BETAALD", supplier: "LC ICT Support", bill_no: "F20260301", status: "Paid", posting_date: "2026-09-01" }),
    ],
  );
  assert.equal(uit.get("m1")?.name, "PI-BETAALD");
  assert.equal(koppelGeboekteFacturen(
    [{ naam: "m1", billNo: "F20260301" }],
    [factuur({ bill_no: "F20260301", docstatus: 2 })],
  ).size, 0);
});

test("koppelGeboekteFacturen: de geopende mail (laatste kandidaat) gaat voor op de lijstversie", () => {
  const facturen = [factuur({ bill_no: "1234" })];
  // In de lijst herkend bij TransIP; geopend blijkt het een andere leverancier.
  const uit = koppelGeboekteFacturen(
    [
      { naam: "m1", billNo: "1234", supplier: "TransIP BV" },
      { naam: "m1", billNo: "1234", supplier: "Vimexx" },
    ],
    facturen,
  );
  assert.equal(uit.has("m1"), false);
});

test("dubbelSleutel hangt niet af van de volgorde", () => {
  const a = { factuur: factuur({ name: "B" }), redenen: [] };
  const b = { factuur: factuur({ name: "A" }), redenen: [] };
  assert.equal(dubbelSleutel([a, b]), dubbelSleutel([b, a]));
  assert.equal(dubbelSleutel([]), "");
});
