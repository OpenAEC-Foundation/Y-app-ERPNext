#!/usr/bin/env node
/**
 * Automatische versie-bump + changelog + release-notes (keuze B, tag-ONAFHANKELIJK).
 *
 * Bron van waarheid = de manifest-versie (packages/frontend/package.json).
 * Tags worden NIET gebruikt om "de laatste versie" te sorteren (de repo heeft een
 * stray v1.1.0 die dat verstoort). In plaats daarvan checkt het script alleen of
 * het EXACTE tag `v{huidige-versie}` al bestaat:
 *
 *   - tag bestaat NIET → de huidige manifest-versie is nog niet uitgebracht →
 *     breng 'm uit zoals hij is (geen bump). Release-notes = de bestaande
 *     CHANGELOG-sectie `## v{versie}` (handgeschreven), of anders gegenereerd.
 *   - tag bestaat WÉL → al uitgebracht → bepaal de bump uit de Conventional
 *     Commits sinds `v{versie}` (feat→minor, fix→patch, `!`/BREAKING→major),
 *     schrijf de 4 manifests en prepend een nieuwe CHANGELOG-sectie.
 *
 * Output: `version=vX.Y.Z` + `bumped=true|false` naar stdout en (in CI) $GITHUB_OUTPUT.
 * Schrijft RELEASE_NOTES.md (body voor de GitHub Release).
 * `--dry-run`: berekent + print, schrijft niets.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { bumpLevelFromCommits, applyBump, groupCommitsForChangelog } from "./lib/semver-bump.mjs";

const DRY = process.argv.includes("--dry-run");
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MANIFESTS = [
  "package.json",
  "packages/frontend/package.json",
  "packages/server/package.json",
  "packages/desktop/src-tauri/tauri.conf.json",
];
const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
const date = new Date().toISOString().slice(0, 10);

const current = JSON.parse(readFileSync(join(ROOT, "packages/frontend/package.json"), "utf8")).version;
let released = false;
try { released = sh(`git tag -l "v${current}"`) !== ""; } catch { /* ignore */ }

let next, level, section, bumped;

if (!released) {
  // Huidige manifest-versie nog niet uitgebracht → uitbrengen zoals hij is.
  bumped = false;
  next = current;
  level = "none (release current as-is)";
  section = extractChangelogSection(`v${current}`) || generateSection(`v${current}`, []);
} else {
  // Al uitgebracht → bump o.b.v. commits sinds het exacte tag v{current}.
  bumped = true;
  let messages = [];
  try { messages = sh(`git log v${current}..HEAD --format=%B%x1e`).split("\x1e").map((s) => s.trim()).filter(Boolean); } catch { /* ignore */ }
  level = bumpLevelFromCommits(messages);
  next = applyBump(current, level);
  section = generateSection(`v${next}`, messages);
}
const tag = `v${next}`;

console.log(`[auto-version] current=${current} releasedTagExists=${released} → ${tag} (bumped=${bumped}, level=${level})`);

if (DRY) {
  console.log("\n----- release-notes (dry-run) -----\n" + section);
  process.exit(0);
}

if (bumped) {
  for (const f of MANIFESTS) {
    const p = join(ROOT, f);
    writeFileSync(p, readFileSync(p, "utf8").replace(/"version":\s*"[^"]+"/, `"version": "${next}"`));
  }
  const clPath = join(ROOT, "CHANGELOG.md");
  const cl = readFileSync(clPath, "utf8");
  const idx = cl.indexOf("\n## ");
  writeFileSync(clPath, idx >= 0 ? cl.slice(0, idx + 1) + section + "\n" + cl.slice(idx + 1) : `${cl}\n${section}`);
}

writeFileSync(join(ROOT, "RELEASE_NOTES.md"), section);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${tag}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `bumped=${bumped}\n`);
}
console.log(`[auto-version] klaar → ${tag}${bumped ? " (manifests + CHANGELOG bijgewerkt)" : " (as-is, geen manifest-wijziging)"}`);

function generateSection(tagName, messages) {
  const groups = groupCommitsForChangelog(messages);
  let out = `## ${tagName} — ${date}\n\n`;
  if (groups.size === 0) return out + "_Onderhoud / interne wijzigingen._\n";
  for (const [title, lines] of groups) {
    out += `### ${title}\n`;
    for (const l of lines) out += `- ${l}\n`;
    out += "\n";
  }
  return out;
}

function extractChangelogSection(tagName) {
  try {
    const cl = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
    const start = cl.indexOf(`## ${tagName} `);
    if (start < 0) return null;
    const after = cl.indexOf("\n## ", start + 3);
    return cl.slice(start, after >= 0 ? after : undefined).trim() + "\n";
  } catch { return null; }
}
