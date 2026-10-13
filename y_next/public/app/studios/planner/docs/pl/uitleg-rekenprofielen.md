# Profile obliczeń i konwencje

Ten sam harmonogram może dawać różne daty, zależnie od tego, jakie reguły obliczeń zastosujesz. Ten artykuł wyjaśnia, dlaczego Primavera P6 i Microsoft Project liczą różnie w kilku punktach. Pokazuje też, jak aplikacja zapisuje tę różnicę w **profilu obliczeń** i czym profil różni się od opcji obliczeń, które ustawiasz sam dla projektu. Przykład z jedną małą siecią pokazuje, co to robi z datami.

## Pojęcie

Zadania, relacje i kalendarz określają większość harmonogramu, ale nie wszystko. Co się dzieje z zadaniami, które się jeszcze nie zaczęły, gdy ustawisz datę statusu? Gdzie zaczyna się pozostała praca zadania, które już trwa? Jaki jest zapas swobodny zadania, gdy termin ostateczny zostanie przekroczony? Sieć o tym nic nie mówi. Program do harmonogramowania musi dla tego wybrać regułę. Aplikacja zna kilka punktów, w których reguła Primavera P6 i reguła Microsoft Project się różnią.

Aplikacja nazywa taki wybór **konwencją**. **Profil obliczeń** to zbiór konwencji, który należy do jednego pakietu. Aplikacja ma trzy profile:

- *Open Planner Studio*: profil, z którym liczy się nowy projekt. Żadna konwencja nie jest włączona.
- *Primavera P6*: konwencje, które aplikacja zna z P6.
- *Microsoft Project*: konwencje, które aplikacja zna z programu Microsoft Project.

Profil zatem mówi, jak dany pakiet liczy. To, czego chcesz dla swojego projektu, do niego nie należy. Do tego służą **opcje obliczeń**: wybory, na przykład to, jak mały zapas sprawia, że zadanie jest krytyczne, albo w jakim kalendarzu liczy się opóźnienie. Ustawiasz je dla każdego projektu osobno.

## Jak aplikacja liczy

### Konwencje i opcje obliczeń

Konwencja to przełącznik: włączony albo wyłączony. Profil decyduje, które przełączniki są włączone. Opcja obliczeń to wybór, którego dokonujesz sam. Różnicę widzisz w samej aplikacji, w bloku *Profil obliczeń i opcje*:

