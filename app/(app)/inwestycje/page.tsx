'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import CzatPanel from '@/components/CzatPanel'
import { createClient } from '@/lib/supabase'

// ================================================================
// TYPY
// ================================================================
type Inwestycja = {
  id: string; nazwa: string; typ: string; opis: string | null
  lokalizacja: string | null; data_rozpoczecia: string | null
  data_planowanego_zakonczenia: string | null; data_zakonczenia: string | null
  budzet: number | null; koszt_aktualny: number | null
  status: string; notatki: string | null; dokumenty: string[] | null
}
type Etap = {
  id: string; inwestycja_id: string; nazwa: string; opis: string | null
  data_planowana: string | null; data_realizacji: string | null
  status: string; kanban_kolumna: string; priorytet: number
}
type Koszt = {
  id: string; inwestycja_id: string; nazwa: string; kategoria: string
  kwota: number; data_kosztu: string | null; opis: string | null
  zrodlo: string; infakt_id: string | null
}
type Pracownik = {
  id: string; imie: string; nazwisko: string; stanowisko: string
  uprawnienia: string | null; telefon: string | null; email: string | null
  stawka_godzinowa: number | null; aktywny: boolean; notatki: string | null
}
type EtapPracownik = { id: string; etap_id: string; pracownik_id: string; rola: string; pracownicy?: Pracownik }

// ================================================================
// STAŁE STYLE
// ================================================================
const inp = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'
const lbl = 'text-xs font-medium text-gray-500 uppercase tracking-wide'

const statusColor: Record<string, string> = {
  planowana: 'bg-gray-100 text-gray-600', w_trakcie: 'bg-blue-50 text-blue-700',
  zakonczona: 'bg-green-50 text-green-700', wstrzymana: 'bg-yellow-50 text-yellow-700',
}
const statusLabel: Record<string, string> = {
  planowana: 'Planowana', w_trakcie: 'W trakcie', zakonczona: 'Zakończona', wstrzymana: 'Wstrzymana',
}
const typLabel: Record<string, string> = {
  gazociag: 'Gazociąg', instalacja_sanitarna: 'Instalacja sanitarna', inne: 'Inne',
}
const etapColor: Record<string, string> = {
  planowany: 'bg-gray-100 text-gray-600 border-gray-200',
  w_trakcie: 'bg-blue-50 text-blue-700 border-blue-200',
  zrealizowany: 'bg-green-50 text-green-700 border-green-200',
}
const kanbanKolumny = [
  { id: 'planowany',    label: 'Planowane',   color: 'bg-gray-50 border-gray-200' },
  { id: 'w_trakcie',   label: 'W trakcie',    color: 'bg-blue-50 border-blue-200' },
  { id: 'zrealizowany',label: 'Zrealizowane', color: 'bg-green-50 border-green-200' },
]
const kategorieKosztow = [
  { v: 'materialy',    l: 'Materiały' },
  { v: 'robocizna',   l: 'Robocizna' },
  { v: 'sprzet',      l: 'Sprzęt' },
  { v: 'transport',   l: 'Transport' },
  { v: 'projekt',     l: 'Projekt/dokumentacja' },
  { v: 'inne',        l: 'Inne' },
]

function fmt(n: number) { return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('pl-PL') : '—' }
function progressPct(inv: Inwestycja) {
  if (!inv.budzet || inv.budzet === 0) return 0
  return Math.min(((inv.koszt_aktualny ?? 0) / inv.budzet) * 100, 100)
}

const emptyInw = { nazwa: '', typ: 'gazociag', opis: '', lokalizacja: '', data_rozpoczecia: '', data_planowanego_zakonczenia: '', budzet: '', notatki: '' }

