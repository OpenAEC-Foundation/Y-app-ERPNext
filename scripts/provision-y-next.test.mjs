import { test } from "node:test";
import assert from "node:assert/strict";

import {
  requiredEnv,
  buildMeetingNoteDoctype,
  buildSettingDoctype,
  provision,
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
  assert.ok(byRole["Projects User"]);
  assert.equal(byRole["Projects User"].read, 1);
  assert.equal(byRole["Projects User"].write, undefined);
  assert.equal(byRole["Projects User"].create, undefined);
  assert.equal(byRole["Projects User"].delete, undefined);
});

test("provision: slaat bestaande DocTypes over (GET 200 -> geen POST)", async () => {
  const mock = installFetchMock((url) => {
    if (/\/api\/resource\/DocType\//.test(url)) {
      return { status: 200, body: { data: { name: "existing" } } };
    }
    throw new Error(`Onverwachte call naar ${url}`);
  });
  try {
    const result = await provision({ baseUrl: "https://example.frappe.cloud", token: "key:secret" });
    assert.deepEqual(result.existing.sort(), ["Y Meeting Note", "Y Next Setting"]);
    assert.deepEqual(result.created, []);
    const postCalls = mock.calls.filter((c) => c.init?.method === "POST");
    assert.equal(postCalls.length, 0);
    // Beide DocTypes moeten opgezocht zijn.
    assert.equal(mock.calls.filter((c) => c.init?.method === undefined || c.init?.method === "GET").length, 2);
  } finally {
    mock.restore();
  }
});

test("provision: maakt een DocType aan wanneer GET 404 geeft", async () => {
  const mock = installFetchMock((url, init) => {
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
    const postCalls = mock.calls.filter((c) => c.init?.method === "POST");
    assert.equal(postCalls.length, 2);
    for (const call of postCalls) {
      const bodyText = call.init.body;
      assert.doesNotMatch(bodyText, /key:secret/);
    }
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
