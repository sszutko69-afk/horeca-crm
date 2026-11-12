-- Wybór branży i modułów przez firmę (rejestracja + /start). Moduły firmy = sufit dostępu dla wszystkich jej użytkowników.
alter table public.firmy add column if not exists branza text;
alter table public.firmy add column if not exists moduly text[];
alter table public.firmy add column if not exists onboarding_zakonczony boolean not null default false;

-- firma DEMO: HoReCa, wszystkie moduły, bez onboardingu
update public.firmy set
  branza = 'horeca',
  onboarding_zakonczony = true,
  moduly = array['Dashboard','Akceptacje','Rezerwacje','Stoły','Menu','CRM','Leady','Klienci','Zamówienia','Zakupy','Sprzedaż',
                 'Raporty','AI — Finanse','Budżet','POS','eService','Bank','Google Workspace','Kadry','Czas pracy','Plan pracy','Płace',
                 'inFakt','Import danych','Archiwizacja','Użytkownicy','Dane firmy']
where demo;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_firma uuid;
  v_rola  user_role;
  v_wersja text := coalesce(new.raw_user_meta_data->>'regulamin_wersja', '2026-11');
  v_mkt   boolean := coalesce((new.raw_user_meta_data->>'zgoda_marketing')::boolean, false);
  v_branza text := new.raw_user_meta_data->>'branza';
  v_moduly text[] := array['Dashboard','Akceptacje','Rezerwacje','Stoły','Menu','CRM','Leady','Klienci','Zamówienia','Zakupy','Sprzedaż',
                           'Raporty','AI — Finanse','Budżet','POS','eService','Bank','Google Workspace','Kadry','Czas pracy','Plan pracy','Płace',
                           'inFakt','Import danych','Archiwizacja','Użytkownicy','Dane firmy'];
begin
  if new.raw_app_meta_data ? 'firma_id' then
    -- konto dodane przez administratora firmy (API z service role)
    v_firma := (new.raw_app_meta_data->>'firma_id')::uuid;
    v_rola  := coalesce((new.raw_app_meta_data->>'rola')::user_role, 'kelner');
    insert into public.profiles (id, firma_id, imie_nazwisko, login, telefon, rola, moduly)
    values (new.id, v_firma,
            coalesce(new.raw_user_meta_data->>'imie_nazwisko', split_part(new.email,'@',1)),
            coalesce(new.raw_user_meta_data->>'login', new.email),
            nullif(new.raw_user_meta_data->>'telefon',''),
            v_rola,
            case when jsonb_typeof(new.raw_app_meta_data->'moduly') = 'array'
                 then array(select jsonb_array_elements_text(new.raw_app_meta_data->'moduly'))
                 else array['Dashboard'] end);
  else
    -- samodzielna rejestracja: nowa firma z wybraną branżą (lista dozwolonych), moduły ustala /start
    if v_branza is null or v_branza not in ('horeca','inwestycyjna','gazowa','nieruchomosci','transport','logistyka','kancelarie','sekretariaty','inna') then
      v_branza := null;
    end if;
    insert into public.firmy (nazwa, branza, status, trial_do, zgoda_regulamin_at, zgoda_regulamin_wersja, zgoda_marketing, zgoda_marketing_at)
    values (left(coalesce(nullif(trim(new.raw_user_meta_data->>'nazwa_firmy'), ''), split_part(new.email,'@',1)), 120),
            v_branza, 'trial', now() + interval '7 days', now(), v_wersja, v_mkt, case when v_mkt then now() end)
    returning id into v_firma;
    insert into public.profiles (id, firma_id, imie_nazwisko, login, rola, moduly)
    values (new.id, v_firma,
            left(coalesce(nullif(trim(new.raw_user_meta_data->>'imie_nazwisko'), ''), split_part(new.email,'@',1)), 120),
            new.email, 'admin', v_moduly);
  end if;
  return new;
end $$;
