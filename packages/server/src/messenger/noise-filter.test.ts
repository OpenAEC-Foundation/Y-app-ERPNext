import { test } from "node:test";
import assert from "node:assert/strict";
import { isEmojiOnly, isVisibleMessage } from "./noise-filter.ts";

test("isEmojiOnly: true for single/small emoji strings", () => {
  assert.equal(isEmojiOnly("👍"), true);
  assert.equal(isEmojiOnly("❤️"), true);
  assert.equal(isEmojiOnly("😂😂"), true);
  assert.equal(isEmojiOnly("  👍  "), true); // trimmed
});

test("isEmojiOnly: false for text, empty, whitespace, mixed", () => {
  assert.equal(isEmojiOnly("hello"), false);
  assert.equal(isEmojiOnly(""), false);
  assert.equal(isEmojiOnly("   "), false);
  assert.equal(isEmojiOnly("👍 hoi"), false);
  assert.equal(isEmojiOnly(undefined), false);
  assert.equal(isEmojiOnly(null), false);
});

test("isVisibleMessage: drops reaction events", () => {
  assert.equal(isVisibleMessage({ messageType: "reaction", message: "👍" }), false);
  assert.equal(isVisibleMessage({ messageType: "reaction_deleted", message: "👍" }), false);
});

test("isVisibleMessage: drops edit/delete system rows only", () => {
  assert.equal(isVisibleMessage({ messageType: "system", systemMessage: "message_edited" }), false);
  assert.equal(isVisibleMessage({ messageType: "system", systemMessage: "message_deleted" }), false);
  // other system messages are kept
  assert.equal(isVisibleMessage({ messageType: "system", systemMessage: "call_started" }), true);
});

test("isVisibleMessage: drops emoji-only quoted replies but keeps standalone emoji", () => {
  // emoji-only WITH a parent = disguised reaction → dropped
  assert.equal(isVisibleMessage({ messageType: "comment", parent: { id: 1 }, message: "👍" }), false);
  // emoji-only WITHOUT a parent = normal message → kept
  assert.equal(isVisibleMessage({ messageType: "comment", message: "👍" }), true);
  // reply with real text = kept
  assert.equal(isVisibleMessage({ messageType: "comment", parent: { id: 1 }, message: "bedankt!" }), true);
});

test("isVisibleMessage: keeps a normal comment", () => {
  assert.equal(isVisibleMessage({ messageType: "comment", message: "hoi allemaal" }), true);
});
