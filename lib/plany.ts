// Plany Skrojo: okres próbny (pełna wersja 7 dni) -> wersja podstawowa (0 zł) albo subskrypcja (od 29 zł / mies.)
import { MODULY_SYSTEMOWE, SCIEZKA_MODUL, modulyDarmowe } from './branze'

export const TRIAL_DNI = 7
export const CENA_OD = '29 zł'

export type FirmaPlan = {
  id: string
  nazwa: string
  demo: boolean
  status: 'trial' | 'podstawowy' | 'aktywny' | 'zalegla'
  trial_do: string
  stripe_status: string | null
  subskrypcja_do: string | null
  stripe_customer_id?: string | null
  branza?: string | null
  moduly?: string[] | null            // moduły wybrane przez firmę (sufit dostępu)
  onboarding_zakonczony?: boolean
}

export type Dostep = {
  wersja: 'pelna' | 'podstawowa'
  powod: 'demo' | 'subskrypcja' | 'trial' | 'podstawowa' | 'zaleglosc'
  dniDoKonca: number | null     // dla okresu próbnego
}

export function liczDostep(f: FirmaPlan | null | undefined, teraz = new Date()): Dostep {
  if (!f) return { wersja: 'podstawowa', powod: 'podstawowa', dniDoKonca: null }
  if (f.demo) return { wersja: 'pelna', powod: 'demo', dniDoKonca: null }
  const stripeOk = f.stripe_status === 'active' || f.stripe_status === 'trialing'
  const oplacone = f.subskrypcja_do ? new Date(f.subskrypcja_do) > teraz : false
  if (stripeOk || (f.status === 'aktywny' && oplacone)) return { wersja: 'pelna', powod: 'subskrypcja', dniDoKonca: null }
  const trialDo = new Date(f.trial_do)
  if (f.status === 'trial' && trialDo > teraz) {
    return { wersja: 'pelna', powod: 'trial', dniDoKonca: Math.max(1, Math.ceil((trialDo.getTime() - teraz.getTime()) / 86400000)) }
  }
  if (f.stripe_status === 'past_due' || f.status === 'zalegla') return { wersja: 'podstawowa', powod: 'zaleglosc', dniDoKonca: null }
  return { wersja: 'podstawowa', powod: 'podstawowa', dniDoKonca: null }
}

// Moduły dostępne dla firmy: wybrane przez nią (pełna wersja) albo tylko darmowe z wybranych (wersja podstawowa).
// Firma bez ukończonego wyboru (moduly = null) ma tylko moduły systemowe. Firma DEMO widzi wszystko.
export function modulyFirmy(f: FirmaPlan | null | undefined, teraz = new Date()): string[] {
  if (!f) return [...MODULY_SYSTEMOWE]
  if (f.demo) return f.moduly && f.moduly.length ? f.moduly : Object.values(SCIEZKA_MODUL)
  const d = liczDostep(f, teraz)
  const wybrane = f.moduly ?? []
  const baza = d.wersja === 'pelna' ? wybrane : wybrane.filter(m => modulyDarmowe(f.branza).includes(m))
  return Array.from(new Set([...MODULY_SYSTEMOWE, ...baza]))
}

const NIEDOSTEPNE = /^\/(mapa|cysterna|przetargi|kosztorysowanie|inwestycje|emcs|edd|gps)(\/|$)/

// Czy ścieżka jest dozwolona: null = tak, albo powód blokady
//  'plan' = moduł wybrany, ale wymaga pełnej wersji; 'wybor' = moduł spoza wyboru firmy; 'niedostepny' = pozostałość innych wersji systemu.
export function blokadaSciezki(path: string, f: FirmaPlan | null | undefined): 'wybor' | 'plan' | 'niedostepny' | null {
  if (path === '/start' || path === '/subskrypcja' || path.startsWith('/subskrypcja/')) return null
  const klucz = Object.keys(SCIEZKA_MODUL).find(k => path === k || path.startsWith(k + '/'))
  if (!klucz) return NIEDOSTEPNE.test(path) && !f?.demo ? 'niedostepny' : null
  const modul = SCIEZKA_MODUL[klucz]
  if (modulyFirmy(f).includes(modul)) return null
  return (f?.moduly ?? []).includes(modul) ? 'plan' : 'wybor'
}

export function dniTekst(n: number) {
  return n === 1 ? '1 dzień' : `${n} dni`
}
