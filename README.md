# Y-Next

Y-Next is een webwerkplek voor **ERPNext 16**: projecten, uren, e-mail,
agenda, berichten en documenten op je eigen ERPNext-site. De app gebruikt
de bestaande ERPNext-login en rechten. Geen apart Y-Next-account, geen
instancewisselaar en geen aparte proxyserver.

Deze `main`-branch bevat de **volledige, installeerbare Frappe-app**
`y_next`: Python-code, DocTypes, installatiehooks en de gebouwde
browserinterface, inclusief Calc, Writer, workers, WASM en licentiebestanden.
Op de installatiehost is geen frontend-build met Node nodig.

## Lichte werkplek

![Y-Next-dashboard met lichte navigatie, uren boeken en het Apps-paneel](docs/screenshots/y-next-light-workplace.jpg)

Screenshot van de lokale ontwikkelbuild. De lege testsite bevat nog geen
medewerkers of projecten; de interface toont geen fictieve bedrijfsgegevens.
Uren boeken en projecten staan centraal, met kilometerregistratie en
persoonlijke taken eronder. Rechts staan de Apps en Agenda vandaag.
Op smalle schermen staan de Apps boven de dashboardwidgets.

## Mail met een DWG-bijlage — ontwerpbeeld

![Fictieve geopende e-mail met een DWG-funderingsplan in Y-Next](docs/screenshots/y-next-email-dwg-concept.png)

Gegenereerd ontwerpbeeld met fictieve afzenders, mailtekst en tekening.
Dit is geen live screenshot en geen bewijs dat de getoonde DWG-preview
al op iedere installatie beschikbaar is.

## Downloaden en installeren

Je kunt de app zelf installeren of de installatie aan een Claude Code-sessie
laten uitvoeren. Beide routes gebruiken hetzelfde pakket uit deze repository.

### Benodigd

- Een bestaande bench met Frappe 16 en ERPNext 16.
- Toegang tot de bench of een hostingbeheerder die de installatie uitvoert.
- Voor de standaard Frappe 16-omgeving: Python 3.14 of nieuwer.

HRMS en Wiki zijn optioneel. De app schakelt aanvullende functies in wanneer
de bijbehorende apps op de site beschikbaar zijn. Mail vereist een
geconfigureerd ERPNext Email Account; een lege testsite krijgt geen
voorbeeldberichten.

### Zelf installeren

Voer in de bestaande bench uit:

```bash
bench get-app --branch main https://github.com/OpenAEC-Foundation/Y-app-ERPNext
bench --site jouw.site install-app y_next
bench --site jouw.site list-apps
```

Vervang `jouw.site` door je sitenaam. Open daarna
`https://jouw.site/y-next` en log in met je bestaande ERPNext-account.

