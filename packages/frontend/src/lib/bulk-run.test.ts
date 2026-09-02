import { test } from "node:test";
import assert from "node:assert/strict";
import { runBulk } from "./bulk-run.ts";
import { ApiError } from "./erpnext.ts";

const IDS = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);

test("alles geslaagd: elke id komt precies één keer terug", async () => {
  const seen: string[] = [];
  const result = await runBulk(IDS, async (id) => { seen.push(id); });
  assert.equal(result.total, 12);
  assert.deepEqual(result.succeeded.slice().sort(), IDS.slice().sort());
  assert.deepEqual(result.failed, []);
  assert.deepEqual(seen.slice().sort(), IDS.slice().sort());
});

test("deelfouten verdwijnen niet: geslaagd én mislukt komen beide terug", async () => {
  const result = await runBulk(IDS, async (id) => {
    if (id === "T3") throw new ApiError(417, "Value missing for Task: subject");
    if (id === "T7") throw new Error("Request timed out after 30s");
  });
  assert.equal(result.succeeded.length, 10);
  assert.equal(result.failed.length, 2);
  const byId = new Map(result.failed.map((f) => [f.id, f]));
  assert.match(byId.get("T3")!.message, /Value missing/);
  assert.match(byId.get("T7")!.message, /timed out/);
  // Geslaagde taken staan er ook echt in — er wordt niets teruggedraaid.
  assert.equal(result.succeeded.includes("T1"), true);
});

test("een rechtenfout wordt als zodanig gemarkeerd, een gewone fout niet", async () => {
  const result = await runBulk(["A", "B"], async (id) => {
    if (id === "A") throw new ApiError(403, "No permission to access Task");
    throw new ApiError(500, "ERPNext API error: 500");
  });
  const byId = new Map(result.failed.map((f) => [f.id, f]));
  assert.equal(byId.get("A")!.permission, true);
  assert.equal(byId.get("B")!.permission, false);
});

test("een worker die iets anders dan een Error gooit levert nog steeds een leesbare reden", async () => {
  const result = await runBulk(["A", "B"], async (id) => {
    if (id === "A") throw "kapot";
    throw { weird: true };
  });
  const byId = new Map(result.failed.map((f) => [f.id, f]));
  assert.equal(byId.get("A")!.message, "kapot");
  assert.equal(byId.get("B")!.message, "Onbekende fout");
});

test("parallelliteit is begrensd: nooit meer dan `concurrency` tegelijk in de lucht", async () => {
  let inFlight = 0;
  let peak = 0;
  await runBulk(IDS, async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
  }, { concurrency: 3 });
  assert.equal(peak, 3);
});

test("de begrenzing blijft gelden als er tussendoor fouten vallen", async () => {
  let inFlight = 0;
  let peak = 0;
  await runBulk(IDS, async (id) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
    if (Number(id.slice(1)) % 2 === 0) throw new Error("even faalt");
  }, { concurrency: 4 });
  assert.equal(peak, 4);
});

test("voortgang telt elke afronding, geslaagd of mislukt, tot en met total", async () => {
  const ticks: number[] = [];
  const result = await runBulk(IDS, async (id) => {
    if (id === "T5") throw new Error("nee");
  }, { concurrency: 2, onProgress: (done, total) => { ticks.push(done); assert.equal(total, 12); } });
  assert.equal(ticks.length, 12);
  assert.deepEqual(ticks.slice().sort((a, b) => a - b), IDS.map((_, i) => i + 1));
  assert.equal(result.succeeded.length + result.failed.length, 12);
});

test("een lege lijst doet niets en levert een leeg rapport", async () => {
  let calls = 0;
  const result = await runBulk([], async () => { calls++; });
  assert.equal(calls, 0);
  assert.deepEqual(result, { total: 0, succeeded: [], failed: [] });
});

test("afbreken stopt met starten maar rapporteert wat al gedaan was", async () => {
  const signal = { aborted: false };
  const started: string[] = [];
  const result = await runBulk(IDS, async (id) => {
    started.push(id);
    if (started.length >= 4) signal.aborted = true;
    await new Promise((r) => setTimeout(r, 1));
  }, { concurrency: 2, signal });
  assert.ok(started.length < 12, `verwacht vroegtijdig stoppen, kreeg ${started.length}`);
  assert.equal(result.succeeded.length, started.length);
  assert.equal(result.total, 12);
});

test("concurrency hoger dan het aantal taken start geen lege lanes", async () => {
  let peak = 0;
  let inFlight = 0;
  await runBulk(["A", "B"], async () => {
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
  }, { concurrency: 50 });
  assert.equal(peak, 2);
});
