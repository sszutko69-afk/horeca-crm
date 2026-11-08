'use client'

import { useEffect, useState, useRef } from 'react'
import AiPrzetarg from '@/components/AiPrzetarg'
import { createClient } from '@/lib/supabase'
import CzatPanel from '@/components/CzatPanel'

type Przetarg = {
  id: string; bzp_id: string | null; ted_id: string | null
  tytul: string; zamawiajacy: string | null; zamawiajacy_adres: string | null
  miasto: string | null; wojewodztwo: string | null
  wartosc_netto: number | null; waluta: string
  data_publikacji: string | null; data_skladania: string
  cpv_kod: string | null; branza: string | null
  status: string; uwagi: string | null; url_ogloszenia: string | null
  priorytet: number; zrodlo: string; zrodlo_url: string | null
  obserwowany: boolean; tagi: string[] | null; ocena: number | null
  przypisany_do: string | null; dokumenty_url: string[] | null
  url_postepowania: string | null
  zarchiwizowany: boolean; zarchiwizowany_at: string | null
  created_at: string
}
type Branza = { id: string; nazwa: string; kolor: string; cpv_kody: string[]; aktywna: boolean }

const WOJEWODZTWA: Record<string, string> = {
  PL02:'dolnośląskie',PL04:'kujawsko-pomorskie',PL06:'lubelskie',PL08:'lubuskie',
  PL10:'łódzkie',PL12:'małopolskie',PL14:'mazowieckie',PL16:'opolskie',
  PL18:'podkarpackie',PL20:'podlaskie',PL22:'pomorskie',PL24:'śląskie',
  PL26:'świętokrzyskie',PL28:'warmińsko-mazurskie',PL30:'wielkopolskie',PL32:'zachodniopomorskie',
}

const STATUSY: Record<string, { label: string; color: string; icon: string }> = {
  nowy:        { label:'Nowy',        color:'bg-blue-50 text-blue-700 border-blue-200',     icon:'🆕' },
  obserwowany: { label:'Obserwowany', color:'bg-yellow-50 text-yellow-700 border-yellow-200',icon:'👁' },
  zgłoszony:   { label:'Zgłoszony',   color:'bg-purple-50 text-purple-700 border-purple-200',icon:'📤' },
  wygrany:     { label:'Wygrany',     color:'bg-green-50 text-green-700 border-green-200',  icon:'🏆' },
  przegrany:   { label:'Przegrany',   color:'bg-red-50 text-red-700 border-red-200',        icon:'❌' },
  pominiety:   { label:'Pominięty',   color:'bg-gray-100 text-gray-500 border-gray-200',    icon:'⏭' },
}

const ZRODLA: Record<string, { label: string; color: string; icon: string }> = {
  bzp:          { label:'BZP',          color:'bg-blue-50 text-blue-700',    icon:'🏛' },
  ted:          { label:'TED (UE)',      color:'bg-indigo-50 text-indigo-700',icon:'🇪🇺' },
  connect_orlen:{ label:'CONNECT ORLEN',color:'bg-red-50 text-red-700',      icon:'⛽' },
  eb2b:         { label:'eB2B',          color:'bg-orange-50 text-orange-700',icon:'🔗' },
  eprzetargi:   { label:'ePrzetargi',   color:'bg-teal-50 text-teal-700',    icon:'📩' },
  inne:         { label:'Inne',          color:'bg-gray-100 text-gray-600',   icon:'📋' },
}

const KOLORY: Record<string, string> = {
  blue:'bg-blue-100 text-blue-700',yellow:'bg-yellow-100 text-yellow-700',
  green:'bg-green-100 text-green-700',orange:'bg-orange-100 text-orange-700',
  purple:'bg-purple-100 text-purple-700',gray:'bg-gray-100 text-gray-600',
  red:'bg-red-100 text-red-700',teal:'bg-teal-100 text-teal-700',
}

function daysTill(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) }
function fmt(n: number) { return n.toLocaleString('pl-PL') }
const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white"

function TerminBadge({ data }: { data: string }) {
  const dni = daysTill(data)
  const d = new Date(data).toLocaleDateString('pl-PL')
  if (dni < 0)  return <span className="text-xs text-gray-400">{d}</span>
  if (dni === 0) return <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full animate-pulse">⚡ DZIŚ</span>
  if (dni <= 3)  return <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">🔥 {dni}d</span>
  if (dni <= 7)  return <span className="text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">⚠ {dni}d</span>
  if (dni <= 14) return <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">{dni}d</span>
  return <span className="text-xs text-gray-500">{d}</span>
}

function Stars({ val, onChange }: { val: number; onChange?: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => onChange?.(n === val ? 0 : n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          className={`text-xl leading-none transition-all ${n<=(hover||val)?'text-yellow-400':'text-gray-200'} ${onChange?'cursor-pointer hover:scale-125':'cursor-default'}`}>
          ★
        </button>
      ))}
    </div>
  )
}

