import { test } from "node:test";
import assert from "node:assert/strict";
import {
  berekenSleep,
  duurUitMinuten,
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
  // Ver naar boven slepen: het blok stopt bij het begin van de dag en houdt
  // zijn uur. Zonder deze klem zou hij stilletjes inkorten.
  const uit = berekenSleep(basis({ verschuivingMin: -600 }));
  assert.equal(minutenNaarTijd(uit.startMin), "00:00");
  assert.equal(uit.eindMin - uit.startMin, 60);
});

test("en niet aan de onderkant", () => {
  // Middernacht is de bodem: het blok eindigt om 24:00 en houdt zijn uur.
  const uit = berekenSleep(basis({ verschuivingMin: 15 * 60 }));
  assert.equal(minutenNaarTijd(uit.startMin), "23:00");
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

test("afspraken zijn sleepbaar, afgeleiden niet", () => {
  assert.equal(sleepbaar({ type: "event" }), true);
  // Sinds het bijwerken over JMAP loopt, kan een mailserver-afspraak mee:
  // een patch raakt alleen de tijd en laat de rest van de afspraak staan.
  assert.equal(sleepbaar({ type: "mailbox" }), true);
  // Taken, verlof en urenstaten zijn afgeleiden: die verplaats je in hun
  // eigen scherm, niet door ze hier te verslepen.
  for (const type of ["task", "leave", "timesheet", "ical", "o365"]) {
    assert.equal(sleepbaar({ type }), false, type);
  }
});

test("een herhalende afspraak blijft staan waar hij staat", () => {
  // Eén blok verslepen zou de hele reeks verzetten.
  assert.equal(sleepbaar({ type: "mailbox", herhaalt: true }), false);
  assert.equal(sleepbaar({ type: "event", herhaalt: true }), false);
});

test("de agenda van een collega is om te kijken", () => {
  // Je ziet daar zijn kopie; die verzet hij zelf.
  assert.equal(sleepbaar({ type: "mailbox", vanAnder: true }), false);
});

test("duur in minuten omzetten naar de notatie van de mailserver", () => {
  assert.equal(duurUitMinuten(90), "PT1H30M");
  assert.equal(duurUitMinuten(60), "PT1H");
  assert.equal(duurUitMinuten(15), "PT15M");
  assert.equal(duurUitMinuten(0), "PT1M");
  assert.equal(duurUitMinuten(1440), "PT24H");
});

test("een uitnodiging zonder antwoord versleep je niet", () => {
  // Hij staat er om te laten zien dat de tijd bezet is. Verzetten is aan de
  // organisator, en eentje die nog in de post staat bestaat als afspraak
  // nog nergens.
  assert.equal(sleepbaar({ type: "mailbox", onbeantwoord: true }), false);
  assert.equal(sleepbaar({ type: "event", onbeantwoord: true }), false);
});
