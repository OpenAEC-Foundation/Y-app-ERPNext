/**
 * Een minimale ZIP-schrijver, alleen om meerdere bijlagen als één bestand te
 * kunnen downloaden.
 *
 * Waarom zelfgebouwd: dit is het enige wat de app van een zip-bibliotheek
 * nodig heeft, en het formaat is voor dit geval klein. De alternatieven waren
 * slechter — een afhankelijkheid van een paar honderd kilobyte voor één knop,
 * of de bijlagen één voor één laten downloaden, waar de browser een
 * toestemmingsvraag over stelt en je daarna losse bestanden hebt.
 *
 * Bewust géén compressie ("store"): mailbijlagen zijn vrijwel altijd al
 * gecomprimeerd (pdf, jpg, docx, xlsx), dus deflate zou rekentijd kosten
 * zonder dat het bestand kleiner wordt. Voor de gebruiker maakt het geen
 * verschil: een store-zip pakt elke gangbare uitpakker gewoon uit.
 *
 * Grens: dit schrijft geen ZIP64, dus het houdt op bij 4 GB per bestand en
 * 65535 bestanden. `maakZip` gooit erboven, in plaats van stilletjes een
 * kapot archief af te leveren. Voor mailbijlagen is dat ruim buiten bereik.
 */

export interface ZipInvoer {
  /** Bestandsnaam in het archief. Mappen mogen, met een gewone `/`. */
  naam: string;
  data: Uint8Array;
}

const MAX_BESTAND = 0xffffffff;
const MAX_AANTAL = 0xffff;

/** CRC-32 (IEEE), de controlesom die het zip-formaat voorschrijft. */
const CRC_TABEL = (() => {
  const tabel = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabel[i] = c >>> 0;
  }
  return tabel;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABEL[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Datum en tijd in het MS-DOS-formaat dat zip gebruikt: 2 seconden nauwkeurig,
 * jaartal vanaf 1980. Vóór 1980 bestaat er in dit formaat niet, dus daar
 * klemmen we op de ondergrens.
 */
export function dosDatumTijd(d: Date): { tijd: number; datum: number } {
  const jaar = Math.max(1980, d.getFullYear());
  return {
    tijd: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    datum: ((jaar - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Bouwt het archief. `nu` staat los zodat de uitvoer in een test
 * reproduceerbaar is — met een wisselende tijdstempel is er niets te
 * vergelijken.
 */
export function maakZip(bestanden: ZipInvoer[], nu: Date = new Date()): Uint8Array<ArrayBuffer> {
  if (bestanden.length > MAX_AANTAL) {
    throw new Error(`Te veel bestanden voor een zip zonder ZIP64: ${bestanden.length}`);
  }
  const { tijd, datum } = dosDatumTijd(nu);
  const coder = new TextEncoder();

  const delen: Uint8Array[] = [];
  const centraal: Uint8Array[] = [];
  let plek = 0;

  for (const bestand of bestanden) {
    if (bestand.data.length > MAX_BESTAND) {
      throw new Error(`Bestand te groot voor een zip zonder ZIP64: ${bestand.naam}`);
    }
    const naam = coder.encode(bestand.naam);
    if (naam.length > 0xffff) throw new Error(`Bestandsnaam te lang: ${bestand.naam}`);
    const som = crc32(bestand.data);

    const kop = new Uint8Array(30 + naam.length);
    const k = new DataView(kop.buffer);
    k.setUint32(0, 0x04034b50, true);
    k.setUint16(4, 20, true);      // benodigde versie: 2.0
    k.setUint16(6, 0x0800, true);  // vlag: bestandsnaam in UTF-8
    k.setUint16(8, 0, true);       // methode 0 = opslaan
    k.setUint16(10, tijd, true);
    k.setUint16(12, datum, true);
    k.setUint32(14, som, true);
    k.setUint32(18, bestand.data.length, true);
    k.setUint32(22, bestand.data.length, true);
    k.setUint16(26, naam.length, true);
    k.setUint16(28, 0, true);      // geen extra veld
    kop.set(naam, 30);

    delen.push(kop, bestand.data);

    const cd = new Uint8Array(46 + naam.length);
    const c = new DataView(cd.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);      // gemaakt door versie 2.0
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, tijd, true);
    c.setUint16(14, datum, true);
    c.setUint32(16, som, true);
    c.setUint32(20, bestand.data.length, true);
    c.setUint32(24, bestand.data.length, true);
    c.setUint16(28, naam.length, true);
    c.setUint32(42, plek, true);   // waar de lokale kop begint
    cd.set(naam, 46);
    centraal.push(cd);

    plek += kop.length + bestand.data.length;
  }

  const cdGrootte = centraal.reduce((n, d) => n + d.length, 0);
  const staart = new Uint8Array(22);
  const s = new DataView(staart.buffer);
  s.setUint32(0, 0x06054b50, true);
  s.setUint16(8, bestanden.length, true);
  s.setUint16(10, bestanden.length, true);
  s.setUint32(12, cdGrootte, true);
  s.setUint32(16, plek, true);

  return plak([...delen, ...centraal, staart]);
}

function plak(delen: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const totaal = delen.reduce((n, d) => n + d.length, 0);
  const uit = new Uint8Array(totaal);
  let i = 0;
  for (const d of delen) { uit.set(d, i); i += d.length; }
  return uit;
}

/**
 * Maakt namen uniek binnen één archief: `factuur.pdf`, `factuur (2).pdf`.
 * Twee bijlagen met dezelfde naam komen in de praktijk voor (twee keer
 * "scan.pdf" van dezelfde afzender) en zouden elkaar anders overschrijven bij
 * het uitpakken.
 */
export function uniekeNamen(namen: string[]): string[] {
  const gezien = new Map<string, number>();
  return namen.map((naam) => {
    const sleutel = naam.toLowerCase();
    const eerder = gezien.get(sleutel) ?? 0;
    gezien.set(sleutel, eerder + 1);
    if (eerder === 0) return naam;
    const punt = naam.lastIndexOf(".");
    return punt > 0
      ? `${naam.slice(0, punt)} (${eerder + 1})${naam.slice(punt)}`
      : `${naam} (${eerder + 1})`;
  });
}

/**
 * Een bestandsnaam die op elk besturingssysteem mag. Windows is hier het
 * strengst: de tekens `\ / : * ? " < > |` zijn verboden, en een naam mag niet
 * op een punt of spatie eindigen.
 */
export function veiligeBestandsnaam(waarde: string, terugval = "bijlagen"): string {
  const schoon = (waarde || "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, 80)
    .trim();
  return schoon || terugval;
}
