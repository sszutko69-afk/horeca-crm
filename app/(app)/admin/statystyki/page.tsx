import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { czyWlasciciel } from '@/lib/wlasciciel'
import { BRANZE_ONB } from '@/lib/branze'
import { liczDostep, type FirmaPlan } from '@/lib/plany'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Statystyki platformy: Skrojo' }

const DZIEN = 86400000
const fmtData = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : '-')

function Karta({ t, v, p }: { t: string; v: string | number; p?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500">{t}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{v}</p>
      {p && <p className="text-xs text-gray-400 mt-0.5">{p}</p>}
    </div>
  )
}

export default async function StatystykiPlatformy() {
  // Dostęp tylko dla właściciela platformy (weryfikacja po stronie serwera)
  const sesja = await createServerSupabaseClient()
  const { data: { user } } = await sesja.auth.getUser()
  if (!czyWlasciciel(user)) notFound()

  const admin = createAdminClient()
  const teraz = Date.now()

  // wszystkie konta logowania (stronicowanie po 1000)
  const konta: { id: string; email?: string; created_at: string; email_confirmed_at?: string | null; last_sign_in_at?: string | null }[] = []
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    const u = data?.users ?? []
    konta.push(...u.map(x => ({ id: x.id, email: x.email, created_at: x.created_at, email_confirmed_at: x.email_confirmed_at, last_sign_in_at: x.last_sign_in_at })))
    if (u.length < 1000) break
  }
  const { data: firmyRaw } = await admin.from('firmy').select('id,nazwa,demo,status,trial_do,stripe_status,subskrypcja_do,branza,moduly,onboarding_zakonczony,created_at,zgoda_marketing')
  const { data: profile } = await admin.from('profiles').select('id,firma_id,rola')
  const firmy = (firmyRaw ?? []) as (FirmaPlan & { created_at: string; zgoda_marketing: boolean })[]
  const firmaPoId = new Map(firmy.map(f => [f.id, f]))
  const firmaKonta = new Map((profile ?? []).map(p => [p.id as string, p.firma_id as string]))

  // tylko klienci (bez firmy DEMO)
  const klienci = konta.filter(k => { const f = firmaPoId.get(firmaKonta.get(k.id) ?? ''); return f && !f.demo })
  const firmyKlientow = firmy.filter(f => !f.demo)
  const ile = (arr: { created_at: string }[], dni: number) => arr.filter(x => teraz - new Date(x.created_at).getTime() < dni * DZIEN).length
  const aktywowane = klienci.filter(k => k.email_confirmed_at).length
  const zalogowani = (dni: number) => klienci.filter(k => k.last_sign_in_at && teraz - new Date(k.last_sign_in_at).getTime() < dni * DZIEN).length

  // plany
  const plany = { trial: 0, podstawowa: 0, platna: 0, zaleglosc: 0 }
  firmyKlientow.forEach(f => {
    const d = liczDostep(f)
    if (d.powod === 'trial') plany.trial++
    else if (d.powod === 'subskrypcja') plany.platna++
    else if (d.powod === 'zaleglosc') plany.zaleglosc++
    else plany.podstawowa++
  })
  const bezWyboru = firmyKlientow.filter(f => !f.onboarding_zakonczony).length

  // branże
  const poBranzy = new Map<string, number>()
  firmyKlientow.forEach(f => poBranzy.set(f.branza ?? '', (poBranzy.get(f.branza ?? '') ?? 0) + 1))
  const branzeWiersze = Array.from(poBranzy.entries()).sort((a, b) => b[1] - a[1])
    .map(([slug, n]) => ({ nazwa: BRANZE_ONB.find(b => b.slug === slug)?.nazwa ?? '(nie wybrano)', n }))

  // rejestracje dzień po dniu (30 dni)
  const dni: { d: string; n: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(teraz - i * DZIEN).toISOString().slice(0, 10)
    dni.push({ d, n: firmyKlientow.filter(f => f.created_at.slice(0, 10) === d).length })
  }
  const maks = Math.max(1, ...dni.map(x => x.n))

  // ostatnie rejestracje
  const ostatnie = klienci.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20).map(k => {
    const f = firmaPoId.get(firmaKonta.get(k.id) ?? '')!
    const d = liczDostep(f)
    return { ...k, firma: f.nazwa, branza: BRANZE_ONB.find(b => b.slug === f.branza)?.nazwa ?? '(nie wybrano)', plan: d.powod, dni: d.dniDoKonca }
  })
  const etykietaPlanu: Record<string, string> = { trial: 'okres próbny', subskrypcja: 'płatny', podstawowa: 'podstawowy', zaleglosc: 'zaległość', demo: 'demo' }

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <h1 className="text-xl font-semibold text-gray-900">Statystyki platformy</h1>
      <p className="text-sm text-gray-500 mt-1">Widoczne tylko dla właściciela platformy. Dane klientów bez konta demo. Stan na {fmtData(new Date().toISOString())}.</p>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Karta t="Firmy klientów" v={firmyKlientow.length} p={`${klienci.length} kont użytkowników`} />
        <Karta t="Nowe: dziś / 7 dni / 30 dni" v={`${ile(firmyKlientow, 1)} / ${ile(firmyKlientow, 7)} / ${ile(firmyKlientow, 30)}`} />
        <Karta t="Aktywowane konta" v={`${aktywowane} z ${klienci.length}`} p={klienci.length ? `${Math.round((aktywowane / klienci.length) * 100)}% klika link z maila` : undefined} />
        <Karta t="Zalogowani: 7 dni / 30 dni" v={`${zalogowani(7)} / ${zalogowani(30)}`} p="wg ostatniego logowania" />
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Karta t="Okres próbny" v={plany.trial} />
        <Karta t="Wersja podstawowa" v={plany.podstawowa} />
        <Karta t="Płatna subskrypcja" v={plany.platna} />
        <Karta t="Zaległość w płatności" v={plany.zaleglosc} />
        <Karta t="Bez wyboru branży" v={bezWyboru} p="nie dokończyli /start" />
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="font-medium text-gray-900">Rejestracje firm: ostatnie 30 dni</p>
          <div className="mt-3 flex items-end gap-[3px] h-28">
            {dni.map(x => (
              <div key={x.d} title={`${x.d}: ${x.n}`} className="flex-1 bg-blue-500/80 rounded-t" style={{ height: `${Math.max(x.n ? 8 : 2, (x.n / maks) * 100)}%`, opacity: x.n ? 1 : 0.25 }} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>{dni[0].d}</span><span>{dni[dni.length - 1].d}</span></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="font-medium text-gray-900">Firmy wg branży</p>
          {branzeWiersze.length === 0 ? <p className="text-sm text-gray-400 mt-3">Brak danych.</p> : (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {branzeWiersze.map(b => (
                  <tr key={b.nazwa} className="border-t border-gray-100">
                    <td className="py-1.5 text-gray-700">{b.nazwa}</td>
                    <td className="py-1.5 text-right font-medium">{b.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
        <p className="font-medium text-gray-900">Ostatnie rejestracje</p>
        <table className="mt-2 w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1.5 font-medium">Zarejestrowano</th><th className="font-medium">E-mail</th><th className="font-medium">Firma</th>
              <th className="font-medium">Branża</th><th className="font-medium">Plan</th><th className="font-medium">Aktywacja</th><th className="font-medium">Ostatnie logowanie</th>
            </tr>
          </thead>
          <tbody>
            {ostatnie.length === 0 && <tr><td colSpan={7} className="py-4 text-gray-400">Brak rejestracji.</td></tr>}
            {ostatnie.map(k => (
              <tr key={k.id} className="border-t border-gray-100">
                <td className="py-1.5 whitespace-nowrap">{fmtData(k.created_at)}</td>
                <td>{k.email}</td>
                <td>{k.firma}</td>
                <td>{k.branza}</td>
                <td>{etykietaPlanu[k.plan]}{k.plan === 'trial' && k.dni ? ` (${k.dni} dni)` : ''}</td>
                <td>{k.email_confirmed_at ? 'tak' : 'nie'}</td>
                <td className="whitespace-nowrap">{fmtData(k.last_sign_in_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3">Uwaga: system zapisuje tylko ostatnie logowanie każdego użytkownika, a nie pełną historię logowań.</p>
    </div>
  )
}
