'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

const TYPY = {
  telefon:   { l:'Telefon',   icon:'📞', bg:'bg-blue-100 text-blue-800' },
  email:     { l:'Email',     icon:'📧', bg:'bg-purple-100 text-purple-800' },
  spotkanie: { l:'Spotkanie', icon:'🤝', bg:'bg-green-100 text-green-800' },
  notatka:   { l:'Notatka',   icon:'📝', bg:'bg-gray-100 text-gray-700' },
  zadanie:   { l:'Zadanie',   icon:'✅', bg:'bg-yellow-100 text-yellow-800' },
  oferta:    { l:'Oferta',    icon:'💼', bg:'bg-orange-100 text-orange-800' },
  inne:      { l:'Inne',      icon:'📌', bg:'bg-gray-100 text-gray-600' },
}
const PRIORYTETY = {
  niski:    { l:'Niski',   dot:'bg-gray-400' },
  normalny: { l:'Normalny',dot:'bg-blue-500' },
  wysoki:   { l:'Wysoki',  dot:'bg-orange-500' },
  pilny:    { l:'Pilny',   dot:'bg-red-600' },
}
const STATUS_ZAD = {
  otwarte:   { l:'Otwarte',    bg:'bg-blue-100 text-blue-700' },
  w_trakcie: { l:'W trakcie',  bg:'bg-yellow-100 text-yellow-700' },
  wykonane:  { l:'Wykonane',   bg:'bg-green-100 text-green-700' },
  anulowane: { l:'Anulowane',  bg:'bg-gray-100 text-gray-500' },
}
const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

function timeAgo(dt: string) {
  const d = new Date(dt), now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'przed chwilą'
  if (diff < 3600) return `${Math.floor(diff/60)} min temu`
  if (diff < 86400) return `${Math.floor(diff/3600)} godz. temu`
  if (diff < 604800) return `${Math.floor(diff/86400)} dni temu`
  return d.toLocaleDateString('pl-PL')
}

