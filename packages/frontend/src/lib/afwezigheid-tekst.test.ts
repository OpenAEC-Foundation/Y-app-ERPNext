import test from "node:test";
import assert from "node:assert/strict";
import { afwezigZin, datumInWoorden, isStandaardTekst, standaardTekst } from "./afwezigheid-tekst.ts";

test("datums in woorden", () => {
  assert.equal(datumInWoorden("2026-09-28"), "28 september 2026");
  assert.equal(datumInWoorden("2026-01-01"), "1 januari 2026");
  assert.equal(datumInWoorden(""), "");
  assert.equal(datumInWoorden("28-09-2026"), "");
});

test("de zin past zich aan aan wat ingevuld is", () => {
  assert.equal(afwezigZin("2026-09-28", "2026-10-05"), "Ik ben afwezig van 28 september 2026 tot en met 5 oktober 2026.");
  assert.equal(afwezigZin("2026-09-28", ""), "Ik ben afwezig vanaf 28 september 2026.");
  assert.equal(afwezigZin("", "2026-10-05"), "Ik ben afwezig tot en met 5 oktober 2026.");
  assert.equal(afwezigZin("", ""), "Ik ben op dit moment afwezig.");
});

test("standaardtekst met collega en ondertekening", () => {
  const tekst = standaardTekst({
    van: "2026-09-28", tot: "2026-10-05",
    collega: "Nino van Kleef", collegaEmail: "nino@3bm.co.nl",
    ondertekening: "Maarten Vroegindeweij\n3BM Bouwtechniek",
  });
  assert.equal(tekst, [
    "Geachte heer, mevrouw,",
    "",
    "Ik ben afwezig van 28 september 2026 tot en met 5 oktober 2026.",
    "Bij vragen kunt u contact opnemen met mijn collega Nino van Kleef (nino@3bm.co.nl).",
    "",
    "Met vriendelijke groet,",
    "",
    "Maarten Vroegindeweij\n3BM Bouwtechniek",
  ].join("\n"));
});

test("zonder collega valt die zin weg", () => {
  const tekst = standaardTekst({ van: "2026-09-28", tot: "2026-10-05" });
  assert.ok(!tekst.includes("collega"));
  assert.ok(tekst.endsWith("Met vriendelijke groet,"));
});

test("eigen tekst blijft staan, standaardtekst mag meeveranderen", () => {
  assert.equal(isStandaardTekst(""), true);
  assert.equal(isStandaardTekst(standaardTekst({ van: "2026-09-28", tot: "2026-10-05" })), true);
  assert.equal(isStandaardTekst("Ik ben er even niet, mail Nino maar."), false);
  assert.equal(isStandaardTekst("Geachte heer, mevrouw,\n\nIk ben weg. Groet, M."), false);
});
