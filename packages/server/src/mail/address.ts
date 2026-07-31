/**
 * Mail address parsing — pure helpers extracted from mail.ts.
 *
 * Deliberately lenient (unanchored) so a malformed From/To still yields the
 * bracketed address where possible. Distinct from the CalDAV `parseCalAddress`
 * (anchored), which is intentionally kept separate.
 */

/** Extract the bare email address from a "Name <email>" or plain-email string. */
export function extractEmailAddress(addr: string): string {
  const m = /<([^>]+)>/.exec(addr || "");
  return (m ? m[1] : addr || "").trim();
}

/** Extract the display name from a "Name <email>" string, if present. */
export function extractDisplayName(addr: string): string | undefined {
  const m = /^\s*"?([^"<]+?)"?\s*</.exec(addr || "");
  const name = m?.[1]?.trim();
  return name || undefined;
}
