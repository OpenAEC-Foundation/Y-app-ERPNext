#!/usr/bin/env node
/**
 * Provisioning-script voor Y-next custom DocTypes op ERPNext.
 *
 * Maakt (idempotent) de custom DocTypes aan die Y-next fase 2 nodig heeft:
 * `Y Meeting Note` (vergadernotities) en `Y Next Setting` (generieke
 * sleutel/waarde-opslag, o.a. voor extensies). Bestaat een DocType al, dan
 * gebeurt er niets — dit script is veilig herhaaldelijk te draaien.
 *
 * Auth komt UITSLUITEND uit de omgevingsvariabele YNEXT_API_TOKEN
 * (formaat "key:secret") — nooit in code, git, logs of buildoutput.
 * Basis-URL uit YNEXT_BASE_URL (default de productiesite).
 *
 * Gebruik: zie docs/deployment.md.
 *   node scripts/provision-y-next.mjs
 */
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";

const DEFAULT_BASE_URL = "https://open-aec-studio-erp.prilk.cloud";

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
 * Bouwt de DocType-definitie voor "Y Meeting Note" (vergadernotities).
 * @returns {object}
 */
export function buildMeetingNoteDoctype() {
  return {
    doctype: "DocType",
    name: "Y Meeting Note",
    module: "Custom",
    custom: 1,
    autoname: "format:YMN-{YYYY}-{#####}",
    fields: [
      { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 },
      { fieldname: "meeting_date", label: "Meeting Date", fieldtype: "Date" },
      { fieldname: "project", label: "Project", fieldtype: "Link", options: "Project" },
      { fieldname: "participants", label: "Participants", fieldtype: "Long Text" },
      { fieldname: "action_points", label: "Action Points", fieldtype: "Long Text" },
      { fieldname: "notes", label: "Notes", fieldtype: "Text Editor" },
      { fieldname: "linked_doctype", label: "Linked Doctype", fieldtype: "Data" },
      { fieldname: "linked_name", label: "Linked Name", fieldtype: "Data" },
    ],
    permissions: [
      { role: "System Manager", read: 1, write: 1, create: 1, delete: 1 },
      { role: "Projects User", read: 1, write: 1, create: 1, delete: 1 },
    ],
  };
}

/**
 * Bouwt de DocType-definitie voor "Y Next Setting" (generieke sleutel/waarde-opslag).
 * @returns {object}
 */
export function buildSettingDoctype() {
  return {
    doctype: "DocType",
    name: "Y Next Setting",
    module: "Custom",
    custom: 1,
    autoname: "field:setting_key",
    fields: [
      { fieldname: "setting_key", label: "Setting Key", fieldtype: "Data", reqd: 1, unique: 1 },
      { fieldname: "setting_value", label: "Setting Value", fieldtype: "Long Text" },
    ],
    permissions: [
      { role: "System Manager", read: 1, write: 1, create: 1, delete: 1 },
      { role: "All", read: 1 },
      { role: "Projects User", read: 1, write: 1, create: 1 },
    ],
  };
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

/**
 * Maakt één DocType aan als die nog niet bestaat. Logt uitsluitend de naam
 * en HTTP-status — nooit de token of andere headers.
 * @param {string} baseUrl
 * @param {string} token
 * @param {object} definition — moet een `name` bevatten
 * @returns {Promise<"created" | "existing">}
 */
async function ensureDoctype(baseUrl, token, definition) {
  const authHeader = `token ${token}`;
  const name = definition.name;
  const encodedName = encodeURIComponent(name);

  const getRes = await safeFetch(`${baseUrl}/api/resource/DocType/${encodedName}`, {
    headers: { Authorization: authHeader },
  });
  if (getRes.ok) {
    console.log(`DocType "${name}" bestaat al — overgeslagen [HTTP ${getRes.status}].`);
    return "existing";
  }
  if (getRes.status !== 404) {
    throw new Error(`Opzoeken DocType "${name}" mislukt: HTTP ${getRes.status}.`);
  }

  const postRes = await safeFetch(`${baseUrl}/api/resource/DocType`, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(definition),
  });
  if (!postRes.ok) {
    throw new Error(`Aanmaken DocType "${name}" mislukt: HTTP ${postRes.status}.`);
  }
  console.log(`DocType "${name}" aangemaakt [HTTP ${postRes.status}].`);
  return "created";
}

/**
 * Provisioneert alle Y-next custom DocTypes (idempotent): bestaat een
 * DocType al, dan wordt hij overgeslagen; anders wordt hij aangemaakt.
 * @param {{ baseUrl: string, token: string }} params
 * @returns {Promise<{ created: string[], existing: string[] }>}
 */
export async function provision({ baseUrl, token }) {
  const definitions = [buildMeetingNoteDoctype(), buildSettingDoctype()];
  const created = [];
  const existing = [];
  for (const definition of definitions) {
    const result = await ensureDoctype(baseUrl, token, definition);
    if (result === "created") created.push(definition.name);
    else existing.push(definition.name);
  }
  return { created, existing };
}

async function main() {
  const { baseUrl, token } = requiredEnv(process.env);
  console.log(`Provisioning Y-next custom DocTypes tegen ${baseUrl} ...`);
  const { created, existing } = await provision({ baseUrl, token });
  console.log(
    `Klaar. Aangemaakt: ${created.join(", ") || "geen"}. Al aanwezig: ${existing.join(", ") || "geen"}.`
  );
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error(redact(err && err.message ? err.message : String(err)));
    process.exitCode = 1;
  });
}
