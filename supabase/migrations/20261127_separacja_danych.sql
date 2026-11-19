-- Audyt separacji danych między firmami (2026-11-19): poprawki.
-- 1) truncate_*: kasowały dane WSZYSTKICH firm (SECURITY DEFINER omija RLS) -> teraz tylko własna firma.
-- 2) akc_decyzja: zmiana stanu akceptacji dowolnego rekordu dowolnej firmy -> teraz tylko własna firma, role admin/menedzer, tabele z listy.
-- 3) przetargi_archiwizuj_stare / przetargi_przywroc: brakowały (wywoływane przez stronę Przetargi), tworzone jako SECURITY INVOKER (RLS).
-- 4) uprawnienia: rola anon bez dostępu do tabel/funkcji; brak TRUNCATE/REFERENCES/TRIGGER dla zalogowanych.
-- 5) storage: dostęp do plików tylko dla firmy właściciela pliku (wcześniej każdy zalogowany widział/kasował pliki wszystkich firm).

-- 1
create or replace function public.truncate_klienci() returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_firmy() then raise exception 'Tylko administrator firmy'; end if;
  delete from public.klienci where firma_id = public.current_firma_id();
end $$;
create or replace function public.truncate_sprzedaz() returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_firmy() then raise exception 'Tylko administrator firmy'; end if;
  delete from public.sprzedaz where firma_id = public.current_firma_id();
end $$;
create or replace function public.truncate_zakupy() returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_firmy() then raise exception 'Tylko administrator firmy'; end if;
  delete from public.zakupy where firma_id = public.current_firma_id();
end $$;

-- 2
create or replace function public.akc_decyzja(p_modul text, p_rekord_id uuid, p_decyzja text, p_komentarz text)
returns void language plpgsql security definer set search_path = public as $$
declare v_firma uuid := public.current_firma_id(); v_tabela text; v_etykieta text; v_zgl uuid; v_n int;
begin
  if v_firma is null then raise exception 'Brak firmy'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and rola in ('admin','menedzer') and aktywny is not false) then
    raise exception 'Brak uprawnień do akceptacji';
  end if;
  if p_decyzja not in ('zaakceptowany','odrzucony','do_poprawy','oczekuje') then raise exception 'Niepoprawna decyzja'; end if;
  -- konfiguracja własnej firmy, a gdy jej brak: domyślne mapowanie (tylko znane tabele)
  select tabela, etykieta into v_tabela, v_etykieta from public.akceptacje_konfiguracja where modul = p_modul and firma_id = v_firma;
  if v_tabela is null then
    v_tabela := case p_modul when 'zamowienia' then 'zamowienia' when 'wydarzenia' then 'wydarzenia' when 'czas_pracy' then 'czas_pracy' end;
    v_etykieta := case p_modul when 'zamowienia' then 'Zamówienie' when 'wydarzenia' then 'Wydarzenie' when 'czas_pracy' then 'Godziny pracy' end;
  end if;
  if v_tabela is null or v_tabela not in ('zamowienia','wydarzenia','czas_pracy') then raise exception 'Nieznany moduł: %', p_modul; end if;
  execute format('update public.%I set stan_akceptacji = $1, akceptacja_uwagi = $2 where id = $3 and firma_id = $4 returning zglosil_id', v_tabela)
    into v_zgl using p_decyzja, p_komentarz, p_rekord_id, v_firma;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Nie znaleziono rekordu'; end if;
  if v_zgl is not null and p_decyzja <> 'zaakceptowany' then
    insert into public.powiadomienia(odbiorca_id, nadawca_id, typ, tytul, tresc, link)
    values (v_zgl, auth.uid(), 'akceptacja',
            case when p_decyzja = 'odrzucony' then 'Odrzucono: ' else 'Do poprawy: ' end || coalesce(v_etykieta, p_modul),
            p_komentarz, '/akceptacje');
  end if;
end $$;

-- 3
create or replace function public.przetargi_archiwizuj_stare(dni integer default 30, przez text default 'auto_30d')
returns integer language plpgsql set search_path = public as $$
declare ile int;
begin
  update public.przetargi
     set zarchiwizowany = true, zarchiwizowany_at = now(), zarchiwizowany_przez = przez
   where firma_id = public.current_firma_id()
     and not zarchiwizowany and not coalesce(usuniete, false)
     and data_skladania < current_date - dni
     and not coalesce(obserwowany, false)
     and coalesce(status, 'nowy') not in ('obserwowany', 'zgłoszony', 'wygrany');
  get diagnostics ile = row_count;
  return ile;
end $$;
create or replace function public.przetargi_przywroc(ids uuid[])
returns integer language plpgsql set search_path = public as $$
declare ile int;
begin
  update public.przetargi set zarchiwizowany = false, zarchiwizowany_at = null, zarchiwizowany_przez = null
   where id = any(ids) and firma_id = public.current_firma_id();
  get diagnostics ile = row_count;
  return ile;
end $$;

-- 4
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;
grant execute on function public.current_firma_id() to authenticated;
grant execute on function public.is_admin_firmy() to authenticated;
grant execute on function public.akc_decyzja(text, uuid, text, text) to authenticated;
grant execute on function public.truncate_klienci() to authenticated;
grant execute on function public.truncate_sprzedaz() to authenticated;
grant execute on function public.truncate_zakupy() to authenticated;
grant execute on function public.przetargi_archiwizuj_stare(integer, text) to authenticated;
grant execute on function public.przetargi_przywroc(uuid[]) to authenticated;

-- 5
drop policy if exists demo_storage_crm on storage.objects;
drop policy if exists dokumenty_auth_all on storage.objects;
drop policy if exists listy_obecnosci_all on storage.objects;
drop policy if exists storage_firma_select on storage.objects;
drop policy if exists storage_firma_insert on storage.objects;
drop policy if exists storage_firma_update on storage.objects;
drop policy if exists storage_firma_delete on storage.objects;
create policy storage_firma_select on storage.objects for select to authenticated
  using (bucket_id in ('dokumenty','firma','listy-obecnosci')
         and exists (select 1 from public.profiles p where p.id = objects.owner and p.firma_id = public.current_firma_id()));
create policy storage_firma_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('dokumenty','firma','listy-obecnosci') and owner = auth.uid());
create policy storage_firma_update on storage.objects for update to authenticated
  using (bucket_id in ('dokumenty','firma','listy-obecnosci')
         and exists (select 1 from public.profiles p where p.id = objects.owner and p.firma_id = public.current_firma_id()))
  with check (bucket_id in ('dokumenty','firma','listy-obecnosci') and owner = auth.uid());
create policy storage_firma_delete on storage.objects for delete to authenticated
  using (bucket_id in ('dokumenty','firma','listy-obecnosci')
         and exists (select 1 from public.profiles p where p.id = objects.owner and p.firma_id = public.current_firma_id()));

-- 6 (migracja "storage_firma_prefix"): bucket "firma" - pliki wgrywa serwer pod <firma_id>/..., więc dostęp wg folderu firmy
drop policy if exists storage_firma_folder on storage.objects;
create policy storage_firma_folder on storage.objects for all to authenticated
  using (bucket_id = 'firma' and (storage.foldername(name))[1] = public.current_firma_id()::text)
  with check (bucket_id = 'firma' and (storage.foldername(name))[1] = public.current_firma_id()::text);
