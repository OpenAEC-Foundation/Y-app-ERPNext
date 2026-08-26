import test from "node:test";
import assert from "node:assert/strict";
import {
  YEAR_SHEET_TITLE_PREFIX,
  bookingYear,
  buildAppendPayload,
  buildCreatePayload,
  normalizeExistingTimeLogs,
  resolveYearTimesheet,
  yearSheetFilters,
  yearSheetTitle,
  type FetchListFn,
} from "./year-timesheet.ts";

/* ─── jaar-bepaling ─── */

test("bookingYear: leest het jaar uit een ISO-datum", () => {
  assert.equal(bookingYear("2026-08-26"), 2026);
  assert.equal(bookingYear("2025-12-31"), 2025);
});

test("bookingYear: 1 januari blijft in hetzelfde jaar (geen Date-timezone-shift)", () => {
  // Via `new Date("2026-01-01")` zou een machine met negatieve UTC-offset
  // 2025 opleveren — precies de boeking die dan in de verkeerde jaarstaat valt.
  assert.equal(bookingYear("2026-01-01"), 2026);
});

test("bookingYear: accepteert een datum met tijd erachter", () => {
  assert.equal(bookingYear("2026-03-04 09:00:00"), 2026);
});

test("bookingYear: weigert onbruikbare invoer", () => {
  for (const bad of ["", "vandaag", "26-08-2026", "2026-13-01", "2026-08-00", null, undefined, 20260826]) {
    assert.equal(bookingYear(bad as unknown as string), null, `verwacht null voor ${String(bad)}`);
  }
});

/* ─── titel + filters ─── */

test("yearSheetTitle: vaste, niet-vertaalde markering", () => {
  assert.equal(yearSheetTitle(2026), "Urenstaat 2026");
  assert.equal(YEAR_SHEET_TITLE_PREFIX, "Urenstaat");
});

test("yearSheetFilters: alleen concepten van deze medewerker, met titel én jaargrens", () => {
  assert.deepEqual(yearSheetFilters("HR-EMP-00002", 2026), [
    ["employee", "=", "HR-EMP-00002"],
    ["docstatus", "=", 0],
    ["title", "=", "Urenstaat 2026"],
    ["start_date", ">=", "2026-01-01"],
    ["start_date", "<=", "2026-12-31"],
  ]);
});

/* ─── resolve (gemockte fetch) ─── */

function mockFetchList(rows: Record<string, unknown>[], calls: unknown[][] = []): FetchListFn {
  return (async (doctype: string, options: Record<string, unknown>) => {
    calls.push([doctype, options]);
    return rows;
  }) as unknown as FetchListFn;
}

test("resolveYearTimesheet: vindt de bestaande jaarstaat en vraagt precies één rij op", async () => {
  const calls: unknown[][] = [];
  const name = await resolveYearTimesheet(
    "HR-EMP-00002",
    "2026-08-26",
    mockFetchList([{ name: "TS-2026-00007" }], calls)
  );
  assert.equal(name, "TS-2026-00007");
  assert.equal(calls.length, 1);
  const [doctype, options] = calls[0] as [string, Record<string, unknown>];
  assert.equal(doctype, "Timesheet");
  assert.deepEqual(options.filters, yearSheetFilters("HR-EMP-00002", 2026));
  assert.deepEqual(options.fields, ["name"]);
  assert.equal(options.limit_page_length, 1);
});

test("resolveYearTimesheet: geen match → null (aanroeper maakt er een aan)", async () => {
  assert.equal(await resolveYearTimesheet("HR-EMP-00002", "2026-08-26", mockFetchList([])), null);
});

test("resolveYearTimesheet: een boeking in een ander jaar zoekt de sheet van dát jaar", async () => {
  const calls: unknown[][] = [];
  await resolveYearTimesheet("HR-EMP-00002", "2025-11-03", mockFetchList([], calls));
  const options = (calls[0] as [string, Record<string, unknown>])[1];
  assert.deepEqual(options.filters, yearSheetFilters("HR-EMP-00002", 2025));
});

