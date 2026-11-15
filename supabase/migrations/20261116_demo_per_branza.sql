-- Konto demo per branża: konto demo przełącza się między osobnymi firmami demonstracyjnymi (HoReCa zostaje bez zmian).
-- Każda firma demo ma własne moduły branży i własne dane przykładowe, więc np. demo "Budownictwo" nie zawiera nic z HoReCa.
-- Przełączenie = zmiana profiles.firma_id konta demo, robiona wyłącznie przez serwer (service role).

do $$
declare
  sys text[] := array['Dashboard','Użytkownicy','Dane firmy'];
  b record;
  d jsonb;
  fid uuid;
  kid uuid[];
  nid uuid;
  i int;
  el jsonb;
  netto numeric;
  nr int;
  data jsonb := $j$
{
 "inwestycyjna": {
  "uuid": "00000000-0000-0000-0000-00000000de31",
  "moduly": ["CRM","Leady","Klienci","Zakupy","Akceptacje","Budżet","Czas pracy","Plan pracy","Raporty","Import danych"],
  "kl": [["Gmina Miasto Zielone","Zielone","firma"],["Deweloper Osiedle Parkowe Sp. z o.o.","Poznań","firma"],["Jan Kowalski (inwestor prywatny)","Łódź","osoba_fizyczna"],["Spółdzielnia Mieszkaniowa Nowe Domy","Gdańsk","firma"],["Fundacja Szkoła Przyszłości","Lublin","firma"]],
  "sp": [[0,"Etap I: roboty ziemne i fundamenty",185000,"oplacona"],[1,"Stan surowy zamknięty, budynek A",420000,"oplacona"],[1,"Instalacje wewnętrzne, budynek A",96000,"oczekuje"],[2,"Remont dachu i elewacji",58000,"oplacona"],[3,"Termomodernizacja budynku",230000,"zalegla"],[4,"Modernizacja sali sportowej",74000,"oczekuje"]],
  "zk": [["Hurtownia Stali i Betonu","Materiały budowlane","Beton B25 i stal zbrojeniowa",68000],["Wynajem Maszyn Budowlanych","Sprzęt i maszyny","Koparka i dźwig, miesiąc",24000],["Podwykonawca Elektro-Inst","Podwykonawcy","Instalacje elektryczne",37000],["Skład Dachowy","Materiały budowlane","Pokrycie dachowe i okna",19500],["BHP Serwis","Usługi","Szkolenia BHP i nadzór",4200]],
  "ld": [["Budowa osiedla domów jednorodzinnych",1,2400000,"Negocjacje"],["Przebudowa biurowca",2,860000,"Oferta"],["Hala magazynowa",3,1300000,"Pierwszy kontakt"],["Remont szkoły",4,540000,"Omówienie oferty"]],
  "zm": []
 },
 "gazowa": {
  "uuid": "00000000-0000-0000-0000-00000000de32",
  "moduly": ["CRM","Klienci","Sprzedaż","Zakupy","Zamówienia","Raporty","Import danych"],
  "kl": [["Zakład Produkcyjny Metal-Pol","Katowice","firma"],["Spółdzielnia Rolnicza Dolina","Kielce","firma"],["Piekarnia Rodzinna Chlebek","Opole","firma"],["Gminna Spółka Komunalna","Zamość","firma"],["Ośrodek Sportowy Arena","Rzeszów","firma"]],
  "sp": [[0,"Dostawa gazu płynnego, 5 t",21500,"oplacona"],[1,"Dostawa gazu płynnego, 8 t",34400,"oplacona"],[2,"Dostawa gazu płynnego, 2 t",8600,"oczekuje"],[3,"Dzierżawa zbiornika, kwartał",6200,"oplacona"],[4,"Dostawa gazu płynnego, 6 t",25800,"zalegla"],[0,"Dostawa gazu płynnego, 5 t",21500,"oczekuje"]],
  "zk": [["Hurtownia Paliw Północ","Paliwo","Zakup gazu płynnego, 20 t",72000],["Serwis Zbiorników Gaz-Tech","Serwis i przeglądy","Przegląd zbiorników",9800],["Transport Cysternowy Kowal","Transport","Przewóz cysterną, miesiąc",14500],["Ubezpieczenia Flota","Ubezpieczenia","OC floty cystern",11200]],
  "ld": [["Zbiornik naziemny dla zakładu","0",38000,"Oferta"],["Umowa dostaw dla spółdzielni","1",96000,"Negocjacje"],["Instalacja gazowa w ośrodku","4",54000,"Pierwszy kontakt"]],
  "zm": [[0,"Gaz płynny LPG",5,"t",4300],[1,"Gaz płynny LPG",8,"t",4300],[4,"Gaz płynny LPG",6,"t",4300]]
 },
 "nieruchomosci": {
  "uuid": "00000000-0000-0000-0000-00000000de33",
  "moduly": ["CRM","Leady","Klienci","Google Workspace","inFakt","Raporty","Import danych"],
  "kl": [["Anna Nowak","Kraków","osoba_fizyczna"],["Marek Wiśniewski","Warszawa","osoba_fizyczna"],["Inwestycje Miejskie Sp. z o.o.","Wrocław","firma"],["Rodzina Zielińskich","Gdynia","osoba_fizyczna"],["Fundusz Najmu Prywatnego","Poznań","firma"]],
  "sp": [[0,"Prowizja: sprzedaż mieszkania 54 m², ul. Lipowa",14800,"oplacona"],[1,"Prowizja: wynajem lokalu usługowego",6500,"oplacona"],[2,"Prowizja: sprzedaż działki inwestycyjnej",38000,"oczekuje"],[3,"Prowizja: zakup domu, Gdynia",21000,"oplacona"],[4,"Obsługa najmu, kwartał",9400,"zalegla"],[1,"Sesja i wycena nieruchomości",1800,"oplacona"]],
  "zk": [["Portal Ogłoszeniowy","Marketing","Promowanie ofert, miesiąc",2400],["Fotograf Nieruchomości","Usługi","Sesje zdjęciowe i wirtualne spacery",3100],["Kancelaria Notarialna (zwrot)","Opłaty","Opłaty notarialne i sądowe",5600],["Wynajem biura","Koszty stałe","Czynsz biura, miesiąc",6800]],
  "ld": [["Sprzedaż mieszkania 3-pokojowego","0",620000,"Negocjacje"],["Lokal usługowy w centrum","1",1450000,"Oferta"],["Działka pod zabudowę","2",980000,"Pierwszy kontakt"],["Dom z ogrodem","3",1150000,"Omówienie oferty"]],
  "zm": []
 },
 "transport": {
  "uuid": "00000000-0000-0000-0000-00000000de34",
  "moduly": ["Klienci","Zamówienia","Zakupy","Sprzedaż","Czas pracy","Plan pracy","Płace","Raporty","inFakt"],
  "kl": [["Hurtownia Spożywcza Kowalski","Poznań","firma"],["Producent Mebli Drewmar","Rzeszów","firma"],["Sieć Sklepów Domowych","Warszawa","firma"],["Zakład Przetwórstwa Owoców","Lublin","firma"],["Importer Elektroniki Techno-Max","Gdańsk","firma"]],
  "sp": [[0,"Transport Poznań–Berlin, 24 palety",6200,"oplacona"],[1,"Transport Rzeszów–Praga, 18 palet",5100,"oplacona"],[2,"Zlecenia dystrybucyjne, tydzień",14800,"oplacona"],[3,"Transport chłodniczy Lublin–Wiedeń",8900,"oczekuje"],[4,"Transport Gdańsk–Katowice, 30 palet",4700,"zalegla"],[0,"Transport Poznań–Hamburg, 22 palety",5900,"oczekuje"]],
  "zk": [["Stacja Paliw Trasa","Paliwo","Paliwo do floty, miesiąc",38000],["Serwis Pojazdów Ciężkich","Serwis","Przegląd i wymiana opon",12400],["Opłaty Drogowe","Opłaty","Opłaty drogowe, miesiąc",7600],["Ubezpieczenia Flota","Ubezpieczenia","OC i AC floty",15200]],
  "ld": [],
  "zm": [[0,"Transport drobnicowy PL–DE",24,"palet",260],[1,"Transport PL–CZ",18,"palet",283],[3,"Transport chłodniczy PL–AT",20,"palet",445]]
 },
 "logistyka": {
  "uuid": "00000000-0000-0000-0000-00000000de35",
  "moduly": ["Klienci","Zamówienia","Zakupy","Akceptacje","Plan pracy","Raporty","Import danych","Archiwizacja"],
  "kl": [["Sklep Internetowy Zakupix","Łódź","firma"],["Dystrybutor Części Auto-Part","Wrocław","firma"],["Producent Kosmetyków Bellis","Warszawa","firma"],["Hurtownia Narzędzi Mega-Tools","Kraków","firma"],["Import Zabawek Kolorowo","Gdańsk","firma"]],
  "sp": [[0,"Magazynowanie i kompletacja, miesiąc",18500,"oplacona"],[1,"Magazynowanie 400 miejsc paletowych",14400,"oplacona"],[2,"Obsługa zwrotów, miesiąc",6900,"oczekuje"],[3,"Cross-docking, miesiąc",9800,"oplacona"],[4,"Magazynowanie sezonowe",12200,"zalegla"]],
  "zk": [["Regały i Wózki Widłowe","Wyposażenie magazynu","Dzierżawa wózków widłowych",8200],["Opakowania Pak-Max","Opakowania","Folia, kartony, palety",5400],["Agencja Pracy Tymczasowej","Usługi","Pracownicy magazynowi, miesiąc",26500],["Energia Biznes","Koszty stałe","Energia hali magazynowej",7900]],
  "ld": [],
  "zm": [[0,"Przyjęcie dostawy, 40 palet",40,"palet",95],[1,"Kompletacja zamówień",1200,"szt.",4],[2,"Obsługa zwrotów",300,"szt.",9]]
 },
 "kancelarie": {
  "uuid": "00000000-0000-0000-0000-00000000de36",
  "moduly": ["CRM","Klienci","Czas pracy","Google Workspace","inFakt","AI — Finanse"],
  "kl": [["Software House Kodex Sp. z o.o.","Warszawa","firma"],["Piotr Lewandowski","Kraków","osoba_fizyczna"],["Przedsiębiorstwo Handlowe Merkur","Wrocław","firma"],["Fundacja Pomocy Rodzinie","Gdańsk","firma"],["Maria Kamińska","Poznań","osoba_fizyczna"]],
  "sp": [[0,"Obsługa prawna: abonament miesięczny",7500,"oplacona"],[1,"Reprezentacja w sprawie cywilnej",9800,"oczekuje"],[2,"Umowa handlowa, opinia prawna",4200,"oplacona"],[3,"Doradztwo: rejestracja zmian w KRS",2600,"oplacona"],[4,"Sprawa spadkowa: etap 1",3800,"zalegla"],[0,"Audyt zgodności RODO",12000,"oczekuje"]],
  "zk": [["Baza Aktów Prawnych","Licencje","Dostęp do bazy orzeczeń, rok",5800],["Wynajem biura","Koszty stałe","Czynsz kancelarii, miesiąc",7200],["Tłumacz przysięgły","Usługi","Tłumaczenia dokumentów",1900],["Opłaty sądowe i skarbowe","Opłaty","Opłaty w sprawach klientów",3400]],
  "ld": [["Obsługa prawna spółki technologicznej","0",90000,"Negocjacje"],["Sprawa o zapłatę","2",48000,"Oferta"],["Pozew rodzinny","4",12000,"Pierwszy kontakt"]],
  "zm": []
 },
 "sekretariaty": {
  "uuid": "00000000-0000-0000-0000-00000000de37",
  "moduly": ["CRM","Klienci","Akceptacje","Zamówienia","Zakupy","Google Workspace","AI — Finanse","Import danych"],
  "kl": [["Biuro Rachunkowe Bilans","Warszawa","firma"],["Agencja Reklamowa Kreatywni","Kraków","firma"],["Przychodnia Zdrowie Plus","Łódź","firma"],["Firma Budowlana Dom-Bud","Poznań","firma"],["Studio Projektowe Linia","Wrocław","firma"]],
  "sp": [[0,"Obsługa sekretariatu: abonament",3200,"oplacona"],[1,"Obsługa korespondencji i kalendarza",2800,"oplacona"],[2,"Wirtualne biuro, kwartał",1800,"oczekuje"],[3,"Organizacja spotkań i podróży",2400,"oplacona"],[4,"Obsługa recepcji, miesiąc",3900,"zalegla"]],
  "zk": [["Hurtownia Biurowa","Materiały biurowe","Papier, tonery, artykuły biurowe",2100],["Operator Telekomunikacyjny","Telefonia","Abonamenty telefoniczne",1400],["Kurier Express","Usługi","Przesyłki kurierskie, miesiąc",980],["Wynajem biura","Koszty stałe","Czynsz biura, miesiąc",5200]],
  "ld": [["Wirtualne biuro dla agencji","1",14400,"Oferta"],["Stała obsługa sekretariatu","3",46800,"Negocjacje"],["Organizacja konferencji","2",9000,"Pierwszy kontakt"]],
  "zm": [[0,"Papier A4, karton",20,"ryz",19],[1,"Tonery do drukarek",6,"szt.",230],[2,"Materiały na spotkanie",1,"kpl.",640]]
 },
 "inna": {
  "uuid": "00000000-0000-0000-0000-00000000de38",
  "moduly": ["CRM","Leady","Klienci","Zamówienia","Zakupy","Sprzedaż","Raporty","Import danych"],
  "kl": [["Klient Alfa Sp. z o.o.","Warszawa","firma"],["Klient Beta Sp. z o.o.","Kraków","firma"],["Klient Gamma","Gdańsk","firma"],["Adam Nowicki","Łódź","osoba_fizyczna"],["Klient Delta S.A.","Poznań","firma"]],
  "sp": [[0,"Usługa doradcza, projekt A",12000,"oplacona"],[1,"Wdrożenie, etap 1",18500,"oplacona"],[2,"Abonament miesięczny",2900,"oczekuje"],[3,"Konsultacje",1500,"oplacona"],[4,"Wdrożenie, etap 2",21000,"zalegla"]],
  "zk": [["Dostawca Usług IT","Usługi","Licencje i hosting",3400],["Hurtownia Biurowa","Materiały biurowe","Materiały biurowe",1200],["Agencja Marketingowa","Marketing","Kampania reklamowa",5600],["Wynajem biura","Koszty stałe","Czynsz, miesiąc",4800]],
  "ld": [["Projekt dla nowego klienta","0",60000,"Negocjacje"],["Rozszerzenie umowy","1",34000,"Oferta"],["Zapytanie ofertowe","4",25000,"Pierwszy kontakt"]],
  "zm": [[0,"Pakiet usług standardowy",1,"kpl.",9800],[1,"Licencja roczna",3,"szt.",2400]]
 }
}
$j$::jsonb;
  nazwy jsonb := '{"inwestycyjna":"Budownictwo i inwestycje","gazowa":"Branża gazowa i paliwowa","nieruchomosci":"Nieruchomości","transport":"Transport","logistyka":"Logistyka i magazyny","kancelarie":"Kancelarie prawne i doradcze","sekretariaty":"Biura i sekretariaty","inna":"Inna branża"}';
