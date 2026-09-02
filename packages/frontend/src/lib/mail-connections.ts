/**
 * Mail-navigatie op **connecties** in plaats van mappen.
 *
 * Een Communication hoort niet in één map thuis; hij hangt aan documenten.
 * Hangt hij aan een inkoopfactuur, dan ís hij een inkoopfactuurmail. Hangt hij
 * óók aan een project, dan is hij dat er evengoed bij. Deze module leidt die
 * categorieën af uit ERPNext' eigen koppelingen en levert de bouwstenen om er
 * op te filteren.
 *
 * ── Waar de koppelingen vandaan komen ─────────────────────────────────────
 *
 * ERPNext kent er **twee**, en ze overlappen niet:
 *
 * 1. `Communication.reference_doctype` / `reference_name` — **enkelvoudig**.
 *    Dit is wat ERPNext zelf zet bij het versturen vanuit een document (op de
 *    doelinstance: 5 mails aan een Sales Invoice) en wat Y-next zet bij het
 *    boeken van een inkoopfactuur.
 * 2. De child-tabel **`Communication Link`** (veld `timeline_links`) —
 *    **meervoudig**. Hier zet ERPNext zelf de `Contact`-rijen neer die het bij
 *    binnenkomende mail op e-mailadres matcht, en hier zet Y-next zijn eigen
 *    koppelingen bij.
 *
 * Live geverifieerd op de doelinstance (37 Communications, 105 link-rijen):
 * de vijf Sales-Invoice-mails hebben **geen** `Communication Link`-rij, en de
 * 94 Contact-rijen hebben geen `reference_*`. Elke categorie is dus de
 * **vereniging** van beide bronnen; één ervan gebruiken laat structureel mail
 * liggen.
 *
 * ── Hoe je erop filtert (live uitgezocht) ─────────────────────────────────
 *
 * - Filteren op een child-veld kán rechtstreeks in een lijstquery op de
 *   parent: `filters=[["Communication Link","link_doctype","=","Project"]]`
 *   werkt op zowel `/api/resource/Communication` als `frappe.client.get_list`.
 * - **Maar de join ontdubbelt niet.** Een mail met vier Contact-rijen komt
 *   vier keer terug. `distinct=1` doet daar niets aan (geverifieerd: 94 rijen,
 *   36 unieke); alleen `group_by` op de parent-naam ontdubbelt. Vandaar
 *   {@link CONNECTION_GROUP_BY}.
 * - **`frappe.client.get_count` telt de join-rijen, niet de mails.** Dezelfde
 *   filter gaf 94 in plaats van 36. Tellingen komen daarom uit de momentopname
 *   hieronder en niet uit `fetchCount` — dat is bovendien één query in plaats
 *   van één per categorie.
 * - Twee filters op dezelfde child-tabel gelden voor **dezelfde** join-rij
 *   (geverifieerd: `link_doctype=Customer` + `link_name=<een contactnaam>`
 *   gaf nul). Zo is "deze klant, of een contactpersoon van deze klant" in één
 *   query te stellen.
 * - **Geen lange `name in [...]`-filters.** De doelinstance weigert een
 *   GET-URL rond de 4 kB (HTTP 400 vanaf ~200 namen). Het filterpad werkt
 *   daarom met doctype-filters op de server; de precieze afbakening gebeurt
 *   daarna op de momentopname.
 *
 * ── Superset + nafilter ───────────────────────────────────────────────────
 *
 * `buildConnectionQueries` geeft één of twee **AND-only** queries terug waarvan
 * de vereniging een *superset* van de selectie is. AND-only, omdat `or_filters`
 * al bezet is door de zoekterm — anders zou zoeken binnen een connectie de
 * connectiefilter overschrijven. De precieze afbakening (bv. "een Contact die
 * bij een klánt hoort, niet bij een leverancier") doet
 * {@link messageMatchesSelection} daarna op de momentopname.
 *
 * Deze module is **pure logica plus één loader**; alle beslisregels zijn zonder
 * netwerk te testen.
 */

import { fetchChildTable, fetchList } from "./erpnext.ts";

/* ─────────────────────────────── Categorieën ─────────────────────────── */

