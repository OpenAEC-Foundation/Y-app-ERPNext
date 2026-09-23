/**
 * E-mailondertekening, samengesteld uit ERPNext-gegevens.
 *
 * Waarom genereren en niet opslaan: een opgeslagen handtekening (het veld
 * `signature` op Email Account) veroudert stilletjes. Wie zijn telefoonnummer
 * wijzigt in zijn User- of Employee-record, verwacht dat de volgende mail het
 * nieuwe nummer draagt — niet dat iemand ergens ook nog een blok HTML
 * bijwerkt. Daarom bouwen we hem bij elke keer opstellen opnieuw op uit de
 * bron: User (naam, telefoon, foto), Employee (mobiel, bedrijf) en
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
  "Vroughindeweij Industries B.V.": "Vroughindeweij Industries",
};

/**
 * De opmaak van de ondertekening hangt aan de postbus waarvandaan je
 * schrijft, niet aan het bedrijf op je medewerkerskaart. Wie vanuit
 * info@vindus.nl antwoordt, hoort niet met het beeldmerk van 3BM te
 * ondertekenen — en andersom net zo goed.
 */
export interface Huisstijl {
  /** Company in ERPNext; bepaalt ook welk vestigingsadres eronder komt. */
  company: string;
  kleurDonker: string;
  kleurAccent: string;
  logo: string;
  logoBreedte: number;
  logoHoogte: number;
  website?: string;
  websiteLabel?: string;
  linkedin?: string;
  linkedinLogo?: string;
}

const HUISSTIJL_3BM: Huisstijl = {
  company: "3BM Bouwtechniek V.O.F.",
  kleurDonker: KLEUR_DONKER,
  kleurAccent: KLEUR_ACCENT,
  logo: LOGO_URL,
  logoBreedte: 215,
  logoHoogte: 56,
  website: WEBSITE,
  websiteLabel: WEBSITE_LABEL,
  linkedin: LINKEDIN_PAGINA,
  linkedinLogo: LINKEDIN_URL,
};

/** Vroughindeweij Industries (Vindus): eigen beeldmerk, zwart-grijs, geen socials. */
const HUISSTIJL_VINDUS: Huisstijl = {
  company: "Vroughindeweij Industries B.V.",
  kleurDonker: "#1c1c1c",
  kleurAccent: "#555555",
  logo: "/files/vindus-logo.png",
  logoBreedte: 64,
  logoHoogte: 64,
};

/** Postbus-domein → huisstijl. Alles wat er niet in staat, krijgt die van 3BM. */
const HUISSTIJL_PER_DOMEIN: Record<string, Huisstijl> = {
  "vindus.nl": HUISSTIJL_VINDUS,
};

/** De huisstijl die hoort bij het adres waarvandaan verstuurd wordt. */
export function huisstijlVoor(afzender: string): Huisstijl {
  const domein = s(afzender).toLowerCase().split("@")[1] || "";
  return HUISSTIJL_PER_DOMEIN[domein] ?? HUISSTIJL_3BM;
}

/**
 * Of de vaste beeldmerken hierboven bij dit bedrijf horen. Ze zijn voor één
 * huisstijl gemaakt; bij een ander bedrijf kwam dat merk onder elke mail.
 */
export function heeftEigenHuisstijl(bedrijf: string): boolean {
  return Object.prototype.hasOwnProperty.call(HANDELSNAAM, s(bedrijf));
}

/**
 * De eigen handtekening van de persoon (`User.email_signature`) gaat voor,
 * behalve bij het bedrijf waarvoor de opgebouwde ondertekening gemaakt is.
 */
export function gebruikOpgeslagenOndertekening(bedrijf: string, opgeslagen: string): boolean {
  return Boolean(s(opgeslagen)) && !heeftEigenHuisstijl(bedrijf);
}

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

/**
 * Het vierkant voor de ronde foto in de handtekening. Van een liggende foto het
 * midden, anders wordt hij platgedrukt. Van een staande foto de bovenkant:
 * daar zit het hoofd. Het midden van een staande foto is de romp — zo kwam er
 * een bovenlijf in de handtekening in plaats van een gezicht.
 */
export function bijsnijdVierkant(breedte: number, hoogte: number): { sx: number; sy: number; zijde: number } {
  const zijde = Math.max(1, Math.min(breedte, hoogte));
  return {
    sx: Math.round((breedte - zijde) / 2),
    sy: 0,
    zijde,
  };
}

/** Twee keer de getoonde 70 px, zodat hij op een scherm met hoge resolutie scherp blijft. */
const FOTO_ZIJDE = 140;

