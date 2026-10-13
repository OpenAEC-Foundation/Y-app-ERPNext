# Instalowanie i zarządzanie rozszerzeniem

Cel: zainstalować rozszerzenie, przeczytać pytanie o uprawnienia i później rozszerzenie wyłączyć lub usunąć.

## Kiedy tego potrzebujesz

Rozszerzenie dodaje coś do aplikacji, bez czekania na nową wersję. Rozszerzenie może na przykład dodać format importu, który pojawia się w *Plik › Importuj*. Może też umieścić przycisk na wstążce albo dostarczyć czcionkę do eksportu PDF. Oficjalny katalog dzieli rozszerzenia na kategorie: *Import/Eksport*, *Planowanie*, *Raportowanie*, *Narzędzia*, *Czcionki* i *Inne*.

Zastanów się dokładnie, zanim zainstalujesz rozszerzenie. Rozszerzenie to kod programu, który działa z tymi samymi uprawnieniami co sama aplikacja. Aplikacja tego nie może ograniczyć. Dlatego pyta o zgodę przy każdej instalacji. Co zobaczysz w tym pytaniu, wyjaśniamy poniżej.

## Kroki

### Instalowanie rozszerzenia z katalogu

1. Wybierz *Plik › Rozszerzenia*.
2. Wybierz kartę *Przeglądaj*. Aplikacja pobiera katalog. Podczas pobierania widzisz *Ładowanie katalogu...*. Co jest w katalogu, ustala Fundacja OpenAEC, która go prowadzi. Ta zawartość może się zmienić.
3. Wyszukaj rozszerzenie w polu *Szukaj rozszerzeń...*. Aplikacja szuka po nazwie, opisie, autorze i tagach.
4. Każda karta pokazuje nazwę, wersję, kategorię, opis i autora. Kliknij *Zainstaluj*.
5. Otwiera się okno *Zainstalować rozszerzenie?*. Przeczytaj je. Zobacz następny krok.
6. Kliknij *Zainstaluj*, aby kontynuować. Przy przycisku *Nie instaluj* nic się nie dzieje. Naciśnięcie Esc albo kliknięcie obok okna też oznacza odmowę. Aplikacja wtedy nie pokazuje komunikatu o błędzie.

Po instalacji rozszerzenie jest od razu włączone. Na karcie w zakładce *Przeglądaj* jest teraz napis *Zainstalowane*. Co rozszerzenie dodaje, zobaczysz w samej aplikacji: nowy przycisk na wstążce albo format importu w *Plik › Importuj*. Niektóre rozszerzenia też pokazują komunikat. Poznasz go po przedrostku *Rozszerzenie*, a potem nazwie rozszerzenia.

### Instalowanie rozszerzenia z pliku

Jeśli dostałeś rozszerzenie jako plik, zainstaluj je tak.

1. Wybierz *Plik › Rozszerzenia*.
2. W prawym górnym rogu kliknij *ZIP* dla pliku ZIP albo *JS* dla osobnego pliku JavaScript.
3. Wybierz plik. Otwiera się okno *Zainstalować rozszerzenie?*, jak wyżej.

Plik ZIP musi zawierać `manifest.json` oraz główny plik rozszerzenia. Jeśli zainstalujesz rozszerzenie, które już jest zainstalowane, nowa wersja zastępuje starą. Jeśli aplikacja nie może zainstalować pliku, na przykład dlatego, że plik ZIP jest uszkodzony, nic się nie dzieje. Aplikacja nie pokazuje wtedy komunikatu o błędzie dla ZIP i JS, a rozszerzenie nie pojawia się na liście. Przyczynę znajdziesz jednak w terminalu debugowania. Włącz go w *Ustawienia › Projekt › Ustawienia*, karta *Zaawansowane*, *Włącz terminal debugowania*. Otwórz go przyciskiem *Pokaż terminal debugowania* na pasku stanu. Tam zobaczysz na przykład: *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (aplikacja pisze ten techniczny tekst po holendersku).

### Czytanie pytania o uprawnienia

Pytanie pokazuje, co musisz zdecydować.

- *Autor* i *Repozytorium* mówią, kto zrobił rozszerzenie i gdzie jest jego kod źródłowy.
- *Pochodzenie* mówi, skąd pochodzi plik: *Z internetowego katalogu rozszerzeń*, *Z pliku ZIP na tym komputerze* albo *Z pliku JavaScript na tym komputerze*. Pod tym napisem widzisz, czy plik jest sprawdzony. Dla katalogu jest napis *Pobranie zweryfikowano sumą kontrolną z katalogu.* Jeśli katalog nie podaje sumy kontrolnej, pojawia się na czerwono napis *Katalog nie podaje sumy kontrolnej — tego pobrania nie zweryfikowano.* Dla pliku, który wybrałeś sam, jest napis *Ten plik wybrałeś samodzielnie; nie ma zewnętrznego źródła do weryfikacji.*
- *Na co się zgadzasz* mówi: *Rozszerzenie to kod, który działa z tymi samymi uprawnieniami co sam Open Planner Studio. Nic go nie ogranicza. Instaluj tylko rozszerzenia, których autorowi ufasz.* Pod spodem jest napisane, co to znaczy na Twojej platformie. W aplikacji desktopowej: *W aplikacji desktopowej obejmuje to: odczyt i zapis plików w całym folderze użytkownika oraz dostęp do projektów, ustawień i schowka.* W przeglądarce: *W przeglądarce oznacza to: dostęp do zapisanych projektów i ustawień, do plików, na które udzielono dostępu, oraz do sieci.*
- *Co to rozszerzenie deklaruje* pokazuje uprawnienia, które zadeklarował autor. Są to małe etykiety. To nie jest ograniczenie. Aplikacja mówi: *To deklaracja autora, a nie ograniczenie — kod i tak może więcej.* Jeśli nie ma etykiet, pojawia się napis *Nic nie zadeklarowano.* To nie znaczy, że rozszerzenie nic nie może zrobić. Nawet bez etykiet rozszerzenie może czytać i zmieniać dane harmonogramu oraz pokazywać komunikaty.

