# Eine Einschränkung oder einen Stichtag festlegen

Ziel: Eine Terminabsprache für einen Vorgang festhalten, damit der Terminplan sie berücksichtigt oder zeigt, dass Sie den Termin nicht einhalten.

## Wann Sie das brauchen

Die Steine werden erst am 21. Juni geliefert, deshalb darf das Mauerwerk nicht früher beginnen. Dafür setzen Sie eine **Einschränkung** *Anfang nicht früher als (SNET)*. Das Dach muss vor dem Bau-Feiertag geschlossen sein. Sie möchten gewarnt werden, wenn das nicht klappt: Dafür setzen Sie einen **Stichtag**. Die Betonierung steht an einem festen Tag, weil das Betonwerk ihn zugesagt hat: *Muss anfangen am*. Welcher Typ wann passt und was die App damit macht, steht in [Einschränkungen und Stichtage](docs://uitleg-constraints).

## Schritte

Sie legen eine Einschränkung und einen Stichtag im Bereich *Eigenschaften* fest.

1. Wählen Sie den Vorgang aus. Wenn Sie den Bereich *Eigenschaften* nicht sehen, schalten Sie ihn mit *Ansicht › Bereiche › Eigenschaften* ein.
2. Wählen Sie bei *Einschränkung* den Typ, zum Beispiel *Anfang nicht früher als (SNET)*.
3. Bei jedem Typ außer *So früh wie möglich (ASAP)* und *So spät wie möglich (ALAP)* erscheint das Feld *Einschränkungsdatum*. Geben Sie das Datum in die drei Kästchen für Tag, Monat und Jahr ein, zum Beispiel 21, 06 und 2027, und drücken Sie Enter. Die App springt selbst zum nächsten Kästchen, sobald ein Kästchen voll ist. Nachdem Sie den Typ gewählt haben, ist schon ein Datum eingetragen: das der vorherigen Einschränkung oder sonst der ursprünglich geplante Anfang des Vorgangs. Das kann vom Anfang abweichen, den der Bereich zeigt. Geben Sie deshalb immer selbst das Datum ein, das Sie meinen.
4. Wenn Sie den Vorgang auf das Datum festlegen wollen, auch vor seinen Vorgängern, wählen Sie *Muss anfangen am (MSO)* oder *Muss enden am (MFO)* und setzen Sie den Haken bei *Verbindlich (Pin-Logik)*. Das ist ein harter Pin. Verwenden Sie ihn nur für ein Datum, das wirklich feststeht.
5. Wenn Sie auch eine zweite Grenze wollen, zum Beispiel einen Vorgang, der nicht vor dem 14. Juni beginnen darf und bis zum 17. Juni enden muss, wählen Sie bei *Sekundäre Einschränkung* einen Typ und tragen den *Sekundärtermin* ein. Dieses Feld erscheint bei jeder Einschränkung mit einem Datum, außer bei einem harten Pin. Bei MSO und MFO ist eine sekundäre Einschränkung nicht erlaubt: Die App markiert sie dann rot.
6. Für einen Stichtag füllen Sie das Feld *Stichtag* auf dieselbe Weise aus wie das *Einschränkungsdatum*. Ein Stichtag steht getrennt von der Einschränkung: Sie können beides am selben Vorgang festlegen.
7. Klicken Sie auf **Berechnen** (F5), zum Beispiel über *Start › Terminplanung › Berechnen*. Bis dahin zeigt die Statusleiste *Veraltet — neu berechnen (F5)*.

Die Felder finden Sie auch im Fenster *Vorgang bearbeiten*. Sie öffnen es, indem Sie mit der rechten Maustaste auf den Vorgang klicken und *Bearbeiten...* wählen. Sie bestätigen mit *Speichern*.

In der Tabelle arbeiten Sie mit Spalten. Klicken Sie auf das **+** in der Tabellenkopfzeile und wählen Sie unter *Einschränkungen* die Spalten *Einschränkungstyp*, *Einschränkungsdatum* und *Stichtag* (es gibt außerdem *Harte Einschränkung*, *Typ der sekundären Einschränkung* und *Datum der sekundären Einschränkung*). Doppelklicken Sie auf eine Zelle, um sie zu bearbeiten: Sie wählen den Typ aus einer Liste und geben das Datum mit Bindestrichen ein, zum Beispiel 21-06-2027. Die *Harte Einschränkung* lässt sich nur für MSO und MFO ändern.

Wenn der Vorgang einen Vorgänger hat, gibt es eine Abkürzung für *Anfang nicht früher als (SNET)*: Geben Sie einfach einen neuen Anfang im Feld *Anfang* ein (im Bereich *Eigenschaften*, im Fenster *Vorgang bearbeiten* oder in der Tabelle) oder verschieben Sie den Balken im Gantt-Diagramm. Die App macht daraus dann selbst eine Einschränkung *Anfang nicht früher als (SNET)* und sagt Ihnen das.

## Ergebnis prüfen

- Im Gantt-Diagramm steht eine kleine Raute über dem Balken, auf der Anfangsseite bei einer Anfangseinschränkung und auf der Endseite bei einer Endeinschränkung: blau für SNET und FNET, violett für SNLT, FNLT, MSO und MFO, rot wenn die Einschränkung verletzt ist. Ein harter Pin wird mit einem Pin angezeigt. Ein Stichtag wird als Pfeil nach unten am Datum des Stichtags angezeigt: grün, solange der Vorgang rechtzeitig fertig ist, rot wenn er zu spät ist.
- Eine verletzte Einschränkung oder ein verpasster Stichtag erscheint im Bereich *Warnungen* (*Planung › Terminplanung › Warnungen*) und in der Statusleiste. Der *Gesamtpuffer* des Vorgangs und der Vorgänge davor ist dann negativ.
- Bei einer oberen Grenze (*Anfang nicht später als (SNLT)*, *Ende nicht später als*) oder einem Stichtag bedeutet das Fehlen einer Warnung, dass der Terminplan das Datum einhält.

## Einschränkung oder Stichtag entfernen

Wählen Sie bei *Einschränkung* wieder *So früh wie möglich (ASAP)*. Das entfernt auch die sekundäre Einschränkung. Einen Stichtag entfernen Sie, indem Sie die drei Kästchen leeren und Enter drücken. Klicken Sie danach auf **Berechnen**.

## Stolperfallen und was die App macht

**Eine Einschränkung auf einer Phase.** Eine Einschränkung oder ein Stichtag auf einer Phase (Sammelvorgang) hat keine Wirkung. Setzen Sie sie direkt auf den Vorgang.

**Ein Vorgang, der schon begonnen hat.** Hat der Vorgang einen Ist-Anfang oder Fortschritt, behält er seinen Ist-Anfang. Ein *Anfang nicht früher als (SNET)* mit einem späteren Datum verschiebt ihn nicht.

**Ein eingegebener Anfang neben einer anderen Einschränkung.** Hat der Vorgang einen Vorgänger und schon eine andere Einschränkung, zum Beispiel *So spät wie möglich (ALAP)*, wendet die App den eingegebenen Anfang nicht an. Eine Meldung nennt die Einschränkung. Ändern Sie sie, wenn Sie den Anfang verschieben wollen.

**Ein Datum am Wochenende.** Ein Datum an einem Samstag, Sonntag oder arbeitsfreien Tag wird als Arbeitstag behandelt: Eine untere Grenze (*Anfang nicht früher als (SNET)*, *Ende nicht früher als*) gilt für den nächsten Arbeitstag, eine obere Grenze (*Anfang nicht später als (SNLT)*, *Ende nicht später als*) für den vorherigen.

**Eine nicht erlaubte sekundäre Einschränkung.** Die App markiert eine ungültige Kombination rot und nennt den Grund, zum Beispiel *Primär und sekundär dürfen nicht dieselbe Seite begrenzen.* Eine sekundäre Einschränkung ist bei ASAP, ALAP, MSO, MFO und einem harten Pin nicht erlaubt.

**Ein harter Pin.** Beim ersten Einschalten warnt die App, dass ein harter Pin die Beziehungen außer Kraft setzt. Der Vorgang liegt dann auf dem Datum, auch vor seinen Vorgängern. Diese Vorgänger bekommen einen negativen Puffer.

**Nach dem Festlegen hat sich nichts geändert.** Einschränkungen wirken erst nach **Berechnen**. Hat eine obere Grenze (*Anfang nicht später als (SNLT)*, *Ende nicht später als*) keine Wirkung auf die Balken, ist das normal: Eine obere Grenze verschiebt nichts. Sie macht den Puffer negativ, wenn das Datum nicht eingehalten wird.

## Siehe auch

- [Einschränkungen und Stichtage](docs://uitleg-constraints): was jeder Typ bewirkt, sowie die Erklärung von hartem Pin, negativem Puffer und Stichtag.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): was ein negativer Puffer mit dem kritischen Pfad macht.
- [Beziehungen und Zeitabstand](docs://uitleg-relaties): die Beziehungen, neben denen eine Einschränkung steht.
- [Meldungen und Warnungen](docs://ref-meldingen): die Warnungen für eine verletzte Einschränkung oder einen verpassten Stichtag.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): eine Einschränkung aus der Genehmigung *Anfang nicht früher als (SNET)* bei *Demolish existing extension* (14. Mai 2027) und ein Stichtag, der mit Zeitreserve eingehalten wird.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): ein bewusst knapper Stichtag bei *Contractual project handover* (15. Juli 2027). Nach dem Berechnen liegt das Ende am 17. August, und viele Vorgänge haben negativen Puffer.
