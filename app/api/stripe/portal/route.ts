import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getStripe, appUrl } from '@/lib/stripe'

// Panel klienta Stripe: zmiana karty, faktury, anulowanie subskrypcji.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 })
  const { data: profil } = await supabase.from('profiles').select('rola').eq('id', user.id).single()
  if (profil?.rola !== 'admin') return NextResponse.json({ error: 'Tylko administrator firmy.' }, { status: 403 })

  const { data: firma } = await supabase.from('firmy').select('stripe_customer_id').single()
  if (!firma?.stripe_customer_id) return NextResponse.json({ error: 'Brak aktywnej subskrypcji.' }, { status: 400 })

  const s = await getStripe().billingPortal.sessions.create({
    customer: firma.stripe_customer_id,
    return_url: `${appUrl(request)}/subskrypcja`,
  })
  return NextResponse.json({ url: s.url })
}
