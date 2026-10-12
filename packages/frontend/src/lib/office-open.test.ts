import { test } from "node:test";
import assert from "node:assert/strict";
import { OfficeApiError } from "./office-api.ts";
import { OfficeOpenLoader } from "./office-open.ts";
const metadata = { name: "SOURCE", file_name: "boek.xlsx", file_url: "/private/files/boek.xlsx", sha256: "a".repeat(64), content_hash: "hash", attached_to_doctype: "Project", attached_to_name: "PROJ-1", can_save: true, max_size: 20_000_000 };
test("Een nieuwe openactie wist het vorige document ook bij een rechtenfout", async () => {
  const loader = new OfficeOpenLoader({ open: async (id) => { if (id === "DENIED") throw new OfficeApiError(403); return metadata; }, content: async () => new Uint8Array([1]) }, async () => "a".repeat(64));
  await loader.load("SOURCE"); assert.equal(loader.value?.metadata.name, "SOURCE");
  const denied = loader.load("DENIED"); assert.equal(loader.value, null); await assert.rejects(denied, OfficeApiError); assert.equal(loader.value, null);
});
test("Een vervallen digest mag een nieuw bestand niet overschrijven", { timeout: 2_000 }, async () => {
  let resolveDigest!: (hash: string) => void; let digestStarted!: () => void;
  const started = new Promise<void>((resolve) => { digestStarted = resolve; });
  const loader = new OfficeOpenLoader({ open: async (id) => ({ ...metadata, name: id }), content: async () => new Uint8Array([1]) }, async () => {
    digestStarted(); return new Promise<string>((resolve) => { resolveDigest = resolve; });
  });
  const old = loader.load("OLD"); await started; loader.cancel(); resolveDigest("a".repeat(64));
  assert.equal(await old, null); assert.equal(loader.value, null);
});
