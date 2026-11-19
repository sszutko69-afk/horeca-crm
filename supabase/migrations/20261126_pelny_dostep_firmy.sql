-- Flaga pelny_dostep (zastosowana jako "pelny_dostep_firmy"): wszystkie moduly, bez okresu probnego i bez limitu uzytkownikow.
-- Zmiana flagi tylko przez serwer (trigger blokuje zmiane z sesji uzytkownika). Wlaczona dla firmy wlasciciela platformy.
alter table public.firmy add column if not exists pelny_dostep boolean not null default false;
