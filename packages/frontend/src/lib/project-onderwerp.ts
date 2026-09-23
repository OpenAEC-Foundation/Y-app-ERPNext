/**
 * Een project in de onderwerpregel van een mail: "<nummer> <projectnaam>".
 *
 * Twee manieren, de gebruiker kiest: het project vóór het bestaande onderwerp
 * zetten ("voor"), of het onderwerp er helemaal door vervangen ("vervang").
 */

export type ProjectOnderwerpModus = "voor" | "vervang";

/** Nummer en naam. Staat het nummer al vooraan in de naam, dan niet twee keer. */
export function projectLabel(p: { name: string; project_name?: string | null }): string {
  const nummer = String(p.name || "").trim();
  let naam = String(p.project_name || "").trim();
  if (nummer) {
    const vooraan = new RegExp(`^\\(?${nummer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)?(?![\\w.])\\s*[-–:]?\\s*`);
    naam = naam.replace(vooraan, "").trim();
  }
  return [nummer, naam].filter(Boolean).join(" ");
}

export function onderwerpMetProject(
  huidig: string,
  p: { name: string; project_name?: string | null },
  modus: ProjectOnderwerpModus,
): string {
  const label = projectLabel(p);
  const rest = huidig.trim();
  if (modus === "vervang" || !rest) return label;
  if (rest.startsWith(label)) return rest;
  return `${label} ${rest}`;
}
