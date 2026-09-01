/**
 * Mail-adapter op ERPNext `Communication`.
 *
 * Y-next draait zonder eigen server: er is geen IMAP-brug, geen
 * `/api/mail/*`-endpoints en geen server-side sessiecache meer. Deze module
 * vertaalt de Communication-semantiek van ERPNext naar de berichtvormen die
 * de bestaande Webmail-UI kent, zodat de UI-laag herkenbaar blijft terwijl de
 * databron volledig ERPNext is.
 *
 * Twee dingen die niet vanzelfsprekend zijn:
 *
 * 1. **Mappen zijn virtueel.** Er bestaan geen IMAP-mappen; een "map" is
 *    hier een vaste filter op Communication (Postvak IN / Verzonden /
 *    Ongelezen / Prullenbak) of een projectkoppeling
 *    (`reference_doctype=Project`). Map-CRUD, verplaatsen en gedeelde
 *    postvakken bestaan dus niet in dit model — die UI hoort achter de
 *    IMAP-featuregate te blijven.
 *
 *    De enige uitzondering is de **Prullenbak**: die is géén verzinsel van
 *    Y-next maar Frappe's eigen `Communication.email_status`, een Select met
 *    exact drie opties (`Open` / `Spam` / `Trash`) — live geverifieerd op de
 *    doelinstance (Frappe 16.19.0 / ERPNext 16.16.0). Verwijderen zet dat
 *    veld op `Trash`; definitief verwijderen is pas daarná een echte DELETE.
 *
 * 2. **Nooit SQL-aggregates in `fields`.** Frappe v16 weigert die met
 *    HTTP 417 ("SQL functions are not allowed as strings in SELECT") en er
 *    valt geen veld te droppen om zich daaruit te herstellen. Alle tellingen
 *    lopen daarom via `fetchCount` (`frappe.client.get_count`).
 *
 * Alle netwerkcalls gaan via de gedeelde helpers uit `./erpnext.ts`; die
 * bevatten het 417-veld-zelfherstel, de missing-doctype-cache, de CSRF-header
 * en de per-call timeouts.
 */

import {
  createDocument,
  deleteDocument,
  fetchAttachments,
  fetchCount,
  fetchDocument,
  fetchList,
  invalidateCache,
  updateDocument,
  uploadFile,
  callMethod,
  ApiError,
  type FileInfo,
} from "./erpnext.ts";
import { resolveSessionUser } from "./session.ts";

/** Een Communication zoals de Webmail-UI hem consumeert. */
export interface ErpMailMessage {
  /** Communication docname — vervangt de IMAP-uid als stabiele sleutel. */
  name: string;
  subject: string;
  /** E-mailadres van de afzender. */
  sender: string;
  /** `sender_full_name` — leeg als ERPNext geen naam kent. */
  senderName: string;
  recipients: string;
  cc?: string;
  /** `communication_date` (ERPNext-datetimestring). */
  date: string;
  seen: boolean;
  /** Virtuele map-id waarin dit bericht is opgehaald. */
  folder: string;
  hasAttachments: boolean;
  /** Communication-name van het bericht waarop dit een antwoord is. */
  inReplyTo?: string;
  /** Gekoppeld ERPNext-document (bv. het project van de mail). */
  reference?: { doctype: string; name: string };
}

export interface ErpMailFolder {
  id: string;
  /**
   * Weergavenaam. Voor de vaste mappen is dit een NL-standaardlabel; de
   * UI-laag mag op `kind` vertalen. Project- en custom mappen dragen hun
   * eigen naam, die per definitie niet vertaalbaar is.
   */
  label: string;
  unseen: number;
  kind: "inbox" | "sent" | "unread" | "trash" | "project" | "custom";
  /** Alleen bij `kind === "project"`: de Project-docname. */
  project?: string;
  /** Alleen bij `kind === "custom"`: het tag-label zonder `mail/`-prefix. */
  tag?: string;
}

/** Eén pagina berichten plus de wetenschap of er nog meer is. */
export interface ErpMailPage {
  messages: ErpMailMessage[];
  /**
   * `true` zodra de server een volle pagina teruggaf. Bewust géén
   * extra `get_count`: dat is een tweede round-trip per pagina en de
   * enige vraag die de UI ("Meer laden"-knop) stelt is of er nóg een
   * pagina te halen valt. Prijs: op een exacte veelvoud van `limit`
   * levert de laatste klik één lege pagina op.
   */
  hasMore: boolean;
}

/* ─── Virtuele map-ids ─── */

export const MAIL_FOLDER_INBOX = "INBOX";
export const MAIL_FOLDER_SENT = "Sent";
export const MAIL_FOLDER_UNREAD = "unread";
/** Virtuele Prullenbak-map: alles met `email_status = "Trash"`. */
export const MAIL_FOLDER_TRASH = "trash";
export const MAIL_PROJECT_FOLDER_PREFIX = "project:";
/** Map-id-prefix van een custom (tag-)map: `tag:Klanten`. */
export const MAIL_TAG_FOLDER_PREFIX = "tag:";
/**
 * Naam-prefix van de Tag-documenten die als mailmap tellen. Zonder deze
 * namespace zou elke ERPNext-tag (project-, taak-, klanttags) als mailmap
 * in de mappenlijst opduiken.
 */
export const MAIL_TAG_NAME_PREFIX = "mail/";

/** Hoeveel projectmappen maximaal in de mappenlijst verschijnen. */
const MAX_PROJECT_FOLDERS = 50;
/** Hoeveel recente Communications de projectdiscovery scant. */
const PROJECT_DISCOVERY_WINDOW = 200;
/** Hoeveel custom (tag-)mappen maximaal in de mappenlijst verschijnen. */
const MAX_CUSTOM_FOLDERS = 50;
/** Standaard paginagrootte van de berichtenlijst. */
const DEFAULT_PAGE_SIZE = 50;
/** Harde bovengrens van een conversatie-closure (zie `getConversation`). */
const MAX_CONVERSATION_MESSAGES = 25;
/** Standaard aantal treffers van een zoekactie. */
const DEFAULT_SEARCH_LIMIT = 50;
/** Hoeveel Email Accounts de IMAP-mappensectie maximaal uitleest. */
const MAX_IMAP_ACCOUNTS = 5;

