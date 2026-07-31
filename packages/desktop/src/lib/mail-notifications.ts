/**
 * Desktop notificaties voor nieuwe mail ÉN chat (NC Talk), plus een teller op
 * het app-icoon (taskbar-badge).
 *
 * De web-app pusht nieuwe mail/chat via IMAP IDLE / NC long-poll → /ws/events →
 * BackgroundSyncProvider. Op desktop bestaat die keten NIET (geen server, geen
 * WS), dus draaien hier twee lichte poll-loops via de fetch-adapter:
 *  - Mail:      `/api/mail/unseen-summary` (folders-only, geen bodies)
 *  - Messenger: `/api/messenger/all-conversations` (unreadCount per conversatie)
 * Bij een TOENAME van het ongelezen-totaal: een NATIVE Tauri-notificatie +
 * geluidssignaal (WebAudio-chime, gedeeld met de web-app). De app-icoon-badge
 * toont altijd het TOTAAL ongelezen (mail + chat) zodat de gebruiker met de app
 * op de achtergrond in één blik ziet dat er iets is.
 *
 * Bewust géén IMAP IDLE / long-poll in Rust (echte push) in deze iteratie —
 * dat is een eigen project. Polling is de 80%-oplossing; intervallen ruim boven
 * de storm-preventiedrempel.
 */
import { useEffect } from "react";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { sumInboxUnseen, type UnseenFolder } from "@frontend/lib/mail-badge-filter";
import { setBadgeCount } from "@frontend/lib/badges";
import { getActiveInstanceId } from "@frontend/lib/instances";
import { playNotificationSound } from "@frontend/lib/notify-sound";
import { setTaskbarBadge } from "./taskbar-badge";
import i18n from "@frontend/i18n/index";

// Mail: gefocust 2 min, anders 5 min. Chat is lichter (conversation-list) en
// mag wat vaker: gefocust 30 s, anders 2 min.
const MAIL_FOCUSED_MS = 2 * 60_000;
const MAIL_BLURRED_MS = 5 * 60_000;
const MSG_FOCUSED_MS = 30_000;
const MSG_BLURRED_MS = 2 * 60_000;

// Laatst-bekende ongelezen-totalen per instance (delta-detectie). -1 = nog niet
// geïnitialiseerd → eerste poll zet alleen de baseline (geen notificatie bij
// app-start).
const lastMailByInstance = new Map<string, number>();
const lastMsgByInstance = new Map<string, number>();

// Huidige totalen voor de app-icoon-badge. Beide pollers werken hun deel bij;
// de badge toont de som (mail + chat).
let mailBadgeTotal = 0;
let msgBadgeTotal = 0;
function updateAppIconBadge(): void {
  const total = Math.max(0, mailBadgeTotal) + Math.max(0, msgBadgeTotal);
  // macOS/Linux: echte numerieke dock-badge. Op Windows is dit Unsupported
  // (no-op) — daar zet setTaskbarBadge() een overlay-icoon op het taakbalk-icoon.
  try {
    // undefined = badge weghalen (0 zou op sommige platforms "0" tonen).
    void getCurrentWindow().setBadgeCount(total > 0 ? total : undefined).catch(() => {});
  } catch {
    /* window-API niet beschikbaar — negeren */
  }
  void setTaskbarBadge(total);
}

let permissionEnsured = false;
async function ensurePermission(): Promise<boolean> {
  if (permissionEnsured) return isPermissionGranted();
  permissionEnsured = true;
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    return granted;
  } catch {
    return false;
  }
}

/** Toon een native notificatie + speel de chime (mits permissie). */
async function notify(title: string, body: string): Promise<void> {
  playNotificationSound(); // gegarandeerd geluid, los van OS-toast-sound
  if (await ensurePermission()) {
    try {
      sendNotification({ title, body });
    } catch {
      /* notificatie geblokkeerd */
    }
  }
}

