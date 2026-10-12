import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT_PACKAGES = ["@stll/folio-react", "@betteroffice/xlsx-react", "@betteroffice/xlsx", "use-intl", "fflate"];
const LICENSE_FILE = /^(?:licen[sc]e|notice|copying|ofl|third[-_]party[-_]notices)(?:[.-].*)?$/i;

function packageDirectory(name, from) {
  let current = resolve(from);
  for (;;) {
    const candidate = join(current, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(current);
    if (parent === current) throw new Error("Office-afhankelijkheid ontbreekt: " + name);
    current = parent;
  }
}

/** Inclusief notices en lettertypelicenties die achter editorimports zitten. */
export function collectOfficeNotices(frontendDir, extraDir) {
  const collected = new Map();
  const visit = (name, from) => {
    const directory = packageDirectory(name, from);
    const info = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    const key = info.name + "@" + info.version;
    if (collected.has(key)) return;
    const texts = readdirSync(directory).filter((file) => LICENSE_FILE.test(file)).sort()
      .map((file) => ({ name: file, body: readFileSync(join(directory, file), "utf8") }));
    if (!texts.length && ROOT_PACKAGES.includes(name)) throw new Error("Office-licentietekst ontbreekt: " + key);
    collected.set(key, { info, texts });
    for (const dependency of Object.keys(info.dependencies || {}).sort()) visit(dependency, directory);
  };
  for (const name of ROOT_PACKAGES) visit(name, frontendDir);
  const sections = ["Y-next Office: third-party licenses and notices\nGenerated from the installed, locked dependency versions.\n"];
  for (const [key, {info, texts}] of [...collected.entries()].sort(([a], [b]) => a.localeCompare(b, "en"))) {
    sections.push("\n===== " + key + " (" + (info.license || "see included license") + ") =====\n");
    if (!texts.length) {
      const canonical = [...collected.values()].find((entry) => entry.info.license === info.license && entry.texts.length);
      if (!canonical) throw new Error("Geen licentievoorwaarden gevonden voor " + key);
      sections.push("Published package metadata: " + JSON.stringify({ name: info.name, version: info.version, license: info.license, author: info.author, repository: info.repository }) + "\n");
      sections.push("This package publishes no separate license or notice file. The " + info.license + " terms are included under " + canonical.info.name + "@" + canonical.info.version + ".\n");
    }
    for (const file of texts) sections.push("\n--- " + file.name + " ---\n" + file.body);
  }
  for (const file of ["PROVENANCE.txt", "NOTICE", "THIRD-PARTY-NOTICES.md", "OFL-Carlito.txt"]) {
    const path = join(extraDir, file);
    if (!existsSync(path)) throw new Error("BetterOffice-vermelding ontbreekt: " + file);
    sections.push("\n===== BetterOffice 0.3.0 / " + file + " =====\n" + readFileSync(path, "utf8"));
  }
  return sections.join("\n") + "\n";
}

export function writeOfficeNotices(frontendDir, outDir, extraDir) {
  const target = join(outDir, "office-third-party-notices.txt");
  const text = collectOfficeNotices(frontendDir, extraDir);
  writeFileSync(target, text, "utf8");
  return target;
}
