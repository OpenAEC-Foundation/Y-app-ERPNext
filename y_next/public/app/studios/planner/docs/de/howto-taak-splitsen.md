# Einen Vorgang teilen

Ziel: Unterbrechen Sie einen Vorgang, damit die Arbeit stoppt und später weitergeht, ohne dass daraus zwei Vorgänge werden.

## Wann Sie das brauchen

Das Verlegen der Bewehrung dauert acht Arbeitstage. Nach vier Tagen muss der Kran aber zu einer anderen Baustelle, und die Arbeit geht zwei Tage später weiter. Zwei getrennte Vorgänge bedeuten, dass Sie Ihre Beziehungen und Zuweisungen zweimal pflegen müssen. Mit einer **Unterbrechung** bleibt es ein Vorgang, mit einem Balken, der eine Lücke hat. Die App nennt die Unterbrechung auch *Pause*.

Die Arbeit bleibt gleich lang, aber der Vorgang dauert im Kalender jetzt länger. Ein Beispiel: Ein Vorgang mit 8 Arbeitstagen, der am Dienstag, 29. September 2026 beginnt, endet am Donnerstag, 8. Oktober. Wenn Sie nach 4 Arbeitstagen eine Unterbrechung von 2 Arbeitstagen einfügen, endet er am Montag, 12. Oktober. Die Dauer bleibt 8 Arbeitstage, nur das Ende verschiebt sich um zwei Arbeitstage.

## Schritte

### Im Gantt-Diagramm teilen

1. Wählen Sie *Start › Vorgänge › Vorgang teilen* (oder *Planung › Beziehungen › Vorgang teilen*). Über dem Terminplan erscheint der Hinweis *Klicken Sie auf einen Balken an dem Tag, an dem die Unterbrechung beginnt, und ziehen Sie nach rechts für die Länge. Esc beendet*. Die Schaltfläche steht auch auf der Registerkarte *Tabelle* (*Tabelle › Vorgänge › Vorgang teilen*), aber dort ist sie deaktiviert.
2. Bewegen Sie die Maus über den Balken. Eine gestrichelte Linie und eine Beschriftung mit dem Datum zeigen, wo die Unterbrechung beginnen würde. Drücken Sie auf den Balken, an dem Tag, an dem die Unterbrechung beginnt.
3. Ziehen Sie nach rechts. Die Beschriftung zeigt die Länge, zum Beispiel *2 Arbeitstage Unterbrechung*: den Abstand in Arbeitstagen bis zu dem Tag unter Ihrer Maus. Lassen Sie die Maustaste los.

Wenn Sie nur klicken, ohne zu ziehen, wird die Pause ein Arbeitstag. Wenn Sie nach links zurückziehen, wird die Pause wieder kürzer, bis auf ein Minimum von einem Arbeitstag. Bei einem Vorgang in Stunden arbeitet die Funktion in Stunden.

Der Modus bleibt eingeschaltet, sodass Sie weitere Vorgänge teilen können. Sie beenden mit Esc oder mit der Schaltfläche *Beenden* im Hinweis. Wenn Sie beim Ziehen Esc drücken, macht die App die Pause rückgängig, und der Modus endet. Jede Geste lässt sich mit *Rückgängig* in einem Schritt zurücknehmen.

Nach dem Teilen ist der Terminplan nicht mehr aktuell. Drücken Sie **Berechnen** (F5) für die endgültigen Termine.

### Eine vorhandene Unterbrechung im Gantt-Diagramm ziehen

Das funktioniert ohne den Teilen-Modus, direkt auf einem Balken mit einer Unterbrechung.

- Ziehen Sie den Abschnitt **nach** der Pause nach rechts oder links. Die Pause wird länger oder kürzer, mit der Beschriftung *3 Arbeitstage Unterbrechung*. Wenn Sie ihn zurückziehen, bis die Pause 0 ist, zeigt die Beschriftung *Zusammenführen*, und die beiden Abschnitte bilden wieder einen Vorgang.
- Ziehen Sie die rechte Kante des Abschnitts **vor** der Pause. Dieser Abschnitt wird länger oder kürzer, mit der Beschriftung *Abschnitt: 5 Arbeitstage*. Dabei ändert sich auch die Dauer des Vorgangs.
- Wenn Sie den ersten Abschnitt ziehen, verschieben Sie den ganzen Vorgang, wie bei jedem Balken.

### Im Eigenschaftenbereich teilen und anpassen

Wählen Sie den Vorgang aus. Im Bereich *Eigenschaften* steht der Block *Unterbrechungen* unter *Abhängigkeiten* und über *Zuweisungen*. Scrollen Sie bei Bedarf dorthin.

- *Unterbrechung hinzufügen* setzt eine Pause von einem Arbeitstag in die Mitte des längsten Abschnitts.
- Jede Pause hat zwei Felder: *nach* (wie viele Arbeitstage Arbeit vor der Pause liegen) und *Pause* (die Länge der Pause). Daneben stehen die Termine des Abschnitts nach der Pause. Bei einem Stundenvorgang zeigen sie Stunden.
- Wenn Sie *Pause* auf 0 setzen, verschwindet die Unterbrechung. Der kleine Papierkorb (*Unterbrechung aufheben*) macht dasselbe.

Achten Sie auf das Feld *nach*: Dieses Feld verlängert oder verkürzt den Abschnitt Arbeit vor der Pause und damit die Dauer des ganzen Vorgangs. Mit *Pause* ändert sich nur das Ende.

### Eine Unterbrechung entfernen

