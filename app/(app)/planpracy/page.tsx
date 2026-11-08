'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

const STATUSY = {
  planowany:    { l:'Planowany',  bg:'bg-blue-100 text-blue-700',   border:'border-blue-200' },
  w_trakcie:    { l:'W trakcie',  bg:'bg-yellow-100 text-yellow-700', border:'border-yellow-200' },
  zakonczony:   { l:'Zakończony', bg:'bg-green-100 text-green-700',  border:'border-green-200' },
  urlop:        { l:'Urlop',      bg:'bg-purple-100 text-purple-700', border:'border-purple-200' },
  nieobecnosc:  { l:'Nieobecność',bg:'bg-red-100 text-red-700',     border:'border-red-200' },
}
const MIESIACE = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']
const KOLORY_INW = ['bg-blue-500','bg-emerald-500','bg-violet-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-amber-500','bg-indigo-500']
const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

function getWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getWeekDates(rok: number, tydzien: number): Date[] {
  const jan4 = new Date(rok, 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1)
  const monday = new Date(startOfWeek1)
  monday.setDate(startOfWeek1.getDate() + (tydzien - 1) * 7)
  return Array.from({length: 7}, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
}

export default function PlanPracyPage() {
  const supabase = createClient()
  const now = new Date()
  const [rok, setRok] = useState(now.getFullYear())
  const [miesiac, setMiesiac] = useState(now.getMonth() + 1)
  const [tydzien, setTydzien] = useState(getWeekNumber(now))
  const [viewMode, setViewMode] = useState<'tabela'|'kalendarz'|'tydzien'>('tabela')
  const [plan, setPlan] = useState<any[]>([])
  const [pracownicy, setPracownicy] = useState<any[]>([])
  const [inwestycje, setInwestycje] = useState<any[]>([])
  const [przetargi, setPrzetargi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterPrac, setFilterPrac] = useState('')
  const [errMsg, setErrMsg] = useState('')

  const [fPrac, setFPrac] = useState('')
  const [fInw, setFInw] = useState('')
  const [fPrzetarg, setFPrzetarg] = useState('')
  const [fDateOd, setFDateOd] = useState('')
  const [fDateDo, setFDateDo] = useState('')
  const [fGodziny, setFGodziny] = useState('40')
  const [fStatus, setFStatus] = useState('planowany')
  const [fOpis, setFOpis] = useState('')

  useEffect(() => { loadAll() }, [rok, miesiac])

  async function loadAll() {
    setLoading(true)
    setErrMsg('')
    try {
      const dateOd = `${rok}-${String(miesiac).padStart(2,'0')}-01`
      const dateDo = `${rok}-${String(miesiac + 1).padStart(2,'0')}-01` // następny miesiąc
      const [planRes, pracRes, inwRes, przeRes] = await Promise.all([
        supabase.from('plan_pracy')
          .select('*, pracownicy(id,imie,nazwisko), inwestycje(id,nazwa), przetargi(id,tytul)')
          .gte('data_od', dateOd).lt('data_od', dateDo)
          .order('data_od'),
        supabase.from('pracownicy').select('id, imie, nazwisko, stanowisko').eq('aktywny', true).order('nazwisko'),
        supabase.from('inwestycje').select('id, nazwa').order('nazwa'),
        supabase.from('przetargi').select('id, tytul').eq('usuniete', false).order('tytul').limit(100),
      ])
      if (planRes.error) throw new Error('plan_pracy: ' + planRes.error.message)
      if (pracRes.error) throw new Error('pracownicy: ' + pracRes.error.message)
      setPlan(planRes.data ?? [])
      setPracownicy(pracRes.data ?? [])
      setInwestycje(inwRes.data ?? [])
      setPrzetargi(przeRes.data ?? [])
    } catch(e: any) {
      setErrMsg(e.message)
      console.error('loadAll error:', e)
    }
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setFPrac('')
    setFInw('')
    setFPrzetarg('')
    const m = String(miesiac).padStart(2,'0')
    setFDateOd(`${rok}-${m}-01`)
    setFDateDo(`${rok}-${m}-07`)
    setFGodziny('40')
    setFStatus('planowany')
    setFOpis('')
    setShowModal(true)
  }

  function openEdit(p: any) {
    setEditing(p)
    setFPrac(p.pracownik_id)
    setFInw(p.inwestycja_id ?? '')
    setFPrzetarg(p.przetarg_id ?? '')
    setFDateOd(p.data_od ?? '')
    setFDateDo(p.data_do ?? '')
    setFGodziny(String(p.godziny ?? 40))
    setFStatus(p.status)
    setFOpis(p.opis ?? '')
    setShowModal(true)
  }

  async function save() {
    if (!fPrac) { alert('Wybierz pracownika'); return }
    if (!fDateOd) { alert('Podaj datę od'); return }
    setSaving(true)
    const dateObj = new Date(fDateOd)
    const payload = {
      pracownik_id: fPrac,
      inwestycja_id: fInw || null,
      przetarg_id: fPrzetarg || null,
      rok: dateObj.getFullYear(),
      miesiac: dateObj.getMonth() + 1,
      data_od: fDateOd,
      data_do: fDateDo || fDateOd,
      godziny: parseFloat(fGodziny) || 0,
      status: fStatus,
      opis: fOpis || null,
    }
    let error: any = null
    if (editing) {
      ({ error } = await supabase.from('plan_pracy').update(payload).eq('id', editing.id))
    } else {
      ({ error } = await supabase.from('plan_pracy').insert(payload))
    }
    setSaving(false)
    if (error) { alert('Błąd zapisu: ' + error.message); return }
    setShowModal(false)
    // Przełącz widok na miesiąc dodanego wpisu
    const savedRok = dateObj.getFullYear()
    const savedMiesiac = dateObj.getMonth() + 1
    if (savedRok !== rok) setRok(savedRok)
    if (savedMiesiac !== miesiac) setMiesiac(savedMiesiac)
    else await loadAll()
  }

  async function del(id: string) {
    if (!confirm('Usunąć wpis z planu?')) return
    await supabase.from('plan_pracy').delete().eq('id', id)
    loadAll()
  }

  // ── PDF tygodniowy ─────────────────────────────────────────────
  function generujPdfTydzien() {
    const weekDates = getWeekDates(rok, tydzien)
    const dateStrs = weekDates.map(d => d.toISOString().split('T')[0])
    const dateOd = dateStrs[0]; const dateDo = dateStrs[6]

    // Wpisy dla tego tygodnia
    const wpisTygodnia = plan.filter(p => p.data_od <= dateDo && (p.data_do || p.data_od) >= dateOd)
    const pracW = filterPrac ? pracownicy.filter(p => p.id === filterPrac) : pracownicy

    // Mapowanie kolorów inwestycji
    const inwKolory: Record<string, string> = {}
    const kolCSS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ec4899','#14b8a6','#f97316','#6366f1']
    inwestycje.forEach((inv, i) => { inwKolory[inv.id] = kolCSS[i % kolCSS.length] })

    const dniLabels = ['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela']

    let html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Plan pracy — Tydzień ${tydzien}/${rok}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #1f2937; }
  h1 { font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #6b7280; margin-bottom: 8px; font-size: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 4px 5px; vertical-align: top; }
  th { background: #f3f4f6; font-weight: bold; font-size: 8px; text-align: center; }
  th.dzien { background: #1e40af; color: white; font-size: 9px; }
  th.weekend { background: #dc2626; color: white; }
  .pracownik-col { width: 100px; background: #f9fafb; font-weight: bold; font-size: 8px; vertical-align: middle; }
  .wpis { border-radius: 3px; padding: 3px 4px; margin-bottom: 2px; color: white; font-size: 7.5px; line-height: 1.3; }
  .empty { color: #d1d5db; text-align: center; font-size: 8px; }
  .legenda { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
  .leg-item { display: flex; align-items: center; gap: 3px; font-size: 7px; }
  .leg-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
  .footer { margin-top: 8px; display: flex; justify-content: space-between; font-size: 7px; color: #6b7280; }
  .sign { border-top: 1px solid #374151; width: 120px; padding-top: 2px; text-align: center; }
</style>
</head>
<body>
<h1>📅 Plan pracy pracowników — Tydzień ${tydzien}/${rok}</h1>
<p class="subtitle">${dateOd} – ${dateDo} | Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
<table>
<thead>
  <tr>
    <th style="width:100px">Pracownik</th>
    ${weekDates.map((d, i) => {
      const isWe = d.getDay() === 0 || d.getDay() === 6
      const label = `${dniLabels[i]}<br/>${d.getDate()}.${String(d.getMonth()+1).padStart(2,'0')}`
      return `<th class="${isWe ? 'weekend' : 'dzien'}">${label}</th>`
    }).join('')}
    <th style="width:50px;background:#374151;color:white">Σ godz.</th>
  </tr>
</thead>
<tbody>`

    pracW.forEach(p => {
      let sumaGodz = 0
      const cells = weekDates.map(d => {
        const ds = d.toISOString().split('T')[0]
        const wpisDnia = wpisTygodnia.filter(w =>
          w.pracownik_id === p.id &&
          w.data_od <= ds && (w.data_do || w.data_od) >= ds
        )
        if (!wpisDnia.length) return `<td class="empty">-</td>`
        const content = wpisDnia.map(w => {
          const inv = inwestycje.find(i => i.id === w.inwestycja_id)
          const kol = w.inwestycja_id ? (inwKolory[w.inwestycja_id] || '#6b7280') : '#374151'
          const st = STATUSY[w.status as keyof typeof STATUSY]?.l || w.status
          sumaGodz += +(w.godziny || 0)
          return `<div class="wpis" style="background:${kol}">
            <div style="font-weight:bold">${inv?.nazwa || st}</div>
            <div>${w.godziny || 0}h${w.opis ? ' · ' + w.opis.substring(0, 20) : ''}</div>
          </div>`
        }).join('')
        return `<td>${content}</td>`
      })
      html += `<tr>
        <td class="pracownik-col">${p.imie} ${p.nazwisko}<br/><span style="color:#6b7280;font-weight:normal">${p.stanowisko||''}</span></td>
        ${cells.join('')}
        <td style="text-align:center;font-weight:bold;color:#1d4ed8">${sumaGodz > 0 ? sumaGodz + 'h' : '-'}</td>
      </tr>`
    })

    html += `</tbody>
</table>
<div class="legenda">
  <strong style="font-size:7px">Legenda inwestycji:</strong>
  ${inwestycje.filter(inv => wpisTygodnia.some(w => w.inwestycja_id === inv.id)).map(inv =>
    `<div class="leg-item"><div class="leg-dot" style="background:${inwKolory[inv.id]||'#6b7280'}"></div><span>${inv.nazwa}</span></div>`
  ).join('')}
</div>
<div class="footer">
  <div>GazCRM · Plan pracy · Tydzień ${tydzien}/${rok}</div>
  <div style="display:flex;gap:40px">
    <div class="sign">Sporządził</div>
    <div class="sign">Zatwierdził</div>
  </div>
</div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=1000,height=700')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500) }
  }

  // ── Kolory inwestycji ─────────────────────────────────────────
  const inwKolMap = useMemo(() => {
    const m: Record<string, string> = {}
    inwestycje.forEach((inv, i) => { m[inv.id] = KOLORY_INW[i % KOLORY_INW.length] })
    return m
  }, [inwestycje])

  // ── Widok tygodniowy ─────────────────────────────────────────
  const weekDates = useMemo(() => getWeekDates(rok, tydzien), [rok, tydzien])
  const planTygodnia = useMemo(() => {
    const od = weekDates[0].toISOString().split('T')[0]
    const do_ = weekDates[6].toISOString().split('T')[0]
    return plan.filter(p => p.data_od <= do_ && (p.data_do || p.data_od) >= od)
  }, [plan, weekDates])

  const filtered = useMemo(() => {
    if (!filterPrac) return plan
    return plan.filter(p => p.pracownik_id === filterPrac)
  }, [plan, filterPrac])

  // Sumowanie godzin per pracownik
  const sumaPrac = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of plan) { m[p.pracownik_id] = (m[p.pracownik_id] ?? 0) + +(p.godziny ?? 0) }
    return m
  }, [plan])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-14 z-10 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">📅 Plan pracy pracowników</h1>
            <p className="text-xs text-gray-500">{MIESIACE[miesiac-1]} {rok} · {plan.length} wpisów</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={rok} onChange={e => setRok(+e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={miesiac} onChange={e => setMiesiac(+e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {MIESIACE.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={filterPrac} onChange={e => setFilterPrac(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              <option value="">Wszyscy pracownicy</option>
              {pracownicy.map(p => <option key={p.id} value={p.id}>{p.imie} {p.nazwisko}</option>)}
            </select>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              {(['tabela','kalendarz','tydzien'] as const).map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 text-xs font-medium ${viewMode===v?'bg-gray-900 text-white':'text-gray-600 hover:bg-gray-50'}`}>
                  {v === 'tabela' ? '📋 Tabela' : v === 'kalendarz' ? '📅 Kalendarz' : '🗓 Tydzień'}
                </button>
              ))}
            </div>
            {/* Nawigacja tygodniowa - zawsze widoczna gdy tryb tydzień */}
            {viewMode === 'tydzien' && (
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => setTydzien(t => Math.max(1, t-1))} className="px-2 py-1.5 text-xs hover:bg-gray-50">‹</button>
                <span className="text-xs font-medium text-gray-700 px-2 border-x border-gray-200">Tyg. {tydzien}</span>
                <button onClick={() => setTydzien(t => Math.min(53, t+1))} className="px-2 py-1.5 text-xs hover:bg-gray-50">›</button>
              </div>
            )}
            {/* PDF — zawsze widoczny, generuje plan tygodniowy */}
            <button onClick={() => { if (viewMode !== 'tydzien') setViewMode('tydzien'); setTimeout(generujPdfTydzien, 100) }}
              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1.5">
              🖨 PDF planu
            </button>
            <button onClick={openAdd} className="bg-blue-600 text-white text-sm rounded-lg px-4 py-1.5 hover:bg-blue-700">
              + Dodaj wpis
            </button>
          </div>
        </div>
        {errMsg && <p className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">⚠ {errMsg}</p>}
      </div>

      <div className="p-4 max-w-7xl mx-auto">
        {/* Podsumowanie pracownicy */}
        {pracownicy.length > 0 && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6 mb-4">
            {pracownicy.filter(p => sumaPrac[p.id] > 0 || !filterPrac).slice(0, 12).map(p => (
              <button key={p.id} onClick={() => setFilterPrac(filterPrac === p.id ? '' : p.id)}
                className={`rounded-xl p-3 text-left border transition-colors ${filterPrac === p.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mb-1.5">
                  {p.imie?.[0]}{p.nazwisko?.[0]}
                </div>
                <p className="text-xs font-medium text-gray-900 truncate">{p.imie} {p.nazwisko}</p>
                <p className="text-xs text-gray-500">{sumaPrac[p.id] ?? 0}h</p>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Ładowanie...
          </div>
        ) : viewMode === 'tabela' ? (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Pracownik','Data od','Data do','Godziny','Inwestycja / Przetarg','Status','Opis','Akcje'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">
                    Brak wpisów — kliknij <strong>+ Dodaj wpis</strong>
                    {errMsg && <span className="block text-red-500 mt-1">{errMsg}</span>}
                  </td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.pracownicy?.imie} {p.pracownicy?.nazwisko}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.data_od}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.data_do}</td>
                    <td className="px-4 py-3 font-medium text-blue-700">{p.godziny}h</td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                      {p.inwestycje?.nazwa && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs ${inwKolMap[p.inwestycja_id] || 'bg-gray-500'}`}>
                          🏗 {p.inwestycje.nazwa}
                        </span>
                      )}
                      {p.przetargi?.tytul && <span className="block text-gray-400 truncate">🏆 {p.przetargi.tytul.substring(0,40)}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUSY[p.status as keyof typeof STATUSY]?.bg || 'bg-gray-100'} ${STATUSY[p.status as keyof typeof STATUSY]?.border || ''}`}>
                        {STATUSY[p.status as keyof typeof STATUSY]?.l ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{p.opis}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">✏</button>
                        <button onClick={() => del(p.id)} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50">🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'tydzien' ? (
          // ── WIDOK TYGODNIOWY ──
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium text-gray-700">Tydzień {tydzien}</span>
                <span className="text-xs text-gray-500">{weekDates[0].toLocaleDateString('pl-PL')} – {weekDates[6].toLocaleDateString('pl-PL')}</span>
              </div>
              <div className="flex gap-1 text-xs text-gray-500">
                {inwestycje.filter(inv => planTygodnia.some(w => w.inwestycja_id === inv.id)).map((inv, i) => (
                  <span key={inv.id} className={`px-2 py-0.5 rounded-full text-white text-xs ${inwKolMap[inv.id]}`}>{inv.nazwa}</span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 min-w-32 z-10">Pracownik</th>
                    {weekDates.map((d, i) => {
                      const isWe = d.getDay() === 0 || d.getDay() === 6
                      const dn = ['Nd','Pn','Wt','Śr','Cz','Pt','Sb'][d.getDay()]
                      return (
                        <th key={i} className={`px-2 py-2 text-center font-medium min-w-24 ${isWe ? 'bg-red-50 text-red-500' : 'text-gray-600'}`}>
                          <div>{dn} {d.getDate()}.{String(d.getMonth()+1).padStart(2,'0')}</div>
                        </th>
                      )
                    })}
                    <th className="px-2 py-2 text-center font-medium text-gray-600 min-w-14">Σ godz.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(filterPrac ? pracownicy.filter(p => p.id === filterPrac) : pracownicy).map(pr => {
                    let suma = 0
                    return (
                      <tr key={pr.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100">
                          {pr.imie} {pr.nazwisko}
                        </td>
                        {weekDates.map((d, i) => {
                          const ds = d.toISOString().split('T')[0]
                          const isWe = d.getDay() === 0 || d.getDay() === 6
                          const wpisDnia = planTygodnia.filter(w =>
                            w.pracownik_id === pr.id &&
                            w.data_od <= ds && (w.data_do || w.data_od) >= ds
                          )
                          suma += wpisDnia.reduce((a, w) => a + +(w.godziny || 0), 0)
                          return (
                            <td key={i} className={`px-1 py-1 ${isWe ? 'bg-red-50' : ''}`}>
                              {wpisDnia.map(w => (
                                <div key={w.id} onClick={() => openEdit(w)}
                                  className={`rounded-lg px-2 py-1 mb-0.5 cursor-pointer text-white text-xs leading-tight ${inwKolMap[w.inwestycja_id] || 'bg-gray-500'}`}>
                                  <div className="font-medium truncate">{w.inwestycje?.nazwa || STATUSY[w.status as keyof typeof STATUSY]?.l || w.status}</div>
                                  <div className="opacity-80">{w.godziny}h{w.opis ? ' · ' + w.opis.substring(0,12) : ''}</div>
                                </div>
                              ))}
                              {!wpisDnia.length && !isWe && (
                                <button onClick={() => { setFPrac(pr.id); setFDateOd(ds); setFDateDo(ds); setFGodziny('8'); setFStatus('planowany'); setFOpis(''); setFInw(''); setEditing(null); setShowModal(true) }}
                                  className="w-full h-8 text-gray-200 hover:text-gray-400 hover:bg-gray-50 rounded text-lg">+</button>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-center font-bold text-blue-700">{suma > 0 ? suma + 'h' : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // ── WIDOK KALENDARZA ──
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-32">Pracownik</th>
                    {Array.from({length: new Date(rok, miesiac, 0).getDate()}, (_, i) => {
                      const d = new Date(rok, miesiac-1, i+1)
                      const isWe = d.getDay() === 0 || d.getDay() === 6
                      return <th key={i} className={`px-1 py-2 text-center font-medium min-w-8 ${isWe ? 'bg-red-50 text-red-400' : 'text-gray-600'}`}>
                        <div>{i+1}</div>
                        <div className="text-gray-300">{['N','P','W','Ś','C','P','S'][d.getDay()]}</div>
                      </th>
                    })}
                    <th className="px-2 py-2 text-center font-medium text-gray-600">Σh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(filterPrac ? pracownicy.filter(p => p.id === filterPrac) : pracownicy).map(pr => (
                    <tr key={pr.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100">
                        {pr.imie} {pr.nazwisko}
                      </td>
                      {Array.from({length: new Date(rok, miesiac, 0).getDate()}, (_, i) => {
                        const ds = `${rok}-${String(miesiac).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`
                        const wpisy = filtered.filter(w => w.pracownik_id === pr.id && w.data_od <= ds && (w.data_do || w.data_od) >= ds)
                        const d = new Date(rok, miesiac-1, i+1)
                        const isWe = d.getDay() === 0 || d.getDay() === 6
                        return (
                          <td key={i} className={`px-0.5 py-0.5 ${isWe ? 'bg-red-50' : ''}`}>
                            {wpisy.map(w => (
                              <div key={w.id} onClick={() => openEdit(w)}
                                className={`rounded text-xs py-0.5 px-1 mb-0.5 cursor-pointer text-white truncate ${inwKolMap[w.inwestycja_id] || 'bg-gray-400'}`}
                                title={w.inwestycje?.nazwa || w.status}>
                                {w.godziny}h
                              </div>
                            ))}
                          </td>
                        )
                      })}
                      <td className="px-2 py-2 text-center font-bold text-blue-700">{sumaPrac[pr.id] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold">{editing ? 'Edytuj wpis' : 'Dodaj wpis do planu'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Pracownik *</label>
                <select value={fPrac} onChange={e => setFPrac(e.target.value)} className={inp}>
                  <option value="">— wybierz pracownika —</option>
                  {pracownicy.map(p => <option key={p.id} value={p.id}>{p.imie} {p.nazwisko} — {p.stanowisko}</option>)}
                </select>
                {pracownicy.length === 0 && <p className="text-xs text-red-500 mt-1">Brak pracowników — dodaj najpierw pracowników w module Inwestycje</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Data od *</label>
                  <input type="date" value={fDateOd} onChange={e => setFDateOd(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Data do</label>
                  <input type="date" value={fDateDo} onChange={e => setFDateDo(e.target.value)} className={inp} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Godziny łącznie</label>
                  <input type="number" value={fGodziny} onChange={e => setFGodziny(e.target.value)} min="0" step="0.5" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
                  <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inp}>
                    {Object.entries(STATUSY).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Inwestycja</label>
                <select value={fInw} onChange={e => setFInw(e.target.value)} className={inp}>
                  <option value="">— brak —</option>
                  {inwestycje.map(i => <option key={i.id} value={i.id}>{i.nazwa}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Przetarg (opcjonalnie)</label>
                <select value={fPrzetarg} onChange={e => setFPrzetarg(e.target.value)} className={inp}>
                  <option value="">— brak —</option>
                  {przetargi.map(p => <option key={p.id} value={p.id}>{p.tytul.substring(0,80)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Opis / notatka</label>
                <textarea value={fOpis} onChange={e => setFOpis(e.target.value)} rows={2}
                  placeholder="Np. montaż instalacji LPG..."
                  className={inp + ' resize-none'} />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-between items-center">
              {editing && <button onClick={() => del(editing.id)} className="text-xs text-red-500 hover:text-red-700">🗑 Usuń</button>}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                <button onClick={save} disabled={saving || !fPrac || !fDateOd}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 min-w-28">
                  {saving ? '⏳ Zapisuję...' : editing ? 'Zapisz zmiany' : '+ Dodaj do planu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
