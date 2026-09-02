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
 * **Begint met de groet.** De handtekening opent met "Met vriendelijke groet,"
 * — zie `SIGNATURE_GREETING` voor waarom die regel hier hoort en niet in de
 * losse berichtteksten.
 *
 * **Idempotent, en respecteert maatwerk.** Elke gegenereerde handtekening
 * eindigt op de marker `<!-- y-next-signature v3 -->`. Bij een herhaalde run:
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
 * betekent simpelweg herschrijven. `hasMarker` herkent élk versienummer, zodat
 * een v1- of v2-handtekening bij deze run gewoon naar v3 wordt bijgewerkt.
 *
 * **Eén logo, en alleen een publieke URL.** `Company.company_logo` wijst op
 * deze instance naar een Frappe-File. Staat die onder `/private/files/`, dan
 * ziet de ontvanger een kapot icoon — die kan immers niet inloggen. Daarom
 * accepteert `resolveLogoUrl` uitsluitend een `/files/`-pad (of een complete
 * https-URL) en laat het logo anders wég. Een base64-blob is bewust géén optie:
 * dat blaast elke uitgaande mail op.
 *
 * **Geen lege regels.** Ontbreekt een gegeven (functie, telefoon, adres,
 * website, KvK/BTW/IBAN), dan verdwijnt de hele regel — niet een lege `<div>`.
 * De KvK/BTW/IBAN-voetregel verschijnt alleen als er minstens één van de drie
 * bekend is.
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
export const SIGNATURE_MARKER = "<!-- y-next-signature v3 -->";

/**
 * De groetregel, en waarom hij hier hoort.
 *
 * "Met vriendelijke groet," is geen vrije tekst per mail maar een vast
 * onderdeel van de afsluiting: hij hoort altijd, en altijd op dezelfde manier,
 * boven de naam te staan. Door hem in de handtekening te zetten staat hij in
 * élke mail goed — ook in de mails die de app zelf opstelt (offerte,
 * betalingsherinnering), want ERPNext plakt de `User.email_signature` daar
 * onder de inhoud.
 *
 * De keerzijde: elke plek die zélf een groet in de tekst zette, groet nu
 * dubbel. Daarom zijn die groetregels uit de standaardteksten gehaald
 * (`quotation_create.email_body_default`, `sales_invoices.reminder_email_body`)
 * — de groet komt voortaan uit één bron. De opsteller van de webmail voegde
 * nooit zelf een groet toe en hoefde dus niet aangepast te worden.
 */
export const SIGNATURE_GREETING = "Met vriendelijke groet,";

/**
 * Herkent élke versie van onze marker. Cruciaal voor de upgrade: een
 * handtekening die nog `v1` draagt is óók van ons en moet worden bijgewerkt,
 * niet als handmatig maatwerk overgeslagen.
 */
const MARKER_PATTERN = /<!--\s*y-next-signature v\d+\s*-->/i;

/**
 * Gebruikers die nooit een medewerkershandtekening horen te krijgen.
 * Het API-account waarmee dit script draait komt daar dynamisch bij (zie
 * `resolveApiUser`) — dat is een integratie-account, geen medewerker.
 */
const SYSTEM_USERS = new Set(["Administrator", "Guest"]);

/** Merkkleuren, gelijk aan `--color-y-purple` / `--color-y-teal` in index.css. */
const BRAND_DARK = "#043b42";
const BRAND_ACCENT = "#006876";

/**
 * Logo-afmetingen. Alleen de breedte staat vast; de hoogte laten we los zodat
 * elke aspectratio onvervormd blijft. Outlook's Word-renderer schaalt dan
 * proportioneel mee.
 */
const LOGO_WIDTH = 96;
const LOGO_GUTTER = 14;

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
 * Zet een IBAN om naar de leesbare, gespatieerde notatie.
 * `NL95RABO0169749509` → `NL95 RABO 0169 7495 09`. Bestaande spaties en
 * kleine letters worden genormaliseerd; een lege waarde blijft leeg.
 */
