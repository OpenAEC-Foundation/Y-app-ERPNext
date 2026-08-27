import { test } from "node:test";
import assert from "node:assert/strict";

import {
  requiredEnv,
  buildMeetingNoteDoctype,
  buildSettingDoctype,
  buildPermissionRules,
  ensurePermissions,
  provision,
  DEFAULT_NAMING_SERIES_DOCTYPES,
  expandNamingSeriesPrefix,
  parseSeriesNumber,
  ensureNamingSeries,
} from "./provision-y-next.mjs";

function installFetchMock(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const { status, body } = handler(url, init);
    return new Response(body === undefined ? "" : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return {
    calls,
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

const PERM_MANAGER = "frappe.core.page.permission_manager.permission_manager";

/** true voor élke Permission Manager-URL (get_permissions/add/update). */
function isPermUrl(url) {
  return url.includes(PERM_MANAGER);
}

/**
 * Antwoordt op de Permission Manager-calls alsof élke regel uit
 * buildPermissionRules al goed staat — zo raken de DocType-tests niet
 * verstrikt in de rechtenfase.
 */
function satisfiedPermsHandler(url) {
  if (!url.includes(".get_permissions")) throw new Error(`Onverwachte perm-call: ${url}`);
  // get_permissions is per doctype gescoped — de mock spiegelt dat.
  const doctype = decodeURIComponent(new URL(url).searchParams.get("doctype") || "");
  // Eén rij per (rol, permlevel) — meerdere regels op dezelfde rij (write én
  // delete op Communication) horen samengevoegd te worden, precies zoals
  // Frappe ze teruggeeft. Zou de mock er twee losse rijen van maken, dan
  // vindt `findPermRow` alleen de eerste en lijkt de tweede vlag te ontbreken.
  const byRow = new Map();
  for (const r of buildPermissionRules()) {
    if (r.doctype !== doctype) continue;
    const key = `${r.role}/${r.permlevel}`;
    if (!byRow.has(key)) {
      byRow.set(key, { parent: r.doctype, role: r.role, permlevel: r.permlevel, if_owner: 0 });
    }
    byRow.get(key)[r.ptype] = r.value;
  }
  return { status: 200, body: { message: [...byRow.values()] } };
}

/**
 * Alleen de calls naar /api/resource/DocType voor de twee custom
 * provisioning-doctypes (dus zonder de rechtenfase en zonder de
 * naamreeksen-fase — die laatste bevraagt /api/resource/DocType/<kern-doctype>
 * óók, voor de naming_series-meta-check).
 */
function doctypeCalls(calls) {
  return calls.filter(
    (c) =>
      c.url.includes("DocType/Y%20Meeting%20Note") ||
      c.url.includes("DocType/Y%20Next%20Setting") ||
      // De aanmaak-POST gaat naar /api/resource/DocType zonder naam-suffix.
      /\/api\/resource\/DocType$/.test(c.url)
  );
}

test("requiredEnv: gooit een duidelijke fout zonder YNEXT_API_TOKEN", () => {
  assert.throws(() => requiredEnv({}), /YNEXT_API_TOKEN/);
});

test("requiredEnv: gebruikt de default base-URL en strip trailing slashes", () => {
  const { baseUrl, token } = requiredEnv({ YNEXT_API_TOKEN: "key:secret" });
  assert.equal(token, "key:secret");
  assert.equal(baseUrl, "https://open-aec-studio-erp.prilk.cloud");
});

test("requiredEnv: strip trailing slash(es) van een expliciete YNEXT_BASE_URL", () => {
  const { baseUrl } = requiredEnv({
    YNEXT_API_TOKEN: "key:secret",
    YNEXT_BASE_URL: "https://example.frappe.cloud///",
  });
  assert.equal(baseUrl, "https://example.frappe.cloud");
});

test("buildMeetingNoteDoctype: module/custom/autoname en de exacte veldenlijst", () => {
  const def = buildMeetingNoteDoctype();
  assert.equal(def.name, "Y Meeting Note");
  assert.equal(def.module, "Custom");
  assert.equal(def.custom, 1);
  assert.equal(def.autoname, "format:YMN-{YYYY}-{#####}");

  const byName = Object.fromEntries(def.fields.map((f) => [f.fieldname, f]));

  assert.equal(byName.title.fieldtype, "Data");
  assert.equal(byName.title.reqd, 1);

  assert.equal(byName.meeting_date.fieldtype, "Date");

  assert.equal(byName.project.fieldtype, "Link");
  assert.equal(byName.project.options, "Project");

  assert.equal(byName.participants.fieldtype, "Long Text");
  assert.equal(byName.action_points.fieldtype, "Long Text");
  assert.equal(byName.notes.fieldtype, "Text Editor");
  assert.equal(byName.linked_doctype.fieldtype, "Data");
  assert.equal(byName.linked_name.fieldtype, "Data");

  assert.deepEqual(Object.keys(byName).sort(), [
    "action_points",
    "linked_doctype",
    "linked_name",
    "meeting_date",
    "notes",
    "participants",
    "project",
    "title",
  ]);
});

test("buildMeetingNoteDoctype: permissions bevatten System Manager en Projects User met volledige CRUD", () => {
  const def = buildMeetingNoteDoctype();
  const byRole = Object.fromEntries(def.permissions.map((p) => [p.role, p]));
  assert.ok(byRole["System Manager"]);
  assert.ok(byRole["Projects User"]);
  for (const role of ["System Manager", "Projects User"]) {
    assert.equal(byRole[role].read, 1);
    assert.equal(byRole[role].write, 1);
    assert.equal(byRole[role].create, 1);
    assert.equal(byRole[role].delete, 1);
  }
});

test("buildSettingDoctype: module/custom/autoname en de exacte veldenlijst", () => {
  const def = buildSettingDoctype();
  assert.equal(def.name, "Y Next Setting");
  assert.equal(def.module, "Custom");
  assert.equal(def.custom, 1);
  assert.equal(def.autoname, "field:setting_key");

  const byName = Object.fromEntries(def.fields.map((f) => [f.fieldname, f]));
  assert.equal(byName.setting_key.fieldtype, "Data");
  assert.equal(byName.setting_key.reqd, 1);
  assert.equal(byName.setting_key.unique, 1);
  assert.equal(byName.setting_value.fieldtype, "Long Text");

  assert.deepEqual(Object.keys(byName).sort(), ["setting_key", "setting_value"]);
});

test("buildSettingDoctype: geen rol All (API weigert die), System Manager heeft volledige CRUD, Projects User alleen read", () => {
  const def = buildSettingDoctype();
  const byRole = Object.fromEntries(def.permissions.map((p) => [p.role, p]));
  // Frappe weigert rol "All" op custom doctypes die via de API worden
  // aangemaakt ("Non administrator user can not set the role All").
  assert.ok(!byRole["All"]);

  assert.ok(byRole["System Manager"]);
  assert.equal(byRole["System Manager"].read, 1);
  assert.equal(byRole["System Manager"].write, 1);
  assert.equal(byRole["System Manager"].create, 1);
  assert.equal(byRole["System Manager"].delete, 1);

  // Y Next Setting bevat o.a. de geïnstalleerde-extensies-lijst, die draait
  // met de ERPNext-rechten van de kijker (ExtensionHost RPC-bridge).
  // Schrijven/aanmaken is daarom bewust beperkt tot System Manager — een
  // willekeurige Projects User mag alleen lezen, niet zelf een
  // extensie-URL installeren die dan in andermans sessie uitgevoerd wordt.
  // Expliciete nullen: Frappe vult ontbrekende DocPerm-vlaggen met defaults
  // (live waargenomen: een rij met alleen read:1 werd volledige CRUD).
  assert.ok(byRole["Projects User"]);
  assert.equal(byRole["Projects User"].read, 1);
  assert.equal(byRole["Projects User"].write, 0);
  assert.equal(byRole["Projects User"].create, 0);
  assert.equal(byRole["Projects User"].delete, 0);
});

test("provision: slaat bestaande DocTypes over (GET 200 -> geen POST)", async () => {
  const mock = installFetchMock((url) => {
    if (isPermUrl(url)) return satisfiedPermsHandler(url);
    if (/\/api\/resource\/DocType\//.test(url)) {
      return { status: 200, body: { data: { name: "existing" } } };
    }
    throw new Error(`Onverwachte call naar ${url}`);
  });
  try {
    const result = await provision({ baseUrl: "https://example.frappe.cloud", token: "key:secret" });
    assert.deepEqual(result.existing.sort(), ["Y Meeting Note", "Y Next Setting"]);
    assert.deepEqual(result.created, []);
    const calls = doctypeCalls(mock.calls);
    assert.equal(calls.filter((c) => c.init?.method === "POST").length, 0);
    // Beide DocTypes moeten opgezocht zijn.
    assert.equal(calls.filter((c) => c.init?.method === undefined || c.init?.method === "GET").length, 2);
  } finally {
    mock.restore();
  }
});

test("provision: maakt een DocType aan wanneer GET 404 geeft", async () => {
  const mock = installFetchMock((url, init) => {
    if (isPermUrl(url)) return satisfiedPermsHandler(url);
    if (/\/api\/resource\/DocType\//.test(url) && (!init || init.method === undefined)) {
      return { status: 404, body: { exc_type: "DoesNotExistError" } };
    }
    if (/\/api\/resource\/DocType$/.test(url) && init?.method === "POST") {
      return { status: 200, body: { data: { name: "created" } } };
    }
    throw new Error(`Onverwachte call: ${init?.method || "GET"} ${url}`);
  });
  try {
    const result = await provision({ baseUrl: "https://example.frappe.cloud", token: "key:secret" });
    assert.deepEqual(result.created.sort(), ["Y Meeting Note", "Y Next Setting"]);
    assert.deepEqual(result.existing, []);
    const postCalls = doctypeCalls(mock.calls).filter((c) => c.init?.method === "POST");
    assert.equal(postCalls.length, 2);
    for (const call of postCalls) {
      const bodyText = call.init.body;
      assert.doesNotMatch(bodyText, /key:secret/);
    }
  } finally {
    mock.restore();
  }
});

test("provision: draait de rechtenfase ná de doctype-fase, en de naamreeksen-fase ná de rechtenfase", async () => {
  const order = [];
  const mock = installFetchMock((url) => {
    if (isPermUrl(url)) {
      order.push("perm");
      return satisfiedPermsHandler(url);
    }
    if (url.includes("DocType/Y%20Meeting%20Note") || url.includes("DocType/Y%20Next%20Setting")) {
      order.push("doctype");
      return { status: 200, body: { data: { name: "existing" } } };
    }
    // Alle overige calls horen bij de naamreeksen-fase (DocType-meta-checks
    // voor de acht kern-doctypes). Deze mock geeft ze geen `fields`, dus
    // `ensureNamingSeries` stopt meteen na de meta-check — geen naming_series
    // gevonden, geen vervolgcalls.
    order.push("naming");
    return { status: 200, body: { data: { name: "existing" } } };
  });
  try {
    const result = await provision({ baseUrl: "https://example.frappe.cloud", token: "key:secret" });
    assert.equal(result.permissions.unchanged.length, buildPermissionRules().length);
    assert.deepEqual(result.permissions.added, []);
    assert.deepEqual(result.permissions.updated, []);
    assert.equal(result.namingSeries.skipped.length, DEFAULT_NAMING_SERIES_DOCTYPES.length);
    assert.equal(result.namingSeries.updated.length, 0);
    // Doctype-fase vóór rechtenfase, rechtenfase vóór naamreeksen-fase.
    assert.equal(order.lastIndexOf("doctype") < order.indexOf("perm"), true);
    assert.equal(order.lastIndexOf("perm") < order.indexOf("naming"), true);
  } finally {
    mock.restore();
  }
});

test("provision: gooit een fout bij een onverwachte GET-status (niet 200/404)", async () => {
  const mock = installFetchMock(() => ({ status: 500, body: { exc: "boom" } }));
  try {
    await assert.rejects(
      () => provision({ baseUrl: "https://example.frappe.cloud", token: "key:secret" }),
      /500/
    );
  } finally {
    mock.restore();
  }
});

test("provision: verstuurt de Authorization-header met token-prefix, maar logt nooit het token", async () => {
  const mock = installFetchMock((url) => {
    if (isPermUrl(url)) return satisfiedPermsHandler(url);
    if (/\/api\/resource\/DocType\//.test(url)) {
      return { status: 200, body: { data: { name: "existing" } } };
    }
    throw new Error(`Onverwachte call naar ${url}`);
  });
  const logSpy = installConsoleLogSpy();
  try {
    await provision({ baseUrl: "https://example.frappe.cloud", token: "key:supersecret" });
    for (const call of mock.calls) {
      assert.equal(call.init?.headers?.Authorization, "token key:supersecret");
    }
    for (const line of logSpy.lines) {
      assert.doesNotMatch(line, /key:supersecret/);
    }
  } finally {
    mock.restore();
    logSpy.restore();
  }
});

/* ────────────────────────── Rechten (ensurePermissions) ────────────────────────── */

test("buildPermissionRules: dekt Communication-write/-delete en ToDo-delete op permlevel 0", () => {
  const rules = buildPermissionRules();
  const key = (r) => `${r.doctype}/${r.role}/${r.permlevel}/${r.ptype}=${r.value}`;
  const keys = rules.map(key);

  // Mark-read en maptoewijzing zijn documentupdates op Communication; de
  // core-DocPerm geeft permlevel-0-write aan niemand.
  assert.ok(keys.includes("Communication/Projects User/0/write=1"));
  assert.ok(keys.includes("Communication/System Manager/0/write=1"));
  // "Definitief verwijderen" vanuit de Prullenbak is een echte DELETE; zonder
  // deze regel ziet een Projects User de knop wel maar krijgt hij een 403.
  assert.ok(keys.includes("Communication/Projects User/0/delete=1"));
  assert.ok(keys.includes("Communication/System Manager/0/delete=1"));
  // Zonder delete is een in Y-next aangemaakt todo permanent.
  assert.ok(keys.includes("ToDo/Projects User/0/delete=1"));
  assert.ok(keys.includes("ToDo/System Manager/0/delete=1"));

  for (const r of rules) assert.equal(r.permlevel, 0);
  // Elke regel moet uniek zijn — een dubbele (doctype, rol, ptype) zou twee
  // identieke Permission Manager-calls per run opleveren.
  assert.equal(new Set(keys).size, keys.length);
});

test("ensurePermissions: zet Communication-delete voor Projects User zonder de bestaande write-rij te dupliceren", async () => {
  // Live stand op de doelinstance: Communication heeft géén Projects
  // User-rij, en System Manager heeft op permlevel 0 al delete: 1.
  const mock = installPermMock({
    Communication: [{ role: "System Manager", permlevel: 0, if_owner: 0, read: 1, write: 0, delete: 1 }],
    ToDo: [
      { role: "Projects User", permlevel: 0, if_owner: 0, read: 1, delete: 1 },
      { role: "System Manager", permlevel: 0, if_owner: 0, read: 1, delete: 1 },
    ],
  });
  const logs = installConsoleLogSpy();
  try {
    const result = await ensurePermissions({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
    });

    // De ontbrekende rij wordt één keer toegevoegd, niet één keer per ptype.
    assert.deepEqual(result.added, ["Communication/Projects User/0"]);
    assert.ok(result.updated.includes("Communication/Projects User/0/write"));
    assert.ok(result.updated.includes("Communication/Projects User/0/delete"));
    // System Manager had delete al -> geen update, wel een write-update.
    assert.ok(result.unchanged.includes("Communication/System Manager/0/delete"));
    assert.ok(result.updated.includes("Communication/System Manager/0/write"));

    const addCalls = mock.calls.filter((c) => c.url.includes(".add") && c.init?.method === "POST");
    assert.equal(addCalls.length, 1, "de rij wordt maar één keer aangemaakt");
  } finally {
    logs.restore();
    mock.restore();
  }
});

/** Bouwt een fetch-mock voor de Permission Manager met een instelbare perm-tabel. */
function installPermMock(rowsByDoctype) {
  return installFetchMock((url, init) => {
    if (url.includes(".get_permissions")) {
      const doctype = decodeURIComponent(new URL(url).searchParams.get("doctype") || "");
      return { status: 200, body: { message: rowsByDoctype[doctype] || [] } };
    }
    if (url.includes(".add") && init?.method === "POST") return { status: 200, body: { message: "ok" } };
    if (url.includes(".update") && init?.method === "POST") return { status: 200, body: { message: "ok" } };
    throw new Error(`Onverwachte call: ${init?.method || "GET"} ${url}`);
  });
}

const RULE_COMM_WRITE = [
  { doctype: "Communication", role: "Projects User", permlevel: 0, ptype: "write", value: 1 },
];

test("ensurePermissions: voegt de rol-rij toe én zet de vlag wanneer de rij ontbreekt", async () => {
  // Communication heeft geen Projects User-rij (de live stand uit e2e-report-1).
  const mock = installPermMock({
    Communication: [{ role: "System Manager", permlevel: 0, if_owner: 0, read: 1, write: 0 }],
  });
  try {
    const result = await ensurePermissions({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      rules: RULE_COMM_WRITE,
    });
    assert.deepEqual(result.added, ["Communication/Projects User/0"]);
    assert.deepEqual(result.updated, ["Communication/Projects User/0/write"]);
    assert.deepEqual(result.unchanged, []);

    const posts = mock.calls.filter((c) => c.init?.method === "POST");
    assert.equal(posts.length, 2);
    assert.ok(posts[0].url.endsWith(".add"));
    assert.deepEqual(JSON.parse(posts[0].init.body), {
      parent: "Communication",
      role: "Projects User",
      permlevel: 0,
    });
    assert.ok(posts[1].url.endsWith(".update"));
    assert.deepEqual(JSON.parse(posts[1].init.body), {
      doctype: "Communication",
      role: "Projects User",
      permlevel: 0,
      ptype: "write",
      value: 1,
    });
  } finally {
    mock.restore();
  }
});

test("ensurePermissions: bestaande rij met verkeerde vlag -> alleen update, geen add", async () => {
  const mock = installPermMock({
    Communication: [{ role: "Projects User", permlevel: 0, if_owner: 0, read: 1, write: 0 }],
  });
  try {
    const result = await ensurePermissions({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      rules: RULE_COMM_WRITE,
    });
    assert.deepEqual(result.added, []);
    assert.deepEqual(result.updated, ["Communication/Projects User/0/write"]);

    const posts = mock.calls.filter((c) => c.init?.method === "POST");
    assert.equal(posts.length, 1);
    assert.ok(posts[0].url.endsWith(".update"));
  } finally {
    mock.restore();
  }
});

test("ensurePermissions: idempotent — vlag staat al goed, dus geen enkele POST", async () => {
  const mock = installPermMock({
    Communication: [{ role: "Projects User", permlevel: 0, if_owner: 0, read: 1, write: 1 }],
  });
  try {
    const result = await ensurePermissions({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      rules: RULE_COMM_WRITE,
    });
    assert.deepEqual(result.unchanged, ["Communication/Projects User/0/write"]);
    assert.deepEqual(result.added, []);
    assert.deepEqual(result.updated, []);
    assert.equal(mock.calls.filter((c) => c.init?.method === "POST").length, 0);
  } finally {
    mock.restore();
  }
});

test("ensurePermissions: een if_owner-rij telt niet als de gevraagde rij", async () => {
  // `All` met if_owner geeft alleen rechten op eigen documenten — geen
  // vervanging voor een gewone rol-rij.
  const mock = installPermMock({
    Communication: [{ role: "Projects User", permlevel: 0, if_owner: 1, read: 1, write: 1 }],
  });
  try {
    const result = await ensurePermissions({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      rules: RULE_COMM_WRITE,
    });
    assert.deepEqual(result.added, ["Communication/Projects User/0"]);
    assert.deepEqual(result.updated, ["Communication/Projects User/0/write"]);
  } finally {
    mock.restore();
  }
});

test("ensurePermissions: één get_permissions-call per doctype, ongeacht het aantal regels", async () => {
  const mock = installPermMock({
    ToDo: [
      { role: "Projects User", permlevel: 0, if_owner: 0, read: 1, delete: 1 },
      { role: "System Manager", permlevel: 0, if_owner: 0, read: 1, delete: 1 },
    ],
  });
  try {
    await ensurePermissions({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      rules: [
        { doctype: "ToDo", role: "Projects User", permlevel: 0, ptype: "delete", value: 1 },
        { doctype: "ToDo", role: "System Manager", permlevel: 0, ptype: "delete", value: 1 },
      ],
    });
    assert.equal(mock.calls.filter((c) => c.url.includes(".get_permissions")).length, 1);
  } finally {
    mock.restore();
  }
});

test("ensurePermissions: logt per regel wat er gebeurde, zonder het token", async () => {
  const mock = installPermMock({
    Communication: [{ role: "Projects User", permlevel: 0, if_owner: 0, read: 1, write: 0 }],
  });
  const logSpy = installConsoleLogSpy();
  try {
    await ensurePermissions({
      baseUrl: "https://example.frappe.cloud",
      token: "key:supersecret",
      rules: RULE_COMM_WRITE,
    });
    const joined = logSpy.lines.join("\n");
    assert.match(joined, /Communication\/Projects User\/0\/write/);
    assert.doesNotMatch(joined, /supersecret/);
  } finally {
    mock.restore();
    logSpy.restore();
  }
});

test("ensurePermissions: gooit met status als get_permissions faalt", async () => {
  const mock = installFetchMock(() => ({ status: 403, body: { exc: "nope" } }));
  try {
    await assert.rejects(
      () =>
        ensurePermissions({
          baseUrl: "https://example.frappe.cloud",
          token: "key:secret",
          rules: RULE_COMM_WRITE,
        }),
      /403/
    );
  } finally {
    mock.restore();
  }
});

/* ────────────────────── Naamreeks-tellers (ensureNamingSeries) ────────────────────── */

test("expandNamingSeriesPrefix: vult .YYYY. in met het huidige jaar, laat de rest letterlijk", () => {
  const now = new Date("2026-03-15T00:00:00Z");
  assert.equal(expandNamingSeriesPrefix("TS-.YYYY.-", now), "TS-2026-");
  assert.equal(expandNamingSeriesPrefix("ACC-PINV-.YYYY.-", now), "ACC-PINV-2026-");
  // Geen dots -> ongewijzigd doorgegeven (bv. PROJ-0029-stijl prefixen zonder jaar).
  assert.equal(expandNamingSeriesPrefix("PROJ-", now), "PROJ-");
});

test("parseSeriesNumber: met jaarsegment in de prefix", () => {
  assert.equal(parseSeriesNumber("ACC-PINV-2026-00042", "ACC-PINV-2026-"), 42);
});

test("parseSeriesNumber: zonder jaarsegment in de prefix", () => {
  assert.equal(parseSeriesNumber("PROJ-0029", "PROJ-"), 29);
});

test("parseSeriesNumber: null als de naam niet met de prefix begint", () => {
  assert.equal(parseSeriesNumber("TS_JanHeikens_WK03_2026", "TS-2026-"), null);
});

test("parseSeriesNumber: null als er direct na de prefix geen cijfers staan", () => {
  assert.equal(parseSeriesNumber("TS-2026-onbekend", "TS-2026-"), null);
});

/**
 * Bouwt een fetch-mock voor de volledige naamreeks-keten: DocType-meta
 * (naming_series-opties), de gefilterde documentenlijst per prefix, en
 * `Document Naming Settings` (get_current/update_series_start via
 * run_doc_method). `current` is een muteerbare Map/object zodat een test na
 * afloop kan verifiëren dat de teller ook echt is bijgewerkt.
 */
function installNamingSeriesMock({ meta = {}, docs = {}, current = {} }) {
  return installFetchMock((url, init) => {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);

    if (path.startsWith("/api/resource/DocType/")) {
      const doctype = path.slice("/api/resource/DocType/".length);
      if (!(doctype in meta)) return { status: 404, body: {} };
      return { status: 200, body: { data: meta[doctype] } };
    }

    if (path.includes("Document Naming Settings")) {
      return { status: 200, body: { data: { name: "Document Naming Settings", modified: "2026-01-01 00:00:00" } } };
    }

    if (path === "/api/method/run_doc_method") {
      const payload = JSON.parse(init.body);
      const docsPayload = JSON.parse(payload.docs);
      const prefix = docsPayload.prefix;
      if (payload.method === "get_current") {
        // Live geverifieerd (2026-08-27, tegen de productie-instance):
        // run_doc_method geeft get_current's resultaat terug als een kaal
        // getal in `message`, NIET als `{ current_value }`. De mock spiegelt
        // dat exact — anders test de mock een vorm die de echte API niet
        // teruggeeft.
        return { status: 200, body: { message: current[prefix] ?? 0 } };
      }
      if (payload.method === "update_series_start") {
        current[prefix] = docsPayload.current_value;
        return { status: 200, body: { message: "ok" } };
      }
      throw new Error(`Onverwachte run_doc_method: ${payload.method}`);
    }

    // Documentenlijst-query voor één prefix: /api/resource/<doctype>?filters=...
    const doctype = path.slice("/api/resource/".length);
    const filters = JSON.parse(u.searchParams.get("filters") || "[]");
    const likeExpr = (filters[0] && filters[0][2]) || "";
    const prefix = likeExpr.endsWith("%") ? likeExpr.slice(0, -1) : likeExpr;
    const names = (docs[doctype] && docs[doctype][prefix]) || [];
    return { status: 200, body: { data: names.length ? [{ name: names[0] }] : [] } };
  });
}

const NAMING_FIELD = (options) => ({ fields: [{ fieldname: "naming_series", options }] });

test("ensureNamingSeries: zet de teller wanneer hij lager staat dan de hoogste bestaande naam (met jaarsegment)", async () => {
  const current = { "TS-2026-": 9 };
  const mock = installNamingSeriesMock({
    meta: { Timesheet: NAMING_FIELD("TS-.YYYY.-\n") },
    docs: { Timesheet: { "TS-2026-": ["TS-2026-00042"] } },
    current,
  });
  try {
    const result = await ensureNamingSeries({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      doctypes: ["Timesheet"],
      now: new Date("2026-03-01T00:00:00Z"),
    });
    assert.deepEqual(result.updated, [{ doctype: "Timesheet", prefix: "TS-2026-", oldValue: 9, newValue: 42 }]);
    assert.deepEqual(result.unchanged, []);
    assert.deepEqual(result.skipped, []);
    assert.equal(current["TS-2026-"], 42);

    const updateCalls = mock.calls.filter((c) => {
      if (!c.init || c.init.method !== "POST" || !c.url.endsWith("run_doc_method")) return false;
      const payload = JSON.parse(c.init.body);
      return payload.method === "update_series_start";
    });
    assert.equal(updateCalls.length, 1);
  } finally {
    mock.restore();
  }
});

test("ensureNamingSeries: laat de teller met rust als hij al gelijk aan of hoger is dan de hoogste bestaande naam", async () => {
  const current = { "ACC-PINV-2026-": 50 };
  const mock = installNamingSeriesMock({
    meta: { "Purchase Invoice": NAMING_FIELD("ACC-PINV-.YYYY.-\n") },
    docs: { "Purchase Invoice": { "ACC-PINV-2026-": ["ACC-PINV-2026-00042"] } },
    current,
  });
  try {
    const result = await ensureNamingSeries({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      doctypes: ["Purchase Invoice"],
      now: new Date("2026-03-01T00:00:00Z"),
    });
    assert.deepEqual(result.unchanged, [
      { doctype: "Purchase Invoice", prefix: "ACC-PINV-2026-", highest: 42, value: 50 },
    ]);
    assert.deepEqual(result.updated, []);
    assert.equal(current["ACC-PINV-2026-"], 50, "teller mag niet aangeraakt zijn");

    const updateCalls = mock.calls.filter((c) => {
      if (!c.init || c.init.method !== "POST" || !c.url.endsWith("run_doc_method")) return false;
      const payload = JSON.parse(c.init.body);
      return payload.method === "update_series_start";
    });
    assert.equal(updateCalls.length, 0);
  } finally {
    mock.restore();
  }
});

test("ensureNamingSeries: onbekende doctype (bestaat niet op de instance) wordt overgeslagen, niet gegooid", async () => {
  const mock = installNamingSeriesMock({ meta: {} });
  try {
    const result = await ensureNamingSeries({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      doctypes: ["Onbestaand Doctype"],
    });
    assert.deepEqual(result.skipped, [{ doctype: "Onbestaand Doctype", reason: "doctype-not-found" }]);
    assert.deepEqual(result.updated, []);
    assert.deepEqual(result.unchanged, []);
  } finally {
    mock.restore();
  }
});

test("ensureNamingSeries: doctype zonder naming_series-veld (hash/field autoname) wordt overgeslagen", async () => {
  const mock = installNamingSeriesMock({ meta: { Task: { fields: [] } } });
  try {
    const result = await ensureNamingSeries({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      doctypes: ["Task"],
    });
    assert.deepEqual(result.skipped, [{ doctype: "Task", reason: "no-naming-series" }]);
  } finally {
    mock.restore();
  }
});

test("ensureNamingSeries: geen documenten met de prefix -> overgeslagen, geen tellercall", async () => {
  const mock = installNamingSeriesMock({
    meta: { Quotation: NAMING_FIELD("SAL-QTN-.YYYY.-\n") },
    docs: { Quotation: {} },
  });
  try {
    const result = await ensureNamingSeries({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      doctypes: ["Quotation"],
      now: new Date("2026-01-01T00:00:00Z"),
    });
    assert.deepEqual(result.skipped, [{ doctype: "Quotation", prefix: "SAL-QTN-2026-", reason: "no-documents" }]);
    const runDocCalls = mock.calls.filter((c) => c.url.endsWith("run_doc_method"));
    assert.equal(runDocCalls.length, 0, "zonder documenten hoeft de tellerstand niet opgevraagd te worden");
  } finally {
    mock.restore();
  }
});

test("ensureNamingSeries: meerdere naming_series-opties op één doctype worden allebei gecontroleerd", async () => {
  const current = { "ACC-PINV-2026-": 5, "ACC-PINV-RET-2026-": 100 };
  const mock = installNamingSeriesMock({
    meta: { "Purchase Invoice": NAMING_FIELD("ACC-PINV-.YYYY.-\nACC-PINV-RET-.YYYY.-\n") },
    docs: {
      "Purchase Invoice": {
        "ACC-PINV-2026-": ["ACC-PINV-2026-00042"],
        "ACC-PINV-RET-2026-": ["ACC-PINV-RET-2026-00003"],
      },
    },
    current,
  });
  try {
    const result = await ensureNamingSeries({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      doctypes: ["Purchase Invoice"],
      now: new Date("2026-01-01T00:00:00Z"),
    });
    // ACC-PINV-2026-: teller 5 < hoogste 42 -> bijgewerkt.
    assert.ok(
      result.updated.some((r) => r.prefix === "ACC-PINV-2026-" && r.oldValue === 5 && r.newValue === 42)
    );
    // ACC-PINV-RET-2026-: teller 100 >= hoogste 3 -> ongewijzigd.
    assert.ok(result.unchanged.some((r) => r.prefix === "ACC-PINV-RET-2026-" && r.highest === 3 && r.value === 100));
  } finally {
    mock.restore();
  }
});

test("ensureNamingSeries: een fout bij één doctype blokkeert de andere doctypes niet", async () => {
  const current = { "TS-2026-": 9 };
  const mock = installFetchMock((url, init) => {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    if (path === "/api/resource/DocType/Broken") {
      return { status: 500, body: { exc: "boom" } };
    }
    if (path === "/api/resource/DocType/Timesheet") {
      return { status: 200, body: { data: NAMING_FIELD("TS-.YYYY.-\n") } };
    }
    if (path.includes("Document Naming Settings")) {
      return { status: 200, body: { data: { name: "Document Naming Settings" } } };
    }
    if (path === "/api/method/run_doc_method") {
      const payload = JSON.parse(init.body);
      const docsPayload = JSON.parse(payload.docs);
      if (payload.method === "get_current") {
        return { status: 200, body: { message: current[docsPayload.prefix] ?? 0 } };
      }
      current[docsPayload.prefix] = docsPayload.current_value;
      return { status: 200, body: { message: "ok" } };
    }
    // documentenlijst voor Timesheet
    return { status: 200, body: { data: [{ name: "TS-2026-00042" }] } };
  });
  const logs = installConsoleLogSpy();
  try {
    const result = await ensureNamingSeries({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      doctypes: ["Broken", "Timesheet"],
      now: new Date("2026-01-01T00:00:00Z"),
    });
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].doctype, "Broken");
    assert.equal(result.skipped[0].reason, "error");
    assert.deepEqual(result.updated, [{ doctype: "Timesheet", prefix: "TS-2026-", oldValue: 9, newValue: 42 }]);
  } finally {
    logs.restore();
    mock.restore();
  }
});

