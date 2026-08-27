# Release checklist

Vaste werkwijze voor version bumps + CHANGELOG + ReleaseNotes. Volgorde matters.

> **Gouden regel:** vertrouw nooit branchnaam, STATUS.md of CLAUDE.md voor de huidige versie. Die zijn vaak stale. Alleen de vier manifests zijn bron van waarheid.

---

## Stap 1 — Verifieer huidige versie

```bash
grep '"version"' package.json packages/frontend/package.json packages/server/package.json packages/desktop/src-tauri/tauri.conf.json
```

Alle vier moeten gelijk zijn. Als ze afwijken: éérst syncen vóór je iets anders doet.

## Stap 2 — Kies nieuwe versie (semver)

- **patch** (`0.16.0` → `0.16.1`): pure bugfixes, geen nieuwe features, geen breaking changes
- **minor** (`0.16.0` → `0.17.0`): nieuwe features, backward-compatible
- **major** (`0.16.0` → `1.0.0`): breaking changes

## Stap 3 — Bump alle vier manifests met dezelfde versie

- [`package.json`](../package.json)
- [`packages/frontend/package.json`](../packages/frontend/package.json)
- [`packages/server/package.json`](../packages/server/package.json)
- [`packages/desktop/src-tauri/tauri.conf.json`](../packages/desktop/src-tauri/tauri.conf.json)

**Niet aanraken:** `packages/frontend/src/lib/version.ts` wordt auto-derived via Vite `define`.

## Stap 4 — Update `CHANGELOG.md` (Engels, technisch)

Nieuwe entry **bovenaan**, onder de eerste `---`, append-only:

```markdown
## v0.17.0 — short descriptive headline

**Section heading (e.g. Messenger / Mail / Internals)**
- Specific change with WHY context where non-obvious
- Reference file paths or function names for future archaeologists
- Group by area, not chronologically

**Another section**
- ...
```

Regels:
- Nooit oude entries herschrijven (append-only)
- Engels voor v0.4.0+ (zoals het al staat)
- Wel intern verwijzen naar file/functie-namen — handig voor latere debugging

## Stap 5 — Update `packages/frontend/src/pages/ReleaseNotes.tsx` (NL, gebruiker-gericht)

Voeg nieuwe entry toe **bovenaan** de `LOCAL_RELEASES` array:

```typescript
{
  version: "X.Y.Z",
  date: "YYYY-MM-DD",   // ISO datum
  url: "",
  sections: [
    {
      title: "Verbeterd — Berichten",   // of "Toegevoegd —", "Opgelost —"
      items: [
        "Korte gebruikerstaal — geen file paths, geen function names",
        "...",
      ],
    },
    // 2-4 secties max, capped op ~2 schermhoogtes
  ],
},
```

Regels:
- **NL, niet EN** (gebruikers zien dit op `/release-notes`)
- **Condenseer** uit CHANGELOG — niet alle bullets kopiëren
- Secties groeperen per topic (Berichten / Mail / Taken / etc.), niet per commit
- Per versie maximaal ~10-15 bullets verdeeld over 2-4 secties
- Geen technische details ("useEffect race condition" → "scroll-positie blijft staan na 'Laad oudere berichten'")
- Topic-naam achter koppelteken; veelgebruikte vormen:
  - `Toegevoegd — <gebied>` (nieuw feature)
  - `Verbeterd — <gebied>` (enhancement bestaand feature)
  - `Opgelost — <gebied>` (bugfix)
  - `Onderhoud — <gebied>` (deps / refactor)

## Stap 6 — Verifieer vóór commit

```bash
grep '"version"' package.json packages/frontend/package.json packages/server/package.json packages/desktop/src-tauri/tauri.conf.json
```

Alle vier op nieuwe versie? Pas dán committen.

## Stap 7 — Branch naming

Branch heeft de versie **niet per se** in de naam nodig. Veiliger: feature-naam.

- `feat/webmail-standalone-view` — duidelijk, geen versie-aanname
- `fix/email-signature-not-loading` — duidelijk, geen versie-aanname
- `fix/messenger-mail-tasks-v042` — versie in naam → risico op verkeerde bump-aanname

Als je toch een versie in de branchnaam wilt: **eerst Stap 1 doen** vóór je de branchnaam kiest.

## Stap 8 — Commit + PR

```bash
git add ...
git commit -m "feat(vX.Y.Z): short headline"
git push -u origin <branch>
gh pr create --base main --title "..." --body "..."
```

CHANGELOG + ReleaseNotes update mag in dezelfde commit als de feature, of in een aparte "chore: bump version + release notes" commit. Beide acceptabel.

## Stap 9 — Deploy (na merge)

Niet auto. Handmatig:
- Productie-server: run `.github/workflows/deploy-server.yml` via Actions tab (workflow_dispatch).
- Tagged release (desktop/Android/etc.): run `.github/workflows/release.yml` met versie input zoals `v0.17.0`.

---

## Veelgemaakte fouten

- **Versie geraden uit branchnaam** → zie Stap 1 + Stap 7.
- **Vergeten `tauri.conf.json` te bumpen** → desktop build heeft dan andere versie dan frontend. Stap 3 dekt alle vier.
- **CHANGELOG entries herschreven** → append-only, oude entries blijven staan zoals ze waren.
- **ReleaseNotes met Engelse tekst of file paths** → gebruikers zien dat als ruwe technische output. NL + simpele beschrijving.
- **`lib/version.ts` hardcoded gebumped** → niet doen; Vite leest uit `packages/frontend/package.json` via `define`.