export function formatIban(iban) {
  const compact = str(iban).replace(/\s+/g, "").toUpperCase();
  if (!compact) return "";
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Zet een waarde voor met een label, tenzij ze dat label al zélf draagt.
 * `Company.registration_details` bevat op deze instance letterlijk
 * "KvK 99480697"; er "KvK " vóór plakken zou "KvK KvK 99480697" opleveren.
 */
function labelled(label, value) {
  const raw = str(value);
  if (!raw) return "";
  return new RegExp(`^${label}\\b`, "i").test(raw) ? raw : `${label} ${raw}`;
}

/**
 * De publieke, absolute URL van het bedrijfslogo — of "" als die er niet is.
 *
 * Alleen `/files/…` (publiek) en complete http(s)-URL's tellen mee. Een
 * `/private/files/…`-pad wordt bewust genegeerd: de ontvanger van de mail is
 * niet ingelogd op ERPNext en zou een kapot icoon zien.
 */
export function resolveLogoUrl(logoPath, baseUrl) {
  const raw = str(logoPath);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith("/files/")) return "";
  const base = str(baseUrl).replace(/\/+$/, "");
  return base ? `${base}${raw}` : "";
}

/** Een teal link met de merkkleur — overal in de handtekening identiek. */
function link(href, label) {
  return `<a href="${escapeHtml(href)}" style="color:${BRAND_ACCENT};text-decoration:none;">${escapeHtml(label)}</a>`;
}

/**
 * De volledige handtekening-HTML voor één persoon.
 *
 * Pure functie: geen IO, geen defaults uit de omgeving.
 *
 * Opbouw — bewust mailclient-veilig: één `<table>` met twee cellen (links het
 * logo, rechts de tekst, gescheiden door een teal accentlijn), volledig inline
 * styles, vaste px, geen flex/grid, geen webfonts. Dat is wat Outlook (Word-
 * renderer), Gmail en Apple Mail alle drie voorspelbaar tonen.
 *
 * Ontbrekende velden leveren géén lege regel op — de betreffende `<div>` valt
 * weg. De KvK/BTW/IBAN-voetregel verschijnt alleen als er iets in staat.
 *
 * @param {{ fullName: string, designation?: string, company?: string,
 *           email?: string, phone?: string, website?: string,
 *           addressLine?: string, postalCity?: string, logoUrl?: string,
 *           registration?: string, taxId?: string, iban?: string }} person
 * @returns {string} HTML, afgesloten met SIGNATURE_MARKER
 */
