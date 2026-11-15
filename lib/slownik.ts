// Słownik terminologii per branża: żeby klient budowlany nie widział gastronomii, a restauracja nie widziała budowy.
// Używany w modułach wspólnych (Kadry, Plan pracy, Czas pracy, Zamówienia, Leady, Użytkownicy, AI, Budżet...).
import type { BranzaSlug } from './branze'

export type Slownik = {
  branza: BranzaSlug | null
  horeca: boolean
  demo: boolean
  /** w jakiej firmie działa asystent AI: "Jesteś doradcą finansowym dla {kontekstAI}" */
  kontekstAI: string
  /** krótki opis firmy do promptów: "Dane budżetowe {opisFirmy} za rok" */
  opisFirmy: string
  rola: { admin: string; menedzer: string; kelner: string; kucharz: string }
  stanowiska: string[]
  domyslneStanowisko: string
  dzialy: string[]
  delegacja: { etykieta: string; opis: string; placeholder: string; wydarzenie: string }
  produktyZamowien: string[]
  jednostki: string[]
  zamowienia: { podtytul: string; przekazanie: string; przekazanieOpis: string; grupa: string; uslugi: string[] }
  /** encja 'wydarzenia' w bazie: dla HoReCa wydarzenie/impreza, dla reszty projekt/zlecenie */
  projekt: { jedn: string; przyklad: string; strefa: string; koszty: string }
  kategorieZakupow: string[]
  klienciEtykieta: string
  leady: { wydarzenie: string; catering: string; inne: string; grupaCatering: string; grupaWydarzenie: string }
  zapytaniaMailowe: string
  placeholderEmail: string
  planPracyPlaceholder: string
  przykladZamowienia: string
}

const RAZEM_ROLE = (kelner: string, kucharz: string) => ({ admin: 'Administrator', menedzer: 'Menedżer', kelner, kucharz })

type Wariant = Omit<Slownik, 'branza' | 'horeca' | 'demo'>

const OGOLNE_LEADY = { wydarzenie: 'Projekt / usługa jednorazowa', catering: 'Dostawy i zamówienia cykliczne', inne: 'Inne', grupaCatering: '📦 Dostawy i zamówienia', grupaWydarzenie: '📌 Projekty i usługi' }

