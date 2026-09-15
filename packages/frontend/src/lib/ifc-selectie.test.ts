import { test } from "node:test";
import assert from "node:assert/strict";
import { isKlik, soortLabel, waardeVan, zoekOnderdeel, type Bereik } from "./ifc-selectie.ts";

/**
 * Tests voor het aanklikken van een onderdeel in de IFC-viewer.
 *
 * De viewer voegt alles met dezelfde kleur samen tot een geometrie, anders
 * staat een model van tienduizend onderdelen stil. Daarbij gaat verloren welke
 * driehoek bij welk onderdeel hoort. Die koppeling wordt apart bijgehouden als
 * reeksen driehoeken; aan een klik zie je niet of die opzoeking een onderdeel
 * verschuift, dus die staat hier vast.
 */

// Drie onderdelen achter elkaar in een samengevoegde geometrie, per driehoek.
const BEREIKEN: Bereik[] = [
  { start: 0, aantal: 12, expressID: 101 },
  { start: 12, aantal: 4, expressID: 202 },
  { start: 16, aantal: 30, expressID: 303 },
];

test("zoekOnderdeel: de driehoek hoort bij het onderdeel waar hij in valt", () => {
  assert.equal(zoekOnderdeel(BEREIKEN, 0), 101);
  assert.equal(zoekOnderdeel(BEREIKEN, 11), 101);
  assert.equal(zoekOnderdeel(BEREIKEN, 12), 202);
  assert.equal(zoekOnderdeel(BEREIKEN, 15), 202);
  assert.equal(zoekOnderdeel(BEREIKEN, 16), 303);
  assert.equal(zoekOnderdeel(BEREIKEN, 45), 303);
});

test("zoekOnderdeel: buiten alle reeksen is geen onderdeel", () => {
  assert.equal(zoekOnderdeel(BEREIKEN, 46), null);
  assert.equal(zoekOnderdeel(BEREIKEN, -1), null);
  assert.equal(zoekOnderdeel([], 0), null);
});

test("zoekOnderdeel: werkt ook met veel onderdelen", () => {
  const veel: Bereik[] = [];
  for (let i = 0; i < 10000; i++) veel.push({ start: i * 3, aantal: 3, expressID: i + 1 });
  assert.equal(zoekOnderdeel(veel, 3 * 7777 + 2), 7778);
});

test("isKlik: nauwelijks bewogen is een klik, verder bewogen is draaien", () => {
  assert.equal(isKlik({ x: 100, y: 100 }, { x: 102, y: 101 }), true);
  assert.equal(isKlik({ x: 100, y: 100 }, { x: 130, y: 100 }), false);
  assert.equal(isKlik({ x: 100, y: 100 }, { x: 103, y: 103 }, 5), true);
});

test("soortLabel: bekende IFC-soorten in gewone taal", () => {
  assert.equal(soortLabel("IFCBEAM"), "Balk");
  assert.equal(soortLabel("IFCCOLUMN"), "Kolom");
  assert.equal(soortLabel("IFCSLAB"), "Vloer of plaat");
  assert.equal(soortLabel("IFCWALLSTANDARDCASE"), "Wand");
});

test("soortLabel: een onbekende soort blijft herkenbaar", () => {
  assert.equal(soortLabel("IFCFLOWTERMINAL"), "IfcFlowTerminal");
  assert.equal(soortLabel(""), "Onderdeel");
});

test("waardeVan: web-ifc verpakt waarden in een object", () => {
  assert.equal(waardeVan({ type: 1, value: "Kanaalplaat 200" }), "Kanaalplaat 200");
  assert.equal(waardeVan({ type: 4, value: 3.25 }), "3.25");
  assert.equal(waardeVan("los"), "los");
  assert.equal(waardeVan(null), "");
  assert.equal(waardeVan(undefined), "");
  assert.equal(waardeVan({ type: 3, value: true }), "ja");
});

test("soortLabel: zoals web-ifc hem teruggeeft, in gemengde letters", () => {
  // GetNameFromTypeCode geeft "IfcSlab", niet "IFCSLAB".
  assert.equal(soortLabel("IfcSlab"), "Vloer of plaat");
  assert.equal(soortLabel("IfcCableCarrierSegment"), "IfcCableCarrierSegment");
});
