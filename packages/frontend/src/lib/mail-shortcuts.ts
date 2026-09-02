/**
 * Toetsenbordsneltoetsen voor de mailpagina — alléén de beslisregel.
 *
 * Bewust een losse, pure module: "mag deze toets nú vuren?" is precies het
 * stukje dat stilletjes fout gaat (Delete midden in een zoekveld, Escape die
 * een dialoog én het leespaneel sluit) en het is niet te zien aan de UI. Zo is
 * het los te testen zonder DOM, en houdt `Webmail.tsx` alleen de bedrading.
 *
 * De handeling die eruit komt is opzettelijk abstract: de pagina bepaalt zelf
 * wat "verwijderen" betekent op de plek waar je staat (Prullenbak of niet) —
 * dezelfde afweging die de lintbalkknop maakt.
 */

/** Wat de pagina moet doen; de bedrading vertaalt dit naar de bestaande acties. */
export type MailShortcutAction =
  /** Delete/Backspace — hetzelfde als de prullenbakknop in de lintbalk. */
  | "trash"
  /** Shift+Delete in de Prullenbak — definitief weg (de pagina bevestigt). */
  | "delete-forever"
  /** U — gelezen/ongelezen wisselen. */
  | "toggle-read"
  /** E — afgehandeld/heropenen. */
  | "toggle-handled"
  /** Enter — de gemarkeerde mail openen. */
  | "open"
  /** Escape — selectie wissen, anders het leespaneel sluiten. */
  | "dismiss";

/** Het stukje `KeyboardEvent` waar de beslissing op leunt. */
export interface MailShortcutEvent {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** Ingedrukt gehouden toets. Herhalingen vuren niet — één Delete per druk. */
  repeat?: boolean;
}

export interface MailShortcutContext {
  /** De focus staat in een invoerveld, textarea of contenteditable. */
  editing: boolean;
  /** Er staat een dialoog, contextmenu of keuzelijst open. */
  dialogOpen: boolean;
  /** Het opstelvenster staat open. */
  composing: boolean;
  /** Er is minstens één doel: aangevinkte rijen, anders de geopende mail. */
  hasTargets: boolean;
  /** Staat de gebruiker in de Prullenbak? Bepaalt wat Shift+Delete betekent. */
  inTrash: boolean;
}

/**
 * Staat de focus in iets waar je in typt? Dan is élke sneltoets uit — anders
 * gooit een Delete in het zoekveld je mail weg in plaats van een letter.
 *
 * Neemt een losse vorm aan in plaats van een `Element`, zodat de regel zonder
 * DOM te testen is; `Webmail.tsx` geeft `event.target` door.
 */
export function isEditableTarget(
  el: { tagName?: string; isContentEditable?: boolean; getAttribute?: (name: string) => string | null } | null | undefined,
): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = (el.tagName || "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  // Rich-text-velden die `contenteditable` als attribuut zetten zonder dat de
  // property meegeeft (losse nodes in tests, oudere webviews).
  const attr = el.getAttribute?.("contenteditable");
  return attr === "" || attr === "true";
}

/**
 * De beslisregel. `null` = deze toets doet hier niets en mag gewoon
 * doorlopen naar de browser.
 */
export function resolveMailShortcut(
  e: MailShortcutEvent,
  ctx: MailShortcutContext,
): MailShortcutAction | null {
  // Ingedrukt houden mag geen reeks acties afvuren.
  if (e.repeat) return null;
  // Ctrl/Cmd/Alt zijn van de browser en van bestaande sneltoetsen (Ctrl+K).
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  // Typen wint altijd; daarna dialogen (die hebben hun eigen Escape en Enter);
  // daarna het opstelvenster, waar elke letter tekst is.
  if (ctx.editing) return null;
  if (ctx.dialogOpen) return null;
  if (ctx.composing) return null;

  const key = e.key;

  // Escape werkt ook zonder doelen: hij sluit het leespaneel.
  if (key === "Escape") return e.shiftKey ? null : "dismiss";

  if (!ctx.hasTargets) return null;

  if (key === "Delete" || key === "Backspace") {
    // Buiten de Prullenbak betekent Shift niets extra's: er valt daar niets
    // definitief te verwijderen, en stil "gewoon weggooien" is het veiligst.
    if (e.shiftKey) return ctx.inTrash ? "delete-forever" : "trash";
    return "trash";
  }

  // Letters alleen kaal — Shift+U is een hoofdletter, geen sneltoets.
  if (e.shiftKey) return null;
  if (key === "u" || key === "U") return "toggle-read";
  if (key === "e" || key === "E") return "toggle-handled";
  if (key === "Enter") return "open";

  return null;
}

/**
 * De toetsen zoals ze in een tooltip horen te staan. Los van i18n: dit zijn
 * toetsnamen, geen zinnen — `y_next.mail_shortcut_hint` plakt ze aan het label.
 */
export const MAIL_SHORTCUT_KEYS = {
  trash: "Delete",
  deleteForever: "Shift+Delete",
  toggleRead: "U",
  toggleHandled: "E",
  open: "Enter",
  dismiss: "Esc",
} as const;
