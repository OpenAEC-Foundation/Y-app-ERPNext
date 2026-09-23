/**
 * Projecten en relaties kiezen vanuit de zoekbalk van de mail.
 *
 * Typ je in de zoekbalk, dan staan hieronder de projecten, klanten en leads
 * waarvan het nummer of de naam past. Kies je er één, dan opent de
 * connectiemap van dat document: alle mail die eraan gekoppeld is, ook als
 * het woord niet in het onderwerp staat. Het is dezelfde map als in de
 * connectiekolom, dus dezelfde grenzen (postbus, bedrijf, prullenbak).
 */
import { fetchList } from "./erpnext.ts";
import { toonLabel, vergelijkProjectnummer, type ConnectionCategoryId } from "./mail-connections.ts";

export { vergelijkProjectnummer };

export interface ConnectieKeuze {
  category: ConnectionCategoryId;
  doctype: string;
  name: string;
  label: string;
}

interface Soort {
  category: ConnectionCategoryId;
  doctype: string;
  naamveld: string;
  zoekvelden: string[];
}

const SOORTEN: Soort[] = [
  { category: "project", doctype: "Project", naamveld: "project_name", zoekvelden: ["name", "project_name"] },
  { category: "customer", doctype: "Customer", naamveld: "customer_name", zoekvelden: ["name", "customer_name"] },
  { category: "lead", doctype: "Lead", naamveld: "lead_name", zoekvelden: ["name", "lead_name", "company_name"] },
];

/** Zet ruwe rijen om naar keuzes, projecten op nummer aflopend. */
export function naarKeuzes(soort: Soort, rijen: Record<string, unknown>[]): ConnectieKeuze[] {
  const uit = rijen
    .map((r) => {
      const name = String(r.name ?? "").trim();
      const naam = String(r[soort.naamveld] ?? "").trim();
      return { category: soort.category, doctype: soort.doctype, name, label: toonLabel(soort.doctype, name, naam || name) };
    })
    .filter((k) => k.name);
  if (soort.category === "project") uit.sort((a, b) => vergelijkProjectnummer(a.name, b.name));
  else uit.sort((a, b) => a.label.localeCompare(b.label));
  return uit;
}

/** Projecten, klanten en leads die bij de zoekterm passen. */
export async function zoekConnectieKeuzes(term: string, perSoort = 6): Promise<ConnectieKeuze[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const lijsten = await Promise.all(SOORTEN.map((soort) => fetchList<Record<string, unknown>>(soort.doctype, {
    fields: ["name", soort.naamveld],
    or_filters: soort.zoekvelden.map((v) => [v, "like", like]),
    limit_page_length: perSoort * 3,
  }).then((rijen) => naarKeuzes(soort, rijen).slice(0, perSoort)).catch(() => [] as ConnectieKeuze[])));
  return lijsten.flat();
}
