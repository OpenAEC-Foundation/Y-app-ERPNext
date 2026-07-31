/**
 * App-icoon-teller (taskbar/dock badge) met het totaal ongelezen (mail + chat).
 *
 * Web: de Badging API (`navigator.setAppBadge`) — werkt in een geïnstalleerde
 * PWA (Edge/Chrome "app"); in een gewoon tabblad is 'ie een no-op. Desktop
 * (Tauri) zet z'n eigen badge via de window-API in het desktop-pakket
 * (setBadgeCount), want de gedeelde frontend kan Tauri niet importeren — daarom
 * is deze helper op desktop bewust een no-op.
 */
import { isDesktopApp } from "./desktop";

export function setAppIconBadge(count: number): void {
  if (isDesktopApp()) return; // desktop zet z'n badge via Tauri (desktop-pakket)
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (count > 0) nav.setAppBadge?.(count);
    else nav.clearAppBadge?.();
  } catch {
    /* Badging API niet ondersteund / geen PWA — negeren */
  }
}
