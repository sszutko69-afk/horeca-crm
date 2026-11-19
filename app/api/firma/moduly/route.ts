import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { modulyDlaBranzy, MODULY_SYSTEMOWE } from '@/lib/branze'

// Zmiana zestawu modułów firmy po rejestracji (dodanie/wyłączenie). Tylko administrator; moduły walidowane względem branży.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 })
  const { data: profil } = await supabase.from('profiles').select('rola').eq('id', user.id).single()
  if (profil?.rola !== 'admin') return NextResponse.json({ error: 'Moduły zmienia administrator firmy.' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const wybrane: unknown = body?.moduly
  if (!Array.isArray(wybrane)) return NextResponse.json({ error: 'Niepoprawna lista modułów.' }, { status: 400 })

  const { data: firma } = await supabase.from('firmy').select('id,demo,branza').single()
  if (!firma) return NextResponse.json({ error: 'Nie znaleziono firmy.' }, { status: 404 })
  if (firma.demo) return NextResponse.json({ error: 'Konto demonstracyjne ma stały zestaw modułów.' }, { status: 400 })

  const dozwolone = modulyDlaBranzy(firma.branza ?? 'inna')
  const moduly = [...new Set(wybrane.map(String))].filter(m => dozwolone.includes(m))

  const admin = createAdminClient()
  const { error } = await admin.from('firmy').update({ moduly: [...MODULY_SYSTEMOWE, ...moduly] }).eq('id', firma.id)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać: ' + error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
