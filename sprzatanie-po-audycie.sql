-- ═══════════════════════════════════════════════════════════════════════════
-- GazCRM — SPRZĄTANIE PO AUDYCIE
--
-- Zawiera wyłącznie operacje DELETE, których nie dało się wykonać
-- przez Claude (sesja ma zablokowane operacje destrukcyjne na produkcji).
-- Reszta poprawek została już zastosowana.
--
-- URUCHOMIENIE: Supabase → SQL Editor → wklej całość → Run
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Dane testowe z audytu (17.10.2026) ────────────────────────────────
-- Fikcyjny klient „ZZZ_AUDYT_TEST Sp. z o.o." i cały jego łańcuch:
-- kontakt → lead → zamówienie → dostawa → sprzedaż 4 950 zł.
-- Powstał przy teście pełnego cyklu biznesowego bez GPS.

DELETE FROM sprzedaz   WHERE klient_id IN (SELECT id FROM klienci WHERE nazwa LIKE 'ZZZ_AUDYT%');
DELETE FROM dostawy    WHERE klient_id IN (SELECT id FROM klienci WHERE nazwa LIKE 'ZZZ_AUDYT%');
DELETE FROM zamowienia WHERE klient_nazwa LIKE 'ZZZ_AUDYT%';
DELETE FROM crm_leady  WHERE tytul LIKE 'ZZZ_AUDYT%';
DELETE FROM kontakty   WHERE nazwisko = 'Testowy';
DELETE FROM klienci    WHERE nazwa LIKE 'ZZZ_AUDYT%';
DELETE FROM dokumenty  WHERE nazwa = 'TEST_AUDYT';

-- Tabele pomostowe — przed audytem były puste, po jednym wierszu testowym
DELETE FROM etapy_pracownicy      WHERE created_at::date >= '2026-10-17';
DELETE FROM inwestycje_pracownicy WHERE created_at::date >= '2026-10-17';
DELETE FROM przetargi_pracownicy  WHERE created_at::date >= '2026-10-17';

-- ── 2. Osierocone pozycje cennika ────────────────────────────────────────
-- Trzy identyczne wpisy „Roboty ziemne — wykopy koparką" z 27.05.2026,
-- dodane w odstępie sekund z cennik_id = NULL (trzykrotne kliknięcie
-- „Dodaj pozycję" bez wybranego cennika). Niewidoczne w aplikacji.

DELETE FROM cenniki_pozycje WHERE cennik_id IS NULL;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════
-- ZABEZPIECZENIE — żeby sieroty w cenniku nie powstały ponownie
-- Uruchom dopiero PO powyższym DELETE, inaczej zgłosi błąd.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE cenniki_pozycje
  ALTER COLUMN cennik_id SET NOT NULL;

-- Opcjonalnie: kasowanie pozycji razem z cennikiem
-- ALTER TABLE cenniki_pozycje DROP CONSTRAINT IF EXISTS cenniki_pozycje_cennik_id_fkey;
-- ALTER TABLE cenniki_pozycje
--   ADD CONSTRAINT cenniki_pozycje_cennik_id_fkey
--   FOREIGN KEY (cennik_id) REFERENCES cenniki(id) ON DELETE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  (SELECT COUNT(*)::int FROM klienci WHERE nazwa LIKE 'ZZZ_AUDYT%')      AS smieci_klienci,
  (SELECT COUNT(*)::int FROM cenniki_pozycje WHERE cennik_id IS NULL)    AS smieci_cenniki,
  (SELECT COUNT(*)::int FROM klienci)                                     AS klienci,
  (SELECT COUNT(*)::int FROM sprzedaz)                                    AS sprzedaz,
  (SELECT COUNT(*)::int FROM dostawy)                                     AS dostawy;
-- Oczekiwane: 0 / 0 / 273 / 280 / 37


-- ═══════════════════════════════════════════════════════════════════════════
-- DO UZUPEŁNIENIA RĘCZNIE — stawki godzinowe
--
-- 43 wpisy czasu pracy (256 h) nadal bez wyceny, bo dwoje pracowników
-- nie ma ustawionej stawki:
--   Katarzyna K. (Inne)      — 22 wpisy,  88 h
--   Wojciech K.  (Kierowca)  — 21 wpisów, 168 h
--
-- Wpisz stawki w module Kadry albo poniższym poleceniem,
-- podstawiając własne kwoty:
-- ═══════════════════════════════════════════════════════════════════════════

-- UPDATE pracownicy SET stawka_godzinowa = 40.00 WHERE imie='Katarzyna' AND nazwisko LIKE 'K%';
-- UPDATE pracownicy SET stawka_godzinowa = 35.00 WHERE imie='Wojciech'  AND nazwisko LIKE 'K%';

-- Po ustawieniu stawek przelicz koszty wstecz:
-- UPDATE czas_pracy c
-- SET koszt_calkowity = ROUND(
--       c.godziny * p.stawka_godzinowa
--       + CASE WHEN c.delegacja THEN COALESCE(c.delegacja_stawka,0) ELSE 0 END, 2)
-- FROM pracownicy p
-- WHERE p.id = c.pracownik_id
--   AND (c.koszt_calkowity IS NULL OR c.koszt_calkowity = 0)
--   AND p.stawka_godzinowa > 0;
