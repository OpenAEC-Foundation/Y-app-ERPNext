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

/** Splits een komma-gescheiden adressenveld; lege entries vallen weg. */
export function splitAddresses(raw: string): MailAddress[] {
  return (raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ raw: part, email: extractEmail(part) }))
    .filter((a) => a.email.length > 0);
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
 * De bijlagen van een doorgestuurd bericht als leesbare opsomming.
 *
 * Doorsturen hangt de originele bestanden **niet** opnieuw aan: die staan als
 * `File` aan de oorspronkelijke Communication en `communication.email.make`
 * accepteert alleen File-docnames van bestanden die je zelf uploadt. In plaats
 * van ze stil te laten verdwijnen noemt de doorstuurtekst ze bij naam, zodat
 * de ontvanger weet wat er ontbreekt en de afzender ze bewust kan bijvoegen.
 */
export function formatAttachmentNames(names: string[]): string {
  return (names || []).map((n) => (n || "").trim()).filter(Boolean).join(", ");
}

/** Of een bijlage in de PDF-viewer van de browser hoort te openen. */
export function isPdfName(name: string): boolean {
  return /\.pdf$/i.test((name || "").trim());
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
