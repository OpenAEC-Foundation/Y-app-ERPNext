import test from "node:test";
import assert from "node:assert/strict";
import {
  YEAR_SHEET_TITLE_PREFIX,
  adoptableSheetFilters,
  bookTimeLog,
  bookingYear,
  buildAppendPayload,
  buildCreatePayload,
  duplicateNameHint,
  isDuplicateNameError,
  normalizeExistingTimeLogs,
  resolveYearTimesheet,
  yearSheetFilters,
  yearSheetTitle,
  type BookDeps,
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

/** fetchList-mock die per aanroep een ander resultaat teruggeeft (stap 1 vs. stap 2). */
function mockFetchListSeq(results: Record<string, unknown>[][], calls: unknown[][] = []): FetchListFn {
  let i = 0;
  return (async (doctype: string, options: Record<string, unknown>) => {
    calls.push([doctype, options]);
    return results[i++] ?? [];
  }) as unknown as FetchListFn;
}

test("resolveYearTimesheet: vindt de gemarkeerde jaarstaat en stopt dan (géén adoptie-call)", async () => {
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
  assert.equal(options.order_by, "start_date desc, modified desc");
});

test("resolveYearTimesheet: zonder markering adopteert hij een bestaande concept-staat van dat jaar", async () => {
  const calls: unknown[][] = [];
  const name = await resolveYearTimesheet(
    "HR-EMP-00002",
    "2026-08-26",
    mockFetchListSeq([[], [{ name: "TS-2026-00011" }]], calls)
  );
  assert.equal(name, "TS-2026-00011", "een bestaande weekstaat wordt geadopteerd i.p.v. genegeerd");
  assert.equal(calls.length, 2);
  assert.deepEqual((calls[1] as [string, Record<string, unknown>])[1].filters, adoptableSheetFilters("HR-EMP-00002", 2026));
});

test("adoptableSheetFilters: geen titel-eis, wel employee + concept + jaargrens", () => {
  assert.deepEqual(adoptableSheetFilters("HR-EMP-00002", 2026), [
    ["employee", "=", "HR-EMP-00002"],
    ["docstatus", "=", 0],
    ["start_date", ">=", "2026-01-01"],
    ["start_date", "<=", "2026-12-31"],
  ]);
});

test("resolveYearTimesheet: niets te adopteren → null (aanroeper maakt er een aan)", async () => {
  const calls: unknown[][] = [];
  assert.equal(await resolveYearTimesheet("HR-EMP-00002", "2026-08-26", mockFetchList([], calls)), null);
  assert.equal(calls.length, 2, "beide stappen zijn geprobeerd");
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

test("buildAppendPayload: nieuwe regel komt achter de bestaande, mét de jaartitel", () => {
  const newLog = { activity_type: "Execution", from_time: "2026-06-01 09:00:00", to_time: "2026-06-01 11:00:00", hours: 2 };
  const payload = buildAppendPayload([LOG_A], "TS-2026-00007", newLog, 2026);
  assert.equal(payload.time_logs.length, 2);
  assert.equal(payload.time_logs[0].name, "row-a");
  assert.equal(payload.time_logs[1], newLog);
  // De titel gaat altijd mee: zo is een geadopteerde weekstaat na één boeking
  // gemarkeerd en vindt de resolve hem de volgende keer meteen.
  assert.equal(payload.title, "Urenstaat 2026");
  // start_date/end_date zijn read-only en worden door ERPNext zelf afgeleid.
  assert.deepEqual(Object.keys(payload).sort(), ["time_logs", "title"]);
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

/* ─── duplicaat-herkenning ─── */

test("isDuplicateNameError: herkent Frappe's duplicaat-melding in beide vormen", () => {
  assert.equal(isDuplicateNameError(new Error("Timesheet TS-2026-00012 already exists")), true);
  assert.equal(
    isDuplicateNameError(new Error("frappe.exceptions.DuplicateEntryError: ('Timesheet', 'TS-2026-00012')")),
    true
  );
  assert.equal(isDuplicateNameError("Timesheet TS-2026-00012 already exists"), true);
});

test("isDuplicateNameError: andere fouten zijn géén duplicaat", () => {
  assert.equal(isDuplicateNameError(new Error("Row 1: From Time and To Time is overlapping with TS-2026-00007")), false);
  assert.equal(isDuplicateNameError(new Error("ERPNext API error: 403")), false);
  assert.equal(isDuplicateNameError(null), false);
  assert.equal(isDuplicateNameError(undefined), false);
});

test("duplicateNameHint: noemt de naam én wijst naar de tellerinstelling", () => {
  const hint = duplicateNameHint(new Error("Timesheet TS-2026-00012 already exists"));
  assert.match(hint, /TS-2026-00012/);
  assert.match(hint, /Document Naming Settings/);
  // Ook zonder herkenbare naam blijft de melding bruikbaar.
  assert.match(duplicateNameHint(new Error("DuplicateEntryError")), /Document Naming Settings/);
});

/* ─── bookTimeLog: het hele boekpad ─── */

interface BookCalls {
  list: unknown[][];
  fetched: string[];
  updated: [string, Record<string, unknown>][];
  created: Record<string, unknown>[];
}

function mockBookDeps(opts: {
  lookups?: Record<string, unknown>[][];
  existingLogs?: Record<string, unknown>[];
  createError?: Error;
  createdName?: string;
}): { deps: BookDeps; calls: BookCalls } {
  const calls: BookCalls = { list: [], fetched: [], updated: [], created: [] };
  let i = 0;
  const deps: BookDeps = {
    fetchList: (async (doctype: string, options: unknown) => {
      calls.list.push([doctype, options]);
      return (opts.lookups ?? [])[i++] ?? [];
    }) as unknown as FetchListFn,
    fetchDocument: (async (_dt: string, name: string) => {
      calls.fetched.push(name);
      return { time_logs: opts.existingLogs ?? [] };
    }) as BookDeps["fetchDocument"],
    createDocument: (async (_dt: string, data: Record<string, unknown>) => {
      calls.created.push(data);
      if (opts.createError) throw opts.createError;
      return { name: opts.createdName ?? "TS-2026-00301" };
    }) as BookDeps["createDocument"],
    updateDocument: async (_dt: string, name: string, data: Record<string, unknown>) => {
      calls.updated.push([name, data]);
      return null;
    },
  };
  return { deps, calls };
}

const NEW_LOG = { from_time: "2026-08-26 09:00:00", to_time: "2026-08-26 10:00:00", hours: 1 };

test("bookTimeLog: bestaande jaarstaat → append, geen create", async () => {
  const { deps, calls } = mockBookDeps({ lookups: [[{ name: "TS-2026-00301" }]], existingLogs: [LOG_A] });
  const res = await bookTimeLog({ employee: "HR-EMP-00002", date: "2026-08-26", newLog: NEW_LOG }, deps);
  assert.deepEqual(res, { name: "TS-2026-00301", created: false });
  assert.deepEqual(calls.created, []);
  assert.deepEqual(calls.fetched, ["TS-2026-00301"]);
  const [name, payload] = calls.updated[0];
  assert.equal(name, "TS-2026-00301");
  assert.equal((payload.time_logs as unknown[]).length, 2);
  assert.equal(payload.title, "Urenstaat 2026");
});

test("bookTimeLog: geadopteerde weekstaat krijgt de jaartitel via de append", async () => {
  const { deps, calls } = mockBookDeps({ lookups: [[], [{ name: "TS-2026-00011" }]] });
  const res = await bookTimeLog({ employee: "HR-EMP-00002", date: "2026-08-26", newLog: NEW_LOG }, deps);
  assert.deepEqual(res, { name: "TS-2026-00011", created: false });
  assert.deepEqual(calls.created, [], "adoptie betekent nooit een nieuw document");
  assert.equal(calls.updated[0][1].title, "Urenstaat 2026");
});

test("bookTimeLog: knownSheet van hetzelfde jaar bespaart de lookup", async () => {
  const { deps, calls } = mockBookDeps({ lookups: [[{ name: "TS-ANDERS" }]] });
  const res = await bookTimeLog(
    { employee: "HR-EMP-00002", date: "2026-08-26", newLog: NEW_LOG, knownSheet: { year: 2026, name: "TS-2026-00301" } },
    deps
  );
  assert.equal(res.name, "TS-2026-00301");
  assert.equal(calls.list.length, 0);
});

test("bookTimeLog: knownSheet van een ánder jaar wordt genegeerd", async () => {
  const { deps, calls } = mockBookDeps({ lookups: [[{ name: "TS-2025-00099" }]] });
  const res = await bookTimeLog(
    { employee: "HR-EMP-00002", date: "2025-11-03", newLog: NEW_LOG, knownSheet: { year: 2026, name: "TS-2026-00301" } },
    deps
  );
  assert.equal(res.name, "TS-2025-00099");
  assert.equal(calls.list.length, 1);
});

test("bookTimeLog: niets te adopteren → create met de jaartitel", async () => {
  const { deps, calls } = mockBookDeps({ lookups: [[], []], createdName: "TS-2026-00301" });
  const res = await bookTimeLog(
    { employee: "HR-EMP-00002", company: "OpenAEC Studio BV", date: "2026-08-26", newLog: NEW_LOG },
    deps
  );
  assert.deepEqual(res, { name: "TS-2026-00301", created: true });
  assert.deepEqual(calls.created[0], {
    employee: "HR-EMP-00002",
    company: "OpenAEC Studio BV",
    title: "Urenstaat 2026",
    time_logs: [NEW_LOG],
  });
});

test("bookTimeLog: duplicaat bij create → één herpoging via adoptie, dan append", async () => {
  // Scenario: parallelle boeking maakte net een sheet aan; de tweede lookup
  // vindt hem alsnog.
  const { deps, calls } = mockBookDeps({
    lookups: [[], [], [{ name: "TS-2026-00301" }]],
    createError: new Error("Timesheet TS-2026-00012 already exists"),
  });
  const res = await bookTimeLog({ employee: "HR-EMP-00002", date: "2026-08-26", newLog: NEW_LOG }, deps);
  assert.deepEqual(res, { name: "TS-2026-00301", created: false });
  assert.equal(calls.created.length, 1, "precies één create-poging, geen lus");
  assert.equal(calls.updated.length, 1);
});

test("bookTimeLog: duplicaat zonder adopteerbare sheet → leesbare tellerfout, geen lus", async () => {
  // Dit is de teller-desync: blind opnieuw proberen heeft geen zin omdat
  // Frappe de tellerverhoging bij een mislukte insert terugdraait.
  const { deps, calls } = mockBookDeps({
    lookups: [[], [], [], []],
    createError: new Error("Timesheet TS-2026-00012 already exists"),
  });
  await assert.rejects(
    () => bookTimeLog({ employee: "HR-EMP-00002", date: "2026-08-26", newLog: NEW_LOG }, deps),
    (err: Error) => /TS-2026-00012/.test(err.message) && /Document Naming Settings/.test(err.message)
  );
  assert.equal(calls.created.length, 1);
});

test("bookTimeLog: een niet-duplicaat-fout gaat ongemoeid door naar de aanroeper", async () => {
  const { deps, calls } = mockBookDeps({
    lookups: [[], []],
    createError: new Error("Row 1: From Time and To Time is overlapping with TS-2026-00007"),
  });
  await assert.rejects(
    () => bookTimeLog({ employee: "HR-EMP-00002", date: "2026-08-26", newLog: NEW_LOG }, deps),
    /overlapping/
  );
  assert.equal(calls.list.length, 2, "geen extra resolve-poging bij een gewone validatiefout");
});

test("bookTimeLog: lege medewerker of onbruikbare datum gooit vóór elke call", async () => {
  const { deps, calls } = mockBookDeps({ lookups: [[{ name: "TS-X" }]] });
  await assert.rejects(() => bookTimeLog({ employee: "", date: "2026-08-26", newLog: NEW_LOG }, deps), /medewerker/);
  await assert.rejects(() => bookTimeLog({ employee: "E1", date: "onzin", newLog: NEW_LOG }, deps), /boekdatum/);
  assert.equal(calls.list.length, 0);
});
