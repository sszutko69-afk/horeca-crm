'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import * as XLSX from 'xlsx'

type WierszSprzedazy = {
  data: string; klient: string; nr_edd: string
  litry: number; cena: number; typ: string
}
type WierszZakupu = {
  data: string; nr_edd: string; tony: number
  cena_netto_tona: number; cena_brutto_tona: number
}
type DuplikatKlienta = { istniejacy: any; nowy: string; akcja: 'polacz' | 'nowy' }

function excelDateToISO(val: any): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  return String(val).split('T')[0]
}

function parseFormulaOrNumber(val: any): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string' && val.startsWith('=')) {
    const m = val.match(/(\d+(?:\.\d+)?)\*(\d+(?:\.\d+)?)/)
    if (m) return parseFloat(m[1]) * parseFloat(m[2])
  }
  return parseFloat(val) || 0
}

function getNettoCenaZTony(val: any): number {
  if (typeof val === 'string' && val.startsWith('=')) {
    const m = val.match(/(\d+(?:\.\d+)?)/)
    if (m) return parseFloat(m[1])
  }
  if (typeof val === 'number') return val / 1.23
  return 0
}

// Normalizacja nazwy klienta do porównań
function normalizujNazwe(n: string): string {
  return n.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,\-]/g, '')
}

