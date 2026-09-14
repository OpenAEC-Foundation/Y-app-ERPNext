/**
 * Markdown ↔ HTML voor de mailopsteller.
 *
 * Waarom zelfgeschreven en geen bibliotheek: wat hier langs komt is niet
 * "Markdown" in het algemeen maar het handjevol vormen dat in zakelijke post
 * voorkomt — koppen, vet, cursief, lijsten, links, citaten, code. Daar staat
 * een eigen module van tweehonderd regels tegenover twee afhankelijkheden die
 * allebei veel meer doen dan nodig, en waarvan de uitvoer daarna alsnog door
 * de opschoning van de editor moet.
 *
 * De heenweg (Markdown → HTML) en de terugweg (HTML → Markdown) zijn niet
 * elkaars exacte spiegel, en dat kán ook niet: HTML kent vormen die Markdown
 * niet heeft. De terugweg laat wat hij niet kent als tekst staan in plaats van
 * het weg te gooien — liever een regel die er raar uitziet dan een alinea die
 * verdwijnt bij het wisselen van modus.
 */

/* ───────────────────────────── Markdown → HTML ────────────────────────── */

/**
 * Zet Markdown om naar de HTML die de mailopsteller gebruikt.
 *
 * Blokken eerst, dan pas de opmaak binnen een regel: anders zou een `*` in een
 * lijstopsomming als cursief gelezen worden.
 */
export function markdownNaarHtml(markdown: string): string {
  const regels = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
  const uit: string[] = [];
  let alinea: string[] = [];
  let lijst: { soort: "ul" | "ol"; items: string[] } | null = null;
  let citaat: string[] = [];
  let codeblok: string[] | null = null;

  const sluitAlinea = () => {
    if (alinea.length) {
      uit.push(`<p>${alinea.map(binnenregel).join("<br>")}</p>`);
      alinea = [];
    }
  };
  const sluitLijst = () => {
    if (lijst) {
      const items = lijst.items.map((i) => `<li>${binnenregel(i)}</li>`).join("");
      uit.push(`<${lijst.soort}>${items}</${lijst.soort}>`);
      lijst = null;
    }
  };
  const sluitCitaat = () => {
    if (citaat.length) {
      uit.push(`<blockquote>${citaat.map(binnenregel).join("<br>")}</blockquote>`);
      citaat = [];
    }
  };
  const sluitAlles = () => { sluitAlinea(); sluitLijst(); sluitCitaat(); };

  for (const ruw of regels) {
    const regel = ruw.replace(/\s+$/, "");

    // Een codeblok slikt alles tot het afsluitende hek — daarbinnen gelden
    // geen Markdown-regels, anders kun je geen voorbeeldcode sturen.
    if (/^\s*```/.test(regel)) {
      if (codeblok === null) { sluitAlles(); codeblok = []; }
      else {
        uit.push(`<pre><code>${ontsnap(codeblok.join("\n"))}</code></pre>`);
        codeblok = null;
      }
      continue;
    }
    if (codeblok !== null) { codeblok.push(ruw); continue; }

    if (!regel.trim()) { sluitAlles(); continue; }

    const kop = /^(#{1,3})\s+(.*)$/.exec(regel);
    if (kop) {
      sluitAlles();
      const niveau = Math.min(kop[1].length, 3);
      uit.push(`<h${niveau}>${binnenregel(kop[2])}</h${niveau}>`);
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(regel)) {
      sluitAlles();
      uit.push("<hr>");
      continue;
    }

    const streepje = /^\s*[-*+]\s+(.*)$/.exec(regel);
    const genummerd = /^\s*\d+[.)]\s+(.*)$/.exec(regel);
    if (streepje || genummerd) {
      sluitAlinea();
      sluitCitaat();
      const soort = streepje ? "ul" : "ol";
      if (!lijst || lijst.soort !== soort) { sluitLijst(); lijst = { soort, items: [] }; }
      lijst.items.push((streepje ? streepje[1] : genummerd![1]));
      continue;
    }
    sluitLijst();

    const aanhaling = /^\s*>\s?(.*)$/.exec(regel);
    if (aanhaling) { sluitAlinea(); citaat.push(aanhaling[1]); continue; }
    sluitCitaat();

    alinea.push(regel);
  }
  if (codeblok !== null) uit.push(`<pre><code>${ontsnap(codeblok.join("\n"))}</code></pre>`);
  sluitAlles();
  return uit.join("");
}

/**
 * De opmaak binnen één regel.
 *
 * Code eerst en apart: wat tussen backticks staat hoort letterlijk te blijven,
 * inclusief sterretjes. De stukken worden er even uitgehaald en na afloop weer
 * teruggezet, zodat de rest van de vervangingen er niet bij kan.
 */
function binnenregel(tekst: string): string {
  const bewaard: string[] = [];
  // Het plaatshoudersteken komt uit het private-use-gebied van Unicode: dat
  // staat gegarandeerd niet in een e-mail. Met iets gewoners — een cijfer
  // tussen spaties bijvoorbeeld — zou "wij hebben 3 opties" ineens vervangen
  // worden. Als escape geschreven en niet als teken: een echt stuurteken in
  // een bronbestand maakt het bestand binair voor grep en diff.
  const HOUDER = "\uE000";
  let s = ontsnap(tekst).replace(/`([^`]+)`/g, (_m, code: string) => {
    bewaard.push(`<code>${code}</code>`);
    return `${HOUDER}${bewaard.length - 1}${HOUDER}`;
  });

  // Het adres mag één laag haakjes bevatten: die komen voor in adressen, en
  // zonder die ruimte blijft de sluithaak als losse tekst achter — dat zag je
  // bij een geweigerde link, waar er ineens "klik)" stond.
  s = s.replace(/!\[([^\]]*)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/g,
    (_m, alt: string, src: string) =>
      veiligeUrl(src) ? `<img src="${src}" alt="${alt}">` : alt);
  s = s.replace(/\[([^\]]+)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/g,
    (_m, label: string, url: string) =>
      veiligeUrl(url) ? `<a href="${url}">${label}</a>` : label);

  // Drie sterren eerst, anders eet de vet-regel er twee van op en blijft er
  // een los sterretje staan.
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Losse underscores midden in een woord (bestandsnamen, adressen) blijven
  // met rust: `factuur_2026_03` is geen cursief.
  s = s.replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:!?)])/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<s>$1</s>");

  return s.replace(/\uE000(\d+)\uE000/g, (_m, i: string) => bewaard[Number(i)]);
}

