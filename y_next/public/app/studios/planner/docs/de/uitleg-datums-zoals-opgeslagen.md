# Termine wie aufgezeichnet

Sie öffnen einen Terminplan aus Primavera oder MS Project, und die Termine weichen von dem ab, was Sie im anderen Programm gesehen haben. Ist der Import schiefgelaufen? Meistens nicht. In diesem Artikel lesen Sie, warum die App selbst neu berechnet, wann sie die Termine aus der Datei zeigt, was dann leer bleibt und wie Sie zur eigenen Berechnung zurückkehren. Das Beispiel am Ende verfolgt zwei Vorgänge durch den ganzen Ablauf.

## Das Konzept

Eine Datei mit einem Terminplan enthält zwei Arten von Daten. Erstens die Logik: Vorgänge, Dauern, Beziehungen, Kalender und Einschränkungen. Zweitens die Termine, die das andere Programm selbst daraus berechnet hat. Beim Öffnen verwendet Open Planner Studio die Logik und berechnet selbst. Die Termine in der Datei sind also keine Eingabe.

Wenn die eigene Berechnung zu anderen Terminen führt als in der Datei steht, wissen Sie nicht, welche Seite richtig ist. Die Datei kann Logik auslassen, die das andere Programm verwendet hat. Das andere Programm kann an einem Punkt auch anders rechnen als die App. Deshalb kann die App die Termine **wie aufgezeichnet** zeigen: die Termine, die das andere Programm in die Datei geschrieben hat. So vergleichen Sie mit dem, was Sie im anderen Programm gesehen haben.

## Wie die App damit umgeht

### Welches Berechnungsprofil die App verwendet

