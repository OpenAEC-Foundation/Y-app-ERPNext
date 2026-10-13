# Meldungen und Warnungen

Die App zeigt Ihnen, was passiert, an drei Stellen: in der Statusleiste unten, im Bereich *Warnungen* in der rechten Spalte und in den Meldungen, die kurz unten am Bildschirm erscheinen. Dieser Artikel beschreibt für jede Stelle, was Sie sehen, wann es erscheint und was Sie dagegen tun können. Warum ein Terminplan kritisch oder überlastet ist, steht in [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad); die Auflösung von Überlastung steht in [Überlastung auflösen](docs://howto-overbezetting-oplossen); das Erstellen von Beziehungen steht in [Beziehungen anlegen](docs://howto-relaties-leggen).

## Der Unterschied zwischen den dreien

- **Statusleiste** — eine feste Zeile mit Zählern. Sie stammen aus der letzten Berechnung und bleiben, bis Sie erneut berechnen.
- **Warnungsbereich** — die Liste hinter diesen Zählern, mit allem, was die letzte Berechnung gefunden hat. Ein Klick bringt Sie zum Vorgang, zur Beziehung oder zur Ressource. Sie wird aus der letzten Berechnung abgeleitet; nichts wird gespeichert.
- **Meldungen** — kurze Nachrichten über etwas, das Sie gerade getan haben (Speichern fehlgeschlagen, Beziehung abgelehnt, Import gelesen). Sie verschwinden wieder und stehen nicht im Bereich.

## Die Statusleiste

Die Leiste unten zeigt von links nach rechts:

- **Vorgänge:** — die Anzahl der Blattvorgänge (Sammelvorgänge zählen nicht mit).
- **Meilensteine:** — die Anzahl der Meilensteine.
- **Kritischer Pfad: N Vorgänge, N Arbeitstage** — die Anzahl der kritischen Vorgänge und die Projektdauer. Nur nach einer Berechnung sichtbar.
- **Ende:** — das Projektende aus der Berechnung. Nur nach einer Berechnung sichtbar; ein leeres Projekt hat keines.
- **N Stichtag(e) überschritten**, **N Einschränkung(en) verletzt**, **N Beziehung(en) mit Fortschritt außer Reihenfolge** und **N Ressource(n) überlastet** — jeweils eine Schaltfläche mit einem Warnzeichen, nur sichtbar, wenn der Zähler über 0 liegt und eine Berechnung vorliegt. Ein Klick öffnet den Bereich *Warnungen* (Tooltip: *Warnungsbereich öffnen (Details und Navigation)*). Wenn Sie auf dem Reiter *IFC* oder *Bericht* sind, springt die App gleichzeitig zu *Start*, weil es in diesem Reiter keine rechte Spalte gibt. Der Zähler für überlastete Ressourcen wird außerdem nach Änderungen an Ressourcen und Zuweisungen aktualisiert; die anderen Zähler ändern sich erst nach *Berechnen*. Die vier Zähler sind eine Auswahl: was der Bereich zusätzlich zeigt (gekappter Vorlauf, ignorierte Beziehung, Hammock ohne Ende-Treiber, gekapptes Enddatum, Terminplanfehler), steht nicht in der Statusleiste.
- **Veraltet — neu berechnen (F5)** — mit einem Warnzeichen (Tooltip: *Terminplan veraltet — neu berechnen (F5)*). Sichtbar, sobald Sie etwas ändern, das den Terminplan betrifft, und noch nicht neu berechnet haben. Wenn *Automatisch berechnen* aktiv ist, bleibt sie aus, außer wenn die Berechnung einen Fehler ergab; dann bleibt sie sichtbar.
- **Ausgewählt: N Vorgänge** — die Anzahl der ausgewählten Vorgänge; nur bei einer Auswahl sichtbar.
- **Maßstab:** und **Zoom: Npx/Tag** — die Zeitskala der Zeitleiste und die Zoomstufe. Der Maßstab folgt aus dem Zoom.
- **Nicht gespeichert** — solange das Dokument Änderungen hat, die nicht in der Datei stehen.
- **KI** — ein farbiger Punkt mit dem Wort KI, nur wenn der KI-Modus aktiv ist. Der Tooltip sagt *KI-Brücke:* mit *Aus*, *Aktiv auf Port N*, *Port N belegt* oder *Fehler*. Ein Klick öffnet den Reiter *KI*.
- **Debug-Terminal** — eine Terminal-Schaltfläche, nur wenn das Debug-Terminal aktiviert ist; sie zeigt oder blendet das Terminal ein oder aus (*Debug-Terminal anzeigen* / *Debug-Terminal ausblenden*).

## Der Bereich Warnungen

- **Öffnen** — *Planung › Terminplanung › Warnungen*, *Ansicht › Bereiche › Warnungen*, oder ein Zähler in der Statusleiste. Der Bereich steht in der rechten Spalte, unter *Eigenschaften* und dem Ressourcen-Dock, und öffnet eine eingeklappte Spalte. Standardmäßig ist er geschlossen, und er wird nicht zwischen Sitzungen gemerkt. Steht er unter anderen Bereichen, ziehen Sie seine Höhe am Rand; diese Höhe wird gemerkt. Das Kreuz oben rechts schließt ihn (*Warnungen schließen*).
- **Kopfzeile** — *N Fehler, N Warnung(en)*. Wenn noch nichts berechnet wurde, steht dort *Noch nicht berechnet — Berechnen (F5) drücken, um die Prüfungen auszuführen.*
- **Berechnen** — eine Schaltfläche in der Kopfzeile, sichtbar, solange der Terminplan veraltet ist oder noch nicht berechnet wurde. Sie tut dasselbe wie *Berechnen* im Menüband.
- **Warnzeichen in der Kopfzeile** — wenn der Terminplan veraltet ist, mit dem Tooltip *Terminplan veraltet — diese Liste stammt aus der letzten Berechnung. Neu berechnen (F5).* Die Liste wird nicht ausgeblendet, sie wird nur als veraltet markiert.
- **Leere Liste** — *Keine Warnungen. Der Terminplan besteht alle Prüfungen.*
- **Eine Zeile** — oben steht der Ort (Vorgang, Beziehung, Ressource oder Projekt), darunter die Beschreibung. Ein Fehler hat ein achteckiges Zeichen, eine Warnung ein dreieckiges Zeichen. Ein Vorgang erscheint als `PSP-Name`. Eine Beziehung erscheint als `Vorgänger → Nachfolger (FS+2d)`, mit Typ und Zeitabstand. Ein Klick führt zum Ort (Tooltip *Gehe zu: …*), siehe unten. Die Zeile, die zu Ihrem aktiven Vorgang gehört (bei einer Beziehung: zu deren Nachfolger), oder die Zeile zur Ressource, die im Histogramm gewählt ist, ist hervorgehoben.
- **Sortierung** — zuerst die Fehler; dann je Art in der Reihenfolge der Liste unten; innerhalb einer Art in der Reihenfolge im Dokument (bei einer Beziehung die des Nachfolgers, bei einer Ressource die der Ressourcenliste). Ein Vorgang, eine Beziehung oder eine Ressource, die nach der letzten Berechnung gelöscht wurde, fällt weg.

### Arten von Warnungen

- **Terminplanfehler** — *Der Terminplan konnte nicht berechnet werden: …* mit dem Grund danach, siehe unten. Ein Klick: Bei einem Zyklus wählt die App alle Vorgänge im Zyklus aus und springt zum ersten. Bei anderen Fehlern gibt es kein Ziel, und die Zeile ist keine Schaltfläche.
- **Stichtag überschritten** — *Stichtag {date} überschritten — frühestes Ende {date}*. Der Vorgang hat einen Stichtag, und die Berechnung hält ihn nicht ein. Ein Klick springt zum Vorgang. Zum Beheben passen Sie die Logik oder die Dauer an oder verschieben Sie den Stichtag.
- **Verletzte Einschränkung** — *Einschränkung {type and date} wird durch die Logik überschritten (negativer Puffer)*. Die Einschränkung lässt sich nicht einhalten, ohne die Logik zu brechen; der Puffer ist negativ. Ein Klick springt zum Vorgang. Siehe [Einschränkungen](docs://uitleg-constraints).
- **Fortschritt außer Reihenfolge** — *Fortschritt außer Reihenfolge: der Fortschritt des Nachfolgers widerspricht der Beziehung*. Der Fortschritt des Nachfolgers passt nicht zur Art der Beziehung, zum Beispiel ein Nachfolger, der schon begonnen hat, während der Vorgänger bei einer Ende-Anfang-Beziehung noch nicht fertig ist. Ein Klick wählt beide Vorgänge aus, mit dem Nachfolger als aktivem Vorgang. Prüfen Sie die Ist-Werte oder die Beziehung.
- **Vorlauf gekappt** — *Vorlauf durch den Projektstart gekappt — die Beziehung wird nicht vollständig eingehalten*. Der Vorlauf (negativer Zeitabstand) der Beziehung reicht vor den Projektstart. Ein Klick wählt beide Vorgänge aus.
- **Beziehung ignoriert** — *Beziehung ignoriert: Vorgänger oder Nachfolger fehlt oder ist kein Blattvorgang*. Die Berechnung verwendet die Beziehung nicht. Ein Klick wählt die Vorgänge aus, die noch existieren. Siehe [Beziehungen](docs://uitleg-relaties).
- **Hammock ohne Ende-Treiber** — *Hammock ohne Ende-Treiber (kein FF/SF-Vorgänger): die Dauer fällt auf null zurück*. Ein Klick springt zum Vorgang. Siehe [Hammock-Vorgänge](docs://howto-hammock).
- **Enddatum gekappt** — *Enddatum gekappt: der Kalender lässt kein arbeitsfähiges Fenster für diesen Vorgang*. Die Berechnung hat die Grenze der Tage erreicht, die sie durchsucht, zum Beispiel wegen eines sehr langen, ununterbrochenen Zeitraums arbeitsfreier Tage im Kalender. Ein Klick springt zum Vorgang. Siehe [Kalender und Arbeitstage](docs://uitleg-kalenders).
- **Überlastung** — *Überlastet an N Tag(en) (erster – letzter)*, mit *die Ressource arbeitet an diesen Tagen laut ihrem Kalender nicht*, wenn alle Tage arbeitsfrei sind, oder mit *davon N Tag(e), an denen die Ressource laut ihrem Kalender nicht arbeitet*, bei einer Mischung. Ein Klick wählt die Vorgänge aus, die dieser Ressource zugewiesen sind, schaltet das Histogramm ein und wählt darin diese Ressource. Von *Tabelle*, *IFC* oder *Bericht* springt die App zu *Ressourcen*. Siehe [Ressourcen-Panel](docs://ref-resourcepaneel).

### Gründe für einen Terminplanfehler

- *Zirkelbezug zwischen Vorgängen: {path}* — die Beziehungen bilden einen Zyklus. Die Vorgänge stehen im Pfad. Kehren Sie eine Beziehung um oder entfernen Sie eine.
- *Im Kalender sind keine Arbeitstage festgelegt* — geben Sie dem Kalender mindestens einen Arbeitstag, siehe [Kalenderfenster](docs://ref-kalenders).
- *Ungültige Dauer in Tagen für Vorgang '{task}'* und *Ungültige Dauer in Stunden für Vorgang '{task}'* — die Dauer des Vorgangs ist keine gültige Zahl.
- *Stundenvorgang '{task}' hat in seinem Kalender keine gültigen Arbeitszeiten* — ein Stundenvorgang steht in einem Kalender ohne Arbeitszeiten.
- *Ungültiges Startdatum für Vorgang '{task}'* — das Startdatum des Vorgangs ist nicht gültig.

## Benachrichtigungen

Benachrichtigungen erscheinen unten auf dem Bildschirm, auch in der Tabelle, in Backstage und im Präsentationsmodus. Eine Benachrichtigung ist ein *Fehler* oder eine *Info*. Ein Fehler bleibt stehen, bis Sie darauf klicken. Eine Info verschwindet nach 5 Sekunden. Diese Zeiten beginnen neu, sobald sich der Stapel ändert. Ein Klick auf eine Benachrichtigung schließt sie (Tooltip *Benachrichtigung schließen*). Es werden höchstens drei gleichzeitig angezeigt. Kommt eine vierte, geht zuerst die älteste Info weg. Gibt es keine Info, geht die älteste Benachrichtigung weg. So wird ein Fehler nie von einer Info verdrängt. Der Stapel weicht den Schaltflächen eines geöffneten Dialogs und festen Aktionsleisten aus.

- **Zähler ×N** — Eine Benachrichtigung mit festem Schlüssel fasst eine Wiederholung in einer Zeile mit Zähler zusammen. Ein Beispiel ist ein Speicherfehler, der immer wieder auftritt, oder eine abgelehnte Beziehung, die Sie wiederholen. Nicht jede Benachrichtigung macht das.
- **Mehr erfahren** — Manche Benachrichtigungen haben einen Link *Mehr erfahren* oder ein eigenes Thema, zum Beispiel *Arbeitsregeln erklärt*. Der Link führt zur Anleitung in Backstage › Hilfe.
- **Aktionsschaltfläche** — Die Benachrichtigung zum Berechnungsprofil hat eine Schaltfläche *Berechnungsprofil öffnen*, die zu Projektinfo führt.

Die Liste unten ist eine Auswahl, nach Thema gruppiert. Wenn nichts anderes angegeben ist, ist es eine Info.

### Speichern, Öffnen und Wiederherstellung

- **Fehler beim Speichern** (Fehler) — *Speichern fehlgeschlagen* mit dem Grund darunter. Beim Speichern, bei *Speichern unter* und beim Exportieren eines Berichts.
- **Als Download gespeichert** (Info) — *Als Download gespeichert: '{name}' ist jetzt in Ihrem Downloads-Ordner. …* Bei *Speichern unter* und bei Exporten, wenn die Umgebung der App nicht direkt an den gewählten Ort schreiben lässt. Zwei Downloads direkt nacheinander werden zu einer Zeile zusammengefasst.
- **Als Download gespeichert (Erklärung)** (Info) — *Als Download gespeichert: '{name}' ist in Ihrem Downloads-Ordner. Dieser Browser erlaubt der App nicht, an einen eigenen Ort zu schreiben, …* Bei *Speichern* in einem Browser, der nur über einen Download speichert. Einmal pro Sitzung, mit einem Link zur Erklärung zu Dateien.
- **Browser schreibt nicht zurück** (Info) — *Dieser Browser erlaubt der App nicht, zurück in '{name}' zu schreiben. …* Bei *Speichern* eines Projekts mit einer Datei, wenn der Browser erneut nach einem Ort fragen muss. Einmal pro Sitzung, mit einem Link zur Erklärung zu Dateien.
- **Automatisches Speichern fehlgeschlagen** (Fehler) — *Automatisches Speichern fehlgeschlagen* mit dem Grund. Gilt für das automatische Speichern in die Datei und für die Wiederherstellung nach einem Absturz.
- **Bibliothek konnte nicht gespeichert werden** (Fehler) — *Bibliothek konnte nicht gespeichert werden*, beim Speichern der Ressourcenbibliothek.
- **Öffnen einer Datei fehlgeschlagen** (Fehler) — *Datei konnte nicht geöffnet werden* mit dem Grund. Zum Beispiel bei einer zuletzt verwendeten Datei oder einer importierten Datei.
- **Alte oder geschützte .mpp** (Fehler) — *Diese .mpp-Datei verwendet ein älteres Format (Project 2007 oder früher)…* oder *Diese .mpp-Datei ist passwortgeschützt…*, beide mit dem Hinweis, die Datei in MS Project als XML zu exportieren und diese Datei zu öffnen.
- **Ungültige XER-Datei** (Fehler) — einer der *XER…*-Texte, zum Beispiel *Dies ist keine gültige oder unterstützte XER-Datei.* oder *Die XER-Datei enthält eine doppelte Tabelle.*, mit dem Grund ergänzt.
- **IFC konnte nicht gelesen werden** (Fehler) — *IFC konnte nicht gelesen werden* mit dem Grund, in der IFC-Ansicht.
- **Wiederherstellung** (Fehler) — *Wiederhergestellte Datei konnte nicht gelesen werden*, *Wiederherstellung fehlgeschlagen* und *N Wiederherstellungsdateien konnten nicht geladen werden und wurden übersprungen.* Bei der Wiederherstellung nach einem unerwarteten Beenden der App.
- **Als Vorlage gespeichert** (Info) — *Zweig als Vorlage '{name}' gespeichert*.
- **Meldung einer Erweiterung** (Info, oder Fehler, wenn die Erweiterung einen Fehler meldet) — *Erweiterung {name}: {message}*. Eine Erweiterung darf höchstens drei neue Meldungen pro 10 Sekunden anzeigen, damit sie den Stapel nicht füllt. Wenn ein Schritt der Anleitung einer Erweiterung fehlschlägt, steht dort *Ein Schritt der Erweiterung {name} ist fehlgeschlagen. Die Anleitung läuft weiter.* Kann eine Projektdatei einer Erweiterung nicht geöffnet werden, steht dort *Die Projektdatei {file} der Erweiterung {name} konnte nicht geöffnet werden.* Beide sind Fehler.
- **Zwischenzeitliche Änderung** (Info) — *Eine Änderung durch den KI-Assistenten oder eine Erweiterung ist dazwischengekommen. …* Wenn Sie den Vorgangsdialog abbrechen, während der KI-Assistent oder eine Erweiterung in der Zwischenzeit etwas geändert hat: Die Vorgangsänderungen von vor dieser Änderung werden nicht rückgängig gemacht. Sie bleiben als normale Schritte unter *Rückgängig* erhalten.

### Berechnen

- **Terminplan konnte nicht berechnet werden** (Fehler) — *Terminplan konnte nicht berechnet werden* mit dem Grund darunter (siehe *Gründe für einen Terminplanfehler*). Bei *Berechnen*, beim Wechseln des Dokuments und beim Öffnen einer Datei.
- **Statusdatum auf heute gesetzt** (Info) — *Es gab noch kein Statusdatum: Es ist jetzt auf heute ({date}) gesetzt, weil der Fortschritt bis zum Statusdatum gemessen wird. Ändern können Sie es unter Planung → Statusdatum.* Wenn Sie in einem Projekt ohne Statusdatum einen Fortschritt eintragen.
- **Dauer kürzer als die geleistete Arbeit** (Info) — *„{name}“ ist bereits zu {percent} % erledigt: Eine Dauer, die kürzer ist als die bereits geleistete Arbeit, ist nicht möglich. Die Dauer wurde nicht geändert.*

### Beziehungen und Hierarchie

- **Beziehung erstellt** (Info) — *Beziehung erstellt: {predecessor} → {successor}*.
- **Beziehung abgelehnt** (Info) — *Diese Beziehung besteht bereits*, *Eine Beziehung zwischen einem Vorgang und seinem eigenen übergeordneten Sammelvorgang ist nicht zulässig.* oder *Diese Beziehung würde einen Zyklus im Terminplan erzeugen ({cycle}) und wurde nicht erstellt.* Der Zyklus nennt die Vorgänge. So wissen Sie, welche Beziehung Sie zuerst entfernen oder umkehren müssen.
- **Verschieben abgelehnt** (Info) — *Diese Verschiebung würde einen Zyklus im Terminplan erzeugen ({cycle}): Die Beziehungen eines Sammelvorgangs gelten auch für seine Teilvorgänge. Es wurde nichts verschoben.*
- **Beziehungen fallen nach einem Verschieben weg** (Info) — *Nach dem Verschieben verbinden N Beziehungen einen Vorgang mit seinem eigenen übergeordneten Sammelvorgang; sie fließen nicht mehr in die Berechnung ein.*
- **Beziehungen beim Einfügen übersprungen** (Info) — *N Beziehungen wurden nicht erstellt: ungültige Beziehung…*, beim Einfügen oder Einsetzen eines Zweigs.
- **Beziehungen nach dem Import nicht berücksichtigt** (Info) — *{total} Beziehung(en) konnten nicht einbezogen werden. Prüfen Sie die Vorgänger- und Nachfolgerspalten.*
- **Doppelte IDs nach dem Import** (Info) — *Objekte mit einer doppelten ID in dieser Datei: N. Sie haben jeweils eine eigene ID erhalten…*

### Vorgänge bearbeiten

- **Anfang als Einschränkung festgehalten** (Info) — *'{name}' hat einen Vorgänger: Der neue Anfang ist jetzt die Einschränkung Anfang nicht früher als (SNET) {date}. Nach dem Neuberechnen (F5) beginnt der Vorgang nicht vor diesem Datum.* Wenn Sie den Anfang eines Vorgangs mit Vorgänger ändern. Hatte der Vorgang schon eine solche Einschränkung, sagt die Benachrichtigung, dass sie verschoben wurde. Bei mehreren Vorgängen gleichzeitig nennt sie eine Anzahl.
- **Anfang nicht übernommen** (Info) — *Der neue Anfang von „{name}“ wurde nicht übernommen: Der Vorgang hat einen Vorgänger und die Einschränkung {type} {date}, und diese bestimmen seinen Anfang. Ändern Sie diese Einschränkung, um den Anfang zu verschieben.*
- **Meilenstein abgelehnt** (Info) — *„{task}“ hat Ressourcenzuweisungen und kann kein Meilenstein werden. Entfernen Sie zuerst die Zuweisungen.* oder *„{task}“ ist ein Sammelvorgang mit Teilvorgängen und kann kein Meilenstein werden.* Beim Umwandeln im Vorgangsdialog, im Eigenschaftenbereich, im Kontextmenü und in der Tabelle.
- **Zuweisungen zu einem Teilvorgang verschoben** (Info) — *Die Zuweisung von {resources} wurde von „{phase}“ zum neuen Teilvorgang „{child}“ verschoben: Ein Sammelvorgang trägt selbst keine Zuweisungen.* Wenn ein Vorgang mit Zuweisungen Teilvorgänge bekommt.
- **Meilensteinmarkierung entfernt** (Info) — *Meilenstein „{phase}“ hat jetzt Teilvorgänge und ist zum Sammelvorgang geworden; die Meilensteinmarkierung wurde entfernt.*
- **Sammelvorgang abgelehnt** (Info) — *'{phase}' kann nicht zum Sammelvorgang werden: …* mit dem Grund und *Es wurde nichts geändert.*
- **Zellen beim Einfügen übersprungen** (Info) — *N Zellen übersprungen: Sie sind schreibgeschützt (z. B. ein automatisch nummerierter PSP-Code oder eine berechnete Spalte).*
- **Verweise beim Einfügen geleert** (Info) — *{count} Verweise existierten in diesem Dokument nicht und wurden geleert (Vorgangskalender, eigene Vorgangsarten, Vorgangscodes oder benutzerdefinierte Felder aus dem Quelldokument).*
- **Arbeitsregel hat Dauern angepasst** (Info) — *Nach der Kalenderänderung hat die Arbeitsregel die Dauer von N Vorgängen angepasst (Arbeit bleibt, Stunden pro Tag geändert).* Mit einem Link *Arbeitsregeln erklärt*.

### Primavera (XER)

- **XER-Datei geöffnet** (Info) — *XER-Datei geöffnet: N Projektdokumente.* Eine Benachrichtigung pro Datei, auch wenn die Datei mehrere Projekte öffnet, mit einem Link *Mehr erfahren* und Detailzeilen darunter. Immer *N Projekte gefunden.* Nur wenn die Zahl über 0 liegt: *N leere Projekte übersprungen.*, *N Baseline-Projekte ausgeschlossen.*, *N Baselines materialisiert.*, *N verwaiste Baseline-Verweise ignoriert.*, *Ein schützender Baseline-Rückfall wurde verwendet.* und *N externe Beziehungen beibehalten.* Nur bei einer anderen Kodierung als UTF-8: *Textkodierung gewählt: {encoding}.* Außerdem, wenn die Zahl über 0 liegt: *N Parser-Hinweise.*, *N Kalender-Hinweise.*, *N Zahlenformat-Hinweise.*, *N Enum-Rückfälle.* und *N P6-Planungseinstellungen mit sicherem Rückfall.*
- **Daten wie von Primavera gespeichert** (Detailzeile in derselben Benachrichtigung) — *N Vorgänge zeigen die von Primavera gespeicherten Termine (nicht neu berechnet).*, oder, wenn der Modus nicht eingeschaltet wurde, *N Vorgänge weichen von den Terminen in der Datei ab — Sie können sie anzeigen.*
- **XER-Quellarchiv unbrauchbar** (Info) — *Das XER-Quellarchiv in dieser Datei ist unbrauchbar und wurde weggelassen; das Projekt selbst wurde vollständig geöffnet.* mit dem Grund (zum Beispiel *Grund: Die Prüfsumme passt nicht zu den Quellbytes — das Archiv ist beschädigt.*) und der Folge (*Der Terminplan, das Berechnungsprofil und alle Projektdaten aus der IFC sind vollständig. …*). Wenn Sie eine IFC-Datei öffnen, in der ein zuvor gespeichertes XER-Quellarchiv nicht verwendet werden kann.
- **Export verliert XER-Informationen** (Info) — *Beim Export nach {format} gehen XER-Quellinformationen verloren.* Nach einem erfolgreichen Export in ein anderes Format als IFC, bei einem Projekt mit Daten, die nur in einer XER-Datei vorkommen. Mit einem Link *Mehr erfahren*.

### Importieren, Exportieren und Berechnungsprofil

- **Termine wie in der Datei** (Info) — *N Vorgänge zeigen die in der Datei gespeicherten Termine (nicht neu berechnet).* oder *N Vorgänge weichen von den Terminen in der Datei ab — Sie können sie anzeigen.* Beim Öffnen einer Datei mit gespeicherten Terminen.
- **Arbeit und Arbeitsregeln sichtbar** (Info) — *Diese Datei enthält gespeicherte Arbeit oder eigene Arbeitsregeln; Arbeitsregel und Restarbeit werden für dieses Projekt angezeigt.*
- **MS Project-Terminplan eingelesen** (Info) — *Diese MS-Project-Datei enthält N Vorgänge mit unterbrochener, geglätteter oder ressourcengesteuerter Terminierung. Sie werden so eingelesen und angezeigt.*
- **Unterbrechungen nicht exportiert** (Info) — *{count} Vorgänge mit Unterbrechungen wurden ohne ihre Unterbrechungen exportiert: MS Project/P6 kennen diese nur als Arbeitsverteilung.* Beim Export nach MS Project oder Primavera.
- **Projektstart verschoben** (Info) — *Projektstart verschoben: N Vorgangsanker ohne Vorgänger oder Einschränkung wurden auf das neue Startdatum verschoben.*
- **Datumsfenster steuert nicht mehr** (Info) — *Das Datumsfenster von MS Project steuert nach dieser Bearbeitung N Vorgänge nicht mehr; …* Einmal pro Dokument.
- **Abgleichsverzögerung gerundet** (Info) — *Der Kapazitätsabgleich rundet die minutengenaue Abgleichsverzögerung aus MS Project für N Vorgänge auf ganze Arbeitstage.* Einmal pro Dokument.
- **Berechnungsprofil angewendet** (Info) — *Dieses Projekt rechnet als {profile}. Ändern über Datei → Projektinfo → Berechnungsprofil und Berechnungsoptionen.* Mit der Schaltfläche *Berechnungsprofil öffnen*. Nach dem Anwenden eines Profils folgt, wenn nötig, *Nach dem Anwenden wurden N Vorgänge verschoben.*
