import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_NAME, benchConfig, prepareScript, ownScript, installScript, migrateScript, isInstalled } from "./dev-bench-sync.mjs";

test("benchConfig eist de map van de bench en de site", () => {
  assert.throws(() => benchConfig({}), /YNEXT_BENCH_DIR/);
  assert.throws(() => benchConfig({ YNEXT_BENCH_DIR: "x" }), /YNEXT_BENCH_SITE/);
});

test("benchConfig vult standaardwaarden in en haalt de slash van het pad", () => {
  const config = benchConfig({ YNEXT_BENCH_DIR: "C:/bench", YNEXT_BENCH_SITE: "kaal.localhost", YNEXT_BENCH_PATH: "/srv/bench/" });
  assert.deepEqual(config, { benchDir: "C:/bench", site: "kaal.localhost", service: "frappe", benchPath: "/srv/bench" });
  assert.equal(benchConfig({ YNEXT_BENCH_DIR: "x", YNEXT_BENCH_SITE: "s" }).benchPath, "/workspace/frappe-bench");
});

test("de app-map wordt vervangen en daarna van de bench-gebruiker", () => {
  const config = { benchPath: "/workspace/frappe-bench", site: "kaal.localhost" };
  assert.equal(prepareScript(config), "rm -rf /workspace/frappe-bench/apps/y_next && mkdir -p /workspace/frappe-bench/apps/y_next");
  assert.equal(ownScript(config), "chown -R frappe:frappe /workspace/frappe-bench/apps/y_next");
});

test("installeren: eerst het pakket, dan apps.txt, dan assets, dan de site", () => {
  const script = installScript({ benchPath: "/workspace/frappe-bench", site: "kaal.localhost" });
  const volgorde = ["uv pip install", "sites/apps.txt", "bench build --app y_next", "bench --site kaal.localhost install-app y_next"];
  const posities = volgorde.map((deel) => script.indexOf(deel));
  assert.ok(posities.every((p) => p >= 0), script);
  assert.deepEqual([...posities].sort((a, b) => a - b), posities);
});

test("migreren draait migrate en leegt de cache op de gekozen site", () => {
  assert.equal(
    migrateScript({ benchPath: "/workspace/frappe-bench", site: "kaal.localhost" }),
    "cd /workspace/frappe-bench && bench --site kaal.localhost migrate && bench --site kaal.localhost clear-cache"
  );
});

test("isInstalled herkent de app in de uitvoer van list-apps", () => {
  assert.equal(isInstalled("frappe  16.51.0 version-16\nerpnext 16.50.0 version-16\n"), false);
  assert.equal(isInstalled("frappe  16.51.0\nerpnext 16.50.0\ny_next  0.39.4\n"), true);
  assert.equal(isInstalled("frappe\nerpnext\ny_next_extra 1.0\n"), false);
  assert.equal(APP_NAME, "y_next");
});
