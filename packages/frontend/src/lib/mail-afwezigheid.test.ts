import { test } from "node:test";
import assert from "node:assert/strict";
import { isActief, naarMailserver, vanMailserver } from "./mail-afwezigheid.ts";

/**
 * Tests voor de afwezigheidsmelding.
 *
 * Wat hier stil fout gaat: een datum die een dag verschuift omdat de
 * mailserver in UTC rekent. Wie "tot en met vrijdag" invult en ziet dat de
 * melding donderdagavond al stopt, of pas zaterdag, merkt dat pas als klanten
 * er iets van zeggen.
 */

const ZONE = "Europe/Amsterdam";

test("naarMailserver: hele dagen, de einddatum telt mee", () => {
  const uit = naarMailserver({
    aan: true, van: "2026-10-12", tot: "2026-10-16",
    onderwerp: "Afwezig", tekst: "Ik ben weg.",
  }, ZONE);
  // Maandag 00:00 in Amsterdam is zondag 22:00 UTC (zomertijd).
  assert.equal(uit.van, "2026-10-11T22:00:00Z");
  // Tot en met vrijdag: de melding stopt zaterdag 00:00 Amsterdamse tijd.
  assert.equal(uit.tot, "2026-10-16T22:00:00Z");
  assert.equal(uit.aan, true);
});

test("naarMailserver: in de wintertijd scheelt het een uur minder", () => {
  const uit = naarMailserver({ aan: true, van: "2026-12-21", tot: "2026-12-24", onderwerp: "", tekst: "x" }, ZONE);
  assert.equal(uit.van, "2026-12-20T23:00:00Z");
  assert.equal(uit.tot, "2026-12-24T23:00:00Z");
});

test("naarMailserver: zonder datums is hij aan tot je hem uitzet", () => {
  const uit = naarMailserver({ aan: true, van: "", tot: "", onderwerp: "", tekst: "Weg" }, ZONE);
  assert.equal(uit.van, null);
  assert.equal(uit.tot, null);
});

test("naarMailserver: een lege onderwerpregel krijgt een nette standaard", () => {
  const uit = naarMailserver({ aan: true, van: "", tot: "", onderwerp: "  ", tekst: "Weg" }, ZONE);
  assert.equal(uit.onderwerp, "Afwezig");
});

test("naarMailserver: tekst gaat ook als html mee, veilig ontsnapt", () => {
  const uit = naarMailserver({ aan: true, van: "", tot: "", onderwerp: "", tekst: "Weg tot 16 okt.\nBel <Martin> bij spoed." }, ZONE);
  assert.equal(uit.tekst, "Weg tot 16 okt.\nBel <Martin> bij spoed.");
  assert.equal(uit.html, "<p>Weg tot 16 okt.<br>Bel &lt;Martin&gt; bij spoed.</p>");
});

test("naarMailserver: een einddatum voor de begindatum is een fout", () => {
  assert.throws(() => naarMailserver({ aan: true, van: "2026-10-16", tot: "2026-10-12", onderwerp: "", tekst: "x" }, ZONE));
});

test("vanMailserver: terug naar het formulier, dezelfde dagen", () => {
  const uit = vanMailserver({
    aan: true, van: "2026-10-11T22:00:00Z", tot: "2026-10-16T22:00:00Z",
    onderwerp: "Afwezig", tekst: "Ik ben weg.", html: "",
  }, ZONE);
  assert.deepEqual(uit, { aan: true, van: "2026-10-12", tot: "2026-10-16", onderwerp: "Afwezig", tekst: "Ik ben weg." });
});

test("vanMailserver: niets ingesteld is een leeg formulier", () => {
  assert.deepEqual(vanMailserver({ aan: false, van: null, tot: null, onderwerp: "", tekst: "", html: "" }, ZONE),
    { aan: false, van: "", tot: "", onderwerp: "", tekst: "" });
});

test("isActief: aan en binnen de periode", () => {
  const stand = { aan: true, van: "2026-10-11T22:00:00Z", tot: "2026-10-16T22:00:00Z" };
  assert.equal(isActief(stand, new Date("2026-10-14T09:00:00Z")), true);
  assert.equal(isActief(stand, new Date("2026-10-11T21:59:00Z")), false);
  assert.equal(isActief(stand, new Date("2026-10-16T22:00:00Z")), false);
});

test("isActief: uit is uit, ook binnen de periode", () => {
  assert.equal(isActief({ aan: false, van: null, tot: null }, new Date()), false);
});

test("isActief: aan zonder datums is gewoon aan", () => {
  assert.equal(isActief({ aan: true, van: null, tot: null }, new Date()), true);
});
