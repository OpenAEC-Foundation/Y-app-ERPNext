# Y-next als installeerbare Frappe-app — ontwerp

## Doel

Y-next wordt een installeerbare Frappe-app (`y_next`) voor ERPNext 16, die
iedereen met `bench get-app` en `bench install-app` op een eigen site kan
zetten. De app komt in een eigen, openbare repository
`OpenAEC-Foundation/y_next`, op branch `version-16`.

Dit ontwerp vervangt het punt "Bench-installatie of een custom Frappe-app" uit
de sectie *Buiten scope* van
[`2026-07-29-y-next-architecture-design.md`](./2026-07-29-y-next-architecture-design.md).
De rest van dat ontwerp blijft gelden: één site per installatie, de bestaande
ERPNext-sessie, geen eigen applicatieserver.

## Uitgangspunten

Deze vier regels gaan voor alles wat hieronder staat.

1. **Kale ERPNext, geen afhankelijkheden.** Een site met alleen Frappe 16,
   ERPNext 16 en `y_next` levert een werkende Y-next op. Y-next mag alleen
   leunen op wat in kale ERPNext zit of wat de app zelf meebrengt.
   - geen andere apps vereist (`required_apps` bevat alleen `erpnext`);
   - geen externe dienst vereist om te starten;
   - geen Server Scripts (die staan op een verse site uit);
   - geen extra Python-pakketten (`dependencies` in `pyproject.toml` is leeg);
   - geen Node op de server (de bundel zit kant-en-klaar in de app).
2. **Generiek.** Niets wat in de app terechtkomt noemt een organisatie of
   bevat een waarde van één organisatie. Wat per organisatie verschilt, is
   gegevens: uit ERPNext zelf of uit een instelling.
3. **Eén bron.** Alle broncode staat in deze repository. De repository
   `y_next` wordt door een releasescript samengesteld en is geen plek om te
   ontwikkelen.
4. **De bestaande productiesite blijft werken.** Die draait op ERPNext 15 en
   krijgt Y-next via de publicatieroute (File-documenten plus een Web Page).
   Dezelfde frontend bedient beide routes. Op die site verandert niets zonder
   een aparte, vooraf afgestemde stap.

## Opbouw

```text
deze repository (bron)                         OpenAEC-Foundation/y_next (distributie)
├─ packages/frontend/      React-SPA           ├─ pyproject.toml
├─ frappe-app/             de Frappe-app       ├─ README.md  (link naar de bronrepository)
│  ├─ pyproject.toml                           ├─ license.txt
│  ├─ README.md                                └─ y_next/
│  └─ y_next/                                     ├─ hooks.py, modules.txt, patches.txt
│     ├─ hooks.py                                 ├─ www/y-next.html, www/y_next.py
│     ├─ www/               pagina /y-next        ├─ public/app/   (gebouwde bundel)
│     ├─ public/app/        bundel (genegeerd)    ├─ api/          (serverfuncties)
│     ├─ api/               serverfuncties        ├─ setup/        (velden, rechten, stamgegevens)
│     ├─ setup/             installatie           └─ y_next/doctype/…
│     └─ y_next/doctype/    eigen doctypes
└─ scripts/                build, release, controles
```

`frappe-app/` is de volledige app, op de bundel na. De bundel wordt gebouwd in
`frappe-app/y_next/public/app/`; die map staat in `.gitignore` van de
bronrepository en zit wél in de distributierepository.

## Onderdelen

### 1. Pagina en bundel

- **Pagina.** `y_next/www/y-next.html` is een volledig HTML-document. Frappe
  zet er dan geen websitesjabloon omheen, dus er is geen navigatiebalk of
  thema-stylesheet om weg te werken. De bijbehorende `y_next/www/y_next.py`
  zet `no_cache = 1` en levert het CSRF-token van de sessie; daarmee vervallen
  de cache-omwegen van de publicatieroute.
- **Bundel.** Dezelfde Vite-build als nu, met `base` op
  `/assets/y_next/app/` en de uitvoer in `frappe-app/y_next/public/app/`. De
  pagina leest het Vite-manifest om het startbestand en de stylesheets te
  vinden; er wordt geen HTML gegenereerd.
- **Bestandsnamen.** De build krijgt een vaste build-tag (`YNEXT_BUILD_TAG=app`).
  Onveranderde chunks houden zo tussen releases dezelfde naam, waardoor de
  distributierepository per release alleen met de gewijzigde bestanden groeit.
- **Inloggen.** Ongewijzigd: een gast ziet het eigen inlogscherm van Y-next,
  dat naar `/login?redirect-to=/y-next` verwijst.

### 2. Definities: doctypes, velden, rechten, stamgegevens

