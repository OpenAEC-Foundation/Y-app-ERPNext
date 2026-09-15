import { test } from "node:test";
import assert from "node:assert/strict";
import { leesZoekopdracht } from "./mail-zoekopdracht.ts";

/**
 * Tests voor wat er in het zoekveld getypt wordt.
 *
 * `*.ifc` betekent "berichten met een IFC-bijlage", niet "berichten waar de
 * tekst *.ifc in staat". Die twee lopen stil door elkaar: een zoekopdracht op
 * de letterlijke tekst geeft gewoon nul treffers, en aan een lege lijst zie je
 * niet dat de vraag verkeerd begrepen is.
 */

test("*.ifc zoekt op bijlagen met die extensie", () => {
  assert.deepEqual(leesZoekopdracht("*.ifc"), { soort: "bijlage", extensie: "ifc" });
});

test("hoofdletters en spaties doen er niet toe", () => {
  assert.deepEqual(leesZoekopdracht("  *.IFC "), { soort: "bijlage", extensie: "ifc" });
  assert.deepEqual(leesZoekopdracht("*.Pdf"), { soort: "bijlage", extensie: "pdf" });
});

test("ook andere extensies, met cijfers erin", () => {
  assert.deepEqual(leesZoekopdracht("*.mp4"), { soort: "bijlage", extensie: "mp4" });
  assert.deepEqual(leesZoekopdracht("*.xlsx"), { soort: "bijlage", extensie: "xlsx" });
});

test("gewone tekst blijft gewone tekst", () => {
  assert.deepEqual(leesZoekopdracht("offerte kade"), { soort: "tekst", term: "offerte kade" });
  // Een bestandsnaam zonder sterretje is een zoekterm, geen extensiefilter.
  assert.deepEqual(leesZoekopdracht("tekening.ifc"), { soort: "tekst", term: "tekening.ifc" });
});

test("half getypt of onzin valt terug op tekst", () => {
  // Wie net "*." heeft getypt is nog bezig; dat is geen zoekopdracht op niets.
  assert.deepEqual(leesZoekopdracht("*."), { soort: "tekst", term: "*." });
  assert.deepEqual(leesZoekopdracht("*.ifc zip"), { soort: "tekst", term: "*.ifc zip" });
  assert.deepEqual(leesZoekopdracht("*.%"), { soort: "tekst", term: "*.%" });
});

test("leeg is leeg", () => {
  assert.deepEqual(leesZoekopdracht(""), { soort: "tekst", term: "" });
  assert.deepEqual(leesZoekopdracht("   "), { soort: "tekst", term: "" });
});
