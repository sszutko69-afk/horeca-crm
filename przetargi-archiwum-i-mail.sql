-- ═══════════════════════════════════════════════════════════════════════════
-- GazCRM — ARCHIWUM PRZETARGÓW + AUTOMATYCZNY IMPORT Z MAILA
--
-- UWAGA: to wszystko JEST JUŻ WYKONANE na bazie produkcyjnej.
-- Plik zachowujesz jako zapis zmiany (migracja) — do repozytorium,
-- żeby dało się odtworzyć stan przy ewentualnym przenoszeniu bazy.
--
-- Data: 2026-10-18
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Kolumny archiwum ──────────────────────────────────────────────────
ALTER TABLE przetargi
  ADD COLUMN IF NOT EXISTS zarchiwizowany       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS zarchiwizowany_at    timestamptz,
  ADD COLUMN IF NOT EXISTS zarchiwizowany_przez text;

COMMENT ON COLUMN przetargi.zarchiwizowany IS
  'true = poza bieżącą listą. Ustawiane automatycznie dla przetargów po terminie składania starszym niż 30 dni.';
COMMENT ON COLUMN przetargi.zarchiwizowany_przez IS
  'auto_30d = cron, recznie = użytkownik.';

CREATE INDEX IF NOT EXISTS idx_przetargi_archiwum
  ON przetargi (zarchiwizowany, data_skladania DESC);


-- ── 2. Funkcja przesiewu ─────────────────────────────────────────────────
-- Status i flaga „obserwowany" rozjeżdżają się w danych: zmiana statusu
-- w oknie szczegółów ustawia tylko `status`, przycisk gwiazdki tylko
-- `obserwowany`. Dlatego warunek sprawdza oba.
CREATE OR REPLACE FUNCTION przetargi_archiwizuj_stare(
  dni int DEFAULT 30,
  przez text DEFAULT 'auto_30d'
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ile int;
BEGIN
  UPDATE przetargi
  SET zarchiwizowany       = true,
      zarchiwizowany_at    = now(),
      zarchiwizowany_przez = przez
  WHERE NOT zarchiwizowany
    AND NOT COALESCE(usuniete, false)
    AND data_skladania < CURRENT_DATE - dni
    -- nie ruszamy tego, czym firma faktycznie się zajmuje
    AND NOT COALESCE(obserwowany, false)
    AND COALESCE(status, 'nowy') NOT IN ('obserwowany', 'zgłoszony', 'wygrany');

  GET DIAGNOSTICS ile = ROW_COUNT;
  RETURN ile;
END;
$$;

COMMENT ON FUNCTION przetargi_archiwizuj_stare IS
  'Przenosi do archiwum przetargi z terminem składania starszym niż `dni`. Pomija obserwowane, zgłoszone i wygrane.';

GRANT EXECUTE ON FUNCTION przetargi_archiwizuj_stare(int, text) TO authenticated;


-- ── 3. Przywracanie z archiwum ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION przetargi_przywroc(ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE ile int;
BEGIN
  UPDATE przetargi
  SET zarchiwizowany = false, zarchiwizowany_at = NULL, zarchiwizowany_przez = NULL
  WHERE id = ANY(ids);
  GET DIAGNOSTICS ile = ROW_COUNT;
  RETURN ile;
END;
$$;

GRANT EXECUTE ON FUNCTION przetargi_przywroc(uuid[]) TO authenticated;


-- ── 4. Log przetworzonych maili ──────────────────────────────────────────
-- Klucz na message_id — ten sam mail nie zostanie zaimportowany dwa razy,
-- niezależnie od tego ile razy cron się uruchomi.
CREATE TABLE IF NOT EXISTS przetargi_mail_log (
  message_id   text PRIMARY KEY,
  thread_id    text,
  temat        text,
  nadawca      text,
  zrodlo       text,
  dodano       int  NOT NULL DEFAULT 0,
  duplikaty    int  NOT NULL DEFAULT 0,
  blad         text,
  data_maila   timestamptz,
  przetworzono timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mail_log_przetworzono
  ON przetargi_mail_log (przetworzono DESC);

ALTER TABLE przetargi_mail_log ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY mail_log_select ON przetargi_mail_log
--   FOR SELECT TO authenticated USING (true);
-- (polityka już istnieje — odkomentuj tylko przy odtwarzaniu bazy od zera)


-- ── 5. Zadania cron ──────────────────────────────────────────────────────
-- Kolejność w ciągu doby ma znaczenie: najpierw przesiew, potem świeży import.
--   05:30  archiwizacja starszych niż 30 dni
--   06:00  import BZP            (istniał wcześniej)
--   co 2 h import z etykiety Gmail

SELECT cron.schedule(
  'przetargi-archiwizacja-30d',
  '30 5 * * *',
  $$ SELECT przetargi_archiwizuj_stare(30, 'auto_30d'); $$
);

SELECT cron.schedule(
  'przetargi-mail-import',
  '10 */2 * * *',
  $CRON$
  SELECT net.http_post(
    url := 'https://gazcrm.vercel.app/api/przetargi/import-mail',
    headers := '{"Content-Type": "application/json", "x-import-secret": "gazcrm2025"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  $CRON$
);


-- ── 6. Pierwszy przesiew (wykonany 2026-10-18) ───────────────────────────
-- SELECT przetargi_archiwizuj_stare(30, 'auto_30d');
-- Wynik: 11 505 przetargów przeniesionych do archiwum.


-- ═══════════════════════════════════════════════════════════════════════════
-- PODGLĄD STANU
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  (SELECT COUNT(*)::int FROM przetargi WHERE NOT usuniete AND NOT zarchiwizowany) AS na_liscie,
  (SELECT COUNT(*)::int FROM przetargi WHERE NOT usuniete AND zarchiwizowany)     AS w_archiwum,
  (SELECT COUNT(*)::int FROM przetargi_mail_log)                                  AS maili_przetworzonych;

-- Co cron zrobił ostatnio
SELECT j.jobname, r.status, r.start_time, left(r.return_message, 120) AS wynik
FROM cron.job_run_details r
JOIN cron.job j ON j.jobid = r.jobid
ORDER BY r.start_time DESC
LIMIT 15;

-- Ostatnie przetworzone maile
SELECT przetworzono, zrodlo, dodano, duplikaty, blad, left(temat, 70) AS temat
FROM przetargi_mail_log
ORDER BY przetworzono DESC
LIMIT 20;
