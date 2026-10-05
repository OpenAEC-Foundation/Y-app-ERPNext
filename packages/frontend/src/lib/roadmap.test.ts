import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eindeVanMaand,
  groepeerPerMaand,
  isAchterstand,
  isKlaar,
  vulEigenarenAan,
  maandenTussen,
  voortgang,
  type Mijlpaal,
} from "./roadmap.ts";

function mp(overrides: Partial<Mijlpaal> = {}): Mijlpaal {
  return {
    name: "TASK-1",
    subject: "IFC-CAD V1",
    status: "Open",
    type: "IFC-CAD",
    exp_end_date: "2026-10-31",
    eigenaren: [],
    ...overrides,
  };
}

test("maandenTussen: alle maanden van start tot en met eind", () => {
  assert.deepEqual(maandenTussen("2026-10-01", "2026-12-31"), ["2026-10", "2026-11", "2026-12"]);
  assert.deepEqual(maandenTussen("2026-11-15", "2027-01-02"), ["2026-11", "2026-12", "2027-01"]);
});

test("maandenTussen: lege of omgedraaide periode geeft niets", () => {
  assert.deepEqual(maandenTussen("", "2026-12-31"), []);
  assert.deepEqual(maandenTussen("2026-12-01", "2026-10-01"), []);
});

test("eindeVanMaand: de laatste dag, ook in februari", () => {
  assert.equal(eindeVanMaand("2026-10"), "2026-10-31");
  assert.equal(eindeVanMaand("2026-11"), "2026-11-30");
  assert.equal(eindeVanMaand("2028-02"), "2028-02-29");
});

test("groepeerPerMaand: op deadline in de juiste kolom, gesorteerd op datum", () => {
  const g = groepeerPerMaand(
    [
      mp({ name: "b", exp_end_date: "2026-10-31" }),
      mp({ name: "a", exp_end_date: "2026-10-15" }),
      mp({ name: "c", exp_end_date: "2026-11-30" }),
    ],
    ["2026-10", "2026-11", "2026-12"],
  );
  assert.deepEqual(g["2026-10"].map((m) => m.name), ["a", "b"]);
  assert.deepEqual(g["2026-11"].map((m) => m.name), ["c"]);
  assert.deepEqual(g["2026-12"], []);
});

test("groepeerPerMaand: zonder deadline, buiten de periode of geannuleerd valt weg", () => {
  const g = groepeerPerMaand(
    [
      mp({ name: "geen", exp_end_date: "" }),
      mp({ name: "later", exp_end_date: "2027-03-01" }),
      mp({ name: "weg", status: "Cancelled" }),
    ],
    ["2026-10"],
  );
  assert.deepEqual(g["2026-10"], []);
});

test("isKlaar: alleen Completed telt als klaar", () => {
  assert.equal(isKlaar("Completed"), true);
  assert.equal(isKlaar("Open"), false);
  assert.equal(isKlaar("Working"), false);
});

test("voortgang: klaar tegen totaal", () => {
  assert.deepEqual(
    voortgang([mp({ status: "Completed" }), mp({ status: "Open" }), mp({ status: "Working" })]),
    { klaar: 1, totaal: 3 },
  );
  assert.deepEqual(voortgang([]), { klaar: 0, totaal: 0 });
});

test("isAchterstand: open en de deadline is voorbij", () => {
  assert.equal(isAchterstand(mp({ exp_end_date: "2026-10-31" }), "2026-11-01"), true);
  assert.equal(isAchterstand(mp({ exp_end_date: "2026-10-31" }), "2026-10-31"), false);
  assert.equal(isAchterstand(mp({ status: "Completed", exp_end_date: "2026-10-01" }), "2026-11-01"), false);
  assert.equal(isAchterstand(mp({ exp_end_date: "" }), "2026-11-01"), false);
});

test("vulEigenarenAan: een afgevinkte mijlpaal houdt zijn eigenaar via de afgesloten toewijzing", () => {
  const uit = vulEigenarenAan(
    [mp({ name: "T1", status: "Completed", eigenaren: [] }), mp({ name: "T2", eigenaren: ["jan@x"] })],
    [
      { reference_name: "T1", allocated_to: "bjorn@x", status: "Closed" },
      { reference_name: "T1", allocated_to: "bjorn@x", status: "Closed" },
      { reference_name: "T1", allocated_to: "weg@x", status: "Cancelled" },
      { reference_name: "T2", allocated_to: "ander@x", status: "Closed" },
    ],
  );
  assert.deepEqual(uit.find((m) => m.name === "T1")?.eigenaren, ["bjorn@x"]);
  // wie al een actuele eigenaar heeft, houdt die en krijgt er geen oude bij
  assert.deepEqual(uit.find((m) => m.name === "T2")?.eigenaren, ["jan@x"]);
});
