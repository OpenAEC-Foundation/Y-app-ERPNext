/**
 * Opmaak-editor voor het opstelvenster.
 *
 * Een `contentEditable` met een compacte werkbalk erboven. De uitvoering leunt
 * op `document.execCommand` — zie `lib/rich-text-commands.ts` voor waarom dat
 * (nog) de juiste keuze is en hoe het vervangbaar blijft. Alles wat naar binnen
 * of naar buiten gaat passeert `lib/mail-html.ts`, zodat er nooit ongefilterde
 * HTML in het bericht belandt.
 *
 * ── Drie dingen die niet vanzelf goed gaan ───────────────────────────────
 *
 * 1. **Cursor-sprong.** Een `contentEditable` dat bij elke toetsaanslag zijn
 *    `innerHTML` opnieuw krijgt toegewezen, zet de cursor terug naar het begin.
 *    Daarom houdt `lastEmitted` bij wat wij zelf naar buiten stuurden en wordt
 *    de inhoud alleen overschreven als de `value` van buitenaf écht anders is
 *    (nieuw concept, geopend antwoord) — niet bij het echo'en van eigen tekst.
 * 2. **Selectieverlies bij het klikken op een knop.** Een `mousedown` op de
 *    werkbalk haalt de focus uit het tekstvak en dan werkt `execCommand` op
 *    niets. Elke knop doet daarom `preventDefault()` op `mousedown`.
 * 3. **Plakken.** De browser plakt standaard de complete Word-/Outlook-HTML
 *    inclusief `mso-`-stijlen, `class`-namen en lege spans. Die route is hier
 *    afgesloten: we lezen het klembord zelf en plakken de opgeschoonde versie.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Indent, Outdent, Link2, Link2Off, Quote, Minus, Palette, RemoveFormatting,
  Heading1, Heading2, Pilcrow,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  resolveCommand, shortcutFor, normalizeBlockValue,
  TOGGLE_STATE_COMMANDS, TEXT_COLORS,
  type EditorCommandName,
} from "../../lib/rich-text-commands";
import {
  sanitizeEditorHtml, plainTextToHtml, normalizeLinkUrl, isHtmlEmpty,
} from "../../lib/mail-html";

/** Eén werkbalkknop; `hideOnMobile` houdt de balk op een telefoon één regel. */
interface ToolButton {
  name: EditorCommandName;
  icon: typeof Bold;
  labelKey: string;
  hideOnMobile?: boolean;
}

const INLINE_BUTTONS: ToolButton[] = [
  { name: "bold", icon: Bold, labelKey: "webmail.tt_bold" },
  { name: "italic", icon: Italic, labelKey: "webmail.tt_italic" },
  { name: "underline", icon: Underline, labelKey: "webmail.tt_underline" },
  { name: "strikethrough", icon: Strikethrough, labelKey: "webmail.tt_strikethrough", hideOnMobile: true },
];

const LIST_BUTTONS: ToolButton[] = [
  { name: "bulletList", icon: List, labelKey: "webmail.tt_bullet_list" },
  { name: "numberedList", icon: ListOrdered, labelKey: "webmail.tt_numbered_list" },
  { name: "outdent", icon: Outdent, labelKey: "webmail.tt_outdent", hideOnMobile: true },
  { name: "indent", icon: Indent, labelKey: "webmail.tt_indent", hideOnMobile: true },
];

const BLOCK_BUTTONS: ToolButton[] = [
  { name: "paragraph", icon: Pilcrow, labelKey: "webmail.tt_paragraph", hideOnMobile: true },
  { name: "heading1", icon: Heading1, labelKey: "webmail.tt_heading1" },
  { name: "heading2", icon: Heading2, labelKey: "webmail.tt_heading2" },
];

const EXTRA_BUTTONS: ToolButton[] = [
  { name: "quote", icon: Quote, labelKey: "webmail.tt_quote", hideOnMobile: true },
  { name: "horizontalRule", icon: Minus, labelKey: "webmail.tt_horizontal_rule", hideOnMobile: true },
];

const BTN_BASE =
  "p-1.5 rounded text-slate-600 hover:bg-slate-200 cursor-pointer disabled:opacity-40 disabled:cursor-default";
const BTN_ACTIVE = "bg-slate-300 text-slate-900";

