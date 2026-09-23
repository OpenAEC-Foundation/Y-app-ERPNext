import test from "node:test";
import assert from "node:assert/strict";
import {
  groepeer, laatstGewijzigd, leesbaar, sectiePad, telGeopend, vaakstGeopend, zoekArtikelen,
} from "./wiki-overzicht.ts";

const artikelen = [
  { name: "a", title: "Revit Steel", route: "wiki/kennisbank/procedures/detail-engineering/revit-steel", modified: "2026-01-19 23:21:12" },
  { name: "b", title: "Nieuw project aanmaken", route: "wiki/kennisbank/procedures/algemeen/nieuw-project", modified: "2026-02-07 15:37:36" },
  { name: "c", title: "Sebastiaan AI - Instructies", route: "wiki/kennisbank/procedures/algemeen/sebastiaan-ai-instructies", modified: "2026-06-16 16:02:02" },
  { name: "d", title: "Beleid ERP-Next binnen 3BM", route: "wiki/beleid-erp-next-binnen-3bm", modified: "2026-01-26 06:07:35" },
];

test("pad en leesbare naam", () => {
  assert.equal(sectiePad("wiki/kennisbank/procedures/algemeen/nieuw-project"), "kennisbank/procedures/algemeen");
  assert.equal(sectiePad("wiki/beleid-erp-next-binnen-3bm"), "");
  assert.equal(leesbaar("detail-engineering"), "Detail engineering");
  assert.equal(leesbaar("3bm-bouwtechniek"), "3BM bouwtechniek");
});

test("groeperen per sectie, artikelen alfabetisch", () => {
  const secties = groepeer(artikelen);
  assert.deepEqual(secties.map((s) => s.label), [
    "Algemeen",
    "Kennisbank · Procedures · Algemeen",
    "Kennisbank · Procedures · Detail engineering",
  ]);
  assert.deepEqual(secties[1].artikelen.map((a) => a.title), ["Nieuw project aanmaken", "Sebastiaan AI - Instructies"]);
});

test("laatst gewijzigd en zoeken", () => {
  assert.deepEqual(laatstGewijzigd(artikelen, 2).map((a) => a.name), ["c", "b"]);
  assert.deepEqual(zoekArtikelen(artikelen, "revit").map((a) => a.name), ["a"]);
  assert.deepEqual(zoekArtikelen(artikelen, "algemeen").map((a) => a.name), ["b", "c"]);
  assert.equal(zoekArtikelen(artikelen, "").length, 4);
});

test("vaakst geopend telt alleen wat geopend is", () => {
  const tellingen = telGeopend("b", telGeopend("b", telGeopend("a", {})));
  assert.deepEqual(vaakstGeopend(artikelen, tellingen).map((x) => [x.artikel.name, x.aantal]), [["b", 2], ["a", 1]]);
  assert.deepEqual(vaakstGeopend(artikelen, {}), []);
});
