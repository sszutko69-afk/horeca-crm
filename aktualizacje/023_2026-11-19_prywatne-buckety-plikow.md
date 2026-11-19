# 023. Prywatne buckety plików (podpisane linki)

- **Data wdrożenia:** 2026-11-19
- **Commit:** (uzupełnić po wdrożeniu)
- **Środowisko:** produkcja (app.skrojo.pl)

## Zmiany

- Buckety `dokumenty` i `firma` zmienione z publicznych na prywatne: pliki nie otwierają się już po samym adresie bez logowania.
- Nowa trasa `/api/pliki/otworz`: wymaga zalogowania, baza weryfikuje (RLS), że plik należy do firmy użytkownika, i przekierowuje do podpisanego linku ważnego 2 minuty (parametr `pobierz=1` wymusza pobranie).
- Wszystkie miejsca otwierania plików używają tej trasy: załączniki klientów i zamówień, dokumenty leadów, przetargów i firmy (Ustawienia). Adresy zapisane w bazie pozostają w dotychczasowym formacie (bez migracji danych).
- Kod serwerowy czytający pliki (analiza dokumentów przetargu przez AI, generator ofert z dokumentami firmy) podpisuje linki sesją użytkownika.
- Komunikat po wgraniu pliku inFakt nie pokazuje już adresu pliku.
- Wycofanie w razie problemów: `update storage.buckets set public = true where id in ('dokumenty','firma')`.
