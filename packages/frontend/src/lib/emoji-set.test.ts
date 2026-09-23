import test from "node:test";
import assert from "node:assert/strict";
import { EMOJI_GROEPEN, RECENT_MAX, bijwerkenRecent, voegInOpCursor } from "./emoji-set.ts";

test("EMOJI_GROEPEN: geen lege groepen en geen emoji die twee keer voorkomt", () => {
  const gezien = new Set<string>();
  for (const groep of EMOJI_GROEPEN) {
    assert.ok(groep.emoji.length > 0, `groep ${groep.id} is leeg`);
    for (const emoji of groep.emoji) {
      assert.equal(gezien.has(emoji), false, `${emoji} staat dubbel`);
      gezien.add(emoji);
    }
  }
});

test("bijwerkenRecent: nieuwste vooraan, geen dubbele, begrensd", () => {
  assert.deepEqual(bijwerkenRecent([], "👍"), ["👍"]);
  assert.deepEqual(bijwerkenRecent(["😀", "👍", "🎉"], "👍"), ["👍", "😀", "🎉"]);
  const vol = Array.from({ length: RECENT_MAX }, (_, i) => String(i));
  const na = bijwerkenRecent(vol, "🔥");
  assert.equal(na.length, RECENT_MAX);
  assert.equal(na[0], "🔥");
  assert.equal(na.includes(String(RECENT_MAX - 1)), false);
});

test("voegInOpCursor: op de cursor, over een selectie heen, en aan het eind", () => {
  assert.deepEqual(voegInOpCursor("Hallo wereld", 5, 5, " 👋"), { tekst: "Hallo 👋 wereld", cursor: 8 });
  assert.deepEqual(voegInOpCursor("Hallo wereld", 6, 12, "👋"), { tekst: "Hallo 👋", cursor: 8 });
  assert.deepEqual(voegInOpCursor("", 0, 0, "🙂"), { tekst: "🙂", cursor: 2 });
});

test("voegInOpCursor: een cursor buiten de tekst of een omgekeerde selectie gaat niet mis", () => {
  assert.deepEqual(voegInOpCursor("Hoi", 99, 99, "🙂"), { tekst: "Hoi🙂", cursor: 5 });
  assert.deepEqual(voegInOpCursor("abc", 2, 1, "x"), { tekst: "axc", cursor: 2 });
});
