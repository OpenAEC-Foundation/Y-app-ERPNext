/**
 * De commandolaag van de opmaak-editor — puur, dus testbaar zonder browser.
 *
 * ── Waarom `document.execCommand` ────────────────────────────────────────
 *
 * `execCommand` is officieel *deprecated*. Toch is het hier de juiste keuze:
 * het is de enige API die in élke browser vandaag een selectie kan omzetten
 * naar vet/cursief/lijst *met* een werkende ongedaan-maken-geschiedenis. Het
 * alternatief — zelf `Range`-manipulatie schrijven — is honderden regels
 * randgevallen (gedeeltelijk geselecteerde lijstitems, tabellen, samengestelde
 * tekstinvoer) waar we niets aan verdienen. De bekende vervanger, een
 * volwaardige editor-bibliotheek (ProseMirror/TipTap/Lexical), is een zware
 * afhankelijkheid voor een opstelvenster.
 *
 * De vervangbaarheid zit hierin: de UI kent alleen de namen uit
 * `EditorCommandName` en vraagt via `resolveCommand` welke stappen erbij
 * horen. Wie `execCommand` ooit wil vervangen, herschrijft alleen de uitvoerder
 * in `RichTextEditor.tsx` — de knoppen, de sneltoetsen en de tests blijven
 * staan. Daarom staat er ook nergens anders in de app een `execCommand`-naam
 * hardgecodeerd.
 */

/** Alles wat de werkbalk en de sneltoetsen kunnen aanroepen. */
export type EditorCommandName =
  | "bold" | "italic" | "underline" | "strikethrough"
  | "bulletList" | "numberedList" | "indent" | "outdent"
  | "paragraph" | "heading1" | "heading2"
  | "quote" | "horizontalRule"
  | "clearFormatting" | "unlink" | "color";

/** Eén `execCommand`-aanroep. Bewust datavorm, geen functie: zo is hij te testen. */
export interface ExecStep {
  command: string;
  value?: string;
}

/**
 * De stappen die bij een commando horen.
 *
 * Sommige commando's zijn er meer dan één. "Opmaak wissen" bijvoorbeeld:
 * `removeFormat` haalt vet/cursief/kleur weg maar laat een kop, een citaat en
 * een link staan — precies de drie dingen waar iemand die "wis de opmaak van
 * dit geplakte stuk" bedoelt vanaf wil. Vandaar drie stappen op een rij.
 */
export function resolveCommand(name: EditorCommandName, arg?: string): ExecStep[] {
  switch (name) {
    case "bold": return [{ command: "bold" }];
    case "italic": return [{ command: "italic" }];
    case "underline": return [{ command: "underline" }];
    case "strikethrough": return [{ command: "strikeThrough" }];
    case "bulletList": return [{ command: "insertUnorderedList" }];
    case "numberedList": return [{ command: "insertOrderedList" }];
    case "indent": return [{ command: "indent" }];
    case "outdent": return [{ command: "outdent" }];
    case "paragraph": return [{ command: "formatBlock", value: "<p>" }];
    case "heading1": return [{ command: "formatBlock", value: "<h1>" }];
    case "heading2": return [{ command: "formatBlock", value: "<h2>" }];
    case "quote": return [{ command: "formatBlock", value: "<blockquote>" }];
    case "horizontalRule": return [{ command: "insertHorizontalRule" }];
    case "unlink": return [{ command: "unlink" }];
    case "clearFormatting":
      return [
        { command: "removeFormat" },
        { command: "unlink" },
        { command: "formatBlock", value: "<p>" },
      ];
    case "color":
      // Zonder kleur is dit geen commando; de aanroeper hoort een kleur te
      // kiezen. Een lege lijst is veiliger dan `foreColor` met `undefined`,
      // wat in sommige browsers de tekst zwart maakt.
      return arg ? [{ command: "foreColor", value: arg }] : [];
    default:
      return [];
  }
}

/**
 * De `execCommand`-namen waarvan `queryCommandState` een zinnige aan/uit geeft
 * — dat zijn de knoppen die actief oplichten als de cursor in vette tekst staat.
 * `formatBlock`-commando's zitten er niet bij: die vragen we op met
 * `queryCommandValue`.
 */
export const TOGGLE_STATE_COMMANDS: Partial<Record<EditorCommandName, string>> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikethrough: "strikeThrough",
  bulletList: "insertUnorderedList",
  numberedList: "insertOrderedList",
};

/**
 * Het tekstkleurenpalet. Bewust klein: een volledige kleurkiezer levert
 * onleesbare mails (lichtgeel op wit) en past niet bij een zakelijke
 * huisstijl. Deze zeven zijn allemaal leesbaar op wit én op de lichtgrijze
 * achtergrond die sommige mailclients gebruiken.
 */
export const TEXT_COLORS: { value: string; labelKey: string }[] = [
  { value: "#0f172a", labelKey: "webmail.color_default" },
  { value: "#475569", labelKey: "webmail.color_grey" },
  { value: "#b91c1c", labelKey: "webmail.color_red" },
  { value: "#c2410c", labelKey: "webmail.color_orange" },
  { value: "#15803d", labelKey: "webmail.color_green" },
  { value: "#1d4ed8", labelKey: "webmail.color_blue" },
  { value: "#7e22ce", labelKey: "webmail.color_purple" },
];

/** De toetsaanslag zoals de editor hem beoordeelt. */
export interface KeyChord {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/**
 * Welke actie hoort bij deze toetsaanslag?
 *
 * `"link"` en `"plainPaste"` staan er los in omdat ze geen `execCommand`-stap
 * zijn maar een dialoog respectievelijk een klembordbewerking openen.
 * Alt erbij → niets: dat zijn de toetscombinaties van het besturingssysteem
 * en van schermlezers, die moeten we niet afvangen.
 */
export function shortcutFor(chord: KeyChord): EditorCommandName | "link" | "plainPaste" | null {
  const mod = Boolean(chord.ctrlKey || chord.metaKey);
  if (!mod || chord.altKey) return null;
  const key = (chord.key || "").toLowerCase();
  if (chord.shiftKey) {
    if (key === "v") return "plainPaste";
    if (key === "x") return "strikethrough";
    return null;
  }
  switch (key) {
    case "b": return "bold";
    case "i": return "italic";
    case "u": return "underline";
    case "k": return "link";
    default: return null;
  }
}

/**
 * Het blokniveau van de huidige selectie, afgeleid uit wat
 * `queryCommandValue("formatBlock")` teruggeeft.
 *
 * Browsers zijn het hier niet over eens: Chrome geeft `"h2"`, Firefox
 * `"heading"` of `"H2"`, Safari soms `""`. Deze normalisatie is precies het
 * soort ding dat je één keer wilt opschrijven en daarna wilt testen.
 */
export function normalizeBlockValue(raw: string): "paragraph" | "heading1" | "heading2" | "quote" {
  const value = (raw || "").trim().toLowerCase().replace(/[<>]/g, "");
  if (value === "h1") return "heading1";
  if (value === "h2" || value === "h3") return "heading2";
  if (value === "blockquote") return "quote";
  return "paragraph";
}
