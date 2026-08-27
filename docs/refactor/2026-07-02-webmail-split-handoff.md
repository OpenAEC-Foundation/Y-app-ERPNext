# Overdracht: Webmail.tsx opsplitsen + bugfixes (Fase 4)

> **Voor de uitvoerende sessie.** Dit document is zelfstandig leesbaar: het bevat de volledige extractie-kaart, de geverifieerde buglijst, de werkvolgorde en het verificatierecept. Regelnummers gelden bij commit `227c562` op branch `refactor/webmail-split` — bij drift: zoek op symboolnaam, niet op regelnummer.
>
> Lees eerst: `CLAUDE.md` (sectie "Module-indeling" + de Webmail-gedragssecties) en `STATUS.md`.

## Doel

`packages/frontend/src/pages/Webmail.tsx` (**7124 regels**) opsplitsen: ~9 inline componenten → `components/mail/*`, gedeelde helpers → `lib/*`, plus een korte lijst **geverifieerde bugfixes**. Alles **gedrag-behoudend** en in **kleine, apart geverifieerde commits**. Dit is het vervolg op PR #83–#88 (zelfde patroon: verbatim move → verify → commit).

## Harde regels

1. **Moves zijn verbatim.** Function-bodies, JSX, comments: exact kopiëren. Alleen toevoegen: `export`, imports, en type-imports. Bugfixes gebeuren **nooit** in dezelfde commit als een move (anders faalt de verbatim-check en is review onmogelijk).
2. **Eén slice per commit**, elke commit groen (zie verificatierecept). Nooit twee componenten in één commit.
3. **Module-mutabele state mag nooit dupliceren.** `signatureCache`, `recentLocallyMarkedRead`, `fullMsgCache` zijn module-globale Maps — elk moet in precies één module leven en geïmporteerd worden. Een tweede instantie = subtiele cache-bugs.
4. **Git:** commit op `refactor/webmail-split`; **nooit pushen zonder Piet te vragen**. PR-merges doet Piet zelf in de GitHub UI.
5. **Z:-schijf:** géén `npm install` (faalt op workspace-symlink; en NOOIT naast een draaiende vite — corrumpeert `node_modules`). Alles hieronder werkt zonder install.
6. **Scope:** geen features, geen "verbeteringen" buiten de bug-lijst hieronder, geen styling-wijzigingen.

## Verificatierecept (per slice)

```powershell
cd packages\frontend
node .\node_modules\typescript\bin\tsc -b            # exit 0
node .\node_modules\vite\bin\vite.js build           # exit 0
npm test                                             # node --test, alle groen (nu 8)
node .\node_modules\eslint\bin\eslint.js src/pages/Webmail.tsx src/components/mail src/lib --no-error-on-unmatched-pattern
#   baseline Webmail.tsx: 12 errors / 11 warnings — mag alleen DALEN
```

**Verbatim-check per move** (Git Bash), moet leeg zijn op signature-/import-regels na:

```bash
comm -23 <(git diff -- packages/frontend/src/pages/Webmail.tsx | grep '^-' | grep -v '^--- ' | sed 's/^-//' | grep -vE '^\s*$' | sort -u) \
         <(grep -vE '^\s*$' <NIEUW_BESTAND> | sort -u)
```

