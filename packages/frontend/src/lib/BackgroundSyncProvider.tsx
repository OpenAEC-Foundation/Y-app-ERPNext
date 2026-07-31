/**
 * §14 BackgroundSyncProvider — globale poll-laag voor mail + messenger.
 *
 * Wordt gemount in App.tsx rond de Webmail/Messenger routes zodat mail en
 * berichten in de achtergrond binnenkomen ongeacht welke pagina open is.
 *
 * Twee onafhankelijke poll-loops, beide visibility-aware (focus-based):
 *  - Mail: `/api/mail/unseen-summary` — lichtgewicht (~200 bytes), update
 *    sidebar-badge "webmail".
 *  - Messenger: `/api/messenger/conversations` — geeft per conversatie de
 *    `unreadCount`. Som updated sidebar-badge "messenger".
 *
 * Resource-budget:
 *  - Focused tab: mail 60s, messenger 20s → ~10 KB/min
 *  - Blurred tab: mail 5 min, messenger 90s → ~2 KB/min
 *  - Hidden tab: mail 15 min, messenger 5 min → ~0.3 KB/min
 *  - Memory: 2 useRef voor timers. Negligible.
 *
 * Echte long-poll (NC Talk `lookIntoFuture=1`) zou data nog goedkoper maken
 * maar werkt per-conversatie, niet voor de hele lijst. Voor multi-conversation
 * badge-updates is short-polling de pragmatische keuze.
 */
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { setBadgeCount } from "./badges";
import { getActiveInstanceId } from "./instances";
import { requestNotifyPermissionOnce, showWebNotification } from "./notify";
import { setAppIconBadge } from "./app-badge";
import { sumInboxUnseen } from "./mail-badge-filter";
import i18n from "../i18n/index";

interface NcCreds {
  url: string;
  user: string;
  pass: string;
}

interface BackgroundSyncContextValue {
  /** Subscribe op een NC Talk-conversatie zodat de server long-poll start
   *  en messenger-changed events terug pusht via /ws/events. */
  subscribeConversation: (conversation: string, creds: NcCreds) => void;
  unsubscribeConversation: (conversation: string) => void;
}

const BackgroundSyncContext = createContext<BackgroundSyncContextValue>({
  subscribeConversation: () => { /* no-op default */ },
  unsubscribeConversation: () => { /* no-op default */ },
});

export function useBackgroundSync(): BackgroundSyncContextValue {
  return useContext(BackgroundSyncContext);
}

// Mail-intervallen — IMAP STATUS per folder is duurder, dus minder frequent.
const MAIL_INTERVAL_FOCUSED_MS = 60_000;
const MAIL_INTERVAL_BLURRED_MS = 5 * 60_000;
const MAIL_INTERVAL_HIDDEN_MS = 15 * 60_000;

// Messenger-intervallen — conversation-list is lichtgewicht, mag vaker.
const MSG_INTERVAL_FOCUSED_MS = 20_000;
const MSG_INTERVAL_BLURRED_MS = 90_000;
const MSG_INTERVAL_HIDDEN_MS = 5 * 60_000;

function visibilityTier(): "focused" | "blurred" | "hidden" {
  if (typeof document === "undefined") return "focused";
  if (document.visibilityState === "hidden") return "hidden";
  if (!document.hasFocus()) return "blurred";
  return "focused";
}

function getMailInterval(pushActive: boolean): number {
  // Wanneer IMAP IDLE pushed via WS, hoeven we alleen een trage sanity-poll
  // te doen voor het geval de WS-verbinding stiekem dood is. 5 min = ruim
  // genoeg voor heartbeat-detection, < 1% bandwidth van actieve polling.
  if (pushActive) return 5 * 60_000;
  const t = visibilityTier();
  return t === "hidden" ? MAIL_INTERVAL_HIDDEN_MS
    : t === "blurred" ? MAIL_INTERVAL_BLURRED_MS
    : MAIL_INTERVAL_FOCUSED_MS;
}

