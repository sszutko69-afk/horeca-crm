import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { BRANZE_SLUGI, modulyDlaBranzy, MODULY_SYSTEMOWE } from '@/lib/branze'

// Zapis wyboru branży i modułów firmy. Tylko administrator; wartości walidowane po stronie serwera
// (moduły spoza branży, np. Stoły dla firmy budowlanej, są odrzucane). Zapis do `firmy` tylko przez service role.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 })
  const { data: profil } = await supabase.from('profiles').select('rola,firma_id').eq('id', user.id).single()
  if (profil?.rola !== 'admin') return NextResponse.json({ error: 'Wyboru modułów dokonuje administrator firmy.' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const branza = String(body?.branza ?? '')
  const wybrane: unknown = body?.moduly
  if (!BRANZE_SLUGI.includes(branza)) return NextResponse.json({ error: 'Wybierz branżę.' }, { status: 400 })
  if (!Array.isArray(wybrane)) return NextResponse.json({ error: 'Niepoprawna lista modułów.' }, { status: 400 })

  const dozwolone = modulyDlaBranzy(branza)
  const moduly = [...new Set(wybrane.map(String))].filter(m => dozwolone.includes(m))
  if (moduly.length === 0) return NextResponse.json({ error: 'Wybierz co najmniej jeden moduł.' }, { status: 400 })

  const { data: firma } = await supabase.from('firmy').select('id,demo').single()
  if (!firma) return NextResponse.json({ error: 'Nie znaleziono firmy.' }, { status: 404 })
  if (firma.demo) return NextResponse.json({ error: 'Konto demonstracyjne ma stały zestaw modułów.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('firmy')
    .update({ branza, moduly: [...MODULY_SYSTEMOWE, ...moduly], onboarding_zakonczony: true })
    .eq('id', firma.id)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać wyboru: ' + error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
