import { test } from "node:test";
import assert from "node:assert/strict";
import { studioAssetUrl, plannerAssetUrl, safeCadSource, cadLoadMessage, readCadReply, readCadBytes, guardCadBeforeUnload } from "./studio.ts";

test("studio assets resolve within the deployed frontend base", () => {
  assert.equal(studioAssetUrl("cad", "/assets/y_next/app/"), "/assets/y_next/app/studios/cad/index.html");
  assert.equal(studioAssetUrl("planner", "/"), "/studios/planner/index.html");
});
test("private drawing paths stay on the authenticated origin", () => {
  assert.equal(safeCadSource("/private/files/Plan%20A.dwg", "https://erp.test"), "https://erp.test/private/files/Plan%20A.dwg");
  assert.equal(safeCadSource("https://erp.test/files/plan.dxf", "https://erp.test"), "https://erp.test/files/plan.dxf");
});
test("drawing fetch cannot send credentials to foreign or arbitrary endpoints", () => {
  for (const url of ["https://evil.test/files/a.dwg", "//evil.test/files/a.dwg", "/api/method/delete", "/files/a.dwg?token=secret", "/files/a.dwg#token", "https://u:p@erp.test/files/a.dwg", "/files/%2e%2e/api/a.dwg", "/files/a%2f..%2fsecret", "/files/a%5cb.dwg"]) {
    assert.equal(safeCadSource(url, "https://erp.test"), null, url);
  }
});
test("CAD load validates extension and byte limit before transfer", () => {
  const bytes = new ArrayBuffer(10);
  assert.deepEqual(cadLoadMessage("load-1", "Plan.DWG", bytes), { type: "domera.cad", version: 1, id: "load-1", action: "load", name: "Plan.DWG", bytes });
  assert.throws(() => cadLoadMessage("x", "a.pdf", bytes));
  assert.throws(() => cadLoadMessage("x", "a.dwg", new ArrayBuffer(100 * 1024 * 1024 + 1)));
  assert.throws(() => cadLoadMessage("x".repeat(100), "a.dwg", bytes));
});
test("CAD replies require the expected frame, origin, version and payload", () => {
  const frame = {};
  const data = { type: "domera.cad.reply", version: 1, id: "status", ok: true, dirty: false };
  const event = { origin: "https://erp.test", source: frame, data };
  assert.deepEqual(readCadReply(event, "https://erp.test", frame), data);
  assert.equal(readCadReply({ ...event, origin: "https://evil.test" }, "https://erp.test", frame), null);
  assert.equal(readCadReply({ ...event, source: {} }, "https://erp.test", frame), null);
  for (const change of [{ version: 2 }, { id: 1 }, { ok: "yes" }, { dirty: "yes" }, { error: {} }, { bytes: [] }, { bytes: new ArrayBuffer(100 * 1024 * 1024 + 1) }]) {
    assert.equal(readCadReply({ ...event, data: { ...data, ...change } }, "https://erp.test", frame), null);
  }
});
test("Planner requires a user-scoped lowercase SHA-256 identifier", () => {
  assert.equal(plannerAssetUrl("/assets/y_next/app/", "a".repeat(64)), "/assets/y_next/app/studios/planner/index.html?scope=" + "a".repeat(64));
  for (const scope of ["", "a".repeat(63), "A".repeat(64), "user@erp.test", "a".repeat(64) + "&host=evil"]) assert.throws(() => plannerAssetUrl("/", scope));
});
test("drawing reads enforce size before and during body consumption", async () => {
  assert.deepEqual(new Uint8Array(await readCadBytes(new Response(new Uint8Array([1, 2, 3])), new AbortController().signal, 3)), new Uint8Array([1, 2, 3]));
  await assert.rejects(readCadBytes(new Response("abcd", { headers: { "Content-Length": "4" } }), new AbortController().signal, 3));
  await assert.rejects(readCadBytes(new Response("abcd"), new AbortController().signal, 3));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readCadBytes(new Response("x"), controller.signal, 3));
});

test("unsaved CAD changes warn only while dirty and remove the guard after unmount", () => {
  const target = new EventTarget(); let dirty = false;
  const release = guardCadBeforeUnload(target, () => dirty);
  function leave() { const event = new Event("beforeunload", { cancelable: true }); target.dispatchEvent(event); return event.defaultPrevented; }
  assert.equal(leave(), false);
  dirty = true; assert.equal(leave(), true);
  dirty = false; assert.equal(leave(), false);
  dirty = true; release(); assert.equal(leave(), false);
});
