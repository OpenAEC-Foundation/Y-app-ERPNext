import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchList,
  loadRejectedFieldsFromStorage,
  resetRejectedFieldsCache,
} from "./erpnext.ts";

const STORAGE_KEY = "ynext_bad_fields_v1";

/**
 * Minimale sessionStorage-mock. Node heeft geen Web Storage zonder
 * --experimental-webstorage, dus erpnext.ts ziet bij module-init niets en
 * valt terug op alleen-geheugen — precies het pad dat we hier expliciet
 * willen kunnen aan- en uitzetten.
 */
function installSessionStorage(initial?: Record<string, string>): {
  store: Map<string, string>;
  restore: () => void;
} {
  const store = new Map<string, string>(Object.entries(initial || {}));
  const g = globalThis as { sessionStorage?: Storage };
  const had = "sessionStorage" in g;
  const prev = g.sessionStorage;
  g.sessionStorage = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as unknown as Storage;
  return {
    store,
    restore: () => {
      if (had) g.sessionStorage = prev;
      else delete g.sessionStorage;
    },
  };
}

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

/** Antwoordt 417 zolang `badField` in de fields-parameter zit. */
function rejectingHandler(badField: string) {
  return (url: string) => {
    const fieldsMatch = /fields=([^&]+)/.exec(url);
    const fields: string[] = fieldsMatch ? JSON.parse(decodeURIComponent(fieldsMatch[1])) : [];
    if (fields.includes(badField)) {
      return {
        status: 417,
        body: {
          exc_type: "DataError",
          exception: `frappe.exceptions.DataError: Field not permitted in query: ${badField}`,
        },
      };
    }
    return { status: 200, body: { data: [{ name: "PROJ-0001" }] } };
  };
}

function silenceWarn(): () => void {
  const original = console.warn;
  console.warn = () => {};
  return () => { console.warn = original; };
}

test("self-heal: een afgewezen veld wordt naar sessionStorage weggeschreven", async () => {
  const storage = installSessionStorage();
  const restoreWarn = silenceWarn();
  resetRejectedFieldsCache();
  const mock = installFetchMock(rejectingHandler("custom_address"));
  try {
    await fetchList("Project", { fields: ["name", "custom_address"] });
    const raw = storage.store.get(STORAGE_KEY);
    assert.ok(raw, "de uitsluitlijst hoort in sessionStorage te staan");
    assert.deepEqual(JSON.parse(raw as string), { Project: ["custom_address"] });
  } finally {
    mock.restore();
    resetRejectedFieldsCache();
    restoreWarn();
    storage.restore();
  }
});

test("self-heal: meerdere velden op meerdere doctypes blijven gescheiden in de opslag", async () => {
  const storage = installSessionStorage();
  const restoreWarn = silenceWarn();
  resetRejectedFieldsCache();
  // Wijst zowel custom_address als custom_project_manager af (Project) en
  // workflow_state (Task) — de 417-keten uit e2e-report-1 §3.
  const bad = new Set(["custom_address", "custom_project_manager", "workflow_state"]);
  const mock = installFetchMock((url) => {
    const fieldsMatch = /fields=([^&]+)/.exec(url);
    const fields: string[] = fieldsMatch ? JSON.parse(decodeURIComponent(fieldsMatch[1])) : [];
    const offender = fields.find((f) => bad.has(f));
    if (offender) {
      return {
        status: 417,
        body: { exception: `frappe.exceptions.DataError: Field not permitted in query: ${offender}` },
      };
    }
    return { status: 200, body: { data: [] } };
  });
  try {
    await fetchList("Project", { fields: ["name", "custom_address", "custom_project_manager"] });
    await fetchList("Task", { fields: ["name", "workflow_state"] });
    const parsed = JSON.parse(storage.store.get(STORAGE_KEY) as string);
    assert.deepEqual(parsed.Project.sort(), ["custom_address", "custom_project_manager"]);
    assert.deepEqual(parsed.Task, ["workflow_state"]);
  } finally {
    mock.restore();
    resetRejectedFieldsCache();
    restoreWarn();
    storage.restore();
  }
});

test("self-heal: een volgende paginalaad leest de lijst terug — geen enkele 417 meer", async () => {
  // Simuleert de reload: opslag gevuld, geheugen leeg.
  const storage = installSessionStorage({
    [STORAGE_KEY]: JSON.stringify({ Project: ["custom_address", "custom_project_manager"] }),
  });
  const restoreWarn = silenceWarn();
  const mock = installFetchMock(rejectingHandler("custom_address"));
  try {
    loadRejectedFieldsFromStorage();
    const rows = await fetchList<{ name: string }>("Project", {
      fields: ["name", "custom_address", "custom_project_manager"],
      // eigen filter zodat deze call niet uit de responscache van een
      // eerdere test komt
      limit_page_length: 7,
    });
    assert.deepEqual(rows, [{ name: "PROJ-0001" }]);
    assert.equal(mock.calls.length, 1, "precies één round-trip: geen 417-keten meer");
    assert.doesNotMatch(mock.calls[0], /custom_address/);
    assert.doesNotMatch(mock.calls[0], /custom_project_manager/);
  } finally {
    mock.restore();
    resetRejectedFieldsCache();
    restoreWarn();
    storage.restore();
  }
});

test("loadRejectedFieldsFromStorage: negeert corrupte of onverwacht gevormde inhoud", () => {
  for (const raw of ["{niet-json", "[]", '"tekst"', "null", '{"Project":"custom_address"}']) {
    const storage = installSessionStorage({ [STORAGE_KEY]: raw });
    try {
      // Mag nooit gooien — dit draait bij module-init.
      loadRejectedFieldsFromStorage();
    } finally {
      resetRejectedFieldsCache();
      storage.restore();
    }
  }
});

test("self-heal: zonder bruikbare sessionStorage blijft het gedrag in-memory werken", async () => {
  const restoreWarn = silenceWarn();
  resetRejectedFieldsCache();
  // Geen sessionStorage geïnstalleerd (de Node-default, en het pad van een
  // browser met geblokkeerde opslag).
  const mock = installFetchMock(rejectingHandler("custom_address"));
  try {
    await fetchList("NoStorageDoctype", { fields: ["name", "custom_address"] });
    assert.equal(mock.calls.length, 2, "417 + geslaagde retry");
    // Tweede call: veld wordt vooraf al weggelaten, dus geen nieuwe 417.
    await fetchList("NoStorageDoctype", { fields: ["name", "custom_address"], limit_page_length: 9 });
    assert.equal(mock.calls.length, 3);
    assert.doesNotMatch(mock.calls[2], /custom_address/);
  } finally {
    mock.restore();
    resetRejectedFieldsCache();
    restoreWarn();
  }
});

test("persist: een gooiende setItem (quota vol) breekt de self-heal niet", async () => {
  const g = globalThis as { sessionStorage?: Storage };
  const had = "sessionStorage" in g;
  const prev = g.sessionStorage;
  g.sessionStorage = {
    getItem: () => null,
    setItem: () => { throw new Error("QuotaExceededError"); },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as unknown as Storage;
  const restoreWarn = silenceWarn();
  resetRejectedFieldsCache();
  const mock = installFetchMock(rejectingHandler("custom_address"));
  try {
    const rows = await fetchList<{ name: string }>("QuotaDoctype", { fields: ["name", "custom_address"] });
    assert.deepEqual(rows, [{ name: "PROJ-0001" }]);
  } finally {
    mock.restore();
    resetRejectedFieldsCache();
    restoreWarn();
    if (had) g.sessionStorage = prev;
    else delete g.sessionStorage;
  }
});
