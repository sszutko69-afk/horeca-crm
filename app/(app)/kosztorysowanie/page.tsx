'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import * as XLSX from 'xlsx'

// ── Types ────────────────────────────────────────────────────────────────────

type Kosztorys = {
  id: string; numer: string; nazwa: string; inwestor: string | null
  obiekt: string | null; data_sporzadzenia: string
  status: 'szkic' | 'zatwierdzone' | 'anulowane'
  razem_brutto: number; created_at: string
}

type KnrKatalog = {
  id: string; kod: string; nazwa: string; opis: string | null; aktywny: boolean
}

type KnrPozycja = {
  id: string; katalog_id: string; kod: string; nazwa: string; jm: string
  r_norma: number; m_norma: number; s_norma: number; opis: string | null
}

type Cennik = {
  id: string; nazwa: string; typ: string; obowiazuje_od: string | null; aktywny: boolean
}

type CennikPozycja = {
  id: string; cennik_id: string; kod: string | null; nazwa: string
  jm: string; typ: 'M' | 'R' | 'S'; cena: number; opis: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

const statusBadge: Record<string, string> = {
  szkic: 'bg-yellow-100 text-yellow-800',
  zatwierdzone: 'bg-green-100 text-green-800',
  anulowane: 'bg-red-100 text-red-800',
}
const statusLabel: Record<string, string> = {
  szkic: 'Szkic', zatwierdzone: 'Zatwierdzone', anulowane: 'Anulowane',
}
const typLabel: Record<string, string> = {
  M: 'Materiał', R: 'Robocizna', S: 'Sprzęt',
}
const typBadge: Record<string, string> = {
  M: 'bg-blue-100 text-blue-700',
  R: 'bg-orange-100 text-orange-700',
  S: 'bg-purple-100 text-purple-700',
}

const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'
const labelCls = 'text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1'

// ── Typy AI ───────────────────────────────────────────────────────────────────

type AiKosztorysPoz = {
  lp: number; typ: 'pozycja'|'dzial'|'nota'; knr_kod: string; opis: string
  jm: string; ilosc: number; r_j: number; m_j: number; s_j: number
  r_wartosc: number; m_wartosc: number; s_wartosc: number
  bezposrednie: number; kp_wartosc: number; kzm_wartosc: number; z_wartosc: number; razem: number
}

type AiKosztorysResult = {
  nazwa: string
  kp_procent: number; kzm_procent: number; z_procent: number; vat_procent: number
  pozycje: AiKosztorysPoz[]
  error?: string
}

// ── Typy importu ──────────────────────────────────────────────────────────────

type ImportKnrRow = { kod: string; nazwa: string; jm: string; r_norma: number; m_norma: number; s_norma: number }
type ImportCenRow = { kod: string; nazwa: string; jm: string; typ: 'M'|'R'|'S'; cena: number }

type PdfImportPoz = {
  lp: number; typ: string; knr_kod: string; opis: string; jm: string; ilosc: number
  r_j: number; m_j: number; s_j: number; r_wartosc: number; m_wartosc: number; s_wartosc: number
  bezposrednie: number; kp_wartosc: number; kzm_wartosc: number; z_wartosc: number; razem: number
}
type PdfImportData = {
  numer: string; nazwa: string; inwestor: string | null; obiekt: string | null
  lokalizacja: string | null; data_sporzadzenia: string
  kp_procent: number; kzm_procent: number; z_procent: number; vat_procent: number
  uwagi: string | null; pozycje: PdfImportPoz[]; error?: string
}

// ── Parsowanie pliku ──────────────────────────────────────────────────────────

function parseFile<T>(file: File, cols: string[]): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        // Mapuj kolumny (pierwsze litery case-insensitive)
        const mapped = rows.map(row => {
          const out: Record<string, unknown> = {}
          for (const col of cols) {
            const key = Object.keys(row).find(k => k.toLowerCase().trim() === col.toLowerCase()) || col
            out[col] = row[key] ?? ''
          }
          return out as T
        })
        resolve(mapped.filter((r) => (r as Record<string, unknown>)['nazwa'] || (r as Record<string, unknown>)['opis']) as T[])
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function downloadTemplate(type: 'knr' | 'cennik') {
  let data: Record<string, unknown>[]
  let filename: string
  if (type === 'knr') {
    data = [
      { kod: '0101-01', nazwa: 'Przykładowa robota budowlana', jm: 'm2', r_norma: 0.5, m_norma: 1.2, s_norma: 0.1 },
      { kod: '0101-02', nazwa: 'Kolejna robota', jm: 'm', r_norma: 0.3, m_norma: 0.8, s_norma: 0 },
    ]
    filename = 'Szablon_Import_KNR.xlsx'
  } else {
    data = [
      { typ: 'M', kod: 'PE-110', nazwa: 'Rura PE100 DN110', jm: 'm', cena: 35.00 },
      { typ: 'R', kod: '', nazwa: 'Monter gazociągów', jm: 'h', cena: 42.00 },
      { typ: 'S', kod: '', nazwa: 'Koparka gąsienicowa', jm: 'm-g', cena: 185.00 },
    ]
    filename = 'Szablon_Import_Cennik.xlsx'
  }
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dane')
  XLSX.writeFile(wb, filename)
}

// ── Komponent główny ──────────────────────────────────────────────────────────

export default function KosztorysowaniePage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'kosztorysy' | 'katalogi' | 'cenniki'>('kosztorysy')

  // ── KOSZTORYSY state ─────────────────────────────────────────────────────────
  const [kosztorysy, setKosztorysy] = useState<Kosztorys[]>([])
  const [kLoading, setKLoading] = useState(true)
  const [kSearch, setKSearch] = useState('')
  const [kModal, setKModal] = useState(false)
  const [kEdit, setKEdit] = useState<Kosztorys | null>(null)
  const [kForm, setKForm] = useState({ numer: '', nazwa: '', inwestor: '', obiekt: '', status: 'szkic' })
  const [kSaving, setKSaving] = useState(false)

  // ── KNR state ────────────────────────────────────────────────────────────────
  const [katalogi, setKatalogi] = useState<KnrKatalog[]>([])
  const [selectedKatalog, setSelectedKatalog] = useState<KnrKatalog | null>(null)
  const [knrPozycje, setKnrPozycje] = useState<KnrPozycja[]>([])
  const [katModal, setKatModal] = useState(false)

  // ── Import KNR state ──────────────────────────────────────────────────────────
  const [knrImportModal, setKnrImportModal] = useState(false)
  const [knrImportRows, setKnrImportRows] = useState<ImportKnrRow[]>([])
  const [knrImportLoading, setKnrImportLoading] = useState(false)
  const [knrImportSaving, setKnrImportSaving] = useState(false)
  const [knrImportKatalogId, setKnrImportKatalogId] = useState<string>('')
  const knrFileRef = useRef<HTMLInputElement>(null)

  // ── Import Cennik state ───────────────────────────────────────────────────────
  const [cenImportModal, setCenImportModal] = useState(false)
  const [cenImportRows, setCenImportRows] = useState<ImportCenRow[]>([])
  const [cenImportLoading, setCenImportLoading] = useState(false)
  const [cenImportSaving, setCenImportSaving] = useState(false)
  const [cenImportCennikId, setCenImportCennikId] = useState<string>('')
  const cenFileRef = useRef<HTMLInputElement>(null)

  // ── Import PDF (kosztorys) state ──────────────────────────────────────────────
  const [pdfImportModal, setPdfImportModal] = useState(false)
  const [pdfImportData, setPdfImportData] = useState<PdfImportData | null>(null)
  const [pdfImportLoading, setPdfImportLoading] = useState(false)
  const [pdfImportSaving, setPdfImportSaving] = useState(false)
  const pdfFileRef = useRef<HTMLInputElement>(null)

  // ── AI Kosztorys state ────────────────────────────────────────────────────────
  const [aiModal, setAiModal] = useState(false)
  const [aiOpis, setAiOpis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiResult, setAiResult] = useState<AiKosztorysResult | null>(null)
  const aiFileRef = useRef<HTMLInputElement>(null)
  const [aiFiles, setAiFiles] = useState<{ base64: string; name: string }[]>([])

  // ── Import KNR z PDF state ────────────────────────────────────────────────────
  const [knrPdfModal, setKnrPdfModal] = useState(false)
  const [knrPdfData, setKnrPdfData] = useState<{ katalogi: {kod:string;nazwa:string}[]; pozycje: {katalog_kod:string;kod:string;nazwa:string}[]; error?:string } | null>(null)
  const [knrPdfLoading, setKnrPdfLoading] = useState(false)
  const [knrPdfSaving, setKnrPdfSaving] = useState(false)
  const knrPdfFileRef = useRef<HTMLInputElement>(null)
  const [katEdit, setKatEdit] = useState<KnrKatalog | null>(null)
  const [katForm, setKatForm] = useState({ kod: '', nazwa: '', opis: '' })
  const [pozModal, setPozModal] = useState(false)
  const [pozEdit, setPozEdit] = useState<KnrPozycja | null>(null)
  const [pozForm, setPozForm] = useState({ kod: '', nazwa: '', jm: 'm2', r_norma: '0', m_norma: '0', s_norma: '0', opis: '' })
  const [knrLoading, setKnrLoading] = useState(false)
  const [knrSearch, setKnrSearch] = useState('')

  // ── CENNIKI state ────────────────────────────────────────────────────────────
  const [cenniki, setCenniki] = useState<Cennik[]>([])
  const [selectedCennik, setSelectedCennik] = useState<Cennik | null>(null)
  const [cenPozycje, setCenPozycje] = useState<CennikPozycja[]>([])
  const [cenModal, setCenModal] = useState(false)
  const [cenEdit, setCenEdit] = useState<Cennik | null>(null)
  const [cenForm, setCenForm] = useState({ nazwa: '', typ: 'mieszany', obowiazuje_od: '' })
  const [cpModal, setCpModal] = useState(false)
  const [cpEdit, setCpEdit] = useState<CennikPozycja | null>(null)
  const [cpForm, setCpForm] = useState({ kod: '', nazwa: '', jm: 'szt', typ: 'M' as 'M'|'R'|'S', cena: '0', opis: '' })
  const [cpFilter, setCpFilter] = useState<'all' | 'M' | 'R' | 'S'>('all')
  const [cenLoading, setCenLoading] = useState(false)
  const [cenSearch, setCenSearch] = useState('')

  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  function showMsg(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => { fetchKosztorysy() }, [])
  useEffect(() => { if (tab === 'katalogi') fetchKatalogi() }, [tab])
  useEffect(() => { if (tab === 'cenniki') fetchCenniki() }, [tab])
  useEffect(() => { if (selectedKatalog) fetchKnrPozycje(selectedKatalog.id) }, [selectedKatalog])
  useEffect(() => { if (selectedCennik) fetchCenPozycje(selectedCennik.id) }, [selectedCennik])

  async function fetchKosztorysy() {
    setKLoading(true)
    const { data } = await supabase.from('kosztorysy').select('*').order('created_at', { ascending: false })
    setKosztorysy(data || [])
    setKLoading(false)
  }

  async function fetchKatalogi() {
    const { data } = await supabase.from('knr_katalogi').select('*').order('kod')
    setKatalogi(data || [])
    if (data && data.length > 0 && !selectedKatalog) setSelectedKatalog(data[0])
  }

  async function fetchKnrPozycje(katalogId: string) {
    setKnrLoading(true)
    const { data } = await supabase.from('knr_pozycje').select('*').eq('katalog_id', katalogId).order('kod')
    setKnrPozycje(data || [])
    setKnrLoading(false)
  }

  async function fetchCenniki() {
    const { data } = await supabase.from('cenniki').select('*').order('nazwa')
    setCenniki(data || [])
    if (data && data.length > 0 && !selectedCennik) setSelectedCennik(data[0])
  }

  async function fetchCenPozycje(cennikId: string) {
    setCenLoading(true)
    const { data } = await supabase.from('cenniki_pozycje').select('*').eq('cennik_id', cennikId).order('typ').order('nazwa')
    setCenPozycje(data || [])
    setCenLoading(false)
  }

  // ── KOSZTORYSY CRUD ───────────────────────────────────────────────────────────

  function openNewK() {
    const nr = `KOS/${new Date().getFullYear()}/${String(kosztorysy.length + 1).padStart(3, '0')}`
    setKForm({ numer: nr, nazwa: '', inwestor: '', obiekt: '', status: 'szkic' })
    setKEdit(null); setKModal(true)
  }

  function openEditK(k: Kosztorys) {
    setKForm({ numer: k.numer, nazwa: k.nazwa, inwestor: k.inwestor || '', obiekt: k.obiekt || '', status: k.status })
    setKEdit(k); setKModal(true)
  }

  async function saveK() {
    if (!kForm.numer.trim() || !kForm.nazwa.trim()) return showMsg('Wypełnij numer i nazwę', false)
    setKSaving(true)
    if (kEdit) {
      await supabase.from('kosztorysy').update({ ...kForm, updated_at: new Date().toISOString() }).eq('id', kEdit.id)
    } else {
      const { data: user } = await supabase.auth.getUser()
      await supabase.from('kosztorysy').insert({ ...kForm, user_id: user.user?.id })
    }
    setKModal(false); showMsg('Zapisano'); fetchKosztorysy(); setKSaving(false)
  }

  async function deleteK(id: string) {
    if (!confirm('Usunąć ten kosztorys?')) return
    await supabase.from('kosztorysy').delete().eq('id', id)
    showMsg('Usunięto'); fetchKosztorysy()
  }

  // ── KNR CRUD ──────────────────────────────────────────────────────────────────

  async function saveKatalog() {
    if (!katForm.kod || !katForm.nazwa) return showMsg('Wypełnij kod i nazwę', false)
    if (katEdit) {
      await supabase.from('knr_katalogi').update(katForm).eq('id', katEdit.id)
    } else {
      await supabase.from('knr_katalogi').insert(katForm)
    }
    setKatModal(false); showMsg('Zapisano katalog'); fetchKatalogi()
  }

  async function deleteKatalog(id: string) {
    if (!confirm('Usunąć katalog i wszystkie pozycje?')) return
    await supabase.from('knr_katalogi').delete().eq('id', id)
    if (selectedKatalog?.id === id) { setSelectedKatalog(null); setKnrPozycje([]) }
    showMsg('Usunięto'); fetchKatalogi()
  }

  async function savePoz() {
    if (!pozForm.kod || !pozForm.nazwa || !selectedKatalog) return showMsg('Wypełnij kod i nazwę', false)
    const payload = {
      ...pozForm,
      r_norma: parseFloat(pozForm.r_norma) || 0,
      m_norma: parseFloat(pozForm.m_norma) || 0,
      s_norma: parseFloat(pozForm.s_norma) || 0,
    }
    if (pozEdit) {
      await supabase.from('knr_pozycje').update(payload).eq('id', pozEdit.id)
    } else {
      await supabase.from('knr_pozycje').insert({ ...payload, katalog_id: selectedKatalog.id })
    }
    setPozModal(false); showMsg('Zapisano pozycję'); fetchKnrPozycje(selectedKatalog.id)
  }

  async function deletePoz(id: string) {
    if (!confirm('Usunąć pozycję KNR?')) return
    await supabase.from('knr_pozycje').delete().eq('id', id)
    showMsg('Usunięto')
    if (selectedKatalog) fetchKnrPozycje(selectedKatalog.id)
  }

  // ── CENNIK CRUD ───────────────────────────────────────────────────────────────

  async function saveCennik() {
    if (!cenForm.nazwa) return showMsg('Podaj nazwę cennika', false)
    if (cenEdit) {
      await supabase.from('cenniki').update(cenForm).eq('id', cenEdit.id)
    } else {
      await supabase.from('cenniki').insert(cenForm)
    }
    setCenModal(false); showMsg('Zapisano cennik'); fetchCenniki()
  }

  async function deleteCennik(id: string) {
    if (!confirm('Usunąć cennik i wszystkie pozycje?')) return
    await supabase.from('cenniki').delete().eq('id', id)
    if (selectedCennik?.id === id) { setSelectedCennik(null); setCenPozycje([]) }
    showMsg('Usunięto'); fetchCenniki()
  }

  async function saveCp() {
    if (!cpForm.nazwa || !selectedCennik) return showMsg('Podaj nazwę', false)
    const payload = { ...cpForm, cena: parseFloat(cpForm.cena) || 0 }
    if (cpEdit) {
      await supabase.from('cenniki_pozycje').update(payload).eq('id', cpEdit.id)
    } else {
      await supabase.from('cenniki_pozycje').insert({ ...payload, cennik_id: selectedCennik.id })
    }
    setCpModal(false); showMsg('Zapisano pozycję'); fetchCenPozycje(selectedCennik.id)
  }

  async function deleteCp(id: string) {
    if (!confirm('Usunąć pozycję cennika?')) return
    await supabase.from('cenniki_pozycje').delete().eq('id', id)
    showMsg('Usunięto')
    if (selectedCennik) fetchCenPozycje(selectedCennik.id)
  }

  // ── Import KNR ───────────────────────────────────────────────────────────────

  async function handleKnrFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setKnrImportLoading(true)
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(data), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: '', header: 1 }) as unknown[][]

      // Wykryj format "KNR Spis" — nagłówek ma kolumnę "KNR"
      const headerRow = (rawRows[0] || []) as string[]
      const knrColIdx = headerRow.findIndex(h => String(h).trim().toUpperCase() === 'KNR')

      if (knrColIdx >= 0) {
        // Format Spis KNR — importuj katalogi (knr_katalogi)
        let nameColIdx = headerRow.length - 1
        while (nameColIdx > 0 && !String(headerRow[nameColIdx]).trim()) nameColIdx--
        const katalogi = rawRows.slice(1)
          .filter(row => /KNR/i.test(String((row as string[])[knrColIdx] || '')))
          .map(row => ({
            kod: String((row as string[])[knrColIdx] || '').trim(),
            nazwa: String((row as string[])[nameColIdx] || '').trim(),
          }))
          .filter(r => r.kod && r.nazwa)
        // Pokaż podgląd w tym samym oknie co PDF import
        setKnrPdfData({ katalogi, pozycje: [] })
        setKnrImportModal(false)
        setKnrPdfModal(true)
      } else {
        // Format pozycji KNR — importuj do knr_pozycje
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        const cols = ['kod', 'nazwa', 'jm', 'r_norma', 'm_norma', 's_norma']
        const mapped = rows.map(row => {
          const out: Record<string, unknown> = {}
          for (const col of cols) {
            const key = Object.keys(row).find(k => k.toLowerCase().trim() === col.toLowerCase()) || col
            out[col] = row[key] ?? ''
          }
          return out
        }).filter(r => r['nazwa'])
        const cleaned = (mapped as ImportKnrRow[]).map(r => ({
          kod: String(r.kod || '').trim(),
          nazwa: String(r.nazwa || '').trim(),
          jm: String(r.jm || 'm2').trim() || 'm2',
          r_norma: parseFloat(String(r.r_norma)) || 0,
          m_norma: parseFloat(String(r.m_norma)) || 0,
          s_norma: parseFloat(String(r.s_norma)) || 0,
        })).filter(r => r.nazwa)
        setKnrImportRows(cleaned)
        if (cleaned.length === 0) showMsg('Nie znaleziono danych. Sprawdź nazwy kolumn (kod, nazwa, jm, r_norma, m_norma, s_norma)', false)
      }
    } catch { showMsg('Błąd odczytu pliku', false) }
    setKnrImportLoading(false)
    if (knrFileRef.current) knrFileRef.current.value = ''
  }

  async function saveKnrImport() {
    if (!knrImportKatalogId || knrImportRows.length === 0) return showMsg('Wybierz katalog', false)
    setKnrImportSaving(true)
    const payload = knrImportRows.map(r => ({ ...r, katalog_id: knrImportKatalogId }))
    const chunkSize = 50
    let saved = 0
    for (let i = 0; i < payload.length; i += chunkSize) {
      const { error } = await supabase.from('knr_pozycje').insert(payload.slice(i, i + chunkSize))
      if (error) { showMsg(`Błąd zapisu pozycji KNR: ${error.message}`, false); setKnrImportSaving(false); return }
      saved += Math.min(chunkSize, payload.length - i)
    }
    setKnrImportModal(false)
    setKnrImportRows([])
    showMsg(`Zaimportowano ${saved} pozycji KNR`)
    if (selectedKatalog?.id === knrImportKatalogId) fetchKnrPozycje(knrImportKatalogId)
    setKnrImportSaving(false)
  }

  // ── Import Cennik ─────────────────────────────────────────────────────────────

  async function handleCenFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCenImportLoading(true)
    try {
      const rows = await parseFile<ImportCenRow>(file, ['typ','kod','nazwa','jm','cena'])
      const cleaned = rows.map(r => ({
        typ: (['M','R','S'].includes(String(r.typ).toUpperCase().trim()) ? String(r.typ).toUpperCase().trim() : 'M') as 'M'|'R'|'S',
        kod: String(r.kod || '').trim(),
        nazwa: String(r.nazwa || '').trim(),
        jm: String(r.jm || 'szt').trim() || 'szt',
        cena: parseFloat(String(r.cena)) || 0,
      })).filter(r => r.nazwa)
      setCenImportRows(cleaned)
    } catch { showMsg('Błąd odczytu pliku', false) }
    setCenImportLoading(false)
    if (cenFileRef.current) cenFileRef.current.value = ''
  }

  async function saveCenImport() {
    if (!cenImportCennikId || cenImportRows.length === 0) return showMsg('Wybierz cennik', false)
    setCenImportSaving(true)
    const payload = cenImportRows.map(r => ({ ...r, cennik_id: cenImportCennikId }))
    const chunkSize = 50
    for (let i = 0; i < payload.length; i += chunkSize) {
      await supabase.from('cenniki_pozycje').insert(payload.slice(i, i + chunkSize))
    }
    setCenImportModal(false)
    setCenImportRows([])
    showMsg(`Zaimportowano ${payload.length} pozycji cennika`)
    if (selectedCennik?.id === cenImportCennikId) fetchCenPozycje(cenImportCennikId)
    setCenImportSaving(false)
  }

  // ── Import KNR z PDF ──────────────────────────────────────────────────────────

  async function handleKnrPdfFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      showMsg('Plik PDF jest zbyt duży (max 10 MB)', false)
      if (knrPdfFileRef.current) knrPdfFileRef.current.value = ''
      return
    }
    setKnrPdfLoading(true)
    setKnrPdfData(null)
    setKnrPdfModal(true)
    try {
      // Wyślij PDF jako base64 bezpośrednio do Claude (bez pdfjs)
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)

      let res: Response
      try {
        res = await fetch('/api/kosztorys/parse-knr-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64 }),
          signal: AbortSignal.timeout(90000),
        })
      } catch (fetchErr) {
        const msg = (fetchErr as Error).message || ''
        showMsg(msg.includes('timeout') || msg.includes('abort') ? 'Przekroczono czas oczekiwania (90s).' : `Błąd połączenia: ${msg}`, false)
        setKnrPdfModal(false); setKnrPdfLoading(false)
        if (knrPdfFileRef.current) knrPdfFileRef.current.value = ''
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Błąd serwera (${res.status})` }))
        showMsg(err.error || 'Błąd parsowania PDF', false)
        setKnrPdfModal(false); setKnrPdfLoading(false)
        if (knrPdfFileRef.current) knrPdfFileRef.current.value = ''
        return
      }

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += dec.decode(value, { stream: true })
      }

      const clean = fullText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        showMsg(`Nie udało się odczytać danych z PDF (odpowiedź: ${clean.slice(0, 150)})`, false)
        setKnrPdfModal(false); setKnrPdfLoading(false)
        if (knrPdfFileRef.current) knrPdfFileRef.current.value = ''
        return
      }
      let parsed: typeof knrPdfData
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        showMsg('Błąd parsowania JSON — spróbuj ponownie.', false)
        setKnrPdfModal(false); setKnrPdfLoading(false)
        if (knrPdfFileRef.current) knrPdfFileRef.current.value = ''
        return
      }
      setKnrPdfData(parsed)
    } catch (err) {
      console.error('KNR PDF import error:', err)
      showMsg('Błąd podczas przetwarzania pliku PDF', false)
      setKnrPdfModal(false)
    }
    setKnrPdfLoading(false)
    if (knrPdfFileRef.current) knrPdfFileRef.current.value = ''
  }

  async function saveKnrPdfImport() {
    if (!knrPdfData) return
    setKnrPdfSaving(true)
    const { katalogi, pozycje } = knrPdfData
    const katalogIdMap: Record<string, string> = {}
    for (let i = 0; i < katalogi.length; i += 50) {
      const chunk = katalogi.slice(i, i + 50)
      const { data: inserted, error } = await supabase
        .from('knr_katalogi')
        .upsert(chunk.map(k => ({ kod: k.kod.trim(), nazwa: k.nazwa.trim(), aktywny: true })), { onConflict: 'kod', ignoreDuplicates: false })
        .select('id,kod')
      if (error) { showMsg(`Błąd zapisu katalogów: ${error.message}`, false); setKnrPdfSaving(false); return }
      if (inserted) inserted.forEach(r => { katalogIdMap[r.kod] = r.id })
    }
    const { data: allKats } = await supabase.from('knr_katalogi').select('id,kod').in('kod', katalogi.map(k => k.kod.trim()))
    if (allKats) allKats.forEach(r => { katalogIdMap[r.kod] = r.id })
    let insertedPoz = 0
    if (pozycje && pozycje.length > 0) {
      const pozPayload = pozycje
        .filter(p => katalogIdMap[p.katalog_kod])
        .map(p => ({ katalog_id: katalogIdMap[p.katalog_kod], kod: p.kod.trim(), nazwa: p.nazwa.trim(), jm: 'szt', r_norma: 0, m_norma: 0, s_norma: 0 }))
      for (let i = 0; i < pozPayload.length; i += 50) {
        const res = await supabase.from('knr_pozycje').insert(pozPayload.slice(i, i + 50))
        if (!res.error) insertedPoz += Math.min(50, pozPayload.length - i)
      }
    }
    setKnrPdfModal(false); setKnrPdfData(null); setKnrPdfSaving(false)
    showMsg(`Zaimportowano ${katalogi.length} katalogów KNR${insertedPoz > 0 ? ` i ${insertedPoz} pozycji` : ''}`)
    fetchKatalogi()
  }

  // ── Import PDF (kosztorys) ────────────────────────────────────────────────────

  async function handlePdfFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      showMsg('Plik PDF jest zbyt duży (maksimum 10 MB)', false)
      if (pdfFileRef.current) pdfFileRef.current.value = ''
      return
    }
    setPdfImportLoading(true)
    setPdfImportData(null)
    setPdfImportModal(true)
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
      }
      const base64 = btoa(binary)

      const res = await fetch('/api/kosztorys/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64 }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `Błąd serwera (${res.status})` }))
        showMsg(errData.error || 'Błąd parsowania PDF', false)
        setPdfImportModal(false)
        setPdfImportLoading(false)
        if (pdfFileRef.current) pdfFileRef.current.value = ''
        return
      }

      // Czytaj streaming response — Claude przesyła fragmenty tekstu na bieżąco
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += dec.decode(value, { stream: true })
      }

      // Wyodrębnij JSON z odpowiedzi (może zawierać markdown fences)
      const clean = fullText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        showMsg('Nie udało się odczytać danych z PDF', false)
        setPdfImportModal(false)
        setPdfImportLoading(false)
        if (pdfFileRef.current) pdfFileRef.current.value = ''
        return
      }
      const data = JSON.parse(jsonMatch[0]) as PdfImportData
      setPdfImportData(data)
    } catch (err) {
      console.error('PDF import error:', err)
      showMsg('Błąd podczas przetwarzania pliku PDF', false)
      setPdfImportModal(false)
    }
    setPdfImportLoading(false)
    if (pdfFileRef.current) pdfFileRef.current.value = ''
  }

  async function savePdfImport() {
    if (!pdfImportData) return
    setPdfImportSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const kosPayload = {
      numer: pdfImportData.numer || `KOS/${new Date().getFullYear()}/${String(kosztorysy.length + 1).padStart(3, '0')}`,
      nazwa: pdfImportData.nazwa,
      inwestor: pdfImportData.inwestor,
      obiekt: pdfImportData.obiekt,
      lokalizacja: pdfImportData.lokalizacja,
      data_sporzadzenia: pdfImportData.data_sporzadzenia || new Date().toISOString().split('T')[0],
      status: 'szkic',
      user_id: user.user?.id,
      uwagi: pdfImportData.uwagi,
      kp_procent: pdfImportData.kp_procent || 65,
      kzm_procent: pdfImportData.kzm_procent || 10,
      z_procent: pdfImportData.z_procent || 20,
      vat_procent: pdfImportData.vat_procent || 23,
    }
    const { data: newKos, error: kosErr } = await supabase.from('kosztorysy').insert(kosPayload).select('id').single()
    if (kosErr || !newKos) { showMsg('Błąd zapisu: ' + kosErr?.message, false); setPdfImportSaving(false); return }
    const pozPayload = pdfImportData.pozycje.map(p => ({ ...p, kosztorys_id: newKos.id }))
    for (let i = 0; i < pozPayload.length; i += 50) {
      await supabase.from('kosztorysy_pozycje').insert(pozPayload.slice(i, i + 50))
    }
    const pozCount = pozPayload.filter(p => p.typ === 'pozycja').length
    setPdfImportModal(false); setPdfImportData(null); setPdfImportSaving(false)
    showMsg(`Zaimportowano kosztorys z ${pozCount} pozycjami`)
    router.push(`/kosztorysowanie/${newKos.id}`)
  }

  // ── AI Kosztorys ─────────────────────────────────────────────────────────────

  async function handleAiFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newFiles: { base64: string; name: string }[] = []
    for (const file of Array.from(files)) {
      if (file.size > 15 * 1024 * 1024) { showMsg(`Plik "${file.name}" jest zbyt duży (max 15 MB)`, false); continue }
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
      newFiles.push({ base64: btoa(binary), name: file.name })
    }
    if (newFiles.length > 0) setAiFiles(prev => [...prev, ...newFiles])
    if (aiFileRef.current) aiFileRef.current.value = ''
  }

  async function runAiAnaliza() {
    if (!aiOpis.trim() && aiFiles.length === 0) return showMsg('Wpisz opis projektu lub załącz plik', false)
    setAiLoading(true)
    setAiResult(null)
    try {
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 120000)
      const res = await fetch('/api/kosztorysowanie/ai-analiza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opis: aiOpis, files: aiFiles }),
        signal: controller.signal,
      })
      clearTimeout(tid)
      const text = await res.text()
      const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      if (!jsonMatch) { showMsg('AI nie zwróciło prawidłowego JSON', false); setAiLoading(false); return }
      const data = JSON.parse(jsonMatch[0]) as AiKosztorysResult
      setAiResult(data)
    } catch (e: any) {
      showMsg('Błąd analizy AI: ' + e.message, false)
    }
    setAiLoading(false)
  }

  function updateAiPoz(idx: number, field: keyof AiKosztorysPoz, value: string | number) {
    if (!aiResult) return
    const updated = [...aiResult.pozycje]
    updated[idx] = { ...updated[idx], [field]: value }
    setAiResult({ ...aiResult, pozycje: updated })
  }

  async function saveAiKosztorys() {
    if (!aiResult) return
    setAiSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const nr = `KOS/${new Date().getFullYear()}/${String(kosztorysy.length + 1).padStart(3, '0')}`
    const kosPayload = {
      numer: nr,
      nazwa: aiResult.nazwa,
      status: 'szkic',
      user_id: user.user?.id,
      data_sporzadzenia: new Date().toISOString().split('T')[0],
      kp_procent: aiResult.kp_procent ?? 68,
      kzm_procent: aiResult.kzm_procent ?? 20,
      z_procent: aiResult.z_procent ?? 10,
      vat_procent: aiResult.vat_procent ?? 23,
    }
    const { data: newKos, error: kosErr } = await supabase.from('kosztorysy').insert(kosPayload).select('id').single()
    if (kosErr || !newKos) { showMsg('Błąd zapisu: ' + kosErr?.message, false); setAiSaving(false); return }
    const pozPayload = aiResult.pozycje.map(p => ({ ...p, kosztorys_id: newKos.id }))
    for (let i = 0; i < pozPayload.length; i += 50) {
      await supabase.from('kosztorysy_pozycje').insert(pozPayload.slice(i, i + 50))
    }
    setAiModal(false); setAiResult(null); setAiOpis(''); setAiFiles([])
    setAiSaving(false)
    showMsg('Kosztorys AI utworzony!')
    router.push(`/kosztorysowanie/${newKos.id}`)
  }

  // ── Filtered lists ────────────────────────────────────────────────────────────

  const filteredK = kosztorysy.filter(k =>
    k.nazwa.toLowerCase().includes(kSearch.toLowerCase()) ||
    k.numer.toLowerCase().includes(kSearch.toLowerCase()) ||
    (k.inwestor || '').toLowerCase().includes(kSearch.toLowerCase())
  )

  const filteredPoz = knrPozycje.filter(p =>
    p.nazwa.toLowerCase().includes(knrSearch.toLowerCase()) ||
    p.kod.toLowerCase().includes(knrSearch.toLowerCase())
  )

  const filteredCp = cenPozycje.filter(p => {
    const matchFilter = cpFilter === 'all' || p.typ === cpFilter
    const matchSearch = p.nazwa.toLowerCase().includes(cenSearch.toLowerCase()) ||
      (p.kod || '').toLowerCase().includes(cenSearch.toLowerCase())
    return matchFilter && matchSearch
  })

  // ── RENDER ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* Komunikat */}
      {msg && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all
          ${msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.ok ? '✓ ' : '✗ '}{msg.text}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kosztorysowanie</h1>
        <p className="text-sm text-gray-500 mt-1">Tworzenie kosztorysów budowlanych z katalogami KNR i cennikami R/M/S</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([['kosztorysy','Kosztorysy'],['katalogi','Katalogi KNR'],['cenniki','Cenniki R/M/S']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-px
              ${tab === key ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB 1: KOSZTORYSY
      ═══════════════════════════════════════════════════════ */}
      {tab === 'kosztorysy' && (
        <div>
          {/* Toolbar */}
          <div className="flex gap-3 mb-4 flex-wrap items-center">
            <button onClick={openNewK}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nowy kosztorys
            </button>
            <button onClick={() => { setAiOpis(''); setAiFiles([]); setAiResult(null); setAiModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
              🤖 Kosztorys AI
            </button>
            <button onClick={() => pdfFileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Importuj z PDF
            </button>
            <input value={kSearch} onChange={e => setKSearch(e.target.value)}
              placeholder="Szukaj po numerze, nazwie, inwestorze..."
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72" />
            <span className="text-sm text-gray-500 ml-auto">{filteredK.length} kosztorysów</span>
          </div>

          {/* Table */}
          {kLoading ? (
            <div className="text-center py-16 text-gray-400">Ładowanie...</div>
          ) : filteredK.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="mx-auto mb-3 text-gray-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Brak kosztorysów. Kliknij &quot;Nowy kosztorys&quot; aby zacząć.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Numer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Nazwa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Inwestor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Obiekt</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Wartość brutto</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredK.map(k => (
                    <tr key={k.id} className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/kosztorysowanie/${k.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{k.numer}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{k.nazwa}</td>
                      <td className="px-4 py-3 text-gray-600">{k.inwestor || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{k.obiekt || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{k.data_sporzadzenia}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[k.status]}`}>
                          {statusLabel[k.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {k.razem_brutto > 0 ? `${fmt(k.razem_brutto)} zł` : '—'}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => router.push(`/kosztorysowanie/${k.id}`)}
                            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                            Otwórz
                          </button>
                          <button onClick={() => openEditK(k)}
                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                            Edytuj
                          </button>
                          <button onClick={() => deleteK(k.id)}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
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
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 2: KATALOGI KNR
      ═══════════════════════════════════════════════════════ */}
      {tab === 'katalogi' && (
        <div className="flex gap-4" style={{ minHeight: 600 }}>

          {/* Lista katalogów */}
          <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Katalogi KNR</span>
              <button onClick={() => { setKatForm({ kod: '', nazwa: '', opis: '' }); setKatEdit(null); setKatModal(true) }}
                className="text-blue-600 hover:text-blue-800 text-xs font-medium">+ Dodaj</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {katalogi.map(kat => (
                <div key={kat.id}
                  onClick={() => setSelectedKatalog(kat)}
                  className={`px-3 py-2.5 cursor-pointer border-b border-gray-50 flex items-start gap-2 transition-colors
                    ${selectedKatalog?.id === kat.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'hover:bg-gray-50'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-gray-500">{kat.kod}</div>
                    <div className="text-sm font-medium text-gray-800 truncate">{kat.nazwa}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={e => { e.stopPropagation(); setKatForm({ kod: kat.kod, nazwa: kat.nazwa, opis: kat.opis || '' }); setKatEdit(kat); setKatModal(true) }}
                      className="text-xs text-gray-400 hover:text-blue-600 p-0.5">✎</button>
                    <button onClick={e => { e.stopPropagation(); deleteKatalog(kat.id) }}
                      className="text-xs text-gray-400 hover:text-red-600 p-0.5">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pozycje katalogu */}
          <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
            {!selectedKatalog ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Wybierz katalog z listy
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                  <div>
                    <span className="text-sm font-semibold text-gray-800">{selectedKatalog.kod}</span>
                    <span className="text-sm text-gray-500 ml-2">{selectedKatalog.nazwa}</span>
                  </div>
                  <div className="ml-auto flex gap-2 flex-wrap">
                    <input value={knrSearch} onChange={e => setKnrSearch(e.target.value)}
                      placeholder="Szukaj..."
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-44" />
                    <button onClick={() => downloadTemplate('knr')}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Szablon XLS
                    </button>
                    <button onClick={() => { setKnrImportKatalogId(selectedKatalog.id); setKnrImportRows([]); setKnrImportModal(true) }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs border border-green-200 text-green-700 rounded-lg hover:bg-green-50">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Importuj XLS/CSV
                    </button>
                    <button onClick={() => knrPdfFileRef.current?.click()}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-red-50">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      Importuj PDF
                    </button>
                    <button onClick={() => { setPozForm({ kod: '', nazwa: '', jm: 'm2', r_norma: '0', m_norma: '0', s_norma: '0', opis: '' }); setPozEdit(null); setPozModal(true) }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                      + Dodaj ręcznie
                    </button>
                  </div>
                </div>

                {knrLoading ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Ładowanie...</div>
                ) : (
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Kod</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Opis roboty</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">JM</th>
                          <th className="px-3 py-2 text-right text-orange-600 font-medium">R (r-g)</th>
                          <th className="px-3 py-2 text-right text-blue-600 font-medium">M (jm)</th>
                          <th className="px-3 py-2 text-right text-purple-600 font-medium">S (m-g)</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">Akcje</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredPoz.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-gray-500">{p.kod}</td>
                            <td className="px-3 py-2 text-gray-800">{p.nazwa}</td>
                            <td className="px-3 py-2 text-center text-gray-600">{p.jm}</td>
                            <td className="px-3 py-2 text-right text-orange-700">{p.r_norma > 0 ? p.r_norma : '—'}</td>
                            <td className="px-3 py-2 text-right text-blue-700">{p.m_norma > 0 ? p.m_norma : '—'}</td>
                            <td className="px-3 py-2 text-right text-purple-700">{p.s_norma > 0 ? p.s_norma : '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex gap-1 justify-center">
                                <button onClick={() => { setPozForm({ kod: p.kod, nazwa: p.nazwa, jm: p.jm, r_norma: String(p.r_norma), m_norma: String(p.m_norma), s_norma: String(p.s_norma), opis: p.opis || '' }); setPozEdit(p); setPozModal(true) }}
                                  className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">Edytuj</button>
                                <button onClick={() => deletePoz(p.id)}
                                  className="px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100">Usuń</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredPoz.length === 0 && (
                          <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Brak pozycji. Dodaj pierwszą pozycję KNR.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 3: CENNIKI
      ═══════════════════════════════════════════════════════ */}
      {tab === 'cenniki' && (
        <div className="flex gap-4" style={{ minHeight: 600 }}>

          {/* Lista cenników */}
          <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Cenniki</span>
              <button onClick={() => { setCenForm({ nazwa: '', typ: 'mieszany', obowiazuje_od: '' }); setCenEdit(null); setCenModal(true) }}
                className="text-blue-600 hover:text-blue-800 text-xs font-medium">+ Dodaj</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {cenniki.map(cen => (
                <div key={cen.id}
                  onClick={() => { setSelectedCennik(cen); setCpFilter('all'); setCenSearch('') }}
                  className={`px-3 py-2.5 cursor-pointer border-b border-gray-50 flex items-start gap-2 transition-colors
                    ${selectedCennik?.id === cen.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'hover:bg-gray-50'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{cen.nazwa}</div>
                    <div className="text-xs text-gray-500">{cen.typ} {cen.obowiazuje_od ? `• od ${cen.obowiazuje_od}` : ''}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={e => { e.stopPropagation(); setCenForm({ nazwa: cen.nazwa, typ: cen.typ, obowiazuje_od: cen.obowiazuje_od || '' }); setCenEdit(cen); setCenModal(true) }}
                      className="text-xs text-gray-400 hover:text-blue-600 p-0.5">✎</button>
                    <button onClick={e => { e.stopPropagation(); deleteCennik(cen.id) }}
                      className="text-xs text-gray-400 hover:text-red-600 p-0.5">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pozycje cennika */}
          <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
            {!selectedCennik ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Wybierz cennik z listy
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800">{selectedCennik.nazwa}</span>
                  <div className="flex gap-1 ml-auto">
                    {(['all','M','R','S'] as const).map(f => (
                      <button key={f} onClick={() => setCpFilter(f)}
                        className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors
                          ${cpFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {f === 'all' ? 'Wszystkie' : typLabel[f]}
                      </button>
                    ))}
                    <input value={cenSearch} onChange={e => setCenSearch(e.target.value)}
                      placeholder="Szukaj..." className="ml-2 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-36" />
                    <button onClick={() => downloadTemplate('cennik')}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Szablon
                    </button>
                    <button onClick={() => { setCenImportCennikId(selectedCennik.id); setCenImportRows([]); setCenImportModal(true) }}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs border border-green-200 text-green-700 rounded-lg hover:bg-green-50">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Importuj
                    </button>
                    <button onClick={() => { setCpForm({ kod: '', nazwa: '', jm: 'szt', typ: 'M', cena: '0', opis: '' }); setCpEdit(null); setCpModal(true) }}
                      className="ml-1 flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                      + Dodaj
                    </button>
                  </div>
                </div>

                {cenLoading ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Ładowanie...</div>
                ) : (
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Typ</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Kod</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Nazwa</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">JM</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-medium">Cena [zł]</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">Akcje</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredCp.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typBadge[p.typ]}`}>{typLabel[p.typ]}</span>
                            </td>
                            <td className="px-3 py-2 font-mono text-gray-500">{p.kod || '—'}</td>
                            <td className="px-3 py-2 text-gray-800">{p.nazwa}</td>
                            <td className="px-3 py-2 text-center text-gray-600">{p.jm}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(p.cena)}</td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex gap-1 justify-center">
                                <button onClick={() => { setCpForm({ kod: p.kod || '', nazwa: p.nazwa, jm: p.jm, typ: p.typ, cena: String(p.cena), opis: p.opis || '' }); setCpEdit(p); setCpModal(true) }}
                                  className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">Edytuj</button>
                                <button onClick={() => deleteCp(p.id)}
                                  className="px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100">Usuń</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredCp.length === 0 && (
                          <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Brak pozycji. Dodaj pierwszą pozycję cennika.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════ */}

      {/* Modal: Nowy/Edytuj kosztorys */}
      {kModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setKModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{kEdit ? 'Edytuj kosztorys' : 'Nowy kosztorys'}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Numer *</label>
                  <input value={kForm.numer} onChange={e => setKForm(f => ({ ...f, numer: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={kForm.status} onChange={e => setKForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                    <option value="szkic">Szkic</option>
                    <option value="zatwierdzone">Zatwierdzone</option>
                    <option value="anulowane">Anulowane</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Nazwa kosztorysu *</label>
                <input value={kForm.nazwa} onChange={e => setKForm(f => ({ ...f, nazwa: e.target.value }))} className={inputCls} placeholder="np. Budowa gazociągu DN110 ul. Polna" />
              </div>
              <div>
                <label className={labelCls}>Inwestor</label>
                <input value={kForm.inwestor} onChange={e => setKForm(f => ({ ...f, inwestor: e.target.value }))} className={inputCls} placeholder="Nazwa inwestora" />
              </div>
              <div>
                <label className={labelCls}>Obiekt / lokalizacja</label>
                <input value={kForm.obiekt} onChange={e => setKForm(f => ({ ...f, obiekt: e.target.value }))} className={inputCls} placeholder="Opis obiektu" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setKModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Anuluj</button>
              <button onClick={saveK} disabled={kSaving}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {kSaving ? 'Zapisywanie...' : 'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Katalog KNR */}
      {katModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setKatModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{katEdit ? 'Edytuj katalog' : 'Nowy katalog KNR'}</h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Kod katalogu *</label>
                <input value={katForm.kod} onChange={e => setKatForm(f => ({ ...f, kod: e.target.value }))} className={inputCls} placeholder="np. KNR 2-02" />
              </div>
              <div>
                <label className={labelCls}>Nazwa *</label>
                <input value={katForm.nazwa} onChange={e => setKatForm(f => ({ ...f, nazwa: e.target.value }))} className={inputCls} placeholder="Nazwa katalogu" />
              </div>
              <div>
                <label className={labelCls}>Opis</label>
                <textarea value={katForm.opis} onChange={e => setKatForm(f => ({ ...f, opis: e.target.value }))} className={inputCls} rows={2} />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setKatModal(false)} className="px-4 py-2 text-sm text-gray-600">Anuluj</button>
              <button onClick={saveKatalog} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pozycja KNR */}
      {pozModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setPozModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{pozEdit ? 'Edytuj pozycję KNR' : 'Nowa pozycja KNR'}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Kod *</label>
                  <input value={pozForm.kod} onChange={e => setPozForm(f => ({ ...f, kod: e.target.value }))} className={inputCls} placeholder="np. 0201-01" />
                </div>
                <div>
                  <label className={labelCls}>JM *</label>
                  <input value={pozForm.jm} onChange={e => setPozForm(f => ({ ...f, jm: e.target.value }))} className={inputCls} placeholder="m2, szt, m..." />
                </div>
              </div>
              <div>
                <label className={labelCls}>Opis roboty *</label>
                <input value={pozForm.nazwa} onChange={e => setPozForm(f => ({ ...f, nazwa: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`${labelCls} text-orange-600`}>R — robocizna (r-g)</label>
                  <input type="number" step="0.0001" value={pozForm.r_norma} onChange={e => setPozForm(f => ({ ...f, r_norma: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={`${labelCls} text-blue-600`}>M — materiały (jm)</label>
                  <input type="number" step="0.0001" value={pozForm.m_norma} onChange={e => setPozForm(f => ({ ...f, m_norma: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={`${labelCls} text-purple-600`}>S — sprzęt (m-g)</label>
                  <input type="number" step="0.0001" value={pozForm.s_norma} onChange={e => setPozForm(f => ({ ...f, s_norma: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Opis dodatkowy</label>
                <textarea value={pozForm.opis} onChange={e => setPozForm(f => ({ ...f, opis: e.target.value }))} className={inputCls} rows={2} />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setPozModal(false)} className="px-4 py-2 text-sm text-gray-600">Anuluj</button>
              <button onClick={savePoz} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cennik */}
      {cenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setCenModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{cenEdit ? 'Edytuj cennik' : 'Nowy cennik'}</h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Nazwa cennika *</label>
                <input value={cenForm.nazwa} onChange={e => setCenForm(f => ({ ...f, nazwa: e.target.value }))} className={inputCls} placeholder="np. Cennik materiałów 2024" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Typ cennika</label>
                  <select value={cenForm.typ} onChange={e => setCenForm(f => ({ ...f, typ: e.target.value }))} className={inputCls}>
                    <option value="mieszany">Mieszany (R+M+S)</option>
                    <option value="materialy">Materiały</option>
                    <option value="robocizna">Robocizna</option>
                    <option value="sprzet">Sprzęt</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Obowiązuje od</label>
                  <input type="date" value={cenForm.obowiazuje_od} onChange={e => setCenForm(f => ({ ...f, obowiazuje_od: e.target.value }))} className={inputCls} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setCenModal(false)} className="px-4 py-2 text-sm text-gray-600">Anuluj</button>
              <button onClick={saveCennik} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pozycja cennika */}
      {cpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setCpModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{cpEdit ? 'Edytuj pozycję cennika' : 'Nowa pozycja cennika'}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Typ *</label>
                  <select value={cpForm.typ} onChange={e => setCpForm(f => ({ ...f, typ: e.target.value as 'M'|'R'|'S' }))} className={inputCls}>
                    <option value="M">M — Materiał</option>
                    <option value="R">R — Robocizna</option>
                    <option value="S">S — Sprzęt</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Kod</label>
                  <input value={cpForm.kod} onChange={e => setCpForm(f => ({ ...f, kod: e.target.value }))} className={inputCls} placeholder="np. PE-110" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Nazwa *</label>
                <input value={cpForm.nazwa} onChange={e => setCpForm(f => ({ ...f, nazwa: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Jednostka miary</label>
                  <input value={cpForm.jm} onChange={e => setCpForm(f => ({ ...f, jm: e.target.value }))} className={inputCls} placeholder="szt, m, m2, h..." />
                </div>
                <div>
                  <label className={labelCls}>Cena [zł/jm] *</label>
                  <input type="number" step="0.01" value={cpForm.cena} onChange={e => setCpForm(f => ({ ...f, cena: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Opis</label>
                <textarea value={cpForm.opis} onChange={e => setCpForm(f => ({ ...f, opis: e.target.value }))} className={inputCls} rows={2} />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setCpModal(false)} className="px-4 py-2 text-sm text-gray-600">Anuluj</button>
              <button onClick={saveCp} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Import KNR ── */}
      {knrImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setKnrImportModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Import pozycji KNR z pliku Excel / CSV</h2>
              <p className="text-sm text-gray-500 mt-1">
                Plik powinien mieć kolumny: <code className="bg-gray-100 px-1 rounded text-xs">kod, nazwa, jm, r_norma, m_norma, s_norma</code>
              </p>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-48">
                  <label className={labelCls}>Docelowy katalog KNR</label>
                  <select value={knrImportKatalogId} onChange={e => setKnrImportKatalogId(e.target.value)} className={inputCls}>
                    <option value="">— wybierz katalog —</option>
                    {katalogi.map(k => <option key={k.id} value={k.id}>{k.kod} — {k.nazwa}</option>)}
                  </select>
                </div>
                <div>
                  <input ref={knrFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleKnrFileSelect} className="hidden" />
                  <button onClick={() => knrFileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-green-300 text-green-700 rounded-lg hover:bg-green-50 text-sm font-medium transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {knrImportLoading ? 'Wczytywanie...' : 'Wybierz plik .xlsx / .csv'}
                  </button>
                </div>
                <button onClick={() => downloadTemplate('knr')}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Pobierz szablon XLS
                </button>
              </div>

              {knrImportRows.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Podgląd — <span className="text-green-700">{knrImportRows.length} wierszy</span> gotowych do importu:
                  </p>
                  <div className="overflow-auto border border-gray-200 rounded-lg" style={{ maxHeight: 320 }}>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500">Kod</th>
                          <th className="px-3 py-2 text-left text-gray-500">Nazwa roboty</th>
                          <th className="px-3 py-2 text-center text-gray-500">JM</th>
                          <th className="px-3 py-2 text-right text-orange-500">R</th>
                          <th className="px-3 py-2 text-right text-blue-500">M</th>
                          <th className="px-3 py-2 text-right text-purple-500">S</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {knrImportRows.slice(0, 100).map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 font-mono text-gray-500">{r.kod}</td>
                            <td className="px-3 py-1.5 text-gray-800">{r.nazwa}</td>
                            <td className="px-3 py-1.5 text-center">{r.jm}</td>
                            <td className="px-3 py-1.5 text-right text-orange-600">{r.r_norma > 0 ? r.r_norma : '—'}</td>
                            <td className="px-3 py-1.5 text-right text-blue-600">{r.m_norma > 0 ? r.m_norma : '—'}</td>
                            <td className="px-3 py-1.5 text-right text-purple-600">{r.s_norma > 0 ? r.s_norma : '—'}</td>
                          </tr>
                        ))}
                        {knrImportRows.length > 100 && (
                          <tr><td colSpan={6} className="px-3 py-2 text-center text-gray-400 text-xs">...i {knrImportRows.length - 100} więcej</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={() => setKnrImportModal(false)} className="px-4 py-2 text-sm text-gray-600">Anuluj</button>
              <button onClick={saveKnrImport} disabled={knrImportSaving || knrImportRows.length === 0 || !knrImportKatalogId}
                className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                {knrImportSaving ? 'Importowanie...' : `Importuj ${knrImportRows.length} pozycji`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Import Cennik ── */}
      {cenImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setCenImportModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Import pozycji cennika z pliku Excel / CSV</h2>
              <p className="text-sm text-gray-500 mt-1">
                Plik powinien mieć kolumny: <code className="bg-gray-100 px-1 rounded text-xs">typ (M/R/S), kod, nazwa, jm, cena</code>
              </p>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-48">
                  <label className={labelCls}>Docelowy cennik</label>
                  <select value={cenImportCennikId} onChange={e => setCenImportCennikId(e.target.value)} className={inputCls}>
                    <option value="">— wybierz cennik —</option>
                    {cenniki.map(c => <option key={c.id} value={c.id}>{c.nazwa}</option>)}
                  </select>
                </div>
                <div>
                  <input ref={cenFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleCenFileSelect} className="hidden" />
                  <button onClick={() => cenFileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-green-300 text-green-700 rounded-lg hover:bg-green-50 text-sm font-medium transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {cenImportLoading ? 'Wczytywanie...' : 'Wybierz plik .xlsx / .csv'}
                  </button>
                </div>
                <button onClick={() => downloadTemplate('cennik')}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Pobierz szablon XLS
                </button>
              </div>

              {cenImportRows.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Podgląd — <span className="text-green-700">{cenImportRows.length} wierszy</span> gotowych do importu:
                  </p>
                  <div className="overflow-auto border border-gray-200 rounded-lg" style={{ maxHeight: 320 }}>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500">Typ</th>
                          <th className="px-3 py-2 text-left text-gray-500">Kod</th>
                          <th className="px-3 py-2 text-left text-gray-500">Nazwa</th>
                          <th className="px-3 py-2 text-center text-gray-500">JM</th>
                          <th className="px-3 py-2 text-right text-gray-500">Cena [zł]</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cenImportRows.slice(0, 100).map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typBadge[r.typ]}`}>{typLabel[r.typ]}</span>
                            </td>
                            <td className="px-3 py-1.5 font-mono text-gray-500">{r.kod || '—'}</td>
                            <td className="px-3 py-1.5 text-gray-800">{r.nazwa}</td>
                            <td className="px-3 py-1.5 text-center">{r.jm}</td>
                            <td className="px-3 py-1.5 text-right font-semibold">{r.cena.toFixed(2)}</td>
                          </tr>
                        ))}
                        {cenImportRows.length > 100 && (
                          <tr><td colSpan={5} className="px-3 py-2 text-center text-gray-400 text-xs">...i {cenImportRows.length - 100} więcej</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={() => setCenImportModal(false)} className="px-4 py-2 text-sm text-gray-600">Anuluj</button>
              <button onClick={saveCenImport} disabled={cenImportSaving || cenImportRows.length === 0 || !cenImportCennikId}
                className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                {cenImportSaving ? 'Importowanie...' : `Importuj ${cenImportRows.length} pozycji`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Import PDF ── */}
      {pdfImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          onClick={() => { if (!pdfImportLoading && !pdfImportSaving) { setPdfImportModal(false); setPdfImportData(null) } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="text-red-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Import kosztorysu z PDF</h2>
                <p className="text-sm text-gray-500">Claude AI odczytuje strukturę dokumentu i tworzy nowy kosztorys</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {pdfImportLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-700 font-medium">Analizuję plik PDF...</p>
                  <p className="text-gray-400 text-sm">Claude AI odczytuje i przetwarza strukturę kosztorysu</p>
                </div>
              )}

              {!pdfImportLoading && pdfImportData && !pdfImportData.error && (
                <div className="space-y-5">
                  <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-medium tracking-wide">Numer</span>
                      <p className="font-semibold text-gray-900 mt-0.5">{pdfImportData.numer || '(zostanie wygenerowany)'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-medium tracking-wide">Data sporządzenia</span>
                      <p className="font-semibold text-gray-900 mt-0.5">{pdfImportData.data_sporzadzenia}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-gray-500 uppercase font-medium tracking-wide">Nazwa kosztorysu</span>
                      <p className="font-semibold text-gray-900 mt-0.5">{pdfImportData.nazwa}</p>
                    </div>
                    {pdfImportData.inwestor && (
                      <div>
                        <span className="text-xs text-gray-500 uppercase font-medium tracking-wide">Inwestor</span>
                        <p className="text-gray-800 mt-0.5">{pdfImportData.inwestor}</p>
                      </div>
                    )}
                    {pdfImportData.obiekt && (
                      <div>
                        <span className="text-xs text-gray-500 uppercase font-medium tracking-wide">Obiekt</span>
                        <p className="text-gray-800 mt-0.5">{pdfImportData.obiekt}</p>
                      </div>
                    )}
                    <div className="col-span-2">
                      <span className="text-xs text-gray-500 uppercase font-medium tracking-wide">Narzuty</span>
                      <p className="text-gray-800 mt-0.5">
                        <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs mr-1">Kp = {pdfImportData.kp_procent}%</span>
                        <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs mr-1">Kzm = {pdfImportData.kzm_procent}%</span>
                        <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs mr-1">Z = {pdfImportData.z_procent}%</span>
                        <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs">VAT = {pdfImportData.vat_procent}%</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Znalezione pozycje:
                      <span className="text-green-700 font-semibold ml-1">{pdfImportData.pozycje.filter(p => p.typ === 'pozycja').length} pozycji kosztorysowych</span>
                      {pdfImportData.pozycje.some(p => p.typ === 'dzial') && (
                        <span className="text-gray-500 ml-1">+ {pdfImportData.pozycje.filter(p => p.typ === 'dzial').length} działów</span>
                      )}
                    </p>
                    <div className="overflow-auto border border-gray-200 rounded-lg" style={{ maxHeight: 360 }}>
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-500">Lp</th>
                            <th className="px-3 py-2 text-left text-gray-500">KNR</th>
                            <th className="px-3 py-2 text-left text-gray-500">Opis roboty</th>
                            <th className="px-3 py-2 text-center text-gray-500">JM</th>
                            <th className="px-3 py-2 text-right text-gray-500">Ilość</th>
                            <th className="px-3 py-2 text-right text-gray-500">Razem [zł]</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {pdfImportData.pozycje.slice(0, 50).map((p, i) => (
                            p.typ === 'dzial' ? (
                              <tr key={i} className="bg-gray-800">
                                <td colSpan={6} className="px-3 py-2 text-white font-bold">{p.opis.toUpperCase()}</td>
                              </tr>
                            ) : (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-1.5 text-gray-400">{p.lp}</td>
                                <td className="px-3 py-1.5 font-mono text-gray-500 whitespace-nowrap">{p.knr_kod || '—'}</td>
                                <td className="px-3 py-1.5 text-gray-800">{p.opis}</td>
                                <td className="px-3 py-1.5 text-center text-gray-600">{p.jm}</td>
                                <td className="px-3 py-1.5 text-right">{p.ilosc}</td>
                                <td className="px-3 py-1.5 text-right font-semibold">{fmt(p.razem)}</td>
                              </tr>
                            )
                          ))}
                          {pdfImportData.pozycje.length > 50 && (
                            <tr><td colSpan={6} className="px-3 py-2 text-center text-gray-400">...i {pdfImportData.pozycje.length - 50} więcej pozycji</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {!pdfImportLoading && pdfImportData?.error && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
                    <svg className="text-red-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <p className="text-gray-900 font-medium">Nie udało się odczytać kosztorysu</p>
                  <p className="text-gray-500 text-sm mt-1">{pdfImportData.error}</p>
                  <p className="text-gray-400 text-xs mt-2">Upewnij się, że plik zawiera kosztorys inwestorski w formacie tekstowym (nie skanowany obraz)</p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={() => { setPdfImportModal(false); setPdfImportData(null) }}
                disabled={pdfImportLoading || pdfImportSaving}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50">Anuluj</button>
              {pdfImportData && !pdfImportData.error && !pdfImportLoading && (
                <button onClick={savePdfImport} disabled={pdfImportSaving}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {pdfImportSaving
                    ? 'Tworzę kosztorys...'
                    : `Utwórz kosztorys (${pdfImportData.pozycje.filter(p => p.typ === 'pozycja').length} poz.)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Import KNR z PDF ── */}
      {knrPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          onClick={() => { if (!knrPdfLoading && !knrPdfSaving) { setKnrPdfModal(false); setKnrPdfData(null) } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="text-red-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Import katalogów KNR z PDF</h2>
                <p className="text-sm text-gray-500">Claude AI odczytuje spis KNR i importuje katalogi oraz pozycje</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {knrPdfLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-700 font-medium">Analizuję spis KNR...</p>
                  <p className="text-gray-400 text-sm">Claude AI odczytuje kody i nazwy katalogów</p>
                </div>
              )}
              {!knrPdfLoading && knrPdfData && !knrPdfData.error && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex-1 text-center">
                      <div className="text-2xl font-bold text-green-700">{knrPdfData.katalogi.length}</div>
                      <div className="text-sm text-green-600 mt-1">Katalogów KNR</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex-1 text-center">
                      <div className="text-2xl font-bold text-blue-700">{knrPdfData.pozycje.length}</div>
                      <div className="text-sm text-blue-600 mt-1">Pozycji (bez norm)</div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Katalogi do importu (pierwsze 20)</p>
                    <div className="overflow-auto border border-gray-200 rounded-lg" style={{ maxHeight: 280 }}>
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-500">Kod</th>
                            <th className="px-3 py-2 text-left text-gray-500">Nazwa katalogu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {knrPdfData.katalogi.slice(0, 50).map((k, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-1.5 font-mono font-semibold text-gray-700 whitespace-nowrap">{k.kod}</td>
                              <td className="px-3 py-1.5 text-gray-800">{k.nazwa}</td>
                            </tr>
                          ))}
                          {knrPdfData.katalogi.length > 50 && (
                            <tr><td colSpan={2} className="px-3 py-2 text-center text-gray-400">...i {knrPdfData.katalogi.length - 50} więcej</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {knrPdfData.pozycje.length > 0 && (
                    <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      Pozycje zostaną zaimportowane z kodem i nazwą. Normy R/M/S będą wynosić 0 — uzupełnij je ręcznie lub przez import Excel.
                    </p>
                  )}
                </div>
              )}
              {!knrPdfLoading && knrPdfData?.error && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
                    <svg className="text-red-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <p className="text-gray-900 font-medium">Nie udało się odczytać katalogów KNR</p>
                  <p className="text-gray-500 text-sm mt-1">{knrPdfData.error}</p>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={() => { setKnrPdfModal(false); setKnrPdfData(null) }}
                disabled={knrPdfLoading || knrPdfSaving}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50">Anuluj</button>
              {knrPdfData && !knrPdfData.error && !knrPdfLoading && (
                <button onClick={saveKnrPdfImport} disabled={knrPdfSaving}
                  className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {knrPdfSaving ? 'Importuję...' : `Importuj ${knrPdfData.katalogi.length} katalogów`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Kosztorys AI ── */}
      {aiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => { if (!aiLoading && !aiSaving) setAiModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col" style={{ maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="p-5 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 text-xl">🤖</div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Kosztorys AI — analiza projektu</h2>
                <p className="text-sm text-gray-500">AI opracuje szczegółowy zakres prac wg KNR z wyceną z cennika RMS</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* Formularz wejściowy */}
              {!aiResult && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className={labelCls}>Opis projektu / inwestycji *</label>
                    <textarea
                      value={aiOpis}
                      onChange={e => setAiOpis(e.target.value)}
                      rows={6}
                      className={inputCls}
                      placeholder="Opisz zakres inwestycji: np. Budowa gazociągu średniego ciśnienia DN110 PE100 o długości 350m wraz z przyłączami do 5 budynków mieszkalnych. Obszar miejski, warunki standardowe, głębokość posadowienia 1,2m."
                    />
                  </div>

                  <div className="border-2 border-dashed border-violet-200 rounded-xl p-4">
                    {aiFiles.length > 0 ? (
                      <div className="space-y-1.5">
                        {aiFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-1.5">
                            <span className="text-violet-500 text-sm">📎</span>
                            <span className="text-violet-800 text-sm font-medium flex-1 truncate">{f.name}</span>
                            <button onClick={() => setAiFiles(prev => prev.filter((_, j) => j !== i))}
                              className="text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">✕</button>
                          </div>
                        ))}
                        <div className="flex justify-center pt-1">
                          <button onClick={() => aiFileRef.current?.click()}
                            className="px-3 py-1.5 border border-violet-300 text-violet-600 rounded-lg text-xs hover:bg-violet-50 transition-colors">
                            + Dodaj kolejny plik
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm text-gray-500 mb-2">Opcjonalnie — załącz dokumentację projektu (PDF, zdjęcia)</p>
                        <button onClick={() => aiFileRef.current?.click()}
                          className="px-4 py-2 border border-violet-300 text-violet-700 rounded-lg text-sm hover:bg-violet-50 transition-colors">
                          📎 Załącz pliki projektu
                        </button>
                        <p className="text-xs text-gray-400 mt-1.5">Możesz wybrać wiele plików jednocześnie</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-violet-800 mb-1">Jak działa Kosztorys AI:</p>
                    <ul className="text-xs text-violet-700 space-y-0.5 list-disc list-inside">
                      <li>AI analizuje opis i dokumenty projektu</li>
                      <li>Dobiera pozycje z katalogu KNR odpowiednie dla zakresu prac</li>
                      <li>Wycenia każdą pozycję na podstawie cennika RMS</li>
                      <li>Możesz edytować ilości i ceny przed importem</li>
                      <li>Gotowy kosztorys trafia do zakładki KOSZTORYSY</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Ładowanie */}
              {aiLoading && (
                <div className="flex flex-col items-center justify-center py-20 gap-5">
                  <div className="w-14 h-14 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-center">
                    <p className="text-gray-800 font-semibold text-lg">AI analizuje projekt...</p>
                    <p className="text-gray-500 text-sm mt-1">Trwa dobór pozycji KNR i wycena z cennika RMS</p>
                    <p className="text-gray-400 text-xs mt-0.5">Może potrwać do 60 sekund</p>
                  </div>
                </div>
              )}

              {/* Wyniki AI */}
              {!aiLoading && aiResult && !aiResult.error && (
                <div className="p-5 space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-green-600 text-xl">✅</span>
                    <div>
                      <p className="text-sm font-semibold text-green-800">{aiResult.nazwa}</p>
                      <p className="text-xs text-green-700">
                        {aiResult.pozycje.filter(p => p.typ === 'pozycja').length} pozycji kosztorysowych
                        {aiResult.pozycje.some(p => p.typ === 'dzial') && ` • ${aiResult.pozycje.filter(p => p.typ === 'dzial').length} działów`}
                        {' '}• Kp={aiResult.kp_procent}% Kzm={aiResult.kzm_procent}% Z={aiResult.z_procent}% VAT={aiResult.vat_procent}%
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500">Możesz edytować ilości i ceny jednostkowe przed importem. Kliknij wartość aby zmienić.</p>

                  <div className="overflow-auto border border-gray-200 rounded-xl" style={{ maxHeight: '45vh' }}>
                    <table className="w-full text-xs min-w-[900px]">
                      <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                        <tr>
                          <th className="px-2 py-2 text-center text-gray-500 w-8">Lp</th>
                          <th className="px-2 py-2 text-left text-gray-500 w-24">KNR</th>
                          <th className="px-2 py-2 text-left text-gray-500">Opis roboty / materiału</th>
                          <th className="px-2 py-2 text-center text-gray-500 w-12">JM</th>
                          <th className="px-2 py-2 text-right text-gray-500 w-20">Ilość</th>
                          <th className="px-2 py-2 text-right text-orange-600 w-20">R/jm</th>
                          <th className="px-2 py-2 text-right text-blue-600 w-20">M/jm</th>
                          <th className="px-2 py-2 text-right text-purple-600 w-20">S/jm</th>
                          <th className="px-2 py-2 text-right text-gray-700 font-semibold w-24">Razem zł</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiResult.pozycje.map((p, idx) => {
                          if (p.typ === 'dzial') return (
                            <tr key={idx} className="bg-gray-800">
                              <td className="px-2 py-1.5 text-center text-gray-400 text-[10px]">{p.lp}</td>
                              <td colSpan={8} className="px-2 py-1.5 font-bold text-white uppercase tracking-wide">{p.opis}</td>
                            </tr>
                          )
                          if (p.typ === 'nota') return (
                            <tr key={idx} className="bg-yellow-50">
                              <td></td>
                              <td colSpan={8} className="px-2 py-1.5 italic text-gray-500">{p.opis}</td>
                            </tr>
                          )
                          return (
                            <tr key={idx} className={`border-b border-gray-100 hover:bg-violet-50/30 ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                              <td className="px-2 py-1 text-center text-gray-400">{p.lp}</td>
                              <td className="px-2 py-1 font-mono text-gray-400 text-[10px]">{p.knr_kod || '—'}</td>
                              <td className="px-2 py-1 text-gray-800">{p.opis}</td>
                              <td className="px-2 py-1 text-center text-gray-500">{p.jm}</td>
                              <td className="px-2 py-1">
                                <input type="number" step="0.001" value={p.ilosc}
                                  onChange={e => updateAiPoz(idx, 'ilosc', parseFloat(e.target.value) || 0)}
                                  className="w-full text-right text-xs border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 focus:outline-none bg-transparent focus:bg-white" />
                              </td>
                              <td className="px-2 py-1">
                                <input type="number" step="0.01" value={p.r_j}
                                  onChange={e => updateAiPoz(idx, 'r_j', parseFloat(e.target.value) || 0)}
                                  className="w-full text-right text-xs border border-transparent hover:border-gray-300 focus:border-orange-400 rounded px-1 py-0.5 focus:outline-none bg-transparent focus:bg-white text-orange-700" />
                              </td>
                              <td className="px-2 py-1">
                                <input type="number" step="0.01" value={p.m_j}
                                  onChange={e => updateAiPoz(idx, 'm_j', parseFloat(e.target.value) || 0)}
                                  className="w-full text-right text-xs border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 focus:outline-none bg-transparent focus:bg-white text-blue-700" />
                              </td>
                              <td className="px-2 py-1">
                                <input type="number" step="0.01" value={p.s_j}
                                  onChange={e => updateAiPoz(idx, 's_j', parseFloat(e.target.value) || 0)}
                                  className="w-full text-right text-xs border border-transparent hover:border-gray-300 focus:border-purple-400 rounded px-1 py-0.5 focus:outline-none bg-transparent focus:bg-white text-purple-700" />
                              </td>
                              <td className="px-2 py-1 text-right font-semibold text-gray-900">{fmt(p.razem)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Suma */}
                  <div className="flex justify-end">
                    <div className="bg-violet-50 border border-violet-200 rounded-xl px-6 py-3 text-right">
                      <p className="text-xs text-gray-500">Wartość kosztorysowa (netto po narzutach)</p>
                      <p className="text-2xl font-bold text-violet-800">
                        {fmt(aiResult.pozycje.reduce((s, p) => s + (p.razem || 0), 0))} zł
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Błąd AI */}
              {!aiLoading && aiResult?.error && (
                <div className="flex flex-col items-center justify-center py-12 text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3 text-2xl">❌</div>
                  <p className="text-gray-900 font-semibold">Błąd analizy AI</p>
                  <p className="text-gray-500 text-sm mt-1">{aiResult.error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-200 flex gap-3 justify-between flex-shrink-0 flex-wrap">
              <div className="flex gap-2">
                {aiResult && !aiLoading && (
                  <button onClick={() => { setAiResult(null) }}
                    className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                    ← Wróć do opisu
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { if (!aiLoading && !aiSaving) setAiModal(false) }}
                  disabled={aiLoading || aiSaving}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50">Anuluj</button>
                {!aiResult && !aiLoading && (
                  <button onClick={runAiAnaliza} disabled={!aiOpis.trim() && aiFiles.length === 0}
                    className="px-6 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
                    🤖 Analizuj projekt
                  </button>
                )}
                {aiResult && !aiResult.error && !aiLoading && (
                  <button onClick={saveAiKosztorys} disabled={aiSaving}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {aiSaving ? 'Tworzę kosztorys...' : `📥 Importuj do kosztorysu (${aiResult.pozycje.filter(p => p.typ === 'pozycja').length} poz.)`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* hidden file inputs */}
      <input ref={knrFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleKnrFileSelect} className="hidden" />
      <input ref={cenFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleCenFileSelect} className="hidden" />
      <input ref={pdfFileRef} type="file" accept=".pdf" onChange={handlePdfFileSelect} className="hidden" />
      <input ref={knrPdfFileRef} type="file" accept=".pdf" onChange={handleKnrPdfFileSelect} className="hidden" />
      <input ref={aiFileRef} type="file" accept=".pdf,image/*" multiple onChange={handleAiFileSelect} className="hidden" />
    </div>
  )
}
