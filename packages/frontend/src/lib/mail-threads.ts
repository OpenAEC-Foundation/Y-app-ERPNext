/**
 * Gesprekken in de berichtenlijst: groepeer een platte lijst berichten tot
 * threads, zodat antwoorden genest onder hun oorspronkelijke bericht komen te
 * staan in plaats van als losse regels door de lijst heen.
 *
 * Pure module — geen React, geen netwerk, geen localStorage. Alles wat de
 * lijst nodig heeft (welke berichten horen bij elkaar, wat is de kopregel, is
 * er iets ongelezen, welke namen raakt een bulkactie) volgt hier uit één
 * functie, zodat "waarom staan deze twee mails bij elkaar?" met `node --test`
 * te beantwoorden is.
 *
 * ── Twee signalen, in deze volgorde ──────────────────────────────────────
 *
 * 1. **`in_reply_to`-ketting.** ERPNext legt threading vast in het
 *    `in_reply_to`-veld van Communication (er zijn hier geen RFC-5322
 *    `References`-headers). Dat is het harde signaal: staat de ouder in de
 *    geladen set, dan horen ze bij elkaar. Punt.
 *
 * 2. **Genormaliseerd onderwerp + overlappende deelnemers.** Niet elke mail
 *    dráágt die ketting: een doorgestuurde mail ("Fw: Re: Offerte …") komt
 *    binnen als een nieuw Communication zonder `in_reply_to`, en sommige
 *    mailservers zetten het veld überhaupt niet. Zonder terugval zou zo'n
 *    mail als losse regel naast zijn eigen gesprek blijven staan.
 *
 *    **Waarom niet op onderwerp alléén.** "Vraag", "Factuur", "Offerte" —
 *    generieke onderwerpen komen los van elkaar voor bij verschillende
 *    mensen. Onderwerp-alleen zou die tot één gesprek samenklonteren en
 *    daarmee mail verbergen onder een hoofdregel waar hij niet bij hoort.
 *    Daarom moeten twee berichten óók minstens één e-mailadres delen
 *    (afzender/geadresseerden/cc) vóórdat het onderwerp ze mag samenvoegen.
 *
 *    **En waarom er bovendien een antwoord-markering nodig is.** Twee losse
 *    mails van dezelfde afzender met exact hetzelfde onderwerp (twee keer
 *    dezelfde factuur doorsturen, twee testmails) delen per definitie hun
 *    deelnemers. Dat zijn geen gesprekken maar herhalingen, en ze allebei
 *    onder één kop schuiven verstopt er één. De terugval eist daarom dat
 *    minstens één van de twee zichtbaar een reactie is: een `Re:`/`Fwd:`-
 *    prefix, of een gevulde `in_reply_to`.
 *
 * ── Wat er NIET gebeurt ──────────────────────────────────────────────────
 *
 * De hoofdregel van een thread is bewust het nieuwste bericht **uit de
 * primaire lijst**, niet het nieuwste lid überhaupt. `extras` (bv. de
 * bijbehorende verzonden mails die apart zijn opgehaald voor Postvak IN)
 * verrijken het gesprek, maar mogen de lijst niet herordenen of er een
 * verzonden mail in laten opduiken die niet in deze map thuishoort. Een
 * gesprek zonder enkel lid uit de primaire lijst valt daarom helemaal weg.
 */

/** Het minimum dat een bericht moet dragen om gegroepeerd te kunnen worden. */
export interface ThreadableMessage {
  name: string;
  subject: string;
  sender: string;
  recipients?: string;
  cc?: string;
  /** ERPNext-datetimestring; alleen als sorteersleutel gebruikt. */
  date: string;
  seen: boolean;
  inReplyTo?: string;
}

export interface MailThread<T extends ThreadableMessage> {
  /** Stabiele sleutel voor React: de docname van de hoofdregel. */
  id: string;
  /** Het nieuwste bericht uit de primaire lijst — dit is de zichtbare regel. */
  head: T;
  /** Alle leden, chronologisch oplopend (oudste eerst), inclusief `head`. */
  messages: T[];
  /** `messages.length` — de "3 berichten"-teller. */
  count: number;
  /** Eén ongelezen lid maakt het hele gesprek ongelezen. */
  unread: boolean;
  /** Namen van álle leden: waar een bulkactie op de hoofdregel op werkt. */
  names: string[];
}

