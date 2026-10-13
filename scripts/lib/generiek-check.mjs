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

/** Bekende openbare CAD-ABI; nooit een vrijbrief voor namen, hosts of documentatie. */
const CAD_ABI = {
  namespace: "6:ead53e4e:bd4f85bb",
  berichttypes: new Set(["10:6cfe3b0a:86827081", "16:76ba020a:aa1c0acf"]),
  properties: new Set(["19:9824aa34:2a8bc5d1", "16:d9278076:bdcdeb8d"]),
  script: "16:4bd0b267:7690c54c",
};

function tekstEnCommentaarBereiken(tekst) {
  const bereiken = [];
  for (let i = 0; i < tekst.length; i++) {
    const begin = i;
    if (tekst.startsWith("//", i)) {
      const einde = tekst.indexOf("\n", i + 2); i = einde < 0 ? tekst.length : einde;
      bereiken.push([begin, i]);
    } else if (tekst.startsWith("/*", i) || tekst.startsWith("<!--", i)) {
      const sluit = tekst.startsWith("/*", i) ? "*/" : "-->";
      const einde = tekst.indexOf(sluit, i + 2); i = einde < 0 ? tekst.length : einde + sluit.length;
      bereiken.push([begin, i]);
    } else if ('"\'`'.includes(tekst[i])) {
      const quote = tekst[i]; i++;
      for (; i < tekst.length; i++) {
        if (tekst[i] === "\\") i++;
        else if (tekst[i] === quote) break;
      }
      bereiken.push([begin, i]);
    }
  }
  return bereiken;
}

function openbareCadAbiBereiken(tekst, bestandstype) {
  if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html"].includes(bestandstype)) return [];
  const bereiken = [];
  const geenCode = tekstEnCommentaarBereiken(tekst);
  const scriptBereiken = [...tekst.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((match) => [match.index + match[0].indexOf(">") + 1, match.index + match[0].lastIndexOf("</")]);
  const codeOp = (index) => !geenCode.some(([begin, einde]) => index > begin && index < einde)
    && (bestandstype !== ".html" || scriptBereiken.some(([begin, einde]) => index >= begin && index < einde));
  // Alleen een letterlijk protocoltype in een type-veld of typevergelijking.
  for (const match of tekst.matchAll(/(["'`])([a-z0-9_.-]+)\1/g)) {
    if (!codeOp(match.index)) continue;
    if (!CAD_ABI.berichttypes.has(vingerafdruk(match[2]))) continue;
    if (!/\btype\s*(?::|={2,3}|!={1,2})\s*$/.test(tekst.slice(Math.max(0, match.index - 50), match.index))) continue;
    bereiken.push([match.index + 1, match.index + 1 + match[2].length]);
  }
  // Alleen de twee bestaande window-properties, niet objectconfiguratie of labels.
  for (const match of tekst.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)/g)) {
    if (!codeOp(match.index)) continue;
    if (!/^__[a-z]+Cad(?:Commands|Reply)$/.test(match[1]) || !CAD_ABI.properties.has(vingerafdruk(match[1]))) continue;
    const begin = match.index + "window.".length;
    bereiken.push([begin, begin + match[1].length]);
  }
  // De bridge wordt uitsluitend als dit lokale script geladen, zonder query of pad.
  for (const match of tekst.matchAll(/<script\b[^>]*\s+src\s*=\s*(["'])(?:\.\/)?([a-z0-9_-]+\.js)\1[^>]*>/gi)) {
    if (bestandstype !== ".html" || geenCode.some(([begin, einde]) => match.index > begin && match.index < einde)) continue;
    if (match[2] !== match[2].toLowerCase() || vingerafdruk(match[2]) !== CAD_ABI.script) continue;
    const begin = match.index + match[0].indexOf(match[2]);
    bereiken.push([begin, begin + match[2].length]);
  }
  return bereiken;
}

/**
 * Alle plekken in `tekst` waar een verboden term staat.
 *
 * @param {string} tekst
 * @param {string[]} [verboden] vingerafdrukken, zie `vingerafdruk`
 * @param {string} [bestandstype] extensie; ABI-uitzonderingen gelden alleen voor code
 * @returns {{ index: number, regel: number, fragment: string }[]}
 */
export function zoekTreffers(tekst, verboden = VERBODEN, bestandstype = ".js") {
  const laag = tekst.toLowerCase();
  const openbareAbi = openbareCadAbiBereiken(tekst, bestandstype);
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
        const afdruk = `${lengte}:${(h >>> 0).toString(16)}:${controlesom(laag, i, lengte).toString(16)}`;
        if (afdruk !== CAD_ABI.namespace || !openbareAbi.some(([begin, einde]) => i >= begin && i + lengte <= einde)) {
          plekken.push({ index: i, lengte });
        }
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
    for (const treffer of zoekTreffers(readFileSync(pad, "utf8"), verboden, extname(pad).toLowerCase())) {
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
