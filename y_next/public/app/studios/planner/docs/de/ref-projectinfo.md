# Neues Projekt und Projektinfo

Die Felder des Fensters *Neues Projekt* und von *Projektinfo*: was jedes Feld macht, was der Standard ist und wo es wirkt. Es sind zwei Seiten desselben Formulars. *Neues Projekt* erstellt ein neues Projekt und hat einige zusätzliche Felder. *Projektinfo* ändert das Projekt, das Sie gerade geöffnet haben.

## Öffnen

**Neues Projekt** — *Datei › Neu*, Strg+N, oder das Pluszeichen rechts neben den Dokument-Tabs (*Projekt starten*, dann *Neues Projekt*). Das Fenster öffnet sich mit dem Cursor im Feld *Projektname*.

**Projektinfo** — *Einstellungen › Projekt › Projektinfo* öffnet das Formular als Fenster mit dem Titel *Projektinformationen*. *Datei › Projektinfo* zeigt dasselbe Formular im Bildschirm *Datei*. Der Block *Berechnungsprofil und Berechnungsoptionen* steht unten, an beiden Stellen. Was darin steht, steht unter [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies).

## Erstellen, Anwenden und Abbrechen

**Erstellen** (in *Neues Projekt*) erstellt das Projekt und öffnet es in einem eigenen Tab. **Anwenden** (in *Projektinfo*) schreibt Ihre Änderungen in das Projekt.

