'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════════════════
// AKCEPTACJE
// Pozycje wprowadzone przez pracowników czekają tu na decyzję. Dopóki nie są
// zaakceptowane, nie wchodzą do list, kosztów ani raportów.
// Konfiguracja modułów i ról siedzi w tabeli akceptacje_konfiguracja.
// ═══════════════════════════════════════════════════════════════════════════

type Modul = {
  modul: string
  etykieta: string
  tabela: string
  wymaga_akceptacji: boolean
  role_akceptujace: string[]
  link: string | null
}

type Pozycja = {
  modul: string
  etykieta: string
  id: string
  opis: string
  szczegol: string
  stan: string
  uwagi: string | null
  zglosil: string | null
  kiedy: string | null
  link: string | null
}

type Powiadomienie = {
  id: string
  typ: string
  tytul: string
  tresc: string | null
  link: string | null
  przeczytane: boolean
  created_at: string
}

const STANY: Record<string, { label: string; cls: string }> = {
  oczekuje:      { label: 'Czeka na decyzję', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  zaakceptowany: { label: 'Zaakceptowana',    cls: 'bg-green-50 text-green-700 border-green-200' },
  odrzucony:     { label: 'Odrzucona',        cls: 'bg-red-50 text-red-700 border-red-200' },
  do_poprawy:    { label: 'Do poprawy',       cls: 'bg-orange-50 text-orange-800 border-orange-200' },
}

function fmtData(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AkceptacjePage() {
  const supabase = createClient()

  const [userId, setUserId]   = useState<string | null>(null)
  const [rola, setRola]       = useState<string>('')
  const [moduly, setModuly]   = useState<Modul[]>([])
  const [doDecyzji, setDoDecyzji] = useState<Pozycja[]>([])
  const [moje, setMoje]       = useState<Pozycja[]>([])
  const [powiad, setPowiad]   = useState<Powiadomienie[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'kolejka' | 'moje' | 'powiadomienia'>('kolejka')
  const [info, setInfo]       = useState('')

  // Okno decyzji odmownej
  const [decyzjaDla, setDecyzjaDla] = useState<{ poz: Pozycja; typ: 'odrzucony' | 'do_poprawy' } | null>(null)
  const [komentarz, setKomentarz]   = useState('')
  const [zapisuje, setZapisuje]     = useState(false)

  const pokazInfo = (t: string) => { setInfo(t); setTimeout(() => setInfo(''), 4000) }

  // ── Pobranie pozycji z jednej tabeli i sprowadzenie do wspólnego kształtu ──
  const pobierzZTabeli = useCallback(async (m: Modul, tylkoMoje: boolean, uid: string) => {
    const select =
      m.tabela === 'czas_pracy' ? 'id,data,godziny,rodzaj,opis,stan_akceptacji,akceptacja_uwagi,zglosil_id,created_at,pracownicy(imie,nazwisko)'
      : m.tabela === 'wydarzenia' ? 'id,nazwa,typ,miejsce,budzet,stan_akceptacji,akceptacja_uwagi,zglosil_id,created_at'
      :                             'id,klient_nazwa,produkt,ilosc,jednostka,status,stan_akceptacji,akceptacja_uwagi,zglosil_id,created_at'

    // Nazwa tabeli jest tu zmienną, a nie literałem, więc typy generowane przez
    // Supabase rozwijają się w unię wszystkich tabel i TypeScript to odrzuca.
    // Luźny typ tylko na to jedno zapytanie — kształt wyniku mapujemy niżej ręcznie.
    const sb: any = supabase
    let q = sb.from(m.tabela).select(select).order('created_at', { ascending: false }).limit(200)
    q = tylkoMoje ? q.eq('zglosil_id', uid).neq('stan_akceptacji', 'zaakceptowany')
                  : q.eq('stan_akceptacji', 'oczekuje')

    const { data, error } = await q
    if (error || !data) return [] as Pozycja[]

    return (data as any[]).map(r => {
      let opis = '', szczegol = ''
      if (m.tabela === 'czas_pracy') {
        const prac = r.pracownicy ? `${r.pracownicy.imie ?? ''} ${r.pracownicy.nazwisko ?? ''}`.trim() : ''
        opis = `${fmtData(r.data)} — ${r.godziny ?? '?'} h`
        szczegol = [prac, r.rodzaj, r.opis].filter(Boolean).join(' · ')
      } else if (m.tabela === 'wydarzenia') {
        opis = r.nazwa ?? 'Wydarzenie'
        szczegol = [r.typ, r.miejsce, r.budzet ? `budżet ${Number(r.budzet).toLocaleString('pl-PL')} zł` : null]
          .filter(Boolean).join(' · ')
      } else {
        opis = `Zamówienie — ${r.klient_nazwa ?? '—'}`
        szczegol = [r.produkt, r.ilosc ? `${r.ilosc} ${r.jednostka ?? ''}`.trim() : null, r.status].filter(Boolean).join(' · ')
      }
      return {
        modul: m.modul, etykieta: m.etykieta, id: r.id, opis, szczegol,
        stan: r.stan_akceptacji, uwagi: r.akceptacja_uwagi,
        zglosil: r.zglosil_id, kiedy: r.created_at, link: m.link,
      } as Pozycja
    })
  }, [supabase])

  const zaladuj = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const [{ data: prof }, { data: konf }] = await Promise.all([
      supabase.from('profiles').select('rola').eq('id', user.id).maybeSingle(),
      supabase.from('akceptacje_konfiguracja').select('*').eq('wymaga_akceptacji', true),
    ])

    const mojaRola = (prof?.rola as string) ?? ''
    setRola(mojaRola)
    const wszystkie = (konf ?? []) as Modul[]
    setModuly(wszystkie)

    const mogeAkceptowac = wszystkie.filter(m => (m.role_akceptujace ?? []).includes(mojaRola))

    const [kolejki, mojeZgl, { data: pow }] = await Promise.all([
      Promise.all(mogeAkceptowac.map(m => pobierzZTabeli(m, false, user.id))),
      Promise.all(wszystkie.map(m => pobierzZTabeli(m, true, user.id))),
      supabase.from('powiadomienia').select('*').order('created_at', { ascending: false }).limit(50),
    ])

    setDoDecyzji(kolejki.flat())
    setMoje(mojeZgl.flat())
    setPowiad((pow ?? []) as Powiadomienie[])
    setLoading(false)
  }, [supabase, pobierzZTabeli])

  useEffect(() => { zaladuj() }, [zaladuj])

  // ── Decyzje ───────────────────────────────────────────────────────────────
  async function zaakceptuj(p: Pozycja) {
    setZapisuje(true)
    const { error } = await supabase.rpc('akc_decyzja', {
      p_modul: p.modul, p_rekord_id: p.id, p_decyzja: 'zaakceptowany', p_komentarz: null,
    })
    setZapisuje(false)
    if (error) { pokazInfo('⚠ ' + error.message); return }
    setDoDecyzji(prev => prev.filter(x => !(x.id === p.id && x.modul === p.modul)))
    pokazInfo(`Zaakceptowano: ${p.opis}`)
    zaladuj()
  }

  async function zapiszDecyzjeOdmowna() {
    if (!decyzjaDla) return
    if (!komentarz.trim()) { pokazInfo('⚠ Napisz, co jest do poprawy'); return }
    setZapisuje(true)
    const { error } = await supabase.rpc('akc_decyzja', {
      p_modul: decyzjaDla.poz.modul, p_rekord_id: decyzjaDla.poz.id,
      p_decyzja: decyzjaDla.typ, p_komentarz: komentarz.trim(),
    })
    setZapisuje(false)
    if (error) { pokazInfo('⚠ ' + error.message); return }
    setDoDecyzji(prev => prev.filter(x => !(x.id === decyzjaDla.poz.id && x.modul === decyzjaDla.poz.modul)))
    setDecyzjaDla(null); setKomentarz('')
    pokazInfo(decyzjaDla.typ === 'odrzucony' ? 'Odrzucono i powiadomiono pracownika.' : 'Odesłano do poprawy.')
    zaladuj()
  }

  async function oznaczPrzeczytane(id: string) {
    await supabase.from('powiadomienia').update({ przeczytane: true }).eq('id', id)
    setPowiad(prev => prev.map(p => p.id === id ? { ...p, przeczytane: true } : p))
  }

  async function oznaczWszystkie() {
    const ids = powiad.filter(p => !p.przeczytane).map(p => p.id)
    if (!ids.length) return
    await supabase.from('powiadomienia').update({ przeczytane: true }).in('id', ids)
    setPowiad(prev => prev.map(p => ({ ...p, przeczytane: true })))
  }

  const nieprzeczytane = powiad.filter(p => !p.przeczytane).length
  const wgModulu = doDecyzji.reduce((acc, p) => {
    acc[p.etykieta] = (acc[p.etykieta] ?? 0) + 1; return acc
  }, {} as Record<string, number>)

  const TABS = [
    { key: 'kolejka',       label: `Do akceptacji (${doDecyzji.length})` },
    { key: 'moje',          label: `Moje zgłoszenia (${moje.length})` },
    { key: 'powiadomienia', label: `Powiadomienia${nieprzeczytane ? ` (${nieprzeczytane})` : ''}` },
  ]

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-14 z-10">
        <h1 className="text-xl font-medium text-gray-900">Akceptacje</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {doDecyzji.length === 0
            ? 'Nic nie czeka na Twoją decyzję.'
            : Object.entries(wgModulu).map(([k, v]) => `${k}: ${v}`).join(' · ')}
        </p>
        {info && (
          <p className={`mt-2 text-xs px-3 py-1.5 rounded-lg inline-block ${
            info.startsWith('⚠') ? 'text-red-700 bg-red-50 border border-red-200'
                                 : 'text-green-700 bg-green-50 border border-green-200'}`}>
            {info}
          </p>
        )}
      </div>

      <div className="px-6 pt-4">
        <div className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key ? 'border-gray-900 text-gray-900'
                              : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-10">

        {loading && <p className="text-center text-gray-400 py-12">Ładowanie...</p>}

        {/* ── KOLEJKA DO DECYZJI ── */}
        {!loading && tab === 'kolejka' && (
          doDecyzji.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
              <p className="text-gray-500">Wszystko rozpatrzone.</p>
              <p className="text-sm text-gray-400 mt-1">
                {moduly.filter(m => (m.role_akceptujace ?? []).includes(rola)).map(m => m.etykieta).join(', ') || 'Brak modułów przypisanych do Twojej roli.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {doDecyzji.map(p => (
                <div key={`${p.modul}-${p.id}`} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{p.etykieta}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STANY[p.stan]?.cls ?? ''}`}>
                          {STANY[p.stan]?.label ?? p.stan}
                        </span>
                      </div>
                      <p className="mt-2 text-base font-medium text-gray-900">{p.opis}</p>
                      {p.szczegol && <p className="text-sm text-gray-500 mt-0.5">{p.szczegol}</p>}
                      <p className="text-xs text-gray-400 mt-2">Wprowadzono {fmtData(p.kiedy)}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {p.link && (
                        <a href={p.link} className="text-xs text-gray-500 hover:text-gray-800 underline px-2">
                          Otwórz moduł
                        </a>
                      )}
                      <button onClick={() => { setDecyzjaDla({ poz: p, typ: 'do_poprawy' }); setKomentarz('') }}
                        className="text-sm border border-orange-200 text-orange-800 bg-orange-50 px-3 py-2 rounded-lg hover:bg-orange-100">
                        Do poprawy
                      </button>
                      <button onClick={() => { setDecyzjaDla({ poz: p, typ: 'odrzucony' }); setKomentarz('') }}
                        className="text-sm border border-red-200 text-red-700 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100">
                        Odrzuć
                      </button>
                      <button onClick={() => zaakceptuj(p)} disabled={zapisuje}
                        className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                        Zaakceptuj
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── MOJE ZGŁOSZENIA ── */}
        {!loading && tab === 'moje' && (
          moje.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
              <p className="text-gray-500">Nie masz pozycji czekających na decyzję.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {moje.map(p => (
                <div key={`m-${p.modul}-${p.id}`} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{p.etykieta}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STANY[p.stan]?.cls ?? ''}`}>
                      {STANY[p.stan]?.label ?? p.stan}
                    </span>
                  </div>
                  <p className="mt-2 text-base font-medium text-gray-900">{p.opis}</p>
                  {p.szczegol && <p className="text-sm text-gray-500 mt-0.5">{p.szczegol}</p>}
                  {p.uwagi && (
                    <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-orange-900">Uwagi do poprawy</p>
                      <p className="text-sm text-orange-900 mt-0.5">{p.uwagi}</p>
                    </div>
                  )}
                  {p.link && (
                    <a href={p.link} className="inline-block mt-3 text-sm text-blue-600 hover:underline">
                      Przejdź i popraw →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* ── POWIADOMIENIA ── */}
        {!loading && tab === 'powiadomienia' && (
          <div>
            {nieprzeczytane > 0 && (
              <button onClick={oznaczWszystkie}
                className="mb-3 text-sm border border-gray-200 bg-white px-3 py-2 rounded-lg hover:bg-gray-50">
                Oznacz wszystkie jako przeczytane
              </button>
            )}
            {powiad.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
                <p className="text-gray-500">Brak powiadomień.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {powiad.map(n => (
                  <div key={n.id} className={`px-5 py-4 flex items-start gap-3 ${n.przeczytane ? '' : 'bg-blue-50/40'}`}>
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.przeczytane ? 'bg-gray-200' : 'bg-blue-500'}`}></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{n.tytul}</p>
                      {n.tresc && <p className="text-sm text-gray-500 mt-0.5">{n.tresc}</p>}
                      <p className="text-xs text-gray-400 mt-1">{fmtData(n.created_at)}</p>
                    </div>
                    {!n.przeczytane && (
                      <button onClick={() => oznaczPrzeczytane(n.id)}
                        className="text-xs text-gray-400 hover:text-gray-700 underline whitespace-nowrap">
                        Przeczytane
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── OKNO DECYZJI ODMOWNEJ ── */}
      {decyzjaDla && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-medium text-gray-900">
              {decyzjaDla.typ === 'odrzucony' ? 'Odrzucenie pozycji' : 'Odesłanie do poprawy'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{decyzjaDla.poz.opis}</p>

            <label htmlFor="komentarz" className="block mt-4 text-sm font-medium text-gray-700">
              {decyzjaDla.typ === 'odrzucony' ? 'Powód odrzucenia' : 'Co jest do poprawy?'}
            </label>
            <textarea id="komentarz" value={komentarz} onChange={e => setKomentarz(e.target.value)}
              rows={4} autoFocus
              placeholder="Pracownik zobaczy tę treść przy swojej pozycji."
              className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setDecyzjaDla(null); setKomentarz('') }}
                className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">
                Anuluj
              </button>
              <button onClick={zapiszDecyzjeOdmowna} disabled={zapisuje || !komentarz.trim()}
                className={`text-sm text-white px-4 py-2 rounded-lg disabled:opacity-50 ${
                  decyzjaDla.typ === 'odrzucony' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                {zapisuje ? 'Zapisuję...' : decyzjaDla.typ === 'odrzucony' ? 'Odrzuć' : 'Odeślij do poprawy'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
