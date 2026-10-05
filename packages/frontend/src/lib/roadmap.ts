/**
 * Roadmap: productmijlpalen per maand, bovenop gewone ERPNext-taken.
 *
 * Een mijlpaal is een Task in het roadmapproject. De deadline
 * (`exp_end_date`) bepaalt de maandkolom, het standaardveld `type`
 * (Task Type) het product, en de toewijzing (`_assign`) de eigenaar. Er is
 * bewust geen eigen doctype: zo werken toewijzen, meldingen en de gewone
 * takenlijst vanzelf mee.
 *
 * De periode van de roadmap komt uit het project zelf (verwachte start- en
 * einddatum), zodat een volgende roadmap alleen een nieuw project is.
 */
import { callMethod, createDocument, fetchList, invalidateCache, updateDocument } from "./erpnext.ts";

/** Projecten waarvan de naam hiermee begint, gelden als roadmap. */
export const ROADMAP_PREFIX = "Roadmap";

export interface Mijlpaal {
  name: string;
  subject: string;
  status: string;
  /** Het product (Task Type). Leeg als het niet is ingevuld. */
  type: string;
  exp_end_date: string;
  /** User-id's uit `_assign`. */
  eigenaren: string[];
}

export interface RoadmapProject {
  name: string;
  project_name: string;
  expected_start_date: string;
  expected_end_date: string;
}

/* ─── Rekenwerk (zonder netwerk, getest) ─── */

