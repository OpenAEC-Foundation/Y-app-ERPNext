# Nowy projekt i Info o projekcie

Pola okna *Nowy projekt* i *Info o projekcie*: co robi każde pole, jaka jest wartość domyślna i gdzie ma skutek. To dwie strony tego samego formularza. *Nowy projekt* tworzy nowy projekt i ma kilka dodatkowych pól. *Info o projekcie* zmienia projekt, który masz otwarty.

## Otwieranie

**Nowy projekt** — *Plik › Nowy*, Ctrl+N, albo plus po prawej stronie kart dokumentów (*Rozpocznij projekt*, potem *Nowy projekt*). Okno otwiera się z kursorem w polu *Nazwa projektu*.

**Info o projekcie** — *Ustawienia › Projekt › Info o projekcie* otwiera formularz jako okno o tytule *Informacje o projekcie*. *Plik › Info o projekcie* pokazuje ten sam formularz na ekranie *Plik*. Blok *Profil obliczeń i opcje* jest na dole, w obu miejscach. Co w nim jest, opisuje [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies).

## Tworzenie, zastosowanie i anulowanie

**Utwórz** (w oknie *Nowy projekt*) tworzy projekt i otwiera go na własnej karcie. **Zastosuj** (w oknie *Info o projekcie*) zapisuje Twoje zmiany w projekcie.

