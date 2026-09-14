/**
 * Antwoorden op een uitnodiging kan langs twee wegen. Deze module bepaalt
 * welke, en wat je te horen krijgt als het misgaat.
 *
 * **Weg 1 — bijwerken.** Staat de afspraak al in je agenda (de mailserver zet
 * een uitnodiging van een collega er bij binnenkomst zelf in), dan verandert
 * alleen jouw deelnemersregel. Al het andere blijft staan zoals het staat.
 *
 * **Weg 2 — neerleggen.** Een uitnodiging van buiten staat nergens. Die wordt
 * in je eigen agenda gezet met je antwoord er al in.
 *
 * Waarom hier, en getest: het Server Script meldt "deze uitnodiging staat niet
 * in je agenda" niet als uitslag maar als **fout** — `frappe.throw` komt als
 * exception binnen. Wie alleen naar de uitslag kijkt, breekt daar af en loopt
 * weg 2 nooit, precies in het geval waarvoor die bestaat. Op het scherm zie je
 * dan alleen "Antwoorden mislukt" bij elke uitnodiging van buiten.
 */

export interface BijwerkUitslag {
  gelukt: boolean;
  reden?: string;
}

export interface NeerlegUitslag {
  geschreven: string[];
  mislukt: { reden?: string }[];
}

export interface AntwoordWegen {
  /** Weg 1: jouw deelnemersregel in de bestaande afspraak. */
  bijwerken: () => Promise<BijwerkUitslag>;
  /** Weg 2: de afspraak met je antwoord erin in je eigen agenda leggen.
   *  Ontbreekt wanneer er geen .ics beschikbaar is om neer te leggen. */
  neerleggen?: () => Promise<NeerlegUitslag>;
}

function bericht(fout: unknown): string {
  if (fout instanceof Error && fout.message) return fout.message;
  const tekst = String(fout ?? "").trim();
  return tekst;
}

export async function beantwoordUitnodiging(
  wegen: AntwoordWegen,
): Promise<{ gelukt: boolean; fout: string }> {
  let reden = "";
  try {
    const uitslag = await wegen.bijwerken();
    if (uitslag.gelukt) return { gelukt: true, fout: "" };
    reden = uitslag.reden || "";
  } catch (fout) {
    reden = bericht(fout);
  }

  if (!wegen.neerleggen) return { gelukt: false, fout: reden };

  try {
    const neergelegd = await wegen.neerleggen();
    if (neergelegd.geschreven.length > 0) return { gelukt: true, fout: "" };
    return { gelukt: false, fout: neergelegd.mislukt[0]?.reden || reden };
  } catch (fout) {
    return { gelukt: false, fout: bericht(fout) || reden };
  }
}

/**
 * Hoort de mail waarin de uitnodiging zat nu afgevinkt te worden?
 *
 * Ja bij een ja én bij een nee: in allebei de gevallen heb je die mail
 * afgehandeld en hoeft hij niet in je postvak te blijven liggen. Bij
 * "voorlopig" niet — dat is juist het antwoord dat zegt dat je er nog op
 * terugkomt.
 */
export function handeltMailAf(stand: string): boolean {
  const schoon = String(stand || "").trim().toLowerCase();
  return schoon === "accepted" || schoon === "declined";
}
