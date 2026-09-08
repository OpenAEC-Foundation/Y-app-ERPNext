/**
 * Een e-mail klaarmaken om te printen.
 *
 * Waarom niet gewoon `window.print()`: dan komt de hele app op papier — de
 * mappenlijst, de berichtenlijst, de knoppenbalk. En het leespaneel toont de
 * mail in een iframe, dus de kop (van, aan, datum, onderwerp) staat buiten dat
 * frame en zou juist wegvallen. Wat je op papier wilt is precies andersom: die
 * kop, en dan de tekst.
 *
 * Deze module bouwt daarom een compleet HTML-document: kopgegevens plus de
 * inhoud van het bericht. `printDocument` zet dat in een verborgen iframe en
 * laat de browser dát afdrukken — geen nieuw venster, dus geen pop-upblokkade.
 *
 * De opmaak is bewust zuinig: zwart op wit, geen kleurvlakken, geen achtergrond.
 * Een geprinte mail is een archiefstuk, geen schermontwerp.
 */
import { escapeHtml } from "./mail-html.ts";

/** Wat er op papier komt te staan. */
export interface PrintbareMail {
  subject?: string;
  sender?: string;
  senderName?: string;
  recipients?: string;
  cc?: string;
  /** Datum als leesbare tekst; de aanroeper heeft de opmaakregels al. */
  datum?: string;
  /** De inhoud, als HTML. Al gesaneerd door de mailweergave. */
  bodyHtml?: string;
  /** Bestandsnamen van de bijlagen; op papier alleen als opsomming. */
  bijlagen?: string[];
}

/** De labels, zodat deze module zelf niets van vertalen hoeft te weten. */
export interface PrintLabels {
  van: string;
  aan: string;
  cc: string;
  datum: string;
  bijlagen: string;
  zonderOnderwerp: string;
}

/** Eén regel in de kop, of niets als er geen waarde is. */
function regel(label: string, waarde?: string): string {
  const schoon = (waarde ?? "").trim();
  if (!schoon) return "";
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(schoon)}</td></tr>`;
}

/**
 * Bouwt het volledige HTML-document dat geprint wordt.
 *
 * Los van het printen zelf, zodat de opmaak te controleren is zonder browser.
 */
export function buildPrintHtml(mail: PrintbareMail, labels: PrintLabels): string {
  const onderwerp = (mail.subject ?? "").trim() || labels.zonderOnderwerp;
  const afzender = mail.senderName?.trim()
    ? `${mail.senderName.trim()} <${(mail.sender ?? "").trim()}>`
    : (mail.sender ?? "").trim();

  const kop = [
    regel(labels.van, afzender),
    regel(labels.aan, mail.recipients),
    regel(labels.cc, mail.cc),
    regel(labels.datum, mail.datum),
    regel(labels.bijlagen, (mail.bijlagen ?? []).join(", ")),
  ].join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">`
    + `<title>${escapeHtml(onderwerp)}</title><style>`
    + `@page{margin:18mm}`
    + `body{font-family:'Segoe UI',Tahoma,Calibri,sans-serif;font-size:11pt;color:#000;margin:0;line-height:1.45}`
    + `h1{font-size:14pt;margin:0 0 10px 0;line-height:1.3}`
    + `table.kop{border-collapse:collapse;margin:0 0 14px 0;font-size:9.5pt}`
    + `table.kop th{text-align:left;font-weight:600;padding:1px 10px 1px 0;vertical-align:top;white-space:nowrap;width:1%}`
    + `table.kop td{padding:1px 0;vertical-align:top}`
    // De streep scheidt kop en inhoud; verder geen versiering op papier.
    + `hr{border:0;border-top:1px solid #000;margin:0 0 14px 0}`
    + `img{max-width:100%;height:auto}`
    + `table{max-width:100%}`
    + `pre,code{white-space:pre-wrap;word-break:break-word}`
    + `blockquote{border-left:2px solid #999;margin:0 0 10px 0;padding-left:10px;color:#333}`
    // Een link is op papier niets waard als je het adres niet ziet.
    + `a{color:#000;text-decoration:underline}`
    + `a[href^="http"]:after{content:" (" attr(href) ")";font-size:8.5pt;color:#444;word-break:break-all}`
    + `</style></head><body>`
    + `<h1>${escapeHtml(onderwerp)}</h1>`
    + (kop ? `<table class="kop">${kop}</table>` : "")
    + `<hr>`
    + (mail.bodyHtml ?? "")
    + `</body></html>`;
}

/**
 * Print het opgegeven document via een verborgen iframe.
 *
 * Een nieuw venster zou door een pop-upblokkade tegengehouden kunnen worden,
 * en `window.print()` op de pagina zelf drukt de hele app af. Het iframe wordt
 * na afloop weer opgeruimd; blijft het staan bij een fout, dan is het hoogstens
 * een onzichtbaar leeg element.
 *
 * Geeft `false` terug wanneer er geen document is om in te werken (tests,
 * server-rendering) — dan is er niets geprint en hoort de aanroeper dat te
 * weten.
 */
export function printDocument(html: string, doc: Document | undefined = globalThis.document): boolean {
  if (!doc?.body) return false;
  const frame = doc.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  doc.body.appendChild(frame);

  const opruimen = () => {
    // Pas ná het printdialoogvenster; direct weghalen breekt de afdruk af in
    // sommige browsers.
    globalThis.setTimeout(() => frame.remove(), 1000);
  };

  frame.onload = () => {
    try {
      const venster = frame.contentWindow;
      if (!venster) { opruimen(); return; }
      venster.focus();
      venster.print();
    } finally {
      opruimen();
    }
  };

  frame.srcdoc = html;
  return true;
}
