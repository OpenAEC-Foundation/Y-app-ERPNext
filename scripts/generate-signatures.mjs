#!/usr/bin/env node
/**
 * Uniforme e-mailhandtekeningen voor alle medewerkers op ERPNext.
 *
 * Zet per actieve gebruiker een strakke, mailclient-veilige handtekening op
 * `User.email_signature`. Dat veld — niet `Email Account.signature` — is de
 * juiste plek: het is per *persoon*, terwijl een Email Account gedeeld is.
 * De Y-next-webmail leest hem daar ook als eerste (zie `getSignature()` in
 * `packages/frontend/src/lib/mail-erpnext.ts`).
 *
 * **Idempotent, en respecteert maatwerk.** Elke gegenereerde handtekening
 * eindigt op de marker `<!-- y-next-signature v1 -->`. Bij een herhaalde run:
 *
 *  - handtekening leeg          → schrijven;
 *  - handtekening MET marker    → overschrijven met de nieuwe versie;
 *  - handtekening ZONDER marker → overslaan (iemand heeft 'm zelf gemaakt),
 *    tenzij `--force`.
 *
 * De marker overleeft Frappe's HTML-sanitizer — live geverifieerd op de
 * doelinstance (Frappe 16.19.0). Wat Frappe wél doet bij het opslaan: een
 * `<tbody>` invoegen, `rel="noopener noreferrer"` aan links plakken en de
 * afsluitende `;` uit `style`-attributen halen. De opgeslagen HTML is dus
 * nooit byte-identiek aan wat wij sturen; daarom is er bewust géén
 * "ongewijzigd"-pad op basis van stringvergelijking — een marker-hit
 * betekent simpelweg herschrijven.
 *
 * **Geen afbeeldingen.** Een logo zou een externe URL of een base64-blob
 * vergen: het eerste breekt bij ontvangers die remote content blokkeren, het
 * tweede blaast elke uitgaande mail op. De huisstijl zit daarom volledig in
 * typografie en de merkkleuren (#043b42 / #006876, zie `index.css`).
 *
 * **Geen lege regels.** Ontbreekt een gegeven (functie, telefoon, website),
 * dan verdwijnt de hele regel — niet een lege `<div>`. Op de doelinstance is
 * `designation`/`cell_number` op de Employee-docs nog nergens gevuld, dus dit
 * is het normale geval, niet de uitzondering.
 *
 * Auth komt UITSLUITEND uit de omgevingsvariabele YNEXT_API_TOKEN
 * (formaat "key:secret") — nooit in code, git, logs of buildoutput.
 * Basis-URL uit YNEXT_BASE_URL (default de productiesite).
 *
 * Gebruik:
 *   node scripts/generate-signatures.mjs --dry-run
 *   node scripts/generate-signatures.mjs
 *   node scripts/generate-signatures.mjs --force
 */
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";

const DEFAULT_BASE_URL = "https://open-aec-studio-erp.prilk.cloud";

/** Marker die een door dit script gegenereerde handtekening herkenbaar maakt. */
export const SIGNATURE_MARKER = "<!-- y-next-signature v1 -->";

/**
 * Gebruikers die nooit een medewerkershandtekening horen te krijgen.
 * Het API-account waarmee dit script draait komt daar dynamisch bij (zie
 * `resolveApiUser`) — dat is een integratie-account, geen medewerker.
 */
const SYSTEM_USERS = new Set(["Administrator", "Guest"]);

/** Merkkleuren, gelijk aan `--color-y-purple` / `--color-y-teal` in index.css. */
const BRAND_DARK = "#043b42";
const BRAND_ACCENT = "#006876";

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

/** Leest de vlaggen uit argv (bewust tolerant: onbekende argumenten negeren). */
export function parseArgs(argv) {
  const args = new Set(argv);
  return { dryRun: args.has("--dry-run"), force: args.has("--force") };
}

/* ───────────────────────────── HTML-opbouw ───────────────────────────── */

