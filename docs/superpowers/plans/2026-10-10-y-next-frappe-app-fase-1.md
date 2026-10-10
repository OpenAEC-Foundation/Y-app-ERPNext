# Y-next Frappe-app — fase 1 (skelet, pagina, bundel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De app `y_next` installeert op een kale ERPNext 16-site en serveert Y-next op `/y-next` vanuit de app zelf.

**Architecture:** De app staat in `frappe-app/`. Een Node-script bouwt de bestaande Vite-frontend met een andere `base` en uitvoermap tot bundel van de app; een tweede Node-script kopieert de app naar een lokale Docker-bench en installeert hem. De pagina is een volledig HTML-document in `www/` dat het Vite-manifest leest.

**Tech Stack:** Frappe 16 / ERPNext 16 (Python 3.14), Vite 8 (bestaande frontend), Node 24 (`node --test`), Docker Compose voor de lokale bench.

**Ontwerp:** [`docs/superpowers/specs/2026-10-10-y-next-frappe-app-design.md`](../specs/2026-10-10-y-next-frappe-app-design.md)

## Global Constraints

- `required_apps` in `hooks.py` is exact `["erpnext"]`; `dependencies` in `pyproject.toml` is leeg.
- `requires-python = ">=3.14"`; Frappe en ERPNext `>=16.0.0,<17.0.0`.
- De app heet `y_next`, de module `Y Next`, de titel `Y-next`, de route `/y-next`.
- De bundel staat onder `/assets/y_next/app/`; de build-tag is `app`.
- Niets in `frappe-app/` noemt een organisatie, behalve de uitgever `OpenAEC Foundation` in de metagegevens.
- Bestaande bestanden van de publicatieroute (`vite.config.ts`, `scripts/deploy-y-next.mjs`, `scripts/provision-y-next.mjs`) veranderen in deze fase niet.
- Commentaar in het Nederlands, zoals in de rest van de repository. Geen verwijzingen naar gesprekken of naar externe softwarepakketten in code, commentaar of commit-berichten.
- Vastleggen en pushen gebeurt alleen wanneer de gebruiker daarom vraagt. De stappen "Vastleggen" hieronder geven aan wát bij elkaar hoort.
- Python-bestanden gebruiken tabs (Frappe-conventie); de rest volgt de bestaande opmaak.

## Lokale bench

De taken gaan uit van een Docker-bench met twee omgevingsvariabelen:

```bash
export YNEXT_BENCH_DIR="<map met het docker-compose.yml van de bench>"
export YNEXT_BENCH_SITE="kaal.localhost"
```

`kaal.localhost` is een site met alleen Frappe en ERPNext, bereikbaar op `http://kaal.localhost:8000`. Staan er meer sites op de bench, dan moet `default_site` leeg zijn; zie `docs/frappe-app.md`. Python-tests draaien met:

```bash
cd "$YNEXT_BENCH_DIR" && MSYS_NO_PATHCONV=1 docker compose exec -T frappe bash -lc "cd /workspace/frappe-bench && bench --site kaal.localhost run-tests --app y_next"
```

## File Structure

| Bestand | Verantwoordelijkheid |
|---|---|
| `frappe-app/pyproject.toml` | pakketgegevens; geen afhankelijkheden |
| `frappe-app/README.md`, `frappe-app/license.txt` | wat gebruikers van de app zien |
| `frappe-app/y_next/__init__.py` | versie |
| `frappe-app/y_next/hooks.py` | metagegevens, `required_apps`, appscherm |
| `frappe-app/y_next/modules.txt`, `patches.txt`, `y_next/y_next/` | module *Y Next* |
| `frappe-app/y_next/bundle.py` | het Vite-manifest lezen |
| `frappe-app/y_next/www/y-next.html`, `www/y_next.py` | de pagina `/y-next` |
| `frappe-app/y_next/tests/` | Python-tests |
| `scripts/dev-bench-sync.mjs` (+ test) | app naar de lokale bench kopiëren en installeren |
| `scripts/build-frappe-app.mjs` (+ test) | bundel van de app bouwen |
| `docs/frappe-app.md` | werkwijze voor ontwikkelaars |

---

### Task 1: App-skelet dat op een kale site installeert

