import test from "node:test";
import assert from "node:assert/strict";
import {
  berichtSleutel,
  korteHash,
  likesPerBericht,
  nieuweSleutel,
  reactieQuery,
  reactieUitLink,
  sleutelUitLink,
  type ReactieDrager,
} from "./berichten-reacties.ts";

const BASIS = "/y-next#/messenger";

test("sleutelUitLink: leest de gedeelde sleutel, ook naast een afbeelding", () => {
  assert.equal(sleutelUitLink(`${BASIS}?k=abc12345-def`), "abc12345-def");
  assert.equal(sleutelUitLink(`${BASIS}?img=%2Fprivate%2Ffiles%2Fa.jpg&k=abc12345-def`), "abc12345-def");
  assert.equal(sleutelUitLink(BASIS), null);
  // Wat er niet uitziet als een sleutel, wordt niet als sleutel gebruikt.
  assert.equal(sleutelUitLink(`${BASIS}?k=%3Cscript%3E`), null);
});

test("nieuweSleutel: elke keer anders, en bruikbaar in een link", () => {
  const a = nieuweSleutel();
  const b = nieuweSleutel();
  assert.notEqual(a, b);
  assert.equal(sleutelUitLink(`${BASIS}?k=${a}`), a);
});

test("reactieQuery en reactieUitLink: heen en terug, aan en uit", () => {
  assert.deepEqual(reactieUitLink(`${BASIS}?${reactieQuery("abc12345", true)}`), { sleutel: "abc12345", aan: true });
  assert.deepEqual(
    reactieUitLink(`${BASIS}?${reactieQuery("img:/private/files/a b.jpg", false)}`),
    { sleutel: "img:/private/files/a b.jpg", aan: false },
  );
  // Een gewoon bericht is geen like.
  assert.equal(reactieUitLink(`${BASIS}?k=abc12345`), null);
  assert.equal(reactieUitLink(BASIS), null);
});

test("berichtSleutel: beide kopieën van een bericht komen op dezelfde sleutel uit", () => {
  const nieuw = {
    link: `${BASIS}?k=abc12345`, afzender: "lara@3bm.co.nl", ontvanger: "nino@3bm.co.nl",
    body: "Hoi", createdAt: "2026-09-15 10:00:01",
  };
  // Nieuw: de gedeelde sleutel wint van alles.
  assert.equal(berichtSleutel(nieuw), "abc12345");
  // Oud met afbeelding: het bestand.
  assert.equal(berichtSleutel({ ...nieuw, link: BASIS, imageUrl: "/private/files/a.jpg" }), "img:/private/files/a.jpg");
  // Oud, alleen tekst: ontvangerskopie en eigen kopie liggen een seconde uit elkaar.
  const ontvangen = berichtSleutel({ ...nieuw, link: BASIS, createdAt: "2026-09-15 10:00:01.123456" });
  const verzonden = berichtSleutel({ ...nieuw, link: BASIS, createdAt: "2026-09-15 10:00:02.654321", afzender: "Lara@3bm.co.nl" });
  assert.equal(ontvangen, verzonden);
  // Andere inhoud, andere sleutel.
  assert.notEqual(berichtSleutel({ ...nieuw, link: BASIS, body: "Doei" }), ontvangen);
});

test("korteHash: stabiel, en verschillend voor verschillende tekst", () => {
  assert.equal(korteHash("Hoi"), korteHash("Hoi"));
  assert.notEqual(korteHash("Hoi"), korteHash("Hoi!"));
  assert.equal(korteHash("").length, 8);
});

function like(direction: "in" | "out", createdAt: string, sleutel: string, aan: boolean): ReactieDrager {
  return { direction, counterpart: "lara@3bm.co.nl", createdAt, reactie: { sleutel, aan } };
}

test("likesPerBericht: per persoon telt de laatste stand, en je eigen like wordt herkend", () => {
  const stand = likesPerBericht([
    like("in", "2026-09-15 10:00:00", "s1", true),
    like("out", "2026-09-15 10:01:00", "s1", true),
    // Eigen like weer ingetrokken.
    like("out", "2026-09-15 10:02:00", "s1", false),
    like("out", "2026-09-15 10:03:00", "s2", true),
    // Een gewoon bericht telt niet.
    { direction: "in", counterpart: "lara@3bm.co.nl", createdAt: "2026-09-15 10:04:00" },
  ]);
  assert.deepEqual(stand.get("s1"), { aantal: 1, ikVindLeuk: false });
  assert.deepEqual(stand.get("s2"), { aantal: 1, ikVindLeuk: true });
  assert.equal(stand.size, 2);
});

test("likesPerBericht: de tijd beslist, niet de volgorde waarin de lijst binnenkomt", () => {
  const stand = likesPerBericht([
    like("out", "2026-09-15 10:02:00", "s1", true),
    like("out", "2026-09-15 10:01:00", "s1", false),
  ]);
  assert.deepEqual(stand.get("s1"), { aantal: 1, ikVindLeuk: true });
});

test("likesPerBericht: ingetrokken door iedereen betekent geen stand", () => {
  const stand = likesPerBericht([
    like("in", "2026-09-15 10:00:00", "s1", true),
    like("in", "2026-09-15 10:05:00", "s1", false),
  ]);
  assert.equal(stand.has("s1"), false);
});
