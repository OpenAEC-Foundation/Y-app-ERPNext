import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { editableOfficeKind, inspectOfficePackage, preserveOfficeParts, OfficeRevision, officeEditorUrl, createOfficePackage } from "./office.ts";

const types = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/><Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>';
const fixture = (extra: Record<string, Uint8Array> = {}) => zipSync({ "[Content_Types].xml": strToU8(types), "xl/workbook.xml": strToU8('<workbook/>'), ...extra });

test("Office herkent alleen bewerkbare OOXML-formaten", () => {
  for (const [name, want] of [["brief.DOCX", "word"], ["boek.xlsm", "excel"], ["boek.xlsx", "excel"], ["oud.doc", null], ["oud.xls", null], ["boek.csv", null]]) assert.equal(editableOfficeKind(name), want);
});
test("Openen weigert corrupte en verkeerd benoemde documenten", () => {
  assert.throws(() => inspectOfficePackage(new Uint8Array([1, 2, 3]), "a.docx"));
  assert.throws(() => inspectOfficePackage(fixture(), "a.docx"));
  assert.equal(inspectOfficePackage(fixture(), "a.xlsm").kind, "excel");
});
test("Openen weigert externe beelden en XML-entiteiten zonder netwerkverkeer", () => {
  assert.throws(() => inspectOfficePackage(fixture({ "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="r1" Type="image" Target="https://remote.invalid/image.png" TargetMode="External"/></Relationships>') }), "a.xlsx"));
  assert.throws(() => inspectOfficePackage(fixture({ "xl/workbook.xml": strToU8('<!DOCTYPE x SYSTEM "https://remote.invalid/data"><workbook/>') }), "a.xlsx"));
});
test("Openen begrenst uitgevouwen archieven voordat decomprimeren begint", () => {
  assert.throws(() => inspectOfficePackage(fixture({ "xl/media/big.bin": new Uint8Array(2_000) }), "a.xlsx", 1_000));
  assert.throws(() => inspectOfficePackage(fixture({ "../escape": strToU8("x") }), "a.xlsx"));
});
test("Externe relaties worden ook zonder TargetMode of met expliciete sluiting geweigerd", () => {
  for (const rel of ['<Relationship Id="r1" Type="image" Target="https://remote.invalid/a"></Relationship>', '<p:Relationship Id="r1" Type="image" Target="//remote.invalid/a" TargetMode="Ext&#101;rnal"></p:Relationship>']) {
    assert.throws(() => inspectOfficePackage(fixture({ "xl/_rels/workbook.xml.rels": strToU8(`<Relationships>${rel}</Relationships>`) }), "a.xlsx"));
  }
});
test("Gewijzigde relatiebindingen worden niet stil gecombineerd", () => {
  const original = fixture({ "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="r1" Type="image" Target="media/a.png"/></Relationships>') });
  const edited = fixture({ "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="r1" Type="image" Target="media/b.png"/></Relationships>') });
  assert.throws(() => preserveOfficeParts(original, edited, "a.xlsx"));
});
test("Opslaan bewaart macrobytes, onbekende delen en hun package-relaties", () => {
  const original = fixture({ "xl/vbaProject.bin": new Uint8Array([7, 8, 9]), "customXml/item1.xml": strToU8('<custom>intact</custom>'), "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="macro" Type="vbaProject" Target="vbaProject.bin"/></Relationships>') });
  const edited = zipSync({ "[Content_Types].xml": strToU8('<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>'), "xl/workbook.xml": strToU8('<workbook><changed/></workbook>'), "xl/_rels/workbook.xml.rels": strToU8('<Relationships/>') });
  const out = unzipSync(preserveOfficeParts(original, edited, "a.xlsm"));
  assert.deepEqual(out["xl/vbaProject.bin"], new Uint8Array([7, 8, 9]));
  assert.equal(strFromU8(out["customXml/item1.xml"]), '<custom>intact</custom>');
  assert.match(strFromU8(out["xl/workbook.xml"]), /changed/);
  assert.match(strFromU8(out["[Content_Types].xml"]), /macroEnabled/);
  assert.match(strFromU8(out["xl/_rels/workbook.xml.rels"]), /vbaProject/);
});
test("Nieuwere wijzigingen blijven onopgeslagen na een eerdere save", () => {
  const revision = new OfficeRevision(); revision.change(); const snapshot = revision.current; revision.change(); revision.saved(snapshot);
  assert.equal(revision.dirty, true); revision.saved(revision.current); assert.equal(revision.dirty, false);
});
test("Editorlinks gebruiken alleen een File-document-id en nooit een bestandspad", () => {
  assert.equal(officeEditorUrl("file id/?#"), "#/office?file=file+id%2F%3F%23");
  assert.throws(() => officeEditorUrl(""));
});
test("Nieuwe documenten en werkboeken zijn geldige lege OOXML-pakketten", () => {
  assert.equal(inspectOfficePackage(createOfficePackage("word"), "nieuw.docx").kind, "word");
  const workbook = unzipSync(createOfficePackage("excel"));
  assert.match(strFromU8(workbook["xl/workbook.xml"]), /Blad1/);
  assert.match(strFromU8(workbook["xl/worksheets/sheet1.xml"]), /sheetData/);
});
test("Archieven met een vervalste uitgevouwen lengte worden geweigerd", () => {
  const archive = fixture(); const changed = new Uint8Array(archive); const view = new DataView(changed.buffer);
  for (let i = 0; i < changed.length - 46; i++) {
    if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 24, 1, true); break; }
  }
  assert.throws(() => inspectOfficePackage(changed, "boek.xlsm"));
});
