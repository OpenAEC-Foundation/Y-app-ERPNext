import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchList, createDocument, ApiError } from "./erpnext.ts";
import { resetCsrfTokenCache } from "./csrf.ts";

interface RecordedCall {
  url: string;
  init?: RequestInit;
}

function installFetchMock(
  handler: (url: string, init?: RequestInit) => { status: number; body: unknown }
): { calls: RecordedCall[]; restore: () => void } {
  const calls: RecordedCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function withWindow<T>(win: unknown, fn: () => T): T {
  const g = globalThis as { window?: unknown };
  const had = "window" in g;
  const prev = g.window;
  g.window = win;
  try {
    return fn();
  } finally {
    if (had) g.window = prev;
    else delete g.window;
  }
}

test("createDocument: sends X-Frappe-CSRF-Token when a token is available", async () => {
  resetCsrfTokenCache();
  const mock = installFetchMock(() => ({ status: 200, body: { data: { name: "PROJ-0001" } } }));
  try {
    await withWindow({ frappe: { csrf_token: "tok-abc" } }, () =>
      createDocument("Project", { project_name: "Test" })
    );
    assert.equal(mock.calls.length, 1);
    const headers = mock.calls[0].init?.headers as Record<string, string>;
    assert.equal(headers["X-Frappe-CSRF-Token"], "tok-abc");
    assert.equal(mock.calls[0].init?.method, "POST");
  } finally {
    mock.restore();
    resetCsrfTokenCache();
  }
});

test("createDocument: omits X-Frappe-CSRF-Token when no token is available", async () => {
  resetCsrfTokenCache();
  const mock = installFetchMock(() => ({ status: 200, body: { data: { name: "PROJ-0002" } } }));
  try {
    await createDocument("Project", { project_name: "Test" });
    assert.equal(mock.calls.length, 1);
    const headers = mock.calls[0].init?.headers as Record<string, string>;
    assert.equal("X-Frappe-CSRF-Token" in headers, false);
  } finally {
    mock.restore();
    resetCsrfTokenCache();
  }
});

test("fetchList: hits /api/resource/<doctype> same-origin without X-Y-App-Instance", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { data: [{ name: "PROJ-0001" }] } }));
  try {
    const rows = await fetchList("Project", { fields: ["name"] });
    assert.deepEqual(rows, [{ name: "PROJ-0001" }]);
    assert.equal(mock.calls.length, 1);
    const call = mock.calls[0];
    assert.match(call.url, /^\/api\/resource\/Project\?/);
    assert.equal(call.init?.credentials, "same-origin");
    const headers = call.init?.headers as Record<string, string>;
    assert.equal("X-Y-App-Instance" in headers, false);
  } finally {
    mock.restore();
  }
});

test("fetchList: on 401, verifies via frappe.auth.get_logged_user (not the old yapp/me probe)", async () => {
  let call = 0;
  const mock = installFetchMock((url) => {
    call++;
    if (call === 1) {
      assert.match(url, /^\/api\/resource\/OtherDoctype/);
      return { status: 401, body: {} };
    }
    // Verification probe — respond as a still-valid, non-Guest session so
    // no y-app:unauthorized event needs to be dispatched (keeps this test
    // free of window/CustomEvent mocking).
    assert.match(url, /frappe\.auth\.get_logged_user/);
    assert.doesNotMatch(url, /yapp\/me/);
    return { status: 200, body: { message: "jan@example.com" } };
  });
  try {
    await assert.rejects(fetchList("OtherDoctype"), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 401);
      return true;
    });
    // Let the fire-and-forget verification probe's microtasks settle.
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(call, 2);
  } finally {
    mock.restore();
  }
});
