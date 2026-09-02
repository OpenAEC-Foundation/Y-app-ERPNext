import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  parseSelectOptions,
  fetchTaskSelectOptions,
  buildTaskUpdatePayload,
  isEmptyEdit,
  applyTaskEdit,
  deleteTask,
  FALLBACK_STATUS_OPTIONS,
  FALLBACK_PRIORITY_OPTIONS,
} from "./task-bulk.ts";
import { runBulk } from "./bulk-run.ts";

/* ─── fetch-mock ─────────────────────────────────────────────────────────── */

interface Call { method: string; url: string; body: unknown }

let calls: Call[] = [];
let handler: (call: Call) => { status?: number; body?: unknown };
const realFetch = globalThis.fetch;

function installFetchMock() {
  calls = [];
  handler = () => ({ body: { data: {} } });
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const raw = init?.body;
    const body = typeof raw === "string" && raw ? JSON.parse(raw) : undefined;
    const call: Call = { method, url, body };
    calls.push(call);
    const { status = 200, body: out = { data: {} } } = handler(call);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => out,
      text: async () => JSON.stringify(out),
      clone() { return this; },
    } as unknown as Response;
  }) as typeof fetch;
}

beforeEach(installFetchMock);
afterEach(() => { globalThis.fetch = realFetch; });

/* ─── select-opties uit de doctype-meta ──────────────────────────────────── */

test("parseSelectOptions splitst de DocField-optiestring", () => {
  assert.deepEqual(
    parseSelectOptions("Open\nWorking\nPending Review\nOverdue\nTemplate\nCompleted\nCancelled"),
    ["Open", "Working", "Pending Review", "Overdue", "Template", "Completed", "Cancelled"],
  );
  assert.deepEqual(parseSelectOptions("Low\n\nMedium\n"), ["Low", "Medium"]);
  assert.deepEqual(parseSelectOptions(undefined), []);
});

test("statusopties komen uit de meta van de instance, zonder Template", async () => {
  handler = () => ({
    body: {
      message: [
        { fieldname: "status", options: "Open\nWorking\nPending Review\nOverdue\nTemplate\nCompleted\nCancelled" },
        { fieldname: "priority", options: "Low\nMedium\nHigh\nUrgent" },
      ],
    },
  });
  const opts = await fetchTaskSelectOptions();
  assert.deepEqual(opts.status, ["Open", "Working", "Pending Review", "Overdue", "Completed", "Cancelled"]);
  assert.deepEqual(opts.priority, ["Low", "Medium", "High", "Urgent"]);
  // Één RPC — geen volledige doctype-download.
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /frappe\.client\.get_list/);
  assert.equal((calls[0].body as { parent: string }).parent, "DocType");
});

test("een instance met extra statussen krijgt die ook te zien", async () => {
  handler = () => ({
    body: { message: [{ fieldname: "status", options: "Open\nBlocked\nCompleted" }] },
  });
  const opts = await fetchTaskSelectOptions();
  assert.deepEqual(opts.status, ["Open", "Blocked", "Completed"]);
  // Prioriteit ontbrak in het antwoord → terugval, niet leeg.
  assert.deepEqual(opts.priority, FALLBACK_PRIORITY_OPTIONS);
});

test("een mislukt metaverzoek valt terug in plaats van de keuze leeg te laten", async () => {
  handler = () => ({ status: 500, body: { exc: "boom" } });
  const opts = await fetchTaskSelectOptions();
  assert.deepEqual(opts.status, FALLBACK_STATUS_OPTIONS);
  assert.deepEqual(opts.priority, FALLBACK_PRIORITY_OPTIONS);
});

/* ─── payload ────────────────────────────────────────────────────────────── */

test("buildTaskUpdatePayload neemt alleen ingevulde velden mee", () => {
  assert.deepEqual(buildTaskUpdatePayload({ status: "Working" }), { status: "Working" });
  assert.deepEqual(
    buildTaskUpdatePayload({ status: "Open", priority: "High", project: "PROJ-0001", exp_end_date: "2026-09-15" }),
    { status: "Open", priority: "High", project: "PROJ-0001", exp_end_date: "2026-09-15" },
  );
  assert.equal(buildTaskUpdatePayload({}), null);
  assert.equal(buildTaskUpdatePayload({ assignAdd: ["a@b.nl"] }), null);
});