export default function RichTextEditor({
  value, onChange, placeholder, className, ariaLabel, autoFocus,
}: {
  /** De HTML van het bericht. Verandert deze van buitenaf, dan herlaadt het vak. */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  /** Wat wij als laatste naar boven stuurden — zie punt 1 in de kop. */
  const lastEmitted = useRef<string>("");
  /** Staat er een Ctrl+Shift+V klaar? Gezet op keydown, gelezen bij het plakken. */
  const plainPaste = useRef(false);
  const [showColors, setShowColors] = useState(false);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [block, setBlock] = useState<"paragraph" | "heading1" | "heading2" | "quote">("paragraph");
  const [empty, setEmpty] = useState(true);

  /* Inhoud van buitenaf inladen — alleen als hij écht afwijkt. */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === lastEmitted.current) return;
    const clean = sanitizeEditorHtml(value || "");
    el.innerHTML = clean;
    lastEmitted.current = value || "";
    setEmpty(isHtmlEmpty(clean));
  }, [value]);

  useEffect(() => {
    if (autoFocus) editorRef.current?.focus();
  }, [autoFocus]);

  /*
   * Een druk op Enter hoort een `<p>` op te leveren, geen `<div>`.
   * Zonder deze vlag maakt Chrome `<div>`-blokken en komt er `<div>`-soep bij
   * de ontvanger aan, zonder de alinea-marges die `toEmailHtml` op `<p>` zet.
   * Eén keer per document zetten volstaat; oudere browsers negeren hem.
   */
  useEffect(() => {
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* niet ondersteund */ }
  }, []);

  /** Leest de huidige inhoud uit en meldt hem één laag hoger. */
  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    // Leeg is écht leeg: een achtergebleven `<br>` of `<p><br></p>` mag geen
    // concept opleveren en geen mail met een lege regel.
    const next = isHtmlEmpty(html) ? "" : html;
    lastEmitted.current = next;
    setEmpty(next === "");
    onChange(next);
  }, [onChange]);

  /** Welke knoppen horen op dit moment op te lichten? */
  const syncState = useCallback(() => {
    if (typeof document === "undefined" || !document.queryCommandState) return;
    const next: Record<string, boolean> = {};
    for (const [name, command] of Object.entries(TOGGLE_STATE_COMMANDS)) {
      try { next[name] = document.queryCommandState(command as string); } catch { /* niet ondersteund */ }
    }
    setActive(next);
    try { setBlock(normalizeBlockValue(document.queryCommandValue("formatBlock") as string)); }
    catch { /* niet ondersteund */ }
  }, []);

  /**
   * Voert een commando uit op de selectie.
   *
   * `styleWithCSS` staat aan: zonder die vlag levert `foreColor` een
   * `<font color=…>`-tag op, en dat is verouderde HTML die onze
   * verzend-sanitizer alsnog moet omzetten. Met de vlag komt er meteen een
   * `<span style="color:…">` uit — precies wat de mail nodig heeft.
   */
  const run = useCallback((name: EditorCommandName, arg?: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    try { document.execCommand("styleWithCSS", false, "true"); } catch { /* oudere browser */ }
    for (const step of resolveCommand(name, arg)) {
      try { document.execCommand(step.command, false, step.value); } catch { /* niet ondersteund */ }
    }
    emit();
    syncState();
  }, [emit, syncState]);

  /** Voegt HTML in op de cursor, altijd via het filter. */
  const insertHtml = useCallback((html: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    try { document.execCommand("insertHTML", false, sanitizeEditorHtml(html)); }
    catch { /* niet ondersteund */ }
    emit();
  }, [emit]);

  /**
   * Link maken of bijwerken.
   *
   * Staat de cursor al in een link, dan is dat de voorgestelde URL — "link
   * bewerken" en "link maken" zijn dezelfde knop, zoals in elke mailclient.
   * Een lege invoer haalt de link weg in plaats van een lege `href` te zetten.
   */
  const editLink = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    let current = "";
    let anchor: HTMLAnchorElement | null = null;
    if (selection && selection.anchorNode) {
      const start = selection.anchorNode instanceof Element
        ? selection.anchorNode
        : selection.anchorNode.parentElement;
      anchor = start?.closest("a") ?? null;
      if (anchor) current = anchor.getAttribute("href") || "";
    }
    const typed = window.prompt(t("webmail.link_prompt"), current);
    if (typed === null) return;
    if (!typed.trim()) {
      if (anchor) run("unlink");
      return;
    }
    const url = normalizeLinkUrl(typed);
    if (!url) { window.alert(t("webmail.link_invalid")); return; }
    // Staat de cursor in een bestaande link zonder selectie, dan zou
    // `createLink` niets doen — dan passen we het anker rechtstreeks aan.
    if (anchor && selection?.isCollapsed) {
      anchor.setAttribute("href", url);
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
      emit();
      return;
    }
    if (selection?.isCollapsed) {
      // Niets geselecteerd en geen bestaande link: voeg de URL als tekst in,
      // anders zou er een onzichtbare lege link ontstaan.
      insertHtml(`<a href="${url}">${url.replace(/^mailto:/, "")}</a>`);
      return;
    }
    try { document.execCommand("createLink", false, url); } catch { /* niet ondersteund */ }
    emit();
  }, [emit, insertHtml, run, t]);

  /* ─── Plakken ─── */

  const pasteFromClipboard = useCallback((data: DataTransfer, plainOnly: boolean) => {
    const html = plainOnly ? "" : data.getData("text/html");
    const text = data.getData("text/plain");
    if (html) insertHtml(html);
    else if (text) insertHtml(plainTextToHtml(text));
  }, [insertHtml]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!e.clipboardData) return;
    e.preventDefault();
    const plainOnly = plainPaste.current;
    plainPaste.current = false;
    pasteFromClipboard(e.clipboardData, plainOnly);
  }, [pasteFromClipboard]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const action = shortcutFor(e);
    if (!action) return;
    if (action === "plainPaste") {
      // De browser levert bij Ctrl+Shift+V nog gewoon `text/html` op het
      // klembord; het onderscheid moet dus van de toetsaanslag komen. Het
      // plak-event zelf draagt geen shift-vlag in React, vandaar deze vlag.
      // De standaardafhandeling gaat door: die vuurt het `paste`-event.
      plainPaste.current = true;
      return;
    }
    e.preventDefault();
    if (action === "link") { editLink(); return; }
    run(action);
  }, [editLink, run]);

  const toolButton = (btn: ToolButton) => {
    const Icon = btn.icon;
    const isActive = active[btn.name] === true
      || (btn.name === "heading1" && block === "heading1")
      || (btn.name === "heading2" && block === "heading2")
      || (btn.name === "quote" && block === "quote");
    return (
      <button key={btn.name} type="button" tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run(btn.name)}
        title={t(btn.labelKey)}
        aria-label={t(btn.labelKey)}
        aria-pressed={isActive}
        className={`${BTN_BASE} ${isActive ? BTN_ACTIVE : ""} ${btn.hideOnMobile ? "hidden md:inline-flex" : "inline-flex"}`}>
        <Icon size={14} />
      </button>
    );
  };

  const divider = (key: string) => (
    <span key={key} className="hidden md:inline-block w-px h-4 bg-slate-300 mx-0.5" />
  );

  return (
    <div className={`flex flex-col min-h-0 ${className || ""}`}>
      <div role="toolbar" aria-label={t("webmail.formatting_toolbar")}
        className="flex items-center flex-wrap gap-0.5 px-2 py-1 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        {INLINE_BUTTONS.map(toolButton)}
        {divider("d1")}
        {LIST_BUTTONS.map(toolButton)}
        {divider("d2")}
        {BLOCK_BUTTONS.map(toolButton)}

        {/* Tekstkleur — een klein palet in plaats van een volledige kiezer. */}
        <span className="relative inline-flex">
          <button type="button" tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowColors((v) => !v)}
            title={t("webmail.tt_text_color")}
            aria-label={t("webmail.tt_text_color")}
            aria-expanded={showColors}
            className={`${BTN_BASE} inline-flex ${showColors ? BTN_ACTIVE : ""}`}>
            <Palette size={14} />
          </button>
          {showColors && (
            <span className="absolute z-30 top-full left-0 mt-1 flex gap-1 p-1.5 rounded border border-slate-200 bg-white shadow-lg">
              {TEXT_COLORS.map((c) => (
                <button key={c.value} type="button" tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { run("color", c.value); setShowColors(false); }}
                  title={t(c.labelKey)} aria-label={t(c.labelKey)}
                  style={{ backgroundColor: c.value }}
                  className="w-5 h-5 rounded border border-slate-300 cursor-pointer" />
              ))}
            </span>
          )}
        </span>

        {divider("d3")}
        <button type="button" tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()} onClick={editLink}
          title={t("webmail.tt_insert_link")} aria-label={t("webmail.tt_insert_link")}
          className={`${BTN_BASE} inline-flex`}>
          <Link2 size={14} />
        </button>
        <button type="button" tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()} onClick={() => run("unlink")}
          title={t("webmail.tt_remove_link")} aria-label={t("webmail.tt_remove_link")}
          className={`${BTN_BASE} hidden md:inline-flex`}>
          <Link2Off size={14} />
        </button>
        {EXTRA_BUTTONS.map(toolButton)}
        {divider("d4")}
        <button type="button" tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()} onClick={() => run("clearFormatting")}
          title={t("webmail.tt_clear_formatting")} aria-label={t("webmail.tt_clear_formatting")}
          className={`${BTN_BASE} inline-flex`}>
          <RemoveFormatting size={14} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        {empty && placeholder && (
          <span aria-hidden="true"
            className="absolute left-4 top-3 text-sm text-slate-400 pointer-events-none select-none">
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel || t("webmail.editor_placeholder")}
          tabIndex={0}
          onInput={emit}
          onBlur={emit}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onKeyUp={syncState}
          onMouseUp={syncState}
          onFocus={syncState}
          className="h-full w-full overflow-auto px-4 py-3 text-sm text-slate-800 focus:outline-none
            [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
            [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold
            [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600
            [&_a]:text-blue-600 [&_a]:underline [&_hr]:my-3 [&_hr]:border-slate-300
            [&_img]:max-w-full [&_table]:border-collapse"
        />
      </div>
    </div>
  );
}