- **Tylko po kliknięciu przycisku *Zastosuj*.** Wpisujesz w wersji roboczej. Projekt zmienia się dopiero wtedy, gdy klikniesz *Zastosuj*. *Zastosuj* zapisuje tylko to, co naprawdę zmieniłeś, jako jeden krok, który cofniesz przyciskiem *Cofnij*. Jeśli klikniesz *Zastosuj* bez zmian, nic się nie dzieje i krok nie jest dodawany.
- **Anuluj, krzyżyk i Esc** zamykają okno bez zapisywania czegokolwiek. Kliknięcie obok okna go nie zamyka: to, co wpisałeś, zostaje.
- **Enter** działa tak samo jak *Utwórz* albo *Zastosuj*, z wyjątkiem pola *Opis* i otwartej listy rozwijanej.
- **Na ekranie Plik** *Info o projekcie* pokazuje na dole *Zmiany nie zostały zastosowane — kliknij Zastosuj, aby je zachować.* dopóki wersja robocza się różni. Jeśli potem opuścisz ekran, aplikacja pyta, czy chcesz zastosować, odrzucić, czy anulować. Zobacz [Wstążka, karta po karcie](docs://ref-lint).
- **Własny profil obliczeń bez nazwy** blokuje *Zastosuj* i *Utwórz*. Nadaj mu nazwę albo odrzuć zmianę.

## Pola w obu oknach

**Nazwa projektu** — nazwa projektu w pasku tytułu, na karcie i w nazwie pliku, gdy go zapiszesz. Domyślnie: puste. Puste pole jest dozwolone: projekt nazywa się wtedy *Nowy harmonogram*, pokazany szarym tekstem w polu. Gdzie: na całym ekranie.

**Opis** — tekst dowolny. Domyślnie: puste. Skutek: zapisywany z projektem, w pliku IFC i w eksporcie do Primavera P6 XML. Nie wpływa na harmonogram.

**Autor** — tekst dowolny. Domyślnie: puste. Skutek: trafia do pliku IFC i pojawia się jako *Autor:* w nagłówku raportu, gdzie nie możesz go ponownie wpisać.

**Biblioteka zasobów** — z którą bibliotekę zasobów projekt jest połączony. Wybierz z: *brak (projekt niezależny)*, Twoje istniejące biblioteki albo *+ Nowa biblioteka zasobów…*. Domyślnie: w oknie *Nowy projekt* domyślna biblioteka, w oknie *Info o projekcie* obecne powiązanie. Skutek: zobacz [Korzystanie z biblioteki zasobów](docs://howto-resourcebibliotheek-gebruiken). Przy wyborze opcji *+ Nowa biblioteka zasobów…* wpisujesz nazwę w polu poniżej. Biblioteka powstaje dopiero po kliknięciu przycisku *Utwórz* albo *Zastosuj*, więc anulowanie nic nie zostawia. Powiązanie w *Info o projekcie* zmienia się tylko wtedy, gdy sam dotkniesz tego pola.

**Klient/organizacja** — tekst dowolny. Domyślnie: puste. Skutek: trafia do pliku IFC i pojawia się jako *Firma:* w nagłówku raportu.

**Data rozpoczęcia** — początek projektu. Domyślnie: w oknie *Nowy projekt* dzisiaj. Co robi to pole, opisuje *Co robi data rozpoczęcia* poniżej.

**Data zakończenia** — planowany koniec projektu. Domyślnie: puste. Skutek: to informacja, nie wymaganie. Aplikacja nie planuje do tej daty. Pojawia się w nagłówku raportu i w eksportach. Określa też, do którego roku są generowane święta. Tylko przy pliku Primavera z ustawieniem *Licz zapas do daty zakończenia projektu* (zobacz [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies)) obliczanie zapasu sięga do tej daty.

**Domyślna jednostka nowych zadań** — widoczna tylko wtedy, gdy włączone jest *Włącz planowanie godzinowe*. Wybierz *Dni* albo *Godziny*. Domyślnie: *Dni*. Skutek i warunki: zobacz [Włączanie planowania godzinowego](docs://howto-urenplanning-aanzetten).

**Profil obliczeń i opcje** — w oknie *Info o projekcie* cały blok. W oknie *Nowy projekt* tylko listę rozwijaną *Profil obliczeń* z *Primavera P6*, *Microsoft Project* i *Open Planner Studio*. Domyślnie: *Open Planner Studio*. Wybór profilu ustawia też domyślne opcje tego profilu. Zobacz [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies).

## Tylko w oknie *Nowy projekt*

**Szablon faz** — które fazy projekt ma na początku. Wybierz z *Pusty*, *Budownictwo mieszkaniowe* i *Budownictwo użytkowe / remont*. Domyślnie: *Pusty*. Skutek: *Pusty* daje projekt bez zadań. Pozostałe dwa dodają osiem gotowych zadań faz. Każde ma czas trwania 5 w domyślnej jednostce projektu (5 dni roboczych albo 5 godzin, jeśli w polu *Domyślna jednostka nowych zadań* wybierzesz *Godziny*). Zadania nie mają relacji. Nazwy zmieniasz, przenosisz i rozszerzasz sam. Dla szablonu *Budownictwo mieszkaniowe* są to: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking i Oplevering. Dla szablonu *Budownictwo użytkowe / remont*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen i Oplevering. Te nazwy są danymi Twojego projektu i pozostają po holendersku, także przy innym języku interfejsu. Gdy *Włącz tryb budowlany* jest wyłączone, istnieje tylko *Pusty*. Zobacz [Ustawienia](docs://ref-instellingen).

**Zmiana** — widoczna tylko wtedy, gdy włączone jest *Włącz planowanie godzinowe*. Wybierz z *Zmiana dzienna*, *2 zmiany*, *3 zmiany* i *24/7*. Domyślnie: *Zmiana dzienna*. Skutek: *Zmiana dzienna* zostawia standardowy kalendarz bez zmian, czyli zwykły kalendarz dzienny od poniedziałku do piątku. Pozostałe trzy wstawiają pasma czasu pracy do kalendarza projektu, tak jak przyciski o tej samej nazwie w oknie *Kalendarze*. Jakie to godziny, opisuje [Ustawianie godzin pracy](docs://howto-werktijden-instellen). Przy ustawieniu *Zmiana dzienna* nie można wybrać *Godziny* w polu *Domyślna jednostka nowych zadań*, bo kalendarz dzienny nie ma bloków pracy.

**Zestaw świąt** — które dni wolne ma kalendarz projektu. W polu *Kraj* wybierasz jedną z pozycji: *Holandia* (domyślnie), *Niemcy*, *Belgia*, *Francja*, *Wielka Brytania*, *Austria*, *Szwajcaria*, *Bez świąt* albo *Niestandardowy…*. Jeśli kraj ma regiony, dodaje się listę rozwijaną *Region*. Dla Holandii wybierasz też, gdy włączone jest *Włącz tryb budowlany*, *Urlop budowlany*: *Brak* (domyślnie), *Północ*, *Środek* albo *Południe*. Pod tym jest wiersz w rodzaju *36 świąt, 2025–2029*. Rozwiń go, aby zobaczyć listę. Lata obejmują rok przed datą rozpoczęcia do roku po dacie zakończenia. Gdy nie ma daty zakończenia, obejmują trzy lata po roku rozpoczęcia. *Niestandardowy…* daje kalendarz bez świąt i otwiera zaraz po utworzeniu okno *Kalendarze*, żebyś sam mógł je uzupełnić. Kalendarz projektu nazywa się *Bouwkalender NL*, albo *Standaardkalender*, gdy *Włącz tryb budowlany* jest wyłączone. Wtedy wybór obejmuje też *Bez świąt*. Jak działa generator, opisuje [Generowanie świąt i urlopu budowlanego](docs://howto-feestdagen-genereren).

## Co robi data rozpoczęcia

Data rozpoczęcia jest punktem odniesienia projektu. Trzy zasady:

- **Nowe zadania zaczynają się w dniu rozpoczęcia.** Zadanie, które dodasz, zaczyna się planowo w dniu początku projektu.
- **Zadanie z poprzednikiem nigdy nie zaczyna się przed datą rozpoczęcia.** Jeśli koniec poprzednika jest wcześniejszy, zadanie czeka do daty rozpoczęcia. Zadanie *bez* poprzednika zachowuje swoją datę, nawet jeśli leży przed datą rozpoczęcia. Tak jest potrzebne, aby pokazać harmonogram z MS Project albo Primavera tak, jak pokazuje go program źródłowy. Ograniczenie *Musi rozpocząć się (MSO)* albo *Musi zakończyć się (MFO)* łamie obie zasady: takie zadanie stoi na swojej dacie, nawet jeśli wypada przed datą rozpoczęcia.
- **Późniejsza data rozpoczęcia przesuwa luźne zadania.** Jeśli ustawisz późniejszą datę rozpoczęcia w oknie *Info o projekcie* i klikniesz *Zastosuj*, zadania bez poprzednika i bez ograniczenia, które ustawia dolną granicę (*rozpocznij nie wcześniej niż*, *musi rozpocząć się*, *zakończ nie wcześniej niż* albo *musi zakończyć się*), przesuwają się na nową datę, jeśli leżały przed nią. Dzieje się to w tym samym kroku w *Cofnij*. Aplikacja mówi, ile zadań przesunęła. Dzieje się to tylko wtedy, gdy sam zmienisz datę rozpoczęcia, nigdy przy otwieraniu pliku. Późniejsza data rozpoczęcia nie przesuwa reszty harmonogramu. To robi polecenie *Przesuń projekt*, zobacz [Przesuwanie projektu](docs://howto-project-verplaatsen).

## Zobacz także

- [Opcje obliczeń i konwencje](docs://ref-rekenopties-en-conventies): blok *Profil obliczeń i opcje*.
- [Profile obliczeń i konwencje](docs://uitleg-rekenprofielen): dlaczego profil zmienia wynik.
- [Przesuwanie projektu](docs://howto-project-verplaatsen): cały harmonogram na inny początek.
- [Dodawanie zadań i kamieni milowych](docs://howto-taken-en-mijlpalen-toevoegen): zaczynanie od pierwszych zadań.
- [Generowanie świąt i urlopu budowlanego](docs://howto-feestdagen-genereren): zestaw świąt w szczegółach.
