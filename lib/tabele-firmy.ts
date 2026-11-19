// Tabele z danymi firmy (mają kolumnę firma_id i politykę RLS). Używane do eksportu danych (RODO: prawo do przenoszenia).
export const TABELE_FIRMY = [
  'akceptacje_konfiguracja', 'budzet_kategorie', 'budzet_plan', 'budzet_realizacja',
  'crm_aktywnosci', 'crm_lead_dokumenty', 'crm_lead_historia', 'crm_leady', 'crm_produkty', 'crm_zadania',
  'czas_pracy', 'firma_dane', 'firma_dokumenty', 'klienci', 'komentarze', 'kontakty', 'listy_obecnosci',
  'place', 'place_parametry', 'plan_pracy', 'powiadomienia', 'pracownicy', 'sprzedaz',
  'wydarzenia', 'zakupy', 'zamowienia', 'rezerwacje', 'stoly', 'menu_pozycje',
  'pojazdy', 'bazy_trasy', 'dostawy', 'gps_pozycje', 'edd_ewidencja',
  'przetargi', 'przetargi_branze', 'przetargi_pracownicy',
  'kosztorysy', 'kosztorysy_pozycje', 'knr_katalogi', 'knr_pozycje', 'cenniki', 'cenniki_pozycje',
  'inwestycje', 'inwestycje_etapy', 'inwestycje_koszty', 'etapy_pracownicy',
] as const
