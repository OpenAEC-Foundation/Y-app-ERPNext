# Ograniczenia i terminy ostateczne

Cegły przyjadą dopiero 21 czerwca. Pozwolenie jeszcze nie przyszło. Dach musi być zamknięty przed urlopem budowlanym. Relacje zapisują, że zadanie czeka na inne zadanie, ale uzgodnienia o dacie nie wynikają z kolejności prac. Do tego właśnie służą ograniczenia i terminy ostateczne. W tym artykule przeczytasz, co robi każdy typ, kiedy zadanie się przesuwa, a kiedy zmienia się tylko zapas, czym jest twarde przypięcie i jak aplikacja zgłasza konflikt.

Reguły i przykłady dotyczą nowego projektu z profilem obliczeń *Open Planner Studio* i tygodniem roboczym od poniedziałku do piątku.

## Koncepcja

**Ograniczenie** to granica daty dla jednego zadania, niezależna od jego relacji. Taka granica może działać na dwa sposoby:

- **Przesuwa**: zadanie nie może zacząć się ani zakończyć wcześniej niż ta data. Jeśli relacje sprawiłyby, że zadanie zacznie się wcześniej, przesuwa się na tę datę.
- **Pilnuje**: zadanie musi zacząć się lub zakończyć najpóźniej w tej dacie. Aplikacja niczego nie przesuwa. Jeśli harmonogram nie spełnia tej daty, **zapas** zadania i łańcucha przed nim staje się ujemny. Zapas to czas, o który zadanie może się przesunąć, zanim przesunie się termin zakończenia projektu. Ujemny zapas oznacza, że na papierze jesteś już spóźniony (zobacz [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad)).

**Termin ostateczny** to prostsza forma pilnowania. Jest to docelowa data zakończenia zadania. Termin nie przesuwa zadania.

Wszystkie ograniczenia są **miękkie**: obliczenie idzie dalej, nawet jeśli data nie jest spełniona. Jedynym wyjątkiem jest **twarde przypięcie**, które nadpisuje relacje. Więcej o tym poniżej.

## Jak aplikacja oblicza

### Osiem typów

Typ wybierzesz w polu *Ograniczenie* w panelu *Właściwości*. Tak oblicza każdy typ:

- *Jak najwcześniej (ASAP)*: brak granicy. To jest ustawienie domyślne: zadanie zaczyna się tak wcześnie, jak pozwalają relacje.
- *Jak najpóźniej (ALAP)*: zadanie przesuwa się tak późno, jak może, bez opóźniania jego następnika. Zużywa więc swój zapas swobodny. Jeśli po tym zostaje mu zapas całkowity, bo jego następniki mają własne miejsce, zostaje niekrytyczne. Jeśli i ten zapas się wyczerpie, liczy się jako krytyczne.
- *Rozpocznij nie wcześniej niż (SNET)*: dolna granica dla startu. Jeśli zadanie zaczęłoby się wcześniej, przesuwa się na tę datę. Jeśli data jest wcześniejsza, niż pozwalają relacje, ograniczenie nic nie robi.
- *Zakończ nie wcześniej niż (FNET)*: tak samo, ale dla zakończenia zadania.
- *Rozpocznij nie później niż (SNLT)* i *Zakończ nie później niż (FNLT)*: górna granica dla startu albo zakończenia. Nic nie przesuwają. Jeśli granica nie jest spełniona, aplikacja zgłasza naruszone ograniczenie, a zapas staje się ujemny.
- *Musi rozpocząć się (MSO)* i *Musi zakończyć się (MFO)*: dolna i górna granica naraz. Zadanie przesuwa się na tę datę, jeśli jest ona późniejsza, niż wymagają relacje. Jeśli data jest wcześniejsza, niż pozwalają relacje, zadanie zostaje tam, gdzie je relacje postawiły, a zapas staje się ujemny.

Jeśli data przypada w sobotę, niedzielę lub dzień wolny, aplikacja czyta ją jako dzień roboczy: dolną granicę (SNET, FNET) jako najbliższy następny dzień roboczy, a górną granicę (SNLT, FNLT) jako najbliższy poprzedni dzień roboczy.

