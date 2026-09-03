/**
 * Berichten-adapter op ERPNext `Notification Log`.
 *
 * Y-next draait als Frappe Web Page zonder eigen server. De oude
 * Messenger-pagina praat met `/api/messenger/*` — Express-routes die op deze
 * installatie niet bestaan — en is daarom volledig dood. Deze module vervangt
 * die databron door iets dat élke ingelogde medewerker via de standaard
 * REST-API kan gebruiken, in dezelfde vorm als `mail-erpnext.ts`: alle
 * netwerkcalls lopen via de helpers in `./erpnext.ts` (CSRF, timeouts,
 * 417-veld-zelfherstel, missing-doctype-cache), de UI-laag kent alleen de
 * types hieronder.
 *
 * ─── Waarom `Notification Log` en niet iets anders ───
 *
 * De keuze wordt volledig bepaald door twee dingen die je op een productie-
 * instance niet kunt verzinnen: wie mag schrijven, en wie mag lezen. Live
 * gecontroleerd op de doelinstance (Frappe 15.105 / ERPNext 15.104):
 *
 *  - **`Notification Log`** — Custom DocPerm geeft rol `Employee` read+write+
 *    create, rol `All` alleen read. En, doorslaggevend: Frappe registreert
 *    voor dit doctype een `permission_query_condition` die élke lijstquery
 *    hardt op `for_user = <ingelogde gebruiker>`. Isolatie per gebruiker komt
 *    dus van de server, niet van een filter dat de frontend meestuurt en dat
 *    iemand met een tabblad devtools kan weglaten. Dat is precies wat een
 *    berichtenmodule nodig heeft.
 *
 *  - **`Comment`** — afgevallen op leesrechten: alleen `System Manager` en
 *    `Website Manager` hebben read/create op dit doctype, een gewone
 *    medewerker dus niet. Schrijven zou nog kunnen via de whitelisted
 *    `frappe.desk.form.utils.add_comment`, maar teruglezen kan alleen via
 *    `get_docinfo` op een referentiedocument — en dan ziet iederéén die dat
 *    document mag lezen alle berichten die eraan hangen. Geen privacy.
 *
 *  - **`Communication`** — afgevallen op allebei. Create hebben alleen
 *    `Inbox User` en `System Manager`; een medewerker kan er dus niets in
 *    aanmaken. En de leesconditie van Frappe is voor dit doctype juist
 *    averechts: wie géén `User Email`-rij heeft krijgt
 *    `communication_type != 'Communication'` — dat maakt chat-achtige
 *    Communications leesbaar voor iedereen — terwijl wie er wél één heeft
 *    wordt beperkt tot `email_account in (…)`, waardoor berichten zonder
 *    e-mailaccount voor hém onzichtbaar worden. Twee tegengestelde fouten in
 *    één doctype.
 *
 *  - **Een eigen doctype** — technisch het mooist, maar dat is een wijziging
 *    aan de instance (DocType + DocPerms + migratie) en niet iets dat deze
 *    tijdelijke oplossing zelf mag doen. `Notification Log` bestaat al, heeft
 *    al de juiste rechten en al de juiste leesconditie.
 *
 * ─── Waarom de afzender niet te vervalsen is ───
 *
 * De afzender is **`owner`**, en uitsluitend `owner`. Frappe's
 * `Document.set_user_and_timestamp()` overschrijft bij élke insert
 * onvoorwaardelijk `self.owner = frappe.session.user` (version-15 bron:
 * `if self.is_new() and not (in_install or in_patch or in_migrate)`), dus een
 * `owner` die de client meestuurt wordt genegeerd. `from_user` is een gewoon
 * invoerveld en dus wél te vervalsen — dat veld wordt hier bewust nooit
 * gelezen, alleen geschreven zodat de ERPNext-desk-bel de juiste afzender
 * toont.
 *
 * ─── Twee kopieën per bericht ───
 *
 * Omdat de leesconditie hard op `for_user` filtert, ziet een afzender zijn
 * eigen verzonden bericht niet als er maar één document is. Elk bericht wordt
 * daarom als twee `Notification Log`-documenten opgeslagen:
 *
 *   ontvangerskopie:  for_user = ontvanger, owner = afzender,  read = 0
 *   verzonden-kopie:  for_user = afzender,  owner = afzender,  read = 1
 *
 * De richting volgt daarmee uit `owner === for_user` (verzonden) of niet
 * (ontvangen). Dat is niet te misbruiken: een aanvaller kan `owner` niet
 * zetten, dus hij kan onmogelijk een document maken dat in het postvak van
 * een slachtoffer als *diens eigen* verzonden bericht opduikt.
 *
 * De tegenpartij staat in `document_name` (met `document_type = "User"`).
 * Voor een ontvangen bericht wordt die waarde genegeerd — daar is `owner` de
 * waarheid; voor een verzonden bericht is het je eigen invoer en dus per
 * definitie betrouwbaar.
 */

