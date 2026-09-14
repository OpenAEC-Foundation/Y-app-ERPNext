import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lettertypeStack,
  opmaakStijl,
  parseMailOpmaak,
  STANDAARD_MAIL_OPMAAK,
  type MailOpmaak,
} from "./mailOpmaak.ts";

/**
 * Tests voor de huisstijlinstelling van uitgaande e-mail.
 *
 * De bron is een vrij tekstveld in ERPNext, dus alles wat eruit komt is
 * verdacht. Wat hier vastligt is dat één kapotte waarde niet de rest meesleept
 * — anders verliest een mail zijn lettertype omdat iemand ooit een kleur
 * verkeerd overtypte.
 */

test("een volledige instelling komt er ongeschonden uit", () => {
  const uit = parseMailOpmaak('{"lettertype":"Georgia","grootte":14,"kleur":"#aa0000"}');
  assert.deepEqual(uit, { lettertype: "Georgia", grootte: 14, kleur: "#aa0000" });
});

test("niets opgeslagen betekent de standaard", () => {
  assert.deepEqual(parseMailOpmaak(""), STANDAARD_MAIL_OPMAAK);
  assert.deepEqual(parseMailOpmaak(null), STANDAARD_MAIL_OPMAAK);
  assert.deepEqual(parseMailOpmaak(undefined), STANDAARD_MAIL_OPMAAK);
});

test("onleesbare tekst valt terug op de standaard in plaats van te breken", () => {
  assert.deepEqual(parseMailOpmaak("{niet eens json"), STANDAARD_MAIL_OPMAAK);
  assert.deepEqual(parseMailOpmaak("[1,2,3]"), STANDAARD_MAIL_OPMAAK);
});

test("elk veld valt apart terug", () => {
  // Eén verkeerde kleur hoort het lettertype niet mee te nemen.
  const uit = parseMailOpmaak('{"lettertype":"Verdana","grootte":13,"kleur":"rood"}');
  assert.equal(uit.lettertype, "Verdana");
  assert.equal(uit.grootte, STANDAARD_MAIL_OPMAAK.grootte, "13 staat niet in de lijst");
  assert.equal(uit.kleur, STANDAARD_MAIL_OPMAAK.kleur);
});

test("een lettertype buiten de lijst wordt niet doorgelaten", () => {
  // Anders staat er straks een naam in de mail die geen enkele ontvanger heeft.
  assert.equal(parseMailOpmaak('{"lettertype":"Comic Sans MS"}').lettertype,
    STANDAARD_MAIL_OPMAAK.lettertype);
});

test("een grootte als tekst telt gewoon mee", () => {
  assert.equal(parseMailOpmaak('{"grootte":"16"}').grootte, 16);
});

test("een kleur mag in hoofdletters staan", () => {
  assert.equal(parseMailOpmaak('{"kleur":"#AB12CD"}').kleur, "#ab12cd");
});

test("een korte kleurcode telt niet", () => {
  // `#abc` is geldige CSS maar geen geldige waarde hier; half accepteren
  // levert een mail op waarin de kleur soms wel en soms niet aankomt.
  assert.equal(parseMailOpmaak('{"kleur":"#abc"}').kleur, STANDAARD_MAIL_OPMAAK.kleur);
});

test("elk lettertype draagt een terugval-reeks", () => {
  // Zonder reeks valt de ontvanger terug op de standaard van zijn programma,
  // en dan is de huisstijl alsnog weg.
  for (const naam of ["Arial", "Georgia", "Courier New"]) {
    assert.match(lettertypeStack(naam), /,/);
  }
  assert.equal(lettertypeStack("bestaat niet"), lettertypeStack("Arial"));
});

test("de stijl is inline bruikbaar in een mail", () => {
  const opmaak: MailOpmaak = { lettertype: "Georgia", grootte: 12, kleur: "#112233" };
  const stijl = opmaakStijl(opmaak);
  assert.match(stijl, /font-family:Georgia, 'Times New Roman', serif/);
  // Punten en niet pixels: mailprogramma's rekenen in pt.
  assert.match(stijl, /font-size:12pt/);
  assert.match(stijl, /color:#112233/);
  assert.equal(stijl.includes("\n"), false, "moet in één attribuut passen");
});
