/**
 * HTML-hygiëne voor het opstelvenster: opschonen bij plakken, klaarmaken bij
 * verzenden.
 *
 * Twee functies dragen deze module:
 *
 * - `sanitizeEditorHtml` — alles wat de *editor* binnenkomt (geplakte Word- of
 *   Outlook-rommel, een hersteld concept uit localStorage) passeert dit filter
 *   vóór het in het `contentEditable` belandt.
 * - `toEmailHtml` — wat de *ontvanger* krijgt: dezelfde whitelist, plus inline
 *   styles op elk structuurelement en een omhullende `div` met het basislettertype.
 *
 * ── Waarom een eigen tokenizer en niet `DOMParser` ────────────────────────
 *
 * Deze module is puur en DOM-loos, om drie redenen:
 *
 * 1. Ze is dan met `node --test` te testen (de frontend-testsuite draait zonder
 *    jsdom — zie CLAUDE.md). Een sanitizer zonder tests is een sanitizer die
 *    stilletjes lek raakt.
 * 2. `DOMParser`/`innerHTML` voert bij het *parsen* al `<img onerror>` uit in
 *    sommige contexten; een tekstuele pijplijn raakt nooit een live document.
 * 3. Dezelfde code draait in de browser én in een verzend-/testscript.
 *
 * Het is bewust géén losse regex-vervanging maar een echte scanner met een
 * tag-stack: een whitelist die per token beslist, sluit-tags die matchen op de
 * stack, en aan het eind alles netjes dichtgezet. Onbekende tags worden
 * *uitgepakt* (inhoud blijft, tag verdwijnt) behalve de gevaarlijke, die met
 * inhoud en al sneuvelen.
 *
 * ── Wat er gegarandeerd niet doorheen komt ───────────────────────────────
 *
 * `<script>`, `<style>`, `<iframe>`, `<object>`, `<form>` (inclusief hun
 * inhoud), élk `on*`-attribuut, `javascript:`-URL's (ook met entities of
 * tabs verstopt), `data:`-URL's behalve afbeeldingen, `class`/`id`, en elke
 * CSS-declaratie buiten de eigenschappen-whitelist (dus ook `url(...)`,
 * `expression(...)` en `@import`). Dat wordt afgedekt door tests.
 */

/* ─── Tags ─── */

/** Tags zonder sluittag. */
const VOID_TAGS = new Set(["br", "hr", "img", "wbr", "col"]);

/**
 * Weg mét inhoud. Niet uitpakken: de inhoud is code of metadata, geen tekst
 * die de gebruiker bedoelde te plakken. `style` staat hier zodat een geplakte
 * Word-stylesheet niet als zichtbare CSS-tekst in het bericht belandt.
 */
const DROP_SUBTREE = new Set([
  "script", "style", "title", "textarea", "noscript", "iframe", "object",
  "embed", "applet", "head", "meta", "link", "base", "form", "input",
  "button", "select", "option", "frame", "frameset", "svg", "math", "canvas",
  "audio", "video", "source", "track", "template", "xml",
]);

/**
 * Wat overblijft na het filter. Bewust ruim genoeg voor geplakte tabellen en
 * handtekeningen (mailclients gebruiken tabellen voor lay-out), maar zonder
 * één element dat script kan uitvoeren of buiten het bericht kan reiken.
 */
const ALLOWED_TAGS = new Set([
  "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "strike",
  "del", "ins", "mark", "small", "sub", "sup", "ul", "ol", "li", "blockquote",
  "a", "h1", "h2", "h3", "h4", "hr", "pre", "code", "table", "thead", "tbody",
  "tfoot", "tr", "td", "th", "caption", "colgroup", "col", "img", "dl", "dt",
  "dd", "figure", "figcaption",
]);

/** Attributen die op élk toegestaan element mogen blijven staan. */
const GLOBAL_ATTRS = new Set(["style", "dir", "lang", "title"]);

