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
import {
  buildConnectionQueries,
  isConnectionFolder,
  loadConnectionIndex,
  messageMatchesSelection,
  parseConnectionFolder,
} from "./mail-connections.ts";

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
  /**
   * `status === "Closed"` — door de gebruiker afgevinkt als afgehandeld.
   * Zie de toelichting bij `COMM_STATUS_CLOSED`.
   */
  handled: boolean;
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
  /**
   * Totaalaantal berichten in deze map. Alleen gevuld waar "ongelezen" niets
   * zegt — de map "Afgehandeld" bestaat juist uit gelezen mail, dus daar is
   * het totaal de enige zinvolle telling.
   */
  total?: number;
  kind: "inbox" | "sent" | "unread" | "handled" | "trash" | "project" | "custom";
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
/** Virtuele map "Afgehandeld": alles met `status = "Closed"`. */
export const MAIL_FOLDER_HANDLED = "handled";
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

/** Hoeveel custom (tag-)mappen maximaal in de mappenlijst verschijnen. */
const MAX_CUSTOM_FOLDERS = 50;
/** Standaard paginagrootte van de berichtenlijst. */
const DEFAULT_PAGE_SIZE = 50;
/** Harde bovengrens van een conversatie-closure (zie `getConversation`). */
const MAX_CONVERSATION_MESSAGES = 25;
/** Standaard aantal treffers van een zoekactie. */
const DEFAULT_SEARCH_LIMIT = 50;

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

/* ─── Afgehandeld: Frappe's eigen `Communication.status` ─── */

/**
 * `status` is een **ander** veld dan `email_status`: een Select met
 * `Open` / `Replied` / `Closed` / `Linked`. ERPNext vult en verandert dat veld
 * zelf — binnenkomende mail komt binnen als `Open`, een mail die aan een
 * document gekoppeld wordt schuift naar `Linked`, en een beantwoorde thread
 * kan `Replied` worden (live nagemeten op de doelinstance: alle 38
 * Communications droegen een gevulde `status`, verdeeld over `Open` en
 * `Linked`).
 *
 * Daarom is "afgehandeld" hier **precies één waarde** (`Closed`) en is
 * "niet afgehandeld" *alles behalve* `Closed` — niet "gelijk aan Open". Anders
 * zou het afvinken vechten met ERPNext' eigen gebruik van het veld en zou een
 * gekoppelde (`Linked`) mail uit de niet-afgehandeld-lijst vallen zonder dat
 * iemand hem afvinkte.
 *
 * Heropenen zet bewust `Open` terug en niet de vorige waarde: die is na de
 * schrijfactie niet meer bekend, en ERPNext herstelt `Linked` zelf zodra er
 * weer een koppeling wordt gelegd.
 */
const COMM_STATUS_CLOSED = "Closed";
const COMM_STATUS_OPEN = "Open";

/** Is deze `Communication.status`-waarde "afgehandeld"? */
export function isHandledStatus(value: unknown): boolean {
  return toStr(value) === COMM_STATUS_CLOSED;
}

/**
 * Client-side tegenhanger van `NOT_HANDLED`, voor het lijstfilter in de UI.
 * Bewust dezelfde regel ("alles behalve afgehandeld") zodat het filter in de
 * lijstkop en de serverquery van de map "Afgehandeld" niet uiteen kunnen
 * lopen.
 */
export function filterUnhandled<T extends { handled: boolean }>(rows: T[]): T[] {
  return rows.filter((row) => !row.handled);
}

