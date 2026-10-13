# Ustawianie ograniczenia lub terminu ostatecznego

Cel: zapisz uzgodnioną datę przy zadaniu, aby harmonogram ją uwzględnił albo pokazał, że jej nie dotrzymujesz.

## Kiedy tego potrzebujesz

Cegła jest dostarczana dopiero 21 czerwca, więc murowanie nie może rozpocząć się wcześniej: **ograniczenie** *Rozpocznij nie wcześniej niż*. Dach musi być zamknięty przed świętem budowlanym, a chcesz dostać ostrzeżenie, jeśli to się nie uda: **termin ostateczny**. Wylew jest ustalony na dzień, bo wytwórnia betonu to obiecała: *Musi rozpocząć się*. Który typ pasuje kiedy i co z nim robi aplikacja, wyjaśnia [Ograniczenia i terminy ostateczne](docs://uitleg-constraints).

## Kroki

Ustawiasz ograniczenie i termin ostateczny w panelu *Właściwości*.

1. Wybierz zadanie. Jeśli nie widzisz panelu *Właściwości*, włącz go przez *Widok › Panele › Właściwości*.
2. W polu *Ograniczenie* wybierz typ, na przykład *Rozpocznij nie wcześniej niż (SNET)*.
3. Dla każdego typu oprócz *Jak najwcześniej (ASAP)* i *Jak najpóźniej (ALAP)* pojawia się pole *Data ograniczenia*. Wpisz datę w trzech okienkach: dzień, miesiąc i rok, na przykład 21, 06 i 2027, a potem naciśnij Enter. Aplikacja przechodzi sama do następnego okienka, gdy okienko jest pełne. Po wybraniu typu data jest już wpisana: data poprzedniego ograniczenia albo, w innym przypadku, pierwotny planowany początek zadania. Może się różnić od początku pokazanego w panelu, dlatego zawsze wpisz samodzielnie datę, którą masz na myśli.
4. Jeśli chcesz przypiąć zadanie do tej daty, nawet przed jego poprzednikami, wybierz *Musi rozpocząć się (MSO)* albo *Musi zakończyć się (MFO)* i zaznacz *Obowiązkowe (twarde przypięcie)*. To jest twarde przypięcie; używaj go tylko dla daty, która naprawdę jest ustalona.
5. Jeśli chcesz też drugie ograniczenie, na przykład zadanie, które nie może rozpocząć się przed 14 czerwca i musi zakończyć się do 17 czerwca, wybierz typ w polu *Ograniczenie drugorzędne* i wypełnij pole *Data drugorzędna*. To pole pojawia się przy każdym ograniczeniu z datą, z wyjątkiem twardego przypięcia. Przy MSO i MFO ograniczenie drugorzędne nie jest dozwolone: aplikacja oznacza je wtedy na czerwono.
6. Dla terminu ostatecznego wypełnij pole *Termin ostateczny*, tak samo jak datę ograniczenia. Termin ostateczny jest odrębny od ograniczenia: możesz ustawić oba na tym samym zadaniu.
7. Naciśnij **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*. Do tego czasu pasek stanu pokazuje *Nieaktualne — przelicz (F5)*.

Pola są także w oknie *Edytuj zadanie*, które otwierasz przez kliknięcie zadania prawym przyciskiem myszy i wybranie *Edytuj...*; potwierdzasz przyciskiem *Zapisz*.

W tabeli pracujesz z kolumnami. Kliknij **+** w nagłówku tabeli i w grupie *Ograniczenia* wybierz kolumny *Typ ograniczenia*, *Data ograniczenia* i *Termin ostateczny* (są też *Twarde ograniczenie*, *Typ ograniczenia dodatkowego* i *Data ograniczenia dodatkowego*). Kliknij dwukrotnie komórkę, aby ją edytować: typ wybierasz z listy, a datę wpisujesz z kreskami, na przykład 21-06-2027. *Twarde ograniczenie* można zmienić tylko dla MSO i MFO.

Jeśli zadanie ma poprzednika, jest skrót dla *Rozpocznij nie wcześniej niż*: wpisz nową datę początku w polu *Początek* (w panelu *Właściwości*, w oknie *Edytuj zadanie* albo w tabeli) albo przesuń pasek na wykresie Gantt. Aplikacja sama zamienia to na ograniczenie *Rozpocznij nie wcześniej niż (SNET)* i o tym informuje.

## Sprawdzanie wyniku

- Na wykresie Gantt jest mały romb nad paskiem: po stronie początku przy ograniczeniu początku, a po stronie zakończenia przy ograniczeniu zakończenia: niebieski dla SNET i FNET, fioletowy dla SNLT, FNLT, MSO i MFO, czerwony, gdy ograniczenie jest naruszone. Twarde przypięcie ma pinezkę. Termin ostateczny to strzałka w dół na dacie terminu ostatecznego: zielona, dopóki zadanie jest zakończone na czas, czerwona, gdy jest spóźnione.
- Naruszone ograniczenie lub przekroczony termin ostateczny pojawia się w panelu *Ostrzeżenia* (*Planowanie › Harmonogram › Ostrzeżenia*) i na pasku stanu. *Zapas całkowity* zadania i zadań przed nim jest wtedy ujemny.
- Przy górnej granicy (*Rozpocznij nie później niż*, *Zakończ nie później niż*) albo przy terminie ostatecznym brak ostrzeżenia oznacza, że harmonogram dotrzymuje tej daty.

## Usuwanie ograniczenia lub terminu ostatecznego

W polu *Ograniczenie* wybierz ponownie *Jak najwcześniej (ASAP)*. To usuwa także ograniczenie drugorzędne. Termin ostateczny usuwasz, opróżniając trzy okienka i naciskając Enter. Następnie naciśnij **Oblicz**.

## Pułapki i co robi aplikacja

**Ograniczenie na fazie.** Ograniczenie albo termin ostateczny na fazie (zadanie sumaryczne) nie działa. Umieść go bezpośrednio na zadaniu.

**Zadanie, które już się rozpoczęło.** Jeśli zadanie ma rzeczywiste rozpoczęcie albo postęp, zachowuje swoje rzeczywiste rozpoczęcie. *Rozpocznij nie wcześniej niż* z późniejszą datą go nie przesuwa.

**Wpisanie daty początku przy innym ograniczeniu.** Jeśli zadanie ma poprzednika i już ma inne ograniczenie, na przykład *Jak najpóźniej (ALAP)*, aplikacja nie stosuje wpisanego początku. Komunikat wskazuje to ograniczenie; zmień je, jeśli chcesz przesunąć początek.

**Data w weekend.** Data w sobotę, niedzielę lub dzień wolny zamienia się na dzień roboczy: dolna granica (*Rozpocznij nie wcześniej niż*, *Zakończ nie wcześniej niż*) przechodzi na następny dzień roboczy, górna granica (*Rozpocznij nie później niż*, *Zakończ nie później niż*) na poprzedni.

**Niedozwolone ograniczenie drugorzędne.** Aplikacja oznacza niedozwoloną kombinację na czerwono wraz z powodem, na przykład *Ograniczenie podstawowe i drugorzędne nie mogą ograniczać tej samej strony.* Ograniczenie drugorzędne nie jest dozwolone przy ASAP, ALAP, MSO, MFO i twardym przypięciu.

**Twarde przypięcie.** Przy pierwszym włączeniu aplikacja ostrzega, że twarde przypięcie nadpisuje relacje. Zadanie jest wtedy na tej dacie, nawet przed swoimi poprzednikami; ci poprzednicy dostają ujemny zapas.

**Po ustawieniu nic się nie zmienia.** Ograniczenia działają dopiero po **Oblicz**. Jeśli górna granica (*Rozpocznij nie później niż*, *Zakończ nie później niż*) nie wpływa na paski, to normalne: górna granica niczego nie przesuwa, a gdy data nie jest dotrzymana, sprawia, że zapas jest ujemny.

## Zobacz także

- [Ograniczenia i terminy ostateczne](docs://uitleg-constraints): co robi każdy typ oraz wyjaśnienie twardego przypięcia, ujemnego zapasu i terminu ostatecznego.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): co ujemny zapas robi ze ścieżką krytyczną.
- [Relacje i opóźnienia](docs://uitleg-relaties): relacje, które działają obok ograniczenia.
- [Powiadomienia i ostrzeżenia](docs://ref-meldingen): ostrzeżenia przy naruszonym ograniczeniu lub przekroczonym terminie ostatecznym.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): ograniczenie z pozwolenia *Rozpocznij nie wcześniej niż* przy *Demolish existing extension* (14 maja 2027) i termin ostateczny, który jest dotrzymany z zapasem czasu.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): celowo ciasny termin ostateczny przy *Contractual project handover* (15 lipca 2027): po obliczeniu zakończenie wypada 17 sierpnia, a wiele zadań ma ujemny zapas.