/** Alleen schema's waar een mailprogramma iets mee kan. */
function veiligeUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|#|\/)/i.test(url.trim());
}

function ontsnap(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ───────────────────────────── HTML → Markdown ────────────────────────── */

/** Blokelementen waarna een lege regel hoort. */
const BLOKKEN = new Set(["p", "div", "h1", "h2", "h3", "h4", "blockquote", "ul", "ol", "pre", "hr", "table", "tr"]);

/**
 * Zet de HTML van de opsteller terug naar Markdown.
 *
 * Werkt op de tekst en niet op een DOM: dit draait ook buiten de browser (de
 * tests), en de HTML die hier binnenkomt is de onze — geen willekeurige
 * webpagina. Wat niet herkend wordt verliest zijn tags maar houdt zijn tekst.
 */
export function htmlNaarMarkdown(html: string): string {
  let s = String(html ?? "");

  // Wat sowieso niet als tekst mee mag.
  s = s.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Code eerst: daarbinnen mag verder niets omgezet worden.
  s = s.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_m, code: string) => `\n\n\`\`\`\n${ontsnapTerug(stripTags(code))}\n\`\`\`\n\n`);
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi,
    (_m, code: string) => `\`${ontsnapTerug(stripTags(code))}\``);

  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, niveau: string, inhoud: string) =>
    `\n\n${"#".repeat(Math.min(Number(niveau), 3))} ${plat(inhoud)}\n\n`);

  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, i: string) => `**${plat(i)}**`);
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, i: string) => `*${plat(i)}*`);
  s = s.replace(/<(s|strike|del)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, i: string) => `~~${plat(i)}~~`);

  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, url: string, label: string) => `[${plat(label)}](${url})`);
  s = s.replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi, (m, src: string) => {
    const alt = /alt=["']([^"']*)["']/i.exec(m)?.[1] ?? "";
    return `![${alt}](${src})`;
  });

  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inhoud: string) => {
    const tekst = htmlNaarMarkdown(inhoud).trim();
    return `\n\n${tekst.split("\n").map((r) => `> ${r}`.trimEnd()).join("\n")}\n\n`;
  });

  s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inhoud: string) => {
    let n = 0;
    const items = [...inhoud.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => `${++n}. ${plat(m[1])}`);
    return `\n\n${items.join("\n")}\n\n`;
  });
  s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inhoud: string) => {
    const items = [...inhoud.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => `- ${plat(m[1])}`);
    return `\n\n${items.join("\n")}\n\n`;
  });

  s = s.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // De overgebleven blokken worden regelovergangen; de rest valt gewoon weg.
  s = s.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (_m, tag: string) =>
    BLOKKEN.has(tag.toLowerCase()) ? "\n\n" : "");

  return ontsnapTerug(s)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Inhoud van een inline-element: tags eruit, tekst behouden. */
function plat(html: string): string {
  return ontsnapTerug(stripTags(html.replace(/<br\s*\/?>/gi, " "))).replace(/\s+/g, " ").trim();
}

function stripTags(html: string): string {
  return html.replace(/<\/?[a-z0-9]+\b[^>]*>/gi, "");
}

function ontsnapTerug(tekst: string): string {
  return tekst
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&");
}
