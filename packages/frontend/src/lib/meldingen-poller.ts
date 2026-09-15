import i18n from "../i18n/index";
import { setBadgeCount } from "./badges";
import { showWebNotification, requestNotifyPermissionOnce } from "./notify";
import { setAppIconBadge } from "./app-badge";
import { unseenCount } from "./mail-erpnext";
import { ongelezenBerichten } from "./messages-erpnext";
import { resolvePostbustoegang } from "./session";
import { isFeatureEnabled } from "./capabilities";
import { bepaalMelding, vatOngelezenSamen, type Meldingstand } from "./meldingen";
import { playNotificationSound } from "./notify-sound";
import { toonMelding } from "./melding-popup";

/**
 * Kijken of er nieuwe post of nieuwe berichten zijn — op Y-Next.
 *
 * De bestaande meldingen (`BackgroundSyncProvider`) hangen aan
 * `/api/mail/unseen-summary` en `/api/messenger/all-conversations`: routes van
 * de Express-server die op deze installatie niet bestaat. Op Y-Next werd er dus
 * nooit iets gemeld, en stond de teller in de zijbalk alleen goed zolang je het
 * scherm zelf openhad. Deze poller telt hetzelfde uit ERPNext zelf.
 *
 * Twee keuzes:
 *
 * - **Pollen, geen socket.** Y-Next is een Frappe Web Page; het realtime-kanaal
 *   van Frappe hangt aan de desk-bundel. Twee tellingen per minuut is wat het
 *   kost, en dat is ruim binnen wat de rest van de app al doet.
 * - **Niet tellen op het scherm dat er zelf over gaat.** Staat de mail open, dan
 *   houdt dat scherm zijn eigen teller bij — en die loopt vóór op de server
 *   zodra je een bericht opent. Een poller die er dwars doorheen telt zet de
 *   badge terug op een getal dat de gebruiker net heeft weggeklikt.
 */

/**
 * Hoe vaak we kijken. Post mag een minuut wachten; een bericht van een collega
 * niet — dat is een gesprek, en twintig seconden is wat het berichtenscherm
 * zelf ook aanhoudt.
 */
const POST_MS = 60_000;
const BERICHT_MS = 20_000;

let standMail: Meldingstand = null;
let standBericht: Meldingstand = null;
let mailBadge = 0;
let berichtBadge = 0;

/** Staat het scherm open dat hier zelf over gaat? Dan niet meetellen. */
function staatOpen(deel: string): boolean {
  if (typeof window === "undefined") return false;
  return (window.location.hash || "").startsWith(`#/${deel}`);
}

function appBadge(): void {
  setAppIconBadge(Math.max(0, mailBadge) + Math.max(0, berichtBadge));
}

/**
 * Ongelezen post in je eigen postbussen bij elkaar.
 *
 * Nadrukkelijk per postbus en niet in één telling zonder filter: wie System
 * Manager is mag álle Communications lezen, en dan telt een filterloze telling
 * de ongelezen post van het hele bedrijf mee — bijna duizend stuks, met een
 * melding bij elke mail aan wie dan ook. Lukt het bepalen van de postbussen
 * niet, dan tellen we liever niets dan het verkeerde.
 */
async function ongelezenPost(): Promise<number | null> {
  const toegang = await resolvePostbustoegang();
  const postbussen = toegang?.accounts ?? [];
  if (postbussen.length === 0) return null;
  const per = await Promise.all(postbussen.map((p) => unseenCount(p.name)));
  return per.reduce((som, n) => som + (n || 0), 0);
}

async function kijkNaarPost(): Promise<void> {
  if (staatOpen("webmail")) return;
  const aantal = await ongelezenPost();
  if (aantal === null) return;
  setBadgeCount("webmail", aantal);
  mailBadge = aantal;
  appBadge();
  const uit = bepaalMelding(standMail, aantal);
  standMail = uit.stand;
  if (!uit.melden) return;
  showWebNotification({
    title: uit.nieuw === 1
      ? i18n.t("notify.new_mail_one")
      : i18n.t("notify.new_mail_many", { count: uit.nieuw }),
    body: i18n.t("notify.new_mail_body"),
    tag: "y-next-mail",
    navigateTo: "/y-next#/webmail",
  });
}

async function kijkNaarBerichten(): Promise<void> {
  if (!isFeatureEnabled("erpnext-messages")) return;
  if (staatOpen("messenger")) return;
  const rijen = await ongelezenBerichten();
  const samen = vatOngelezenSamen(rijen);
  setBadgeCount("messenger", samen.aantal);
  berichtBadge = samen.aantal;
  appBadge();
  const uit = bepaalMelding(standBericht, samen.aantal);
  standBericht = uit.stand;
  if (!uit.melden) return;

  const titel = samen.van
    ? i18n.t("notify.new_message_from", { naam: samen.van })
    : i18n.t("notify.new_message_one");

  /*
   * Drie signalen, want ze vangen elk een ander moment op. De teller in de
   * zijbalk voor wie er later langs komt, het geluid en de strook in het
   * scherm voor wie in de app bezig is, en de vensternotificatie voor wie op
   * een ander tabblad zit. Die laatste toont zichzelf niet wanneer het scherm
   * zichtbaar is — daarom is dat niet genoeg, en was er tot nu toe niets te
   * merken van een binnenkomend bericht terwijl je in de app zat.
   */
  playNotificationSound();
  toonMelding({
    soort: "bericht",
    titel,
    tekst: samen.tekst || i18n.t("notify.new_message_body"),
    naar: "#/messenger",
  });
  showWebNotification({
    title: titel,
    body: samen.tekst || i18n.t("notify.new_message_body"),
    tag: "y-next-bericht",
    navigateTo: "/y-next#/messenger",
    // Het geluid is hierboven al gespeeld; twee chimes voor één bericht.
    sound: false,
  });
}

let loopt = false;

/**
 * Begin met kijken. Idempotent: een tweede aanroep doet niets, zodat een
 * herrenderde App niet twee pollers achterlaat.
 */
export function startMeldingen(): void {
  if (loopt || typeof window === "undefined") return;
  loopt = true;
  requestNotifyPermissionOnce();

  const ronde = () => {
    void kijkNaarPost().catch(() => { /* netwerkhapering — volgende ronde weer */ });
    void kijkNaarBerichten().catch(() => { /* idem */ });
  };

  ronde();
  window.setInterval(() => {
    void kijkNaarPost().catch(() => {});
  }, POST_MS);
  window.setInterval(() => {
    void kijkNaarBerichten().catch(() => {});
  }, BERICHT_MS);
  // Terug op het tabblad is het moment waarop je het wilt weten.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ronde();
  });
}
