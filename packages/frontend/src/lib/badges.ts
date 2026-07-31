/**
 * Global badge count system for sidebar navigation items.
 * Pages can set badge counts, and the Sidebar listens for changes.
 */

const badgeCounts = new Map<string, number>();

/** Set a badge count for a page id. Pass 0 to clear. */
export function setBadgeCount(pageId: string, count: number) {
  if (count <= 0) {
    badgeCounts.delete(pageId);
  } else {
    badgeCounts.set(pageId, count);
  }
  window.dispatchEvent(new CustomEvent("badge-counts-changed"));
}

/** Get the current badge count for a page id (0 if none). */
export function getBadgeCount(pageId: string): number {
  return badgeCounts.get(pageId) || 0;
}

/** Get all badge counts as a plain object. */
export function getAllBadgeCounts(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of badgeCounts) result[k] = v;
  return result;
}
