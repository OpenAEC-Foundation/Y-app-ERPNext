# Dzielenie zadania

Cel: zrobić przerwę w zadaniu, tak aby praca się zatrzymała i wznowiła później, bez zamieniania go w dwa zadania.

## Kiedy tego potrzebujesz

Układanie zbrojenia trwa osiem dni roboczych, ale po czterech dniach dźwig musi pojechać na inną budowę, a praca wznawia się dwa dni później. Dwa osobne zadania oznaczają, że relacje i przydziały trzeba prowadzić dwa razy. Z **przerwą** zadanie pozostaje jednym zadaniem, z jednym paskiem, który ma lukę. Aplikacja nazywa to również *przerwa*.

Praca trwa tyle samo, ale zadanie w kalendarzu trwa dłużej. Przykład: zadanie z 8 dniami roboczymi, które zaczyna się we wtorek 29 września 2026 r., kończy się w czwartek 8 października. Jeśli dodasz przerwę trwającą 2 dni robocze po 4 dniach roboczych, zadanie kończy się w poniedziałek 12 października. Czas trwania pozostaje 8 dni roboczych, zmienia się tylko zakończenie, o dwa dni robocze.

## Kroki

### Dzielenie w wykresie Gantt

1. Wybierz *Start › Zadania › Podziel zadanie* (albo *Planowanie › Relacje › Podziel zadanie*). Nad harmonogramem pojawia się komunikat *Kliknij pasek w dniu, w którym zaczyna się przerwa, i przeciągnij w prawo, aby ustawić długość. Esc kończy*. Przycisk jest też na karcie *Tabela* (*Tabela › Zadania › Podziel zadanie*), ale tam jest wyłączony.
2. Przesuń mysz nad pasek. Przerywana linia i etykieta z datą pokazują, gdzie zacznie się przerwa. Naciśnij pasek w dniu, w którym zaczyna się przerwa.
3. Przeciągnij w prawo. Etykieta pokazuje długość, na przykład *2 dni robocze przerwy*: odległość w dniach roboczych do dnia pod myszą. Puść przycisk myszy.

Jeśli tylko klikniesz, bez przeciągania, przerwa trwa jeden dzień roboczy. Przeciągnięcie w lewo skraca przerwę ponownie, aż do minimum jednego dnia roboczego. Dla zadania godzinowego działa to w godzinach.

Tryb podziału pozostaje włączony, więc możesz podzielić więcej zadań. Kończysz klawiszem Esc albo przyciskiem *Zatrzymaj* w komunikacie. Jeśli naciśniesz Esc podczas przeciągania, aplikacja cofa przerwę i tryb się kończy. Każdy gest to jeden krok do cofnięcia przyciskiem *Cofnij*.

Po podziale harmonogram jest nieaktualny. Naciśnij **Oblicz** (F5), aby otrzymać ostateczne daty.

### Przeciąganie istniejącej przerwy w wykresie Gantt

To działa bez trybu podziału, bezpośrednio na pasku, który ma przerwę.

- Przeciągnij odcinek **po** przerwie w prawo lub w lewo. Przerwa staje się dłuższa lub krótsza, z etykietą *3 dni robocze przerwy*. Jeśli przeciągniesz go z powrotem, aż przerwa wyniesie 0, etykieta pokazuje *Scal* i dwa odcinki znów tworzą jeden.
- Przeciągnij prawą krawędź odcinka **przed** przerwą. Ten odcinek staje się dłuższy lub krótszy, z etykietą *Odcinek: 5 dni roboczych*. Czas trwania zadania zmienia się razem z nim.
- Jeśli przeciągniesz pierwszy odcinek, przesuwasz całe zadanie, jak przy każdym pasku.

### Dzielenie i korygowanie w panelu Właściwości

Zaznacz zadanie. W panelu *Właściwości* blok *Przerwy* znajduje się pod blokiem *Zależności*, a nad blokiem *Przydziały*. Przewiń do niego, jeśli trzeba.

- *Dodaj przerwę* wstawia przerwę trwającą jeden dzień roboczy w połowie najdłuższego odcinka.
- Każda przerwa ma dwa pola: *po* (ile dni roboczych pracy jest przed przerwą) i *przerwa* (długość przerwy). Obok nich są daty odcinka po przerwie. Przy zadaniu godzinowym pokazują godziny.
- Jeśli wpiszesz 0 w polu *przerwa*, przerwa znika. Mała ikona kosza (*Usuń przerwę*) robi to samo.

Uważaj przy polu *po*: to pole wydłuża lub skraca odcinek pracy przed przerwą, a razem z nim czas trwania całego zadania. Przy polu *przerwa* zmienia się tylko zakończenie.

