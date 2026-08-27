# Y-next fase 2 — e-mail en resterende modules op ERPNext-only

## Doel

Fase 2 activeert de resterende Y-next-modules zonder eigen server. E-mail is de
kern: de bestaande Webmail-UI wordt omgebouwd naar ERPNext `Communication` als
databron. Daarnaast: vergadernotities op een custom DocType, extensies met
ERPNext-opslag, en release notes. NC Talk, Nextcloud-documenten en de
wachtwoordkluis kunnen niet zonder server (CORS resp. server-side crypto) en
zijn expliciet fase 3.

Doelinstance: `https://open-aec-studio-erp.prilk.cloud` (Frappe 16.19.0,
ERPNext 16.16.0, geen HRMS/Wiki-app). Huidige staat: één `Email Account`
("OpenAEC Mail", maarten@open-aec.com) met incoming/outgoing uitgeschakeld;
0 Communications; 0 Email Queue.

## 1. E-mail — Webmail-UI op Communication

### Randvoorwaarde (gebruikershandeling)

ERPNext haalt pas mail op wanneer het Email Account is geactiveerd
(incoming + outgoing, met inloggegevens, in ERPNext zelf). Tot die tijd toont
de Email-pagina een instructiekaart (i18n-key `y_next.mail_setup_required`)
met de stappen. De hele UI werkt verder gewoon — hij is alleen leeg.

### Data-adapter: `lib/mail-erpnext.ts`

Eén module die Communication-documenten mapt naar de berichtvormen die
`Webmail.tsx` al kent, zodat de UI-laag herkenbaar blijft:

- `listMailboxMessages(folder, opts)` → berichtenlijst. Folder is virtueel:
  - `INBOX` = `communication_type=Communication`, `sent_or_received=Received`
  - `Sent` = idem, `Sent`
  - `project:<name>` = koppeling via `reference_doctype/reference_name`
    (Project) of timeline-links
  - `unread` = `seen=0` binnen Received
- `getMessage(name)` → volledige body (`content`, HTML) + bijlagen
  (`File`-docs op de Communication, via `fetchAttachments`)
- `markRead(name)` / `markUnread(name)` → `seen`-veld
- `sendMail({to, cc, bcc, subject, html, attachments, replyTo, reference})` →
  `frappe.core.doctype.communication.email.make` met vooraf geüploade
  private Files (patroon uit de facturenflow); reply zet `in_reply_to`
- `linkToDocument(name, doctype, docname)` → project-koppelchip
- `listVirtualFolders()` → Inbox/Verzonden/Ongelezen + projectmappen met
  tellingen (get_count per filter; projectmappen alleen voor projecten met
  ≥1 gekoppelde Communication)
- `unseenCount()` → badge-polling (1×/min, hergebruik badge-mechanisme)

### Webmail.tsx-ombouw

- De IMAP-datalaag (fetch naar `/api/mail/*`) wordt vervangen door de adapter;
  de lijst-, lees-, compose- en thread-componenten blijven visueel gelijk.
- Threading: `in_reply_to`-veld van Communication levert de conversatie
  (transitieve closure client-side over het opgehaalde venster).
- Verborgen in deze fase (achter bestaande gates, geen dode knoppen in beeld):
  map-CRUD, drag-to-move, shared mailboxen, IMAP-warmup/IndexedDB-body-cache,
  popout-parameters die IMAP-specifiek zijn, "Sorteer in projectmap"-bulk
  (de projectkoppeling zelf blijft — dat is nu een native Communication-link).
- Popouts (`/mail/view`) blijven werken op adapter-data.

### Mark-read, races en cache

Geen IMAP `\Seen`-races meer: `seen` is een gewone documentupdate. De
bestaande optimistic-update + 30-60s in-memory lijstcache volstaan; de
IndexedDB-offline-cache blijft uit in deze fase.

## 2. Vergadernotities — custom DocType

