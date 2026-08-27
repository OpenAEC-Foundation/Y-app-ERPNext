/**
 * De mail aan een ERPNext-document hangen, en de bijlagen mee.
 *
 * Deze twee stappen zijn identiek voor élk document dat Y-next vanuit een mail
 * aanmaakt — een inkoopfactuur, een lead, een offerteaanvraag — en voor het
 * koppelen aan een bestaand project. Eén module, zodat een verbetering (of een
 * fix) niet in drie kopieën hoeft te landen.
 *
 * **De bijlage wordt niet opnieuw geüpload.** Het bestand staat al als `File`
 * op de Communication; er komt een tweede `File`-rij bij die naar dezelfde
 * `file_url` wijst. Live geverifieerd op de doelinstance: de koppeling werkt,
 * en het verwijderen van die tweede rij laat het fysieke bestand én de
 * oorspronkelijke koppeling ongemoeid. Opnieuw uploaden zou een tweede kopie
 * van elke PDF op de schijf zetten.
 */

import { createDocument, fetchDocument, updateDocument } from "./erpnext.ts";

export interface MailAttachmentRef {
  /** File-docname van de bijlage op de Communication (alleen ter herkenning). */
  name: string;
  fileName: string;
  fileUrl: string;
  isPrivate: boolean;
}

/**
 * Uitkomst van "maak document X vanuit deze mail". Alleen het aanmaken zelf
 * mag de hele actie laten mislukken; de bijlagen en de koppeling zijn
 * verrijkingen. Is het document er eenmaal, dan is "de bijlage hing er niet
 * aan" een mededeling en geen reden om de gebruiker te laten denken dat er
 * niets gebeurd is — waarna hij het nóg eens probeert en een duplicaat maakt.
 */
export interface MailDocumentResult {
  /** Docname van het aangemaakte document. */
  name: string;
  /** Bijlagen die niet gekoppeld konden worden (het document bestaat wél). */
  failedAttachments: string[];
  /** `true` als de mail niet aan het document gekoppeld kon worden. */
  linkFailed: boolean;
}

/**
 * Hang de gekozen bijlagen aan het document. Geeft de bestandsnamen terug die
 * niet gelukt zijn; gooit nooit.
 */
export async function attachMailFiles(
  doctype: string,
  docname: string,
  attachments: MailAttachmentRef[],
): Promise<string[]> {
  const failed: string[] = [];
  for (const att of attachments) {
    try {
      await createDocument("File", {
        file_url: att.fileUrl,
        file_name: att.fileName,
        is_private: att.isPrivate ? 1 : 0,
        attached_to_doctype: doctype,
        attached_to_name: docname,
      });
    } catch {
      failed.push(att.fileName);
    }
  }
  return failed;
}

interface CommunicationLinkRow {
  link_doctype?: string;
  link_name?: string;
}

/**
 * Hang de mail aan het document, op de twee manieren die ERPNext' desk-tijdlijn
 * kent.
 *
 * Live geverifieerd op de doelinstance: `frappe.desk.form.load.get_docinfo` op
 * het nieuwe document toont de mail **al** bij alleen `reference_doctype` +
 * `reference_name`, en óók bij alleen een `timeline_links`-rij. Ze werken dus
 * onafhankelijk van elkaar — vandaar dat de child-tabel-update hieronder
 * best-effort is en de PUT hierboven leidend.
 *
 * Toch worden ze allebei gezet, want ze doen niet hetzelfde: `reference_*` is
 * **enkelvoudig** (een Communication hangt aan één document), dus zodra de mail
 * later aan een project wordt gekoppeld, verdwijnt de eerdere verwijzing weer.
 * `timeline_links` is een lijst en overleeft dat.
 *
 * **De bestaande rijen moeten mee.** Frappe vervangt een child-tabel volledig
 * bij een PUT; de Communications in deze mailbox dragen al `Contact`-rijen (die
 * ERPNext zelf bij het binnenhalen zet). Alleen de nieuwe rij sturen zou die
 * stilzwijgend wissen — vandaar eerst lezen, dan aanvullen.
 */
export async function linkCommunicationTo(
  communication: string,
  doctype: string,
  docname: string,
): Promise<void> {
  await updateDocument("Communication", communication, {
    reference_doctype: doctype,
    reference_name: docname,
    // Frappe's eigen aanduiding voor "hangt aan een document"; hij kleurt de
    // rij in de desk-lijst. Raakt `email_status` (Open/Spam/Trash) niet, dus
    // de Prullenbak-logica van de webmail blijft ongemoeid.
    status: "Linked",
  });
  try {
    const doc = await fetchDocument<{ timeline_links?: CommunicationLinkRow[] }>(
      "Communication", communication,
    );
    const existing = doc.timeline_links ?? [];
    if (existing.some((l) => l.link_doctype === doctype && l.link_name === docname)) return;
    await updateDocument("Communication", communication, {
      timeline_links: [
        ...existing.map((l) => ({ link_doctype: l.link_doctype, link_name: l.link_name })),
        { link_doctype: doctype, link_name: docname },
      ],
    });
  } catch {
    // De tijdlijn werkt al via `reference_*`; dit was de duurzame extra.
  }
}

/**
 * Maak een document vanuit een mail: aanmaken, bijlagen koppelen, mail
 * koppelen. Gooit alleen wanneer het aanmaken zelf mislukt.
 */
export async function createDocumentFromMail(args: {
  doctype: string;
  payload: Record<string, unknown>;
  /** Communication-docname van de mail. */
  communication: string;
  attachments: MailAttachmentRef[];
}): Promise<MailDocumentResult> {
  const created = await createDocument<{ name: string }>(args.doctype, args.payload);
  const name = created?.name;
  if (!name) throw new Error(`ERPNext gaf geen ${args.doctype}-nummer terug`);

  const failedAttachments = await attachMailFiles(args.doctype, name, args.attachments);

  let linkFailed = false;
  try {
    await linkCommunicationTo(args.communication, args.doctype, name);
  } catch {
    linkFailed = true;
  }
  return { name, failedAttachments, linkFailed };
}