async function pollMailOnce(): Promise<void> {
  const instanceId = getActiveInstanceId();
  if (!instanceId || instanceId === "default") return;
  // Webmail open? Dan bekijkt de gebruiker de mail al — niet notificeren.
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/webmail")) return;
  try {
    // De adapter resolvet de mailcreds uit de vault; email-param spiegelt de
    // web-poll (voor de ERPNext-fallback). Ontbreken de creds nog (Webmail nooit
    // geopend) → de adapter geeft 400 → we skippen stil.
    const imapUser = localStorage.getItem(`pref_${instanceId}_imap_user`) || "";
    const qs = imapUser ? `?email=${encodeURIComponent(imapUser)}` : "";
    const res = await fetch(`/api/mail/unseen-summary${qs}`, { credentials: "same-origin" });
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { folders?: UnseenFolder[] } };
    const folders = json?.data?.folders;
    if (!folders) return;
    const total = sumInboxUnseen(folders);
    setBadgeCount("webmail", total);
    mailBadgeTotal = total;
    updateAppIconBadge();

    const prev = lastMailByInstance.get(instanceId);
    if (prev !== undefined && prev >= 0 && total > prev) {
      const delta = total - prev;
      await notify(
        delta === 1
          ? i18n.t("notify.new_mail_one", { defaultValue: "Nieuwe e-mail" })
          : i18n.t("notify.new_mail_many", { defaultValue: "{{count}} nieuwe e-mails", count: delta }),
        i18n.t("notify.new_mail_body", { defaultValue: "Er is nieuwe ongelezen e-mail in je inbox." }),
      );
    }
    lastMailByInstance.set(instanceId, total);
  } catch {
    /* offline / geen creds — volgende tick opnieuw */
  }
}

async function pollMessengerOnce(): Promise<void> {
  const instanceId = getActiveInstanceId();
  if (!instanceId || instanceId === "default") return;
  // Messenger open? Die pagina houdt zelf de lijst + notificatie bij.
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/messenger")) return;
  try {
    const res = await fetch("/api/messenger/all-conversations", { credentials: "same-origin" });
    if (!res.ok) return;
    const json = (await res.json()) as { data?: Array<{ unreadCount?: number }> };
    const list = Array.isArray(json?.data) ? json.data : [];
    const total = list.reduce((s, c) => s + (c.unreadCount || 0), 0);
    setBadgeCount("messenger", total);
    msgBadgeTotal = total;
    updateAppIconBadge();

    const prev = lastMsgByInstance.get(instanceId);
    if (prev !== undefined && prev >= 0 && total > prev) {
      const delta = total - prev;
      await notify(
        delta === 1
          ? i18n.t("notify.new_message_one", { defaultValue: "Nieuw bericht" })
          : i18n.t("notify.new_message_many", { defaultValue: "{{count}} nieuwe berichten", count: delta }),
        i18n.t("notify.new_message_body", { defaultValue: "Er zijn nieuwe ongelezen chatberichten." }),
      );
    }
    lastMsgByInstance.set(instanceId, total);
  } catch {
    /* offline / geen NC-creds — volgende tick opnieuw */
  }
}

/**
 * Start de desktop notificatie-polls (mail + chat) zolang de component gemount
 * is. Visibility-aware intervallen; vraagt eenmalig notificatie-toestemming aan.
 */
export function useDesktopMailNotifications(): void {
  useEffect(() => {
    void ensurePermission();
    let cancelled = false;
    let mailTimer: number | null = null;
    let msgTimer: number | null = null;

    function scheduleMail(): void {
      if (cancelled) return;
      const focused = typeof document !== "undefined" && document.hasFocus();
      mailTimer = window.setTimeout(async () => {
        if (cancelled) return;
        await pollMailOnce();
        scheduleMail();
      }, focused ? MAIL_FOCUSED_MS : MAIL_BLURRED_MS);
    }

    function scheduleMsg(): void {
      if (cancelled) return;
      const focused = typeof document !== "undefined" && document.hasFocus();
      msgTimer = window.setTimeout(async () => {
        if (cancelled) return;
        await pollMessengerOnce();
        scheduleMsg();
      }, focused ? MSG_FOCUSED_MS : MSG_BLURRED_MS);
    }

    // Eerste polls zetten de baseline (geen notificatie), daarna op interval.
    void pollMailOnce();
    void pollMessengerOnce();
    scheduleMail();
    scheduleMsg();

    return () => {
      cancelled = true;
      if (mailTimer !== null) window.clearTimeout(mailTimer);
      if (msgTimer !== null) window.clearTimeout(msgTimer);
    };
  }, []);
}
