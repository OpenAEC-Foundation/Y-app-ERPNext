#!/usr/bin/env node
/**
 * Provisioning-script voor Y-next op ERPNext.
 *
 * Vier fasen, alle idempotent:
 *
 * 1. **DocTypes** — maakt de custom DocTypes aan die Y-next nodig heeft:
 *    `Y Meeting Note` (vergadernotities), `Y Next Setting` (generieke
 *    sleutel/waarde-opslag, o.a. voor extensies en het kilometertarief),
 *    `Y Onkostensoort` (stamtabel) en de twee declaratie-doctypes
 *    `Y Km Registratie` en `Y Onkosten`. Bestaat een DocType al, dan gebeurt
 *    er niets.
 * 2. **Rechten** — zet de DocPerm-vlaggen op *bestaande* (core-)doctypes die
 *    Y-next nodig heeft maar die Frappe standaard niet geeft (zie
 *    `buildPermissionRules` voor het waarom per regel).
 * 3. **Stamgegevens** — records die Y-next verwacht maar die geen enkele
 *    installatie meebrengt (zie `DEFAULT_MASTER_RECORDS`).
 * 4. **Naamreeksen** — herstelt tellers die achterlopen op de bestaande
 *    documenten (zie `ensureNamingSeries`).
 *
 * Fase 2 t/m 4 slaan een doctype dat niet op de instance bestaat netjes over.
 * Daarom mogen de regels voor de **HRMS**-doctypes (`Travel Request`,
 * `Leave Application`, `Leave Allocation`, `Expense Claim`) blijven staan
 * terwijl die app níét geïnstalleerd is: ze doen dan niets. Y-next's eigen
 * kilometer- en onkostenregistratie draait bewust **niet** op HRMS maar op de
 * `Y …`-doctypes hierboven — zie de sectie "Kilometers & onkosten".
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

/* ──────────────── Kilometers & onkosten (eigen doctypes) ────────────────
 *
 * Y-next registreert kilometers en onkosten op **eigen** custom DocTypes, niet
 * op HRMS' `Travel Request` / `Expense Claim`. Reden: HRMS wordt op deze
 * instance bewust niet geïnstalleerd, en zonder die app bestaan die doctypes
 * niet. Bijkomend voordeel: HRMS' Travel Request is een dienstreis-aanvraag
 * (vlucht, hotel, visum) zonder datum-, afstands- of bedragveld — Y-next zou
 * er sowieso een handvol customfields op moeten plakken om er een
 * kilometerstaat van te maken.
 *
 * Eén document per rit / per bon (geen maandelijkse verzamelstaat met
 * child-rijen): dat maakt goedkeuren per stuk mogelijk, houdt de rechten
 * simpel (`if_owner` werkt alleen op documentniveau, niet op child-rijen) en
 * laat een bon als gewone ERPNext-bijlage aan het document hangen.
 */

/** Statuswaarden van een declaratie. Gedeeld door beide doctypes. */
const DECLARATIE_STATUSSEN = "Concept\nIngediend\nGoedgekeurd\nAfgewezen";

/**
 * De DocPerm-rijen voor een declaratie-doctype.
 *
 * **`if_owner: 1` op de medewerkersrollen is de kern.** Frappe past die vlag
 * toe op *alle* vlaggen van die rij, dus een medewerker ziet en wijzigt
 * uitsluitend documenten waarvan hij zelf de `owner` is — precies "alleen zijn
 * eigen ritten en bonnen", zonder dat er een User Permission of een
 * server-side query-condition voor nodig is. De werkgever draait als **System
 * Manager** en heeft een rij zónder `if_owner`, dus die ziet alles en kan
 * goedkeuren.
 *
 * `delete` staat er voor de medewerker bij omdat een rit/bon in Y-next een
 * heel document is: zonder delete kan hij een verkeerd ingevoerde boeking niet
 * meer weghalen. Het blijft `if_owner`, dus alleen zijn eigen.
 *
 * **Permlevel 1 op `goedgekeurd_door` / `goedgekeurd_op`.** Die twee velden
 * mogen alleen door de werkgever geschreven worden. Frappe's permlevels zijn
 * het enige middel dat hiervoor zónder server-side script (en dus zonder
 * Bench) werkt. Gevolg — en dat is bewust: `status` staat wél op permlevel 0,
 * want de medewerker moet zelf van Concept naar Ingediend kunnen. Een
 * medewerker die de API rechtstreeks aanroept kan zijn eigen record dus op
 * "Goedgekeurd" zetten, maar kan de goedkeurstempel niet vullen — een
 * "goedgekeurd" record zonder `goedgekeurd_door` is dus zichtbaar onecht. Dat
 * is tamper-evidence, geen tamper-proofing; echte afdwinging vereist een
 * server-side hook, die op deze installatie niet beschikbaar is.
 *
 * Expliciete nullen zijn verplicht: Frappe vult ontbrekende DocPerm-vlaggen
 * met defaults (live waargenomen bij `Y Next Setting`: een rij met alleen
 * `read: 1` werd r1w1c1d1).
 */
function declaratiePermissions() {
  const medewerkerRollen = ["Employee", "Projects User"];
  return [
    { role: "System Manager", permlevel: 0, if_owner: 0, read: 1, write: 1, create: 1, delete: 1, submit: 0, cancel: 0, amend: 0 },
    { role: "System Manager", permlevel: 1, if_owner: 0, read: 1, write: 1, create: 0, delete: 0, submit: 0, cancel: 0, amend: 0 },
    ...medewerkerRollen.map((role) => (
      { role, permlevel: 0, if_owner: 1, read: 1, write: 1, create: 1, delete: 1, submit: 0, cancel: 0, amend: 0 }
    )),
    // Lezen mag wél: anders ziet de medewerker niet wie zijn declaratie heeft
    // goedgekeurd. Schrijven niet — dat is de hele reden voor permlevel 1.
    ...medewerkerRollen.map((role) => (
      { role, permlevel: 1, if_owner: 0, read: 1, write: 0, create: 0, delete: 0, submit: 0, cancel: 0, amend: 0 }
    )),
  ];
}

