import { test } from "node:test";
import assert from "node:assert/strict";
import { STANDAARD_AFDRUKFORMAAT, kiesAfdrukformaten } from "./afdrukformaat.ts";

test("kiesAfdrukformaten: de formaten van de site, op naam", () => {
  assert.deepEqual(kiesAfdrukformaten(["Factuur met urenstaat", "Factuur"], ""), [
    "Factuur",
    "Factuur met urenstaat",
  ]);
});

test("kiesAfdrukformaten: het ingestelde formaat staat vooraan", () => {
  assert.deepEqual(kiesAfdrukformaten(["Factuur", "Factuur met urenstaat", "Creditnota"], "Factuur met urenstaat"), [
    "Factuur met urenstaat",
    "Creditnota",
    "Factuur",
  ]);
});

test("kiesAfdrukformaten: een ingesteld formaat dat niet meer bestaat telt niet mee", () => {
  assert.deepEqual(kiesAfdrukformaten(["Factuur"], "Verwijderd formaat"), ["Factuur"]);
});

test("kiesAfdrukformaten: een site zonder eigen formaten valt terug op het standaardformaat", () => {
  assert.deepEqual(kiesAfdrukformaten([], ""), [STANDAARD_AFDRUKFORMAAT]);
  assert.deepEqual(kiesAfdrukformaten([], "Verwijderd formaat"), [STANDAARD_AFDRUKFORMAAT]);
});

test("kiesAfdrukformaten: dubbele en lege namen vallen weg", () => {
  assert.deepEqual(kiesAfdrukformaten(["Factuur", "", "Factuur", "  "], ""), ["Factuur"]);
});
