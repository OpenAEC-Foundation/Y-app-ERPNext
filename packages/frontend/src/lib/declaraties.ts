/**
 * Kilometers en onkosten — de gedeelde laag boven Y-next' eigen doctypes.
 *
 * **Waarom eigen doctypes.** Kilometerregistratie liep vroeger op HRMS'
 * `Travel Request` (een dienstreis-aanvraag: vlucht, hotel, visum) met een
 * handvol `custom_`-velden erop geplakt. Die app wordt op deze installatie
 * bewust niet geïnstalleerd, dus dat doctype bestaat niet. In plaats daarvan
 * maakt `scripts/provision-y-next.mjs` via de REST-API drie eigen doctypes
 * aan:
 *
 * - **`Y Km Registratie`** — één document per rit.
 * - **`Y Onkosten`** — één document per bon. Het bonnetje zelf is een gewone
 *   ERPNext-bijlage (`File` met `attached_to_doctype`), geen eigen veld.
 * - **`Y Onkostensoort`** — de soortenlijst (stamtabel).
 *
 * **Eén document per rit/bon** in plaats van een maandstaat met child-rijen:
 * dat maakt goedkeuren per stuk mogelijk en laat Frappe's `if_owner`-rechten
 * het werk doen — die werken op documentniveau, niet op child-rijen. Een
 * medewerker ziet en wijzigt daardoor uitsluitend zijn eigen boekingen zonder
 * dat er ook maar één filter in de frontend voor nodig is.
 *
 * **De statusstroom** is `Concept → Ingediend → Goedgekeurd | Afgewezen`. De
 * medewerker zet Concept → Ingediend; de werkgever beslist. `goedgekeurd_door`
 * en `goedgekeurd_op` staan op **permlevel 1** en kunnen alleen door de
 * werkgever geschreven worden, dus een "Goedgekeurd" record zonder
 * goedkeurstempel is zichtbaar onecht (zie `declaratiePermissions` in het
 * provisioningscript voor de volledige afweging).
 */

import { fetchList, createDocument, updateDocument } from "./erpnext.ts";
import { DEFAULT_KM_TARIEF } from "./kmTarief.ts";

export const KM_DOCTYPE = "Y Km Registratie";
export const ONKOSTEN_DOCTYPE = "Y Onkosten";
export const ONKOSTENSOORT_DOCTYPE = "Y Onkostensoort";

export type DeclaratieStatus = "Concept" | "Ingediend" | "Goedgekeurd" | "Afgewezen";

/** Vaste volgorde van de statussen — gebruikt voor filters en sortering. */
export const DECLARATIE_STATUSSEN: DeclaratieStatus[] = [
  "Concept",
  "Ingediend",
  "Goedgekeurd",
  "Afgewezen",
];

export interface KmRegistratie {
  name: string;
  employee: string;
  employee_name?: string;
  datum: string;
  van?: string;
  naar?: string;
  kilometers: number;
  retour?: 0 | 1;
  project?: string;
  omschrijving?: string;
  tarief_per_km?: number;
  bedrag?: number;
  status: DeclaratieStatus;
  goedgekeurd_door?: string;
  goedgekeurd_op?: string;
  owner?: string;
}

export interface Onkostenpost {
  name: string;
  employee: string;
  employee_name?: string;
  datum: string;
  soort: string;
  bedrag: number;
  btw_bedrag?: number;
  omschrijving?: string;
  project?: string;
  leverancier?: string;
  status: DeclaratieStatus;
  goedgekeurd_door?: string;
  goedgekeurd_op?: string;
  owner?: string;
}

/** De velden die de lijstweergaven nodig hebben. */
export const KM_FIELDS = [
  "name", "employee", "datum", "van", "naar", "kilometers", "retour",
  "project", "omschrijving", "tarief_per_km", "bedrag", "status",
  "goedgekeurd_door", "goedgekeurd_op", "owner",
];

export const ONKOSTEN_FIELDS = [
  "name", "employee", "datum", "soort", "bedrag", "btw_bedrag", "omschrijving",
  "project", "leverancier", "status", "goedgekeurd_door", "goedgekeurd_op", "owner",
];

