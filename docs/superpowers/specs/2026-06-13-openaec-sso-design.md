# OpenAEC SSO voor de Y-app — ontwerp

**Datum:** 2026-06-13
**Branch:** `Y-app-OpenAEC`
**Status:** afgestemd met OpenAEC Accounts via het parlement (sessie `openaec-accounts-b90a2c`, berichten 6 + 7)

## Context

De Y-app is een multi-tenant ERPNext/NextCloud-workspace met eigen e-mail/wachtwoord-accounts
(`y_app_users`, vault-sleutel afgeleid van het wachtwoord via PBKDF2). Het OpenAEC-platform
draait een **Zitadel** identity provider en provisioneert gebruikers automatisch in een gedeelde
ERPNext + NextCloud. Doel: **inloggen op de Y-app met je OpenAEC-account** (SSO), en daarna
automatisch de ERPNext- en NextCloud-instance toevoegen.

Dit document beschrijft fase 1 (de SSO-login zelf). Fase 2 (auto-provisioning via
`GET /me/credentials`) staat onderaan als vervolg en wacht op het live komen van dat endpoint.

## Afgesproken contract (parlement)

- **IdP:** Zitadel, issuer `http://kubernetes.docker.internal:8088`
  - authorize `/oauth/v2/authorize` · token `/oauth/v2/token` · userinfo `/oidc/v1/userinfo` · end_session `/oidc/v1/end_session`
- **Client:** confidential web-client "Y-app", authorization code + PKCE, scopes `openid profile email offline_access`. Accounts registreert 'm en levert `client_id` + `client_secret` (in `openaec-accounts/.zitadel/y-app.json`).
- **Callback (server-side):** `/api/auth/openaec/callback` op de Y-app Express-server.
- **Instance-model:** één gedeelde ERPNext (`http://localhost:8093`) + één gedeelde NextCloud (`http://localhost:8090`), Company "3BM Bouwtechniek V.O.F.". User al geprovisioned door OpenAEC.
- **Credential-bridge (fase 2):** ERPNext via per-user `api_key:api_secret` uit `GET /me/credentials`; NextCloud via Zitadel-Bearer (geen app-password).

## Fase 1 — SSO-login (deze spec)

### Acceptatiecriterium
Een gebruiker klikt op "Inloggen met OpenAEC" op de Y-app loginpagina, doorloopt de Zitadel-login,
en komt terug als ingelogde Y-app-gebruiker (geldige `y_app_session`-cookie), zonder ooit een
Y-app-wachtwoord te hebben.

### Vault-sleutel zonder wachtwoord
SSO-users hebben geen wachtwoord, dus geen PBKDF2-afgeleide sleutel. Bij **first SSO-login**:
genereer een random 32-byte `userKey`, wrap met de server-master-key (`wrapUserKey`), en bewaar
het wrapped blob **op de user-row** (`y_app_users.wrapped_user_key` + `_iv`). Bij elke volgende
SSO-login wordt die sleutel ge-unwrapped en in de nieuwe sessie-row gezet (zelfde envelope-mechaniek
als wachtwoord-users). Threat-model-afweging: voor SSO-users is de userKey herstelbaar met DB +
master-key (geen user-secret). Expliciet geaccepteerd voor de managed OpenAEC-omgeving.

### DB-migraties (`db.ts`, via `addColumnIfMissing`)
- `y_app_users.sso_provider TEXT` — bv. `"openaec"` (null voor wachtwoord-users)
- `y_app_users.sso_subject TEXT` — Zitadel `sub` (stabiele user-id)
- `y_app_users.wrapped_user_key BLOB` + `y_app_users.wrapped_user_key_iv BLOB` — persistente userKey voor SSO-users
- unieke index op `sso_subject`
- **Belangrijk:** de bestaande wipe `DELETE FROM y_app_users WHERE pbkdf2_salt IS NULL` moet
  worden aangepast naar `... AND sso_subject IS NULL`, anders worden SSO-users (zonder salt) weggevaagd.