export type ConnectionCategoryId =
  | "project"
  | "customer"
  | "purchase-invoice"
  | "opportunity"
  | "lead"
  | "unlinked";

export interface ConnectionCategoryDef {
  id: ConnectionCategoryId;
  /**
   * Doctypes die deze categorie vórmen. Een koppeling aan één ervan — via
   * `reference_*` of via `Communication Link` — maakt de mail lid.
   */
  doctypes: string[];
  /**
   * Doctypes die alleen als *tussenstap* lid maken: een `Contact`-rij telt
   * mee als klantconnectie zodra die Contact aan een `Customer` hangt. De
   * omweg staat apart omdat hij in de serverquery een bredere superset
   * oplevert dan de uiteindelijke afbakening.
   */
  viaDoctypes?: string[];
  /** i18n-sleutel van de weergavenaam. */
  labelKey: string;
}

/**
 * Volgorde = weergavevolgorde in de zijkolom. "Niet gekoppeld" hoort achteraan:
 * het is de restcategorie, geen ingang.
 */
export const CONNECTION_CATEGORIES: ConnectionCategoryDef[] = [
  { id: "project", doctypes: ["Project"], labelKey: "y_next.conn_cat_project" },
  { id: "customer", doctypes: ["Customer"], viaDoctypes: ["Contact"], labelKey: "y_next.conn_cat_customer" },
  { id: "purchase-invoice", doctypes: ["Purchase Invoice"], labelKey: "y_next.conn_cat_purchase_invoice" },
  { id: "opportunity", doctypes: ["Opportunity", "Quotation"], labelKey: "y_next.conn_cat_opportunity" },
  { id: "lead", doctypes: ["Lead"], labelKey: "y_next.conn_cat_lead" },
  { id: "unlinked", doctypes: [], labelKey: "y_next.conn_cat_unlinked" },
];

const CATEGORY_BY_ID = new Map(CONNECTION_CATEGORIES.map((c) => [c.id, c]));

/** Doctype → categorie, voor de omgekeerde vraag ("waar hoort deze chip?"). */
const CATEGORY_OF_DOCTYPE = new Map<string, ConnectionCategoryId>();
for (const cat of CONNECTION_CATEGORIES) {
  for (const dt of cat.doctypes) CATEGORY_OF_DOCTYPE.set(dt, cat.id);
}

/** Categorie waar een gekoppeld doctype onder valt, of `null`. */
export function categoryOfDoctype(doctype: string): ConnectionCategoryId | null {
  return CATEGORY_OF_DOCTYPE.get(doctype) ?? null;
}

/* ───────────────────────────── Map-id's ──────────────────────────────── */

/** Prefix van elke connectie-"map": `conn:project` / `conn:project:PROJ-0001`. */
export const MAIL_CONNECTION_PREFIX = "conn:";

export interface ConnectionSelection {
  category: ConnectionCategoryId;
  /**
   * Docname van het concrete object. Leeg = de hele categorie ("alles wat aan
   * een project hangt").
   */
  docname?: string;
  /**
   * Doctype van het concrete object. Alleen nodig wanneer een categorie meer
   * dan één doctype omvat (Offertes: `Opportunity` én `Quotation`).
   */
  doctype?: string;
}

/**
 * Map-id van een selectie. Docnames mogen `:` bevatten (ERPNext staat het toe),
 * dus alles ná het derde segment hoort bij de naam — zie `parseConnectionFolder`.
 */
export function connectionFolderId(sel: ConnectionSelection): string {
  if (!sel.docname) return `${MAIL_CONNECTION_PREFIX}${sel.category}`;
  return `${MAIL_CONNECTION_PREFIX}${sel.category}:${sel.doctype ?? ""}:${sel.docname}`;
}

export function isConnectionFolder(id: string): boolean {
  return id.startsWith(MAIL_CONNECTION_PREFIX);
}