/** Extra attributen per tag. Alles wat hier niet staat, valt weg. */
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
  table: new Set(["border", "cellpadding", "cellspacing", "align", "width", "bgcolor"]),
  td: new Set(["colspan", "rowspan", "align", "valign", "width", "height", "bgcolor"]),
  th: new Set(["colspan", "rowspan", "align", "valign", "width", "height", "bgcolor", "scope"]),
  tr: new Set(["align", "valign", "bgcolor"]),
  col: new Set(["span", "width"]),
  colgroup: new Set(["span", "width"]),
  ol: new Set(["start", "type"]),
  ul: new Set(["type"]),
  li: new Set(["value"]),
};

/**
 * CSS-eigenschappen die een declaratie mag dragen. Alles daarbuiten (inclusief
 * elke `mso-*`-eigenschap uit Word, `position`, `behavior` en `-moz-binding`)
 * verdwijnt. De whitelist is de beveiliging: een blacklist van "gevaarlijke"
 * eigenschappen loopt altijd achter op de browser.
 */
const ALLOWED_CSS_PROPS = new Set([
  "color", "background-color", "font", "font-weight", "font-style", "font-size",
  "font-family", "font-variant", "text-decoration", "text-decoration-line",
  "text-align", "text-indent", "text-transform", "letter-spacing", "line-height",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-collapse", "border-color", "border-width", "border-style", "border-radius",
  "list-style", "list-style-type", "list-style-position",
  "vertical-align", "white-space", "word-break", "overflow-wrap", "word-wrap",
  "width", "height", "max-width", "min-width", "display",
]);

/** Waarden met deze patronen zijn nooit veilig, ongeacht de eigenschap. */
const UNSAFE_CSS_VALUE = /url\s*\(|expression\s*\(|javascript\s*:|@import|behavior\s*:|[<>\\]/i;

/** `<font size="N">` naar een bruikbare pixelgrootte. */
const FONT_SIZE_PX: Record<string, string> = {
  "1": "10px", "2": "13px", "3": "14px", "4": "16px", "5": "20px", "6": "24px", "7": "32px",
};

/* ─── Entities ─── */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

/**
 * Decodeert entities *alleen* om een URL te kunnen beoordelen. Het resultaat
 * wordt nooit teruggeschreven — `&#106;avascript:` moet als `javascript:`
 * herkend worden, maar de output houdt de originele tekst (of niets).
 */
function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);?/gi, (match, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[lower] ?? match;
  });
}

/** Escapet tekst voor gebruik in een HTML-body. */
export function escapeHtml(text: string): string {
  return (text || "").replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

/** Escapet een waarde voor gebruik binnen dubbele aanhalingstekens. */
function escapeAttr(value: string): string {
  return value.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;");
}

/* ─── URL's ─── */

/** Schema's die een link mag hebben. `cid:` hoort erbij voor inline afbeeldingen. */
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel", "cid", "ftp"]);

/**
 * Is deze URL veilig genoeg om te laten staan?
 *
 * De beoordeling gebeurt op de gedecodeerde, van witruimte en stuurtekens
 * ontdane variant: `java&#9;script:alert(1)` en ` javascript :` moeten allebei
 * als `javascript:` herkend worden. Alleen `data:image/*` mag door (geplakte
 * screenshots), en dan niet als SVG — dat is een scriptbaar document.
 */
export function isSafeUrl(raw: string, options: { allowDataImage?: boolean } = {}): boolean {
  const probe = decodeEntities(String(raw || ""))
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0020\u007f]/g, "")
    .toLowerCase();
  if (!probe) return false;
  const scheme = probe.match(/^([a-z][a-z0-9+.-]*):/);
  if (!scheme) return true; // relatief of protocol-relatief: geen schema, geen risico
  if (scheme[1] === "data") {
    if (!options.allowDataImage) return false;
    return probe.startsWith("data:image/") && !probe.startsWith("data:image/svg");
  }
  return SAFE_SCHEMES.has(scheme[1]);
}

/**
 * Maakt van wat een gebruiker in het link-dialoogvenster tikt een bruikbare
 * URL, of `null` als het geen link kan zijn.
 *
 * `open-aec.com` → `https://open-aec.com`, `piet@x.nl` → `mailto:piet@x.nl`.
 * Een `javascript:`-URL komt er nooit uit: dat is geen typefout die je voor de
 * gebruiker "repareert", dat is een aanval.
 */
