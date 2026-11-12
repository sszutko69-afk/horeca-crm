# Skrojo: uruchomienie rejestracji, okresu próbnego i płatności

Kod jest gotowy. Poniżej rzeczy, które musisz ustawić w panelach (wymagają Twoich kont i kluczy). Kolejność ma znaczenie.

## 0. Co już jest zrobione
- Baza (Supabase `rxxnljywguqdprgqkmnc`): tabela `firmy`, `firma_id` we wszystkich tabelach, izolacja firm (RLS), trigger rejestracji.
  Migracja: `supabase/migrations/20261112_multitenant_rejestracja_subskrypcje.sql` (**zastosowana**).
- **Do zastosowania:** `supabase/migrations/20261112b_login_unikalny_per_firma.sql` (login unikalny per firma). Wklej w Supabase, SQL Editor.
- Aplikacja: `/rejestracja`, `/login`, `/reset-hasla`, `/nowe-haslo`, `/auth/potwierdz` (link z maila), `/subskrypcja`, `/regulamin`, `/polityka-prywatnosci`, API Stripe, eksport i usunięcie danych (RODO).
- Strona marketingowa: przyciski „Zarejestruj się" i „Zaloguj się" (`config.appUrl`).

## 1. Supabase: Authentication
1. **Providers → Email**: włączone „Confirm email" (konto bez aktywacji nie może się zalogować). Minimalna długość hasła: 10. Włącz ochronę przed wyciekłymi hasłami.
2. **URL Configuration**: *Site URL* = adres aplikacji (np. `https://app.twojadomena.pl`). *Redirect URLs*: dodaj `https://app.twojadomena.pl/**` oraz `http://localhost:3100/**`.
3. **Email Templates**: wklej `supabase/email-templates/potwierdzenie-konta.html` (Confirm signup) i `reset-hasla.html` (Reset Password). Linki prowadzą do `/auth/potwierdz`.
4. **SMTP Settings** (żeby maile szły z Twojej domeny): host `smtp.resend.com`, port 465, użytkownik `resend`, hasło = klucz API Resend, nadawca `noreply@twojadomena.pl`.
5. **Attack Protection**: włącz CAPTCHA (Cloudflare Turnstile / hCaptcha), żeby boty nie zakładały masowo kont. (Po włączeniu trzeba dodać token captcha do formularza: powiedz, a dodam.)

## 2. Resend (maile) i domena na SEOHOST
1. Resend → Domains → Add domain `twojadomena.pl` → dodaj w panelu DNS SEOHOST rekordy, które pokaże Resend (SPF, DKIM, opcjonalnie DMARC).
2. Po weryfikacji domeny utwórz klucz API i wpisz go w SMTP w Supabase (pkt 1.4).

## 3. Stripe (bramka płatności)
1. Załóż konto Stripe (dane firmy ON Gaz Sp. z o.o., konto bankowe do wypłat).
2. Produkty → dodaj produkt „Skrojo pełna wersja", cena cykliczna **29 zł / miesiąc (PLN)** → skopiuj `price_...`.
3. Settings → Payment methods: włącz karty i BLIK. Settings → Customer portal: włącz anulowanie subskrypcji i faktury.
4. Developers → Webhooks → Add endpoint: `https://app.twojadomena.pl/api/stripe/webhook`, zdarzenia:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Skopiuj `whsec_...`.
5. Zacznij od klucza **testowego** (`sk_test_...`), kartą testową `4242 4242 4242 4242`. Dopiero po testach klucz produkcyjny.

## 4. Vercel: zmienne środowiskowe (projekt `horeca-crm`)
`NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (już jest), `RESEND_API_KEY`. Wzór: `.env.example`.
Domena aplikacji: Vercel → Domains → `app.twojadomena.pl`, w SEOHOST rekord CNAME na `cname.vercel-dns.com`. Stronę marketingową (`marketing-site/dist`) wystaw pod `twojadomena.pl` / `www`.

## 5. Strona marketingowa
W `marketing-site/config.mjs` ustaw `domain` (np. `https://twojadomena.pl`) i `appUrl` (`https://app.twojadomena.pl`), potem `node build.mjs`.

## 6. Test przed publikacją (checklista)
1. `/rejestracja`: załóż konto na swój adres (np. `skrojocrm+test1@gmail.com`) → przychodzi mail → klik → wylądowanie w `/dashboard`, pasek „Korzystasz z pełnej wersji…".
2. W Supabase (SQL): `update firmy set trial_do = now() - interval '1 day' where nazwa = '...'` → odśwież: wersja podstawowa, moduły rozszerzone zablokowane, wejście na `/raporty` przekierowuje do `/subskrypcja`.
3. `/subskrypcja` → „Wykup subskrypcję" → Stripe Checkout (karta testowa) → powrót → po chwili pełna wersja (webhook).
4. Anulowanie w panelu Stripe → po końcu okresu wraca wersja podstawowa.
5. Drugie konto w innej firmie: nie widzi danych pierwszego (sprawdzone testem w bazie).
6. „Pobierz moje dane" i „Usuń konto i dane" na `/subskrypcja`.

## 7. Co zostaje do decyzji / uwag prawnych
- Regulamin i polityka prywatności to wersje robocze; przed publikacją warto je przejrzeć z prawnikiem (odstąpienie od umowy, reklamacje, umowa powierzenia danych).
- Wersja podstawowa = moduły z `lib/plany.ts` (`MODULY_PODSTAWOWE`: Dashboard, CRM, Leady, Klienci, Użytkownicy, Dane firmy). Zakres łatwo zmienić w jednym miejscu.
- Wyłączono wysyłkę zbiorczą (raport tygodniowy i powiadomienia mailowe): działały na kluczu service role i mieszałyby dane firm. Wymagają przepisania na wysyłkę per firma.
- Moduły przetargowe i GPS to pozostałość po GazCRM (tabel w bazie już nie ma); nie są częścią oferty.
