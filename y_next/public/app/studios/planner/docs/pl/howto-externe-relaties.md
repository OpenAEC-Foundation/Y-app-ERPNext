# Relacje zewnętrzne do innego projektu

Cel: połącz zadanie w tym projekcie z zadaniem w innym pliku projektu. Twój harmonogram uwzględni dzięki temu pracę planowaną gdzie indziej.

## Kiedy tego potrzebujesz

Twoja rozbudowa może się zacząć dopiero wtedy, gdy teren jest przygotowany pod budowę. Ta praca jest w projekcie wykonawcy. Albo instalator może zacząć dopiero, gdy Twoja konstrukcja jest gotowa. On planuje we własnym pliku. Zwykła relacja działa tylko między zadaniami w tym samym projekcie. **Relacja zewnętrzna** łączy zadanie z zadaniem w innym pliku.

Relacja zewnętrzna nie oblicza się na żywo razem z drugim projektem. Aplikacja zapisuje stałą **datę zakotwiczenia**: datę zadania zewnętrznego w chwili, gdy je połączysz. Obliczenie używa tej daty jako granicy. Jeśli drugi projekt się zmieni, w Twoim nic się nie przesunie, dopóki nie odświeżysz zakotwiczenia.

## Kroki

1. Zaznacz dokładnie jedno zadanie w tym projekcie: zadanie, które zależy od zadania zewnętrznego, albo zadanie, od którego zależy zadanie zewnętrzne.
2. Wybierz *Start › Zadania › Połącz ▾ › Dodaj relację zewnętrzną…*. To samo menu jest w *Planowanie › Relacje* i w *Tabela › Zadania*. Pozycja jest dostępna tylko wtedy, gdy zaznaczone jest dokładnie jedno zadanie.
3. W oknie *Łącze zewnętrzne (między projektami)* wybierz jedną z dwóch dróg. Wybierając *Plik źródłowy*, wybierz plik projektu pod *Wybierz ostatni plik*, a potem *Zadanie źródłowe*. Aplikacja czyta plik tylko do odczytu. Nie otwiera go jako dokumentu i sama pobiera datę zakotwiczenia. Ta droga działa tylko w aplikacji na komputer i tylko dla pliku z listy ostatnich plików. W innym przypadku przycisk *Plik źródłowy* jest wyłączony. Wybierając *Ręcznie (rozwiązanie zastępcze)*, wpisujesz *Identyfikator projektu* i *Identyfikator zadania* zadania zewnętrznego, oraz, jeśli chcesz, *Nazwa zadania (opcjonalnie)* i *Data zakotwiczenia*. W wersji w przeglądarce jest to jedyna droga.
4. Pod *Kierunek* wybierz, czy zadanie zewnętrzne jest Twoim poprzednikiem, czy następnikiem: *Poprzednik (zewnętrzny → ja)* albo *Następnik (ja → zewnętrzny)*.
5. Wybierz *Typ relacji* (FS, SS, FF lub SF). Jeśli trzeba, wpisz *Opóźnienie (dni robocze)*, na przykład `0d` albo `2d`.
6. Kliknij *Dodaj łącze* i naciśnij **Oblicz** (F5).

Którą datę wpisujesz jako zakotwiczenie przy ręcznej relacji, zależy od kierunku i typu:

- Przy zewnętrznym **poprzedniku** liczy się pierwsza litera typu. F oznacza zakończenie zadania zewnętrznego, S rozpoczęcie. Przy FS i FF wpisujesz więc zakończenie, przy SS i SF rozpoczęcie.
- Przy zewnętrznym **następniku** liczy się druga litera. S to rozpoczęcie zadania zewnętrznego, F zakończenie. Przy FS i SS wpisujesz więc rozpoczęcie, przy FF i SF zakończenie.

Jeśli planujesz w godzinach (planowanie godzinowe włączone i zadanie w kalendarzu z godzinami pracy), pole *Data zakotwiczenia* wymaga też godziny.

Przykład: koniec projektu terenu budowy przypada w piątek 18 czerwca 2027 r. Połączysz zadanie *Groundwork* z zewnętrznym poprzednikiem typu FS, data zakotwiczenia 18 czerwca 2027 r. Po **Oblicz** zadanie *Groundwork* zaczyna się w poniedziałek 21 czerwca, pierwszy dzień roboczy po zakotwiczeniu. Zewnętrzny następnik działa odwrotnie: ogranicza, jak późno Twoje zadanie może się zakończyć.

## Co widzisz i jak tym zarządzasz

