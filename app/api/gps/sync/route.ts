import { NextRequest, NextResponse } from 'next/server'
import { wymagajModulu } from '@/lib/dostep-api'
import { pobierzKonfiguracjeGps, gpsGotowy } from '@/lib/gps-konfig'

export const maxDuration = 30

// GET: synchronizacja pozycji z Flespi do bazy firmy; POST: odczyt zapisanych pozycji (trasa, statystyki).
// Zapis i odczyt idą przez sesję użytkownika (RLS), więc dotyczą wyłącznie firmy użytkownika.
export async function GET(req: NextRequest) {
  try {
    const d = await wymagajModulu('Cysterna i GPS')
    if ('blad' in d) return d.blad
    const k = await pobierzKonfiguracjeGps(d.firma.id)
    if (!gpsGotowy(k)) return NextResponse.json({ ok: true, zapisano: 0, info: 'Tracker GPS nie jest skonfigurowany.' })

    const count = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get('count') ?? '200') || 200, 1), 1000)
    const res = await fetch(`https://flespi.io/gw/channels/${encodeURIComponent(k.flespi_channel)}/messages?count=${count}`, {
      headers: { Authorization: `FlespiToken ${k.flespi_token}` },
    })
    if (!res.ok) return NextResponse.json({ error: `Flespi ${res.status}` }, { status: 502 })
    const messages: any[] = (await res.json()).result ?? []
    if (!messages.length) return NextResponse.json({ ok: true, zapisano: 0, info: 'Brak danych: urządzenie jeszcze nie połączone' })

    const rows = messages
      .filter(m => m['position.latitude'] && m['position.longitude'])
      .map(m => ({
        imei: String(m['ident'] ?? k.imei ?? 'tracker'),
        pojazd_nazwa: k.pojazd_nazwa ?? 'Pojazd',
        lat: m['position.latitude'], lng: m['position.longitude'],
        predkosc: m['position.speed'] ?? 0, kierunek: m['position.direction'] ?? 0, wysokosc: m['position.altitude'] ?? 0,
        zaplion: m['din.1'] ?? m['engine.ignition.status'] ?? false,
        timestamp: new Date(Math.floor((m['timestamp'] ?? m['server.timestamp']) * 1000)).toISOString(),
      }))
    if (!rows.length) return NextResponse.json({ ok: true, zapisano: 0, info: 'Brak danych GPS w wiadomościach' })

    const { error } = await d.supabase.from('gps_pozycje').upsert(rows, { onConflict: 'firma_id,imei,timestamp', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, zapisano: rows.length, total: messages.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const d = await wymagajModulu('Cysterna i GPS')
    if ('blad' in d) return d.blad
    const body = await req.json().catch(() => ({}))
    const action = body.action ?? 'last'
    const sb = d.supabase

    if (action === 'last') {
      const { data } = await sb.from('gps_pozycje').select('*').order('timestamp', { ascending: false }).limit(1).maybeSingle()
      return NextResponse.json({ pozycja: data })
    }
    if (action === 'trasa') {
      const godziny = Math.min(Math.max(Number(body.godziny) || 24, 1), 24 * 31)
      const od = new Date(Date.now() - godziny * 3600 * 1000).toISOString()
      const { data } = await sb.from('gps_pozycje').select('lat, lng, predkosc, zaplion, kierunek, timestamp')
        .gte('timestamp', od).order('timestamp', { ascending: true }).limit(5000)
      return NextResponse.json({ trasa: data ?? [] })
    }
    if (action === 'statystyki') {
      const od = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      const { data } = await sb.from('gps_pozycje').select('predkosc, zaplion, timestamp').gte('timestamp', od).limit(5000)
      const punkty = data ?? []
      const maks = Math.max(...punkty.map(p => Number(p.predkosc) || 0), 0)
      const srednia = punkty.length ? punkty.reduce((s, p) => s + (Number(p.predkosc) || 0), 0) / punkty.length : 0
      const zaplonOn = punkty.filter(p => p.zaplion).length
      return NextResponse.json({ statystyki: { punkty: punkty.length, max_predkosc: Math.round(maks), srednia_predkosc: Math.round(srednia), czas_pracy_min: Math.round(zaplonOn * 0.5) } })
    }
    return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