/** Selectie uit een map-id, of `null` als het geen connectie-map is. */
export function parseConnectionFolder(id: string): ConnectionSelection | null {
  if (!isConnectionFolder(id)) return null;
  const rest = id.slice(MAIL_CONNECTION_PREFIX.length);
  const firstSep = rest.indexOf(":");
  const category = (firstSep === -1 ? rest : rest.slice(0, firstSep)) as ConnectionCategoryId;
  if (!CATEGORY_BY_ID.has(category)) return null;
  if (firstSep === -1) return { category };
  const tail = rest.slice(firstSep + 1);
  const secondSep = tail.indexOf(":");
  if (secondSep === -1) return { category };
  const doctype = tail.slice(0, secondSep);
  const docname = tail.slice(secondSep + 1);
  if (!docname) return { category };
  return doctype ? { category, doctype, docname } : { category, docname };
}

/**
 * Wat een connectie-map-id voorstelt, klaar om als kop te tonen: de categorie
 * plus — bij een concreet object — zijn leesbare naam. Puur, zodat de kop van
 * de berichtenlijst die afleiding niet hoeft te herhalen. Zonder momentopname
 * blijft de docname over; dat is een bruikbare kop, geen lege.
 */
export function describeConnectionFolder(
  id: string,
  index?: ConnectionIndex | null,
): { category: ConnectionCategoryDef; objectLabel?: string } | null {
  const sel = parseConnectionFolder(id);
  if (!sel) return null;
  const category = CATEGORY_BY_ID.get(sel.category);
  if (!category) return null;
  if (!sel.docname) return { category };
  const known = index?.categories
    .flatMap((c) => c.objects)
    .find((o) => o.name === sel.docname && (!sel.doctype || o.doctype === sel.doctype));
  return { category, objectLabel: known?.label ?? sel.docname };
}

/* ───────────────────────────── Query-vorm ────────────────────────────── */

/**
 * Eén lijstquery. `orFilters` blijft bewust vrij voor de zoekterm; connecties
 * drukken zich uitsluitend in `filters` uit (zie de moduletoelichting).
 */
export interface MailQuerySpec {
  filters: unknown[][];
  groupBy?: string;
}

/**
 * `GROUP BY` die de child-join ontdubbelt. De backticks zijn Frappe's eigen
 * tabelnotatie; een kale `name` werkt op de doelinstance ook, maar is
 * dubbelzinnig zodra er een child-tabel met een `name`-kolom mee-joint.
 */
export const CONNECTION_GROUP_BY = "`tabCommunication`.name";

/**
 * Hoeveel namen hooguit in één `in`-filter gaan. De doelinstance weigert een
 * GET-URL van ~4 kB; ~150 korte namen is de gemeten bovengrens. 100 houdt
 * marge voor de overige queryparameters.
 */
const MAX_IN_VALUES = 100;

/**
 * Serverqueries waarvan de vereniging een superset van `sel` is. Eén tot twee
 * stuks: de child-tabel-tak en de `reference_*`-tak. De aanroeper voegt zijn
 * eigen basisfilters (communication_type, prullenbak) en zoekterm toe.
 *
 * Zonder `index` (momentopname nog niet geladen) valt de klant-tak terug op de
 * bredere `Contact`-superset; het nafilter corrigeert dat zodra de momentopname
 * er is.
 */