**Files:**
- Create: `frappe-app/pyproject.toml`, `frappe-app/README.md`, `frappe-app/license.txt`, `frappe-app/.gitignore`
- Create: `frappe-app/y_next/__init__.py`, `frappe-app/y_next/hooks.py`, `frappe-app/y_next/modules.txt`, `frappe-app/y_next/patches.txt`
- Create: `frappe-app/y_next/y_next/__init__.py`, `frappe-app/y_next/y_next/.frappe`, `frappe-app/y_next/public/.gitkeep`
- Create: `frappe-app/y_next/tests/__init__.py`, `frappe-app/y_next/tests/test_skelet.py`
- Create: `scripts/dev-bench-sync.mjs`, `scripts/dev-bench-sync.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `node scripts/dev-bench-sync.mjs [--migrate]` (leest `YNEXT_BENCH_DIR`, `YNEXT_BENCH_SITE`); Python-pakket `y_next` met `y_next.__version__` (string) en `y_next.hooks.required_apps`.

- [x] **Step 1: Schrijf de falende test voor het kopieerscript**

`scripts/dev-bench-sync.test.mjs`:

```js
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
```

- [x] **Step 2: Draai de test en zie hem falen**

Run: `node --test scripts/dev-bench-sync.test.mjs`
Expected: FAIL met `Cannot find module` voor `dev-bench-sync.mjs`.

- [x] **Step 3: Schrijf het kopieerscript**

`scripts/dev-bench-sync.mjs`:

```js
#!/usr/bin/env node
/**
 * Zet de app uit `frappe-app/` op een lokale ontwikkel-bench die in Docker
 * Compose draait, en installeert of migreert hem op één site.
 *
 * De bench staat in een volume en niet op de schijf van de ontwikkelmachine,
 * dus de app wordt erin gekopieerd. Bij elke run wordt de map in de bench
 * vervangen; verwijderde bestanden blijven zo niet achter.
 *
 * Omgeving:
 *   YNEXT_BENCH_DIR      map met het docker-compose.yml van de bench (verplicht)
 *   YNEXT_BENCH_SITE     site waarop de app komt (verplicht)
 *   YNEXT_BENCH_SERVICE  naam van de compose-service (standaard "frappe")
 *   YNEXT_BENCH_PATH     pad van de bench in de container (standaard /workspace/frappe-bench)
 *
 * Gebruik:
 *   node scripts/dev-bench-sync.mjs            kopiëren; installeren als dat nog niet gebeurd is
 *   node scripts/dev-bench-sync.mjs --migrate  kopiëren en daarna `bench migrate`
 */