// ─── MODAL ──────────────────────────────────────────────────────────────────
function PrzetargModal({
  detail, branze, onClose, onSaved, onDeleted, onToggleObserwuj
}: {
  detail: Przetarg
  branze: Branza[]
  onClose: () => void
  onSaved: (p: Przetarg) => void
  onDeleted: (id: string) => void
  onToggleObserwuj: (p: Przetarg) => void
}) {
  const supabase = createClient()
  const [modalTab, setModalTab] = useState<'info'|'tresc'|'dokumenty'|'ai'|'czat'|'pracownicy'>('info')
  const [pracownicy, setPracownicy] = useState<any[]>([])
  const [przypisaniPrac, setPrzypisaniPrac] = useState<any[]>([])
  const [loadingPrac, setLoadingPrac] = useState(false)
  const [trescOglos, setTrescOglos] = useState('')
  const [loadingTrescOglos, setLoadingTrescOglos] = useState(false)

  async function loadPracownicy() {
    setLoadingPrac(true)
    const [{ data: wszyscy }, { data: przypisani }] = await Promise.all([
      supabase.from('pracownicy').select('id, imie, nazwisko, stanowisko').eq('aktywny', true).order('nazwisko'),
      supabase.from('przetargi_pracownicy').select('pracownik_id, rola').eq('przetarg_id', detail.id),
    ])
    setPracownicy(wszyscy ?? [])
    setPrzypisaniPrac(przypisani?.map((p: any) => p.pracownik_id) ?? [])
    setLoadingPrac(false)
  }

  async function togglePracownik(pracId: string) {
    const jest = przypisaniPrac.includes(pracId)
    if (jest) {
      await supabase.from('przetargi_pracownicy').delete()
        .eq('przetarg_id', detail.id).eq('pracownik_id', pracId)
      setPrzypisaniPrac(prev => prev.filter(id => id !== pracId))
    } else {
      await supabase.from('przetargi_pracownicy').insert({ przetarg_id: detail.id, pracownik_id: pracId })
      setPrzypisaniPrac(prev => [...prev, pracId])
    }
  }

  async function pobierzTrescOglos() {
    if (!detail.url_ogloszenia) return
    setLoadingTrescOglos(true)
    try {
      const res = await fetch(`/api/przetargi/tresc-oglos?url=${encodeURIComponent(detail.url_ogloszenia)}`)
      const data = await res.json()
      setTrescOglos(data.tresc || 'Nie udało się pobrać treści.')
    } catch {
      setTrescOglos('Błąd połączenia.')
    }
    setLoadingTrescOglos(false)
  }

  // Edycja
  const [editStatus, setEditStatus]       = useState(detail.status)
  const [editUwagi, setEditUwagi]         = useState(detail.uwagi ?? '')
  const [editPriorytet, setEditPriorytet] = useState(detail.priorytet)
  const [editOcena, setEditOcena]         = useState(detail.ocena ?? 0)
  const [editTagi, setEditTagi]           = useState(detail.tagi?.join(', ') ?? '')
  const [editPrzypisany, setEditPrzypisany] = useState(detail.przypisany_do ?? '')
  const [saving, setSaving] = useState(false)

  // Treść BZP
  const [trescHtml, setTrescHtml]   = useState<string|null>(null)
  const [trescLoading, setTrescLoading] = useState(false)
  const [trescError, setTrescError] = useState('')

  // Dokumenty
  const [dokumenty, setDokumenty]   = useState<string[]>(detail.dokumenty_url ?? [])
  const [newDocUrl, setNewDocUrl]   = useState('')
  const [newDocName, setNewDocName] = useState('')
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError]     = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Zakładka Treść — pobierz automatycznie przy otwarciu
  useEffect(() => {
    if (modalTab === 'tresc' && !trescHtml && !trescLoading) {
      fetchTresc()
    }
  }, [modalTab])

  async function fetchTresc() {
    if (!detail.bzp_id) { setTrescError('Brak numeru BZP'); return }
    setTrescLoading(true); setTrescError('')
    try {
      const dateFrom = (detail.data_publikacji ?? '2024-01-01') + 'T00:00:00'
      const dateTo   = new Date().toISOString().split('T')[0] + 'T23:59:59'
      const res = await fetch(`/api/przetargi/tresc?noticeNumber=${encodeURIComponent(detail.bzp_id)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`)
      const json = await res.json()
      if (json.htmlBody) setTrescHtml(json.htmlBody)
      else setTrescError('Nie udało się pobrać treści — spróbuj otworzyć ogłoszenie bezpośrednio.')
    } catch (e: any) { setTrescError(e.message) }
    setTrescLoading(false)
  }

  async function saveDetail() {
    setSaving(true)
    const tagi = editTagi ? editTagi.split(',').map(t=>t.trim()).filter(Boolean) : null
    const { data: updated } = await supabase.from('przetargi').update({
      status: editStatus, uwagi: editUwagi, priorytet: editPriorytet,
      ocena: editOcena, tagi, przypisany_do: editPrzypisany || null,
    }).eq('id', detail.id).select().single()
    setSaving(false)
    if (updated) onSaved(updated)
  }

  async function updateOcena(ocena: number) {
    setEditOcena(ocena)
    await supabase.from('przetargi').update({ ocena }).eq('id', detail.id)
  }

  // Dokumenty — dodaj URL ręcznie
  async function addDocUrl() {
    if (!newDocUrl.trim()) return
    const label = newDocName.trim() || new URL(newDocUrl).hostname
    const entry = `${label}||${newDocUrl.trim()}`
    const updated = [...dokumenty, entry]
    await supabase.from('przetargi').update({ dokumenty_url: updated }).eq('id', detail.id)
    setDokumenty(updated); setNewDocUrl(''); setNewDocName('')
  }

  // Upload przez API route (service_role, omija RLS)
  // Dla dużych plików (>4MB) - upload bezpośrednio przez supabase client
  async function uploadFiles(files: File[]) {
    if (!files.length) return
    setDocLoading(true); setDocError('')
    const newEntries: string[] = []

    try {
      for (const file of files) {
        const VERCEL_LIMIT = 4 * 1024 * 1024 // 4MB

        if (file.size > VERCEL_LIMIT) {
          // Duży plik — upload bezpośrednio przez supabase client (omija Vercel)
          const safeName = file.name
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
            .substring(0, 100)
          const path = `przetargi/${detail.id}/${Date.now()}_${safeName}`

          const { error } = await supabase.storage
            .from('dokumenty')
            .upload(path, file, {
              contentType: file.type || 'application/octet-stream',
              upsert: true,
            })

          if (error) { setDocError(`${file.name}: ${error.message}`); continue }

          const { data: { publicUrl } } = supabase.storage
            .from('dokumenty').getPublicUrl(path)

          newEntries.push(`${file.name}||${publicUrl}`)
        } else {
          // Mały plik — przez API route (service_role)
          const fd = new FormData()
          fd.append('przetargId', detail.id)
          fd.append('file', file)

          const res = await fetch('/api/przetargi/upload', { method: 'POST', body: fd })
          const text = await res.text()
          let json: any
          try { json = JSON.parse(text) }
          catch { setDocError(`Błąd serwera: ${text.substring(0, 100)}`); continue }

          if (!res.ok || json.error) { setDocError(json.error || `HTTP ${res.status}`); continue }
          if (json.files?.length) newEntries.push(...json.files.map((f: any) => `${f.name}||${f.url}`))
        }
      }

      if (newEntries.length) {
        const updated = [...dokumenty, ...newEntries]
        await supabase.from('przetargi').update({ dokumenty_url: updated }).eq('id', detail.id)
        setDokumenty(updated)
        onSaved({ ...detail, dokumenty_url: updated })
      }
    } catch (e: any) { setDocError(e.message) }
    setDocLoading(false)
  }
  async function uploadFile(file: File) { return uploadFiles([file]) }

  async function removeDoc(idx: number) {
    const updated = dokumenty.filter((_,i) => i !== idx)
    await supabase.from('przetargi').update({ dokumenty_url: updated }).eq('id', detail.id)
    setDokumenty(updated)
  }

  // Parse entry "Nazwa||url" lub samo "url"
  function parseDoc(entry: string): { name: string; url: string } {
    const parts = entry.split('||')
    return parts.length === 2
      ? { name: parts[0], url: parts[1] }
      : { name: entry.split('/').pop() ?? entry, url: entry }
  }

  const branzaKolor = branze.find(b => b.nazwa === detail.branza)?.kolor ?? 'gray'
  const dni = daysTill(detail.data_skladania)
  const headerBg = dni <= 3 ? 'bg-red-50 border-red-100' : dni <= 7 ? 'bg-orange-50 border-orange-100' : dni <= 14 ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-50 border-gray-100'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3" onClick={onClose}>
      {/* max-w-4xl i min-h dla dużego okna */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col"
        style={{ height: 'calc(100vh - 2rem)', maxHeight: '960px' }}
        onClick={e => e.stopPropagation()}>

        {/* ── NAGŁÓWEK ── */}
        <div className={`flex-shrink-0 px-6 py-4 border-b ${headerBg} rounded-t-2xl`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUSY[detail.status]?.color}`}>
                  {STATUSY[detail.status]?.icon} {STATUSY[detail.status]?.label}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ZRODLA[detail.zrodlo]?.color ?? 'bg-gray-100'}`}>
                  {ZRODLA[detail.zrodlo]?.icon} {ZRODLA[detail.zrodlo]?.label}
                </span>
                {detail.branza && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${KOLORY[branzaKolor]}`}>{detail.branza}</span>
                )}
                {detail.miasto && (
                  <span className="text-xs text-gray-500">📍 {detail.miasto}{detail.wojewodztwo ? `, ${WOJEWODZTWA[detail.wojewodztwo] ?? detail.wojewodztwo}` : ''}</span>
                )}
                <TerminBadge data={detail.data_skladania} />
              </div>
              <h2 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2">{detail.tytul}</h2>
              {detail.zamawiajacy && <p className="text-sm text-gray-500 mt-0.5">{detail.zamawiajacy}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => onToggleObserwuj(detail)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${detail.obserwowany ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'border-gray-200 text-gray-500 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700'}`}>
                {detail.obserwowany ? '★ Obserwowany' : '☆ Obserwuj'}
              </button>
              {detail.url_ogloszenia && (
                <a href={detail.url_ogloszenia} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 text-sm hover:bg-blue-50">
                  ↗ BZP
                </a>
              )}
              <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl leading-none">✕</button>
            </div>
          </div>

          {/* Zakładki modalu */}
          <div className="flex gap-1 mt-3 -mb-4 pb-0">
            {[
              { key:'info',        label:'📋 Szczegóły' },
              { key:'tresc',       label:'📄 Treść ogłoszenia' },
              { key:'dokumenty',   label:`📁 Dokumenty (${dokumenty.length})` },
              { key:'pracownicy',  label:'👷 Pracownicy' },
              { key:'ai',          label:'🤖 AI' },
              { key:'czat',        label:'💬 Dyskusja' },
            ].map(t => (
              <button key={t.key} onClick={() => {
                setModalTab(t.key as any)
                if (t.key === 'pracownicy' && !pracownicy.length) loadPracownicy()
              }}
                className={`px-3 py-2 text-xs sm:text-sm rounded-t-lg font-medium border-b-2 transition-colors whitespace-nowrap ${modalTab === t.key ? 'border-gray-900 text-gray-900 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── TREŚĆ ZAKŁADKI (scrollowalna) ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ─ INFO ─ */}
          {modalTab === 'info' && (
            <div className="p-6 space-y-5">
              {/* Info kafelki */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label:'📅 Termin składania', val: <TerminBadge data={detail.data_skladania} /> },
                  { label:'💰 Wartość netto',    val: detail.wartosc_netto ? `${fmt(detail.wartosc_netto)} PLN` : null },
                  { label:'📆 Publikacja',       val: detail.data_publikacji },
                  { label:'🔢 CPV',              val: detail.cpv_kod },
                  { label:'🏢 Zamawiający',      val: detail.zamawiajacy },
                  { label:'📍 Lokalizacja',      val: detail.miasto ? `${detail.miasto}${detail.wojewodztwo ? `, ${WOJEWODZTWA[detail.wojewodztwo]??detail.wojewodztwo}` : ''}` : null },
                ].filter(r => r.val).map(r => (
                  <div key={r.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">{r.label}</p>
                    <div className="text-sm font-medium text-gray-900">{r.val}</div>
                  </div>
                ))}
              </div>

              {/* Link do postępowania */}
              {detail.url_postepowania && detail.url_postepowania !== 'brak' && (
                <a href={detail.url_postepowania} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 transition-colors">
                  <span className="text-2xl">📁</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Otwórz postępowanie — SWZ i dokumenty ↗</p>
                    <p className="text-xs opacity-75 truncate">{detail.url_postepowania}</p>
                  </div>
                </a>
              )}

              {/* Przycisk: Wygrany → Inwestycje */}
              {detail.status === 'wygrany' ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <span className="text-lg">🏆</span>
                  <p className="text-sm text-emerald-700 font-medium">Przetarg wygrany — przeniesiony do Inwestycji</p>
                  <a href="/inwestycje" className="ml-auto text-xs text-emerald-600 hover:underline">Zobacz →</a>
                </div>
              ) : (
                <button onClick={async () => {
                  if (!confirm(`Czy na pewno wygrałeś przetarg?
"${detail.tytul}"

Przetarg zostanie przeniesiony do modułu Inwestycje jako nowa realizacja.`)) return
                  const { data: { user } } = await supabase.auth.getUser()
                  const res = await fetch('/api/przetargi/przenies-do-inwestycji', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ przetargId: detail.id, userId: user?.id }),
                  })
                  const json = await res.json()
                  if (json.ok) {
                    onSaved({ ...detail, status: 'wygrany' })
                    alert('🏆 Przetarg przeniesiony do modułu Inwestycje! Znajdziesz go w zakładce Inwestycje.')
                  } else {
                    alert('Błąd: ' + json.error)
                  }
                }}
                  className="flex items-center gap-3 border-2 border-dashed border-emerald-400 text-emerald-700 px-4 py-3 rounded-xl hover:bg-emerald-50 transition-colors">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <p className="text-sm font-semibold">Wygrałem ten przetarg!</p>
                    <p className="text-xs opacity-70">Przenieś do modułu Inwestycje z pełną dokumentacją</p>
                  </div>
                </button>
              )}

              {/* Ocena */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Ocena przetargu</p>
                <Stars val={editOcena} onChange={updateOcena} />
              </div>

              {/* Pola edycji */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Status</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={inputCls}>
                    {Object.entries(STATUSY).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Priorytet</label>
                  <select value={editPriorytet} onChange={e => setEditPriorytet(parseInt(e.target.value))} className={inputCls}>
                    <option value={0}>— Normalny</option>
                    <option value={1}>🟡 Ważny</option>
                    <option value={2}>🔴 Pilny</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Przypisz do osoby</label>
                <input value={editPrzypisany} onChange={e => setEditPrzypisany(e.target.value)} placeholder="Imię i nazwisko" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tagi (oddzielone przecinkami)</label>
                <input value={editTagi} onChange={e => setEditTagi(e.target.value)} placeholder="np. gazociąg, budowa, pilny" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Notatki</label>
                <textarea value={editUwagi} onChange={e => setEditUwagi(e.target.value)} rows={4}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none bg-white" />
              </div>
            </div>
          )}

          {/* ─ TREŚĆ OGŁOSZENIA ─ */}
          {modalTab === 'tresc' && (
            <div className="p-6">
              {/* Non-BZP: ORLEN Connect, eB2B, inne */}
              {detail.zrodlo !== 'bzp' && !detail.bzp_id && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Treść ogłoszenia</p>
                      <p className="text-xs text-gray-500">Źródło: {ZRODLA[detail.zrodlo]?.label ?? detail.zrodlo}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {detail.url_ogloszenia && (
                        <a href={detail.url_ogloszenia} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50">
                          ↗ {detail.zrodlo === 'connect_orlen' ? 'ORLEN Connect' : detail.zrodlo === 'eb2b' ? 'eB2B' : 'Platforma'}
                        </a>
                      )}
                      {detail.url_ogloszenia && (
                        <button onClick={pobierzTrescOglos} disabled={loadingTrescOglos}
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          {loadingTrescOglos ? '⏳ Pobieranie...' : '⬇ Pobierz treść'}
                        </button>
                      )}
                    </div>
                  </div>
                  {trescOglos ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                      {trescOglos}
                    </div>
                  ) : detail.uwagi ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <p className="text-xs font-medium text-gray-500 mb-2">Dane z importu:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.uwagi}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-8">Kliknij "Pobierz treść" aby załadować ogłoszenie.</p>
                  )}
                </div>
              )}
              {/* BZP */}
              {(detail.zrodlo === 'bzp' || detail.bzp_id) && (
                <>
                  {trescLoading && (
                    <div className="flex items-center justify-center py-16 gap-3">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-500">Pobieranie treści z API BZP...</span>
                    </div>
                  )}
                  {trescError && !trescLoading && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                      <p className="text-sm text-orange-700">⚠ {trescError}</p>
                      <button onClick={fetchTresc} className="text-xs text-orange-600 hover:underline mt-1">Spróbuj ponownie</button>
                    </div>
                  )}
                  {trescHtml && !trescLoading && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-100">
                        <span className="text-xs font-medium text-gray-600">📄 BZP — {detail.bzp_id}</span>
                        <a href={detail.url_ogloszenia ?? '#'} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline">Otwórz w BZP ↗</a>
                      </div>
                      <div className="p-5 text-sm max-h-[60vh] overflow-y-auto" dangerouslySetInnerHTML={{ __html: trescHtml }} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─ DOKUMENTY ─ */}
          {modalTab === 'dokumenty' && (
            <div className="p-6 space-y-5">

              {/* Link do postępowania z dokumentami */}
              {detail.url_postepowania && detail.url_postepowania !== 'brak' ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-green-800 mb-1">✅ Znaleziono link do postępowania</p>
                  <p className="text-xs text-green-700 mb-3">
                    Link wyciągnięty automatycznie z sekcji 3.1 ogłoszenia BZP. Tam znajdziesz SWZ, załączniki i formularz ofertowy.
                  </p>
                  <a href={detail.url_postepowania} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-green-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-green-700 w-full justify-center">
                    📁 Otwórz postępowanie z dokumentami ↗
                  </a>
                  <p className="text-xs text-green-600 mt-1 truncate opacity-75">{detail.url_postepowania}</p>
                </div>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-orange-800 mb-1">ℹ Brak bezpośredniego linku</p>
                  <p className="text-xs text-orange-700 leading-relaxed mb-2">
                    Dokumentacja (SWZ, załączniki) jest na zewnętrznej platformie zamawiającego. Link znajdziesz w treści ogłoszenia — sekcja 3.1.
                  </p>
                  <button onClick={() => setModalTab('tresc')}
                    className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700">
                    📄 Otwórz treść ogłoszenia (sekcja 3.1)
                  </button>
                </div>
              )}

              {/* Lista dokumentów */}
              {dokumenty.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Zapisane dokumenty ({dokumenty.length})</p>
                  <div className="space-y-2">
                    {dokumenty.map((entry, i) => {
                      const { name, url } = parseDoc(entry)
                      const isFile = url.includes('supabase') || !url.startsWith('http')
                      return (
                        <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 group">
                          <span className="text-xl flex-shrink-0">{isFile ? '📎' : '🔗'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                            <p className="text-xs text-gray-400 truncate">{url}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline px-2 py-1 bg-blue-50 rounded">Otwórz</a>
                            <button onClick={() => removeDoc(i)}
                              className="text-xs text-red-500 px-2 py-1 bg-red-50 rounded hover:bg-red-100">Usuń</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Upload pliku */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">📎 Załaduj dokumentację przetargową</p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors bg-blue-50/30">
                  {docLoading
                    ? <div className="flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                        <p className="text-sm text-blue-600 font-medium">Przesyłanie pliku...</p>
                      </div>
                    : <>
                        <p className="text-4xl mb-2">📂</p>
                        <p className="text-sm font-semibold text-blue-700">Kliknij aby załadować dokumenty przetargowe</p>
                        <p className="text-xs text-gray-500 mt-1">SWZ, Formularz ofertowy, OPZ, Wzór umowy, Kosztorys...</p>
                        <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX, XLSX, ZIP — maks. 50 MB</p>
                      </>
                  }
                </div>
                <input ref={fileInputRef} type="file" className="hidden" multiple
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.zip,.rar,.txt,.png,.jpg"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? [])
                    if (files.length) uploadFiles(files)
                    e.target.value = ''
                  }} />
                {docError && <p className="text-xs text-red-600 mt-2 bg-red-50 px-3 py-2 rounded-lg">⚠ {docError}</p>}
              </div>

              {/* Dodaj link */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">🔗 Dodaj link do dokumentu</p>
                <div className="space-y-2">
                  <input value={newDocName} onChange={e => setNewDocName(e.target.value)}
                    placeholder="Nazwa dokumentu (np. SWZ, Formularz ofertowy)" className={inputCls} />
                  <div className="flex gap-2">
                    <input value={newDocUrl} onChange={e => setNewDocUrl(e.target.value)}
                      placeholder="https://platforma-zakupowa.pl/..." className={`${inputCls} flex-1`}
                      onKeyDown={e => e.key === 'Enter' && addDocUrl()} />
                    <button onClick={addDocUrl} disabled={!newDocUrl.trim()}
                      className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-40 flex-shrink-0">
                      Dodaj
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─ AI ─ */}
          {/* ─ PRACOWNICY ─ */}
          {modalTab === 'pracownicy' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Przypisani pracownicy</h3>
                <button onClick={loadPracownicy} className="text-xs text-gray-400 hover:text-gray-600">↺ Odśwież</button>
              </div>
              {loadingPrac ? (
                <p className="text-sm text-gray-400">Ładowanie...</p>
              ) : pracownicy.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400 mb-2">Brak pracowników w bazie.</p>
                  <a href="/inwestycje" className="text-xs text-blue-600 hover:underline">Dodaj pracowników w module Inwestycje →</a>
                </div>
              ) : (
                <div className="space-y-2">
                  {pracownicy.map((p: any) => {
                    const assigned = przypisaniPrac.includes(p.id)
                    return (
                      <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${assigned ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${assigned ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                            {p.imie?.[0]}{p.nazwisko?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{p.imie} {p.nazwisko}</p>
                            <p className="text-xs text-gray-500">{p.stanowisko || '—'}</p>
                          </div>
                        </div>
                        <button onClick={() => togglePracownik(p.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${assigned ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                          {assigned ? '✓ Przypisany' : '+ Przypisz'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─ AI ─ */}
          {modalTab === 'ai' && (
            <AiPrzetarg
              przetarg={detail}
              dokumenty={dokumenty}
            />
          )}

          {/* ─ CZAT ─ */}
          {modalTab === 'czat' && (
            <div className="p-6">
              <CzatPanel modul="przetargi" rekordId={detail.id} rekordTytul={detail.tytul} />
            </div>
          )}
        </div>

        {/* ── FOOTER — zawsze widoczny ── */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-6 py-4 rounded-b-2xl flex items-center justify-between gap-3">
          <button onClick={() => onDeleted(detail.id)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
            🗑 Usuń przetarg
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Zamknij
            </button>
            <button onClick={saveDetail} disabled={saving}
              className="px-6 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium transition-colors">
              {saving ? '⏳ Zapisywanie...' : '💾 Zapisz zmiany'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── STRONA GŁÓWNA ───────────────────────────────────────────────────────────
export default function PrzetargiPage() {
  const supabase = createClient()
  const [przetargi, setPrzetargi]   = useState<Przetarg[]>([])
  const [branze, setBranze]         = useState<Branza[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'lista'|'obserwowane'|'kanban'|'mapa_woj'|'archiwum'|'czat'>('lista')
  const [success, setSuccess]       = useState('')

  // Filtry
  const [search, setSearch]                 = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterBranza, setFilterBranza]     = useState('')
  const [filterWoj, setFilterWoj]           = useState('')
  const [filterDni, setFilterDni]           = useState('')
  const [filterObserwowane, setFilterObserwowane] = useState(false)
  const [sortBy, setSortBy]                 = useState<'data_skladania'|'wartosc_netto'|'tytul'|'created_at'|'data_publikacji'>('data_publikacji')
  const [sortDir, setSortDir]               = useState<'asc'|'desc'>('desc')

  // Checkboxy
  const [zaznaczone, setZaznaczone] = useState<Set<string>>(new Set())

  // Detail modal
  const [detailId, setDetailId] = useState<string|null>(null)

  // Kanban drag & drop
  const [draggedId, setDraggedId] = useState<string|null>(null)
  const [dragOverCol, setDragOverCol] = useState<string|null>(null)

  async function kanbanChangeStatus(id: string, newStatus: string) {
    await supabase.from('przetargi').update({ status: newStatus }).eq('id', id)
    setPrzetargi(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
  }

  // Import
  const [importLoading, setImportLoading] = useState(false)
  const [importInfo, setImportInfo]       = useState('')

  useEffect(() => { fetchAll() }, [])

  // Otwórz przetarg żądany przez asystenta Mala — PO załadowaniu listy.
  // Źródła: localStorage 'przetarg-open' (po nawigacji) lub ?open=ID w URL.
  useEffect(() => {
    if (loading || przetargi.length === 0 || typeof window === 'undefined') return
    const fromLS  = localStorage.getItem('przetarg-open')
    const fromURL = new URLSearchParams(window.location.search).get('open')
    const openId  = fromLS || fromURL
    if (openId && openId !== 'undefined' && przetargi.some(p => p.id === openId)) {
      setDetailId(openId)
      localStorage.removeItem('przetarg-open')
      if (fromURL) window.history.replaceState({}, '', '/przetargi')
    }
  }, [loading, przetargi])

  // Nasłuch zdarzenia — gdy użytkownik jest JUŻ na stronie przetargów
  useEffect(() => {
    function handler(e: Event) {
      const id = (e as CustomEvent).detail as string
      if (id) { setDetailId(id); try { localStorage.removeItem('przetarg-open') } catch {} }
    }
    window.addEventListener('gaz-open-przetarg', handler)
    return () => window.removeEventListener('gaz-open-przetarg', handler)
  }, [])

  // ── Archiwum ─────────────────────────────────────────────────
  const [archiwum, setArchiwum]               = useState<Przetarg[]>([])
  const [archiwumIle, setArchiwumIle]         = useState(0)
  const [archiwumLoading, setArchiwumLoading] = useState(false)
  const [archSearch, setArchSearch]           = useState('')
  const [archZaznaczone, setArchZaznaczone]   = useState<Set<string>>(new Set())

  async function fetchAll() {
    setLoading(true)
    const [{ data: pt }, { data: br }, { count: arch }] = await Promise.all([
      supabase.from('przetargi').select('*')
        .eq('usuniete', false).eq('zarchiwizowany', false)
        .gte('data_skladania', new Date().toISOString().split('T')[0])
        .order('data_publikacji', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('przetargi_branze').select('*').eq('aktywna', true).order('nazwa'),
      supabase.from('przetargi').select('*', { count: 'exact', head: true })
        .eq('usuniete', false).eq('zarchiwizowany', true),
    ])
    if (pt) setPrzetargi(pt)
    if (br) setBranze(br)
    setArchiwumIle(arch ?? 0)
    setLoading(false)
  }

  // Archiwum wczytujemy dopiero przy wejściu w zakładkę — to tysiące rekordów.
  async function loadArchiwum() {
    setArchiwumLoading(true)
    const { data } = await supabase.from('przetargi').select('*')
      .eq('usuniete', false).eq('zarchiwizowany', true)
      .order('data_skladania', { ascending: false })
      .limit(500)
    setArchiwum(data ?? [])
    setArchiwumLoading(false)
  }

  // Ręczne uruchomienie tego samego przesiewu, który codziennie robi cron o 5:30
  async function archiwizujStare() {
    if (!confirm('Przenieść do archiwum przetargi, których termin składania minął ponad 30 dni temu?\n\nObserwowane, zgłoszone i wygrane zostają na liście.')) return
    const { data, error } = await supabase.rpc('przetargi_archiwizuj_stare', { dni: 30, przez: 'recznie' })
    if (error) { setSuccess('⚠ ' + error.message); setTimeout(()=>setSuccess(''),5000); return }
    setSuccess(data > 0 ? `Przeniesiono do archiwum: ${data}.` : 'Nie było nic do archiwizacji.')
    setTimeout(()=>setSuccess(''),4000)
    fetchAll()
  }

  async function archiwizujZaznaczone() {
    const ids = Array.from(zaznaczone)
    await supabase.from('przetargi').update({
      zarchiwizowany: true,
      zarchiwizowany_at: new Date().toISOString(),
      zarchiwizowany_przez: 'recznie',
    }).in('id', ids)
    setPrzetargi(prev => prev.filter(p => !zaznaczone.has(p.id)))
    setArchiwumIle(n => n + ids.length)
    setZaznaczone(new Set())
    setSuccess(`Przeniesiono do archiwum: ${ids.length}.`); setTimeout(()=>setSuccess(''),3000)
  }

  async function przywrocZArchiwum(id: string) {
    const { error } = await supabase.rpc('przetargi_przywroc', { ids: [id] })
    if (error) { setSuccess('⚠ ' + error.message); setTimeout(()=>setSuccess(''),5000); return }
    setArchiwum(prev => prev.filter(p => p.id !== id))
    setArchiwumIle(n => Math.max(0, n - 1))
    setSuccess('Przywrócono na listę.'); setTimeout(()=>setSuccess(''),3000)
    fetchAll()
  }

  const archToggleZaznacz = (id: string) => setArchZaznaczone(prev => { const s = new Set(prev); s.has(id)?s.delete(id):s.add(id); return s })
  const archZaznaczWszystkie = () => setArchZaznaczone(new Set(archFiltered.map(p => p.id)))
  const archOdznaczWszystkie = () => setArchZaznaczone(new Set())

  async function usunArchZaznaczone() {
    if (!confirm(`Usunąć trwale ${archZaznaczone.size} zaznaczonych przetargów z archiwum?`)) return
    const ids = Array.from(archZaznaczone)
    await supabase.from('przetargi').update({ usuniete: true, usuniete_at: new Date().toISOString() }).in('id', ids)
    setArchiwum(prev => prev.filter(p => !archZaznaczone.has(p.id)))
    setArchiwumIle(n => Math.max(0, n - ids.length))
    setArchZaznaczone(new Set())
    setSuccess(`Usunięto ${ids.length} z archiwum.`); setTimeout(()=>setSuccess(''),3000)
  }

  async function przywrocArchZaznaczone() {
    const ids = Array.from(archZaznaczone)
    const { error } = await supabase.rpc('przetargi_przywroc', { ids })
    if (error) { setSuccess('⚠ ' + error.message); setTimeout(()=>setSuccess(''),5000); return }
    setArchiwum(prev => prev.filter(p => !archZaznaczone.has(p.id)))
    setArchiwumIle(n => Math.max(0, n - ids.length))
    setArchZaznaczone(new Set())
    setSuccess(`Przywrócono ${ids.length} przetargów na listę.`); setTimeout(()=>setSuccess(''),3000)
    fetchAll()
  }

  async function toggleObserwuj(p: Przetarg) {
    const nowy = !p.obserwowany
    await supabase.from('przetargi').update({
      obserwowany: nowy,
      status: nowy && p.status === 'nowy' ? 'obserwowany' : p.status,
    }).eq('id', p.id)
    setPrzetargi(prev => prev.map(x => x.id === p.id ? {
      ...x, obserwowany: nowy,
      status: nowy && x.status === 'nowy' ? 'obserwowany' : x.status
    } : x))
  }

  async function deletePrzetarg(id: string) {
    if (!confirm('Usunąć ten przetarg?')) return
    await supabase.from('przetargi').update({ usuniete: true, usuniete_at: new Date().toISOString() }).eq('id', id)
    setPrzetargi(prev => prev.filter(p => p.id !== id))
    setDetailId(null)
    setSuccess('Usunięto.'); setTimeout(() => setSuccess(''), 2000)
  }

  // ── Import z Gmail / ORLEN Connect ───────────────────────────
  const [importMailLoading, setImportMailLoading] = useState(false)
  const [importMailInfo, setImportMailInfo] = useState('')
  const [showMailLog, setShowMailLog] = useState(false)
  const [mailLog, setMailLog] = useState<string[]>([])

  // Czyta etykietę „Przetargi" w Gmailu. Ten sam endpoint wywołuje cron
  // co 2 godziny, więc przycisk służy głównie do sprawdzenia „teraz".
  async function importujZMaili() {
    setImportMailLoading(true)
    setImportMailInfo('🔍 Czytam etykietę Przetargi...')
    setMailLog([])
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setImportMailInfo('⚠ Nie zalogowany'); setImportMailLoading(false); return }

      const res = await fetch('/api/przetargi/import-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const d = await res.json()

      setMailLog(d.log ?? [])

      if (!d.ok) {
        setImportMailInfo('⚠ ' + (d.komunikat ?? d.error ?? `HTTP ${res.status}`))
        setImportMailLoading(false)
        return
      }

      const kontoInfo = d.google_konto ? ` [${d.google_konto}]` : ''
      setImportMailInfo((d.dodano > 0 ? '✅ ' : 'ℹ️ ') + d.komunikat + kontoInfo)
      if (d.dodano > 0) fetchAll()
      if (d.log?.length) setShowMailLog(true)

    } catch (ex: any) {
      setImportMailInfo('⚠ Błąd: ' + ex.message)
    }
    setImportMailLoading(false)
  }

  async function importujBZP() {
    setImportLoading(true); setImportInfo('')
    try {
      const res = await fetch('/api/przetargi/import-bzp', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' })
      const json = await res.json()
      setImportInfo(`✓ Nowych: ${json.nowe ?? 0}, duplikatów: ${json.duplikaty ?? 0}${json.bledy > 0 ? `, błędów: ${json.bledy}` : ''}`)
      fetchAll()
    } catch (ex: any) { setImportInfo(`⚠ ${ex.message}`) }
    setImportLoading(false)
  }

  // Checkboxy
  const toggleZaznacz = (id: string) => setZaznaczone(prev => { const s = new Set(prev); s.has(id)?s.delete(id):s.add(id); return s })
  const zaznaczWszystkie  = () => setZaznaczone(new Set(filtered.map(p => p.id)))
  const odznaczWszystkie  = () => setZaznaczone(new Set())

  async function usunZaznaczone() {
    if (!confirm(`Usunąć ${zaznaczone.size} zaznaczonych przetargów?`)) return
    const ids = Array.from(zaznaczone)
    await supabase.from('przetargi').update({ usuniete: true, usuniete_at: new Date().toISOString() }).in('id', ids)
    setPrzetargi(prev => prev.filter(p => !zaznaczone.has(p.id)))
    setZaznaczone(new Set())
    setSuccess(`Usunięto ${ids.length} przetargów.`); setTimeout(() => setSuccess(''), 3000)
  }

  // Filtrowanie
  const filtered = przetargi.filter(p => {
    const q = search.toLowerCase()
    if (q && !p.tytul.toLowerCase().includes(q) && !(p.zamawiajacy??'').toLowerCase().includes(q) && !(p.miasto??'').toLowerCase().includes(q)) return false
    if (filterStatus && p.status !== filterStatus) return false
    if (filterBranza && p.branza !== filterBranza) return false
    if (filterWoj && p.wojewodztwo !== filterWoj) return false
    if (filterDni && daysTill(p.data_skladania) > parseInt(filterDni)) return false
    if (filterObserwowane && !p.obserwowany) return false
    return true
  }).sort((a,b) => {
    let av: any = a[sortBy], bv: any = b[sortBy]
    if (sortBy==='wartosc_netto'){av=av??0;bv=bv??0}
    if (typeof av==='string') return sortDir==='asc'?av.localeCompare(bv??'','pl'):(bv??'').localeCompare(av,'pl')
    return sortDir==='asc'?(av??0)-(bv??0):(bv??0)-(av??0)
  })

  const archFiltered = archiwum.filter(p => {
    const q = archSearch.toLowerCase()
    if (!q) return true
    return p.tytul.toLowerCase().includes(q) || (p.zamawiajacy ?? '').toLowerCase().includes(q)
  })
  const archWszystkieZaznaczone = archFiltered.length > 0 && archFiltered.every(p => archZaznaczone.has(p.id))
  const archNiektorzeZaznaczone = archZaznaczone.size > 0 && !archWszystkieZaznaczone
  const obserwowane  = przetargi.filter(p => p.obserwowany)
  const alerty       = obserwowane.filter(p => { const d = daysTill(p.data_skladania); return d >= 0 && d <= 7 })
  const detail       = przetargi.find(p => p.id === detailId) ?? archiwum.find(p => p.id === detailId) ?? null
  const woj_stats    = Object.entries(przetargi.reduce((acc,p) => { if(p.wojewodztwo) acc[p.wojewodztwo]=(acc[p.wojewodztwo]??0)+1; return acc }, {} as Record<string,number>)).sort((a,b)=>b[1]-a[1])
  const wszystkieZaznaczone = filtered.length > 0 && filtered.every(p => zaznaczone.has(p.id))
  const niektorzeZaznaczone = zaznaczone.size > 0 && !wszystkieZaznaczone

  function SortBtn({ field, label }: { field: typeof sortBy; label: string }) {
    const active = sortBy === field
    return (
      <button onClick={() => { if(active) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortBy(field); setSortDir('asc') } }}
        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${active?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
        {label} {active?(sortDir==='asc'?'↑':'↓'):''}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        .tooltip-wrap { position:relative; display:inline-flex; }
        .tooltip-wrap .tooltip { position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%); background:#1f2937; color:white; font-size:11px; padding:4px 8px; border-radius:6px; white-space:nowrap; pointer-events:none; opacity:0; transition:opacity 0.15s; z-index:100; }
        .tooltip-wrap:hover .tooltip { opacity:1; }
        .tooltip-wrap .tooltip::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:4px solid transparent; border-top-color:#1f2937; }
      `}</style>
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-14 z-10 shadow-sm">
        <div className="w-full flex items-center justify-between flex-wrap gap-2 md:gap-3">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Przetargi</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {przetargi.length} łącznie · {obserwowane.length} obserwowanych · {filtered.length} widocznych
              {alerty.length > 0 && <span className="ml-2 text-red-600 font-medium">🔥 {alerty.length} kończą się w 7 dni</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/przetargi/branze"
              className="text-sm border border-gray-200 bg-white rounded-lg px-3 py-2 hover:bg-gray-50">
              ⚙ Branże
            </a>
            <button onClick={archiwizujStare}
              className="text-sm border border-gray-200 bg-white rounded-lg px-3 py-2 hover:bg-gray-50"
              title="Przenieś do archiwum przetargi z terminem starszym niż 30 dni">
              📦 Przesiej 30 dni
            </button>
            <button onClick={importujZMaili} disabled={importMailLoading}
              className="text-sm bg-red-600 text-white rounded-lg px-4 py-2 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              title="Wczytaj przetargi z etykiety Przetargi w Gmailu (ORLEN Connect, eB2B). Cron robi to sam co 2 godziny.">
              {importMailLoading ? '⏳ Pobieranie...' : '📧 Z maila'}
            </button>
            <button onClick={importujBZP} disabled={importLoading}
              className="text-sm bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              title="Importuj nowe przetargi z Biuletynu Zamówień Publicznych">
              {importLoading ? '⏳' : '⬇'} BZP
            </button>
          </div>
        </div>
        {importInfo && <p className="mt-2 text-xs text-gray-600 bg-blue-50 px-3 py-1.5 rounded-lg">{importInfo}</p>}
        {importMailInfo && (
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <p className={`text-xs px-3 py-1.5 rounded-lg ${importMailInfo.startsWith('✅') ? 'text-green-700 bg-green-50 border border-green-200' : importMailInfo.startsWith('⚠') ? 'text-red-600 bg-red-50 border border-red-200' : 'text-gray-600 bg-orange-50'}`}>
                {importMailInfo}
              </p>
              {mailLog.length > 0 && (
                <button onClick={() => setShowMailLog(v => !v)}
                  className="ml-2 text-xs text-gray-400 hover:text-gray-700 underline">
                  {showMailLog ? 'Ukryj logi' : `Logi (${mailLog.length})`}
                </button>
              )}
            </div>
            {showMailLog && mailLog.length > 0 && (
              <div className="mt-2 bg-gray-900 text-green-400 rounded-lg p-3 text-xs font-mono max-h-48 overflow-y-auto space-y-0.5">
                {mailLog.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}
          </div>
        )}
        {success    && <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">{success}</p>}
      </div>

      {/* ALERTY */}
      {alerty.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="w-full">
            <p className="text-xs font-semibold text-red-800 mb-2">🔥 Kończące się terminy:</p>
            <div className="flex flex-wrap gap-2">
              {alerty.map(p => (
                <button key={p.id} onClick={() => setDetailId(p.id)}
                  className="text-xs bg-white border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 text-red-700 flex items-center gap-2">
                  <TerminBadge data={p.data_skladania} />
                  <span className="truncate max-w-xs">{p.tytul}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-screen-xl mx-auto px-3 sm:px-4 py-4 overflow-x-hidden">
        {/* ZAKŁADKI */}
        <div className="flex gap-1 mb-5 border-b border-gray-200 overflow-x-auto sticky top-[57px] z-10 bg-white px-4 pt-1 shadow-sm">
          {[
            { key:'lista',       label:`📋 Lista (${filtered.length})` },
            { key:'obserwowane', label:`👁 Obserwowane (${obserwowane.length})` },
            { key:'kanban',      label:'📊 Kanban' },
            { key:'mapa_woj',    label:'🗺 Woj.' },
            { key:'archiwum',    label:`📦 Archiwum (${archiwumIle})` },
            { key:'czat',        label:'💬 Czat' },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key as any); if (t.key === 'archiwum' && !archiwum.length) loadArchiwum() }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab===t.key?'border-gray-900 text-gray-900':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ LISTA ══ */}
        {tab === 'lista' && (
          <>
            {/* Filtry */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 mb-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 Szukaj tytułu, zamawiającego..."
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0 bg-white" style={{ minWidth: '160px' }} />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white flex-1" style={{ minWidth: '120px' }}>
                  <option value="">Wszystkie statusy</option>
                  {Object.entries(STATUSY).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
                <select value={filterBranza} onChange={e => setFilterBranza(e.target.value)} className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white flex-1 hidden sm:block" style={{ minWidth: '120px' }}>
                  <option value="">Wszystkie branże</option>
                  {branze.map(b => <option key={b.id} value={b.nazwa}>{b.nazwa}</option>)}
                </select>
                <select value={filterWoj} onChange={e => setFilterWoj(e.target.value)} className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white flex-1 hidden md:block" style={{ minWidth: '140px' }}>
                  <option value="">Wszystkie woj.</option>
                  {woj_stats.map(([kod,ile]) => (
                    <option key={kod} value={kod}>{WOJEWODZTWA[kod]??kod} ({ile})</option>
                  ))}
                </select>
                <select value={filterDni} onChange={e => setFilterDni(e.target.value)} className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white hidden sm:block">
                  <option value="">Termin</option>
                  <option value="3">≤ 3 dni</option><option value="7">≤ 7 dni</option>
                  <option value="14">≤ 14 dni</option><option value="30">≤ 30 dni</option>
                </select>
                <button onClick={() => setFilterObserwowane(!filterObserwowane)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors flex-shrink-0 ${filterObserwowane?'bg-yellow-50 border-yellow-300 text-yellow-700':'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  ★
                </button>
                {(search||filterStatus||filterBranza||filterWoj||filterDni||filterObserwowane) && (
                  <button onClick={() => { setSearch('');setFilterStatus('');setFilterBranza('');setFilterWoj('');setFilterDni('');setFilterObserwowane(false) }}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 flex-shrink-0">✕</button>
                )}
              </div>
              {/* Dodatkowe filtry na mobile — branże i woj w osobnym wierszu */}
              <div className="flex flex-wrap gap-2 sm:hidden">
                <select value={filterBranza} onChange={e => setFilterBranza(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white flex-1">
                  <option value="">Wszystkie branże</option>
                  {branze.map(b => <option key={b.id} value={b.nazwa}>{b.nazwa}</option>)}
                </select>
                <select value={filterDni} onChange={e => setFilterDni(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                  <option value="">Termin</option>
                  <option value="3">≤ 3 dni</option><option value="7">≤ 7 dni</option>
                  <option value="14">≤ 14 dni</option>
                </select>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Sortuj:</span>
                <SortBtn field="data_publikacji" label="Publikacja" />
                <SortBtn field="data_skladania" label="Termin" />
                <SortBtn field="created_at"     label="Data dodania" />
                <SortBtn field="wartosc_netto"  label="Wartość" />
                <SortBtn field="tytul"          label="A-Z" />
              </div>
            </div>

            {/* Pasek hurtowych akcji — PŁYWAJĄCY, zafiksowany na dole ekranu */}
            {zaznaczone.size > 0 && (
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl"
                   style={{ animation: 'gaz-slideup 0.2s ease-out' }}>
                <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl px-4 py-3"
                     style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-blue-800 flex items-center gap-2 flex-shrink-0">
                      <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">{zaznaczone.size}</span>
                      zaznaczono
                    </span>
                    <button onClick={odznaczWszystkie} className="text-xs text-gray-400 hover:text-gray-700 flex-shrink-0">✕ Odznacz</button>
                    <div className="h-5 w-px bg-gray-200 flex-shrink-0"/>
                    <div className="flex flex-wrap gap-2 flex-1">
                      <button onClick={async () => {
                        const ids = Array.from(zaznaczone)
                        await supabase.from('przetargi').update({ obserwowany: true, status: 'obserwowany' }).in('id', ids)
                        setPrzetargi(prev => prev.map(p => zaznaczone.has(p.id) ? {...p, obserwowany:true, status:'obserwowany'} : p))
                        setZaznaczone(new Set())
                        setSuccess(`Obserwujesz ${ids.length} przetargów.`); setTimeout(()=>setSuccess(''),3000)
                      }} className="flex items-center gap-1.5 text-sm bg-yellow-500 text-white px-3 py-2 rounded-lg hover:bg-yellow-600">
                        ★ Obserwuj
                      </button>
                      <button onClick={async () => {
                        const ids = Array.from(zaznaczone)
                        await supabase.from('przetargi').update({ status: 'zgłoszony' }).in('id', ids)
                        setPrzetargi(prev => prev.map(p => zaznaczone.has(p.id) ? {...p, status:'zgłoszony'} : p))
                        setZaznaczone(new Set()); setSuccess(`Oznaczono ${ids.length} jako Zgłoszone.`); setTimeout(()=>setSuccess(''),3000)
                      }} className="flex items-center gap-1.5 text-sm bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700">
                        📤 Zgłoszone
                      </button>
                      <button onClick={async () => {
                        const ids = Array.from(zaznaczone)
                        await supabase.from('przetargi').update({ priorytet: 2 }).in('id', ids)
                        setPrzetargi(prev => prev.map(p => zaznaczone.has(p.id) ? {...p, priorytet:2} : p))
                        setZaznaczone(new Set()); setSuccess(`Ustawiono priorytet Pilny dla ${ids.length}.`); setTimeout(()=>setSuccess(''),3000)
                      }} className="flex items-center gap-1.5 text-sm bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700">
                        🔴 Pilne
                      </button>
                      <button onClick={async () => {
                        const ids = Array.from(zaznaczone)
                        await supabase.from('przetargi').update({ status: 'pominiety' }).in('id', ids)
                        setPrzetargi(prev => prev.map(p => zaznaczone.has(p.id) ? {...p, status:'pominiety'} : p))
                        setZaznaczone(new Set()); setSuccess(`Pominięto ${ids.length} przetargów.`); setTimeout(()=>setSuccess(''),3000)
                      }} className="flex items-center gap-1.5 text-sm bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600">
                        ⏭ Pomiń
                      </button>
                      <button onClick={archiwizujZaznaczone}
                        className="flex items-center gap-1.5 text-sm bg-slate-600 text-white px-3 py-2 rounded-lg hover:bg-slate-700">
                        📦 Do archiwum
                      </button>
                      <button onClick={usunZaznaczone}
                        className="flex items-center gap-1.5 text-sm bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 ml-auto">
                        🗑 Usuń ({zaznaczone.size})
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-center text-gray-400 py-12">Ładowanie...</p>
            ) : filtered.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-gray-500">Brak przetargów pasujących do filtrów.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Nagłówek zaznacz wszystko */}
                <div className="flex items-center gap-3 px-1 pb-1 border-b border-gray-100">
                  <input type="checkbox"
                    checked={wszystkieZaznaczone}
                    ref={el => { if(el) el.indeterminate = niektorzeZaznaczone }}
                    onChange={() => wszystkieZaznaczone ? odznaczWszystkie() : zaznaczWszystkie()}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                  <span className="text-xs text-gray-400">
                    {wszystkieZaznaczone ? 'Odznacz wszystkie' : `Zaznacz wszystkie (${filtered.length})`}
                  </span>
                </div>

                {filtered.map(p => {
                  const s = STATUSY[p.status] ?? STATUSY.nowy
                  const branzaObj = branze.find(b => b.nazwa === p.branza)
                  const dni = daysTill(p.data_skladania)
                  const urgency = dni<=3?'border-l-red-500':dni<=7?'border-l-orange-400':dni<=14?'border-l-yellow-400':'border-l-transparent'
                  const checked = zaznaczone.has(p.id)
                  return (
                    <div key={p.id}
                      className={`bg-white border border-gray-200 border-l-4 ${urgency} rounded-xl p-3 sm:p-4 hover:border-gray-300 hover:shadow-sm transition-all group ${checked?'ring-2 ring-blue-400':''}` }>
                      <div className="flex items-start gap-2 sm:gap-3">
                        {/* Checkbox */}
                        <div className="flex-shrink-0 pt-1">
                          <input type="checkbox" checked={checked}
                            onChange={e => { e.stopPropagation(); toggleZaznacz(p.id) }}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                        </div>

                        {/* Główna treść */}
                        <div className="flex-1 min-w-0">
                          {/* Badges + akcje w jednym wierszu */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            {/* Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              {p.priorytet >= 2 && <span className="text-xs flex-shrink-0">🔴</span>}
                              {p.priorytet === 1 && <span className="text-xs flex-shrink-0">🟡</span>}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${s.color}`}>{s.icon} <span className="hidden sm:inline">{s.label}</span></span>
                              {branzaObj && <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium hidden sm:inline-block ${KOLORY[branzaObj.kolor]??KOLORY.gray}`}>{p.branza}</span>}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${ZRODLA[p.zrodlo]?.color??'bg-gray-100'}`}>{ZRODLA[p.zrodlo]?.icon}</span>
                            </div>
                            {/* Akcje — zawsze po prawej */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <TerminBadge data={p.data_skladania} />
                              <button onClick={e => { e.stopPropagation(); toggleObserwuj(p) }}
                                className={`p-1 rounded transition-colors text-base ${p.obserwowany?'text-yellow-500':'text-gray-300 hover:text-yellow-400'}`}>
                                {p.obserwowany?'★':'☆'}
                              </button>
                              {p.url_ogloszenia && (
                                <a href={p.url_ogloszenia} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="p-1 rounded text-gray-300 hover:text-blue-500 transition-colors text-xs">↗</a>
                              )}
                              <button onClick={async e => { e.stopPropagation(); if(confirm('Usunąć?')){ await supabase.from('przetargi').update({ usuniete: true, usuniete_at: new Date().toISOString() }).eq('id',p.id); setPrzetargi(prev=>prev.filter(x=>x.id!==p.id)) } }}
                                className="p-1 rounded text-gray-200 hover:text-red-500 transition-colors text-sm" title="Usuń">🗑</button>
                            </div>
                          </div>

                          {/* Tytuł */}
                          <p className="font-medium text-gray-900 leading-snug text-sm sm:text-base group-hover:text-blue-700 transition-colors cursor-pointer"
                            onClick={() => setDetailId(p.id)}>
                            {p.tytul}
                          </p>

                          {/* Meta */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap cursor-pointer" onClick={() => setDetailId(p.id)}>
                            {p.zamawiajacy && <span className="text-xs text-gray-500 truncate max-w-xs">{p.zamawiajacy}</span>}
                            {p.miasto && <span className="text-xs text-gray-400">📍 {p.miasto}</span>}
                            {p.data_skladania && <span className="text-xs text-gray-500 flex-shrink-0 font-medium">📋 złożenie: {new Date(p.data_skladania + 'T12:00:00').toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
                            {p.wartosc_netto && <span className="text-xs font-medium text-gray-600 ml-auto">{fmt(p.wartosc_netto)} PLN</span>}
                          </div>

                          {/* Dodatkowe info — tagi, uwagi, ocena */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {p.tagi?.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{t}</span>)}
                            {(p.dokumenty_url?.length ?? 0) > 0 && (
                              <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">📁 {p.dokumenty_url!.length}</span>
                            )}
                            {p.przypisany_do && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">👤 {p.przypisany_do}</span>}
                            {(p.ocena??0)>0 && <Stars val={p.ocena??0} />}
                          </div>
                          {p.uwagi && <p className="text-xs text-amber-600 mt-1 truncate">📝 {p.uwagi}</p>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ══ OBSERWOWANE ══ */}
        {tab === 'obserwowane' && (
          <div>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              {[
                { label:'Obserwowane aktywne',  val:obserwowane.length,                                    icon:'👁', color:'bg-yellow-50 border-yellow-200' },
                { label:'Kończą się w 7 dni',   val:alerty.length,                                         icon:'🔥', color:'bg-red-50 border-red-200' },
                { label:'Zgłoszone',            val:przetargi.filter(p=>p.status==='zgłoszony').length,    icon:'📤', color:'bg-purple-50 border-purple-200' },
              ].map(k => (
                <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
                  <p className="text-2xl mb-1">{k.icon}</p>
                  <p className="text-2xl font-medium text-gray-900">{k.val}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>
            {obserwowane.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
                <p className="text-4xl mb-3">⭐</p>
                <p className="text-gray-500">Brak obserwowanych przetargów.</p>
                <p className="text-sm text-gray-400 mt-1">Kliknij ★ przy przetargu aby go obserwować.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {obserwowane.sort((a,b)=>daysTill(a.data_skladania)-daysTill(b.data_skladania)).map(p => {
                  const dni = daysTill(p.data_skladania)
                  const urgency = dni<=3?'bg-red-50 border-red-200':dni<=7?'bg-orange-50 border-orange-200':'bg-white border-gray-200'
                  return (
                    <div key={p.id} onClick={() => setDetailId(p.id)}
                      className={`${urgency} border rounded-xl p-4 cursor-pointer hover:shadow-sm transition-all`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUSY[p.status]?.color??''}`}>{STATUSY[p.status]?.icon} {STATUSY[p.status]?.label}</span>
                            {p.miasto && <span className="text-xs text-gray-500">📍 {p.miasto}</span>}
                            {p.przypisany_do && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">👤 {p.przypisany_do}</span>}
                          </div>
                          <p className="font-medium text-gray-900 leading-snug">{p.tytul}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{p.zamawiajacy}</p>
                          {p.uwagi && <p className="text-xs text-amber-600 mt-1">📝 {p.uwagi}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <TerminBadge data={p.data_skladania} />
                          {(p.ocena??0)>0 && <Stars val={p.ocena??0} />}
                          <button onClick={e=>{e.stopPropagation();toggleObserwuj(p)}} className="text-yellow-500 text-lg">★</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ KANBAN ══ */}
        {tab === 'kanban' && (() => {
          // Win-rate stats
          const wygrane = przetargi.filter(p => p.status === 'wygrany').length
          const zamkniete = przetargi.filter(p => ['wygrany','przegrany'].includes(p.status)).length
          const winRate = zamkniete > 0 ? Math.round(wygrane / zamkniete * 100) : null
          const sumaWygranych = przetargi.filter(p => p.status === 'wygrany').reduce((a, p) => a + (p.wartosc_netto ?? 0), 0)
          const sumaZgloszonych = przetargi.filter(p => p.status === 'zgłoszony').reduce((a, p) => a + (p.wartosc_netto ?? 0), 0)

          return (
          <div className="pb-4">
            {/* KPI bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Win-rate', val: winRate !== null ? `${winRate}%` : '—', sub: `${wygrane} / ${zamkniete} zakończonych`, color: winRate !== null && winRate >= 50 ? 'text-green-700' : 'text-orange-600' },
                { label: 'Wartość wygranych', val: sumaWygranych > 0 ? `${fmt(sumaWygranych)} PLN` : '—', sub: `${wygrane} kontraktów`, color: 'text-green-700' },
                { label: 'W toku (złożone)', val: `${fmt(sumaZgloszonych)} PLN`, sub: `${przetargi.filter(p=>p.status==='zgłoszony').length} przetargów`, color: 'text-purple-700' },
                { label: 'Obserwowane', val: `${przetargi.filter(p=>p.status==='obserwowany').length}`, sub: 'do decyzji', color: 'text-yellow-700' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
                  <p className={`text-lg font-bold ${kpi.color}`}>{kpi.val}</p>
                  <p className="text-xs text-gray-400">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Kanban columns */}
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              {Object.entries(STATUSY).map(([statusKey, statusDef]) => {
                const pozycje = przetargi.filter(p => p.status === statusKey && daysTill(p.data_skladania) >= -60)
                const sumaKol = pozycje.reduce((a, p) => a + (p.wartosc_netto ?? 0), 0)
                const isOver = dragOverCol === statusKey
                return (
                  <div key={statusKey}
                    className="flex-shrink-0 w-72"
                    onDragOver={e => { e.preventDefault(); setDragOverCol(statusKey) }}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={e => {
                      e.preventDefault()
                      if (draggedId && draggedId !== statusKey) kanbanChangeStatus(draggedId, statusKey)
                      setDraggedId(null); setDragOverCol(null)
                    }}>
                    {/* Nagłówek kolumny */}
                    <div className={`rounded-xl border px-3 py-2 mb-2 transition-all ${isOver ? 'ring-2 ring-blue-400 ring-offset-1' : ''} ${statusDef.color}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{statusDef.icon} {statusDef.label}</span>
                        <span className="text-xs font-bold bg-white bg-opacity-60 px-1.5 py-0.5 rounded-full">{pozycje.length}</span>
                      </div>
                      {sumaKol > 0 && (
                        <p className="text-xs mt-0.5 opacity-75">{fmt(sumaKol)} PLN</p>
                      )}
                    </div>

                    {/* Strefa drop */}
                    <div className={`min-h-[60px] space-y-2 rounded-xl transition-all ${isOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-dashed p-1' : ''}`}>
                      {pozycje.map(p => (
                        <div key={p.id}
                          draggable
                          onDragStart={e => { setDraggedId(p.id); e.dataTransfer.effectAllowed = 'move' }}
                          onDragEnd={() => { setDraggedId(null); setDragOverCol(null) }}
                          onClick={() => setDetailId(p.id)}
                          className={`bg-white border border-gray-200 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-300 transition-all select-none ${draggedId === p.id ? 'opacity-40 scale-95' : ''}`}>
                          {/* Tytuł */}
                          <p className="text-xs font-medium text-gray-900 leading-snug mb-2">
                            {p.tytul.substring(0, 75)}{p.tytul.length > 75 ? '…' : ''}
                          </p>
                          {/* Meta */}
                          <div className="space-y-1">
                            {p.zamawiajacy && (
                              <p className="text-xs text-gray-400 truncate" title={p.zamawiajacy}>🏛 {p.zamawiajacy.substring(0,35)}{p.zamawiajacy.length>35?'…':''}</p>
                            )}
                            {p.wartosc_netto && (
                              <p className="text-xs font-semibold text-emerald-700">💰 {fmt(p.wartosc_netto)} PLN</p>
                            )}
                            <div className="flex items-center justify-between pt-1">
                              <TerminBadge data={p.data_skladania} />
                              <button onClick={e=>{e.stopPropagation();toggleObserwuj(p)}}
                                className={`text-sm flex-shrink-0 ${p.obserwowany?'text-yellow-400':'text-gray-200 hover:text-yellow-300'}`}>★</button>
                            </div>
                          </div>
                          {/* Drag hint */}
                          <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                            <p className="text-xs text-gray-300">⠿ przeciągnij</p>
                            {(p.ocena??0)>0 && <Stars val={p.ocena??0} />}
                          </div>
                        </div>
                      ))}

                      {pozycje.length === 0 && (
                        <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                          <p className="text-xs text-gray-400">{isOver ? '⬇ Upuść tutaj' : 'Brak'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          )
        })()}

        {/* ══ MAPA WOJEWÓDZTW ══ */}
        {tab === 'mapa_woj' && (
          <div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-6">
              {woj_stats.map(([kod, ile]) => {
                const aktywne = przetargi.filter(p => p.wojewodztwo===kod && daysTill(p.data_skladania)>=0).length
                const obs     = przetargi.filter(p => p.wojewodztwo===kod && p.obserwowany).length
                const pct     = Math.round(ile/(woj_stats[0]?.[1]??1)*100)
                return (
                  <button key={kod} onClick={() => { setFilterWoj(kod); setTab('lista') }}
                    className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all group">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 text-sm group-hover:text-blue-700">{WOJEWODZTWA[kod]??kod}</p>
                        <p className="text-xs text-gray-400">{kod}</p>
                      </div>
                      <span className="text-2xl font-bold text-gray-900">{ile}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width:`${pct}%` }} />
                    </div>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span>✅ {aktywne} aktywnych</span>
                      {obs > 0 && <span>⭐ {obs} obs.</span>}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 text-center">Kliknij województwo aby filtrować listę przetargów</p>
          </div>
        )}

        {/* ══ ARCHIWUM ══ */}
        {tab === 'archiwum' && (
          <div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-slate-700">
                Tu trafiają przetargi, których termin składania minął ponad 30 dni temu. Przesiew robi się
                automatycznie codziennie o 5:30, przed importem z BZP.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Obserwowane, zgłoszone i wygrane nigdy nie są archiwizowane — zostają na liście niezależnie od daty.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input value={archSearch} onChange={e => setArchSearch(e.target.value)}
                placeholder="🔍 Szukaj w archiwum..."
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-52 bg-white" />
              <button onClick={loadArchiwum} disabled={archiwumLoading}
                className="text-sm border border-gray-200 bg-white rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50">
                {archiwumLoading ? '⏳' : '↻'} Odśwież
              </button>
            </div>

            {archiwumLoading ? (
              <p className="text-center text-gray-400 py-12">Ładowanie archiwum...</p>
            ) : archFiltered.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
                <p className="text-4xl mb-3">📦</p>
                <p className="text-gray-500">Archiwum jest puste.</p>
              </div>
            ) : (
              <>
                {/* Nagłówek zaznacz wszystko */}
                <div className="flex items-center gap-3 px-1 pb-2 border-b border-gray-100 mb-1">
                  <input type="checkbox"
                    checked={archWszystkieZaznaczone}
                    ref={el => { if(el) el.indeterminate = archNiektorzeZaznaczone }}
                    onChange={() => archWszystkieZaznaczone ? archOdznaczWszystkie() : archZaznaczWszystkie()}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                  <span className="text-xs text-gray-400">
                    {archWszystkieZaznaczone
                      ? `Odznacz wszystkie (${archFiltered.length})`
                      : `Zaznacz wszystkie (${archFiltered.length})`}
                    {archZaznaczone.size > 0 && <span className="ml-2 text-blue-600 font-medium">· {archZaznaczone.size} zaznaczonych</span>}
                  </span>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                  {archFiltered.map(p => {
                    const checked = archZaznaczone.has(p.id)
                    return (
                      <div key={p.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}>
                        <input type="checkbox" checked={checked}
                          onChange={() => archToggleZaznacz(p.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{p.tytul}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {ZRODLA[p.zrodlo]?.icon ?? '📋'} {ZRODLA[p.zrodlo]?.label ?? p.zrodlo}
                            {' · termin '}{p.data_skladania}
                            {p.zamawiajacy ? ' · ' + p.zamawiajacy.substring(0, 60) : ''}
                          </p>
                        </div>
                        <button onClick={() => setDetailId(p.id)}
                          className="text-xs text-gray-500 hover:text-gray-800 underline whitespace-nowrap">
                          Szczegóły
                        </button>
                        <button onClick={() => przywrocZArchiwum(p.id)}
                          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-white whitespace-nowrap">
                          ↩ Przywróć
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Pływający pasek bulk akcji */}
                {archZaznaczone.size > 0 && (
                  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl"
                       style={{ animation: 'gaz-slideup 0.2s ease-out' }}>
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl px-4 py-3"
                         style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold text-blue-800 flex items-center gap-2 flex-shrink-0">
                          <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">{archZaznaczone.size}</span>
                          zaznaczono
                        </span>
                        <button onClick={archOdznaczWszystkie} className="text-xs text-gray-400 hover:text-gray-700 flex-shrink-0">✕ Odznacz</button>
                        <div className="h-5 w-px bg-gray-200 flex-shrink-0"/>
                        <div className="flex gap-2 flex-wrap flex-1">
                          <button onClick={przywrocArchZaznaczone}
                            className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            ↩ Przywróć ({archZaznaczone.size})
                          </button>
                          <button onClick={usunArchZaznaczone}
                            className="flex items-center gap-1.5 text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 ml-auto">
                            🗑 Usuń ({archZaznaczone.size})
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {archiwum.length >= 500 && (
              <p className="text-xs text-gray-400 text-center mt-3">
                Pokazane 500 najnowszych. Reszta jest w bazie — zawęź wyszukiwaniem.
              </p>
            )}
          </div>
        )}

        {/* ══ CZAT ══ */}
        {tab === 'czat' && <CzatPanel modul="przetargi" />}
      </div>

      {/* ══ MODAL ══ */}
      {detail && (
        <PrzetargModal
          detail={detail}
          branze={branze}
          onClose={() => setDetailId(null)}
          onSaved={updated => setPrzetargi(prev => prev.map(p => p.id===updated.id ? updated : p))}
          onDeleted={id => deletePrzetarg(id)}
          onToggleObserwuj={toggleObserwuj}
        />
      )}

      {/* Floating czat */}
      {tab !== 'czat' && <CzatPanel modul="przetargi" compact />}
    </div>
  )
}
