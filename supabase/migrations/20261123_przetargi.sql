-- Moduł Przetargi (przeniesiony z GazCRM, wielofirmowy): przetargi z BZP i ręczne, branże/CPV, pracownicy przypisani do przetargu.
create table if not exists public.przetargi (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  bzp_id        text,
  tytul         text not null,
  zamawiajacy   text,
  zamawiajacy_adres text,
  wartosc_netto numeric,
  waluta        text default 'PLN',
  data_publikacji date,
  data_skladania date not null,
  data_otwarcia date,
  cpv_kod       text,
  cpv_opis      text,
  branza        text,
  status        text default 'nowy',
  uwagi         text,
  url_ogloszenia text,
  url_dokumentow text,
  priorytet     int default 0,
  zrodlo        text default 'bzp',
  zrodlo_url    text,
  ted_id        text,
  obserwowany   boolean default false,
  miasto        text,
  wojewodztwo   text,
  tagi          text[],
  ocena         int default 0,
  przypisany_do text,
  dokumenty_url text[],
  url_postepowania text,
  usuniete      boolean default false,
  usuniete_at   timestamptz,
  zarchiwizowany boolean not null default false,
  zarchiwizowany_at timestamptz,
  zarchiwizowany_przez text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table public.przetargi add constraint przetargi_firma_bzp_uq unique (firma_id, bzp_id);

create table if not exists public.przetargi_branze (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  nazwa         text not null,
  kolor         text default 'blue',
  cpv_kody      text[] not null default '{}',
  aktywna       boolean default true,
  created_at    timestamptz default now()
);

create table if not exists public.przetargi_pracownicy (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  przetarg_id   uuid references public.przetargi(id) on delete cascade,
  pracownik_id  uuid references public.pracownicy(id) on delete cascade,
  rola          text default 'wykonawca',
  created_at    timestamptz default now()
);

do $$
declare t text;
begin
  foreach t in array array['przetargi','przetargi_branze','przetargi_pracownicy'] loop
    execute format('create index if not exists %I on public.%I(firma_id)', t || '_firma_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_all on public.%I', t);
    execute format($f$create policy tenant_all on public.%I for all to authenticated
                      using (firma_id = public.current_firma_id()) with check (firma_id = public.current_firma_id())$f$, t);
  end loop;
end $$;
create index if not exists przetargi_dsk_idx on public.przetargi(firma_id, data_skladania);

-- Domyślne branże/CPV (budownictwo) dla firm z modułem Przetargi + demo budowlane
create or replace function public.seed_przetargi_branze(p_firma uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.przetargi_branze where firma_id = p_firma) then return; end if;
  insert into public.przetargi_branze(firma_id, nazwa, kolor, cpv_kody) values
    (p_firma, 'Roboty budowlane', 'blue',   array['45000000','45210000','45211000','45215000']),
    (p_firma, 'Remonty i modernizacje', 'amber', array['45453000','45454000','45261000','45321000']),
    (p_firma, 'Instalacje', 'green', array['45300000','45310000','45330000','45331000']),
    (p_firma, 'Drogi i infrastruktura', 'purple', array['45233000','45232000','45111000']),
    (p_firma, 'Nadzór i projektowanie', 'pink', array['71000000','71320000','71520000']);
end $$;
revoke all on function public.seed_przetargi_branze(uuid) from public, anon, authenticated;
grant execute on function public.seed_przetargi_branze(uuid) to service_role;

do $$
declare f uuid := '00000000-0000-0000-0000-00000000de31';
begin
  update public.firmy set moduly = array_append(moduly, 'Przetargi') where id = f and not ('Przetargi' = any(moduly));
  perform public.seed_przetargi_branze(f);
  if exists (select 1 from public.przetargi where firma_id = f) then return; end if;
  insert into public.przetargi(firma_id, bzp_id, tytul, zamawiajacy, zamawiajacy_adres, wartosc_netto, data_publikacji, data_skladania, cpv_kod, branza, status, url_ogloszenia, miasto) values
    (f, 'DEMO-2026/BZP-001', 'Budowa budynku świetlicy wiejskiej wraz z zagospodarowaniem terenu', 'Gmina Zielone', 'Zielone, woj. mazowieckie', 1850000, current_date - 3, current_date + 18, '45210000', 'Roboty budowlane', 'nowy', 'https://ezamowienia.gov.pl/', 'Zielone'),
    (f, 'DEMO-2026/BZP-002', 'Termomodernizacja budynku szkoły podstawowej', 'Powiat Lubelski', 'Lublin', 920000, current_date - 6, current_date + 9, '45321000', 'Remonty i modernizacje', 'obserwowany', 'https://ezamowienia.gov.pl/', 'Lublin'),
    (f, 'DEMO-2026/BZP-003', 'Przebudowa drogi gminnej wraz z odwodnieniem', 'Gmina Nowe Miasto', 'Nowe Miasto', 2400000, current_date - 10, current_date + 4, '45233000', 'Drogi i infrastruktura', 'zgłoszony', 'https://ezamowienia.gov.pl/', 'Nowe Miasto');
end $$;
