import { test } from "node:test";
import assert from "node:assert/strict";
import {
  soortVan,
  telWerkvoorraad,
  toonUren,
  type VoorraadTaak,
} from "./werkvoorraad.ts";

/**
 * Tests voor de werkvoorraad.
 *
 * De indeling is de hele vraag. Twee dingen gaan hier stil fout: afgerond werk
 * dat blijft meetellen (dan plan je op een voorraad die er niet is), en
 * wachtend werk dat als oppakbaar wordt geteld (dan plan je op capaciteit die
 * op iemand anders wacht). Aan een getal op het scherm zie je geen van beide.
 */

function taak(over: Partial<VoorraadTaak> = {}): VoorraadTaak {
  return { name: "T", workflow_state: "Open", expected_time: 8, actual_time: 0, ...over };
}

test("de workflow wint van de ERPNext-status", () => {
  // Op deze installatie staan honderden taken op `Overdue` terwijl hun
  // workflow al `Completed` is. Kijken naar `status` zou afgerond werk als
  // voorraad tellen.
  assert.equal(soortVan({ name: "T", status: "Overdue", workflow_state: "Completed" }), "klaar");
  assert.equal(soortVan({ name: "T", status: "Working", workflow_state: "On Hold" }), "wacht");
});

test("zonder workflow telt de gewone status", () => {
  assert.equal(soortVan({ name: "T", status: "Working" }), "actief");
  assert.equal(soortVan({ name: "T", status: "Completed" }), "klaar");
  assert.equal(soortVan({ name: "T", status: "Pending Review" }), "wacht");
});

test("wachtend werk is geen oppakbaar werk", () => {
  for (const stand of ["On Hold", "Information required", "Pending Review Intern",
                       "Pending Review Extern", "to discussed"]) {
    assert.equal(soortVan({ name: "T", workflow_state: stand }), "wacht", stand);
  }
});

test("een onbekende stand telt als oppakbaar, niet als verdwenen", () => {
  // Een stand die later wordt toegevoegd hoort zichtbaar te blijven. Hem
  // stilzwijgend weglaten maakt werk onvindbaar zonder dat iemand het merkt.
  assert.equal(soortVan({ name: "T", workflow_state: "Wachten op tekening" }), "actief");
  assert.equal(soortVan({ name: "T" }), "actief");
});

test("hoofdletters en spaties doen er niet toe", () => {
  assert.equal(soortVan({ name: "T", workflow_state: "  ON HOLD " }), "wacht");
});

test("de twee hopen worden apart geteld", () => {
  const uit = telWerkvoorraad([
    taak({ workflow_state: "Open", expected_time: 10 }),
    taak({ workflow_state: "Working", expected_time: 6 }),
    taak({ workflow_state: "On Hold", expected_time: 40 }),
    taak({ workflow_state: "Completed", expected_time: 100 }),
    taak({ workflow_state: "Cancelled", expected_time: 100 }),
  ]);
  assert.equal(uit.actief.taken, 2);
  assert.equal(uit.actief.begroot, 16);
  assert.equal(uit.wacht.taken, 1);
  assert.equal(uit.wacht.begroot, 40);
});

test("resterend werk is begroot min geboekt", () => {
  const uit = telWerkvoorraad([taak({ expected_time: 10, actual_time: 4 })]);
  assert.equal(uit.actief.begroot, 10);
  assert.equal(uit.actief.geboekt, 4);
  assert.equal(uit.actief.resterend, 6);
});

test("meer geboekt dan begroot levert geen negatieve voorraad op", () => {
  // Anders poetst één uitgelopen taak het openstaande werk van andere taken weg.
  const uit = telWerkvoorraad([
    taak({ expected_time: 4, actual_time: 30 }),
    taak({ expected_time: 10, actual_time: 0 }),
  ]);
  assert.equal(uit.actief.resterend, 10);
});

test("taken zonder schatting tellen als taak, niet als uren", () => {
  // Op deze installatie heeft het merendeel geen schatting; een urentotaal
  // zonder dit getal erbij is misleidend.
  const uit = telWerkvoorraad([
    taak({ expected_time: 0 }),
    taak({ expected_time: undefined }),
    taak({ expected_time: 8 }),
  ]);
  assert.equal(uit.actief.taken, 3);
  assert.equal(uit.actief.begroot, 8);
  assert.equal(uit.actief.zonderSchatting, 2);
});

test("onzin in de urenvelden telt als nul", () => {
  const uit = telWerkvoorraad([taak({ expected_time: -5 }), taak({ expected_time: Number.NaN })]);
  assert.equal(uit.actief.begroot, 0);
  assert.equal(uit.actief.zonderSchatting, 2);
});

test("de uitsplitsing staat op uren aflopend en laat afgerond werk weg", () => {
  const uit = telWerkvoorraad([
    taak({ workflow_state: "Open", expected_time: 5 }),
    taak({ workflow_state: "On Hold", expected_time: 20 }),
    taak({ workflow_state: "Completed", expected_time: 99 }),
  ]);
  assert.deepEqual(uit.perStand.map((r) => r.stand), ["On Hold", "Open"]);
  assert.equal(uit.perStand.some((r) => r.stand === "Completed"), false);
});

test("lege invoer geeft nullen, geen fout", () => {
  const uit = telWerkvoorraad([]);
  assert.equal(uit.actief.taken, 0);
  assert.equal(uit.wacht.begroot, 0);
  assert.deepEqual(uit.perStand, []);
});

test("uren worden leesbaar getoond", () => {
  assert.equal(toonUren(675), "675");
  assert.equal(toonUren(16.25), "16,3");
  assert.equal(toonUren(0), "0");
  // Geen "-0" op het scherm.
  assert.equal(toonUren(-0.04), "0");
});
