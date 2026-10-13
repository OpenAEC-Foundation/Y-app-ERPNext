# Tworzenie hamaka

Cel: utworzyć zadanie, które nie zna własnego czasu trwania, ale biegnie od początku jednego zadania do zakończenia innego, na przykład zaplecze budowy, nadzór albo wynajem baraku budowlanego.

## Kiedy tego potrzebujesz

Barak budowlany stoi tam tak długo, jak trwa budowa, od pierwszych prac ziemnych do odbioru. Jeśli nadasz temu zadaniu stały czas trwania 13 dni roboczych, nie podąża ono za murowaniem, gdy to się opóźni, a harmonogram przestaje być prawidłowy. **Hamak** (zwany też *level of effort*) podąża za pracą, na której go zawieszasz: jego początek pochodzi z relacji początkowej, jego zakończenie z relacji końcowej, a jego czas trwania to różnica między nimi.

## Kroki

1. Utwórz zadanie, na przykład *Site cabin*, albo wybierz istniejące zadanie. Kamień milowy i zadanie sumaryczne (faza) nie mogą być hamakiem. W panelu *Właściwości* i w oknie *Edytuj zadanie* brakuje dla takiego zadania pola wyboru, a w kolumnie tabeli nie da się go zmienić.
2. Zaznacz *Hamak (czas pochodny)* w panelu *Właściwości*, w oknie *Edytuj zadanie* (kliknij zadanie prawym przyciskiem myszy, *Edytuj...*) albo w kolumnie tabeli *Hamak (czas pochodny)* w grupie *Planowanie*. Pole *Czas trwania* nie da się wtedy już edytować.
3. Dodaj relację od zadania, z którym zaczyna się hamak, do hamaka, typu **SS** (hamak zaczyna się razem z tym zadaniem) albo **FS** (hamak zaczyna się po tym zadaniu). Zaznacz hamak, kliknij *Dodaj relację* w grupie *Zależności*, zostaw kierunek na *Poprzednik*, wybierz zadanie i wybierz typ. Kroki są opisane w [Dodawanie relacji](docs://howto-relaties-leggen).
4. Dodaj relację od zadania, z którym kończy się hamak, do hamaka, typu **FF** (hamak kończy się razem z tym zadaniem) albo **SF**.
5. Zajrzyj do panelu *Właściwości*, sekcja *Hamak (czas pochodny)*: tam zobaczysz *Driver początku* z zadaniem i typem oraz *Driver końca* z zadaniem i typem. Driver to zadanie, od którego hamak bierze swój początek albo koniec.
6. Naciśnij **Oblicz** (F5), na przykład przez *Start › Harmonogram › Oblicz*. Hamak biegnie teraz od początku zadania będącego driverem początku do końca zadania będącego driverem końca, a *Czas trwania* pokazuje czas pochodny.

W widoku Gantt hamak to cienki turkusowy pasek z haczykiem na obu końcach.

Przykład: *Site cabin* dostaje SS od *Groundwork* (poniedziałek 7 czerwca 2027) i FF od *Roofing* (gotowe w środę 23 czerwca). Po **Oblicz** hamak biegnie od poniedziałku 7 do środy 23 czerwca: 13 dni roboczych. Jeśli murowanie opóźni się o 2 dni robocze, zakończenie *Roofing* przypada na piątek 25 czerwca, a hamak wydłuża się razem z nim do 15 dni roboczych.

## Co aplikacja robi z hamakiem

- Hamak nigdy nie jest krytyczny i nie ma zapasu. Nie ogranicza też zadań, od których bierze swój początek i zakończenie: przez hamak nie dostają późnego terminu.
- Opóźnienie ma znaczenie. Przy SS i opóźnieniu `1d` hamak zaczyna się jeden dzień roboczy po driverze początku, a przy FF i opóźnieniu `2d` kończy się dwa dni robocze po driverze końca.

## Pułapki i co robi aplikacja

**Brak drivera końca.** Jeśli hamak nie ma relacji FF ani SF, aplikacja nie może wyliczyć jego zakończenia. Panel *Właściwości* pokazuje *Brak drivera końca (FF/SF) — odstęp wraca do zerowej długości.*, a panel *Ostrzeżenia* pokazuje *Hamak bez sterownika końca (brak poprzednika FF/SF): czas trwania spada do zera*. Hamak wtedy zaczyna się i kończy tego samego dnia. Dodaj relację FF albo SF.

**Hamak kończący się po ostatnim zadaniu.** Jeśli hamak kończy się później niż ostatnie zadanie, na przykład przy FF i opóźnieniu wynoszącym 2 dni robocze, termin zakończenia projektu przesuwa się wraz z nim. Zadania, które naprawdę wykonujesz, dostają wtedy zapas; żadne z nich nie jest już krytyczne.

**Zadania czekające na hamak.** Jeśli dodasz relację od hamaka do innego zadania, to zadanie zaczyna się dopiero po zakończeniu hamaka. Cały łańcuch przed hamakiem, także zadania, od których hamak bierze początek i koniec, dostaje wtedy zapas i przestaje być krytyczny, bo hamak nie przekazuje na nie nacisku. Dlatego nie pozwalaj zadaniom czekać na hamak; zamiast tego zawieś takie zadania na driverze końca hamaka.

**Wpisywanie czasu trwania.** Pole *Czas trwania* hamaka jest wyliczane i nie da się go edytować. Czas trwania, który wpisałeś przed zaznaczeniem pola wyboru, już się nie liczy.

## Zobacz też

- [Dodawanie relacji](docs://howto-relaties-leggen): kroki, aby dodać relację typu SS albo FF.
- [Relacje i opóźnienie](docs://uitleg-relaties): co znaczą SS i FF i jak liczy się opóźnienie.
- [Ścieżka krytyczna i zapas](docs://uitleg-kritiek-pad): co znaczy krytyczny i jak działa zapas.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): zawiera hamak *Structural works tower A (LOE)*.
