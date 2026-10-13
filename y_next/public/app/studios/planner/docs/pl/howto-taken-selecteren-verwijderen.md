# Zaznaczanie, usuwanie i cofanie zadań

Cel: wybierz zadania, usuń je i cofnij błąd.

## Kiedy tego potrzebujesz

Prawie każda czynność w harmonogramie działa na zaznaczonych zadaniach: usuwanie, kopiowanie, zmienianie wcięcia, włączanie lub wyłączanie kamienia milowego. Zadania usuwasz, gdy nie trzeba ich już wykonywać albo harmonogram jest zmieniany. Ponieważ aplikacja przy usuwaniu nie pyta o potwierdzenie, *Cofnij* jest Twoją siatką bezpieczeństwa.

## Kroki

### Zaznaczanie zadań

- **Jedno zadanie.** Kliknij wiersz w tabeli zadań albo pasek w wykresie Gantt.
- **Więcej zadań.** Ctrl+kliknięcie (⌘+kliknięcie na Macu) dodaje zadanie do zaznaczenia albo je z niego usuwa. W tabeli zadań Shift+kliknięcie zaznacza wszystkie zadania od aktywnego zadania do klikniętego.
- **Wszystkie widoczne zadania.** Ctrl+A, gdy fokus jest w tabeli zadań albo w wykresie Gantt. Zadania ukryte filtrem wypadają z zaznaczenia, tak samo podzadania w zwiniętej fazie.
- **Prostokąt w wykresie Gantt.** Przytrzymaj Ctrl i przeciągnij po pustym tle: zaznaczone zostają wszystkie zadania w wierszach, których dotyka prostokąt, nawet jeśli ich pasek leży obok. Liczy się tylko wysokość prostokąta, nie oś czasu. Jeśli puścisz Ctrl dopiero po przycisku myszy, zadania dodają się do istniejącego zaznaczenia; w przeciwnym razie je zastępują. Bez Ctrl przeciąganie przewija oś czasu w ustawieniu domyślnym.
- **Nic.** Esc albo kliknięcie w puste tło wykresu Gantt.

Jeśli zaznaczysz zadanie sumaryczne, jego podzadania nie są zaznaczane razem z nim. Usuwanie i kopiowanie obejmują je jednak.

### Usuwanie zadań

Zaznacz zadania i wybierz jeden z tych sposobów:

- *Start › Edycja › Usuń*. Ten sam przycisk jest na karcie *Tabela*.
- Delete albo Backspace, jeśli fokus nie jest w tabeli zadań: najpierw kliknij pasek w wykresie Gantt.
- *Usuń* w menu kontekstowym. Jeśli zadanie, w które kliknąłeś, należy do zaznaczenia, działanie obejmuje całe zaznaczenie. W przeciwnym razie dotyczy tylko tego jednego zadania.
- Mały kosz u góry panelu *Właściwości* (podpowiedź *Usuń zadanie*). Ten kosz usuwa zadanie, które pokazuje panel.

Aplikacja nie pyta o potwierdzenie. Jeśli usuniesz kilka zadań naraz, *Cofnij* cofa to jednym krokiem.

Co znika razem z nimi: wszystkie podzadania usuniętego zadania sumarycznego, wszystkie relacje do usuniętych zadań i z nich oraz ich przydziały zasobów. Jeśli usuniesz ostatnie podzadanie zadania sumarycznego, zadanie sumaryczne pozostaje jako zwykłe zadanie. Jeśli *WBS auto* jest włączone, aplikacja przenumerowuje drzewo. Po usunięciu harmonogram jest nieaktualny: naciśnij **Oblicz** (F5), chyba że *Oblicz automatycznie* jest włączone.

### Zwijanie i rozwijanie

