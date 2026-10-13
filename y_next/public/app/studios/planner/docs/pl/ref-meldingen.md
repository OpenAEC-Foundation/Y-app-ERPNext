# Powiadomienia i ostrzeżenia

Aplikacja informuje Cię, co się dzieje, na trzech miejscach: w pasku stanu na dole, w panelu *Ostrzeżenia* w prawej kolumnie oraz w powiadomieniach, które na krótko pojawiają się na dole ekranu. Ten artykuł opisuje dla każdego miejsca, co widzisz, kiedy się pojawia i co możesz z tym zrobić. Dlaczego zadanie w harmonogramie jest krytyczne albo zasób przeciążony, opisano w [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad); rozwiązywanie przeciążenia opisano w [Rozwiązywanie przeciążenia](docs://howto-overbezetting-oplossen); tworzenie relacji opisano w [Tworzenie relacji](docs://howto-relaties-leggen).

## Różnica między trzema

- **Pasek stanu** — stała linia z licznikami. Pochodzą z ostatniego obliczenia i zostają, aż ponownie obliczysz.
- **Panel ostrzeżeń** — lista za tymi licznikami. Zawiera wszystko, co znalazło ostatnie obliczenie. Kliknięcie przenosi Cię do zadania, relacji lub zasobu. Lista pochodzi z ostatniego obliczenia; nic nie jest zapisywane.
- **Powiadomienia** — krótkie komunikaty o czymś, co właśnie wykonano (zapis się nie powiódł, relacja odrzucona, import odczytany). Znikają same i nie ma ich w panelu.

## Pasek stanu

Pasek na dole pokazuje od lewej do prawej:

- **Zadania:** — liczba zadań liściowych (zadania sumaryczne się nie liczą).
- **Kamienie milowe:** — liczba kamieni milowych.
- **Ścieżka krytyczna: N zadań, N dni roboczych** — liczba zadań krytycznych i czas trwania projektu. Widoczne tylko po obliczeniu.
- **Koniec:** — koniec projektu z ostatniego obliczenia. Widoczne tylko po obliczeniu. Pusty projekt nie ma końca.
- **N terminów ostatecznych przekroczonych**, **N ograniczeń naruszonych**, **N relacji z postępem poza kolejnością** i **N zasobów przeciążonych** — każdy jako przycisk z ikoną ostrzeżenia. Widoczny tylko wtedy, gdy licznik jest większy niż 0 i istnieje obliczenie. Kliknięcie otwiera panel *Ostrzeżenia* (podpowiedź: *Otwórz panel ostrzeżeń (szczegóły i nawigacja)*). Jeśli jesteś na karcie *IFC* lub *Raport*, aplikacja jednocześnie przechodzi na *Start*, ponieważ prawa kolumna tam nie istnieje. Licznik *zasobów przeciążonych* odświeża się też po zmianach zasobów i przydziałów. Pozostałe liczniki zmieniają się dopiero po kliknięciu przycisku *Oblicz*. Te cztery liczniki to tylko wybór. To, co panel pokazuje dodatkowo (obcięte wyprzedzenie, zignorowana relacja, hamak bez drivera końca, ograniczona data zakończenia, błąd harmonogramu), nie jest na pasku stanu.
- **Nieaktualny — przelicz (F5)** — z ikoną ostrzeżenia (podpowiedź: *Harmonogram nieaktualny — przelicz (F5)*). Widoczne, gdy zmienisz coś, co wpływa na harmonogram, i jeszcze go nie przeliczono. Jeśli włączono *Oblicz automatycznie*, nie pojawia się, chyba że obliczenie dało błąd. Wtedy zostaje.
- **Zaznaczenie: N zadań** — liczba zaznaczonych zadań. Widoczne tylko przy zaznaczeniu.
- **Skala:** i **Zoom: Npx/dzień** — skala czasu na osi czasu i poziom zoomu. Skala zależy od zoomu.
- **Niezapisane** — dopóki dokument zawiera zmiany, których nie ma w pliku.
- **AI** — kolorowa kropka z napisem AI, tylko gdy tryb AI jest włączony. Podpowiedź zaczyna się od *Most AI:* i pokazuje *Wyłączony*, *Aktywny na porcie N*, *Port N zajęty* albo *Błąd*. Kliknięcie otwiera kartę *AI*.
- **Terminal debugowania** — przycisk terminala, tylko gdy terminal debugowania jest włączony. Pokazuje lub ukrywa terminal (*Pokaż terminal debugowania* / *Ukryj terminal debugowania*).

## Panel ostrzeżeń

- **Otwieranie** — *Planowanie › Harmonogram › Ostrzeżenia*, *Widok › Panele › Ostrzeżenia* albo licznik na pasku stanu. Panel znajduje się w prawej kolumnie, pod panelem *Właściwości* i dokiem zasobów, i rozwija zwiniętą kolumnę. Domyślnie jest zamknięty i nie jest zapamiętywany między sesjami. Wysokość przeciągasz za krawędź, gdy panel stoi pod innymi panelami. Ta wysokość jest zapamiętywana. Krzyżyk w prawym górnym rogu zamyka panel (*Zamknij ostrzeżenia*).
- **Wiersz nagłówka** — *Błędy: N, ostrzeżenia: N*. Jeśli jeszcze nic nie obliczono, pojawia się: *Jeszcze nie obliczono — naciśnij Oblicz (F5), aby uruchomić kontrole.*
- ***Oblicz*** — przycisk w wierszu nagłówka. Widoczny, dopóki harmonogram jest nieaktualny albo jeszcze nie obliczony. Robi to samo co *Oblicz* na wstążce.
- **Ikona ostrzeżenia w wierszu nagłówka** — gdy harmonogram jest nieaktualny. Podpowiedź: *Harmonogram nieaktualny — ta lista pochodzi z ostatniego obliczenia. Przelicz (F5)*. Lista nie jest ukryta, tylko oznaczona jako nieaktualna.
- **Pusta lista** — *Brak ostrzeżeń. Harmonogram przechodzi wszystkie kontrole.*
- **Wiersz** — na górze miejsce (zadanie, relacja, zasób albo projekt), a pod nim opis. Błąd ma własny ośmiokątny znak, ostrzeżenie trójkątny. Zadanie pojawia się jako `nazwa WBS`. Relacja pojawia się jako `poprzednik → następnik (FS+2d)`, z typem i opóźnieniem. Kliknięcie przenosi do miejsca (podpowiedź *Przejdź do: …*), zobacz niżej. Wiersz, który należy do aktywnego zadania (dla relacji: do jej następnika) albo do zasobu wybranego w histogramie, jest podświetlony.
- **Kolejność** — najpierw błędy. Potem według rodzaju, w kolejności poniższej listy. W obrębie rodzaju w kolejności dokumentu (dla relacji: kolejność następnika, dla zasobu: kolejność listy zasobów). Zadanie, relacja albo zasób usunięty po ostatnim obliczeniu znika z listy.

### Rodzaje ostrzeżeń

- **Błąd harmonogramu** — *Nie można obliczyć harmonogramu: …* z przyczyną za dwukropkiem, zobacz niżej. Kliknięcie: przy cyklu aplikacja zaznacza wszystkie zadania w cyklu i przechodzi do pierwszego. Przy innych błędach nie ma dokąd przejść, a wiersz nie jest przyciskiem.
- **Przekroczony termin** — *Przekroczono termin {date} — najwcześniejsze zakończenie {date}*. Zadanie ma termin ostateczny, a obliczenie go nie spełnia. Kliknięcie przenosi do zadania. Naprawa: zmień logikę albo czas trwania, albo przesuń termin ostateczny.
- **Naruszone ograniczenie** — *Ograniczenie {typ i data} jest nadpisywane przez logikę (ujemny zapas)*. Ograniczenia nie da się spełnić bez złamania logiki, a zapas jest ujemny. Kliknięcie przenosi do zadania. Zobacz [Ograniczenia](docs://uitleg-constraints).
- **Poza kolejnością** — *Poza kolejnością: postęp następnika przeczy relacji*. Postęp następnika nie pasuje do typu relacji. Na przykład następnik jest już w toku, a poprzednik przy relacji zakończenie-rozpoczęcie nie jest jeszcze gotowy. Kliknięcie zaznacza oba zadania, z aktywnym następnikiem. Sprawdź rzeczywiste daty albo relację.
- **Obcięte wyprzedzenie** — *Wyprzedzenie obcięte przez start projektu — relacja nie jest w pełni zachowana*. Wyprzedzenie (ujemne opóźnienie) relacji sięga przed początek projektu. Kliknięcie zaznacza oba zadania.
- **Zignorowana relacja** — *Relacja zignorowana: brakuje poprzednika lub następnika albo nie jest zadaniem liściem*. Obliczenie nie używa tej relacji. Kliknięcie zaznacza zadania, które jeszcze istnieją. Zobacz [Relacje](docs://uitleg-relaties).
- **Hamak bez sterownika końca** — *Hamak bez sterownika końca (brak poprzednika FF/SF): czas trwania spada do zera*. Kliknięcie przenosi do zadania. Zobacz [Zadania hamakowe](docs://howto-hammock).
- **Ograniczona data zakończenia** — *Data zakończenia obcięta: kalendarz nie zostawia dla tego zadania żadnego roboczego okna*. Obliczenie trafiło w limit dni, które przeszukuje. Na przykład z powodu bardzo długiego, nieprzerwanego ciągu dni wolnych w kalendarzu. Kliknięcie przenosi do zadania. Zobacz [Kalendarze i dni robocze](docs://uitleg-kalenders).
- **Przeciążenie** — *Przeciążenie przez N dni (pierwszy – ostatni)*, z dodatkiem *zasób nie pracuje tych dni według swojego kalendarza*, jeśli wszystkie dni są dniami wolnymi. Przy mieszance dodatek brzmi *z czego N dni zasób nie pracuje według swojego kalendarza*. Kliknięcie zaznacza zadania z przydziałem tego zasobu, włącza histogram i wybiera w nim ten zasób. Z kart *Tabela*, *IFC* lub *Raport* aplikacja przechodzi do panelu *Zasoby*. Zobacz [Panel zasobów](docs://ref-resourcepaneel).

### Przyczyny błędu harmonogramu

- *Zależność cykliczna między zadaniami: {ścieżka}* — relacje tworzą cykl. Zadania są w tym ciągu. Odwróć albo usuń jedną relację.
- *W kalendarzu nie ustawiono dni roboczych* — daj kalendarzowi co najmniej jeden dzień roboczy. Zobacz [Okna kalendarza](docs://ref-kalenders).
- *Nieprawidłowy czas trwania w dniach dla zadania '{zadanie}'* i *Nieprawidłowy czas trwania w godzinach dla zadania '{zadanie}'* — czas trwania zadania nie jest prawidłową liczbą.
- *Zadanie godzinowe '{zadanie}' nie ma prawidłowych godzin pracy w swoim kalendarzu* — zadanie godzinowe w kalendarzu bez godzin pracy.
- *Nieprawidłowa data rozpoczęcia dla zadania '{zadanie}'* — data rozpoczęcia zadania nie jest prawidłowa.

## Powiadomienia

Powiadomienia pojawiają się na dole ekranu. Pojawiają się też w tabeli, w Backstage i w trybie prezentacji. Powiadomienie to *błąd* albo *info*. Błąd zostaje, dopóki go nie zamkniesz kliknięciem. Info znika po 5 sekundach. Te czasy zaczynają się od nowa, gdy zmienia się stos. Kliknięcie powiadomienia je zamyka (podpowiedź *Zamknij powiadomienie*). Naraz widać najwyżej trzy powiadomienia. Gdy przyjdzie czwarte, najpierw znika najstarsze *info*. Gdy *info* nie ma, znika najstarsze powiadomienie. Dzięki temu błąd nigdy nie ustąpi miejsca *info*. Stos przesuwa się z dala od przycisków otwartego okna dialogowego i od przyklejonych pasków akcji.

- **Licznik ×N** — powiadomienie ze stałym kluczem składa powtórki w jedną linię z licznikiem, na przykład błąd zapisu, który wraca, albo odrzuconą relację, którą powtarzasz. Nie każde powiadomienie tak robi.
- **Dowiedz się więcej** — niektóre powiadomienia mają link *Dowiedz się więcej* albo własny temat (na przykład *Reguły pracy – wyjaśnienie*). Prowadzi on do przewodnika w Backstage › Pomoc.
- **Przycisk akcji** — powiadomienie o profilu obliczeń ma przycisk *Otwórz profil obliczeń*, który prowadzi do Info o projekcie.

Poniższa lista to wybór, pogrupowany według tematu. Jeśli tekst nie mówi inaczej, to *info*.

### Zapisywanie, otwieranie i odzyskiwanie

- **Zapisywanie nie powiodło się** (błąd) — *Nie udało się zapisać* z powodem pod spodem. Przy zapisywaniu, zapisywaniu jako i eksportowaniu raportu.
- **Zapisano jako pobranie** (info) — *Zapisano jako pobranie: '{name}' jest teraz w folderze Pobrane. …* Przy *Zapisz jako* i eksportach, gdy środowisko nie pozwala aplikacji zapisać bezpośrednio w wybranym miejscu. Dwa pobrania zaraz po sobie łączą się w jedno.
- **Zapisano jako pobranie (wyjaśnienie)** (info) — *Zapisano jako pobranie: '{name}' jest w folderze Pobrane. Ta przeglądarka nie pozwala aplikacji zapisywać we własnym miejscu, …* Przy *Zapisz* w przeglądarce, która zapisuje tylko przez pobieranie. Raz na sesję, z linkiem do wyjaśnienia o plikach.
- **Przeglądarka nie zapisuje z powrotem** (info) — *Ta przeglądarka nie pozwala aplikacji zapisać z powrotem do '{name}'. …* Przy *Zapisz* projektu, który ma plik, gdy przeglądarka musi znowu zapytać o miejsce. Raz na sesję, z linkiem do wyjaśnienia o plikach.
- **Autozapis nie powiódł się** (błąd) — *Błąd autozapisu* z powodem. Dotyczy autozapisu do pliku i odzyskiwania po awarii.
- **Nie można zapisać biblioteki** (błąd) — *Nie można było zapisać biblioteki*, przy zapisywaniu biblioteki zasobów.
- **Otwieranie pliku nie powiodło się** (błąd) — *Nie udało się otworzyć pliku* z powodem. Na przykład ostatni plik albo zaimportowany plik.
- **Stary lub chroniony .mpp** (błąd) — *Ten plik .mpp używa starszego formatu (Project 2007 lub wcześniejszego)…* albo *Ten plik .mpp jest chroniony hasłem…*. Obie wersje mają radę: wyeksportuj plik jako XML w MS Project i otwórz ten plik.
- **Nieprawidłowy plik XER** (błąd) — jeden z tekstów *XER…*, na przykład *Ten plik XER jest nieprawidłowy lub nieobsługiwany.* albo *Plik XER zawiera zduplikowaną tabelę.*, z dodanym powodem.
- **Nie można odczytać IFC** (błąd) — *Nie udało się odczytać pliku IFC* z powodem, w widoku IFC.
- **Odzyskiwanie** (błąd) — *Nie udało się odczytać odzyskanego pliku*, *Nie udało się przywrócić* i *N plików odzyskiwania nie mogło zostać wczytanych i zostało pominiętych.* Przy odzyskiwaniu po nieoczekiwanym zamknięciu aplikacji.
- **Gałąź zapisana jako szablon** (info) — *Gałąź zapisana jako szablon '{name}'*.
- **Komunikat z rozszerzenia** (info, albo błąd, gdy rozszerzenie zgłasza błąd) — *Rozszerzenie {name}: {message}*. Rozszerzenie może pokazać najwyżej trzy nowe komunikaty w ciągu 10 sekund, więc stos się nie zapełnia. Gdy krok przewodnika rozszerzenia się nie powiedzie, pojawia się *Krok rozszerzenia {name} zakończył się błędem. Przewodnik działa dalej.* Gdy plik projektu rozszerzenia nie da się otworzyć, pojawia się *Nie udało się otworzyć pliku projektu {file} z rozszerzenia {name}.* Obie to błędy.
- **Zmiana w międzyczasie** (info) — *W międzyczasie nastąpiła zmiana przez asystenta AI albo rozszerzenie. …* Przy anulowaniu okna dialogowego zadania, gdy asystent AI albo rozszerzenie w międzyczasie coś zmieniło: zmiany zadania sprzed tej zmiany nie są cofane. Zostają jako zwykłe kroki pod *Cofnij*.

### Obliczanie

- **Nie można obliczyć harmonogramu** (błąd) — *Nie udało się obliczyć harmonogramu* z powodem pod spodem (zobacz *Przyczyny błędu harmonogramu*). Przy *Oblicz*, przy przełączaniu dokumentów i przy otwieraniu pliku.
- **Data statusu ustawiona na dziś** (info) — *Nie było jeszcze daty statusu: ustawiono ją na dziś ({date}), ponieważ postęp jest mierzony do daty statusu. Możesz ją zmienić w Planowanie → Data statusu.* Przy wpisywaniu postępu w projekcie bez daty statusu.
- **Czas trwania krótszy niż wykonana praca** (info) — *„{name}” jest już wykonane w {N}%: czas trwania krótszy niż wykonana praca jest niemożliwy. Czas trwania nie został zmieniony.*

### Relacje i hierarchia

- **Relacja utworzona** (info) — *Utworzono relację: {predecessor} → {successor}*.
- **Relacja odrzucona** (info) — *Taka relacja już istnieje*, *Relacja między zadaniem a jego własnym nadrzędnym zadaniem sumarycznym jest niedozwolona.* albo *Ta relacja utworzyłaby cykl w harmonogramie ({cycle}) i nie została utworzona.* Cykl podaje zadania. Dzięki temu wiesz, którą relację najpierw usunąć albo odwrócić.
- **Przeniesienie odrzucone** (info) — *To przeniesienie utworzyłoby cykl w harmonogramie ({cycle}): relacje zadania sumarycznego dotyczą również jego podzadań. Niczego nie przeniesiono.*
- **Relacje wypadają po przeniesieniu** (info) — *Po przeniesieniu N relacji łączy zadanie z jego własnym nadrzędnym zadaniem sumarycznym; nie są one już uwzględniane w obliczeniach.*
- **Relacje pominięte przy wstawianiu** (info) — *N relacji nie zostało utworzonych: nieprawidłowe połączenie…*, przy wklejaniu albo wstawianiu gałęzi.
- **Relacje nieuwzględnione po imporcie** (info) — *Nie udało się uwzględnić N relacji. Sprawdź kolumny Poprzedniki i Następniki.*
- **Zduplikowane identyfikatory po imporcie** (info) — *Obiekty z powtórzonym identyfikatorem w tym pliku: N. Otrzymały własny identyfikator…*

### Edytowanie zadań

- **Początek zapisany jako ograniczenie** (info) — *'{name}' ma poprzednika: nowy początek jest teraz ograniczeniem Rozpocznij nie wcześniej niż (SNET) {date}. Po przeliczeniu (F5) zadanie nie rozpocznie się przed tą datą.* Gdy zmieniasz początek zadania z poprzednikiem. Gdy zadanie już miało takie ograniczenie, powiadomienie mówi, że zostało przesunięte. Dla kilku zadań naraz podaje liczbę.
- **Nowy początek nie zastosowany** (info) — *Nowy początek '{name}' nie został zastosowany: zadanie ma poprzednika i ograniczenie {type} {date}, a te określają jego początek. Zmień to ograniczenie, aby przesunąć początek.*
- **Kamień milowy odrzucony** (info) — *„{task}” ma przydziały zasobów i nie może stać się kamieniem milowym. Najpierw usuń przydziały.* albo *„{task}” jest zadaniem sumarycznym z podzadaniami i nie może stać się kamieniem milowym.* Przy zamianie w oknie dialogowym zadania, w panelu właściwości, w menu kontekstowym i w tabeli.
- **Przydziały przeniesione do podzadania** (info) — *Przydział {resources} przeniesiono z „{phase}” do nowego podzadania „{child}”: zadanie sumaryczne samo nie ma przydziałów.* Gdy zadanie z przydziałami dostaje podzadania.
- **Oznaczenie kamienia milowego usunięte** (info) — *Kamień milowy „{phase}” ma teraz podzadania i stał się zadaniem sumarycznym; oznaczenie kamienia milowego usunięto.*
- **Zadanie sumaryczne odrzucone** (info) — *„{phase}” nie może stać się zadaniem sumarycznym: …* z powodem i *Niczego nie zmieniono.*
- **Komórki pominięte przy wklejaniu** (info) — *N komórek pominiętych: są tylko do odczytu (np. automatycznie numerowany kod WBS lub kolumna obliczana).*
- **Odwołania wyczyszczone przy wklejaniu** (info) — *N odwołań nie istniało w tym dokumencie i zostało wyczyszczonych (kalendarze zadań, własne typy zadań, kody zadań lub pola użytkownika z dokumentu źródłowego).*
- **Reguła pracy dostosowała czas trwania** (info) — *Po zmianie kalendarza reguła pracy dostosowała czas trwania N zadań (praca pozostaje, zmieniła się liczba godzin dziennie).* Z linkiem *Reguły pracy – wyjaśnienie*.

### Primavera (XER)

- **Plik XER otwarty** (info) — *Otwarto plik XER: N dokumentów projektu.* Jedno powiadomienie na plik, także gdy plik otwiera kilka projektów. Ma link *Dowiedz się więcej* i wiersze szczegółów pod spodem. Zawsze *Znaleziono N projektów.* Tylko gdy liczba jest większa niż 0: *Pominięto N pustych projektów.*, *Wykluczono N projektów bazowych.*, *Utworzono N planów bazowych.*, *Zignorowano N oderwanych odwołań do planów bazowych.*, *Użyto ochronnego rozwiązania awaryjnego dla planu bazowego.* oraz *Zachowano N relacji zewnętrznych.* Tylko przy kodowaniu innym niż UTF-8: *Wybrane kodowanie tekstu: {encoding}.* Dalej, gdy liczba jest większa niż 0: *N ustaleń parsera.*, *N ustaleń kalendarza.*, *N problemów formatu liczbowego.*, *N rozwiązań awaryjnych enum.* oraz *N ustawień planowania P6 użyło bezpiecznych wartości zastępczych.*
- **Daty zapisane przez Primavera** (wiersz szczegółów w tym samym powiadomieniu) — *N zadań pokazuje daty tak, jak zapisał je Primavera (bez ponownego przeliczenia).*, albo, gdy tryb się nie włączył, *N zadań różni się od dat zapisanych w pliku — możesz je pokazać.*
- **Archiwum źródłowe XER nieprzydatne** (info) — *Archiwum źródłowe XER w tym pliku jest bezużyteczne i zostało pominięte; sam projekt otwarto w całości.* z powodem (na przykład *Powód: suma kontrolna nie pasuje do bajtów źródłowych — archiwum jest uszkodzone.*) i skutkiem (*Harmonogram, profil obliczeń i wszystkie dane projektu z IFC są kompletne. …*). Przy otwieraniu pliku IFC, w którym zapisane wcześniej archiwum źródłowe XER nie może zostać użyte.
- **Eksport traci informacje XER** (info) — *Eksport do {format} powoduje utratę informacji źródłowych XER.* Po udanym eksporcie projektu do formatu innego niż IFC, gdy projekt ma dane istniejące tylko w pliku XER. Z linkiem *Dowiedz się więcej*.

### Importowanie, eksportowanie i profil obliczeń

- **Daty zgodnie z plikiem** (info) — *N zadań pokazuje daty tak, jak zapisano je w pliku (bez ponownego przeliczenia).* albo *N zadań różni się od dat zapisanych w pliku — możesz je pokazać.* Przy otwieraniu pliku z zapisanymi datami.
- **Praca i reguły pracy widoczne** (info) — *Ten plik zawiera zapisaną pracę lub własne reguły pracy; reguła pracy i pozostała praca są wyświetlane dla tego projektu.*
- **Harmonogram MS Project odczytany** (info) — *Ten plik MS Project zawiera N zadań z podzielonym, wyrównanym lub zależnym od zasobów harmonogramem. Są one importowane i wyświetlane w takiej postaci.*
- **Przerwy nie wyeksportowane** (info) — *N zadań z przerwami zostało wyeksportowanych bez przerw: MS Project/P6 znają je tylko jako rozkład pracy.* Przy eksporcie do MS Project albo Primavery.
- **Początek projektu przesunięty** (info) — *Start projektu przesunięty: N kotwic zadań bez poprzednika lub ograniczenia zostało przesuniętych na nową datę rozpoczęcia.*
- **Okno dat już nie steruje** (info) — *Okno dat MS Project już nie steruje N zadaniami po tej edycji; …* Raz na dokument.
- **Opóźnienie bilansowania zaokrąglone** (info) — *Bilansowanie zaokrągla dokładne co do minuty opóźnienie bilansowania z MS Project dla N zadań do pełnych dni roboczych.* Raz na dokument.
- **Profil obliczeń zastosowany** (info) — *Ten projekt liczy się jako {profile}. Zmień to w Plik → Info o projekcie → Profil obliczeń i opcje.* Z przyciskiem *Otwórz profil obliczeń*. Po zastosowaniu profilu, gdy trzeba, pojawia się *Po zastosowaniu przesunięto N zadań.*
