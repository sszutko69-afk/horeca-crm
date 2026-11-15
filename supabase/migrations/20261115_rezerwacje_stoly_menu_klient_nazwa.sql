-- Trwałe zapisywanie danych modułów, które dotąd trzymały dane tylko w przeglądarce:
-- Rezerwacje, Stoły, Menu (HoReCa) oraz nazwa klienta na fakturze sprzedaży (Sprzedaż i Zakupy używają już istniejących tabel).
-- Wszystkie tabele z firma_id i izolacją RLS (każda firma widzi tylko swoje dane).

alter table public.sprzedaz add column if not exists klient_nazwa text;

create table if not exists public.rezerwacje (
  id          bigint generated always as identity primary key,
  firma_id    uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  data        date not null,
  godzina     text not null,
  imie        text not null,
  liczba_osob int  not null default 1 check (liczba_osob between 1 and 1000),
  stol        int  not null default 0,
  status      text not null default 'oczekuje' check (status in ('potwierdzona','oczekuje','anulowana')),
  telefon     text,
  uwagi       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.stoly (
  id          bigint generated always as identity primary key,
  firma_id    uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  numer       int  not null,
  miejsca     int  not null default 4 check (miejsca between 1 and 200),
  status      text not null default 'wolny' check (status in ('wolny','zajety','zarezerwowany','nieaktywny')),
  x           numeric not null default 10,
  y           numeric not null default 10,
  ksztalt     text not null default 'kwadrat' check (ksztalt in ('kwadrat','okragly')),
  kelner      text,
  opis        text,
  created_at  timestamptz not null default now(),
  unique (firma_id, numer)
);

create table if not exists public.menu_pozycje (
  id          bigint generated always as identity primary key,
  firma_id    uuid not null default public.current_firma_id() references public.firmy(id) on delete cascade,
  nazwa       text not null,
  kategoria   text not null default 'Dania główne',
  cena        numeric not null default 0 check (cena >= 0),
  dostepne    boolean not null default true,
  alergeny    text[] not null default '{}',
  kcal        int,
  opis        text,
  created_at  timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['rezerwacje','stoly','menu_pozycje'] loop
    execute format('create index if not exists %I on public.%I(firma_id)', t || '_firma_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_all on public.%I', t);
    execute format($f$create policy tenant_all on public.%I for all to authenticated
                      using (firma_id = public.current_firma_id()) with check (firma_id = public.current_firma_id())$f$, t);
  end loop;
end $$;

-- Dane przykładowe tylko dla firmy DEMO (restauracja demonstracyjna)
insert into public.stoly (firma_id, numer, miejsca, status, x, y, ksztalt, kelner, opis)
select '00000000-0000-0000-0000-00000000de30', v.* from (values
  (1,2,'wolny',5,8,'okragly','','Przy oknie'),(2,2,'zajety',20,8,'okragly','Marta K.',''),(3,4,'zarezerwowany',36,8,'kwadrat','',''),
  (4,4,'wolny',55,8,'kwadrat','','VIP'),(5,4,'zajety',72,8,'kwadrat','Tomek W.',''),(6,6,'wolny',5,38,'kwadrat','',''),
  (7,6,'zarezerwowany',26,38,'kwadrat','',''),(8,2,'zajety',50,38,'okragly','Ania S.',''),(9,2,'wolny',65,38,'okragly','',''),
  (10,8,'zajety',5,65,'kwadrat','Tomek W.','Sala bankietowa'),(11,4,'wolny',42,65,'kwadrat','',''),(12,6,'zarezerwowany',65,65,'kwadrat','',''),
  (13,2,'nieaktywny',85,38,'okragly','','Remont')
) as v(numer,miejsca,status,x,y,ksztalt,kelner,opis)
where not exists (select 1 from public.stoly where firma_id = '00000000-0000-0000-0000-00000000de30');

insert into public.menu_pozycje (firma_id, nazwa, kategoria, cena, dostepne, alergeny, kcal, opis)
select '00000000-0000-0000-0000-00000000de30', v.* from (values
  ('Żurek staropolski','Zupy',22,true,array['gluten','jajka','mleko'],310,'Podawany w chlebie, z jajkiem i białą kiełbasą'),
  ('Zupa pomidorowa z ryżem','Zupy',18,true,array['gluten'],220,''),
  ('Sałatka grecka','Sałatki',28,true,array['mleko'],280,'Feta, oliwki, ogórek, pomidor'),
  ('Carpaccio z wołowiny','Przystawki',42,true,array['jajka','mleko'],180,'Z parmezanem i rukolą'),
  ('Pierogi ruskie','Dania główne',32,true,array['gluten','mleko'],480,'8 sztuk, z cebulą i śmietaną'),
  ('Kotlet schabowy z buraczkami','Dania główne',48,true,array['gluten','jajka'],650,'Z ziemniakami i surówką'),
  ('Łosoś grillowany','Dania główne',68,true,array['ryby'],420,'Z warzywami i sosem cytrynowym'),
  ('Risotto z grzybami','Dania główne',52,false,array['mleko'],540,'Z truflową śmietaną i parmezanem'),
  ('Tiramisu','Desery',24,true,array['gluten','jajka','mleko'],390,'Klasyczny włoski deser'),
  ('Sernik nowojorski','Desery',22,true,array['gluten','jajka','mleko'],420,'Z sosem truskawkowym'),
  ('Kawa espresso','Napoje',10,true,array[]::text[],5,''),
  ('Lemoniada własna','Napoje',14,true,array[]::text[],90,'Mięta, cytryna, miód')
) as v(nazwa,kategoria,cena,dostepne,alergeny,kcal,opis)
where not exists (select 1 from public.menu_pozycje where firma_id = '00000000-0000-0000-0000-00000000de30');

insert into public.rezerwacje (firma_id, data, godzina, imie, liczba_osob, stol, status, telefon, uwagi)
select '00000000-0000-0000-0000-00000000de30', current_date, v.* from (values
  ('12:00','Jan Kowalski',4,5,'potwierdzona','600 100 200','urodziny'),
  ('13:30','Anna Nowak',2,2,'potwierdzona','601 200 300',''),
  ('14:00','Firma ABC Sp. z o.o.',8,10,'oczekuje','602 300 400','lunch biznesowy'),
  ('15:30','Maria Wiśniewska',3,7,'potwierdzona','603 400 500',''),
  ('18:00','Piotr Zając',6,12,'oczekuje','604 500 600','rocznica'),
  ('19:30','Hotel Złoty Lew',20,0,'potwierdzona','605 600 700','impreza: cała sala prywatna'),
  ('20:00','Katarzyna Dąbrowska',2,3,'anulowana','606 700 800','')
) as v(godzina,imie,liczba_osob,stol,status,telefon,uwagi)
where not exists (select 1 from public.rezerwacje where firma_id = '00000000-0000-0000-0000-00000000de30');
