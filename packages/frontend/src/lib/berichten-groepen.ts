/**
 * Groepsgesprekken in Y-messaging — de rekenkant.
 *
 * Een bericht is in Y-messaging een `Notification Log` per postvak (zie
 * `messages-erpnext.ts`). Een groepsbericht is precies hetzelfde, maar dan één
 * kopie per lid, en elke kopie draagt de groep mee in zijn `link`: het
 * kenmerk, de naam en de leden. Er is dus geen aparte plek waar een groep
 * "staat" — de groep is wat het nieuwste bericht erover zegt.
 *
 * Waarom zo en niet een eigen doctype of een instelling op de server: een
 * nieuw doctype is een wijziging aan de instance, en een gedeelde instelling
 * kan een gewone medewerker niet schrijven. Het `link`-veld is een tekstveld
 * zonder lengtegrens dat elk lid in zijn eigen kopie kan lezen — en dat is
 * alles wat een groep nodig heeft.
 *
 * **Wat je hiermee niet kunt vervalsen.** De afzender komt uit `owner`, die de
 * server zelf zet. Een groepsbericht telt alleen als die afzender in de
 * ledenlijst van datzelfde bericht staat; anders is het een gewoon bericht van
 * die persoon. Iemand kan een groep met jou erin verzinnen, maar dat is niet
 * meer dan wat hij al kon: jou een bericht sturen.
 *
 * Pure module: geen netwerk.
 */

/** Queryparameters in `link`. Kort, want ze staan in elke kopie. */
export const GROEP_PARAM = "g";
export const GROEP_NAAM_PARAM = "gn";
export const GROEP_LEDEN_PARAM = "gl";
export const GEBEURTENIS_PARAM = "gev";

/** Waarmee een gesprek als groepsgesprek herkenbaar is in `counterpart`. */
export const GROEP_PREFIX = "groep:";

/** Grenzen die ook de leeskant bewaakt: wat daarbuiten valt, is geen groep. */
export const MAX_LEDEN = 50;
export const MAX_NAAM = 80;

export interface Groep {
  id: string;
  naam: string;
  /** ERPNext-user-ids, inclusief degene die de groep aanmaakte. */
  leden: string[];
}

/** Een bericht dat geen tekst draagt maar iets aan de groep verandert. */
export type Gebeurtenis = "aangemaakt" | "gewijzigd" | "verlaten";

const GEBEURTENISSEN: ReadonlySet<string> = new Set(["aangemaakt", "gewijzigd", "verlaten"]);
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
/** Een user-id: geen spaties, komma's of stuurtekens. Meer hoeft de leeskant niet te weten. */
const LID_RE = /^[^\s,<>"']{1,140}$/;

export function nieuweGroepId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function groepSleutel(id: string): string {
  return `${GROEP_PREFIX}${id}`;
}

export function isGroepSleutel(counterpart: string): boolean {
  return counterpart.startsWith(GROEP_PREFIX);
}

/** Leden opgeschoond: zonder witruimte, zonder dubbelen, in vaste volgorde van binnenkomst. */
export function schoneLeden(leden: readonly string[]): string[] {
  const uit: string[] = [];
  for (const ruw of leden) {
    const lid = (ruw || "").trim();
    if (!lid || !LID_RE.test(lid) || uit.includes(lid)) continue;
    uit.push(lid);
  }
  return uit.slice(0, MAX_LEDEN);
}

/** De naam zoals hij opgeslagen wordt: één regel, niet te lang. */
export function schoneNaam(naam: string): string {
  return (naam || "").replace(/\s+/g, " ").trim().slice(0, MAX_NAAM);
}

/** Zet de groep (en eventueel een gebeurtenis) in een bestaande query. */
export function zetGroepInQuery(query: URLSearchParams, groep: Groep, gebeurtenis?: Gebeurtenis): void {
  query.set(GROEP_PARAM, groep.id);
  query.set(GROEP_NAAM_PARAM, schoneNaam(groep.naam));
  query.set(GROEP_LEDEN_PARAM, schoneLeden(groep.leden).join(","));
  if (gebeurtenis) query.set(GEBEURTENIS_PARAM, gebeurtenis);
}

/**
 * De groep uit een `link`, of `null` als er geen is of hij niet klopt.
 *
 * Streng, want de waarde komt uit een document dat een ander schreef: een
 * kenmerk van de verkeerde vorm, een lege naam of een ledenlijst met minder
 * dan twee mensen is geen groep.
 */
export function groepUitLink(link: string): { groep: Groep; gebeurtenis?: Gebeurtenis } | null {
  const at = (link || "").indexOf("?");
  if (at < 0) return null;
  let query: URLSearchParams;
  try {
    query = new URLSearchParams(link.slice(at + 1));
  } catch {
    return null;
  }
  const id = query.get(GROEP_PARAM)?.trim() ?? "";
  if (!ID_RE.test(id)) return null;
  const naam = schoneNaam(query.get(GROEP_NAAM_PARAM) ?? "");
  if (!naam) return null;
  const ruweLeden = (query.get(GROEP_LEDEN_PARAM) ?? "").split(",");
  if (ruweLeden.length > MAX_LEDEN) return null;
  const leden = schoneLeden(ruweLeden);
  if (leden.length < 2) return null;
  const gev = query.get(GEBEURTENIS_PARAM) ?? "";
  return {
    groep: { id, naam, leden },
    ...(GEBEURTENISSEN.has(gev) ? { gebeurtenis: gev as Gebeurtenis } : {}),
  };
}

/** Telt dit groepsbericht? Alleen als de afzender zelf lid is. */
export function geldigVoorAfzender(groep: Groep, afzender: string): boolean {
  return groep.leden.includes(afzender);
}

/** Wie een bericht aan de groep moet krijgen: iedereen behalve jij. */
export function ontvangersVan(groep: Groep, ik: string): string[] {
  return groep.leden.filter((lid) => lid !== ik);
}

/** Wat er tussen twee versies van de groep veranderde, voor de grijze regel in het gesprek. */
export function groepsverschil(oud: Groep | null | undefined, nieuw: Groep): {
  toegevoegd: string[];
  verwijderd: string[];
  hernoemd: boolean;
} {
  if (!oud) return { toegevoegd: [], verwijderd: [], hernoemd: false };
  return {
    toegevoegd: nieuw.leden.filter((l) => !oud.leden.includes(l)),
    verwijderd: oud.leden.filter((l) => !nieuw.leden.includes(l)),
    hernoemd: oud.naam !== nieuw.naam,
  };
}

/**
 * Bij een wijziging moeten ook de mensen die eruit gaan het horen: zij houden
 * het gesprek, maar zien dat ze geen lid meer zijn. Dus: oud én nieuw samen,
 * zonder jezelf.
 */
export function ontvangersVanWijziging(oud: Groep, nieuw: Groep, ik: string): string[] {
  return schoneLeden([...oud.leden, ...nieuw.leden]).filter((lid) => lid !== ik);
}

/** Voornaam uit een volledige naam, of het deel voor de @ van een user-id. */
export function voornaam(naam: string): string {
  const schoon = (naam || "").trim();
  if (!schoon) return "";
  if (schoon.includes("@") && !schoon.includes(" ")) return schoon.split("@")[0];
  return schoon.split(/\s+/)[0];
}
