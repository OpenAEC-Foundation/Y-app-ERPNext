import { test } from "node:test";
import assert from "node:assert/strict";
import { invalidateCache } from "./erpnext.ts";
import { resetSessionUserCache } from "./session.ts";
import {
  listVirtualFolders,
  listMailboxMessages,
  listMailboxMessagesPaged,
  searchMessages,
  getMessageBody,
  markRead,
  markUnread,
  moveToTrash,
  restoreFromTrash,
  deleteForever,
  bulkMoveToTrash,
  bulkRestoreFromTrash,
  bulkDeleteForever,
  listImapFolders,
  bulkMarkRead,
  bulkMarkUnread,
  getConversation,
  getSignature,
  resetSignatureCache,
  getQueueStatusFor,
  listCustomFolders,
  createCustomFolder,
  deleteCustomFolder,
  tagMessage,
  untagMessage,
  sendMail,
  linkToDocument,
  unseenCount,
  hasEnabledEmailAccount,
  MAIL_FOLDER_TRASH,
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

/** Waarde van de eerste filter op `field` (bv. de lijst achter een `in`). */
function filterValue(url: string, field: string): unknown {
  const f = filtersOf(url).find((x) => Array.isArray(x) && x[0] === field);
  return Array.isArray(f) ? f[2] : undefined;
}

function orFiltersOf(url: string): unknown[][] {
  return (queryJson(url, "or_filters") as unknown[][] | undefined) ?? [];
}

function hasOrFilter(url: string, field: string, value: unknown): boolean {
  return orFiltersOf(url).some(
    (f) => Array.isArray(f) && f[0] === field && f[1] === "like" && f[2] === value
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
  const isTrash = filters.some((f) => Array.isArray(f) && f[0] === "email_status" && f[1] === "=");
  if (isTrash) return 3;
  const isProject = filters.some((f) => Array.isArray(f) && f[0] === "reference_name");
  return isProject ? 2 : 7;
}

test("listVirtualFolders: Inbox/Verzonden/Ongelezen/Prullenbak plus projectmappen, tellingen via get_count (nooit een SQL-aggregate)", async () => {
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
    const trash = folders.find((f) => f.kind === "trash");
    assert.ok(inbox && sent && unread && trash);
    assert.equal(inbox.id, "INBOX");
    assert.equal(sent.id, "Sent");
    assert.equal(unread.id, "unread");
    assert.equal(trash.id, MAIL_FOLDER_TRASH);
    assert.equal(inbox.unseen, 7);
    assert.equal(unread.unseen, 7);
    assert.equal(sent.unseen, 0);
    // De Prullenbak telt zijn eigen ongelezen berichten, niet die van INBOX.
    assert.equal(trash.unseen, 3);

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
    // Weggegooide mail hoort in geen enkele gewone map thuis.
    assert.ok(hasFilter(url, "email_status", "!=", "Trash"));
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

    await listMailboxMessages("tag:Klanten");
    assert.ok(hasFilter(mock.calls[3].url, "_user_tags", "like", "%mail/Klanten%"));

    // Élke van die mappen sluit de prullenbak uit — anders zou een
    // weggegooide mail per map iets anders betekenen.
    for (const call of mock.calls) {
      assert.ok(hasFilter(call.url, "email_status", "!=", "Trash"), call.url);
    }
  } finally {
    mock.restore();
  }
});

test("listMailboxMessages: de Prullenbak filtert op email_status=Trash en beperkt de richting NIET", async () => {
  const mock = installFetchMock(() => ({
    status: 200,
    body: {
      data: [
        { name: "COMM-TR-1", subject: "Weg", communication_date: "2026-07-01 10:00:00", seen: 1 },
      ],
    },
  }));
  try {
    const msgs = await listMailboxMessages(MAIL_FOLDER_TRASH);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].folder, MAIL_FOLDER_TRASH);

    const url = mock.calls[0].url;
    assert.ok(hasFilter(url, "communication_type", "=", "Communication"));
    assert.ok(hasFilter(url, "email_status", "=", "Trash"));
    // Zowel weggegooide ontvangen als verzonden mail hoort hier te staan.
    assert.equal(
      filtersOf(url).some((f) => Array.isArray(f) && f[0] === "sent_or_received"),
      false
    );
    // En de uitsluitingsfilter mag hier natuurlijk juist NIET staan.
    assert.equal(hasFilter(url, "email_status", "!=", "Trash"), false);
  } finally {
    mock.restore();
  }
});

