-- Moduł Inwestycje (przeniesiony z GazCRM, wielofirmowy): inwestycje, etapy (kanban), koszty, pracownicy przypisani do etapów.
create table if not exists public.inwestycje (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  nazwa         text not null,
  typ           text not null default 'inne',
  opis          text,
  lokalizacja   text,
  data_rozpoczecia date,
  data_planowanego_zakonczenia date,
  data_zakonczenia date,
  budzet        numeric,
  koszt_aktualny numeric default 0,
  status        text not null default 'planowana',
  notatki       text,
  dokumenty     text[],
  klient_id     uuid references public.klienci(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.inwestycje_etapy (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  inwestycja_id uuid not null references public.inwestycje(id) on delete cascade,
  nazwa         text not null,
  opis          text,
  data_planowana date,
  data_realizacji date,
  status        text not null default 'planowany',
  kanban_kolumna text default 'planowany',
  priorytet     int default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.inwestycje_koszty (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  inwestycja_id uuid references public.inwestycje(id) on delete cascade,
  nazwa         text not null,
  kategoria     text default 'materialy',
  kwota         numeric not null default 0,
  data_kosztu   date,
  opis          text,
  zrodlo        text default 'reczny',
  infakt_id     text,
  created_at    timestamptz default now()
);

create table if not exists public.etapy_pracownicy (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  etap_id       uuid references public.inwestycje_etapy(id) on delete cascade,
  pracownik_id  uuid references public.pracownicy(id) on delete cascade,
  rola          text default 'wykonawca',
  created_at    timestamptz default now()
);

alter table public.czas_pracy add column if not exists inwestycja_id uuid references public.inwestycje(id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['inwestycje','inwestycje_etapy','inwestycje_koszty','etapy_pracownicy'] loop
    execute format('create index if not exists %I on public.%I(firma_id)', t || '_firma_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_all on public.%I', t);
    execute format($f$create policy tenant_all on public.%I for all to authenticated
                      using (firma_id = public.current_firma_id()) with check (firma_id = public.current_firma_id())$f$, t);
  end loop;
end $$;
create index if not exists inwestycje_etapy_inw_idx on public.inwestycje_etapy(inwestycja_id);
create index if not exists inwestycje_koszty_inw_idx on public.inwestycje_koszty(inwestycja_id);

-- Firmy demonstracyjne branży budowlanej: moduł Inwestycje + dane przykładowe
do $$
declare
  f uuid := '00000000-0000-0000-0000-00000000de31';
  i1 uuid; i2 uuid; e1 uuid;
begin
  update public.firmy set moduly = array_append(moduly, 'Inwestycje') where id = f and not ('Inwestycje' = any(moduly));
  if exists (select 1 from public.inwestycje where firma_id = f) then return; end if;

  insert into public.inwestycje(firma_id, nazwa, typ, opis, lokalizacja, data_rozpoczecia, data_planowanego_zakonczenia, budzet, status)
  values (f, 'Osiedle Parkowe, budynek A', 'budowa_obiektu', 'Budynek mieszkalny wielorodzinny, 5 kondygnacji', 'Poznań, ul. Parkowa', current_date - 90, current_date + 240, 2400000, 'w_trakcie')
  returning id into i1;
  insert into public.inwestycje(firma_id, nazwa, typ, opis, lokalizacja, data_rozpoczecia, data_planowanego_zakonczenia, budzet, status)
  values (f, 'Remont szkoły podstawowej', 'remont', 'Termomodernizacja i modernizacja sali sportowej', 'Lublin', current_date + 30, current_date + 200, 540000, 'planowana')
  returning id into i2;

  insert into public.inwestycje_etapy(firma_id, inwestycja_id, nazwa, status, kanban_kolumna, data_planowana, data_realizacji, priorytet) values
    (f, i1, 'Roboty ziemne i fundamenty', 'zrealizowany', 'zrealizowany', current_date - 50, current_date - 52, 1),
    (f, i1, 'Stan surowy otwarty', 'w_trakcie', 'w_trakcie', current_date + 20, null, 2),
    (f, i1, 'Instalacje wewnętrzne', 'planowany', 'planowany', current_date + 90, null, 3),
    (f, i1, 'Wykończenie i odbiory', 'planowany', 'planowany', current_date + 200, null, 4),
    (f, i2, 'Projekt i kosztorys', 'w_trakcie', 'w_trakcie', current_date + 10, null, 1),
    (f, i2, 'Roboty termomodernizacyjne', 'planowany', 'planowany', current_date + 90, null, 2);

  insert into public.inwestycje_koszty(firma_id, inwestycja_id, nazwa, kategoria, kwota, data_kosztu, opis) values
    (f, i1, 'Beton i stal zbrojeniowa', 'materialy', 84000, current_date - 60, 'Hurtownia Stali i Betonu'),
    (f, i1, 'Wynajem koparki i dźwigu', 'sprzet', 24000, current_date - 45, 'Miesiąc pracy'),
    (f, i1, 'Podwykonawca: fundamenty', 'robocizna', 142000, current_date - 40, 'Etap I'),
    (f, i1, 'Transport materiałów', 'transport', 9500, current_date - 30, null),
    (f, i2, 'Projekt wykonawczy', 'projekt', 18000, current_date - 5, null);
end $$;
