# Daty zapisane w pliku

Otwierasz harmonogram z Primavery albo z MS Project. Daty różnią się od tego, co widziałeś w tamtym programie. Czy import się nie udał? Zwykle nie. W tym artykule czytasz, dlaczego aplikacja sama przelicza, kiedy pokazuje daty z pliku, co wtedy zostaje puste i jak wracasz do jej własnego obliczenia. Przykład na końcu śledzi dwa zadania przez cały proces.

## Pojęcie

Plik harmonogramu zawiera dwa rodzaje danych. Najpierw logikę: zadania, czasy trwania, relacje, kalendarze i ograniczenia. Po drugie daty, które tamten program sam z tego obliczył. Przy otwieraniu Open Planner Studio korzysta z logiki i oblicza samodzielnie. Daty w pliku nie są więc danymi wejściowymi.

Jeśli obliczenie aplikacji kończy się na innych datach niż w pliku, nie wiesz, która strona ma rację. W pliku może brakować logiki, której tamten program użył. Tamten program może też inaczej liczyć niż aplikacja w jakimś punkcie. Dlatego aplikacja może pokazać daty **takie, jak zapisano**: daty, które tamten program zapisał w pliku. Tak porównujesz z tym, co widziałeś w tamtym programie.

## Jak aplikacja to obsługuje

### Którego profilu obliczeń używa aplikacja

