/**
 * NextCloud Talk long-poll manager.
 *
 * Per (yAppSid, instanceId, conversation) tuple draait er één lange HTTP-call
 * naar NC Talk met `lookIntoFuture=1`. Bij ontvangst van nieuwe berichten
 * pushen we een `messenger-changed` event naar de browser via ws-events.
 *
 * Wanneer er geen browser-clients meer op deze conversatie subscriben (zie
 * ws-events.unsubscribeConversation), wordt de long-poll stilgezet.
 *
 * Vermindert verkeer van "elke 20s polling op /api/messenger/conversations"
 * naar "1 connection per actieve conversatie die meestal idle is, response
 * binnen 1s bij nieuw bericht".
 */
import { broadcast, getActiveConversations } from "./ws-events.ts";

interface LoopState {
  abort: AbortController;
  conversation: string;
  yAppSid: string;
  instanceId: number;
}

const loops = new Map<string, LoopState>();

function loopKey(yAppSid: string, instanceId: number, conversation: string): string {
  return `${yAppSid}::${instanceId}::${conversation}`;
}

interface NcCreds {
  url: string;
  user: string;
  pass: string;
}

/**
 * Start of houd een long-poll-loop in stand voor een specifieke conversatie.
 * Idempotent: als er al een loop draait wordt deze niet opnieuw gestart.
 */
export function ensureLongPoll(
  yAppSid: string,
  instanceId: number,
  conversation: string,
  creds: NcCreds,
): void {
  const key = loopKey(yAppSid, instanceId, conversation);
  if (loops.has(key)) return;

  const abort = new AbortController();
  const state: LoopState = { abort, conversation, yAppSid, instanceId };
  loops.set(key, state);

  void runLoop(state, creds).catch((err) => {
    console.warn(`[nc-longpoll] loop crashed for ${conversation}: ${(err as Error).message}`);
  }).finally(() => {
    loops.delete(key);
  });
}

async function runLoop(state: LoopState, creds: NcCreds): Promise<void> {
  let lastKnownMessageId = 0;
  // Pak eerst de laatste messageId zodat we niet de hele geschiedenis als
  // "nieuw" zien. lookIntoFuture vereist een startpunt.
  try {
    const initUrl = `${creds.url.replace(/\/$/, "")}/ocs/v2.php/apps/spreed/api/v1/chat/${encodeURIComponent(state.conversation)}?lookIntoFuture=0&limit=1&includeLastKnown=1`;
    const initRes = await ncFetch(initUrl, creds);
    const initData = await initRes.json() as any;
    const msgs = initData?.ocs?.data || [];
    if (msgs.length > 0) lastKnownMessageId = msgs[0].id || 0;
  } catch {
    /* fall through with 0 */
  }

  // Minimum-interval tussen iteratie-starts. De long-poll hoort ~30s te
  // blokkeren (timeout=30) en pas terug te keren bij een nieuw bericht. Maar
  // als NC/het reverse-proxy-pad instant antwoordt (304 zonder te wachten,
  // lege 200, of structureel 502 — zie hieronder), zou de loop op volle
  // snelheid spinnen: een request-storm richting NC Talk én een broadcast-
  // storm die de browser per event `all-conversations` laat pollen. Deze rem
  // garandeert max ~1 iteratie/2s; bij echte berichten blijft de latency
  // ~1-2s (NC keert binnen ~1s terug, dan vrijwel direct opnieuw).
  const MIN_ITER_MS = 2000;
  let lastIterStart = 0;

  while (!state.abort.signal.aborted) {
    const sinceStart = Date.now() - lastIterStart;
    if (sinceStart < MIN_ITER_MS) {
      await new Promise((r) => setTimeout(r, MIN_ITER_MS - sinceStart));
      if (state.abort.signal.aborted) break;
    }
    lastIterStart = Date.now();

    // Stop als niemand meer subscribed is op deze conversatie.
    const active = getActiveConversations(state.yAppSid, state.instanceId);
    if (!active.has(state.conversation)) break;

    try {
      const url = `${creds.url.replace(/\/$/, "")}/ocs/v2.php/apps/spreed/api/v1/chat/${encodeURIComponent(state.conversation)}?lookIntoFuture=1&timeout=30&lastKnownMessageId=${lastKnownMessageId}`;
      const res = await ncFetch(url, creds, state.abort.signal);

      // 304 No Content = timeout zonder bericht. Direct opnieuw.
      if (res.status === 304 || res.status === 204) continue;
      if (!res.ok) {
        // Wave 0c diagnostics — productie ziet structureel 502 Bad Gateway op
        // dit endpoint. Log status + body-snippet zodat we kunnen onderscheiden:
        //   - NC zelf retourneert error (server down / auth weg)
        //   - Onze reverse-proxy / Cloudflare kapt 30s long-poll af
        //   - Throttling / rate-limit
        let bodySnippet = "";
        try {
          const text = await res.text();
          bodySnippet = text.slice(0, 200).replace(/\s+/g, " ");
        } catch { /* ignore */ }
        console.warn(`[nc-longpoll] ${state.conversation} → ${res.status} ${res.statusText} url=${url.slice(0, 100)} body="${bodySnippet}"`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      const data = await res.json() as any;
      const messages = data?.ocs?.data || [];
      const newestId = messages.length > 0 ? (messages[messages.length - 1]?.id || 0) : 0;
      // Alleen broadcasten als er echt een nieuwer bericht is. NC kan bij een
      // timeout/echo hetzelfde laatste bericht teruggeven; zonder deze check
      // zou dat een fantoom-`messenger-changed` per iteratie geven (en dus een
      // overbodige `all-conversations`-poll in de browser).
      if (newestId > lastKnownMessageId) {
        lastKnownMessageId = newestId;
        broadcast(state.yAppSid, state.instanceId, {
          type: "messenger-changed",
          conversation: state.conversation,
          instance: state.instanceId,
          newestId: lastKnownMessageId,
        });
      }
    } catch (err) {
      if (state.abort.signal.aborted) break;
      console.warn(`[nc-longpoll] fetch error for ${state.conversation}: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function ncFetch(url: string, creds: NcCreds, signal?: AbortSignal): Promise<Response> {
  const auth = Buffer.from(`${creds.user}:${creds.pass}`).toString("base64");
  return fetch(url, {
    headers: {
      "Authorization": `Basic ${auth}`,
      "OCS-APIRequest": "true",
      "Accept": "application/json",
    },
    signal,
  });
}

/** Stop alle loops voor een specifieke client wanneer de WS sluit. */
export function stopLoopsForSession(yAppSid: string, instanceId: number): void {
  for (const [key, state] of loops) {
    if (state.yAppSid === yAppSid && state.instanceId === instanceId) {
      state.abort.abort();
      loops.delete(key);
    }
  }
}
