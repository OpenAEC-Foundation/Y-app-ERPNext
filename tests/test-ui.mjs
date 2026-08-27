#!/usr/bin/env node
/**
 * Y-app — Full UI/API Test Script
 * Tests all backend endpoints used by every frontend page.
 * Usage: node test-ui.mjs
 */

const API = "http://localhost:3001";
const INSTANCES = ["3bm", "impertio", "symitech"];

let passed = 0, failed = 0, warned = 0;
const failures = [];

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function pass(msg, detail) {
  passed++;
  console.log(`  ${green("PASS")} ${msg}${detail ? dim(` (${detail})`) : ""}`);
}
function fail(msg, err) {
  failed++;
  failures.push({ msg, err });
  console.log(`  ${red("FAIL")} ${msg} — ${red(err)}`);
}
function warn(msg, detail) {
  warned++;
  console.log(`  ${yellow("WARN")} ${msg}${detail ? ` — ${yellow(detail)}` : ""}`);
}
function section(name) {
  console.log(`\n${bold("━━━ " + name + " ━━━")}`);
}

async function fetchJson(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    clearTimeout(timer);
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, ok: res.ok, json, text };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, ok: false, json: null, text: "", error: err.message };
  }
}

// Test a cached doctype endpoint
async function testDoctype(pageName, doctype, instance, extraParams = "") {
  const url = `${API}/api/resource/${encodeURIComponent(doctype)}?instance=${instance}&fields=${encodeURIComponent('["name"]')}&limit_page_length=3${extraParams}`;
  const r = await fetchJson(url);
  const label = `${pageName}: ${doctype} [${instance}]`;
  if (r.error) return fail(label, r.error);
  if (r.status === 401) return fail(label, "401 Unauthorized");
  if (r.status === 404) return warn(label, "404 — doctype may not exist on this instance");
  if (!r.ok) return fail(label, `HTTP ${r.status}`);
  const count = r.json?.data?.length ?? 0;
  pass(label, `${count} records`);
}

// Test a direct API endpoint
async function testEndpoint(pageName, path, instance) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API}${path}${instance ? `${sep}instance=${instance}` : ""}`;
  const r = await fetchJson(url);
  const label = `${pageName}: ${path}${instance ? ` [${instance}]` : ""}`;
  if (r.error) return fail(label, r.error);
  if (r.status === 401) return fail(label, "401 Unauthorized");
  if (!r.ok) return warn(label, `HTTP ${r.status}: ${(r.json?.error || r.text || "").slice(0, 100)}`);
  pass(label, r.json?.data ? `${Array.isArray(r.json.data) ? r.json.data.length + " items" : "ok"}` : "ok");
}

async function run() {
  console.log(bold("\nY-app — Full API Test\n"));
  console.log(dim(`Backend: ${API}`));
  console.log(dim(`Instances: ${INSTANCES.join(", ")}`));
  console.log(dim(`Time: ${new Date().toLocaleString("nl-NL")}\n`));

  // ─── Backend health ───
  section("Backend Health");
  await testEndpoint("Status", "/api/status");
  await testEndpoint("Instances", "/api/instances");
  await testEndpoint("Vault", "/api/vault");
  await testEndpoint("Config path", "/api/config-path");
  await testEndpoint("Passwords", "/api/passwords");

  // ─── Per-instance cached doctypes ───
  for (const inst of INSTANCES) {
    section(`Cached Data [${inst}]`);

    // Core
    await testDoctype("Dashboard", "Task", inst);
    await testDoctype("Projecten", "Project", inst);
    await testDoctype("Medewerkers", "Employee", inst);
    await testDoctype("Timesheets", "Timesheet", inst);

    // Sales & Purchase
    await testDoctype("Verkoopfacturen", "Sales Invoice", inst);
    await testDoctype("Inkoopfacturen", "Purchase Invoice", inst);
    await testDoctype("Offertes", "Quotation", inst);
    await testDoctype("Opdrachtbevestigingen", "Sales Order", inst);
    await testDoctype("Delivery Notes", "Delivery Note", inst);

    // Accounting
    await testDoctype("Grootboeken", "Account", inst);
    await testDoctype("Banktransacties", "Bank Transaction", inst);
    await testDoctype("Boekingsprogramma", "Journal Entry", inst);

    // HR
    await testDoctype("Vakantie", "Leave Application", inst);
    await testDoctype("Vakantie", "Leave Allocation", inst);
    await testDoctype("Onkosten", "Expense Claim", inst);

    // Other
    await testDoctype("Todo", "ToDo", inst);
    await testDoctype("Planning", "Activity Type", inst);
    await testDoctype("Bedrijven", "Company", inst);
    await testDoctype("Adressen", "Address", inst);
  }

  // ─── Mail ───
  section("Mail");
  await testEndpoint("Mail", "/api/mail/cache-stats");
  for (const inst of INSTANCES) {
    await testEndpoint("Mail warmup status", `/api/mail/warm?instance=${inst}&email=test@test.com`);
  }

  // ─── Messenger ───
  section("Messenger");
  for (const inst of INSTANCES) {
    await testEndpoint("Messenger services", `/api/instances/${inst}/services`);
  }

  // ─── Health checks ───
  section("Health Checks");
  await testEndpoint("Health report", "/api/health");

  // ─── NextCloud ───
  section("NextCloud");
  for (const inst of INSTANCES) {
    await testEndpoint("NextCloud files", `/api/nextcloud/files?path=/&instance=${inst}`);
  }

  // ─── Proxy tests (non-cached doctypes) ───
  section("Proxy / Non-cached Doctypes");
  for (const inst of INSTANCES) {
    await testDoctype("Wiki", "Wiki Page", inst);
    await testDoctype("Agenda", "Event", inst);
  }

  // ─── Frontend ───
  section("Frontend (Vite dev server)");
  const viteR = await fetchJson("http://localhost:5173/");
  if (viteR.ok) {
    pass("Vite dev server", "responding");
  } else if (viteR.error) {
    warn("Vite dev server", `not running: ${viteR.error}`);
  } else {
    warn("Vite dev server", `HTTP ${viteR.status}`);
  }

  // ─── Summary ───
  console.log(`\n${bold("━━━ SUMMARY ━━━")}`);
  console.log(`  ${green(`${passed} passed`)}  ${failed ? red(`${failed} failed`) : dim("0 failed")}  ${warned ? yellow(`${warned} warnings`) : dim("0 warnings")}`);

  if (failures.length > 0) {
    console.log(`\n${bold("Failures:")}`);
    for (const f of failures) {
      console.log(`  ${red("x")} ${f.msg}: ${f.err}`);
    }
  }

  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(red("Fatal error:"), err);
  process.exit(2);
});
