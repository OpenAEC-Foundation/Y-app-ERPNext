/**
 * Inbedden: Werkplekken, Ecosysteem en Brainstorm direct tekenen in een
 * andere Y-next-versie die op dezelfde site draait, zonder iframe.
 *
 * Die versie laadt deze module en roept `window.__ynextInbed.mount(el, pagina)`
 * aan; wij tekenen dan een eigen React-blok in `el`, met onze eigen vertalingen,
 * meldingen en gegevens. De globale fetch is daar al ingericht, dus hier geen
 * `initInstances()` (die zou het thema en de fetch van de gastversie overschrijven).
 *
 * Het blok heeft een eigen, kleine stylesheet (inbed.css, alleen de utilities
 * van deze pagina's). Die geldt alleen binnen het blok: zie `scopeerStijl`.
 */
import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import cssUrl from "./inbed.css?url";
import "./i18n";
import { ensureCsrfToken } from "./lib/csrf";
import { ToastProvider } from "./components/Toast";
import { DataProvider } from "./lib/DataContext";
import Werkplekken from "./pages/Werkplekken";
import Ecosysteem from "./pages/Ecosysteem";
import Brainstorm from "./pages/Brainstorm";

const PAGINAS: Record<string, ComponentType> = {
  werkplekken: Werkplekken,
  ecosysteem: Ecosysteem,
  brainstorm: Brainstorm,
};

/** De klasse op het blok; alleen daarbinnen gelden onze stijlregels. */
const SCOPE = "ynext-inbed";
let stijl: Promise<void> | null = null;

/**
 * Herschrijft onze stylesheet zodat hij alleen binnen `.ynext-inbed` werkt.
 * Zonder dat overschrijven onze utilities (bijvoorbeeld `.hidden`, die later
 * in de pagina staat dan de `md:flex` van de gastversie) de rest van de app:
 * de zijbalk verdween en formulieren vielen uit elkaar. De thema-variabelen
 * komen op het blok zelf, de utilities in `@scope`.
 */
export function scopeerStijl(regels: CSSRuleList): string {
  let uit = "";
  for (const r of Array.from(regels)) {
    if (r instanceof CSSLayerBlockRule && r.name === "utilities") {
      uit += `@layer utilities{@scope (.${SCOPE}){${Array.from(r.cssRules).map((x) => x.cssText).join("")}}}`;
    } else if (r instanceof CSSLayerBlockRule && r.name === "theme") {
      const vars = Array.from(r.cssRules).map((x) => (x instanceof CSSStyleRule ? x.style.cssText : "")).join("");
      uit += `@layer theme{.${SCOPE}{${vars}}}`;
    } else if (!(r instanceof CSSLayerStatementRule)) {
      uit += r.cssText;
    }
  }
  return uit;
}

function laadStijl(): Promise<void> {
  if (!stijl) {
    // Een <link> uit een eerdere versie van deze module raakte de hele app.
    document.querySelectorAll("link[data-ynext-inbed]").forEach((l) => l.remove());
    stijl = fetch(cssUrl)
      .then((r) => r.text())
      .then((tekst) => {
        const blad = new CSSStyleSheet();
        blad.replaceSync(tekst);
        const el = document.createElement("style");
        el.dataset.ynextInbed = "1";
        el.textContent = scopeerStijl(blad.cssRules);
        document.head.appendChild(el);
      });
  }
  return stijl;
}

/** Tekent een pagina in `el`; geeft een functie terug die hem weer opruimt. */
function mount(el: HTMLElement, pagina: string): () => void {
  const Pagina = PAGINAS[pagina];
  if (!Pagina) throw new Error(`Onbekende pagina: ${pagina}`);
  void ensureCsrfToken();
  el.classList.add(SCOPE);
  const root = createRoot(el);
  let weg = false;
  // Pas tekenen als de stijl er is, anders flitst de pagina ongestyled.
  void laadStijl().catch(() => undefined).then(() => {
    if (weg) return;
    root.render(
      <StrictMode>
        <ToastProvider>
          <DataProvider>
            <Pagina />
          </DataProvider>
        </ToastProvider>
      </StrictMode>,
    );
  });
  return () => {
    weg = true;
    root.unmount();
  };
}

declare global {
  interface Window {
    __ynextInbed?: { mount: typeof mount };
  }
}

window.__ynextInbed = { mount };
