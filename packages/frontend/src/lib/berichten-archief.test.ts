/**
 * Tests voor de archief-adapter op het oude "Y Bericht"-doctype.
 *
 * Zelfde opzet als `messages-erpnext.test.ts`: een fetch-stub die de
 * ERPNext-API nabootst. Het zwaartepunt: de richting en afzender komen uit
 * `afzender`/`ontvanger` (niet uit `owner`), het archief is alleen-lezen, en
 * op een installatie zonder het doctype blijft alles een no-op.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { invalidateCache } from "./erpnext.ts";
import { resetSessionUserCache } from "./session.ts";
import {
  ARCHIEF_DOCTYPE,
  ARCHIEF_PREFIX,
  archiefRowToMessage,
  isArchiefNaam,
  listArchiefBerichten,
  markeerArchiefGelezen,
} from "./berichten-archief.ts";
import {
  MESSAGE_DOCTYPE,
  listMessages,
  markMessagesRead,
  verwijderKeuze,
} from "./messages-erpnext.ts";

const ME = "maarten@open-aec.com";
const COLLEGA = "collega@open-aec.com";

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

/** erpnext.ts houdt een afgeronde request nog 100 ms in de in-flight-dedupmap. */
function settleFetchDedup(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

function queryJson(url: string, param: string): unknown {
  const m = new RegExp(`[?&]${param}=([^&]+)`).exec(url);
  return m ? JSON.parse(decodeURIComponent(m[1])) : undefined;
}

function bodyOf(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

function loggedUserBody(user: string = ME) {
  return { status: 200, body: { message: user } };
}

async function resetState(): Promise<void> {
  resetSessionUserCache();
  invalidateCache();
  await settleFetchDedup();
}

/** Eén ruwe "Y Bericht"-rij zoals ERPNext hem teruggeeft. */
function rij(overrides: Record<string, unknown> = {}) {
  return {
    name: "YMSG-2026-000042",
    afzender: COLLEGA,
    ontvanger: ME,
    bericht: "<div>hallo &amp; welkom</div>",
    creation: "2026-09-21 06:46:02.773289",
    gelezen: 0,
    afbeelding: null,
    ...overrides,
  };
}

/* ─── Naamprefix ─── */

test("isArchiefNaam: herkent alleen het archief-prefix", () => {
  assert.equal(isArchiefNaam(`${ARCHIEF_PREFIX}YMSG-2026-000001`), true);
  assert.equal(isArchiefNaam("NL-0001"), false);
  assert.equal(isArchiefNaam(""), false);
});

/* ─── Mapping ─── */

test("archiefRowToMessage: inkomend bericht — richting, tegenpartij en gelezen-vlag uit de oude velden", () => {
  const bericht = archiefRowToMessage(rij(), ME);
  assert.ok(bericht);
  assert.equal(bericht.name, `${ARCHIEF_PREFIX}YMSG-2026-000042`);
  assert.equal(bericht.direction, "in");
  assert.equal(bericht.counterpart, COLLEGA);
  assert.equal(bericht.body, "hallo & welkom");
  assert.equal(bericht.createdAt, "2026-09-21 06:46:02.773289");
  assert.equal(bericht.read, false);
});

test("archiefRowToMessage: uitgaand bericht is per definitie gelezen", () => {
  const bericht = archiefRowToMessage(rij({ afzender: ME, ontvanger: COLLEGA, gelezen: 0 }), ME);
  assert.ok(bericht);
  assert.equal(bericht.direction, "out");
  assert.equal(bericht.counterpart, COLLEGA);
  assert.equal(bericht.read, true);
});

test("archiefRowToMessage: gelezen vinkje telt voor ontvangen berichten", () => {
  const bericht = archiefRowToMessage(rij({ gelezen: 1 }), ME);
  assert.ok(bericht);
  assert.equal(bericht.read, true);
});

test("archiefRowToMessage: andermans gesprekken, zelfberichten en kapotte rijen vallen af", () => {
  assert.equal(archiefRowToMessage(rij({ afzender: "a@x.nl", ontvanger: "b@x.nl" }), ME), null);
  assert.equal(archiefRowToMessage(rij({ afzender: ME, ontvanger: ME }), ME), null);
  assert.equal(archiefRowToMessage(rij({ name: "" }), ME), null);
  assert.equal(archiefRowToMessage(rij({ afzender: "" }), ME), null);
  assert.equal(archiefRowToMessage(rij({ ontvanger: "" }), ME), null);
});

test("archiefRowToMessage: alleen een eigen-origin afbeeldingspad komt mee", () => {
  const veilig = archiefRowToMessage(rij({ afbeelding: "/private/files/foto.jpg" }), ME);
  assert.deepEqual(veilig?.image, { url: "/private/files/foto.jpg", name: "foto.jpg" });

  const onveilig = archiefRowToMessage(rij({ afbeelding: "https://tracker.example/px.gif" }), ME);
  assert.ok(onveilig);
  assert.equal(onveilig.image, undefined);
});

test("archiefRowToMessage: beide gesprekspartners rekenen dezelfde sleutel uit", () => {
  const bijMij = archiefRowToMessage(rij(), ME);
  const bijCollega = archiefRowToMessage(rij(), COLLEGA);
  assert.ok(bijMij && bijCollega);
  assert.equal(bijMij.sleutel, bijCollega.sleutel);
});

/* ─── Lezen ─── */

test("listArchiefBerichten: vraagt alleen eigen gesprekken op en mapt de rijen", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) return loggedUserBody();
    if (url.startsWith(`/api/resource/${ARCHIEF_DOCTYPE}`)) {
      return { status: 200, body: { data: [rij(), rij({ afzender: "a@x.nl", ontvanger: "b@x.nl" })] } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const berichten = await listArchiefBerichten();

    const listCall = mock.calls.find((c) => c.url.startsWith(`/api/resource/${ARCHIEF_DOCTYPE}`));
    assert.ok(listCall);
    const orFilters = (queryJson(listCall.url, "or_filters") as unknown[][]) ?? [];
    assert.ok(orFilters.some((f) => f[0] === "afzender" && f[1] === "=" && f[2] === ME));
    assert.ok(orFilters.some((f) => f[0] === "ontvanger" && f[1] === "=" && f[2] === ME));

    // De rij van andermans gesprek is door de mapping afgevallen.
    assert.equal(berichten.length, 1);
    assert.equal(berichten[0].name, `${ARCHIEF_PREFIX}YMSG-2026-000042`);
  } finally {
    mock.restore();
    await resetState();
  }
});

test("listArchiefBerichten: zonder sessie geen request en een lege lijst", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) {
      return { status: 200, body: { message: "Guest" } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    assert.deepEqual(await listArchiefBerichten(), []);
    assert.ok(!mock.calls.some((c) => c.url.startsWith(`/api/resource/${ARCHIEF_DOCTYPE}`)));
  } finally {
    mock.restore();
    await resetState();
  }
});