/**
 * Een adres op deze server als pad, zodat het ophalen binnen dezelfde site
 * blijft. De handtekening van een postbus noemt de foto met het volledige
 * adres (`https://erp.voorbeeld.nl/files/...`).
 */
function ophaalAdres(bron: string): string {
  if (typeof window === "undefined") return bron;
  try {
    const url = new URL(bron, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search : url.href;
  } catch {
    return bron;
  }
}

/**
 * De pasfoto als base64, klein en vierkant.
 *
 * De foto stond in de handtekening als pad naar een privé bestand op deze
 * server ("/private/files/..."). In het opstelvenster ben je ingelogd en zag
 * hij er goed uit; de ontvanger kreeg een gebroken plaatje. Als base64 zit hij
 * in de mail zelf. Verkleind tot 112 px: een pasfoto van een halve megabyte in
 * elke mail die je verstuurt, zou elke mail een halve megabyte zwaarder maken.
 *
 * Lukt het niet, dan "" — liever geen foto dan een gebroken plaatje.
 */
export async function fotoAlsBase64(pad: string): Promise<string> {
  try {
    const res = await fetch(encodeURI(ophaalAdres(pad)), { credentials: "same-origin" });
    if (!res.ok) return "";
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return "";
    const beeld = await createImageBitmap(blob);
    const { sx, sy, zijde } = bijsnijdVierkant(beeld.width, beeld.height);
    const doek = document.createElement("canvas");
    doek.width = FOTO_ZIJDE;
    doek.height = FOTO_ZIJDE;
    const ctx = doek.getContext("2d");
    if (!ctx) return "";
    // JPEG kent geen doorzichtigheid: een transparante rand wordt anders zwart.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, FOTO_ZIJDE, FOTO_ZIJDE);
    ctx.drawImage(beeld, sx, sy, zijde, zijde, 0, 0, FOTO_ZIJDE, FOTO_ZIJDE);
    beeld.close();
    return doek.toDataURL("image/jpeg", 0.85);
  } catch {
    return "";
  }
}

/**
 * De persoonlijke foto uit een handmatig ingestelde handtekening: de eerste
 * afbeelding die niet het logo of het LinkedIn-icoon is.
 *
 * Zo stond hij in de oudere mails: alleen het hoofd, apart uitgesneden. De
 * profielfoto in ERPNext is vaak een staande foto van het hele lichaam, en die
 * hoort niet onder een mail.
 */
export function fotoUitOpgeslagen(html: string): string {
  const vast = [LOGO_URL, LINKEDIN_URL].map((u) => u.split("/").pop() || u);
  for (const m of (html || "").matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const bron = m[1].trim();
    if (!bron || vast.some((naam) => bron.endsWith(naam))) continue;
    return bron;
  }
  return "";
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
  /**
   * De foto zoals hij in de mail moet: een base64-bron uit `fotoAlsBase64`.
   * Leeg betekent geen foto. Niet opgegeven: het pad uit ERPNext, zoals vroeger.
   */
  fotoBron?: string;
  /** Welke huisstijl; standaard die van 3BM. */
  huisstijl?: Huisstijl;
}): string {
  const { voor, rest } = splitsNaam(input.user, input.employee);
  const telefoon = kiesTelefoon(input.user, input.employee);
  const foto = input.fotoBron !== undefined ? input.fotoBron : kiesFoto(input.user, input.employee);
  const stijl = input.huisstijl ?? HUISSTIJL_3BM;
  const donker = stijl.kleurDonker;
  const accent = stijl.kleurAccent;
  const bedrijf = HANDELSNAAM[input.bedrijf] || input.bedrijf;

  const regels: string[] = [];
  regels.push(`<p style="margin:0 0 10px 0">Met vriendelijke groet,</p>`);

  if (voor || rest) {
    const naam = `<strong style="color:${accent}">${esc(voor)}</strong>`
      + (rest ? ` <span style="color:${donker}">${esc(rest)}</span>` : "");
    regels.push(foto
      ? `<p style="margin:0 0 10px 0"><img src="${esc(foto)}" width="70" height="70"`
        + ` style="border-radius:50%;vertical-align:middle;margin-right:8px" alt=""> ${naam}</p>`
      : `<p style="margin:0 0 10px 0">${naam}</p>`);
  }
  const logoTag = `<img src="${stijl.logo}" width="${stijl.logoBreedte}" height="${stijl.logoHoogte}" alt="${esc(bedrijf)}">`;
  regels.push(`<p style="margin:0 0 8px 0">${
    stijl.website ? `<a href="${stijl.website}" rel="noopener noreferrer">${logoTag}</a>` : logoTag
  }</p>`);

  const blok: string[] = [];
  if (bedrijf) blok.push(`<strong style="color:${donker}">${esc(bedrijf)}</strong>`);
  const straat = s(input.adres?.address_line1);
  if (straat) blok.push(`<span style="color:${donker}">${esc(straat)}</span>`);
  const plaats = [s(input.adres?.pincode), s(input.adres?.city)].filter(Boolean).join(" ");
  if (plaats) blok.push(`<span style="color:${donker}">${esc(plaats)}</span>`);
  if (telefoon) blok.push(`<span style="color:${donker}">${esc(telefoon)}</span>`);
  if (stijl.website && stijl.websiteLabel) {
    blok.push(`<a href="${stijl.website}" style="color:${accent};text-decoration:none" rel="noopener noreferrer">${stijl.websiteLabel}</a>`);
  }
  regels.push(`<p style="margin:0 0 8px 0;line-height:1.5">${blok.join("<br>")}</p>`);

  if (stijl.linkedin && stijl.linkedinLogo) {
    regels.push(`<p style="margin:0"><a href="${stijl.linkedin}" rel="noopener noreferrer">`
      + `<img src="${stijl.linkedinLogo}" width="23" height="23" alt="LinkedIn"></a></p>`);
  }

  return `<div style="font-family:'Segoe UI',Tahoma,Calibri,sans-serif;font-size:14px;color:${donker}">`
    + regels.join("") + `</div>`;
}