/**
 * Antwoord-/doorstuurprefixen, hoofdletterongevoelig en herhaalbaar
 * ("Fw: Re: …", "RE: AW: …"). `Re[2]:` komt uit oudere Outlook-versies.
 *
 * NL/EN/DE zijn de talen die deze mailboxen in de praktijk zien; `sv`/`vs`
 * (Scandinavisch) staan erbij omdat ze niets kosten en anders stil een gesprek
 * uit elkaar trekken.
 */
const REPLY_PREFIX_RE =
  /^\s*(?:(?:re|aw|antw|antwoord|fw|fwd|wg|vs|sv|doorgestuurd|doorst)\s*(?:\[\d+\])?\s*:\s*)+/i;

/** E-mailadres in een header-achtige string (`Naam <a@b.nl>, c@d.nl`). */
const ADDRESS_RE = /[^\s<>,;"()]+@[^\s<>,;"()]+/g;

/**
 * Bovengrens op de onderwerp-terugval per bucket. De vergelijking is
 * paarsgewijs (O(n²) binnen één onderwerp); bij een pathologisch onderwerp dat
 * honderden losse mails deelt is de terugval het niet waard en valt hij weg —
 * de `in_reply_to`-ketting blijft dan gewoon werken.
 */
const MAX_SUBJECT_BUCKET = 60;

/** Draagt dit onderwerp zichtbaar een antwoord-/doorstuurprefix? */
export function hasReplyMarker(subject: string): boolean {
  return REPLY_PREFIX_RE.test(subject ?? "");
}

/**
 * Onderwerp zonder antwoordprefixen, hoofdletterongevoelig en met
 * genormaliseerde witruimte. IMAP-headers vouwen over regels (`\r\n\t`), dus
 * zonder die normalisatie zou hetzelfde onderwerp met en zonder vouw als twee
 * verschillende gelden.
 */
export function normalizeSubject(subject: string): string {
  return (subject ?? "")
    .replace(REPLY_PREFIX_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Alle e-mailadressen uit een header-veld, kleingeschreven en ontdubbeld. */
export function extractAddresses(field?: string): string[] {
  if (!field) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of field.match(ADDRESS_RE) ?? []) {
    const addr = raw.replace(/[.,;>]+$/, "").toLowerCase();
    if (!addr.includes("@") || seen.has(addr)) continue;
    seen.add(addr);
    out.push(addr);
  }
  return out;
}

/** Afzender + geadresseerden + cc van één bericht. */
export function participantsOf(msg: ThreadableMessage): Set<string> {
  const set = new Set<string>();
  for (const addr of extractAddresses(msg.sender)) set.add(addr);
  for (const addr of extractAddresses(msg.recipients)) set.add(addr);
  for (const addr of extractAddresses(msg.cc)) set.add(addr);
  return set;
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) if (b.has(value)) return true;
  return false;
}

/** Nieuwste eerst; gelijke datum valt terug op de docname zodat het stabiel is. */
function newerFirst(a: ThreadableMessage, b: ThreadableMessage): number {
  if (a.date === b.date) return a.name.localeCompare(b.name);
  return a.date < b.date ? 1 : -1;
}

function olderFirst(a: ThreadableMessage, b: ThreadableMessage): number {
  return -newerFirst(a, b);
}

