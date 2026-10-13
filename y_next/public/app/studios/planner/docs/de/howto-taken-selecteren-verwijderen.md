# Vorgänge auswählen, löschen und rückgängig machen

Ziel: Vorgänge auswählen, entfernen und einen Fehler rückgängig machen.

## Wann Sie das brauchen

Fast jede Aktion im Terminplan wirkt auf die ausgewählten Vorgänge: Löschen, Kopieren, tiefer stufen oder einen Meilenstein ein- oder ausschalten. Sie entfernen Vorgänge, wenn die Arbeit entfällt oder der Terminplan überarbeitet wird. Und weil die App beim Löschen nicht nachfragt, ist *Rückgängig* Ihr Sicherheitsnetz.

## Schritte

### Vorgänge auswählen

- **Ein Vorgang.** Klicken Sie auf die Zeile in der Vorgangstabelle oder auf den Balken im Gantt-Diagramm.
- **Mehrere Vorgänge.** Mit Strg+Klick (⌘+Klick auf einem Mac) fügen Sie einen Vorgang zur Auswahl hinzu oder entfernen ihn daraus. In der Vorgangstabelle wählt Umschalt+Klick alle Vorgänge vom aktiven Vorgang bis zu dem Vorgang aus, auf den Sie geklickt haben.
- **Alle sichtbaren Vorgänge.** Strg+A, wenn der Fokus in der Vorgangstabelle oder im Gantt-Diagramm liegt. Vorgänge, die ein Filter ausblendet, liegen außerhalb der Auswahl. Das gilt auch für Teilvorgänge in einer eingeklappten Phase.
- **Ein Auswahlrahmen im Gantt-Diagramm.** Halten Sie Strg gedrückt und ziehen Sie über den leeren Hintergrund. Alle Vorgänge in den Zeilen, die der Rahmen berührt, werden ausgewählt, auch wenn ihr Balken daneben liegt. Nur die Höhe des Rahmens zählt, nicht die Zeitachse. Lassen Sie Strg erst nach der Maustaste los, dann kommen die Vorgänge zur bestehenden Auswahl hinzu. Sonst ersetzen sie die Auswahl. Ohne Strg scrollt dieses Ziehen in der Standardeinstellung die Zeitachse.
- **Nichts.** Esc, oder ein Klick auf den leeren Hintergrund des Gantt-Diagramms.

Wenn Sie einen Sammelvorgang auswählen, werden seine Teilvorgänge nicht mit ausgewählt. Beim Löschen und Kopieren werden sie aber mitgenommen.

### Vorgänge löschen

Wählen Sie die Vorgänge aus und nutzen Sie einen dieser Wege:

- *Start › Bearbeiten › Löschen*. Dieselbe Schaltfläche finden Sie auf der Registerkarte *Tabelle*.
- Entf oder Rücktaste, wenn der Fokus nicht in der Vorgangstabelle liegt. Klicken Sie also zuerst auf einen Balken im Gantt-Diagramm.
- *Löschen* im Kontextmenü, das Sie mit einem Rechtsklick öffnen. Liegt der Vorgang, auf den Sie geklickt haben, in der Auswahl, gilt der Befehl für die ganze Auswahl. Sonst gilt er nur für diesen einen Vorgang.
- Der kleine Papierkorb oben im Bereich *Eigenschaften* (QuickInfo *Vorgang löschen*). Er löscht den Vorgang, den der Bereich zeigt.

Die App fragt nicht nach einer Bestätigung. Wenn Sie mehrere Vorgänge auf einmal löschen, ist das ein einziger Schritt für *Rückgängig*.

Dabei verschwinden auch: alle Teilvorgänge eines gelöschten Sammelvorgangs, alle Beziehungen von und zu den gelöschten Vorgängen und ihre Zuweisungen zu Ressourcen. Löschen Sie den letzten Teilvorgang eines Sammelvorgangs, bleibt der Sammelvorgang als normaler Vorgang bestehen. Ist *PSP auto* eingeschaltet, nummeriert die App den Strukturbaum neu. Danach ist der Terminplan nicht mehr aktuell. Drücken Sie **Berechnen** (F5), es sei denn, *Automatisch berechnen* ist eingeschaltet.

### Einklappen und Ausklappen

