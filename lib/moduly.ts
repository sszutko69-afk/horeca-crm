// Moduły muszą odpowiadać polu `modul` w nawigacji components/AppShell.tsx
export const MODULY_GRUPY: { grupa: string; moduly: string[] }[] = [
  { grupa: 'Główne', moduly: ['Dashboard', 'Akceptacje'] },
  { grupa: 'Restauracja', moduly: ['Rezerwacje', 'Stoły', 'Menu'] },
  { grupa: 'Sprzedaż & Zakupy', moduly: ['CRM', 'Leady', 'Klienci', 'Zamówienia', 'Zakupy', 'Sprzedaż'] },
  { grupa: 'Analityka', moduly: ['Raporty', 'AI — Finanse', 'Budżet'] },
  { grupa: 'Integracje', moduly: ['POS', 'eService', 'Bank', 'Google Workspace'] },
  { grupa: 'Kadry', moduly: ['Kadry', 'Czas pracy', 'Plan pracy', 'Płace'] },
  { grupa: 'System', moduly: ['inFakt', 'Import danych', 'Archiwizacja', 'Użytkownicy', 'Dane firmy'] },
]

export const WSZYSTKIE_MODULY = MODULY_GRUPY.flatMap(g => g.moduly)

export type Rola = 'admin' | 'menedzer' | 'kelner' | 'kucharz'

export const ROLE: Rola[] = ['admin', 'menedzer', 'kelner', 'kucharz']

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  menedzer: 'Menedżer',
  kelner: 'Kelner / obsługa sali',
  kucharz: 'Kucharz / kuchnia',
}

export const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-red-50 text-red-700',
  menedzer: 'bg-blue-50 text-blue-700',
  kelner: 'bg-green-50 text-green-700',
  kucharz: 'bg-yellow-50 text-yellow-700',
}

export const ROLE_DOMYSLNE: Record<string, string[]> = {
  admin: WSZYSTKIE_MODULY,
  menedzer: ['Dashboard', 'Akceptacje', 'Rezerwacje', 'Stoły', 'Menu', 'CRM', 'Leady', 'Zamówienia', 'Klienci', 'Zakupy', 'Sprzedaż', 'Raporty', 'AI — Finanse', 'Budżet', 'POS', 'eService', 'Kadry', 'Czas pracy', 'Plan pracy', 'Płace'],
  kelner: ['Dashboard', 'Akceptacje', 'Rezerwacje', 'Stoły'],
  kucharz: ['Dashboard', 'Akceptacje', 'Menu', 'Zamówienia'],
}
