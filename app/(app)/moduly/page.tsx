'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { liczDostep, modulyFirmy, CENA_OD, type FirmaPlan } from '@/lib/plany'
import { MODULY_OPIS, modulyDlaBranzy, modulyDarmowe, modulyWkrotce, polecanyDlaBranzy, MODULY_SYSTEMOWE } from '@/lib/branze'

// Moduły systemu: lista wszystkich modułów branży z informacją, które są w pakiecie bezpłatnym, a które w subskrypcji.
// Administrator dodaje lub wyłącza moduły po rejestracji.
export default function ModulyPage() {
  const supabase = createClient()
  const [firma, setFirma] = useState<FirmaPlan | null>(null)
  const [admin, setAdmin] = useState(false)
  const [wybrane, setWybrane] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [podswietl, setPodswietl] = useState('')

  useEffect(() => {
    setPodswietl(new URLSearchParams(window.location.search).get('dodaj') ?? '')
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: p } = await supabase.from('profiles').select('rola').eq('id', user?.id ?? '').single()
      setAdmin(p?.rola === 'admin')
      const { data: f } = await supabase.from('firmy').select('id,nazwa,demo,status,trial_do,stripe_status,subskrypcja_do,pelny_dostep,branza,moduly,onboarding_zakonczony').maybeSingle()
      setFirma(f as FirmaPlan | null)
      const mod = ((f as FirmaPlan | null)?.moduly ?? []).filter(m => !MODULY_SYSTEMOWE.includes(m))
      const dodaj = new URLSearchParams(window.location.search).get('dodaj')
      setWybrane(dodaj && !mod.includes(dodaj) ? [...mod, dodaj] : mod)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const branza = firma?.branza ?? 'inna'
  const lista = useMemo(() => modulyDlaBranzy(branza), [branza])
  const darmowe = useMemo(() => modulyDarmowe(branza), [branza])
  const wkrotce = useMemo(() => modulyWkrotce(branza), [branza])
  const dostep = firma ? liczDostep(firma) : null
  const aktywne = useMemo(() => (firma ? modulyFirmy(firma) : []), [firma])

  async function zapisz() {
    setSaving(true); setMsg('')
    const r = await fetch('/api/firma/moduly', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ moduly: wybrane }) })
    const j = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) { setMsg(j.error ?? 'Nie udało się zapisać.'); return }
    setMsg('Zapisano. Odświeżam menu…')
    setTimeout(() => { window.location.href = '/moduly' }, 700)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Wczytywanie…</div>
  if (firma?.demo) return <div className="p-6 text-sm text-gray-600">Konto demonstracyjne ma stały zestaw modułów dla wybranej branży.</div>

  const platnePlan = dostep?.wersja !== 'pelna'
  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <h1 className="text-xl font-medium text-gray-900">Moduły systemu</h1>
      <p className="text-sm text-gray-500 mt-0.5">
        Dodaj moduły, których nie wybrano przy rejestracji. Moduły bezpłatne działają zawsze, pozostałe w ramach subskrypcji (od {CENA_OD} / mies.)
        {dostep?.powod === 'trial' && ' — w okresie próbnym masz dostęp do wszystkich wybranych modułów.'}
      </p>

      <p className="text-xs text-gray-500 mt-2">Wersja bezpłatna obejmuje do 3 użytkowników; w subskrypcji bez tego limitu.</p>

      {podswietl && !wybrane.includes(podswietl) ? null : podswietl && (
        <div className="mt-4 text-sm rounded-lg px-3 py-2" style={{ background: '#E8F5EE', color: '#14532d', border: '1px solid #BFE3CF' }}>
          Zaznaczono moduł „{podswietl}”. Zapisz zmiany, aby go uruchomić.
        </div>
      )}

      {dostep && (
        <div className="mt-4 text-sm rounded-lg px-3 py-2" style={dostep.wersja === 'pelna'
          ? { background: '#E8F5EE', color: '#14532d', border: '1px solid #BFE3CF' }
          : { background: '#FFF4E0', color: '#7a4a00', border: '1px solid #F5D9A6' }}>
          {dostep.wersja === 'pelna'
            ? <>Masz pełną wersję{dostep.powod === 'trial' ? ` (okres próbny: jeszcze ${dostep.dniDoKonca} dni)` : ''}. Wybrane moduły są aktywne i widoczne w menu.</>
            : <>Masz wersję podstawową (okres próbny zakończył się). Aktywne są tylko moduły bezpłatne. Wybrane moduły płatne są w menu z kłódką i uruchomią się po wykupieniu subskrypcji. <a href="/subskrypcja" style={{ color: '#7a4a00' }} className="underline font-medium">Wykup subskrypcję</a></>}
        </div>
      )}

      <div className="mt-5 bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {lista.map(m => {
          const free = darmowe.includes(m)
          const wl = free || wybrane.includes(m)
          return (
            <label key={m} className={`flex items-center gap-3 px-4 py-3 ${admin && !free ? 'cursor-pointer' : 'opacity-70'} ${m === podswietl ? 'bg-green-50' : ''}`}>
              <input type="checkbox" checked={wl} disabled={!admin || free}
                onChange={e => setWybrane(p => e.target.checked ? [...p, m] : p.filter(x => x !== m))} className="w-4 h-4" />
              <span className="flex-1">
                <span className="block text-sm font-medium text-gray-900">{m}{polecanyDlaBranzy(m, branza) && <span className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>polecany dla Twojej branży</span>}</span>
                <span className="block text-xs text-gray-500">{MODULY_OPIS[m] ?? ''}</span>
              </span>
              {firma?.moduly?.includes(m) && !free && (
                <span className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={aktywne.includes(m) ? { background: '#DCFCE7', color: '#166534' } : { background: '#FEF3C7', color: '#92400E' }}>
                  {aktywne.includes(m) ? 'w menu' : '🔒 wymaga subskrypcji'}
                </span>
              )}
              <span className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap"
                style={free ? { background: '#E8F5EE', color: '#14532d' } : { background: '#EEF2FF', color: '#3730a3' }}>
                {free ? 'Bezpłatny' : 'W subskrypcji'}
              </span>
            </label>
          )
        })}
      </div>

      {wkrotce.length > 0 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-900">W przygotowaniu dla Twojej branży</p>
          <p className="text-xs text-gray-500 mt-0.5">Te moduły przenosimy z naszego systemu branżowego; pojawią się tutaj do wyboru.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {wkrotce.map(m => <span key={m} className="text-xs px-2 py-1 rounded-full" style={{ background: '#F3F4F6', color: '#374151' }}>{m}</span>)}
          </div>
        </div>
      )}

      {platnePlan && (
        <p className="mt-3 text-xs text-amber-700">Masz wersję podstawową: moduły „W subskrypcji” zaznaczone poniżej uruchomią się po wykupieniu subskrypcji.</p>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        {admin
          ? <button onClick={zapisz} disabled={saving} style={{ background: '#2FB36D', color: '#FFFFFF' }} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{saving ? 'Zapisywanie…' : 'Zapisz moduły'}</button>
          : <span className="text-xs text-gray-500">Moduły zmienia administrator firmy.</span>}
        <a href="/subskrypcja" style={{ color: '#1D4ED8' }} className="text-sm underline">Plan i subskrypcja</a>
        <a href="mailto:skrojocrm@gmail.com?subject=Dopasowanie%20systemu%20Skrojo" style={{ color: '#1D4ED8' }} className="text-sm underline">Potrzebujesz innego modułu? Napisz do nas</a>
        {msg && <span className="text-sm text-gray-700">{msg}</span>}
      </div>
    </div>
  )
}
