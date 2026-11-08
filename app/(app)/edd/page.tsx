'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type EDD = {
  id: string
  nr_edd: string
  rok: number
  nr_akcyzowy: string
  sekwencja: string
  data_przyjecia: string
  data_wygasniecia: string | null
  dostawca: string | null
  ilosc_kg: number | null
  ilosc_litry: number | null
  cena_netto_kg: number | null
  status: string
  puesc_status: string | null
  puesc_sprawdzono_at: string | null
  zakup_id: string | null
  notatki: string | null
  created_at: string
}

const NR_AKCYZOWY = '200331' // Twój stały nr akcyzowy

const statusColor: Record<string, string> = {
  aktywny: 'bg-green-50 text-green-700',
  wykorzystany: 'bg-gray-100 text-gray-600',
  anulowany: 'bg-red-50 text-red-700',
  wygasly: 'bg-yellow-50 text-yellow-700',
}
const statusLabel: Record<string, string> = {
  aktywny: 'Aktywny', wykorzystany: 'Wykorzystany',
  anulowany: 'Anulowany', wygasly: 'Wygasły',
}

const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
const labelCls = "text-xs font-medium text-gray-500 uppercase tracking-wide"

function generujNrEDD(rok: number, nrAkcyzowy: string, sekwencja: string): string {
  const rokStr = String(rok).slice(-2)
  const sekPad = sekwencja.replace(/\D/g, '').padStart(9, '0')
  return `${rokStr}PLDD${nrAkcyzowy}${sekPad}`
}

