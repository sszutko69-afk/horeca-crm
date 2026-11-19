# 019. Pełny dostęp dla konta właściciela (testy na produkcji)

- **Data wdrożenia:** 2026-11-19
- **Commit:** b2eb0d8
- **Środowisko:** produkcja (app.skrojo.pl)

## Zmiany

- Nowa flaga firmy `pelny_dostep` (migracja 20261126_pelny_dostep_firmy): wszystkie moduły systemu (także HoReCa), bez okresu próbnego, bez subskrypcji i bez limitu 3 użytkowników.
- Flaga włączona dla firmy konta sszutko69@gmail.com. Zmiana flagi możliwa tylko po stronie serwera (trigger w bazie blokuje zmianę z konta użytkownika). Wyłączenie: `update firmy set pelny_dostep = false where nazwa = 'SSz'`.
- Panel statystyk platformy pokazuje taką firmę jako „Pełny dostęp (właściciel)”.
- Test komponentu menu: firma z flagą, zakończonym okresem próbnym i bez wyboru modułów ma w menu 36 pozycji, bez kłódek.
