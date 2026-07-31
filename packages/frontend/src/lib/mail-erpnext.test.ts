import { test } from "node:test";
import assert from "node:assert/strict";
import { invalidateCache } from "./erpnext.ts";
import {
  listVirtualFolders,
  listMailboxMessages,
  getMessageBody,
  markRead,
  markUnread,
  sendMail,
  linkToDocument,
  unseenCount,
  hasEnabledEmailAccount,
} from "./mail-erpnext.ts";

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

/** Parse a JSON-encoded query parameter (fields / filters / or_filters). */
function queryJson(url: string, param: string): unknown {
  const m = new RegExp(`[?&]${param}=([^&]+)`).exec(url);
  return m ? JSON.parse(decodeURIComponent(m[1])) : undefined;
}

/**
 * erpnext.ts houdt een afgeronde request nog 100 ms in zijn in-flight-
 * dedupmap. Tests die dezelfde URL met een ánder antwoord opnieuw moeten
 * bevragen, moeten dat venster dus uitzitten — `invalidateCache` raakt
 * alleen de responscache, niet de dedupmap.
 */
function settleFetchDedup(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

function filtersOf(url: string): unknown[][] {
  return (queryJson(url, "filters") as unknown[][] | undefined) ?? [];
}

function hasFilter(url: string, field: string, op: string, value: unknown): boolean {
  return filtersOf(url).some(
    (f) => Array.isArray(f) && f[0] === field && f[1] === op && String(f[2]) === String(value)
  );
}

/**
 * Deterministic backend stub shared by the folder/count tests: identical
 * request URLs must always produce identical answers, because erpnext.ts
 * caches GET responses for 30s across calls (and therefore across tests).
 */
function countFor(url: string): number {
  const doctypeMatch = /doctype=([^&]+)/.exec(url);
  const doctype = doctypeMatch ? decodeURIComponent(doctypeMatch[1]) : "";
  if (doctype !== "Communication") return 0;
  const filters = filtersOf(url);
  const isProject = filters.some((f) => Array.isArray(f) && f[0] === "reference_name");
  return isProject ? 2 : 7;
}

test("listVirtualFolders: Inbox/Verzonden/Ongelezen plus projectmappen, tellingen via get_count (nooit een SQL-aggregate)", async () => {
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.client.get_count")) {
      return { status: 200, body: { message: countFor(url) } };
    }
    if (url.startsWith("/api/resource/Communication")) {
      return {
        status: 200,
        body: {
          data: [
            { reference_name: "PROJ-0001" },
            { reference_name: "PROJ-0002" },
            { reference_name: "PROJ-0001" },
          ],
        },
      };
    }
    if (url.startsWith("/api/resource/Project")) {
      return {
        status: 200,
        body: {
          data: [
            { name: "PROJ-0001", project_name: "Kade Noord" },
            { name: "PROJ-0002", project_name: "" },
          ],
        },
      };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const folders = await listVirtualFolders();

    const inbox = folders.find((f) => f.kind === "inbox");
    const sent = folders.find((f) => f.kind === "sent");
    const unread = folders.find((f) => f.kind === "unread");
    assert.ok(inbox && sent && unread);
    assert.equal(inbox.id, "INBOX");
    assert.equal(sent.id, "Sent");
    assert.equal(unread.id, "unread");
    assert.equal(inbox.unseen, 7);
    assert.equal(unread.unseen, 7);
    assert.equal(sent.unseen, 0);

    const projects = folders.filter((f) => f.kind === "project");
    assert.equal(projects.length, 2, "duplicate reference_name rows collapse to one folder each");
    assert.equal(projects[0].id, "project:PROJ-0001");
    assert.equal(projects[0].project, "PROJ-0001");
    assert.equal(projects[0].label, "Kade Noord");
    assert.equal(projects[0].unseen, 2);
    // Project zonder project_name valt terug op de docname als label.
    assert.equal(projects[1].label, "PROJ-0002");

    // Geen enkele call mag een SQL-aggregate in `fields` smokkelen (417 op v16).
    for (const call of mock.calls) {
      assert.doesNotMatch(call.url, /count%28|count\(/i);
    }
    // De projectdiscovery vraagt om Communications met een Project-referentie.
    const discovery = mock.calls.find((c) => c.url.startsWith("/api/resource/Communication"));
    assert.ok(discovery);
    assert.ok(hasFilter(discovery.url, "reference_doctype", "=", "Project"));
  } finally {
    mock.restore();
  }
});

test("listMailboxMessages: INBOX filtert op Received en mapt Communication-velden naar ErpMailMessage", async () => {
  const mock = installFetchMock(() => ({
    status: 200,
    body: {
      data: [
        {
          name: "COMM-0001",
          subject: "Offerte",
          sender: "jan@example.com",
          sender_full_name: "Jan Jansen",
          recipients: "info@open-aec.com",
          cc: "piet@example.com",
          communication_date: "2026-07-30 09:12:00",
          seen: 0,
          has_attachment: 1,
          in_reply_to: "COMM-0000",
          reference_doctype: "Project",
          reference_name: "PROJ-0001",
        },
      ],
    },
  }));
  try {
    const msgs = await listMailboxMessages("INBOX", { limit: 25, start: 50 });
    assert.equal(msgs.length, 1);
    assert.deepEqual(msgs[0], {
      name: "COMM-0001",
      subject: "Offerte",
      sender: "jan@example.com",
      senderName: "Jan Jansen",
      recipients: "info@open-aec.com",
      cc: "piet@example.com",
      date: "2026-07-30 09:12:00",
      seen: false,
      folder: "INBOX",
      hasAttachments: true,
      inReplyTo: "COMM-0000",
      reference: { doctype: "Project", name: "PROJ-0001" },
    });

    const url = mock.calls[0].url;
    assert.match(url, /^\/api\/resource\/Communication\?/);
    assert.ok(hasFilter(url, "communication_type", "=", "Communication"));
    assert.ok(hasFilter(url, "sent_or_received", "=", "Received"));
    assert.match(url, /limit_page_length=25/);
    assert.match(url, /limit_start=50/);
    assert.match(url, /order_by=communication_date\+desc|order_by=communication_date%20desc/);
    assert.equal(mock.calls[0].init?.credentials, "same-origin");
  } finally {
    mock.restore();
  }
});

test("listMailboxMessages: Sent, unread en projectmap gebruiken hun eigen filters", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { data: [] } }));
  try {
    await listMailboxMessages("Sent");
    assert.ok(hasFilter(mock.calls[0].url, "sent_or_received", "=", "Sent"));

    await listMailboxMessages("unread");
    assert.ok(hasFilter(mock.calls[1].url, "sent_or_received", "=", "Received"));
    assert.ok(hasFilter(mock.calls[1].url, "seen", "=", 0));

    await listMailboxMessages("project:PROJ-0007");
    assert.ok(hasFilter(mock.calls[2].url, "reference_doctype", "=", "Project"));
    assert.ok(hasFilter(mock.calls[2].url, "reference_name", "=", "PROJ-0007"));
  } finally {
    mock.restore();
  }
});

