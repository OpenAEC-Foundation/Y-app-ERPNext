import { test } from "node:test";
import assert from "node:assert/strict";
import { haalAfwezigheid, zetAfwezigheid } from "./mail-afwezigheid.ts";

function installFetchMock(body: unknown) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(typeof input === "string" ? input : input.toString());
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

async function metPagina<T>(mogelijkheden: unknown, fn: () => Promise<T>): Promise<T> {
  const g = globalThis as { window?: unknown };
  const had = "window" in g;
  const vorige = g.window;
  g.window = { y_next_mogelijkheden: mogelijkheden };
  try {
    return await fn();
  } finally {
    if (had) g.window = vorige;
    else delete g.window;
  }
}

const STAND = { aan: false, van: null, tot: null, onderwerp: "", tekst: "", html: "" };

test("afwezigheid: meldt de site dat de mailserver niet is ingesteld, dan gaat er geen verzoek uit", async () => {
  const mock = installFetchMock({ message: STAND });
  try {
    await metPagina({ mailserver_ingesteld: false }, async () => {
      await assert.rejects(() => haalAfwezigheid(), /niet ingesteld/);
      await assert.rejects(() => zetAfwezigheid(STAND), /niet ingesteld/);
    });
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test("afwezigheid: met een ingestelde mailserver wordt de stand opgevraagd", async () => {
  const mock = installFetchMock({ message: { ...STAND, aan: true, onderwerp: "Afwezig" } });
  try {
    const stand = await metPagina({ mailserver_ingesteld: true }, () => haalAfwezigheid());
    assert.equal(stand.aan, true);
    assert.equal(stand.onderwerp, "Afwezig");
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
  }
});

test("afwezigheid: een site die niets over zichzelf meldt gedraagt zich als voorheen", async () => {
  // Zonder de app is er geen voorkennis; dan wordt het verzoek gewoon gedaan.
  const mock = installFetchMock({ message: STAND });
  try {
    await metPagina(undefined, () => haalAfwezigheid());
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
  }
});
