import test from "node:test";
import assert from "node:assert/strict";
import { isBelangrijk } from "./mail-belangrijk.ts";

test("markering van de ingelogde gebruiker telt", () => {
  assert.equal(isBelangrijk(["maarten@3bm.co.nl"], "maarten@3bm.co.nl"), true);
  assert.equal(isBelangrijk('["Maarten@3BM.co.nl"]', "maarten@3bm.co.nl"), true);
  assert.equal(isBelangrijk(["nino@3bm.co.nl"], "maarten@3bm.co.nl"), false);
});

test("lege of rare waarden geven geen markering", () => {
  assert.equal(isBelangrijk(null, "maarten@3bm.co.nl"), false);
  assert.equal(isBelangrijk("geen lijst", "maarten@3bm.co.nl"), false);
  assert.equal(isBelangrijk(["maarten@3bm.co.nl"], ""), false);
});
