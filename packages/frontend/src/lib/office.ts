import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

export type OfficeKind = "word" | "excel";
export const OFFICE_MAX_SIZE = 20 * 1024 * 1024;
export class OfficePackageError extends Error {
  code: "format" | "size" | "external";
  constructor(code: OfficePackageError["code"]) { super(code); this.code = code; }
}
export function editableOfficeKind(name: string): OfficeKind | null {
  return /\.docx$/i.test(name) ? "word" : /\.xlsx$|\.xlsm$/i.test(name) ? "excel" : null;
}
export function officeEditorUrl(id: string): string {
  if (!id.trim()) throw new Error("File-id ontbreekt");
  return `#/office?${new URLSearchParams({ file: id })}`;
}
export class OfficeRevision {
  current = 0;
  private savedRevision = 0;
  get dirty() { return this.current !== this.savedRevision; }
  change() { this.current++; }
  saved(revision: number) { this.savedRevision = revision; }
}
function xmlDecode(text: string) {
  return text.replace(/&#x([\da-f]+);|&#(\d+);|&(amp|quot|apos|lt|gt);/gi, (_, hex, dec, named: string) => {
    if (hex || dec) return String.fromCodePoint(Number.parseInt(hex || dec, hex ? 16 : 10));
    return ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" } as Record<string, string>)[named.toLowerCase()];
  });
}
function attr(tag: string, name: string) { return xmlDecode(tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? ""); }
function tags(xml: string, name: string) { return xml.match(new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*(?:/>|>[\\s\\S]*?</(?:[\\w-]+:)?${name}\\s*>)`, "gi")) ?? []; }
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc;
});
function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const value of data) crc = (crc >>> 8) ^ crcTable[(crc ^ value) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

/** Eerst de directory begrenzen; nooit een gecomprimeerde bom uitpakken. */
function unpack(bytes: Uint8Array, maxExpanded = 80 * 1024 * 1024): Record<string, Uint8Array> {
  const fail = () => { throw new OfficePackageError("format"); };
  if (bytes.length > OFFICE_MAX_SIZE) throw new OfficePackageError("size");
  if (bytes.length < 22) return fail();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65_557) && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50) return fail();
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) return fail();
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true); let total = 0;
  if (!count || count > 2_000 || offset >= end) return fail();
  const names = new Set<string>();
  const checksums = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) return fail();
    if (view.getUint16(offset + 8, true) & 1) return fail();
    const expanded = view.getUint32(offset + 24, true); total += expanded;
    if (total > maxExpanded || expanded === 0xffffffff) throw new OfficePackageError("size");
    const len = view.getUint16(offset + 28, true);
    const next = offset + 46 + len + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    if (next > end) return fail();
    const name = strFromU8(bytes.subarray(offset + 46, offset + 46 + len));
    if (!name || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..") || names.has(name)) return fail();
    names.add(name); checksums.set(name, view.getUint32(offset + 16, true)); offset = next;
  }
  try {
    const parts = unzipSync(bytes); let expanded = 0;
    for (const [name, data] of Object.entries(parts)) {
      expanded += data.length;
      if (expanded > maxExpanded) throw new OfficePackageError("size");
      if (crc32(data) !== checksums.get(name)) return fail();
    }
    return parts;
  } catch (error) { if (error instanceof OfficePackageError) throw error; return fail(); }
}
export function inspectOfficePackage(bytes: Uint8Array, name: string, maxExpanded?: number) {
  const kind = editableOfficeKind(name);
  if (!kind) throw new OfficePackageError("format");
  const parts = unpack(bytes, maxExpanded);
  if (!parts["[Content_Types].xml"] || !parts[kind === "word" ? "word/document.xml" : "xl/workbook.xml"]) throw new OfficePackageError("format");
  for (const [path, data] of Object.entries(parts)) {
    if (!/\.(xml|rels)$/i.test(path)) continue;
    const xml = strFromU8(data);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new OfficePackageError("external");
    if (path.endsWith(".rels")) {
      for (const tag of tags(xml, "Relationship")) {
        const target = attr(tag, "Target");
        const hyperlink = attr(tag, "Type").endsWith("/hyperlink");
        const remote = /^[a-z][\w+.-]*:|^\/\/|^\\/i.test(target.trim());
        if ((!hyperlink && (remote || attr(tag, "TargetMode").toLowerCase() === "external")) || (hyperlink && remote && !/^(https?:|mailto:)/i.test(target))) throw new OfficePackageError("external");
      }
    }
  }
  return { kind, hasMacros: Object.keys(parts).some((path) => /vbaProject\.bin$/i.test(path)) };
}
function mergeXml(source: string, output: string, root: string, child: string, key: string): string {
  const originals = tags(source, child); const edited = tags(output, child);
  if (child === "Relationship") for (const tag of originals) {
    const matching = edited.find((candidate) => attr(candidate, key) === attr(tag, key));
    if (matching && ["Type", "Target", "TargetMode"].some((field) => attr(matching, field) !== attr(tag, field))) throw new OfficePackageError("format");
  }
  const keys = new Set(edited.map((tag) => attr(tag, key)));
  const missing = originals.filter((tag) => !keys.has(attr(tag, key)));
  if (!missing.length) return output;
  const close = new RegExp(`</(?:[\\w-]+:)?${root}\\s*>`);
  if (close.test(output)) return output.replace(close, `${missing.join("")}$&`);
  return output.replace(new RegExp(`<${root}([^>]*)/>`), `<${root}$1>${missing.join("")}</${root}>`);
}
/** Bewaar delen die de editor niet kent; macro's blijven uitsluitend bytes. */
export function preserveOfficeParts(source: Uint8Array, output: Uint8Array, name: string): Uint8Array {
  inspectOfficePackage(source, name); inspectOfficePackage(output, name);
  const before = unpack(source); const after = unpack(output);
  for (const [path, data] of Object.entries(before)) {
    if (!after[path] || /vbaProject\.bin$/i.test(path)) { after[path] = data; continue; }
    if (path === "[Content_Types].xml") {
      let xml = mergeXml(strFromU8(data), strFromU8(after[path]), "Types", "Override", "PartName");
      xml = mergeXml(strFromU8(data), xml, "Types", "Default", "Extension");
      if (/\.xlsm$/i.test(name)) xml = xml.replace(/application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet\.main\+xml/g, "application/vnd.ms-excel.sheet.macroEnabled.main+xml");
      after[path] = strToU8(xml);
    } else if (path.endsWith(".rels")) after[path] = strToU8(mergeXml(strFromU8(data), strFromU8(after[path]), "Relationships", "Relationship", "Id"));
  }
  return zipSync(after);
}

/** Kleine, geldige OOXML-startbestanden zonder tijdelijke serveropslag. */
export function createOfficePackage(kind: OfficeKind): Uint8Array {
  const ns = "http://schemas.openxmlformats.org";
  const types = `${ns}/package/2006/content-types`;
  const rels = `${ns}/package/2006/relationships`;
  const office = `${ns}/officeDocument/2006/relationships`;
  const entries: Record<string, string> = {
    "_rels/.rels": `<Relationships xmlns="${rels}"><Relationship Id="r1" Type="${office}/officeDocument" Target="${kind === "word" ? "word/document.xml" : "xl/workbook.xml"}"/></Relationships>`,
  };
  if (kind === "word") {
    entries["[Content_Types].xml"] = `<Types xmlns="${types}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
    entries["word/document.xml"] = `<w:document xmlns:w="${ns}/wordprocessingml/2006/main"><w:body><w:p/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  } else {
    const main = `${ns}/spreadsheetml/2006/main`;
    entries["[Content_Types].xml"] = `<Types xmlns="${types}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    entries["xl/workbook.xml"] = `<workbook xmlns="${main}" xmlns:r="${office}"><sheets><sheet name="Blad1" sheetId="1" r:id="r1"/></sheets></workbook>`;
    entries["xl/_rels/workbook.xml.rels"] = `<Relationships xmlns="${rels}"><Relationship Id="r1" Type="${office}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Type="${office}/styles" Target="styles.xml"/></Relationships>`;
    entries["xl/styles.xml"] = `<styleSheet xmlns="${main}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    // De editor leidt toetsenbord- en scrollbereik af van expliciete cellen.
    // Een lege standaard-opgemaakte cel houdt een nieuw werkblad bruikbaar;
    // er wordt geen voorbeeldwaarde toegevoegd en uploads blijven ongewijzigd.
    entries["xl/worksheets/sheet1.xml"] = `<worksheet xmlns="${main}"><dimension ref="A1:Z1000"/><sheetViews><sheetView workbookViewId="0" showGridLines="1" showRowColHeaders="1"/></sheetViews><sheetData><row r="1000"><c r="Z1000" s="0"/></row></sheetData></worksheet>`;
  }
  return zipSync(Object.fromEntries(Object.entries(entries).map(([path, text]) => [path, strToU8(text)])));
}
