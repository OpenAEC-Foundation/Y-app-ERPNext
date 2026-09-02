/**
 * Modulezichtbaarheid — 1-op-1 uit ERPNext.
 *
 * Y-next heeft géén eigen instellingenlaag meer boven op de ERPNext-rechten.
 * Wat een gebruiker in de sidebar ziet volgt uitsluitend uit de ERPNext-site
 * zelf: zet je daar e-mail aan, dan komt "E-mail" erbij; blokkeer je daar de
 * module Projecten, dan verdwijnen de projectschermen. Er is niets in Y-next
 * dat dat nog kan overrulen (de oude `employee-visible-modules`-brug op de
 * Express-server is vervallen).
 *
 * Drie bronnen, per module in deze volgorde beoordeeld:
 *
 * 1. **`User.block_modules`** — de child-table op de eigen User-doc waarin
 *    ERPNext bijhoudt welke Module Defs een gebruiker niet wil/mag zien.
 *    Geblokkeerd ⇒ `blocked-module`. Mag de gebruiker zijn eigen User-doc
 *    niet lezen (403), dan wordt deze bron overgeslagen — niet "alles
 *    verbergen".
 * 2. **Doctype-permissieprobe** — één `frappe.client.get_count` per uniek
 *    hoofddoctype (zie `MODULE_DOCTYPE`). Frappe handhaaft permissies op dat
 *    endpoint (403 `PermissionError`) en meldt een ontbrekend doctype met een
 *    404 `DoesNotExistError` — dus dezelfde call levert zowel
 *    `no-permission` als `doctype-missing` op, zonder een tweede round-trip.
 *    `fetchCount` hergebruikt bovendien de missing-doctype-cache van
 *    `erpnext.ts`, dus een ontbrekend doctype kost hooguit één request.
 * 3. **Configuratiesignalen** — nu alleen e-mail: zonder een Email Account
 *    met `enable_incoming=1` is de mailmodule wél toegestaan maar nog niet
 *    ingericht.
 *
 * **Eén consistente lijn voor `not-configured`: het item blijft zichtbaar.**
 * "ERPNext staat het toe, het is alleen nog niet ingericht" is iets anders
 * dan "je mag hier niet komen" — de pagina zelf toont de inrichtingsuitleg,
 * en verbergen zou de gebruiker juist de route naar die uitleg afsnijden.
 * Alleen `blocked-module`, `no-permission` en `doctype-missing` zetten
 * `visible: false`.
 *
 * Faalt een probe op iets anders dan 403/404 (netwerk, time-out, 5xx), dan
 * blijft de module zichtbaar: een hik in het netwerk mag nooit de halve app
 * laten verdwijnen.
 */

import { ApiError, fetchCount, fetchDocument, isDoctypeMissing } from "./erpnext.ts";
import { hasEnabledEmailAccount } from "./mail-erpnext.ts";
import { resolveSessionUser } from "./session.ts";

export type ModuleAccessReason =
  | "ok"
  | "blocked-module"
  | "no-permission"
  | "doctype-missing"
  | "not-configured";

export interface ModuleAccess {
  visible: boolean;
  reason: ModuleAccessReason;
}

/**
 * Module-id (de `Page`-id uit de sidebar) → de ERPNext **Module Def**-namen
 * waar het scherm onder valt. Staat één daarvan in `User.block_modules`, dan
 * verdwijnt het scherm.
 *
 * Een scherm mag onder meerdere Module Defs vallen (bv. Leads hoort zowel bij
 * Selling als bij CRM); geblokkeerd is dan geblokkeerd — wie in ERPNext
 * "Selling" wegzet, wil de verkooppagina's niet zien, ongeacht of CRM nog
 * aan staat.
 *
 * Niet elk scherm heeft een Module Def (Dashboard, Instellingen, Agenda,
 * Kennisbank …). Die zijn via deze bron simpelweg niet blokkeerbaar en
 * hangen alleen van de doctype-probe af.
 */
