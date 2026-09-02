import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fetchCustomerContactSuggestions,
  fetchRecipientSuggestions,
  mergeAndRankSuggestions,
  type RecipientSuggestion,
} from "./contact-suggestions.ts";
import { invalidateCache } from "./erpnext.ts";

/* ─── fetch mock harness ───
 * Handlers are tried in order; the first one that returns non-null wins.
 * Falls back to an empty-but-valid Frappe envelope so unmocked calls don't
 * throw (GET /api/resource/* → { data: [] }, POST /api/method/* → { message: [] }). */
type MockResult = { status: number; body: unknown } | null;
type Handler = (url: string, init?: RequestInit) => MockResult;

function installFetchMock(...handlers: Handler[]): { restore: () => void } {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const h of handlers) {
      const result = h(url, init);
      if (result) {
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { "content-type": "application/json" },
        });
      }
    }
    if (url.startsWith("/api/method/")) {
      return new Response(JSON.stringify({ message: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; } };
}

function parseFilters(url: string): unknown[][] {
  const m = /[?&]filters=([^&]+)/.exec(url);
  return m ? (JSON.parse(decodeURIComponent(m[1])) as unknown[][]) : [];
}

function parseMethodBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body) return {};
  return JSON.parse(String(init.body));
}

/** Stub `globalThis.localStorage` for the duration of `fn`, then restore. */
async function withLocalStorage<T>(initial: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const store = new Map<string, string>(Object.entries(initial));
  const stub: Storage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  const g = globalThis as { localStorage?: Storage };
  const had = "localStorage" in g;
  const prev = g.localStorage;
  g.localStorage = stub;
  try {
    return await fn();
  } finally {
    if (had) g.localStorage = prev;
    else delete g.localStorage;
  }
}

test("fetchCustomerContactSuggestions: surfaces an address that lives only in the Contact Email child table", async () => {
  invalidateCache();
  const mock = installFetchMock(
    (url) => {
      if (!url.startsWith("/api/method/frappe.client.get_list")) return null;
      return { status: 200, body: { message: [{ parent: "CONT-0001", email_id: "secondary@example.nl", is_primary: 0 }] } };
    },
    (url) => {
      if (!/^\/api\/resource\/Contact\?/.test(url)) return null;
      const filters = parseFilters(url);
      const isEnrichment = filters.some((f) => Array.isArray(f) && f[1] === "in");
      if (isEnrichment) {
        return { status: 200, body: { data: [{ name: "CONT-0001", full_name: "Jane Doe" }] } };
      }
      // Primary-field search finds nothing — the email lives only in the child table.
      return { status: 200, body: { data: [] } };
    },
  );
  try {
    const list = await fetchCustomerContactSuggestions("secondary");
    assert.equal(list.length, 1);
    assert.deepEqual(list[0], {
      email: "secondary@example.nl",
      label: "Jane Doe",
      score: 0,
      source: "contact",
      primary: false,
    });
  } finally {
    mock.restore();
  }
});

test("fetchCustomerContactSuggestions: dedupes across sources, primary Contact hit wins over a matching Contact Email hit", async () => {
  invalidateCache();
  const mock = installFetchMock(
    (url) => {
      if (!url.startsWith("/api/method/frappe.client.get_list")) return null;
      // Contact Email child table also has this address, but as a non-primary row.
      return { status: 200, body: { message: [{ parent: "CONT-0002", email_id: "shared@example.nl", is_primary: 0 }] } };
    },
    (url) => {
      if (!/^\/api\/resource\/Contact\?/.test(url)) return null;
      const filters = parseFilters(url);
      const isEnrichment = filters.some((f) => Array.isArray(f) && f[1] === "in");
      if (isEnrichment) {
        // Should never be used for the label — the primary hit wins and is
        // labeled "Alice", not this enrichment row's name.
        return { status: 200, body: { data: [{ name: "CONT-0002", full_name: "Wrong Label" }] } };
      }
      const isEmailField = filters.some((f) => Array.isArray(f) && f[0] === "email_id");
      if (isEmailField) {
        return { status: 200, body: { data: [{ name: "CONT-0002", full_name: "Alice", email_id: "shared@example.nl" }] } };
      }
      return { status: 200, body: { data: [] } };
    },
  );
  try {
    const list = await fetchCustomerContactSuggestions("shared");
    assert.equal(list.length, 1);
    assert.equal(list[0].email, "shared@example.nl");
    assert.equal(list[0].label, "Alice");
    assert.equal(list[0].source, "customer");
    assert.equal(list[0].primary, true);
  } finally {
    mock.restore();
  }
});