begin
  for b in select key as slug, value as v from jsonb_each(data) loop
    d := b.v;
    fid := (d->>'uuid')::uuid;

    insert into public.firmy(id, nazwa, demo, status, branza, moduly, onboarding_zakonczony, trial_do)
    values (fid, 'DEMO — ' || (nazwy->>b.slug), true, 'aktywny', b.slug,
            sys || array(select jsonb_array_elements_text(d->'moduly')), true, now() + interval '100 years')
    on conflict (id) do update set branza = excluded.branza, moduly = excluded.moduly, demo = true;

    if exists (select 1 from public.klienci where firma_id = fid) then continue; end if;

    kid := array[]::uuid[];
    for el in select * from jsonb_array_elements(d->'kl') loop
      insert into public.klienci(firma_id, nazwa, typ, miasto, aktywny, telefon, email)
      values (fid, el->>0, el->>2, el->>1, true,
              '+48 ' || (500 + (random()*400)::int) || ' ' || (100 + (random()*800)::int) || ' ' || (100 + (random()*800)::int),
              'biuro@' || lower(regexp_replace(translate(el->>0, 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzACELNOSZZ'), '[^a-zA-Z]+', '', 'g')) || '.example')
      returning id into nid;
      kid := kid || nid;
    end loop;

    nr := 0;
    for el in select * from jsonb_array_elements(d->'sp') loop
      nr := nr + 1;
      netto := (el->>2)::numeric;
      insert into public.sprzedaz(firma_id, data_sprzedazy, klient_id, nr_faktury, opis, kwota_netto, kwota_brutto, forma_sprzedazy, forma_platnosci, status)
      values (fid, current_date - (nr * 9), kid[(el->>0)::int + 1],
              'FV/' || to_char(current_date - (nr * 9), 'YYYY/MM') || '/' || lpad(nr::text, 3, '0'),
              el->>1, netto, round(netto * 1.23, 2), 'faktura_vat', 'przelew', el->>3);
    end loop;

    nr := 0;
    for el in select * from jsonb_array_elements(d->'zk') loop
      nr := nr + 1;
      netto := (el->>3)::numeric;
      insert into public.zakupy(firma_id, data_zakupu, dostawca, nr_faktury, kategoria, opis, wartosc_netto, wartosc_brutto, status)
      values (fid, current_date - (nr * 11), el->>0,
              'FZ/' || to_char(current_date - (nr * 11), 'YYYY/MM') || '/' || lpad(nr::text, 3, '0'),
              el->>1, el->>2, netto, round(netto * 1.23, 2), 'zatwierdzona');
    end loop;

    nr := 0;
    for el in select * from jsonb_array_elements(d->'ld') loop
      nr := nr + 1;
      insert into public.crm_leady(firma_id, numer, tytul, klient_id, klient_nazwa, etap, status, wartosc_szacunkowa, prawdopodobienstwo, waluta, data_pierwszego_kontaktu, usuniete)
      values (fid, 'L-' || lpad(nr::text, 3, '0'), el->>0, kid[(el->>1)::int + 1],
              (select nazwa from public.klienci where id = kid[(el->>1)::int + 1]),
              el->>3, 'aktywny', (el->>2)::numeric,
              case el->>3 when 'Negocjacje' then 70 when 'Oferta' then 50 when 'Omówienie oferty' then 40 else 20 end,
              'PLN', current_date - (nr * 6), false);
    end loop;

    nr := 0;
    for el in select * from jsonb_array_elements(d->'zm') loop
      nr := nr + 1;
      insert into public.zamowienia(firma_id, numer, klient_id, klient_nazwa, produkt, ilosc, jednostka, cena_netto, cena_brutto, vat, data_zamowienia, status, stan_akceptacji)
      values (fid, 'ZAM/' || to_char(current_date, 'YYYY') || '/' || lpad(nr::text, 3, '0'),
              kid[(el->>0)::int + 1], (select nazwa from public.klienci where id = kid[(el->>0)::int + 1]),
              el->>1, (el->>2)::numeric, el->>3, (el->>4)::numeric, round((el->>4)::numeric * 1.23, 2), 23,
              current_date - (nr * 4), case nr when 1 then 'nowe' when 2 then 'potwierdzone' else 'dostarczone' end, 'zaakceptowany');
    end loop;
  end loop;
end $$;
