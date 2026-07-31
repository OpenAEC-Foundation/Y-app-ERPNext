import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveSentFolder } from "./sent-folder.ts";

const f = (path: string, specialUse?: string, delimiter = "/") => ({ path, specialUse, delimiter });

test("prefers the RFC6154 \\Sent special-use folder", () => {
  const folders = [f("INBOX"), f("Sent", "\\Sent"), f("Verzonden items")];
  assert.equal(resolveSentFolder(folders)?.path, "Sent");
});

test("falls back to a name match when no special-use flag is present", () => {
  const folders = [f("INBOX"), f("Verzonden items"), f("Drafts")];
  assert.equal(resolveSentFolder(folders)?.path, "Verzonden items");
});

test("matches the leaf name when nested under a delimiter", () => {
  const folders = [f("INBOX.Drafts", undefined, "."), f("INBOX.Sent", undefined, ".")];
  assert.equal(resolveSentFolder(folders)?.path, "INBOX.Sent");
});

test("returns null when there is no Sent-like folder", () => {
  const folders = [f("INBOX"), f("Drafts"), f("Trash")];
  assert.equal(resolveSentFolder(folders), null);
});

test("an explicit override wins over auto-detection", () => {
  // Mailbox heeft zowel een \\Sent-gevlagde 'Sent' als de 'Verzonden items' die
  // de gebruiker echt gebruikt. Override mikt op de juiste.
  const folders = [f("Sent", "\\Sent"), f("Verzonden items")];
  assert.equal(resolveSentFolder(folders, "Verzonden items")?.path, "Verzonden items");
});

test("a stale override that matches no folder falls back to auto-detection", () => {
  const folders = [f("Sent", "\\Sent"), f("Verzonden items")];
  assert.equal(resolveSentFolder(folders, "Oude map die niet bestaat")?.path, "Sent");
});
