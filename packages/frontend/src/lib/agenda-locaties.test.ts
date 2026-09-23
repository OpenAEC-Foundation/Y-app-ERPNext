import test from "node:test";
import assert from "node:assert/strict";
import { adresRegel, locatieTekst, ordenLocaties, standaardLocatie, type LocatieAdres } from "./agenda-locaties.ts";

const adres = (x: Partial<LocatieAdres>): LocatieAdres => ({ name: "a", titel: "", straat: "", postcode: "", plaats: "", eigen: false, ...x });

test("adresregel en locatietekst", () => {
  const a = adres({ titel: "Bouwgroep Schrijver B.V.", straat: "Spoorstraat 16a", postcode: "4431 NK", plaats: "'s-Gravenpolder" });
  assert.equal(adresRegel(a), "Spoorstraat 16a, 4431 NK 's-Gravenpolder");
  assert.equal(locatieTekst(a), "Bouwgroep Schrijver B.V., Spoorstraat 16a, 4431 NK 's-Gravenpolder");
});

test("lege stukken vallen weg", () => {
  assert.equal(locatieTekst(adres({ titel: "Domera", plaats: "Dordrecht" })), "Domera, Dordrecht");
});

test("dubbele adressen één keer, eigen bedrijven eerst", () => {
  const lijst = ordenLocaties([
    adres({ name: "1", titel: "Klant", straat: "A 1" }),
    adres({ name: "2", titel: "Klant", straat: "A 1" }),
    adres({ name: "3", titel: "3BM Bouwtechniek V.O.F.", straat: "Burgemeester de Raadtsingel 31", eigen: true }),
    adres({ name: "4" }),
  ]);
  assert.deepEqual(lijst.map((a) => a.name), ["3", "1"]);
});

test("standaardLocatie: het adres van het eigen bedrijf, anders het eerste", () => {
  const adres = (name: string, titel: string, bedrijf?: string): LocatieAdres =>
    ({ name, titel, straat: "Burgemeester de Raadtsingel 31", postcode: "", plaats: "Dordrecht", eigen: true, bedrijf });
  const eigen = [
    adres("a", "Vroughindeweij Industries B.V.", "Vroughindeweij Industries B.V."),
    adres("b", "3BM Bouwtechniek V.O.F.", "3BM Bouwtechniek V.O.F."),
  ];
  assert.equal(standaardLocatie(eigen, "3BM Bouwtechniek V.O.F.")?.name, "b");
  assert.equal(standaardLocatie(eigen, "Onbekend B.V.")?.name, "a");
  assert.equal(standaardLocatie([], "3BM Bouwtechniek V.O.F."), undefined);
});