/**
 * Haalt de gegevens op en levert de ondertekening voor één adres.
 *
 * Bewust zonder cache: het hele punt is dat een gewijzigd telefoonnummer of
 * een nieuwe profielfoto meteen meekomt. Het zijn drie kleine lijstqueries,
 * eenmalig bij het openen van een concept.
 */
export async function ondertekeningVoor(
  emailId: string,
  emailAccount?: string,
  afzender?: string,
): Promise<string> {
  const adres = s(emailId).toLowerCase();
  if (!adres) return "";
  // De postbus bepaalt de huisstijl; zonder opgave die van het eigen adres.
  const stijl = huisstijlVoor(afzender || emailAccount || adres);

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
      fields: ["name", "employee_name", "cell_number", "company", "image"],
      filters: [["user_id", "=", adres], ["status", "=", "Active"]],
      limit_page_length: 1,
    });
    employee = employees[0] ?? null;
  } catch { /* idem */ }

  // Zonder persoon achter dit adres (gedeelde postbus) is er niets te
  // genereren: dan geldt wat er op het Email Account is ingesteld.
  if (!user && !employee) return emailAccount ? await opgeslagenOndertekening(emailAccount) : "";

  // Schrijf je vanuit een postbus met een eigen huisstijl, dan hoort dát
  // bedrijf eronder — ook als je medewerkerskaart een ander bedrijf noemt.
  const bedrijf = stijl !== HUISSTIJL_3BM ? stijl.company : s(employee?.company);
  if (!heeftEigenHuisstijl(bedrijf)) {
    const eigen = await eigenOndertekening(adres);
    if (gebruikOpgeslagenOndertekening(bedrijf, eigen)) return eigen;
  }
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

  // Eerst de foto uit de handtekening van de postbus: de uitgesneden hoofdfoto
  // uit de oudere mails. Pas als die er niet is, of niet laadt, de profielfoto
  // uit ERPNext.
  const opgeslagen = emailAccount ? fotoUitOpgeslagen(await opgeslagenOndertekening(emailAccount)) : "";
  let fotoBron = opgeslagen ? await fotoAlsBase64(opgeslagen) : "";
  if (!fotoBron) {
    const pad = kiesFoto(user, employee);
    fotoBron = pad ? await fotoAlsBase64(pad) : "";
  }
  return opmaakOndertekening({ user, employee, adres: adresRij, bedrijf, fotoBron, huisstijl: stijl });
}

/**
 * `User.email_signature` van dit adres. Los opgehaald en niet in de
 * lijstquery hierboven: een medewerker zonder `System Manager` mag de
 * User-lijst niet lezen, zijn eigen User-document wel.
 */
async function eigenOndertekening(adres: string): Promise<string> {
  try {
    const doc = await fetchDocument<{ email_signature?: string }>("User", adres);
    return s(doc?.email_signature);
  } catch {
    return "";
  }
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