/** De twee goedkeurvelden, identiek op beide declaratie-doctypes. */
function goedkeurVelden() {
  return [
    {
      fieldname: "goedgekeurd_door",
      label: "Goedgekeurd door",
      fieldtype: "Link",
      options: "User",
      read_only: 1,
      permlevel: 1,
    },
    {
      fieldname: "goedgekeurd_op",
      label: "Goedgekeurd op",
      fieldtype: "Datetime",
      read_only: 1,
      permlevel: 1,
    },
  ];
}

/**
 * Bouwt de DocType-definitie voor "Y Km Registratie" (één rit).
 *
 * `bedrag` is `read_only` omdat de client het uitrekent
 * (`kilometers × (retour ? 2 : 1) × tarief_per_km`); `read_only` is in Frappe
 * een UI-vlag, de REST-API mag het gewoon vullen. `tarief_per_km` wordt bij
 * het boeken uit de instelling `km-tarief` overgenomen en daarna niet meer
 * aangeraakt, zodat een latere tariefwijziging oude ritten niet herrekent.
 * @returns {object}
 */
export function buildKmRegistratieDoctype() {
  return {
    doctype: "DocType",
    name: "Y Km Registratie",
    module: "Custom",
    custom: 1,
    autoname: "format:YKM-{YYYY}-{#####}",
    sort_field: "modified",
    sort_order: "DESC",
    fields: [
      { fieldname: "employee", label: "Medewerker", fieldtype: "Link", options: "Employee", reqd: 1, in_list_view: 1 },
      { fieldname: "datum", label: "Datum", fieldtype: "Date", reqd: 1, in_list_view: 1 },
      { fieldname: "van", label: "Van", fieldtype: "Data" },
      { fieldname: "naar", label: "Naar", fieldtype: "Data" },
      { fieldname: "kilometers", label: "Kilometers", fieldtype: "Float", precision: "1", reqd: 1, in_list_view: 1 },
      { fieldname: "retour", label: "Retour", fieldtype: "Check", default: "0" },
      { fieldname: "project", label: "Project", fieldtype: "Link", options: "Project" },
      { fieldname: "omschrijving", label: "Omschrijving", fieldtype: "Small Text" },
      { fieldname: "tarief_per_km", label: "Tarief per km", fieldtype: "Currency" },
      { fieldname: "bedrag", label: "Bedrag", fieldtype: "Currency", read_only: 1, in_list_view: 1 },
      { fieldname: "status", label: "Status", fieldtype: "Select", options: DECLARATIE_STATUSSEN, default: "Concept", in_list_view: 1 },
      ...goedkeurVelden(),
    ],
    permissions: declaratiePermissions(),
  };
}

/**
 * Bouwt de DocType-definitie voor "Y Onkosten" (één bon).
 *
 * Het bonnetje zelf is géén eigen veld: het hangt als gewone ERPNext-bijlage
 * aan het document (`File` met `attached_to_doctype: "Y Onkosten"`), zodat
 * meerdere bijlagen, de bestaande uploadroute en de ERPNext-bestandsrechten
 * vanzelf meekomen.
 * @returns {object}
 */
export function buildOnkostenDoctype() {
  return {
    doctype: "DocType",
    name: "Y Onkosten",
    module: "Custom",
    custom: 1,
    autoname: "format:YON-{YYYY}-{#####}",
    sort_field: "modified",
    sort_order: "DESC",
    fields: [
      { fieldname: "employee", label: "Medewerker", fieldtype: "Link", options: "Employee", reqd: 1, in_list_view: 1 },
      { fieldname: "datum", label: "Datum", fieldtype: "Date", reqd: 1, in_list_view: 1 },
      { fieldname: "soort", label: "Soort", fieldtype: "Link", options: "Y Onkostensoort", reqd: 1, in_list_view: 1 },
      { fieldname: "bedrag", label: "Bedrag", fieldtype: "Currency", reqd: 1, in_list_view: 1 },
      { fieldname: "btw_bedrag", label: "Btw-bedrag", fieldtype: "Currency" },
      { fieldname: "omschrijving", label: "Omschrijving", fieldtype: "Small Text" },
      { fieldname: "project", label: "Project", fieldtype: "Link", options: "Project" },
      { fieldname: "leverancier", label: "Leverancier", fieldtype: "Data" },
      { fieldname: "status", label: "Status", fieldtype: "Select", options: DECLARATIE_STATUSSEN, default: "Concept", in_list_view: 1 },
      ...goedkeurVelden(),
    ],
    permissions: declaratiePermissions(),
  };
}

/**
 * Bouwt de DocType-definitie voor "Y Onkostensoort" (stamtabel).
 *
 * `autoname: field:soort_naam` maakt de naam gelijk aan de soort zelf, zodat
 * `Y Onkosten.soort` leesbaar is zonder join. De medewerkersrollen krijgen
 * alleen leesrecht — de soortenlijst is werkgeversbeheer.
 * @returns {object}
 */