function getMessengerInterval(pushActive: boolean): number {
  // NC Talk biedt geen subscribe-all-rooms push (geen External Signaling
  // Server). Inactieve conversaties zien dus geen WS-event en de sidebar-
  // badge hangt op deze poll. Piet meldde 51 s wachten op een nieuw
  // Talk-bericht — dat was exact één 60-s tick.
  //
  // Verlaagd naar 10 s in push-mode: bandbreedte is verwaarloosbaar (een
  // `/api/messenger/all-conversations` is een paar KB), en NC Talk
  // verdraagt 6 req/min/user prima. Worst-case latency 51 s → 10 s.
  if (pushActive) return 10_000;
  const t = visibilityTier();
  return t === "hidden" ? MSG_INTERVAL_HIDDEN_MS
    : t === "blurred" ? MSG_INTERVAL_BLURRED_MS
    : MSG_INTERVAL_FOCUSED_MS;
}

interface UnseenSummary {
  folders: Array<{ path: string; unseen: number }>;
  total: number;
}

// Harde min-interval-rem (module-niveau, gedeeld over alle provider-instances
// en álle trigger-paden: scheduled tick, WS-event, focus/visibility). Voorkomt
// dat een burst aan WS-events (`messenger-changed`/`mail-changed`) of meerdere
// gemounte providers de pollers in een request-storm jaagt. De normale
// schedule-intervallen (mail 60s, messenger 10-20s) liggen ruim boven deze gap.
let lastMailPollAt = 0;
let lastMsgPollAt = 0;
const MIN_POLL_GAP_MS = 8000;

// Laatst-bekende ongelezen-INBOX-totaal, voor delta-detectie t.b.v.
// mail-notificaties. -1 = nog niet geïnitialiseerd → de eerste poll na
// page-load notificeert NIET (anders zou elke reload pingen), maar zet alleen
// de baseline.
let lastMailUnseenTotal = -1;
// Idem voor messenger: laatst-bekende som ongelezen chat-berichten (delta →
// notificatie). -1 = baseline nog niet gezet.
let lastMsgUnreadTotal = -1;

// Huidige tellingen voor de app-icoon-badge (taskbar/dock). Beide pollers
// werken hun deel bij; de badge toont het TOTAAL (mail + chat) zodat de
// gebruiker met de app op de achtergrond in één blik ziet dat er iets is.
let mailBadgeTotal = 0;
let msgBadgeTotal = 0;
function updateAppIconBadge(): void {
  setAppIconBadge(Math.max(0, mailBadgeTotal) + Math.max(0, msgBadgeTotal));
}

async function pollMailOnce(): Promise<void> {
  const now = Date.now();
  if (now - lastMailPollAt < MIN_POLL_GAP_MS) return;
  // Wanneer Webmail open is, heeft die zijn eigen useEffect die de
  // sidebar-badge derived uit lokale `folders` state. Dat is optimistic
  // bijgewerkt zodra de gebruiker een mail opent (folder.unseen--).
  // Een server-poll die ondertussen vuurt ziet nog `unseen=1` totdat
  // IMAP STORE \Seen voltooid is (paar seconden lag) → zet badge terug
  // op 1 → badge "loopt achter". Skip de poll dus wanneer /webmail
  // actief is; Webmail's eigen useEffect houdt de badge correct.
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/webmail")) {
    return;
  }
  lastMailPollAt = now;
  try {
    // Server's getCredentials() heeft email-param nodig om IMAP-creds via
    // ERPNext-fallback te resolven (zonder cached session). Lees uit
    // localStorage waar Webmail z'n primary IMAP-user opslaat.
    const instanceId = getActiveInstanceId();
    const imapUser = localStorage.getItem(`pref_${instanceId}_imap_user`) || "";
    const params = new URLSearchParams();
    if (imapUser) params.set("email", imapUser);
    const qs = params.toString();
    const res = await fetch(`/api/mail/unseen-summary${qs ? "?" + qs : ""}`, { credentials: "same-origin" });
    if (!res.ok) return;
    const json = await res.json() as { data?: UnseenSummary };
    const summary = json?.data;
    if (!summary?.folders) return;
    const total = sumInboxUnseen(summary.folders);
    setBadgeCount("webmail", total);
    mailBadgeTotal = total;
    updateAppIconBadge();
    // Notificatie bij toename van ongelezen INBOX-mail. showWebNotification
    // onderdrukt zelf bij zichtbare tab / geen permissie / desktop, dus we
    // hoeven hier alleen de delta te bepalen. Merk op: deze poll draait niet
    // wanneer /webmail open is (guard hierboven), dus geen notificatie terwijl
    // de gebruiker z'n mail al bekijkt.
    if (lastMailUnseenTotal >= 0 && total > lastMailUnseenTotal) {
      const delta = total - lastMailUnseenTotal;
      showWebNotification({
        title:
          delta === 1
            ? i18n.t("notify.new_mail_one", { defaultValue: "Nieuwe e-mail" })
            : i18n.t("notify.new_mail_many", {
                defaultValue: "{{count}} nieuwe e-mails",
                count: delta,
              }),
        body: i18n.t("notify.new_mail_body", {
          defaultValue: "Er is nieuwe ongelezen e-mail in je inbox.",
        }),
        tag: "y-app-mail",
        navigateTo: "/webmail",
      });
    }
    lastMailUnseenTotal = total;
  } catch {
    /* network blip — try again next tick */
  }
}