export function buildConnectionQueries(
  sel: ConnectionSelection,
  index?: ConnectionIndex | null,
): MailQuerySpec[] {
  const cat = CATEGORY_BY_ID.get(sel.category);
  if (!cat) return [];

  if (sel.category === "unlinked") {
    // Een mail met een `reference_*` hangt per definitie aan iets; de rest van
    // de afbakening (heeft hij ook geen child-koppeling?) doet het nafilter,
    // want "child-tabel is leeg" is geen filter die Frappe kent.
    return [{ filters: [["reference_doctype", "is", "not set"]] }];
  }

  const memberDoctypes = [...cat.doctypes, ...(cat.viaDoctypes ?? [])];

  if (!sel.docname) {
    const refBranch: MailQuerySpec = { filters: [["reference_doctype", "in", cat.doctypes]] };
    const via = cat.viaDoctypes ? viaNamesOfCategory(cat, index) : null;
    if (via && via.length <= MAX_IN_VALUES) {
      // Precies: alleen de tussenstappen die écht in deze categorie uitkomen.
      // Zonder deze splitsing zou "Klanten" élke mail met een Contact-rij
      // opleveren — op de doelinstance 32 van de 32, waarvan er 9 overblijven.
      // Dat is niet fout (het nafilter corrigeert), maar het maakt van een
      // pagina van 50 een pagina van 12.
      return [
        { filters: [["Communication Link", "link_doctype", "in", cat.doctypes]], groupBy: CONNECTION_GROUP_BY },
        {
          filters: [
            ["Communication Link", "link_doctype", "in", cat.viaDoctypes as string[]],
            ["Communication Link", "link_name", "in", via],
          ],
          groupBy: CONNECTION_GROUP_BY,
        },
        refBranch,
      ];
    }
    // Geen momentopname, of te veel tussenstappen voor één `in`-filter (de
    // GET-URL heeft een harde grens): dan de brede superset en het nafilter.
    return [
      { filters: [["Communication Link", "link_doctype", "in", memberDoctypes]], groupBy: CONNECTION_GROUP_BY },
      refBranch,
    ];
  }

  // Concreet object: ook de namen van de tussenstappen mee (de Contacts van
  // déze klant), zodat automatisch gekoppelde mail meetelt.
  const names = [sel.docname, ...viaNamesFor(sel, index)].slice(0, MAX_IN_VALUES);
  const refDoctypes = sel.doctype ? [sel.doctype] : cat.doctypes;
  return [
    {
      filters: [
        ["Communication Link", "link_doctype", "in", memberDoctypes],
        ["Communication Link", "link_name", "in", names],
      ],
      groupBy: CONNECTION_GROUP_BY,
    },
    { filters: [["reference_doctype", "in", refDoctypes], ["reference_name", "=", sel.docname]] },
  ];
}

/** Contact-docnames die bij dit object horen (alleen zinvol voor klanten). */
function viaNamesFor(sel: ConnectionSelection, index?: ConnectionIndex | null): string[] {
  if (!index || sel.category !== "customer" || !sel.docname) return [];
  return index.contactsByCustomer.get(sel.docname) ?? [];
}

/**
 * Álle tussenstap-docnames van een categorie: de Contacts die aan een Customer
 * hangen. `null` wanneer de momentopname er nog niet is — dan valt de query
 * terug op de brede superset.
 */
function viaNamesOfCategory(
  cat: ConnectionCategoryDef,
  index?: ConnectionIndex | null,
): string[] | null {
  if (!index || cat.id !== "customer") return null;
  const out: string[] = [];
  for (const names of index.contactsByCustomer.values()) {
    for (const name of names) out.push(name);
  }
  return out;
}

/* ─────────────────────────── Momentopname ────────────────────────────── */

/** Eén rij uit `Communication Link`. */
export interface ConnectionLinkRow {
  parent: string;
  link_doctype: string;
  link_name: string;
}

/** Eén Communication zoals de momentopname hem kent. */
export interface ConnectionMessageRow {
  name: string;
  reference_doctype?: string;
  reference_name?: string;
  seen?: unknown;
}

/** Eén `Dynamic Link`-rij op een Contact: welke relatie hoort erbij. */
export interface ContactPartyRow {
  parent: string;
  link_doctype: string;
  link_name: string;
}

export interface ConnectionRawInput {
  links: ConnectionLinkRow[];
  messages: ConnectionMessageRow[];
  contactParties: ContactPartyRow[];
  /** `"<Doctype>::<docname>"` → weergavenaam. Ontbrekende sleutels vallen terug op de docname. */
  labels?: Record<string, string>;
}

/** Eén connectie van één mail, klaar om als chip getoond te worden. */
export interface MailConnection {
  doctype: string;
  name: string;
  label: string;
  category: ConnectionCategoryId;
}

/** Eén concreet object binnen een categorie (een project, een klant, …). */
export interface ConnectionObject {
  category: ConnectionCategoryId;
  doctype: string;
  name: string;
  label: string;
  total: number;
  unseen: number;
}

export interface ConnectionCategoryStats {
  id: ConnectionCategoryId;
  total: number;
  unseen: number;
  objects: ConnectionObject[];
}

