import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [
      { data: klienci },
      { data: zakupy },
      { data: sprzedaz },
      { data: inwestycje },
      { data: trasy },
      { data: profiles },
    ] = await Promise.all([
      supabase.from('klienci').select('*'),
      supabase.from('zakupy').select('*'),
      supabase.from('sprzedaz').select('*'),
      supabase.from('inwestycje').select('*'),
      supabase.from('trasy').select('*'),
      supabase.from('profiles').select('id, imie_nazwisko, login, rola, aktywny'),
    ])

    const timestamp = new Date().toISOString()
    const backup = {
      timestamp,
      wersja: '1.0',
      dane: { klienci, zakupy, sprzedaz, inwestycje, trasy, profiles },
      statystyki: {
        klienci: klienci?.length ?? 0,
        zakupy: zakupy?.length ?? 0,
        sprzedaz: sprzedaz?.length ?? 0,
        inwestycje: inwestycje?.length ?? 0,
        trasy: trasy?.length ?? 0,
      }
    }

    const fileName = `gazcrm-backup-${timestamp.split('T')[0]}.json`
    const body = JSON.stringify(backup, null, 2)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(Buffer.byteLength(body, 'utf8')),
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