export function buildSignatureHtml(person) {
  const fullName = str(person?.fullName);
  const designation = str(person?.designation);
  const company = str(person?.company);
  const email = str(person?.email);
  const phone = str(person?.phone);
  const addressLine = str(person?.addressLine);
  const postalCity = str(person?.postalCity);
  const logoUrl = str(person?.logoUrl);
  const site = websiteParts(person?.website);

  const rows = [];
  // De groet opent de handtekening — zelfde lettertype en -grootte als de rest
  // van de tekstcel, met alleen wat lucht eronder in plaats van een witregel.
  rows.push(
    `<div style="padding-bottom:6px;">${escapeHtml(SIGNATURE_GREETING)}</div>`
  );
  rows.push(
    `<div style="font-size:15px;font-weight:bold;line-height:1.25;color:${BRAND_DARK};">${escapeHtml(fullName)}</div>`
  );
  if (designation) {
    rows.push(`<div style="color:#475569;">${escapeHtml(designation)}</div>`);
  }
  if (company) {
    rows.push(
      `<div style="font-weight:bold;color:${BRAND_DARK};letter-spacing:0.2px;padding-top:2px;">${escapeHtml(company)}</div>`
    );
  }
  if (addressLine) {
    rows.push(`<div>${escapeHtml(addressLine)}</div>`);
  }
  if (postalCity) {
    rows.push(`<div>${escapeHtml(postalCity)}</div>`);
  }

  // Telefoon en e-mail delen één regel — dat scheelt een regel zonder dat er
  // informatie sneuvelt. Ontbreken ze allebei, dan valt de regel weg.
  const contact = [];
  if (phone) {
    contact.push(link(`tel:${phone.replace(/[^\d+]/g, "")}`, phone));
  }
  if (email) {
    contact.push(link(`mailto:${email}`, email));
  }
  if (contact.length > 0) {
    rows.push(
      `<div style="padding-top:2px;">${contact.join(' <span style="color:#cbd5e1;">·</span> ')}</div>`
    );
  }
  if (site) {
    rows.push(`<div>${link(site.href, site.label)}</div>`);
  }

  // Voetregel met de formele gegevens: klein, grijs, één regel.
  const legal = [
    labelled("KvK", person?.registration),
    labelled("BTW", person?.taxId),
    labelled("IBAN", formatIban(person?.iban)),
  ].filter(Boolean);
  if (legal.length > 0) {
    rows.push(
      '<div style="padding-top:7px;font-size:11px;line-height:1.4;color:#64748b;">' +
        escapeHtml(legal.join(" · ")) +
        "</div>"
    );
  }

  const logoCell = logoUrl
    ? `<td width="${LOGO_WIDTH}" valign="top" style="padding:0 ${LOGO_GUTTER}px 0 0;vertical-align:top;">` +
      `<img src="${escapeHtml(logoUrl)}" width="${LOGO_WIDTH}" alt="${escapeHtml(company || fullName)}" ` +
      `style="display:block;border:0;outline:none;text-decoration:none;width:${LOGO_WIDTH}px;max-width:${LOGO_WIDTH}px;height:auto;">` +
      "</td>"
    : "";

  // Zonder logo blijft de accentlijn de linkerrand — met logo scheidt hij de
  // twee kolommen. In beide gevallen exact dezelfde tekstcel.
  const textCell =
    `<td valign="top" style="vertical-align:top;border-left:3px solid ${BRAND_ACCENT};` +
    `padding:1px 0 1px ${LOGO_GUTTER}px;font-family:Arial,Helvetica,sans-serif;` +
    "font-size:13px;line-height:1.35;color:#334155;\">" +
    rows.join("") +
    "</td>";

  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ' +
    'style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;' +
    'font-size:13px;line-height:1.35;color:#334155;">' +
    "<tr>" +
    logoCell +
    textCell +
    "</tr></table>" +
    SIGNATURE_MARKER
  );
}

/**
 * true zodra een opgeslagen handtekening door dit script is gemaakt — welke
 * versie dan ook, zodat een oude v1 of v2 bij deze run naar v3 wordt
 * bijgewerkt.
 */
