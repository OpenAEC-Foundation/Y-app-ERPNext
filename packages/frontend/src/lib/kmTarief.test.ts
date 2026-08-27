import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_KM_TARIEF, fetchKmTarief, parseKmTarief, saveKmTarief } from "./kmTarief.ts";
import { invalidateCache } from "./erpnext.ts";

function installFetchMock(
  handler: (url: string, init?: RequestInit) => { status: number; body: unknown }
): { calls: { url: string; init?: RequestInit }[]; restore: () => void } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
      // fetchDocument cachet per (instance, url) — anders lekt het ene
      // testantwoord in het volgende.
      invalidateCache("Y Next Setting");
    },
  };
}

test("parseKmTarief: leest een gewoon getal en een komma-decimaal", () => {
  assert.equal(parseKmTarief("0.23"), 0.23);
  // Wie "0,25" typt bedoelt geen 25.
  assert.equal(parseKmTarief("0,25"), 0.25);
  assert.equal(parseKmTarief(" 0.30 "), 0.3);
  assert.equal(parseKmTarief(0.19), 0.19);
});

test("parseKmTarief: onbruikbare waarde valt terug op de default, nooit op 0", () => {
  // Een tarief van 0 zou stilzwijgend elke vergoeding op 0 euro zetten.
  assert.equal(parseKmTarief("0"), DEFAULT_KM_TARIEF);
  assert.equal(parseKmTarief("-1"), DEFAULT_KM_TARIEF);
  assert.equal(parseKmTarief("onzin"), DEFAULT_KM_TARIEF);
  assert.equal(parseKmTarief(""), DEFAULT_KM_TARIEF);
  assert.equal(parseKmTarief(undefined), DEFAULT_KM_TARIEF);
  assert.equal(parseKmTarief(null), DEFAULT_KM_TARIEF);
});

test("fetchKmTarief: leest de waarde uit Y Next Setting, en valt zonder record terug op de default", async () => {
  // Eén test voor beide gevallen, want `fetchDocument` dedupliceert requests
  // op dezelfde URL nog 100 ms ná afloop (zie erpnext.ts). Twee losse tests
  // zouden binnen dat venster dezelfde promise delen en elkaars antwoord zien.
  let bestaat = true;
  const mock = installFetchMock(() => (bestaat
    ? { status: 200, body: { data: { setting_key: "km-tarief", setting_value: "0.28" } } }
    : { status: 404, body: { exc_type: "DoesNotExistError" } }));
  try {
    assert.equal(await fetchKmTarief(), 0.28);
    assert.match(mock.calls[0].url, /Y Next Setting\/km-tarief/);

    // Cache + dedup-venster laten verlopen, dan het "nog niet geprovisioneerd
    // / geen leesrecht"-geval: boeken moet blijven werken.
    invalidateCache("Y Next Setting");
    await new Promise((resolve) => setTimeout(resolve, 150));
    bestaat = false;
    assert.equal(await fetchKmTarief(), DEFAULT_KM_TARIEF);
  } finally {
    mock.restore();
  }
});

test("saveKmTarief: een geslaagde PUT meldt 'saved'", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { data: { name: "km-tarief" } } }));
  try {
    assert.equal(await saveKmTarief(0.3), "saved");
    const put = mock.calls.find((c) => c.init?.method === "PUT");
    assert.ok(put);
    assert.deepEqual(JSON.parse(String(put.init?.body)), { setting_value: "0.3" });
  } finally {
    mock.restore();
  }
});

test("saveKmTarief: zonder schrijfrecht meldt hij 'forbidden' — de UI mag geen 'opgeslagen' tonen", async () => {
  // `Y Next Setting` is System-Manager-only voor schrijven; een medewerker
  // krijgt hier een 403, en er is bewust geen lokale terugval (een tarief dat
  // alleen op één apparaat geldt zou tot verschillende bedragen leiden).
  const mock = installFetchMock(() => ({ status: 403, body: { exc_type: "PermissionError" } }));
  try {
    assert.equal(await saveKmTarief(0.3), "forbidden");
  } finally {
    mock.restore();
  }
});
