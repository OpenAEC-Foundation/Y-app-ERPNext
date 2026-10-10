import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DOELBRANCH, DOELREPO, leesVersie, parseArgs, slaOver, stelSamen, zetVersie,
} from "./release-frappe-app.mjs";

function metMappen(werk) {
  const basis = mkdtempSync(join(tmpdir(), "release-"));
  try {
    return werk(basis);
  } finally {
    rmSync(basis, { recursive: true, force: true });
  }
}

function schrijf(pad, inhoud) {
  mkdirSync(join(pad, ".."), { recursive: true });
  writeFileSync(pad, inhoud);
}

test("de app gaat naar de eigen repository, op de branch van ERPNext 16", () => {
  assert.equal(DOELREPO, "OpenAEC-Foundation/y_next");
  assert.equal(DOELBRANCH, "version-16");
});

test("parseArgs: doel, en publiceren alleen met de vlag", () => {
  assert.deepEqual(parseArgs(["--doel", "../y_next"]), {
    doel: "../y_next", publiceer: false, zonderTests: false, zonderBouw: false, trailer: "",
  });
  assert.deepEqual(parseArgs(["--doel=uit", "--publiceer", "--zonder-tests", "--zonder-bouw", "--trailer", "Regel"]), {
    doel: "uit", publiceer: true, zonderTests: true, zonderBouw: true, trailer: "Regel",
  });
});

test("parseArgs: zonder doel is er niets om samen te stellen", () => {
  assert.throws(() => parseArgs([]), /--doel/);
  assert.throws(() => parseArgs(["--publiceer"]), /--doel/);
});

test("leesVersie: de versie van Y-next uit package.json", () => {
  metMappen((basis) => {
    writeFileSync(join(basis, "package.json"), JSON.stringify({ name: "y", version: "0.40.0" }));
    assert.equal(leesVersie(basis), "0.40.0");
    writeFileSync(join(basis, "package.json"), JSON.stringify({ name: "y", version: "latest" }));
    assert.throws(() => leesVersie(basis), /versie/);
  });
});

test("zetVersie: de app draagt de versie van Y-next", () => {
  assert.equal(zetVersie('__version__ = "0.39.5"\n', "0.40.0"), '__version__ = "0.40.0"\n');
  assert.equal(zetVersie("import x\n__version__ = '0.1.0'\n", "0.40.0"), 'import x\n__version__ = "0.40.0"\n');
  assert.throws(() => zetVersie("# leeg\n", "0.40.0"), /__version__/);
});

test("slaOver: wat Python en het besturingssysteem achterlaten gaat niet mee", () => {
  assert.equal(slaOver("__pycache__"), true);
  assert.equal(slaOver("hooks.cpython-314.pyc"), true);
  assert.equal(slaOver("y_next.egg-info"), true);
  assert.equal(slaOver(".DS_Store"), true);
  assert.equal(slaOver("hooks.py"), false);
  // Het manifest van de bundel staat in een map met een punt ervoor en moet mee.
  assert.equal(slaOver(".vite"), false);
});

test("stelSamen: kopieert de app, zet de versie en ruimt op wat niet meer bestaat", () => {
  metMappen((basis) => {
    const bron = join(basis, "frappe-app");
    const doel = join(basis, "y_next");
    schrijf(join(bron, "pyproject.toml"), "[project]\n");
    schrijf(join(bron, "y_next", "__init__.py"), '__version__ = "0.39.5"\n');
    schrijf(join(bron, "y_next", "hooks.py"), "app_name = 'y_next'\n");
    schrijf(join(bron, "y_next", "public", "app", ".vite", "manifest.json"), "{}");
    schrijf(join(bron, "y_next", "__pycache__", "hooks.cpython-314.pyc"), "x");
    // Het doel is een bestaande checkout met iets van een vorige release.
    schrijf(join(doel, ".git", "HEAD"), "ref: refs/heads/version-16\n");
    schrijf(join(doel, "y_next", "oud.py"), "# bestaat niet meer\n");

    const aantal = stelSamen({ bron, doel, versie: "0.40.0" });

    assert.equal(aantal, 4);
    assert.equal(readFileSync(join(doel, "y_next", "__init__.py"), "utf8"), '__version__ = "0.40.0"\n');
    assert.ok(existsSync(join(doel, "pyproject.toml")));
    assert.ok(existsSync(join(doel, "y_next", "public", "app", ".vite", "manifest.json")));
    assert.ok(!existsSync(join(doel, "y_next", "__pycache__")));
    assert.ok(!existsSync(join(doel, "y_next", "oud.py")), "een bestand van een vorige release verdwijnt");
    assert.ok(existsSync(join(doel, ".git", "HEAD")), "de geschiedenis van het doel blijft staan");
    // De bron zelf verandert niet.
    assert.equal(readFileSync(join(bron, "y_next", "__init__.py"), "utf8"), '__version__ = "0.39.5"\n');
  });
});

test("stelSamen: zonder gebouwde bundel is er niets uit te brengen", () => {
  metMappen((basis) => {
    const bron = join(basis, "frappe-app");
    schrijf(join(bron, "y_next", "__init__.py"), '__version__ = "0.39.5"\n');
    assert.throws(() => stelSamen({ bron, doel: join(basis, "y_next"), versie: "0.40.0" }), /bundel/);
  });
});
