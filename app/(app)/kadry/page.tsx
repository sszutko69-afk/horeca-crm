'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

type Pracownik = {
  id: string; imie: string; nazwisko: string; stanowisko: string
  rodzaj_umowy: string | null; wynagrodzenie_brutto: number | null
  stawka_godzinowa: number | null; wymiar_etatu: number | null
  data_zatrudnienia: string | null
  data_zwolnienia: string | null; uprawnienia: string | null
  telefon: string | null; email: string | null; pesel: string | null
  numer_konta: string | null; adres: string | null
  aktywny: boolean; notatki: string | null
}

const WYMIARY = [
  { v: '1',      l: '1/1 — pełny etat' },
  { v: '0.75',   l: '3/4 etatu'        },
  { v: '0.5',    l: '1/2 etatu'        },
  { v: '0.3333', l: '1/3 etatu'        },
  { v: '0.25',   l: '1/4 etatu'        },
]
function wymiarLabel(v: number | null | undefined): string {
  const w = v ?? 1
  if (w >= 1)                    return 'pełny etat'
  if (Math.abs(w - 0.75) < 0.02) return '3/4 etatu'
  if (Math.abs(w - 0.5)  < 0.02) return '1/2 etatu'
  if (Math.abs(w - 1/3)  < 0.02) return '1/3 etatu'
  if (Math.abs(w - 0.25) < 0.02) return '1/4 etatu'
  return `${(w * 100).toFixed(0)}% etatu`
}

const UMOWY = [
  { v: 'uop', l: 'Umowa o pracę' },
  { v: 'uoz', l: 'Umowa zlecenie' },
  { v: 'uod', l: 'Umowa o dzieło' },
  { v: 'b2b', l: 'B2B / samozatrudnienie' },
  { v: 'staz', l: 'Staż / Praktyka' },
]

const STANOWISKA = [
  'Menedżer restauracji', 'Kierownik zmiany', 'Szef kuchni', 'Sous chef', 'Kucharz',
  'Pomoc kuchenna', 'Cukiernik', 'Kelner', 'Barman', 'Barista', 'Sommelier',
  'Hostessa', 'Recepcjonista', 'Pokojowa', 'Obsługa cateringu / eventów',
  'Zmywak', 'Dostawca / kierowca', 'Magazynier', 'Księgowa / administracja', 'Inne',
]

const UMOWA_BADGE: Record<string, string> = {
  uop:  'bg-blue-100 text-blue-700',
  uoz:  'bg-yellow-100 text-yellow-700',
  uod:  'bg-purple-100 text-purple-700',
  b2b:  'bg-orange-100 text-orange-700',
  staz: 'bg-gray-100 text-gray-600',
}
const UMOWA_LABEL: Record<string, string> = {
  uop: 'UoP', uoz: 'Zlecenie', uod: 'Dzieło', b2b: 'B2B', staz: 'Staż',
}

const inp = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white'
const lbl = 'text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block'

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString('pl-PL') : '—'
}

const emptyForm = {
  imie: '', nazwisko: '', stanowisko: 'Kelner',
  rodzaj_umowy: 'uop', wynagrodzenie_brutto: '', stawka_godzinowa: '',
  wymiar_etatu: '1',
  data_zatrudnienia: '', data_zwolnienia: '', uprawnienia: '',
  telefon: '', email: '', pesel: '', numer_konta: '', adres: '', notatki: '',
}

