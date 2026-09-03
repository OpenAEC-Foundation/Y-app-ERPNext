/**
 * Tests voor de berichten-adapter.
 *
 * Zelfde opzet als `mail-erpnext.test.ts`: een fetch-stub die de ERPNext-API
 * nabootst, zodat de query's (filters, volgorde, velden) en de payloads van
 * de schrijfacties vastliggen. Het zwaartepunt ligt op de twee dingen die
 * stil kapot kunnen gaan: dat de afzender uit `owner` komt en nergens anders
 * vandaan, en dat de payload geen `owner` meestuurt.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { invalidateCache } from "./erpnext.ts";
import { resetSessionUserCache } from "./session.ts";
import {
  MESSAGE_DOCTYPE,
  MESSAGE_DOCUMENT_TYPE,
  MESSAGE_LINK,
  MESSAGE_TYPE,
  contactNameMap,
  countUnread,
  groupThreads,
  htmlToText,
  listContacts,
  listMessages,
  markMessagesRead,
  previewOf,
  rowToMessage,
  sendMessage,
  textToHtml,
  type ErpMessage,
} from "./messages-erpnext.ts";

const ME = "nino@3bm.co.nl";

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

function filtersOf(url: string): unknown[][] {
  return (queryJson(url, "filters") as unknown[][] | undefined) ?? [];
}

function hasFilter(url: string, field: string, op: string, value: unknown): boolean {
  return filtersOf(url).some(
    (f) => Array.isArray(f) && f[0] === field && f[1] === op && String(f[2]) === String(value)
  );
}

function bodyOf(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

/** Antwoord op `frappe.auth.get_logged_user`. */
function loggedUserBody(user: string = ME) {
  return { status: 200, body: { message: user } };
}

async function resetState(): Promise<void> {
  resetSessionUserCache();
  invalidateCache();
  await settleFetchDedup();
}

/** Eén ruwe Notification Log-rij zoals ERPNext hem teruggeeft. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    name: "NL-0001",
    subject: "Hallo",
    email_content: "<div>Hallo</div>",
    for_user: ME,
    document_name: "lara@3bm.co.nl",
    owner: "lara@3bm.co.nl",
    creation: "2026-09-03 10:00:00.000000",
    link: MESSAGE_LINK,
    read: 0,
    ...overrides,
  };
}

/* ─── Tekstconversie ─── */

test("textToHtml: escapet HTML zodat een bericht niets kan injecteren in de ERPNext-bel", () => {
  const html = textToHtml('<img src=x onerror="alert(1)"> & "quoted"');
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("&amp;"));
  assert.ok(html.includes("&quot;"));
});

test("textToHtml/htmlToText: regeleinden overleven de heen-en-weerweg", () => {
  const original = "regel 1\nregel 2\n\nregel 4";
  assert.equal(htmlToText(textToHtml(original)), original);
});

test("htmlToText: entiteiten worden in de juiste volgorde teruggedraaid", () => {
  // "&amp;lt;" mag géén echte "<" worden — anders is de escape zinloos.
  assert.equal(htmlToText("<div>a &amp;lt; b</div>"), "a &lt; b");
  assert.equal(htmlToText(textToHtml("a < b & c")), "a < b & c");
});

test("previewOf: kapt lange berichten af en maakt er één regel van", () => {
  assert.equal(previewOf("  twee   woorden \n hier "), "twee woorden hier");
  const long = "x".repeat(500);
  const preview = previewOf(long);
  assert.equal(preview.length, 140);
  assert.ok(preview.endsWith("…"));
});

/* ─── rowToMessage ─── */

test("rowToMessage: een rij van een ander is een ONTVANGEN bericht met owner als afzender", () => {
  const message = rowToMessage(row(), ME);
  assert.ok(message);
  assert.equal(message.direction, "in");
  assert.equal(message.counterpart, "lara@3bm.co.nl");
  assert.equal(message.body, "Hallo");
  assert.equal(message.read, false);
});

