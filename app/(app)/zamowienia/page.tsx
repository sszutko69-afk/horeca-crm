'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

// ================================================================
// TYPY
// ================================================================
type Zamowienie = {
  id:string; numer:string; zrodlo:string
  lead_id:string|null; klient_id:string|null
  klient_nazwa:string; klient_adres:string|null; klient_telefon:string|null
  klient_email:string|null; klient_nip:string|null; klient_lat:number|null; klient_lng:number|null
  produkt:string; ilosc:number; jednostka:string
  cena_netto:number|null; vat:number
  data_zamowienia:string; data_planowanej_dostawy:string|null
  status:ZamStatus; do_dostawy:boolean; priorytet:number
  notatki:string|null; created_at:string
}
type ZamStatus = 'nowe'|'potwierdzone'|'do_dostawy'|'w_dostawie'|'dostarczone'|'anulowane'

const STATUS_BADGE:Record<ZamStatus,string> = {
  nowe:          'bg-gray-100 text-gray-700',
  potwierdzone:  'bg-blue-50 text-blue-700',
  do_dostawy:    'bg-amber-50 text-amber-700',
  w_dostawie:    'bg-orange-50 text-orange-700',
  dostarczone:   'bg-green-50 text-green-700',
  anulowane:     'bg-red-50 text-red-500',
}
const STATUS_LABEL:Record<ZamStatus,string> = {
  nowe:'Nowe', potwierdzone:'Potwierdzone', do_dostawy:'Do dostawy',
  w_dostawie:'W dostawie', dostarczone:'Dostarczone', anulowane:'Anulowane'
}
const ZRODLO_BADGE:Record<string,string> = {
  lead:'bg-purple-50 text-purple-700',
  klient:'bg-blue-50 text-blue-700',
  manual:'bg-gray-100 text-gray-600',
}
const PRODUKTY_HORECA = ['Catering — lunch box','Catering — bankiet','Zestaw obiadowy','Tort / ciasta','Wypieki i pieczywo','Napoje i alkohole']
const JEDNOSTKI = ['porcja','os.','szt','kg','l']
const inp = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white'
const lbl = 'text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block'

function fmt(n:number|null) { if(!n) return '—'; return n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}) }
function fmtDate(d:string|null) { return d?new Date(d).toLocaleDateString('pl-PL'):'—' }