### Co oznacza ujemny zapas

Górna granica działa wstecz. Jeśli ograniczenie ustawia późny termin zadania przed jego wczesnym terminem, zapas całkowity staje się ujemny. Dotyczy to także zadań przed nim. Jeśli murowanie musi zacząć się najpóźniej w piątek 11 czerwca, a nie może zacząć się przed poniedziałkiem 14 czerwca, są też zadania przed murowaniem o jeden dzień roboczy spóźnione. Wszystkie zadania z ujemnym zapasem są krytyczne. Jak to działa, wyjaśnia [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad).

Paski nie przesuwają się przez górną granicę. Konflikt zobaczysz w ujemnym *Zapas całkowity*, w czerwonym rombie nad paskiem, w komunikacie w pasku stanu (na przykład *Naruszone ograniczenia: 1*) i w panelu *Ostrzeżenia*.

### Twarde przypięcie

Przy MSO i MFO pojawia się pole wyboru *Obowiązkowe (twarde przypięcie)*. Z tym zaznaczeniem przypinasz zadanie do daty, nawet jeśli jego poprzedniki nie są do tej daty skończone. Relacje są wtedy nadpisane:

- Zadanie jest w tej dacie (przy MSO zaczyna się tam, przy MFO kończy się tam) i nakłada się na swoje poprzedniki.
- Poprzedniki dostają ujemny zapas. Aplikacja zgłasza naruszone ograniczenie, gdy relacje pozwoliłyby zadaniu zacząć się później, niż wynosi przypięcie. Samo przypięte zadanie zachowuje zapas 0.
- Następniki liczą się od przypiętego zadania. Mogą więc zacząć się wcześniej niż bez przypięcia, mimo że logika przed nim nie jest skończona. W przykładzie poniżej przez to koniec projektu przesuwa się o trzy dni robocze.

Przy pierwszym włączeniu przypięcia aplikacja pokaże krótkie wyjaśnienie: twarde przypięcie nadpisuje relacje, a pasek jest ustalony w tej dacie, nawet przed jego poprzednikami.

### Ograniczenie drugorzędne

Zadanie ma jedno ograniczenie podstawowe. Jeśli chcesz drugą granicę, na przykład dla zadania, które nie może zacząć się przed 14 czerwca i musi być zakończone najpóźniej 17 czerwca, dodajesz **ograniczenie drugorzędne**. Musi to być prawdziwa granica (SNET, FNET, SNLT lub FNLT). Musi też ograniczać w przeciwnym kierunku niż podstawowe: dolna granica (SNET lub FNET) z górną granicą (SNLT lub FNLT). SNET z SNLT jest więc dozwolone, SNET z FNET nie. Aplikacja zaznacza inne kombinacje na czerwono z powodem, na przykład *Ograniczenie podstawowe i drugorzędne nie mogą ograniczać tej samej strony.* Przy ASAP, ALAP, MSO, MFO i przy twardym przypięciu ograniczenie drugorzędne nie jest dozwolone.

### Termin ostateczny

Termin ostateczny to osobna data przy zadaniu, obok ograniczenia. To górna granica zakończenia. Nic nie przesuwa, ale zapas staje się ujemny, jeśli zadanie nie jest skończone na czas. Aplikacja zgłasza wtedy w panelu *Ostrzeżenia* komunikat *Przekroczono termin … — najwcześniejsze zakończenie …*, a pasek stanu liczy przekroczone terminy. Na wykresie Gantt jest przy dacie terminu strzałka w dół: zielona, dopóki zadanie jest skończone na czas, czerwona, gdy jest spóźnione. Termin w sobotę liczy się aż do piątku przed nim włącznie.

Dla zapasu termin ostateczny działa tak samo jak FNLT. Różnica leży w tym, jak go używasz. Termin ostateczny to docelowa data, którą chcesz pilnować. Stoi osobno od ograniczenia, więc zadanie może mieć i ograniczenie, i termin. FNLT jest ograniczeniem: naruszenie pojawia się jako naruszone ograniczenie, a nie jako przekroczony termin.

### Czego ograniczenie nie robi

