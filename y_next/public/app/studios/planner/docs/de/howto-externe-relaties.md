# Externe Beziehungen zu einem anderen Projekt

Ziel: Verknüpfen Sie einen Vorgang in diesem Projekt mit einem Vorgang in einer anderen Projektdatei, damit Ihr Terminplan die Arbeiten berücksichtigt, die anderswo geplant sind.

## Wann Sie das brauchen

Ihr Anbau kann erst beginnen, wenn das Baugelände für den Bau vorbereitet ist, und diese Arbeiten stehen im Projekt des Auftragnehmers. Oder der Monteur kann erst beginnen, wenn Ihr Rohbau fertig ist, und er plant in seiner eigenen Datei. Eine normale Beziehung funktioniert nur zwischen Vorgängen im selben Projekt. Eine **externe Beziehung** verknüpft einen Vorgang mit einem Vorgang in einer anderen Datei.

Eine externe Beziehung berechnet nicht live mit dem anderen Projekt. Die App speichert einen festen **Ankertermin**: das Datum des externen Vorgangs in dem Moment, in dem Sie ihn verknüpfen. Die Berechnung nutzt dieses Datum als Grenze. Wenn sich das andere Projekt ändert, verschiebt sich in Ihrem Projekt nichts, bis Sie den Ankertermin aktualisieren.

## Schritte

1. Wählen Sie genau einen Vorgang in diesem Projekt: den Vorgang, der vom externen Vorgang abhängt, oder den Vorgang, von dem der externe Vorgang abhängt.
2. Wählen Sie *Start › Vorgänge › Verknüpfen ▾ › Externe Beziehung hinzufügen…*. Dasselbe Menü finden Sie unter *Planung › Beziehungen* und unter *Tabelle › Vorgänge*. Der Eintrag ist nur verfügbar, wenn genau ein Vorgang markiert ist.
3. Wählen Sie im Fenster *Externe (projektübergreifende) Verknüpfung* einen der beiden Wege. Mit *Quelldatei* wählen Sie die Projektdatei unter *Eine zuletzt verwendete Datei wählen* und danach den *Quellvorgang*. Die App liest die Datei nur lesend, öffnet sie nicht als Dokument und übernimmt den Ankertermin selbst. Dieser Weg funktioniert nur in der Desktop-App und nur für eine Datei in der Liste der zuletzt verwendeten Dateien. Sonst ist die Schaltfläche *Quelldatei* deaktiviert. Mit *Manuell (Fallback)* tragen Sie die *Projekt-ID* und die *Vorgangs-ID* des externen Vorgangs ein. Bei Bedarf füllen Sie das Feld *Vorgangsname (optional)* aus, und Sie tragen den *Ankertermin* ein. In der Browser-Version ist dies der einzige Weg.
4. Wählen Sie unter *Richtung*, ob der externe Vorgang Ihr Vorgänger oder Ihr Nachfolger ist: *Vorgänger (extern → ich)* oder *Nachfolger (ich → extern)*.
5. Wählen Sie den *Beziehungstyp* (FS, SS, FF oder SF). Tragen Sie bei Bedarf einen *Abstand (Arbeitstage)* ein, zum Beispiel `0d` oder `2d`.
6. Klicken Sie auf *Verknüpfung hinzufügen* und drücken Sie **Berechnen** (F5).

Welches Datum Sie für eine manuelle Beziehung als Ankertermin eintragen, hängt von der Richtung und vom Typ ab:

- Bei einem externen **Vorgänger** zählt der erste Buchstabe des Typs: F steht für das Ende des externen Vorgangs, S für das Startdatum. Bei FS und FF tragen Sie daher das Ende ein, bei SS und SF den Start.
- Bei einem externen **Nachfolger** zählt der zweite Buchstabe: S ist das Startdatum des externen Vorgangs, F ist sein Ende. Bei FS und SS tragen Sie daher den Start ein, bei FF und SF das Ende.

Wenn Sie in Stunden planen (Stundenplanung eingeschaltet und ein Vorgang in einem Kalender mit Arbeitszeiten), fragt das Feld *Ankertermin* zusätzlich nach einer Uhrzeit.

Beispiel: Das Projekt der Baustelle endet am Freitag, 18. Juni 2027. Sie verknüpfen *Groundwork* mit einem externen Vorgänger vom Typ FS, Ankertermin 18. Juni 2027. Nach **Berechnen** beginnt Groundwork am Montag, 21. Juni, dem ersten Arbeitstag nach dem Ankertermin. Ein externer Nachfolger wirkt umgekehrt: Er begrenzt, wie spät Ihr Vorgang enden darf.

## Was Sie sehen und wie Sie es verwalten

