# Ustawianie kalendarza zasobu

Cel: zapisać, w które dni zasób jest dostępny, aby histogram, przeciążenie i bilansowanie korzystały z tego przy obliczeniach.

## Kiedy tego potrzebujesz

Ekipa murarzy pracuje tylko od poniedziałku do czwartku. Dźwig pracuje w innym projekcie w pierwszych dwóch tygodniach sierpnia. Podwykonawca ma cztery stałe dni robocze. Bez własnego kalendarza aplikacja zakłada, że zasób pracuje w dniach kalendarza projektu.

Kalendarz zasobu nie zmienia żadnej daty zadania. Określa tylko, kiedy zasób jest dostępny. Jeśli zadanie przypada na dzień, w którym zasób nie pracuje, zdolność tego dnia wynosi 0 i dzień liczy się jako przeciążenie. Jeśli zadanie ma działać w innych dniach, nadaj mu własny kalendarz ([Tworzenie i przypisywanie kalendarza](docs://howto-kalender-maken-en-toewijzen)). Różnicę opisuje [Kalendarze i dni robocze](docs://uitleg-kalenders).

## Kroki

### Tworzenie nowego kalendarza zasobu

1. Wybierz *Zasoby › Zarządzaj › Zasoby*. Otwiera się panel zasobów. Jeśli zasobu jeszcze nie ma, utwórz go przyciskiem *Nowy zasób w projekcie*.
2. Znajdź wiersz zasobu. W kolumnie *Kalendarz* domyślnie jest *Kalendarz projektu*: zasób wtedy korzysta z kalendarza projektu.
3. Na tej liście wybierz *+ Kalendarz zasobu*. Otwiera się okno *Kalendarz zasobu*. Ma te same pola co formularz kalendarza: *Nazwa*, *Dni robocze*, godziny pracy i *Dni wolne*. Nowy kalendarz zaczyna jako kopię kalendarza standardowego i nazywa się *Kalendarz zasobu*.
4. Nadaj kalendarzowi nazwę, która pasuje do zasobu, na przykład *Crew Mon–Thu*, i ustaw dni robocze: kliknij piątek, aby go wyłączyć, pod *Dni robocze*. Święta lub przestoje wpisujesz na liście *Dni wolne* przyciskiem *Dodaj dzień wolny*.
5. Kliknij *Zastosuj*. Kalendarz jest teraz w bibliotece kalendarzy projektu i powiązany z zasobem, w jednym kroku. Ten krok cofasz przyciskiem *Cofnij*. Przy *Anuluj* nic nie zostaje utworzone.

### Wybieranie lub zmiana istniejącego kalendarza

W kolumnie *Kalendarz* wybierz kalendarz z listy. Wybór *Kalendarz projektu* usuwa z powrotem własny kalendarz. Jeśli chcesz zmienić wybrany kalendarz, kliknij ołówek obok listy (*Edytuj…*). Otwiera się okno *Kalendarz zasobu* z bieżącym kalendarzem.

### Sprawdzanie wyniku

1. Jeśli pasek stanu pokazuje *Nieaktualne — przelicz (F5)*, naciśnij **Oblicz** (F5).
2. Wybierz *Zasoby › Histogram › Histogram* i kliknij zasób na liście po lewej stronie histogramu. Dni, w których zasób nie pracuje, ale jest zaplanowany, są czerwone. Jeśli najedziesz myszą na taki dzień, słupek podaje na przykład: *Nie pracuje w tym dniu według kalendarza „Crew Mon–Thu”*.
3. Pod *Zasoby › Nadmierne przydzielenie* znajdziesz liczbę przeciążonych zasobów, a pasek stanu podaje na przykład: *Przeciążone zasoby: 1*.

## Pułapki i co wtedy robi aplikacja

**Liczą się tylko dni, nie godziny.** Kalendarz zasobu określa, w które dni zasób pracuje. Ile jednostek jest tego dnia dostępnych, zależy od pola *Maks. jednostki* zasobu, a nie od godzin pracy w kalendarzu.

**Bilansowanie nie zawsze to rozwiązuje.** Jeśli nie ma okresu, w którym każdy dzień zadania przypada na dzień roboczy zasobu, przesunięcie nie pomaga. Wybierz *Zasoby › Bilansowanie › Bilansuj…* i kliknij *Oblicz*. Zadanie pojawia się wtedy pod *Pozostałe konflikty* z przyczyną *Zasób nie pracuje we wszystkie dni potrzebne temu zadaniu — przesunięcie tego nie rozwiąże.* Przypisz wtedy zadanie do innego zasobu albo nadaj mu własny kalendarz.

**Wspólny kalendarz.** Lista pokazuje wszystkie kalendarze projektu, więc także *Kalendarz projektu* i kalendarze zadań. Jeśli zmienisz taki kalendarz przez ikonę ołówka, zmieni się też harmonogram zadań, które go używają, a pasek stanu pokaże *Nieaktualne — przelicz (F5)*. Lepiej utwórz dla zasobu osobny kalendarz.

**Przeciążenie nie zawsze wynika z kalendarza.** Zasób, który pracuje każdego dnia, może też być przeciążony: podpowiedź wspomina o kalendarzu tylko wtedy, gdy dzień nie jest dniem roboczym zasobu.

## Zobacz także

- [Kalendarze i dni robocze](docs://uitleg-kalenders): dlaczego kalendarz zasobu nie przesuwa żadnych dat.
- [Tworzenie i przypisywanie kalendarza](docs://howto-kalender-maken-en-toewijzen): pola formularza kalendarza.
- [Generowanie świąt i urlopu budowlanego](docs://howto-feestdagen-genereren): wpisywanie świąt i przestojów do kalendarza.
- [Okna kalendarza](docs://ref-kalenders): wszystkie pola okien kalendarza.
