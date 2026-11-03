/**
 * Werkplekken — lezen en schrijven in de ERPNext. Het model staat in
 * `werkplekken-model.ts`; de doctypes horen bij de app (met de app
 * geïnstalleerd bestaan ze, zonder de app zet `scripts/provision-y-next.mjs`
 * ze neer).
 */
import {
  ApiError, callMethod, createDocument, deleteDocument, fetchAll, fetchList, invalidateCache, isDoctypeMissing,
  updateDocument,
} from "./erpnext";
import { getActiveCompany } from "./instances";
import {
  AFGERONDE_TAAKSTATUSSEN, DT_BOEKING, DT_PERSOON, DT_WERKPLEK,
  type Boeking, type BoekingStatus, type Persoon, type TaakRegel, type Werkplek,
} from "./werkplekken-model";

export type WerkplekkenStand = "klaar" | "niet-ingesteld" | "geen-rechten";

/** Zijn de werkplekken op deze ERPNext ingesteld, en mag deze gebruiker erbij? */
export async function werkplekkenStand(): Promise<WerkplekkenStand> {
  try {
    await fetchList(DT_WERKPLEK, { fields: ["name"], limit_page_length: 1 });
    return isDoctypeMissing(DT_WERKPLEK) ? "niet-ingesteld" : "klaar";
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return "geen-rechten";
    if (e instanceof ApiError && (e.status === 404 || e.status === 417)) return "niet-ingesteld";
    throw e;
  }
}

const PERSOON_FIELDS = ["name", "naam", "gebruiker", "dag_ma", "dag_di", "dag_wo", "dag_do", "dag_vr", "wisselend", "af_en_toe", "actief", "volgorde", "notitie"];
const WERKPLEK_FIELDS = ["name", "plek", "ruimte", "omschrijving", "vaste_persoon", "voorkeur_persoon", "volgorde", "actief"];
const BOEKING_FIELDS = ["name", "persoon", "datum", "status", "werkplek", "notitie"];

export function listPersonen(): Promise<Persoon[]> {
  return fetchList<Persoon>(DT_PERSOON, { fields: PERSOON_FIELDS, limit_page_length: 0, order_by: "volgorde asc" });
}

export function listWerkplekken(): Promise<Werkplek[]> {
  return fetchList<Werkplek>(DT_WERKPLEK, { fields: WERKPLEK_FIELDS, limit_page_length: 0, order_by: "volgorde asc" });
}

export function listBoekingen(van: string, tot: string): Promise<Boeking[]> {
  return fetchList<Boeking>(DT_BOEKING, {
    fields: BOEKING_FIELDS, limit_page_length: 0, order_by: "datum asc",
    filters: [["datum", ">=", van], ["datum", "<=", tot]],
  });
}

export type PersoonGegevens = Omit<Persoon, "name">;
export type WerkplekGegevens = Omit<Werkplek, "name">;

export async function savePersoon(name: string | null, data: Partial<PersoonGegevens>): Promise<void> {
  if (name) await updateDocument(DT_PERSOON, name, data as Record<string, unknown>);
  else await createDocument(DT_PERSOON, data as Record<string, unknown>);
  invalidateCache(DT_PERSOON);
}

export async function deletePersoon(name: string): Promise<void> {
  await deleteDocument(DT_PERSOON, name);
  invalidateCache(DT_PERSOON);
}

export async function saveWerkplek(name: string | null, data: Partial<WerkplekGegevens>): Promise<void> {
  if (name) await updateDocument(DT_WERKPLEK, name, data as Record<string, unknown>);
  else await createDocument(DT_WERKPLEK, data as Record<string, unknown>);
  invalidateCache(DT_WERKPLEK);
}

export async function deleteWerkplek(name: string): Promise<void> {
  await deleteDocument(DT_WERKPLEK, name);
  invalidateCache(DT_WERKPLEK);
}

/**
 * Zet de dag van één persoon. `null` als status haalt de boeking weg, zodat
 * het patroon weer geldt. Er is per persoon en dag hooguit één boeking; staat
 * er toch meer dan één (twee mensen tegelijk), dan blijft de eerste en
 * verdwijnt de rest.
 */
