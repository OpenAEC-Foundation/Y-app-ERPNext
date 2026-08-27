/**
 * NC-stijl vrije-naam-zoeker voor NextCloud Talk file-uploads.
 *
 * Waarom: een Talk-upload doet WebDAV-PUT naar /Talk/<naam> en deelt dat pad
 * vervolgens met het gesprek (OCS shareType 10). Hergebruik je dezelfde naam,
 * dan:
 *   (a) overschrijft de PUT het eerder geüploade bestand (de afbeelding in het
 *       oudere chatbericht verandert mee), en
 *   (b) weigert NextCloud het opnieuw delen van datzelfde pad met
 *       "Pad is al gedeeld met dit gesprek" (HTTP 403).
 *
 * Oplossing zoals NextCloud zelf: vind een vrije naam door bij een botsing
 * "naam.ext" → "naam (2).ext" → "naam (3).ext" … te proberen. De aanroeper
 * levert `exists` (een WebDAV-bestaanscheck) zodat deze functie puur en los
 * testbaar blijft.
 */

export interface NextFreeUploadNameOptions {
  /** Max. aantal genummerde varianten dat geprobeerd wordt vóór opgeven. */
  maxTries?: number;
}

export async function nextFreeUploadName(
  fileName: string,
  exists: (name: string) => Promise<boolean>,
  opts: NextFreeUploadNameOptions = {},
): Promise<string> {
  const maxTries = opts.maxTries ?? 1000;

  if (!(await exists(fileName))) return fileName;

  // Splits op de LAATSTE punt; een punt op index 0 (dotfile, bv. ".gitignore")
  // telt niet als extensie.
  const dot = fileName.lastIndexOf(".");
  const hasExt = dot > 0;
  const base = hasExt ? fileName.slice(0, dot) : fileName;
  const ext = hasExt ? fileName.slice(dot) : "";

  for (let n = 2; n <= maxTries; n++) {
    const candidate = `${base} (${n})${ext}`;
    if (!(await exists(candidate))) return candidate;
  }

  throw new Error(
    `Geen vrije bestandsnaam gevonden voor "${fileName}" na ${maxTries} pogingen`,
  );
}
