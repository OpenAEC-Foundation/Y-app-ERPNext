import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchList, fetchAll, createDocument, fetchCount, ApiError, isDoctypeMissing, fetchChildTable } from "./erpnext.ts";
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

test("fetchCount: hits frappe.client.get_count (never /api/i/<id>/count, never the old SQL-string aggregate)", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { message: 3 } }));
  try {
    const count = await fetchCount("FetchCountTestDoctype", [["status", "=", "Open"]]);
    assert.equal(count, 3);
    assert.equal(mock.calls.length, 1);
    const call = mock.calls[0];
    assert.match(call.url, /^\/api\/method\/frappe\.client\.get_count\?/);
    assert.match(call.url, /doctype=FetchCountTestDoctype/);
    assert.doesNotMatch(call.url, /\/api\/i\//);
    assert.doesNotMatch(call.url, /count%28name%29|count\(name\)/i);
    assert.equal(call.init?.credentials, "same-origin");
  } finally {
    mock.restore();
  }
});

test("fetchCount: self-heals on 417 'Field not permitted in query' by dropping the offending filter and retrying", async () => {
  const doctype = "SelfHealCountDoctype";
  const badField = "custom_address";
  let call = 0;
  const mock = installFetchMock((url) => {
    call++;
    const filtersMatch = /filters=([^&]+)/.exec(url);
    const filters: unknown[][] = filtersMatch ? JSON.parse(decodeURIComponent(filtersMatch[1])) : [];
    const hasBadField = filters.some((f) => Array.isArray(f) && f[0] === badField);
    if (hasBadField) {
      return {
        status: 417,
        body: {
          exc_type: "DataError",
          exception: `frappe.exceptions.DataError: Field not permitted in query: ${badField}`,
        },
      };
    }
    return { status: 200, body: { message: 5 } };
  });
  try {
    const count = await fetchCount(doctype, [["status", "=", "Open"], [badField, "=", "x"]]);
    assert.equal(count, 5);
    assert.equal(call, 2);
    assert.match(mock.calls[0].url, new RegExp(badField));
    assert.doesNotMatch(mock.calls[1].url, new RegExp(badField));
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

test("fetchList: self-heals on 417 'Field not permitted in query' by dropping the field and retrying, then caches the exclusion", async () => {
  const doctype = "SelfHealDoctype";
  const badField = "workflow_state";
  let call = 0;
  const warnCalls: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnCalls.push(args); };

  const mock = installFetchMock((url) => {
    call++;
    const fieldsMatch = /fields=([^&]+)/.exec(url);
    const fields: string[] = fieldsMatch ? JSON.parse(decodeURIComponent(fieldsMatch[1])) : [];
    if (fields.includes(badField)) {
      // The instance rejects the query as long as the offending field is present.
      return {
        status: 417,
        body: {
          exc_type: "DataError",
          exception: `frappe.exceptions.DataError: Field not permitted in query: ${badField}`,
          _server_messages: JSON.stringify([
            JSON.stringify({ message: `Field not permitted in query: ${badField}`, title: "Message" }),
          ]),
        },
      };
    }
    return { status: 200, body: { data: [{ name: "TASK-0001" }] } };
  });

  try {
    // First call: 417 on attempt 1 (field present), self-heals, retries
    // without the field on attempt 2, and succeeds.
    const rows = await fetchList<{ name: string }>(doctype, { fields: ["name", badField] });
    assert.deepEqual(rows, [{ name: "TASK-0001" }]);
    assert.equal(call, 2);
    assert.match(mock.calls[0].url, new RegExp(badField));
    assert.doesNotMatch(mock.calls[1].url, new RegExp(badField));
    assert.equal(warnCalls.length, 1, "should warn exactly once for this doctype+field");

    // Second, independent call with the same params: the module-level
    // exclusion cache means the field is dropped *before* the request is
    // even sent — no repeat 417 round-trip, and the field never appears
    // on the wire again.
    const rows2 = await fetchList<{ name: string }>(doctype, { fields: ["name", badField] });
    assert.deepEqual(rows2, [{ name: "TASK-0001" }]);
    assert.equal(call, 3, "third network call should succeed directly, without re-sending the rejected field");
    assert.doesNotMatch(mock.calls[2].url, new RegExp(badField));
    assert.equal(warnCalls.length, 1, "should not warn again on the second call");
  } finally {
    mock.restore();
    console.warn = originalWarn;
  }
});

test("fetchList: self-heal is not capped — heals through more than 5 rejected fields on one doctype", async () => {
  const doctype = "ManyBadFieldsDoctype";
  const badFields = ["custom_a", "custom_b", "custom_c", "custom_d", "custom_e", "custom_f", "custom_g"];
  let call = 0;

  const mock = installFetchMock((url) => {
    call++;
    const fieldsMatch = /fields=([^&]+)/.exec(url);
    const fields: string[] = fieldsMatch ? JSON.parse(decodeURIComponent(fieldsMatch[1])) : [];
    const stillBad = badFields.find((f) => fields.includes(f));
    if (stillBad) {
      return {
        status: 417,
        body: {
          exc_type: "DataError",
          exception: `frappe.exceptions.DataError: Field not permitted in query: ${stillBad}`,
        },
      };
    }
    return { status: 200, body: { data: [{ name: "ROW-0001" }] } };
  });

  try {
    const rows = await fetchList<{ name: string }>(doctype, { fields: ["name", ...badFields] });
    assert.deepEqual(rows, [{ name: "ROW-0001" }]);
    // One failing request per rejected field, plus the final successful one.
    assert.equal(call, badFields.length + 1);
    const lastUrl = mock.calls[mock.calls.length - 1].url;
    for (const f of badFields) assert.doesNotMatch(lastUrl, new RegExp(f));
  } finally {
    mock.restore();
  }
});

test("fetchList: missing doctype (404 DoesNotExistError, 'DocType X not found') resolves to [] and is cached", async () => {
  const doctype = "Leave Application";
  let call = 0;
  const warnCalls: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnCalls.push(args); };

  const mock = installFetchMock(() => {
    call++;
    return {
      status: 404,
      body: {
        exc_type: "DoesNotExistError",
        _server_messages: JSON.stringify([
          JSON.stringify({ message: `DocType ${doctype} not found`, title: "Message" }),
        ]),
      },
    };
  });

  try {
    const rows = await fetchList(doctype, { fields: ["name"] });
    assert.deepEqual(rows, []);
    assert.equal(call, 1);
    assert.equal(warnCalls.length, 1, "should warn exactly once for this missing doctype");

    // Second call: cached as missing — no network call at all.
    const rows2 = await fetchList(doctype, { fields: ["name", "employee"] });
    assert.deepEqual(rows2, []);
    assert.equal(call, 1, "no additional network call once the doctype is known missing");
    assert.equal(warnCalls.length, 1, "should not warn again");
  } finally {
    mock.restore();
    console.warn = originalWarn;
  }
});

test("fetchList: distinguishes a missing doctype from an ordinary 'record not found' 404", async () => {
  // Doctype name is deliberately unique (not reused by any other test in
  // this file) so this can't be served from the shared 30s response cache
  // instead of actually hitting the mock below.
  const doctype = "RecordNotFoundDoctype";
  const mock = installFetchMock(() => ({
    status: 404,
    body: {
      exc_type: "DoesNotExistError",
      _server_messages: JSON.stringify([
        JSON.stringify({ message: `${doctype} DOES-NOT-EXIST not found`, title: "Message" }),
      ]),
    },
  }));
  try {
    // Message shape is "<Doctype> <docname> not found", not "DocType <name>
    // not found" — this is a missing *record*, not a missing *doctype*, so
    // it must still surface as a normal error rather than degrading to [].
    await assert.rejects(fetchList(doctype, { fields: ["name"] }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 404);
      return true;
    });
  } finally {
    mock.restore();
  }
});