Ein Sammelvorgang hat vor seinem Namen in der Vorgangstabelle ein Dreieck. Klicken Sie darauf, um seine Teilvorgänge ein- oder auszublenden. Mit *Ansicht › Gliederung › Einklappen* und *Ausklappen* tun Sie das für die ausgewählten Sammelvorgänge, oder für alle, wenn nichts ausgewählt ist. Das Kontextmenü eines Sammelvorgangs hat ebenfalls *Einklappen* und *Ausklappen*. In gruppierter Darstellung wirken die Schaltflächen auf die Gruppen.

Die App speichert das Ein- und Ausklappen pro geöffnetem Dokument. Es gehört nicht zu *Rückgängig* und steht nicht in der Projektdatei.

### Rückgängig machen und wiederholen

- *Start › Bearbeiten › Rückgängig* und *Wiederholen* (auch auf der Registerkarte *Tabelle*), die Pfeile in der Titelleiste, oder Strg+Z für Rückgängig und Strg+Y oder Strg+Umschalt+Z für Wiederholen.
- Wenn Sie nach einem *Rückgängig* etwas Neues tun, ist *Wiederholen* nicht mehr möglich.

*Rückgängig* umfasst Änderungen an Ihren Projektdaten (Vorgänge, Beziehungen, Ressourcen, Kalender und dergleichen) und das Anwenden eines Layouts. Änderungen an den Spalten der Vorgangstabelle sind ebenfalls Schritte: Hinzufügen, Entfernen, Verschieben, Größe ändern, automatisch an den Inhalt anpassen, Fixieren und das Zurücksetzen der Spaltenanordnung auf den Standard. Diese Spaltenschritte gehören zur Vorgangstabelle selbst und gelten für die ganze App, nicht für ein einzelnes Dokument. Die App behält die letzten hundert Schritte pro Dokument, bei einem sehr großen Projekt weniger.

## Fallstricke und was die App macht

**Löschen in der Vorgangstabelle löscht keinen Vorgang.** Liegt der Fokus in der Vorgangstabelle, leert Entf (oder Rücktaste) den Inhalt der ausgewählten Zellen. Bei einer Zelle mit Pflichtwert oder einer berechneten Zelle, etwa dem Namen oder der Dauer, verweigert die App das. Sie zeigt dann unter der Vorgangstabelle eine Meldung, für den Namen zum Beispiel *Dieser Wert ist erforderlich und darf nicht leer bleiben.* Dann wird nichts geleert, auch nicht in anderen ausgewählten Zellen. Klicken Sie auf einen Balken im Gantt-Diagramm oder nutzen Sie *Löschen*. Auf der Registerkarte *Tabelle* gibt es kein Gantt-Diagramm. Dort nutzen Sie *Tabelle › Bearbeiten › Löschen* oder das Kontextmenü.

**Eine ganze Phase verschwindet auf einmal.** Löschen Sie einen Sammelvorgang, verschwinden seine Teilvorgänge, deren Beziehungen und Zuweisungen mit ihm. *Rückgängig* (Strg+Z) stellt alles wieder her, auch die Beziehungen und Zuweisungen.

**Was nicht zurückkommt.** Die Auswahl, das Ein- und Ausklappen und die Schaltfläche *Löschen* in der Leiste *Nicht verfügbar während des Filterns/Gruppierens/Sortierens* gehören nicht zu *Rückgängig*. Drücken Sie Strg+Z nach *Löschen*, dann machen Sie also den vorherigen Schritt rückgängig, nicht das Leeren.

**Ein Vorgang, von dem andere abhängen, wird entfernt.** Die Beziehungen von und zu diesem Vorgang verschwinden ebenfalls. Vorgänge, die nur daran hingen, lösen sich. Nach **Berechnen** starten sie wieder an ihrem eigenen geplanten Starttermin. Fügen Sie bei Bedarf neue Beziehungen hinzu, siehe [Beziehungen hinzufügen](docs://howto-relaties-leggen).

## Siehe auch

- [Vorgänge und Meilensteine hinzufügen](docs://howto-taken-en-mijlpalen-toevoegen): das Gegenstück, sowie das Kopieren von Vorgängen.
- [Die Struktur anpassen](docs://howto-structuur-aanpassen): hängen Sie einen Vorgang unter eine andere Phase, statt ihn zu entfernen.
- [Ziehen, Verschieben und Zoomen im Gantt-Diagramm](docs://howto-gantt-bedienen): der Auswahlrahmen und die Scrollmodi.
- [Kontextmenüs](docs://ref-contextmenus): was *Löschen* und die anderen Einträge mit einer Auswahl machen.
