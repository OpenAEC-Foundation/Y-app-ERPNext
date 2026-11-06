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
 * van deze pagina's); die komt één keer in de <head>.
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

function laadStijl(): void {
  if (document.querySelector("link[data-ynext-inbed]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = cssUrl;
  link.dataset.ynextInbed = "1";
  document.head.appendChild(link);
}

/** Tekent een pagina in `el`; geeft een functie terug die hem weer opruimt. */
function mount(el: HTMLElement, pagina: string): () => void {
  const Pagina = PAGINAS[pagina];
  if (!Pagina) throw new Error(`Onbekende pagina: ${pagina}`);
  laadStijl();
  void ensureCsrfToken();
  const root = createRoot(el);
  root.render(
    <StrictMode>
      <ToastProvider>
        <DataProvider>
          <Pagina />
        </DataProvider>
      </ToastProvider>
    </StrictMode>,
  );
  return () => root.unmount();
}

declare global {
  interface Window {
    __ynextInbed?: { mount: typeof mount };
  }
}

window.__ynextInbed = { mount };
