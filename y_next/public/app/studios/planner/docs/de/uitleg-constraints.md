# Einschränkungen und Stichtage

Die Ziegel werden erst am 21. Juni geliefert. Die Genehmigung ist noch nicht eingegangen. Das Dach muss vor den Bauferien geschlossen sein. Beziehungen legen fest, dass ein Vorgang auf einen anderen Vorgang wartet. Vereinbarungen über ein Datum folgen aber nicht aus der Reihenfolge der Arbeiten. Dafür gibt es Einschränkungen und Stichtage. In diesem Artikel lesen Sie, was jeder Typ bewirkt, wann ein Vorgang sich verschiebt und wann nur der Puffer sich ändert, was ein harter Pin ist und wie die App einen Konflikt meldet.

Die Regeln und Beispiele gelten für ein neues Projekt, mit dem Berechnungsprofil *Open Planner Studio* und einer Arbeitswoche von Montag bis Freitag.

## Das Konzept

Eine **Einschränkung** ist eine Datumsgrenze für einen einzelnen Vorgang. Sie hängt nicht von dessen Beziehungen ab. Eine solche Grenze kann auf zwei Arten wirken:

- Die Einschränkung **schiebt**: Der Vorgang darf nicht früher beginnen oder enden als das Datum. Würde er wegen seiner Beziehungen früher beginnen, verschiebt er sich auf das Datum.
- Die Einschränkung **bewacht**: Der Vorgang muss spätestens am Datum beginnen oder enden. Die App verschiebt nichts. Erfüllt der Terminplan das Datum nicht, werden der **Puffer** des Vorgangs und der Puffer der Kette davor negativ. Der Puffer ist der Spielraum, bevor sich das Projektende verschiebt. Negativ bedeutet, dass Sie auf dem Papier schon zu spät sind (siehe [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad)).

Ein **Stichtag** ist eine einfachere Form der Bewachung: ein Zieldatum für das Ende eines Vorgangs. Der Vorgang wird dabei von nichts verschoben.

Alle Einschränkungen sind **weich**: Die Berechnung läuft weiter, auch wenn ein Datum nicht erreicht wird. Es gibt eine Ausnahme, den **harten Pin**. Er setzt die Beziehungen außer Kraft. Mehr dazu weiter unten.

## So berechnet die App

### Die acht Typen

Den Typ wählen Sie im Feld *Einschränkung* im Bereich *Eigenschaften*. So berechnet jeder Typ:

- *So früh wie möglich (ASAP)*: keine Grenze. Das ist der Standard: Der Vorgang beginnt, sobald seine Beziehungen es erlauben.
- *So spät wie möglich (ALAP)*: Der Vorgang verschiebt sich so spät wie möglich, ohne dass ein Nachfolger später beginnen muss. Er verbraucht daher seinen freien Puffer. Hat er danach noch Gesamtpuffer, weil seine Nachfolger selbst Spielraum haben, bleibt er unkritisch. Ist auch dieser verbraucht, zählt er als kritisch.
- *Anfang nicht früher als (SNET)*: eine untere Grenze für den Anfang. Würde der Vorgang früher beginnen, verschiebt er sich auf das Datum. Liegt das Datum vor dem, was die Beziehungen erlauben, bewirkt die Einschränkung nichts.
- *Ende nicht früher als (FNET)*: dasselbe, aber für das Ende des Vorgangs.
- *Anfang nicht später als (SNLT)* und *Ende nicht später als (FNLT)*: eine obere Grenze für Anfang oder Ende. Sie verschieben nichts. Wird die Grenze nicht erreicht, meldet die App eine verletzte Einschränkung, und der Puffer wird negativ.
- *Muss anfangen am (MSO)* und *Muss enden am (MFO)*: eine untere und eine obere Grenze zugleich. Der Vorgang verschiebt sich auf das Datum, wenn es später ist, als die Beziehungen verlangen. Liegt das Datum vor dem, was die Beziehungen erlauben, bleibt der Vorgang dort, wohin die Beziehungen ihn setzen, und der Puffer wird negativ.

Fällt ein Datum auf einen Samstag, Sonntag oder arbeitsfreien Tag, liest die App es als Arbeitstag: eine untere Grenze (SNET, FNET) als nächsten Arbeitstag, eine obere Grenze (SNLT, FNLT) als vorherigen.

### Was ein negativer Puffer bedeutet

