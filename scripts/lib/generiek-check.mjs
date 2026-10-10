/**
 * Bewaakt dat de app generiek blijft: wat in de app terechtkomt noemt geen
 * organisatie en bevat geen adres van één organisatie.
 *
 * De controle zoekt naar een lijst termen (namen, domeinen). Die termen staan
 * hier niet uitgeschreven maar als vingerafdruk, zodat de bewaker zelf de
 * namen niet in de repository zet. Een term toevoegen:
 *
 *   node scripts/lib/generiek-check.mjs --vingerafdruk <term>
 *
 * en de uitkomst aan `VERBODEN` toevoegen. Controleren:
 *
 *   node scripts/lib/generiek-check.mjs <map> [<map> …]
 *
 * Een treffer wordt gemeld met bestand, regel en de tekst eromheen, en de
 * afsluitcode is dan 1. Het releasescript draait dit op de samengestelde app;
 * `npm test` draait het op de frontendbron en op `frappe-app/`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Vingerafdrukken van de termen die niet in de app mogen staan. */
export const VERBODEN = [
  "3:d8d5e:f5848477",
  "8:eef73571:bce7d762",
  "6:ead53e4e:bd4f85bb",
  "6:30f252ab:a417795a",
  "13:9b10105a:8ff14ca9",
  "14:325b14c4:d6bbfbf5",
  "5:bd6208d6:1d3c12bb",
  "8:653aa58c:15f9f987",
];

/**
 * Een term korter dan dit telt alleen aan het begin van een woord. Drie
 * willekeurige tekens komen ook bij toeval voor, bijvoorbeeld in een
 * ingesloten afbeelding.
 */
const KORTE_TERM = 5;

const BASIS = 131;

/** Bestanden die tekst zijn; de rest (afbeeldingen, lettertypen) wordt overgeslagen. */
const TEKST = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".html", ".css", ".svg", ".md",
  ".py", ".txt", ".toml", ".yml", ".yaml", ".cfg", ".map", ".webmanifest",
]);
const OVERSLAAN = new Set(["node_modules", ".git", "__pycache__", "dist"]);

/** De rollende som over `lengte` tekens vanaf `begin`. */
function som(tekst, begin, lengte) {
  let h = 0;
  for (let i = begin; i < begin + lengte; i += 1) h = (Math.imul(h, BASIS) + tekst.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Een tweede, onafhankelijke som: bevestigt een treffer van de eerste. */
function controlesom(tekst, begin, lengte) {
  let h = 0x811c9dc5;
  for (let i = begin; i < begin + lengte; i += 1) h = Math.imul(h ^ tekst.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** De vingerafdruk van een term: lengte en twee sommen. Hoofdletters tellen niet. */
export function vingerafdruk(term) {
  const laag = String(term).toLowerCase();
  return `${laag.length}:${som(laag, 0, laag.length).toString(16)}:${controlesom(laag, 0, laag.length).toString(16)}`;
}

const isWoordteken = (code) => (code >= 48 && code <= 57) || (code >= 97 && code <= 122);

/**
 * Alle plekken in `tekst` waar een verboden term staat.
 *
 * @param {string} tekst
 * @param {string[]} [verboden] vingerafdrukken, zie `vingerafdruk`
 * @returns {{ index: number, regel: number, fragment: string }[]}
 */
export function zoekTreffers(tekst, verboden = VERBODEN) {
  const laag = tekst.toLowerCase();
  // Per lengte: rollende som -> de controlesommen die erbij horen.
  const perLengte = new Map();
  for (const afdruk of verboden) {
    const [lengte, rol, controle] = afdruk.split(":");
    const sommen = perLengte.get(Number(lengte)) ?? new Map();
    sommen.set(parseInt(rol, 16), [...(sommen.get(parseInt(rol, 16)) ?? []), parseInt(controle, 16)]);
    perLengte.set(Number(lengte), sommen);
  }

  const plekken = [];
  for (const [lengte, sommen] of perLengte) {
    if (lengte === 0 || laag.length < lengte) continue;
    // De waarde van het voorste teken in de som, om het er weer af te halen.
    let macht = 1;
    for (let i = 1; i < lengte; i += 1) macht = Math.imul(macht, BASIS);
    let h = som(laag, 0, lengte) | 0;
    for (let i = 0; ; i += 1) {
      const kandidaten = sommen.get(h >>> 0);
      if (
        kandidaten
        && kandidaten.includes(controlesom(laag, i, lengte))
        && (lengte >= KORTE_TERM || i === 0 || !isWoordteken(laag.charCodeAt(i - 1)))
      ) {
        plekken.push({ index: i, lengte });
      }
      if (i + lengte >= laag.length) break;
      h = (Math.imul((h - Math.imul(laag.charCodeAt(i), macht)) | 0, BASIS) + laag.charCodeAt(i + lengte)) | 0;
    }
  }

  plekken.sort((a, b) => a.index - b.index);
  return plekken.map(({ index, lengte }) => ({
    index,
    regel: regelnummer(tekst, index),
    fragment: tekst.slice(Math.max(0, index - 30), index + lengte + 30).replace(/\s+/g, " ").trim(),
  }));
}

function regelnummer(tekst, index) {
  let regel = 1;
  for (let i = tekst.indexOf("\n"); i !== -1 && i < index; i = tekst.indexOf("\n", i + 1)) regel += 1;
  return regel;
}

function* tekstbestanden(map) {
  if (!statSync(map).isDirectory()) {
    yield map;
    return;
  }
  for (const naam of readdirSync(map).sort()) {
    const pad = join(map, naam);
    if (statSync(pad).isDirectory()) {
      if (!OVERSLAAN.has(naam)) yield* tekstbestanden(pad);
    } else if (TEKST.has(extname(naam).toLowerCase())) {
      yield pad;
    }
  }
}

/**
 * Doorzoekt alle tekstbestanden onder `map`; `map` mag ook één bestand zijn.
 *
 * @param {string} map
 * @param {string[]} [verboden]
 * @returns {{ bestand: string, pad: string, regel: number, fragment: string }[]}
 *   met `bestand` als pad binnen `map` en `pad` als volledig pad
 */
export function controleerMap(map, verboden = VERBODEN) {
  if (!existsSync(map)) return [];
  const treffers = [];
  for (const pad of tekstbestanden(map)) {
    for (const treffer of zoekTreffers(readFileSync(pad, "utf8"), verboden)) {
      treffers.push({ bestand: relative(map, pad), pad, regel: treffer.regel, fragment: treffer.fragment });
    }
  }
  return treffers;
}

function main(args) {
  if (args[0] === "--vingerafdruk") {
    for (const term of args.slice(1)) console.log(`"${vingerafdruk(term)}",`);
    return 0;
  }
  if (args.length === 0) {
    console.error("Gebruik: generiek-check.mjs <map> [<map> …]  |  --vingerafdruk <term> [<term> …]");
    return 2;
  }
  let aantal = 0;
  for (const map of args) {
    for (const treffer of controleerMap(map)) {
      console.error(`${treffer.pad}:${treffer.regel}  ${treffer.fragment}`);
      aantal += 1;
    }
  }
  if (aantal > 0) {
    console.error(`Niet generiek: ${aantal} verwijzing(en) naar een organisatie.`);
    return 1;
  }
  console.log("Generiek: geen verwijzingen naar een organisatie gevonden.");
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
