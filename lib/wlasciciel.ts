import type { User } from '@supabase/supabase-js'

// Właściciel platformy (widzi statystyki wszystkich firm). Adresy w PLATFORM_OWNER_EMAILS (po przecinku) lub domyślny.
// Wymagamy potwierdzonego adresu e-mail, żeby nikt nie mógł się podszyć pod właściciela rejestrując konto na jego adres.
export function czyWlasciciel(user: User | null | undefined): boolean {
  if (!user?.email || !user.email_confirmed_at) return false
  const lista = (process.env.PLATFORM_OWNER_EMAILS || 'sszutko69@gmail.com')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return lista.includes(user.email.toLowerCase())
}
