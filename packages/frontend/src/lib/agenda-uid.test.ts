import { test } from "node:test";
import assert from "node:assert/strict";
import { isEigenAfspraak, nieuweAfspraakUid } from "./agenda-mailserver.ts";

test("nieuweAfspraakUid: het kenmerk draagt de site waar de afspraak gemaakt is", () => {
  const uid = nieuweAfspraakUid("ERP.Voorbeeld.nl");
  assert.match(uid, /^ynext-[0-9a-z-]+@erp\.voorbeeld\.nl$/);
  assert.equal(isEigenAfspraak(uid), true);
});

test("nieuweAfspraakUid: zonder bekende site blijft het kenmerk bruikbaar", () => {
  const uid = nieuweAfspraakUid("");
  assert.match(uid, /^ynext-[0-9a-z-]+$/);
  assert.equal(isEigenAfspraak(uid), true);
});

test("nieuweAfspraakUid: elke afspraak een eigen kenmerk", () => {
  assert.notEqual(nieuweAfspraakUid("erp.voorbeeld.nl"), nieuweAfspraakUid("erp.voorbeeld.nl"));
});

test("isEigenAfspraak: een afspraak uit een ander programma is niet van ons", () => {
  assert.equal(isEigenAfspraak("040000008200E00074C5B7101A82E008@elders.voorbeeld.nl"), false);
  assert.equal(isEigenAfspraak(undefined), false);
});
