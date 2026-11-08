import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FLESPI_TOKEN = process.env.FLESPI_TOKEN ?? ''
const FLESPI_CHANNEL = '1372683'
const IMEI = '867747071481574'

// GET - sync pozycji z flespi do bazy
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const count = searchParams.get('count') ?? '200'

    const url = `https://flespi.io/gw/channels/${FLESPI_CHANNEL}/messages?count=${count}`
    const res = await fetch(url, {
      headers: { Authorization: `FlespiToken ${FLESPI_TOKEN}` },
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Flespi ${res.status}: ${err.substring(0, 200)}` }, { status: 500 })
    }

    const data = await res.json()
    const messages: any[] = data.result ?? []

    if (!messages.length) {
      return NextResponse.json({ ok: true, zapisano: 0, info: 'Brak danych - urządzenie jeszcze nie połączone' })
    }

    const rows = messages
      .filter(m => m['position.latitude'] && m['position.longitude'])
      .map(m => ({
        imei: String(m['ident'] ?? IMEI),
        pojazd_nazwa: 'Cysterna ON Gaz',
        lat: m['position.latitude'],
        lng: m['position.longitude'],
        predkosc: m['position.speed'] ?? 0,
        kierunek: m['position.direction'] ?? 0,
        wysokosc: m['position.altitude'] ?? 0,
        zaplion: m['din.1'] ?? m['engine.ignition.status'] ?? false,
        timestamp: new Date(Math.floor((m['timestamp'] ?? m['server.timestamp']) * 1000)).toISOString(),
        dane_raw: m,
      }))

    if (!rows.length) {
      return NextResponse.json({ ok: true, zapisano: 0, total: messages.length, info: 'Brak danych GPS w wiadomościach' })
    }

    const { error } = await supabase
      .from('gps_pozycje')
      .upsert(rows, { ignoreDuplicates: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, zapisano: rows.length, total: messages.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST - pobierz dane z bazy
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action ?? 'last'

    if (action === 'last') {
      const { data } = await supabase
        .from('gps_pozycje')
        .select('*')
        .eq('imei', IMEI)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()
      return NextResponse.json({ pozycja: data })
    }

    if (action === 'trasa') {
      const godziny = body.godziny ?? 24
      const od = new Date(Date.now() - godziny * 3600 * 1000).toISOString()
      const { data } = await supabase
        .from('gps_pozycje')
        .select('lat, lng, predkosc, zaplion, kierunek, timestamp')
        .eq('imei', IMEI)
        .gte('timestamp', od)
        .order('timestamp', { ascending: true })
      return NextResponse.json({ trasa: data ?? [] })
    }

    if (action === 'statystyki') {
      const od = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      const { data } = await supabase
        .from('gps_pozycje')
        .select('predkosc, zaplion, timestamp')
        .eq('imei', IMEI)
        .gte('timestamp', od)
      const punkty = data ?? []
      const maks = Math.max(...punkty.map(p => p.predkosc ?? 0), 0)
      const srednia = punkty.length ? punkty.reduce((s, p) => s + (p.predkosc ?? 0), 0) / punkty.length : 0
      const zaplonOn = punkty.filter(p => p.zaplion).length
      return NextResponse.json({
        statystyki: {
          punkty: punkty.length,
          max_predkosc: Math.round(maks),
          srednia_predkosc: Math.round(srednia),
          czas_pracy_min: Math.round(zaplonOn * 0.5),
        }
      })
    }

    return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
