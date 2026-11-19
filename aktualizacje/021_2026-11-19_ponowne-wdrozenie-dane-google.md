# 021. Ponowne wdrożenie: dane aplikacji Google dla Google Workspace

- **Data wdrożenia:** 2026-11-19
- **Commit:** (uzupełnić po wdrożeniu)
- **Środowisko:** produkcja (app.skrojo.pl)

## Zmiany

- Wdrożenie z nowymi zmiennymi środowiskowymi GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET (dodane przez właściciela w Vercelu).
- Adres powrotu OAuth (`/api/google/auth?action=callback`) wynika zawsze z adresu, pod którym działa aplikacja (nie ze zmiennej NEXT_PUBLIC_APP_URL).