- `password_hash` is `NOT NULL`: SSO-users krijgen een onbruikbaar sentinel (lege string),
  zodat wachtwoord-login nooit matcht.
- Zitadel-tokens per sessie (voor fase 2 + NextCloud-Bearer): `y_app_sessions.oidc_access_token_enc BLOB`,
  `oidc_refresh_token_enc BLOB`, `oidc_token_iv BLOB`, `oidc_expires_at INTEGER` (versleuteld met master-key).

### Nieuw servermodule: `packages/server/src/openaec-sso.ts`
- **Config-loader:** leest OIDC-config uit env (`OPENAEC_ISSUER`, `OPENAEC_CLIENT_ID`,
  `OPENAEC_CLIENT_SECRET`, `OPENAEC_REDIRECT_URI`) of uit een JSON-pad (`OPENAEC_SSO_CONFIG`,
  default = sibling `../openaec-accounts/.zitadel/y-app.json`). `isOpenAecSsoEnabled()` = config compleet.
- **PKCE-helpers:** `code_verifier` (random 64), `code_challenge` (S256), `state` (random).
- **`buildAuthorizeUrl(state, challenge)`** → Zitadel authorize-URL.
- **`exchangeCode(code, verifier)`** → POST `/oauth/v2/token` (client_secret + verifier) → tokens.
- **`fetchUserinfo(accessToken)`** → GET `/oidc/v1/userinfo` → `{ sub, email, name }`.
- **`findOrCreateSsoUser({ sub, email, provider })`** in `yapp-auth.ts` → returnt `{ user, userKey }`
  (genereert+wrapt userKey bij first login; unwrapt bij terugkeer).

### Routes (`index.ts`)
- `GET /api/auth/openaec/config` (publiek) → `{ enabled: boolean }` zodat de frontend de knop conditioneel toont.
- `GET /api/auth/openaec/login` → genereer state+PKCE, zet in korte httpOnly-cookies (5 min), 302 → Zitadel.
- `GET /api/auth/openaec/callback?code&state` → verifieer state-cookie, `exchangeCode`, `fetchUserinfo`,
  `findOrCreateSsoUser`, `createYAppSession`, sla Zitadel-tokens versleuteld op de sessie op,
  `setYAppSessionCookie`, 302 → `/`.

### Frontend (`LoginPage.tsx`)
- Roept `GET /api/auth/openaec/config` aan; als `enabled`, toon knop **"Inloggen met OpenAEC"**.
- Klik → `window.location.href = "/api/auth/openaec/login"` (volledige redirect, geen fetch).
- Bestaande e-mail/wachtwoord-login blijft ongewijzigd ernaast.

### Verificatie (fase 1)
1. `client_id`/`client_secret` van Accounts in `.zitadel/y-app.json` (of env).
2. Dev-stack draait (Zitadel :8088, Y-app frontend :5180 + server :3500).
3. Open `/login` → knop "Inloggen met OpenAEC" zichtbaar.
4. Klik → Zitadel-login → terug op `/` als ingelogde user.
5. `GET /api/yapp/me` geeft de user terug; een tweede bezoek logt direct in (sessie-cookie).
6. DB: `y_app_users`-row met `sso_subject` gevuld, `wrapped_user_key` aanwezig, `password_hash` leeg.

## Fase 2 — auto-provisioning (vervolg, na `GET /me/credentials`)
- Na SSO-login: server roept `GET /me/org` (triggert provisioning) + `GET /me/credentials` met de
  Zitadel-Bearer.
- ERPNext-instance toevoegen via bestaande `addInstance()`; `api_secret` versleuteld in de vault
  (nieuw auth-pad: instance-proxy moet `Authorization: token api_key:api_secret` ondersteunen naast sid).
- NextCloud-config in `instance_settings` met Bearer-mode; instance-proxy/Webmail/Talk moeten
  het Zitadel-token als Bearer kunnen sturen (token-refresh via `offline_access`).
- `GET /me/brand/signature` → compose-handtekening (single source = huisstijl).

Fase 2 krijgt een eigen spec zodra het credential-endpoint live is.
