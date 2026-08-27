# Y-next architectuurontwerp

## Doel

Y-next wordt een zelfstandige webinterface bovenop één ERPNext v16-site. De
interface behoudt waar mogelijk de bruikbare onderdelen en uitstraling van
Y-app, maar verwijdert de multi-instance-architectuur en de afzonderlijke
Express-tussenlaag.

De eerste doelomgeving is:

- `https://open-aec-studio-erp.prilk.cloud`
- Frappe Framework 16.19.0
- ERPNext 16.16.0

Y-next is geen installeerbare Frappe-app en vereist geen toegang tot Bench. Een
build wordt via de standaard Frappe/ERPNext API op de site gepubliceerd.

## Besluiten

1. Y-next ondersteunt precies één ERPNext-site per deployment.
2. De browser gebruikt de bestaande ERPNext-login en sessie.
3. Functionele data wordt rechtstreeks gelezen en geschreven via de standaard
   Frappe/ERPNext API.
4. Er komt geen afzonderlijke applicatieserver, credential vault of
   ERPNext-sessioncache tussen de browser en ERPNext.
5. Een API-sleutel wordt uitsluitend lokaal gebruikt voor deployment. De sleutel
   wordt niet opgenomen in de frontend, broncode, Git-historie of gepubliceerde
   bestanden.
6. De frontend wordt op hetzelfde domein gepubliceerd, met `/y-next` als
   voorkeursroute. Daardoor blijven sessiecookies same-origin en zijn geen
   CORS-uitzonderingen nodig.
7. E-mailmigratie is fase 2. De eerste migratie verwijdert e-mailfunctionaliteit
   niet onomkeerbaar, maar sluit haar buiten de eerste oplevering totdat de
   directe ERPNext-databron en gewenste mailboxervaring afzonderlijk zijn
   ontworpen.

## Doelarchitectuur

```text
Browser
  |
  | bestaande ERPNext-sessie
  v
Y-next React-SPA op /y-next
  |
  | standaard /api/resource/* en /api/method/*
  v
ERPNext v16
  |- authenticatie en sessies
  |- rollen en permissies
  |- bedrijfsdata
  |- bestanden
  `- server-side bedrijfslogica
```

De build- en deploystroom staat buiten deze runtime:

```text
Lokale Y-next-repository
  |
  |- test
  |- productiebuild
  `- deployscript met lokale API-secret
       |
       v
ERPNext File/Web Page-documenten
```

## Repositorystrategie

De bestaande broncode van Y-app wordt éénmalig naar de nieuwe repository
`Y-app-ERPNext` gekopieerd, zonder de `.git`-directory van de bron over te nemen.
De bestaande Git-historie en remote van `Y-app-ERPNext` blijven behouden.

Niet-gecommitteerde wijzigingen uit de bronrepository worden niet stilzwijgend
meegenomen. De kopie gebruikt een expliciet gekozen Git-commit als reproduceerbaar
startpunt. Eventuele gewenste lokale bronwijzigingen worden later bewust en
afzonderlijk gemigreerd.

## Fase 1: single-instance en directe data

### Behouden

- React-interface en herbruikbare paginaonderdelen
- routering, i18n en het bestaande ontwerp waar die onafhankelijk zijn van
  multi-instancegedrag
- ERPNext-gerichte typen, formulieren en schermlogica die rechtstreeks op
  standaard APIs kunnen worden aangesloten

### Verwijderen of vervangen

- instancekiezer, instancetabs en `X-Y-App-Instance`
- account- en instance-onboarding van Y-app
- encrypted credential vault en twee-sleutelmodel
- Express proxy voor algemene ERPNext-verzoeken
- server-side ERPNext-sessioncache
- bridges en endpoints die alleen door de afzonderlijke Y-app-server nodig zijn
- desktop- en Android-specifieke single-vaultpaden uit de eerste weboplevering

### Nieuwe kernmodules

1. `erpnext-client`
   - same-origin fetch-wrapper;
   - consistente foutafhandeling;
   - ondersteuning voor resource- en method-calls;
   - geen secrets in browseropslag.
2. `session`
   - controle van de huidige ERPNext-gebruiker;
   - redirect naar de ERPNext-login wanneer de sessie ontbreekt;
   - rollen en gebruikerscontext uit ERPNext.