const LIST_FIELDS = [
  "name",
  "subject",
  "status",
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

/**
 * Project van een map-id, of `null`. Kent twee vormen: de connectie-selectie
 * (`conn:project:Project:PROJ-0001`) die de connectiekolom gebruikt, en de
 * oudere `project:`-map-id — die staat nog in localStorage van iedereen die
 * de vorige versie open had en mag daar niet stilletjes op Postvak IN
 * uitkomen.
 */
export function projectOfFolder(folderId: string): string | null {
  if (folderId.startsWith(MAIL_PROJECT_FOLDER_PREFIX)) {
    return folderId.slice(MAIL_PROJECT_FOLDER_PREFIX.length) || null;
  }
  const sel = parseConnectionFolder(folderId);
  if (sel && sel.category === "project" && sel.docname) return sel.docname;
  return null;
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
  if (folderId === MAIL_FOLDER_HANDLED) {
    // Net als de Prullenbak bewust géén `sent_or_received`-beperking: je vinkt
    // ook je eigen verzonden mail af als een zaak klaar is.
    return [...base, ["status", "=", COMM_STATUS_CLOSED]];
  }
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
    handled: isHandledStatus(row.status),
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
  opts?: { limit?: number; start?: number; search?: string }
): Promise<ErpMailMessage[]> {
  if (isConnectionFolder(folderId)) {
    const page = await connectionSlice(
      folderId, opts?.search?.trim() ?? "", opts?.start ?? 0, opts?.limit ?? DEFAULT_PAGE_SIZE,
    );
    return page.messages;
  }
  const search = opts?.search?.trim();
  // "Afgehandeld" is een dwarsdoorsnede, geen richting: de map bevat zowel
  // ontvangen als verzonden mail. Elke rij krijgt daarom de map die bij zijn
  // eigen richting hoort, zodat de lijst afzender/geadresseerde net zo toont
  // als in Postvak IN en Verzonden.
  const crossCut = folderId === MAIL_FOLDER_HANDLED;
  const params: {
    fields: string[];
    filters: unknown[][];
    or_filters?: unknown[][];
    order_by: string;
    limit_page_length: number;
    limit_start: number;
  } = {
    fields: crossCut ? SEARCH_FIELDS : LIST_FIELDS,
    filters: filtersForFolder(folderId),
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
  return rows.map((row) => mapMessage(row, crossCut ? folderForRow(row) : folderId));
}

/**
 * Zelfde lijst als `listMailboxMessages`, maar met de paginatie-vraag die de
 * UI stelt: valt er nóg een pagina te halen? Zie `ErpMailPage.hasMore` voor
 * waarom dat op de paginagrootte wordt afgeleid en niet op een teller.
 */
export async function listMailboxMessagesPaged(
  folderId: string,
  opts: { start: number; limit: number; search?: string }
): Promise<ErpMailPage> {
  if (isConnectionFolder(folderId)) {
    return connectionSlice(folderId, opts.search?.trim() ?? "", opts.start, opts.limit);
  }
  const limit = opts.limit;
  const messages = await listMailboxMessages(folderId, {
    limit,
    start: opts.start,
    search: opts.search,
  });
  return { messages, hasMore: messages.length === limit };
}

/* ─── Connecties: filteren op waar de mail aan hangt ─── */

/**
 * Hoeveel rijen per tak worden opgehaald ten opzichte van het gevraagde
 * venster. De serverqueries leveren bewust een superset (zie
 * `mail-connections.ts`); het nafilter snijdt daar weer uit, dus zonder marge
 * zou een volle pagina half gevuld terugkomen.
 */
const CONNECTION_OVERFETCH = 2;
/** Harde bovengrens op die marge — één klik mag nooit de halve mailbox halen. */
const CONNECTION_MAX_FETCH = 200;

/**
 * Berichten van een connectie-selectie: de vereniging van de takken uit
 * `buildConnectionQueries`, ontdubbeld, nagefilterd op de momentopname en
 * chronologisch gesneden.
 *
 * **Waarom de vereniging client-side wordt gemaakt en niet met `or_filters`.**
 * `or_filters` is al bezet door de zoekterm — zoeken binnen een connectie zou
 * de connectiefilter anders overschrijven. Twee AND-only queries parallel is
 * bovendien voorspelbaarder dan één query waarin de OR-tak over een
 * child-join loopt.
 */
async function connectionSlice(
  folderId: string,
  term: string,
  start: number,
  limit: number,
): Promise<ErpMailPage> {
  const sel = parseConnectionFolder(folderId);
  // Bewust géén terugval op Postvak IN: een onbekende connectie-map is een
  // lege selectie, en "hier staat niets" is eerlijker dan stilletjes iets
  // anders tonen.
  if (!sel) return { messages: [], hasMore: false };

  const index = await loadConnectionIndex().catch(() => null);
  const specs = buildConnectionQueries(sel, index);
  if (specs.length === 0) return { messages: [], hasMore: false };

  const window = start + limit;
  const fetchLimit = Math.min(window * CONNECTION_OVERFETCH, CONNECTION_MAX_FETCH);
  const orFilters = term
    ? [["subject", "like", `%${term}%`], ["sender", "like", `%${term}%`]]
    : undefined;

  const pages = await Promise.all(specs.map(async (spec) => {
    const params: {
      fields: string[];
      filters: unknown[][];
      or_filters?: unknown[][];
      order_by: string;
      limit_page_length: number;
      group_by?: string;
    } = {
      fields: SEARCH_FIELDS,
      filters: [
        ["communication_type", "=", "Communication"],
        NOT_TRASHED,
        ...spec.filters,
      ],
      order_by: "communication_date desc",
      limit_page_length: fetchLimit,
    };
    if (orFilters) params.or_filters = orFilters;
    if (spec.groupBy) params.group_by = spec.groupBy;
    // Eén tak mag de andere niet meeslepen: een doctype dat op deze instance
    // niet bestaat (geen CRM-app, dus geen Lead) hoort een lege tak te geven.
    return fetchList<Record<string, unknown>>("Communication", params).catch(() => []);
  }));

  const seenNames = new Set<string>();
  const merged: ErpMailMessage[] = [];
  let anyFull = false;
  for (const rows of pages) {
    if (rows.length >= fetchLimit) anyFull = true;
    for (const row of rows) {
      const name = toStr(row.name);
      if (!name || seenNames.has(name)) continue;
      seenNames.add(name);
      if (!messageMatchesSelection(index, name, sel)) continue;
      // De richting van de rij, niet de connectie-map: een connectie bevat
      // zowel ontvangen als verzonden mail, en de UI leidt uit `folder` af of
      // een rij een afzender- of een geadresseerde-regel krijgt.
      merged.push(mapMessage(row, folderForRow(row)));
    }
  }
  merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    messages: merged.slice(start, window),
    hasMore: merged.length > window || anyFull,
  };
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
 * De vaste mappen plus de eigen (tag-)mappen.
 *
 * Projectmappen staan hier bewust **niet** meer bij: een project is geen map
 * maar een *connectie*, en de connectiekolom leidt die — samen met klanten,
 * inkoopfacturen, offertes en leads — af uit ERPNext' eigen koppelingen (zie
 * `mail-connections.ts`). Eén project als map en een klant niet, terwijl beide
 * gewoon een gekoppeld document zijn, was de inconsistentie die dat model
 * verving.
 *
 * "Ongelezen" is een view op Postvak IN en deelt daarom zijn teller; de
 * Prullenbak telt zijn eigen ongelezen berichten.
 */
export async function listVirtualFolders(): Promise<ErpMailFolder[]> {
  const [unseen, handledTotal, trashUnseen, customFolders] = await Promise.all([
    unseenCount().catch(() => 0),
    // "Afgehandeld" bestaat per definitie uit gelezen mail: een ongelezen-
    // teller zou daar altijd 0 zijn en dus niets zeggen. Het totaal is wat de
    // gebruiker wil zien ("wat heb ik afgevinkt").
    handledCount().catch(() => 0),
    fetchCount("Communication", [
      ...filtersForFolder(MAIL_FOLDER_TRASH),
      ["seen", "=", 0],
    ]).catch(() => 0),
    listCustomFolders().catch(() => [] as ErpMailFolder[]),
  ]);
  return [
    { id: MAIL_FOLDER_INBOX, label: "Postvak IN", unseen, kind: "inbox" },
    { id: MAIL_FOLDER_SENT, label: "Verzonden", unseen: 0, kind: "sent" },
    { id: MAIL_FOLDER_UNREAD, label: "Ongelezen", unseen, kind: "unread" },
    {
      id: MAIL_FOLDER_HANDLED, label: "Afgehandeld", unseen: 0,
      total: handledTotal, kind: "handled",
    },
    { id: MAIL_FOLDER_TRASH, label: "Prullenbak", unseen: trashUnseen, kind: "trash" },
    ...customFolders,
  ];
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
 * Vink een bericht af als afgehandeld (`status = "Closed"`).
 *
 * Bewust hetzelfde soort documentupdate als `moveToTrash`: geen eigen veld,
 * geen tag, geen extra doctype — het veld dat ERPNext hiervoor al heeft.
 */
export async function markHandled(name: string): Promise<void> {
  await updateDocument("Communication", name, { status: COMM_STATUS_CLOSED });
}

/** Heropen een afgehandeld bericht (`status` terug naar `Open`). */
export async function markUnhandled(name: string): Promise<void> {
  await updateDocument("Communication", name, { status: COMM_STATUS_OPEN });
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
 * 3. **Deelfouten worden gerapporteerd, niet ingeslikt.** De namen die het
 *    niet haalden komen terug, met de eerste fout erbij. Zonder dat zag de
 *    gebruiker "5 verwijderd" terwijl er vier bleven staan — een actie die
 *    beweert te zijn gelukt maar niets deed, zonder enige foutmelding. Dat is
 *    precies de klasse "de knop doet niets".
 */
export interface BulkOutcome {
  /** Namen waarvoor de actie mislukte. Leeg = alles gelukt. */
  failed: string[];
  /** Eerste fout van de mislukte items — de tekst voor de melding. */
  error?: unknown;
}

async function bulkApply(
  names: string[],
  op: (name: string) => Promise<unknown>,
): Promise<BulkOutcome> {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length === 0) return { failed: [] };
  const results = await Promise.allSettled(unique.map((name) => op(name)));
  invalidateCache("Communication");
  const rejected = results.filter((r) => r.status === "rejected");
  if (rejected.length === results.length) {
    throw (rejected[0] as PromiseRejectedResult).reason;
  }
  const failed = unique.filter((_, i) => results[i].status === "rejected");
  return failed.length === 0
    ? { failed }
    : { failed, error: (rejected[0] as PromiseRejectedResult).reason };
}

export async function bulkMarkRead(names: string[]): Promise<BulkOutcome> {
  return bulkApply(names, (name) => updateDocument("Communication", name, { seen: 1 }));
}

export async function bulkMarkUnread(names: string[]): Promise<BulkOutcome> {
  return bulkApply(names, (name) => updateDocument("Communication", name, { seen: 0 }));
}

export async function bulkMoveToTrash(names: string[]): Promise<BulkOutcome> {
  return bulkApply(names, (name) =>
    updateDocument("Communication", name, { email_status: EMAIL_STATUS_TRASH })
  );
}

export async function bulkRestoreFromTrash(names: string[]): Promise<BulkOutcome> {
  return bulkApply(names, (name) =>
    updateDocument("Communication", name, { email_status: EMAIL_STATUS_OPEN })
  );
}

export async function bulkDeleteForever(names: string[]): Promise<BulkOutcome> {
  return bulkApply(names, (name) => deleteDocument("Communication", name));
}

export async function bulkMarkHandled(names: string[]): Promise<BulkOutcome> {
  return bulkApply(names, (name) =>
    updateDocument("Communication", name, { status: COMM_STATUS_CLOSED })
  );
}

export async function bulkMarkUnhandled(names: string[]): Promise<BulkOutcome> {
  return bulkApply(names, (name) =>
    updateDocument("Communication", name, { status: COMM_STATUS_OPEN })
  );
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

/* ─── Gesprekken in de lijst: de ontbrekende leden erbij halen ─── */

/**
 * Hoeveel zichtbare berichten er hooguit meegaan in de aanvullende query. De
 * lijst toont er standaard 50 per pagina; wie tien keer "Meer laden" klikt
 * krijgt niet ook een `IN`-clausule met vijfhonderd namen.
 */
const MAX_COMPANION_SEEDS = 120;

/**
 * De berichten die de zichtbare gesprekken compleet maken, maar zelf niet in
 * de huidige map staan — in de praktijk je eigen verzonden antwoorden, die
 * alleen in "Verzonden" staan en dus in Postvak IN ontbreken.
 *
 * **Twee begrensde queries, geen scan van de Verzonden-map.** Beide lopen over
 * een `IN`-lijst van namen die de lijst al kent:
 *
 * 1. `in_reply_to in [zichtbare namen]` — alles wat een antwoord is op iets in
 *    beeld (jouw verzonden reactie, maar ook een antwoord dat in een andere
 *    map beland is).
 * 2. `name in [ontbrekende ouders]` — de berichten waarnaar een zichtbare mail
 *    verwijst maar die zelf niet in de lijst staan (`missingParentNames`).
 *
 * Dat is dus **hooguit twee extra requests per lijst**, ongeacht hoeveel rijen
 * er staan — geen query per regel. Mislukt een tak (rechten, netwerk), dan
 * levert hij een lege lijst: een gesprek dat één lid mist is een kleiner
 * probleem dan een lijst die niet laadt.
 *
 * Getrashte berichten blijven eruit (`NOT_TRASHED`): een weggegooid antwoord
 * hoort niet als thread-lid terug te komen onder een mail in Postvak IN.
 */
export async function fetchThreadCompanions(
  messages: { name: string; inReplyTo?: string }[],
): Promise<ErpMailMessage[]> {
  const seeds = messages.slice(0, MAX_COMPANION_SEEDS);
  const names = seeds.map((m) => m.name).filter(Boolean);
  if (names.length === 0) return [];

  const known = new Set(names);
  const parents: string[] = [];
  for (const msg of seeds) {
    const parent = msg.inReplyTo;
    if (!parent || known.has(parent) || parents.includes(parent)) continue;
    parents.push(parent);
  }

  const query = (filters: unknown[][]) =>
    fetchList<Record<string, unknown>>("Communication", {
      fields: SEARCH_FIELDS,
      filters: [["communication_type", "=", "Communication"], NOT_TRASHED, ...filters],
      order_by: "communication_date desc",
      limit_page_length: MAX_COMPANION_SEEDS,
    }).catch(() => [] as Record<string, unknown>[]);

  const [replies, ancestors] = await Promise.all([
    query([["in_reply_to", "in", names]]),
    parents.length > 0 ? query([["name", "in", parents]]) : Promise.resolve([]),
  ]);

  const out: ErpMailMessage[] = [];
  const seen = new Set(known);
  for (const row of [...replies, ...ancestors]) {
    const name = toStr(row.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(mapMessage(row, folderForRow(row)));
  }
  return out;
}

/**
 * De handtekening van de ingelogde medewerker, als HTML.
 *
 * Twee bronnen, in deze volgorde:
 *
 * 1. **`User.email_signature`** van de eigen gebruiker. Dat is de persoonlijke
 *    handtekening — naam, functie, eigen nummer — en dus wat er onder een mail
 *    hoort te staan. `scripts/generate-signatures.mjs` vult dit veld voor
 *    iedere medewerker uniform. Frappe staat elke gebruiker zijn eigen
 *    User-doc toe te lezen, dus dit pad werkt zonder extra rechten.
 * 2. **`Email Account.signature`** van het standaard uitgaande account, als
 *    terugval voor gebruikers die (nog) geen eigen handtekening hebben.
 *
 * `Email Account` is geen breed leesbaar DocType: een gewone medewerker
 * krijgt daar een 403. Dat mag de compose-view niet breken — een mail zonder
 * handtekening is prima, een compose-scherm dat niet opent niet. Elke fout
 * (403, ontbrekend doctype, netwerk) levert daarom een lege string op, op
 * beide niveaus.
 *
 * Het resultaat wordt voor de duur van de sessie onthouden: de handtekening
 * verandert niet tussen twee compose-vensters door, en zonder cache zou elke
 * Webmail-mount opnieuw twee requests doen. `resetSignatureCache()` wist hem
 * (uitloggen, en het opruimpad in tests).
 */
let cachedSignature: string | null = null;

/** Vergeet de onthouden handtekening (uitloggen, en het opruimpad in tests). */
export function resetSignatureCache(): void {
  cachedSignature = null;
}

export async function getSignature(): Promise<string> {
  if (cachedSignature !== null) return cachedSignature;

  const user = await resolveSessionUser();
  if (user) {
    try {
      const doc = await fetchDocument<{ email_signature?: string }>("User", user);
      const own = toStr(doc?.email_signature);
      if (own.trim()) {
        cachedSignature = own;
        return own;
      }
    } catch {
      // Geen leesrecht of netwerkfout — val terug op het Email Account.
    }
  }

  try {
    const rows = await fetchList<{ signature?: string }>("Email Account", {
      fields: ["name", "signature"],
      filters: [["default_outgoing", "=", 1]],
      limit_page_length: 1,
    });
    cachedSignature = toStr(rows[0]?.signature);
    return cachedSignature;
  } catch {
    cachedSignature = "";
    return "";
  }
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

/** Teller van de map "Afgehandeld" — het totaal, niet het ongelezen deel. */
export async function handledCount(): Promise<number> {
  return fetchCount("Communication", filtersForFolder(MAIL_FOLDER_HANDLED));
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
