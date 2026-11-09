'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

const RODZAJE = {
  praca:           { l:'Praca',         bg:'bg-blue-100 text-blue-800',   short:'P' },
  urlop:           { l:'Urlop',         bg:'bg-purple-100 text-purple-800', short:'U' },
  l4:              { l:'L4',            bg:'bg-red-100 text-red-800',     short:'L4' },
  szkolenie:       { l:'Szkolenie',     bg:'bg-yellow-100 text-yellow-800', short:'Sz' },
  delegacja:       { l:'Wyjazd cateringowy',     bg:'bg-orange-100 text-orange-800', short:'D' },
  swieto:          { l:'Święto',        bg:'bg-gray-100 text-gray-500',   short:'Św' },
  nieobecnosc_inna:{ l:'Nieobecność',   bg:'bg-gray-100 text-gray-600',   short:'N' },
  nadgodziny:      { l:'Nadgodziny',    bg:'bg-green-100 text-green-800', short:'NG' },
}
const MIESIACE = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']
const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
const NORM_DZIEN = 8

export default function CzasPracyPage() {
  const supabase = createClient()
  const now = new Date()
  const [rok, setRok] = useState(now.getFullYear())
  const [miesiac, setMiesiac] = useState(now.getMonth()+1)
  const [viewMode, setViewMode] = useState<'miesiac'|'tydzien'|'dzien'|'roczny'|'lista_obecnosci'>('miesiac')
  const [pracownicy, setPracownicy] = useState<any[]>([])
  const [wydarzenia, setWydarzenia] = useState<any[]>([])
  const [wpisy, setWpisy] = useState<any[]>([])
  const [wpisyRok, setWpisyRok] = useState<any[]>([])
  const [loadingRoczne, setLoadingRoczne] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showUploadLista, setShowUploadLista] = useState(false)
  const [uploadListaFile, setUploadListaFile] = useState<File|null>(null)
  const [uploadListaLoading, setUploadListaLoading] = useState(false)
  const [uploadListaMsg, setUploadListaMsg] = useState('')
  const [uploadListaOpis, setUploadListaOpis] = useState('')
  const [uploadListaPrac, setUploadListaPrac] = useState('')
  const [listaPliki, setListaPliki] = useState<any[]>([])
  const [listaPlikiLoading, setListaPlikiLoading] = useState(false)

  async function loadListaPliki() {
    setListaPlikiLoading(true)
    const { data } = await supabase.from('listy_obecnosci')
      .select('*,pracownicy(imie,nazwisko)')
      .eq('rok', rok).eq('miesiac', miesiac)
      .order('created_at', { ascending: false })
    setListaPliki(data ?? [])
    setListaPlikiLoading(false)
  }

  async function uploadListaObecnosci() {
    if (!uploadListaFile) return
    setUploadListaLoading(true); setUploadListaMsg('')
    try {
      const storagePath = `${rok}/${miesiac}/${Date.now()}_${uploadListaFile.name}`
      const { error: storageErr } = await supabase.storage
        .from('listy-obecnosci')
        .upload(storagePath, uploadListaFile, { contentType: uploadListaFile.type })
      if (storageErr) throw new Error(storageErr.message)
      const { error: dbErr } = await supabase.from('listy_obecnosci').insert({
        rok, miesiac,
        nazwa_pliku: uploadListaFile.name,
        storage_path: storagePath,
        typ_pliku: uploadListaFile.type,
        rozmiar: uploadListaFile.size,
        pracownik_id: uploadListaPrac || null,
        opis: uploadListaOpis || null,
      })
      if (dbErr) throw new Error(dbErr.message)
      setUploadListaMsg('✓ Lista wgrana pomyślnie')
      setUploadListaFile(null); setUploadListaOpis(''); setUploadListaPrac('')
      loadListaPliki()
    } catch(e: any) { setUploadListaMsg('Błąd: ' + e.message) }
    setUploadListaLoading(false)
  }

  async function deleteListaPlik(id: string, storagePath: string) {
    if (!confirm('Usunąć plik?')) return
    await supabase.storage.from('listy-obecnosci').remove([storagePath])
    await supabase.from('listy_obecnosci').delete().eq('id', id)
    loadListaPliki()
  }

  async function getDownloadUrl(storagePath: string) {
    const { data } = await supabase.storage.from('listy-obecnosci').createSignedUrl(storagePath, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }
  const [editWpis, setEditWpis] = useState<any>(null)
  const [filterPrac, setFilterPrac] = useState('')
  // Form
  const [fPrac, setFPrac] = useState('')
  const [fData, setFData] = useState(now.toISOString().split('T')[0])
  const [fOd, setFOd] = useState('08:00')
  const [fDo, setFDo] = useState('16:00')
  const [fRodzaj, setFRodzaj] = useState('praca')
  const [fGodziny, setFGodziny] = useState('8')
  const [fInw, setFInw] = useState('')
  const [fDelegacja, setFDelegacja] = useState(false)
  const [fDelegacjaStawka, setFDelegacjaStawka] = useState('45')
  const [fOpis, setFOpis] = useState('')

  useEffect(()=>{ loadAll(); loadListaPliki() },[rok,miesiac])
  useEffect(()=>{ if(viewMode==='roczny') loadRoczne() },[viewMode,rok])

  async function loadRoczne(){
    setLoadingRoczne(true)
    // Lista obecności pokazuje wyłącznie pozycje zatwierdzone.
    // Swoje oczekujące pracownik widzi w module Akceptacje → Moje zgłoszenia.
    const { data } = await supabase.from('czas_pracy')
      .select('*,pracownicy(imie,nazwisko),wydarzenia(nazwa)')
      .eq('stan_akceptacji', 'zaakceptowany')
      .gte('data', `${rok}-01-01`)
      .lte('data', `${rok}-12-31`)
      .order('data')
    setWpisyRok(data ?? [])
    setLoadingRoczne(false)
  }

  async function loadAll(){
    setLoading(true)
    const dateOd = `${rok}-${String(miesiac).padStart(2,'0')}-01`
    // Ostatni dzień miesiąca — getDate() zamiast toISOString() żeby uniknąć błędu stref czasowych (UTC+2)
    const lastDay = new Date(rok, miesiac, 0).getDate()
    const dateDo = `${rok}-${String(miesiac).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    const [{data:pr},{data:inv},{data:wp}] = await Promise.all([
      supabase.from('pracownicy').select('id,imie,nazwisko,stanowisko,stawka_godzinowa,wynagrodzenie_brutto').eq('aktywny',true).order('nazwisko'),
      supabase.from('wydarzenia').select('id,nazwa').order('nazwa'),
      supabase.from('czas_pracy').select('*,pracownicy(imie,nazwisko),wydarzenia(nazwa)').eq('stan_akceptacji','zaakceptowany').gte('data',dateOd).lte('data',dateDo).order('data'),
    ])
    setPracownicy(pr??[])
    setWydarzenia(inv??[])
    setWpisy(wp??[])
    setLoading(false)
  }

  function dniMiesiaca(){
    const d=new Date(rok,miesiac,0).getDate()
    return Array.from({length:d},(_,i)=>i+1)
  }
  function dayOfWeek(d:number){
    return new Date(rok,miesiac-1,d).getDay()
  }
  function isWeekend(d:number){const dow=dayOfWeek(d);return dow===0||dow===6}
  const DOW=['N','P','W','Ś','C','P','S']

  function getWpisyPrac(pracId:string, dzien:number){
    const ds=`${rok}-${String(miesiac).padStart(2,'0')}-${String(dzien).padStart(2,'0')}`
    return wpisy.filter(w=>w.pracownik_id===pracId&&w.data===ds)
  }
  function sumGodziny(pracId:string):number{
    return wpisy.filter(w=>w.pracownik_id===pracId&&w.rodzaj==='praca').reduce((a:number,w:any)=>a+(+w.godziny),0)
  }
  function sumKoszt(pracId:string):number{
    return wpisy.filter(w=>w.pracownik_id===pracId).reduce((a:number,w:any)=>a+(+w.koszt_calkowity||0),0)
  }
  function sumKosztWydarzenie(wydarzenieId:string):number{
    return wpisy.filter(w=>w.wydarzenie_id===wydarzenieId).reduce((a:number,w:any)=>a+(+w.koszt_calkowity||0),0)
  }
  function sumUrlop(pracId:string){return wpisy.filter(w=>w.pracownik_id===pracId&&w.rodzaj==='urlop').length}
  function sumL4(pracId:string){return wpisy.filter(w=>w.pracownik_id===pracId&&w.rodzaj==='l4').length}

  function openAdd(pracId?:string, data?:string){
    setEditWpis(null)
    setFPrac(pracId||'')
    setFData(data||now.toISOString().split('T')[0])
    setFOd('08:00'); setFDo('16:00'); setFRodzaj('praca')
    setFGodziny('8'); setFInw(''); setFOpis('')
    setShowModal(true)
  }
  function openEdit(w:any){
    setEditWpis(w)
    setFPrac(w.pracownik_id); setFData(w.data)
    setFOd(w.godzina_od||'08:00'); setFDo(w.godzina_do||'16:00')
    setFRodzaj(w.rodzaj); setFGodziny(String(w.godziny))
    setFInw(w.wydarzenie_id||''); setFDelegacja(w.delegacja||false); setFDelegacjaStawka(String(w.delegacja_stawka||45)); setFOpis(w.opis||'')
    setShowModal(true)
  }

  async function save(){
    setSaveError('')
    const pr = pracownicy.find(p => p.id === fPrac)
    const stawka = parseFloat(String(pr?.stawka_godzinowa || 0))
    const godziny = parseFloat(fGodziny) || 0
    const delegacjaKwota = fDelegacja ? parseFloat(fDelegacjaStawka) : 0
    const kosztCalkowity = fRodzaj === 'praca' ? (godziny * stawka + delegacjaKwota) : (fRodzaj === 'delegacja' ? delegacjaKwota : 0)
    const payload={
      pracownik_id:fPrac, data:fData,
      godzina_od:fOd, godzina_do:fDo,
      godziny,
      rodzaj:fRodzaj,
      delegacja:fDelegacja,
      delegacja_stawka:parseFloat(fDelegacjaStawka)||45,
      koszt_calkowity:kosztCalkowity,
      wydarzenie_id:fInw||null,
      opis:fOpis,
    }
    let err: any = null
    if(editWpis){
      const { error } = await supabase.from('czas_pracy').update(payload).eq('id',editWpis.id)
      err = error
    } else {
      // Próbuj insert; jeśli narusza unique (23505) — update istniejącego wiersza
      const { error: insertErr } = await supabase.from('czas_pracy').insert(payload)
      if (insertErr?.code === '23505') {
        const { error: updateErr } = await supabase.from('czas_pracy')
          .update(payload)
          .eq('pracownik_id', fPrac)
          .eq('data', fData)
          .eq('rodzaj', fRodzaj)
        err = updateErr
      } else {
        err = insertErr
      }
    }
    if(err){ setSaveError('Błąd zapisu: ' + err.message); return }
    setShowModal(false); loadAll()
  }

  async function del(id:string){
    if(!confirm('Usunąć?'))return
    await supabase.from('czas_pracy').delete().eq('id',id); loadAll()
  }

  // Eksport listy obecności jako HTML do druku
  function eksportListaObecnosci(){
    const filtPrac = filterPrac ? pracownicy.filter(p=>p.id===filterPrac) : pracownicy
    const dni = dniMiesiaca()
    let html = `<html><head><title>Lista obecności ${MIESIACE[miesiac-1]} ${rok}</title>
<style>body{font-family:Arial,sans-serif;font-size:10px}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ccc;padding:3px 4px;text-align:center}
th{background:#f0f0f0;font-weight:bold}.name{text-align:left;min-width:120px}
.P{background:#dbeafe}.U{background:#ede9fe}.L4{background:#fee2e2}
.D{background:#ffedd5}.N{background:#f3f4f6}.NG{background:#dcfce7}
</style></head><body>
<h2 style="text-align:center">Lista obecności — ${MIESIACE[miesiac-1]} ${rok}</h2>
<table><tr><th class="name">Pracownik</th>`
    dni.forEach(d=>{
      const dow=dayOfWeek(d)
      html+=`<th style="${isWeekend(d)?'background:#f87171;color:white':''}">${d}<br>${DOW[dow]}</th>`
    })
    html+=`<th>Suma h</th><th>URL</th><th>L4</th></tr>`
    filtPrac.forEach(p=>{
      html+=`<tr><td class="name">${p.imie} ${p.nazwisko}</td>`
      dni.forEach(d=>{
        const ws=getWpisyPrac(p.id,d)
        const w=ws[0]
        if(isWeekend(d)){html+=`<td style="background:#fecaca"></td>`}
        else if(w){const sh=RODZAJE[w.rodzaj as keyof typeof RODZAJE]?.short||'?';html+=`<td class="${sh}">${sh}</td>`}
        else{html+=`<td></td>`}
      })
      html+=`<td><b>${sumGodziny(p.id)}</b></td><td>${sumUrlop(p.id)}</td><td>${sumL4(p.id)}</td></tr>`
    })
    html+=`</table>
<div style="margin-top:20px;font-size:9px">P=Praca, U=Urlop, L4=L4, Sz=Szkolenie, D=Delegacja, N=Nieobecność, NG=Nadgodziny</div>
<div style="margin-top:40px">Podpis kierownika: ___________________________</div>
</body></html>`
    const w=window.open('','_blank')
    if(w){w.document.write(html);w.document.close();w.print()}
  }

  const filtPrac = filterPrac ? pracownicy.filter(p=>p.id===filterPrac) : pracownicy
  const totalGodziny = filtPrac.reduce((a,p)=>a+sumGodziny(p.id),0)
  const totalKoszt = filtPrac.reduce((a,p)=>a+sumKoszt(p.id),0)

  // Koszty per wydarzenie (z widocznych wpisów)
  const kosztPerWydarzenie = useMemo(() => {
    const map: Record<string, {nazwa:string, koszt:number, godziny:number}> = {}
    wpisy.filter(w => w.wydarzenie_id && (!filterPrac || w.pracownik_id === filterPrac)).forEach((w:any) => {
      if (!map[w.wydarzenie_id]) map[w.wydarzenie_id] = { nazwa: w.wydarzenia?.nazwa || '?', koszt: 0, godziny: 0 }
      map[w.wydarzenie_id].koszt += (+w.koszt_calkowity || 0)
      map[w.wydarzenie_id].godziny += (+w.godziny || 0)
    })
    return Object.values(map).sort((a,b) => b.koszt - a.koszt)
  }, [wpisy, filterPrac])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-14 z-10 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">⏱ Ewidencja czasu pracy</h1>
            <p className="text-xs text-gray-500">{MIESIACE[miesiac-1]} {rok} · {totalGodziny}h łącznie · koszty: {totalKoszt.toLocaleString('pl-PL')} zł</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={rok} onChange={e=>setRok(+e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <select value={miesiac} onChange={e=>setMiesiac(+e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {MIESIACE.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={filterPrac} onChange={e=>setFilterPrac(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              <option value="">Wszyscy pracownicy</option>
              {pracownicy.map(p=><option key={p.id} value={p.id}>{p.imie} {p.nazwisko}</option>)}
            </select>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              {([['miesiac','Miesiąc'],['roczny','Roczny'],['lista_obecnosci','Lista obecności']] as const).map(([v,l])=>(
                <button key={v} onClick={()=>setViewMode(v)} className={`px-3 py-1.5 text-xs font-medium ${viewMode===v?'bg-gray-900 text-white':'text-gray-600 hover:bg-gray-50'}`}>{l}</button>
              ))}
            </div>
            <button onClick={()=>openAdd()} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">+ Wpis</button>
            <button onClick={eksportListaObecnosci} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">🖨 Lista obecności</button>
            <button onClick={()=>setShowUploadLista(v=>!v)} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">📎 Wgraj listę</button>
          </div>
        </div>
      </div>

      {/* Panel upload list obecności */}
      {showUploadLista && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-4">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">📎 Wgraj listę obecności — {MIESIACE[miesiac-1]} {rok}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Formularz uploadu */}
              <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Plik (JPEG, PNG, PDF)</label>
                  <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                    onChange={e => setUploadListaFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                  {uploadListaFile && (
                    <p className="text-xs text-gray-500 mt-1">{uploadListaFile.name} · {(uploadListaFile.size/1024).toFixed(0)} KB</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Pracownik (opcjonalnie)</label>
                  <select value={uploadListaPrac} onChange={e=>setUploadListaPrac(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— wszyscy / ogólna —</option>
                    {pracownicy.map(p=><option key={p.id} value={p.id}>{p.imie} {p.nazwisko}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Opis (opcjonalnie)</label>
                  <input value={uploadListaOpis} onChange={e=>setUploadListaOpis(e.target.value)}
                    placeholder="np. lista podpisana przez kierownika..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={uploadListaObecnosci} disabled={!uploadListaFile||uploadListaLoading}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {uploadListaLoading ? 'Wgrywanie...' : '⬆ Wgraj'}
                  </button>
                  {uploadListaMsg && (
                    <span className={`text-xs ${uploadListaMsg.startsWith('Błąd')?'text-red-600':'text-green-600'}`}>{uploadListaMsg}</span>
                  )}
                </div>
              </div>
              {/* Lista wgranych plików */}
              <div className="bg-white rounded-xl border border-blue-200 p-4">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Wgrane pliki — {MIESIACE[miesiac-1]} {rok}</h4>
                {listaPlikiLoading ? (
                  <p className="text-xs text-gray-400">Ładowanie...</p>
                ) : listaPliki.length === 0 ? (
                  <p className="text-xs text-gray-400">Brak wgranych plików w tym miesiącu</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {listaPliki.map(p=>(
                      <div key={p.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{p.nazwa_pliku}</p>
                          <p className="text-xs text-gray-400">
                            {p.pracownicy ? `${p.pracownicy.imie} ${p.pracownicy.nazwisko} · ` : ''}
                            {p.opis || ''}{p.rozmiar ? ` · ${(p.rozmiar/1024).toFixed(0)} KB` : ''}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={()=>getDownloadUrl(p.storage_path)}
                            className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">↓</button>
                          <button onClick={()=>deleteListaPlik(p.id, p.storage_path)}
                            className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 max-w-7xl mx-auto">
        {/* Podsumowanie pracownicy */}
        {viewMode !== 'lista_obecnosci' && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6 mb-4">
            {filtPrac.map(p=>(
              <div key={p.id} className={`bg-white border rounded-xl p-3 cursor-pointer ${filterPrac===p.id?'border-blue-400 bg-blue-50':'border-gray-200 hover:border-gray-300'}`}
                onClick={()=>setFilterPrac(filterPrac===p.id?'':p.id)}>
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mb-1.5">{p.imie?.[0]}{p.nazwisko?.[0]}</div>
                <p className="text-xs font-medium text-gray-900 truncate">{p.imie} {p.nazwisko}</p>
                <p className="text-xs text-blue-600">{sumGodziny(p.id)}h pracy</p>
                <p className="text-xs text-purple-500">{sumUrlop(p.id)}d urlop · {sumL4(p.id)}d L4</p>
              </div>
            ))}
          </div>
        )}

        {kosztPerWydarzenie.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">💰 Koszty pracy per wydarzenie — {MIESIACE[miesiac-1]} {rok}</h3>
            <div className="flex flex-wrap gap-2">
              {kosztPerWydarzenie.map((inv,i)=>(
                <div key={i} className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <span className="text-xs font-medium text-blue-800">{inv.nazwa}</span>
                  <span className="text-xs text-blue-600">{inv.godziny}h</span>
                  <span className="text-xs font-bold text-blue-900">{inv.koszt.toLocaleString('pl-PL')} zł</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'miesiac' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-36">Pracownik</th>
                    {dniMiesiaca().map(d=>(
                      <th key={d} className={`px-1 py-2 text-center font-medium min-w-9 ${isWeekend(d)?'bg-red-50 text-red-400':'text-gray-600'}`}>
                        <div>{d}</div><div className="text-gray-400">{DOW[dayOfWeek(d)]}</div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-medium text-gray-600 min-w-12">Σh</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-600 min-w-12">Url</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-600 min-w-12">L4</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-600 min-w-16">Koszt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading?(<tr><td colSpan={40} className="text-center py-6 text-gray-400">Ładowanie...</td></tr>):
                  filtPrac.map(p=>(
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100">
                        <div>{p.imie} {p.nazwisko}</div>
                        <div className="text-gray-400 text-xs">{p.stanowisko||''}</div>
                      </td>
                      {dniMiesiaca().map(d=>{
                        const dateStr=`${rok}-${String(miesiac).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                        const ws=getWpisyPrac(p.id,d)
                        const w=ws[0]
                        return (
                          <td key={d} className={`px-0.5 py-1 text-center cursor-pointer ${isWeekend(d)?'bg-red-50':''}`}
                            onClick={()=>w?openEdit(w):(!isWeekend(d)&&openAdd(p.id,dateStr))}>
                            {w?(<div title={RODZAJE[w.rodzaj as keyof typeof RODZAJE]?.l}
                              className={`rounded text-xs py-0.5 px-0.5 font-medium ${RODZAJE[w.rodzaj as keyof typeof RODZAJE]?.bg||'bg-gray-100'}`}>
                              {RODZAJE[w.rodzaj as keyof typeof RODZAJE]?.short||'?'}
                              {w.rodzaj==='praca'&&w.godziny!==NORM_DZIEN&&<span className="block text-xs">{w.godziny}h</span>}
                            {w.delegacja&&<span className="block text-xs text-orange-600">🚗</span>}
                            </div>):(<div className="text-gray-200 text-xs">{isWeekend(d)?'':'+'}</div>)}
                          </td>
                        )
                      })}
                      <td className="px-2 py-2 text-center font-bold text-blue-700">{sumGodziny(p.id)}</td>
                      <td className="px-2 py-2 text-center text-purple-600">{sumUrlop(p.id)||'-'}</td>
                      <td className="px-2 py-2 text-center text-red-600">{sumL4(p.id)||'-'}</td>
                      <td className="px-2 py-2 text-center text-green-700 text-xs">{sumKoszt(p.id)>0?sumKoszt(p.id).toLocaleString('pl-PL')+' zł':'-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-400 border-t border-gray-200">
              💡 Kliknij komórkę aby dodać/edytować wpis · P=Praca, U=Urlop, L4=L4, D=Delegacja, N=Nieobecność
            </div>
          </div>
        )}

        {viewMode === 'roczny' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {loadingRoczne && <p className="text-center text-xs text-gray-400 py-4">Ładowanie danych rocznych…</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 min-w-36">Pracownik</th>
                    {MIESIACE.map((m,i)=><th key={m} className={`px-2 py-3 text-center text-xs min-w-16 ${i+1===miesiac?'bg-blue-50 text-blue-700':'text-gray-500'}`}>{m.slice(0,3)}</th>)}
                    <th className="px-3 py-3 text-center text-xs text-gray-500 bg-gray-100 min-w-16">Σh</th>
                    <th className="px-3 py-3 text-center text-xs text-purple-500 bg-gray-50 min-w-12">URL</th>
                    <th className="px-3 py-3 text-center text-xs text-red-500 bg-gray-50 min-w-12">L4</th>
                    <th className="px-3 py-3 text-center text-xs text-green-600 bg-gray-50 min-w-24">Koszt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtPrac.map(p=>{
                    const sumaH = wpisyRok.filter(w=>w.pracownik_id===p.id&&w.rodzaj==='praca').reduce((a:number,w:any)=>a+(+w.godziny),0)
                    const sumaUrlop = wpisyRok.filter(w=>w.pracownik_id===p.id&&w.rodzaj==='urlop').length
                    const sumaL4 = wpisyRok.filter(w=>w.pracownik_id===p.id&&w.rodzaj==='l4').length
                    const sumaKoszt = wpisyRok.filter(w=>w.pracownik_id===p.id).reduce((a:number,w:any)=>a+(+w.koszt_calkowity||0),0)
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900 text-xs">{p.imie} {p.nazwisko}</td>
                        {MIESIACE.map((_,i)=>{
                          const m=i+1
                          const h=wpisyRok.filter(w=>w.pracownik_id===p.id&&w.rodzaj==='praca'&&new Date(w.data).getMonth()+1===m).reduce((a:number,w:any)=>a+(+w.godziny),0)
                          const u=wpisyRok.filter(w=>w.pracownik_id===p.id&&w.rodzaj==='urlop'&&new Date(w.data).getMonth()+1===m).length
                          const l=wpisyRok.filter(w=>w.pracownik_id===p.id&&w.rodzaj==='l4'&&new Date(w.data).getMonth()+1===m).length
                          return (
                            <td key={m} className={`px-1 py-2 text-center text-xs ${i+1===miesiac?'bg-blue-50':''}`}>
                              {h>0&&<div className="text-blue-600 font-medium">{h}h</div>}
                              {u>0&&<div className="text-purple-500">{u}U</div>}
                              {l>0&&<div className="text-red-500">{l}L4</div>}
                              {!h&&!u&&!l&&<span className="text-gray-200">-</span>}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-center font-bold text-blue-700 bg-gray-50">{sumaH>0?`${sumaH}h`:'-'}</td>
                        <td className="px-3 py-2 text-center text-purple-600 bg-gray-50">{sumaUrlop||'-'}</td>
                        <td className="px-3 py-2 text-center text-red-600 bg-gray-50">{sumaL4||'-'}</td>
                        <td className="px-3 py-2 text-center text-green-700 bg-gray-50">{sumaKoszt>0?sumaKoszt.toLocaleString('pl-PL')+' zł':'-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'lista_obecnosci' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Lista obecności — {MIESIACE[miesiac-1]} {rok}</h3>
              <button onClick={eksportListaObecnosci} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">🖨 Drukuj/Pobierz PDF</button>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 min-w-36">Pracownik</th>
                    {dniMiesiaca().map(d=>(
                      <th key={d} className={`px-1 py-2 text-center min-w-8 ${isWeekend(d)?'bg-red-100 text-red-500':'text-gray-600'}`}>
                        {d}<div>{DOW[dayOfWeek(d)]}</div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center">Σh</th>
                    <th className="px-2 py-2 text-center">URL</th>
                    <th className="px-2 py-2 text-center">L4</th>
                    <th className="px-2 py-2 text-center min-w-24">Podpis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtPrac.map(p=>(
                    <tr key={p.id} className="border-b border-gray-200">
                      <td className="px-3 py-3 font-medium sticky left-0 bg-white border-r border-gray-100">{p.imie} {p.nazwisko}</td>
                      {dniMiesiaca().map(d=>{
                        const ws=getWpisyPrac(p.id,d); const w=ws[0]
                        return (
                          <td key={d} className={`px-0.5 py-2 text-center border-r border-gray-100 ${isWeekend(d)?'bg-red-50':''}`}>
                            {w?<span className={`text-xs font-bold ${RODZAJE[w.rodzaj as keyof typeof RODZAJE]?.bg||''} px-1 rounded`}>{RODZAJE[w.rodzaj as keyof typeof RODZAJE]?.short||'?'}</span>:''}
                          </td>
                        )
                      })}
                      <td className="px-2 py-2 text-center font-bold text-blue-700">{sumGodziny(p.id)}</td>
                      <td className="px-2 py-2 text-center text-purple-600">{sumUrlop(p.id)}</td>
                      <td className="px-2 py-2 text-center text-red-600">{sumL4(p.id)}</td>
                      <td className="px-2 py-2"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-100 text-xs text-gray-400">
              P=Praca · U=Urlop · L4=Zwolnienie lekarskie · Sz=Szkolenie · D=Delegacja · N=Nieobecność · NG=Nadgodziny
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex justify-between">
              <h3 className="font-semibold text-gray-900">{editWpis?'Edytuj wpis':'Dodaj wpis'}</h3>
              <button onClick={()=>setShowModal(false)}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Pracownik *</label>
                <select value={fPrac} onChange={e=>setFPrac(e.target.value)} className={inp}>
                  <option value="">— wybierz —</option>
                  {pracownicy.map(p=><option key={p.id} value={p.id}>{p.imie} {p.nazwisko}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data *</label>
                  <input type="date" value={fData} onChange={e=>setFData(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Rodzaj</label>
                  <select value={fRodzaj} onChange={e=>setFRodzaj(e.target.value)} className={inp}>
                    {Object.entries(RODZAJE).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
                  </select>
                </div>
              </div>
              {fRodzaj==='praca'&&(
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-xs text-gray-500 block mb-1">Od</label><input type="time" value={fOd} onChange={e=>setFOd(e.target.value)} className={inp}/></div>
                  <div><label className="text-xs text-gray-500 block mb-1">Do</label><input type="time" value={fDo} onChange={e=>setFDo(e.target.value)} className={inp}/></div>
                  <div><label className="text-xs text-gray-500 block mb-1">Godziny</label><input type="number" value={fGodziny} onChange={e=>setFGodziny(e.target.value)} min="0" step="0.5" className={inp}/></div>
                </div>
              )}
              {fRodzaj === 'praca' && (
                <div className="border border-orange-200 bg-orange-50 rounded-xl p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <input type="checkbox" id="delegacja" checked={fDelegacja} onChange={e=>setFDelegacja(e.target.checked)} className="rounded" />
                    <label htmlFor="delegacja" className="text-sm font-medium text-orange-800 cursor-pointer">
                      🚗 Wyjazd cateringowy (+{fDelegacjaStawka} zł do kosztu dnia)
                    </label>
                  </div>
                  {fDelegacja && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Dodatek za wyjazd (zł/dzień)</label>
                      <input type="number" value={fDelegacjaStawka} onChange={e=>setFDelegacjaStawka(e.target.value)}
                        min="0" step="1" className={inp} />
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Wydarzenie / impreza (opcjonalnie)</label>
                <select value={fInw} onChange={e=>setFInw(e.target.value)} className={inp}>
                  <option value="">— brak —</option>
                  {wydarzenia.map(i=><option key={i.id} value={i.id}>{i.nazwa}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Opis / notatka</label>
                <input value={fOpis} onChange={e=>setFOpis(e.target.value)} placeholder="np. obsługa wesela, catering zewnętrzny..." className={inp}/>
              </div>
            </div>
            {saveError && (
              <div className="mx-4 mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                ✗ {saveError}
              </div>
            )}
            <div className="p-4 border-t border-gray-100 flex gap-2 justify-between">
              {editWpis&&<button onClick={()=>del(editWpis.id)} className="text-xs text-red-500 hover:text-red-700">Usuń</button>}
              <div className="flex gap-2 ml-auto">
                <button onClick={()=>{ setShowModal(false); setSaveError('') }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Anuluj</button>
                <button onClick={save} disabled={!fPrac||!fData} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">Zapisz</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
