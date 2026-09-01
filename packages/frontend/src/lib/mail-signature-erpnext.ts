/**
 * E-mailondertekening, samengesteld uit ERPNext-gegevens.
 *
 * Waarom genereren en niet opslaan: een opgeslagen handtekening (het veld
 * `signature` op Email Account) veroudert stilletjes. Wie zijn telefoonnummer
 * wijzigt in zijn User- of Employee-record, verwacht dat de volgende mail het
 * nieuwe nummer draagt — niet dat iemand ergens ook nog een blok HTML
 * bijwerkt. Daarom bouwen we hem bij elke keer opstellen opnieuw op uit de
 * bron: User (naam, telefoon, foto), Employee (functie, mobiel, bedrijf) en
 * Address (het vestigingsadres van dat bedrijf).
 *
 * Voor gedeelde postbussen (info@, cooperatie@) bestaat geen persoon; die
 * vallen terug op de handtekening die op het Email Account zelf staat.
 */
import { fetchList, fetchDocument } from "./erpnext.ts";

/** Merkkleuren en vaste beeldmerken; die staan nergens in de database. */
const KLEUR_DONKER = "#350E35";
const KLEUR_ACCENT = "#44B6A8";
const LOGO_URL = "/files/ROkg9UQ.png";
const LINKEDIN_URL = "/files/vm179Zv.png";
const LINKEDIN_PAGINA = "https://nl.linkedin.com/company/3bm-ingenieursbureau";
const WEBSITE = "https://www.3bm.co.nl";
const WEBSITE_LABEL = "3bm.co.nl";

/** Handelsnaam per company; de doctype-naam is niet altijd hoe het bedrijf zich schrijft. */
const HANDELSNAAM: Record<string, string> = {
  "3BM Bouwtechniek V.O.F.": "3BM Bouwtechniek",
};

interface ErpUser {
  name: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  mobile_no?: string;
  phone?: string;
  user_image?: string;
}

interface ErpEmployee {
  name: string;
  employee_name?: string;
  designation?: string;
  cell_number?: string;
  company?: string;
  image?: string;
}

interface ErpAdres {
  address_title?: string;
  address_line1?: string;
  pincode?: string;
  city?: string;
  phone?: string;
}