test("listArchiefBerichten: een fout (geen leesrecht, doctype weg) degradeert naar een lege lijst", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) return loggedUserBody();
    if (url.startsWith(`/api/resource/${ARCHIEF_DOCTYPE}`)) {
      return { status: 403, body: { exception: "frappe.exceptions.PermissionError" } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    assert.deepEqual(await listArchiefBerichten(), []);
  } finally {
    mock.restore();
    await resetState();
  }
});

/* ─── Gelezen markeren ─── */

test("markeerArchiefGelezen: stript het prefix, zet gelezen=1 en slaat niet-archief-namen over", async () => {
  await resetState();
  const mock = installFetchMock((url, init) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) return loggedUserBody();
    if (url.startsWith(`/api/resource/${ARCHIEF_DOCTYPE}/`) && init?.method === "PUT") {
      return { status: 200, body: { data: {} } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    await markeerArchiefGelezen([`${ARCHIEF_PREFIX}YMSG-2026-000042`, "NL-0001"]);

    const puts = mock.calls.filter((c) => c.init?.method === "PUT");
    assert.equal(puts.length, 1);
    assert.ok(puts[0].url.startsWith(`/api/resource/${ARCHIEF_DOCTYPE}/YMSG-2026-000042`));
    assert.equal(bodyOf(puts[0].init).gelezen, 1);
  } finally {
    mock.restore();
    await resetState();
  }
});

/* ─── Integratie met de messenger ─── */

test("listMessages: archiefberichten schuiven op datum tussen de nieuwe berichten", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) return loggedUserBody();
    if (url.startsWith(`/api/resource/${ARCHIEF_DOCTYPE}`)) {
      return { status: 200, body: { data: [rij({ creation: "2026-09-10 08:00:00.000000" })] } };
    }
    if (url.startsWith(`/api/resource/${MESSAGE_DOCTYPE}`)) {
      return {
        status: 200,
        body: {
          data: [
            {
              name: "NL-nieuw",
              subject: "nieuw",
              email_content: "<div>nieuw</div>",
              for_user: ME,
              document_name: COLLEGA,
              owner: COLLEGA,
              creation: "2026-09-22 09:00:00.000000",
              link: "/y-next#/messenger",
              read: 0,
            },
          ],
        },
      };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const messages = await listMessages();
    assert.deepEqual(
      messages.map((m) => m.name),
      ["NL-nieuw", `${ARCHIEF_PREFIX}YMSG-2026-000042`],
    );
  } finally {
    mock.restore();
    await resetState();
  }
});

test("markMessagesRead: archief-namen gaan naar Y Bericht, de rest naar Notification Log", async () => {
  await resetState();
  const mock = installFetchMock((url, init) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) return loggedUserBody();
    if (url.startsWith(`/api/resource/${ARCHIEF_DOCTYPE}/`) && init?.method === "PUT") {
      return { status: 200, body: { data: {} } };
    }
    if (url.startsWith("/api/method/frappe.desk.doctype.notification_log.notification_log.mark_as_read")) {
      return { status: 200, body: { message: null } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    await markMessagesRead([`${ARCHIEF_PREFIX}YMSG-2026-000042`, "NL-0001"]);

    const puts = mock.calls.filter((c) => c.init?.method === "PUT");
    assert.equal(puts.length, 1);
    assert.ok(puts[0].url.startsWith(`/api/resource/${ARCHIEF_DOCTYPE}/YMSG-2026-000042`));

    const markCalls = mock.calls.filter((c) =>
      c.url.startsWith("/api/method/frappe.desk.doctype.notification_log.notification_log.mark_as_read"),
    );
    assert.equal(markCalls.length, 1);
    assert.equal(bodyOf(markCalls[0].init).docname, "NL-0001");
  } finally {
    mock.restore();
    await resetState();
  }
});

test("verwijderKeuze: het archief is alleen-lezen en telt niet mee in de verwijderknop", () => {
  const keuze = verwijderKeuze([
    { name: `${ARCHIEF_PREFIX}YMSG-2026-000042`, direction: "out" },
    { name: "NL-0001", direction: "out" },
  ]);
  assert.equal(keuze.aantal, 1);
  assert.equal(keuze.voorIedereen, true);

  const alleenArchief = verwijderKeuze([{ name: `${ARCHIEF_PREFIX}YMSG-2026-000042`, direction: "out" }]);
  assert.equal(alleenArchief.aantal, 0);
  assert.equal(alleenArchief.voorIedereen, false);
});
