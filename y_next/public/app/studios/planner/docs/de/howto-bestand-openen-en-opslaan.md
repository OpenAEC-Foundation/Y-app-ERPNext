# Datei öffnen und speichern

Ziel: ein Projekt aus einer Datei öffnen und Ihre Änderungen behalten.

## Wann Sie dies brauchen

Sie beginnen den Tag mit dem Projekt von gestern, Sie erhalten eine Datei von einem Kollegen oder aus einem anderen Programm, oder Sie wollen einen Zwischenstand sichern, bevor Sie etwas Großes ändern. Was die App in einer Datei speichert und warum nur IFC Ihr ganzes Projekt behält, steht in [Dateien und Formate](docs://uitleg-bestanden).

## Schritte

### Eine Datei öffnen

1. Wählen Sie *Start › Datei › Öffnen*, oder *Datei › Öffnen*, oder drücken Sie Strg+O (⌘+O auf dem Mac). *Öffnen* steht auch in der Leiste ganz oben. Die Gruppe *Datei* steht auch auf dem Reiter *Tabelle*.
2. Wählen Sie die Datei. Sie öffnen immer nur eine Datei. In der Desktop-App und in Browsern mit Dateizugriff, wie Chrome und Edge, zeigt das Fenster eine Liste mit Dateitypen: *Alle unterstützten*, *IFC-Dateien*, *CSV-Dateien*, *XML-Dateien*, *MS Project-Dateien* und *Primavera XER-Dateien*.
3. Das Projekt öffnet sich in einem neuen Reiter. Wenn der aktuelle Reiter noch leer und unverändert war, öffnet sich das Projekt darin.

Der Reiter erhält den Dateinamen einer IFC-Datei. Ein Projekt aus einem anderen Format erhält seinen Projektnamen.

Die App öffnet `.ifc`, `.csv`, `.xml` (MS Project-XML oder Primavera P6-XML), `.mpp` und `.xer`. Für die letzten beiden gibt es eigene Schritte in [Öffnen einer MS Project-Datei (.mpp)](docs://howto-mpp-openen) und [Öffnen einer Primavera P6-Datei (.xer)](docs://howto-xer-openen).

### Ein zuletzt verwendetes Projekt öffnen

Wählen Sie *Start › Datei › Zuletzt verwendet* und klicken Sie in der Liste auf eine Datei, oder wählen Sie *Datei › Zuletzt verwendet*. Die Liste behält die letzten zehn Dateien, die Sie geöffnet, gespeichert oder exportiert haben. Die Desktop-App zeigt bei jeder Datei den Pfad, ein Browser nur den Namen.

Wenn die App eine Datei in der Liste nicht mehr lesen kann, zum Beispiel weil Sie sie verschoben haben, verschwindet sie ohne Meldung aus der Liste. In Browsern ohne Dateizugriff, wie Firefox, bleibt *Zuletzt verwendet* leer.

### Ein Beispiel öffnen

Wählen Sie *Datei › Beispiele* und klicken Sie auf ein Beispielprojekt. Es öffnet sich in einem Reiter, ohne Datei. *Speichern* fragt deshalb, wo Sie es ablegen möchten.

### Speichern

Wählen Sie *Start › Datei › Speichern* oder *Datei › Speichern*, oder drücken Sie Strg+S. Was dann passiert, hängt von Ihrem Projekt ab:

1. Wenn das Projekt schon eine Datei hat, weil Sie eine IFC-Datei geöffnet oder vorher gespeichert haben, schreibt die App in diese Datei. Es erscheint kein Fenster.
2. Wenn das Projekt noch keine Datei hat, fragt die App, wohin sie es speichern soll. Sie schlägt den Projektnamen mit `.ifc` vor. Danach ist diese Datei die Datei des Projekts.
3. Wenn Ihr Browser nur über einen Download speichert (wie Firefox), landet die Datei in Ihrem Downloads-Ordner, und jedes Speichern erzeugt einen neuen Download. Beim ersten Mal in einer Sitzung sehen Sie die Meldung *Als Download gespeichert: „name.ifc“ liegt in Ihrem Downloads-Ordner. Dieser Browser erlaubt der App nicht, an einem eigenen Ort zu schreiben, daher erzeugt jedes Speichern einen neuen Download. In Chrome, Edge oder der Desktop-App aktualisiert Speichern einfach dieselbe Datei.*
4. Wenn Ihr Browser nicht in die Datei des Projekts zurückschreiben kann, fragt die App bei jedem Speichern erneut, wohin die Datei soll. Das sieht aus wie *Speichern unter*, ist aber eine Grenze des Browsers. Beim ersten Mal in einer Sitzung erklärt die Meldung *Dieser Browser erlaubt der App nicht, in „name.ifc“ zurückzuschreiben.* das, mit einem Link zu [Dateien](docs://uitleg-bestanden).

Nach dem Speichern verschwindet die Markierung *Nicht gespeichert*: der Punkt auf dem Reiter, das Sternchen vor dem Projektnamen oben und der Text *Nicht gespeichert* unten rechts in der Statusleiste.

### Unter einem anderen Namen speichern

Wählen Sie *Start › Datei › Speichern unter* oder *Datei › Speichern unter*, oder drücken Sie Strg+Umschalt+S. Wählen Sie einen Namen und einen Ort (in Firefox lädt die App stattdessen eine neue Datei herunter). Danach arbeitet das Projekt mit dieser neuen Datei: das nächste *Speichern* schreibt dorthin. Die alte Datei bleibt so, wie sie beim letzten Speichern war.

### Ein Projekt schließen

Klicken Sie auf das Kreuz auf dem Reiter, oder wählen Sie *Datei › Projekt schließen*. Wenn das Projekt Änderungen hat, die Sie nicht gespeichert haben, fragt die App: *Nicht gespeicherte Änderungen: „name“ hat Änderungen, die noch nicht gespeichert sind.* Sie wählen *Abbrechen* (das Projekt bleibt geöffnet), *Nicht speichern* (das Projekt schließt sich und Ihre Änderungen sind weg) oder *Speichern* (zuerst speichern, dann schließen). Wenn Sie die ganze App auf dem Desktop schließen (mit dem Schließen-Knopf, Alt+F4 oder dem Menü Ihres Betriebssystems), fragt sie dies für jedes Projekt mit Änderungen. *Abbrechen* oder ein Speichern, das fehlschlägt, stoppt das Schließen. Nach so einem normalen Schließen räumt die App die Wiederherstellungskopien dieser Sitzung auf. Daher erscheint das Wiederherstellungsfenster nur nach einem echten Absturz. Wenn ein Projekt Änderungen hat und Sie den Browser-Tab oder das Browserfenster schließen, bittet der Browser um Bestätigung.

## Stolperfallen und was die App dann tut

**Eine geöffnete IFC-Datei ist sofort die Datei Ihres Projekts.** *Speichern* überschreibt diese Datei, auch wenn sie aus einem anderen Programm stammt. Wenn Sie das Original behalten wollen, wählen Sie zuerst *Speichern unter*.

**Andere Formate werden nie überschrieben.** Eine `.csv`, `.xml`, `.mpp` oder `.xer` hat nach dem Öffnen keine Datei. *Speichern* schreibt eine neue IFC-Datei und lässt das Original unberührt.

**In Firefox erzeugt jedes Speichern eine neue Datei.** Die App kann dort nicht in Ihre Datei schreiben. Sie lädt jedes Mal eine neue Datei herunter, mit dem Projektnamen als Dateinamen und nicht mit dem Namen der Datei, die Sie geöffnet haben.

**Chrome und Edge fragen um Erlaubnis.** Beim ersten *Speichern* einer geöffneten Datei fragt der Browser, ob die App in diese Datei schreiben darf. Wenn Sie ablehnen, öffnet die App ein Fenster, in dem Sie eine neue Datei wählen. In Chrome und Edge sehen Sie dieses Fenster auch, wenn das Schreiben in die vorhandene Datei fehlschlägt, zum Beispiel weil die Datei verschwunden oder gesperrt ist.

**Speichern kann fehlschlagen.** Wenn das Speichern selbst einen Fehler meldet, zeigt die App *Speichern fehlgeschlagen* mit dem Grund. Ihr Projekt bleibt geöffnet und ist weiterhin als *Nicht gespeichert* markiert.

## Siehe auch

- [Dateien und Formate](docs://uitleg-bestanden): was in einer IFC-Datei steht und wie die App mit Formaten umgeht.
- [Automatisches Speichern einschalten](docs://howto-automatisch-opslaan): die App Ihre Datei selbst aktualisieren lassen.
- [Exportieren](docs://howto-exporteren): eine Kopie in einem anderen Format erstellen.
- [Wiederherstellen nach einem Absturz](docs://howto-herstellen-na-een-crash): was Sie tun, wenn die App nicht sauber geschlossen wurde.
- [Import- und Exportformate](docs://ref-import-exportformaten): pro Format, was übernommen wird und was nicht.
