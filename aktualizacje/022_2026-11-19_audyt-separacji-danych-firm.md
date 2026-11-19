# 022. Audyt separacji danych między firmami: poprawki krytyczne

- **Data wdrożenia:** 2026-11-19
- **Commit:** 2659d52
- **Środowisko:** produkcja (app.skrojo.pl)

## Znaleziska i poprawki (migracje: 20261127_separacja_danych, storage_firma_prefix)

1. **Krytyczne:** funkcje `truncate_klienci/sprzedaz/zakupy` (przycisk czyszczenia w Imporcie) kasowały dane WSZYSTKICH firm. Teraz kasują tylko dane firmy administratora.
2. **Krytyczne:** `akc_decyzja` pozwalała zmienić stan akceptacji dowolnego rekordu dowolnej firmy. Teraz: tylko własna firma, role admin/menedzer, znane tabele.
3. **Wysokie:** polityki storage dawały każdemu zalogowanemu dostęp do plików wszystkich firm (odczyt, lista, nadpisanie, usunięcie). Teraz dostęp wg firmy właściciela pliku (oraz wg folderu firmy w buckecie `firma`).
4. **Średnie:** rola anonimowa miała pełne uprawnienia do tabel (blokowane tylko przez RLS); odebrane. Odebrane TRUNCATE/REFERENCES/TRIGGER rolom zalogowanym. Funkcje domyślnie niedostępne dla `public`/`anon`.
5. Dodano brakujące funkcje `przetargi_archiwizuj_stare` i `przetargi_przywroc` (wywoływane przez stronę Przetargi), z izolacją firm.
6. Trasy API: wyłączono wysyłkę powiadomień (wspólny token Google i domyślny sekret), trasy inFakt oparte o wspólny klucz z konfiguracji serwera; inFakt wymaga modułu i klucza użytkownika; odczyt PDF budżetu wymaga modułu Budżet; asystent AI wymaga sesji i ma limity.

## Weryfikacja

- Test na wszystkich tabelach z `firma_id` jako użytkownik jednej firmy: 0 widocznych cudzych wierszy, 0 zmienionych, 0 usuniętych; wstawienie do cudzej firmy zablokowane.
- Czyszczenie danych jako jedna firma nie zmienia danych innych (70 klientów, 76 faktur, 54 zakupy pozostają).
- Rola anonimowa: brak dostępu do tabel i funkcji. Tabela konfiguracji GPS niedostępna z przeglądarki.
- Storage: własny plik widoczny, cudzy niewidoczny; wgranie pliku jako inny użytkownik zablokowane.
