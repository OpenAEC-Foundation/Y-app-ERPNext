# Shared mailbox 500/502/504 — 5-agent panel synthese + fixes

**Datum:** 2026-05-21
**Branch:** `fix/wave0-creds-and-shared-mailbox`
**Aanleiding:** Productie-Playwright-walk toonde shared mailboxes (`info@3bm.co.nl` → 500, `administratie@3bm.co.nl` → 504/502). Primary `piet@3bm.co.nl` werkt prima.

## De 5 agents

| Agent | Specialisatie | Key finding |
|---|---|---|
| O365 OAuth specialist | XOAUTH2 / Exchange | `{ ...primary, user: email }` is **correct per Microsoft-spec**. Bug ligt waarschijnlijk in Exchange-permissies (FullAccess via PowerShell) OF in ERPNext Email Account-records voor info@ zonder Connected App. |
| Code-flow audit | Server-flow | **Smoking gun**: `resolveCredentials` heeft géén try/catch om `mailAutoConfigInternal`. Bij "Email Account not found" → throw propageert → primaryEmail-fallback **wordt nooit uitgevoerd**. |
| Network/timeout | Proxy keten | 504/500/502 komen vrijwel allemaal uit Y-app's eigen `sanitizeMailError`, niet uit nginx. Voeg `proxy_connect_timeout/send_timeout 75s` toe in nginx-config voor de zekerheid. |
| Test infrastructure | Mock-strategie | Optie B (unit-test van `getCredentials` met gestubde `resolveCredentials`) is meest haalbaar in <2u. Drie scenarios reproduceren 500/502/504. |
| Race-condition sceptic | Concurrency | **Drie race-condities**: (1) refresh-token diefstal tussen 3 caches (piet/info/admin) bij parallelle calls, (2) creds-mutatie tijdens `ensureConnected`, (3) `connecting`-busy-wait deadline-mismatch. |

## Wat is geïmplementeerd in code (deze commit)

### Fix A — SMOKING GUN: try/catch om `mailAutoConfigInternal` [`mail.ts:1499`]

Wave 0b log toonde NOOIT "shared fallback: primary=..." voor info@/admin@ — omdat de fallback-tak nooit werd bereikt. De throw uit `mailAutoConfigInternal` reisde via async-await terug naar de route-handler. Nu wordt de error gevangen in `resolveCredentials` zelf, `null` returnt, en het pad in `getCredentials` valt netjes door naar de `primaryEmail`-fallback.

### Fix B — `sanitizeMailError` uitgebreid [`mail.ts:24-50`]

- `invalid_grant` / `xoauth2` → **401** + duidelijke melding over FullAccess/Add-MailboxPermission
- `mailbox does not exist` / `user not found` → **404** + "Gedeelde mailbox niet bereikbaar"

Voorheen vielen deze in het generieke 500-mandje.

### Fix C — token-claim diagnostic logging [`mail.ts:704`]

In `ensureConnected` parsed het JWT-token (mits OAuth2) en logt:
- `login-as` (de SASL-user, bv. `info@3bm.co.nl`)
- `token-upn` (de daadwerkelijke token-subject, bv. `piet@3bm.co.nl`)
- `token-scp` (IMAP/Mail-scopes)
- `token-exp` (verloop)

Hiermee zien we in productie-log of het token wel voor IMAP-scope is uitgegeven, of het verlopen is, en of de `login-as` afwijkt van de token-subject (= delegated-shared-mailbox-scenario, OK alleen als FullAccess in Exchange staat).

### Fix D — `resolvedCredsCache` invalidate-on-fail [`mail.ts:1525, 1547`]

Bij auth-failure (401) of TLS-reset (502) wordt het cache-slot voor de email (en primaryEmail) gewist via `invalidateResolvedCreds()`. Voorheen herbruikte de server 4 min lang dezelfde rotte token-set → gebruiker zat 4 min vast in een 401-loop.

### Fix E — GitHub Actions log-pull workflow [`.github/workflows/debug-logs.yml`]

Nieuw: `workflow_dispatch` workflow die SSH't naar de VPS, `pm2 logs y-app --lines 1000 --nostream --err/--out` haalt, optioneel grept op een filter (bv. `[mail]` of `shared`), en uploadt als artifact. Pull via `gh run download <id>`.

Gebruik: Actions → "Debug Logs Pull" → Run workflow → wacht 30s → download.

## Wat NIET in code geïmplementeerd is — voor Piet om handmatig te checken

### Stap 1: Exchange Online PowerShell

```powershell
# Eenmalig admin-shell openen op een Windows machine met PowerShell:
Install-Module -Name ExchangeOnlineManagement -Scope CurrentUser
Connect-ExchangeOnline -UserPrincipalName admin@3bm.co.nl

# Geef Piet FullAccess op beide shared mailboxen:
Add-MailboxPermission -Identity info@3bm.co.nl -User piet@3bm.co.nl `
  -AccessRights FullAccess -InheritanceType All