import {
  callMethod,
  createDocument,
  fetchList,
  invalidateCache,
  updateDocument,
} from "./erpnext.ts";
import { resolveSessionUser } from "./session.ts";

/** Het doctype waar alles op draait. Eén constante zodat tests niet gokken. */
export const MESSAGE_DOCTYPE = "Notification Log";

/**
 * `type = "Alert"` is de enige Select-optie waarvoor Frappe géén
 * notificatiemail probeert te versturen: `is_email_notifications_enabled_for_type`
 * geeft voor `Alert` (en `Notification`) onvoorwaardelijk `false` terug. Elke
 * andere waarde zou bij elk chatbericht een e-mail naar de collega sturen.
 */
export const MESSAGE_TYPE = "Alert";

/**
 * `document_type` doet hier dubbel werk: het is de plek waar de tegenpartij
 * (`document_name`) betekenis krijgt, én het is samen met `type` het filter
 * dat onze berichten scheidt van de gewone ERPNext-meldingen die in hetzelfde
 * doctype landen (mislukte mail, share-notificaties, …). Die hebben een
 * ander `document_type` — "Email Queue", "Task", en zo verder.
 */
export const MESSAGE_DOCUMENT_TYPE = "User";

/**
 * Waarde van het `link`-veld. Twee doelen tegelijk: de ERPNext-desk-bel maakt
 * er een werkende link van naar dit scherm, en het is een tweede, goedkope
 * controle in `rowToMessage` — een stock-notificatie die toevallig
 * `Alert` + `User` is, valt hierop alsnog af.
 */
export const MESSAGE_LINK = "/y-next#/messenger";

/** Hoeveel tekens van het bericht in `subject` (en dus in de desk-bel) komen. */
const SUBJECT_PREVIEW_LENGTH = 140;

/** Standaard paginagrootte van `listMessages`. */
const DEFAULT_MESSAGE_LIMIT = 300;

/* ─── Types ─── */

/** Eén bericht zoals de UI het consumeert. */
export interface ErpMessage {
  /** Docname van de `Notification Log`. */
  name: string;
  /** De andere partij in dit gesprek (ERPNext-user-id). */
  counterpart: string;
  /** `"out"` = door mij verstuurd, `"in"` = aan mij gericht. */
  direction: "in" | "out";
  /** Platte tekst van het bericht. */
  body: string;
  /** `creation` van ERPNext, ongeparseerd (sorteert lexicaal correct). */
  createdAt: string;
  read: boolean;
}

/** Alle berichten met één collega, plus wat de gesprekslijst moet tonen. */
export interface ErpMessageThread {
  counterpart: string;
  /** Volledige naam als die bekend is, anders de user-id zelf. */
  counterpartName: string;
  /** Berichten, nieuwste eerst (zelfde volgorde als `listMessages`). */
  messages: ErpMessage[];
  /** Preview van het nieuwste bericht. */
  lastBody: string;
  /** `createdAt` van het nieuwste bericht. */
  lastAt: string;
  /** Aantal ongelezen ontvangen berichten in dit gesprek. */
  unread: number;
}

/** Een collega die als ontvanger gekozen kan worden. */
export interface ErpMessageContact {
  /** ERPNext-user-id — dit gaat in `for_user`. */
  user: string;
  fullName: string;
}

/** Ruwe rij zoals `fetchList` hem teruggeeft. */
interface NotificationLogRow {
  name?: unknown;
  subject?: unknown;
  email_content?: unknown;
  for_user?: unknown;
  document_name?: unknown;
  owner?: unknown;
  creation?: unknown;
  link?: unknown;
  read?: unknown;
}

