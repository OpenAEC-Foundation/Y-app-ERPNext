import { test } from "node:test";
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { APP_BASE, APP_BUILD_TAG, resolveFrontendDir, bundleOutDir, viteBuildArgs, findEntry } from "./build-frappe-app.mjs";

test("de bundel staat onder de publieke map van de app", () => {
  assert.equal(APP_BASE, "/assets/y_next/app/");
  assert.equal(APP_BUILD_TAG, "app");
  assert.equal(bundleOutDir("/repo"), join("/repo", "frappe-app", "y_next", "public", "app"));
});

test("standaard wordt de frontend van deze repository gebouwd", () => {
  assert.equal(resolveFrontendDir({}, "/repo"), join("/repo", "packages", "frontend"));
});

test("YNEXT_FRONTEND_DIR wijst een andere frontendmap aan", () => {
  assert.equal(resolveFrontendDir({ YNEXT_FRONTEND_DIR: "elders/frontend" }, "/repo"), resolve("elders/frontend"));
});

test("Vite krijgt base en uitvoermap via de opdrachtregel", () => {
  assert.deepEqual(viteBuildArgs("/uit"), ["build", "--base", "/assets/y_next/app/", "--outDir", "/uit", "--emptyOutDir"]);
});

test("findEntry haalt startbestand en stylesheets uit het manifest", () => {
  const manifest = {
    "index.html": { file: "yapp-index-abc.js", isEntry: true, css: ["yapp-index-def.css"] },
    "src/x.ts": { file: "yapp-x-123.js" },
  };
  assert.deepEqual(findEntry(manifest), { js: "yapp-index-abc.js", css: ["yapp-index-def.css"] });
  assert.deepEqual(findEntry({ a: { file: "a.js", isEntry: true } }), { js: "a.js", css: [] });
  assert.equal(findEntry({ a: { file: "a.js" } }), null);
});
