/**
 * Messenger pre-fetch state.
 *
 * Lives in `lib/` (not `pages/Messenger.tsx`) so App.tsx can call
 * prefetchConversations() at startup WITHOUT statically importing the
 * Messenger page module. A static import from App.tsx into Messenger.tsx
 * would defeat the lazy-loading and pull the entire Messenger module
 * (~900 lines + lucide icons) into the main bundle.
 *
 * The cache (`convoCache`) is module-level state and shared between this
 * file and Messenger.tsx by import. Both write to and read from the same
 * Map instance, so a prefetch warms the cache that the Messenger page
 * later reads from on mount.
 */

import { setBadgeCount } from "./badges";
import { getActiveInstanceId } from "./instances";

export const API_BASE = "";

export interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  /** Raw NC id of the newest message — used by the client read-overlay. */
  lastMessageId?: number;
  unreadCount: number;
  participants: number;
  type: string;
  platform: string;
  pinned?: boolean;
}

/**
 * Per-instance conversation cache.
 *
 * Earlier this was a single shared `{ data, ts }` object — meaning whatever
 * conversations were loaded on instance A would surface on instance B as soon
 * as the user opened Messenger there (the cache TTL hadn't expired). That was
 * the "Bij Impertio bij berichten zie ik berichten van 3BM" leak.
 *
 * Now keyed by instance id: each tab has its own slot. Callers MUST go
 * through `getConvoCache()` / `setConvoCache()` instead of accessing module
 * state directly — that's what enforces the isolation.
 */
const convoCacheByInstance = new Map<string, { data: Conversation[]; ts: number }>();
export const CONVO_CACHE_TTL = 30_000;

export function getConvoCache(instanceId: string = getActiveInstanceId()): { data: Conversation[] | null; ts: number } {
  const entry = convoCacheByInstance.get(instanceId);
  if (!entry) return { data: null, ts: 0 };
  return { data: entry.data, ts: entry.ts };
}

export function setConvoCache(data: Conversation[], instanceId: string = getActiveInstanceId()): void {
  convoCacheByInstance.set(instanceId, { data, ts: Date.now() });
}

export function clearConvoCache(instanceId?: string): void {
  if (instanceId) convoCacheByInstance.delete(instanceId);
  else convoCacheByInstance.clear();
}

let _prefetchingConvos = false;

/**
 * Pre-fetch conversations for the active instance so they're ready when the
 * user opens Messenger. Called from App.tsx on mount. Safe to call multiple
 * times — only fetches once per CONVO_CACHE_TTL window per instance.
 */
export async function prefetchConversations(): Promise<void> {
  const instanceId = getActiveInstanceId();
  const existing = convoCacheByInstance.get(instanceId);
  if (_prefetchingConvos || (existing && Date.now() - existing.ts < CONVO_CACHE_TTL)) return;
  _prefetchingConvos = true;

  try {
    // Load backend service credentials. Note: /api/services returns
    // server-wide env-var credentials (NEXTCLOUD_URL etc.) — those leak
    // across instances. Per-instance prefs in localStorage take precedence
    // over them downstream; here we only use them as a last-resort fallback
    // for legacy single-instance deploys.
    const svcRes = await fetch(`${API_BASE}/api/services`, { credentials: "same-origin" });
    if (!svcRes.ok) return;
    const svcJson = await svcRes.json().catch(() => null);
    if (!svcJson) return;
    const services = svcJson.data || {};

    // Wave 0a: NC creds zitten in server-side cache via WS subscribe-messenger
    // (gestuurd door BackgroundSyncProvider bij ws.onopen). Geen url/user/pass
    // meer in deze prefetch-URL — server resolveert via cache. Wel: check of
    // er creds zijn geconfigureerd; zonder configuratie heeft prefetch geen zin.
    const params = new URLSearchParams();
    const hasNc = !!(
      (localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_url`) || localStorage.getItem(`pref_${instanceId}_nextcloud_url`) || services.nextcloud?.url)
      && (localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_user`) || localStorage.getItem(`pref_${instanceId}_nextcloud_user`) || services.nextcloud?.user)
      && (localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_pass`) || localStorage.getItem(`pref_${instanceId}_nextcloud_pass`) || services.nextcloud?.pass)
    );
    const tgToken = localStorage.getItem(`pref_${instanceId}_messenger_telegram_token`) || services.telegram?.token;
    if (tgToken) params.set("token", tgToken);

    if (hasNc || tgToken) {
      console.log(`[Messenger:prefetch] Pre-fetching conversations for instance=${instanceId}...`);
      const resp = await fetch(`${API_BASE}/api/messenger/all-conversations?${params.toString()}`);
      if (!resp.ok) return;
      const json = await resp.json().catch(() => null);
      if (!json) return;
      if (json.data) {
        // Re-check the active instance — if the user switched tabs while we
        // were fetching, don't poison the new tab's cache with the old
        // tab's conversations.
        const currentInstance = getActiveInstanceId();
        if (currentInstance !== instanceId) {
          console.warn(`[Messenger:prefetch] Instance changed during fetch (${instanceId} → ${currentInstance}); discarding result`);
          return;
        }
        convoCacheByInstance.set(instanceId, { data: json.data, ts: Date.now() });
        // B04: Persist conversations to localStorage so a page reload renders
        // them immediately (stale-while-revalidate) before the network call.
        try {
          localStorage.setItem(`messenger_convos_${instanceId}`, JSON.stringify({ data: json.data, ts: Date.now() }));
        } catch { /* quota exceeded, ignore */ }
        // Set sidebar badge with total unread
        const totalUnread = (json.data as { unreadCount: number }[]).reduce((s: number, c: { unreadCount: number }) => s + (c.unreadCount || 0), 0);
        setBadgeCount("messenger", totalUnread);
        console.log(`[Messenger:prefetch] Cached ${json.data.length} conversations for ${instanceId}, ${totalUnread} unread`);
      }
    }
  } catch (err) {
    console.warn("[Messenger:prefetch] Failed:", err);
  } finally {
    _prefetchingConvos = false;
  }
}
