# Włączanie automatycznego zapisu

Cel: aplikacja aktualizuje plik projektu, gdy pracujesz, dzięki czemu nie musisz ciągle naciskać Ctrl+S.

## Kiedy tego potrzebujesz

Pracujesz długo nad jednym harmonogramem albo ciągle zapominasz zapisywać. Chcesz, aby plik na dysku lub we wspólnym folderze był na bieżąco. Automatyczny zapis nie zastępuje odzyskiwania po awarii. Odzyskiwanie po awarii jest zawsze włączone i działa niezależnie od tej funkcji. Różnicę znajdziesz w [Pliki i formaty](docs://uitleg-bestanden).

## Kroki

1. Jeśli projekt nie ma jeszcze pliku, najpierw zapisz go raz przez *Start › Plik › Zapisz jako*. Dopóki nie ma pliku, przełącznik jest szary, a dymek podpowiedzi pokazuje: *Najpierw zapisz ten projekt, aby użyć automatycznego zapisu.*
2. W górnej części ekranu, w lewym rogu, kliknij przełącznik *Automatyczny zapis*. Gdy jest włączony, dymek podpowiedzi pokazuje: *Automatyczny zapis jest włączony: zmiany są zapisywane w tym pliku.*
3. Pracuj dalej. Gdy w projekcie pojawią się zmiany, aplikacja zapisuje go do pliku, bez pokazywania okna i najwyżej raz na dziesięć sekund. Znacznik *Niezapisane* wtedy sam znika.
4. Jeśli chcesz przestać, kliknij przełącznik jeszcze raz. Dymek podpowiedzi pokazuje wtedy: *Automatyczny zapis jest wyłączony. Odzyskiwanie po awarii pozostaje aktywne.*

Chrome i Edge najpierw pozwalają tylko odczytać plik, który otworzyłeś. Przełącznik nie działa, dopóki nie zapiszesz raz za pomocą *Zapisz* (Ctrl+S) i przeglądarka nie da zgody na zapis. Potem możesz go włączyć. W Firefoxie przełącznik zostaje szary: aplikacja nie może tam zapisywać do pliku.

## Pułapki i co wtedy robi aplikacja

**Przełącznik należy do jednego projektu.** Każda karta projektu ma swój stan. Po otwarciu projektu przełącznik jest zawsze wyłączony. Aplikacja nie zapamiętuje tego na następny raz.

**Automatyczny zapis zapisuje tylko do pliku, który projekt już ma.** Jeśli wybierzesz *Zapisz jako*, od tej chwili zapisuje do nowego pliku. Aplikacja zapisuje tylko wtedy, gdy są zmiany.

**Zapis może się nie udać.** Jeśli plik na przykład zniknął albo jest zablokowany, pojawia się komunikat *Błąd autozapisu* z przyczyną. Jeśli przeglądarka nie ma (lub już nie ma) zgody na zapis, aplikacja pomija ten cykl po cichu. Nie pyta o zgodę.

**Plik dostaje też zmiany, których wolałbyś nie zachować.** Automatyczny zapis zapisuje stan projektu taki, jaki jest w danej chwili. Jeśli cofniesz coś klawiszami Ctrl+Z, plik dostanie ten cofnięty stan także w ciągu dziesięciu sekund. Jeśli chcesz zachować starszą wersję, najpierw zrób kopię za pomocą *Zapisz jako*.

**Przy awarii nadal przepadają ostatnie sekundy.** Aplikacja zapisuje najwyżej raz na dziesięć sekund. Dlatego to, co zrobiłeś między zapisami, nie ma jeszcze w pliku. Odzyskiwanie po awarii ma ten sam limit.

**Po odzyskaniu w przeglądarce przełącznik znowu jest szary.** Projekt, który odzyskasz w przeglądarce po awarii, nie jest już powiązany ze swoim plikiem. Zapisz go raz, a przełącznik znowu działa. Zobacz [Odzyskiwanie po awarii](docs://howto-herstellen-na-een-crash).

**Projekt z innego formatu nie ma pliku.** Plik CSV, XML, `.mpp` lub `.xer` dostaje plik IFC dopiero wtedy, gdy go zapiszesz. Potem możesz włączyć automatyczny zapis.

## Zobacz także

- [Pliki i formaty](docs://uitleg-bestanden): różnica między zapisywaniem, automatycznym zapisem a odzyskiwaniem po awarii.
- [Otwieranie i zapisywanie pliku](docs://howto-bestand-openen-en-opslaan): zapisywanie, *Zapisz jako* i znacznik *Niezapisane*.
- [Odzyskiwanie po awarii](docs://howto-herstellen-na-een-crash): co aplikacja proponuje, gdy nie zamknęła się prawidłowo.
