/**
 * Pure opstel-hulpjes voor de Communication-webmail (Y-next).
 *
 * Alles wat "beantwoorden", "allen beantwoorden" en "doorsturen" aan
 * adres-/onderwerp-/handtekeninglogica nodig hebben staat hier, los van React
 * en los van `mail-erpnext.ts`. Reden: dit is precies het soort logica dat
 * stilletjes fout gaat (jezelf in de Cc, `Re: Re: Re:`, een handtekening die
 * twee keer onder een concept belandt) en dat je alleen betrapt met tests.
 * De module doet daarom geen enkele netwerkcall en kent geen vertalingen —
 * de UI-laag levert de teksten aan.
 */

/** Eén adres uit een `To`/`Cc`-string, met en zonder weergavenaam. */
export interface MailAddress {
  /** Zoals het in de header stond, bv. `Piet <piet@3bm.co.nl>`. */
  raw: string;
  /** Alleen het adres, lowercase — de sleutel waarop ontdubbeld wordt. */
  email: string;
}

/**
 * Het bare adres uit een header-entry. `Piet Mol <piet@x.nl>` → `piet@x.nl`;
 * een kale `piet@x.nl` blijft zichzelf. Alles lowercase, want e-mailadressen
 * zijn in de praktijk hoofdletterongevoelig en een vergelijking die dat niet
 * is, zet jezelf alsnog in de Cc.
 */
export function extractEmail(entry: string): string {
  const raw = (entry || "").trim();
  const angled = raw.match(/<([^>]+)>/);
  return (angled ? angled[1] : raw).trim().toLowerCase();
}

/**
 * Splitst een komma-gescheiden adressenveld; lege entries vallen weg.
 *
 * Een komma binnen aanhalingstekens of punthaken scheidt niets: Outlook zet
 * namen als `"Hoeven, Maarten van der" <m.vander.hoeven@vanWijnen.nl>` in de
 * Cc. Op elke komma knippen maakte daar twee "adressen" van, waarvan één
 * (`"Hoeven`) geen adres was. Wat geen @ heeft, telt daarom ook niet mee.
 */
export function splitAddresses(raw: string): MailAddress[] {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  let inAngles = false;
  for (const ch of raw || "") {
    if (ch === '"' && !inAngles) inQuotes = !inQuotes;
    else if (ch === "<" && !inQuotes) inAngles = true;
    else if (ch === ">" && !inQuotes) inAngles = false;
    else if ((ch === "," || ch === ";") && !inQuotes && !inAngles) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ raw: part, email: extractEmail(part) }))
    .filter((a) => a.email.includes("@"));
}

/** Plak adressen weer aan elkaar in de vorm die een `To`-veld verwacht. */
export function joinAddresses(addresses: MailAddress[]): string {
  return addresses.map((a) => a.raw).join(", ");
}

/**
 * Ontdubbel op adres én laat de al gebruikte adressen weg.
 *
 * `exclude` is een set van lowercase adressen: het eigen adres (je mailt
 * jezelf niet) plus alles wat al in het To-veld staat (anders krijgt iemand
 * de mail twee keer).
 */
function dedupe(addresses: MailAddress[], exclude: Set<string>): MailAddress[] {
  const out: MailAddress[] = [];
  const seen = new Set(exclude);
  for (const addr of addresses) {
    if (seen.has(addr.email)) continue;
    seen.add(addr.email);
    out.push(addr);
  }
  return out;
}

export interface ReplySource {
  sender: string;
  recipients?: string;
  cc?: string;
}

export interface ReplyRecipients {
  to: string;
  cc: string;
}

