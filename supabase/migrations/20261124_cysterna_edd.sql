-- Moduły Cysterna i GPS oraz Ewidencja EDD (przeniesione z GazCRM, wielofirmowe).
-- Uwaga: w bazie GazCRM tabela edd_ewidencja nie istnieje (strona działa na schemacie z kodu), więc schemat odtworzono z typów strony.
create table if not exists public.pojazdy (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  nr_rejestracyjny text not null,
  nazwa         text,
  typ           text default 'cysterna',
  aktywny       boolean default true,
  created_at    timestamptz default now()
);

create table if not exists public.bazy_trasy (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  nazwa         text not null,
  adres         text not null,
  opis          text,
  aktywny       boolean default true,
  created_at    timestamptz default now()
);

create table if not exists public.dostawy (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  klient_id     uuid references public.klienci(id) on delete set null,
  data_planowana date not null default current_date,
  kolejnosc     int default 1,
  adres_dostawy text,
  ilosc_litry_plan numeric,
  ilosc_litry_real numeric,
  cena_sprzedazy numeric,
  nr_edd        text,
  uwagi         text,
  status        text default 'planowana',
  zrealizowana  boolean default false,
  data_realizacji timestamptz,
  kierowca      text,
  pojazd        text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.gps_pozycje (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  imei          text not null,
  pojazd_nazwa  text default 'Pojazd',
  lat           double precision not null,
  lng           double precision not null,
  predkosc      numeric default 0,
  kierunek      numeric default 0,
  wysokosc      numeric default 0,
  zaplion       boolean default false,
  timestamp     timestamptz not null,
  dane_raw      jsonb,
  created_at    timestamptz default now(),
  constraint gps_pozycje_unq unique (firma_id, imei, timestamp)
);

-- Konfiguracja trackera GPS (token Flespi to sekret): odczyt i zapis tylko przez serwer (service role), brak dostępu z przeglądarki
create table if not exists public.gps_konfiguracja (
  firma_id      uuid primary key references public.firmy(id) on delete cascade,
  flespi_token  text,
  flespi_channel text,
  imei          text,
  pojazd_nazwa  text default 'Pojazd',
  updated_at    timestamptz default now()
);
alter table public.gps_konfiguracja enable row level security;

create table if not exists public.edd_ewidencja (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  nr_edd        text not null,
  rok           int,
  nr_akcyzowy   text,
  sekwencja     text,
  data_przyjecia date default current_date,
  data_wygasniecia date,
  dostawca      text,
  ilosc_kg      numeric,
  ilosc_litry   numeric,
  cena_netto_kg numeric,
  status        text default 'aktywny',
  puesc_status  text,
  puesc_sprawdzono_at timestamptz,
  zakup_id      uuid references public.zakupy(id) on delete set null,
  notatki       text,
  created_at    timestamptz default now(),
  constraint edd_ewidencja_unq unique (firma_id, nr_edd)
);

do $$
declare t text;
begin
  foreach t in array array['pojazdy','bazy_trasy','dostawy','gps_pozycje','edd_ewidencja'] loop
    execute format('create index if not exists %I on public.%I(firma_id)', t || '_firma_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_all on public.%I', t);
    execute format($f$create policy tenant_all on public.%I for all to authenticated
                      using (firma_id = public.current_firma_id()) with check (firma_id = public.current_firma_id())$f$, t);
  end loop;
end $$;
create index if not exists dostawy_data_idx on public.dostawy(firma_id, data_planowana);
create index if not exists gps_pozycje_ts_idx on public.gps_pozycje(firma_id, timestamp desc);

-- Demo branży gazowej
do $$
declare
  f uuid := '00000000-0000-0000-0000-00000000de32';
  k1 uuid; k2 uuid; k3 uuid;
begin
  update public.firmy set moduly = moduly || array(select m from unnest(array['Cysterna i GPS','Ewidencja EDD']) m where not (m = any(moduly))) where id = f;
  if exists (select 1 from public.pojazdy where firma_id = f) then return; end if;
  insert into public.pojazdy(firma_id, nr_rejestracyjny, nazwa, typ) values
    (f, 'WX 12345', 'Cysterna 1', 'cysterna'), (f, 'WX 67890', 'Cysterna 2', 'cysterna');
  insert into public.bazy_trasy(firma_id, nazwa, adres, opis) values (f, 'Baza główna', 'ul. Przemysłowa 5, 40-001 Katowice', 'Załadunek i parking');
  select id into k1 from public.klienci where firma_id = f order by nazwa limit 1 offset 0;
  select id into k2 from public.klienci where firma_id = f order by nazwa limit 1 offset 1;
  select id into k3 from public.klienci where firma_id = f order by nazwa limit 1 offset 2;
  insert into public.dostawy(firma_id, klient_id, data_planowana, kolejnosc, adres_dostawy, ilosc_litry_plan, cena_sprzedazy, status, pojazd, kierowca) values
    (f, k1, current_date, 1, 'Katowice', 9000, 3.10, 'planowana', 'WX 12345', 'Jan Kierowca'),
    (f, k2, current_date, 2, 'Kielce', 12000, 3.05, 'planowana', 'WX 12345', 'Jan Kierowca'),
    (f, k3, current_date, 3, 'Opole', 4500, 3.20, 'planowana', 'WX 67890', 'Adam Kierowca');
  insert into public.edd_ewidencja(firma_id, nr_edd, rok, nr_akcyzowy, sekwencja, data_przyjecia, dostawca, ilosc_kg, ilosc_litry, cena_netto_kg, status) values
    (f, '26PLDD123456000000001', 2026, '123456', '000000001', current_date - 5, 'Hurtownia Paliw Północ', 18000, 33600, 3.40, 'aktywny'),
    (f, '26PLDD123456000000002', 2026, '123456', '000000002', current_date - 12, 'Hurtownia Paliw Północ', 12000, 22400, 3.38, 'wykorzystany');
end $$;
