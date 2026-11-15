import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { BRANZE_SLUGI } from '@/lib/branze'

// Konto demo: przełączenie na firmę demonstracyjną wybranej branży (osobne moduły i dane przykładowe).
// Dozwolone wyłącznie dla konta, które już należy do firmy demo; zmiana profiles.firma_id tylko przez service role.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const branza = String(body?.branza ?? '')
  if (!BRANZE_SLUGI.includes(branza)) return NextResponse.json({ error: 'Nieznana branża.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: profil } = await admin.from('profiles').select('firma_id').eq('id', user.id).single()
  const { data: obecna } = await admin.from('firmy').select('demo').eq('id', profil?.firma_id ?? '').maybeSingle()
  if (!obecna?.demo) return NextResponse.json({ error: 'Dostępne tylko na koncie demonstracyjnym.' }, { status: 403 })

  const { data: cel } = await admin.from('firmy').select('id').eq('demo', true).eq('branza', branza).maybeSingle()
  if (!cel) return NextResponse.json({ error: 'Brak demo dla tej branży.' }, { status: 404 })

  const { error } = await admin.from('profiles').update({ firma_id: cel.id }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
