import { test } from "node:test";
import assert from "node:assert/strict";
import { bepaalMelding, vatOngelezenSamen, type Meldingstand } from "./meldingen.ts";

/**
 * Tests voor de meldingen.
 *
 * Twee dingen gaan hier stil fout. Een melding bij de eerste meting betekent
 * dat de app pingt zodra je hem opent — dan leert iedereen de melding negeren.
 * Geen melding bij een tweede bericht betekent dat je post blijft liggen. Aan
 * het scherm zie je geen van beide, want je moet er nét niet naar kijken.
 */

test("de eerste meting meldt niets, die zet alleen de stand", () => {
  const uit = bepaalMelding(null, 3);
  assert.deepEqual(uit, { melden: false, nieuw: 0, stand: 3 });
});

test("erbij gekomen betekent melden, en hoeveel", () => {
  assert.deepEqual(bepaalMelding(1, 3), { melden: true, nieuw: 2, stand: 3 });
  assert.deepEqual(bepaalMelding(0, 1), { melden: true, nieuw: 1, stand: 1 });
});

test("gelijk gebleven of gelezen meldt niets", () => {
  assert.deepEqual(bepaalMelding(3, 3), { melden: false, nieuw: 0, stand: 3 });
  // Berichten gelezen: de teller zakt. Zakken is geen melding, maar de stand
  // moet wel mee omlaag — anders meldt de volgende mail niets omdat hij nog
  // onder de oude piek blijft.
  assert.deepEqual(bepaalMelding(5, 2), { melden: false, nieuw: 0, stand: 2 });
});

test("onzin telt als nul en laat de stand met rust", () => {
  assert.deepEqual(bepaalMelding(2, Number.NaN), { melden: false, nieuw: 0, stand: 2 });
  assert.deepEqual(bepaalMelding(2, -4), { melden: false, nieuw: 0, stand: 0 });
});

test("de stand is altijd bruikbaar als volgende invoer", () => {
  // Eén keer doorrekenen zoals de poller het doet: niets, erbij, gelezen, erbij.
  let stand: Meldingstand = null;
  const reeks = [2, 4, 0, 1];
  const gemeld: number[] = [];
  for (const meting of reeks) {
    const uit = bepaalMelding(stand, meting);
    if (uit.melden) gemeld.push(uit.nieuw);
    stand = uit.stand;
  }
  assert.deepEqual(gemeld, [2, 1]);
  assert.equal(stand, 1);
});

/* ── Wat er in de melding komt te staan ── */

const RIJEN = [
  { from_user: "nino@3bm.co.nl", owner: "nino@3bm.co.nl", subject: "Kun je even kijken?", creation: "2026-09-14 16:08:00" },
  { from_user: "karsten@3bm.co.nl", owner: "karsten@3bm.co.nl", subject: "test", creation: "2026-09-14 16:07:00" },
];

test("de melding gaat over het nieuwste bericht", () => {
  // Niet het eerste uit de lijst maar het laatst binnengekomene: dát is
  // waardoor de melding afgaat.
  const uit = vatOngelezenSamen(RIJEN);
  assert.equal(uit.aantal, 2);
  assert.equal(uit.van, "nino");
  assert.equal(uit.tekst, "Kun je even kijken?");
});

test("met een namenlijst staat de naam erin en niet het adres", () => {
  const uit = vatOngelezenSamen(RIJEN, (u) => (u === "nino@3bm.co.nl" ? "Nino van Kleef" : ""));
  assert.equal(uit.van, "Nino van Kleef");
});

test("zonder afzenderveld valt hij terug op de eigenaar van de regel", () => {
  const uit = vatOngelezenSamen([
    { owner: "lance@3bm.co.nl", subject: "hoi", creation: "2026-09-14 10:00:00" },
  ]);
  assert.equal(uit.van, "lance");
});

test("geen ongelezen berichten geeft een leeg overzicht", () => {
  assert.deepEqual(vatOngelezenSamen([]), { aantal: 0, van: "", tekst: "" });
});