/**
 * De ontvangers van een antwoord.
 *
 * - **Beantwoorden** gaat alleen naar de afzender; een Cc uit het origineel
 *   is bewust weg (dat is wat "alleen de afzender" betekent).
 * - **Allen beantwoorden** zet de afzender plus de oorspronkelijke ontvangers
 *   in het To-veld en de oorspronkelijke Cc in Cc. Het eigen adres valt
 *   overal weg, en een adres dat al in To staat komt niet nog eens in Cc.
 *
 * Zonder bekend eigen adres (`self` leeg) filtert de functie niets weg: dat
 * is beter dan gokken — de gebruiker ziet de adressen in het opstelvenster.
 */
export function buildReplyRecipients(
  msg: ReplySource,
  self: string,
  all: boolean
): ReplyRecipients {
  const selfEmail = extractEmail(self);
  const exclude = new Set<string>(selfEmail ? [selfEmail] : []);

  const sender = splitAddresses(msg.sender);
  if (!all) {
    // Bij een gewoon antwoord mag de afzender nooit wegvallen, ook niet als
    // je jezelf mailt (notitie-aan-mezelf) — anders staat er een leeg To-veld.
    return { to: joinAddresses(sender.length > 0 ? [sender[0]] : []), cc: "" };
  }

  const to = dedupe([...sender, ...splitAddresses(msg.recipients || "")], exclude);
  const toEmails = new Set(to.map((a) => a.email));
  const cc = dedupe(splitAddresses(msg.cc || ""), new Set([...exclude, ...toEmails]));
  return { to: joinAddresses(to), cc: joinAddresses(cc) };
}

/**
 * `Re: ` / `Fwd: ` — maar nooit gestapeld. Zowel de Nederlandse (`Antw:`,
 * `Doorgestuurd:`) als de Engelse en Duitse (`AW:`) varianten tellen als
 * "zit er al op", want een mailwisseling loopt zelden in één taal.
 */
export function prefixSubject(subject: string, prefix: "Re" | "Fwd"): string {
  const clean = (subject || "").trim();
  const re = prefix === "Re" ? /^(re|antw|aw)\s*:/i : /^(fwd?|doorgestuurd|wg)\s*:/i;
  if (!clean) return `${prefix}:`;
  return re.test(clean) ? clean : `${prefix}: ${clean}`;
}

/**
 * Zet de handtekening onder de getypte tekst.
 *
 * Idempotent op de handtekening zelf: staat hij er al in (bv. omdat het
 * concept opnieuw wordt opgebouwd na een adreswijziging), dan komt hij er
 * geen tweede keer bij. Een lege handtekening laat de body ongemoeid — dat is
 * het normale geval voor een gebruiker zonder leesrecht op `Email Account`.
 */
export function appendSignature(html: string, signature: string): string {
  const sig = (signature || "").trim();
  if (!sig) return html;
  if (html.includes(sig)) return html;
  return `${html}<br><br>${sig}`;
}

/**
 * De handtekening zoals hij voor **dit** bericht geldt.
 *
 * Het opstelvenster toont de handtekening live onder het typveld en heeft een
 * schakelaar om hem voor één bericht weg te laten. Zowel die preview als het
 * verzendpad leiden hun inhoud van deze functie af — één bron van waarheid,
 * zodat wat de gebruiker ziet ook is wat er verstuurd wordt. Zonder deze
 * gedeelde afleiding is de klassieke fout: preview uit, maar de verzendcode
 * plakt hem alsnog aan (of andersom).
 */
export function effectiveSignature(signature: string, include: boolean): string {
  if (!include) return "";
  return (signature || "").trim();
}

export interface OutgoingHtmlInput {
  /** Wat de gebruiker typte, al omgezet naar HTML. */
  bodyHtml: string;
  /** De volledige handtekening-HTML (leeg = de gebruiker heeft er geen). */
  signature: string;
  /** Staat de handtekening-schakelaar aan voor dit bericht? */
  includeSignature: boolean;
  /** Geciteerde originele mail (HTML); leeg bij een nieuw bericht. */
  quoteHtml?: string;
  /**
   * De huisstijl als inline CSS (`lib/mailOpmaak`). Leeg laten betekent: geen
   * eigen opmaak meegeven, dan kiest het mailprogramma van de ontvanger zelf.
   */
  opmaakStijl?: string;
}

