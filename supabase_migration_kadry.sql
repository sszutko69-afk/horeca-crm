-- ============================================================
-- MIGRACJA: Moduł KADRY
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- 1. Rozszerzenie tabeli pracownicy o pola kadrowe
ALTER TABLE pracownicy
  ADD COLUMN IF NOT EXISTS rodzaj_umowy       text,
  ADD COLUMN IF NOT EXISTS wynagrodzenie_brutto numeric,
  ADD COLUMN IF NOT EXISTS data_zatrudnienia   date,
  ADD COLUMN IF NOT EXISTS data_zwolnienia     date,
  ADD COLUMN IF NOT EXISTS pesel               text,
  ADD COLUMN IF NOT EXISTS numer_konta         text,
  ADD COLUMN IF NOT EXISTS adres               text;

-- 2. Tabela płac (naliczenia miesięczne)
CREATE TABLE IF NOT EXISTS place (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pracownik_id              uuid REFERENCES pracownicy(id) ON DELETE CASCADE,
  rok                       integer NOT NULL,
  miesiac                   integer NOT NULL,
  godziny_przepracowane     numeric DEFAULT 0,
  godziny_nadgodzin         numeric DEFAULT 0,
  dni_urlopu                integer DEFAULT 0,
  dni_l4                    integer DEFAULT 0,
  dni_nieobecnosci          integer DEFAULT 0,
  dodatek_delegacja         numeric DEFAULT 0,
  premia                    numeric DEFAULT 0,
  potracenia                numeric DEFAULT 0,
  wynagrodzenie_podstawowe  numeric DEFAULT 0,
  wynagrodzenie_brutto      numeric DEFAULT 0,
  wynagrodzenie_netto       numeric DEFAULT 0,
  status                    text DEFAULT 'projekt',  -- projekt | zatwierdzone | wyplacone
  notatki                   text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),
  UNIQUE(pracownik_id, rok, miesiac)
);

-- Opcjonalnie: RLS dla tabeli place (jeśli włączone)
-- ALTER TABLE place ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Dostęp do place" ON place FOR ALL USING (true);
