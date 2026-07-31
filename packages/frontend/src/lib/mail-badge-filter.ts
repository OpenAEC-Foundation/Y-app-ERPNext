/**
 * Bepaalt welke IMAP-mappen meetellen voor de "Email"-badge / mail-notificatie.
 * Sluit Sent/Drafts/Trash/Junk/Archive uit zodat alleen de INBOX-tree telt —
 * exact zoals de sidebar-badge in Webmail.
 *
 * Gedeeld tussen de web-poll (BackgroundSyncProvider) en de desktop-poll
 * (packages/desktop) zodat beide identiek tellen (geen divergente copie).
 */
import type { UnseenFolderShape } from "./api-shapes";

/** Alias op het gedeelde wire-contract (api-shapes.ts) — één bron. */
export type UnseenFolder = UnseenFolderShape;

export function shouldCountForBadge(folder: { path: string }): boolean {
  const lower = (folder.path.split(/[/.]/).pop() || folder.path).toLowerCase().trim();
  const excludedNames = new Set([
    "sent", "verzonden", "verzonden items", "verzon items",
    "drafts", "draft", "concepten", "concept",
    "trash", "prullenbak", "prullen", "deleted", "deleted items",
    "verwijderd", "verwijderde items", "verwijderde objecten",
    "junk", "junk-email", "junk e-mail",
    "spam", "ongewenst", "ongewenste e-mail",
    "archive", "archief",
  ]);
  if (excludedNames.has(lower)) return false;
  return (
    folder.path === "INBOX"
    || folder.path.toUpperCase() === "INBOX"
    || folder.path.startsWith("INBOX/")
    || folder.path.startsWith("INBOX.")
  );
}

/** Som van ongelezen berichten over alle INBOX-tree-mappen. */
export function sumInboxUnseen(folders: UnseenFolder[]): number {
  return folders.filter(shouldCountForBadge).reduce((s, f) => s + (f.unseen || 0), 0);
}