test("rowToMessage: een rij die je zelf bezit is je VERZONDEN kopie; de tegenpartij komt uit document_name", () => {
  const message = rowToMessage(
    row({ owner: ME, document_name: "lara@3bm.co.nl", read: 1 }),
    ME,
  );
  assert.ok(message);
  assert.equal(message.direction, "out");
  assert.equal(message.counterpart, "lara@3bm.co.nl");
  assert.equal(message.read, true);
});

test("rowToMessage: document_name wordt NIET gebruikt om de afzender van inkomende post te bepalen", () => {
  // Zou iemand `document_name` vervalsen, dan verandert er niets aan wie er
  // als afzender getoond wordt — dat blijft `owner`, en die zet Frappe zelf.
  const message = rowToMessage(row({ document_name: "directie@3bm.co.nl" }), ME);
  assert.ok(message);
  assert.equal(message.counterpart, "lara@3bm.co.nl");
});

test("rowToMessage: rijen zonder ons link-merk of voor iemand anders vallen af", () => {
  assert.equal(rowToMessage(row({ link: null }), ME), null);
  assert.equal(rowToMessage(row({ link: "/app/user" }), ME), null);
  assert.equal(rowToMessage(row({ for_user: "iemand@anders.nl" }), ME), null);
  assert.equal(rowToMessage(row({ owner: "" }), ME), null);
  // Verzonden kopie zonder tegenpartij is onbruikbaar.
  assert.equal(rowToMessage(row({ owner: ME, document_name: "" }), ME), null);
});

test("rowToMessage: zonder email_content valt hij terug op subject", () => {
  const message = rowToMessage(row({ email_content: "" }), ME);
  assert.ok(message);
  assert.equal(message.body, "Hallo");
});

/* ─── groupThreads / countUnread ─── */

function msg(overrides: Partial<ErpMessage>): ErpMessage {
  return {
    name: "NL-x",
    counterpart: "lara@3bm.co.nl",
    direction: "in",
    body: "tekst",
    createdAt: "2026-09-03 10:00:00.000000",
    read: false,
    ...overrides,
  };
}

test("groupThreads: groepeert per collega, nieuwste gesprek bovenaan, met naam uit de contactmap", () => {
  const threads = groupThreads(
    [
      msg({ name: "a", counterpart: "lara@3bm.co.nl", createdAt: "2026-09-03 10:00:00" }),
      msg({ name: "b", counterpart: "nino2@3bm.co.nl", createdAt: "2026-09-03 12:00:00", body: "later" }),
      msg({ name: "c", counterpart: "lara@3bm.co.nl", createdAt: "2026-09-03 09:00:00" }),
    ],
    { "lara@3bm.co.nl": "Lara Nazari" },
  );

  assert.equal(threads.length, 2);
  assert.equal(threads[0].counterpart, "nino2@3bm.co.nl");
  // Zonder naam in de map blijft de user-id staan — beter dan een leeg vakje.
  assert.equal(threads[0].counterpartName, "nino2@3bm.co.nl");
  assert.equal(threads[0].lastBody, "later");
  assert.equal(threads[1].counterpartName, "Lara Nazari");
  // Binnen een gesprek: nieuwste eerst.
  assert.deepEqual(threads[1].messages.map((m) => m.name), ["a", "c"]);
});

test("groupThreads + countUnread: alleen ontvangen ongelezen post telt mee", () => {
  const messages = [
    msg({ name: "a", direction: "in", read: false }),
    msg({ name: "b", direction: "in", read: true }),
    // Een verzonden kopie die per ongeluk read=0 kreeg mag nooit meetellen.
    msg({ name: "c", direction: "out", read: false }),
  ];
  assert.equal(countUnread(messages), 1);
  assert.equal(groupThreads(messages)[0].unread, 1);
});

/* ─── listMessages ─── */

