#!/usr/bin/env node
/**
 * Stelt een release van de Frappe-app samen in een checkout van de
 * distributierepository.
 *
 * Alle broncode staat in deze repository. De repository waar gebruikers de
 * app uit installeren (`bench get-app`) bevat alleen het resultaat: de map
 * `frappe-app/` met de gebouwde frontend erin. Dit script maakt dat resultaat.
 *
 * Stappen:
 *   1. de werkmap is schoon, en tests en typecontrole slagen;
 *   2. de bundel wordt gebouwd;
 *   3. `frappe-app/` gaat naar het doel, met de versie van Y-next erin;
 *   4. de generiek-controle keurt het resultaat;
 *   5. één commit `Release <versie>` en de tag `v<versie>` in het doel;
 *   6. alleen met `--publiceer`: pushen en de GitHub-release maken.
 *
 * Gebruik:
 *   node scripts/release-frappe-app.mjs --doel ../y_next
 *   node scripts/release-frappe-app.mjs --doel ../y_next --publiceer
 *
 * Opties:
 *   --doel <map>     checkout van de distributierepository op branch
 *                    version-16; een map die nog niet bestaat wordt als nieuwe
 *                    repository aangemaakt
 *   --publiceer      pusht branch en tag naar `origin` en maakt de release
 *   --zonder-tests   slaat stap 1 over (alleen om het samenstellen te proeven)
 *   --zonder-bouw    gebruikt de bundel die er al staat
 *   --trailer <r>    extra regel onder het commitbericht
 *
 * De Python-tests draaien op een bench en niet vanuit dit script; zie
 * docs/frappe-app.md.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { controleerMap } from "./lib/generiek-check.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const DOELREPO = "OpenAEC-Foundation/y_next";
export const DOELBRANCH = "version-16";

/** Leest de vlaggen. `--doel` is verplicht. */
export function parseArgs(argv) {
  const uit = { doel: "", publiceer: false, zonderTests: false, zonderBouw: false, trailer: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--publiceer") uit.publiceer = true;
    else if (arg === "--zonder-tests") uit.zonderTests = true;
    else if (arg === "--zonder-bouw") uit.zonderBouw = true;
    else if (arg === "--doel") uit.doel = argv[(i += 1)] || "";
    else if (arg.startsWith("--doel=")) uit.doel = arg.slice("--doel=".length);
    else if (arg === "--trailer") uit.trailer = argv[(i += 1)] || "";
    else if (arg.startsWith("--trailer=")) uit.trailer = arg.slice("--trailer=".length);
  }
  if (!uit.doel) {
    throw new Error("Geef met --doel de checkout van de distributierepository op.");
  }
  return uit;
}

/** De versie van Y-next: die van `package.json` in de hoofdmap. */
export function leesVersie(root = ROOT) {
  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (!/^\d+\.\d+\.\d+$/.test(String(version))) {
    throw new Error(`De versie in package.json is geen versienummer: ${version}`);
  }
  return version;
}

/** Zet de versie in de tekst van `y_next/__init__.py`. */
export function zetVersie(tekst, versie) {
  const patroon = /^__version__\s*=\s*["'][^"']*["']/m;
  if (!patroon.test(tekst)) {
    throw new Error("Geen regel met __version__ gevonden in y_next/__init__.py.");
  }
  return tekst.replace(patroon, `__version__ = "${versie}"`);
}

/** Wat niet in een release hoort: wat Python en het besturingssysteem achterlaten. */
export function slaOver(naam) {
  return naam === "__pycache__" || naam === ".DS_Store" || naam.endsWith(".pyc") || naam.endsWith(".egg-info");
}

function telBestanden(map) {
  let aantal = 0;
  for (const naam of readdirSync(map)) {
    if (naam === ".git") continue;
    const pad = join(map, naam);
    aantal += statSync(pad).isDirectory() ? telBestanden(pad) : 1;
  }
  return aantal;
}

/**
 * Maakt van `doel` een kopie van `bron` (de map `frappe-app/`), met de versie
 * erin. Wat in het doel stond en niet meer in de bron staat verdwijnt; de map
 * `.git` van het doel blijft.
 *
 * @returns {number} het aantal bestanden in het doel
 */