### Usuwanie przerwy

Kliknij prawym przyciskiem myszy przerwę w wykresie Gantt albo odcinek po niej i wybierz *Usuń przerwę*. *Usuń wszystkie przerwy* jest w menu kontekstowym każdego paska, który ma przerwę. Albo użyj bloku *Przerwy* w panelu *Właściwości*, jak wyżej.

### Dzielenie z asystentem AI

Połączony asystent AI ustawia przerwy narzędziem `planner_set_task_splits`, w tej samej postaci co panel: po ilu dniach roboczych (lub godzinach roboczych) pracy i ile dni roboczych (lub godzin roboczych) przerwy. Zawsze podaje pełną listę; pusta lista usuwa wszystkie przerwy. Odczytuje je ponownie narzędziem `planner_get_task`. Obowiązują te same zasady jak niżej: zadanie, którego nie można podzielić, asystent też nie podzieli. W przeciwieństwie do podziału, który wykonujesz sam, aplikacja po tym sama przelicza harmonogram. Jak połączyć asystenta, opisano w [Łączenie asystenta AI (MCP)](docs://howto-ai-assistent-koppelen).

## Pułapki i co robi aplikacja

**Nie każde zadanie można podzielić.** Nie możesz podzielić kamienia milowego, zadania sumarycznego, zadania z włączoną opcją *Hamak (czas pochodny)* (zob. [Tworzenie hamaka](docs://howto-hammock)), zadania z typem czasu trwania *Czas, który upłynął*, zadania *Planowane ręcznie* ani zadania krótszego niż dwa dni robocze. W trybie podziału kursor myszy pokazuje zakaz i nic się nie dzieje. Dla takiego zadania w panelu *Właściwości* brakuje też bloku *Przerwy*.

**Na karcie Tabela przycisk nie działa.** *Podziel zadanie* jest tam wyłączony, z podpowiedzią *Dostępne tylko wtedy, gdy wykres Gantta jest widoczny*. Gest wymaga paska w wykresie Gantt. Tryb podziału i tryb tworzenia relacji wyłączają się nawzajem.

**Kliknięcie bez efektu.** Przerwa nie może zacząć się pierwszego dnia zadania ani wewnątrz istniejącej przerwy. Każdy odcinek pracy musi też mieć co najmniej jeden dzień roboczy. Jeśli klikniesz takie miejsce, nic się nie dzieje i nie pojawia się komunikat.

**Zadanie z postępem.** Jeśli zadanie ma postęp, przerwa może zacząć się dopiero po wykonanej pracy. Przy 50% z 8 dni roboczych to co najwcześniej piąty dzień roboczy. Kliknięcie w wykonanej części nic nie robi, a zadania z ukończeniem 100% nie można już podzielić. W panelu *Dodaj przerwę* jest wtedy wyłączony. Tak samo jest, gdy środek najdłuższego odcinka wypada w wykonanej pracy, na przykład przy 75% z 8 dni roboczych.

**Bilansowanie też tworzy przerwy.** Pokazują się w bloku *Przerwy* z etykietą *bilansowanie*. *Zasoby › Bilansowanie › Wyczyść bilansowanie* usuwa je ponownie. Jeśli sam zmienisz przerwy takiego zadania, wszystkie jego przerwy z bilansowania stają się Twoje i *Wyczyść bilansowanie* ich już nie usuwa.

**Przerwy nie przechodzą do MS Project ani do Primavera P6.** Jeśli eksportujesz do *MS Project XML* albo *Primavera P6 XML*, ten program zna przerwę tylko jako rozkład pracy przydziału. Bez takiego rozkładu zadanie trafia bez przerwy, a aplikacja podaje, ile zadań tak wyszło: *1 zadanie z przerwami zostało wyeksportowane bez przerw: MS Project/P6 znają je tylko jako rozkład pracy.* W pliku IFC aplikacji przerwy się zachowują.

**Plik z przerwami, których aplikacja nie może edytować.** Przerwy z pliku źródłowego, których postać aplikacja nie zna, pokazują w panelu komunikat *Te przerwy pochodzą z pliku źródłowego w postaci, której nie można tutaj edytować*, i dostępny jest tylko przycisk *Usuń wszystkie przerwy*.

## Zobacz także

- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): jak harmonogram liczy w dniach roboczych i dlaczego zakończenie się przesuwa.
- [Dodawanie relacji](docs://howto-relaties-leggen): inny tryb wykresu Gantt, w którym przeciągasz pasek.
- [Okno zadania i panel właściwości](docs://ref-taak-eigenschappen): sekcja Przerwy w panelu właściwości.
