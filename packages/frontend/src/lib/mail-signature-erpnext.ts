/**
 * E-mailondertekening, samengesteld uit ERPNext-gegevens.
 *
 * Waarom genereren en niet opslaan: een opgeslagen handtekening (het veld
 * `signature` op Email Account) veroudert stilletjes. Wie zijn telefoonnummer
 * wijzigt in zijn User- of Employee-record, verwacht dat de volgende mail het
 * nieuwe nummer draagt — niet dat iemand ergens ook nog een blok HTML
 * bijwerkt. Daarom bouwen we hem bij elke keer opstellen opnieuw op uit de
 * bron: User (naam, telefoon, foto), Employee (mobiel, bedrijf), Company
 * (naam, logo, website, huisstijl) en Address (het vestigingsadres).
 *
 * Hoe de ondertekening eruitziet staat nergens in de code. Logo en website
 * zijn gewone velden van het bedrijf; handelsnaam, kleuren, LinkedIn en de
 * groet zijn velden die de app aan Company toevoegt. Een bedrijf dat niets
 * invult krijgt een neutrale ondertekening.
 *
 * Voor gedeelde postbussen bestaat geen persoon; die vallen terug op de
 * handtekening die op het Email Account zelf staat.
 */
import { callMethod, fetchList, fetchDocument } from "./erpnext.ts";

/** De kleur van een ondertekening zonder ingevulde huisstijl. */
export const STANDAARD_KLEUR = "#1f2937";
/** De groet van een ondertekening als het bedrijf er geen heeft ingesteld. */
export const STANDAARD_GROET = "Met vriendelijke groet,";

/**
 * Wat een ondertekening eruit laat zien als van één bedrijf. Komt uit het
 * bedrijf waar de postbus bij hoort — zie `huisstijlUitBedrijf`.
 */
export interface Huisstijl {
  /** Company in ERPNext; bepaalt ook welk vestigingsadres eronder komt. */
  company: string;
  /** Hoe het bedrijf zich schrijft; de documentnaam is dat niet altijd. */
  handelsnaam: string;
  kleurDonker: string;
  kleurAccent: string;
  /** Adres van het logo, of "" als er geen bruikbaar logo is. */
  logo: string;
  /** Volledig webadres, of "". */
  website: string;
  linkedin: string;
  groet: string;
  /** Of het bedrijf zelf iets aan de huisstijl heeft ingevuld. */
  ingevuld: boolean;
}

/** De velden van Company waar de huisstijl uit komt. */
export interface ErpCompany {
  name: string;
  company_name?: string | null;
  company_logo?: string | null;
  website?: string | null;
  custom_trade_name?: string | null;
  custom_brand_color_dark?: string | null;
  custom_brand_color_accent?: string | null;
  custom_linkedin_url?: string | null;
  custom_signature_greeting?: string | null;
}

const COMPANY_VELDEN = [
  "name", "company_name", "company_logo", "website",
  "custom_trade_name", "custom_brand_color_dark", "custom_brand_color_accent",
  "custom_linkedin_url", "custom_signature_greeting",
];

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

/** Een kleurcode (`#rgb` of `#rrggbb`), of "". De waarde gaat in een style-attribuut. */
function kleurcode(waarde: unknown): string {
  const kleur = s(waarde);
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(kleur) ? kleur : "";
}

/**
 * Een webadres dat in een link mag staan, of "". Alleen http en https; een
 * kaal domein ("www.voorbeeld.nl") krijgt https ervoor.
 */
