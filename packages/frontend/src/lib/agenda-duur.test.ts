import test from "node:test";
import assert from "node:assert/strict";
import { duurLabel, duurOpties, duurTussen, eindBijNieuweStart, eindNaDuur, naarMinuten, naarTijd } from "./agenda-duur.ts";

test("tijd naar minuten en terug", () => {
  assert.equal(naarMinuten("13:30"), 810);
  assert.equal(naarMinuten("9:05"), 545);
  assert.equal(naarMinuten("25:00"), null);
  assert.equal(naarTijd(810), "13:30");
});

test("duur tussen begin en eind", () => {
  assert.equal(duurTussen("13:00", "14:30"), 90);
  assert.equal(duurTussen("14:00", "13:00"), 0);
});

test("een gekozen duur zet de eindtijd", () => {
  assert.equal(eindNaDuur("13:00", 45), "13:45");
  assert.equal(eindNaDuur("13:00", 120), "15:00");
});

test("de eindtijd gaat niet voorbij middernacht", () => {
  assert.equal(eindNaDuur("23:00", 120), "23:59");
});

test("begintijd verschuiven houdt de duur gelijk", () => {
  assert.equal(eindBijNieuweStart("13:00", "14:30", "15:00"), "16:30");
});

test("zonder geldige duur schuift de afspraak met een uur", () => {
  assert.equal(eindBijNieuweStart("13:00", "12:00", "15:00"), "16:00");
});

test("labels", () => {
  assert.equal(duurLabel(30), "30 min");
  assert.equal(duurLabel(60), "1 uur");
  assert.equal(duurLabel(90), "1 uur 30 min");
});

test("een afwijkende duur komt in de keuzelijst", () => {
  assert.ok(duurOpties(50).includes(50));
  assert.deepEqual(duurOpties(60).filter((d) => d === 60), [60]);
});