/** "YYYY-MM" voor elke maand van start tot en met eind. */
export function maandenTussen(start: string, eind: string): string[] {
  if (!start || !eind || eind < start) return [];
  let [j, m] = start.slice(0, 7).split("-").map(Number);
  const [ej, em] = eind.slice(0, 7).split("-").map(Number);
  const uit: string[] = [];
  while (j < ej || (j === ej && m <= em)) {
    uit.push(`${j}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; j += 1; }
  }
  return uit;
}

/** De laatste dag van een maand, als "YYYY-MM-DD". */
export function eindeVanMaand(maand: string): string {
  const [j, m] = maand.split("-").map(Number);
  const dag = new Date(Date.UTC(j, m, 0)).getUTCDate();
  return `${maand}-${String(dag).padStart(2, "0")}`;
}

export function isKlaar(status: string): boolean {
  return status === "Completed";
}

/** Per maand de mijlpalen, op deadline gesorteerd. Geannuleerd en zonder deadline vallen weg. */
export function groepeerPerMaand(mijlpalen: Mijlpaal[], maanden: string[]): Record<string, Mijlpaal[]> {
  const uit: Record<string, Mijlpaal[]> = {};
  for (const m of maanden) uit[m] = [];
  for (const mp of mijlpalen) {
    if (mp.status === "Cancelled" || !mp.exp_end_date) continue;
    const kolom = uit[mp.exp_end_date.slice(0, 7)];
    if (kolom) kolom.push(mp);
  }
  for (const m of maanden) uit[m].sort((a, b) => a.exp_end_date.localeCompare(b.exp_end_date) || a.subject.localeCompare(b.subject));
  return uit;
}

export function voortgang(mijlpalen: Mijlpaal[]): { klaar: number; totaal: number } {
  return { klaar: mijlpalen.filter((m) => isKlaar(m.status)).length, totaal: mijlpalen.length };
}

/** Open, en de deadline ligt vóór vandaag ("YYYY-MM-DD"). */
export function isAchterstand(mp: Mijlpaal, vandaag: string): boolean {
  return !isKlaar(mp.status) && !!mp.exp_end_date && mp.exp_end_date < vandaag;
}

/**
 * Vult de eigenaar aan uit de toewijzingen (ToDo's) van de taak.
 *
 * ERPNext sluit de toewijzing zodra een taak op voltooid gaat en maakt
 * `_assign` dan leeg. Zonder dit verdween de eigenaar van elke afgevinkte
 * mijlpaal, en kwam hij bij heropenen ook niet terug. Geannuleerde
 * toewijzingen tellen niet; wie nog een actuele eigenaar heeft, houdt die.
 */
export function vulEigenarenAan(
  mijlpalen: Mijlpaal[],
  todos: ReadonlyArray<{ reference_name: string; allocated_to: string; status: string }>,
): Mijlpaal[] {
  return mijlpalen.map((mp) => {
    if (mp.eigenaren.length) return mp;
    const uit: string[] = [];
    for (const t of todos) {
      if (t.reference_name === mp.name && t.status !== "Cancelled" && t.allocated_to && !uit.includes(t.allocated_to)) {
        uit.push(t.allocated_to);
      }
    }
    return uit.length ? { ...mp, eigenaren: uit } : mp;
  });
}

function leesEigenaren(ruw: unknown): string[] {
  if (Array.isArray(ruw)) return ruw.map(String);
  if (typeof ruw !== "string" || !ruw.trim()) return [];
  try {
    const lijst = JSON.parse(ruw);
    return Array.isArray(lijst) ? lijst.map(String) : [];
  } catch {
    return [];
  }
}

/* ─── ERPNext ─── */

/** Het meest recente roadmapproject, of null als er nog geen is. */
export async function vindRoadmapProject(): Promise<RoadmapProject | null> {
  const rijen = await fetchList<RoadmapProject>("Project", {
    fields: ["name", "project_name", "expected_start_date", "expected_end_date"],
    filters: [["project_name", "like", `${ROADMAP_PREFIX}%`], ["status", "!=", "Cancelled"]],
    order_by: "expected_start_date desc",
    limit_page_length: 1,
  });
  return rijen[0] ?? null;
}

export async function laadMijlpalen(project: string): Promise<Mijlpaal[]> {
  invalidateCache("Task");
  const rijen = await fetchList<Record<string, unknown>>("Task", {
    fields: ["name", "subject", "status", "type", "exp_end_date", "_assign"],
    filters: [["project", "=", project]],
    limit_page_length: 500,
  });
  const mijlpalen = rijen.map((r) => ({
    name: String(r.name ?? ""),
    subject: String(r.subject ?? ""),
    status: String(r.status ?? "Open"),
    type: String(r.type ?? ""),
    exp_end_date: String(r.exp_end_date ?? ""),
    eigenaren: leesEigenaren(r._assign),
  }));
  const zonder = mijlpalen.filter((m) => !m.eigenaren.length).map((m) => m.name);
  if (!zonder.length) return mijlpalen;
  // Wie geen leesrecht op andermans ToDo's heeft, ziet hier minder; dat is geen fout.
  const todos = await fetchList<{ reference_name: string; allocated_to: string; status: string }>("ToDo", {
    fields: ["reference_name", "allocated_to", "status"],
    filters: [["reference_type", "=", "Task"], ["reference_name", "in", zonder]],
    order_by: "modified desc",
    limit_page_length: 500,
  }).catch(() => []);
  return vulEigenarenAan(mijlpalen, todos);
}

/** Bij heropenen komen de eigenaren terug: ERPNext sloot hun toewijzing bij het afvinken. */
export async function zetKlaar(naam: string, klaar: boolean, eigenaren: readonly string[] = []): Promise<void> {
  await updateDocument("Task", naam, { status: klaar ? "Completed" : "Open" });
  if (!klaar && eigenaren.length) {
    await callMethod("frappe.desk.form.assign_to.add", {
      doctype: "Task",
      name: naam,
      assign_to: JSON.stringify([...eigenaren]),
    }).catch(() => undefined);
  }
  invalidateCache("Task");
}

/** De producten waaruit gekozen kan worden: de bestaande Task Types. */
export async function laadProducten(): Promise<string[]> {
  const rijen = await fetchList<{ name?: string }>("Task Type", { fields: ["name"], limit_page_length: 200 });
  return rijen.map((r) => String(r.name ?? "")).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export async function maakMijlpaal(invoer: {
  project: string;
  subject: string;
  type: string;
  deadline: string;
  eigenaar?: string;
}): Promise<void> {
  const taak = (await createDocument("Task", {
    subject: invoer.subject,
    project: invoer.project,
    type: invoer.type || undefined,
    exp_end_date: invoer.deadline,
    status: "Open",
  })) as { name?: string } | null;
  if (invoer.eigenaar && taak?.name) {
    await callMethod("frappe.desk.form.assign_to.add", {
      doctype: "Task",
      name: taak.name,
      assign_to: JSON.stringify([invoer.eigenaar]),
    });
  }
  invalidateCache("Task");
}

export async function maakRoadmapProject(naam: string, start: string, eind: string): Promise<void> {
  await createDocument("Project", {
    project_name: naam,
    expected_start_date: start,
    expected_end_date: eind,
    status: "Open",
  });
  invalidateCache("Project");
}
