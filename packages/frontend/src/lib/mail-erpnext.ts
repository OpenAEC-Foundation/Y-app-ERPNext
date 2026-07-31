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
 *    Ongelezen) of een projectkoppeling (`reference_doctype=Project`).
 *    Map-CRUD, verplaatsen en gedeelde postvakken bestaan dus niet in dit
 *    model — die UI hoort achter de IMAP-featuregate te blijven.
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
  fetchAttachments,
  fetchCount,
  fetchDocument,
  fetchList,
  invalidateCache,
  updateDocument,
  uploadFile,
  callMethod,
  type FileInfo,
} from "./erpnext.ts";

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
   * UI-laag mag op `kind` vertalen. Projectmappen dragen de projectnaam,
   * die per definitie niet vertaalbaar is.
   */
  label: string;
  unseen: number;
  kind: "inbox" | "sent" | "unread" | "project";
  /** Alleen bij `kind === "project"`: de Project-docname. */
  project?: string;
}

/* ─── Virtuele map-ids ─── */

export const MAIL_FOLDER_INBOX = "INBOX";
export const MAIL_FOLDER_SENT = "Sent";
export const MAIL_FOLDER_UNREAD = "unread";
export const MAIL_PROJECT_FOLDER_PREFIX = "project:";

/** Hoeveel projectmappen maximaal in de mappenlijst verschijnen. */
const MAX_PROJECT_FOLDERS = 50;
/** Hoeveel recente Communications de projectdiscovery scant. */
const PROJECT_DISCOVERY_WINDOW = 200;
/** Standaard paginagrootte van de berichtenlijst. */
const DEFAULT_PAGE_SIZE = 50;

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

/**
 * Filters van een virtuele map. Onbekende map-ids vallen bewust terug op
 * Postvak IN, zodat een stale map-id uit localStorage geen lege of foutieve
 * lijst oplevert.
 */
function filtersForFolder(folderId: string): unknown[][] {
  const base: unknown[][] = [["communication_type", "=", "Communication"]];
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
  return [...base, ["sent_or_received", "=", "Received"]];
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
  opts?: { limit?: number; start?: number; search?: string }
): Promise<ErpMailMessage[]> {
  const search = opts?.search?.trim();
  const params: {
    fields: string[];
    filters: unknown[][];
    or_filters?: unknown[][];
    order_by: string;
    limit_page_length: number;
    limit_start: number;
  } = {
    fields: LIST_FIELDS,
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
  return rows.map((row) => mapMessage(row, folderId));
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
 * De virtuele mappenlijst: de drie vaste mappen plus de projectmappen.
 * "Ongelezen" is een view op Postvak IN en deelt daarom zijn teller.
 */
export async function listVirtualFolders(): Promise<ErpMailFolder[]> {
  const [unseen, projectFolders] = await Promise.all([
    unseenCount().catch(() => 0),
    listProjectFolders().catch(() => [] as ErpMailFolder[]),
  ]);
  return [
    { id: MAIL_FOLDER_INBOX, label: "Postvak IN", unseen, kind: "inbox" },
    { id: MAIL_FOLDER_SENT, label: "Verzonden", unseen: 0, kind: "sent" },
    { id: MAIL_FOLDER_UNREAD, label: "Ongelezen", unseen, kind: "unread" },
    ...projectFolders,
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
 * instructiekaart in plaats van een lege lijst zonder uitleg. Faalt de call
 * (geen leesrecht op Email Account), dan is `false` de veilige uitkomst:
 * de instructiekaart is hinderlijker dan onterecht niets tonen, maar nooit
 * misleidend.
 */
export async function hasEnabledEmailAccount(): Promise<boolean> {
  try {
    const rows = await fetchList<{ name: string }>("Email Account", {
      fields: ["name"],
      filters: [["enable_incoming", "=", 1]],
      limit_page_length: 1,
    });
    return rows.length > 0;
  } catch {
    return false;
  }
}
