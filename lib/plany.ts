// Plany Skrojo: okres próbny (pełna wersja 7 dni) -> wersja podstawowa (0 zł) albo subskrypcja (od 29 zł / mies.)

export const TRIAL_DNI = 7
export const CENA_OD = '29 zł'

// Moduły wersji podstawowej (darmowej na zawsze). Pozostałe wymagają okresu próbnego lub subskrypcji.
export const MODULY_PODSTAWOWE = ['Dashboard', 'CRM', 'Leady', 'Klienci', 'Użytkownicy', 'Dane firmy']

// Ścieżki zablokowane w wersji podstawowej (to, co nie jest w MODULY_PODSTAWOWE).
export const SCIEZKI_PODSTAWOWE = ['/dashboard', '/crm', '/leady', '/klienci', '/uzytkownicy', '/ustawienia', '/subskrypcja']

export type FirmaPlan = {
  id: string
  nazwa: string
  demo: boolean
  status: 'trial' | 'podstawowy' | 'aktywny' | 'zalegla'
  trial_do: string
  stripe_status: string | null
  subskrypcja_do: string | null
  stripe_customer_id?: string | null
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

export function czySciezkaPodstawowa(path: string) {
  return SCIEZKI_PODSTAWOWE.some(p => path === p || path.startsWith(p + '/'))
}

export function dniTekst(n: number) {
  return n === 1 ? '1 dzień' : `${n} dni`
}
