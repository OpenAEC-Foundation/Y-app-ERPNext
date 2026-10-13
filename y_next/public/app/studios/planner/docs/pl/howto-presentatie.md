# Prezentowanie na dużym ekranie

Cel: pokazać wykres Gantt na pełnym ekranie, bez wstążki i paneli, na przykład na projektorze lub telewizorze podczas narady na budowie.

## Kiedy tego potrzebujesz

Dziesięć osób patrzy na jeden ekran w baraku na budowie. Wtedy wstążka, pasek stanu i panel właściwości zajmują miejsce, którego potrzebuje harmonogram, i rozpraszają uwagę. W **trybie prezentacji** aplikacja pokazuje tylko tabelę zadań i wykres Gantt, na całym ekranie.

## Kroki

### Przygotowanie widoku

W trybie prezentacji wstążki nie ma, więc przygotuj wcześniej to, co chcesz pokazać.

1. Naciśnij **Oblicz** (F5), aby pokazane daty były poprawne.
2. Ustaw widok, który chcesz pokazać, na przykład układ, który pokazuje tylko zadania krytyczne (zobacz [Tworzenie i używanie układu](docs://howto-layouts-gebruiken)).
3. Wybierz skalę czasu i powiększenie, przy których nazwy zadań są czytelne z daleka, i zwiń lub rozwiń fazy przyciskami *Zwiń* i *Rozwiń* w grupie *Konspekt* na zakładce *Widok*.
4. Jeśli chcesz ich użyć, włącz opcje *Widok podzielony* i *Minimapa* (zobacz [Używanie widoku podzielonego i minimapy](docs://howto-split-view-en-mini-map)).

### Uruchomienie prezentacji

Wybierz *Widok › Prezentacja › Prezentacja* albo naciśnij F11. Wstążka, zakładki, pasek stanu i panel po prawej stronie znikają. Widzisz tabelę zadań, wykres Gantt oraz, jeśli je włączyłeś, histogram i minimapę. Przez kilka sekund na dole pojawia się napis *Naciśnij Esc lub F11, aby wyjść z trybu pełnoekranowego.*

Prezentację możesz uruchomić z dowolnej zakładki, także z zakładki *Tabela* lub *Raport*. Zawsze widzisz wykres Gantt otwartego projektu, a po zakończeniu wracasz do zakładki, z której zacząłeś.

### Zakończenie prezentacji

Naciśnij Esc lub F11. Wstążka i panele wracają na zakładkę, z której zacząłeś.

## Pułapki i co robi aplikacja

**W trybie prezentacji nadal możesz edytować.** Klikanie, przeciąganie, edytowanie komórek i Delete nadal działają. Jeśli przypadkiem przeciągniesz pasek, przesunie się i harmonogram przestanie być aktualny. Zadanie, które przypadkiem usuniesz, przywrócisz klawiszami Ctrl+Z, także w trybie prezentacji. Dlatego klikaj ostrożnie, gdy pracujesz z grupą.

**Powiadomienia zostają widoczne.** Komunikat z aplikacji, na przykład błąd zapisu, pojawia się także w trybie prezentacji. Poza tym nie ma wstążki ani paska stanu, więc taki komunikat jest jedynym znakiem, że coś jest nie tak.

**Przygotuj wcześniej widok podzielony, minimapę i układy.** Potrzebujesz do tego wstążki, a w tym trybie jej nie ma. Powiększanie działa, kółkiem myszy albo Ctrl+= i Ctrl+-. Również + i - działają, ale tylko wtedy, gdy fokus jest w wykresie Gantt. Po F11 fokus często jest w tabeli zadań, dlatego najpierw kliknij w wykres Gantt.

**Pełny ekran nie zawsze działa.** Aplikacja nie tylko ukrywa wstążkę, ale też naprawdę prosi o pełny ekran. Jeśli przeglądarka albo okno tego nie dopuści, znikają tylko wstążka i panele. Prezentacja nadal działa. Jeśli opuścisz pełny ekran w inny sposób niż przez Esc lub F11, na przykład klawiszem systemu operacyjnego, tryb prezentacji też się zakończy.

**Tryb prezentacji nie jest zapamiętywany.** Po zamknięciu i ponownym otwarciu aplikacji jest wyłączony.

## Zobacz także

- [Używanie widoku podzielonego i minimapy](docs://howto-split-view-en-mini-map): dwa okna czasu albo pasek przeglądu podczas prezentacji.
- [Tworzenie i używanie układu](docs://howto-layouts-gebruiken): ustawienie widoku, który chcesz pokazać, jednym kliknięciem.
- [Skróty klawiszowe](docs://ref-sneltoetsen): F11 i pozostałe klawisze.
