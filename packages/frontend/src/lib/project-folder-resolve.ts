/**
 * Resolvet een voorgesteld project + mail-kant (inbox/sent) naar een
 * BESTAANDE projectmap aan die kant. Levert `null` als er nog geen map is
 * (→ de UI biedt dan "map aanmaken" aan).
 *
 * `isSentContext` wordt geïnjecteerd zodat deze lib niet uit `pages/` hoeft te
 * importeren (dezelfde detector die Webmail overal gebruikt).
 */

import type { ProjectRecord } from "./DataContext";
import { matchProjectFromFolder } from "./project-folder-match";

export type MailSide = "inbox" | "sent";

export interface FolderLike {
  path: string;
  name: string;
  specialUse: string | null;
}

/** Root/special mappen zijn nooit een projectmap (INBOX, Sent, Trash, …). */
function isRootSpecial(f: FolderLike): boolean {
  if (f.specialUse) return true;
  return f.path.trim().toUpperCase() === "INBOX";
}

function depth(path: string): number {
  return (path.match(/[./]/g) || []).length;
}

export function resolveProjectFolder<F extends FolderLike>(
  project: ProjectRecord,
  side: MailSide,
  folders: F[],
  isSentContext: (folderPath: string, folders: F[]) => boolean,
): { path: string; ambiguous: boolean; candidates: string[] } | null {
  const candidates: string[] = [];
  for (const f of folders) {
    if (isRootSpecial(f)) continue;
    const folderSide: MailSide = isSentContext(f.path, folders) ? "sent" : "inbox";
    if (folderSide !== side) continue;
    // Hervalideer via de bestaande ≥2-token-match dat déze map echt bij dit
    // project hoort (op de leaf-naam, die het [IN]/[OUT]-prefix + nr + naam bevat).
    if (matchProjectFromFolder(f.name, [project])) candidates.push(f.path);
  }
  if (candidates.length === 0) return null;
  const deepest = candidates.reduce((a, b) => (depth(b) > depth(a) ? b : a));
  return { path: deepest, ambiguous: candidates.length > 1, candidates };
}
