# Die Ressourcenbibliothek

Ihre Maurerkolonne arbeitet nicht nur für ein Projekt. Heute arbeitet sie an den Häusern im Norden, morgen an den Garagen im Süden. Eine Ressourcenbibliothek ist der Ort, an dem Sie so eine Kolonne einmal erfassen. Dann nutzt jedes Projekt dieselbe Kolonne. Die App kann außerdem erkennen, wann zwei Projekte am selben Tag dieselben Personen anfordern. Ein einzelnes Projekt kann das nicht sehen. In diesem Artikel lesen Sie, wie Bibliothek und Projekt zusammenhängen und wie die App die Belegung über Projekte hinweg zählt.

## Das Konzept

Es gibt zwei Ebenen.

Die **Ressourcenbibliothek** ist die Liste der Ressourcen und Kalender, die zu Ihrer Organisation gehören: ein Maurer, ein Kran, ein Verputzer, mit ihrem Typ, Tarif und ihrer Anzahl. Die Liste selbst, die die App auch den **Pool** nennt, steht nicht in Ihren Projektdateien, sondern in der App. In der Desktop-App liegt sie in einer Datei auf diesem Computer. Im Browser liegt sie im Speicher dieses Browsers. Löschen Sie die Website-Daten im Browser, dann ist die Bibliothek weg. Exportieren Sie sie daher als Sicherung. Es gibt immer mindestens eine Bibliothek. Die erste heißt *Mijn resourcebibliotheek* (ein niederländischer Name). Sie können sie umbenennen.

Das **Projekt** bestimmt, wie viel einer Ressource es nutzt und wann. Ein Projekt ist mit einer Bibliothek verknüpft oder steht allein. Ein allein stehendes Projekt funktioniert gut, nur ohne gemeinsame Liste.

Ein Projekt verweist nicht auf die Bibliothek, sondern behält eine **Kopie**. Wenn Sie *Bricklayer* aus der Bibliothek einem Projekt zuweisen, erstellt die App im Projekt eine Kopie mit einem **Herkunftsvermerk**. Dieser Vermerk sagt, dass die Kopie aus Bibliothek X stammt und dort Element Y ist. In der Ressourcentabelle erkennen Sie so eine Kopie an einem kleinen Bibliothekssymbol. Die Kopie ist eine normale Ressource. Der Kopie können Vorgänge zugewiesen werden, und sie wird in der Projektdatei selbst gespeichert.

Die Kalender in der Ressourcenbibliothek sind etwas anderes als die Kalenderliste Ihres Projekts, die Sie im Kalenderdialog verwalten. Ein Bibliothekskalender kommt zusammen mit einer Ressource, die ihn nutzt, in Ihr Projekt.

## So arbeitet die App damit

### Was die Bibliothek und was das Projekt bestimmt

Die Bibliothek bestimmt, **was eine Ressource ist**: den Namen, den Typ, den Tarif pro Stunde, die Einheit und die Beschreibung. In einer Projektkopie erscheinen diese Felder als reiner Text. Sie ändern sie in der Bibliothek, damit sie in jedem Projekt stimmen. Wenn eine Kopie doch einen eigenen Weg gehen soll, heben Sie die Verknüpfung mit der Bibliothek auf.

Das Projekt bestimmt **wie viel und wann**: *Max. Einheiten*, die Kapazität, die sich über die Zeit ändert (*Zeitlich gestaffelte Kapazität*), und welchen Kalender die Ressource hat. Diese Felder bleiben im Projekt bearbeitbar und gelten nicht als Abweichung von der Bibliothek. Denn dieselbe Kolonne kann bei einem Eilauftrag einen anderen Kalender haben als bei einem regulären Projekt. Der Inhalt eines Kalenders, der mit einer Ressource mitkam, folgt dagegen der Bibliothek.

### Wann eine Kopie mitzieht

Die Bibliothek aktualisiert die Kopien nicht ständig, sondern zu festen Zeitpunkten:

- Wenn Sie in der Bibliothek etwas ändern, ziehen die unbearbeiteten Kopien in allen offenen Projekten sofort mit.
- Wenn Sie ein Projekt öffnen oder zu einer anderen Registerkarte wechseln, vergleicht die App die Kopien mit der Bibliothek. Liegt eine unbearbeitete Kopie zurück, aktualisiert die App sie still und meldet das kurz: *1 Element aus der Bibliothek aktualisiert* oder *N Elemente aus der Bibliothek aktualisiert*.

