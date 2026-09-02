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

/** Waar de cursor staat, voor zover Tab er iets aan heeft. */
export interface IndentContext {
  /** Staat de cursor in een lijstitem? Dan gaat het item een niveau diep(er). */
  inList: boolean;
  /** Is het blok waar de cursor in staat al ingesprongen? */
  indented: boolean;
}

/**
 * Wat doet Tab in het tekstvak?
 *
 * Tab hoort in een opsteller een *inspringing* te zijn, niet een sprong naar
 * het volgende veld — dat is wat elke mailclient en elke tekstverwerker doet,
 * en het is wat de gebruiker bedoelt als hij in een alinea Tab indrukt. De
 * aanroeper hoort daarom `preventDefault()` te doen zodra hier iets uit komt.
 *
 * **Eén commando voor twee situaties.** Binnen een opsomming of genummerde
 * lijst zet de browser het lijstitem met `indent` een niveau dieper (een
 * geneste `<ul>`/`<ol>`), buiten een lijst wikkelt hij de alinea in een blok
 * met een linkermarge. Dat is precies het onderscheid dat de gebruiker
 * verwacht, en het is dezelfde weg als de in-/uitspringknoppen in de werkbalk
 * — dus geen aparte tak, geen `\t` (die valt in HTML weg) en geen rij
 * `&nbsp;`. Beide uitkomsten overleven `toEmailHtml` mét hun inspringing;
 * daar staan tests op.
 *
 * **Shift+Tab kijkt wél naar de context, en daar zit een afweging.** Als
 * Shift+Tab er altijd `outdent` van zou maken, dan vangt het tekstvak élke Tab
 * af en is het een doodlopende straat: je komt er met het toetsenbord nooit
 * meer uit richting Verzenden, en de enige uitweg zou Escape zijn — die het
 * hele venster sluit. Daarom: staat de cursor in een lijst of in een al
 * ingesprongen blok, dan springt Shift+Tab uit (dát bedoelde de gebruiker);
 * staat hij in een gewone, niet-ingesprongen alinea, dan valt er niets uit te
 * springen en mag de focus gewoon naar het vorige element in het venster —
 * de werkbalk. Zo blijft het venster volledig met het toetsenbord te bedienen
 * zonder dat Tab ooit ongevraagd wegspringt.
 *
 * Ctrl/Cmd/Alt erbij → niets: dat zijn de toetscombinaties waarmee de browser
 * en het besturingssysteem van venster of tabblad wisselen.
 */
export function tabCommand(chord: KeyChord, ctx: IndentContext): "indent" | "outdent" | null {
  if (chord.key !== "Tab") return null;
  if (chord.ctrlKey || chord.metaKey || chord.altKey) return null;
  if (!chord.shiftKey) return "indent";
  return ctx.inList || ctx.indented ? "outdent" : null;
}

/**
 * Nieuwe actieve knop in de werkbalk na een pijltoets. `null` = deze toets
 * gaat niet over de werkbalk en mag doorlopen.
 *
 * De werkbalk is bewust **één** tab-stop (het "roving tabindex"-patroon uit
 * de ARIA-praktijk): vijftien opmaakknoppen los in de tab-volgorde zouden
 * betekenen dat je vijftien keer Tab moet drukken om van het onderwerp naar
 * het tekstvak te komen. Binnen de balk stuur je met de pijltjes, rondlopend
 * — hetzelfde als in de suggestielijst van het adresveld.
 */
export function toolbarRovingIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
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
