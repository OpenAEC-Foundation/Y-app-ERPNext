import { test } from "node:test";
import assert from "node:assert/strict";

import { bumpLevelFromCommits, applyBump, maxVersion, groupCommitsForChangelog } from "./semver-bump.mjs";

test("applyBump increments the right segment", () => {
  assert.equal(applyBump("0.26.0", "patch"), "0.26.1");
  assert.equal(applyBump("0.26.0", "minor"), "0.27.0");
  assert.equal(applyBump("0.26.0", "major"), "1.0.0");
  assert.equal(applyBump("v0.26.3", "minor"), "0.27.0"); // strips leading v, resets patch
});

test("bumpLevelFromCommits: feat → minor, fix-only → patch", () => {
  assert.equal(bumpLevelFromCommits(["fix: a", "fix: b"]), "patch");
  assert.equal(bumpLevelFromCommits(["fix: a", "feat: b"]), "minor");
});

test("bumpLevelFromCommits: breaking (!) or BREAKING CHANGE → major", () => {
  assert.equal(bumpLevelFromCommits(["feat!: drop X"]), "major");
  assert.equal(bumpLevelFromCommits(["fix(api)!: change shape"]), "major");
  assert.equal(bumpLevelFromCommits(["feat: x\n\nBREAKING CHANGE: y"]), "major");
});

test("bumpLevelFromCommits: no conventional types → patch (default)", () => {
  assert.equal(bumpLevelFromCommits(["docs: x", "chore: y", "random text"]), "patch");
});

test("maxVersion picks the higher semver", () => {
  assert.equal(maxVersion("0.23.0", "0.26.0"), "0.26.0");
  assert.equal(maxVersion("v0.26.0", "0.25.9"), "v0.26.0");
  assert.equal(maxVersion("1.0.0", "0.99.0"), "1.0.0");
});

test("groupCommitsForChangelog buckets by type and skips noise", () => {
  const groups = groupCommitsForChangelog([
    "feat(webmail): project in onderwerp",
    "fix(mail): Verzonden-map",
    "docs: bijwerken",
    "chore(release): v0.26.0",
    "perf(mail): lichtere preview",
  ]);
  assert.deepEqual(groups.get("Toegevoegd"), ["**webmail**: project in onderwerp"]);
  assert.deepEqual(groups.get("Opgelost"), ["**mail**: Verzonden-map"]);
  assert.deepEqual(groups.get("Verbeterd"), ["**mail**: lichtere preview"]);
  assert.ok(!groups.has("docs"));
});