export default function CrmPage() {
  const supabase = createClient()
  const [klienci, setKlienci] = useState<any[]>([])
  const [aktywnosci, setAktywnosci] = useState<any[]>([])
  const [zadania, setZadania] = useState<any[]>([])
  const [kontakty, setKontakty] = useState<any[]>([])
  const [inwestycje, setInwestycje] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKlient, setSelectedKlient] = useState<any>(null)
  const [tab, setTab] = useState<'aktywnosci'|'zadania'|'kontakty'>('aktywnosci')
  const [search, setSearch] = useState('')
  const [filterTyp, setFilterTyp] = useState('')
  const [showModalAkt, setShowModalAkt] = useState(false)
  const [showModalZad, setShowModalZad] = useState(false)
  const [showModalKont, setShowModalKont] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)

  // Formularze
  const [fTyp, setFTyp] = useState('telefon')
  const [fKierunek, setFKierunek] = useState('wychodzacy')
  const [fTytul, setFTytul] = useState('')
  const [fTresc, setFTresc] = useState('')
  const [fData, setFData] = useState(new Date().toISOString().slice(0,16))
  const [fDataPlan, setFDataPlan] = useState('')
  const [fStatus, setFStatus] = useState('wykonano')
  const [fPriorytet, setFPriorytet] = useState('normalny')
  const [fKontaktId, setFKontaktId] = useState('')
  const [fInwId, setFInwId] = useState('')

  const [fZTytul, setFZTytul] = useState('')
  const [fZOpis, setFZOpis] = useState('')
  const [fZTermin, setFZTermin] = useState('')
  const [fZStatus, setFZStatus] = useState('otwarte')
  const [fZPriorytet, setFZPriorytet] = useState('normalny')
  const [fZKontakt, setFZKontakt] = useState('')
  const [fZInw, setFZInw] = useState('')

  const [fKImie, setFKImie] = useState('')
  const [fKNazwisko, setFKNazwisko] = useState('')
  const [fKStanowisko, setFKStanowisko] = useState('')
  const [fKTelefon, setFKTelefon] = useState('')
  const [fKEmail, setFKEmail] = useState('')
  const [fKNotatki, setFKNotatki] = useState('')
  const [fKGlowny, setFKGlowny] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: kl }, { data: akt }, { data: zad }, { data: kont }, { data: inw }] = await Promise.all([
      supabase.from('klienci').select('*').order('nazwa'),
      supabase.from('crm_aktywnosci').select('*, kontakty(imie,nazwisko), klienci(nazwa), inwestycje(nazwa)').order('data_aktywnosci', { ascending: false }).limit(200),
      supabase.from('crm_zadania').select('*, kontakty(imie,nazwisko), klienci(nazwa), inwestycje(nazwa)').order('termin').limit(200),
      supabase.from('kontakty').select('*, klienci(nazwa)').order('nazwisko'),
      supabase.from('inwestycje').select('id, nazwa, klient_id').order('nazwa'),
    ])
    setKlienci(kl ?? [])
    setAktywnosci(akt ?? [])
    setZadania(zad ?? [])
    setKontakty(kont ?? [])
    setInwestycje(inw ?? [])
    setLoading(false)
  }

  // Filtrowane dane dla wybranego klienta
  const klientAktywnosci = useMemo(() =>
    aktywnosci.filter(a => !selectedKlient || a.klient_id === selectedKlient.id)
      .filter(a => !filterTyp || a.typ === filterTyp),
    [aktywnosci, selectedKlient, filterTyp])

  const klientZadania = useMemo(() =>
    zadania.filter(z => !selectedKlient || z.klient_id === selectedKlient.id),
    [zadania, selectedKlient])

  const klientKontakty = useMemo(() =>
    kontakty.filter(k => !selectedKlient || k.klient_id === selectedKlient.id),
    [kontakty, selectedKlient])

  const filteredKlienci = useMemo(() =>
    klienci.filter(k => !search || k.nazwa?.toLowerCase().includes(search.toLowerCase()) || k.nip?.includes(search)),
    [klienci, search])

  // Zadania przeterminowane
  const today = new Date().toISOString().split('T')[0]
  const zadaniaPrzeterminowane = zadania.filter(z => z.termin < today && z.status === 'otwarte').length
  const zadaniaOtwarte = zadania.filter(z => z.status === 'otwarte' || z.status === 'w_trakcie').length

  function openAktywnosc(edit?: any) {
    setEditItem(edit ?? null)
    if (edit) {
      setFTyp(edit.typ); setFKierunek(edit.kierunek ?? 'wychodzacy')
      setFTytul(edit.tytul); setFTresc(edit.tresc ?? '')
      setFData(edit.data_aktywnosci?.slice(0,16) ?? '')
      setFDataPlan(edit.data_planowana?.slice(0,16) ?? '')
      setFStatus(edit.status); setFPriorytet(edit.priorytet)
      setFKontaktId(edit.kontakt_id ?? ''); setFInwId(edit.inwestycja_id ?? '')
    } else {
      setFTyp('telefon'); setFKierunek('wychodzacy'); setFTytul(''); setFTresc('')
      setFData(new Date().toISOString().slice(0,16)); setFDataPlan('')
      setFStatus('wykonano'); setFPriorytet('normalny'); setFKontaktId(''); setFInwId('')
    }
    setShowModalAkt(true)
  }

  function openZadanie(edit?: any) {
    setEditItem(edit ?? null)
    if (edit) {
      setFZTytul(edit.tytul); setFZOpis(edit.opis ?? ''); setFZTermin(edit.termin ?? '')
      setFZStatus(edit.status); setFZPriorytet(edit.priorytet)
      setFZKontakt(edit.kontakt_id ?? ''); setFZInw(edit.inwestycja_id ?? '')
    } else {
      setFZTytul(''); setFZOpis(''); setFZTermin(''); setFZStatus('otwarte')
      setFZPriorytet('normalny'); setFZKontakt(''); setFZInw('')
    }
    setShowModalZad(true)
  }

  function openKontakt(edit?: any) {
    setEditItem(edit ?? null)
    if (edit) {
      setFKImie(edit.imie); setFKNazwisko(edit.nazwisko)
      setFKStanowisko(edit.stanowisko ?? ''); setFKTelefon(edit.telefon ?? '')
      setFKEmail(edit.email ?? ''); setFKNotatki(edit.notatki ?? '')
      setFKGlowny(edit.glowny ?? false)
    } else {
      setFKImie(''); setFKNazwisko(''); setFKStanowisko(''); setFKTelefon('')
      setFKEmail(''); setFKNotatki(''); setFKGlowny(false)
    }
    setShowModalKont(true)
  }

  async function saveAktywnosc() {
    if (!fTytul || !selectedKlient) return
    setSaving(true)
    const payload = {
      klient_id: selectedKlient.id,
      typ: fTyp, kierunek: fKierunek, tytul: fTytul, tresc: fTresc || null,
      data_aktywnosci: fData || new Date().toISOString(),
      data_planowana: fDataPlan || null, status: fStatus, priorytet: fPriorytet,
      kontakt_id: fKontaktId || null, inwestycja_id: fInwId || null,
    }
    if (editItem) await supabase.from('crm_aktywnosci').update(payload).eq('id', editItem.id)
    else await supabase.from('crm_aktywnosci').insert(payload)
    setSaving(false); setShowModalAkt(false); loadAll()
  }

  async function saveZadanie() {
    if (!fZTytul || !selectedKlient) return
    setSaving(true)
    const payload = {
      klient_id: selectedKlient.id,
      tytul: fZTytul, opis: fZOpis || null,
      termin: fZTermin || null, status: fZStatus, priorytet: fZPriorytet,
      kontakt_id: fZKontakt || null, inwestycja_id: fZInw || null,
    }
    if (editItem) await supabase.from('crm_zadania').update(payload).eq('id', editItem.id)
    else await supabase.from('crm_zadania').insert(payload)
    setSaving(false); setShowModalZad(false); loadAll()
  }

  async function saveKontakt() {
    if (!fKImie || !fKNazwisko || !selectedKlient) return
    setSaving(true)
    const payload = {
      klient_id: selectedKlient.id,
      imie: fKImie, nazwisko: fKNazwisko, stanowisko: fKStanowisko || null,
      telefon: fKTelefon || null, email: fKEmail || null,
      notatki: fKNotatki || null, glowny: fKGlowny,
    }
    if (editItem) await supabase.from('kontakty').update(payload).eq('id', editItem.id)
    else await supabase.from('kontakty').insert(payload)
    setSaving(false); setShowModalKont(false); loadAll()
  }

  async function deleteItem(table: string, id: string) {
    if (!confirm('Usunąć?')) return
    await supabase.from(table).delete().eq('id', id)
    loadAll()
  }

  async function toggleZadanie(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'wykonane' ? 'otwarte' : 'wykonane'
    await supabase.from('crm_zadania').update({ status: newStatus }).eq('id', id)
    loadAll()
  }

  const klientKontPozSelected = selectedKlient
    ? kontakty.filter(k => k.klient_id === selectedKlient.id)
    : kontakty

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-14 z-10 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">👥 CRM — Zarządzanie relacjami</h1>
            <p className="text-xs text-gray-500">{klienci.length} klientów · {zadaniaOtwarte} otwartych zadań{zadaniaPrzeterminowane > 0 ? ` · ⚠ ${zadaniaPrzeterminowane} przeterminowanych` : ''}</p>
          </div>
          {selectedKlient && (
            <div className="flex items-center gap-2">
              <button onClick={() => openAktywnosc()} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">+ Aktywność</button>
              <button onClick={() => openZadanie()} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">+ Zadanie</button>
              <button onClick={() => openKontakt()} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700">+ Kontakt</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* PANEL KLIENTÓW */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-gray-100">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj klienta..." className={inp + ' text-xs'} />
          </div>
          {/* Przeterminowane zadania */}
          {zadaniaPrzeterminowane > 0 && (
            <button onClick={() => { setSelectedKlient(null); setTab('zadania') }}
              className="mx-3 mt-2 text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg hover:bg-red-100 text-left">
              ⚠ {zadaniaPrzeterminowane} przeterminowanych zadań
            </button>
          )}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <button onClick={() => setSelectedKlient(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!selectedKlient ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>
              <div className="font-medium">🌐 Wszyscy klienci</div>
              <div className={`text-xs ${!selectedKlient ? 'text-blue-200' : 'text-gray-400'}`}>{aktywnosci.length} aktywności</div>
            </button>
            {filteredKlienci.map(k => {
              const akt = aktywnosci.filter(a => a.klient_id === k.id)
              const zad = zadania.filter(z => z.klient_id === k.id && (z.status === 'otwarte' || z.status === 'w_trakcie'))
              const przet = zad.filter(z => z.termin < today)
              const isSelected = selectedKlient?.id === k.id
              return (
                <button key={k.id} onClick={() => setSelectedKlient(k)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{k.nazwa}</span>
                    {przet.length > 0 && <span className="text-xs bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">{przet.length}</span>}
                  </div>
                  <div className={`text-xs flex gap-2 ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                    <span>{akt.length} akt.</span>
                    {zad.length > 0 && <span>{zad.length} zadań</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* PANEL GŁÓWNY */}
        <div className="flex-1 overflow-y-auto">
          {!selectedKlient ? (
            // WIDOK GLOBALNY
            <div className="p-4 max-w-4xl mx-auto space-y-4">
              {/* Zadania otwarte */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="font-semibold text-gray-900">📋 Otwarte zadania ({zadaniaOtwarte})</h2>
                  <select value={''} onChange={() => {}} className="text-xs border border-gray-200 rounded-lg px-2 py-1">
                    <option>Wszystkie</option>
                  </select>
                </div>
                <div className="divide-y divide-gray-100">
                  {zadania.filter(z => z.status === 'otwarte' || z.status === 'w_trakcie').slice(0, 15).map(z => {
                    const przet = z.termin && z.termin < today
                    return (
                      <div key={z.id} className={`px-4 py-3 flex items-start gap-3 hover:bg-gray-50 ${przet ? 'bg-red-50/30' : ''}`}>
                        <button onClick={() => toggleZadanie(z.id, z.status)}
                          className={`w-5 h-5 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${z.status === 'wykonane' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'}`}>
                          {z.status === 'wykonane' && '✓'}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{z.tytul}</p>
                          <div className="flex gap-2 mt-0.5 text-xs flex-wrap">
                            <span className="text-blue-600">{z.klienci?.nazwa}</span>
                            {z.termin && <span className={przet ? 'text-red-600 font-medium' : 'text-gray-500'}>📅 {z.termin}</span>}
                            {z.kontakty && <span className="text-gray-500">👤 {z.kontakty.imie} {z.kontakty.nazwisko}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${PRIORYTETY[z.priorytet as keyof typeof PRIORYTETY]?.dot}`} />
                          <button onClick={() => { setSelectedKlient(klienci.find(k => k.id === z.klient_id)); setTab('zadania'); openZadanie(z) }} className="text-xs text-gray-400 hover:text-gray-600">✏</button>
                        </div>
                      </div>
                    )
                  })}
                  {zadaniaOtwarte === 0 && <p className="text-center py-6 text-gray-400 text-sm">Brak otwartych zadań ✓</p>}
                </div>
              </div>
              {/* Ostatnie aktywności */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">🕐 Ostatnie aktywności</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {aktywnosci.slice(0, 10).map(a => (
                    <div key={a.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50">
                      <span className="text-lg flex-shrink-0">{TYPY[a.typ as keyof typeof TYPY]?.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{a.tytul}</p>
                        <div className="flex gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
                          <span className="text-blue-600">{a.klienci?.nazwa}</span>
                          {a.kontakty && <span>· {a.kontakty.imie} {a.kontakty.nazwisko}</span>}
                          <span>· {timeAgo(a.data_aktywnosci)}</span>
                        </div>
                        {a.tresc && <p className="text-xs text-gray-400 mt-1 truncate">{a.tresc}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${TYPY[a.typ as keyof typeof TYPY]?.bg}`}>{TYPY[a.typ as keyof typeof TYPY]?.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // WIDOK KLIENTA
            <div className="p-4">
              {/* Nagłówek klienta */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedKlient.nazwa}</h2>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                      {selectedKlient.nip && <span>NIP: {selectedKlient.nip}</span>}
                      {selectedKlient.telefon && <span>📞 {selectedKlient.telefon}</span>}
                      {selectedKlient.email && <span>📧 {selectedKlient.email}</span>}
                      {selectedKlient.miasto && <span>📍 {selectedKlient.miasto}</span>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedKlient(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕ Zamknij</button>
                </div>
                {/* Statystyki */}
                <div className="grid grid-cols-4 gap-3 mt-3">
                  {[
                    { l:'Aktywności', v: klientAktywnosci.length, c:'text-blue-700' },
                    { l:'Zadania', v: klientZadania.filter(z => z.status !== 'anulowane').length, c:'text-green-700' },
                    { l:'Kontakty', v: klientKontakty.length, c:'text-purple-700' },
                    { l:'Przeterminowane', v: klientZadania.filter(z => z.termin < today && z.status === 'otwarte').length, c:'text-red-700' },
                  ].map(s => (
                    <div key={s.l} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
                      <p className="text-xs text-gray-500">{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-4">
                {([['aktywnosci','📋 Aktywności'],['zadania','✅ Zadania'],['kontakty','👤 Kontakty']] as const).map(([t, l]) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg ${tab === t ? 'bg-white border border-gray-200 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {l}
                  </button>
                ))}
                {tab === 'aktywnosci' && (
                  <div className="ml-auto flex gap-1">
                    {Object.entries(TYPY).map(([k, v]) => (
                      <button key={k} onClick={() => setFilterTyp(filterTyp === k ? '' : k)}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${filterTyp === k ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {v.icon}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* AKTYWNOŚCI */}
              {tab === 'aktywnosci' && (
                <div className="space-y-2">
                  {klientAktywnosci.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400">
                      <p className="text-4xl mb-2">📝</p>
                      <p>Brak aktywności — kliknij <strong>+ Aktywność</strong></p>
                    </div>
                  ) : klientAktywnosci.map(a => (
                    <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">{TYPY[a.typ as keyof typeof TYPY]?.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-gray-900">{a.tytul}</p>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => openAktywnosc(a)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">✏</button>
                              <button onClick={() => deleteItem('crm_aktywnosci', a.id)} className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50">🗑</button>
                            </div>
                          </div>
                          {a.tresc && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.tresc}</p>}
                          <div className="flex gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full ${TYPY[a.typ as keyof typeof TYPY]?.bg}`}>{TYPY[a.typ as keyof typeof TYPY]?.l}</span>
                            <span>{new Date(a.data_aktywnosci).toLocaleString('pl-PL')}</span>
                            {a.kontakty && <span>👤 {a.kontakty.imie} {a.kontakty.nazwisko}</span>}
                            {a.inwestycje && <span>🏗 {a.inwestycje.nazwa}</span>}
                            {a.kierunek && <span className="text-gray-400">{a.kierunek === 'przychodzacy' ? '↓ przych.' : a.kierunek === 'wychodzacy' ? '↑ wych.' : '↔ wewn.'}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ZADANIA */}
              {tab === 'zadania' && (
                <div className="space-y-2">
                  {klientZadania.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400">
                      <p className="text-4xl mb-2">✅</p><p>Brak zadań — kliknij <strong>+ Zadanie</strong></p>
                    </div>
                  ) : klientZadania.map(z => {
                    const przet = z.termin && z.termin < today && z.status === 'otwarte'
                    return (
                      <div key={z.id} className={`bg-white border rounded-xl p-4 hover:shadow-sm ${przet ? 'border-red-300 bg-red-50/20' : 'border-gray-200'}`}>
                        <div className="flex items-start gap-3">
                          <button onClick={() => toggleZadanie(z.id, z.status)}
                            className={`w-6 h-6 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center text-xs font-bold transition-colors ${z.status === 'wykonane' ? 'bg-green-500 border-green-500 text-white' : przet ? 'border-red-400 hover:border-red-500' : 'border-gray-300 hover:border-blue-400'}`}>
                            {z.status === 'wykonane' ? '✓' : ''}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`font-medium ${z.status === 'wykonane' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{z.tytul}</p>
                              <div className="flex gap-1 flex-shrink-0">
                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORYTETY[z.priorytet as keyof typeof PRIORYTETY]?.dot}`} />
                                <button onClick={() => openZadanie(z)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">✏</button>
                                <button onClick={() => deleteItem('crm_zadania', z.id)} className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50">🗑</button>
                              </div>
                            </div>
                            {z.opis && <p className="text-xs text-gray-500 mt-1">{z.opis}</p>}
                            <div className="flex gap-3 mt-2 text-xs flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full ${STATUS_ZAD[z.status as keyof typeof STATUS_ZAD]?.bg}`}>{STATUS_ZAD[z.status as keyof typeof STATUS_ZAD]?.l}</span>
                              {z.termin && <span className={przet ? 'text-red-600 font-medium' : 'text-gray-500'}>📅 {z.termin}{przet ? ' ⚠ PRZETERMINOWANE' : ''}</span>}
                              {z.kontakty && <span className="text-gray-500">👤 {z.kontakty.imie} {z.kontakty.nazwisko}</span>}
                              {z.inwestycje && <span className="text-gray-500">🏗 {z.inwestycje.nazwa}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* KONTAKTY */}
              {tab === 'kontakty' && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {klientKontakty.length === 0 ? (
                    <div className="col-span-3 bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400">
                      <p className="text-4xl mb-2">👤</p><p>Brak kontaktów — kliknij <strong>+ Kontakt</strong></p>
                    </div>
                  ) : klientKontakty.map(k => (
                    <div key={k.id} className={`bg-white border rounded-2xl p-4 ${k.glowny ? 'border-blue-300 bg-blue-50/20' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">{k.imie?.[0]}{k.nazwisko?.[0]}</div>
                          <div>
                            <p className="font-semibold text-gray-900">{k.imie} {k.nazwisko}</p>
                            {k.stanowisko && <p className="text-xs text-gray-500">{k.stanowisko}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {k.glowny && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Główny</span>}
                          <button onClick={() => openKontakt(k)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">✏</button>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        {k.telefon && <p className="flex items-center gap-2">📞 <a href={`tel:${k.telefon}`} className="hover:text-blue-600">{k.telefon}</a></p>}
                        {k.email && <p className="flex items-center gap-2">📧 <a href={`mailto:${k.email}`} className="hover:text-blue-600 truncate">{k.email}</a></p>}
                        {k.notatki && <p className="text-gray-400 mt-2 border-t border-gray-100 pt-2">{k.notatki}</p>}
                      </div>
                      <div className="mt-3 flex gap-1">
                        <button onClick={() => { openAktywnosc(); setFKontaktId(k.id) }}
                          className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50">📝 Notatka</button>
                        {k.telefon && <a href={`tel:${k.telefon}`} className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 text-center">📞 Zadzwoń</a>}
                        {k.email && <a href={`mailto:${k.email}`} className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 text-center">📧 Email</a>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL AKTYWNOŚĆ */}
      {showModalAkt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex justify-between">
              <h3 className="font-semibold">{editItem ? 'Edytuj aktywność' : 'Dodaj aktywność'}</h3>
              <button onClick={() => setShowModalAkt(false)}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Typ *</label>
                  <select value={fTyp} onChange={e => setFTyp(e.target.value)} className={inp}>
                    {Object.entries(TYPY).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Kierunek</label>
                  <select value={fKierunek} onChange={e => setFKierunek(e.target.value)} className={inp}>
                    <option value="wychodzacy">↑ Wychodzący</option>
                    <option value="przychodzacy">↓ Przychodzący</option>
                    <option value="wewnetrzny">↔ Wewnętrzny</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tytuł *</label>
                <input value={fTytul} onChange={e => setFTytul(e.target.value)} placeholder="np. Rozmowa ws. oferty..." className={inp} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Treść / Notatka</label>
                <textarea value={fTresc} onChange={e => setFTresc(e.target.value)} rows={4}
                  placeholder="Szczegóły rozmowy, ustaleń, następnych kroków..."
                  className={inp + ' resize-none'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data i godzina</label>
                  <input type="datetime-local" value={fData} onChange={e => setFData(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Priorytet</label>
                  <select value={fPriorytet} onChange={e => setFPriorytet(e.target.value)} className={inp}>
                    {Object.entries(PRIORYTETY).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Kontakt (osoba)</label>
                <select value={fKontaktId} onChange={e => setFKontaktId(e.target.value)} className={inp}>
                  <option value="">— brak —</option>
                  {klientKontPozSelected.map(k => <option key={k.id} value={k.id}>{k.imie} {k.nazwisko} {k.stanowisko ? `(${k.stanowisko})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Inwestycja (opcjonalnie)</label>
                <select value={fInwId} onChange={e => setFInwId(e.target.value)} className={inp}>
                  <option value="">— brak —</option>
                  {inwestycje.filter(i => !selectedKlient || i.klient_id === selectedKlient.id || !i.klient_id).map(i => <option key={i.id} value={i.id}>{i.nazwa}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Status</label>
                <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inp}>
                  <option value="wykonano">Wykonano</option>
                  <option value="zaplanowano">Zaplanowano</option>
                  <option value="anulowano">Anulowano</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowModalAkt(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Anuluj</button>
              <button onClick={saveAktywnosc} disabled={!fTytul || saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Zapisuję...' : editItem ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ZADANIE */}
      {showModalZad && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between">
              <h3 className="font-semibold">{editItem ? 'Edytuj zadanie' : 'Nowe zadanie'}</h3>
              <button onClick={() => setShowModalZad(false)}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tytuł *</label>
                <input value={fZTytul} onChange={e => setFZTytul(e.target.value)} placeholder="np. Przygotować ofertę..." className={inp} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Opis</label>
                <textarea value={fZOpis} onChange={e => setFZOpis(e.target.value)} rows={3} className={inp + ' resize-none'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Termin</label>
                  <input type="date" value={fZTermin} onChange={e => setFZTermin(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Priorytet</label>
                  <select value={fZPriorytet} onChange={e => setFZPriorytet(e.target.value)} className={inp}>
                    {Object.entries(PRIORYTETY).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Status</label>
                <select value={fZStatus} onChange={e => setFZStatus(e.target.value)} className={inp}>
                  {Object.entries(STATUS_ZAD).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Kontakt</label>
                <select value={fZKontakt} onChange={e => setFZKontakt(e.target.value)} className={inp}>
                  <option value="">— brak —</option>
                  {klientKontPozSelected.map(k => <option key={k.id} value={k.id}>{k.imie} {k.nazwisko}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Inwestycja</label>
                <select value={fZInw} onChange={e => setFZInw(e.target.value)} className={inp}>
                  <option value="">— brak —</option>
                  {inwestycje.map(i => <option key={i.id} value={i.id}>{i.nazwa}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              {editItem && <button onClick={() => deleteItem('crm_zadania', editItem.id)} className="text-xs text-red-500 mr-auto">🗑 Usuń</button>}
              <button onClick={() => setShowModalZad(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Anuluj</button>
              <button onClick={saveZadanie} disabled={!fZTytul || saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Zapisuję...' : editItem ? 'Zapisz' : 'Dodaj zadanie'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONTAKT */}
      {showModalKont && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between">
              <h3 className="font-semibold">{editItem ? 'Edytuj kontakt' : 'Dodaj osobę kontaktową'}</h3>
              <button onClick={() => setShowModalKont(false)}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 block mb-1">Imię *</label><input value={fKImie} onChange={e => setFKImie(e.target.value)} className={inp} /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Nazwisko *</label><input value={fKNazwisko} onChange={e => setFKNazwisko(e.target.value)} className={inp} /></div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Stanowisko</label><input value={fKStanowisko} onChange={e => setFKStanowisko(e.target.value)} placeholder="np. Kierownik projektu" className={inp} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Telefon</label><input type="tel" value={fKTelefon} onChange={e => setFKTelefon(e.target.value)} className={inp} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Email</label><input type="email" value={fKEmail} onChange={e => setFKEmail(e.target.value)} className={inp} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Notatki</label><textarea value={fKNotatki} onChange={e => setFKNotatki(e.target.value)} rows={2} className={inp + ' resize-none'} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="glowny" checked={fKGlowny} onChange={e => setFKGlowny(e.target.checked)} className="rounded" />
                <label htmlFor="glowny" className="text-sm text-gray-700 cursor-pointer">Główny kontakt w firmie</label>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              {editItem && <button onClick={() => deleteItem('kontakty', editItem.id)} className="text-xs text-red-500 mr-auto">🗑 Usuń</button>}
              <button onClick={() => setShowModalKont(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Anuluj</button>
              <button onClick={saveKontakt} disabled={!fKImie || !fKNazwisko || saving} className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Zapisuję...' : editItem ? 'Zapisz' : 'Dodaj kontakt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
