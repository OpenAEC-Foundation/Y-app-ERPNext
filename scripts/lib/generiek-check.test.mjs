import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VERBODEN, controleerMap, vingerafdruk, zoekTreffers } from "./generiek-check.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Verzonnen termen: een lange naam en een korte met een cijfer erin.
const LANG = vingerafdruk("kadeveld");
const KORT = vingerafdruk("9zq");

test("vingerafdruk: let niet op hoofdletters en verschilt per term", () => {
  assert.equal(vingerafdruk("Kadeveld"), vingerafdruk("KADEVELD"));
  assert.notEqual(vingerafdruk("kadeveld"), vingerafdruk("kadevelt"));
  // De term zelf staat er niet in.
  assert.ok(!LANG.includes("kadeveld"));
});

test("zoekTreffers: een lange term telt overal, ook midden in een woord", () => {
  const tekst = "regel een\nmail naar info@Kadeveld.nl\nen de map 3_kadeveldbouw";
  const treffers = zoekTreffers(tekst, [LANG]);
  assert.deepEqual(treffers.map((t) => t.regel), [2, 3]);
  assert.match(treffers[0].fragment, /info@Kadeveld\.nl/);
});

test("zoekTreffers: een korte term telt alleen aan het begin van een woord", () => {
  assert.equal(zoekTreffers("jan@9zq.co.nl", [KORT]).length, 1);
  assert.equal(zoekTreffers("bg-9ZQ-teal", [KORT]).length, 1);
  assert.equal(zoekTreffers("ext-9zqEng-planning", [KORT]).length, 1);
  assert.equal(zoekTreffers("9zq", [KORT]).length, 1);
  // Midden in een reeks tekens (een ingesloten afbeelding) is het toeval.
  assert.equal(zoekTreffers("iVBORw0KGgo9zqAAAANSUhEUg", [KORT]).length, 0);
});

test("zoekTreffers: schone tekst en lege tekst geven niets", () => {
  assert.deepEqual(zoekTreffers("een gewone regel over een voorbeeldbedrijf", [LANG, KORT]), []);
  assert.deepEqual(zoekTreffers("", [LANG, KORT]), []);
  assert.deepEqual(zoekTreffers("kadeveld", []), []);
});

test("controleerMap: meldt bestand en regel, en slaat over wat geen tekst is", () => {
  const map = mkdtempSync(join(tmpdir(), "generiek-"));
  try {
    mkdirSync(join(map, "src", "diep"), { recursive: true });
    mkdirSync(join(map, "node_modules", "pakket"), { recursive: true });
    writeFileSync(join(map, "src", "schoon.ts"), "export const x = 1;\n");
    writeFileSync(join(map, "src", "diep", "vuil.tsx"), "const a = 1;\nconst b = 'Kadeveld B.V.';\n");
    writeFileSync(join(map, "src", "logo.png"), "kadeveld");
    writeFileSync(join(map, "node_modules", "pakket", "index.js"), "kadeveld");
    const treffers = controleerMap(map, [LANG]);
    assert.equal(treffers.length, 1);
    assert.equal(treffers[0].bestand.replace(/\\/g, "/"), "src/diep/vuil.tsx");
    assert.equal(treffers[0].regel, 2);
  } finally {
    rmSync(map, { recursive: true, force: true });
  }
});

test("controleerMap: een map die niet bestaat is geen fout", () => {
  assert.deepEqual(controleerMap(join(tmpdir(), "bestaat-niet-generiek"), [LANG]), []);
});

test("de lijst met verboden termen is gevuld", () => {
  assert.ok(VERBODEN.length > 0);
  for (const afdruk of VERBODEN) assert.match(afdruk, /^\d+:[0-9a-f]+:[0-9a-f]+$/);
});

/**
 * De eigenlijke bewaking: wat in de app terechtkomt noemt geen organisatie.
 * De frontendbron wordt de bundel; `frappe-app/` is de app zelf.
 */
for (const map of ["packages/frontend/src", "packages/frontend/public", "frappe-app"]) {
  test(`generiek: ${map} noemt geen organisatie`, () => {
    const treffers = controleerMap(join(REPO, map));
    assert.deepEqual(
      treffers.map((t) => `${t.bestand}:${t.regel}  ${t.fragment}`),
      [],
    );
  });
}
