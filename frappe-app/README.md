# Y-next

Web interface for ERPNext. Y-next runs on the same site as the data it shows:
it uses the ERPNext session of the signed-in user and reads and writes through
the standard Frappe/ERPNext API.

## Requirements

- Frappe 16 and ERPNext 16. Nothing else: no other apps, no extra Python
  packages and no Node build on the server.

Optional, switched on automatically when present: HRMS (leave, expense claims),
Wiki (knowledge base).

## Install

    bench get-app --branch version-16 https://github.com/OpenAEC-Foundation/y_next
    bench --site your.site install-app y_next
    bench --site your.site list-apps

Run these commands from an existing bench with Frappe 16 and ERPNext 16.
Replace `your.site` with your site's name, then open `/y-next` on that site
and sign in with your existing ERPNext account. Installation requires bench
access or a hosting administrator; using Y-next afterwards only requires a
browser.

### Download the app

Choose a version under
[Releases](https://github.com/OpenAEC-Foundation/y_next/releases). The currently
published release is
[v0.40.0](https://github.com/OpenAEC-Foundation/y_next/releases/tag/v0.40.0).
The release's **Source code (zip)** contains the app and its built frontend.
This repository is currently private, so your GitHub account needs access.
Use Bench to install the app; downloading a zip does not install it on a site.

The release bundle contains `y_next/public/app/.vite/manifest.json` and the
frontend assets. No frontend compilation is needed on the installation host.

### Let Claude import the app

Start Claude Code in an environment with access to your bench and this
repository. Replace the placeholders and paste:

```text
Installeer Y-next uit https://github.com/OpenAEC-Foundation/y_next,
branch version-16, op mijn bestaande lokale ERPNext 16-testsite.
Bench-map: <pad-naar-mijn-bench>
Site: <mijn-testsite>

Lees de README. Controleer Frappe 16 en ERPNext 16, de repositorytoegang,
en of y_next al op de bench en de genoemde site staat. Gebruik de gebouwde
distributie: bench get-app en daarna bench --site <site> install-app y_next.
Controleer list-apps en open /y-next met de bestaande ERPNext-login.
Geef de geïnstalleerde versie en URL. Een bestaande installatie niet
automatisch overschrijven of updaten; stel alleen noodzakelijke vragen.
```

Claude still needs repository and bench access. Keep credentials in the
normal local authentication or secret configuration.

## Updating an existing installation

Read the target release notes and create a site backup including files
before updating. In the app checkout (`apps/y_next`), check that there are no
local changes and that the selected branch is `version-16`, then:

```bash
git pull --ff-only
```

From the bench directory:

```bash
bench --site your.site migrate
bench --site your.site clear-cache
bench --site your.site list-apps
```

Reload `/y-next` and verify the installed version. In production, have the
hosting administrator apply the environment's normal restart procedure.
Updating a shared bench updates the app code for every site using it;
plan migrations and verification for each affected site.

## Word and Excel

Release 0.40.0 provides read-only Office attachment previews. Word (`.docx`)
and Excel (`.xlsx` and `.xlsm`) editing is being developed separately; it is
not part of that published release. Editor availability and known format
limitations will be documented in the release that ships them.

The planned save flow creates a private edited copy attached to the same
project or message, preserving the original. Received mail is never changed
or sent as a side effect of editing an attachment.

## Settings

Everything below is optional; Y-next works without it.

- **E-mail signature** (`Company` → *E-mail Signature*): trade name, greeting,
  brand colours and LinkedIn address. Together with the company logo, website
  and the company's own address they make up the signature under every mail.
  Left empty, the signature is plain, and a user's own e-mail signature takes
  precedence. Set *Company* on an `Email Account` to sign mail from that
  mailbox with another company's house style.

- **Mail server** (`Agenda Koppeling`): address, service account and password
  of a mail server that speaks JMAP and CalDAV and lets a service account act
  on behalf of users (Stalwart). Switches on calendars from the mail server,
  out-of-office replies, invitations and deleting mail on the server.
- **Calendar share links** (`Y Agenda Deellink`): lets someone read a calendar
  as an iCal subscription without signing in.
- **`Y Next Setting`** rows:
  - `km-tarief`: the mileage rate.
  - `km-via-reisaanvraag` = `1`: with HRMS installed, book mileage in the
    monthly travel request instead of in Y-next's own mileage records.
  - `weekplanning-pad`: path of a dashboard page on the same site, shown under
    "Weekplanning".
  - `gedeelde-postbussen`: addresses of shared mailboxes, separated by commas.
    A System Manager sees these as extra tabs in Mail; everyone else sees the
    mailboxes assigned to them in ERPNext.
- **Invoice print formats**: Y-next offers the Print Formats of your site. The
  default one is chosen under Settings → Project settings.

## Source

This repository is assembled by a release script and holds the built frontend.
Development happens in the source repository:
<https://github.com/OpenAEC-Foundation/Y-app-ERPNext>. Please open issues and
pull requests there.

## License

MIT
