import { test } from "node:test";
import assert from "node:assert/strict";
import {
  draaitabel,
  isoWeek,
  naarCsv,
  periodeVan,
  regelsUitRijen,
  tijdLabel,
  urenTekst,
  verschuif,
  type UrenRegel,
} from "./uren-rapport.ts";

/** Een regel zoals `regelsUitRijen` hem maakt. */
function regel(overrides: Partial<UrenRegel> = {}): UrenRegel {
  return {
    urenstaat: "TS-HR-EMP-00003-2026-WN38-V01",
    medewerker: "HR-EMP-00003",
    medewerkerNaam: "Maarten Vroegindeweij",
    datum: "2026-09-18",
    van: "2026-09-18 00:00:00",
    project: "2022",
    activiteit: "Execution",
    uren: 0.25,
    declarabel: true,
    omschrijving: "Eykenburg",
    ...overrides,
  };
}

/* ─────────────────────────────── Periodes ─────────────────────────────── */

test("isoWeek: gewone week en de randen van het jaar", () => {
  assert.deepEqual(isoWeek("2026-09-14"), { jaar: 2026, week: 38 });
  assert.deepEqual(isoWeek("2026-09-20"), { jaar: 2026, week: 38 });
  assert.deepEqual(isoWeek("2026-01-01"), { jaar: 2026, week: 1 });
  // 2026 begint op donderdag en heeft daardoor 53 weken.
  assert.deepEqual(isoWeek("2027-01-01"), { jaar: 2026, week: 53 });
  assert.deepEqual(isoWeek("2025-12-29"), { jaar: 2026, week: 1 });
});

test("periodeVan: week (ma–zo), maand, kwartaal en jaar", () => {
  assert.deepEqual(periodeVan("week", "2026-09-18"), { van: "2026-09-14", tot: "2026-09-20" });
  assert.deepEqual(periodeVan("maand", "2026-09-18"), { van: "2026-09-01", tot: "2026-09-30" });
  assert.deepEqual(periodeVan("maand", "2026-02-10"), { van: "2026-02-01", tot: "2026-02-28" });
  assert.deepEqual(periodeVan("kwartaal", "2026-09-18"), { van: "2026-07-01", tot: "2026-09-30" });
  assert.deepEqual(periodeVan("jaar", "2026-09-18"), { van: "2026-01-01", tot: "2026-12-31" });
});

test("verschuif: een periode verder of terug, ook over maand- en jaargrenzen", () => {
  assert.equal(verschuif("week", "2026-09-18", 1), "2026-09-21");
  assert.equal(verschuif("week", "2026-09-18", -1), "2026-09-07");
  assert.equal(verschuif("maand", "2026-03-31", -1), "2026-02-01");
  assert.equal(verschuif("maand", "2026-12-15", 1), "2027-01-01");
  assert.equal(verschuif("kwartaal", "2026-09-18", 1), "2026-10-01");
  assert.equal(verschuif("jaar", "2026-09-18", -1), "2025-01-01");
});

/* ─────────────────────────────── Regels ───────────────────────────────── */

test("regelsUitRijen: velden omzetten en alleen regels binnen de periode", () => {
  const regels = regelsUitRijen([
    { name: "TS-1", employee: "HR-EMP-00003", employee_name: "Maarten Vroegindeweij", from_time: "2026-09-18 00:15:00",
      hours: 0.75, project: "2639", activity_type: "Execution", is_billable: 1, description: "Nijmegen" },
    // Een onmogelijke datum uit een oude import: valt buiten elke periode.
    { name: "TS-2", employee: "HR-EMP-00015", employee_name: "Joris Bongers", from_time: "2106-10-27 07:30:00", hours: 4.5, project: "0413" },
    { name: "TS-3", employee: "HR-EMP-00003", employee_name: "Maarten Vroegindeweij", from_time: "2026-09-13 23:00:00", hours: 1 },
    { name: "TS-4", employee: "HR-EMP-00003", employee_name: "Maarten Vroegindeweij", from_time: "2026-09-16 10:00:00", hours: 0 },
  ], "2026-09-14", "2026-09-20");
  assert.equal(regels.length, 1);
  assert.deepEqual(regels[0], {
    urenstaat: "TS-1", medewerker: "HR-EMP-00003", medewerkerNaam: "Maarten Vroegindeweij",
    datum: "2026-09-18", van: "2026-09-18 00:15:00", project: "2639", activiteit: "Execution",
    uren: 0.75, declarabel: true, omschrijving: "Nijmegen",
  });
});

