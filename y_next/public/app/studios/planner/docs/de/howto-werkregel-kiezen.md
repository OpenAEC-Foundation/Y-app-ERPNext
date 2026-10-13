# Eine Arbeitsregel wählen

Ziel: Legen Sie pro Vorgang fest, was die App anpasst, wenn Sie die Dauer, die Einheiten oder die Arbeit ändern: die Dauer, die Einheiten oder die Arbeit selbst.

## Wann Sie das brauchen

Sie haben einem Vorgang Ressourcen zugewiesen, und Sie wollen, dass die App so rechnet, wie Sie es tun. Ein Beispiel: Der Kran ist für einen Tag gemietet, und dieser Tag steht fest. Ein anderes Beispiel: Sie wissen, dass darin 160 Stunden Mauerwerk stecken. Sie wollen sehen, wie lange es mit drei statt zwei Personen dauert. Diese beiden Situationen brauchen eine andere Arbeitsregel.

Die Regel legt fest, welche der drei Größen Dauer, Einheiten und Arbeit mitgeht, wenn Sie eine der anderen ändern. Hintergrund und Rechenbeispiele finden Sie unter [Arbeitsregeln: Dauer, Einheiten und Arbeit](docs://uitleg-werkregels).

## Schritte

### Arbeitsregel anzeigen

Die Arbeitsregel wird standardmäßig nicht angezeigt. Schalten Sie sie einmal ein:

1. Wählen Sie *Einstellungen › Projekt › Einstellungen*, Registerkarte *Planung*.
2. Setzen Sie unter der Überschrift *Berechnung* ein Häkchen bei *Arbeitsregeln und Arbeit anzeigen*.
3. Schließen Sie das Fenster mit *Schließen*.

Dies ist eine Einstellung der App, nicht der Projektdatei. Enthält eine Datei schon Arbeitsregeln oder gespeicherte Arbeit, etwa eine Datei aus MS Project oder Primavera P6, zeigt die App die Arbeitsregel für diese Datei auch ohne diese Einstellung. Dasselbe gilt, sobald Sie selbst in einer Datei eine Arbeitsregel wählen. Die Anzeige bleibt dann für diese Datei eingeschaltet, auch wenn Sie die Einstellung wieder ausschalten. Sie bleibt eingeschaltet, solange die Datei offen ist. Nach dem erneuten Öffnen bleibt sie eingeschaltet, solange die Datei eine Arbeitsregel oder gespeicherte Arbeit enthält.

### Eine Regel wählen

1. Wählen Sie den Vorgang aus. Der Bereich *Eigenschaften* steht rechts. Sehen Sie ihn nicht, schalten Sie ihn mit *Ansicht › Bereiche › Eigenschaften* ein.
2. Wählen Sie bei *Arbeitsregel* eine der fünf Optionen: *Projektstandard (Feste Dauer und Einheiten)*, *Feste Dauer und Einheiten*, *Feste Dauer und Arbeit*, *Feste Arbeit* oder *Feste Einheiten*. Bei *Projektstandard* folgt der Vorgang dem Standard des Projekts.
3. Unter der Auswahlliste zeigt die App, was die Regel schützt, zum Beispiel *Geschützt: Arbeit (Dauer folgt Einheiten)*.

*Projektstandard (Feste Dauer und Einheiten)* ist die erste Wahl und die Einstellung, die jeder Vorgang zuerst hat. Die Regel in den Klammern ist die Regel, die das Projekt im Moment als Standard hat. Die App hat keine Schaltfläche, um diesen Projektstandard zu ändern. Er kommt aus einem Import (zum Beispiel aus MS Project oder Primavera P6) oder aus der MCP-Verbindung. Wenn Sie für einen Vorgang eine andere Regel wollen, wählen Sie sie hier.

Sie können die Regel auch in der Tabelle wählen. Klicken Sie rechts in der Kopfzeile der Vorgangstabelle auf **+** (*Spalte hinzufügen*). Wählen Sie dann unter *Planung* die Spalte *Arbeitsregel*.

Ein Vorgang ohne Zuweisung hat nichts, was die Regel verbinden kann. Daher tut die Regel dort nichts. Weisen Sie zuerst eine Ressource zu (siehe [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen)).

### Arbeit sehen und ändern

Bei einem Vorgang mit Zuweisungen erscheint im Abschnitt *Zuweisungen* des Bereichs *Eigenschaften* die Spalte *Arbeit (Rest)*, neben *Einh./Tag*. Das ist die Restarbeit dieser Ressource in Stunden. Ein kleines Schloss über einer Spalte zeigt, was die Regel hält: *Einh./Tag* bei *Feste Dauer und Einheiten* und bei *Feste Einheiten*, *Arbeit (Rest)* bei *Feste Dauer und Arbeit* und bei *Feste Arbeit*.

Wenn Sie die Arbeit selbst ändern wollen, tippen Sie die Stunden in das Feld und drücken Sie die Eingabetaste. Die App akzeptiert keinen Wert von 0 oder weniger. Das Feld springt dann auf den vorherigen Wert zurück.

### Die Wirkung sehen

Wenn Sie eine Regel wählen, ändert sich noch keine Zahl. Bei einer Regel, die Arbeit schützt, legt die App nur die aktuelle Arbeit fest. Daher hat *Arbeit (Rest)* einen gespeicherten Wert. Erst bei der nächsten Änderung entscheidet die Regel, was mitgeht. Ändern Sie zum Beispiel *Einh./Tag* und sehen Sie, was mit der Dauer und der Arbeit passiert.

Ändert das die Dauer des Vorgangs, zeigt die Statusleiste *Veraltet — neu berechnen (F5)*. Drücken Sie **Berechnen** (F5), zum Beispiel über *Start › Terminplanung › Berechnen*, um die neuen Termine zu sehen. Ist *Automatisch berechnen* aktiv (gleiche Registerkarte *Planung*, Überschrift *Berechnung*), macht die App das selbst.

## Welche Regel passt

- **Feste Dauer und Einheiten** passt, wenn die Dauer vereinbart ist und Sie die Einheiten vorgeben. Die Arbeit folgt aus diesen beiden. Das ist der Standard. Der Kran, der für einen Tag gemietet ist, gehört hierher: Der Tag steht fest, und Sie bestimmen, wie viele Krane daran arbeiten.
- **Feste Dauer und Arbeit** passt, wenn der Vorgang innerhalb einer festen Zeitspanne fertig sein muss und Sie wissen, wie viel Arbeit darin steckt. Ändert sich die Dauer, passt die App die Einheiten an.
- **Feste Arbeit** passt, wenn Sie wissen, wie viele Stunden Arbeit darin stecken, und sehen wollen, wie sich die Dauer mit der Anzahl der Personen ändert. Die 160 Stunden Mauerwerk mit drei statt zwei Personen gehören hierher. Der Putz im Übungsprojekt bekommt diese Regel.
- **Feste Einheiten** passt, wenn die Einheiten feststehen, zum Beispiel ein Kran, und die Arbeit die Dauer bestimmt.

## Fallstricke und was die App dann tut

**Das Feld *Arbeitsregel* fehlt.** Dann ist die Einstellung *Arbeitsregeln und Arbeit anzeigen* aus, und die Datei hat noch keine Arbeitsregeln. Oder Sie haben einen Meilenstein, eine Phase, einen Hammock oder einen Vorgang mit dem Dauertyp *Verstrichene Zeit* gewählt. Dort gibt es keine Arbeitsregel. Wählen Sie einen normalen Vorgang.

**Die Dauer ändert sich, ohne dass Sie sie ändern.** Bei *Feste Arbeit* und *Feste Einheiten* folgt die Dauer aus Einheiten und Arbeit. Ändern Sie eine davon oder die Anzahl der Ressourcen, passt die App die Dauer an und rundet auf ganze Arbeitstage auf. Bei einem Vorgang in Stunden rundet die App auf ganze Minuten auf.

**Die Arbeit passt nicht genau zu Einheiten × Dauer.** Rundung kann das verursachen. Neben *Arbeit (Rest)* erscheint dann ein Warnzeichen, *Weicht von Einheiten × Dauer ab*. Das Histogramm folgt der gespeicherten Arbeit.

**Material zählt nicht.** Bei einer Materialressource zeigt *Arbeit (Rest)* einen Strich. Material bestimmt nie die Dauer.

**Ein Vorgang mit Fortschritt.** Die Regel wirkt nur auf die Restarbeit. Daher zeigt *Arbeit (Rest)* nur, was noch geschehen muss.

**Rückgängig machen.** Das Wählen einer Regel und jede Änderung, die die Regel berechnet, ist ein Schritt für *Rückgängig* (Strg+Z). Danach ist die Regel wieder weg. Das Feld *Arbeitsregel* bleibt aber sichtbar.

## Siehe auch

- [Arbeitsregeln: Dauer, Einheiten und Arbeit](docs://uitleg-werkregels): wie die App Dauer, Einheiten und Arbeit miteinander verbindet, mit Rechenbeispielen.
- [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen): eine Ressource einem Vorgang zuweisen.
