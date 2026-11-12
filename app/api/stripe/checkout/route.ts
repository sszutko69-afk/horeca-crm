import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getStripe, appUrl } from '@/lib/stripe'

// Tworzy sesję Stripe Checkout (subskrypcja) dla firmy zalogowanego administratora.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 })

  const { data: profil } = await supabase.from('profiles').select('rola,firma_id').eq('id', user.id).single()
  if (profil?.rola !== 'admin') return NextResponse.json({ error: 'Subskrypcję może wykupić tylko administrator firmy.' }, { status: 403 })

  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Płatności nie są jeszcze skonfigurowane. Skontaktuj się z zespołem Skrojo.' }, { status: 503 })
  }

  const { data: firma } = await supabase.from('firmy').select('id,nazwa,demo,stripe_customer_id,stripe_status').single()
  if (!firma) return NextResponse.json({ error: 'Nie znaleziono firmy.' }, { status: 404 })
  if (firma.demo) return NextResponse.json({ error: 'Konto demonstracyjne nie wymaga subskrypcji.' }, { status: 400 })
  if (firma.stripe_status === 'active' || firma.stripe_status === 'trialing') {
    return NextResponse.json({ error: 'Subskrypcja jest już aktywna. Zarządzaj nią w panelu płatności.' }, { status: 400 })
  }

  const stripe = getStripe()
  const admin = createAdminClient()
  let customerId = firma.stripe_customer_id as string | null
  if (!customerId) {
    const c = await stripe.customers.create({ email: user.email!, name: firma.nazwa, metadata: { firma_id: firma.id } })
    customerId = c.id
    await admin.from('firmy').update({ stripe_customer_id: customerId }).eq('id', firma.id)
  }

  const base = appUrl(request)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: firma.id,
    subscription_data: { metadata: { firma_id: firma.id } },
    metadata: { firma_id: firma.id },
    locale: 'pl',
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    customer_update: { name: 'auto', address: 'auto' },
    allow_promotion_codes: true,
    success_url: `${base}/subskrypcja?ok=1`,
    cancel_url: `${base}/subskrypcja?anulowano=1`,
  })
  return NextResponse.json({ url: session.url })
}