export function webadres(waarde: unknown): string {
  const ruw = s(waarde);
  if (!ruw || /["'<>\s]/.test(ruw)) return "";
  if (/^https?:\/\//i.test(ruw)) return ruw;
  // Iets met een ander schema (mailto:, javascript:) is geen webadres.
  if (/^[a-z][a-z0-9+.-]*:/i.test(ruw)) return "";
  return /^[^/]+\.[^/]+/.test(ruw) ? `https://${ruw}` : "";
}

/**
 * Het adres van een logo dat de ontvanger van de mail kan laden, of "".
 *
 * Een openbaar bestand op deze site (`/files/…`) of een volledig https-adres.
 * Een afgeschermd bestand (`/private/files/…`) niet: de ontvanger kan niet
 * inloggen en ziet dan een gebroken plaatje.
 */
export function logoAdres(waarde: unknown): string {
  const pad = s(waarde);
  if (!pad || /["'<>]/.test(pad)) return "";
  if (pad.startsWith("/files/")) return pad;
  return /^https:\/\//i.test(pad) ? pad : "";
}

/** De huisstijl van een bedrijf. Zonder bedrijf, of zonder ingevulde velden, een neutrale. */
export function huisstijlUitBedrijf(bedrijf: ErpCompany | null): Huisstijl {
  const handelsnaam = s(bedrijf?.custom_trade_name);
  const donker = kleurcode(bedrijf?.custom_brand_color_dark);
  const accent = kleurcode(bedrijf?.custom_brand_color_accent);
  const logo = logoAdres(bedrijf?.company_logo);
  const linkedin = webadres(bedrijf?.custom_linkedin_url);
  return {
    company: s(bedrijf?.name),
    handelsnaam: handelsnaam || s(bedrijf?.company_name) || s(bedrijf?.name),
    kleurDonker: donker || STANDAARD_KLEUR,
    kleurAccent: accent || donker || STANDAARD_KLEUR,
    logo,
    website: webadres(bedrijf?.website),
    linkedin,
    groet: s(bedrijf?.custom_signature_greeting) || STANDAARD_GROET,
    ingevuld: Boolean(handelsnaam || donker || accent || logo || linkedin),
  };
}

/**
 * De eigen handtekening van de persoon (`User.email_signature`) gaat voor,
 * behalve bij een bedrijf dat zijn huisstijl heeft ingevuld: dat wil juist
 * dat iedereen op dezelfde manier ondertekent.
 */
export function gebruikOpgeslagenOndertekening(stijl: Huisstijl, opgeslagen: string): boolean {
  return Boolean(s(opgeslagen)) && !stijl.ingevuld;
}

/**
 * Splitst een volledige naam in voornaam en de rest. De voornaam krijgt de
 * accentkleur.
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
 * in de mail zelf. Verkleind: een pasfoto van een halve megabyte in elke mail
 * die je verstuurt, zou elke mail een halve megabyte zwaarder maken.
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

/** Kleiner dan dit is een afbeelding een pictogram (een sociaal netwerk, een vlaggetje) en geen foto. */
const PICTOGRAM_GRENS = 40;

/** De opgegeven breedte of hoogte van een img-tag in pixels, of 0 als die er niet staat. */
function maat(tag: string, attribuut: "width" | "height"): number {
  const gevonden = new RegExp(`\\b${attribuut}\\s*=\\s*["']?(\\d+)`, "i").exec(tag);
  return gevonden ? Number(gevonden[1]) : 0;
}

/**
 * De persoonlijke foto uit een handmatig ingestelde handtekening: de eerste
 * afbeelding die niet het logo is en ook geen pictogram.
 *
 * In zo'n handtekening staat vaak alleen het hoofd, apart uitgesneden. De
 * profielfoto in ERPNext is vaak een staande foto van het hele lichaam, en die
 * hoort niet onder een mail.
 *
 * @param overslaan adressen (of het eind daarvan) van afbeeldingen die geen
 *   foto zijn, zoals het logo van het bedrijf.
 */
export function fotoUitOpgeslagen(html: string, overslaan: string[] = []): string {
  const namen = overslaan.map((adres) => s(adres).split("/").pop() || "").filter(Boolean);
  for (const m of (html || "").matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const bron = m[1].trim();
    if (!bron || namen.some((naam) => bron.endsWith(naam))) continue;
    const breedte = maat(m[0], "width");
    const hoogte = maat(m[0], "height");
    if ((breedte && breedte < PICTOGRAM_GRENS) || (hoogte && hoogte < PICTOGRAM_GRENS)) continue;
    return bron;
  }
  return "";
}

/** De profielfoto van deze persoon, of "" als er geen is. */
export function kiesFoto(user: ErpUser | null, employee: ErpEmployee | null): string {
  return s(employee?.image) || s(user?.user_image);
}

/** "www.voorbeeld.nl" uit "https://www.voorbeeld.nl/contact": zo staat de website onder de mail. */
function websiteLabel(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
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
  huisstijl: Huisstijl;
  /**
   * De foto zoals hij in de mail moet: een base64-bron uit `fotoAlsBase64`.
   * Leeg betekent geen foto. Niet opgegeven: het pad uit ERPNext, zoals vroeger.
   */
  fotoBron?: string;
}): string {
  const { voor, rest } = splitsNaam(input.user, input.employee);
  const telefoon = kiesTelefoon(input.user, input.employee);
  const foto = input.fotoBron !== undefined ? input.fotoBron : kiesFoto(input.user, input.employee);
  const stijl = input.huisstijl;
  const donker = stijl.kleurDonker;
  const accent = stijl.kleurAccent;
  const bedrijf = stijl.handelsnaam;

  const regels: string[] = [];
  regels.push(`<p style="margin:0 0 10px 0">${esc(stijl.groet)}</p>`);

  if (voor || rest) {
    const naam = `<strong style="color:${accent}">${esc(voor)}</strong>`
      + (rest ? ` <span style="color:${donker}">${esc(rest)}</span>` : "");
    regels.push(foto
      ? `<p style="margin:0 0 10px 0"><img src="${esc(foto)}" width="70" height="70"`
        + ` style="border-radius:50%;vertical-align:middle;margin-right:8px" alt=""> ${naam}</p>`
      : `<p style="margin:0 0 10px 0">${naam}</p>`);
  }

  if (stijl.logo) {
    // Alleen de hoogte: het logo van elk bedrijf heeft een andere verhouding.
    const logoTag = `<img src="${esc(stijl.logo)}" height="56" alt="${esc(bedrijf)}">`;
    regels.push(`<p style="margin:0 0 8px 0">${
      stijl.website ? `<a href="${esc(stijl.website)}" rel="noopener noreferrer">${logoTag}</a>` : logoTag
    }</p>`);
  }

  const blok: string[] = [];
  if (bedrijf) blok.push(`<strong style="color:${donker}">${esc(bedrijf)}</strong>`);
  const straat = s(input.adres?.address_line1);
  if (straat) blok.push(`<span style="color:${donker}">${esc(straat)}</span>`);
  const plaats = [s(input.adres?.pincode), s(input.adres?.city)].filter(Boolean).join(" ");
  if (plaats) blok.push(`<span style="color:${donker}">${esc(plaats)}</span>`);
  if (telefoon) blok.push(`<span style="color:${donker}">${esc(telefoon)}</span>`);
  const label = stijl.website ? websiteLabel(stijl.website) : "";
  if (label) {
    blok.push(`<a href="${esc(stijl.website)}" style="color:${accent};text-decoration:none" rel="noopener noreferrer">${esc(label)}</a>`);
  }
  if (blok.length > 0) {
    regels.push(`<p style="margin:0 0 8px 0;line-height:1.5">${blok.join("<br>")}</p>`);
  }

  if (stijl.linkedin) {
    regels.push(`<p style="margin:0"><a href="${esc(stijl.linkedin)}" style="color:${accent};text-decoration:none"`
      + ` rel="noopener noreferrer">LinkedIn</a></p>`);
  }

  return `<div style="font-family:'Segoe UI',Tahoma,Calibri,sans-serif;font-size:14px;color:${donker}">`
    + regels.join("") + `</div>`;
}

/**
 * Haalt de gegevens op en levert de ondertekening voor één adres.
 *
 * Bewust zonder cache: het hele punt is dat een gewijzigd telefoonnummer of
 * een nieuwe profielfoto meteen meekomt. Het zijn een paar kleine verzoeken,
 * eenmalig bij het openen van een concept.
 *
 * @param emailId het adres van de persoon die schrijft
 * @param emailAccount de postbus waarvandaan verstuurd wordt (naam van het
 *   Email Account). Die bepaalt de huisstijl: wie vanuit de postbus van een
 *   ander bedrijf schrijft, ondertekent met dat bedrijf.
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
      fields: ["name", "employee_name", "cell_number", "company", "image"],
      filters: [["user_id", "=", adres], ["status", "=", "Active"]],
      limit_page_length: 1,
    });
    employee = employees[0] ?? null;
  } catch { /* idem */ }

  const bron = (await bronVanServer(emailAccount))
    ?? (await bronRechtstreeks(emailAccount, s(employee?.company)));

  // Zonder persoon achter dit adres (gedeelde postbus) is er niets te
  // genereren: dan geldt wat er op het Email Account is ingesteld.
  if (!user && !employee) return bron.postbusOndertekening;

  const stijl = huisstijlUitBedrijf(bron.bedrijf);
  if (!stijl.ingevuld) {
    const eigen = await eigenOndertekening(adres);
    if (gebruikOpgeslagenOndertekening(stijl, eigen)) return eigen;
  }

  // Eerst de foto uit de handtekening van de postbus: vaak een apart
  // uitgesneden hoofdfoto. Pas als die er niet is, of niet laadt, de
  // profielfoto uit ERPNext.
  const opgeslagen = fotoUitOpgeslagen(bron.postbusOndertekening, stijl.logo ? [stijl.logo] : []);
  let fotoBron = opgeslagen ? await fotoAlsBase64(opgeslagen) : "";
  if (!fotoBron) {
    const pad = kiesFoto(user, employee);
    fotoBron = pad ? await fotoAlsBase64(pad) : "";
  }
  return opmaakOndertekening({ user, employee, adres: bron.adres, fotoBron, huisstijl: stijl });
}

/** Wat er naast de persoon in de ondertekening komt. */
export interface OndertekeningBron {
  /** Het bedrijf van de postbus, anders dat van de medewerkerskaart. */
  bedrijf: ErpCompany | null;
  /** Het vestigingsadres van dat bedrijf. */
  adres: ErpAdres | null;
  /** De handmatig ingestelde handtekening van de postbus, of "". */
  postbusOndertekening: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * Het antwoord van de serverfunctie `ondertekening_gegevens`, of `null` als
 * het dat antwoord niet is.
 */
export function bronUitAntwoord(antwoord: unknown): OndertekeningBron | null {
  if (!isObject(antwoord) || !("bedrijf" in antwoord)) return null;
  const { bedrijf, adres, postbus } = antwoord;
  if (bedrijf !== null && !(isObject(bedrijf) && typeof bedrijf.name === "string")) return null;
  return {
    bedrijf: bedrijf as ErpCompany | null,
    adres: isObject(adres) ? (adres as ErpAdres) : null,
    postbusOndertekening: isObject(postbus) ? s(postbus.signature) : "",
  };
}

/**
 * De gegevens via de serverfunctie van de app. Die leest wat een gewone
 * medewerker zelf niet mag lezen maar wel onder zijn mail hoort: het adres
 * van zijn bedrijf, en het bedrijf en de handtekening van de postbus waaruit
 * hij schrijft. Zie `y_next.api.ondertekening`.
 */
async function bronVanServer(emailAccount?: string): Promise<OndertekeningBron | null> {
  try {
    return bronUitAntwoord(await callMethod("ondertekening_gegevens", { postbus: emailAccount || "" }));
  } catch {
    return null;
  }
}

/**
 * Dezelfde gegevens met gewone leesacties, voor wie de serverfunctie niet mag
 * of kan gebruiken. Wat de gebruiker niet mag lezen, valt dan weg.
 */
async function bronRechtstreeks(emailAccount: string | undefined, bedrijfVanKaart: string): Promise<OndertekeningBron> {
  const postbus = emailAccount ? await leesPostbus(emailAccount) : { signature: "", company: "" };
  // Het bedrijf van de postbus gaat voor op dat van de medewerkerskaart.
  const bedrijfsnaam = postbus.company || bedrijfVanKaart;
  const bedrijf = bedrijfsnaam ? await leesBedrijf(bedrijfsnaam) : null;

  let adres: ErpAdres | null = null;
  if (bedrijf) {
    try {
      const rijen = await fetchList<ErpAdres>("Address", {
        fields: ["address_title", "address_line1", "pincode", "city", "phone"],
        filters: [["is_your_company_address", "=", 1]],
        limit_page_length: 20,
      });
      const titels = [bedrijfsnaam, s(bedrijf.custom_trade_name), s(bedrijf.company_name)].filter(Boolean);
      adres = rijen.find((r) => titels.includes(s(r.address_title))) ?? null;
    } catch { /* zonder adres blijft de rest van de ondertekening staan */ }
  }
  return { bedrijf, adres, postbusOndertekening: postbus.signature };
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

/** De handmatig ingestelde handtekening van een Email Account, en het bedrijf waar de postbus bij hoort. */
async function leesPostbus(emailAccount: string): Promise<{ signature: string; company: string }> {
  try {
    // `custom_company` is een veld dat de app aan Email Account toevoegt;
    // ERPNext kent zelf geen bedrijf per postbus.
    const doc = await fetchDocument<{ signature?: string; custom_company?: string }>("Email Account", emailAccount);
    return { signature: s(doc?.signature), company: s(doc?.custom_company) };
  } catch {
    return { signature: "", company: "" };
  }
}

/** Het bedrijf met de velden waar de huisstijl uit komt. Lukt het lezen niet, dan alleen de naam. */
async function leesBedrijf(naam: string): Promise<ErpCompany> {
  try {
    const rijen = await fetchList<ErpCompany>("Company", {
      fields: COMPANY_VELDEN,
      filters: [["name", "=", naam]],
      limit_page_length: 1,
    });
    return rijen[0] ?? { name: naam };
  } catch {
    return { name: naam };
  }
}