function toStr(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/* ─── Tekst ⇄ HTML ─── */

/**
 * `email_content` is een Text Editor-veld en wordt door de ERPNext-desk als
 * HTML gerenderd. Ruwe gebruikerstekst mag daar dus nooit rechtstreeks in:
 * één `<script>` of `<img onerror=…>` in een bericht zou anders in de bel van
 * de ontvanger uitgevoerd worden. Escapen bij het schrijven is de plek waar
 * dat structureel dichtgaat — de leeskant hieronder strippt óók nog, maar
 * beveiligen op alleen de leeskant zou de desk-UI onbeschermd laten.
 */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return `<div>${escaped.split(/\r?\n/).join("<br>")}</div>`;
}

/**
 * Omgekeerde weg. Bewust regex en niet de DOM: deze module wordt door
 * `node --test` geladen zonder jsdom, en een parser die alleen in de browser
 * werkt zou de teksthandling onttesbaar maken.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // `&amp;` als laatste, anders wordt "&amp;lt;" alsnog een echte "<".
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Korte, platte samenvatting voor `subject` en voor de gesprekslijst. */
export function previewOf(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > SUBJECT_PREVIEW_LENGTH
    ? `${oneLine.slice(0, SUBJECT_PREVIEW_LENGTH - 1)}…`
    : oneLine;
}

/* ─── Rij → bericht ─── */

/**
 * Vertaalt één ruwe rij naar een `ErpMessage`, of `null` als de rij niet van
 * ons is of onbruikbaar.
 *
 * Alles wat over identiteit gaat komt hier uit servervelden: `owner` bepaalt
 * de richting, en bij een ontvangen bericht óók de afzender. `document_name`
 * wordt alleen vertrouwd voor de eigen verzonden kopie — die heb je zelf
 * geschreven.
 */
export function rowToMessage(row: NotificationLogRow, me: string): ErpMessage | null {
  const name = toStr(row.name);
  const owner = toStr(row.owner);
  const forUser = toStr(row.for_user);
  if (!name || !owner || forUser !== me) return null;
  if (toStr(row.link) !== MESSAGE_LINK) return null;

  const outgoing = owner === me;
  const counterpart = outgoing ? toStr(row.document_name) : owner;
  if (!counterpart) return null;

  const html = toStr(row.email_content);
  const body = html ? htmlToText(html) : toStr(row.subject);

  return {
    name,
    counterpart,
    direction: outgoing ? "out" : "in",
    body,
    createdAt: toStr(row.creation),
    read: Number(row.read) === 1,
  };
}

/* ─── Lezen ─── */

/**
 * Eigen ontvangen én verzonden berichten, nieuwste eerst.
 *
 * Het filter op `for_user` is technisch overbodig — Frappe's
 * `permission_query_condition` doet hetzelfde — op één gebruiker na:
 * `Administrator` wordt door die conditie overgeslagen en zou anders
 * andermans berichten in zijn eigen lijst zien. Expliciet filteren kost niets
 * en dicht dat gat.
 */
export async function listMessages(limit: number = DEFAULT_MESSAGE_LIMIT): Promise<ErpMessage[]> {
  const me = await resolveSessionUser();
  if (!me) return [];

  // `erpnext.ts` cachet GET-antwoorden 30 seconden — langer dan het
  // poll-interval van de UI (20 s). Zonder deze regel zou elke tweede poll
  // uit de cache komen en dus per definitie niets nieuws opleveren. De
  // in-flight-dedup van `fetchList` blijft wél werken, dus twee gelijktijdige
  // aanroepen kosten nog steeds één request.
  invalidateCache(MESSAGE_DOCTYPE);

  const rows = await fetchList<NotificationLogRow>(MESSAGE_DOCTYPE, {
    fields: [
      "name", "subject", "email_content", "for_user",
      "document_name", "owner", "creation", "link", "read",
    ],
    filters: [
      ["for_user", "=", me],
      ["type", "=", MESSAGE_TYPE],
      ["document_type", "=", MESSAGE_DOCUMENT_TYPE],
    ],
    order_by: "creation desc",
    limit_page_length: limit,
  });

  const out: ErpMessage[] = [];
  for (const row of rows) {
    const message = rowToMessage(row, me);
    if (message) out.push(message);
  }
  return out;
}