test("fetchCount: missing doctype (404 DoesNotExistError) resolves to 0 and is cached", async () => {
  const doctype = "Salary Slip";
  let call = 0;
  const mock = installFetchMock(() => {
    call++;
    return {
      status: 404,
      body: {
        exc_type: "DoesNotExistError",
        _server_messages: JSON.stringify([
          JSON.stringify({ message: `DocType ${doctype} not found`, title: "Message" }),
        ]),
      },
    };
  });
  try {
    const count = await fetchCount(doctype, [["status", "=", "Open"]]);
    assert.equal(count, 0);
    assert.equal(call, 1);

    const count2 = await fetchCount(doctype);
    assert.equal(count2, 0);
    assert.equal(call, 1, "no additional network call once the doctype is known missing");
  } finally {
    mock.restore();
  }
});

test("fetchChildTable: lists a child doctype via frappe.client.get_list with an explicit `parent` arg (not a `parenttype` filter)", async () => {
  const mock = installFetchMock((url, init) => {
    assert.match(url, /^\/api\/method\/frappe\.client\.get_list$/);
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.doctype, "Timesheet Detail");
    assert.equal(body.parent, "Timesheet");
    // Must NOT smuggle the parent scoping in as a "parenttype" filter —
    // verified live against Frappe v16 that still 403s.
    const filters: unknown[][] = body.filters || [];
    assert.ok(!filters.some((f) => Array.isArray(f) && f[0] === "parenttype"));
    assert.deepEqual(body.fields, ["name", "hours", "parent"]);
    return { status: 200, body: { message: [{ name: "row-1", hours: 4, parent: "TS-0001" }] } };
  });
  try {
    const rows = await fetchChildTable<{ name: string; hours: number; parent: string }>(
      "Timesheet Detail", "Timesheet", ["name", "hours", "parent"], [["parent", "in", ["TS-0001"]]], 500
    );
    assert.deepEqual(rows, [{ name: "row-1", hours: 4, parent: "TS-0001" }]);
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
  }
});