Eén set definities, in `frappe-app/y_next/setup/`, is de bron voor twee
gebruikers: de installatie van de app (`after_install` en `after_migrate`) en
het bestaande provisioneringsscript van de publicatieroute.

**Eigen doctypes** (module *Y Next*): `Y Meeting Note`, `Y Next Setting`,
`Y Onkostensoort`, `Y Km Registratie`, `Y Onkosten` — met dezelfde velden en
rechten als `scripts/provision-y-next.mjs` nu aanmaakt — de enkelvoudige
instelling `Agenda Koppeling` (adres van de mailserver, serviceaccount,
wachtwoord, aan/uit) en `Y Agenda Deellink` (een agenda delen als
iCal-abonnement; zie onderdeel 5).

**Eigen velden op standaarddoctypes.** De app maakt ze aan met
`create_custom_fields`. Startlijst, afgeleid uit wat de frontend opvraagt:

| Doctype | Veld | Type |
|---|---|---|
| Project | `custom_address` | Link → Address |
| Project | `custom_customer_reference` | Data |
| Project | `custom_project_manager` | Link → Employee |
| Project | `custom_project_manager_company` | Link → Company |
| Task | `custom_billing_type` | Select |
| Task | `custom_project_manager` | Link → Employee |
| Timesheet Detail | `custom_is_billed` | Check |
| Timesheet Detail | `custom_subject` | Data |
| Timesheet Detail | `custom_project_manager` | Link → Employee |
| Timesheet Detail | `custom_project_manager_company` | Link → Company |
| Sales Invoice | `custom_customer_reference` | Data |
| Sales Invoice | `custom_date_paid` | Date |
| Quotation | `custom_description` | Data |
| Sales Order | `custom_description` | Data |
| Company | `disabled` | Check |
| Company | huisstijlvelden, zie onderdeel 6 | |
| Email Account | `company` | Link → Company |

De lijst is af wanneer het acceptatiecriterium onder *Testen* slaagt: op een
kale site vraagt geen enkel scherm een veld op dat niet bestaat.

**Rechten en stamgegevens.** De regels uit `buildPermissionRules` en de
records uit `DEFAULT_MASTER_RECORDS` verhuizen naar de gedeelde definities.
De naamreeks-herstelstap blijft alleen in het provisioneringsscript; een verse
site heeft geen achterlopende tellers.

### 3. Serverfuncties

De Server Scripts worden gewone Python in `y_next/api/`. De hook
`override_whitelisted_methods` laat de bestaande korte namen naar de app-code
wijzen. Frappe past die hook toe vóórdat het naar Server Scripts kijkt, dus de
frontend blijft `/api/method/agenda_ophalen` aanroepen en hoeft niet te weten
welke route actief is.

| Naam | Module | Nodig |
|---|---|---|
| `mijn_postbussen` | `api/postbussen.py` | alleen ERPNext |
| `mail_bijwerken`, `mail_ophalen` | `api/mail.py` | alleen ERPNext |
| `berichten_collegas`, `berichten_foto`, `berichten_verwijderen` | `api/berichten.py` | alleen ERPNext |
| `agenda_collegas` | `api/agenda.py` | alleen ERPNext |
| `agenda_ophalen`, `agenda_schrijven` | `api/mailserver/agenda.py` | mailserver |
| `agenda_ical` | `api/mailserver/ical.py` | mailserver |
| `mail_afwezigheid` | `api/mailserver/afwezigheid.py` | mailserver |
| `mail_uitnodiging`, `mail_verwijderen` | `api/mailserver/post.py` | mailserver |
| `km_rit_boeken` | `api/hr.py` | HRMS (koppeling) |
| `y_next_mogelijkheden` (nieuw) | `api/mogelijkheden.py` | alleen ERPNext |

Regels bij het overzetten:

- De controles uit de scripts gaan één op één mee: wie er handelt komt uit de
  sessie en nooit uit het verzoek; een functie geeft niet meer terug dan het
  script deed.
- Rollen die op een kale site niet bestaan, tellen simpelweg niet mee in een
  rolcontrole; een functie mag er niet op stranden.
- Het adres van de mailserver staat nergens in code. Alle mailserverfuncties
  lezen het uit `Agenda Koppeling`, via één gedeelde client
  (`api/mailserver/client.py`).

### 4. Mogelijkheden

`y_next_mogelijkheden` geeft terug wat er op de site beschikbaar is:

```json
{
  "app_versie": "0.40.0",
  "apps": { "hrms": false, "wiki": false },
  "doctypes": { "Shift Plan": false },
  "taak_workflow": false,
  "mailserver_ingesteld": false,
  "cad_viewer": false
}
```

