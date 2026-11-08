-- ═══════════════════════════════════════════════════════════════════════════
-- GazCRM — SCHEMAT AKCEPTACJI
-- Pozycje wprowadzone przez pracowników czekają na decyzję właściciela,
-- zanim wejdą do list, kosztów i raportów.
--
-- UWAGA: to wszystko JEST JUŻ WYKONANE na bazie produkcyjnej (2026-10-19).
-- Plik zachowujesz jako zapis zmiany.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Konfiguracja: moduły i role, które mogą akceptować ───────────────────
-- Dodanie kolejnego modułu to jeden wiersz tutaj + trzy triggery niżej.
CREATE TABLE IF NOT EXISTS akceptacje_konfiguracja (
  modul             text PRIMARY KEY,
  etykieta          text NOT NULL,
  tabela            text NOT NULL,
  wymaga_akceptacji boolean NOT NULL DEFAULT true,
  role_akceptujace  text[] NOT NULL DEFAULT ARRAY['admin'],
  link              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO akceptacje_konfiguracja (modul, etykieta, tabela, role_akceptujace, link) VALUES
  ('czas_pracy', 'Czas pracy', 'czas_pracy', ARRAY['admin','pracownik_admin'], '/czasPracy'),
  ('inwestycje', 'Inwestycje', 'inwestycje', ARRAY['admin'],                   '/inwestycje'),
  ('dostawy',    'Dostawy',    'dostawy',    ARRAY['admin','pracownik_admin'], '/zamowienia'),
  ('zamowienia', 'Zamówienia', 'zamowienia', ARRAY['admin','pracownik_admin'], '/zamowienia')
ON CONFLICT (modul) DO NOTHING;

-- ── Historia decyzji i powiadomienia ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS akceptacje_historia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modul text NOT NULL, rekord_id uuid NOT NULL, rekord_opis text,
  akcja text NOT NULL, komentarz text,
  kto_id uuid, kto_nazwa text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_akc_hist_rekord ON akceptacje_historia (modul, rekord_id, created_at DESC);

CREATE TABLE IF NOT EXISTS powiadomienia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  odbiorca_id uuid NOT NULL, typ text NOT NULL DEFAULT 'akceptacja',
  modul text, rekord_id uuid, tytul text NOT NULL, tresc text, link text,
  przeczytane boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_powiad_odbiorca ON powiadomienia (odbiorca_id, przeczytane, created_at DESC);

-- ── Kolumny stanu na czterech tabelach ───────────────────────────────────
-- (powtórzone dla czas_pracy, inwestycje, dostawy, zamowienia)
-- stan_akceptacji: oczekuje | zaakceptowany | odrzucony | do_poprawy
ALTER TABLE czas_pracy ADD COLUMN IF NOT EXISTS stan_akceptacji text NOT NULL DEFAULT 'oczekuje',
  ADD COLUMN IF NOT EXISTS akceptacja_przez uuid, ADD COLUMN IF NOT EXISTS akceptacja_at timestamptz,
  ADD COLUMN IF NOT EXISTS akceptacja_uwagi text, ADD COLUMN IF NOT EXISTS zglosil_id uuid;
-- ... to samo dla inwestycje, dostawy, zamowienia ...

-- ── Istniejące dane uznane za zatwierdzone ───────────────────────────────
-- Bez tego kroku raporty wyzerowałyby się z dnia na dzień.
-- UPDATE <tabela> SET stan_akceptacji='zaakceptowany', akceptacja_at=COALESCE(created_at, now())
--   WHERE stan_akceptacji='oczekuje';
-- Objęło: czas_pracy 152, inwestycje 8, dostawy 38, zamowienia 0.


-- ═══════════════════════════════════════════════════════════════════════════
-- LOGIKA
-- ═══════════════════════════════════════════════════════════════════════════
-- akc_czy_akceptujacy(modul, uid)  — czy rola użytkownika jest na liście
-- akc_opis(tabela, wiersz)         — krótki opis rekordu do powiadomienia
-- akc_przy_dodaniu()   BEFORE INSERT — nowy rekord dostaje 'oczekuje';
--                      import automatyczny (brak auth.uid()) i wpis osoby,
--                      która sama akceptuje, wchodzą od razu
-- akc_przy_edycji()    BEFORE UPDATE — edycja zaakceptowanej pozycji przez
--                      osobę bez uprawnień cofa ją do 'oczekuje'.
--                      Zmiana samych pól akceptacji to decyzja, nie edycja.
-- akc_powiadom()       AFTER INSERT/UPDATE — wpis do historii + powiadomienia:
--                      'oczekuje' → do akceptujących,
--                      'odrzucony'/'do_poprawy' → do zgłaszającego
-- akc_decyzja(modul, rekord_id, decyzja, komentarz)
--                      — jedna funkcja dla interfejsu; sprawdza uprawnienia
--                        i wymusza komentarz przy odmowie
--
-- UWAGA NA PRZYSZŁOŚĆ: w akc_przy_dodaniu nie używać jsonb_set z to_jsonb(v_uid).
-- to_jsonb jest STRICT — przy NULL zwraca SQL NULL i zeruje cały obiekt,
-- przez co rekord dostawał domyślny stan zamiast wyliczonego. Stąd
-- bezpośrednie przypisania do NEW.*.


-- ═══════════════════════════════════════════════════════════════════════════
-- GDZIE ODCIĘTE W KODZIE (tylko zaakceptowane wchodzą do zestawień)
-- ═══════════════════════════════════════════════════════════════════════════
-- app/(app)/czasPracy/page.tsx   loadRoczne, loadAll (lista obecności + lista inwestycji)
-- app/(app)/inwestycje/page.tsx  fetchAll (lista), fetchCzasyPracy (koszty)
-- app/(app)/zamowienia/page.tsx  lista zamówień
-- app/(app)/dashboard/page.tsx   licznik inwestycji


-- ═══════════════════════════════════════════════════════════════════════════
-- PODGLĄD STANU
-- ═══════════════════════════════════════════════════════════════════════════

SELECT modul, etykieta, wymaga_akceptacji, role_akceptujace FROM akceptacje_konfiguracja ORDER BY modul;

SELECT 'czas_pracy' AS tabela, stan_akceptacji, COUNT(*)::int FROM czas_pracy GROUP BY 2
UNION ALL SELECT 'inwestycje', stan_akceptacji, COUNT(*)::int FROM inwestycje GROUP BY 2
UNION ALL SELECT 'dostawy',    stan_akceptacji, COUNT(*)::int FROM dostawy    GROUP BY 2
UNION ALL SELECT 'zamowienia', stan_akceptacji, COUNT(*)::int FROM zamowienia GROUP BY 2
ORDER BY 1, 2;

SELECT created_at, akcja, rekord_opis, kto_nazwa, komentarz
FROM akceptacje_historia ORDER BY created_at DESC LIMIT 20;

-- Wyłączenie akceptacji dla modułu (np. na czas wdrożenia):
-- UPDATE akceptacje_konfiguracja SET wymaga_akceptacji = false WHERE modul = 'dostawy';

-- Zmiana, kto akceptuje:
-- UPDATE akceptacje_konfiguracja SET role_akceptujace = ARRAY['admin'] WHERE modul = 'czas_pracy';
