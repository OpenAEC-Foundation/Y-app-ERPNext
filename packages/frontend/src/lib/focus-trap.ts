/**
 * Focus-val voor het opstelvenster — de beslisregel apart van de bedrading.
 *
 * ── Waarom een val ───────────────────────────────────────────────────────
 *
 * Het opstelvenster staat in het leespaneel, met de berichtenlijst en de
 * zijbalk er zichtbaar naast. Tab vanuit het laatste veld liep daardoor het
 * venster uít, de lijst in: je typt een mail, drukt Tab, en staat opeens op
 * een mailrij achter het venster. Deze module beantwoordt de enige vraag die
 * daarvoor beantwoord moet worden — *"moet deze Tab terug naar het begin (of
 * het einde) van het venster?"* — en houdt hem los van React en van de DOM,
 * zodat hij te testen is.
 *
 * ── De ontsnappingsroute ─────────────────────────────────────────────────
 *
 * Een focus-val zonder uitweg is een toegankelijkheidsprobleem: iemand die
 * alleen het toetsenbord gebruikt, zit dan vast. **Escape** is de uitweg — hij
 * sluit het opstelvenster (het concept blijft bewaard) en geeft de focus terug
 * aan de pagina erachter. Die afspraak staat ook in de bedrading in
 * `Webmail.tsx` en hoort daar te blijven staan.
 *
 * ── Wat er níet wordt afgevangen ─────────────────────────────────────────
 *
 * Ctrl/Cmd/Alt+Tab zijn van het besturingssysteem en van de browser (tabblad
 * wisselen); die mogen nooit ingeslikt worden. En een Tab die een kind al
 * heeft afgehandeld — de adressuggestie die gekozen wordt, de inspringing in
 * het tekstvak — is klaar: `defaultPrevented` betekent hier "iemand anders was
 * eerder, laat het los".
 */

/**
 * Alles wat de browser als tab-stop beschouwt.
 *
 * `[tabindex]:not([tabindex="-1"])` vangt ook het `contentEditable`-tekstvak,
 * dat een expliciete `tabIndex={0}` draagt. Elementen die *wel* aan de
 * selector voldoen maar `tabindex="-1"` dragen (de werkbalkknoppen die niet
 * aan de beurt zijn) vallen weg in `focusableWithin`.
 */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Het stukje `KeyboardEvent` waar de beslissing op leunt. */
export interface FocusTrapKey {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** Heeft een kind deze toets al afgehandeld? Dan blijft de val eraf. */
  defaultPrevented?: boolean;
}

/** Waar de focus heen moet. `null` = laat de browser zijn gang gaan. */
export type FocusTrapAction = "first" | "last";

export interface FocusTrapContext {
  /** Plaats van het element met focus in de lijst; `-1` = niet in de lijst. */
  index: number;
  /** Aantal focusbare elementen binnen het venster. */
  count: number;
}

/**
 * Moet deze toetsaanslag de focus laten omlopen binnen het venster?
 *
 * Alleen de randen worden bijgestuurd: Tab op het laatste element gaat naar
 * het eerste, Shift+Tab op het eerste naar het laatste. Alles daartussen laat
 * de browser zelf doen — dat is de volgorde die de gebruiker gewend is, en die
 * hoeven we niet na te bouwen.
 *
 * Staat de focus (nog) nergens binnen het venster — bijvoorbeeld op de
 * omhullende `div` zelf, vlak na het openen — dan brengt Tab hem naar het
 * eerste veld en Shift+Tab naar het laatste, in plaats van hem te laten
 * ontsnappen.
 */
export function focusTrapAction(e: FocusTrapKey, ctx: FocusTrapContext): FocusTrapAction | null {
  if (e.defaultPrevented) return null;
  if (e.key !== "Tab") return null;
  // Ctrl/Cmd+Tab wisselt van browsertabblad, Alt+Tab van venster.
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (ctx.count <= 0) return null;

  const back = e.shiftKey === true;
  if (ctx.index < 0) return back ? "last" : "first";
  if (back && ctx.index === 0) return "last";
  if (!back && ctx.index >= ctx.count - 1) return "first";
  return null;
}

/**
 * De focusbare elementen binnen een venster, in tab-volgorde.
 *
 * Het enige stuk van deze module dat de DOM aanraakt. Drie filters bovenop de
 * selector, en alle drie hebben ze een reden:
 *
 * - `tabindex="-1"` — de werkbalk is één tab-stop (roving tabindex); de
 *   knoppen die niet aan de beurt zijn horen niet in de cyclus.
 * - `aria-hidden` — decoratie die een schermlezer ook al overslaat.
 * - géén client-rect — Tailwind's `hidden` op de knoppen die op een smal
 *   scherm wegvallen, en de dichtgeklapte Cc/Bcc-regels. Onzichtbaar is
 *   onbereikbaar; anders zou Tab op een telefoon door lege stops lopen.
 */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      el.getAttribute("tabindex") !== "-1"
      && !el.hasAttribute("disabled")
      && el.getAttribute("aria-hidden") !== "true"
      && el.getClientRects().length > 0,
  );
}