Je kunt het complete pakket ook downloaden via
[Code → Download ZIP](https://github.com/OpenAEC-Foundation/Y-app-ERPNext/archive/refs/heads/main.zip).
De ZIP bevat de gebouwde frontend, maar downloaden alleen installeert
de app niet op een site. Y-Next is een browserapp, geen los desktopprogramma.

### Via Claude Code importeren

Start Claude Code in een omgeving waar je bench bereikbaar is. Vul de
placeholders in en geef deze installatieopdracht:

```text
Installeer Y-Next uit https://github.com/OpenAEC-Foundation/Y-app-ERPNext,
branch main, op mijn bestaande lokale ERPNext 16-testsite.
Bench-map: <pad-naar-mijn-bench>
Site: <mijn-testsite>

Lees eerst de README. Controleer de Frappe- en ERPNext-versies en of y_next
al op de bench en op de genoemde site staat. Gebruik de gebouwde app.
Als zij nog niet is geïnstalleerd: bench get-app, daarna install-app
op uitsluitend de genoemde testsite. Controleer list-apps en open /y-next
met de bestaande ERPNext-login. Rapporteer de versie en de lokale URL.
Maak bij een bestaande installatie eerst een backup en controleer lokale
wijzigingen; overschrijf of update haar niet zonder toestemming.
Bewaar aanmeldgegevens buiten de repository.
```

Claude heeft dezelfde bench-toegang nodig als bij handmatige installatie.

## Wat zit erin?

- **Dashboard:** uren, kilometerregistratie, projecten, taken en de agenda
  van vandaag. Modulekeuzes, widgetinstellingen en ERPNext-rechten blijven
  leidend.
- **E-mail:** berichten komen binnen in ERPNext en worden gelezen via
  `Communication`. Project- en relatielinks, zoeken, schrijven, concepten,
  bijlagen en ondertekening blijven bij dezelfde site.
- **Berichten:** chat op het Frappe Framework, met de bestaande gebruikers
  en rechten.
- **Agenda:** Frappe Events en, indien geconfigureerd, agenda's van de
  mailserver.
- **Bedrijfsvoering:** projecten, planning, urenstaten, verkoop en inkoop,
  offertes, leads en de beschikbare HR-functies.
- **Apps:** Email, Berichten, Agenda, Open CAD Studio, Open Planner Studio,
  IFC Viewer, Calc en Writer.

CAD en Planner openen binnen Y-Next. De complete toolbundels worden met de
Frappe-app meegeleverd en laden pas wanneer je de tool opent, vanaf dezelfde
site. CAD gebruikt WebAssembly; Planner rekent browser-native en gebruikt
WASM voor delen van de PDF-export. Er is geen externe websitelink of CDN.
Standalone bestanden blijven lokaal; er is geen automatische upload of
ERPNext-taaksynchronisatie. CAD-bijlagen openen met de bestaande ERPNext-rechten.
De IFC Viewer kan eveneens een lokaal model openen zonder upload.

De meegeleverde bronarchieven en toollicenties staan onder
`y_next/public/app/studios/`. Planner-herstelopslag wordt per ERPNext-gebruiker
gescheiden. Informatie over bouwen en beperkingen staat op de
[ontwikkelbranch](https://github.com/OpenAEC-Foundation/Y-app-ERPNext/blob/codex/y-next-office-editors/docs/studios.md).

## Calc en Writer

Writer bewerkt `.docx`; Calc bewerkt `.xlsx` en `.xlsm`. Open een
bijlage vanuit mail of een project, upload een lokaal bestand of start een
nieuw document via Apps. Bewerk in de browser en sla een nieuwe private
bestandsversie op. Het origineel blijft beschikbaar; een ontvangen bericht
wordt niet gewijzigd of verzonden. Macro's worden niet uitgevoerd.

De editorinterface is beschikbaar in Nederlands, Engels en Duits.
Controleer een bewerkte kopie voordat je haar verder gebruikt: complexe
documentfuncties kunnen ontbreken. Onveilige externe resources worden
geweigerd; onbekende OOXML-onderdelen worden waar mogelijk behouden.

Bekende beperkingen van Calc:

- Getalinvoer gebruikt een punt als decimaalteken (`1234.5`); komma-invoer
  blijft tekst. Formules gebruiken Engelse functienamen.
- Nieuwe werkboeken houden 26 kolommen en 1.000 rijen bereikbaar na invoer,
  opslaan en heropenen. Dit wordt niet aan bestaande bestanden toegevoegd.
- De huidige editor toont nog geen zichtbare rij- en kolomkoppen.
  Het naamvak geeft de actieve cel aan.

## Instellingen

De basisapp werkt zonder aanvullende koppelingen. Optioneel:

- **ERPNext Email Account:** inkomende en uitgaande mail en de mailboxrechten.
- **Company → E-mail Signature:** huisstijlgegevens voor de ondertekening.
  Een persoonlijke ondertekening van de gebruiker heeft voorrang.
- **Agenda Koppeling:** verbinding met een mailserver die JMAP en CalDAV
  ondersteunt, voor mailserveragenda's, uitnodigingen en afwezigheidsmeldingen.
- **Y Agenda Deellink:** iCal-abonnement met een specifieke deelcode.
- **Y Next Setting:** onder meer `km-tarief`, `km-via-reisaanvraag`,
  `weekplanning-pad` en `gedeelde-postbussen`.
- **Print Formats:** factuur- en offertevoorbeelden gebruiken de formats
  en rechten van je eigen site.

## Een bestaande installatie bijwerken

Lees eerst de wijzigingen en maak een sitebackup inclusief bestanden.
Controleer in `apps/y_next` dat er geen lokale wijzigingen zijn en dat
de branch `main` is. Voer daar uit:

```bash
git pull --ff-only
```

Daarna, vanuit de bench:

```bash
bench --site jouw.site migrate
bench --site jouw.site clear-cache
bench --site jouw.site list-apps
```

Open `/y-next` opnieuw en controleer de interface. Laat in productie de
hostingbeheerder de gebruikelijke herstart uitvoeren. Appcode is gedeeld
door de sites op een bench: plan migratie en controle voor iedere betrokken
site. Een installatie uit een andere repository niet zomaar overzetten.

## Ontwikkeling en pakketindeling

`main` is het installatiepakket. De volledige frontend-bron en
ontwikkelscripts staan op
[de ontwikkelbranch](https://github.com/OpenAEC-Foundation/Y-app-ERPNext/tree/codex/y-next-office-editors).
Bouw de browserinterface daar met `node scripts/build-frappe-app.mjs`;
die komt terecht in `frappe-app/y_next/public/app/`. De inhoud van
`frappe-app/` vormt de distributie op `main`.

```text
pyproject.toml          Python-/Bench-pakketmetadata
y_next/hooks.py        Frappe-integratie en installatiehooks
y_next/api/            Serverfuncties met ERPNext-rechten
y_next/setup/          Velden, rechten en stamgegevens
y_next/y_next/doctype/ Eigen DocTypes
y_next/www/            De route /y-next
y_next/public/app/     Gebouwde frontend, workers, WASM en notices
docs/screenshots/      README-afbeeldingen
```

Wijzig geen gegenereerde JS-bundels met de hand. Ontwikkel en test op de
bronbranch, bouw opnieuw en publiceer het complete pakket. Geheimen,
sitebackups, gebruikersbestanden en lokale databasegegevens horen niet
in Git.

## Licentie

MIT — zie [license.txt](license.txt). Meegeleverde frontendcomponenten
hebben hun eigen licenties en notices onder `y_next/public/app/`.

Copyright [OpenAEC Foundation](https://github.com/OpenAEC-Foundation).
