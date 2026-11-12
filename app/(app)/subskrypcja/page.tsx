'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { liczDostep, dniTekst, CENA_OD, type FirmaPlan } from '@/lib/plany'
import { modulyDarmowe, MODULY_SYSTEMOWE, BRANZE_ONB } from '@/lib/branze'

const KONTAKT = 'skrojocrm@gmail.com'

export default function SubskrypcjaPage() {
  const supabase = createClient()
  const [firma, setFirma] = useState<FirmaPlan | null>(null)
  const [rola, setRola] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [potw, setPotw] = useState('')
  const [pokazUsun, setPokazUsun] = useState(false)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('ok')) setInfo('Dziękujemy! Płatność została przyjęta. Pełna wersja uaktywni się w ciągu chwili (odśwież stronę, jeśli plan się nie zmienił).')
    if (q.get('anulowano')) setInfo('Płatność została anulowana. Nic nie pobrano.')
    if (q.get('zablokowane')) setErr('Ten moduł jest dostępny w pełnej wersji. Wykup subskrypcję lub skontaktuj się z zespołem SKROJO.')
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from('profiles').select('rola').eq('id', user.id).single()
        setRola(p?.rola ?? '')
      }
      const { data } = await supabase.from('firmy').select('id,nazwa,demo,status,trial_do,stripe_status,subskrypcja_do,stripe_customer_id,branza,moduly,onboarding_zakonczony').maybeSingle()
      setFirma(data as FirmaPlan | null)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function post(url: string, body?: object) {
    setBusy(true); setErr('')
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
      const j = await r.json()
      if (!r.ok) { setErr(j.error ?? 'Wystąpił błąd.'); return null }
      return j
    } catch { setErr('Brak połączenia z serwerem.'); return null } finally { setBusy(false) }
  }
  async function wykup() { const j = await post('/api/stripe/checkout'); if (j?.url) window.location.href = j.url }
  async function panel() { const j = await post('/api/stripe/portal'); if (j?.url) window.location.href = j.url }
  async function usun() {
    const j = await post('/api/konto/usun', { potwierdzenie: potw })
    if (j?.ok) { await supabase.auth.signOut(); window.location.href = '/login' }
  }

  const d = liczDostep(firma)
  const admin = rola === 'admin'
  const pelna = d.wersja === 'pelna'
  const platna = d.powod === 'subskrypcja'

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">Subskrypcja i płatności</h1>

      {info && <p className="mt-4 text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{info}</p>}
      {err && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>}

      <div className="mt-5 bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs uppercase tracking-wide text-gray-400">Twój plan</p>
        <p className="text-lg font-medium text-gray-900 mt-1">
          {d.powod === 'demo' && 'Konto demonstracyjne (pełna wersja)'}
          {d.powod === 'trial' && `Pełna wersja: okres próbny (jeszcze ${dniTekst(d.dniDoKonca ?? 1)})`}
          {d.powod === 'subskrypcja' && 'Pełna wersja: subskrypcja aktywna'}
          {d.powod === 'podstawowa' && 'Wersja podstawowa (0 zł, bez limitu czasu)'}
          {d.powod === 'zaleglosc' && 'Wersja podstawowa: płatność nie powiodła się'}
        </p>
        {d.powod === 'trial' && (
          <p className="text-sm text-gray-600 mt-2">Korzystasz z pełnej wersji systemu. Za {dniTekst(d.dniDoKonca ?? 1)} system przejdzie do wersji podstawowej. Wykup subskrypcję lub skontaktuj się z zespołem SKROJO w celu dopasowania systemu do Twoich potrzeb.</p>
        )}
        {platna && firma?.subskrypcja_do && (
          <p className="text-sm text-gray-600 mt-2">Opłacone do {new Date(firma.subskrypcja_do).toLocaleDateString('pl-PL')}. Odnowienie następuje automatycznie.</p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {admin && !platna && d.powod !== 'demo' && (
            <button onClick={wykup} disabled={busy} style={{ background: '#2FB36D', color: '#FFFFFF' }} className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60">
              Wykup subskrypcję od {CENA_OD} / mies.
            </button>
          )}
          {admin && (platna || firma?.stripe_customer_id) && (
            <button onClick={panel} disabled={busy} className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
              Faktury, karta, anulowanie
            </button>
          )}
          <a href={`mailto:${KONTAKT}?subject=Dopasowanie%20systemu%20Skrojo`} className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            Skontaktuj się z zespołem SKROJO
          </a>
        </div>
        {!admin && <p className="text-xs text-gray-400 mt-3">Subskrypcją zarządza administrator firmy.</p>}
        <p className="text-xs text-gray-400 mt-3">Płatność obsługuje Stripe (karta, BLIK). Skrojo nie widzi ani nie przechowuje danych Twojej karty.</p>
      </div>

      {(() => {
        const wybrane = (firma?.moduly ?? []).filter(m => !MODULY_SYSTEMOWE.includes(m))
        const free = modulyDarmowe(firma?.branza)
        const wFree = wybrane.filter(m => free.includes(m))
        const wPlatne = wybrane.filter(m => !free.includes(m))
        const branzaNazwa = BRANZE_ONB.find(b => b.slug === firma?.branza)?.nazwa
        return (
          <div className="mt-5 bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-gray-900">Twoje moduły{branzaNazwa ? `: ${branzaNazwa}` : ''}</p>
                <p className="text-xs text-gray-500 mt-0.5">Zestaw dobrany do Twojej branży. Możesz go zmienić w każdej chwili.</p>
              </div>
              {admin && d.powod !== 'demo' && <a href="/start" className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">Zmień branżę i moduły</a>}
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-green-200 bg-green-50/40 p-4">
                <p className="text-sm font-medium text-gray-900">Wersja podstawowa · 0 zł na zawsze</p>
                <ul className="mt-2 text-sm text-gray-700 space-y-1 list-disc pl-5">
                  {[...MODULY_SYSTEMOWE, ...wFree].map(m => <li key={m}>{m}</li>)}
                </ul>
              </div>
              <div className={`rounded-lg border p-4 ${pelna ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200'}`}>
                <p className="text-sm font-medium text-gray-900">Pełna wersja · od {CENA_OD} / mies.</p>
                <ul className="mt-2 text-sm text-gray-700 space-y-1 list-disc pl-5">
                  {wPlatne.length ? wPlatne.map(m => <li key={m}>{m}</li>) : <li>Wszystkie wybrane moduły są w wersji podstawowej</li>}
                </ul>
              </div>
            </div>
          </div>
        )
      })()}

      {admin && d.powod !== 'demo' && (
        <div className="mt-8 bg-white border border-gray-200 rounded-xl p-5">
          <p className="font-medium text-gray-900">Twoje dane (RODO)</p>
          <p className="text-sm text-gray-600 mt-1">Możesz pobrać wszystkie dane firmy albo trwale usunąć konto wraz z danymi.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a href="/api/konto/eksport" className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Pobierz moje dane (JSON)</a>
            <button onClick={() => setPokazUsun(v => !v)} className="border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50">Usuń konto i dane</button>
          </div>
          {pokazUsun && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-700">Operacja jest nieodwracalna: usuwa wszystkie dane i konta użytkowników firmy oraz anuluje subskrypcję. Wpisz nazwę firmy (<b>{firma?.nazwa}</b>), aby potwierdzić.</p>
              <div className="mt-2 flex gap-2">
                <input value={potw} onChange={e => setPotw(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1" />
                <button onClick={usun} disabled={busy || potw.trim() !== firma?.nazwa.trim()} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40">Usuń na stałe</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
