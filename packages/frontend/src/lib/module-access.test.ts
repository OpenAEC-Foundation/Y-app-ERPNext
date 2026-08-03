import { test } from "node:test";
import assert from "node:assert/strict";
import { invalidateCache } from "./erpnext.ts";
import { resetSessionUserCache } from "./session.ts";
import { getModuleAccess, invalidateModuleAccess } from "./module-access.ts";

interface RecordedCall {
  url: string;
}

function installFetchMock(
  handler: (url: string) => { status: number; body: unknown }
): { calls: RecordedCall[]; restore: () => void } {
  const calls: RecordedCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url });
    const { status, body } = handler(url);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

/**
 * erpnext.ts houdt een afgeronde request nog 100 ms in zijn in-flight-
 * dedupmap; `invalidateCache()` raakt alleen de responscache. Tests die
 * dezelfde URL met een ánder antwoord moeten kunnen bevragen, zitten dat
 * venster hier uit.
 */
function settleFetchDedup(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

/** Schone lei: geen sessie-, respons- of module-access-cache uit een vorige test. */
async function resetAll(): Promise<void> {
  invalidateModuleAccess();
  resetSessionUserCache();
  invalidateCache();
  await settleFetchDedup();
}

const MISSING_DOCTYPE_BODY = {
  exc_type: "DoesNotExistError",
  _server_messages: JSON.stringify([
    JSON.stringify({ message: "DocType Wiki Page not found", as_table: false, title: "Message" }),
  ]),
};

/** Doctype uit een `frappe.client.get_count`-URL. */
function countDoctype(url: string): string | null {
  const m = /frappe\.client\.get_count\?(.*)$/.exec(url);
  if (!m) return null;
  return new URLSearchParams(m[1]).get("doctype");
}

/**
 * Standaardantwoorden: ingelogde user zonder geblokkeerde modules, elk
 * doctype bestaat en is leesbaar, en er is een ingericht Email Account.
 * Per test overschrijft `overrides` alleen wat die test onderzoekt.
 */
function defaultHandler(overrides: {
  blockModules?: { module: string }[];
  count?: (doctype: string) => { status: number; body: unknown } | null;
  emailAccounts?: unknown[];
  userStatus?: number;
} = {}) {
  return (url: string): { status: number; body: unknown } => {
    if (url.includes("frappe.auth.get_logged_user")) {
      return { status: 200, body: { message: "jan@example.com" } };
    }
    if (url.startsWith("/api/resource/User/")) {
      if (overrides.userStatus && overrides.userStatus !== 200) {
        return { status: overrides.userStatus, body: { exception: "No permission" } };
      }
      return { status: 200, body: { data: { block_modules: overrides.blockModules ?? [] } } };
    }
    if (url.startsWith("/api/resource/Email Account")) {
      return { status: 200, body: { data: overrides.emailAccounts ?? [{ name: "OpenAEC Mail" }] } };
    }
    const doctype = countDoctype(url);
    if (doctype) {
      const custom = overrides.count?.(doctype);
      if (custom) return custom;
      return { status: 200, body: { message: 3 } };
    }
    throw new Error(`Unexpected fetch to ${url}`);
  };
}

test("block_modules: een geblokkeerde ERPNext-module verbergt al zijn schermen", async () => {
  await resetAll();
  const mock = installFetchMock(defaultHandler({ blockModules: [{ module: "Projects" }] }));
  try {
    const access = await getModuleAccess();
    for (const id of ["projects", "tasks", "subtasks", "planning", "timesheets"]) {
      assert.deepEqual(access[id], { visible: false, reason: "blocked-module" }, id);
    }
    // Niet-geblokkeerde modules blijven staan …
    assert.deepEqual(access.webmail, { visible: true, reason: "ok" });
    // … en het doctype van een geblokkeerde module kost geen request.
    const probed = mock.calls.map((c) => countDoctype(c.url)).filter(Boolean);
    assert.ok(!probed.includes("Project"), "Project mag niet geprobed worden");
    assert.ok(!probed.includes("Task"), "Task mag niet geprobed worden");
    assert.ok(probed.includes("Communication"));
  } finally {
    mock.restore();
  }
});

test("block_modules: een scherm onder meerdere Module Defs valt af zodra er één blokkeert", async () => {
  await resetAll();
  const mock = installFetchMock(defaultHandler({ blockModules: [{ module: "CRM" }] }));
  try {
    const access = await getModuleAccess();
    assert.deepEqual(access.contacts, { visible: false, reason: "blocked-module" });
    assert.deepEqual(access.leads, { visible: false, reason: "blocked-module" });
    assert.deepEqual(access.quotations, { visible: true, reason: "ok" });
  } finally {
    mock.restore();
  }
});

test("block_modules: Support blokkeren raakt Todo niet (ToDo hoort tot Desk)", async () => {
  await resetAll();
  const mock = installFetchMock(defaultHandler({ blockModules: [{ module: "Support" }] }));
  try {
    const access = await getModuleAccess();
    assert.deepEqual(access.todo, { visible: true, reason: "ok" });
    // De rechten op Todo komen puur uit de doctype-probe.
    const probed = mock.calls.map((c) => countDoctype(c.url)).filter(Boolean);
    assert.ok(probed.includes("ToDo"));
  } finally {
    mock.restore();
  }
});

test("banktransacties draaien op Bank Transaction, niet op GL Entry", async () => {
  await resetAll();
  const mock = installFetchMock(defaultHandler({
    count: (dt) => dt === "Bank Transaction"
      ? { status: 403, body: { exception: "frappe.exceptions.PermissionError" } }
      : null,
  }));
  try {
    const access = await getModuleAccess();
    assert.deepEqual(access["bank-transactions"], { visible: false, reason: "no-permission" });
    // De grootboekschermen hangen aan GL Entry en blijven dus staan.
    assert.deepEqual(access.ledgers, { visible: true, reason: "ok" });
    assert.deepEqual(access["financieel-dashboard"], { visible: true, reason: "ok" });
  } finally {
    mock.restore();
  }
});

test("block_modules: 403 op de eigen User-doc slaat de bron over (verbergt niets)", async () => {
  await resetAll();
  const mock = installFetchMock(defaultHandler({ userStatus: 403 }));
  try {
    const access = await getModuleAccess();
    assert.deepEqual(access.projects, { visible: true, reason: "ok" });
    assert.deepEqual(access.webmail, { visible: true, reason: "ok" });
  } finally {
    mock.restore();
  }
});

test("doctype-probe: 403 op get_count ⇒ no-permission voor elk scherm op dat doctype", async () => {
  await resetAll();
  const mock = installFetchMock(defaultHandler({
    count: (dt) => dt === "Task"
      ? { status: 403, body: { exception: "frappe.exceptions.PermissionError: Insufficient Permission for Task" } }
      : null,
  }));
  try {
    const access = await getModuleAccess();
    for (const id of ["tasks", "subtasks", "planning"]) {
      assert.deepEqual(access[id], { visible: false, reason: "no-permission" }, id);
    }
    assert.deepEqual(access.projects, { visible: true, reason: "ok" });
  } finally {
    mock.restore();
  }
});

test("doctype-probe: netwerk-/serverfout verbergt niets (fail-open)", async () => {
  await resetAll();
  const mock = installFetchMock(defaultHandler({
    count: (dt) => dt === "Timesheet" ? { status: 500, body: { exception: "boom" } } : null,
  }));
  try {
    const access = await getModuleAccess();
    assert.deepEqual(access.timesheets, { visible: true, reason: "ok" });
  } finally {
    mock.restore();
  }
});

test("e-mail: zonder ingericht Email Account is de module not-configured maar wél zichtbaar", async () => {
  await resetAll();
  const mock = installFetchMock(defaultHandler({ emailAccounts: [] }));
  try {
    const access = await getModuleAccess();
    assert.deepEqual(access.webmail, { visible: true, reason: "not-configured" });
  } finally {
    mock.restore();
  }
});

test("cache: één proberonde per sessie, invalidateModuleAccess start een nieuwe", async () => {
  await resetAll();
  const mock = installFetchMock(defaultHandler());
  try {
    const first = await getModuleAccess();
    const callsAfterFirst = mock.calls.length;
    assert.ok(callsAfterFirst > 1, "eerste ronde doet requests");

    const second = await getModuleAccess();
    assert.equal(mock.calls.length, callsAfterFirst, "tweede aanroep doet geen requests");
    assert.equal(second, first, "zelfde (gedeelde) resultaat");

    // Na invalidatie draait de ronde opnieuw. De responscache van erpnext.ts
    // zou 'm anders alsnog uit het geheugen bedienen — die dus ook leegen,
    // zodat de assertie echt over de proberonde gaat.
    invalidateModuleAccess();
    invalidateCache();
    await settleFetchDedup();
    await getModuleAccess();
    assert.ok(mock.calls.length > callsAfterFirst, "na invalidatie draait de ronde opnieuw");
  } finally {
    mock.restore();
  }
});

/*
 * Deze test staat bewust als laatste: hij markeert `Wiki Page` in de
 * missing-doctype-cache van erpnext.ts, en die cache leeft voor de rest van
 * het proces. Eerder in het bestand zou elke volgende ronde `wiki` al als
 * ontbrekend zien zonder ooit nog een request te doen.
 */
test("doctype-probe: 404 DoesNotExistError ⇒ doctype-missing (app niet geïnstalleerd)", async () => {
  await resetAll();
  const mock = installFetchMock(defaultHandler({
    count: (dt) => dt === "Wiki Page" ? { status: 404, body: MISSING_DOCTYPE_BODY } : null,
  }));
  try {
    const access = await getModuleAccess();
    assert.deepEqual(access.wiki, { visible: false, reason: "doctype-missing" });
    assert.deepEqual(access.todo, { visible: true, reason: "ok" });
  } finally {
    mock.restore();
  }
});