test("listMessages: filtert server-side op eigen postvak + ons type-merk en sorteert nieuwste eerst", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) return loggedUserBody();
    if (url.startsWith(`/api/resource/${MESSAGE_DOCTYPE}`)) {
      return {
        status: 200,
        body: {
          data: [
            row({ name: "NL-nieuw", creation: "2026-09-03 12:00:00.000000", email_content: "<div>nieuw</div>" }),
            row({ name: "NL-oud", creation: "2026-09-01 08:00:00.000000", owner: ME, document_name: "lara@3bm.co.nl", read: 1 }),
          ],
        },
      };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const messages = await listMessages();

    const listCall = mock.calls.find((c) => c.url.startsWith(`/api/resource/${MESSAGE_DOCTYPE}`));
    assert.ok(listCall);
    // `for_user` staat expliciet in de query: Administrator wordt door
    // Frappe's permission_query_condition overgeslagen en zou anders
    // andermans berichten zien.
    assert.ok(hasFilter(listCall.url, "for_user", "=", ME));
    assert.ok(hasFilter(listCall.url, "type", "=", MESSAGE_TYPE));
    assert.ok(hasFilter(listCall.url, "document_type", "=", MESSAGE_DOCUMENT_TYPE));
    assert.match(listCall.url, /order_by=creation(\+|%20)desc/);

    assert.deepEqual(messages.map((m) => m.name), ["NL-nieuw", "NL-oud"]);
    assert.equal(messages[0].direction, "in");
    assert.equal(messages[1].direction, "out");
  } finally {
    mock.restore();
    await resetState();
  }
});

test("listMessages: zonder sessie geen request en een lege lijst", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) {
      return { status: 200, body: { message: "Guest" } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    assert.deepEqual(await listMessages(), []);
    assert.ok(!mock.calls.some((c) => c.url.startsWith(`/api/resource/${MESSAGE_DOCTYPE}`)));
  } finally {
    mock.restore();
    await resetState();
  }
});

/* ─── sendMessage ─── */

test("sendMessage: schrijft twee documenten en stuurt NOOIT een owner mee", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) return loggedUserBody();
    if (url.startsWith(`/api/resource/${MESSAGE_DOCTYPE}`)) {
      return { status: 200, body: { data: { name: "NL-new" } } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    await sendMessage("lara@3bm.co.nl", "Hoi Lara");

    const posts = mock.calls.filter((c) => c.init?.method === "POST");
    assert.equal(posts.length, 2);

    const [recipientCopy, sentCopy] = posts.map((c) => bodyOf(c.init));

    // Ontvangerskopie: in háár postvak, ongelezen.
    assert.equal(recipientCopy.for_user, "lara@3bm.co.nl");
    assert.equal(recipientCopy.document_name, ME);
    assert.equal(recipientCopy.read, 0);

    // Eigen verzonden kopie: in mijn postvak, meteen gelezen zodat hij niet
    // als ongelezen bericht in de bel/teller belandt.
    assert.equal(sentCopy.for_user, ME);
    assert.equal(sentCopy.document_name, "lara@3bm.co.nl");
    assert.equal(sentCopy.read, 1);

    for (const payload of [recipientCopy, sentCopy]) {
      // De kern van de beveiliging: de afzender wordt niet meegestuurd.
      // Frappe zet `owner` zelf op de sessiegebruiker.
      assert.equal("owner" in payload, false);
      assert.equal(payload.type, MESSAGE_TYPE);
      assert.equal(payload.document_type, MESSAGE_DOCUMENT_TYPE);
      assert.equal(payload.link, MESSAGE_LINK);
      assert.equal(payload.email_content, "<div>Hoi Lara</div>");
    }
  } finally {
    mock.restore();
    await resetState();
  }
});

test("sendMessage: een mislukte eigen kopie maakt de aflevering niet ongedaan", async () => {
  await resetState();
  let posts = 0;
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) return loggedUserBody();
    if (url.startsWith(`/api/resource/${MESSAGE_DOCTYPE}`)) {
      posts += 1;
      if (posts === 2) return { status: 500, body: { exception: "boem" } };
      return { status: 200, body: { data: { name: "NL-new" } } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    await sendMessage("lara@3bm.co.nl", "Hoi");
    assert.equal(posts, 2);
  } finally {
    mock.restore();
    await resetState();
  }
});