Die App merkt sich die Werte aus dem Moment, in dem die Kopie entstand oder aktualisiert wurde. Weicht eine Kopie jetzt davon ab, entscheidet die App nicht, wer recht hat. Die Kopie erhält dann die Markierung *weicht ab — entscheiden*. Wenn Sie eine Datei mit einer solchen Kopie öffnen, öffnet sich das Fenster *Ressourcenbibliothek verknüpfen* von selbst. Dort wählen Sie pro Element, ob die Werte der Bibliothek gelten oder ob die Werte aus Ihrer Datei in die Bibliothek übernommen werden. Beim Wechseln der Registerkarte erscheint nie ein Fenster.

Eine Abweichung entsteht zum Beispiel, wenn Sie mit *Zur Bibliothek* eine eigene Ressource im Projekt mit einem Bibliothekselement gleichen Namens, aber anderen Werten verknüpfen. Die App verknüpft beide, und sie markiert die Kopie sofort als abweichend.

### Wann eine Ressource aus der Bibliothek verschwindet

Wenn Sie eine Ressource aus der Bibliothek löschen, bleibt die Kopie in Ihren Projekten erhalten und funktioniert weiter. Sie erhält die Markierung *nicht mehr in der Bibliothek*. Danach können Sie sie vollständig bearbeiten oder aus dem Projekt entfernen.

### Belegung über Projekte hinweg

Das Histogramm und die Überlastung in einem Projekt betrachten nur dieses eine Projekt. Die Bibliothek weiß mehr: wie viele Exemplare einer Ressource es insgesamt gibt. Die Ansicht *Belegung* addiert pro Tag die Last aller offenen Projekte, die mit derselben Bibliothek verknüpft sind und eine Kopie dieser Ressource nutzen. Ist die Summe an einem Tag größer als die Kapazität der Bibliothek, gilt dieser Tag als überlastet.

Drei Regeln bestimmen, was zählt:

- Die Kapazität kommt aus der Bibliothek (*Max. Einheiten* des Bibliothekselements oder seine *Zeitlich gestaffelte Kapazität* an diesem Tag), nicht aus den *Max. Einheiten* der Projektkopie. Zwei Projekte, die jeweils innerhalb ihrer eigenen Zuteilung bleiben, können daher zusammen trotzdem zu viel anfordern.
- Eine Summe, die genau der Kapazität entspricht, ist kein Konflikt. Es muss mehr als die Kapazität angefordert werden.
- Nur Kopien mit einem Herkunftsvermerk zählen, und nur in Projekten, die in diesem Moment in dieser App geöffnet sind. Eine eigene Ressource eines einzelnen Projekts ist nicht in der Bibliothek und zählt deshalb nicht. Die Übersicht sieht keine Dokumente, die nicht in dieser App geöffnet sind. Das steht auch unten in der Übersicht selbst.

## Rechenbeispiel: die Maurerkolonne in zwei Projekten

Die Bibliothek enthält die Ressource *Bricklayer* mit *Max. Einheiten* 3: drei Maurer auf der Lohnliste. Zwei Projekte nutzen sie, beide mit einer Kopie, die *Max. Einheiten* 2 hat.

- *Houses North* hat den Vorgang *Bricklaying facades* mit 5 Arbeitstagen ab Montag, 7. Juni 2027, mit 2 Einheiten pro Tag. Der Vorgang läuft vom 7. bis einschließlich 11. Juni.
- *Garages South* hat den Vorgang *Bricklaying garages* mit 4 Arbeitstagen ab Mittwoch, 9. Juni 2027, mit 2 Einheiten pro Tag. Das Wochenende zählt nicht. Daher umfasst der Vorgang den 9., 10., 11. und 14. Juni.

In jedem Projekt wird der Maurer für 2 seiner 2 Einheiten angefordert. Keines der beiden Projekte meldet eine Überlastung: Unter *Ressourcen › Überlastung* steht bei beiden *Keine*. Zusammen übersteigen sie jedoch die 3 Maurer. Die App zählt pro Tag:

- Montag, 7. und Dienstag, 8. Juni: 2 (nur Houses North)
- Mittwoch, 9., Donnerstag, 10. und Freitag, 11. Juni: 2 + 2 = 4
- Montag, 14. Juni: 2 (nur Garages South)

Die Spitze liegt bei 4, bei einer Kapazität von 3. Die Übersicht zeigt den Maurer mit *2 Dokumenten*, den Zeitraum *2027-06-07 – 2027-06-14*, *4.0 / 3.0* für Spitze und Kapazität und *3 Tage doppelt belegt*: 9., 10. und 11. Juni.

Was passiert, wenn Sie etwas ändern:

- Wenn *Bricklaying facades* 6 Arbeitstage dauert, läuft der Vorgang bis Montag, 14. Juni. Auch dieser Tag erreicht 2 + 2 = 4. Daher meldet die Übersicht *4 Tage doppelt belegt*: 9., 10., 11. und 14. Juni. Die Spitze bleibt bei 4.
- Hat die Bibliothek *Max. Einheiten* 4, steht dort *4.0 / 4.0*. Es gibt dann keinen Konflikt, weil die Summe nicht größer ist als die Kapazität.
- Arbeitet *Garages South* mit 1 Einheit pro Tag statt mit 2, liegt die Spitze bei 3. Dann steht dort *3.0 / 3.0*: kein Konflikt.
- Beginnt *Garages South* erst am Montag, 14. Juni, überschneiden sich die Projekte nicht. Der Zeitraum wird *2027-06-07 – 2027-06-17*, und die Spitze liegt bei *2.0 / 3.0*.

Die Schritte, um das in Ihren eigenen Projekten zu prüfen, stehen unter [Die Belegungsübersicht verwenden](docs://howto-bezettingsoverzicht-gebruiken).

## Folgen und Missverständnisse

**„Die Bibliothek wird mit meinen Kollegen geteilt.“** Nein. Die Bibliothek liegt in der App (in der Desktop-App in einer Datei auf diesem Computer, im Browser im Speicher dieses Browsers) und wird nicht synchronisiert. Arbeiten zwei Planer mit derselben Ressourcenbibliothek, können ihre Bibliotheken auseinanderlaufen. Sie können eine Bibliothek teilen, indem Sie sie exportieren und importieren. Siehe [Ressourcenbibliotheken verwalten und teilen](docs://howto-bibliotheken-beheren). Teilt Ihre Organisation Kolonnen über Betriebsgesellschaften hinweg, wählen Sie bewusst eine gemeinsame Bibliothek. Die Übersicht sieht außerdem nur die Projekte, die in dieser App geöffnet sind.

**„Wenn ich die Bibliothek ändere, ändert sich alles in meinen Projekten.“** Nur die Identität der Ressource ändert sich: Name, Typ, Tarif, Einheit und Beschreibung. *Max. Einheiten*, die Kapazität über die Zeit und die Kalenderwahl eines Projekts bleiben, wie sie sind.

**„Ich kann eine Änderung an der Bibliothek rückgängig machen.“** Nein. Die Bibliothek gehört zur App und nicht zu einem Projekt. Daher liegen Änderungen daran außerhalb von *Rückgängig* (Strg+Z). Die Ansicht *Bibliothek* warnt selbst davor: *Dies bearbeitet die Bibliothek und gilt für alle Projekte — außerhalb von Rückgängig.* Beim Löschen aus der Bibliothek fragt die App außerdem nach einer Bestätigung. Das lässt sich nicht rückgängig machen.

**„Die Belegungsübersicht löst die Doppelbelegung auf.“** Nein. Die Übersicht ist nur ein schreibgeschütztes Fenster. Sie zeigt, an welchen Tagen zwei Projekte zusammen zu viel anfordern. Der Kapazitätsabgleich (*Ressourcen › Kapazitätsabgleich › Abgleichen…*, siehe [Kapazitätsabgleich](docs://uitleg-nivelleren)) betrachtet die Ressourcen eines Projekts und berücksichtigt die anderen Projekte nicht. Verschieben Sie einen Vorgang in einem der Projekte selbst. Oder ändern Sie die Kapazität in der Bibliothek, wenn tatsächlich jemand dazukommt.

**„Meine eigene Ressource zählt in der Belegung.“** Nur wenn sie in der Bibliothek liegt. Eine Ressource, die Sie nur im Projekt angelegt haben, etwa ein gemieteter Kran für einen einzelnen Auftrag, hat keinen Herkunftsvermerk. Sie steht daher nicht in der Übersicht. Mit *Zur Bibliothek* fügen Sie sie hinzu.

## Siehe auch

- [Die Ressourcenbibliothek verwenden](docs://howto-resourcebibliotheek-gebruiken): verknüpfen, Ressourcen zuweisen und Abweichungen auflösen.
- [Ressourcenbibliotheken verwalten und teilen](docs://howto-bibliotheken-beheren): Bibliotheken anlegen, exportieren und importieren.
- [Die Belegungsübersicht verwenden](docs://howto-bezettingsoverzicht-gebruiken): Doppelbelegungen über Projekte hinweg finden.
- [Ressourcen verwalten](docs://howto-resources-beheren): die Ressourcen eines einzelnen Projekts.
