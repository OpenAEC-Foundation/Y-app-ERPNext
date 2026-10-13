# Podłączanie asystenta AI (MCP)

Cel: asystent AI może czytać i zmieniać Twój harmonogram, z wglądem w to, co robi, i z ograniczeniami, które sam ustawisz.

## Kiedy tego potrzebujesz

Chcesz, żeby asystent AI czytał, analizował lub zmieniał Twój harmonogram. Na przykład: żeby zaproponował pierwszą strukturę WBS, poprawił zadania albo wyjaśnił ścieżkę krytyczną. Dzieje się to przez **Model Context Protocol** (MCP): standard, dzięki któremu asystent AI może używać narzędzi programu. W tym celu Open Planner Studio uruchamia na Twoim komputerze mały serwer, **mostek**. Oferuje zestaw narzędzi, wszystkie o nazwie zaczynającej się od `planner_`: czytanie i zmienianie zadań, relacji, zasobów, kalendarzy, planów bazowych, dokumentów i plików. Jakie są i czego odmawiają, opisano w [Narzędzia AI](docs://ref-ai-tools); dlaczego połączenie działa właśnie tak, opisano w [Jak działa połączenie z AI](docs://uitleg-ai-koppeling).

Mostek działa tylko w aplikacji desktopowej. Jeśli włączysz tryb AI w przeglądarce, zobaczysz kartę *AI*, ale przycisk *Uruchom mostek* jest szary, z tekstem *Mostek działa tylko w aplikacji desktopowej.* Reszta tego artykułu dotyczy aplikacji desktopowej. W przeglądarce są szare także *Utwórz kopię zapasową teraz* i *Otwórz folder kopii zapasowych*.

## Kroki

### 1. Włączanie trybu AI

1. Wybierz *Ustawienia › Projekt › Ustawienia*. Możesz też wybrać *Plik › Ustawienia* albo koło zębate u góry.
2. Wybierz kartę *Zaawansowane* i włącz opcję *Włącz tryb AI*. Karta *AI* pojawia się na wstążce.
3. Jeśli chcesz, żeby mostek był aktywny zaraz po starcie aplikacji, włącz też *Automatycznie uruchamiaj most*. Ta opcja działa tylko wtedy, gdy tryb AI jest włączony, i tylko w aplikacji desktopowej. Domyślnie jest wyłączona, bo otwarcie portu to świadomy wybór.

Jeśli wyłączysz tryb AI, mostek się zatrzyma, a karta *AI* zniknie.

### 2. Uruchamianie mostka

1. Przejdź do karty *AI* i kliknij *Uruchom mostek* pod *Serwer*.
2. Sprawdź status obok przycisku. Pokazuje *Wyłączony*, *Aktywny na porcie 3877*, *Port 3877 zajęty* albo *Błąd*. Jeśli start się uda, pokaże *Aktywny na porcie 3877*, a przycisk nazywa się *Zatrzymaj mostek*. Przy statusie *Port 3877 zajęty* albo *Błąd* przycisk zostaje *Uruchom mostek*; zobacz pułapki poniżej.

Mostek nasłuchuje tylko na Twoim komputerze, na jednym porcie. Domyślnie to 3877. W grupie *Połączenie* możesz wybrać inny port pod *Port*, ale tylko wtedy, gdy mostek jest zatrzymany.

### 3. Łączenie asystenta AI

1. Kliknij *Połącz* pod *Połączenie*. Otwiera się okno *Szczegóły połączenia*.
2. Wybierz, czego potrzebuje Twój klient. Zobacz niżej.
3. Token jest ukryty. Ikoną oka go pokazujesz. Przyciski kopiowania zawsze kopiują prawdziwą wartość, nawet gdy ekran ukrywa token.
4. Poproś asystenta o listę narzędzi. Ta kontrola jest też w poleceniu połączenia: asystent powinien zobaczyć narzędzia z prefiksem `planner_`; oczekiwana liczba jest w poleceniu połączenia.

Okno oferuje trzy sposoby połączenia:

- *Fragment konfiguracji*: fragment konfiguracji, który wklejasz w ustawienia MCP swojego klienta.
- *Polecenie połączenia*: tekst, który wklejasz do asystenta AI; potem połączy się sam.
- *Punkt końcowy* i *Uwierzytelnianie*: osobne dane. Punkt końcowy to `http://localhost:3877/mcp` z transportem *streamable HTTP*. Każde żądanie potrzebuje nagłówka `Authorization: Bearer`, po którym następuje Twój token.

W grupie *Połączenie* jest też pole *Token*. To długi, losowy kod, który aplikacja tworzy dla Ciebie i zapisuje na tym komputerze. W oknie jest napisane: *Ten token daje dostęp do otwartego harmonogramu. Nie udostępniaj go innym.* Przyciskiem *Nowy token* tworzysz nowy token. Aplikacja najpierw pyta: *Wygenerowanie nowego tokenu przerywa wszystkie istniejące połączenia. Kontynuować?* Jeśli mostek działa, uruchamia się ponownie z nowym tokenem, a stary przestaje działać.

### 4. Sprawdzanie, co robi AI

1. Kliknij *Panel aktywności* pod *Aktywność*. W bocznej kolumnie otworzy się panel *Aktywność AI*.
2. Każde wywołanie mostka to jeden wiersz, najnowszy na górze: czas, co się stało, jak długo to trwało i czy się udało. Kliknij wiersz, aby rozwinąć *Argumenty* i *Odpowiedź*.
3. Przyciskiem *Wyczyść* opróżnisz listę. Panel zachowuje ostatnie 500 wywołań. Dopóki nic się nie wydarzyło, pisze: *Brak aktywności AI. Wywołania mostka pojawią się tutaj.*

Przy włączonym trybie AI jest na dole po prawej, na pasku stanu, kropka z napisem *AI*. Jej kolor pokazuje stan mostka, a kliknięcie prowadzi do karty *AI*.

### 5. Ustawianie limitów

Pod *Bezpieczeństwo* są przyciski, którymi ograniczasz AI:

- *Wstrzymaj*: AI tymczasowo nic nie może zmieniać; czytanie nadal wolno. Mostek pozostaje aktywny. Przycisk zmienia się w *Wznów*.
- *Tylko do odczytu*: wszystkie narzędzia, które coś zmieniają, są odrzucane, dopóki ta opcja jest włączona.
- *Automatyczna kopia zapasowa: włączona*: zanim AI pierwszy raz coś zmieni w dokumencie, aplikacja zapisuje kopię zapasową w formacie IFC. Ta opcja jest domyślnie włączona. Przyciskiem ją wyłączysz; wtedy pisze *Automatyczna kopia zapasowa: wyłączona*. Dzieje się to raz na dokument, przy każdym uruchomieniu mostka.
- *Utwórz kopię zapasową teraz*: od razu tworzy kopię zapasową aktywnego dokumentu. Potem pojawia się *Utworzono kopię zapasową:* z nazwą pliku.
- *Otwórz folder kopii zapasowych*: otwiera folder z kopiami zapasowymi.

Kopie zapasowe są w folderze `ai-backups` w folderze danych aplikacji. Aplikacja zachowuje najnowsze kopie zapasowe, a starsze usuwa wybiórczo; dokładnie opisano to w [Narzędzia AI](docs://ref-ai-tools).

### 6. Zadbanie o dobre planowanie przez asystenta

Asystent, który zna narzędzia, może mimo to zbudować harmonogram, z którego żaden planista nie ma pożytku: zadania bez relacji, stała data przy każdym zadaniu albo podział, który jest znacznie za drobny. Dlatego asystent dostaje zasady planowania na trzy sposoby. Przy pierwszych dwóch nic nie musisz robić.

1. **Podstawowe zasady przychodzą same.** Podczas połączenia mostek wysyła krótki tekst z podstawowymi zasadami. Wiele klientów wstawia ten tekst do swojego promptu systemowego; czy Twój tak robi, zależy od klienta. Tekst zawiera m.in. zalecenia: zacznij od kamieni milowych, buduj zadania o czasie trwania od około dnia do dwóch tygodni, steruj harmonogramem relacjami zamiast stałych dat i powiedz na końcu, co założyłeś.
2. **Polecenie połączenia wskazuje pełny przewodnik.** Polecenie połączenia z okna *Szczegóły połączenia* prosi asystenta, aby najpierw przeczytał przewodnik planowania narzędziem `planner_get_planning_guide`. Dostaje wtedy angielski przewodnik dla asystentów: te same zasady co [Dobre planowanie](docs://gids-goed-plannen), a przy każdej zasadzie podano narzędzia, których asystent do niej używa. Sam możesz go przeczytać pod adresem `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Jeśli nie używasz polecenia, zapytaj asystenta sam: *Przeczytaj najpierw przewodnik planowania narzędziem planner_get_planning_guide, zanim cokolwiek zmienisz.*
3. **Opcjonalnie: skille.** Skill to mały plik z instrukcjami, który asystent czyta w każdej sesji. Dzięki temu zna właściwy sposób działania także w późniejszej rozmowie. Są dwa, oba po angielsku: *goed-plannen* do zakładania lub przebudowy harmonogramu oraz *progress-update* do cotygodniowej aktualizacji postępu. Działa to tylko z asystentem, który obsługuje skille; same skille wspominają Claude Code i podobnych asystentów. Każdy skill to plik `SKILL.md` w osobnym folderze, nazwanym jak skill: `.claude/skills/goed-plannen/SKILL.md` i `.claude/skills/progress-update/SKILL.md` w folderze projektu, w którym pracuje asystent, albo te same foldery pod `~/.claude/skills/`, żeby były dostępne w każdym projekcie.

Pliki otrzymasz na dwa sposoby. Poproś asystenta, aby wywołał narzędzie `planner_get_planning_guide` z `part` ustawionym na `skill`: odpowiedź zawiera obie treści i przy każdym skillu miejsca, gdzie ma się znaleźć. Albo pobierz je z `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` i `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Jeśli *goed-plannen* pochodzi jeszcze z starszej wersji aplikacji, zastąp go: ta stara treść jest po holendersku i odsyła do artykułu pomocy zamiast do przewodnika dla asystentów.

Czy asystent naprawdę przeczytał przewodnik, zobaczysz w *Panelu aktywności*: pojawi się wtedy wywołanie `planner_get_planning_guide`. Ostateczna odpowiedź asystenta powinna zawierać listę założeń: szacowane czasy trwania, wybrany podział, relacje, które sam utworzył, i każde ograniczenie, które ustawił. Jeśli tej listy brakuje, poproś o nią. Po aktualizacji postępu według *progress-update* odpowiedź powinna podać datę statusu, nowe zakończenie i odchylenie względem planu bazowego.

## Pułapki i co aplikacja wtedy robi

**AI zmienia coś, co chcesz cofnąć.** Każda zmiana AI to jeden krok, który cofasz przyciskiem *Cofnij* (Ctrl+Z). Seria zmian, które AI przekazuje jako całość, to jeden krok. Potem projekt jest oznaczony jako niezapisany. Po zmianie harmonogram jest ponownie obliczany, więc nie musisz samodzielnie naciskać F5.

**Aplikacja odrzuca wywołanie przez AI.** Przy przyciskach *Wstrzymaj* i *Tylko do odczytu* aplikacja odrzuca wszystkie zmiany, a czytanie pozostaje możliwe, łącznie z przeliczeniem nieaktualnego harmonogramu. Jeśli sam edytujesz, na przykład przeciągasz pasek albo wpisujesz wartość w polu, AI dostaje daty sprzed Twojej edycji wraz z informacją, że są nieaktualne. Jeśli masz otwarte okno dialogowe, na przykład ustawienia, okno zadania albo okno powitalne, lub włączony jest tryb prezentacji, aplikacja odrzuca wszystkie wywołania, także czytanie, dopóki nie zamkniesz okna. AI dostaje wtedy komunikat o błędzie z wewnętrzną nazwą tego, co jest otwarte, na przykład `showTaskDialog`. Działa tylko `planner_get_planning_guide`, bo nie czyta Twojego harmonogramu.

**Przełączasz karty, gdy AI pracuje.** AI pracuje w dokumencie, w którym trafiła jego pierwsza zmiana. Jeśli w międzyczasie przełączysz karty, aplikacja odrzuci kolejną zmianę, dopóki AI nie potwierdzi, że chce pracować na innej karcie. Dzięki temu nic nie trafi do złego projektu.

**AI zapisuje lub otwiera plik.** AI może zapisać harmonogram jako plik IFC i otworzyć plik harmonogramu jako nową kartę. Robi to tylko w Twoim folderze użytkownika. Nadpisuje istniejący plik tylko wtedy, gdy wyraźnie o to poprosi.

**Status to *Port 3877 zajęty*.** Inny program używa tego portu. Komunikat aplikacji pokazuje się pod nim. Pole portu pozostaje wtedy zablokowane (*Edytowalne tylko przy zatrzymanym serwerze.*), mimo że mostek nie działa, i nie ma przycisku zatrzymania. To znana wada. Do czasu naprawy: wyłącz *Włącz tryb AI* i włącz go ponownie. Status wraca wtedy do *Wyłączony*, a Ty możesz wybrać inny port. Skopiuj potem szczegóły połączenia jeszcze raz, bo punkt końcowy zawiera port.

**Klient nie może się połączyć po nowym tokenie.** Nowy token przerywa wszystkie istniejące połączenia. Podaj klientowi nowy token albo wklej ponownie fragment konfiguracji.

**Sam zatrzymałeś mostek, a on się nie uruchamia sam.** *Automatycznie uruchamiaj most* działa raz przy każdym starcie aplikacji. Jeśli sam zatrzymasz mostek, aplikacja nie włączy go znowu po cichu.

**Karta *AI* zniknęła.** Tryb AI jest wyłączony. Włącz go w kroku 1.

**Strona internetowa w przeglądarce nie może rozmawiać z mostkiem.** Mostek odrzuca każde żądanie pochodzące z przeglądarki oraz każde żądanie bez właściwego tokenu.

## Zobacz także

- [Przekazywanie uwag](docs://howto-feedback-geven): jeśli połączenie działa inaczej, niż tu opisano, zgłoś to.
- [Jak działa połączenie z AI](docs://uitleg-ai-koppeling): czym jest połączenie, dlaczego asystent pracuje w otwartym projekcie i czego nie może robić.
- [Narzędzia AI](docs://ref-ai-tools): wszystkie narzędzia `planner_*` według grupy, kody błędów i jak długo kopie zapasowe są przechowywane.
- [Dobre planowanie](docs://gids-goed-plannen): zasady planowania; asystent dostaje je w wersji angielskiej z dodanymi narzędziami.
- [Ustawienia](docs://ref-instellingen): ustawienia AI.