Eine obere Grenze wirkt rückwärts. Setzt die Einschränkung den späten Termin eines Vorgangs vor seinen frühen Termin, wird der Gesamtpuffer negativ. Das gilt auch für die Vorgänge davor: Muss *Brickwork* spätestens am Freitag, 11. Juni, beginnen, kann es aber erst am Montag, 14. Juni, beginnen, dann sind die Vorgänge vor *Brickwork* ebenfalls einen Arbeitstag zu spät. Alle Vorgänge mit negativem Puffer sind kritisch. Wie das funktioniert, erklärt [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad).

Der Balken verschiebt sich wegen einer oberen Grenze nicht. Sie sehen den Konflikt am negativen *Gesamtpuffer*, an einer roten Raute über dem Balken, in der Meldung in der Statusleiste (zum Beispiel *1 Einschränkung(en) verletzt*) und im Bereich *Warnungen*.

### Der harte Pin

Bei MSO und MFO erscheint das Kontrollkästchen *Verbindlich (Pin-Logik)*. Mit diesem Häkchen fixieren Sie den Vorgang auf dem Datum, auch wenn seine Vorgänger bis dahin nicht fertig sind. Die Beziehungen werden außer Kraft gesetzt:

- Der Vorgang liegt auf dem Datum (bei MSO beginnt er dort, bei MFO endet er dort) und überlappt sich mit seinen Vorgängern.
- Die Vorgänger bekommen einen negativen Puffer. Die App meldet eine verletzte Einschränkung, sobald die Beziehungen zuließen, dass der Vorgang später beginnt als der Pin. Der fixierte Vorgang selbst behält 0 Puffer.
- Die Nachfolger werden ab dem fixierten Vorgang berechnet. Sie können deshalb früher beginnen als ohne Pin, obwohl die Logik davor noch nicht abgeschlossen ist. Im Beispiel unten rückt das Projektende dadurch um drei Arbeitstage vor.

Wenn Sie den Pin zum ersten Mal einschalten, zeigt die App eine kurze Erklärung: Ein harter Pin setzt die Beziehungen außer Kraft, der Balken ist auf dem Datum fixiert, auch vor seinen Vorgängern.

### Die sekundäre Einschränkung

Ein Vorgang hat eine primäre Einschränkung. Wenn Sie zusätzlich eine zweite Grenze wollen, zum Beispiel einen Vorgang, der nicht vor dem 14. Juni beginnen darf und bis zum 17. Juni fertig sein muss, fügen Sie eine **sekundäre Einschränkung** hinzu. Sie muss eine echte Grenze sein (SNET, FNET, SNLT oder FNLT). Außerdem muss sie in die andere Richtung begrenzen als die primäre: eine untere Grenze (SNET oder FNET) mit einer oberen Grenze (SNLT oder FNLT). SNET mit SNLT ist daher erlaubt, SNET mit FNET nicht. Die App markiert andere Kombinationen rot mit dem Grund, zum Beispiel *Primär und sekundär dürfen nicht dieselbe Seite begrenzen.* Bei ASAP, ALAP, MSO, MFO und einem harten Pin ist keine sekundäre Einschränkung erlaubt.

### Der Stichtag

Ein Stichtag ist ein eigenes Datum an einem Vorgang, neben der Einschränkung. Er ist eine obere Grenze für das Ende: Er verschiebt nichts, macht den Puffer aber negativ, wenn der Vorgang nicht rechtzeitig fertig ist. Die App meldet dann im Bereich *Warnungen* *Stichtag … überschritten — frühestes Ende …*, und die Statusleiste zählt die überschrittenen Stichtage. In der Gantt-Ansicht steht ein Pfeil nach unten am Stichtag: grün, solange der Vorgang rechtzeitig fertig ist, rot, sobald er zu spät ist. Ein Stichtag an einem Samstag zählt als der Freitag davor.

Für den Puffer wirkt ein Stichtag wie FNLT. Der Unterschied liegt in der Verwendung. Ein Stichtag ist ein Zieldatum, das Sie bewachen wollen. Er steht getrennt von der Einschränkung, daher kann ein Vorgang sowohl eine Einschränkung als auch einen Stichtag haben. FNLT ist eine Einschränkung: Eine Verletzung erscheint als verletzte Einschränkung statt als überschrittener Stichtag.

### Was eine Einschränkung nicht bewirkt