export function hasMarker(html) {
  return MARKER_PATTERN.test(String(html ?? ""));
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
 * Haalt per bedrijf het eigen vestigingsadres op.
 *
 * `Address.is_your_company_address = 1` markeert een eigen adres, maar zégt
 * niet van wélk bedrijf — die koppeling zit in de `Dynamic Link`-childtabel.
 * Daarom eerst de namen ophalen, dan per adres het hele doc (dat de `links`
 * meelevert). Het aantal eigen adressen is per definitie klein.
 *
 * @returns {Promise<Map<string, { addressLine: string, postalCity: string }>>}
 */
async function collectCompanyAddresses(baseUrl, token) {
  const byCompany = new Map();
  const listBody = await apiGet(
    baseUrl,
    token,
    listPath("Address", ["name"], [["is_your_company_address", "=", 1]]),
    "Ophalen van de bedrijfsadressen"
  ).catch(() => null);
  const names = Array.isArray(listBody?.data) ? listBody.data : [];

  for (const row of names) {
    const name = str(row?.name);
    if (!name) continue;
    const body = await apiGet(
      baseUrl,
      token,
      `/api/resource/Address/${encodeURIComponent(name)}`,
      "Ophalen van een bedrijfsadres"
    ).catch(() => null);
    const doc = body?.data;
    if (!doc) continue;

    const addressLine = [str(doc.address_line1), str(doc.address_line2)].filter(Boolean).join(", ");
    const postalCity = [str(doc.pincode), str(doc.city)].filter(Boolean).join(" ");
    if (!addressLine && !postalCity) continue;

    for (const l of Array.isArray(doc.links) ? doc.links : []) {
      if (str(l?.link_doctype) !== "Company") continue;
      const company = str(l?.link_name);
      if (company && !byCompany.has(company)) byCompany.set(company, { addressLine, postalCity });
    }
  }
  return byCompany;
}

/**
 * Haalt per bedrijf het IBAN van de eerste actieve eigen bankrekening op.
 * @returns {Promise<Map<string, string>>}
 */
async function collectCompanyIbans(baseUrl, token) {
  const body = await apiGet(
    baseUrl,
    token,
    listPath(
      "Bank Account",
      ["name", "iban", "company", "disabled"],
      [["is_company_account", "=", 1]]
    ),
    "Ophalen van de bankrekeningen"
  ).catch(() => null);
  const rows = Array.isArray(body?.data) ? body.data : [];
  const byCompany = new Map();
  for (const row of rows) {
    if (row?.disabled) continue;
    const company = str(row?.company);
    const iban = str(row?.iban);
    if (!company || !iban || byCompany.has(company)) continue;
    byCompany.set(company, iban);
  }
  return byCompany;
}

/**
 * Verzamelt alle medewerkers met de gegevens die in een handtekening horen.
 *
 * Vijf bronnen, in deze volgorde van gezag:
 *  1. `User`   — naam en e-mailadres (de login is het adres waarmee men mailt),
 *               plus `mobile_no`/`phone` als terugval voor het nummer.
 *  2. `Employee` — functie (`designation`), zakelijk mobiel (`cell_number`) en
 *               het bedrijf waar iemand onder valt.
 *  3. `Company` — bedrijfsnaam, website, logo, `tax_id` (BTW),
 *               `registration_details` (KvK) en `phone_no` als laatste terugval
 *               voor het telefoonnummer.
 *  4. `Address` — het eigen vestigingsadres, via de `Dynamic Link`-koppeling.
 *  5. `Bank Account` — het IBAN van de eigen rekening.
 *
 * Het persoonlijke nummer wint altijd van `Company.phone_no`; die laatste is
 * een algemeen bedrijfsnummer en dus alleen een terugval.
 *
 * Alleen `System User`s tellen mee: portaal-/websitegebruikers (klanten,
 * leveranciers) zijn geen medewerkers en mailen niet namens het bedrijf.
 *
 * @returns {Promise<Array<{ user: string, fullName: string, designation: string,
 *   company: string, email: string, phone: string, website: string,
 *   addressLine: string, postalCity: string, logoUrl: string,
 *   registration: string, taxId: string, iban: string,
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
    listPath("Company", [
      "name",
      "company_name",
      "website",
      "company_logo",
      "phone_no",
      "tax_id",
      "registration_details",
    ]),
    "Ophalen van de bedrijven"
  );
  const companies = Array.isArray(companiesBody?.data) ? companiesBody.data : [];
  const companyByName = new Map(companies.map((c) => [str(c?.name), c]));

  const addressByCompany = await collectCompanyAddresses(baseUrl, token);
  const ibanByCompany = await collectCompanyIbans(baseUrl, token);

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
    const address = addressByCompany.get(companyName) || null;

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
      phone:
        str(emp?.cell_number) ||
        str(user?.mobile_no) ||
        str(user?.phone) ||
        str(company?.phone_no),
      website: str(company?.website),
      addressLine: str(address?.addressLine),
      postalCity: str(address?.postalCity),
      logoUrl: resolveLogoUrl(company?.company_logo, baseUrl),
      registration: str(company?.registration_details),
      taxId: str(company?.tax_id),
      iban: str(ibanByCompany.get(companyName)),
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
