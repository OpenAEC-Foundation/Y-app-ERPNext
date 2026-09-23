/**
 * Afbeeldingen die in een mail geplakt worden.
 *
 * Pure module: de stukjes die stil fout gaan en niet aan het scherm af te
 * lezen zijn. In het opstelvenster staat een geplakte afbeelding prima; bij de
 * ontvanger is hij een gebroken plaatje zodra de mail naar een pad op deze
 * server verwijst dat alleen hier betekenis heeft.
 *
 * **Waarom een publiek bestand met een volledig adres.** Zo staan de logo's in
 * de handtekeningen er al in (`https://erp.voorbeeld.nl/files/…`), en zo komen
 * die bij klanten aan. Een `data:`-afbeelding in de mail zelf wordt door Gmail
 * en Outlook weggefilterd. Inline meesturen via Frappe's `embed`-attribuut
 * zou mooier zijn, maar of dat attribuut het opslaan van de mail overleeft
 * is op deze server niet na te gaan — en een geplakte afbeelding die stil
 * verdwijnt is precies de fout die dit moest voorkomen.
 *
 * Omdat het bestand publiek is, krijgt het een naam die niet te raden valt.
 */

const EXTENSIES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Een bestandsnaam voor een geplakte afbeelding, niet te raden. */
export function plakBestandsnaam(mime: string): string {
  const ext = EXTENSIES[String(mime || "").toLowerCase()] ?? "png";
  let willekeurig = "";
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  for (const b of bytes) willekeurig += (b % 36).toString(36);
  return `plak-${willekeurig}.${ext}`;
}

/**
 * Afbeeldingen die naar deze server verwijzen (`/files/…`) een volledig adres
 * geven, zodat ze bij de ontvanger ook laden. Alleen `src` van `<img>`; wat al
 * een schema heeft (`https:`, `cid:`, `data:`) blijft staan.
 */
export function maakAfbeeldingenAbsoluut(html: string, origin: string): string {
  const basis = String(origin || "").replace(/\/+$/, "");
  if (!basis) return html;
  return String(html || "").replace(
    /(<img\b[^>]*?\bsrc=)(["'])(\/files\/[^"']*)\2/gi,
    (_m, voor: string, aanh: string, pad: string) => `${voor}${aanh}${basis}${pad}${aanh}`,
  );
}

/** Kleiner dan dit is geen herkenbaar plaatje meer. */
const MIN_BREEDTE = 40;

/**
 * Breedte bij een snelkeuze ("half", "groot"): een deel van de echte breedte,
 * nooit breder dan de ruimte in de mail en nooit kleiner dan herkenbaar.
 */
export function schaalBreedte(natuurlijk: number, fractie: number, max: number): number {
  const doel = Math.round(Math.max(1, natuurlijk) * Math.max(0, fractie));
  return Math.max(MIN_BREEDTE, Math.min(doel, Math.max(MIN_BREEDTE, Math.round(max))));
}

/** Breedte tijdens het slepen aan de hoek, binnen de grenzen. */
export function sleepBreedte(start: number, dx: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, start + dx)));
}
