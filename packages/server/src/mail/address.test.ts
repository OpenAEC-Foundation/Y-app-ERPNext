import { test } from "node:test";
import assert from "node:assert/strict";
import { extractEmailAddress, extractDisplayName } from "./address.ts";

test("extractEmailAddress: bracketed, plain, whitespace, empty", () => {
  assert.equal(extractEmailAddress("Piet Mol <piet@3bm.co.nl>"), "piet@3bm.co.nl");
  assert.equal(extractEmailAddress("piet@3bm.co.nl"), "piet@3bm.co.nl");
  assert.equal(extractEmailAddress("  a@b.nl  "), "a@b.nl");
  assert.equal(extractEmailAddress(""), "");
});

test("extractDisplayName: name present, quoted, absent", () => {
  assert.equal(extractDisplayName("Piet Mol <piet@3bm.co.nl>"), "Piet Mol");
  assert.equal(extractDisplayName('"Piet Mol" <piet@3bm.co.nl>'), "Piet Mol");
  assert.equal(extractDisplayName("piet@3bm.co.nl"), undefined);
  assert.equal(extractDisplayName(""), undefined);
});
