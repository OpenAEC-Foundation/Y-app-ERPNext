import { test } from "node:test";
import assert from "node:assert/strict";
import { magLezen, vergeetToegang } from "./doctype-toegang.ts";

/**
 * Tests voor de vraag "mag deze gebruiker dit documentsoort lezen?".
 *
 * Het antwoord komt van ERPNext zelf: een lijstvraag van één regel. Een
 * weigering (403) betekent geen leesrecht. Daarmee volgt de app de rollen die
 * in ERPNext zijn ingesteld, in plaats van een eigen lijst die er stilletjes
 * van gaat afwijken.
 */

function nepFetch(antwoord: (url: string) => number) {
  const aanroepen: string[] = [];
  const oud = globalThis.fetch;
  globalThis.fetch = (async (invoer: RequestInfo | URL) => {
    const url = typeof invoer === "string" ? invoer : invoer.toString();
    aanroepen.push(url);
    const status = antwoord(url);
    if (status === 0) throw new TypeError("netwerk weg");
    return new Response(JSON.stringify(status === 200 ? { data: [] } : { exc_type: "PermissionError" }), { status });
  }) as typeof fetch;
  return { aanroepen, herstel: () => { globalThis.fetch = oud; } };
}

test("een weigering betekent geen leesrecht, een gewoon antwoord wel", async () => {
  vergeetToegang();
  const nep = nepFetch((url) => (url.includes("Purchase%20Invoice") ? 403 : 200));
  try {
    assert.equal(await magLezen("Purchase Invoice"), false);
    assert.equal(await magLezen("Project"), true);
  } finally { nep.herstel(); }
});

test("per documentsoort gaat er maar een vraag naar de server", async () => {
  vergeetToegang();
  const nep = nepFetch(() => 200);
  try {
    await Promise.all([magLezen("Project"), magLezen("Project"), magLezen("Project")]);
    assert.equal(nep.aanroepen.length, 1);
  } finally { nep.herstel(); }
});

test("een netwerkfout geeft geen toegang en wordt niet onthouden", async () => {
  vergeetToegang();
  let keer = 0;
  const nep = nepFetch(() => (keer++ === 0 ? 0 : 200));
  try {
    // Bij twijfel dicht: liever even geen inkoopfacturen dan ten onrechte wel.
    assert.equal(await magLezen("Purchase Invoice"), false);
    // Maar de volgende keer wordt het opnieuw gevraagd.
    assert.equal(await magLezen("Purchase Invoice"), true);
  } finally { nep.herstel(); }
});

test("de vraag vraagt maar een regel op", async () => {
  vergeetToegang();
  const nep = nepFetch(() => 200);
  try {
    await magLezen("Customer");
    assert.match(nep.aanroepen[0], /limit_page_length=1/);
  } finally { nep.herstel(); }
});