/** Escapet tekst voor gebruik in HTML-inhoud én in een attribuutwaarde. */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Trimt een waarde tot een bruikbare string, of levert "" bij null/undefined. */
function str(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/**
 * Splitst een website in een klikbare href en een schone labeltekst.
 * `www.open-aec.com` → `{ href: "https://www.open-aec.com", label: "www.open-aec.com" }`
 */
function websiteParts(website) {
  const raw = str(website);
  if (!raw) return null;
  const hasScheme = /^https?:\/\//i.test(raw);
  const href = hasScheme ? raw : `https://${raw}`;
  const label = raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return { href, label };
}

/**
 * De volledige handtekening-HTML voor één persoon.
 *
 * Pure functie: geen IO, geen defaults uit de omgeving. Ontbrekende velden
 * leveren géén lege regel op — de betreffende `<div>` wordt weggelaten.
 *
 * @param {{ fullName: string, designation?: string, company?: string,
 *           email?: string, phone?: string, website?: string }} person
 * @returns {string} HTML, afgesloten met SIGNATURE_MARKER
 */
export function buildSignatureHtml(person) {
  const fullName = str(person?.fullName);
  const designation = str(person?.designation);
  const company = str(person?.company);
  const email = str(person?.email);
  const phone = str(person?.phone);
  const site = websiteParts(person?.website);

  const rows = [];
  rows.push(
    `<div style="font-size:15px;font-weight:bold;color:${BRAND_DARK};">${escapeHtml(fullName)}</div>`
  );
  if (designation) {
    rows.push(`<div style="color:#64748b;">${escapeHtml(designation)}</div>`);
  }
  if (company) {
    rows.push(
      `<div style="font-weight:bold;color:${BRAND_DARK};letter-spacing:0.2px;">${escapeHtml(company)}</div>`
    );
  }

  // E-mail en telefoon delen één regel — dat scheelt een regel zonder dat er
  // informatie sneuvelt. Ontbreken ze allebei, dan valt de regel weg.
  const contact = [];
  if (email) {
    contact.push(
      `<a href="mailto:${escapeHtml(email)}" style="color:${BRAND_ACCENT};text-decoration:none;">${escapeHtml(email)}</a>`
    );
  }
  if (phone) {
    const telHref = phone.replace(/[^\d+]/g, "");
    contact.push(
      `<a href="tel:${escapeHtml(telHref)}" style="color:${BRAND_ACCENT};text-decoration:none;">${escapeHtml(phone)}</a>`
    );
  }
  if (contact.length > 0) {
    rows.push(`<div>${contact.join(' <span style="color:#cbd5e1;">·</span> ')}</div>`);
  }

  if (site) {
    rows.push(
      `<div><a href="${escapeHtml(site.href)}" style="color:${BRAND_ACCENT};text-decoration:none;">${escapeHtml(site.label)}</a></div>`
    );
  }

  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ' +
    'style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;' +
    'font-size:13px;line-height:1.55;color:#334155;">' +
    "<tr>" +
    `<td style="border-left:3px solid ${BRAND_ACCENT};padding:1px 0 1px 12px;">` +
    rows.join("") +
    "</td></tr></table>" +
    SIGNATURE_MARKER
  );
}

/** true zodra een opgeslagen handtekening door dit script is gemaakt. */
export function hasMarker(html) {
  return String(html ?? "").includes(SIGNATURE_MARKER);
}

/**
 * Beslist wat er met één gebruiker moet gebeuren.
 * @returns {"write" | "skip"} — "skip" alleen bij handmatig maatwerk
 */
export function decideAction(currentSignature, force) {
  const current = str(currentSignature);
  if (!current) return "write";
  if (hasMarker(current)) return "write";
  return force ? "write" : "skip";
}

/* ──────────────────────────── ERPNext-toegang ──────────────────────────── */

/** fetch-wrapper die netwerkfouten redigeert vóór ze her-gegooid worden. */
async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    throw new Error(`Netwerkfout richting ${redact(url)}: ${redact(message)}`);
  }
}

