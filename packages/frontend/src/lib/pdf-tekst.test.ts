/**
 * Tests voor het terugbouwen van regels uit de tekststukjes van een PDF.
 *
 * Een PDF kent geen regels, alleen losse stukjes tekst met een plek op de
 * pagina. Bij een factuur in twee kolommen staat "Factuurdatum:" links en
 * "30-09-2026" rechts; in de volgorde waarin het bestand ze opsomt, staan
 * eerst alle labels en dan pas alle waarden. Zonder regels op hoogte vindt de
 * herkenning de datum en het bedrag niet terug.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { regelsUitTekstItems, type PdfTekstItem } from "./pdf-tekst.ts";

const item = (str: string, x: number, y: number): PdfTekstItem => ({ str, x, y, h: 9 });

test("regelsUitTekstItems: label en waarde op dezelfde hoogte worden één regel", () => {
  const tekst = regelsUitTekstItems([
    item("Factuurdatum:", 352, 648),
    item("Vervaldatum:", 352, 636),
    item("30-09-2026", 459, 648),
    item("30-09-2026", 459, 636),
  ]);
  assert.equal(tekst, "Factuurdatum: 30-09-2026\nVervaldatum: 30-09-2026");
});

test("regelsUitTekstItems: van boven naar beneden en van links naar rechts", () => {
  const tekst = regelsUitTekstItems([
    item("151,38", 531, 193),
    item("Subtotaal", 257, 193),
    item("Factuur", 42, 735),
    item("(excl. btw)", 300, 193),
    item("EUR", 486, 193),
  ]);
  assert.equal(tekst, "Factuur\nSubtotaal (excl. btw) EUR 151,38");
});

test("regelsUitTekstItems: kleine verschillen in hoogte horen bij dezelfde regel", () => {
  // Een ander lettertype of een uitlijning op de basislijn schuift een
  // stukje een fractie op; dat mag de regel niet breken.
  const tekst = regelsUitTekstItems([item("Totaal", 257, 170), item("EUR 183,17", 486, 169.4)]);
  assert.equal(tekst, "Totaal EUR 183,17");
});

test("regelsUitTekstItems: lege stukjes en dubbele spaties verdwijnen", () => {
  const tekst = regelsUitTekstItems([
    item("", 43, 580), item("Omschrijving", 43, 580), item(" ", 99, 580), item("Aantal", 345, 580),
  ]);
  assert.equal(tekst, "Omschrijving Aantal");
});

test("regelsUitTekstItems: geen tekst is een lege string", () => {
  assert.equal(regelsUitTekstItems([]), "");
  assert.equal(regelsUitTekstItems([item(" ", 1, 1)]), "");
});
