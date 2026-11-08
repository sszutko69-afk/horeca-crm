'use client'

import { useEffect, useState } from 'react'
import CzatPanel from '@/components/CzatPanel'
import { createClient } from '@/lib/supabase'
import * as XLSX from 'xlsx'

type Sprzedaz = {
  id: string
  data_sprzedazy: string
  klient_id: string
  nr_edd: string
  ilosc_litry: number
  cena_sprzedazy: number
  forma_sprzedazy: string
  forma_platnosci: string
  rodzaj_dokumentu: string
  klienci?: { nazwa: string } | null
}

type Zakup = {
  id: string
  data_zakupu: string
  nr_edd: string
  ilosc_kg: number
  cena_jednostkowa: number
  dostawca: string | null
}

const VAT = 0.23

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pl-PL')
}

export default function RaportyPage() {
  const supabase = createClient()
  const [sprzedaz, setSprzedaz] = useState<Sprzedaz[]>([])
  const [zakupy, setZakupy] = useState<Zakup[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'klient' | 'edd' | 'dobowy' | 'platnosc' | 'marza'>('klient')
  const [od, setOd] = useState('')
  const [do_, setDo] = useState('')
  const [sortKlient, setSortKlient] = useState<{f: string, d: 'asc'|'desc'}>({f: 'brutto', d: 'desc'})
  const [sortEDD, setSortEDD] = useState<{f: string, d: 'asc'|'desc'}>({f: 'brutto', d: 'desc'})
  const [sortDobowy, setSortDobowy] = useState<{f: string, d: 'asc'|'desc'}>({f: 'data', d: 'desc'})
  const [sortMarza, setSortMarza] = useState<{f: string, d: 'asc'|'desc'}>({f: 'marza', d: 'desc'})

  function sortuj(data: any[], field: string, dir: 'asc'|'desc') {
    return [...data].sort((a, b) => {
      const va = a[field] ?? '', vb = b[field] ?? ''
      if (typeof va === 'number') return dir === 'asc' ? va - vb : vb - va
      return dir === 'asc' ? String(va).localeCompare(String(vb), 'pl') : String(vb).localeCompare(String(va), 'pl')
    })
  }

  function SortTh({ label, field, sort, setSort, right = false }: { label: string, field: string, sort: {f:string,d:'asc'|'desc'}, setSort: any, right?: boolean }) {
    const active = sort.f === field
    return (
      <th onClick={() => setSort((p: any) => ({ f: field, d: p.f === field && p.d === 'desc' ? 'asc' : 'desc' }))}
        className={`text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4 whitespace-nowrap cursor-pointer hover:text-gray-600 select-none ${right ? 'text-right' : 'text-left'}`}>
        {label}
        <span className="ml-1 opacity-60">{active ? (sort.d === 'desc' ? '↓' : '↑') : '↕'}</span>
      </th>
    )
  }

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: sp }, { data: zk }] = await Promise.all([
      supabase.from('sprzedaz').select('*, klienci(nazwa)').order('data_sprzedazy', { ascending: false }),
      supabase.from('zakupy').select('*').order('data_zakupu', { ascending: false }),
    ])
    if (sp) setSprzedaz(sp)
    if (zk) setZakupy(zk)
    setLoading(false)
  }

  const sprzedazFiltr = sprzedaz.filter(s => {
    if (od && s.data_sprzedazy < od) return false
    if (do_ && s.data_sprzedazy > do_) return false
    return true
  })

  const eddLitry: Record<string, number> = {}
  sprzedaz.forEach(s => { eddLitry[s.nr_edd] = (eddLitry[s.nr_edd] ?? 0) + s.ilosc_litry })

  function wsp(nr_edd: string) {
    const z = zakupy.find(x => x.nr_edd === nr_edd)
    if (!z || !eddLitry[nr_edd]) return 0
    return z.ilosc_kg / eddLitry[nr_edd]
  }

  function kosztBrutto(s: Sprzedaz) {
    const z = zakupy.find(x => x.nr_edd === s.nr_edd)
    if (!z) return 0
    return s.ilosc_litry * z.cena_jednostkowa * wsp(s.nr_edd) * (1 + VAT)
  }

  function marza(s: Sprzedaz) {
    return s.ilosc_litry * s.cena_sprzedazy - kosztBrutto(s)
  }

  const wgKlienta = Object.values(
    sprzedazFiltr.reduce((acc, s) => {
      const nazwa = s.klienci?.nazwa ?? s.klient_id
      if (!acc[nazwa]) acc[nazwa] = {
        nazwa, litry: 0, brutto: 0, marza: 0, transakcji: 0,
        platnosci: { przelew: 0, gotowka: 0, karta: 0, inne: 0 }
      }
      const b = s.ilosc_litry * s.cena_sprzedazy
      acc[nazwa].litry += s.ilosc_litry
      acc[nazwa].brutto += b
      acc[nazwa].marza += marza(s)
      acc[nazwa].transakcji += 1
      const fp = s.forma_platnosci
      if (fp === 'przelew') acc[nazwa].platnosci.przelew += b
      else if (fp === 'gotowka') acc[nazwa].platnosci.gotowka += b
      else if (fp === 'karta') acc[nazwa].platnosci.karta += b
      else acc[nazwa].platnosci.inne += b
      return acc
    }, {} as Record<string, any>)
  )

  const wgEDD = Object.values(
    sprzedazFiltr.reduce((acc, s) => {
      if (!acc[s.nr_edd]) {
        const z = zakupy.find(x => x.nr_edd === s.nr_edd)
        acc[s.nr_edd] = { nr_edd: s.nr_edd, litry: 0, brutto: 0, marza: 0, wsp: wsp(s.nr_edd), dostawca: z?.dostawca ?? '—' }
      }
      acc[s.nr_edd].litry += s.ilosc_litry
      acc[s.nr_edd].brutto += s.ilosc_litry * s.cena_sprzedazy
      acc[s.nr_edd].marza += marza(s)
      return acc
    }, {} as Record<string, any>)
  )

  const wgDnia = Object.values(
    sprzedazFiltr.reduce((acc, s) => {
      const d = s.data_sprzedazy.split('T')[0]
      if (!acc[d]) acc[d] = {
        data: d, litry: 0, brutto: 0, netto: 0, vat: 0, marza: 0, transakcji: 0,
        paragon: 0, paragon_brutto: 0,
        faktura: 0, faktura_brutto: 0,
        faktura_imienna: 0, faktura_imienna_brutto: 0,
      }
      const b = s.ilosc_litry * s.cena_sprzedazy
      acc[d].litry += s.ilosc_litry
      acc[d].brutto += b
      acc[d].netto += b / (1 + VAT)
      acc[d].vat += b - b / (1 + VAT)
      acc[d].marza += marza(s)
      acc[d].transakcji += 1
      const rod = s.rodzaj_dokumentu || (s.forma_sprzedazy === 'faktura_vat' ? 'faktura' : 'paragon')
      if (rod === 'faktura') { acc[d].faktura += 1; acc[d].faktura_brutto += b }
      else if (rod === 'faktura_imienna') { acc[d].faktura_imienna += 1; acc[d].faktura_imienna_brutto += b }
      else { acc[d].paragon += 1; acc[d].paragon_brutto += b }
      return acc
    }, {} as Record<string, any>)
  )

  function eksportExcel() {
    const wb = XLSX.utils.book_new()
    // Arkusz 1: Sprzedaż szczegółowa z pełnymi danymi
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sprzedazFiltr.map(s => ({
      'Data': s.data_sprzedazy,
      'Klient': s.klienci?.nazwa ?? '',
      'Nr EDD': s.nr_edd,
      'Litry': +s.ilosc_litry,
      'Cena (zł/l)': +s.cena_sprzedazy,
      'Sprzedaż brutto (zł)': +(s.ilosc_litry * s.cena_sprzedazy).toFixed(2),
      'Koszt brutto (zł)': +kosztBrutto(s).toFixed(2),
      'Marża brutto (zł)': +marza(s).toFixed(2),
      'Dokument': s.forma_sprzedazy === 'faktura_vat' ? 'Faktura VAT' : s.forma_sprzedazy === 'faktura_imienna' ? 'Faktura imienna' : 'Paragon',
      'Płatność': s.forma_platnosci === 'przelew' ? 'Przelew' : s.forma_platnosci === 'gotowka' ? 'Gotówka' : s.forma_platnosci === 'karta' ? 'Karta' : (s.forma_platnosci ?? ''),
    }))), 'Sprzedaz')
    // Arkusz 2: Wg klienta
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wgKlienta.map(r => ({
      'Klient': r.nazwa,
      'Transakcji': r.transakcji,
      'Litry': +r.litry.toFixed(2),
      'Sprzedaż brutto (zł)': +r.brutto.toFixed(2),
      'Przelew (zł)': +((r.platnosci?.przelew ?? 0)).toFixed(2),
      'Gotówka (zł)': +((r.platnosci?.gotowka ?? 0)).toFixed(2),
      'Karta (zł)': +((r.platnosci?.karta ?? 0)).toFixed(2),
      'Marża brutto (zł)': +r.marza.toFixed(2),
      'Marża %': +(r.brutto > 0 ? r.marza / r.brutto * 100 : 0).toFixed(1),
    }))), 'Wg klienta')
    // Arkusz 3: Wg EDD
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wgEDD.map(r => ({
      'Nr EDD': r.nr_edd,
      'Dostawca': r.dostawca,
      'Wsp. konwersji': +r.wsp.toFixed(4),
      'Litry': +r.litry.toFixed(2),
      'Sprzedaż brutto (zł)': +r.brutto.toFixed(2),
      'Marża brutto (zł)': +r.marza.toFixed(2),
    }))), 'Wg EDD')
    // Arkusz 4: Raport dobowy
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.values(wgDnia).map((r: any) => ({
      'Data': r.data,
      'Transakcji': r.transakcji,
      'Litry': +r.litry.toFixed(2),
      'Sprzedaż brutto (zł)': +r.brutto.toFixed(2),
      'Paragony (zł)': +(r.paragon_brutto ?? 0).toFixed(2),
      'Faktury VAT (zł)': +(r.faktura_brutto ?? 0).toFixed(2),
      'Faktury imienne (zł)': +(r.faktura_imienna_brutto ?? 0).toFixed(2),
      'Sprzedaż netto (zł)': +r.netto.toFixed(2),
      'VAT (zł)': +r.vat.toFixed(2),
      'Marża brutto (zł)': +r.marza.toFixed(2),
    }))), 'Raport dobowy')
    // Arkusz 5: Wg płatności
    const platnosci = [
      { forma: 'przelew', label: 'Przelew' },
      { forma: 'gotowka', label: 'Gotówka' },
      { forma: 'karta', label: 'Karta' },
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(platnosci.flatMap(p =>
      sprzedazFiltr.filter(s => s.forma_platnosci === p.forma).map(s => ({
        'Płatność': p.label,
        'Data': s.data_sprzedazy,
        'Klient': s.klienci?.nazwa ?? '',
        'Nr EDD': s.nr_edd,
        'Litry': +s.ilosc_litry,
        'Brutto (zł)': +(s.ilosc_litry * s.cena_sprzedazy).toFixed(2),
        'Dokument': s.forma_sprzedazy === 'faktura_vat' ? 'FV' : s.forma_sprzedazy === 'faktura_imienna' ? 'FI' : 'PAR',
      }))
    )), 'Wg platnosci')
    XLSX.writeFile(wb, 'GazCRM-Raport-' + new Date().toISOString().split('T')[0] + '.xlsx')
  }

  const totalBrutto = sprzedazFiltr.reduce((a, s) => a + s.ilosc_litry * s.cena_sprzedazy, 0)
  const totalMarza = sprzedazFiltr.reduce((a, s) => a + marza(s), 0)
  const totalLitry = sprzedazFiltr.reduce((a, s) => a + s.ilosc_litry, 0)

  const thCls = "text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4 whitespace-nowrap"

  return (
    <div className="min-h-screen">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-14 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Raporty</h1>
            <p className="text-sm text-gray-500">Analityka sprzedaży i marż</p>
          </div>
          <button onClick={eksportExcel} disabled={loading}
            className="text-sm bg-green-600 text-white rounded-lg px-4 py-1.5 hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Eksport Excel
          </button>
        </div>
      </div>
      <div className="p-6 max-w-6xl mx-auto">

      {/* Filtry */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium">Od</label>
          <input type="date" value={od} onChange={e => setOd(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium">Do</label>
          <input type="date" value={do_} onChange={e => setDo(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {(od || do_) && (
          <button onClick={() => { setOd(''); setDo('') }}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-500">
            Wyczyść
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{sprzedazFiltr.length} transakcji</span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
        {[
          { l: 'Sprzedaż brutto', v: fmt(totalBrutto) + ' zł' },
          { l: 'Marża brutto', v: fmt(totalMarza) + ' zł', s: totalBrutto > 0 ? (totalMarza / totalBrutto * 100).toFixed(1) + '%' : '' },
          { l: 'Marża transport', v: fmt(totalMarza / 2) + ' zł' },
          { l: 'Litry łącznie', v: fmt(totalLitry) + ' l', s: `${sprzedazFiltr.length} transakcji` },
        ].map(k => (
          <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.l}</p>
            <p className="text-lg font-medium text-gray-900">{k.v}</p>
            {k.s && <p className="text-xs text-gray-400 mt-0.5">{k.s}</p>}
          </div>
        ))}
      </div>

      {/* Podział wg rodzaju dokumentu */}
      {(() => {
        const paragony = sprzedazFiltr.filter(s => (s.rodzaj_dokumentu || (s.forma_sprzedazy === 'faktura_vat' ? 'faktura' : 'paragon')) === 'paragon')
        const faktury = sprzedazFiltr.filter(s => (s.rodzaj_dokumentu || (s.forma_sprzedazy === 'faktura_vat' ? 'faktura' : 'paragon')) === 'faktura')
        const fImienna = sprzedazFiltr.filter(s => (s.rodzaj_dokumentu || '') === 'faktura_imienna')
        const sumBrutto = (arr: Sprzedaz[]) => arr.reduce((a, s) => a + s.ilosc_litry * s.cena_sprzedazy, 0)
        const sumLitry = (arr: Sprzedaz[]) => arr.reduce((a, s) => a + s.ilosc_litry, 0)
        return (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { l: '🧾 Paragony', cnt: paragony.length, brutto: sumBrutto(paragony), litry: sumLitry(paragony), bg: 'bg-gray-50 border-gray-200' },
              { l: '📄 Faktury VAT', cnt: faktury.length, brutto: sumBrutto(faktury), litry: sumLitry(faktury), bg: 'bg-blue-50 border-blue-200' },
              { l: '👤 Faktury imienne', cnt: fImienna.length, brutto: sumBrutto(fImienna), litry: sumLitry(fImienna), bg: 'bg-purple-50 border-purple-200' },
            ].map(k => (
              <div key={k.l} className={`border rounded-xl p-4 ${k.bg}`}>
                <p className="text-xs font-semibold text-gray-600 mb-2">{k.l}</p>
                <p className="text-lg font-bold text-gray-900">{fmt(k.brutto)} zł</p>
                <p className="text-xs text-gray-500 mt-0.5">{fmt(k.litry)} l · {k.cnt} trans.</p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Podział wg formy płatności */}
      {(() => {
        const przelew  = sprzedazFiltr.filter(s => s.forma_platnosci === 'przelew')
        const gotowka  = sprzedazFiltr.filter(s => s.forma_platnosci === 'gotowka')
        const karta    = sprzedazFiltr.filter(s => s.forma_platnosci === 'karta')
        const inne     = sprzedazFiltr.filter(s => !['przelew','gotowka','karta'].includes(s.forma_platnosci))
        const sumB = (arr: Sprzedaz[]) => arr.reduce((a, s) => a + s.ilosc_litry * s.cena_sprzedazy, 0)
        return (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
            {[
              { l: '🏦 Przelew',       cnt: przelew.length,  brutto: sumB(przelew),  bg: 'bg-blue-50 border-blue-200',   txt: 'text-blue-700' },
              { l: '💵 Gotówka',       cnt: gotowka.length,  brutto: sumB(gotowka),  bg: 'bg-yellow-50 border-yellow-200', txt: 'text-yellow-700' },
              { l: '💳 Karta',         cnt: karta.length,    brutto: sumB(karta),    bg: 'bg-green-50 border-green-200', txt: 'text-green-700' },
              { l: '📌 Inne/brak',     cnt: inne.length,     brutto: sumB(inne),     bg: 'bg-gray-50 border-gray-200',   txt: 'text-gray-600' },
            ].map(k => (
              <div key={k.l} className={`border rounded-xl p-4 ${k.bg}`}>
                <p className={`text-xs font-semibold mb-2 ${k.txt}`}>{k.l}</p>
                <p className="text-lg font-bold text-gray-900">{fmt(k.brutto)} zł</p>
                <p className="text-xs text-gray-500 mt-0.5">{k.cnt} transakcji</p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Zakładki */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {([
          { key: 'klient', label: 'Wg klienta' },
          { key: 'edd', label: 'Wg EDD' },
          { key: 'dobowy', label: 'Raport dobowy' },
          { key: 'platnosc', label: '💳 Wg płatności' },
          { key: 'marza', label: 'Marża i transport' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Ładowanie...</p>
      ) : (
        <>
          {tab === 'klient' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <SortTh label="Klient" field="nazwa" sort={sortKlient} setSort={setSortKlient} />
                      <SortTh label="Trans." field="transakcji" sort={sortKlient} setSort={setSortKlient} right />
                      <SortTh label="Litry" field="litry" sort={sortKlient} setSort={setSortKlient} right />
                      <SortTh label="Sprzedaż brutto" field="brutto" sort={sortKlient} setSort={setSortKlient} right />
                      <th className={`${thCls} text-right`}>🏦 Przelew</th>
                      <th className={`${thCls} text-right`}>💵 Gotówka</th>
                      <th className={`${thCls} text-right`}>💳 Karta</th>
                      <SortTh label="Marża brutto" field="marza" sort={sortKlient} setSort={setSortKlient} right />
                      <th className={`${thCls} text-right`}>Marża %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortuj(wgKlienta, sortKlient.f, sortKlient.d).map(r => (
                      <tr key={r.nazwa} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-4 font-medium">{r.nazwa}</td>
                        <td className="py-2.5 px-4 text-right">{r.transakcji}</td>
                        <td className="py-2.5 px-4 text-right">{fmt(r.litry)}</td>
                        <td className="py-2.5 px-4 text-right font-medium">{fmt(r.brutto)} zł</td>
                        <td className="py-2.5 px-4 text-right text-blue-600 text-xs">{r.platnosci?.przelew > 0 ? fmt(r.platnosci.przelew) + ' zł' : '—'}</td>
                        <td className="py-2.5 px-4 text-right text-yellow-600 text-xs">{r.platnosci?.gotowka > 0 ? fmt(r.platnosci.gotowka) + ' zł' : '—'}</td>
                        <td className="py-2.5 px-4 text-right text-green-600 text-xs">{r.platnosci?.karta > 0 ? fmt(r.platnosci.karta) + ' zł' : '—'}</td>
                        <td className="py-2.5 px-4 text-right">{fmt(r.marza)} zł</td>
                        <td className="py-2.5 px-4 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.marza / r.brutto > 0.15 ? 'bg-green-50 text-green-700' : r.marza / r.brutto > 0.05 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                            {r.brutto > 0 ? (r.marza / r.brutto * 100).toFixed(1) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Razem</td>
                      <td className="py-2.5 px-4 text-right font-medium">{sprzedazFiltr.length}</td>
                      <td className="py-2.5 px-4 text-right font-medium">{fmt(totalLitry)}</td>
                      <td className="py-2.5 px-4 text-right font-medium">{fmt(totalBrutto)} zł</td>
                      <td className="py-2.5 px-4 text-right font-medium text-blue-600">{fmt(sprzedazFiltr.filter(s=>s.forma_platnosci==='przelew').reduce((a,s)=>a+s.ilosc_litry*s.cena_sprzedazy,0))} zł</td>
                      <td className="py-2.5 px-4 text-right font-medium text-yellow-600">{fmt(sprzedazFiltr.filter(s=>s.forma_platnosci==='gotowka').reduce((a,s)=>a+s.ilosc_litry*s.cena_sprzedazy,0))} zł</td>
                      <td className="py-2.5 px-4 text-right font-medium text-green-600">{fmt(sprzedazFiltr.filter(s=>s.forma_platnosci==='karta').reduce((a,s)=>a+s.ilosc_litry*s.cena_sprzedazy,0))} zł</td>
                      <td className="py-2.5 px-4 text-right font-medium">{fmt(totalMarza)} zł</td>
                      <td className="py-2.5 px-4 text-right font-medium">{totalBrutto > 0 ? (totalMarza / totalBrutto * 100).toFixed(1) : 0}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {tab === 'edd' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <SortTh label="Nr EDD" field="nr_edd" sort={sortEDD} setSort={setSortEDD} />
                      <SortTh label="Dostawca" field="dostawca" sort={sortEDD} setSort={setSortEDD} />
                      <SortTh label="Wsp. konwersji" field="wsp" sort={sortEDD} setSort={setSortEDD} right />
                      <SortTh label="Litry" field="litry" sort={sortEDD} setSort={setSortEDD} right />
                      <SortTh label="Sprzedaż brutto" field="brutto" sort={sortEDD} setSort={setSortEDD} right />
                      <SortTh label="Marża brutto" field="marza" sort={sortEDD} setSort={setSortEDD} right />
                    </tr>
                  </thead>
                  <tbody>
                    {sortuj(wgEDD, sortEDD.f, sortEDD.d).map(r => (
                      <tr key={r.nr_edd} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-4 font-mono text-xs">{r.nr_edd}</td>
                        <td className="py-2.5 px-4 text-gray-500">{r.dostawca}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs">{r.wsp.toFixed(4)}</td>
                        <td className="py-2.5 px-4 text-right">{fmt(r.litry)}</td>
                        <td className="py-2.5 px-4 text-right">{fmt(r.brutto)} zł</td>
                        <td className="py-2.5 px-4 text-right">{fmt(r.marza)} zł</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'dobowy' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <SortTh label="Data" field="data" sort={sortDobowy} setSort={setSortDobowy} />
                      <SortTh label="Trans." field="transakcji" sort={sortDobowy} setSort={setSortDobowy} right />
                      <SortTh label="Litry" field="litry" sort={sortDobowy} setSort={setSortDobowy} right />
                      <SortTh label="Sprzedaż brutto" field="brutto" sort={sortDobowy} setSort={setSortDobowy} right />
                      <SortTh label="🧾 Paragony" field="paragon_brutto" sort={sortDobowy} setSort={setSortDobowy} right />
                      <SortTh label="📄 Faktury" field="faktura_brutto" sort={sortDobowy} setSort={setSortDobowy} right />
                      <SortTh label="👤 F.Imienne" field="faktura_imienna_brutto" sort={sortDobowy} setSort={setSortDobowy} right />
                      <SortTh label="Marża brutto" field="marza" sort={sortDobowy} setSort={setSortDobowy} right />
                    </tr>
                  </thead>
                  <tbody>
                    {sortuj(wgDnia, sortDobowy.f, sortDobowy.d).map(r => (
                      <tr key={r.data} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-4">{fmtDate(r.data)}</td>
                        <td className="py-2.5 px-4 text-right">{r.transakcji}</td>
                        <td className="py-2.5 px-4 text-right">{fmt(r.litry)}</td>
                        <td className="py-2.5 px-4 text-right font-medium">{fmt(r.brutto)} zł</td>
                        <td className="py-2.5 px-4 text-right text-gray-500">{r.paragon > 0 ? `${fmt(r.paragon_brutto)} zł (${r.paragon})` : '—'}</td>
                        <td className="py-2.5 px-4 text-right text-blue-600">{r.faktura > 0 ? `${fmt(r.faktura_brutto)} zł (${r.faktura})` : '—'}</td>
                        <td className="py-2.5 px-4 text-right text-purple-600">{r.faktura_imienna > 0 ? `${fmt(r.faktura_imienna_brutto)} zł (${r.faktura_imienna})` : '—'}</td>
                        <td className="py-2.5 px-4 text-right">{fmt(r.marza)} zł</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Razem</td>
                      <td className="py-2.5 px-4 text-right font-medium">{sprzedazFiltr.length}</td>
                      <td className="py-2.5 px-4 text-right font-medium">{fmt(totalLitry)}</td>
                      <td className="py-2.5 px-4 text-right font-medium">{fmt(totalBrutto)} zł</td>
                      <td className="py-2.5 px-4 text-right font-medium text-gray-600">
                        {fmt(sprzedazFiltr.filter(s=>(s.rodzaj_dokumentu||(s.forma_sprzedazy==='faktura_vat'?'faktura':'paragon'))==='paragon').reduce((a,s)=>a+s.ilosc_litry*s.cena_sprzedazy,0))} zł
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-blue-600">
                        {fmt(sprzedazFiltr.filter(s=>(s.rodzaj_dokumentu||(s.forma_sprzedazy==='faktura_vat'?'faktura':'paragon'))==='faktura').reduce((a,s)=>a+s.ilosc_litry*s.cena_sprzedazy,0))} zł
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-purple-600">
                        {fmt(sprzedazFiltr.filter(s=>(s.rodzaj_dokumentu||'')==='faktura_imienna').reduce((a,s)=>a+s.ilosc_litry*s.cena_sprzedazy,0))} zł
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium">{fmt(totalMarza)} zł</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {tab === 'platnosc' && (() => {
            const grupy: Record<string, {label: string, icon: string, kolor: string, bg: string}> = {
              przelew:  { label: 'Przelew bankowy', icon: '🏦', kolor: 'text-blue-700', bg: 'bg-blue-50' },
              gotowka:  { label: 'Gotówka',          icon: '💵', kolor: 'text-yellow-700', bg: 'bg-yellow-50' },
              karta:    { label: 'Karta płatnicza',  icon: '💳', kolor: 'text-green-700', bg: 'bg-green-50' },
            }
            const formy = ['przelew','gotowka','karta']
            return (
              <div className="space-y-4">
                {formy.map(forma => {
                  const rows = sprzedazFiltr.filter(s => s.forma_platnosci === forma)
                  if (rows.length === 0) return null
                  const sumBrutto = rows.reduce((a, s) => a + s.ilosc_litry * s.cena_sprzedazy, 0)
                  const sumLitry  = rows.reduce((a, s) => a + s.ilosc_litry, 0)
                  const g = grupy[forma]
                  return (
                    <div key={forma} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className={`px-4 py-3 ${g.bg} border-b border-gray-100 flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{g.icon}</span>
                          <span className={`font-semibold ${g.kolor}`}>{g.label}</span>
                          <span className="text-xs text-gray-500">· {rows.length} transakcji</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-gray-900">{fmt(sumBrutto)} zł</span>
                          <span className="text-xs text-gray-500 ml-2">{fmt(sumLitry)} l</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                              <th className="py-2 px-4 text-left text-xs text-gray-500">Data</th>
                              <th className="py-2 px-4 text-left text-xs text-gray-500">Klient</th>
                              <th className="py-2 px-4 text-left text-xs text-gray-500">Nr EDD</th>
                              <th className="py-2 px-4 text-right text-xs text-gray-500">Litry</th>
                              <th className="py-2 px-4 text-right text-xs text-gray-500">Brutto</th>
                              <th className="py-2 px-4 text-left text-xs text-gray-500">Dok.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(s => (
                              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-2 px-4 text-xs">{fmtDate(s.data_sprzedazy)}</td>
                                <td className="py-2 px-4 text-xs text-gray-700">{s.klienci?.nazwa ?? '—'}</td>
                                <td className="py-2 px-4 text-xs font-mono text-gray-500">{s.nr_edd}</td>
                                <td className="py-2 px-4 text-right text-xs">{fmt(s.ilosc_litry)}</td>
                                <td className="py-2 px-4 text-right text-xs font-medium">{fmt(s.ilosc_litry * s.cena_sprzedazy)} zł</td>
                                <td className="py-2 px-4 text-xs">
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${s.forma_sprzedazy === 'faktura_vat' ? 'bg-blue-100 text-blue-700' : s.forma_sprzedazy === 'faktura_imienna' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {s.forma_sprzedazy === 'faktura_vat' ? 'FV' : s.forma_sprzedazy === 'faktura_imienna' ? 'FI' : 'PAR'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                            <tr>
                              <td colSpan={3} className="py-2 px-4 text-xs font-medium text-gray-500">Razem {g.label}</td>
                              <td className="py-2 px-4 text-right text-xs font-bold">{fmt(sumLitry)}</td>
                              <td className="py-2 px-4 text-right text-xs font-bold">{fmt(sumBrutto)} zł</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {tab === 'marza' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { l: 'Marża brutto łącznie', v: fmt(totalMarza) + ' zł', opis: 'Sprzedaż − koszt zakupu', c: 'bg-green-50 border-green-200' },
                  { l: 'Marża na transporcie', v: fmt(totalMarza / 2) + ' zł', opis: 'Marża brutto / 2', c: 'bg-blue-50 border-blue-200' },
                  { l: 'Średnia marża %', v: totalBrutto > 0 ? (totalMarza / totalBrutto * 100).toFixed(1) + '%' : '—', opis: 'Marża / sprzedaż brutto', c: 'bg-purple-50 border-purple-200' },
                ].map(k => (
                  <div key={k.l} className={`rounded-xl border p-5 ${k.c}`}>
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">{k.l}</p>
                    <p className="text-2xl font-medium text-gray-900 mb-1">{k.v}</p>
                    <p className="text-xs text-gray-500">{k.opis}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className={`${thCls} text-left`}>Klient</th>
                        <th className={`${thCls} text-right`}>Litry</th>
                        <th className={`${thCls} text-right`}>Sprzedaż brutto</th>
                        <th className={`${thCls} text-right`}>Koszt brutto</th>
                        <th className={`${thCls} text-right`}>Marża brutto</th>
                        <th className={`${thCls} text-right`}>Marża transport</th>
                        <th className={`${thCls} text-right`}>Marża %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wgKlienta.map(r => {
                        const koszt = r.brutto - r.marza
                        return (
                          <tr key={r.nazwa} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2.5 px-4 font-medium">{r.nazwa}</td>
                            <td className="py-2.5 px-4 text-right">{fmt(r.litry)}</td>
                            <td className="py-2.5 px-4 text-right">{fmt(r.brutto)} zł</td>
                            <td className="py-2.5 px-4 text-right text-gray-500">{fmt(koszt)} zł</td>
                            <td className="py-2.5 px-4 text-right">{fmt(r.marza)} zł</td>
                            <td className="py-2.5 px-4 text-right text-blue-700">{fmt(r.marza / 2)} zł</td>
                            <td className="py-2.5 px-4 text-right">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.marza / r.brutto > 0.15 ? 'bg-green-50 text-green-700' : r.marza / r.brutto > 0.05 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                                {r.brutto > 0 ? (r.marza / r.brutto * 100).toFixed(1) : 0}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {/* Pływający przycisk czatu */}
      <CzatPanel modul="raporty" compact />

      </div>
    </div>
  )
}