De pagina `/y-next` geeft dit bij het laden mee aan wie is ingelogd
(`window.y_next_mogelijkheden`); de functie zelf is er om tussentijds te
verversen. De frontend (`lib/mogelijkheden.ts`) zet het in de lijsten die
`lib/erpnext.ts` al bijhield na een mislukt verzoek, zodat dat eerste mislukte
verzoek er niet komt: een ontbrekend doctype levert meteen een lege lijst op
en een ontbrekend veld wordt niet gevraagd. Daarnaast meldt het antwoord in
`velden` per doctype welke velden er niet op elke site zijn. Geeft de pagina
niets mee — de publicatieroute zonder app — dan geldt het huidige gedrag.

### 5. Mail en agenda horen bij de kern

- De schermen Mail en Agenda staan in elke installatie in het menu.
- Zonder mailserverinstelling werkt Mail via de Email Accounts van ERPNext en
  toont de Agenda de afspraken uit ERPNext (`Event`).
- De zes mailserverfuncties zitten in elke installatie. Ze doen hun werk zodra
  `Agenda Koppeling` is ingevuld. Is dat nog niet gebeurd, dan toont de
  betreffende actie "nog niet ingesteld" met een verwijzing naar de
  instelling; geen fout en geen verborgen knop.
- De functies zijn geschreven voor een mailserver die JMAP en CalDAV spreekt
  en een serviceaccount namens gebruikers laat handelen (Stalwart). Dat staat
  in de README als vereiste voor dit onderdeel.
- Een agenda delen als iCal-abonnement gaat met een `Y Agenda Deellink`: een
  document per link, met een lange code die de app zelf maakt. Wie de link
  heeft, leest de agenda zonder inlog; uitzetten of verwijderen van het
  document trekt de link in. Er staat dus geen code meer in de broncode.

### 6. Ondertekening uit ERPNext

De ondertekening wordt bij elk nieuw bericht opgebouwd uit ERPNext en bevat
geen vaste huisstijl meer.

| Onderdeel | Bron |
|---|---|
| naam, telefoon, foto | `User`, `Employee` |
| bedrijfsnaam, logo, website | `Company` (`company_name`, `company_logo`, `website`) |
| vestigingsadres | `Address` gekoppeld aan het bedrijf |
| handelsnaam | `Company.custom_trade_name` (nieuw) |
| kleuren | `Company.custom_brand_color_dark`, `Company.custom_brand_color_accent` (nieuw) |
| LinkedIn | `Company.custom_linkedin_url` (nieuw) |
| welk bedrijf bij een postbus hoort | `Email Account.company`, anders het bedrijf van de medewerker |

Zonder ingevulde huisstijl komt er een neutrale ondertekening (naam, functie,
telefoon, bedrijfsnaam, adres). Gedeelde postbussen blijven de ondertekening
van het Email Account zelf gebruiken.

### 7. Generiek maken

| Nu vast in de code | Wordt |
|---|---|
| huisstijl in de ondertekening | velden op `Company` (onderdeel 6) |
| namen van factuuropmaken | keuze uit de Print Formats van de site, standaard de standaardopmaak |
| vaste extensies in de catalogus | lege catalogus; installeren via een adres blijft |
| adres van het weekplanning-dashboard | instelling `weekplanning-pad` in `Y Next Setting`; zonder = onderdeel verborgen |
| maildomein en `PRODID` in agenda-uitnodigingen | domein van de site, neutrale productnaam |
| voorbeeldteksten, plaatsaanduidingen, organisatielogo in `public/` | neutrale tekst; logo van het bedrijf uit ERPNext |
| organisatienamen in release-notes en roadmap | neutrale formulering |
| standaardadres van de site in scripts en `vite.config.ts` | geen standaard; altijd opgeven |

Een controle (`scripts/lib/generiek-check.mjs`) doorzoekt de samengestelde app
op een lijst met organisatienamen en vaste adressen. Een treffer keurt de
release af. De controle draait ook in `npm test` op de frontendbron.

### 8. Optionele koppelingen

Een koppeling gaat aan zodra de voorwaarde op de site vervuld is en mag bij
afwezigheid nooit een fout geven. De bijbehorende menu-onderdelen zijn dan
verborgen.

| Koppeling | Voorwaarde | Voegt toe |
|---|---|---|
| HRMS | app `hrms` geïnstalleerd | verlof en declaraties; km via reisaanvragen als de beheerder daarvoor kiest (instelling `km-via-reisaanvraag`) |
| Wiki | app `wiki` geïnstalleerd | kennisbank |
| Rooster | doctype `Shift Plan` bestaat | contracturen en roostercontroles |
| Taak-workflow | de site heeft een actieve workflow op `Task` | workflowstatussen in plaats van `status` |
| CAD-viewer | de viewerpagina staat op de site | DWG en DXF openen |

