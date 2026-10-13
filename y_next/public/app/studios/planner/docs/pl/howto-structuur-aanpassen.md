# Dostosowywanie struktury

Cel: ułóż zadania w fazy i podzadania, zmień ich kolejność i zachowaj poprawne numery WBS.

## Kiedy tego potrzebujesz

Twój harmonogram to drzewo: fazy (zadania sumaryczne) z podzadaniami pod nimi, na przykład *Foundation* z *Groundwork*, *Reinforcement* i *Pouring*. Dostosowujesz to drzewo, gdy chcesz podpiąć zadania pod fazę, wyjąć z niej zadanie albo gdy kolejność jest błędna. **Kod WBS** (1, 1.1, 1.2, 2, …) to numer zadania w tym drzewie.

## Kroki

### Zwiększanie wcięcia zadania

1. Zaznacz zadanie. Można zaznaczyć także kilka zadań.
2. Wybierz *Planowanie › Struktura › Zwiększ wcięcie*. Możesz też użyć Alt+→ (lub Alt+Shift+→) albo *Wcięcie* w menu kontekstowym.

Zadanie staje się ostatnim podzadaniem poprzedniego zadania na tym samym poziomie. To poprzednie zadanie staje się przez to zadaniem sumarycznym. Jeśli zaznaczysz ciągły blok, cały blok zyskuje wcięcie razem. Jeśli zadanie nie ma poprzedniego zadania na tym samym poziomie, nic się nie dzieje i nie pojawia się komunikat.

### Zmniejszanie wcięcia zadania

Wybierz *Planowanie › Struktura › Zmniejsz wcięcie*, naciśnij Alt+← (lub Alt+Shift+←) albo wybierz *Usuń wcięcie* w menu kontekstowym.

Zadanie staje się zadaniem na tym samym poziomie co faza, zaraz po fazie, pod którą było podpięte. Jego podzadania przechodzą razem z nim. Zadania, które po nim były w tej fazie, pozostają w niej. Zadanie na najwyższym poziomie nie może zmniejszyć wcięcia bardziej.

### Przenoszenie zadania

Masz trzy sposoby.

- **Z klawiaturą.** Alt+↑ i Alt+↓ zamieniają zadanie z sąsiednim zadaniem na tym samym poziomie. Zadanie sumaryczne zabiera swoje podzadania ze sobą. Na początku lub na końcu poziomu nic się nie dzieje. Przy zaznaczeniu kilku zadań przesuwa się tylko zadanie, które kliknąłeś jako pierwsze.
- **Przeciąganie w tabeli zadań.** Naciśnij wiersz i przeciągnij go pionowo. Górna ćwiartka wiersza oznacza *przed*, dolna ćwiartka *po*. Środek zadania sumarycznego podpina przeciągnięte zadanie pod nim jako jego ostatnie podzadanie. Środek zwykłego zadania liczy się jako najbliższa krawędź. Jeśli przeciągniesz wiersz, który jest częścią zaznaczenia, przesuwa się całe zaznaczenie.
- **Przeciąganie w widoku Gantt.** Przeciągnij pasek pionowo do innego wiersza. Działa to tak samo jak przeciąganie w tabeli zadań i nie zmienia dat. Jeśli przeciągniesz poziomo, przesuniesz daty.

Każde przeniesienie to jeden krok dla *Cofnij* (Ctrl+Z).

### Utrzymywanie aktualnych numerów WBS

Spójrz na przycisk *WBS auto* w *Planowanie › Struktura*.

- **Włączone (domyślnie w nowym projekcie).** Aplikacja przenumerowuje całe drzewo przy każdym dodaniu, usunięciu i przeniesieniu. Kod WBS jest wtedy tylko do odczytu: nie możesz go wpisać w tabeli zadań ani w panelu *Właściwości*. *Przenumeruj WBS* jest wyłączone.
- **Wyłączone.** Kody zostają takie, jakie są, także po przeniesieniu i zmianie wcięcia. Wpisujesz je sam w kolumnie *WBS* albo w polu *Kod WBS* w panelu *Właściwości*. Możesz je też raz przenumerować poleceniem *Przenumeruj WBS*. To nadpisuje też kody, które sam wpisałeś.

