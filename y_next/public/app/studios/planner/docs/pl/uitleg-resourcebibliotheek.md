# Biblioteka zasobów

Twoja ekipa murarska nie pracuje tylko dla jednego projektu. Dziś stawia domy na północy, jutro garaże na południu. Biblioteka zasobów to miejsce, w którym zapisujesz taką ekipę raz. Dzięki temu każdy projekt używa tej samej ekipy. Aplikacja może wtedy także zobaczyć, kiedy dwa projekty potrzebują tych samych ludzi tego samego dnia. Żaden pojedynczy projekt tego nie widzi. W tym artykule przeczytasz, jak biblioteka i projekt są ze sobą powiązane i jak aplikacja liczy obłożenie w wielu projektach.

## Koncepcja

Są dwie warstwy.

**Biblioteka zasobów** to lista zasobów i kalendarzy Twojej organizacji. Na liście są na przykład murarz, dźwig i tynkarz. Każdy zasób ma typ, stawkę i liczbę sztuk. Sama lista, którą aplikacja nazywa też **pool**, nie zapisuje się w plikach projektu. Zapisuje się w aplikacji: w aplikacji na pulpicie w pliku na tym komputerze, a w przeglądarce w magazynie tej przeglądarki. Jeśli wyczyścisz dane witryny w przeglądarce, biblioteka zniknie. Dlatego wyeksportuj ją jako kopię zapasową. Zawsze istnieje co najmniej jedna biblioteka. Pierwsza nazywa się *Mijn resourcebibliotheek* (nazwa niderlandzka). Możesz ją przemianować.

**Projekt** decyduje, ile danego zasobu używa i kiedy. Projekt jest powiązany z jedną biblioteką lub działa samodzielnie. Samodzielny projekt działa dobrze, ale bez wspólnej listy.

Projekt nie wskazuje na bibliotekę. Zachowuje własną **kopię**. Gdy przypiszesz *Bricklayer* z biblioteki do projektu, aplikacja tworzy w projekcie kopię z **znacznikiem pochodzenia**. Ten znacznik zapisuje, że kopia pochodzi z biblioteki X i jest tam elementem Y. W tabeli zasobów poznasz taką kopię po małej ikonie biblioteki. Kopia to zwykły zasób. Można do niej przypisać zadania, a zapisuje się w samym pliku projektu.

Kalendarze w bibliotece zasobów to coś innego niż lista kalendarzy projektu. Tę listę zarządzasz w oknie kalendarza. Kalendarz z biblioteki wchodzi do projektu razem z zasobem, który go używa.

## Jak aplikacja z tym pracuje

### Co decyduje biblioteka, a co projekt

Biblioteka decyduje, **czym zasób jest**: o nazwie, typie, stawce za godzinę, jednostce i opisie. W kopii w projekcie te pola pojawiają się jako zwykły tekst. Zmieniasz je w bibliotece, aby były poprawne we wszystkich projektach. Jeśli chcesz, aby kopia jednak poszła własną drogą, odłącz ją od biblioteki.

Projekt decyduje, **ile i kiedy**: *Maks. jednostki*, zdolność, która zmienia się w czasie (*Zdolność rozłożona w czasie*), oraz kalendarz zasobu. Te pola zostają edytowalne w projekcie. Nie są uznawane za odchylenie od biblioteki. Ta sama ekipa może bowiem pracować na pilnym zleceniu według innego kalendarza niż zwykły projekt. Zawartość kalendarza, który przyszedł razem z zasobem, podąża za biblioteką.

### Kiedy kopia podąża za biblioteką

Biblioteka nie odświeża kopii ciągle. Robi to w stałych momentach:

- Gdy zmienisz coś w bibliotece, niezmienione kopie we wszystkich otwartych projektach podążają za tym od razu.
- Gdy otworzysz projekt albo przejdziesz na inną zakładkę, aplikacja porównuje kopie z biblioteką. Jeśli niezmieniona kopia jest w tyle, aplikacja cicho ją aktualizuje i krótko to pokazuje: *Zaktualizowano 1 element z biblioteki* albo *Zaktualizowano N elementów z biblioteki*.