/* ─────────────────────────── Rekenen ─────────────────────────── */

/**
 * Het te vergoeden bedrag van één rit.
 *
 * Retour telt de afstand dubbel: de gebruiker vult de enkele reis in en vinkt
 * "retour" aan — dat is hoe het invoerformulier er altijd al uitzag, en het
 * voorkomt dat iemand per ongeluk de heenreis twee keer optelt.
 *
 * Afgerond op hele centen, want het is een geldbedrag dat in een Currency-veld
 * belandt; zonder afronding levert 0,1 × 3 al `0.30000000000000004` op.
 * Onbruikbare invoer (negatief, NaN) levert 0 — nooit een negatieve vergoeding.
 */
export function computeKmBedrag(kilometers: number, retour: boolean, tariefPerKm: number): number {
  const km = Number(kilometers);
  const tarief = Number(tariefPerKm);
  if (!Number.isFinite(km) || !Number.isFinite(tarief) || km <= 0 || tarief <= 0) return 0;
  return Math.round(km * (retour ? 2 : 1) * tarief * 100) / 100;
}

/** De werkelijk gereden afstand van een rit (retour = dubbel). */
export function totaleKilometers(rit: Pick<KmRegistratie, "kilometers" | "retour">): number {
  const km = Number(rit.kilometers) || 0;
  return rit.retour ? km * 2 : km;
}

/* ─────────────────────────── Payloads ─────────────────────────── */

export interface KmInvoer {
  employee: string;
  datum: string;
  van: string;
  naar: string;
  kilometers: number;
  retour: boolean;
  project?: string;
  omschrijving?: string;
  tariefPerKm?: number;
}

/**
 * Bouwt de payload voor een `Y Km Registratie`.
 *
 * Het tarief wordt hier **vastgelegd op het document** (`tarief_per_km`) en
 * `bedrag` wordt er meteen uit berekend. `bedrag` is in ERPNext `read_only`,
 * maar dat is een UI-vlag — de REST-API mag het gewoon vullen, en dat moet ook:
 * er draait geen server-side script dat het zou kunnen uitrekenen.
 *
 * Lege optionele velden worden weggelaten in plaats van als lege string
 * meegestuurd: een leeg `project` zou anders een Link-validatie op ""
 * uitlokken.
 */
export function buildKmPayload(invoer: KmInvoer): Record<string, unknown> {
  const tarief = invoer.tariefPerKm ?? DEFAULT_KM_TARIEF;
  return {
    employee: invoer.employee,
    datum: invoer.datum,
    ...(invoer.van ? { van: invoer.van } : {}),
    ...(invoer.naar ? { naar: invoer.naar } : {}),
    kilometers: invoer.kilometers,
    retour: invoer.retour ? 1 : 0,
    ...(invoer.project ? { project: invoer.project } : {}),
    ...(invoer.omschrijving ? { omschrijving: invoer.omschrijving } : {}),
    tarief_per_km: tarief,
    bedrag: computeKmBedrag(invoer.kilometers, invoer.retour, tarief),
    status: "Concept",
  };
}

export interface OnkostenInvoer {
  employee: string;
  datum: string;
  soort: string;
  bedrag: number;
  btwBedrag?: number;
  omschrijving?: string;
  project?: string;
  leverancier?: string;
}

/** Bouwt de payload voor een `Y Onkosten`. Zelfde weglaat-regel als hierboven. */
export function buildOnkostenPayload(invoer: OnkostenInvoer): Record<string, unknown> {
  return {
    employee: invoer.employee,
    datum: invoer.datum,
    soort: invoer.soort,
    bedrag: invoer.bedrag,
    ...(invoer.btwBedrag ? { btw_bedrag: invoer.btwBedrag } : {}),
    ...(invoer.omschrijving ? { omschrijving: invoer.omschrijving } : {}),
    ...(invoer.project ? { project: invoer.project } : {}),
    ...(invoer.leverancier ? { leverancier: invoer.leverancier } : {}),
    status: "Concept",
  };
}