// §5/§14: lightweight messenger poll — haal alleen de conversation-list met
// unreadCount per conversatie op (geen message-bodies). Gebruikt
// /all-conversations (multi-platform aggregator) i.p.v. /conversations
// — die laatste vereist een `platform=` query-param en gaf hier 100+ ×
// 400 Bad Request op productie.
async function pollMessengerOnce(): Promise<void> {
  const now = Date.now();
  if (now - lastMsgPollAt < MIN_POLL_GAP_MS) return;
  // Messenger open? Die pagina houdt zelf de conversatielijst + badge bij; een
  // gelijktijdige all-conversations-poll racet met het openen van een gesprek
  // (dezelfde NC-verbinding) → onnodige vertraging. Mirror van de /webmail-guard
  // in pollMailOnce.
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/messenger")) {
    return;
  }
  lastMsgPollAt = now;
  try {
    const res = await fetch("/api/messenger/all-conversations", { credentials: "same-origin" });
    if (!res.ok) return;
    const json = await res.json() as { data?: Array<{ unreadCount?: number }> };
    const list = Array.isArray(json?.data) ? json.data : [];
    const total = list.reduce((s, c) => s + (c.unreadCount || 0), 0);
    setBadgeCount("messenger", total);
    msgBadgeTotal = total;
    updateAppIconBadge();
    // Notificatie + geluid bij toename ongelezen chat-berichten. Deze poll
    // draait niet wanneer /messenger open is (guard hierboven), dus geen dubbele
    // melding met Messenger.tsx' eigen in-page notificatie. showWebNotification
    // onderdrukt zelf bij zichtbare tab / geen permissie / desktop.
    if (lastMsgUnreadTotal >= 0 && total > lastMsgUnreadTotal) {
      const delta = total - lastMsgUnreadTotal;
      showWebNotification({
        title:
          delta === 1
            ? i18n.t("notify.new_message_one", { defaultValue: "Nieuw bericht" })
            : i18n.t("notify.new_message_many", {
                defaultValue: "{{count}} nieuwe berichten",
                count: delta,
              }),
        body: i18n.t("notify.new_message_body", {
          defaultValue: "Er zijn nieuwe ongelezen chatberichten.",
        }),
        tag: "y-app-messenger",
        navigateTo: "/messenger",
      });
    }
    lastMsgUnreadTotal = total;
  } catch {
    /* network blip / NC Talk niet bereikbaar — skip */
  }
}