// Oblicz podobieństwo Levenshteina
function podobienstwo(a: string, b: string): number {
  const na = normalizujNazwe(a), nb = normalizujNazwe(b)
  if (na === nb) return 1
  if (na.length === 0 || nb.length === 0) return 0
  const dp = Array.from({ length: na.length + 1 }, (_, i) =>
    Array.from({ length: nb.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  )
  for (let i = 1; i <= na.length; i++)
    for (let j = 1; j <= nb.length; j++)
      dp[i][j] = na[i-1] === nb[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  const dist = dp[na.length][nb.length]
  return 1 - dist / Math.max(na.length, nb.length)
}

export default function ImportPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'sprzedaz' | 'zakupy' | 'czyszczenie'>('sprzedaz')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [parsedData, setParsedData] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // Deduplikacja
  const [duplikaty, setDuplikaty] = useState<DuplikatKlienta[]>([])
  const [showDedupModal, setShowDedupModal] = useState(false)
  const [dedupDecisions, setDedupDecisions] = useState<Record<string, string>>({}) // nazwa -> id istniejącego lub 'nowy'

  // Czyszczenie bazy
  const [czyszczenieStat, setCzyszczenieStat] = useState<any>(null)
  const [czyszczonoLoading, setCzyszczonoLoading] = useState(false)
  const [potwierdzCzyszczenie, setPotwierdzCzyszczenie] = useState<string | null>(null)

  function reset() {
    setPreview([]); setErrors([]); setSuccess('')
    setParsedData([]); setTotalRows(0); setImportProgress(0)
    setDuplikaty([]); setShowDedupModal(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setErrors([]); setSuccess(''); setPreview([]); setParsedData([])

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)

      if (tab === 'sprzedaz') {
        const wsName = wb.SheetNames.find(n =>
          n.toLowerCase().includes('sprzedaż') || n.toLowerCase().includes('sprzedaz')
        ) ?? wb.SheetNames[0]
        const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1 })
        const header = (rows[0] as string[]).map(h => String(h ?? '').toLowerCase())

        const iData = header.findIndex(h => h.includes('data'))
        const iKlient = header.findIndex(h => h.includes('klient'))
        const iEDD = header.findIndex(h => h.includes('edd'))
        const iLitry = header.findIndex(h => h.includes('litr') || (h.includes('ilość') && !h.includes('tony')))
        const iCena = header.findIndex(h => h.includes('cena') && h.includes('jednostk'))
        const iTyp = header.findIndex(h => h.includes('typ'))

        const wyniki: WierszSprzedazy[] = []
        const err: string[] = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row?.[iData]) continue
          const litry = parseFloat(row[iLitry])
          const cena = parseFloat(row[iCena])
          if (isNaN(litry) || isNaN(cena)) { err.push(`Wiersz ${i+1}: błędne liczby`); continue }
          wyniki.push({
            data: excelDateToISO(row[iData]),
            klient: String(row[iKlient] ?? '').trim(),
            nr_edd: String(row[iEDD] ?? '').trim(),
            litry, cena,
            typ: String(row[iTyp] ?? 'Paragon').trim(),
          })
        }
        setParsedData(wyniki); setTotalRows(wyniki.length); setPreview(wyniki.slice(0, 15)); setErrors(err)
        if (wyniki.length > 0) {
          setSuccess(`Znaleziono ${wyniki.length} wierszy. Kliknij "Sprawdź duplikaty i importuj".`)
        }
      } else if (tab === 'zakupy') {
        const wsName = wb.SheetNames.find(n => n.toLowerCase().includes('zakup')) ?? wb.SheetNames[0]
        const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1 })
        const header = (rows[0] as string[]).map(h => String(h ?? '').toLowerCase())

        const iData = header.findIndex(h => h.includes('data'))
        const iEDD = header.findIndex(h => h.includes('edd'))
        const iTony = header.findIndex(h => h.includes('tony') || (h.includes('ilość') && !h.includes('litr')))
        const iCena = header.findIndex(h => h.includes('cena') && (h.includes('tona') || h.includes('jednostk')))

        const wyniki: WierszZakupu[] = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row?.[iData] || !row?.[iEDD]) continue
          const cenaRaw = row[iCena]
          const cenaBrutto = parseFormulaOrNumber(cenaRaw)
          const cenaNetto = getNettoCenaZTony(cenaRaw)
          wyniki.push({
            data: excelDateToISO(row[iData]),
            nr_edd: String(row[iEDD]).trim(),
            tony: parseFloat(row[iTony]) || 0,
            cena_netto_tona: cenaNetto,
            cena_brutto_tona: cenaBrutto,
          })
        }
        setParsedData(wyniki); setTotalRows(wyniki.length); setPreview(wyniki.slice(0, 15))
        if (wyniki.length > 0) setSuccess(`Znaleziono ${wyniki.length} zakupów. Kliknij "Importuj".`)
      }
    } catch (ex: any) { setErrors([ex.message]) }
    setLoading(false)
  }

  // Sprawdź duplikaty klientów przed importem
  async function sprawdzDuplikaty() {
    if (!parsedData.length || tab !== 'sprzedaz') return
    setLoading(true)

    const { data: istniejacyKlienci } = await supabase.from('klienci').select('id, nazwa')
    const klMap = new Map<string, any>() // normName -> klient
    ;(istniejacyKlienci ?? []).forEach((k: any) => klMap.set(normalizujNazwe(k.nazwa), k))

    const noweNazwy = [...new Set((parsedData as WierszSprzedazy[]).map(r => r.klient).filter(Boolean))]
    const found: DuplikatKlienta[] = []
    const decisions: Record<string, string> = {}

    for (const nowa of noweNazwy) {
      const normNowa = normalizujNazwe(nowa)
      // Dokładne dopasowanie
      if (klMap.has(normNowa)) {
        const k = klMap.get(normNowa)!
        decisions[nowa] = k.id // automatycznie połącz
        continue
      }
      // Szukaj podobnych (>85%)
      let najlepszy: any = null; let najlepszePod = 0
      for (const [normIstn, k] of klMap) {
        const pod = podobienstwo(normNowa, normIstn)
        if (pod > najlepszePod) { najlepszePod = pod; najlepszy = k }
      }
      if (najlepszePod >= 0.85) {
        found.push({ istniejacy: najlepszy, nowy: nowa, akcja: 'polacz' })
        decisions[nowa] = najlepszy.id
      } else {
        decisions[nowa] = 'nowy'
      }
    }

    setDuplikaty(found)
    setDedupDecisions(decisions)
    setLoading(false)

    if (found.length > 0) setShowDedupModal(true)
    else await handleImportSprzedaz(decisions)
  }

  async function handleImportSprzedaz(decisions: Record<string, string>) {
    setImporting(true); setErrors([]); setImportProgress(0); setShowDedupModal(false)
    const rows = parsedData as WierszSprzedazy[]

    // Buduj mapę klientów (tworząc nowych jeśli trzeba)
    const klMap: Record<string, string> = {}
    for (const [nazwa, decyzja] of Object.entries(decisions)) {
      if (decyzja !== 'nowy') {
        klMap[nazwa] = decyzja
      } else {
        const { data: nowy } = await supabase.from('klienci').insert({
          nazwa, typ: 'osoba_fizyczna', aktywny: true
        }).select('id').single()
        if (nowy) klMap[nazwa] = nowy.id
      }
    }

    const rekordy = rows.map(r => ({
      data_sprzedazy: r.data, klient_id: klMap[r.klient] ?? null, nr_edd: r.nr_edd,
      ilosc_litry: r.litry, cena_sprzedazy: r.cena,
      forma_sprzedazy: r.typ === 'Faktura VAT' ? 'faktura_vat' : r.typ === 'Paragon' ? 'paragon' : 'faktura_imienna',
      forma_platnosci: 'gotowka',
    }))

    let imported = 0
    for (let i = 0; i < rekordy.length; i += 100) {
      const { error } = await supabase.from('sprzedaz').insert(rekordy.slice(i, i + 100))
      if (!error) imported += Math.min(100, rekordy.length - i)
      else setErrors(prev => [...prev, `Partia ${i}: ${error.message}`])
      setImportProgress(Math.round((i + 100) / rekordy.length * 100))
    }
    setSuccess(`✓ Zaimportowano ${imported} transakcji! (${Object.values(decisions).filter(d => d === 'nowy').length} nowych klientów)`)
    setParsedData([]); setPreview([]); setTotalRows(0)
    if (fileRef.current) fileRef.current.value = ''
    setImporting(false)
  }

  async function handleImportZakupy() {
    if (!parsedData.length) return
    setImporting(true); setErrors([]); setImportProgress(0)
    const rows = parsedData as WierszZakupu[]

    // Sprawdź czy EDD już istnieje
    const { data: istniejaceEDD } = await supabase.from('zakupy').select('nr_edd')
    const eddSet = new Set((istniejaceEDD ?? []).map((z: any) => z.nr_edd))
    const nowe = rows.filter(r => !eddSet.has(r.nr_edd))
    const duplik = rows.filter(r => eddSet.has(r.nr_edd))

    if (duplik.length > 0) {
      setErrors([`Pominięto ${duplik.length} zakupów — nr EDD już istnieje w bazie: ${duplik.map(r => r.nr_edd.slice(-9)).join(', ')}`])
    }

    const rekordy = nowe.map(r => ({
      data_zakupu: r.data,
      nr_edd: r.nr_edd,
      ilosc_kg: Math.round(r.tony * 1000),
      cena_jednostkowa: r.cena_netto_tona > 0
        ? parseFloat((r.cena_netto_tona / 1000).toFixed(4))
        : parseFloat((r.cena_brutto_tona / 1.23 / 1000).toFixed(4)),
    }))

    let imported = 0
    for (let i = 0; i < rekordy.length; i += 100) {
      const { error } = await supabase.from('zakupy').insert(rekordy.slice(i, i + 100))
      if (!error) imported += Math.min(100, rekordy.length - i)
      setImportProgress(Math.round((i + 100) / rekordy.length * 100))
    }
    setSuccess(`✓ Zaimportowano ${imported} zakupów EDD! Ceny netto/kg. (${duplik.length} pominiętych duplikatów)`)
    setParsedData([]); setPreview([]); setTotalRows(0)
    if (fileRef.current) fileRef.current.value = ''
    setImporting(false)
  }

  // Czyszczenie bazy
  async function wczytajStatCzyszczenia() {
    setCzyszczonoLoading(true)
    const [{ count: kl }, { count: sp }, { count: zk }] = await Promise.all([
      supabase.from('klienci').select('*', { count: 'exact', head: true }),
      supabase.from('sprzedaz').select('*', { count: 'exact', head: true }),
      supabase.from('zakupy').select('*', { count: 'exact', head: true }),
    ])
    // Zduplikowani klienci
    const { data: klienci } = await supabase.from('klienci').select('id, nazwa').order('nazwa')
    const duplikatMap = new Map<string, any[]>()
    ;(klienci ?? []).forEach((k: any) => {
      const norm = normalizujNazwe(k.nazwa)
      if (!duplikatMap.has(norm)) duplikatMap.set(norm, [])
      duplikatMap.get(norm)!.push(k)
    })
    const duplikatKlienci = [...duplikatMap.values()].filter(g => g.length > 1)

    setCzyszczenieStat({ klienci: kl, sprzedaz: sp, zakupy: zk, duplikatKlienci })
    setCzyszczonoLoading(false)
  }

  async function wyczyscTabele(tabela: string) {
    setPotwierdzCzyszczenie(null); setCzyszczonoLoading(true)
    try {
      // Używamy RPC (SECURITY DEFINER) — omija problemy z RLS przy masowym delete
      if (tabela === 'sprzedaz') {
        const { error } = await supabase.rpc('truncate_sprzedaz')
        if (error) throw new Error(error.message)
      } else if (tabela === 'zakupy') {
        const { error } = await supabase.rpc('truncate_zakupy')
        if (error) throw new Error(error.message)
      } else if (tabela === 'klienci') {
        const { error } = await supabase.rpc('truncate_klienci')
        if (error) throw new Error(error.message)
      }
      await wczytajStatCzyszczenia()
      setSuccess(`✓ Tabela "${tabela}" wyczyszczona. Możesz teraz importować od nowa.`)
      setTimeout(() => setSuccess(''), 4000)
    } catch (e: any) {
      setErrors([`Błąd czyszczenia: ${e.message}`])
    }
    setCzyszczonoLoading(false)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-900">Import danych</h1>
        <p className="text-sm text-gray-500 mt-0.5">Importuj dane z Excel lub Google Sheets (.xlsx)</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'sprzedaz', label: 'Sprzedaż gazu' },
          { key: 'zakupy', label: 'Zakupy gazu (EDD)' },
          { key: 'czyszczenie', label: '🗑 Zarządzanie bazą' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as any); reset() }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* === ZAKŁADKA SPRZEDAŻ / ZAKUPY === */}
      {(tab === 'sprzedaz' || tab === 'zakupy') && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-xs text-blue-800 space-y-1">
            <p className="font-medium">Format pliku</p>
            <p>Plik Excel z arkuszami <span className="font-mono bg-blue-100 px-1 rounded">Dane Sprzedaży</span> i <span className="font-mono bg-blue-100 px-1 rounded">Dane Zakupu</span>.</p>
            <p className="text-blue-600">Z Google Sheets: <span className="font-mono">Plik → Pobierz → Microsoft Excel (.xlsx)</span></p>
            {tab === 'sprzedaz' && <p className="text-blue-600">System sprawdza duplikaty klientów przed importem i pyta o decyzję.</p>}
            {tab === 'zakupy' && <p className="text-blue-600">Zakupy z istniejącym nr EDD są automatycznie pomijane (bez duplikatów).</p>}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-blue-300 transition-colors">
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" id="import-file" />
              <label htmlFor="import-file" className="cursor-pointer">
                <div className="text-3xl mb-2">📥</div>
                <p className="text-sm font-medium text-gray-600 mb-1">{loading ? 'Przetwarzanie...' : 'Kliknij aby wybrać plik .xlsx'}</p>
                <p className="text-xs text-gray-400">Excel lub eksport z Google Sheets</p>
              </label>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-medium text-red-800 mb-1">Błędy ({errors.length}):</p>
              {errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-red-700">{e}</p>)}
            </div>
          )}
          {success && <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4"><p className="text-xs text-green-800">{success}</p></div>}
          {importing && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <div className="flex justify-between mb-1"><p className="text-xs text-gray-600">Importowanie...</p><p className="text-xs text-gray-500">{importProgress}%</p></div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${importProgress}%` }}></div></div>
            </div>
          )}

          {preview.length > 0 && (
            <>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Podgląd (pierwsze 15 z {totalRows})</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {tab === 'sprzedaz'
                          ? ['Data','Klient','Nr EDD','Litry','Cena brutto','Typ'].map(h => <th key={h} className="text-left py-2 px-3 text-gray-400 font-medium whitespace-nowrap">{h}</th>)
                          : ['Data','Nr EDD','Tony','Cena netto/t','Cena brutto/t','Cena netto/kg'].map(h => <th key={h} className="text-left py-2 px-3 text-gray-400 font-medium whitespace-nowrap">{h}</th>)
                        }
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          {tab === 'sprzedaz' ? <>
                            <td className="py-1.5 px-3 whitespace-nowrap">{r.data}</td>
                            <td className="py-1.5 px-3 font-medium max-w-[130px] truncate">{r.klient}</td>
                            <td className="py-1.5 px-3 font-mono text-gray-400">{r.nr_edd.slice(0,10)}…</td>
                            <td className="py-1.5 px-3 text-right">{r.litry}</td>
                            <td className="py-1.5 px-3 text-right">{r.cena}</td>
                            <td className="py-1.5 px-3">{r.typ}</td>
                          </> : <>
                            <td className="py-1.5 px-3 whitespace-nowrap">{r.data}</td>
                            <td className="py-1.5 px-3 font-mono text-gray-400">{r.nr_edd.slice(0,10)}…</td>
                            <td className="py-1.5 px-3 text-right">{r.tony}</td>
                            <td className="py-1.5 px-3 text-right">{r.cena_netto_tona.toFixed(2)} zł</td>
                            <td className="py-1.5 px-3 text-right">{r.cena_brutto_tona.toFixed(2)} zł</td>
                            <td className="py-1.5 px-3 text-right font-medium">{(r.cena_netto_tona / 1000).toFixed(4)} zł</td>
                          </>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={reset} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                {tab === 'sprzedaz' ? (
                  <button onClick={sprawdzDuplikaty} disabled={importing || loading}
                    className="px-6 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
                    🔍 Sprawdź duplikaty i importuj ({totalRows})
                  </button>
                ) : (
                  <button onClick={handleImportZakupy} disabled={importing}
                    className="px-6 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
                    ⬇ Importuj {totalRows} zakupów
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* === ZAKŁADKA ZARZĄDZANIE BAZĄ === */}
      {tab === 'czyszczenie' && (
        <div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-xs font-medium text-red-800 mb-1">⚠ Uwaga — operacje nieodwracalne</p>
            <p className="text-xs text-red-700">Wyczyszczenie tabeli usuwa wszystkie dane bezpowrotnie. Przed czyszczeniem zrób backup (moduł Archiwizacja).</p>
          </div>

          {!czyszczenieStat ? (
            <button onClick={wczytajStatCzyszczenia} disabled={czyszczonoLoading}
              className="mb-6 text-sm bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700 disabled:opacity-50">
              {czyszczonoLoading ? 'Wczytywanie...' : 'Wczytaj statystyki bazy'}
            </button>
          ) : (
            <div className="space-y-4 mb-6">
              {/* Statystyki */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: 'Klienci', v: czyszczenieStat.klienci, t: 'klienci' },
                  { l: 'Transakcje sprzedaży', v: czyszczenieStat.sprzedaz, t: 'sprzedaz' },
                  { l: 'Zakupy EDD', v: czyszczenieStat.zakupy, t: 'zakupy' },
                ].map(k => (
                  <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.l}</p>
                    <p className="text-lg font-medium text-gray-900 mb-3">{k.v} rekordów</p>
                    <button onClick={() => setPotwierdzCzyszczenie(k.t)}
                      className="text-xs border border-red-200 bg-red-50 text-red-700 px-3 py-1 rounded-lg hover:bg-red-100 transition-colors">
                      🗑 Wyczyść tabelę {k.l}
                    </button>
                  </div>
                ))}
              </div>

              {/* Duplikaty klientów */}
              {czyszczenieStat.duplikatKlienci?.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-yellow-800 mb-2">
                    Wykryto {czyszczenieStat.duplikatKlienci.length} grup potencjalnych duplikatów klientów:
                  </p>
                  <div className="space-y-2">
                    {czyszczenieStat.duplikatKlienci.slice(0, 10).map((grupa: any[], i: number) => (
                      <div key={i} className="bg-white border border-yellow-200 rounded-lg p-2">
                        <p className="text-xs text-yellow-700 mb-1">Potencjalny duplikat:</p>
                        {grupa.map((k: any) => (
                          <div key={k.id} className="flex items-center justify-between text-xs">
                            <span className="font-medium">{k.nazwa}</span>
                            <span className="font-mono text-gray-400 text-xs">{k.id.slice(0,8)}…</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={wczytajStatCzyszczenia} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-500">↻ Odśwież statystyki</button>
            </div>
          )}

          {success && <div className="bg-green-50 border border-green-200 rounded-xl p-4"><p className="text-xs text-green-800">{success}</p></div>}
        </div>
      )}

      {/* Modal deduplikacji */}
      {showDedupModal && duplikaty.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="text-base font-medium text-gray-900 mb-2">Wykryto podobnych klientów</h2>
            <p className="text-xs text-gray-500 mb-4">
              System znalazł {duplikaty.length} klientów z importu, które są bardzo podobne do istniejących w bazie. Zdecyduj co zrobić z każdym.
            </p>
            <div className="space-y-3 mb-5">
              {duplikaty.map((d, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Importowany:</p>
                      <p className="text-sm font-medium text-gray-900">{d.nowy}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-0.5">Istniejący w bazie:</p>
                      <p className="text-sm font-medium text-blue-700">{d.istniejacy.nazwa}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDedupDecisions(prev => ({ ...prev, [d.nowy]: d.istniejacy.id }))}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${dedupDecisions[d.nowy] === d.istniejacy.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                      Połącz z istniejącym
                    </button>
                    <button
                      onClick={() => setDedupDecisions(prev => ({ ...prev, [d.nowy]: 'nowy' }))}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${dedupDecisions[d.nowy] === 'nowy' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:bg-gray-50'}`}>
                      Utwórz nowego klienta
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDedupModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={() => handleImportSprzedaz(dedupDecisions)}
                className="px-6 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                ✓ Zatwierdź i importuj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal potwierdzenia czyszczenia */}
      {potwierdzCzyszczenie && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-900 mb-2">Wyczyść tabelę</h2>
            <p className="text-sm text-gray-500 mb-1">
              Czy na pewno chcesz usunąć <strong>WSZYSTKIE</strong> dane z tabeli <strong>{potwierdzCzyszczenie}</strong>?
            </p>
            <p className="text-xs text-red-600 mb-5">⚠ Tej operacji nie można cofnąć!</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPotwierdzCzyszczenie(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={() => wyczyscTabele(potwierdzCzyszczenie)} disabled={czyszczonoLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {czyszczonoLoading ? 'Czyszczenie...' : 'Tak, wyczyść'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
