/**
 * De ERPNext-kant van de projectsuggestie: projecten ophalen, de historie van
 * een afzender opzoeken, en de mail koppelen.
 *
 * `project-suggest.ts` blijft puur en weet niets van het netwerk; deze module
 * levert er de feiten voor aan. Het koppelen loopt via
 * `linkCommunicationTo` — dezelfde weg als de inkoopfactuur en de lead, dus
 * `reference_*` **én** een `timeline_links`-rij, zodat de mail in de
 * projecttijdlijn verschijnt en dáár blijft staan ook als de mail later aan
 * iets anders gekoppeld wordt.
 */

import { fetchList } from "./erpnext.ts";
import { linkCommunicationTo } from "./communication-link.ts";
import type { ProjectHint } from "./project-suggest.ts";

interface ProjectRow {
  name: string;
  project_name?: string;
  customer?: string;
}

let projectCache: { at: number; hints: ProjectHint[] } | null = null;
const TTL_MS = 10 * 60_000;

/**
 * Alle projecten in de vorm die de suggestie nodig heeft. Alleen de drie
 * velden die meewegen — de volledige `Project`-lijst is op deze instance
 * bijna honderd rijen breed en de webmail heeft er niets aan.
 */
export async function fetchProjectHints(force = false): Promise<ProjectHint[]> {
  if (!force && projectCache && Date.now() - projectCache.at < TTL_MS) return projectCache.hints;
  const rows = await fetchList<ProjectRow>("Project", {
    fields: ["name", "project_name", "customer"],
    limit_page_length: 0,
    order_by: "name asc",
  });
  const hints = rows.map((r) => {
    const hint: ProjectHint = { name: r.name, projectName: r.project_name || r.name };
    if (r.customer) hint.customer = r.customer;
    return hint;
  });
  projectCache = { at: Date.now(), hints };
  return hints;
}

export function resetProjectHintCache(): void {
  projectCache = null;
}

/* ─────────────────────── Historie van de afzender ────────────────────── */

const historyCache = new Map<string, { at: number; projects: string[] }>();
const HISTORY_TTL_MS = 5 * 60_000;

/**
 * Projecten waaraan eerdere mails van dit adres gekoppeld zijn.
 *
 * Dit is het signaal met de beste prijs-kwaliteitverhouding: één gefilterde
 * query per afzender, en het resultaat is een keuze die een mens ooit zelf
 * gemaakt heeft. De cache per adres houdt het bij één call per afzender per
 * vijf minuten — zonder die rem zou elke klik in de berichtenlijst een query
 * afvuren.
 *
 * Faalt de query (geen leesrecht op Communication-filters), dan is er simpelweg
 * geen historie-signaal; de andere drie blijven werken.
 */
export async function fetchSenderProjectHistory(sender: string): Promise<string[]> {
  const address = (sender || "").trim().toLowerCase();
  if (!address) return [];
  const cached = historyCache.get(address);
  if (cached && Date.now() - cached.at < HISTORY_TTL_MS) return cached.projects;

  let projects: string[] = [];
  try {
    const rows = await fetchList<{ reference_name?: string }>("Communication", {
      fields: ["reference_name"],
      filters: [
        ["sender", "=", address],
        ["reference_doctype", "=", "Project"],
      ],
      limit_page_length: 50,
      order_by: "communication_date desc",
    });
    projects = [...new Set(rows.map((r) => (r.reference_name || "").trim()).filter(Boolean))];
  } catch {
    // Geen historie-signaal; zie de toelichting hierboven.
  }
  historyCache.set(address, { at: Date.now(), projects });
  return projects;
}

/** Vergeet de historie van dit adres (na een nieuwe koppeling). */
export function forgetSenderProjectHistory(sender: string): void {
  historyCache.delete((sender || "").trim().toLowerCase());
}

/* ───────────────────────────── Koppelen ──────────────────────────────── */

/**
 * Koppel de mail aan een project. Dunne wikkel om `linkCommunicationTo`, zodat
 * de aanroepplekken niet hoeven te weten dat er twee schrijfacties onder
 * zitten — en zodat de afzender-historie meteen vers is voor de volgende mail.
 */
export async function linkMailToProject(
  communication: string,
  project: string,
  sender?: string,
): Promise<void> {
  await linkCommunicationTo(communication, "Project", project);
  if (sender) forgetSenderProjectHistory(sender);
}
