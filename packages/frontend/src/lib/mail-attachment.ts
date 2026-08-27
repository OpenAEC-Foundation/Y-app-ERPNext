/**
 * Openen van een e-mailbijlage (een ERPNext `File` aan een Communication).
 *
 * Drie dingen die niet vanzelfsprekend zijn:
 *
 * 1. **`window.open(url, target, "noopener")` geeft ALTIJD `null` terug.**
 *    Dat is geen popup-blokkade maar de HTML-spec: zodra `noopener` in de
 *    feature-string staat, eindigt het `window.open`-algoritme met "return
 *    null" — het tabblad gáát open, je krijgt er alleen geen handle op. Wie
 *    die `null` als "popup geblokkeerd" leest, meldt dus een fout terwijl er
 *    net een leeg tabblad is opengeklapt, en navigeert het nooit ergens
 *    heen. Precies dat was de oorzaak van "PDF openen werkt niet": een blanco
 *    tabblad plus de melding "PDF openen mislukt". Live geverifieerd in
 *    Chromium: `window.open("", "_blank", "noopener")` → `null` + een
 *    `about:blank`-popup; zonder `noopener` → een bruikbare handle.
 *
 *    `noopener` weglaten is hier veilig: het doel is een bestand op onze
 *    **eigen origin** (Y-next draait op de ERPNext-site zelf), dus er is geen
 *    vreemde partij die een `opener`-handle zou kunnen misbruiken.
 *
 * 2. **Het tabblad moet SYNCHROON binnen de klik open.** De toegangscontrole
 *    hieronder is een netwerkcall, en een `window.open` ná een `await` valt
 *    buiten de user-activation van de klik → dán slaat de popup-blokkade wél
 *    echt toe. Vandaar de volgorde: eerst het lege tabblad, dan pas het
 *    async werk, dan navigeren.
 *
 * 3. **De toegangscontrole is een `HEAD`, geen download.** Bijlagen zijn
 *    privé-Files (`/private/files/...`); zonder geldige sessie antwoordt
 *    Frappe met 403. Zou je zonder controle navigeren, dan krijgt de
 *    gebruiker Frappe's kale HTML-foutpagina in een nieuw tabblad en weet de
 *    app van niets. Met een `HEAD` weten we het vóór de navigatie en kan de
 *    UI een echte melding tonen (403 → `permission-error.ts`). Het scheelt
 *    ook het bestand zelf ophalen: live geverifieerd op de doelinstance dat
 *    `HEAD /private/files/<pdf>` 200 + `content-type: application/pdf`
 *    teruggeeft mét sessie en 403 zonder — en géén body.
 *
 *    Bewust géén blob-URL als tussenstap: dan zou een bouwtekening van
 *    tientallen MB's eerst volledig in het geheugen moeten, en toont de
 *    PDF-viewer een UUID in plaats van de bestandsnaam. Rechtstreeks
 *    navigeren houdt de native viewer, de streaming en de echte naam intact.
 */

import { ApiError, getFileUrl } from "./erpnext.ts";

export interface MailAttachmentRef {
  file_url: string;
  file_name: string;
}

/**
 * Het handvat op een net geopend, nog leeg tabblad. Geabstraheerd zodat de
 * tests de volgorde (synchroon openen → controleren → navigeren/sluiten)
 * kunnen vastleggen zonder browser.
 */
export interface BlankTab {
  navigate(url: string): void;
  close(): void;
}

export interface AttachmentIo {
  /** Opent synchroon een leeg tabblad; `null` = écht door de blokkade tegengehouden. */
  openBlankTab(): BlankTab | null;
  /** Toegangscontrole op de bijlage-URL. Gooit een `ApiError` als het niet mag. */
  checkAccess(url: string): Promise<void>;
  /** Start een gewone browserdownload van een same-origin URL. */
  startDownload(url: string, fileName: string): void;
}

/** Wat er met de klik gebeurd is — de UI meldt het tweede geval aan de gebruiker. */
export type AttachmentOpenOutcome = "opened" | "downloaded";

/**
 * Toegangscontrole op een bijlage: `HEAD` met de sessiecookie.
 *
 * Netwerkfouten worden bewust vertaald naar een `ApiError(0, …)` en niet
 * doorgegooid als kale `TypeError: Failed to fetch`: de UI toont deze tekst
 * en "Failed to fetch" vertelt een gebruiker niets.
 */
async function headCheck(url: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { method: "HEAD", credentials: "same-origin" });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new ApiError(0, `Bijlage niet bereikbaar: ${detail}`);
  }
  if (res.ok) return;
  // 403 komt hier langs als een echte 403-status, zodat `isPermissionError`
  // hem herkent zonder op de tekst te hoeven matchen.
  throw new ApiError(
    res.status,
    res.status === 403
      ? "No permission to read this attachment"
      : `Bijlage ophalen mislukt (HTTP ${res.status})`,
  );
}

/** De echte browser-implementatie; tests injecteren hun eigen variant. */
export const browserAttachmentIo: AttachmentIo = {
  openBlankTab() {
    // Zie punt 1 in de kop: GEEN "noopener" — die maakt de returnwaarde null.
    const tab = window.open("", "_blank");
    if (!tab) return null;
    return {
      navigate(url: string) {
        tab.location.href = url;
      },
      close() {
        // Sluiten kan al gebeurd zijn doordat de gebruiker het lege tabblad
        // wegklikte terwijl de controle liep. Dat is geen foutsituatie om te
        // melden — de melding over de oorzaak volgt sowieso in het hoofdvenster.
        try {
          tab.close();
        } catch {
          /* tabblad bestond al niet meer */
        }
      },
    };
  },
  checkAccess: headCheck,
  startDownload(url: string, fileName: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
};

/**
 * Open een bijlage in een eigen tabblad.
 *
 * Gooit bij een toegangs-, netwerk- of serverfout, zodat de aanroeper hem
 * zichtbaar kan melden — er is hier geen stille `catch`. Levert
 * `"downloaded"` op wanneer de popup écht geblokkeerd was: dan is downloaden
 * de enige overgebleven route en moet de UI dat zeggen, anders lijkt de klik
 * niets gedaan te hebben.
 */
export async function openAttachmentInTab(
  att: MailAttachmentRef,
  io: AttachmentIo = browserAttachmentIo,
): Promise<AttachmentOpenOutcome> {
  const url = getFileUrl(att.file_url);
  // Synchroon, vóór élke await — zie punt 2 in de kop.
  const tab = io.openBlankTab();
  try {
    await io.checkAccess(url);
  } catch (err) {
    tab?.close();
    throw err;
  }
  if (!tab) {
    io.startDownload(url, att.file_name);
    return "downloaded";
  }
  tab.navigate(url);
  return "opened";
}

/**
 * Controleer of een bijlage bereikbaar is, zonder hem te openen.
 *
 * Gebruikt naast de gewone `<a>`-links (afbeeldingen, Office-bestanden en de
 * downloadknop): die doen hun werk native — het tabblad of de download start
 * via de standaardactie van de link, dus daar valt niets te blokkeren of te
 * timen. Deze controle loopt er alleen náást mee om een 403 in de app te
 * kunnen melden in plaats van de gebruiker met Frappe's foutpagina of een
 * mislukte download in de downloadbalk achter te laten.
 */
export async function checkAttachmentAccess(
  att: MailAttachmentRef,
  io: AttachmentIo = browserAttachmentIo,
): Promise<void> {
  await io.checkAccess(getFileUrl(att.file_url));
}
