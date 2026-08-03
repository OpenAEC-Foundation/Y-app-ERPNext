#!/usr/bin/env node
/**
 * Provisioning-script voor Y-next op ERPNext.
 *
 * Twee fasen, beide idempotent:
 *
 * 1. **DocTypes** — maakt de custom DocTypes aan die Y-next fase 2 nodig
 *    heeft: `Y Meeting Note` (vergadernotities) en `Y Next Setting`
 *    (generieke sleutel/waarde-opslag, o.a. voor extensies). Bestaat een
 *    DocType al, dan gebeurt er niets.
 * 2. **Rechten** — zet de DocPerm-vlaggen op *bestaande* (core-)doctypes die
 *    Y-next nodig heeft maar die Frappe standaard niet geeft (zie
 *    `buildPermissionRules` voor het waarom per regel).
 *
 * Het script is veilig herhaaldelijk te draaien.
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
      // Rol "All" wordt door Frappe geweigerd bij API-aanmaak van custom
      // doctypes ("Non administrator user can not set the role All").
      // Projects User dekt alle Y-next-gebruikers, maar krijgt hier bewust
      // alléén leesrecht: de rijen in dit DocType zijn o.a. de
      // geïnstalleerde-extensies-lijst, die vervolgens draait met de
      // ERPNext-rechten van de kijker (zie ExtensionHost.tsx RPC-bridge).
      // Schrijfrecht voor élke Projects User zou een willekeurige medewerker
      // in staat stellen een eigen HTTPS-URL te installeren die dan in de
      // sessie van bv. een System Manager wordt uitgevoerd — een
      // privilege-escalatiepad. Schrijven/aanmaken/verwijderen is daarom
      // beheerdersactie (System Manager only).
      // Expliciete nullen zijn verplicht: Frappe vult ontbrekende
      // DocPerm-vlaggen met defaults (live waargenomen: een rij met alleen
      // read:1 werd r1w1c1d1), wat het read-only-oogmerk stil zou breken.
      { role: "System Manager", read: 1, write: 1, create: 1, delete: 1, submit: 0, cancel: 0, amend: 0 },
      { role: "Projects User", read: 1, write: 0, create: 0, delete: 0, submit: 0, cancel: 0, amend: 0 },
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

/* ─────────────────────────── Rechten (fase 2) ─────────────────────────── */

const PERM_MANAGER = "frappe.core.page.permission_manager.permission_manager";

/**
 * De DocPerm-vlaggen die Y-next nodig heeft op *bestaande* doctypes.
 *
 * WAAROM DIT NODIG IS — Frappe's core-DocPerms dekken deze paden niet:
 *
 * - **Communication / write op permlevel 0.** In Y-next is webmail geen
 *   IMAP-schil maar een view op de `Communication`-doctype. "Gelezen"
 *   markeren (`markRead`/`markUnread` → `seen`) en een bericht in een eigen
 *   map hangen (`tagMessage` → `_user_tags`, en de `add_tag`-RPC daarachter)
 *   zijn dus doodgewone *documentupdates*. Frappe's core-DocPerm op
 *   Communication geeft permlevel-0-`write` echter aan NIEMAND — System
 *   Manager heeft er `write: 0`, Inbox User `write: 0`, `All` (if_owner)
 *   `write: 0`; alleen permlevel 2 heeft write. Zonder deze regels faalt
 *   élke mark-read en élke maptoewijzing met een 403
 *   ("does not have doctype access via role permission") — instance-breed,
 *   voor iedere gebruiker. Zie e2e-report-1 §1.
 * - **ToDo / delete.** Y-next kan todo's aanmaken maar de core-DocPerm zet
 *   `delete: 0` voor System Manager, waardoor een per ongeluk aangemaakt
 *   todo permanent is (REST-DELETE én `frappe.client.delete` geven 403).
 *   Zie e2e-report-1 §2.
 *
 * Bewust géén `read`-regels: die zijn er al, en dit script hoort geen
 * rechten te verbreden die niemand mist.
 *
 * @returns {{ doctype: string, role: string, permlevel: number, ptype: string, value: number }[]}
 */
export function buildPermissionRules() {
  return [
    { doctype: "Communication", role: "Projects User", permlevel: 0, ptype: "write", value: 1 },
    { doctype: "Communication", role: "System Manager", permlevel: 0, ptype: "write", value: 1 },
    { doctype: "ToDo", role: "Projects User", permlevel: 0, ptype: "delete", value: 1 },
    { doctype: "ToDo", role: "System Manager", permlevel: 0, ptype: "delete", value: 1 },
  ];
}

/**
 * Haalt de huidige DocPerm-rijen van één doctype op via de Permission
 * Manager. Levert een lege lijst bij een onbruikbaar antwoord — dan wordt
 * elke regel als "rij ontbreekt" behandeld, en `add` is zelf idempotent
 * (Frappe's `add_permission` keert terug zodra de rij al bestaat).
 * @returns {Promise<object[]>}
 */
