/**
 * Sidebar mail-badge inclusion rule, extracted verbatim from pages/Webmail.tsx.
 */
import type { MailFolder } from "./mail-types";

// Sidebar mail-badge counts unseen in INBOX (+ submappen) only.
// Sent, Drafts, Trash, Junk/Spam en Archive worden uitgesloten.
export const BADGE_EXCLUDED_SPECIAL_USE = new Set([
  "\\Sent", "\\Drafts", "\\Trash", "\\Junk", "\\Archive",
]);
// Exact-match (niet prefix) zodat "Archief-2024" niet ten onrechte uitvalt.
export const BADGE_EXCLUDED_NAMES = new Set([
  "sent", "verzonden", "verzonden items", "verzon items",
  "drafts", "draft", "concepten", "concept",
  "trash", "prullenbak", "prullen", "deleted", "deleted items",
  "verwijderd", "verwijderde items", "verwijderde objecten",
  "junk", "junk-email", "junk e-mail",
  "spam", "ongewenst", "ongewenste e-mail",
  "archive", "archief",
]);

export function shouldCountForBadge(f: MailFolder): boolean {
  if (f.specialUse && BADGE_EXCLUDED_SPECIAL_USE.has(f.specialUse)) return false;
  // Naam-fallback voor IMAP-servers zonder SPECIAL-USE flags
  const leaf = (f.path.split(/[/.]/).pop() || f.path).toLowerCase().trim();
  if (BADGE_EXCLUDED_NAMES.has(leaf)) return false;
  // Alleen INBOX zelf telt mee voor de Email-sidebar-badge. Submappen
  // worden bewust NIET meegeteld zodat Email-badge gelijk is aan de
  // INBOX-folder-badge in de mail-folder-tree. Zonder dit zag Piet
  // discrepanties (bv. Email=7, INBOX=4) doordat 3 ongelezen mails in
  // INBOX-archief-subfolders zaten — niet wat de gebruiker als "nieuwe
  // mail-alerts" wil zien.
  return f.path === "INBOX" || f.path.toUpperCase() === "INBOX";
}