Add-MailboxPermission -Identity administratie@3bm.co.nl -User piet@3bm.co.nl `
  -AccessRights FullAccess -InheritanceType All

# Controleer:
Get-MailboxPermission -Identity info@3bm.co.nl | Where-Object { $_.User -like "*piet*" }
Get-MailboxPermission -Identity administratie@3bm.co.nl | Where-Object { $_.User -like "*piet*" }
```

**Belangrijk:** Microsoft propagateert deze permissie naar IMAP **na 15-60 minuten** (caching aan MS-zijde). Wachten na de cmdlet voordat je test.

**Waarom niet via Admin Center UI:** "Mailbox delegation → Full access" in de Exchange Admin Center UI werkt voor EWS/Outlook/Graph maar **niet altijd voor IMAP XOAUTH2**. PowerShell is de zekere route.

### Stap 2: ERPNext check

Login op ERPNext en check `Email Account` doctype:
- Bestaat er een record met `email_id=info@3bm.co.nl`? Of `administratie@3bm.co.nl`?

**Als ja**:
- Check het `connected_app` veld. Is dat leeg? Of wijst het naar dezelfde Microsoft-app als die van piet@'s record?
- **Als leeg**: `authMode` wordt `password`, en Microsoft heeft basic-auth IMAP **permanent uitgeschakeld** (sept 2022). Server zal 500/timeout krijgen.
- **Beste fix**: **verwijder de records voor info@ en administratie@** uit ERPNext. Dan gaat Y-app's primaryEmail-fallback piet@'s OAuth2-token gebruiken, met SASL-user info@/admin@. Dat is exact het Microsoft-recommended pattern voor delegated shared mailbox via IMAP XOAUTH2.

**Als nee** (geen records voor info@/admin@): goed — de fallback in Y-app zou nu (na Fix A) wel moeten werken. Vereist alleen Stap 1 (PowerShell-permissies).

### Stap 3: Verifieer met debug-logs.yml na deploy

Na deploy:
1. Open Y-app, klik op "Info"-tab → 500 of ander gedrag noteren.
2. GitHub → Actions → "Debug Logs Pull" → Run workflow met filter `[mail]`.
3. Wacht 30s, download artifact, kijk naar de regels:
   - `[resolveCredentials] info@3bm.co.nl: mailAutoConfigInternal threw — ...` → ERPNext heeft geen record (goed, fallback kickt in)
   - `[resolveCredentials] info@3bm.co.nl: resolved (authMode=password, ...)` → ERPNext heeft een record zonder Connected App (Stap 2 nodig)
   - `[getCredentials] shared fallback: primary=piet@3bm.co.nl ... → user=info@3bm.co.nl` → fallback werkt, daarna XOAUTH2-fase
   - `[mail-cache] XOAUTH2 connect: login-as=info@3bm.co.nl token-upn=piet@3bm.co.nl token-scp=IMAP.AccessAsUser.All ...` → token klopt
   - `[mail] listFolders → 401 (email=info@3bm.co.nl ...): AUTHENTICATIONFAILED` → Microsoft weigert (Stap 1 nodig of nog te propageren)

## Resterende race-condities — apart traject

Race-condition agent vond drie race-conditities die nog niet zijn gefixt:

1. **Refresh-token diefstal**: drie caches met dezelfde refresh-token. Bij parallelle refresh wint één, andere twee krijgen `invalid_grant`.
2. **Creds-mutatie tijdens `ensureConnected`**: oude token wordt geladen in authConfig vóór refresh klaar is.
3. **`connecting`-busy-wait deadline-mismatch**: 30s connect + 15s wait = soms 45s totaal → 504.

**Fix-strategie** (apart traject, ~2-4u):
- Module-level `OAuth2TokenManager` per `(host, primaryUser)` — alle caches vragen synchroon een vers token.
- `connectInFlight: Promise<ImapFlow>` mutex i.p.v. `setInterval` polling.
- `creds`-snapshot direct bij entry van `_doConnect()`.

Nu eerst valideren of de huidige fixes (A+B+C+D+E) genoeg zijn — pas de race-fix toe als shared-mailbox ook na PowerShell-stap nog problematisch blijft.

## Te deployen volgorde

1. Deploy `fix/wave0-creds-and-shared-mailbox` (deze branch, met huidige commits)
2. Piet voert PowerShell-stap uit (zie Stap 1 hierboven)
3. Wacht 15-60 min voor Exchange-propagatie
4. Piet test in Y-app
5. Bij issues: trigger `Debug Logs Pull` workflow + Piet stuurt artifact-link
6. Diagnose op basis van logs → eventueel race-fixes (Race 1/2/3)