async function getPermissions(baseUrl, token, doctype) {
  const url = `${baseUrl}/api/method/${PERM_MANAGER}.get_permissions?doctype=${encodeURIComponent(doctype)}`;
  const res = await safeFetch(url, { headers: { Authorization: `token ${token}` } });
  if (!res.ok) {
    throw new Error(`Rechten opvragen voor "${doctype}" mislukt: HTTP ${res.status}.`);
  }
  const body = await res.json().catch(() => null);
  const rows = body && Array.isArray(body.message) ? body.message : [];
  return rows;
}

/** POST naar een Permission Manager-methode; gooit met status bij een fout. */
async function callPermManager(baseUrl, token, method, payload, description) {
  const res = await safeFetch(`${baseUrl}/api/method/${PERM_MANAGER}.${method}`, {
    method: "POST",
    headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`${description} mislukt: HTTP ${res.status}.`);
  }
}

/**
 * Zoekt de DocPerm-rij voor (rol, permlevel) tussen de opgehaalde rijen.
 * `if_owner`-rijen tellen niet mee: die geven alleen rechten op eigen
 * documenten en zijn dus geen vervanging voor de gevraagde rij.
 */
function findPermRow(rows, role, permlevel) {
  return rows.find(
    (r) => r && r.role === role && Number(r.permlevel) === Number(permlevel) && !Number(r.if_owner)
  ) || null;
}

/**
 * Zet alle regels uit `buildPermissionRules` idempotent op de instance.
 *
 * Per regel: eerst de huidige perms lezen; ontbreekt de (rol, permlevel)-rij
 * dan wordt die eerst toegevoegd (`add` maakt een rij met alleen `read: 1`),
 * en daarna wordt alleen bij een afwijkende waarde een `update` gestuurd.
 * Klopt de vlag al, dan gaat er niets over de lijn.
 *
 * @param {{ baseUrl: string, token: string, rules?: object[] }} params
 * @returns {Promise<{ added: string[], updated: string[], unchanged: string[] }>}
 */
export async function ensurePermissions({ baseUrl, token, rules = buildPermissionRules() }) {
  const added = [];
  const updated = [];
  const unchanged = [];
  /** @type {Map<string, object[]>} — één get_permissions-call per doctype. */
  const permsByDoctype = new Map();

  for (const rule of rules) {
    const { doctype, role, permlevel, ptype, value } = rule;
    const label = `${doctype}/${role}/${permlevel}/${ptype}`;

    if (!permsByDoctype.has(doctype)) {
      permsByDoctype.set(doctype, await getPermissions(baseUrl, token, doctype));
    }
    const rows = permsByDoctype.get(doctype);
    let row = findPermRow(rows, role, permlevel);

    if (!row) {
      await callPermManager(
        baseUrl,
        token,
        "add",
        { parent: doctype, role, permlevel },
        `Rol-rij toevoegen (${doctype}/${role}/${permlevel})`
      );
      // Frappe's add_permission maakt de rij aan met alleen `read: 1`; de
      // gevraagde vlag moet daarna nog gezet worden.
      row = { role, permlevel, read: 1 };
      rows.push(row);
      added.push(`${doctype}/${role}/${permlevel}`);
      console.log(`Rechten: rol-rij ${doctype}/${role} (permlevel ${permlevel}) toegevoegd.`);
    }

    if (Number(row[ptype] || 0) === Number(value)) {
      unchanged.push(label);
      console.log(`Rechten: ${label} staat al op ${value} — overgeslagen.`);
      continue;
    }

    await callPermManager(
      baseUrl,
      token,
      "update",
      { doctype, role, permlevel, ptype, value },
      `Recht zetten (${label})`
    );
    row[ptype] = value;
    updated.push(label);
    console.log(`Rechten: ${label} gezet op ${value}.`);
  }

  return { added, updated, unchanged };
}

/**
 * Provisioneert Y-next (idempotent): eerst de custom DocTypes — bestaat een
 * DocType al, dan wordt hij overgeslagen; anders wordt hij aangemaakt —
 * daarna de DocPerm-vlaggen uit `buildPermissionRules`. De rechtenfase komt
 * bewust ná de doctype-fase: een regel kan over een net aangemaakt DocType
 * gaan.
 * @param {{ baseUrl: string, token: string }} params
 * @returns {Promise<{ created: string[], existing: string[], permissions: { added: string[], updated: string[], unchanged: string[] } }>}
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
  const permissions = await ensurePermissions({ baseUrl, token });
  return { created, existing, permissions };
}

async function main() {
  const { baseUrl, token } = requiredEnv(process.env);
  console.log(`Provisioning Y-next tegen ${baseUrl} ...`);
  const { created, existing, permissions } = await provision({ baseUrl, token });
  console.log(
    `Klaar. Aangemaakt: ${created.join(", ") || "geen"}. Al aanwezig: ${existing.join(", ") || "geen"}. ` +
      `Rechten — rol-rijen toegevoegd: ${permissions.added.length}, gezet: ${permissions.updated.length}, ` +
      `ongewijzigd: ${permissions.unchanged.length}.`
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
