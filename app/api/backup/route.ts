import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Tabele HoReCa objęte archiwizacją — brakujące (jeszcze nieutworzone) są pomijane
const TABELE = [
  'klienci', 'sprzedaz', 'zakupy', 'zamowienia',
  'pracownicy', 'plan_pracy', 'czas_pracy', 'place', 'wydarzenia',
  'crm_leady', 'crm_zadania', 'crm_aktywnosci', 'kontakty',
  'budzet_kategorie', 'budzet_plan', 'budzet_realizacja', 'firma_dane',
] as const

export async function GET(_request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const wyniki = await Promise.all([
      ...TABELE.map(async t => {
        const { data, error } = await supabase.from(t).select('*')
        return [t, error ? null : data] as const
      }),
      supabase.from('profiles').select('id, imie_nazwisko, login, rola, aktywny, moduly')
        .then(({ data, error }) => ['profiles', error ? null : data] as const),
    ])

    const dane: Record<string, any[]> = {}
    const statystyki: Record<string, number> = {}
    for (const [nazwa, rows] of wyniki) {
      if (!rows) continue
      dane[nazwa] = rows
      statystyki[nazwa] = rows.length
    }

    const timestamp = new Date().toISOString()
    const backup = { timestamp, wersja: '1.0', aplikacja: 'HoReCa CRM', dane, statystyki }

    const fileName = `horeca-crm-backup-${timestamp.split('T')[0]}.json`
    const body = JSON.stringify(backup, null, 2)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(Buffer.byteLength(body, 'utf8')),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