test("een lege string wist het veld en telt dus wél als wijziging", () => {
  assert.deepEqual(buildTaskUpdatePayload({ project: "" }), { project: "" });
  assert.deepEqual(buildTaskUpdatePayload({ exp_end_date: "" }), { exp_end_date: "" });
});

test("isEmptyEdit herkent een bewerking die niets doet", () => {
  assert.equal(isEmptyEdit({}), true);
  assert.equal(isEmptyEdit({ assignAdd: [] }), true);
  assert.equal(isEmptyEdit({ status: "Open" }), false);
  assert.equal(isEmptyEdit({ assignAdd: ["a@b.nl"] }), false);
  assert.equal(isEmptyEdit({ assignClear: true }), false);
});

/* ─── uitvoeren tegen een gemockte fetch ─────────────────────────────────── */

test("velden gaan in één PUT naar /api/resource/Task/<naam>", async () => {
  await applyTaskEdit("TASK-0001", { status: "Working", priority: "High" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PUT");
  assert.equal(calls[0].url, "/api/resource/Task/TASK-0001");
  assert.deepEqual(calls[0].body, { status: "Working", priority: "High" });
});

test("toewijzen loopt via assign_to.add en NIET via het _assign-veld", async () => {
  await applyTaskEdit("TASK-0001", { assignAdd: ["piet@3bm.co.nl"] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/method/frappe.desk.form.assign_to.add");
  assert.deepEqual(calls[0].body, {
    doctype: "Task",
    name: "TASK-0001",
    assign_to: ["piet@3bm.co.nl"],
  });
  assert.equal(calls.some((c) => JSON.stringify(c.body ?? {}).includes("_assign")), false);
});

test("een al toegewezen medewerker levert geen tweede assign-call op", async () => {
  await applyTaskEdit("TASK-0001", { assignAdd: ["piet@3bm.co.nl"] }, ["piet@3bm.co.nl"]);
  assert.deepEqual(calls, []);
});

test("toewijzing leegmaken verwijdert elke bestaande toewijzing apart", async () => {
  await applyTaskEdit("TASK-0001", { assignClear: true }, ["a@x.nl", "b@x.nl"]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((c) => (c.body as { assign_to: string }).assign_to), ["a@x.nl", "b@x.nl"]);
  assert.ok(calls.every((c) => c.url.endsWith("assign_to.remove")));
});

test("vervangen = eerst wissen, dan toevoegen — en de PUT gaat daaraan vooraf", async () => {
  await applyTaskEdit(
    "TASK-0001",
    { status: "Working", assignClear: true, assignAdd: ["nieuw@x.nl"] },
    ["oud@x.nl"],
  );
  assert.deepEqual(calls.map((c) => c.url), [
    "/api/resource/Task/TASK-0001",
    "/api/method/frappe.desk.form.assign_to.remove",
    "/api/method/frappe.desk.form.assign_to.add",
  ]);
});

test("een mislukte PUT verzet de toewijzingen niet", async () => {
  handler = (c) => (c.method === "PUT" ? { status: 417, body: { exc: "nope" } } : { body: { message: [] } });
  await assert.rejects(
    applyTaskEdit("TASK-0001", { status: "Working", assignAdd: ["a@x.nl"] }),
    /417|nope/,
  );
  assert.equal(calls.filter((c) => c.url.includes("assign_to")).length, 0);
});

test("verwijderen gaat via DELETE op de resource", async () => {
  await deleteTask("TASK-0001");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[0].url, "/api/resource/Task/TASK-0001");
});

/* ─── bulk + fetch samen ─────────────────────────────────────────────────── */

test("bulk over gemockte fetch: 403 op één taak laat de rest gewoon slagen", async () => {
  handler = (c) =>
    c.url.endsWith("TASK-0002") ? { status: 403, body: { exc: "PermissionError" } } : { body: { data: {} } };

  const result = await runBulk(
    ["TASK-0001", "TASK-0002", "TASK-0003"],
    (name) => applyTaskEdit(name, { priority: "Urgent" }),
    { concurrency: 2 },
  );

  assert.deepEqual(result.succeeded.slice().sort(), ["TASK-0001", "TASK-0003"]);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].id, "TASK-0002");
  assert.equal(result.failed[0].permission, true);
  // Alle drie zijn geprobeerd — er is niets stilletjes overgeslagen.
  assert.equal(calls.filter((c) => c.method === "PUT").length, 3);
});