export function stelSamen({ bron, doel, versie }) {
  if (!existsSync(join(bron, "y_next", "public", "app", ".vite", "manifest.json"))) {
    throw new Error("Er is geen gebouwde bundel. Draai eerst `node scripts/build-frappe-app.mjs`.");
  }
  mkdirSync(doel, { recursive: true });
  for (const naam of readdirSync(doel)) {
    if (naam !== ".git") rmSync(join(doel, naam), { recursive: true, force: true });
  }
  cpSync(bron, doel, {
    recursive: true,
    filter: (pad) => !slaOver(pad.split(/[\\/]/).pop() || ""),
  });
  const init = join(doel, "y_next", "__init__.py");
  writeFileSync(init, zetVersie(readFileSync(init, "utf8"), versie));
  return telBestanden(doel);
}

function draai(opdracht, args, cwd, { stil = false } = {}) {
  const res = spawnSync(opdracht, args, { cwd, encoding: "utf8", stdio: stil ? "pipe" : "inherit" });
  if (res.status !== 0) {
    throw new Error(`\`${opdracht} ${args.join(" ")}\` is mislukt${stil && res.stderr ? `: ${res.stderr.trim()}` : "."}`);
  }
  return res.stdout || "";
}

/**
 * Het startbestand van npm. Via Node zelf gestart, omdat `npm` op Windows een
 * script is dat alleen via een shell te starten valt.
 */
function npmCli() {
  const pad = process.env.npm_execpath || join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (!existsSync(pad)) {
    throw new Error("npm is niet gevonden naast Node. Start dit script met `npm exec`, of gebruik --zonder-tests.");
  }
  return pad;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const doel = resolvePath(args.doel);
  const versie = leesVersie();
  const tag = `v${versie}`;

  if (draai("git", ["status", "--porcelain"], ROOT, { stil: true }).trim()) {
    throw new Error("De werkmap is niet schoon. Leg eerst alles vast; een release komt uit een vastgelegde stand.");
  }

  if (args.zonderTests) {
    console.log("LET OP: tests en typecontrole overgeslagen (--zonder-tests).");
  } else {
    draai(process.execPath, [join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-b"], join(ROOT, "packages", "frontend"));
    draai(process.execPath, [npmCli(), "test"], ROOT);
  }

  if (!args.zonderBouw) {
    draai(process.execPath, [join(ROOT, "scripts", "build-frappe-app.mjs")], ROOT);
  }

  if (!existsSync(join(doel, ".git"))) {
    mkdirSync(doel, { recursive: true });
    draai("git", ["init", "-b", DOELBRANCH], doel, { stil: true });
    console.log(`Nieuwe repository aangemaakt in ${doel} (branch ${DOELBRANCH}).`);
  }
  const branch = draai("git", ["symbolic-ref", "--short", "HEAD"], doel, { stil: true }).trim();
  if (branch !== DOELBRANCH) {
    throw new Error(`Het doel staat op branch ${branch}; een release hoort op ${DOELBRANCH}.`);
  }
  if (draai("git", ["tag", "--list", tag], doel, { stil: true }).trim()) {
    throw new Error(`De tag ${tag} bestaat al in het doel. Verhoog eerst de versie.`);
  }

  const aantal = stelSamen({ bron: join(ROOT, "frappe-app"), doel, versie });
  console.log(`${aantal} bestanden samengesteld in ${doel}.`);

  const treffers = controleerMap(doel);
  if (treffers.length > 0) {
    for (const treffer of treffers) console.error(`${treffer.bestand}:${treffer.regel}  ${treffer.fragment}`);
    throw new Error(`Niet generiek: ${treffers.length} verwijzing(en) naar een organisatie. Niets vastgelegd.`);
  }
  console.log("Generiek-controle: geen verwijzingen naar een organisatie.");

  draai("git", ["add", "-A"], doel, { stil: true });
  const bericht = args.trailer ? `Release ${versie}\n\n${args.trailer}` : `Release ${versie}`;
  draai("git", ["commit", "-q", "-m", bericht], doel);
  draai("git", ["tag", tag], doel, { stil: true });
  console.log(`Vastgelegd als "Release ${versie}" met tag ${tag}.`);

  if (!args.publiceer) {
    console.log("Niet gepubliceerd. Draai opnieuw met --publiceer om te pushen en de release te maken.");
    return;
  }
  draai("git", ["push", "origin", DOELBRANCH, tag], doel);
  draai("gh", ["release", "create", tag, "--repo", DOELREPO, "--title", `Y-next ${versie}`, "--generate-notes"], doel);
  console.log(`Gepubliceerd: ${DOELREPO} ${tag}.`);
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