/* ─── Prullenbak: Frappe's eigen `Communication.email_status` ─── */

/**
 * `email_status` is een Select met exact drie opties: `Open` / `Spam` /
 * `Trash` (live opgehaald uit het DocField op de doelinstance — het is NIET
 * hetzelfde veld als `status`, dat Open/Replied/Closed/Linked kent). Y-next
 * gebruikt daarvan alleen `Open` en `Trash`; `Spam` blijft ongemoeid en telt
 * dus gewoon mee in Postvak IN, precies zoals ERPNext het zelf toont.
 */
const EMAIL_STATUS_TRASH = "Trash";
const EMAIL_STATUS_OPEN = "Open";

/**
 * Sluit prullenbak-items uit elke niet-prullenbak-query.
 *
 * **NULL-veilig, en dat is niet vanzelfsprekend.** In kaal SQL laat
 * `email_status != 'Trash'` rijen met `NULL` vallen — dat zou hier élke mail
 * onzichtbaar maken die ooit zonder `email_status` is weggeschreven. Frappe's
 * `DatabaseQuery` wikkelt negatieve operatoren echter in `ifnull(...)`; dat is
 * op de doelinstance geverifieerd met een veld dat op álle rijen NULL is
 * (`imap_folder != "x"` gaf alle rijen terug in plaats van nul). Wie deze
 * filter ooit vervangt door een handgeschreven `or_filters`-constructie of
 * een ander backend-pad, moet die eigenschap opnieuw aantonen.
 */
const NOT_TRASHED: unknown[] = ["email_status", "!=", EMAIL_STATUS_TRASH];

const LIST_FIELDS = [
  "name",
  "subject",
  "sender",
  "sender_full_name",
  "recipients",
  "cc",
  "communication_date",
  "seen",
  "has_attachment",
  "in_reply_to",
  "reference_doctype",
  "reference_name",
];

/**
 * Zoek- en conversatieresultaten komen niet uit één map, dus die queries
 * vragen `sent_or_received` mee om de bijbehorende virtuele map af te leiden.
 */
const SEARCH_FIELDS = [...LIST_FIELDS, "sent_or_received", "email_status"];

/** Frappe geeft Check-velden als 0/1 terug, maar niet elke route consequent. */
function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

