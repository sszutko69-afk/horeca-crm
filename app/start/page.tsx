'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { BRANZE_ONB, MODULY_OPIS, modulyDlaBranzy, modulyDarmowe, MODULY_SYSTEMOWE } from '@/lib/branze'
import { TRIAL_DNI, CENA_OD, liczDostep, type FirmaPlan } from '@/lib/plany'

// Pierwsze uruchomienie: wybór branży i modułów. Od wyboru zależy, jakie środowisko dostaje klient
// (np. firma budowlana nigdy nie zobaczy stolików i menu restauracji).
export default function StartPage() {
  const supabase = createClient()
  const [firma, setFirma] = useState<FirmaPlan | null>(null)
  const [rola, setRola] = useState('')
  const [branza, setBranza] = useState('')
  const [wybrane, setWybrane] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data: p } = await supabase.from('profiles').select('rola').eq('id', user.id).single()
      setRola(p?.rola ?? '')
      const { data: f } = await supabase.from('firmy')
        .select('id,nazwa,demo,status,trial_do,stripe_status,subskrypcja_do,branza,moduly,onboarding_zakonczony').maybeSingle()
      const ff = f as FirmaPlan | null
      setFirma(ff)
      if (ff?.branza) {
        setBranza(ff.branza)
        const dom = BRANZE_ONB.find(b => b.slug === ff.branza)?.domyslne ?? []
        setWybrane(ff.moduly && ff.onboarding_zakonczony ? ff.moduly.filter(m => !MODULY_SYSTEMOWE.includes(m)) : dom)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function wybierzBranze(slug: string) {
    setBranza(slug)
    setWybrane(BRANZE_ONB.find(b => b.slug === slug)?.domyslne ?? [])
  }
  function przelacz(m: string) {
    setWybrane(w => (w.includes(m) ? w.filter(x => x !== m) : [...w, m]))
  }

  const info = BRANZE_ONB.find(b => b.slug === branza)
  const dostepne = useMemo(() => (branza ? modulyDlaBranzy(branza) : []), [branza])
  const darmowe = modulyDarmowe(branza)
  const dostep = liczDostep(firma)
  const zmiana = !!firma?.onboarding_zakonczony

  async function zapisz() {
    setBusy(true); setErr('')
    const r = await fetch('/api/firma/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branza, moduly: wybrane }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(j.error ?? 'Nie udało się zapisać.'); return }
    window.location.href = '/dashboard?witaj=1'
  }

  if (rola && rola !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md text-center">
          <p className="font-medium text-gray-900">Konfigurację systemu ustawia administrator firmy.</p>
          <p className="text-sm text-gray-500 mt-2">Poproś go o dokończenie wyboru branży i modułów, potem odśwież stronę.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900">{zmiana ? 'Zmień branżę i moduły' : 'Dopasujmy system do Twojej firmy'}</h1>
        <p className="text-sm text-gray-600 mt-1">
          {zmiana
            ? 'Zmiany obowiązują od razu. Dane, które już wprowadziłeś, zostają.'
            : `Wybierz branżę i moduły. Przez ${TRIAL_DNI} dni korzystasz z pełnej wersji wybranych modułów. Potem zostają darmowe moduły, a resztę uruchomisz subskrypcją od ${CENA_OD} / mies.`}
        </p>

        <h2 className="mt-6 text-sm font-semibold text-gray-700 uppercase tracking-wide">1. Twoja branża</h2>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {BRANZE_ONB.map(b => (
            <button key={b.slug} type="button" onClick={() => wybierzBranze(b.slug)}
              className={`text-left bg-white border rounded-xl p-4 hover:border-blue-400 transition ${branza === b.slug ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-200'}`}>
              <div className="text-2xl">{b.ikona}</div>
              <div className="font-medium text-gray-900 mt-1 text-sm">{b.nazwa}</div>
              <div className="text-xs text-gray-500 mt-1">{b.opis}</div>
            </button>
          ))}
        </div>

        {branza && (
          <>
            <h2 className="mt-8 text-sm font-semibold text-gray-700 uppercase tracking-wide">2. Moduły</h2>
            <p className="text-xs text-gray-500 mt-1">Zaznaczyliśmy zestaw polecany dla tej branży. Możesz go dowolnie zmienić.</p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dostepne.map(m => {
                const on = wybrane.includes(m)
                const free = darmowe.includes(m)
                return (
                  <label key={m} className={`flex items-start gap-3 bg-white border rounded-lg px-3 py-2.5 cursor-pointer ${on ? 'border-blue-500' : 'border-gray-200'}`}>
                    <input type="checkbox" checked={on} onChange={() => przelacz(m)} className="mt-1" />
                    <span className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{m}</span>
                      <span className="block text-xs text-gray-500">{MODULY_OPIS[m]}</span>
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${free ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {free ? 'zawsze za 0 zł' : 'pełna wersja'}
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">Zawsze w zestawie: {MODULY_SYSTEMOWE.join(', ')}.</p>
            {info?.uwaga && (
              <p className="mt-3 text-sm text-blue-900 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                {info.uwaga} Napisz do nas: <a className="underline" href="mailto:skrojocrm@gmail.com?subject=Dopasowanie%20systemu%20Skrojo">skrojocrm@gmail.com</a>.
              </p>
            )}
          </>
        )}

        {err && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>}

        <div className="mt-6 flex items-center gap-3">
          <button onClick={zapisz} disabled={busy || !branza || wybrane.length === 0}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
            {busy ? 'Zapisywanie…' : zmiana ? 'Zapisz zmiany' : 'Uruchom system'}
          </button>
          {zmiana && <a href="/subskrypcja" className="text-sm text-gray-500 hover:underline">Anuluj</a>}
          {!zmiana && dostep.powod === 'trial' && <span className="text-xs text-gray-400">Pełna wersja uruchomi się od razu, bez podawania karty.</span>}
        </div>
      </div>
    </div>
  )
}