- **Nur bei Anwenden.** Sie tippen in einen Entwurf. Das Projekt ändert sich erst, wenn Sie auf *Anwenden* klicken. *Anwenden* schreibt nur, was Sie wirklich geändert haben, als ein einziger Schritt in *Rückgängig*. Klicken Sie auf *Anwenden*, ohne etwas zu ändern, dann passiert nichts und es wird kein Schritt hinzugefügt.
- **Abbrechen, das Schließkreuz und Esc** schließen das Fenster, ohne etwas zu speichern. Ein Klick neben das Fenster schließt es nicht. Was Sie eingetippt haben, bleibt erhalten.
- **Enter** macht dasselbe wie *Erstellen* oder *Anwenden*. Ausgenommen sind das Feld *Beschreibung* und eine offene Auswahlliste.
- **Im Bildschirm Datei** zeigt *Projektinfo* unten *Änderungen nicht angewendet — klicken Sie auf Anwenden, um sie zu behalten.* solange Ihr Entwurf abweicht. Verlassen Sie den Bildschirm dann, fragt die App, ob Sie anwenden, verwerfen oder abbrechen wollen. Siehe [Das Menüband, Tab für Tab](docs://ref-lint).
- **Ein benutzerdefiniertes Berechnungsprofil ohne Namen** blockiert *Anwenden* und *Erstellen*. Geben Sie ihm einen Namen oder verwerfen Sie die Änderung.

## Felder in beiden Fenstern

**Projektname** — der Name des Projekts in der Titelleiste, auf dem Tab und im Dateinamen beim Speichern. Standard: leer. Ein leeres Feld ist erlaubt. Das Projekt heißt dann *Neue Planung*, und der Text steht grau im Feld. Wo: der ganze Bildschirm.

**Beschreibung** — Freitext. Standard: leer. Wirkung: wird mit dem Projekt gespeichert, in der IFC-Datei und im Export nach Primavera P6 XML. Sie hat keinen Einfluss auf den Terminplan.

**Autor** — Freitext. Standard: leer. Wirkung: kommt in die IFC-Datei und erscheint als *Autor:* in der Kopfzeile eines Berichts. Dort können Sie ihn nicht mehr neu eingeben.

**Ressourcenbibliothek** — welche Ressourcenbibliothek das Projekt verknüpft. Wählen Sie aus *keine (eigenständiges Projekt)*, Ihren vorhandenen Bibliotheken und *+ Neue Ressourcenbibliothek…*. Standard: in *Neues Projekt* die Standardbibliothek, in *Projektinfo* die aktuelle Verknüpfung. Wirkung: siehe [Die Ressourcenbibliothek verwenden](docs://howto-resourcebibliotheek-gebruiken). Mit *+ Neue Ressourcenbibliothek…* geben Sie in einem Feld unten einen Namen ein. Die Bibliothek entsteht erst bei *Erstellen* oder *Anwenden*. Abbrechen lässt deshalb nichts zurück. Eine Verknüpfung in *Projektinfo* ändert sich nur, wenn Sie dieses Feld selbst anfassen.

**Kunde/Organisation** — Freitext. Standard: leer. Wirkung: kommt in die IFC-Datei und erscheint als *Unternehmen:* in der Kopfzeile eines Berichts.

**Startdatum** — der Projektstart. Standard: in *Neues Projekt* heute. Was das Feld bewirkt, steht unten unter *Was das Startdatum bewirkt*.

**Enddatum** — das geplante Projektende. Standard: leer. Wirkung: eine Angabe, keine Vorgabe. Die App plant nicht auf dieses Datum hin. Es erscheint in der Kopfzeile eines Berichts und in Exporten. Es bestimmt außerdem, bis zu welchem Jahr die Feiertage erzeugt werden. Nur bei einer Primavera-Datei mit der Einstellung *Puffer bis zum Projektendtermin berechnen* (siehe [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies)) läuft die Pufferberechnung bis zu diesem Datum.

**Standardeinheit für neue Vorgänge** — nur sichtbar, wenn *Stundenplanung aktivieren* eingeschaltet ist. Wählen Sie aus *Tage* und *Stunden*. Standard: *Tage*. Wirkung und Bedingungen: siehe [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten).

**Berechnungsprofil und Berechnungsoptionen** — in *Projektinfo* der ganze Block. In *Neues Projekt* nur die Auswahlliste *Berechnungsprofil* mit *Primavera P6*, *Microsoft Project* und *Open Planner Studio*. Standard: *Open Planner Studio*. Die Wahl eines Profils setzt auch die Standardoptionen dieses Profils. Siehe [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies).

## Nur im Fenster Neues Projekt

**Phasenvorlage** — welche Phasen das Projekt beginnt. Wählen Sie aus *Leer*, *Wohnungsbau* und *Gewerbebau / Sanierung*. Standard: *Leer*. Wirkung: *Leer* gibt ein Projekt ohne Vorgänge. Die beiden anderen legen acht Phasen-Vorgänge bereit. Jeder hat eine Dauer von 5 in der Standardeinheit des Projekts: 5 Arbeitstage, oder 5 Stunden, wenn Sie unter *Standardeinheit für neue Vorgänge* *Stunden* wählen. Es gibt keine Beziehungen. Sie benennen, verschieben und verlängern die Vorgänge selbst. Für *Wohnungsbau* sind das: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking und Oplevering. Für *Gewerbebau / Sanierung*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen und Oplevering. Die Namen sind Daten Ihres Projekts. Sie bleiben Niederländisch, auch bei einer anderen Oberflächensprache. Wenn *Baumodus aktivieren* ausgeschaltet ist, gibt es nur *Leer*. Siehe [Einstellungen](docs://ref-instellingen).

**Schicht** — nur sichtbar, wenn *Stundenplanung aktivieren* eingeschaltet ist. Wählen Sie aus *Tagschicht*, *2 Schichten*, *3 Schichten* und *24/7*. Standard: *Tagschicht*. Wirkung: *Tagschicht* lässt den normalen Kalender wie er ist, ein gewöhnlicher Tageskalender von Montag bis Freitag. Die drei anderen legen Bänder mit Arbeitszeit in den Projektkalender, genau wie die Knöpfe mit demselben Namen im Fenster *Kalender*. Welche Zeiten das sind, steht unter [Arbeitszeiten einstellen](docs://howto-werktijden-instellen). Mit *Tagschicht* ist *Stunden* unter *Standardeinheit für neue Vorgänge* nicht wählbar, weil ein Tageskalender keine Bänder mit Arbeitszeit hat.

**Feiertagsset** — welche freien Tage der Projektkalender bekommt. Bei *Land* wählen Sie *Niederlande* (Standard), *Deutschland*, *Belgien*, *Frankreich*, *Vereinigtes Königreich*, *Österreich*, *Schweiz*, *Keine Feiertage* oder *Benutzerdefiniert…*. Hat das Land Regionen, kommt eine Auswahlliste *Region* dazu. Für die Niederlande wählen Sie außerdem die *Bauferien*, wenn *Baumodus aktivieren* eingeschaltet ist: *Keine* (Standard), *Nord*, *Mitte* oder *Süd*. Darunter steht eine Zeile wie *36 Feiertage, 2025–2029*. Diese Zeile klappen Sie für die Liste auf. Die Jahre laufen vom Jahr vor dem Startdatum bis zum Jahr nach dem Enddatum. Gibt es kein Enddatum, dann bis drei Jahre nach dem Startjahr. *Benutzerdefiniert…* gibt einen Kalender ohne Feiertage. Dann öffnet sich direkt nach dem Erstellen das Fenster *Kalender*, damit Sie die Feiertage selbst eintragen können. Der Projektkalender heißt *Bouwkalender NL*, oder *Standaardkalender*, wenn *Baumodus aktivieren* ausgeschaltet ist. Die Auswahl ist dann auch *Keine Feiertage*. Wie der Generator arbeitet, steht unter [Feiertage und Bauferien erzeugen](docs://howto-feestdagen-genereren).

## Was das Startdatum bewirkt

Das Startdatum ist der Ankerpunkt des Projekts. Drei Regeln:

- **Neue Vorgänge beginnen am Startdatum.** Ein Vorgang, den Sie hinzufügen, bekommt den Projektstart als geplanten Anfang.
- **Ein Vorgang mit Vorgänger beginnt nie vor dem Startdatum.** Liegt das Ende des Vorgängers früher, wartet der Vorgang bis zum Startdatum. Ein Vorgang *ohne* Vorgänger behält sein eigenes Datum, auch wenn es vor dem Startdatum liegt. Das ist nötig, damit ein Terminplan aus MS Project oder Primavera so angezeigt wird, wie das Ursprungsprogramm ihn zeigt. Eine Einschränkung *Muss anfangen am (MSO)* oder *Muss enden am (MFO)* bricht beide Regeln. Ein solcher Vorgang steht auf seinem Datum, auch wenn es vor dem Startdatum liegt.
- **Ein späteres Startdatum verschiebt lose Vorgänge mit.** Setzen Sie das Startdatum in *Projektinfo* später und klicken auf *Anwenden*, dann rücken Vorgänge auf das neue Datum, wenn sie davor liegen würden. Betroffen sind Vorgänge ohne Vorgänger und ohne Einschränkung, die eine untere Grenze setzt: *Anfang nicht früher als*, *Ende nicht früher als*, *Muss anfangen am* oder *Muss enden am*. Das geschieht im selben Schritt in *Rückgängig*. Die App sagt, wie viele Vorgänge verschoben wurden. Das passiert nur, wenn Sie das Startdatum selbst ändern, nie beim Öffnen einer Datei. Ein späteres Startdatum verschiebt nicht den übrigen Terminplan. Das macht *Projekt verschieben*, siehe [Ein Projekt verschieben](docs://howto-project-verplaatsen).

## Siehe auch

- [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies): der Block *Berechnungsprofil und Berechnungsoptionen*.
- [Berechnungsprofile und Konventionen](docs://uitleg-rekenprofielen): warum ein Profil das Ergebnis ändert.
- [Ein Projekt verschieben](docs://howto-project-verplaatsen): den ganzen Terminplan auf einen anderen Anfang.
- [Vorgänge und Meilensteine hinzufügen](docs://howto-taken-en-mijlpalen-toevoegen): mit den ersten Vorgängen beginnen.
- [Feiertage und Bauferien erzeugen](docs://howto-feestdagen-genereren): das Feiertagsset im Detail.
