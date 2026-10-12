import { test } from "node:test";
import assert from "node:assert/strict";
import { OfficeApi, OfficeApiError, OfficeSaveUnknown } from "./office-api.ts";

const source = { name: "SOURCE", file_name: "boek.xlsx", file_url: "/private/files/boek.xlsx", sha256: "a".repeat(64), content_hash: "hash", attached_to_doctype: "Project", attached_to_name: "PROJ-1", can_save: true, max_size: 25_000_000 };
const saved = { ...source, name: "COPY", source_file: "SOURCE", operation_id: "op-1" };
const json = (message: unknown, status = 200) => new Response(JSON.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });

test("Lezen geeft 403 terug als afzonderlijke rechtenfout", async () => {
  const api = new OfficeApi(async () => json({}, 403), async () => "csrf");
  await assert.rejects(api.open("SOURCE"), (e: unknown) => e instanceof OfficeApiError && e.status === 403);
});
test("Lezen weigert ongeldige save-rechten en bestandsgroottegrenzen", async () => {
  for (const invalid of [{ ...source, can_save: "yes" }, { ...source, max_size: undefined }, { ...source, max_size: -1 }]) {
    const api = new OfficeApi(async () => json(invalid), async () => "csrf");
    await assert.rejects(api.open("SOURCE"));
  }
});
test("Lezen weigert metadata voor een ander File-document", async () => {
  const api = new OfficeApi(async () => json({ ...source, name: "OTHER" }), async () => "csrf");
  await assert.rejects(api.open("SOURCE"));
});
test("Save stuurt privéversiecontract en byte-snapshot met runtime CSRF", async () => {
  const api = new OfficeApi(async (url, init) => {
    assert.equal(String(url), "/api/method/y_next.api.office.save_file");
    assert.equal(new Headers(init?.headers).get("X-Frappe-CSRF-Token"), "fresh-csrf");
    const body = init?.body as FormData;
    assert.equal(body.get("source_file"), "SOURCE"); assert.equal(body.get("expected_sha256"), "a".repeat(64)); assert.equal(body.get("operation_id"), "op-1");
    assert.deepEqual(new Uint8Array(await (body.get("file") as Blob).arrayBuffer()), new Uint8Array([1, 2]));
    return json(saved);
  }, async () => "fresh-csrf");
  assert.equal((await api.save(source, new Uint8Array([1, 2]), "op-1")).name, "COPY");
});
test("Onzekere save wordt niet opnieuw gepost; status is gekoppeld aan dezelfde operatie", async () => {
  let posts = 0;
  const api = new OfficeApi(async (url) => {
    if (String(url).endsWith("save_file")) { posts++; throw new TypeError("network"); }
    assert.equal(String(url), "/api/method/y_next.api.office.save_status?operation_id=op-1"); return json({ found: true, file: saved, operation_id: "op-1" });
  }, async () => "csrf");
  await assert.rejects(api.save(source, new Uint8Array([1]), "op-1"), OfficeSaveUnknown);
  assert.equal((await api.status("op-1", "SOURCE"))?.name, "COPY"); assert.equal(posts, 1);
});
test("Reconciliatie weigert antwoord voor een andere bron of operatie", async () => {
  const api = new OfficeApi(async () => json({ found: true, file: { ...saved, source_file: "OTHER" }, operation_id: "op-1" }), async () => "csrf");
  await assert.rejects(api.status("op-1", "SOURCE"));
});
test("Conflict en expliciete rechtenweigering blijven bekende save-fouten", async () => {
  for (const status of [403, 409, 413]) {
    const api = new OfficeApi(async () => json({}, status), async () => "csrf");
    await assert.rejects(api.save(source, new Uint8Array([1]), "op-1"), (e: unknown) => e instanceof OfficeApiError && !(e instanceof OfficeSaveUnknown) && e.status === status);
  }
});
test("Een serveroperatie die nog loopt blijft een onzekere save", async () => {
  const api = new OfficeApi(async () => new Response(JSON.stringify({ office_error: "office_save_pending" }), { status: 409 }), async () => "csrf");
  await assert.rejects(api.save(source, new Uint8Array([1]), "op-1"), OfficeSaveUnknown);
});
