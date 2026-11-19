import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { czyWlasciciel } from '@/lib/wlasciciel'

// Właściciel platformy przedłuża okres próbny firmy klienta (pełna wersja przez kolejne dni). Tylko firmy niedemo i niepłatne.
export async function POST(req: Request) {
  const sesja = await createServerSupabaseClient()
  const { data: { user } } = await sesja.auth.getUser()
  if (!czyWlasciciel(user)) return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const firmaId = String(b.firmaId ?? '')
  const dni = Math.min(Math.max(parseInt(b.dni) || 30, 1), 90)
  if (!/^[0-9a-f-]{36}$/i.test(firmaId)) return NextResponse.json({ error: 'Niepoprawna firma.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: f } = await admin.from('firmy').select('id,demo,status,trial_do,stripe_status').eq('id', firmaId).maybeSingle()
  if (!f || f.demo) return NextResponse.json({ error: 'Nie można przedłużyć tej firmy.' }, { status: 400 })
  if (f.stripe_status === 'active' || f.stripe_status === 'trialing') return NextResponse.json({ error: 'Firma ma aktywną subskrypcję.' }, { status: 400 })

  const od = Math.max(Date.now(), new Date(f.trial_do).getTime())
  const nowa = new Date(od + dni * 86400000).toISOString()
  const { error } = await admin.from('firmy').update({ status: 'trial', trial_do: nowa }).eq('id', firmaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, trial_do: nowa })
}
