/**
 * Bulkbewerking van taken — wat er precies naar ERPNext gaat, los van de UI.
 *
 * Alles hier is live nagemeten op de doelinstance (Frappe v16, Task zonder
 * Workflow):
 *
 * - **Status en prioriteit zijn Select-velden.** Hun waarden komen uit het
 *   DocField van *deze* instance (`taskSelectOptions`), niet uit een lijst in
 *   deze broncode: `Template` staat wél in de doctype maar hoort niet in een
 *   statuskeuze, en een instance kan de lijst uitbreiden. De constanten
 *   hieronder zijn alleen een terugval als het metaverzoek faalt.
 * - **`exp_end_date` is een Datetime**, geen Date. Een kale `YYYY-MM-DD` wordt
 *   geaccepteerd en teruggegeven als `YYYY-MM-DD 00:00:00`; leegmaken kan met
 *   een lege string. Daarom wordt hier nooit een tijd bij verzonnen.
 * - **Toewijzen loopt NIET via `_assign`.** Dat veld is een cache die Frappe
 *   zelf bijhoudt naast de ToDo's; er direct in schrijven laat de ToDo's achter
 *   en breekt de takenlijst van de medewerker. De ondersteunde weg is
 *   `frappe.desk.form.assign_to.add` / `.remove`, en die werkt met tokenauth
 *   (geverifieerd: `add` met `assign_to: [<e-mail>, …]` geeft de ToDo's terug,
 *   `remove` met `assign_to: <e-mail>` als losse string ruimt op).
 * - **Status `Completed` zet Frappe zelf om in `progress: 100`.** Niet zelf
 *   meesturen.
 */

import { updateDocument, callMethod, deleteDocument, fetchChildTable } from "./erpnext.ts";

/** Terugval als het DocField-metaverzoek faalt (live gemeten waarden). */
export const FALLBACK_STATUS_OPTIONS = [
  "Open", "Working", "Pending Review", "Overdue", "Completed", "Cancelled",
];
export const FALLBACK_PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];

/**
 * `Template` is een interne markering voor sjabloontaken, geen werkstatus.
 * Hem in de bulkkeuze tonen nodigt uit tot een wijziging die taken uit elke
 * normale lijst laat verdwijnen.
 */
const HIDDEN_STATUS_OPTIONS = new Set(["Template"]);

export interface TaskSelectOptions {
  status: string[];
  priority: string[];
}

/** Splitst de `options`-string van een Select-DocField in losse waarden. */
export function parseSelectOptions(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw.split("\n").map((s) => s.trim()).filter(Boolean);
}

/**
 * Haalt de toegestane status- en prioriteitswaarden van de Task-doctype op.
 *
 * Via `frappe.client.get_list` op DocField met `parent: "DocType"` — de enige
 * weg die Frappe v16 voor child-tabellen toestaat (zie `fetchChildTable`). Dat
 * is één klein antwoord; `GET /api/resource/DocType/Task` zou dezelfde
 * informatie geven maar dan als ~57 kB volledige doctype.
 */
export async function fetchTaskSelectOptions(): Promise<TaskSelectOptions> {
  try {
    const rows = await fetchChildTable<{ fieldname: string; options: string }>(
      "DocField",
      "DocType",
      ["fieldname", "options"],
      [["parent", "=", "Task"], ["fieldname", "in", ["status", "priority"]]],
      10,
    );
    const byField = new Map(rows.map((r) => [r.fieldname, parseSelectOptions(r.options)]));
    const status = (byField.get("status") ?? []).filter((s) => !HIDDEN_STATUS_OPTIONS.has(s));
    const priority = byField.get("priority") ?? [];
    return {
      status: status.length > 0 ? status : FALLBACK_STATUS_OPTIONS,
      priority: priority.length > 0 ? priority : FALLBACK_PRIORITY_OPTIONS,
    };
  } catch {
    return { status: FALLBACK_STATUS_OPTIONS, priority: FALLBACK_PRIORITY_OPTIONS };
  }
}

/**
 * Wat er in één bulkactie verandert. Alle velden optioneel; een `undefined`
 * veld blijft ongemoeid, een lege string wist de waarde (project, deadline).
 */
export interface TaskBulkEdit {
  status?: string;
  priority?: string;
  /** Documentnaam van het project, of "" om los te koppelen. */
  project?: string;
  /** `YYYY-MM-DD`, of "" om de deadline te wissen. */
  exp_end_date?: string;
  /** E-mailadressen die erbij komen. */
  assignAdd?: string[];
  /** Alle bestaande toewijzingen eerst weghalen. */
  assignClear?: boolean;
}

/** Velden die via één PUT gaan. Geeft `null` als er niets te schrijven is. */
export function buildTaskUpdatePayload(edit: TaskBulkEdit): Record<string, unknown> | null {
  const payload: Record<string, unknown> = {};
  if (edit.status !== undefined) payload.status = edit.status;
  if (edit.priority !== undefined) payload.priority = edit.priority;
  if (edit.project !== undefined) payload.project = edit.project;
  if (edit.exp_end_date !== undefined) payload.exp_end_date = edit.exp_end_date;
  return Object.keys(payload).length > 0 ? payload : null;
}

/** Verandert deze bewerking überhaupt iets? */
export function isEmptyEdit(edit: TaskBulkEdit): boolean {
  return (
    buildTaskUpdatePayload(edit) === null &&
    !edit.assignClear &&
    (edit.assignAdd?.length ?? 0) === 0
  );
}

/** Injecteerbare API-laag, zodat de uitvoerder testbaar is zonder netwerk. */
export interface TaskBulkApi {
  update: typeof updateDocument;
  call: typeof callMethod;
  remove: typeof deleteDocument;
}

const defaultApi: TaskBulkApi = {
  update: updateDocument,
  call: callMethod,
  remove: deleteDocument,
};

/**
 * Voert één bewerking uit op één taak.
 *
 * Volgorde is bewust: eerst de velden (één PUT), dan de toewijzingen. Een
 * mislukte PUT moet de toewijzingen niet al hebben verzet, en `assign_to.add`
 * raakt `modified` aan — een PUT ná de RPC zou onnodig over een net gewijzigd
 * document heen schrijven.
 *
 * `currentAssignees` komt uit de lijst die de tabel al heeft; leeghalen zonder
 * die kennis zou een extra GET per taak kosten.
 */
export async function applyTaskEdit(
  name: string,
  edit: TaskBulkEdit,
  currentAssignees: readonly string[] = [],
  api: TaskBulkApi = defaultApi,
): Promise<void> {
  const payload = buildTaskUpdatePayload(edit);
  if (payload) await api.update("Task", name, payload);

  if (edit.assignClear) {
    for (const email of currentAssignees) {
      // `remove` is idempotent genoeg: een toewijzing die intussen weg is geeft
      // een lege lijst terug, geen fout.
      await api.call("frappe.desk.form.assign_to.remove", {
        doctype: "Task",
        name,
        assign_to: email,
      });
    }
  }

  const toAdd = (edit.assignAdd ?? []).filter(
    (email) => edit.assignClear || !currentAssignees.includes(email),
  );
  if (toAdd.length > 0) {
    await api.call("frappe.desk.form.assign_to.add", {
      doctype: "Task",
      name,
      assign_to: toAdd,
    });
  }
}

/** Verwijdert één taak. */
export async function deleteTask(name: string, api: TaskBulkApi = defaultApi): Promise<void> {
  await api.remove("Task", name);
}