export interface ConnectionIndex {
  /** Communication-docname → zijn connecties (ontdubbeld, categorie-volgorde). */
  byMessage: Map<string, MailConnection[]>;
  categories: ConnectionCategoryStats[];
  /** Mails die aan minstens één categorie hangen. */
  connected: Set<string>;
  /** Contact-docname → de relatie waar hij aan hangt. */
  contactParty: Map<string, { doctype: string; name: string }>;
  /** Customer-docname → zijn Contact-docnames (voedt de serverquery). */
  contactsByCustomer: Map<string, string[]>;
  /** Alle niet-getrashte Communication-namen die de momentopname zag. */
  known: Set<string>;
}

function labelKey(doctype: string, name: string): string {
  return `${doctype}::${name}`;
}

function seenOf(row: ConnectionMessageRow): boolean {
  return row.seen === 1 || row.seen === true || row.seen === "1";
}

/**
 * Bouwt de index. Puur: geen netwerk, geen tijd, geen globale staat — de hele
 * categorie-afleiding is hiermee met vaste invoer te toetsen.
 */
export function buildConnectionIndex(raw: ConnectionRawInput): ConnectionIndex {
  const labels = raw.labels ?? {};
  const known = new Set<string>();
  const unseenOf = new Map<string, boolean>();
  for (const row of raw.messages) {
    if (!row?.name) continue;
    known.add(row.name);
    unseenOf.set(row.name, !seenOf(row));
  }

  const contactParty = new Map<string, { doctype: string; name: string }>();
  const contactsByCustomer = new Map<string, string[]>();
  for (const row of raw.contactParties) {
    if (!row?.parent || !row.link_doctype || !row.link_name) continue;
    // Eerste rij wint: een Contact aan twee relaties is zeldzaam en er valt
    // geen betere keuze uit de data af te leiden.
    if (!contactParty.has(row.parent)) {
      contactParty.set(row.parent, { doctype: row.link_doctype, name: row.link_name });
    }
    if (row.link_doctype === "Customer") {
      const list = contactsByCustomer.get(row.link_name);
      if (list) { if (!list.includes(row.parent)) list.push(row.parent); }
      else contactsByCustomer.set(row.link_name, [row.parent]);
    }
  }

  /** message → "Doctype::name" → connectie, ontdubbeld. */
  const perMessage = new Map<string, Map<string, MailConnection>>();
  const add = (message: string, doctype: string, name: string) => {
    if (!message || !doctype || !name) return;
    // Alleen mails die de momentopname kent: een getrashte mail hoort nergens
    // meer bij, en zijn link-rijen staan er wel gewoon nog.
    if (!known.has(message)) return;
    const category = categoryOfDoctype(doctype);
    if (!category) return;
    let bucket = perMessage.get(message);
    if (!bucket) { bucket = new Map(); perMessage.set(message, bucket); }
    const key = labelKey(doctype, name);
    if (bucket.has(key)) return;
    bucket.set(key, { doctype, name, label: labels[key] || name, category });
  };

  for (const row of raw.messages) {
    if (row?.reference_doctype && row.reference_name) {
      add(row.name, row.reference_doctype, row.reference_name);
    }
  }
  for (const row of raw.links) {
    if (!row?.parent || !row.link_doctype || !row.link_name) continue;
    if (row.link_doctype === "Contact") {
      // De omweg: een Contact telt mee als de relatie waaraan hij hangt. Een
      // Contact zonder relatie (of aan een leverancier) levert geen categorie.
      const party = contactParty.get(row.link_name);
      if (party) add(row.parent, party.doctype, party.name);
      continue;
    }
    add(row.parent, row.link_doctype, row.link_name);
  }

  const byMessage = new Map<string, MailConnection[]>();
  const order = new Map(CONNECTION_CATEGORIES.map((c, i) => [c.id, i]));
  for (const [message, bucket] of perMessage) {
    const list = [...bucket.values()].sort((a, b) => {
      const d = (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99);
      return d !== 0 ? d : a.label.localeCompare(b.label);
    });
    byMessage.set(message, list);
  }

  const objects = new Map<string, ConnectionObject>();
  const perCategory = new Map<ConnectionCategoryId, { total: Set<string>; unseen: Set<string> }>();
  for (const [message, list] of byMessage) {
    const unread = unseenOf.get(message) === true;
    for (const conn of list) {
      const key = labelKey(conn.doctype, conn.name);
      let obj = objects.get(key);
      if (!obj) {
        obj = {
          category: conn.category, doctype: conn.doctype, name: conn.name,
          label: conn.label, total: 0, unseen: 0,
        };
        objects.set(key, obj);
      }
      obj.total += 1;
      if (unread) obj.unseen += 1;
      let stats = perCategory.get(conn.category);
      if (!stats) { stats = { total: new Set(), unseen: new Set() }; perCategory.set(conn.category, stats); }
      stats.total.add(message);
      if (unread) stats.unseen.add(message);
    }
  }

  const connected = new Set(byMessage.keys());

  const categories: ConnectionCategoryStats[] = CONNECTION_CATEGORIES.map((cat) => {
    if (cat.id === "unlinked") {
      let total = 0;
      let unseen = 0;
      for (const name of known) {
        if (connected.has(name)) continue;
        total += 1;
        if (unseenOf.get(name) === true) unseen += 1;
      }
      return { id: cat.id, total, unseen, objects: [] };
    }
    const stats = perCategory.get(cat.id);
    const list = [...objects.values()]
      .filter((o) => o.category === cat.id)
      // Meeste mail eerst; bij gelijkspel alfabetisch, zodat de volgorde
      // stabiel is tussen twee ladingen.
      .sort((a, b) => (b.total - a.total) || a.label.localeCompare(b.label));
    return { id: cat.id, total: stats?.total.size ?? 0, unseen: stats?.unseen.size ?? 0, objects: list };
  });

  return { byMessage, categories, connected, contactParty, contactsByCustomer, known };
}