/**
 * De patch die een declaratie goedkeurt of afwijst.
 *
 * `goedgekeurd_door` en `goedgekeurd_op` zitten op permlevel 1, dus deze patch
 * slaagt alleen voor de werkgever — een medewerker krijgt er een 403 op, ook
 * al mag hij `status` zelf wél schrijven. Bij afwijzen wordt de stempel juist
 * gewíst: het record gaat terug naar "niet goedgekeurd", en een oude stempel
 * zou suggereren dat er ooit een geldige goedkeuring lag.
 */
export function buildBeoordelingPatch(
  status: Extract<DeclaratieStatus, "Goedgekeurd" | "Afgewezen">,
  beoordelaar: string,
  nu: Date = new Date(),
): Record<string, unknown> {
  if (status === "Afgewezen") {
    return { status, goedgekeurd_door: null, goedgekeurd_op: null };
  }
  return { status, goedgekeurd_door: beoordelaar, goedgekeurd_op: formatErpDatetime(nu) };
}

/** `YYYY-MM-DD HH:mm:ss` in lokale tijd — het formaat dat Frappe verwacht. */
export function formatErpDatetime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** `YYYY-MM-DD` in lokale tijd (niet `toISOString`, die schuift een dag bij UTC+1). */
export function formatErpDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ─────────────────────────── Ophalen ─────────────────────────── */

export interface DeclaratieFilter {
  employee?: string;
  status?: DeclaratieStatus | "";
  vanaf?: string;
  tot?: string;
  limit?: number;
}

function buildFilters(filter: DeclaratieFilter): unknown[][] {
  const filters: unknown[][] = [];
  if (filter.employee) filters.push(["employee", "=", filter.employee]);
  if (filter.status) filters.push(["status", "=", filter.status]);
  if (filter.vanaf) filters.push(["datum", ">=", filter.vanaf]);
  if (filter.tot) filters.push(["datum", "<=", filter.tot]);
  return filters;
}

export async function fetchKmRegistraties(filter: DeclaratieFilter = {}): Promise<KmRegistratie[]> {
  return fetchList<KmRegistratie>(KM_DOCTYPE, {
    fields: KM_FIELDS,
    filters: buildFilters(filter),
    order_by: "datum desc, modified desc",
    limit_page_length: filter.limit ?? 200,
  });
}

export async function fetchOnkosten(filter: DeclaratieFilter = {}): Promise<Onkostenpost[]> {
  return fetchList<Onkostenpost>(ONKOSTEN_DOCTYPE, {
    fields: ONKOSTEN_FIELDS,
    filters: buildFilters(filter),
    order_by: "datum desc, modified desc",
    limit_page_length: filter.limit ?? 200,
  });
}

/** De actieve onkostensoorten, alfabetisch. */
export async function fetchOnkostensoorten(): Promise<string[]> {
  const rows = await fetchList<{ name: string }>(ONKOSTENSOORT_DOCTYPE, {
    fields: ["name"],
    filters: [["actief", "=", 1]],
    order_by: "name asc",
    limit_page_length: 100,
  });
  return rows.map((r) => r.name).filter(Boolean);
}

/* ─────────────────────────── Schrijven ─────────────────────────── */

export async function createKmRegistratie(invoer: KmInvoer): Promise<{ name: string }> {
  return createDocument<{ name: string }>(KM_DOCTYPE, buildKmPayload(invoer));
}

export async function createOnkosten(invoer: OnkostenInvoer): Promise<{ name: string }> {
  return createDocument<{ name: string }>(ONKOSTEN_DOCTYPE, buildOnkostenPayload(invoer));
}

/** Zet één declaratie op "Ingediend" (medewerkersactie). */
export async function dienIn(doctype: string, name: string): Promise<void> {
  await updateDocument(doctype, name, { status: "Ingediend" });
}

/** Keurt één declaratie goed of af (werkgeversactie, vereist permlevel 1). */
export async function beoordeel(
  doctype: string,
  name: string,
  status: Extract<DeclaratieStatus, "Goedgekeurd" | "Afgewezen">,
  beoordelaar: string,
): Promise<void> {
  await updateDocument(doctype, name, buildBeoordelingPatch(status, beoordelaar));
}
