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

test("zoekTreffers: openbare CAD-protocoltypes worden alleen als berichttype toegestaan", () => {
  for (const tekst of [
    'const message = { type: "domera.cad", version: 1 };',
    'const reply = { type: "domera.cad.reply", version: 1 };',
    "if (message.type !== 'domera.cad') return;",
    'export interface Reply { type: "domera.cad.reply"; }',
  ]) assert.deepEqual(zoekTreffers(tekst), [], tekst);
});

test("zoekTreffers: openbare CAD-ABI-namen blijven alleen code-identifiers", () => {
  for (const tekst of [
    'window.__domeraCadCommands = commands;',
    'window.__domeraCadReply(id, true);',
  ]) assert.deepEqual(zoekTreffers(tekst), [], tekst);
});

test("zoekTreffers: statische backticktypes uit de productiecompiler behouden het CAD-contract", () => {
  const tekst = 'function e(e,t,n){return{type:`domera.cad`,version:1,id:e,action:`load`,name:t,bytes:n}}function t(e){if(e.type!==`domera.cad.reply`||e.version!==1)return null}';
  assert.deepEqual(zoekTreffers(tekst), []);
  for (const ongeldig of ['const label=`domera.cad`;', 'const x={type:`domera.cad${suffix}`};', 'const x={type:`domera.cad.reply.extra`};']) assert.ok(zoekTreffers(ongeldig).length > 0);
});

test("zoekTreffers: protocoluitzonderingen dekken geen domeinen, ruwe namen of klanttekst", () => {
  for (const tekst of [
    'const label = "domera";',
    'const label = "domera.cad";',
    'const host = "https://domera.cad";',
    'const customer = "domera.cad.reply";',
    'const message = { type: "prefixdomera.cad" };',
    'const message = { type: "domera.cad.suffix" };',
    'const message = { type: "domera.cad.reply.extra" };',
    'const message = { type: "domera.other" };',
    'window.prefix__domeraCadReply = reply;',
    'window.__domeraCadReplySuffix = reply;',
    'const label = "__domeraCadReply";',
    'const label = "window.__domeraCadReply";',
    'const label = "Public window.__domeraCadReply label";',
    '// window.__domeraCadReply is a label',
    '/* example type: "domera.cad" */',
    'const config = { __domeraCadReply: "private" };',
    'function __domeraCadReply(id, ok) { return ok; }',
    'const config = { company: "domera", site: "https://domera.nl" };',
    'const message = { type: "domera.cad", customer: "domera" };',
  ]) assert.ok(zoekTreffers(tekst).length > 0, tekst);
  // Andere verboden termen krijgen nooit de ABI-uitzondering.
  assert.equal(zoekTreffers('const x = { type: "kadeveld.cad" };', [LANG]).length, 1);
  assert.equal(zoekTreffers('window.__domeraCadReply(id);', VERBODEN, ".md").length, 1);
  assert.equal(zoekTreffers('<p>window.__domeraCadReply</p>', VERBODEN, ".html").length, 1);
});

test("zoekTreffers: alleen de exacte lokale scriptreferentie hoort bij de CAD-ABI", () => {
  for (const tekst of [
    '<script src="domera-bridge.js"></script>',
    "<script defer src='./domera-bridge.js'></script>",
  ]) assert.deepEqual(zoekTreffers(tekst, VERBODEN, ".html"), [], tekst);
  for (const tekst of [
    '<script src="https://domera.nl/domera-bridge.js"></script>',
    '<script src="/private/domera-bridge.js"></script>',
    '<script src="domera-bridge.js?key=private"></script>',
    '<script src="domera-bridge.js/malicious.html"></script>',
    '<iframe src="domera-bridge.js"></iframe>',
    '<img src="domera-bridge.js">',
    'const company = "domera-bridge.js";',
    'const ui = `<script src="domera-bridge.js"></script>`;',
  ]) assert.ok(zoekTreffers(tekst).length > 0, tekst);
  assert.equal(zoekTreffers('<script src="domera-bridge.js"></script>', VERBODEN, ".md").length, 1);
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
