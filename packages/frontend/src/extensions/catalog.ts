/**
 * Curated catalog of installable remote extensions.
 *
 * Adding an extension here means:
 *  1. It appears in Settings → Extensions as a card with an Install button.
 *  2. One click installs it — no URL paste, no copy/paste mistakes.
 *  3. The catalog IS the allowlist — nothing outside this list is offered
 *     in the primary UI. Power users can still add arbitrary URLs via the
 *     "Advanced / Developer" panel, but that's a conscious opt-in.
 *
 * To add a new extension: append a CatalogEntry below and ship a Y-app
 * release. The `id` is stable — never change it after release, because
 * it's the key that identifies an installed extension in the per-instance
 * `remote-extensions` setting.
 */

export interface CatalogEntry {
  /** Stable, URL-safe ID. Becomes the RemoteExtension.id on install. */
  id: string;
  /** Display name shown in the catalog card, sidebar, and tabs. */
  name: string;
  /** One-paragraph description shown on the catalog card. */
  description: string;
  /** Pinned iframe URL — https only in production. */
  url: string;
  /** Sidebar section title. "" = top-level. */
  sidebarSection: string;
  /** Visibility filter. Default: "all". */
  visibility?: "all" | "employer" | "employee";
  /** Optional author label for the card footer. */
  author?: string;
}

export const CATALOG: CatalogEntry[] = [
  {
    id: "kg-planning",
    name: "KG Planning",
    description:
      "Planning grid with team, Gantt, and table views, plus Financial / Projects / HR dashboards. Built for KG.",
    url: "https://impertio-studio.github.io/Y_App-extension-kg-planning/",
    sidebarSection: "",
    author: "Impertio",
  },
  {
    id: "projectplanning",
    name: "Projectplanning",
    description:
      "Fase-timeline dashboard voor CLT/VL projecten met overgangen tussen fases (Controle vorige + Startinformatie volgende). Compact overzicht + carousel-detail per fase of overgang. Ontwikkeld voor 3BM Engineering.",
    url: "https://piyton.github.io/yapp-ext-3BMEng-projectplanning/",
    sidebarSection: "Taken & Planning",
    author: "3BM Engineering",
  },
];

export function findCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.id === id);
}
