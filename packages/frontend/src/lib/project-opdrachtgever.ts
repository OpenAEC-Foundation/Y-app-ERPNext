/**
 * Het e-mailadres van de opdrachtgever van een project.
 *
 * Kies je in een nieuwe mail een project, dan komt dit adres in "Aan". De
 * opdrachtgever is de klant op het project; zijn adres staat op de klant zelf
 * (`email_id`), bij zijn primaire contactpersoon, of anders bij een van de
 * contactpersonen die aan de klant hangen. In die volgorde.
 */
import { fetchChildTable, fetchDocument, fetchList } from "./erpnext.ts";

export interface ContactRij {
  name: string;
  email_id?: string;
  is_primary_contact?: number;
}

const GELDIG = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

function schoon(adres?: string): string {
  const a = String(adres || "").trim();
  return GELDIG.test(a) ? a : "";
}

/**
 * Kiest het adres: eerst dat van de klant, dan de primaire contactpersoon
 * (van de klant of met het vinkje), dan de eerste contactpersoon met een adres.
 */
export function kiesOpdrachtgeverAdres(
  klantAdres: string | undefined,
  primairContact: string | undefined,
  contacten: ContactRij[],
): string {
  const eigen = schoon(klantAdres);
  if (eigen) return eigen;
  const metAdres = contacten.filter((c) => schoon(c.email_id));
  const primair = metAdres.find((c) => c.name === primairContact)
    ?? metAdres.find((c) => Number(c.is_primary_contact) === 1)
    ?? metAdres[0];
  return primair ? schoon(primair.email_id) : "";
}

const geheugen = new Map<string, Promise<string>>();

/** Het adres van de opdrachtgever van `project`, of "" als er geen bekend is. */
export function opdrachtgeverAdres(project: string): Promise<string> {
  const bekend = geheugen.get(project);
  if (bekend) return bekend;
  const vraag = (async () => {
    const proj = await fetchDocument<{ customer?: string }>("Project", project);
    const klant = String(proj?.customer || "").trim();
    if (!klant) return "";
    const doc = await fetchDocument<{ email_id?: string; customer_primary_contact?: string }>("Customer", klant);
    if (schoon(doc?.email_id)) return schoon(doc.email_id);
    const koppelingen = await fetchChildTable<{ parent?: string }>(
      "Dynamic Link", "Contact", ["parent"],
      [["parenttype", "=", "Contact"], ["link_doctype", "=", "Customer"], ["link_name", "=", klant]], 50,
    );
    const namen = [...new Set(koppelingen.map((k) => String(k.parent || "")).filter(Boolean))];
    if (doc?.customer_primary_contact && !namen.includes(doc.customer_primary_contact)) namen.push(doc.customer_primary_contact);
    if (namen.length === 0) return "";
    const contacten = await fetchList<ContactRij>("Contact", {
      fields: ["name", "email_id", "is_primary_contact"],
      filters: [["name", "in", namen]],
      limit_page_length: 50,
    });
    return kiesOpdrachtgeverAdres(undefined, doc?.customer_primary_contact, contacten);
  })().catch(() => "");
  geheugen.set(project, vraag);
  // Een mislukte of lege vraag niet eeuwig onthouden: misschien staat het adres er straks wel.
  void vraag.then((a) => { if (!a) geheugen.delete(project); });
  return vraag;
}