export async function zetDag(
  persoon: string, datum: string, status: BoekingStatus | null, werkplek: string | null, bestaand: Boeking[],
): Promise<void> {
  const [eerste, ...rest] = bestaand;
  for (const b of rest) await deleteDocument(DT_BOEKING, b.name);
  if (status === null) {
    if (eerste) await deleteDocument(DT_BOEKING, eerste.name);
  } else if (eerste) {
    await updateDocument(DT_BOEKING, eerste.name, { status, werkplek: werkplek || "" });
  } else {
    await createDocument(DT_BOEKING, { persoon, datum, status, werkplek: werkplek || undefined });
  }
  invalidateCache(DT_BOEKING);
}

// ── Taken ──────────────────────────────────────────────────────────────────

/**
 * Open taken die deze week kunnen raken: alles wat niet af is en een
 * deadline vanaf `van` heeft of nog geen deadline. Wat er op welke dag loopt,
 * rekent het model uit.
 */
export async function listOpenTaken(): Promise<TaakRegel[]> {
  return fetchAll<TaakRegel>(
    "Task",
    ["name", "subject", "project", "status", "exp_start_date", "exp_end_date", "_assign"],
    [["status", "not in", AFGERONDE_TAAKSTATUSSEN]],
    "exp_end_date asc",
  );
}

/** Open taken in een project die nog niemand heeft; die kun je iemand geven. */
export async function listVrijeTaken(project: string): Promise<TaakRegel[]> {
  invalidateCache("Task");
  const rijen = await fetchList<TaakRegel>("Task", {
    fields: ["name", "subject", "project", "status", "exp_start_date", "exp_end_date", "_assign"],
    filters: [["project", "=", project], ["status", "not in", AFGERONDE_TAAKSTATUSSEN]],
    limit_page_length: 0, order_by: "exp_end_date asc",
  });
  return rijen.filter((t) => !t._assign || t._assign === "[]");
}

export interface NieuweTaak {
  subject: string;
  project: string;
  start: string | null;
  deadline: string | null;
}

/**
 * Maakt een gewone ERPNext-taak en wijst hem toe. Zelfde weg als de
 * Takenpagina, zodat de taak daar en in de kanban meteen in de kolom van die
 * persoon staat.
 */
export async function geefNieuweTaak(gebruiker: string, taak: NieuweTaak): Promise<void> {
  const doc = await createDocument<{ name: string }>("Task", {
    subject: taak.subject,
    project: taak.project,
    company: getActiveCompany() || undefined,
    exp_start_date: taak.start || undefined,
    exp_end_date: taak.deadline || undefined,
  });
  await callMethod("frappe.desk.form.assign_to.add", { doctype: "Task", name: doc.name, assign_to: [gebruiker] });
  invalidateCache("Task");
}

/** Geeft een bestaande taak aan iemand; zet de datums alleen als ze er nog niet zijn. */
export async function geefBestaandeTaak(gebruiker: string, taak: TaakRegel, start: string | null, deadline: string | null): Promise<void> {
  const datums: Record<string, string> = {};
  if (!taak.exp_start_date && start) datums.exp_start_date = start;
  if (!taak.exp_end_date && deadline) datums.exp_end_date = deadline;
  if (Object.keys(datums).length) await updateDocument("Task", taak.name, datums);
  await callMethod("frappe.desk.form.assign_to.add", { doctype: "Task", name: taak.name, assign_to: [gebruiker] });
  invalidateCache("Task");
}

/**
 * Actieve ERP-gebruikers, om iemand aan een account te koppelen. Uit User en
 * niet uit Employee: niet iedereen die taken krijgt is medewerker, en een
 * medewerker ziet in Employee vaak alleen zichzelf.
 */
export async function listGebruikers(): Promise<{ email: string; naam: string }[]> {
  try {
    const users = await fetchList<{ name: string; full_name: string | null }>("User", {
      fields: ["name", "full_name"], filters: [["enabled", "=", 1], ["user_type", "=", "System User"]], limit_page_length: 0,
    });
    return users.map((u) => ({ email: u.name, naam: u.full_name || u.name }))
      .sort((a, b) => a.naam.localeCompare(b.naam));
  } catch {
    return [];
  }
}
