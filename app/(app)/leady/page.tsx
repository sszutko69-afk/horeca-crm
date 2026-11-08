'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'

// ================================================================
// TYPY
// ================================================================
type Produkt = { id:string; nazwa:string; kategoria:'inwestycja'|'dostawa'|'inne' }
type Lead = {
  id:string; numer:string; tytul:string
  klient_id:string|null; klient_nazwa:string|null; klient_kontakt:string|null
  klient_email:string|null; klient_telefon:string|null; klient_adres:string|null; klient_nip:string|null
  produkt_id:string|null; produkt?:Produkt
  etap:string; etapy_custom:string[]|null
  status:'aktywny'|'wygrany'|'przegrany'|'wstrzymany'
  wartosc_szacunkowa:number|null; prawdopodobienstwo:number; waluta:string
  cena_jednostkowa:number|null; ilosc:number|null; jednostka:string|null
  klient_lat:number|null; klient_lng:number|null
  data_pierwszego_kontaktu:string|null; data_planowanego_zamkniecia:string|null
  przypisany_do:string|null; notatki:string|null
  inwestycja_id:string|null; zamowienie_id:string|null
  created_at:string
}
type Historia = {
  id:string; lead_id:string; etap:string; notatki:string|null
  wynik:'pozytywny'|'neutralny'|'negatywny'|null; data_kontaktu:string; uzytkownik:string|null
}
type Dokument = { id:string; lead_id:string; nazwa:string; url:string; typ:string|null; rozmiar:number|null }

// ================================================================
// STAŁE
// ================================================================
const ETAPY_DOMYSLNE = [
  'Pierwszy kontakt',
  'Przygotowanie oferty',
  'Omówienie oferty',
  'Negocjacje',
  'Podpisanie umowy',
  'Realizacja',
]

// Uproszczone etapy dla dostaw gazu
const ETAPY_DOSTAWA = [
  'Kontakt',
  'Oferta',
  'Zamówienie',
  'Dostawa',
]

// Zwraca efektywną listę etapów dla danego leadu
function leadEtapy(lead:{etapy_custom?:string[]|null; produkt?:Produkt|null}):string[] {
  if(lead.etapy_custom&&lead.etapy_custom.length) return lead.etapy_custom
  if(lead.produkt?.kategoria==='dostawa') return ETAPY_DOSTAWA
  return ETAPY_DOMYSLNE
}
function isDostawa(lead:{produkt?:Produkt|null}):boolean { return lead.produkt?.kategoria==='dostawa' }
function isLastStage(lead:{etap:string; etapy_custom?:string[]|null; produkt?:Produkt|null}):boolean {
  const e=leadEtapy(lead); return lead.etap===e[e.length-1]
}

const ETAP_KOLOR: Record<string,string> = {
  'Pierwszy kontakt':     'bg-blue-100 text-blue-700 border-blue-200',
  'Przygotowanie oferty': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Omówienie oferty':     'bg-violet-100 text-violet-700 border-violet-200',
  'Negocjacje':           'bg-amber-100 text-amber-700 border-amber-200',
  'Podpisanie umowy':     'bg-orange-100 text-orange-700 border-orange-200',
  'Realizacja':           'bg-green-100 text-green-700 border-green-200',
  // Dostawa
  'Kontakt':              'bg-blue-100 text-blue-700 border-blue-200',
  'Oferta':               'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Zamówienie':           'bg-amber-100 text-amber-700 border-amber-200',
  'Dostawa':              'bg-green-100 text-green-700 border-green-200',
}