test("fetchChildTable: returns [] when the RPC responds with no message", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: {} }));
  try {
    const rows = await fetchChildTable("Timesheet Detail", "Timesheet", ["name"]);
    assert.deepEqual(rows, []);
  } finally {
    mock.restore();
  }
});

test("isDoctypeMissing: false before any request, true once fetchList has confirmed the doctype is missing", async () => {
  const doctype = "Expense Claim";
  // Not queried yet in this tab — must not report "missing" based on
  // nothing, even though the doctype genuinely doesn't exist on the target.
  assert.equal(isDoctypeMissing(doctype), false);

  const mock = installFetchMock(() => ({
    status: 404,
    body: {
      exc_type: "DoesNotExistError",
      _server_messages: JSON.stringify([
        JSON.stringify({ message: `DocType ${doctype} not found`, title: "Message" }),
      ]),
    },
  }));
  try {
    const rows = await fetchList(doctype, { fields: ["name"] });
    assert.deepEqual(rows, []);
    // Now that fetchList has hit and cached the 404, callers (e.g. a page
    // that wants to show "module unavailable" instead of misleading zeros)
    // can detect it without re-deriving the same logic themselves.
    assert.equal(isDoctypeMissing(doctype), true);
  } finally {
    mock.restore();
  }

  // A doctype that is NOT missing (ordinary successful fetch) must read false.
  const okDoctype = "IsDoctypeMissingOkDoctype";
  assert.equal(isDoctypeMissing(okDoctype), false);
  const okMock = installFetchMock(() => ({ status: 200, body: { data: [{ name: "X" }] } }));
  try {
    await fetchList(okDoctype, { fields: ["name"] });
    assert.equal(isDoctypeMissing(okDoctype), false);
  } finally {
    okMock.restore();
  }
});

test("fetchAll: missing doctype resolves to [] via fetchList's cache, with a single network call", async () => {
  const doctype = "Shift Plan Assignment";
  let call = 0;
  const mock = installFetchMock(() => {
    call++;
    return {
      status: 404,
      body: {
        exc_type: "DoesNotExistError",
        _server_messages: JSON.stringify([
          JSON.stringify({ message: `DocType ${doctype} not found`, title: "Message" }),
        ]),
      },
    };
  });
  try {
    const rows = await fetchAll(doctype, ["name", "employee"]);
    assert.deepEqual(rows, []);
    assert.equal(call, 1);
  } finally {
    mock.restore();
  }
});

/* ─── CSRF-herstel op muterende requests ───
 *
 * Achtergrond: de Web-Page-HTML van Y-next is browser-cachebaar, dus na een
 * login-redirect kan de SPA nog met het gast-token draaien. Lezen werkt dan
 * (GET kent geen CSRF-check), maar élke mutatie krijgt HTTP 400 "Invalid
 * Request" terug. Deze tests dekken het herstelpad. */