// ================================================================
// KOMPONENT GŁÓWNY
// ================================================================
export default function ZamowieniaPage() {
  const supabase = createClient()
  const [zamowienia, setZamowienia] = useState<Zamowienie[]>([])
  const [klienci,    setKlienci]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)

  const [zaznaczone, setZaznaczone] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterProdukt,setFilterProdukt]= useState('')
  const [search,       setSearch]       = useState('')
  const [dataOd,       setDataOd]       = useState('')
  const [dataDo,       setDataDo]       = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editZam,  setEditZam]  = useState<Zamowienie|null>(null)
  const [openZam,  setOpenZam]  = useState<Zamowienie|null>(null)

  const [success, setSuccess] = useState('')
  const [error,   setError]   = useState('')

  useEffect(()=>{ loadAll() },[])

  async function loadAll(){
    setLoading(true)
    const [{data:z},{data:k}] = await Promise.all([
      supabase.from('zamowienia').select('*').eq('stan_akceptacji','zaakceptowany').order('created_at',{ascending:false}),
      supabase.from('klienci').select('id,nazwa,telefon,email,adres,nip,lat,lng').order('nazwa').limit(300),
    ])
    setZamowienia(z??[])
    setKlienci(k??[])
    setLoading(false)
  }

  function showMsg(msg:string){ setSuccess(msg); setTimeout(()=>setSuccess(''),3000) }

  async function handleSave(data:any){
    setSaving(true); setError('')
    if(editZam){
      const {error:e} = await supabase.from('zamowienia').update({...data,updated_at:new Date().toISOString()}).eq('id',editZam.id)
      if(e){setError(e.message);setSaving(false);return}
      showMsg('Zamówienie zaktualizowane!')
    } else {
      const {error:e} = await supabase.from('zamowienia').insert(data)
      if(e){setError(e.message);setSaving(false);return}
      showMsg('Zamówienie dodane!')
    }
    setShowForm(false); setEditZam(null); loadAll(); setSaving(false)
  }

  async function changeStatus(id:string, status:ZamStatus){
    await supabase.from('zamowienia').update({status,updated_at:new Date().toISOString()}).eq('id',id)
    setZamowienia(prev=>prev.map(z=>z.id===id?{...z,status}:z))
    if(openZam?.id===id) setOpenZam(z=>z?{...z,status}:z)
  }

  async function toggleDoDostawy(id:string, val:boolean){
    await supabase.from('zamowienia').update({do_dostawy:val,status:val?'do_dostawy':undefined,updated_at:new Date().toISOString()}).eq('id',id)
    setZamowienia(prev=>prev.map(z=>z.id===id?{...z,do_dostawy:val,status:val?'do_dostawy':z.status}:z))
  }

  async function toggleCheckbox(id:string){
    setZaznaczone(prev=>{const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n})
  }

  async function oznaczDoDostawy(){
    const ids = Array.from(zaznaczone)
    for(const id of ids) await supabase.from('zamowienia').update({do_dostawy:true,status:'do_dostawy',updated_at:new Date().toISOString()}).eq('id',id)
    setZamowienia(prev=>prev.map(z=>zaznaczone.has(z.id)?{...z,do_dostawy:true,status:'do_dostawy'}:z))
    setZaznaczone(new Set())
    showMsg(`Oznaczono ${ids.length} zamówień do dostawy`)
  }

  async function wyslijDoRealizacji(){
    const doDostawy = zamowienia.filter(z=>z.do_dostawy&&z.status==='do_dostawy')
    if(!doDostawy.length){ setError('Brak zamówień oznaczonych do dostawy!'); return }
    setError('')
    for(const z of doDostawy){
      await supabase.from('zamowienia').update({status:'w_dostawie',updated_at:new Date().toISOString()}).eq('id',z.id)
    }
    setZamowienia(prev=>prev.map(z=>z.do_dostawy&&z.status==='do_dostawy'?{...z,status:'w_dostawie'}:z))
    showMsg(`✓ Przekazano ${doDostawy.length} zamówień do realizacji (kuchnia i dostawa).`)
  }

  async function deleteZam(id:string){
    if(!confirm('Usunąć zamówienie?')) return
    await supabase.from('zamowienia').delete().eq('id',id)
    setZamowienia(prev=>prev.filter(z=>z.id!==id))
    if(openZam?.id===id) setOpenZam(null)
    showMsg('Zamówienie usunięte')
  }

  const filtered = useMemo(()=>zamowienia.filter(z=>{
    if(filterStatus && z.status!==filterStatus) return false
    if(filterProdukt && !z.produkt.toLowerCase().includes(filterProdukt.toLowerCase())) return false
    if(search){const q=search.toLowerCase();if(!z.klient_nazwa.toLowerCase().includes(q)&&!z.numer.toLowerCase().includes(q)) return false}
    if(dataOd && z.data_planowanej_dostawy && z.data_planowanej_dostawy<dataOd) return false
    if(dataDo && z.data_planowanej_dostawy && z.data_planowanej_dostawy>dataDo) return false
    return true
  }),[zamowienia,filterStatus,filterProdukt,search,dataOd,dataDo])

  const doDostawyCount = zamowienia.filter(z=>z.do_dostawy&&z.status==='do_dostawy').length

  const stats = useMemo(()=>({
    nowe:       zamowienia.filter(z=>z.status==='nowe').length,
    doDostawy:  zamowienia.filter(z=>z.status==='do_dostawy').length,
    wDostawie:  zamowienia.filter(z=>z.status==='w_dostawie').length,
    dostarczone:zamowienia.filter(z=>z.status==='dostarczone').length,
    wartosc:    zamowienia.filter(z=>!['dostarczone','anulowane'].includes(z.status)).reduce((a,z)=>a+(z.cena_netto??0),0),
  }),[zamowienia])

  const wszystkieZaznaczone = filtered.length>0 && filtered.every(z=>zaznaczone.has(z.id))

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Zamówienia</h1>
          <p className="text-sm text-gray-500 mt-0.5">Zamówienia klientów · Catering i dostawy · Realizacja przez kuchnię</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {doDostawyCount>0&&(
            <button onClick={wyslijDoRealizacji}
              className="text-sm bg-orange-600 text-white rounded-lg px-4 py-2 hover:bg-orange-700 flex items-center gap-2">
              🍽 Przekaż do realizacji ({doDostawyCount})
            </button>
          )}
          {zaznaczone.size>0&&(
            <button onClick={oznaczDoDostawy}
              className="text-sm bg-amber-500 text-white rounded-lg px-4 py-2 hover:bg-amber-600">
              📦 Oznacz do dostawy ({zaznaczone.size})
            </button>
          )}
          <a href="/leady" className="text-sm border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600">
            📋 Leady
          </a>
          <button onClick={()=>{setEditZam(null);setShowForm(true)}}
            className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700">
            + Nowe zamówienie
          </button>
        </div>
      </div>

      {success&&<div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-4">✓ {success}</div>}
      {error  &&<div className="text-xs text-red-600  bg-red-50  border border-red-200  px-3 py-2 rounded-lg mb-4">✗ {error}</div>}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          {l:'Nowe',       v:stats.nowe,        c:'text-gray-700'},
          {l:'Do dostawy', v:stats.doDostawy,   c:'text-amber-700'},
          {l:'W dostawie', v:stats.wDostawie,   c:'text-orange-700'},
          {l:'Dostarczone',v:stats.dostarczone, c:'text-green-700'},
          {l:'Wartość aktywnych',v:fmt(stats.wartosc)+' zł',c:'text-purple-700'},
        ].map(k=>(
          <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.l}</p>
            <p className={`text-lg font-semibold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Filtry */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 flex flex-wrap gap-2">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Szukaj klienta, numeru..."
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{minWidth:'160px'}}/>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Wszystkie statusy</option>
          {(Object.keys(STATUS_LABEL) as ZamStatus[]).map(k=><option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
        </select>
        <input value={filterProdukt} onChange={e=>setFilterProdukt(e.target.value)}
          placeholder="Produkt..." className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white w-32 focus:outline-none"/>
        <input type="date" value={dataOd} onChange={e=>setDataOd(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"/>
        <input type="date" value={dataDo} onChange={e=>setDataDo(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"/>
        {(search||filterStatus||filterProdukt||dataOd||dataDo)&&(
          <button onClick={()=>{setSearch('');setFilterStatus('');setFilterProdukt('');setDataOd('');setDataDo('')}}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">✕</button>
        )}
        <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} zamówień</span>
      </div>

      {/* Tabela */}
      {loading ? (
        <p className="text-center text-gray-400 py-12">Ładowanie...</p>
      ) : filtered.length===0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <p className="text-2xl mb-2">📦</p>
          <p className="text-gray-500">Brak zamówień. Dodaj pierwsze zamówienie lub zaakceptuj leady w fazie realizacji.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={wszystkieZaznaczone}
                    onChange={()=>wszystkieZaznaczone?setZaznaczone(new Set()):setZaznaczone(new Set(filtered.map(z=>z.id)))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"/>
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-3 min-w-28">Numer</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-3 min-w-40">Klient</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-3 min-w-32">Produkt</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3 min-w-20">Ilość</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3 min-w-24">Cena netto</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase px-3 py-3 min-w-28">Data dostawy</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase px-3 py-3 min-w-28">Status</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase px-3 py-3 min-w-20">Do dost.</th>
                <th className="px-3 py-3 min-w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((z,idx)=>(
                <tr key={z.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${idx%2===1?'bg-gray-50/30':''}`}
                  onClick={()=>setOpenZam(z)}>
                  <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                    <input type="checkbox"
                      checked={zaznaczone.has(z.id)}
                      onChange={()=>toggleCheckbox(z.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"/>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-mono text-xs font-medium text-gray-900">{z.numer}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${ZRODLO_BADGE[z.zrodlo]??'bg-gray-100 text-gray-600'}`}>
                      {z.zrodlo==='lead'?'Lead':z.zrodlo==='klient'?'Klient':'Ręczny'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-gray-900 text-sm">{z.klient_nazwa}</p>
                    {z.klient_telefon&&<p className="text-xs text-gray-400">{z.klient_telefon}</p>}
                    {z.klient_adres&&<p className="text-xs text-gray-400 truncate max-w-xs">{z.klient_adres}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm text-gray-800">{z.produkt}</p>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-700">
                    {z.ilosc} {z.jednostka}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {z.cena_netto ? <span className="font-semibold text-gray-900">{fmt(z.cena_netto)} zł</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-600">
                    {fmtDate(z.data_planowanej_dostawy)}
                  </td>
                  <td className="px-3 py-3 text-center" onClick={e=>e.stopPropagation()}>
                    <select value={z.status}
                      onChange={e=>changeStatus(z.id,e.target.value as ZamStatus)}
                      className={`text-xs px-2 py-1 rounded-full font-medium cursor-pointer border-0 ${STATUS_BADGE[z.status]}`}>
                      {(Object.keys(STATUS_LABEL) as ZamStatus[]).map(k=>
                        <option key={k} value={k}>{STATUS_LABEL[k]}</option>
                      )}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-center" onClick={e=>e.stopPropagation()}>
                    <input type="checkbox"
                      checked={z.do_dostawy}
                      onChange={e=>toggleDoDostawy(z.id,e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-orange-500 cursor-pointer"
                      title="Oznacz do dostawy"/>
                  </td>
                  <td className="px-3 py-3" onClick={e=>e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button onClick={()=>{setEditZam(z);setShowForm(true)}}
                        className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-500">Edytuj</button>
                      <button onClick={()=>deleteZam(z.id)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-red-50 hover:text-red-600 text-gray-400">Usuń</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info o zamówieniach do realizacji */}
      {doDostawyCount>0&&(
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-amber-800">
            🍽 <strong>{doDostawyCount}</strong> zamówień gotowych do przekazania do realizacji
          </p>
          <button onClick={wyslijDoRealizacji}
            className="text-sm bg-orange-600 text-white rounded-lg px-4 py-1.5 hover:bg-orange-700">
            Przekaż do realizacji →
          </button>
        </div>
      )}

      {/* DRAWER: Szczegóły zamówienia */}
      {openZam&&(
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black bg-opacity-30" onClick={()=>setOpenZam(null)}/>
          <div className="w-full max-w-md bg-white border-l border-gray-200 flex flex-col" style={{overflowY:'auto'}}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-gray-400">{openZam.numer}</p>
                  <h2 className="text-base font-semibold text-gray-900 mt-0.5">{openZam.klient_nazwa}</h2>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[openZam.status]}`}>{STATUS_LABEL[openZam.status]}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ZRODLO_BADGE[openZam.zrodlo]??'bg-gray-100 text-gray-600'}`}>
                      {openZam.zrodlo==='lead'?'Z leada':openZam.zrodlo==='klient'?'Klient z bazy':'Ręczne'}
                    </span>
                    {openZam.do_dostawy&&<span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">📦 Do dostawy</span>}
                  </div>
                </div>
                <button onClick={()=>setOpenZam(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
              </div>
            </div>
            <div className="p-5 space-y-4 flex-1">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Zamówienie</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ['Produkt', openZam.produkt],
                    ['Ilość', `${openZam.ilosc} ${openZam.jednostka}`],
                    ['Cena netto', openZam.cena_netto?fmt(openZam.cena_netto)+' zł':null],
                    ['VAT', openZam.vat+'%'],
                    ['Cena brutto', openZam.cena_netto?fmt(openZam.cena_netto*(1+openZam.vat/100))+' zł':null],
                    ['Data zamówienia', fmtDate(openZam.data_zamowienia)],
                    ['Planowana dostawa', fmtDate(openZam.data_planowanej_dostawy)],
                  ].map(([l,v])=>v&&(
                    <div key={l as string}>
                      <p className="text-xs text-gray-400">{l}</p>
                      <p className="text-gray-800 font-medium">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Klient</h3>
                <div className="space-y-1 text-sm">
                  {openZam.klient_adres&&<p>📍 {openZam.klient_adres}</p>}
                  {openZam.klient_telefon&&<p>📞 {openZam.klient_telefon}</p>}
                  {openZam.klient_email&&<p>✉️ {openZam.klient_email}</p>}
                  {openZam.klient_nip&&<p>🏢 NIP: {openZam.klient_nip}</p>}
                </div>
              </div>
              {openZam.notatki&&(
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notatki</h3>
                  <p className="text-sm text-gray-700">{openZam.notatki}</p>
                </div>
              )}
              {/* Oznacz do dostawy */}
              <div className="border border-dashed border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Dostawa</p>
                    <p className="text-xs text-gray-500">Zaznacz aby przekazać do realizacji (kuchnia + dostawa)</p>
                  </div>
                  <input type="checkbox"
                    checked={openZam.do_dostawy}
                    onChange={e=>{ toggleDoDostawy(openZam.id,e.target.checked); setOpenZam(z=>z?{...z,do_dostawy:e.target.checked}:z) }}
                    className="w-6 h-6 rounded border-gray-300 text-orange-500"/>
                </div>
                {openZam.do_dostawy&&(
                  <button onClick={wyslijDoRealizacji}
                    className="w-full mt-3 px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700">
                    🍽 Przekaż do realizacji
                  </button>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-2">
              <button onClick={()=>{setEditZam(openZam);setShowForm(true);setOpenZam(null)}}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Edytuj</button>
              <select value={openZam.status}
                onChange={e=>changeStatus(openZam.id,e.target.value as ZamStatus)}
                className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium cursor-pointer border ${STATUS_BADGE[openZam.status]}`}>
                {(Object.keys(STATUS_LABEL) as ZamStatus[]).map(k=><option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nowe / Edytuj zamówienie */}
      {showForm&&(
        <ZamowienieForm
          zam={editZam}
          klienci={klienci}
          saving={saving}
          onSave={handleSave}
          onClose={()=>{setShowForm(false);setEditZam(null)}}
        />
      )}
    </div>
  )
}