- Przy **fazie** (zadanie sumaryczne) ograniczenie ani termin ostateczny się nie liczą: aplikacja oblicza z zadaniami w fazie. Ustaw je na samym zadaniu.
- Zadanie, które ma już rzeczywiste rozpoczęcie albo postęp, zachowuje ten start. SNET z późniejszą datą go nie przesuwa.
- **Wpisanie daty startu** przy zadaniu z poprzednikiem nie działa jako stały start: poprzednik nadal decyduje. Dlatego aplikacja zamienia ją na SNET z wpisaną datą: w panelu *Właściwości*, w oknie *Edytuj zadanie*, w tabeli i gdy przesuniesz pasek na wykresie Gantt. Aplikacja ci o tym mówi. Jeśli zadanie ma już inne ograniczenie (na przykład ALAP lub MSO), aplikacja nowego startu nie stosuje i też ci o tym mówi. Wtedy zmień to ograniczenie.

Wszystkie zmiany widać dopiero po **Oblicz** (F5).

## Przykład

Przykład to mała sieć dla rozbudowy domu. Zaczyna się w poniedziałek 7 czerwca 2027 r.:

- *Groundwork* (3 dni robocze): od poniedziałku 7 do środy 9 czerwca.
- *Pour foundation* (2): czwartek 10 i piątek 11 czerwca.
- *Brickwork* (5): od poniedziałku 14 do piątku 18 czerwca.
- *Roofing* (3): od poniedziałku 21 do środy 23 czerwca.
- *Scaffolding* (2): następuje po *Pour foundation* i jest przed *Roofing*. Trwa w poniedziałek 14 i wtorek 15 czerwca i ma zapas 3 dni roboczych.

Ścieżka krytyczna to *Groundwork*, *Pour foundation*, *Brickwork* i *Roofing*. Projekt jest gotowy w środę 23 czerwca. Co zmienia jedno ograniczenie przy *Brickwork*?

- **SNET poniedziałek 21 czerwca** (cegły przyjadą dopiero wtedy): *Brickwork* trwa od poniedziałku 21 do piątku 25 czerwca, a *Roofing* od poniedziałku 28 do środy 30 czerwca. Projekt jest gotowy w środę 30 czerwca. *Groundwork* i *Pour foundation* mają teraz zapas 5 dni roboczych i nie są już krytyczne, a *Scaffolding* ma zapas 8.
- **SNET środa 9 czerwca**: bez skutku. Relacje i tak pozwalają *Brickwork* zacząć się dopiero w poniedziałek 14 czerwca.
- **SNLT środa 16 czerwca**: bez skutku. *Brickwork* zaczyna się w poniedziałek 14 czerwca i spełnia granicę z zapasem.
- **SNLT piątek 11 czerwca**: za ciasno. *Brickwork* i tak zaczyna się w poniedziałek 14 czerwca, jeden dzień roboczy za późno. *Groundwork*, *Pour foundation* i *Brickwork* dostają zapas −1 dzień roboczy, a aplikacja zgłasza *Ograniczenie Rozpocznij nie później niż (SNLT) 11-06-2027 jest nadpisywane przez logikę (ujemny zapas)*. Nic się nie przesuwa.
- **MSO środa 16 czerwca** (bez twardego przypięcia): *Brickwork* przesuwa się na środę 16 czerwca i jest gotowy we wtorek 22 czerwca. *Roofing* trwa od środy 23 do piątku 25 czerwca, a projekt jest gotowy w piątek 25 czerwca.
- **MSO piątek 11 czerwca** (bez twardego przypięcia): data jest wcześniejsza, niż pozwalają relacje. *Brickwork* i tak zaczyna się w poniedziałek 14 czerwca, a zapas staje się −1, tak samo jak przy SNLT.
- **MSO środa 9 czerwca z twardym przypięciem**: *Brickwork* zaczyna się w środę 9 czerwca i jest gotowy we wtorek 15 czerwca. *Pour foundation* trwa nadal do piątku 11 czerwca. *Roofing* trwa od środy 16 do piątku 18 czerwca: projekt jest gotowy o trzy dni robocze wcześniej niż bez przypięcia. *Groundwork* i *Pour foundation* dostają zapas −3 dni robocze.

