# Eine MS-Project-Datei (.mpp) öffnen

Ziel: Einen Terminplan aus Microsoft Project direkt in der App öffnen, ohne ihn vorher zu exportieren.

## Wann Sie das brauchen

Ein Auftragnehmer, Berater oder Kunde schickt Ihnen seinen Terminplan als `.mpp`-Datei. Sie möchten ihn ansehen, berechnen oder weiterentwickeln. Die App liest `.mpp`-Dateien von MS Project 2010 bis einschließlich 2021. Die App liest nur. Sie schreibt keine `.mpp`-Dateien und ändert Ihre Datei nie. Aus der Datei übernimmt sie den Terminplan selbst: Vorgänge mit Struktur, Dauer und Einschränkungen, Beziehungen mit Zeitabstand, Kalender, Ressourcen, Zuweisungen und Fortschritt. Sie liest auch die Termine und den Puffer, die MS Project selbst berechnet hat. Die App verwendet diese aber nur für die Ansicht *Termine wie aufgezeichnet*, nie als Eingabe.

## Schritte

1. Wählen Sie *Start › Datei › Öffnen* oder drücken Sie Strg+O. Wählen Sie die `.mpp`-Datei.
2. Das Projekt öffnet sich in einer neuen Registerkarte oder in der aktuellen Registerkarte, wenn diese noch leer und unverändert war. Das Projekt hat keine Datei. *Speichern* schreibt später eine neue IFC-Datei.
3. Lesen Sie die Meldung unten: *Dieses Projekt rechnet als Microsoft Project. Ändern über Datei → Projektinfo → Berechnungsprofil und Berechnungsoptionen*. Die App berechnet dieses Projekt mit den Berechnungsregeln von MS Project: dem Berechnungsprofil *Microsoft Project*. Mit *Berechnungsprofil öffnen* gehen Sie zur Einstellung. *Mehr erfahren* öffnet die Hilfe über Berechnungsprofile.
4. Prüfen Sie, ob unter dem Menüband eine Meldungsleiste steht: *Sie sehen die Termine so, wie sie in der Datei aufgezeichnet sind; eine Neuberechnung würde 4 Vorgänge verschieben*. Dann weicht das Ergebnis der App bei diesen Vorgängen von den Terminen ab, die MS Project gespeichert hat. Unter der Meldung aus Schritt 3 steht dann auch eine Zeile: *4 Vorgänge zeigen die in der Datei gespeicherten Termine (nicht neu berechnet)*. Was das bedeutet und wie Sie zur eigenen Berechnung der App wechseln, steht unter [Termine wie aufgezeichnet](docs://uitleg-datums-zoals-opgeslagen).
5. Wenn dort *Diese Datei enthält stundenbasierte Planung* mit der Schaltfläche *Stundenplanung aktivieren* steht, enthält die Datei Daten in Stunden. Siehe [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten).

Wenn die Datei Vorgänge mit unterbrochener, geglätteter oder ressourcengesteuerter Terminierung enthält, kommt eine weitere Meldung hinzu, zum Beispiel *Diese MS-Project-Datei enthält 3 Vorgänge mit unterbrochener, geglätteter oder ressourcengesteuerter Terminierung. Sie werden so eingelesen und angezeigt*. Bei einem einzigen Vorgang steht die Meldung im Singular.

## Fallstricke und was die App dann tut

**Nicht alles wird übernommen.** Die App übernimmt keine Baselines, Kosten und Tarife, Notizen und benutzerdefinierten Felder aus MS Project. Ein PSP-Code, den Sie selbst in MS Project eingetragen haben, wird übernommen. Sonst nummeriert die App die Vorgänge nach der Struktur.

**Eine Datei aus MS Project 2007 oder älter.** Die App lehnt sie ab und meldet: *Diese .mpp-Datei verwendet ein altes Format (Project 2007 oder älter). Exportieren Sie sie in MS Project als XML (Datei → Speichern unter → XML) und öffnen Sie diese Datei*. Unter der Meldung fügt die App einen technischen Grund auf Englisch hinzu.

**Eine Datei mit Passwort.** Die App meldet: *Diese .mpp-Datei ist passwortgeschützt. Exportieren Sie sie in MS Project als XML (Datei → Speichern unter → XML) und öffnen Sie diese Datei*. Auch hier kommt die Meldung mit einem technischen Grund auf Englisch.

**Eine Datei, die keine `.mpp`-Datei ist.** Sie erhalten *Datei konnte nicht geöffnet werden* mit einem technischen Grund.

**Der XML-Weg rechnet anders.** Wenn Sie den XML-Export von MS Project statt der `.mpp`-Datei öffnen, rechnet die App mit dem Berechnungsprofil *Open Planner Studio*. Die Meldung zu *Microsoft Project* sehen Sie dann nicht. Die Termine können dann anders ausfallen als bei der `.mpp`-Datei.

**Eine Bearbeitung hebt die Steuerung durch MS Project auf.** Wenn Sie einen Vorgang bearbeiten, dessen Terminplan durch das Datumsfenster von MS Project gesteuert wurde, meldet die App einmal pro Projekt: *Die Stundenverteilung aus MS Project steuert 2 Vorgänge nach dieser Bearbeitung nicht mehr; die ursprüngliche Verteilung bleibt in der Datei erhalten*. Bei einem einzigen Vorgang lautet die Meldung im Singular.

**Beim Speichern wird Ihre `.mpp`-Datei nie überschrieben.** Das Projekt hat keine Datei. *Speichern* fragt, wo die neue IFC-Datei abgelegt werden soll.

## Siehe auch

- [Dateien und Formate](docs://uitleg-bestanden): warum eine `.mpp` nur gelesen wird und was beim Speichern geschrieben wird.
- [Termine wie aufgezeichnet](docs://uitleg-datums-zoals-opgeslagen): die Ansicht der eigenen Termine von MS Project.
- [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten): wenn die Datei Daten in Stunden enthält.
- [Eine Primavera P6-Datei (.xer) öffnen](docs://howto-xer-openen): dasselbe für Primavera P6.
- [Import- und Exportformate](docs://ref-import-exportformaten): je Format, was übernommen wird und was nicht.
- [Berechnungsprofile und Konventionen](docs://uitleg-rekenprofielen): warum eine MS-Project-Datei mit einem eigenen Berechnungsprofil geöffnet wird.
