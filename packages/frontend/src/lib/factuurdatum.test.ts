import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bepaalFactuurdatum, bewaarFactuurdatum, isIsoDatum, laatsteDagVorigeMaand, standaardFactuurdatum,
} from "./factuurdatum.ts";

test("begin oktober factureer je op 30 september", () => {
  assert.equal(standaardFactuurdatum(new Date(2026, 9, 1)), "2026-09-30");
  assert.equal(standaardFactuurdatum(new Date(2026, 9, 15)), "2026-09-30");
});

test("na de vijftiende is het de dag zelf", () => {
  assert.equal(standaardFactuurdatum(new Date(2026, 9, 16)), "2026-10-16");
});

test("de laatste dag van de vorige maand klopt ook over de jaargrens en in februari", () => {
  assert.equal(laatsteDagVorigeMaand(new Date(2027, 0, 3)), "2026-12-31");
  assert.equal(laatsteDagVorigeMaand(new Date(2028, 2, 2)), "2028-02-29");
});

test("een eigen keuze geldt de rest van de maand", () => {
  const nu = new Date(2026, 9, 1);
  const bewaard = bewaarFactuurdatum("2026-09-29", nu);
  assert.equal(bepaalFactuurdatum(bewaard, new Date(2026, 9, 20)), "2026-09-29");
  assert.equal(bepaalFactuurdatum(bewaard, new Date(2026, 10, 2)), "2026-10-31");
});

test("rommel in de opslag geeft de standaard", () => {
  const nu = new Date(2026, 9, 1);
  assert.equal(bepaalFactuurdatum(null, nu), "2026-09-30");
  assert.equal(bepaalFactuurdatum("2026-09-01", nu), "2026-09-30");
  assert.equal(bepaalFactuurdatum({ datum: "2026-02-31", gekozenOp: "2026-10-01" }, nu), "2026-09-30");
  assert.ok(!isIsoDatum("30-09-2026"));
  assert.ok(isIsoDatum("2026-09-30"));
});
