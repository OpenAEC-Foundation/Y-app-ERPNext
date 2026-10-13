import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const module = await import("./studio-build.mjs");
test("een app-build weigert ontbrekende studiobundels vóór outputwijzigingen", () => {
  const root = mkdtempSync(join(tmpdir(), "studio-input-"));
  try { assert.throws(() => module.studioBuildInputs({}, root), /CAD.*ontbreekt/); }
  finally { rmSync(root, { recursive: true, force: true }); }
});
test("alleen complete lokale bundels met bijbehorende bronarchieven zijn bouwinputs", () => {
  const root = mkdtempSync(join(tmpdir(), "studio-input-"));
  try {
    for (const tool of ["cad", "planner"]) {
      mkdirSync(join(root, "studio-runtime", tool), { recursive: true });
      writeFileSync(join(root, "studio-runtime", tool, "index.html"), "<html></html>");
      writeFileSync(join(root, "studio-runtime", tool, "source.zip"), "source");
    }
    assert.deepEqual(module.studioBuildInputs({}, root), {
      cadDist: join(root, "studio-runtime", "cad"),
      plannerDist: join(root, "studio-runtime", "planner"),
      cadSourceArchive: join(root, "studio-runtime", "cad", "source.zip"),
      plannerSourceArchive: join(root, "studio-runtime", "planner", "source.zip"),
    });
    rmSync(join(root, "studio-runtime", "planner", "source.zip"));
    assert.throws(() => module.studioBuildInputs({}, root), /Planner.*bronarchief.*ontbreekt/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
