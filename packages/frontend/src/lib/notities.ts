/**
 * Notities die aan een project hangen.
 *
 * Een notitie is drie dingen tegelijk: een stuk tekst met foto's erin, een
 * project waar het over gaat, en een lijstje acties dat aan mensen hangt. Dit
 * bestand doet het rekenwerk daarvoor — omzetten van en naar wat ERPNext
 * bewaart, en de kleine regels die het scherm nodig heeft. Geen DOM, geen
 * netwerk; de pagina doet dat.
 *
 * **Waar het staat.** Er komt geen nieuw doctype aan te pas. `Y Meeting Note`
 * heeft alles wat nodig is (een Link naar Project, een Text Editor voor de
 * tekst, en een vrij tekstveld voor de acties) en stond leeg. Om notities en
 * vergaderverslagen uit elkaar te houden draagt een notitie een merkje in
 * `linked_doctype`; beide schermen filteren daarop. Zo blijft het onderscheid
 * in de gegevens staan en niet alleen in ons hoofd.
 *
 * **De acties** gaan als JSON in één veld. Dat is niet mooi, maar het is wat
 * er is, en het spaart een child-doctype uit. `leesActies` moet daarom tegen
 * alles kunnen wat er ooit in dat veld beland is: niets, rommel, of de vorm
 * die de vergadernotities gebruiken.
 */

export const NOTITIE_DOCTYPE = "Y Meeting Note";

/** Het merkje in `linked_doctype` waaraan je een projectnotitie herkent. */
export const NOTITIE_MERK = "Y Notitie";

export interface Actiepunt {
  id: string;
  tekst: string;
  /** E-mailadres van wie het doet; leeg betekent: nog niemand. */
  wie: string;
  /** "YYYY-MM-DD", of leeg. */
  datum: string;
  gedaan: boolean;
  /** Naam van de ToDo in ERPNext, zodra die er is. */
  todo?: string;
}

export interface Notitie {
  /** De docnaam; leeg zolang de notitie nog niet bestaat. */
  naam: string;
  titel: string;
  /** "YYYY-MM-DD". */
  datum: string;
  project: string;
  /** De tekst als HTML — inclusief `<img>` naar bestanden in ERPNext. */
  inhoud: string;
  acties: Actiepunt[];
  gewijzigd: string;
}

/** De rij zoals ERPNext hem teruggeeft. */
export interface NotitieDoc {
  name: string;
  title?: string | null;
  meeting_date?: string | null;
  project?: string | null;
  notes?: string | null;
  action_points?: string | null;
  linked_doctype?: string | null;
  linked_name?: string | null;
  modified?: string | null;
}

let teller = 0;

/** Een id dat binnen één notitie uniek is; hij verlaat de browser niet. */
export function nieuwId(): string {
  teller += 1;
  return `a${Date.now().toString(36)}${teller.toString(36)}`;
}

function alsTekst(waarde: unknown): string {
  return typeof waarde === "string" ? waarde : waarde == null ? "" : String(waarde);
}

/**
 * De acties uit het opgeslagen veld halen.
 *
 * Leeg, kapot of geen lijst → een lege lijst. Een rij zonder tekst valt af;
 * die levert alleen een lege regel op in beeld. De vorm van de
 * vergadernotities (`description` / `assignedTo` / `status` / `dueDate`) lezen
 * we ook, zodat een notitie die daar ooit begon niet stuk gaat.
 */