/**
 * De volledige HTML-body van een uitgaand bericht.
 *
 * Volgorde is die van elke mailclient: getypte tekst → handtekening → citaat.
 * De handtekening gaat dus **boven** het citaat, niet helemaal onderaan, want
 * anders staat hij bij een lange draad buiten beeld. `appendSignature` houdt
 * het idempotent: een handtekening die al in de body staat komt er niet nog
 * eens bij.
 */
export function buildOutgoingHtml(input: OutgoingHtmlInput): string {
  const typed = appendSignature(
    input.bodyHtml,
    effectiveSignature(input.signature, input.includeSignature)
  );
  const quote = (input.quoteHtml || "").trim();
  const body = quote
    ? `${typed}<br><br><blockquote style="border-left:2px solid #cbd5e1;margin:0;padding-left:12px;color:#475569">${quote}</blockquote>`
    : typed;
  return omhulMetHuisstijl(body, input.opmaakStijl);
}

/**
 * De huisstijl als één omhullende `div`.
 *
 * Inline en niet als stylesheet: een mailprogramma gooit een `<style>`-blok
 * weg, maar een `style`-attribuut overleeft. Eromheen en niet per alinea,
 * zodat wat de gebruiker zelf aan opmaak koos (een kleur, een grootte) er
 * bovenop blijft staan in plaats van overschreven te worden.
 *
 * Het citaat zit er bewust ín: een antwoord dat in een ander lettertype staat
 * dan de mail eronder leest als twee losse berichten.
 */
function omhulMetHuisstijl(html: string, stijl?: string): string {
  const schoon = (stijl || "").trim();
  if (!schoon) return html;
  return `<div style="${schoon}">${html}</div>`;
}

/**
 * Bijlagenamen als leesbare opsomming, voor een melding of een printkop.
 *
 * Hier stond ooit bij dat doorsturen de originele bestanden niet mee kón
 * nemen, omdat `communication.email.make` alleen File-docnames van zelf
 * geüploade bestanden zou aannemen. Dat klopt niet — die aanroep neemt de
 * docnaam van elk `File` aan — en die aanname was de reden dat een
 * doorgestuurde mail zonder bijlage aankwam. Het meenemen zelf staat nu in
 * `lib/mail-doorsturen.ts`.
 */
export function formatAttachmentNames(names: string[]): string {
  return (names || []).map((n) => (n || "").trim()).filter(Boolean).join(", ");
}

/** Of een bijlage in de PDF-viewer van de browser hoort te openen. */
export function isPdfName(name: string): boolean {
  return /\.pdf$/i.test((name || "").trim());
}

/**
 * Of een bijlage een bouwmodel is dat naast de mail te bekijken valt.
 *
 * Alleen IFC zelf. `.ifczip` is een gecomprimeerd model dat eerst uitgepakt
 * moet worden en dat kan de viewer hier niet; die bijlage blijft dus een
 * gewone download in plaats van een knop die niets doet.
 */
export function isIfcName(name: string): boolean {
  return /\.ifc$/i.test((name || "").trim());
}

/**
 * Voorvalidatie van een mapnaam, zodat de UI een nette melding kan tonen in
 * plaats van de rejected promise van de adapter op te vangen.
 *
 * Dezelfde twee regels als `mail-erpnext.ts`: niet leeg en geen komma
 * (`_user_tags` is komma-gescheiden, dus een komma splitst de map in tweeën
 * en maakt hem onvindbaar). Bewust hier gedupliceerd in plaats van
 * geïmporteerd: de adapter gooit, de UI wil een booleaans antwoord vóór de
 * call.
 */
export function isValidFolderLabel(label: string): boolean {
  const trimmed = (label || "").trim();
  return trimmed.length > 0 && !trimmed.includes(",");
}