const MODULE_DEFS: Record<string, string[]> = {
  // Selling
  quotations: ["Selling"],
  salesorders: ["Selling"],
  deliverynotes: ["Selling"],
  leads: ["Selling", "CRM"],
  // Buying
  purchase: ["Buying", "Accounts"],
  // Accounts
  sales: ["Accounts"],
  "financieel-dashboard": ["Accounts"],
  ledgers: ["Accounts"],
  "bank-transactions": ["Accounts"],
  "booking-program": ["Accounts"],
  btw: ["Accounts"],
  jaarrekening: ["Accounts"],
  revenue: ["Accounts"],
  outstanding: ["Accounts"],
  "cost-insight": ["Accounts"],
  profitability: ["Accounts"],
  "liquidity-planning": ["Accounts"],
  "to-invoice": ["Accounts"],
  // Projects
  projects: ["Projects"],
  tasks: ["Projects"],
  subtasks: ["Projects"],
  planning: ["Projects"],
  timesheets: ["Projects"],
  // HR
  employees: ["HR"],
  leave: ["HR"],
  expenses: ["HR"],
  loonaangifte: ["HR"],
  // CRM
  contacts: ["CRM"],
  // Todo staat bewust NIET in deze lijst: het `ToDo`-doctype hoort in ERPNext
  // tot de module **Desk**, niet Support. Wie in ERPNext Support wegzet (geen
  // Issues) hoort zijn takenlijst te houden — de doctype-probe op `ToDo`
  // dekt de rechten al.
};

/**
 * Module-id → het hoofddoctype waarop de leesrechten van het scherm staan of
 * vallen. Eén doctype per scherm: het doctype waar de pagina zonder niets
 * kan tonen. Meerdere schermen mogen hetzelfde doctype delen (Taken,
 * Subtaken en Planning draaien alle drie op `Task`); de probe draait dan
 * uiteraard maar één keer.
 */
const MODULE_DOCTYPE: Record<string, string> = {
  webmail: "Communication",
  contacts: "Contact",
  calendar: "Event",
  projects: "Project",
  tasks: "Task",
  subtasks: "Task",
  planning: "Task",
  timesheets: "Timesheet",
  todo: "ToDo",
  wiki: "Wiki Page",
  sales: "Sales Invoice",
  purchase: "Purchase Invoice",
  quotations: "Quotation",
  salesorders: "Sales Order",
  deliverynotes: "Delivery Note",
  leads: "Lead",
  employees: "Employee",
  leave: "Leave Application",
  // Kilometers en onkosten draaien op Y-next' eigen doctypes (zie
  // lib/declaraties.ts). `Y Km Registratie` is het doctype waar het scherm
  // zonder niets kan tonen; ontbreekt het, dan is het provisioningscript nog
  // niet gedraaid en is `doctype-missing` precies de juiste uitkomst.
  expenses: "Y Km Registratie",
  "financieel-dashboard": "GL Entry",
  ledgers: "GL Entry",
  // Het scherm draait op `Bank Transaction`, niet op GL Entry. Ontbreekt dat
  // doctype op een kale site, dan is `doctype-missing` precies goed.
  "bank-transactions": "Bank Transaction",
  "meeting-notes": "Y Meeting Note",
};

/** Alle module-ids waarover deze module een uitspraak doet. */
const ALL_MODULE_IDS: string[] = [
  ...new Set([...Object.keys(MODULE_DEFS), ...Object.keys(MODULE_DOCTYPE)]),
];

const OK: ModuleAccess = { visible: true, reason: "ok" };

/** Sessiecache — één proberonde per tab, tenzij expliciet ongeldig gemaakt. */
let cached: Promise<Record<string, ModuleAccess>> | null = null;

