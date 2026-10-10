import test from "node:test";
import assert from "node:assert/strict";
import {
  buurAfbeeldingen, isEigenBestand, isAfbeeldingNaam, isCadNaam, isLeesbaarOffice, officeSoort, voorbeeldSoort,
} from "./bijlage-soort.ts";

test("Office-soorten", () => {
  assert.equal(officeSoort("Offerte.docx"), "word");
  assert.equal(officeSoort("Begroting.XLSX"), "excel");
  assert.equal(officeSoort("uren.csv"), "csv");
  assert.equal(officeSoort("tekening.dwg"), null);
  assert.equal(officeSoort(""), null);
});

test("alleen de formaten die de browser echt kan lezen", () => {
  assert.equal(isLeesbaarOffice("Offerte.docx"), true);
  assert.equal(isLeesbaarOffice("Begroting.xlsx"), true);
  assert.equal(isLeesbaarOffice("Oud.doc"), false);
  assert.equal(isLeesbaarOffice("Oud.xls"), false);
  assert.equal(isLeesbaarOffice("notitie.odt"), false);
});

test("tekeningen", () => {
  assert.equal(isCadNaam("3070-CP-21.dwg"), true);
  assert.equal(isCadNaam("plattegrond.DXF"), true);
  assert.equal(isCadNaam("foto.png"), false);
});

test("welk voorbeeldpaneel", () => {
  assert.equal(voorbeeldSoort("rapport.pdf"), "pdf");
  assert.equal(voorbeeldSoort("model.ifc"), "ifc");
  assert.equal(voorbeeldSoort("plattegrond.dwg"), "cad");
  assert.equal(voorbeeldSoort("brief.docx"), "office");
  assert.equal(voorbeeldSoort("archief.zip"), null);
  assert.equal(voorbeeldSoort("brief.doc"), null);
});

test("afbeeldingen die de browser zelf kan tonen", () => {
  assert.equal(isAfbeeldingNaam("foto.JPG"), true);
  assert.equal(isAfbeeldingNaam("IMG_2041.jpeg"), true);
  assert.equal(isAfbeeldingNaam("schets.png"), true);
  assert.equal(isAfbeeldingNaam("logo.svg"), true);
  assert.equal(isAfbeeldingNaam("scan.webp"), true);
  // Wat een browser niet toont, blijft een download: een lege viewer is erger.
  assert.equal(isAfbeeldingNaam("foto.heic"), false);
  assert.equal(isAfbeeldingNaam("scan.tiff"), false);
  assert.equal(isAfbeeldingNaam("rapport.pdf"), false);
  assert.equal(isAfbeeldingNaam(""), false);
  assert.equal(voorbeeldSoort("bouwplaats.jpg"), "afbeelding");
});

test("bladeren tussen de afbeeldingen van één mail", () => {
  const bijlagen = [
    { file_url: "/private/files/a.jpg", file_name: "a.jpg" },
    { file_url: "/private/files/rapport.pdf", file_name: "rapport.pdf" },
    { file_url: "/private/files/b.png", file_name: "b.png" },
    { file_url: "/private/files/c.jpg", file_name: "c.jpg" },
  ];
  // Alleen de afbeeldingen tellen mee, in de volgorde van de mail.
  const midden = buurAfbeeldingen(bijlagen, "/private/files/b.png");
  assert.equal(midden.positie, 2);
  assert.equal(midden.totaal, 3);
  assert.equal(midden.vorige?.file_name, "a.jpg");
  assert.equal(midden.volgende?.file_name, "c.jpg");
  // Aan de randen is er geen vorige of volgende; er wordt niet rondgebladerd.
  assert.equal(buurAfbeeldingen(bijlagen, "/private/files/a.jpg").vorige, null);
  assert.equal(buurAfbeeldingen(bijlagen, "/private/files/c.jpg").volgende, null);
  // Eén afbeelding, of een bijlage die er niet tussen staat: niets om te bladeren.
  const los = buurAfbeeldingen([bijlagen[0], bijlagen[1]], "/private/files/a.jpg");
  assert.deepEqual([los.positie, los.totaal, los.vorige, los.volgende], [1, 1, null, null]);
  const onbekend = buurAfbeeldingen(bijlagen, "/private/files/weg.jpg");
  assert.deepEqual([onbekend.positie, onbekend.totaal, onbekend.vorige, onbekend.volgende], [0, 3, null, null]);
});

test("hetzelfde bestand onder twee namen telt bij het bladeren één keer", () => {
  // Zo levert ERPNext de plaatjes uit een Outlook-mail: één bestand, twee File-records.
  const dubbel = [
    { file_url: "/private/files/image008.png", file_name: "xtZO9M3.png" },
    { file_url: "/private/files/image009.png", file_name: "image009.png" },
    { file_url: "/private/files/image008.png", file_name: "image008.png" },
    { file_url: "/private/files/image010.png", file_name: "image010.png" },
  ];
  const eerste = buurAfbeeldingen(dubbel, "/private/files/image008.png");
  assert.deepEqual([eerste.positie, eerste.totaal], [1, 3]);
  assert.equal(eerste.volgende?.file_url, "/private/files/image009.png");
  // Vanaf de tweede kom je bij de derde, niet terug bij de eerste.
  assert.equal(buurAfbeeldingen(dubbel, "/private/files/image009.png").volgende?.file_url, "/private/files/image010.png");
});

test("de schermvullende viewer toont alleen bestanden van de eigen server", () => {
  assert.equal(isEigenBestand("/private/files/foto.jpg"), true);
  assert.equal(isEigenBestand("/files/rapport.pdf"), true);
  // Alles van buiten, of iets dat geen bestand is: niet tonen.
  assert.equal(isEigenBestand("https://elders.example/pagina.html"), false);
  assert.equal(isEigenBestand("//elders.example/files/x.png"), false);
  assert.equal(isEigenBestand("javascript:alert(1)"), false);
  assert.equal(isEigenBestand("data:text/html,<p>x</p>"), false);
  assert.equal(isEigenBestand("/api/method/logout"), false);
  assert.equal(isEigenBestand("/files/../api/method/x"), false);
  assert.equal(isEigenBestand("/files\\..\\x"), false);
  assert.equal(isEigenBestand(""), false);
});
