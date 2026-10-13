# Einen Hammock anlegen

Ziel: Einen Vorgang anlegen, der seine Dauer nicht selbst kennt, sondern vom Start eines Vorgangs bis zum Ende eines anderen läuft, zum Beispiel Baustelleneinrichtung, Bauüberwachung oder die Miete eines Baucontainers.

## Wann Sie das brauchen

Der Baucontainer steht dort so lange, wie das Gebäude entsteht, von den ersten Erdarbeiten bis zur Übergabe. Wenn Sie diesem Vorgang eine feste Dauer von 13 Arbeitstagen geben, läuft er nicht mit, wenn sich das Mauerwerk verzögert. Dann ist der Terminplan nicht mehr richtig. Ein **Hammock** (auch *Level of Effort* genannt) folgt dem Vorgang, an den Sie ihn hängen: Sein Start ergibt sich aus einer Start-Beziehung, sein Ende aus einer Ende-Beziehung, und seine Dauer ist der Unterschied zwischen beiden.

## Schritte

1. Legen Sie den Vorgang an, zum Beispiel *Site cabin*, oder wählen Sie einen bestehenden Vorgang aus. Ein Meilenstein und ein Sammelvorgang (Phase) können kein Hammock sein. Im Bereich *Eigenschaften* und im Fenster *Vorgang bearbeiten* fehlt bei einem solchen Vorgang das Kontrollkästchen. In der Spalte lässt es sich nicht ändern.
2. Aktivieren Sie das Kontrollkästchen bei *Hammock (abgeleitete Dauer)* im Bereich *Eigenschaften*, im Fenster *Vorgang bearbeiten* (klicken Sie mit der rechten Maustaste auf den Vorgang und wählen Sie *Bearbeiten...*) oder in der Spalte *Hammock (abgeleitete Dauer)* unter *Planung*. Das Feld *Dauer* lässt sich danach nicht mehr bearbeiten.
3. Fügen Sie eine Beziehung vom Vorgang, mit dem der Hammock beginnt, zum Hammock hinzu, vom Typ **SS** (der Hammock beginnt zusammen mit diesem Vorgang) oder **FS** (der Hammock beginnt nach diesem Vorgang). Wählen Sie dazu den Hammock aus, klicken Sie auf *Beziehung hinzufügen* unter *Abhängigkeiten*, lassen Sie die Richtung auf *Vorgänger* stehen, wählen Sie den Vorgang und wählen Sie den Typ. Die Schritte finden Sie unter [Beziehungen hinzufügen](docs://howto-relaties-leggen).
4. Fügen Sie eine Beziehung vom Vorgang, mit dem der Hammock endet, zum Hammock hinzu, vom Typ **FF** (der Hammock endet zusammen mit diesem Vorgang) oder **SF**.
5. Sehen Sie im Bereich *Eigenschaften* unter *Hammock (abgeleitete Dauer)* nach. Dort sehen Sie den *Start-Treiber* mit dem Vorgang und dem Typ, und den *Ende-Treiber* mit dem Vorgang und dem Typ. Ein Treiber ist ein Vorgang, von dem der Hammock seinen Start oder sein Ende übernimmt.
6. Drücken Sie *Berechnen* (F5), zum Beispiel über *Start › Terminplanung › Berechnen*. Der Hammock läuft nun vom Start des Start-Treibers bis zum Ende des Ende-Treibers, und *Dauer* zeigt die abgeleitete Dauer.

Im Gantt-Diagramm ist ein Hammock ein dünner türkisfarbener Balken mit einem Haken an beiden Enden.

Beispiel: *Site cabin* bekommt SS von *Groundwork* (Montag, 7. Juni 2027) und FF von *Roofing* (erledigt am Mittwoch, 23. Juni). Nach *Berechnen* läuft der Hammock von Montag, 7. Juni bis Mittwoch, 23. Juni: 13 Arbeitstage. Wenn sich das Mauerwerk um 2 Arbeitstage verzögert, wird das Ende von *Roofing* Freitag, 25. Juni, und der Hammock wächst mit auf 15 Arbeitstage.

## Was die App mit einem Hammock macht

- Der Hammock ist nie kritisch und hat keinen Puffer. Er schränkt auch die Vorgänge nicht ein, von denen er Start und Ende übernimmt: Für sie gibt es durch den Hammock keine späten Termine.
- Ein Zeitabstand zählt mit. Bei SS und Zeitabstand `1d` beginnt der Hammock einen Arbeitstag nach dem Start-Treiber, bei FF und Zeitabstand `2d` endet er zwei Arbeitstage nach dem Ende-Treiber.

## Fallstricke und was die App tut

**Kein Ende-Treiber.** Wenn der Hammock keine Beziehung FF oder SF hat, kann die App sein Ende nicht ableiten. Der Bereich *Eigenschaften* zeigt *Kein Ende-Treiber (FF/SF) — die Spanne fällt auf Länge null zurück.* und der Bereich *Warnungen* zeigt *Hammock ohne Ende-Treiber (kein FF/SF-Vorgänger): die Dauer fällt auf null zurück*. Der Hammock beginnt und endet dann am selben Tag. Fügen Sie eine Beziehung FF oder SF hinzu.

**Ein Hammock, der nach dem letzten Vorgang endet.** Wenn der Hammock bis nach dem letzten Vorgang weiterläuft, zum Beispiel mit FF und einem Zeitabstand von 2 Arbeitstagen, verschiebt sich das Enddatum des Projekts mit. Die Vorgänge, die Sie tatsächlich ausführen, erhalten dann Puffer; keiner davon ist mehr kritisch.

**Vorgänge, die auf einen Hammock warten.** Wenn Sie eine Beziehung vom Hammock zu einem anderen Vorgang hinzufügen, beginnt dieser Vorgang erst nach dem Ende des Hammocks. Die ganze Kette vor dem Hammock, einschließlich der Vorgänge, von denen der Hammock Start und Ende übernimmt, erhält dann Puffer und ist nicht mehr kritisch, weil der Hammock keinen Druck zurückgibt. Lassen Sie Vorgänge deshalb nicht auf einen Hammock warten. Hängen Sie solche Vorgänge lieber an den Ende-Treiber des Hammocks.

**Eine Dauer eingeben.** Das Feld *Dauer* eines Hammocks wird abgeleitet und lässt sich nicht bearbeiten. Eine Dauer, die Sie vor dem Aktivieren des Kontrollkästchens eingegeben haben, zählt nicht mehr.

## Siehe auch

- [Beziehungen hinzufügen](docs://howto-relaties-leggen): die Schritte, um eine Beziehung vom Typ SS oder FF hinzuzufügen.
- [Beziehungen und Zeitabstand](docs://uitleg-relaties): was SS und FF bedeuten und wie der Zeitabstand mitzählt.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): was kritisch bedeutet und wie der Puffer funktioniert.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): enthält den Hammock *Structural works tower A (LOE)*.
