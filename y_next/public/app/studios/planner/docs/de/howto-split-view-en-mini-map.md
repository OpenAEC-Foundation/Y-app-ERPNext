# Geteilte Ansicht und Minimap verwenden

Ziel: Zwei Abschnitte der Zeitleiste nebeneinander sehen und schnell durch einen langen Terminplan navigieren.

## Wann Sie das brauchen

Sie besprechen den Beginn der Fundamente und gleichzeitig die Übergabe neun Monate später. Ohne Hilfe zoomen Sie ständig hinein und hinaus und verlieren den Überblick, wo Sie waren. Mit der **geteilten Ansicht** sehen Sie denselben Terminplan zweimal, nebeneinander, jeweils mit einem eigenen Zeitfenster. Mit der **Minimap** sehen Sie den gesamten Projektzeitraum in einem schmalen Streifen. Dort klicken Sie auf die Stelle, die Sie suchen, und springen direkt dorthin.

## Schritte

### Geteilte Ansicht einschalten

1. Wählen Sie den Reiter *Ansicht*. In der Gruppe *Präsentation* stehen *Präsentation*, *Geteilte Ansicht* und *Minimap*.
2. Klicken Sie auf *Geteilte Ansicht*. Das Gantt-Diagramm teilt sich in zwei. Beide Fenster starten mit dem Zoom und der Position Ihrer aktuellen Ansicht.

Beide Fenster teilen sich die Vorgangstabelle, die Zeilen und den vertikalen Bildlauf. Jedes Fenster hat eine eigene Zeitskala: den Zoom und die horizontale Position.

### Jedem Fenster einen eigenen Zeitabschnitt geben

- Zoomen und scrollen Sie in dem Fenster, über dem Ihre Maus liegt. Bei der Standardeinstellung für *Scrollen & Zoomen* (*Zoom + Ziehen*) zoomt das Mausrad in diesem Fenster, mit dem Mauszeiger als Mittelpunkt. Folgt Ihre Einstellung einem anderen Modus, macht das Mausrad in beiden Fenstern, was dieser Modus vorgibt.
- Bei der Standardeinstellung blättern Sie mit Umschalt und dem Mausrad durch die Zeilen. Das gilt für beide Fenster zugleich.
- Die Schaltflächen *Zoom +* und *Zoom -* und die Liste der Zeitskala (zum Beispiel *Quartal*) wirken nur auf das linke Fenster. Zoomen Sie das rechte Fenster daher mit dem Mausrad.
- Ziehen Sie die Trennleiste zwischen den beiden Fenstern nach links oder rechts, um sie breiter oder schmaler zu machen. Am Anfang nimmt jedes Fenster die Hälfte ein.

### Geteilte Ansicht ausschalten

Klicken Sie erneut auf *Geteilte Ansicht*. Ein Fenster bleibt, mit der Ansicht des linken Fensters. Eine neue geteilte Ansicht startet wieder mit der Ansicht zu diesem Zeitpunkt.

### Minimap einschalten

1. Klicken Sie in der Gruppe *Präsentation* auf *Minimap*.
2. Unter der Zeitleiste erscheint ein Streifen des gesamten Projektzeitraums. Die Vorgänge Ihrer aktuellen Ansicht sind als dünne Striche zu sehen. Nach einem Filter zeigt der Streifen also nur die Vorgänge, die der Filter zeigt. Ein Rahmen markiert den Teil, den Sie jetzt sehen.
3. Klicken Sie irgendwo auf den Streifen, um den Rahmen dorthin zu setzen. Das Fenster zentriert sich auf diese Stelle. Oder fassen Sie den Rahmen und ziehen Sie ihn.

Die Minimap verschiebt nur das Zeitfenster. Die Zeilen bleiben unverändert.

Ist die geteilte Ansicht eingeschaltet, bekommt jedes Fenster einen eigenen Streifen unter seinem Teil der Zeitleiste. Jeder Streifen steuert nur das Fenster darüber.

## Fallstricke und was die App macht

**Die Minimap tut nichts, wenn das ganze Projekt schon sichtbar ist.** Sie zoomen so weit heraus, dass der ganze Terminplan passt. Dann gibt es nichts, wohin die Minimap springen kann. Klicken hat keine Wirkung. Zoomen Sie zuerst hinein.

**Die Minimap gibt es nur beim Gantt.** Bei den Reitern *Tabelle*, *IFC* und *Bericht* und im vollständigen Ressourcen-Panel (*Ressourcen*, nicht *Ressourcen-Dock*) gibt es keine Zeitleiste. Dort gibt es also weder Minimap noch geteilte Ansicht. Beides kommt zurück, sobald Sie zu einer Ansicht mit Gantt wechseln.

**Die geteilte Ansicht gehört zum Projekt, die Minimap nicht.** Die geteilte Ansicht gilt für das geöffnete Projekt. Wechseln Sie zu einem anderen Projekt und zurück, dann ist sie noch da. Die Minimap ist eine Wahl für alle Projekte. Sie bleibt nach einem Neustart ein- oder ausgeschaltet. Beides sind Bildschirmeinstellungen. Sie gehen nicht in die Projektdatei, sorgen nicht dafür, dass das Projekt als geändert gilt, und stehen nicht in *Rückgängig*.

**Geteilte Ansicht und Präsentation.** Beide bleiben sichtbar, wenn Sie den Präsentationsmodus einschalten (siehe [Präsentation auf einem großen Bildschirm](docs://howto-presentatie)). Weil dann das Menüband fehlt, können Sie beides in diesem Modus nicht mehr ein- oder ausschalten. Richten Sie beides also vorher richtig ein.

## Siehe auch

- [Präsentation auf einem großen Bildschirm](docs://howto-presentatie): das Gantt im Vollbild, ohne Menüband.
- [Ein Layout erstellen und verwenden](docs://howto-layouts-gebruiken): die Zeitskala kann auch als Teil eines Layouts gespeichert werden.
