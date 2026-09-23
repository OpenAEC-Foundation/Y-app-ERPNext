import { test } from "node:test";
import assert from "node:assert/strict";
import { COLLEGA_KLEUREN, EIGEN_AGENDA_KLEUR, kleurenVoorAgendas } from "./agenda-kleuren.ts";

test("je eigen agenda heeft altijd dezelfde, eigen kleur", () => {
  const vooraan = kleurenVoorAgendas(["maarten@3bm.co.nl", "nino@3bm.co.nl"], "maarten@3bm.co.nl");
  const achteraan = kleurenVoorAgendas(["nino@3bm.co.nl", "maarten@3bm.co.nl"], "maarten@3bm.co.nl");
  assert.equal(vooraan.get("maarten@3bm.co.nl"), EIGEN_AGENDA_KLEUR);
  assert.equal(achteraan.get("maarten@3bm.co.nl"), EIGEN_AGENDA_KLEUR);
});

test("collega's krijgen op volgorde van aanvinken de eerste kleuren; jijzelf telt niet mee", () => {
  const kleuren = kleurenVoorAgendas(["nino@3bm.co.nl", "maarten@3bm.co.nl", "jochem@3bm.co.nl"], "maarten@3bm.co.nl");
  assert.equal(kleuren.get("nino@3bm.co.nl"), COLLEGA_KLEUREN[0]);
  assert.equal(kleuren.get("jochem@3bm.co.nl"), COLLEGA_KLEUREN[1]);
});

test("Maarten en Nino samen: duidelijk verschillende kleuren", () => {
  // Zo was het mis: op plek in de hele medewerkerslijst kregen ze twee rozen.
  const kleuren = kleurenVoorAgendas(["maarten@3bm.co.nl", "nino@3bm.co.nl"], "maarten@3bm.co.nl");
  assert.notEqual(kleuren.get("maarten@3bm.co.nl"), kleuren.get("nino@3bm.co.nl"));
});

test("de eerste acht collega's hebben allemaal een andere kleur dan elkaar en dan jij", () => {
  const acht = COLLEGA_KLEUREN.slice(0, 8);
  assert.equal(new Set(acht).size, 8);
  assert.equal(acht.includes(EIGEN_AGENDA_KLEUR), false);
});

test("hoofdletters in een adres maken niet uit", () => {
  const kleuren = kleurenVoorAgendas(["Nino@3BM.co.nl", "Maarten@3bm.co.nl"], "MAARTEN@3bm.co.nl");
  assert.equal(kleuren.get("maarten@3bm.co.nl"), EIGEN_AGENDA_KLEUR);
  assert.equal(kleuren.get("nino@3bm.co.nl"), COLLEGA_KLEUREN[0]);
});

test("niemand aangevinkt geeft niets; zonder eigen adres krijgt niemand de eigen kleur", () => {
  assert.equal(kleurenVoorAgendas([], "maarten@3bm.co.nl").size, 0);
  const kleuren = kleurenVoorAgendas(["maarten@3bm.co.nl"], "");
  assert.equal(kleuren.get("maarten@3bm.co.nl"), COLLEGA_KLEUREN[0]);
});

test("meer collega's dan kleuren: de reeks begint opnieuw, dubbel aanvinken telt één keer", () => {
  const adressen = Array.from({ length: COLLEGA_KLEUREN.length + 1 }, (_, i) => `mw${i}@3bm.co.nl`);
  const kleuren = kleurenVoorAgendas([...adressen, "mw0@3bm.co.nl"], "");
  assert.equal(kleuren.size, adressen.length);
  assert.equal(kleuren.get(`mw${COLLEGA_KLEUREN.length}@3bm.co.nl`), COLLEGA_KLEUREN[0]);
});
