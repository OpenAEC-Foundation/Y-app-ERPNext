/**
 * Welke postbussen iemand in de mailmodule te zien krijgt.
 *
 * De regel die hier wordt vastgelegd bestaat omdat "zien" en "mogen lezen"
 * twee verschillende dingen zijn, en ze uit elkaar liepen.
 *
 * ERPNext beperkt het lézen van `Communication` tot de accounts die in de
 * User Email-tabel van die gebruiker staan; alleen een System Manager komt
 * daaronderuit. Diezelfde tabel is dus meteen de betrouwbaarste bron voor de
 * kiezer, en hij staat in het eigen User-document — dat elke gebruiker mag
 * lezen. `Email Account` mag dat níet: dat vraagt de rol Inbox User of System
 * Manager. Bouw je de kiezer daarop, dan krijgt een gewone medewerker een
 * lege lijst, ook voor zijn eigen postbus.
 *
 * Daarom: de eigen rijen zijn de lijst. De accounts uit `Email Account`
 * komen er alleen bij voor wie tóch alles mag lezen, om de gedeelde bussen
 * erbij te kunnen zetten zonder alle accounts van het bedrijf te tonen.
 */

/** Eén Email Account zoals ERPNext hem teruggeeft. */
export interface PostbusKandidaat {
  /** Docnaam van het Email Account — hierop filtert `Communication`. */
  name: string;
  emailId?: string;
  enableIncoming?: boolean;
  enableOutgoing?: boolean;
}

/** Eén postbus uit de User Email-tabel van de gebruiker. */
export interface EigenPostbus {
  /** Docnaam van het Email Account. */
  name: string;
  emailId: string;
}

/** Wat ERPNext deze gebruiker aan post laat lezen. */
export interface Postbustoegang {
  /** De rijen uit zijn User Email-tabel. */
  accounts: EigenPostbus[];
  /**
   * System Manager: voor hem geldt de beperking op `Communication` niet, dus
   * hij leest elke postbus — ook zonder rij in zijn User Email-tabel.
   */
  alles: boolean;
}

/** Eén kiesbare postbus in de mailmodule. */
export interface Postbus {
  name: string;
  emailId: string;
  /** Eigen postbus van de ingelogde gebruiker (staat bovenaan). */
  own: boolean;
}

/**
 * De postbussen die deze gebruiker in de kiezer hoort te zien.
 *
 * - Alles uit zijn User Email-tabel. Dat is precies de lijst waar ERPNext het
 *   lezen op beperkt, dus wat hij ziet kan hij ook openen.
 * - Is hij System Manager, dan komen de gedeelde bussen erbij — hij leest ze
 *   toch — en zijn eigen account, ook als dat niet in zijn tabel staat.
 *
 * Zonder bekende toegang (`toegang` is null, bijvoorbeeld omdat het eigen
 * User-document niet te lezen was) valt hij terug op de gedeelde lijst uit
 * `Email Account`. Dat is het gedrag van vóór deze regel: liever een tab te
 * veel dan een gebruiker die zijn postbus kwijt is.
 */
export function kiesPostbussen(
  kandidaten: PostbusKandidaat[],
  ik: string,
  toegang: Postbustoegang | null,
  gedeeld: string[],
): Postbus[] {
  const mij = ik.trim().toLowerCase();
  const gedeeldSet = new Set(gedeeld.map((g) => g.trim().toLowerCase()));
  const isEigen = (adres: string) => mij !== "" && adres.trim().toLowerCase() === mij;

  const uit = new Map<string, Postbus>();
  const voegToe = (name: string, emailId: string) => {
    const sleutel = name.trim();
    if (!sleutel || !emailId.trim() || uit.has(sleutel)) return;
    uit.set(sleutel, { name: sleutel, emailId: emailId.trim(), own: isEigen(emailId) });
  };

  if (!toegang) {
    for (const acc of bruikbaar(kandidaten)) {
      if (isEigen(acc.emailId) || gedeeldSet.has(acc.emailId.toLowerCase())) {
        voegToe(acc.name, acc.emailId);
      }
    }
    return gesorteerd(uit);
  }

  for (const rij of toegang.accounts) voegToe(rij.name, rij.emailId);

  if (toegang.alles) {
    for (const acc of bruikbaar(kandidaten)) {
      if (isEigen(acc.emailId) || gedeeldSet.has(acc.emailId.toLowerCase())) {
        voegToe(acc.name, acc.emailId);
      }
    }
  }
  return gesorteerd(uit);
}

/** Accounts met een adres die nog iets doen; een dood account is geen keuze. */
function bruikbaar(kandidaten: PostbusKandidaat[]): { name: string; emailId: string }[] {
  const uit: { name: string; emailId: string }[] = [];
  for (const acc of kandidaten || []) {
    const emailId = String(acc?.emailId || "").trim();
    if (!acc?.name || !emailId) continue;
    if (!acc.enableIncoming && !acc.enableOutgoing) continue;
    uit.push({ name: acc.name, emailId });
  }
  return uit;
}

/** Eigen postbus bovenaan, de rest op adres. */
function gesorteerd(kaart: Map<string, Postbus>): Postbus[] {
  return [...kaart.values()].sort((a, b) => (a.own === b.own
    ? a.emailId.localeCompare(b.emailId)
    : a.own ? -1 : 1));
}