Klicken Sie mit der rechten Maustaste auf die Unterbrechung im Gantt-Diagramm oder auf den Abschnitt danach, und wählen Sie *Unterbrechung aufheben*. *Alle Unterbrechungen aufheben* steht im Rechtsklick-Menü jedes Balkens mit einer Unterbrechung. Oder verwenden Sie den Block *Unterbrechungen* im Bereich *Eigenschaften*, wie oben beschrieben.

### Mit einem KI-Assistenten

Ein verbundener KI-Assistent setzt Unterbrechungen mit dem Werkzeug `planner_set_task_splits`, in derselben Form wie im Bereich: nach wie vielen Arbeitstagen (oder Arbeitszeiten) Arbeit, und wie viele Arbeitstage (oder Arbeitszeiten) Pause. Er gibt immer die ganze Liste an; eine leere Liste entfernt alle Unterbrechungen. Er liest sie mit `planner_get_task` zurück. Dieselben Regeln gelten wie unten: Einen Vorgang, den Sie nicht teilen können, kann auch der KI-Assistent nicht teilen. Anders als bei einem Teilen, das Sie selbst vornehmen, wird der Terminplan danach von der App selbst neu berechnet. Wie Sie einen Assistenten verbinden, steht unter [Verbinden eines KI-Assistenten (MCP)](docs://howto-ai-assistent-koppelen).

## Fallstricke und was die App tut

**Nicht jeder Vorgang lässt sich teilen.** Sie können keinen Meilenstein, keinen Sammelvorgang, keinen Vorgang mit eingeschaltetem *Hammock (abgeleitete Dauer)* (siehe [Einen Hammock anlegen](docs://howto-hammock)), keinen Vorgang mit dem Dauertyp *Verstrichene Zeit*, keinen Vorgang, der *Manuell geplant* ist, und keinen Vorgang, der kürzer als zwei Arbeitstage ist, teilen. Im Teilen-Modus zeigt die Maus einen Verbotscursor, und nichts geschieht. Bei einem solchen Vorgang fehlt außerdem der Block *Unterbrechungen* im Bereich *Eigenschaften*.

**Auf der Registerkarte Tabelle funktioniert die Schaltfläche nicht.** *Vorgang teilen* ist dort deaktiviert, mit der QuickInfo *Nur verfügbar, wenn das Gantt-Diagramm sichtbar ist*. Die Geste braucht einen Balken. Der Teilen-Modus und der Modus zum Verknüpfen schalten einander aus.

**Ein Klick ohne Wirkung.** Eine Unterbrechung kann nicht am ersten Tag des Vorgangs beginnen und auch nicht in einer vorhandenen Pause. Jeder Abschnitt muss außerdem mindestens einen Arbeitstag lang bleiben. Wenn Sie an so einer Stelle klicken, geschieht nichts, ohne Meldung.

**Ein Vorgang mit Fortschritt.** Wenn der Vorgang Fortschritt hat, kann eine Unterbrechung erst nach der bereits erledigten Arbeit beginnen. Bei 50% von 8 Arbeitstagen ist das frühestens der fünfte Arbeitstag. Ein Klick im erledigten Teil bewirkt nichts, und ein zu 100% fertiggestellter Vorgang lässt sich nicht mehr teilen. Im Bereich ist die Schaltfläche *Unterbrechung hinzufügen* dann deaktiviert. Das gilt auch, wenn die Mitte des längsten Abschnitts in erledigte Arbeit fällt, zum Beispiel bei 75% von 8 Arbeitstagen.

**Auch der Kapazitätsabgleich erzeugt Unterbrechungen.** Sie erscheinen im Block *Unterbrechungen* mit der Beschriftung *Kapazitätsabgleich*. *Ressourcen › Kapazitätsabgleich › Aufheben* entfernt sie wieder. Wenn Sie die Unterbrechungen eines solchen Vorgangs selbst bearbeiten, werden alle seine Kapazitätsabgleich-Pausen zu Ihren eigenen, und *Aufheben* entfernt sie nicht mehr.

**Unterbrechungen werden nicht nach MS Project oder Primavera übernommen.** Wenn Sie nach *MS Project XML* oder *Primavera P6 XML* exportieren, kennt dieses Programm eine Unterbrechung nur als Arbeitsverteilung einer Zuweisung. Ohne so eine Verteilung kommt der Vorgang ohne Unterbrechung an, und die App meldet, wie viele Vorgänge das betrifft: *1 Vorgang mit Unterbrechungen wurde ohne seine Unterbrechungen exportiert: MS Project/P6 kennen diese nur als Arbeitsverteilung.* In der IFC-Datei der App bleiben sie erhalten.

**Eine Datei mit Unterbrechungen, die die App nicht bearbeiten kann.** Unterbrechungen aus einer Quelldatei, die nicht zur Form der App passen, zeigen im Bereich die Meldung *Diese Unterbrechungen stammen aus der Quelldatei in einer Form, die hier nicht bearbeitet werden kann*. Dort steht dann nur *Alle Unterbrechungen aufheben* zur Verfügung.

## Siehe auch

- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): wie der Terminplan in Arbeitstagen rechnet und warum sich das Ende verschiebt.
- [Beziehungen hinzufügen](docs://howto-relaties-leggen): ein anderer Modus im Gantt-Diagramm, den Sie mit einem Ziehen am Balken verwenden.
- [Vorgangsdialog und Eigenschaftenbereich](docs://ref-taak-eigenschappen): der Block Unterbrechungen im Eigenschaftenbereich.