/**
 * Welke modules deze gebruiker op deze ERPNext-site mag zien.
 *
 * De eerste aanroep doet de proberonde; daarna komt iedereen uit dezelfde
 * (gedeelde) promise. Een module die hier niet in voorkomt heeft geen
 * ERPNext-tegenhanger en is dus altijd zichtbaar — consumenten horen
 * `access[id]?.visible !== false` te gebruiken, niet `access[id].visible`.
 */
export function getModuleAccess(): Promise<Record<string, ModuleAccess>> {
  if (!cached) cached = computeModuleAccess();
  return cached;
}

/**
 * Gooi de sessiecache weg — bv. na uitloggen, of wanneer de gebruiker in
 * ERPNext net rechten of een Email Account heeft aangepast.
 */
export function invalidateModuleAccess(): void {
  cached = null;
}

async function computeModuleAccess(): Promise<Record<string, ModuleAccess>> {
  const blocked = await loadBlockedModules();

  const result: Record<string, ModuleAccess> = {};
  for (const id of ALL_MODULE_IDS) {
    const defs = MODULE_DEFS[id];
    result[id] = defs?.some((def) => blocked.has(def))
      ? { visible: false, reason: "blocked-module" }
      : OK;
  }

  // Alleen doctypes van niet-geblokkeerde modules proberen: wat ERPNext al
  // heeft weggezet hoeft geen request te kosten.
  const doctypes = [
    ...new Set(
      ALL_MODULE_IDS.filter((id) => result[id].visible)
        .map((id) => MODULE_DOCTYPE[id])
        .filter((dt): dt is string => !!dt),
    ),
  ];

  const [probes, mailConfigured] = await Promise.all([
    Promise.all(doctypes.map(async (dt) => [dt, await probeDoctype(dt)] as const)),
    result.webmail.visible ? hasEnabledEmailAccount() : Promise.resolve(true),
  ]);

  const byDoctype = new Map<string, ModuleAccess>(probes);
  for (const id of ALL_MODULE_IDS) {
    if (!result[id].visible) continue;
    const dt = MODULE_DOCTYPE[id];
    const probed = dt ? byDoctype.get(dt) : undefined;
    if (probed) result[id] = probed;
  }

  // Mail is toegestaan maar er is nog geen inkomend Email Account: item
  // blijft staan (zie de kop van dit bestand), met een eigen reden zodat de
  // pagina kan uitleggen wat er nog moet gebeuren.
  if (result.webmail.reason === "ok" && !mailConfigured) {
    result.webmail = { visible: true, reason: "not-configured" };
  }

  return result;
}

/**
 * Leest `User.block_modules` van de ingelogde gebruiker. Lukt dat niet (geen
 * sessie, 403 op de eigen User-doc, netwerk), dan levert deze bron niets op
 * — de andere bronnen beslissen dan alleen.
 */
async function loadBlockedModules(): Promise<Set<string>> {
  try {
    const user = await resolveSessionUser();
    if (!user) return new Set();
    const doc = await fetchDocument<{ block_modules?: { module?: string }[] }>("User", user);
    return new Set(
      (doc?.block_modules ?? [])
        .map((row) => row?.module)
        .filter((m): m is string => !!m),
    );
  } catch {
    return new Set();
  }
}

/**
 * Eén `get_count` per doctype. 403 ⇒ geen leesrecht; een 404 op het doctype
 * zelf laat `fetchCount` stilzwijgend naar 0 degraderen en markeert het in de
 * missing-doctype-cache van `erpnext.ts` — vandaar de `isDoctypeMissing`-check
 * ná de call in plaats van een eigen 404-afhandeling.
 */
async function probeDoctype(doctype: string): Promise<ModuleAccess> {
  try {
    await fetchCount(doctype);
    return isDoctypeMissing(doctype)
      ? { visible: false, reason: "doctype-missing" }
      : OK;
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return { visible: false, reason: "no-permission" };
    }
    // Netwerk/time-out/5xx: niet verbergen op een hik.
    return OK;
  }
}
