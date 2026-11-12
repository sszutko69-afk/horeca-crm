-- ============================================================================
-- Skrojo / HoReCa CRM: podział na firmy (multi-tenant), rejestracja, okres próbny 7 dni, subskrypcje
-- ============================================================================
-- Co robi:
--  1. Tworzy tabelę `firmy` (plan, koniec okresu próbnego, powiązanie ze Stripe, zgody RODO).
--  2. Dodaje `firma_id` do wszystkich tabel z danymi i zastępuje polityki "demo_all" (USING true)
--     polityką "tylko dane własnej firmy". Dotychczasowe dane przypisuje do firmy DEMO.
--  3. Zabezpiecza `profiles` (nikt nie może sobie nadać roli admin ani zmienić firmy).
--  4. Nowy `handle_new_user`: rejestracja = nowa firma + konto administratora z pełną wersją na 7 dni.
-- Uruchomienie: Supabase -> SQL Editor (lub apply_migration). Skrypt jest idempotentny.
-- ============================================================================

begin;

-- ---------- 1. firmy ----------
create table if not exists public.firmy (
  id                      uuid primary key default gen_random_uuid(),
  nazwa                   text not null,
  nip                     text,
  demo                    boolean not null default false,          -- firma demonstracyjna: zawsze pełna wersja
  status                  text not null default 'trial'
                            check (status in ('trial','podstawowy','aktywny','zalegla')),
  trial_do                timestamptz not null default (now() + interval '7 days'),
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  stripe_status           text,                                    -- active | trialing | past_due | canceled ...
  subskrypcja_do          timestamptz,                             -- koniec opłaconego okresu
  zgoda_regulamin_at      timestamptz,
  zgoda_regulamin_wersja  text,
  zgoda_marketing         boolean not null default false,
  zgoda_marketing_at      timestamptz,
  created_at              timestamptz not null default now()
);
alter table public.firmy enable row level security;

-- Firma "DEMO": tu trafiają dotychczasowe dane z wersji demonstracyjnej.
insert into public.firmy (id, nazwa, demo, status, trial_do)
values ('00000000-0000-0000-0000-00000000de30', 'DEMO', true, 'aktywny', 'infinity')
on conflict (id) do nothing;

-- ---------- 2. profiles.firma_id ----------
alter table public.profiles add column if not exists firma_id uuid references public.firmy(id) on delete cascade;
update public.profiles set firma_id = '00000000-0000-0000-0000-00000000de30' where firma_id is null;
alter table public.profiles alter column firma_id set not null;
create index if not exists profiles_firma_idx on public.profiles(firma_id);

-- ---------- funkcje pomocnicze ----------
create or replace function public.current_firma_id() returns uuid
language sql stable security definer set search_path = public as $$
  select firma_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin_firmy() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rola = 'admin' and aktywny is not false)
$$;

revoke all on function public.current_firma_id() from public, anon;
revoke all on function public.is_admin_firmy() from public, anon;
grant execute on function public.current_firma_id() to authenticated;
grant execute on function public.is_admin_firmy() to authenticated;

-- ---------- polityki dla firmy ----------
drop policy if exists firmy_select_wlasna on public.firmy;
create policy firmy_select_wlasna on public.firmy for select to authenticated using (id = public.current_firma_id());
-- zapis do `firmy` tylko przez service role (webhook Stripe, rejestracja) - brak polityk INSERT/UPDATE/DELETE

-- ---------- 3. firma_id we wszystkich tabelach z danymi ----------
do $$
declare
  t text;
  p record;
  tabele text[] := array[
    'akceptacje_konfiguracja','budzet_kategorie','budzet_plan','budzet_realizacja',
    'crm_aktywnosci','crm_lead_dokumenty','crm_lead_historia','crm_leady','crm_produkty','crm_zadania',
    'czas_pracy','firma_dane','firma_dokumenty','klienci','komentarze','kontakty','listy_obecnosci',
    'place','place_parametry','plan_pracy','powiadomienia','pracownicy','sprzedaz','user_google_tokens',
    'wydarzenia','zakupy','zamowienia'
  ];
