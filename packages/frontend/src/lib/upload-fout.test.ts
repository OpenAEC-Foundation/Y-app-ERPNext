import test from "node:test";
import assert from "node:assert/strict";
import { grootteLabel, uploadFoutmelding } from "./upload-fout.ts";

const pdf = { name: "3070-CB-21 Constructieberekening.pdf", size: 32.4 * 1024 * 1024 };

test("grootte in MB of kB", () => {
  assert.equal(grootteLabel(32.4 * 1024 * 1024), "32,4 MB");
  assert.equal(grootteLabel(820 * 1024), "820 kB");
  assert.equal(grootteLabel(10), "1 kB");
});

test("te groot volgens Frappe: bestand, grootte en reden", () => {
  const m = uploadFoutmelding(pdf, 417, "File size exceeded the maximum allowed size of 25.0 MB");
  assert.match(m, /3070-CB-21 Constructieberekening\.pdf/);
  assert.match(m, /32,4 MB/);
  assert.match(m, /te groot/);
  assert.match(m, /25\.0 MB/);
});

test("413 van de webserver is ook te groot", () => {
  assert.match(uploadFoutmelding(pdf, 413, ""), /te groot/);
});

test("andere reden wordt letterlijk doorgegeven, zonder HTML", () => {
  const m = uploadFoutmelding({ name: "a.odt", size: 2048 }, 417, "Bestandstype <b>odt</b> is niet toegestaan");
  assert.equal(m, "\"a.odt\" (2 kB) kon niet worden geüpload: Bestandstype odt is niet toegestaan");
});

test("zonder reden in elk geval bestand en statuscode", () => {
  assert.equal(uploadFoutmelding({ name: "a.pdf", size: 2048 }, 500, ""), "\"a.pdf\" (2 kB) kon niet worden geüpload (serverfout 500).");
});
