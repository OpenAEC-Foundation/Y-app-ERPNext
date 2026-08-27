import { test } from "node:test";
import assert from "node:assert/strict";

import {
  requiredEnv,
  parseArgs,
  buildSignatureHtml,
  hasMarker,
  decideAction,
  collectPeople,
  generateSignatures,
  SIGNATURE_MARKER,
} from "./generate-signatures.mjs";

/* ────────────────────────────── helpers ────────────────────────────── */

function installFetchMock(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init, method: init?.method ?? "GET" });
    const { status, body } = handler(url, init);
    return new Response(body === undefined ? "" : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return {
    calls,
    puts: () => calls.filter((c) => c.method === "PUT"),
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function installConsoleLogSpy() {
  const lines = [];
  const original = console.log;
  console.log = (...args) => {
    lines.push(args.map(String).join(" "));
  };
  return {
    lines,
    restore: () => {
      console.log = original;
    },
  };
}

/**
 * Backend-stub die de vier GETs van `collectPeople` beantwoordt. `users` mag
 * per test overschreven worden; de rest is een vaste, realistische instance.
 */
function backend(users) {
  return (url) => {
    if (url.includes("frappe.auth.get_logged_user")) {
      return { status: 200, body: { message: "api@example.com" } };
    }
    if (url.includes("/api/resource/User?")) {
      return { status: 200, body: { data: users } };
    }
    if (url.includes("/api/resource/Employee?")) {
      return {
        status: 200,
        body: {
          data: [
            {
              name: "HR-EMP-00001",
              employee_name: "Bjorn Fidder",
              user_id: "bjorn@example.com",
              designation: "Projectleider",
              cell_number: "06 12 34 56 78",
              company: "OpenAEC Studio BV",
              status: "Active",
            },
          ],
        },
      };
    }
    if (url.includes("/api/resource/Company?")) {
      return {
        status: 200,
        body: {
          data: [
            { name: "OpenAEC Studio BV", company_name: "OpenAEC Studio BV", website: "www.open-aec.com" },
          ],
        },
      };
    }
    if (url.includes("Global%20Defaults")) {
      return { status: 200, body: { data: { default_company: "OpenAEC Studio BV" } } };
    }
    throw new Error(`Onverwachte call: ${url}`);
  };
}

const FULL_USER = {
  name: "bjorn@example.com",
  full_name: "Bjorn Fidder",
  first_name: "Bjorn",
  last_name: "Fidder",
  email_signature: null,
  mobile_no: null,
  phone: null,
};

/* ─────────────────────────────── omgeving ─────────────────────────────── */

test("requiredEnv: gooit zonder token en normaliseert de basis-URL", () => {
  assert.throws(() => requiredEnv({}), /YNEXT_API_TOKEN/);
  const { baseUrl, token } = requiredEnv({
    YNEXT_API_TOKEN: "key:secret",
    YNEXT_BASE_URL: "https://erp.example.com///",
  });
  assert.equal(baseUrl, "https://erp.example.com");
  assert.equal(token, "key:secret");
});

test("parseArgs: --dry-run en --force", () => {
  assert.deepEqual(parseArgs([]), { dryRun: false, force: false });
  assert.deepEqual(parseArgs(["--dry-run"]), { dryRun: true, force: false });
  assert.deepEqual(parseArgs(["--force", "--dry-run"]), { dryRun: true, force: true });
});

/* ───────────────────────────── HTML-opbouw ───────────────────────────── */

test("buildSignatureHtml: naam, functie, bedrijf, mailto, telefoon, website en de marker", () => {
  const html = buildSignatureHtml({
    fullName: "Bjorn Fidder",
    designation: "Projectleider",
    company: "OpenAEC Studio BV",
    email: "bjorn@example.com",
    phone: "06 12 34 56 78",
    website: "www.open-aec.com",
  });

  assert.match(html, /Bjorn Fidder/);
  assert.match(html, /Projectleider/);
  assert.match(html, /OpenAEC Studio BV/);
  assert.match(html, /href="mailto:bjorn@example\.com"/);
  assert.match(html, /href="tel:0612345678"/); // spaties uit de href, niet uit het label
  assert.match(html, /06 12 34 56 78/);
  assert.match(html, /href="https:\/\/www\.open-aec\.com"/);
  assert.ok(html.endsWith(SIGNATURE_MARKER));
  assert.ok(hasMarker(html));
});

test("buildSignatureHtml: ontbrekende velden geven géén lege regels", () => {
  const html = buildSignatureHtml({
    fullName: "Jan Heikens",
    designation: "",
    company: "OpenAEC Studio BV",
    email: "jan@example.com",
    phone: "",
    website: "",
  });

  // Alleen naam, bedrijf en de contactregel — geen lege div, geen losse
  // scheidingsstip, geen kale tel:/http-link.
  assert.equal(html.split("<div").length - 1, 3);
  assert.ok(!/<div[^>]*>\s*<\/div>/.test(html));
  assert.ok(!html.includes("tel:"));
  assert.ok(!html.includes("href=\"https://\""));
  assert.ok(!html.includes("·"));
  assert.match(html, /Jan Heikens/);
});

test("buildSignatureHtml: compact — hooguit vijf regels, en de contactregel valt weg zonder e-mail én telefoon", () => {
  const maximal = buildSignatureHtml({
    fullName: "A", designation: "B", company: "C",
    email: "d@e.nl", phone: "0612345678", website: "example.com",
  });
  assert.equal(maximal.split("<div").length - 1, 5);

  const minimal = buildSignatureHtml({ fullName: "Naam Zonder Rest" });
  assert.equal(minimal.split("<div").length - 1, 1);
  assert.ok(!minimal.includes("mailto:"));
});

test("buildSignatureHtml: escapet naam en adres — geen HTML-injectie via ERPNext-data", () => {
  const html = buildSignatureHtml({
    fullName: '<script>alert("x")</script>',
    email: 'a"onmouseover="evil()@example.com',
  });
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.ok(!html.includes('onmouseover="evil()'));
  assert.match(html, /&quot;/);
});

test("buildSignatureHtml: website met schema blijft intact, label toont hem zonder schema", () => {
  const html = buildSignatureHtml({ fullName: "X", website: "https://open-aec.com/" });
  assert.match(html, /href="https:\/\/open-aec\.com\/"/);
  assert.match(html, />open-aec\.com</);
});

/* ─────────────────────────── beslisregel ─────────────────────────── */

test("decideAction: leeg schrijven, marker overschrijven, maatwerk overslaan (tenzij --force)", () => {
  assert.equal(decideAction("", false), "write");
  assert.equal(decideAction(null, false), "write");
  assert.equal(decideAction(`<p>oud</p>${SIGNATURE_MARKER}`, false), "write");
  assert.equal(decideAction("<p>zelfgemaakt</p>", false), "skip");
  assert.equal(decideAction("<p>zelfgemaakt</p>", true), "write");
});

/* ──────────────────────────── verzamelen ──────────────────────────── */

test("collectPeople: verrijkt met Employee + Company en sluit systeem- en API-accounts uit", async () => {
  const mock = installFetchMock(
    backend([
      FULL_USER,
      { name: "api@example.com", full_name: "Developer" },
      { name: "Administrator", full_name: "Administrator" },
      { name: "los@example.com", full_name: "Los Persoon", mobile_no: "0611111111" },
    ])
  );
  try {
    const people = await collectPeople({ baseUrl: "https://erp.example.com", token: "k:s" });
    assert.deepEqual(
      people.map((p) => p.user),
      ["bjorn@example.com", "los@example.com"]
    );

    const bjorn = people[0];
    assert.equal(bjorn.designation, "Projectleider");
    assert.equal(bjorn.phone, "06 12 34 56 78"); // Employee.cell_number wint
    assert.equal(bjorn.company, "OpenAEC Studio BV");
    assert.equal(bjorn.website, "www.open-aec.com");

    // Zonder Employee-koppeling: standaardbedrijf, en User.mobile_no als nummer.
    const los = people[1];
    assert.equal(los.designation, "");
    assert.equal(los.company, "OpenAEC Studio BV");
    assert.equal(los.phone, "0611111111");
  } finally {
    mock.restore();
  }
});

/* ───────────────────────── einde-tot-einde ───────────────────────── */

test("generateSignatures: schrijft per gebruiker één PUT op User.email_signature", async () => {
  const mock = installFetchMock((url, init) => {
    if (init?.method === "PUT") return { status: 200, body: { data: {} } };
    return backend([FULL_USER])(url);
  });
  const log = installConsoleLogSpy();
  try {
    const result = await generateSignatures({ baseUrl: "https://erp.example.com", token: "k:s" });
    assert.deepEqual(result.written, ["bjorn@example.com"]);
    assert.deepEqual(result.skipped, []);
    assert.deepEqual(result.failed, []);

    const puts = mock.puts();
    assert.equal(puts.length, 1);
    assert.match(puts[0].url, /\/api\/resource\/User\/bjorn%40example\.com$/);
    const payload = JSON.parse(puts[0].init.body);
    assert.ok(hasMarker(payload.email_signature));
    assert.match(payload.email_signature, /Projectleider/);
  } finally {
    log.restore();
    mock.restore();
  }

  // Alleen naam + actie in de log — nooit de token of de hele HTML.
  assert.deepEqual(log.lines, ["Bjorn Fidder: gezet."]);
});

test("generateSignatures: handmatige handtekening zonder marker wordt overgeslagen", async () => {
  const users = [{ ...FULL_USER, email_signature: "<p>Groet, Bjorn</p>" }];
  const mock = installFetchMock((url, init) => {
    if (init?.method === "PUT") return { status: 200, body: { data: {} } };
    return backend(users)(url);
  });
  const log = installConsoleLogSpy();
  try {
    const result = await generateSignatures({ baseUrl: "https://erp.example.com", token: "k:s" });
    assert.deepEqual(result.skipped, ["bjorn@example.com"]);
    assert.deepEqual(result.written, []);
    assert.equal(mock.puts().length, 0);
  } finally {
    log.restore();
    mock.restore();
  }
  assert.match(log.lines[0], /^Bjorn Fidder: overgeslagen/);
});

test("generateSignatures: --force overschrijft óók een handtekening zonder marker", async () => {
  const users = [{ ...FULL_USER, email_signature: "<p>Groet, Bjorn</p>" }];
  const mock = installFetchMock((url, init) => {
    if (init?.method === "PUT") return { status: 200, body: { data: {} } };
    return backend(users)(url);
  });
  const log = installConsoleLogSpy();
  try {
    const result = await generateSignatures({
      baseUrl: "https://erp.example.com",
      token: "k:s",
      force: true,
    });
    assert.deepEqual(result.written, ["bjorn@example.com"]);
    assert.equal(mock.puts().length, 1);
  } finally {
    log.restore();
    mock.restore();
  }
});

test("generateSignatures: een bestaande gegenereerde handtekening wordt bijgewerkt", async () => {
  const users = [{ ...FULL_USER, email_signature: `<p>v0</p>${SIGNATURE_MARKER}` }];
  const mock = installFetchMock((url, init) => {
    if (init?.method === "PUT") return { status: 200, body: { data: {} } };
    return backend(users)(url);
  });
  const log = installConsoleLogSpy();
  try {
    const result = await generateSignatures({ baseUrl: "https://erp.example.com", token: "k:s" });
    assert.deepEqual(result.written, ["bjorn@example.com"]);
    assert.equal(mock.puts().length, 1);
  } finally {
    log.restore();
    mock.restore();
  }
  assert.deepEqual(log.lines, ["Bjorn Fidder: bijgewerkt."]);
});

test("generateSignatures: --dry-run schrijft niets en toont de HTML", async () => {
  const mock = installFetchMock((url, init) => {
    if (init?.method === "PUT") throw new Error("dry-run mag niet schrijven");
    return backend([FULL_USER])(url);
  });
  const log = installConsoleLogSpy();
  try {
    const result = await generateSignatures({
      baseUrl: "https://erp.example.com",
      token: "k:s",
      dryRun: true,
    });
    assert.deepEqual(result.written, []);
    assert.equal(result.previews.length, 1);
    assert.equal(mock.puts().length, 0);
  } finally {
    log.restore();
    mock.restore();
  }
  assert.match(log.lines[0], /^Bjorn Fidder: zou worden gezet \(dry-run\)\.$/);
  assert.ok(hasMarker(log.lines[1]));
});

test("generateSignatures: een mislukte PUT stopt de rest niet en telt als 'mislukt'", async () => {
  const users = [
    FULL_USER,
    { name: "los@example.com", full_name: "Los Persoon" },
  ];
  const mock = installFetchMock((url, init) => {
    if (init?.method === "PUT") {
      return url.includes("bjorn") ? { status: 403, body: { exception: "No permission" } } : { status: 200, body: {} };
    }
    return backend(users)(url);
  });
  const log = installConsoleLogSpy();
  try {
    const result = await generateSignatures({ baseUrl: "https://erp.example.com", token: "k:s" });
    assert.deepEqual(result.failed, ["bjorn@example.com"]);
    assert.deepEqual(result.written, ["los@example.com"]);
  } finally {
    log.restore();
    mock.restore();
  }
  assert.match(log.lines[0], /^Bjorn Fidder: mislukt — .*HTTP 403/);
});
