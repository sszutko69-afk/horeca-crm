import { NextResponse } from 'next/server'
import { wymagajModulu } from '@/lib/dostep-api'
import { pobierzKonfiguracjeGps, gpsGotowy } from '@/lib/gps-konfig'

export const maxDuration = 10

// Bieżąca pozycja pojazdu z Flespi, według konfiguracji trackera firmy użytkownika.
export async function GET() {
  try {
    const d = await wymagajModulu('Cysterna i GPS')
    if ('blad' in d) return d.blad
    const k = await pobierzKonfiguracjeGps(d.firma.id)
    if (!gpsGotowy(k)) return NextResponse.json({ pozycja: null, info: 'Tracker GPS nie jest skonfigurowany. Administrator może go ustawić w zakładce GPS.' })

    const res = await fetch(`https://flespi.io/gw/channels/${encodeURIComponent(k.flespi_channel)}/messages?count=1`, {
      headers: { Authorization: `FlespiToken ${k.flespi_token}` },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ error: `Flespi ${res.status}` }, { status: 502 })
    const msg = (await res.json()).result?.[0]
    if (!msg) return NextResponse.json({ pozycja: null, info: 'Brak danych: urządzenie jeszcze się nie połączyło' })

    return NextResponse.json({
      pozycja: {
        lat: msg['position.latitude'],
        lng: msg['position.longitude'],
        predkosc: Math.round(msg['position.speed'] ?? 0),
        kierunek: msg['position.direction'] ?? 0,
        wysokosc: msg['position.altitude'] ?? 0,
        zaplion: msg['din.1'] ?? msg['engine.ignition.status'] ?? false,
        satelity: msg['position.satellites'] ?? 0,
        timestamp: new Date(Math.floor((msg['timestamp'] ?? msg['server.timestamp']) * 1000)).toISOString(),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
