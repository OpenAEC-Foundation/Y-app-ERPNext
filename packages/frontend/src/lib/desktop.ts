/** True wanneer de gedeelde frontend in de Tauri desktop-app draait.
 *  Tauri 2 injecteert altijd `window.__TAURI_INTERNALS__` in de webview. */
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Geeft op desktop een opener-callback voor externe http(s)-links, anders
 * `undefined` (web gebruikt dan gewoon `window.open` in een nieuw tabblad).
 * Een Tauri 2-webview slikt `window.open`/`target="_blank"`, dus routeren we de
 * link via de fetch-adapter (`POST /api/desktop/open-external`) naar de
 * systeembrowser (shell-plugin `open()`). `fetch` is hier de door de
 * desktop-adapter gepatchte `window.fetch`; die vangt /api/* af en roept de
 * shell-plugin aan. Bedoeld om aan `attachExternalLinkHandler` mee te geven
 * (mail-format.ts blijft zo desktop-vrij en testbaar).
 */
export function makeExternalLinkOpener(): ((url: string) => void) | undefined {
  if (!isDesktopApp()) return undefined;
  return (url: string) => {
    void fetch("/api/desktop/open-external", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => {
      /* best-effort — geen zichtbare fout in de mail-body */
    });
  };
}