/** GET op een REST-resource; gooit met status (nooit met headers) bij een fout. */
async function apiGet(baseUrl, token, path, description) {
  const res = await safeFetch(`${baseUrl}${path}`, {
    headers: { Authorization: `token ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`${description} mislukt: HTTP ${res.status}.`);
  }
  return res.json().catch(() => null);
}

/** Bouwt een `/api/resource/<doctype>?fields=...&filters=...`-pad. */
function listPath(doctype, fields, filters) {
  const params = [
    `fields=${encodeURIComponent(JSON.stringify(fields))}`,
    "limit_page_length=0",
  ];
  if (filters) params.push(`filters=${encodeURIComponent(JSON.stringify(filters))}`);
  return `/api/resource/${encodeURIComponent(doctype)}?${params.join("&")}`;
}

/** De gebruiker achter het API-token — die hoort geen handtekening te krijgen. */
async function resolveApiUser(baseUrl, token) {
  const body = await apiGet(
    baseUrl,
    token,
    "/api/method/frappe.auth.get_logged_user",
    "Opvragen van het API-account"
  );
  return str(body?.message);
}

/**
 * Verzamelt alle medewerkers met de gegevens die in een handtekening horen.
 *
 * Drie bronnen, in deze volgorde van gezag:
 *  1. `User`   — naam en e-mailadres (de login is het adres waarmee men mailt),
 *               plus `mobile_no`/`phone` als terugval voor het nummer.
 *  2. `Employee` — functie (`designation`), zakelijk mobiel (`cell_number`) en
 *               het bedrijf waar iemand onder valt.
 *  3. `Company` — bedrijfsnaam en website.
 *
 * Bewust géén terugval van het persoonlijke nummer op `Company.phone_no`: dat
 * veld bevat op de doelinstance het mobiele nummer van één persoon, en dat
 * onder ieders naam zetten is erger dan geen nummer tonen.
 *
 * Alleen `System User`s tellen mee: portaal-/websitegebruikers (klanten,
 * leveranciers) zijn geen medewerkers en mailen niet namens het bedrijf.
 *
 * @returns {Promise<Array<{ user: string, fullName: string, designation: string,
 *   company: string, email: string, phone: string, website: string,
 *   currentSignature: string }>>}
 */
export async function collectPeople({ baseUrl, token }) {
  const apiUser = await resolveApiUser(baseUrl, token).catch(() => "");

  const usersBody = await apiGet(
    baseUrl,
    token,
    listPath(
      "User",
      ["name", "full_name", "first_name", "last_name", "email_signature", "mobile_no", "phone"],
      [
        ["enabled", "=", 1],
        ["user_type", "=", "System User"],
      ]
    ),
    "Ophalen van de gebruikers"
  );
  const users = Array.isArray(usersBody?.data) ? usersBody.data : [];

  const employeesBody = await apiGet(
    baseUrl,
    token,
    listPath(
      "Employee",
      ["name", "employee_name", "user_id", "designation", "cell_number", "company", "status"],
      [["user_id", "is", "set"]]
    ),
    "Ophalen van de medewerkers"
  );
  const employees = Array.isArray(employeesBody?.data) ? employeesBody.data : [];

  // Meerdere Employee-rijen kunnen op dezelfde user staan (uit dienst + weer
  // in dienst). Een actieve rij wint altijd van een niet-actieve.
  const employeeByUser = new Map();
  for (const emp of employees) {
    const key = str(emp?.user_id).toLowerCase();
    if (!key) continue;
    const existing = employeeByUser.get(key);
    if (!existing || (str(emp?.status) === "Active" && str(existing.status) !== "Active")) {
      employeeByUser.set(key, emp);
    }
  }

  const companiesBody = await apiGet(
    baseUrl,
    token,
    listPath("Company", ["name", "company_name", "website"]),
    "Ophalen van de bedrijven"
  );
  const companies = Array.isArray(companiesBody?.data) ? companiesBody.data : [];
  const companyByName = new Map(companies.map((c) => [str(c?.name), c]));

  // Terugval voor gebruikers zonder Employee-koppeling: het standaardbedrijf.
  const defaultsBody = await apiGet(
    baseUrl,
    token,
    "/api/resource/Global%20Defaults/Global%20Defaults",
    "Ophalen van de standaardinstellingen"
  ).catch(() => null);
  const defaultCompany = str(defaultsBody?.data?.default_company);

  const people = [];
  for (const user of users) {
    const name = str(user?.name);
    if (!name || SYSTEM_USERS.has(name) || (apiUser && name === apiUser)) continue;

    const emp = employeeByUser.get(name.toLowerCase()) || null;
    const companyName = str(emp?.company) || defaultCompany;
    const company = companyByName.get(companyName) || null;

    const fullName =
      str(user?.full_name) ||
      [str(user?.first_name), str(user?.last_name)].filter(Boolean).join(" ") ||
      str(emp?.employee_name) ||
      name;

    people.push({
      user: name,
      fullName,
      designation: str(emp?.designation),
      company: str(company?.company_name) || companyName,
      email: name,
      phone: str(emp?.cell_number) || str(user?.mobile_no) || str(user?.phone),
      website: str(company?.website),
      currentSignature: str(user?.email_signature),
    });
  }

  people.sort((a, b) => a.fullName.localeCompare(b.fullName, "nl"));
  return people;
}

/** Schrijft één handtekening weg. Logt niets — dat doet de aanroeper. */
async function writeSignature(baseUrl, token, user, html) {
  const res = await safeFetch(`${baseUrl}/api/resource/User/${encodeURIComponent(user)}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email_signature: html }),
  });
  if (!res.ok) {
    throw new Error(`Handtekening schrijven mislukt: HTTP ${res.status}.`);
  }
}

