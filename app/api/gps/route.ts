import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { lat, lng, speed, trasa_id } = await request.json()
    if (!lat || !lng) return NextResponse.json({ error: 'lat i lng są wymagane' }, { status: 400 })
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('gps_pozycje').insert({
      lat: parseFloat(lat), lng: parseFloat(lng),
      predkosc_kmh: speed ? parseFloat(speed) : null,
      trasa_id: trasa_id ?? null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
