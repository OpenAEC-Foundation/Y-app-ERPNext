/**
 * Browser-notificaties (web). Desktop (Tauri) gebruikt de native
 * notification-plugin vanuit het desktop-pakket zelf — deze helper no-opt op
 * desktop zodat we nooit dubbel notificeren.
 *
 * Gedeeld tussen de mail-poll (BackgroundSyncProvider) en, waar handig, andere
 * web-notificaties. De aanroeper bepaalt de delta / wanneer er iets nieuws is;
 * deze module doet alleen de presentatie + permissie.
 */
import { isDesktopApp } from "./desktop";
import { playNotificationSound } from "./notify-sound";

/** Vraag eenmalig toestemming (idempotent; alleen bij status 'default'). */
export function requestNotifyPermissionOnce(): void {
  if (isDesktopApp()) return;
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {
      /* gebruiker weigerde — stil */
    });
  }
}

export interface WebNotifyOptions {
  title: string;
  body: string;
  /** Dedup-tag: een nieuwere notificatie met dezelfde tag vervangt de oude. */
  tag: string;
  /** Pad om te openen bij klik (bv. "/webmail"). */
  navigateTo?: string;
  /** Speel de notificatie-chime af (default true). Alleen wanneer de
   *  notificatie daadwerkelijk getoond wordt (tab niet zichtbaar). */
  sound?: boolean;
}

/**
 * Toon een browser-notificatie, mits: geen desktop, API aanwezig, permissie
 * verleend, en de tab NIET zichtbaar is (anders ziet de gebruiker het al in de
 * app). Bij klik: venster focussen + optioneel naar `navigateTo` navigeren.
 */
export function showWebNotification(opts: WebNotifyOptions): void {
  if (isDesktopApp()) return;
  if (typeof Notification === "undefined") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      icon: `${import.meta.env.BASE_URL}y-logo.svg`,
      tag: opts.tag,
    });
    if (opts.sound !== false) playNotificationSound();
    if (opts.navigateTo) {
      const dest = opts.navigateTo;
      n.onclick = () => {
        try {
          window.focus();
        } catch {
          /* ignore */
        }
        try {
          if (window.location.pathname !== dest) window.location.assign(dest);
        } catch {
          /* ignore */
        }
        try {
          n.close();
        } catch {
          /* ignore */
        }
      };
    }
  } catch {
    /* notificatie geblokkeerd */
  }
}
