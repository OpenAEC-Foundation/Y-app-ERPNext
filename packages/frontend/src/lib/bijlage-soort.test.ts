import test from "node:test";
import assert from "node:assert/strict";
import { isCadNaam, isLeesbaarOffice, officeSoort, voorbeeldSoort } from "./bijlage-soort.ts";

test("Office-soorten", () => {
  assert.equal(officeSoort("Offerte.docx"), "word");
  assert.equal(officeSoort("Begroting.XLSX"), "excel");
  assert.equal(officeSoort("uren.csv"), "csv");
  assert.equal(officeSoort("tekening.dwg"), null);
  assert.equal(officeSoort(""), null);
});

test("alleen de formaten die de browser echt kan lezen", () => {
  assert.equal(isLeesbaarOffice("Offerte.docx"), true);
  assert.equal(isLeesbaarOffice("Begroting.xlsx"), true);
  assert.equal(isLeesbaarOffice("Oud.doc"), false);
  assert.equal(isLeesbaarOffice("Oud.xls"), false);
  assert.equal(isLeesbaarOffice("notitie.odt"), false);
});

test("tekeningen", () => {
  assert.equal(isCadNaam("3070-CP-21.dwg"), true);
  assert.equal(isCadNaam("plattegrond.DXF"), true);
  assert.equal(isCadNaam("foto.png"), false);
});

test("welk voorbeeldpaneel", () => {
  assert.equal(voorbeeldSoort("rapport.pdf"), "pdf");
  assert.equal(voorbeeldSoort("model.ifc"), "ifc");
  assert.equal(voorbeeldSoort("plattegrond.dwg"), "cad");
  assert.equal(voorbeeldSoort("brief.docx"), "office");
  assert.equal(voorbeeldSoort("archief.zip"), null);
  assert.equal(voorbeeldSoort("brief.doc"), null);
});
