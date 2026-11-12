// Branże, katalog modułów i zasady dostępu (wybór przy rejestracji i w /start).
import { WSZYSTKIE_MODULY } from './moduly'

export type BranzaSlug =
  | 'horeca' | 'inwestycyjna' | 'gazowa' | 'nieruchomosci' | 'transport' | 'logistyka' | 'kancelarie' | 'sekretariaty' | 'inna'

// Moduły tylko dla HoReCa: klient z innej branży nigdy ich nie zobaczy.
export const MODULY_HORECA_TYLKO = ['Rezerwacje', 'Stoły', 'Menu', 'POS', 'eService']
// Moduły systemowe: zawsze dostępne (niezależnie od wyboru branży i planu).
export const MODULY_SYSTEMOWE = ['Dashboard', 'Użytkownicy', 'Dane firmy']

export const MODULY_OPIS: Record<string, string> = {
  'Dashboard': 'Pulpit z kafelkami i wskaźnikami',
  'Akceptacje': 'Akceptacja zakupów i wydatków',
  'Rezerwacje': 'Kalendarz rezerwacji',
  'Stoły': 'Plan sali i statusy stolików',
  'Menu': 'Karta dań z alergenami',
  'CRM': 'Relacje z klientami i zadania',
  'Leady': 'Lejek sprzedaży i zapytania',
  'Klienci': 'Baza klientów i kontaktów',
  'Zamówienia': 'Zamówienia i statusy realizacji',
  'Zakupy': 'Zakupy i dostawcy',
  'Sprzedaż': 'Faktury i sprzedaż',
  'Raporty': 'Analityka i raporty',
  'AI — Finanse': 'Asystent AI do analiz',
  'Budżet': 'Plan i realizacja budżetu',
  'POS': 'Integracja z systemem kasowym',
  'eService': 'Terminale płatnicze',
  'Bank': 'Wyciągi bankowe',
  'Google Workspace': 'Gmail, Kalendarz, Zadania',
  'Kadry': 'Pracownicy i dokumenty',
  'Czas pracy': 'Ewidencja czasu pracy',
  'Plan pracy': 'Grafik pracowników',
  'Płace': 'Lista płac',
  'inFakt': 'Faktury inFakt',
  'Import danych': 'Import z Excela i CSV',
  'Archiwizacja': 'Kopie zapasowe danych',
  'Użytkownicy': 'Konta, role i uprawnienia',
  'Dane firmy': 'Ustawienia firmy',
}

type Branza = { slug: BranzaSlug; nazwa: string; ikona: string; opis: string; domyslne: string[]; darmowe: string[]; uwaga?: string }