/** Union-find met padcompressie — klein genoeg om hier te wonen. */
function makeUnionFind() {
  const parent = new Map<string, string>();
  function find(key: string): string {
    let root = parent.get(key) ?? key;
    if (root === key) return key;
    root = find(root);
    parent.set(key, root);
    return root;
  }
  function union(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  return { find, union };
}

/**
 * Groepeer berichten tot gesprekken.
 *
 * @param primary  De zichtbare lijst (al gefilterd). Bepaalt de volgorde van
 *                 het resultaat en welke gesprekken überhaupt bestaan.
 * @param extras   Aanvullende berichten die alleen de gesprekken mogen
 *                 verrijken — typisch de bijbehorende verzonden mails bij een
 *                 Postvak IN-weergave. Ze vormen nooit een eigen regel.
 *
 * Het resultaat staat in de volgorde waarin de hoofdregels in `primary`
 * stonden, zodat de datum-kopjes en de "nieuwste bovenaan"-sortering van de
 * maplijst intact blijven.
 */
export function groupThreads<T extends ThreadableMessage>(
  primary: T[],
  extras: T[] = [],
): MailThread<T>[] {
  const byName = new Map<string, T>();
  const isPrimary = new Set<string>();
  for (const msg of primary) {
    if (!msg.name || byName.has(msg.name)) continue;
    byName.set(msg.name, msg);
    isPrimary.add(msg.name);
  }
  for (const msg of extras) {
    if (!msg.name || byName.has(msg.name)) continue;
    byName.set(msg.name, msg);
  }
  if (byName.size === 0) return [];

  const { find, union } = makeUnionFind();

  // 1 — de harde ketting.
  for (const msg of byName.values()) {
    if (msg.inReplyTo && byName.has(msg.inReplyTo)) union(msg.name, msg.inReplyTo);
  }

  // 2 — terugval op onderwerp + deelnemers + antwoordmarkering.
  const buckets = new Map<string, T[]>();
  for (const msg of byName.values()) {
    const key = normalizeSubject(msg.subject);
    if (!key) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(msg);
    else buckets.set(key, [msg]);
  }
  for (const bucket of buckets.values()) {
    if (bucket.length < 2 || bucket.length > MAX_SUBJECT_BUCKET) continue;
    const people = bucket.map((m) => participantsOf(m));
    const reply = bucket.map((m) => hasReplyMarker(m.subject) || Boolean(m.inReplyTo));
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        if (!reply[i] && !reply[j]) continue;
        if (!overlaps(people[i]!, people[j]!)) continue;
        union(bucket[i]!.name, bucket[j]!.name);
      }
    }
  }

  // 3 — leden per wortel verzamelen.
  const groups = new Map<string, T[]>();
  for (const msg of byName.values()) {
    const root = find(msg.name);
    const list = groups.get(root);
    if (list) list.push(msg);
    else groups.set(root, [msg]);
  }

  const order = new Map<string, number>();
  primary.forEach((msg, index) => { if (!order.has(msg.name)) order.set(msg.name, index); });

  const threads: MailThread<T>[] = [];
  for (const members of groups.values()) {
    // De hoofdregel komt altijd uit de primaire lijst — zie de moduletoelichting.
    const heads = members.filter((m) => isPrimary.has(m.name)).sort(newerFirst);
    const head = heads[0];
    if (!head) continue;
    const sorted = [...members].sort(olderFirst);
    threads.push({
      id: head.name,
      head,
      messages: sorted,
      count: sorted.length,
      unread: sorted.some((m) => !m.seen),
      names: sorted.map((m) => m.name),
    });
  }

  threads.sort((a, b) => (order.get(a.head.name) ?? 0) - (order.get(b.head.name) ?? 0));
  return threads;
}

/**
 * Namen die nog opgehaald moeten worden om de zichtbare gesprekken compleet te
 * maken: de ouders waarnaar een zichtbaar bericht verwijst maar die zelf niet
 * in de lijst staan (typisch je eigen verzonden mail, die in Postvak IN
 * ontbreekt).
 *
 * Apart en puur, zodat de begrensde aanvullende query in de adapter geen eigen
 * "wat missen we?"-logica hoeft te herhalen.
 */
export function missingParentNames(messages: ThreadableMessage[]): string[] {
  const known = new Set(messages.map((m) => m.name));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const msg of messages) {
    const parent = msg.inReplyTo;
    if (!parent || known.has(parent) || seen.has(parent)) continue;
    seen.add(parent);
    out.push(parent);
  }
  return out;
}
