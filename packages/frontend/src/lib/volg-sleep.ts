/**
 * Slepen aan een rand: een kolom breder maken, het voorbeeldpaneel, de
 * scheiding tussen antwoord en origineel.
 *
 * Het luisteren naar `mousemove`/`mouseup` op `window` is niet genoeg. Gaat
 * de muis tijdens het slepen over een iframe — de pdf-preview — dan krijgt
 * dat iframe de muisgebeurtenissen en de app niet. Laat je daar los, dan komt
 * het `mouseup` nooit aan en blijft de rand de muis volgen tot je ergens
 * anders klikt.
 *
 * Daarom drie vangnetten:
 * - een onzichtbaar scherm over de hele pagina zolang het slepen duurt, zodat
 *   geen iframe de muis kan wegkapen;
 * - een beweging zonder ingedrukte linkerknop beëindigt het slepen
 *   (`knopLosgelaten`), voor als het loslaten toch ergens anders terechtkwam;
 * - het venster verliest de focus (alt-tab): ook klaar.
 */

/** Is de linkermuisknop niet (meer) ingedrukt? `buttons` uit een MouseEvent. */
export function knopLosgelaten(buttons: number): boolean {
  return (buttons & 1) === 0;
}

/**
 * Begint een sleepbeweging. `beweeg` krijgt elke muisbeweging, `klaar` wordt
 * precies één keer aangeroepen als het slepen stopt. Geeft een functie terug
 * waarmee je het slepen zelf kunt afbreken.
 */
export function volgSleep(opts: {
  cursor: "col-resize" | "row-resize";
  beweeg: (ev: MouseEvent) => void;
  klaar?: () => void;
}): () => void {
  const scherm = document.createElement("div");
  scherm.setAttribute("aria-hidden", "true");
  Object.assign(scherm.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    cursor: opts.cursor,
    background: "transparent",
  });
  document.body.appendChild(scherm);
  document.body.style.userSelect = "none";
  document.body.style.cursor = opts.cursor;

  let gestopt = false;
  function stop() {
    if (gestopt) return;
    gestopt = true;
    window.removeEventListener("mousemove", beweeg);
    window.removeEventListener("mouseup", stop);
    window.removeEventListener("blur", stop);
    scherm.remove();
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    opts.klaar?.();
  }
  function beweeg(ev: MouseEvent) {
    if (knopLosgelaten(ev.buttons)) { stop(); return; }
    opts.beweeg(ev);
  }
  window.addEventListener("mousemove", beweeg);
  window.addEventListener("mouseup", stop);
  window.addEventListener("blur", stop);
  return stop;
}