export const BRANZE_ONB: Branza[] = [
  { slug: 'horeca', nazwa: 'HoReCa: restauracje, hotele, catering', ikona: '🍽️', opis: 'Rezerwacje, plan sali, menu, POS i bank.',
    domyslne: ['Rezerwacje', 'Stoły', 'Menu', 'CRM', 'Klienci', 'Zamówienia', 'Zakupy', 'Sprzedaż', 'Raporty', 'POS', 'eService', 'Bank', 'Plan pracy', 'Kadry'],
    darmowe: ['Rezerwacje', 'Stoły'] },
  { slug: 'inwestycyjna', nazwa: 'Budownictwo i inwestycje', ikona: '🏗️', opis: 'Klienci, zakupy, budżet, akceptacje i zespoły.',
    domyslne: ['CRM', 'Leady', 'Klienci', 'Zakupy', 'Akceptacje', 'Budżet', 'Czas pracy', 'Plan pracy', 'Raporty', 'Import danych'],
    darmowe: [], uwaga: 'Kosztorysowanie i etapy inwestycji dopasujemy na zamówienie.' },
  { slug: 'gazowa', nazwa: 'Branża gazowa i paliwowa', ikona: '🔥', opis: 'Klienci, sprzedaż, zakupy i raporty.',
    domyslne: ['CRM', 'Klienci', 'Sprzedaż', 'Zakupy', 'Zamówienia', 'Raporty', 'Import danych'],
    darmowe: [], uwaga: 'Cysterny, GPS i ewidencje dokumentów dopasujemy na zamówienie.' },
  { slug: 'nieruchomosci', nazwa: 'Nieruchomości', ikona: '🏢', opis: 'Lejek sprzedaży, klienci i kalendarz pokazów.',
    domyslne: ['CRM', 'Leady', 'Klienci', 'Google Workspace', 'inFakt', 'Raporty', 'Import danych'], darmowe: [] },
  { slug: 'transport', nazwa: 'Transport', ikona: '🚚', opis: 'Zlecenia, kierowcy, rozliczenia i koszty floty.',
    domyslne: ['Klienci', 'Zamówienia', 'Zakupy', 'Sprzedaż', 'Czas pracy', 'Plan pracy', 'Płace', 'Raporty', 'inFakt'], darmowe: [],
    uwaga: 'Mapę i śledzenie pojazdów dopasujemy na zamówienie.' },
  { slug: 'logistyka', nazwa: 'Logistyka i magazyny', ikona: '📦', opis: 'Zamówienia, dostawcy, zakupy i terminy.',
    domyslne: ['Klienci', 'Zamówienia', 'Zakupy', 'Akceptacje', 'Plan pracy', 'Raporty', 'Import danych', 'Archiwizacja'], darmowe: [] },
  { slug: 'kancelarie', nazwa: 'Kancelarie prawne i doradcze', ikona: '⚖️', opis: 'Klienci, czas pracy, terminy i rozliczenia.',
    domyslne: ['CRM', 'Klienci', 'Czas pracy', 'Google Workspace', 'inFakt', 'AI — Finanse'], darmowe: [],
    uwaga: 'Sprawy i terminy procesowe dopasujemy na zamówienie.' },
  { slug: 'sekretariaty', nazwa: 'Biura i sekretariaty', ikona: '🗂️', opis: 'Korespondencja, zadania i akceptacje.',
    domyslne: ['CRM', 'Klienci', 'Akceptacje', 'Zamówienia', 'Zakupy', 'Google Workspace', 'AI — Finanse', 'Import danych'], darmowe: [] },
  { slug: 'inna', nazwa: 'Inna branża', ikona: '✨', opis: 'Zestaw ogólny, resztę dopasujemy do Twoich procesów.',
    domyslne: ['CRM', 'Leady', 'Klienci', 'Zamówienia', 'Zakupy', 'Sprzedaż', 'Raporty', 'Import danych'], darmowe: [] },
]

export const BRANZE_SLUGI: string[] = BRANZE_ONB.map(b => b.slug)

// Moduły, które wolno wybrać w danej branży (wspólne + ewentualnie HoReCa); bez systemowych (te są zawsze).
export function modulyDlaBranzy(slug: string): string[] {
  const horeca = slug === 'horeca'
  return WSZYSTKIE_MODULY.filter(m => !MODULY_SYSTEMOWE.includes(m) && (horeca || !MODULY_HORECA_TYLKO.includes(m)))
}

// Moduły darmowej wersji podstawowej: rdzeń CRM + moduły startowe branży (np. rezerwacje dla HoReCa).
export const MODULY_DARMOWE_BAZA = ['CRM', 'Leady', 'Klienci']
export function modulyDarmowe(slug: string | null | undefined): string[] {
  const b = BRANZE_ONB.find(x => x.slug === slug)
  return [...MODULY_DARMOWE_BAZA, ...(b?.darmowe ?? [])]
}

// Ścieżka -> moduł (blokowanie dostępu w proxy).
export const SCIEZKA_MODUL: Record<string, string> = {
  '/dashboard': 'Dashboard', '/akceptacje': 'Akceptacje', '/rezerwacje': 'Rezerwacje', '/stoly': 'Stoły', '/menu': 'Menu',
  '/crm': 'CRM', '/leady': 'Leady', '/klienci': 'Klienci', '/zamowienia': 'Zamówienia', '/zakupy': 'Zakupy', '/sprzedaz': 'Sprzedaż',
  '/raporty': 'Raporty', '/ai': 'AI — Finanse', '/budzet': 'Budżet', '/pos': 'POS', '/eservice': 'eService', '/bank': 'Bank',
  '/google': 'Google Workspace', '/kadry': 'Kadry', '/czasPracy': 'Czas pracy', '/planpracy': 'Plan pracy', '/place': 'Płace',
  '/infakt': 'inFakt', '/import': 'Import danych', '/backup': 'Archiwizacja', '/uzytkownicy': 'Użytkownicy', '/ustawienia': 'Dane firmy',
}
