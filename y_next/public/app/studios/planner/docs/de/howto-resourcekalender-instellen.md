# Einen Ressourcenkalender einrichten

Ziel: festhalten, an welchen Tagen eine Ressource verfügbar ist. So rechnen das Histogramm, die Überlastung und der Kapazitätsabgleich damit.

## Wann Sie das brauchen

Die Maurerkolonne arbeitet nur von Montag bis Donnerstag. Der Kran ist in den ersten zwei Wochen im August auf einem anderen Projekt. Ein Subunternehmer hat vier feste Arbeitstage. Ohne einen eigenen Kalender geht die App davon aus, dass die Ressource an den Tagen des Projektkalenders arbeitet.

Ein Ressourcenkalender ändert kein einziges Vorgangsdatum. Er bestimmt nur, wann die Ressource verfügbar ist. Wenn ein Vorgang an einem Tag arbeitet, an dem die Ressource nicht arbeitet, ist die Kapazität an diesem Tag 0 und der Tag gilt als überlastet. Wenn der Vorgang selbst an anderen Tagen laufen soll, geben Sie dem Vorgang einen eigenen Kalender ([Kalender erstellen und zuweisen](docs://howto-kalender-maken-en-toewijzen)). Den Unterschied erklärt [Kalender und Arbeitstage](docs://uitleg-kalenders).

## Schritte

### Einen neuen Ressourcenkalender erstellen

1. Wählen Sie *Ressourcen › Verwalten › Ressourcen*. Das Ressourcen-Panel öffnet sich. Gibt es die Ressource noch nicht, erstellen Sie sie mit *Neue Ressource im Projekt*.
2. Suchen Sie die Zeile der Ressource. In der Spalte *Kalender* ist *Projektkalender* der Standard: Die Ressource folgt dann dem Projektkalender.
3. Wählen Sie in dieser Liste *+ Ressourcenkalender*. Das Fenster *Ressourcenkalender* öffnet sich. Es hat dieselben Felder wie das Kalenderformular: *Name*, *Arbeitstage*, die Arbeitszeiten und die *Feiertage*. Der neue Kalender beginnt als Kopie des Standardkalenders und heißt *Ressourcenkalender*.
4. Geben Sie dem Kalender einen Namen, der zur Ressource passt, zum Beispiel *Crew Mon–Thu*. Legen Sie die Arbeitstage fest: Klicken Sie unter *Arbeitstage* den Freitag ab. Feiertage oder Ausfallzeiten tragen Sie in der Liste *Feiertage* mit *Feiertag hinzufügen* ein.
5. Klicken Sie auf *Anwenden*. Der Kalender ist jetzt in der Ressourcenbibliothek des Projekts und mit der Ressource verbunden, in einem Schritt, den Sie mit *Rückgängig* zurücknehmen. Mit *Abbrechen* wird nichts erstellt.

### Einen vorhandenen Kalender wählen oder anpassen

Wählen Sie in der Spalte *Kalender* einen Kalender aus der Liste. *Projektkalender* entfernt den eigenen Kalender wieder. Wenn Sie den gewählten Kalender anpassen wollen, klicken Sie neben der Liste auf den Stift (*Bearbeiten…*). Das Fenster *Ressourcenkalender* öffnet sich mit dem aktuellen Kalender.

### Das Ergebnis prüfen

1. Wenn die Statusleiste *Veraltet — neu berechnen (F5)* anzeigt, drücken Sie **Berechnen** (F5).
2. Wählen Sie *Ressourcen › Histogramm › Histogramm* und klicken Sie links neben dem Histogramm auf die Ressource in der Liste. Die Tage, an denen die Ressource nicht arbeitet, aber eingeplant ist, sind rot. Wenn Sie mit der Maus über einen dieser Tage zeigen, meldet der Balken zum Beispiel: *Arbeitet an diesem Tag laut Kalender „Crew Mon–Thu“ nicht*.
3. Unter *Ressourcen › Überlastung* steht, wie viele Ressourcen überlastet sind. Die Statusleiste meldet zum Beispiel *1 Ressource(n) überlastet*.

## Fallstricke und was die App dann macht

**Nur die Tage zählen, nicht die Stunden.** Ein Ressourcenkalender bestimmt, an welchen Tagen die Ressource arbeitet. Wie viele Einheiten an diesem Tag verfügbar sind, folgt aus den *Max. Einheiten* der Ressource, nicht aus den Arbeitszeiten im Kalender.

**Der Kapazitätsabgleich löst das nicht immer.** Gibt es kein Zeitfenster, in dem jeder Tag des Vorgangs ein Arbeitstag der Ressource ist, hilft Verschieben nicht. Wählen Sie *Ressourcen › Kapazitätsabgleich › Abgleichen…* und klicken Sie auf *Berechnen*. Der Vorgang steht dann unter *Verbleibende Konflikte*, mit dem Grund *Die Ressource arbeitet nicht an allen Tagen, die dieser Vorgang benötigt — Verschieben löst dies nicht.* Weisen Sie den Vorgang dann einer anderen Ressource zu oder geben Sie ihm einen eigenen Kalender.

**Ein gemeinsamer Kalender.** Die Liste zeigt alle Kalender des Projekts, also auch den Projektkalender und die Kalender der Vorgänge. Wenn Sie einen solchen Kalender mit dem Stift anpassen, ändert sich auch der Terminplan der Vorgänge, die ihn verwenden. Außerdem meldet die Statusleiste *Veraltet — neu berechnen (F5)*. Erstellen Sie besser einen eigenen Kalender für die Ressource.

**Überlastung hat nicht immer mit dem Kalender zu tun.** Auch eine Ressource, die jeden Tag arbeitet, kann überlastet sein. Die Quickinfo erwähnt den Kalender nur, wenn der Tag kein Arbeitstag der Ressource ist.

## Siehe auch

- [Kalender und Arbeitstage](docs://uitleg-kalenders): warum ein Ressourcenkalender keine Vorgangsdaten verschiebt.
- [Kalender erstellen und zuweisen](docs://howto-kalender-maken-en-toewijzen): die Felder des Kalenderformulars.
- [Feiertage erzeugen und die Bauferien](docs://howto-feestdagen-genereren): Feiertage und Ausfallzeiten in den Kalender eintragen.
- [Kalenderfenster](docs://ref-kalenders): alle Felder der Kalenderfenster.
