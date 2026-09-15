/**
 * Wat er in het zoekveld van de mail getypt wordt, en wat dat betekent.
 *
 * Pure module: de vertaling van invoer naar zoekvraag is waar het stil fout
 * gaat. `*.ifc` hoort "berichten met een IFC-bijlage" te betekenen; letterlijk
 * op die tekst zoeken geeft gewoon nul treffers, en aan een lege lijst zie je
 * niet dat de vraag verkeerd begrepen is.
 *
 * Bewust streng: alleen `*.` gevolgd door één extensie en verder niets. Wie
 * `tekening.ifc` typt zoekt een bestandsnaam of onderwerp, geen soort bijlage;
 * wie net `*.` heeft getypt is nog bezig.
 */

export type Zoekopdracht =
  | { soort: "tekst"; term: string }
  | { soort: "bijlage"; extensie: string };

const EXTENSIE = /^\*\.([a-z0-9]{1,10})$/i;

export function leesZoekopdracht(invoer: string): Zoekopdracht {
  const schoon = String(invoer ?? "").trim();
  const treffer = EXTENSIE.exec(schoon);
  if (treffer) return { soort: "bijlage", extensie: treffer[1].toLowerCase() };
  return { soort: "tekst", term: schoon };
}