- Eénmalige provisioning via de API (System Manager-token, geen Bench):
  DocType `Y Meeting Note` met velden: title (Data), meeting_date (Date),
  project (Link Project), participants (Long Text, JSON), action_points
  (Long Text, JSON), notes (Text Editor), linked_doctype/linked_name
  (Data, optioneel). Provisioning-script `scripts/provision-y-next.mjs`
  (idempotent: bestaat de DocType al → niets doen).
- `MeetingNotes.tsx`: `/api/meetings*`-calls vervangen door resource-CRUD op
  `Y Meeting Note`. UI ongewijzigd.
- Route `/meeting-notes` uit de blocklist.

## 3. Extensies — opslag naar ERPNext

- `extensions/remote.ts`: `fetchRemoteExtensions`/`saveRemoteExtensions` lezen
  en schrijven de geïnstalleerde-extensies-JSON niet langer via
  `/api/instances/.../settings`, maar op de gebruikerscontext van ERPNext.
  Opslagplek: één document in een generiek custom DocType `Y Next Setting`
  (key Data uniek, value Long Text JSON) — zelfde provisioning-script.
  Sleutel `remote-extensions`. localStorage blijft de leescache.
- De sandbox/postMessage-bridge in `ExtensionHost.tsx` verandert NIET
  (het threat model uit CLAUDE.md blijft integraal gelden); de bridge draait
  al client-side op de erpnext-client.
- Routes `/x/*` en de Settings-tab Extensions uit de blocklist; feature
  `extensions` aan in capabilities.

## 4. Release notes

- `/release-notes` uit de blocklist; pagina draait op de lokale
  `LOCAL_RELEASES`-array; de GitHub-fetch blijft gegate.

## 5. Capabilities-wijzigingen

- Blocklist krimpt tot: `/webmail` blijft ACTIEF (nieuwe adapter) → uit de
  blocklist; `/meeting-notes`, `/release-notes`, `/x` uit de blocklist.
- Blijven disabled: `/messenger`, `/nextcloud-files`, `/nextcloud-talk`,
  `/passwords`.
- `isFeatureEnabled`: `extensions` → true; nieuw onderscheid waar nodig
  tussen "webmail" (IMAP-brug, blijft false) en de nieuwe
  Communication-mail (aparte feature-key `erpnext-mail` = true), zodat
  IMAP-gebonden UI-delen uit blijven.

## Fase 3 (expliciet buiten scope)

- NC Talk-messenger en Nextcloud-documenten: cross-origin zonder proxy
  onmogelijk; vergt een proxy-besluit (ERPNext Server Script of mini-VPS).
- Wachtwoordkluis: vereist server-side twee-sleutel-crypto.
- Realtime push (websocket): polling volstaat in fase 2.

## Teststrategie

1. Unit-tests voor `mail-erpnext.ts` (mapping, foutafhandeling, virtuele
   mappen) en de provisioning-helpers (env-validatie, idempotentie-logica).
2. Bestaande suites blijven groen; locale-parity voor nieuwe keys (nl/en/de).
3. Live schrijfproef: test-Communication + `Y Meeting Note`-testrecord
   aanmaken via API, headless verifiëren dat ze in de UI verschijnen,
   daarna opruimen (herkenbare test-subjects).
4. Headless sweep uitgebreid met `/webmail`, `/meeting-notes`,
   `/release-notes`.

## Acceptatiecriteria

- `/webmail` toont de vertrouwde UI met Inbox/Verzonden/Ongelezen +
  projectmappen op Communication-data; opstellen/beantwoorden werkt via
  ERPNext (aantoonbaar met een testbericht in de Email Queue of Sent).
- Instructiekaart zichtbaar zolang geen enabled Email Account bestaat.
- `/meeting-notes` doet volledige CRUD op `Y Meeting Note`.
- Extensies installeerbaar via Settings; `/x/<id>` rendert in de sandbox.
- `/release-notes` toont de lokale release-historie.
- Geen enkele call naar Express-only endpoints vanaf de nieuwe schermen.
- Geen secrets in code/bundel; sandbox-model ongewijzigd.
