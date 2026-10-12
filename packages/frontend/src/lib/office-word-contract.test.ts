import { test } from "node:test";
import assert from "node:assert/strict";
import { createOfficePackage } from "./office.ts";

test("Word-loadcontract: een ongewijzigd leeg document meldt parsegereed", async () => {
  // Dit upstream-contract voorkomt dat het hostscherm op een eerste
  // tekstwijziging wacht om de editor vrij te geven.
  const { DocumentLoaderManager } = await import("../../../../node_modules/@stll/folio-core/dist/managers/DocumentLoaderManager.js");
  let parsed: unknown = null; let compatibilityCalls = 0; let state = "";
  const manager = new DocumentLoaderManager({
    history: { get state() { return parsed; }, reset(document: unknown) { parsed = document; } },
    setLoadedDocumentIdentity() {}, onReset() {},
    onError(error: Error) { throw error; },
    onCompatibilityChange() { compatibilityCalls++; },
    setDocumentLoadState(next: { status: string }) { state = next.status; },
  });
  await manager.loadBuffer(createOfficePackage("word"));
  assert.ok(parsed); assert.equal(compatibilityCalls, 1); assert.equal(state, "ready");
});
