# Medewerkers — contracturen, shifts, verlof & feestdagen

> **Korte voorzet — wordt nog aangevuld.** Doel: één plek waar staat hoe
> per medewerker de contracturen, werkdagen en verlof in ERPNext worden
> geconfigureerd, en welk doctype Y-app waarvoor leest.

---

## Het mentaal model (1 minuut)

Voor elke medewerker geldt: **hoeveel uur moet die per dag/week werken**
en **welke dagen zijn vrij**? In ERPNext is dat verdeeld over meerdere
doctypes — geen één veld op de Employee dat het allemaal vastlegt.

```
Employee
  ├─ date_of_joining       — startdatum bij 3BM
  ├─ contract_end_date     — einde contract (optioneel)
  ├─ holiday_list          — welke feestdagen voor deze medewerker tellen
  │                          (verwijst naar Holiday List doctype)
  └─ shift assignments     — welke werkweek (uren per dag) gold wanneer
       └─ Shift Assignment ──► Shift Type ──► totaal contracturen / week
```

Plus:
- **Leave Allocation** — hoeveel verlof-uren krijgt deze medewerker per
  jaar per verloftype (vakantie, ziek, ouderschap, …)
- **Leave Application** — daadwerkelijk opgenomen verlof (per dag of
  dagdeel)
- **Holiday List** (per medewerker of per company) — de feestdagen die
  niet als werkdag tellen

---

## De belangrijkste 4 doctypes

### 1. Shift Type
Definieert een werkpatroon: bv. "40u / week" of "32u / 4 dagen".
Bevat per dag van de week het aantal uren.

### 2. Shift Assignment
Koppelt een **Employee** aan een **Shift Type** voor een periode
(`from_date` / `to_date`). Eén medewerker kan meerdere assignments
hebben — bv. fulltime tot juni, daarna parttime.

Y-app leest deze (via `lib/shiftHours.ts`) om te bepalen:
- Hoeveel uur per dag mag/moet deze medewerker werken?
- Op welke dagen van de week is hij/zij vrij?
- Wat zijn de "missende werkdagen" als er geen uren op zijn geboekt?

### 3. Holiday List
Een lijst van feestdagen + (optioneel) weekend-dagen. Y-app gebruikt:
- `Employee.holiday_list` → per-medewerker lijst (kan afwijken per
  contract, denk aan internationale medewerkers met andere feestdagen)
- Fallback: de hardcoded NL-feestdagenlijst in
  `lib/employeeHolidays.ts`

### 4. Leave Application
Een door de medewerker ingediende verlof-aanvraag (één rij per
aaneengesloten periode + verloftype). Y-app filtert op `status =
"Approved"` en gebruikt het om:
- Verlof-dagen uit te sluiten uit "missende uren"-checks
- Het verlof-saldo bij te houden (Leave Allocation − goedgekeurd)
- De verlof-kalender op het dashboard te tonen

---

## Hoe Y-app dit toepast

| Y-app onderdeel                          | Welk doctype gebruikt het?                                  |
|------------------------------------------|-------------------------------------------------------------|
| "Uren vandaag" / urenregistratie         | Shift Assignment + Shift Type → contracturen per dag        |
| "Missende werkdagen" widget              | Shift workdays − Holiday List − Leave − pre-joining-dagen   |
| Goedkeuren-tab +/- delta                 | Shift workdays in periode × uren per dag − goedgekeurde uren|
| Vakantieplanning (Leave Modal)           | Holiday List + bestaande Leave Applications + workdays      |
| Verlofsaldo                              | Leave Allocation − goedgekeurde Leave Applications          |

> Belangrijk: Y-app rekent **per medewerker** met de juiste Holiday
> List, niet generiek. Een medewerker met een andere `holiday_list`
> krijgt andere "missende dagen" / verlof-dagen.

---

## Veelvoorkomende valkuilen

| Symptoom                                            | Oorzaak                                                                                |
|-----------------------------------------------------|----------------------------------------------------------------------------------------|
| Medewerker krijgt 40u verwacht maar werkt parttime  | Geen actief Shift Assignment in deze periode → Y-app valt terug op 40u default          |
| "Missende werkdagen" toont een feestdag             | `Employee.holiday_list` is leeg → fallback op hardcoded lijst die mogelijk afwijkt      |
| Verlof telt dubbel (parttimer)                      | Leave Application loopt over niet-werkdagen — Y-app splitst dit bij indienen           |
| Nieuwe medewerker krijgt verkeerde delta            | `date_of_joining` niet ingevuld → uren vóór joining tellen mee als "missend"           |

---

## Te documenteren (TODO — door Piet)

- [ ] Concrete checklist bij **nieuwe medewerker aannemen**: welke
      doctypes in welke volgorde moeten worden ingevuld
- [ ] Hoe ga je om met **contractwijziging** (parttime ⇄ fulltime
      midden in het jaar)
- [ ] **0-uren contract** — wat zet je op Shift Assignment? (zie O03)
- [ ] **Stagiair / freelancer** — moet die uberhaupt een Shift Type?
- [ ] **Internationale medewerker** — eigen Holiday List of
      Nederlandse?
- [ ] Hoe Y-app's **rate per medewerker** (Activity Type per medewerker)
      hier in past — werknemer ziet enkel zijn eigen activity-types
- [ ] **Salaris-administratie** koppeling — out of scope of niet?

---

_Stub aangemaakt 2026-05-17 — uitleg-overlay live op `/employees`
via info-icoon naast de pagina-titel._
