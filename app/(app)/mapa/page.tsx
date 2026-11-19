'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

// Mapa klientów (moduł przeniesiony z GazCRM). Współrzędne są zapisywane w bazie firmy (kolumny lat/lng w `klienci`).
// Geokodowanie: publiczny serwis Nominatim (OpenStreetMap); adres klienta jest wysyłany do tego serwisu tylko po kliknięciu „Geokoduj”.

type Klient = {
  id: string; nazwa: string; adres: string | null
  miasto: string | null; kod_pocztowy: string | null
  telefon: string | null; typ: string; aktywny: boolean
  lat: number | null; lng: number | null; geocoded_at: string | null
}
type MarkerData = { klient: Klient; lat: number; lng: number }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

function loadLeaflet(): Promise<any> {
  return new Promise(resolve => {
    if ((window as any).L) { resolve((window as any).L); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => resolve((window as any).L)
    document.head.appendChild(script)
  })
}

async function geocodeOne(adres: string, miasto: string): Promise<{ lat: number; lng: number } | null> {
  const szukaj = async (q: string) => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=pl`, {
      headers: { 'Accept-Language': 'pl' },
    })
    const data = await res.json()
    return data.length > 0 ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null
  }
  try {
    const dokladny = await szukaj(`${adres}, ${miasto}, Polska`)
    if (dokladny) return dokladny
    if (miasto) return await szukaj(`${miasto}, Polska`)
  } catch {}
  return null
}

export default function MapaPage() {
  const supabase = createClient()
  const [klienci, setKlienci] = useState<Klient[]>([])
  const [markers, setMarkers] = useState<MarkerData[]>([])
  const [loading, setLoading] = useState(true)
  const [geocoding, setGeocoding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressTxt, setProgressTxt] = useState('')
  const [selected, setSelected] = useState<Klient | null>(null)
  const [search, setSearch] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const [info, setInfo] = useState('')
  const [blad, setBlad] = useState('')
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<any>(null)
  const markersLayer = useRef<any>(null)

  useEffect(() => { fetchKlienci() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!loading) initMap() }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (mapReady) updateMarkers() }, [markers, search, mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchKlienci() {
    setLoading(true)
    const { data, error } = await supabase
      .from('klienci')
      .select('id,nazwa,adres,miasto,kod_pocztowy,telefon,typ,aktywny,lat,lng,geocoded_at')
      .eq('aktywny', true)
      .order('nazwa')
    if (error) { setBlad('Nie udało się wczytać klientów: ' + error.message); setLoading(false); return }
    if (data) {
      setKlienci(data as Klient[])
      const saved = (data as Klient[]).filter(k => k.lat && k.lng)
      if (saved.length > 0) {
        setMarkers(saved.map(k => ({ klient: k, lat: k.lat!, lng: k.lng! })))
        setInfo(`Załadowano ${saved.length} zapisanych pozycji z bazy.`)
      }
    }
    setLoading(false)
  }

  async function initMap() {
    if (!mapRef.current) return
    const L = await loadLeaflet()
    if (!mapRef.current) return
    if (mapObj.current) { mapObj.current.remove(); mapObj.current = null }
    const map = L.map(mapRef.current, { zoomControl: true }).setView([52.0, 19.5], 6)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', maxZoom: 19,
    }).addTo(map)
    markersLayer.current = L.layerGroup().addTo(map)
    mapObj.current = map
    setMapReady(true)
  }

  function updateMarkers() {
    if (!mapObj.current || !markersLayer.current) return
    const L = (window as any).L
    markersLayer.current.clearLayers()
    const q = search.toLowerCase()
    const filtered = markers.filter(m =>
      !search || m.klient.nazwa.toLowerCase().includes(q) || (m.klient.miasto ?? '').toLowerCase().includes(q)
    )
    filtered.forEach(m => {
      const color = m.klient.typ === 'firma' ? '#2563eb' : '#16a34a'
      const icon = L.divIcon({
        html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:700">${m.klient.typ === 'firma' ? 'F' : 'O'}</div>`,
        className: '', iconSize: [22, 22], iconAnchor: [11, 11],
      })
      const tel = m.klient.telefon ? esc(m.klient.telefon) : ''
      L.marker([m.lat, m.lng], { icon })
        .addTo(markersLayer.current)
        .bindPopup(`<div style="font-family:sans-serif;min-width:160px">
          <div style="font-weight:600;font-size:13px;margin-bottom:3px">${esc(m.klient.nazwa)}</div>
          <div style="font-size:11px;color:#555">${esc([m.klient.adres, m.klient.miasto].filter(Boolean).join(', '))}</div>
          ${tel ? `<div style="margin-top:4px;font-size:11px"><a href="tel:${tel}" style="color:#2563eb">${tel}</a></div>` : ''}
        </div>`)
        .on('click', () => setSelected(m.klient))
    })
    if (filtered.length > 0) {
      mapObj.current.fitBounds(L.latLngBounds(filtered.map(m => [m.lat, m.lng])), { padding: [40, 40], maxZoom: 12 })
    }
  }

  // Geokoduj tylko klientów bez współrzędnych i zapisz wynik w bazie
  async function geocodeNowych() {
    const bez = klienci.filter(k => !k.lat && !k.lng && (k.miasto || k.adres))
    if (bez.length === 0) { setInfo('Wszyscy klienci są już na mapie. Brak nowych do geokodowania.'); return }
    setGeocoding(true); setProgress(0)
    let dodano = 0
    for (let i = 0; i < bez.length; i++) {
      const k = bez[i]
      setProgressTxt(`${i + 1}/${bez.length}: ${k.nazwa}`)
      setProgress(Math.round((i + 1) / bez.length * 100))
      const coords = await geocodeOne(k.adres ?? '', k.miasto ?? '')
      if (coords) {
        const { error } = await supabase.from('klienci').update({ lat: coords.lat, lng: coords.lng, geocoded_at: new Date().toISOString() }).eq('id', k.id)
        if (!error) {
          setKlienci(prev => prev.map(x => x.id === k.id ? { ...x, lat: coords.lat, lng: coords.lng } : x))
          setMarkers(prev => prev.find(m => m.klient.id === k.id) ? prev : [...prev, { klient: { ...k, lat: coords.lat, lng: coords.lng }, ...coords }])
          dodano++
        }
      }
      if (i < bez.length - 1) await new Promise(r => setTimeout(r, 1100)) // limit Nominatim: 1 zapytanie/s
    }
    setGeocoding(false); setProgressTxt('')
    setInfo(`Dodano ${dodano} klientów na mapę. Pozycje zapisane w bazie, więc nie trzeba geokodować ponownie.`)
  }

  // Wyczyść współrzędne klientów tej firmy (RLS ogranicza do własnej firmy)
  async function resetuj() {
    if (!confirm('Wyczyścić zapisane pozycje wszystkich klientów? Będzie trzeba geokodować je ponownie.')) return
    const { error } = await supabase.from('klienci').update({ lat: null, lng: null, geocoded_at: null }).not('id', 'is', null)
    if (error) { setBlad('Nie udało się wyczyścić pozycji: ' + error.message); return }
    setKlienci(prev => prev.map(k => ({ ...k, lat: null, lng: null, geocoded_at: null })))
    setMarkers([]); setSelected(null)
    setInfo('Wyczyszczono współrzędne. Kliknij „Geokoduj nowych”, aby ponownie je pobrać.')
  }

  const withAddress = klienci.filter(k => k.miasto || k.adres).length
  const bezKoordynat = klienci.filter(k => !k.lat && !k.lng && (k.miasto || k.adres)).length
  const naMapie = markers.length
  const bezAdresu = klienci.filter(k => !k.adres && !k.miasto)
  const link: React.CSSProperties = { color: '#374151', textDecoration: 'none' }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Mapa klientów</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Ładowanie...' : `${klienci.length} klientów · ${naMapie} na mapie · ${bezKoordynat} bez pozycji`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40" />
          <button onClick={geocodeNowych} disabled={geocoding || loading || bezKoordynat === 0}
            style={{ background: '#111827', color: '#FFFFFF' }}
            className="text-sm rounded-lg px-4 py-1.5 disabled:opacity-50 transition-colors">
            {geocoding ? `${progress}%...` : bezKoordynat > 0 ? `Geokoduj nowych (${bezKoordynat})` : 'Wszyscy na mapie'}
          </button>
          {naMapie > 0 && (
            <button onClick={resetuj} disabled={geocoding}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-500 disabled:opacity-50">
              Reset pozycji
            </button>
          )}
        </div>
      </div>

      {blad && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 mb-3 text-xs text-red-700">{blad}</div>}

      {info && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mb-3 text-xs text-blue-800 flex items-center justify-between">
          <span>{info}</span>
          <button onClick={() => setInfo('')} className="text-blue-400 hover:text-blue-600 ml-2" aria-label="Zamknij">✕</button>
        </div>
      )}

      {naMapie > 0 && (
        <div className="flex gap-4 mb-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-sm"></div>Firma</div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-green-600 border-2 border-white shadow-sm"></div>Osoba fizyczna</div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4" style={{ height: 460 }}>
        {geocoding ? (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center w-64">
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-sm text-gray-600 font-medium">{progressTxt}</p>
              <p className="text-xs text-gray-400 mt-1">Geokodowanie: maks. 1 zapytanie na sekundę</p>
            </div>
          </div>
        ) : (
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
        )}
      </div>

      {naMapie === 0 && !geocoding && !loading && withAddress > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <p className="text-xs text-blue-800 font-medium mb-1">Jak pokazać klientów na mapie?</p>
          <p className="text-xs text-blue-700">Kliknij „Geokoduj nowych”: system pobierze pozycje {withAddress} klientów i zapisze je w bazie. Adresy są wysyłane do publicznego serwisu geokodowania OpenStreetMap (Nominatim). Następnym razem mapa załaduje się od razu.</p>
        </div>
      )}

      {naMapie === 0 && !loading && withAddress === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center mb-4">
          <p className="font-medium text-gray-900">Brak klientów z adresem</p>
          <p className="text-sm text-gray-500 mt-1">Dodaj klientów z adresem lub miastem w module Klienci, a pojawią się na mapie.</p>
        </div>
      )}

      {selected && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-medium text-gray-900">{selected.nazwa}</p>
            <p className="text-xs text-gray-500 mt-0.5">{[selected.adres, selected.kod_pocztowy, selected.miasto].filter(Boolean).join(', ')}</p>
          </div>
          <div className="flex gap-2">
            {selected.telefon && <a href={`tel:${selected.telefon}`} style={link} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">{selected.telefon}</a>}
            <a href="/klienci" style={link} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">Otwórz profil →</a>
            <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2" aria-label="Zamknij">✕</button>
          </div>
        </div>
      )}

      {bezAdresu.length > 0 && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-xs font-medium text-yellow-800 mb-1">Klienci bez adresu ({bezAdresu.length}): nie można ich geokodować</p>
          <div className="flex flex-wrap gap-1">
            {bezAdresu.slice(0, 15).map(k => (
              <span key={k.id} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">{k.nazwa}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
