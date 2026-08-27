import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./erpnext.ts";
import { isPermissionError } from "./permission-error.ts";
import {
  browserAttachmentIo,
  checkAttachmentAccess,
  openAttachmentInTab,
  type AttachmentIo,
  type BlankTab,
} from "./mail-attachment.ts";

const PDF = { file_url: "/private/files/ACC-SINV-2026-00016.pdf", file_name: "Factuur.pdf" };

interface Trace {
  events: string[];
  navigatedTo: string | null;
  downloaded: { url: string; fileName: string } | null;
}

/**
 * IO-dubbel dat de VOLGORDE vastlegt. De hele bugklasse hier is een
 * timingkwestie (tabblad openen vóór of ná het async werk), dus de test moet
 * op volgorde kunnen assertion doen en niet alleen op eindresultaat.
 */
function fakeIo(opts: {
  tab?: "ok" | "blocked";
  access?: () => Promise<void>;
}): { io: AttachmentIo; trace: Trace } {
  const trace: Trace = { events: [], navigatedTo: null, downloaded: null };
  const tab: BlankTab = {
    navigate(url) { trace.events.push("navigate"); trace.navigatedTo = url; },
    close() { trace.events.push("close"); },
  };
  const io: AttachmentIo = {
    openBlankTab() {
      trace.events.push("openBlankTab");
      return opts.tab === "blocked" ? null : tab;
    },
    async checkAccess() {
      trace.events.push("checkAccess");
      if (opts.access) await opts.access();
    },
    startDownload(url, fileName) {
      trace.events.push("startDownload");
      trace.downloaded = { url, fileName };
    },
  };
  return { io, trace };
}

/* ─── De regressie zelf ─── */

test("browserAttachmentIo: window.open krijgt GEEN 'noopener' — die maakt de returnwaarde null", () => {
  // Dit IS de bug: met "noopener" eindigt het window.open-algoritme per
  // HTML-spec op "return null", ook al gaat het tabblad gewoon open. De oude
  // code las die null als "popup geblokkeerd", meldde "PDF openen mislukt" en
  // liet een leeg tabblad achter. Live in Chromium bevestigd.
  const calls: unknown[][] = [];
  const g = globalThis as { window?: unknown };
  const had = "window" in g;
  const prev = g.window;
  g.window = {
    open: (...args: unknown[]) => {
      calls.push(args);
      return { location: { href: "" }, close() {} };
    },
  };
  try {
    const tab = browserAttachmentIo.openBlankTab();
    assert.ok(tab, "openBlankTab moet een bruikbaar handvat opleveren");
    assert.equal(calls.length, 1);
    const features = calls[0][2];
    assert.ok(
      features === undefined || !String(features).includes("noopener"),
      `window.open mag geen noopener meekrijgen, kreeg: ${String(features)}`,
    );
  } finally {
    if (had) g.window = prev;
    else delete g.window;
  }
});

test("browserAttachmentIo: een echt geblokkeerde popup (null uit window.open) levert null op", () => {
  const g = globalThis as { window?: unknown };
  const had = "window" in g;
  const prev = g.window;
  g.window = { open: () => null };
  try {
    assert.equal(browserAttachmentIo.openBlankTab(), null);
  } finally {
    if (had) g.window = prev;
    else delete g.window;
  }
});

/* ─── Volgorde en happy path ─── */

test("openAttachmentInTab: opent het tabblad SYNCHROON, vóór de toegangscontrole", async () => {
  const { io, trace } = fakeIo({ access: () => new Promise((r) => setTimeout(r, 5)) });
  const promise = openAttachmentInTab(PDF, io);
  // Nog geen enkele await afgewikkeld: het tabblad moet er al zijn, anders
  // valt de window.open buiten de user-activation van de klik.
  assert.deepEqual(trace.events, ["openBlankTab", "checkAccess"]);
  assert.equal(await promise, "opened");
  assert.deepEqual(trace.events, ["openBlankTab", "checkAccess", "navigate"]);
});

