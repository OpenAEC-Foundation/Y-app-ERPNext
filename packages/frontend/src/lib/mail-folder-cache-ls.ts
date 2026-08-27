/**
 * Per-folder localStorage message-list cache (LS variant), extracted verbatim
 * from pages/Webmail.tsx. Distinct from the IndexedDB variants in mail-cache-db;
 * these are the plain-localStorage helpers used as a dual-write / fallback.
 */
import type { MailMessage } from "./webmail-prefetch";

/* ─── Per-folder localStorage cache (stale-while-revalidate) ───
 *
 * Was eerst alleen INBOX. Met 133 folders bij ervaren gebruikers (top-level
 * + sub-INBOX project-archief) voelde elke folder-switch op een verse
 * browser-refresh "leeg" voor ~500 ms-2 s tot de server-fetch terug was.
 * Nu cachen we elke folder die de gebruiker opent (max 100 mail-headers,
 * ~32 KB per folder, ~323 bytes per mail). LRU-cap op 50 folders houdt
 * het worst-case-totaal onder 1.6 MB (Chrome localStorage-quota is 5-10
 * MB per origin, dus ruim binnen). LRU-volgorde wordt bijgehouden in een
 * aparte index-key per (instance, acct). Oudst-geopende folder valt eruit
 * wanneer #51 erbij komt.
 *
 * Bestaande `webmail_inbox_cache_*` keys uit de eerdere INBOX-only variant
 * worden niet meer beschreven of gelezen; oude entries blijven hangen in
 * localStorage tot het quota tegen aan komt (niet kritiek bij <60 KB).
 */
export const MAIL_FOLDER_CACHE_MAX = 50;
function _mailFolderCacheKey(instanceId: string, acct: string, folder: string): string {
  return `webmail_msglist_cache_${instanceId}_${acct || ""}_${folder}`;
}
function _mailFolderIndexKey(instanceId: string, acct: string): string {
  return `webmail_msglist_index_${instanceId}_${acct || ""}`;
}
export function readMailFolderCache(
  instanceId: string,
  acct: string,
  folder: string,
): { messages: MailMessage[]; total: number; ts: number } | null {
  try {
    const raw = localStorage.getItem(_mailFolderCacheKey(instanceId, acct, folder));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function persistMailFolderCache(
  instanceId: string,
  acct: string,
  folder: string,
  messages: MailMessage[],
  total: number,
): void {
  try {
    const key = _mailFolderCacheKey(instanceId, acct, folder);
    localStorage.setItem(
      key,
      JSON.stringify({ messages: messages.slice(0, 100), total, ts: Date.now() }),
    );
    // LRU-index updaten zodat oudste folder geëvict wordt bij overflow.
    const indexKey = _mailFolderIndexKey(instanceId, acct);
    let index: string[] = [];
    try {
      index = JSON.parse(localStorage.getItem(indexKey) || "[]");
      if (!Array.isArray(index)) index = [];
    } catch {
      index = [];
    }
    // Verwijder bestaande positie (zo komt de folder vooraan/achteraan).
    index = index.filter((f) => f !== folder);
    index.push(folder); // most-recent at end
    while (index.length > MAIL_FOLDER_CACHE_MAX) {
      const evict = index.shift();
      if (evict) {
        try {
          localStorage.removeItem(_mailFolderCacheKey(instanceId, acct, evict));
        } catch {
          /* ignore */
        }
      }
    }
    localStorage.setItem(indexKey, JSON.stringify(index));
  } catch {
    /* quota of andere storage-fout — niet kritiek, in-memory cache vangt het op */
  }
}
