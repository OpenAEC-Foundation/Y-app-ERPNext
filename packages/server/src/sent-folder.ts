/**
 * Bepaalt de "Verzonden items"-map voor de IMAP-APPEND na het versturen.
 *
 * Volgorde:
 *   1. expliciete override (gebruiker koos zijn Verzonden-map) als die bestaat;
 *   2. RFC 6154 SPECIAL-USE `\Sent`;
 *   3. naam-match op de leaf: /^(sent|verzonden)/.
 *
 * De override is load-bearing: sommige mailservers (bv. Stalwart) hebben
 * zowel een `\Sent`-gevlagde "Sent" als een gelokaliseerde "Verzonden items"
 * die de gebruiker (en Outlook) feitelijk gebruikt. Zonder override zou de
 * APPEND in de verkeerde map landen en lijkt verzonden mail "verdwenen".
 */

export interface SentFolderLike {
  path: string;
  delimiter?: string;
  specialUse?: string | null;
}

export function resolveSentFolder<T extends SentFolderLike>(
  folders: T[],
  override?: string,
): T | null {
  if (override) {
    const exact = folders.find((f) => f.path === override);
    if (exact) return exact;
    // Stale/onbekende override → val terug op auto-detectie.
  }

  const byFlag = folders.find((f) => f.specialUse === "\\Sent");
  if (byFlag) return byFlag;

  return (
    folders.find((f) => {
      const leaf = (f.path.split(f.delimiter || "/").pop() || f.path).toLowerCase();
      return /^(sent|verzonden)/.test(leaf);
    }) ?? null
  );
}
