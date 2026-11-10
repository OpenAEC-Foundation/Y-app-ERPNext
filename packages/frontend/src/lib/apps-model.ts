/**
 * Ecosysteem — het model achter de pagina met de apps, zonder netwerk.
 *
 * Een app is een eigen doctype (`Y App`) met een team als kindtabel
 * (`Y App Lid`). De mensen komen uit dezelfde lijst als bij Werkplekken
 * (`Y Werkplek Persoon`), zodat één persoon overal dezelfde is. De taken van
 * een app zijn de taken van het ERP-project dat eraan hangt; zo zit alles aan
 * elkaar: app → project → taken → de persoon die ze heeft → zijn werkplek.
 */
import { AFGERONDE_TAAKSTATUSSEN, alleenDatum, toegewezenAan, type TaakRegel } from "./werkplekken-model.ts";

export const DT_APP = "Y App";
export const DT_APP_LID = "Y App Lid";

/** Dezelfde statussen als op open-aec.com. */
export type AppStatus = "Beschikbaar" | "Beta" | "In ontwikkeling" | "Community";
export const APP_STATUSSEN: AppStatus[] = ["Beschikbaar", "Beta", "In ontwikkeling", "Community"];

export interface AppLid {
  name?: string;
  persoon: string;
  rol: string | null;
}

export interface App {
  name: string;
  naam: string;
  status: AppStatus;
  /** 0 = in het archief: niet in het overzicht, wel met één klik terug te zetten. */
  in_ecosysteem: 0 | 1;
  /** De productmanager is ook de eindverantwoordelijke. */
  productmanager: string | null;
  project: string | null;
  repository: string | null;
  codeowners: string | null;
  beschrijving: string | null;
  volgorde: number;
  team: AppLid[];
}

/** Alle mensen van een app: productmanager en team, zonder dubbelen. */
export function mensenVan(app: Pick<App, "productmanager" | "team">): string[] {
  const alle = [app.productmanager, ...app.team.map((l) => l.persoon)];
  return [...new Set(alle.filter((x): x is string => !!x))];
}

/** De apps waar iemand bij hoort, in welke rol dan ook. */
export function appsVanPersoon(apps: App[], persoon: string): App[] {
  return apps.filter((a) => mensenVan(a).includes(persoon));
}

export interface TakenStand {
  open: number;
  teLaat: number;
  zonderEigenaar: number;
  volgendeDeadline: string | null;
}

/** Hoe de taken van het project van een app ervoor staan, gezien vanaf `vandaag`. */
export function takenStand(taken: TaakRegel[], project: string | null, vandaag: string): TakenStand {
  const open = project ? taken.filter((t) => t.project === project && !AFGERONDE_TAAKSTATUSSEN.includes(t.status)) : [];
  const deadlines = open.map((t) => alleenDatum(t.exp_end_date)).filter((d): d is string => !!d);
  return {
    open: open.length,
    teLaat: deadlines.filter((d) => d < vandaag).length,
    zonderEigenaar: open.filter((t) => toegewezenAan(t).length === 0).length,
    volgendeDeadline: deadlines.filter((d) => d >= vandaag).sort()[0] || null,
  };
}

/** De open taken van een project, de vroegste deadline eerst (zonder deadline achteraan). */
export function takenVanProject(taken: TaakRegel[], project: string | null): TaakRegel[] {
  if (!project) return [];
  return taken
    .filter((t) => t.project === project && !AFGERONDE_TAAKSTATUSSEN.includes(t.status))
    .sort((a, b) => (alleenDatum(a.exp_end_date) || "9999").localeCompare(alleenDatum(b.exp_end_date) || "9999") || a.subject.localeCompare(b.subject));
}

/** "OpenAEC-Foundation/open-pdf-studio" of een volledige URL → de GitHub-link, of null. */
export function githubUrl(repository: string | null | undefined): string | null {
  const r = (repository || "").trim();
  if (!r) return null;
  if (/^https:\/\/github\.com\//.test(r)) return r;
  return /^[\w.-]+\/[\w.-]+$/.test(r) ? `https://github.com/${r}` : null;
}

export function sorteerApps(apps: App[]): App[] {
  return [...apps].sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0) || a.naam.localeCompare(b.naam));
}