test("listMailboxMessages: search voegt or_filters op subject/sender toe, zonder de mapfilters te verliezen", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { data: [] } }));
  try {
    await listMailboxMessages("INBOX", { search: "offerte" });
    const url = mock.calls[0].url;
    assert.ok(hasFilter(url, "sent_or_received", "=", "Received"));
    const orFilters = queryJson(url, "or_filters") as unknown[][];
    assert.ok(Array.isArray(orFilters));
    assert.ok(orFilters.some((f) => f[0] === "subject" && f[1] === "like" && f[2] === "%offerte%"));
    assert.ok(orFilters.some((f) => f[0] === "sender" && f[1] === "like" && f[2] === "%offerte%"));
  } finally {
    mock.restore();
  }
});

test("getMessageBody: levert content-HTML plus de File-bijlagen van de Communication", async () => {
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/resource/Communication/")) {
      return { status: 200, body: { data: { name: "COMM-0042", content: "<p>Hallo</p>" } } };
    }
    if (url.startsWith("/api/resource/File")) {
      return {
        status: 200,
        body: {
          data: [
            { name: "FILE-1", file_name: "offerte.pdf", file_url: "/private/files/offerte.pdf", file_size: 10, is_private: 1 },
          ],
        },
      };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const body = await getMessageBody("COMM-0042");
    assert.equal(body.html, "<p>Hallo</p>");
    assert.deepEqual(body.attachments, [{ file_url: "/private/files/offerte.pdf", file_name: "offerte.pdf" }]);
    const fileCall = mock.calls.find((c) => c.url.startsWith("/api/resource/File"));
    assert.ok(fileCall);
    assert.ok(hasFilter(fileCall.url, "attached_to_doctype", "=", "Communication"));
    assert.ok(hasFilter(fileCall.url, "attached_to_name", "=", "COMM-0042"));
  } finally {
    mock.restore();
  }
});

