import { test } from "node:test";
import assert from "node:assert/strict";
import { deelKolommenIn } from "./agenda-indeling.ts";

/** Een afspraak van `van` tot `tot`, in uren (de indeling rekent in pixels, de verhouding is gelijk). */
function blok(id: string, van: number, tot: number) {
  return { id, _top: van * 60, _bottom: tot * 60 };
}

function plek(uit: ReturnType<typeof deelKolommenIn<ReturnType<typeof blok>>>, id: string) {
  const b = uit.find((x) => x.id === id);
  assert.ok(b, id);
  return { left: Math.round(b.left * 1000) / 1000, width: Math.round(b.width * 1000) / 1000 };
}

test("een afspraak alleen krijgt de hele breedte", () => {
  assert.deepEqual(plek(deelKolommenIn([blok("a", 10, 11)]), "a"), { left: 0, width: 1 });
});

test("een drukke ochtend maakt de middag niet smal", () => {
  // Zo was het: drie naast elkaar om 10:00 gaf elke afspraak die dag een derde.
  const uit = deelKolommenIn([
    blok("stout", 10, 12), blok("overleg", 10, 12), blok("bouwsoos", 10, 17),
    blok("domera", 14, 16),
  ]);
  // De langste (Bouwsoos, tot 17:00) staat links.
  assert.deepEqual(plek(uit, "bouwsoos"), { left: 0, width: 0.333 });
  assert.deepEqual(plek(uit, "stout"), { left: 0.333, width: 0.333 });
  assert.deepEqual(plek(uit, "overleg"), { left: 0.667, width: 0.333 });
  // Domera raakt alleen Bouwsoos: twee kolommen, en de vrije ruimte links is voor hem.
  assert.equal(plek(uit, "domera").width >= 0.5, true);
});

test("een afspraak die later helemaal los staat, krijgt weer de hele breedte", () => {
  const uit = deelKolommenIn([blok("a", 9, 10), blok("b", 9, 10), blok("zwemles", 17.5, 18)]);
  assert.deepEqual(plek(uit, "zwemles"), { left: 0, width: 1 });
  assert.deepEqual(plek(uit, "a"), { left: 0, width: 0.5 });
  assert.deepEqual(plek(uit, "b"), { left: 0.5, width: 0.5 });
});

test("aansluitend is niet overlappend", () => {
  const uit = deelKolommenIn([blok("a", 10, 11), blok("b", 11, 12)]);
  assert.deepEqual(plek(uit, "a"), { left: 0, width: 1 });
  assert.deepEqual(plek(uit, "b"), { left: 0, width: 1 });
});

test("een keten: A raakt B, B raakt C, A en C niet — twee kolommen, C schuift terug naar links", () => {
  const uit = deelKolommenIn([blok("a", 9, 11), blok("b", 10, 12), blok("c", 11, 13)]);
  assert.deepEqual(plek(uit, "a"), { left: 0, width: 0.5 });
  assert.deepEqual(plek(uit, "b"), { left: 0.5, width: 0.5 });
  assert.deepEqual(plek(uit, "c"), { left: 0, width: 0.5 });
});

test("een afspraak groeit naar rechts zolang de kolommen ernaast op dat moment vrij zijn", () => {
  // A 10–12 in kolom 0, B en C 10–11 in kolom 1 en 2, D 11–12 komt in kolom 1:
  // van 11 tot 12 is kolom 2 leeg, dus D krijgt twee derde.
  const uit = deelKolommenIn([blok("a", 10, 12), blok("b", 10, 11), blok("c", 10, 11), blok("d", 11, 12)]);
  assert.deepEqual(plek(uit, "d"), { left: 0.333, width: 0.667 });
  assert.deepEqual(plek(uit, "b"), { left: 0.333, width: 0.333 });
});

test("niets in, niets uit; de volgorde van de invoer doet er niet toe", () => {
  assert.deepEqual(deelKolommenIn([]), []);
  const heen = deelKolommenIn([blok("a", 9, 11), blok("b", 10, 12)]);
  const terug = deelKolommenIn([blok("b", 10, 12), blok("a", 9, 11)]);
  assert.deepEqual(plek(heen, "a"), plek(terug, "a"));
  assert.deepEqual(plek(heen, "b"), plek(terug, "b"));
});