/**
 * Zet de handtekening van elke medewerker. Zie de modulekop voor het
 * idempotentie- en maatwerkbeleid.
 *
 * @param {{ baseUrl: string, token: string, dryRun?: boolean, force?: boolean }} params
 * @returns {Promise<{ written: string[], skipped: string[], failed: string[],
 *   previews: Array<{ user: string, html: string }> }>}
 */
export async function generateSignatures({ baseUrl, token, dryRun = false, force = false }) {
  const people = await collectPeople({ baseUrl, token });
  const written = [];
  const skipped = [];
  const failed = [];
  const previews = [];

  for (const person of people) {
    const action = decideAction(person.currentSignature, force);
    if (action === "skip") {
      skipped.push(person.user);
      console.log(`${person.fullName}: overgeslagen (eigen handtekening, geen marker).`);
      continue;
    }

    const html = buildSignatureHtml(person);
    const verb = hasMarker(person.currentSignature) ? "bijgewerkt" : "gezet";

    if (dryRun) {
      previews.push({ user: person.user, html });
      console.log(`${person.fullName}: zou worden ${verb} (dry-run).`);
      console.log(html);
      continue;
    }

    try {
      await writeSignature(baseUrl, token, person.user, html);
      written.push(person.user);
      console.log(`${person.fullName}: ${verb}.`);
    } catch (err) {
      failed.push(person.user);
      console.log(`${person.fullName}: mislukt — ${redact(err?.message ?? String(err))}`);
    }
  }

  return { written, skipped, failed, previews };
}

async function main() {
  const { baseUrl, token } = requiredEnv(process.env);
  const { dryRun, force } = parseArgs(process.argv.slice(2));
  console.log(
    `Handtekeningen genereren tegen ${baseUrl}${dryRun ? " (dry-run)" : ""}${force ? " (force)" : ""} ...`
  );
  const { written, skipped, failed, previews } = await generateSignatures({
    baseUrl,
    token,
    dryRun,
    force,
  });
  console.log(
    `Klaar. ${dryRun ? `Zou schrijven: ${previews.length}` : `Geschreven: ${written.length}`}, ` +
      `overgeslagen: ${skipped.length}, mislukt: ${failed.length}.`
  );
  if (failed.length > 0) process.exitCode = 1;
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error(redact(err && err.message ? err.message : String(err)));
    process.exitCode = 1;
  });
}
