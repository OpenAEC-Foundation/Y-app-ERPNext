/**
 * Welke bijlagen meegaan als je een e-mail doorstuurt.
 *
 * Doorsturen nam de bijlagen eerder niet mee; de doorstuurtekst noemde alleen
 * hun namen. De reden die daarbij stond — dat ERPNext bij het versturen alleen
 * bestanden zou aannemen die je zelf hebt geüpload — klopt niet:
 * `communication.email.make` neemt de docnaam van elk `File` aan en hangt dat
 * bestand aan het nieuwe bericht, ook als het aan de mail van een ander hangt.
 * Live nagegaan op deze installatie, mét behoud van de bestandsnaam.
 *
 * Wat er níet mee hoort zijn de plaatjes uit de opmaak: een logo uit een
 * handtekening staat als bijlage aan het bericht, maar hoort in de tekst thuis
 * en niet als los bestand onder de mail. Die staan al ín de doorgestuurde
 * inhoud; ze nog eens bijvoegen levert een mail met vier naamloze pngs op.
 */

/** Een bijlage zoals ERPNext hem bij het bericht teruggeeft. */
export interface Berichtbijlage {
  /** Docnaam van het `File` — dit is wat het versturen nodig heeft. */
  name: string;
  file_name: string;
  file_url: string;
}

/** Een bijlage die met de doorsturing meegaat. */
export interface Doorstuurbijlage {
  /** Docnaam van het `File`, mee te geven aan `sendMail`. */
  name: string;
  /** Leesbare naam, voor het blokje in het opstelvenster. */
  fileName: string;
}

/**
 * De bijlagen die bij doorsturen mee horen te gaan.
 *
 * Een bijlage valt af als zijn bestands-URL in de berichttekst voorkomt: dan
 * is het een plaatje uit de opmaak, dat al in de doorgestuurde inhoud zit.
 * Deze toets werkt op de URL en niet op het bestandstype — een echte foto als
 * bijlage hoort namelijk wél mee, en die is aan zijn type niet te
 * onderscheiden van een logo.
 */
export function kiesDoorstuurBijlagen(
  bijlagen: Berichtbijlage[],
  berichtHtml: string,
): Doorstuurbijlage[] {
  const html = String(berichtHtml || "");
  const uit: Doorstuurbijlage[] = [];
  const gezien = new Set<string>();
  for (const b of bijlagen || []) {
    const naam = String(b?.name || "").trim();
    if (!naam || gezien.has(naam)) continue;
    if (isOpmaakPlaatje(b, html)) continue;
    gezien.add(naam);
    uit.push({ name: naam, fileName: String(b.file_name || naam) });
  }
  return uit;
}

/** Staat dit bestand als afbeelding ín de berichttekst? */
function isOpmaakPlaatje(bijlage: Berichtbijlage, html: string): boolean {
  const url = String(bijlage?.file_url || "").trim();
  if (!url || !html) return false;
  // Ook de vorm met ge-escapete spaties telt: die schrijft een mailprogramma
  // in de `src` van een afbeelding, terwijl het File-record de spatie bewaart.
  return html.includes(url) || html.includes(encodeURI(url));
}

/**
 * De namen op een rij, voor een melding. Blijft nodig zolang er een reden kan
 * zijn om te zeggen wát er meegaat.
 */
export function bijlagenamen(bijlagen: { fileName: string }[]): string {
  return (bijlagen || []).map((b) => (b.fileName || "").trim()).filter(Boolean).join(", ");
}
