# 014. Pakiet gazowy z GazCRM

- **Data wdrożenia:** 2026-11-19 13:28
- **Commit:** 242b9e6
- **Środowisko:** produkcja (app.skrojo.pl)

## Zmiany

- Cysterna i GPS (konfiguracja trackera per firma), Ewidencja EDD (numer akcyzowy per firma), EMCS PL 2 (dane podmiotu w bazie firmy).
- Usunięto dane obcej firmy z EMCS i fałszywą weryfikację PUESC; wyłączono zadania cykliczne.
- Migracja: 20261124_cysterna_edd.