- Relacje zewnętrzne pojawiają się jako tekst w kolumnach *Poprzedniki* i *Następniki* tabeli zadań. Dodasz je przyciskiem **+** w nagłówku tabeli, pod *Relacje*. Widzisz nazwę projektu, nazwę zadania i typ. Mały trójkąt z *Brak źródła* pokazuje, że źródła nie odczytano. Najedź myszą na relację, aby zobaczyć projekt (wiersz *Identyfikator projektu* pokazuje nazwę projektu, gdy jest znana), *Identyfikator zadania*, datę zakotwiczenia i status źródła.
- Na wykresie Gantt widzisz szary, półprzezroczysty pasek przy zadaniu. Przy poprzedniku kończy się na dacie zakotwiczenia. Przy następniku zaczyna się na niej. Przerywana ramka z czerwoną etykietą *nieaktualne* oznacza, że źródło nie zostało odczytane. Przy ręcznej relacji dotyczy to zawsze.
- Kliknij prawym przyciskiem relację w kolumnie i wybierz *Edytuj relację zewnętrzną…* albo *Usuń relację*. Jeśli relacja ma plik źródłowy, jest tam też *Odśwież źródło*.
- Wybierz *Połącz ▾ › Odśwież wszystkie relacje zewnętrzne*, aby ponownie odczytać pliki źródłowe i zaktualizować zakotwiczenia. To działa tylko w aplikacji na komputer. Jeśli masz tylko ręczne relacje, aplikacja pokazuje *Brak źródeł zewnętrznych do odświeżenia (brak ścieżki pliku).* Po odświeżeniu naciśnij **Oblicz**.
- Jeśli zmienisz typ lub kierunek tak, że zakotwiczenie wymaga innej strony zadania zewnętrznego (rozpoczęcie zamiast zakończenia, albo odwrotnie), aplikacja przy ręcznej relacji prosi o nowe zakotwiczenie: *Wybierz nową kotwicę: typ relacji używa teraz drugiej strony zadania źródłowego.* Przy relacji z plikiem źródłowym aplikacja odczytuje zakotwiczenie sama ponownie.

## Pułapki i co robi aplikacja

**Inny projekt nie przesuwa się razem z Twoim.** Jeśli zadanie zewnętrzne zmieni datę, Twój harmonogram dalej oblicza na podstawie starego zakotwiczenia, dopóki go nie odświeżysz albo nie zmienisz. Przy ręcznej drodze zmieniasz datę zakotwiczenia sam. Kliknij prawym przyciskiem relację i wybierz *Edytuj relację zewnętrzną…*.

**Zewnętrzny poprzednik jest dolną granicą.** Jeśli Twoje zadanie zaczyna się później, niż wymaga zakotwiczenie, bo ma własnych poprzedników, wygrywa ta relacja. Zakotwiczenie tylko popycha.

**Zewnętrzny następnik jest górną granicą.** Jeśli zakotwiczenie jest zbyt ciasne, widzisz to jako ujemny zapas na Twoim zadaniu i na zadaniach przed nim. Osobne ostrzeżenie się nie pojawia, dlatego obserwuj kolumnę *Zapas całkowity*.

**Tylko stałe opóźnienie.** Dla relacji zewnętrznej nie podasz opóźnienia w dniach kalendarzowych ani w procentach. Aplikacja pisze *Relacje zewnętrzne obsługują tylko stałe opóźnienie w dniach lub czasie pracy.* Dni robocze liczą się w kalendarzu Twojego zadania. Opóźnienie w godzinach liczy się tylko dla zadania planowanego w godzinach. Dla zadania w dniach obliczenie je ignoruje. Użyj wtedy dni roboczych.

**Identyfikator projektu w innym pliku.** Identyfikator projektu nie jest w polu ani w kolumnie. Jest zapisany jako `InternalProjectId` w IFC tego projektu. Otwórz projekt, przejdź do zakładki *IFC* i wybierz *Generuj IFC*. Obliczenie używa tylko daty zakotwiczenia. Identyfikator nie jest zwykłą etykietą. Przy odświeżaniu aplikacja najpierw rozpoznaje plik źródłowy po identyfikatorze projektu, dopiero potem po ścieżce pliku. Jeśli przy ręcznej relacji wpiszesz ten sam identyfikator co plik źródłowy, relacja zostanie zaktualizowana, gdy ten plik się odświeży. Identyfikator zadania w innym projekcie znajdziesz w tabeli zadań tego projektu, w kolumnie *Identyfikator zadania* pod *Techniczne*.

## Zobacz też

- [Relacje i opóźnienie](docs://uitleg-relaties): jak aplikacja oblicza relację i opóźnienie.
- [Dodawanie relacji](docs://howto-relaties-leggen): relacje między zadaniami w tym samym projekcie.
- [Ograniczenia i terminy ostateczne](docs://uitleg-constraints): ograniczenia dat zadania, bez innego projektu.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): zawiera relację zewnętrzną przy *Car park paving* (zewnętrzny poprzednik).
