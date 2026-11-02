/**
 * Brainstorm — lezen en schrijven in de ERPNext. Het model zelf staat in
 * `brainstorm-model.ts`; de doctypes horen bij de app (met de app geïnstalleerd
 * bestaan ze, zonder de app zet `scripts/provision-y-next.mjs` ze neer).
 */
import {
  ApiError, createDocument, deleteDocument, fetchAttachments, fetchChildTable, fetchDocument, fetchList,
  invalidateCache, isDoctypeMissing, updateDocument, uploadFile, type FileInfo,
} from "./erpnext";
import {
  DEFAULT_LABELS, DT_IDEE, DT_LABEL, DT_PUNT,
  type Idee, type IdeeStatus, type Label, type Punt,
} from "./brainstorm-model";

export type BrainstormStand = "klaar" | "niet-ingesteld" | "geen-rechten";

/** Is de brainstorm op deze ERPNext ingesteld, en mag deze gebruiker erbij? */
export async function brainstormStand(): Promise<BrainstormStand> {
  try {
    // Een ontbrekend doctype levert hier een lege lijst op, geen fout; de
    // erpnext-laag onthoudt dat het ontbreekt.
    await fetchList(DT_IDEE, { fields: ["name"], limit_page_length: 1 });
    return isDoctypeMissing(DT_IDEE) ? "niet-ingesteld" : "klaar";
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return "geen-rechten";
    if (e instanceof ApiError && (e.status === 404 || e.status === 417)) return "niet-ingesteld";
    throw e;
  }
}

/**
 * Een lege labellijst krijgt de OpenAEC-standaardset. Dat gebeurt hier en niet
 * bij het provisioneren, zodat een label dat iemand weghaalt weg blijft.
 */
export async function vulLabelsAlsLeeg(bestaand: Label[]): Promise<boolean> {
  if (bestaand.length > 0) return false;
  for (const [groep, labels] of Object.entries(DEFAULT_LABELS)) {
    for (const label of labels) {
      await createDocument(DT_LABEL, { label, groep }).catch(() => undefined);
    }
  }
  invalidateCache(DT_LABEL);
  return true;
}

const IDEE_FIELDS = ["name", "titel", "beschrijving", "status", "volgorde", "datum", "deadline", "labels", "koppeling", "resultaat", "owner", "modified"];

export interface IdeeMetVoortgang extends Idee {
  aantalPunten: number;
  aantalGedaan: number;
}

export async function listIdeeen(): Promise<IdeeMetVoortgang[]> {
  const [ideeen, punten] = await Promise.all([
    fetchList<Idee>(DT_IDEE, { fields: IDEE_FIELDS, limit_page_length: 0, order_by: "volgorde asc" }),
    fetchChildTable<{ parent: string; gedaan: 0 | 1 }>(DT_PUNT, DT_IDEE, ["parent", "gedaan"], undefined, 0),
  ]);
  const tel = new Map<string, { n: number; d: number }>();
  for (const p of punten) {
    const t = tel.get(String(p.parent)) || { n: 0, d: 0 };
    t.n += 1;
    if (p.gedaan) t.d += 1;
    tel.set(String(p.parent), t);
  }
  return ideeen.map((i) => {
    const t = tel.get(String(i.name));
    return { ...i, name: String(i.name), aantalPunten: t?.n ?? 0, aantalGedaan: t?.d ?? 0 };
  });
}

export async function getIdee(name: string): Promise<Idee> {
  invalidateCache(DT_IDEE);
  const doc = await fetchDocument<Idee>(DT_IDEE, name);
  return { ...doc, name: String(doc.name), punten: (doc.punten || []).map((p) => ({ name: p.name, tekst: p.tekst, gedaan: p.gedaan ? 1 : 0 })) };
}

export async function createIdee(data: { titel: string; volgorde: number }): Promise<Idee> {
  const doc = await createDocument<Idee>(DT_IDEE, { ...data, status: "Open" });
  return { ...doc, name: String(doc.name) };
}

export type IdeeWijziging = Partial<Pick<Idee, "titel" | "beschrijving" | "status" | "volgorde" | "datum" | "deadline" | "labels" | "koppeling" | "resultaat">> & {
  punten?: Punt[];
};

export async function updateIdee(name: string, data: IdeeWijziging): Promise<void> {
  await updateDocument(DT_IDEE, name, data as Record<string, unknown>);
  // De voortgang op de tegels komt uit de child-tabel; die lijst moet mee vernieuwen.
  if (data.punten) invalidateCache(DT_PUNT);
}

export async function setStatus(name: string, status: IdeeStatus): Promise<void> {
  await updateIdee(name, { status });
}

export async function deleteIdee(name: string): Promise<void> {
  await deleteDocument(DT_IDEE, name);
  invalidateCache(DT_PUNT);
}

export async function listLabels(): Promise<Label[]> {
  return fetchList<Label>(DT_LABEL, { fields: ["name", "label", "groep"], limit_page_length: 0, order_by: "label asc" });
}

export async function createLabel(label: string, groep: Label["groep"]): Promise<Label> {
  return createDocument<Label>(DT_LABEL, { label, groep });
}

export async function deleteLabel(name: string): Promise<void> {
  await deleteDocument(DT_LABEL, name);
}

export function listBijlagen(name: string): Promise<FileInfo[]> {
  invalidateCache("File");
  return fetchAttachments(DT_IDEE, name);
}

export function uploadBijlage(name: string, file: File): Promise<FileInfo> {
  return uploadFile(file, DT_IDEE, name, true);
}

export async function deleteBijlage(fileName: string): Promise<void> {
  await deleteDocument("File", fileName);
}
