#!/usr/bin/env node
/**
 * Deploy Y-next naar ERPNext (single-tenant, geen Bench nodig).
 *
 * Publiceert de gebouwde SPA (packages/frontend/dist/) als publieke File-
 * documenten onder /files/<naam> en koppelt de loader aan de bestaande ERPNext
 * Web Page met route "y-next" (UPSERT: PUT als het document al bestaat, nooit
 * blind POSTen).
 *
 * Auth komt UITSLUITEND uit de omgevingsvariabele YNEXT_API_TOKEN
 * (formaat "key:secret") — nooit in code, git, logs of buildoutput.
 * Basis-URL uit YNEXT_BASE_URL (default de productiesite).
 *
 * Gebruik: zie docs/deployment.md.
 *   npm run deploy
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://open-aec-studio-erp.prilk.cloud";
const WEB_PAGE_ROUTE = "y-next";
const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Redigeert eventuele Authorization/token-fragmenten uit een string vóór logging. */
function redact(text) {
  return String(text)
    .replace(/authorization["']?\s*:\s*["']?[^"'\n,}]+/gi, "Authorization: [REDACTED]")
    .replace(/token\s+\S+/gi, "token [REDACTED]");
}

/**
 * Leest en valideert de vereiste omgeving.
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ baseUrl: string, token: string }}
 */
export function requiredEnv(env) {
  const token = env.YNEXT_API_TOKEN;
  if (!token) {
    throw new Error(
      "YNEXT_API_TOKEN ontbreekt. Zet de omgevingsvariabele (formaat 'key:secret') " +
        "voordat je dit script draait — zie docs/deployment.md."
    );
  }
  const rawBase = env.YNEXT_BASE_URL || DEFAULT_BASE_URL;
  const baseUrl = rawBase.replace(/\/+$/, "");
  return { baseUrl, token };
}

/**
 * Verzamelt alle uploadbare assets uit een platte dist-directory.
 * @param {string} distDir
 * @returns {{ name: string, path: string }[]}
 */
export function collectAssets(distDir) {
  const assets = [];
  const entries = readdirSync(distDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "index.html") continue;
    if (entry.name === ".vite") continue; // bevat manifest.json, geen uploadbaar asset
    if (entry.name === "sw.js") continue; // service worker wordt in fase 1 niet geregistreerd, hoort niet op /files
    if (entry.isDirectory()) {
      throw new Error(
        `Onverwachte submap "${entry.name}" in ${distDir} — de build moet plat zijn ` +
          `(build.assetsDir: "" in vite.config.ts). Draai de build opnieuw.`
      );
    }
    assets.push({ name: entry.name, path: join(distDir, entry.name) });
  }
  return assets;
}

/**
 * Bouwt de veldenset voor de ERPNext Web Page die de SPA host.
 * @param {{ entryJs: string, cssFiles: string[] }} params
 */
export function buildWebPageFields({ entryJs, cssFiles }) {
  const linkLines = (cssFiles || []).map(
    (css) =>
      `  document.head.appendChild(Object.assign(document.createElement("link"), { rel: "stylesheet", href: "/files/${css}" }));`
  );
  const javascript = [
    "(function () {",
    ...linkLines,
    `  import("/files/${entryJs}").catch(function (err) {`,
    '    console.error("Y-next kon niet laden:", err);',
    '    var root = document.getElementById("root");',
    "    if (root) {",
    '      root.textContent = "Y-next kon niet laden. Probeer de pagina te vernieuwen of neem contact op met beheer.";',
    "    }",
    "  });",
    "})();",
  ].join("\n");

  const css = [
    ".navbar, header.navbar, footer, .web-footer { display: none !important; }",
    ".page_content, .page-content, .container, .container-fluid, .page-container {",
    "  padding: 0 !important;",
    "  margin: 0 !important;",
    "  max-width: none !important;",
    "}",
    "#root { min-height: 100vh; }",
  ].join("\n");

  return {
    title: "Y-next",
    route: WEB_PAGE_ROUTE,
    published: 1,
    content_type: "HTML",
    dynamic_template: 0,
    full_width: 1,
    show_title: 0,
    insert_style: 0,
    main_section: '<div id="root" data-y-next-router="hash"></div>',
    javascript,
    css,
  };
}

const MIME_TYPES_BY_EXT = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".map": "application/json",
};