/**
 * Hoort deze mail bij de selectie? Dit is het nafilter op de serverqueries uit
 * `buildConnectionQueries`, die bewust een superset opleveren.
 *
 * Een mail die de momentopname **niet kent** (binnengekomen ná het laden)
 * wordt doorgelaten: een net gearriveerde mail onzichtbaar maken is erger dan
 * hem een ronde te ruim tonen.
 */
export function messageMatchesSelection(
  index: ConnectionIndex | null | undefined,
  name: string,
  sel: ConnectionSelection,
): boolean {
  if (!index) return true;
  if (!index.known.has(name)) return true;
  const list = index.byMessage.get(name) ?? [];
  if (sel.category === "unlinked") return list.length === 0;
  if (!sel.docname) return list.some((c) => c.category === sel.category);
  return list.some((c) =>
    c.name === sel.docname && (sel.doctype ? c.doctype === sel.doctype : c.category === sel.category));
}

/* ──────────────────────────── Laden + cache ──────────────────────────── */

/**
 * Bovengrenzen. De momentopname is één ronde van drie parallelle queries; die
 * mag groot zijn, maar niet ongelimiteerd — een mailbox die jaren doorgroeit
 * zou anders elke keer de hele historie ophalen.
 */
const MAX_MESSAGES = 4000;
const MAX_LINKS = 8000;
const MAX_CONTACT_LINKS = 4000;
/** Hoeveel objecten per doctype een leesbaar label krijgen. */
const MAX_LABELLED = 300;

const NOT_TRASHED: unknown[] = ["email_status", "!=", "Trash"];
const COMMUNICATION_BASE: unknown[][] = [["communication_type", "=", "Communication"], NOT_TRASHED];

/** Doctypes waarvan een docname niets zegt en er dus een naamveld bij hoort. */
const LABEL_FIELDS: Record<string, string> = {
  Project: "project_name",
  Customer: "customer_name",
  Lead: "lead_name",
  Opportunity: "party_name",
};

let cached: Promise<ConnectionIndex> | null = null;

/** Gooi de momentopname weg (na koppelen, taggen, verwijderen). */
export function invalidateConnectionIndex(): void {
  cached = null;
}

/**
 * De momentopname, per sessie gecached. Bewust **lui**: de mailpagina opent
 * zonder deze drie queries; ze lopen pas zodra de connectiekolom of een
 * connectiefilter ze nodig heeft.
 */
