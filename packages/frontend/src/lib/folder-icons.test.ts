import { test } from "node:test";
import assert from "node:assert/strict";
import { getFolderIcon, getFolderIconColor } from "./folder-icons.ts";

test("getFolderIconColor: expected tailwind class per folder kind", () => {
  assert.equal(getFolderIconColor("INBOX", "\\Inbox", false), "text-blue-500");
  assert.equal(getFolderIconColor("Sent", "\\Sent", false), "text-emerald-500");
  assert.equal(getFolderIconColor("Trash", "\\Trash", false), "text-red-400");
});

test("getFolderIconColor: active folder overrides everything", () => {
  assert.equal(getFolderIconColor("Sent", "\\Sent", true), "text-blue-600");
  assert.equal(getFolderIconColor("anything", null, true), "text-blue-600");
});

test("getFolderIconColor: unknown folder falls back to slate", () => {
  assert.equal(getFolderIconColor("Zomaar", null, false), "text-slate-400");
});

test("getFolderIcon: returns a component for known + unknown names", () => {
  assert.ok(getFolderIcon("Inbox", "\\Inbox"));
  assert.ok(getFolderIcon("Verzonden items", null));
  assert.ok(getFolderIcon("Zomaar een map", null));
});