export function leesActies(ruw: unknown): Actiepunt[] {
  if (!ruw || typeof ruw !== "string") return [];
  let data: unknown;
  try {
    data = JSON.parse(ruw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const uit: Actiepunt[] = [];
  for (const rij of data) {
    if (!rij || typeof rij !== "object") continue;
    const r = rij as Record<string, unknown>;
    const tekst = alsTekst(r.tekst ?? r.description).trim();
    if (!tekst) continue;
    uit.push({
      id: alsTekst(r.id) || nieuwId(),
      tekst,
      wie: alsTekst(r.wie ?? r.assignedTo).trim(),
      datum: alsTekst(r.datum ?? r.dueDate).slice(0, 10),
      gedaan: r.gedaan === true || r.status === "done" || r.status === "Closed",
      todo: alsTekst(r.todo) || undefined,
    });
  }
  return uit;
}

/** De acties klaarmaken voor het tekstveld. */
export function schrijfActies(acties: Actiepunt[]): string {
  return JSON.stringify(
    acties
      .filter((a) => a.tekst.trim())
      .map((a) => ({
        id: a.id,
        tekst: a.tekst.trim(),
        wie: a.wie.trim(),
        datum: a.datum || "",
        gedaan: !!a.gedaan,
        ...(a.todo ? { todo: a.todo } : {}),
      })),
  );
}

export function naarNotitie(doc: NotitieDoc): Notitie {
  return {
    naam: doc.name,
    titel: alsTekst(doc.title),
    datum: alsTekst(doc.meeting_date).slice(0, 10),
    project: alsTekst(doc.project),
    inhoud: alsTekst(doc.notes),
    acties: leesActies(doc.action_points),
    gewijzigd: alsTekst(doc.modified),
  };
}

/**
 * Wat er naar ERPNext gaat.
 *
 * `linked_name` krijgt het project mee: zo staat het verband er ook in voor
 * wie de rij buiten Y-next bekijkt, waar `linked_doctype` alleen het merkje
 * draagt.
 */
export function naarDoc(n: Notitie): Record<string, unknown> {
  return {
    title: n.titel.trim() || "Notitie",
    meeting_date: n.datum || null,
    project: n.project || null,
    notes: n.inhoud,
    action_points: schrijfActies(n.acties),
    participants: "",
    linked_doctype: NOTITIE_MERK,
    linked_name: n.project || "",
  };
}

/** Hoeveel acties er nog openstaan. */
export function openstaand(acties: Actiepunt[]): number {
  return acties.filter((a) => !a.gedaan).length;
}

/**
 * De volgorde in de lijst: jongste datum bovenaan, en bij gelijke datum wat
 * het laatst bewerkt is. Een notitie zonder datum zakt naar onderen — die is
 * meestal net begonnen en nog niet ingevuld.
 */
export function vergelijkNotities(a: Notitie, b: Notitie): number {
  if (a.datum !== b.datum) return (b.datum || "").localeCompare(a.datum || "");
  return (b.gewijzigd || "").localeCompare(a.gewijzigd || "");
}

/** De platte tekst uit de HTML, voor het regeltje onder de titel. */
export function tekstUitHtml(html: string, maximaal = 120): string {
  const plat = String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h\d)>/gi, " ")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return plat.length > maximaal ? `${plat.slice(0, maximaal - 1).trimEnd()}…` : plat;
}

/** Notities die bij de zoekterm passen; een lege term laat alles staan. */
export function zoekNotities(lijst: Notitie[], term: string): Notitie[] {
  const t = term.trim().toLowerCase();
  if (!t) return lijst;
  return lijst.filter((n) => {
    const hooi = [n.titel, n.project, tekstUitHtml(n.inhoud, 4000), ...n.acties.map((a) => a.tekst)]
      .join(" ")
      .toLowerCase();
    return hooi.includes(t);
  });
}

/**
 * De omschrijving waarmee een actie als ToDo in ERPNext komt te staan.
 *
 * De titel van de notitie gaat mee: wie het lijstje in zijn takenlijst
 * tegenkomt, ziet anders een losse zin zonder aanleiding.
 */
export function actieOmschrijving(actie: Actiepunt, notitieTitel: string): string {
  const tekst = actie.tekst.trim();
  const titel = notitieTitel.trim();
  return titel ? `${tekst} — ${titel}` : tekst;
}

/**
 * Wat er met de takenlijst moet gebeuren nu de notitie wordt opgeslagen.
 *
 * Het scherm hoeft zo niet zelf te redeneren over wat nieuw is en wat weg
 * mag; het krijgt drie lijstjes en loopt ze af. De regels:
 *
 * - een actie met iemand erbij en nog geen ToDo → aanmaken;
 * - een actie met iemand erbij die al een ToDo heeft → bijwerken (ook als hij
 *   afgevinkt is: dan gaat de ToDo dicht);
 * - een actie waar de naam af is gehaald, of die helemaal is weggegooid →
 *   de ToDo hoort er niet meer bij. Het scherm zet hem op `Cancelled` en
 *   gooit hem niet weg: wie hem al in zijn lijst zag, ziet dan wat ermee
 *   gebeurd is in plaats van een gat.
 */
export interface TodoPlan {
  maken: Actiepunt[];
  bijwerken: Actiepunt[];
  opruimen: string[];
}

export function todoPlan(nieuw: Actiepunt[], oud: Actiepunt[]): TodoPlan {
  const plan: TodoPlan = { maken: [], bijwerken: [], opruimen: [] };
  const blijft = new Set<string>();
  for (const a of nieuw) {
    if (!a.tekst.trim()) continue;
    if (a.wie.trim()) {
      if (a.todo) {
        blijft.add(a.todo);
        plan.bijwerken.push(a);
      } else {
        plan.maken.push(a);
      }
    } else if (a.todo) {
      plan.opruimen.push(a.todo);
    }
  }
  for (const a of oud) {
    if (a.todo && !blijft.has(a.todo) && !plan.opruimen.includes(a.todo)) {
      const nogAanwezig = nieuw.some((n) => n.todo === a.todo);
      if (!nogAanwezig) plan.opruimen.push(a.todo);
    }
  }
  return plan;
}