test("openAttachmentInTab: navigeert naar de bestandsURL en downloadt niets", async () => {
  const { io, trace } = fakeIo({});
  assert.equal(await openAttachmentInTab(PDF, io), "opened");
  assert.equal(trace.navigatedTo, PDF.file_url);
  assert.equal(trace.downloaded, null);
});

/* ─── Foutpaden: zichtbaar, nooit stil ─── */

test("openAttachmentInTab: een 403 sluit het lege tabblad en gooit een herkenbare rechtenfout", async () => {
  const { io, trace } = fakeIo({
    access: () => Promise.reject(new ApiError(403, "No permission to read this attachment")),
  });
  const err = await openAttachmentInTab(PDF, io).then(() => null, (e) => e);
  assert.ok(err, "moet gooien, niet stil falen");
  assert.equal(isPermissionError(err), true, "de UI moet dit als rechtenfout kunnen tonen");
  assert.deepEqual(trace.events, ["openBlankTab", "checkAccess", "close"]);
  assert.equal(trace.navigatedTo, null, "geen navigatie naar een bestand dat 403 geeft");
  assert.equal(trace.downloaded, null);
});

test("openAttachmentInTab: een serverfout gooit met de status erbij en laat geen tabblad achter", async () => {
  const { io, trace } = fakeIo({
    access: () => Promise.reject(new ApiError(500, "Bijlage ophalen mislukt (HTTP 500)")),
  });
  const err = await openAttachmentInTab(PDF, io).then(() => null, (e) => e);
  assert.match(String((err as Error).message), /500/);
  assert.equal(isPermissionError(err), false);
  assert.ok(trace.events.includes("close"));
});

/* ─── Popup-blokkade: terugvallen op downloaden ─── */

test("openAttachmentInTab: bij een geblokkeerde popup wordt de bijlage gedownload", async () => {
  const { io, trace } = fakeIo({ tab: "blocked" });
  assert.equal(await openAttachmentInTab(PDF, io), "downloaded");
  assert.deepEqual(trace.downloaded, { url: PDF.file_url, fileName: PDF.file_name });
  assert.equal(trace.navigatedTo, null);
});

test("openAttachmentInTab: geblokkeerde popup én geen toegang downloadt niets", async () => {
  const { io, trace } = fakeIo({
    tab: "blocked",
    access: () => Promise.reject(new ApiError(403, "No permission to read this attachment")),
  });
  const err = await openAttachmentInTab(PDF, io).then(() => null, (e) => e);
  assert.equal(isPermissionError(err), true);
  assert.equal(trace.downloaded, null, "geen download starten voor een bestand dat 403 geeft");
});

/* ─── De toegangscontrole zelf ─── */

function installFetchMock(handler: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test("checkAttachmentAccess: doet een HEAD met de sessiecookie en haalt geen body op", async () => {
  const mock = installFetchMock(() => new Response(null, { status: 200 }));
  try {
    await checkAttachmentAccess(PDF);
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].url, PDF.file_url);
    assert.equal(mock.calls[0].init?.method, "HEAD");
    assert.equal(mock.calls[0].init?.credentials, "same-origin");
  } finally {
    mock.restore();
  }
});

test("checkAttachmentAccess: 403 komt terug als ApiError met status 403", async () => {
  const mock = installFetchMock(() => new Response("Forbidden", { status: 403 }));
  try {
    const err = await checkAttachmentAccess(PDF).then(() => null, (e) => e);
    assert.ok(err instanceof ApiError);
    assert.equal((err as ApiError).status, 403);
    assert.equal(isPermissionError(err), true);
  } finally {
    mock.restore();
  }
});

test("checkAttachmentAccess: een netwerkfout wordt een leesbare melding, geen 'Failed to fetch'", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch;
  try {
    const err = await checkAttachmentAccess(PDF).then(() => null, (e) => e);
    assert.ok(err instanceof ApiError);
    assert.equal((err as ApiError).status, 0);
    assert.match((err as ApiError).message, /niet bereikbaar/i);
  } finally {
    globalThis.fetch = original;
  }
});
