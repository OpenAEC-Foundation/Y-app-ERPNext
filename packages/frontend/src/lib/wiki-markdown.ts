/**
 * Markdown uit de kennisbank omzetten naar HTML.
 *
 * Oudere artikelen staan als markdown in ERPNext; wat in de Y-app bewerkt is,
 * staat als HTML. De omzetting dient de weergave én het bewerkvak: een
 * markdown-artikel gaat bij de eerste keer bewerken hier doorheen en wordt
 * daarna als HTML opgeslagen. Wat hier niet goed omgezet wordt, is na die
 * eerste bewerking definitief kwijt. Daarom kent de omzetting ook tabellen,
 * citaten en (geneste, genummerde) lijsten. Tabellen die al zo verloren gingen
 * (elke regel een losse alinea met strepen), zet `herstelPijptabellen` terug.
 *
 * Volgorde: code gaat eerst opzij (daarin wordt niets omgezet), dan de opmaak
 * binnen een regel (vet, cursief, links), en pas daarna de blokken. Zo kan
 * cursief nooit over twee opsommingspunten of tabelcellen heen lopen.
 *
 * De opmaak (koppen, lijsten, tabellen) komt van de pagina die de HTML toont,
 * niet uit klassen hier; zo ziet een artikel er hetzelfde uit, of het nu als
 * markdown of als HTML is opgeslagen.
 */

const LIJKT_HTML = /<(div|p|h[1-6]|ul|ol|li|table|br|img|a|span|section)\b/i;
const SCHEIDINGSREGEL = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;
const LIJSTREGEL = /^([\t ]*)(\d+\.|-) (.*)$/;

/* ─── Tabellen ─── */

/** De cellen van een tabelregel "| a | b |"; `\|` is een pijpteken in een cel. */
function cellen(regel: string): string[] {
  return regel.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));
}

