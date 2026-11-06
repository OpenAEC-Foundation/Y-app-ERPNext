/**
 * Brainstorm — het model achter de pagina, zonder netwerk.
 *
 * Een idee is een eigen doctype van de app (`Y Brainstorm Idee`), met een
 * checklist als kindtabel (`Y Brainstorm Punt`) en labels uit een gedeelde lijst
 * (`Y Brainstorm Label`); de definities staan in
 * `frappe-app/y_next/y_next/doctype/`. Omdat ze gewoon in de ERPNext staan, kan
 * ook een AI-sessie op de eigen pc ze met een API-sleutel ophalen en bijwerken
 * (zie `scripts/brainstorm-skill/`). Het script gebruikt dezelfde namen; wie ze
 * hier hernoemt, breekt de skill.
 *
 * De volgorde in de lijst is de prioriteit. Er is geen aparte status voor iets
 * wat kan wachten: dat sleep je naar onder.
 */

export const DT_IDEE = "Y Brainstorm Idee";
export const DT_PUNT = "Y Brainstorm Punt";
export const DT_LABEL = "Y Brainstorm Label";

export type IdeeStatus = "Open" | "Bezig" | "Klaar";
export const STATUSES: IdeeStatus[] = ["Open", "Bezig", "Klaar"];

/** Eén klik op de status zet hem een stap verder; na Klaar weer open. */
export const NEXT_STATUS: Record<IdeeStatus, IdeeStatus> = { Open: "Bezig", Bezig: "Klaar", Klaar: "Open" };

export interface Punt {
  name?: string;
  tekst: string;
  gedaan: 0 | 1;
}

export interface Idee {
  /** Autoincrement-nummer; dit is ook de code (#12) waarmee je hem in de AI ophaalt. */
  name: string;
  titel: string;
  beschrijving: string | null;
  status: IdeeStatus;
  volgorde: number;
  datum: string | null;
  deadline: string | null;
  /** JSON-lijst met labelnamen. */
  labels: string | null;
  /** Project of repo, vrije tekst of een link. */
  koppeling: string | null;
  resultaat: string | null;
  owner: string;
  modified: string;
  punten?: Punt[];
}

export type LabelGroep = "Soort" | "Kanaal" | "Nodig" | "Prioriteit" | "Programma" | "Overig";
export const LABEL_GROUPS: LabelGroep[] = ["Soort", "Kanaal", "Nodig", "Prioriteit", "Programma", "Overig"];

export interface Label {
  name: string;
  label: string;
  groep: LabelGroep;
}

/** De set waarmee een lege ERPNext begint; daarna beheert iedereen hem zelf. */
export const DEFAULT_LABELS: Record<Exclude<LabelGroep, "Overig">, string[]> = {
  Soort: ["PR", "Video", "Productpagina", "Nieuwsbericht", "Release"],
  Kanaal: ["YouTube", "LinkedIn", "Instagram", "Facebook", "X", "WhatsApp", "Website"],
  Nodig: ["Schermopnames", "Voice-over", "Tekst", "Ontwerp", "Input van iemand"],
  Prioriteit: ["Hoog", "Gemiddeld", "Laag", "Kan wachten"],
  Programma: [
    "Y-app", "Open CAD Studio", "Open PDF Studio", "Open Planner Studio", "Open Calc Studio",
    "Open Infra Studio", "Open Pointcloud Studio", "Open Geotechniek Studio", "Open Pile Plan Studio",
    "Open 3D Viewer Studio", "Open Energy Studio", "Open Heatloss Studio", "Open Structural Calculation Studio",
    "Open Speech Studio", "Open Field Studio", "Open Safety Studio", "Open BIM Studio", "Open Paint Studio",
    "Open FEM Studio", "OpenAEC Office Studio", "Monty IFC Viewer", "Open BIM Validator Studio",
    "Open Books Studio", "BCF Manager Studio", "OpenAEC Installer", "OpenAEC SuperCloud", "IFCX", "IFCCAD",
  ],
};

export function parseLabels(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  } catch {
    // Iemand heeft het veld in de ERPNext met de hand ingevuld: komma's tellen dan als scheiding.
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function serializeLabels(list: string[]): string {
  return JSON.stringify([...new Set(list.map((s) => s.trim()).filter(Boolean))]);
}

/** Open en Bezig op de gesleepte volgorde; Klaar onderaan, laatst afgerond eerst. */
export function sortIdeeen<T extends Pick<Idee, "status" | "volgorde" | "modified" | "name">>(list: T[]): T[] {
  const open = list.filter((i) => i.status !== "Klaar")
    .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0) || Number(a.name) - Number(b.name));
  const klaar = list.filter((i) => i.status === "Klaar")
    .sort((a, b) => (b.modified || "").localeCompare(a.modified || ""));
  return [...open, ...klaar];
}

/**
 * De volgorde-waarde voor een idee dat van plek `from` naar plek `to` gaat in
 * de lijst `ordered` (alleen open ideeën, al gesorteerd). Er verandert maar één
 * document: het verplaatste idee krijgt een waarde tussen zijn nieuwe buren.
 */
export function volgordeNaVerplaatsing(ordered: Pick<Idee, "volgorde">[], from: number, to: number): number {
  const rest = ordered.filter((_, i) => i !== from);
  const before = to > 0 ? rest[to - 1]?.volgorde : undefined;
  const after = rest[to]?.volgorde;
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return (after as number) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

/** Een nieuw idee komt onderaan de open ideeën; slepen zet het hoger. */
export function volgordeVoorNieuw(list: Pick<Idee, "status" | "volgorde">[]): number {
  const open = list.filter((i) => i.status !== "Klaar").map((i) => i.volgorde ?? 0);
  return open.length ? Math.max(...open) + 1 : 1;
}

export type DeadlineStand = "verlopen" | "binnenkort" | "later";

/** `today` als YYYY-MM-DD; binnenkort = binnen zeven dagen. Een afgerond idee heeft geen stand. */
export function deadlineStand(deadline: string | null, status: IdeeStatus, today: string): DeadlineStand | null {
  if (!deadline || status === "Klaar") return null;
  const days = (Date.parse(deadline) - Date.parse(today)) / 864e5;
  if (days < 0) return "verlopen";
  if (days <= 7) return "binnenkort";
  return "later";
}

export function ideeCode(name: string): string {
  return `#${name}`;
}

/** Het idee als platte tekst, om zelf in een AI te plakken. */
export function ideeAlsTekst(idee: Idee, punten: Punt[]): string {
  const lines = [`Brainstorm ${ideeCode(idee.name)}: ${idee.titel}`];
  const labels = parseLabels(idee.labels);
  if (labels.length) lines.push(`Labels: ${labels.join(", ")}`);
  if (idee.koppeling) lines.push(`Project of repo: ${idee.koppeling}`);
  if (idee.datum) lines.push(`Datum: ${idee.datum}`);
  if (idee.deadline) lines.push(`Deadline: ${idee.deadline}`);
  lines.push(`Status: ${idee.status}`);
  if (idee.beschrijving) lines.push("", "Beschrijving:", idee.beschrijving);
  if (punten.length) {
    lines.push("", "Wat erin moet:");
    for (const p of punten) lines.push(`- [${p.gedaan ? "x" : " "}] ${p.tekst}`);
  }
  if (idee.resultaat) lines.push("", `Resultaat: ${idee.resultaat}`);
  return lines.join("\n");
}