export default function KadryPage() {
  const supabase = createClient()
  const [pracownicy, setPracownicy] = useState<Pracownik[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'aktywni' | 'nieaktywni' | 'wszyscy'>('aktywni')
  const [filterUmowa, setFilterUmowa] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editP, setEditP] = useState<Pracownik | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [openP, setOpenP] = useState<Pracownik | null>(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data } = await supabase.from('pracownicy').select('*').order('nazwisko')
    setPracownicy(data ?? [])
    setLoading(false)
  }

  function showMsg(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = {
      imie: form.imie.trim(),
      nazwisko: form.nazwisko.trim(),
      stanowisko: form.stanowisko.trim(),
      rodzaj_umowy: form.rodzaj_umowy || null,
      wynagrodzenie_brutto: form.wynagrodzenie_brutto ? parseFloat(form.wynagrodzenie_brutto) : null,
      stawka_godzinowa: form.stawka_godzinowa ? parseFloat(form.stawka_godzinowa) : null,
      wymiar_etatu: parseFloat(form.wymiar_etatu) || 1,
      data_zatrudnienia: form.data_zatrudnienia || null,
      data_zwolnienia: form.data_zwolnienia || null,
      uprawnienia: form.uprawnienia?.trim() || null,
      telefon: form.telefon?.trim() || null,
      email: form.email?.trim() || null,
      pesel: form.pesel?.trim() || null,
      numer_konta: form.numer_konta?.trim() || null,
      adres: form.adres?.trim() || null,
      notatki: form.notatki?.trim() || null,
    }
    if (editP) {
      const { error: err } = await supabase.from('pracownicy').update(payload).eq('id', editP.id)
      if (err) { setError(err.message); setSaving(false); return }
      showMsg('Zapisano zmiany!')
      if (openP?.id === editP.id) setOpenP(p => p ? { ...p, ...payload } as Pracownik : p)
      setEditP(null)
    } else {
      const { error: err } = await supabase.from('pracownicy').insert({ ...payload, aktywny: true })
      if (err) { setError(err.message); setSaving(false); return }
      showMsg('Pracownik dodany!')
    }
    setShowForm(false); setForm(emptyForm); loadAll(); setSaving(false)
  }

  function openEdit(p: Pracownik) {
    setForm({
      imie: p.imie, nazwisko: p.nazwisko, stanowisko: p.stanowisko,
      rodzaj_umowy: p.rodzaj_umowy ?? 'uop',
      wynagrodzenie_brutto: p.wynagrodzenie_brutto?.toString() ?? '',
      stawka_godzinowa: p.stawka_godzinowa?.toString() ?? '',
      wymiar_etatu: p.wymiar_etatu?.toString() ?? '1',
      data_zatrudnienia: p.data_zatrudnienia ?? '',
      data_zwolnienia: p.data_zwolnienia ?? '',
      uprawnienia: p.uprawnienia ?? '', telefon: p.telefon ?? '',
      email: p.email ?? '', pesel: p.pesel ?? '',
      numer_konta: p.numer_konta ?? '', adres: p.adres ?? '',
      notatki: p.notatki ?? '',
    })
    setEditP(p); setShowForm(true)
  }

  async function toggleAktywny(p: Pracownik) {
    await supabase.from('pracownicy').update({ aktywny: !p.aktywny }).eq('id', p.id)
    if (openP?.id === p.id) setOpenP(prev => prev ? { ...prev, aktywny: !prev.aktywny } : prev)
    loadAll()
  }

  async function handleDelete() {
    if (!deleteId) return
    const { error: err } = await supabase.from('pracownicy').delete().eq('id', deleteId)
    if (err) { setError(err.message); setDeleteId(null); return }
    setDeleteId(null)
    if (openP?.id === deleteId) setOpenP(null)
    loadAll(); showMsg('Pracownik usunięty')
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return pracownicy.filter(p => {
      const matchSearch = !q ||
        p.imie.toLowerCase().includes(q) ||
        p.nazwisko.toLowerCase().includes(q) ||
        p.stanowisko.toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.telefon ?? '').includes(q)
      const matchStatus =
        filterStatus === 'wszyscy' ||
        (filterStatus === 'aktywni' && p.aktywny) ||
        (filterStatus === 'nieaktywni' && !p.aktywny)
      const matchUmowa = !filterUmowa || p.rodzaj_umowy === filterUmowa
      return matchSearch && matchStatus && matchUmowa
    })
  }, [pracownicy, search, filterStatus, filterUmowa])

  const stats = {
    aktywni: pracownicy.filter(p => p.aktywny).length,
    nieaktywni: pracownicy.filter(p => !p.aktywny).length,
    uop: pracownicy.filter(p => p.aktywny && p.rodzaj_umowy === 'uop').length,
    inne: pracownicy.filter(p => p.aktywny && p.rodzaj_umowy !== 'uop').length,
    fundusz: pracownicy.filter(p => p.aktywny).reduce((a, p) => a + (p.wynagrodzenie_brutto ?? 0), 0),
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Kadry</h1>
          <p className="text-sm text-gray-500 mt-0.5">Zarządzanie pracownikami · Umowy · Dane kadrowe</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/czasPracy"
            className="text-sm border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600 transition-colors">
            ⏱ Czas pracy
          </a>
          <a href="/planpracy"
            className="text-sm border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600 transition-colors">
            📅 Plan pracy
          </a>
          <a href="/place"
            className="text-sm border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600 transition-colors">
            💰 Płace
          </a>
          <button onClick={() => { setForm(emptyForm); setEditP(null); setShowForm(true) }}
            className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700 transition-colors">
            + Dodaj pracownika
          </button>
        </div>
      </div>

      {success && <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-4">✓ {success}</div>}
      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">✗ {error}</div>}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { l: 'Aktywni',           v: stats.aktywni,                   cls: 'text-green-700' },
          { l: 'Nieaktywni',        v: stats.nieaktywni,                cls: 'text-gray-500'  },
          { l: 'UoP',               v: stats.uop,                       cls: 'text-blue-700'  },
          { l: 'B2B / Zlecenie',    v: stats.inne,                      cls: 'text-orange-700'},
          { l: 'Fundusz płac brutto', v: fmt(stats.fundusz) + ' zł',   cls: 'text-purple-700'},
        ].map(k => (
          <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.l}</p>
            <p className={`text-lg font-semibold ${k.cls}`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Filtry */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Szukaj pracownika..."
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['aktywni', 'nieaktywni', 'wszyscy'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterStatus === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s === 'aktywni' ? 'Aktywni' : s === 'nieaktywni' ? 'Nieaktywni' : 'Wszyscy'}
            </button>
          ))}
        </div>
        <select value={filterUmowa} onChange={e => setFilterUmowa(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none bg-white">
          <option value="">Wszystkie umowy</option>
          {UMOWY.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
        </select>
        {(search || filterUmowa) && (
          <button onClick={() => { setSearch(''); setFilterUmowa('') }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
            ✕ Wyczyść
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} pracowników</span>
      </div>

      {/* Tabela */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Ładowanie...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">
            {pracownicy.length === 0
              ? 'Brak pracowników — dodaj pierwszego.'
              : 'Brak wyników dla podanych filtrów.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Pracownik', 'Stanowisko', 'Umowa', 'Wymiar', 'Wynagrodzenie', 'Stawka/h', 'Zatrudniony od', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr
                  key={p.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!p.aktywny ? 'opacity-60' : ''}`}
                  onClick={() => setOpenP(p)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.imie} {p.nazwisko}</div>
                    {p.email && <div className="text-xs text-gray-400">{p.email}</div>}
                    {p.telefon && <div className="text-xs text-gray-400">{p.telefon}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.stanowisko}</td>
                  <td className="px-4 py-3">
                    {p.rodzaj_umowy ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${UMOWA_BADGE[p.rodzaj_umowy] ?? 'bg-gray-100 text-gray-600'}`}>
                        {UMOWA_LABEL[p.rodzaj_umowy] ?? p.rodzaj_umowy}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(p.wymiar_etatu ?? 1) >= 1 ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {wymiarLabel(p.wymiar_etatu)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {p.wynagrodzenie_brutto
                      ? <><span>{fmt(p.wynagrodzenie_brutto)} zł</span><span className="text-xs text-gray-400 ml-1">/ {wymiarLabel(p.wymiar_etatu)}</span></>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.stawka_godzinowa ? fmt(p.stawka_godzinowa) + ' zł/h' : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(p.data_zatrudnienia)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); toggleAktywny(p) }}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.aktywny ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.aktywny ? 'Aktywny' : 'Nieaktywny'}
                    </button>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-500">
                        Edytuj
                      </button>
                      <button onClick={() => setDeleteId(p.id)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-400">
                        Usuń
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DRAWER: Szczegóły pracownika */}
      {openP && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black bg-opacity-30" onClick={() => setOpenP(null)} />
          <div className="w-full max-w-md bg-white border-l border-gray-200 flex flex-col" style={{ overflowY: 'auto' }}>
            <div className="p-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{openP.imie} {openP.nazwisko}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{openP.stanowisko}</p>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {openP.rodzaj_umowy && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${UMOWA_BADGE[openP.rodzaj_umowy] ?? 'bg-gray-100 text-gray-600'}`}>
                      {UMOWY.find(u => u.v === openP.rodzaj_umowy)?.l ?? openP.rodzaj_umowy}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${openP.aktywny ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {openP.aktywny ? 'Aktywny' : 'Nieaktywny'}
                  </span>
                </div>
              </div>
              <button onClick={() => setOpenP(null)} className="text-gray-400 hover:text-gray-700 text-xl ml-3">✕</button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kontakt</h3>
                <div className="space-y-1.5">
                  {openP.telefon && <p className="text-sm text-gray-700">📞 {openP.telefon}</p>}
                  {openP.email && <p className="text-sm text-gray-700">✉️ {openP.email}</p>}
                  {openP.adres && <p className="text-sm text-gray-700">📍 {openP.adres}</p>}
                  {!openP.telefon && !openP.email && <p className="text-xs text-gray-400">Brak danych kontaktowych</p>}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Wynagrodzenie</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Wymiar czasu pracy</p>
                    <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${(openP.wymiar_etatu ?? 1) >= 1 ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {wymiarLabel(openP.wymiar_etatu)}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Brutto (wg wymiaru)</p>
                    <p className="text-base font-semibold text-gray-900">{fmt(openP.wynagrodzenie_brutto)} zł</p>
                    {openP.wynagrodzenie_brutto && (openP.wymiar_etatu ?? 1) < 1 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        pełny etat: {fmt(openP.wynagrodzenie_brutto / (openP.wymiar_etatu ?? 1))} zł
                      </p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Stawka godzinowa</p>
                    <p className="text-base font-semibold text-gray-900">{fmt(openP.stawka_godzinowa)} zł/h</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Zatrudnienie</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Data zatrudnienia</span>
                    <span className="text-gray-900 font-medium">{fmtDate(openP.data_zatrudnienia)}</span>
                  </div>
                  {openP.data_zwolnienia && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Data zwolnienia</span>
                      <span className="text-red-600 font-medium">{fmtDate(openP.data_zwolnienia)}</span>
                    </div>
                  )}
                  {openP.uprawnienia && (
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500 shrink-0">Uprawnienia</span>
                      <span className="text-gray-900 text-right">{openP.uprawnienia}</span>
                    </div>
                  )}
                </div>
              </div>

              {(openP.pesel || openP.numer_konta) && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dane do wypłaty</h3>
                  <div className="space-y-1.5 text-sm">
                    {openP.pesel && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">PESEL</span>
                        <span className="text-gray-900 font-mono">{openP.pesel}</span>
                      </div>
                    )}
                    {openP.numer_konta && (
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500 shrink-0">Konto bankowe</span>
                        <span className="text-gray-900 font-mono text-xs break-all text-right">{openP.numer_konta}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {openP.notatki && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notatki</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{openP.notatki}</p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Powiązane moduły</h3>
                <div className="flex flex-col gap-2">
                  {[
                    { href: '/czasPracy', icon: '⏱', label: 'Czas pracy' },
                    { href: '/planpracy', icon: '📅', label: 'Plan pracy' },
                    { href: '/place',     icon: '💰', label: 'Płace' },
                  ].map(({ href, icon, label }) => (
                    <a key={href} href={href}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 transition-colors">
                      <span>{icon}</span>
                      <span>{label}</span>
                      <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex gap-2">
              <button onClick={() => { openEdit(openP); setOpenP(null) }}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Edytuj
              </button>
              <button onClick={() => toggleAktywny(openP)}
                className={`flex-1 px-4 py-2 text-sm border rounded-lg transition-colors ${openP.aktywny
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                {openP.aktywny ? 'Dezaktywuj' : 'Aktywuj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Dodaj / Edytuj pracownika */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-2xl" style={{ maxHeight: '94vh', overflowY: 'auto' }}>
            <h2 className="text-base font-semibold text-gray-900 mb-5">
              {editP ? `Edytuj: ${editP.imie} ${editP.nazwisko}` : 'Nowy pracownik'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className={lbl}>Imię *</label>
                  <input value={form.imie} onChange={e => setForm(f => ({ ...f, imie: e.target.value }))} required className={inp} placeholder="Jan" />
                </div>
                <div>
                  <label className={lbl}>Nazwisko *</label>
                  <input value={form.nazwisko} onChange={e => setForm(f => ({ ...f, nazwisko: e.target.value }))} required className={inp} placeholder="Kowalski" />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Stanowisko *</label>
                  <select value={form.stanowisko} onChange={e => setForm(f => ({ ...f, stanowisko: e.target.value }))} className={inp}>
                    {STANOWISKA.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Rodzaj umowy</label>
                  <select value={form.rodzaj_umowy} onChange={e => setForm(f => ({ ...f, rodzaj_umowy: e.target.value }))} className={inp}>
                    {UMOWY.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Data zatrudnienia</label>
                  <input type="date" value={form.data_zatrudnienia} onChange={e => setForm(f => ({ ...f, data_zatrudnienia: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Wymiar czasu pracy</label>
                  <select value={form.wymiar_etatu} onChange={e => setForm(f => ({ ...f, wymiar_etatu: e.target.value }))} className={inp}>
                    {WYMIARY.map(w => <option key={w.v} value={w.v}>{w.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>
                    Wynagrodzenie brutto [zł/mies.]
                    <span className="ml-1 font-normal text-gray-400 normal-case">
                      dla {wymiarLabel(parseFloat(form.wymiar_etatu))}
                    </span>
                  </label>
                  <input type="number" min="0" step="0.01" value={form.wynagrodzenie_brutto}
                    onChange={e => setForm(f => ({ ...f, wynagrodzenie_brutto: e.target.value }))}
                    placeholder="np. 6500.00" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Stawka godzinowa [zł/h]</label>
                  <input type="number" min="0" step="0.01" value={form.stawka_godzinowa}
                    onChange={e => setForm(f => ({ ...f, stawka_godzinowa: e.target.value }))}
                    placeholder="np. 35.00 (opcjonalnie, nadgodz.)" className={inp} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Uprawnienia / Kwalifikacje</label>
                  <input value={form.uprawnienia} onChange={e => setForm(f => ({ ...f, uprawnienia: e.target.value }))}
                    placeholder="np. Książeczka sanepidowska, HACCP, kurs barmański, prawo jazdy kat. B..." className={inp} />
                </div>
                <div>
                  <label className={lbl}>Telefon</label>
                  <input value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} placeholder="+48 000 000 000" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jan@restauracja.pl" className={inp} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Adres zamieszkania</label>
                  <input value={form.adres} onChange={e => setForm(f => ({ ...f, adres: e.target.value }))}
                    placeholder="ul. Przykładowa 1, 15-000 Białystok" className={inp} />
                </div>
                <div>
                  <label className={lbl}>PESEL</label>
                  <input value={form.pesel} onChange={e => setForm(f => ({ ...f, pesel: e.target.value }))}
                    placeholder="00000000000" maxLength={11} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Numer konta bankowego</label>
                  <input value={form.numer_konta} onChange={e => setForm(f => ({ ...f, numer_konta: e.target.value }))}
                    placeholder="PL00 0000 0000 0000 0000 0000 0000" className={inp} />
                </div>
                {editP && (
                  <div>
                    <label className={lbl}>Data zwolnienia / rozwiązania umowy</label>
                    <input type="date" value={form.data_zwolnienia} onChange={e => setForm(f => ({ ...f, data_zwolnienia: e.target.value }))} className={inp} />
                  </div>
                )}
                <div className={editP ? '' : 'col-span-2'}>
                  <label className={lbl}>Notatki</label>
                  <textarea value={form.notatki} onChange={e => setForm(f => ({ ...f, notatki: e.target.value }))}
                    rows={2} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none bg-white" />
                </div>
              </div>
              {error && <p className="text-xs text-red-600 mb-3">✗ {error}</p>}
              <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
                <button type="button" onClick={() => { setShowForm(false); setEditP(null); setError('') }}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                  Anuluj
                </button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
                  {saving ? 'Zapisuję...' : editP ? 'Zapisz zmiany' : 'Dodaj pracownika'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Potwierdź usunięcie */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Usuń pracownika</h2>
            <p className="text-sm text-gray-500 mb-5">
              Usunięcie pracownika jest nieodwracalne. Wpisy czasu pracy pozostaną w bazie.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Anuluj
              </button>
              <button onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
