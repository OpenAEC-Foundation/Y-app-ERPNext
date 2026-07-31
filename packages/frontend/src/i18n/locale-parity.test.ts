/**
 * Fase 5 — i18n drift-safety.
 *
 * NL en EN zijn het onderhouden paar en MOETEN dezelfde keys hebben (CLAUDE.md:
 * "if you add a key to en.json, add it to nl.json in the same commit"). Deze
 * test faalt zodra ze uit elkaar lopen — de goedkoopste manier om een vergeten
 * vertaalkey te vangen (een ontbrekende key toont in productie de kale
 * key-string of een verkeerde taal).
 *
 * DE is sinds de backfill van 2026-07-03 volledig bijgetrokken (was 351 keys
 * achter) en wordt sindsdien óók strikt gelijk gehouden: nieuwe key → in alle
 * drie de bundles in dezelfde commit. Een vaste drempel of subset-guard zou
 * stil opnieuw laten wegzakken.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
function loadKeys(file: string): Set<string> {
  const json = JSON.parse(readFileSync(resolve(here, file), "utf8")) as Record<string, unknown>;
  return new Set(Object.keys(json));
}

const nl = loadKeys("nl.json");
const en = loadKeys("en.json");
const de = loadKeys("de.json");

test("i18n: NL en EN hebben identieke keys", () => {
  const inNlNotEn = [...nl].filter((k) => !en.has(k));
  const inEnNotNl = [...en].filter((k) => !nl.has(k));
  assert.deepEqual(
    { inNlNotEn, inEnNotNl },
    { inNlNotEn: [], inEnNotNl: [] },
    "nl.json en en.json lopen uit sync. Voeg ontbrekende keys in dezelfde commit toe.",
  );
});

test("i18n: DE heeft identieke keys aan NL (sinds backfill 2026-07-03)", () => {
  const inDeNotNl = [...de].filter((k) => !nl.has(k));
  const inNlNotDe = [...nl].filter((k) => !de.has(k));
  assert.deepEqual(
    { inDeNotNl, inNlNotDe },
    { inDeNotNl: [], inNlNotDe: [] },
    "de.json loopt uit sync met nl.json. Voeg de key(s) in alle drie de bundles toe in dezelfde commit.",
  );
});
