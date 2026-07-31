import { test } from "node:test";
import assert from "node:assert/strict";

import { createConnectGate } from "./imap-connect-gate.ts";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

test("serialises connects to the same host: no overlap, submission order", async () => {
  const gate = createConnectGate({ spacingMs: 0 });
  const events: string[] = [];
  let active = 0;
  let maxActive = 0;

  const mk = (id: string) => () =>
    (async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      events.push(`start:${id}`);
      await sleep(20);
      events.push(`end:${id}`);
      active--;
      return id;
    })();

  const results = await Promise.all([
    gate.run("host", mk("a")),
    gate.run("host", mk("b")),
    gate.run("host", mk("c")),
  ]);

  assert.equal(maxActive, 1, "no two connects to the same host may run concurrently");
  assert.deepEqual(results, ["a", "b", "c"]);
  assert.deepEqual(events, [
    "start:a", "end:a",
    "start:b", "end:b",
    "start:c", "end:c",
  ]);
});

test("enforces a minimum spacing between connects on the same host", async () => {
  const spacingMs = 50;
  const gate = createConnectGate({ spacingMs });
  const starts: number[] = [];

  const mk = () => () =>
    (async () => {
      starts.push(Date.now());
      return null;
    })();

  await Promise.all([gate.run("h", mk()), gate.run("h", mk()), gate.run("h", mk())]);

  assert.equal(starts.length, 3);
  // small slack for timer jitter
  assert.ok(starts[1] - starts[0] >= spacingMs - 8, `gap1 ${starts[1] - starts[0]}ms should be >= ${spacingMs}ms`);
  assert.ok(starts[2] - starts[1] >= spacingMs - 8, `gap2 ${starts[2] - starts[1]}ms should be >= ${spacingMs}ms`);
});

test("different hosts are not blocked by each other", async () => {
  const gate = createConnectGate({ spacingMs: 0 });
  const order: string[] = [];

  const slow = gate.run("slow", () =>
    (async () => { await sleep(60); order.push("slow"); })(),
  );
  const fast = gate.run("fast", () =>
    (async () => { await sleep(10); order.push("fast"); })(),
  );

  await Promise.all([slow, fast]);
  assert.deepEqual(order, ["fast", "slow"], "fast host must not wait behind a slow host");
});

test("a failed connect does not break the chain for the next call", async () => {
  const gate = createConnectGate({ spacingMs: 0 });
  const ran: string[] = [];

  const p1 = gate.run("h", () => Promise.reject(new Error("boom")));
  const p2 = gate.run("h", () =>
    (async () => { ran.push("second"); return "ok"; })(),
  );

  await assert.rejects(p1, /boom/);
  assert.equal(await p2, "ok");
  assert.deepEqual(ran, ["second"], "the call after a failed connect must still run");
});

test("run resolves with the fn return value", async () => {
  const gate = createConnectGate({ spacingMs: 0 });
  assert.equal(await gate.run("h", async () => 42), 42);
});

test("rate-cap: no more than maxPerWindow connects start within windowMs (per host)", async () => {
  const windowMs = 200;
  const gate = createConnectGate({ spacingMs: 0, maxPerWindow: 3, windowMs });
  const starts: number[] = [];
  await Promise.all(
    Array.from({ length: 5 }, () => gate.run("h", () => (async () => { starts.push(Date.now()); })())),
  );
  assert.equal(starts.length, 5);
  // De eerste 3 mogen direct; de 4e moet wachten tot de 1e uit het venster valt.
  assert.ok(starts[3] - starts[0] >= windowMs - 15, `4e connect ${starts[3] - starts[0]}ms na 1e moet >= ${windowMs}ms`);
  assert.ok(starts[4] - starts[1] >= windowMs - 15, `5e connect ${starts[4] - starts[1]}ms na 2e moet >= ${windowMs}ms`);
});

test("rate-cap: different hosts have independent windows", async () => {
  const gate = createConnectGate({ spacingMs: 0, maxPerWindow: 2, windowMs: 500 });
  const t0 = Date.now();
  await Promise.all([
    gate.run("a", async () => {}), gate.run("a", async () => {}),
    gate.run("b", async () => {}), gate.run("b", async () => {}),
  ]);
  // 2 per host, cap is 2/host → geen van allen hoeft te wachten.
  assert.ok(Date.now() - t0 < 400, "onafhankelijke host-vensters mogen elkaar niet vertragen");
});

test("rate-cap defaults to off (unlimited) when not configured", async () => {
  const gate = createConnectGate({ spacingMs: 0 });
  const t0 = Date.now();
  await Promise.all(Array.from({ length: 20 }, () => gate.run("h", async () => {})));
  assert.ok(Date.now() - t0 < 300, "zonder maxPerWindow geen rate-limiet");
});