export function buildOnkostensoortDoctype() {
  return {
    doctype: "DocType",
    name: "Y Onkostensoort",
    module: "Custom",
    custom: 1,
    autoname: "field:soort_naam",
    sort_field: "modified",
    sort_order: "DESC",
    fields: [
      { fieldname: "soort_naam", label: "Soort", fieldtype: "Data", reqd: 1, unique: 1, in_list_view: 1 },
      { fieldname: "actief", label: "Actief", fieldtype: "Check", default: "1", in_list_view: 1 },
    ],
    permissions: [
      { role: "System Manager", permlevel: 0, if_owner: 0, read: 1, write: 1, create: 1, delete: 1, submit: 0, cancel: 0, amend: 0 },
      { role: "Employee", permlevel: 0, if_owner: 0, read: 1, write: 0, create: 0, delete: 0, submit: 0, cancel: 0, amend: 0 },
      { role: "Projects User", permlevel: 0, if_owner: 0, read: 1, write: 0, create: 0, delete: 0, submit: 0, cancel: 0, amend: 0 },
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
 * - **Communication / delete op permlevel 0.** De webmail heeft een
 *   Prullenbak: "verwijderen" zet `email_status` op `Trash` (een gewone
 *   update, gedekt door de write-regels hierboven) en pas *binnen* de
 *   Prullenbak kan een bericht definitief weg. Die tweede stap is een echte
 *   DELETE op Communication. Live gemeten stand op de doelinstance: System
 *   Manager heeft op permlevel 0 al `delete: 1`, Projects User heeft er
 *   helemaal géén DocPerm-rij. Zonder deze regels blijft "definitief
 *   verwijderen" voor een gewone medewerker op een 403 hangen terwijl de knop
 *   er wel staat. De System Manager-regel staat er voor de volledigheid bij:
 *   `ensurePermissions` is idempotent en meldt hem simpelweg als ongewijzigd
 *   zolang de core-default blijft zoals hij is.
 * - **ToDo / delete.** Y-next kan todo's aanmaken maar de core-DocPerm zet
 *   `delete: 0` voor System Manager, waardoor een per ongeluk aangemaakt
 *   todo permanent is (REST-DELETE én `frappe.client.delete` geven 403).
 *   Zie e2e-report-1 §2.
 *
 * Voor Communication en ToDo bewust géén `read`-regels: die zijn er al, en
 * dit script hoort geen rechten te verbreden die niemand mist.
 *
 * ── HRMS (Frappe HR) ──
 *
 * De km-, onkosten- en verlofschermen draaien op doctypes die pas bestaan
 * zodra de app **HRMS** geïnstalleerd is. Zolang die ontbreekt slaat
 * `ensurePermissions` de regels netjes over (zie de bestaanscheck daar), dus
 * deze regels mogen hier permanent staan.
 *
 * - **Travel Request (Employee: read/write/create).** Y-next registreert
 *   kilometers als itinerary-regels op één Travel Request per medewerker per
 *   maand (`QuickKmBooking`, `MyKmOverzicht`). HRMS' eigen DocPerm op Travel
 *   Request kent maar één rij: **System Manager**. Een gewone medewerker kan
 *   dus niets — zelfs zijn eigen ritten niet teruglezen. Dat de medewerker
 *   dit hóórt te mogen blijkt uit HRMS zelf: het "Employee Self Service"
 *   User Type dat `hrms/setup.py` aanmaakt geeft Travel Request
 *   `read/write/create/delete`. Wij geven bewust **geen `delete`** (een
 *   ingediende maand mag niet spoorloos verdwijnen) en **geen `submit`**:
 *   goedkeuren is de werkgeversstap in het tabblad "Goedkeuren", die op de
 *   bestaande System Manager-rij draait.
 * - **Leave Application (Employee: read/write/create).** HRMS geeft dit
 *   standaard al aan de rol Employee. De regels staan er expliciet bij zodat
 *   het verlofscherm niet stilletjes kapot gaat als iemand de rij ooit
 *   aanpast; `ensurePermissions` is idempotent en meldt ze als ongewijzigd
 *   zolang de HRMS-default blijft staan. Géén `delete`/`submit`: een
 *   aanvraag intrekken/goedkeuren is een werkgeversactie.
 * - **Leave Allocation (Employee: alleen `read`).** HRMS' DocPerm kent hier
 *   alleen **HR User** en **HR Manager**. Het verlofscherm leest allocaties
 *   voor het saldo én voor de verloftype-keuzelijst in de aanvraagmodal
 *   (`availableLeaveTypes` komt uit de allocaties van de medewerker) — zonder
 *   leesrecht kan een medewerker dus geen verlof aanvragen. Bewust géén
 *   `write`/`create`: dan zou een medewerker zichzelf verlofdagen kunnen
 *   toekennen. Let op: dat een medewerker alléén zijn eigen allocaties ziet
 *   komt van de ERPNext-**User Permission** op Employee (aangemaakt zodra
 *   `create_user_permission` op het Employee-record aanstaat), niet van deze
 *   DocPerm.
 * - **Expense Claim (Employee: read/write/create).** Ook dit geeft HRMS
 *   standaard al aan Employee; zelfde reden als bij Leave Application om het
 *   expliciet vast te leggen. Géén `delete`/`submit`.
 *
 * @returns {{ doctype: string, role: string, permlevel: number, ptype: string, value: number }[]}
 */
export function buildPermissionRules() {
  return [
    { doctype: "Communication", role: "Projects User", permlevel: 0, ptype: "write", value: 1 },
    { doctype: "Communication", role: "System Manager", permlevel: 0, ptype: "write", value: 1 },
    { doctype: "Communication", role: "Projects User", permlevel: 0, ptype: "delete", value: 1 },
    { doctype: "Communication", role: "System Manager", permlevel: 0, ptype: "delete", value: 1 },
    { doctype: "ToDo", role: "Projects User", permlevel: 0, ptype: "delete", value: 1 },
    { doctype: "ToDo", role: "System Manager", permlevel: 0, ptype: "delete", value: 1 },
    // HRMS — worden overgeslagen zolang de app niet geïnstalleerd is.
    { doctype: "Travel Request", role: "Employee", permlevel: 0, ptype: "read", value: 1 },
    { doctype: "Travel Request", role: "Employee", permlevel: 0, ptype: "write", value: 1 },
    { doctype: "Travel Request", role: "Employee", permlevel: 0, ptype: "create", value: 1 },
    { doctype: "Leave Application", role: "Employee", permlevel: 0, ptype: "read", value: 1 },
    { doctype: "Leave Application", role: "Employee", permlevel: 0, ptype: "write", value: 1 },
    { doctype: "Leave Application", role: "Employee", permlevel: 0, ptype: "create", value: 1 },
    { doctype: "Leave Allocation", role: "Employee", permlevel: 0, ptype: "read", value: 1 },
    { doctype: "Expense Claim", role: "Employee", permlevel: 0, ptype: "read", value: 1 },
    { doctype: "Expense Claim", role: "Employee", permlevel: 0, ptype: "write", value: 1 },
    { doctype: "Expense Claim", role: "Employee", permlevel: 0, ptype: "create", value: 1 },
  ];
}

/**
 * Of een DocType op deze instance bestaat. Gebruikt door de rechten- en
 * customfield-fase om regels voor een nog niet geïnstalleerde app (HRMS)
 * netjes over te slaan in plaats van erop te stranden.
 *
 * Let op waaróm dit een aparte call is: `permission_manager.get_permissions`
 * antwoordt op een onbekend doctype met **HTTP 200 en `{"message": []}`**
 * (live geverifieerd) — niet met een fout. Zonder deze check zou
 * `ensurePermissions` dat lezen als "de rol-rij ontbreekt", een `add` sturen
 * en pas daar afbreken, met de hele run erbij.
 * @returns {Promise<boolean>}
 */
async function doctypeExists(baseUrl, token, doctype) {
  const res = await safeFetch(`${baseUrl}/api/resource/DocType/${encodeURIComponent(doctype)}`, {
    headers: { Authorization: `token ${token}` },
  });
  if (res.ok) return true;
  if (res.status === 404) return false;
  throw new Error(`Bestaan van DocType "${doctype}" controleren mislukt: HTTP ${res.status}.`);
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
 * Regels voor een doctype dat niet op de instance bestaat (bv. de
 * HRMS-doctypes vóór de HRMS-installatie) worden overgeslagen — één
 * bestaanscheck per doctype, net als bij de stamgegevens- en
 * naamreeksen-fase.
 *
 * @param {{ baseUrl: string, token: string, rules?: object[] }} params
 * @returns {Promise<{ added: string[], updated: string[], unchanged: string[], skipped: string[] }>}
 */
export async function ensurePermissions({ baseUrl, token, rules = buildPermissionRules() }) {
  const added = [];
  const updated = [];
  const unchanged = [];
  const skipped = [];
  /** @type {Map<string, object[]>} — één get_permissions-call per doctype. */
  const permsByDoctype = new Map();
  /** @type {Map<string, boolean>} — één bestaanscheck per doctype. */
  const existsByDoctype = new Map();

  for (const rule of rules) {
    const { doctype, role, permlevel, ptype, value } = rule;
    const label = `${doctype}/${role}/${permlevel}/${ptype}`;

    if (!existsByDoctype.has(doctype)) {
      const exists = await doctypeExists(baseUrl, token, doctype);
      existsByDoctype.set(doctype, exists);
      if (!exists) {
        console.log(`Rechten: DocType "${doctype}" bestaat niet op deze instance — regels overgeslagen.`);
      }
    }
    if (!existsByDoctype.get(doctype)) {
      skipped.push(label);
      continue;
    }

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

  return { added, updated, unchanged, skipped };
}

/* ────────────────────── Naamreeks-tellers (fase 3) ────────────────────── */

/**
 * Doctypes die Y-next raakt en waarvan de naming-series-teller kan
 * desynchroniseren met de werkelijk bestaande documenten (na een
 * bulk-import, of na een mislukte insert — Frappe hoogt de teller NIET op
 * bij een gefaalde create, dus een eerdere botsing blijft permanent
 * terugkomen totdat de teller handmatig wordt bijgewerkt). Zie
 * `.superpowers/sdd/snug-soaring-whistle/task-jaarstaat-report.md`
 * (addendum 2) voor de live-analyse die tot deze aanpak leidde: eerst
 * `TS-2026-`, later `ACC-PINV-2026-`.
 *
 * Alleen doctypes die daadwerkelijk op de instance bestaan én een
 * `naming_series`-veld hebben worden verwerkt — de rest wordt overgeslagen
 * (zie `ensureNamingSeries`), dus deze lijst mag gerust doctypes bevatten
 * die (nog) niet aanwezig zijn.
 * @type {string[]}
 */
export const DEFAULT_NAMING_SERIES_DOCTYPES = [
  "Timesheet",
  "Purchase Invoice",
  "Sales Invoice",
  "Quotation",
  "Sales Order",
  "Delivery Note",
  "Task",
  "Project",
  // Y-next maakt deze twee rechtstreeks vanuit de webmail aan ("mail → lead"
  // en "mail → offerteaanvraag"). Loopt hun teller achter op de bestaande
  // documenten, dan is dat een permanente blokkade: Frappe telt de reeks niet
  // op bij een mislukte insert, dus elke poging kiest hetzelfde bezette
  // nummer. Precies wat ACC-PINV- eerder overkwam.
  "Lead",
  "Opportunity",
  // HRMS. Deze vier worden pas iets zodra de app geïnstalleerd is; tot dan
  // meldt `ensureNamingSeries` ze als "doctype-not-found" en gaat verder.
  // Ze horen erbij om dezelfde reden als ACC-PINV: Y-next maakt Travel
  // Requests (km per maand), Leave Applications (verlofblokken — één aanvraag
  // per aaneengesloten werkblok, dus meerdere inserts achter elkaar) en
  // Expense Claims rechtstreeks via de API aan. Eén mislukte insert laat de
  // teller staan en blokkeert dan élke volgende aanvraag.
  //
  // Let op: `Travel Request` heeft géén `naming_series`-veld maar een
  // expressie-autoname (`HR-TRQ-.YYYY.-.#####`). Die telt wél gewoon mee in
  // dezelfde `tabSeries`-teller — vandaar de autoname-terugval in
  // `getNamingSeriesTemplates`.
  "Travel Request",
  "Leave Application",
  "Leave Allocation",
  "Expense Claim",
  // Y-next' eigen declaratie-doctypes. Ze worden vandaag als
  // `no-naming-series` overgeslagen, en dat is correct: hun autoname is
  // `format:YKM-{YYYY}-{#####}` / `format:YON-{YYYY}-{#####}`, en Frappe's
  // `_format_autoname` parseert elk `{…}`-blok apart. De teller-placeholder
  // komt daardoor in `tabSeries` terecht onder de **lege** sleutel — één
  // gedeelde, altijd oplopende teller (die `Y Meeting Note` al gebruikt).
  // Zo'n teller kán niet achterlopen op bestaande documenten en dus ook niet
  // vastlopen; er valt hier niets te herstellen. Ze staan bewust wél in de
  // lijst zodat de fase ze automatisch meepakt als het naamschema ooit naar
  // een `naming_series`-veld verhuist.
  "Y Km Registratie",
  "Y Onkosten",
];

/* ─────────────────────────── Stamgegevens ─────────────────────────────── */

/**
 * De sleutel waaronder het kilometertarief in `Y Next Setting` staat, en de
 * waarde waarmee een verse site begint. Gedeeld met de frontend
 * (`packages/frontend/src/lib/kmTarief.ts`) — verandert er hier iets, dan
 * hoort het daar mee te veranderen.
 */
export const KM_TARIEF_SETTING_KEY = "km-tarief";
export const DEFAULT_KM_TARIEF = 0.23;

/**
 * Stamrecords die Y-next verwacht maar die geen enkele ERPNext-installatie
 * standaard meebrengt.
 *
 * De eerste is de **bron "Email"**. Y-next zet die op een lead of offerteaanvraag
 * die uit een mail is ontstaan, zodat je in het CRM kunt zien waar het vandaan
 * kwam. Twee dingen zijn hierbij niet vanzelfsprekend:
 *
 * - Het veld heet in ERPNext v16 `utm_source` en verwijst naar **UTM Source**;
 *   `Lead Source` bestaat niet meer. De foutmelding praat wél nog over
 *   "Source" ("Could not find Source: Email"), wat de zoektocht misleidt.
 * - `UTM Source` heeft `autoname: prompt`, dus de `name` moet **expliciet** in
 *   de payload. Zonder die sleutel faalt het aanmaken met "Please set the
 *   document name" en niet met iets over de bron.
 *
 * De frontend werkt ook zónder dit record: `createLeadFromMail` laat het veld
 * weg wanneer de bron ontbreekt. Deze fase is er om het CRM compleet te maken,
 * niet om de functie te laten werken.
 *
 * @type {{ doctype: string, name: string, payload: object }[]}
 */
export const DEFAULT_MASTER_RECORDS = [
  {
    doctype: "UTM Source",
    name: "Email",
    payload: {
      name: "Email",
      source_name: "Email",
      details: "Binnengekomen via e-mail (Y-next mailherkenning).",
    },
  },

  /* ── Onkostensoorten (`Y Onkostensoort`) ──
   * De keuzelijst van het onkostenscherm. Eigen stamtabel in plaats van
   * ERPNext' `Expense Claim Type`, omdat dat doctype uit **HRMS** komt en die
   * app bewust niet geïnstalleerd wordt (zie de kop van dit bestand).
   * `autoname: field:soort_naam`, dus de `name` wordt de waarde zelf.
   */
  { doctype: "Y Onkostensoort", name: "Reiskosten", payload: { soort_naam: "Reiskosten", actief: 1 } },
  { doctype: "Y Onkostensoort", name: "Parkeren", payload: { soort_naam: "Parkeren", actief: 1 } },
  { doctype: "Y Onkostensoort", name: "Materiaal", payload: { soort_naam: "Materiaal", actief: 1 } },
  { doctype: "Y Onkostensoort", name: "Verblijf", payload: { soort_naam: "Verblijf", actief: 1 } },
  { doctype: "Y Onkostensoort", name: "Overig", payload: { soort_naam: "Overig", actief: 1 } },

  /* ── Kilometertarief ──
   * Eén rij in de bestaande sleutel/waarde-opslag `Y Next Setting`, zodat de
   * werkgever hem in Y-next kan wijzigen (schrijven op dat doctype is
   * System-Manager-only — precies de bedoeling: een medewerker mag zijn eigen
   * vergoeding niet ophogen).
   *
   * `€ 0,23` is de gangbare onbelaste kilometervergoeding. Dit record wordt
   * alléén aangemaakt als het nog niet bestaat — `ensureMasterRecords` doet
   * eerst een GET — dus een tarief dat de werkgever zelf heeft aangepast
   * overleeft elke volgende provisioning-run.
   *
   * De boeking neemt het tarief over in `tarief_per_km` op het moment van
   * boeken; een latere tariefwijziging verandert dus niets aan wat al geboekt
   * is (historisch correct).
   */
  {
    doctype: "Y Next Setting",
    name: KM_TARIEF_SETTING_KEY,
    payload: { setting_key: KM_TARIEF_SETTING_KEY, setting_value: String(DEFAULT_KM_TARIEF) },
  },
];

/**
 * Maakt de stamrecords aan die nog niet bestaan. Idempotent, en tolerant voor
 * een installatie zonder de bijbehorende doctype (dan `skipped`) — een
 * Frappe-only site zonder ERPNext-CRM hoort niet op deze stap te stranden.
 *
 * @returns {Promise<{ created: string[], existing: string[], skipped: string[] }>}
 */
export async function ensureMasterRecords({ baseUrl, token, records = DEFAULT_MASTER_RECORDS }) {
  const authHeader = `token ${token}`;
  const created = [];
  const existing = [];
  const skipped = [];

  for (const record of records) {
    const label = `${record.doctype} "${record.name}"`;
    const base = `${baseUrl}/api/resource/${encodeURIComponent(record.doctype)}`;
    const getRes = await safeFetch(`${base}/${encodeURIComponent(record.name)}`, {
      headers: { Authorization: authHeader },
    });
    if (getRes.ok) {
      console.log(`${label} bestaat al — overgeslagen [HTTP ${getRes.status}].`);
      existing.push(label);
      continue;
    }
    if (getRes.status !== 404) {
      throw new Error(`Opzoeken ${label} mislukt: HTTP ${getRes.status}.`);
    }
    const postRes = await safeFetch(base, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(record.payload),
    });
    if (postRes.ok) {
      console.log(`${label} aangemaakt [HTTP ${postRes.status}].`);
      created.push(label);
      continue;
    }
    // 404 op de POST betekent dat de doctype zelf ontbreekt; dat is geen fout
    // maar een installatie zonder ERPNext-CRM.
    if (postRes.status === 404) {
      console.log(`${label} overgeslagen — doctype niet aanwezig [HTTP ${postRes.status}].`);
      skipped.push(label);
      continue;
    }
    throw new Error(`Aanmaken ${label} mislukt: HTTP ${postRes.status}.`);
  }
  return { created, existing, skipped };
}

/**
 * Vult een Frappe naming-series-sjabloon (bv. `"TS-.YYYY.-"`) in tot de
 * concrete prefix die Frappe vandaag zou gebruiken (bv. `"TS-2026-"`) —
 * hetzelfde patroon als `frappe.model.naming.parse_naming_series`: het
 * sjabloon wordt op `.` gesplitst en alleen de datumtokens (`YYYY`/`YY`/
 * `MM`/`DD`) worden vervangen; de rest blijft letterlijk staan.
 *
 * De teller-placeholder (`#####`) hoort **niet** bij de prefix: Frappe
 * bewaart de teller onder de tekst vóór de `#`-reeks. Een expressie-autoname
 * als `HR-TRQ-.YYYY.-.#####` levert hier dus `HR-TRQ-2026-` op. Sjablonen uit
 * het `naming_series`-veld bevatten meestal geen `#` en veranderen niet.
 * @param {string} template
 * @param {Date} [now]
 * @returns {string}
 */
export function expandNamingSeriesPrefix(template, now = new Date()) {
  const year = now.getFullYear();
  const tokens = { YYYY: String(year), YY: String(year).slice(-2), MM: String(now.getMonth() + 1).padStart(2, "0"), DD: String(now.getDate()).padStart(2, "0") };
  const out = [];
  for (const part of String(template).split(".")) {
    const mapped = tokens[part.toUpperCase()] ?? part;
    const hashAt = mapped.indexOf("#");
    if (hashAt >= 0) {
      out.push(mapped.slice(0, hashAt));
      break;
    }
    out.push(mapped);
  }
  return out.join("");
}

/**
 * Parseert het numerieke staartstuk van een documentnaam die met `prefix`
 * begint (bv. `parseSeriesNumber("ACC-PINV-2026-00042", "ACC-PINV-2026-")`
 * → `42`; werkt ook zonder jaarsegment in de prefix). `null` als `name` niet
 * met `prefix` begint, of als er direct na de prefix geen cijfers staan
 * (bv. een handmatig hernoemd document dat toevallig met dezelfde prefix
 * begint).
 * @param {string} name
 * @param {string} prefix
 * @returns {number | null}
 */
export function parseSeriesNumber(name, prefix) {
  if (typeof name !== "string" || typeof prefix !== "string" || !name.startsWith(prefix)) return null;
  const match = name.slice(prefix.length).match(/^\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Haalt de naming-series-sjablonen (alle regels van het `naming_series`
 * select-veld) van een doctype op. `null` als het doctype niet bestaat op de
 * instance, `[]` als het doctype bestaat maar niets telbaars heeft (bv.
 * hash- of field-based autoname — niets om te herstellen).
 *
 * Terugval op `autoname`: een doctype zónder `naming_series`-veld kan alsnog
 * een **expressie-autoname met teller** hebben — HRMS' `Travel Request`
 * gebruikt `HR-TRQ-.YYYY.-.#####` ("Expression (old style)"). Zo'n reeks
 * loopt via dezelfde `tabSeries`-teller en kan dus net zo goed vastlopen als
 * een `naming_series`. De `#`-check onderscheidt die van een naam-expressie
 * zonder teller (bv. `format:YMN-{YYYY}-{#####}` gebruikt accolades, geen
 * kale `#`-reeks na een punt — die valt hier bewust buiten: Frappe's
 * `format:`-autoname loopt niet via `tabSeries`).
 * @returns {Promise<string[] | null>}
 */

/**
 * Prefixen waarmee Frappe's `make_autoname` een autoname-waarde als iets
 * anders dan een reeks-expressie behandelt. Alleen wat hier NIET onder valt
 * en een `#`-teller bevat, telt mee in `tabSeries`.
 */
const NON_SERIES_AUTONAME_PREFIXES = [
  "field:", "naming_series:", "format:", "prompt", "hash", "autoincrement", "uuid",
];

/** Of `autoname` een reeks-expressie met teller is (bv. `HR-TRQ-.YYYY.-.#####`). */
export function isExpressionSeriesAutoname(autoname) {
  const value = String(autoname || "").trim();
  if (!value.includes("#")) return false;
  const lower = value.toLowerCase();
  return !NON_SERIES_AUTONAME_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

async function getNamingSeriesTemplates(baseUrl, token, doctype) {
  const res = await safeFetch(`${baseUrl}/api/resource/DocType/${encodeURIComponent(doctype)}`, {
    headers: { Authorization: `token ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`DocType "${doctype}" opvragen mislukt: HTTP ${res.status}.`);
  }
  const body = await res.json().catch(() => null);
  const doc = body && body.data ? body.data : null;
  const fields = doc && Array.isArray(doc.fields) ? doc.fields : [];
  const namingField = fields.find((f) => f && f.fieldname === "naming_series");
  if (namingField) {
    return String(namingField.options || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (doc && isExpressionSeriesAutoname(doc.autoname)) return [String(doc.autoname).trim()];
  return [];
}

/**
 * Hoogste bestaande documentnaam voor één specifieke prefix van één
 * doctype: `order_by=name desc, limit 1`, gefilterd op
 * `["name","like","<prefix>%"]` zodat een niet-conform genaamd document
 * (bv. een handmatige titel uit een bulk-import) de echte reeksleider niet
 * kan verdringen. `null` als er geen enkel document met deze prefix bestaat.
 * @returns {Promise<string | null>}
 */
async function getHighestNameForPrefix(baseUrl, token, doctype, prefix) {
  const params = new URLSearchParams();
  params.set("fields", JSON.stringify(["name"]));
  params.set("filters", JSON.stringify([["name", "like", `${prefix}%`]]));
  params.set("order_by", "name desc");
  params.set("limit_page_length", "1");
  const url = `${baseUrl}/api/resource/${encodeURIComponent(doctype)}?${params.toString()}`;
  const res = await safeFetch(url, { headers: { Authorization: `token ${token}` } });
  if (!res.ok) {
    throw new Error(`Documenten opvragen voor "${doctype}" (prefix "${prefix}") mislukt: HTTP ${res.status}.`);
  }
  const body = await res.json().catch(() => null);
  const rows = body && Array.isArray(body.data) ? body.data : [];
  return rows.length > 0 ? rows[0].name : null;
}

/** Haalt de `Document Naming Settings`-Single op (nodig voor `modified`, zie `run_doc_method`'s `check_if_latest`). */
async function getNamingSettingsSingle(baseUrl, token) {
  const res = await safeFetch(
    `${baseUrl}/api/resource/${encodeURIComponent("Document Naming Settings")}/${encodeURIComponent("Document Naming Settings")}`,
    { headers: { Authorization: `token ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`Document Naming Settings opvragen mislukt: HTTP ${res.status}.`);
  }
  const body = await res.json().catch(() => null);
  return body && body.data ? body.data : {};
}

/**
 * Huidige tellerstand voor een prefix, via het whitelisted
 * `run_doc_method`-pad op `Document Naming Settings.get_current` (zelfde
 * patroon dat live bevestigd is voor de `TS-2026-`-fix, zie
 * task-jaarstaat-report.md addendum 2).
 * @returns {Promise<number>}
 */
async function getCurrentSeriesValue(baseUrl, token, prefix) {
  const single = await getNamingSettingsSingle(baseUrl, token);
  const res = await safeFetch(`${baseUrl}/api/method/run_doc_method`, {
    method: "POST",
    headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      docs: JSON.stringify({ ...single, doctype: "Document Naming Settings", prefix }),
      method: "get_current",
    }),
  });
  if (!res.ok) {
    throw new Error(`Tellerstand opvragen voor prefix "${prefix}" mislukt: HTTP ${res.status}.`);
  }
  const body = await res.json().catch(() => null);
  // Live geverifieerd: `run_doc_method` retourneert `get_current`'s
  // resultaat rechtstreeks als `message` (een getal), NIET als
  // `{ current_value }`. Beide vormen worden hier verdraagd zodat een
  // toekomstige Frappe-versie die wél een object teruggeeft niet stil naar 0
  // terugvalt.
  const raw = body ? body.message : undefined;
  const value = raw && typeof raw === "object" ? raw.current_value : raw;
  return Number(value) || 0;
}

/** Zet de tellerstand voor een prefix via `Document Naming Settings.update_series_start` (System Manager only). */
async function setSeriesValue(baseUrl, token, prefix, value) {
  const single = await getNamingSettingsSingle(baseUrl, token);
  const res = await safeFetch(`${baseUrl}/api/method/run_doc_method`, {
    method: "POST",
    headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      docs: JSON.stringify({ ...single, doctype: "Document Naming Settings", prefix, current_value: value }),
      method: "update_series_start",
    }),
  });
  if (!res.ok) {
    throw new Error(`Tellerstand zetten voor prefix "${prefix}" (waarde ${value}) mislukt: HTTP ${res.status}.`);
  }
}

/**
 * Herstelt naming-series-tellers die achterlopen op de werkelijk bestaande
 * documenten, voor elke prefix die in gebruik is bij elk doctype uit
 * `doctypes`. Idempotent: staat de teller al op of boven het hoogste
 * bestaande nummer, dan gebeurt er niets.
 *
 * Faalt de verwerking van één doctype of één prefix (doctype bestaat niet,
 * geen naming_series-veld, een HTTP-fout), dan wordt dat gewaarschuwd en
 * gaat de rest van de lijst door — één kapotte reeks mag de andere reeksen
 * niet blokkeren.
 *
 * @param {{ baseUrl: string, token: string, doctypes?: string[], now?: Date }} params
 * @returns {Promise<{ updated: object[], unchanged: object[], skipped: object[] }>}
 */
export async function ensureNamingSeries({ baseUrl, token, doctypes = DEFAULT_NAMING_SERIES_DOCTYPES, now = new Date() }) {
  const updated = [];
  const unchanged = [];
  const skipped = [];

  for (const doctype of doctypes) {
    let templates;
    try {
      templates = await getNamingSeriesTemplates(baseUrl, token, doctype);
    } catch (err) {
      const message = redact(err && err.message ? err.message : String(err));
      console.warn(`Naamreeksen: "${doctype}" overgeslagen wegens fout bij opvragen DocType-meta: ${message}`);
      skipped.push({ doctype, reason: "error", detail: message });
      continue;
    }
    if (templates === null) {
      console.log(`Naamreeksen: DocType "${doctype}" bestaat niet op deze instance — overgeslagen.`);
      skipped.push({ doctype, reason: "doctype-not-found" });
      continue;
    }
    if (templates.length === 0) {
      console.log(`Naamreeksen: "${doctype}" gebruikt geen naming_series — overgeslagen.`);
      skipped.push({ doctype, reason: "no-naming-series" });
      continue;
    }

    const prefixes = [...new Set(templates.map((t) => expandNamingSeriesPrefix(t, now)))];
    for (const prefix of prefixes) {
      try {
        const highestName = await getHighestNameForPrefix(baseUrl, token, doctype, prefix);
        if (highestName === null) {
          console.log(`Naamreeksen: ${doctype} (${prefix}) — geen bestaande documenten met deze prefix, overgeslagen.`);
          skipped.push({ doctype, prefix, reason: "no-documents" });
          continue;
        }
        const highest = parseSeriesNumber(highestName, prefix);
        if (highest === null) {
          console.warn(`Naamreeksen: ${doctype} (${prefix}) — kon geen nummer parsen uit "${highestName}", overgeslagen.`);
          skipped.push({ doctype, prefix, reason: "parse-failed", name: highestName });
          continue;
        }
        const oldValue = await getCurrentSeriesValue(baseUrl, token, prefix);
        if (oldValue >= highest) {
          console.log(
            `Naamreeksen: ${doctype} (${prefix}) — teller staat op ${oldValue}, hoogste bestaande is ${highest} — ongewijzigd.`
          );
          unchanged.push({ doctype, prefix, highest, value: oldValue });
          continue;
        }
        await setSeriesValue(baseUrl, token, prefix, highest);
        console.log(
          `Naamreeksen: ${doctype} (${prefix}) — teller ${oldValue} -> ${highest} ` +
            `(hoogste bestaande naam "${highestName}").`
        );
        updated.push({ doctype, prefix, oldValue, newValue: highest });
      } catch (err) {
        const message = redact(err && err.message ? err.message : String(err));
        console.warn(`Naamreeksen: ${doctype} (${prefix}) overgeslagen wegens fout: ${message}`);
        skipped.push({ doctype, prefix, reason: "error", detail: message });
      }
    }
  }

  return { updated, unchanged, skipped };
}

/**
 * Provisioneert Y-next (idempotent): eerst de custom DocTypes — bestaat een
 * DocType al, dan wordt hij overgeslagen; anders wordt hij aangemaakt —
 * daarna de DocPerm-vlaggen uit `buildPermissionRules`, de stamrecords, en als
 * laatste de naming-series-tellers uit `ensureNamingSeries`. De volgorde is
 * bewust: een rechten-, stam- of teller-regel kan over een net
 * aangemaakte/gecontroleerde doctype gaan.
 *
 * Binnen de doctype-fase is de volgorde óók bewust: `Y Onkostensoort` moet
 * bestaan vóór `Y Onkosten`, want dat laatste heeft er een Link-veld naar; en
 * `Y Next Setting` vóór de stamgegevens, want het kilometertarief is een rij
 * in dat doctype.
 * @param {{ baseUrl: string, token: string }} params
 * @returns {Promise<{ created: string[], existing: string[], permissions: { added: string[], updated: string[], unchanged: string[], skipped: string[] }, masterRecords: { created: string[], existing: string[], skipped: string[] }, namingSeries: { updated: object[], unchanged: object[], skipped: object[] } }>}
 */
export async function provision({ baseUrl, token }) {
  const definitions = [
    buildMeetingNoteDoctype(),
    buildSettingDoctype(),
    buildOnkostensoortDoctype(),
    buildKmRegistratieDoctype(),
    buildOnkostenDoctype(),
  ];
  const created = [];
  const existing = [];
  for (const definition of definitions) {
    const result = await ensureDoctype(baseUrl, token, definition);
    if (result === "created") created.push(definition.name);
    else existing.push(definition.name);
  }
  const permissions = await ensurePermissions({ baseUrl, token });
  const masterRecords = await ensureMasterRecords({ baseUrl, token });
  const namingSeries = await ensureNamingSeries({ baseUrl, token });
  return { created, existing, permissions, masterRecords, namingSeries };
}

async function main() {
  const { baseUrl, token } = requiredEnv(process.env);
  console.log(`Provisioning Y-next tegen ${baseUrl} ...`);
  const { created, existing, permissions, masterRecords, namingSeries } = await provision({ baseUrl, token });
  console.log(
    `Klaar. Aangemaakt: ${created.join(", ") || "geen"}. Al aanwezig: ${existing.join(", ") || "geen"}. ` +
      `Rechten — rol-rijen toegevoegd: ${permissions.added.length}, gezet: ${permissions.updated.length}, ` +
      `ongewijzigd: ${permissions.unchanged.length}, overgeslagen: ${permissions.skipped.length}. ` +
      `Stamgegevens — aangemaakt: ${masterRecords.created.length}, al aanwezig: ${masterRecords.existing.length}, ` +
      `overgeslagen: ${masterRecords.skipped.length}. ` +
      `Naamreeksen — bijgewerkt: ${namingSeries.updated.length}, ongewijzigd: ${namingSeries.unchanged.length}, ` +
      `overgeslagen: ${namingSeries.skipped.length}.`
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