Aplikacja pamięta wartości z chwili, gdy kopia powstała lub została zaktualizowana. Jeśli kopia teraz się od nich różni, aplikacja nie decyduje, kto ma rację. Kopia dostaje wtedy znacznik *różni się — zdecyduj*. Gdy otworzysz plik z taką kopią, samo otworzy się okno *Połącz bibliotekę zasobów*. Tam wybierasz dla każdego elementu, czy obowiązują wartości z biblioteki, czy wartości z Twojego pliku trafiają do biblioteki. Przy przełączaniu zakładek nigdy nie pojawia się okno.

Odchylenie powstaje na przykład wtedy, gdy połączysz własny zasób w projekcie z elementem z biblioteki o tej samej nazwie, ale z innymi wartościami. Robisz to za pomocą *Do biblioteki*. Aplikacja je łączy i od razu oznacza kopię jako odchylającą się.

### Kiedy zasób znika z biblioteki

Gdy usuniesz zasób z biblioteki, kopia zostaje w projektach i dalej działa. Dostaje znacznik *nie ma już w bibliotece*. Potem możesz ją w pełni edytować albo usunąć z projektu.

### Obłożenie w wielu projektach

Histogram i przeciążenie w projekcie patrzą tylko na ten jeden projekt. Biblioteka wie więcej: ile zasobów jest łącznie. Widok *Obłożenie* sumuje dla każdego dnia obciążenie wszystkich otwartych projektów. Projekty te są powiązane z tą samą biblioteką i używają kopii tego zasobu. Jeśli suma danego dnia jest większa niż zdolność biblioteki, ten dzień liczy się jako przeciążony.

Trzy reguły decydują, co się liczy:

- Zdolność pochodzi z biblioteki (*Maks. jednostki* elementu biblioteki albo jego *Zdolność rozłożona w czasie* tego dnia). Nie pochodzi z *Maks. jednostki* kopii w projekcie. Dwa projekty, z których każdy mieści się w swoim przydziale, mogą więc razem nadal prosić o za dużo.
- Suma dokładnie równa zdolności nie jest konfliktem. Konfliktem jest dopiero zapotrzebowanie większe niż zdolność.
- Liczą się tylko kopie ze znacznikiem pochodzenia. Liczą się tylko w projektach, które w tym momencie są otwarte w tej aplikacji. Własny zasób jednego projektu nie jest w bibliotece, dlatego się nie liczy. Przegląd nie widzi dokumentów, które nie są otwarte w tej aplikacji. Ta informacja jest też podana na dole samego przeglądu.

## Przykład praktyczny: ekipa murarska w dwóch projektach

Biblioteka zasobów zawiera zasób *Bricklayer* z *Maks. jednostki* 3: trzech murarzy na liście płac. Dwa projekty go używają. Oba mają kopię z *Maks. jednostki* 2.

- *Houses North* ma zadanie *Bricklaying facades* na 5 dni roboczych od poniedziałku 7 czerwca 2027, po 2 jednostki dziennie. Zadanie trwa od 7 do 11 czerwca włącznie.
- *Garages South* ma zadanie *Bricklaying garages* na 4 dni robocze od środy 9 czerwca 2027, po 2 jednostki dziennie. Weekend się nie liczy, więc zadanie obejmuje 9, 10, 11 i 14 czerwca.

W każdym projekcie murarz jest zajęty na 2 z swoich 2 jednostek. Żaden z projektów nie pokazuje przeciążenia: w *Zasoby › Nadmierne przydzielenie* oba mówią *Brak*. Razem jednak przekraczają 3 murarzy. Aplikacja liczy na dzień:

- Poniedziałek 7 i wtorek 8 czerwca: 2 (tylko *Houses North*)
- Środa 9, czwartek 10 i piątek 11 czerwca: 2 + 2 = 4
- Poniedziałek 14 czerwca: 2 (tylko *Garages South*)

Szczyt wynosi 4 wobec zdolności 3. Przegląd pokazuje murarza z *2 dokumenty*, okres *2027-06-07 – 2027-06-14*, *4.0 / 3.0* dla szczytu i zdolności oraz *3 dni podwójnie zarezerwowane*: 9, 10 i 11 czerwca.

Co się stanie, gdy coś zmienisz:

- Jeśli *Bricklaying facades* trwa 6 dni roboczych, kończy się w poniedziałek 14 czerwca. Ten dzień też osiąga 2 + 2 = 4. Przegląd pokazuje więc *4 dni podwójnie zarezerwowane*: 9, 10, 11 i 14 czerwca. Szczyt pozostaje 4.
- Jeśli biblioteka ma *Maks. jednostki* 4, przegląd pokazuje *4.0 / 4.0*. Nie ma konfliktu, bo suma nie jest większa niż zdolność.
- Jeśli *Garages South* pracuje z 1 jednostką dziennie zamiast 2, szczyt wynosi 3. Przegląd pokazuje *3.0 / 3.0*: bez konfliktu.
- Jeśli *Garages South* zaczyna dopiero w poniedziałek 14 czerwca, projekty na siebie nie nachodzą. Okres staje się *2027-06-07 – 2027-06-17*, a szczyt wynosi *2.0 / 3.0*.

Kroki, jak to sprawdzić w swoich projektach, znajdziesz w [Korzystanie z przeglądu obłożenia](docs://howto-bezettingsoverzicht-gebruiken).

## Konsekwencje i błędne przekonania

**„Biblioteka jest wspólna z moimi współpracownikami.”** Nie. Biblioteka jest przechowywana w aplikacji: w wersji na pulpicie w pliku na tym komputerze, a w przeglądarce w magazynie tej przeglądarki. Nie jest synchronizowana. Jeśli dwóch planistów pracuje z tą samą biblioteką zasobów, ich biblioteki mogą się rozjechać. Udostępniać możesz przez eksport i import, zob. [Zarządzanie bibliotekami zasobów i ich udostępnianie](docs://howto-bibliotheken-beheren). Jeśli Twoja organizacja dzieli ekipy między spółki, wybierz świadomie jedną wspólną bibliotekę. Przegląd widzi też tylko projekty otwarte w tej aplikacji.

**„Jeśli zmienię bibliotekę, wszystko w moich projektach się zmieni.”** Zmienia się tylko tożsamość zasobu: nazwa, typ, stawka, jednostka i opis. *Maks. jednostki*, zdolność w czasie i wybór kalendarza w projekcie zostają bez zmian.

**„Zmianę w bibliotece mogę cofnąć.”** Nie. Biblioteka należy do aplikacji, a nie do projektu. Zmiany w niej są poza *Cofnij* (Ctrl+Z). Widok *Biblioteka* sam to ostrzega: *To edytuje bibliotekę i dotyczy wszystkich projektów — poza cofaniem.* Usunięcie z biblioteki też wymaga potwierdzenia. Nie da się go cofnąć.

**„Przegląd obłożenia rozwiązuje podwójną rezerwację.”** Nie. Przegląd jest tylko oknem do odczytu. Pokazuje, w które dni dwa projekty razem proszą o za dużo. *Bilansowanie* (*Zasoby › Bilansowanie › Bilansuj…*, zob. [Bilansowanie zasobów](docs://uitleg-nivelleren)) patrzy na zasoby jednego projektu. Nie uwzględnia innych projektów. Przesuń samodzielnie zadanie w jednym z projektów albo zmień zdolność w bibliotece, jeśli ktoś naprawdę dołącza.

**„Mój własny zasób liczy się w obłożeniu.”** Tylko wtedy, gdy jest w bibliotece. Zasób, który utworzyłeś tylko w projekcie, na przykład wynajęty dźwig do jednego zlecenia, nie ma znacznika pochodzenia. Dlatego nie ma go w przeglądzie. Użyj *Do biblioteki*, aby go dodać.

## Zobacz także

- [Korzystanie z biblioteki zasobów](docs://howto-resourcebibliotheek-gebruiken): łączenie, przypisywanie zasobów i rozstrzyganie odchyleń.
- [Zarządzanie bibliotekami zasobów i ich udostępnianie](docs://howto-bibliotheken-beheren): tworzenie, eksport i import bibliotek.
- [Korzystanie z przeglądu obłożenia](docs://howto-bezettingsoverzicht-gebruiken): znajdowanie podwójnych rezerwacji między projektami.
- [Zarządzanie zasobami](docs://howto-resources-beheren): zasoby jednego projektu.
