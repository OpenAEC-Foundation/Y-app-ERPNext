# Używanie widoku podzielonego i minimapy

Cel: zobaczyć dwa fragmenty osi czasu obok siebie i szybko przechodzić przez długi harmonogram.

## Kiedy tego potrzebujesz

Omawiasz początek fundamentów i jednocześnie przekazanie obiektu dziewięć miesięcy później. Bez pomocy ciągle powiększasz i pomniejszasz widok i gubisz się, gdzie byłeś. **Widok podzielony** pokazuje ten sam harmonogram dwa razy, obok siebie, a każde okno ma własny zakres czasu. Dzięki **minimapie** widzisz cały okres projektu w jednym wąskim pasie i klikając, przechodzisz do części, której szukasz.

## Kroki

### Włączanie widoku podzielonego

1. Wybierz zakładkę *Widok*. W grupie *Prezentacja* są *Prezentacja*, *Widok podzielony* i *Minimapa*.
2. Kliknij *Widok podzielony*. Wykres Gantt podzieli się na dwie części. Obydwa okna zaczynają z powiększeniem i położeniem Twojego bieżącego widoku.

Obydwa okna współdzielą tabelę zadań, wiersze i pionowe przewijanie. Każde okno ma własną oś czasu: przybliżenie i położenie w poziomie.

### Nadanie każdemu oknu własnego zakresu czasu

- Przybliżaj i przewijaj w oknie, nad którym jest Twoja mysz. Przy domyślnym ustawieniu dla *Przewijanie i powiększenie* (*Zoom + przeciąganie*) kółko myszy przybliża w tym oknie, wyśrodkowane na myszy. Jeśli Twoje ustawienie działa w innym trybie, kółko robi w obu oknach to, co określa ten tryb.
- Przy domyślnym ustawieniu przewijasz wiersze klawiszem Shift i kółkiem myszy. Działa to w obu oknach naraz.
- Przyciski *Zoom +* i *Zoom -* oraz lista skali czasu (na przykład *Kwartał*) działają tylko w lewym oknie. Prawe okno przybliżasz więc kółkiem myszy.
- Przeciągnij linię podziału między dwoma oknami w lewo lub w prawo, aby okna były szersze lub węższe. Na początku są po połowie.

### Wyłączanie widoku podzielonego

Kliknij ponownie *Widok podzielony*. Zostaje jedno okno, z widokiem lewego okna. Nowy widok podzielony zaczyna się ponownie od widoku z tego momentu.

### Włączanie minimapy

1. W grupie *Prezentacja* kliknij *Minimapa*.
2. Pod osią czasu pojawia się pas całego okresu projektu. Zadania z Twojego bieżącego widoku są widoczne jako cienkie kreski (czyli po filtrze tylko zadania, które pokazuje filtr) i ramka wokół części, którą teraz widzisz.
3. Kliknij gdziekolwiek na pasie, aby ramkę tam przenieść. Okno wyśrodkuje się na tym miejscu. Albo chwyć ramkę i przeciągnij ją.

Minimapa przesuwa tylko zakres czasu. Wiersze zostają bez zmian.

Gdy widok podzielony jest włączony, każde okno dostaje własny pas, pod swoją częścią osi czasu. Każdy pas steruje tylko oknem nad nim.

## Pułapki i co robi aplikacja

**Minimapa nic nie robi, gdy cały projekt jest już widoczny.** Jeśli oddalisz widok tak bardzo, że cały harmonogram się mieści, nie ma dokąd przejść i kliknięcie nie daje efektu. Najpierw przybliż widok.

**Minimapa jest tylko w Gantt.** Na zakładkach *Tabela*, *IFC* i *Raport* oraz w pełnym panelu zasobów (*Zasoby*, nie *Dok zasobów*) nie ma osi czasu, więc też nie ma minimapy ani widoku podzielonego. Wracają, gdy wrócisz do widoku z wykresem Gantt.

**Widok podzielony należy do projektu, minimapa nie.** Widok podzielony dotyczy otwartego projektu: jeśli przełączysz się na inny projekt i wrócisz, nadal jest. Minimapa to jeden wybór dla wszystkich projektów i zostaje włączona lub wyłączona po ponownym uruchomieniu. Oba to wybory ekranu: nie trafiają do pliku projektu, nie oznaczają projektu jako „zmodyfikowany” i nie są objęte funkcją *Cofnij*.

**Widok podzielony i prezentacja.** Oba zostają widoczne, gdy włączysz tryb prezentacji (zobacz [Prezentowanie na dużym ekranie](docs://howto-presentatie)). Ponieważ wtedy wstążka znika, nie możesz ich w tym trybie włączyć ani wyłączyć. Ustaw je więc dobrze, zanim zaczniesz.

## Zobacz także

- [Prezentowanie na dużym ekranie](docs://howto-presentatie): pełny ekran Gantt, bez wstążki.
- [Tworzenie i używanie układu](docs://howto-layouts-gebruiken): skalę czasu można też zapisać jako część układu.
