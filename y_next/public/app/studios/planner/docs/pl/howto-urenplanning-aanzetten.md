# Włączanie planowania godzinowego

Cel: planować zadania w godzinach pracy, obok zadań w dniach.

## Kiedy jest to potrzebne

Dźwig wynajmujesz na godziny, nie na dni. Wylewanie trwające sześć godzin nie wypełnia całego dnia roboczego. Ekipa nocna pracuje o innych porach niż ekipa dzienna. Do takiej pracy chcesz czas trwania w godzinach oraz początek i zakończenie o konkretnej godzinie. Włączasz to również wtedy, gdy otworzysz plik, a aplikacja zgłasza *Ten plik zawiera planowanie godzinowe.* Dlaczego aplikacja liczy dni i godziny inaczej, przeczytasz w [Dni i godziny](docs://uitleg-dagen-en-uren).

## Kroki

### Aktywacja planowania godzinowego

1. Wybierz *Ustawienia › Projekt › Ustawienia* i otwórz kartę *Planowanie*.
2. Pod *Planowanie godzinowe* zaznacz *Włącz planowanie godzinowe*. Działa to od razu. W komunikacie *Ten plik zawiera planowanie godzinowe.* przycisk *Włącz planowanie godzinowe* robi to samo.
3. Poniżej znajduje się *Zezwól na mieszane planowanie dniowo-godzinowe*, domyślnie włączone. Dzięki temu wybierasz dla każdego zadania osobno, czy liczy się w dniach, czy w godzinach. Gdy to wyłączysz, lista *Jednostka czasu trwania* zniknie. Czas trwania możesz wtedy nadal wpisać z jednostką, na przykład `12h`.

To zmienia więcej niż czas trwania zadania: w *Widok › Skala czasu* możesz wybrać skalę *Godzina*, w oknie *Kalendarze* pojawia się blok *Godziny pracy*, a w oknie *Nowy projekt* pojawiają się opcje *Zmiana* i *Domyślna jednostka nowych zadań*.

### Planowanie zadania godzinowego

1. Wybierz zadanie i spójrz w panel *Właściwości*, pod *Czas*, na pole *Czas trwania*.
2. Wpisz czas trwania z jednostką i naciśnij Enter: `12h` (`12u`, niderlandzki skrót, też działa) to dwanaście godzin, `1h 30m` to półtorej godziny. `1.5h` też jest poprawne. Liczba bez jednostki liczy się w jednostce, którą zadanie już ma.
3. Jeśli chcesz istniejące zadanie przeliczyć, wybierz jednostkę *Godziny* pod *Jednostka czasu trwania*. Aplikacja od razu przelicza czas trwania, na przykład z `2` dni na `16` godzin. Aby wrócić, użyj *Cofnij*.
4. Powrót do dni jest możliwy z `2d` albo z jednostką *Dni*.
5. Naciśnij **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*. Zadanie ma teraz początek i zakończenie o konkretnej godzinie.
6. Gdy chcesz zobaczyć godziny w Gantt, wybierz skalę *Godzina* na liście pod *Widok › Skala czasu*.

### Nowe zadania domyślnie w godzinach

1. Wybierz *Ustawienia › Projekt › Info o projekcie*.
2. Pod *Domyślna jednostka nowych zadań* wybierz jednostkę *Godziny* i kliknij *Zastosuj*.

Nowe zadanie ma wtedy 5 godzin zamiast 5 dni. Istniejące zadania się nie zmieniają. Przy nowym projekcie ta sama opcja jest w oknie *Nowy projekt*. Jeśli tam pod *Zmiana* wybierzesz *Zmiana dzienna*, opcja *Godziny* jest wyłączona. Wybierz inną zmianę albo ustaw domyślną jednostkę po utworzeniu projektu w oknie *Info o projekcie*.

## Pułapki i co wtedy robi aplikacja

**Brak prawidłowych godzin pracy.** Jeśli kalendarz zadania nie ma użytecznych godzin pracy, aplikacja zgłasza *Ten kalendarz nie ma prawidłowych godzin pracy. Sprawdź dni i godziny pracy.* Przy obliczaniu może się pojawić komunikat *Zadanie godzinowe 'name' nie ma prawidłowych godzin pracy w swoim kalendarzu.*

**Brak ułamków przy dniach.** Czas trwania w dniach to całkowita liczba. `1.5d` daje komunikat *Wprowadź całkowitą liczbę dni lub godzin, na przykład 2d albo 12h.* Jeśli chcesz półtora dnia, planuj w godzinach.

**Przeliczenie, którego nie da się zrobić dokładnie.** Dwanaście godzin nie mieści się w całych dniach po 8 godzin. Aplikacja zgłasza wtedy *Tego czasu nie można dokładnie przeliczyć na całe dni w bieżącym kalendarzu. Dotychczasowa jednostka pozostaje; wprowadź nową prawidłową wartość.* i nie zmienia jednostki.

**Pole jest wyłączone.** Dla fazy, hamaka albo kamienia milowego o zerowym czasie trwania czas trwania wynika z czegoś innego i nie możesz go wpisać.

**Ponowne wyłączenie planowania godzinowego.** Zadania godzinowe zostają i nadal są obliczane. Ich czasu trwania wtedy nie można edytować; pole mówi *Włącz planowanie godzinowe, aby edytować to zadanie godzinowe.*, z przyciskiem do ponownego włączenia.

## Zobacz też

- [Dni i godziny](docs://uitleg-dagen-en-uren): jak aplikacja liczy godziny, co się dzieje, gdy spotykają się dni i godziny, i gdzie zaokrągla.
- [Ustawianie godzin pracy](docs://howto-werktijden-instellen): godziny kalendarza na każdy dzień tygodnia.
- [Dodawanie relacji](docs://howto-relaties-leggen): opóźnienie w godzinach między dwoma zadaniami.
- [Ustawienia](docs://ref-instellingen): ustawienie Włącz planowanie godzinowe i co jeszcze zmienia.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): zawiera zadania godzinowe (zbrojenie i betonowanie) z własnym kalendarzem godzinowym, *Hourly calendar, rebar fixing & pouring*.