**Live smoke (einde van de reeks, of na risicovolle slices):** volledige lokale stack — `cd packages/server && npm run dev` (3500) + `cd packages/frontend && npx vite --port 5173 --strictPort` (géén `VITE_API_TARGET`). Piet is doorgaans al ingelogd in de Playwright-browser. Checklist:
- Webmail openen → mappen + berichtenlijst laden (datum-groepen, afzenders)
- Mail openen → body + conversatie-blok ("Alle berichten in deze conversatie")
- Mail openen vanuit een **submap-zoekresultaat** (regressietest bug #4)
- Compose openen (Beantwoorden) → handtekening verschijnt, venster sleepbaar
- FolderTree: map in-/uitklappen, rechtsklik-contextmenu, favoriet-ster, mail naar map slepen
- E-mailinstellingen-dialog (ImapSetup) openen → cache-groottes tonen
- Toast-kleuren: forceer een mislukte move (bug #1-regressie)

---

## Deel A — Extractie-kaart

### A1. Lokale types (verplaats eerst — Slice 1)

Nieuw bestand **`lib/mail-types.ts`** met de SHARED types; LOCAL types reizen met hun component mee.

| Type | Regel | Gebruikers | Bestemming |
|---|---|---|---|
| `AttachmentMeta` | 83 | alleen `MailMessageFull` | mee met `MailMessageFull` → `lib/mail-types.ts` |
| `MailMessageFull extends MailMessage` | 91 | ReadingPane, FloatingMailWindow, ThreadAboveMail, main (12+ plekken) | **`lib/mail-types.ts`** |
| `MailFolder` | 106 | ImapSetup, FolderTree, helpers, main | **`lib/mail-types.ts`** |
| `ForwardedAttachment` | 355 | ComposeState, ComposeWindow, main | **`lib/mail-types.ts`** |
| `ComposeState` | 362 | ComposeWindow, main | **`lib/mail-types.ts`** |
| `SendPayload` | 1126 | ComposeWindow, main | **`lib/mail-types.ts`** |
| `FolderNode` | 2888 | alleen buildFolderTree + FolderTree | mee met FolderTree |
| `CachedSignature` | 436 | alleen signature-cluster | mee met signature-module |

`MailMessage`/`MailAddress`/`ImapConfig`/`SharedMailbox` blijven in `lib/webmail-prefetch` (niet verplaatsen). `Webmail.tsx` her-importeert de verplaatste types.

### A2. Gedeelde lib-modules (Slice 2 — pure logica, tests-eerst met `node --test`)

| Nieuw bestand | Symbolen (regel) | Let op |
|---|---|---|
| `lib/mail-markread.ts` | `RECENT_LOCAL_MARK_READ_TTL_MS`(159), `RECENT_MARK_READ_LS_KEY`(160), `loadRecentMarkReadMap`(162), `saveRecentMarkReadMap`(178), **`recentLocallyMarkedRead`**(189, mutabele Map!), `isRecentLocalMarkRead`(191), `trackLocalMarkRead`(203), `applyRecentReadOverlay`(213), `countRecentLocalMarkReadInFolder`(227), `applyRecentReadOverlayToFolders`(239) | **Atomische unit** — alle 8 fns + Map in één module. Dit is de `\Seen`-race-fix (CLAUDE.md "Mark-read TTL-Set"). Schrijf tests: TTL-window, overlay op msgs+folders, count. |
| `lib/folder-icons.ts` | `FOLDER_ICONS`(565), `getFolderIcon`(571), `getFolderIconColor`(589) | SHARED (FolderTree + main). Puur; test de naam→icoon-mapping. |
| `lib/folder-prefs.ts` | `DEFAULT_HIDDEN_FOLDERS`(2905), `getHiddenFolders`(2907), `setHiddenFolders`(2915), `getFavoriteFolders`(2930), `setFavoriteFolders`(2938), `getSentFolderOverride`(2960), `setSentFolderOverride`(2964), `getTrashFolderOverride`(2973), `setTrashFolderOverride`(2977), `hydrateFolderPrefs`(2986) | LS + fire-and-forget PUT naar `/api/instances/.../settings/*` — gedrag exact behouden. |
| `lib/imap-config.ts` | `clearPrimaryImapConfig`(325), `loadAccountOrder`(339), `saveAccountOrder`(343), `orderVaultAccounts`(348), `sanitizeHost`(393), `saveImapConfig`(401) | `saveImapConfig` is SHARED (ImapSetup + main). `sanitizeHost` puur → testje. |
| `lib/mail-signature-cache.ts` | **`signatureCache`**(385, mutabele Map!), `SIGNATURE_REFRESH_MS`(434), `CachedSignature`(436), `isEffectivelySignatureEmpty`(443, gebruikt `document`), `fetchEmailSignature`(457), `clearSignatureCache`(547, al ge-export — behouden) | **Atomische unit.** Map wordt door ImapSetup (837) én ComposeWindow (1403) beschreven — nooit dupliceren. |
| `lib/sent-detect.ts` | `isSentParent`(3361), `isSentContext`(3370) | Puur → tests (Sent-naam-varianten NL/EN). |
| `lib/mail-folder-cache-ls.ts` | `MAIL_FOLDER_CACHE_MAX`(2826), `_mailFolderCacheKey`(2827), `_mailFolderIndexKey`(2830), `readMailFolderCache`(2833), `persistMailFolderCache`(2845) | Al ge-export; **onderscheid van de IDB-varianten** die bij import 29–30 ge-aliased zijn — naam niet laten botsen. Lost ook lint #11 op (react-refresh/only-export-components). |
| `lib/mail-badge.ts` | `BADGE_EXCLUDED_SPECIAL_USE`(116), `BADGE_EXCLUDED_NAMES`(120), `shouldCountForBadge`(130) | Puur → test ("Email-badge telt alleen INBOX", CLAUDE.md). |
| `lib/mail-categories.ts` + `lib/mail-replied.ts` (mag samen in één module) | `EMAIL_CATEGORIES`(635), `getCategoryMap`(643), `setCategoryForMessage`(650); `getRepliedMessages`(661), `markAsReplied`(668), `isReplied`(675) | LS-backed, main-only. |

Main-only en mag in Webmail.tsx blijven (lagere prioriteit): `warmupAllFolders`(256), `fullMsgCache`(384), `PAGE_SIZE`(3720).

### A3. Componenten → `components/mail/*` (Slices 3–11, oplopend risico)

**Kernbevinding: geen van de 9 componenten sluit over `Webmail()`-page-state heen — alles loopt via props/callbacks.** Geen hook-herschrijvingen nodig. Volgorde (veilig → risicovol):

| # | Component | Regels | Props (samengevat) | Deps uit Webmail.tsx | Risico-vlaggen |
|---|---|---|---|---|---|
| 1 | `MobileMailboxDropdown` | 3726–3788 | `{activeAcct, primaryLabel, sharedMailboxes, onSelect, onAdd}` | alleen type `SharedMailbox` (import) | geen — schoonste start |
| 2 | `AddSharedMailboxDialog` | 3621–3717 | `{onAdd, onCancel, existingEmails, primaryEmail}` | geen | fetch `/api/mail/test-shared`; verder self-contained |
| 3 | `ThreadAboveMail` | 2753–2808 | `{messages, currentUid, currentFolder, accountEmail, onOpenMessage}` | `senderShort`(2712), `recipientShort`(2722), `fmtThreadDateTime`(2732), `isThreadOutgoing`(2746) — alle LOCAL, reizen mee | geen — puur presentationeel |
| 4 | `CreateFolderModal` | 3389–3617 | `{parentPath, projects, onConfirm, onCancel}` | `isSentParent` (SHARED → uit `lib/sent-detect`) | `document.addEventListener("mousedown")` met cleanup (3444) |
| 5 | `FolderTree` | 3009–3356 | `{folders, activeFolder, onSelect, onDropMessage?, onCreateFolder?, onRenameFolder?, onDeleteFolder?, collapsed?}` | `buildFolderTree`(2890)+`FolderNode`(2888) reizen mee; `getFolderIcon`/`getFolderIconColor`, folder-prefs (uit lib-modules) | 2 globale listeners met cleanup (3058, 3102); LS + fire-and-forget PUT via prefs |
| 6 | `ImapSetup` | 688–1118 | `{config, onSave, onCancel?, folders?}` | `sanitizeHost`+`formatBytes`(682) reizen mee (of formatBytes → `lib/mail-format`); `saveImapConfig`, `signatureCache`, sent/trash-overrides (uit lib-modules) | schrijft `signatureCache` (837); AbortController+interval met cleanup; fetch `/api/mail/test`+`/auto-config` |
| 7 | `ReadingPane` | 2004–2555 | 18 props, zie regel 2004 (message + 14 callbacks + conversation-props) | `scoreProjectMatch`(1970) reist mee; rendert `ThreadAboveMail` (import uit #3) + `MessageAttachments` (bestaat al) | fetches naar ERPNext (zie **bug #2** — fix ná de move, aparte commit); `window.open`; iframe `srcDoc` |
| 8 | `FloatingMailWindow` | 2559–2698 | `{msg, folder, offsetIndex, onClose, onReply, onReplyAll, onForward}` | rendert `ReadingPane` (import uit #7) — **dus ná #7** | imperatieve window-listeners in startDrag/startResize (2598–2602, 2625–2628) met cleanup; geeft ReadingPane bewust géén attachment/thread-handlers (gedrag zo houden) |
| 9 | `ComposeWindow` | 1137–1965 | `{compose, onClose, onSendBackground, config}` | `playSendSound`(615) reist mee; signature-cluster (uit `lib/mail-signature-cache`); types uit `lib/mail-types` | grootste (830 rgls): contentEditable + `document.execCommand`, globale mousemove/mouseup-listeners (1452–1454, met cleanup), ~22 useState/~13 useRef — maar props-only, dus verbatim verplaatsbaar |

Per component-move: imports opbouwen uit de kolommen hierboven (lucide-iconen, `useTranslation`, `useIsMobile`, `DataContext`, etc. — de exacte lijsten staan per component in de brontekst; `tsc` vangt elke misser).

---

## Deel B — Bugfixes (geverifieerd; elk een eigen commit, LOS van moves)

### Echte bugs (eerst)

1. **[BUG] Toast-severity via NL-substring-sniffing** — `Webmail.tsx:7092–7099`. Kleur/icoon bepaald door `toast.includes("mislukt")`/`("wordt")`; onder EN/DE-locale krijgt een **mislukte** move/delete de groene succes-styling. Fix: toast-state uitbreiden naar `{ text: string; kind: "error"|"info"|"success" }` en alle `setToast(...)`-callsites de kind meegeven; rendering op `kind` baseren.
2. **[BUG] ReadingPane ERPNext/Contact-lookup zonder race-guard** — `2037–2093`. Snel A→B klikken: trage response van A overschrijft de pane van B (`setErpnextComm`/`setContactStatus`). Fix: `let cancelled = false` + guard + cleanup-return (patroon staat al goed in ImapSetup 730–742). **Uitvoeren ná de ReadingPane-move** (in het nieuwe bestand).
3. **[LATENT, hoogste hefboom] `activeConfig` is elk render een nieuw object** — `3886–3888`. Daardoor memoizen `bq`/`loadFolders`/`loadMessages`/`handleBackgroundSend` nooit en her-registreert de `y-app:mail-changed`-listener (4833–4840) elk render. Fix: `useMemo` om `activeConfig`. Dit maakt ook de exhaustive-deps-arrays (#9/#12 hieronder) eerlijk. **Doe dit vroeg** — het stabiliseert alles erna.
4. **[LATENT] `loadConversation` gebruikt `activeFolder` i.p.v. de map van de geopende mail** — `5021–5037`. Mail geopend uit submap-zoekresultaat (`msg._folder !== activeFolder`) → conversatie-blok faalt stil/verkeerde uid. Fix: `msgFolder` (zoals `openMessage` regel 4928 al berekent) doorgeven aan `loadConversation` voor zowel `isReplied` als de fetch.
5. **[LATENT] Deep-link `?msg=` cache-key mist account-prefix** — `4872–4883`. `folderMsgCache.get(targetFolder)` vs. opslag onder `${acctCachePrefix}:${f}` (4581) → auto-open werkt nooit voor shared/vault-mailboxen. **Eerst checken of het `?msg=`-pad nog bereikbaar is** (popout gebruikt inmiddels `/mail/view`); zo niet: dode code verwijderen i.p.v. fixen.
6. **[LATENT] CreateFolderModal auto-fill overschrijft handmatige invoer** — `3426–3434`. Effect op `projects`-prop-identiteit; achtergrond-refresh terwijl modal open → getypte naam weg. Fix: alleen auto-fillen op de `selectedProject`-transitie (prev-ref).
7. **[LATENT] Bulk-delete in Trash: N confirm-dialogen** — `5292–5298` → `5109–5123`. Fix: één confirm in `handleBulkDelete`, `skipConfirm`-flag naar `handleDeleteMsg`.
8. **[LATENT] CRM-zoekeffect zonder cancellation** — `2096–2146`. Zelfde `cancelled`-patroon als #2 (lagere prioriteit door debounce).
9. **[LATENT] `handleBackgroundSend` deps onvolledig** — `4638–4692`. Werkt nu transitief via `loadMessages`; na #3 de echte deps opnemen (`activeAcct`, `activeAccountId`, `t`, `useVault`, `activeAccountEmail`).

### Lint/opschoning (mechanisch, mag gebundeld)

10. **8× `no-explicit-any`** — 1497, 2122/2123, 2137/2138, 3653, 4714/4718: triviaal typeerbaar.
11. **3× `react-refresh/only-export-components`** (547, 2833, 2845) — **lost zichzelf op** door de lib-extracties in Deel A2 (signature-cache + folder-cache-ls).
12. **exhaustive-deps-warnings**: 1329/1369/2195 en de ref-guarded background-effects (4161/4283/4436/4815) zijn **bewust** — suppress met één-regel-reden-comment, niet "fixen". 4634/4692 zijn echt → mee met #9.
13. **Debug-logging weg**: `console.info` 1341 (logt volledige signature-HTML), `console.log` 4758/4796/4803.
14. **i18n-gaten**: hardcoded NL-alerts in `handleMoveMsgCrossAccount` (5216, 5233, 5248), thrown error 1552, iframe-title 2493 → door `t()`.

---

## Aanbevolen commit-volgorde

1. `lib/mail-types.ts` (A1) + her-imports — tsc/build groen.
2. Bugfix #3 (`activeConfig` memoize) — vroeg, stabiliseert de rest.
3. Lib-modules A2, één of enkele per commit, **tests-eerst** voor de pure delen (markread, sent-detect, badge, folder-icons, sanitizeHost). Lint #11 valt hier gratis mee.
4. Componenten A3 in volgorde 1→9, één per commit, verbatim-check per stuk.
5. Bugfixes #1, #2 (in nieuw ReadingPane-bestand), #4, #6, #7, #8, #9 — elk apart.
6. Lint-opschoning #10/#12/#13/#14 — mag gebundeld in 1–2 commits.
7. Afsluitend: volledige live smoke (checklist boven), `STATUS.md` bijwerken, vragen of er gepusht mag worden.

## Definition of done

- `Webmail.tsx` < ~3500 regels; alle 9 componenten in `components/mail/`; gedeelde helpers in `lib/` met tests.
- Alle gates groen; eslint-telling op Webmail.tsx **gedaald** (baseline 12/11); geen enkele verbatim-check-afwijking buiten signatures/imports.
- Bugs #1 t/m #7 gefixt (elk een eigen commit met motivatie in de message).
- Live smoke doorlopen zonder nieuwe console-errors (bestaand: 417 Shift Plan Assignment + settings-404's zijn pre-existing en oké).
- `STATUS.md` bijgewerkt; niets gepusht zonder akkoord van Piet.
