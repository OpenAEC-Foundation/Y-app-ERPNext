import { test } from "node:test";
import assert from "node:assert/strict";

import {
  requiredEnv,
  parseArgs,
  SIGNATURE_GREETING,
  buildSignatureHtml,
  formatIban,
  resolveLogoUrl,
  hasMarker,
  decideAction,
  collectPeople,
  generateSignatures,
  SIGNATURE_MARKER,
} from "./generate-signatures.mjs";

/** De marker van de vorige generatie — moet nog steeds herkend worden. */
const MARKER_V1 = "<!-- y-next-signature v1 -->";
const MARKER_V2 = "<!-- y-next-signature v2 -->";

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
            {
              name: "OpenAEC Studio BV",
              company_name: "OpenAEC Studio BV",
              website: "www.open-aec.com",
              company_logo: "/files/openaec-signature-logo.png",
              phone_no: "078 000 00 00",
              tax_id: "NL869009096B01",
              registration_details: "KvK 99480697",
            },
          ],
        },
      };
    }
    if (url.includes("/api/resource/Address?")) {
      return { status: 200, body: { data: [{ name: "Kantoor-Billing" }] } };
    }
    if (url.includes("/api/resource/Address/")) {
      return {
        status: 200,
        body: {
          data: {
            name: "Kantoor-Billing",
            address_line1: "Burgemeester de Raadtsingel 31",
            address_line2: "",
            pincode: "3311 JG",
            city: "Dordrecht",
            links: [{ link_doctype: "Company", link_name: "OpenAEC Studio BV" }],
          },
        },
      };
    }
    if (url.includes("/api/resource/Bank%20Account?")) {
      return {
        status: 200,
        body: {
          data: [
            { name: "Rabobank Zakelijk", iban: "NL95RABO0169749509", company: "OpenAEC Studio BV", disabled: 0 },
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

/** Alle velden gevuld — de "volledige" handtekening. */
const FULL_PERSON = {
  fullName: "Bjorn Fidder",
  designation: "Projectleider",
  company: "OpenAEC Studio BV",
  email: "bjorn@example.com",
  phone: "06 12 34 56 78",
  website: "www.open-aec.com",
  addressLine: "Burgemeester de Raadtsingel 31",
  postalCity: "3311 JG Dordrecht",
  logoUrl: "https://erp.example.com/files/openaec-signature-logo.png",
  registration: "KvK 99480697",
  taxId: "NL869009096B01",
  iban: "NL95RABO0169749509",
};

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

test("buildSignatureHtml: toont alle ERPNext-gegevens en sluit af met de v3-marker", () => {
  const html = buildSignatureHtml(FULL_PERSON);

  assert.match(html, /Met vriendelijke groet,/);
  assert.match(html, /Bjorn Fidder/);
  assert.match(html, /Projectleider/);
  assert.match(html, /OpenAEC Studio BV/);
  assert.match(html, /Burgemeester de Raadtsingel 31/);
  assert.match(html, /3311 JG Dordrecht/);
  assert.match(html, /href="mailto:bjorn@example\.com"/);
  assert.match(html, /href="tel:0612345678"/); // spaties uit de href, niet uit het label
  assert.match(html, /06 12 34 56 78/);
  assert.match(html, /href="https:\/\/www\.open-aec\.com"/);
  assert.match(html, /KvK 99480697 · BTW NL869009096B01 · IBAN NL95 RABO 0169 7495 09/);
  assert.ok(html.endsWith(SIGNATURE_MARKER));
  assert.ok(hasMarker(html));
});

test("buildSignatureHtml: opent met de groet, precies één keer en boven de naam", () => {
  const html = buildSignatureHtml(FULL_PERSON);
  assert.equal(SIGNATURE_GREETING, "Met vriendelijke groet,");
  const hits = html.split(SIGNATURE_GREETING).length - 1;
  assert.equal(hits, 1, "de groet hoort er precies één keer in te staan");
  assert.ok(
    html.indexOf(SIGNATURE_GREETING) < html.indexOf("Bjorn Fidder"),
    "de groet staat bóven de naam",
  );
  // Ruimte via padding, niet via lege regels — een `<br>` of lege div zou in
  // Outlook een ongelijke afstand geven.
  assert.ok(!html.includes("<br"));
  assert.ok(!/<div[^>]*>\s*<\/div>/.test(html));
});

test("buildSignatureHtml: de groet erft de typografie van de rest, geen eigen lettertype", () => {
  const html = buildSignatureHtml(FULL_PERSON);
  const greetDiv = html.slice(html.indexOf("<div"), html.indexOf(SIGNATURE_GREETING));
  assert.ok(!/font-family/.test(greetDiv), "geen eigen lettertype");
  assert.ok(!/font-size/.test(greetDiv), "geen eigen tekstgrootte");
  assert.match(greetDiv, /padding-bottom:6px/, "alleen wat lucht onder de groet");
});

test("buildSignatureHtml: ook de kaalste handtekening groet", () => {
  const minimal = buildSignatureHtml({ fullName: "Naam Zonder Rest" });
  assert.match(minimal, /Met vriendelijke groet,/);
  assert.ok(minimal.indexOf(SIGNATURE_GREETING) < minimal.indexOf("Naam Zonder Rest"));
});

test("buildSignatureHtml: mailclient-veilig — tabel, inline styles, geen flex/grid of webfonts", () => {
  const html = buildSignatureHtml(FULL_PERSON);
  assert.match(html, /^<table role="presentation" cellpadding="0" cellspacing="0" border="0"/);
  assert.match(html, /border-collapse:collapse/);
  assert.match(html, /font-family:Arial,Helvetica,sans-serif/);
  assert.ok(!/display:\s*(flex|grid)/.test(html));
  assert.ok(!html.includes("<style"));
  assert.ok(!html.includes("class="));
  assert.ok(!html.includes("fonts.googleapis"));
  assert.ok(!html.includes("<br"));
});

test("buildSignatureHtml: het logo krijgt een absolute src, vaste breedte, alt en border:0", () => {
  const html = buildSignatureHtml(FULL_PERSON);
  assert.match(html, /<img src="https:\/\/erp\.example\.com\/files\/openaec-signature-logo\.png"/);
  assert.match(html, /width="96"/);
  assert.match(html, /alt="OpenAEC Studio BV"/);
  assert.match(html, /border:0/);
  assert.match(html, /display:block/);
  // Nooit een relatief pad: de ontvanger heeft geen ERPNext-origin.
  assert.ok(!/src="\//.test(html));
});

test("buildSignatureHtml: zonder logo blijft de tekstcel identiek en verschijnt er geen <img>", () => {
  const html = buildSignatureHtml({ ...FULL_PERSON, logoUrl: "" });
  assert.ok(!html.includes("<img"));
  assert.match(html, /border-left:3px solid #006876/);
  assert.match(html, /Bjorn Fidder/);
});

test("buildSignatureHtml: ontbrekende velden geven géén lege regels", () => {
  const html = buildSignatureHtml({
    fullName: "Jan Heikens",
    company: "OpenAEC Studio BV",
    email: "jan@example.com",
  });

  // Alleen de groet, naam, bedrijf en de contactregel — geen lege div, geen
  // losse scheidingsstip, geen kale tel:/http-link, geen adres- of voetregel.
  assert.equal(html.split("<div").length - 1, 4);
  assert.ok(!/<div[^>]*>\s*<\/div>/.test(html));
  assert.ok(!html.includes("tel:"));
  assert.ok(!html.includes('href="https://"'));
  assert.ok(!html.includes("·"));
  assert.ok(!html.includes("KvK"));
  assert.ok(!html.includes("IBAN"));
  assert.match(html, /Jan Heikens/);
});

test("buildSignatureHtml: volledig = negen regels; kaal = groet plus naam", () => {
  assert.equal(buildSignatureHtml(FULL_PERSON).split("<div").length - 1, 9);

  const minimal = buildSignatureHtml({ fullName: "Naam Zonder Rest" });
  assert.equal(minimal.split("<div").length - 1, 2);
  assert.ok(!minimal.includes("mailto:"));
  assert.ok(!minimal.includes("<img"));
});

test("buildSignatureHtml: de KvK/BTW/IBAN-regel toont alleen wat bekend is", () => {
  const alleenIban = buildSignatureHtml({ fullName: "X", iban: "NL95RABO0169749509" });
  assert.match(alleenIban, />IBAN NL95 RABO 0169 7495 09</);
  assert.ok(!alleenIban.includes("KvK"));
  assert.ok(!alleenIban.includes("BTW"));

  const alleenKvk = buildSignatureHtml({ fullName: "X", registration: "KvK 99480697" });
  assert.match(alleenKvk, />KvK 99480697</);
  assert.ok(!alleenKvk.includes("·")); // geen losse scheidingsstip bij één item

  // Een KvK-nummer zonder label krijgt het label erbij; mét label niet dubbel.
  assert.match(buildSignatureHtml({ fullName: "X", registration: "99480697" }), />KvK 99480697</);
  assert.match(buildSignatureHtml({ fullName: "X", taxId: "BTW NL1B01" }), />BTW NL1B01</);
});

test("buildSignatureHtml: escapet naam en adres — geen HTML-injectie via ERPNext-data", () => {
  const html = buildSignatureHtml({
    fullName: '<script>alert("x")</script>',
    email: 'a"onmouseover="evil()@example.com',
    addressLine: "<b>Straat</b>",
    registration: "<i>KvK</i>",
  });
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.ok(!html.includes('onmouseover="evil()'));
  assert.ok(!html.includes("<b>Straat</b>"));
  assert.ok(!html.includes("<i>KvK</i>"));
  assert.match(html, /&quot;/);
});

test("buildSignatureHtml: website met schema blijft intact, label toont hem zonder schema", () => {
  const html = buildSignatureHtml({ fullName: "X", website: "https://open-aec.com/" });
  assert.match(html, /href="https:\/\/open-aec\.com\/"/);
  assert.match(html, />open-aec\.com</);
});

/* ─────────────────────── formatteer-hulpjes (puur) ─────────────────────── */

test("formatIban: groepeert per vier, normaliseert bestaande spaties en hoofdletters", () => {
  assert.equal(formatIban("NL95RABO0169749509"), "NL95 RABO 0169 7495 09");
  assert.equal(formatIban(" nl95 rabo0169749509 "), "NL95 RABO 0169 7495 09");
  assert.equal(formatIban("DE89370400440532013000"), "DE89 3704 0044 0532 0130 00");
  assert.equal(formatIban("ABCD"), "ABCD"); // exact vier: geen naijlende spatie
  assert.equal(formatIban(""), "");
  assert.equal(formatIban(null), "");
});

test("resolveLogoUrl: publieke paden worden absoluut, privépaden vallen weg", () => {
  assert.equal(
    resolveLogoUrl("/files/logo.png", "https://erp.example.com/"),
    "https://erp.example.com/files/logo.png"
  );
  assert.equal(resolveLogoUrl("/private/files/logo.png", "https://erp.example.com"), "");
  assert.equal(resolveLogoUrl("", "https://erp.example.com"), "");
  assert.equal(resolveLogoUrl(null, "https://erp.example.com"), "");
  assert.equal(resolveLogoUrl("https://cdn.example.com/l.png", "https://erp.example.com"), "https://cdn.example.com/l.png");
});

/* ─────────────────────────── beslisregel ─────────────────────────── */

test("decideAction: leeg schrijven, marker overschrijven, maatwerk overslaan (tenzij --force)", () => {
  assert.equal(decideAction("", false), "write");
  assert.equal(decideAction(null, false), "write");
  assert.equal(decideAction(`<p>oud</p>${SIGNATURE_MARKER}`, false), "write");
  assert.equal(decideAction("<p>zelfgemaakt</p>", false), "skip");
  assert.equal(decideAction("<p>zelfgemaakt</p>", true), "write");
});

test("hasMarker: herkent óók v1 en v2, zodat oude handtekeningen worden bijgewerkt", () => {
  assert.notEqual(SIGNATURE_MARKER, MARKER_V1);
  assert.notEqual(SIGNATURE_MARKER, MARKER_V2);
  assert.ok(hasMarker(`<table>...</table>${MARKER_V1}`));
  assert.ok(hasMarker(`<table>...</table>${MARKER_V2}`));
  assert.equal(decideAction(`<table>...</table>${MARKER_V1}`, false), "write");
  assert.equal(decideAction(`<table>...</table>${MARKER_V2}`, false), "write");
  // Frappe's sanitizer mag de comment normaliseren zonder dat we 'm kwijtraken.
  assert.ok(hasMarker("<!--  y-next-signature v1  -->"));
  assert.ok(!hasMarker("<p>Groet, Bjorn</p>"));
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

    // Adres, IBAN, KvK/BTW en logo komen van het bedrijf.
    assert.equal(bjorn.addressLine, "Burgemeester de Raadtsingel 31");
    assert.equal(bjorn.postalCity, "3311 JG Dordrecht");
    assert.equal(bjorn.iban, "NL95RABO0169749509");
    assert.equal(bjorn.registration, "KvK 99480697");
    assert.equal(bjorn.taxId, "NL869009096B01");
    assert.equal(bjorn.logoUrl, "https://erp.example.com/files/openaec-signature-logo.png");

    // Zonder Employee-koppeling: standaardbedrijf, en User.mobile_no als nummer.
    const los = people[1];
    assert.equal(los.designation, "");
    assert.equal(los.company, "OpenAEC Studio BV");
    assert.equal(los.phone, "0611111111");
  } finally {
    mock.restore();
  }
});

test("collectPeople: zonder persoonlijk nummer valt de telefoon terug op Company.phone_no", async () => {
  const mock = installFetchMock(backend([{ name: "los@example.com", full_name: "Los Persoon" }]));
  try {
    const [los] = await collectPeople({ baseUrl: "https://erp.example.com", token: "k:s" });
    assert.equal(los.phone, "078 000 00 00");
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

test("generateSignatures: een v2-handtekening wordt bijgewerkt naar v3, mét groet", async () => {
  const users = [{ ...FULL_USER, email_signature: `<table>oud</table>${MARKER_V2}` }];
  const mock = installFetchMock((url, init) => {
    if (init?.method === "PUT") return { status: 200, body: { data: {} } };
    return backend(users)(url);
  });
  const log = installConsoleLogSpy();
  try {
    const result = await generateSignatures({ baseUrl: "https://erp.example.com", token: "k:s" });
    assert.deepEqual(result.written, ["bjorn@example.com"]);
    const payload = JSON.parse(mock.puts()[0].init.body);
    assert.ok(payload.email_signature.endsWith(SIGNATURE_MARKER));
    assert.ok(!payload.email_signature.includes(MARKER_V2));
    assert.match(payload.email_signature, /Met vriendelijke groet,/);
    assert.match(payload.email_signature, /IBAN NL95 RABO 0169 7495 09/);
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
