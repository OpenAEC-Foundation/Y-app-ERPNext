# Uprawnienia rozszerzeń

Każde uprawnienie, które rozszerzenie może wymienić w manifeście: co dozwala, co się dzieje, gdy go brakuje, i co widzisz podczas instalacji rozszerzenia. Jak zarządzasz rozszerzeniami i jak je instalujesz, opisuje [Instalowanie i zarządzanie rozszerzeniem](docs://howto-extensie-installeren).

## Czym jest uprawnienie, a czym nie

Uprawnienie to **deklaracja autora**: które części interfejsu aplikacji rozszerzenie chce używać. Nie jest to bariera. Kod rozszerzenia działa w tym samym środowisku co sama aplikacja, dlatego może zrobić więcej, niż wynika z jego uprawnień: nie ma piaskownicy. Aplikacja mówi to również w oknie instalacji. Instaluj rozszerzenia tylko od autorów, którym ufasz.

Aplikacja egzekwuje uprawnienie na jeden z trzech sposobów, a różnica ma znaczenie:

**Twarde egzekwowanie.** Gdy uprawnienia brakuje, odpowiednia metoda zgłasza błąd (po holendersku, na przykład *Extensie „…” mist permissie: ribbon*) zanim cokolwiek się stanie.

**Ostrzeżenie.** Gdy uprawnienia brakuje, metoda nadal działa, ale aplikacja zapisuje ostrzeżenie w dzienniku. W przyszłej wersji stanie się to odmową.

**Tylko informacyjne.** Uprawnienie nie jest przypisane do żadnej części interfejsu. Aplikacja pokazuje je podczas instalacji i nic poza tym z nim nie robi.

To, czego nie wymaga żadne uprawnienie, jest podstawą interfejsu rozszerzeń: odczyt projektu, kalendarza, zadań, relacji, zasobów i przydziałów; dodawanie zadań i relacji oraz zmienianie zadań; wczytywanie projektu, przeliczenie i łączenie kilku zmian; przechowywanie własnych ustawień, odczyt własnych dołączonych plików i wyświetlanie powiadomienia.

**Manifest.** Uprawnienia są w manifeście jako lista. Rozszerzenie, które instalujesz teraz, z uprawnieniem, którego ta wersja aplikacji nie zna, zostaje odrzucone. Dla rozszerzenia zapisanego wcześniej aplikacja pomija nieznane uprawnienia i odnotowuje to w dzienniku.

## Jak aplikacja pyta

Przy instalowaniu, z katalogu (*Plik › Rozszerzenia › Przeglądaj › Zainstaluj*) albo z pliku (*ZIP* lub *JS*), aplikacja pokazuje okno *Zainstalować rozszerzenie?*. Pytanie pada raz, przy instalacji: nie za każdym razem, gdy włączasz rozszerzenie.

Okno pokazuje nazwę, wersję, opis, autora i, jeśli jest, repozytorium. W polu *Pochodzenie* jest napisane, skąd rozszerzenie pochodzi (*Z internetowego katalogu rozszerzeń*, *Z pliku ZIP na tym komputerze* lub *Z pliku JavaScript na tym komputerze*) oraz czy pobranie zostało zweryfikowane: sumą kontrolną z katalogu, niezweryfikowane, bo katalog nie podaje sumy, albo plik, który sam wybrałeś. W polu *Na co się zgadzasz* jest napisane, że rozszerzenie to kod programu, który działa z takimi samymi prawami jak aplikacja, i co to w praktyce znaczy: w aplikacji desktopowej między innymi odczyt i zapis plików w dowolnym miejscu w folderze użytkownika oraz dostęp do Twoich projektów, ustawień i schowka; w przeglądarce dostęp do zapisanych projektów i ustawień, do plików, do których dałeś dostęp, oraz do sieci.

W polu *Co to rozszerzenie deklaruje* są uprawnienia z manifestu, jako krótkie etykiety z nazwą, jak niżej. Jest tam napisane: *To deklaracja autora, a nie ograniczenie — kod i tak może więcej.* Jeśli rozszerzenie nie ma uprawnień, jest tam napisane *Nic nie zadeklarowano.* Dwa uprawnienia dostają wyjaśnienie: *importSource* i *help*. Pozostałe sześć dostaje tylko swoją etykietę.

Met *Zainstaluj* wyrażasz zgodę. *Nie instaluj*, Esc i kliknięcie poza oknem odrzucają instalację.

## Uprawnienia

**ribbon** — umieszcza przycisk na wstążce. Skutek: rozszerzenie może dodać przycisk do grupy na karcie wstążki. Rozszerzenie bez tego uprawnienia dostaje błąd, gdy próbuje. Przyciski pojawiają się na końcu wybranej karty, pod etykietą grupy rozszerzenia, i znikają, gdy wyłączysz rozszerzenie lub je usuniesz. Domyślnie: nieprzyznane; tylko to, co jest w manifeście. Egzekwowanie: twarde. Gdzie: na karcie, którą wybrało rozszerzenie.

**events** — śledzi zdarzenia aplikacji i samo wysyła zdarzenia. Skutek: rozszerzenie może zapisywać się na zdarzenia i z nich rezygnować oraz samo wysyłać zdarzenia. Aplikacja sama wysyła trzy: projekt jest wczytany (po imporcie, otwarciu albo wczytaniu przez rozszerzenie), tworzony jest pusty projekt i harmonogram jest (ponownie) obliczany. Domyślnie: nieprzyznane; tylko to, co jest w manifeście. Egzekwowanie: twarde. Gdzie: nigdzie; rozszerzenie reaguje na zdarzenie.

**backstage** — oferuje format importu. Skutek: rozszerzenie może zarejestrować importer; pojawia się w *Plik › Importuj*, gdzie klikasz format i wybierasz plik. Wbudowane formaty są od tego oddzielne (zobacz [Formaty importu i eksportu](docs://ref-import-exportformaten)). Domyślnie: nieprzyznane; tylko to, co jest w manifeście. Egzekwowanie: ostrzeżenie. Gdy uprawnienia brakuje, rejestrowanie nadal działa, z ostrzeżeniem w dzienniku. To rozwiązanie przejściowe, bo istniejące rozszerzenia nie zawsze wymieniają to uprawnienie. Gdzie: *Plik › Importuj*.

**pdf-fonts** — dostarcza czcionkę do eksportu PDF. Skutek: rozszerzenie może zarejestrować dostawcę czcionek. Eksport PDF używa jej dla znaków, których wbudowane czcionki nie obejmują, na przykład znaków chińskich, japońskich i koreańskich. Domyślnie: nieprzyznane; tylko to, co jest w manifeście. Egzekwowanie: twarde. Gdzie: w PDF raportu; w oknie instalacji jest tylko etykieta.

**importSource** — odczytuje oryginalne bajty zaimportowanego pliku. Skutek: rozszerzenie może zażądać pełnej zawartości pliku źródłowego zaimportowanego projektu (na razie: pliku Primavera), łącznie z polami, które aplikacja celowo nie przenosi do Twojego projektu, na przykład pola audytu i pochodzenia, koszty, pola przeglądu i lokalizacji. To dużo szerzej niż reszta interfejsu, dlatego to osobne uprawnienie. Bez tego uprawnienia aplikacja nie odczytuje ani jednego bajtu pliku źródłowego: każda metoda zgłasza wtedy błąd, zanim cokolwiek zostanie pobrane. Domyślnie: nieprzyznane; tylko to, co jest w manifeście. Egzekwowanie: twarde, domyślnie odmawiane. Gdzie: w oknie instalacji pojawia się wyjaśnienie: *importSource — pełne oryginalne bajty źródłowe każdego zaimportowanego pliku (np. surowy plik Primavera), łącznie z polami, które nigdy nie trafiają do projektu.*

**help** — dodaje artykuły pomocy i wskazówki. Skutek: rozszerzenie może rejestrować i wycofywać artykuły pomocy (samouczki), otwierać dołączony plik `.ifc` jako nowy dokument oraz uruchamiać i zatrzymywać przewodnik, który wskazuje elementy aplikacji. Dołączony projekt nigdy nie nadpisuje dokumentu, nad którym pracujesz: otwiera się jako nowy dokument albo tylko zastępuje pustą, niezmienioną kartę dokumentu. Od wersji kontraktu 1.4.0. Domyślnie: nieprzyznane; tylko to, co jest w manifeście. Egzekwowanie: twarde. Gdzie: w oknie *Pomoc* (artykuły), jako nowa karta (projekt) i jako przewodnik, który wskazuje przyciski. W oknie instalacji pojawia się wyjaśnienie: *help — może dodawać artykuły pomocy, otwierać dołączone projekty jako nowy dokument i wyświetlać przewodnik wskazujący elementy aplikacji.*

**filesystem** — rozszerzenie deklaruje, że używa plików. Skutek: brak; żadna część interfejsu nie jest z tym powiązana i aplikacja tego nie może egzekwować. Domyślnie: nieprzyznane; tylko to, co jest w manifeście. Egzekwowanie: tylko informacyjne. Gdzie: jako etykieta w oknie instalacji.

**network** — rozszerzenie deklaruje, że korzysta z sieci. Skutek: brak; jak przy *filesystem*. Domyślnie: nieprzyznane; tylko to, co jest w manifeście. Egzekwowanie: tylko informacyjne. Gdzie: jako etykieta w oknie instalacji.

## Zobacz także

- [Formaty importu i eksportu](docs://ref-import-exportformaten): formaty, które aplikacja zna sama, obok tego, co rozszerzenia dodają w *Plik › Importuj*.
- [Instalowanie i zarządzanie rozszerzeniem](docs://howto-extensie-installeren): instalowanie, wyłączanie i usuwanie rozszerzenia.
