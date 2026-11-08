'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'

const MIESIACE = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']
const MIESIACEP = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']
const inp = "w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

function fmt(n:number){return n.toLocaleString('pl-PL',{minimumFractionDigits:0,maximumFractionDigits:0})+' zł'}

export default function BudzetPage() {
  const supabase = createClient()
  const now = new Date()
  const [rok, setRok] = useState(now.getFullYear())
  const [viewMode, setViewMode] = useState<'roczny'|'miesiac'|'realizacja'|'ai'>('roczny')
  const [miesiac, setMiesiac] = useState(now.getMonth()+1)
  const [kategorie, setKategorie] = useState<any[]>([])
  const [plan, setPlan] = useState<any[]>([])
  const [realizacja, setRealizacja] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editCell, setEditCell] = useState<{katId:string,typ:'plan'|'real',m:number}|null>(null)
  const [editVal, setEditVal] = useState('')
  const [showAddReal, setShowAddReal] = useState(false)
  const [editReal, setEditReal] = useState<any>(null)  // edycja istniejącej realizacji
  const [showEditReal, setShowEditReal] = useState(false)
  const [fKat, setFKat] = useState('')
  const [fKwota, setFKwota] = useState('')
  const [fOpis, setFOpis] = useState('')
  const [fZrodlo, setFZrodlo] = useState('reczny')
  const [fMiesiac, setFMiesiac] = useState(String(now.getMonth()+1))
  const [savingReal, setSavingReal] = useState(false)
  // Import PDF lista płac
  const [showImportPdf, setShowImportPdf] = useState(false)
  const [importPdfLoading, setImportPdfLoading] = useState(false)
  const [importPdfResult, setImportPdfResult] = useState<any[]>([])
  const [importPdfNazwa, setImportPdfNazwa] = useState('')
  const [importPdfMiesiac, setImportPdfMiesiac] = useState(String(now.getMonth()+1))

  async function importujListePlac(file: File) {
    setImportPdfLoading(true)
    setImportPdfResult([])
    setImportPdfNazwa(file.name)
    try {
      // Odczytaj jako base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve((ev.target?.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      // Wyślij do server-side API (używa klucza Anthropic z env)
      const res = await fetch('/api/budzet/odczyt-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, filename: file.name }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setImportPdfResult(data.pozycje || [])
      if ((data.pozycje || []).length === 0) {
        alert('Nie znaleziono pozycji finansowych w PDF. Sprawdź czy plik to lista płac.')
      }
    } catch(e:any) {
      alert('Błąd odczytu PDF: ' + e.message)
      setImportPdfLoading(false)
    }
    setImportPdfLoading(false)
  }

  async function zapiszPozycjeZPdf() {
    const m = parseInt(importPdfMiesiac)
    for (const p of importPdfResult) {
      const kat = kategorie.find(k => k.nazwa === p.kategoria) ||
                  kategorie.find(k => p.kategoria.includes(k.nazwa.split(' ')[0]))
      await supabase.from('budzet_realizacja').insert({
        rok, miesiac: m,
        kategoria_id: kat?.id || null,
        kwota: p.kwota,
        opis: p.opis || importPdfNazwa,
        zrodlo: 'lista_plac',
      })
    }
    setShowImportPdf(false)
    setImportPdfResult([])
    load()
    alert(`Zapisano ${importPdfResult.length} pozycji z listy płac`)
  }

  // AI
  const [aiQ, setAiQ] = useState('')
  const [aiA, setAiA] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { load() }, [rok])

  async function load() {
    setLoading(true)
    const [{ data: kat }, { data: pl }, { data: real }] = await Promise.all([
      supabase.from('budzet_kategorie').select('*').order('typ').order('kolejnosc'),
      supabase.from('budzet_plan').select('*').eq('rok', rok),
      supabase.from('budzet_realizacja').select('*').eq('rok', rok),
    ])
    setKategorie(kat ?? [])
    setPlan(pl ?? [])
    setRealizacja(real ?? [])
    setLoading(false)
  }

  async function editRealizacja(r: any) {
    setEditReal(r)
    setFKat(r.kategoria_id || '')
    setFKwota(String(r.kwota))
    setFOpis(r.opis || '')
    setFZrodlo(r.zrodlo || 'reczny')
    setFMiesiac(String(r.miesiac))
    setShowEditReal(true)
  }

  async function saveEditReal() {
    if (!editReal) return
    setSavingReal(true)
    await supabase.from('budzet_realizacja').update({
      kategoria_id: fKat || null,
      kwota: parseFloat(fKwota.replace(',','.')) || 0,
      opis: fOpis,
      zrodlo: fZrodlo,
      miesiac: parseInt(fMiesiac),
    }).eq('id', editReal.id)
    setSavingReal(false)
    setShowEditReal(false)
    setEditReal(null)
    load()
  }

  async function deleteReal(id: string) {
    if (!confirm('Usunąć ten wpis realizacji?')) return
    await supabase.from('budzet_realizacja').delete().eq('id', id)
    load()
  }

  async function importZInfakt() {
    const infaktKey = localStorage.getItem('infakt_api_key') || ''
    if (!infaktKey) { alert('Najpierw połącz z inFakt w module inFakt (podaj klucz API)'); return }
    try {
      // Import przychodów (faktury sprzedażowe)
      const resF = await fetch(`/api/infakt/faktury?action=faktury&limit=200`, {
        headers: { 'X-inFakt-ApiKey': infaktKey }
      })
      const dataF = await resF.json()
      let dodanoP = 0
      for (const f of dataF.faktury ?? []) {
        const date = new Date(f.data_wystawienia ?? f.data_sprzedazy ?? '')
        if (isNaN(date.getTime()) || date.getFullYear() !== rok) continue
        const m = date.getMonth() + 1
        const kat = kategorie.find(k => k.nazwa.includes('sprzedaży') && k.typ === 'przychod')
        if (!kat) continue
        const { data: ex } = await supabase.from('budzet_realizacja').select('id')
          .eq('opis', f.numer).eq('rok', rok).eq('miesiac', m).maybeSingle()
        if (!ex) {
          await supabase.from('budzet_realizacja').insert({
            rok, miesiac: m, kategoria_id: kat.id,
            kwota: f.brutto, opis: f.numer ?? 'inFakt', zrodlo: 'infakt',
          })
          dodanoP++
        }
      }
      // Import kosztów
      const resK = await fetch(`/api/infakt/faktury?action=koszty&limit=200`, {
        headers: { 'X-inFakt-ApiKey': infaktKey }
      })
      const dataK = await resK.json()
      let dodanoK = 0
      const katMap: Record<string,string> = {
        'Wydatki przedsiębiorcy':'Usługi zewnętrzne','Paliwo':'Paliwo i transport',
        'Telekomunikacja':'Usługi zewnętrzne','Media':'Najem i media',
        'Ubezpieczenia':'Ubezpieczenia','Wynagrodzenia':'Wynagrodzenia brutto',
      }
      for (const k of dataK.koszty ?? []) {
        const date = new Date(k.data ?? '')
        if (isNaN(date.getTime()) || date.getFullYear() !== rok) continue
        const m = date.getMonth() + 1
        const katNazwa = katMap[k.kategoria] ?? 'Usługi zewnętrzne'
        const kat = kategorie.find(x => x.nazwa === katNazwa || x.nazwa.includes(katNazwa.split(' ')[0]))
        await supabase.from('budzet_realizacja').insert({
          rok, miesiac: m, kategoria_id: kat?.id ?? null,
          kwota: k.kwota_brutto,
          opis: `${k.numer ? k.numer + ' · ' : ''}${k.dostawca || k.nazwa}`,
          zrodlo: 'infakt',
        })
        dodanoK++
      }
      alert(`Zaimportowano z inFakt: ${dodanoP} przychodów + ${dodanoK} kosztów za rok ${rok}`)
      load()
    } catch(e:any) { alert('Błąd importu inFakt: ' + (e as any).message) }
  }

  function getPlan(katId:string, m:number):number {
    return plan.find(p => p.kategoria_id === katId && p.miesiac === m)?.kwota ?? 0
  }
  function getReal(katId:string, m:number):number {
    return realizacja.filter(r => r.kategoria_id === katId && r.miesiac === m).reduce((a:number,r:any)=>a+(+r.kwota),0)
  }
  function getSumPlan(katId:string):number {
    return plan.filter(p => p.kategoria_id === katId).reduce((a:number,p:any)=>a+(+p.kwota),0)
  }
  function getSumReal(katId:string):number {
    return realizacja.filter(r => r.kategoria_id === katId).reduce((a:number,r:any)=>a+(+r.kwota),0)
  }

  async function saveCell() {
    if (!editCell) return
    const kwota = parseFloat(editVal.replace(',','.')) || 0
    if (editCell.typ === 'plan') {
      const existing = plan.find(p => p.kategoria_id === editCell.katId && p.miesiac === editCell.m)
      if (existing) {
        await supabase.from('budzet_plan').update({ kwota }).eq('id', existing.id)
      } else {
        await supabase.from('budzet_plan').insert({ rok, miesiac: editCell.m, kategoria_id: editCell.katId, kwota })
      }
    }
    setEditCell(null)
    load()
  }

  async function saveRealizacja() {
    setSavingReal(true)
    await supabase.from('budzet_realizacja').insert({
      rok, miesiac: parseInt(fMiesiac),
      kategoria_id: fKat || null,
      kwota: parseFloat(fKwota.replace(',','.')) || 0,
      opis: fOpis, zrodlo: fZrodlo,
    })
    setSavingReal(false)
    setShowAddReal(false)
    setFKat(''); setFKwota(''); setFOpis('')
    load()
  }

  async function askAI() {
    if (!aiQ.trim()) return
    setAiLoading(true)
    const przychodySuma = kategorie.filter(k=>k.typ==='przychod').reduce((a:number,k:any)=>a+getSumReal(k.id),0)
    const kosztySuma = kategorie.filter(k=>k.typ==='koszt').reduce((a:number,k:any)=>a+getSumReal(k.id),0)
    const marza = przychodySuma - kosztySuma
    const planPrz = kategorie.filter(k=>k.typ==='przychod').reduce((a:number,k:any)=>a+getSumPlan(k.id),0)
    const planKosz = kategorie.filter(k=>k.typ==='koszt').reduce((a:number,k:any)=>a+getSumPlan(k.id),0)

    const context = `Dane budżetowe firmy ON-Gaz (sp. z o.o., dystrybucja LPG) za rok ${rok}:
Plan przychodów: ${fmt(planPrz)}, realizacja: ${fmt(przychodySuma)} (${planPrz ? Math.round(przychodySuma/planPrz*100) : 0}%)
Plan kosztów: ${fmt(planKosz)}, realizacja: ${fmt(kosztySuma)} (${planKosz ? Math.round(kosztySuma/planKosz*100) : 0}%)
Marża brutto: ${fmt(marza)}
Kategorie kosztów: ${kategorie.filter(k=>k.typ==='koszt').map(k=>`${k.nazwa}: plan ${fmt(getSumPlan(k.id))}, real ${fmt(getSumReal(k.id))}`).join('; ')}
Pytanie: ${aiQ}`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          system: 'Jesteś ekspertem finansowym dla małej firmy sp. z o.o. Analizujesz budżet i dajesz konkretne, praktyczne wskazówki po polsku. Odpowiadaj zwięźle.',
          messages: [{ role: 'user', content: context }]
        })
      })
      const d = await res.json()
      setAiA(d.content?.[0]?.text ?? 'Brak odpowiedzi')
    } catch(e:any) { setAiA('Błąd: ' + e.message) }
    setAiLoading(false)
  }

  const przychody = kategorie.filter(k => k.typ === 'przychod')
  const koszty = kategorie.filter(k => k.typ === 'koszt')
  const totalPlanPrz = przychody.reduce((a,k)=>a+getSumPlan(k.id),0)
  const totalRealPrz = przychody.reduce((a,k)=>a+getSumReal(k.id),0)
  const totalPlanKosz = koszty.reduce((a,k)=>a+getSumPlan(k.id),0)
  const totalRealKosz = koszty.reduce((a,k)=>a+getSumReal(k.id),0)
  const marza = totalRealPrz - totalRealKosz
  const marzaPlan = totalPlanPrz - totalPlanKosz

  // ── Alerty budżetowe ───────────────────────────────────────────────────────
  function getPct(planVal: number, realVal: number) {
    return planVal > 0 ? Math.round(realVal / planVal * 100) : null
  }
  function getAlertLevel(pct: number | null, typ: 'koszt' | 'przychod'): 'red' | 'yellow' | null {
    if (pct === null) return null
    if (typ === 'koszt') {
      if (pct >= 100) return 'red'
      if (pct >= 80) return 'yellow'
    } else {
      if (pct < 60) return 'red'
      if (pct < 80) return 'yellow'
    }
    return null
  }
  const alertyKoszt = koszty
    .map(k => ({ ...k, plan: getSumPlan(k.id), real: getSumReal(k.id) }))
    .filter(k => k.plan > 0)
    .map(k => ({ ...k, pct: getPct(k.plan, k.real), level: getAlertLevel(getPct(k.plan, k.real), 'koszt') }))
    .filter(k => k.level !== null)
    .sort((a,b) => (b.pct??0)-(a.pct??0))
  const alertyPrzychod = przychody
    .map(k => ({ ...k, plan: getSumPlan(k.id), real: getSumReal(k.id) }))
    .filter(k => k.plan > 0)
    .map(k => ({ ...k, pct: getPct(k.plan, k.real), level: getAlertLevel(getPct(k.plan, k.real), 'przychod') }))
    .filter(k => k.level !== null)
    .sort((a,b) => (a.pct??0)-(b.pct??0))
  const alerty = [...alertyKoszt, ...alertyPrzychod]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 sticky top-14 z-10 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 leading-tight">💰 Budżet</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Rok {rok} · Plan vs Realizacja</p>
          </div>
          <select value={rok} onChange={e=>setRok(+e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
            {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden flex-wrap">
            {([['roczny','📊 Roczny'],['miesiac','📅 Mies.'],['realizacja','📋 Real.'],['ai','🤖 AI']] as const).map(([v,l])=>(
              <button key={v} onClick={()=>setViewMode(v)} className={`px-2 sm:px-3 py-1.5 text-xs font-medium whitespace-nowrap ${viewMode===v?'bg-gray-900 text-white':'text-gray-600 hover:bg-gray-50'}`}>{l}</button>
            ))}
          </div>
          <button onClick={()=>setShowAddReal(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 whitespace-nowrap">+ Wpis</button>
          <button onClick={importZInfakt} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 hidden sm:block whitespace-nowrap">↓ inFakt</button>
          <label className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 cursor-pointer whitespace-nowrap">
            📎 Dokument
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
              onChange={e => { if(e.target.files?.[0]) { setShowImportPdf(true); importujListePlac(e.target.files[0]) } }} />
          </label>
        </div>
      </div>

      <div className="p-2 sm:p-4 max-w-full">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 mb-4 sm:mb-5">
          {[
            {l:'Plan przychodów',v:fmt(totalPlanPrz),bg:'bg-blue-600'},
            {l:'Realizacja przychodów',v:fmt(totalRealPrz),sub:`${totalPlanPrz?Math.round(totalRealPrz/totalPlanPrz*100):0}%`,bg:'bg-blue-500'},
            {l:'Plan kosztów',v:fmt(totalPlanKosz),bg:'bg-red-600'},
            {l:'Marża brutto',v:fmt(marza),sub:`plan: ${fmt(marzaPlan)}`,bg:marza>=0?'bg-green-600':'bg-red-600'},
          ].map(k=>(
            <div key={k.l} className={`${k.bg} text-white rounded-xl p-4`}>
              <p className="text-xs opacity-80 mb-1">{k.l}</p>
              <p className="text-xl font-semibold">{k.v}</p>
              {k.sub&&<p className="text-xs opacity-70 hidden sm:block">{k.sub}</p>}
            </div>
          ))}
        </div>

        {/* ══ ALERTY BUDŻETOWE ══ */}
        {alerty.length > 0 && viewMode === 'roczny' && (
          <div className="mb-4">
            <div className={`rounded-2xl border p-4 ${alerty.some(a=>a.level==='red') ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{alerty.some(a=>a.level==='red') ? '🔴' : '🟡'}</span>
                <h3 className={`text-sm font-semibold ${alerty.some(a=>a.level==='red') ? 'text-red-800' : 'text-amber-800'}`}>
                  {alerty.filter(a=>a.level==='red').length > 0 ? `${alerty.filter(a=>a.level==='red').length} przekroczeń budżetu` : ''}
                  {alerty.filter(a=>a.level==='red').length > 0 && alerty.filter(a=>a.level==='yellow').length > 0 ? ' · ' : ''}
                  {alerty.filter(a=>a.level==='yellow').length > 0 ? `${alerty.filter(a=>a.level==='yellow').length} ostrzeżeń` : ''}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {alerty.map(a => (
                  <div key={a.id} className={`bg-white rounded-xl p-3 border flex items-center gap-3 ${a.level==='red' ? 'border-red-200' : 'border-amber-200'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{a.nazwa}</p>
                      <p className="text-xs text-gray-500">{a.typ === 'koszt' ? 'Koszt' : 'Przychód'} · plan: {fmt(a.plan)}</p>
                      {/* Pasek postępu */}
                      <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${a.level==='red' ? 'bg-red-500' : 'bg-amber-400'}`}
                          style={{ width: `${Math.min(a.pct??0, 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-base font-bold ${a.level==='red' ? 'text-red-700' : 'text-amber-700'}`}>{a.pct}%</p>
                      <p className="text-xs text-gray-500">{fmt(a.real)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'roczny' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex items-center gap-2">
              <span>✏ Kliknij komórkę aby edytować plan</span>
              <span className="text-blue-400">·</span>
              <span className="font-medium text-blue-600">P:</span><span>plan</span>
              <span className="text-blue-400">·</span>
              <span className="font-medium text-green-600">R:</span><span>realizacja</span>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="text-sm" style={{ minWidth: '1040px', width: '100%' }}>
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-[57px]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-50" style={{ minWidth: 172 }}>Kategoria</th>
                    {MIESIACE.map((m,i)=>(
                      <th key={m} className={`px-2 py-3 text-center text-xs font-medium text-gray-500 ${i+1===miesiac?'bg-blue-50 text-blue-700':''}`} style={{ minWidth: 74 }}>{m}</th>
                    ))}
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 bg-gray-100" style={{ minWidth: 90 }}>SUMA</th>
                  </tr>
                </thead>
                <tbody>
                  {/* PRZYCHODY */}
                  <tr className="bg-blue-600 text-white">
                    <td colSpan={14} className="px-4 py-2 text-xs font-bold uppercase tracking-wide">PRZYCHODY</td>
                  </tr>
                  {przychody.map(k=>{
                    const sp=getSumPlan(k.id); const sr=getSumReal(k.id)
                    const pct=getPct(sp,sr); const lvl=getAlertLevel(pct,'przychod')
                    const sumaBg=lvl==='red'?'bg-red-50':lvl==='yellow'?'bg-amber-50':'bg-gray-50'
                    return (
                    <tr key={k.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-800 sticky left-0 bg-white" style={{ minWidth: 172 }}>{k.nazwa}</td>
                      {MIESIACE.map((_,i)=>{
                        const m=i+1; const p=getPlan(k.id,m); const r=getReal(k.id,m)
                        const isEdit=editCell?.katId===k.id&&editCell?.m===m&&editCell?.typ==='plan'
                        return (
                          <td key={m} className="px-1 py-1 text-center">
                            {isEdit ? (
                              <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                                onBlur={saveCell} onKeyDown={e=>{if(e.key==='Enter')saveCell();if(e.key==='Escape')setEditCell(null)}}
                                className="w-14 text-xs text-center border border-blue-400 rounded px-1 py-0.5" />
                            ):(
                              <div className="cursor-pointer hover:bg-blue-50 rounded px-0.5 py-0.5 group" onClick={()=>{setEditCell({katId:k.id,typ:'plan',m});setEditVal(String(p))}}>
                                <div className="text-xs"><span className="text-gray-400">P:</span><span className={p>0?'text-blue-600':'text-gray-300'}>{p>0?fmt(p):'-'}</span></div>
                                <div className="text-xs"><span className="text-gray-400">R:</span><span className={r>0?'text-green-600':'text-gray-300'}>{r>0?fmt(r):'-'}</span></div>
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className={`px-3 py-2 text-center ${sumaBg}`}>
                        <div className="text-xs text-blue-700 font-medium">{sp>0?fmt(sp):'-'}</div>
                        <div className="text-xs text-green-700 font-medium">{sr>0?fmt(sr):'-'}</div>
                        {pct!==null&&sp>0&&<div className={`text-xs font-bold mt-0.5 ${lvl==='red'?'text-red-600':lvl==='yellow'?'text-amber-600':'text-gray-400'}`}>{pct}%</div>}
                      </td>
                    </tr>
                  )})}
                  <tr className="bg-blue-50 border-b-2 border-blue-200 font-semibold">
                    <td className="px-4 py-2 text-xs text-blue-800 sticky left-0 bg-blue-50 font-bold">SUMA PRZYCHODÓW</td>
                    {MIESIACE.map((_,i)=>{
                      const m=i+1
                      const sp=przychody.reduce((a,k)=>a+getPlan(k.id,m),0)
                      const sr=przychody.reduce((a,k)=>a+getReal(k.id,m),0)
                      return <td key={m} className="px-1 py-2 text-center">
                        <div className="text-xs text-blue-700 font-semibold">{sp>0?fmt(sp):'-'}</div>
                        <div className="text-xs text-green-700 font-semibold">{sr>0?fmt(sr):'-'}</div>
                      </td>
                    })}
                    <td className="px-3 py-2 text-center bg-blue-100">
                      <div className="text-xs text-blue-800 font-bold">{totalPlanPrz>0?fmt(totalPlanPrz):'-'}</div>
                      <div className="text-xs text-green-800 font-bold">{totalRealPrz>0?fmt(totalRealPrz):'-'}</div>
                    </td>
                  </tr>

                  {/* KOSZTY */}
                  <tr className="bg-red-600 text-white">
                    <td colSpan={14} className="px-4 py-2 text-xs font-bold uppercase tracking-wide">KOSZTY</td>
                  </tr>
                  {koszty.map(k=>{
                    const sp=getSumPlan(k.id); const sr=getSumReal(k.id)
                    const pct=getPct(sp,sr); const lvl=getAlertLevel(pct,'koszt')
                    const sumaBg=lvl==='red'?'bg-red-100':lvl==='yellow'?'bg-amber-50':'bg-gray-50'
                    return (
                    <tr key={k.id} className={`border-b border-gray-100 hover:bg-gray-50 ${lvl==='red'?'bg-red-50/30':''}`}>
                      <td className="px-4 py-2 text-xs text-gray-800 sticky left-0 bg-white" style={{ minWidth: 172 }}>
                        {lvl && <span className="mr-1">{lvl==='red'?'🔴':'🟡'}</span>}{k.nazwa}
                      </td>
                      {MIESIACE.map((_,i)=>{
                        const m=i+1; const p=getPlan(k.id,m); const r=getReal(k.id,m)
                        const isEdit=editCell?.katId===k.id&&editCell?.m===m&&editCell?.typ==='plan'
                        const mPct=getPct(p,r); const mLvl=getAlertLevel(mPct,'koszt')
                        return (
                          <td key={m} className={`px-1 py-1 text-center ${mLvl==='red'?'bg-red-50':mLvl==='yellow'?'bg-amber-50/50':''}`}>
                            {isEdit ? (
                              <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                                onBlur={saveCell} onKeyDown={e=>{if(e.key==='Enter')saveCell();if(e.key==='Escape')setEditCell(null)}}
                                className="w-14 text-xs text-center border border-blue-400 rounded px-1 py-0.5" />
                            ):(
                              <div className="cursor-pointer hover:bg-red-50 rounded px-0.5 py-0.5" onClick={()=>{setEditCell({katId:k.id,typ:'plan',m});setEditVal(String(p))}}>
                                <div className="text-xs"><span className="text-gray-400">P:</span><span className={p>0?'text-red-500':'text-gray-300'}>{p>0?fmt(p):'-'}</span></div>
                                <div className="text-xs"><span className="text-gray-400">R:</span><span className={r>0?'text-orange-600':'text-gray-300'}>{r>0?fmt(r):'-'}</span></div>
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className={`px-3 py-2 text-center ${sumaBg}`}>
                        <div className="text-xs text-red-600 font-medium">{sp>0?fmt(sp):'-'}</div>
                        <div className="text-xs text-orange-600 font-medium">{sr>0?fmt(sr):'-'}</div>
                        {pct!==null&&sp>0&&<div className={`text-xs font-bold mt-0.5 ${lvl==='red'?'text-red-700':lvl==='yellow'?'text-amber-700':'text-gray-400'}`}>{pct}%</div>}
                      </td>
                    </tr>
                  )})}
                  <tr className="bg-red-50 border-b-2 border-red-200 font-semibold">
                    <td className="px-4 py-2 text-xs text-red-800 sticky left-0 bg-red-50 font-bold">SUMA KOSZTÓW</td>
                    {MIESIACE.map((_,i)=>{
                      const m=i+1
                      const sp=koszty.reduce((a,k)=>a+getPlan(k.id,m),0)
                      const sr=koszty.reduce((a,k)=>a+getReal(k.id,m),0)
                      return <td key={m} className="px-1 py-2 text-center">
                        <div className="text-xs text-red-700 font-semibold">{sp>0?fmt(sp):'-'}</div>
                        <div className="text-xs text-orange-700 font-semibold">{sr>0?fmt(sr):'-'}</div>
                      </td>
                    })}
                    <td className="px-3 py-2 text-center bg-red-100">
                      <div className="text-xs text-red-800 font-bold">{totalPlanKosz>0?fmt(totalPlanKosz):'-'}</div>
                      <div className="text-xs text-orange-800 font-bold">{totalRealKosz>0?fmt(totalRealKosz):'-'}</div>
                    </td>
                  </tr>

                  {/* WYNIK */}
                  <tr className="bg-gray-800 text-white font-bold">
                    <td className="px-4 py-3 text-sm sticky left-0 bg-gray-800">WYNIK (MARŻA)</td>
                    {MIESIACE.map((_,i)=>{
                      const m=i+1
                      const mp=przychody.reduce((a,k)=>a+getPlan(k.id,m),0)-koszty.reduce((a,k)=>a+getPlan(k.id,m),0)
                      const mr=przychody.reduce((a,k)=>a+getReal(k.id,m),0)-koszty.reduce((a,k)=>a+getReal(k.id,m),0)
                      return <td key={m} className="px-1 py-2 text-center">
                        <div className={`text-xs ${mp>=0?'text-green-300':'text-red-300'}`}>{mp!==0?fmt(mp):'-'}</div>
                        <div className={`text-xs font-bold ${mr>=0?'text-green-300':'text-red-300'}`}>{mr!==0?fmt(mr):''}</div>
                      </td>
                    })}
                    <td className="px-3 py-2 text-center bg-gray-700">
                      <div className={`text-xs ${marzaPlan>=0?'text-green-300':'text-red-300'}`}>{fmt(marzaPlan)}</div>
                      <div className={`text-sm font-bold ${marza>=0?'text-green-300':'text-red-300'}`}>{fmt(marza)}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'miesiac' && (
          <div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {MIESIACEP.map((m,i)=>(
                <button key={i} onClick={()=>setMiesiac(i+1)}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${miesiac===i+1?'bg-blue-600 text-white border-blue-600':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {m}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {['przychod','koszt'].map(typ=>(
                <div key={typ} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className={`px-4 py-3 ${typ==='przychod'?'bg-blue-600':'bg-red-600'} text-white`}>
                    <h3 className="font-semibold text-sm">{typ==='przychod'?'Przychody':'Koszty'} — {MIESIACEP[miesiac-1]}</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr><th className="px-3 py-2 text-left text-xs text-gray-500">Kategoria</th><th className="px-3 py-2 text-right text-xs text-gray-500">Plan</th><th className="px-3 py-2 text-right text-xs text-gray-500">Realizacja</th><th className="px-3 py-2 text-right text-xs text-gray-500">%</th></tr>
                    </thead>
                    <tbody>
                      {kategorie.filter(k=>k.typ===typ).map(k=>{
                        const p=getPlan(k.id,miesiac); const r=getReal(k.id,miesiac)
                        const pct=p>0?Math.round(r/p*100):null
                        return (
                          <tr key={k.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2">{k.nazwa}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{p>0?fmt(p):'-'}</td>
                            <td className={`px-3 py-2 text-right font-medium ${r>0?(typ==='przychod'?'text-green-700':'text-red-700'):''}`}>{r>0?fmt(r):'-'}</td>
                            <td className="px-3 py-2 text-right">
                              {pct!==null&&<span className={`text-xs px-2 py-0.5 rounded-full ${pct>=100?'bg-green-100 text-green-700':pct>=70?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>{pct}%</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'realizacja' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-gray-900">📋 Wpisy realizacji — {rok}</h3>
              <div className="flex gap-2 items-center">
                <select className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                  onChange={e => {
                    const m = e.target.value
                    setMiesiac(m ? parseInt(m) : miesiac)
                  }}>
                  <option value="">Wszystkie miesiące</option>
                  {MIESIACEP.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-gray-500">Miesiąc</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500">Kategoria</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500">Kwota</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500">Opis</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500">Źródło</th>
                    <th className="px-4 py-3 text-center text-xs text-gray-500">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {realizacja.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">Brak wpisów realizacji</td></tr>
                  ) : realizacja.map(r => {
                    const kat = kategorie.find(k => k.id === r.kategoria_id)
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs font-medium text-gray-600">{MIESIACEP[r.miesiac-1]}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${kat?.typ==='przychod'?'bg-blue-100 text-blue-700':'bg-red-100 text-red-700'}`}>
                            {kat?.nazwa || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{fmt(+r.kwota)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{r.opis}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.zrodlo==='infakt'?'bg-emerald-100 text-emerald-700':r.zrodlo==='lista_plac'?'bg-orange-100 text-orange-700':'bg-gray-100 text-gray-600'}`}>
                            {r.zrodlo==='infakt'?'inFakt':r.zrodlo==='lista_plac'?'Lista płac':r.zrodlo==='import'?'Import':'Ręczny'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => editRealizacja(r)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">✏ Edytuj</button>
                            <button onClick={() => deleteReal(r.id)} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50">🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'ai' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm">🤖</div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Asystent AI — Analiza budżetu</h3>
                <p className="text-xs text-gray-500">Zapytaj o wyniki, prognozy, optymalizację kosztów lub planowanie</p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-xs text-blue-700">
              AI ma dostęp do danych budżetowych roku {rok}: przychodów ({fmt(totalRealPrz)}/{fmt(totalPlanPrz)}), kosztów ({fmt(totalRealKosz)}/{fmt(totalPlanKosz)}) i marży ({fmt(marza)}).
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {['Jak wygląda realizacja budżetu?','Gdzie przekraczamy plan kosztów?','Jakie są największe ryzyka?','Zaproponuj optymalizację kosztów'].map(q=>(
                <button key={q} onClick={()=>setAiQ(q)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">{q}</button>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input value={aiQ} onChange={e=>setAiQ(e.target.value)} placeholder="Zadaj pytanie o budżet..."
                onKeyDown={e=>{if(e.key==='Enter')askAI()}}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={askAI} disabled={aiLoading||!aiQ.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {aiLoading?'⏳':'Zapytaj'}
              </button>
            </div>
            {aiA && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap">
                {aiA}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal import listy płac PDF */}
      {showImportPdf && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex justify-between">
              <h3 className="font-semibold text-gray-900">📄 Import listy płac</h3>
              <button onClick={()=>{setShowImportPdf(false);setImportPdfResult([])}} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4">
              {importPdfLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Odczytuję PDF z pomocą AI Claude...</p>
                  <p className="text-xs text-gray-400 mt-1">{importPdfNazwa}</p>
                </div>
              ) : importPdfResult.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Znaleziono {importPdfResult.length} pozycji:</p>
                  <div className="space-y-2 mb-4">
                    {importPdfResult.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.kategoria}</p>
                          <p className="text-xs text-gray-500">{p.opis}</p>
                        </div>
                        <span className="text-sm font-bold text-red-600">{p.kwota?.toLocaleString('pl-PL')} zł</span>
                      </div>
                    ))}
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 block mb-1">Miesiąc realizacji</label>
                    <select value={importPdfMiesiac} onChange={e=>setImportPdfMiesiac(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      {MIESIACEP.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>{setShowImportPdf(false);setImportPdfResult([])}} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg">Anuluj</button>
                    <button onClick={zapiszPozycjeZPdf} className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      Zapisz do realizacji
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-6 text-sm">Wybierz plik PDF aby rozpocząć import</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal edycji realizacji */}
      {showEditReal && editReal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-100 flex justify-between">
              <h3 className="font-semibold text-gray-900">✏ Edytuj wpis realizacji</h3>
              <button onClick={()=>{setShowEditReal(false);setEditReal(null)}} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Miesiąc</label>
                <select value={fMiesiac} onChange={e=>setFMiesiac(e.target.value)} className={inp}>
                  {MIESIACEP.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Kategoria</label>
                <select value={fKat} onChange={e=>setFKat(e.target.value)} className={inp}>
                  <option value="">— brak —</option>
                  <optgroup label="Przychody">{przychody.map(k=><option key={k.id} value={k.id}>{k.nazwa}</option>)}</optgroup>
                  <optgroup label="Koszty">{koszty.map(k=><option key={k.id} value={k.id}>{k.nazwa}</option>)}</optgroup>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Kwota (zł)</label>
                <input value={fKwota} onChange={e=>setFKwota(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Opis</label>
                <input value={fOpis} onChange={e=>setFOpis(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Źródło</label>
                <select value={fZrodlo} onChange={e=>setFZrodlo(e.target.value)} className={inp}>
                  <option value="reczny">Wpis ręczny</option>
                  <option value="import">Import</option>
                  <option value="lista_plac">Lista płac</option>
                  <option value="infakt">inFakt</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2 justify-between">
              <button onClick={()=>deleteReal(editReal.id)} className="text-xs text-red-500 hover:text-red-700">🗑 Usuń wpis</button>
              <div className="flex gap-2">
                <button onClick={()=>{setShowEditReal(false);setEditReal(null)}} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Anuluj</button>
                <button onClick={saveEditReal} disabled={savingReal} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
                  {savingReal?'Zapisuję...':'Zapisz zmiany'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal dodaj realizację */}
      {showAddReal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-100 flex justify-between">
              <h3 className="font-semibold text-gray-900">Dodaj wpis realizacji</h3>
              <button onClick={()=>setShowAddReal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Miesiąc</label>
                <select value={fMiesiac} onChange={e=>setFMiesiac(e.target.value)} className={inp}>
                  {MIESIACEP.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Kategoria</label>
                <select value={fKat} onChange={e=>setFKat(e.target.value)} className={inp}>
                  <option value="">— wybierz —</option>
                  <optgroup label="Przychody">{przychody.map(k=><option key={k.id} value={k.id}>{k.nazwa}</option>)}</optgroup>
                  <optgroup label="Koszty">{koszty.map(k=><option key={k.id} value={k.id}>{k.nazwa}</option>)}</optgroup>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Kwota (zł)</label>
                <input value={fKwota} onChange={e=>setFKwota(e.target.value)} placeholder="np. 12500" className={inp} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Opis / nr dokumentu</label>
                <input value={fOpis} onChange={e=>setFOpis(e.target.value)} placeholder="np. Faktura zakupu, Lista płac..." className={inp} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Źródło</label>
                <select value={fZrodlo} onChange={e=>setFZrodlo(e.target.value)} className={inp}>
                  <option value="reczny">Wpis ręczny</option>
                  <option value="import">Import (Excel/CSV)</option>
                  <option value="lista_plac">Lista płac</option>
                  <option value="infakt">inFakt</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={()=>setShowAddReal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Anuluj</button>
              <button onClick={saveRealizacja} disabled={savingReal||!fKwota} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
                {savingReal?'Zapisuję...':'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