/**
 * Bepaalt het MIME-type voor een bestandsnaam op basis van de extensie.
 * Zonder expliciet type ontvangt de browser vaak `application/octet-stream`
 * (of laat Frappe het leeg), waardoor de dynamische ES-module-`import()` in
 * de loader kan stranden op MIME-afdwinging ("Failed to load module script").
 * @param {string} name
 * @returns {string}
 */
export function mimeTypeFor(name) {
  const match = /\.[^./\\]+$/.exec(name);
  const ext = match ? match[0].toLowerCase() : "";
  return MIME_TYPES_BY_EXT[ext] || "application/octet-stream";
}

/**
 * Haalt de build-tag uit een bestandsnaam met het patroon "y<tag>-..."
 * (zoals gegenereerd door build.rolldownOptions.output.* in vite.config.ts).
 * @param {string} name
 * @returns {string | null}
 */
export function extractBuildTag(name) {
  const match = /^y([a-z0-9]+)-/.exec(name);
  return match ? match[1] : null;
}

/**
 * Voegt — uitsluitend voor bestanden met de "y<tag>-"-prefix — een kleine
 * per-build marker toe aan de content van tekst-assets, vóór upload.
 *
 * Waarom: Frappe dedupliceert File-uploads op CONTENT. De naam-prefix uit
 * vite.config.ts maakt chunks met eigen imports vanzelf uniek (hun import-
 * paden veranderen mee), maar standalone tekst-assets zonder zulke
 * referenties (CSS, de rolldown-runtime-chunk, source-vrije chunks) kunnen
 * tussen builds byte-identiek blijven. Zonder marker geeft Frappe dan de
 * URL van de vorige upload terug — met een ANDERE naam dan deze build
 * verwacht — wat de hard-abort in de upload-loop triggert.
 *
 * public/-bestanden zonder prefix (3BM-Logo.svg, y-logo.svg, manifest.json,
 * vite.svg, ...) worden NIET aangepast: die moeten juist dedupliceren naar
 * hun bestaande /files/-URL (zelfde naam, geen probleem).
 *
 * @param {string} name
 * @param {Buffer} data
 * @param {string | null} buildTag
 * @returns {Buffer}
 */
export function addBuildMarker(name, data, buildTag) {
  if (!buildTag || !name.startsWith(`y${buildTag}-`)) {
    return data;
  }
  const match = /\.[^./\\]+$/.exec(name);
  const ext = match ? match[0].toLowerCase() : "";

  let marker;
  if (ext === ".js" || ext === ".mjs" || ext === ".css") {
    marker = `\n/* y-next build ${buildTag} */\n`;
  } else if (ext === ".svg") {
    marker = `\n<!-- y-next build ${buildTag} -->\n`;
  } else if (ext === ".json" || ext === ".map") {
    // Geen commentaarsyntax in JSON — alleen een parse-neutrale newline.
    marker = "\n";
  } else {
    // Overige/binaire bestanden: ongemoeid laten. Het abort-vangnet in de
    // upload-loop (assert file_url === "/files/" + naam) blijft de vangrail
    // voor deze randgevallen.
    return data;
  }
  return Buffer.concat([data, Buffer.from(marker, "utf8")]);
}

/**
 * Bepaalt of de Web Page geüpdatet (PUT) of aangemaakt (POST) moet worden.
 * @param {{ name: string }[]} lookupRows
 */
export function planUpsert(lookupRows) {
  const resource = "/api/resource/Web Page";
  if (Array.isArray(lookupRows) && lookupRows.length > 0) {
    return { method: "PUT", url: `${resource}/${lookupRows[0].name}` };
  }
  return { method: "POST", url: resource };
}

/** fetch-wrapper die netwerkfouten redigeert vóór ze her-gegooid worden. */
async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    throw new Error(`Netwerkfout richting ${redact(url)}: ${redact(message)}`);
  }
}

