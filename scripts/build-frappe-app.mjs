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
import { writeOfficeNotices } from "./lib/office-notices.mjs";
import { prepareStudioAssets, validateStudioAssets } from "./lib/studio-assets.mjs";
import { studioBuildInputs } from "./lib/studio-build.mjs";

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
  const studioInputs = studioBuildInputs(process.env, ROOT);
  const frontendDir = resolveFrontendDir(process.env);
  const outDir = bundleOutDir();
  validateStudioAssets({ ...studioInputs, outDir });
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

  writeOfficeNotices(frontendDir, outDir, join(ROOT, "scripts", "legal", "betteroffice-0.3.0"));
  prepareStudioAssets({ ...studioInputs, outDir });

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
