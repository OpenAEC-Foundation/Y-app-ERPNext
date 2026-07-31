import { test } from "node:test";
import assert from "node:assert/strict";

import { nextFreeUploadName } from "./nc-talk-upload-name.ts";

const existsFrom = (taken: Set<string>) => async (name: string) => taken.has(name);

test("returns the original name when it is free", async () => {
  assert.equal(await nextFreeUploadName("tekening.png", existsFrom(new Set())), "tekening.png");
});

test("appends ' (2)' on a single collision (NC-style)", async () => {
  const taken = new Set(["tekening.png"]);
  assert.equal(await nextFreeUploadName("tekening.png", existsFrom(taken)), "tekening (2).png");
});

test("skips to the next free number across multiple collisions", async () => {
  const taken = new Set(["a.pdf", "a (2).pdf", "a (3).pdf"]);
  assert.equal(await nextFreeUploadName("a.pdf", existsFrom(taken)), "a (4).pdf");
});

test("handles a name without an extension", async () => {
  const taken = new Set(["README"]);
  assert.equal(await nextFreeUploadName("README", existsFrom(taken)), "README (2)");
});

test("only treats the final segment as the extension", async () => {
  const taken = new Set(["archive.tar.gz"]);
  assert.equal(await nextFreeUploadName("archive.tar.gz", existsFrom(taken)), "archive.tar (2).gz");
});

test("treats a dotfile as having no extension", async () => {
  const taken = new Set([".gitignore"]);
  assert.equal(await nextFreeUploadName(".gitignore", existsFrom(taken)), ".gitignore (2)");
});

test("throws when no free name is found within maxTries", async () => {
  const alwaysTaken = async () => true;
  await assert.rejects(
    () => nextFreeUploadName("x.png", alwaysTaken, { maxTries: 5 }),
    /vrije bestandsnaam/i,
  );
});