export function BackgroundSyncProvider({ children }: { children: React.ReactNode }) {
  const mailTimerRef = useRef<number | null>(null);
  const msgTimerRef = useRef<number | null>(null);
  const lastMailPollRef = useRef<number>(0);
  const lastMsgPollRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectTimerRef = useRef<number | null>(null);
  // Houd subscribed conversations + creds bij zodat na een WS-reconnect
  // alle huidige subscriptions automatisch opnieuw worden gestuurd.
  const subsRef = useRef<Map<string, NcCreds>>(new Map());

  const subscribeConversation = useCallback((conversation: string, creds: NcCreds) => {
    subsRef.current.set(conversation, creds);
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify({
          type: "subscribe-conversation",
          conversation,
          ncUrl: creds.url,
          ncUser: creds.user,
          ncPass: creds.pass,
        }));
      } catch { /* will be re-sent on reconnect */ }
    }
  }, []);

  const unsubscribeConversation = useCallback((conversation: string) => {
    subsRef.current.delete(conversation);
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify({ type: "unsubscribe-conversation", conversation }));
      } catch { /* ignore */ }
    }
  }, []);
  // Wanneer WS push-events actief zijn, kunnen de pollers naar een veel
  // langere interval — de push is dan de primaire signaling, de poll is
  // alleen nog een sanity-fallback.
  const pushActiveRef = useRef<boolean>(false);

  // §14 push: open WebSocket-events kanaal voor IMAP IDLE + NC long-poll
  // pushes. Bij `mail-changed` of `messenger-changed` direct één
  // poll-call om de juiste counts te halen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path === "/mail/view" || path === "/messenger/view") return;
    const standalone = new URLSearchParams(window.location.search).get("standalone") === "1";
    if (standalone) return;
    const instanceId = getActiveInstanceId();
    if (!instanceId || instanceId === "default") return;

    let cancelled = false;

    function connectWs(): void {
      if (cancelled) return;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${proto}://${window.location.host}/ws/events?instance=${encodeURIComponent(instanceId)}`;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onopen = () => {
          pushActiveRef.current = true;
          // Plan A: stuur een subscribe-mail met de primary email zodat
          // de server IMAP IDLE kan starten zonder dat de gebruiker
          // Webmail hoeft te openen. Server doet:
          //  1. Cache-hit op (sessie, instance, acct) → direct IDLE
          //  2. Cache-miss + email gegeven → ERPNext-resolve via
          //     erpnext-sid → setMailSession + IDLE
          // Als de email leeg is, valt de server terug op cache-only.
          try {
            const imapUser = localStorage.getItem(`pref_${instanceId}_imap_user`) || "";
            ws.send(JSON.stringify({
              type: "subscribe-mail",
              email: imapUser || undefined,
            }));
          } catch { /* ignore */ }
          // Wave 0a: push NC Talk creds into the server-side cache so
          // subsequent /api/messenger/* HTTP calls don't need them in
          // their URL. Same lifetime as the WS (re-sent on reconnect).
          try {
            const ncUrl = localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_url`)
              || localStorage.getItem(`pref_${instanceId}_nextcloud_url`) || "";
            const ncUser = localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_user`)
              || localStorage.getItem(`pref_${instanceId}_nextcloud_user`) || "";
            const ncPass = localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_pass`)
              || localStorage.getItem(`pref_${instanceId}_nextcloud_pass`) || "";
            if (ncUrl && ncUser && ncPass) {
              ws.send(JSON.stringify({
                type: "subscribe-messenger",
                ncUrl, ncUser, ncPass,
              }));
            }
          } catch { /* ignore */ }
          // Re-subscribe alle conversation-subs na een reconnect zodat de
          // server long-poll loops automatisch herstart.
          for (const [conv, creds] of subsRef.current) {
            try {
              ws.send(JSON.stringify({
                type: "subscribe-conversation",
                conversation: conv,
                ncUrl: creds.url,
                ncUser: creds.user,
                ncPass: creds.pass,
              }));
            } catch { /* ignore */ }
          }
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data) as { type?: string };
            if (msg.type === "mail-changed") {
              void pollMailOnce().then(() => { lastMailPollRef.current = Date.now(); });
              // Dispatch custom event zodat Webmail.tsx zijn messages-state
              // kan refreshen wanneer de pagina geopend is. pollMailOnce
              // update alleen folder.unseen counts via /unseen-summary; de
              // mail-list zelf wordt anders pas bij volgende manual F5
              // ge-update — gevolg: folder.unseen=N maar zichtbaar maar 1
              // ongelezen in de lijst (discrepantie).
              window.dispatchEvent(new CustomEvent("y-app:mail-changed"));
            } else if (msg.type === "messenger-changed") {
              void pollMessengerOnce().then(() => { lastMsgPollRef.current = Date.now(); });
              window.dispatchEvent(new CustomEvent("y-app:messenger-changed"));
            }
          } catch { /* ignore */ }
        };
        ws.onclose = () => {
          pushActiveRef.current = false;
          wsRef.current = null;
          // Exponential backoff zou eleganter zijn maar 5s is voldoende
          // voor onze use-case (network blip recovery).
          if (!cancelled) {
            wsReconnectTimerRef.current = window.setTimeout(connectWs, 5000);
          }
        };
        ws.onerror = () => {
          /* onclose volgt automatisch — geen extra actie */
        };
      } catch {
        pushActiveRef.current = false;
        if (!cancelled) wsReconnectTimerRef.current = window.setTimeout(connectWs, 5000);
      }
    }

    // Belt-and-suspenders: also push NC Talk creds into the server-side cache
    // over plain HTTP, not only via the WS subscribe-messenger above. The
    // /ws/events WebSocket does not reliably establish in installed PWAs (Edge
    // "app"), and post-Wave-0a the messenger calls read creds ONLY from that
    // cache → an installed app would get "missing credentials" despite having
    // them configured. This POST carries the same session cookie + instance
    // header as the data calls, so the cache lands under the right key. Fires
    // once per mount, independent of WS state.
    try {
      const ncUrl = localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_url`)
        || localStorage.getItem(`pref_${instanceId}_nextcloud_url`) || "";
      const ncUser = localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_user`)
        || localStorage.getItem(`pref_${instanceId}_nextcloud_user`) || "";
      const ncPass = localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_pass`)
        || localStorage.getItem(`pref_${instanceId}_nextcloud_pass`) || "";
      if (ncUrl && ncUser && ncPass) {
        void fetch("/api/messenger/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ url: ncUrl, user: ncUser, pass: ncPass }),
        }).catch(() => { /* best-effort; the WS push covers the normal case */ });
      }
    } catch { /* ignore */ }

    connectWs();

    return () => {
      cancelled = true;
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
      if (wsReconnectTimerRef.current !== null) window.clearTimeout(wsReconnectTimerRef.current);
      pushActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Voorkom dat de popout-tabs (`/mail/view`, `/messenger/view`,
    // `/webmail?standalone=1`, …) hun eigen achtergrond-loop starten —
    // die tabs zijn een single-purpose focused view en hebben de overhead
    // niet nodig.
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path === "/mail/view" || path === "/messenger/view") return;
    const standalone = new URLSearchParams(window.location.search).get("standalone") === "1";
    if (standalone) return;

    // Wacht tot een instance actief is (door AuthenticatedApp gezet) voor
    // we beginnen te pollen — anders elke call 401 missing_instance.
    if (!getActiveInstanceId() || getActiveInstanceId() === "default") return;

    // Vraag eenmalig notificatie-toestemming zodat mail-notificaties kunnen
    // vuren (Messenger vraagt 'm ook op zijn eigen mount; requestPermission
    // is idempotent).
    requestNotifyPermissionOnce();

    let cancelled = false;

    function scheduleMailNext(): void {
      if (cancelled) return;
      mailTimerRef.current = window.setTimeout(async () => {
        if (cancelled) return;
        lastMailPollRef.current = Date.now();
        await pollMailOnce();
        scheduleMailNext();
      }, getMailInterval(pushActiveRef.current));
    }

    function scheduleMessengerNext(): void {
      if (cancelled) return;
      msgTimerRef.current = window.setTimeout(async () => {
        if (cancelled) return;
        lastMsgPollRef.current = Date.now();
        await pollMessengerOnce();
        scheduleMessengerNext();
      }, getMessengerInterval(pushActiveRef.current));
    }

    // Direct eerste polls, daarna op interval.
    void pollMailOnce().then(() => { lastMailPollRef.current = Date.now(); });
    void pollMessengerOnce().then(() => { lastMsgPollRef.current = Date.now(); });
    scheduleMailNext();
    scheduleMessengerNext();

    // Wanneer tab weer focus krijgt: forceer beide polls als laatste >15s
    // geleden was (anders zou de oude timer pas later vuren).
    function onVisibility(): void {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastMailPollRef.current > 15_000) {
        void pollMailOnce().then(() => { lastMailPollRef.current = Date.now(); });
      }
      if (Date.now() - lastMsgPollRef.current > 10_000) {
        void pollMessengerOnce().then(() => { lastMsgPollRef.current = Date.now(); });
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      cancelled = true;
      if (mailTimerRef.current !== null) window.clearTimeout(mailTimerRef.current);
      if (msgTimerRef.current !== null) window.clearTimeout(msgTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);

  return (
    <BackgroundSyncContext.Provider value={{ subscribeConversation, unsubscribeConversation }}>
      {children}
    </BackgroundSyncContext.Provider>
  );
}
