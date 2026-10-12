import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectOfficeNotices, writeOfficeNotices } from "./office-notices.mjs";

const roots = ["@stll/folio-react", "@betteroffice/xlsx-react", "@betteroffice/xlsx", "use-intl", "fflate"];
function fixture() {
  const base = mkdtempSync(join(tmpdir(), "ynext-office-notices-"));
  const frontend = join(base, "frontend"), legal = join(base, "legal"), output = join(base, "output");
  mkdirSync(frontend); mkdirSync(legal); mkdirSync(output);
  for (const name of roots) {
    const path = join(base, "node_modules", name);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "package.json"), JSON.stringify({ name, version: "0.3.0", license: "Apache-2.0", exports: "./dist/index.js", dependencies: name === roots[0] ? { "@fontsource/test-face": "1.0.0" } : {} }));
    writeFileSync(join(path, "LICENSE"), "License for " + name);
  }
  const font = join(base, "node_modules", "@fontsource/test-face");
  mkdirSync(font, { recursive: true });
  writeFileSync(join(font, "package.json"), JSON.stringify({ name: "@fontsource/test-face", version: "1.0.0", license: "OFL-1.1" }));
  writeFileSync(join(font, "LICENSE"), "Font copyright and license");
  writeFileSync(join(base, "node_modules", roots[0], "NOTICE.md"), "Original upstream copyright");
  for (const file of ["PROVENANCE.txt", "NOTICE", "THIRD-PARTY-NOTICES.md", "OFL-Carlito.txt"]) writeFileSync(join(legal, file), "Pinned " + file);
  return {base, frontend, legal, output};
}
test("Office-bundel bevat oorspronkelijke notices en licenties van transitieve fonts", () => {
  const f = fixture();
  try {
    const text = collectOfficeNotices(f.frontend, f.legal);
    assert.match(text, /Original upstream copyright/);
    assert.match(text, /Font copyright and license/);
    assert.match(text, /Pinned THIRD-PARTY-NOTICES/);
    assert.equal(text, collectOfficeNotices(f.frontend, f.legal));
    const path = writeOfficeNotices(f.frontend, f.output, f.legal);
    assert.equal(readFileSync(path, "utf8"), text);
  } finally { rmSync(f.base, {recursive:true, force:true}); }
});
test("Een ontbrekende verplichte vermelding weigert een incompleet distributiepakket", () => {
  const f = fixture();
  try {
    rmSync(join(f.legal, "NOTICE"));
    assert.throws(() => collectOfficeNotices(f.frontend, f.legal), /vermelding ontbreekt/);
  } finally { rmSync(f.base, {recursive:true, force:true}); }
});