export function loadConnectionIndex(opts?: { force?: boolean }): Promise<ConnectionIndex> {
  if (opts?.force) cached = null;
  if (!cached) {
    cached = fetchConnectionIndex().catch((err) => {
      // Een mislukte ronde mag niet permanent in de cache blijven staan.
      cached = null;
      throw err;
    });
  }
  return cached;
}

/** De laatst geladen momentopname, of `null` — voor synchrone renderpaden. */
let lastIndex: ConnectionIndex | null = null;
export function peekConnectionIndex(): ConnectionIndex | null {
  return lastIndex;
}

async function fetchConnectionIndex(): Promise<ConnectionIndex> {
  const [messages, links, contactParties] = await Promise.all([
    fetchList<ConnectionMessageRow>("Communication", {
      fields: ["name", "reference_doctype", "reference_name", "seen"],
      filters: COMMUNICATION_BASE,
      order_by: "communication_date desc",
      limit_page_length: MAX_MESSAGES,
    }).catch(() => [] as ConnectionMessageRow[]),
    // `Communication Link` is een child-doctype: `/api/resource` geeft daar 403
    // op, ook mét een `parenttype`-filter. De `frappe.client.get_list`-RPC met
    // een expliciet `parent`-argument is de werkende weg — zie fetchChildTable.
    fetchChildTable<ConnectionLinkRow>(
      "Communication Link", "Communication",
      ["parent", "link_doctype", "link_name"],
      [["parenttype", "=", "Communication"]],
      MAX_LINKS,
    ).catch(() => [] as ConnectionLinkRow[]),
    fetchChildTable<ContactPartyRow>(
      "Dynamic Link", "Contact",
      ["parent", "link_doctype", "link_name"],
      [["parenttype", "=", "Contact"], ["link_doctype", "in", ["Customer", "Supplier"]]],
      MAX_CONTACT_LINKS,
    ).catch(() => [] as ContactPartyRow[]),
  ]);

  const raw: ConnectionRawInput = { messages, links, contactParties };
  // Eerste ronde zonder labels levert al de juiste indeling; de tweede ronde
  // haalt alleen de leesbare namen op van de objecten die er echt in zitten.
  const draft = buildConnectionIndex(raw);
  const labels = await fetchLabels(draft).catch(() => ({} as Record<string, string>));
  const index = Object.keys(labels).length > 0
    ? buildConnectionIndex({ ...raw, labels })
    : draft;
  lastIndex = index;
  return index;
}

/** Leesbare namen voor de objecten in de index, per doctype gebundeld. */
async function fetchLabels(index: ConnectionIndex): Promise<Record<string, string>> {
  const wanted = new Map<string, string[]>();
  for (const cat of index.categories) {
    for (const obj of cat.objects) {
      const field = LABEL_FIELDS[obj.doctype];
      if (!field) continue;
      const list = wanted.get(obj.doctype);
      if (list) { if (list.length < MAX_LABELLED) list.push(obj.name); }
      else wanted.set(obj.doctype, [obj.name]);
    }
  }
  if (wanted.size === 0) return {};

  const out: Record<string, string> = {};
  await Promise.all([...wanted].map(async ([doctype, names]) => {
    const field = LABEL_FIELDS[doctype];
    // In blokken, want een lange `name in [...]` maakt de GET-URL te groot.
    for (let i = 0; i < names.length; i += MAX_IN_VALUES) {
      const chunk = names.slice(i, i + MAX_IN_VALUES);
      try {
        const rows = await fetchList<Record<string, unknown>>(doctype, {
          fields: ["name", field],
          filters: [["name", "in", chunk]],
          limit_page_length: chunk.length,
        });
        for (const row of rows) {
          const name = typeof row.name === "string" ? row.name : "";
          const label = typeof row[field] === "string" ? (row[field] as string) : "";
          if (name && label && label !== name) out[labelKey(doctype, name)] = label;
        }
      } catch {
        // Geen leesrecht op dit doctype — de docname blijft het label.
      }
    }
  }));
  return out;
}
