import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateHoursByEmployeeDay,
  bucketHoursByEmployeeDay,
  bucketHoursByEmployeeWeek,
  fetchTimesheetHourRows,
  isoWeekOf,
  logDateOf,
  type TimesheetHourDeps,
  type TimesheetHourRow,
} from "./timesheet-hours.ts";

/* ─── logDateOf ─── */

test("logDateOf: leest de datum uit beide from_time-vormen", () => {
  assert.equal(logDateOf("2026-08-26 09:00:00"), "2026-08-26");
  assert.equal(logDateOf("2026-08-26T09:00:00"), "2026-08-26");
  assert.equal(logDateOf("2026-08-26"), "2026-08-26");
});

test("logDateOf: onbruikbare invoer geeft null", () => {
  for (const bad of ["", "geen datum", null, undefined, 42, {}]) {
    assert.equal(logDateOf(bad), null, `verwacht null voor ${String(bad)}`);
  }
});

/* ─── isoWeekOf ─── */

test("isoWeekOf: komt overeen met de losse getISOWeek(Date) die het verving", () => {
  // Referentie-implementatie zoals ze in Leave.tsx/Employees.tsx stond.
  const reference = (d: Date): number => {
    const tmp = new Date(d.getTime());
    tmp.setHours(0, 0, 0, 0);
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const w1 = new Date(tmp.getFullYear(), 0, 4);
    return 1 + Math.round(((tmp.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  };
  // Een heel jaar doorlopen: elke dag moet hetzelfde weeknummer geven.
  const d = new Date(2026, 0, 1, 12, 0, 0);
  for (let i = 0; i < 365; i++) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    assert.equal(isoWeekOf(iso), reference(d), `weeknummer wijkt af op ${iso}`);
    d.setDate(d.getDate() + 1);
  }
});

test("isoWeekOf: bekende ISO-grenzen", () => {
  assert.equal(isoWeekOf("2026-01-01"), 1);
  assert.equal(isoWeekOf("2024-12-30"), 1); // hoort al bij week 1 van 2025
  assert.equal(isoWeekOf("2026-08-26 09:00:00"), 35);
});

test("isoWeekOf: onbruikbare invoer geeft null", () => {
  for (const bad of ["", "26-08-2026", null, undefined]) {
    assert.equal(isoWeekOf(bad as unknown as string), null);
  }
});

/* ─── bucketing ─── */

const ROWS: TimesheetHourRow[] = [
  { employee: "E1", employee_name: "Ethan", parent: "TS-A", date: "2026-08-24", hours: 8 }, // week 35, ma
  { employee: "E1", employee_name: "Ethan", parent: "TS-A", date: "2026-08-24", hours: 1 }, // zelfde dag
  { employee: "E1", employee_name: "Ethan", parent: "TS-A", date: "2026-08-31", hours: 4 }, // week 36
  { employee: "E2", employee_name: "Nora", parent: "TS-A", date: "2026-08-25", hours: 6 },  // week 35
];

test("bucketHoursByEmployeeWeek: telt per medewerker per ISO-week op", () => {
  const out = bucketHoursByEmployeeWeek(ROWS);
  assert.equal(out.get("E1")?.get(35), 9);
  assert.equal(out.get("E1")?.get(36), 4);
  assert.equal(out.get("E2")?.get(35), 6);
});

test("bucketHoursByEmployeeWeek: één jaarstaat wordt over de echte weken verdeeld, niet in week 1", () => {
  // Dit is de regressie waar het om gaat: alle regels hangen aan dezelfde
  // parent (de jaarstaat), maar hun datums lopen door het jaar heen.
  const jaarstaat: TimesheetHourRow[] = [
    { employee: "E1", employee_name: "Ethan", parent: "TS-2026-00001", date: "2026-01-05", hours: 8 },
    { employee: "E1", employee_name: "Ethan", parent: "TS-2026-00001", date: "2026-06-15", hours: 8 },
    { employee: "E1", employee_name: "Ethan", parent: "TS-2026-00001", date: "2026-11-23", hours: 8 },
  ];
  const weeks = bucketHoursByEmployeeWeek(jaarstaat).get("E1")!;
  assert.equal(weeks.size, 3);
  assert.deepEqual([...weeks.keys()].sort((a, b) => a - b), [2, 25, 48]);
  for (const total of weeks.values()) assert.equal(total, 8);
});

test("bucketHoursByEmployeeWeek: regels zonder uren, medewerker of geldige datum tellen niet mee", () => {
  const out = bucketHoursByEmployeeWeek([
    ...ROWS,
    { employee: "E1", employee_name: "Ethan", parent: "TS-A", date: "2026-08-24", hours: 0 },
    { employee: "", employee_name: "", parent: "TS-A", date: "2026-08-24", hours: 5 },
    { employee: "E1", employee_name: "Ethan", parent: "TS-A", date: "onzin", hours: 5 },
  ]);
  assert.equal(out.get("E1")?.get(35), 9);
  assert.equal(out.has(""), false);
});

test("bucketHoursByEmployeeDay: telt per medewerker per dag op", () => {
  const out = bucketHoursByEmployeeDay(ROWS);
  assert.equal(out.get("E1")?.get("2026-08-24"), 9);
  assert.equal(out.get("E1")?.get("2026-08-31"), 4);
  assert.equal(out.get("E2")?.get("2026-08-25"), 6);
});

test("aggregateHoursByEmployeeDay: platte, gesorteerde lijst met samengevoegde dagen", () => {
  const out = aggregateHoursByEmployeeDay(ROWS);
  assert.deepEqual(
    out.map((r) => `${r.date}|${r.employee_name}|${r.hours}`),
    ["2026-08-24|Ethan|9", "2026-08-25|Nora|6", "2026-08-31|Ethan|4"]
  );
});

test("aggregateHoursByEmployeeDay: vult een ontbrekende naam aan uit een latere regel", () => {
  const out = aggregateHoursByEmployeeDay([
    { employee: "E1", employee_name: "", parent: "TS-A", date: "2026-08-24", hours: 2 },
    { employee: "E1", employee_name: "Ethan", parent: "TS-A", date: "2026-08-24", hours: 3 },
  ]);
  assert.deepEqual(out, [{ employee: "E1", employee_name: "Ethan", date: "2026-08-24", hours: 5 }]);
});

/* ─── fetch (gemockt) ─── */

function mockDeps(
  parents: Record<string, unknown>[],
  childRows: Record<string, unknown>[],
  calls: { list: unknown[][]; child: unknown[][] } = { list: [], child: [] }
): TimesheetHourDeps {
  return {
    fetchList: (async (doctype: string, options: unknown) => {
      calls.list.push([doctype, options]);
      return parents;
    }) as TimesheetHourDeps["fetchList"],
    fetchChildTable: (async (
      child: string,
      parent: string,
      fields: string[],
      filters: unknown[][],
      cap: number
    ) => {
      calls.child.push([child, parent, fields, filters, cap]);
      const chunk = (filters.find((f) => f[0] === "parent") || [])[2] as string[];
      return childRows.filter((r) => chunk.includes(r.parent as string));
    }) as TimesheetHourDeps["fetchChildTable"],
  };
}

test("fetchTimesheetHourRows: één lijst-call + één child-call, en verrijkt met de medewerker", async () => {
  const calls = { list: [] as unknown[][], child: [] as unknown[][] };
  const deps = mockDeps(
    [{ name: "TS-2026-00001", employee: "E1", employee_name: "Ethan" }],
    [
      { parent: "TS-2026-00001", from_time: "2026-08-24 09:00:00", hours: 8 },
      { parent: "TS-2026-00001", from_time: "2026-08-25 09:00:00", hours: 4 },
    ],
    calls
  );
  const rows = await fetchTimesheetHourRows({ from: "2026-08-01", to: "2026-08-31" }, deps);

  assert.equal(calls.list.length, 1);
  assert.equal(calls.child.length, 1, "geen call per dag of per sheet");
  assert.deepEqual(rows, [
    { employee: "E1", employee_name: "Ethan", parent: "TS-2026-00001", date: "2026-08-24", hours: 8 },
    { employee: "E1", employee_name: "Ethan", parent: "TS-2026-00001", date: "2026-08-25", hours: 4 },
  ]);
});

test("fetchTimesheetHourRows: sheets worden op OVERLAP gefilterd, niet op 'binnen het bereik'", async () => {
  const calls = { list: [] as unknown[][], child: [] as unknown[][] };
  await fetchTimesheetHourRows({ from: "2026-08-01", to: "2026-08-31" }, mockDeps([], [], calls));
  const options = (calls.list[0] as [string, { filters: unknown[][] }])[1];
  assert.deepEqual(options.filters, [
    ["start_date", "<=", "2026-08-31"],
    ["end_date", ">=", "2026-08-01"],
    ["docstatus", "!=", 2],
  ]);
});

test("fetchTimesheetHourRows: de child-regels worden op from_time begrensd", async () => {
  const calls = { list: [] as unknown[][], child: [] as unknown[][] };
  await fetchTimesheetHourRows(
    { from: "2026-08-01", to: "2026-08-31" },
    mockDeps([{ name: "TS-A", employee: "E1", employee_name: "Ethan" }], [], calls)
  );
  const [, , fields, filters] = calls.child[0] as [string, string, string[], unknown[][], number];
  assert.deepEqual(fields, ["parent", "from_time", "hours"]);
  assert.deepEqual(filters, [
    ["parent", "in", ["TS-A"]],
    ["from_time", ">=", "2026-08-01 00:00:00"],
    ["from_time", "<=", "2026-08-31 23:59:59"],
  ]);
});

test("fetchTimesheetHourRows: zonder sheets geen enkele child-call", async () => {
  const calls = { list: [] as unknown[][], child: [] as unknown[][] };
  const rows = await fetchTimesheetHourRows({ from: "2026-08-01", to: "2026-08-31" }, mockDeps([], [], calls));
  assert.deepEqual(rows, []);
  assert.equal(calls.child.length, 0);
});

test("fetchTimesheetHourRows: leeg bereik doet niets", async () => {
  const calls = { list: [] as unknown[][], child: [] as unknown[][] };
  assert.deepEqual(await fetchTimesheetHourRows({ from: "", to: "2026-08-31" }, mockDeps([], [], calls)), []);
  assert.equal(calls.list.length, 0);
});

test("fetchTimesheetHourRows: parents worden in chunks van 200 opgevraagd", async () => {
  const calls = { list: [] as unknown[][], child: [] as unknown[][] };
  const parents = Array.from({ length: 450 }, (_, i) => ({
    name: `TS-${i}`,
    employee: "E1",
    employee_name: "Ethan",
  }));
  await fetchTimesheetHourRows({ from: "2026-01-01", to: "2026-12-31" }, mockDeps(parents, [], calls));
  assert.equal(calls.child.length, 3);
  const sizes = calls.child.map((c) => ((c[3] as unknown[][]).find((f) => f[0] === "parent") as [string, string, string[]])[2].length);
  assert.deepEqual(sizes, [200, 200, 50]);
});

test("fetchTimesheetHourRows: verzadigd resultaat gooit i.p.v. stil te weinig uren te melden", async () => {
  const parents = [{ name: "TS-A", employee: "E1", employee_name: "Ethan" }];
  const many = Array.from({ length: 20000 }, () => ({
    parent: "TS-A",
    from_time: "2026-08-24 09:00:00",
    hours: 1,
  }));
  await assert.rejects(
    () => fetchTimesheetHourRows({ from: "2026-01-01", to: "2026-12-31" }, mockDeps(parents, many)),
    /Te veel urenregels/
  );
});

test("fetchTimesheetHourRows: regels van een onbekende parent of zonder datum/uren vallen weg", async () => {
  const rows = await fetchTimesheetHourRows(
    { from: "2026-08-01", to: "2026-08-31" },
    mockDeps(
      [{ name: "TS-A", employee: "E1", employee_name: "Ethan" }],
      [
        { parent: "TS-A", from_time: "2026-08-24 09:00:00", hours: 8 },
        { parent: "TS-A", from_time: "", hours: 3 },
        { parent: "TS-A", from_time: "2026-08-25 09:00:00", hours: 0 },
      ]
    )
  );
  assert.deepEqual(rows.map((r) => r.date), ["2026-08-24"]);
});
