import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ensureCsrfToken,
  extractCsrfTokenFromHtml,
  getCsrfToken,
  normalizeCsrfToken,
  refreshCsrfToken,
  resetCsrfTokenCache,
} from "./csrf.ts";

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

/* ─── Gast-placeholder ("None") ─── */

test("normalizeCsrfToken: rejects Frappe's guest placeholders and non-strings", () => {
  // Frappe rendert Python's None letterlijk in de pagina van een uitgelogde
  // bezoeker. Als truthy string zou hij anders als header meegaan → elke
  // mutatie faalt met "Invalid Request".
  assert.equal(normalizeCsrfToken("None"), null);
  assert.equal(normalizeCsrfToken("none"), null);
  assert.equal(normalizeCsrfToken("null"), null);
  assert.equal(normalizeCsrfToken("undefined"), null);
  assert.equal(normalizeCsrfToken("   "), null);
  assert.equal(normalizeCsrfToken(""), null);
  assert.equal(normalizeCsrfToken(undefined), null);
  assert.equal(normalizeCsrfToken(42), null);
  assert.equal(normalizeCsrfToken("  real-token  "), "real-token");
});

test("getCsrfToken: treats the guest placeholder 'None' as no token", () => {
  resetCsrfTokenCache();
  withWindow({ frappe: { csrf_token: "None" } }, () => {
    assert.equal(getCsrfToken(), null);
  });
});

test("getCsrfToken: never caches a placeholder, so a later real token wins", () => {
  resetCsrfTokenCache();
  withWindow({ frappe: { csrf_token: "None" } }, () => {
    assert.equal(getCsrfToken(), null);
  });
  withWindow({ frappe: { csrf_token: "real-token" } }, () => {
    assert.equal(getCsrfToken(), "real-token");
  });
});

/* ─── Token uit pagina-HTML halen ─── */

test("extractCsrfTokenFromHtml: pulls the token out of Frappe's injected script", () => {
  assert.equal(
    extractCsrfTokenFromHtml('<script>frappe.csrf_token = "e3b0c44298fc1c14";</script></body>'),
    "e3b0c44298fc1c14"
  );
  assert.equal(
    extractCsrfTokenFromHtml("<script>window.csrf_token = 'single-quoted';</script>"),
    "single-quoted"
  );
});

test("extractCsrfTokenFromHtml: guest HTML and marker-only HTML yield null", () => {
  assert.equal(extractCsrfTokenFromHtml('<script>frappe.csrf_token = "None";</script>'), null);
  assert.equal(extractCsrfTokenFromHtml("<!-- csrf_token --></body>"), null);
  assert.equal(extractCsrfTokenFromHtml("<html><body>no token here</body></html>"), null);
});

/* ─── refreshCsrfToken / ensureCsrfToken (mock fetch) ─── */

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/** Draait `fn` met een nep-`window` én een nep-`fetch`, en levert de calls op. */
async function withMockFetch<T>(
  win: Record<string, unknown>,
  responder: (url: string) => { ok: boolean; body: string } | Promise<{ ok: boolean; body: string }>,
  fn: (calls: FetchCall[]) => Promise<T>
): Promise<T> {
  const g = globalThis as { window?: unknown; fetch?: unknown };
  const hadWindow = "window" in g;
  const prevWindow = g.window;
  const prevFetch = g.fetch;
  const calls: FetchCall[] = [];

  g.window = { location: { pathname: "/y-next" }, ...win };
  g.fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const { ok, body } = await responder(url);
    return { ok, text: async () => body } as unknown as Response;
  };

  try {
    return await fn(calls);
  } finally {
    g.fetch = prevFetch;
    if (hadWindow) g.window = prevWindow;
    else delete g.window;
  }
}

test("refreshCsrfToken: re-fetches the page past the HTTP cache and caches the fresh token", async () => {
  resetCsrfTokenCache();
  await withMockFetch(
    { frappe: { csrf_token: "None" } },
    () => ({ ok: true, body: '<script>frappe.csrf_token = "fresh-token";</script>' }),
    async (calls) => {
      assert.equal(await refreshCsrfToken(), "fresh-token");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "/y-next", "moet de Web-Page-route zelf ophalen");
      assert.equal(calls[0].init?.cache, "reload", "moet de HTTP-cache omzeilen");
      assert.equal(calls[0].init?.credentials, "same-origin");
      // Zowel de modulecache als window is nu bijgewerkt.
      assert.equal(getCsrfToken(), "fresh-token");
      assert.equal(
        (globalThis as { window?: { frappe?: { csrf_token?: string } } }).window?.frappe?.csrf_token,
        "fresh-token"
      );
      return null;
    }
  );
});

test("refreshCsrfToken: returns null on a failed fetch and does not poison the cache", async () => {
  resetCsrfTokenCache();
  await withMockFetch({}, () => ({ ok: false, body: "" }), async () => {
    assert.equal(await refreshCsrfToken(), null);
    assert.equal(getCsrfToken(), null);
    return null;
  });
});

test("refreshCsrfToken: concurrent callers share a single page fetch", async () => {
  resetCsrfTokenCache();
  await withMockFetch(
    {},
    () => ({ ok: true, body: '<script>frappe.csrf_token = "shared";</script>' }),
    async (calls) => {
      const [a, b, c] = await Promise.all([refreshCsrfToken(), refreshCsrfToken(), refreshCsrfToken()]);
      assert.deepEqual([a, b, c], ["shared", "shared", "shared"]);
      assert.equal(calls.length, 1, "drie gelijktijdige aanroepen = één fetch");
      return null;
    }
  );
});

test("ensureCsrfToken: no fetch when the page already carries a real token", async () => {
  resetCsrfTokenCache();
  await withMockFetch(
    { frappe: { csrf_token: "already-good" } },
    () => ({ ok: true, body: '<script>frappe.csrf_token = "should-not-be-used";</script>' }),
    async (calls) => {
      assert.equal(await ensureCsrfToken(), "already-good");
      assert.equal(calls.length, 0);
      return null;
    }
  );
});

test("ensureCsrfToken: recovers the post-login case where the cached page says 'None'", async () => {
  resetCsrfTokenCache();
  await withMockFetch(
    { frappe: { csrf_token: "None" } },
    () => ({ ok: true, body: '<script>frappe.csrf_token = "after-login";</script>' }),
    async (calls) => {
      assert.equal(await ensureCsrfToken(), "after-login");
      assert.equal(calls.length, 1);
      return null;
    }
  );
});