// ================================================================
// KOMPONENT GŁÓWNY
// ================================================================
export default function InwestycjePage() {
  const supabase = createClient()

  // — Dane —
  const [inwestycje, setInwestycje] = useState<Inwestycja[]>([])
  const [etapy, setEtapy] = useState<Etap[]>([])
  const [koszty, setKoszty] = useState<Koszt[]>([])
  const [pracownicy, setPracownicy] = useState<Pracownik[]>([])
  const [etapyPracownicy, setEtapyPracownicy] = useState<EtapPracownik[]>([])
  const [loading, setLoading] = useState(true)

  // — Widok —
  const [activeTab, setActiveTab] = useState<'lista'|'kanban'>('lista')
  const [kanbanInwId, setKanbanInwId] = useState<string>('wszystkie')
  const [filterTyp, setFilterTyp] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // — Stany UI —
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // — Modale —
  const [showFormInw, setShowFormInw] = useState(false)
  const [formInw, setFormInw] = useState(emptyInw)
  const [savingInw, setSavingInw] = useState(false)
  const [editInw, setEditInw] = useState<Inwestycja | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteInwId, setDeleteInwId] = useState<string | null>(null)

  // — Panel inwestycji (boczny drawer) —
  const [openInwId, setOpenInwId] = useState<string | null>(null)
  const openInw = inwestycje.find(i => i.id === openInwId) ?? null

  // — Etapy —
  const [newEtap, setNewEtap] = useState({ nazwa: '', data_planowana: '', opis: '' })
  const [etapSaving, setEtapSaving] = useState(false)
  const [etapPracownikModal, setEtapPracownikModal] = useState<string | null>(null)

  // — Koszty —
  const [showKosztyPanel, setShowKosztyPanel] = useState<string | null>(null)
  const [newKoszt, setNewKoszt] = useState({ nazwa: '', kategoria: 'materialy', kwota: '', data_kosztu: '', opis: '' })
  const [kosztSaving, setKosztSaving] = useState(false)
  const [infaktLoading, setInfoktLoading] = useState(false)

  // — Koszty z czasu pracy —
  const [czasyPracy, setCzasyPracy] = useState<any[]>([])
  const [czasyPracyLoading, setCzasyPracyLoading] = useState(false)
  const [czasyPracyImportLoading, setCzasyPracyImportLoading] = useState(false)

  // Pracownicy zarządzani z modułu KADRY (/kadry)

  // — Drag & drop kanban —
  const dragEtap = useRef<string | null>(null)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => {
    if (showKosztyPanel) fetchCzasyPracy(showKosztyPanel)
    else setCzasyPracy([])
  }, [showKosztyPanel])

  async function fetchAll() {
    setLoading(true)
    const [{ data: inv }, { data: et }, { data: kos }, { data: prac }, { data: ep }] = await Promise.all([
      // Inwestycja zaczyna żyć — wchodzić do zestawień, kosztów i raportów —
      // dopiero po akceptacji. Oczekujące widać w module Akceptacje.
      supabase.from('inwestycje').select('*').eq('stan_akceptacji','zaakceptowany').order('created_at', { ascending: false }),
      supabase.from('inwestycje_etapy').select('*').order('priorytet').order('data_planowana'),
      supabase.from('inwestycje_koszty').select('*').order('data_kosztu', { ascending: false }),
      supabase.from('pracownicy').select('*').order('nazwisko'),
      supabase.from('etapy_pracownicy').select('*, pracownicy(*)'),
    ])
    if (inv) setInwestycje(inv)
    if (et) setEtapy(et)
    if (kos) setKoszty(kos)
    if (prac) setPracownicy(prac)
    if (ep) setEtapyPracownicy(ep as EtapPracownik[])
    setLoading(false)
  }

  function showSuccess(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  async function fetchCzasyPracy(inwId: string) {
    setCzasyPracyLoading(true)
    // Tylko zatwierdzone godziny wchodzą do kosztów inwestycji
    const { data } = await supabase.from('czas_pracy')
      .select('*,pracownicy(imie,nazwisko)')
      .eq('inwestycja_id', inwId)
      .eq('stan_akceptacji', 'zaakceptowany')
      .order('data', { ascending: false })
    setCzasyPracy(data ?? [])
    setCzasyPracyLoading(false)
  }

  async function importujKosztyCzasuPracy(inwId: string) {
    setCzasyPracyImportLoading(true)
    const czasyDoImportu = czasyPracy.filter(w => (+w.koszt_calkowity || 0) > 0)
    let dodano = 0
    for (const w of czasyDoImportu) {
      const prac = (w.pracownicy as any)
      const nazwa = `Praca: ${prac?.imie ?? ''} ${prac?.nazwisko ?? ''} — ${w.data}`
      const { error } = await supabase.from('inwestycje_koszty').insert({
        inwestycja_id: inwId,
        nazwa,
        kategoria: 'robocizna',
        kwota: +w.koszt_calkowity,
        data_kosztu: w.data,
        opis: `${w.godziny}h${w.delegacja ? ' + delegacja' : ''}${w.opis ? ' · ' + w.opis : ''}`,
        zrodlo: 'czas_pracy',
      })
      if (!error) dodano++
    }
    await fetchAll()
    setCzasyPracyImportLoading(false)
    showSuccess(dodano > 0 ? `Przeniesiono ${dodano} wpisów do kosztów inwestycji` : 'Brak wpisów z kosztem do importu')
  }

  // ── Inwestycje CRUD ──────────────────────────────────────
  async function handleAddInw(e: React.FormEvent) {
    e.preventDefault(); setSavingInw(true); setError('')
    const { error } = await supabase.from('inwestycje').insert({
      nazwa: formInw.nazwa.trim(), typ: formInw.typ,
      opis: formInw.opis.trim() || null, lokalizacja: formInw.lokalizacja.trim() || null,
      data_rozpoczecia: formInw.data_rozpoczecia || null,
      data_planowanego_zakonczenia: formInw.data_planowanego_zakonczenia || null,
      budzet: formInw.budzet ? parseFloat(formInw.budzet) : null,
      notatki: formInw.notatki.trim() || null, status: 'planowana',
    })
    if (error) setError('Błąd: ' + error.message)
    else { showSuccess('Inwestycja dodana!'); setFormInw(emptyInw); setShowFormInw(false); fetchAll() }
    setSavingInw(false)
  }

  async function handleEditInw(e: React.FormEvent) {
    e.preventDefault(); if (!editInw) return; setEditSaving(true)
    await supabase.from('inwestycje').update({
      nazwa: editInw.nazwa, typ: editInw.typ, opis: editInw.opis, lokalizacja: editInw.lokalizacja,
      data_rozpoczecia: editInw.data_rozpoczecia, data_planowanego_zakonczenia: editInw.data_planowanego_zakonczenia,
      budzet: editInw.budzet, status: editInw.status, notatki: editInw.notatki,
    }).eq('id', editInw.id)
    setEditInw(null); fetchAll(); setEditSaving(false); showSuccess('Zapisano!')
  }

  async function handleDeleteInw() {
    if (!deleteInwId) return
    await supabase.from('inwestycje').delete().eq('id', deleteInwId)
    setDeleteInwId(null); setOpenInwId(null); fetchAll()
  }

  // ── Etapy ────────────────────────────────────────────────
  async function handleAddEtap(e: React.FormEvent) {
    e.preventDefault(); if (!openInwId) return; setEtapSaving(true)
    await supabase.from('inwestycje_etapy').insert({
      inwestycja_id: openInwId, nazwa: newEtap.nazwa.trim(),
      opis: newEtap.opis.trim() || null, data_planowana: newEtap.data_planowana || null,
      status: 'planowany', kanban_kolumna: 'planowany',
    })
    setNewEtap({ nazwa: '', data_planowana: '', opis: '' })
    fetchAll(); setEtapSaving(false)
  }

  async function zakonczEtap(etap: Etap) {
    await supabase.from('inwestycje_etapy').update({
      status: 'zrealizowany', kanban_kolumna: 'zrealizowany',
      data_realizacji: new Date().toISOString().split('T')[0],
    }).eq('id', etap.id)
    fetchAll(); showSuccess(`Etap "${etap.nazwa}" zakończony!`)
  }

  async function toggleEtap(etap: Etap) {
    const next = etap.status === 'planowany' ? 'w_trakcie' : etap.status === 'w_trakcie' ? 'zrealizowany' : 'planowany'
    const upd: Record<string, string | null> = { status: next, kanban_kolumna: next }
    if (next === 'zrealizowany') upd.data_realizacji = new Date().toISOString().split('T')[0]
    else upd.data_realizacji = null
    await supabase.from('inwestycje_etapy').update(upd).eq('id', etap.id)
    fetchAll()
  }

  async function deleteEtap(id: string) {
    await supabase.from('inwestycje_etapy').delete().eq('id', id)
    fetchAll()
  }

  // ── Kanban drag & drop ───────────────────────────────────
  async function onDropKanban(kolumna: string) {
    if (!dragEtap.current) return
    const upd: Record<string, string | null> = { kanban_kolumna: kolumna, status: kolumna }
    if (kolumna === 'zrealizowany') upd.data_realizacji = new Date().toISOString().split('T')[0]
    else upd.data_realizacji = null
    await supabase.from('inwestycje_etapy').update(upd).eq('id', dragEtap.current)
    dragEtap.current = null
    fetchAll()
  }

  // ── Koszty ───────────────────────────────────────────────
  async function handleAddKoszt(e: React.FormEvent) {
    e.preventDefault(); if (!showKosztyPanel) return; setKosztSaving(true)
    await supabase.from('inwestycje_koszty').insert({
      inwestycja_id: showKosztyPanel, nazwa: newKoszt.nazwa.trim(),
      kategoria: newKoszt.kategoria, kwota: parseFloat(newKoszt.kwota) || 0,
      data_kosztu: newKoszt.data_kosztu || null, opis: newKoszt.opis.trim() || null, zrodlo: 'reczny',
    })
    setNewKoszt({ nazwa: '', kategoria: 'materialy', kwota: '', data_kosztu: '', opis: '' })
    fetchAll(); setKosztSaving(false); showSuccess('Koszt dodany!')
  }

  async function deleteKoszt(id: string) {
    await supabase.from('inwestycje_koszty').delete().eq('id', id)
    fetchAll()
  }

  async function zaciagnijZInfakt(inwId: string) {
    const inw = inwestycje.find(i => i.id === inwId)
    if (!inw) return
    setInfoktLoading(true)
    try {
      // Zaciągamy faktury z inFakt po nazwie inwestycji (search w description)
      const res = await fetch(`/api/infakt/faktury?search=${encodeURIComponent(inw.nazwa)}`)
      if (res.ok) {
        const data = await res.json()
        const faktury = data.entities ?? []
        let added = 0
        for (const f of faktury) {
          // Sprawdź czy już nie ma
          const exists = koszty.some(k => k.infakt_id === String(f.id))
          if (!exists) {
            await supabase.from('inwestycje_koszty').insert({
              inwestycja_id: inwId, nazwa: f.client_company_name ?? f.number ?? 'Faktura inFakt',
              kategoria: 'materialy', kwota: (f.gross_price ?? 0) / 100,
              data_kosztu: f.sell_date ?? null, opis: `Faktura ${f.number ?? ''}`,
              zrodlo: 'infakt', infakt_id: String(f.id),
            })
            added++
          }
        }
        fetchAll()
        showSuccess(added > 0 ? `Zaciągnięto ${added} faktur z inFakt` : 'Brak nowych faktur w inFakt dla tej inwestycji')
      } else {
        showSuccess('Brak połączenia z inFakt — sprawdź konfigurację API')
      }
    } catch {
      showSuccess('Błąd połączenia z inFakt')
    }
    setInfoktLoading(false)
  }

  // ── Przypisanie pracownika do etapu ─────────────────────
  async function togglePracownikEtap(etapId: string, pracId: string) {
    const exists = etapyPracownicy.find(ep => ep.etap_id === etapId && ep.pracownik_id === pracId)
    if (exists) {
      await supabase.from('etapy_pracownicy').delete().eq('id', exists.id)
    } else {
      await supabase.from('etapy_pracownicy').insert({ etap_id: etapId, pracownik_id: pracId })
    }
    fetchAll()
  }

  // ── Computed ─────────────────────────────────────────────
  const filtered = inwestycje.filter(i =>
    (filterTyp ? i.typ === filterTyp : true) &&
    (filterStatus ? i.status === filterStatus : true)
  )

  const statCounts = {
    planowana: inwestycje.filter(i => i.status === 'planowana').length,
    w_trakcie: inwestycje.filter(i => i.status === 'w_trakcie').length,
    zakonczona: inwestycje.filter(i => i.status === 'zakonczona').length,
    budzet: inwestycje.reduce((a, i) => a + (i.budzet ?? 0), 0),
    koszt: inwestycje.reduce((a, i) => a + (i.koszt_aktualny ?? 0), 0),
  }

  const kanbanEtapy = kanbanInwId === 'wszystkie'
    ? etapy
    : etapy.filter(e => e.inwestycja_id === kanbanInwId)

  // ================================================================
  // RENDER
  // ================================================================
  function renderKosztyPanel() {
    if (!showKosztyPanel) return null
        const inw = inwestycje.find(i => i.id === showKosztyPanel)
        const invKoszty = koszty.filter(k => k.inwestycja_id === showKosztyPanel)
        const sumaKoszty = invKoszty.reduce((a, k) => a + k.kwota, 0)
        const sumaCzasyPracy = czasyPracy.reduce((a, w) => a + (+w.koszt_calkowity || 0), 0)
        const sumaLaczna = sumaKoszty + sumaCzasyPracy
        return (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-200 w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>
              {/* Header */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Koszty — {inw?.nazwa}</h2>
                    <div className="text-xs text-gray-500 mt-0.5 space-x-3">
                      <span>Materiały/inne: <strong className="text-amber-700">{fmt(sumaKoszty)} zł</strong></span>
                      {sumaCzasyPracy > 0 && <span>Robocizna: <strong className="text-blue-700">{fmt(sumaCzasyPracy)} zł</strong></span>}
                      <span>Łącznie: <strong className="text-gray-900">{fmt(sumaLaczna)} zł</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => zaciagnijZInfakt(showKosztyPanel)}
                      disabled={infaktLoading}
                      className="text-xs px-3 py-1.5 border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50 flex items-center gap-1.5">
                      {infaktLoading ? '⏳ Ładowanie...' : '📥 Zaciągnij z inFakt'}
                    </button>
                    <button onClick={() => setShowKosztyPanel(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
                  </div>
                </div>
              </div>

              {/* Lista kosztów */}
              <div className="flex-1 overflow-y-auto p-5">
                {invKoszty.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Brak kosztów — dodaj poniżej lub zaciągnij z inFakt.</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {/* Grupowanie po kategorii */}
                    {kategorieKosztow.map(kat => {
                      const katKoszty = invKoszty.filter(k => k.kategoria === kat.v)
                      if (katKoszty.length === 0) return null
                      const katSuma = katKoszty.reduce((a, k) => a + k.kwota, 0)
                      return (
                        <div key={kat.v}>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{kat.l}</p>
                            <p className="text-xs font-medium text-gray-700">{fmt(katSuma)} zł</p>
                          </div>
                          {katKoszty.map(k => (
                            <div key={k.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 hover:bg-gray-50 mb-1">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 font-medium">{k.nazwa}</p>
                                <div className="flex gap-2 text-xs text-gray-400">
                                  {k.data_kosztu && <span>{fmtDate(k.data_kosztu)}</span>}
                                  {k.zrodlo === 'infakt' && <span className="text-orange-600">inFakt</span>}
                                  {k.opis && <span className="truncate max-w-xs">{k.opis}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-3">
                                <span className="text-sm font-semibold text-amber-700">{fmt(k.kwota)} zł</span>
                                <button onClick={() => deleteKoszt(k.id)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Koszty z czasu pracy */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      👷 Robocizna z czasu pracy
                      {czasyPracyLoading && <span className="ml-2 text-gray-300 font-normal">ładowanie…</span>}
                    </p>
                    {czasyPracy.length > 0 && sumaCzasyPracy > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-blue-700">{fmt(sumaCzasyPracy)} zł</span>
                        <button
                          onClick={() => importujKosztyCzasuPracy(showKosztyPanel!)}
                          disabled={czasyPracyImportLoading}
                          className="text-xs px-2 py-1 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50">
                          {czasyPracyImportLoading ? '⏳' : '⬇ Przenieś do kosztów'}
                        </button>
                      </div>
                    )}
                  </div>
                  {czasyPracy.length === 0 && !czasyPracyLoading && (
                    <p className="text-xs text-gray-400 py-2">Brak wpisów czasu pracy przypisanych do tej inwestycji.<br/>W module Czas pracy — przy dodawaniu wpisu wybierz tę inwestycję.</p>
                  )}
                  {czasyPracy.length > 0 && (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {czasyPracy.map((w: any) => {
                        const prac = w.pracownicy as any
                        return (
                          <div key={w.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg border border-blue-100 bg-blue-50">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800">{prac?.imie} {prac?.nazwisko}</p>
                              <p className="text-xs text-gray-400">{w.data} · {w.godziny}h{w.delegacja ? ' + delegacja' : ''}{w.opis ? ' · ' + w.opis : ''}</p>
                            </div>
                            <span className="text-xs font-semibold text-blue-700 ml-3">{fmt(+w.koszt_calkowity || 0)} zł</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Formularz nowego kosztu */}
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dodaj koszt ręcznie</h3>
                  <form onSubmit={handleAddKoszt}>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="col-span-2">
                        <label className={lbl}>Nazwa kosztu</label>
                        <input value={newKoszt.nazwa} onChange={e => setNewKoszt(n => ({...n, nazwa: e.target.value}))}
                          placeholder="np. Rury stalowe DN200, Koparka CAT..." required className={inp + ' mt-1'} />
                      </div>
                      <div>
                        <label className={lbl}>Kategoria</label>
                        <select value={newKoszt.kategoria} onChange={e => setNewKoszt(n => ({...n, kategoria: e.target.value}))} className={inp + ' mt-1'}>
                          {kategorieKosztow.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>Kwota [zł]</label>
                        <input type="number" value={newKoszt.kwota} onChange={e => setNewKoszt(n => ({...n, kwota: e.target.value}))}
                          placeholder="0.00" min="0" step="0.01" required className={inp + ' mt-1'} />
                      </div>
                      <div>
                        <label className={lbl}>Data</label>
                        <input type="date" value={newKoszt.data_kosztu} onChange={e => setNewKoszt(n => ({...n, data_kosztu: e.target.value}))} className={inp + ' mt-1'} />
                      </div>
                      <div>
                        <label className={lbl}>Opis (opcjonalnie)</label>
                        <input value={newKoszt.opis} onChange={e => setNewKoszt(n => ({...n, opis: e.target.value}))}
                          placeholder="Nr faktury, notatka..." className={inp + ' mt-1'} />
                      </div>
                    </div>
                    <button type="submit" disabled={kosztSaving}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50">
                      {kosztSaving ? 'Zapisuję...' : '+ Dodaj koszt'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )
  }

  function renderEtapPracownikModal() {
    if (!etapPracownikModal) return null
        const et = etapy.find(e => e.id === etapPracownikModal)
        const inv = et ? inwestycje.find(i => i.id === et.inwestycja_id) : null
        const przypisani = etapyPracownicy.filter(ep => ep.etap_id === etapPracownikModal).map(ep => ep.pracownik_id)
        return (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 w-full max-w-md" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Przypisz pracowników</h2>
                  <p className="text-xs text-gray-500">{et?.nazwa} · {inv?.nazwa}</p>
                </div>
                <button onClick={() => setEtapPracownikModal(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
              </div>
              <div className="space-y-2">
                {pracownicy.filter(p => p.aktywny).map(p => {
                  const przypisany = przypisani.includes(p.id)
                  return (
                    <button key={p.id} onClick={() => togglePracownikEtap(etapPracownikModal, p.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${przypisany ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className="text-left">
                        <p className={`text-sm font-medium ${przypisany ? 'text-blue-900' : 'text-gray-900'}`}>{p.imie} {p.nazwisko}</p>
                        <p className="text-xs text-gray-500">{p.stanowisko}{p.uprawnienia ? ` · ${p.uprawnienia}` : ''}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${przypisany ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                        {przypisany && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                    </button>
                  )
                })}
                {pracownicy.filter(p => p.aktywny).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Brak aktywnych pracowników — dodaj w zakładce Pracownicy.</p>
                )}
              </div>
              <button onClick={() => setEtapPracownikModal(null)} className="w-full mt-4 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Zamknij</button>
            </div>
          </div>
        )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Inwestycje</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gazociągi · Instalacje sanitarne · Zarządzanie etapami i kosztami</p>
        </div>
        <button onClick={() => { setFormInw(emptyInw); setShowFormInw(true) }}
          className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700 transition-colors">
          + Nowa inwestycja
        </button>
      </div>

      {success && <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-4">✓ {success}</div>}
      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">✗ {error}</div>}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 mb-6">
        {[
          { l: 'Planowane', v: statCounts.planowana, cls: 'text-gray-700' },
          { l: 'W trakcie', v: statCounts.w_trakcie, cls: 'text-blue-700' },
          { l: 'Zakończone', v: statCounts.zakonczona, cls: 'text-green-700' },
          { l: 'Budżet łączny', v: fmt(statCounts.budzet) + ' zł', cls: 'text-purple-700' },
          { l: 'Koszty łączne', v: fmt(statCounts.koszt) + ' zł', cls: 'text-amber-700' },
        ].map(k => (
          <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.l}</p>
            <p className={`text-lg font-semibold ${k.cls}`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Zakładki */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { k: 'lista',  l: '📋 Lista' },
          { k: 'kanban', l: '🗂 Kanban etapów' },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setActiveTab(t.k)}
            className={`px-4 py-2 text-sm rounded-lg transition-all font-medium ${activeTab === t.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ════════════════ LISTA ════════════════ */}
      {activeTab === 'lista' && (
        <>
          {/* Filtry */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Wszystkie typy</option>
              <option value="gazociag">Gazociąg</option>
              <option value="instalacja_sanitarna">Instalacja sanitarna</option>
              <option value="inne">Inne</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Wszystkie statusy</option>
              <option value="planowana">Planowane</option>
              <option value="w_trakcie">W trakcie</option>
              <option value="zakonczona">Zakończone</option>
              <option value="wstrzymana">Wstrzymane</option>
            </select>
            {(filterTyp || filterStatus) && (
              <button onClick={() => { setFilterTyp(''); setFilterStatus('') }} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">✕ Wyczyść</button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Ładowanie...</p>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">{inwestycje.length === 0 ? 'Brak inwestycji — dodaj pierwszą.' : 'Brak wyników.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(inv => {
                const invEtapy = etapy.filter(e => e.inwestycja_id === inv.id)
                const etapyDone = invEtapy.filter(e => e.status === 'zrealizowany').length
                const pct = progressPct(inv)
                const invKoszty = koszty.filter(k => k.inwestycja_id === inv.id)
                return (
                  <div key={inv.id} className="bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                    {/* Nagłówek inwestycji */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <button onClick={() => setOpenInwId(inv.id)} className="font-semibold text-gray-900 hover:text-blue-700 transition-colors text-left text-base">
                              {inv.nazwa}
                            </button>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[inv.status]}`}>{statusLabel[inv.status]}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{typLabel[inv.typ]}</span>
                          </div>
                          {inv.lokalizacja && <p className="text-xs text-gray-500 mb-2">📍 {inv.lokalizacja}</p>}
                          <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                            {inv.data_rozpoczecia && <span>Start: {fmtDate(inv.data_rozpoczecia)}</span>}
                            {inv.data_planowanego_zakonczenia && <span>Koniec: {fmtDate(inv.data_planowanego_zakonczenia)}</span>}
                            {inv.budzet && <span className="font-medium text-gray-700">Budżet: {fmt(inv.budzet)} zł</span>}
                            {invKoszty.length > 0 && <span className="text-amber-700 font-medium">Koszty: {fmt(invKoszty.reduce((a,k) => a+k.kwota,0))} zł</span>}
                            {invEtapy.length > 0 && <span>Etapy: <span className="font-medium text-green-700">{etapyDone}</span>/{invEtapy.length}</span>}
                          </div>
                          {/* Pasek postępu budżetu */}
                          {inv.budzet && inv.budzet > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-xs">
                                <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-yellow-400' : 'bg-blue-400'}`}
                                  style={{ width: `${pct.toFixed(0)}%` }} />
                              </div>
                              <span className="text-xs text-gray-400">{pct.toFixed(0)}% budżetu</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                          <button onClick={() => setShowKosztyPanel(inv.id)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 text-gray-500 transition-colors">
                            💰 Koszty{invKoszty.length > 0 ? ` (${invKoszty.length})` : ''}
                          </button>
                          <button onClick={() => setOpenInwId(inv.id)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-gray-500 transition-colors">
                            📋 Etapy{invEtapy.length > 0 ? ` (${invEtapy.length})` : ''}
                          </button>
                          <button onClick={() => setEditInw({...inv})} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-500">Edytuj</button>
                          <button onClick={() => setDeleteInwId(inv.id)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-500">Usuń</button>
                        </div>
                      </div>
                    </div>

                    {/* PASEK ETAPÓW — zawsze widoczny */}
                    {invEtapy.length > 0 && (
                      <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 rounded-b-xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-gray-500 mr-1">Etapy:</span>
                          {invEtapy.map(et => {
                            const eprac = etapyPracownicy.filter(ep => ep.etap_id === et.id)
                            return (
                              <div key={et.id} className="flex items-center gap-1">
                                <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${etapColor[et.status]} flex items-center gap-1`}>
                                  {et.status === 'zrealizowany' && '✓ '}
                                  {et.status === 'w_trakcie' && '▶ '}
                                  {et.nazwa}
                                  {eprac.length > 0 && (
                                    <span className="ml-1 text-gray-400" title={eprac.map(ep => (ep.pracownicy as any)?.imie + ' ' + (ep.pracownicy as any)?.nazwisko).join(', ')}>
                                      👷{eprac.length}
                                    </span>
                                  )}
                                </span>
                                {et.status !== 'zrealizowany' && (
                                  <button onClick={() => zakonczEtap(et)}
                                    className="text-xs px-1.5 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                    title="Zakończ etap">
                                    ✓
                                  </button>
                                )}
                              </div>
                            )
                          })}
                          <button onClick={() => setOpenInwId(inv.id)}
                            className="text-xs text-blue-600 hover:underline ml-1">
                            + etap
                          </button>
                        </div>
                      </div>
                    )}
                    {invEtapy.length === 0 && (
                      <div className="border-t border-gray-100 px-5 py-2 bg-gray-50 rounded-b-xl">
                        <button onClick={() => setOpenInwId(inv.id)} className="text-xs text-gray-400 hover:text-blue-600">+ Dodaj etap realizacji</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ════════════════ KANBAN ════════════════ */}
      {activeTab === 'kanban' && (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Inwestycja:</span>
            <select value={kanbanInwId} onChange={e => setKanbanInwId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48">
              <option value="wszystkie">🔍 Wszystkie inwestycje</option>
              {inwestycje.map(i => <option key={i.id} value={i.id}>{i.nazwa}</option>)}
            </select>
            <span className="text-xs text-gray-400">{kanbanEtapy.length} etapów</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {kanbanKolumny.map(kol => {
              const kolEtapy = kanbanEtapy.filter(e => (e.kanban_kolumna || e.status) === kol.id)
              return (
                <div key={kol.id}
                  className={`${kol.color} border rounded-xl p-3 min-h-64`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => onDropKanban(kol.id)}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">{kol.label}</h3>
                    <span className="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">{kolEtapy.length}</span>
                  </div>
                  <div className="space-y-2">
                    {kolEtapy.map(et => {
                      const inv = inwestycje.find(i => i.id === et.inwestycja_id)
                      const eprac = etapyPracownicy.filter(ep => ep.etap_id === et.id)
                      return (
                        <div key={et.id}
                          draggable
                          onDragStart={() => { dragEtap.current = et.id }}
                          className="bg-white border border-gray-200 rounded-xl p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow">
                          <p className="text-sm font-medium text-gray-900 mb-1">{et.nazwa}</p>
                          {kanbanInwId === 'wszystkie' && inv && (
                            <p className="text-xs text-blue-600 mb-1 truncate">📍 {inv.nazwa}</p>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 flex-wrap">
                              {et.data_planowana && <span className="text-xs text-gray-400">{fmtDate(et.data_planowana)}</span>}
                              {eprac.length > 0 && (
                                <div className="flex items-center gap-0.5">
                                  {eprac.slice(0,3).map(ep => (
                                    <span key={ep.id} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium" title={(ep.pracownicy as any)?.imie + ' ' + (ep.pracownicy as any)?.nazwisko}>
                                      {(ep.pracownicy as any)?.imie?.[0]}{(ep.pracownicy as any)?.nazwisko?.[0]}
                                    </span>
                                  ))}
                                  {eprac.length > 3 && <span className="text-xs text-gray-400">+{eprac.length-3}</span>}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setEtapPracownikModal(et.id)}
                                className="text-xs text-gray-400 hover:text-blue-600 transition-colors" title="Przypisz pracownika">👷</button>
                              {kol.id !== 'zrealizowany' && (
                                <button onClick={() => zakonczEtap(et)}
                                  className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded hover:bg-green-600" title="Zakończ">✓</button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {kolEtapy.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">Przeciągnij tu etap</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════ DRAWER: SZCZEGÓŁY INWESTYCJI ════════════════ */}
      {openInwId && openInw && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black bg-opacity-30" onClick={() => setOpenInwId(null)} />
          <div className="w-full max-w-xl bg-white border-l border-gray-200 flex flex-col" style={{ overflowY: 'auto' }}>
            {/* Header drawera */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{openInw.nazwa}</h2>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[openInw.status]}`}>{statusLabel[openInw.status]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{typLabel[openInw.typ]}</span>
                  </div>
                  {openInw.lokalizacja && <p className="text-xs text-gray-500 mt-1">📍 {openInw.lokalizacja}</p>}
                </div>
                <button onClick={() => setOpenInwId(null)} className="text-gray-400 hover:text-gray-700 text-xl ml-3">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-gray-500">
                {openInw.data_rozpoczecia && <div><span className="font-medium text-gray-700">Start:</span> {fmtDate(openInw.data_rozpoczecia)}</div>}
                {openInw.data_planowanego_zakonczenia && <div><span className="font-medium text-gray-700">Planowany koniec:</span> {fmtDate(openInw.data_planowanego_zakonczenia)}</div>}
                {openInw.budzet && <div><span className="font-medium text-gray-700">Budżet:</span> {fmt(openInw.budzet)} zł</div>}
                {openInw.koszt_aktualny != null && <div><span className="font-medium text-amber-700">Koszty aktualne:</span> {fmt(openInw.koszt_aktualny)} zł</div>}
              </div>
              {openInw.opis && <p className="text-sm text-gray-600 mt-2">{openInw.opis}</p>}
            </div>

            <div className="flex-1 p-5 space-y-6">
              {/* Etapy realizacji */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Etapy realizacji</h3>
                {etapy.filter(e => e.inwestycja_id === openInwId).length === 0 ? (
                  <p className="text-xs text-gray-400 mb-3">Brak etapów — dodaj poniżej.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {etapy.filter(e => e.inwestycja_id === openInwId).map(et => {
                      const eprac = etapyPracownicy.filter(ep => ep.etap_id === et.id)
                      return (
                        <div key={et.id} className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                          <button onClick={() => toggleEtap(et)}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${et.status === 'zrealizowany' ? 'bg-green-500 border-green-500' : et.status === 'w_trakcie' ? 'bg-blue-400 border-blue-400' : 'border-gray-300'}`}>
                            {et.status === 'zrealizowany' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            {et.status === 'w_trakcie' && <div className="w-2 h-2 rounded-full bg-white"/>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${et.status === 'zrealizowany' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{et.nazwa}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              {et.data_planowana && <span className="text-xs text-gray-400">Plan: {fmtDate(et.data_planowana)}</span>}
                              {et.data_realizacji && <span className="text-xs text-green-600">✓ {fmtDate(et.data_realizacji)}</span>}
                              {eprac.length > 0 && (
                                <div className="flex gap-0.5">
                                  {eprac.map(ep => (
                                    <span key={ep.id} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                      {(ep.pracownicy as any)?.imie} {(ep.pracownicy as any)?.nazwisko?.[0]}.
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => setEtapPracownikModal(et.id)}
                              className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                              title="Przypisz pracowników">
                              👷
                            </button>
                            {et.status !== 'zrealizowany' && (
                              <button onClick={() => zakonczEtap(et)}
                                className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium">
                                Zakończ
                              </button>
                            )}
                            <button onClick={() => deleteEtap(et.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* Formularz dodawania etapu */}
                <form onSubmit={handleAddEtap} className="flex gap-2 mt-2">
                  <input value={newEtap.nazwa} onChange={e => setNewEtap(n => ({...n, nazwa: e.target.value}))}
                    placeholder="Nazwa etapu..." required
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="date" value={newEtap.data_planowana} onChange={e => setNewEtap(n => ({...n, data_planowana: e.target.value}))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none w-36" />
                  <button type="submit" disabled={etapSaving}
                    className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50">+</button>
                </form>
              </div>

              {/* Koszty — podgląd w drawerze */}
              {koszty.filter(k => k.inwestycja_id === openInwId).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Koszty ({koszty.filter(k => k.inwestycja_id === openInwId).length})</h3>
                    <button onClick={() => { setOpenInwId(null); setShowKosztyPanel(openInwId) }}
                      className="text-xs text-blue-600 hover:underline">Zarządzaj →</button>
                  </div>
                  <div className="space-y-1.5">
                    {koszty.filter(k => k.inwestycja_id === openInwId).slice(0,5).map(k => (
                      <div key={k.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                        <span className="text-gray-700">{k.nazwa}</span>
                        <span className="font-medium text-amber-700">{fmt(k.kwota)} zł</span>
                      </div>
                    ))}
                    {koszty.filter(k => k.inwestycja_id === openInwId).length > 5 && (
                      <p className="text-xs text-gray-400">+ {koszty.filter(k => k.inwestycja_id === openInwId).length - 5} więcej</p>
                    )}
                  </div>
                </div>
              )}
              {/* end koszty section */}
            </div>{/* end flex-1 p-5 space-y-6 */}

            <div className="p-5 border-t border-gray-100 flex gap-2">
              <button onClick={() => { setOpenInwId(null); setEditInw({...openInw}) }}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Edytuj</button>
              <button onClick={() => { setShowKosztyPanel(openInwId); setOpenInwId(null) }}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200">💰 Koszty</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ MODAL: KOSZTY ════════════════ */}
      {renderKosztyPanel()}

      {/* ════════════════ MODAL: PRZYPISZ PRACOWNIKA DO ETAPU ════════════════ */}
      {renderEtapPracownikModal()}

      {/* ════════════════ MODAL: NOWA INWESTYCJA ════════════════ */}
      {showFormInw && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-xl" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Nowa inwestycja</h2>
            <form onSubmit={handleAddInw}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex flex-col gap-1 col-span-2"><label className={lbl}>Nazwa projektu</label><input value={formInw.nazwa} onChange={e => setFormInw(f => ({...f, nazwa: e.target.value}))} placeholder="np. Gazociąg ul. Lipowa" required className={inp} /></div>
                <div className="flex flex-col gap-1"><label className={lbl}>Typ</label>
                  <select value={formInw.typ} onChange={e => setFormInw(f => ({...f, typ: e.target.value}))} className={inp}>
                    <option value="gazociag">Gazociąg</option><option value="instalacja_sanitarna">Instalacja sanitarna</option><option value="inne">Inne</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1"><label className={lbl}>Budżet [zł]</label><input type="number" value={formInw.budzet} onChange={e => setFormInw(f => ({...f, budzet: e.target.value}))} placeholder="0.00" min="0" step="0.01" className={inp} /></div>
                <div className="flex flex-col gap-1 col-span-2"><label className={lbl}>Lokalizacja</label><input value={formInw.lokalizacja} onChange={e => setFormInw(f => ({...f, lokalizacja: e.target.value}))} placeholder="np. ul. Lipowa, Białystok" className={inp} /></div>
                <div className="flex flex-col gap-1"><label className={lbl}>Data rozpoczęcia</label><input type="date" value={formInw.data_rozpoczecia} onChange={e => setFormInw(f => ({...f, data_rozpoczecia: e.target.value}))} className={inp} /></div>
                <div className="flex flex-col gap-1"><label className={lbl}>Planowane zakończenie</label><input type="date" value={formInw.data_planowanego_zakonczenia} onChange={e => setFormInw(f => ({...f, data_planowanego_zakonczenia: e.target.value}))} className={inp} /></div>
                <div className="flex flex-col gap-1 col-span-2"><label className={lbl}>Opis</label><textarea value={formInw.opis} onChange={e => setFormInw(f => ({...f, opis: e.target.value}))} rows={2} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none" /></div>
                <div className="flex flex-col gap-1 col-span-2"><label className={lbl}>Notatki</label><textarea value={formInw.notatki} onChange={e => setFormInw(f => ({...f, notatki: e.target.value}))} rows={2} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none" /></div>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowFormInw(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                <button type="submit" disabled={savingInw} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">{savingInw ? 'Zapisuję...' : 'Dodaj inwestycję'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════ MODAL: EDYTUJ INWESTYCJĘ ════════════════ */}
      {editInw && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-xl" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Edytuj inwestycję</h2>
            <form onSubmit={handleEditInw}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex flex-col gap-1 col-span-2"><label className={lbl}>Nazwa</label><input value={editInw.nazwa} onChange={e => setEditInw(f => f ? {...f, nazwa: e.target.value} : f)} required className={inp} /></div>
                <div className="flex flex-col gap-1"><label className={lbl}>Typ</label>
                  <select value={editInw.typ} onChange={e => setEditInw(f => f ? {...f, typ: e.target.value} : f)} className={inp}>
                    <option value="gazociag">Gazociąg</option><option value="instalacja_sanitarna">Instalacja sanitarna</option><option value="inne">Inne</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1"><label className={lbl}>Status</label>
                  <select value={editInw.status} onChange={e => setEditInw(f => f ? {...f, status: e.target.value} : f)} className={inp}>
                    <option value="planowana">Planowana</option><option value="w_trakcie">W trakcie</option><option value="zakonczona">Zakończona</option><option value="wstrzymana">Wstrzymana</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1"><label className={lbl}>Budżet [zł]</label><input type="number" value={editInw.budzet ?? ''} onChange={e => setEditInw(f => f ? {...f, budzet: parseFloat(e.target.value)||null} : f)} min="0" step="0.01" className={inp} /></div>
                <div className="flex flex-col gap-1 col-span-2"><label className={lbl}>Lokalizacja</label><input value={editInw.lokalizacja ?? ''} onChange={e => setEditInw(f => f ? {...f, lokalizacja: e.target.value} : f)} className={inp} /></div>
                <div className="flex flex-col gap-1"><label className={lbl}>Data rozpoczęcia</label><input type="date" value={editInw.data_rozpoczecia ?? ''} onChange={e => setEditInw(f => f ? {...f, data_rozpoczecia: e.target.value} : f)} className={inp} /></div>
                <div className="flex flex-col gap-1"><label className={lbl}>Planowane zakończenie</label><input type="date" value={editInw.data_planowanego_zakonczenia ?? ''} onChange={e => setEditInw(f => f ? {...f, data_planowanego_zakonczenia: e.target.value} : f)} className={inp} /></div>
                <div className="flex flex-col gap-1 col-span-2"><label className={lbl}>Opis</label><textarea value={editInw.opis ?? ''} onChange={e => setEditInw(f => f ? {...f, opis: e.target.value} : f)} rows={2} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none" /></div>
                <div className="flex flex-col gap-1 col-span-2"><label className={lbl}>Notatki</label><textarea value={editInw.notatki ?? ''} onChange={e => setEditInw(f => f ? {...f, notatki: e.target.value} : f)} rows={2} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none" /></div>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setEditInw(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                <button type="submit" disabled={editSaving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">{editSaving ? 'Zapisuję...' : 'Zapisz'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════ MODAL: USUŃ INWESTYCJĘ ════════════════ */}
      {deleteInwId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Usuń inwestycję</h2>
            <p className="text-sm text-gray-500 mb-5">Usuniecie wszystkie etapy i koszty tej inwestycji. Tej operacji nie można cofnąć.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteInwId(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleDeleteInw} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Usuń</button>
            </div>
          </div>
        </div>
      )}
      <CzatPanel modul="inwestycje" compact />
    </div>
  )
}