const WARIANTY: Record<BranzaSlug, Wariant> = {
  horeca: {
    kontekstAI: 'restauracji, hotelu i firmy cateringowej (HoReCa)', opisFirmy: 'restauracji / firmy HoReCa (catering, bankiety, sala)',
    rola: RAZEM_ROLE('Kelner / obsługa sali', 'Kucharz / kuchnia'),
    stanowiska: ['Menedżer restauracji', 'Kierownik zmiany', 'Szef kuchni', 'Sous chef', 'Kucharz', 'Pomoc kuchenna', 'Cukiernik', 'Kelner', 'Barman', 'Barista', 'Sommelier', 'Hostessa', 'Recepcjonista', 'Pokojowa', 'Obsługa cateringu / eventów', 'Kierowca / dostawca', 'Magazynier', 'Księgowa', 'Administracja'],
    domyslneStanowisko: 'Kelner',
    dzialy: ['Sala', 'Kuchnia', 'Bar', 'Recepcja', 'Catering / wydarzenie', 'Dostawy', 'Zaplecze / magazyn', 'Administracja'],
    delegacja: { etykieta: 'Wyjazd cateringowy', opis: 'Wyjazd cateringowy', placeholder: 'np. obsługa wesela, catering zewnętrzny...', wydarzenie: 'Wydarzenie / impreza (opcjonalnie)' },
    jednostki: ['porcja', 'os.', 'szt', 'kg', 'l'],
    produktyZamowien: ['Catering — lunch box', 'Catering — bankiet', 'Zestaw obiadowy', 'Tort / ciasta', 'Wypieki i pieczywo', 'Napoje i alkohole'],
    zamowienia: { podtytul: 'Zamówienia klientów · Catering i dostawy · Realizacja przez kuchnię', przekazanie: 'kuchnia i dostawa', przekazanieOpis: 'kuchnia + dostawa', grupa: 'Catering i gastronomia', uslugi: ['Wynajem sali', 'Obsługa kelnerska'] },
    projekt: { jedn: 'Wydarzenie', przyklad: 'np. bankiet, wesele', strefa: 'Strefa / Wydarzenie', koszty: 'wydarzenie' },
    kategorieZakupow: ['Mięso i wędliny', 'Ryby i owoce morza', 'Warzywa i owoce', 'Nabiał i jaja', 'Alkohole i wina', 'Kawa i herbata', 'Pieczywo', 'Inne'],
    klienciEtykieta: 'Klienci i goście',
    leady: { wydarzenie: 'Wydarzenie', catering: 'Catering', inne: 'Inne', grupaCatering: '🍽 Catering i dostawy', grupaWydarzenie: '🎉 Wydarzenia' },
    zapytaniaMailowe: 'rezerwacja OR rezerwacje OR stolik OR wesele OR bankiet', placeholderEmail: 'jan@restauracja.pl',
    planPracyPlaceholder: 'Np. zmiana poranna 8-16, obsługa wesela...', przykladZamowienia: 'np. Catering — bankiet 60 osób',
  },
  inwestycyjna: {
    kontekstAI: 'firmy budowlanej i inwestycyjnej', opisFirmy: 'firmy budowlanej / inwestycyjnej (budowy, kosztorysy, podwykonawcy)',
    rola: RAZEM_ROLE('Pracownik biura / obsługa klienta', 'Pracownik budowy / wykonawca'),
    stanowiska: ['Kierownik budowy', 'Inżynier budowy', 'Majster', 'Kosztorysant', 'Specjalista ds. przetargów', 'Brygadzista', 'Operator maszyn', 'Murarz', 'Betoniarz / zbrojarz', 'Elektryk', 'Hydraulik', 'Pracownik budowlany', 'Kierowca', 'Magazynier', 'Księgowa', 'Administracja'],
    domyslneStanowisko: 'Pracownik budowlany',
    dzialy: ['Budowa', 'Biuro', 'Kosztorysy i przetargi', 'Magazyn', 'Transport', 'Administracja'],
    delegacja: { etykieta: 'Delegacja / wyjazd na budowę', opis: 'Delegacja / wyjazd na budowę', placeholder: 'np. wyjazd na budowę, odbiór techniczny...', wydarzenie: 'Inwestycja / projekt (opcjonalnie)' },
    jednostki: ['szt', 'kg', 'm²', 'm³', 'godz.', 'kpl.'],
    produktyZamowien: ['Materiały budowlane', 'Roboty budowlane', 'Roboty instalacyjne', 'Wynajem sprzętu', 'Transport i dostawa', 'Usługa projektowa'],
    zamowienia: { podtytul: 'Zamówienia klientów · Realizacja i dostawy', przekazanie: 'realizacja', przekazanieOpis: 'realizacja + dostawa', grupa: 'Budownictwo', uslugi: ['Wynajem sprzętu', 'Nadzór inwestorski'] },
    projekt: { jedn: 'Inwestycja', przyklad: 'np. nowa inwestycja, etap robót', strefa: 'Budowa / Inwestycja', koszty: 'inwestycję' },
    kategorieZakupow: ['Materiały budowlane', 'Narzędzia i sprzęt', 'Paliwo', 'Podwykonawcy', 'Transport', 'Biuro', 'Inne'],
    klienciEtykieta: 'Klienci i inwestorzy', leady: OGOLNE_LEADY,
    zapytaniaMailowe: 'oferta OR zapytanie ofertowe OR przetarg OR kosztorys', placeholderEmail: 'jan@firma.pl',
    planPracyPlaceholder: 'Np. zmiana 7-15, budowa ul. Lipowa...', przykladZamowienia: 'np. Roboty ziemne — etap 1',
  },
  gazowa: {
    kontekstAI: 'firmy dystrybuującej gaz i paliwa', opisFirmy: 'firmy gazowej / paliwowej (dostawy, zbiorniki, odbiorcy)',
    rola: RAZEM_ROLE('Obsługa klienta / biuro', 'Pracownik dostaw / serwisu'),
    stanowiska: ['Kierownik oddziału', 'Handlowiec', 'Kierowca-cysterniarz', 'Technik instalacji', 'Serwisant', 'Magazynier', 'Dyspozytor', 'Księgowa', 'Administracja'],
    domyslneStanowisko: 'Handlowiec',
    dzialy: ['Dostawy', 'Serwis', 'Magazyn', 'Biuro', 'Administracja'],
    delegacja: { etykieta: 'Wyjazd służbowy / dostawa', opis: 'Wyjazd służbowy / dostawa', placeholder: 'np. dostawa do klienta, przegląd instalacji...', wydarzenie: 'Zlecenie / projekt (opcjonalnie)' },
    jednostki: ['szt', 'kg', 'l', 'godz.', 'usł.', 'kpl.'],
    produktyZamowien: ['Dostawa produktu', 'Usługa serwisowa', 'Przegląd instalacji', 'Montaż', 'Transport'],
    zamowienia: { podtytul: 'Zamówienia klientów · Dostawy i realizacja', przekazanie: 'realizacja i dostawa', przekazanieOpis: 'realizacja + dostawa', grupa: 'Dostawy i serwis', uslugi: ['Przegląd okresowy', 'Serwis'] },
    projekt: { jedn: 'Projekt', przyklad: 'np. nowe zlecenie, projekt dla klienta', strefa: 'Dział / Projekt', koszty: 'projekt' },
    kategorieZakupow: ['Towar do dystrybucji', 'Paliwo', 'Serwis i części', 'Transport', 'Biuro', 'Inne'],
    klienciEtykieta: 'Klienci i odbiorcy', leady: OGOLNE_LEADY,
    zapytaniaMailowe: 'oferta OR zamówienie OR zapytanie OR dostawa', placeholderEmail: 'jan@firma.pl',
    planPracyPlaceholder: 'Np. zmiana 7-15, trasa dostaw...', przykladZamowienia: 'np. Dostawa — zamówienie cykliczne',
  },
  nieruchomosci: {
    kontekstAI: 'pośrednika i zarządcy nieruchomości', opisFirmy: 'biura nieruchomości (sprzedaż, wynajem, zarządzanie)',
    rola: RAZEM_ROLE('Obsługa klienta', 'Agent / opiekun'),
    stanowiska: ['Pośrednik', 'Agent nieruchomości', 'Zarządca nieruchomości', 'Doradca klienta', 'Specjalista ds. wycen', 'Fotograf / prezentacje', 'Asystent / sekretariat', 'Księgowa', 'Administracja'],
    domyslneStanowisko: 'Pośrednik',
    dzialy: ['Sprzedaż', 'Wynajem', 'Zarządzanie', 'Biuro', 'Administracja'],
    delegacja: { etykieta: 'Prezentacja / wyjazd do klienta', opis: 'Prezentacja / wyjazd do klienta', placeholder: 'np. prezentacja mieszkania, odbiór lokalu...', wydarzenie: 'Oferta / nieruchomość (opcjonalnie)' },
    jednostki: ['szt', 'kg', 'l', 'godz.', 'usł.', 'kpl.'],
    produktyZamowien: ['Pośrednictwo sprzedaży', 'Pośrednictwo najmu', 'Zarządzanie nieruchomością', 'Wycena', 'Sesja zdjęciowa'],
    zamowienia: { podtytul: 'Zlecenia klientów · Realizacja', przekazanie: 'realizacja', przekazanieOpis: 'realizacja', grupa: 'Usługi', uslugi: ['Pokaz nieruchomości', 'Obsługa najmu'] },
    projekt: { jedn: 'Projekt', przyklad: 'np. nowe zlecenie, projekt dla klienta', strefa: 'Dział / Projekt', koszty: 'projekt' },
    kategorieZakupow: ['Marketing i ogłoszenia', 'Biuro', 'Usługi zewnętrzne', 'Samochód', 'Inne'],
    klienciEtykieta: 'Klienci', leady: OGOLNE_LEADY,
    zapytaniaMailowe: 'oferta OR zapytanie OR mieszkanie OR najem OR pokaz', placeholderEmail: 'jan@biuro.pl',
    planPracyPlaceholder: 'Np. pokazy 10-14, dyżur w biurze...', przykladZamowienia: 'np. Pośrednictwo — sprzedaż mieszkania',
  },
  transport: {
    kontekstAI: 'firmy transportowej', opisFirmy: 'firmy transportowej (zlecenia, flota, kierowcy)',
    rola: RAZEM_ROLE('Dyspozytor / obsługa klienta', 'Kierowca / wykonawca'),
    stanowiska: ['Kierowca', 'Dyspozytor', 'Spedytor', 'Kierownik floty', 'Mechanik', 'Magazynier', 'Księgowa', 'Administracja'],
    domyslneStanowisko: 'Kierowca',
    dzialy: ['Dyspozytura', 'Trasy', 'Warsztat', 'Magazyn', 'Administracja'],
    delegacja: { etykieta: 'Trasa międzynarodowa / delegacja', opis: 'Trasa międzynarodowa / delegacja', placeholder: 'np. trasa DE, rozładunek u klienta...', wydarzenie: 'Zlecenie / trasa (opcjonalnie)' },
    jednostki: ['szt', 'kg', 'l', 'godz.', 'usł.', 'kpl.'],
    produktyZamowien: ['Transport krajowy', 'Transport międzynarodowy', 'Transport ponadgabarytowy', 'Spedycja', 'Magazynowanie'],
    zamowienia: { podtytul: 'Zlecenia transportowe · Realizacja tras', przekazanie: 'dyspozytura', przekazanieOpis: 'dyspozytura + trasa', grupa: 'Transport', uslugi: ['Załadunek / rozładunek', 'Transport pilny'] },
    projekt: { jedn: 'Projekt', przyklad: 'np. nowe zlecenie, projekt dla klienta', strefa: 'Dział / Projekt', koszty: 'projekt' },
    kategorieZakupow: ['Paliwo', 'Opony i części', 'Serwis', 'Opłaty drogowe', 'Ubezpieczenia', 'Inne'],
    klienciEtykieta: 'Klienci i zleceniodawcy', leady: OGOLNE_LEADY,
    zapytaniaMailowe: 'zlecenie OR transport OR wycena OR spedycja', placeholderEmail: 'jan@firma.pl',
    planPracyPlaceholder: 'Np. trasa Warszawa–Berlin, zmiana nocna...', przykladZamowienia: 'np. Transport — trasa Warszawa–Poznań',
  },
  logistyka: {
    kontekstAI: 'firmy logistycznej i handlu hurtowego', opisFirmy: 'firmy logistycznej / hurtowej (zamówienia, dostawcy, magazyn)',
    rola: RAZEM_ROLE('Obsługa zamówień', 'Magazynier / realizacja'),
    stanowiska: ['Magazynier', 'Operator wózka widłowego', 'Kierownik magazynu', 'Specjalista ds. zamówień', 'Dyspozytor', 'Kierowca', 'Księgowa', 'Administracja'],
    domyslneStanowisko: 'Magazynier',
    dzialy: ['Magazyn', 'Kompletacja', 'Wysyłki', 'Biuro', 'Administracja'],
    delegacja: { etykieta: 'Delegacja / wyjazd służbowy', opis: 'Delegacja / wyjazd służbowy', placeholder: 'np. wizyta u dostawcy, inwentaryzacja...', wydarzenie: 'Zamówienie / projekt (opcjonalnie)' },
    jednostki: ['szt', 'kg', 'l', 'godz.', 'usł.', 'kpl.'],
    produktyZamowien: ['Dostawa towaru', 'Kompletacja zamówienia', 'Magazynowanie', 'Cross-docking', 'Transport'],
    zamowienia: { podtytul: 'Zamówienia klientów · Magazyn i wysyłki', przekazanie: 'magazyn i wysyłka', przekazanieOpis: 'magazyn + wysyłka', grupa: 'Logistyka', uslugi: ['Magazynowanie', 'Kompletacja'] },
    projekt: { jedn: 'Projekt', przyklad: 'np. nowe zlecenie, projekt dla klienta', strefa: 'Dział / Projekt', koszty: 'projekt' },
    kategorieZakupow: ['Towar', 'Opakowania', 'Paliwo', 'Sprzęt magazynowy', 'Transport', 'Inne'],
    klienciEtykieta: 'Klienci i odbiorcy', leady: OGOLNE_LEADY,
    zapytaniaMailowe: 'zamówienie OR dostawa OR zapytanie OR oferta', placeholderEmail: 'jan@firma.pl',
    planPracyPlaceholder: 'Np. zmiana poranna 6-14, kompletacja...', przykladZamowienia: 'np. Dostawa — zamówienie hurtowe',
  },
  kancelarie: {
    kontekstAI: 'kancelarii prawnej lub doradczej', opisFirmy: 'kancelarii prawnej / doradczej (sprawy, klienci, rozliczenia czasu)',
    rola: RAZEM_ROLE('Sekretariat / obsługa klienta', 'Prawnik / konsultant'),
    stanowiska: ['Adwokat', 'Radca prawny', 'Aplikant', 'Prawnik', 'Asystent prawny', 'Sekretarka', 'Kierownik biura', 'Księgowa', 'Administracja'],
    domyslneStanowisko: 'Prawnik',
    dzialy: ['Prawnicy', 'Sekretariat', 'Księgowość', 'Administracja'],
    delegacja: { etykieta: 'Wyjazd do sądu / klienta', opis: 'Wyjazd do sądu / klienta', placeholder: 'np. rozprawa, spotkanie z klientem...', wydarzenie: 'Sprawa (opcjonalnie)' },
    jednostki: ['szt', 'kg', 'l', 'godz.', 'usł.', 'kpl.'],
    produktyZamowien: ['Obsługa prawna', 'Opinia prawna', 'Reprezentacja w sprawie', 'Przygotowanie umowy', 'Doradztwo'],
    zamowienia: { podtytul: 'Zlecenia klientów · Realizacja', przekazanie: 'realizacja', przekazanieOpis: 'realizacja', grupa: 'Usługi prawne', uslugi: ['Konsultacja', 'Reprezentacja'] },
    projekt: { jedn: 'Projekt', przyklad: 'np. nowe zlecenie, projekt dla klienta', strefa: 'Dział / Projekt', koszty: 'projekt' },
    kategorieZakupow: ['Biuro', 'Oprogramowanie', 'Opłaty i wpisy', 'Szkolenia', 'Usługi zewnętrzne', 'Inne'],
    klienciEtykieta: 'Klienci', leady: OGOLNE_LEADY,
    zapytaniaMailowe: 'zapytanie OR sprawa OR wycena OR oferta', placeholderEmail: 'jan@kancelaria.pl',
    planPracyPlaceholder: 'Np. dyżur w kancelarii 9-17, rozprawa...', przykladZamowienia: 'np. Obsługa prawna — umowa najmu',
  },
  sekretariaty: {
    kontekstAI: 'biura i sekretariatu', opisFirmy: 'biura / sekretariatu (obsługa korespondencji, zadania, akceptacje)',
    rola: RAZEM_ROLE('Obsługa biura', 'Asystent / wykonawca'),
    stanowiska: ['Kierownik biura', 'Sekretarka', 'Asystent', 'Specjalista ds. obsługi klienta', 'Recepcjonista', 'Księgowa', 'Administracja'],
    domyslneStanowisko: 'Asystent',
    dzialy: ['Recepcja', 'Sekretariat', 'Biuro', 'Administracja'],
    delegacja: { etykieta: 'Delegacja / wyjazd służbowy', opis: 'Delegacja / wyjazd służbowy', placeholder: 'np. spotkanie u klienta, szkolenie...', wydarzenie: 'Projekt / zadanie (opcjonalnie)' },
    jednostki: ['szt', 'kg', 'm²', 'm³', 'godz.', 'kpl.'],
    produktyZamowien: ['Materiały biurowe', 'Usługa administracyjna', 'Obsługa korespondencji', 'Organizacja spotkania', 'Zakup sprzętu'],
    zamowienia: { podtytul: 'Zamówienia · Realizacja', przekazanie: 'realizacja', przekazanieOpis: 'realizacja', grupa: 'Usługi biurowe', uslugi: ['Organizacja spotkania', 'Obsługa korespondencji'] },
    projekt: { jedn: 'Projekt', przyklad: 'np. nowe zlecenie, projekt dla klienta', strefa: 'Dział / Projekt', koszty: 'projekt' },
    kategorieZakupow: ['Materiały biurowe', 'Sprzęt', 'Oprogramowanie', 'Usługi', 'Inne'],
    klienciEtykieta: 'Klienci i kontrahenci', leady: OGOLNE_LEADY,
    zapytaniaMailowe: 'zapytanie OR zamówienie OR oferta OR spotkanie', placeholderEmail: 'jan@firma.pl',
    planPracyPlaceholder: 'Np. dyżur na recepcji 8-16...', przykladZamowienia: 'np. Materiały biurowe — zamówienie miesięczne',
  },
  inna: {
    kontekstAI: 'firmy usługowej', opisFirmy: 'firmy (sprzedaż, zakupy, zespół)',
    rola: RAZEM_ROLE('Obsługa klienta', 'Pracownik wykonawczy'),
    stanowiska: ['Kierownik', 'Specjalista', 'Asystent', 'Pracownik biurowy', 'Pracownik terenowy', 'Handlowiec', 'Magazynier', 'Księgowa', 'Administracja'],
    domyslneStanowisko: 'Specjalista',
    dzialy: ['Biuro', 'Obsługa klienta', 'Realizacja', 'Magazyn', 'Administracja'],
    delegacja: { etykieta: 'Delegacja / wyjazd służbowy', opis: 'Delegacja / wyjazd służbowy', placeholder: 'np. wizyta u klienta, szkolenie...', wydarzenie: 'Projekt / zlecenie (opcjonalnie)' },
    jednostki: ['szt', 'kg', 'l', 'godz.', 'usł.', 'kpl.'],
    produktyZamowien: ['Usługa', 'Dostawa towaru', 'Projekt', 'Serwis', 'Transport'],
    zamowienia: { podtytul: 'Zamówienia klientów · Realizacja', przekazanie: 'realizacja', przekazanieOpis: 'realizacja', grupa: 'Usługi', uslugi: ['Serwis', 'Konsultacja'] },
    projekt: { jedn: 'Projekt', przyklad: 'np. nowe zlecenie, projekt dla klienta', strefa: 'Dział / Projekt', koszty: 'projekt' },
    kategorieZakupow: ['Materiały', 'Usługi', 'Sprzęt', 'Transport', 'Biuro', 'Inne'],
    klienciEtykieta: 'Klienci', leady: OGOLNE_LEADY,
    zapytaniaMailowe: 'oferta OR zamówienie OR zapytanie', placeholderEmail: 'jan@firma.pl',
    planPracyPlaceholder: 'Np. zmiana poranna 8-16...', przykladZamowienia: 'np. Usługa — zlecenie miesięczne',
  },
}