function toStr(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Docname van de projectmap-id (`project:PROJ-0001` → `PROJ-0001`). */
export function projectOfFolder(folderId: string): string | null {
  return folderId.startsWith(MAIL_PROJECT_FOLDER_PREFIX)
    ? folderId.slice(MAIL_PROJECT_FOLDER_PREFIX.length)
    : null;
}

/** Tag-label van de custom map-id (`tag:Klanten` → `Klanten`). */
export function tagOfFolder(folderId: string): string | null {
  if (!folderId.startsWith(MAIL_TAG_FOLDER_PREFIX)) return null;
  const label = folderId.slice(MAIL_TAG_FOLDER_PREFIX.length);
  return label ? label : null;
}

/** Volledige Tag-docname van een custom map (`Klanten` → `mail/Klanten`). */
export function tagNameForLabel(label: string): string {
  return `${MAIL_TAG_NAME_PREFIX}${label.trim()}`;
}

/**
 * Een tag-label moet een geldige Tag-docname opleveren én bruikbaar blijven
 * in de `_user_tags`-string, die komma-gescheiden is. Een label met een
 * komma zou daar in twee tags uiteenvallen en de map onvindbaar maken.
 */
function assertValidTagLabel(label: string): string {
  const trimmed = (label ?? "").trim();
  if (!trimmed) throw new Error("Mapnaam mag niet leeg zijn");
  if (trimmed.includes(",")) throw new Error("Mapnaam mag geen komma bevatten");
  return trimmed;
}

/**
 * Filters van een virtuele map. Onbekende map-ids vallen bewust terug op
 * Postvak IN, zodat een stale map-id uit localStorage geen lege of foutieve
 * lijst oplevert.
 *
 * Élke map behalve de Prullenbak sluit getrashte mail uit — óók Verzonden,
 * de projectmappen en de eigen (tag-)mappen. Zou dat ergens ontbreken, dan
 * zou een weggegooide mail daar blijven staan en zou "verwijderen" per map
 * iets anders betekenen.
 */
function filtersForFolder(folderId: string): unknown[][] {
  if (folderId === MAIL_FOLDER_TRASH) {
    // Bewust géén `sent_or_received`-beperking: de prullenbak toont zowel
    // weggegooide ontvangen als verzonden mail, net als in elke mailclient.
    return [
      ["communication_type", "=", "Communication"],
      ["email_status", "=", EMAIL_STATUS_TRASH],
    ];
  }
  const base: unknown[][] = [["communication_type", "=", "Communication"], NOT_TRASHED];
  if (folderId === MAIL_FOLDER_SENT) {
    return [...base, ["sent_or_received", "=", "Sent"]];
  }
  if (folderId === MAIL_FOLDER_UNREAD) {
    return [...base, ["sent_or_received", "=", "Received"], ["seen", "=", 0]];
  }
  const project = projectOfFolder(folderId);
  if (project) {
    return [...base, ["reference_doctype", "=", "Project"], ["reference_name", "=", project]];
  }
  const tag = tagOfFolder(folderId);
  if (tag) {
    // `_user_tags` is één komma-gescheiden string per document; een `like`
    // is de enige manier om er in een lijstquery op te filteren. Bewust
    // géén `sent_or_received`-beperking: een custom map mag zowel
    // ontvangen als verzonden mail bevatten.
    return [...base, ["_user_tags", "like", `%${tagNameForLabel(tag)}%`]];
  }
  return [...base, ["sent_or_received", "=", "Received"]];
}

/**
 * Virtuele map van een rij die niet uit een mapquery komt (zoek- en
 * conversatieresultaten). Zonder `sent_or_received` in de rij is Postvak IN
 * de veilige aanname: dat is de map waar de UI standaard op terugvalt.
 *
 * Een getrashte rij hoort bij de Prullenbak, niet bij zijn oorspronkelijke
 * richting — anders zou de conversatieweergave beweren dat een weggegooid
 * bericht nog in Postvak IN staat.
 */
function folderForRow(row: Record<string, unknown>): string {
  if (toStr(row.email_status) === EMAIL_STATUS_TRASH) return MAIL_FOLDER_TRASH;
  return toStr(row.sent_or_received) === "Sent" ? MAIL_FOLDER_SENT : MAIL_FOLDER_INBOX;
}

function mapMessage(row: Record<string, unknown>, folderId: string): ErpMailMessage {
  const msg: ErpMailMessage = {
    name: toStr(row.name),
    subject: toStr(row.subject),
    sender: toStr(row.sender),
    senderName: toStr(row.sender_full_name),
    recipients: toStr(row.recipients),
    date: toStr(row.communication_date),
    seen: toBool(row.seen),
    folder: folderId,
    hasAttachments: toBool(row.has_attachment),
  };
  if (row.cc) msg.cc = toStr(row.cc);
  if (row.in_reply_to) msg.inReplyTo = toStr(row.in_reply_to);
  if (row.reference_doctype && row.reference_name) {
    msg.reference = { doctype: toStr(row.reference_doctype), name: toStr(row.reference_name) };
  }
  return msg;
}

/**
 * Berichtenlijst van een virtuele map, nieuwste eerst.
 *
 * `search` filtert op onderwerp óf afzender (Frappe combineert `filters` met
 * AND en `or_filters` met OR, dus de mapfilters blijven gelden). Bewust niet
 * op `content`: dat is een LONGTEXT-kolom en een `like` daarop maakt elke
 * zoekactie traag.
 */
export async function listMailboxMessages(
  folderId: string,
  opts?: { limit?: number; start?: number; search?: string; mailbox?: string }
): Promise<ErpMailMessage[]> {
  const search = opts?.search?.trim();
  const mailbox = opts?.mailbox?.trim();
  const params: {
    fields: string[];
    filters: unknown[][];
    or_filters?: unknown[][];
    order_by: string;
    limit_page_length: number;
    limit_start: number;
  } = {
    fields: LIST_FIELDS,
    filters: mailbox
      ? [...filtersForFolder(folderId), ["email_account", "=", mailbox]]
      : filtersForFolder(folderId),
    order_by: "communication_date desc",
    limit_page_length: opts?.limit ?? DEFAULT_PAGE_SIZE,
    limit_start: opts?.start ?? 0,
  };
  if (search) {
    params.or_filters = [
      ["subject", "like", `%${search}%`],
      ["sender", "like", `%${search}%`],
    ];
  }
  const rows = await fetchList<Record<string, unknown>>("Communication", params);
  return rows.map((row) => mapMessage(row, folderId));
}

/**
 * Zelfde lijst als `listMailboxMessages`, maar met de paginatie-vraag die de
 * UI stelt: valt er nóg een pagina te halen? Zie `ErpMailPage.hasMore` voor
 * waarom dat op de paginagrootte wordt afgeleid en niet op een teller.
 */
export async function listMailboxMessagesPaged(
  folderId: string,
  opts: { start: number; limit: number; search?: string; mailbox?: string }
): Promise<ErpMailPage> {
  const limit = opts.limit;
  const messages = await listMailboxMessages(folderId, {
    limit,
    start: opts.start,
    search: opts.search,
    mailbox: opts.mailbox,
  });
  return { messages, hasMore: messages.length === limit };
}

/**
 * Vrije zoekactie over álle mappen heen (dus zonder `sent_or_received`- of
 * referentiefilter). Treffers krijgen de map die bij hun richting hoort,
 * zodat de UI ze kan openen alsof ze uit Postvak IN of Verzonden komen.
 *
 * `content` (de mailbody) doet standaard **niet** mee: dat is een LONGTEXT-
 * kolom zonder index, en een `like %…%` daarop scant elke Communication —
 * op een volle mailbox is dat seconden per toetsaanslag. Frappe staat de
 * filter wél toe (het is geen SQL-functie in `fields`, dus geen 417), dus wie
 * die prijs bewust wil betalen zet `includeContent: true`.
 */
export async function searchMessages(
  query: string,
  opts?: { limit?: number; includeContent?: boolean }
): Promise<ErpMailMessage[]> {
  const term = (query ?? "").trim();
  if (!term) return [];
  const like = `%${term}%`;
  const orFilters: unknown[][] = [
    ["subject", "like", like],
    ["sender", "like", like],
    ["recipients", "like", like],
  ];
  if (opts?.includeContent) orFilters.push(["content", "like", like]);

  const rows = await fetchList<Record<string, unknown>>("Communication", {
    fields: SEARCH_FIELDS,
    // Zoeken gaat over álle mappen heen, maar niet over de prullenbak: wie
    // een weggegooide mail zoekt, hoort daarvoor de Prullenbak te openen.
    filters: [["communication_type", "=", "Communication"], NOT_TRASHED],
    or_filters: orFilters,
    order_by: "communication_date desc",
    limit_page_length: opts?.limit ?? DEFAULT_SEARCH_LIMIT,
  });
  return rows.map((row) => mapMessage(row, folderForRow(row)));
}

/**
 * Projectmappen: de projecten waaraan recent gemaild is. Eén platte lijst-
 * query levert de kandidaten (aggregates zijn niet toegestaan), daarna één
 * `get_count` per uniek project voor de ongelezen-teller.
 */
async function listProjectFolders(): Promise<ErpMailFolder[]> {
  const rows = await fetchList<{ reference_name?: string }>("Communication", {
    fields: ["reference_name", "communication_date"],
    filters: [
      ["communication_type", "=", "Communication"],
      NOT_TRASHED,
      ["reference_doctype", "=", "Project"],
    ],
    order_by: "communication_date desc",
    limit_page_length: PROJECT_DISCOVERY_WINDOW,
  });

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = row?.reference_name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    unique.push(name);
    if (unique.length >= MAX_PROJECT_FOLDERS) break;
  }
  if (unique.length === 0) return [];

  const labels = new Map<string, string>();
  try {
    const projects = await fetchList<{ name: string; project_name?: string }>("Project", {
      fields: ["name", "project_name"],
      filters: [["name", "in", unique]],
      limit_page_length: unique.length,
    });
    for (const p of projects) {
      if (p?.name) labels.set(p.name, p.project_name || p.name);
    }
  } catch {
    // Geen leesrecht op Project (of de call faalde) — de docname is een
    // prima label, dat is geen reden om de hele mappenlijst te laten vallen.
  }

  const counts = await Promise.all(
    unique.map((project) =>
      fetchCount("Communication", [
        ["communication_type", "=", "Communication"],
        NOT_TRASHED,
        ["reference_doctype", "=", "Project"],
        ["reference_name", "=", project],
        ["seen", "=", 0],
      ]).catch(() => 0)
    )
  );

  return unique.map((project, i) => ({
    id: `${MAIL_PROJECT_FOLDER_PREFIX}${project}`,
    label: labels.get(project) || project,
    unseen: counts[i],
    kind: "project" as const,
    project,
  }));
}

