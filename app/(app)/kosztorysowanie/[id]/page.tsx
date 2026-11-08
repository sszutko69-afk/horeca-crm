'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { generateKosztorysPDF } from '@/lib/kosztorys-pdf'

// ── Types ────────────────────────────────────────────────────────────────────

type Kosztorys = {
  id: string; numer: string; nazwa: string; inwestor: string | null
  obiekt: string | null; lokalizacja: string | null; data_sporzadzenia: string
  status: 'szkic' | 'zatwierdzone' | 'anulowane'; uwagi: string | null
  kp_procent: number; kzm_procent: number; z_procent: number; vat_procent: number
  razem_r: number; razem_m: number; razem_s: number
  razem_bezposrednie: number; razem_kp: number; razem_kzm: number
  razem_z: number; razem_netto: number; razem_vat: number; razem_brutto: number
}

type Pozycja = {
  id: string; kosztorys_id: string; lp: number
  typ: 'pozycja' | 'dzial' | 'nota'
  knr_kod: string | null; opis: string; jm: string | null
  ilosc: number; r_j: number; m_j: number; s_j: number
  r_wartosc: number; m_wartosc: number; s_wartosc: number
  bezposrednie: number; kp_wartosc: number; kzm_wartosc: number
  z_wartosc: number; razem: number; uwagi: string | null
}

