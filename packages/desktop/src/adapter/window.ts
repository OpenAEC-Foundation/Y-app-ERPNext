/**
 * Popout-vensters op desktop (OPMERKINGEN punt 2 — "meerdere tabs en vensters").
 *
 * Web opent popouts met window.open('/mail/view?…'); op desktop dead-navigeert
 * dat het enige Tauri-venster. Hier maken we een écht tweede WebviewWindow dat
 * dezelfde bundle laadt met `?popout=<route>` — DesktopApp herkent die param,
 * unlockt stil via de Rust vault-handoff (session_get_unlock) en rendert
 * alleen de popout-route (MailView / MessengerView), zonder tabbar.
 *
 * De gedeelde frontend kan dit pakket niet importeren; Webmail/Messenger
 * dispatchen daarom een `y-app:open-popout` CustomEvent die hier (gemount in
 * het hoofdvenster) wordt afgevangen.
 */
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

/**
 * Meld een popout-fout terug aan de gedeelde frontend zodat Webmail er een
 * toast van kan maken. Het desktop-pakket kent de React-toast-context niet
 * (die leeft in de shared frontend), dus we bruggen via een CustomEvent —
 * spiegelbeeld van `y-app:open-popout`.
 */
function reportPopoutFailure(message: string): void {
  console.error("[popout] kon extra venster niet openen:", message);
  window.dispatchEvent(
    new CustomEvent("y-app:popout-error", { detail: { message } })
  );
}

export function openDesktopPopout(route: string, title: string): void {
  const label = `popout-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  try {
    const win = new WebviewWindow(label, {
      url: `index.html?popout=${encodeURIComponent(route)}`,
      title: title || "Y-app",
      width: 1100,
      height: 800,
      minWidth: 700,
      minHeight: 500,
      // Nieuw venster naar voren halen — anders kan het achter het hoofdvenster
      // openen en lijkt het alsof er "niets gebeurt".
      focus: true,
      // Zelfde fix als het hoofdvenster: Tauri's OS-drag-handler zou HTML5-DnD
      // in de webview blokkeren (WebView2).
      dragDropEnabled: false,
    });
    // KRITIEK: `new WebviewWindow` meldt een RUNTIME-fout (ontbrekende
    // capability, geblokkeerde webview, asset-protocol-404, dubbel label, …)
    // UITSLUITEND via het async `tauri://error`-event — de constructor throwt
    // daar niet voor. Zonder deze listener faalde een popout 100% stil
    // ("er gebeurt niets"), precies het gerapporteerde symptoom. Log beide
    // uitkomsten en meld een fout terug aan de gebruiker.
    win.once("tauri://created", () => {
      console.info(`[popout] venster aangemaakt: ${label} → ${route}`);
    }).catch(() => { /* listener-registratie best-effort */ });
    win.once("tauri://error", (e) => {
      reportPopoutFailure(String(e?.payload ?? "onbekende fout"));
    }).catch(() => { /* listener-registratie best-effort */ });
  } catch (err) {
    // Synchrone throw (bv. ongeldig label, ontbrekende API-binding) — óók
    // zichtbaar maken i.p.v. stil laten sneuvelen.
    reportPopoutFailure(err instanceof Error ? err.message : String(err));
  }
}

/** Luister (in het hoofdvenster) naar popout-verzoeken uit de gedeelde frontend. */
export function installPopoutOpener(): () => void {
  const handler = (e: Event) => {
    const d = (e as CustomEvent).detail as { route?: string; title?: string } | undefined;
    if (d?.route) openDesktopPopout(d.route, d.title || "Y-app");
  };
  window.addEventListener("y-app:open-popout", handler);
  return () => window.removeEventListener("y-app:open-popout", handler);
}