test("ensureNamingSeries: get_current komt terug als kaal getal in `message` (live geverifieerde vorm), niet als { current_value }", async () => {
  // Regressietest: de eerste live run tegen de productie-instance liet zien
  // dat run_doc_method("get_current") een kaal getal teruggeeft in
  // `message`, bv. {"message": 303}, niet {"message": {"current_value": 303}}.
  // Een implementatie die alleen `message.current_value` leest, leest dan
  // altijd `undefined` -> valt terug op 0 -> denkt dat de teller altijd
  // laag staat -> schrijft onnodig/foutief bij elke run.
  const current = { "TS-2026-": 303 };
  const mock = installFetchMock((url, init) => {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    if (path === "/api/resource/DocType/Timesheet") {
      return { status: 200, body: { data: NAMING_FIELD("TS-.YYYY.-\n") } };
    }
    if (path.includes("Document Naming Settings")) {
      return { status: 200, body: { data: { name: "Document Naming Settings" } } };
    }
    if (path === "/api/method/run_doc_method") {
      const payload = JSON.parse(init.body);
      const docsPayload = JSON.parse(payload.docs);
      assert.equal(payload.method, "get_current");
      return { status: 200, body: { message: current[docsPayload.prefix] } };
    }
    return { status: 200, body: { data: [{ name: "TS-2026-00303" }] } };
  });
  try {
    const result = await ensureNamingSeries({
      baseUrl: "https://example.frappe.cloud",
      token: "key:secret",
      doctypes: ["Timesheet"],
      now: new Date("2026-08-27T00:00:00Z"),
    });
    // Teller (303) == hoogste bestaande (303) -> geen update-call, ongewijzigd.
    assert.deepEqual(result.unchanged, [{ doctype: "Timesheet", prefix: "TS-2026-", highest: 303, value: 303 }]);
    assert.deepEqual(result.updated, []);
    const updateCalls = mock.calls.filter((c) => {
      if (!c.url.endsWith("run_doc_method")) return false;
      return JSON.parse(c.init.body).method === "update_series_start";
    });
    assert.equal(updateCalls.length, 0, "een correct gelezen, al-gelijke teller mag niet herschreven worden");
  } finally {
    mock.restore();
  }
});

test("ensureNamingSeries: DEFAULT_NAMING_SERIES_DOCTYPES bevat minstens de gevraagde kern-doctypes", () => {
  for (const dt of [
    "Timesheet",
    "Purchase Invoice",
    "Sales Invoice",
    "Quotation",
    "Sales Order",
    "Delivery Note",
    "Task",
    "Project",
  ]) {
    assert.ok(DEFAULT_NAMING_SERIES_DOCTYPES.includes(dt), `mist ${dt}`);
  }
});