function tabel(kop: string[], rijen: string[][]): string {
  const th = kop.map((c) => `<th>${c}</th>`).join("");
  const tr = rijen.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

/**
 * Tabelregels naar tabellen. De regels komen als tekst binnen; een regel die
 * gevolgd wordt door een scheidingsregel (`|---|`) begint een nieuwe tabel.
 * Geeft `null` als de eerste twee regels geen kop met scheidingsregel zijn.
 */
function tabellenUitRegels(regels: string[]): string | null {
  if (regels.length < 2 || !SCHEIDINGSREGEL.test(regels[1].trim())) return null;
  const uit: string[] = [];
  let i = 0;
  while (i < regels.length) {
    const kop = cellen(regels[i]);
    const rijen: string[][] = [];
    let j = i + 2;
    while (j < regels.length && !(j + 1 < regels.length && SCHEIDINGSREGEL.test(regels[j + 1].trim()))) {
      rijen.push(cellen(regels[j]));
      j++;
    }
    uit.push(tabel(kop, rijen));
    i = j;
  }
  return uit.join("");
}

/** Markdown-tabellen (opeenvolgende regels die met | beginnen) naar één regel HTML. */
function tabellen(md: string): string {
  const regels = md.split("\n");
  const uit: string[] = [];
  for (let i = 0; i < regels.length; i++) {
    if (!regels[i].trim().startsWith("|")) {
      uit.push(regels[i]);
      continue;
    }
    let j = i;
    while (j < regels.length && regels[j].trim().startsWith("|")) j++;
    const blok = regels.slice(i, j);
    const html = tabellenUitRegels(blok.map((r) => r.trim()));
    if (html) uit.push(html);
    else uit.push(...blok);
    i = j - 1;
  }
  return uit.join("\n");
}

/* ─── Citaten ─── */

/** Citaten (regels die met > beginnen) naar één blok; een lege citaatregel scheidt alinea's. */
function citaten(md: string): string {
  return md.replace(/(?:^>[^\n]*(?:\n|$))+/gm, (blok) => {
    const alineas: string[] = [];
    let huidig: string[] = [];
    for (const regel of blok.replace(/\n$/, "").split("\n")) {
      const tekst = regel.replace(/^>\s?/, "").trim();
      if (tekst) {
        huidig.push(tekst);
      } else if (huidig.length) {
        alineas.push(huidig.join("<br>"));
        huidig = [];
      }
    }
    if (huidig.length) alineas.push(huidig.join("<br>"));
    const eind = blok.endsWith("\n") ? "\n" : "";
    return `<blockquote>${alineas.map((a) => `<p>${a}</p>`).join("")}</blockquote>${eind}`;
  });
}

/* ─── Lijsten ─── */

function openLijst(tag: "ol" | "ul", start: number): string {
  return tag === "ol" && start !== 1 ? `<ol start="${start}">` : `<${tag}>`;
}

/**
 * Eén lijstblok naar HTML. Inspringen maakt een geneste lijst binnen het
 * vorige punt; een genummerde lijst die niet bij 1 begint, krijgt `start`.
 */
function bouwLijst(items: RegExpMatchArray[]): string {
  let html = "";
  const stapel: { inspring: number; tag: "ol" | "ul" }[] = [];
  for (const m of items) {
    const inspring = m[1].replace(/\t/g, "    ").length;
    const tag = m[2] === "-" ? "ul" : "ol";
    const start = tag === "ol" ? parseInt(m[2], 10) : 1;
    while (stapel.length && inspring < stapel[stapel.length - 1].inspring) {
      html += `</li></${stapel.pop()!.tag}>`;
    }
    const boven = stapel[stapel.length - 1];
    if (!boven || inspring > boven.inspring) {
      html += openLijst(tag, start);
      stapel.push({ inspring, tag });
    } else if (boven.tag !== tag) {
      html += `</li></${stapel.pop()!.tag}>` + openLijst(tag, start);
      stapel.push({ inspring, tag });
    } else {
      html += "</li>";
    }
    html += `<li>${m[3]}`;
  }
  while (stapel.length) html += `</li></${stapel.pop()!.tag}>`;
  return html;
}

/**
 * Opeenvolgende lijstregels naar één lijst op één regel. Een lege regel
 * tussen twee punten hoort bij de lijst (anders begint de nummering opnieuw).
 */
function lijsten(md: string): string {
  const regels = md.split("\n");
  const uit: string[] = [];
  let i = 0;
  while (i < regels.length) {
    if (!LIJSTREGEL.test(regels[i])) {
      uit.push(regels[i]);
      i++;
      continue;
    }
    const items: RegExpMatchArray[] = [];
    let j = i;
    while (j < regels.length) {
      const m = regels[j].match(LIJSTREGEL);
      if (m) {
        items.push(m);
        j++;
        continue;
      }
      if (!regels[j].trim()) {
        let k = j;
        while (k < regels.length && !regels[k].trim()) k++;
        if (k < regels.length && LIJSTREGEL.test(regels[k])) {
          j = k;
          continue;
        }
      }
      break;
    }
    uit.push(bouwLijst(items));
    i = j;
  }
  return uit.join("\n");
}

/* ─── Herstel ─── */

/**
 * Tabelregels die als losse alinea's in HTML staan (`<p>| a | b |</p>`,
 * `<p>|---|---|</p>`, …) weer omzetten naar een tabel. Zonder scheidingsregel
 * als tweede regel blijft alles zoals het was.
 */
export function herstelPijptabellen(html: string): string {
  const alinea = String.raw`<p(?:\s[^>]*)?>\s*(\|(?:(?!<\/p>)[\s\S])*\|)\s*<\/p>`;
  const reeks = new RegExp(String.raw`${alinea}(?:\s*${alinea})+`, "g");
  return html.replace(reeks, (blok) => {
    const regels = [...blok.matchAll(new RegExp(alinea, "g"))].map((m) => m[1].trim());
    return tabellenUitRegels(regels) ?? blok;
  });
}

/* ─── Omzetting ─── */

export function markdownToHtml(md: string): string {
  if (!md) return "";

  // Al HTML (bewerkt in de Y-app): alleen verloren tabellen herstellen.
  if (LIJKT_HTML.test(md)) return herstelPijptabellen(md);

  let html = md.replace(/\r\n/g, "\n");

  // Code gaat opzij: codeblokken als eigen regel, code in de tekst als teken
  // (tekens uit het privégebied van Unicode, die in een artikel niet voorkomen).
  const blokken: string[] = [];
  const stukjes: string[] = [];
  html = html.replace(/```\w*\n([\s\S]*?)```/g, (_m, code: string) => {
    blokken.push(`<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`);
    return `\uE000${blokken.length - 1}\uE000`;
  });
  html = html.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    stukjes.push(`<code>${code}</code>`);
    return `\uE001${stukjes.length - 1}\uE001`;
  });

  // Een opsommingsteken * wordt -, zodat het niet voor cursief aangezien wordt.
  html = html.replace(/^([\t ]*)\* /gm, "$1- ");

  // Opmaak binnen een regel: vet, cursief, afbeeldingen (vóór links), links.
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Blokken
  html = tabellen(html);
  html = citaten(html);
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = lijsten(html);
  html = html.replace(/^---+$/gm, "<hr />");

  // Alinea's: elke regel die geen blok en geen codeblok is.
  html = html.replace(/^(?!<(?:h[1-6]|ul|ol|li|table|blockquote|pre|hr|div|p)\b)(?!\uE000\d+\uE000$)(.+)$/gm, "<p>$1</p>");

  // Code terugzetten.
  html = html.replace(/\uE001(\d+)\uE001/g, (_m, n: string) => stukjes[Number(n)]);
  html = html.replace(/\uE000(\d+)\uE000/g, (_m, n: string) => blokken[Number(n)]);

  return html;
}
