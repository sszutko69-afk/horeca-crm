import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Webhook Stripe: jedyne miejsce, które zmienia plan firmy po płatności. Podpis zdarzenia jest weryfikowany
// (STRIPE_WEBHOOK_SECRET), więc nikt nie może "udawać" płatności wysyłając żądanie z zewnątrz.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const sig = request.headers.get('stripe-signature')
  if (!secret || !sig) return NextResponse.json({ error: 'Brak konfiguracji lub podpisu' }, { status: 400 })

  const stripe = getStripe()
  const body = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy podpis' }, { status: 400 })
  }

  const admin = createAdminClient()

  async function zapiszSubskrypcje(sub: Stripe.Subscription, firmaIdZSesji?: string | null) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
    const firmaId = (sub.metadata?.firma_id as string | undefined) || firmaIdZSesji || null
    // koniec opłaconego okresu: w nowych wersjach API pole jest na pozycji subskrypcji
    const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined
    const koniec = (item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end) ?? null
    const aktywna = sub.status === 'active' || sub.status === 'trialing'
    const status = aktywna ? 'aktywny' : sub.status === 'past_due' || sub.status === 'unpaid' ? 'zalegla' : 'podstawowy'
    const patch = {
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_status: sub.status,
      subskrypcja_do: koniec ? new Date(koniec * 1000).toISOString() : null,
      status,
    }
    const q = firmaId ? admin.from('firmy').update(patch).eq('id', firmaId) : admin.from('firmy').update(patch).eq('stripe_customer_id', customerId)
    const { error } = await q
    if (error) throw error
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        if (s.mode === 'subscription' && s.subscription) {
          const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription.id
          const sub = await stripe.subscriptions.retrieve(subId)
          await zapiszSubskrypcje(sub, s.client_reference_id)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await zapiszSubskrypcje(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id
        if (customerId) await admin.from('firmy').update({ status: 'zalegla', stripe_status: 'past_due' }).eq('stripe_customer_id', customerId)
        break
      }
    }
  } catch (e) {
    console.error('stripe webhook error', event.type, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Błąd przetwarzania' }, { status: 500 }) // Stripe ponowi wysyłkę
  }
  return NextResponse.json({ received: true })
}