3. `deployment`
   - lokale configuratie via genegeerde omgevingsvariabelen;
   - upload van gehashte JS/CSS-assets;
   - aanmaken of bijwerken van de `/y-next`-websitepagina;
   - verificatie van de gepubliceerde build.

## Data- en permissiemodel

ERPNext blijft de enige bron van waarheid. Y-next respecteert de standaard
DocType-permissies van de ingelogde gebruiker. De frontend mag geen API-sleutel
gebruiken voor normale gebruikersacties en mag geen permissies omzeilen.

Schrijfacties gebruiken standaard resource- of whitelisted method-calls. Als een
benodigde bedrijfsactie niet veilig via een bestaande standaardmethode kan, wordt
de functie niet nagebootst met client-side databasegedrag. Zonder Bench-toegang
moet dan eerst worden bepaald of de actie met Server Script of een andere via de
API beheerbare ERPNext-voorziening kan worden gerealiseerd.

## Publicatie zonder Bench

Het deployscript bouwt de SPA lokaal en publiceert de output met een bevoegde
API-gebruiker:

1. controleer verbinding en ERPNext-versie;
2. bouw en test de frontend;
3. upload assets als publieke `File`-documenten;
4. maak of actualiseer de websitepagina voor `/y-next`;
5. laad de route en controleer build-id en hoofdassets;
6. behoud de vorige assetset totdat de nieuwe pagina succesvol is geverifieerd.

De eerste implementatie voert geen automatische verwijdering van oude assets
uit. Opschoning wordt pas toegevoegd wanneer rollback aantoonbaar werkt.

## Foutafhandeling

- `401` of een verlopen sessie leidt naar de ERPNext-login met terugkeer naar
  `/y-next`.
- `403` wordt als ontbrekende ERPNext-permissie getoond; Y-next probeert de
  beperking niet te omzeilen.
- Validatiefouten uit ERPNext worden omgezet naar begrijpelijke
  gebruikersmeldingen.
- Netwerkfouten krijgen een herhaalbare fouttoestand zonder dubbele
  schrijfacties.
- Het deployscript stopt bij een mislukte upload of verificatie en laat de
  laatst werkende pagina intact.

## Teststrategie

1. Unit-tests voor API-client, foutnormalisatie en sessielogica.
2. Componenttests voor de eerste gemigreerde schermen.
3. Read-only contracttests tegen de opgegeven ERPNext v16-instance.
4. Gerichte schrijfproeven met herkenbare testrecords en expliciete cleanup.
5. Browser-smoketest voor login, route, assetloading en één lees-/schrijfflow.
6. Controle dat buildoutput geen API-key, password of andere secret bevat.

## Fase 2: e-mail

E-mail krijgt een afzonderlijk ontwerp. Uitgangspunt is dat mailboxconfiguratie,
berichten en verzendacties zoveel mogelijk via ERPNext lopen. Vooraf moet worden
vastgesteld welke e-maildata ERPNext v16 daadwerkelijk als `Communication`,
`Email Queue`, `Email Account` of andere standaarddocumenten aanbiedt en welke
mailboxervaring zonder aparte IMAP-serverlaag haalbaar is.

De huidige IMAP/SMTP-cache, pushverbindingen en mailbridge worden niet klakkeloos
naar Y-next meegenomen.

## Acceptatiecriteria voor de eerste oplevering

- `/y-next` opent op de doelinstance zonder Bench-installatie.
- Een ingelogde ERPNext-gebruiker hoeft niet opnieuw in Y-next in te loggen.
- Er is geen instancekeuze of Y-app-accountflow meer.
- Minimaal één representatieve leesflow en één schrijfflow werken rechtstreeks
  via ERPNext.
- ERPNext-rollen en permissies bepalen de toegestane data.
- De frontend bevat geen deployment- of gebruikerssecret.
- De oorspronkelijke Y-app-repository blijft ongewijzigd.

## Buiten scope

- multi-instanceondersteuning;
- een eigen Y-next-gebruikersdatabase;
- een afzonderlijke Express-runtime;
- Bench-installatie of een custom Frappe-app;
- volledige e-mailmigratie in fase 1;
- desktop- en Android-releases in de eerste oplevering.
