import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSession, loginUrl, SessionUnavailableError } from "./session.ts";

interface MockStep {
  match?: string;
  status: number;
  body: unknown;
}

function mockFetchSequence(steps: MockStep[]): typeof fetch {
  let call = 0;
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const step = steps[call];
    call++;
    if (!step) throw new Error(`Unexpected extra fetch call to ${url}`);
    if (step.match && !url.includes(step.match)) {
      throw new Error(`Expected fetch to include "${step.match}", got "${url}"`);
    }
    return new Response(JSON.stringify(step.body), {
      status: step.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

test("loadSession: logged-in user + roles parsed from the User doc", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetchSequence([
    { match: "frappe.auth.get_logged_user", status: 200, body: { message: "jan@example.com" } },
    {
      match: "/api/resource/User/jan%40example.com",
      status: 200,
      body: { data: { full_name: "Jan Jansen", roles: [{ role: "System Manager" }, { role: "Employee" }] } },
    },
  ]);
  try {
    const session = await loadSession();
    assert.deepEqual(session, {
      user: "jan@example.com",
      fullName: "Jan Jansen",
      roles: ["System Manager", "Employee"],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('loadSession: "Guest" message -> SessionUnavailableError with status 401', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetchSequence([
    { match: "frappe.auth.get_logged_user", status: 200, body: { message: "Guest" } },
  ]);
  try {
    await assert.rejects(loadSession(), (err: unknown) => {
      assert.ok(err instanceof SessionUnavailableError);
      assert.equal((err as SessionUnavailableError).status, 401);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadSession: HTTP 401 from get_logged_user itself -> SessionUnavailableError", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetchSequence([
    { match: "frappe.auth.get_logged_user", status: 401, body: {} },
  ]);
  try {
    await assert.rejects(loadSession(), (err: unknown) => {
      assert.ok(err instanceof SessionUnavailableError);
      assert.equal((err as SessionUnavailableError).status, 401);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadSession: HTTP 403 from get_logged_user itself -> SessionUnavailableError", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetchSequence([
    { match: "frappe.auth.get_logged_user", status: 403, body: {} },
  ]);
  try {
    await assert.rejects(loadSession(), (err: unknown) => {
      assert.ok(err instanceof SessionUnavailableError);
      assert.equal((err as SessionUnavailableError).status, 401);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadSession: User-doc fetch fails with 403 -> degrade gracefully (session stays valid)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetchSequence([
    { match: "frappe.auth.get_logged_user", status: 200, body: { message: "jan@example.com" } },
    { match: "/api/resource/User/", status: 403, body: {} },
  ]);
  try {
    const session = await loadSession();
    assert.deepEqual(session, { user: "jan@example.com", fullName: "jan@example.com", roles: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loginUrl: default returnTo and custom returnTo are both URI-encoded", () => {
  assert.equal(loginUrl(), "/login?redirect-to=%2Fy-next");
  assert.equal(loginUrl("/y-next/mail?x=1"), "/login?redirect-to=%2Fy-next%2Fmail%3Fx%3D1");
});
