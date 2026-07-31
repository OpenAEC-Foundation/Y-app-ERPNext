/**
 * Pure semver-/Conventional-Commits-helpers voor de automatische versie-bump.
 * Geen IO — los testbaar (zie semver-bump.test.mjs).
 *
 * Conventional Commits: `type(scope)!: beschrijving`
 *   feat            → minor
 *   fix/perf/...    → patch
 *   `!` of body "BREAKING CHANGE" → major
 */

/** Bepaal de bump-zwaarte uit een lijst commit-subjects (+ optioneel body). */
export function bumpLevelFromCommits(subjects) {
  let level = "patch"; // default: ook bij alleen docs/chore brengt een release iets
  for (const raw of subjects) {
    const s = String(raw);
    const m = s.match(/^(\w+)(\([^)]*\))?(!)?:/);
    if (m && (m[3] === "!")) return "major";
    if (/BREAKING[ -]CHANGE/.test(s)) return "major";
    if (m && m[1].toLowerCase() === "feat") level = "minor";
  }
  return level;
}

/** Pas een bump-niveau toe op een semver (leidende `v` wordt gestript). */
export function applyBump(version, level) {
  const [maj, min, pat] = version.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  if (level === "major") return `${maj + 1}.0.0`;
  if (level === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

/** Geef de hoogste van twee semvers terug (originele string-vorm behouden). */
export function maxVersion(a, b) {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? a : b;
  }
  return a;
}

const SECTION_BY_TYPE = {
  feat: "Toegevoegd",
  fix: "Opgelost",
  perf: "Verbeterd",
  refactor: "Verbeterd",
};
const SKIP_TYPES = new Set(["docs", "chore", "test", "ci", "style", "build"]);

/**
 * Groepeer commit-subjects naar changelog-secties (Map<sectie, regels[]>).
 * docs/chore/test/ci/style/build worden overgeslagen; scope wordt vetgedrukt.
 */
export function groupCommitsForChangelog(subjects) {
  const groups = new Map();
  for (const raw of subjects) {
    const s = String(raw).split("\n")[0];
    const m = s.match(/^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/);
    if (!m) continue;
    const type = m[1].toLowerCase();
    if (SKIP_TYPES.has(type)) continue;
    const scope = m[2] ? m[2].slice(1, -1) : "";
    const desc = m[4].trim();
    const section = SECTION_BY_TYPE[type] || "Overig";
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(scope ? `**${scope}**: ${desc}` : desc);
  }
  return groups;
}