test("fetchCustomerContactSuggestions: a failing Contact Email child-table lookup (403) doesn't break the primary-field results", async () => {
  invalidateCache();
  const mock = installFetchMock(
    (url) => {
      if (!url.startsWith("/api/method/frappe.client.get_list")) return null;
      return { status: 403, body: { exc_type: "PermissionError", exception: "frappe.exceptions.PermissionError" } };
    },
    (url) => {
      if (!/^\/api\/resource\/Contact\?/.test(url)) return null;
      const filters = parseFilters(url);
      const isEmailField = filters.some((f) => Array.isArray(f) && f[0] === "email_id");
      if (isEmailField) {
        return { status: 200, body: { data: [{ name: "CONT-0003", full_name: "Ok Contact", email_id: "ok@example.nl" }] } };
      }
      return { status: 200, body: { data: [] } };
    },
  );
  try {
    const list = await fetchCustomerContactSuggestions("ok");
    assert.equal(list.length, 1);
    assert.equal(list[0].email, "ok@example.nl");
    assert.equal(list[0].source, "customer");
  } finally {
    mock.restore();
  }
});

test("fetchRecipientSuggestions: includes Lead.email_id matches alongside contacts", async () => {
  invalidateCache();
  const mock = installFetchMock(
    (url) => {
      if (!url.startsWith("/api/method/frappe.client.get_list")) return null;
      return { status: 200, body: { message: [] } }; // no Contact Email hits
    },
    (url) => {
      if (!/^\/api\/resource\/Lead\?/.test(url)) return null;
      return { status: 200, body: { data: [{ name: "LEAD-0001", lead_name: "Bob Lead", email_id: "bob@lead.nl" }] } };
    },
    (url) => {
      if (!/^\/api\/resource\/Contact\?/.test(url)) return null;
      return { status: 200, body: { data: [] } }; // no Contact hits at all
    },
  );
  try {
    const list = await fetchRecipientSuggestions("bob");
    const lead = list.find((s) => s.email === "bob@lead.nl");
    assert.ok(lead, "expected a lead suggestion for bob@lead.nl");
    assert.equal(lead!.source, "lead");
    assert.equal(lead!.label, "Bob Lead");
  } finally {
    mock.restore();
  }
});

test("fetchRecipientSuggestions: a failing source (403 on Lead) doesn't prevent Contact results from being returned", async () => {
  invalidateCache();
  const mock = installFetchMock(
    (url) => {
      if (!url.startsWith("/api/method/frappe.client.get_list")) return null;
      return { status: 200, body: { message: [] } };
    },
    (url) => {
      if (!/^\/api\/resource\/Lead\?/.test(url)) return null;
      return { status: 403, body: { exception: "frappe.exceptions.PermissionError" } };
    },
    (url) => {
      if (!/^\/api\/resource\/Contact\?/.test(url)) return null;
      const filters = parseFilters(url);
      const isEmailField = filters.some((f) => Array.isArray(f) && f[0] === "email_id");
      if (isEmailField) {
        return { status: 200, body: { data: [{ name: "CONT-0004", full_name: "Still Works", email_id: "still@example.nl" }] } };
      }
      return { status: 200, body: { data: [] } };
    },
  );
  try {
    const list = await fetchRecipientSuggestions("still");
    assert.equal(list.some((s) => s.email === "still@example.nl"), true);
  } finally {
    mock.restore();
  }
});

