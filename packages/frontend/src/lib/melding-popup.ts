/**
 * De strook in het scherm bij een nieuw bericht.
 *
 * Waarom naast de vensternotificatie: die van de browser toont zichzelf
 * bewust niet wanneer het tabblad zichtbaar is — de gedachte is dat je het dan
 * toch wel ziet. Bij een chatbericht klopt dat niet: je zit in de mail of in
 * de agenda, en van een teller die ergens in de zijbalk oploopt merk je niets.
 * Deze strook vult precies dat gat.
 *
 * Losgekoppeld via een gebeurtenis op `window`, omdat de melding uit een
 * poller komt die buiten React draait. De poller hoeft zo niets van de
 * schermopbouw te weten, en het venster dat hem toont niets van het pollen.
 */

export const MELDING_EVENT = "y-next:melding";

export interface Melding {
  soort: "bericht" | "post";
  titel: string;
  tekst: string;
  /** Waar je heen gaat als je erop klikt, als hash-route. */
  naar: string;
}

/** Laat een melding zien. Zonder venster (tests, server) doet dit niets. */
export function toonMelding(melding: Melding): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Melding>(MELDING_EVENT, { detail: melding }));
}