A z ograniczeniem albo terminem przy innym zadaniu:

- **ALAP przy** *Scaffolding*: zadanie przesuwa się na czwartek 17 i piątek 18 czerwca, czyli na ostatni moment przed *Roofing*. *Roofing* jest jego jedynym następnikiem i miał dokładnie tyle miejsca, ile wynosi jego zapas: 3 dni robocze. Ten zapas jest teraz zużyty, a *Scaffolding* jest krytyczne.
- **SNET sobota 19 czerwca przy** *Scaffolding*: granica liczy się jako poniedziałek 21 czerwca. *Scaffolding* trwa w poniedziałek 21 i wtorek 22 czerwca, a *Roofing* przesuwa się razem z nim na środę 23 do piątku 25 czerwca.
- **Termin ostateczny piątek 18 czerwca przy** *Roofing*: nic się nie przesuwa, *Roofing* zostaje od poniedziałku 21 do środy 23 czerwca. *Groundwork*, *Pour foundation*, *Brickwork* i *Roofing* dostają zapas −3 dni robocze, a aplikacja zgłasza *Przekroczono termin 18-06-2027 — najwcześniejsze zakończenie 23-06-2027*. *Scaffolding* zachowuje 0 dni roboczych zapasu i też staje się krytyczne.
- **SNET poniedziałek 21 czerwca przy** *Brickwork*, **termin ostateczny piątek 25 czerwca przy** *Roofing*: ograniczenie przesuwa *Brickwork* o tydzień, a termin pokazuje, że *Roofing* jest spóźnione w środę 30 czerwca. *Brickwork* i *Roofing* dostają zapas −3 dni robocze. *Groundwork* i *Pour foundation* zachowują 2 dni robocze.

W samouczku 3 ustawisz sam ograniczenie i termin ostateczny w projekcie samouczka. Zobaczysz, jak harmonogram się przesuwa.

## Konsekwencje i nieporozumienia

**"Ograniczenie przesuwa zadanie."** Tylko SNET, FNET, MSO i MFO mogą ustawić zadanie później niż jego relacje. ALAP może je przesunąć w granicach zapasu swobodnego. SNLT i FNLT nigdy niczego nie przesuwają: tylko ostrzegają. Spełnić datę znaczy wtedy skrócić łańcuch przed nim.

**"Ujemny zapas to usterka w aplikacji."** To sygnał, że harmonogram jest sprzeczny z Twoim uzgodnieniem co do daty. Rozwiązujesz to przez skrócenie łańcucha, złagodzenie uzgodnienia albo świadome zaakceptowanie konfliktu.

**"Twarde przypięcie rozwiązuje konflikt."** Twarde przypięcie ukrywa konflikt. Zadanie jest w tej dacie, ale jego poprzedniki nie są na nie gotowe, a następniki liczą się tak, jakby były. Używaj go tylko dla daty, która naprawdę jest stała, na przykład prawnego terminu przekazania. Nie używaj go, żeby wcisnąć zadanie w datę.

**"Po prostu wpisuję datę startu."** Przy zadaniu z poprzednikiem staje się to SNET. Jeśli ta data jest wcześniejsza, niż pozwala poprzednik, nic nie robi.

**"Termin ostateczny czy FNLT?"** Wybierz termin ostateczny dla docelowej daty, którą chcesz pilnować. Wybierz ograniczenie dla daty, która jest prawdziwym warunkiem granicznym harmonogramu.

**"Ograniczenie na fazie."** To się nie liczy. Ustaw je na samym zadaniu.

## Zobacz też

- [Ustawianie ograniczenia lub terminu ostatecznego](docs://howto-constraint-deadline-zetten): kroki do ustawienia ograniczenia albo terminu ostatecznego.
- [Relacje i opóźnienie](docs://uitleg-relaties): zależności, obok których stoją ograniczenia.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): jak powstaje ujemny zapas i co robi ze ścieżką krytyczną.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): twarde przypięcie (*Musi rozpocząć się*) przy *Municipal road closure (permitted closure period)* i ograniczenie drugorzędne (*Rozpocznij nie później niż*) przy *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): termin ostateczny, który nie jest dotrzymany, z ujemnym zapasem.
