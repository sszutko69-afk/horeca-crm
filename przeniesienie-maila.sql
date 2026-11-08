-- ═══════════════════════════════════════════════════════════════════════════
-- GazCRM — PRZENIESIENIE Z slawomir.szutko@ongaz.pl NA sszutko69@gmail.com
--
-- Powód: utrata dostępu do poczty w domenie ongaz.pl (cała domena).
-- UWAGA: to wszystko JEST JUŻ WYKONANE na bazie produkcyjnej.
-- Plik zachowujesz jako zapis zmiany.
--
-- Data: 2026-10-18
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Adres powiadomień systemowych ─────────────────────────────────────
UPDATE firma_dane SET wartosc = 'sszutko69@gmail.com'
WHERE klucz = 'notif_email';
-- było: slawomir.szutko@ongaz.pl
-- (uwaga: firma_dane.notif_aktywne = 'false' — powiadomienia są wyłączone)

-- ── 2. Adres firmowy ─────────────────────────────────────────────────────
-- Trafia na generowane dokumenty przetargowe (app/api/przetargi/generuj-docx,
-- linia 'Email: ' + firma.email). Martwy adres = odpowiedź zamawiającego
-- nigdzie nie dociera, dlatego podmieniony mimo że to adres prywatny.
UPDATE firma_dane SET wartosc = 'sszutko69@gmail.com'
WHERE klucz = 'email' AND wartosc = 'kontakt@ongaz.pl';

-- firma_dane.www = 'https://ongaz.pl' zostaje bez zmian — domena i strona żyją,
-- padła tylko poczta.

-- ── 3. Kartoteka pracownika i klienta ────────────────────────────────────
UPDATE pracownicy SET email = 'sszutko69@gmail.com'
WHERE email = 'slawomir.szutko@ongaz.pl';

UPDATE klienci SET email = 'sszutko69@gmail.com'
WHERE email = 'slawomir.szutko@ongaz.pl';

-- ── 4. Blokada konta na martwej skrzynce ─────────────────────────────────
-- Konto Katarzyny Kuźmierowskiej (pracownik_admin), ostatnie logowanie
-- 2026-04-08. Skrzynka kontakt@ongaz.pl nie odbiera, więc reset hasła byłby
-- niemożliwy. Dane osobowe i godziny pracy zostają w bazie nietknięte.
UPDATE auth.users
SET banned_until = '2999-12-31 00:00:00+00'
WHERE email = 'kontakt@ongaz.pl';

-- Odblokowanie, gdyby Katarzyna wróciła — najpierw podmień mail na działający:
-- UPDATE auth.users SET email = '<nowy@adres>', banned_until = NULL
--   WHERE email = 'kontakt@ongaz.pl';
-- UPDATE profiles SET login = '<nowy@adres>' WHERE login = 'kontakt';

-- ── 5. Widoczność konta Google ───────────────────────────────────────────
-- Przy ponownym połączeniu łatwo podpiąć inną skrzynkę niż zamierzona
-- i potem szukać, dlaczego nie ma maili. Teraz token zapamiętuje,
-- które konto go wydał.
ALTER TABLE user_google_tokens
  ADD COLUMN IF NOT EXISTS google_email text;

COMMENT ON COLUMN user_google_tokens.google_email IS
  'Konto Google, które faktycznie wydało token. Pozwala wykryć podłączenie innej skrzynki niż zamierzona.';


-- ═══════════════════════════════════════════════════════════════════════════
-- CO ZOSTAŁO NIETKNIĘTE I DLACZEGO
-- ═══════════════════════════════════════════════════════════════════════════
-- przetargi.uwagi (34) i przetargi.tytul (1) — treści maili zaimportowanych
-- w przeszłości, ze starym adresem w stopce. To dane historyczne, nie
-- konfiguracja; podmiana zafałszowałaby archiwum.
--
-- auth.users.email = 'kontakt@ongaz.pl' — zostaje jako identyfikator konta,
-- które jest zablokowane. Nie da się go zmienić na sszutko69@gmail.com,
-- bo ten adres należy już do konta administratora (adresy muszą być unikalne).


-- ═══════════════════════════════════════════════════════════════════════════
-- SPRZĄTANIE — funkcja diagnostyczna użyta przy szukaniu adresu
-- ═══════════════════════════════════════════════════════════════════════════
-- Skanuje wszystkie kolumny tekstowe w schemacie public. Przyda się przy
-- następnej takiej migracji; jeśli nie chcesz jej trzymać w bazie, usuń:
--
-- DROP FUNCTION IF EXISTS tmp_szukaj_tekstu(text);
--
-- Użycie: SELECT * FROM tmp_szukaj_tekstu('szukany tekst') ORDER BY trafien DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA
-- ═══════════════════════════════════════════════════════════════════════════

SELECT klucz, wartosc FROM firma_dane
WHERE klucz IN ('email', 'notif_email', 'notif_aktywne', 'www')
ORDER BY klucz;

SELECT u.email, p.imie_nazwisko, p.rola::text AS rola,
       u.last_sign_in_at::date::text AS ostatnie_logowanie,
       u.banned_until::text AS zablokowane_do
FROM auth.users u LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.created_at;

SELECT user_id::text, google_email, expires_at::text AS token_wazny_do
FROM user_google_tokens;
