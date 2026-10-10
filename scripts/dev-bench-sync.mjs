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