// ================================================================
// FORMULARZ ZAMÓWIENIA
// ================================================================
function ZamowienieForm({zam,klienci,saving,onSave,onClose}:{
  zam:Zamowienie|null; klienci:any[]; saving:boolean; onSave:(d:any)=>void; onClose:()=>void
}){
  const [zrodlo, setZrodlo] = useState(zam?.zrodlo??'manual')
  const [form, setForm] = useState({
    klient_id:              zam?.klient_id??'',
    klient_nazwa:           zam?.klient_nazwa??'',
    klient_adres:           zam?.klient_adres??'',
    klient_telefon:         zam?.klient_telefon??'',
    klient_email:           zam?.klient_email??'',
    klient_nip:             zam?.klient_nip??'',
    produkt:                zam?.produkt??'',
    ilosc:                  zam?.ilosc?.toString()??'',
    jednostka:              zam?.jednostka??'porcja',
    cena_netto:             zam?.cena_netto?.toString()??'',
    vat:                    zam?.vat?.toString()??'23',
    data_zamowienia:        zam?.data_zamowienia??new Date().toISOString().split('T')[0],
    data_planowanej_dostawy:zam?.data_planowanej_dostawy??'',
    notatki:                zam?.notatki??'',
  })

  function handleKlient(e:React.ChangeEvent<HTMLSelectElement>){
    const id=e.target.value; if(!id){setForm(f=>({...f,klient_id:''}));return}
    const k=klienci.find((c:any)=>c.id===id)
    if(k) setForm(f=>({...f,klient_id:id,klient_nazwa:k.nazwa,klient_adres:k.adres??'',klient_telefon:k.telefon??'',klient_email:k.email??'',klient_nip:k.nip??''}))
  }

  function handleSubmit(e:React.FormEvent){
    e.preventDefault()
    onSave({
      ...form,
      zrodlo,
      klient_id: form.klient_id||null,
      ilosc: parseFloat(form.ilosc)||1,
      cena_netto: form.cena_netto?parseFloat(form.cena_netto):null,
      vat: parseInt(form.vat)||23,
      data_planowanej_dostawy: form.data_planowanej_dostawy||null,
    })
  }

  const brutto = form.cena_netto ? parseFloat(form.cena_netto)*(1+(parseInt(form.vat)||23)/100) : 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-2xl" style={{maxHeight:'94vh',overflowY:'auto'}}>
        <h2 className="text-base font-semibold text-gray-900 mb-5">{zam?`Edytuj zamówienie ${zam.numer}`:'Nowe zamówienie'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-4">

            {/* Źródło */}
            <div className="col-span-2">
              <label className={lbl}>Źródło zamówienia</label>
              <div className="flex gap-2">
                {[['manual','✏️ Ręczne'],['klient','👥 Klient z bazy'],['lead','📋 Z leada']].map(([v,l])=>(
                  <button key={v} type="button" onClick={()=>setZrodlo(v)}
                    className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-all ${zrodlo===v?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Klient */}
            {zrodlo==='klient'&&(
              <div className="col-span-2">
                <label className={lbl}>Wybierz klienta</label>
                <select value={form.klient_id} onChange={handleKlient} className={inp}>
                  <option value="">— Wybierz klienta —</option>
                  {klienci.map((k:any)=><option key={k.id} value={k.id}>{k.nazwa} {k.adres?`(${k.adres})`:''}</option>)}
                </select>
              </div>
            )}

            <div className="col-span-2">
              <label className={lbl}>Nazwa klienta *</label>
              <input value={form.klient_nazwa} onChange={e=>setForm(f=>({...f,klient_nazwa:e.target.value}))} required
                placeholder="Firma / Imię Nazwisko" className={inp}/>
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
              <label className={lbl}>Adres dostawy</label>
              <input value={form.klient_adres} onChange={e=>setForm(f=>({...f,klient_adres:e.target.value}))}
                placeholder="ul. Przykładowa 1, 00-000 Miasto" className={inp}/>
            </div>
            <div>
              <label className={lbl}>NIP</label>
              <input value={form.klient_nip} onChange={e=>setForm(f=>({...f,klient_nip:e.target.value}))} placeholder="000-000-00-00" className={inp}/>
            </div>

            {/* Produkt */}
            <div>
              <label className={lbl}>Produkt *</label>
              <select value={form.produkt} onChange={e=>setForm(f=>({...f,produkt:e.target.value}))} className={inp} required>
                <option value="">— Wybierz —</option>
                <optgroup label="Catering i gastronomia">
                  {PRODUKTY_HORECA.map(p=><option key={p} value={p}>{p}</option>)}
                </optgroup>
                <optgroup label="Inne">
                  <option value="Wynajem sali">Wynajem sali</option>
                  <option value="Obsługa kelnerska">Obsługa kelnerska</option>
                  <option value="Inne">Inne</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className={lbl}>Produkt (własny)</label>
              <input value={form.produkt} onChange={e=>setForm(f=>({...f,produkt:e.target.value}))}
                placeholder="lub wpisz własny" className={inp}/>
            </div>
            <div>
              <label className={lbl}>Ilość *</label>
              <input type="number" min="0" step="0.001" value={form.ilosc}
                onChange={e=>setForm(f=>({...f,ilosc:e.target.value}))} required placeholder="0" className={inp}/>
            </div>
            <div>
              <label className={lbl}>Jednostka</label>
              <select value={form.jednostka} onChange={e=>setForm(f=>({...f,jednostka:e.target.value}))} className={inp}>
                {JEDNOSTKI.map(j=><option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Cena netto [zł]</label>
              <input type="number" min="0" step="0.01" value={form.cena_netto}
                onChange={e=>setForm(f=>({...f,cena_netto:e.target.value}))} placeholder="0.00" className={inp}/>
            </div>
            <div>
              <label className={lbl}>VAT [%]</label>
              <select value={form.vat} onChange={e=>setForm(f=>({...f,vat:e.target.value}))} className={inp}>
                {['0','5','8','23'].map(v=><option key={v} value={v}>{v}%</option>)}
              </select>
            </div>
            {form.cena_netto&&(
              <div className="col-span-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                <p className="text-xs text-green-700">💰 Wartość brutto: <strong>{fmt(brutto)} zł</strong> (netto: {fmt(parseFloat(form.cena_netto))} + VAT {form.vat}%)</p>
              </div>
            )}
            <div>
              <label className={lbl}>Data zamówienia</label>
              <input type="date" value={form.data_zamowienia} onChange={e=>setForm(f=>({...f,data_zamowienia:e.target.value}))} className={inp}/>
            </div>
            <div>
              <label className={lbl}>Planowana data dostawy</label>
              <input type="date" value={form.data_planowanej_dostawy} onChange={e=>setForm(f=>({...f,data_planowanej_dostawy:e.target.value}))} className={inp}/>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Notatki</label>
              <textarea value={form.notatki} onChange={e=>setForm(f=>({...f,notatki:e.target.value}))}
                rows={2} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none bg-white"/>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
              {saving?'Zapisuję...':zam?'Zapisz zmiany':'Dodaj zamówienie'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
