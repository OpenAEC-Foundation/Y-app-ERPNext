import { test } from "node:test";
import assert from "node:assert/strict";
import { getCsrfToken, resetCsrfTokenCache } from "./csrf.ts";

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

test("getCsrfToken: reads window.frappe.csrf_token when present", () => {
  resetCsrfTokenCache();
  withWindow({ frappe: { csrf_token: "abc123" } }, () => {
    assert.equal(getCsrfToken(), "abc123");
  });
});

test("getCsrfToken: falls back to window.csrf_token when window.frappe is absent", () => {
  resetCsrfTokenCache();
  withWindow({ csrf_token: "legacy-token" }, () => {
    assert.equal(getCsrfToken(), "legacy-token");
  });
});

test("getCsrfToken: returns null when neither is present (no window / no token)", () => {
  resetCsrfTokenCache();
  assert.equal(getCsrfToken(), null);
  withWindow({}, () => {
    assert.equal(getCsrfToken(), null);
  });
});

test("getCsrfToken: caches the first successful read across window changes", () => {
  resetCsrfTokenCache();
  withWindow({ frappe: { csrf_token: "first-token" } }, () => {
    assert.equal(getCsrfToken(), "first-token");
  });
  // Even though the "window" now has a different token, the cached value wins.
  withWindow({ frappe: { csrf_token: "second-token" } }, () => {
    assert.equal(getCsrfToken(), "first-token");
  });
});

test("resetCsrfTokenCache: clears the cache so the next read re-reads window", () => {
  resetCsrfTokenCache();
  withWindow({ frappe: { csrf_token: "first-token" } }, () => {
    assert.equal(getCsrfToken(), "first-token");
  });
  resetCsrfTokenCache();
  withWindow({ frappe: { csrf_token: "second-token" } }, () => {
    assert.equal(getCsrfToken(), "second-token");
  });
});
