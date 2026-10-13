# Otwieranie i zapisywanie pliku

Cel: otworzyć projekt z pliku i zachować zmiany.

## Kiedy tego potrzebujesz

Zaczynasz dzień od wczorajszego projektu, dostajesz plik od kolegi albo z innego pakietu, albo chcesz zapisać stan pośredni, zanim zmienisz coś dużego. Co aplikacja zapisuje w pliku i dlaczego tylko IFC zachowuje cały projekt, jest wyjaśnione w [Pliki i formaty](docs://uitleg-bestanden).

## Kroki

### Otwieranie pliku

1. Wybierz *Start › Plik › Otwórz*, *Plik › Otwórz* albo naciśnij Ctrl+O (⌘+O na Macu). *Otwórz* jest też na pasku u samej góry. Grupa *Plik* jest też na karcie *Tabela*.
2. Wybierz plik. Otwierasz jeden plik naraz. W aplikacji na komputerze i w przeglądarkach z dostępem do plików, takich jak Chrome i Edge, okno pokazuje listę typów plików: *Wszystkie obsługiwane*, *Pliki IFC*, *Pliki CSV*, *Pliki XML*, *Pliki MS Project* i *Pliki Primavera XER*.
3. Projekt otwiera się na nowej karcie. Jeśli bieżąca karta była jeszcze pusta i bez zmian, projekt otwiera się na niej.

Plik IFC nadaje swoją nazwę karcie. Projekt z innego formatu dostaje nazwę projektu.

Aplikacja otwiera `.ifc`, `.csv`, `.xml` (MS Project XML lub Primavera P6 XML), `.mpp` i `.xer`. Dla dwóch ostatnich są osobne kroki w [Otwieranie pliku MS Project (.mpp)](docs://howto-mpp-openen) i [Otwieranie pliku Primavera P6 (.xer)](docs://howto-xer-openen).

### Otwieranie ostatniego projektu

Wybierz *Start › Plik › Ostatnie* i kliknij plik na liście, albo wybierz *Plik › Ostatnie*. Lista zachowuje ostatnie dziesięć plików, które otwierasz, zapisujesz lub eksportujesz. Aplikacja na komputerze pokazuje ścieżkę przy każdym pliku, przeglądarka tylko nazwę.

Jeśli aplikacja nie może już odczytać pliku z listy, na przykład dlatego że go przeniosłeś, plik znika z listy bez komunikatu. W przeglądarkach bez dostępu do plików, takich jak Firefox, *Ostatnie* pozostaje puste.

### Otwieranie przykładu

Wybierz *Plik › Przykłady* i kliknij przykładowy projekt. Otwiera się na karcie, bez pliku: *Zapisz* dlatego pyta, gdzie chcesz go zachować.

### Zapisywanie

Wybierz *Start › Plik › Zapisz* albo *Plik › Zapisz*, lub naciśnij Ctrl+S. Co wtedy się dzieje, zależy od projektu:

1. Jeśli projekt ma już plik, bo otworzyłeś plik IFC albo zapisałeś go wcześniej, aplikacja zapisuje do tego pliku. Okno się nie pojawia.
2. Jeśli projekt nie ma jeszcze pliku, aplikacja pyta, gdzie ma go zapisać. Proponuje nazwę projektu z `.ifc`. Potem ten plik staje się plikiem projektu.
3. Jeśli przeglądarka zapisuje tylko przez pobieranie (jak Firefox), plik trafia do folderu pobranych, a każdy zapis tworzy nowe pobranie. Za pierwszym razem w sesji widzisz komunikat *Zapisano jako pobranie: „name.ifc” jest w folderze pobranych. Ta przeglądarka nie pozwala aplikacji zapisywać we własnym miejscu, dlatego każdy zapis tworzy nowe pobranie. W Chrome, Edge lub aplikacji na komputerze Zapisz po prostu aktualizuje ten sam plik.*
4. Jeśli przeglądarka nie może zapisać z powrotem do pliku projektu, aplikacja pyta przy każdym zapisie, gdzie umieścić plik. Wygląda to jak *Zapisz jako*, ale to ograniczenie przeglądarki. Za pierwszym razem w sesji komunikat *Ta przeglądarka nie pozwala aplikacji zapisać z powrotem do „name.ifc”.* to wyjaśnia, z linkiem do [Pliki](docs://uitleg-bestanden).

Po zapisaniu znika znacznik *Niezapisane*: kropka na karcie, gwiazdka przed nazwą projektu u góry i tekst *Niezapisane* w prawym dolnym rogu paska stanu.

### Zapisywanie pod inną nazwą

Wybierz *Start › Plik › Zapisz jako* albo *Plik › Zapisz jako*, lub naciśnij Ctrl+Shift+S. Wybierz nazwę i miejsce (w Firefoksie aplikacja zamiast tego pobiera nowy plik). Potem projekt pracuje z tym nowym plikiem: następne *Zapisz* zapisuje tam. Stary plik zostaje taki, jaki był, kiedy ostatnio zapisywałeś.

### Zamykanie projektu

Kliknij krzyżyk na karcie albo wybierz *Plik › Zamknij projekt*. Jeśli projekt ma zmiany, których nie zapisałeś, aplikacja pyta: *Niezapisane zmiany: „name” ma zmiany, które jeszcze nie zostały zapisane.* Wybierasz *Anuluj* (projekt zostaje otwarty), *Nie zapisuj* (projekt się zamyka, a Twoje zmiany przepadają) albo *Zapisz* (najpierw zapisz, potem zamknij). Jeśli zamkniesz całą aplikację na komputerze (przyciskiem zamknięcia, Alt+F4 albo menu systemu operacyjnego), pyta to przy każdym projekcie ze zmianami; *Anuluj* albo zapis, który się nie udaje, zatrzymuje zamykanie. Po takim normalnym zamknięciu aplikacja usuwa kopie odzyskiwania tej sesji, dlatego okno odzyskiwania pojawia się tylko po prawdziwej awarii. Jeśli projekt ma zmiany, a zamkniesz kartę lub okno przeglądarki, przeglądarka prosi o potwierdzenie.

## Pułapki i co wtedy robi aplikacja

**Otwarty plik IFC od razu staje się plikiem Twojego projektu.** *Zapisz* nadpisuje ten plik, także gdy pochodzi z innego programu. Jeśli chcesz zachować oryginał, najpierw wybierz *Zapisz jako*.

**Inne formaty nigdy nie są nadpisywane.** Po otwarciu pliku `.csv`, `.xml`, `.mpp` lub `.xer` projekt nie ma pliku. *Zapisz* zapisuje nowy plik IFC i nie rusza oryginału.

**W Firefoksie każdy zapis tworzy nowy plik.** Aplikacja nie może tam zapisywać do Twojego pliku. Za każdym razem pobiera nowy plik, z nazwą projektu jako nazwą pliku, a nie z nazwą pliku, który otworzyłeś.

**Chrome i Edge pytają o zgodę.** Przy pierwszym *Zapisz* pliku, który otworzyłeś, przeglądarka pyta, czy aplikacja może do niego pisać. Jeśli odmówisz, aplikacja otwiera okno, w którym wybierasz nowy plik. W Chrome i Edge dostajesz to okno także wtedy, gdy zapis do istniejącego pliku się nie uda, na przykład dlatego że plik zniknął albo jest zablokowany.

**Zapisywanie może się nie udać.** Jeśli sam zapis daje błąd, aplikacja pokazuje *Nie udało się zapisać* z powodem. Twój projekt zostaje otwarty i nadal jest oznaczony jako *Niezapisane*.

## Zobacz też

- [Pliki i formaty](docs://uitleg-bestanden): co zawiera plik IFC i jak aplikacja traktuje formaty.
- [Włączanie automatycznego zapisu](docs://howto-automatisch-opslaan): pozwolenie aplikacji na samodzielne aktualizowanie Twojego pliku.
- [Eksportowanie](docs://howto-exporteren): tworzenie kopii w innym formacie.
- [Odzyskiwanie po awarii](docs://howto-herstellen-na-een-crash): co zrobić, gdy aplikacja nie zamknęła się poprawnie.
- [Formaty importu i eksportu](docs://ref-import-exportformaten): per format wiadomo, co się przenosi, a co nie.
