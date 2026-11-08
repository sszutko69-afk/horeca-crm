import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 10

const FLESPI_TOKEN = process.env.FLESPI_TOKEN ?? ''
const FLESPI_CHANNEL = '1372683'

// Live pozycja bezpośrednio z flespi (omija bazę)
export async function GET(req: NextRequest) {
  try {
    const url = `https://flespi.io/gw/channels/${FLESPI_CHANNEL}/messages?count=1`
    const res = await fetch(url, {
      headers: { Authorization: `FlespiToken ${FLESPI_TOKEN}` },
      cache: 'no-store',
    })

    if (!res.ok) return NextResponse.json({ error: `Flespi ${res.status}` }, { status: 500 })

    const data = await res.json()
    const msg = data.result?.[0]

    if (!msg) return NextResponse.json({ pozycja: null, info: 'Brak danych - FMC920 jeszcze się nie połączył' })

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
        surowe: msg,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