/** Mock die per URL óf JSON óf ruwe HTML teruggeeft. */
function installMixedFetchMock(
  handler: (url: string, init?: RequestInit) => { status: number; json?: unknown; html?: string }
): { calls: RecordedCall[]; restore: () => void } {
  const calls: RecordedCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const { status, json, html } = handler(url, init);
    if (html !== undefined) {
      return new Response(html, { status, headers: { "content-type": "text/html" } });
    }
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

/**
 * Async-variant van withWindow: houdt het nep-`window` in de lucht tot de
 * hele promise klaar is. De synchrone versie zet hem terug zodra `fn()` de
 * promise retourneert — dan is `window` al weg tegen de tijd dat een retry
 * of token-refresh eraan toekomt.
 */
async function withWindowAsync<T>(win: unknown, fn: () => Promise<T>): Promise<T> {
  const g = globalThis as { window?: unknown };
  const had = "window" in g;
  const prev = g.window;
  g.window = win;
  try {
    return await fn();
  } finally {
    if (had) g.window = prev;
    else delete g.window;
  }
}

const CSRF_REJECTION = {
  status: 400,
  json: { exc_type: "CSRFTokenError", exception: "frappe.exceptions.CSRFTokenError: Invalid Request" },
};

test("createDocument: refreshes the CSRF token and retries once after 'Invalid Request'", async () => {
  resetCsrfTokenCache();
  let apiCalls = 0;
  const mock = installMixedFetchMock((url) => {
    if (url === "/y-next") {
      return { status: 200, html: '<script>frappe.csrf_token = "fresh-token";</script>' };
    }
    apiCalls += 1;
    // Eerste poging draagt het gast-token → geweigerd. Tweede poging slaagt.
    return apiCalls === 1 ? CSRF_REJECTION : { status: 200, json: { data: { name: "TS-2026-00001" } } };
  });
  try {
    const doc = await withWindowAsync(
      { location: { pathname: "/y-next" }, frappe: { csrf_token: "None" } },
      () => createDocument<{ name: string }>("Timesheet", { employee: "HR-EMP-00002" })
    );
    assert.deepEqual(doc, { name: "TS-2026-00001" });

    const apiAttempts = mock.calls.filter((c) => c.url.startsWith("/api/"));
    assert.equal(apiAttempts.length, 2, "precies één retry");
    // De eerste poging ging zonder token de deur uit ("None" telt niet mee),
    // de retry draagt het verse token uit de herlaadde pagina.
    const first = apiAttempts[0].init?.headers as Record<string, string>;
    const second = apiAttempts[1].init?.headers as Record<string, string>;
    assert.equal("X-Frappe-CSRF-Token" in first, false);
    assert.equal(second["X-Frappe-CSRF-Token"], "fresh-token");
    // De pagina is precies één keer opnieuw opgehaald, langs de HTTP-cache heen.
    const pageFetches = mock.calls.filter((c) => c.url === "/y-next");
    assert.equal(pageFetches.length, 1);
    assert.equal(pageFetches[0].init?.cache, "reload");
  } finally {
    mock.restore();
    resetCsrfTokenCache();
  }
});

test("createDocument: does not retry when the refresh yields the same token", async () => {
  resetCsrfTokenCache();
  const mock = installMixedFetchMock((url) => {
    if (url === "/y-next") {
      return { status: 200, html: '<script>frappe.csrf_token = "same-token";</script>' };
    }
    return CSRF_REJECTION;
  });
  try {
    await assert.rejects(
      () =>
        withWindowAsync(
          { location: { pathname: "/y-next" }, frappe: { csrf_token: "same-token" } },
          () => createDocument("Timesheet", {})
        ),
      (err: unknown) => err instanceof ApiError && err.status === 400
    );
    // Eén API-poging: opnieuw proberen met hetzelfde token heeft geen zin en
    // zou een échte "Invalid Request" alleen maar verdubbelen.
    assert.equal(mock.calls.filter((c) => c.url.startsWith("/api/")).length, 1);
  } finally {
    mock.restore();
    resetCsrfTokenCache();
  }
});

test("createDocument: a non-CSRF 400 surfaces immediately, with its server message", async () => {
  resetCsrfTokenCache();
  const mock = installMixedFetchMock(() => ({
    status: 400,
    json: { exception: "frappe.exceptions.ValidationError: Row 1: From Time is mandatory" },
  }));
  try {
    await assert.rejects(
      () =>
        withWindowAsync({ location: { pathname: "/y-next" } }, () =>
          createDocument("Timesheet", {})
        ),
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.includes("Row 1: From Time is mandatory")
    );
    // Geen page-refetch, geen retry — de body ruikt niet naar CSRF.
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
    resetCsrfTokenCache();
  }
});

test("createDocument: a 417 that is not CSRF-shaped is left alone", async () => {
  resetCsrfTokenCache();
  const mock = installMixedFetchMock(() => ({
    status: 417,
    json: {
      exception:
        "erpnext.projects.doctype.timesheet.timesheet.OverlapError: Row 1: From Time and To Time of TS-2026-00001 is overlapping with TS-2026-00001",
    },
  }));
  try {
    await assert.rejects(
      () => withWindowAsync({ location: { pathname: "/y-next" } }, () => createDocument("Timesheet", {})),
      (err: unknown) => err instanceof ApiError && err.status === 417 && err.message.includes("overlapping")
    );
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
    resetCsrfTokenCache();
  }
});
