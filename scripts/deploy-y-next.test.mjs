import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  requiredEnv,
  collectAssets,
  buildWebPageFields,
  planUpsert,
  mimeTypeFor,
} from "./deploy-y-next.mjs";

test("requiredEnv: gooit een duidelijke fout zonder YNEXT_API_TOKEN", () => {
  assert.throws(() => requiredEnv({}), /YNEXT_API_TOKEN/);
});

test("requiredEnv: gebruikt de default base-URL en strip trailing slashes", () => {
  const { baseUrl, token } = requiredEnv({ YNEXT_API_TOKEN: "key:secret" });
  assert.equal(token, "key:secret");
  assert.equal(baseUrl, "https://open-aec-studio-erp.prilk.cloud");
});

test("requiredEnv: strip trailing slash(es) van een expliciete YNEXT_BASE_URL", () => {
  const { baseUrl } = requiredEnv({
    YNEXT_API_TOKEN: "key:secret",
    YNEXT_BASE_URL: "https://example.frappe.cloud///",
  });
  assert.equal(baseUrl, "https://example.frappe.cloud");
});

test("buildWebPageFields: bevat root-element en verwijst naar de opgegeven bestanden", () => {
  const fields = buildWebPageFields({
    entryJs: "index-abc123.js",
    cssFiles: ["index-def456.css"],
  });
  assert.match(fields.main_section, /id="root"/);
  assert.match(fields.javascript, /index-abc123\.js/);
  assert.match(fields.javascript, /index-def456\.css/);
  assert.equal(fields.route, "y-next");
  assert.equal(fields.published, 1);
});

test("buildWebPageFields: import() heeft een .catch() met zichtbare foutmelding en console.error", () => {
  const fields = buildWebPageFields({
    entryJs: "index-abc123.js",
    cssFiles: [],
  });
  assert.match(fields.javascript, /import\("\/files\/index-abc123\.js"\)\.catch\(/);
  assert.match(fields.javascript, /console\.error\(/);
  assert.match(fields.javascript, /Y-next kon niet laden/);
  assert.match(fields.javascript, /getElementById\("root"\)/);
});

test("buildWebPageFields: nooit secrets in de output", () => {
  const fields = buildWebPageFields({
    entryJs: "index-abc123.js",
    cssFiles: ["index-def456.css"],
  });
  assert.doesNotMatch(JSON.stringify(fields), /token|secret|api[_-]?key/i);
});

test("planUpsert: PUT naar het bestaande document wanneer lookup een rij bevat", () => {
  const plan = planUpsert([{ name: "y-next" }]);
  assert.equal(plan.method, "PUT");
  assert.match(plan.url, /Web Page\/y-next$/);
});

test("planUpsert: POST wanneer lookup leeg is", () => {
  const plan = planUpsert([]);
  assert.equal(plan.method, "POST");
  assert.match(plan.url, /Web Page$/);
  assert.doesNotMatch(plan.url, /Web Page\/.+/);
});

test("mimeTypeFor: geeft het juiste MIME-type per extensie", () => {
  assert.equal(mimeTypeFor("index-abc123.js"), "application/javascript");
  assert.equal(mimeTypeFor("chunk-def456.mjs"), "application/javascript");
  assert.equal(mimeTypeFor("index-abc123.css"), "text/css");
  assert.equal(mimeTypeFor("y-logo.svg"), "image/svg+xml");
  assert.equal(mimeTypeFor("manifest.json"), "application/json");
  assert.equal(mimeTypeFor("index-abc123.js.map"), "application/json");
});

test("mimeTypeFor: onbekende of ontbrekende extensie valt terug op application/octet-stream", () => {
  assert.equal(mimeTypeFor("LICENSE"), "application/octet-stream");
  assert.equal(mimeTypeFor("font.woff3"), "application/octet-stream");
});

test("collectAssets: vindt platte bestanden, negeert .vite/ en index.html", () => {
  const dir = mkdtempSync(join(tmpdir(), "ynext-dist-"));
  try {
    writeFileSync(join(dir, "index.html"), "<html></html>");
    writeFileSync(join(dir, "index-abc123.js"), "console.log(1)");
    writeFileSync(join(dir, "index-def456.css"), "body{}");
    mkdirSync(join(dir, ".vite"));
    writeFileSync(join(dir, ".vite", "manifest.json"), "{}");

    const assets = collectAssets(dir);
    const names = assets.map((a) => a.name).sort();
    assert.deepEqual(names, ["index-abc123.js", "index-def456.css"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("collectAssets: negeert sw.js (service worker wordt in fase 1 niet geregistreerd)", () => {
  const dir = mkdtempSync(join(tmpdir(), "ynext-dist-"));
  try {
    writeFileSync(join(dir, "index.html"), "<html></html>");
    writeFileSync(join(dir, "sw.js"), "self.addEventListener('install', () => {});");
    writeFileSync(join(dir, "index-abc123.js"), "console.log(1)");

    const assets = collectAssets(dir);
    const names = assets.map((a) => a.name).sort();
    assert.deepEqual(names, ["index-abc123.js"]);
    assert.ok(!names.includes("sw.js"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("collectAssets: gooit bij een subdirectory in dist/", () => {
  const dir = mkdtempSync(join(tmpdir(), "ynext-dist-"));
  try {
    writeFileSync(join(dir, "index.html"), "<html></html>");
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "assets", "chunk.js"), "console.log(1)");

    assert.throws(() => collectAssets(dir), /submap/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
