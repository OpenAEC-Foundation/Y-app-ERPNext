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

function routeToName(route) {
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
