#!/usr/bin/env node
/**
 * Smoke-test voor de gedeployde Y-next SPA op ERPNext.
 *
 * Zonder auth: controleert alleen dat de Web Page publiek bereikbaar is en
 * het root-element bevat. Met YNEXT_API_TOKEN gezet: controleert daarnaast
 * dat elk /files/-asset waarnaar de Web Page verwijst ook echt 200 teruggeeft,
 * en dat het token werkt.
 *
 * Print UITSLUITEND statussen en bestandsnamen — nooit headers of het token.
 *
 * Gebruik: zie docs/deployment.md.
 *   npm run smoke
 */
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";

const DEFAULT_BASE_URL = "https://open-aec-studio-erp.prilk.cloud";
const WEB_PAGE_ROUTE = "y-next";

function baseUrlFrom(env) {
  const raw = env.YNEXT_BASE_URL || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

/** Vindt alle /files/...-verwijzingen in een stuk tekst (HTML of JS-veld). */
export function extractFileRefs(text) {
  const matches = String(text).match(/\/files\/[^\s"'<>)]+/g) || [];
  return [...new Set(matches)];
}

async function checkRootPageIsPublic(baseUrl) {
  const url = `${baseUrl}/${WEB_PAGE_ROUTE}`;
  const res = await fetch(url);
  console.log(`GET ${url} -> HTTP ${res.status}`);
  if (!res.ok) {
    throw new Error(`Web Page /${WEB_PAGE_ROUTE} is niet publiek bereikbaar (HTTP ${res.status}).`);
  }
  const html = await res.text();
  if (!/id="root"/.test(html)) {
    throw new Error(`Web Page /${WEB_PAGE_ROUTE} bevat geen element met id="root".`);
  }
  console.log(`OK: /${WEB_PAGE_ROUTE} bevat id="root".`);
  return html;
}

async function checkAssetsReferencedByWebPage(baseUrl, token) {
  const filters = encodeURIComponent(JSON.stringify([["route", "=", WEB_PAGE_ROUTE]]));
  const fields = encodeURIComponent(JSON.stringify(["name", "javascript", "css", "main_section"]));
  const res = await fetch(`${baseUrl}/api/resource/Web Page?filters=${filters}&fields=${fields}`, {
    headers: { Authorization: `token ${token}` },
  });
  console.log(`GET /api/resource/Web Page (lookup) -> HTTP ${res.status}`);
  if (!res.ok) {
    throw new Error(`Ophalen Web Page-metadata mislukt: HTTP ${res.status}.`);
  }
  const body = await res.json();
  const row = (body.data || [])[0];
  if (!row) {
    throw new Error(`Geen Web Page gevonden met route=${WEB_PAGE_ROUTE}.`);
  }
  const refs = extractFileRefs(`${row.javascript || ""}\n${row.css || ""}\n${row.main_section || ""}`);
  console.log(`Gevonden ${refs.length} /files/-verwijzingen in de Web Page.`);
  for (const ref of refs) {
    const assetRes = await fetch(`${baseUrl}${ref}`);
    console.log(`GET ${ref} -> HTTP ${assetRes.status}`);
    if (!assetRes.ok) {
      throw new Error(`Asset ${ref} is niet bereikbaar (HTTP ${assetRes.status}).`);
    }
  }
}

async function checkTokenWorks(baseUrl, token) {
  const res = await fetch(`${baseUrl}/api/method/frappe.auth.get_logged_user`, {
    headers: { Authorization: `token ${token}` },
  });
  console.log(`GET /api/method/frappe.auth.get_logged_user -> HTTP ${res.status}`);
  if (!res.ok) {
    throw new Error(`Token-check mislukt: HTTP ${res.status}.`);
  }
}

async function main() {
  const baseUrl = baseUrlFrom(process.env);
  const token = process.env.YNEXT_API_TOKEN;

  await checkRootPageIsPublic(baseUrl);

  if (token) {
    await checkTokenWorks(baseUrl, token);
    await checkAssetsReferencedByWebPage(baseUrl, token);
  } else {
    console.log("YNEXT_API_TOKEN niet gezet — sla auth-checks en asset-verificatie over.");
  }

  console.log("Smoke-test geslaagd.");
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : String(err));
    process.exitCode = 1;
  });
}