/**
 * Groepeert een berichtenlijst per collega. Puur — geen netwerk — zodat de
 * volgorde- en telregels los te testen zijn.
 *
 * `unread` telt alleen ontvangen berichten: je eigen verzonden kopie wordt
 * als gelezen aangemaakt, maar zou bij een mislukte schrijfactie anders alsnog
 * als "ongelezen bericht van jezelf" in de teller belanden.
 */
export function groupThreads(
  messages: ErpMessage[],
  displayNames: Record<string, string> = {},
): ErpMessageThread[] {
  const byCounterpart = new Map<string, ErpMessage[]>();
  for (const message of messages) {
    const bucket = byCounterpart.get(message.counterpart);
    if (bucket) bucket.push(message);
    else byCounterpart.set(message.counterpart, [message]);
  }

  const threads: ErpMessageThread[] = [];
  for (const [counterpart, bucket] of byCounterpart) {
    const sorted = [...bucket].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    threads.push({
      counterpart,
      counterpartName: displayNames[counterpart] || counterpart,
      messages: sorted,
      lastBody: previewOf(sorted[0]?.body || ""),
      lastAt: sorted[0]?.createdAt || "",
      unread: sorted.filter((m) => m.direction === "in" && !m.read).length,
    });
  }

  return threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/**
 * Badge-teller: ongelezen **ontvangen** berichten.
 *
 * Bewust afgeleid uit de al opgehaalde lijst en niet uit een tweede
 * `frappe.client.get_count`-call. Twee redenen: het scheelt een round-trip per
 * poll, en het maakt de teller per definitie gelijk aan wat er op het scherm
 * staat — een teller die "3" zegt terwijl de lijst er twee toont is erger dan
 * geen teller.
 *
 * Alleen `direction === "in"` telt mee: je eigen verzonden kopie wordt als
 * gelezen aangemaakt, maar de teller mag niet afhangen van of dat veld goed
 * is doorgekomen.
 */
export function countUnread(messages: ErpMessage[]): number {
  return messages.filter((m) => m.direction === "in" && !m.read).length;
}

/* ─── Schrijven ─── */

/**
 * Verstuur een bericht aan één collega.
 *
 * De afzender staat nergens in deze payload: `owner` wordt door Frappe zelf
 * gezet en negeert wat de client meestuurt. `from_user` gaat wél mee, puur
 * zodat de ERPNext-desk-bel de juiste naam toont — deze module leest dat veld
 * nooit terug.
 *
 * De ontvangerskopie gaat als eerste de deur uit: dát is de aflevering. Als
 * de eigen verzonden-kopie daarna faalt is het bericht wél bezorgd, en een
 * fout gooien zou de gebruiker aanzetten tot een tweede poging — dus een
 * dubbel bericht bij de ontvanger. De verzendlijst mist dan hooguit één regel
 * tot de volgende keer.
 */
export async function sendMessage(to: string, text: string): Promise<void> {
  const me = await resolveSessionUser();
  if (!me) throw new Error("Geen ERPNext-sessie");

  const body = text.trim();
  if (!body || !to) return;

  const shared = {
    type: MESSAGE_TYPE,
    document_type: MESSAGE_DOCUMENT_TYPE,
    subject: previewOf(body),
    email_content: textToHtml(body),
    from_user: me,
    link: MESSAGE_LINK,
  };

  await createDocument(MESSAGE_DOCTYPE, {
    ...shared,
    for_user: to,
    document_name: me,
    read: 0,
  });

  try {
    await createDocument(MESSAGE_DOCTYPE, {
      ...shared,
      for_user: me,
      document_name: to,
      read: 1,
    });
  } catch {
    // Bewust stil: zie de toelichting hierboven.
  }

  invalidateCache(MESSAGE_DOCTYPE);
}

/**
 * Markeer berichten als gelezen.
 *
 * Loopt via Frappe's eigen `mark_as_read`-RPC en niet via `updateDocument`,
 * om twee redenen. Die RPC schrijft met `frappe.db.set_value` en heeft dus
 * géén `write`-DocPerm op `Notification Log` nodig — dat werkt ook voor een
 * gebruiker zonder de rol `Employee`. En hij filtert server-side op
 * `for_user = frappe.session.user`, dus je kunt er onmogelijk andermans
 * bericht mee aanraken.
 *
 * De `updateDocument`-terugval is er voor het geval de RPC ontbreekt of
 * weigert; die vereist wél schrijfrecht en mag daarom stil mislukken —
 * gelezen-status is geen actie waarvoor een gebruiker een foutmelding
 * verdient.
 */
export async function markMessagesRead(names: string[]): Promise<void> {
  if (names.length === 0) return;

  await Promise.allSettled(
    names.map(async (docname) => {
      try {
        await callMethod(
          "frappe.desk.doctype.notification_log.notification_log.mark_as_read",
          { docname },
        );
      } catch {
        await updateDocument(MESSAGE_DOCTYPE, docname, { read: 1 }).catch(() => {});
      }
    }),
  );

  invalidateCache(MESSAGE_DOCTYPE);
}

/* ─── Ontvangers ─── */

interface EmployeeRow {
  user_id?: unknown;
  employee_name?: unknown;
}

interface UserRow {
  name?: unknown;
  full_name?: unknown;
}

/** Users die nooit als gesprekspartner mogen opduiken. */
const SYSTEM_USERS = new Set(["Administrator", "Guest"]);

/**
 * De lijst waaruit je een ontvanger kiest.
 *
 * Twee bronnen, want geen van beide is op zichzelf genoeg. `User` is het
 * doctype dat de vraag eigenlijk beantwoordt ("actieve ERPNext-users"), maar
 * op de doelinstance heeft alléén `System Manager` daar leesrecht — een
 * gewone medewerker krijgt een 403. `Employee` mag iedereen met de rol
 * `Employee` wél lezen en draagt via `user_id` precies de koppeling die we
 * nodig hebben. Dus: `Employee` als basis, `User` erbovenop voor wie het mag
 * (dat vult ook de accounts aan die geen Employee-record hebben), en een 403
 * op die tweede bron is geen fout maar de normale gang van zaken.
 */
export async function listContacts(): Promise<ErpMessageContact[]> {
  const me = await resolveSessionUser();

  const [employees, users] = await Promise.all([
    fetchList<EmployeeRow>("Employee", {
      fields: ["user_id", "employee_name"],
      filters: [["status", "=", "Active"], ["user_id", "is", "set"]],
      limit_page_length: 500,
      order_by: "employee_name asc",
    }).catch(() => [] as EmployeeRow[]),
    // Een 403 hier is de normale uitkomst voor iedereen zonder
    // `System Manager` — geen fout om te melden, gewoon één bron minder.
    fetchList<UserRow>("User", {
      fields: ["name", "full_name"],
      filters: [["enabled", "=", 1], ["user_type", "=", "System User"]],
      limit_page_length: 500,
      order_by: "full_name asc",
    }).catch(() => [] as UserRow[]),
  ]);

  const byUser = new Map<string, string>();
  for (const row of employees) {
    const user = toStr(row.user_id);
    if (user) byUser.set(user, toStr(row.employee_name) || user);
  }
  // `User.full_name` wint van `Employee.employee_name`: dat is de naam die de
  // gebruiker in ERPNext zelf ziet staan.
  for (const row of users) {
    const user = toStr(row.name);
    if (user) byUser.set(user, toStr(row.full_name) || byUser.get(user) || user);
  }

  const contacts: ErpMessageContact[] = [];
  for (const [user, fullName] of byUser) {
    if (SYSTEM_USERS.has(user)) continue;
    // Jezelf staat er niet bij: de richting van een bericht volgt uit
    // `owner === for_user`, en bij een bericht aan jezelf klopt dat
    // onderscheid niet meer. Zie de kopjes-uitleg bovenaan.
    if (me && user === me) continue;
    contacts.push({ user, fullName });
  }

  return contacts.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** `contacts` als `user → naam`-map, voor `groupThreads`. */
export function contactNameMap(contacts: ErpMessageContact[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const contact of contacts) map[contact.user] = contact.fullName;
  return map;
}
