import { test } from "node:test";
import assert from "node:assert/strict";
import { formatUren } from "./taak-uren.ts";

test("hele uren zonder decimaal, halve uren mét", () => {
  assert.equal(formatUren(8), "8 u");
  assert.equal(formatUren(40), "40 u");
  assert.equal(formatUren(1.5), "1,5 u");
  // Anders leest een half uur als "1 u" en dat is geen afronding maar een fout.
  assert.equal(formatUren(0.5), "0,5 u");
});

test("niets te tonen als er niets begroot is", () => {
  // De kaart blijft dan leeg in plaats van "0 u" te zeggen: ruim duizend van
  // de taken hebben geen begroting, en die willen we niet allemaal zien.
  assert.equal(formatUren(0), "");
  assert.equal(formatUren(undefined), "");
  assert.equal(formatUren(null), "");
  assert.equal(formatUren(Number.NaN), "");
  assert.equal(formatUren(-3), "");
});
