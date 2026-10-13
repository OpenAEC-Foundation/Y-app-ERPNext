# Okna kalendarzy

Okno *Kalendarze* zarządza biblioteką kalendarzy projektu: jakie dni robocze, godziny pracy i dni wolne w nim są oraz który kalendarz jest kalendarzem projektu. Formularz obok listy jest taki sam jak w oknie *Kalendarz zasobu*. Ten artykuł opisuje dla każdego pola, co robi, jaka jest wartość domyślna i co z tego zauważysz. Jak utworzyć kalendarz i przypisać go zadaniom, opisano w [Tworzenie i przypisywanie kalendarza](docs://howto-kalender-maken-en-toewijzen); jak aplikacja liczy dni robocze, opisano w [Kalendarze i dni robocze](docs://uitleg-kalenders).

## Gdzie to znaleźć

- **Kalendarze** — *Planowanie › Kalendarz › Kalendarz* albo *Ustawienia › Kalendarz › Kalendarz*.
- **Kalendarz zadania** — pole *Kalendarz* w oknie *Edytuj zadanie* albo w panelu *Właściwości*. Zobacz [Okno zadania i panel właściwości](docs://ref-taak-eigenschappen).
- **Kalendarz zasobu** — w panelu *Zasoby*, kolumna *Kalendarz*: wybierz kalendarz, wybierz *+ Kalendarz zasobu*, aby utworzyć nowy, albo kliknij ołówek (*Edytuj…*) przy wybranym kalendarzu. Zobacz [Panel zasobów](docs://ref-resourcepaneel).

## Biblioteka w oknie Kalendarze

Po lewej stronie jest lista kalendarzy, po prawej formularz wybranego kalendarza. Kalendarz projektu ma gwiazdkę. Kalendarz z nieprawidłowymi danymi ma czerwony trójkąt (*Ten kalendarz zawiera nieprawidłowe dane*).

- **Nowy kalendarz** (plus) — dodaje kalendarz o nazwie *Nowy kalendarz* z domyślną zawartością aplikacji: od poniedziałku do piątku, 07:00 do 16:00, 8 godzin netto. Jeśli *Włącz tryb budowlany* jest włączone (domyślnie), kalendarz zawiera też holenderskie święta, bez urlopu budowlanego. Jeśli jest wyłączone, lista jest pusta. Jeśli nie chcesz tych świąt, wybierz *Generuj święta…*, a w nim *Bez świąt*. (Nazwy *Bouwkalender NL* i *Standaardkalender* zostają po holendersku we wszystkich językach.)
- **Duplikuj** — kopiuje wybrany kalendarz pod nazwą *{name} (kopia)*.
- **Usuń** (kosz) — usuwa wybrany kalendarz. Przycisk jest wyłączony, gdy zostaje tylko jeden kalendarz. Jeśli był to kalendarz projektu, pierwszy pozostały kalendarz staje się kalendarzem projektu. Zadania i zasoby, które używały tego kalendarza, wracają do kalendarza projektu.
- **Ustaw jako domyślny dla projektu** — zamienia wybrany kalendarz w kalendarz projektu. Na kalendarzu, który już nim jest, pojawia się *Kalendarz projektu* z gwiazdką. Skutek: każde zadanie bez własnego kalendarza liczy czas w tym kalendarzu, tak samo zasób bez własnego kalendarza. Zadanie, dla którego kalendarz ustawiono ręcznie, zachowuje go.
- **Zastosuj** — zapisuje wszystkie zmiany z całej listy w projekcie naraz, uruchamia przeliczenie harmonogramu i zamyka okno. Jeśli w sumie nic się nie zmieniło, przeliczenie nie następuje. Przycisk jest wyłączony, gdy w jednym z kalendarzy są nieprawidłowe dane. Enter w zwykłym polu tekstowym działa tak samo, ale okno zostaje otwarte.
- **Anuluj** — zamyka okno i odrzuca wszystko, co zmieniono od otwarcia (albo od ostatniego Enter). Esc i krzyżyk działają jak *Anuluj*. Kliknięcie obok okna nic nie robi, więc nie tracisz wpisanych danych.

Domyślnie projekt ma kalendarz *Bouwkalender NL* (tryb budowlany włączony) albo *Standaardkalender* (tryb budowlany wyłączony), z dniami od poniedziałku do piątku, 07:00 do 16:00.

## Formularz

### Podstawowe

- **Nazwa** — nazwa na liście i w listach rozwijanych dla zadań i zasobów.
- **Dni robocze** — przycisk dla każdego dnia tygodnia, od *Pon* do *Nd*. Wciśnięty przycisk oznacza dzień roboczy. Kolejność zależy od *Tydzień zaczyna się w* (*Ustawienia*, karta *Planowanie*). Domyślnie: od *Pon* do *Pt*. Dwa szybkie przyciski: *Pon–pt* ustawia dni od poniedziałku do piątku, 07:00 do 16:00, 8 godzin. Ustawiona przerwa wraca do domyślnej przerwy 12:00, 60 minut. *Ciągły (24/7)* ustawia wszystkie siedem dni, 00:00 do 24:00, 24 godziny. Skutek: zadanie pracuje tylko w dni robocze. Aplikacja nie może policzyć kalendarza bez dni roboczych (*W kalendarzu nie ustawiono dni roboczych*).
- **Początek (godz.)** i **Koniec (godz.)** — początek i koniec dnia roboczego, w formacie HH:MM, zapis 24-godzinny. Domyślnie: 07:00 i 16:00. Strzałki (albo klawisze strzałek) zmieniają wartość co 15 minut. Koniec może być 24:00, początek musi być wcześniejszy niż koniec. Skutek: razem z przerwą określają godziny netto na dzień. Nie liczą się przy datach zadania w dniach, liczą się przy zadaniach w godzinach. Te pola znikają, gdy *Włącz planowanie godzinowe* jest włączone i kalendarz ma godziny pracy dla poszczególnych dni tygodnia. Wtedy mają pierwszeństwo te godziny.
- **Początek przerwy** i **Czas trwania przerwy (minuty)** — początek i długość przerwy, z tym samym krokiem 15 minut. Domyślnie: 12:00 i 60 minut. Jeśli ustawisz czas trwania na 0, dzień roboczy jest ciągły. Przerwa musi leżeć w całości w dniu roboczym i nie może zająć całego dnia. Skutek: godziny netto to koniec minus początek minus przerwa. Przy zadaniu w godzinach w przerwie nie wykonuje się pracy. Te same pola znikają przy tym samym warunku co *Początek (godz.)*.
- **Godziny netto na dzień** — tylko do odczytu: wyliczona długość dnia roboczego, z dwoma miejscami po przecinku, na przykład *8,00 h*. Domyślnie: 8. Skutek: ta długość obowiązuje przy zamianie między dniami a godzinami i dla zadań w godzinach. Zobacz [Dni i godziny](docs://uitleg-dagen-en-uren).

### Godziny pracy

Ten blok jest widoczny tylko wtedy, gdy *Włącz planowanie godzinowe* jest włączone (*Ustawienia*, karta *Planowanie*). Tutaj ustawiasz godziny pracy i zmiany dla każdego dnia tygodnia. Zobacz [Ustawianie godzin pracy](docs://howto-werktijden-instellen).

- **Profile** — przyciski, które ustawiają godziny pracy naraz: *Zmiana dzienna* (Pon–pt 08:00 do 16:00, zwykły kalendarz dzienny), *2 zmiany* (Pon–pt 06:00 do 22:00, 16 godzin), *3 zmiany* (Pon–pt 06:00 do 06:00 następnego dnia, 24 godziny), *Zmiana nocna* (Pon–pt 22:00 do 06:00, 8 godzin) oraz *24/7* (wszystkie dni 00:00 do 24:00). Za wbudowanymi przyciskami znajdują się Twoje własne profile, z krzyżykiem do ich usunięcia.
- **Zapisz jako profil…** — zapisuje bieżące godziny pracy jako Twój własny profil na tym urządzeniu. Możesz go użyć w każdym projekcie. Podajesz nazwę (*Nazwa profilu*) i klikasz *Zapisz* albo *Anuluj*.
- **Ustaw per dzień tygodnia…** — zamienia kalendarz dzienny w kalendarz godzinowy: bieżące godziny stają się pasmami godzin pracy każdego dnia roboczego, a przerwa zostaje jako odstęp. Dla kalendarza godzinowego przycisk nazywa się *Ukryj godziny pracy* albo *Pokaż godziny pracy* i składa albo rozkłada edytor. Dla kalendarza godzinowego edytor jest domyślnie otwarty.
- **Edytor** — dla każdego dnia tygodnia lista bloków (*pasmo*) z godziną początku i końca. Zaznaczenie *następny dzień* pozwala pasmu przejść przez północ (zmiana nocna). *Dodaj pasmo* (plus) dodaje 08:00 do 16:00. *Kopiuj do wszystkich dni roboczych* (tylko przy Pon–pt) kopiuje pasma tego dnia na dni od poniedziałku do piątku. Dzień bez pasm nazywa się *Niepracujący*. Na dole jest *Wyliczone godziny/dzień:*. Gdy dzień ma więcej niż jedno pasmo, pojawia się podpowiedź *Przerwa między dwoma pasmami to pauza — dostosuj godziny według potrzeb*. Skutek: pasma mają pierwszeństwo. Dzień tygodnia z pasmami jest dniem roboczym, a pola *Początek (godz.)*, *Koniec (godz.)* i przerwa znikają.

### Dni wolne

- **Generuj święta…** — otwiera generator. *Kraj* wybiera *Holandia*, *Niemcy*, *Belgia*, *Francja*, *Wielka Brytania*, *Austria*, *Szwajcaria* albo *Bez świąt*. *Region* pojawia się tylko wtedy, gdy kraj ma regiony; domyślnie *Krajowe*. *Urlop budowlany* pojawia się tylko dla Holandii i gdy *Włącz tryb budowlany* jest włączone. Wybory to *Brak* (domyślnie), *Północ*, *Środek* i *Południe*, z podpowiedzią *Daty orientacyjne — zweryfikuj w Bouwend Nederland*. Wiersz podglądu pokazuje, ile świąt wpadnie (*… świąt, …–…*), i można go rozwinąć do listy. *Generuj* zapisuje wynik w edytowanym kalendarzu (liczy się dopiero po *Zastosuj*), *Anuluj* zamyka generator. Skutek: cała lista *Dni wolne* zostaje zastąpiona, także dni dodane ręcznie. Generator obejmuje lata od roku przed początkiem projektu do roku po końcu projektu włącznie (bez końca projektu: do trzech lat po początku). Zobacz [Generowanie świąt i urlopu budowlanego](docs://howto-feestdagen-genereren).
- **Wygeneruj ponownie** — pojawia się obok przycisku, gdy wygenerowane święta nie obejmują już okresu projektu. Pojawia się wtedy tekst *Święta obejmują …–…; projekt trwa do …. Wygenerować ponownie?* Kliknięcie generuje ten sam wybór (kraj, region, urlop budowlany) ponownie dla nowego okresu. Bez tego dni poza wygenerowanymi latami są zwykłymi dniami roboczymi.
- **Dni wolne** — lista dni wolnych: *Opis*, *Od* i *Do*, oraz kosz przy każdym wierszu. *Dodaj dzień wolny* dodaje wiersz z dzisiejszą datą jako *Od* i pustym *Do*. Puste *Do* oznacza jeden dzień. Bez wierszy pojawia się *Brak dni wolnych*. Skutek: wszystkie dni w okresie są dniami wolnymi od pracy w tym kalendarzu, dla zadań z tym kalendarzem i dla zasobów, które go używają. Błędny wiersz dostaje czerwoną ramkę i tekst (*Wpisz prawidłową datę początkową*, *Wpisz prawidłową datę końcową albo pozostaw ją pustą dla jednego dnia* lub *Data końcowa jest wcześniejsza niż data początkowa*) i blokuje *Zastosuj*.

### Komunikaty o błędach i wyjątki

Błędy w godzinach pracy pojawiają się pod polami i blokują *Zastosuj*: *Wprowadź prawidłową godzinę rozpoczęcia w formacie HH:MM*, *Wprowadź prawidłową godzinę zakończenia w formacie HH:MM*, *Godzina rozpoczęcia musi być wcześniejsza niż godzina zakończenia*, *Wprowadź prawidłową godzinę przerwy w formacie HH:MM*, *Czas musi być całkowitą liczbą minut nie mniejszą niż 0*, *Przerwa musi mieścić się w dniu pracy* i *Przerwa nie może zajmować całego dnia pracy*.

Kalendarz zna dni wolne wyłącznie jako wyjątki. Kalendarz z pliku MS Project albo Primavera może też mieć wyjątki robocze, czyli dodatkowe dni robocze. Okno ich nie pokazuje ani nie edytuje.

## Okno Kalendarz zasobu

- **Kalendarz zasobu** — formularz opisany wyżej, w oknie z tylko przyciskami *Zastosuj* i *Anuluj*. Esc i krzyżyk działają jak *Anuluj*. Kliknięcie obok okna nic nie robi, a Enter tutaj też nic nie robi. Edytujesz w nim jeden kalendarz: istniejący albo nowy, o domyślnej nazwie *Kalendarz zasobu*. Po *Zastosuj* kalendarz zostaje przypisany do zasobu (*Anuluj* nic nie zostawia). Jeśli otworzysz okno w widoku *Biblioteka* panelu zasobów, edytuje kalendarz w bibliotece. W widoku *Projekt* edytuje kalendarz projektu, nawet jeśli pochodzi z biblioteki. Skutek: kalendarz zasobu określa, kiedy zasób jest dostępny w histogramie, przy przeciążeniu i przy bilansowaniu. Nie zmienia dat zadania. *Zastosuj* nie uruchamia przeliczenia. Jeśli kalendarz jest też przypisany do zadań albo jest kalendarzem projektu, harmonogram się zmienia: zostaje oznaczony jako nieaktualny, a *Oblicz* wykonuje przeliczenie. Zobacz [Ustawianie kalendarza zasobu](docs://howto-resourcekalender-instellen).
