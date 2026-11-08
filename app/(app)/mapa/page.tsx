'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type Klient = {
  id: string; nazwa: string; adres: string | null
  miasto: string | null; kod_pocztowy: string | null
  telefon: string | null; typ: string; aktywny: boolean
  lat: number | null; lng: number | null; geocoded_at: string | null
}
type MarkerData = { klient: Klient; lat: number; lng: number }

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
  const q = encodeURIComponent(`${adres}, ${miasto}, Polska`)
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=pl`, {
      headers: { 'Accept-Language': 'pl', 'User-Agent': 'GazCRM/1.0' }
    })
    const data = await res.json()
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    // Fallback — tylko miasto
    const res2 = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(miasto + ', Polska')}&format=json&limit=1&countrycodes=pl`, {
      headers: { 'Accept-Language': 'pl', 'User-Agent': 'GazCRM/1.0' }
    })
    const data2 = await res2.json()
    if (data2.length > 0) return { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) }
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
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<any>(null)
  const markersLayer = useRef<any>(null)

  useEffect(() => { fetchKlienci() }, [])

  useEffect(() => {
    if (!loading) initMap()
  }, [loading])

  useEffect(() => {
    if (mapReady) updateMarkers()
  }, [markers, search, mapReady])

  async function fetchKlienci() {
    setLoading(true)
    const { data } = await supabase
      .from('klienci')
      .select('*')
      .eq('aktywny', true)
      .order('nazwa')
    if (data) {
      setKlienci(data)
      // Załaduj zapisane współrzędne — te co mają lat/lng już geocoded
      const saved = data.filter((k: Klient) => k.lat && k.lng)
      if (saved.length > 0) {
        setMarkers(saved.map((k: Klient) => ({ klient: k, lat: k.lat!, lng: k.lng! })))
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
    const map = L.map(mapRef.current, { zoomControl: true }).setView([52.5, 22.0], 7)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', maxZoom: 19
    }).addTo(map)
    markersLayer.current = L.layerGroup().addTo(map)
    mapObj.current = map
    setMapReady(true)
  }

  function updateMarkers() {
    if (!mapObj.current || !markersLayer.current) return
    const L = (window as any).L
    markersLayer.current.clearLayers()
    const filtered = markers.filter(m =>
      !search ||
      m.klient.nazwa.toLowerCase().includes(search.toLowerCase()) ||
      (m.klient.miasto ?? '').toLowerCase().includes(search.toLowerCase())
    )
    filtered.forEach(m => {
      const color = m.klient.typ === 'firma' ? '#2563eb' : '#16a34a'
      const icon = L.divIcon({
        html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:700">${m.klient.typ === 'firma' ? 'F' : 'O'}</div>`,
        className: '', iconSize: [22, 22], iconAnchor: [11, 11]
      })
      L.marker([m.lat, m.lng], { icon })
        .addTo(markersLayer.current)
        .bindPopup(`<div style="font-family:sans-serif;min-width:160px">
          <div style="font-weight:600;font-size:13px;margin-bottom:3px">${m.klient.nazwa}</div>
          <div style="font-size:11px;color:#555">${[m.klient.adres, m.klient.miasto].filter(Boolean).join(', ')}</div>
          ${m.klient.telefon ? `<div style="margin-top:4px;font-size:11px"><a href="tel:${m.klient.telefon}" style="color:#2563eb">${m.klient.telefon}</a></div>` : ''}
        </div>`)
        .on('click', () => setSelected(m.klient))
    })
    if (filtered.length > 0) {
      const bounds = L.latLngBounds(filtered.map(m => [m.lat, m.lng]))
      mapObj.current.fitBounds(bounds, { padding: [40, 40] })
    }
  }

  // Geokoduj tylko NOWYCH klientów (bez współrzędnych) + zapisuj do bazy
  async function geocodeNowych() {
    const bezKoordynat = klienci.filter(k => !k.lat && !k.lng && (k.miasto || k.adres))
    if (bezKoordynat.length === 0) {
      setInfo('Wszyscy klienci są już na mapie. Brak nowych do geokodowania.')
      return
    }
    setGeocoding(true); setProgress(0)
    setProgressTxt(`Geokodowanie ${bezKoordynat.length} nowych klientów...`)
    let dodano = 0

    for (let i = 0; i < bezKoordynat.length; i++) {
      const k = bezKoordynat[i]
      setProgressTxt(`${i + 1}/${bezKoordynat.length}: ${k.nazwa}`)
      setProgress(Math.round((i + 1) / bezKoordynat.length * 100))

      const coords = await geocodeOne(k.adres ?? '', k.miasto ?? '')
      if (coords) {
        // Zapisz współrzędne do bazy
        await supabase.from('klienci').update({
          lat: coords.lat,
          lng: coords.lng,
          geocoded_at: new Date().toISOString(),
        }).eq('id', k.id)

        // Dodaj do markersów lokalnie
        setMarkers(prev => {
          if (prev.find(m => m.klient.id === k.id)) return prev
          return [...prev, { klient: { ...k, lat: coords.lat, lng: coords.lng }, ...coords }]
        })
        dodano++
      }

      // Rate limit Nominatim: 1 req/s
      if (i < bezKoordynat.length - 1) await new Promise(r => setTimeout(r, 1100))
    }

    setGeocoding(false)
    setInfo(`✓ Dodano ${dodano} nowych klientów na mapę. Pozycje zapisane w bazie — nie trzeba geokodować ponownie.`)
    setProgressTxt('')
  }

  // Wymuś ponowne geokodowanie wszystkich
  async function geocodeWszystkich() {
    await supabase.from('klienci').update({ lat: null, lng: null, geocoded_at: null }).neq('id', '00000000-0000-0000-0000-000000000000')
    setMarkers([])
    setInfo('Wyczyszczono współrzędne. Kliknij "Geokoduj nowych" aby ponownie załadować.')
  }

  const withAddress = klienci.filter(k => k.miasto || k.adres).length
  const bezKoordynat = klienci.filter(k => !k.lat && !k.lng && (k.miasto || k.adres)).length
  const naMapie = markers.length

  return (
    <div className="p-6 max-w-6xl mx-auto">
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
            className="text-sm bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {geocoding ? `${progress}%...` : bezKoordynat > 0 ? `📍 Geokoduj nowych (${bezKoordynat})` : '✓ Wszyscy na mapie'}
          </button>
          {naMapie > 0 && (
            <button onClick={geocodeWszystkich} disabled={geocoding}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-500 disabled:opacity-50">
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {info && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mb-3 text-xs text-blue-800 flex items-center justify-between">
          <span>{info}</span>
          <button onClick={() => setInfo('')} className="text-blue-400 hover:text-blue-600 ml-2">✕</button>
        </div>
      )}

      {naMapie > 0 && (
        <div className="flex gap-4 mb-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-sm"></div>Firma</div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600"><div className="w-4 h-4 rounded-full bg-green-600 border-2 border-white shadow-sm"></div>Osoba fizyczna</div>
        </div>
      )}

      {/* Mapa */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4" style={{ height: 460 }}>
        {geocoding ? (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center w-64">
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-sm text-gray-600 font-medium">{progressTxt}</p>
              <p className="text-xs text-gray-400 mt-1">Nominatim: max 1 req/s</p>
            </div>
          </div>
        ) : (
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
        )}
      </div>

      {naMapie === 0 && !geocoding && !loading && withAddress > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <p className="text-xs text-blue-800 font-medium mb-1">Jak pokazać klientów na mapie?</p>
          <p className="text-xs text-blue-700">Kliknij "📍 Geokoduj nowych" — system pobierze GPS dla {withAddress} klientów i <strong>zapisze je w bazie</strong>. Następnym razem mapa załaduje się natychmiast bez geokodowania.</p>
        </div>
      )}

      {selected && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-medium text-gray-900">{selected.nazwa}</p>
            <p className="text-xs text-gray-500 mt-0.5">{[selected.adres, selected.kod_pocztowy, selected.miasto].filter(Boolean).join(', ')}</p>
          </div>
          <div className="flex gap-2">
            {selected.telefon && <a href={`tel:${selected.telefon}`} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600">📞 {selected.telefon}</a>}
            <a href="/klienci" className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600">Otwórz profil →</a>
            <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2">✕</button>
          </div>
        </div>
      )}

      {klienci.filter(k => !k.adres && !k.miasto).length > 0 && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-xs font-medium text-yellow-800 mb-1">Klienci bez adresu ({klienci.filter(k => !k.adres && !k.miasto).length}) — nie można ich geokodować:</p>
          <div className="flex flex-wrap gap-1">
            {klienci.filter(k => !k.adres && !k.miasto).slice(0, 15).map(k => (
              <span key={k.id} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">{k.nazwa}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
