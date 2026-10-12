# Word en Excel in Y-next

## Doel

Een gebruiker opent een Word- of Excel-bestand vanuit een mail, project of
lokale bestandskiezer, bewerkt het in de browser en bewaart een bruikbare
kopie. De bestaande Y-next-huisstijl en ERPNext-sessie blijven het uitgangspunt.
De eerste oplevering draait op de lokale ERPNext 16-testsite.

## Editor en scherm

Folio verzorgt DOCX; BetterOffice verzorgt XLSX en XLSM. Versies worden exact
vastgezet na controle van hun gepubliceerde API. JavaScript, CSS, WASM en
lettertypen komen uit de app-bundel en laden pas bij het openen van Office.
De route is `#/office`; `?file=<File-ID>` opent een ERPNext-bestand.

De editor heeft een terugknop, bestandsnaam, wijzigingsstatus, een actie voor
opslaan als nieuwe ERPNext-versie en een downloadactie. Ctrl+S gebruikt de
actieve opslagactie. Een waarschuwing beschermt onopgeslagen werk bij sluiten.
NL, EN en DE volgen de bestaande taalkeuze. Nieuwe lokale documenten en
rekenbladen kunnen worden gestart; lokale bestanden kunnen worden geopend.

Binaire Office-onderdelen buiten het ondersteunde editmodel moeten behouden
blijven. Macro's worden niet uitgevoerd. DOC/XLS/ODT/ODS blijven downloads
of bestaande leesvoorbeelden. Voor grafieken, draaitabellen en complexe
documenten wordt geen volledige compatibiliteit geclaimd zonder bewijs.

## Gegevens en toegang

De browser verstuurt alleen verzoeken naar de eigen Frappe-site. Een
Office-bestand wordt op serverniveau exact op File-ID gelezen. Toegang tot
het gekoppelde Project of Communication wordt afzonderlijk gecontroleerd.
Extern gehoste bestanden en verdachte lokale paden worden afgewezen.

Het openen levert SHA-256 van de oorspronkelijke bytes. Opslaan vergelijkt
dit onder een bronlock met de actuele bytes. Een mismatch geeft een conflict.
Maximaal 20 MiB gecomprimeerd, of de lagere sitelimiet; ZIP-inhoud wordt
begrensd en op het juiste documenttype gevalideerd.

## Opslaan

Elke save maakt een nieuwe private File aan dezelfde ouder. Het origineel,
mailinhoud en financiële documenten worden niet gewijzigd. Voor gekoppelde
bestanden vereist dit leesrecht op de bron, File-create en schrijfrecht op
de ouder. Een eigen los File blijft eigenaargebonden.

Een servergegenereerde receipt bewaart een unieke client-operation-UUID,
sessiegebruiker, bron, verwachte SHA, input-SHA en resultaat-File. Dezelfde
operatie met dezelfde bytes retourneert hetzelfde resultaat; afwijkende
bytes of een andere gebruiker geven geen toegang tot die receipt.
Na een timeout wordt alleen de status van die exacte operatie gelezen.
Bij onbekende uitkomst volgt geen blinde tweede schrijfrequest.

Een volgende edit kan de bevestigde nieuwe File als bron gebruiken. Als de
gebruiker tijdens een save verder typt, blijven die nieuwere wijzigingen
zichtbaar als onopgeslagen. Documentbytes worden niet automatisch in
localStorage of IndexedDB gezet. Lokale bestanden kunnen als kopie worden
gedownload; direct lokaal overschrijven is een eventuele latere uitbreiding.

## API

Alle functies staan in `y_next.api.office`:

- `open_file(file_name)` (GET) geeft metadata: `name`, `file_name`, `file_url`,
  `content_hash`, `sha256`, `attached_to_doctype`, `attached_to_name`,
  `can_save` en `max_size`.
- `file_content(file_name)` (GET) geeft de gecontroleerde binaire inhoud.
- `save_file` (POST multipart) krijgt `file`, `source_file`,
  `expected_sha256`, `operation_id`; antwoord is resultaatmetadata met
  `operation_id` en `source_file`.
- `save_status(operation_id)` (GET) geeft `found`, `operation_id` en bij
  succes `file` met resultaatmetadata; sessie en huidige rechten gelden opnieuw.

## Verificatie

Frontendtests bewijzen juiste endpoint/CSRF, bytes, dubbele save,
reconciliatie, conflict, permission-states, source races en dirty state.
Frappe-tests bewijzen documentrechten, gastweigering, nieuwe private versie,
immutable bron, UUID-binding, conflict en begrensde pakketvalidatie.
De lokale browserproef opent en bewerkt synthetische DOCX/XLSX, bewaart de
kopie en heropent die via ERPNext. Het resultaat wordt onafhankelijk gelezen.
Typecontrole, bestaande regressiesuite en appbuild blijven groen.

## Distributie

De README beschrijft downloaden/installeren van `y_next` en importeren via
een Claude Code-opdracht. Gepubliceerde 0.40.0 en lokale editorbouw worden
onderscheiden. Publicatie, push en wijzigen van productiesites zijn apart.