function s(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/** HTML-escape; alle waarden hieronder komen uit door gebruikers gevulde velden. */
function esc(v: unknown): string {
  return s(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Functienamen dragen een sorteervoorvoegsel ("A_", "B2_", "C5_") zodat ze in
 * ERPNext-lijsten op niveau gegroepeerd staan. Dat hoort niet onder iemands
 * naam in een mail.
 */
export function schoonFunctie(designation: string): string {
  return s(designation).replace(/^[A-Z]\d*_/, "").trim();
}

/**
 * Splitst een volledige naam in voornaam en de rest. De voornaam krijgt de
 * accentkleur, zoals in de bestaande huisstijl-ondertekeningen.
 */
export function splitsNaam(user: ErpUser | null, employee: ErpEmployee | null): { voor: string; rest: string } {
  const voor = s(user?.first_name);
  const achter = s(user?.last_name);
  if (voor) return { voor, rest: achter };

  const vol = s(user?.full_name) || s(employee?.employee_name);
  if (!vol) return { voor: "", rest: "" };
  const delen = vol.split(/\s+/);
  return { voor: delen[0], rest: delen.slice(1).join(" ") };
}

/** Het telefoonnummer dat bij deze persoon hoort, in volgorde van betrouwbaarheid. */
export function kiesTelefoon(user: ErpUser | null, employee: ErpEmployee | null): string {
  return s(employee?.cell_number) || s(user?.mobile_no) || s(user?.phone);
}

/** De profielfoto van deze persoon, of "" als er geen is. */
export function kiesFoto(user: ErpUser | null, employee: ErpEmployee | null): string {
  return s(employee?.image) || s(user?.user_image);
}

/**
 * Bouwt de HTML. Los van het ophalen zodat de opmaak testbaar is zonder
 * netwerk, en zodat een ontbrekend veld hier zichtbaar wordt afgehandeld:
 * wat leeg is, valt weg — er blijft geen lege regel of los streepje staan.
 */
export function opmaakOndertekening(input: {
  user: ErpUser | null;
  employee: ErpEmployee | null;
  adres: ErpAdres | null;
  bedrijf: string;
}): string {
  const { voor, rest } = splitsNaam(input.user, input.employee);
  const functie = schoonFunctie(s(input.employee?.designation));
  const telefoon = kiesTelefoon(input.user, input.employee);
  const foto = kiesFoto(input.user, input.employee);
  const bedrijf = HANDELSNAAM[input.bedrijf] || input.bedrijf;

  const regels: string[] = [];
  regels.push(`<p style="margin:0 0 10px 0">Met vriendelijke groet,</p>`);

  if (voor || rest) {
    const naam = `<strong style="color:${KLEUR_ACCENT}">${esc(voor)}</strong>`
      + (rest ? ` <span style="color:${KLEUR_DONKER}">${esc(rest)}</span>` : "");
    regels.push(foto
      ? `<p style="margin:0 0 2px 0"><img src="${esc(foto)}" width="56" height="56"`
        + ` style="border-radius:50%;vertical-align:middle;margin-right:8px" alt=""> ${naam}</p>`
      : `<p style="margin:0 0 2px 0">${naam}</p>`);
  }
  if (functie) {
    regels.push(`<p style="margin:0 0 10px 0;color:${KLEUR_DONKER};font-size:13px">${esc(functie)}</p>`);
  }

  regels.push(`<p style="margin:0 0 8px 0"><a href="${WEBSITE}" rel="noopener noreferrer">`
    + `<img src="${LOGO_URL}" width="215" height="56" alt="${esc(bedrijf)}"></a></p>`);

  const blok: string[] = [];
  if (bedrijf) blok.push(`<strong style="color:${KLEUR_DONKER}">${esc(bedrijf)}</strong>`);
  const straat = s(input.adres?.address_line1);
  if (straat) blok.push(`<span style="color:${KLEUR_DONKER}">${esc(straat)}</span>`);
  const plaats = [s(input.adres?.pincode), s(input.adres?.city)].filter(Boolean).join(" ");
  if (plaats) blok.push(`<span style="color:${KLEUR_DONKER}">${esc(plaats)}</span>`);
  if (telefoon) blok.push(`<span style="color:${KLEUR_DONKER}">${esc(telefoon)}</span>`);
  blok.push(`<a href="${WEBSITE}" style="color:${KLEUR_ACCENT};text-decoration:none" rel="noopener noreferrer">${WEBSITE_LABEL}</a>`);
  regels.push(`<p style="margin:0 0 8px 0;line-height:1.5">${blok.join("<br>")}</p>`);

  regels.push(`<p style="margin:0"><a href="${LINKEDIN_PAGINA}" rel="noopener noreferrer">`
    + `<img src="${LINKEDIN_URL}" width="23" height="23" alt="LinkedIn"></a></p>`);

  return `<div style="font-family:'Segoe UI',Tahoma,Calibri,sans-serif;font-size:14px;color:${KLEUR_DONKER}">`
    + regels.join("") + `</div>`;
}

/**
 * Haalt de gegevens op en levert de ondertekening voor één adres.
 *
 * Bewust zonder cache: het hele punt is dat een gewijzigd telefoonnummer of
 * een nieuwe profielfoto meteen meekomt. Het zijn drie kleine lijstqueries,
 * eenmalig bij het openen van een concept.
 */
export async function ondertekeningVoor(emailId: string, emailAccount?: string): Promise<string> {
  const adres = s(emailId).toLowerCase();
  if (!adres) return "";

  let user: ErpUser | null = null;
  let employee: ErpEmployee | null = null;

  try {
    const users = await fetchList<ErpUser>("User", {
      fields: ["name", "full_name", "first_name", "last_name", "mobile_no", "phone", "user_image"],
      filters: [["name", "=", adres]],
      limit_page_length: 1,
    });
    user = users[0] ?? null;
  } catch { /* geen leesrecht op User → verderop de terugval */ }

  try {
    const employees = await fetchList<ErpEmployee>("Employee", {
      fields: ["name", "employee_name", "designation", "cell_number", "company", "image"],
      filters: [["user_id", "=", adres], ["status", "=", "Active"]],
      limit_page_length: 1,
    });
    employee = employees[0] ?? null;
  } catch { /* idem */ }

  // Zonder persoon achter dit adres (gedeelde postbus) is er niets te
  // genereren: dan geldt wat er op het Email Account is ingesteld.
  if (!user && !employee) return emailAccount ? await opgeslagenOndertekening(emailAccount) : "";

  const bedrijf = s(employee?.company);
  let adresRij: ErpAdres | null = null;
  if (bedrijf) {
    try {
      const rijen = await fetchList<ErpAdres>("Address", {
        fields: ["address_title", "address_line1", "pincode", "city", "phone"],
        filters: [["is_your_company_address", "=", 1]],
        limit_page_length: 20,
      });
      adresRij = rijen.find((r) => s(r.address_title) === bedrijf) ?? null;
    } catch { /* zonder adres blijft de rest van de ondertekening staan */ }
  }

  return opmaakOndertekening({ user, employee, adres: adresRij, bedrijf });
}

/** De handmatig ingestelde handtekening van een Email Account. */
async function opgeslagenOndertekening(emailAccount: string): Promise<string> {
  try {
    const doc = await fetchDocument<{ signature?: string }>("Email Account", emailAccount);
    return s(doc?.signature);
  } catch {
    return "";
  }
}
