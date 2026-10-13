# Wybieranie reguły pracy

Cel: ustawić dla każdego zadania, co aplikacja dopasowuje, gdy zmienisz czas trwania, jednostki lub pracę: sam czas trwania, jednostki lub samą pracę.

## Kiedy tego potrzebujesz

Masz przydzielone zasoby do zadania i chcesz, aby aplikacja liczyła tak, jak sam to robisz. Jeden przykład: dźwig jest wynajęty na jeden dzień i ten dzień jest stały. Inny przykład: wiesz, że jest tam 160 godzin murowania, i chcesz zobaczyć, jak długo to potrwa z trzema osobami zamiast dwiema. Te dwie sytuacje wymagają innej reguły pracy.

Reguła pracy decyduje, która z trzech wielkości (czas trwania, jednostki i praca) zmienia się razem z inną, gdy zmienisz jedną z nich. Tło i przykłady z obliczeniami znajdziesz w [Reguły pracy: czas trwania, jednostki i praca](docs://uitleg-werkregels).

## Kroki

### Pokazywanie reguły pracy

Reguła pracy domyślnie nie jest widoczna. Włącz ją raz:

1. Wybierz *Ustawienia › Projekt › Ustawienia*, zakładka *Planowanie*.
2. Pod nagłówkiem *Obliczanie* zaznacz *Pokaż reguły pracy i pracę*.
3. Zamknij okno przyciskiem *Zamknij*.

To jest ustawienie aplikacji, a nie pliku projektu. Jeśli plik już zawiera reguły pracy lub zapisaną pracę, na przykład plik z MS Project lub Primavera P6, aplikacja pokazuje dla tego pliku regułę pracy także bez tego ustawienia. Tak samo jest, gdy sam wybierzesz regułę pracy w pliku: wtedy wyświetlanie pozostaje włączone dla tego pliku, nawet gdy później wyłączysz ustawienie. Pozostaje ono włączone, dopóki plik jest otwarty, a po ponownym otwarciu tak długo, jak plik zawiera regułę pracy lub zapisaną pracę.

### Wybieranie reguły

1. Zaznacz zadanie. Panel *Właściwości* jest po prawej stronie. Jeśli go nie widzisz, włącz go przez *Widok › Panele › Właściwości*.
2. W polu *Reguła pracy* wybierz jedną z pięciu opcji: *Domyślna dla projektu (Stały czas trwania i jednostki)*, *Stały czas trwania i jednostki*, *Stały czas trwania i praca*, *Stała praca* lub *Stałe jednostki*. Przy opcji *Domyślna dla projektu* zadanie podąża za domyślną regułą projektu.
3. Pod listą rozwijaną aplikacja pokazuje, co reguła chroni, na przykład *Chronione: praca (czas trwania zależy od jednostek)*.

*Domyślna dla projektu* to pierwsza opcja. Każde zadanie ma ją domyślnie. Reguła w nawiasie to reguła, którą projekt ma obecnie jako domyślną. Aplikacja nie ma przycisku do zmiany tej domyślnej reguły projektu. Pochodzi ona z importu (na przykład z MS Project lub Primavera P6) albo z połączenia MCP. Jeśli chcesz dla jednego zadania inną regułę, wybierz ją tutaj.

Regułę możesz też wybrać w tabeli. Kliknij **+** po prawej stronie nagłówka tabeli zadań (*Dodaj kolumnę*). W sekcji *Planowanie* wybierz kolumnę *Reguła pracy*.

Zadanie bez przydziału nie ma nic do powiązania, więc reguła tam nic nie robi. Najpierw przydziel zasób (zob. [Przydzielanie zasobów z krzywą](docs://howto-resource-toewijzen)).

### Podgląd i zmiana pracy

Dla zadania z przydziałami pojawia się w bloku *Przydziały* panelu *Właściwości* kolumna *Praca (pozost.)*, obok *Jedn./dzień*. To jest pozostała praca tego zasobu w godzinach. Mała kłódka nad kolumną pokazuje, co reguła utrzymuje stałe: *Jedn./dzień* przy *Stały czas trwania i jednostki* oraz przy *Stałe jednostki*, a *Praca (pozost.)* przy *Stały czas trwania i praca* oraz przy *Stała praca*.

Jeśli chcesz pracę zmienić sam, wpisz godziny w polu i naciśnij Enter. Aplikacja nie przyjmuje wartości 0 lub mniejszej. Pole wraca wtedy do poprzedniej wartości.

### Sprawdzanie skutków

Gdy wybierzesz regułę, żadna liczba jeszcze się nie zmienia. Przy regule chroniącej pracę aplikacja tylko zapisuje bieżącą pracę, więc *Praca (pozost.)* ma zapisaną wartość. Dopiero przy następnej zmianie reguła decyduje, co się przesunie. Zmień na przykład *Jedn./dzień* i zobacz, co się stanie z czasem trwania i pracą.

Jeśli to zmieni czas trwania zadania, pasek stanu pokaże *Nieaktualne — przelicz (F5)*. Naciśnij **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*, aby zobaczyć nowe daty. Gdy *Oblicz automatycznie* jest włączone (ta sama zakładka *Planowanie*, nagłówek *Obliczanie*), aplikacja robi to sama.

## Która reguła pasuje

- **Stały czas trwania i jednostki** pasuje, gdy czas trwania jest ustalony w umowie, a jednostki ustalasz Ty. Praca wynika z tych dwóch wartości. To jest domyślna reguła. Dźwig wynajęty na jeden dzień pasuje tutaj: dzień jest stały, a Ty decydujesz, ile dźwigów na nim jest.
- **Stały czas trwania i praca** pasuje, gdy zadanie musi zakończyć się w ustalonym okresie, a Ty wiesz, ile pracy jest w nim. Gdy czas trwania się zmieni, aplikacja dostosuje jednostki.
- **Stała praca** pasuje, gdy wiesz, ile godzin pracy jest w zadaniu, i chcesz zobaczyć, jak czas trwania zmienia się przy innej liczbie osób. Tu pasuje 160 godzin murowania z trzema osobami zamiast dwiema. Tynkowanie w projekcie ćwiczeniowym ma tę regułę.
- **Stałe jednostki** pasuje, gdy jednostki są stałe, na przykład jeden dźwig, a praca decyduje o czasie trwania.

## Pułapki i co wtedy robi aplikacja

**Brak pola *Reguła pracy*.** Wtedy ustawienie *Pokaż reguły pracy i pracę* jest wyłączone i plik nie ma jeszcze reguł pracy. Albo wybrano kamień milowy, fazę, hamak lub zadanie z typem czasu *czas, który upłynął*. Tam nie ma reguły pracy. Zaznacz zwykłe zadanie.

**Czas trwania zmienia się, choć go nie zmieniasz.** Przy regułach *Stała praca* i *Stałe jednostki* czas trwania wynika z jednostek i pracy. Jeśli zmienisz jedną z nich albo liczbę zasobów, aplikacja dostosuje czas trwania, zaokrąglony w górę do pełnych dni roboczych. Dla zadania w godzinach aplikacja zaokrągla w górę do pełnych minut.

**Praca nie zgadza się dokładnie z jednostkami × czasem trwania.** Może to wynikać z zaokrąglenia. Obok *Praca (pozost.)* pojawia się wtedy ostrzeżenie *Różni się od jednostek × czasu trwania*. Histogram uwzględnia zapisaną pracę.

**Materiał się nie liczy.** Dla zasobu materiałowego *Praca (pozost.)* pokazuje myślnik. Materiał nigdy nie decyduje o czasie trwania.

**Zadanie z postępem.** Reguła działa na pozostałej części. Dlatego *Praca (pozost.)* pokazuje tylko to, co jeszcze trzeba wykonać.

**Cofanie.** Wybór reguły i każda zmiana, którą reguła oblicza, to jeden krok dla *Cofnij* (Ctrl+Z). Reguła wtedy znika, ale pole *Reguła pracy* pozostaje widoczne.

## Zobacz także

- [Reguły pracy: czas trwania, jednostki i praca](docs://uitleg-werkregels): jak aplikacja łączy czas trwania, jednostki i pracę, z przykładami obliczeń.
- [Przydzielanie zasobów z krzywą](docs://howto-resource-toewijzen): dodawanie zasobu do zadania.