test("sendMessage: lege tekst of lege ontvanger doet niets", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) return loggedUserBody();
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    await sendMessage("lara@3bm.co.nl", "   ");
    await sendMessage("", "iets");
    assert.equal(mock.calls.filter((c) => c.init?.method === "POST").length, 0);
  } finally {
    mock.restore();
    await resetState();
  }
});

/* ─── markMessagesRead ─── */

test("markMessagesRead: gebruikt de mark_as_read-RPC (die zelf op for_user filtert), niet een PUT", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.includes("notification_log.mark_as_read")) return { status: 200, body: { message: null } };
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    await markMessagesRead(["NL-1", "NL-2"]);
    const rpcCalls = mock.calls.filter((c) => c.url.includes("mark_as_read"));
    assert.equal(rpcCalls.length, 2);
    assert.deepEqual(rpcCalls.map((c) => bodyOf(c.init).docname).sort(), ["NL-1", "NL-2"]);
    assert.ok(!mock.calls.some((c) => c.init?.method === "PUT"));
  } finally {
    mock.restore();
    await resetState();
  }
});

test("markMessagesRead: valt terug op een documentupdate als de RPC weigert, en gooit niet", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.includes("notification_log.mark_as_read")) return { status: 403, body: { exception: "nee" } };
    if (url.startsWith(`/api/resource/${MESSAGE_DOCTYPE}/`)) return { status: 200, body: { data: { name: "NL-1" } } };
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    await markMessagesRead(["NL-1"]);
    assert.ok(mock.calls.some((c) => c.init?.method === "PUT" && bodyOf(c.init).read === 1));
  } finally {
    mock.restore();
    await resetState();
  }
});

test("markMessagesRead: een lege lijst doet geen enkele call", async () => {
  await resetState();
  const mock = installFetchMock((url) => { throw new Error(`unexpected url: ${url}`); });
  try {
    await markMessagesRead([]);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
    await resetState();
  }
});

/* ─── listContacts ─── */

test("listContacts: voegt Employee en User samen, zonder jezelf en zonder Administrator", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) return loggedUserBody();
    if (url.startsWith("/api/resource/Employee")) {
      return {
        status: 200,
        body: {
          data: [
            { user_id: "lara@3bm.co.nl", employee_name: "Lara N." },
            { user_id: ME, employee_name: "Nino van Kleef" },
          ],
        },
      };
    }
    if (url.startsWith("/api/resource/User")) {
      return {
        status: 200,
        body: {
          data: [
            { name: "lara@3bm.co.nl", full_name: "Lara Nazari" },
            { name: "Administrator", full_name: "Administrator" },
            { name: "jeroen@3bm.co.nl", full_name: "Jeroen Daane" },
          ],
        },
      };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const contacts = await listContacts();
    assert.deepEqual(contacts.map((c) => c.user), ["jeroen@3bm.co.nl", "lara@3bm.co.nl"]);
    // User.full_name wint van Employee.employee_name.
    assert.equal(contacts[1].fullName, "Lara Nazari");
    assert.deepEqual(contactNameMap(contacts)["jeroen@3bm.co.nl"], "Jeroen Daane");
  } finally {
    mock.restore();
    await resetState();
  }
});

test("listContacts: een 403 op User (de normale situatie voor een medewerker) laat Employee staan", async () => {
  await resetState();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.auth.get_logged_user")) return loggedUserBody();
    if (url.startsWith("/api/resource/Employee")) {
      return { status: 200, body: { data: [{ user_id: "lara@3bm.co.nl", employee_name: "Lara N." }] } };
    }
    if (url.startsWith("/api/resource/User")) {
      return { status: 403, body: { exception: "PermissionError" } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const contacts = await listContacts();
    assert.deepEqual(contacts, [{ user: "lara@3bm.co.nl", fullName: "Lara N." }]);
  } finally {
    mock.restore();
    await resetState();
  }
});