test("markRead / markUnread: PUT op de Communication met seen 1 respectievelijk 0", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { data: { name: "COMM-0001" } } }));
  try {
    await markRead("COMM-0001");
    assert.equal(mock.calls[0].url, "/api/resource/Communication/COMM-0001");
    assert.equal(mock.calls[0].init?.method, "PUT");
    assert.deepEqual(JSON.parse(String(mock.calls[0].init?.body)), { seen: 1 });

    await markUnread("COMM-0001");
    assert.equal(mock.calls[1].init?.method, "PUT");
    assert.deepEqual(JSON.parse(String(mock.calls[1].init?.body)), { seen: 0 });
  } finally {
    mock.restore();
  }
});

test("linkToDocument: zet reference_doctype/reference_name op de Communication", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { data: { name: "COMM-0009" } } }));
  try {
    await linkToDocument("COMM-0009", "Project", "PROJ-0003");
    assert.equal(mock.calls[0].url, "/api/resource/Communication/COMM-0009");
    assert.equal(mock.calls[0].init?.method, "PUT");
    assert.deepEqual(JSON.parse(String(mock.calls[0].init?.body)), {
      reference_doctype: "Project",
      reference_name: "PROJ-0003",
    });
  } finally {
    mock.restore();
  }
});

test("sendMail: uploadt bijlagen privé en geeft de File-docnames door aan communication.email.make", async () => {
  const mock = installFetchMock((url) => {
    if (url === "/api/method/upload_file") {
      return { status: 200, body: { message: { name: "FILE-77", file_name: "bijlage.pdf", file_url: "/private/files/bijlage.pdf" } } };
    }
    if (url === "/api/method/frappe.core.doctype.communication.email.make") {
      return { status: 200, body: { message: { name: "COMM-1234", emails_not_sent_to: [] } } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const res = await sendMail({
      to: "klant@example.com",
      cc: "collega@example.com",
      subject: "Offerte 2026",
      html: "<p>Bijgaand</p>",
      attachments: [new File(["pdf-bytes"], "bijlage.pdf", { type: "application/pdf" })],
      reference: { doctype: "Project", name: "PROJ-0001" },
    });
    assert.deepEqual(res, { name: "COMM-1234" });

    assert.equal(mock.calls[0].url, "/api/method/upload_file", "bijlagen gaan eerst omhoog");
    const upload = mock.calls[0].init?.body as FormData;
    assert.equal(upload.get("is_private"), "1");
    assert.equal(upload.get("doctype"), "Project");
    assert.equal(upload.get("docname"), "PROJ-0001");

    const makeCall = mock.calls[1];
    assert.equal(makeCall.url, "/api/method/frappe.core.doctype.communication.email.make");
    assert.equal(makeCall.init?.method, "POST");
    const args = JSON.parse(String(makeCall.init?.body));
    assert.deepEqual(args.attachments, ["FILE-77"]);
    assert.equal(args.doctype, "Project");
    assert.equal(args.name, "PROJ-0001");
    assert.equal(args.recipients, "klant@example.com");
    assert.equal(args.cc, "collega@example.com");
    assert.equal(args.subject, "Offerte 2026");
    assert.equal(args.content, "<p>Bijgaand</p>");
    assert.equal(args.send_email, 1);
    assert.equal(args.communication_medium, "Email");
    assert.equal(args.sent_or_received, "Sent");
  } finally {
    mock.restore();
  }
});

test("sendMail: zonder referentie geen doctype/name-koppeling, en een reply zet in_reply_to op de nieuwe Communication", async () => {
  const mock = installFetchMock((url) => {
    if (url === "/api/method/frappe.core.doctype.communication.email.make") {
      return { status: 200, body: { message: { name: "COMM-2000" } } };
    }
    if (url.startsWith("/api/resource/Communication/")) {
      return { status: 200, body: { data: { name: "COMM-2000" } } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const res = await sendMail({
      to: "klant@example.com",
      subject: "Re: Offerte",
      html: "<p>Antwoord</p>",
      inReplyTo: "COMM-0001",
    });
    assert.deepEqual(res, { name: "COMM-2000" });

    const args = JSON.parse(String(mock.calls[0].init?.body));
    assert.equal(args.doctype, "");
    assert.equal(args.name, "");
    assert.deepEqual(args.attachments, []);

    // `communication.email.make` kent geen in_reply_to-argument; de
    // threading-link wordt daarom na afloop op het document gezet.
    assert.equal(mock.calls[1].url, "/api/resource/Communication/COMM-2000");
    assert.equal(mock.calls[1].init?.method, "PUT");
    assert.deepEqual(JSON.parse(String(mock.calls[1].init?.body)), { in_reply_to: "COMM-0001" });
  } finally {
    mock.restore();
  }
});

test("sendMail: invalideert de Communication-responscache, ook zonder referentie of reply", async () => {
  // Eigen map-id zodat deze test zijn eigen cache-entry heeft en niet meelift
  // op (of vervuild wordt door) de lijst-calls van de andere tests.
  const folder = "project:PROJ-CACHE-0001";
  let listCalls = 0;
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/resource/Communication?")) {
      listCalls++;
      return { status: 200, body: { data: [] } };
    }
    if (url === "/api/method/frappe.core.doctype.communication.email.make") {
      return { status: 200, body: { message: { name: "COMM-3000" } } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    await listMailboxMessages(folder);
    assert.equal(listCalls, 1);
    await settleFetchDedup();

    // Zonder cache-invalidatie zou deze tweede lijst-call binnen 30 s uit de
    // responscache komen en het zojuist verzonden bericht dus missen.
    await listMailboxMessages(folder);
    assert.equal(listCalls, 1, "controle: de responscache serveert de tweede call normaal gesproken");
    await settleFetchDedup();

    await sendMail({ to: "klant@example.com", subject: "Nieuw", html: "<p>Hoi</p>" });

    await listMailboxMessages(folder);
    assert.equal(listCalls, 2, "na sendMail moet de lijst opnieuw van de server komen");
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("unseenCount: telt ongelezen ontvangen Communications via get_count", async () => {
  const mock = installFetchMock((url) => {
    assert.match(url, /^\/api\/method\/frappe\.client\.get_count\?/);
    return { status: 200, body: { message: countFor(url) } };
  });
  try {
    const count = await unseenCount();
    assert.equal(count, 7);
    const url = mock.calls[0]?.url ?? "";
    if (url) {
      // Kan uit de gedeelde 30s-responscache komen; alleen valideren als er
      // daadwerkelijk een request over de lijn ging.
      assert.ok(hasFilter(url, "seen", "=", 0));
      assert.ok(hasFilter(url, "sent_or_received", "=", "Received"));
    }
  } finally {
    mock.restore();
  }
});

test("hasEnabledEmailAccount: false zolang geen Email Account enable_incoming=1 heeft", async () => {
  invalidateCache("Email Account");
  await settleFetchDedup();
  const mock = installFetchMock((url) => {
    assert.match(url, /^\/api\/resource\/Email Account\?/);
    assert.ok(hasFilter(url, "enable_incoming", "=", 1));
    return { status: 200, body: { data: [] } };
  });
  try {
    assert.equal(await hasEnabledEmailAccount(), false);
  } finally {
    mock.restore();
  }
});

test("hasEnabledEmailAccount: true zodra er een account met enable_incoming=1 bestaat", async () => {
  invalidateCache("Email Account");
  await settleFetchDedup();
  const mock = installFetchMock(() => ({ status: 200, body: { data: [{ name: "OpenAEC Mail" }] } }));
  try {
    assert.equal(await hasEnabledEmailAccount(), true);
  } finally {
    mock.restore();
    invalidateCache("Email Account");
  }
});

test("hasEnabledEmailAccount: true bij 403 (geen leesrecht) — 'kan niet vaststellen' != 'niet geconfigureerd'", async () => {
  invalidateCache("Email Account");
  await settleFetchDedup();
  const mock = installFetchMock(() => ({ status: 403, body: { exception: "No permission" } }));
  try {
    assert.equal(await hasEnabledEmailAccount(), true);
  } finally {
    mock.restore();
    invalidateCache("Email Account");
  }
});

test("hasEnabledEmailAccount: false wanneer het DocType zelf ontbreekt (404 DoesNotExistError)", async () => {
  invalidateCache("Email Account");
  await settleFetchDedup();
  const mock = installFetchMock(() => ({
    status: 404,
    body: {
      exc_type: "DoesNotExistError",
      _server_messages: JSON.stringify([
        JSON.stringify({ message: "DocType Email Account not found", title: "Message" }),
      ]),
    },
  }));
  try {
    assert.equal(await hasEnabledEmailAccount(), false);
  } finally {
    mock.restore();
    invalidateCache("Email Account");
  }
});

test("hasEnabledEmailAccount: false bij een andere serverfout (5xx)", async () => {
  invalidateCache("Email Account");
  await settleFetchDedup();
  const mock = installFetchMock(() => ({ status: 500, body: { exception: "Internal Server Error" } }));
  try {
    assert.equal(await hasEnabledEmailAccount(), false);
  } finally {
    mock.restore();
    invalidateCache("Email Account");
  }
});