test("mergeAndRankSuggestions: a primary address ranks above a secondary one at the same match tier", () => {
  const secondary: RecipientSuggestion = {
    email: "info@acme.nl", label: "Info", score: 0, source: "contact", primary: false,
  };
  const primary: RecipientSuggestion = {
    email: "sales@acme.nl", label: "Sales", score: 0, source: "customer", primary: true,
  };
  const ranked = mergeAndRankSuggestions("acme.nl", [secondary, primary], {});
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].email, "sales@acme.nl");
  assert.equal(ranked[1].email, "info@acme.nl");
});

test("mergeAndRankSuggestions: dedupes by lowercase email even when the same address appears with different casing", () => {
  const a: RecipientSuggestion = { email: "Mixed@Example.nl", label: "A", score: 0, source: "customer", primary: true };
  const b: RecipientSuggestion = { email: "mixed@example.nl", label: "", score: 0, source: "contact", primary: false };
  const ranked = mergeAndRankSuggestions("mixed", [a, b], {});
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].email, "mixed@example.nl");
  assert.equal(ranked[0].label, "A");
});

test("mergeAndRankSuggestions: existing frequency ranking still dominates the primary tie-break", () => {
  const primaryNoHistory: RecipientSuggestion = {
    email: "primary@acme.nl", label: "Primary", score: 0, source: "customer", primary: true,
  };
  const secondaryFrequent: RecipientSuggestion = {
    email: "secondary@acme.nl", label: "Secondary", score: 0, source: "contact", primary: false,
  };
  const freqMap = {
    "secondary@acme.nl": { email: "secondary@acme.nl", label: "Secondary", count: 10, lastUsed: Date.now() },
  };
  const ranked = mergeAndRankSuggestions("acme.nl", [primaryNoHistory, secondaryFrequent], freqMap);
  assert.equal(ranked[0].email, "secondary@acme.nl", "frequently-used secondary address should still outrank an unused primary one");
});

test("fetchRecipientSuggestions: empty query with local history returns the frequency list without hitting the network", async () => {
  const mock = installFetchMock((_url) => {
    throw new Error("network should not be called when frequency history exists");
  });
  try {
    const list = await withLocalStorage(
      {
        pref_inst1_recipient_freq: JSON.stringify({
          "a@example.nl": { email: "a@example.nl", label: "A", count: 5, lastUsed: Date.now() },
        }),
      },
      () => fetchRecipientSuggestions("", { instanceId: "inst1" }),
    );
    assert.equal(list.length, 1);
    assert.equal(list[0].email, "a@example.nl");
    assert.equal(list[0].source, "frequent");
  } finally {
    mock.restore();
  }
});

test("fetchRecipientSuggestions: empty query with no local history falls back to a first page of ERPNext contacts", async () => {
  invalidateCache();
  const mock = installFetchMock((url) => {
    if (!/^\/api\/resource\/Contact\?/.test(url)) return null;
    const filters = parseFilters(url);
    assert.ok(filters.some((f) => Array.isArray(f) && f[0] === "email_id" && f[1] === "is"), "expects an 'email_id is set' filter");
    return {
      status: 200,
      body: { data: [{ name: "CONT-0005", full_name: "Default Contact", email_id: "default@example.nl" }] },
    };
  });
  try {
    const list = await withLocalStorage({}, () => fetchRecipientSuggestions("", { instanceId: "inst-empty" }));
    assert.equal(list.length, 1);
    assert.equal(list[0].email, "default@example.nl");
    assert.equal(list[0].source, "customer");
  } finally {
    mock.restore();
  }
});

test("fetchRecipientSuggestions: a single-character query returns local matches only (no ERPNext lookups)", async () => {
  const mock = installFetchMock((_url) => {
    throw new Error("no ERPNext lookup expected for a 1-character query");
  });
  try {
    const list = await fetchRecipientSuggestions("a", { instanceId: "inst-short" });
    assert.deepEqual(list, []);
  } finally {
    mock.restore();
  }
});
