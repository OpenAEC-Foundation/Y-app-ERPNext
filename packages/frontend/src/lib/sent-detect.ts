/**
 * Sent-folder detection helpers, extracted verbatim from pages/Webmail.tsx.
 */
import type { MailFolder } from "./mail-types";

export function isSentParent(parentPath: string): boolean {
  const lower = parentPath.toLowerCase();
  return lower === "sent" || lower === "sent items" || lower.startsWith("sent.") ||
    lower.includes("verzonden") || lower.includes("\\sent");
}

/** True als de folder zelf een Sent-folder is, of een sub-folder daarvan. Kijkt
 * zowel naar het pad (voor naam-heuristiek) als naar specialUse op de folder
 * en alle ancestors in de folder-lijst. */
export function isSentContext(folderPath: string, allFolders: MailFolder[]): boolean {
  if (!folderPath) return false;
  // Directe naam- of specialUse-match op de folder zelf.
  if (isSentParent(folderPath)) return true;
  const self = allFolders.find(f => f.path === folderPath);
  if (self?.specialUse === "\\Sent") return true;
  // Ancestor-match: IMAP-delimiters zijn meestal "." of "/".
  for (const delim of [".", "/"]) {
    const parts = folderPath.split(delim);
    for (let i = parts.length - 1; i > 0; i--) {
      const ancestor = parts.slice(0, i).join(delim);
      const af = allFolders.find(f => f.path === ancestor);
      if (af?.specialUse === "\\Sent") return true;
      if (isSentParent(ancestor)) return true;
    }
  }
  return false;
}