begin
  foreach t in array tabele loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I add column if not exists firma_id uuid references public.firmy(id) on delete cascade', t);
    execute format('update public.%I set firma_id = %L where firma_id is null', t, '00000000-0000-0000-0000-00000000de30');
    execute format('alter table public.%I alter column firma_id set default public.current_firma_id()', t);
    execute format('alter table public.%I alter column firma_id set not null', t);
    execute format('create index if not exists %I on public.%I(firma_id)', t || '_firma_idx', t);
    execute format('alter table public.%I enable row level security', t);
    for p in select polname from pg_policy where polrelid = ('public.' || t)::regclass loop
      execute format('drop policy %I on public.%I', p.polname, t);
    end loop;
    execute format($f$create policy tenant_all on public.%I for all to authenticated
                      using (firma_id = public.current_firma_id()) with check (firma_id = public.current_firma_id())$f$, t);
  end loop;
end $$;

-- Unikalność per firma (zamiast globalnej)
alter table public.firma_dane drop constraint if exists firma_dane_klucz_key;
alter table public.firma_dane add constraint firma_dane_firma_klucz_key unique (firma_id, klucz);

-- tokeny Google: dodatkowo tylko własne
drop policy if exists tenant_all on public.user_google_tokens;
create policy wlasne_tokeny on public.user_google_tokens for all to authenticated
  using (user_id = auth.uid() and firma_id = public.current_firma_id())
  with check (user_id = auth.uid() and firma_id = public.current_firma_id());

-- ---------- 4. profiles: polityki i ochrona przed podniesieniem uprawnień ----------
do $$
declare p record;
begin
  for p in select polname from pg_policy where polrelid = 'public.profiles'::regclass loop
    execute format('drop policy %I on public.profiles', p.polname);
  end loop;
end $$;

create policy profiles_select on public.profiles for select to authenticated using (firma_id = public.current_firma_id());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (firma_id = public.current_firma_id() and public.is_admin_firmy())
  with check (firma_id = public.current_firma_id());
create policy profiles_delete_admin on public.profiles for delete to authenticated
  using (firma_id = public.current_firma_id() and public.is_admin_firmy() and id <> auth.uid());
-- INSERT: tylko service role / trigger (brak polityki dla authenticated)

create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;                       -- service role / trigger
  if new.firma_id is distinct from old.firma_id or new.id is distinct from old.id then
    raise exception 'Nie można zmienić firmy ani identyfikatora konta';
  end if;
  if (new.rola is distinct from old.rola or new.aktywny is distinct from old.aktywny or new.moduly is distinct from old.moduly)
     and not public.is_admin_firmy() then
    raise exception 'Tylko administrator może zmieniać rolę, aktywność i uprawnienia';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_tr on public.profiles;
create trigger profiles_guard_tr before update on public.profiles for each row execute function public.profiles_guard();

-- ---------- 5. rejestracja: nowe konto = nowa firma + administrator, pełna wersja na 7 dni ----------
-- UWAGA BEZPIECZEŃSTWA: raw_user_meta_data może ustawić dowolny użytkownik przy signUp(), więc NIE wolno z niego brać
-- firma_id ani roli. Konta dodawane przez administratora (service role) niosą firma_id w raw_app_meta_data.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_firma uuid;
  v_rola  user_role;
  v_wersja text := coalesce(new.raw_user_meta_data->>'regulamin_wersja', '2026-11');
  v_mkt   boolean := coalesce((new.raw_user_meta_data->>'zgoda_marketing')::boolean, false);
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
    -- samodzielna rejestracja: nowa firma, rola administratora, login = adres e-mail
    insert into public.firmy (nazwa, status, trial_do, zgoda_regulamin_at, zgoda_regulamin_wersja, zgoda_marketing, zgoda_marketing_at)
    values (left(coalesce(nullif(trim(new.raw_user_meta_data->>'nazwa_firmy'), ''), split_part(new.email,'@',1)), 120),
            'trial', now() + interval '7 days', now(), v_wersja, v_mkt, case when v_mkt then now() end)
    returning id into v_firma;
    insert into public.profiles (id, firma_id, imie_nazwisko, login, rola, moduly)
    values (new.id, v_firma,
            left(coalesce(nullif(trim(new.raw_user_meta_data->>'imie_nazwisko'), ''), split_part(new.email,'@',1)), 120),
            new.email, 'admin', v_moduly);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- 6. Storage: pliki firmy w folderach {firma_id}/... ----------
-- (bucket `firma` i `dokumenty` były publiczne; ścieżki zawierają teraz firma_id i są wgrywane tylko przez API z service role)

commit;