test("resolveYearTimesheet: lege medewerker of onbruikbare datum doet géén request", async () => {
  const calls: unknown[][] = [];
  const fetchList = mockFetchList([{ name: "TS-X" }], calls);
  assert.equal(await resolveYearTimesheet("", "2026-08-26", fetchList), null);
  assert.equal(await resolveYearTimesheet("HR-EMP-00002", "onzin", fetchList), null);
  assert.equal(calls.length, 0);
});

test("resolveYearTimesheet: een falende lookup blokkeert de boeking niet", async () => {
  const failing = (async () => {
    throw new Error("ERPNext API error: 500");
  }) as unknown as FetchListFn;
  assert.equal(await resolveYearTimesheet("HR-EMP-00002", "2026-08-26", failing), null);
});

/* ─── payloads ─── */

const LOG_A = {
  name: "row-a",
  activity_type: "Execution",
  from_time: "2026-03-02 09:00:00",
  to_time: "2026-03-02 10:00:00",
  hours: 1,
  project: "PROJ-0029",
  task: "TASK-0001",
  description: "eerste",
  is_billable: 1,
  // afgeleide/permlevel-1-velden die NIET mee mogen
  billing_hours: 1,
  costing_amount: 42,
};

test("normalizeExistingTimeLogs: houdt name + child-metadata en laat afgeleide velden weg", () => {
  const out = normalizeExistingTimeLogs([LOG_A], "TS-2026-00007");
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], {
    name: "row-a",
    doctype: "Timesheet Detail",
    parent: "TS-2026-00007",
    parenttype: "Timesheet",
    parentfield: "time_logs",
    activity_type: "Execution",
    from_time: "2026-03-02 09:00:00",
    to_time: "2026-03-02 10:00:00",
    hours: 1,
    project: "PROJ-0029",
    task: "TASK-0001",
    description: "eerste",
    is_billable: 1,
  });
});

test("normalizeExistingTimeLogs: gooit lege regels weg (ERPNext weigert 0-uren-rijen)", () => {
  const out = normalizeExistingTimeLogs(
    [LOG_A, { name: "leeg", from_time: "", hours: 0 }, { name: "geen-uren", from_time: "2026-03-03 09:00:00", hours: 0 }],
    "TS-2026-00007"
  );
  assert.deepEqual(out.map((l) => l.name), ["row-a"]);
});

test("normalizeExistingTimeLogs: verdraagt een ontbrekende of lege tabel", () => {
  assert.deepEqual(normalizeExistingTimeLogs(undefined, "TS-1"), []);
  assert.deepEqual(normalizeExistingTimeLogs(null, "TS-1"), []);
  assert.deepEqual(normalizeExistingTimeLogs([], "TS-1"), []);
});

test("buildAppendPayload: nieuwe regel komt achter de bestaande", () => {
  const newLog = { activity_type: "Execution", from_time: "2026-06-01 09:00:00", to_time: "2026-06-01 11:00:00", hours: 2 };
  const payload = buildAppendPayload([LOG_A], "TS-2026-00007", newLog);
  assert.equal(payload.time_logs.length, 2);
  assert.equal(payload.time_logs[0].name, "row-a");
  assert.equal(payload.time_logs[1], newLog);
  // niets anders dan time_logs — start_date/end_date zijn read-only en worden
  // door ERPNext zelf uit de regels afgeleid.
  assert.deepEqual(Object.keys(payload), ["time_logs"]);
});

test("buildCreatePayload: zet de jaartitel en stuurt company alleen als die bekend is", () => {
  const newLog = { hours: 1 };
  assert.deepEqual(buildCreatePayload({ employee: "HR-EMP-00002", company: "OpenAEC Studio BV", year: 2026, newLog }), {
    employee: "HR-EMP-00002",
    title: "Urenstaat 2026",
    time_logs: [newLog],
    company: "OpenAEC Studio BV",
  });
  assert.deepEqual(buildCreatePayload({ employee: "HR-EMP-00002", year: 2026, newLog }), {
    employee: "HR-EMP-00002",
    title: "Urenstaat 2026",
    time_logs: [newLog],
  });
});

test("buildCreatePayload: stuurt nooit start_date/end_date mee (read-only in ERPNext)", () => {
  const payload = buildCreatePayload({ employee: "HR-EMP-00002", year: 2026, newLog: { hours: 1 } });
  assert.equal("start_date" in payload, false);
  assert.equal("end_date" in payload, false);
});
