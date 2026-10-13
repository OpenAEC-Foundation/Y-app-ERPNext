# Einen Pfad verfolgen

Ziel: Die Kette von Vorgängen vor oder nach einem Vorgang sichtbar machen, damit Sie sehen, was einen Vorgang auf seinen Termin setzt und was sich mitverschiebt, wenn er sich verspätet.

## Wann Sie das brauchen

Der Dachbau beginnt erst in drei Wochen. Sie wollen wissen, welcher Vorgang das bestimmt. Oder der Maurer hat eine Woche Verspätung. Sie wollen sehen, welche Vorgänge danach sich mitverschieben. In einem Terminplan mit Dutzenden Beziehungen erkennen Sie das an den Linien nicht. Mit **Pfadverfolgung** färbt die App alle **Vorgänger** (Vorgänge, die vor dem gewählten Vorgang liegen, direkt oder über andere Vorgänge) und alle **Nachfolger** (Vorgänge, die danach liegen) ein. Der Rest wird abgeblendet.

## Schritte

1. Wählen Sie den Vorgang, dessen Pfad Sie sehen wollen, in der Vorgangstabelle oder auf seinem Balken im Gantt-Diagramm. Wenn Sie mehrere Vorgänge wählen, verfolgt die App den Pfad ab dem Vorgang, den Sie zuerst gewählt haben.
2. Wählen Sie *Planung › Pfadverfolgung › Vorgänger* für alles, was vor dem Vorgang liegt, oder *Planung › Pfadverfolgung › Nachfolger* für alles, was danach liegt. Beide Schaltflächen können gleichzeitig aktiv sein. Dieselben zwei Schaltflächen finden Sie auf dem Reiter *Tabelle* in der Gruppe *Pfadverfolgung*.
3. Wenn Sie beide Richtungen auf einmal sehen wollen, klicken Sie den Vorgang mit der rechten Maustaste, im Gantt-Diagramm oder in der Vorgangstabelle, und wählen Sie *Pfad verfolgen*.
4. Sehen Sie sich das Ergebnis im Gantt-Diagramm und in der Vorgangstabelle an. Wie Sie es lesen, wird unten erklärt.
5. Sie beenden die Pfadverfolgung, indem Sie die aktive Schaltfläche noch einmal klicken, indem Sie mit der rechten Maustaste auf einen Vorgang klicken und *Pfadverfolgung beenden* wählen, oder mit Esc. Esc hebt außerdem die Auswahl auf.

Wenn Sie während der Verfolgung einen anderen Vorgang wählen, folgt der Pfad der neuen Auswahl.

## Das Ergebnis lesen

- Vorgänger sind gold, Nachfolger lila. Im Gantt-Diagramm ändern die Balken ihre Farbe. In der Vorgangstabelle erscheint links von der Zeile ein Streifen: durchgezogen für Vorgänger, gestrichelt für Nachfolger. Der gewählte Vorgang hat einen Rand.
- Eine dunklere Farbe, in der Vorgangstabelle ein dickerer Streifen mit fettem Text, markiert die Kette der **maßgebenden** Beziehungen: der Beziehungen, die die Termine wirklich bestimmen. Was das bedeutet, wird unter [Beziehungen und Zeitabstand](docs://uitleg-relaties) erklärt.
- Alle Vorgänge außerhalb des Pfads werden abgeblendet. Beziehungslinien, die nicht zum Pfad gehören, sind blasser und gepunktet.

## Fallstricke und was die App macht

**Kein Vorgang gewählt.** Ohne gewählten Vorgang gibt es nichts zu verfolgen: Die Schaltfläche ist aktiv, aber auf dem Bildschirm ändert sich nichts. Wählen Sie zuerst einen Vorgang.

**Keine Hervorhebung der maßgebenden Kette.** Die Hervorhebung stammt von der letzten Berechnung. Wenn der Terminplan noch nicht berechnet ist oder die Berechnung einen Fehler meldet, färbt die App alle Vorgänger und Nachfolger gleich stark ein. Drücken Sie **Berechnen** (F5), zum Beispiel über *Start › Terminplanung › Berechnen*, und sehen Sie sich den Pfad danach noch einmal an. Nach einer Änderung bleibt die Hervorhebung bei der vorherigen Berechnung, solange die Statusleiste *Veraltet — neu berechnen (F5)* anzeigt.

**Eine Beziehung auf einem Sammelvorgang.** Die Pfadverfolgung folgt den Beziehungen, so wie Sie sie angelegt haben. Eine Beziehung von einem Sammelvorgang oder zu einem Sammelvorgang verbindet den Sammelvorgang selbst. Für die Berechnung gilt sie für jeden Vorgang in diesem Sammelvorgang, aber der Pfad läuft nicht weiter zu den Vorgängen darin. Wenn Sie einen Vorgang in einem Sammelvorgang verfolgen, der durch eine Beziehung auf dem Sammelvorgang selbst mit einem anderen Vorgang verbunden ist, sehen Sie diese Beziehung daher nicht. Wählen Sie in diesem Fall den Sammelvorgang selbst.

**Nur die gewählte Richtung.** Wenn nur *Vorgänger* aktiv ist, sehen Sie nicht, was nach dem Vorgang kommt, und umgekehrt.

## Siehe auch

- [Beziehungen und Zeitabstand](docs://uitleg-relaties): warum eine Beziehung maßgebend ist und wie die App den Starttermin eines Vorgangs berechnet.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): welche Kette das Ende des Projekts bestimmt.
- [Beziehungen hinzufügen](docs://howto-relaties-leggen): eine Beziehung hinzufügen, wenn Ihnen im Pfad eine Verbindung fehlt.
