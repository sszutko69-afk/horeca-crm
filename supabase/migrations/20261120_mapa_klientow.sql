-- Mapa klientów (przeniesiona z GazCRM): współrzędne klientów zapisywane w bazie, żeby nie geokodować za każdym razem.
alter table public.klienci add column if not exists lat double precision;
alter table public.klienci add column if not exists lng double precision;
alter table public.klienci add column if not exists geocoded_at timestamptz;

-- Firmy demonstracyjne: moduł Mapa klientów dostępny w każdym demo
update public.firmy
   set moduly = array_append(moduly, 'Mapa klientów')
 where demo and moduly is not null and not ('Mapa klientów' = any(moduly));
