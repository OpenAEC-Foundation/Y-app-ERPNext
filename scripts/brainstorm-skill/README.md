# Brainstorm-skill voor Claude Code

Met deze skill haal je in een Claude Code-sessie een idee uit de Y-next-brainstorm op
("haal brainstorm #12 op"). Claude zet het op Bezig, werkt het uit, vinkt punten af en
zet het resultaat terug. PR-ideeën gaan naar de skill `openaec-nieuws`, video's naar
`openaec-video`.

## Installeren

1. Kopieer deze map naar de skills-map van je project of je gebruiker, bijvoorbeeld
   `~/.claude/skills/brainstorm/`.
2. Maak in de ERPNext een API-sleutel: open je gebruiker (Instellingen → Mijn
   instellingen), tab **API Access**, en kies **Generate Keys**. Bewaar het secret, het
   wordt maar één keer getoond.
3. Draai in een terminal (niet in de chat):

   ```bash
   node ~/.claude/skills/brainstorm/brainstorm.mjs instellen https://jouw.erpnext.nl <api-key> <api-secret>
   ```

   Dat schrijft `~/.brainstorm.json`. In plaats daarvan kun je ook de omgevingsvariabelen
   `BRAINSTORM_URL`, `BRAINSTORM_KEY` en `BRAINSTORM_SECRET` zetten.
4. Test met `node ~/.claude/skills/brainstorm/brainstorm.mjs lijst`.

De doctypes komen met de Y-next-app mee (of met scripts/provision-y-next.mjs op een site zonder de app),
Node 18 of nieuwer is nodig.

Het script werkt met de rechten van de gebruiker van wie de sleutel is. Die heeft de rol
Employee of System Manager nodig.