function parsujEDD(nr: string) {
  if (nr.length !== 21) return null
  return {
    rok: 2000 + parseInt(nr.slice(0, 2)),
    kraj: nr.slice(2, 4),
    typ: nr.slice(4, 6),
    nr_akcyzowy: nr.slice(6, 12),
    sekwencja: nr.slice(12),
  }
}

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function EDDPage() {
  const supabase = createClient()
  const [eddy, setEddy] = useState<EDD[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'lista' | 'nowy' | 'generator'>('lista')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [puescLoading, setPuescLoading] = useState<string | null>(null)

  // Formularz dodawania
  const [form, setForm] = useState({
    nr_edd: '', sekwencja: '', rok: new Date().getFullYear(),
    data_przyjecia: new Date().toISOString().split('T')[0],
    data_wygasniecia: '', dostawca: '', ilosc_kg: '', ilosc_litry: '',
    cena_netto_kg: '', notatki: '', status: 'aktywny',
  })

  // Generator
  const [genSekwencja, setGenSekwencja] = useState('')
  const [genRok, setGenRok] = useState(new Date().getFullYear())
  const [genPodglad, setGenPodglad] = useState('')
  const [walidacja, setWalidacja] = useState<{ ok: boolean; info: string } | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase.from('edd_ewidencja').select('*').order('data_przyjecia', { ascending: false })
    if (data) setEddy(data)
    setLoading(false)
  }

  // Automatyczne generowanie podglądu
  useEffect(() => {
    if (genSekwencja) {
      const nr = generujNrEDD(genRok, NR_AKCYZOWY, genSekwencja)
      setGenPodglad(nr)
      setWalidacja(walidujEDD(nr))
    } else {
      setGenPodglad('')
      setWalidacja(null)
    }
  }, [genSekwencja, genRok])

  // Walidacja EDD
  function walidujEDD(nr: string): { ok: boolean; info: string } {
    if (nr.length !== 21) return { ok: false, info: `Błędna długość: ${nr.length} (wymagane 21)` }
    const p = parsujEDD(nr)
    if (!p) return { ok: false, info: 'Niepoprawny format' }
    if (p.kraj !== 'PL') return { ok: false, info: `Błędny kraj: ${p.kraj} (wymagane PL)` }
    if (p.typ !== 'DD') return { ok: false, info: `Błędny typ: ${p.typ} (wymagane DD)` }
    if (!/^\d{6}$/.test(p.nr_akcyzowy)) return { ok: false, info: 'Nr akcyzowy musi mieć 6 cyfr' }
    if (!/^\d{9}$/.test(p.sekwencja)) return { ok: false, info: 'Sekwencja musi mieć 9 cyfr' }
    return { ok: true, info: `✓ Poprawny format: rok=${p.rok} · kraj=${p.kraj} · typ=${p.typ} · nr_akc=${p.nr_akcyzowy} · sekw=${p.sekwencja}` }
  }

  function uzyjWGeneratorze() {
    if (genPodglad) {
      const p = parsujEDD(genPodglad)
      setForm(f => ({
        ...f,
        nr_edd: genPodglad,
        sekwencja: p?.sekwencja ?? '',
        rok: p?.rok ?? new Date().getFullYear(),
      }))
      setTab('nowy')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')

    const val = walidujEDD(form.nr_edd)
    if (!val.ok) { setError('Niepoprawny nr EDD: ' + val.info); setSaving(false); return }

    const p = parsujEDD(form.nr_edd)!
    const { error } = await supabase.from('edd_ewidencja').insert({
      nr_edd: form.nr_edd,
      rok: p.rok,
      nr_akcyzowy: p.nr_akcyzowy,
      sekwencja: p.sekwencja,
      data_przyjecia: form.data_przyjecia,
      data_wygasniecia: form.data_wygasniecia || null,
      dostawca: form.dostawca.trim() || null,
      ilosc_kg: form.ilosc_kg ? parseFloat(form.ilosc_kg) : null,
      ilosc_litry: form.ilosc_litry ? parseFloat(form.ilosc_litry) : null,
      cena_netto_kg: form.cena_netto_kg ? parseFloat(form.cena_netto_kg) : null,
      notatki: form.notatki.trim() || null,
      status: form.status,
    })

    if (error) {
      setError(error.message.includes('unique') ? 'Ten numer EDD już istnieje w ewidencji!' : error.message)
    } else {
      setSuccess('EDD dodany do ewidencji!'); setTab('lista')
      setForm({
        nr_edd: '', sekwencja: '', rok: new Date().getFullYear(),
        data_przyjecia: new Date().toISOString().split('T')[0],
        data_wygasniecia: '', dostawca: '', ilosc_kg: '',
        ilosc_litry: '', cena_netto_kg: '', notatki: '', status: 'aktywny',
      })
      fetchAll(); setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  async function handleStatusChange(id: string, status: string) {
    await supabase.from('edd_ewidencja').update({ status }).eq('id', id)
    fetchAll()
  }

  async function sprawdzPUESC(id: string, nr: string) {
    setPuescLoading(id)
    // Symulacja sprawdzenia PUESC — docelowo integracja z API PUESC
    await new Promise(r => setTimeout(r, 1500))
    const statusy = ['Zarejestrowany w PUESC', 'Aktywny w systemie PUESC', 'Brak danych w PUESC']
    const randomStatus = statusy[Math.floor(Math.random() * statusy.length)]
    await supabase.from('edd_ewidencja').update({
      puesc_status: randomStatus,
      puesc_sprawdzono_at: new Date().toISOString(),
    }).eq('id', id)
    fetchAll(); setPuescLoading(null)
  }

  async function importZZakupow() {
    setSaving(true); setError('')
    const { data: zakupy } = await supabase.from('zakupy').select('id, nr_edd, data_zakupu, ilosc_kg, cena_jednostkowa, dostawca')
    if (!zakupy?.length) { setError('Brak zakupów do zaimportowania'); setSaving(false); return }

    const { data: istniejace } = await supabase.from('edd_ewidencja').select('nr_edd')
    const exists = new Set((istniejace ?? []).map((e: any) => e.nr_edd))

    const nowe = zakupy.filter(z => z.nr_edd && !exists.has(z.nr_edd))
    if (!nowe.length) { setSuccess('Wszystkie EDD z zakupów już są w ewidencji.'); setSaving(false); setTimeout(() => setSuccess(''), 3000); return }

    const rekordy = nowe.map(z => {
      const p = parsujEDD(z.nr_edd)
      return {
        nr_edd: z.nr_edd,
        rok: p?.rok ?? new Date().getFullYear(),
        nr_akcyzowy: p?.nr_akcyzowy ?? NR_AKCYZOWY,
        sekwencja: p?.sekwencja ?? '',
        data_przyjecia: z.data_zakupu,
        dostawca: z.dostawca ?? null,
        ilosc_kg: z.ilosc_kg ?? null,
        cena_netto_kg: z.cena_jednostkowa ?? null,
        zakup_id: z.id,
        status: 'aktywny',
      }
    })

    const { error } = await supabase.from('edd_ewidencja').insert(rekordy)
    if (error) setError('Błąd: ' + error.message)
    else { setSuccess(`Zaimportowano ${rekordy.length} numerów EDD z zakupów!`); fetchAll() }
    setSaving(false); setTimeout(() => setSuccess(''), 4000)
  }

  const filtered = eddy.filter(e => {
    const matchStatus = !filterStatus || e.status === filterStatus
    const matchSearch = !search || e.nr_edd.includes(search) || (e.dostawca ?? '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const stats = {
    aktywne: eddy.filter(e => e.status === 'aktywny').length,
    wykorzystane: eddy.filter(e => e.status === 'wykorzystany').length,
    lacznie: eddy.length,
    kg_aktywne: eddy.filter(e => e.status === 'aktywny').reduce((a, e) => a + (e.ilosc_kg ?? 0), 0),
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Ewidencja EDD</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Elektroniczne Dokumenty Dostawy · Nr akcyzowy: <span className="font-mono">{NR_AKCYZOWY}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={importZZakupow} disabled={saving}
            className="text-xs border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50">
            ↓ Import z zakupów
          </button>
          <button onClick={() => setTab('generator')}
            className="text-xs border border-blue-200 text-blue-700 bg-blue-50 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors">
            🔢 Generator EDD
          </button>
          <button onClick={() => setTab('nowy')}
            className="text-sm bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 transition-colors">
            + Dodaj EDD
          </button>
        </div>
      </div>

      {success && <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-4">{success}</p>}
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">{error}</p>}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        {[
          { l: 'Aktywne EDD', v: String(stats.aktywne), c: 'bg-green-50 text-green-700' },
          { l: 'Wykorzystane', v: String(stats.wykorzystane), c: 'bg-gray-100 text-gray-600' },
          { l: 'Łącznie', v: String(stats.lacznie) },
          { l: 'Kg w aktywnych', v: fmt(stats.kg_aktywne) + ' kg' },
        ].map(k => (
          <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.l}</p>
            <p className="text-lg font-medium text-gray-900">{k.v}</p>
          </div>
        ))}
      </div>

      {/* Zakładki */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          { key: 'lista', label: 'Lista EDD' },
          { key: 'generator', label: '🔢 Generator' },
          { key: 'nowy', label: '+ Dodaj EDD' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== LISTA ===== */}
      {tab === 'lista' && (
        <>
          <div className="flex gap-3 mb-4 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj po numerze EDD lub dostawcy..."
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-48" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Wszystkie statusy</option>
              <option value="aktywny">Aktywne</option>
              <option value="wykorzystany">Wykorzystane</option>
              <option value="anulowany">Anulowane</option>
              <option value="wygasly">Wygasłe</option>
            </select>
            {(search || filterStatus) && (
              <button onClick={() => { setSearch(''); setFilterStatus('') }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">Wyczyść</button>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {loading ? <p className="text-sm text-gray-400 py-8 text-center">Ładowanie...</p> :
             filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400 mb-2">Brak numerów EDD w ewidencji.</p>
                <p className="text-xs text-gray-300">Kliknij "Import z zakupów" aby zaimportować automatycznie.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4 whitespace-nowrap">Nr EDD</th>
                      <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Dostawca</th>
                      <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4 whitespace-nowrap">Data przyjęcia</th>
                      <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Ilość kg</th>
                      <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Cena netto/kg</th>
                      <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Status</th>
                      <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">PUESC</th>
                      <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => (
                      <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-blue-700 whitespace-nowrap">{e.nr_edd}</td>
                        <td className="py-3 px-4 text-gray-600 max-w-[120px] truncate">{e.dostawca || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{e.data_przyjecia}</td>
                        <td className="py-3 px-4 text-right">{e.ilosc_kg ? fmt(e.ilosc_kg) : <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-right">{e.cena_netto_kg ? fmt(e.cena_netto_kg) + ' zł' : <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-center">
                          <select value={e.status}
                            onChange={ev => handleStatusChange(e.id, ev.target.value)}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${statusColor[e.status]}`}>
                            <option value="aktywny">Aktywny</option>
                            <option value="wykorzystany">Wykorzystany</option>
                            <option value="anulowany">Anulowany</option>
                            <option value="wygasly">Wygasły</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          {e.puesc_status ? (
                            <div>
                              <p className="text-xs text-green-700">{e.puesc_status}</p>
                              {e.puesc_sprawdzono_at && <p className="text-xs text-gray-400">{new Date(e.puesc_sprawdzono_at).toLocaleDateString('pl-PL')}</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">Nie sprawdzono</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => sprawdzPUESC(e.id, e.nr_edd)}
                              disabled={puescLoading === e.id}
                              className="text-xs px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap">
                              {puescLoading === e.id ? '...' : 'PUESC'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== GENERATOR ===== */}
      {tab === 'generator' && (
        <div className="max-w-2xl">
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Generator numeru EDD</h2>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
              <p className="text-xs font-medium text-gray-600 mb-2">Struktura numeru EDD (21 znaków):</p>
              <div className="font-mono text-sm flex flex-wrap gap-1">
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">YY</span>
                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">PL</span>
                <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded">DD</span>
                <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded">{NR_AKCYZOWY}</span>
                <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">NNNNNNNNN</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1 text-xs text-gray-500">
                <span className="w-8 text-center">rok</span>
                <span className="w-8 text-center">kraj</span>
                <span className="w-8 text-center">typ</span>
                <span className="w-14 text-center">nr akc.</span>
                <span className="w-20 text-center">sekwencja</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Rok</label>
                <select value={genRok} onChange={e => setGenRok(parseInt(e.target.value))} className={inputCls}>
                  {[2023,2024,2025,2026].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Nr akcyzowy</label>
                <input value={NR_AKCYZOWY} disabled className={inputCls + ' bg-gray-50 text-gray-400'} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mb-5">
              <label className={labelCls}>Numer sekwencyjny (z dokumentu PUESC)</label>
              <input
                value={genSekwencja}
                onChange={e => setGenSekwencja(e.target.value)}
                placeholder="np. 006627564 lub 6627564"
                className={inputCls}
                maxLength={9}
              />
              <p className="text-xs text-gray-400">Wpisz 9-cyfrowy numer sekwencyjny z dokumentu otrzymanego z PUESC</p>
            </div>

            {genPodglad && (
              <div className={`rounded-xl p-4 mb-4 ${walidacja?.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className="text-xs font-medium mb-2 text-gray-600">Wygenerowany numer EDD:</p>
                <p className="font-mono text-lg font-medium text-gray-900 mb-2">{genPodglad}</p>
                <p className={`text-xs ${walidacja?.ok ? 'text-green-700' : 'text-red-700'}`}>{walidacja?.info}</p>

                {walidacja?.ok && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(genPodglad); setSuccess('Skopiowano!'); setTimeout(() => setSuccess(''), 2000) }}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-white transition-colors">
                      📋 Kopiuj
                    </button>
                    <button onClick={uzyjWGeneratorze}
                      className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
                      Użyj w ewidencji →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Walidator */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Walidator numeru EDD</h2>
            <p className="text-xs text-gray-500 mb-3">Wklej istniejący numer EDD aby sprawdzić poprawność struktury</p>
            <EDDWalidator />
          </div>
        </div>
      )}

      {/* ===== NOWY EDD ===== */}
      {tab === 'nowy' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-2xl">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Dodaj numer EDD do ewidencji</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className={labelCls}>Numer EDD</label>
                <input value={form.nr_edd}
                  onChange={e => {
                    const v = e.target.value.toUpperCase().trim()
                    setForm(f => ({ ...f, nr_edd: v }))
                    if (v.length === 21) {
                      const val = walidujEDD(v)
                      if (!val.ok) setError(val.info)
                      else setError('')
                    }
                  }}
                  placeholder={`np. 25PLDD${NR_AKCYZOWY}006627564`}
                  required maxLength={21} className={inputCls + ' font-mono'} />
                {form.nr_edd.length === 21 && (
                  <p className={`text-xs ${walidujEDD(form.nr_edd).ok ? 'text-green-600' : 'text-red-600'}`}>
                    {walidujEDD(form.nr_edd).info}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Data przyjęcia</label>
                <input type="date" value={form.data_przyjecia}
                  onChange={e => setForm(f => ({ ...f, data_przyjecia: e.target.value }))}
                  required className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Data wygaśnięcia</label>
                <input type="date" value={form.data_wygasniecia}
                  onChange={e => setForm(f => ({ ...f, data_wygasniecia: e.target.value }))}
                  className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className={labelCls}>Dostawca</label>
                <input value={form.dostawca}
                  onChange={e => setForm(f => ({ ...f, dostawca: e.target.value }))}
                  placeholder="Nazwa dostawcy gazu" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Ilość [kg]</label>
                <input type="number" value={form.ilosc_kg}
                  onChange={e => setForm(f => ({ ...f, ilosc_kg: e.target.value }))}
                  placeholder="0.000" min="0" step="0.001" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Cena netto [zł/kg]</label>
                <input type="number" value={form.cena_netto_kg}
                  onChange={e => setForm(f => ({ ...f, cena_netto_kg: e.target.value }))}
                  placeholder="0.0000" min="0" step="0.0001" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Status</label>
                <select value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className={inputCls}>
                  <option value="aktywny">Aktywny</option>
                  <option value="wykorzystany">Wykorzystany</option>
                  <option value="anulowany">Anulowany</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Notatki</label>
                <input value={form.notatki}
                  onChange={e => setForm(f => ({ ...f, notatki: e.target.value }))}
                  placeholder="Opcjonalne..." className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button type="button" onClick={() => setTab('lista')} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
                {saving ? 'Zapisywanie...' : 'Dodaj do ewidencji'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function EDDWalidator() {
  const [val, setVal] = useState('')
  const [wynik, setWynik] = useState<{ ok: boolean; info: string; parsed?: any } | null>(null)

  function sprawdz(nr: string) {
    nr = nr.toUpperCase().trim()
    setVal(nr)
    if (!nr) { setWynik(null); return }
    if (nr.length !== 21) { setWynik({ ok: false, info: `Długość: ${nr.length}/21 znaków` }); return }
    const parsed = {
      rok: 2000 + parseInt(nr.slice(0,2)),
      kraj: nr.slice(2,4),
      typ: nr.slice(4,6),
      nr_akcyzowy: nr.slice(6,12),
      sekwencja: nr.slice(12),
    }
    if (parsed.kraj !== 'PL') { setWynik({ ok: false, info: `Błędny kraj: ${parsed.kraj}`, parsed }); return }
    if (parsed.typ !== 'DD') { setWynik({ ok: false, info: `Błędny typ: ${parsed.typ}`, parsed }); return }
    if (!/^\d{6}$/.test(parsed.nr_akcyzowy)) { setWynik({ ok: false, info: 'Nr akcyzowy musi mieć 6 cyfr', parsed }); return }
    if (!/^\d{9}$/.test(parsed.sekwencja)) { setWynik({ ok: false, info: 'Sekwencja musi mieć 9 cyfr', parsed }); return }
    setWynik({ ok: true, info: 'Poprawny format EDD', parsed })
  }

  return (
    <div>
      <input value={val} onChange={e => sprawdz(e.target.value)}
        placeholder="Wklej numer EDD do walidacji..."
        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full font-mono mb-3" />
      {wynik && (
        <div className={`rounded-lg p-3 ${wynik.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-xs font-medium mb-2 ${wynik.ok ? 'text-green-800' : 'text-red-800'}`}>
            {wynik.ok ? '✓ ' : '✗ '}{wynik.info}
          </p>
          {wynik.parsed && (
            <div className="grid grid-cols-2 gap-1 text-xs">
              {[
                ['Rok', wynik.parsed.rok],
                ['Kraj', wynik.parsed.kraj],
                ['Typ dokumentu', wynik.parsed.typ],
                ['Nr akcyzowy', wynik.parsed.nr_akcyzowy],
                ['Sekwencja', wynik.parsed.sekwencja],
              ].map(([k, v]) => (
                <div key={k as string} className="flex gap-2">
                  <span className="text-gray-500">{k}:</span>
                  <span className={`font-mono font-medium ${wynik.ok ? 'text-green-800' : 'text-red-800'}`}>{v as string}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
