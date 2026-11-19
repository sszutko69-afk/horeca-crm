# 020. Google Workspace: bezpieczne łączenie konta i czytelny błąd konfiguracji

- **Data wdrożenia:** 2026-11-19
- **Commit:** 635c299
- **Środowisko:** produkcja (app.skrojo.pl)

## Zmiany

- Błąd `401 invalid_client`: w środowisku produkcyjnym brakowało danych aplikacji Google (GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET). Przy ich braku system pokazuje teraz czytelny komunikat zamiast przekierowania do Google.
- Poprawka bezpieczeństwa: trasy Gmail, Kalendarz i Zadania brały identyfikator użytkownika z treści żądania (można było odczytać cudzą pocztę). Teraz zawsze używają użytkownika z sesji.
- Poprawka bezpieczeństwa: zapis tokenu Google po autoryzacji przypisywał token pierwszemu znalezionemu użytkownikowi, gdy brakowało identyfikatora. Teraz token trafia do zalogowanego użytkownika, a stan logowania (state) to jednorazowy nonce w ciasteczku.
- Adres powrotu OAuth liczony z adresu aplikacji, gdy brak zmiennej NEXT_PUBLIC_APP_URL.
- Trasa diagnostyczna Google dostępna tylko dla właściciela i bez fragmentów sekretów.