- Externe Beziehungen erscheinen als Text in den Spalten *Vorgänger* und *Nachfolger* der Vorgangstabelle (fügen Sie sie mit dem **+** in der Tabellenkopfzeile unter *Beziehungen* hinzu), mit dem Namen des Projekts und des Vorgangs sowie dem Typ. Ein kleines Dreieck mit dem Text *Quelle fehlt* zeigt, dass die Quelle nicht gelesen wurde. Halten Sie den Mauszeiger über die externe Beziehung: Dann sehen Sie das Projekt (die Zeile *Projekt-ID* zeigt den Projektnamen, sobald er bekannt ist), die Vorgangs-ID, den Ankertermin und den Status der Quelle.
- Im Gantt-Diagramm liegt beim Vorgang ein grauer Geister-Balken. Bei einem Vorgänger endet er am Ankertermin, bei einem Nachfolger beginnt er dort. Ein gestrichelter Rahmen mit der roten Beschriftung *veraltet* bedeutet, dass die Quelle nicht gelesen wurde. Bei einer manuellen Beziehung ist das immer der Fall.
- Klicken Sie mit der rechten Maustaste auf eine externe Beziehung in der Spalte. Im Menü stehen dann *Externe Beziehung bearbeiten…* und *Beziehung löschen*. Hat die Beziehung eine Quelldatei, steht dort auch *Quelle aktualisieren*.
- Wählen Sie *Verknüpfen ▾ › Alle externen Beziehungen aktualisieren*, um die Quelldateien erneut zu lesen und die Ankertermine zu aktualisieren. Das funktioniert nur in der Desktop-App. Haben Sie nur manuelle Beziehungen, zeigt die App *Keine aktualisierbaren externen Quellen (Dateipfad fehlt).* Drücken Sie nach einer Aktualisierung **Berechnen**.
- Wenn Sie den Typ oder die Richtung so ändern, dass der Ankertermin die andere Seite des externen Vorgangs braucht (Startdatum statt Ende oder umgekehrt), fragt die App bei einer manuellen Beziehung nach einem neuen Ankertermin: *Wählen Sie einen neuen Anker: Der Beziehungstyp verwendet jetzt die andere Seite des Quellvorgangs.* Bei einer Beziehung mit Quelldatei liest die App den Ankertermin selbst erneut.

## Fallstricke und was die App tut

**Das andere Projekt verschiebt sich nicht mit.** Wenn der externe Vorgang sein Datum ändert, rechnet Ihr Terminplan weiter mit dem alten Ankertermin, bis Sie ihn aktualisieren oder ändern. Beim manuellen Weg ändern Sie den Ankertermin selbst: Klicken Sie mit der rechten Maustaste auf die Beziehung und wählen Sie *Externe Beziehung bearbeiten…*.

**Ein externer Vorgänger ist eine untere Grenze.** Wenn Ihr Vorgang wegen seiner eigenen Vorgänger später beginnt, als der Ankertermin verlangt, gewinnt die eigene Beziehung des Vorgangs. Der Ankertermin schiebt nur nach hinten.

**Ein externer Nachfolger ist eine obere Grenze.** Ist der Ankertermin zu knapp, zeigt sich das als negativer Puffer an Ihrem Vorgang und an den Vorgängern davor. Dabei erscheint keine eigene Warnung. Behalten Sie deshalb die Spalte *Gesamtpuffer* im Blick.

**Nur ein fester Zeitabstand.** Bei einer externen Beziehung können Sie keinen Zeitabstand in Kalendertagen oder Prozent angeben. Die App zeigt *Externe Beziehungen unterstützen nur einen festen Zeitabstand in Arbeitstagen oder Arbeitszeit.* Die Arbeitstage zählen im Kalender Ihres eigenen Vorgangs. Ein Zeitabstand in Stunden zählt nur für einen Vorgang, der in Stunden geplant ist. Bei einem Vorgang in Tagen ignoriert die Berechnung ihn. Verwenden Sie dann Arbeitstage.

**Die Projekt-ID einer anderen Datei.** Die Projekt-ID steht nicht in einem Feld oder einer Spalte. Sie ist als `InternalProjectId` im IFC dieses Projekts gespeichert. Öffnen Sie dazu das Projekt, wechseln Sie zur Registerkarte *IFC* und wählen Sie *IFC generieren*. Die Berechnung nutzt nur den Ankertermin. Die ID ist mehr als nur eine Bezeichnung. Beim Aktualisieren erkennt die App eine Quelldatei zuerst an ihrer Projekt-ID, danach an ihrem Dateipfad. Wenn Sie bei einer manuellen Beziehung dieselbe ID eintragen wie die einer Quelldatei, wird die Beziehung zusammen mit dieser Datei aktualisiert. Die *Vorgangs-ID* eines Vorgangs im anderen Projekt finden Sie in der Vorgangstabelle dieses Projekts, in der Spalte *Vorgangs-ID* unter *Technisch*.

## Siehe auch

- [Beziehungen und Zeitabstand](docs://uitleg-relaties): wie die App eine Beziehung und einen Zeitabstand berechnet.
- [Beziehungen hinzufügen](docs://howto-relaties-leggen): Beziehungen zwischen Vorgängen im selben Projekt.
- [Einschränkungen und Stichtage](docs://uitleg-constraints): Datumsgrenzen für einen Vorgang, ohne anderes Projekt.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): enthält eine externe Beziehung bei *Car park paving* (ein externer Vorgänger).
