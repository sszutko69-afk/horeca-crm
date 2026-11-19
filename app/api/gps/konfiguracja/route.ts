import { NextRequest, NextResponse } from 'next/server'
import { wymagajModulu } from '@/lib/dostep-api'
import { createAdminClient } from '@/lib/supabase-admin'
import { pobierzKonfiguracjeGps } from '@/lib/gps-konfig'

// Konfiguracja trackera GPS (Flespi): odczyt bez tokenu dla użytkowników modułu, zapis tylko dla administratora firmy.
export async function GET() {
  const d = await wymagajModulu('Cysterna i GPS')
  if ('blad' in d) return d.blad
  const k = await pobierzKonfiguracjeGps(d.firma.id)
  return NextResponse.json({
    skonfigurowany: !!(k?.flespi_token && k?.flespi_channel),
    imei: k?.imei ?? '', kanal: k?.flespi_channel ?? '', pojazd_nazwa: k?.pojazd_nazwa ?? 'Pojazd',
  })
}

export async function POST(req: NextRequest) {
  const d = await wymagajModulu('Cysterna i GPS')
  if ('blad' in d) return d.blad
  const { data: profil } = await d.supabase.from('profiles').select('rola').eq('id', d.user.id).single()
  if (profil?.rola !== 'admin') return NextResponse.json({ error: 'Konfigurację trackera zmienia administrator firmy.' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const patch: Record<string, string | null> = {
    flespi_channel: String(b.kanal ?? '').trim() || null,
    imei: String(b.imei ?? '').trim() || null,
    pojazd_nazwa: String(b.pojazd_nazwa ?? '').trim() || 'Pojazd',
  }
  const token = String(b.token ?? '').trim()
  if (token) patch.flespi_token = token
  const { error } = await createAdminClient().from('gps_konfiguracja')
    .upsert({ firma_id: d.firma.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'firma_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
