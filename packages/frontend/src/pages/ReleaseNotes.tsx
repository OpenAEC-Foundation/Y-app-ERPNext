import { useState, useEffect } from "react";
import { RefreshCw, ExternalLink, Tag } from "lucide-react";
import { APP_VERSION, APP_NAME } from "../lib/version";
import { useTranslation } from "react-i18next";

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
}

// Fallback local releases (used when GitHub is unreachable). Newest first.
const LOCAL_RELEASES = [
  {
    version: "0.31.0",
    date: "2026-07-06",
    url: "",
    sections: [
      {
        title: "Meldingen",
        items: [
          "Geluidssignaal bij nieuwe e-mail én chatberichten, plus een teller op het app-icoon (Windows-taskbar / geïnstalleerde web-app) met het totaal ongelezen. Werkt op de desktop en het web.",
          "Op de desktop krijg je nu ook een melding bij nieuwe chatberichten wanneer je niet in Berichten zit (voorheen alleen voor e-mail).",
        ],
      },
      {
        title: "E-mail",
        items: [
          "Elke map in de mappenlijst toont nu een ongelezen-teller (ook Ongewenst/Junk). Het navigatiemenu blijft alleen de inbox tellen.",
          "Nieuwe mail en beantwoorden verschijnen nu in het leespaneel zelf, in plaats van een zwevend venster dat je moest verslepen.",
          "Verzonden-/Verwijderde-items-map-instelling werkt nu per account (werd niet altijd toegepast).",
          "Los mailvenster (dubbelklik): opent weer correct (geen 'Missing uid' meer), start sneller, en de mailtekst scrolt nu volledig door.",
        ],
      },
      {
        title: "Desktop-app (Windows)",
        items: [
          "Verzonden mail wordt nu bewaard in de map Verzonden, en verwijderen gaat naar de prullenbak in plaats van definitief weg (geen onbedoeld dataverlies meer).",
          "PDF-bijlagen openen nu als preview, net als op het web (voorheen werden ze stil gedownload).",
          "Bijlagen worden lokaal onthouden zodat ze de tweede keer direct openen.",
        ],
      },
      {
        title: "NAS / projectmappen",
        items: [
          "Medewerkers krijgen nu de door de werkgever ingestelde NAS-mapsjabloon (mapnaam en submap) — voorheen kwam die instelling niet bij ze aan.",
          "Bij het aanmaken van een projectmap toont het volgnummer-veld 'scant…' tijdens het laden, in plaats van een misleidende '1'.",
        ],
      },
    ],
  },
  {
    version: "0.29.0",
    date: "2026-07-03",
    url: "",
    sections: [
      {
        title: "Desktop-app (Windows)",
        items: [
          "Mail verslepen werkt weer: je kunt e-mails nu naar een map slepen. In de Windows-app ving het venster de sleep-actie op, waardoor het naar mappen slepen niet aankwam.",
          "Map verwijderen werkt: via rechtermuisklik op een map → 'Map verwijderen' (gaf voorheen een foutmelding op de desktop).",
          "Notificaties bij nieuwe e-mail: de app controleert op de achtergrond op nieuwe mail en toont een Windows-melding. Voorheen kreeg je op de desktop geen enkele mail-notificatie.",
        ],
      },
      {
        title: "Notificaties (web)",
        items: [
          "Je krijgt nu een browser-notificatie bij nieuwe e-mail wanneer het tabblad niet actief is; erop klikken opent Webmail.",
          "Een berichten-notificatie aanklikken opent voortaan de app op het juiste scherm.",
        ],
      },
      {
        title: "Instellingen",
        items: [
          "Medewerkers kunnen nu zelf hun NAS-map per bedrijf instellen (Instellingen → Algemeen), voor het opslaan van mailbijlages en het aanmaken van projectmappen. Voorheen zat dit achter de werkgever-only tab. Het gedeelde beleid (mapnaam-sjabloon en projectmappen-instellingen) blijft bij de werkgever.",
        ],
      },
    ],
  },
  {
    version: "0.28.10",
    date: "2026-07-01",
    url: "",
    sections: [
      {
        title: "Desktop-app",
        items: [
          "Berichtenlijst laadt weer bij mails met complexe bijlagen: één doorgestuurde e-mail met ingesloten afbeeldingen liet de hele map met 'E-mail kon niet worden geladen' falen. De mappenlijst werkte al; nu de berichten ook.",
          "E-mailaccount bewerken toonde een leeg formulier (geen velden) — de velden verschijnen nu weer, ook voor bestaande accounts.",
          "Mappenlijst laadt veel sneller: de app haalde bij het openen voor élke (sub)map een ongelezen-telling op, wat bij veel projectmappen traag was en het doorklikken blokkeerde. Nu alleen voor INBOX en hoofdmappen.",
          "Offline-cache-instelling toegevoegd in Instellingen → Email accounts: kies hoeveel dagen mail lokaal bewaard wordt (voorheen op de desktop niet te vinden).",
          "Mail openen op de desktop: dubbelklik opent nu in het leespaneel (het losse-tabblad werkte niet in de desktop-app).",
          "Afbeeldingen in e-mails worden nu getoond op de desktop: inline-afbeeldingen (logo's, handtekeningen) worden direct in het bericht ingebed.",
          "Mail opent sneller: de conversatie-weergave boven een bericht werd veel te zwaar opgehaald (~1s, met een volledige mappenlijst-scan + volledige body per thread-lid). Nu een lichte header-scan — een fractie van de tijd.",
          "Wisselen naar e-mail voelt sneller: de mappenlijst wordt kort gecached, zodat 'ie niet bij elke tab-wissel opnieuw volledig wordt opgehaald.",
          "NextCloud Talk opent sneller: een gesprek opent nu direct (de vaste 250ms-vertraging bij aanklikken is weg), de gebruikers-id wordt gecached (scheelt een extra netwerk-call per open), en afbeeldingsvoorbeelden worden parallel én compacter (300px) opgehaald.",
          "Grote e-mailbijlagen openen sneller: de bijlage werd intern twee keer gedownload; nu nog maar één keer.",
          "E-mailhandtekening zelf instellen: bij Instellingen → Email accounts kun je nu per account een HTML-handtekening opgeven (met inline base64-afbeeldingen die meegestuurd worden). Die wordt in je uitgaande mail gebruikt en overschrijft de handtekening uit ERPNext.",
          "Verzonden- en Verwijderde-items-map kies je nu ook bij Instellingen → Email accounts (voorheen alleen via rechtermuisklik op een map in Webmail).",
          "Alle e-mailinstellingen staan nu per account: bij Instellingen → Email accounts klap je een account open voor zijn eigen handtekening, offline-cache-venster en Verzonden-/Verwijderde-map.",
          "Projectmappen-NAS: een 'Bladeren'-knop achter de master- en doelmap om de map met een mapdialoog te kiezen (desktop).",
          "Projectmap openen: zowel de map-knop in de projectenlijst als 'Open in Verkenner' in het projectdetail openen nu dezelfde projectmap rechtstreeks in Windows Verkenner (voorheen werd het pad alleen naar het klembord gekopieerd).",
        ],
      },
      {
        title: "Webmail",
        items: [
          "Sorteer in projectmap (bulk): selecteer meerdere mails en laat de app per mail een bestaande projectmap voorstellen — inbox-mail naar een INBOX-submap, verzonden mail naar een Sent-submap. Bestaat er nog geen map voor het herkende project, dan kun je 'm direct laten aanmaken en de mail erin verplaatsen. (Nieuw in deze versie; nog niet uitgebreid live getest.)",
        ],
      },
    ],
  },
  {
    version: "0.28.9",
    date: "2026-07-01",
    url: "",
    sections: [
      {
        title: "Desktop-app",
        items: [
          "E-mailaccount toevoegen werkt weer: het wachtwoord werd door een fout leeg opgeslagen, waardoor elke account faalde met 'Authentication failed'. Voeg je account opnieuw toe met dezelfde instellingen als in de webversie.",
          "Na het toevoegen kun je met 'Test verbinding' meteen controleren of de account werkt.",
        ],
      },
    ],
  },
  {
    version: "0.28.8",
    date: "2026-06-30",
    url: "",
    sections: [
      {
        title: "Desktop-app",
        items: [
          "Niet meer elke keer inloggen: zet 'Onthoud op dit apparaat' aan bij het ontgrendelen, dan opent de app voortaan vanzelf — geen wachtwoord meer typen.",
          "Projectmappen op de NAS aanmaken: met de knop 'Maak NAS-mappen aan' op een project wordt je standaard mappenstructuur gekopieerd en hernoemd. Stel de master-map, doel-locatie en mapnaam in bij Instellingen → Project-instellingen. Met 'Open in Verkenner' spring je direct naar de projectmap.",
          "NextCloud Talk: gesprekken die je in NextCloud hebt vastgezet staan nu bovenaan (zoals in de webversie).",
          "Je automatisch uit ERPNext geladen e-mailaccount is nu zichtbaar in Instellingen → Email accounts.",
        ],
      },
    ],
  },
  {
    version: "0.28.7",
    date: "2026-06-30",
    url: "",
    sections: [
      {
        title: "Desktop-app",
        items: [
          "NextCloud Talk in de desktop-app: de datum in de gesprekkenlijst klopt nu (geen 'Invalid Date' meer), en afbeeldingen in gesprekken worden weer getoond.",
        ],
      },
    ],
  },
  {
    version: "0.28.6",
    date: "2026-06-29",
    url: "",
    sections: [
      {
        title: "Desktop-app",
        items: [
          "NextCloud Talk in de desktop-app is gelijkgetrokken met de webversie: datum/tijd klopt weer, afbeeldingen tonen een voorbeeld, je eigen berichten staan rechts, en reacties/replies/bewerkt-verwijderd worden correct weergegeven.",
        ],
      },
    ],
  },
  {
    version: "0.28.5",
    date: "2026-06-29",
    url: "",
    sections: [
      {
        title: "Desktop-app",
        items: [
          "E-mailaccounts beheren werkt nu in de desktop-app (toevoegen, bewerken, verwijderen) — voorheen gaf opslaan een fout.",
          "De factuur-verzendinstellingen (sjabloon, standaard CC/BCC) worden nu ook naar de desktop-app gesynchroniseerd.",
        ],
      },
    ],
  },
  {
    version: "0.28.4",
    date: "2026-06-29",
    url: "",
    sections: [
      {
        title: "Desktop-app",
        items: [
          "De werkgever-instellingen (medewerker-, project- en activiteit-instellingen) worden nu correct in de desktop-app getoond — ze werden eerder stil genegeerd.",
          "NextCloud Talk werkt nu in de desktop-app: gesprekken laden, openen en versturen. (Reacties, bewerken/verwijderen en uploads volgen later.)",
        ],
      },
    ],
  },
  {
    version: "0.28.3",
    date: "2026-06-29",
    url: "",
    sections: [
      {
        title: "Desktop-app",
        items: [
          "E-mail werkt nu in de desktop-app: de IMAP/SMTP-instellingen worden automatisch uit ERPNext opgehaald en lokaal in de kluis bewaard — geen handmatige instellingen meer nodig.",
          "De laatste 30 dagen e-mail worden nu ook op de desktop vooraf lokaal opgeslagen, zodat berichten direct en offline te openen zijn (net als in de webversie).",
        ],
      },
      {
        title: "Berichten",
        items: [
          "NextCloud Talk werkt nu ook in een als app geïnstalleerde Y-app (bijv. via Edge), waar voorheen 'Missende credentials' verscheen ondanks juiste instellingen.",
        ],
      },
    ],
  },
  {
    version: "0.28.2",
    date: "2026-06-28",
    url: "",
    sections: [
      {
        title: "Desktop-app",
        items: [
          "Werkgevers zien weer alle modules in de desktop-app (administratieve modules ontbraken doordat de rollen niet werden opgehaald).",
          "Medewerker- en projectinstellingen worden nu van de server geladen en lokaal bewaard, zodat de desktop-app ze toont én offline blijft werken.",
        ],
      },
    ],
  },
  {
    version: "0.28.1",
    date: "2026-06-27",
    url: "",
    sections: [
      {
        title: "Desktop-app",
        items: [
          "Instellingen werken weer in de desktop-app: de tabbladen sprongen terug naar het beginscherm, nu openen ze normaal (en werknemers zien alleen hun eigen instellingen).",
          "Je krijgt voortaan een melding in de app zodra er een nieuwe versie beschikbaar is, met een knop naar de downloadpagina (waar je ook een oudere versie kunt ophalen).",
        ],
      },
    ],
  },
  {
    version: "0.28.0",
    date: "2026-06-27",
    url: "",
    sections: [
      {
        title: "Mail — bijlagen",
        items: [
          "Bijlagen versturen werkt weer met grotere bestanden: de fout 'Maximum call stack size exceeded' bij bestanden groter dan ~60 KB is opgelost.",
          "In een losgekoppeld mailvenster (apart tabblad) kun je bijlagen weer openen en downloaden — eerder gaf dat een rechten-/foutmelding.",
        ],
      },
      {
        title: "Mail — mappen",
        items: [
          "Je kunt nu in de e-mailinstellingen zelf kiezen welke map 'Verzonden' en welke 'Verwijderd' is. Handig bij dubbele mappen (bv. 'Verzonden items' naast 'Sent Items') na een overstap van mailserver. De keuze synct over je apparaten.",
        ],
      },
      {
        title: "NAS — bijlagen opslaan",
        items: [
          "Medewerkers kunnen nu zelf hun NAS-map kiezen, rechtstreeks in het 'Opslaan op NAS'-venster. Voorheen kon dat alleen de werkgever in de instellingen.",
        ],
      },
      {
        title: "Agenda — uitnodigingen",
        items: [
          "Maak je een afspraak met deelnemers, dan ontvangen zij nu een échte agenda-uitnodiging (met accepteren/weigeren) die in hun agenda verschijnt — in plaats van een gewoon mailtje.",
          "Pas je de afspraak later aan, dan wordt de uitnodiging bijgewerkt in de agenda van de deelnemers.",
          "Het uitnodigen-veld heeft nu dezelfde contactsuggesties als bij e-mail.",
        ],
      },
      {
        title: "Desktop-app",
        items: [
          "De desktop-/Android-build is gerepareerd (faalde sinds eind mei), zodat er weer installers gebouwd kunnen worden.",
        ],
      },
    ],
  },
  {
    version: "0.26.0",
    date: "2026-06-18",
    url: "",
    sections: [
      {
        title: "Mail — sneller, offline en stabieler",
        items: [
          "De volledige inhoud van je mail van de laatste 30 dagen wordt lokaal opgeslagen — recente mails (ook in submappen) openen daardoor direct en zelfs offline. Instelbaar per apparaat in de e-mailinstellingen, met een indicator van de opslaggrootte.",
          "Mail laadt weer stabiel: een reeks verbindings- en performance-fixes dempt verzoek-stormen, vangt de IMAP-snelheidslimiet van de mailserver netjes op (backoff) en voorkomt een verbindings-piek bij het opnieuw verbinden (na slaapstand/netwerkwissel). Eerder kon de mailbox daardoor 'vastlopen'.",
          "PDF-bijlagen openen fullscreen in een nieuw tabblad (volledige viewer met zoom/roteren/print). Bijlagen worden bij openen lokaal bewaard, dus de tweede keer openen is instant en werkt offline.",
        ],
      },
      {
        title: "Mail — verzenden en Verzonden-map",
        items: [
          "Verzonden mail belandt nu in je Verzonden-map. Heeft je server meerdere 'Verzonden'-achtige mappen, dan kun je via rechtermuis op een map 'Als Verzonden-map instellen' de juiste kiezen. Lukt het opslaan niet, dan krijg je nu een melding in plaats van stilte.",
          "Versturen werkt weer, ook als je mailhost directe verzending vanaf de server blokkeert: Y-app valt dan automatisch terug op verzenden via ERPNext.",
          "Eigen IMAP-accounts (los van ERPNext/Office 365) worden ondersteund; je e-mailaccounts staan in de beveiligde Y-app-kluis.",
        ],
      },
      {
        title: "Mail — meerdere accounts in één scherm",
        items: [
          "Je kunt nu meerdere mailaccounts (en gedeelde postvakken) naast elkaar gebruiken: lezen, versturen en in een los venster openen — elk met zijn eigen account.",
          "Eén accountbalk met sleepbare tabs (Chrome-stijl); de volgorde bepaalt welk account standaard opent.",
          "Accounts beheer je voortaan in Instellingen → Email accounts (veilig opgeslagen in de Y-app-kluis). De losse e-mailinstelling in de 'Algemeen'-tab is daarmee vervallen.",
        ],
      },
      {
        title: "Mail — opstellen en conversaties",
        items: [
          "Nieuw: een 'Project'-knop naast het onderwerp. Kies een project en het projectnummer + de naam komen vooraan in het onderwerp te staan.",
          "Conversatie-overzicht boven de mail: één chronologische lijst met tijd, richting (in/uit) en de tegenpartij.",
          "Mappen-beheer: verwijderen en favoriet maken via rechtermuis, en mails slepen naar favoriete of gezochte mappen.",
        ],
      },
      {
        title: "Agenda — je eigen agenda's (CalDAV)",
        items: [
          "Voeg geauthenticeerde CalDAV-agenda's toe (bijvoorbeeld je privé-agenda op de mailserver), niet langer alleen publieke iCal-feeds.",
          "Nieuwe afspraken kun je nu in een gekozen agenda aanmaken: kies in de aanmaak-modal het doel (ERPNext of je CalDAV-agenda). Je keuze wordt onthouden als standaard.",
        ],
      },
      {
        title: "Berichten en overige fixes",
        items: [
          "Berichten: dezelfde afbeelding meerdere keren sturen geeft geen foutmelding meer (krijgt automatisch '(2)' in de naam).",
          "Km boeken: duidelijke foutmelding bij problemen in plaats van een vage 403.",
          "Taken: afgeronde projecten selecteerbaar, facturatietype kiesbaar, en velden uit het taaksjabloon worden overgenomen.",
          "Print Format: de urenstaat toont de taaknaam in plaats van de interne taak-code.",
        ],
      },
    ],
  },
  {
    version: "0.25.0",
    date: "2026-05-28",
    url: "",
    sections: [
      {
        title: "Webmail — alles direct binnen op iedere folder",
        items: [
          "Bij eerste open van Webmail worden alle ~70 folders op de achtergrond gecached (5 parallel, ~30 s). Bij elke daaropvolgende klik op een folder verschijnen de mails direct — geen lege wacht-overgang meer, ook niet bij folders die je nog niet eerder opende.",
          "Cache leeft nu in IndexedDB i.p.v. localStorage met LRU-50 limit, dus geen mail-flicker meer bij vakanties of langere periodes zonder browser-restart.",
          "Conversation-threading bovenaan de mail-body (was: helemaal onderaan, vaak buiten beeld bij langere mails). Zone A toont alleen vervolgacties / latere replies; Zone B alle thread-mails klikbaar in chronologische volgorde, huidige gehighlight.",
          "Folder-search bovenaan de mappenlijst — typen toont een platte gefilterde lijst i.p.v. ingeklapte tree.",
          "Favorieten + verborgen folders zijn nu cross-device synchroon (was per browser).",
        ],
      },
      {
        title: "Webmail — bijlages naar NAS",
        items: [
          "NAS-knop verplaatst van toolbar naar attachment-rij (naast 'Alles opslaan' en 'NextCloud') zodat het altijd zichtbaar is bij de bijlages.",
          "Project-picker kiest nu ook Completed/Cancelled projecten (was alleen Open/Working).",
          "Folder-token-match pre-selecteert het project — als je in een `[IN] 3001 …` folder bent, springt de project-keuze daar al op.",
          "Volgnummer wordt live opgehoogd tijdens de preview (003 i.p.v. statische 001).",
          "Forward met >45 MB bijlages geeft nu een duidelijke waarschuwing vóór verzenden — voorheen kreeg je een silent 413-fout.",
          "NAS-template-instellingen (correspondentie-submap + naam-template) zijn nu cross-device synchroon. Per-company folder-handles blijven per device (verschillende werkstations gebruiken eigen drive-letters).",
        ],
      },
      {
        title: "Messenger — bewerken & verwijderen + 👍-fix",
        items: [
          "Eigen berichten kun je nu bewerken en verwijderen via een 3-punten menu naast 👍 en reply (hover-strip). Bewerkte berichten krijgen '(bewerkt)' naast de tijd; verwijderde tonen 'Bericht verwijderd' (grijs cursief) op de oorspronkelijke plek zodat replies-naar-verwijderd-bericht blijven werken.",
          "👍-regressie opgelost: 👍 vanaf de NextCloud Talk desktop app verscheen in Y-app als nieuw bericht in de chat i.p.v. als reactie. Server filtert nu emoji-only quoted replies + 'X verwijderde een bericht' system-noise weg.",
          "Eigen berichten worden weer correct herkend: NC Talk's actorId (`piet.mol`) wordt nu live ge-resolved tegen je user (`piet@3bm.co.nl`) zodat alle eigen messages weer een 3-dot menu krijgen.",
        ],
      },
      {
        title: "Nieuwe factuur — volledige modal-vernieuwing",
        items: [
          "Project nu inline te kiezen (was 'geen optie zichtbaar'). Standaard gefilterd op de klant van de factuur, met 'Toon alle' toggle en amber waarschuwing als je een project van een andere klant kiest.",
          "Factuurregel-layout omgedraaid: de tekst die op de factuur verschijnt staat prominent bovenaan (groot, met zichtbare border, duidelijk bewerkbaar); de interne artikel-code staat klein-grijs eronder met ↻ wissel-knop om een ander artikel te koppelen.",
          "Tarief en bedrag werken weer: artikelen zonder standard_rate halen nu hun prijs uit het Item Price record (Standard Selling) zodat er niet meer €0,00 staat bij artikelen die wel degelijk een prijs hebben.",
          "Subtotaal en totaal updaten live per toets — niet meer wachten tot na aanmaken om te zien wat de factuur wordt.",
          "Creditnota-toggle bovenin de modal (Factuur / Creditnota). Bij Creditnota wordt het is_return-vlag correct meegestuurd én de PDF-titel wisselt automatisch naar 'CREDIT-FACTUUR' met aangepaste intro en betaal-noot.",
          "BTW-template (default: Netherlands VAT 21%) en Payment Terms Template (default: 21 dagen) automatisch ingevuld op basis van bedrijf. Vervaldatum heet nu 'Betaaldatum' en wordt berekend door ERPNext uit posting_date + termijn.",
          "Bedrijf, contact, project en betaaldatum zijn nu ook bewerkbaar op bestaande draft-facturen. Bij wisselen van bedrijf krijg je een waarschuwing dat het factuurnummer verandert (andere naming-series).",
          "Eén 'Opslaan'-knop voor alle wijzigingen op een draft, in plaats van per-veld auto-save + per-rij save-buttons. Akkoord/Inboeken-knoppen verbergen tot je klaar bent met bewerken en hebt opgeslagen.",
          "PDF-voorbeeld onder de factuur, met live refresh na elke save. Logo's en briefpapier renderen nu correct (zelfde mechanisme als bij e-mail-verzenden — voorheen waren ze in de modal-preview gebroken).",
          "Foutmelding bij opslaan veel leesbaarder: één regel met de echte ERPNext-validatiefout boven aan de modal i.p.v. een Python stack-trace die de hele form verbergt. Volledige stack achter 'Toon details' toggle.",
        ],
      },
      {
        title: "Print Format slimmer — credit-conditionals",
        items: [
          "Print Format '3BM Factuur+Smart Urenstaat' herkent nu credit-nota's automatisch. Titel wisselt naar CREDIT-FACTUUR, intro-zin naar 'Bijgaand sturen we u een credit-nota...', en de betaal-instructie naar 'We zullen dit bedrag overmaken op uw rekening ofwel verrekenen met een openstaande post.' — overgenomen uit de bestaande '3BM Credit Nieuw'-template zodat dezelfde bewoording wordt gebruikt.",
        ],
      },
      {
        title: "Andere fixes",
        items: [
          "Server `hasAttachments` negeert nu inline-handtekening-images — paperclip-icoontje verdwijnt bij sig-only mails (vereist deploy om effectief te worden).",
          "Race-guard bij snel folder-switchen: een laat-aankomend fetch-result kan de UI niet meer overschrijven nadat je al naar een andere folder bent.",
          "NextCloud URL in Settings krijgt automatisch `https://` als je hem zonder protocol invoert (anders timeout server-side).",
          "Cache-invalidatie bij move/delete wist nu alle 3 lagen (in-memory + localStorage + IndexedDB) — verwijderde mail kan niet meer 'terugkomen' bij refresh.",
          "Bulk-move dropdown heeft nu een zoek-input + click-outside werkt weer.",
          "Todo 'Urgent'-optie verwijderd — ERPNext ToDo accepteert alleen High/Medium/Low.",
        ],
      },
      {
        title: "Bekend issue",
        items: [
          "Bewerken & opslaan van een BESTAANDE credit-nota draft faalt met een ERPNext-validatiefout (`Invoice Total Incl VAT must be >= 0.0`). Aanmaken van credit-nota's werkt wél. Oplossing vereist een patch in de 3BM-ERPNext-app aan de server-zijde; buiten Y-app scope.",
        ],
      },
    ],
  },
  {
    version: "0.24.0",
    date: "2026-05-23",
    url: "",
    sections: [
      {
        title: "Toegevoegd — Bijlages opslaan op NAS",
        items: [
          "Nieuwe knop 'NAS' in de Webmail toolbar (naast Forward). Eén klik → kies project → alle bijlages staan in de juiste projectfolder op de NAS. Geen drag-and-drop meer.",
          "Auto-volgnummer per mail: in /01 Correspondentie/ komt een nieuwe submap zoals '042 23-05-2026 Constructie tekening'. Volgnummer wordt opgehoogd op basis van bestaande mappen.",
          "Subject wordt slim opgeschoond (RE:/FW:/FWD:/[EXT] worden weggehaald) en gesanitized voor Windows-bestandsnamen.",
          "Vereist Chrome of Edge (File System Access API). Op Firefox/Safari is de knop disabled met uitleg.",
        ],
      },
      {
        title: "Instellingen — per device, per company",
        items: [
          "Settings → Project instellingen → 'NAS opslag': voor elk bedrijf eenmalig de base-folder kiezen (bv. C:/3BM/50_projecten/5_3BM_engineering/). Configuratie blijft lokaal — verschillende werkstations kunnen andere drive-letters / share-paden gebruiken.",
          "Correspondentie-submap (default '01 Correspondentie') en de naam-template voor de submap per mail zijn aanpasbaar. Placeholders: {nr}, {nr:03d}, {dd-mm-yyyy}, {yyyy-mm-dd}, {subject}, {from}.",
          "Naam-conflict op bestand-niveau: krijgt automatisch suffix ' (1)', ' (2)'. Bestaande bestanden worden nooit overschreven.",
        ],
      },
    ],
  },
  {
    version: "0.23.0",
    date: "2026-05-22",
    url: "",
    sections: [
      {
        title: "Verbeterd — Webmail laadt veel sneller",
        items: [
          "Eerste keer Webmail openen (na server-restart / 's morgens): mappenlijst van 22 s naar ~2 s, berichten van 12 s naar ~5 s. Door warmup uit te stellen totdat jouw eerste klik klaar is en de cred-resolve te delen tussen parallelle requests.",
          "Tab-switch tussen mappen voelt instant: alle mappen die je opent worden in localStorage gecached (LRU 50). Bij browser-refresh staat de map direct op het scherm zonder lege overgang.",
          "Talk-gesprekken openen ook instant uit localStorage (LRU 30). De scroll-naar-onderen positie klopt direct in plaats van halverwege te eindigen.",
          "Sidebar 'Email'-badge en INBOX-folder-badge gebruiken nu hetzelfde getal — geen 7 vs 4 discrepantie meer.",
        ],
      },
      {
        title: "Opgelost — Gelezen mails blijven gelezen",
        items: [
          "Mails die je leest blijven gelezen na tab-switch (Verzonden → INBOX), na page-navigatie (Dashboard → Email) en na F5. Voorheen flipten ze terug op blauw/vetgedrukt zodra je weg navigeerde.",
          "Persistent tracker (60 s window) overbrugt de IMAP \\Seen-STORE-race: server-vlag wint zodra die doorgepropageerd is, lokale optimistic-update wint tot dat moment.",
          "Externe mark-as-unread (Outlook desktop) en nieuwe arrivals worden niet meer onderdrukt door stale localStorage — server is bron-van-waarheid na 60 s.",
        ],
      },
      {
        title: "Opgelost — Mail-acties met feedback",
        items: [
          "Permanent verwijderen vanuit Verwijderde items vraagt nu om bevestiging (Outlook-stijl). Verwijderen vanuit INBOX of submappen blijft soft-delete naar Verwijderde items zonder popup.",
          "Bij delete/move-fail krijg je een toast 'Verwijderen mislukt' / 'Verplaatsen mislukt' in plaats van silent verlies.",
          "Nieuwe Talk-conversatie aanmaken laat een error zien bij failure ipv. silent fail.",
        ],
      },
      {
        title: "Opgelost — Uren-boeken op afgesloten projecten",
        items: [
          "Project 'Completed' of 'Hold' kun je nu wel selecteren in de uren-boeken-widget (was alleen Open). Open projecten blijven bovenaan; afgesloten staan onderaan met (afgesloten) / (on hold) label in grijs.",
        ],
      },
      {
        title: "Verbeterd — Messenger zoeken",
        items: [
          "Typen in het 'Nieuw gesprek'-zoekveld is nu soepel. Voorheen was er een halve seconde lag per toetsaanslag door re-filtering van de hele medewerkerslijst.",
        ],
      },
      {
        title: "Onder de motorkap",
        items: [
          "Identieke parallelle GET-API-calls worden nu intern samengevoegd (deduplicatie) — bv. /api/yapp/me, /api/auth/me en /api/instances/.../mail-accounts werden vroeger 2× gedaan en zijn nu 1×.",
          "IMAP-verbinding sluit pas na 30 min stil (was 10 min) zodat heen-weer tussen pagina's geen herverbinding kost. Tot 24 uur worden de in-memory caches bewaard.",
          "WS push-event triggert nu ook een refresh van de mail-lijst zelf (niet alleen de badge) — nieuwe mails verschijnen direct in INBOX zonder F5.",
        ],
      },
    ],
  },
  {
    version: "0.22.0",
    date: "2026-05-20",
    url: "",
    sections: [
      {
        title: "Toegevoegd — Mail-push werkt nu vanaf elke pagina",
        items: [
          "Real-time IMAP-push start automatisch zodra je Y-app opent — je hoeft niet meer eerst op Webmail te klikken om de pushes te activeren. Werkt vanuit Dashboard, Projecten, Timesheets en elke andere pagina.",
          "Server detecteert je e-mailadres uit de Y-app session zodat push ook werkt voor verse logins waar de Webmail-config nog niet één keer is geopend.",
        ],
      },
      {
        title: "Verbeterd — Webmail voelt instant aan",
        items: [
          "Server pre-laadt automatisch de envelopes (afzender, onderwerp, datum) van INBOX en alle INBOX-submappen bij iedere page-load. Bij het openen van Webmail zit alles klaar in cache — folder-switches gaan van 4 seconden naar onder 200 ms.",
          "Cache-TTL voor folder-listings naar 5 minuten verhoogd. INBOX wordt door IMAP IDLE proactief vers gehouden; submappen accepteren 5 minuten staleness in ruil voor instant openen.",
          "Bodies van mails worden niet meer eager pre-fetched — voorkomt IMAP-lock-contention waardoor Webmail-acties soms 30+ seconden hingen. Een mail openen kost de eerste keer ~400 ms, daarna is hij voor altijd lokaal gecached.",
        ],
      },
      {
        title: "Verbeterd — Messenger sidebar-badge",
        items: [
          "Badge voor onread Talk-berichten in de sidebar update binnen 60 seconden, ook voor conversaties die je niet open hebt staan. Voorheen was dat tot 5 minuten in push-modus.",
        ],
      },
    ],
  },
  {
    version: "0.21.0",
    date: "2026-05-20",
    url: "",
    sections: [
      {
        title: "Toegevoegd — Real-time push voor mail en berichten",
        items: [
          "Mail komt nu binnen via IMAP IDLE: zodra de mailserver een nieuwe mail aankondigt verschijnt die binnen ~2 seconden in je inbox, zonder polling. Werkt op de achtergrond zelfs als je op Webmail/Messenger niet kijkt.",
          "NextCloud Talk-conversaties krijgen long-poll-push wanneer je ze open hebt — server houdt een verbinding open met NC en pushed nieuwe berichten direct door.",
          "Eén WebSocket-kanaal (/ws/events) bundelt alle push-events naar de browser. Idle bandwidth = 0 bytes; alleen bij echte events worden bytes verstuurd.",
          "Sidebar mail-badge en messenger-badge updaten automatisch zonder reload.",
        ],
      },
      {
        title: "Toegevoegd — Sidebar dubbelklik = nieuw tabblad",
        items: [
          "Dubbelklik op een sidebar-item (E-mail, Berichten, Projecten, …) opent die module in een nieuw browser-tabblad zonder de Y-app shell. Ideaal voor multi-monitor workflow.",
          "Dubbelklik op een individuele e-mail of conversatie doet hetzelfde — alleen die ene mail / dat ene gesprek in een focused popout.",
        ],
      },
      {
        title: "Verbeterd — Mail",
        items: [
          "Gelezen mails springen niet meer terug naar ongelezen na navigatie of reload (race-fix tussen optimistische UI-update en IMAP \\Seen-propagatie).",
          "Sidebar mail-badge telt alleen INBOX-tree — Sent, Drafts, Trash, Junk en Archive worden uitgesloten.",
          "Mobiele \"Folder visibility\" toont folders nu hiërarchisch ingesprongen i.p.v. platte lijst.",
          "Office 365 / Exchange IMAP-timeout verhoogd van 10s naar 30s + duidelijkere foutmelding bij firewall- of basic-auth-issues.",
          "Logo's in factuur-preview en signature laden weer correct (auth-whitelist herstel + rewriter ondersteunt nu absolute ERPNext URLs en CSS url() patronen).",
          "Gedeelde mailbox (info@, administratie@) ondersteund via primary-OAuth-token + delegate-user fallback.",
        ],
      },
      {
        title: "Verbeterd — Messenger",
        items: [
          "Klik op een quoted-reply-citaat scrollt naar het originele bericht met korte amber-highlight.",
          "Afbeelding klikken opent fullscreen lightbox met download-knop i.p.v. nieuw tabblad.",
          "Duim-emoji-reactie verschijnt als badge onder het oorspronkelijke bericht in plaats van als losse boodschap (server-side filter op messageType=reaction).",
        ],
      },
      {
        title: "Verbeterd — Facturen",
        items: [
          "\"Inboeken & Versturen\" geeft nu een toast onderaan en houdt de Resultaat-modal up-to-date: verzonden rijen krijgen een groene \"Verzonden ✓\" badge.",
        ],
      },
      {
        title: "Performance",
        items: [
          "Bijlage openen veel sneller via dedicated LRU-cache (100 MB / 10 min TTL) — eerder werd elke download het hele bericht opnieuw geparset.",
          "Server-side performance-logging optioneel via Y_APP_PERF_LOG=1 env var; analyse-script scripts/perf-summary.mjs geeft p50/p95/p99 per endpoint.",
          "Mail- en messenger-pollers downscalen automatisch wanneer push-events actief zijn — gewone polling is alleen nog een sanity-fallback.",
        ],
      },
    ],
  },
  {
    version: "0.20.0",
    date: "2026-05-18",
    url: "",
    sections: [
      {
        title: "Verbeterd — Factuur versturen modal",
        items: [
          "Plaatjes uit ERPNext (logo, briefpapier, signature) laden nu via een server-proxy in plaats van rechtstreeks tegen ERPNext — werkt ook voor private files en deploys waar ERPNext niet publiek bereikbaar is",
          "Duidelijk visueel onderscheid in de modal: teal banner \"E-mail\" (wat de ontvanger in zijn mailbox ziet) vs amber banner \"Bijlage (PDF)\" (het bestand dat wordt meegestuurd)",
          "Grijs vlak rondom de PDF-preview die mee-schaalt met de zoom — direct zichtbaar dat het om een aparte bijlage gaat",
          "ERPNext's eigen Print / Get-PDF knoppen in de embedded preview verborgen — die hoorden alleen in ERPNext zelf",
        ],
      },
      {
        title: "Verbeterd — Factuur versturen (overige iteraties)",
        items: [
          "Print-format dropdown onthoudt keuze; urenbasis-only is default. \"Open in ERPNext\" gaat via volledige HTML-print (logo + briefpapier kloppen)",
          "Per-account signature: bij meerdere outgoing accounts wordt de juiste `email_signature` van de gekozen afzender opgehaald",
          "Rich-text description editor op de Sales Invoice Item; uitklapbare timesheet-rijen tonen exact welke uren op de PDF komen; inline edit van item + klant",
          "From-resolutie kijkt naar Email Account whitelisting + default-outgoing + user-account links voor multi-account instances",
          "Zoom-controls + fit-to-width op de PDF-iframe; \"Bekijken & Versturen\" op draft-rijen in te-factureren-tab",
        ],
      },
      {
        title: "Toegevoegd — Facturatie-prep dashboard",
        items: [
          "Dashboard-widgets tonen facturatie-prep status in één blik: te boeken uren, drafts wachtend op submit, klanten zonder activiteit",
          "Te-factureren-tab: project- en taak-panelen openen inline (in-page deeplink), geen volledig nieuwe pagina",
          "Goedkeuren-style overzicht doorgevoerd — consistent uitklap/inklap patroon",
        ],
      },
      {
        title: "Toegevoegd — Onkosten km-goedkeuren",
        items: [
          "Nieuwe tab km-goedkeuren op /expenses markeert ritten waar geclaimde km afwijken van verwachte (route + factor)",
          "Anomalie-highlighting óók in de bestaande Overzicht-tab — waarschuwingen reizen mee met de data, niet met de tab",
          "?tab= URL-routing op /expenses voor deeplinks vanaf dashboard-cards naar de juiste tab",
        ],
      },
      {
        title: "Verbeterd — Messenger + Webmail",
        items: [
          "Caption + plaatje landen nu in één Talk-message-bubble (NC Talk 19+ `talkMetaData.caption`). Voorheen: aparte bubbles voor tekst en plaatje",
          "Messenger + Webmail: long-poll voor snellere updates, grouping, mobile mailbox-dropdown voor smalle viewports",
          "Webmail: shared mailbox tabs zichtbaar in vault-modus (waren per ongeluk verborgen); primaire credentials uit vault als fallback wanneer session-cache leeg is",
        ],
      },
      {
        title: "Opgelost — Employee-weergave",
        items: [
          "Zijbalk-modules correct gefilterd voor employees op instances met module-restricties",
          "Tasks: company-filter goed toegepast zodat employees alleen taken van hun eigen bedrijf zien",
          "Project create-mode: checklist (geladen uit klant→template-mapping) is direct bewerkbaar (was read-only tot eerste save)",
        ],
      },
    ],
  },
  {
    version: "0.19.0",
    date: "2026-05-17",
    url: "",
    sections: [
      {
        title: "Toegevoegd — Facturen versturen via ERPNext",
        items: [
          "Verstuur-knop op submitted Sales Invoices in tabblad \"Alle\" — opent een preview-modal met PDF-voorbeeld links en e-mailformulier rechts",
          "Op DRAFT-facturen: \"Inboeken & Verstuur\" — submit en verzending in één klik via ERPNext's eigen Communication-mechanisme",
          "In Te-factureren-tab: knop \"Bekijken & Versturen\" naast elke zojuist aangemaakte factuur in de resultaat-lijst",
          "Bulk versturen: checkbox-selectie + drawer die sequentieel elke factuur z'n eigen mail stuurt (geen samengevoegd bericht)",
          "Preview gebruikt het geselecteerde Print Format en briefpapier — exact wat de klant gaat ontvangen",
          "ERPNext Email Template wordt server-side gerenderd met de invoice als Jinja-context — placeholders ({{ doc.customer_name }}, etc.) worden ingevuld",
          "User Signature uit ERPNext wordt als read-only voorbeeld onder body getoond — wordt door ERPNext automatisch aangehangen, geen dubbele signatures",
          "Preflight check: zonder geconfigureerd outgoing Email Account toont de modal een blokkerende foutmelding met link naar ERPNext-setup",
        ],
      },
      {
        title: "Toegevoegd — Settings: Factuur versturen",
        items: [
          "Nieuwe sectie in Settings → Project instellingen (employer-only): kies default Email Template en default Print Format voor Sales Invoices",
          "Inhoud (tekst, briefpapier, handtekening, From-address) blijft in ERPNext beheerd — Y-app slaat alleen de twee defaults op, geen drift",
          "Defaults worden gerespecteerd door de Verstuur-modal én door de bulk-drawer",
        ],
      },
    ],
  },
  {
    version: "0.18.0",
    date: "2026-05-15",
    url: "",
    sections: [
      {
        title: "Opgelost — Tenant-isolatie (Chinese walls)",
        items: [
          "Filters (bedrijf/medewerker/activity type) lekken niet meer tussen instance-tabs — alles per-instance opgeslagen (pref_${id}_*)",
          "Messenger op Impertio toont niet meer berichten van 3BM: per-instance NextCloud Talk creds zowel client- als server-side",
          "Server resolveNcTalkCreds/resolveNextcloudCreds: per-request credentials gaan voor env-var fallback (was omgekeerd)",
          "Convo-cache nu per-instance (Map keyed by instanceId) i.p.v. één gedeelde — geen cache-poisoning bij tab-wissel",
          "Eenmalige migratie wist legacy globale erpnext_default_* keys uit localStorage bij startup",
        ],
      },
      {
        title: "Opgelost — Timesheets",
        items: [
          "Billable-vinkje toont nu de werkelijke ERPNext waarde (was: altijd uit) — leest is_billable in alle 3 loaders",
          "Goedkeuren werkt weer (Frappe v15+ frappe.client.submit signature: stuurt nu het volledige doc als JSON i.p.v. {doctype,name})",
          "ERPNext-foutmeldingen worden volledig getoond i.p.v. \"ERPNext API error: 500\" (parsed uit _server_messages/exc)",
        ],
      },
      {
        title: "Toegevoegd — Financieel dashboard",
        items: [
          "Tabblad Klanten: matrix klant × jaar met aantal projecten per klant (instelbaar jaarbereik + zoekveld)",
          "Tabblad Omzet/klant: matrix klant × periode met omzet excl. BTW. Granulariteit per week (ISO 8601) / maand / kwartaal / jaar + datum van/t-m",
          "Beide tabs: sticky linker kolom, totaal-rij/kolom, gesorteerd op totaal",
        ],
      },
      {
        title: "Toegevoegd — Omzet pagina",
        items: [
          "Periode-selector: Volledig jaar / Year-to-date / Laatste 3-6-12 maanden / Aangepast (datum van/t-m)",
          "Horizontale gemiddelde-omzet referentielijn (oranje gestippeld) — zie in één blik welke maanden boven/onder jaargemiddelde scoren",
          "Chart-bars en cumulatief-lijnen schalen mee met variabel aantal maanden in de periode",
        ],
      },
      {
        title: "Toegevoegd — Settings & NextCloud Talk",
        items: [
          "\"Test verbinding\" knop bij NextCloud Talk credentials in Settings — twee-staps diagnose (bereikbaarheid + Talk auth)",
          "Specifieke foutmeldingen: \"Hostnaam niet gevonden\", \"Authenticatie mislukt\", \"Talk app niet geïnstalleerd\", etc.",
          "Bij succes: aantal gesprekken + ongelezen direct zichtbaar",
        ],
      },
      {
        title: "Verbeterd — Per-instance Frappe versie detectie",
        items: [
          "Server detecteert Frappe versie (v15/v16) bij toevoegen instance — hard fail als niet vast te stellen",
          "Version override mogelijk in Settings (per instance) met \"Opnieuw detecteren\" knop",
          "Versie-aware count endpoint (/api/i/:id/count) abstraheert v15 frappe.client.get_count vs v16 REST aggregate",
        ],
      },
    ],
  },
  {
    version: "0.17.0",
    date: "2026-05-14",
    url: "",
    sections: [
      {
        title: "Verbeterd — Berichten",
        items: [
          "Tekst meesturen mét bijgevoegde screenshot werkt nu (bijschrift bij afbeelding)",
          "Reply op een specifiek bericht (NC Talk threading) — knop op elk bericht, citaat-balk boven het invoerveld",
          "Bijlage-knop accepteert nu álle bestandstypen (PDF, DOCX, ZIP — niet alleen afbeeldingen)",
          "Notificaties: korte ding-sound bij inkomend bericht, browser-notificatie als tab niet actief is, (N) Y-app in tab-titel",
          "Scrollpositie blijft op zijn plek bij \"Laad oudere berichten\" (niet meer terug naar laatste bericht)",
        ],
      },
      {
        title: "Verbeterd — Mail",
        items: [
          "Doorsturen behoudt nu de originele bijlages (blauwe \"forwarded\" chips, individueel verwijderbaar)",
          "Reply / Doorsturen citeren nu in HTML met behoud van opmaak (vet/cursief/links/kleuren) i.p.v. plain text met <br>",
          "↻ Handtekening opnieuw laden-knop in compose-toolbar (clear cache + refetch van ERPNext)",
          "Standalone mail-view (mail in nieuw tabblad): volledige knoppenset — Toevoegen aan project, CRM-zoeken, Vervolgactie (Taak/Offerte/Project/Inkoopfactuur), Verwijderen, Alles downloaden",
          "Reply/Doorsturen in standalone view opent compose IN dezelfde tab (geen sprong terug naar volledige Y-app shell)",
        ],
      },
      {
        title: "Verbeterd — Taken",
        items: [
          "\"Mijn taken\" widget op dashboard: limiet verhoogd van 100 naar 500 items",
          "Tasks-pagina: gebruikt nu fetchAll met paginering — alle taken zichtbaar, ook bij grote instances",
        ],
      },
    ],
  },
  {
    version: "0.16.0",
    date: "2026-04-28",
    url: "",
    sections: [
      {
        title: "Verbeterd — Todo",
        items: [
          "Werkgever krijgt standaardfilter; medewerker-scoping nu server-side",
          "Inline veld-bewerking direct vanuit het taakdetail",
          "Sortering op datum (oplopend), prioriteit als fallback bij ontbrekende datum",
        ],
      },
      {
        title: "Verbeterd — Webmail",
        items: [
          "Drijvend mailvenster (compose als pop-out)",
          "Verzonden-map fixes",
          "Lange e-mailteksten worden nu correct afgebroken",
          "Leesvenster-kop herstructureerd",
          "SMTP OAuth2 token refresh hersteld",
          "Vastlopende sleep/resize cursor opgelost",
        ],
      },
    ],
  },
  {
    version: "0.15.0",
    date: "2026-04-21",
    url: "",
    sections: [
      {
        title: "Onderhoud — afhankelijkheden",
        items: [
          "Frontend: i18next 26, react-i18next 17, tailwindcss 4.2.3, vite 8, typescript 6, eslint 10",
          "Desktop (JS): aligned met frontend (i18next, react-i18next, vite, plugin-react, react-router-dom, tailwind)",
          "Desktop (Rust): reqwest 0.13, rusqlite 0.39, async-imap 0.11, mail-parser 0.11",
          "reqwest 0.13: rustls-no-provider + ring CryptoProvider als process default",
          "TypeScript 6: ignoreDeprecations voor baseUrl path-alias compatibiliteit",
        ],
      },
      {
        title: "Verbeterd",
        items: [
          "Extensies: fetchPrivateFile RPC, sidebar-deduplicatie + ongelezen-badges",
          "Messenger: NextCloud Talk bestand/afbeelding bijlagen worden nu getoond",
          "Frontend: tijdzone-veilige datumverwerking voor verlof/uren",
          "Webmail: ontvanger-autocomplete in opstellen",
          "Tasks/Todo: robuuster wanneer ERPNext-config velden mist",
          "Todo: race condition bij allocated_to refetch opgelost",
        ],
      },
    ],
  },
  {
    version: "0.14.0",
    date: "2026-04-20",
    url: "",
    sections: [
      {
        title: "Toegevoegd — runtime extensies",
        items: [
          "Extensies draaien nu in sandboxed iframes vanuit derde partijen (bijv. GitHub Pages)",
          "postMessage RPC bridge — alle ERPNext-aanroepen via Y-app, credentials blijven binnen",
          "Curated catalogus dient als allowlist (releases gaan via Y-app)",
          "Settings → Extensions: catalogus-kaarten met één-klik installeren / verwijderen",
          "Geavanceerd-paneel voor handmatige extensie-URL (power users)",
          "Eerste catalogus-entry: kg-planning",
        ],
      },
      {
        title: "Verwijderd",
        items: [
          "Compile-time extensie-infrastructuur (registry, types, enabled, voorbeeld-planner, kg-planning in-tree)",
          "Bijhorende vertaalsleutels in en/nl/de",
        ],
      },
    ],
  },
  {
    version: "0.13.0",
    date: "2026-04-18",
    url: "",
    sections: [
      {
        title: "Toegevoegd",
        items: [
          "Webmail: gedeelde mailbox tabs",
          "Extensie kg-planning: volledige port met Financieel/Projecten/HR dashboards",
        ],
      },
      {
        title: "Opgelost",
        items: [
          "Sidebar: localStorage sync bij auto-expand, geen stale collapsed-state meer",
          "CostInsight: ongebruikte declaraties opgeruimd",
        ],
      },
      {
        title: "Beveiliging",
        items: [
          "Cargo update — drie Dependabot meldingen gesloten",
        ],
      },
    ],
  },
  {
    version: "0.12.0",
    date: "2026-04-16",
    url: "",
    sections: [
      {
        title: "Mobiel-responsive sweep",
        items: [
          "Webmail: bottom action bar voor leesweergave op mobiel",
          "Webmail: terug naar lijst na verwijderen/verplaatsen op mobiel",
          "Webmail: compose-sluiten en safe-area-inset-top",
          "Webmail: layout flex-col (folder-dropdown + lijst stapelen verticaal)",
          "Messenger: single-pane layout op mobiel",
          "Projects: mobiel-responsive layout",
          "Contacts: terug-knop fix, betere touch-targets",
          "Overige overlays: safe-area-inset-top voor Android-statusbalk",
          "Dropdowns/modals/grids: max-width constraints",
        ],
      },
      {
        title: "Onderhoud",
        items: [
          "Dependencies bijgewerkt (patch/minor)",
          "upload-artifact v7, setup-android v4 (Node 24)",
        ],
      },
    ],
  },
  {
    version: "0.11.6",
    date: "2026-04-14",
    url: "",
    sections: [
      {
        title: "Webmail",
        items: [
          "Handmatig ingevoerde IMAP host/poort/user/wachtwoord wordt nu daadwerkelijk gebruikt (was dode data)",
          "Server prefereert query-creds boven ERPNext Email Account lookup",
          "Auth-fouten geven JSON i.p.v. HTML 500",
        ],
      },
      {
        title: "Browser autofill",
        items: [
          "autoComplete=\"new-password\"/\"off\" op IMAP setup, NextCloud, ERPNext vault dialog — geen Y-app login meer in die velden",
        ],
      },
      {
        title: "CI",
        items: [
          "Deploy + Build & Release nu workflow_dispatch alleen (geen auto-trigger op push of v* tag)",
        ],
      },
    ],
  },
  {
    version: "0.11.5",
    date: "2026-04-14",
    url: "",
    sections: [
      {
        title: "i18n veegslag",
        items: [
          "Hardgecodeerde NL strings vervangen door t() met NL/EN/DE",
          "Settings project-template panel, Expenses (Totaal km, declaraties)",
          "Timesheets row-edit, Projects, Dashboard project-search, QuickKmBooking",
        ],
      },
      {
        title: "Mobiel",
        items: [
          "Settings tab-rij overflow op telefoon opgelost (flex overflow-x-auto, edge-bleed padding)",
        ],
      },
    ],
  },
  {
    version: "0.11.4",
    date: "2026-04-14",
    url: "",
    sections: [
      {
        title: "Toegevoegd",
        items: [
          "Compile-time extensie-systeem (later vervangen in v0.14.0 door iframe-extensies)",
          "Brede i18n sweep",
          "Documentatie split (CLAUDE.md / CHANGELOG.md / STATUS.md)",
        ],
      },
    ],
  },
  {
    version: "0.11.3",
    date: "2026-04-14",
    url: "",
    sections: [
      {
        title: "Mobiel-responsive overhaul",
        items: [
          "Dashboard: padding p-3 sm:p-6, header wrap, kleinere grid-gap",
          "Widgets: alle p-5 → p-3 sm:p-5",
          "UrenBoekenWidget: gestapelde grid op mobiel, dense 7-col vanaf md",
          "Timesheets, Planning, Contacts, Wiki, NextCloudFiles, Outstanding, SalesInvoices: mobiel fixes",
          "25 paginas: root p-6 → p-3 sm:p-6",
        ],
      },
      {
        title: "Dev tooling",
        items: [
          "VITE_API_TARGET env var: lokale frontend kan tegen remote backend werken",
          "Service worker actief uitgeschreven in dev (oplossing voor stale-SW loop op localhost)",
        ],
      },
    ],
  },
  {
    version: "0.11.2",
    date: "2026-04-14",
    url: "",
    sections: [
      {
        title: "Biometrisch",
        items: [
          "Auto-trigger biometrische prompt bij mount (~150 ms)",
          "Eén scherm, nul extra taps voor de gangbare flow",
        ],
      },
      {
        title: "Tekst",
        items: [
          "\"Desktop\"-suffix verwijderd uit titels (zelfde code op Android)",
        ],
      },
    ],
  },
  {
    version: "0.11.1",
    date: "2026-04-14",
    url: "",
    sections: [
      {
        title: "Biometrisch — debug aids",
        items: [
          "30 s timeout race rond authenticate() — geen vastlopen meer op \"Authenticating…\"",
          "Inline foutmelding voor diagnose op echte Android telefoons",
          "User-cancel nu geluidloos",
          "Speculatieve subtitle/manifest aanpassingen teruggedraaid",
        ],
      },
    ],
  },
  {
    version: "0.11.0",
    date: "2026-04-14",
    url: "",
    sections: [
      {
        title: "Toegevoegd",
        items: [
          "Opt-in vingerafdruk-unlock voor Stronghold vault (Android)",
          "Vier nieuwe Rust commando's: write/read/clear/has password",
          "reset_vault + changeVaultPassword wissen biometric.bin",
          "Niet-Android: no-op stub (desktop bouwt ongewijzigd door)",
          "EnableBiometricModal met expliciete caveat-copy na eerste succesvolle unlock",
        ],
      },
      {
        title: "Beveiliging",
        items: [
          "Wachtwoord in ref (niet state) — onzichtbaar voor React DevTools",
          "capabilities/android.json: scope [\"android\"]",
          "Casual physical access protected; rooted device kan vault.hold nog uitlezen (in modal vermeld)",
        ],
      },
    ],
  },
  {
    version: "0.10.0",
    date: "2026-04-14",
    url: "",
    sections: [
      {
        title: "Toegevoegd",
        items: [
          "v0.4.1 samengevoegd vanuit langlopende fix-branch (rebase-only-new-commits, 13 bestanden)",
        ],
      },
      {
        title: "Opgelost",
        items: [
          "Windows Authenticode re-upload: ondertekend bestand vervangt unsigned upload",
          "Android stable keystore (uit secret) — gebruikers kunnen nu in-place updaten",
          "Leave.tsx: Engelse Leave() naam behouden",
          "ProjectSettingsPanel: instanceId type number → string",
          "Ongebruikte ProjectTemplateRecord verwijderd",
        ],
      },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-04-14",
    url: "",
    sections: [
      {
        title: "Opgelost",
        items: [
          "modules.ts: legacy NL page-IDs vertaald naar EN (brieven→letters, grootboeken→ledgers, banktransacties→bank-transactions, omzet→revenue, openstaand→outstanding, kosteninzicht→cost-insight, rendabiliteit→profitability, liquiditeitsplanning→liquidity-planning, boekingsprogramma→booking-program)",
          "APP_VERSION leest uit package.json via Vite define (was hardcoded en dreef weg per release)",
        ],
      },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-04-14",
    url: "",
    sections: [
      {
        title: "Vault UX",
        items: [
          "Forgot-password / reset-vault flow op unlock-scherm (typ \"RESET\")",
          "Vriendelijke Stronghold foutmeldingen (Wrong password / vault mismatch i.p.v. ruwe age-blob)",
          "Lock-vault uit account-dropdown werkt nu echt",
          "Account-dropdown: \"Vault: Local — geen Y-app account\" in localVaultMode",
          "Cred-cache refresh na add/delete instance",
        ],
      },
      {
        title: "ERPNext test-connection",
        items: [
          "normalize_base_url trimt trailing slashes",
          "Stabiele error codes (network_unreachable, tls_error, timeout, invalid_credentials, server_error, no_session)",
          "TestResult als camelCase (lost ook latente data.fullName-bug op)",
        ],
      },
      {
        title: "Auto-lock + change-password",
        items: [
          "useAutoLock hook (visibilitychange + activity tracking, default 5 min)",
          "Change-password orchestratie met automatische rollback",
          "Drie nieuwe Rust commando's: backup_vault, restore_vault_backup, delete_vault_backup",
          "ChangeVaultPasswordModal in account-dropdown",
        ],
      },
      {
        title: "Android",
        items: [
          "Vault backup uit (android:allowBackup=false) — geen D2D-restore zonder salt",
          "Stable keystore voor in-place updates",
        ],
      },
    ],
  },
  {
    version: "0.7.1",
    date: "2026-04-13",
    url: "",
    sections: [
      {
        title: "Opgelost",
        items: [
          "Desktop safe-area: body padding + h-full layout",
        ],
      },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-04-13",
    url: "",
    sections: [
      {
        title: "Desktop — sidecar verwijderd",
        items: [
          "reqwest ERPNext proxy met session cache in Rust",
          "Tauri invoke vervangt HTTP fetch interceptor",
          "Geen sidecar meer, geen credential sync",
          "desktop-server package verwijderd — vervangen door Rust commando's",
          "Client-side stats aggregatie (vervangt server-side /api/stats/uren)",
        ],
      },
      {
        title: "Toegevoegd",
        items: [
          "Messenger commando's (NextCloud Talk + Telegram) in Rust",
          "Safe area insets voor Android/iOS status bar + gesture bar",
        ],
      },
    ],
  },
  {
    version: "0.4.1",
    date: "2026-04-13",
    url: "",
    sections: [
      {
        title: "Toegevoegd",
        items: [
          "Multi-select email (Shift/Ctrl klik, bulk acties)",
          "Email-map op basis van project ([IN] / [OUT] prefix)",
          "Subfolder-zoekfunctie in email",
          "Compacte widget layout (2 rijen)",
          "Boekingsrijen in Timesheets-overzicht (sorteerbaar, maand-koppen)",
          "Rich-text taakomschrijving + sidebar-collapse fix",
          "Settings opruiming voor medewerker-weergave",
          "Kanban tab op Planning-pagina",
          "Todo defaults (medewerker-filter, datum, assigned_to)",
          "Activity type per medewerker (werkgever-instelling)",
          "24 h tijdsinvoer (text input)",
          "Inline edit project/taak in TimesheetDetailsTable",
          "Project-aanmaken in sidebar (klant-dropdown, PM = ingelogde, taken-template, adres met Nominatim/Leaflet)",
          "Settings tab \"Project instellingen\" — klant ↔ taken-template mapping",
        ],
      },
      {
        title: "Opgelost (B02–B11)",
        items: [
          "Sidebar module-zichtbaarheid (B02), Messenger \"Alle\" tab (B03)",
          "Sessie-cache stale-while-revalidate (B04), Talk file/image support (B05)",
          "IMAP serialisatie + retry (B06), Email collapse-state per folder (B07)",
          "Smart dropdown-positionering (B08), Shift hours consolidatie (B09)",
          "Missing-shift warnings (B10), Contracturen uit Shift Type docs (B11)",
        ],
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-04-13",
    url: "",
    sections: [
      {
        title: "Verbeterd — Uren widget",
        items: [
          "Taaknaam direct zichtbaar na boeken",
          "Afronding op 2 decimalen, 200 ms delay verwijderd",
          "Activity type verborgen voor medewerkers (werkgever stelt in)",
        ],
      },
      {
        title: "Vakantieplanning",
        items: [
          "2-staps modal: formulier → samenvatting met blokken",
          "Shift-plan-aware: alleen werkdagen kosten verlof",
          "Split aanvragen voor parttime-roosters → meerdere ERPNext-applicaties",
          "Kalender met kleuring (grijs = niet-werkdag, teal = feestdag, oranje = bestaand verlof)",
          "Hover-tooltips per dag, halve dag met datum-keuze",
          "Leave types gefilterd op employee allocations",
          "Openstaande aanvragen zichtbaar in saldo-kaart, \"Vandaag\"-knop",
        ],
      },
      {
        title: "Messenger / Dashboard",
        items: [
          "Messenger: batch loading 20 (was 100), polling merge i.p.v. replace",
          "NextCloud URL auto-prepend https://",
          "Dashboard: missing-hours via time_logs i.p.v. timesheet start_date",
        ],
      },
      {
        title: "i18n",
        items: [
          "40+ nieuwe vertaalsleutels (NL + EN) voor verlofmodal en project detail",
        ],
      },
    ],
  },
  {
    version: "0.3.3",
    date: "2026-03-23",
    url: "",
    sections: [
      {
        title: "Toegevoegd",
        items: [
          "Uitgebreide README — overzicht van 40+ modules, integraties en tech stack",
          "Office 365 Calendar + Teams (OAuth2 Graph API, vereist Azure admin consent)",
          "Multi-platform release: Electron Windows installer + portable, Tauri builds",
        ],
      },
      {
        title: "Verbeterd",
        items: [
          "OAuth2 token refresh: betere foutmeldingen bij ontbrekende Azure consent",
          "dev:all en dev:mini scripts voor parallelle server + frontend dev",
        ],
      },
    ],
  },
  {
    version: "0.3.2",
    date: "2026-03-21",
    url: "",
    sections: [
      {
        title: "Toegevoegd",
        items: [
          "Moderne, dunne en afgeronde scrollbars in Electron (WebKit + Firefox)",
          "Verbeterd Y-mini inlogscherm (animaties + glasmorfisme)",
        ],
      },
      {
        title: "Opgelost",
        items: [
          "Y-mini credentials isolatie: module-init verplaatst naar startServer()",
          "isMiniMode crash in save-session endpoint",
          "Expliciete OAuth2 scopes voor Teams (Chat.Read) en Calendar (Calendars.Read)",
        ],
      },
      {
        title: "Verbeterd",
        items: [
          "Y-mini portable output naar release/ i.p.v. release-mini/",
        ],
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-03-21",
    url: "",
    sections: [
      {
        title: "Toegevoegd",
        items: [
          "Y-mini Android voorbereiding (Tauri Mobile)",
          "Session-based authenticatie (naast API tokens)",
          "Y-mini volledig gescheiden config, vault en credentials van Y-app",
          "MiniLogin scherm voor werknemers, \"Mijn taken\"-filter als default",
          "GitHub Actions CI/CD voor Electron + Tauri + Android",
          "Tauri v2 desktop builds voor Windows, macOS en Linux",
        ],
      },
      {
        title: "Beveiliging",
        items: [
          "Hardgecodeerde credentials uit broncode verwijderd",
          "Generieke theming — geen bedrijfsspecifieke kleuren of namen meer",
        ],
      },
      {
        title: "Verbeterd",
        items: [
          "Facturabel veld (is_billable) bij urenregistratie",
          "Email breedte dynamisch berekend i.p.v. hardcoded offset",
          "Instance management zonder hardcoded fallbacks",
        ],
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-03-18",
    url: "",
    sections: [
      {
        title: "Toegevoegd",
        items: [
          "Vergadernotities, Leads, Liquiditeitsplanning, Brieven modules",
          "Rich text email editor met opmaak, afbeeldingen en handtekening uit ERPNext",
          "Vervolgacties vanuit email: Taak, Offerte, Project, Inkoopfactuur aanmaken",
          "Project koppeling bij emails met slimme matching",
          "CRM zoeken vanuit email — contacten zoeken in ERPNext",
          "Contact status bij emails — toevoegen als contact niet bestaat",
          "ERPNext status indicator bij elke email (Communication check)",
          "Bijlage preview panel (PDF, afbeeldingen) naast email",
          "Email gelezen/ongelezen met badges en markeer-actie",
          "Module zoekfilter in navigatiebalk",
          "Sidebar badges voor Email en Berichten",
          "Optionele modules via Instellingen",
          "Versiebeheer en release notes (deze pagina)",
        ],
      },
      {
        title: "Verbeterd",
        items: [
          "Facturabel (billable) fix voor urenregistratie",
          "Vakantieplanning: DST-correctie, contracturen, weeknummers",
          "Cache progressive fallback voor ERPNext compatibiliteit",
          "Email handtekening uit ERPNext (Email Account, User, Employee)",
          "NextCloud: bestanden en mappen als bijlage of deellink",
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2025-01-01",
    url: "",
    sections: [
      {
        title: "Eerste release",
        items: [
          "Dashboard, Projecten, Taken, Planning",
          "Boekhouding en Financieel overzicht",
          "HR & Personeel, Webmail, Agenda, Bestanden",
          "ERPNext multi-instance met encrypted vault",
        ],
      },
    ],
  },
];

/** Parse markdown body from GitHub release into sections */
function parseReleaseBody(body: string): { title: string; items: string[] }[] {
  const sections: { title: string; items: string[] }[] = [];
  let current: { title: string; items: string[] } | null = null;
  for (const line of body.split("\n")) {
    const headingMatch = line.match(/^###?\s+(.+)/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { title: headingMatch[1].trim(), items: [] };
      continue;
    }
    const itemMatch = line.match(/^[-*]\s+(.+)/);
    if (itemMatch && current) {
      current.items.push(itemMatch[1].replace(/\*\*/g, "").trim());
    } else if (itemMatch && !current) {
      current = { title: "Wijzigingen", items: [itemMatch[1].replace(/\*\*/g, "").trim()] };
    }
  }
  if (current) sections.push(current);
  return sections;
}

export default function ReleaseNotes() {
  const { t } = useTranslation();
  const [ghReleases, setGhReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchReleases();
  }, []);

  async function fetchReleases() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://api.github.com/repos/OpenAEC-Foundation/Y-app/releases?per_page=20", {
        headers: { Accept: "application/vnd.github.v3+json" },
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data: GitHubRelease[] = await res.json();
      setGhReleases(data.filter(r => !r.draft));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Merge GitHub releases with local fallback
  const releases = ghReleases.length > 0
    ? ghReleases.map(r => ({
        version: r.tag_name.replace(/^v/, ""),
        date: new Date(r.published_at).toLocaleDateString("nl-NL"),
        url: r.html_url,
        prerelease: r.prerelease,
        sections: parseReleaseBody(r.body || ""),
        name: r.name,
      }))
    : LOCAL_RELEASES;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-y-teal to-y-teal-dark flex items-center justify-center shadow-lg shadow-y-teal/20">
          <span className="text-xl font-black text-white tracking-tighter">Y</span>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{APP_NAME} Release Notes</h1>
          <p className="text-sm text-slate-500">{t("settings.version")}: v{APP_VERSION}</p>
        </div>
        <button onClick={fetchReleases} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? t("common.loading") : t("common.refresh")}
        </button>
      </div>

      {error && ghReleases.length === 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          {t("release_notes.fetch_failed", { error })}
        </div>
      )}

      <div className="space-y-6">
        {releases.map((release) => {
          const isCurrent = release.version === APP_VERSION;
          return (
            <div key={release.version}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden ${isCurrent ? "border-y-teal/30 ring-1 ring-y-teal/10" : "border-slate-200"}`}>
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-slate-400" />
                  <h2 className="text-lg font-semibold text-slate-700">
                    v{release.version}
                  </h2>
                  {isCurrent && (
                    <span className="text-[10px] font-medium text-white bg-y-teal px-2 py-0.5 rounded-full">
                      {t("release_notes.current_version")}
                    </span>
                  )}
                  {"prerelease" in release && !!(release as Record<string, unknown>).prerelease && (
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      {t("release_notes.prerelease")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">{release.date}</span>
                  {release.url && (
                    <a href={release.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                      <ExternalLink size={11} /> GitHub
                    </a>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 space-y-4">
                {release.sections.length > 0 ? (
                  release.sections.map((section) => (
                    <div key={section.title}>
                      <h3 className="text-sm font-semibold text-y-teal mb-2">{section.title}</h3>
                      <ul className="space-y-1.5">
                        {section.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic">{"name" in release ? (release as any).name : t("release_notes.no_details")}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
