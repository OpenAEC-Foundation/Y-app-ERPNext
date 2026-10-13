# AutoSave einschalten

Ziel: Die App aktualisiert die Datei Ihres Projekts, während Sie arbeiten. So müssen Sie nicht ständig Strg+S drücken.

## Wann Sie das brauchen

Sie arbeiten lange an einem Terminplan, oder Sie vergessen regelmäßig zu speichern. Dann soll die Datei auf dem Datenträger oder in einem gemeinsamen Ordner mitlaufen. AutoSave ersetzt die Wiederherstellung nicht. Die Wiederherstellung ist immer aktiv und arbeitet getrennt von AutoSave. Den Unterschied lesen Sie in [Dateien und Formate](docs://uitleg-bestanden).

## Schritte

1. Wenn das Projekt noch keine Datei hat, speichern Sie es zuerst einmal mit *Start › Datei › Speichern unter*. Solange es keine Datei gibt, ist der Schalter grau. Der Tooltip sagt dann: *Speichern Sie dieses Projekt zuerst, um AutoSave zu verwenden.*
2. Klicken Sie oben links in der Leiste auf den Schalter *Automatisch speichern*. Wenn er eingeschaltet ist, sagt der Tooltip: *AutoSave ist aktiv: Änderungen werden in diese Datei geschrieben.*
3. Arbeiten Sie weiter. Sobald Ihr Projekt Änderungen hat, schreibt die App es in Ihre Datei. Das geschieht ohne Fenster und höchstens einmal alle zehn Sekunden. Die Markierung *Nicht gespeichert* verschwindet dann von selbst.
4. Wenn Sie aufhören wollen, klicken Sie noch einmal auf den Schalter. Der Tooltip sagt dann: *AutoSave ist aus. Die Wiederherstellung bleibt aktiv.*

Chrome und Edge erlauben zuerst nur das Lesen einer Datei, die Sie geöffnet haben. Der Schalter tut dort nichts, bis Sie einmal mit *Speichern* (Strg+S) gespeichert haben und der Browser das Schreiben erlaubt. Danach können Sie ihn einschalten. In Firefox bleibt der Schalter grau. Die App kann dort nicht in Ihre Datei schreiben.

## Fallstricke und was die App dann tut

**Der Schalter gehört zu einem Projekt.** Jedes offene Projekt hat seinen eigenen Zustand. Nach dem Öffnen eines Projekts ist der Schalter immer aus. Die App merkt sich ihn nicht für das nächste Mal.

**AutoSave schreibt nur in die Datei, die das Projekt schon hat.** Wenn Sie *Speichern unter* wählen, schreibt AutoSave ab dann in die neue Datei. Die App schreibt nur, wenn es Änderungen gibt.

**Das Schreiben kann fehlschlagen.** Wenn die Datei zum Beispiel verschwunden oder gesperrt ist, erscheint die Meldung *Automatisches Speichern fehlgeschlagen* mit dem Grund. Wenn der Browser keine Erlaubnis zum Schreiben hat (oder nicht mehr), überspringt die App diesen Durchgang stillschweigend. Sie fragt nicht danach.

**Die Datei bekommt auch Änderungen, die Sie lieber nicht behalten würden.** AutoSave schreibt den Stand Ihres Projekts, wie er in diesem Moment ist. Wenn Sie etwas mit Strg+Z rückgängig machen, bekommt die Datei innerhalb von zehn Sekunden auch diesen rückgängig gemachten Stand. Wenn Sie eine ältere Version behalten wollen, erstellen Sie zuerst eine Kopie mit *Speichern unter*.

**Ein Absturz kostet trotzdem die letzten Sekunden.** Die App schreibt höchstens einmal alle zehn Sekunden. Was Sie dazwischen getan haben, steht deshalb noch nicht in Ihrer Datei. Die Wiederherstellung hat dieselbe Grenze.

**Nach einer Wiederherstellung im Browser ist der Schalter wieder grau.** Ein Projekt, das Sie nach einem Absturz im Browser zurückbekommen, ist nicht mehr mit seiner Datei verbunden. Speichern Sie es einmal, dann funktioniert der Schalter wieder. Siehe [Wiederherstellen nach einem Absturz](docs://howto-herstellen-na-een-crash).

**Ein Projekt aus einem anderen Format hat keine Datei.** Eine Datei im Format CSV, XML, `.mpp` oder `.xer` bekommt erst beim Speichern eine IFC-Datei. Danach können Sie AutoSave einschalten.

## Siehe auch

- [Dateien und Formate](docs://uitleg-bestanden): der Unterschied zwischen Speichern, AutoSave und Wiederherstellung.
- [Öffnen und Speichern einer Datei](docs://howto-bestand-openen-en-opslaan): Speichern, Speichern unter und die Markierung *Nicht gespeichert*.
- [Wiederherstellen nach einem Absturz](docs://howto-herstellen-na-een-crash): was die App anbietet, wenn sie nicht sauber beendet wurde.