Zonder taak-workflow werkt het takenscherm met het standaardveld `status` van
ERPNext. De app installeert zelf geen workflow.

## Bestaande sites

- **Publicatieroute (productiesite, ERPNext 15).** Blijft bestaan. Het
  provisioneringsscript leest de gedeelde definities en maakt daar dezelfde
  velden aan. Een generieke build bevat de huisstijl, de factuuropmaken en de
  extensielijst van die site niet meer; die moeten daar vóór de overstap als
  gegevens zijn ingevuld. Dat is een aparte stap met een lijst vooraf.
- **Overstap van zo'n site naar de app.** Buiten dit ontwerp. Aandachtspunt
  voor later: de `Y …`-doctypes bestaan daar als maatwerk-doctypes en moeten
  bij de overstap eigendom van de app worden.

## Releasewerkwijze

`scripts/release-frappe-app.mjs`:

1. controleert dat de werkmap schoon is en dat tests en typecontrole slagen;
2. bouwt de bundel in app-modus;
3. kopieert `frappe-app/` naar een checkout van `y_next` (branch
   `version-16`) en zet de versie uit `package.json` in `y_next/__init__.py`;
4. draait de generiek-controle op het resultaat;
5. maakt één commit `Release <versie>` en de tag `v<versie>`;
6. pusht en maakt de GitHub-release — alleen met een uitdrukkelijke vlag.

De versie van de app is de versie van Y-next. De eerste app-release is
`0.40.0`. De repository wordt eerst privé aangemaakt; openbaar zetten en
publiceren gebeurt op een apart teken.

## Testen

- **Python.** `bench --site <testsite> run-tests --app y_next`: de pagina, de
  installatie (velden, rechten, stamgegevens, idempotent) en elke
  serverfunctie, inclusief de afwijzingen (verkeerde rol, andermans gegevens).
- **Node.** De bestaande `node --test`-suites, aangevuld met tests voor het
  build- en releasescript, de generiek-controle en een pariteitstest: elke
  methodenaam die de frontend aanroept, staat in `override_whitelisted_methods`.
- **Mailserver.** Een aparte testmailserver in de lokale bench-opstelling. De
  keten wordt daartegen getest: agenda ophalen, afspraak maken, uitnodiging
  beantwoorden, afwezigheid aan en uit, bericht verwijderen, iCal-abonnement.
- **Acceptatie.** Op een verse site met alleen Frappe, ERPNext en `y_next`
  opent elk zichtbaar menu-onderdeel zonder één mislukt API-verzoek. Dit is
  een geautomatiseerde doorloop. Een tweede site met HRMS en Wiki controleert
  dat de koppelingen aangaan.

## Veiligheid

- Geen geheimen in code, git of buildoutput. Het wachtwoord van het
  serviceaccount staat in een `Password`-veld.
- `agenda_ical` is de enige functie die zonder sessie bereikbaar is. Zij
  werkt alleen met de code van een actieve `Y Agenda Deellink`, die alleen
  een beheerder kan aanmaken en inzien, en is begrensd in het aantal
  verzoeken per uur.
- `berichten_foto` blijft alleen foto's van actieve medewerkers doorgeven aan
  ingelogde medewerkers.
- De sandbox van extensies verandert niet.

## Buiten scope

- een versie van de app voor ERPNext 15;
- de overstap van een bestaande site van de publicatieroute naar de app;
- ondersteuning voor andere mailservers dan hierboven beschreven;
- een eigen roosterdoctype of een meegeleverde taak-workflow;
- het opschonen van `docs/`, `CHANGELOG.md` en de git-geschiedenis van de
  bronrepository;
- berichten via NextCloud Talk, documenten en wachtwoorden (blijven inactief);
- de desktop- en Android-varianten.

## Fasering

Elke fase levert werkende, testbare software op en krijgt een eigen
uitvoeringsplan in `docs/superpowers/plans/`.

| Fase | Oplevering |
|---|---|
| 1 | Skelet, pagina en bundel: de app installeert op een kale site en `/y-next` komt uit de app |
| 2 | Definities uit één bron: doctypes, velden, rechten, stamgegevens; provisioneringsscript erop aangesloten |
| 3 | Mogelijkheden en een frontend zonder aannames: taken op `status`, optionele onderdelen verborgen; doorloop zonder mislukte verzoeken |
| 4 | De zeven serverfuncties die alleen ERPNext nodig hebben |
| 5 | Mailserver: zes functies, de instelling en de testmailserver |
| 6 | Koppelingen: HRMS (`km_rit_boeken`), Wiki, rooster, CAD-viewer |
| 7 | Generiek maken, ondertekening en de generiek-controle |
| 8 | Release: repository, README, versie 0.40.0, tag en GitHub-release |
