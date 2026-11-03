/**
 * Ecosysteem — de apps lezen en schrijven in de ERPNext. Het model staat in
 * `apps-model.ts`; de doctypes horen bij de app (zonder de app zet
 * `scripts/provision-y-next.mjs` ze neer).
 */
import {
  ApiError, createDocument, deleteDocument, fetchChildTable, fetchList, invalidateCache, isDoctypeMissing, updateDocument,
} from "./erpnext";
import { DT_APP, DT_APP_LID, type App, type AppLid } from "./apps-model";

export type AppsStand = "klaar" | "niet-ingesteld" | "geen-rechten";

export async function appsStand(): Promise<AppsStand> {
  try {
    await fetchList(DT_APP, { fields: ["name"], limit_page_length: 1 });
    return isDoctypeMissing(DT_APP) ? "niet-ingesteld" : "klaar";
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return "geen-rechten";
    if (e instanceof ApiError && (e.status === 404 || e.status === 417)) return "niet-ingesteld";
    throw e;
  }
}

const APP_FIELDS = ["name", "naam", "status", "in_ecosysteem", "productmanager", "project", "repository", "codeowners", "beschrijving", "volgorde"];

/** Alle apps met hun team. Bestaan de doctypes niet, dan een lege lijst. */
export async function listApps(): Promise<App[]> {
  const [apps, leden] = await Promise.all([
    fetchList<Omit<App, "team">>(DT_APP, { fields: APP_FIELDS, limit_page_length: 0, order_by: "volgorde asc" }),
    fetchChildTable<AppLid & { parent: string; idx: number }>(DT_APP_LID, DT_APP, ["name", "parent", "persoon", "rol", "idx"], undefined, 0),
  ]);
  return apps.map((a) => ({
    ...a,
    team: leden.filter((l) => l.parent === a.name).sort((x, y) => x.idx - y.idx).map((l) => ({ name: l.name, persoon: l.persoon, rol: l.rol })),
  }));
}

export type AppGegevens = Omit<App, "name">;

/** Slaat een app op, met het hele team; een lege Link gaat als "" mee, anders laat Frappe de oude staan. */
export async function saveApp(name: string | null, data: AppGegevens): Promise<void> {
  const doc: Record<string, unknown> = {
    ...data,
    productmanager: data.productmanager || "",
    project: data.project || "",
    team: data.team.map((l) => ({ persoon: l.persoon, rol: l.rol || "" })),
  };
  if (name) await updateDocument(DT_APP, name, doc);
  else await createDocument(DT_APP, doc);
  invalidateCache(DT_APP);
  invalidateCache(DT_APP_LID);
}

export async function deleteApp(name: string): Promise<void> {
  await deleteDocument(DT_APP, name);
  invalidateCache(DT_APP);
  invalidateCache(DT_APP_LID);
}