Jeśli włączysz *WBS auto*, aplikacja od razu numeruje drzewo. Zarówno *WBS auto*, jak i *Przenumeruj WBS* można cofnąć poleceniem *Cofnij*.

## Pułapki i co robi aplikacja

**Filtrowanie, grupowanie lub sortowanie jest włączone.** Kolejność, którą widzisz, nie jest wtedy kolejnością harmonogramu, dlatego aplikacja blokuje strukturę. *Zwiększ wcięcie* i *Zmniejsz wcięcie* są wyłączone. Podpowiedź brzmi *Niedostępne podczas filtrowania/grupowania/sortowania*. Alt+→ i przeciąganie pokazują ten sam tekst w komunikacie z przyciskiem *Wyczyść*. Ten przycisk usuwa naraz filtr, grupowanie i sortowanie, a Ctrl+Z ich nie przywraca. Wtedy w menu kontekstowym brakuje poleceń *Wcięcie* i *Usuń wcięcie*.

Alt+↑ i Alt+↓ w takim widoku działają, bez komunikatu. Przy samym filtrze widzisz nową kolejność od razu. Przy sortowaniu kolejność w harmonogramie się zmienia, ale widzisz to dopiero po *Wyczyść*.

**WBS auto jest wyłączone.** Nowe zadanie dostaje kod, który pasuje do jego miejsca w drzewie, nawet jeśli inne zadanie ma już ten kod. W ten sposób mogą pojawić się zduplikowane numery. Również po zmianie wcięcia kody przestają pasować do drzewa. *Przenumeruj WBS* naprawia oba problemy.

**Kamień milowy dostaje podzadania.** Kamień milowy to chwila i nie ma podzadań. Aplikacja usuwa znacznik kamienia milowego i informuje cię o tym.

**Zadanie z przydziałami zasobów dostaje podzadania.** Zadanie sumaryczne nie ma własnych przydziałów. Aplikacja przenosi je do pierwszego nowego podzadania, które może je przyjąć, i informuje cię o tym. Jeśli takiego podzadania nie ma albo ma już ten sam zasób, nic się nie dzieje, a komunikat wyjaśnia dlaczego.

**Relacja utworzyłaby cykl.** Relacje zadania sumarycznego dotyczą też jego podzadań. Jeśli przeniesienie przez to utworzyłoby cykl, aplikacja odmawia i pokazuje komunikat *To przeniesienie utworzyłoby cykl w harmonogramie (…)*. Nic się nie zmienia.

**Relacja między zadaniem a jego fazą.** Jeśli podepniesz zadanie pod fazę, z którą ma już relację, ta relacja zostaje, ale przestaje wchodzić do obliczeń. Aplikacja informuje cię o tym. Więcej o relacjach zadań sumarycznych przeczytasz w [Relacje i opóźnienia](docs://uitleg-relaties).

**Harmonogram jest nieaktualny.** Przeniesienie do innej fazy może zmienić daty. Naciśnij **Oblicz** (F5). Samo zamienienie kolejności w tej samej fazie nie zmienia dat.

## Zobacz także

- [Dodawanie zadań i kamieni milowych](docs://howto-taken-en-mijlpalen-toevoegen): umieść nowe zadania we właściwym miejscu.
- [Zapisywanie i wstawianie szablonów WBS](docs://howto-wbs-sjablonen): użyj ponownie całej fazy.
- [Dodawanie relacji](docs://howto-relaties-leggen): połącz zadania ze sobą.
- [Zaznaczanie, usuwanie i cofanie zadań](docs://howto-taken-selecteren-verwijderen): cofnij przeniesienie.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): cztery fazy z podzadaniami, zbudowane przez zwiększanie wcięcia.