test("searchMessages: zoekt niet in de prullenbak en tagt een getrashte rij als zodanig", async () => {
  const mock = installFetchMock(() => ({
    status: 200,
    body: {
      data: [
        { name: "COMM-S1", subject: "Offerte", sent_or_received: "Sent", communication_date: "2026-07-02 08:00:00" },
        { name: "COMM-S2", subject: "Offerte", sent_or_received: "Received", email_status: "Trash", communication_date: "2026-07-01 08:00:00" },
      ],
    },
  }));
  try {
    const rows = await searchMessages("offerte");
    assert.ok(hasFilter(mock.calls[0].url, "email_status", "!=", "Trash"));
    assert.equal(rows[0].folder, "Sent");
    // Zou de server toch een getrashte rij teruggeven (andere backend, oude
    // cache), dan wijst de map naar de Prullenbak in plaats van naar INBOX.
    assert.equal(rows[1].folder, MAIL_FOLDER_TRASH);
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

/*
 * De getSignature-tests staan bewust vóór de 404-test hieronder: die
 * markeert `Email Account` als ontbrekend DocType, en erpnext.ts houdt dat
 * voor de rest van het proces vast (geen netwerkcall meer, altijd een lege
 * lijst). Verplaatst naar achteren zouden ze stil op die cache lopen.
 */
/**
 * `getSignature` onthoudt zijn antwoord voor de duur van de sessie en
 * `session.ts` onthoudt de ingelogde user. Elke test hieronder moet dus met
 * een schone lei beginnen, anders leest de tweede het antwoord van de eerste.
 */
async function resetSignatureState(): Promise<void> {
  resetSignatureCache();
  resetSessionUserCache();
  invalidateCache("Email Account");
  invalidateCache("User");
  await settleFetchDedup();
}

test("getSignature: de eigen User.email_signature gaat vóór het Email Account", async () => {
  await resetSignatureState();
  const mock = installFetchMock((url) => {
    if (url.includes("frappe.auth.get_logged_user")) {
      return { status: 200, body: { message: "bjorn@example.com" } };
    }
    if (url.startsWith("/api/resource/User/")) {
      return { status: 200, body: { data: { email_signature: "<p>Bjorn Fidder</p>" } } };
    }
    throw new Error(`Email Account had niet bevraagd mogen worden: ${url}`);
  });
  try {
    assert.equal(await getSignature(), "<p>Bjorn Fidder</p>");
    // Tweede aanroep komt uit de sessiecache — geen extra request.
    const before = mock.calls.length;
    assert.equal(await getSignature(), "<p>Bjorn Fidder</p>");
    assert.equal(mock.calls.length, before);
  } finally {
    mock.restore();
    await resetSignatureState();
  }
});

test("getSignature: valt terug op het standaard uitgaande Email Account zonder eigen handtekening", async () => {
  await resetSignatureState();
  const mock = installFetchMock((url) => {
    if (url.includes("frappe.auth.get_logged_user")) {
      return { status: 200, body: { message: "bjorn@example.com" } };
    }
    // Lege `email_signature` op de eigen User → doorlopen naar Email Account.
    if (url.startsWith("/api/resource/User/")) {
      return { status: 200, body: { data: { email_signature: "" } } };
    }
    assert.ok(hasFilter(url, "default_outgoing", "=", 1));
    return rowsBody([{ name: "OpenAEC Mail", signature: "<p>Met vriendelijke groet</p>" }]);
  });
  try {
    assert.equal(await getSignature(), "<p>Met vriendelijke groet</p>");
  } finally {
    mock.restore();
    await resetSignatureState();
  }
});

test("getSignature: 403 op de eigen User is geen fout — de terugval blijft werken", async () => {
  await resetSignatureState();
  const mock = installFetchMock((url) => {
    if (url.includes("frappe.auth.get_logged_user")) {
      return { status: 200, body: { message: "bjorn@example.com" } };
    }
    if (url.startsWith("/api/resource/User/")) {
      return { status: 403, body: { exception: "No permission" } };
    }
    return rowsBody([{ name: "OpenAEC Mail", signature: "<p>Groet</p>" }]);
  });
  try {
    assert.equal(await getSignature(), "<p>Groet</p>");
  } finally {
    mock.restore();
    await resetSignatureState();
  }
});

test("getSignature: lege string bij 403 en bij een account zonder handtekening", async () => {
  await resetSignatureState();
  const denied = installFetchMock(() => ({ status: 403, body: { exception: "No permission" } }));
  try {
    assert.equal(await getSignature(), "");
  } finally {
    denied.restore();
    await resetSignatureState();
  }

  const empty = installFetchMock((url) => {
    if (url.includes("frappe.auth.get_logged_user")) {
      return { status: 200, body: { message: "bjorn@example.com" } };
    }
    if (url.startsWith("/api/resource/User/")) {
      return { status: 200, body: { data: {} } };
    }
    return rowsBody([{ name: "OpenAEC Mail" }]);
  });
  try {
    assert.equal(await getSignature(), "");
  } finally {
    empty.restore();
    await resetSignatureState();
  }
});

/*
 * LET OP — deze `Email Account`-tests staan bewust vóór
 * "hasEnabledEmailAccount: false wanneer het DocType zelf ontbreekt". Die test
 * markeert `Email Account` via de 404-DoesNotExistError als ontbrekend
 * DocType, en `erpnext.ts` houdt dat voor de rest van het proces vast (geen
 * netwerkcall meer, altijd een lege lijst).
 */

test("listImapFolders: leest de imap_folder-child-table van elk incoming IMAP-account", async () => {
  invalidateCache("Email Account");
  await settleFetchDedup();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/resource/Email Account?")) {
      return rowsBody([{ name: "OpenAEC Mail" }]);
    }
    if (url.startsWith("/api/resource/Email%20Account/") || url.startsWith("/api/resource/Email Account/")) {
      return {
        status: 200,
        body: {
          data: {
            name: "OpenAEC Mail",
            imap_folder: [
              { folder_name: "INBOX", append_to: "" },
              { folder_name: "Projecten", append_to: "Issue" },
              // Rijen zonder mapnaam (of dubbel) horen niet in de lijst.
              { folder_name: "  ", append_to: "" },
              { folder_name: "INBOX", append_to: "" },
            ],
          },
        },
      };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const rows = await listImapFolders();
    assert.deepEqual(rows, [
      { account: "OpenAEC Mail", folderName: "INBOX" },
      { account: "OpenAEC Mail", folderName: "Projecten", appendTo: "Issue" },
    ]);
    const listCall = mock.calls.find((c) => c.url.startsWith("/api/resource/Email Account?"));
    assert.ok(listCall);
    assert.ok(hasFilter(listCall.url, "enable_incoming", "=", 1));
    assert.ok(hasFilter(listCall.url, "use_imap", "=", 1));
  } finally {
    mock.restore();
    invalidateCache("Email Account");
    await settleFetchDedup();
  }
});

test("listImapFolders: lege lijst bij 403 (Email Account is geen breed leesbaar DocType)", async () => {
  invalidateCache("Email Account");
  await settleFetchDedup();
  const forbidden = installFetchMock(() => ({ status: 403, body: { exception: "No permission" } }));
  try {
    assert.deepEqual(await listImapFolders(), []);
  } finally {
    forbidden.restore();
    invalidateCache("Email Account");
    await settleFetchDedup();
  }

  // Geen accounts -> geen doc-fetch, dus ook geen lege sectie met ruis.
  const none = installFetchMock(() => rowsBody([]));
  try {
    assert.deepEqual(await listImapFolders(), []);
    assert.equal(none.calls.length, 1);
  } finally {
    none.restore();
    invalidateCache("Email Account");
    await settleFetchDedup();
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

/* ───────────────────────── uitbouwslag A ───────────────────────── */

function rowsBody(rows: unknown[]): { status: number; body: unknown } {
  return { status: 200, body: { data: rows } };
}

test("listMailboxMessagesPaged: hasMore is waar zolang de server een volle pagina teruggeeft", async () => {
  const page = Array.from({ length: 3 }, (_, i) => ({
    name: `COMM-P${i}`,
    subject: "s",
    sender: "a@b.nl",
    communication_date: "2026-07-01 09:00:00",
    seen: 1,
  }));
  let call = 0;
  const mock = installFetchMock(() => rowsBody(call++ === 0 ? page : page.slice(0, 2)));
  try {
    const first = await listMailboxMessagesPaged("project:PROJ-PAGE-0001", { start: 0, limit: 3 });
    assert.equal(first.messages.length, 3);
    assert.equal(first.hasMore, true, "volle pagina ⇒ er kan nog meer zijn");
    assert.match(mock.calls[0].url, /limit_page_length=3/);
    assert.match(mock.calls[0].url, /limit_start=0/);

    const second = await listMailboxMessagesPaged("project:PROJ-PAGE-0001", { start: 3, limit: 3 });
    assert.equal(second.messages.length, 2);
    assert.equal(second.hasMore, false, "halve pagina ⇒ einde van de lijst");
    assert.match(mock.calls[1].url, /limit_start=3/);
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("listMailboxMessagesPaged: zoekterm gaat mee als or_filters, mapfilter blijft staan", async () => {
  const mock = installFetchMock(() => rowsBody([]));
  try {
    const res = await listMailboxMessagesPaged("Sent", { start: 0, limit: 10, search: "kade" });
    assert.deepEqual(res, { messages: [], hasMore: false });
    const url = mock.calls[0].url;
    assert.ok(hasFilter(url, "sent_or_received", "=", "Sent"));
    assert.ok(hasOrFilter(url, "subject", "%kade%"));
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("searchMessages: or_filters op subject/sender/recipients, map afgeleid uit sent_or_received", async () => {
  const mock = installFetchMock(() =>
    rowsBody([
      {
        name: "COMM-S1",
        subject: "Offerte kade",
        sender: "jan@example.com",
        sender_full_name: "Jan",
        recipients: "info@open-aec.com",
        communication_date: "2026-07-02 10:00:00",
        seen: 1,
        sent_or_received: "Received",
      },
      {
        name: "COMM-S2",
        subject: "Re: Offerte kade",
        sender: "info@open-aec.com",
        recipients: "jan@example.com",
        communication_date: "2026-07-03 10:00:00",
        seen: 1,
        sent_or_received: "Sent",
      },
    ])
  );
  try {
    const hits = await searchMessages("kade", { limit: 10 });
    assert.equal(hits.length, 2);
    assert.equal(hits[0].folder, "INBOX", "ontvangen treffer hoort bij Postvak IN");
    assert.equal(hits[1].folder, "Sent", "verzonden treffer hoort bij Verzonden");

    const url = mock.calls[0].url;
    assert.ok(hasFilter(url, "communication_type", "=", "Communication"));
    assert.ok(hasOrFilter(url, "subject", "%kade%"));
    assert.ok(hasOrFilter(url, "sender", "%kade%"));
    assert.ok(hasOrFilter(url, "recipients", "%kade%"));
    assert.ok(!hasOrFilter(url, "content", "%kade%"), "content blijft standaard buiten de zoekactie");
    assert.match(url, /limit_page_length=10/);
    // Zoeken is map-overstijgend: geen sent_or_received- of referentiefilter.
    // Wat er wél staat: het type-filter en de prullenbak-uitsluiting.
    assert.deepEqual(filtersOf(url), [
      ["communication_type", "=", "Communication"],
      ["email_status", "!=", "Trash"],
    ]);
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("searchMessages: lege zoekterm doet geen enkele call, includeContent voegt content toe", async () => {
  const mock = installFetchMock(() => rowsBody([]));
  try {
    assert.deepEqual(await searchMessages("   "), []);
    assert.equal(mock.calls.length, 0, "een lege zoekterm mag geen query kosten");

    await searchMessages("dijk", { includeContent: true });
    assert.ok(hasOrFilter(mock.calls[0].url, "content", "%dijk%"));
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("moveToTrash / restoreFromTrash: PUT op email_status, nooit een DELETE", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { data: { name: "COMM-T1" } } }));
  try {
    await moveToTrash("COMM-T1");
    assert.equal(mock.calls[0].url, "/api/resource/Communication/COMM-T1");
    assert.equal(mock.calls[0].init?.method, "PUT");
    assert.deepEqual(JSON.parse(String(mock.calls[0].init?.body)), { email_status: "Trash" });

    await restoreFromTrash("COMM-T1");
    assert.equal(mock.calls[1].init?.method, "PUT");
    assert.deepEqual(JSON.parse(String(mock.calls[1].init?.body)), { email_status: "Open" });

    // Weggooien mag nooit stilletjes een echte verwijdering worden.
    for (const c of mock.calls) assert.notEqual(c.init?.method, "DELETE");
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("deleteForever: pas hier een echte DELETE op de Communication", async () => {
  const mock = installFetchMock(() => ({ status: 202, body: { message: "ok" } }));
  try {
    await deleteForever("COMM-DEL-1");
    assert.equal(mock.calls[0].url, "/api/resource/Communication/COMM-DEL-1");
    assert.equal(mock.calls[0].init?.method, "DELETE");
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("bulkMarkRead / bulkMarkUnread: parallelle PUTs en daarna een verse lijst (cache geïnvalideerd)", async () => {
  const folder = "project:PROJ-BULK-0001";
  let listCalls = 0;
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/resource/Communication?")) {
      listCalls++;
      return rowsBody([]);
    }
    if (url.startsWith("/api/resource/Communication/")) {
      return { status: 200, body: { data: { name: "ok" } } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    await listMailboxMessages(folder);
    assert.equal(listCalls, 1);
    await settleFetchDedup();
    await listMailboxMessages(folder);
    assert.equal(listCalls, 1, "controle: de responscache serveert de tweede call normaal gesproken");
    await settleFetchDedup();

    await bulkMarkRead(["COMM-B1", "COMM-B2", "COMM-B1"]);
    const puts = mock.calls.filter((c) => c.init?.method === "PUT");
    assert.equal(puts.length, 2, "dubbele namen worden ontdubbeld");
    assert.deepEqual(
      puts.map((p) => p.url).sort(),
      ["/api/resource/Communication/COMM-B1", "/api/resource/Communication/COMM-B2"]
    );
    for (const p of puts) assert.deepEqual(JSON.parse(String(p.init?.body)), { seen: 1 });

    await listMailboxMessages(folder);
    assert.equal(listCalls, 2, "na een bulkactie moet de lijst opnieuw van de server komen");

    await bulkMarkUnread(["COMM-B3"]);
    const last = mock.calls[mock.calls.length - 1];
    assert.deepEqual(JSON.parse(String(last.init?.body)), { seen: 0 });

    // Lege lijst: geen enkele call.
    const before = mock.calls.length;
    await bulkMarkRead([]);
    assert.equal(mock.calls.length, before);
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("bulkMoveToTrash / bulkRestoreFromTrash: één PUT per bericht met de juiste email_status", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { data: { name: "ok" } } }));
  try {
    await bulkMoveToTrash(["COMM-T1", "COMM-T2", "COMM-T1"]);
    const puts = mock.calls.filter((c) => c.init?.method === "PUT");
    assert.equal(puts.length, 2, "dubbele namen worden ontdubbeld");
    assert.deepEqual(
      puts.map((p) => p.url).sort(),
      ["/api/resource/Communication/COMM-T1", "/api/resource/Communication/COMM-T2"]
    );
    for (const p of puts) assert.deepEqual(JSON.parse(String(p.init?.body)), { email_status: "Trash" });

    const before = mock.calls.length;
    await bulkRestoreFromTrash(["COMM-T3"]);
    assert.deepEqual(
      JSON.parse(String(mock.calls[before].init?.body)),
      { email_status: "Open" }
    );

    // Lege lijst: geen enkele call.
    const after = mock.calls.length;
    await bulkMoveToTrash([]);
    await bulkRestoreFromTrash([]);
    assert.equal(mock.calls.length, after);
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("bulkDeleteForever: DELETE per bericht", async () => {
  const mock = installFetchMock(() => ({ status: 202, body: { message: "ok" } }));
  try {
    await bulkDeleteForever(["COMM-D1", "COMM-D2"]);
    assert.equal(mock.calls.length, 2);
    for (const c of mock.calls) assert.equal(c.init?.method, "DELETE");
    assert.deepEqual(
      mock.calls.map((c) => c.url).sort(),
      ["/api/resource/Communication/COMM-D1", "/api/resource/Communication/COMM-D2"]
    );
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("bulk: één mislukt item stopt de rest niet, alles mislukt gooit wel", async () => {
  const mock = installFetchMock((url) =>
    url.includes("COMM-BAD")
      ? { status: 403, body: { exception: "No permission" } }
      : { status: 200, body: { data: { name: "ok" } } }
  );
  try {
    await bulkMarkRead(["COMM-OK1", "COMM-BAD"]);
    assert.equal(mock.calls.length, 2, "de goede update is gewoon uitgevoerd");
  } finally {
    mock.restore();
  }

  const allFail = installFetchMock(() => ({ status: 403, body: { exception: "No permission" } }));
  try {
    await assert.rejects(() => bulkMarkRead(["COMM-BAD1", "COMM-BAD2"]));
  } finally {
    allFail.restore();
    invalidateCache("Communication");
  }
});

test("getConversation: in_reply_to-ketting omhoog én omlaag, chronologisch gesorteerd", async () => {
  const docs: Record<string, Record<string, unknown>> = {
    "COMM-CA": { name: "COMM-CA", subject: "Offerte", sender: "jan@x.nl", communication_date: "2026-07-01 09:00:00", seen: 1, sent_or_received: "Received" },
    "COMM-CB": { name: "COMM-CB", subject: "Re: Offerte", sender: "info@y.nl", communication_date: "2026-07-01 10:00:00", seen: 1, in_reply_to: "COMM-CA", sent_or_received: "Sent" },
    "COMM-CC": { name: "COMM-CC", subject: "Re: Offerte", sender: "jan@x.nl", communication_date: "2026-07-01 11:00:00", seen: 0, in_reply_to: "COMM-CB", sent_or_received: "Received" },
    "COMM-CD": { name: "COMM-CD", subject: "Re: Offerte", sender: "info@y.nl", communication_date: "2026-07-01 12:00:00", seen: 1, in_reply_to: "COMM-CC", sent_or_received: "Sent" },
  };
  const mock = installFetchMock((url) => {
    const byName = filterValue(url, "name") as string[] | undefined;
    if (byName) return rowsBody(byName.map((n) => docs[n]).filter(Boolean));
    const byParent = filterValue(url, "in_reply_to") as string[] | undefined;
    if (byParent) {
      return rowsBody(Object.values(docs).filter((d) => byParent.includes(String(d.in_reply_to))));
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    // Start halverwege de thread: zowel de ouder als de kinderen moeten mee.
    const thread = await getConversation("COMM-CB");
    assert.deepEqual(thread.map((m) => m.name), ["COMM-CA", "COMM-CB", "COMM-CC", "COMM-CD"]);
    assert.equal(thread[0].folder, "INBOX");
    assert.equal(thread[1].folder, "Sent");
    assert.equal(thread[2].seen, false);
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("getConversation: het bronbericht mag getrasht zijn, de rest van de boom niet", async () => {
  const trashed = {
    name: "COMM-CT",
    subject: "Weggegooid",
    sender: "jan@x.nl",
    communication_date: "2026-07-01 09:00:00",
    seen: 1,
    sent_or_received: "Received",
    email_status: "Trash",
  };
  const child = {
    name: "COMM-CU",
    subject: "Re: Weggegooid",
    sender: "info@y.nl",
    communication_date: "2026-07-01 10:00:00",
    seen: 1,
    in_reply_to: "COMM-CT",
    sent_or_received: "Sent",
  };
  const mock = installFetchMock((url) => {
    const byName = filterValue(url, "name") as string[] | undefined;
    if (byName) return rowsBody(byName.includes("COMM-CT") ? [trashed] : []);
    const byParent = filterValue(url, "in_reply_to") as string[] | undefined;
    if (byParent) return rowsBody(byParent.includes("COMM-CT") ? [child] : []);
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const thread = await getConversation("COMM-CT");
    assert.deepEqual(thread.map((m) => m.name), ["COMM-CT", "COMM-CU"]);
    // Het bronbericht staat in de Prullenbak; de UI mag dat zo tonen.
    assert.equal(thread[0].folder, "trash");

    // De bron-lookup mag de prullenbak NIET uitsluiten (anders zie je geen
    // conversatie bij een mail die je net hebt weggegooid) …
    const rootCall = mock.calls[0];
    assert.equal(hasFilter(rootCall.url, "email_status", "!=", "Trash"), false);
    // … maar de afdaling naar antwoorden juist wél.
    const descend = mock.calls.find((c) => filterValue(c.url, "in_reply_to"));
    assert.ok(descend);
    assert.ok(hasFilter(descend.url, "email_status", "!=", "Trash"));
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("getConversation: onbekend bericht levert een lege lijst, lege naam kost geen call", async () => {
  const mock = installFetchMock(() => rowsBody([]));
  try {
    assert.deepEqual(await getConversation(""), []);
    assert.equal(mock.calls.length, 0);
    assert.deepEqual(await getConversation("COMM-NOPE"), []);
    assert.equal(mock.calls.length, 1, "één lookup, daarna stopt de closure");
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("getQueueStatusFor: status per Communication, nieuwste rij wint", async () => {
  const mock = installFetchMock((url) => {
    assert.match(url, /^\/api\/resource\/Email Queue\?/);
    assert.deepEqual(filterValue(url, "communication"), ["COMM-Q1", "COMM-Q2", "COMM-Q3"]);
    return rowsBody([
      { name: "EQ-3", communication: "COMM-Q1", status: "Sent" },
      { name: "EQ-2", communication: "COMM-Q1", status: "Not Sent" },
      { name: "EQ-1", reference_name: "COMM-Q2", status: "Error" },
      { name: "EQ-0", communication: "COMM-ANDERS", status: "Sent" },
    ]);
  });
  try {
    const map = await getQueueStatusFor(["COMM-Q1", "COMM-Q2", "COMM-Q3", "COMM-Q1"]);
    assert.deepEqual(map, { "COMM-Q1": "Sent", "COMM-Q2": "Error" });
  } finally {
    mock.restore();
    invalidateCache("Email Queue");
  }
});

test("getQueueStatusFor: leeg object bij 403 en zonder namen geen call", async () => {
  invalidateCache("Email Queue");
  await settleFetchDedup();
  const mock = installFetchMock(() => ({ status: 403, body: { exception: "No permission" } }));
  try {
    assert.deepEqual(await getQueueStatusFor([]), {});
    assert.equal(mock.calls.length, 0);
    assert.deepEqual(await getQueueStatusFor(["COMM-Q9"]), {});
  } finally {
    mock.restore();
    invalidateCache("Email Queue");
  }
});

/* ─── Custom mappen op ERPNext-tags ─── */

test("listCustomFolders: Tag-documenten met mail/-prefix worden mappen, teller via _user_tags", async () => {
  invalidateCache("Tag");
  await settleFetchDedup();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/resource/Tag?")) {
      assert.ok(hasFilter(url, "name", "like", "mail/%"));
      return rowsBody([
        { name: "mail/Klanten" },
        { name: "mail/Leveranciers" },
        { name: "project-tag" }, // buiten de mail/-namespace ⇒ geen mailmap
      ]);
    }
    if (url.startsWith("/api/method/frappe.client.get_count")) {
      const tagFilter = filtersOf(url).find((f) => Array.isArray(f) && f[0] === "_user_tags");
      assert.ok(tagFilter, "de teller filtert op _user_tags");
      return { status: 200, body: { message: String(tagFilter[2]).includes("Klanten") ? 4 : 0 } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const folders = await listCustomFolders();
    assert.equal(folders.length, 2);
    assert.deepEqual(folders[0], {
      id: "tag:Klanten",
      label: "Klanten",
      unseen: 4,
      kind: "custom",
      tag: "Klanten",
    });
    assert.equal(folders[1].id, "tag:Leveranciers");
    assert.equal(folders[1].unseen, 0);
  } finally {
    mock.restore();
    invalidateCache("Tag");
  }
});

test("listVirtualFolders: custom mappen staan tussen de vaste mappen en de projectmappen", async () => {
  invalidateCache("Tag");
  invalidateCache("Communication");
  invalidateCache("Project");
  await settleFetchDedup();
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/resource/Tag?")) return rowsBody([{ name: "mail/Archief" }]);
    if (url.startsWith("/api/resource/Communication?")) return rowsBody([{ reference_name: "PROJ-0001" }]);
    if (url.startsWith("/api/resource/Project?")) return rowsBody([{ name: "PROJ-0001", project_name: "Kade Noord" }]);
    if (url.startsWith("/api/method/frappe.client.get_count")) {
      return { status: 200, body: { message: countFor(url) } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    const folders = await listVirtualFolders();
    assert.deepEqual(
      folders.map((f) => f.kind),
      ["inbox", "sent", "unread", "trash", "custom", "project"]
    );
    assert.equal(folders[4].id, "tag:Archief");
  } finally {
    mock.restore();
    invalidateCache("Tag");
    invalidateCache("Communication");
    invalidateCache("Project");
  }
});

test("listMailboxMessages: een tag-map filtert op _user_tags met de mail/-prefix", async () => {
  const mock = installFetchMock(() => rowsBody([]));
  try {
    await listMailboxMessages("tag:Klanten");
    const url = mock.calls[0].url;
    assert.ok(hasFilter(url, "communication_type", "=", "Communication"));
    assert.ok(hasFilter(url, "_user_tags", "like", "%mail/Klanten%"));
    // Een custom map bevat zowel ontvangen als verzonden mail.
    assert.ok(!filtersOf(url).some((f) => Array.isArray(f) && f[0] === "sent_or_received"));
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("createCustomFolder / deleteCustomFolder: Tag-document met mail/-prefix, label gevalideerd", async () => {
  const mock = installFetchMock((url) => {
    if (url === "/api/resource/Tag") return { status: 200, body: { data: { name: "mail/Klanten" } } };
    return { status: 202, body: { message: "ok" } };
  });
  try {
    await createCustomFolder("  Klanten  ");
    assert.equal(mock.calls[0].url, "/api/resource/Tag");
    assert.equal(mock.calls[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(mock.calls[0].init?.body)), { name: "mail/Klanten" });

    await deleteCustomFolder("Klanten");
    assert.equal(mock.calls[1].url, "/api/resource/Tag/mail%2FKlanten");
    assert.equal(mock.calls[1].init?.method, "DELETE");

    const before = mock.calls.length;
    await assert.rejects(() => createCustomFolder("   "), /leeg/i);
    await assert.rejects(() => createCustomFolder("A,B"), /komma/i);
    assert.equal(mock.calls.length, before, "een ongeldig label mag de server niet bereiken");
  } finally {
    mock.restore();
    invalidateCache("Tag");
  }
});

test("tagMessage / untagMessage: primair via de whitelisted tag-RPC", async () => {
  const mock = installFetchMock(() => ({ status: 200, body: { message: "mail/Klanten" } }));
  try {
    await tagMessage("COMM-T1", "Klanten");
    assert.equal(mock.calls[0].url, "/api/method/frappe.desk.doctype.tag.tag.add_tag");
    assert.equal(mock.calls[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(mock.calls[0].init?.body)), {
      tag: "mail/Klanten",
      dt: "Communication",
      dn: "COMM-T1",
    });

    await untagMessage("COMM-T1", "Klanten");
    assert.equal(mock.calls[1].url, "/api/method/frappe.desk.doctype.tag.tag.remove_tag");
    assert.deepEqual(JSON.parse(String(mock.calls[1].init?.body)), {
      tag: "mail/Klanten",
      dt: "Communication",
      dn: "COMM-T1",
    });
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("tagMessage: valt terug op _user_tags wanneer de tag-RPC niet beschikbaar is", async () => {
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.desk.doctype.tag.tag.")) {
      return { status: 403, body: { exception: "Method not whitelisted" } };
    }
    if (url === "/api/resource/Communication/COMM-T2") {
      return { status: 200, body: { data: { name: "COMM-T2", _user_tags: ",mail/Oud,mail/Klanten," } } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    await tagMessage("COMM-T2", "Klanten");
    const put = mock.calls.find((c) => c.init?.method === "PUT");
    assert.ok(put, "de fallback schrijft _user_tags rechtstreeks");
    // Al aanwezig ⇒ niet dubbel toevoegen; lege segmenten verdwijnen.
    assert.deepEqual(JSON.parse(String(put.init?.body)), { _user_tags: ",mail/Oud,mail/Klanten" });
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});

test("untagMessage: fallback verwijdert alleen de eigen tag uit _user_tags", async () => {
  const mock = installFetchMock((url) => {
    if (url.startsWith("/api/method/frappe.desk.doctype.tag.tag.")) {
      return { status: 404, body: { exception: "Not found" } };
    }
    if (url === "/api/resource/Communication/COMM-T3") {
      return { status: 200, body: { data: { name: "COMM-T3", _user_tags: ",mail/Oud,mail/Klanten" } } };
    }
    throw new Error(`unexpected url: ${url}`);
  });
  try {
    await untagMessage("COMM-T3", "Klanten");
    const put = mock.calls.find((c) => c.init?.method === "PUT");
    assert.ok(put);
    assert.deepEqual(JSON.parse(String(put.init?.body)), { _user_tags: ",mail/Oud" });
  } finally {
    mock.restore();
    invalidateCache("Communication");
  }
});
