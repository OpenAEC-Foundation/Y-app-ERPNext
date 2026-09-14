/**
 * Het standaard lettertype voor uitgaande e-mail — één instelling voor heel
 * 3BM.
 *
 * Opgeslagen als rij in het sleutel/waarde-doctype `Y Next Setting` onder
 * `mail-opmaak`, net als het kilometertarief. Schrijven op dat doctype is
 * System-Manager-only, en dat is hier de bedoeling: het is een huisstijlkeuze,
 * geen persoonlijke voorkeur. `saveMailOpmaak` meldt via zijn returnwaarde of
 * het gelukt is, zodat de UI geen "opgeslagen" beweert na een 403.
 *
 * Waarom als één rij met JSON en niet drie losse sleutels: de drie waarden
 * horen bij elkaar en worden altijd samen gelezen. Eén rij is één verzoek, en
 * een half bijgewerkte huisstijl bestaat niet.
 *
 * De keuze is bewust klein gehouden tot lettertypen die in vrijwel elk
 * mailprogramma bestaan. Een lettertype dat de ontvanger niet heeft, valt daar
 * terug op iets willekeurigs — dan is de huisstijl alsnog weg.
 */

import { fetchDocument, updateDocument, createDocument, ApiError } from "./erpnext.ts";

const SETTING_DOCTYPE = "Y Next Setting";
export const MAIL_OPMAAK_SETTING_KEY = "mail-opmaak";

/** Wat er aan opmaak vastligt voor uitgaande post. */
export interface MailOpmaak {
  /** Naam van het lettertype, zoals in de keuzelijst. */
  lettertype: string;
  /** Puntgrootte; e-mail rekent in pt, niet in px. */
  grootte: number;
  /** Tekstkleur als `#rrggbb`. */
  kleur: string;
}

export const STANDAARD_MAIL_OPMAAK: MailOpmaak = {
  lettertype: "Arial",
  grootte: 11,
  kleur: "#1f2937",
};

/**
 * De keuzelijst. Elke regel draagt zijn eigen terugval-reeks: krijgt de
 * ontvanger het lettertype niet, dan pakt hij iets uit dezelfde familie in
 * plaats van wat zijn programma toevallig als standaard heeft.
 */
export const MAIL_LETTERTYPEN: { naam: string; stack: string }[] = [
  { naam: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { naam: "Calibri", stack: "Calibri, Candara, Segoe, Optima, sans-serif" },
  { naam: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { naam: "Tahoma", stack: "Tahoma, Verdana, Segoe, sans-serif" },
  { naam: "Trebuchet MS", stack: "'Trebuchet MS', Tahoma, sans-serif" },
  { naam: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  { naam: "Times New Roman", stack: "'Times New Roman', Times, serif" },
  { naam: "Courier New", stack: "'Courier New', Courier, monospace" },
];

export const MAIL_GROOTTES = [9, 10, 11, 12, 14, 16, 18];

/**
 * Leest de opgeslagen instelling.
 *
 * De bron is een `Long Text`, dus er kan van alles in staan — ook niets, en
 * ook onzin uit een handmatige bewerking. Elk veld valt apart terug op de
 * standaard: één verkeerde kleur hoort niet ook het lettertype te wissen.
 */
export function parseMailOpmaak(raw: unknown): MailOpmaak {
  let bron: unknown = raw;
  if (typeof raw === "string") {
    const tekst = raw.trim();
    if (!tekst) return { ...STANDAARD_MAIL_OPMAAK };
    try {
      bron = JSON.parse(tekst);
    } catch {
      return { ...STANDAARD_MAIL_OPMAAK };
    }
  }
  if (!bron || typeof bron !== "object" || Array.isArray(bron)) {
    return { ...STANDAARD_MAIL_OPMAAK };
  }
  const o = bron as Record<string, unknown>;
  return {
    lettertype: geldigLettertype(o.lettertype),
    grootte: geldigeGrootte(o.grootte),
    kleur: geldigeKleur(o.kleur),
  };
}

function geldigLettertype(waarde: unknown): string {
  const naam = String(waarde ?? "").trim();
  return MAIL_LETTERTYPEN.some((l) => l.naam === naam)
    ? naam
    : STANDAARD_MAIL_OPMAAK.lettertype;
}

function geldigeGrootte(waarde: unknown): number {
  const getal = typeof waarde === "number" ? waarde : Number(String(waarde ?? "").trim());
  return MAIL_GROOTTES.includes(getal) ? getal : STANDAARD_MAIL_OPMAAK.grootte;
}

function geldigeKleur(waarde: unknown): string {
  const kleur = String(waarde ?? "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(kleur) ? kleur : STANDAARD_MAIL_OPMAAK.kleur;
}

/** De terugval-reeks bij een lettertypenaam. */
export function lettertypeStack(naam: string): string {
  return MAIL_LETTERTYPEN.find((l) => l.naam === naam)?.stack
    ?? MAIL_LETTERTYPEN[0].stack;
}

/**
 * De opmaak als CSS, voor zowel het opstelvenster als de verstuurde mail.
 *
 * Inline en niet als klasse: een mailprogramma gooit een stylesheet weg, maar
 * inline stijl overleeft. Daarom is dit één string die overal hetzelfde
 * gebruikt wordt — wat je tijdens het typen ziet is wat de ontvanger krijgt.
 */
export function opmaakStijl(opmaak: MailOpmaak): string {
  return `font-family:${lettertypeStack(opmaak.lettertype)};`
    + `font-size:${opmaak.grootte}pt;`
    + `color:${opmaak.kleur}`;
}

interface YNextSettingDoc {
  setting_key?: string;
  setting_value?: string;
}

/** De huidige instelling; zonder record de standaard. */
export async function fetchMailOpmaak(): Promise<MailOpmaak> {
  try {
    const doc = await fetchDocument<YNextSettingDoc>(SETTING_DOCTYPE, MAIL_OPMAAK_SETTING_KEY);
    return parseMailOpmaak(doc?.setting_value);
  } catch {
    // Geen record, geen leesrecht, geen verbinding — in alle drie de gevallen
    // is doorgaan met de standaard beter dan een mail zonder opmaak.
    return { ...STANDAARD_MAIL_OPMAAK };
  }
}

/**
 * Slaat de instelling op. `false` betekent: niet gelukt, meestal omdat de
 * gebruiker geen System Manager is.
 */
export async function saveMailOpmaak(opmaak: MailOpmaak): Promise<boolean> {
  const waarde = JSON.stringify({
    lettertype: geldigLettertype(opmaak.lettertype),
    grootte: geldigeGrootte(opmaak.grootte),
    kleur: geldigeKleur(opmaak.kleur),
  });
  try {
    await updateDocument(SETTING_DOCTYPE, MAIL_OPMAAK_SETTING_KEY, { setting_value: waarde });
    return true;
  } catch (err) {
    // Het record bestaat nog niet op deze installatie; dan maken we het aan.
    if (err instanceof ApiError && err.status === 404) {
      try {
        await createDocument(SETTING_DOCTYPE, {
          setting_key: MAIL_OPMAAK_SETTING_KEY,
          setting_value: waarde,
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
