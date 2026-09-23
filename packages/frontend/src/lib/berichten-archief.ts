/**
 * Archief-adapter voor het oude "Y Bericht"-doctype.
 *
 * Oudere Y-next-installaties bewaarden chat in een eigen custom doctype
 * "Y Bericht" (afzender/ontvanger/bericht/gelezen). De messenger draait
 * inmiddels op `Notification Log` (zie `messages-erpnext.ts`), en die
 * geschiedenis laat zich niet migreren zonder de afzender te vervalsen:
 * Frappe zet `owner` — het enige afzenderveld dat de nieuwe messenger
 * vertrouwt — bij elke insert onvoorwaardelijk op de sessiegebruiker, dus
 * elk via de API gemigreerd bericht zou van de migrateur lijken te komen.
 *
 * Dit archief leest de oude berichten daarom alleen-lezen mee: ze schuiven
 * op datum tussen de nieuwe berichten, maar er komt niets bij en er gaat
 * niets weg. De enige schrijfactie is het gelezen-vinkje, op het oude veld.
 *
 * Op installaties waar het doctype nooit bestaan heeft is dit alles een
 * no-op: de eerste lijst-call krijgt een 404, `fetchList` onthoudt dat in de
 * missing-doctype-cache, en elke volgende aanroep is een lege lijst zonder
 * netwerkverkeer.
 */
import { fetchList, invalidateCache, updateDocument } from "./erpnext.ts";
import { resolveSessionUser } from "./session.ts";
import { berichtSleutel } from "./berichten-reacties.ts";
import { htmlToText, isSafeFileUrl, type ErpMessage } from "./messages-erpnext.ts";

/** Het oude doctype. Eén constante zodat tests niet gokken. */
export const ARCHIEF_DOCTYPE = "Y Bericht";

/**
 * Prefix voor docnamen uit het archief. De UI gebruikt `name` als handvat;
 * het prefix voorkomt botsingen met Notification Log-namen en is waar
 * `markMessagesRead` en de verwijder-helpers archiefberichten aan herkennen.
 */
export const ARCHIEF_PREFIX = "archief-";

export function isArchiefNaam(name: string): boolean {
  return name.startsWith(ARCHIEF_PREFIX);
}

/** Ruwe rij zoals `fetchList` hem uit "Y Bericht" teruggeeft. */
interface ArchiefRij {
  name?: unknown;
  afzender?: unknown;
  ontvanger?: unknown;
  bericht?: unknown;
  creation?: unknown;
  gelezen?: unknown;
  afbeelding?: unknown;
}

function toStr(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Hooguit zoveel archiefberichten. Het archief groeit niet meer aan, dus dit
 * is geen paginering maar een noodrem tegen een onverwacht grote instantie.
 */
const ARCHIEF_LIMIT = 500;

export function archiefRowToMessage(rij: ArchiefRij, me: string): ErpMessage | null {
  const name = toStr(rij.name);
  const afzender = toStr(rij.afzender);
  const ontvanger = toStr(rij.ontvanger);
  if (!name || !afzender || !ontvanger) return null;
  // Berichten aan jezelf kent de nieuwe messenger niet (de richting volgt
  // uit "ben ik de afzender") — die blijven buiten beeld, net als rijen van
  // gesprekken waar je geen partij in bent.
  if (afzender === ontvanger) return null;
  const outgoing = afzender === me;
  if (!outgoing && ontvanger !== me) return null;

  const body = htmlToText(toStr(rij.bericht));
  const createdAt = toStr(rij.creation);
  const afbeelding = toStr(rij.afbeelding);
  const image = afbeelding && isSafeFileUrl(afbeelding)
    ? { url: afbeelding, name: afbeelding.split("/").pop() || afbeelding }
    : undefined;

  return {
    name: ARCHIEF_PREFIX + name,
    counterpart: outgoing ? ontvanger : afzender,
    direction: outgoing ? "out" : "in",
    body,
    createdAt,
    // Je eigen verzonden bericht is per definitie gelezen; bij een ontvangen
    // bericht telt het oude vinkje.
    read: outgoing || Number(rij.gelezen) === 1,
    // Zelfde vangnet-recept als `rowToMessage` zonder link-sleutel: beide
    // gesprekspartners rekenen op dezelfde rij dezelfde sleutel uit, dus een
    // like uit de nieuwe messenger wijst voor allebei naar hetzelfde
    // archiefbericht.
    sleutel: berichtSleutel({ link: "", afzender, ontvanger, body, createdAt, imageUrl: image?.url }),
    ...(image ? { image } : {}),
  };
}

/**
 * Eigen archiefberichten (verzonden én ontvangen), nieuwste eerst.
 *
 * Elke fout — geen leesrecht, een instantie-eigenaardigheid — degradeert
 * naar "geen archief": het archief mag de gewone messenger nooit breken.
 */
export async function listArchiefBerichten(): Promise<ErpMessage[]> {
  const me = await resolveSessionUser();
  if (!me) return [];

  const rijen = await fetchList<ArchiefRij>(ARCHIEF_DOCTYPE, {
    fields: ["name", "afzender", "ontvanger", "bericht", "creation", "gelezen", "afbeelding"],
    or_filters: [["afzender", "=", me], ["ontvanger", "=", me]],
    order_by: "creation desc",
    limit_page_length: ARCHIEF_LIMIT,
  }).catch(() => [] as ArchiefRij[]);

  const out: ErpMessage[] = [];
  for (const rij of rijen) {
    const bericht = archiefRowToMessage(rij, me);
    if (bericht) out.push(bericht);
  }
  return out;
}

/**
 * Het gelezen-vinkje op de oude rijen. Namen zonder archief-prefix worden
 * overgeslagen; de aanroeper hoeft dus niet zelf te splitsen.
 */
export async function markeerArchiefGelezen(namen: ReadonlyArray<string>): Promise<void> {
  const docnamen = namen.filter(isArchiefNaam).map((n) => n.slice(ARCHIEF_PREFIX.length));
  if (docnamen.length === 0) return;

  await Promise.allSettled(
    docnamen.map((docname) => updateDocument(ARCHIEF_DOCTYPE, docname, { gelezen: 1 })),
  );
  invalidateCache(ARCHIEF_DOCTYPE);
}