Zadanie sumaryczne ma przed nazwą trójkąt w tabeli zadań. Kliknij go, aby ukryć lub pokazać jego podzadania. Przez *Widok › Konspekt › Zwiń* i *Rozwiń* robisz to dla zaznaczonych zadań sumarycznych. Gdy nic nie jest zaznaczone, robisz to dla wszystkich. Menu kontekstowe zadania sumarycznego też ma *Zwiń* i *Rozwiń*. W widoku z grupowaniem przyciski działają na grupach.

Aplikacja zapamiętuje zwijanie i rozwijanie osobno dla każdego otwartego dokumentu. Nie jest to objęte działaniem *Cofnij* i nie zapisuje się w pliku projektu.

### Cofanie i ponawianie

- *Start › Edycja › Cofnij* i *Ponów* (także na karcie *Tabela*), strzałki na pasku tytułu albo Ctrl+Z do cofania i Ctrl+Y lub Ctrl+Shift+Z do ponawiania.
- Jeśli zrobisz coś nowego po *Cofnij*, *Ponów* przestaje być dostępne.

*Cofnij* obejmuje zmiany w danych projektu (zadania, relacje, zasoby, kalendarze i podobne) oraz zastosowanie układu. Zmiany kolumn w tabeli zadań są też krokami: dodawanie, usuwanie, przenoszenie, zmiana rozmiaru, automatyczne dopasowanie, przypinanie i przywracanie domyślnego układu kolumn. Te kroki dotyczą samej tabeli zadań i obowiązują w całej aplikacji, nie w jednym dokumencie. Aplikacja zachowuje ostatnich sto kroków dla każdego dokumentu; przy bardzo dużym projekcie jest ich mniej.

## Pułapki i co robi aplikacja

**Delete w tabeli zadań nie usuwa zadania.** Gdy fokus jest w tabeli zadań, Delete (lub Backspace) czyści zawartość zaznaczonych komórek. Dla komórki wymaganej lub obliczanej, na przykład nazwy albo czasu trwania, aplikacja odmawia i pokazuje komunikat pod tabelą zadań, na przykład dla nazwy: *Ta wartość jest wymagana i nie może pozostać pusta.* Wtedy nic nie jest wyczyszczone, nawet w innych zaznaczonych komórkach. Kliknij pasek w wykresie Gantt albo użyj *Usuń* (na karcie *Tabela*, gdzie nie ma wykresu Gantt: *Tabela › Edycja › Usuń* lub menu kontekstowe).

**Cała faza znika naraz.** Gdy usuniesz zadanie sumaryczne, jego podzadania, ich relacje i przydziały znikają razem z nim. *Cofnij* (Ctrl+Z) przywraca wszystko, także relacje i przydziały.

**Co nie wraca.** Zaznaczenie, zwijanie i rozwijanie oraz przycisk *Wyczyść* na pasku *Niedostępne podczas filtrowania/grupowania/sortowania* nie są objęte działaniem *Cofnij*. Jeśli naciśniesz Ctrl+Z po *Wyczyść*, cofasz więc poprzedni krok, nie czyszczenie.

**Usuwanie zadania, od którego zależą inne zadania.** Relacje do tego zadania i z niego też znikają. Zadania, które były do niego tylko przyczepione, odłączają się i po **Oblicz** wracają do własnej planowanej daty rozpoczęcia. W razie potrzeby dodaj nowe relacje, zob. [Dodawanie relacji](docs://howto-relaties-leggen).

## Zobacz także

- [Dodawanie zadań i kamieni milowych](docs://howto-taken-en-mijlpalen-toevoegen): przeciwieństwo tego, oraz kopiowanie zadań.
- [Dostosowywanie struktury](docs://howto-structuur-aanpassen): podłącz zadanie pod inną fazę zamiast je usuwać.
- [Przeciąganie, przesuwanie i powiększanie w wykresie Gantt](docs://howto-gantt-bedienen): prostokąt zaznaczania i tryby przewijania.
- [Menu kontekstowe](docs://ref-contextmenus): co robi *Usuń* i inne pozycje z zaznaczeniem.