Aplikacja oblicza z **profilem obliczeń**: zestawem reguł obliczeń (konwencji), który decyduje na przykład o tym, jak traktuje planowany start zadania i ograniczenia. Zobacz [Profile obliczeń i konwencje](docs://uitleg-rekenprofielen). Są trzy wbudowane profile: *Primavera P6*, *Microsoft Project* i *Open Planner Studio*. Plik `.xer` otwiera się z profilem *Primavera P6*, a plik `.mpp` z profilem *Microsoft Project*. CSV, XML MS Project i XML Primavera P6 otwierają się z profilem *Open Planner Studio*. Profil projektu znajdziesz w *Plik › Info o projekcie*, przy *Profil obliczeń i opcje*. Plik IFC zapisany przez aplikację zachowuje swój profil.

### Kiedy aplikacja porównuje

Przy otwieraniu aplikacja zapisuje, co mówił plik, i porównuje to ze swoim własnym wynikiem. Robi to dla:

- pliku Primavery (`.xer`) i XML Primavera P6;
- XML MS Project i plików MS Project (`.mpp`);
- pliku IFC z innego programu, dla zadań, których najwcześniejsze daty są w pliku;
- pliku IFC zapisanego przez aplikację, który zapamiętał swoje pochodzenie. Niżej czytasz, kiedy tak jest.

Aplikacja nigdy nie porównuje pliku CSV: data startu w CSV jest daną wejściową, a nie wynikiem obliczenia. Plik IFC zapisany przez aplikację, bez zapamiętanego pochodzenia, też nie jest porównywany.

Jeśli żadne zadanie się nie różni, niczego nie zauważysz. Jeśli w pliku, który właśnie importujesz, różni się co najmniej jedno zadanie, aplikacja od razu włącza widok.

Przy pliku Primavery aplikacja oblicza z profilem obliczeń *Primavera P6*. Ten profil zachowuje planowany start z pliku jako najwcześniejsze rozpoczęcie. Zadanie, które w pliku jest późniejsze, niż wymagają relacje, ale ma tam też planowany start, zostaje więc na miejscu: wtedy nie ma różnicy.

### Co widzisz

Pod wstążką jest pasek informacji: *Widzisz daty takie, jak zostały zapisane w pliku; ponowne przeliczenie przesunęłoby 4 zadania.* Przy źródle Primavery (plik `.xer` albo XML Primavera P6) pasek mówi: *Widzisz harmonogram tak, jak zapisał go Primavera; ponowne przeliczenie przesunęłoby 1 zadanie.* Po prawej stronie paska jest przycisk *Przelicz*. Pasek nie ma krzyżyka.

Jest też komunikat: *4 zadania pokazują daty tak, jak zapisano je w pliku (bez ponownego przeliczenia).* Tylko przy pliku `.xer` pisze: *1 zadanie pokazuje daty tak, jak zapisał je Primavera (bez ponownego przeliczenia).* Każde zadanie, dla którego plik zapisał daty, pokazuje znacznik w panelu *Właściwości*: *Pokazuje własne daty zapisane przez Primaverę dla tego zadania* przy źródle Primavery, albo *Pokazuje daty zapisane w pliku dla tego zadania* przy innym źródle. Wykres Gantt, tabela zadań i pasek stanu pokazują daty z pliku.

### Co pozostaje puste w tym widoku

W tym widoku aplikacja niczego nie oblicza. Pokazuje tylko to, co plik zapisał. Zapas i ścieżkę krytyczną widzisz więc tylko wtedy, gdy plik je zawiera. Jeśli plik nie zapisuje zadań krytycznych, pasek stanu pokazuje 0 zadań krytycznych. To nic nie mówi o ścieżce krytycznej w samym programie. Wszystko, co wynika dopiero z obliczenia, w tym widoku nie istnieje: które relacje napędzają harmonogram, naruszone ograniczenia, zadania w niewłaściwej kolejności i zadania prawie krytyczne.

Jeśli plik nie zapisuje wszystkiego dla zadania, widzisz w panelu *Właściwości* znacznik *Zapis jest częściowo niekompletny — zobacz kolumny późnego zakończenia/zapasu*. W eksporcie CSV zostają dla takiego zadania puste kolumny *Krytyczne* i *Zapas całkowity*, zamiast zmyślonego zera.

### Wyjście z widoku

Z widoku wychodzisz na dwa sposoby:

- Kliknij *Przelicz* na pasku informacji albo wybierz *Oblicz* (F5). Aplikacja oblicza według własnych reguł.
- Zmień coś, co może zmienić daty, na przykład czas trwania zadania albo nowe zadanie. Aplikacja opuszcza widok i od razu przelicza, nawet gdy *Oblicz automatycznie* jest wyłączone. Zmiana nazwy tego nie robi: widok zostaje włączony.

Zmiana kalendarza z biblioteki zasobów pozostawia widok włączony i daty z pliku bez zmian, ale aktualizuje liczbę na pasku informacji.

Po wyjściu nie ma przycisku, który wraca do widoku. Ctrl+Z przywraca widok zaraz po przeliczeniu albo zaraz po takiej zmianie. Inaczej możesz ponownie otworzyć plik źródłowy. Przy pliku `.xer` włącza widok ponownie także otwarcie pliku IFC, który zapisałeś po przeliczeniu, ale nie edytowałeś.

### Odzyskiwanie po awarii

Jeśli odzyskujesz projekt po awarii, która zdarzyła się w widoku, widok zostaje włączony. Aktywny projekt pokazuje ten sam pasek co wcześniej. Projekt na innej karcie pokazuje pasek bez liczby: *Widzisz daty takie, jak zostały zapisane w pliku. Nie wykonano ponownego przeliczenia.* Zobacz [Odzyskiwanie po awarii](docs://howto-herstellen-na-een-crash).

### Zapisywanie i ponowne otwieranie

Jeśli zapiszesz, gdy korzystasz z widoku, aplikacja zapisuje wyświetlane daty w pliku IFC razem z formatem źródłowym. Jeśli później ponownie otworzysz ten plik IFC i nie edytowałeś go od importu, widok jest znowu włączony, bez nowego komunikatu.

Jeśli edytowałeś i zapisałeś w międzyczasie, zależy to od źródła. Przy pliku Primavery plik IFC zachowuje oryginalny `.xer`. Aplikacja porównuje wtedy ponownie i proponuje widok: *Ponowne przeliczenie przesunęło 1 z 2 zadań względem dat w pliku.* Towarzyszy temu przycisk *Pokaż zapisane daty* i krzyżyk. Przy każdym zadaniu, które się różni, panel *Właściwości* pokazuje znacznik *Odbiega od zapisanych dat*. *Pokaż zapisane daty* włącza widok; Ctrl+Z to cofa. Krzyżyk ukrywa propozycję.

Przy XML MS Project, pliku `.mpp`, XML Primavera P6 albo pliku IFC z innego programu plik IFC nie zachowuje źródła. Jeśli edytujesz i zapisujesz taki projekt, aplikacja przy ponownym otwarciu już nie porównuje.

## Przykład: przybudówka

Załóżmy, że otwierasz plik Primavery *Uitbouw* (przybudówka) z dwoma zadaniami, w kalendarzu bez świąt. W 2027 roku 6 maja to Wniebowstąpienie Pańskie, a 17 maja Poniedziałek Zielonych Świątek. Ze świętami w kalendarzu daty wychodzą inaczej. *Fundering storten* (wylanie fundamentu) trwa 5 dni roboczych, *Metselwerk* (murowanie) 10 dni roboczych, a Metselwerk następuje po Fundering z relacją zakończenie-rozpoczęcie. Plik zapisuje, że Fundering trwa od poniedziałku 3 maja do piątku 7 maja 2027, a Metselwerk od poniedziałku 17 maja do piątku 28 maja 2027: tydzień później niż najwcześniejsze rozpoczęcie, na które pozwala relacja. Planowany start Metselwerk w pliku to poniedziałek 10 maja 2027.

Zaraz po otwarciu widzisz daty z pliku. Pasek stanu pokazuje *Koniec: 28-05-2027* i *Ścieżka krytyczna: 2 zadania, 20 dni roboczych*. Pasek informacji mówi, że przy przeliczeniu różni się 1 zadanie. Oba zadania pokazują *Pokazuje własne daty zapisane przez Primaverę dla tego zadania*.

Po kliknięciu *Przelicz* Fundering zostaje na 3 do 7 maja. Metselwerk zaczyna się teraz w poniedziałek 10 maja, w następnym dniu roboczym po zakończeniu Fundering, i kończy w piątek 21 maja. Harmonogram kończy się 21 maja 2027 i trwa 15 dni roboczych zamiast 20. Ścieżka krytyczna składa się z tych samych 2 zadań.

Co, jeśli jest inaczej?

- Jeśli Metselwerk jest w pliku także planowany na poniedziałek 17 maja, profil obliczeń *Primavera P6* zachowuje ten start. Obliczenie daje daty od 17 do 28 maja, nie ma różnicy i widok się nie włącza.
- Dodajesz zadanie w widoku: to samo przeliczenie. Metselwerk przesuwa się na 10 do 21 maja.
- Zapisujesz w widoku i ponownie otwierasz plik IFC, bez edycji: Metselwerk wraca na 17 do 28 maja.
- Przeliczasz, zapisujesz bez dalszej edycji i ponownie otwierasz plik IFC: widok jest znowu włączony, a Metselwerk jest na 17 do 28 maja.
- Edytujesz, zapisujesz i ponownie otwierasz: aplikacja proponuje widok z *Ponowne przeliczenie przesunęło 1 z 2 zadań względem dat w pliku.* Metselwerk pokazuje *Odbiega od zapisanych dat*.

## Konsekwencje i nieporozumienia

**Różnica nie jest błędem importu.** Aplikacja oblicza według własnych reguł: przy `.xer` z profilem obliczeń *Primavera P6*, przy `.mpp` z *Microsoft Project*, a przy CSV, XML MS Project i XML Primavera P6 z *Open Planner Studio*. Przyczyna tego, że daty w pliku źródłowym wyszły inaczej, może leżeć w pliku albo w tamtym programie. Widok pokazuje ci *że* się różnią.

**Widok nie jest wynikiem obliczenia.** Aplikacja nie obliczyła tych dat. Nie przyjmuj ich po prostu jako wynik własnego harmonogramu.

**Zapisanie, gdy widok jest włączony, zachowuje daty z programu źródłowego.** Plik IFC zawiera wtedy to, co mówił program źródłowy, a nie to, co obliczyłaby aplikacja.

**Przycisk *Pokaż zapisane daty* nie pojawia się przy każdym imporcie.** Przy nowo otwartym pliku widok jest już włączony. Przycisk pojawia się tylko przy ponownie otwartym pliku IFC ze źródłem Primavery, który edytowałeś od importu.

## Zobacz także

- [Pliki i formaty](docs://uitleg-bestanden): co aplikacja zachowuje w pliku i co niesie import albo eksport.
- [Otwieranie pliku Primavera P6 (.xer)](docs://howto-xer-openen): kroki i komunikaty dla pliku `.xer`.
- [Otwieranie pliku MS Project (.mpp)](docs://howto-mpp-openen): kroki i komunikaty dla pliku `.mpp`.
- [Odzyskiwanie po awarii](docs://howto-herstellen-na-een-crash): co się dzieje z tym projektem po awarii.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): jak aplikacja liczy zapas i krytyczność, kiedy je oblicza.
