import { test } from "node:test";
import assert from "node:assert/strict";
import { validateIfcFile } from "./ifc-file.ts";

test("IFC opener accepteert een STEP-model, ook met BOM en hoofdletters", () => {
  assert.equal(validateIfcFile({ name: "model.IFC", size: 40 }, "\uFEFF  ISO-10303-21;\nHEADER;"), null);
});

test("IFC opener weigert andere bestandstypen vóór het laden van de viewer", () => {
  assert.equal(validateIfcFile({ name: "model.zip", size: 40 }, "ISO-10303-21;"), "type");
});

test("IFC opener weigert een vermomd bestand met een IFC-extensie", () => {
  assert.equal(validateIfcFile({ name: "model.ifc", size: 40 }, "PK\u0003\u0004"), "content");
});

test("IFC opener weigert een leeg model", () => {
  assert.equal(validateIfcFile({ name: "model.ifc", size: 0 }, ""), "empty");
});

test("IFC opener begrenst het lokale geheugengebruik", () => {
  assert.equal(validateIfcFile({ name: "model.ifc", size: 104857601 }, "ISO-10303-21;"), "large");
  assert.equal(validateIfcFile({ name: "model.ifc", size: 104857600 }, "ISO-10303-21;"), null);
});
