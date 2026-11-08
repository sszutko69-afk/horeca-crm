'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type DaneFirmy = {
  id: string; klucz: string; wartosc: string; kategoria: string; opis: string
}

type DokumentFirmy = {
  id: string; nazwa: string; kategoria: string; opis: string
  url: string; path: string; rozmiar: number; mime_type: string; aktywny: boolean
}

const KATEGORIE_DANE: Record<string, { label: string; icon: string }> = {
  podstawowe:    { label: 'Dane podstawowe',    icon: '🏢' },
  finansowe:     { label: 'Dane finansowe',      icon: '💰' },
  osoby:         { label: 'Osoby i uprawnienia', icon: '👤' },
  ubezpieczenia: { label: 'Ubezpieczenia',       icon: '🛡' },
  ofertowe:      { label: 'Treści do ofert',     icon: '📝' },
}

const KATEGORIE_DOK: Record<string, { label: string; icon: string }> = {
  referencje:       { label: 'Referencje / Poświadczenia',   icon: '📜' },
  koncesje:         { label: 'Koncesje i zezwolenia',        icon: '✅' },
  ubezpieczenie:    { label: 'Polisa OC',                    icon: '🛡' },
  krs:              { label: 'KRS / Rejestr działalności',   icon: '🏛' },
  uprawnienia:      { label: 'Uprawnienia budowlane',        icon: '👷' },
  bilans:           { label: 'Sprawozdania finansowe',       icon: '📊' },
  certyfikaty:      { label: 'Certyfikaty i normy',          icon: '🏅' },
  wzory_ofert:      { label: 'Wzory dokumentów ofertowych',  icon: '📋' },
  inne:             { label: 'Inne dokumenty',               icon: '📁' },
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(mime: string): string {
  if (mime?.includes('pdf')) return '📕'
  if (mime?.includes('word') || mime?.includes('docx')) return '📘'
  if (mime?.includes('excel') || mime?.includes('xlsx')) return '📗'
  if (mime?.includes('image')) return '🖼'
  if (mime?.includes('zip') || mime?.includes('rar')) return '📦'
  return '📄'
}

export default function UstawieniaPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'dane' | 'dokumenty' | 'powiadomienia'>('dane')

  // Dane firmy
  const [dane, setDane] = useState<DaneFirmy[]>([])
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [daneLoading, setDaneLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [newKlucz, setNewKlucz] = useState('')
  const [newWartosc, setNewWartosc] = useState('')
  const [newKat, setNewKat] = useState('ofertowe')
  const [newOpis, setNewOpis] = useState('')

  // Dokumenty firmy
  const [dokumenty, setDokumenty] = useState<DokumentFirmy[]>([])
  const [dokLoading, setDokLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  // Powiadomienia
  const [notif, setNotif] = useState({ email: '', minWartosc: '0', aktywne: false, godzinyWstecz: '24', raportAktywny: false })
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifMsg, setNotifMsg] = useState<{ typ: 'ok' | 'err'; txt: string } | null>(null)
  const [notifTesting, setNotifTesting] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [newDokNazwa, setNewDokNazwa] = useState('')
  const [newDokKat, setNewDokKat] = useState('inne')
  const [newDokOpis, setNewDokOpis] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadDane(); loadDokumenty(); loadNotif() }, [])

  // ─── DANE ───────────────────────────────────────────────────────────────────
  async function loadDane() {
    const { data } = await supabase.from('firma_dane').select('*').order('kategoria').order('klucz')
    if (data) {
      setDane(data)
      const vals: Record<string, string> = {}
      data.forEach(d => { vals[d.id] = d.wartosc ?? '' })
      setEditValues(vals)
    }
    setDaneLoading(false)
  }

  async function saveDana(item: DaneFirmy) {
    setSaving(item.id)
    await supabase.from('firma_dane').update({
      wartosc: editValues[item.id],
      updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    setDane(prev => prev.map(d => d.id === item.id ? { ...d, wartosc: editValues[item.id] } : d))
    setSuccess('Zapisano!'); setTimeout(() => setSuccess(''), 2000)
    setSaving(null)
  }

  async function deleteDana(id: string) {
    if (!confirm('Usunąć ten wpis?')) return
    await supabase.from('firma_dane').delete().eq('id', id)
    setDane(prev => prev.filter(d => d.id !== id))
  }

  async function addDana() {
    if (!newKlucz.trim() || !newWartosc.trim()) return
    const { data, error } = await supabase.from('firma_dane').insert({
      klucz: newKlucz.trim().toLowerCase().replace(/\s+/g, '_'),
      wartosc: newWartosc.trim(), kategoria: newKat, opis: newOpis.trim(),
    }).select().single()
    if (!error && data) {
      setDane(prev => [...prev, data])
      setEditValues(prev => ({ ...prev, [data.id]: data.wartosc }))
      setNewKlucz(''); setNewWartosc(''); setNewOpis('')
      setSuccess('Dodano!'); setTimeout(() => setSuccess(''), 2000)
    }
  }

  // ─── DOKUMENTY ──────────────────────────────────────────────────────────────
  async function loadDokumenty() {
    const { data } = await supabase.from('firma_dokumenty').select('*').order('kategoria').order('created_at', { ascending: false })
    if (data) setDokumenty(data)
    setDokLoading(false)
  }

  async function uploadDokument() {
    if (!selectedFile) return
    setUploading(true); setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('nazwa', newDokNazwa || selectedFile.name)
      fd.append('kategoria', newDokKat)
      fd.append('opis', newDokOpis)
      const res = await fetch('/api/firma/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error)
      setDokumenty(prev => [json.dokument, ...prev])
      setSelectedFile(null); setNewDokNazwa(''); setNewDokOpis(''); setNewDokKat('inne')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setSuccess('Dokument dodany!'); setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) { setUploadError(e.message) }
    setUploading(false)
  }

  async function toggleAktywny(doc: DokumentFirmy) {
    await supabase.from('firma_dokumenty').update({ aktywny: !doc.aktywny }).eq('id', doc.id)
    setDokumenty(prev => prev.map(d => d.id === doc.id ? { ...d, aktywny: !d.aktywny } : d))
  }

  // ─── POWIADOMIENIA ──────────────────────────────────────────────────────────
  async function loadNotif() {
    setNotifLoading(true)
    const { data } = await supabase.from('firma_dane').select('klucz, wartosc')
      .in('klucz', ['notif_email', 'notif_min_wartosc', 'notif_aktywne', 'notif_godziny_wstecz', 'notif_raport_aktywny'])
    if (data) {
      const m: Record<string, string> = {}
      data.forEach((d: any) => { m[d.klucz] = d.wartosc ?? '' })
      setNotif({
        email: m.notif_email ?? '',
        minWartosc: m.notif_min_wartosc ?? '0',
        aktywne: m.notif_aktywne === 'true',
        godzinyWstecz: m.notif_godziny_wstecz ?? '24',
        raportAktywny: m.notif_raport_aktywny === 'true',
      })
    }
    setNotifLoading(false)
  }

  async function saveNotif() {
    setNotifSaving(true); setNotifMsg(null)
    const wpisy = [
      { klucz: 'notif_email',         wartosc: notif.email,          kategoria: 'powiadomienia', opis: 'Email do powiadomień o przetargach' },
      { klucz: 'notif_min_wartosc',   wartosc: notif.minWartosc,     kategoria: 'powiadomienia', opis: 'Minimalna wartość przetargu (PLN netto)' },
      { klucz: 'notif_aktywne',       wartosc: String(notif.aktywne),kategoria: 'powiadomienia', opis: 'Czy powiadomienia są aktywne' },
      { klucz: 'notif_godziny_wstecz',wartosc: notif.godzinyWstecz,  kategoria: 'powiadomienia', opis: 'Ile godzin wstecz sprawdzać nowe przetargi' },
      { klucz: 'notif_raport_aktywny',wartosc: String(notif.raportAktywny), kategoria: 'powiadomienia', opis: 'Czy raport tygodniowy jest aktywny' },
    ]
    for (const w of wpisy) {
      await supabase.from('firma_dane').upsert(w, { onConflict: 'klucz' })
    }
    setNotifMsg({ typ: 'ok', txt: 'Ustawienia zapisane!' })
    setNotifSaving(false)
    setTimeout(() => setNotifMsg(null), 3000)
  }

  async function testNotif() {
    setNotifTesting(true); setNotifMsg(null)
    try {
      const res = await fetch('/api/przetargi/notyfikacje?manual=1', { method: 'POST' })
      const data = await res.json()
      if (data.sent) setNotifMsg({ typ: 'ok', txt: `✓ Email wysłany! Znaleziono ${data.count} przetargów.` })
      else if (data.reason) setNotifMsg({ typ: 'err', txt: `Nie wysłano: ${data.reason}` })
      else setNotifMsg({ typ: 'err', txt: data.error ?? 'Błąd testu' })
    } catch { setNotifMsg({ typ: 'err', txt: 'Błąd połączenia' }) }
    setNotifTesting(false)
  }

  async function deleteDokument(doc: DokumentFirmy) {
    if (!confirm(`Usunąć "${doc.nazwa}"?`)) return
    await supabase.storage.from('firma').remove([doc.path])
    await supabase.from('firma_dokumenty').delete().eq('id', doc.id)
    setDokumenty(prev => prev.filter(d => d.id !== doc.id))
  }

  const byKatDane = Object.keys(KATEGORIE_DANE).reduce((acc, k) => {
    acc[k] = dane.filter(d => d.kategoria === k)
    return acc
  }, {} as Record<string, DaneFirmy[]>)

  const byKatDok = Object.keys(KATEGORIE_DOK).reduce((acc, k) => {
    acc[k] = dokumenty.filter(d => d.kategoria === k)
    return acc
  }, {} as Record<string, DokumentFirmy[]>)

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
  const aktivneDok = dokumenty.filter(d => d.aktywny).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Dane firmy</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              AI korzysta z tych danych i dokumentów przy generowaniu ofert i dokumentacji przetargowej
            </p>
          </div>
          {success && (
            <span className="text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-xl">✓ {success}</span>
          )}
        </div>

        {/* Zakładki */}
        <div className="flex gap-1 mt-3 -mb-4">
          <button onClick={() => setTab('dane')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'dane' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            🏢 Dane firmy ({dane.length})
          </button>
          <button onClick={() => setTab('dokumenty')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'dokumenty' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            📁 Dokumenty firmy ({dokumenty.length})
            {aktivneDok > 0 && <span className="ml-1.5 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">{aktivneDok} aktywnych</span>}
          </button>
          <button onClick={() => setTab('powiadomienia')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'powiadomienia' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            🔔 Powiadomienia
            {notif.aktywne && <span className="ml-1.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">aktywne</span>}
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-4xl">

        {/* ═══ DANE FIRMY ═══ */}
        {tab === 'dane' && (
          <div className="space-y-4">
            {daneLoading ? <p className="text-gray-400 text-center py-8">Ładowanie...</p> : (
              <>
                {Object.entries(KATEGORIE_DANE).map(([katKey, katMeta]) => {
                  const items = byKatDane[katKey] ?? []
                  return (
                    <div key={katKey} className="bg-white border border-gray-200 rounded-2xl p-5">
                      <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <span>{katMeta.icon}</span>
                        {katMeta.label}
                        <span className="text-xs text-gray-400 font-normal">({items.length})</span>
                      </h2>
                      <div className="space-y-3">
                        {items.map(item => (
                          <div key={item.id} className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              {item.opis && <label className="text-xs text-gray-500 block mb-1">{item.opis}</label>}
                              {(item.wartosc?.length > 80 || ['doswiadczenie','referencje','koncesje','zatrudnienie'].includes(item.klucz)) ? (
                                <textarea value={editValues[item.id] ?? ''} onChange={e => setEditValues(p => ({ ...p, [item.id]: e.target.value }))}
                                  rows={4} className={`${inputCls} resize-y`} placeholder={item.klucz} />
                              ) : (
                                <input value={editValues[item.id] ?? ''} onChange={e => setEditValues(p => ({ ...p, [item.id]: e.target.value }))}
                                  className={inputCls} placeholder={item.klucz} onKeyDown={e => e.key === 'Enter' && saveDana(item)} />
                              )}
                              <p className="text-xs text-gray-300 mt-0.5 font-mono">{item.klucz}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0 mt-6">
                              <button onClick={() => saveDana(item)}
                                disabled={saving === item.id || editValues[item.id] === item.wartosc}
                                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40">
                                {saving === item.id ? '⏳' : '💾'}
                              </button>
                              <button onClick={() => deleteDana(item.id)} className="text-xs text-red-400 hover:text-red-600 px-1.5 py-1.5">🗑</button>
                            </div>
                          </div>
                        ))}
                        {items.length === 0 && <p className="text-xs text-gray-400 italic">Brak wpisów w tej kategorii</p>}
                      </div>
                    </div>
                  )
                })}

                {/* Dodaj nowy wpis */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h2 className="font-semibold text-gray-800 mb-4">➕ Dodaj własny wpis</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Klucz (nazwa zmiennej)</label>
                      <input value={newKlucz} onChange={e => setNewKlucz(e.target.value)} placeholder="np. certyfikat_iso" className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Kategoria</label>
                      <select value={newKat} onChange={e => setNewKat(e.target.value)} className={inputCls}>
                        {Object.entries(KATEGORIE_DANE).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 block mb-1">Opis</label>
                    <input value={newOpis} onChange={e => setNewOpis(e.target.value)} placeholder="np. Numer certyfikatu ISO 9001" className={inputCls} />
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 block mb-1">Wartość</label>
                    <textarea value={newWartosc} onChange={e => setNewWartosc(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Wprowadź wartość..." />
                  </div>
                  <button onClick={addDana} disabled={!newKlucz.trim() || !newWartosc.trim()}
                    className="bg-gray-900 text-white text-sm px-6 py-2.5 rounded-xl hover:bg-gray-700 disabled:opacity-40 font-medium">
                    Dodaj wpis
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ DOKUMENTY FIRMY ═══ */}
        {tab === 'dokumenty' && (
          <div className="space-y-4">
            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">📌 Jak AI używa tych dokumentów?</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Dokumenty oznaczone jako <strong>aktywne</strong> są automatycznie wczytywane przez AI przy generowaniu ofert i dokumentów przetargowych.
                Dodaj tutaj: referencje, polisę OC, koncesje, uprawnienia, wzory oświadczeń — AI będzie z nich korzystać wypełniając dokumenty danymi firmy.
              </p>
            </div>

            {/* Upload nowego dokumentu */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="font-semibold text-gray-800 mb-4">📤 Dodaj dokument firmy</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nazwa dokumentu</label>
                  <input value={newDokNazwa} onChange={e => setNewDokNazwa(e.target.value)}
                    placeholder="np. Polisa OC 2026, Referencja - Gmina X" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Kategoria</label>
                  <select value={newDokKat} onChange={e => setNewDokKat(e.target.value)} className={inputCls}>
                    {Object.entries(KATEGORIE_DOK).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1">Opis (opcjonalnie)</label>
                <input value={newDokOpis} onChange={e => setNewDokOpis(e.target.value)}
                  placeholder="np. Referencja na budowę gazociągu DN200, wartość 1,5 mln PLN" className={inputCls} />
              </div>
              <div className="mb-4">
                <label className="text-xs text-gray-500 block mb-1">Plik</label>
                <div onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'}`}>
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-2xl">{fileIcon(selectedFile.type)}</span>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">{formatSize(selectedFile.size)}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value='' }}
                        className="ml-2 text-gray-400 hover:text-red-500 text-xl">×</button>
                    </div>
                  ) : (
                    <>
                      <p className="text-3xl mb-1">📂</p>
                      <p className="text-sm font-medium text-gray-600">Kliknij aby wybrać plik</p>
                      <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX, XLSX — maks. 50 MB</p>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.txt,.png,.jpg"
                  onChange={e => { const f = e.target.files?.[0]; if(f) { setSelectedFile(f); if(!newDokNazwa) setNewDokNazwa(f.name.replace(/\.[^.]+$/, '')) } }} />
              </div>
              {uploadError && <p className="text-xs text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-lg">⚠ {uploadError}</p>}
              <button onClick={uploadDokument} disabled={!selectedFile || uploading}
                className="bg-blue-600 text-white text-sm px-6 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 font-medium flex items-center gap-2">
                {uploading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Przesyłanie...</> : '📤 Dodaj dokument'}
              </button>
            </div>

            {/* Lista dokumentów */}
            {dokLoading ? <p className="text-center text-gray-400 py-8">Ładowanie...</p> :
             dokumenty.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                <p className="text-4xl mb-2">📁</p>
                <p className="text-gray-500 font-medium">Brak dokumentów firmy</p>
                <p className="text-sm text-gray-400 mt-1">Dodaj referencje, polisę OC, koncesje i inne dokumenty</p>
              </div>
            ) : (
              Object.entries(KATEGORIE_DOK).map(([katKey, katMeta]) => {
                const items = byKatDok[katKey] ?? []
                if (!items.length) return null
                return (
                  <div key={katKey} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                      <span>{katMeta.icon}</span>
                      <span className="font-medium text-sm text-gray-700">{katMeta.label}</span>
                      <span className="text-xs text-gray-400">({items.length})</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {items.map(doc => (
                        <div key={doc.id} className={`flex items-start gap-3 px-5 py-3 transition-colors ${doc.aktywny ? '' : 'opacity-50'}`}>
                          <span className="text-2xl flex-shrink-0 mt-0.5">{fileIcon(doc.mime_type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-900 truncate">{doc.nazwa}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${doc.aktywny ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {doc.aktywny ? '✓ Aktywny (AI widzi)' : 'Nieaktywny'}
                              </span>
                            </div>
                            {doc.opis && <p className="text-xs text-gray-500 mt-0.5">{doc.opis}</p>}
                            <p className="text-xs text-gray-400 mt-0.5">{formatSize(doc.rozmiar)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline px-2 py-1 bg-blue-50 rounded-lg">
                              ↗ Otwórz
                            </a>
                            <button onClick={() => toggleAktywny(doc)}
                              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${doc.aktywny ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                              {doc.aktywny ? '🔕 Wyłącz' : '✓ Włącz'}
                            </button>
                            <button onClick={() => deleteDokument(doc)} className="text-xs text-red-400 hover:text-red-600 px-1.5 py-1">🗑</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ═══ POWIADOMIENIA ═══ */}
        {tab === 'powiadomienia' && (
          <div className="space-y-4">
            {notifLoading ? <p className="text-gray-400 text-center py-8">Ładowanie...</p> : (
              <>
                {/* Status */}
                <div className={`rounded-2xl border p-5 ${notif.aktywne ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-gray-800 text-base">
                        {notif.aktywne ? '🔔 Powiadomienia aktywne' : '🔕 Powiadomienia wyłączone'}
                      </h2>
                      <p className="text-xs text-gray-500 mt-1">
                        System wysyła email codziennie o 7:00 rano jeśli pojawią się nowe przetargi pasujące do Twoich branż.
                      </p>
                    </div>
                    <button onClick={() => setNotif(p => ({ ...p, aktywne: !p.aktywne }))}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${notif.aktywne ? 'bg-blue-600' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${notif.aktywne ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>

                {/* Konfiguracja */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                  <h2 className="font-semibold text-gray-800 flex items-center gap-2">⚙️ Konfiguracja</h2>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
                      Adres email do powiadomień
                    </label>
                    <input type="email" value={notif.email}
                      onChange={e => setNotif(p => ({ ...p, email: e.target.value }))}
                      placeholder="twoj@email.pl" className={inputCls} />
                    <p className="text-xs text-gray-400 mt-1">Na ten adres będą wysyłane powiadomienia o nowych przetargach.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
                        Minimalna wartość przetargu (PLN netto)
                      </label>
                      <input type="number" value={notif.minWartosc} min="0" step="10000"
                        onChange={e => setNotif(p => ({ ...p, minWartosc: e.target.value }))}
                        placeholder="0 = bez limitu" className={inputCls} />
                      <p className="text-xs text-gray-400 mt-1">Pomiń przetargi poniżej tej wartości. 0 = wszystkie.</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
                        Sprawdzaj przetargi z ostatnich (h)
                      </label>
                      <select value={notif.godzinyWstecz}
                        onChange={e => setNotif(p => ({ ...p, godzinyWstecz: e.target.value }))}
                        className={inputCls}>
                        <option value="6">6 godzin</option>
                        <option value="12">12 godzin</option>
                        <option value="24">24 godziny (zalecane)</option>
                        <option value="48">48 godzin</option>
                      </select>
                    </div>
                  </div>

                  {/* Raport tygodniowy */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-700">📊 Raport tygodniowy</p>
                      <p className="text-xs text-gray-500">Podsumowanie sprzedaży, budżetu i przetargów. Wysyłane w każdy poniedziałek o 7:05.</p>
                    </div>
                    <button onClick={() => setNotif(p => ({ ...p, raportAktywny: !p.raportAktywny }))}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ml-3 ${notif.raportAktywny ? 'bg-blue-600' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${notif.raportAktywny ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    <strong>Branże źródłowe:</strong> Powiadomienia dotyczą przetargów pasujących do kodów CPV z Twoich aktywnych branż.
                    Zarządzaj nimi w <a href="/przetargi/branze" className="underline font-medium">Przetargi → Branże</a>.
                  </div>
                </div>

                {/* Akcje */}
                <div className="flex gap-3 items-center flex-wrap">
                  <button onClick={saveNotif} disabled={notifSaving}
                    className="px-5 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-700 disabled:opacity-50 font-medium">
                    {notifSaving ? 'Zapisywanie...' : '💾 Zapisz ustawienia'}
                  </button>
                  <button onClick={testNotif} disabled={notifTesting || !notif.email}
                    className="px-5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-medium">
                    {notifTesting ? '⏳ Wysyłanie...' : '🧪 Wyślij test'}
                  </button>
                  <button onClick={async () => {
                      setNotifTesting(true); setNotifMsg(null)
                      try {
                        const res = await fetch('/api/raporty/tygodniowy?manual=1', { method: 'POST' })
                        const data = await res.json()
                        if (data.sent) setNotifMsg({ typ: 'ok', txt: `✓ Raport tygodniowy wysłany!` })
                        else setNotifMsg({ typ: 'err', txt: data.reason ?? data.error ?? 'Błąd' })
                      } catch { setNotifMsg({ typ: 'err', txt: 'Błąd połączenia' }) }
                      setNotifTesting(false)
                    }} disabled={notifTesting || !notif.email}
                    className="px-5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-medium">
                    {notifTesting ? '⏳' : '📊'} Test raportu
                  </button>
                  <p className="text-xs text-gray-400">Test sprawdza nowe przetargi i wysyła email natychmiast (ignoruje harmonogram).</p>
                </div>

                {notifMsg && (
                  <div className={`px-4 py-3 rounded-xl text-sm font-medium ${notifMsg.typ === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {notifMsg.txt}
                  </div>
                )}

                {/* Info o Resend */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                  <h3 className="font-semibold text-blue-900 text-sm mb-2">📧 Wymagana konfiguracja serwera</h3>
                  <p className="text-xs text-blue-800 mb-2">
                    Powiadomienia email wymagają klucza API serwisu <strong>Resend</strong> (bezpłatne konto: 3000 emaili/miesiąc).
                  </p>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Załóż konto na <a href="https://resend.com" target="_blank" className="underline font-medium">resend.com</a></li>
                    <li>Utwórz klucz API w panelu Resend</li>
                    <li>Dodaj w Vercel: <code className="bg-blue-100 px-1 rounded">RESEND_API_KEY=re_xxxx</code></li>
                    <li>Zweryfikuj domenę nadawcy (lub użyj domeny testowej Resend)</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