/* ───────────────────────────── Draaitabel ─────────────────────────────── */

test("draaitabel: medewerker × week, met totalen per rij, kolom en geheel", () => {
  const tabel = draaitabel([
    regel({ uren: 0.25 }),
    regel({ uren: 0.75, project: "2639" }),
    regel({ uren: 0.5, project: "3296" }),
    regel({ datum: "2026-09-08", uren: 8 }),
    regel({ medewerker: "HR-EMP-00028", medewerkerNaam: "Abdirahman Ali", datum: "2026-09-16", uren: 4 }),
  ], "medewerker", "week", (_d, s) => ({ "HR-EMP-00003": "Maarten", "HR-EMP-00028": "Ali" }[s] ?? s));
  assert.deepEqual(tabel.kolommen, ["2026-W37", "2026-W38"]);
  // Op naam gesorteerd: Ali vóór Maarten.
  assert.deepEqual(tabel.rijen.map((r) => [r.sleutel, r.cellen, r.totaal]), [
    ["HR-EMP-00028", { "2026-W38": 4 }, 4],
    ["HR-EMP-00003", { "2026-W37": 8, "2026-W38": 1.5 }, 9.5],
  ]);
  assert.deepEqual(tabel.kolomTotalen, { "2026-W37": 8, "2026-W38": 5.5 });
  assert.equal(tabel.totaal, 13.5);
});

test("draaitabel: zonder kolommen alleen een totaal per rij; project zonder nummer heeft een eigen rij", () => {
  const tabel = draaitabel([regel({ project: "" }), regel({ project: "2022", uren: 1 })], "project", null);
  assert.deepEqual(tabel.kolommen, []);
  assert.deepEqual(tabel.rijen.map((r) => [r.sleutel, r.totaal]), [["", 0.25], ["2022", 1]]);
  assert.equal(tabel.totaal, 1.25);
});

/* ─────────────────────────── Labels en export ─────────────────────────── */

test("tijdLabel: dag, week en maand zoals in een urenstaat", () => {
  assert.equal(tijdLabel("dag", "2026-09-14"), "ma 14-09");
  assert.equal(tijdLabel("week", "2026-W38"), "wk 38");
  assert.equal(tijdLabel("maand", "2026-09"), "sep 2026");
  assert.equal(tijdLabel("project", "2022"), "2022");
});

test("urenTekst: decimale komma, zonder overbodige nullen", () => {
  assert.equal(urenTekst(7.5), "7,5");
  assert.equal(urenTekst(0.25), "0,25");
  assert.equal(urenTekst(8), "8");
  assert.equal(urenTekst(1.1666666), "1,17");
});

test("naarCsv: puntkomma's, decimale komma, totalen en aanhalingstekens waar nodig", () => {
  // Hetzelfde label voor de volgorde van de tabel en de tekst in de CSV, zoals het scherm dat doet.
  const label = (d: string, s: string) => (d === "medewerker" ? ({ "HR-EMP-00003": "Maarten", X: "Hoeven; M. van der" }[s] ?? s) : tijdLabel(d as "week", s));
  const tabel = draaitabel([
    regel({ uren: 1.5 }),
    regel({ medewerker: "X", medewerkerNaam: "Hoeven; M. van der", uren: 2, datum: "2026-09-08" }),
  ], "medewerker", "week", label);
  const csv = naarCsv(tabel, "medewerker", "week", label, "Medewerker");
  assert.equal(csv, [
    "Medewerker;wk 37;wk 38;Totaal",
    '"Hoeven; M. van der";2;;2',
    "Maarten;;1,5;1,5",
    "Totaal;2;1,5;3,5",
  ].join("\r\n"));
});
