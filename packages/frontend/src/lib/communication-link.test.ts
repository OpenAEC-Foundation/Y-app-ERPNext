import { test } from "node:test";
import assert from "node:assert/strict";
import { linkConversationTo } from "./communication-link.ts";

/**
 * Tests voor het koppelen van een hele reeks berichten aan één document.
 *
 * Wat hier telt is niet dat de schrijfactie werkt — dat doet
 * `linkCommunicationTo` — maar dat de bundeling zich netjes gedraagt: elk
 * bericht één keer, een mislukking sleept de rest niet mee, en de aanroeper
 * hoort welke het niet haalden. Half koppelen mag, stil half koppelen niet.
 */

interface Aanroep { url: string; init?: RequestInit }

/** Vervangt `fetch` en registreert wat eruit gaat. */
function metFetch(
  antwoord: (url: string, init?: RequestInit) => { status: number; body: unknown },
): { calls: Aanroep[]; herstel: () => void } {
  const calls: Aanroep[] = [];
  const origineel = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const { status, body } = antwoord(url, init);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { calls, herstel: () => { globalThis.fetch = origineel; } };
}

/** Alles lukt: elke schrijfactie geeft 200 terug. */
function allesGoed() {
  return metFetch(() => ({ status: 200, body: { data: { name: "x", timeline_links: [] } } }));
}

test("koppelt elk bericht uit de reeks", async () => {
  const mock = allesGoed();
  try {
    const uit = await linkConversationTo(["COMM-1", "COMM-2", "COMM-3"], "Project", "3245");
    assert.deepEqual(uit.gelukt.sort(), ["COMM-1", "COMM-2", "COMM-3"]);
    assert.deepEqual(uit.mislukt, []);
    for (const naam of ["COMM-1", "COMM-2", "COMM-3"]) {
      assert.equal(mock.calls.some((c) => c.url.includes(naam)), true, `${naam} ontbreekt`);
    }
  } finally {
    mock.herstel();
  }
});

test("een dubbele naam levert één koppeling op", async () => {
  const mock = allesGoed();
  try {
    const uit = await linkConversationTo(["COMM-1", "COMM-1", ""], "Project", "3245");
    assert.deepEqual(uit.gelukt, ["COMM-1"]);
    assert.deepEqual(uit.mislukt, []);
  } finally {
    mock.herstel();
  }
});

test("een mislukking stopt de rest niet en wordt gemeld", async () => {
  // Half gekoppeld is beter dan niet gekoppeld — maar de aanroeper moet weten
  // welke het niet haalden, anders lijkt het gesprek compleet gekoppeld.
  const mock = metFetch((url) => url.includes("COMM-2")
    ? { status: 403, body: { exception: "PermissionError" } }
    : { status: 200, body: { data: { name: "x", timeline_links: [] } } });
  try {
    const uit = await linkConversationTo(["COMM-1", "COMM-2", "COMM-3"], "Project", "3245");
    assert.deepEqual(uit.gelukt.sort(), ["COMM-1", "COMM-3"]);
    assert.equal(uit.mislukt.length, 1);
    assert.equal(uit.mislukt[0]?.naam, "COMM-2");
  } finally {
    mock.herstel();
  }
});

test("een lege reeks doet niets", async () => {
  const mock = allesGoed();
  try {
    const uit = await linkConversationTo([], "Project", "3245");
    assert.deepEqual(uit, { gelukt: [], mislukt: [] });
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.herstel();
  }
});
