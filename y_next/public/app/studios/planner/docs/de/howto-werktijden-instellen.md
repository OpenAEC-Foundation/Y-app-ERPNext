# Arbeitszeiten festlegen

Ziel: Legen Sie pro Wochentag fest, zu welchen Uhrzeiten ein Kalender arbeitet, damit Vorgänge in Stunden zur richtigen Zeit ablaufen.

## Wann Sie das brauchen

Der Freitagnachmittag ist arbeitsfrei. Die Kolonne arbeitet von 06:00 bis 22:00 in zwei Schichten. Es gibt eine Nachtkolonne. Die Pause dauert weniger als eine Stunde. Solange Sie nur in Tagen planen, reichen *Beginn (Stunde)*, *Ende (Stunde)* und die Pause aus ([Kalender erstellen und zuweisen](docs://howto-kalender-maken-en-toewijzen)). Wenn Sie Vorgänge in Stunden planen, zählt die App die Arbeitsminuten innerhalb der **Bänder** des Kalenders. Im Programm heißen sie *Bänder*: Ein Band ist ein durchgehender Abschnitt Arbeitszeit an einem Wochentag, und eine Lücke zwischen zwei Bändern ist eine Pause. Was das für Ihren Terminplan bedeutet, steht in [Tage und Stunden](docs://uitleg-dagen-en-uren).

Dafür brauchen Sie *Stundenplanung aktivieren* ([Stundenplanung einschalten](docs://howto-urenplanning-aanzetten)). Ohne Stundenplanung sehen Sie den Block *Arbeitszeiten* nicht.

## Schritte

### Eine Schichtvoreinstellung wählen

1. Wählen Sie *Planung › Kalender › Kalender* und wählen Sie den Kalender links aus.
2. Klicken Sie im Block *Arbeitszeiten* auf eine Voreinstellung. Sie ersetzt die Arbeitstage und Arbeitszeiten des Kalenders.
3. Klicken Sie auf *Anwenden*.

Jede Voreinstellung macht Folgendes:

- *Tagschicht*: Montag bis Freitag von 08:00 bis 16:00 ohne Pause. Damit wird der Kalender wieder zu einem normalen Kalender, ohne Bänder.
- *2 Schichten*: Montag bis Freitag von 06:00 bis 14:00 und von 14:00 bis 22:00, insgesamt 16 Stunden.
- *3 Schichten*: Montag bis Freitag drei Schichten, von 06:00 bis 14:00, von 14:00 bis 22:00 und von 22:00 bis 06:00 am nächsten Tag, insgesamt 24 Stunden.
- *Nachtschicht*: Montag bis Freitag von 22:00 bis 06:00 am nächsten Tag, 8 Stunden.
- *24/7*: alle sieben Tage von 00:00 bis 24:00.

### Arbeitszeiten pro Wochentag festlegen

1. Klicken Sie im Block *Arbeitszeiten* auf *Pro Wochentag festlegen…*. Unter den Schaltflächen erscheint pro Wochentag eine Zeile mit der Arbeitszeit dieses Tages. Der Kalender hat dann pro Wochentag Bänder. Hat der Kalender sie schon, ist diese Übersicht sofort geöffnet. Die Schaltfläche heißt dann *Arbeitszeiten ausblenden* und klappt sie wieder zu.
2. Passen Sie in den beiden Zeitfeldern Beginn und Ende jedes Bandes an.
3. Wenn Sie eine Pause einbauen möchten, klicken Sie für diesen Tag auf **+** (*Band hinzufügen*) und passen Sie die Zeiten der Bänder so an, dass zwischen ihnen eine Lücke liegt. Ein neues Band beginnt um 08:00 und endet um 16:00.
4. Ein Band, das über Mitternacht läuft, aktivieren Sie mit *nächster Tag*. Das Band zählt für den Tag, an dem es beginnt.
5. Klicken Sie auf den Papierkorb hinter einem Band, um es zu entfernen. Ein Tag ohne Bänder zeigt *Arbeitsfrei* an.
6. Klicken Sie bei einem Tag von Montag bis Freitag auf das Kopiersymbol (*Auf alle Arbeitstage kopieren*), um die Bänder dieses Tages auf Montag bis Freitag zu übertragen.
7. Unten steht *Abgeleitete Stunden/Tag:* mit den Nettostunden pro Tag, die die App daraus ableitet. Klicken Sie auf *Anwenden*.

**Beispiel: ein freier Freitagnachmittag.** Klicken Sie auf *Pro Wochentag festlegen…*. Entfernen Sie das zweite Band (13:00 bis 16:00) für *Fr*. Der Freitag hat jetzt 5 Stunden, die anderen Tage 8. Die abgeleiteten Stunden pro Tag bleiben 8.

### Eine eigene Voreinstellung speichern

1. Klicken Sie auf *Als Voreinstellung speichern…* und geben Sie im Feld *Name der Voreinstellung* einen Namen ein.
2. Klicken Sie auf *Speichern*. Die Voreinstellung erscheint jetzt unter den anderen Voreinstellungen, und Sie können sie in jedem Projekt verwenden. Mit dem Kreuz daneben entfernen Sie sie wieder.

Eine eigene Voreinstellung wird auf diesem Gerät gespeichert, nicht in der Projektdatei.

## Fallstricke und was die App dann tut

**Eine Voreinstellung ersetzt alles.** Wenn Sie eine Voreinstellung wählen, verschwinden die Arbeitstage und Arbeitszeiten, die Sie vorher festgelegt haben. Die Feiertage bleiben erhalten.

**Tagesschaltflächen und Bänder sind zwei Dinge.** Die Schaltflächen unter *Arbeitstage* ändern die Bänder nicht. Ein Tag bekommt Arbeitszeit, indem Sie für diesen Tag auf *Band hinzufügen* klicken. Wenn Sie einen Tag nur mit der Schaltfläche einschalten, zählt er für Vorgänge in Tagen, aber nicht für Vorgänge in Stunden. Bei einem Kalender mit Arbeitszeiten verwenden Sie die Zeilen pro Wochentag.

**Arbeitszeiten anpassen bei ausgeschalteter Stundenplanung.** Wenn Sie die Stundenplanung wieder ausschalten, erscheinen die Felder *Beginn (Stunde)*, *Ende (Stunde)* und die Pause wieder. Bei einem Kalender mit Bändern ändern diese Felder die Bänder nicht. Passen Sie die Arbeitszeiten deshalb immer an, während die Stundenplanung eingeschaltet ist.

**Keine brauchbaren Arbeitszeiten.** Ein Kalender ohne Bänder oder ohne Arbeitstage kann einen Vorgang nicht in Stunden planen. Die App meldet dann *Dieser Kalender hat keine gültigen Arbeitszeiten. Prüfen Sie Arbeitstage und Arbeitszeiten.*

## Siehe auch

- [Tage und Stunden](docs://uitleg-dagen-en-uren): wie die App Arbeitszeiten zählt und die Nettostunden pro Tag ableitet.
- [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten): einen Vorgang in Stunden planen.
- [Kalender und Arbeitstage](docs://uitleg-kalenders): welcher Kalender für welchen Vorgang gilt.
- [Kalenderfenster](docs://ref-kalenders): alle Felder der Kalenderfenster.
