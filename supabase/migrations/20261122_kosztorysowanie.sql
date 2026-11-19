-- Moduł Kosztorysowanie (przeniesiony z GazCRM, wielofirmowy): kosztorysy inwestorskie, katalogi KNR, cenniki.
create table if not exists public.kosztorysy (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  numer         text not null,
  nazwa         text not null,
  inwestor      text,
  obiekt        text,
  lokalizacja   text,
  data_sporzadzenia date default current_date,
  status        text default 'szkic',
  kp_procent    numeric default 68,
  kzm_procent   numeric default 20,
  z_procent     numeric default 10,
  vat_procent   numeric default 23,
  razem_r       numeric default 0,
  razem_m       numeric default 0,
  razem_s       numeric default 0,
  razem_bezposrednie numeric default 0,
  razem_kp      numeric default 0,
  razem_kzm     numeric default 0,
  razem_z       numeric default 0,
  razem_netto   numeric default 0,
  razem_vat     numeric default 0,
  razem_brutto  numeric default 0,
  uwagi         text,
  user_id       uuid,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.kosztorysy_pozycje (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  kosztorys_id  uuid references public.kosztorysy(id) on delete cascade,
  lp            int not null,
  typ           text not null default 'pozycja',
  knr_kod       text,
  opis          text not null,
  jm            text default 'm2',
  ilosc         numeric default 0,
  r_j           numeric default 0,
  m_j           numeric default 0,
  s_j           numeric default 0,
  r_wartosc     numeric default 0,
  m_wartosc     numeric default 0,
  s_wartosc     numeric default 0,
  bezposrednie  numeric default 0,
  kp_wartosc    numeric default 0,
  kzm_wartosc   numeric default 0,
  z_wartosc     numeric default 0,
  razem         numeric default 0,
  uwagi         text,
  created_at    timestamptz default now()
);

create table if not exists public.knr_katalogi (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  kod           text not null,
  nazwa         text not null,
  opis          text,
  aktywny       boolean default true,
  created_at    timestamptz default now()
);

create table if not exists public.knr_pozycje (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  katalog_id    uuid references public.knr_katalogi(id) on delete cascade,
  kod           text not null,
  nazwa         text not null,
  jm            text not null default 'm2',
  r_norma       numeric default 0,
  m_norma       numeric default 0,
  s_norma       numeric default 0,
  opis          text,
  created_at    timestamptz default now()
);

create table if not exists public.cenniki (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  nazwa         text not null,
  typ           text not null default 'mieszany',
  obowiazuje_od date,
  aktywny       boolean default true,
  created_at    timestamptz default now()
);

create table if not exists public.cenniki_pozycje (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  cennik_id     uuid not null references public.cenniki(id) on delete cascade,
  kod           text,
  nazwa         text not null,
  jm            text not null default 'szt',
  typ           text not null default 'M',
  cena          numeric default 0,
  opis          text,
  created_at    timestamptz default now()
);

do $$
declare t text;
begin
  foreach t in array array['kosztorysy','kosztorysy_pozycje','knr_katalogi','knr_pozycje','cenniki','cenniki_pozycje'] loop
    execute format('create index if not exists %I on public.%I(firma_id)', t || '_firma_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_all on public.%I', t);
    execute format($f$create policy tenant_all on public.%I for all to authenticated
                      using (firma_id = public.current_firma_id()) with check (firma_id = public.current_firma_id())$f$, t);
  end loop;
end $$;
create index if not exists kosztorysy_poz_kos_idx on public.kosztorysy_pozycje(kosztorys_id);
create index if not exists knr_poz_kat_idx on public.knr_pozycje(katalog_id);
create index if not exists cenniki_poz_cen_idx on public.cenniki_pozycje(cennik_id);

-- Demo branży budowlanej: moduł + przykładowy katalog KNR, cennik i kosztorys
do $$
declare
  f uuid := '00000000-0000-0000-0000-00000000de31';
  kat uuid; cen uuid; kos uuid;
begin
  update public.firmy set moduly = array_append(moduly, 'Kosztorysowanie') where id = f and not ('Kosztorysowanie' = any(moduly));
  if exists (select 1 from public.kosztorysy where firma_id = f) then return; end if;

  insert into public.knr_katalogi(firma_id, kod, nazwa) values (f, 'KNR 2-02', 'Konstrukcje budowlane') returning id into kat;
  insert into public.knr_pozycje(firma_id, katalog_id, kod, nazwa, jm, r_norma, m_norma, s_norma) values
    (f, kat, '0201-01', 'Roboty ziemne: wykopy mechaniczne', 'm3', 0.12, 0.00, 0.08),
    (f, kat, '0210-02', 'Fundamenty żelbetowe: ławy', 'm3', 3.20, 1.10, 0.35),
    (f, kat, '0306-04', 'Ściany z bloczków betonu komórkowego', 'm2', 1.85, 0.95, 0.07);

  insert into public.cenniki(firma_id, nazwa, typ, obowiazuje_od) values (f, 'Cennik podstawowy', 'mieszany', current_date) returning id into cen;
  insert into public.cenniki_pozycje(firma_id, cennik_id, kod, nazwa, jm, typ, cena) values
    (f, cen, null, 'Robotnik budowlany', 'r-g', 'R', 38),
    (f, cen, null, 'Cieśla', 'r-g', 'R', 46),
    (f, cen, 'BET-B25', 'Beton B25', 'm3', 'M', 420),
    (f, cen, 'STAL-12', 'Stal zbrojeniowa fi 12', 'kg', 'M', 4.2),
    (f, cen, null, 'Koparka gąsienicowa', 'm-g', 'S', 185);

  insert into public.kosztorysy(firma_id, numer, nazwa, inwestor, obiekt, lokalizacja, status,
                                razem_r, razem_m, razem_s, razem_bezposrednie, razem_kp, razem_kzm, razem_z, razem_netto, razem_vat, razem_brutto)
  values (f, 'KOS/' || to_char(current_date, 'YYYY') || '/001', 'Fundamenty budynku A', 'Deweloper Osiedle Parkowe Sp. z o.o.', 'Budynek mieszkalny', 'Poznań, ul. Parkowa', 'szkic',
          64, 22, 7, 93, 48.28, 4.4, 11.93, 157.61, 36.25, 193.86)
  returning id into kos;
  insert into public.kosztorysy_pozycje(firma_id, kosztorys_id, lp, typ, knr_kod, opis, jm, ilosc, r_j, m_j, s_j, r_wartosc, m_wartosc, s_wartosc, bezposrednie, kp_wartosc, kzm_wartosc, z_wartosc, razem)
  values (f, kos, 1, 'pozycja', 'KNR 2-02 0210-02', 'Fundamenty żelbetowe: ławy', 'm3', 20, 3.2, 1.1, 0.35, 64, 22, 7, 93, 48.28, 4.4, 11.93, 157.61);
end $$;