/**
 * Custom mappen: door de gebruiker aangemaakte `Tag`-documenten met de
 * `mail/`-namespace. Anders dan projectmappen zijn dit echte documenten, dus
 * een lege map blijft bestaan tot hij expliciet verwijderd wordt.
 */
export async function listCustomFolders(): Promise<ErpMailFolder[]> {
  const rows = await fetchList<{ name?: string }>("Tag", {
    fields: ["name"],
    filters: [["name", "like", `${MAIL_TAG_NAME_PREFIX}%`]],
    order_by: "name asc",
    limit_page_length: MAX_CUSTOM_FOLDERS,
  });

  const labels: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = row?.name;
    if (!name || !name.startsWith(MAIL_TAG_NAME_PREFIX)) continue;
    const label = name.slice(MAIL_TAG_NAME_PREFIX.length).trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  if (labels.length === 0) return [];

  const counts = await Promise.all(
    labels.map((label) =>
      fetchCount("Communication", [
        ["communication_type", "=", "Communication"],
        NOT_TRASHED,
        ["_user_tags", "like", `%${tagNameForLabel(label)}%`],
        ["seen", "=", 0],
      ]).catch(() => 0)
    )
  );

  return labels.map((label, i) => ({
    id: `${MAIL_TAG_FOLDER_PREFIX}${label}`,
    label,
    unseen: counts[i],
    kind: "custom" as const,
    tag: label,
  }));
}

/**
 * Maak een custom map aan. Dat is puur een `Tag`-document; pas wanneer er
 * een mail aan wordt getagd verschijnt er inhoud in.
 */
export async function createCustomFolder(label: string): Promise<void> {
  const clean = assertValidTagLabel(label);
  await createDocument("Tag", { name: tagNameForLabel(clean) });
}

/**
 * Verwijder een custom map.
 *
 * Let op: dit verwijdert alleen het `Tag`-document. De reeds getagde
 * Communications houden de tagstring in hun `_user_tags`-veld. Dat is
 * onschadelijk residu — de map verdwijnt uit `listCustomFolders()` en er is
 * geen map-id meer die erop filtert — maar het betekent dat een map met
 * dezelfde naam die later opnieuw wordt aangemaakt direct weer de oude mail
 * toont. Bewust niet elke mail nalopen: dat zou N updates kosten voor een
 * cosmetisch veld.
 */
export async function deleteCustomFolder(label: string): Promise<void> {
  const clean = assertValidTagLabel(label);
  await deleteDocument("Tag", tagNameForLabel(clean));
}

/* ─── Taggen van losse berichten ─── */

