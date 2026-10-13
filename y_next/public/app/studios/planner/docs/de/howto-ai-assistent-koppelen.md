# Einen KI-Assistenten verbinden (MCP)

Ziel: Ein KI-Assistent liest mit und arbeitet an Ihrem Terminplan, mit Einblick in das, was er tut, und mit Grenzen, die Sie selbst setzen.

## Wann Sie das brauchen

Sie möchten, dass ein KI-Assistent Ihren Terminplan liest, analysiert oder ändert. Zum Beispiel, damit er einen ersten PSP entwirft, Vorgänge korrigiert oder den kritischen Pfad erklärt. Das funktioniert über das **Model Context Protocol** (MCP): ein Standard, mit dem ein KI-Assistent die Werkzeuge eines Programms nutzen kann. Dafür startet Open Planner Studio einen kleinen Server auf Ihrem eigenen Computer, die **Bridge**. Sie bietet eine Reihe von Werkzeugen an, alle mit einem Namen, der mit `planner_` beginnt, zum Lesen und Ändern von Vorgängen, Beziehungen, Ressourcen, Kalendern, Baselines, Dokumenten und Dateien. Welche es gibt und welche sie ablehnen, steht in [KI-Werkzeuge](docs://ref-ai-tools); warum die Verbindung so funktioniert, steht in [Wie die KI-Verbindung funktioniert](docs://uitleg-ai-koppeling).

Die Bridge funktioniert nur in der Desktop-App. Wenn Sie den KI-Modus im Browser einschalten, sehen Sie die Registerkarte *KI*, aber die Schaltfläche *Bridge starten* ist grau, mit dem Text *Die Bridge funktioniert nur in der Desktop-App.* Der Rest dieses Artikels betrifft die Desktop-App. Im Browser sind auch *Jetzt sichern* und *Backup-Ordner öffnen* grau.

## Schritte

### 1. KI-Modus einschalten

1. Wählen Sie *Einstellungen › Projekt › Einstellungen*. Sie können auch *Datei › Einstellungen* wählen oder das Zahnrad oben.
2. Wählen Sie die Registerkarte *Erweitert* und schalten Sie *KI-Modus aktivieren* ein. Die Registerkarte *KI* erscheint im Menüband.
3. Wenn die Bridge sofort nach dem Start der App aktiv sein soll, schalten Sie außerdem *Bridge automatisch starten* ein. Die Option wirkt nur, wenn der KI-Modus an ist, und nur in der Desktop-App. Standardmäßig ist sie aus, weil das Öffnen eines Ports eine bewusste Entscheidung ist.

Wenn Sie den KI-Modus ausschalten, stoppt die Bridge, und die Registerkarte *KI* verschwindet.

### 2. Bridge starten

1. Gehen Sie zur Registerkarte *KI* und klicken Sie unter *Server* auf *Bridge starten*.
2. Sehen Sie sich den Status neben der Schaltfläche an. Dort steht *Aus*, *Aktiv auf Port 3877*, *Port 3877 belegt* oder *Fehler*. Wenn der Start gelingt, steht dort *Aktiv auf Port 3877* und die Schaltfläche heißt *Bridge stoppen*. Bei *Port 3877 belegt* oder *Fehler* bleibt die Schaltfläche *Bridge starten*; siehe unter Fallstricke.

Die Bridge nimmt nur auf Ihrem eigenen Computer Verbindungen an, und zwar auf einem einzigen Port. Standardmäßig ist das 3877. In der Gruppe *Verbindung* können Sie unter *Port* einen anderen wählen, aber nur, solange die Bridge gestoppt ist.

### 3. Den KI-Assistenten verbinden

1. Klicken Sie unter *Verbindung* auf *Verbinden*. Das Fenster *Verbindungsdaten* öffnet sich.
2. Wählen Sie, was Ihr Client benötigt, siehe unten.
3. Das Token ist verborgen. Mit dem Augensymbol zeigen Sie es an. Die Kopierschaltflächen kopieren immer den echten Wert, auch wenn der Bildschirm das Token verbirgt.
4. Lassen Sie den Assistenten die Liste der Werkzeuge anfordern. Diese Prüfung steht auch im Verbindungs-Prompt: Der Assistent soll die Werkzeuge mit dem Präfix `planner_` sehen. Die erwartete Anzahl steht im Verbindungs-Prompt.

Das Fenster bietet drei Wege zur Verbindung:

- *Konfigurationsausschnitt*: ein Stück Konfiguration, das Sie in die MCP-Einstellungen Ihres Clients einfügen.
- *Verbindungs-Prompt*: ein Text, den Sie in Ihren KI-Assistenten einfügen. Danach verbindet sich der Assistent selbst.
- *Endpunkt* und *Authentifizierung*: die einzelnen Angaben. Der Endpunkt ist `http://localhost:3877/mcp` mit dem Transport *streamable HTTP*. Jede Anfrage braucht einen Header `Authorization: Bearer`, gefolgt von Ihrem Token.

In der Gruppe *Verbindung* steht außerdem das Feld *Token*. Das ist ein langer, zufälliger Code, den die App für Sie erzeugt und auf diesem Computer speichert. Im Fenster steht *Dieses Token gewährt Zugriff auf den geöffneten Plan. Geben Sie es nicht weiter.* Mit dem Symbol *Neuer Token* erstellen Sie ein neues Token. Die App fragt zuerst *Ein neuer Token trennt alle bestehenden Verbindungen. Fortfahren?* Wenn die Bridge läuft, startet sie mit dem neuen Token neu, und das alte Token funktioniert nicht mehr.

### 4. Sehen Sie, was die KI tut

1. Klicken Sie unter *Aktivität* auf *Aktivitätsbereich*. In der seitlichen Spalte öffnet sich der Bereich *KI-Aktivität*.
2. Jeder Aufruf der Bridge steht in einer Zeile, die neueste oben: Zeit, was passiert ist, wie lange es gedauert hat und ob es gelungen ist oder nicht. Klicken Sie auf eine Zeile, um *Argumente* und *Antwort* aufzuklappen.
3. Mit *Leeren* entfernen Sie alle Einträge aus der Liste. Der Bereich behält die letzten 500 Aufrufe. Solange noch nichts passiert ist, steht dort *Noch keine KI-Aktivität. Aufrufe der Bridge erscheinen hier.*

Wenn der KI-Modus an ist, steht unten rechts in der Statusleiste ein Punkt mit *KI*. Seine Farbe zeigt den Status der Bridge. Ein Klick darauf bringt Sie zur Registerkarte *KI*.

### 5. Grenzen setzen

Unter *Sicherheit* finden Sie die Schaltflächen, mit denen Sie die KI begrenzen:

- *Pausieren*: Die KI darf vorübergehend nichts ändern, Lesen bleibt erlaubt. Die Bridge bleibt aktiv. Die Schaltfläche wird zu *Fortsetzen*.
- *Schreibgeschützt*: Alle Werkzeuge, die etwas ändern, werden abgelehnt, solange diese Option an ist.
- *Auto-Backup: an*: Bevor die KI in einem Dokument zum ersten Mal etwas ändert, schreibt die App ein IFC-Backup. Das ist standardmäßig an. Mit dieser Schaltfläche schalten Sie es aus; dann steht dort *Auto-Backup: aus*. Das geschieht einmal pro Dokument, jedes Mal wenn Sie die Bridge starten.
- *Jetzt sichern*: Die App erstellt sofort ein Backup des aktiven Dokuments. Danach steht dort *Backup erstellt:* mit dem Dateinamen.
- *Backup-Ordner öffnen*: Öffnet den Ordner mit den Backups.

Die Backups liegen im Ordner `ai-backups` im Datenordner der App. Die App behält die letzten Backups und reduziert die älteren. Genau wie das funktioniert, steht in [KI-Werkzeuge](docs://ref-ai-tools).

### 6. Den KI-Assistenten gut planen lassen

Ein KI-Assistent, der die Werkzeuge kennt, kann trotzdem einen Terminplan bauen, den kein Planer brauchen kann: Vorgänge ohne Beziehungen, ein festes Datum bei jedem Vorgang oder eine Gliederung, die viel zu fein ist. Deshalb erhält der Assistent die Planungsregeln auf drei Wegen. Bei den ersten beiden müssen Sie nichts tun.

1. **Die Kernregeln kommen von selbst mit.** Beim Verbinden sendet die Bridge einen kurzen Text mit den Kernregeln. Viele Clients legen diesen Text in ihren System-Prompt; ob Ihrer das tut, hängt vom Client ab. Dort steht unter anderem: Beginnen Sie bei den Meilensteinen, bilden Sie Vorgänge von etwa einem Tag bis zu zwei Wochen, steuern Sie den Terminplan über Beziehungen statt mit festen Datumsangaben, und nennen Sie am Ende, was Sie angenommen haben.
2. **Der Verbindungs-Prompt verweist auf den vollständigen Leitfaden.** Der Verbindungs-Prompt im Fenster *Verbindungsdaten* bittet den Assistenten, zuerst den Planungsleitfaden zu lesen, mit dem Werkzeug `planner_get_planning_guide`. Das liefert einen englischen Leitfaden für Assistenten: dieselben Grundsätze wie in [Gut planen](docs://gids-goed-plannen), mit den Werkzeugen, die der Assistent für jeden Grundsatz nutzt. Sie können ihn selbst lesen unter `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Wenn Sie den Prompt nicht verwenden, bitten Sie den Assistenten selbst: *Lesen Sie zuerst den Planungsleitfaden mit planner_get_planning_guide, bevor Sie etwas ändern.*
3. **Optional: die Skills.** Ein Skill ist eine kleine Datei mit Anweisungen, die ein Assistent in jeder Sitzung mitliest, damit er in einem späteren Gespräch auch die richtige Arbeitsweise kennt. Es gibt zwei, beide auf Englisch: *goed-plannen* zum Aufbauen oder Umbauen eines Terminplans und *progress-update* für die wöchentliche Fortschrittsaktualisierung. Das funktioniert nur mit einem Assistenten, der Skills unterstützt; die Skills selbst nennen Claude Code und verwandte Assistenten. Jeder Skill ist eine Datei `SKILL.md` in einem eigenen Ordner, der nach dem Skill benannt ist: `.claude/skills/goed-plannen/SKILL.md` und `.claude/skills/progress-update/SKILL.md` im Projektordner, in dem der Assistent arbeitet, oder dieselben Ordner unter `~/.claude/skills/`, damit sie in jedem Projekt gelten.

Sie erhalten die Dateien auf zwei Wegen. Bitten Sie den Assistenten, das Werkzeug `planner_get_planning_guide` aufzurufen, mit `part` auf `skill` gesetzt: Die Antwort enthält beide Texte und, für jeden Skill, die Orte, an die er gehört. Oder laden Sie sie herunter von `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` und `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Wenn *goed-plannen* aus einer älteren Version der App noch da ist, ersetzen Sie es: Dieser alte Text ist auf Niederländisch und verweist auf den Hilfeartikel statt auf den Leitfaden für Assistenten.

Ob der Assistent den Leitfaden wirklich gelesen hat, sehen Sie im *Aktivitätsbereich*: Dort steht dann ein Aufruf von `planner_get_planning_guide`. Die letzte Antwort sollte eine Liste mit Annahmen enthalten: geschätzte Dauern, die gewählte Gliederung, Beziehungen, die der Assistent selbst angelegt hat, und jede Einschränkung, die er gesetzt hat. Fehlt diese Liste, bitten Sie darum. Nach einer Fortschrittsaktualisierung mit *progress-update* sollte die Antwort das Statusdatum, das neue Ende und die Abweichung gegenüber der Baseline nennen.

## Fallstricke und was die App dann tut

**Die KI ändert etwas, das Sie zurücknehmen möchten.** Jede Änderung durch die KI ist ein Schritt, den Sie mit *Rückgängig* (Strg+Z) zurücknehmen. Eine Reihe von Änderungen, die die KI als Ganzes übergibt, ist ein einziger Schritt. Danach wird das Projekt als ungespeichert angezeigt. Nach einer Änderung wird der Terminplan neu berechnet, daher müssen Sie selbst nicht F5 drücken.

**Die App lehnt einen Aufruf der KI ab.** Bei *Pausieren* und *Schreibgeschützt* lehnt die App alle Änderungen ab. Lesen bleibt möglich, auch das Neuberechnen eines veralteten Terminplans. Wenn Sie selbst gerade eine Bearbeitung machen, etwa einen Balken ziehen oder in ein Feld tippen, bekommt die KI die Termine von vor Ihrer Bearbeitung zurück, mit einem Hinweis, dass sie veraltet sind. Wenn ein Dialog offen ist, zum Beispiel die Einstellungen, ein Vorgangsdialog oder das Willkommensfenster, oder wenn der Präsentationsmodus an ist, lehnt die App alle Aufrufe ab, auch das Lesen, bis Sie den Dialog schließen. Die KI bekommt dann eine Fehlermeldung mit dem internen Namen dessen, was offen ist, zum Beispiel `showTaskDialog`. Nur `planner_get_planning_guide` funktioniert weiter, weil es Ihren Terminplan nicht liest.

**Sie wechseln die Registerkarte, während die KI arbeitet.** Die KI arbeitet an dem Dokument, in dem ihre erste Änderung landete. Wechseln Sie in der Zwischenzeit die Registerkarte, lehnt die App die nächste Änderung der KI ab, bis die KI bestätigt, dass sie an der anderen Registerkarte arbeiten will. So landet nichts im falschen Projekt.

**Die KI schreibt oder öffnet eine Datei.** Die KI kann einen Terminplan als IFC-Datei schreiben und eine Terminplan-Datei als neue Registerkarte öffnen. Das kann sie nur innerhalb Ihres Benutzerordners. Eine bestehende Datei überschreibt sie nur, wenn sie ausdrücklich darum bittet.

**Der Status ist *Port 3877 belegt*.** Ein anderes Programm nutzt den Port. Die Meldung der App steht darunter. Das Feld *Port* bleibt dann gesperrt (*Nur bearbeitbar, solange der Server gestoppt ist.*), obwohl die Bridge nicht läuft, und es gibt keine Stopp-Schaltfläche. Das ist ein bekannter Mangel. Bis das behoben ist: Schalten Sie *KI-Modus aktivieren* aus und wieder ein. Der Status steht dann wieder auf *Aus*, und Sie können einen anderen Port wählen. Kopieren Sie danach die Verbindungsdaten erneut, weil der Endpunkt den Port enthält.

**Der Client kann sich nach einem neuen Token nicht verbinden.** Ein neues Token trennt alle bestehenden Verbindungen. Geben Sie dem Client das neue Token, oder fügen Sie den Konfigurationsausschnitt erneut ein.

**Sie haben die Bridge selbst gestoppt, und sie startet nicht von selbst.** *Bridge automatisch starten* wirkt einmal bei jedem Start der App. Wenn Sie die Bridge selbst stoppen, schaltet die App sie nicht stillschweigend wieder ein.

**Die Registerkarte *KI* ist verschwunden.** Der KI-Modus ist aus. Schalten Sie ihn in Schritt 1 ein.

**Eine Webseite in Ihrem Browser kann nicht mit der Bridge sprechen.** Die Bridge lehnt jede Anfrage ab, die aus einem Browser kommt, und jede Anfrage ohne das richtige Token.

## Siehe auch

- [Rückmeldung geben](docs://howto-feedback-geven): Wenn die Verbindung anders funktioniert als hier beschrieben, melden Sie es.
- [Wie die KI-Verbindung funktioniert](docs://uitleg-ai-koppeling): was die Verbindung ist, warum der Assistent in Ihrem geöffneten Projekt arbeitet und was er nicht darf.
- [KI-Werkzeuge](docs://ref-ai-tools): alle `planner_*`-Werkzeuge nach Gruppe, die Fehlercodes und wie lange Backups aufbewahrt werden.
- [Gut planen](docs://gids-goed-plannen): die Planungsgrundsätze; der Assistent erhält sie in einer englischen Fassung mit den ergänzten Werkzeugen.
- [Einstellungen](docs://ref-instellingen): die KI-Einstellungen.
