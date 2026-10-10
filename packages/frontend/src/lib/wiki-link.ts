/**
 * Links naar één artikel in de kennisbank.
 *
 * Elk artikel heeft een eigen adres in de Y-app: `…/y-next#/wiki/<pad>`, met
 * als pad de route van het artikel zonder "wiki/" ervoor — bijvoorbeeld
 * `#/wiki/kennisbank/procedures/algemeen/archiefonderzoek`. Zo'n link kun je
 * doorsturen; wie hem opent, staat meteen in het artikel.
 *
 * Artikelen verwijzen ook naar elkaar. In ERPNext staan die verwijzingen als
 * `wiki/kennisbank/…` of `/wiki/kennisbank/…`. Die openen we binnen de Y-app;
 * de wiki van ERPNext zelf toont ze niet.
 */

export interface ArtikelAdres {
  name: string;
  route: string;
}

function ontcijfer(tekst: string): string {
  try {
    return decodeURIComponent(tekst);
  } catch {
    return tekst;
  }
}

/** Het pad van een artikel: de route zonder "wiki/" ervoor en zonder schuine strepen eromheen. */
export function artikelPad(route: string): string {
  let pad = String(route || "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (pad === "wiki") return "";
  if (pad.startsWith("wiki/")) pad = pad.slice("wiki/".length);
  return pad;
}

/**
 * Het artikel bij een pad uit het adres: eerst op route, dan het
 * overzichtsartikel van die sectie (`<pad>/index`), anders op de ERPNext-naam.
 */
export function zoekArtikelOpPad<T extends ArtikelAdres>(artikelen: T[], pad: string): T | undefined {
  const gezocht = artikelPad(ontcijfer(pad)).toLowerCase();
  if (!gezocht) return undefined;
  const opRoute = (doel: string) => artikelen.find((a) => artikelPad(a.route).toLowerCase() === doel);
  return opRoute(gezocht) ?? opRoute(`${gezocht}/index`)
    ?? artikelen.find((a) => a.name.toLowerCase() === gezocht);
}

/** Het adres binnen de app: `/wiki/<pad>`, of `/wiki` voor het overzicht. */
export function urlVoorPad(pad: string): string {
  const schoon = artikelPad(pad);
  if (!schoon) return "/wiki";
  return "/wiki/" + schoon.split("/").map((deel) => encodeURIComponent(deel)).join("/");
}

/** Het adres binnen de app voor een artikel; zonder route valt het terug op de naam. */
export function urlVoorArtikel(artikel: ArtikelAdres): string {
  return urlVoorPad(artikelPad(artikel.route) || artikel.name);
}

/**
 * De link om door te sturen: de Y-app op de site, met het artikel achter `#`.
 * `appAdres` is het adres van de Y-app zelf, bijvoorbeeld
 * `https://erp.voorbeeld.nl/y-next` — in de browser de huidige pagina, in de
 * desktop-app de site (daar is het eigen adres een lokaal adres dat bij een
 * collega niets opent).
 */
export function deelbareLink(artikel: ArtikelAdres, appAdres: string): string {
  return `${appAdres.replace(/\/+$/, "")}#${urlVoorArtikel(artikel)}`;
}

/**
 * Wijst deze link naar een artikel in de kennisbank? Dan het pad (leeg voor
 * het overzicht), anders `null`.
 *
 * Herkend worden `wiki/…`, `/wiki/…`, `#/wiki/…` en volledige adressen op
 * dezelfde site: de ERPNext-wiki (`https://site/wiki/…`) en de Y-app
 * (`https://site/y-next#/wiki/…`). Een andere site met `/wiki/` in het adres,
 * zoals Wikipedia, blijft een gewone link.
 */
export function interneWikiLink(href: string, eigenOrigin: string): string | null {
  let rest = String(href || "").trim();
  if (!rest) return null;
  if (rest.startsWith("//")) rest = "https:" + rest;
  if (/^[a-z][a-z0-9+.-]*:/i.test(rest)) {
    let url: URL;
    try {
      url = new URL(rest);
    } catch {
      return null;
    }
    if (url.origin !== eigenOrigin) return null;
    rest = url.hash.startsWith("#/wiki") ? url.hash.slice(1) : url.pathname;
  } else if (rest.startsWith("#")) {
    rest = rest.slice(1);
  }
  rest = rest.replace(/^\/+/, "").split(/[?#]/)[0];
  if (rest !== "wiki" && !rest.startsWith("wiki/")) return null;
  return artikelPad(ontcijfer(rest));
}

/** Een attribuut met zijn waarde zoals hij in de HTML staat (nog met entiteiten). */
const ATTRIBUUT = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/** Een `<a …>`-tag opnieuw opbouwen met het adres in de Y-app, zonder nieuw tabblad. */
function herbouwLink(binnen: string, eigenOrigin: string): string | null {
  const attributen: { naam: string; waarde: string | null }[] = [];
  for (const m of binnen.matchAll(ATTRIBUUT)) {
    attributen.push({ naam: m[1].toLowerCase(), waarde: m[2] ?? m[3] ?? m[4] ?? null });
  }
  const href = attributen.find((a) => a.naam === "href");
  if (!href?.waarde) return null;
  const pad = interneWikiLink(href.waarde.replace(/&amp;/g, "&"), eigenOrigin);
  if (pad === null) return null;
  const delen = attributen
    .filter((a) => a.naam !== "target" && a.naam !== "rel")
    .map((a) => {
      if (a.naam === "href") return ` href="#${urlVoorPad(pad)}"`;
      // Elke waarde komt tussen dubbele aanhalingstekens; een " erin kan er
      // dan niet uitbreken.
      return a.waarde === null ? ` ${a.naam}` : ` ${a.naam}="${a.waarde.replace(/"/g, "&quot;")}"`;
    });
  return `<a${delen.join("")}>`;
}

/**
 * Zet in de HTML van een artikel elke link naar een ander artikel om naar het
 * adres in de Y-app (`#/wiki/…`), zonder nieuw tabblad. Klik je erop, dan
 * blijf je in de kennisbank; met Ctrl-klik open je het artikel in een eigen
 * tabblad. Andere links en alle overige HTML blijven precies zoals ze waren.
 *
 * De HTML wordt tag voor tag gelezen, met aandacht voor aanhalingstekens: een
 * `<a` of `rel=` ín een attribuutwaarde is tekst en wordt nooit als tag of
 * attribuut behandeld. Een aangepaste link wordt helemaal opnieuw opgebouwd.
 * Bedoeld voor HTML die al door `sanitizeEditorHtml` is gegaan.
 */
export function herschrijfWikiLinks(html: string, eigenOrigin: string): string {
  let uit = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      uit += html.slice(i);
      break;
    }
    uit += html.slice(i, lt);
    if (html.startsWith("<!--", lt)) {
      const eind = html.indexOf("-->", lt + 4);
      const tot = eind === -1 ? html.length : eind + 3;
      uit += html.slice(lt, tot);
      i = tot;
      continue;
    }
    const naam = /^<\/?[a-z][a-z0-9]*/i.exec(html.slice(lt, lt + 32));
    if (!naam) {
      uit += "<";
      i = lt + 1;
      continue;
    }
    let j = lt + naam[0].length;
    let aanhaling: string | null = null;
    while (j < html.length) {
      const teken = html[j];
      if (aanhaling) {
        if (teken === aanhaling) aanhaling = null;
      } else if (teken === '"' || teken === "'") {
        aanhaling = teken;
      } else if (teken === ">") {
        break;
      }
      j++;
    }
    const tot = Math.min(j + 1, html.length);
    const tag = html.slice(lt, tot);
    i = tot;
    if (naam[0].toLowerCase() === "<a" && j < html.length) {
      uit += herbouwLink(html.slice(lt + 2, j), eigenOrigin) ?? tag;
    } else {
      uit += tag;
    }
  }
  return uit;
}
