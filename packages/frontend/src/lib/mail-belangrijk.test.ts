import test from "node:test";
import assert from "node:assert/strict";
import { isBelangrijk } from "./mail-belangrijk.ts";

test("markering van de ingelogde gebruiker telt", () => {
  assert.equal(isBelangrijk(["maarten@3xz.co.nl"], "maarten@3xz.co.nl"), true);
  assert.equal(isBelangrijk('["Maarten@3XZ.co.nl"]', "maarten@3xz.co.nl"), true);
  assert.equal(isBelangrijk(["nino@3xz.co.nl"], "maarten@3xz.co.nl"), false);
});

test("lege of rare waarden geven geen markering", () => {
  assert.equal(isBelangrijk(null, "maarten@3xz.co.nl"), false);
  assert.equal(isBelangrijk("geen lijst", "maarten@3xz.co.nl"), false);
  assert.equal(isBelangrijk(["maarten@3xz.co.nl"], ""), false);
});
