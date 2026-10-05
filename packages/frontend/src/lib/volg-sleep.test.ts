/**
 * Tests voor het slepen aan een rand (kolombreedte, voorbeeldpaneel).
 *
 * Wat hier fout ging: liet je de muisknop los boven de pdf-preview (een
 * iframe), dan kreeg de app dat loslaten nooit te zien en bleef de rand je
 * muis volgen. `knopLosgelaten` is de vangst daarvoor: elke beweging zonder
 * ingedrukte linkerknop betekent dat het slepen al voorbij is.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { knopLosgelaten } from "./volg-sleep.ts";

test("knopLosgelaten: zonder linkerknop is het slepen voorbij", () => {
  assert.equal(knopLosgelaten(0), true);
  // Alleen de rechter- of middelste knop telt niet als slepen.
  assert.equal(knopLosgelaten(2), true);
  assert.equal(knopLosgelaten(4), true);
});

test("knopLosgelaten: met de linkerknop ingedrukt loopt het slepen door", () => {
  assert.equal(knopLosgelaten(1), false);
  // Linker- plus rechterknop tegelijk: de linker is nog ingedrukt.
  assert.equal(knopLosgelaten(3), false);
});