import { spawnSync } from "node:child_process";
import { join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const APP_NAME = "y_next";

/**
 * Leest en valideert de omgeving.
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ benchDir: string, site: string, service: string, benchPath: string }}
 */
export function benchConfig(env) {
  const benchDir = env.YNEXT_BENCH_DIR;
  const site = env.YNEXT_BENCH_SITE;
  if (!benchDir) {
    throw new Error("YNEXT_BENCH_DIR ontbreekt: de map met het docker-compose.yml van de bench.");
  }
  if (!site) {
    throw new Error("YNEXT_BENCH_SITE ontbreekt: de site waarop de app geïnstalleerd wordt.");
  }
  return {
    benchDir,
    site,
    service: env.YNEXT_BENCH_SERVICE || "frappe",
    benchPath: (env.YNEXT_BENCH_PATH || "/workspace/frappe-bench").replace(/\/+$/, ""),
  };
}

/** Maakt de app-map in de bench leeg. */
export function prepareScript({ benchPath }) {
  const appPath = `${benchPath}/apps/${APP_NAME}`;
  return `rm -rf ${appPath} && mkdir -p ${appPath}`;
}

/** `docker compose cp` schrijft als root; de bench draait als gebruiker frappe. */
export function ownScript({ benchPath }) {
  return `chown -R frappe:frappe ${benchPath}/apps/${APP_NAME}`;
}

/** Eerste installatie: pakket in de env, app in apps.txt, assets koppelen, op de site zetten. */
export function installScript({ benchPath, site }) {
  return [
    `cd ${benchPath}`,
    `uv pip install --quiet -e apps/${APP_NAME} --python env/bin/python`,
    // apps.txt eindigt niet altijd op een regeleinde; zonder deze controle
    // plakt de nieuwe naam aan de vorige regel vast.
    `{ grep -qxF ${APP_NAME} sites/apps.txt || { [ -z "$(tail -c1 sites/apps.txt)" ] || echo >> sites/apps.txt; echo ${APP_NAME} >> sites/apps.txt; }; }`,
    `bench build --app ${APP_NAME}`,
    `bench --site ${site} install-app ${APP_NAME}`,
  ].join(" && ");
}

export function migrateScript({ benchPath, site }) {
  return `cd ${benchPath} && bench --site ${site} migrate && bench --site ${site} clear-cache`;
}

export function listAppsScript({ benchPath, site }) {
  return `cd ${benchPath} && bench --site ${site} list-apps`;
}

/** Staat de app in de uitvoer van `bench list-apps`? */
export function isInstalled(listAppsOutput) {
  return String(listAppsOutput)
    .split(/\r?\n/)
    .some((line) => line.trim().split(/\s+/)[0] === APP_NAME);
}

function compose(config, args, options = {}) {
  const result = spawnSync("docker", ["compose", ...args], {
    cwd: config.benchDir,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`docker compose ${args.slice(0, 2).join(" ")} mislukt (exitcode ${result.status}).`);
  }
  return result.stdout || "";
}

function inBench(config, script, { root = false, capture = false } = {}) {
  const user = root ? ["-u", "root"] : [];
  return compose(config, ["exec", "-T", ...user, config.service, "bash", "-lc", script], { capture });
}

function main() {
  const config = benchConfig(process.env);
  const migrate = process.argv.includes("--migrate");
  const appDir = join(ROOT, "frappe-app");

  inBench(config, prepareScript(config), { root: true });
  compose(config, ["cp", `${appDir}/.`, `${config.service}:${config.benchPath}/apps/${APP_NAME}`]);
  inBench(config, ownScript(config), { root: true });

  if (!isInstalled(inBench(config, listAppsScript(config), { capture: true }))) {
    inBench(config, installScript(config));
    // De draaiende bench kent de nieuwe app pas na een herstart.
    compose(config, ["restart", config.service]);
    console.log(`${APP_NAME} is geïnstalleerd op ${config.site}; de bench is herstart.`);
    return;
  }
  if (migrate) inBench(config, migrateScript(config));
  console.log(`${APP_NAME} is bijgewerkt op de bench${migrate ? ` en ${config.site} is gemigreerd` : ""}.`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);

if (isDirectRun) {
  try {
    main();
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exitCode = 1;
  }
}
```

- [x] **Step 4: Draai de test en zie hem slagen**

Run: `node --test scripts/dev-bench-sync.test.mjs`
Expected: 6 tests, 0 failures.

- [x] **Step 5: Schrijf de falende Python-test voor het skelet**

`frappe-app/y_next/tests/__init__.py`: leeg bestand.

`frappe-app/y_next/tests/test_skelet.py`:

```python
import os
import tomllib

import frappe
from frappe.tests import UnitTestCase


class TestSkelet(UnitTestCase):
	"""Bewaakt het uitgangspunt: kale ERPNext, geen afhankelijkheden."""

	def test_alleen_erpnext_is_vereist(self):
		self.assertEqual(frappe.get_hooks("required_apps", app_name="y_next"), ["erpnext"])

	def test_geen_python_afhankelijkheden(self):
		pad = os.path.join(os.path.dirname(frappe.get_app_path("y_next")), "pyproject.toml")
		with open(pad, "rb") as bestand:
			project = tomllib.load(bestand)
		self.assertEqual(project["project"]["dependencies"], [])
		self.assertEqual(
			project["tool"]["bench"]["frappe-dependencies"],
			{"frappe": ">=16.0.0,<17.0.0", "erpnext": ">=16.0.0,<17.0.0"},
		)

	def test_versie_is_een_versienummer(self):
		import y_next

		self.assertRegex(y_next.__version__, r"^\d+\.\d+\.\d+$")
```

- [x] **Step 6: Schrijf het skelet**

`frappe-app/pyproject.toml`:

```toml
[project]
name = "y_next"
authors = [
    { name = "OpenAEC Foundation", email = "info@openaec.org" }
]
description = "Web interface for ERPNext"
requires-python = ">=3.14"
readme = "README.md"
dynamic = ["version"]
dependencies = []

[build-system]
requires = ["flit_core >=3.4,<4"]
build-backend = "flit_core.buildapi"

[tool.bench.frappe-dependencies]
frappe = ">=16.0.0,<17.0.0"
erpnext = ">=16.0.0,<17.0.0"

[tool.ruff]
line-length = 110
target-version = "py314"

[tool.ruff.format]
quote-style = "double"
indent-style = "tab"
```

`frappe-app/y_next/__init__.py`:

```python
__version__ = "0.39.4"
```

(De versie volgt `package.json` in de wortel; het releasescript van fase 8 schrijft hem bij.)

`frappe-app/y_next/hooks.py`:

```python
app_name = "y_next"
app_title = "Y-next"
app_publisher = "OpenAEC Foundation"
app_description = "Web interface for ERPNext"
app_email = "info@openaec.org"
app_license = "mit"

# De enige vereiste app. Y-next leunt alleen op wat in kale ERPNext zit of op
# wat deze app zelf meebrengt; al het andere is een optionele koppeling.
required_apps = ["erpnext"]

add_to_apps_screen = [
	{
		"name": "y_next",
		"logo": "/assets/y_next/app/y-logo.svg",
		"title": "Y-next",
		"route": "/y-next",
	}
]
```

`frappe-app/y_next/modules.txt`:

```text
Y Next
```

`frappe-app/y_next/patches.txt`:

```text
[pre_model_sync]

[post_model_sync]
```

`frappe-app/y_next/y_next/__init__.py`, `frappe-app/y_next/y_next/.frappe` en `frappe-app/y_next/public/.gitkeep`: lege bestanden.

`frappe-app/.gitignore`:

```text
__pycache__/
*.pyc
*.egg-info/
.DS_Store
```

`frappe-app/license.txt`: de tekst van `LICENSE` in de wortel, ongewijzigd.

`frappe-app/README.md`:

```markdown
# Y-next

Web interface for ERPNext. Y-next runs on the same site as the data it shows:
it uses the ERPNext session of the signed-in user and reads and writes through
the standard Frappe/ERPNext API.

## Requirements

- Frappe 16 and ERPNext 16. Nothing else: no other apps, no extra Python
  packages and no Node build on the server.

Optional, switched on automatically when present: HRMS (leave, expense claims),
Wiki (knowledge base).

## Install

    bench get-app https://github.com/OpenAEC-Foundation/y_next --branch version-16
    bench --site your.site install-app y_next

Then open `/y-next` on your site.

## Source

This repository is assembled by a release script and holds the built frontend.
Development happens in the source repository:
<https://github.com/OpenAEC-Foundation/Y-app-ERPNext>. Please open issues and
pull requests there.

## License

MIT
```

Voeg in `.gitignore` in de wortel, direct onder de regel `dist_bak`, toe:

```text
frappe-app/y_next/public/app/
```

- [x] **Step 7: Zet de app op de bench**

Run:

```bash
node scripts/dev-bench-sync.mjs
```

Expected: laatste regel `y_next is geïnstalleerd op kaal.localhost; de bench is herstart.`

- [x] **Step 8: Draai de Python-test en zie hem slagen**

Run de testopdracht uit *Lokale bench*.
Expected: `Ran 3 tests` en `OK`.

Controleer daarnaast:

```bash
cd "$YNEXT_BENCH_DIR" && MSYS_NO_PATHCONV=1 docker compose exec -T frappe bash -lc "cd /workspace/frappe-bench && bench --site kaal.localhost list-apps"
```

Expected: drie regels — `frappe`, `erpnext`, `y_next`.

- [ ] **Step 9: Vastleggen (alleen op verzoek)**

```bash
git add .gitignore frappe-app scripts/dev-bench-sync.mjs scripts/dev-bench-sync.test.mjs
git commit -m "feat: skelet van de Frappe-app y_next"
```

---

### Task 2: De bundel van de app bouwen

**Files:**
- Create: `scripts/build-frappe-app.mjs`, `scripts/build-frappe-app.test.mjs`

**Interfaces:**
- Produces: `node scripts/build-frappe-app.mjs` (leest optioneel `YNEXT_FRONTEND_DIR`); schrijft `frappe-app/y_next/public/app/` met daarin `.vite/manifest.json`. Exports `APP_BASE = "/assets/y_next/app/"`, `findEntry(manifest) -> { js: string, css: string[] } | null`.

- [x] **Step 1: Schrijf de falende test**

`scripts/build-frappe-app.test.mjs`:

```js
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
```

- [x] **Step 2: Draai de test en zie hem falen**

Run: `node --test scripts/build-frappe-app.test.mjs`
Expected: FAIL met `Cannot find module` voor `build-frappe-app.mjs`.

- [x] **Step 3: Schrijf het buildscript**

`scripts/build-frappe-app.mjs`:

```js
#!/usr/bin/env node
/**
 * Bouwt de frontend als bundel van de Frappe-app.
 *
 * Het is dezelfde Vite-build als voor de publicatieroute. Twee dingen
 * verschillen, en die gaan via de opdrachtregel mee zodat de
 * Vite-configuratie ongemoeid blijft:
 *
 *   - `base` is /assets/y_next/app/: daar serveert Frappe de publieke map van
 *     de app;
 *   - de uitvoer gaat naar frappe-app/y_next/public/app/.
 *
 * De build-tag staat vast op "app". Onveranderde chunks houden zo tussen
 * releases dezelfde bestandsnaam, en de distributierepository groeit per
 * release alleen met wat er echt veranderd is.
 *
 * Dit script controleert geen types; dat doet `npm run build`.
 *
 * Omgeving:
 *   YNEXT_FRONTEND_DIR  frontendmap om te bouwen (standaard packages/frontend
 *                       in deze repository). Voor een checkout waar de
 *                       afhankelijkheden al geïnstalleerd zijn.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const APP_BASE = "/assets/y_next/app/";
export const APP_BUILD_TAG = "app";

/** De frontendmap die gebouwd wordt. */
export function resolveFrontendDir(env, root = ROOT) {
  return env.YNEXT_FRONTEND_DIR ? resolvePath(env.YNEXT_FRONTEND_DIR) : join(root, "packages", "frontend");
}

/** Waar de bundel terechtkomt: de publieke map van de app. */
export function bundleOutDir(root = ROOT) {
  return join(root, "frappe-app", "y_next", "public", "app");
}

/** De argumenten voor `vite`. `--emptyOutDir` is nodig omdat de uitvoermap buiten de frontendmap ligt. */
export function viteBuildArgs(outDir) {
  return ["build", "--base", APP_BASE, "--outDir", outDir, "--emptyOutDir"];
}

/**
 * Zoekt het startbestand in een Vite-manifest.
 * @param {Record<string, { file: string, isEntry?: boolean, css?: string[] }>} manifest
 * @returns {{ js: string, css: string[] } | null}
 */
export function findEntry(manifest) {
  const entry = Object.values(manifest).find((chunk) => chunk && chunk.isEntry);
  return entry ? { js: entry.file, css: entry.css || [] } : null;
}

function main() {
  const frontendDir = resolveFrontendDir(process.env);
  const outDir = bundleOutDir();
  const require = createRequire(join(frontendDir, "package.json"));

  let viteBin;
  try {
    viteBin = join(dirname(require.resolve("vite/package.json")), "bin", "vite.js");
  } catch {
    throw new Error(
      `Vite is niet gevonden vanuit ${frontendDir}. Draai eerst \`npm install\`, of wijs met ` +
        "YNEXT_FRONTEND_DIR een checkout aan waar de afhankelijkheden staan."
    );
  }

  // web-ifc.wasm staat niet in git; de gewone build kopieert het ook eerst.
  copyFileSync(require.resolve("web-ifc/web-ifc.wasm"), join(frontendDir, "public", "web-ifc.wasm"));

  const result = spawnSync(process.execPath, [viteBin, ...viteBuildArgs(outDir)], {
    cwd: frontendDir,
    stdio: "inherit",
    env: { ...process.env, YNEXT_BUILD_TAG: APP_BUILD_TAG },
  });
  if (result.status !== 0) {
    throw new Error(`De Vite-build is mislukt (exitcode ${result.status}).`);
  }

  const manifest = JSON.parse(readFileSync(join(outDir, ".vite", "manifest.json"), "utf8"));
  const entry = findEntry(manifest);
  if (!entry) {
    throw new Error("Geen startbestand (isEntry) gevonden in het Vite-manifest.");
  }
  console.log(`Bundel gebouwd in ${outDir} (start: ${entry.js}, stylesheets: ${entry.css.length}).`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);

if (isDirectRun) {
  try {
    main();
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exitCode = 1;
  }
}
```

- [x] **Step 4: Draai de test en zie hem slagen**

Run: `node --test scripts/build-frappe-app.test.mjs`
Expected: 5 tests, 0 failures.

- [x] **Step 5: Bouw de bundel**

Run (vanuit een checkout met geïnstalleerde afhankelijkheden; anders eerst `YNEXT_FRONTEND_DIR` zetten):

```bash
node scripts/build-frappe-app.mjs
```

Expected: laatste regel `Bundel gebouwd in …frappe-app/y_next/public/app (start: yapp-index-….js, stylesheets: 1).`

Controleer:

```bash
node -e "const m=require('./frappe-app/y_next/public/app/.vite/manifest.json');console.log(Object.values(m).filter(c=>c.isEntry).length)"
grep -c "/assets/y_next/app/" frappe-app/y_next/public/app/yapp-index-*.js
git status --short frappe-app/y_next/public
```

Expected: `1`; een getal groter dan 0; en geen regels voor `public/app/` (de map is genegeerd).

- [ ] **Step 6: Vastleggen (alleen op verzoek)**

```bash
git add scripts/build-frappe-app.mjs scripts/build-frappe-app.test.mjs
git commit -m "feat: bundel van de Frappe-app bouwen"
```

---

### Task 3: De pagina `/y-next` uit de app

**Files:**
- Create: `frappe-app/y_next/bundle.py`
- Create: `frappe-app/y_next/www/__init__.py`, `frappe-app/y_next/www/y_next.py`, `frappe-app/y_next/www/y-next.html`
- Create: `frappe-app/y_next/tests/test_bundle.py`, `frappe-app/y_next/tests/test_pagina.py`

**Interfaces:**
- Consumes: de bundel uit Task 2 in `frappe-app/y_next/public/app/` (met `.vite/manifest.json`); `node scripts/dev-bench-sync.mjs` uit Task 1.
- Produces: `y_next.bundle.parse_manifest(manifest: dict) -> dict | None` en `y_next.bundle.get_entry() -> dict | None`, beide met de vorm `{"js": str, "css": list[str]}`; de route `/y-next`.

- [x] **Step 1: Schrijf de falende tests**

`frappe-app/y_next/tests/test_bundle.py`:

```python
from frappe.tests import UnitTestCase

from y_next.bundle import parse_manifest


class TestParseManifest(UnitTestCase):
	def test_vindt_startbestand_en_stylesheets(self):
		manifest = {
			"index.html": {"file": "yapp-index-abc.js", "isEntry": True, "css": ["yapp-index-def.css"]},
			"src/x.ts": {"file": "yapp-x-123.js"},
		}
		self.assertEqual(
			parse_manifest(manifest),
			{"js": "yapp-index-abc.js", "css": ["yapp-index-def.css"]},
		)

	def test_startbestand_zonder_stylesheets(self):
		self.assertEqual(
			parse_manifest({"index.html": {"file": "a.js", "isEntry": True}}),
			{"js": "a.js", "css": []},
		)

	def test_geen_startbestand(self):
		self.assertIsNone(parse_manifest({"src/x.ts": {"file": "yapp-x-123.js"}}))
		self.assertIsNone(parse_manifest({}))
```

`frappe-app/y_next/tests/test_pagina.py`:

```python
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import set_request
from frappe.website.serve import get_response

BUNDEL = {"js": "yapp-index-abc.js", "css": ["yapp-index-def.css"]}


class TestPagina(IntegrationTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def haal(self, bundel=BUNDEL):
		with patch("y_next.www.y_next.get_entry", return_value=bundel):
			set_request(method="GET", path="y-next")
			response = get_response()
		return response, frappe.safe_decode(response.get_data())

	def test_laadt_de_bundel_uit_de_app(self):
		response, html = self.haal()
		self.assertEqual(response.status_code, 200)
		self.assertIn('<div id="root" data-y-next-router="hash"></div>', html)
		self.assertIn('<script type="module" src="/assets/y_next/app/yapp-index-abc.js"></script>', html)
		self.assertIn('<link rel="stylesheet" href="/assets/y_next/app/yapp-index-def.css" />', html)

	def test_staat_los_van_het_websitesjabloon(self):
		_, html = self.haal()
		self.assertTrue(html.lstrip().lower().startswith("<!doctype html>"))
		self.assertNotIn("navbar", html)
		self.assertNotIn("/assets/frappe/", html)

	def test_ingelogde_gebruiker_krijgt_een_csrf_token(self):
		frappe.set_user("Administrator")
		_, html = self.haal()
		self.assertRegex(html, r'window\.csrf_token = "[0-9a-f]{16,}";')

	def test_gast_krijgt_een_leeg_token(self):
		frappe.set_user("Guest")
		response, html = self.haal()
		self.assertEqual(response.status_code, 200)
		self.assertIn('window.csrf_token = "";', html)

	def test_meldt_een_ontbrekende_bundel(self):
		_, html = self.haal(bundel=None)
		self.assertIn("De bundel van Y-next ontbreekt", html)
		self.assertNotIn('id="root"', html)
```

- [x] **Step 2: Draai de tests en zie ze falen**

Run: `node scripts/dev-bench-sync.mjs` en daarna de testopdracht uit *Lokale bench*.
Expected: FAIL — `ModuleNotFoundError: No module named 'y_next.bundle'`.

- [x] **Step 3: Schrijf het lezen van het manifest**

`frappe-app/y_next/bundle.py`:

```python
"""De gebouwde frontend van Y-next.

De bundel staat in `public/app/` en Frappe serveert die map op
`/assets/y_next/app/`. Vite schrijft er een manifest bij waarin staat welk
bestand het startpunt is; de bestandsnamen bevatten een hash en veranderen dus
per build.
"""

import json
import os

import frappe

BASE_URL = "/assets/y_next/app/"


def parse_manifest(manifest: dict) -> dict | None:
	"""Geeft het startbestand en zijn stylesheets uit een Vite-manifest."""
	for chunk in manifest.values():
		if isinstance(chunk, dict) and chunk.get("isEntry"):
			return {"js": chunk["file"], "css": list(chunk.get("css") or [])}
	return None


def get_entry() -> dict | None:
	"""Het startbestand van de geïnstalleerde bundel, of None als er geen bundel is."""
	pad = frappe.get_app_path("y_next", "public", "app", ".vite", "manifest.json")
	if not os.path.exists(pad):
		return None
	with open(pad, encoding="utf-8") as bestand:
		return parse_manifest(json.load(bestand))
```

- [x] **Step 4: Schrijf de pagina**

`frappe-app/y_next/www/__init__.py`: leeg bestand.

`frappe-app/y_next/www/y_next.py`:

```python
"""De pagina /y-next: het HTML-omhulsel waarin de frontend start."""

import frappe
import frappe.sessions

from y_next.bundle import BASE_URL, get_entry

# De pagina draagt het CSRF-token van de sessie en mag daarom nooit uit een
# cache komen: een bezoeker die uitgelogd binnenkwam, zou na het inloggen
# anders de pagina van de gast terugkrijgen.
no_cache = 1


def get_context(context):
	bundel = get_entry()
	context.no_cache = 1
	context.base_url = BASE_URL
	context.entry_js = bundel["js"] if bundel else None
	context.entry_css = bundel["css"] if bundel else []
	context.csrf_token = ""
	if frappe.session.user != "Guest":
		context.csrf_token = frappe.sessions.get_csrf_token()
		frappe.db.commit()
	return context
```

`frappe-app/y_next/www/y-next.html`:

```html
<!doctype html>
<html lang="nl">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
		<meta name="theme-color" content="#0f172a" />
		<title>Y-next</title>
		{%- if entry_js %}
		<link rel="icon" type="image/svg+xml" href="{{ base_url }}y-logo.svg" />
		{%- for css in entry_css %}
		<link rel="stylesheet" href="{{ base_url }}{{ css }}" />
		{%- endfor %}
		{%- endif %}
	</head>
	<body>
		{%- if entry_js %}
		<div id="root" data-y-next-router="hash"></div>
		<script>
			window.csrf_token = "{{ csrf_token }}";
		</script>
		<script type="module" src="{{ base_url }}{{ entry_js }}"></script>
		{%- else %}
		<p>De bundel van Y-next ontbreekt in deze installatie. Installeer de app opnieuw of neem contact op met beheer.</p>
		{%- endif %}
	</body>
</html>
```

- [x] **Step 5: Draai de tests en zie ze slagen**

Run: `node scripts/dev-bench-sync.mjs` en daarna de testopdracht uit *Lokale bench*.
Expected: `Ran 11 tests` en `OK` (3 skelet, 3 bundel, 5 pagina).

- [x] **Step 6: Controleer de pagina op de kale site**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://kaal.localhost:8000/y-next
curl -sI http://kaal.localhost:8000/y-next | grep -i "cache-control"
curl -s http://kaal.localhost:8000/y-next | grep -oE 'src="/assets/y_next/app/[^"]+"'
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "http://kaal.localhost:8000$(curl -s http://kaal.localhost:8000/y-next | grep -oE '/assets/y_next/app/yapp-index-[^"]+\.js')"
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://kaal.localhost:8000/assets/y_next/app/web-ifc.wasm
```

Expected: `200`; `Cache-Control: no-store,no-cache,must-revalidate,max-age=0`; één `src="/assets/y_next/app/yapp-index-….js"`; `200` met een JavaScript-type; `200 application/wasm`.

Open daarna `http://kaal.localhost:8000/y-next` in de browser, ingelogd als Administrator.
Expected: het dashboard van Y-next verschijnt en `window.csrf_token` is een niet-lege tekenreeks. Lijsten die een nog niet bestaand veld opvragen geven in deze fase een fout; dat lost fase 2 en 3 op.

- [ ] **Step 7: Vastleggen (alleen op verzoek)**

```bash
git add frappe-app/y_next/bundle.py frappe-app/y_next/www frappe-app/y_next/tests
git commit -m "feat: pagina /y-next uit de app"
```

---

### Task 4: Werkwijze vastleggen en tests aansluiten

**Files:**
- Create: `docs/frappe-app.md`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Consumes: de scripts uit Task 1 en 2.

- [x] **Step 1: Sluit de nieuwe tests aan op `npm test`**

Vervang in `package.json` in het script `test` het deel
`node --test scripts/deploy-y-next.test.mjs scripts/provision-y-next.test.mjs scripts/lib/semver-bump.test.mjs`
door
`node --test scripts/deploy-y-next.test.mjs scripts/provision-y-next.test.mjs scripts/lib/semver-bump.test.mjs scripts/dev-bench-sync.test.mjs scripts/build-frappe-app.test.mjs`.

- [x] **Step 2: Draai de scripttests**

Run: `node --test scripts/deploy-y-next.test.mjs scripts/provision-y-next.test.mjs scripts/lib/semver-bump.test.mjs scripts/dev-bench-sync.test.mjs scripts/build-frappe-app.test.mjs`
Expected: 0 failures.

- [x] **Step 3: Schrijf de werkwijze**

`docs/frappe-app.md`:

```markdown
# Y-next als Frappe-app: werkwijze

De app staat in `frappe-app/`. Het ontwerp staat in
`docs/superpowers/specs/2026-10-10-y-next-frappe-app-design.md`.

## Wat je nodig hebt

- Een lokale bench met Frappe 16 en ERPNext 16 in Docker Compose, met een site
  waar alleen die twee apps op staan.
- Node 24 en de afhankelijkheden van de frontend (`npm install`).

Zet twee omgevingsvariabelen:

    YNEXT_BENCH_DIR   map met het docker-compose.yml van de bench
    YNEXT_BENCH_SITE  de site waarop de app komt

## Bouwen en installeren

    node scripts/build-frappe-app.mjs     bundel bouwen in frappe-app/y_next/public/app/
    node scripts/dev-bench-sync.mjs       app naar de bench kopiëren; de eerste keer ook installeren

Open daarna `/y-next` op de site.

Na een wijziging in Python of in de bundel is `node scripts/dev-bench-sync.mjs`
genoeg. Verandert er iets aan doctypes, velden of rechten, gebruik dan
`node scripts/dev-bench-sync.mjs --migrate`.

## Testen

    node --test scripts/dev-bench-sync.test.mjs scripts/build-frappe-app.test.mjs
    bench --site <site> run-tests --app y_next        (in de bench)

De site heeft `allow_tests` nodig: `bench --site <site> set-config allow_tests true`.

## Hoe het in elkaar zit

- `www/y-next.html` is een volledig HTML-document; Frappe zet er daarom geen
  websitesjabloon omheen. `www/y_next.py` levert het CSRF-token en zet de
  pagina op niet-cachen.
- De bundel is dezelfde Vite-build als voor de publicatieroute, met `base`
  `/assets/y_next/app/`. De pagina leest `.vite/manifest.json` om het
  startbestand te vinden.
- `frappe-app/y_next/public/app/` staat in `.gitignore`: de bundel hoort niet
  in deze repository, wel in de distributierepository.
```

- [ ] **Step 4: Vastleggen (alleen op verzoek)**

```bash
git add package.json docs/frappe-app.md
git commit -m "docs: werkwijze voor de Frappe-app"
```

---

## Vervolg

Fase 2 tot en met 8 staan in de sectie *Fasering* van het ontwerp. Elke fase krijgt een eigen plan in deze map zodra de vorige is opgeleverd, omdat de uitwerking afhangt van wat de vorige fase oplevert (bijvoorbeeld: de definitieve veldenlijst volgt uit de doorloop op de kale site).