Die App berechnet mit einem **Berechnungsprofil**: einer Gruppe von Berechnungsregeln (Konventionen), die zum Beispiel bestimmt, wie sie den geplanten Anfang eines Vorgangs und Einschränkungen behandelt. Siehe [Berechnungsprofile und Konventionen](docs://uitleg-rekenprofielen). Es gibt drei eingebaute Profile: *Primavera P6*, *Microsoft Project* und *Open Planner Studio*. Eine `.xer`-Datei öffnet sich mit *Primavera P6* und eine `.mpp`-Datei mit *Microsoft Project*. CSV, MS Project XML und Primavera P6 XML öffnen sich mit *Open Planner Studio*. Das Profil eines Projekts finden Sie unter *Datei › Projektinfo*, bei *Berechnungsprofil und Berechnungsoptionen*. Eine IFC-Datei aus der App behält ihr Profil.

### Wann die App vergleicht

Beim Öffnen hält die App fest, was die Datei sagt, und vergleicht das mit ihrem eigenen Ergebnis. Das gilt für:

- eine Primavera-Datei (`.xer`) und Primavera P6 XML;
- MS Project XML und MS-Project-Dateien (`.mpp`);
- eine IFC-Datei aus einem anderen Programm, für die Vorgänge, deren frühe Termine in der Datei stehen;
- eine IFC-Datei aus der App selbst, die ihre Herkunft gespeichert hat. Unten lesen Sie, wann das der Fall ist.

Die App vergleicht nie eine CSV-Datei: Der Anfangstermin in einer CSV ist Eingabe und kein Ergebnis einer Berechnung. Auch eine IFC-Datei aus der App selbst ohne gespeicherte Herkunft wird nicht verglichen.

Wenn kein Vorgang abweicht, merken Sie nichts. Wenn mindestens ein Vorgang in einer Datei abweicht, die Sie gerade importieren, schaltet die App die Ansicht sofort ein.

Bei einer Primavera-Datei rechnet die App mit dem Berechnungsprofil *Primavera P6*. Dadurch bleibt der geplante Anfang aus der Datei als frühester Anfang erhalten. Ein Vorgang, der in der Datei später liegt, als die Beziehungen verlangen, aber dort ebenfalls geplant ist, bleibt deshalb, wo er ist: Dann gibt es keinen Unterschied.

### Was Sie sehen

Unter dem Menüband steht eine Leiste: *Sie sehen die Termine so, wie sie in der Datei aufgezeichnet sind; eine Neuberechnung würde 4 Vorgänge verschieben.* Bei einer Primavera-Quelle (einer `.xer`-Datei oder Primavera P6 XML) steht dort *Sie sehen den Terminplan so, wie Primavera ihn gespeichert hat; eine Neuberechnung würde 1 Vorgang verschieben.* Rechts in der Leiste steht die Schaltfläche *Neu berechnen*. Die Leiste hat kein Kreuz.

Außerdem erscheint eine Meldung: *4 Vorgänge zeigen die in der Datei gespeicherten Termine (nicht neu berechnet).* Nur bei einer `.xer`-Datei steht dort *1 Vorgang zeigt die von Primavera gespeicherten Termine (nicht neu berechnet).* Jeder Vorgang, für den die Datei Termine aufgezeichnet hat, zeigt im Bereich *Eigenschaften* eine Markierung: *Zeigt die von Primavera gespeicherten Termine für diesen Vorgang* bei einer Primavera-Quelle, oder *Zeigt die in der Datei gespeicherten Termine für diesen Vorgang* bei einer anderen Quelle. Das Gantt-Diagramm, die Vorgangstabelle und die Statusleiste zeigen die Termine aus der Datei.

### Was in dieser Ansicht leer bleibt

In dieser Ansicht berechnet die App nichts. Sie zeigt nur, was die Datei aufgezeichnet hat. Puffer und kritischer Pfad sehen Sie daher nur, wenn die Datei sie enthält. Wenn die Datei keine kritischen Vorgänge aufzeichnet, meldet die Statusleiste 0 kritische Vorgänge. Das sagt nichts über den kritischen Pfad im anderen Programm selbst aus. Was nur aus einer Berechnung kommt, gibt es in dieser Ansicht nicht: welche Beziehungen den Terminplan steuern, verletzte Einschränkungen, Vorgänge, die außer Reihenfolge laufen, und fast kritische Vorgänge.

Wenn die Datei nicht alles für einen Vorgang aufzeichnet, sehen Sie im Bereich *Eigenschaften* die Markierung *Erfassung teilweise unvollständig — siehe die Spalten für spätesten Termin/Puffer*. Bei einem CSV-Export bleiben für einen solchen Vorgang die Spalten *Kritisch* und *Gesamtpuffer* leer, statt einer erfundenen Null.

### Die Ansicht verlassen

Sie verlassen die Ansicht auf zwei Arten:

- Klicken Sie in der Leiste auf *Neu berechnen* oder wählen Sie *Berechnen* (F5). Die App berechnet nach ihren eigenen Regeln.
- Ändern Sie etwas, das die Termine ändern kann, zum Beispiel die Dauer eines Vorgangs oder einen neuen Vorgang. Die App verlässt die Ansicht und berechnet sofort neu, auch wenn *Automatisch berechnen* ausgeschaltet ist. Das Ändern eines Namens bewirkt das nicht: Die Ansicht bleibt eingeschaltet.

Eine Kalenderänderung aus der Ressourcenbibliothek lässt die Ansicht eingeschaltet und die Termine aus der Datei stehen, aktualisiert aber die Zahl in der Leiste.

Nach dem Verlassen gibt es keine Schaltfläche, um zur Ansicht zurückzukehren. *Strg+Z* bringt sie aber zurück, direkt nach dem Neuberechnen oder direkt nach einer solchen Änderung. Sonst können Sie die Quelldatei erneut öffnen. Bei einer `.xer`-Datei schaltet auch das erneute Öffnen einer IFC-Datei die Ansicht wieder ein, die Sie nach dem Neuberechnen gespeichert, aber nicht geändert haben.

### Wiederherstellung nach einem Absturz

Wenn Sie ein Projekt nach einem Absturz wiederherstellen, das in der Ansicht war, bleibt die Ansicht eingeschaltet. Das aktive Projekt zeigt dieselbe Leiste wie zuvor. Ein Projekt auf einem anderen Tab zeigt die Leiste ohne Zahl: *Sie sehen die Termine so, wie sie in der Datei aufgezeichnet sind. Es wurde nicht neu berechnet.* Siehe [Wiederherstellung nach einem Absturz](docs://howto-herstellen-na-een-crash).

### Speichern und erneut öffnen

Wenn Sie speichern, während Sie die Ansicht verwenden, schreibt die App die angezeigten Termine zusammen mit dem Quellformat in die IFC-Datei. Wenn Sie diese IFC-Datei später erneut öffnen und sie seit dem Import nicht bearbeitet haben, ist die Ansicht wieder eingeschaltet, ohne neue Meldung.

Wenn Sie dazwischen bearbeitet und gespeichert haben, hängt es von der Quelle ab. Bei einer Primavera-Datei nimmt die IFC-Datei die ursprüngliche `.xer`-Datei mit. Die App vergleicht dann erneut und bietet die Ansicht an: *Die Neuberechnung hat 1 von 2 Vorgängen gegenüber den Terminen in der Datei verschoben.* Dazu gehören die Schaltfläche *Aufgezeichnete Termine anzeigen* und ein Kreuz. Bei jedem abweichenden Vorgang zeigt der Bereich *Eigenschaften* die Markierung *Weicht von den gespeicherten Terminen ab*. *Aufgezeichnete Termine anzeigen* schaltet die Ansicht ein; Strg+Z macht das rückgängig. Das Kreuz blendet das Angebot aus.

Bei MS Project XML, `.mpp`, Primavera P6 XML oder einer IFC-Datei aus einem anderen Programm behält die IFC-Datei die Quelle nicht. Wenn Sie ein solches Projekt bearbeiten und speichern, vergleicht die App beim erneuten Öffnen nicht mehr.

## Beispiel: der Anbau

Angenommen, Sie öffnen eine Primavera-Datei *Uitbouw* (Anbau) mit zwei Vorgängen, in einem Kalender ohne Feiertage. Im Jahr 2027 sind der 6. Mai Christi Himmelfahrt und der 17. Mai Pfingstmontag: Mit Feiertagen im Kalender kämen die Termine anders heraus. *Fundering storten* (Fundament gießen) dauert 5 Arbeitstage, *Metselwerk* (Mauerwerk) 10 Arbeitstage, und Metselwerk folgt auf Fundering mit einer Ende-Anfang-Beziehung. Die Datei zeichnet auf, dass Fundering von Montag, 3. Mai, bis Freitag, 7. Mai 2027 läuft und Metselwerk von Montag, 17. Mai, bis Freitag, 28. Mai 2027: eine Woche nach dem frühesten Anfang, den die Beziehung erlaubt. Der geplante Anfang von Metselwerk in der Datei ist Montag, 10. Mai 2027.

Direkt nach dem Öffnen sehen Sie die Termine aus der Datei. Die Statusleiste zeigt *Ende: 28.05.2027* und *Kritischer Pfad: 2 Vorgänge, 20 Arbeitstage*. Bei einer Neuberechnung weicht 1 Vorgang ab, und beide Vorgänge zeigen *Zeigt die von Primavera gespeicherten Termine für diesen Vorgang*.

Nach einem Klick auf *Neu berechnen* bleibt Fundering am 3. bis 7. Mai. Metselwerk beginnt nun am Montag, 10. Mai, dem nächsten Arbeitstag nach dem Ende von Fundering, und endet am Freitag, 21. Mai. Der Terminplan endet am 21. Mai 2027 und umfasst 15 Arbeitstage statt 20. Der kritische Pfad besteht aus denselben 2 Vorgängen.

Und wenn es anders ist?

- Ist Metselwerk in der Datei auch auf Montag, 17. Mai, geplant, dann behält das Berechnungsprofil *Primavera P6* diesen Anfang. Die Berechnung ergibt den Zeitraum 17. bis 28. Mai, es gibt keinen Unterschied und die Ansicht schaltet sich nicht ein.
- Sie fügen in der Ansicht einen Vorgang hinzu: dieselbe Neuberechnung. Metselwerk verschiebt sich auf den 10. bis 21. Mai.
- Sie speichern in der Ansicht und öffnen die IFC-Datei erneut, ohne etwas zu bearbeiten: Metselwerk steht wieder auf dem 17. bis 28. Mai.
- Sie berechnen neu, speichern ohne weitere Bearbeitung und öffnen die IFC-Datei erneut: Die Ansicht ist wieder eingeschaltet, und Metselwerk steht auf dem 17. bis 28. Mai.
- Sie bearbeiten, speichern und öffnen erneut: Die App bietet die Ansicht an, mit *Die Neuberechnung hat 1 von 2 Vorgängen gegenüber den Terminen in der Datei verschoben.* Metselwerk zeigt *Weicht von den gespeicherten Terminen ab*.

## Folgen und Missverständnisse

**Ein Unterschied ist kein Importfehler.** Die App berechnet nach ihren eigenen Regeln: bei einer `.xer`-Datei mit dem Berechnungsprofil *Primavera P6*, bei einer `.mpp`-Datei mit *Microsoft Project*, bei CSV, MS Project XML und Primavera P6 XML mit *Open Planner Studio*. Warum die Termine im Quellprogramm anders herauskamen, kann an der Datei oder am Programm liegen. Die Ansicht zeigt Ihnen, *dass* sie abweichen.

**Die Ansicht ist kein Berechnungsergebnis.** Die App hat die Termine nicht berechnet. Übernehmen Sie sie nicht einfach als Ergebnis Ihres eigenen Terminplans.

**Speichern in der Ansicht behält die Termine des Quellprogramms.** Die IFC-Datei enthält dann, was das Quellprogramm sagte, und nicht, was die App berechnen würde.

**Die Schaltfläche *Aufgezeichnete Termine anzeigen* erscheint nicht bei jedem Import.** Bei einer neu geöffneten Datei ist die Ansicht schon eingeschaltet. Die Schaltfläche erscheint nur bei einer erneut geöffneten IFC-Datei mit einer Primavera-Quelle, die Sie seit dem Import bearbeitet haben.

## Siehe auch

- [Dateien und Formate](docs://uitleg-bestanden): was die App in einer Datei behält und was ein Import oder Export mitbringt.
- [Eine Primavera P6-Datei (.xer) öffnen](docs://howto-xer-openen): die Schritte und Meldungen für eine `.xer`-Datei.
- [Eine MS-Project-Datei (.mpp) öffnen](docs://howto-mpp-openen): die Schritte und Meldungen für eine `.mpp`-Datei.
- [Wiederherstellung nach einem Absturz](docs://howto-herstellen-na-een-crash): was nach einem Absturz mit diesem Projekt geschieht.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): wie die App Puffer und Kritikalität berechnet, wenn sie berechnet.
