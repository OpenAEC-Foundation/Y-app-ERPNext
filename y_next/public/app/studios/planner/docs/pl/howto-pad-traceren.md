# Śledzenie ścieżki

Cel: pokaż łańcuch zadań przed danym zadaniem lub po nim. Dzięki temu zobaczysz, co ustala termin zadania i co się przesunie, jeśli zadanie się opóźni.

## Kiedy tego potrzebujesz

Pokrycie dachu zacznie się dopiero za trzy tygodnie. Chcesz wiedzieć, które zadanie o tym decyduje. Albo zadanie murarza kończy się tydzień później i chcesz zobaczyć, które zadania po nim się przesuną. W harmonogramie z dziesiątkami relacji nie widzisz tego z samych linii. Ze **śledzeniem ścieżki** aplikacja koloruje wszystkie **poprzedniki** (zadania przed wybranym zadaniem, bezpośrednio albo przez inne zadania) oraz **następniki** (zadania po nim). Resztę przyciemnia.

## Kroki

1. Wybierz zadanie, którego ścieżkę chcesz zobaczyć, w tabeli zadań lub na jego pasku w widoku Gantt. Jeśli wybierzesz kilka zadań, aplikacja śledzi od zadania, które wybrałeś jako pierwsze.
2. Wybierz *Planowanie › Śledzenie ścieżki › Poprzedniki*, aby zobaczyć wszystko, co jest przed zadaniem. Wybierz *Planowanie › Śledzenie ścieżki › Następniki*, aby zobaczyć wszystko, co jest po nim. Oba przyciski mogą być jednocześnie włączone. Te same dwa przyciski są na karcie *Tabela*, w grupie *Śledzenie ścieżki*.
3. Jeśli chcesz obu kierunków naraz, kliknij zadanie prawym przyciskiem w widoku Gantt albo w tabeli zadań i wybierz *Śledź ścieżkę*.
4. Zobacz wynik w widoku Gantt i w tabeli zadań. Jak go czytać, wyjaśniono niżej.
5. Zatrzymujesz śledzenie, klikając ponownie aktywny przycisk. Możesz też kliknąć prawym przyciskiem zadanie i wybrać *Zatrzymaj śledzenie ścieżki*, albo nacisnąć Esc. Esc usuwa też zaznaczenie.

Jeśli w trakcie śledzenia wybierzesz inne zadanie, ścieżka podąża za nowym zaznaczeniem.

## Jak czytać wynik

- Poprzedniki są złote, następniki fioletowe. W widoku Gantt zmieniają kolor paski. W tabeli zadań pojawia się pasek z lewej strony wiersza: ciągły dla poprzedników, przerywany dla następników. Wybrane zadanie ma obrys.
- Ciemniejszy odcień, a w tabeli zadań grubszy pasek z pogrubionym tekstem, oznacza łańcuch **relacji wiodących**. To relacje, które naprawdę ustalają daty. Co to znaczy, wyjaśniono w [Relacje i opóźnienie](docs://uitleg-relaties).
- Wszystkie zadania poza ścieżką są przyciemnione. Linie relacji, które nie należą do ścieżki, są bledsze i kropkowane.

## Pułapki i co robi aplikacja

**Nie wybrano zadania.** Bez zaznaczonego zadania nie ma czego śledzić. Przycisk jest włączony, ale na ekranie nic się nie zmienia. Najpierw wybierz zadanie.

**Brak wyróżnienia łańcucha relacji wiodących.** Wyróżnienie pochodzi z ostatniego obliczenia. Jeśli harmonogram nie został jeszcze obliczony albo obliczenie daje błąd, aplikacja koloruje wszystkich poprzedników i następników równie mocno. Naciśnij **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*, i spójrz na ścieżkę ponownie. Po zmianie wyróżnienie zostaje przy poprzednim obliczeniu, dopóki pasek stanu pokazuje *Nieaktualne — przelicz (F5)*.

**Relacja na fazie.** Śledzenie idzie za relacjami tak, jak je narysowałeś. Relacja z fazy lub do fazy (zadania sumarycznego) łączy samą fazę. Do obliczenia dotyczy każdego zadania w tej fazie, ale ścieżka nie wchodzi w zadania wewnątrz niej. Jeśli śledzisz zadanie wewnątrz fazy, która jest powiązana z innym zadaniem relacją na samej fazie, tej relacji dlatego nie zobaczysz. W takim przypadku wybierz samą fazę.

**Tylko wybrany kierunek.** Jeśli włączone są tylko *Poprzedniki*, nie widzisz, co jest po zadaniu. Odwrotnie też.

## Zobacz także

- [Relacje i opóźnienie](docs://uitleg-relaties): dlaczego relacja jest wiodąca i jak aplikacja oblicza datę początku zadania.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): który łańcuch ustala koniec projektu.
- [Dodawanie relacji](docs://howto-relaties-leggen): dodaj relację, jeśli brakuje połączenia na ścieżce.