// ────────────────────────────────────────────────────────────────
// PASEK POSTĘPU — styl chevron (jak Salesforce Path)
// ────────────────────────────────────────────────────────────────
function ChevronPipeline({ etapy, current, onSelect, onComplete, completed }:{
  etapy:string[]; current:string; onSelect:(e:string)=>void; onComplete:()=>void; completed:boolean
}) {
  const curIdx = etapy.indexOf(current)
  const ARROW = 16
  return (
    <div style={{display:'flex',alignItems:'stretch',gap:3,width:'100%'}}>
      <div style={{display:'flex',alignItems:'stretch',gap:3,flex:1}}>
        {etapy.map((etap,i)=>{
          const done   = i < curIdx || (completed && i<=curIdx)
          const active = i === curIdx && !completed
          const bg     = active ? '#0B5CAB' : done ? '#2E7CC4' : '#E9EEF3'
          const color  = (active||done) ? '#FFFFFF' : '#5B6B7B'
          const isFirst= i===0
          const isLast = i===etapy.length-1
          const clip   = isFirst
            ? `polygon(0 0, calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%, 0 100%)`
            : isLast
            ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${ARROW}px 50%)`
            : `polygon(0 0, calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%, 0 100%, ${ARROW}px 50%)`
          return (
            <button key={etap} onClick={()=>onSelect(etap)} title={etap}
              style={{
                flex:1, minWidth:0, height:34, border:'none', cursor:'pointer',
                background:bg, color, clipPath:clip, WebkitClipPath:clip,
                fontSize:11, fontWeight:active?700:600,
                paddingLeft:isFirst?10:ARROW+6, paddingRight:isLast?10:ARROW+2,
                display:'flex',alignItems:'center',justifyContent:'center',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                transition:'background .15s',
              }}>
              <span style={{overflow:'hidden',textOverflow:'ellipsis'}}>
                {done&&'✓ '}{etap}
              </span>
            </button>
          )
        })}
      </div>
      <button onClick={onComplete}
        style={{
          flexShrink:0, height:34, padding:'0 14px', borderRadius:6, cursor:'pointer',
          background: completed ? '#188038' : '#0B3D6E', color:'white', border:'none',
          fontSize:11, fontWeight:600, display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap',
        }}>
        {completed ? '✓ Zakończony' : '✓ Oznacz jako zakończony'}
      </button>
    </div>
  )
}

const STATUS_BADGE: Record<string,string> = {
  aktywny:    'bg-blue-50 text-blue-700',
  wygrany:    'bg-green-50 text-green-700',
  przegrany:  'bg-red-50 text-red-600',
  wstrzymany: 'bg-gray-100 text-gray-600',
}
const STATUS_LABEL: Record<string,string> = {
  aktywny:'Aktywny', wygrany:'Wygrany', przegrany:'Przegrany', wstrzymany:'Wstrzymany'
}

const KAT_BADGE: Record<string,string> = {
  inwestycja: 'bg-purple-50 text-purple-700',
  dostawa:    'bg-cyan-50 text-cyan-700',
  inne:       'bg-gray-100 text-gray-600',
}
const KAT_LABEL: Record<string,string> = {
  inwestycja:'Inwestycja', dostawa:'Dostawa', inne:'Inne'
}
const WYNIK_BADGE: Record<string,string> = {
  pozytywny: 'bg-green-100 text-green-700',
  neutralny: 'bg-gray-100 text-gray-600',
  negatywny: 'bg-red-100 text-red-600',
}

const inp = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white'
const lbl = 'text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block'

function fmt(n:number|null) { if(!n) return '—'; return n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}) }
function fmtDate(d:string|null) { return d ? new Date(d).toLocaleDateString('pl-PL') : '—' }

// ================================================================
// KOMPONENT GŁÓWNY
// ================================================================
export default function LeadyPage() {
  const supabase = createClient()

  const [leady,    setLeady]    = useState<Lead[]>([])
  const [produkty, setProdukty] = useState<Produkt[]>([])
  const [historia, setHistoria] = useState<Historia[]>([])
  const [dokumenty,setDokumenty]= useState<Dokument[]>([])
  const [klienci,  setKlienci]  = useState<any[]>([])
  const [pracownicy, setPracownicy] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  const [viewMode, setViewMode] = useState<'lista'|'kanban'>('lista')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterKat,    setFilterKat]    = useState('')
  const [filterEtap,   setFilterEtap]   = useState('')
  const [search,       setSearch]       = useState('')

  // Otwarty lead
  const [openLead, setOpenLead] = useState<Lead|null>(null)
  const [drawerTab, setDrawerTab] = useState<'info'|'historia'|'dokumenty'>('info')

  // Formularz nowego leadu
  const [showForm, setShowForm] = useState(false)
  const [editLead, setEditLead] = useState<Lead|null>(null)

  // Wpis historii
  const [newHist, setNewHist] = useState({etap:'',notatki:'',wynik:'neutralny' as 'pozytywny'|'neutralny'|'negatywny'})
  const [savingHist, setSavingHist] = useState(false)

  // Edycja etapów własnych
  const [editEtapy, setEditEtapy] = useState(false)
  const [etapyTemp, setEtapyTemp] = useState<string[]>([])

  // Upload dokumentów
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [success, setSuccess] = useState('')
  const [error,   setError]   = useState('')

  useEffect(()=>{ loadAll() },[])

  async function loadAll(){
    setLoading(true)
    const [{data:l},{data:pr},{data:kl},{data:pc}] = await Promise.all([
      supabase.from('crm_leady').select('*,produkt:crm_produkty(id,nazwa,kategoria)').eq('usuniete',false).order('created_at',{ascending:false}),
      supabase.from('crm_produkty').select('*').eq('aktywny',true).order('kolejnosc'),
      supabase.from('klienci').select('id,nazwa,telefon,email,adres,nip,miasto,kod_pocztowy,lat,lng').order('nazwa').limit(300),
      supabase.from('pracownicy').select('id,imie,nazwisko,stanowisko').eq('aktywny',true).order('nazwisko'),
    ])
    setLeady(l??[])
    setProdukty(pr??[])
    setKlienci(kl??[])
    setPracownicy(pc??[])
    setLoading(false)
  }

  async function loadLeadDetails(id:string){
    const [{data:h},{data:d}] = await Promise.all([
      supabase.from('crm_lead_historia').select('*').eq('lead_id',id).order('data_kontaktu',{ascending:false}),
      supabase.from('crm_lead_dokumenty').select('*').eq('lead_id',id).order('created_at',{ascending:false}),
    ])
    setHistoria(h??[])
    setDokumenty(d??[])
  }

  function showMsg(msg:string){ setSuccess(msg); setTimeout(()=>setSuccess(''),3000) }

  // ── CRUD ──────────────────────────────────────────────────
  async function handleSaveLead(data:any){
    setSaving(true); setError('')

    // Jeśli klient nie pochodzi z bazy a podano nazwę → utwórz go w module Klienci
    if(!data.klient_id && data.klient_nazwa?.trim()){
      const {data:nowyKlient} = await supabase.from('klienci').insert({
        nazwa:        data.klient_nazwa.trim(),
        typ:          data.klient_nip ? 'firma' : 'osoba_fizyczna',
        nip:          data.klient_nip || null,
        adres:        data.klient_adres || null,
        miasto:       data._klient_miasto || null,
        kod_pocztowy: data._klient_kod || null,
        telefon:      data.klient_telefon || null,
        email:        data.klient_email || null,
        aktywny:      true,
      }).select('id').single()
      if(nowyKlient) data.klient_id = nowyKlient.id
    }
    // Usuń pomocnicze pola spoza schematu crm_leady
    delete data._klient_miasto; delete data._klient_kod

    if(editLead){
      const {error:e} = await supabase.from('crm_leady').update({...data,updated_at:new Date().toISOString()}).eq('id',editLead.id)
      if(e){setError(e.message); setSaving(false); return}
      showMsg('Lead zaktualizowany!')
    } else {
      const {error:e} = await supabase.from('crm_leady').insert(data)
      if(e){setError(e.message); setSaving(false); return}
      showMsg(data.klient_id ? 'Lead dodany! Klient zapisany w bazie Klienci.' : 'Lead dodany!')
    }
    setShowForm(false); setEditLead(null); loadAll(); setSaving(false)
  }

  async function advanceEtap(lead:Lead, nowyEtap:string){
    const etapy = leadEtapy(lead)
    await supabase.from('crm_leady').update({etap:nowyEtap, updated_at:new Date().toISOString()}).eq('id',lead.id)
    await supabase.from('crm_lead_historia').insert({lead_id:lead.id, etap:nowyEtap, notatki:`Zmiana etapu na: ${nowyEtap}`, wynik:'neutralny'})
    setLeady(prev=>prev.map(l=>l.id===lead.id?{...l,etap:nowyEtap}:l))
    if(openLead?.id===lead.id){ setOpenLead(l=>l?{...l,etap:nowyEtap}:l); loadLeadDetails(lead.id) }
    showMsg(`Etap zmieniony na: ${nowyEtap}`)
  }

  async function changeStatus(lead:Lead, status:Lead['status']){
    await supabase.from('crm_leady').update({status,updated_at:new Date().toISOString()}).eq('id',lead.id)
    setLeady(prev=>prev.map(l=>l.id===lead.id?{...l,status}:l))
    if(openLead?.id===lead.id) setOpenLead(l=>l?{...l,status}:l)
  }

  async function saveHistoria(){
    if(!openLead||!newHist.etap) return
    setSavingHist(true)
    await supabase.from('crm_lead_historia').insert({lead_id:openLead.id,...newHist})
    setNewHist({etap:openLead.etap,notatki:'',wynik:'neutralny'})
    await loadLeadDetails(openLead.id)
    setSavingHist(false)
  }

  async function saveEtapyCustom(lead:Lead){
    await supabase.from('crm_leady').update({etapy_custom:etapyTemp.filter(e=>e.trim()),updated_at:new Date().toISOString()}).eq('id',lead.id)
    setLeady(prev=>prev.map(l=>l.id===lead.id?{...l,etapy_custom:etapyTemp}:l))
    if(openLead?.id===lead.id) setOpenLead(l=>l?{...l,etapy_custom:etapyTemp}:l)
    setEditEtapy(false)
    showMsg('Etapy zaktualizowane!')
  }

  async function deleteLead(id:string){
    if(!confirm('Usunąć lead?')) return
    await supabase.from('crm_leady').update({usuniete:true}).eq('id',id)
    setLeady(prev=>prev.filter(l=>l.id!==id))
    if(openLead?.id===id) setOpenLead(null)
  }

  // ── Dokumenty ────────────────────────────────────────────
  async function uploadDocs(files:File[]){
    if(!openLead||!files.length) return
    setUploading(true)
    for(const file of files){
      const path = `leady/${openLead.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
      const {data:up,error:ue} = await supabase.storage.from('dokumenty').upload(path,file,{upsert:true})
      if(ue){setError(ue.message);continue}
      const {data:{publicUrl}} = supabase.storage.from('dokumenty').getPublicUrl(path)
      await supabase.from('crm_lead_dokumenty').insert({lead_id:openLead.id,nazwa:file.name,url:publicUrl,typ:file.type,rozmiar:file.size})
    }
    await loadLeadDetails(openLead.id)
    setUploading(false)
    showMsg('Dokumenty przesłane!')
  }

  async function removeDoc(docId:string, url:string){
    await supabase.from('crm_lead_dokumenty').delete().eq('id',docId)
    setDokumenty(prev=>prev.filter(d=>d.id!==docId))
  }

  // ── Konwersja do Inwestycja / Zamówienie ──────────────────
  async function konwertujDoInwestycji(lead:Lead){
    if(!confirm('Przekazać lead do modułu Inwestycje? Zostanie utworzona nowa inwestycja.')) return
    const {data:inv} = await supabase.from('inwestycje').insert({
      nazwa: lead.tytul,
      typ: 'inne',
      opis: `Lead: ${lead.numer} — ${lead.klient_nazwa??''}`,
      status:'planowana',
    }).select().single()
    if(inv){
      await supabase.from('crm_leady').update({inwestycja_id:inv.id, status:'wygrany', updated_at:new Date().toISOString()}).eq('id',lead.id)
      setLeady(prev=>prev.map(l=>l.id===lead.id?{...l,inwestycja_id:inv.id,status:'wygrany'}:l))
      if(openLead?.id===lead.id) setOpenLead(l=>l?{...l,inwestycja_id:inv.id,status:'wygrany'}:l)
      showMsg('Inwestycja utworzona! Przejdź do modułu Inwestycje.')
    }
  }

  async function konwertujDoZamowienia(lead:Lead){
    if(!confirm('Przekazać lead do modułu Zamówienia? Zostanie utworzone nowe zamówienie.')) return
    const cenaBrutto = lead.cena_jednostkowa ?? null
    const {data:zam} = await supabase.from('zamowienia').insert({
      zrodlo:'lead', lead_id:lead.id, klient_id: lead.klient_id,
      klient_nazwa: lead.klient_nazwa??'',
      klient_adres: lead.klient_adres,
      klient_telefon: lead.klient_telefon,
      klient_email: lead.klient_email,
      klient_nip: lead.klient_nip,
      klient_lat: lead.klient_lat, klient_lng: lead.klient_lng,
      produkt: lead.produkt?.nazwa??'',
      ilosc: lead.ilosc ?? 1,
      jednostka: lead.jednostka ?? 'l',
      cena_brutto: cenaBrutto,
      cena_netto: cenaBrutto ? Math.round((cenaBrutto/1.23)*100)/100 : null,
      status:'nowe',
    }).select().single()
    if(zam){
      await supabase.from('crm_leady').update({zamowienie_id:zam.id, status:'wygrany', updated_at:new Date().toISOString()}).eq('id',lead.id)
      setLeady(prev=>prev.map(l=>l.id===lead.id?{...l,zamowienie_id:zam.id,status:'wygrany'}:l))
      if(openLead?.id===lead.id) setOpenLead(l=>l?{...l,zamowienie_id:zam.id,status:'wygrany'}:l)
      showMsg('Zamówienie utworzone! Przejdź do modułu Zamówienia.')
    }
  }

  // ── Filtry ────────────────────────────────────────────────
  const filtered = useMemo(()=>leady.filter(l=>{
    if(filterStatus && l.status!==filterStatus) return false
    if(filterKat && l.produkt?.kategoria!==filterKat) return false
    if(filterEtap && l.etap!==filterEtap) return false
    if(search){
      const q=search.toLowerCase()
      if(!l.tytul.toLowerCase().includes(q)&&!(l.klient_nazwa??'').toLowerCase().includes(q)) return false
    }
    return true
  }),[leady,filterStatus,filterKat,filterEtap,search])

  const stats = useMemo(()=>({
    aktywne:  leady.filter(l=>l.status==='aktywny').length,
    wygrane:  leady.filter(l=>l.status==='wygrany').length,
    przegrane:leady.filter(l=>l.status==='przegrany').length,
    wartosc:  leady.filter(l=>l.status==='aktywny').reduce((a,l)=>a+(l.wartosc_szacunkowa??0),0),
  }),[leady])

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Leady CRM</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pipeline sprzedaży · Klienci potencjalni · Konwersja do inwestycji i zamówień</p>
        </div>
        <button onClick={()=>{setEditLead(null);setShowForm(true)}}
          className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700">
          + Nowy lead
        </button>
      </div>

      {success&&<div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-4">✓ {success}</div>}
      {error  &&<div className="text-xs text-red-600  bg-red-50  border border-red-200  px-3 py-2 rounded-lg mb-4">✗ {error}</div>}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          {l:'Aktywne leady',  v:stats.aktywne,                    c:'text-blue-700'},
          {l:'Wygrane',        v:stats.wygrane,                    c:'text-green-700'},
          {l:'Przegrane',      v:stats.przegrane,                  c:'text-red-600'},
          {l:'Wartość pipeline',v:fmt(stats.wartosc)+' zł',        c:'text-purple-700'},
        ].map(k=>(
          <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.l}</p>
            <p className={`text-lg font-semibold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Zakładki widoku + filtry */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([['lista','📋 Lista'],['kanban','🗂 Kanban']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setViewMode(k)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${viewMode===k?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Szukaj..." className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Wszystkie statusy</option>
          {Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterKat} onChange={e=>setFilterKat(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Wszystkie kategorie</option>
          {Object.entries(KAT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterEtap} onChange={e=>setFilterEtap(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Wszystkie etapy</option>
          <optgroup label="🏗 Inwestycje / inne">{ETAPY_DOMYSLNE.map(e=><option key={e} value={e}>{e}</option>)}</optgroup>
          <optgroup label="🚛 Dostawy gazu">{ETAPY_DOSTAWA.map(e=><option key={e} value={e}>{e}</option>)}</optgroup>
        </select>
        {(search||filterStatus||filterKat||filterEtap)&&(
          <button onClick={()=>{setSearch('');setFilterStatus('');setFilterKat('');setFilterEtap('')}}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">✕</button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} leadów</span>
      </div>

      {/* ════ LISTA ════ */}
      {viewMode==='lista' && (
        loading ? <p className="text-center text-gray-400 py-12">Ładowanie...</p>
        : filtered.length===0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-gray-500">Brak leadów. Dodaj pierwszego potencjalnego klienta.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(lead=>{
              const etapy = leadEtapy(lead)
              const etapIdx = etapy.indexOf(lead.etap)
              const kat = lead.produkt?.kategoria
              return (
                <div key={lead.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                  onClick={()=>{ setOpenLead(lead); setDrawerTab('info'); loadLeadDetails(lead.id) }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs text-gray-400">{lead.numer}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[lead.status]}`}>{STATUS_LABEL[lead.status]}</span>
                        {kat&&<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${KAT_BADGE[kat]}`}>{KAT_LABEL[kat]}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ETAP_KOLOR[lead.etap]??'bg-gray-100 text-gray-600 border-gray-200'}`}>{lead.etap}</span>
                        {lead.inwestycja_id&&<span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">→ Inwestycja</span>}
                        {lead.zamowienie_id&&<span className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full">→ Zamówienie</span>}
                      </div>
                      <p className="font-semibold text-gray-900 text-sm mb-0.5">{lead.tytul}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        {lead.klient_nazwa&&<span>👤 {lead.klient_nazwa}</span>}
                        {lead.klient_telefon&&<span>📞 {lead.klient_telefon}</span>}
                        {lead.produkt?.nazwa&&<span>📦 {lead.produkt.nazwa}</span>}
                        {lead.przypisany_do&&<span>🧑 {lead.przypisany_do}</span>}
                      </div>
                      {/* Mini pipeline */}
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {etapy.map((e,i)=>(
                          <div key={e} className={`h-1.5 flex-1 rounded-full min-w-4 ${i<=etapIdx?'bg-blue-500':'bg-gray-100'}`}/>
                        ))}
                        <span className="text-xs text-gray-400 ml-1">{etapIdx+1}/{etapy.length}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {lead.wartosc_szacunkowa&&<span className="text-sm font-bold text-gray-900">{fmt(lead.wartosc_szacunkowa)} zł</span>}
                      {lead.data_planowanego_zamkniecia&&<span className="text-xs text-gray-400">do {fmtDate(lead.data_planowanego_zamkniecia)}</span>}
                      <button onClick={e=>{e.stopPropagation();deleteLead(lead.id)}}
                        className="text-gray-200 hover:text-red-500 text-sm">🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ════ KANBAN ════ */}
      {viewMode==='kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {(() => {
              // Kolumny = unia etapów występujących + domyślne, zachowując kolejność
              const wszystkie = [...ETAPY_DOMYSLNE, ...ETAPY_DOSTAWA]
              const obecne = Array.from(new Set(filtered.map(l=>l.etap)))
              const kolumny = wszystkie.filter(e=>obecne.includes(e))
              // Dodaj nietypowe etapy (custom) na koniec
              obecne.forEach(e=>{ if(!kolumny.includes(e)) kolumny.push(e) })
              return (kolumny.length?kolumny:ETAPY_DOMYSLNE)
            })().map(etap=>{
              const etapLeady = filtered.filter(l=>l.etap===etap)
              const wartoscEtap = etapLeady.reduce((a,l)=>a+(l.wartosc_szacunkowa??0),0)
              return (
                <div key={etap} className="w-72 flex-shrink-0">
                  <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border border-b-0 ${ETAP_KOLOR[etap]??'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    <div>
                      <p className="text-xs font-bold">{etap}</p>
                      {wartoscEtap>0&&<p className="text-xs opacity-70">{fmt(wartoscEtap)} zł</p>}
                    </div>
                    <span className="text-xs font-medium bg-white/50 px-1.5 py-0.5 rounded">{etapLeady.length}</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 border-t-0 rounded-b-xl p-2 min-h-48 space-y-2">
                    {etapLeady.map(lead=>(
                      <div key={lead.id}
                        className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={()=>{ setOpenLead(lead); setDrawerTab('info'); loadLeadDetails(lead.id) }}>
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs text-gray-400">{lead.numer}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[lead.status]}`}>{STATUS_LABEL[lead.status]}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 leading-snug mb-1">{lead.tytul}</p>
                        {lead.klient_nazwa&&<p className="text-xs text-gray-500">👤 {lead.klient_nazwa}</p>}
                        {lead.wartosc_szacunkowa&&<p className="text-xs font-semibold text-gray-700 mt-1">{fmt(lead.wartosc_szacunkowa)} zł</p>}
                        {lead.produkt&&<span className={`text-xs px-1.5 py-0.5 rounded-full ${KAT_BADGE[lead.produkt.kategoria]}`}>{lead.produkt.nazwa}</span>}
                      </div>
                    ))}
                    {etapLeady.length===0&&<p className="text-xs text-gray-300 text-center py-4">Brak leadów</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════ DRAWER: Szczegóły leadu ════ */}
      {openLead&&(
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black bg-opacity-30" onClick={()=>setOpenLead(null)}/>
          <div className="w-full max-w-xl bg-white border-l border-gray-200 flex flex-col" style={{overflowY:'auto'}}>

            {/* Header */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs text-gray-400">{openLead.numer}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[openLead.status]}`}>{STATUS_LABEL[openLead.status]}</span>
                    {openLead.produkt?.kategoria&&<span className={`text-xs px-2 py-0.5 rounded-full ${KAT_BADGE[openLead.produkt.kategoria]}`}>{KAT_LABEL[openLead.produkt.kategoria]}</span>}
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">{openLead.tytul}</h2>
                  {openLead.klient_nazwa&&<p className="text-sm text-gray-500">👤 {openLead.klient_nazwa}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>{setEditLead(openLead);setShowForm(true);setOpenLead(null)}}
                    className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Edytuj</button>
                  <button onClick={()=>setOpenLead(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
                </div>
              </div>

              {/* Pipeline etapów */}
              <div className="mt-4">
                {editEtapy ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 mb-2">Edytuj etapy (jeden na linię):</p>
                    {etapyTemp.map((e,i)=>(
                      <div key={i} className="flex gap-2">
                        <input value={e} onChange={ev=>setEtapyTemp(prev=>{const n=[...prev];n[i]=ev.target.value;return n})}
                          className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"/>
                        <button onClick={()=>setEtapyTemp(prev=>prev.filter((_,j)=>j!==i))}
                          className="text-red-400 hover:text-red-600 px-2">✕</button>
                      </div>
                    ))}
                    <button onClick={()=>setEtapyTemp(prev=>[...prev,''])}
                      className="text-xs text-blue-600 hover:underline">+ Dodaj etap</button>
                    <div className="flex gap-2 mt-2">
                      <button onClick={()=>saveEtapyCustom(openLead)}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg">Zapisz</button>
                      <button onClick={()=>{setEditEtapy(false);setEtapyTemp([])}}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg">Anuluj</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <ChevronPipeline
                      etapy={leadEtapy(openLead)}
                      current={openLead.etap}
                      completed={openLead.status==='wygrany'}
                      onSelect={(e)=>advanceEtap(openLead,e)}
                      onComplete={()=>{
                        const e=leadEtapy(openLead); const last=e[e.length-1]
                        if(openLead.etap!==last) advanceEtap(openLead,last)
                        changeStatus(openLead,'wygrany')
                      }}
                    />
                    <div className="flex justify-end mt-1.5">
                      <button onClick={()=>{setEditEtapy(true);setEtapyTemp(leadEtapy(openLead))}}
                        className="text-xs text-gray-400 hover:text-blue-600" title="Edytuj etapy">✏️ Edytuj etapy</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Zmiana statusu */}
              <div className="flex gap-2 mt-3">
                {(['aktywny','wygrany','przegrany','wstrzymany'] as const).map(s=>(
                  <button key={s} onClick={()=>changeStatus(openLead,s)}
                    className={`text-xs px-2 py-1 rounded-full border font-medium transition-all ${openLead.status===s?STATUS_BADGE[s]+' ring-2 ring-offset-1 ring-gray-300':STATUS_BADGE[s]+' opacity-50 hover:opacity-100'}`}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>

              {/* Konwersja do modułu */}
              {isLastStage(openLead)&&!openLead.inwestycja_id&&!openLead.zamowienie_id&&(
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-xs font-semibold text-green-800 mb-2">🎯 Lead w fazie końcowej — przenieś do modułu:</p>
                  <div className="flex gap-2">
                    {openLead.produkt?.kategoria==='inwestycja'&&(
                      <button onClick={()=>konwertujDoInwestycji(openLead)}
                        className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                        🏗 → Inwestycja
                      </button>
                    )}
                    {openLead.produkt?.kategoria==='dostawa'&&(
                      <button onClick={()=>konwertujDoZamowienia(openLead)}
                        className="text-xs px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">
                        📦 → Zamówienie
                      </button>
                    )}
                    {openLead.produkt?.kategoria==='inne'&&(
                      <>
                        <button onClick={()=>konwertujDoInwestycji(openLead)}
                          className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                          🏗 → Inwestycja
                        </button>
                        <button onClick={()=>konwertujDoZamowienia(openLead)}
                          className="text-xs px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">
                          📦 → Zamówienie
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
              {openLead.inwestycja_id&&(
                <div className="mt-2 text-xs text-purple-700 bg-purple-50 px-3 py-2 rounded-lg">
                  ✓ Przekazano do modułu <a href="/inwestycje" className="underline font-medium">Inwestycje</a>
                </div>
              )}
              {openLead.zamowienie_id&&(
                <div className="mt-2 text-xs text-cyan-700 bg-cyan-50 px-3 py-2 rounded-lg">
                  ✓ Przekazano do modułu <a href="/zamowienia" className="underline font-medium">Zamówienia</a>
                </div>
              )}
            </div>

            {/* Zakładki */}
            <div className="flex gap-0 border-b border-gray-100 px-5">
              {([['info','📋 Informacje'],['historia','📅 Historia'],['dokumenty','📎 Dokumenty']] as const).map(([k,l])=>(
                <button key={k} onClick={()=>setDrawerTab(k)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${drawerTab===k?'border-gray-900 text-gray-900':'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Zawartość zakładek */}
            <div className="flex-1 p-5 space-y-4">

              {drawerTab==='info'&&(
                <>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Klient</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        ['Nazwa',   openLead.klient_nazwa],
                        ['Kontakt', openLead.klient_kontakt],
                        ['Email',   openLead.klient_email],
                        ['Telefon', openLead.klient_telefon],
                        ['Adres',   openLead.klient_adres],
                        ['NIP',     openLead.klient_nip],
                      ].map(([l,v])=>v&&(
                        <div key={l as string}>
                          <p className="text-xs text-gray-400">{l}</p>
                          <p className="text-gray-800 font-medium">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Produkt i wartość</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        ['Produkt',         openLead.produkt?.nazwa],
                        ['Kategoria',       openLead.produkt?.kategoria ? KAT_LABEL[openLead.produkt.kategoria] : null],
                        ...(isDostawa(openLead) ? [
                          ['Cena jedn. brutto', openLead.cena_jednostkowa ? fmt(openLead.cena_jednostkowa)+' zł' : null],
                          ['Ilość',             openLead.ilosc ? `${openLead.ilosc} ${openLead.jednostka??'l'}` : null],
                          ['Wartość brutto',    openLead.wartosc_szacunkowa ? fmt(openLead.wartosc_szacunkowa)+' zł' : null],
                        ] : [
                          ['Wartość szac.',   openLead.wartosc_szacunkowa ? fmt(openLead.wartosc_szacunkowa)+' '+openLead.waluta : null],
                          ['Prawdopodobieństwo', openLead.prawdopodobienstwo+'%'],
                        ]),
                        ['Przypisany do',   openLead.przypisany_do],
                        ['Termin zamknięcia', fmtDate(openLead.data_planowanego_zamkniecia)],
                      ].map(([l,v])=>v&&(
                        <div key={l as string}>
                          <p className="text-xs text-gray-400">{l}</p>
                          <p className="text-gray-800 font-medium">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {openLead.notatki&&(
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notatki</h3>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{openLead.notatki}</p>
                    </div>
                  )}
                </>
              )}

              {drawerTab==='historia'&&(
                <>
                  {/* Dodaj wpis */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dodaj wpis</h3>
                    <div>
                      <label className={lbl}>Etap</label>
                      <select value={newHist.etap||openLead.etap} onChange={e=>setNewHist(n=>({...n,etap:e.target.value}))} className={inp}>
                        {(openLead.etapy_custom??ETAPY_DOMYSLNE).map(e=><option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Notatki z rozmowy</label>
                      <textarea value={newHist.notatki} onChange={e=>setNewHist(n=>({...n,notatki:e.target.value}))}
                        rows={3} placeholder="Co ustalono? Jaka decyzja klienta?"
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none bg-white"/>
                    </div>
                    <div>
                      <label className={lbl}>Wynik kontaktu</label>
                      <select value={newHist.wynik} onChange={e=>setNewHist(n=>({...n,wynik:e.target.value as any}))} className={inp}>
                        <option value="pozytywny">✅ Pozytywny</option>
                        <option value="neutralny">➖ Neutralny</option>
                        <option value="negatywny">❌ Negatywny</option>
                      </select>
                    </div>
                    <button onClick={saveHistoria} disabled={savingHist||!newHist.notatki}
                      className="w-full px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50">
                      {savingHist?'Zapisuję...':'Zapisz wpis'}
                    </button>
                  </div>

                  {/* Lista wpisów */}
                  <div className="space-y-3">
                    {historia.length===0&&<p className="text-xs text-gray-400 text-center py-4">Brak historii rozmów.</p>}
                    {historia.map(h=>(
                      <div key={h.id} className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ETAP_KOLOR[h.etap]??'bg-gray-100 text-gray-600 border-gray-200'}`}>{h.etap}</span>
                            {h.wynik&&<span className={`text-xs px-1.5 py-0.5 rounded-full ${WYNIK_BADGE[h.wynik]}`}>{h.wynik==='pozytywny'?'✅':h.wynik==='negatywny'?'❌':'➖'} {h.wynik}</span>}
                          </div>
                          <span className="text-xs text-gray-400">{new Date(h.data_kontaktu).toLocaleDateString('pl-PL')}</span>
                        </div>
                        {h.notatki&&<p className="text-sm text-gray-700 mt-1">{h.notatki}</p>}
                        {h.uzytkownik&&<p className="text-xs text-gray-400 mt-1">👤 {h.uzytkownik}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {drawerTab==='dokumenty'&&(
                <>
                  {/* Upload */}
                  <div
                    onClick={()=>fileRef.current?.click()}
                    className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center cursor-pointer hover:bg-blue-50 transition-colors">
                    {uploading
                      ? <><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-sm text-blue-600">Przesyłanie...</p></>
                      : <><p className="text-3xl mb-2">📁</p><p className="text-sm font-semibold text-blue-700">Kliknij aby dodać dokumenty</p><p className="text-xs text-gray-400 mt-1">PDF, DOCX, XLSX, IMG — wiele plików naraz</p></>
                    }
                  </div>
                  <input ref={fileRef} type="file" className="hidden" multiple
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.zip"
                    onChange={e=>{const files=Array.from(e.target.files??[]);if(files.length) uploadDocs(files);e.target.value=''}}/>

                  {/* Lista */}
                  <div className="space-y-2">
                    {dokumenty.length===0&&<p className="text-xs text-gray-400 text-center py-4">Brak dokumentów.</p>}
                    {dokumenty.map(d=>(
                      <div key={d.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 group">
                        <span className="text-xl">📎</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{d.nazwa}</p>
                          {d.rozmiar&&<p className="text-xs text-gray-400">{(d.rozmiar/1024).toFixed(1)} KB</p>}
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={d.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline px-2 py-1 bg-blue-50 rounded">Otwórz</a>
                          <button onClick={()=>removeDoc(d.id,d.url)}
                            className="text-xs text-red-500 px-2 py-1 bg-red-50 rounded hover:bg-red-100">Usuń</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: Nowy / Edytuj lead ════ */}
      {showForm&&(
        <LeadForm
          lead={editLead}
          produkty={produkty}
          klienci={klienci}
          pracownicy={pracownicy}
          saving={saving}
          onSave={handleSaveLead}
          onClose={()=>{setShowForm(false);setEditLead(null);setError('')}}
        />
      )}
    </div>
  )
}

// ================================================================
// FORMULARZ LEADU
// ================================================================
function LeadForm({lead,produkty,klienci,pracownicy,saving,onSave,onClose}:{
  lead:Lead|null; produkty:Produkt[]; klienci:any[]; pracownicy:any[];
  saving:boolean; onSave:(d:any)=>void; onClose:()=>void
}) {
  const [form, setForm] = useState({
    tytul:             lead?.tytul??'',
    klient_id:         lead?.klient_id??'',
    klient_nazwa:      lead?.klient_nazwa??'',
    klient_kontakt:    lead?.klient_kontakt??'',
    klient_email:      lead?.klient_email??'',
    klient_telefon:    lead?.klient_telefon??'',
    klient_adres:      lead?.klient_adres??'',
    klient_nip:        lead?.klient_nip??'',
    klient_miasto:     '',
    klient_kod:        '',
    produkt_id:        lead?.produkt_id??'',
    etap:              lead?.etap??'Pierwszy kontakt',
    status:            lead?.status??'aktywny',
    wartosc_szacunkowa:lead?.wartosc_szacunkowa?.toString()??'',
    prawdopodobienstwo:lead?.prawdopodobienstwo?.toString()??'50',
    cena_jednostkowa:  lead?.cena_jednostkowa?.toString()??'',
    ilosc:             lead?.ilosc?.toString()??'',
    jednostka:         lead?.jednostka??'l',
    data_planowanego_zamkniecia: lead?.data_planowanego_zamkniecia??'',
    przypisany_do:     lead?.przypisany_do??'',
    notatki:           lead?.notatki??'',
  })
  const [gusLoading, setGusLoading] = useState(false)
  const [gusMsg, setGusMsg] = useState<{typ:'ok'|'err';txt:string}|null>(null)

  const inp = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white'
  const lbl = 'text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block'

  // Aktualnie wybrany produkt i jego kategoria
  const selProdukt = produkty.find(p=>p.id===form.produkt_id)
  const dostawa = selProdukt?.kategoria==='dostawa'
  const etapyDlaProduktu = dostawa ? ETAPY_DOSTAWA : ETAPY_DOMYSLNE

  // Wartość zamówienia (brutto) = cena jednostkowa × ilość
  const wartoscBrutto = dostawa && form.cena_jednostkowa && form.ilosc
    ? parseFloat(form.cena_jednostkowa)*parseFloat(form.ilosc) : 0

  function handleKlientSelect(e:React.ChangeEvent<HTMLSelectElement>){
    const id = e.target.value
    if(!id){ setForm(f=>({...f,klient_id:''})); return }
    const k = klienci.find((c:any)=>c.id===id)
    if(k) setForm(f=>({...f,klient_id:id,klient_nazwa:k.nazwa,klient_telefon:k.telefon??'',klient_email:k.email??'',klient_adres:k.adres??'',klient_nip:k.nip??'',klient_miasto:k.miasto??'',klient_kod:k.kod_pocztowy??''}))
  }

  function handleProduktChange(e:React.ChangeEvent<HTMLSelectElement>){
    const id = e.target.value
    const p = produkty.find(x=>x.id===id)
    const noweEtapy = p?.kategoria==='dostawa' ? ETAPY_DOSTAWA : ETAPY_DOMYSLNE
    setForm(f=>({...f, produkt_id:id, etap: noweEtapy.includes(f.etap)?f.etap:noweEtapy[0]}))
  }

  async function pobierzZGus(){
    const nipClean=(form.klient_nip||'').replace(/[^0-9]/g,'')
    if(nipClean.length!==10){ setGusMsg({typ:'err',txt:'Wpisz poprawny 10-cyfrowy NIP'}); return }
    setGusLoading(true); setGusMsg(null)
    try{
      const res=await fetch(`/api/gus?nip=${nipClean}`)
      const data=await res.json()
      if(!res.ok){ setGusMsg({typ:'err',txt:data.error??'Błąd GUS'}); return }
      setForm(f=>({...f,
        klient_nazwa: data.nazwa||f.klient_nazwa,
        klient_adres: data.adres||f.klient_adres,
        klient_miasto:data.miasto||f.klient_miasto,
        klient_kod:   data.kod_pocztowy||f.klient_kod,
        klient_nip:   data.nip||f.klient_nip,
      }))
      setGusMsg({typ:'ok',txt:`✓ Pobrano z GUS${data.statusVat?` · VAT: ${data.statusVat}`:''}`})
    }catch{ setGusMsg({typ:'err',txt:'Błąd połączenia z GUS'}) }
    finally{ setGusLoading(false) }
  }

  function handleSubmit(e:React.FormEvent){
    e.preventDefault()
    onSave({
      tytul: form.tytul,
      klient_id: form.klient_id||null,
      klient_nazwa: form.klient_nazwa, klient_kontakt: form.klient_kontakt,
      klient_email: form.klient_email, klient_telefon: form.klient_telefon,
      klient_adres: form.klient_adres, klient_nip: form.klient_nip,
      produkt_id: form.produkt_id||null,
      etap: form.etap, status: form.status,
      // dla dostaw: wartość = cena × ilość; dla reszty: wartość ręczna
      wartosc_szacunkowa: dostawa ? (wartoscBrutto||null) : (form.wartosc_szacunkowa?parseFloat(form.wartosc_szacunkowa):null),
      prawdopodobienstwo: dostawa ? 100 : (parseInt(form.prawdopodobienstwo)||50),
      cena_jednostkowa: dostawa&&form.cena_jednostkowa ? parseFloat(form.cena_jednostkowa) : null,
      ilosc: dostawa&&form.ilosc ? parseFloat(form.ilosc) : null,
      jednostka: dostawa ? form.jednostka : null,
      data_planowanego_zamkniecia: form.data_planowanego_zamkniecia||null,
      przypisany_do: form.przypisany_do||null,
      notatki: form.notatki,
      // pomocnicze pola do utworzenia klienta
      _klient_miasto: form.klient_miasto, _klient_kod: form.klient_kod,
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-2xl" style={{maxHeight:'94vh',overflowY:'auto'}}>
        <h2 className="text-base font-semibold text-gray-900 mb-5">{lead?`Edytuj lead: ${lead.numer}`:'Nowy lead'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className={lbl}>Tytuł leadu *</label>
              <input value={form.tytul} onChange={e=>setForm(f=>({...f,tytul:e.target.value}))} required
                placeholder="np. Budowa gazociągu — Kowalski" className={inp}/>
            </div>

            <div className="col-span-2">
              <label className={lbl}>Klient z bazy (opcjonalnie)</label>
              <select value={form.klient_id} onChange={handleKlientSelect} className={inp}>
                <option value="">— Wpisz ręcznie / pobierz z GUS lub wybierz klienta —</option>
                {klienci.map((k:any)=><option key={k.id} value={k.id}>{k.nazwa}</option>)}
              </select>
              {!form.klient_id&&form.klient_nazwa&&(
                <p className="text-xs text-blue-600 mt-1">ℹ️ Nowy klient zostanie zapisany w bazie Klienci po dodaniu leadu</p>
              )}
            </div>

            {/* NIP + GUS */}
            <div className="col-span-2">
              <label className={lbl}>NIP (firma) — pobierz dane z GUS</label>
              <div className="flex gap-2">
                <input value={form.klient_nip} onChange={e=>{setForm(f=>({...f,klient_nip:e.target.value}));setGusMsg(null)}}
                  placeholder="0000000000" maxLength={13} className={inp}/>
                <button type="button" onClick={pobierzZGus} disabled={gusLoading}
                  className="shrink-0 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1">
                  {gusLoading?<span className="animate-spin">⟳</span>:'🏛'} Pobierz z GUS
                </button>
              </div>
              {gusMsg&&<p className={`text-xs px-2 py-1 rounded mt-1 ${gusMsg.typ==='ok'?'bg-green-50 text-green-700':'bg-red-50 text-red-600'}`}>{gusMsg.txt}</p>}
            </div>

            <div>
              <label className={lbl}>Nazwa klienta</label>
              <input value={form.klient_nazwa} onChange={e=>setForm(f=>({...f,klient_nazwa:e.target.value}))} placeholder="Firma / Imię Nazwisko" className={inp}/>
            </div>
            <div>
              <label className={lbl}>Osoba kontaktowa</label>
              <input value={form.klient_kontakt} onChange={e=>setForm(f=>({...f,klient_kontakt:e.target.value}))} placeholder="Jan Kowalski" className={inp}/>
            </div>
            <div>
              <label className={lbl}>Telefon</label>
              <input value={form.klient_telefon} onChange={e=>setForm(f=>({...f,klient_telefon:e.target.value}))} placeholder="+48 000 000 000" className={inp}/>
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input type="email" value={form.klient_email} onChange={e=>setForm(f=>({...f,klient_email:e.target.value}))} className={inp}/>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Adres</label>
              <input value={form.klient_adres} onChange={e=>setForm(f=>({...f,klient_adres:e.target.value}))} placeholder="ul. Przykładowa 1" className={inp}/>
            </div>
            <div>
              <label className={lbl}>Kod pocztowy</label>
              <input value={form.klient_kod} onChange={e=>setForm(f=>({...f,klient_kod:e.target.value}))} placeholder="00-000" className={inp}/>
            </div>
            <div>
              <label className={lbl}>Miasto</label>
              <input value={form.klient_miasto} onChange={e=>setForm(f=>({...f,klient_miasto:e.target.value}))} placeholder="Białystok" className={inp}/>
            </div>

            {/* Produkt */}
            <div className="col-span-2">
              <label className={lbl}>Produkt / Usługa *</label>
              <select value={form.produkt_id} onChange={handleProduktChange} className={inp} required>
                <option value="">— Wybierz —</option>
                {['inwestycja','dostawa','inne'].map(kat=>(
                  <optgroup key={kat} label={kat==='inwestycja'?'🏗 Inwestycje':kat==='dostawa'?'🚛 Dostawy gazu':'📋 Inne'}>
                    {produkty.filter(p=>p.kategoria===kat).map(p=><option key={p.id} value={p.id}>{p.nazwa}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* ── POLA SPECYFICZNE DLA DOSTAWY GAZU ── */}
            {dostawa ? (
              <>
                <div>
                  <label className={lbl}>Cena jednostkowa BRUTTO [zł]</label>
                  <input type="number" min="0" step="0.01" value={form.cena_jednostkowa}
                    onChange={e=>setForm(f=>({...f,cena_jednostkowa:e.target.value}))} placeholder="np. 3.50" className={inp}/>
                </div>
                <div>
                  <label className={lbl}>Ilość gazu</label>
                  <div className="flex gap-2">
                    <input type="number" min="0" step="0.01" value={form.ilosc}
                      onChange={e=>setForm(f=>({...f,ilosc:e.target.value}))} placeholder="np. 2700" className={inp}/>
                    <select value={form.jednostka} onChange={e=>setForm(f=>({...f,jednostka:e.target.value}))}
                      className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white shrink-0">
                      {['l','kg','m³'].map(j=><option key={j} value={j}>{j}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-span-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-green-800">
                    💰 Wartość zamówienia (brutto): <strong className="text-base">{fmt(wartoscBrutto||null)} zł</strong>
                    {form.cena_jednostkowa&&form.ilosc&&<span className="text-xs text-green-600 ml-2">({form.cena_jednostkowa} zł × {form.ilosc} {form.jednostka})</span>}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={lbl}>Wartość szacunkowa [zł]</label>
                  <input type="number" min="0" step="0.01" value={form.wartosc_szacunkowa}
                    onChange={e=>setForm(f=>({...f,wartosc_szacunkowa:e.target.value}))} placeholder="0.00" className={inp}/>
                </div>
                <div>
                  <label className={lbl}>Prawdopodobieństwo [%]</label>
                  <input type="number" min="0" max="100" value={form.prawdopodobienstwo}
                    onChange={e=>setForm(f=>({...f,prawdopodobienstwo:e.target.value}))} className={inp}/>
                </div>
              </>
            )}

            <div>
              <label className={lbl}>Etap startowy</label>
              <select value={form.etap} onChange={e=>setForm(f=>({...f,etap:e.target.value}))} className={inp}>
                {etapyDlaProduktu.map(e=><option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Planowane zamknięcie</label>
              <input type="date" value={form.data_planowanego_zamkniecia} onChange={e=>setForm(f=>({...f,data_planowanego_zamkniecia:e.target.value}))} className={inp}/>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Przypisany do (pracownik)</label>
              <select value={form.przypisany_do} onChange={e=>setForm(f=>({...f,przypisany_do:e.target.value}))} className={inp}>
                <option value="">— Wybierz pracownika —</option>
                {pracownicy.map((p:any)=>(
                  <option key={p.id} value={`${p.imie} ${p.nazwisko}`}>{p.imie} {p.nazwisko}{p.stanowisko?` · ${p.stanowisko}`:''}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Notatki</label>
              <textarea value={form.notatki} onChange={e=>setForm(f=>({...f,notatki:e.target.value}))}
                rows={3} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none bg-white"/>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
              {saving?'Zapisuję...':lead?'Zapisz zmiany':'Dodaj lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
