import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getStripe } from '@/lib/stripe'

// Trwałe usunięcie firmy i wszystkich jej danych (RODO: prawo do usunięcia). Tylko administrator, z potwierdzeniem nazwy firmy.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 })
  const { data: profil } = await supabase.from('profiles').select('rola,firma_id').eq('id', user.id).single()
  if (profil?.rola !== 'admin') return NextResponse.json({ error: 'Tylko administrator firmy.' }, { status: 403 })

  const { potwierdzenie } = await request.json().catch(() => ({ potwierdzenie: '' }))
  const { data: firma } = await supabase.from('firmy').select('id,nazwa,demo,stripe_subscription_id').single()
  if (!firma) return NextResponse.json({ error: 'Nie znaleziono firmy.' }, { status: 404 })
  if (firma.demo) return NextResponse.json({ error: 'Konta demonstracyjnego nie można usunąć.' }, { status: 400 })
  if ((potwierdzenie ?? '').trim() !== firma.nazwa.trim()) {
    return NextResponse.json({ error: 'Wpisz dokładną nazwę firmy, aby potwierdzić usunięcie.' }, { status: 400 })
  }

  const admin = createAdminClient()
  // 1. anuluj subskrypcję w Stripe (żeby nie pobierać opłat po usunięciu)
  if (firma.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    try { await getStripe().subscriptions.cancel(firma.stripe_subscription_id) } catch { /* już anulowana */ }
  }
  // 2. usuń konta logowania wszystkich użytkowników firmy
  const { data: konta } = await admin.from('profiles').select('id').eq('firma_id', firma.id)
  // 3. usuń firmę (kasuje kaskadowo wszystkie dane i profile)
  const { error } = await admin.from('firmy').delete().eq('id', firma.id)
  if (error) return NextResponse.json({ error: 'Nie udało się usunąć danych: ' + error.message }, { status: 500 })
  for (const k of konta ?? []) await admin.auth.admin.deleteUser(k.id)
  return NextResponse.json({ ok: true })
}
