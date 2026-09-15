/**
 * Mag deze gebruiker dit documentsoort lezen? ERPNext beslist.
 *
 * De app houdt geen eigen lijst bij van wie inkoopfacturen of klanten mag
 * zien. Die zou stilletjes gaan afwijken van wat in ERPNext is ingesteld, en
 * dan klopt het nergens meer. In plaats daarvan vragen we het ERPNext zelf:
 * een lijstvraag van een regel op dat soort. Weigert ERPNext (403), dan is er
 * geen leesrecht, en dat volgt precies de rollen die daar zijn toegekend.
 *
 * Rechtstreeks met `fetch` en niet via `fetchList`: die cachet antwoorden en
 * vertaalt ontbrekende soorten naar een lege lijst, en daarmee zou een
 * weigering niet meer van "leeg" te onderscheiden zijn.
 */

const toegang = new Map<string, Promise<boolean>>();

/** Gooi de onthouden antwoorden weg, bijvoorbeeld na een wijziging van rollen. */
export function vergeetToegang(): void {
  toegang.clear();
}

/**
 * Leesrecht op een documentsoort. Per sessie een vraag per soort; gelijktijdige
 * aanroepen delen die ene vraag.
 *
 * Bij een netwerkfout: geen toegang, en niet onthouden. Liever even geen
 * inkoopfacturen dan ze ten onrechte tonen, en de volgende keer wordt het
 * gewoon opnieuw gevraagd.
 */
export function magLezen(doctype: string): Promise<boolean> {
  const bekend = toegang.get(doctype);
  if (bekend) return bekend;
  const vraag = (async () => {
    const q = new URLSearchParams({ fields: JSON.stringify(["name"]), limit_page_length: "1" });
    const res = await fetch("/api/resource/" + encodeURIComponent(doctype) + "?" + q.toString(), {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    return res.ok;
  })().catch(() => {
    toegang.delete(doctype);
    return false;
  });
  toegang.set(doctype, vraag);
  return vraag;
}

/** De soorten uit deze lijst waar de gebruiker leesrecht op heeft. */
export async function leesbareDoctypes(doctypes: string[]): Promise<Set<string>> {
  const uniek = [...new Set(doctypes)];
  const uitslag = await Promise.all(uniek.map(async (dt) => ({ dt, mag: await magLezen(dt) })));
  return new Set(uitslag.filter((u) => u.mag).map((u) => u.dt));
}
