import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldCountForBadge } from "./mail-badge.ts";
import type { MailFolder } from "./mail-types.ts";

const f = (path: string, specialUse: string | null = null): MailFolder => ({
  path,
  name: path.split(/[/.]/).pop() || path,
  specialUse,
});

test("shouldCountForBadge: INBOX itself counts", () => {
  assert.equal(shouldCountForBadge(f("INBOX")), true);
  assert.equal(shouldCountForBadge(f("inbox")), true);
});

test("shouldCountForBadge: INBOX submap does NOT count", () => {
  assert.equal(shouldCountForBadge(f("INBOX.Project 3001")), false);
  assert.equal(shouldCountForBadge(f("INBOX/Archief-2024")), false);
});

test("shouldCountForBadge: Sent/Trash/Junk/Drafts/Archive via specialUse do NOT count", () => {
  assert.equal(shouldCountForBadge(f("Sent", "\\Sent")), false);
  assert.equal(shouldCountForBadge(f("Trash", "\\Trash")), false);
  assert.equal(shouldCountForBadge(f("Junk", "\\Junk")), false);
  assert.equal(shouldCountForBadge(f("Drafts", "\\Drafts")), false);
  assert.equal(shouldCountForBadge(f("Archive", "\\Archive")), false);
});

test("shouldCountForBadge: name-fallback excludes localized sent/trash/junk without specialUse", () => {
  assert.equal(shouldCountForBadge(f("Verzonden items")), false);
  assert.equal(shouldCountForBadge(f("Prullenbak")), false);
  assert.equal(shouldCountForBadge(f("Concepten")), false);
  assert.equal(shouldCountForBadge(f("Archief")), false);
});
