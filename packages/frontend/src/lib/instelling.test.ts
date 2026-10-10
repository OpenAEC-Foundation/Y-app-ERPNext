import { test } from "node:test";
import assert from "node:assert/strict";
import { leesInstelling } from "./instelling.ts";

function installFetchMock(handler: (url: string) => { status: number; body: unknown }) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    const { status, body } = handler(url);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test("leesInstelling: geeft de waarde van een bestaande instelling", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { data: [{ name: "instelling-a", setting_value: "[1,2]" }] } }));
  try {
    assert.equal(await leesInstelling("instelling-a"), "[1,2]");
    const url = new URL(mock.calls[0], "http://x");
    assert.equal(decodeURIComponent(url.pathname), "/api/resource/Y Next Setting");
    assert.deepEqual(JSON.parse(url.searchParams.get("filters") || "[]"), [["name", "=", "instelling-a"]]);
  } finally {
    mock.restore();
  }
});

test("leesInstelling: een instelling die nog niet bestaat is null, zonder mislukt verzoek", async () => {
  // Een lijstverzoek geeft bij een ontbrekende rij een lege lijst. Het
  // document rechtstreeks opvragen zou een 404 geven, bij elke keer laden.
  const mock = installFetchMock(() => ({ status: 200, body: { data: [] } }));
  try {
    assert.equal(await leesInstelling("instelling-b"), null);
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
  }
});

test("leesInstelling: een lege waarde is een lege tekst, niet null", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { data: [{ name: "instelling-c", setting_value: null }] } }));
  try {
    assert.equal(await leesInstelling("instelling-c"), "");
  } finally {
    mock.restore();
  }
});
