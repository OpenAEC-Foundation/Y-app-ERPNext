import { test } from "node:test";
import assert from "node:assert/strict";
import {
  berekenSleep,
  minutenNaarTijd,
  sleepbaar,
  tijdNaarMinuten,
  verschuifDatum,
  type SleepInvoer,
} from "./agenda-slepen.ts";

/**
 * Tests voor het slepen in de agenda.
 *
 * De gevallen die ertoe doen zijn de randen: een afspraak die je tegen de
 * bovenkant van de dag aan trekt, een eindtijd die vóór de starttijd dreigt te
 * belanden, en het verschil tussen verplaatsen (duur blijft) en verlengen
 * (alleen het einde beweegt). Dat zie je op het scherm niet aan een blok af.
 */

/** Een afspraak van 09:00 tot 10:00. */
function basis(over: Partial<SleepInvoer> = {}): SleepInvoer {
  return {
    startMin: 9 * 60,
    eindMin: 10 * 60,
    verschuivingMin: 0,
    dagVerschuiving: 0,
    soort: "verplaatsen",
    ...over,
  };
}

test("verplaatsen schuift start en einde even ver op", () => {
  const uit = berekenSleep(basis({ verschuivingMin: 60 }));
  assert.equal(minutenNaarTijd(uit.startMin), "10:00");
  assert.equal(minutenNaarTijd(uit.eindMin), "11:00");
});

test("verplaatsen rondt af op een kwartier", () => {
  // 22 minuten muisbeweging hoort 15 te worden, niet 22.
  const uit = berekenSleep(basis({ verschuivingMin: 22 }));
  assert.equal(minutenNaarTijd(uit.startMin), "09:15");
  assert.equal(minutenNaarTijd(uit.eindMin), "10:15");
});

test("een afspraak wordt niet korter door hem tegen de bovenkant te trekken", () => {
  // Ver naar boven slepen: het blok stopt bij het eerste zichtbare uur en
  // houdt zijn uur. Zonder deze klem zou hij stilletjes inkorten.
  const uit = berekenSleep(basis({ verschuivingMin: -600 }));
  assert.equal(minutenNaarTijd(uit.startMin), "07:00");
  assert.equal(uit.eindMin - uit.startMin, 60);
});

test("en niet aan de onderkant", () => {
  const uit = berekenSleep(basis({ verschuivingMin: 900 }));
  assert.equal(minutenNaarTijd(uit.eindMin), "21:00");
  assert.equal(uit.eindMin - uit.startMin, 60);
});

test("verlengen beweegt alleen het einde", () => {
  const uit = berekenSleep(basis({ soort: "verlengen", verschuivingMin: 90 }));
  assert.equal(minutenNaarTijd(uit.startMin), "09:00");
  assert.equal(minutenNaarTijd(uit.eindMin), "11:30");
});

test("verkorten stopt bij de minimumduur", () => {
  // Het einde kan niet vóór de start belanden; een afspraak op zijn kop
  // bestaat niet.
  const uit = berekenSleep(basis({ soort: "verlengen", verschuivingMin: -300 }));
  assert.equal(minutenNaarTijd(uit.startMin), "09:00");
  assert.equal(minutenNaarTijd(uit.eindMin), "09:15");
});

test("verlengen negeert een verschuiving in dagen", () => {
  const uit = berekenSleep(basis({ soort: "verlengen", verschuivingMin: 30, dagVerschuiving: 2 }));
  assert.equal(uit.dagVerschuiving, 0);
});

test("verplaatsen geeft de dagverschuiving door", () => {
  const uit = berekenSleep(basis({ verschuivingMin: 0, dagVerschuiving: -1 }));
  assert.equal(uit.dagVerschuiving, -1);
  assert.equal(minutenNaarTijd(uit.startMin), "09:00");
});

test("tijden lezen en schrijven", () => {
  assert.equal(tijdNaarMinuten("2026-09-08 08:30:00"), 510);
  assert.equal(tijdNaarMinuten("2026-09-08T14:45:00"), 885);
  assert.equal(tijdNaarMinuten(undefined), 0);
  assert.equal(minutenNaarTijd(510), "08:30");
  assert.equal(minutenNaarTijd(0), "00:00");
});

test("datum verschuiven springt netjes over een maandgrens", () => {
  assert.equal(verschuifDatum("2026-09-08", 2), "2026-09-10");
  assert.equal(verschuifDatum("2026-09-30", 1), "2026-10-01");
  assert.equal(verschuifDatum("2026-09-01", -1), "2026-08-31");
  assert.equal(verschuifDatum("2026-09-08", 0), "2026-09-08");
});

test("alleen ERPNext-afspraken zijn sleepbaar", () => {
  assert.equal(sleepbaar({ type: "event" }), true);
  // De mailserver slaat een compleet .ics op; opnieuw wegschrijven met de
  // paar velden die wij kennen zou de rest van dat bestand wissen.
  assert.equal(sleepbaar({ type: "mailbox" }), false);
  // Taken, verlof en urenstaten zijn afgeleiden: die verplaats je in hun
  // eigen scherm, niet door ze hier te verslepen.
  for (const type of ["task", "leave", "timesheet", "ical", "o365"]) {
    assert.equal(sleepbaar({ type }), false, type);
  }
});