export function normalizeLinkUrl(input: string): string | null {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;
  if (/\s/.test(trimmed) && !/^(mailto|https?):/i.test(trimmed)) return null;
  if (!isSafeUrl(trimmed)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `mailto:${trimmed}`;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (!/^[^\s/]+\.[^\s/]/.test(trimmed)) return null; // "hallo" is geen domein
  return `https://${trimmed}`;
}

/* ─── Tokenizer ─── */

interface Attr { name: string; value: string }

type Token =
  | { kind: "text"; text: string }
  | { kind: "open"; name: string; attrs: Attr[]; selfClose: boolean }
  | { kind: "close"; name: string };

const TAG_START = /^<\/?([a-z][a-z0-9]*(?::[a-z][a-z0-9]*)?)/i;

/**
 * Splitst HTML in tekst-, open- en sluittokens.
 *
 * Een `<` die geen geldige tag begint, is tekst — dan wordt hij als `&lt;`
 * teruggegeven in plaats van als tagbegin geïnterpreteerd. Commentaar
 * (inclusief Word's `<!--[if gte mso 9]>`-blokken), doctypes en CDATA vallen
 * volledig weg.
 */
function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const src = String(html || "");
  let i = 0;
  let text = "";
  const flush = () => {
    if (text) { tokens.push({ kind: "text", text }); text = ""; }
  };

  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) { text += src.slice(i); break; }
    text += src.slice(i, lt);

    const rest = src.slice(lt);
    if (rest.startsWith("<!--")) {
      const end = src.indexOf("-->", lt + 4);
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    if (rest.startsWith("<!") || rest.startsWith("<?")) {
      const end = src.indexOf(">", lt + 2);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    const match = TAG_START.exec(rest);
    if (!match) { text += "&lt;"; i = lt + 1; continue; }

    const name = match[1].toLowerCase();
    const isClose = rest[1] === "/";
    // Zoek het sluitende ">", maar sla er één over die binnen een
    // aanhalingsteken staat (`title="a > b"`).
    let j = lt + match[0].length;
    let quote: string | null = null;
    while (j < src.length) {
      const ch = src[j];
      if (quote) { if (ch === quote) quote = null; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === ">") break;
      j += 1;
    }
    const inner = src.slice(lt + match[0].length, j);
    i = j < src.length ? j + 1 : src.length;

    flush();
    if (isClose) { tokens.push({ kind: "close", name }); continue; }
    tokens.push({
      kind: "open",
      name,
      attrs: parseAttrs(inner),
      selfClose: /\/\s*$/.test(inner) || VOID_TAGS.has(name),
    });
  }
  flush();
  return tokens;
}

const ATTR_RE = /([a-z_:][-a-z0-9_:.]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/gi;

function parseAttrs(inner: string): Attr[] {
  const out: Attr[] = [];
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(inner))) {
    const raw = m[2] ?? "";
    const value = raw.startsWith('"') || raw.startsWith("'") ? raw.slice(1, -1) : raw;
    out.push({ name: m[1].toLowerCase(), value });
  }
  return out;
}

/* ─── Attribuut- en stijl-filter ─── */

/**
 * Filtert een `style`-attribuut op de eigenschappen-whitelist.
 * Geeft "" terug als er niets veiligs overblijft — de aanroeper laat het
 * attribuut dan helemaal weg in plaats van een lege `style=""` te schrijven.
 */
export function sanitizeStyle(style: string): string {
  const kept: string[] = [];
  for (const decl of String(style || "").split(";")) {
    const idx = decl.indexOf(":");
    if (idx <= 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!prop || !value) continue;
    if (!ALLOWED_CSS_PROPS.has(prop)) continue;
    if (UNSAFE_CSS_VALUE.test(value)) continue;
    kept.push(`${prop}:${value}`);
  }
  return kept.join(";");
}

interface CleanTag { name: string; attrs: Attr[] }

/**
 * Zet een open-tag om naar zijn opgeschoonde vorm, of `null` als de tag
 * uitgepakt moet worden (inhoud blijft, tag verdwijnt).
 *
 * `<font>` wordt hier een `<span>` met inline stijl: Word en oudere
 * mailclients leveren `<font color=…>`, en dat is verouderde HTML die we niet
 * willen doorsturen, maar de *kleur* wilde de gebruiker wél.
 */
