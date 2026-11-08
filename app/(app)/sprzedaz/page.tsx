'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import CzatPanel from '@/components/CzatPanel'
import { createClient } from '@/lib/supabase'

type Klient = { id: string; nazwa: string }
type Zakup = { nr_edd: string; ilosc_kg: number; cena_jednostkowa: number }
type Sprzedaz = {
  id: string; klient_id: string; nr_edd: string; data_sprzedazy: string
  ilosc_litry: number; cena_sprzedazy: number; forma_sprzedazy: string; forma_platnosci: string
  klienci: { id: string; nazwa: string; nip: string | null; typ: string }; dokumenty: string[] | null
}

const VAT = 0.23
const emptyForm = {
  klient_id: '', nr_edd: '',
  data_sprzedazy: new Date().toISOString().split('T')[0],
  ilosc_litry: '', cena_sprzedazy: '',
  forma_sprzedazy: 'faktura_vat', forma_platnosci: 'przelew',
}
const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelCls = "text-xs font-medium text-gray-500 uppercase tracking-wide"

export default function SprzedazPage() {
  const supabase = createClient()
  const [sprzedaz, setSprzedaz] = useState<Sprzedaz[]>([])
  const [klienci, setKlienci] = useState<Klient[]>([])
  const [zakupy, setZakupy] = useState<Zakup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  // inFakt
  const [infaktSent, setInfaktSent] = useState<Record<string, { numer: string; link: string }>>({})
  const [infaktLoading, setInfaktLoading] = useState<string | null>(null)

  // Kalkulator marży LPG
  const [showKalk, setShowKalk] = useState(false)
  const [kalk, setKalk] = useState({ cenaNabycia: '', cenaNabyciaJm: 'kg', iloscNabycia: '', cenaTrsp: '', cenSprzBrutto: '', iloscSprzLitry: '', wspKonwersji: '' })

  // Średni współczynnik kg/l wyliczony ze wszystkich EDD (gęstość LPG, typowo ~0.51 kg/l)
  const avgWsp = useMemo(() => {
    const wsps: number[] = []
    for (const z of zakupy) {
      const litry = sprzedaz.filter(s => s.nr_edd === z.nr_edd).reduce((a, s) => a + s.ilosc_litry, 0)
      if (litry > 0 && z.ilosc_kg > 0) wsps.push(z.ilosc_kg / litry)
    }
    return wsps.length > 0 ? wsps.reduce((a, b) => a + b, 0) / wsps.length : 0.51
  }, [zakupy, sprzedaz])

  // Auto-wypełnij wsp gdy dane się załadują
  useEffect(() => {
    if (avgWsp && !kalk.wspKonwersji) setKalk(p => ({ ...p, wspKonwersji: avgWsp.toFixed(4) }))
  }, [avgWsp])

  function kalkResult() {
    const cn = parseFloat(kalk.cenaNabycia) || 0        // cena nabycia PLN/kg lub PLN/l
    const il = parseFloat(kalk.iloscNabycia) || 0        // ilość nabycia [kg]
    const tr = parseFloat(kalk.cenaTrsp) || 0             // koszt transportu PLN łącznie
    const cs = parseFloat(kalk.cenSprzBrutto) || 0       // cena sprzedaży brutto PLN/l
    const ls = parseFloat(kalk.iloscSprzLitry) || 0      // ilość sprzedana litry
    const wsp = parseFloat(kalk.wspKonwersji) || avgWsp  // kg/l (gęstość LPG)
    if (!cn || !il || !cs || !ls || !wsp) return null

    // Koszt gazu netto — formuła: il_kg × cn / wsp (wg wzoru użytkownika)
    // Gdy cn w PLN/kg: koszt = il × cn (bez dzielenia bo wsp=kg/l, cena jest już per kg)
    // Gdy cn w PLN/l:  koszt = il × (cn / wsp) — przelicz kg→l przez wsp, ×cena/l
    const koszGazu = kalk.cenaNabyciaJm === 'kg'
      ? cn * il                  // PLN/kg × kg = PLN netto
      : cn * (il / wsp)          // PLN/l × (kg / kg·l⁻¹) = PLN/l × l = PLN netto

    const litryNabyte = wsp > 0 ? il / wsp : 0            // litry równoważne zakupu
    const koszLacznie = koszGazu + tr                       // łącznie z transportem
    const przychBrutto = cs * ls                            // przychód brutto
    const przychNetto = przychBrutto / 1.23                 // przychód netto
    const marzaBrutto = przychBrutto - koszLacznie          // marża (przychodBrutto - kosztNetto)
    const marzaNetto = przychNetto - koszLacznie            // marża netto
    const marzaProc = przychBrutto > 0 ? marzaBrutto / przychBrutto * 100 : 0
    const kosztNaLitr = ls > 0 ? koszLacznie / ls : 0      // koszt łączny / litr sprzedany
    const progRentownosci = ls > 0 ? (koszLacznie / ls) * 1.23 : 0  // min cena brutto/l
    return { koszGazu, koszLacznie, przychBrutto, przychNetto, marzaBrutto, marzaNetto, marzaProc, kosztNaLitr, progRentownosci, litryNabyte, wsp }
  }

  // Dokumenty
  const [docsId, setDocsId] = useState<string | null>(null)
  const [docsNr, setDocsNr] = useState('')
  const [docs, setDocs] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const docsFileRef = useRef<HTMLInputElement>(null)

  // Wyszukiwanie i filtrowanie
  const [search, setSearch] = useState('')
  const [filterEDD, setFilterEDD] = useState('')
  const [filterForma, setFilterForma] = useState('')
  const [sortField, setSortField] = useState<string>('data_sprzedazy')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Checkboxy
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDeleteBulk, setShowDeleteBulk] = useState(false)

  // Scroll sync — dwa paski (górny i dolny)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const bottomScrollRef = useRef<HTMLDivElement>(null)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const [tableWidth, setTableWidth] = useState(0)

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    if (tableWrapRef.current) {
      const obs = new ResizeObserver(() => {
        if (tableWrapRef.current) setTableWidth(tableWrapRef.current.scrollWidth)
      })
      obs.observe(tableWrapRef.current)
      return () => obs.disconnect()
    }
  }, [loading])

  // Synchronizacja scroll górny ↔ dolny
  const syncTop = useCallback(() => {
    if (topScrollRef.current && bottomScrollRef.current)
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
  }, [])
  const syncBottom = useCallback(() => {
    if (topScrollRef.current && bottomScrollRef.current)
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: sp }, { data: kl }, { data: zk }] = await Promise.all([
      supabase.from('sprzedaz').select('*, klienci(id, nazwa, nip, typ)').order('data_sprzedazy', { ascending: false }),
      supabase.from('klienci').select('id, nazwa').eq('aktywny', true).order('nazwa'),
      supabase.from('zakupy').select('nr_edd, ilosc_kg, cena_jednostkowa').order('data_zakupu', { ascending: false }),
    ])
    if (sp) setSprzedaz(sp)
    if (kl) setKlienci(kl)
    if (zk) setZakupy(zk)
    setLoading(false)
    setSelected(new Set())
  }

  function getWsp(nr_edd: string, allSp: Sprzedaz[]) {
    const z = zakupy.find(x => x.nr_edd === nr_edd)
    if (!z) return null
    const litry = allSp.filter(x => x.nr_edd === nr_edd).reduce((a, x) => a + x.ilosc_litry, 0)
    return litry > 0 ? z.ilosc_kg / litry : null
  }

  function calcTony(litry: number, wsp: number | null) {
    return wsp !== null ? litry * wsp / 1000 : null
  }

  function calcMarza(nr_edd: string, litry: number, cena_sprzedazy: number, wsp: number | null) {
    const z = zakupy.find(x => x.nr_edd === nr_edd)
    if (!wsp || !z) return null
    return litry * cena_sprzedazy - litry * z.cena_jednostkowa * wsp * (1 + VAT)
  }

  function fmt(n: number, d = 2) { return n.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) }
  function formaLabel(f: string) { return { faktura_vat: 'Faktura VAT', paragon: 'Paragon', faktura_imienna: 'Faktura im.' }[f] ?? f }
  function platLabel(f: string) { return { przelew: 'Przelew', gotowka: 'Gotówka', karta: 'Karta' }[f] ?? f }

  // Sortowanie nagłówka
  function handleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }
  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) return <span className="text-gray-300 ml-0.5">↕</span>
    return <span className="text-blue-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Filtrowanie + sortowanie
  const filtered = sprzedaz
    .filter(s => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        (s.klienci?.nazwa ?? '').toLowerCase().includes(q) ||
        s.nr_edd.toLowerCase().includes(q) ||
        s.data_sprzedazy.includes(q) ||
        String(s.ilosc_litry).includes(q)
      const matchEDD = !filterEDD || s.nr_edd === filterEDD
      const matchForma = !filterForma || s.forma_sprzedazy === filterForma
      return matchSearch && matchEDD && matchForma
    })
    .sort((a, b) => {
      let va: any, vb: any
      if (sortField === 'klient') { va = a.klienci?.nazwa ?? ''; vb = b.klienci?.nazwa ?? '' }
      else if (sortField === 'wartosc') { va = a.ilosc_litry * a.cena_sprzedazy; vb = b.ilosc_litry * b.cena_sprzedazy }
      else if (sortField === 'marza') {
        const wa = getWsp(a.nr_edd, sprzedaz); const wb = getWsp(b.nr_edd, sprzedaz)
        va = calcMarza(a.nr_edd, a.ilosc_litry, a.cena_sprzedazy, wa) ?? 0
        vb = calcMarza(b.nr_edd, b.ilosc_litry, b.cena_sprzedazy, wb) ?? 0
      }
      else { va = (a as any)[sortField] ?? ''; vb = (b as any)[sortField] ?? '' }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const allSelected = filtered.length > 0 && filtered.every(s => selected.has(s.id))
  const someSelected = filtered.some(s => selected.has(s.id))

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map(s => s.id)))
  }
  function toggleOne(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  // Przeliczenia dla formularza
  const prevWsp = form.nr_edd ? getWsp(form.nr_edd, sprzedaz) : null
  const prevLitry = form.ilosc_litry ? parseFloat(form.ilosc_litry) : 0
  const prevCena = form.cena_sprzedazy ? parseFloat(form.cena_sprzedazy) : 0
  const prevTony = form.nr_edd && prevLitry ? calcTony(prevLitry, prevWsp) : null
  const prevWartosc = prevLitry && prevCena ? prevLitry * prevCena : null
  const prevMarza = form.nr_edd && prevLitry && prevCena ? calcMarza(form.nr_edd, prevLitry, prevCena, prevWsp) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('')
    const { error } = await supabase.from('sprzedaz').insert({
      klient_id: form.klient_id, nr_edd: form.nr_edd, data_sprzedazy: form.data_sprzedazy,
      ilosc_litry: parseFloat(form.ilosc_litry), cena_sprzedazy: parseFloat(form.cena_sprzedazy),
      forma_sprzedazy: form.forma_sprzedazy, forma_platnosci: form.forma_platnosci,
    })
    if (error) setError('Błąd: ' + error.message)
    else {
      setSuccess('Sprzedaż zapisana!')
      setForm({ ...emptyForm, data_sprzedazy: new Date().toISOString().split('T')[0] })
      fetchAll(); setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return; setDeleting(true)
    await supabase.from('sprzedaz').delete().eq('id', deleteId)
    setDeleteId(null); fetchAll(); setDeleting(false)
  }

  async function handleDeleteBulk() {
    setDeleting(true)
    const ids = Array.from(selected)
    for (let i = 0; i < ids.length; i += 50) {
      await supabase.from('sprzedaz').delete().in('id', ids.slice(i, i + 50))
    }
    setShowDeleteBulk(false); setSelected(new Set()); fetchAll(); setDeleting(false)
  }

  function openEdit(s: Sprzedaz) {
    setEditId(s.id)
    setEditForm({ klient_id: s.klient_id, nr_edd: s.nr_edd, data_sprzedazy: s.data_sprzedazy, ilosc_litry: String(s.ilosc_litry), cena_sprzedazy: String(s.cena_sprzedazy), forma_sprzedazy: s.forma_sprzedazy, forma_platnosci: s.forma_platnosci })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editId) return; setEditSaving(true)
    await supabase.from('sprzedaz').update({
      klient_id: editForm.klient_id, nr_edd: editForm.nr_edd, data_sprzedazy: editForm.data_sprzedazy,
      ilosc_litry: parseFloat(editForm.ilosc_litry), cena_sprzedazy: parseFloat(editForm.cena_sprzedazy),
      forma_sprzedazy: editForm.forma_sprzedazy, forma_platnosci: editForm.forma_platnosci,
    }).eq('id', editId)
    setEditId(null); fetchAll(); setEditSaving(false)
  }

  // Sumy dla filtrowanego widoku
  async function wystawInFakt(s: Sprzedaz) {
    if (s.forma_sprzedazy !== 'faktura_vat') {
      setError('inFakt: tylko Faktura VAT może być wysłana automatycznie.'); return
    }
    setInfaktLoading(s.id); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/infakt/faktury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          klient_nazwa: s.klienci?.nazwa ?? '',
          klient_nip: s.klienci?.nip ?? null,
          klient_typ: s.klienci?.typ ?? 'osoba_fizyczna',
          data: s.data_sprzedazy,
          ilosc_litry: s.ilosc_litry,
          cena_sprzedazy_brutto: s.cena_sprzedazy,
          forma_platnosci: s.forma_platnosci,
          nr_edd: s.nr_edd,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError('inFakt błąd: ' + (data.error ?? 'Nieznany błąd')); return }
      setInfaktSent(prev => ({ ...prev, [s.id]: { numer: data.numer, link: data.link } }))
      setSuccess(`✓ Faktura ${data.numer} wystawiona w inFakt!`)
      setTimeout(() => setSuccess(''), 5000)
    } catch (e: any) { setError('Błąd połączenia z inFakt') }
    setInfaktLoading(null)
  }

  function openDocs(s: Sprzedaz) {
    setDocsId(s.id); setDocsNr(`${s.klienci?.nazwa} ${s.data_sprzedazy}`); setDocs(s.dokumenty ?? [])
  }

  async function handleUploadDok(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !docsId) return
    setUploading(true)
    const urls: string[] = []
    for (const file of Array.from(e.target.files)) {
      const path = `sprzedaz/${docsId}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('dokumenty').upload(path, file)
      if (!error) { const { data } = supabase.storage.from('dokumenty').getPublicUrl(path); urls.push(data.publicUrl) }
    }
    const updated = [...docs, ...urls]
    await supabase.from('sprzedaz').update({ dokumenty: updated }).eq('id', docsId)
    setDocs(updated); fetchAll(); setUploading(false)
    if (docsFileRef.current) docsFileRef.current.value = ''
  }

  async function handleDeleteDok(url: string) {
    if (!docsId) return
    const updated = docs.filter(d => d !== url)
    await supabase.from('sprzedaz').update({ dokumenty: updated }).eq('id', docsId)
    setDocs(updated)
  }

  const sumaLitry = filtered.reduce((a, s) => a + s.ilosc_litry, 0)
  const sumaTony = filtered.reduce((a, s) => { const w = getWsp(s.nr_edd, sprzedaz); return a + (calcTony(s.ilosc_litry, w) ?? 0) }, 0)
  const sumaWartosc = filtered.reduce((a, s) => a + s.ilosc_litry * s.cena_sprzedazy, 0)
  const sumaMarza = filtered.reduce((a, s) => { const w = getWsp(s.nr_edd, sprzedaz); return a + (calcMarza(s.nr_edd, s.ilosc_litry, s.cena_sprzedazy, w) ?? 0) }, 0)

  const unikEdds = [...new Set(sprzedaz.map(s => s.nr_edd))]

  const COLS = ['☐', 'Data', 'Klient', 'EDD', 'Litry', 'Tony', 'Cena brutto', 'Wartość', 'Marża', 'Transport', 'Forma', 'Płatność', 'Akcje']

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-full mx-auto">

        {/* Nagłówek */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Sprzedaż gazu</h1>
            <p className="text-sm text-gray-500 mt-0.5">Ewidencja sprzedaży · {sprzedaz.length} transakcji łącznie</p>
          </div>
          <div className="flex gap-2">
            <a href="/raporty" className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">Raporty</a>
            <a href="/zakupy" className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">Zakupy</a>
          </div>
        </div>

        {/* Kalkulator marży LPG */}
        <div className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden">
          <button onClick={() => setShowKalk(p => !p)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <span>⚡ Kalkulator marży LPG</span>
            <span className="text-gray-400">{showKalk ? '▲' : '▼'}</span>
          </button>
          {showKalk && (() => {
            const r = kalkResult()
            return (
              <div className="px-5 pb-5 border-t border-gray-100">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 mb-1">
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Cena nabycia</label>
                    <div className="flex gap-1">
                      <input type="number" value={kalk.cenaNabycia} onChange={e=>setKalk(p=>({...p,cenaNabycia:e.target.value}))} placeholder="0.00" step="0.0001" className={inputCls + ' w-full'} />
                      <select value={kalk.cenaNabyciaJm} onChange={e=>setKalk(p=>({...p,cenaNabyciaJm:e.target.value}))} className={inputCls + ' w-20'}>
                        <option value="kg">PLN/kg</option>
                        <option value="l">PLN/l</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Ilość nabycia [kg]</label>
                    <input type="number" value={kalk.iloscNabycia} onChange={e=>setKalk(p=>({...p,iloscNabycia:e.target.value}))} placeholder="0" className={inputCls + ' w-full'} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Koszt transportu [PLN łącznie]</label>
                    <input type="number" value={kalk.cenaTrsp} onChange={e=>setKalk(p=>({...p,cenaTrsp:e.target.value}))} placeholder="0.00" className={inputCls + ' w-full'} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Cena sprzedaży brutto [PLN/l]</label>
                    <input type="number" value={kalk.cenSprzBrutto} onChange={e=>setKalk(p=>({...p,cenSprzBrutto:e.target.value}))} placeholder="0.0000" step="0.0001" className={inputCls + ' w-full'} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Ilość sprzedana [litry]</label>
                    <input type="number" value={kalk.iloscSprzLitry} onChange={e=>setKalk(p=>({...p,iloscSprzLitry:e.target.value}))} placeholder="0" className={inputCls + ' w-full'} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>
                      Wsp. konwersji [kg/l]
                      <span className="text-gray-400 normal-case font-normal ml-1">(śr. z danych: {avgWsp.toFixed(4)})</span>
                    </label>
                    <input type="number" value={kalk.wspKonwersji} onChange={e=>setKalk(p=>({...p,wspKonwersji:e.target.value}))} placeholder={avgWsp.toFixed(4)} step="0.0001" className={inputCls + ' w-full'} />
                  </div>
                </div>
                {r && r.litryNabyte > 0 && (
                  <p className="text-xs text-gray-400 mb-3">
                    ℹ {fmt(parseFloat(kalk.iloscNabycia)||0, 0)} kg zakupu = <strong>{fmt(r.litryNabyte, 0)} l</strong> ({fmt(parseFloat(kalk.iloscSprzLitry)||0, 0)} l sprzedano · różnica: {fmt(r.litryNabyte - (parseFloat(kalk.iloscSprzLitry)||0), 0)} l)
                  </p>
                )}
                {r ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { l: 'Koszt gazu', v: fmt(r.koszGazu) + ' zł', c: 'text-red-600', bg: 'bg-red-50' },
                      { l: 'Koszt łączny (+transport)', v: fmt(r.koszLacznie) + ' zł', c: 'text-red-700', bg: 'bg-red-100' },
                      { l: 'Przychód brutto', v: fmt(r.przychBrutto) + ' zł', c: 'text-blue-700', bg: 'bg-blue-50' },
                      { l: 'Przychód netto', v: fmt(r.przychNetto) + ' zł', c: 'text-blue-600', bg: 'bg-blue-50' },
                      { l: 'Marża brutto', v: fmt(r.marzaBrutto) + ' zł', c: r.marzaBrutto >= 0 ? 'text-green-700' : 'text-red-700', bg: r.marzaBrutto >= 0 ? 'bg-green-50' : 'bg-red-50' },
                      { l: 'Marża netto', v: fmt(r.marzaNetto) + ' zł', c: r.marzaNetto >= 0 ? 'text-green-600' : 'text-red-600', bg: r.marzaNetto >= 0 ? 'bg-green-50' : 'bg-red-50' },
                      { l: 'Marża %', v: fmt(r.marzaProc) + '%', c: r.marzaProc >= 10 ? 'text-green-700' : r.marzaProc >= 0 ? 'text-orange-700' : 'text-red-700', bg: r.marzaProc >= 10 ? 'bg-green-50' : r.marzaProc >= 0 ? 'bg-orange-50' : 'bg-red-50' },
                      { l: 'Koszt / litr sprzedany', v: fmt(r.kosztNaLitr, 4) + ' zł/l', c: 'text-gray-700', bg: 'bg-gray-50' },
                      { l: 'Próg rentowności', v: fmt(r.progRentownosci, 4) + ' zł/l brutto', c: 'text-orange-700', bg: 'bg-orange-50' },
                    ].map(i => (
                      <div key={i.l} className={`${i.bg} rounded-xl px-3 py-2`}>
                        <p className="text-xs text-gray-500 mb-0.5">{i.l}</p>
                        <p className={`text-base font-bold ${i.c}`}>{i.v}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">Wypełnij pola aby zobaczyć wyniki</p>
                )}
              </div>
            )
          })()}
        </div>

        {/* Formularz nowej sprzedaży */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Nowa sprzedaż</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Klient</label>
                <select value={form.klient_id} onChange={e => setForm(f => ({ ...f, klient_id: e.target.value }))} required className={inputCls + ' w-full'}>
                  <option value="">— wybierz klienta —</option>
                  {klienci.map(k => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Nr EDD</label>
                <select value={form.nr_edd} onChange={e => setForm(f => ({ ...f, nr_edd: e.target.value }))} required className={inputCls + ' w-full'}>
                  <option value="">— wybierz EDD —</option>
                  {zakupy.map(z => <option key={z.nr_edd} value={z.nr_edd}>{z.nr_edd}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Data sprzedaży</label>
                <input type="date" value={form.data_sprzedazy} onChange={e => setForm(f => ({ ...f, data_sprzedazy: e.target.value }))} required className={inputCls + ' w-full'} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Ilość [litry]</label>
                <input type="number" value={form.ilosc_litry} onChange={e => setForm(f => ({ ...f, ilosc_litry: e.target.value }))} placeholder="0" min="0" step="0.01" required className={inputCls + ' w-full'} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Cena brutto [zł/l]</label>
                <input type="number" value={form.cena_sprzedazy} onChange={e => setForm(f => ({ ...f, cena_sprzedazy: e.target.value }))} placeholder="0.00" min="0" step="0.0001" required className={inputCls + ' w-full'} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Forma sprzedaży</label>
                <select value={form.forma_sprzedazy} onChange={e => setForm(f => ({ ...f, forma_sprzedazy: e.target.value }))} className={inputCls + ' w-full'}>
                  <option value="faktura_vat">Faktura VAT</option>
                  <option value="paragon">Paragon</option>
                  <option value="faktura_imienna">Faktura imienna</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Forma płatności</label>
                <select value={form.forma_platnosci} onChange={e => setForm(f => ({ ...f, forma_platnosci: e.target.value }))} className={inputCls + ' w-full'}>
                  <option value="przelew">Przelew</option>
                  <option value="gotowka">Gotówka</option>
                  <option value="karta">Karta płatnicza</option>
                </select>
              </div>
            </div>

            {/* Przeliczenia podgląd */}
            {(prevLitry > 0 || prevCena > 0) && (
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                <div><p className={labelCls + ' mb-1'}>Wsp. kg/l</p><p className="text-sm font-medium">{prevWsp !== null ? fmt(prevWsp, 4) : '—'}</p></div>
                <div><p className={labelCls + ' mb-1'}>Tony</p><p className="text-sm font-medium text-blue-700">{prevTony !== null ? fmt(prevTony, 4) : '—'}</p></div>
                <div><p className={labelCls + ' mb-1'}>Wartość sprzedaży</p><p className="text-sm font-medium">{prevWartosc !== null ? fmt(prevWartosc) + ' zł' : '—'}</p></div>
                <div><p className={labelCls + ' mb-1'}>Marża brutto</p><p className="text-sm font-medium text-green-700">{prevMarza !== null ? fmt(prevMarza) + ' zł' : '—'}</p></div>
                <div><p className={labelCls + ' mb-1'}>Marża transport</p><p className="text-sm font-medium text-green-600">{prevMarza !== null ? fmt(prevMarza / 2) + ' zł' : '—'}</p></div>
              </div>
            )}

            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>}
            {success && <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg mb-3">{success}</p>}
            <button type="submit" disabled={saving} className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
              {saving ? 'Zapisywanie...' : '+ Dodaj sprzedaż'}
            </button>
          </form>
        </div>

        {/* Historia sprzedaży */}
        <div className="bg-white border border-gray-200 rounded-xl">
          {/* Toolbar historii */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Historia sprzedaży {!loading && `(${filtered.length}${filtered.length !== sprzedaz.length ? ` z ${sprzedaz.length}` : ''})`}
              </h2>
              {selected.size > 0 && (
                <button onClick={() => setShowDeleteBulk(true)}
                  className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                  🗑 Usuń zaznaczone ({selected.size})
                </button>
              )}
            </div>

            {/* Pasek filtrów */}
            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔍  Szukaj klienta, EDD, daty, ilości..."
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-48"
              />
              <select value={filterEDD} onChange={e => setFilterEDD(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Wszystkie EDD</option>
                {unikEdds.map(e => <option key={e} value={e}>{e.slice(0, 20)}…</option>)}
              </select>
              <select value={filterForma} onChange={e => setFilterForma(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Wszystkie formy</option>
                <option value="faktura_vat">Faktura VAT</option>
                <option value="paragon">Paragon</option>
                <option value="faktura_imienna">Faktura imienna</option>
              </select>
              {(search || filterEDD || filterForma) && (
                <button onClick={() => { setSearch(''); setFilterEDD(''); setFilterForma('') }}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">✕ Wyczyść</button>
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Ładowanie...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Brak wyników{search ? ` dla "${search}"` : ''}.</p>
          ) : (
            <>
              {/* Górny pasek przewijania */}
              <div
                ref={topScrollRef}
                onScroll={syncTop}
                className="overflow-x-auto border-b border-gray-100"
                style={{ height: 12 }}
              >
                <div style={{ width: tableWidth, height: 1 }} />
              </div>

              {/* Tabela */}
              <div
                ref={bottomScrollRef}
                onScroll={syncBottom}
                className="overflow-x-auto"
              >
                <div ref={tableWrapRef}>
                  <table className="w-full text-sm border-collapse" style={{ minWidth: 1100 }}>
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {/* Checkbox all */}
                        <th className="py-3 pl-4 pr-2 w-8">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                            onChange={toggleAll}
                            className="rounded"
                          />
                        </th>
                        {[
                          { key: 'data_sprzedazy', label: 'Data' },
                          { key: 'klient', label: 'Klient' },
                          { key: 'nr_edd', label: 'EDD' },
                          { key: 'ilosc_litry', label: 'Litry', right: true },
                          { key: 'tony', label: 'Tony', right: true },
                          { key: 'cena_sprzedazy', label: 'Cena brutto', right: true },
                          { key: 'wartosc', label: 'Wartość', right: true },
                          { key: 'marza', label: 'Marża', right: true },
                          { key: 'transport', label: 'Transport', right: true },
                          { key: 'forma_sprzedazy', label: 'Forma' },
                          { key: 'forma_platnosci', label: 'Płatność' },
                        ].map(col => (
                          <th key={col.key}
                            onClick={() => handleSort(col.key)}
                            className={`text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-2 whitespace-nowrap cursor-pointer hover:text-gray-600 select-none ${col.right ? 'text-right' : 'text-left'}`}>
                            {col.label}<SortIcon field={col.key} />
                          </th>
                        ))}
                        <th className="text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-2 text-center">Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(s => {
                        const wsp = getWsp(s.nr_edd, sprzedaz)
                        const tony = calcTony(s.ilosc_litry, wsp)
                        const wartosc = s.ilosc_litry * s.cena_sprzedazy
                        const marza = calcMarza(s.nr_edd, s.ilosc_litry, s.cena_sprzedazy, wsp)
                        const isSelected = selected.has(s.id)
                        return (
                          <tr key={s.id}
                            className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                            <td className="py-2.5 pl-4 pr-2">
                              <input type="checkbox" checked={isSelected} onChange={() => toggleOne(s.id)} className="rounded" />
                            </td>
                            <td className="py-2.5 px-2 text-gray-600 whitespace-nowrap">{s.data_sprzedazy}</td>
                            <td className="py-2.5 px-2 font-medium max-w-[130px] truncate" title={s.klienci?.nazwa}>{s.klienci?.nazwa}</td>
                            <td className="py-2.5 px-2">
                              <span className="bg-blue-50 text-blue-700 text-xs font-mono px-1.5 py-0.5 rounded whitespace-nowrap">
                                {s.nr_edd.slice(-9)}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-right tabular-nums">{fmt(s.ilosc_litry, 0)}</td>
                            <td className="py-2.5 px-2 text-right text-blue-700 tabular-nums">{tony !== null ? fmt(tony, 4) : '—'}</td>
                            <td className="py-2.5 px-2 text-right text-gray-600 tabular-nums">{fmt(s.cena_sprzedazy, 4)}</td>
                            <td className="py-2.5 px-2 text-right font-medium tabular-nums">{fmt(wartosc)} zł</td>
                            <td className="py-2.5 px-2 text-right text-green-700 font-medium tabular-nums">{marza !== null ? fmt(marza) + ' zł' : '—'}</td>
                            <td className="py-2.5 px-2 text-right text-green-600 tabular-nums">{marza !== null ? fmt(marza / 2) + ' zł' : '—'}</td>
                            <td className="py-2.5 px-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${s.forma_sprzedazy === 'faktura_vat' ? 'bg-blue-50 text-blue-700' : s.forma_sprzedazy === 'paragon' ? 'bg-yellow-50 text-yellow-700' : 'bg-purple-50 text-purple-700'}`}>
                                {formaLabel(s.forma_sprzedazy)}
                              </span>
                            </td>
                            <td className="py-2.5 px-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${s.forma_platnosci === 'przelew' ? 'bg-gray-100 text-gray-600' : s.forma_platnosci === 'gotowka' ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
                                {platLabel(s.forma_platnosci)}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                <button onClick={() => openDocs(s)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-500" title="Dokumenty">
                                  📎{s.dokumenty?.length ? ` ${s.dokumenty.length}` : ''}
                                </button>
                                {infaktSent[s.id] ? (
                                  <a href={infaktSent[s.id].link} target="_blank" rel="noopener noreferrer"
                                    className="text-xs px-2 py-1 rounded border border-green-300 bg-green-50 text-green-700 font-medium whitespace-nowrap" title="Otwórz fakturę w inFakt">
                                    ✓ {infaktSent[s.id].numer}
                                  </a>
                                ) : s.forma_sprzedazy === 'faktura_vat' ? (
                                  <button onClick={() => wystawInFakt(s)} disabled={infaktLoading === s.id}
                                    className="text-xs px-2 py-1 rounded border border-orange-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300 transition-colors text-gray-500 whitespace-nowrap disabled:opacity-50"
                                    title="Wystaw fakturę w inFakt">
                                    {infaktLoading === s.id ? '⏳' : '📤'} inFakt
                                  </button>
                                ) : null}
                                <button onClick={() => openEdit(s)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors text-gray-500">Edytuj</button>
                                <button onClick={() => setDeleteId(s.id)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors text-gray-500">Usuń</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={4} className="py-3 pl-4 text-xs text-gray-500 font-medium">
                          Suma: {filtered.length} pozycji{selected.size > 0 ? ` · ${selected.size} zaznaczonych` : ''}
                        </td>
                        <td className="py-3 px-2 text-right font-bold tabular-nums">{fmt(sumaLitry, 0)}</td>
                        <td className="py-3 px-2 text-right text-blue-700 font-bold tabular-nums">{fmt(sumaTony, 3)}</td>
                        <td className="py-3 px-2"></td>
                        <td className="py-3 px-2 text-right font-bold tabular-nums">{fmt(sumaWartosc)} zł</td>
                        <td className="py-3 px-2 text-right text-green-700 font-bold tabular-nums">{fmt(sumaMarza)} zł</td>
                        <td className="py-3 px-2 text-right text-green-600 font-bold tabular-nums">{fmt(sumaMarza / 2)} zł</td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal edycji */}
      {editId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-lg">
            <h2 className="text-base font-medium text-gray-900 mb-4">Edytuj sprzedaż</h2>
            <form onSubmit={handleEdit}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Klient</label>
                  <select value={editForm.klient_id} onChange={e => setEditForm(f => ({ ...f, klient_id: e.target.value }))} required className={inputCls + ' w-full'}>
                    {klienci.map(k => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Nr EDD</label>
                  <select value={editForm.nr_edd} onChange={e => setEditForm(f => ({ ...f, nr_edd: e.target.value }))} required className={inputCls + ' w-full'}>
                    {zakupy.map(z => <option key={z.nr_edd} value={z.nr_edd}>{z.nr_edd}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Data</label><input type="date" value={editForm.data_sprzedazy} onChange={e => setEditForm(f => ({ ...f, data_sprzedazy: e.target.value }))} required className={inputCls + ' w-full'} /></div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Litry</label><input type="number" value={editForm.ilosc_litry} onChange={e => setEditForm(f => ({ ...f, ilosc_litry: e.target.value }))} min="0" step="0.01" required className={inputCls + ' w-full'} /></div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Cena brutto [zł/l]</label><input type="number" value={editForm.cena_sprzedazy} onChange={e => setEditForm(f => ({ ...f, cena_sprzedazy: e.target.value }))} min="0" step="0.0001" required className={inputCls + ' w-full'} /></div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Forma sprzedaży</label>
                  <select value={editForm.forma_sprzedazy} onChange={e => setEditForm(f => ({ ...f, forma_sprzedazy: e.target.value }))} className={inputCls + ' w-full'}>
                    <option value="faktura_vat">Faktura VAT</option>
                    <option value="paragon">Paragon</option>
                    <option value="faktura_imienna">Faktura imienna</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Forma płatności</label>
                  <select value={editForm.forma_platnosci} onChange={e => setEditForm(f => ({ ...f, forma_platnosci: e.target.value }))} className={inputCls + ' w-full'}>
                    <option value="przelew">Przelew</option>
                    <option value="gotowka">Gotówka</option>
                    <option value="karta">Karta płatnicza</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditId(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                <button type="submit" disabled={editSaving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">{editSaving ? 'Zapisywanie...' : 'Zapisz'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal usunięcia pojedynczego */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-900 mb-2">Usuń sprzedaż</h2>
            <p className="text-sm text-gray-500 mb-5">Czy na pewno chcesz usunąć tę transakcję?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{deleting ? 'Usuwanie...' : 'Tak, usuń'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal usunięcia zbiorczego */}
      {showDeleteBulk && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-900 mb-2">Usuń zaznaczone</h2>
            <p className="text-sm text-gray-500 mb-5">Czy na pewno chcesz usunąć <strong>{selected.size}</strong> zaznaczonych transakcji? Tej operacji nie można cofnąć.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteBulk(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleDeleteBulk} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{deleting ? 'Usuwanie...' : `Usuń ${selected.size} transakcji`}</button>
            </div>
          </div>
        </div>
      )}
      {/* Pływający przycisk czatu */}
      <CzatPanel modul="sprzedaz" compact />

      {/* Modal dokumentów sprzedaży */}
      {docsId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-gray-900">Dokumenty</h2>
              <button onClick={() => setDocsId(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{docsNr}</p>
            {docs.length === 0 ? <p className="text-sm text-gray-400 mb-4">Brak dokumentów.</p> : (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {docs.map((url, i) => (
                  <div key={i} className="relative group border border-gray-200 rounded-lg overflow-hidden">
                    {/\.(jpg|jpeg|png|webp)$/i.test(url)
                      ? <img src={url} alt="" className="w-full h-20 object-cover" />
                      : <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-20 bg-gray-50 hover:bg-gray-100">
                          <span className="text-2xl">📄</span>
                          <span className="text-xs text-gray-400 truncate w-full text-center px-1">{url.split('/').pop()}</span>
                        </a>}
                    <button onClick={() => handleDeleteDok(url)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-blue-300 transition-colors">
              <input ref={docsFileRef} type="file" multiple accept="image/*,.pdf" onChange={handleUploadDok} className="hidden" id="sp-dok-upload" />
              <label htmlFor="sp-dok-upload" className="cursor-pointer">
                <p className="text-sm text-gray-500 font-medium">{uploading ? 'Przesyłanie...' : 'Kliknij aby dodać pliki'}</p>
                <p className="text-xs text-gray-400">Zdjęcia lub PDF</p>
              </label>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setDocsId(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}