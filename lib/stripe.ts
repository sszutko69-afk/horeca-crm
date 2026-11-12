import Stripe from 'stripe'

// Klucz tajny Stripe jest tylko na serwerze (STRIPE_SECRET_KEY). Dane kart nigdy nie trafiają do naszej aplikacji:
// płatność odbywa się na stronie Stripe Checkout, a my dostajemy tylko status subskrypcji (webhook).
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Brak STRIPE_SECRET_KEY na serwerze')
  return new Stripe(key)
}

export function appUrl(req?: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || (req ? new URL(req.url).origin : 'http://localhost:3000')
}
