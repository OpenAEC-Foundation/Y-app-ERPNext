/**
 * Concepten die op de server staan in plaats van in deze browser.
 *
 * Waarom: een concept in `localStorage` bestaat alleen op de computer waar je
 * het typte. Een concept op de server kun je op een andere machine afmaken —
 * en het kan er ook door iets anders dan de browser neergezet worden, zoals
 * een assistent die een mail voorbereidt die jij daarna zelf nakijkt en
 * verstuurt.
 *
 * ERPNext kent geen conceptmail. Een eigen doctype zou op elke instance
 * aangemaakt moeten worden; daarom staat een concept hier als Communication
 * van het soort "Automated Message" met `imap_folder` op een vaste markering.
 * Die combinatie valt buiten élke maplijst en zoekactie van de app (die
 * filteren op `communication_type = "Communication"`), dus een concept komt
 * nooit per ongeluk tussen de echte post. Het is ook geen schemawijziging:
 * beide velden bestaan overal.
 */
import { createDocument, deleteDocument, fetchList, updateDocument } from "./erpnext.ts";
import { normalizeSubject } from "./mail-threads.ts";

/** De markering in `imap_folder` waaraan een concept te herkennen is. */
export const CONCEPT_MARKERING = "Y-NEXT-CONCEPT";

const CONCEPT_FILTERS: unknown[][] = [
  ["communication_type", "=", "Automated Message"],
  ["imap_folder", "=", CONCEPT_MARKERING],
];

export interface ServerConcept {
  /** Documentnaam in ERPNext; hiermee is het concept te openen of te wissen. */
  name: string;
  aan: string;
  cc: string;
  bcc: string;
  onderwerp: string;
  /** De tekst van het bericht, als HTML. */
  inhoud: string;
  /** Het adres waarvandaan verstuurd wordt. */
  afzender: string;
  gewijzigd: string;
  /** De mail waarop dit een antwoord wordt; leeg bij een nieuw bericht. */
  inReplyTo: string;
  reference?: { doctype: string; name: string };
}

interface ConceptRij {
  name?: unknown;
  subject?: unknown;
  content?: unknown;
  recipients?: unknown;
  cc?: unknown;
  bcc?: unknown;
  sender?: unknown;
  modified?: unknown;
  in_reply_to?: unknown;
  reference_doctype?: unknown;
  reference_name?: unknown;
}

const tekst = (v: unknown) => String(v ?? "").trim();

/** Eén rij uit ERPNext als concept. */
export function naarConcept(rij: ConceptRij): ServerConcept {
  const doctype = tekst(rij.reference_doctype);
  const docnaam = tekst(rij.reference_name);
  return {
    name: tekst(rij.name),
    aan: tekst(rij.recipients),
    cc: tekst(rij.cc),
    bcc: tekst(rij.bcc),
    onderwerp: tekst(rij.subject),
    inhoud: String(rij.content ?? ""),
    afzender: tekst(rij.sender),
    gewijzigd: tekst(rij.modified),
    inReplyTo: tekst(rij.in_reply_to),
    ...(doctype && docnaam ? { reference: { doctype, name: docnaam } } : {}),
  };
}

/**
 * De concepten op de server, nieuwste eerst.
 *
 * `afzender` beperkt de lijst tot de concepten voor één postbus; zonder die
 * waarde komt alles terug. Mislukt de vraag, dan is de lijst leeg: een concept
 * dat niet opgehaald kan worden, mag de postbus niet blokkeren.
 */
export async function haalServerConcepten(afzender?: string, limiet = 50): Promise<ServerConcept[]> {
  const adres = (afzender || "").trim().toLowerCase();
  try {
    const rijen = await fetchList<ConceptRij>("Communication", {
      fields: ["name", "subject", "content", "recipients", "cc", "bcc", "sender", "modified",
        "in_reply_to", "reference_doctype", "reference_name"],
      filters: adres ? [...CONCEPT_FILTERS, ["sender", "=", adres]] : CONCEPT_FILTERS,
      order_by: "modified desc",
      limit_page_length: limiet,
    });
    return rijen.map(naarConcept);
  } catch {
    return [];
  }
}

/**
 * De concepten die bij dit gesprek horen.
 *
 * Twee manieren om dat te weten: het concept is een antwoord op een mail uit
 * het gesprek (`in_reply_to`), of het draagt hetzelfde onderwerp — zonder de
 * "Re:"- en "Fw:"-aanloop. Dat tweede vangt het concept dat elders is
 * klaargezet en (nog) niet aan één bericht hangt.
 */
export function conceptenVoorGesprek(
  concepten: ServerConcept[],
  namenInGesprek: Iterable<string>,
  onderwerp: string,
): ServerConcept[] {
  const namen = new Set([...namenInGesprek].filter(Boolean));
  const kern = normalizeSubject(onderwerp || "");
  return concepten.filter((c) => {
    if (c.inReplyTo && namen.has(c.inReplyTo)) return true;
    return !!kern && normalizeSubject(c.onderwerp || "") === kern;
  });
}

export interface ConceptInvoer {
  aan: string;
  cc?: string;
  bcc?: string;
  onderwerp: string;
  /** HTML; platte tekst mag ook, die komt dan zo in het opstelvenster. */
  inhoud: string;
  /** Het adres waarvandaan verstuurd wordt; bepaalt in wiens concepten hij staat. */
  afzender: string;
  /** De mail waarop dit een antwoord is; zet het concept in dat gesprek. */
  inReplyTo?: string;
  reference?: { doctype: string; name: string };
}

function velden(invoer: ConceptInvoer): Record<string, unknown> {
  return {
    communication_type: "Automated Message",
    ...(invoer.inReplyTo ? { in_reply_to: invoer.inReplyTo } : {}),
    communication_medium: "Email",
    imap_folder: CONCEPT_MARKERING,
    sent_or_received: "Sent",
    subject: invoer.onderwerp,
    content: invoer.inhoud,
    recipients: invoer.aan,
    cc: invoer.cc || "",
    bcc: invoer.bcc || "",
    sender: (invoer.afzender || "").trim().toLowerCase(),
    ...(invoer.reference
      ? { reference_doctype: invoer.reference.doctype, reference_name: invoer.reference.name }
      : {}),
  };
}

/** Zet een concept op de server; geeft de documentnaam terug. */
export async function maakServerConcept(invoer: ConceptInvoer): Promise<string> {
  const doc = await createDocument<{ name?: string }>("Communication", velden(invoer));
  return String(doc?.name ?? "");
}

export async function werkServerConceptBij(naam: string, invoer: ConceptInvoer): Promise<void> {
  await updateDocument("Communication", naam, velden(invoer));
}

/** Weg met het concept — na versturen of na weggooien. */
export async function verwijderServerConcept(naam: string): Promise<void> {
  await deleteDocument("Communication", naam);
}
