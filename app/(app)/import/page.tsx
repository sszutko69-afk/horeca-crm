'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import * as XLSX from 'xlsx'

type Tab = 'klienci' | 'sprzedaz' | 'zakupy' | 'czyszczenie'

type WierszKlienta = {
  nazwa: string; typ: string; nip: string; adres: string; miasto: string
  kod_pocztowy: string; telefon: string; email: string; uwagi: string
}
type WierszSprzedazy = {
  data: string; klient: string; nr_faktury: string; opis: string
  netto: number; brutto: number; forma: string; platnosc: string; status: string
}
type WierszZakupu = {
  data: string; dostawca: string; nr_faktury: string; kategoria: string
  opis: string; netto: number; brutto: number
}
type DuplikatKlienta = { istniejacy: any; nowy: string }

const SZABLONY: Record<Exclude<Tab, 'czyszczenie'>, { arkusz: string; plik: string; naglowki: string[]; przyklad: (string | number)[][] }> = {
  klienci: {
    arkusz: 'Klienci', plik: 'szablon-klienci.xlsx',
    naglowki: ['Nazwa', 'Typ (firma/osoba)', 'NIP', 'Adres', 'Miasto', 'Kod pocztowy', 'Telefon', 'Email', 'Uwagi'],
    przyklad: [
      ['Restauracja Pod Lipą', 'firma', '5260002222', 'ul. Lipowa 12', 'Kraków', '31-001', '12 421 1212', 'kontakt@podlipa.pl', 'Stały klient'],
      ['Jan Kowalski', 'osoba', '', 'ul. Słoneczna 4', 'Warszawa', '00-100', '600 100 200', 'jan@example.com', 'Urodziny'],
    ],
  },
  sprzedaz: {
    arkusz: 'Sprzedaż', plik: 'szablon-sprzedaz.xlsx',
    naglowki: ['Data', 'Klient', 'Nr faktury', 'Opis usługi', 'Kwota netto', 'Kwota brutto', 'Forma sprzedaży (Faktura VAT/Paragon)', 'Płatność (przelew/karta/gotówka)', 'Status (opłacona/oczekuje/zaległa)'],
    przyklad: [
      ['2026-11-08', 'Hotel Marriott Warszawa', 'FV/2026/11/001', 'Catering konferencja', 7800, 9594, 'Faktura VAT', 'przelew', 'opłacona'],
      ['2026-11-07', 'Jan Kowalski', '', 'Urodziny — 12 osób', 1479.67, 1820, 'Paragon', 'karta', 'opłacona'],
    ],
  },
  zakupy: {
    arkusz: 'Zakupy', plik: 'szablon-zakupy.xlsx',
    naglowki: ['Data', 'Dostawca', 'Nr faktury', 'Kategoria', 'Opis', 'Wartość netto', 'Wartość brutto'],
    przyklad: [
      ['2026-11-08', 'Hurtownia Spożywcza "Mazur"', 'FZ/2026/11/001', 'Mięso i wędliny', 'Schab, kurczak — 45 kg', 1900, 2337],
      ['2026-11-07', 'Winnica Polska Sp. z o.o.', 'FZ/2026/11/002', 'Alkohole i wina', 'Wino — 24 butelki', 1020, 1254],
    ],
  },
}

function excelDateToISO(val: any): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(val).trim()
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return s.split('T')[0]
}

function num(val: any): number {
  if (typeof val === 'number') return val
  if (val == null || val === '') return NaN
  return parseFloat(String(val).replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-]/g, ''))
}

function normalizujNazwe(n: string): string {
  return n.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,\-"]/g, '')
}

