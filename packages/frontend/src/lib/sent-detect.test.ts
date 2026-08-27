import { test } from "node:test";
import assert from "node:assert/strict";
import { isSentParent, isSentContext } from "./sent-detect.ts";
import type { MailFolder } from "./mail-types.ts";

const f = (path: string, specialUse: string | null = null): MailFolder => ({
  path,
  name: path.split(/[/.]/).pop() || path,
  specialUse,
});

test("isSentParent: sent-name variants (NL/EN) + \\sent literal", () => {
  assert.equal(isSentParent("sent"), true);
  assert.equal(isSentParent("Sent Items"), true);
  assert.equal(isSentParent("sent.2024"), true);
  assert.equal(isSentParent("Verzonden items"), true);
  assert.equal(isSentParent("\\Sent"), true);
  assert.equal(isSentParent("INBOX"), false);
  assert.equal(isSentParent("Projects"), false);
});

test("isSentContext: self specialUse \\Sent matches", () => {
  const folders = [f("MyOutbox", "\\Sent")];
  assert.equal(isSentContext("MyOutbox", folders), true);
});

test("isSentContext: ancestor match over '.' and '/' delimiters", () => {
  const dot = [f("Postvak", "\\Sent")];
  assert.equal(isSentContext("Postvak.2024", dot), true);
  const slash = [f("Postvak", "\\Sent")];
  assert.equal(isSentContext("Postvak/2024", slash), true);
});

test("isSentContext: plain non-sent folder is false", () => {
  const folders = [f("INBOX", "\\Inbox"), f("INBOX.Projects")];
  assert.equal(isSentContext("INBOX.Projects", folders), false);
  assert.equal(isSentContext("", folders), false);
});
