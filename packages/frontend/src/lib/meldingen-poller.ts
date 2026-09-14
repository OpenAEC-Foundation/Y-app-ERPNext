import i18n from "../i18n/index";
import { setBadgeCount } from "./badges";
import { showWebNotification, requestNotifyPermissionOnce } from "./notify";
import { setAppIconBadge } from "./app-badge";
import { unseenCount } from "./mail-erpnext";
import { ongelezenBerichten } from "./messages-erpnext";
import { resolvePostbustoegang } from "./session";
import { isFeatureEnabled } from "./capabilities";
import { bepaalMelding, type Meldingstand } from "./meldingen";

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

/** Hoe vaak we kijken. Post is geen chat; een minuut is snel genoeg. */
const INTERVAL_MS = 60_000;

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
  const aantal = await ongelezenBerichten();
  setBadgeCount("messenger", aantal);
  berichtBadge = aantal;
  appBadge();
  const uit = bepaalMelding(standBericht, aantal);
  standBericht = uit.stand;
  if (!uit.melden) return;
  showWebNotification({
    title: uit.nieuw === 1
      ? i18n.t("notify.new_message_one")
      : i18n.t("notify.new_message_many", { count: uit.nieuw }),
    body: i18n.t("notify.new_message_body"),
    tag: "y-next-bericht",
    navigateTo: "/y-next#/messenger",
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
  window.setInterval(ronde, INTERVAL_MS);
  // Terug op het tabblad is het moment waarop je het wilt weten.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ronde();
  });
}
