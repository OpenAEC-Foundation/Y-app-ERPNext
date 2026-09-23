/**
 * Een leesbare melding als een bestand niet geüpload kan worden.
 *
 * "Upload failed: 417" zegt niemand iets. Frappe geeft bij een weigering de
 * reden mee (te groot, bestandstype niet toegestaan, geen rechten); die komt
 * hier samen met de bestandsnaam en de grootte in één zin, zodat duidelijk is
 * wélk bestand het probleem is en wat eraan te doen valt.
 */

/** Bestandsgrootte als "3,4 MB" of "820 kB". */
export function grootteLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

/** Serverreden zonder HTML-opmaak en overbodige witruimte. */
function schoon(detail: string): string {
  return detail.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

const TE_GROOT = /size|groot|grootte|exceed|overschrijd|too large/i;

export function uploadFoutmelding(
  bestand: { name: string; size: number },
  status: number,
  detail: string,
): string {
  const wie = `"${bestand.name}" (${grootteLabel(bestand.size)})`;
  const reden = schoon(detail || "");
  // 413 komt van de webserver vóór Frappe: het verzoek als geheel is te groot.
  if (status === 413) return `${wie} is te groot om te uploaden. Verklein het bestand of deel het via een link.`;
  if (reden && TE_GROOT.test(reden)) return `${wie} is te groot: ${reden}. Verklein het bestand of deel het via een link.`;
  if (reden) return `${wie} kon niet worden geüpload: ${reden}`;
  return `${wie} kon niet worden geüpload (serverfout ${status}).`;
}
