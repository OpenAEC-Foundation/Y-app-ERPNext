# Y-next

**Single-tenant webinterface voor ERPNext v16** — een frontend die op dezelfde
ERPNext-site draait als de data die hij toont.

Y-next is een fork van Y-app, omgebouwd tot een lichte SPA die rechtstreeks
tegen één ERPNext v16-omgeving aan praat. Er is geen eigen backend, geen
eigen authenticatie en geen eigen database: Y-next gebruikt de bestaande
ERPNext-sessie (login/cookies) van de site waarop hij gepubliceerd is, en
leest en schrijft data uitsluitend via de standaard Frappe/ERPNext REST API.

> **Productie:** [https://open-aec-studio-erp.prilk.cloud/y-next](https://open-aec-studio-erp.prilk.cloud/y-next)

---

## Wat Y-next is (en niet is)

- Eén ERPNext-site, één Y-next-installatie: single-tenant, geen
  instance-switcher, geen aparte accounts.
- Geen eigen inlogscherm: Y-next hergebruikt de sessie van de ERPNext-site
  waarop hij als Web Page is gepubliceerd (route `/y-next`). Ben je niet
  ingelogd, dan toont Y-next een loginkaart die doorverwijst naar de
  ERPNext-login.
- Alle data (projecten, facturen, taken, HR, etc.) komt rechtstreeks van de
  Frappe/ERPNext REST API van diezelfde site — geen tussenlaag, geen cache
  op een eigen server.
- Geen Express-productieserver en geen credential-vault: die onderdelen
  hoorden bij de oorspronkelijke multi-instance Y-app-architectuur en zijn
  in deze fork niet van toepassing.

---

## Fase-scope

In fase 1 en 2 zijn actief:

- **Dashboard**
- **Settings**
- **E-mail** — via ERPNext **Communication**-documenten (geen eigen
  mailserver; vereist een geactiveerd Email Account, zie
  [`docs/deployment.md`](docs/deployment.md#fase-2))
- **Vergadernotities**
- **Extensies** — configuratie-opslag, beheer beperkt tot System Manager
- **Release notes** — lokaal in de frontend bijgehouden

Nog niet actief (volgen in fase 3, omdat ze een server/proxy vereisen):

- **Berichten** (NextCloud Talk)
- **Documenten** (Nextcloud)
- **Wachtwoorden**

Overige schermen (Projecten, Facturen, HR, etc.) zijn wel opgenomen in de
navigatie maar tonen voorlopig "volgt later" — ze worden in latere fases
stap voor stap geactiveerd tegen de ERPNext-API.

`packages/server` en `packages/desktop` bevatten de oorspronkelijke
Y-app-runtimes (Express-backend resp. Tauri-desktopbuild). Die worden in deze
fork **niet gedeployed**, maar blijven in de repo bewaard omdat webmail,
messenger en de desktopvariant in latere fases mogelijk weer aan de orde
komen.

---

## Ontwikkelen

```bash
npm install
npm run dev
```

Optionele environment-variabelen voor lokale ontwikkeling:

| Variabele | Default | Omschrijving |
|---|---|---|
| `VITE_ERPNEXT_URL` | `https://open-aec-studio-erp.prilk.cloud` | ERPNext-site waar de Vite dev-proxy naartoe praat |
| `YNEXT_DEV_TOKEN` | — | Optionele `key:secret` API-token, alleen server-side door de dev-proxy toegevoegd als `Authorization`-header; komt nooit in clientcode of de bundel terecht |

Zonder `YNEXT_DEV_TOKEN` werkt gewone cookie-gebaseerde login via de
ERPNext-site ook, omdat de dev-server hetzelfde origin-gedrag simuleert als
productie.

## Testen

```bash
npm test
```

## Publiceren

Y-next wordt gepubliceerd als ERPNext **Web Page** op route `/y-next`,
met de gebouwde assets als publieke **File**-documenten. Zie
[`docs/deployment.md`](docs/deployment.md) voor het volledige deploy-, smoke-
test- en rollbackproces.

---

## License

Copyright [OpenAEC Foundation](https://github.com/OpenAEC-Foundation).
