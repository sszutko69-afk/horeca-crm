# 018. Status modułów na ekranie wyboru i przedłużanie okresu próbnego

- **Data wdrożenia:** 2026-11-19
- **Commit:** 4a8fac6
- **Środowisko:** produkcja (app.skrojo.pl)

## Zmiany

- Ekran „Moduły systemu”: komunikat o planie (pełna wersja / wersja podstawowa) oraz status każdego wybranego modułu: „w menu” albo „wymaga subskrypcji”.
- Test prawdziwego komponentu menu (jsdom) dla trzech przypadków: ważny okres próbny (wybrane moduły widoczne), zakończony okres próbny (moduły z kłódką), firma gazowa z ważnym okresem (moduły gazowe widoczne, budowlane niewybrane niewidoczne).
- Panel statystyk platformy (tylko właściciel): tabela firm klientów z planem i datą końca próby oraz przycisk „+30 dni próby” (trasa /api/platforma/przedluz-probe, weryfikacja właściciela po stronie serwera).