- Bei einer **Phase** (Sammelvorgang) zählt eine Einschränkung oder ein Stichtag nicht: Die App rechnet mit den Vorgängen in der Phase. Setzen Sie sie auf den Vorgang selbst.
- Ein Vorgang, der bereits einen Ist-Anfang oder Fortschritt hat, behält diesen Anfang. Ein SNET mit einem späteren Datum verschiebt ihn nicht.
- **Ein Anfangsdatum eintragen** bei einem Vorgang mit Vorgänger wirkt nicht als fester Anfang: Der Vorgänger bestimmt weiter. Deshalb macht die App daraus einen SNET auf das eingetragene Datum. Das gilt im Bereich *Eigenschaften*, im Fenster *Vorgang bearbeiten*, in der Tabelle und wenn Sie den Balken in der Gantt-Ansicht verschieben. Die App meldet das. Hat der Vorgang schon eine andere Einschränkung (zum Beispiel ALAP oder MSO), übernimmt die App den neuen Anfang nicht und meldet auch das. Ändern Sie dann diese Einschränkung.

Alle Änderungen sind erst nach **Berechnen** (F5) sichtbar.

## Durchgerechnetes Beispiel

Das Beispiel ist ein kleines Netz für einen Hausanbau. Es beginnt am Montag, 7. Juni 2027:

- *Groundwork* (3 Arbeitstage): Montag 7. bis Mittwoch 9. Juni.
- *Pour foundation* (2): Donnerstag 10. und Freitag 11. Juni.
- *Brickwork* (5): Montag 14. bis Freitag 18. Juni.
- *Roofing* (3): Montag 21. bis Mittwoch 23. Juni.
- *Scaffolding* (2): folgt auf *Pour foundation* und kommt vor *Roofing*. Er läuft am Montag 14. und Dienstag 15. Juni und hat 3 Arbeitstage Puffer.

Der kritische Pfad ist *Groundwork*, *Pour foundation*, *Brickwork* und *Roofing*. Das Projekt ist am Mittwoch, 23. Juni, fertig. Was ändert sich mit einer Einschränkung auf *Brickwork*?

- **SNET Montag 21. Juni** (die Ziegel kommen erst dann an): *Brickwork* läuft von Montag 21. bis Freitag 25. Juni, *Roofing* von Montag 28. bis Mittwoch 30. Juni. Das Projekt ist am Mittwoch 30. Juni fertig. *Groundwork* und *Pour foundation* haben jetzt 5 Arbeitstage Puffer und sind nicht mehr kritisch, *Scaffolding* hat 8.
- **SNET Mittwoch 9. Juni**: ohne Wirkung. Die Beziehungen lassen *Brickwork* ohnehin erst am Montag 14. Juni beginnen.
- **SNLT Mittwoch 16. Juni**: ohne Wirkung. *Brickwork* beginnt am Montag 14. Juni und hält die Grenze deutlich ein.
- **SNLT Freitag 11. Juni**: zu knapp. *Brickwork* beginnt trotzdem am Montag 14. Juni, einen Arbeitstag zu spät. *Groundwork*, *Pour foundation* und *Brickwork* bekommen −1 Arbeitstag Puffer, und die App meldet *Einschränkung Anfang nicht später als (SNLT) 11-06-2027 wird durch die Logik überschritten (negativer Puffer)*. Nichts verschiebt sich.
- **MSO Mittwoch 16. Juni** (ohne harten Pin): *Brickwork* verschiebt sich auf Mittwoch 16. Juni und ist am Dienstag 22. Juni fertig. *Roofing* läuft von Mittwoch 23. bis Freitag 25. Juni, das Projekt ist am Freitag 25. Juni fertig.
- **MSO Freitag 11. Juni** (ohne harten Pin): Das Datum liegt vor dem, was die Beziehungen erlauben. *Brickwork* beginnt trotzdem am Montag 14. Juni, und der Puffer wird −1, genau wie bei SNLT.
- **MSO Mittwoch 9. Juni mit hartem Pin**: *Brickwork* beginnt am Mittwoch 9. Juni und ist am Dienstag 15. Juni fertig, während *Pour foundation* noch bis Freitag 11. Juni läuft. *Roofing* läuft von Mittwoch 16. bis Freitag 18. Juni: Das Projekt ist drei Arbeitstage früher fertig als ohne Pin. *Groundwork* und *Pour foundation* bekommen −3 Arbeitstage Puffer.

Und mit einer Einschränkung oder einem Stichtag bei einem anderen Vorgang:

- **ALAP bei** *Scaffolding*: Der Vorgang verschiebt sich auf Donnerstag 17. und Freitag 18. Juni, den spätesten Zeitpunkt vor *Roofing*. *Roofing* ist sein einziger Nachfolger und hatte genau Platz für die 3 Arbeitstage Puffer von *Scaffolding*. Diese sind jetzt aufgebraucht, und *Scaffolding* ist kritisch.
- **SNET Samstag 19. Juni bei** *Scaffolding*: Die Grenze zählt als Montag 21. Juni. *Scaffolding* läuft am Montag 21. und Dienstag 22. Juni, und *Roofing* verschiebt sich mit auf Mittwoch 23. bis Freitag 25. Juni.
- **Stichtag Freitag 18. Juni bei** *Roofing*: Nichts verschiebt sich, *Roofing* bleibt am Montag 21. bis Mittwoch 23. Juni. *Groundwork*, *Pour foundation*, *Brickwork* und *Roofing* bekommen −3 Arbeitstage Puffer, und die App meldet *Stichtag 18-06-2027 überschritten — frühestes Ende 23-06-2027*. *Scaffolding* behält 0 Arbeitstage Puffer und wird ebenfalls kritisch.
- **SNET Montag 21. Juni bei** *Brickwork*, **Stichtag Freitag 25. Juni bei** *Roofing*: Die Einschränkung schiebt *Brickwork* um eine Woche zurück, und der Stichtag meldet, dass *Roofing* am Mittwoch 30. Juni zu spät ist. *Brickwork* und *Roofing* bekommen −3 Arbeitstage Puffer; *Groundwork* und *Pour foundation* behalten 2 Arbeitstage.

In Tutorial 3 setzen Sie selbst eine Einschränkung und einen Stichtag im Tutorial-Projekt und sehen, wie sich der Terminplan verschiebt.

## Folgen und Missverständnisse

**„Eine Einschränkung verschiebt den Vorgang.“** Nur SNET, FNET, MSO und MFO können einen Vorgang später legen als seine Beziehungen, und ALAP kann ihn innerhalb seines freien Puffers nach hinten schieben. SNLT und FNLT verschieben nie etwas: Sie warnen nur. Das Datum einzuhalten bedeutet dann, die Kette davor zu verkürzen.

**„Ein negativer Puffer ist ein Fehler der App.“** Er ist das Signal, dass der Terminplan im Widerspruch zu Ihrer Datumsvereinbarung steht. Sie lösen das, indem Sie die Kette verkürzen, die Vereinbarung lockern oder den Konflikt bewusst hinnehmen.

**„Ein harter Pin löst den Konflikt.“** Ein harter Pin verdeckt den Konflikt: Der Vorgang liegt auf dem Datum, aber seine Vorgänger sind darauf nicht bereit, und die Nachfolger rechnen, als wären sie es. Verwenden Sie ihn nur für ein Datum, das wirklich fest ist, zum Beispiel ein rechtlich verbindliches Übergabedatum, und nicht als Weg, einen Vorgang auf ein Datum zu zwingen.

**„Ich trage einfach ein Anfangsdatum ein.“** Bei einem Vorgang mit Vorgänger wird das zu einem SNET. Liegt dieses Datum vor dem, was der Vorgänger erlaubt, bewirkt es nichts.

**„Stichtag oder FNLT?“** Wählen Sie einen Stichtag für ein Zieldatum, das Sie bewachen wollen. Wählen Sie eine Einschränkung für ein Datum, das wirklich eine Randbedingung für den Terminplan ist.

**„Eine Einschränkung auf der Phase.“** Das zählt nicht. Setzen Sie sie auf den Vorgang selbst.

## Siehe auch

- [Eine Einschränkung oder einen Stichtag setzen](docs://howto-constraint-deadline-zetten): die Schritte, um eine Einschränkung oder einen Stichtag zu setzen.
- [Beziehungen und Zeitabstand](docs://uitleg-relaties): die Beziehungen, neben denen Einschränkungen stehen.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): wie ein negativer Puffer entsteht und was er für den kritischen Pfad bewirkt.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): ein harter Pin (*Muss anfangen am*) auf *Municipal road closure (permitted closure period)* und eine sekundäre Einschränkung (*Anfang nicht später als (SNLT)*) auf *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): ein Stichtag, der nicht eingehalten wird, mit negativem Puffer.