function cleanTag(name: string, attrs: Attr[], allowDataImage: boolean): CleanTag | null {
  if (name === "font") {
    const parts: string[] = [];
    for (const a of attrs) {
      if (a.name === "color" && /^[#a-z0-9(),.%\s]+$/i.test(a.value)) parts.push(`color:${a.value.trim()}`);
      if (a.name === "face" && !UNSAFE_CSS_VALUE.test(a.value)) parts.push(`font-family:${a.value.trim()}`);
      if (a.name === "size" && FONT_SIZE_PX[a.value.trim()]) parts.push(`font-size:${FONT_SIZE_PX[a.value.trim()]}`);
      if (a.name === "style") { const s = sanitizeStyle(a.value); if (s) parts.push(s); }
    }
    const style = sanitizeStyle(parts.join(";"));
    return style ? { name: "span", attrs: [{ name: "style", value: style }] } : null;
  }
  if (!ALLOWED_TAGS.has(name)) return null;

  const extra = TAG_ATTRS[name];
  const kept: Attr[] = [];
  for (const a of attrs) {
    if (a.name.startsWith("on") || a.name.startsWith("data-") || a.name.startsWith("xmlns")) continue;
    if (!GLOBAL_ATTRS.has(a.name) && !(extra && extra.has(a.name))) continue;
    if (a.name === "style") {
      const style = sanitizeStyle(a.value);
      if (style) kept.push({ name: "style", value: style });
      continue;
    }
    if (a.name === "href" || a.name === "src") {
      if (!isSafeUrl(a.value, { allowDataImage: allowDataImage && a.name === "src" })) continue;
      kept.push({ name: a.name, value: a.value.trim() });
      continue;
    }
    kept.push({ name: a.name, value: a.value });
  }
  // Een `span` zonder één overgebleven attribuut draagt niets bij; uitpakken
  // haalt precies de "lege span"-rommel weg die Word en Outlook produceren.
  if (name === "span" && kept.length === 0) return null;
  if (name === "a" && !kept.some((a) => a.name === "href")) return null;
  if (name === "a") {
    // Een link uit een mail hoort in een nieuw venster te openen, en
    // `noopener` voorkomt dat de doelpagina bij het venster van de mail kan.
    if (!kept.some((a) => a.name === "target")) kept.push({ name: "target", value: "_blank" });
    const rel = kept.find((a) => a.name === "rel");
    if (rel) rel.value = "noopener noreferrer";
    else kept.push({ name: "rel", value: "noopener noreferrer" });
  }
  return { name, attrs: kept };
}

function serializeOpen(tag: CleanTag): string {
  const attrs = tag.attrs.map((a) => ` ${a.name}="${escapeAttr(a.value)}"`).join("");
  return `<${tag.name}${attrs}>`;
}

/* ─── De sanitizer ─── */

interface SanitizeOptions {
  /** Laat `data:image/...`-bronnen op `<img>` staan (geplakte screenshots). */
  allowDataImage?: boolean;
  /** Standaard inline stijl per tag; bestaande `style` wint (staat erachter). */
  defaultStyles?: Record<string, string>;
}

function sanitize(html: string, options: SanitizeOptions = {}): string {
  const tokens = tokenize(html);
  const out: string[] = [];
  /** Open elementen; `emitted` = of er een sluittag geschreven moet worden. */
  const stack: { name: string; emitted: string | null }[] = [];
  /** > 0 zolang we binnen een subtree zitten die volledig weg moet. */
  let dropDepth = 0;
  let dropTag = "";

  for (const token of tokens) {
    if (dropDepth > 0) {
      if (token.kind === "open" && token.name === dropTag && !token.selfClose) dropDepth += 1;
      else if (token.kind === "close" && token.name === dropTag) dropDepth -= 1;
      continue;
    }

    if (token.kind === "text") { out.push(token.text); continue; }

    if (token.kind === "open") {
      const { name } = token;
      // Word/Outlook-namespaces (`<w:sdt>`, `<v:shape>`) dragen geen tekst die
      // de gebruiker bedoelde; `<o:p>` wél (een lege alinea) — die pakken we uit.
      if (DROP_SUBTREE.has(name) || (name.includes(":") && name !== "o:p")) {
        if (!token.selfClose) { dropDepth = 1; dropTag = name; }
        continue;
      }
      const clean = cleanTag(name, token.attrs, options.allowDataImage === true);
      if (!clean) {
        if (!token.selfClose) stack.push({ name, emitted: null });
        continue;
      }
      const def = options.defaultStyles?.[clean.name];
      if (def) {
        const existing = clean.attrs.find((a) => a.name === "style");
        // Standaard eerst, eigen stijl erna: bij gelijke eigenschap wint de
        // laatste declaratie, dus wat de gebruiker zelf instelde blijft staan.
        if (existing) existing.value = `${def};${existing.value}`;
        else clean.attrs.unshift({ name: "style", value: def });
      }
      out.push(serializeOpen(clean));
      if (!token.selfClose && !VOID_TAGS.has(clean.name)) {
        stack.push({ name, emitted: clean.name });
      }
      continue;
    }

    // Sluittag: zoek het bijbehorende open element en sluit alles ertussen.
    const idx = stack.map((s) => s.name).lastIndexOf(token.name);
    if (idx === -1) continue; // sluittag zonder opening: negeren
    for (let k = stack.length - 1; k >= idx; k -= 1) {
      const entry = stack[k];
      if (entry.emitted) out.push(`</${entry.emitted}>`);
    }
    stack.length = idx;
  }

  for (let k = stack.length - 1; k >= 0; k -= 1) {
    const entry = stack[k];
    if (entry.emitted) out.push(`</${entry.emitted}>`);
  }
  return out.join("");
}

/**
 * Schoont HTML op voor gebruik in het opstelvenster.
 *
 * Dit is het filter voor élke HTML die de editor binnenkomt: geplakte tekst
 * uit Word/Outlook/een webpagina en een hersteld concept uit localStorage.
 * Structuur (alinea's, lijsten, links, vet/cursief, tabellen) blijft; classes,
 * scripts, `mso-`-stijlen en lege spans verdwijnen.
 */
export function sanitizeEditorHtml(html: string): string {
  return sanitize(html, { allowDataImage: true });
}

/* ─── Verzendklaar ─── */

/**
 * Inline stijl per tag voor uitgaande mail.
 *
 * Mailclients hebben geen gedeelde stylesheet en Gmail/Outlook strippen
 * `<style>`-blokken; alles wat er uit moet zien zoals bedoeld, moet dus op het
 * element zelf staan. Dit is hetzelfde idioom als de gegenereerde
 * handtekeningen (`scripts/generate-signatures.mjs`).
 */
const EMAIL_TAG_STYLES: Record<string, string> = {
  p: "margin:0 0 10px 0",
  h1: "margin:0 0 10px 0;font-size:20px;font-weight:600;line-height:1.3",
  h2: "margin:0 0 8px 0;font-size:17px;font-weight:600;line-height:1.3",
  h3: "margin:0 0 8px 0;font-size:15px;font-weight:600;line-height:1.3",
  h4: "margin:0 0 8px 0;font-size:14px;font-weight:600;line-height:1.3",
  ul: "margin:0 0 10px 0;padding-left:24px",
  ol: "margin:0 0 10px 0;padding-left:24px",
  li: "margin:0 0 4px 0",
  // Géén `color` op een citaat, en dat is geen smaakkwestie: browsers maken
  // van "inspringen" (Tab, of de inspringknop) óók een `<blockquote>` — met
  // `border:none` en een linkermarge erop. De rand valt daardoor netjes weg,
  // maar een kleur uit deze standaardstijl zou blijven staan en een gewone
  // ingesprongen alinea grijs bij de ontvanger laten aankomen. De rand ís het
  // citaat-signaal. Het geciteerde origineel onder een antwoord heeft zijn
  // eigen, expliciete stijl in `buildOutgoingHtml` en blijft dus wél grijs.
  blockquote: "margin:0 0 10px 0;padding:0 0 0 12px;border-left:2px solid #cbd5e1",
  hr: "border:0;border-top:1px solid #cbd5e1;margin:16px 0",
  a: "color:#2563eb",
  table: "border-collapse:collapse",
  img: "max-width:100%;height:auto",
  pre: "margin:0 0 10px 0;font-family:Consolas,monospace;white-space:pre-wrap",
  code: "font-family:Consolas,monospace",
};

/**
 * De omhullende stijl: één basislettertype voor het hele bericht.
 *
 * Bewust zónder aanhalingstekens rond `Segoe UI`: dat is geldige CSS én het
 * scheelt een ronde escaping. ERPNext's HTML-opschoning bij het opslaan van de
 * Communication zet `'…'` namelijk om naar `&quot;…&quot;`, en dan staat er in
 * de opgeslagen mail iets anders dan wat we verstuurden.
 */
export const EMAIL_BODY_STYLE =
  "font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0f172a";

/**
 * Maakt de opgestelde HTML klaar voor verzending.
 *
 * Zelfde whitelist als de editor, maar strenger op één punt en ruimer op een
 * ander: `data:`-afbeeldingen gaan **niet** mee (mailclients blokkeren ze en
 * ze blazen de mail op — een geplakt screenshot hoort een bijlage te worden),
 * en elk structuurelement krijgt inline stijl mee zodat het bericht bij de
 * ontvanger niet als ongestileerde `<div>`-soep aankomt.
 *
 * Lege invoer geeft een lege string terug — géén lege omhulling, want
 * `buildOutgoingHtml` plakt daar de handtekening en het citaat achteraan en
 * die horen niet in een leeg vak te hangen.
 */
export function toEmailHtml(html: string): string {
  const cleaned = sanitize(html, { allowDataImage: false, defaultStyles: EMAIL_TAG_STYLES });
  if (!isHtmlEmpty(cleaned)) return `<div style="${EMAIL_BODY_STYLE}">${cleaned}</div>`;
  return "";
}

/* ─── Tekst ↔ HTML ─── */

/**
 * Platte tekst naar HTML-alinea's. Lege regels scheiden alinea's, enkele
 * regeleindes worden `<br>` — precies wat iemand verwacht die tekst uit een
 * teksteditor plakt.
 */
export function plainTextToHtml(text: string): string {
  const normalized = String(text || "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const html = blocks
    .map((block) => escapeHtml(block).replace(/\n/g, "<br>"))
    .filter((block) => block.length > 0)
    .map((block) => `<p>${block}</p>`)
    .join("");
  return html;
}

/**
 * HTML naar leesbare platte tekst. Gebruikt voor het `text_content`-veld van
 * een uitgaande mail en voor de conceptvoorbeeldregel in de berichtenlijst.
 */
export function htmlToPlainText(html: string): string {
  const withBreaks = String(html || "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    // Een alinea, kop of citaat krijgt een lege regel eronder (zoals in een
    // gelezen mail), een lijstitem of tabelrij maar één regeleinde.
    .replace(/<\/\s*(p|div|h[1-6]|blockquote|pre)\s*>/gi, "\n\n")
    .replace(/<\/\s*(li|tr|dt|dd)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(withBreaks)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Bevat deze HTML iets zichtbaars?
 *
 * Een `contentEditable` dat de gebruiker heeft leeggemaakt bevat vaak nog
 * `<br>` of `<p><br></p>`; dat mag geen "concept" opleveren en geen mail met
 * een lege regel erin.
 */
export function isHtmlEmpty(html: string): boolean {
  const stripped = String(html || "")
    .replace(/<\s*(img|hr|table)\b/gi, "X") // deze zijn zichtbaar zonder tekst
    .replace(/<[^>]*>/g, "");
  return decodeEntities(stripped).replace(/[\s\u00a0]+/g, "") === "";
}

/**
 * Zorgt dat een bewaarde body als HTML behandeld kan worden.
 *
 * Concepten van vóór de opmaak-editor staan als platte tekst in localStorage.
 * Zonder deze omzetting zou zo'n hersteld concept zijn regeleindes verliezen
 * (HTML negeert die) en zou een `<` erin als tagbegin gelezen worden.
 */
export function ensureHtmlBody(value: string): string {
  const raw = String(value || "");
  if (!raw.trim()) return "";
  if (/<[a-z!/]/i.test(raw)) return sanitizeEditorHtml(raw);
  return plainTextToHtml(raw);
}