- **Konwencje** znajdziesz pod *Konwencje tego profilu*, pogrupowane według tematu, na przykład *Postęp i ukończona praca*, *Powiązania i opóźnienie* oraz *Zapas i późne terminy*. Każda linia to pole wyboru z wartością profilu za nią (*baza: włączona* albo *baza: wyłączona*). Jeśli Twój wybór się od tego różni, linia się wyróżnia i pojawia się *przywróć bazę*. Strzałka przed linią otwiera wyjaśnienie tej konwencji. Przeczytaj je najpierw, jeśli chcesz zmienić konwencję.
- **Opcje obliczeń** znajdziesz pod *Opcje obliczeń tego projektu*: między innymi *Definicja krytyczności*, *Obliczanie zapasu*, *Zadania z otwartym końcem krytyczne*, *Oznaczaj jako prawie krytyczne* i *Kalendarz zwłoki*. Mówią, czego chcesz dla tego projektu, a nie jak liczy dany pakiet. Co robią, wyjaśniają [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad) oraz [Relacje i opóźnienie](docs://uitleg-relaties).

Przykład dla każdej z nich. „Zadanie jest krytyczne, jeśli jego zapas całkowity wynosi 0 lub mniej” to opcja obliczeń: możesz ustawić próg na 4, a wtedy wszystko z zapasem 4 dni roboczych lub mniej jest krytyczne. „Zadania, które się jeszcze nie rozpoczęły, przesuwają się do daty statusu” to konwencja: Open Planner Studio i Primavera P6 tak robią, Microsoft Project nie.

Profil i opcje obliczeń należą do pliku projektu, a nie do aplikacji. Jeśli zapiszesz projekt, zapisują się razem z nim. Dwa projekty w tej samej aplikacji mogą więc liczyć według różnych profili. Projekt bez profilu liczy się jak Open Planner Studio.

Jeśli są opcje obliczeń, które zna tylko Primavera, blok pokazuje na dole także *Ustawienia z pliku źródłowego*. Dotyczy to projektu z pliku .xer, ale także wtedy, gdy wybierzesz *Primavera P6* w oknie *Nowy projekt* albo zastosujesz domyślne opcje Primavery P6. Tutaj nie możesz ich zmienić.

### Gdzie wybierasz profil

Dla nowego projektu profil znajduje się w oknie *Nowy projekt*, które otwierasz przez *Start › Plik › Nowy*. Tam *Profil obliczeń* to lista rozwijana. Jeśli wybierzesz tutaj profil, aplikacja zastępuje opcje obliczeń, które zostały już wpisane, domyślnymi wartościami tego profilu. Zostają tylko ustawienia z pliku źródłowego. Przy *Primavera P6* *Obliczanie zapasu* ma wtedy wartość *Zapas końca*. Przy *Microsoft Project* i *Open Planner Studio* każda opcja obliczeń ma wartość domyślną, więc *Obliczanie zapasu* to *Automatycznie (domyślnie)*. Przy dacie statusu tak samo liczy sam Microsoft Project: zadanie rozpoczęte dostaje zapas końca, a każde inne zadanie dostaje mniejszy z zapasu początku i zapasu końca.

Dla istniejącego projektu wybierasz profil w *Ustawienia › Projekt › Info o projekcie*, w bloku *Profil obliczeń i opcje*, na liście rozwijanej *Profil obliczeń*. Tę samą lokalizację otworzysz też przez *Plik › Info o projekcie*. Zmiana profilu tutaj zmienia tylko konwencje. Twoje opcje obliczeń zostają bez zmian. Chcesz też domyślne opcje obliczeń nowego profilu? Wybierz *Zastosuj domyślne opcje tego profilu*.

Dopóki nie naciśniesz *Zastosuj*, zmiana istnieje tylko w formularzu. Po naciśnięciu przycisku *Zastosuj* aplikacja od razu przelicza harmonogram, nawet gdy *Oblicz automatycznie* jest wyłączone. Jeśli zadania się przesunęły, podaje, ile ich jest, na przykład *Po zastosowaniu przesunięto 4 zadania.* Całą zmianę cofniesz jednym poleceniem *Cofnij*.

Jeśli w profilu włączysz albo wyłączysz jedną konwencję, aplikacja zamienia go w profil niestandardowy. Nazywa się *Kopia Open Planner Studio* albo *Kopia* z nazwą profilu, od którego zaczynałeś. Możesz mu nadać inną nazwę i zachować go, używając *Zapisz jako szablon*, dla innych projektów w tej aplikacji. Projekt zawsze ma własną kopię: jeśli później zmienisz szablon, projekt się przez to nie zmieni.

### Kiedy aplikacja sama wybiera profil

Gdy otworzysz plik, aplikacja proponuje profil na podstawie formatu:

- Plik .mpp (Microsoft Project) otwiera się z profilem *Microsoft Project*.
- Plik .xer (Primavera P6) otwiera się z profilem *Primavera P6*.
- Plik w formacie *MS Project XML*, *Primavera P6 XML* albo *CSV (rozdzielany średnikiem)* otwiera się z profilem *Open Planner Studio*, bez komunikatu o profilu.
- Twój własny projekt (.ifc) otwiera się z profilem, który jest w nim zapisany.

Dla pliku .mpp albo .xer aplikacja podaje profil: *Ten projekt liczy się jako Microsoft Project. Zmień to w Plik → Info o projekcie → Profil obliczeń i opcje.* Przycisk *Otwórz profil obliczeń* w tym komunikacie przenosi cię od razu do Info o projekcie. Dla pliku .xer ta linia jest pierwszą linią szczegółów komunikatu o otwarciu pliku. Więcej o tym komunikacie znajdziesz w [Otwieranie pliku Primavera P6 (.xer)](docs://howto-xer-openen) i [Otwieranie pliku MS Project (.mpp)](docs://howto-mpp-openen).

Dla pliku .mpp aplikacja tylko ustawia profil. Opcje obliczeń zostają puste, tak samo jak w nowym projekcie z profilem *Microsoft Project*: *Obliczanie zapasu* to *Automatycznie (domyślnie)*. Otwarty plik .mpp i nowy projekt z *Microsoft Project* liczą więc zapas tak samo.

## Przykład: jedna sieć, trzy profile

Przykład to mała sieć. Kalendarz ma tydzień roboczy od poniedziałku do piątku i w tych tygodniach nie ma dni wolnych. Tryb postępu to Retained Logic (domyślny). Początek projektu to poniedziałek 7 czerwca 2027. Wszystkie zadania są podane w dniach roboczych.

- *Pour foundation*: 5 dni roboczych, planowany od poniedziałku 7 czerwca.
- *Lay walls*: 5 dni roboczych, po *Pour foundation* (zakończenie-rozpoczęcie).
- *Order window frames*: 3 dni robocze, bez poprzednika, planowany od poniedziałku 7 czerwca.
- *Fit roof*: 2 dni robocze, po *Lay walls* i po *Order window frames*. Zakończenie tego zadania to przekazanie.

Liczby obliczył silnik obliczeń aplikacji. Odczytasz je w panelu *Właściwości*, w sekcji *Wynik CPM*.

**Bez daty statusu i bez postępu trzy profile liczą tę sieć tak samo.** Zadanie *Pour foundation* trwa od poniedziałku 7 do piątku 11 czerwca, *Lay walls* od poniedziałku 14 do piątku 18 czerwca, a *Fit roof* w poniedziałek 21 i wtorek 22 czerwca. Przekazanie jest we wtorek 22 czerwca. Zadanie *Order window frames* (od poniedziałku 7 do środy 9 czerwca) ma zapas całkowity wynoszący 7 dni roboczych.

Teraz rejestrujesz stan. Data statusu to środa 9 czerwca. Zadanie *Pour foundation* zaczęło się w poniedziałek 7 czerwca i jest ukończone w 60 %. Pozostała praca to zatem 2 dni robocze (5 × 40 %). Zadanie *Order window frames* jeszcze się nie rozpoczęło. Jak działa [postęp i data statusu](docs://uitleg-voortgang), opisuje tamten artykuł. Tutaj pytanie brzmi, co z tym robi profil.

### Open Planner Studio

Pozostała praca zadania *Pour foundation* zaczyna się od daty statusu: w środę 9 i czwartek 10 czerwca. Najwcześniejsze rozpoczęcie pozostaje takie samo jak rzeczywiste rozpoczęcie, czyli poniedziałek 7 czerwca. Najwcześniejsze zakończenie to czwartek 10 czerwca. *Lay walls* trwa od piątku 11 do czwartku 17 czerwca, a *Fit roof* w piątek 18 i poniedziałek 21 czerwca.

Zadanie *Order window frames* było planowane na poniedziałek 7 czerwca, ale jeszcze się nie rozpoczęło. Zadanie, które się nie rozpoczęło, nie może leżeć w przeszłości. Dlatego aplikacja przesuwa je na datę statusu: od środy 9 do piątku 11 czerwca. Jego zapas całkowity wynosi 4 dni robocze. Przekazanie jest w poniedziałek 21 czerwca.

### Primavera P6

Wszystko jest takie samo jak w Open Planner Studio, z jednym wyjątkiem: najwcześniejsze rozpoczęcie zadania *Pour foundation* to środa 9 czerwca. To jest początek pozostałej pracy, a nie rzeczywiste rozpoczęcie. To robi konwencja *Zadanie w toku: najwcześniejsze rozpoczęcie = początek pozostałej pracy*, w grupie *Postęp i ukończona praca*. Zakończenie i zapas się przez to nie zmieniają. Przekazanie jest w poniedziałek 21 czerwca.

### Microsoft Project

Tutaj daty się różnią. Dwie konwencje w grupie *Postęp jak w Microsoft Project* to powodują.

*Nie przesuwaj nierozpoczętych zadań do daty stanu*: zadanie *Order window frames* zostaje od poniedziałku 7 do środy 9 czerwca, chociaż część tego okresu przypada przed datą statusu. Zapas całkowity wynosi 7 dni roboczych.

*Pozostała praca wznawia się po upływie czasu*: pozostała praca zaczyna się nie wcześniej niż data statusu i nie wcześniej niż rzeczywiste rozpoczęcie plus czas, który już upłynął. Przy 60 % z 5 dni roboczych wykonano 3 dni robocze. Poniedziałek 7 czerwca plus 3 dni robocze to czwartek 10 czerwca. To jest po dacie statusu, więc pozostała praca trwa w czwartek 10 i piątek 11 czerwca. *Lay walls* trwa od poniedziałku 14 do piątku 18 czerwca, a *Fit roof* w poniedziałek 21 i wtorek 22 czerwca. Przekazanie jest we wtorek 22 czerwca: o jeden dzień roboczy później niż w dwóch pozostałych profilach.

### Co jeśli

**Zadanie *Pour foundation* jest ukończone w 20 % zamiast w 60 %.** Pozostała praca wynosi wtedy 4 dni robocze. We wszystkich trzech profilach zadanie *Pour foundation* kończy się w poniedziałek 14 czerwca, a przekazanie jest w środę 23 czerwca. Konwencja Microsoft Project dla pozostałej pracy nie robi tu różnicy: poniedziałek 7 czerwca plus 1 dzień roboczy, który upłynął, to wtorek 8 czerwca, a to jest przed datą statusu. Taka konwencja to dolna granica, która może tylko przesunąć pozostałą pracę na później. Zadanie *Order window frames* i najwcześniejsze rozpoczęcie w profilu Primavera P6 nadal się różnią, jak wyżej. W profilu Microsoft Project zadanie *Order window frames* ma wtedy zapas całkowity wynoszący 8 dni roboczych.

**Ustawiasz tylko datę statusu i nie wpisujesz postępu.** W Open Planner Studio i Primavera P6 cała sieć przesuwa się do daty statusu, czyli środy 9 czerwca. Zadanie *Pour foundation* trwa wtedy od środy 9 do wtorku 15 czerwca, a przekazanie wypada w czwartek 24 czerwca: dwa dni robocze później niż bez daty statusu. W Microsoft Project wszystko zostaje tam, gdzie było, a przekazanie jest we wtorek 22 czerwca.

**Profil składasz sam.** Jeśli w Open Planner Studio włączysz tylko *Nie przesuwaj nierozpoczętych zadań do daty stanu*, powstanie profil niestandardowy *Kopia Open Planner Studio*. Przy 60 % postępu zadanie *Pour foundation* zachowuje wtedy daty Open Planner Studio: zakończenie w czwartek 10 czerwca, przekazanie w poniedziałek 21 czerwca. Zadanie *Order window frames* zostaje od poniedziałku 7 do środy 9 czerwca, z zapasem całkowitym 6 dni roboczych. Profil to więc zestaw oddzielnych przełączników, które możesz zmieniać jeden po drugim.

**Opcja obliczeń zamiast konwencji.** Jeśli w Open Planner Studio ustawisz *Definicja krytyczności* (*Zapas całkowity ≤ próg*) z *Próg (dni robocze)* równym 4, zadanie *Order window frames* stanie się krytyczne, bo jego zapas całkowity wynosi dokładnie 4. Żadna data się nie zmienia. Opcja obliczeń to Twój wybór dla projektu i jest niezależna od profilu.

**Przekroczony termin ostateczny.** Ustaw dla *Fit roof* termin ostateczny w piątek 18 czerwca. W Open Planner Studio zapas całkowity *Fit roof* wynosi wtedy −1 dzień roboczy, a zapas swobodny też −1. W Primavera P6 zapas całkowity pozostaje −1, ale zapas swobodny staje się 0. To robi konwencja *Zapas swobodny nigdy ujemny*, w grupie *Zapas i późne terminy*. W Microsoft Project oba wynoszą −2, bo przekazanie wypada tam o dzień później. Jak działa termin ostateczny, opisuje [Ograniczenia i terminy ostateczne](docs://uitleg-constraints).

## Skutki i nieporozumienia

**„Profil jest ustawieniem aplikacji.”** Nie. Profil i opcje obliczeń należą do projektu i są zapisane w pliku. Do aplikacji należą tylko szablony, które zachowujesz. Projekt zawsze ma własną kopię.

**„Jeśli wyeksportuję, mój profil trafi do pliku.”** Tylko we własnym formacie projektu (.ifc). Jeśli eksportujesz do *MS Project XML*, *Primavera P6 XML* albo *CSV (rozdzielany średnikiem)*, profilu nie ma w pliku. Z opcji obliczeń eksport do *MS Project XML* zapisuje co najwyżej próg krytyczny. Aplikacja ostrzega o tym tylko przy projekcie pochodzącym z pliku .xer. Przy projekcie, który tworzysz samodzielnie, komunikat się nie pojawia. Plik otwiera się wtedy w Open Planner Studio, bez komunikatu o profilu. Weźmy przykład z profilem Microsoft Project i postępem 60 %. Jeśli wyeksportujesz go do *MS Project XML* i otworzysz ponownie, aplikacja najpierw pokazuje daty z pliku, z przekazaniem we wtorek 22 czerwca. Jeśli pozwolisz aplikacji przeliczyć harmonogram sama, przekazanie będzie w poniedziałek 21 czerwca. Co eksport jeszcze gubi, opisuje [Pliki i formaty](docs://uitleg-bestanden).

**„Profil Primavera P6 daje ten sam wynik co P6.”** Aplikacja tego nie może obiecać. Profil włącza konwencje, które aplikacja zna z P6, a nie wszystkie ustawienia P6. Oprócz Retained Logic i Progress Override P6 ma trzeci tryb postępu, Actual Dates. Aplikacja go nie zna. Taki plik .xer oblicza się jako Retained Logic, a komunikat przy otwarciu to zgłasza, na przykład jako *1 ustawienie planowania P6 użyło bezpiecznej wartości zastępczej.* Niektóre konwencje profilu Primavera P6 działają tylko przy zadaniach pochodzących z pliku .xer, na przykład *Nierozpoczęte LOE przyjmuje okno docelowe* i *Przejmij daty rzeczywiste dokładnie*. Przy niektórych z nich wyjaśnienie to mówi: „tylko zadania z pochodzeniem P6”. Przy zadaniach, które tworzysz samodzielnie, te konwencje nic nie robią.

**„Tryb postępu jest częścią profilu.”** Nie. Retained Logic albo Progress Override to osobny wybór dla każdego projektu. Ustawiasz go oddzielnie od profilu, zobacz [Wybór trybu postępu](docs://howto-voortgangsmodus-kiezen). Jedna konwencja Primavera P6, *Progress Override pomija rozpoczętego następnika także wstecz*, działa tylko przy Progress Override.

**„Zmienię po prostu profil, żeby zobaczyć, co się stanie.”** Możesz, bo *Cofnij* cofa działanie *Zastosuj* jednym krokiem: profil i daty wracają razem. Daty mogą jednak naprawdę się przesunąć. W przykładzie przełączenie z Open Planner Studio na Microsoft Project przesuwa wszystkie 4 zadania. Komunikat je dla Ciebie zlicza. Sprawdź potem harmonogram, zanim pójdziesz dalej. Jeśli po otwarciu pliku .xer lub .mpp aplikacja nadal pokazuje daty z pliku, zmiana profilu opuszcza ten widok, a aplikacja oblicza sama. Jak to działa, opisuje [Zapisane daty](docs://uitleg-datums-zoals-opgeslagen).

**Przykład pokazuje cztery konwencje, a lista w aplikacji jest dłuższa.** W bloku każdy wiersz ma własne wyjaśnienie. Przeczytaj je najpierw. Zwróć też uwagę na grupę *Tylko dla własnych profili*. Te konwencje są wyłączone we wszystkich wbudowanych profilach, także w Primavera P6. Jeśli włączysz jedną z nich, profil staje się profilem niestandardowym.

## Zobacz także

- [Postęp, data statusu i plan bazowy](docs://uitleg-voortgang): co robią data statusu i pozostała praca, z różnicami dla każdego profilu.
- [Wybór trybu postępu](docs://howto-voortgangsmodus-kiezen): wybór Retained Logic albo Progress Override.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): opcje obliczeń dla zadań krytycznych i zapasu.
- [Relacje i opóźnienie](docs://uitleg-relaties): opcja obliczeń *Kalendarz zwłoki*.
- [Pliki i formaty](docs://uitleg-bestanden): co eksport zawiera, a czego nie.
- [Eksport](docs://howto-exporteren): eksport projektu.
- [Aktualizacja postępu](docs://howto-voortgang-bijwerken): wpisywanie procentu, rzeczywistego rozpoczęcia i daty statusu.
- [Zapisane daty](docs://uitleg-datums-zoals-opgeslagen): dlaczego zaimportowane daty mogą się różnić od tego, co aplikacja sama oblicza.
- [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies): wszystkie konwencje i opcje obliczeń na jednej liście.
