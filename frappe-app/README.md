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

    bench get-app https://github.com/OpenAEC-Foundation/y_next --branch version-16
    bench --site your.site install-app y_next

Then open `/y-next` on your site.

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
