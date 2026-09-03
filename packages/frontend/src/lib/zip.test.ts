import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, dosDatumTijd, maakZip, uniekeNamen, veiligeBestandsnaam } from "./zip.ts";

const NU = new Date(2026, 8, 3, 14, 30, 20);

function tekst(waarde: string): Uint8Array {
  return new TextEncoder().encode(waarde);
}

test("crc32 komt uit op de bekende waarde voor '123456789'", () => {
  // De controlewaarde uit de CRC-32-specificatie; hiermee staat vast dat de
  // tabel en de bit-volgorde kloppen.
  assert.equal(crc32(tekst("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test("dosDatumTijd propt datum en tijd in de twee 16-bits velden", () => {
  const { tijd, datum } = dosDatumTijd(NU);
  assert.equal((datum >> 9) + 1980, 2026);
  assert.equal((datum >> 5) & 0x0f, 9);
  assert.equal(datum & 0x1f, 3);
  assert.equal(tijd >> 11, 14);
  assert.equal((tijd >> 5) & 0x3f, 30);
  // Zip bewaart seconden in stappen van twee.
  assert.equal((tijd & 0x1f) * 2, 20);
  // Vóór 1980 bestaat niet in dit formaat; dan klemmen we op de ondergrens.
  assert.equal(dosDatumTijd(new Date(1970, 0, 1)).datum >> 9, 0);
});

test("maakZip levert een archief met de juiste kop, staart en bestandstelling", () => {
  const zip = maakZip([
    { naam: "factuur.pdf", data: tekst("pdf-inhoud") },
    { naam: "bijlage.txt", data: tekst("hallo") },
  ], NU);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

  // Lokale kop van het eerste bestand.
  assert.equal(v.getUint32(0, true), 0x04034b50);
  // Methode 0 = opslaan, geen compressie.
  assert.equal(v.getUint16(8, true), 0);
  // Vlag 0x0800: de bestandsnaam staat in UTF-8.
  assert.equal(v.getUint16(6, true), 0x0800);

  // De staart (EOCD) staat achteraan en telt twee bestanden.
  const staart = zip.length - 22;
  assert.equal(v.getUint32(staart, true), 0x06054b50);
  assert.equal(v.getUint16(staart + 8, true), 2);
  assert.equal(v.getUint16(staart + 10, true), 2);

  // De centrale map begint waar hij zegt te beginnen.
  const cdPlek = v.getUint32(staart + 16, true);
  assert.equal(v.getUint32(cdPlek, true), 0x02014b50);
  assert.equal(v.getUint32(staart + 12, true), staart - cdPlek);
});

test("maakZip zet de inhoud onverkort in het archief", () => {
  const inhoud = tekst("pdf-inhoud");
  const zip = maakZip([{ naam: "a.pdf", data: inhoud }], NU);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const naamLengte = v.getUint16(26, true);
  const begin = 30 + naamLengte;
  assert.deepEqual(zip.slice(begin, begin + inhoud.length), inhoud);
  // Zonder compressie zijn beide maten gelijk — daar leunt de lezer op.
  assert.equal(v.getUint32(18, true), inhoud.length);
  assert.equal(v.getUint32(22, true), inhoud.length);
  assert.equal(v.getUint32(14, true), crc32(inhoud));
});

test("maakZip komt met een leeg archief overweg", () => {
  const zip = maakZip([], NU);
  assert.equal(zip.length, 22);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(v.getUint32(0, true), 0x06054b50);
});

test("uniekeNamen laat gelijknamige bijlagen elkaar niet overschrijven", () => {
  assert.deepEqual(
    uniekeNamen(["scan.pdf", "scan.pdf", "brief.docx", "scan.pdf"]),
    ["scan.pdf", "scan (2).pdf", "brief.docx", "scan (3).pdf"],
  );
  // Hoofdletters tellen niet mee: Windows ziet die namen als hetzelfde.
  assert.deepEqual(uniekeNamen(["Scan.PDF", "scan.pdf"]), ["Scan.PDF", "scan (2).pdf"]);
  // Zonder extensie komt het nummer achteraan.
  assert.deepEqual(uniekeNamen(["notitie", "notitie"]), ["notitie", "notitie (2)"]);
});

test("veiligeBestandsnaam haalt eruit wat Windows weigert", () => {
  assert.equal(veiligeBestandsnaam('Re: offerte / kozijnen?'), "Re offerte kozijnen");
  assert.equal(veiligeBestandsnaam("naam eindigt op punt."), "naam eindigt op punt");
  assert.equal(veiligeBestandsnaam("   "), "bijlagen");
  assert.equal(veiligeBestandsnaam("", "mail"), "mail");
  assert.ok(veiligeBestandsnaam("x".repeat(200)).length <= 80);
});
