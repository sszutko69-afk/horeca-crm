-- Nowe firmy miały puste katalogi (produkty/usługi leadów, kategorie budżetu), więc listy wyboru były puste.
-- Funkcja zasila katalogi domyślnymi pozycjami wg branży; wywoływana po wyborze branży (serwer) i teraz dla istniejących firm.
-- Dodatkowo: załączniki do zamówień.

alter table public.zamowienia add column if not exists dokumenty text[];

create or replace function public.seed_katalogi_firmy(p_firma uuid, p_branza text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prod jsonb;
  kat_przych text[] := array['Przychody ze sprzedaży', 'Pozostałe przychody'];
  kat_koszt  text[] := array['Materiały i towary', 'Usługi zewnętrzne', 'Wynagrodzenia', 'Marketing', 'Koszty stałe (czynsz, media)'];
  el jsonb;
  i int := 0;
  nazwa text;
begin
  prod := case coalesce(p_branza, 'inna')
    when 'horeca' then '[["Wesele","wydarzenie"],["Bankiet firmowy","wydarzenie"],["Konferencja z cateringiem","wydarzenie"],["Catering — lunch box","catering"],["Catering — event","catering"],["Wynajem sali","inne"]]'
    when 'inwestycyjna' then '[["Budowa obiektu","inne"],["Remont i modernizacja","inne"],["Nadzór inwestorski","inne"],["Projekt i dokumentacja","inne"],["Kosztorys i oferta","inne"]]'
    when 'gazowa' then '[["Dostawa gazu płynnego","inne"],["Dzierżawa zbiornika","inne"],["Instalacja gazowa","inne"],["Serwis i przegląd","inne"]]'
    when 'nieruchomosci' then '[["Sprzedaż nieruchomości","inne"],["Wynajem nieruchomości","inne"],["Zakup dla klienta","inne"],["Wycena nieruchomości","inne"]]'
    when 'transport' then '[["Zlecenie transportowe","inne"],["Transport cykliczny","inne"],["Spedycja międzynarodowa","inne"]]'
    when 'logistyka' then '[["Magazynowanie","inne"],["Kompletacja zamówień","inne"],["Cross-docking","inne"],["Obsługa zwrotów","inne"]]'
    when 'kancelarie' then '[["Obsługa prawna (abonament)","inne"],["Reprezentacja w sprawie","inne"],["Opinia prawna","inne"],["Rejestracja i zmiany w KRS","inne"]]'
    when 'sekretariaty' then '[["Obsługa sekretariatu","inne"],["Wirtualne biuro","inne"],["Organizacja spotkań","inne"]]'
    else '[["Usługa standardowa","inne"],["Wdrożenie","inne"],["Konsultacje","inne"],["Abonament","inne"]]'
  end::jsonb;

  if p_branza = 'inwestycyjna' then
    kat_przych := array['Przychody ze sprzedaży', 'Przychody z realizacji inwestycji'];
    kat_koszt := array['Materiały budowlane', 'Podwykonawcy', 'Usługi zewnętrzne', 'Wynagrodzenia', 'Koszty stałe (czynsz, media)'];
  elsif p_branza = 'horeca' then
    kat_koszt := array['Surowce i żywność', 'Usługi zewnętrzne', 'Wynagrodzenia', 'Marketing', 'Koszty stałe (czynsz, media)'];
  end if;

  if not exists (select 1 from public.crm_produkty where firma_id = p_firma) then
    for el in select * from jsonb_array_elements(prod) loop
      i := i + 1;
      insert into public.crm_produkty(firma_id, nazwa, kategoria, aktywny, kolejnosc) values (p_firma, el->>0, el->>1, true, i);
    end loop;
  end if;

  if not exists (select 1 from public.budzet_kategorie where firma_id = p_firma) then
    i := 0;
    foreach nazwa in array kat_przych loop
      i := i + 1;
      insert into public.budzet_kategorie(firma_id, nazwa, typ, kolejnosc) values (p_firma, nazwa, 'przychod', i);
    end loop;
    i := 0;
    foreach nazwa in array kat_koszt loop
      i := i + 1;
      insert into public.budzet_kategorie(firma_id, nazwa, typ, kolejnosc) values (p_firma, nazwa, 'koszt', i);
    end loop;
  end if;
end $$;

revoke all on function public.seed_katalogi_firmy(uuid, text) from public, anon, authenticated;
grant execute on function public.seed_katalogi_firmy(uuid, text) to service_role;

-- Istniejące firmy (także produkcyjne): uzupełnienie pustych katalogów
select public.seed_katalogi_firmy(id, branza) from public.firmy;
