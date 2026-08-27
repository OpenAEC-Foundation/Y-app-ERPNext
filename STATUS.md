# STATUS.md

Short-lived notes on what's actively being worked on right now. Update / reset this file whenever work lands on `main`. If you're wondering "what's the state of the repo today", read this — but never assume it's still accurate. Verify against `git log` and the running CI.

**For stable architecture:** see [`CLAUDE.md`](./CLAUDE.md).
**For release history:** see [`CHANGELOG.md`](./CHANGELOG.md).

---

## In progress

### 2026-07-02 — Codebase-herstructurering: god-files splitsen, tests-eerst (gedrag-behoudend)

Grote, **gedrag-behoudende** opschoning van de codebase: dode code weg, "god-files" opgesplitst in cohesieve modules, en een test-vangnet opgebouwd dat er niet was (**0 → 90 tests**). Elke stap is verbatim geverifieerd (regel-set-vergelijking oud↔nieuw), langs `build` + `node:test` + gerichte `tsc`, en meerdere flows zijn **live via Playwright** tegen de echte mailbox/Talk/CalDAV getest.

**Gemerged op `main`:**
- **PR #74** — de hele `feature/mail-body-cache-offline`-backlog (mail-body-cache + storm-fixes + desktop v0.26–v0.28.10 + "Sorteer in projectmap"). 144 commits.
- **PR #83** (Fase 1) — 6 dode files weg (~632 rgls) + server `test`-script (`tsx --test`) + `CLAUDE.md` extensions-sectie verzoend met de echte runtime-remote-extension-realiteit.
- **PR #84** (Fase 2a) — `crypto-primitives.ts` afgesplitst van `crypto.ts` + `decryptToString/decryptToJson`-dedup.
- **PR #85** (Fase 2c) — `messenger.ts` 1643→1064: providers → `messenger/{types,nextcloud,telegram,teams,noise-filter}.ts`.
- **PR #86** (Fase 2b) — `index.ts` 2479→1638: calendar/CalDAV + uren-stats → `routes/{calendar,stats}.ts` (middleware-volgorde intact).
- **PR #87** (Fase 3) — `mail.ts` 4016→3901: `mail/{errors,address,parse}.ts` + 12 karakterisatie-tests.

