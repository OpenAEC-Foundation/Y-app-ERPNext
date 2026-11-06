---
name: brainstorm
description: Haal een idee uit de Y-next-brainstorm op en ga ermee aan de slag in deze sessie. Gebruik deze skill zodra iemand een brainstormcode noemt ("haal brainstorm #12 op", "pak #12 uit de brainstorm", "werk idee 12 uit") of vraagt iets in de brainstorm te zetten. Vinkt onderweg punten af, zet het resultaat terug en stuurt PR- en video-ideeën door naar de skills openaec-nieuws en openaec-video.
---

# Brainstorm

De brainstorm is een pagina in Y-next. Elk idee heeft een code (#12), een titel, een
beschrijving, een checklist, labels, een datum en een deadline. Ze staan in de ERPNext
(doctype `Y Brainstorm Idee`). Je leest en schrijft ze met het script naast dit bestand:

```bash
node "<map van deze skill>/brainstorm.mjs" <opdracht> ...
```

Draai `node brainstorm.mjs` zonder opdracht voor het overzicht. Meldt het script dat het
nog niet is ingesteld, vraag dan de gebruiker om in een terminal zelf
`node brainstorm.mjs instellen <erpnext-url> <api-key> <api-secret>` te draaien. Vraag
nooit om de sleutel in de chat.

## Een idee ophalen en uitvoeren

1. **Lezen**: `toon 12` geeft het hele idee als JSON: beschrijving, checklist met
   nummers, labels, project of repo, datum, deadline, bijlagen en resultaat.
2. **Starten**: `start 12` zet de status op Bezig. Zeg in één zin wat je gaat doen en
   welke punten nog open staan.
3. **Uitvoeren**: de beschrijving en de checklist zijn de opdracht. De labels zeggen
   welke weg je neemt:

   | Labels | Wat je doet |
   |---|---|
   | **PR** of **Nieuwsbericht** | Gebruik de skill `openaec-nieuws` met dit idee als onderwerp, in plaats van de nieuwssignalen. De beschrijving en checklist zijn de inhoud; de Kanaal-labels (YouTube, LinkedIn, Instagram, Facebook, X, WhatsApp, Website) bepalen voor welke platforms je beelden, thumbnails en teksten maakt. Geen Kanaal-label: vraag welke kanalen. Volg de huisstijl en de regels van die skill (posts in het Engels; niets zelf plaatsen). |
   | **Video** | Gebruik de skill `openaec-video`. Het Programma-label zegt over welk programma de video gaat; YouTube betekent liggend, Instagram of LinkedIn vaak vierkant of staand. Combineer met PR als dat label er ook op staat: video eerst, dan de posts erbij. |
   | **Productpagina** | Werk op de OpenAEC-website volgens de productpagina-standaard. |
   | **Release** | Maak de releasetekst of het releasebericht voor het programma uit het Programma-label. |
   | anders | Doe het werk zoals de beschrijving vraagt. |

   Staat er een **project of repo** bij, werk dan in die repo of map. Een Nodig-label
   (Schermopnames, Voice-over, Input van iemand) betekent dat je dat eerst moet hebben:
   vraag erom als het ontbreekt in plaats van het te verzinnen.
4. **Afvinken**: vink een punt af zodra het echt af is: `vink 12 3` (meerdere mag:
   `vink 12 3 4`). Ontdek je iets wat erbij moet, voeg het toe met `punt 12 "tekst"`.
5. **Resultaat terugzetten**: zet een korte beschrijving of link in het idee met
   `resultaat 12 "..."` en hang gemaakte beelden, thumbnails of documenten eraan met
   `bijlage 12 <bestand> ...`. Zo ziet het team in Y-next wat er gemaakt is.
6. **Klaar**: zet een idee nooit zelf op Klaar. Vraag aan het eind: "Zal ik #12 op Klaar
   zetten?" en draai `klaar 12` pas na een ja.

## Nieuw idee

Vraagt de gebruiker om iets in de brainstorm te zetten: `nieuw "titel" "beschrijving"`.
Het komt onderaan de open ideeën; slepen in Y-next zet het hoger.

## Toon

Praat Nederlands met de gebruiker. Noem ideeën met hun code én titel ("#12 PR-video Open
Planner Studio"), nooit alleen het nummer.
