/**
 * Build script: bundles server into a single CJS file for deployment.
 * The bundled file can be run with: node dist/server.cjs
 */

import { build } from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Versie uit het manifest in de bundel bakken → /api/app-version serveert 'm
// (gebruikt door de desktop-app om "nieuwe versie beschikbaar" te tonen).
const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;

await build({
  entryPoints: [resolve(root, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: resolve(root, "dist/server.cjs"),
  external: ["argon2", "better-sqlite3"],
  resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  define: { "process.env.APP_VERSION": JSON.stringify(version) },
  sourcemap: false,
  minify: true,
  treeShaking: true,
});

console.log("[build-server] Done → dist/server.cjs");
