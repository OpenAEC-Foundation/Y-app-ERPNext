#!/usr/bin/env node
/**
 * Visuele en runtime-controle van de live Y-next via headless Chrome.
 *
 * Rendert opgegeven hash-routes op de live /y-next, ingelogd via de
 * API-token als Authorization-header op elk request (geen wachtwoorden).
 * Per route: screenshot + rapport van consolefouten, mislukte requests en
 * calls naar endpoints die in Y-next niet meer bestaan (Express-only).
 *
 * Gebruik:
 *   YNEXT_API_TOKEN=key:secret node scripts/visual-check-y-next.mjs [route ...]
 *   (geen routes => standaardset)
 *
 * Output: temp/screens/<naam>.png + temp/screens/report.json
 * Logt nooit de token.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = (process.env.YNEXT_BASE_URL || "https://open-aec-studio-erp.prilk.cloud").replace(/\/+$/, "");
const TOKEN = process.env.YNEXT_API_TOKEN;
if (!TOKEN) {
  console.error("YNEXT_API_TOKEN is vereist");
  process.exit(1);
}

const FORBIDDEN = /\/api\/(mail|messenger|nextcloud|nas|calendar|meetings|stats|vault|passwords|agent|instances|yapp|auth\/|user-settings|shared-settings|synced-prefs|printview-html|erpnext-asset|desktop|services|status|i\/)|\/ws\//;

const DEFAULT_ROUTES = ["/", "/settings"];
const routes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROUTES;

// Fail fast on malformed routes (e.g. Git Bash/MSYS path-mangled CLI args —
// see routeToName below) before launching a browser or screenshotting
// anything, rather than crashing mid-run after some routes already ran.
for (const route of routes) {
  if (typeof route !== "string" || !route.startsWith("/")) {
    console.error(
      `Ongeldige route "${route}" — verwacht een route die met "/" begint. ` +
      `Op Git Bash/MSYS kan de shell een kaal "/route"-argument omzetten naar een ` +
      `absoluut Windows-pad (bv. "C:/Program Files/Git/route") vóórdat node het ` +
      `ziet. Zet in dat geval MSYS_NO_PATHCONV=1 vóór het commando, of gebruik een ` +
      `dubbele leidende slash ("//route").`
    );
    process.exit(1);
  }
}

const outDir = join(process.cwd(), "temp", "screens");
mkdirSync(outDir, { recursive: true });

const executablePaths = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

async function launch() {
  let lastError;
  for (const executablePath of executablePaths) {
    try {
      return await chromium.launch({ headless: true, executablePath });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Turn an app route ("/", "/leads", "/sales/123") into a safe screenshot
 * filename stem.
 *
 * On Git Bash/MSYS (Windows), a bare leading-slash CLI argument like
 * "/sales" is silently rewritten by the shell's POSIX-path conversion into
 * an absolute Windows path — e.g. "C:/Program Files/Git/sales" — *before*
 * node ever sees it, because MSYS treats a single leading "/" as its own
 * install root. Passed unguarded into the old implementation, that mangled
 * path degraded to a filename like "C_Program_Files_Git_sales.png": no
 * error, but also not a screenshot of anything meaningful (the equally
 * mangled `#${route}` hash used for the actual page load matched nothing,
 * so the app rendered its default view instead).
 *
 * Reject anything that isn't a real "/"-rooted route instead of silently
 * turning it into a plausible-looking but wrong filename.
 */
function routeToName(route) {
  if (typeof route !== "string" || !route.startsWith("/")) {
    throw new Error(
      `Ongeldige route "${route}" — verwacht een route die met "/" begint. ` +
      `Op Git Bash/MSYS kan de shell een kaal "/route"-argument omzetten naar een ` +
      `absoluut Windows-pad (bv. "C:/Program Files/Git/route") vóórdat node het ` +
      `ziet. Zet in dat geval MSYS_NO_PATHCONV=1 vóór het commando, of gebruik een ` +
      `dubbele leidende slash ("//route").`
    );
  }
  const clean = route.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9-]+/gi, "_");
  return clean || "dashboard";
}

const browser = await launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  extraHTTPHeaders: { Authorization: `token ${TOKEN}` },
});

const report = [];
for (const route of routes) {
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  const forbiddenCalls = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.method()} ${req.url().slice(0, 200)} — ${req.failure()?.errorText}`);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${url.slice(0, 200)}`);
    if (FORBIDDEN.test(url)) forbiddenCalls.push(`${res.status()} ${url.slice(0, 200)}`);
  });

  const name = routeToName(route);
  const target = `${BASE_URL}/y-next#${route}`;
  let loadError = null;
  try {
    await page.goto(target, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2500);
  } catch (error) {
    loadError = String(error && error.message ? error.message : error).slice(0, 300);
  }

  const shotPath = join(outDir, `${name}.png`);
  try {
    await page.screenshot({ path: shotPath, fullPage: false });
  } catch {
    /* screenshot best effort */
  }

  const entry = {
    route,
    screenshot: `temp/screens/${name}.png`,
    loadError,
    consoleErrors: consoleErrors.slice(0, 10),
    failedRequests: failedRequests.slice(0, 15),
    forbiddenCalls,
  };
  report.push(entry);
  const flag = loadError || forbiddenCalls.length || consoleErrors.length ? "!!" : "OK";
  console.log(`${flag} ${route} — console:${consoleErrors.length} failed:${failedRequests.length} verboden:${forbiddenCalls.length}`);
  await page.close();
}

await browser.close();
writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(`Rapport: temp/screens/report.json (${report.length} routes)`);
const bad = report.filter((r) => r.loadError || r.forbiddenCalls.length);
process.exit(bad.length ? 2 : 0);
