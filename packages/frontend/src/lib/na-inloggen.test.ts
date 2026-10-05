import test from "node:test";
import assert from "node:assert/strict";
import { onthoudAdres, haalAdresTerug } from "./na-inloggen.ts";

function geheugen() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    grootte: () => m.size,
  };
}

test("een gedeelde link komt na het inloggen terug", () => {
  const opslag = geheugen();
  onthoudAdres("#/wiki/kennisbank/procedures/algemeen/archiefonderzoek", opslag, 1000);
  // Frappe stuurt na het inloggen terug naar /y-next zonder het deel achter #.
  assert.equal(haalAdresTerug("", opslag, 5000), "#/wiki/kennisbank/procedures/algemeen/archiefonderzoek");
  // Eén keer: daarna is het weg.
  assert.equal(haalAdresTerug("", opslag, 6000), null);
  assert.equal(opslag.grootte(), 0);
});

test("de startpagina wordt niet onthouden", () => {
  const opslag = geheugen();
  onthoudAdres("#/", opslag, 0);
  onthoudAdres("", opslag, 0);
  assert.equal(opslag.grootte(), 0);
});

test("een oud of vreemd adres wordt niet teruggezet", () => {
  const opslag = geheugen();
  onthoudAdres("#/wiki/x", opslag, 0);
  assert.equal(haalAdresTerug("#/", opslag, 31 * 60 * 1000), null);
  opslag.setItem("y-next:na-inloggen", JSON.stringify({ adres: "javascript:alert(1)", tijd: 0 }));
  assert.equal(haalAdresTerug("", opslag, 1), null);
  opslag.setItem("y-next:na-inloggen", "geen json");
  assert.equal(haalAdresTerug("", opslag, 1), null);
});

test("wie al op een eigen adres binnenkomt, gaat daarheen", () => {
  const opslag = geheugen();
  onthoudAdres("#/wiki/x", opslag, 0);
  assert.equal(haalAdresTerug("#/agenda", opslag, 10), null);
  assert.equal(opslag.grootte(), 0);
});

test("geen opslag beschikbaar: geen fout", () => {
  const kapot = {
    getItem: () => { throw new Error("geblokkeerd"); },
    setItem: () => { throw new Error("geblokkeerd"); },
    removeItem: () => { throw new Error("geblokkeerd"); },
  };
  onthoudAdres("#/wiki/x", kapot, 0);
  assert.equal(haalAdresTerug("", kapot, 0), null);
});
