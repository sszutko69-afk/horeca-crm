# 024. Agent marketingowy Skrojo: posty na Facebooku z grafiką

- **Data wdrożenia:** 2026-11-20
- **Commit:** daf1f4e
- **Środowisko:** produkcja (app.skrojo.pl)

## Zmiany

- Nowa trasa `/api/agent/facebook` (wymaga `Authorization: Bearer $CRON_SECRET`): wybiera branżę i kąt reklamowy, Claude (`claude-sonnet-5-5`) pisze post po polsku oraz hasło na grafikę; zwraca `tekst`, `link` (z UTM), `haslo`, `grafika`, `wiadomosc`. Tryb `?dry=1` nic nie publikuje (tak używa go Make). Wywołanie Claude próbuje wariantów parametru `thinking`, bo model odrzucał `disabled`.
- Nowa trasa `/api/agent/facebook/grafika`: obraz PNG 1080x1080 w barwach Skrojo (podpisany adres HMAC z `CRON_SECRET`, zły podpis = 403). Podpis w `lib/agent-facebook.ts`.
- `proxy.ts`: ścieżka `/api/agent/facebook` jest publiczna (sama trasa wymaga sekretu lub podpisu).
- Publikacja i harmonogram (pon/śr/pt 10:00) działają w Make (scenariusz 8625108, strona Skrojo.pl); w Vercelu brak crona dla agenta.
- Zmienne środowiskowe produkcji: `CRON_SECRET`, `ANTHROPIC_API_KEY`.
- Bez migracji bazy.