**Open:**
- **[PR #88](https://github.com/OpenAEC-Foundation/Y-app/pull/88)** (Fase 4) — de volledige `Webmail.tsx`-split: formatters + 9 lib-modules + 9 componenten → `components/mail/*` + 5 bugfixes. **7189 → 3530 regels.** Frontend test-infra vastgelegd (`npm test` = `node --test`, Node 24 native TS-strip; géén vitest/jsdom nodig; `*.test.ts` in tsconfig-exclude). Detail in de "Fase 4 UITGEVOERD"-sectie hieronder. Nog niet gepusht na `dff93b4`/`0a57d1e` (wacht op push-akkoord).

**Stand:** alles groen (server `npm test` 70/70, frontend 8/8, builds schoon). Bevinding onderweg: de meeste "shared-helper"-duplicaten uit de review waren false-positives (normalize/slugify, e-mailadres-parsers, dav-xml — semantisch verschillend, deels persistente sleutels) → bewust NIET samengevoegd; de echte winst zit in de splits. Programma-geheugen: `~/.claude/.../memory/project_yapp_refactoring_program.md`.

### Fase 4 UITGEVOERD (2026-07-02): Webmail.tsx opgesplitst + bugfixes

`Webmail.tsx` **7189 → 3530 regels**. Op branch `refactor/webmail-split` (in [PR #88](https://github.com/OpenAEC-Foundation/Y-app/pull/88)), commits:
- `lib/mail-types.ts` (gedeelde types) — `b0ddb4c`
- **9 lib-modules + 12 tests** (mail-badge, sent-detect, folder-icons, mail-markread [de `\Seen`-race-cluster], mail-signature-cache, folder-prefs, imap-config, mail-folder-cache-ls, mail-categories) — `fb5cf52`
- **9 componenten → `components/mail/*`** (Mobile / AddShared / Thread / CreateFolder / FolderTree / ImapSetup / ReadingPane / Floating / Compose) — `dff93b4`
- **5 geverifieerde bugfixes** — `0a57d1e`: #2 ReadingPane lookup-race (cancelled-guard), #8 CRM-zoek-race, #4 loadConversation verkeerde folder, #6 modal-autofill clobber, #7 bulk-delete N-confirms.

Verbatim geverifieerd (regel-set-vergelijking oud↔nieuw); `tsc -b` + `vite build` groen; 20 frontend-tests; eslint Webmail **12 → ~2 errors**. **Live via Playwright getest** (echte mailbox): FolderTree, ReadingPane + ThreadAboveMail, ComposeWindow + handtekening, conversatie-block én de bugfix-happy-paths — alles werkt, geen nieuwe console-errors. Ongecommit `Leave.tsx`-werk (overuren) is bewust NIET meegecommit.

**Bugfixes afgerond** (2e batch, commits `672edcf` + `80e4529`): #13 debug-logs weg, #14 i18n-gaten (cross-account-alerts + forwarded-attachment via `t()`), #10 `no-explicit-any` in de verplaatste componenten, #5 deep-link cache-key account-bewust (dead-ish pad, defensief), #1 toast-severity locale-robuust (NL/EN/DE via regex i.p.v. `includes("mislukt")`). eslint Webmail nu 2 err/8 warn.

**Bewust NIET gedaan:** #3 (`activeConfig` `useMemo`) + #9 (deps) — gedrag-risico (memoizen van een `localStorage`-lezende waarde → staleness bij IMAP-instellingen-edit voor het actieve shared/vault-account) weegt niet op tegen de interne perf-winst; niet nodig voor deze scope. Optioneel later: `mail.ts` `MailAccountCache`-klasse verder afslanken + Fase 5 TS↔Rust drift-safety.

> Overdrachtsdocument met de volledige extractie-kaart + buglijst: [`docs/refactor/2026-07-02-webmail-split-handoff.md`](./docs/refactor/2026-07-02-webmail-split-handoff.md).

---

## Backlog (los van de herstructurering)

- **Echte in-app updater** (Tauri) i.p.v. de "ga naar Releases"-banner: `tauri-plugin-updater` + updater-signing-keypair (private key = repo-secret, public in `tauri.conf.json`) + VPS-gehost gesigneerd `latest.json` + installers. Doel: update-in-place met user-confirm, geen volledige re-install. Operator-stappen eerst uitschrijven.
- **iMIP via de ERPNext-relay** — accounts die via de relay versturen (bv. piet@3bm.co.nl) sturen de `.ics`-uitnodiging nog niet mee (alleen het directe-SMTP-pad doet dat).
- **Popouts op desktop** (Tauri multi-window) — losgekoppelde mail-/messenger-vensters, analoog aan de web-popouts; hangt af van de auto-unlock.
- **Dependabot** — GitHub meldt 47 kwetsbaarheden op de default branch (1 critical / 16 high). Los van de refactor; apart oppakken.

---

## Known dev-environment quirks

- **Volledige lokale stack** (voor server+frontend-tests): `cd packages/server && npm run dev` (3500) + `cd packages/frontend && npx vite --port 5173 --strictPort` (géén `VITE_API_TARGET` → proxyt naar 3500). `master.key` + `sessions.db` staan in `~/.erpnext-level/`.
- **Frontend pure-logica testen zonder install**: `cd packages/frontend && npm test` → `node --test` (Node 24 native TS-strip). Geen vitest/jsdom nodig. Component-render-tests vereisen wél een harness (geparkeerd, zie boven).
- **Server tsc is géén schone gate**: de hele server importeert met `.ts`-extensies zonder `allowImportingTsExtensions` → `tsc --noEmit` geeft ~72 TS5097-ruis + ~25 pre-existing echte fouten. De echte build is esbuild (`npm run build`). Gebruik `tsc --noEmit | grep -v TS5097` en houd de echte-fout-telling op 25.
- **`npm install` on Z: drive fails** with `UNKNOWN: unknown error, symlink` (workspace-symlink). Workaround: per-package + evt. `--no-workspaces --legacy-peer-deps`. **Nooit een npm install draaien terwijl de vite dev-server draait** — dat corrumpeert `node_modules` (concurrent write). Stop vite eerst.
- **`git pull` / `git checkout` on Z: drive can fail mid-way** with `File exists`. Recovery: `git reset --hard origin/<branch>`.
- **`gh pr merge --admin` wordt door de auto-mode classifier geblokkeerd** voor agent-geschreven PR's → Piet merget zelf in de GitHub UI (admin-override).
- **`<img src="/api/...">` werkt niet op desktop** — fetch-adapter onderschept alleen `fetch()`. Afbeeldingsbytes als `data:`-URL embedden.
- **NextCloud Talk lokaal**: bereikbaar mits NC-creds in `localStorage` (`pref_${instanceId}_messenger_nextcloud-talk_{url,user,pass}`, URL met `https://`).
- **iframe srcdoc base URL = `about:srcdoc`** — absolute `/api/...`-paden vereisen een geïnjecteerde `<base href>`.
- **Top-level `await import(...)` in `packages/server/src/`** breekt de esbuild-bundle. Statische imports gebruiken.
- **Meerdere `WebSocketServer({server, path})`** conflicteren — `noServer: true` + handmatige upgrade-routing.

---

_Last updated 2026-07-02. Codebase-herstructurering loopt: PR #74 + Fase 1–3 (#83–#87) gemerged op `main`; Fase 4-start (#88, Webmail formatters + frontend test-infra) open. Tests 0→78. Morgen verder met de Webmail inline-componenten (→ `components/mail/*`). Zie geheugen `project_yapp_refactoring_program.md`._
