import test from "node:test";
import assert from "node:assert/strict";
import {
  erpHerhaalVelden, kerenInPeriode, minutenTussen, normaliseerRegels, plusMinuten, regelVanErpEvent,
  regelVoorKeuze, rrule, voorkomens,
} from "./agenda-herhaling.ts";

test("wekelijks overleg staat ook in latere weken", () => {
  const regel = normaliseerRegels({ "@type": "RecurrenceRule", frequency: "weekly", byDay: [{ day: "mo" }] })[0];
  assert.deepEqual(voorkomens("2026-07-13T09:00:00", regel, "2026-09-21", "2026-09-27"), ["2026-09-21T09:00:00"]);
  assert.deepEqual(voorkomens("2026-07-13T09:00:00", regel, "2026-07-01", "2026-07-20"), ["2026-07-13T09:00:00", "2026-07-20T09:00:00"]);
});

test("werkdagen, om de week en een einddatum", () => {
  const werkdagen = regelVoorKeuze("weekdays", "2026-09-21")!;
  assert.equal(voorkomens("2026-09-21 08:30:00", werkdagen, "2026-09-21", "2026-09-27").length, 5);
  const omDeWeek = regelVoorKeuze("biweekly", "2026-09-21")!;
  assert.deepEqual(voorkomens("2026-09-21 08:30:00", omDeWeek, "2026-09-21", "2026-10-19"),
    ["2026-09-21 08:30:00", "2026-10-05 08:30:00", "2026-10-19 08:30:00"]);
  const tot = regelVoorKeuze("daily", "2026-09-21", "2026-09-23")!;
  assert.deepEqual(voorkomens("2026-09-21", tot, "2026-09-01", "2026-09-30"), ["2026-09-21", "2026-09-22", "2026-09-23"]);
});

test("maandelijks slaat een niet-bestaande dag over; aantal en uitzonderingen tellen mee", () => {
  const maand = { frequency: "monthly" as const };
  assert.deepEqual(voorkomens("2026-01-31T10:00:00", maand, "2026-01-01", "2026-04-30"),
    ["2026-01-31T10:00:00", "2026-03-31T10:00:00"]);
  const drie = { frequency: "daily" as const, count: 3 };
  assert.deepEqual(voorkomens("2026-09-01", drie, "2026-09-02", "2026-09-30"), ["2026-09-02", "2026-09-03"]);
  const week = { frequency: "weekly" as const };
  assert.deepEqual(voorkomens("2026-09-07T09:00:00", week, "2026-09-07", "2026-09-21", ["2026-09-14T09:00:00"]),
    ["2026-09-07T09:00:00", "2026-09-21T09:00:00"]);
});

test("RRULE voor het .ics-bestand", () => {
  assert.equal(rrule(regelVoorKeuze("weekly", "2026-09-21", "2026-12-31")!, false), "RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231T235959Z");
  assert.equal(rrule(regelVoorKeuze("biweekly", "2026-09-22")!, true), "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU");
  assert.equal(rrule(regelVoorKeuze("yearly", "2026-09-22", "2030-01-01")!, true), "RRULE:FREQ=YEARLY;UNTIL=20300101");
});

test("ERPNext-velden heen en terug", () => {
  const velden = erpHerhaalVelden("weekdays", "2026-09-21", "2026-12-31");
  assert.equal(velden.repeat_on, "Weekly");
  assert.equal(velden.monday, 1);
  assert.equal(velden.saturday, 0);
  const regel = regelVanErpEvent({ ...velden, repeat_this_event: 1 })!;
  assert.equal(voorkomens("2026-09-21 09:00:00", regel, "2026-09-21", "2026-09-27").length, 5);
  assert.equal(regelVanErpEvent({ repeat_this_event: 0 }), null);
  assert.deepEqual(erpHerhaalVelden("", "2026-09-21"), { repeat_this_event: 0 });
});

test("rekenen met lokale tijden", () => {
  assert.equal(minutenTussen("2026-09-21 09:00:00", "2026-09-21 10:30:00"), 90);
  assert.equal(plusMinuten("2026-09-21T23:30:00", 60), "2026-09-22T00:30:00");
});

test("mailserver-reeks: voorkomens, weggehaald en verzet", () => {
  const a = {
    start: "2026-07-13T09:00:00", duur: "PT1H", herhaalt: true,
    herhaling: { frequency: "weekly", byDay: [{ day: "mo" }] },
    uitzonderingen: {
      "2026-09-14T09:00:00": { weg: true },
      "2026-09-21T09:00:00": { start: "2026-09-22T10:00:00" },
    },
  };
  assert.deepEqual(kerenInPeriode(a, "2026-09-07", "2026-09-27").map((k) => k.start),
    ["2026-09-07T09:00:00", "2026-09-22T10:00:00"]);
  // Zonder regel (oud Server Script) blijft het één afspraak.
  assert.deepEqual(kerenInPeriode({ start: "2026-07-13T09:00:00", herhaalt: true }, "2026-09-07", "2026-09-27"),
    [{ start: "2026-07-13T09:00:00", duur: undefined, reeks: false }]);
});

test("de begintijd telt altijd als eerste keer", () => {
  const regel = { frequency: "weekly" as const, byDay: [{ day: "we" }] };
  assert.deepEqual(voorkomens("2026-09-21 09:00:00", regel, "2026-09-21", "2026-09-27"),
    ["2026-09-21 09:00:00", "2026-09-23 09:00:00"]);
});