Etykiety znaczą:

- *ribbon*: rozszerzenie umieszcza przyciski na wstążce.
- *events*: rozszerzenie nasłuchuje zdarzeń w aplikacji.
- *backstage*: rozszerzenie dodaje formaty importu do *Plik › Importuj*.
- *pdf-fonts*: rozszerzenie dostarcza czcionkę do eksportu PDF.
- *importSource*: rozszerzenie może czytać pełne oryginalne bajty każdego importowanego pliku, na przykład surowy plik Primavera, także pola, które nie trafiają do projektu. Samo okno to też wyjaśnia.
- *help*: rozszerzenie może dodawać artykuły pomocy, otwierać dołączone projekty jako nowy dokument i pokazywać przewodnik, który wskazuje części aplikacji. Samo okno to też wyjaśnia.
- *filesystem* i *network*: to tylko wskazówki, do czego autor chce użyć rozszerzenia. Aplikacja nie ma dla nich żadnej funkcji.

### Wyłączanie, ponowne włączanie lub usuwanie rozszerzenia

1. Wybierz *Plik › Rozszerzenia* i kartę *Zainstalowane*. Każde rozszerzenie ma kartę z nazwą, wersją, kategorią, opisem i autorem.
2. Przełącznikiem na karcie wyłączasz rozszerzenie (*Wyłącz*) albo włączasz je ponownie (*Włącz*). Gdy rozszerzenie jest wyłączone, znikają przyciski i formaty importu, które dodało. Rozszerzenie zostaje jednak zainstalowane. Również po ponownym uruchomieniu aplikacji pozostaje wyłączone. Włączone rozszerzenie uruchamia się samo, gdy startuje aplikacja.
3. Kliknij *Usuń*. Przycisk zmienia się w *Potwierdź*. Pod nim jest wyjaśnienie: *Kliknij ponownie, aby trwale usunąć.* Kliknij jeszcze raz, aby usunąć rozszerzenie. Aplikacja usuwa też ustawienia, które rozszerzenie zapisało.

## Typowe problemy i co wtedy robi aplikacja

**Katalog się nie wczytuje.** Pojawia się napis *Nie udało się wczytać katalogu:* z technicznym powodem na końcu oraz przycisk *Spróbuj ponownie*. Może to być spowodowane brakiem połączenia z internetem.

**Pod kartą w katalogu pojawia się napis *Instalacja nie powiodła się.*** Pobieranie albo instalacja nie powiodły się, na przykład dlatego, że suma kontrolna się nie zgadzała. Wtedy nic nie zostało zainstalowane. To jest coś innego niż odmowa w pytaniu. Tam nie ma komunikatu o błędzie.

**Nad listą widać *Pominięte pozycje katalogu: 1*.** Katalog zawierał pozycję, której aplikacja nie może użyć. Pozostałe rozszerzenia możesz zainstalować jak zwykle.

**Rozszerzenie się nie uruchamia.** Karta pokazuje wtedy komunikat o błędzie. Na przykład: rozszerzenie wymaga nowszej wersji Open Planner Studio, a aplikacja pokazuje Twoją obecną wersję. Może też pokazać błąd, który zgłosiło samo rozszerzenie. Rozszerzenie wtedy nie jest aktywne. Zaktualizuj aplikację albo usuń rozszerzenie.

**Karta z napisem *Kwarantanna*.** Aplikacja nie mogła użyć zapisanego rozszerzenia. Pod nazwą jest napis *Przyczyna:* z powodem. Przyciskiem *Usuń z pamięci* je wyczyścisz.

**Samodzielne pisanie rozszerzenia.** Przewodnik dla autorów rozszerzeń (manifest, API, uprawnienia) znajdziesz w repozytorium `OpenAEC-Foundation/open-planner-studio` na GitHubie, w pliku `docs/extensions.md`.

**Rozszerzenie nie należy do projektu.** Rozszerzenia są zapisane w aplikacji: w aplikacji desktopowej na tym komputerze, w przeglądarce w pamięci tej przeglądarki. Działają we wszystkich Twoich projektach i nie zapisują się w pliku projektu. Jeśli wyczyścisz dane witryny w przeglądarce, rozszerzenia znikną.

## Zobacz także

- [Aktualizowanie aplikacji](docs://howto-app-bijwerken): rozszerzenie może wymagać nowszej wersji aplikacji.
- [Uprawnienia rozszerzeń](docs://ref-extensiepermissies): co oznacza każde uprawnienie w pytaniu o instalację.