/** `_user_tags` als lijst; Frappe schrijft er een leidende komma in. */
function parseUserTags(raw: unknown): string[] {
  return toStr(raw)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Frappe's eigen serialisatie: leidende komma, verder komma-gescheiden. */
function serializeUserTags(tags: string[]): string {
  return tags.length > 0 ? `,${tags.join(",")}` : "";
}

/**
 * Fallback-pad voor (un)taggen: schrijf `_user_tags` rechtstreeks.
 *
 * De primaire route is Frappe's eigen `add_tag`/`remove_tag` RPC — die houdt
 * naast `_user_tags` ook de `Tag Link`-administratie bij. Blijkt die op deze
 * instance niet aanroepbaar (niet-whitelisted / geen rechten / methode
 * ontbreekt), dan valt de adapter automatisch terug op deze documentupdate.
 * Functioneel voor de mailmappen is dat gelijkwaardig: de mapfilter kijkt
 * uitsluitend naar `_user_tags`.
 */
async function writeUserTags(name: string, mutate: (tags: string[]) => string[]): Promise<void> {
  const doc = await fetchDocument<{ _user_tags?: string }>("Communication", name);
  const current = parseUserTags(doc?._user_tags);
  const next: string[] = [];
  for (const tag of mutate(current)) {
    if (tag && !next.includes(tag)) next.push(tag);
  }
  await updateDocument("Communication", name, { _user_tags: serializeUserTags(next) });
}

/** Hang een custom map(tag) aan een bericht. */
export async function tagMessage(name: string, label: string): Promise<void> {
  const tag = tagNameForLabel(assertValidTagLabel(label));
  try {
    await callMethod("frappe.desk.doctype.tag.tag.add_tag", {
      tag,
      dt: "Communication",
      dn: name,
    });
  } catch {
    await writeUserTags(name, (tags) => [...tags, tag]);
  }
  invalidateCache("Communication");
}

/** Haal een custom map(tag) van een bericht af. */
export async function untagMessage(name: string, label: string): Promise<void> {
  const tag = tagNameForLabel(assertValidTagLabel(label));
  try {
    await callMethod("frappe.desk.doctype.tag.tag.remove_tag", {
      tag,
      dt: "Communication",
      dn: name,
    });
  } catch {
    await writeUserTags(name, (tags) => tags.filter((t) => t !== tag));
  }
  invalidateCache("Communication");
}

/**
 * De virtuele mappenlijst: de vaste mappen, de custom (tag-)mappen en de
 * projectmappen. "Ongelezen" is een view op Postvak IN en deelt daarom zijn
 * teller; de Prullenbak telt zijn eigen ongelezen berichten.
 */
export async function listVirtualFolders(): Promise<ErpMailFolder[]> {
  const [unseen, trashUnseen, customFolders, projectFolders] = await Promise.all([
    unseenCount().catch(() => 0),
    fetchCount("Communication", [
      ...filtersForFolder(MAIL_FOLDER_TRASH),
      ["seen", "=", 0],
    ]).catch(() => 0),
    listCustomFolders().catch(() => [] as ErpMailFolder[]),
    listProjectFolders().catch(() => [] as ErpMailFolder[]),
  ]);
  return [
    { id: MAIL_FOLDER_INBOX, label: "Postvak IN", unseen, kind: "inbox" },
    { id: MAIL_FOLDER_SENT, label: "Verzonden", unseen: 0, kind: "sent" },
    { id: MAIL_FOLDER_UNREAD, label: "Ongelezen", unseen, kind: "unread" },
    { id: MAIL_FOLDER_TRASH, label: "Prullenbak", unseen: trashUnseen, kind: "trash" },
    ...customFolders,
    ...projectFolders,
  ];
}

/* ─── Postbussen (Email Accounts) ─── */

/**
 * Gedeelde postbussen die iedere medewerker in de kiezer mag zien, naast zijn
 * eigen postbus. ERPNext kent geen rechten per mailbox — `Communication` is
 * alles-of-niets — dus dit is een weergavekeuze, geen beveiliging.
 */
const SHARED_MAILBOXES = ["info@3bm.co.nl", "cooperatie@3bm.co.nl"];

/** Eén kiesbare postbus in de mailmodule. */
export interface ErpMailbox {
  /** Docname van het Email Account; de waarde waarop gefilterd wordt. */
  name: string;
  /** Het e-mailadres, voor de labeltekst. */
  emailId: string;
  /** Eigen postbus van de ingelogde gebruiker (staat bovenaan). */
  own: boolean;
}

/**
 * De postbussen die de ingelogde gebruiker mag kiezen: zijn eigen account
 * plus de gedeelde uit `SHARED_MAILBOXES`.
 *
 * Waarom dit kán: ERPNext vult `Communication.email_account` wél betrouwbaar
 * (in tegenstelling tot `imap_folder`, dat altijd leeg blijft — zie
 * `listImapFolders`). Daarmee is per postbus filteren wél mogelijk.
 *
 * `Email Account` vereist de rol Inbox User of System Manager; bij een 403
 * komt er een lege lijst terug en valt de UI terug op één gecombineerde
 * stroom, precies zoals vóór deze functie.
 */
export async function listMailboxes(): Promise<ErpMailbox[]> {
  try {
    const [user, accounts] = await Promise.all([
      resolveSessionUser(),
      // Geen serverfilter op enable_incoming: het eigen adres van iemand kan
      // wél verzenden en (nog) niet ontvangen. Zo'n bus hoort zichtbaar te
      // zijn — de map Verzonden staat er vol mee, en zodra de beheerder de
      // inkomende sync aanzet vult Postvak IN zich vanzelf. Frappe combineert
      // filters met AND, dus de of-vraag doen we hier.
      fetchList<{
        name: string;
        email_id?: string;
        enable_incoming?: number;
        enable_outgoing?: number;
      }>("Email Account", {
        fields: ["name", "email_id", "enable_incoming", "enable_outgoing"],
        order_by: "name asc",
        limit_page_length: MAX_IMAP_ACCOUNTS,
      }),
    ]);
    const me = toStr(user).toLowerCase();
    const out: ErpMailbox[] = [];
    for (const acc of accounts) {
      const emailId = toStr(acc.email_id).toLowerCase();
      if (!emailId) continue;
      if (!acc.enable_incoming && !acc.enable_outgoing) continue;
      const own = me !== "" && emailId === me;
      if (!own && !SHARED_MAILBOXES.includes(emailId)) continue;
      out.push({ name: acc.name, emailId: toStr(acc.email_id), own });
    }
    out.sort((a, b) => (a.own === b.own ? a.emailId.localeCompare(b.emailId) : a.own ? -1 : 1));
    return out;
  } catch {
    return [];
  }
}

/* ─── IMAP-mappen van het gekoppelde Email Account (alleen-lezen) ─── */

/** Eén rij uit de `imap_folder`-child-table van een Email Account. */
export interface ErpImapFolder {
  /** Docname van het Email Account waar deze rij bij hoort. */
  account: string;
  /** IMAP-mapnaam zoals ERPNext hem synchroniseert (bv. `INBOX`). */
  folderName: string;
  /** Doctype waar mail uit deze map aan gehangen wordt; meestal leeg. */
  appendTo?: string;
}

/**
 * De IMAP-mappen die ERPNext daadwerkelijk synchroniseert.
 *
 * **Waarom dit alleen-lezen informatie is en geen mapfilter.** De
 * `imap_folder`-child-table bepaalt wélke IMAP-mappen ERPNext ophaalt, maar
 * de binnengehaalde `Communication` legt de bronmap **niet** vast: het veld
 * `Communication.imap_folder` bestaat wel (Data, hidden, read-only) maar staat
 * op de doelinstance op `NULL` voor élk bericht — ook voor de mails die net
 * via de INBOX-rij zijn gesynct. Er is dus geen kolom om per map op te
 * filteren, en `uid` alléén helpt niet: dat is een per-map-teller, die na een
 * tweede maprij niet meer uniek is.
 *
 * Gevolg: extra rijen toevoegen laat méér mail binnenkomen, maar alles komt
 * in één ongedifferentieerde stroom terecht. Deze functie voedt daarom een
 * informatieve sectie in de mappenkolom — géén klikbare filters die niets
 * zouden filteren.
 *
 * `Email Account` is geen breed leesbaar DocType; bij een 403 (of welke fout
 * dan ook) komt er een lege lijst terug en verdwijnt de sectie stilletjes.
 */
export async function listImapFolders(): Promise<ErpImapFolder[]> {
  try {
    const accounts = await fetchList<{ name: string }>("Email Account", {
      fields: ["name"],
      filters: [["enable_incoming", "=", 1], ["use_imap", "=", 1]],
      order_by: "name asc",
      limit_page_length: MAX_IMAP_ACCOUNTS,
    });
    if (accounts.length === 0) return [];

    // De child-table komt niet mee in een lijstquery — die zit alleen in het
    // volledige document. Eén doc-fetch per account, parallel.
    const docs = await Promise.all(
      accounts.map((acc) =>
        fetchDocument<{ imap_folder?: { folder_name?: string; append_to?: string }[] }>(
          "Email Account",
          acc.name
        )
          .then((doc) => ({ account: acc.name, rows: doc?.imap_folder ?? [] }))
          .catch(() => ({ account: acc.name, rows: [] as { folder_name?: string; append_to?: string }[] }))
      )
    );

    const out: ErpImapFolder[] = [];
    const seen = new Set<string>();
    for (const { account, rows } of docs) {
      for (const row of rows) {
        const folderName = toStr(row?.folder_name).trim();
        if (!folderName) continue;
        const key = `${account} ${folderName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const entry: ErpImapFolder = { account, folderName };
        const appendTo = toStr(row?.append_to).trim();
        if (appendTo) entry.appendTo = appendTo;
        out.push(entry);
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Volledige mailinhoud (HTML) plus de op de Communication gehangen Files. */
export async function getMessageBody(
  name: string
): Promise<{ html: string; attachments: { file_url: string; file_name: string }[] }> {
  const [doc, files] = await Promise.all([
    fetchDocument<{ content?: string }>("Communication", name),
    fetchAttachments("Communication", name).catch(() => [] as FileInfo[]),
  ]);
  return {
    html: toStr(doc?.content),
    attachments: files.map((f) => ({ file_url: f.file_url, file_name: f.file_name })),
  };
}

/**
 * Gelezen-status. Anders dan bij IMAP is dit een gewone documentupdate —
 * geen `\Seen`-STORE-race, dus de UI heeft hier geen TTL-overlay nodig.
 */
export async function markRead(name: string): Promise<void> {
  await updateDocument("Communication", name, { seen: 1 });
}

export async function markUnread(name: string): Promise<void> {
  await updateDocument("Communication", name, { seen: 0 });
}

/**
 * Verplaats een bericht naar de Prullenbak.
 *
 * Dit is een gewone documentupdate op `email_status` — geen DELETE. Het
 * bericht verdwijnt daarmee uit élke andere maplijst (zie `NOT_TRASHED`) en
 * verschijnt in de Prullenbak, waar het teruggezet of definitief verwijderd
 * kan worden. Omdat het omkeerbaar is hoeft de UI hier **niet** om
 * bevestiging te vragen; dat hoort alleen bij `deleteForever`.
 *
 * Wat dit NIET doet: de originele mail op de mailserver aanraken. ERPNext
 * synchroniseert `email_status` niet terug naar IMAP, dus dit raakt
 * uitsluitend de ERPNext-kopie. De mappenkolom zegt dat met zoveel woorden.
 */
export async function moveToTrash(name: string): Promise<void> {
  await updateDocument("Communication", name, { email_status: EMAIL_STATUS_TRASH });
}

/** Haal een bericht weer uit de Prullenbak; het keert terug in zijn map. */
export async function restoreFromTrash(name: string): Promise<void> {
  await updateDocument("Communication", name, { email_status: EMAIL_STATUS_OPEN });
}

/**
 * Verwijder een bericht definitief: een echte DELETE op de Communication.
 *
 * Onomkeerbaar, dus alleen aan te bieden vanuit de Prullenbak en achter een
 * bevestiging. Vereist `delete` op Communication (permlevel 0) — die DocPerm
 * zet `scripts/provision-y-next.mjs`; zonder die regel geeft dit een 403 en
 * blijft `moveToTrash` het enige werkende pad.
 */
export async function deleteForever(name: string): Promise<void> {
  await deleteDocument("Communication", name);
}

/**
 * Voer een bulkactie parallel uit over een lijst berichten.
 *
 * Twee dingen die de bulkvorm anders maken dan N losse calls:
 *
 * 1. **Eén cache-invalidatie.** Elke `updateDocument`/`deleteDocument`
 *    invalideert zelf al, maar die invalidaties vallen verspreid over de
 *    parallelle calls: een lijstfetch die tussen de eerste en de laatste
 *    binnenkomt, zet een halfbakken lijst terug in de cache. De expliciete
 *    invalidatie ná `allSettled` garandeert dat de eerstvolgende lijst vers
 *    van de server komt.
 * 2. **Deelfouten laten de rest staan.** Eén Communication zonder
 *    schrijfrecht mag de andere 49 niet ongedaan maken, dus per-item fouten
 *    worden verzameld in plaats van gegooid. Faalt *alles*, dan is er niets
 *    gebeurd en gaat de eerste fout alsnog naar de aanroeper.
 */
async function bulkApply(names: string[], op: (name: string) => Promise<unknown>): Promise<void> {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length === 0) return;
  const results = await Promise.allSettled(unique.map((name) => op(name)));
  invalidateCache("Communication");
  const rejected = results.filter((r) => r.status === "rejected");
  if (rejected.length === results.length) {
    throw (rejected[0] as PromiseRejectedResult).reason;
  }
}

export async function bulkMarkRead(names: string[]): Promise<void> {
  await bulkApply(names, (name) => updateDocument("Communication", name, { seen: 1 }));
}

export async function bulkMarkUnread(names: string[]): Promise<void> {
  await bulkApply(names, (name) => updateDocument("Communication", name, { seen: 0 }));
}

export async function bulkMoveToTrash(names: string[]): Promise<void> {
  await bulkApply(names, (name) =>
    updateDocument("Communication", name, { email_status: EMAIL_STATUS_TRASH })
  );
}

export async function bulkRestoreFromTrash(names: string[]): Promise<void> {
  await bulkApply(names, (name) =>
    updateDocument("Communication", name, { email_status: EMAIL_STATUS_OPEN })
  );
}

export async function bulkDeleteForever(names: string[]): Promise<void> {
  await bulkApply(names, (name) => deleteDocument("Communication", name));
}

/**
 * De conversatie rond één bericht: de hele `in_reply_to`-boom waar het in
 * zit, chronologisch oplopend.
 *
 * Anders dan bij IMAP zijn er geen `References`-headers om overheen te
 * lopen — ERPNext legt de threading vast in het `in_reply_to`-veld van
 * Communication. De closure loopt daarom twee kanten op: omhoog langs de
 * ouderketen (één lookup per stap) en omlaag via `in_reply_to in [...]`
 * (één lookup per niveau, dus ook zijtakken/antwoorden van broers en zussen).
 *
 * Harde grens van `MAX_CONVERSATION_MESSAGES`: een pathologisch lange thread
 * mag geen tientallen round-trips kosten bij het openen van één mail.
 */
export async function getConversation(name: string): Promise<ErpMailMessage[]> {
  if (!name) return [];

  const found = new Map<string, ErpMailMessage>();

  /**
   * `includeTrashed` staat alleen aan voor het bronbericht: wie een mail in
   * de Prullenbak opent hoort zijn conversatie gewoon te zien. De rest van de
   * boom laat weggegooide berichten juist weg — die horen niet terug te komen
   * als thread-blokje boven een mail in Postvak IN.
   */
  async function fetchByNames(
    names: string[],
    opts?: { includeTrashed?: boolean }
  ): Promise<ErpMailMessage[]> {
    if (names.length === 0) return [];
    const filters: unknown[][] = [["communication_type", "=", "Communication"]];
    if (!opts?.includeTrashed) filters.push(NOT_TRASHED);
    filters.push(["name", "in", names]);
    const rows = await fetchList<Record<string, unknown>>("Communication", {
      fields: SEARCH_FIELDS,
      filters,
      limit_page_length: names.length,
    });
    return rows.map((row) => mapMessage(row, folderForRow(row)));
  }

  const root = (await fetchByNames([name], { includeTrashed: true }))[0];
  if (!root) return [];
  found.set(root.name, root);

  // Omhoog: de ouderketen. Stopt bij een ontbrekende of al bekende ouder
  // (dat laatste sluit ook een cyclus in corrupte data af).
  let parent = root.inReplyTo;
  while (parent && !found.has(parent) && found.size < MAX_CONVERSATION_MESSAGES) {
    const rows = await fetchByNames([parent]).catch(() => [] as ErpMailMessage[]);
    const msg = rows[0];
    if (!msg) break;
    found.set(msg.name, msg);
    parent = msg.inReplyTo;
  }

  // Omlaag: per niveau alle antwoorden op de tot nu toe bekende berichten.
  let frontier = [...found.keys()];
  while (frontier.length > 0 && found.size < MAX_CONVERSATION_MESSAGES) {
    const rows = await fetchList<Record<string, unknown>>("Communication", {
      fields: SEARCH_FIELDS,
      filters: [
        ["communication_type", "=", "Communication"],
        NOT_TRASHED,
        ["in_reply_to", "in", frontier],
      ],
      order_by: "communication_date asc",
      limit_page_length: MAX_CONVERSATION_MESSAGES,
    }).catch(() => [] as Record<string, unknown>[]);
    const next: string[] = [];
    for (const row of rows) {
      const msg = mapMessage(row, folderForRow(row));
      if (!msg.name || found.has(msg.name)) continue;
      if (found.size >= MAX_CONVERSATION_MESSAGES) break;
      found.set(msg.name, msg);
      next.push(msg.name);
    }
    frontier = next;
  }

  return [...found.values()].sort((a, b) => {
    if (a.date === b.date) return a.name.localeCompare(b.name);
    return a.date < b.date ? -1 : 1;
  });
}

/**
 * De handtekening van het standaard uitgaande Email Account, als HTML.
 *
 * `Email Account` is geen breed leesbaar DocType: een gewone medewerker
 * krijgt hier een 403. Dat mag de compose-view niet breken — een mail zonder
 * handtekening is prima, een compose-scherm dat niet opent niet. Elke fout
 * (403, ontbrekend doctype, netwerk) levert daarom een lege string op.
 */
export async function getSignature(mailbox?: string): Promise<string> {
  try {
    // 1. De postbus waaruit de gebruiker verstuurt (expliciet gekozen of de
    //    eigen), zodat iedereen zijn éigen ondertekening krijgt in plaats van
    //    die van het gedeelde standaard-uitgaande account.
    const own = toStr(mailbox).trim() || (await ownMailboxName());
    if (own) {
      const mine = await fetchList<{ signature?: string }>("Email Account", {
        fields: ["name", "signature"],
        filters: [["name", "=", own]],
        limit_page_length: 1,
      });
      const sig = toStr(mine[0]?.signature);
      if (sig) return sig;
    }
    // 2. Terugval: het standaard uitgaande account.
    const rows = await fetchList<{ signature?: string }>("Email Account", {
      fields: ["name", "signature"],
      filters: [["default_outgoing", "=", 1]],
      limit_page_length: 1,
    });
    return toStr(rows[0]?.signature);
  } catch {
    return "";
  }
}

/** Docname van de eigen postbus, of "" als die er niet is. */
async function ownMailboxName(): Promise<string> {
  const boxes = await listMailboxes();
  return boxes.find((b) => b.own)?.name ?? "";
}

/**
 * Aflever-status per verzonden Communication, uit de `Email Queue`.
 *
 * ERPNext verstuurt asynchroon: `communication.email.make` maakt de
 * Communication meteen, maar de daadwerkelijke aflevering doet de scheduler
 * daarna. Deze lookup laat de UI het verschil tonen tussen "in de wachtrij",
 * "verzonden" en "mislukt".
 *
 * `Email Queue` is net als `Email Account` niet standaard leesbaar voor
 * iedereen; bij een 403 (of welke fout dan ook) komt er een leeg object
 * terug en toont de UI simpelweg geen statuschip. De koppeling loopt via het
 * `communication`-veld, met `reference_name` als terugval voor rijen die de
 * queue zonder Communication-link heeft aangemaakt.
 */
export async function getQueueStatusFor(
  communicationNames: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set((communicationNames ?? []).filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const rows = await fetchList<{
      communication?: string;
      reference_name?: string;
      status?: string;
    }>("Email Queue", {
      fields: ["name", "communication", "reference_name", "status"],
      filters: [["communication", "in", unique]],
      order_by: "creation desc",
      limit_page_length: unique.length * 2,
    });
    const wanted = new Set(unique);
    const out: Record<string, string> = {};
    for (const row of rows) {
      const key = row?.communication || row?.reference_name || "";
      const status = toStr(row?.status);
      // Nieuwste eerst: de eerste rij per Communication is de actuele status.
      if (!key || !wanted.has(key) || !status || out[key]) continue;
      out[key] = status;
    }
    return out;
  } catch {
    return {};
  }
}

/** Koppel een mail aan een ERPNext-document (de projectchip in de UI). */
export async function linkToDocument(name: string, doctype: string, docname: string): Promise<void> {
  await updateDocument("Communication", name, {
    reference_doctype: doctype,
    reference_name: docname,
  });
}

/**
 * Versturen via ERPNext' eigen `communication.email.make`: dat maakt de
 * Communication, hangt de bijlagen eraan en zet de mail in de Email Queue,
 * die door de ERPNext-scheduler via het geconfigureerde outgoing Email
 * Account wordt afgeleverd.
 *
 * Bijlagen moeten eerst als (privé) File bestaan; `make` accepteert alleen
 * File-docnames, geen binaire payload. Ze worden aan het referentiedocument
 * gehangen wanneer dat er is, zodat ze ook zonder de mail vindbaar blijven.
 *
 * `in_reply_to` kent `make` niet als argument (onbekende kwargs worden
 * genegeerd), dus de threading-link wordt na afloop op het nieuwe document
 * gezet. Dat is wat de client-side conversatieweergave volgt.
 */
export async function sendMail(input: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  attachments?: File[];
  inReplyTo?: string;
  reference?: { doctype: string; name: string };
}): Promise<{ name: string }> {
  const refDoctype = input.reference?.doctype ?? "";
  const refName = input.reference?.name ?? "";

  const fileNames: string[] = [];
  for (const file of input.attachments ?? []) {
    const uploaded = await uploadFile(file, refDoctype, refName, true);
    if (uploaded?.name) fileNames.push(uploaded.name);
  }

  const result = (await callMethod("frappe.core.doctype.communication.email.make", {
    doctype: refDoctype,
    name: refName,
    subject: input.subject,
    content: input.html,
    recipients: input.to,
    cc: input.cc || "",
    bcc: input.bcc || "",
    send_email: 1,
    communication_medium: "Email",
    sent_or_received: "Sent",
    attachments: fileNames,
  })) as { name?: string } | null;

  const name = toStr(result?.name);

  // `callMethod` raakt de 30s-responscache van erpnext.ts niet (alleen
  // create/update/deleteDocument doen dat), dus zonder deze regel blijft de
  // Verzonden-map tot 30 s de lijst van vóór het versturen tonen. Expliciet
  // hier, niet leunen op de in_reply_to-update hieronder: die loopt alleen
  // op het reply-pad en kan bovendien falen.
  invalidateCache("Communication");

  if (name && input.inReplyTo) {
    try {
      await updateDocument("Communication", name, { in_reply_to: input.inReplyTo });
    } catch {
      // De mail is verstuurd; alleen de threading-link ontbreekt dan. Dat
      // mag geen verzendfout worden richting de gebruiker.
    }
  }
  return { name };
}

/** Badge-teller: ongelezen ontvangen e-mail. */
export async function unseenCount(): Promise<number> {
  return fetchCount("Communication", filtersForFolder(MAIL_FOLDER_UNREAD));
}

/**
 * Of ERPNext überhaupt mail binnenhaalt. Zolang geen Email Account
 * `enable_incoming=1` heeft, blijft Communication leeg en toont de UI een
 * instructiekaart in plaats van een lege lijst zonder uitleg.
 *
 * `Email Account` is in Frappe standaard geen breed leesbaar DocType — een
 * gewone medewerker (geen System Manager) krijgt op deze call een 403. Voor
 * hén is `false` NIET de veilige uitkomst: "kan niet vaststellen" is iets
 * anders dan "niet geconfigureerd", en de kaart zou anders permanent blijven
 * hangen terwijl mail prima werkt. Bij 403 geven we daarom `true` terug (de
 * kaart is toch vooral een beheerdershint). Een echte 404 (doctype ontbreekt
 * op deze instance) komt via `fetchList`'s missing-doctype-cache al als lege
 * array terug, dus die blijft via `rows.length > 0` netjes `false`. Alle
 * overige fouten (netwerk, 5xx) vallen terug op `false` — dezelfde
 * conservatieve keuze als voorheen.
 */
export async function hasEnabledEmailAccount(): Promise<boolean> {
  try {
    const rows = await fetchList<{ name: string }>("Email Account", {
      fields: ["name"],
      filters: [["enable_incoming", "=", 1]],
      limit_page_length: 1,
    });
    return rows.length > 0;
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) return true;
    return false;
  }
}
