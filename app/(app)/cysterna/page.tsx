'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

// ─── Typy GPS ────────────────────────────────────────────────────────────────
type Pozycja = {
  lat: number; lng: number; predkosc: number; kierunek: number
  wysokosc: number; zaplion: boolean; satelity: number; timestamp: string
}
type PunktTrasy = {
  lat: number; lng: number; predkosc: number; zaplion: boolean; timestamp: string
}
type Statystyki = {
  punkty: number; max_predkosc: number; srednia_predkosc: number; czas_pracy_min: number
}

// ─── Typy dostawy ────────────────────────────────────────────────────────────
type Klient = { id: string; nazwa: string; adres: string | null; kod_pocztowy: string | null; miasto: string | null; telefon: string | null }
type Pojazd = { id: string; nr_rejestracyjny: string; nazwa: string | null; typ: string; aktywny: boolean }
type BazaTrasy = { id: string; nazwa: string; adres: string; opis: string | null; aktywny: boolean }
type Dostawa = {
  id: string; klient_id: string | null; data_planowana: string; kolejnosc: number
  adres_dostawy: string | null; ilosc_litry_plan: number | null; ilosc_litry_real: number | null
  cena_sprzedazy: number | null; nr_edd: string | null; uwagi: string | null
  status: string; zrealizowana: boolean; data_realizacji: string | null; kierowca: string | null
  pojazd: string | null
  klienci: { nazwa: string; telefon: string | null } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function timeSince(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s temu`
  if (diff < 3600) return `${Math.floor(diff / 60)}min temu`
  return `${Math.floor(diff / 3600)}h temu`
}
function fmt(n: number, d = 2) { return n.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) }
const inp = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white"
const labelCls = "text-xs font-medium text-gray-500 uppercase tracking-wide"

// ─── Główny komponent ─────────────────────────────────────────────────────────
export default function CysternaPage() {
  const supabase = createClient()
  const [mainTab, setMainTab] = useState<'gps' | 'trasa' | 'historia' | 'pojazdy'>('gps')

  // ── GPS state ──────────────────────────────────────────────────────────────
  const [pozycja, setPozycja] = useState<Pozycja | null>(null)
  const [trasa, setTrasa] = useState<PunktTrasy[]>([])
  const [statystyki, setStatystyki] = useState<Statystyki | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [widokTrasy, setWidokTrasy] = useState<'24h' | '12h' | '6h' | '1h'>('24h')
  const [showPostoje, setShowPostoje] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)

  // ── Dostawy state ──────────────────────────────────────────────────────────
  const [klienci, setKlienci] = useState<Klient[]>([])
  const [dostawy, setDostawy] = useState<Dostawa[]>([])
  const [dostLoading, setDostLoading] = useState(false)
  const [dostError, setDostError] = useState('')
  const [dostSuccess, setDostSuccess] = useState('')
  const [dataTrasy, setDataTrasy] = useState(new Date().toISOString().split('T')[0])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Formularz dostawy
  const emptyForm = { klient_id: '', adres_dostawy: '', ilosc_litry_plan: '', cena_sprzedazy: '', nr_edd: '', uwagi: '', kolejnosc: '1', kierowca: '', pojazd: '' }
  const [form, setForm] = useState(emptyForm)
  const [selectedPojazdNr, setSelectedPojazdNr] = useState('')  // nr_rej wybranego pojazdu na dany dzień

  // Listy do dropdownów
  const [eddList, setEddList] = useState<string[]>([])
  const [kierowcy, setKierowcy] = useState<{ id: string; imie: string; nazwisko: string }[]>([])
  const [klienciError, setKlienciError] = useState('')

  // Import z DD
  const [ddImportNr, setDdImportNr] = useState('')
  const [ddImporting, setDdImporting] = useState(false)

  // Pojazdy
  const [pojazdy, setPojazdy] = useState<Pojazd[]>([])
  const [showPojazdForm, setShowPojazdForm] = useState(false)
  const [pojazdEditId, setPojazdEditId] = useState<string | null>(null)
  const emptyPojazdForm = { nr_rejestracyjny: '', nazwa: '', typ: 'cysterna' }
  const [pojazdForm, setPojazdForm] = useState(emptyPojazdForm)
  const [pojazdSaving, setPojazdSaving] = useState(false)

  // Bazy / punkty startowe-końcowe
  const [bazyTrasy, setBazyTrasy] = useState<BazaTrasy[]>([])
  const [bazaStartId, setBazaStartId] = useState('')
  const [bazaKoniecId, setBazaKoniecId] = useState('')
  const [showBazaForm, setShowBazaForm] = useState(false)
  const [bazaEditId, setBazaEditId] = useState<string | null>(null)
  const emptyBazaForm = { nazwa: '', adres: '', opis: '' }
  const [bazaForm, setBazaForm] = useState(emptyBazaForm)
  const [bazaSaving, setBazaSaving] = useState(false)
  const [pojazdySubTab, setPojazdySubTab] = useState<'pojazdy' | 'bazy'>('pojazdy')

  // Historia
  const [histData, setHistData] = useState<Dostawa[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histOd, setHistOd] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [histDo, setHistDo] = useState(new Date().toISOString().split('T')[0])

  // AI optymalizacja trasy
  const [aiOptymalizacja, setAiOptymalizacja] = useState(false)
  const [aiUzasadnienie, setAiUzasadnienie] = useState('')
  const [archiwizowanie, setArchiwizowanie] = useState(false)

  const GODZINY: Record<string, number> = { '24h': 24, '12h': 12, '6h': 6, '1h': 1 }

  // Stop detection
  type Postoj = { start: string; koniec: string; czas_min: number; lat: number; lng: number }
  const postoje = useMemo<Postoj[]>(() => {
    if (trasa.length < 2) return []
    const wyniki: Postoj[] = []
    let postojStart: PunktTrasy | null = null
    let postojLat = 0, postojLng = 0
    for (let i = 0; i < trasa.length; i++) {
      const p = trasa[i]
      const stoi = p.predkosc === 0 || !p.zaplion
      if (stoi && !postojStart) { postojStart = p; postojLat = p.lat; postojLng = p.lng }
      else if (!stoi && postojStart) {
        const prev = trasa[i - 1]
        const czas = (new Date(prev.timestamp).getTime() - new Date(postojStart.timestamp).getTime()) / 60000
        if (czas >= 5) wyniki.push({ start: postojStart.timestamp, koniec: prev.timestamp, czas_min: Math.round(czas), lat: postojLat, lng: postojLng })
        postojStart = null
      }
    }
    if (postojStart) {
      const last = trasa[trasa.length - 1]
      const czas = (new Date(last.timestamp).getTime() - new Date(postojStart.timestamp).getTime()) / 60000
      if (czas >= 5) wyniki.push({ start: postojStart.timestamp, koniec: last.timestamp, czas_min: Math.round(czas), lat: postojLat, lng: postojLng })
    }
    return wyniki.reverse()
  }, [trasa])

  // ── GPS functions ──────────────────────────────────────────────────────────
  const fetchLive = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/gps/live', { cache: 'no-store' })
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      if (json.pozycja) { setPozycja(json.pozycja); setError(''); setLastSync(new Date().toISOString()) }
      else if (json.info) setInfo(json.info)
    } catch (e: any) { setError(e.message) }
    finally { if (!silent) setLoading(false) }
  }, [])

  const fetchTrasa = useCallback(async () => {
    const godziny = GODZINY[widokTrasy]
    const res = await fetch('/api/gps/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trasa', godziny }),
    })
    const json = await res.json()
    if (json.trasa) setTrasa(json.trasa)
  }, [widokTrasy])

  const fetchStatystyki = useCallback(async () => {
    const res = await fetch('/api/gps/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'statystyki' }),
    })
    const json = await res.json()
    if (json.statystyki) setStatystyki(json.statystyki)
  }, [])

  const syncFlespi = async () => {
    setSyncing(true)
    const res = await fetch('/api/gps/sync')
    const json = await res.json()
    if (json.error) setError(json.error)
    else {
      setInfo(json.zapisano > 0 ? `Zsynchronizowano ${json.zapisano} pozycji` : (json.info ?? 'Brak nowych danych'))
      setTimeout(() => setInfo(''), 4000)
      fetchTrasa(); fetchStatystyki()
    }
    setSyncing(false)
  }

  useEffect(() => { fetchLive(); fetchTrasa(); fetchStatystyki(); fetchKlienci(); fetchEddList(); fetchKierowcy(); fetchPojazdy(); fetchBazyTrasy() }, [])
  useEffect(() => {
    if (autoRefresh) { timerRef.current = setInterval(() => fetchLive(true), 30000) }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh, fetchLive])
  useEffect(() => { fetchTrasa() }, [widokTrasy])

  // Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapObjRef.current) return
    const initMap = async () => {
      const L = (await import('leaflet')).default
      // @ts-ignore
      await import('leaflet/dist/leaflet.css')
      const map = L.map(mapRef.current!, { zoom: 13, center: [52.069, 19.480] })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
      mapObjRef.current = map
    }
    initMap()
  }, [])

  useEffect(() => {
    if (!mapObjRef.current) return
    const L = (window as any).L
    if (!L) return
    if (pozycja?.lat && pozycja?.lng) {
      const icon = L.divIcon({
        html: `<div style="background:${pozycja.zaplion ? '#16a34a' : '#2563eb'};border:3px solid white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:14px">🚛</div>`,
        className: '', iconSize: [30, 30], iconAnchor: [15, 15],
      })
      if (markerRef.current) markerRef.current.remove()
      markerRef.current = L.marker([pozycja.lat, pozycja.lng], { icon })
        .addTo(mapObjRef.current)
        .bindPopup(`<b>Cysterna ON Gaz</b><br>Prędkość: ${pozycja.predkosc} km/h<br>Zapłon: ${pozycja.zaplion ? '🟢 ON' : '🔴 OFF'}<br>${formatTime(pozycja.timestamp)}`)
      mapObjRef.current.setView([pozycja.lat, pozycja.lng], 14)
    }
    if (trasa.length > 1) {
      const pts = trasa.map(p => [p.lat, p.lng])
      if (polylineRef.current) polylineRef.current.remove()
      polylineRef.current = L.polyline(pts, { color: '#2563eb', weight: 3, opacity: 0.7 }).addTo(mapObjRef.current)
    }
  }, [pozycja, trasa])

  // ── Dostawy functions ─────────────────────────────────────────────────────
  async function fetchKlienci() {
    setKlienciError('')
    const { data, error } = await supabase
      .from('klienci')
      .select('id, nazwa, adres, kod_pocztowy, miasto, telefon')
      .order('nazwa')
    if (error) { setKlienciError('Błąd ładowania klientów: ' + error.message); return }
    if (data) setKlienci(data)
  }

  async function fetchEddList() {
    const { data } = await supabase
      .from('zakupy')
      .select('nr_edd')
      .order('data_zakupu', { ascending: false })
    if (data) setEddList([...new Set(data.map((r: any) => r.nr_edd).filter(Boolean))])
  }

  async function fetchKierowcy() {
    const { data } = await supabase
      .from('pracownicy')
      .select('id, imie, nazwisko, stanowisko')
      .ilike('stanowisko', '%kierowca%')
      .eq('aktywny', true)
      .order('nazwisko')
    // fallback: jeśli brak kierowców z filtra, pobierz wszystkich aktywnych
    if (data && data.length > 0) {
      setKierowcy(data)
    } else {
      const { data: wszyscy } = await supabase
        .from('pracownicy')
        .select('id, imie, nazwisko')
        .eq('aktywny', true)
        .order('nazwisko')
      setKierowcy(wszyscy ?? [])
    }
  }

  // Import odbiorców z dokumentu EDD/DD do trasy — 2 osobne zapytania (bez join)
  async function importFromDD(nr_edd: string) {
    if (!nr_edd.trim()) return
    setDdImporting(true); setDostError('')
    // Krok 1: pobierz pozycje sprzedaży dla tego EDD
    const { data: sprzData, error: sprzErr } = await supabase
      .from('sprzedaz')
      .select('klient_id, ilosc_litry, cena_sprzedazy')
      .eq('nr_edd', nr_edd.trim())
    if (sprzErr) { setDostError('Błąd pobierania sprzedaży: ' + sprzErr.message); setDdImporting(false); return }
    if (!sprzData || sprzData.length === 0) {
      setDostError(`Brak pozycji dla EDD "${nr_edd}" w tabeli Sprzedaż. Sprawdź numer dokumentu.`)
      setDdImporting(false); return
    }
    // Krok 2: pobierz dane klientów
    const klientIds = [...new Set(sprzData.map(s => s.klient_id).filter(Boolean))]
    const klienciMap: Record<string, Klient> = {}
    if (klientIds.length > 0) {
      const { data: klienciData } = await supabase
        .from('klienci')
        .select('id, nazwa, adres, kod_pocztowy, miasto, telefon')
        .in('id', klientIds)
      for (const k of klienciData ?? []) klienciMap[k.id] = k
    }
    // Krok 3: wstaw dostawy
    let kolejnosc = dostawy.length > 0 ? Math.max(...dostawy.map(d => d.kolejnosc)) + 1 : 1
    let dodano = 0
    for (const s of sprzData) {
      const kl = klienciMap[s.klient_id]
      const adres = kl
        ? [kl.adres, [kl.kod_pocztowy, kl.miasto].filter(Boolean).join(' ')].filter(Boolean).join(', ')
        : null
      const { error: e } = await supabase.from('dostawy').insert({
        klient_id: s.klient_id || null,
        data_planowana: dataTrasy,
        kolejnosc: kolejnosc++,
        adres_dostawy: adres || null,
        ilosc_litry_plan: s.ilosc_litry,
        cena_sprzedazy: s.cena_sprzedazy,
        nr_edd: nr_edd.trim(),
        pojazd: selectedPojazdNr || null,
        status: 'planowana',
      })
      if (!e) dodano++
    }
    setDostSuccess(`✓ Zaimportowano ${dodano} z ${sprzData.length} odbiorców z dokumentu ${nr_edd}`)
    setDdImportNr('')
    fetchDostawy(dataTrasy)
    setDdImporting(false)
  }

  // ── Pojazdy functions ─────────────────────────────────────────────────────
  async function fetchPojazdy() {
    const { data } = await supabase.from('pojazdy').select('*').order('nr_rejestracyjny')
    if (data) setPojazdy(data)
  }

  async function handlePojazdSave(e: React.FormEvent) {
    e.preventDefault(); setPojazdSaving(true)
    const payload = {
      nr_rejestracyjny: pojazdForm.nr_rejestracyjny.trim().toUpperCase(),
      nazwa: pojazdForm.nazwa.trim() || null,
      typ: pojazdForm.typ,
      aktywny: true,
    }
    if (pojazdEditId) {
      await supabase.from('pojazdy').update(payload).eq('id', pojazdEditId)
    } else {
      await supabase.from('pojazdy').insert(payload)
    }
    setShowPojazdForm(false); setPojazdEditId(null); setPojazdForm(emptyPojazdForm)
    fetchPojazdy()
    setPojazdSaving(false)
  }

  async function handlePojazdDelete(id: string) {
    if (!confirm('Usunąć pojazd?')) return
    await supabase.from('pojazdy').delete().eq('id', id)
    fetchPojazdy()
  }

  async function togglePojazdAktywny(p: Pojazd) {
    await supabase.from('pojazdy').update({ aktywny: !p.aktywny }).eq('id', p.id)
    fetchPojazdy()
  }

  // ── Bazy / punkty startowe ────────────────────────────────────────────────
  async function fetchBazyTrasy() {
    const { data } = await supabase.from('bazy_trasy').select('*').order('nazwa')
    if (data) {
      setBazyTrasy(data)
      // Domyślnie ustaw pierwszą aktywną bazę jako start i koniec
      const aktywne = data.filter((b: BazaTrasy) => b.aktywny)
      if (aktywne.length > 0 && !bazaStartId) setBazaStartId(aktywne[0].id)
      if (aktywne.length > 0 && !bazaKoniecId) setBazaKoniecId(aktywne[0].id)
    }
  }

  async function handleBazaSave(e: React.FormEvent) {
    e.preventDefault(); setBazaSaving(true)
    const payload = {
      nazwa: bazaForm.nazwa.trim(),
      adres: bazaForm.adres.trim(),
      opis: bazaForm.opis.trim() || null,
      aktywny: true,
    }
    if (bazaEditId) {
      await supabase.from('bazy_trasy').update(payload).eq('id', bazaEditId)
    } else {
      await supabase.from('bazy_trasy').insert(payload)
    }
    setShowBazaForm(false); setBazaEditId(null); setBazaForm(emptyBazaForm)
    fetchBazyTrasy()
    setBazaSaving(false)
  }

  async function handleBazaDelete(id: string) {
    if (!confirm('Usunąć ten punkt startowy/końcowy?')) return
    await supabase.from('bazy_trasy').delete().eq('id', id)
    if (bazaStartId === id) setBazaStartId('')
    if (bazaKoniecId === id) setBazaKoniecId('')
    fetchBazyTrasy()
  }

  async function toggleBazaAktywna(b: BazaTrasy) {
    await supabase.from('bazy_trasy').update({ aktywny: !b.aktywny }).eq('id', b.id)
    fetchBazyTrasy()
  }

  // Pomocnicze — pobierz adres wybranej bazy po id
  function getAdresBazy(id: string) {
    return bazyTrasy.find(b => b.id === id)?.adres ?? ''
  }
  function getNazwaBazy(id: string) {
    return bazyTrasy.find(b => b.id === id)?.nazwa ?? ''
  }

  async function fetchDostawy(data = dataTrasy) {
    setDostLoading(true); setDostError('')
    const { data: d, error } = await supabase
      .from('dostawy')
      .select('*, klienci(nazwa, telefon)')
      .eq('data_planowana', data)
      .neq('status', 'zarchiwizowana')
      .order('kolejnosc')
    if (error) setDostError(error.message)
    else setDostawy(d ?? [])
    setDostLoading(false)
  }

  // Generuj link Google Maps z wieloma przystankami
  function generateMapsUrl(dosts: Dostawa[]) {
    const adresy = dosts
      .filter(d => d.adres_dostawy)
      .sort((a, b) => a.kolejnosc - b.kolejnosc)
      .map(d => encodeURIComponent(d.adres_dostawy!))
    if (adresy.length === 0) return null
    const startAdres = getAdresBazy(bazaStartId)
    const koniecAdres = getAdresBazy(bazaKoniecId)
    const start = encodeURIComponent(startAdres || 'Karlino 78-230')
    const koniec = encodeURIComponent(koniecAdres || startAdres || 'Karlino 78-230')
    // Buduj URL: start/a1/a2/.../koniec
    const stops = [start, ...adresy, koniec].join('/')
    return `https://www.google.com/maps/dir/${stops}`
  }

  // AI optymalizacja kolejności dostaw
  async function optymalizujTrase() {
    if (dostawy.length < 2) return
    setAiOptymalizacja(true); setAiUzasadnienie(''); setDostError('')
    const startAdres = getAdresBazy(bazaStartId)
    const koniecAdres = getAdresBazy(bazaKoniecId)
    try {
      const res = await fetch('/api/trasa/optymalizuj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dostawy, startAdres, koniecAdres }),
      })
      const json = await res.json()
      if (!res.ok) { setDostError(json.error || 'Błąd AI'); return }
      // Ustaw nową kolejność w DB
      const { kolejnosc }: { kolejnosc: string[] } = json
      if (kolejnosc && kolejnosc.length > 0) {
        for (let i = 0; i < kolejnosc.length; i++) {
          await supabase.from('dostawy').update({ kolejnosc: i + 1 }).eq('id', kolejnosc[i])
        }
        setAiUzasadnienie(json.uzasadnienie || '')
        setDostSuccess('✓ Trasa zoptymalizowana przez AI!')
        setTimeout(() => setDostSuccess(''), 5000)
        fetchDostawy(dataTrasy)
      }
    } catch (e: any) {
      setDostError('Błąd połączenia z AI: ' + e.message)
    } finally {
      setAiOptymalizacja(false)
    }
  }

  // Archiwizuj całą trasę (przesuń do historii)
  async function archiwizujTrase() {
    if (!confirm(`Zarchiwizować trasę ${dataTrasy}? Zostanie przeniesiona do historii i zniknie z planowania.`)) return
    setArchiwizowanie(true)
    const ids = dostawy.map(d => d.id)
    const { error } = await supabase.from('dostawy').update({ status: 'zarchiwizowana' }).in('id', ids)
    if (error) setDostError('Błąd archiwizacji: ' + error.message)
    else {
      setDostSuccess('✓ Trasa zarchiwizowana i przeniesiona do historii')
      setTimeout(() => setDostSuccess(''), 4000)
      fetchDostawy(dataTrasy)
    }
    setArchiwizowanie(false)
  }

  async function fetchHistoria() {
    setHistLoading(true)
    const { data } = await supabase
      .from('dostawy')
      .select('*, klienci(nazwa, telefon)')
      .gte('data_planowana', histOd)
      .lte('data_planowana', histDo)
      .order('data_planowana', { ascending: false })
      .order('kolejnosc')
    // Historia pokazuje WSZYSTKIE — włącznie z zarchiwizowanymi
    setHistData(data ?? [])
    setHistLoading(false)
  }

  useEffect(() => {
    if (mainTab === 'trasa') {
      fetchDostawy(dataTrasy)
      if (klienci.length === 0) fetchKlienci()
    }
  }, [mainTab, dataTrasy])
  useEffect(() => { if (mainTab === 'historia') fetchHistoria() }, [mainTab, histOd, histDo])
  useEffect(() => { if (mainTab === 'pojazdy') { fetchPojazdy(); fetchBazyTrasy() } }, [mainTab])

  // Autouzupełnij pełny adres z klienta
  function onKlientChange(klient_id: string) {
    const kl = klienci.find(k => k.id === klient_id)
    if (!kl) { setForm(f => ({ ...f, klient_id, adres_dostawy: '' })); return }
    const czesci = [
      kl.adres,
      [kl.kod_pocztowy, kl.miasto].filter(Boolean).join(' '),
    ].filter(Boolean)
    setForm(f => ({ ...f, klient_id, adres_dostawy: czesci.join(', ') }))
  }

  function openAdd() {
    setEditId(null)
    const nextKolejnosc = dostawy.length > 0 ? Math.max(...dostawy.map(d => d.kolejnosc)) + 1 : 1
    setForm({ ...emptyForm, kolejnosc: String(nextKolejnosc), pojazd: selectedPojazdNr })
    setShowForm(true)
  }

  function openEdit(d: Dostawa) {
    setEditId(d.id)
    setForm({
      klient_id: d.klient_id ?? '',
      adres_dostawy: d.adres_dostawy ?? '',
      ilosc_litry_plan: d.ilosc_litry_plan != null ? String(d.ilosc_litry_plan) : '',
      cena_sprzedazy: d.cena_sprzedazy != null ? String(d.cena_sprzedazy) : '',
      nr_edd: d.nr_edd ?? '',
      uwagi: d.uwagi ?? '',
      kolejnosc: String(d.kolejnosc),
      kierowca: d.kierowca ?? '',
      pojazd: d.pojazd ?? '',
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setDostError('')
    const payload = {
      klient_id: form.klient_id || null,
      data_planowana: dataTrasy,
      kolejnosc: parseInt(form.kolejnosc) || 1,
      adres_dostawy: form.adres_dostawy || null,
      ilosc_litry_plan: form.ilosc_litry_plan ? parseFloat(form.ilosc_litry_plan) : null,
      cena_sprzedazy: form.cena_sprzedazy ? parseFloat(form.cena_sprzedazy) : null,
      nr_edd: form.nr_edd || null,
      uwagi: form.uwagi || null,
      kierowca: form.kierowca || null,
      pojazd: form.pojazd || null,
    }
    let err
    if (editId) {
      ({ error: err } = await supabase.from('dostawy').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('dostawy').insert(payload))
    }
    if (err) setDostError(err.message)
    else {
      setDostSuccess(editId ? 'Dostawa zaktualizowana!' : 'Dostawa dodana!')
      setShowForm(false); setEditId(null); setForm(emptyForm)
      fetchDostawy(dataTrasy)
      setTimeout(() => setDostSuccess(''), 3000)
    }
    setSaving(false)
  }

  async function toggleZrealizowana(d: Dostawa) {
    const zrealizowana = !d.zrealizowana
    let iloscReal = d.ilosc_litry_real
    if (zrealizowana && !iloscReal) {
      const val = prompt(`Ile litrów dostarczono do ${d.klienci?.nazwa ?? 'klienta'}? (plan: ${d.ilosc_litry_plan ?? '—'} l)`)
      iloscReal = val ? parseFloat(val) : d.ilosc_litry_plan
    }
    await supabase.from('dostawy').update({
      zrealizowana,
      status: zrealizowana ? 'zrealizowana' : 'planowana',
      ilosc_litry_real: zrealizowana ? iloscReal : null,
      data_realizacji: zrealizowana ? new Date().toISOString() : null,
    }).eq('id', d.id)
    fetchDostawy(dataTrasy)
  }

  async function toggleStatus(d: Dostawa, status: string) {
    await supabase.from('dostawy').update({ status }).eq('id', d.id)
    fetchDostawy(dataTrasy)
  }

  async function handleDelete(id: string) {
    if (!confirm('Usunąć tę dostawę?')) return
    await supabase.from('dostawy').delete().eq('id', id)
    fetchDostawy(dataTrasy)
  }

  // Sumy dla dnia
  const sumaLitryPlan = dostawy.reduce((a, d) => a + (d.ilosc_litry_plan ?? 0), 0)
  const sumaLitryReal = dostawy.filter(d => d.zrealizowana).reduce((a, d) => a + (d.ilosc_litry_real ?? 0), 0)
  const sumaWartosc = dostawy.filter(d => d.zrealizowana).reduce((a, d) => a + (d.ilosc_litry_real ?? 0) * (d.cena_sprzedazy ?? 0), 0)
  const zrealizowanych = dostawy.filter(d => d.zrealizowana).length

  const statusColor = (s: string) => ({
    planowana: 'bg-blue-50 text-blue-700 border-blue-200',
    w_trasie: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    zrealizowana: 'bg-green-50 text-green-700 border-green-200',
    anulowana: 'bg-gray-100 text-gray-500 border-gray-200',
    zarchiwizowana: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  }[s] ?? 'bg-gray-100 text-gray-500')

  const statusLabel = (s: string) => ({
    planowana: 'Planowana', w_trasie: 'W trasie', zrealizowana: 'Zrealizowana',
    anulowana: 'Anulowana', zarchiwizowana: '📦 Arch.',
  }[s] ?? s)

  const gpsStatusColor = pozycja?.zaplion ? 'bg-green-500' : 'bg-gray-400'
  const gpsStatusLabel = pozycja?.zaplion ? 'Silnik WŁĄCZONY' : 'Silnik wyłączony'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl">🚛</div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Cysterna & Dostawy</h1>
              <p className="text-xs text-gray-500">FMC920 · IMEI: 867747071481574</p>
            </div>
          </div>
          {mainTab === 'gps' && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
                Auto (30s)
              </label>
              <button onClick={syncFlespi} disabled={syncing}
                className="text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
                {syncing ? <><div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Sync...</> : '⬇ Sync flespi'}
              </button>
              <button onClick={() => fetchLive()}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">🔄 Odśwież</button>
            </div>
          )}
          {mainTab === 'trasa' && (
            <button onClick={openAdd}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              + Dodaj dostawę
            </button>
          )}
        </div>

        {/* Główne zakładki */}
        <div className="flex gap-1 mt-4 border-b border-gray-100 -mb-4 pb-0 overflow-x-auto">
          {([
            { key: 'gps', label: '📡 GPS na żywo' },
            { key: 'trasa', label: '🗺 Planowanie trasy' },
            { key: 'historia', label: '📋 Historia dostaw' },
            { key: 'pojazdy', label: '🚛 Pojazdy' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setMainTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${mainTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ GPS TAB ══════════ */}
      {mainTab === 'gps' && (
        <div className="p-4 md:p-6">
          {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">⚠ {error}</div>}
          {info && <div className="mb-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2.5 rounded-xl">ℹ {info}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Lewa kolumna */}
            <div className="space-y-4">
              {/* Status pojazdu */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-3 h-3 rounded-full ${gpsStatusColor} ${pozycja?.zaplion ? 'animate-pulse' : ''}`} />
                  <span className="font-semibold text-gray-800">{gpsStatusLabel}</span>
                </div>
                {loading && !pozycja ? (
                  <div className="flex items-center gap-2 py-4">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-400">Łączenie z FMC920...</span>
                  </div>
                ) : pozycja ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-gray-900">{pozycja.predkosc}</p>
                        <p className="text-xs text-gray-500">km/h</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-gray-900">{pozycja.satelity}</p>
                        <p className="text-xs text-gray-500">satelity</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Szerokość</span><span className="font-mono text-xs">{pozycja.lat.toFixed(6)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Długość</span><span className="font-mono text-xs">{pozycja.lng.toFixed(6)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Wysokość</span><span className="text-xs">{Math.round(pozycja.wysokosc)} m n.p.m.</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Kierunek</span><span className="text-xs">{pozycja.kierunek}°</span></div>
                      <div className="flex justify-between pt-2 border-t border-gray-100">
                        <span className="text-gray-500">Ostatni sygnał</span>
                        <span className="text-xs text-gray-600">{timeSince(pozycja.timestamp)}</span>
                      </div>
                      {lastSync && <div className="flex justify-between"><span className="text-gray-500">Odświeżono</span><span className="text-xs text-gray-400">{formatTime(lastSync)}</span></div>}
                    </div>
                    <a href={`https://www.google.com/maps?q=${pozycja.lat},${pozycja.lng}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 w-full mt-2">
                      📍 Otwórz w Google Maps
                    </a>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-4xl mb-2">📡</p>
                    <p className="text-sm text-gray-500 font-medium">Oczekiwanie na FMC920</p>
                    <p className="text-xs text-gray-400 mt-1">Upewnij się że urządzenie ma zasilanie i kartę SIM</p>
                  </div>
                )}
              </div>

              {/* Statystyki 24h */}
              {statystyki && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-3">📊 Statystyki (24h)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Maks. prędkość', value: `${statystyki.max_predkosc} km/h`, icon: '⚡' },
                      { label: 'Śr. prędkość', value: `${statystyki.srednia_predkosc} km/h`, icon: '📈' },
                      { label: 'Czas pracy', value: `${statystyki.czas_pracy_min} min`, icon: '⏱' },
                      { label: 'Punkty GPS', value: statystyki.punkty, icon: '📍' },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-lg">{s.icon}</p>
                        <p className="text-sm font-bold text-gray-900 mt-1">{s.value}</p>
                        <p className="text-xs text-gray-400">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Prawa kolumna - mapa + historia */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="font-medium text-sm text-gray-700">📍 Mapa na żywo</span>
                  <div className="flex gap-1">
                    {(['1h', '6h', '12h', '24h'] as const).map(v => (
                      <button key={v} onClick={() => setWidokTrasy(v)}
                        className={`text-xs px-2.5 py-1 rounded-full ${widokTrasy === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div ref={mapRef} className="w-full h-96" />
              </div>

              {trasa.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">🗺 Historia trasy ({widokTrasy}) — {trasa.length} punktów</h3>
                    {postoje.length > 0 && (
                      <button onClick={() => setShowPostoje(v => !v)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium ${showPostoje ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                        🅿 {postoje.length} {postoje.length === 1 ? 'postój' : postoje.length < 5 ? 'postoje' : 'postojów'}
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {[...trasa].reverse().slice(0, 50).map((p, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-gray-50">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.zaplion ? 'bg-green-400' : 'bg-gray-300'}`} />
                        <span className="text-gray-400 flex-shrink-0 w-36">{formatDate(p.timestamp)}</span>
                        <span className="font-medium text-gray-700 w-16">{p.predkosc} km/h</span>
                        <span className="font-mono text-gray-400">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showPostoje && postoje.length > 0 && (
                <div className="bg-white border border-amber-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🅿</span>
                    <h3 className="font-semibold text-gray-800">Wykryte postoje ({widokTrasy})</h3>
                    <span className="text-xs text-gray-400 ml-auto">≥5 min</span>
                  </div>
                  <div className="space-y-3">
                    {postoje.map((p, i) => {
                      const dataSpr = new Date(p.start).toISOString().slice(0, 10)
                      const czas = p.czas_min >= 60 ? `${Math.floor(p.czas_min / 60)}h ${p.czas_min % 60}min` : `${p.czas_min} min`
                      return (
                        <div key={i} className="border border-amber-100 bg-amber-50 rounded-xl p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-gray-700">{formatTime(p.start)} – {formatTime(p.koniec)}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.czas_min >= 30 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>⏱ {czas}</span>
                              </div>
                              <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer"
                                className="text-xs font-mono text-gray-400 hover:text-blue-600 mt-1 block">
                                📍 {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                              </a>
                            </div>
                            <a href={`/sprzedaz?data=${dataSpr}`}
                              className="flex-shrink-0 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium whitespace-nowrap">
                              📋 Dodaj sprzedaż
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ PLANOWANIE TRASY TAB ══════════ */}
      {mainTab === 'trasa' && (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">

          {/* Komunikaty */}
          {dostError && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠ {dostError}</div>}
          {dostSuccess && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✓ {dostSuccess}</div>}

          {/* Data trasy + statystyki dnia */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className={labelCls + ' block mb-1'}>Data trasy</label>
                <input type="date" value={dataTrasy} onChange={e => { setDataTrasy(e.target.value); fetchDostawy(e.target.value) }}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div className="flex gap-1">
                {[-1, 0, 1].map(offset => {
                  const d = new Date(); d.setDate(d.getDate() + offset)
                  const iso = d.toISOString().split('T')[0]
                  const label = offset === -1 ? 'Wczoraj' : offset === 0 ? 'Dziś' : 'Jutro'
                  return (
                    <button key={offset} onClick={() => { setDataTrasy(iso); fetchDostawy(iso) }}
                      className={`px-3 py-2 text-xs rounded-lg border ${dataTrasy === iso ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                      {label}
                    </button>
                  )
                })}
              </div>
              {/* Punkt startowy */}
              <div>
                <label className={labelCls + ' block mb-1'}>📍 Punkt startowy</label>
                {bazyTrasy.filter(b => b.aktywny).length > 0 ? (
                  <select value={bazaStartId} onChange={e => setBazaStartId(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white max-w-[200px]">
                    <option value="">— wybierz start —</option>
                    {bazyTrasy.filter(b => b.aktywny).map(b => (
                      <option key={b.id} value={b.id}>{b.nazwa}</option>
                    ))}
                  </select>
                ) : (
                  <button onClick={() => { setMainTab('pojazdy'); setPojazdySubTab('bazy') }}
                    className="text-xs text-green-700 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-50">
                    + Dodaj punkt startowy
                  </button>
                )}
              </div>

              {/* Punkt końcowy */}
              <div>
                <label className={labelCls + ' block mb-1'}>🏁 Punkt końcowy</label>
                {bazyTrasy.filter(b => b.aktywny).length > 0 ? (
                  <select value={bazaKoniecId} onChange={e => setBazaKoniecId(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white max-w-[200px]">
                    <option value="">— taki sam jak start —</option>
                    {bazyTrasy.filter(b => b.aktywny).map(b => (
                      <option key={b.id} value={b.id}>{b.nazwa}</option>
                    ))}
                  </select>
                ) : null}
              </div>

              {/* Pojazd z listy */}
              <div>
                <label className={labelCls + ' block mb-1'}>Pojazd na trasę</label>
                {pojazdy.filter(p => p.aktywny).length > 0 ? (
                  <select
                    value={selectedPojazdNr}
                    onChange={e => setSelectedPojazdNr(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">— wybierz pojazd —</option>
                    {pojazdy.filter(p => p.aktywny).map(p => (
                      <option key={p.id} value={p.nr_rejestracyjny}>
                        {p.nr_rejestracyjny}{p.nazwa ? ` · ${p.nazwa}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button onClick={() => setMainTab('pojazdy')}
                    className="text-xs text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-50">
                    + Dodaj pojazd w zakładce Pojazdy
                  </button>
                )}
              </div>
              {dostawy.length > 0 && (
                <div className="flex gap-4 ml-auto flex-wrap">
                  {[
                    { l: 'Dostaw', v: `${zrealizowanych}/${dostawy.length}`, icon: '📦' },
                    { l: 'Plan litry', v: `${fmt(sumaLitryPlan, 0)} l`, icon: '📊' },
                    { l: 'Dostarczone', v: `${fmt(sumaLitryReal, 0)} l`, icon: '✅' },
                    { l: 'Wartość', v: `${fmt(sumaWartosc)} zł`, icon: '💰' },
                  ].map(s => (
                    <div key={s.l} className="text-center">
                      <p className="text-lg">{s.icon}</p>
                      <p className="text-sm font-bold text-gray-900">{s.v}</p>
                      <p className="text-xs text-gray-400">{s.l}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Import z dokumentu EDD/DD ── */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className={labelCls + ' mb-2'}>📋 Import odbiorców z dokumentu EDD / Dokument Dostawy (EMCS)</p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Szybkie przyciski dla znanych EDD */}
                {eddList.slice(0, 6).map(edd => (
                  <button key={edd}
                    onClick={() => setDdImportNr(edd)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-mono whitespace-nowrap ${ddImportNr === edd ? 'bg-blue-600 text-white border-blue-600' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}>
                    {edd}
                  </button>
                ))}
                <input
                  list="edd-import-datalist"
                  value={ddImportNr}
                  onChange={e => setDdImportNr(e.target.value)}
                  placeholder="lub wpisz / wybierz nr EDD..."
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[200px]"
                />
                <datalist id="edd-import-datalist">
                  {eddList.map(e => <option key={e} value={e} />)}
                </datalist>
                <button
                  onClick={() => importFromDD(ddImportNr)}
                  disabled={!ddImportNr.trim() || ddImporting}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium whitespace-nowrap">
                  {ddImporting ? '⏳ Importuję...' : '📥 Importuj z DD'}
                </button>
                {eddList.length === 0 && (
                  <span className="text-xs text-gray-400 italic">Brak EDD w tabeli Zakupy — wpisz numer ręcznie</span>
                )}
              </div>
            </div>
          </div>

          {/* Formularz dostawy */}
          {showForm && (
            <div className="bg-white border border-blue-200 rounded-2xl p-5 mb-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">{editId ? 'Edytuj dostawę' : 'Nowa dostawa'}</h2>
                <button onClick={() => { setShowForm(false); setEditId(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <form onSubmit={handleSave}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className={labelCls}>
                      Klient *
                      <span className="ml-2 font-normal normal-case text-gray-400">
                        {klienci.length > 0 ? `(${klienci.length} klientów)` : '⏳ ładowanie...'}
                      </span>
                    </label>
                    {klienciError && (
                      <p className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">{klienciError}
                        <button onClick={fetchKlienci} className="ml-2 underline">Spróbuj ponownie</button>
                      </p>
                    )}
                    <select value={form.klient_id} onChange={e => onKlientChange(e.target.value)} required className={inp}>
                      <option value="">— wybierz klienta ({klienci.length}) —</option>
                      {klienci.map(k => <option key={k.id} value={k.id}>{k.nazwa}{k.miasto ? ` (${k.miasto})` : ''}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className={labelCls}>Adres dostawy</label>
                    <input value={form.adres_dostawy} onChange={e => setForm(f => ({ ...f, adres_dostawy: e.target.value }))}
                      placeholder="Auto-wypełniany z klienta, możesz edytować" className={inp} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Ilość planowana [litry]</label>
                    <input type="number" value={form.ilosc_litry_plan} onChange={e => setForm(f => ({ ...f, ilosc_litry_plan: e.target.value }))}
                      placeholder="0" min="0" step="0.01" className={inp} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Cena sprzedaży brutto [PLN/l]</label>
                    <input type="number" value={form.cena_sprzedazy} onChange={e => setForm(f => ({ ...f, cena_sprzedazy: e.target.value }))}
                      placeholder="0.0000" min="0" step="0.0001" className={inp} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Nr EDD</label>
                    <input
                      list="edd-datalist"
                      value={form.nr_edd}
                      onChange={e => setForm(f => ({ ...f, nr_edd: e.target.value }))}
                      placeholder={eddList.length > 0 ? 'Wybierz lub wpisz nr EDD' : 'Wpisz nr EDD'}
                      className={inp}
                    />
                    <datalist id="edd-datalist">
                      {eddList.map(e => <option key={e} value={e} />)}
                    </datalist>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Pojazd</label>
                    <select value={form.pojazd} onChange={e => setForm(f => ({ ...f, pojazd: e.target.value }))} className={inp}>
                      <option value="">— wybierz pojazd —</option>
                      {pojazdy.filter(p => p.aktywny).map(p => (
                        <option key={p.id} value={p.nr_rejestracyjny}>
                          {p.nr_rejestracyjny}{p.nazwa ? ` · ${p.nazwa}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Kolejność w trasie</label>
                    <input type="number" value={form.kolejnosc} onChange={e => setForm(f => ({ ...f, kolejnosc: e.target.value }))}
                      min="1" className={inp} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>
                      Kierowca
                      {kierowcy.length === 0 && <span className="ml-1 text-gray-400 font-normal normal-case">(brak w KADRY — wpisz ręcznie)</span>}
                    </label>
                    {kierowcy.length > 0 ? (
                      <select value={form.kierowca} onChange={e => setForm(f => ({ ...f, kierowca: e.target.value }))} className={inp}>
                        <option value="">— wybierz kierowcę —</option>
                        {kierowcy.map(k => (
                          <option key={k.id} value={`${k.imie} ${k.nazwisko}`}>{k.imie} {k.nazwisko}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.kierowca}
                        onChange={e => setForm(f => ({ ...f, kierowca: e.target.value }))}
                        placeholder="Imię i nazwisko kierowcy"
                        className={inp}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Uwagi</label>
                    <input value={form.uwagi} onChange={e => setForm(f => ({ ...f, uwagi: e.target.value }))}
                      placeholder="Dodatkowe informacje..." className={inp} />
                  </div>
                </div>
                {/* Podgląd wartości */}
                {form.ilosc_litry_plan && form.cena_sprzedazy && (
                  <div className="bg-blue-50 rounded-xl px-4 py-2 mb-4 flex gap-6 text-sm">
                    <span className="text-blue-700">Wartość planowana: <strong>{fmt(parseFloat(form.ilosc_litry_plan) * parseFloat(form.cena_sprzedazy))} zł brutto</strong></span>
                    <span className="text-gray-500">Netto: <strong>{fmt(parseFloat(form.ilosc_litry_plan) * parseFloat(form.cena_sprzedazy) / 1.23)} zł</strong></span>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                  <button type="submit" disabled={saving}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Zapisywanie...' : (editId ? 'Zapisz zmiany' : '+ Dodaj dostawę')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista dostaw na dany dzień */}
          {dostLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />Ładowanie...
            </div>
          ) : dostawy.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">🗺</p>
              <p className="text-gray-500 font-medium">Brak zaplanowanych dostaw na {dataTrasy}</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">Kliknij „+ Dodaj dostawę" aby zaplanować trasę</p>
              <button onClick={openAdd} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700">
                + Dodaj pierwszą dostawę
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {dostawy.map((d, idx) => {
                const wartosc = (d.ilosc_litry_real ?? d.ilosc_litry_plan ?? 0) * (d.cena_sprzedazy ?? 0)
                const klientTel = d.klienci?.telefon
                return (
                  <div key={d.id}
                    className={`bg-white border rounded-2xl p-4 transition-all ${d.zrealizowana ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
                    <div className="flex items-start gap-3">
                      {/* Numer kolejności */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${d.zrealizowana ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {d.kolejnosc}
                      </div>

                      {/* Treść */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="font-semibold text-gray-900">{d.klienci?.nazwa ?? '—'}</p>
                            {d.adres_dostawy && (
                              <a href={`https://www.google.com/maps/search/${encodeURIComponent(d.adres_dostawy)}`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                                📍 {d.adres_dostawy}
                              </a>
                            )}
                            {klientTel && (
                              <a href={`tel:${klientTel}`} className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 mt-0.5">
                                📞 {klientTel}
                              </a>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(d.status)}`}>
                            {statusLabel(d.status)}
                          </span>
                        </div>

                        {/* Dane dostawy */}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                          {d.ilosc_litry_plan && (
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              📊 Plan: {fmt(d.ilosc_litry_plan, 0)} l
                            </span>
                          )}
                          {d.ilosc_litry_real && (
                            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                              ✅ Dostarczone: {fmt(d.ilosc_litry_real, 0)} l
                            </span>
                          )}
                          {d.cena_sprzedazy && (
                            <span className="bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">
                              💰 {fmt(d.cena_sprzedazy, 4)} PLN/l
                            </span>
                          )}
                          {wartosc > 0 && (
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                              = {fmt(wartosc)} zł
                            </span>
                          )}
                          {d.nr_edd && <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">EDD: {d.nr_edd}</span>}
                          {d.pojazd && <span className="font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">🚛 {d.pojazd}</span>}
                          {d.kierowca && <span className="text-gray-500">👤 {d.kierowca}</span>}
                          {d.uwagi && <span className="text-gray-400 italic">💬 {d.uwagi}</span>}
                        </div>

                        {d.data_realizacji && (
                          <p className="text-xs text-green-600 mt-1">✓ Zrealizowano: {new Date(d.data_realizacji).toLocaleString('pl-PL')}</p>
                        )}
                      </div>

                      {/* Akcje */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {/* Checkbox zrealizowana */}
                        <label className="flex items-center gap-2 cursor-pointer select-none group">
                          <input type="checkbox" checked={d.zrealizowana}
                            onChange={() => toggleZrealizowana(d)}
                            className="w-5 h-5 rounded accent-green-600 cursor-pointer" />
                          <span className={`text-xs font-medium ${d.zrealizowana ? 'text-green-700' : 'text-gray-400 group-hover:text-gray-600'}`}>
                            {d.zrealizowana ? 'Zrealizowana' : 'Zrealizuj'}
                          </span>
                        </label>

                        {/* Status szybki */}
                        {!d.zrealizowana && (
                          <button onClick={() => toggleStatus(d, d.status === 'planowana' ? 'w_trasie' : 'planowana')}
                            className={`text-xs px-2 py-1 rounded-lg border transition-colors ${d.status === 'w_trasie' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'border-gray-200 text-gray-500 hover:bg-yellow-50'}`}>
                            {d.status === 'w_trasie' ? '🚛 W trasie' : '→ W trasie'}
                          </button>
                        )}

                        <div className="flex gap-1 mt-1">
                          <button onClick={() => openEdit(d)}
                            className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400">Edytuj</button>
                          <button onClick={() => handleDelete(d.id)}
                            className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400">Usuń</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Banner: wszystkie dostawy zrealizowane */}
          {dostawy.length > 0 && dostawy.every(d => d.zrealizowana) && (
            <div className="mt-5 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1">
                <p className="font-semibold text-green-800">🎉 Wszystkie dostawy zrealizowane!</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Możesz zarchiwizować trasę — zostanie przeniesiona do historii i zniknie z planowania.
                </p>
              </div>
              <button onClick={archiwizujTrase} disabled={archiwizowanie}
                className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
                {archiwizowanie ? '⏳ Archiwizuję...' : '📦 Archiwizuj trasę'}
              </button>
            </div>
          )}

          {/* AI uzasadnienie */}
          {aiUzasadnienie && (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-xs text-purple-700 flex items-start gap-2">
              <span className="text-lg leading-none">🤖</span>
              <div>
                <p className="font-semibold mb-0.5">Uzasadnienie AI:</p>
                <p>{aiUzasadnienie}</p>
              </div>
            </div>
          )}

          {/* Przyciski akcji trasy */}
          {dostawy.length > 0 && (
            <div className="mt-5 flex gap-3 justify-end flex-wrap">
              {/* Google Maps */}
              {(() => {
                const mapsUrl = generateMapsUrl(dostawy)
                return mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm border border-blue-200 text-blue-700 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 flex items-center gap-1.5">
                    🗺 Otwórz w Google Maps
                  </a>
                ) : null
              })()}

              {/* AI optymalizacja */}
              {dostawy.length >= 2 && (
                <button onClick={optymalizujTrase} disabled={aiOptymalizacja}
                  className="text-sm border border-purple-200 text-purple-700 bg-purple-50 px-4 py-2 rounded-lg hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5">
                  {aiOptymalizacja
                    ? <><div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />Optymalizuję...</>
                    : '🤖 Optymalizuj kolejność (AI)'}
                </button>
              )}

              {/* Archiwizuj ręcznie */}
              {dostawy.length > 0 && !dostawy.every(d => d.zrealizowana) && (
                <button onClick={archiwizujTrase} disabled={archiwizowanie}
                  className="text-sm border border-gray-200 text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  {archiwizowanie ? '⏳...' : '📦 Archiwizuj trasę'}
                </button>
              )}

              <button onClick={() => window.print()} className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">🖨 Drukuj trasę</button>
              <button onClick={openAdd} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">+ Dodaj dostawę</button>
            </div>
          )}
        </div>
      )}

      {/* ══════════ HISTORIA DOSTAW TAB ══════════ */}
      {mainTab === 'historia' && (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">

          {/* Filtry */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className={labelCls + ' block mb-1'}>Data od</label>
                <input type="date" value={histOd} onChange={e => setHistOd(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className={labelCls + ' block mb-1'}>Data do</label>
                <input type="date" value={histDo} onChange={e => setHistDo(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <button onClick={fetchHistoria} disabled={histLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {histLoading ? '⏳' : '🔍 Odśwież'}
              </button>
              {/* Skróty */}
              {[
                { label: '7 dni', days: 7 },
                { label: '30 dni', days: 30 },
                { label: '90 dni', days: 90 },
              ].map(q => (
                <button key={q.label} onClick={() => {
                  const od = new Date(); od.setDate(od.getDate() - q.days)
                  setHistOd(od.toISOString().split('T')[0])
                  setHistDo(new Date().toISOString().split('T')[0])
                }}
                  className="text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
                  Ostatnie {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* KPI historii */}
          {histData.length > 0 && (() => {
            const zreal = histData.filter(d => d.zrealizowana)
            const sumaL = zreal.reduce((a, d) => a + (d.ilosc_litry_real ?? 0), 0)
            const sumaW = zreal.reduce((a, d) => a + (d.ilosc_litry_real ?? 0) * (d.cena_sprzedazy ?? 0), 0)
            const unikDni = new Set(histData.map(d => d.data_planowana)).size
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { l: 'Dostaw łącznie', v: histData.length, icon: '📦', c: 'text-gray-900' },
                  { l: 'Zrealizowanych', v: `${zreal.length} (${histData.length > 0 ? Math.round(zreal.length / histData.length * 100) : 0}%)`, icon: '✅', c: 'text-green-700' },
                  { l: 'Litry dostarczone', v: `${fmt(sumaL, 0)} l`, icon: '🛢', c: 'text-blue-700' },
                  { l: 'Wartość brutto', v: `${fmt(sumaW)} zł`, icon: '💰', c: 'text-emerald-700' },
                ].map(k => (
                  <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-2xl mb-1">{k.icon}</p>
                    <p className={`text-lg font-bold ${k.c}`}>{k.v}</p>
                    <p className="text-xs text-gray-400">{k.l} · {unikDni} dni</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Tabela historii */}
          {histLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />Ładowanie...
            </div>
          ) : histData.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-500">Brak dostaw w wybranym okresie</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 700 }}>
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Data', 'Kol.', 'Klient', 'Adres', 'Plan [l]', 'Real [l]', 'Cena', 'Wartość', 'Status'].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {histData.map(d => {
                      const wartosc = (d.ilosc_litry_real ?? 0) * (d.cena_sprzedazy ?? 0)
                      return (
                        <tr key={d.id} className={`hover:bg-gray-50 ${d.zrealizowana ? '' : 'opacity-60'}`}>
                          <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{d.data_planowana}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-xs font-bold text-gray-500">{d.kolejnosc}</span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[140px] truncate" title={d.klienci?.nazwa ?? ''}>{d.klienci?.nazwa ?? '—'}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[160px] truncate" title={d.adres_dostawy ?? ''}>{d.adres_dostawy ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{d.ilosc_litry_plan != null ? fmt(d.ilosc_litry_plan, 0) : '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium text-green-700">{d.ilosc_litry_real != null ? fmt(d.ilosc_litry_real, 0) : '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{d.cena_sprzedazy != null ? fmt(d.cena_sprzedazy, 4) : '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-700">{wartosc > 0 ? fmt(wartosc) + ' zł' : '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(d.status)}`}>
                              {statusLabel(d.status)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-xs text-gray-500 font-medium">
                        Łącznie {histData.length} dostaw ({histData.filter(d => d.zrealizowana).length} zrealizowanych)
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-bold tabular-nums">
                        {fmt(histData.reduce((a, d) => a + (d.ilosc_litry_plan ?? 0), 0), 0)} l
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-bold text-green-700 tabular-nums">
                        {fmt(histData.filter(d => d.zrealizowana).reduce((a, d) => a + (d.ilosc_litry_real ?? 0), 0), 0)} l
                      </td>
                      <td />
                      <td className="px-3 py-3 text-right text-xs font-bold text-emerald-700 tabular-nums">
                        {fmt(histData.filter(d => d.zrealizowana).reduce((a, d) => a + (d.ilosc_litry_real ?? 0) * (d.cena_sprzedazy ?? 0), 0))} zł
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ POJAZDY TAB ══════════ */}
      {mainTab === 'pojazdy' && (
        <div className="p-4 md:p-6 max-w-3xl mx-auto">

          {/* Podzakładki */}
          <div className="flex gap-1 mb-5 border-b border-gray-200">
            {([
              { key: 'pojazdy', label: '🚛 Pojazdy' },
              { key: 'bazy', label: '📍 Punkty startowe / końcowe' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setPojazdySubTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${pojazdySubTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── PODZAKŁADKA: POJAZDY ── */}
          {pojazdySubTab === 'pojazdy' && (<>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Zarządzanie pojazdami</h2>
              <p className="text-xs text-gray-500 mt-0.5">Pojazdy są dostępne w planowaniu trasy i filtrze GPS</p>
            </div>
            <button onClick={() => { setPojazdEditId(null); setPojazdForm(emptyPojazdForm); setShowPojazdForm(true) }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              + Dodaj pojazd
            </button>
          </div>

          {/* Formularz pojazdu */}
          {showPojazdForm && (
            <div className="bg-white border border-blue-200 rounded-2xl p-5 mb-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{pojazdEditId ? 'Edytuj pojazd' : 'Nowy pojazd'}</h3>
                <button onClick={() => { setShowPojazdForm(false); setPojazdEditId(null) }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <form onSubmit={handlePojazdSave}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Nr rejestracyjny *</label>
                    <input
                      value={pojazdForm.nr_rejestracyjny}
                      onChange={e => setPojazdForm(f => ({ ...f, nr_rejestracyjny: e.target.value }))}
                      placeholder="np. WZ 12345"
                      required className={inp} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Nazwa / Opis</label>
                    <input
                      value={pojazdForm.nazwa}
                      onChange={e => setPojazdForm(f => ({ ...f, nazwa: e.target.value }))}
                      placeholder="np. Cysterna główna"
                      className={inp} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Typ pojazdu</label>
                    <select value={pojazdForm.typ} onChange={e => setPojazdForm(f => ({ ...f, typ: e.target.value }))} className={inp}>
                      <option value="cysterna">Cysterna LPG</option>
                      <option value="ciezarowy">Ciężarowy</option>
                      <option value="osobowy">Osobowy</option>
                      <option value="dostawczy">Dostawczy</option>
                      <option value="inne">Inne</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setShowPojazdForm(false); setPojazdEditId(null) }}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                  <button type="submit" disabled={pojazdSaving}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {pojazdSaving ? 'Zapisuję...' : (pojazdEditId ? 'Zapisz zmiany' : '+ Dodaj pojazd')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista pojazdów */}
          {pojazdy.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">🚛</p>
              <p className="text-gray-500 font-medium">Brak dodanych pojazdów</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">Dodaj pojazdy, aby wybierać je podczas planowania trasy</p>
              <button onClick={() => { setPojazdEditId(null); setPojazdForm(emptyPojazdForm); setShowPojazdForm(true) }}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700">
                + Dodaj pierwszy pojazd
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pojazdy.map(p => (
                <div key={p.id} className={`bg-white border rounded-2xl p-4 flex items-center gap-4 ${p.aktywny ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${p.aktywny ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    🚛
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-bold text-gray-900 font-mono text-lg">{p.nr_rejestracyjny}</p>
                      {p.nazwa && <p className="text-sm text-gray-600">{p.nazwa}</p>}
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{p.typ}</span>
                      {!p.aktywny && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Nieaktywny</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => togglePojazdAktywny(p)}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${p.aktywny ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                      {p.aktywny ? 'Dezaktywuj' : 'Aktywuj'}
                    </button>
                    <button onClick={() => {
                      setPojazdEditId(p.id)
                      setPojazdForm({ nr_rejestracyjny: p.nr_rejestracyjny, nazwa: p.nazwa ?? '', typ: p.typ })
                      setShowPojazdForm(true)
                    }}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-500">Edytuj</button>
                    <button onClick={() => handlePojazdDelete(p.id)}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400">Usuń</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">ℹ Jak używać pojazdów:</p>
            <p>• <strong>Planowanie trasy</strong> — wybierz pojazd w nagłówku trasy, będzie automatycznie przypisywany do nowych dostaw</p>
            <p>• <strong>Formularz dostawy</strong> — każda dostawa może mieć przypisany konkretny pojazd</p>
            <p>• Pojazdy nieaktywne nie pojawiają się w listach wyboru</p>
          </div>

          {/* SQL info */}
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
            <p className="font-semibold mb-1">⚠ Wymagane — uruchom w Supabase SQL Editor:</p>
            <pre className="bg-amber-100 rounded p-2 font-mono text-amber-900 overflow-x-auto">{`CREATE TABLE IF NOT EXISTS pojazdy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nr_rejestracyjny text NOT NULL,
  nazwa text,
  typ text DEFAULT 'cysterna',
  aktywny boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE pojazdy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_access" ON pojazdy FOR ALL USING (true) WITH CHECK (true);`}</pre>
          </div>
          </>)}

          {/* ── PODZAKŁADKA: BAZY / PUNKTY STARTOWE ── */}
          {pojazdySubTab === 'bazy' && (<>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Punkty startowe / końcowe</h2>
              <p className="text-xs text-gray-500 mt-0.5">Bazy, zajezdnie i inne miejsca startu lub zakończenia trasy</p>
            </div>
            <button onClick={() => { setBazaEditId(null); setBazaForm(emptyBazaForm); setShowBazaForm(true) }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
              + Dodaj punkt
            </button>
          </div>

          {/* Formularz bazy */}
          {showBazaForm && (
            <div className="bg-white border border-green-200 rounded-2xl p-5 mb-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{bazaEditId ? 'Edytuj punkt' : 'Nowy punkt startowy/końcowy'}</h3>
                <button onClick={() => { setShowBazaForm(false); setBazaEditId(null) }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <form onSubmit={handleBazaSave}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Nazwa punktu *</label>
                    <input
                      value={bazaForm.nazwa}
                      onChange={e => setBazaForm(f => ({ ...f, nazwa: e.target.value }))}
                      placeholder="np. Baza Karlino, Zajezdnia Szczecin"
                      required className={inp} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Adres (do Google Maps) *</label>
                    <input
                      value={bazaForm.adres}
                      onChange={e => setBazaForm(f => ({ ...f, adres: e.target.value }))}
                      placeholder="np. Krzywopłoty 41, 78-230 Karlino"
                      required className={inp} />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className={labelCls}>Opis / uwagi</label>
                    <input
                      value={bazaForm.opis}
                      onChange={e => setBazaForm(f => ({ ...f, opis: e.target.value }))}
                      placeholder="np. Główna baza spółki, otwarcie od 6:00"
                      className={inp} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setShowBazaForm(false); setBazaEditId(null) }}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                  <button type="submit" disabled={bazaSaving}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                    {bazaSaving ? 'Zapisuję...' : (bazaEditId ? 'Zapisz zmiany' : '+ Dodaj punkt')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista baz */}
          {bazyTrasy.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">📍</p>
              <p className="text-gray-500 font-medium">Brak punktów startowych</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">Dodaj bazę lub punkt startowy, aby móc wybierać go podczas planowania trasy</p>
              <button onClick={() => { setBazaEditId(null); setBazaForm(emptyBazaForm); setShowBazaForm(true) }}
                className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-700">
                + Dodaj pierwszy punkt
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {bazyTrasy.map(b => (
                <div key={b.id} className={`bg-white border rounded-2xl p-4 flex items-start gap-4 ${b.aktywny ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${b.aktywny ? 'bg-green-50' : 'bg-gray-50'}`}>
                    📍
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{b.nazwa}</p>
                      {!b.aktywny && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Nieaktywny</span>}
                      {bazaStartId === b.id && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">🚀 Start</span>}
                      {bazaKoniecId === b.id && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">🏁 Koniec</span>}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">📍 {b.adres}</p>
                    {b.opis && <p className="text-xs text-gray-400 mt-0.5 italic">{b.opis}</p>}
                    {/* Szybkie ustawienie jako start/koniec */}
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setBazaStartId(b.id)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${bazaStartId === b.id ? 'bg-blue-600 text-white border-blue-600' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}>
                        🚀 Ustaw jako start
                      </button>
                      <button onClick={() => setBazaKoniecId(b.id)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${bazaKoniecId === b.id ? 'bg-purple-600 text-white border-purple-600' : 'border-purple-200 text-purple-600 hover:bg-purple-50'}`}>
                        🏁 Ustaw jako koniec
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-col items-end">
                    <button onClick={() => toggleBazaAktywna(b)}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${b.aktywny ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                      {b.aktywny ? 'Dezaktywuj' : 'Aktywuj'}
                    </button>
                    <button onClick={() => {
                      setBazaEditId(b.id)
                      setBazaForm({ nazwa: b.nazwa, adres: b.adres, opis: b.opis ?? '' })
                      setShowBazaForm(true)
                    }}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-500">Edytuj</button>
                    <button onClick={() => handleBazaDelete(b.id)}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400">Usuń</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          <div className="mt-6 bg-green-50 border border-green-100 rounded-xl p-4 text-xs text-green-700 space-y-1">
            <p className="font-semibold">ℹ Jak używać punktów startowych:</p>
            <p>• Wybierz <strong>Punkt startowy</strong> i <strong>Punkt końcowy</strong> w nagłówku zakładki Planowanie trasy</p>
            <p>• Link Google Maps będzie generowany z uwzględnieniem wybranego startu i końca</p>
            <p>• AI optymalizacja trasy uwzględni geografię relative do wybranej bazy</p>
            <p>• Możesz mieć wiele baz i przełączać się między nimi przy każdej trasie</p>
          </div>

          {/* SQL info */}
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
            <p className="font-semibold mb-1">⚠ Wymagane SQL — uruchom w Supabase SQL Editor:</p>
            <pre className="bg-amber-100 rounded p-2 font-mono text-amber-900 overflow-x-auto">{`CREATE TABLE IF NOT EXISTS bazy_trasy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nazwa text NOT NULL,
  adres text NOT NULL,
  opis text,
  aktywny boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bazy_trasy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_access" ON bazy_trasy FOR ALL USING (true) WITH CHECK (true);`}</pre>
          </div>
          </>)}

        </div>
      )}
    </div>
  )
}