type KnrKatalog = { id: string; kod: string; nazwa: string }
type KnrPozycja = {
  id: string; katalog_id: string; kod: string; nazwa: string; jm: string
  r_norma: number; m_norma: number; s_norma: number
}
type CennikPozycja = { id: string; nazwa: string; jm: string; typ: 'M'|'R'|'S'; cena: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt2 = (v: number) => new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
const n = (v: number | null | undefined) => v ?? 0

const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'
const labelCls = 'text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1'
const numCls = 'px-2 py-1.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400 w-full'

// ── Kalkulacja pozycji ────────────────────────────────────────────────────────

function calcPoz(p: Partial<Pozycja>, kp: number, kzm: number, z: number): Partial<Pozycja> {
  const r_w = (p.ilosc || 0) * (p.r_j || 0)
  const m_w = (p.ilosc || 0) * (p.m_j || 0)
  const s_w = (p.ilosc || 0) * (p.s_j || 0)
  const bezp = r_w + m_w + s_w
  const kp_w = (r_w + s_w) * kp / 100
  const kzm_w = m_w * kzm / 100
  const z_w = (r_w + s_w + kp_w) * z / 100
  const razem = bezp + kp_w + kzm_w + z_w
  return { r_wartosc: r_w, m_wartosc: m_w, s_wartosc: s_w, bezposrednie: bezp, kp_wartosc: kp_w, kzm_wartosc: kzm_w, z_wartosc: z_w, razem }
}

// ── Główny komponent ──────────────────────────────────────────────────────────

export default function KosztorysEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [kos, setKos] = useState<Kosztorys | null>(null)
  const [pozycje, setPozycje] = useState<Pozycja[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Forma nagłówka
  const [hForm, setHForm] = useState({
    numer: '', nazwa: '', inwestor: '', obiekt: '', lokalizacja: '', uwagi: '',
    data_sporzadzenia: '', status: 'szkic',
    kp_procent: '68', kzm_procent: '20', z_procent: '10', vat_procent: '23',
  })

  // Modals
  const [pozModal, setPozModal] = useState(false)
  const [editPoz, setEditPoz] = useState<Pozycja | null>(null)
  const [pozForm, setPozForm] = useState({
    typ: 'pozycja' as 'pozycja'|'dzial'|'nota',
    knr_kod: '', opis: '', jm: 'm2', ilosc: '1',
    r_j: '0', m_j: '0', s_j: '0', uwagi: '',
  })

  // KNR picker
  const [knrPickerOpen, setKnrPickerOpen] = useState(false)
  const [katalogi, setKatalogi] = useState<KnrKatalog[]>([])
  const [knrPozycje, setKnrPozycje] = useState<KnrPozycja[]>([])
  const [selectedKat, setSelectedKat] = useState<string>('')
  const [knrSearch, setKnrSearch] = useState('')
  const [knrGlobalResults, setKnrGlobalResults] = useState<(KnrPozycja & { katalog_kod: string; katalog_nazwa: string })[]>([])
  const [knrGlobalLoading, setKnrGlobalLoading] = useState(false)

  // Cennik picker (dla R/M/S cen)
  const [cenPickerOpen, setCenPickerOpen] = useState(false)
  const [cenPickerTyp, setCenPickerTyp] = useState<'M'|'R'|'S'>('M')
  const [cennikAll, setCennikAll] = useState<CennikPozycja[]>([])
  const [cenSearch, setCenSearch] = useState('')

  // Cenniki R/M/S (do inline picker w KNR)
  const [cennikR, setCennikR] = useState<CennikPozycja[]>([])
  const [cennikM, setCennikM] = useState<CennikPozycja[]>([])
  const [cennikS, setCennikS] = useState<CennikPozycja[]>([])
  const [cennikTab, setCennikTab] = useState<'R'|'M'|'S'>('R')
  const [cennikInlineSearch, setCennikInlineSearch] = useState('')

  // Save-to-catalog helpers
  const [showSaveKnr, setShowSaveKnr] = useState(false)
  const [saveKnrKat, setSaveKnrKat] = useState('')

  // Save-to-cennik helpers
  const [showSaveCennik, setShowSaveCennik] = useState(false)
  const [saveCennikId, setSaveCennikId] = useState('')
  const [availCenniki, setAvailCenniki] = useState<{ id: string; nazwa: string }[]>([])

  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [headerExpanded, setHeaderExpanded] = useState(true)

  function showMsg(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  // ── Load ─────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: k }, { data: poz }] = await Promise.all([
      supabase.from('kosztorysy').select('*').eq('id', id).single(),
      supabase.from('kosztorysy_pozycje').select('*').eq('kosztorys_id', id).order('lp'),
    ])
    if (k) {
      setKos(k)
      setHForm({
        numer: k.numer, nazwa: k.nazwa,
        inwestor: k.inwestor || '', obiekt: k.obiekt || '',
        lokalizacja: k.lokalizacja || '', uwagi: k.uwagi || '',
        data_sporzadzenia: k.data_sporzadzenia, status: k.status,
        kp_procent: String(k.kp_procent), kzm_procent: String(k.kzm_procent),
        z_procent: String(k.z_procent), vat_procent: String(k.vat_procent),
      })
    }
    setPozycje(poz || [])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // Globalne wyszukiwanie KNR (debounce 300ms)
  useEffect(() => {
    if (!knrPickerOpen || knrSearch.length < 2) { setKnrGlobalResults([]); return }
    const t = setTimeout(async () => {
      setKnrGlobalLoading(true)
      const { data } = await supabase
        .from('knr_pozycje')
        .select('*, knr_katalogi(kod, nazwa)')
        .or(`nazwa.ilike.%${knrSearch}%,kod.ilike.%${knrSearch}%`)
        .limit(150)
      setKnrGlobalResults((data || []).map((p: any) => ({
        ...p,
        katalog_kod: p.knr_katalogi?.kod || '',
        katalog_nazwa: p.knr_katalogi?.nazwa || '',
      })))
      setKnrGlobalLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [knrSearch, knrPickerOpen])

  // Ładuj cenniki przy pierwszym otwarciu pickera
  useEffect(() => {
    if (!knrPickerOpen) return
    supabase.from('cenniki_pozycje').select('id,nazwa,jm,typ,cena').eq('typ','R').order('nazwa').then(({data}) => setCennikR(data||[]))
    supabase.from('cenniki_pozycje').select('id,nazwa,jm,typ,cena').eq('typ','M').order('nazwa').then(({data}) => setCennikM(data||[]))
    supabase.from('cenniki_pozycje').select('id,nazwa,jm,typ,cena').eq('typ','S').order('nazwa').then(({data}) => setCennikS(data||[]))
  }, [knrPickerOpen])

  // Przelicz sumy po zmianie pozycji lub narzutów
  const kpP = parseFloat(hForm.kp_procent) || 0
  const kzmP = parseFloat(hForm.kzm_procent) || 0
  const zP = parseFloat(hForm.z_procent) || 0
  const vatP = parseFloat(hForm.vat_procent) || 0

  const summary = {
    razem_r: pozycje.reduce((a, p) => a + n(p.r_wartosc), 0),
    razem_m: pozycje.reduce((a, p) => a + n(p.m_wartosc), 0),
    razem_s: pozycje.reduce((a, p) => a + n(p.s_wartosc), 0),
    razem_kp: pozycje.reduce((a, p) => a + n(p.kp_wartosc), 0),
    razem_kzm: pozycje.reduce((a, p) => a + n(p.kzm_wartosc), 0),
    razem_z: pozycje.reduce((a, p) => a + n(p.z_wartosc), 0),
  }
  const razem_bezp = summary.razem_r + summary.razem_m + summary.razem_s
  const razem_netto = razem_bezp + summary.razem_kp + summary.razem_kzm + summary.razem_z
  const razem_vat = razem_netto * vatP / 100
  const razem_brutto = razem_netto + razem_vat

  // ── Zapisz nagłówek ───────────────────────────────────────────────────────────

  async function saveHeader() {
    setSaving(true)
    await supabase.from('kosztorysy').update({
      ...hForm,
      kp_procent: kpP, kzm_procent: kzmP, z_procent: zP, vat_procent: vatP,
      razem_r: summary.razem_r, razem_m: summary.razem_m, razem_s: summary.razem_s,
      razem_bezposrednie: razem_bezp,
      razem_kp: summary.razem_kp, razem_kzm: summary.razem_kzm, razem_z: summary.razem_z,
      razem_netto, razem_vat, razem_brutto,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    // Przelicz pozycje na nowo jeśli narzuty się zmieniły
    await recalcAllPozycje()
    showMsg('Kosztorys zapisany')
    setSaving(false)
  }

  async function recalcAllPozycje() {
    for (const p of pozycje) {
      const updated = calcPoz(p, kpP, kzmP, zP)
      await supabase.from('kosztorysy_pozycje').update(updated).eq('id', p.id)
    }
    // reload
    const { data } = await supabase.from('kosztorysy_pozycje').select('*').eq('kosztorys_id', id).order('lp')
    setPozycje(data || [])
  }

  // ── Pozycje CRUD ──────────────────────────────────────────────────────────────

  function openNewPoz(typ: 'pozycja'|'dzial'|'nota' = 'pozycja') {
    setPozForm({ typ, knr_kod: '', opis: '', jm: 'm2', ilosc: '1', r_j: '0', m_j: '0', s_j: '0', uwagi: '' })
    setEditPoz(null)
    setShowSaveKnr(false)
    setShowSaveCennik(false)
    setPozModal(true)
  }

  function openEditPoz(p: Pozycja) {
    setPozForm({
      typ: p.typ, knr_kod: p.knr_kod || '', opis: p.opis, jm: p.jm || '',
      ilosc: String(p.ilosc), r_j: String(p.r_j), m_j: String(p.m_j), s_j: String(p.s_j),
      uwagi: p.uwagi || '',
    })
    setEditPoz(p)
    setShowSaveKnr(false)
    setShowSaveCennik(false)
    setPozModal(true)
  }

  async function savePoz() {
    if (!pozForm.opis.trim()) return showMsg('Podaj opis roboty', false)

    const base = {
      typ: pozForm.typ,
      knr_kod: pozForm.knr_kod || null,
      opis: pozForm.opis,
      jm: pozForm.jm || null,
      ilosc: parseFloat(pozForm.ilosc) || 0,
      r_j: parseFloat(pozForm.r_j) || 0,
      m_j: parseFloat(pozForm.m_j) || 0,
      s_j: parseFloat(pozForm.s_j) || 0,
      uwagi: pozForm.uwagi || null,
    }
    const calc = calcPoz(base, kpP, kzmP, zP)
    const full = { ...base, ...calc }

    if (editPoz) {
      await supabase.from('kosztorysy_pozycje').update(full).eq('id', editPoz.id)
    } else {
      const nextLp = pozycje.length > 0 ? Math.max(...pozycje.map(p => p.lp)) + 1 : 1
      await supabase.from('kosztorysy_pozycje').insert({ ...full, kosztorys_id: id, lp: nextLp })
    }
    setPozModal(false)
    await refreshPoz()
    showMsg('Pozycja zapisana')
  }

  async function deletePoz(pozId: string) {
    if (!confirm('Usunąć pozycję?')) return
    await supabase.from('kosztorysy_pozycje').delete().eq('id', pozId)
    await refreshPoz()
    showMsg('Usunięto')
  }

  async function movePoz(pozId: string, dir: 'up' | 'down') {
    const idx = pozycje.findIndex(p => p.id === pozId)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === pozycje.length - 1) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    const newPoz = [...pozycje]
    const a = newPoz[idx], b = newPoz[swapIdx]
    await Promise.all([
      supabase.from('kosztorysy_pozycje').update({ lp: b.lp }).eq('id', a.id),
      supabase.from('kosztorysy_pozycje').update({ lp: a.lp }).eq('id', b.id),
    ])
    await refreshPoz()
  }

  async function refreshPoz() {
    const { data } = await supabase.from('kosztorysy_pozycje').select('*').eq('kosztorys_id', id).order('lp')
    setPozycje(data || [])
  }

  // ── KNR Picker ────────────────────────────────────────────────────────────────

  async function openKnrPicker() {
    const { data: kats } = await supabase.from('knr_katalogi').select('id, kod, nazwa').order('kod')
    setKatalogi(kats || [])
    if (kats && kats.length > 0) {
      setSelectedKat(kats[0].id)
      const { data: poz } = await supabase.from('knr_pozycje').select('*').eq('katalog_id', kats[0].id).order('kod')
      setKnrPozycje(poz || [])
    }
    setKnrSearch('')
    setKnrPickerOpen(true)
  }

  async function changeKat(katId: string) {
    setSelectedKat(katId)
    const { data } = await supabase.from('knr_pozycje').select('*').eq('katalog_id', katId).order('kod')
    setKnrPozycje(data || [])
    setKnrSearch('')
  }

  function selectKnrPoz(p: KnrPozycja) {
    const kat = katalogi.find(k => k.id === p.katalog_id)
    const knrKod = kat ? `${kat.kod} ${p.kod}` : p.kod
    setPozForm(f => ({ ...f, knr_kod: knrKod, opis: p.nazwa, jm: p.jm, r_j: String(p.r_norma), m_j: String(p.m_norma), s_j: String(p.s_norma) }))
    setKnrPickerOpen(false)
    setPozModal(true)
  }

  // ── Cennik picker ─────────────────────────────────────────────────────────────

  async function openCenPicker(typ: 'M'|'R'|'S') {
    setCenPickerTyp(typ)
    setCenSearch('')
    const { data } = await supabase.from('cenniki_pozycje').select('id, nazwa, jm, typ, cena').eq('typ', typ).order('nazwa')
    setCennikAll(data || [])
    setCenPickerOpen(true)
  }

  function selectCen(cp: CennikPozycja) {
    if (cenPickerTyp === 'R') setPozForm(f => ({ ...f, r_j: String(cp.cena) }))
    if (cenPickerTyp === 'M') setPozForm(f => ({ ...f, m_j: String(cp.cena) }))
    if (cenPickerTyp === 'S') setPozForm(f => ({ ...f, s_j: String(cp.cena) }))
    setCenPickerOpen(false)
  }

  // ── Zapis pozycji do KNR / cennika ────────────────────────────────────────────

  async function onSaveToKnr() {
    setShowSaveKnr(true)
    if (katalogi.length === 0) {
      const { data: kats } = await supabase.from('knr_katalogi').select('id, kod, nazwa').order('kod')
      setKatalogi(kats || [])
      if (kats && kats.length > 0) setSaveKnrKat(kats[0].id)
    } else if (!saveKnrKat && katalogi.length > 0) {
      setSaveKnrKat(katalogi[0].id)
    }
  }

  async function savePozToKnr() {
    if (!saveKnrKat) return showMsg('Wybierz katalog KNR', false)
    const { error } = await supabase.from('knr_pozycje').insert({
      katalog_id: saveKnrKat,
      kod: pozForm.knr_kod || 'RĘCZNE',
      nazwa: pozForm.opis,
      jm: pozForm.jm || 'szt',
      r_norma: parseFloat(pozForm.r_j) || 0,
      m_norma: parseFloat(pozForm.m_j) || 0,
      s_norma: parseFloat(pozForm.s_j) || 0,
    })
    if (error) return showMsg('Błąd zapisu: ' + error.message, false)
    showMsg('Dodano do katalogu KNR ✓')
    setShowSaveKnr(false)
  }

  async function onSaveToCennik() {
    setShowSaveCennik(true)
    if (availCenniki.length === 0) {
      const { data } = await supabase.from('cenniki').select('id, nazwa').order('nazwa')
      setAvailCenniki(data || [])
      if (data && data.length > 0 && !saveCennikId) setSaveCennikId(data[0].id)
    } else if (!saveCennikId && availCenniki.length > 0) {
      setSaveCennikId(availCenniki[0].id)
    }
  }

  async function savePozToCennik() {
    if (!saveCennikId) return showMsg('Wybierz cennik docelowy', false)
    const inserts: { cennik_id: string; nazwa: string; jm: string; typ: 'R'|'M'|'S'; cena: number }[] = []
    const r = parseFloat(pozForm.r_j) || 0
    const m = parseFloat(pozForm.m_j) || 0
    const s = parseFloat(pozForm.s_j) || 0
    const opis = pozForm.opis
    const jm = pozForm.jm || 'szt'
    if (r > 0) inserts.push({ cennik_id: saveCennikId, nazwa: opis, jm, typ: 'R', cena: r })
    if (m > 0) inserts.push({ cennik_id: saveCennikId, nazwa: opis, jm, typ: 'M', cena: m })
    if (s > 0) inserts.push({ cennik_id: saveCennikId, nazwa: opis, jm, typ: 'S', cena: s })
    if (inserts.length === 0) return showMsg('Brak cen do zapisania (R, M i S = 0)', false)
    const { error } = await supabase.from('cenniki_pozycje').insert(inserts)
    if (error) return showMsg('Błąd zapisu: ' + error.message, false)
    showMsg(`Dodano ${inserts.length} poz. do cennika ✓`)
    setShowSaveCennik(false)
  }

  // ── Generuj ofertę AI → .docx ────────────────────────────────────────────────

  const [ofertaLoading, setOfertaLoading] = useState(false)

  async function generujOferte() {
    if (!kos) return
    setOfertaLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/przetargi/generuj-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tryb: 'oferta_kosztorys',
          kosztorys: {
            numer: hForm.numer,
            nazwa: hForm.nazwa,
            inwestor: hForm.inwestor || '',
            obiekt: hForm.obiekt || '',
            lokalizacja: hForm.lokalizacja || '',
            uwagi: hForm.uwagi || '',
            data: hForm.data_sporzadzenia,
            razem_netto,
            razem_vat,
            razem_brutto,
            pozycje: pozycje.filter(p => p.typ === 'pozycja').map(p => ({
              lp: p.lp, opis: p.opis, jm: p.jm, ilosc: p.ilosc, razem: p.razem,
            })),
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Oferta_${hForm.numer.replace(/[/\\]/g, '-')}.docx`
      a.click()
      URL.revokeObjectURL(url)
      setMsg({ ok: true, text: 'Oferta wygenerowana i pobrana!' })
    } catch (e: any) {
      setMsg({ ok: false, text: 'Błąd generowania oferty: ' + e.message })
    }
    setOfertaLoading(false)
  }

  // ── Generuj PDF ───────────────────────────────────────────────────────────────

  async function handleGeneratePDF() {
    if (!kos) return
    const kosForPDF: Kosztorys = {
      ...kos,
      numer: hForm.numer, nazwa: hForm.nazwa,
      inwestor: hForm.inwestor || null, obiekt: hForm.obiekt || null,
      lokalizacja: hForm.lokalizacja || null, uwagi: hForm.uwagi || null,
      data_sporzadzenia: hForm.data_sporzadzenia,
      status: hForm.status as Kosztorys['status'],
      kp_procent: kpP, kzm_procent: kzmP, z_procent: zP, vat_procent: vatP,
      razem_r: summary.razem_r, razem_m: summary.razem_m, razem_s: summary.razem_s,
      razem_bezposrednie: razem_bezp,
      razem_kp: summary.razem_kp, razem_kzm: summary.razem_kzm, razem_z: summary.razem_z,
      razem_netto, razem_vat, razem_brutto,
    }
    await generateKosztorysPDF(kosForPDF, pozycje)
  }

  function handlePrint() { window.print() }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-400">Ładowanie kosztorysu...</div>
    </div>
  )
  if (!kos) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-red-500">Nie znaleziono kosztorysu</div>
    </div>
  )

  const filteredKnrPoz = knrPozycje.filter(p =>
    p.nazwa.toLowerCase().includes(knrSearch.toLowerCase()) ||
    p.kod.toLowerCase().includes(knrSearch.toLowerCase())
  )
  const filteredCen = cennikAll.filter(p =>
    p.nazwa.toLowerCase().includes(cenSearch.toLowerCase())
  )

  return (
    <div className="p-4 max-w-screen-xl mx-auto">
      {/* Komunikat */}
      {msg && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium
          ${msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.ok ? '✓ ' : '✗ '}{msg.text}
        </div>
      )}

      {/* Topbar */}
      <div className="flex items-center gap-3 mb-4 print:hidden flex-wrap">
        <button onClick={() => router.push('/kosztorysowanie')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Powrót
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-mono text-sm text-gray-500">{kos.numer}</span>
        <h1 className="text-lg font-bold text-gray-900 truncate">{kos.nazwa}</h1>
        <div className="ml-auto flex gap-2">
          <button onClick={generujOferte} disabled={ofertaLoading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {ofertaLoading ? '⏳' : '🤖'} {ofertaLoading ? 'Generowanie...' : 'Oferta .docx'}
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Drukuj
          </button>
          <button onClick={handleGeneratePDF}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Generuj PDF
          </button>
          <button onClick={saveHeader} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            {saving ? 'Zapisywanie...' : 'Zapisz kosztorys'}
          </button>
        </div>
      </div>

      {/* ── NAGŁÓWEK KOSZTORYSU ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 print:shadow-none print:border-gray-400">
        <button onClick={() => setHeaderExpanded(v => !v)}
          className="w-full px-4 py-3 flex items-center gap-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors rounded-t-xl print:hidden">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className={`transition-transform ${headerExpanded ? 'rotate-90' : ''}`}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          Dane kosztorysu
        </button>

        {/* Print header */}
        <div className="hidden print:block p-4 border-b border-gray-300">
          <div className="text-center mb-3">
            <h1 className="text-xl font-bold">{kos.nazwa}</h1>
            <p className="text-sm text-gray-600">Nr: {kos.numer} • Data: {kos.data_sporzadzenia}</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="font-medium">Inwestor:</span> {kos.inwestor || '—'}</div>
            <div><span className="font-medium">Obiekt:</span> {kos.obiekt || '—'}</div>
            <div><span className="font-medium">Lokalizacja:</span> {kos.lokalizacja || '—'}</div>
          </div>
        </div>

        {headerExpanded && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-100 print:hidden">
            <div>
              <label className={labelCls}>Numer</label>
              <input value={hForm.numer} onChange={e => setHForm(f => ({ ...f, numer: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Nazwa kosztorysu</label>
              <input value={hForm.nazwa} onChange={e => setHForm(f => ({ ...f, nazwa: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={hForm.status} onChange={e => setHForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                <option value="szkic">Szkic</option>
                <option value="zatwierdzone">Zatwierdzone</option>
                <option value="anulowane">Anulowane</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Inwestor</label>
              <input value={hForm.inwestor} onChange={e => setHForm(f => ({ ...f, inwestor: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Obiekt</label>
              <input value={hForm.obiekt} onChange={e => setHForm(f => ({ ...f, obiekt: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Lokalizacja</label>
              <input value={hForm.lokalizacja} onChange={e => setHForm(f => ({ ...f, lokalizacja: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Data sporządzenia</label>
              <input type="date" value={hForm.data_sporzadzenia} onChange={e => setHForm(f => ({ ...f, data_sporzadzenia: e.target.value }))} className={inputCls} />
            </div>

            {/* Narzuty */}
            <div className="col-span-4">
              <div className="border-t border-gray-100 pt-4 mt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Narzuty i podatek</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-medium text-orange-600 block mb-1">Kp % (od R+S)</label>
                    <input type="number" step="0.1" value={hForm.kp_procent}
                      onChange={e => setHForm(f => ({ ...f, kp_procent: e.target.value }))}
                      className={inputCls} />
                    <p className="text-xs text-gray-400 mt-0.5">Koszty pośrednie</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-blue-600 block mb-1">Kzm % (od M)</label>
                    <input type="number" step="0.1" value={hForm.kzm_procent}
                      onChange={e => setHForm(f => ({ ...f, kzm_procent: e.target.value }))}
                      className={inputCls} />
                    <p className="text-xs text-gray-400 mt-0.5">Koszty zakupu materiałów</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-green-600 block mb-1">Z % (od R+S+Kp)</label>
                    <input type="number" step="0.1" value={hForm.z_procent}
                      onChange={e => setHForm(f => ({ ...f, z_procent: e.target.value }))}
                      className={inputCls} />
                    <p className="text-xs text-gray-400 mt-0.5">Zysk</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">VAT %</label>
                    <input type="number" step="1" value={hForm.vat_procent}
                      onChange={e => setHForm(f => ({ ...f, vat_procent: e.target.value }))}
                      className={inputCls} />
                    <p className="text-xs text-gray-400 mt-0.5">Podatek VAT</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-4">
              <label className={labelCls}>Uwagi</label>
              <textarea value={hForm.uwagi} onChange={e => setHForm(f => ({ ...f, uwagi: e.target.value }))}
                className={inputCls} rows={2} />
            </div>
          </div>
        )}
      </div>

      {/* ── POZYCJE ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 overflow-hidden print:shadow-none print:border-gray-400">
        {/* Toolbar pozycji */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap print:hidden">
          <span className="text-sm font-semibold text-gray-700">Pozycje kosztorysu</span>
          <span className="text-xs text-gray-400">{pozycje.length} poz.</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => openKnrPicker()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Dodaj z KNR
            </button>
            <button onClick={() => openNewPoz('dzial')}
              className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
              + Dział
            </button>
            <button onClick={() => openNewPoz('nota')}
              className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
              + Nota
            </button>
            <button onClick={() => openNewPoz('pozycja')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
              + Pozycja ręcznie
            </button>
          </div>
        </div>

        {/* Tabela pozycji */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2 py-2 text-center text-gray-500 w-8">Lp</th>
                <th className="px-2 py-2 text-left text-gray-500 w-24">KNR</th>
                <th className="px-2 py-2 text-left text-gray-500">Opis roboty / materiału</th>
                <th className="px-2 py-2 text-center text-gray-500 w-12">JM</th>
                <th className="px-2 py-2 text-right text-gray-500 w-20">Ilość</th>
                <th className="px-2 py-2 text-right text-orange-600 w-20">R/jm</th>
                <th className="px-2 py-2 text-right text-blue-600 w-20">M/jm</th>
                <th className="px-2 py-2 text-right text-purple-600 w-20">S/jm</th>
                <th className="px-2 py-2 text-right text-orange-600 w-22">R wartość</th>
                <th className="px-2 py-2 text-right text-blue-600 w-22">M wartość</th>
                <th className="px-2 py-2 text-right text-purple-600 w-22">S wartość</th>
                <th className="px-2 py-2 text-right text-gray-700 font-semibold w-24">Razem</th>
                <th className="px-2 py-2 text-center text-gray-500 w-20 print:hidden">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {pozycje.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-gray-400">
                    Brak pozycji. Dodaj pierwszą pozycję lub wczytaj z katalogu KNR.
                  </td>
                </tr>
              )}
              {pozycje.map((p, idx) => {
                if (p.typ === 'dzial') return (
                  <tr key={p.id} className="bg-gray-100 border-y border-gray-300">
                    <td className="px-2 py-1.5 text-center text-gray-500">{p.lp}</td>
                    <td colSpan={10} className="px-2 py-1.5 font-bold text-gray-800 uppercase tracking-wide text-xs">
                      {p.opis}
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-gray-800">{fmt2(p.razem)}</td>
                    <td className="px-2 py-1.5 print:hidden">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => openEditPoz(p)} className="text-blue-500 hover:text-blue-700">✎</button>
                        <button onClick={() => deletePoz(p.id)} className="text-red-400 hover:text-red-600">✕</button>
                      </div>
                    </td>
                  </tr>
                )
                if (p.typ === 'nota') return (
                  <tr key={p.id} className="bg-yellow-50 border-y border-yellow-200">
                    <td className="px-2 py-1 text-center text-gray-400">{p.lp}</td>
                    <td colSpan={10} className="px-2 py-1 italic text-gray-500 text-xs">{p.opis}</td>
                    <td></td>
                    <td className="px-2 py-1 print:hidden">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => openEditPoz(p)} className="text-blue-500 hover:text-blue-700">✎</button>
                        <button onClick={() => deletePoz(p.id)} className="text-red-400 hover:text-red-600">✕</button>
                      </div>
                    </td>
                  </tr>
                )
                return (
                  <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="px-2 py-1.5 text-center text-gray-500">{p.lp}</td>
                    <td className="px-2 py-1.5 font-mono text-gray-400 text-[10px]">{p.knr_kod || '—'}</td>
                    <td className="px-2 py-1.5 text-gray-800">{p.opis}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{p.jm}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{p.ilosc}</td>
                    <td className="px-2 py-1.5 text-right text-orange-600">{p.r_j > 0 ? fmt2(p.r_j) : '—'}</td>
                    <td className="px-2 py-1.5 text-right text-blue-600">{p.m_j > 0 ? fmt2(p.m_j) : '—'}</td>
                    <td className="px-2 py-1.5 text-right text-purple-600">{p.s_j > 0 ? fmt2(p.s_j) : '—'}</td>
                    <td className="px-2 py-1.5 text-right text-orange-700">{p.r_wartosc > 0 ? fmt2(p.r_wartosc) : '—'}</td>
                    <td className="px-2 py-1.5 text-right text-blue-700">{p.m_wartosc > 0 ? fmt2(p.m_wartosc) : '—'}</td>
                    <td className="px-2 py-1.5 text-right text-purple-700">{p.s_wartosc > 0 ? fmt2(p.s_wartosc) : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-gray-900">{fmt2(p.razem)} zł</td>
                    <td className="px-2 py-1.5 print:hidden">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => movePoz(p.id, 'up')} className="text-gray-300 hover:text-gray-600" title="W górę">▲</button>
                        <button onClick={() => movePoz(p.id, 'down')} className="text-gray-300 hover:text-gray-600" title="W dół">▼</button>
                        <button onClick={() => openEditPoz(p)} className="text-blue-500 hover:text-blue-700" title="Edytuj">✎</button>
                        <button onClick={() => deletePoz(p.id)} className="text-red-400 hover:text-red-600" title="Usuń">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PODSUMOWANIE ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* Koszty składowe */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 print:border-gray-400">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Koszty bezpośrednie</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-1.5 text-orange-600 font-medium">R — Robocizna</td>
                <td className="py-1.5 text-right font-semibold text-gray-900">{fmt2(summary.razem_r)} zł</td>
              </tr>
              <tr>
                <td className="py-1.5 text-blue-600 font-medium">M — Materiały</td>
                <td className="py-1.5 text-right font-semibold text-gray-900">{fmt2(summary.razem_m)} zł</td>
              </tr>
              <tr>
                <td className="py-1.5 text-purple-600 font-medium">S — Sprzęt</td>
                <td className="py-1.5 text-right font-semibold text-gray-900">{fmt2(summary.razem_s)} zł</td>
              </tr>
              <tr className="border-t-2 border-gray-300">
                <td className="py-2 font-bold text-gray-800">Koszty bezpośrednie (R+M+S)</td>
                <td className="py-2 text-right font-bold text-gray-900">{fmt2(razem_bezp)} zł</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Narzuty i suma końcowa */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 print:border-gray-400">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Narzuty i cena końcowa</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-1.5 text-gray-600">Kp — Koszty pośrednie ({kpP}% od R+S)</td>
                <td className="py-1.5 text-right text-gray-900">{fmt2(summary.razem_kp)} zł</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-600">Kzm — Koszty zakupu mat. ({kzmP}% od M)</td>
                <td className="py-1.5 text-right text-gray-900">{fmt2(summary.razem_kzm)} zł</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-600">Z — Zysk ({zP}% od R+S+Kp)</td>
                <td className="py-1.5 text-right text-gray-900">{fmt2(summary.razem_z)} zł</td>
              </tr>
              <tr className="border-t border-gray-300">
                <td className="py-1.5 font-semibold text-gray-800">Wartość kosztorysowa netto</td>
                <td className="py-1.5 text-right font-semibold text-gray-900">{fmt2(razem_netto)} zł</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-600">VAT {vatP}%</td>
                <td className="py-1.5 text-right text-gray-900">{fmt2(razem_vat)} zł</td>
              </tr>
              <tr className="border-t-2 border-gray-400 bg-blue-50 rounded">
                <td className="py-2.5 px-2 font-bold text-blue-900 text-base rounded-l">RAZEM BRUTTO</td>
                <td className="py-2.5 px-2 text-right font-bold text-blue-900 text-lg rounded-r">{fmt2(razem_brutto)} zł</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════ */}

      {/* Modal: Dodaj/Edytuj pozycję */}
      {pozModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 print:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) setPozModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{editPoz ? 'Edytuj pozycję' : 'Nowa pozycja'}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Typ pozycji</label>
                  <select value={pozForm.typ} onChange={e => setPozForm(f => ({ ...f, typ: e.target.value as 'pozycja'|'dzial'|'nota' }))} className={inputCls}>
                    <option value="pozycja">Pozycja kosztorysowa</option>
                    <option value="dzial">Dział (nagłówek)</option>
                    <option value="nota">Nota (komentarz)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Kod KNR</label>
                  <div className="flex gap-1">
                    <input value={pozForm.knr_kod} onChange={e => setPozForm(f => ({ ...f, knr_kod: e.target.value }))}
                      className={inputCls} placeholder="np. KNR-403 0201-01" />
                    <button onClick={() => { setPozModal(false); openKnrPicker() }}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-blue-600 hover:bg-blue-50 whitespace-nowrap">
                      Wybierz
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>JM</label>
                  <input value={pozForm.jm} onChange={e => setPozForm(f => ({ ...f, jm: e.target.value }))} className={inputCls} placeholder="m, m2, szt..." />
                </div>
              </div>

              <div>
                <label className={labelCls}>Opis roboty / materiału *</label>
                <input value={pozForm.opis} onChange={e => setPozForm(f => ({ ...f, opis: e.target.value }))} className={inputCls} />
              </div>

              {pozForm.typ === 'pozycja' && (
                <>
                  <div>
                    <label className={labelCls}>Ilość</label>
                    <input type="number" step="0.001" value={pozForm.ilosc} onChange={e => setPozForm(f => ({ ...f, ilosc: e.target.value }))} className={inputCls} />
                  </div>

                  <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-orange-600 uppercase tracking-wide">R — Robocizna (zł/r-g)</label>
                        <button onClick={() => { setPozModal(false); openCenPicker('R') }}
                          className="text-xs text-blue-500 hover:underline">z cennika</button>
                      </div>
                      <input type="number" step="0.01" value={pozForm.r_j} onChange={e => setPozForm(f => ({ ...f, r_j: e.target.value }))} className={numCls} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-blue-600 uppercase tracking-wide">M — Materiały (zł/jm)</label>
                        <button onClick={() => { setPozModal(false); openCenPicker('M') }}
                          className="text-xs text-blue-500 hover:underline">z cennika</button>
                      </div>
                      <input type="number" step="0.01" value={pozForm.m_j} onChange={e => setPozForm(f => ({ ...f, m_j: e.target.value }))} className={numCls} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-purple-600 uppercase tracking-wide">S — Sprzęt (zł/m-g)</label>
                        <button onClick={() => { setPozModal(false); openCenPicker('S') }}
                          className="text-xs text-blue-500 hover:underline">z cennika</button>
                      </div>
                      <input type="number" step="0.01" value={pozForm.s_j} onChange={e => setPozForm(f => ({ ...f, s_j: e.target.value }))} className={numCls} />
                    </div>
                  </div>

                  {/* Podgląd kalkulacji */}
                  {(() => {
                    const c = calcPoz({ ilosc: parseFloat(pozForm.ilosc)||0, r_j: parseFloat(pozForm.r_j)||0, m_j: parseFloat(pozForm.m_j)||0, s_j: parseFloat(pozForm.s_j)||0 }, kpP, kzmP, zP)
                    const netto = (c.bezposrednie||0) + (c.kp_wartosc||0) + (c.kzm_wartosc||0) + (c.z_wartosc||0)
                    return (
                      <div className="grid grid-cols-4 gap-2 text-xs bg-blue-50 p-2 rounded-lg">
                        <div className="text-center"><div className="text-gray-500">R+M+S</div><div className="font-semibold">{fmt2(c.bezposrednie||0)} zł</div></div>
                        <div className="text-center"><div className="text-gray-500">+Kp+Kzm+Z</div><div className="font-semibold">+{fmt2((c.kp_wartosc||0)+(c.kzm_wartosc||0)+(c.z_wartosc||0))} zł</div></div>
                        <div className="text-center"><div className="text-gray-500">Netto</div><div className="font-semibold">{fmt2(netto)} zł</div></div>
                        <div className="text-center bg-blue-100 rounded"><div className="text-gray-500">+ VAT {vatP}%</div><div className="font-bold text-blue-800">{fmt2(netto * (1 + vatP/100))} zł</div></div>
                      </div>
                    )
                  })()}
                </>
              )}

              <div>
                <label className={labelCls}>Uwagi</label>
                <input value={pozForm.uwagi} onChange={e => setPozForm(f => ({ ...f, uwagi: e.target.value }))} className={inputCls} />
              </div>
            </div>

            {showSaveKnr && (
              <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-xs font-medium text-orange-800 mb-2">Wybierz katalog KNR:</p>
                <div className="flex gap-2 items-center">
                  <select value={saveKnrKat} onChange={e => setSaveKnrKat(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-orange-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-400">
                    <option value="">-- wybierz katalog --</option>
                    {katalogi.map(k => <option key={k.id} value={k.id}>{k.kod} — {k.nazwa}</option>)}
                  </select>
                  <button onClick={savePozToKnr}
                    className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700">
                    Zapisz
                  </button>
                  <button onClick={() => setShowSaveKnr(false)} className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                </div>
              </div>
            )}

            {showSaveCennik && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs font-medium text-green-800 mb-2">Wybierz cennik docelowy:</p>
                <div className="flex gap-2 items-center">
                  <select value={saveCennikId} onChange={e => setSaveCennikId(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-green-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-400">
                    <option value="">-- wybierz cennik --</option>
                    {availCenniki.map(c => <option key={c.id} value={c.id}>{c.nazwa}</option>)}
                  </select>
                  <button onClick={savePozToCennik}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700">
                    Zapisz
                  </button>
                  <button onClick={() => setShowSaveCennik(false)} className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                </div>
                <p className="text-[10px] text-green-700 mt-1.5">
                  Zostaną dodane pozycje dla wszystkich R/M/S z wartością &gt; 0
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-4 flex-wrap">
              <div className="flex gap-2 flex-1 flex-wrap">
                <button type="button" onClick={onSaveToKnr}
                  className="px-3 py-2 text-xs border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors whitespace-nowrap">
                  📚 Dodaj do katalogu KNR
                </button>
                <button type="button" onClick={onSaveToCennik}
                  className="px-3 py-2 text-xs border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors whitespace-nowrap">
                  💰 Dodaj do cennika RMS
                </button>
              </div>
              <button onClick={() => setPozModal(false)} className="px-4 py-2 text-sm text-gray-600">Anuluj</button>
              <button onClick={savePoz} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Zapisz pozycję</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: KNR Picker — zintegrowany z cennikiem R/M/S */}
      {knrPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 print:hidden" onClick={() => setKnrPickerOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full mx-4 flex flex-col" style={{ maxWidth: '90vw', height: '88vh' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Dodaj pozycję z KNR + Cennik R/M/S</h2>
              <div className="flex-1 mx-4">
                <input
                  value={knrSearch}
                  onChange={e => { setKnrSearch(e.target.value); if (e.target.value.length < 2) setKnrGlobalResults([]) }}
                  placeholder="🔍 Szukaj we wszystkich katalogach KNR (min. 2 znaki)..."
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button onClick={() => setKnrPickerOpen(false)} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
            </div>

            <div className="flex flex-1 overflow-hidden">

              {/* LEWA KOLUMNA — KNR */}
              <div className="flex flex-col border-r border-gray-200" style={{ width: '55%' }}>
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide flex-shrink-0">
                  {knrSearch.length >= 2
                    ? `Wyniki wyszukiwania "${knrSearch}" (${knrGlobalResults.length})`
                    : 'Przeglądaj katalogi KNR'}
                </div>

                {knrSearch.length >= 2 ? (
                  /* GLOBALNE WYNIKI WYSZUKIWANIA */
                  <div className="overflow-y-auto flex-1">
                    {knrGlobalLoading && (
                      <div className="p-4 text-center text-gray-400 text-sm">Szukam...</div>
                    )}
                    {!knrGlobalLoading && knrGlobalResults.length === 0 && (
                      <div className="p-6 text-center text-gray-400 text-sm">
                        Brak wyników. Spróbuj innej frazy lub przejrzyj katalogi.
                      </div>
                    )}
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500">Katalog</th>
                          <th className="px-3 py-2 text-left text-gray-500">Kod</th>
                          <th className="px-3 py-2 text-left text-gray-500">Opis roboty</th>
                          <th className="px-3 py-2 text-center text-gray-500">JM</th>
                          <th className="px-3 py-2 text-right text-orange-500">R</th>
                          <th className="px-3 py-2 text-right text-blue-500">M</th>
                          <th className="px-3 py-2 text-right text-purple-500">S</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {knrGlobalResults.map(p => (
                          <tr key={p.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => selectKnrPoz(p)}>
                            <td className="px-3 py-2 font-mono text-gray-400 text-[10px] whitespace-nowrap">{p.katalog_kod}</td>
                            <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{p.kod}</td>
                            <td className="px-3 py-2 text-gray-800">{p.nazwa}</td>
                            <td className="px-3 py-2 text-center text-gray-500">{p.jm}</td>
                            <td className="px-3 py-2 text-right text-orange-600">{p.r_norma > 0 ? p.r_norma : '—'}</td>
                            <td className="px-3 py-2 text-right text-blue-600">{p.m_norma > 0 ? p.m_norma : '—'}</td>
                            <td className="px-3 py-2 text-right text-purple-600">{p.s_norma > 0 ? p.s_norma : '—'}</td>
                            <td className="px-3 py-2">
                              <button className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 whitespace-nowrap">+ Dodaj</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* PRZEGLĄDANIE KATALOGÓW */
                  <div className="flex flex-1 overflow-hidden">
                    <div className="w-44 border-r border-gray-200 overflow-y-auto flex-shrink-0">
                      {katalogi.map(kat => (
                        <div key={kat.id} onClick={() => changeKat(kat.id)}
                          className={`px-3 py-2 cursor-pointer border-b border-gray-50 transition-colors
                            ${selectedKat === kat.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'hover:bg-gray-50'}`}>
                          <div className="text-[10px] font-mono text-gray-400">{kat.kod}</div>
                          <div className="text-xs font-medium text-gray-800 leading-tight">{kat.nazwa}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-500">Kod</th>
                            <th className="px-3 py-2 text-left text-gray-500">Opis roboty</th>
                            <th className="px-3 py-2 text-center text-gray-500">JM</th>
                            <th className="px-3 py-2 text-right text-orange-500">R</th>
                            <th className="px-3 py-2 text-right text-blue-500">M</th>
                            <th className="px-3 py-2 text-right text-purple-500">S</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredKnrPoz.map(p => (
                            <tr key={p.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => selectKnrPoz(p)}>
                              <td className="px-3 py-2 font-mono text-gray-500">{p.kod}</td>
                              <td className="px-3 py-2 text-gray-800">{p.nazwa}</td>
                              <td className="px-3 py-2 text-center">{p.jm}</td>
                              <td className="px-3 py-2 text-right text-orange-600">{p.r_norma > 0 ? p.r_norma : '—'}</td>
                              <td className="px-3 py-2 text-right text-blue-600">{p.m_norma > 0 ? p.m_norma : '—'}</td>
                              <td className="px-3 py-2 text-right text-purple-600">{p.s_norma > 0 ? p.s_norma : '—'}</td>
                              <td className="px-3 py-2">
                                <button className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">+ Dodaj</button>
                              </td>
                            </tr>
                          ))}
                          {filteredKnrPoz.length === 0 && (
                            <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                              {knrPozycje.length === 0 ? 'Ten katalog nie ma pozycji roboczych' : 'Brak wyników'}
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* PRAWA KOLUMNA — Cennik R/M/S */}
              <div className="flex flex-col" style={{ width: '45%' }}>
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide flex-shrink-0 flex items-center justify-between">
                  <span>Cennik R/M/S</span>
                  <span className="text-gray-400 font-normal normal-case">Kliknij cenę → wstawi do pozycji</span>
                </div>

                {/* Zakładki R/M/S */}
                <div className="flex border-b border-gray-200 flex-shrink-0">
                  {(['R','M','S'] as const).map(t => (
                    <button key={t} onClick={() => { setCennikTab(t); setCennikInlineSearch('') }}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors
                        ${cennikTab === t
                          ? t === 'R' ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-500'
                            : t === 'M' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                            : 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                          : 'text-gray-500 hover:bg-gray-50'}`}>
                      {t === 'R' ? '🔧 Robocizna' : t === 'M' ? '🧱 Materiały' : '🚜 Sprzęt'}
                      <span className="ml-1 text-gray-400 font-normal">
                        ({t === 'R' ? cennikR.length : t === 'M' ? cennikM.length : cennikS.length})
                      </span>
                    </button>
                  ))}
                </div>

                {/* Szukaj w cenniku */}
                <div className="p-2 border-b border-gray-100 flex-shrink-0">
                  <input
                    value={cennikInlineSearch}
                    onChange={e => setCennikInlineSearch(e.target.value)}
                    placeholder="Szukaj w cenniku..."
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Lista cennika */}
                <div className="overflow-y-auto flex-1">
                  {(() => {
                    const list = (cennikTab === 'R' ? cennikR : cennikTab === 'M' ? cennikM : cennikS)
                      .filter(p => !cennikInlineSearch || p.nazwa.toLowerCase().includes(cennikInlineSearch.toLowerCase()))
                    if (list.length === 0) return (
                      <div className="p-6 text-center text-gray-400 text-sm">
                        {cennikTab === 'R' && cennikR.length === 0 ? 'Brak pozycji Robocizna w cennikach' :
                         cennikTab === 'M' && cennikM.length === 0 ? 'Brak pozycji Materiały w cennikach' :
                         cennikTab === 'S' && cennikS.length === 0 ? 'Brak pozycji Sprzęt w cennikach' :
                         'Brak wyników'}
                      </div>
                    )
                    return (
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-500">Nazwa</th>
                            <th className="px-3 py-2 text-center text-gray-500">JM</th>
                            <th className="px-3 py-2 text-right text-gray-500">Cena zł</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {list.map(p => (
                            <tr key={p.id} className="hover:bg-blue-50 cursor-pointer"
                              onClick={() => {
                                if (cennikTab === 'R') setPozForm(f => ({ ...f, r_j: String(p.cena) }))
                                if (cennikTab === 'M') setPozForm(f => ({ ...f, m_j: String(p.cena) }))
                                if (cennikTab === 'S') setPozForm(f => ({ ...f, s_j: String(p.cena) }))
                                setKnrPickerOpen(false)
                                setPozModal(true)
                              }}>
                              <td className="px-3 py-2 text-gray-800">{p.nazwa}</td>
                              <td className="px-3 py-2 text-center text-gray-500">{p.jm}</td>
                              <td className={`px-3 py-2 text-right font-semibold
                                ${cennikTab === 'R' ? 'text-orange-700' : cennikTab === 'M' ? 'text-blue-700' : 'text-purple-700'}`}>
                                {fmt2(p.cena)}
                              </td>
                              <td className="px-3 py-2">
                                <button className="px-2 py-0.5 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 whitespace-nowrap">
                                  → {cennikTab}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  })()}
                </div>

                {/* Podpowiedź */}
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex-shrink-0">
                  💡 Najpierw wybierz pozycję KNR (lewa strona), potem uzupełnij ceny z cennika
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cennik Picker */}
      {cenPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 print:hidden" onClick={() => setCenPickerOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col" style={{ maxHeight: '70vh' }} onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${cenPickerTyp === 'R' ? 'bg-orange-100 text-orange-700' : cenPickerTyp === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                {cenPickerTyp === 'R' ? 'Robocizna' : cenPickerTyp === 'M' ? 'Materiał' : 'Sprzęt'}
              </span>
              <h2 className="text-base font-semibold text-gray-900">Wybierz cenę z cennika</h2>
              <button onClick={() => { setCenPickerOpen(false); setPozModal(true) }} className="ml-auto text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="p-3 border-b border-gray-100">
              <input value={cenSearch} onChange={e => setCenSearch(e.target.value)}
                placeholder="Szukaj..."
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500">Nazwa</th>
                    <th className="px-3 py-2 text-center text-gray-500">JM</th>
                    <th className="px-3 py-2 text-right text-gray-500">Cena [zł]</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCen.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => selectCen(p)}>
                      <td className="px-3 py-2 text-gray-800">{p.nazwa}</td>
                      <td className="px-3 py-2 text-center">{p.jm}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt2(p.cena)}</td>
                      <td className="px-3 py-2">
                        <button className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Wybierz</button>
                      </td>
                    </tr>
                  ))}
                  {filteredCen.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Brak pozycji w cennikach</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          header, nav, aside, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          @page { margin: 1.5cm; size: A4 landscape; }
          table { font-size: 9pt !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  )
}
