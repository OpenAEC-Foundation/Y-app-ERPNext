# Import- und Exportformate

Pro Dateiformat: ob Sie es öffnen, speichern und exportieren können, was mitkommt und was nicht, und mit welchem Berechnungsprofil es sich öffnet. Den Hintergrund dazu und ein Beispiel mit Zahlen finden Sie unter [Dateien und Formate](docs://uitleg-bestanden).

## Auf einen Blick

**Öffnen** funktioniert mit IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` und `.xer`. Eine Datei mit einer anderen Endung behandelt die App als IFC.

**Speichern** schreibt immer IFC. Nur eine geöffnete IFC-Datei wird das Speicherziel. Ein Projekt aus einem anderen Format hat nach dem Öffnen keine Datei. *Speichern* fragt dann, wo die IFC-Datei hin soll.

**Exportieren** ist möglich nach IFC 4x3, MS Project XML, Primavera P6 XML, CSV und zwei Fortschrittsblätter (Excel und CSV). Ein Export ändert Ihr Projekt nicht.

**Schreibgeschützt** sind `.mpp` und `.xer`. Die App kann sie öffnen, aber nicht schreiben.

**PDF** kommt nur aus einem Bericht (siehe [Berichtstypen](docs://ref-rapporttypes)). Die App liest kein PDF.

**Wo.** Öffnen: *Start › Datei › Öffnen*, *Datei › Öffnen* oder Strg+O. Exportieren: *Start › Datei › Exportieren* oder *Datei › Exportieren*. Ein ausgefülltes Fortschrittsblatt lesen Sie über *Datei › Importieren* ein. Oder Sie nutzen die Schaltfläche *Fortschritt aus einer Tabelle aktualisieren* in der Gruppe *Fortschritt* im Menüband auf den Registerkarten *Planung*, *Tabelle* und *Bericht*.

**Berechnungsprofil beim Öffnen.** Jedes Format öffnet sich mit einem Berechnungsprofil. Was das ist, steht unter [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies). `.xer` öffnet sich mit *Primavera P6*, `.mpp` mit *Microsoft Project*, und CSV, MS Project XML und P6 XML mit *Open Planner Studio*. IFC behält das Profil, das in der Datei gespeichert ist. Für `.xer` und `.mpp` meldet die App, dass das Projekt so berechnet wird. Nur IFC enthält das Berechnungsprofil und die Berechnungsoptionen. Von den Berechnungsoptionen schreibt MS Project XML höchstens die kritische Schwelle. Ein erneut geöffneter Export eines anderen Formats berechnet als *Open Planner Studio*.

## IFC

**Öffnen** — ja, `.ifc`. Die App liest IFC 4.3. Berechnungsprofil: das Profil in der Datei.

**Speichern** — ja, und es ist das einzige Format, das speichern kann. *Speichern* schreibt Ihr ganzes Projekt als IFC-Datei. Die Datei wird das Speicherziel.

**Exportieren** — ja, als *IFC 4x3* (beschrieben als *BuildingSMART-Standard. 4D-Verknüpfung mit BIM-Modellen.*). Standardname: der Projektname mit der Endung `.ifc`. Ist Ihr Projekt mit einer Ressourcenbibliothek verknüpft, steht die Checkbox *Bibliotheksdatei zusätzlich speichern* unter den Karten in *Datei › Exportieren*. Ist sie angekreuzt, fragt die App nach einem Ort für *projectname-bibliotheek.ifc*, nachdem das Projekt gespeichert ist. Die Checkbox steht nicht in der Liste auf der Registerkarte *Start*.

**Was mitkommt** — alles, was zum Projekt gehört: Vorgänge mit PSP-Struktur, Dauer, Terminen und Fortschritt; Beziehungen mit Zeitabstand; Einschränkungen und Stichtage; Kalender; Ressourcen und Zuweisungen, einschließlich der Verteilung nach Stunden; Baselines; Aktivitätscodes und benutzerdefinierte Felder; Notizen; externe Beziehungen zu anderen Projekten; Unterbrechungen; Arbeitsregeln und Vorgangsarten; die Projekteinstellungen wie das Statusdatum, den Fortschrittsmodus, das Berechnungsprofil und die Berechnungsoptionen; die Verknüpfung mit einer Ressourcenbibliothek. Bei einem Projekt aus einer `.xer`-Datei kommt auch die ursprüngliche Quelldatei mit. Eine benutzerdefinierte Vorgangsart speichert die App als IFC-Typ `USERDEFINED` mit ihrem Namen im Feld ObjectType. So liest ein anderes IFC-Programm den Vorgang normal. Die App behält außerdem die feste ID der Vorgangsart, sodass ein Umbenennen die Verknüpfung nicht bricht. Öffnet jemand die Datei auf einem anderen Computer, erscheint die Vorgangsart dort unter *Aus diesem Projekt*, nicht unter den eigenen *Meine Vorgangsarten*.

**Was nicht mitkommt** — wie Sie den Bildschirm eingestellt haben (Zoom, Scrollposition, ausgewählter Vorgang, eingeklappte Phasen, gewählter Filter und gewählte Gruppierung) und die App-Einstellungen ([Einstellungen](docs://ref-instellingen)). Die Registerkarte *IFC* zeigt den IFC-Text Ihres Projekts.

## MS Project XML (MSPDI)

**Öffnen** — ja. Die App erkennt eine `.xml`-Datei als MS Project XML am Stammelement `Project` im MS-Project-Namensraum (oder ohne Namensraum). Berechnungsprofil: *Open Planner Studio*.

**Speichern** — nein. Ein solches Projekt bekommt kein Speicherziel.

**Exportieren** — ja, als *MS Project XML* (*Öffnen in Microsoft Project. Vollständige PSP-Struktur.*). Standardname: der Projektname mit `.xml`.

**Was mitkommt** — Vorgänge mit Struktur (Ebene und PSP), Dauer, Terminen und Fortschritt; Beziehungen mit Zeitabstand, auch in Stunden oder Prozent; Einschränkungen, einschließlich des Stichtags; Kalender, einschließlich Vorgangs- und Ressourcenkalender; Ressourcen und Zuweisungen, einschließlich der Kurve oder der Verteilung nach Stunden; das Statusdatum; die kritische Schwelle als ganze Zahl von Arbeitstagen, 0 oder mehr, mit *Gesamtpuffer ≤ Schwelle*; die Beschreibung eines Vorgangs (als Notiz); die Arbeitsregel eines Vorgangs (als Vorgangsart von MS Project); eine benutzerdefinierte Vorgangsart in einem freien Feld (`ExtendedAttribute`), das die App zurückliest und das MS Project eventuell ignoriert. Von Ihren Baselines kommt nur die aktive mit, als Baseline 0. Ein Vorgang in Stunden behält seine Einheit, und ein Meilenstein behält seine Art (Anfang, Ende oder automatisch).

**Was nicht mitkommt** — Notizen (die Checkliste eines Vorgangs), externe Beziehungen zu anderen Projekten, Aktivitätscodes und benutzerdefinierte Felder, eine zweite Einschränkung, die Markierung *Manuell geplant*, die Abgleichsverzögerung, der Wiederaufnahme- und Haltepunkt eines Vorgangs mit Fortschritt außer Reihenfolge, die Konventionen *Restarbeit wird nach der verstrichenen Dauer fortgesetzt* und *Nicht begonnene Vorgänge nicht zum Statusdatum verschieben* eines MS-Project-Profils sowie die übrigen Berechnungsoptionen. Unterbrochene Vorgänge ohne Verteilung nach Stunden kommen ohne ihre Unterbrechungen mit.

**Was sich unterwegs ändert** — eine Einschränkung *Muss anfangen am (MSO)* oder *Muss enden am (MFO)* ohne die Auswahl *Verbindlich (Pin-Logik)* wird zu *Anfang nicht früher als (SNET)* oder *Ende nicht früher als (FNET)*. Ein Hammock wird zu einem gewöhnlichen Vorgang mit berechneten Terminen.

## MS Project-Datei (`.mpp`)

**Öffnen** — ja, ab MS Project 2010 bis 2021. Berechnungsprofil: *Microsoft Project*. Die App liest die Datei nur. Sie ändert Ihre `.mpp`-Datei nie. Eine Datei aus MS Project 2007 oder älter und eine Datei mit Kennwort lehnt die App mit einer Meldung ab, die auf den XML-Export von MS Project verweist.

**Speichern** — nein, und es gibt kein Speicherziel: *Speichern* schreibt eine neue IFC-Datei.

**Exportieren** — nein.

**Was mitkommt** — Vorgänge mit Struktur, Dauer und Einschränkungen; Beziehungen mit Zeitabstand; Kalender; Ressourcen und Zuweisungen; Fortschritt; ein PSP-Code, den Sie selbst in MS Project eingetragen haben. Die Termine und den Puffer, die MS Project selbst berechnet hat, liest die App ebenfalls ein, für die Ansicht *Termine wie gespeichert*.

**Was nicht mitkommt** — Baselines, Kosten und Tarife, Notizen und die benutzerdefinierten Felder von MS Project. Siehe [Öffnen einer MS-Project-Datei (.mpp)](docs://howto-mpp-openen).

**Herkunft und Lizenz** — Der `.mpp`-Leser wurde für Open Planner Studio geschrieben und ist abgeleitet von dem Quellcode und dem strukturellen Wissen von MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), einer Java-Bibliothek unter LGPL-2.1. Die Struktur und die Feldkonstanten wurden nach TypeScript übertragen. Open Planner Studio selbst ist Open Source unter LGPL-3.0. Der `.xer`-Leser ist kein Derivat. MPXJ wurde dort nur als Verständnisquelle zu Rate gezogen.

## Primavera P6 XML

**Öffnen** — ja. Die App erkennt eine `.xml`-Datei als P6 XML am Stammelement `APIBusinessObjects`. Berechnungsprofil: *Open Planner Studio*.

**Speichern** — nein.

**Exportieren** — ja, als *Primavera P6 XML* (*Für Oracle Primavera P6.*). Standardname: der Projektname mit `.xml`. Das ist derselbe Name wie bei einem MS-Project-XML-Export. Geben Sie beiden Exporten selbst verschiedene Namen.

**Was mitkommt** — PSP-Struktur und Vorgänge mit Dauer, Terminen und Fortschritt; Beziehungen mit Zeitabstand; Einschränkungen, auch eine zweite als weiche Einschränkung; Kalender; Ressourcen und Zuweisungen; das Statusdatum (als `DataDate`); eine benutzerdefinierte Vorgangsart in einem eigenen Feld, `OPS Custom Task Type`, das die App zurückliest und das P6 eventuell ignoriert.

**Was nicht mitkommt** — Baselines und Stichtage; Aktivitätscodes, benutzerdefinierte Felder, Notizen und externe Beziehungen; die Berechnungsoptionen. P6 kennt keinen Zeitabstand in Prozent. Die App rechnet ihn in eine feste Anzahl Tage um. Ein Zeitabstand in Kalendertagen wird ein Zeitabstand in Arbeitszeit: 3 Kalendertage werden 3 Arbeitstage. Ein Hammock wird zu einem normalen Vorgang. Ein manuell geplanter Vorgang wird zu einem normalen Vorgang mit berechneten Terminen. Eine Abgleichsverzögerung von weniger als einem Tag entfällt.

## Primavera-Datei (`.xer`)

**Öffnen** — ja. Berechnungsprofil: *Primavera P6*. Die App liest die Datei nur. Sie schreibt keine `.xer`-Datei und ändert Ihre Datei nie. Sie öffnet je Projekt einen Reiter mit Vorgängen. Eine Datei ohne Aktivitäten oder mit beschädigten Tabellen lehnt sie mit einer Meldung ab.

**Speichern** — nein, und es gibt kein Speicherziel: *Speichern* schreibt eine neue IFC-Datei, mit der ursprünglichen `.xer`-Datei darin.

**Exportieren** — nein. Wenn Sie ein Projekt aus einer `.xer`-Datei nach CSV, MS Project XML oder P6 XML exportieren, meldet die App, dass XER-Quellinformationen verloren gehen. Das gilt auch, wenn Sie das Projekt zwischendurch als IFC gespeichert haben. Nach IFC geht nichts verloren.

**Was mitkommt** — die PSP-Struktur und Aktivitäten mit Dauer, Terminen, Einschränkungen und Fortschritt; Beziehungen mit Zeitabstand; Kalender; Ressourcen mit Zuweisungen; Aktivitätscodes; benutzerdefinierte Felder (UDFs); Notizen; die Einstellungen zur Terminplanung von P6. Eine Aktivität vom Typ *Level of Effort* wird ein Hammock. Ein Baseline-Projekt wird die aktive Baseline des Projekts, das darauf verweist. Eine Beziehung zwischen zwei Projekten behält die App als Quelldaten.

**Was nicht mitkommt** — ein Projekt ohne Aktivitäten, und eine Beziehung zwischen zwei Projekten als echte Beziehung in Ihrem Terminplan. Siehe [Eine Primavera-P6-Datei (.xer) öffnen](docs://howto-xer-openen).

## CSV

**Öffnen** — ja. Die App liest `;` und `,` als Trennzeichen. Sie erkennt Spaltenüberschriften auf Englisch und Niederländisch (zum Beispiel `Name` oder `Naam`, `Duration` oder `Duur`, `Predecessors` oder `Voorgangers`). Datumsangaben können *JJJJ-MM-TT*, *TT-MM-JJJJ* oder *TT/MM/JJJJ* sein. Einen Vorgänger schreiben Sie als PSP-Code, Beziehungstyp und Zeitabstand, zum Beispiel `1.2FS+2d`. Berechnungsprofil: *Open Planner Studio*. Das Projekt heißt *CSV Import*. Eine `Task Type`, die keiner der festen Codes ist (wie `CONSTRUCTION` oder `INSTALLATION`, die die App selbst schreibt), wird eine benutzerdefinierte Vorgangsart unter *Aus diesem Projekt*, nicht unter *Meine Vorgangsarten*. Mit `OPS Custom Task Type ID` bleibt die ID einer benutzerdefinierten Vorgangsart erhalten.

**Speichern** — nein.

**Exportieren** — ja, als *CSV (;)* (*Universeller Tabellenexport. Alle Vorgänge mit Terminen und Dauer.*), auf der Karte *CSV (semikolon-getrennt)*. Die Datei nutzt ein Semikolon als Trennzeichen, ist in UTF-8 mit BOM und hat englische Spaltenüberschriften.

**Was mitkommt** — je Vorgang diese Spalten: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` und `Description`. Die Fertigstellung ist in ganzen Prozent angegeben.

**Was nicht mitkommt** — Ressourcen, Zuweisungen, Kalender, Einschränkungen, Stichtage, Baselines und das Statusdatum. Wenn die Termine in der Ansicht *Termine wie gespeichert* stehen, lässt der Export die Spalten `Critical` und `Total Float` für Vorgänge leer, deren Quelldatei das nicht gespeichert hat.

## Fortschrittsblatt (Excel und CSV)

**Öffnen** — ja, über *Datei › Importieren* (*Fortschritt aus einer Tabelle aktualisieren*) oder über die Schaltfläche dieses Namens in der Gruppe *Fortschritt* im Menüband auf *Planung*, *Tabelle* und *Bericht*. Die App liest `.xlsx` und `.csv`, bis zu 16 MB und 50.000 Zeilen. Das öffnet kein Projekt. Es aktualisiert den Fortschritt Ihres geöffneten Projekts. Siehe [Fortschritt aus einer Tabelle importieren](docs://howto-voortgang-importeren).

**Speichern** — nein.

**Exportieren** — ja, als *Fortschrittsblatt (Excel)* (*Fortschritt (Excel)* in der Liste) und *Fortschrittsblatt (CSV)* (*Fortschritt (CSV)*). Standardname: *projectname-voortgang*. Die Schaltfläche *Fortschrittsblatt exportieren* in derselben Gruppe erstellt das Excel-Blatt mit einem Klick. Das Excel-Blatt hat feste Spaltenbreiten, gesperrte Felder und eine Datumsprüfung. Das CSV-Blatt hat denselben Inhalt als reinen Text.

**Was mitkommt** — die Spalten `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` und `Actual Finish`. Beim Einlesen nutzt die App `Completion (%)`, `Actual Start` und `Actual Finish`. `Start` und `Finish` dienen nur dazu, die Datumsschreibweise zu erkennen. Diese ändern Ihren Terminplan nicht. Die App verknüpft Zeilen mit Vorgängen über die `OPS Task ID`, sonst über einen eindeutigen PSP-Code.

**Was nicht mitkommt** — alles außerhalb dieser Spalten: Dauer, Beziehungen, Ressourcen und der Rest Ihres Terminplans. Ein Sammelvorgang erhält aus dem Blatt keinen Fortschritt.

## PDF

**Öffnen** — nein.

**Speichern** — nein.

**Exportieren** — ja, aus einem Bericht: auf der Registerkarte *Bericht* die Schaltfläche *PDF exportieren*. Die App sendet einen Bericht nicht selbst an einen Drucker. Der Weg zu Papier führt über das PDF. Der Inhalt hängt vom Berichtstyp ab. Siehe [Berichtstypen](docs://ref-rapporttypes) und [Bericht erstellen und drucken](docs://howto-rapport-maken-en-afdrukken).

## Siehe auch

- [Dateien und Formate](docs://uitleg-bestanden): warum IFC das eigene Format ist und was ein Export verliert, mit einem Beispiel.
- [Eine Datei öffnen und speichern](docs://howto-bestand-openen-en-opslaan): die Schritte.
- [Exportieren](docs://howto-exporteren): ein Format wählen und die Meldungen nach einem Export.
- [Termine wie gespeichert](docs://uitleg-datums-zoals-opgeslagen): warum eine geöffnete Datei andere Termine zeigen kann.
- [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies): die Berechnungsprofile.