async function main() {
  const { baseUrl, token } = requiredEnv(process.env);
  const authHeader = `token ${token}`;

  // 1. Preflight: token verifiëren.
  console.log(`Preflight: token verifiëren tegen ${baseUrl} ...`);
  const preflightRes = await safeFetch(`${baseUrl}/api/method/frappe.auth.get_logged_user`, {
    headers: { Authorization: authHeader },
  });
  if (!preflightRes.ok) {
    throw new Error(`Preflight mislukt: HTTP ${preflightRes.status}. Controleer YNEXT_API_TOKEN.`);
  }
  const preflightBody = await preflightRes.json();
  console.log(`Preflight OK — ingelogd als: ${preflightBody.message}`);

  // 2. dist/ inlezen + manifest raadplegen voor entry JS + CSS.
  const distDir = join(ROOT, "packages/frontend/dist");
  const manifestPath = join(distDir, ".vite/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entryChunk = Object.values(manifest).find((chunk) => chunk.isEntry);
  if (!entryChunk) {
    throw new Error(`Geen entry-chunk (isEntry: true) gevonden in ${manifestPath}.`);
  }
  const entryJs = entryChunk.file;
  const cssFiles = entryChunk.css || [];
  const buildTag = extractBuildTag(entryJs);

  const assets = collectAssets(distDir);
  console.log(
    `Gevonden ${assets.length} assets in dist/ (entry: ${entryJs}, css: ${cssFiles.length}, build-tag: ${buildTag || "onbekend"}).`
  );

  // 3. Elk asset uploaden als publieke File.
  for (const asset of assets) {
    const data = addBuildMarker(asset.name, readFileSync(asset.path), buildTag);
    const form = new FormData();
    form.append("file", new Blob([data], { type: mimeTypeFor(asset.name) }), asset.name);
    form.append("is_private", "0");
    form.append("folder", "Home");

    const uploadRes = await safeFetch(`${baseUrl}/api/method/upload_file`, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: form,
    });
    if (!uploadRes.ok) {
      throw new Error(`Upload van "${asset.name}" mislukt: HTTP ${uploadRes.status}.`);
    }
    const uploadBody = await uploadRes.json();
    const fileUrl = uploadBody?.message?.file_url;
    const expectedUrl = `/files/${asset.name}`;
    if (fileUrl !== expectedUrl) {
      throw new Error(
        `HARD ABORT: upload van "${asset.name}" kreeg file_url "${fileUrl}" terug ` +
          `in plaats van "${expectedUrl}". Frappe heeft blijkbaar een naamcollisie met ` +
          `andere content hernoemd — dat breekt in-bundle chunk-verwijzingen. ` +
          `De Web Page is NIET aangeraakt.`
      );
    }
    console.log(`Upload OK: ${asset.name} (${data.length} bytes) -> ${fileUrl} [HTTP ${uploadRes.status}]`);
  }

  // 4. Bestaande Web Page opzoeken.
  const filters = encodeURIComponent(JSON.stringify([["route", "=", WEB_PAGE_ROUTE]]));
  const fields = encodeURIComponent(JSON.stringify(["name"]));
  const lookupRes = await safeFetch(
    `${baseUrl}/api/resource/Web Page?filters=${filters}&fields=${fields}`,
    { headers: { Authorization: authHeader } }
  );
  if (!lookupRes.ok) {
    throw new Error(`Opzoeken Web Page (route=${WEB_PAGE_ROUTE}) mislukt: HTTP ${lookupRes.status}.`);
  }
  const lookupBody = await lookupRes.json();
  const lookupRows = lookupBody.data || [];
  const plan = planUpsert(lookupRows);

  // 5. Vóór een PUT: backup van het bestaande document wegschrijven.
  if (plan.method === "PUT") {
    const existingRes = await safeFetch(`${baseUrl}${plan.url}`, {
      headers: { Authorization: authHeader },
    });
    if (!existingRes.ok) {
      throw new Error(`Ophalen bestaand Web Page-document mislukt: HTTP ${existingRes.status}.`);
    }
    const existingBody = await existingRes.json();
    const tempDir = join(ROOT, "temp");
    mkdirSync(tempDir, { recursive: true });
    const backupPath = join(
      tempDir,
      `webpage-${WEB_PAGE_ROUTE}-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
    writeFileSync(backupPath, JSON.stringify(existingBody, null, 2), "utf8");
    console.log(`Backup geschreven: ${backupPath}`);
  }

  // 6. PUT/POST met de nieuwe velden.
  const webPageFields = buildWebPageFields({ entryJs, cssFiles });
  const upsertRes = await safeFetch(`${baseUrl}${plan.url}`, {
    method: plan.method,
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(webPageFields),
  });
  if (!upsertRes.ok) {
    throw new Error(`${plan.method} van Web Page mislukt: HTTP ${upsertRes.status}.`);
  }
  console.log(`${plan.method} Web Page OK — route: /${WEB_PAGE_ROUTE} [HTTP ${upsertRes.status}]`);
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error(redact(err && err.message ? err.message : String(err)));
    process.exitCode = 1;
  });
}