function podobienstwo(a: string, b: string): number {
  const na = normalizujNazwe(a), nb = normalizujNazwe(b)
  if (na === nb) return 1
  if (na.length === 0 || nb.length === 0) return 0
  const dp = Array.from({ length: na.length + 1 }, (_, i) =>
    Array.from({ length: nb.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  )
  for (let i = 1; i <= na.length; i++)
    for (let j = 1; j <= nb.length; j++)
      dp[i][j] = na[i - 1] === nb[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return 1 - dp[na.length][nb.length] / Math.max(na.length, nb.length)
}

function findCol(header: string[], ...keys: string[]) {
  return header.findIndex(h => keys.some(k => h.includes(k)))
}

function pickSheet(wb: XLSX.WorkBook, ...keys: string[]) {
  return wb.SheetNames.find(n => keys.some(k => n.toLowerCase().includes(k))) ?? wb.SheetNames[0]
}

export default function ImportPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('klienci')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [parsedData, setParsedData] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const [duplikaty, setDuplikaty] = useState<DuplikatKlienta[]>([])
  const [showDedupModal, setShowDedupModal] = useState(false)
  const [dedupDecisions, setDedupDecisions] = useState<Record<string, string>>({})

  const [czyszczenieStat, setCzyszczenieStat] = useState<any>(null)
  const [czyszczonoLoading, setCzyszczonoLoading] = useState(false)
  const [potwierdzCzyszczenie, setPotwierdzCzyszczenie] = useState<string | null>(null)

  function reset() {
    setPreview([]); setErrors([]); setSuccess('')
    setParsedData([]); setTotalRows(0); setImportProgress(0)
    setDuplikaty([]); setShowDedupModal(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function pobierzSzablon() {
    if (tab === 'czyszczenie') return
    const s = SZABLONY[tab]
    const ws = XLSX.utils.aoa_to_sheet([s.naglowki, ...s.przyklad])
    ws['!cols'] = s.naglowki.map(() => ({ wch: 24 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, s.arkusz)
    XLSX.writeFile(wb, s.plik)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setErrors([]); setSuccess(''); setPreview([]); setParsedData([])

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { cellDates: true })
      const err: string[] = []

      if (tab === 'klienci') {
        const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[pickSheet(wb, 'klient', 'goś', 'gosc')], { header: 1 })
        const header = (rows[0] ?? []).map(h => String(h ?? '').toLowerCase())
        const iNazwa = findCol(header, 'nazwa', 'klient', 'imię', 'imie')
        const iTyp = findCol(header, 'typ')
        const iNip = findCol(header, 'nip')
        const iAdres = findCol(header, 'adres', 'ulica')
        const iMiasto = findCol(header, 'miasto')
        const iKod = findCol(header, 'kod')
        const iTel = findCol(header, 'telefon', 'tel')
        const iEmail = findCol(header, 'email', 'e-mail', 'mail')
        const iUwagi = findCol(header, 'uwagi', 'notatk')
        if (iNazwa < 0) throw new Error('Nie znaleziono kolumny "Nazwa". Pobierz szablon i użyj jego nagłówków.')
        const wyniki: WierszKlienta[] = []
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i]
          const nazwa = String(r?.[iNazwa] ?? '').trim()
          if (!nazwa) continue
          const typRaw = String(r[iTyp] ?? '').toLowerCase()
          const nip = String(r[iNip] ?? '').replace(/\D/g, '')
          wyniki.push({
            nazwa,
            typ: typRaw.startsWith('o') ? 'osoba_fizyczna' : typRaw.startsWith('f') || nip ? 'firma' : 'osoba_fizyczna',
            nip, adres: String(r[iAdres] ?? '').trim(), miasto: String(r[iMiasto] ?? '').trim(),
            kod_pocztowy: String(r[iKod] ?? '').trim(), telefon: String(r[iTel] ?? '').trim(),
            email: String(r[iEmail] ?? '').trim(), uwagi: String(r[iUwagi] ?? '').trim(),
          })
        }
        setParsedData(wyniki); setTotalRows(wyniki.length); setPreview(wyniki.slice(0, 15)); setErrors(err)
        if (wyniki.length) setSuccess(`Znaleziono ${wyniki.length} klientów. Kliknij "Sprawdź duplikaty i importuj".`)
      } else if (tab === 'sprzedaz') {
        const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[pickSheet(wb, 'sprzeda', 'faktur')], { header: 1 })
        const header = (rows[0] ?? []).map(h => String(h ?? '').toLowerCase())
        const iData = findCol(header, 'data')
        const iKlient = findCol(header, 'klient', 'nabywca')
        const iNr = findCol(header, 'nr faktury', 'numer', 'faktur')
        const iOpis = findCol(header, 'opis', 'usług', 'uslug')
        const iNetto = findCol(header, 'netto')
        const iBrutto = findCol(header, 'brutto')
        const iForma = findCol(header, 'forma')
        const iPlat = findCol(header, 'płatno', 'platno')
        const iStatus = findCol(header, 'status')
        if (iData < 0 || iKlient < 0 || (iNetto < 0 && iBrutto < 0))
          throw new Error('Wymagane kolumny: Data, Klient, Kwota netto lub brutto. Pobierz szablon.')
        const wyniki: WierszSprzedazy[] = []
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i]
          if (!r?.[iData]) continue
          let netto = iNetto >= 0 ? num(r[iNetto]) : NaN
          let brutto = iBrutto >= 0 ? num(r[iBrutto]) : NaN
          if (isNaN(netto) && isNaN(brutto)) { err.push(`Wiersz ${i + 1}: błędne kwoty`); continue }
          if (isNaN(brutto)) brutto = Math.round(netto * 1.23 * 100) / 100
          if (isNaN(netto)) netto = Math.round(brutto / 1.23 * 100) / 100
          const forma = String(r[iForma] ?? 'Faktura VAT').toLowerCase()
          const st = String(r[iStatus] ?? 'opłacona').toLowerCase()
          wyniki.push({
            data: excelDateToISO(r[iData]), klient: String(r[iKlient] ?? '').trim(),
            nr_faktury: String(r[iNr] ?? '').trim(), opis: String(r[iOpis] ?? '').trim(),
            netto, brutto,
            forma: forma.includes('paragon') ? 'paragon' : 'faktura_vat',
            platnosc: String(r[iPlat] ?? 'przelew').toLowerCase().replace('ó', 'o').replace('ć', 'c') || 'przelew',
            status: st.includes('zaleg') || st.includes('zaległ') ? 'zalegla' : st.includes('oczek') ? 'oczekuje' : 'oplacona',
          })
        }
        setParsedData(wyniki); setTotalRows(wyniki.length); setPreview(wyniki.slice(0, 15)); setErrors(err)
        if (wyniki.length) setSuccess(`Znaleziono ${wyniki.length} faktur. Kliknij "Sprawdź duplikaty i importuj".`)
      } else if (tab === 'zakupy') {
        const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[pickSheet(wb, 'zakup')], { header: 1 })
        const header = (rows[0] ?? []).map(h => String(h ?? '').toLowerCase())
        const iData = findCol(header, 'data')
        const iDost = findCol(header, 'dostawc')
        const iNr = findCol(header, 'nr faktury', 'numer', 'faktur')
        const iKat = findCol(header, 'kategor')
        const iOpis = findCol(header, 'opis')
        const iNetto = findCol(header, 'netto')
        const iBrutto = findCol(header, 'brutto')
        if (iData < 0 || iDost < 0 || (iNetto < 0 && iBrutto < 0))
          throw new Error('Wymagane kolumny: Data, Dostawca, Wartość netto lub brutto. Pobierz szablon.')
        const wyniki: WierszZakupu[] = []
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i]
          if (!r?.[iData]) continue
          let netto = iNetto >= 0 ? num(r[iNetto]) : NaN
          let brutto = iBrutto >= 0 ? num(r[iBrutto]) : NaN
          if (isNaN(netto) && isNaN(brutto)) { err.push(`Wiersz ${i + 1}: błędne kwoty`); continue }
          if (isNaN(brutto)) brutto = Math.round(netto * 1.23 * 100) / 100
          if (isNaN(netto)) netto = Math.round(brutto / 1.23 * 100) / 100
          wyniki.push({
            data: excelDateToISO(r[iData]), dostawca: String(r[iDost] ?? '').trim(),
            nr_faktury: String(r[iNr] ?? '').trim(), kategoria: String(r[iKat] ?? 'Inne').trim() || 'Inne',
            opis: String(r[iOpis] ?? '').trim(), netto, brutto,
          })
        }
        setParsedData(wyniki); setTotalRows(wyniki.length); setPreview(wyniki.slice(0, 15)); setErrors(err)
        if (wyniki.length) setSuccess(`Znaleziono ${wyniki.length} zakupów. Kliknij "Importuj".`)
      }
    } catch (ex: any) { setErrors([ex.message]) }
    setLoading(false)
  }

  async function sprawdzDuplikaty() {
    if (!parsedData.length) return
    setLoading(true)
    const { data: istn } = await supabase.from('klienci').select('id, nazwa')
    const klMap = new Map<string, any>()
    ;(istn ?? []).forEach((k: any) => klMap.set(normalizujNazwe(k.nazwa), k))

    const nazwy = tab === 'klienci'
      ? (parsedData as WierszKlienta[]).map(r => r.nazwa)
      : (parsedData as WierszSprzedazy[]).map(r => r.klient)
    const unikalne = [...new Set(nazwy.filter(Boolean))]
    const found: DuplikatKlienta[] = []
    const decisions: Record<string, string> = {}

    for (const nowa of unikalne) {
      const norm = normalizujNazwe(nowa)
      if (klMap.has(norm)) { decisions[nowa] = klMap.get(norm).id; continue }
      let best: any = null; let bestP = 0
      for (const [n, k] of klMap) {
        const p = podobienstwo(norm, n)
        if (p > bestP) { bestP = p; best = k }
      }
      if (bestP >= 0.85) { found.push({ istniejacy: best, nowy: nowa }); decisions[nowa] = best.id }
      else decisions[nowa] = 'nowy'
    }

    setDuplikaty(found); setDedupDecisions(decisions); setLoading(false)
    if (found.length > 0) setShowDedupModal(true)
    else await (tab === 'klienci' ? handleImportKlienci(decisions) : handleImportSprzedaz(decisions))
  }

  async function handleImportKlienci(decisions: Record<string, string>) {
    setImporting(true); setErrors([]); setImportProgress(0); setShowDedupModal(false)
    const rows = parsedData as WierszKlienta[]
    const doWstawienia = rows.filter(r => decisions[r.nazwa] === 'nowy' || decisions[r.nazwa] === undefined)
    const pominiete = rows.length - doWstawienia.length
    const rekordy = doWstawienia.map(r => ({
      nazwa: r.nazwa, typ: r.typ, nip: r.nip || null, adres: r.adres || null, miasto: r.miasto || null,
      kod_pocztowy: r.kod_pocztowy || null, telefon: r.telefon || null, email: r.email || null,
      uwagi: r.uwagi || null, aktywny: true,
    }))
    let imported = 0
    for (let i = 0; i < rekordy.length; i += 100) {
      const { error } = await supabase.from('klienci').insert(rekordy.slice(i, i + 100))
      if (!error) imported += Math.min(100, rekordy.length - i)
      else setErrors(prev => [...prev, `Partia ${i}: ${error.message}`])
      setImportProgress(Math.min(100, Math.round((i + 100) / rekordy.length * 100)))
    }
    setSuccess(`✓ Zaimportowano ${imported} klientów. Pominięto ${pominiete} (już istnieją w bazie).`)
    setParsedData([]); setPreview([]); setTotalRows(0)
    if (fileRef.current) fileRef.current.value = ''
    setImporting(false)
  }

  async function handleImportSprzedaz(decisions: Record<string, string>) {
    setImporting(true); setErrors([]); setImportProgress(0); setShowDedupModal(false)
    const rows = parsedData as WierszSprzedazy[]

    const klMap: Record<string, string> = {}
    for (const [nazwa, decyzja] of Object.entries(decisions)) {
      if (decyzja !== 'nowy') { klMap[nazwa] = decyzja; continue }
      const { data: nowy } = await supabase.from('klienci').insert({
        nazwa, typ: 'osoba_fizyczna', aktywny: true,
      }).select('id').single()
      if (nowy) klMap[nazwa] = nowy.id
    }

    const rekordy = rows.map(r => ({
      data_sprzedazy: r.data, klient_id: klMap[r.klient] ?? null,
      nr_faktury: r.nr_faktury || null, opis: r.opis || null,
      kwota_netto: r.netto, kwota_brutto: r.brutto,
      forma_sprzedazy: r.forma, forma_platnosci: r.platnosc, status: r.status,
    }))

    let imported = 0
    for (let i = 0; i < rekordy.length; i += 100) {
      const { error } = await supabase.from('sprzedaz').insert(rekordy.slice(i, i + 100))
      if (!error) imported += Math.min(100, rekordy.length - i)
      else setErrors(prev => [...prev, `Partia ${i}: ${error.message}`])
      setImportProgress(Math.min(100, Math.round((i + 100) / rekordy.length * 100)))
    }
    setSuccess(`✓ Zaimportowano ${imported} faktur sprzedaży (${Object.values(decisions).filter(d => d === 'nowy').length} nowych klientów).`)
    setParsedData([]); setPreview([]); setTotalRows(0)
    if (fileRef.current) fileRef.current.value = ''
    setImporting(false)
  }

  async function handleImportZakupy() {
    if (!parsedData.length) return
    setImporting(true); setErrors([]); setImportProgress(0)
    const rows = parsedData as WierszZakupu[]

    const { data: istn } = await supabase.from('zakupy').select('nr_faktury')
    const nrSet = new Set((istn ?? []).map((z: any) => z.nr_faktury).filter(Boolean))
    const nowe = rows.filter(r => !r.nr_faktury || !nrSet.has(r.nr_faktury))
    const duplik = rows.length - nowe.length
    if (duplik > 0) setErrors([`Pominięto ${duplik} zakupów — numer faktury już istnieje w bazie.`])

    const rekordy = nowe.map(r => ({
      data_zakupu: r.data, dostawca: r.dostawca, nr_faktury: r.nr_faktury || null,
      kategoria: r.kategoria, opis: r.opis || null,
      wartosc_netto: r.netto, wartosc_brutto: r.brutto, status: 'zatwierdzona',
    }))
    let imported = 0
    for (let i = 0; i < rekordy.length; i += 100) {
      const { error } = await supabase.from('zakupy').insert(rekordy.slice(i, i + 100))
      if (!error) imported += Math.min(100, rekordy.length - i)
      else setErrors(prev => [...prev, `Partia ${i}: ${error.message}`])
      setImportProgress(Math.min(100, Math.round((i + 100) / rekordy.length * 100)))
    }
    setSuccess(`✓ Zaimportowano ${imported} zakupów (${duplik} pominiętych duplikatów).`)
    setParsedData([]); setPreview([]); setTotalRows(0)
    if (fileRef.current) fileRef.current.value = ''
    setImporting(false)
  }

  async function wczytajStatCzyszczenia() {
    setCzyszczonoLoading(true)
    const [{ count: kl }, { count: sp }, { count: zk }] = await Promise.all([
      supabase.from('klienci').select('*', { count: 'exact', head: true }),
      supabase.from('sprzedaz').select('*', { count: 'exact', head: true }),
      supabase.from('zakupy').select('*', { count: 'exact', head: true }),
    ])
    const { data: klienci } = await supabase.from('klienci').select('id, nazwa').order('nazwa')
    const mapa = new Map<string, any[]>()
    ;(klienci ?? []).forEach((k: any) => {
      const n = normalizujNazwe(k.nazwa)
      if (!mapa.has(n)) mapa.set(n, [])
      mapa.get(n)!.push(k)
    })
    setCzyszczenieStat({ klienci: kl, sprzedaz: sp, zakupy: zk, duplikatKlienci: [...mapa.values()].filter(g => g.length > 1) })
    setCzyszczonoLoading(false)
  }

  async function wyczyscTabele(tabela: string) {
    setPotwierdzCzyszczenie(null); setCzyszczonoLoading(true)
    try {
      const { error } = await supabase.rpc(`truncate_${tabela}`)
      if (error) throw new Error(error.message)
      await wczytajStatCzyszczenia()
      setSuccess(`✓ Tabela "${tabela}" wyczyszczona. Możesz teraz importować od nowa.`)
      setTimeout(() => setSuccess(''), 4000)
    } catch (e: any) {
      setErrors([`Błąd czyszczenia: ${e.message}`])
    }
    setCzyszczonoLoading(false)
  }

  const TH = 'text-left py-2 px-3 text-gray-400 font-medium whitespace-nowrap'
  const fmtZl = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-900">Import danych</h1>
        <p className="text-sm text-gray-500 mt-0.5">Importuj klientów, faktury sprzedaży i zakupy z Excela lub Google Sheets (.xlsx)</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {[
          { key: 'klienci', label: 'Klienci i goście' },
          { key: 'sprzedaz', label: 'Faktury sprzedaży' },
          { key: 'zakupy', label: 'Zakupy od dostawców' },
          { key: 'czyszczenie', label: '🗑 Zarządzanie bazą' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as Tab); reset() }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'czyszczenie' && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-xs text-blue-800 space-y-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <p className="font-medium">Format pliku</p>
                <p>Kolumny: <span className="font-mono bg-blue-100 px-1 rounded">{SZABLONY[tab].naglowki.join(' · ')}</span></p>
                <p className="text-blue-600">Z Google Sheets: <span className="font-mono">Plik → Pobierz → Microsoft Excel (.xlsx)</span></p>
                {tab === 'klienci' && <p className="text-blue-600">Klienci już istniejący w bazie (ta sama lub bardzo podobna nazwa) są wykrywani i pomijani.</p>}
                {tab === 'sprzedaz' && <p className="text-blue-600">Klienci z pliku są dopasowywani do bazy; brakujący zostaną utworzeni. Brak kwoty brutto = netto + 23% VAT.</p>}
                {tab === 'zakupy' && <p className="text-blue-600">Zakupy z istniejącym numerem faktury są automatycznie pomijane.</p>}
              </div>
              <button onClick={pobierzSzablon}
                className="text-xs bg-white border border-blue-300 text-blue-700 rounded-lg px-3 py-1.5 hover:bg-blue-100 whitespace-nowrap">
                ⬇ Pobierz szablon .xlsx
              </button>
            </div>
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
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Podgląd (pierwsze 15 z {totalRows})</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {(tab === 'klienci' ? ['Nazwa', 'Typ', 'NIP', 'Miasto', 'Telefon', 'Email']
                          : tab === 'sprzedaz' ? ['Data', 'Klient', 'Nr faktury', 'Opis', 'Netto', 'Brutto', 'Forma', 'Status']
                          : ['Data', 'Dostawca', 'Nr faktury', 'Kategoria', 'Opis', 'Netto', 'Brutto']
                        ).map(h => <th key={h} className={TH}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          {tab === 'klienci' ? <>
                            <td className="py-1.5 px-3 font-medium">{r.nazwa}</td>
                            <td className="py-1.5 px-3">{r.typ === 'firma' ? 'Firma' : 'Osoba'}</td>
                            <td className="py-1.5 px-3 font-mono text-gray-400">{r.nip || '—'}</td>
                            <td className="py-1.5 px-3">{r.miasto || '—'}</td>
                            <td className="py-1.5 px-3">{r.telefon || '—'}</td>
                            <td className="py-1.5 px-3">{r.email || '—'}</td>
                          </> : tab === 'sprzedaz' ? <>
                            <td className="py-1.5 px-3 whitespace-nowrap">{r.data}</td>
                            <td className="py-1.5 px-3 font-medium max-w-[150px] truncate">{r.klient}</td>
                            <td className="py-1.5 px-3 font-mono text-gray-400">{r.nr_faktury || '—'}</td>
                            <td className="py-1.5 px-3 max-w-[160px] truncate">{r.opis || '—'}</td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap">{fmtZl(r.netto)}</td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap">{fmtZl(r.brutto)}</td>
                            <td className="py-1.5 px-3">{r.forma === 'paragon' ? 'Paragon' : 'Faktura VAT'}</td>
                            <td className="py-1.5 px-3">{r.status}</td>
                          </> : <>
                            <td className="py-1.5 px-3 whitespace-nowrap">{r.data}</td>
                            <td className="py-1.5 px-3 font-medium max-w-[150px] truncate">{r.dostawca}</td>
                            <td className="py-1.5 px-3 font-mono text-gray-400">{r.nr_faktury || '—'}</td>
                            <td className="py-1.5 px-3">{r.kategoria}</td>
                            <td className="py-1.5 px-3 max-w-[160px] truncate">{r.opis || '—'}</td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap">{fmtZl(r.netto)}</td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap">{fmtZl(r.brutto)}</td>
                          </>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={reset} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                {tab === 'zakupy' ? (
                  <button onClick={handleImportZakupy} disabled={importing}
                    className="px-6 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
                    ⬇ Importuj {totalRows} zakupów
                  </button>
                ) : (
                  <button onClick={sprawdzDuplikaty} disabled={importing || loading}
                    className="px-6 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
                    🔍 Sprawdź duplikaty i importuj ({totalRows})
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { l: 'Klienci', v: czyszczenieStat.klienci, t: 'klienci' },
                  { l: 'Faktury sprzedaży', v: czyszczenieStat.sprzedaz, t: 'sprzedaz' },
                  { l: 'Zakupy od dostawców', v: czyszczenieStat.zakupy, t: 'zakupy' },
                ].map(k => (
                  <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.l}</p>
                    <p className="text-lg font-medium text-gray-900 mb-3">{k.v} rekordów</p>
                    <button onClick={() => setPotwierdzCzyszczenie(k.t)}
                      className="text-xs border border-red-200 bg-red-50 text-red-700 px-3 py-1 rounded-lg hover:bg-red-100 transition-colors">
                      🗑 Wyczyść: {k.l}
                    </button>
                  </div>
                ))}
              </div>

              {czyszczenieStat.duplikatKlienci?.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-yellow-800 mb-2">
                    Wykryto {czyszczenieStat.duplikatKlienci.length} grup potencjalnych duplikatów klientów:
                  </p>
                  <div className="space-y-2">
                    {czyszczenieStat.duplikatKlienci.slice(0, 10).map((grupa: any[], i: number) => (
                      <div key={i} className="bg-white border border-yellow-200 rounded-lg p-2">
                        {grupa.map((k: any) => (
                          <div key={k.id} className="flex items-center justify-between text-xs">
                            <span className="font-medium">{k.nazwa}</span>
                            <span className="font-mono text-gray-400">{k.id.slice(0, 8)}…</span>
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

          {errors.length > 0 && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4"><p className="text-xs text-red-700">{errors[0]}</p></div>}
          {success && <div className="bg-green-50 border border-green-200 rounded-xl p-4"><p className="text-xs text-green-800">{success}</p></div>}
        </div>
      )}

      {showDedupModal && duplikaty.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="text-base font-medium text-gray-900 mb-2">Wykryto podobnych klientów</h2>
            <p className="text-xs text-gray-500 mb-4">
              {duplikaty.length} klientów z pliku jest bardzo podobnych do istniejących w bazie. Zdecyduj co zrobić z każdym.
            </p>
            <div className="space-y-3 mb-5">
              {duplikaty.map((d, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Z pliku:</p>
                      <p className="text-sm font-medium text-gray-900">{d.nowy}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-0.5">W bazie:</p>
                      <p className="text-sm font-medium text-blue-700">{d.istniejacy.nazwa}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setDedupDecisions(prev => ({ ...prev, [d.nowy]: d.istniejacy.id }))}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${dedupDecisions[d.nowy] === d.istniejacy.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                      Połącz z istniejącym
                    </button>
                    <button onClick={() => setDedupDecisions(prev => ({ ...prev, [d.nowy]: 'nowy' }))}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${dedupDecisions[d.nowy] === 'nowy' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:bg-gray-50'}`}>
                      Utwórz nowego klienta
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDedupModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={() => tab === 'klienci' ? handleImportKlienci(dedupDecisions) : handleImportSprzedaz(dedupDecisions)}
                className="px-6 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                ✓ Zatwierdź i importuj
              </button>
            </div>
          </div>
        </div>
      )}

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