export function slownik(branza: string | null | undefined, demo = false): Slownik {
  const slug = (branza && branza in WARIANTY ? branza : null) as BranzaSlug | null
  // do czasu wczytania branży (slug = null) używamy neutralnego słownika, nigdy HoReCa
  const w = WARIANTY[slug ?? 'inna']
  return { ...w, branza: slug, horeca: slug === 'horeca', demo }
}

// Domyślne moduły ról: HoReCa (sala/kuchnia) vs reszta branż (obsługa klienta / realizacja)
export function rolaDomyslneModuly(rola: string, branza: string | null | undefined): string[] {
  const horeca = branza === 'horeca'
  if (rola === 'admin') return []
  if (rola === 'menedzer') return horeca
    ? ['Dashboard', 'Akceptacje', 'Rezerwacje', 'Stoły', 'Menu', 'CRM', 'Leady', 'Zamówienia', 'Klienci', 'Zakupy', 'Sprzedaż', 'Raporty', 'AI — Finanse', 'Budżet', 'POS', 'eService', 'Kadry', 'Czas pracy', 'Plan pracy', 'Płace']
    : ['Dashboard', 'Akceptacje', 'CRM', 'Leady', 'Zamówienia', 'Klienci', 'Zakupy', 'Sprzedaż', 'Raporty', 'AI — Finanse', 'Budżet', 'Kadry', 'Czas pracy', 'Plan pracy', 'Płace']
  if (rola === 'kelner') return horeca ? ['Dashboard', 'Akceptacje', 'Rezerwacje', 'Stoły'] : ['Dashboard', 'Akceptacje', 'Klienci', 'Zamówienia']
  if (rola === 'kucharz') return horeca ? ['Dashboard', 'Akceptacje', 'Menu', 'Zamówienia'] : ['Dashboard', 'Akceptacje', 'Zamówienia', 'Zakupy']
  return ['Dashboard']
}
